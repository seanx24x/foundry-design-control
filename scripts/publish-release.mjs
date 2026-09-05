import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
const artifactDirectory = join(root, 'artifacts', 'npm');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? root,
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

// Never publish source metadata with stale compiled artifacts. Package manifests
// are cheap to update, so the release command itself must rebuild and validate
// the exact files that npm will receive before it mutates the registry.
for (const [command, args, label] of [
  ['pnpm', ['build'], 'release build'],
  ['pnpm', ['release:check'], 'release metadata check'],
  ['pnpm', ['release:pack'], 'release package build'],
  ['pnpm', ['distribution:check'], 'agent distribution check'],
]) {
  const result = run(command, args);
  if (result.status !== 0) {
    console.error(`Cannot publish: ${label} failed.`);
    process.exit(result.status ?? 1);
  }
}

for (const entry of packages) {
  if (published(entry.name)) {
    console.log(`✓ ${entry.name}@${version} already exists; skipping immutable publication.`);
    continue;
  }
  const tarball = join(artifactDirectory, `${entry.name}-${version}.tgz`);
  if (!existsSync(tarball)) {
    console.error(`Cannot publish: missing ${tarball}.`);
    process.exit(1);
  }
  const publishArgs = ['publish', tarball, '--tag', 'beta', '--registry', registry];
  if (supportsProvenance) publishArgs.push('--provenance');
  const result = run('npm', publishArgs);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const missing = packages.filter((entry) => !published(entry.name));
if (missing.length) {
  console.error(`Publication incomplete: ${missing.map((entry) => entry.name).join(', ')}`);
  process.exit(1);
}

if (promoteLatest && supportsProvenance && !process.env.NODE_AUTH_TOKEN) {
  console.error(
    'All packages were published under beta with trusted publishing. Moving latest requires an npm token because OIDC currently authorizes publish, not dist-tag changes. Re-run with NODE_AUTH_TOKEN or promote latest in npm.',
  );
  process.exit(1);
}

for (const entry of packages) {
  const tags = promoteLatest ? ['latest'] : [];
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
