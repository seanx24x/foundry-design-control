import { createHash } from 'node:crypto';
import { accessSync } from 'node:fs';
import { access, mkdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import type { Platform } from 'foundry-design-protocol';
import { detectPlatform } from './project.js';

export type Agent = 'codex' | 'cursor' | 'claude';
export type WebFramework = 'next' | 'vite' | 'html' | 'generic';

export interface FoundryProjectConfig {
  version: 1 | 2;
  platform: Platform;
  framework?: WebFramework;
  runtimeUrl: string;
  targetUrl?: string;
  devCommand?: { command: string; args: string[] };
  instrumented: boolean;
  design?: {
    tokenFiles?: string[];
    componentRoots?: string[];
    exclude?: string[];
    viewports?: Array<{ id: string; label: string; width: number; height?: number }>;
    themes?: Array<{
      id: string;
      label: string;
      selector?: string;
      attribute?: string;
      value?: string;
    }>;
    states?: Array<{
      id: string;
      label: string;
      theme?: string;
      pseudoStates?: Array<'hover' | 'focus' | 'active' | 'disabled'>;
      reducedMotion?: boolean;
      query?: Record<string, string>;
    }>;
  };
}

interface ManagedFile {
  path: string;
  sha256: string;
}

interface InstallManifest {
  version: 1;
  agents: Agent[];
  generatedFiles: ManagedFile[];
  managedBlocks: string[];
  jsonConfigs: string[];
  installedAt: string;
}

export interface SetupOptions {
  agents?: Agent[];
  targetUrl?: string;
  runtimeUrl?: string;
  packageRoot?: string;
}

export interface SetupPlan {
  root: string;
  platform: Platform;
  framework?: WebFramework;
  agents: Agent[];
  files: string[];
  integrationFile?: string;
  targetUrl?: string;
  devCommand?: { command: string; args: string[] };
}

export interface SetupResult extends SetupPlan {
  changed: string[];
}

export interface UninstallResult {
  removed: string[];
  preserved: string[];
}

const START = '>>> Foundry Design Control';
const END = '<<< Foundry Design Control';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

function digest(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function slash(path: string): string {
  return path.replaceAll('\\', '/');
}

function relativeImport(from: string, to: string): string {
  const path = slash(relative(dirname(from), to));
  return path.startsWith('.') ? path : `./${path}`;
}

async function packageJson(root: string): Promise<Record<string, any>> {
  try {
    return JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as Record<string, any>;
  } catch {
    return {};
  }
}

export async function detectWebFramework(root: string): Promise<WebFramework> {
  const pkg = await packageJson(root);
  const dependencies = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  if (dependencies.next) return 'next';
  if (dependencies.vite) return 'vite';
  if (await exists(join(root, 'index.html'))) return 'html';
  return 'generic';
}

function packageManager(root: string): { command: string; runArgs: (script: string) => string[] } {
  if (existsSync(join(root, 'pnpm-lock.yaml')))
    return { command: 'pnpm', runArgs: (script) => [script] };
  if (existsSync(join(root, 'yarn.lock')))
    return { command: 'yarn', runArgs: (script) => [script] };
  if (existsSync(join(root, 'bun.lockb')) || existsSync(join(root, 'bun.lock')))
    return { command: 'bun', runArgs: (script) => ['run', script] };
  return { command: 'npm', runArgs: (script) => ['run', script] };
}

function existsSync(path: string): boolean {
  try {
    accessSync(path);
    return true;
  } catch {
    return false;
  }
}

async function detectDevCommand(
  root: string,
): Promise<{ command: string; args: string[] } | undefined> {
  const pkg = await packageJson(root);
  const script = pkg.scripts?.dev ? 'dev' : pkg.scripts?.start ? 'start' : undefined;
  if (!script) return undefined;
  const manager = packageManager(root);
  return { command: manager.command, args: manager.runArgs(script) };
}

function defaultTarget(framework: WebFramework | undefined): string | undefined {
  if (framework === 'vite') return 'http://127.0.0.1:5173';
  if (framework === 'next') return 'http://127.0.0.1:3000';
  if (framework === 'html') return 'http://127.0.0.1:3000';
  return undefined;
}

async function detectAgents(root: string): Promise<Agent[]> {
  const detected: Agent[] = [];
  if (await exists(join(root, '.cursor'))) detected.push('cursor');
  if ((await exists(join(root, '.claude'))) || (await exists(join(root, '.mcp.json'))))
    detected.push('claude');
  if (await exists(join(root, '.codex'))) detected.push('codex');
  return detected.length ? [...new Set(detected)] : ['codex'];
}

async function findFirst(root: string, candidates: string[]): Promise<string | undefined> {
  for (const candidate of candidates) {
    const path = join(root, candidate);
    if (await exists(path)) return path;
  }
  return undefined;
}

async function integrationFile(
  root: string,
  framework: WebFramework | undefined,
): Promise<string | undefined> {
  if (framework === 'next') {
    return findFirst(root, [
      'app/layout.tsx',
      'app/layout.jsx',
      'src/app/layout.tsx',
      'src/app/layout.jsx',
    ]);
  }
  if (framework === 'vite') {
    return findFirst(root, [
      'src/main.tsx',
      'src/main.jsx',
      'src/main.ts',
      'src/main.js',
      'index.html',
    ]);
  }
  if (framework === 'html') return join(root, 'index.html');
  return undefined;
}

export async function createSetupPlan(
  rootInput: string,
  options: SetupOptions = {},
): Promise<SetupPlan> {
  const root = resolve(rootInput);
  const platform = await detectPlatform(root);
  const framework = platform === 'web' ? await detectWebFramework(root) : undefined;
  const agents = options.agents ?? (await detectAgents(root));
  const integration = await integrationFile(root, framework);
  const files = [
    join(root, '.foundry', 'foundry.config.json'),
    join(root, '.foundry', 'install-manifest.json'),
  ];
  if (platform === 'web') files.push(join(root, '.foundry', 'web-adapter.ts'));
  if (platform === 'swiftui') files.push(join(root, '.foundry', 'swiftui-setup.md'));
  if (platform === 'react-native') files.push(join(root, '.foundry', 'react-native-setup.md'));
  if (agents.includes('codex')) files.push(join(root, '.codex', 'config.toml'));
  if (agents.includes('cursor')) files.push(join(root, '.cursor', 'mcp.json'));
  if (agents.includes('claude')) files.push(join(root, '.mcp.json'));
  if (integration) {
    files.push(integration);
    if (framework === 'next') files.push(join(dirname(integration), 'foundry-loader.tsx'));
  }
  files.push(join(root, '.gitignore'));
  return {
    root,
    platform,
    framework,
    agents,
    files: [...new Set(files)],
    integrationFile: integration,
    targetUrl: options.targetUrl ?? defaultTarget(framework),
    devCommand: await detectDevCommand(root),
  };
}

function managedBlock(content: string, syntax: 'line' | 'html' | 'hash'): string {
  const prefix = syntax === 'html' ? '<!-- ' : syntax === 'hash' ? '# ' : '// ';
  const suffix = syntax === 'html' ? ' -->' : '';
  return `${prefix}${START}${suffix}\n${content.trim()}\n${prefix}${END}${suffix}`;
}

function stripManagedBlock(content: string): string {
  const escapedStart = START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(?:\\/\\/|#|<!--)\\s*${escapedStart}(?:\\s*-->)?[\\s\\S]*?(?:\\/\\/|#|<!--)\\s*${escapedEnd}(?:\\s*-->)?\\s*`,
    'g',
  );
  return (
    content
      .replace(pattern, '')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}

async function setManagedBlock(path: string, block: string): Promise<boolean> {
  const original = await readText(path);
  const next = `${stripManagedBlock(original).trimEnd()}${original.trim() ? '\n\n' : ''}${block}\n`;
  if (next === original) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, next);
  return true;
}

async function writeGenerated(path: string, content: string): Promise<ManagedFile> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  return { path, sha256: digest(content) };
}

function adapterSource(runtimeUrl: string): string {
  return `/** Foundry development adapter. Safe to commit; inactive outside an explicit session. */
export async function installFoundryDesignControl(): Promise<void> {
  if (typeof window === 'undefined') return;
  const query = new URLSearchParams(window.location.search);
  if (!query.has('__foundry_session')) return;
  const module = await import(/* @vite-ignore */ '${runtimeUrl}/adapter.js');
  module.installFoundryInspector();
}
`;
}

async function configureWebIntegration(
  plan: SetupPlan,
  generated: ManagedFile[],
  managedBlocks: string[],
): Promise<string | undefined> {
  const entry = plan.integrationFile;
  if (!entry) return undefined;
  if (plan.framework === 'next') {
    const appRoot = dirname(entry);
    const loader = join(appRoot, 'foundry-loader.tsx');
    const runtimeUrl = 'http://127.0.0.1:4387';
    const loaderContent = `'use client';

import { useEffect } from 'react';

export function FoundryLoader(): null {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (!query.has('__foundry_session')) return;
    void import(/* webpackIgnore: true */ '${runtimeUrl}/adapter.js').then((module) =>
      module.installFoundryInspector(),
    );
  }, []);
  return null;
}
`;
    generated.push(await writeGenerated(loader, loaderContent));
    const original = await readText(entry);
    if (!original.includes('FoundryLoader')) {
      const withImport = `import { FoundryLoader } from './foundry-loader';\n${original}`;
      const next = withImport.replace(/(<body(?:\s[^>]*)?>)/, '$1\n        <FoundryLoader />');
      if (next === withImport) throw new Error(`Could not locate <body> in ${entry}`);
      await writeFile(entry, next);
    }
    managedBlocks.push(entry);
    return entry;
  }
  if (entry.endsWith('.html')) {
    const raw = await readText(entry);
    if (
      !raw.includes(START) &&
      raw.includes('__foundry_session') &&
      raw.includes('installFoundryInspector')
    )
      return undefined;
    const original = stripManagedBlock(raw);
    const script = managedBlock(
      `<script type="module">
  const query = new URLSearchParams(location.search);
  if (query.has('__foundry_session')) {
    const module = await import('http://127.0.0.1:4387/adapter.js');
    module.installFoundryInspector();
  }
</script>`,
      'html',
    );
    const next = original.includes('</body>')
      ? original.replace('</body>', `  ${script.replaceAll('\n', '\n  ')}\n</body>`)
      : `${original.trimEnd()}\n${script}\n`;
    await writeFile(entry, next);
    managedBlocks.push(entry);
    return entry;
  }
  const adapter = join(plan.root, '.foundry', 'web-adapter.ts');
  const existing = await readText(entry);
  if (
    !existing.includes(START) &&
    (existing.includes('installFoundryDesignControl') || existing.includes('.foundry/web-adapter'))
  )
    return undefined;
  const specifier = relativeImport(entry, adapter);
  const block = managedBlock(
    `if (import.meta.env.DEV) {
  void import('${specifier}').then(({ installFoundryDesignControl }) =>
    installFoundryDesignControl(),
  );
}`,
    'line',
  );
  await setManagedBlock(entry, block);
  managedBlocks.push(entry);
  return entry;
}

function mcpServer(packageRoot?: string): {
  command: string;
  args: string[];
  env: Record<string, string>;
} {
  if (packageRoot) {
    return {
      command: 'pnpm',
      args: ['--dir', packageRoot, '--filter', 'foundry-design-mcp-server', 'start'],
      env: { FOUNDRY_DESIGN_RUNTIME_URL: 'http://127.0.0.1:4387' },
    };
  }
  return {
    command: 'npx',
    args: ['-y', 'foundry-design-mcp-server@0.1.0'],
    env: { FOUNDRY_DESIGN_RUNTIME_URL: 'http://127.0.0.1:4387' },
  };
}

async function configureCodex(path: string, packageRoot?: string): Promise<void> {
  const server = mcpServer(packageRoot);
  const block = managedBlock(
    `[mcp_servers.foundry-design-control]
command = ${JSON.stringify(server.command)}
args = ${JSON.stringify(server.args)}

[mcp_servers.foundry-design-control.env]
FOUNDRY_DESIGN_RUNTIME_URL = "http://127.0.0.1:4387"`,
    'hash',
  );
  await setManagedBlock(path, block);
}

async function configureJson(path: string, packageRoot?: string): Promise<void> {
  let current: { mcpServers?: Record<string, unknown> } = {};
  try {
    current = JSON.parse(await readFile(path, 'utf8')) as typeof current;
  } catch {
    /* Create a new config. */
  }
  current.mcpServers = {
    ...(current.mcpServers ?? {}),
    'foundry-design-control': mcpServer(packageRoot),
  };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(current, null, 2)}\n`);
}

export async function setupProject(
  rootInput: string,
  options: SetupOptions = {},
): Promise<SetupResult> {
  const plan = await createSetupPlan(rootInput, options);
  const runtimeUrl = options.runtimeUrl ?? 'http://127.0.0.1:4387';
  const generated: ManagedFile[] = [];
  const managedBlocks: string[] = [];
  const jsonConfigs: string[] = [];
  const changed: string[] = [];
  const config: FoundryProjectConfig = {
    version: 2,
    platform: plan.platform,
    ...(plan.framework ? { framework: plan.framework } : {}),
    runtimeUrl,
    ...(plan.targetUrl ? { targetUrl: plan.targetUrl } : {}),
    ...(plan.devCommand ? { devCommand: plan.devCommand } : {}),
    instrumented: plan.platform !== 'web' || Boolean(plan.integrationFile),
    design: {
      componentRoots: ['src', 'app', 'components'],
      exclude: ['node_modules', 'dist', 'build', '.next', 'coverage'],
      viewports: [
        { id: 'mobile', label: 'Mobile', width: 390, height: 844 },
        { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
        { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
      ],
      themes: [
        { id: 'light', label: 'Light', attribute: 'data-theme', value: 'light' },
        { id: 'dark', label: 'Dark', attribute: 'data-theme', value: 'dark' },
      ],
    },
  };
  const configFile = join(plan.root, '.foundry', 'foundry.config.json');
  generated.push(await writeGenerated(configFile, `${JSON.stringify(config, null, 2)}\n`));
  changed.push(configFile);
  if (plan.platform === 'web') {
    const adapter = join(plan.root, '.foundry', 'web-adapter.ts');
    generated.push(await writeGenerated(adapter, adapterSource(runtimeUrl)));
    changed.push(adapter);
    const integration = await configureWebIntegration(plan, generated, managedBlocks);
    if (integration) changed.push(integration);
  } else {
    const setup = join(plan.root, '.foundry', `${plan.platform}-setup.md`);
    const content =
      plan.platform === 'swiftui'
        ? '# Foundry SwiftUI setup\n\nAdd FoundryDesignControl only to DEBUG builds and mark meaningful views with `.foundryInspectable`.\n'
        : '# Foundry React Native setup\n\nCreate the debug adapter and register semantic targets using `measureInWindow`.\n';
    generated.push(await writeGenerated(setup, content));
    changed.push(setup);
  }
  const gitignore = join(plan.root, '.gitignore');
  await setManagedBlock(gitignore, managedBlock('.foundry/sessions/', 'hash'));
  managedBlocks.push(gitignore);
  changed.push(gitignore);
  if (plan.agents.includes('codex')) {
    const path = join(plan.root, '.codex', 'config.toml');
    await configureCodex(path, options.packageRoot);
    managedBlocks.push(path);
    changed.push(path);
  }
  if (plan.agents.includes('cursor')) {
    const path = join(plan.root, '.cursor', 'mcp.json');
    await configureJson(path, options.packageRoot);
    jsonConfigs.push(path);
    changed.push(path);
  }
  if (plan.agents.includes('claude')) {
    const path = join(plan.root, '.mcp.json');
    await configureJson(path, options.packageRoot);
    jsonConfigs.push(path);
    changed.push(path);
  }
  const manifest: InstallManifest = {
    version: 1,
    agents: plan.agents,
    generatedFiles: generated,
    managedBlocks,
    jsonConfigs,
    installedAt: new Date().toISOString(),
  };
  const manifestFile = join(plan.root, '.foundry', 'install-manifest.json');
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  changed.push(manifestFile);
  return { ...plan, changed: [...new Set(changed)] };
}

async function removeJsonServer(path: string): Promise<void> {
  try {
    const current = JSON.parse(await readFile(path, 'utf8')) as {
      mcpServers?: Record<string, unknown>;
    };
    if (!current.mcpServers?.['foundry-design-control']) return;
    delete current.mcpServers['foundry-design-control'];
    if (Object.keys(current.mcpServers).length === 0) delete current.mcpServers;
    await writeFile(path, `${JSON.stringify(current, null, 2)}\n`);
  } catch {
    /* Preserve unreadable user configuration. */
  }
}

export async function uninstallProject(rootInput: string): Promise<UninstallResult> {
  const root = resolve(rootInput);
  const manifestFile = join(root, '.foundry', 'install-manifest.json');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as InstallManifest;
  const removed: string[] = [];
  const preserved: string[] = [];
  for (const path of manifest.managedBlocks) {
    const original = await readText(path);
    if (!original) continue;
    let next = stripManagedBlock(original);
    if (path.endsWith('layout.tsx') || path.endsWith('layout.jsx')) {
      next = next
        .replace("import { FoundryLoader } from './foundry-loader';\n", '')
        .replace(/\s*<FoundryLoader \/>\n?/, '\n');
    }
    await writeFile(path, next);
    removed.push(path);
  }
  for (const path of manifest.jsonConfigs) {
    await removeJsonServer(path);
    removed.push(path);
  }
  for (const file of manifest.generatedFiles) {
    const content = await readText(file.path);
    if (!content) continue;
    if (digest(content) !== file.sha256) {
      preserved.push(file.path);
      continue;
    }
    await rm(file.path);
    removed.push(file.path);
  }
  await rm(manifestFile);
  removed.push(manifestFile);
  try {
    await rmdir(join(root, '.foundry'));
  } catch {
    /* Keep non-empty project data. */
  }
  return { removed: [...new Set(removed)], preserved };
}
