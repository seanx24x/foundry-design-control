import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { verifyReleaseArtifacts } from './release-artifacts.mjs';
import { assertEngineeringDelivery } from './assert-delivery-evidence.mjs';

const root = resolve(import.meta.dirname, '..');
const fixtureSource = join(root, 'examples', 'web-fixture');
const artifactDirectory = join(root, 'artifacts', 'npm');
const release = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));
const version = release.version;
const packageDirectories = [
  'apps/inspector',
  'packages/protocol',
  'packages/web-adapter',
  'packages/runtime',
  'packages/cli',
  'packages/mcp-server',
  'packages/react-native-adapter',
];
const packages = packageDirectories.map((directory) =>
  JSON.parse(readFileSync(join(root, directory, 'package.json'), 'utf8')),
);
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
const mode = valueAfter('--mode') ?? 'packed';
const negative = valueAfter('--negative');
const registry = 'https://registry.npmjs.org';
const runtimeUrl = process.env.FOUNDRY_TEST_RUNTIME_URL ?? 'http://127.0.0.1:4387';
const previewUrl = process.env.FOUNDRY_TEST_PREVIEW_URL ?? 'http://127.0.0.1:4390';
const runtimePort = Number(new URL(runtimeUrl).port);
const previewPort = Number(new URL(previewUrl).port);
for (const value of [runtimeUrl, previewUrl]) {
  const url = new URL(value);
  assert.equal(url.protocol, 'http:');
  assert.equal(url.hostname, '127.0.0.1', 'Test servers must stay on loopback.');
  assert.ok(Number.isInteger(Number(url.port)) && Number(url.port) > 1024);
}
assert.notEqual(runtimePort, previewPort, 'Test servers must use distinct ports.');

function configureFixturePorts(project) {
  const serverPath = join(project, 'server.mjs');
  writeFileSync(
    serverPath,
    readFileSync(serverPath, 'utf8').replaceAll('4390', String(previewPort)),
  );
  const htmlPath = join(project, 'index.html');
  writeFileSync(
    htmlPath,
    readFileSync(htmlPath, 'utf8').replaceAll(
      'http://127.0.0.1:4387/adapter.js',
      `${runtimeUrl}/adapter.js`,
    ),
  );
}

function resolvePlaywrightBrowsersPath() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;
  let directory = dirname(chromium.executablePath());
  while (directory !== dirname(directory)) {
    if (/^chromium-\d+$/.test(basename(directory))) return dirname(directory);
    directory = dirname(directory);
  }
  throw new Error('Could not resolve the installed Playwright browser cache.');
}

if (!['workspace', 'packed', 'registry'].includes(mode)) {
  throw new Error('--mode must be workspace, packed or registry.');
}
if (
  negative &&
  !['all', 'offline-listener', 'disconnected-preview', 'verification-mismatch'].includes(negative)
) {
  throw new Error(
    '--negative must be offline-listener, disconnected-preview, verification-mismatch, or all.',
  );
}

const harnessRoot = mkdtempSync(join(tmpdir(), `foundry-${mode}-golden-`));
const diagnostics = [];
const ownedProcesses = new Set();
const ownedBrowsers = new Set();
let handlingSignal = false;

function redact(value) {
  return String(value)
    .replace(/(token(?:%3D|=))[A-Za-z0-9_-]+/gi, '$1[redacted]')
    .replace(/(__foundry_preview_capability(?:%3D|=))[A-Za-z0-9_-]+/gi, '$1[redacted]');
}

function log(message) {
  const line = `[golden:${mode}] ${message}`;
  diagnostics.push(line);
  console.log(line);
}

function command(cwd, executable, commandArgs, environment = {}, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const result = spawnSync(executable, commandArgs, {
    cwd,
    env: { ...process.env, ...environment },
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
  });
  const transcript = redact(
    [`$ ${executable} ${commandArgs.join(' ')}`, result.stdout?.trim(), result.stderr?.trim()]
      .filter(Boolean)
      .join('\n'),
  );
  diagnostics.push(transcript);
  if (result.error || (result.status !== 0 && !options.allowFailure)) {
    const failure = result.error
      ? `${result.error.code ?? result.error.name}: ${result.error.message}`
      : `status ${result.status ?? 'unknown'}`;
    throw new Error(
      `${options.label ?? executable} failed with ${failure} (timeout ${Math.round(timeoutMs / 1000)}s).\n${transcript}`,
    );
  }
  return result;
}

function isolatedEnvironment(home) {
  return {
    HOME: home,
    USERPROFILE: home,
    INIT_CWD: home,
    npm_config_cache: join(home, '.npm-cache'),
    npm_config_registry: registry,
    // Keep all application/cache state isolated while sharing the installed,
    // read-only browser executable used by CLI-owned source image capture.
    PLAYWRIGHT_BROWSERS_PATH: resolvePlaywrightBrowsersPath(),
    NO_COLOR: '1',
  };
}

const registryEntrypoints = {
  cli: {
    packageSpec: `foundry-design@${version}`,
    binary: 'foundry-design',
  },
  mcp: {
    packageSpec: `foundry-design-mcp-server@${version}`,
    binary: 'foundry-design-mcp',
  },
};

function toolingCommand(tooling, entrypoint, commandArgs = []) {
  if (tooling.mode === 'packed' || tooling.mode === 'workspace') {
    return {
      executable: process.execPath,
      args: [tooling[entrypoint], ...commandArgs],
    };
  }
  const entry = registryEntrypoints[entrypoint];
  return {
    executable: 'npx',
    args: [
      '--yes',
      '--prefer-online',
      `--registry=${registry}`,
      `--package=${entry.packageSpec}`,
      '--',
      entry.binary,
      ...commandArgs,
    ],
  };
}

function assertFreshCache(cache, label) {
  assert.equal(
    existsSync(cache),
    false,
    `${label} must start with a fresh npm cache, but ${cache} already exists.`,
  );
  log(`${label} will resolve through npx from a fresh isolated npm cache.`);
}

