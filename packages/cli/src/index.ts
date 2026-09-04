#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { renderChangePrompt, type Platform, type SessionContext } from 'foundry-design-protocol';
import { FoundryRuntime, SessionStore } from 'foundry-design-runtime';
import {
  createSetupPlan,
  createUpdatePlan,
  installHostAgentIntegration,
  installAgentIntegration,
  setupProject,
  updateProject,
  uninstallProject,
  type Agent,
  type FoundryProjectConfig,
} from './installer.js';
import { addSessionParams, detectPlatform } from './project.js';
import { indexProjectDesign } from './indexer.js';
import { startBasicPreviewProxy, type BasicPreviewProxy } from './proxy.js';
import { FOUNDRY_VERSION, releasePreflight } from './release.js';
import { collectDoctorReport } from './doctor.js';

const args = process.argv.slice(2);
const command = args[0]?.startsWith('-') ? 'launch' : (args[0] ?? 'launch');
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
  foundry-design [--project PATH] [--url URL] [--yes] [--no-start]
  foundry-design setup [--project PATH] [--agent codex,cursor,claude] [--global] [--url URL] [--yes]
  foundry-design update [--project PATH] [--agent codex,cursor,claude] [--yes]
  foundry-design init <web|swiftui|react-native> [--project PATH]
  foundry-design start [--project PATH] [--url URL] [--platform PLATFORM] [--new] [--no-open] [--no-dev]
  foundry-design doctor [--project PATH] [--repair] [--json]
  foundry-design status [--project PATH] [--json]
  foundry-design index [--project PATH] [--output FILE]
  foundry-design uninstall [--project PATH] [--yes]
  foundry-design export <SESSION_ID> [--format json|prompt|full] [--output FILE]
  foundry-design install-agent <cursor|claude|codex> [--global | --project PATH]

