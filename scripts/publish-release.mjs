import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { assertPublicPackageMatches } from './public-package-archive.mjs';
import { verifyReleaseArtifacts } from './release-artifacts.mjs';

const root = resolve(import.meta.dirname, '..');
const registry = 'https://registry.npmjs.org';
const registryAttempts = 37;
const registryWaitMilliseconds = 10_000;
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

function registryState(entry, { allowIncomplete = false } = {}) {
  const spec = `${entry.name}@${entry.version}`;
  const result = run(
    'npm',
    [
      'view',
      spec,
      'name',
      'version',
      'dist.integrity',
      '--json',
      '--prefer-online',
      '--registry',
      registry,
    ],
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
  if (Array.isArray(metadata)) {
    if (metadata.length !== 1 || !metadata[0] || typeof metadata[0] !== 'object') {
      throw new Error(
        `npm returned an ambiguous metadata set for ${spec}: ${result.stdout.trim()}`,
      );
    }
    [metadata] = metadata;
  }
  const name = metadata.name;
  const version = metadata.version;
  const integrity = metadata['dist.integrity'] ?? metadata.dist?.integrity;
  if (name !== entry.name || version !== entry.version || typeof integrity !== 'string') {
    const message = `Public metadata for ${spec} is incomplete or has the wrong npm identity (${name}@${version}, ${integrity ?? 'no integrity'}).`;
    if (allowIncomplete) return { status: 'pending', message };
    throw new Error(message);
  }
  return { status: 'published', integrity };
}

function assertMatchingPublicIntegrity(entry, state) {
  if (state.status !== 'published') return;
  const result = assertPublicPackageMatches(root, entry, registry, state.integrity);
  if (result.match === 'content') {
    console.log(
      `✓ ${entry.name}@${entry.version} has different archive bytes but identical sealed package content; skipping immutable publication.`,
    );
  }
}

function waitForPublishedEntry(entry) {
  let lastPendingMessage = '';
  for (let attempt = 1; attempt <= registryAttempts; attempt += 1) {
    const state = registryState(entry, { allowIncomplete: true });
    assertMatchingPublicIntegrity(entry, state);
    if (state.status === 'published') return;
    if (state.status === 'pending') lastPendingMessage = state.message;
    if (attempt < registryAttempts) {
      console.log(
        `Waiting for npm to expose complete metadata for ${entry.name}@${entry.version} before continuing (${attempt}/${registryAttempts}).`,
      );
      wait(registryWaitMilliseconds);
    }
  }
  throw new Error(
    [
      `npm did not expose complete metadata for ${entry.name}@${entry.version}; refusing to publish packages that may depend on it.`,
      lastPendingMessage,
    ]
      .filter(Boolean)
      .join('\n'),
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
for (let attempt = 1; missing.length && attempt <= registryAttempts; attempt += 1) {
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
  if (missing.length && attempt < registryAttempts) {
    console.log(
      `Waiting for npm to expose the gated bytes for ${missing.map(({ name }) => name).join(', ')} (${attempt}/${registryAttempts}).`,
    );
    wait(registryWaitMilliseconds);
  }
}

if (missing.length) {
  console.error(`Publication incomplete: ${missing.map(({ name }) => name).join(', ')}`);
  process.exit(1);
}

console.log(
  `Published and integrity-verified ${manifest.packages.length} packages at ${manifest.releaseVersion}; beta is ready.`,
);