function installTooling() {
  if (mode === 'workspace') {
    const tooling = {
      mode,
      root,
      cli: join(root, 'packages/cli/dist/index.js'),
      mcp: join(root, 'packages/mcp-server/dist/index.js'),
    };
    for (const path of [tooling.cli, tooling.mcp]) {
      assert.ok(existsSync(path), `Missing ${path}; run pnpm build first.`);
    }
    return tooling;
  }
  if (mode === 'registry') {
    const releasePackageNames = new Set(packages.map(({ name }) => name));
    assert.ok(releasePackageNames.has('foundry-design'));
    assert.ok(releasePackageNames.has('foundry-design-mcp-server'));
    log(
      `Registry mode will execute ${registryEntrypoints.cli.packageSpec} and ${registryEntrypoints.mcp.packageSpec} through npx.`,
    );
    return { mode };
  }
  const tooling = join(harnessRoot, 'tooling');
  const home = join(harnessRoot, 'tooling-home');
  mkdirSync(tooling, { recursive: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(join(tooling, 'package.json'), '{"private":true,"type":"module"}\n');
  const installArgs = [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
    `--registry=${registry}`,
  ];
  if (!existsSync(artifactDirectory)) {
    throw new Error('Packed golden path requires artifacts/npm. Run pnpm release:pack first.');
  }
  const manifest = verifyReleaseArtifacts(root, artifactDirectory);
  assert.equal(
    manifest.packages.length,
    packages.length,
    'Packed golden path requires a sealed manifest for all seven release tarballs.',
  );
  log(`Verified the sealed ${manifest.releaseVersion} artifact manifest before installation.`);
  const tarballs = readdirSync(artifactDirectory)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => join(artifactDirectory, name));
  assert.equal(tarballs.length, packages.length, 'Expected all seven release tarballs.');
  installArgs.push(...tarballs);
  log(`Installing ${packages.length} ${mode} packages into an isolated tool home.`);
  command(tooling, 'npm', installArgs, isolatedEnvironment(home), { label: 'package install' });
  for (const entry of packages) {
    const installed = JSON.parse(
      readFileSync(join(tooling, 'node_modules', entry.name, 'package.json'), 'utf8'),
    );
    assert.equal(installed.version, version, `${entry.name} did not resolve to ${version}.`);
  }
  return {
    mode,
    root: tooling,
    cli: join(tooling, 'node_modules', 'foundry-design', 'dist', 'index.js'),
    mcp: join(tooling, 'node_modules', 'foundry-design-mcp-server', 'dist', 'index.js'),
  };
}

async function assertPortFree(port) {
  const server = createServer();
  await new Promise((resolveCheck, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolveCheck);
  }).catch((error) => {
    throw new Error(
      `Golden-path port ${port} is unavailable. Stop the existing Foundry/fixture process first: ${error.message}`,
    );
  });
  await new Promise((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
}

async function waitForOwnedPortsToClose() {
  for (const port of [runtimePort, previewPort]) {
    await waitFor(
      async () => {
        try {
          await assertPortFree(port);
          return true;
        } catch {
          return false;
        }
      },
      `owned port ${port} to be released`,
      6_000,
      100,
    );
  }
}

async function waitFor(check, label, timeout = 20_000, interval = 100) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, interval));
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}.`);
}

async function waitForHttp(url, label) {
  await waitFor(
    async () =>
      fetch(url)
        .then((response) => response.ok)
        .catch(() => false),
    label,
    30_000,
    150,
  );
}

function startProcess(label, executable, commandArgs, options) {
  const { retainOwnedOnExit = false, ...spawnOptions } = options;
  const child = spawn(executable, commandArgs, {
    ...spawnOptions,
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '';
  const capture = (channel, chunk) => {
    const text = String(chunk);
    output += text;
    diagnostics.push(`[${label}:${channel}] ${redact(text.trimEnd())}`);
  };
  child.stdout.on('data', (chunk) => capture('stdout', chunk));
  child.stderr.on('data', (chunk) => capture('stderr', chunk));
  const owned = { label, child, output: () => output };
  ownedProcesses.add(owned);
  child.once('exit', () => {
    if (!retainOwnedOnExit) ownedProcesses.delete(owned);
  });
  return owned;
}

async function asynchronousCommand(
  cwd,
  executable,
  commandArgs,
  environment = {},
  { label = executable, timeoutMs = 60_000 } = {},
) {
  diagnostics.push(redact(`$ ${executable} ${commandArgs.join(' ')}`));
  const owned = startProcess(label, executable, commandArgs, {
    cwd,
    env: { ...process.env, ...environment },
    retainOwnedOnExit: true,
  });
  let timeout;
  try {
    const result = await Promise.race([
      new Promise((resolveCommand, reject) => {
        owned.child.once('error', reject);
        owned.child.once('exit', (code, signal) => resolveCommand({ code, signal }));
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          reject(
            new Error(`${label} exceeded its ${Math.round(timeoutMs / 1000)} second timeout.`),
          );
        }, timeoutMs);
      }),
    ]);
    if (result.code !== 0) {
      const outcome = result.signal
        ? `signal ${result.signal}`
        : `status ${result.code ?? 'unknown'}`;
      throw new Error(`${label} failed with ${outcome}.\n${redact(owned.output())}`);
    }
    await stopProcess(owned, { includeExitedGroup: true });
    return result;
  } catch (error) {
    await stopProcess(owned, { includeExitedGroup: true });
    throw error;
  } finally {
    clearTimeout(timeout);
    ownedProcesses.delete(owned);
  }
}

function targetIsAlive(target) {
  try {
    process.kill(target, 0);
    return true;
  } catch {
    return false;
  }
}

async function stopProcess(owned, { includeExitedGroup = false } = {}) {
  if (!owned?.child) return;
  const childExited = owned.child.exitCode != null || owned.child.signalCode != null;
  if (childExited && !includeExitedGroup) return;
  const target = process.platform === 'win32' ? owned.child.pid : -owned.child.pid;
  try {
    process.kill(target, 'SIGTERM');
  } catch {
    return;
  }
  if (!childExited) {
    await Promise.race([
      once(owned.child, 'exit'),
      new Promise((resolveWait) => setTimeout(resolveWait, 2_000)),
    ]);
  }
  const deadline = Date.now() + 2_000;
  while (includeExitedGroup && targetIsAlive(target) && Date.now() < deadline) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  const childStillAlive = owned.child.exitCode == null && owned.child.signalCode == null;
  if (childStillAlive || (includeExitedGroup && targetIsAlive(target))) {
    try {
      process.kill(target, 'SIGKILL');
    } catch {
      // The process may exit between the state check and signal.
    }
  }
}

async function stopOwnedResources() {
  const results = await Promise.allSettled(
    [
      ...[...ownedBrowsers].map((browser) => browser.close()),
      [...ownedProcesses].map((process) =>
        stopProcess(process, {
          includeExitedGroup: true,
        }),
      ),
    ].flat(),
  );
  const failures = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason);
  if (failures.length) {
    throw new AggregateError(failures, 'One or more owned resources failed to stop cleanly.');
  }
}

function retainFailureDiagnostics(reason) {
  diagnostics.push(redact(reason?.stack ?? String(reason)));
  mkdirSync(harnessRoot, { recursive: true });
  writeFileSync(join(harnessRoot, 'diagnostics.log'), `${diagnostics.join('\n')}\n`);
  console.error(`Golden path failed. Diagnostics retained at ${harnessRoot}`);
  console.error(redact(reason?.stack ?? String(reason)));
}

function handleSignal(signal, exitCode) {
  process.once(signal, () => {
    if (handlingSignal) return;
    handlingSignal = true;
    retainFailureDiagnostics(`Golden path interrupted by ${signal}.`);
    void stopOwnedResources().finally(() => process.exit(exitCode));
  });
}

handleSignal('SIGINT', 130);
handleSignal('SIGTERM', 143);

function initializeGit(project) {
  command(project, 'git', ['init', '--quiet']);
  command(project, 'git', ['config', 'user.name', 'Foundry Golden Path']);
  command(project, 'git', ['config', 'user.email', 'foundry-golden@example.invalid']);
  command(project, 'git', ['add', '.']);
  command(project, 'git', ['commit', '--quiet', '-m', 'Initial Morrow fixture']);
}

function commitSetup(project) {
  command(project, 'git', ['add', '.']);
  command(
    project,
    'git',
    ['commit', '--quiet', '-m', 'Install Foundry'],
    {},
    { allowFailure: true },
  );
}

function prepareProject(name, tooling) {
  const scenarioRoot = join(harnessRoot, name);
  const project = join(scenarioRoot, 'morrow');
  const home = join(scenarioRoot, 'home');
  mkdirSync(scenarioRoot, { recursive: true });
  mkdirSync(home, { recursive: true });
  cpSync(fixtureSource, project, { recursive: true });
  // The repository fixture may be instrumented or built during local
  // development. A golden-path project must contain only authored fixture
  // sources so the public CLI proves a genuinely fresh installation.
  for (const localPath of [
    '.foundry',
    '.agents',
    '.codex',
    '.cursor',
    '.claude',
    '.mcp.json',
    'dist',
    'node_modules',
    '.git',
  ]) {
    rmSync(join(project, localPath), { recursive: true, force: true });
  }
  assert.equal(existsSync(join(project, '.foundry', 'install-manifest.json')), false);
  assert.equal(existsSync(join(project, '.foundry', 'foundry.config.json')), false);
  configureFixturePorts(project);
  initializeGit(project);
  const nodeModules = join(project, 'node_modules');
  if (!existsSync(nodeModules)) symlinkSync(join(root, 'node_modules'), nodeModules, 'dir');
  writeFileSync(join(project, '.git', 'info', 'exclude'), 'node_modules\n');
  const environment = { ...isolatedEnvironment(home), INIT_CWD: project };
  const cliEnvironment =
    tooling.mode === 'registry'
      ? { ...environment, npm_config_cache: join(scenarioRoot, 'registry-cli-cache') }
      : environment;
  const mcpEnvironment =
    tooling.mode === 'registry'
      ? { ...environment, npm_config_cache: join(scenarioRoot, 'registry-mcp-cache') }
      : environment;
  const toolingCwd = tooling.mode === 'registry' ? scenarioRoot : project;
  if (tooling.mode === 'registry') {
    assertFreshCache(cliEnvironment.npm_config_cache, 'Public CLI');
    const versionCommand = toolingCommand(tooling, 'cli', ['--version']);
    const resolvedVersion = command(
      toolingCwd,
      versionCommand.executable,
      versionCommand.args,
      cliEnvironment,
      { label: 'public CLI npx resolution' },
    ).stdout.trim();
    assert.equal(
      resolvedVersion,
      version,
      `${registryEntrypoints.cli.packageSpec} did not execute the expected CLI version.`,
    );
  }
  const setupCommand = toolingCommand(tooling, 'cli', [
    'setup',
    '--project',
    project,
    '--agent',
    'none',
    '--url',
    previewUrl,
    '--runtime-port',
    String(runtimePort),
    '--yes',
  ]);
  command(toolingCwd, setupCommand.executable, setupCommand.args, cliEnvironment, {
    label: 'public CLI setup',
  });
  command(project, 'npm', ['run', 'foundry:configure'], environment, {
    label: 'Morrow authored-state configuration',
  });
  commitSetup(project);
  const prepared = {
    scenarioRoot,
    project,
    home,
    environment,
    cliEnvironment,
    mcpEnvironment,
    toolingCwd,
  };
  runDeterministicFixtureBuild(prepared, 40);
  return prepared;
}

async function startSession(prepared, tooling) {
  await assertPortFree(runtimePort);
  await assertPortFree(previewPort);
  const fixture = startProcess('fixture', process.execPath, ['server.mjs'], {
    cwd: prepared.project,
    env: {
      ...process.env,
      ...prepared.environment,
      FOUNDRY_FIXTURE_ROOT: 'dist',
    },
  });
  let cli;
  try {
    await waitForHttp(previewUrl, 'the Morrow fixture');
    const startCommand = toolingCommand(tooling, 'cli', [
      'start',
      '--project',
      prepared.project,
      '--new',
      '--no-open',
      '--no-dev',
    ]);
    cli = startProcess('cli', startCommand.executable, startCommand.args, {
      cwd: prepared.toolingCwd,
      env: { ...process.env, ...prepared.cliEnvironment },
    });
    const workspaceUrl = await waitFor(() => {
      if (cli.child.exitCode != null) {
        throw new Error(
          `Foundry CLI exited early with code ${cli.child.exitCode}.\n${cli.output()}`,
        );
      }
      return cli.output().match(/^Workspace: (.+)$/m)?.[1];
    }, 'the public CLI workspace URL');
    await waitForHttp(runtimeUrl + '/v1/health', 'the Foundry runtime');
    const workspace = new URL(workspaceUrl);
    return {
      fixture,
      cli,
      workspaceUrl,
      sessionId: workspace.searchParams.get('session'),
      token: workspace.searchParams.get('token'),
    };
  } catch (error) {
    await stopProcess(cli, { includeExitedGroup: true });
    await stopProcess(fixture, { includeExitedGroup: true });
    throw error;
  }
}

async function sessionRequest(session) {
  const response = await fetch(`${runtimeUrl}/v1/sessions/${session.sessionId}`, {
    headers: { 'x-foundry-token': session.token },
  });
  if (!response.ok) throw new Error(`Session request failed with ${response.status}.`);
  return response.json();
}

class McpClient {
  constructor(tooling, prepared) {
    if (tooling.mode === 'registry') {
      assertFreshCache(prepared.mcpEnvironment.npm_config_cache, 'Public MCP server');
    }
    const mcpCommand = toolingCommand(tooling, 'mcp');
    this.process = startProcess('mcp', mcpCommand.executable, mcpCommand.args, {
      cwd: tooling.mode === 'registry' ? prepared.toolingCwd : root,
      env: { ...process.env, ...prepared.mcpEnvironment },
    });
    this.startupTimeout = tooling.mode === 'registry' ? 60_000 : 10_000;
    this.pending = new Map();
    this.nextId = 0;
    this.lines = createInterface({ input: this.process.child.stdout });
    this.lines.on('line', (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      if (message.id == null || !this.pending.has(message.id)) return;
      const pending = this.pending.get(message.id);
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? 'MCP request failed.'));
      else pending.resolve(message.result);
    });
    this.process.child.once('exit', (code) => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`MCP server exited before replying (code ${code ?? 'unknown'}).`));
      }
      this.pending.clear();
    });
  }

  async initialize() {
    const initialized = await this.request(
      'initialize',
      {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'foundry-real-golden-path', version },
      },
      this.startupTimeout,
    );
    assert.equal(initialized.serverInfo.name, 'foundry-design-control');
    assert.equal(initialized.serverInfo.version, version);
    this.notify('notifications/initialized', {});
  }

  request(method, params = {}, timeout = 10_000) {
    return new Promise((resolveRequest, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for MCP ${method}.`));
      }, timeout);
      this.pending.set(id, { resolve: resolveRequest, reject, timer });
      this.process.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  notify(method, params = {}) {
    this.process.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  async call(name, toolArgs, timeout = 15_000) {
    const result = await this.request('tools/call', { name, arguments: toolArgs }, timeout);
    if (result.isError) {
      throw new Error(
        result.content
          ?.map((item) => item.text)
          .filter(Boolean)
          .join('\n'),
      );
    }
    return result.structuredContent ?? JSON.parse(result.content?.[0]?.text ?? '{}');
  }

  async close() {
    this.lines.close();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.resolve({
        isError: true,
        content: [{ type: 'text', text: 'MCP client closed before the request completed.' }],
      });
    }
    this.pending.clear();
    await stopProcess(this.process, { includeExitedGroup: true });
  }
}