Foundry is local-only and never edits product source from inspector controls.`);
}

async function pathExists(path: string): Promise<boolean> {
  return access(path)
    .then(() => true)
    .catch(() => false);
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
  console.log(`${releasePreflight('set up this project')}\n`);
  const root = projectRoot();
  const requested = requestedAgents();
  const sharedAgentSetup = has('--global');
  const detectedPlan = sharedAgentSetup
    ? await createSetupPlan(root, { agents: requested })
    : undefined;
  const options = {
    agents: sharedAgentSetup ? [] : requested,
    targetUrl: flag('--url'),
    packageRoot: has('--local-mcp') ? runtimeRepository : undefined,
  };
  const plan = await createSetupPlan(root, options);
  console.log(`Foundry setup\n\nProject: ${root}\nPlatform: ${plan.platform}`);
  if (plan.framework) console.log(`Framework: ${plan.framework}`);
  console.log(
    `Agent integration: ${
      sharedAgentSetup
        ? `${detectedPlan?.agents.join(', ')} (shared across projects)`
        : plan.agents.length
          ? plan.agents.join(', ')
          : 'plugin-provided'
    }`,
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
  if (sharedAgentSetup) {
    for (const agent of detectedPlan?.agents ?? []) {
      await installHostAgentIntegration(homedir(), agent, {
        packageRoot: options.packageRoot,
      });
    }
  }
  console.log(`\n✓ Foundry configured ${result.changed.length} files.`);
  for (const check of result.validation) {
    const marker = check.status === 'passed' ? '✓' : check.status === 'skipped' ? '–' : '!';
    console.log(`${marker} ${check.name}: ${check.status.replaceAll('-', ' ')}`);
  }
  if (result.skillDirectories.length) {
    console.log(`✓ Installed the Foundry skill for ${result.agents.join(', ')}.`);
  }
  if (sharedAgentSetup && detectedPlan?.agents.length) {
    console.log(`✓ Installed the shared Foundry connection for ${detectedPlan.agents.join(', ')}.`);
  }
  if (result.targetUrl) console.log(`✓ Preview URL: ${result.targetUrl}`);
  if (result.devCommand)
    console.log(
      `✓ Development command: ${result.devCommand.command} ${result.devCommand.args.join(' ')}`,
    );
  console.log('\nSetup complete. One coding-agent restart is required so it can load Foundry.');
  console.log(
    `1. Restart ${
      sharedAgentSetup && detectedPlan?.agents.length
        ? detectedPlan.agents.join(', ')
        : result.agents.length
          ? result.agents.join(', ')
          : 'your coding agent'
    }.`,
  );
  console.log('2. Reopen this exact project folder.');
  console.log(
    '3. Ask: "Start Foundry for this project and keep listening for Apply with agent requests."',
  );
  console.log('\nAfter that, the browser will confirm when the agent is ready.');
}

async function update(): Promise<void> {
  console.log(`${releasePreflight('update this project')}\n`);
  const root = projectRoot();
  const options = {
    agents: requestedAgents(),
    packageRoot: has('--local-mcp') ? runtimeRepository : undefined,
  };
  const plan = await createUpdatePlan(root, options);
  console.log(`Foundry update\n\nProject: ${root}`);
  console.log(`Agent integration: ${plan.agents.join(', ')}`);
  console.log('\nFoundry will refresh these managed paths:');
  for (const path of plan.files) console.log(`  ${path}`);
  console.log('\nFiles changed since Foundry installed them will be preserved.');
  if (!(await confirm('\nContinue with this update?'))) {
    console.log('Update cancelled.');
    return;
  }
  const result = await updateProject(root, options);
  console.log(`\n✓ Foundry refreshed ${result.changed.length} managed paths.`);
  if (result.preserved.length) {
    console.log('Preserved files containing user changes:');
    for (const path of result.preserved) console.log(`  ${path}`);
  }
  for (const check of result.validation) {
    const marker = check.status === 'passed' ? '✓' : check.status === 'skipped' ? '–' : '!';
    console.log(`${marker} ${check.name}: ${check.status.replaceAll('-', ' ')}`);
  }
  console.log(
    '\nRestart your coding agent so it loads the refreshed Foundry connection and skill.',
  );
}

async function initProject(): Promise<void> {
  console.log(`${releasePreflight('initialize this project')}\n`);
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
  let basicPreview: BasicPreviewProxy | undefined;
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
  const configuredViewports = config?.design?.viewports ?? [];
  const initialViewport = configuredViewports.find(
    (viewport) =>
      viewport.id.toLowerCase() === 'desktop' || viewport.label.toLowerCase() === 'desktop',
  ) ??
    [...configuredViewports].sort((left, right) => right.width - left.width)[0] ?? {
      width: 1440,
      height: 900,
    };
  const context: SessionContext = {
    projectRoot: root,
    revision: projectRevision,
    platform,
    targetUrl,
    targetName: basename(root),
    viewport: { width: initialViewport.width, height: initialViewport.height ?? 900 },
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  };
  const store = new SessionStore();
  const resumable = has('--new')
    ? undefined
    : (await store.list()).find(
        (candidate) =>
          candidate.changeSet.context.projectRoot === root &&
          candidate.changeSet.context.revision === projectRevision &&
          candidate.changeSet.context.targetUrl === targetUrl,
      );
  const session = resumable
    ? await store.read(resumable.changeSet.sessionId)
    : await store.create(context);
  if (platform === 'web') {
    const graph = await indexProjectDesign(root, config, projectRevision);
    await store.setDesignGraph(session.changeSet.sessionId, graph);
    console.log(
      `Indexed ${graph.tokens.length} tokens, ${graph.components.length} components, and ${graph.breakpoints.length} viewports.`,
    );
  }
  const runtime = new FoundryRuntime({ store });
  let ownsRuntime = false;
  try {
    await runtime.start();
    ownsRuntime = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
    const healthy = await fetch('http://127.0.0.1:4387/v1/health')
      .then((response) => response.ok)
      .catch(() => false);
    if (!healthy)
      throw new Error('Port 4387 is in use by another process. Stop it and run Foundry again.');
    console.log('Using the existing local Foundry runtime.');
  }
  const reviewUrl = `http://127.0.0.1:4387/?session=${encodeURIComponent(session.changeSet.sessionId)}&token=${encodeURIComponent(session.token)}`;
  if (platform === 'web' && targetUrl && config && !config.instrumented) {
    basicPreview = await startBasicPreviewProxy(targetUrl, config.runtimeUrl);
    console.log('Basic mode: Foundry is attached without changing the project entry point.');
    console.log(
      'Run setup again after adding a supported client entry to enable exact source mapping.',
    );
  }
  const productUrl =
    targetUrl && platform === 'web'
      ? addSessionParams(basicPreview?.url ?? targetUrl, session.changeSet.sessionId, session.token)
      : reviewUrl;
  const workspaceUrl =
    platform === 'web' && targetUrl
      ? `${reviewUrl}&preview=${encodeURIComponent(productUrl)}`
      : reviewUrl;
  console.log(`Foundry session ${session.changeSet.sessionId}`);
  if (resumable) console.log('Resumed the most recent session for this project revision.');
  console.log(`Platform: ${platform}`);
  console.log(`Workspace: ${workspaceUrl}`);
  if (targetUrl && platform === 'web')
    console.log(`${basicPreview ? 'Basic' : 'Precision'} preview: ${productUrl}`);
  if (platform === 'web') {
    console.log('\nFirst edit:');
    console.log('  1. Option-click an element. Shift-click to add more.');
    console.log('  2. Drag a blue handle or use the inspector for exact values.');
    console.log('  3. Review the semantic mapping, then Apply with agent.');
    console.log('\nAgent handoff:');
    console.log('  Keep this process running while you design.');
    console.log('  Foundry will show “Agent is ready” only while a coding agent is listening.');
    console.log(
      '  If it is not ready, ask the agent: “Keep listening for Apply with agent requests.”',
    );
  }
  if (!has('--no-open')) await openUrl(workspaceUrl);
  const shutdown = async () => {
    if (ownsRuntime) await runtime.stop();
    await basicPreview?.stop();
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
  console.log(`${releasePreflight('remove managed project integration')}\n`);
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
  const report = await collectDoctorReport(root);
  if (has('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    for (const check of report.checks) {
      const marker = check.status === 'passed' ? '✓' : check.status === 'warning' ? '△' : '○';
      console.log(`${marker} ${check.label}: ${check.detail}`);
    }
    console.log(
      report.ready
        ? '\nFoundry is ready and an agent is actively listening.'
        : '\nFoundry is not yet ready for Apply with agent. Configuration and a live listener are separate checks.',
    );
  }
  if (has('--repair')) {
    console.log(`\n${releasePreflight('repair this project and agent connection')}\n`);
    const detectedAgents = (await createSetupPlan(root)).agents;
    const configured = report.checks.find((check) => check.id === 'config')?.status === 'passed';
    const result = configured
      ? await updateProject(root, { agents: [] })
      : await setupProject(root, { agents: [], targetUrl: flag('--url') });
    for (const agent of detectedAgents)
      await installHostAgentIntegration(homedir(), agent, {
        packageRoot: has('--local-mcp') ? runtimeRepository : undefined,
      });
    console.log(
      `✓ Repaired ${result.changed.length} managed paths and the shared ${detectedAgents.join(', ')} connection.`,
    );
  } else if (report.checks.some((check) => check.status === 'failed')) {
    console.log('Run: foundry-design doctor --repair');
  }
}

