import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const release = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));
const source = join(root, 'plugins', 'foundry-design-control');
const output = join(root, 'artifacts', 'openai');
const plugin = join(output, 'foundry-design-control');
const skill = join(source, 'skills', 'foundry-design-control');

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(source, plugin, { recursive: true });

for (const path of [
  '.mcp.json',
  'mcp.json',
  '.claude-plugin',
  '.cursor-plugin',
  'commands',
  'hooks',
  'scripts/claude-session-start.mjs',
  'scripts/cursor-session-start.mjs',
]) {
  rmSync(join(plugin, path), { recursive: true, force: true });
}

const manifestPath = join(plugin, '.codex-plugin', 'plugin.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
delete manifest.mcpServers;
manifest.description =
  'Start and operate Foundry’s local visual design workflow for reviewed, source-mapped interface changes.';
manifest.interface.capabilities = ['Interactive'];
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const skillZip = join(output, `foundry-design-control-openai-skill-${release.version}.zip`);
const pluginZip = join(output, `foundry-design-control-openai-plugin-${release.version}.zip`);

execFileSync('zip', ['-q', '-r', skillZip, 'foundry-design-control'], {
  cwd: join(source, 'skills'),
});
execFileSync('zip', ['-q', '-r', pluginZip, 'foundry-design-control'], {
  cwd: output,
});

console.log(`OpenAI submission artifacts created for ${release.version}:`);
console.log(`- ${skillZip}`);
console.log(`- ${pluginZip}`);