function observeBrowserVerification(page, session) {
  const records = [];
  const byRequest = new WeakMap();
  const pending = new Set();
  const sessionPath = `/v1/sessions/${session.sessionId}`;
  const kindFor = (input) => {
    const pathname = new URL(input).pathname;
    if (
      pathname.startsWith(`${sessionPath}/apply-runs/`) &&
      pathname.endsWith('/verification-challenge')
    ) {
      return 'challenge';
    }
    if (pathname === `${sessionPath}/verify`) return 'verify';
    return undefined;
  };
  const track = (promise) => {
    pending.add(promise);
    void promise.finally(() => pending.delete(promise));
  };
  page.on('request', (request) => {
    const kind = kindFor(request.url());
    if (!kind) return;
    let body = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    const record = {
      kind,
      method: request.method(),
      url: request.url(),
      frameUrl: request.frame().url(),
      headers: request.headers(),
      body,
      status: undefined,
      response: undefined,
    };
    byRequest.set(request, record);
    records.push(record);
    track(
      request
        .allHeaders()
        .then((headers) => {
          record.headers = headers;
        })
        .catch(() => {}),
    );
  });
  page.on('response', (response) => {
    const record = byRequest.get(response.request());
    if (!record) return;
    record.status = response.status();
    track(
      response
        .json()
        .then((payload) => {
          record.response = payload;
        })
        .catch(() => {}),
    );
  });
  return {
    async snapshot() {
      await Promise.allSettled([...pending]);
      return [...records];
    },
  };
}

