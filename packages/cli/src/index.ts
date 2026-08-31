#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { renderChangePrompt, type Platform, type SessionContext } from 'foundry-design-protocol';
import { FoundryRuntime, SessionStore } from 'foundry-design-runtime';
import {
  createSetupPlan,
  setupProject,
  uninstallProject,
  type Agent,
  type FoundryProjectConfig,
} from './installer.js';
import { addSessionParams, detectPlatform } from './project.js';
import { indexProjectDesign } from './indexer.js';

const args = process.argv.slice(2);
const command = args[0] ?? 'help';
const runtimeRepository = resolve(fileURLToPath(new URL('../../../', import.meta.url)));

function flag(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function has(name: string): boolean {
  return args.includes(name);
}

function projectRoot(): string {
  return resolve(process.env.INIT_CWD ?? process.cwd(), flag('--project') ?? '.');
}

function printHelp(): void {
  console.log(`Foundry Design Control

Usage:
  foundry-design setup [--project PATH] [--agent codex,cursor,claude] [--url URL] [--yes]
  foundry-design init <web|swiftui|react-native> [--project PATH]
  foundry-design start [--project PATH] [--url URL] [--platform PLATFORM] [--no-open] [--no-dev]
  foundry-design doctor [--project PATH]
  foundry-design index [--project PATH] [--output FILE]
  foundry-design uninstall [--project PATH] [--yes]
  foundry-design export <SESSION_ID> [--format json|prompt|full] [--output FILE]
  foundry-design install-agent <cursor|claude|codex> [--project PATH]

Foundry is local-only and never edits product source from inspector controls.`);
}

async function gitOutput(root: string, gitArgs: string[]): Promise<string | undefined> {
  return new Promise((resolveRevision) => {
    const child = spawn('git', gitArgs, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += String(chunk);
    });
    child.on('close', (code) => resolveRevision(code === 0 ? output.trim() : undefined));
    child.on('error', () => resolveRevision(undefined));
  });
}

async function revision(root: string): Promise<string | undefined> {
  const head = await gitOutput(root, ['rev-parse', 'HEAD']);
  if (!head) return undefined;
  const diff = (await gitOutput(root, ['diff', '--no-ext-diff', '--binary', 'HEAD'])) ?? '';
  const untracked =
    (await gitOutput(root, ['ls-files', '--others', '--exclude-standard']))
      ?.split('\n')
      .filter(Boolean)
      .sort() ?? [];
  if (!diff && !untracked.length) return head;
  const hash = createHash('sha256').update(diff);
  for (const file of untracked) {
    hash.update(file);
    hash.update(await readFile(join(root, file)).catch(() => Buffer.from('unreadable')));
  }
  return `${head}-dirty-${hash.digest('hex').slice(0, 12)}`;
}

async function openUrl(url: string): Promise<void> {
  const executable =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const childArgs = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(executable, childArgs, { detached: true, stdio: 'ignore' });
  child.unref();
}

async function urlAvailable(url: string): Promise<boolean> {
  return fetch(url)
    .then(() => true)
    .catch(() => false);
}

async function confirm(message: string): Promise<boolean> {
  if (has('--yes') || !process.stdin.isTTY) return true;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await prompt.question(`${message} (Y/n) `)).trim().toLowerCase();
    return answer === '' || answer === 'y' || answer === 'yes';
  } finally {
    prompt.close();
  }
}

function requestedAgents(): Agent[] | undefined {
  const value = flag('--agent');
  if (!value) return undefined;
  if (value === 'none') return [];
  const agents = value.split(',').filter(Boolean) as Agent[];
  const invalid = agents.filter((agent) => !['codex', 'cursor', 'claude'].includes(agent));
  if (invalid.length) throw new Error(`Unsupported agent: ${invalid.join(', ')}`);
  return [...new Set(agents)];
}

