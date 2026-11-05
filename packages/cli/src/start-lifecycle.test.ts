import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import test, { type TestContext } from 'node:test';

const cliEntry =
  process.env.FOUNDRY_CLI_TEST_ENTRY ??
  fileURLToPath(
    new URL(import.meta.url.endsWith('.ts') ? './index.ts' : './index.js', import.meta.url),
  );
const cliUrl = pathToFileURL(cliEntry).href;
const requireFromCli = createRequire(cliEntry);
// The workspace runtime exposes an import-only entry, so CommonJS resolution
// cannot locate it. Both CLI src/ and dist/ use this built workspace dependency.
const runtimeUrl = new URL('../../runtime/dist/index.js', cliUrl).href;
const tsxLoader = pathToFileURL(requireFromCli.resolve('tsx')).href;
const execFileAsync = promisify(execFile);

interface Command {
  child: ChildProcess;
  output(): string;
  errors(): string;
  closed: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

async function eventually(check: () => boolean | Promise<boolean>, label: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out: ${label}`);
}

async function exit(
  command: Command,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      command.closed,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('CLI did not exit within 10 seconds')), 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function alive(command: Command): boolean {
  return command.child.exitCode === null && command.child.signalCode === null;
}

async function healthy(origin: string): Promise<boolean> {
  return fetch(`${origin}/v1/health`, { signal: AbortSignal.timeout(750) })
    .then((response) => response.ok)
    .catch(() => false);
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function unusedOrigin(): Promise<string> {
  const server = createServer();
  const origin = await listen(server);
  await close(server);
  return origin;
}

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'foundry-cli-lifecycle-'));
  const storeRoot = join(root, 'sessions');
  const commands: Command[] = [];
  const servers: Server[] = [];
  const devPidFiles: string[] = [];
  await mkdir(storeRoot);

  // Only storage location is substituted. Runtime, persistence, session selection,
  // proxying, CLI orchestration and child-process ownership remain production code.
  // The loader must be registered before importing the CLI; HOME is never changed.
  const shim = join(root, 'runtime-shim.mjs');
  await writeFile(
    shim,
    `export * from ${JSON.stringify(runtimeUrl)};
import { SessionStore as RealSessionStore } from ${JSON.stringify(runtimeUrl)};
export class SessionStore extends RealSessionStore {
  constructor(_root, options) { super(${JSON.stringify(storeRoot)}, options); }
}
`,
  );
  const loader = join(root, 'storage-loader.mjs');
  await writeFile(
    loader,
    `export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'foundry-design-runtime') {
    return { url: ${JSON.stringify(pathToFileURL(shim).href)}, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
`,
  );
  const register = `data:text/javascript,${encodeURIComponent(
    `import { register } from 'node:module'; register(${JSON.stringify(pathToFileURL(loader).href)}, import.meta.url);`,
  )}`;

  t.after(async () => {
    for (const command of commands.reverse()) {
      if (!alive(command)) continue;
      command.child.kill('SIGTERM');
      await exit(command).catch(async () => {
        command.child.kill('SIGKILL');
        await command.closed;
      });
    }
    // A failed CLI before its shutdown handlers are installed must not orphan
    // a development child created by this fixture.
    for (const pidFile of devPidFiles) {
      const pid = Number(await readFile(pidFile, 'utf8').catch(() => ''));
      if (pid > 0) {
        try {
          process.kill(pid, 'SIGTERM');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
        }
      }
    }
    for (const server of servers) await close(server);
    await rm(root, { recursive: true, force: true });
  });

  async function server(body = '<html><body>Fixture preview</body></html>', json = false) {
    const instance = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': json ? 'application/json' : 'text/html' });
      response.end(body);
    });
    const origin = await listen(instance);
    servers.push(instance);
    return origin;
  }

  async function project(
    name: string,
    runtimeOrigin: string,
    targetOrigin: string,
    options: { basic?: boolean; development?: boolean } = {},
  ) {
    const projectRoot = join(root, name);
    await mkdir(join(projectRoot, '.foundry'), { recursive: true });
    await writeFile(
      join(projectRoot, 'package.json'),
      '{"name":"lifecycle-fixture","private":true}',
    );
    await writeFile(
      join(projectRoot, 'index.html'),
      '<button id="fixture" style="font-size:12px">Fixture</button>',
    );
    let devCommand: { command: string; args: string[] } | undefined;
    if (options.development) {
      const pidFile = join(root, `${name}.pid`);
      const script = join(root, `${name}-server.mjs`);
      devPidFiles.push(pidFile);
      await writeFile(
        script,
        `import { createServer } from 'node:http';
import { writeFileSync, rmSync } from 'node:fs';
writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
const server = createServer((_request, response) => response.end('Owned development preview'));
server.listen(${new URL(targetOrigin).port}, '127.0.0.1');
process.on('SIGTERM', () => {
  rmSync(${JSON.stringify(pidFile)}, { force: true });
  server.closeAllConnections();
  server.close(() => process.exit(0));
});
`,
      );
      devCommand = { command: process.execPath, args: [script] };
    }
    await writeFile(
      join(projectRoot, '.foundry', 'foundry.config.json'),
      JSON.stringify({
        version: 2,
        platform: 'web',
        runtimeUrl: runtimeOrigin,
        targetUrl: targetOrigin,
        instrumented: !options.basic,
        devCommand,
      }),
    );
    await execFileAsync('git', ['init', '-q'], { cwd: projectRoot });
    await execFileAsync('git', ['add', '.'], { cwd: projectRoot });
    await execFileAsync(
      'git',
      [
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'user.name=Foundry Test',
        '-c',
        'user.email=foundry-test@example.invalid',
        'commit',
        '-qm',
        'Fixture',
      ],
      { cwd: projectRoot },
    );
    return projectRoot;
  }

  function start(projectRoot: string, development = false): Command {
    const child = spawn(
      process.execPath,
      [
        ...(cliEntry.endsWith('.ts') ? ['--import', tsxLoader] : []),
        '--import',
        register,
        cliEntry,
        'start',
        '--project',
        projectRoot,
        '--no-open',
        ...(development ? [] : ['--no-dev']),
      ],
      {
        cwd: projectRoot,
        env: { ...process.env, INIT_CWD: projectRoot },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let output = '';
    let errors = '';
    child.stdout!.setEncoding('utf8').on('data', (chunk: string) => {
      output += chunk;
    });
    child.stderr!.setEncoding('utf8').on('data', (chunk: string) => {
      errors += chunk;
    });
    child.on('error', (error) => {
      errors += error.message;
    });
    const command: Command = {
      child,
      output: () => output,
      errors: () => errors,
      closed: new Promise((resolve) =>
        child.once('close', (code, signal) => resolve({ code, signal })),
      ),
    };
    commands.push(command);
    return command;
  }

  async function workspace(command: Command): Promise<URL> {
    await eventually(() => {
      if (/Workspace: (.+)/.test(command.output())) return true;
      assert.ok(alive(command), 'CLI exited before reporting a workspace');
      return false;
    }, 'CLI workspace');
    return new URL(command.output().match(/Workspace: (.+)/)![1]!);
  }

  async function session(workspaceUrl: URL) {
    const id = workspaceUrl.searchParams.get('session');
    assert.match(id ?? '', /^ses_[a-f0-9]+$/);
    return JSON.parse(await readFile(join(storeRoot, `${id}.json`), 'utf8'));
  }

  return { root, storeRoot, server, project, start, workspace, session };
}

function ledger(session: Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>['session']>>) {
  const { updatedAt: _updatedAt, ...changeSet } = session.changeSet;
  const {
    token: _token,
    previewCapabilityHash: _capability,
    changeSet: _changeSet,
    ...records
  } = session;
  return { changeSet, records };
}

test(
  'reattaching exits cleanly, preserves the session, and leaves the owning runtime alive',
  { timeout: 45_000 },
  async (t) => {
    const f = await fixture(t);
    const origin = await unusedOrigin();
    const project = await f.project('precision', origin, await f.server());
    const owner = f.start(project);
    const initialWorkspace = await f.workspace(owner);
    assert.ok(await healthy(origin));
    const { SessionStore } = await import(runtimeUrl);
    const store = new SessionStore(f.storeRoot);
    await store.addChange(initialWorkspace.searchParams.get('session'), {
      target: {
        id: 'fixture-button',
        platform: 'web',
        label: 'Fixture button',
        source: { file: 'index.html', line: 1 },
        geometry: { x: 0, y: 0, width: 80, height: 30, scale: 1 },
        locator: { selector: '#fixture' },
        confidence: 'instrumented',
      },
      category: 'typography',
      property: 'fontSize',
      before: 12,
      after: 14,
      context: { breakpoint: 'current', theme: 'current', state: 'current' },
      confidence: 'instrumented',
    });
    const before = ledger(await f.session(initialWorkspace));
    const attachment = f.start(project);
    const attachedWorkspace = await f.workspace(attachment);
    assert.deepEqual(await exit(attachment), { code: 0, signal: null });
    assert.doesNotMatch(attachment.errors(), /unsettled top-level await/i);
    assert.match(attachment.output(), /Using the existing local Foundry runtime/);
    assert.match(attachment.output(), /Keep the existing runtime process running/);
    assert.doesNotMatch(attachment.output(), /Keep this process running/);
    assert.equal(
      attachedWorkspace.searchParams.get('session'),
      initialWorkspace.searchParams.get('session'),
    );
    assert.deepEqual(ledger(await f.session(attachedWorkspace)), before);
    assert.ok(alive(owner));
    assert.ok(await healthy(origin));
    owner.child.kill('SIGTERM');
    assert.deepEqual(await exit(owner), { code: 0, signal: null });
    assert.equal(await healthy(origin), false);
  },
);

test(
  'a reused runtime attachment keeps its own basic proxy alive and stops only that proxy',
  { timeout: 45_000 },
  async (t) => {
    const f = await fixture(t);
    const origin = await unusedOrigin();
    const preview = await f.server();
    const owner = f.start(await f.project('owner', origin, preview));
    await f.workspace(owner);
    const attachment = f.start(await f.project('basic', origin, preview, { basic: true }));
    const workspace = await f.workspace(attachment);
    const proxy = new URL(workspace.searchParams.get('preview')!);
    assert.notEqual(proxy.origin, preview);
    assert.match(await fetch(proxy).then((response) => response.text()), /adapter-bootstrap\.js/);
    assert.ok(alive(attachment));
    assert.match(attachment.output(), /Keep this process running/);
    attachment.child.kill('SIGTERM');
    assert.deepEqual(await exit(attachment), { code: 0, signal: null });
    assert.equal(await healthy(proxy.origin), false);
    assert.ok(alive(owner));
    assert.ok(await healthy(origin));
  },
);

test(
  'a reused runtime attachment keeps its own development server alive and stops only that child',
  { timeout: 45_000 },
  async (t) => {
    const f = await fixture(t);
    const origin = await unusedOrigin();
    const owner = f.start(await f.project('owner', origin, await f.server()));
    await f.workspace(owner);
    const preview = await unusedOrigin();
    const attachment = f.start(
      await f.project('development', origin, preview, { development: true }),
      true,
    );
    await f.workspace(attachment);
    assert.match(attachment.output(), /Starting development server:/);
    assert.match(attachment.output(), /Keep this process running/);
    assert.ok(alive(attachment));
    assert.equal(
      await fetch(preview).then((response) => response.text()),
      'Owned development preview',
    );
    attachment.child.kill('SIGTERM');
    assert.deepEqual(await exit(attachment), { code: 0, signal: null });
    await eventually(async () => !(await healthy(preview)), 'owned development server shutdown');
    assert.ok(alive(owner));
    assert.ok(await healthy(origin));
  },
);

test(
  'an incompatible occupied runtime still fails instead of claiming successful attachment',
  { timeout: 30_000 },
  async (t) => {
    const f = await fixture(t);
    const origin = await f.server('{"version":"incompatible-test-version"}', true);
    const command = f.start(await f.project('incompatible', origin, await f.server()));
    assert.deepEqual(await exit(command), { code: 1, signal: null });
    assert.match(command.errors(), /occupied by another process or Foundry release/);
    assert.doesNotMatch(command.output(), /Workspace:|Using the existing local Foundry runtime/);
    assert.ok(await healthy(origin));
  },
);