async function assertBrowserVerification(browserState, run, renderedHeight, expectedPass) {
  const records = await waitFor(
    async () => {
      const candidate = await browserState.verificationTrace.snapshot();
      return candidate.filter(({ kind }) => kind === 'verify').length === 1 &&
        candidate.filter(({ kind }) => kind === 'challenge').length === 1 &&
        candidate.every(({ status }) => Number.isInteger(status))
        ? candidate
        : undefined;
    },
    'one browser verification challenge and one browser verification result',
    45_000,
  );
  await browserState.verificationTrace.snapshot();
  const challenges = records.filter(({ kind }) => kind === 'challenge');
  const verifies = records.filter(({ kind }) => kind === 'verify');
  assert.equal(
    challenges.length,
    1,
    'The adapter must request exactly one verification challenge.',
  );
  assert.equal(verifies.length, 1, 'The adapter must submit exactly one verification request.');
  const challenge = challenges[0];
  const verify = verifies[0];
  const configuredOrigin = new URL(previewUrl).origin;
  for (const request of [challenge, verify]) {
    assert.equal(request.method, 'POST');
    assert.equal(
      request.headers.origin,
      configuredOrigin,
      `${request.kind} must originate at the configured browser preview.`,
    );
    assert.equal(
      new URL(request.frameUrl).origin,
      configuredOrigin,
      `${request.kind} must be sent by the injected preview adapter.`,
    );
  }
  assert.equal(challenge.status, 201);
  assert.equal(challenge.body?.claimAttemptId, run.claimAttemptId);
  assert.equal(typeof challenge.body?.previewCapability, 'string');
  assert.ok(challenge.body.previewCapability.length >= 32);
  assert.deepEqual(Object.keys(challenge.body).sort(), ['claimAttemptId', 'previewCapability']);
  assert.equal(typeof challenge.response?.challenge, 'string');
  assert.ok(challenge.response.challenge.startsWith('verify_'));
  assert.equal(verify.status, 200);
  assert.equal(verify.body?.source, 'browser-preview');
  assert.equal(verify.body?.runId, run.id);
  assert.equal(verify.body?.claimAttemptId, run.claimAttemptId);
  assert.equal(verify.body?.challenge, challenge.response.challenge);
  assert.equal(verify.body?.results?.length, 1);
  const result = verify.body.results[0];
  assert.equal(result.applyRunId, run.id);
  assert.equal(result.claimAttemptId, run.claimAttemptId);
  assert.equal(result.changeId, run.changeIds[0]);
  assert.equal(result.property, 'minHeight');
  assert.equal(result.requested, 44);
  assert.equal(result.rendered, `${renderedHeight}px`);
  assert.equal(result.passed, expectedPass);
  assert.ok(Number.isFinite(result.geometry?.width) && result.geometry.width > 0);
  assert.ok(Number.isFinite(result.geometry?.height) && result.geometry.height > 0);
  assert.equal(Math.round(result.geometry.height), renderedHeight);
  assert.ok(result.geometry.x + result.geometry.width > 0);
  assert.ok(result.geometry.y + result.geometry.height > 0);
  assert.ok(Array.isArray(result.evidence) && result.evidence.length > 0);
  assert.ok(Number.isFinite(Date.parse(result.verifiedAt)));
  return result;
}