async function setup(): Promise<void> {
  const root = projectRoot();
  const options = {
    agents: requestedAgents(),
    targetUrl: flag('--url'),
    packageRoot: has('--local-mcp') ? runtimeRepository : undefined,
  };
  const plan = await createSetupPlan(root, options);
  console.log(`Foundry setup\n\nProject: ${root}\nPlatform: ${plan.platform}`);
  if (plan.framework) console.log(`Framework: ${plan.framework}`);
  console.log(
    `Agent integration: ${plan.agents.length ? plan.agents.join(', ') : 'plugin-provided'}`,
  );
  console.log('\nFiles Foundry will manage:');
  for (const path of plan.files) console.log(`  ${path}`);
  if (!plan.integrationFile && plan.platform === 'web') {
    console.log(
      '\nNo supported web entry was found. Foundry will create its adapter but leave integration pending.',
    );
  }
  if (!(await confirm('\nContinue with this setup?'))) {
    console.log('Setup cancelled.');
    return;
  }
  const result = await setupProject(root, options);
  console.log(`\n✓ Foundry configured ${result.changed.length} files.`);
  if (result.targetUrl) console.log(`✓ Preview URL: ${result.targetUrl}`);
  if (result.devCommand)
    console.log(
      `✓ Development command: ${result.devCommand.command} ${result.devCommand.args.join(' ')}`,
    );
  console.log('\nNext: foundry-design start');
}

async function initProject(): Promise<void> {
  const platform = (args[1] ?? 'web') as Platform;
  if (!['web', 'swiftui', 'react-native'].includes(platform))
    throw new Error(`Unsupported platform: ${platform}`);
  const root = projectRoot();
  const configRoot = join(root, '.foundry');
  await mkdir(configRoot, { recursive: true });
  await writeFile(
    join(configRoot, 'foundry.config.json'),
    `${JSON.stringify(
      {
        version: 2,
        platform,
        runtimeUrl: 'http://127.0.0.1:4387',
        instrumented: true,
        design: {
          componentRoots: ['src', 'app', 'components'],
          exclude: ['node_modules', 'dist', 'build', '.next', 'coverage'],
          viewports: [
            { id: 'mobile', label: 'Mobile', width: 390, height: 844 },
            { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
            { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
          ],
        },
      },
      null,
      2,
    )}\n`,
  );
  if (platform === 'web') {
    await writeFile(
      join(configRoot, 'web-adapter.ts'),
      `/** Load only in a development browser entry. */\nexport async function installFoundryDesignControl(): Promise<void> {\n  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') return;\n  const query = new URLSearchParams(window.location.search);\n  if (!query.has('__foundry_session')) return;\n  const module = await import(/* @vite-ignore */ 'http://127.0.0.1:4387/adapter.js');\n  module.installFoundryInspector();\n}\n`,
    );
  } else {
    await writeFile(
      join(configRoot, `${platform}-setup.md`),
      platform === 'swiftui'
        ? '# SwiftUI setup\n\nAdd the local `packages/swiftui-adapter` package in DEBUG builds. Apply `.foundryInspectable(id:label:controls:)` to meaningful view boundaries.\n'
        : '# React Native setup\n\nImport `createFoundryNativeAdapter` from the local React Native adapter in development builds and register meaningful view measurements.\n',
    );
  }
  const gitignore = join(root, '.gitignore');
  let ignores = '';
  try {
    ignores = await readFile(gitignore, 'utf8');
  } catch {
    /* Create it below. */
  }
  if (!ignores.includes('.foundry/sessions/'))
    await appendFile(
      gitignore,
      `${ignores.endsWith('\n') || !ignores ? '' : '\n'}.foundry/sessions/\n`,
    );
  console.log(`Initialized ${platform} instrumentation at ${configRoot}`);
  if (platform === 'web')
    console.log(
      'Import and call .foundry/web-adapter.ts once from your development-only client entry.',
    );
}

