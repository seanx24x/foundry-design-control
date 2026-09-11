import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { verifyReleaseArtifacts } from './release-artifacts.mjs';

const root = resolve(import.meta.dirname, '..');
const registry = 'https://registry.npmjs.org';
const artifactDirectory = join(root, 'artifacts', 'npm');
const tagArgument = process.argv.find((argument) => argument.startsWith('--tag='));
const targetTag = tagArgument?.slice('--tag='.length) || 'latest';

if (!['beta', 'latest'].includes(targetTag)) {
  console.error(`Unsupported release tag ${targetTag}; expected beta or latest.`);
  process.exit(1);
}

function run(commandArgs, capture = false) {
  return spawnSync('npm', commandArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
}

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function missingMetadata(output) {
  return /\bE404\b|404 Not Found|No match found for version|No dist-tag found/i.test(output);
}

function resolveVersion(spec) {
  const result = run(['view', spec, 'version', '--registry', registry], true);
  if (result.status === 0) return result.stdout.trim();
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (missingMetadata(output)) return undefined;
  throw new Error(`Could not safely resolve ${spec}.\n${output.trim()}`);
}

function registryState(entry) {
  const spec = `${entry.name}@${entry.version}`;
  const result = run(
    ['view', spec, 'name', 'version', 'dist.integrity', '--json', '--registry', registry],
    true,
  );
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (missingMetadata(output)) return { status: 'missing' };
    throw new Error(`Could not safely inspect ${spec}.\n${output.trim()}`);
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
  return {
    status: 'published',
    name: metadata.name,
    version: metadata.version,
    integrity: metadata['dist.integrity'] ?? metadata.dist?.integrity,
  };
}

function waitForTag(packages, tag, required = true) {
  let failures = [];
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    failures = packages.filter((entry) => resolveVersion(`${entry.name}@${tag}`) !== entry.version);
    if (!failures.length) return failures;
    if (attempt < 12) {
      console.log(
        `Waiting for npm ${tag} metadata (${attempt}/12): ${failures.map(({ name }) => name).join(', ')}.`,
      );
      wait(10_000);
    }
  }
  if (!required) return failures;
  throw new Error(
    `${tag} tag promotion did not converge for: ${failures.map(({ name }) => name).join(', ')}.`,
  );
}

try {
  const manifest = verifyReleaseArtifacts(root, artifactDirectory);
  for (const entry of manifest.packages) {
    const state = registryState(entry);
    if (
      state.status !== 'published' ||
      state.name !== entry.name ||
      state.version !== entry.version ||
      state.integrity !== entry.npmIntegrity
    ) {
      throw new Error(
        `Refusing to move ${targetTag}: ${entry.name}@${entry.version} does not match the gated tarball in the public registry.`,
      );
    }
  }

  if (targetTag === 'latest') {
    const unavailable = manifest.packages.filter(
      (entry) => resolveVersion(`${entry.name}@beta`) !== entry.version,
    );
    if (unavailable.length) {
      throw new Error(
        `Refusing to move latest before beta is complete for: ${unavailable.map(({ name }) => name).join(', ')}.`,
      );
    }
  }

  let pending = manifest.packages.filter(
    (entry) => resolveVersion(`${entry.name}@${targetTag}`) !== entry.version,
  );
  if (targetTag === 'beta' && pending.length) {
    pending = waitForTag(manifest.packages, targetTag, false);
  }
  if (!pending.length) {
    console.log(
      `${targetTag} already resolves all ${manifest.packages.length} packages to ${manifest.releaseVersion}.`,
    );
    process.exit(0);
  }

  if (process.env.GITHUB_ACTIONS === 'true' && !process.env.NODE_AUTH_TOKEN) {
    throw new Error(
      `Moving ${targetTag} from GitHub Actions requires NODE_AUTH_TOKEN; trusted publishing only authorizes immutable publication.`,
    );
  }

  for (const entry of pending) {
    const result = run([
      'dist-tag',
      'add',
      `${entry.name}@${entry.version}`,
      targetTag,
      '--registry',
      registry,
    ]);
    if (result.status !== 0) process.exit(result.status ?? 1);
  }

  waitForTag(manifest.packages, targetTag);
  if (targetTag === 'latest') waitForTag(manifest.packages, 'beta');
  console.log(
    `Converged ${targetTag} for all ${manifest.packages.length} packages at ${manifest.releaseVersion}${targetTag === 'latest' ? '; beta is unchanged' : ''}.`,
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
