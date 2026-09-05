import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const release = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));
const version = release.version;
const packagePaths = [
  'apps/inspector/package.json',
  'packages/cli/package.json',
  'packages/mcp-server/package.json',
  'packages/protocol/package.json',
  'packages/react-native-adapter/package.json',
  'packages/runtime/package.json',
  'packages/web-adapter/package.json',
];
const requiredDocs = [
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'PRIVACY.md',
  'SECURITY.md',
  'SUPPORT.md',
];
const manifestPaths = [
  '.codex-plugin/plugin.json',
  'plugins/foundry-design-control/plugin.json',
  'plugins/foundry-design-control/.codex-plugin/plugin.json',
  'plugins/foundry-design-control/.cursor-plugin/plugin.json',
  'plugins/foundry-design-control/.claude-plugin/plugin.json',
];
const marketplacePaths = [
  '.agents/plugins/marketplace.json',
  '.cursor-plugin/marketplace.json',
  '.claude-plugin/marketplace.json',
];

const failures = [];
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const rootReadmeDigest = createHash('sha256')
  .update(readFileSync(join(root, 'README.md')))
  .digest('hex');
const rootReadme = readFileSync(join(root, 'README.md'), 'utf8');

const builtReleasePath = join(root, 'packages/cli/dist/release.js');
if (!existsSync(builtReleasePath)) {
  failures.push('CLI build output is missing; run pnpm build before publishing');
} else {
  const builtRelease = readFileSync(builtReleasePath, 'utf8');
  if (!builtRelease.includes(`FOUNDRY_VERSION = '${version}'`)) {
    failures.push(
      `CLI build output does not contain release version ${version}; rebuild before publishing`,
    );
  }
  if (builtRelease.match(/0\.2\.0-beta\.\d+(?:\.\d+)?/)?.[0] !== version) {
    failures.push('CLI build output contains stale release metadata');
  }
}

if (release.packageCount !== packagePaths.length) {
  failures.push(
    `release.json expects ${release.packageCount} packages but ${packagePaths.length} are configured`,
  );
}

if (rootReadme.includes('foundry-design@beta')) {
  failures.push('README.md still routes installation through the moving beta tag');
}
if (!rootReadme.includes('npx foundry-design')) {
  failures.push('README.md is missing the canonical unqualified install command');
}

for (const path of requiredDocs) {
  if (!existsSync(join(root, path))) failures.push(`Missing ${path}`);
}

for (const path of packagePaths) {
  const manifest = readJson(path);
  if (manifest.version !== version) failures.push(`${path} has version ${manifest.version}`);
  if (manifest.license !== 'MIT') failures.push(`${path} is missing the MIT license metadata`);
  if (manifest.publishConfig?.access !== 'public')
    failures.push(`${path} is not configured for public publication`);
  if (!manifest.repository) failures.push(`${path} is missing repository metadata`);
  if (!manifest.homepage) failures.push(`${path} is missing homepage metadata`);
  if (!manifest.bugs) failures.push(`${path} is missing issue tracker metadata`);
}

for (const path of packagePaths.map((path) => path.replace('package.json', 'README.md'))) {
  if (!existsSync(join(root, path))) {
    failures.push(`${path} is missing`);
    continue;
  }
  if (
    createHash('sha256')
      .update(readFileSync(join(root, path)))
      .digest('hex') !== rootReadmeDigest
  )
    failures.push(`${path} drifted from the canonical README.md`);
}

for (const path of [
  'plugins/foundry-design-control/hooks/hooks.json',
  'plugins/foundry-design-control/hooks/cursor-hooks.json',
  'plugins/foundry-design-control/scripts/claude-session-start.mjs',
  'plugins/foundry-design-control/scripts/cursor-session-start.mjs',
  'plugins/foundry-design-control/commands/foundry.md',
]) {
  if (!existsSync(join(root, path))) failures.push(`Missing plugin lifecycle file ${path}`);
}

for (const path of manifestPaths) {
  const manifest = readJson(path);
  if (manifest.version !== version) failures.push(`${path} has version ${manifest.version}`);
  if (manifest.name !== 'foundry-design-control')
    failures.push(`${path} has an unexpected plugin name`);
}

for (const path of marketplacePaths) {
  const marketplace = readJson(path);
  const plugin = marketplace.plugins?.find((entry) => entry.name === 'foundry-design-control');
  if (!plugin) failures.push(`${path} is missing the Foundry plugin entry`);
  else if (plugin.version !== version)
    failures.push(`${path} has plugin version ${plugin.version ?? 'missing'}`);
}

const mcpbManifest = readJson('extensions/claude-desktop/manifest.json');
if (mcpbManifest.manifest_version !== '0.4') {
  failures.push('Claude Desktop MCPB manifest must use manifest version 0.4');
}
if (mcpbManifest.version !== version) {
  failures.push(`Claude Desktop MCPB manifest has version ${mcpbManifest.version}`);
}
if (mcpbManifest.server?.type !== 'node' || !mcpbManifest.server?.entry_point) {
  failures.push('Claude Desktop MCPB manifest is missing its bundled Node entry point');
}

for (const path of [
  '.mcp.json',
  'plugins/foundry-design-control/.mcp.json',
  'plugins/foundry-design-control/mcp.json',
]) {
  const contents = readFileSync(join(root, path), 'utf8');
  if (!contents.includes(`foundry-design-mcp-server@${version}`)) {
    failures.push(`${path} does not pin the beta MCP server`);
  }
  if (!contents.includes('--prefer-online')) {
    failures.push(`${path} does not revalidate the pinned MCP package online`);
  }
}

function filesBelow(directory) {
  const output = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) output.push(...filesBelow(path));
    else output.push(path);
  }
  return output;
}

const sourceSkill = join(root, 'skills/foundry-design-control');
const bundledSkill = join(root, 'plugins/foundry-design-control/skills/foundry-design-control');
const cliSkill = join(root, 'packages/cli/dist/skill/foundry-design-control');
const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const sourceRunner = readFileSync(join(sourceSkill, 'scripts', 'foundry.sh'), 'utf8');
if (!sourceRunner.includes('--prefer-online --package=foundry-design@latest')) {
  failures.push('The skill launcher does not revalidate the latest Foundry release');
}
if (sourceRunner.includes('command -v foundry-design')) {
  failures.push('The skill launcher can select a stale global Foundry binary');
}

for (const [label, copy] of [
  ['Plugin', bundledSkill],
  ['CLI', cliSkill],
]) {
  if (!existsSync(copy)) {
    failures.push(`${label} is missing its Foundry skill bundle`);
    continue;
  }
  for (const sourcePath of filesBelow(sourceSkill)) {
    const localPath = relative(sourceSkill, sourcePath);
    const copiedPath = join(copy, localPath);
    if (!existsSync(copiedPath)) {
      failures.push(`${label} is missing skill file ${localPath}`);
      continue;
    }
    if (digest(sourcePath) !== digest(copiedPath)) {
      failures.push(`${label} skill copy drifted at ${localPath}`);
    }
  }
}

if (failures.length) {
  console.error(`Release check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Release metadata and plugin bundle are aligned at ${version}.`);