async function start(): Promise<void> {
  const root = projectRoot();
  let config: FoundryProjectConfig | undefined;
  try {
    config = JSON.parse(
      await readFile(join(root, '.foundry', 'foundry.config.json'), 'utf8'),
    ) as FoundryProjectConfig;
  } catch {
    /* The explicit flags remain available for unconfigured projects. */
  }
  const platform =
    (flag('--platform') as Platform | undefined) ??
    config?.platform ??
    (await detectPlatform(root));
  const targetUrl = flag('--url') ?? config?.targetUrl;
  if (platform === 'web' && config && !config.instrumented) {
    throw new Error(
      'Foundry setup is incomplete. Connect .foundry/web-adapter.ts to a development-only client entry, then set instrumented to true.',
    );
  }
  let developmentServer: ReturnType<typeof spawn> | undefined;
  if (
    platform === 'web' &&
    targetUrl &&
    config?.devCommand &&
    !has('--no-dev') &&
    !(await urlAvailable(targetUrl))
  ) {
    console.log(
      `Starting development server: ${config.devCommand.command} ${config.devCommand.args.join(' ')}`,
    );
    developmentServer = spawn(config.devCommand.command, config.devCommand.args, {
      cwd: root,
      stdio: 'inherit',
    });
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      if (await urlAvailable(targetUrl)) break;
      if (developmentServer.exitCode != null)
        throw new Error(`Development server exited with code ${developmentServer.exitCode}`);
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
    if (!(await urlAvailable(targetUrl))) {
      developmentServer.kill('SIGTERM');
      throw new Error(`Development server did not become ready at ${targetUrl}`);
    }
  }
  const projectRevision = await revision(root);
  const context: SessionContext = {
    projectRoot: root,
    revision: projectRevision,
    platform,
    targetUrl,
    targetName: basename(root),
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  };
  const store = new SessionStore();
  const session = await store.create(context);
  if (platform === 'web') {
    const graph = await indexProjectDesign(root, config, projectRevision);
    await store.setDesignGraph(session.changeSet.sessionId, graph);
    console.log(
      `Indexed ${graph.tokens.length} tokens, ${graph.components.length} components, and ${graph.breakpoints.length} viewports.`,
    );
  }
  const runtime = new FoundryRuntime({ store });
  try {
    await runtime.start();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
    developmentServer?.kill('SIGTERM');
    console.error(
      'Port 4387 is already in use. Stop the existing Foundry runtime before starting another session.',
    );
    process.exitCode = 1;
    return;
  }
  const reviewUrl = `http://127.0.0.1:4387/?session=${encodeURIComponent(session.changeSet.sessionId)}&token=${encodeURIComponent(session.token)}`;
  const productUrl =
    targetUrl && platform === 'web'
      ? addSessionParams(targetUrl, session.changeSet.sessionId, session.token)
      : reviewUrl;
  console.log(`Foundry session ${session.changeSet.sessionId}`);
  console.log(`Platform: ${platform}`);
  console.log(`Inspector: ${reviewUrl}`);
  if (targetUrl && platform === 'web') console.log(`Instrumented preview: ${productUrl}`);
  if (platform === 'web') {
    console.log('\nFirst edit:');
    console.log('  1. Option-click an element. Shift-click to add more.');
    console.log('  2. Drag a blue handle or use the inspector for exact values.');
    console.log('  3. Review the semantic mapping, then Apply with agent.');
  }
  if (!has('--no-open')) await openUrl(productUrl);
  const shutdown = async () => {
    await runtime.stop();
    developmentServer?.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
  await new Promise(() => {});
}

async function indexDesign(): Promise<void> {
  const root = projectRoot();
  const config = await readFile(join(root, '.foundry', 'foundry.config.json'), 'utf8')
    .then((content) => JSON.parse(content) as FoundryProjectConfig)
    .catch(() => undefined);
  const graph = await indexProjectDesign(root, config, await revision(root));
  const content = `${JSON.stringify(graph, null, 2)}\n`;
  const output = flag('--output');
  if (output) {
    await writeFile(resolve(output), content);
    console.log(`Wrote Foundry design graph to ${resolve(output)}`);
  } else console.log(content);
}

async function uninstall(): Promise<void> {
  const root = projectRoot();
  if (!(await confirm(`Remove Foundry-managed project integration from ${root}?`))) {
    console.log('Uninstall cancelled.');
    return;
  }
  const result = await uninstallProject(root);
  console.log(`Removed Foundry integration from ${root}.`);
  if (result.preserved.length) {
    console.log('Preserved files with user changes:');
    for (const path of result.preserved) console.log(`  ${path}`);
  }
}

async function doctor(): Promise<void> {
  const root = projectRoot();
  const platform = await detectPlatform(root);
  const configPath = join(root, '.foundry', 'foundry.config.json');
  let config: FoundryProjectConfig | undefined;
  try {
    config = JSON.parse(await readFile(configPath, 'utf8')) as FoundryProjectConfig;
  } catch {
    /* Report setup as missing below. */
  }
  const agentFiles = [
    join(root, '.codex', 'config.toml'),
    join(root, '.cursor', 'mcp.json'),
    join(root, '.mcp.json'),
  ];
  const configuredAgents = [];
  for (const path of agentFiles) {
    if ((await readFile(path, 'utf8').catch(() => '')).includes('foundry-design-control'))
      configuredAgents.push(path);
  }
  const pluginProvided = await readFile(join(root, '.foundry', 'install-manifest.json'), 'utf8')
    .then((content) => {
      const manifest = JSON.parse(content) as { agents?: string[] };
      return Array.isArray(manifest.agents) && manifest.agents.length === 0;
    })
    .catch(() => false);
  const checks: Array<readonly [string, string, boolean]> = [
    ['Project', root, true],
    ['Detected platform', platform, true],
    ['Foundry config', configPath, Boolean(config)],
    [
      'Instrumentation',
      config?.instrumented ? `${config.framework ?? config.platform}` : 'integration pending',
      Boolean(config?.instrumented),
    ],
    [
      'Agent connection',
      configuredAgents.length
        ? configuredAgents.join(', ')
        : pluginProvided
          ? 'plugin-provided'
          : 'not configured',
      configuredAgents.length > 0 || pluginProvided,
    ],
    [
      'Project preview',
      config?.targetUrl ?? 'not configured',
      config?.targetUrl ? await urlAvailable(config.targetUrl) : platform !== 'web',
    ],
    [
      'Runtime health',
      'http://127.0.0.1:4387/v1/health',
      await fetch('http://127.0.0.1:4387/v1/health')
        .then((response) => response.ok)
        .catch(() => false),
    ],
  ];
  for (const [label, value, passed] of checks)
    console.log(`${passed ? '✓' : '○'} ${label}: ${value}`);
  if (!config) console.log('Run: foundry-design setup');
}

async function exportSession(): Promise<void> {
  const id = args[1];
  if (!id) throw new Error('export requires a session id');
  const format = flag('--format') ?? 'json';
  const session = await new SessionStore().read(id);
  const content =
    format === 'prompt'
      ? renderChangePrompt(session.changeSet)
      : JSON.stringify(
          format === 'full'
            ? {
                changeSet: session.changeSet,
                verifications: session.verifications,
                applyRuns: session.applyRuns,
                designGraph: session.designGraph,
              }
            : session.changeSet,
          null,
          2,
        );
  const output = flag('--output');
  if (output) {
    await writeFile(resolve(output), `${content}\n`);
    console.log(`Exported ${format} to ${resolve(output)}`);
  } else console.log(content);
}

async function installAgent(): Promise<void> {
  const agent = args[1];
  if (!agent || !['cursor', 'claude', 'codex'].includes(agent))
    throw new Error('install-agent requires cursor, claude, or codex');
  const root = projectRoot();
  const server = {
    command: 'pnpm',
    args: ['--dir', runtimeRepository, '--filter', 'foundry-design-mcp-server', 'start'],
    env: { FOUNDRY_DESIGN_RUNTIME_URL: 'http://127.0.0.1:4387' },
  };
  if (agent === 'codex') {
    const directory = join(root, '.codex');
    await mkdir(directory, { recursive: true });
    const file = join(directory, 'foundry-mcp.toml');
    await writeFile(
      file,
      `# Merge this project-scoped server into your Codex MCP configuration.\n[mcp_servers.foundry-design-control]\ncommand = "pnpm"\nargs = ["--dir", "${runtimeRepository}", "--filter", "foundry-design-mcp-server", "start"]\n[mcp_servers.foundry-design-control.env]\nFOUNDRY_DESIGN_RUNTIME_URL = "http://127.0.0.1:4387"\n`,
    );
    console.log(`Wrote Codex MCP snippet: ${file}`);
    return;
  }
  const file = agent === 'cursor' ? join(root, '.cursor', 'mcp.json') : join(root, '.mcp.json');
  await mkdir(dirname(file), { recursive: true });
  let current: { mcpServers?: Record<string, unknown> } = {};
  try {
    current = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    /* Create a new project config. */
  }
  current.mcpServers = { ...current.mcpServers, 'foundry-design-control': server };
  await writeFile(file, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Installed Foundry MCP configuration for ${agent}: ${file}`);
}

try {
  if (command === 'setup') await setup();
  else if (command === 'init') await initProject();
  else if (command === 'start') await start();
  else if (command === 'doctor') await doctor();
  else if (command === 'index') await indexDesign();
  else if (command === 'uninstall') await uninstall();
  else if (command === 'export') await exportSession();
  else if (command === 'install-agent') await installAgent();
  else printHelp();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