async function openWorkspace(session, { installPreviewPingBlocker = false } = {}) {
  const browser = await chromium.launch({ headless: true });
  ownedBrowsers.add(browser);
  browser.on('disconnected', () => ownedBrowsers.delete(browser));
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    if (installPreviewPingBlocker) {
      await page.addInitScript(() => {
        window.addEventListener(
          'message',
          (event) => {
            if (
              window.__foundryGoldenDropPreviewPings === true &&
              event.data?.type === 'foundry:workspace-command' &&
              event.data?.command === 'preview-ping'
            ) {
              event.stopImmediatePropagation();
            }
          },
          { capture: true },
        );
      });
    }
    page.on('pageerror', (error) =>
      diagnostics.push(`[browser:error] ${redact(error.stack ?? error)}`),
    );
    page.on('console', (message) => {
      if (message.type() === 'error') {
        diagnostics.push(`[browser:console] ${redact(message.text())}`);
      }
    });
    const verificationTrace = observeBrowserVerification(page, session);
    await page.goto(session.workspaceUrl, { waitUntil: 'domcontentloaded' });
    const product = page.frameLocator('#product-preview');
    await product.locator('[data-foundry-id="password-reveal"]').waitFor({ timeout: 20_000 });
    await page.locator('#live-status[data-status="live"]').waitFor({ timeout: 20_000 });
    await page.waitForTimeout(2_100);
    assert.equal(
      await page.locator('#live-status').getAttribute('data-status'),
      'live',
      'The primary preview must complete and sustain its live handshake before actions begin.',
    );
    const stored = await sessionRequest(session);
    assert.equal(stored.changeSet.context.targetUrl, previewUrl);
    assert.equal(stored.changeSet.context.previewOrigin, new URL(previewUrl).origin);
    const authoredLoadingState = stored.designGraph.states.find(({ id }) => id === 'loading');
    assert.deepEqual(authoredLoadingState?.query, { 'morrow-state': 'loading' });
    assert.equal(authoredLoadingState?.label, 'Loading');
    return { browser, page, product, verificationTrace };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function stageTouchTargetCorrection(session, browserState) {
  const { page, product } = browserState;
  await product
    .locator('[data-foundry-id="password-reveal"]')
    .click({ modifiers: ['Alt'], position: { x: 20, y: 20 } });
  await openWorkspaceMode(page, 'health');
  const keyboardProfile = page.locator('[data-stress-condition="keyboard-only"]');
  await keyboardProfile.waitFor();
  if ((await keyboardProfile.getAttribute('aria-pressed')) !== 'true')
    await keyboardProfile.click();
  await page.locator('#apply-stress').click();
  try {
    await page.waitForFunction(() => {
      const findings = [...document.querySelectorAll('.stress-finding-card')];
      return (
        findings.length === 1 &&
        findings[0]?.textContent?.includes('Touch target is too small') &&
        findings[0]?.textContent?.includes('style.css:')
      );
    });
  } catch (error) {
    const renderedState = await page.evaluate(() => ({
      status: document.querySelector('#stress-lab-status')?.textContent?.trim() ?? '',
      summary: document.querySelector('#stress-summary-grid')?.textContent?.trim() ?? '',
      empty: document.querySelector('.stress-empty')?.textContent?.trim() ?? '',
      findings: [...document.querySelectorAll('.stress-finding-card')].map((finding) =>
        finding.textContent?.replace(/\s+/g, ' ').trim(),
      ),
      toast: document.querySelector('.toast')?.textContent?.trim() ?? '',
    }));
    throw new Error(
      `Selection-scoped health scan did not render its single mapped touch-target finding: ${JSON.stringify(renderedState)}\n${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const scopedFindings = page.locator('.stress-finding-card');
  assert.equal(
    await scopedFindings.count(),
    1,
    'Selection stress must exclude findings from outside the selected target.',
  );
  assert.match(
    (await scopedFindings.locator('[data-stress-select]').getAttribute('data-stress-select')) ?? '',
    /password-reveal/,
    'The selection-scoped finding must remain attached to password-reveal.',
  );
  const revealFinding = page
    .locator('.stress-finding-card')
    .filter({ hasText: 'Touch target is too small' })
    .filter({ hasText: 'style.css:' });
  await revealFinding.waitFor({ timeout: 15_000 });
  assert.equal(
    await revealFinding.count(),
    1,
    'Morrow must expose one mapped touch-target finding.',
  );
  await revealFinding.locator('[data-stress-fix]').click();
  await revealFinding.getByText(/^Added to review$/i).waitFor({ timeout: 15_000 });
  const stored = await waitFor(async () => {
    const candidate = await sessionRequest(session);
    const changes = candidate.changeSet?.changes ?? [];
    return changes.length === 1 && changes[0].property === 'minHeight' ? candidate : undefined;
  }, 'the 40 px to 44 px reviewed change');
  const change = stored.changeSet.changes[0];
  assert.equal(change.target.id, 'password-reveal');
  assert.equal(change.target.componentPath.join('/'), 'Signup/PasswordReveal');
  assert.equal(change.target.source.file, 'style.css');
  assert.equal(Number.parseFloat(String(change.before)), 40);
  assert.equal(Number.parseFloat(String(change.after)), 44);
  return change;
}

function replaceRevealHeight(project, height) {
  const path = join(project, 'style.css');
  const before = readFileSync(path, 'utf8');
  const after = before.replace(
    /(\.reveal-button\s*\{[\s\S]*?min-height:\s*)40px;/,
    `$1${height}px;`,
  );
  assert.notEqual(after, before, 'The Morrow reveal source rule was not edited.');
  writeFileSync(path, after);
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function revealSourceLineAnchor(project) {
  const line = readFileSync(join(project, 'style.css'), 'utf8').split(/\r?\n/)[659];
  assert.ok(line?.includes('/* foundry: password-reveal */'));
  return {
    line: 660,
    endLine: 660,
    symbol: '/* foundry: password-reveal */',
    sha256: sha256(line),
  };
}

function runDeterministicFixtureBuild(prepared, expectedHeight) {
  const build = () => {
    command(prepared.project, 'npm', ['run', 'build'], prepared.environment, {
      label: 'deterministic Morrow fixture build',
    });
    const output = join(prepared.project, 'dist');
    const manifestText = readFileSync(join(output, 'build-manifest.json'), 'utf8');
    const manifest = JSON.parse(manifestText);
    assert.equal(manifest.version, 1);
    assert.deepEqual(Object.keys(manifest.files), [
      'index.html',
      'style.css',
      'fonts/inter.woff2',
      'fonts/inter-OFL.txt',
      'fonts/google-sans-flex.woff2',
      'fonts/google-sans-flex-OFL.txt',
    ]);
    assert.deepEqual(manifest.sourceAnnotations, {
      count: 13,
      files: ['index.html', 'style.css'],
    });
    for (const file of Object.keys(manifest.files)) {
      const source = readFileSync(join(prepared.project, file));
      const rendered = readFileSync(join(output, file));
      assert.deepEqual(rendered, source, `Built ${file} must be source-identical.`);
      assert.equal(manifest.files[file].bytes, source.byteLength);
      assert.equal(manifest.files[file].sha256, sha256(source));
    }
    const builtCss = readFileSync(join(output, 'style.css'), 'utf8');
    const revealHeight = builtCss.match(/\.reveal-button\s*\{[\s\S]*?min-height:\s*(\d+)px;/)?.[1];
    assert.equal(Number(revealHeight), expectedHeight);
    return manifestText;
  };
  const first = build();
  const second = build();
  assert.equal(second, first, 'Two Morrow builds must produce the same integrity manifest.');
}

async function runFixtureValidation(prepared, expectedHeight, complete = true) {
  const environment = {
    ...prepared.environment,
    FOUNDRY_EXPECT_REVEAL_HEIGHT: String(expectedHeight),
    PLAYWRIGHT_BROWSERS_PATH: resolvePlaywrightBrowsersPath(),
  };
  runDeterministicFixtureBuild(prepared, expectedHeight);
  if (complete) {
    log('Running the complete Morrow fixture suite against the rebuilt source.');
    await asynchronousCommand(prepared.project, 'npm', ['test'], environment, {
      label: 'complete Morrow fixture validation',
      timeoutMs: 60_000,
    });
    log('The complete Morrow fixture suite passed.');
  } else {
    const sourceTestPattern =
      '^(signup fixture|source annotations|source annotation drift|dark theme uses)';
    await asynchronousCommand(
      prepared.project,
      process.execPath,
      ['--test', '--test-name-pattern', sourceTestPattern, 'smoke.test.mjs'],
      environment,
      { label: 'Morrow fixture source validation', timeoutMs: 45_000 },
    );
    await asynchronousCommand(
      prepared.project,
      process.execPath,
      ['validate-source-annotations.mjs'],
      environment,
      {
        label: 'Morrow source annotation validation',
        timeoutMs: 30_000,
      },
    );
  }
  return {
    name: 'Morrow fixture',
    passed: true,
    summary: complete
      ? 'The complete Morrow suite passed: authored query state, deterministic build, source mapping, rendered dark theme with no light panels, and 4 px grid validation.'
      : `Deterministic build, source mapping, and dark theme validation passed before the intentional ${expectedHeight} px mismatch.`,
  };
}

async function listenerPresence(session) {
  const response = await fetch(`${runtimeUrl}/v1/sessions/${session.sessionId}/agent-presence`, {
    headers: { 'x-foundry-token': session.token },
  });
  return response.ok ? response.json() : { connected: false };
}

async function openWorkspaceMode(page, mode) {
  if (mode === 'review') {
    await page.locator('#persistent-review').click();
    return;
  }
  if ((await page.locator('#app-shell').getAttribute('data-next')) === 'true') {
    const tools = page.locator('[data-next-tools]');
    if ((await tools.getAttribute('aria-expanded')) !== 'true') await tools.click();
  }
  await page.locator(`.workspace-rail [data-workspace-mode="${mode}"]`).click();
}

async function enterReview(page) {
  await openWorkspaceMode(page, 'review');
  await page.getByRole('heading', { name: 'Review and apply', exact: true }).waitFor();
}

async function approveReviewedChange(page) {
  const checkbox = page.locator('[data-change-id]').first();
  await checkbox.waitFor({ timeout: 10_000 });
  if (!(await checkbox.isChecked())) await checkbox.check();
  await waitFor(
    async () => !(await page.locator('#apply-agent').isDisabled()),
    'the approved review batch',
  );
}

async function applyWithRealAgent(prepared, tooling, session, browserState, requestedHeight) {
  const beforeClaim = await sessionRequest(session);
  const sourceRevision = beforeClaim.changeSet.context.revision;
  const designGraphRevision = beforeClaim.changeSet.designGraphRevision;
  assert.ok(sourceRevision, 'The real Apply run requires a source revision.');
  assert.ok(designGraphRevision, 'The real Apply run requires a design-graph revision.');
  const mcp = new McpClient(tooling, {
    ...prepared,
    mcpEnvironment: {
      ...prepared.mcpEnvironment,
      FOUNDRY_DESIGN_RUNTIME_URL: runtimeUrl,
      FOUNDRY_DESIGN_SESSION_ID: session.sessionId,
      FOUNDRY_DESIGN_SESSION_TOKEN: session.token,
    },
  });
  let workPromise;
  try {
    await mcp.initialize();
    workPromise = mcp.call(
      'foundry_design_wait_for_work',
      {
        agent: {
          name: 'Foundry Golden Agent',
          version,
          taskId: `golden-${requestedHeight}`,
        },
        revision: sourceRevision,
        designGraphRevision,
        waitMs: 60_000,
      },
      70_000,
    );
    await waitFor(async () => (await listenerPresence(session)).connected, 'the live MCP listener');
    await enterReview(browserState.page);
    await approveReviewedChange(browserState.page);
    const applyButton = browserState.page.locator('#apply-agent');
    await waitFor(
      async () => (await applyButton.textContent())?.includes('Apply 1 with agent'),
      'the acknowledged agent-ready review state',
      10_000,
    );
    await applyButton.click();
    const claimed = await workPromise;
    assert.equal(claimed.kind, 'apply_run');
    const run = claimed.run;
    assert.equal(run.state, 'claimed');
    assert.equal(run.changeIds.length, 1);
    assert.equal(run.revision, sourceRevision);
    assert.equal(run.designGraphRevision, designGraphRevision);
    assert.ok(run.claimAttemptId);
    assert.ok(run.reviewedChangeSet, 'claimed Apply run must contain its frozen reviewed contract');
    assert.equal(run.sourceProofScope, 'git');
    assert.equal(run.sourceHeadRevision, sourceRevision);
    assert.equal(run.appliedRevision, undefined);
    assert.deepEqual(run.appliedChangedFiles, []);
    assert.deepEqual(run.appliedSourceFiles, []);
    const claimedChange = run.reviewedChangeSet.changes.find(({ id }) =>
      run.changeIds.includes(id),
    );
    assert.equal(claimedChange.target.id, 'password-reveal');
    assert.equal(claimedChange.target.source.file, 'style.css');
    assert.equal(claimedChange.target.source.line, 660);
    assert.equal(claimedChange.target.source.column, 20);
    assert.equal(claimedChange.property, 'minHeight');
    assert.equal(Number.parseFloat(String(claimedChange.after)), 44);
    const baselineStyle = run.baselineSourceFiles.find(({ path }) => path === 'style.css');
    assert.deepEqual(baselineStyle, {
      path: 'style.css',
      exists: true,
      sha256: sha256(readFileSync(join(prepared.project, 'style.css'))),
      lineAnchors: [revealSourceLineAnchor(prepared.project)],
    });
    const common = { runId: run.id, claimAttemptId: run.claimAttemptId };
    await mcp.call('foundry_design_update_apply_run', {
      ...common,
      state: 'applying',
      message: 'Editing the fixture-relative password reveal source rule.',
      changedFiles: ['style.css'],
    });
    replaceRevealHeight(prepared.project, requestedHeight);
    const validation = await runFixtureValidation(
      prepared,
      requestedHeight,
      requestedHeight === 44,
    );
    await mcp.call('foundry_design_update_apply_run', {
      ...common,
      state: 'rebuilding',
      message: 'The real Morrow fixture validation completed.',
      changedFiles: ['style.css'],
      validationResults: [validation],
    });
    const acknowledgement = await mcp.call('foundry_design_record_apply_result', {
      runId: run.id,
      claimAttemptId: run.claimAttemptId,
      changeIds: run.changeIds,
    });
    assert.deepEqual(acknowledgement.applyResult, {
      acknowledged: true,
      runId: run.id,
      claimAttemptId: run.claimAttemptId,
      changeIds: run.changeIds,
    });
    const acknowledgedRun = acknowledgement.applyRuns.find(({ id }) => id === run.id);
    assert.equal(acknowledgedRun.state, 'rebuilding');
    assert.equal(acknowledgedRun.applyResultClaimAttemptId, run.claimAttemptId);
    assert.ok(acknowledgedRun.applyResultAcknowledgedAt);
    assert.notEqual(acknowledgedRun.appliedRevision, run.revision);
    assert.deepEqual(acknowledgedRun.appliedChangedFiles, ['style.css']);
    assert.deepEqual(acknowledgedRun.appliedSourceFiles, [
      {
        path: 'style.css',
        exists: true,
        sha256: sha256(readFileSync(join(prepared.project, 'style.css'))),
        lineAnchors: [revealSourceLineAnchor(prepared.project)],
      },
    ]);
    await mcp.call('foundry_design_update_apply_run', {
      ...common,
      state: 'verifying',
      message: 'The rebuilt preview is ready for browser-origin verification.',
    });
    const verification = await assertBrowserVerification(
      browserState,
      run,
      requestedHeight,
      requestedHeight === 44,
    );
    return {
      run,
      acknowledgedRun,
      measured: Math.round(verification.geometry.height),
      passed: verification.passed,
      verification,
    };
  } finally {
    workPromise?.catch(() => {});
    await mcp.close();
  }
}

async function assertPositiveResult(prepared, session, browserState, applyResult) {
  const stored = await waitFor(async () => {
    const candidate = await sessionRequest(session);
    return candidate.applyRuns?.find((run) => run.id === applyResult.run.id)?.state === 'passed'
      ? candidate
      : undefined;
  }, 'the passed Apply run');
  const run = stored.applyRuns.find((candidate) => candidate.id === applyResult.run.id);
  assert.equal(run.state, 'passed');
  assert.equal(run.revision, applyResult.run.revision);
  assert.equal(run.sourceProofScope, 'git');
  assert.equal(run.sourceHeadRevision, applyResult.run.sourceHeadRevision);
  assert.equal(run.applyResultClaimAttemptId, applyResult.run.claimAttemptId);
  assert.ok(run.applyResultAcknowledgedAt);
  assert.notEqual(run.appliedRevision, run.revision);
  assert.deepEqual(run.changedFiles, ['style.css']);
  assert.deepEqual(run.appliedChangedFiles, ['style.css']);
  assert.equal(run.validationResults.length, 1);
  assert.equal(run.validationResults[0].passed, true);
  assert.equal(run.validationResults[0].applyRunId, run.id);
  assert.equal(run.validationResults[0].claimAttemptId, applyResult.run.claimAttemptId);
  assert.equal(run.validationResults[0].validatedRevision, run.appliedRevision);
  assert.ok(Date.parse(run.validationResults[0].validatedAt) >= Date.parse(run.claimedAt));
  assert.equal(run.verificationResults.length, 1);
  assert.equal(run.verificationResults[0].passed, true);
  assert.equal(run.verificationResults[0].applyRunId, run.id);
  assert.equal(run.verificationResults[0].claimAttemptId, applyResult.run.claimAttemptId);
  assert.equal(run.verificationResults[0].requested, 44);
  assert.equal(run.verificationResults[0].rendered, '44px');
  assert.equal(Math.round(run.verificationResults[0].geometry.height), 44);
  assert.deepEqual(run.appliedSourceFiles, [
    {
      path: 'style.css',
      exists: true,
      sha256: sha256(readFileSync(join(prepared.project, 'style.css'))),
      lineAnchors: [revealSourceLineAnchor(prepared.project)],
    },
  ]);
  assert.ok(
    stored.verifications.some(
      (result) =>
        result.applyRunId === run.id &&
        result.claimAttemptId === applyResult.run.claimAttemptId &&
        result.passed,
    ),
    'The compatibility verification view must retain the authoritative browser evidence.',
  );
  const delivery = stored.deliveryRecords.find((record) => record.applyRunId === run.id);
  assert.equal(delivery.status, 'verified');
  assert.deepEqual(delivery.affectedFiles, ['style.css']);
  assert.equal(delivery.baselineRevision, run.revision);
  assert.equal(delivery.appliedRevision, run.appliedRevision);
  assert.equal(delivery.revision, run.appliedRevision);
  assert.deepEqual(delivery.changeIds, run.changeIds);
  assert.deepEqual(delivery.validationResults, run.validationResults);
  assert.deepEqual(delivery.verificationResults, run.verificationResults);
  const engineering = await assertEngineeringDelivery({
    project: prepared.project,
    runtimeUrl,
    session,
    stored,
    runId: run.id,
  });
  log(
    `Engineering delivery proof passed for ${engineering.reviewedContexts} reviewed context(s), with ${engineering.sourceImagePairs} matched before/rebuilt source image pair(s).`,
  );
  const history = stored.designHistory.find((entry) => entry.applyRunId === run.id);
  assert.ok(history, 'A verified Apply run must create a Design History entry.');
  assert.equal(history.deliveryRecordId, delivery.id);
  assert.equal(history.baselineRevision, run.revision);
  assert.equal(history.appliedRevision, run.appliedRevision);
  assert.equal(history.revision, run.appliedRevision);
  assert.deepEqual(history.affectedFiles, ['style.css']);
  assert.deepEqual(history.changeIds, run.changeIds);
  assert.deepEqual(history.validationResults, run.validationResults);
  assert.deepEqual(history.verificationResults, run.verificationResults);
  const appliedChanges = stored.changeSet.changes.filter(({ status }) => status === 'applied');
  assert.equal(appliedChanges.length, 1);
  assert.equal(appliedChanges[0].id, run.changeIds[0]);
  const diff = command(prepared.project, 'git', ['status', '--porcelain', '--untracked-files=all'])
    .stdout.trimEnd()
    .split('\n');
  assert.deepEqual(diff, [' M style.css']);
  assert.deepEqual(
    command(prepared.project, 'git', ['diff', '--name-only']).stdout.trim().split('\n'),
    ['style.css'],
    'The complete golden path must alter exactly one source file.',
  );
  const sourcePatch = command(prepared.project, 'git', [
    'diff',
    '--unified=0',
    '--',
    'style.css',
  ]).stdout;
  assert.match(
    sourcePatch,
    /-\s*min-height: 40px; \/\* foundry: password-reveal \*\/[\s\S]*\+\s*min-height: 44px; \/\* foundry: password-reveal \*\//,
    'The selected password reveal declaration itself must be the source delta.',
  );
  assert.equal(
    sourcePatch.split('\n').filter((line) => /^[+-](?![+-])/.test(line)).length,
    2,
    'The golden source patch must contain only the reviewed declaration replacement.',
  );
  const target = browserState.product.locator('[data-foundry-id="password-reveal"]');
  const rebuiltBox = await target.boundingBox();
  assert.ok(rebuiltBox, 'The rebuilt password reveal must remain visible.');
  // Playwright's outer bounding box includes the workspace canvas zoom. The
  // source property and verification evidence are measured in preview CSS pixels.
  assert.equal(
    Math.round(await target.evaluate((element) => element.getBoundingClientRect().height)),
    44,
  );
  assert.ok(rebuiltBox.width > 0 && rebuiltBox.height > 0);
  await openWorkspaceMode(browserState.page, 'delivery');
  await browserState.page.getByText('1 total', { exact: true }).waitFor({ timeout: 10_000 });
  await browserState.page.getByText('style.css', { exact: true }).first().waitFor();
  await browserState.page.locator('[data-delivery-tab="history"]').click();
  await browserState.page.getByText(run.id, { exact: true }).waitFor();
}

async function assertVerificationMismatch(prepared, stored, browserState, applyResult) {
  const run = stored.applyRuns.find((candidate) => candidate.id === applyResult.run.id);
  assert.equal(run.state, 'needs_attention');
  assert.equal(run.error, 'One or more rendered values do not match the reviewed batch.');
  assert.equal(run.applyResultClaimAttemptId, applyResult.run.claimAttemptId);
  assert.ok(run.applyResultAcknowledgedAt);
  assert.notEqual(run.appliedRevision, run.revision);
  assert.deepEqual(run.changedFiles, ['style.css']);
  assert.deepEqual(run.appliedChangedFiles, ['style.css']);
  assert.equal(run.validationResults.length, 1);
  assert.equal(run.validationResults[0].passed, true);
  assert.equal(run.verificationResults.length, 1);
  assert.equal(run.verificationResults[0].passed, false);
  assert.equal(run.verificationResults[0].requested, 44);
  assert.equal(run.verificationResults[0].rendered, '42px');
  assert.equal(Math.round(run.verificationResults[0].geometry.height), 42);
  assert.match(run.verificationResults[0].reason, /differs|44|requested/i);
  assert.equal(
    stored.changeSet.changes.some(
      (change) => change.id === run.changeIds[0] && change.status === 'applied',
    ),
    false,
  );
  const delivery = stored.deliveryRecords.find((record) => record.applyRunId === run.id);
  assert.equal(delivery.status, 'ready');
  assert.deepEqual(delivery.affectedFiles, ['style.css']);
  assert.equal(delivery.baselineRevision, run.revision);
  assert.equal(delivery.appliedRevision, run.appliedRevision);
  assert.equal(delivery.revision, run.appliedRevision);
  assert.equal(delivery.verificationResults.length, 1);
  assert.equal(delivery.verificationResults[0].passed, false);
  assert.equal(
    stored.designHistory.some((entry) => entry.applyRunId === run.id),
    false,
    'A mismatched rendered result must never enter Design History.',
  );
  assert.deepEqual(
    command(prepared.project, 'git', ['diff', '--name-only']).stdout.trim().split('\n'),
    ['style.css'],
  );
  const target = browserState.product.locator('[data-foundry-id="password-reveal"]');
  const rebuiltBox = await target.boundingBox();
  assert.ok(rebuiltBox);
  assert.equal(
    Math.round(await target.evaluate((element) => element.getBoundingClientRect().height)),
    42,
  );
}

async function runPositive(tooling, requestedHeight = 44) {
  const name = requestedHeight === 44 ? 'positive' : 'verification-mismatch';
  const prepared = prepareProject(name, tooling);
  const session = await startSession(prepared, tooling);
  let browserState;
  try {
    browserState = await openWorkspace(session);
    await stageTouchTargetCorrection(session, browserState);
    const result = await applyWithRealAgent(
      prepared,
      tooling,
      session,
      browserState,
      requestedHeight,
    );
    const stored = await waitFor(async () => {
      const candidate = await sessionRequest(session);
      const state = candidate.applyRuns?.find((run) => run.id === result.run.id)?.state;
      return ['passed', 'needs_attention'].includes(state) ? candidate : undefined;
    }, 'the final verification state');
    if (requestedHeight === 44) {
      await assertPositiveResult(prepared, session, browserState, result);
    } else {
      await assertVerificationMismatch(prepared, stored, browserState, result);
    }
  } finally {
    await browserState?.browser.close();
    await stopProcess(session.cli, { includeExitedGroup: true });
    await stopProcess(session.fixture, { includeExitedGroup: true });
  }
}

async function runOfflineListener(tooling) {
  const prepared = prepareProject('offline-listener', tooling);
  const session = await startSession(prepared, tooling);
  let browserState;
  try {
    browserState = await openWorkspace(session);
    await stageTouchTargetCorrection(session, browserState);
    const presence = await listenerPresence(session);
    assert.equal(presence.connected, false);
    assert.equal(presence.presence ?? null, null);
    await enterReview(browserState.page);
    await approveReviewedChange(browserState.page);
    const button = browserState.page.locator('#apply-agent');
    await waitFor(
      async () => (await button.textContent())?.includes('Queue 1 for agent'),
      'the truthful offline listener copy',
    );
    assert.doesNotMatch(await button.textContent(), /working|applying|live/i);
    await button.click();
    const queuedApplyButton = browserState.page.getByRole('button', {
      name: 'Queued for agent',
      exact: true,
    });
    await queuedApplyButton.waitFor();
    assert.equal(await queuedApplyButton.isDisabled(), true);
    const stored = await waitFor(async () => {
      const candidate = await sessionRequest(session);
      return candidate.applyRuns?.some((run) => run.state === 'queued') ? candidate : undefined;
    }, 'the durable queued Apply run');
    const run = stored.applyRuns.at(-1);
    assert.equal(run.state, 'queued');
    assert.equal(run.agent, undefined);
    assert.equal(run.claimAttemptId, undefined);
    assert.equal(run.claimedAt, undefined);
    assert.equal(run.applyResultAcknowledgedAt, undefined);
    assert.deepEqual(run.appliedChangedFiles, []);
    assert.deepEqual(run.verificationResults, []);
    assert.equal(
      stored.deliveryRecords.find((record) => record.applyRunId === run.id)?.status,
      'ready',
    );
    assert.equal(
      stored.designHistory.some((entry) => entry.applyRunId === run.id),
      false,
    );
    assert.equal((await listenerPresence(session)).connected, false);
  } finally {
    await browserState?.browser.close();
    await stopProcess(session.cli, { includeExitedGroup: true });
    await stopProcess(session.fixture, { includeExitedGroup: true });
  }
}

async function runDisconnectedPreview(tooling) {
  const prepared = prepareProject('disconnected-preview', tooling);
  const session = await startSession(prepared, tooling);
  let browserState;
  try {
    browserState = await openWorkspace(session, { installPreviewPingBlocker: true });
    await browserState.product
      .locator('[data-foundry-id="password-reveal"]')
      .click({ modifiers: ['Alt'] });
    assert.equal(
      await browserState.page.locator('#live-status').getAttribute('data-status'),
      'live',
    );
    await browserState.product.locator('html').evaluate(() => {
      window.__foundryGoldenDropPreviewPings = true;
    });
    const disconnectedAt = Date.now();
    await browserState.page
      .locator('#live-status:not([data-status="live"])')
      .waitFor({ timeout: 12_000 });
    assert.ok(
      Date.now() - disconnectedAt >= 4_900,
      'The preview must be declared offline by the five-second liveness timeout, not optimistically.',
    );
    assert.equal(
      await browserState.page.locator('#live-status').getAttribute('data-status'),
      'pending',
    );
    assert.match(
      (await browserState.page.locator('#live-status').getAttribute('title')) ?? '',
      /waiting for the embedded preview/i,
    );
    await openWorkspaceMode(browserState.page, 'health');
    const keyboardProfile = browserState.page.locator('[data-stress-condition="keyboard-only"]');
    if ((await keyboardProfile.getAttribute('aria-pressed')) !== 'true')
      await keyboardProfile.click();
    assert.equal(await browserState.page.locator('#apply-stress').isDisabled(), true);
    assert.equal(await browserState.page.locator('#run-health').isDisabled(), true);
    assert.match(
      await browserState.page.locator('.next-stress-draft').textContent(),
      /Reconnect the preview.*Choices are preserved/i,
    );
    assert.equal(
      await browserState.product.locator('html').getAttribute('data-foundry-stress'),
      null,
    );
    const stored = await sessionRequest(session);
    assert.equal(stored.changeSet.changes.length, 0);
    assert.equal(stored.applyRuns.length, 0);
    assert.equal(stored.designHistory.length, 0);
  } finally {
    await browserState?.browser.close();
    await stopProcess(session.cli, { includeExitedGroup: true });
    await stopProcess(session.fixture, { includeExitedGroup: true });
  }
}

export {
  assertBrowserVerification,
  assertPortFree,
  asynchronousCommand,
  command,
  commitSetup,
  configureFixturePorts,
  diagnostics,
  enterReview,
  openWorkspaceMode,
  approveReviewedChange,
  harnessRoot,
  initializeGit,
  installTooling,
  isolatedEnvironment,
  listenerPresence,
  McpClient,
  observeBrowserVerification,
  ownedBrowsers,
  redact,
  runtimeUrl,
  runtimePort,
  previewUrl,
  previewPort,
  retainFailureDiagnostics,
  sessionRequest,
  startProcess,
  stopOwnedResources,
  stopProcess,
  toolingCommand,
  version,
  waitFor,
  waitForHttp,
};

// Shared helpers also power the framework compatibility matrix. Importing the
// helpers must not accidentally execute the Morrow release gate.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let failure;
  try {
    if (
      existsSync(join(root, 'node_modules')) &&
      lstatSync(join(root, 'node_modules')).isSymbolicLink()
    ) {
      log('Using the installed workspace Playwright runtime through its pnpm node_modules link.');
    }
    const tooling = installTooling();
    if (!negative) {
      await runPositive(tooling);
    } else {
      const scenarios =
        negative === 'all'
          ? ['offline-listener', 'disconnected-preview', 'verification-mismatch']
          : [negative];
      for (const scenario of scenarios) {
        log(`Running negative case: ${scenario}.`);
        if (scenario === 'offline-listener') await runOfflineListener(tooling);
        if (scenario === 'disconnected-preview') await runDisconnectedPreview(tooling);
        if (scenario === 'verification-mismatch') await runPositive(tooling, 42);
      }
    }
    log(`Real ${mode} golden path passed${negative ? ` (${negative})` : ''}.`);
  } catch (error) {
    failure = error;
  } finally {
    try {
      await stopOwnedResources();
      await waitForOwnedPortsToClose();
    } catch (cleanupError) {
      diagnostics.push(redact(cleanupError?.stack ?? String(cleanupError)));
      if (!failure) failure = cleanupError;
    }
    if (failure) retainFailureDiagnostics(failure);
    else rmSync(harnessRoot, { recursive: true, force: true });
  }

  if (failure) process.exit(1);
}