async function launch(): Promise<void> {
  console.log(`${releasePreflight('install, update, and start Foundry')}\n`);
  const root = projectRoot();
  const manifest = join(root, '.foundry', 'install-manifest.json');
  const installed = await pathExists(manifest);
  const detectedAgents = (await createSetupPlan(root)).agents;
  console.log(`Foundry\n\nProject: ${root}`);
  console.log(
    `${installed ? 'Refreshing' : 'Preparing'} the project and shared ${detectedAgents.join(', ')} connection.`,
  );
  if (!(await confirm('Continue?'))) {
    console.log('Foundry cancelled.');
    return;
  }
  const result = installed
    ? await updateProject(root, { agents: [], targetUrl: flag('--url') })
    : await setupProject(root, { agents: [], targetUrl: flag('--url') });
  for (const agent of detectedAgents)
    await installHostAgentIntegration(homedir(), agent, {
      packageRoot: has('--local-mcp') ? runtimeRepository : undefined,
    });
  console.log(`✓ ${installed ? 'Updated' : 'Installed'} and validated Foundry.`);
  for (const check of result.validation)
    console.log(
      `${check.status === 'passed' ? '✓' : check.status === 'skipped' ? '–' : '!'} ${check.name}: ${check.status.replaceAll('-', ' ')}`,
    );
  if (!installed)
    console.log(
      `\nRestart ${detectedAgents.join(', ')} once to load the shared connection. The visual session will open now and queued batches will wait safely until it reconnects.`,
    );
  if (has('--no-start')) return;
  await start();
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
  console.log(`${releasePreflight('install the coding-agent connection')}\n`);
  const agent = args[1];
  if (!agent || !['cursor', 'claude', 'codex'].includes(agent))
    throw new Error('install-agent requires cursor, claude, or codex');
  if (has('--global')) {
    const result = await installHostAgentIntegration(homedir(), agent as Agent, {
      packageRoot: has('--local-mcp') ? runtimeRepository : undefined,
    });
    console.log(`Installed the shared Foundry connection for ${agent}.`);
    console.log(`MCP configuration: ${result.configFile}`);
    console.log(`Skill: ${result.skillDirectory}`);
    if (result.preserved.length) {
      console.log('Preserved customized skill files:');
      for (const path of result.preserved) console.log(`  ${path}`);
    }
    console.log(
      `Restart ${agent === 'codex' ? 'Codex' : agent === 'cursor' ? 'Cursor' : 'Claude Code'} once. Future projects can use "npx foundry-design setup --agent none --yes" without another MCP install.`,
    );
    return;
  }
  const root = projectRoot();
  const file = await installAgentIntegration(
    root,
    agent as Agent,
    has('--local-mcp') ? runtimeRepository : undefined,
  );
  console.log(`Installed Foundry MCP configuration for ${agent}: ${file}`);
  console.log(
    `Restart ${agent === 'codex' ? 'Codex' : agent === 'cursor' ? 'Cursor' : 'Claude Code'} before starting a Foundry apply session.`,
  );
}

try {
  if (has('--version') || command === 'version') console.log(FOUNDRY_VERSION);
  else if (has('--help') || command === 'help') printHelp();
  else if (command === 'launch') await launch();
  else if (command === 'setup') await setup();
  else if (command === 'update') await update();
  else if (command === 'init') await initProject();
  else if (command === 'start') await start();
  else if (command === 'doctor' || command === 'status') await doctor();
  else if (command === 'index') await indexDesign();
  else if (command === 'uninstall') await uninstall();
  else if (command === 'export') await exportSession();
  else if (command === 'install-agent') await installAgent();
  else printHelp();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
