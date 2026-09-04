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
const registry = 'https://registry.npmjs.org';
const promoteLatest = process.argv.includes('--promote-latest');
const supportsProvenance = process.env.GITHUB_ACTIONS === 'true';

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
}

function published(packageName) {
  const result = run(
    'npm',
    ['view', `${packageName}@${version}`, 'version', '--registry', registry],
    { capture: true },
  );
  return result.status === 0 && result.stdout.trim() === version;
}

const packages = packageDirectories.map((directory) => ({
  directory,
  name: JSON.parse(readFileSync(join(root, directory, 'package.json'), 'utf8')).name,
}));

for (const entry of packages) {
  if (published(entry.name)) {
    console.log(`✓ ${entry.name}@${version} already exists; skipping immutable publication.`);
    continue;
  }
  const publishArgs = [
    '--dir',
    entry.directory,
    'publish',
    '--tag',
    'beta',
    '--no-git-checks',
  ];
  if (supportsProvenance) publishArgs.push('--provenance');
  const result = run('pnpm', publishArgs);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const missing = packages.filter((entry) => !published(entry.name));
if (missing.length) {
  console.error(`Publication incomplete: ${missing.map((entry) => entry.name).join(', ')}`);
  process.exit(1);
}

for (const entry of packages) {
  const tags = ['beta', ...(promoteLatest ? ['latest'] : [])];
  for (const tag of tags) {
    const result = run('npm', [
      'dist-tag',
      'add',
      `${entry.name}@${version}`,
      tag,
      '--registry',
      registry,
    ]);
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

console.log(
  `Published and verified ${packages.length} packages at ${version}; beta${promoteLatest ? ' and latest' : ''} now resolve to this release.`,
);
