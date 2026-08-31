import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'artifacts/npm');
const packageDirectories = [
  'apps/inspector',
  'packages/protocol',
  'packages/web-adapter',
  'packages/runtime',
  'packages/cli',
  'packages/mcp-server',
  'packages/react-native-adapter',
];

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const directory of packageDirectories) {
  const result = spawnSync('pnpm', ['pack', '--pack-destination', output], {
    cwd: resolve(root, directory),
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const tarballs = readdirSync(output).filter((name) => name.endsWith('.tgz'));
if (tarballs.length !== packageDirectories.length) {
  console.error(`Expected ${packageDirectories.length} tarballs, found ${tarballs.length}.`);
  process.exit(1);
}
console.log(`Packed ${tarballs.length} beta packages into ${output}.`);
