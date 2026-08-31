import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { accessSync } from 'node:fs';
import { access, mkdir, readFile, readdir, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
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

export interface SetupValidationResult {
  name: 'typecheck' | 'lint';
  status: 'passed' | 'pre-existing-failure' | 'skipped';
  command?: string;
  message?: string;
}

interface InstallManifest {
  version: 1 | 2;
  agents: Agent[];
  generatedFiles: ManagedFile[];
  managedBlocks: string[];
  jsonConfigs: string[];
  skillDirectories?: string[];
  installedAt: string;
  generatorVersion?: string;
  validation?: SetupValidationResult[];
}

export interface SetupOptions {
  agents?: Agent[];
  targetUrl?: string;
  runtimeUrl?: string;
  packageRoot?: string;
  skillRoot?: string;
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
  skillDirectories: string[];
}

export interface SetupResult extends SetupPlan {
  changed: string[];
  validation: SetupValidationResult[];
}

export interface UninstallResult {
  removed: string[];
  preserved: string[];
}

const START = '>>> Foundry Design Control';
const END = '<<< Foundry Design Control';
const GENERATOR_VERSION = '0.2.0-beta.3';
const TRANSACTION_FILE = 'setup-transaction.json';
const execFileAsync = promisify(execFile);
const DEFAULT_SKILL_ROOT = fileURLToPath(
  new URL('./skill/foundry-design-control/', import.meta.url),
);

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

interface FileSnapshot {
  path: string;
  content: string | null;
}

interface SetupJournal {
  version: 1;
  root: string;
  snapshots: FileSnapshot[];
}

interface CommandResult {
  exitCode: number;
  output: string;
  unavailable?: boolean;
}

interface ValidationCommand {
  name: SetupValidationResult['name'];
  command: string;
  args: string[];
}

const LEGACY_NEXT_LOADER_DIGESTS = new Set([
  'ec45810b798224907a947c3bf9e01e5e342b64f506c910a35f08fdc0399aac0e',
  '8a5757b906c3db7b720cb5a61c4b4dd189bf1f61cb299cf31e107d277b75b4b3',
]);

function transactionPath(root: string): string {
  return join(root, '.foundry', TRANSACTION_FILE);
}

async function snapshotFiles(paths: string[]): Promise<FileSnapshot[]> {
  return Promise.all(
    [...new Set(paths)].map(async (path) => ({
      path,
      content: await readFile(path)
        .then((value) => value.toString('base64'))
        .catch(() => null),
    })),
  );
}

async function restoreSnapshots(root: string, snapshots: FileSnapshot[]): Promise<void> {
  for (const snapshot of snapshots) {
    if (snapshot.content == null) {
      await rm(snapshot.path, { force: true }).catch(() => undefined);
      continue;
    }
    await mkdir(dirname(snapshot.path), { recursive: true });
    await writeFile(snapshot.path, Buffer.from(snapshot.content, 'base64'));
  }
  const directories = [...new Set(snapshots.map((snapshot) => dirname(snapshot.path)))]
    .filter((path) => path.startsWith(root) && path !== root)
    .sort((left, right) => right.length - left.length);
  for (const directory of directories) await rmdir(directory).catch(() => undefined);
}

async function recoverInterruptedSetup(root: string): Promise<void> {
  const path = transactionPath(root);
  const journal = await readFile(path, 'utf8')
    .then((value) => JSON.parse(value) as SetupJournal)
    .catch(() => undefined);
  if (!journal?.snapshots?.length || journal.root !== root) return;
  await restoreSnapshots(root, journal.snapshots);
  await rm(path, { force: true });
  await rmdir(dirname(path)).catch(() => undefined);
}

async function writeTransaction(root: string, snapshots: FileSnapshot[]): Promise<void> {
  const path = transactionPath(root);
  await mkdir(dirname(path), { recursive: true });
  const journal: SetupJournal = { version: 1, root, snapshots };
  await writeFile(path, `${JSON.stringify(journal, null, 2)}\n`);
}

async function validationCommands(root: string): Promise<ValidationCommand[]> {
  const pkg = await packageJson(root);
  const manager = packageManager(root);
  const commands: ValidationCommand[] = [];
  if (pkg.scripts?.typecheck) {
    commands.push({
      name: 'typecheck',
      command: manager.command,
      args: manager.runArgs('typecheck'),
    });
  } else if (existsSync(join(root, 'node_modules', '.bin', 'tsc'))) {
    commands.push({
      name: 'typecheck',
      command: join(root, 'node_modules', '.bin', 'tsc'),
      args: ['--noEmit', '--pretty', 'false'],
    });
  }
  if (pkg.scripts?.lint) {
    commands.push({ name: 'lint', command: manager.command, args: manager.runArgs('lint') });
  } else if (existsSync(join(root, 'node_modules', '.bin', 'eslint'))) {
    commands.push({
      name: 'lint',
      command: join(root, 'node_modules', '.bin', 'eslint'),
      args: ['.'],
    });
  }
  return commands;
}

async function runValidationCommand(
  root: string,
  check: ValidationCommand,
): Promise<CommandResult> {
  try {
    const result = await execFileAsync(check.command, check.args, {
      cwd: root,
      env: { ...process.env, CI: '1', NO_COLOR: '1' },
      timeout: 180_000,
      maxBuffer: 8_000_000,
    });
    return { exitCode: 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
  } catch (error) {
    const failure = error as {
      code?: string | number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    if (failure.code === 'ENOENT') {
      return { exitCode: 127, output: failure.message ?? 'Command unavailable', unavailable: true };
    }
    return {
      exitCode: typeof failure.code === 'number' ? failure.code : 1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}${failure.message ?? ''}`,
    };
  }
}

function introducedManagedDiagnostic(
  root: string,
  before: CommandResult,
  after: CommandResult,
  paths: string[],
): boolean {
  if (before.exitCode === 0 && after.exitCode !== 0) return true;
  if (after.exitCode === 0 || before.output === after.output) return false;
  return paths.some((path) => {
    const relativePath = slash(relative(root, path));
    return after.output.includes(relativePath) && !before.output.includes(relativePath);
  });
}

async function validateInstalledProject(
  root: string,
  checks: ValidationCommand[],
  baseline: Map<SetupValidationResult['name'], CommandResult>,
  changed: string[],
): Promise<SetupValidationResult[]> {
  if (!checks.length) {
    return [
      { name: 'typecheck', status: 'skipped', message: 'No project validation command found.' },
      { name: 'lint', status: 'skipped', message: 'No project validation command found.' },
    ];
  }
  const results: SetupValidationResult[] = [];
  for (const check of checks) {
    const before = baseline.get(check.name)!;
    const after = await runValidationCommand(root, check);
    const command = [check.command, ...check.args].join(' ');
    if (after.unavailable) {
      results.push({
        name: check.name,
        status: 'skipped',
        command,
        message: 'The project command is not available in this environment.',
      });
      continue;
    }
    if (introducedManagedDiagnostic(root, before, after, changed)) {
      const detail = after.output.trim().split('\n').slice(-12).join('\n');
      throw new Error(
        `Foundry setup introduced a ${check.name} failure.\n${detail || `Command failed: ${command}`}`,
      );
    }
    results.push({
      name: check.name,
      status: after.exitCode === 0 ? 'passed' : 'pre-existing-failure',
      command,
      ...(after.exitCode === 0
        ? {}
        : {
            message:
              'The project had existing failures and Foundry added no managed-file diagnostic.',
          }),
    });
  }
  for (const name of ['typecheck', 'lint'] as const) {
    if (!results.some((result) => result.name === name))
      results.push({ name, status: 'skipped', message: `No ${name} command found.` });
  }
  return results;
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

function skillDirectory(root: string, agent: Agent): string {
  if (agent === 'codex') return join(root, '.agents', 'skills', 'foundry-design-control');
  if (agent === 'cursor') return join(root, '.cursor', 'skills', 'foundry-design-control');
  return join(root, '.claude', 'skills', 'foundry-design-control');
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
  const skillDirectories = agents.map((agent) => skillDirectory(root, agent));
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
  files.push(...skillDirectories);
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
    skillDirectories,
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

async function writeOwnedGenerated(
  path: string,
  content: string,
  ownedFiles: Map<string, string>,
  allowLegacyLoader = false,
): Promise<ManagedFile> {
  const existing = await readFile(path, 'utf8').catch(() => undefined);
  if (existing != null && existing !== content) {
    const currentDigest = digest(existing);
    const ownedDigest = ownedFiles.get(path);
    const ownedAndUnchanged = ownedDigest === currentDigest;
    const knownLoader = allowLegacyLoader && LEGACY_NEXT_LOADER_DIGESTS.has(currentDigest);
    if (!ownedAndUnchanged && !knownLoader) {
      throw new Error(`Foundry preserved your edited generated file at ${path}.`);
    }
  }
  return writeGenerated(path, content);
}

interface SkillFile {
  path: string;
  content: Buffer;
}

async function readSkill(sourceRoot: string): Promise<SkillFile[]> {
  if (!(await exists(join(sourceRoot, 'SKILL.md')))) {
    throw new Error(`Foundry skill bundle is missing from ${sourceRoot}`);
  }
  const files: SkillFile[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const sourcePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(sourcePath);
      } else if (entry.isFile()) {
        files.push({ path: relative(sourceRoot, sourcePath), content: await readFile(sourcePath) });
      }
    }
  };
  await visit(sourceRoot);
  return files;
}

async function validateSkillTarget(
  files: SkillFile[],
  targetRoot: string,
  ownedFiles: Map<string, string>,
): Promise<void> {
  for (const file of files) {
    const targetPath = join(targetRoot, file.path);
    const existing = await readFile(targetPath).catch(() => undefined);
    if (existing && !ownedFiles.has(targetPath) && !existing.equals(file.content)) {
      throw new Error(
        `A Foundry skill already exists at ${targetRoot}. Move or remove it before setup.`,
      );
    }
    const ownedDigest = ownedFiles.get(targetPath);
    if (existing && ownedDigest && digest(existing.toString()) !== ownedDigest) {
      throw new Error(
        `Foundry preserved your edited skill at ${targetRoot}. Move it before updating setup.`,
      );
    }
  }
}

async function copySkill(
  skillFiles: SkillFile[],
  targetRoot: string,
): Promise<{ files: ManagedFile[]; directories: string[] }> {
  const managedFiles: ManagedFile[] = [];
  const directories = new Set<string>();
  directories.add(targetRoot);
  for (const file of skillFiles) {
    const targetPath = join(targetRoot, file.path);
    const directory = dirname(targetPath);
    directories.add(directory);
    await mkdir(directory, { recursive: true });
    await writeFile(targetPath, file.content);
    managedFiles.push({ path: targetPath, sha256: digest(file.content.toString()) });
  }
  return { files: managedFiles, directories: [...directories] };
}

function adapterSource(runtimeUrl: string): string {
  return `/** Foundry development adapter. Safe to commit; inactive outside an explicit session. */
export async function installFoundryDesignControl(): Promise<void> {
  if (typeof window === 'undefined') return;
  const query = new URLSearchParams(window.location.search);
  if (!query.has('__foundry_session')) return;
  const adapter = await import(/* @vite-ignore */ '${runtimeUrl}/adapter.js');
  adapter.installFoundryInspector();
}
`;
}

async function configureWebIntegration(
  plan: SetupPlan,
  generated: ManagedFile[],
  managedBlocks: string[],
  ownedFiles: Map<string, string>,
  runtimeUrl: string,
): Promise<string | undefined> {
  const entry = plan.integrationFile;
  if (!entry) return undefined;
  if (plan.framework === 'next') {
    const appRoot = dirname(entry);
    const loader = join(appRoot, 'foundry-loader.tsx');
    const loaderContent = `'use client';

import { useEffect } from 'react';

export function FoundryLoader(): null {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (!query.has('__foundry_session')) return;
    if (document.querySelector('script[data-foundry-bootstrap]')) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = '${runtimeUrl}/adapter-bootstrap.js';
    script.dataset.foundryBootstrap = 'true';
    document.head.append(script);
  }, []);
  return null;
}
`;
    generated.push(await writeOwnedGenerated(loader, loaderContent, ownedFiles, true));
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
    args: ['-y', 'foundry-design-mcp-server@beta'],
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
  const root = resolve(rootInput);
  await recoverInterruptedSetup(root);
  const plan = await createSetupPlan(root, options);
  const runtimeUrl = options.runtimeUrl ?? 'http://127.0.0.1:4387';
  const generated: ManagedFile[] = [];
  const managedBlocks: string[] = [];
  const jsonConfigs: string[] = [];
  const skillDirectories: string[] = [];
  const changed: string[] = [];
  const previousManifest = await readFile(
    join(plan.root, '.foundry', 'install-manifest.json'),
    'utf8',
  )
    .then((content) => JSON.parse(content) as InstallManifest)
    .catch(() => undefined);
  const ownedFiles = new Map(
    (previousManifest?.generatedFiles ?? []).map((file) => [file.path, file.sha256]),
  );
  const skillFiles = plan.skillDirectories.length
    ? await readSkill(resolve(options.skillRoot ?? DEFAULT_SKILL_ROOT))
    : [];
  for (const directory of plan.skillDirectories) {
    await validateSkillTarget(skillFiles, directory, ownedFiles);
  }
  const transactionFiles = [
    ...plan.files.filter((path) => !plan.skillDirectories.includes(path)),
    ...plan.skillDirectories.flatMap((directory) =>
      skillFiles.map((file) => join(directory, file.path)),
    ),
  ];
  const snapshots = await snapshotFiles(transactionFiles);
  const checks = await validationCommands(plan.root);
  const baseline = new Map<SetupValidationResult['name'], CommandResult>();
  for (const check of checks)
    baseline.set(check.name, await runValidationCommand(plan.root, check));
  await writeTransaction(plan.root, snapshots);

  try {
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
    generated.push(
      await writeOwnedGenerated(configFile, `${JSON.stringify(config, null, 2)}\n`, ownedFiles),
    );
    changed.push(configFile);
    if (plan.platform === 'web') {
      const adapter = join(plan.root, '.foundry', 'web-adapter.ts');
      generated.push(await writeOwnedGenerated(adapter, adapterSource(runtimeUrl), ownedFiles));
      changed.push(adapter);
      const integration = await configureWebIntegration(
        plan,
        generated,
        managedBlocks,
        ownedFiles,
        runtimeUrl,
      );
      if (integration) changed.push(integration);
    } else {
      const setup = join(plan.root, '.foundry', `${plan.platform}-setup.md`);
      const content =
        plan.platform === 'swiftui'
          ? '# Foundry SwiftUI setup\n\nAdd FoundryDesignControl only to DEBUG builds and mark meaningful views with `.foundryInspectable`.\n'
          : '# Foundry React Native setup\n\nCreate the debug adapter and register semantic targets using `measureInWindow`.\n';
      generated.push(await writeOwnedGenerated(setup, content, ownedFiles));
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
    for (const directory of plan.skillDirectories) {
      const copied = await copySkill(skillFiles, directory);
      generated.push(...copied.files);
      skillDirectories.push(...copied.directories);
      changed.push(directory);
    }
    const validation = await validateInstalledProject(plan.root, checks, baseline, changed);
    const manifest: InstallManifest = {
      version: 2,
      agents: plan.agents,
      generatedFiles: generated,
      managedBlocks,
      jsonConfigs,
      skillDirectories: [...new Set(skillDirectories)],
      installedAt: new Date().toISOString(),
      generatorVersion: GENERATOR_VERSION,
      validation,
    };
    const manifestFile = join(plan.root, '.foundry', 'install-manifest.json');
    await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    changed.push(manifestFile);
    await rm(transactionPath(plan.root), { force: true });
    return { ...plan, changed: [...new Set(changed)], validation };
  } catch (error) {
    await restoreSnapshots(plan.root, snapshots);
    await rm(transactionPath(plan.root), { force: true });
    await rmdir(join(plan.root, '.foundry')).catch(() => undefined);
    throw error;
  }
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
  for (const directory of [...(manifest.skillDirectories ?? [])].sort(
    (left, right) => right.length - left.length,
  )) {
    try {
      await rmdir(directory);
      removed.push(directory);
    } catch {
      /* Preserve non-empty directories and user additions. */
    }
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
