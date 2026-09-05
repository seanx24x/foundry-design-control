import { existsSync, readFileSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const release = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));
const pluginRoot = join(root, 'plugins', 'foundry-design-control');
const failures = [];
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

function requirePath(owner, relativePath) {
  if (typeof relativePath !== 'string') return;
  const clean = relativePath.replace(/^\.\//, '');
  const target = normalize(join(pluginRoot, clean));
  if (!target.startsWith(pluginRoot) || !existsSync(target)) {
    failures.push(`${owner} references missing or unsafe path ${relativePath}`);
  }
}

for (const manifestPath of [
  'plugins/foundry-design-control/plugin.json',
  'plugins/foundry-design-control/.codex-plugin/plugin.json',
  'plugins/foundry-design-control/.cursor-plugin/plugin.json',
  'plugins/foundry-design-control/.claude-plugin/plugin.json',
]) {
  const manifest = readJson(manifestPath);
  if (manifest.name !== 'foundry-design-control')
    failures.push(`${manifestPath} has the wrong name`);
  if (manifest.version !== release.version)
    failures.push(`${manifestPath} has version ${manifest.version}`);
  for (const field of ['skills', 'commands', 'hooks', 'mcpServers', 'logo']) {
    if (manifest[field]) requirePath(join(root, manifestPath), manifest[field]);
  }
}

for (const marketplacePath of [
  '.agents/plugins/marketplace.json',
  '.cursor-plugin/marketplace.json',
  '.claude-plugin/marketplace.json',
]) {
  const marketplace = readJson(marketplacePath);
  const plugin = marketplace.plugins?.find((entry) => entry.name === 'foundry-design-control');
  if (!plugin) {
    failures.push(`${marketplacePath} is missing Foundry`);
    continue;
  }
  if (plugin.version !== release.version)
    failures.push(`${marketplacePath} has version ${plugin.version ?? 'missing'}`);
  const source = typeof plugin.source === 'string' ? plugin.source : plugin.source?.path;
  const sourcePath = join(root, (source ?? '').replace(/^\.\//, ''));
  if (!existsSync(sourcePath))
    failures.push(`${marketplacePath} points to missing source ${source}`);
}

for (const configPath of [
  '.mcp.json',
  'plugins/foundry-design-control/.mcp.json',
  'plugins/foundry-design-control/mcp.json',
]) {
  const config = readJson(configPath);
  const server = config.mcpServers?.['foundry-design-control'];
  if (server?.command !== 'npx') failures.push(`${configPath} does not use npx`);
  if (!server?.args?.includes(`foundry-design-mcp-server@${release.version}`))
    failures.push(`${configPath} does not pin ${release.version}`);
}

const cursorHook = readJson('plugins/foundry-design-control/hooks/cursor-hooks.json');
if (!cursorHook.hooks?.sessionStart?.length)
  failures.push('Cursor plugin has no sessionStart hook');
const claudeHook = readJson('plugins/foundry-design-control/hooks/hooks.json');
if (!claudeHook.hooks?.SessionStart?.length)
  failures.push('Claude plugin has no SessionStart hook');

if (failures.length) {
  console.error(`Distribution check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Codex, Cursor, Claude Code, and Claude Desktop metadata align at ${release.version}.`);
