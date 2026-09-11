import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { verifyReleaseArtifacts } from './release-artifacts.mjs';

const root = resolve(import.meta.dirname, '..');
const registry = 'https://registry.npmjs.org';
const supportsProvenance = process.env.GITHUB_ACTIONS === 'true';
const artifactDirectory = join(root, 'artifacts', 'npm');

if (process.argv.includes('--promote-latest')) {
  console.error(
    'release:publish no longer promotes latest. Verify the public beta, run the registry golden path, then run release:promote.',
  );
  process.exit(1);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
}

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function registryState(entry) {
  const spec = `${entry.name}@${entry.version}`;
  const result = run(
    'npm',
    ['view', spec, 'name', 'version', 'dist.integrity', '--json', '--registry', registry],
    { capture: true },
  );
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (/\bE404\b|404 Not Found|No match found for version/i.test(output)) {
      return { status: 'missing' };
    }
    throw new Error(`Could not safely inspect ${spec} before publication.\n${output.trim()}`);
  }

  let metadata;
  try {
    metadata = JSON.parse(result.stdout);
  } catch {
    throw new Error(`npm returned invalid metadata for ${spec}: ${result.stdout.trim()}`);
  }
  const name = metadata.name;
  const version = metadata.version;
  const integrity = metadata['dist.integrity'] ?? metadata.dist?.integrity;
  if (name !== entry.name || version !== entry.version || typeof integrity !== 'string') {
    throw new Error(
      `Public metadata for ${spec} is incomplete or has the wrong npm identity (${name}@${version}, ${integrity ?? 'no integrity'}).`,
    );
  }
  return { status: 'published', integrity };
}

function assertMatchingPublicIntegrity(entry, state) {
  if (state.status !== 'published') return;
  if (state.integrity !== entry.npmIntegrity) {
    throw new Error(
      [
        `Immutable package mismatch for ${entry.name}@${entry.version}.`,
        `Registry: ${state.integrity}`,
        `Gated tarball: ${entry.npmIntegrity}`,
        'Refusing to skip or overwrite a version whose bytes differ.',
      ].join('\n'),
    );
  }
}

function waitForPublishedEntry(entry) {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const state = registryState(entry);
    assertMatchingPublicIntegrity(entry, state);
    if (state.status === 'published') return;
    if (attempt < 12) {
      console.log(
        `Waiting for npm to expose ${entry.name}@${entry.version} before continuing (${attempt}/12).`,
      );
      wait(10_000);
    }
  }
  throw new Error(
    `npm did not expose ${entry.name}@${entry.version}; refusing to publish packages that may depend on it.`,
  );
}

let manifest;
try {
  manifest = verifyReleaseArtifacts(root, artifactDirectory);
} catch (error) {
  console.error(`Cannot publish: ${error.message}`);
  process.exit(1);
}

console.log(
  `Publishing only the ${manifest.packages.length} tarballs sealed by the ${manifest.releaseVersion} integrity manifest; no build or repack will run.`,
);

for (const entry of manifest.packages) {
  let state;
  try {
    state = registryState(entry);
    assertMatchingPublicIntegrity(entry, state);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  if (state.status === 'published') {
    console.log(
      `✓ ${entry.name}@${entry.version} already exists with the gated npm integrity; skipping immutable publication.`,
    );
  } else {
    const publishArgs = [
      'publish',
      join(artifactDirectory, entry.filename),
      '--tag',
      'beta',
      '--registry',
      registry,
    ];
    if (supportsProvenance) publishArgs.push('--provenance');
    const result = run('npm', publishArgs);
    if (result.status !== 0) process.exit(result.status ?? 1);
  }

  try {
    waitForPublishedEntry(entry);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

let missing = [...manifest.packages];
for (let attempt = 1; missing.length && attempt <= 12; attempt += 1) {
  const nextMissing = [];
  for (const entry of missing) {
    try {
      const state = registryState(entry);
      assertMatchingPublicIntegrity(entry, state);
      if (state.status === 'missing') nextMissing.push(entry);
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  }
  missing = nextMissing;
  if (missing.length && attempt < 12) {
    console.log(
      `Waiting for npm to expose the gated bytes for ${missing.map(({ name }) => name).join(', ')} (${attempt}/12).`,
    );
    wait(10_000);
  }
}

if (missing.length) {
  console.error(`Publication incomplete: ${missing.map(({ name }) => name).join(', ')}`);
  process.exit(1);
}

console.log(
  `Published and integrity-verified ${manifest.packages.length} packages at ${manifest.releaseVersion}; beta is ready.`,
);
