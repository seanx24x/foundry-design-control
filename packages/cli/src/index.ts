#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderChangePrompt, type Platform, type SessionContext } from '@foundry-design/protocol';
import { FoundryRuntime, SessionStore } from '@foundry-design/runtime';
import { addSessionParams, detectPlatform } from './project.js';

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
  foundry-design init <web|swiftui|react-native> [--project PATH]
  foundry-design start [--project PATH] [--url URL] [--platform PLATFORM] [--no-open]
  foundry-design doctor [--project PATH]
  foundry-design export <SESSION_ID> [--format json|prompt] [--output FILE]
  foundry-design install-agent <cursor|claude|codex> [--project PATH]

Foundry is local-only and never edits product source from inspector controls.`);
}

async function revision(root: string): Promise<string | undefined> {
  return new Promise((resolveRevision) => {
    const child = spawn('git', ['rev-parse', 'HEAD'], {
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

async function openUrl(url: string): Promise<void> {
  const executable =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const childArgs = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(executable, childArgs, { detached: true, stdio: 'ignore' });
  child.unref();
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
    `${JSON.stringify({ platform, runtimeUrl: 'http://127.0.0.1:4387', instrumented: true }, null, 2)}\n`,
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
  const platform = (flag('--platform') as Platform | undefined) ?? (await detectPlatform(root));
  const targetUrl = flag('--url');
  const context: SessionContext = {
    projectRoot: root,
    revision: await revision(root),
    platform,
    targetUrl,
    targetName: basename(root),
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  };
  const store = new SessionStore();
  const session = await store.create(context);
  const runtime = new FoundryRuntime({ store });
  try {
    await runtime.start();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
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
  if (!has('--no-open')) await openUrl(productUrl);
  const shutdown = async () => {
    await runtime.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
  await new Promise(() => {});
}

async function doctor(): Promise<void> {
  const root = projectRoot();
  const platform = await detectPlatform(root);
  const checks = [
    ['Project', root, true],
    ['Detected platform', platform, true],
    [
      'Foundry config',
      join(root, '.foundry', 'foundry.config.json'),
      await readFile(join(root, '.foundry', 'foundry.config.json'), 'utf8')
        .then(() => true)
        .catch(() => false),
    ],
    [
      'Runtime health',
      'http://127.0.0.1:4387/v1/health',
      await fetch('http://127.0.0.1:4387/v1/health')
        .then((response) => response.ok)
        .catch(() => false),
    ],
  ] as const;
  for (const [label, value, passed] of checks)
    console.log(`${passed ? '✓' : '○'} ${label}: ${value}`);
  if (!checks[2][2]) console.log(`Run: foundry-design init ${platform}`);
}

async function exportSession(): Promise<void> {
  const id = args[1];
  if (!id) throw new Error('export requires a session id');
  const format = flag('--format') ?? 'json';
  const session = await new SessionStore().read(id);
  const content =
    format === 'prompt'
      ? renderChangePrompt(session.changeSet)
      : JSON.stringify(session.changeSet, null, 2);
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
    args: ['--dir', runtimeRepository, '--filter', '@foundry-design/mcp-server', 'start'],
    env: { FOUNDRY_DESIGN_RUNTIME_URL: 'http://127.0.0.1:4387' },
  };
  if (agent === 'codex') {
    const directory = join(root, '.codex');
    await mkdir(directory, { recursive: true });
    const file = join(directory, 'foundry-mcp.toml');
    await writeFile(
      file,
      `# Merge this project-scoped server into your Codex MCP configuration.\n[mcp_servers.foundry-design-control]\ncommand = "pnpm"\nargs = ["--dir", "${runtimeRepository}", "--filter", "@foundry-design/mcp-server", "start"]\n[mcp_servers.foundry-design-control.env]\nFOUNDRY_DESIGN_RUNTIME_URL = "http://127.0.0.1:4387"\n`,
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
  if (command === 'init') await initProject();
  else if (command === 'start') await start();
  else if (command === 'doctor') await doctor();
  else if (command === 'export') await exportSession();
  else if (command === 'install-agent') await installAgent();
  else printHelp();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
