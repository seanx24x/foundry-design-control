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
const tarballAttempts = 37;
const tarballWaitMilliseconds = 10_000;
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

function inspectPublicTarball(packageName) {
  const spec = `${packageName}@${version}`;
  const result = spawnSync(
    'npm',
    [
      'pack',
      spec,
      '--dry-run',
      '--json',
      '--ignore-scripts',
      '--prefer-online',
      '--registry',
      registry,
    ],
    {
      cwd: root,
      encoding: 'utf8',
    },
  );
  if (result.status !== 0) return undefined;

  try {
    const output = JSON.parse(result.stdout);
    const entry = Array.isArray(output) ? output[0] : output;
    if (entry?.name === packageName && entry?.version === version) return entry;
  } catch {
    return undefined;
  }
  return undefined;
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

let unavailableTarballs = [...packages];
for (let attempt = 1; attempt <= tarballAttempts; attempt += 1) {
  unavailableTarballs = unavailableTarballs.filter(
    (packageName) => !inspectPublicTarball(packageName),
  );
  if (!unavailableTarballs.length) break;
  if (attempt < tarballAttempts) {
    console.log(
      `Waiting for npm package archives (${attempt}/${tarballAttempts}): ${unavailableTarballs.join(', ')}`,
    );
    wait(tarballWaitMilliseconds);
  }
}

if (unavailableTarballs.length) {
  console.error(
    `Public package archives are not downloadable:\n- ${unavailableTarballs.join('\n- ')}`,
  );
  process.exit(1);
}

const tagSummary = tags.length === 1 ? `${tags[0]} resolves` : `${tags.join(' and ')} resolve`;
console.log(
  `Verified all ${packages.length} public packages and downloadable archives at ${version}; ${tagSummary} to the immutable release.`,
);
