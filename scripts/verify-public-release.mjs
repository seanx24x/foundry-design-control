import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const { version } = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));
const packageDirectories = [
  'apps/inspector',
  'packages/protocol',
  'packages/web-adapter',
  'packages/runtime',
  'packages/cli',
  'packages/mcp-server',
  'packages/react-native-adapter',
];
const packages = packageDirectories.map(
  (directory) => JSON.parse(readFileSync(join(root, directory, 'package.json'), 'utf8')).name,
);
const registry = 'https://registry.npmjs.org';
const tagsArgument = process.argv.find((argument) => argument.startsWith('--tags='));
const tags = (tagsArgument?.slice('--tags='.length) ?? 'beta').split(',').filter(Boolean);

function resolveVersion(spec) {
  const result = spawnSync('npm', ['view', spec, 'version', '--registry', registry], {
    cwd: root,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

let failures = [];
for (let attempt = 1; attempt <= 12; attempt += 1) {
  failures = [];
  for (const packageName of packages) {
    const immutable = resolveVersion(`${packageName}@${version}`);
    if (immutable !== version) {
      failures.push(`${packageName}@${version} is not public`);
      continue;
    }
    for (const tag of tags) {
      const tagged = resolveVersion(`${packageName}@${tag}`);
      if (tagged !== version)
        failures.push(`${packageName}@${tag} resolves to ${tagged ?? 'nothing'}`);
    }
  }
  if (!failures.length) break;
  if (attempt < 12) {
    console.log(`Waiting for npm registry metadata (${attempt}/12): ${failures.join(', ')}`);
    wait(10_000);
  }
}

if (failures.length) {
  console.error(`Public release verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `Verified all ${packages.length} public packages at ${version}; ${tags.join(' and ')} resolve to the immutable release.`,
);
