import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertPackedPackageJsonMatches,
  inspectReleaseTarball,
  releasePackageDefinitions,
} from './release-artifacts.mjs';

const successfulMatches = new Set();

export function normalizeNpmPackMetadata(metadata, spec, expectedName) {
  let packed;
  if (Array.isArray(metadata)) {
    if (metadata.length === 1) [packed] = metadata;
  } else if (metadata && typeof metadata === 'object') {
    if (typeof metadata.name === 'string') {
      packed = metadata;
    } else {
      const keys = Object.keys(metadata);
      if (keys.length === 1 && keys[0] === expectedName) packed = metadata[keys[0]];
    }
  }
  if (!packed || typeof packed !== 'object' || Array.isArray(packed)) {
    throw new Error(`npm returned an ambiguous public archive set for ${spec}.`);
  }
  return packed;
}

export function assertPublicPackageMatches(root, entry, registry, registryIntegrity) {
  if (registryIntegrity === entry.npmIntegrity) return { match: 'integrity' };

  const cacheKey = `${entry.name}@${entry.version}:${registryIntegrity}:${entry.contentSha256}`;
  if (successfulMatches.has(cacheKey)) return { match: 'content' };

  const spec = `${entry.name}@${entry.version}`;
  const directory = mkdtempSync(join(tmpdir(), 'foundry-public-package-'));
  try {
    const result = spawnSync(
      'npm',
      [
        'pack',
        spec,
        '--json',
        '--ignore-scripts',
        '--prefer-online',
        '--registry',
        registry,
        '--pack-destination',
        directory,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: 'pipe',
      },
    );
    if (result.status !== 0) {
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
      throw new Error(`Could not inspect the public archive for ${spec}.\n${output}`);
    }

    let metadata;
    try {
      metadata = JSON.parse(result.stdout);
    } catch {
      throw new Error(`npm returned invalid archive metadata for ${spec}: ${result.stdout.trim()}`);
    }
    const packed = normalizeNpmPackMetadata(metadata, spec, entry.name);
    if (
      packed?.name !== entry.name ||
      packed?.version !== entry.version ||
      packed?.filename !== entry.filename ||
      packed?.integrity !== registryIntegrity
    ) {
      throw new Error(
        `npm returned untrusted public archive metadata for ${spec}: ${packed?.name ?? 'unknown'}@${packed?.version ?? 'unknown'}, ${packed?.filename ?? 'no filename'}, ${packed?.integrity ?? 'no integrity'}.`,
      );
    }

    const inspected = inspectReleaseTarball(join(directory, packed.filename));
    if (
      inspected.packageJson.name !== entry.name ||
      inspected.packageJson.version !== entry.version ||
      inspected.npmIntegrity !== registryIntegrity
    ) {
      throw new Error(`The downloaded public archive for ${spec} does not match npm metadata.`);
    }

    const { packages } = releasePackageDefinitions(root);
    const expected = packages.find(
      ({ name, version }) => name === entry.name && version === entry.version,
    );
    if (!expected) throw new Error(`${spec} is not part of the current Foundry release.`);
    const releasePackages = new Map(
      packages.map((releaseEntry) => [releaseEntry.name, releaseEntry]),
    );
    assertPackedPackageJsonMatches(expected.packageJson, inspected.packageJson, releasePackages);

    if (inspected.contentSha256 !== entry.contentSha256) {
      throw new Error(
        [
          `Immutable package mismatch for ${spec}.`,
          `Registry: ${registryIntegrity}`,
          `Gated tarball: ${entry.npmIntegrity}`,
          `Registry content: ${inspected.contentSha256}`,
          `Gated content: ${entry.contentSha256}`,
          'Refusing to skip, tag, or overwrite a version whose package content differs.',
        ].join('\n'),
      );
    }

    successfulMatches.add(cacheKey);
    return { match: 'content' };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
