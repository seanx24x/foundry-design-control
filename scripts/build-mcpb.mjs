import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'extensions', 'claude-desktop');
const stage = join(root, 'artifacts', 'mcpb', 'foundry-design-control');
const output = join(root, 'artifacts', 'mcpb');
const release = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, 'server'), { recursive: true });
const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
manifest.version = release.version;
writeFileSync(join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
cpSync(join(source, 'README.md'), join(stage, 'README.md'));

const bundled = spawnSync(
  'pnpm',
  [
    'exec',
    'esbuild',
    'packages/mcp-server/src/index.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${join(stage, 'server', 'index.js')}`,
  ],
  { cwd: root, stdio: 'inherit' },
);
if (bundled.status !== 0) process.exit(bundled.status ?? 1);

const validated = spawnSync(
  'npx',
  ['--yes', '@anthropic-ai/mcpb', 'validate', join(stage, 'manifest.json')],
  {
    cwd: root,
    stdio: 'inherit',
  },
);
if (validated.status !== 0) process.exit(validated.status ?? 1);
const bundlePath = join(output, `foundry-design-control-${release.version}.mcpb`);
const packed = spawnSync('npx', ['--yes', '@anthropic-ai/mcpb', 'pack', stage, bundlePath], {
  cwd: root,
  stdio: 'inherit',
});
if (packed.status !== 0) process.exit(packed.status ?? 1);
console.log(`Created ${bundlePath}`);
