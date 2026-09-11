import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

export const RELEASE_PACKAGE_DIRECTORIES = [
  'packages/protocol',
  'apps/inspector',
  'packages/web-adapter',
  'packages/runtime',
  'packages/mcp-server',
  'packages/cli',
  'packages/react-native-adapter',
];

export const RELEASE_ARTIFACT_COUNT = 7;
export const RELEASE_INTEGRITY_MANIFEST = 'release-integrity.json';
export const RELEASE_INTEGRITY_SCHEMA_VERSION = 2;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function runGit(root, args, encoding = 'utf8') {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    throw new Error(`Cannot inspect release source with git ${args.join(' ')}: ${output}`);
  }
  return result.stdout;
}

function updateDigestSegment(digest, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  digest.update(`${bytes.length}:`);
  digest.update(bytes);
}

export function captureReleaseSourceState(root) {
  const commit = runGit(root, ['rev-parse', 'HEAD']).trim();
  const listed = runGit(
    root,
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    null,
  );
  const paths = listed
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  const digest = createHash('sha256');
  updateDigestSegment(digest, commit);
  for (const path of paths) {
    updateDigestSegment(digest, path);
    const absolute = join(root, path);
    if (!existsSync(absolute)) {
      updateDigestSegment(digest, 'missing');
      continue;
    }
    const metadata = lstatSync(absolute);
    updateDigestSegment(digest, metadata.mode.toString(8));
    if (metadata.isSymbolicLink()) {
      updateDigestSegment(digest, 'symlink');
      updateDigestSegment(digest, readlinkSync(absolute));
    } else if (metadata.isFile()) {
      updateDigestSegment(digest, 'file');
      updateDigestSegment(digest, readFileSync(absolute));
    } else {
      updateDigestSegment(digest, 'other');
    }
  }
  return { commit, sha256: digest.digest('hex'), fileCount: paths.length };
}

function resolveWorkspaceSpec(spec, dependencyName, releasePackages) {
  if (typeof spec !== 'string' || !spec.startsWith('workspace:')) return spec;
  const releasePackage = releasePackages.get(dependencyName);
  if (!releasePackage) {
    throw new Error(`Workspace dependency ${dependencyName} is not one of the release packages.`);
  }
  const range = spec.slice('workspace:'.length);
  if (range === '*') return releasePackage.version;
  if (range === '^') return `^${releasePackage.version}`;
  if (range === '~') return `~${releasePackage.version}`;
  return range;
}

export function expectedPackedPackageJson(sourcePackageJson, releasePackages) {
  const expected = structuredClone(sourcePackageJson);
  for (const section of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    if (!expected[section]) continue;
    for (const [name, spec] of Object.entries(expected[section])) {
      expected[section][name] = resolveWorkspaceSpec(spec, name, releasePackages);
    }
  }
  return expected;
}

export function assertPackedPackageJsonMatches(
  sourcePackageJson,
  packedPackageJson,
  releasePackages,
) {
  const expected = expectedPackedPackageJson(sourcePackageJson, releasePackages);
  if (stableJson(packedPackageJson) !== stableJson(expected)) {
    throw new Error(
      `${sourcePackageJson.name}@${sourcePackageJson.version} tarball package.json does not match the current source manifest. Rebuild and repack this release.`,
    );
  }
}

function readTarPackageJson(tarballPath) {
  const archive = gunzipSync(readFileSync(tarballPath));
  let offset = 0;

  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const path = prefix ? `${prefix}/${name}` : name;
    const sizeText = header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim();
    const size = Number.parseInt(sizeText || '0', 8);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error(`Invalid tar entry size in ${tarballPath}.`);
    }

    const contentStart = offset + 512;
    if (path === 'package/package.json') {
      return JSON.parse(archive.subarray(contentStart, contentStart + size).toString('utf8'));
    }
    offset = contentStart + Math.ceil(size / 512) * 512;
  }

  throw new Error(`${tarballPath} does not contain package/package.json.`);
}

function expectedTarballFilename(packageName, version) {
  return `${packageName.replace(/^@/, '').replaceAll('/', '-')}-${version}.tgz`;
}

function inspectTarball(tarballPath) {
  const bytes = readFileSync(tarballPath);
  const digest = createHash('sha512').update(bytes).digest();
  const packageJson = readTarPackageJson(tarballPath);
  return {
    packageJson,
    size: bytes.length,
    sha512: digest.toString('hex'),
    npmIntegrity: `sha512-${digest.toString('base64')}`,
  };
}

export function releasePackageDefinitions(root) {
  const release = readJson(join(root, 'release.json'));
  if (release.packageCount !== RELEASE_ARTIFACT_COUNT) {
    throw new Error(
      `release.json must declare exactly ${RELEASE_ARTIFACT_COUNT} packages, not ${release.packageCount}.`,
    );
  }

  const packages = RELEASE_PACKAGE_DIRECTORIES.map((directory) => {
    const packageJsonPath = join(root, directory, 'package.json');
    const packageJsonBytes = readFileSync(packageJsonPath);
    const packageJson = JSON.parse(packageJsonBytes);
    if (packageJson.version !== release.version) {
      throw new Error(
        `${packageJson.name} is ${packageJson.version}; expected release version ${release.version}.`,
      );
    }
    return {
      directory,
      name: packageJson.name,
      version: packageJson.version,
      filename: expectedTarballFilename(packageJson.name, packageJson.version),
      packageJson,
      sourcePackageJsonSha256: sha256(packageJsonBytes),
    };
  });

  if (new Set(packages.map(({ name }) => name)).size !== RELEASE_ARTIFACT_COUNT) {
    throw new Error('Release package identities must be unique.');
  }

  return { release, packages };
}

export function writeReleaseIntegrityManifest(root, artifactDirectory) {
  const { release, packages } = releasePackageDefinitions(root);
  const releasePackages = new Map(packages.map((entry) => [entry.name, entry]));
  const sourceState = captureReleaseSourceState(root);
  const entries = packages.map((expected) => {
    const tarballPath = join(artifactDirectory, expected.filename);
    if (!existsSync(tarballPath)) throw new Error(`Missing release tarball ${expected.filename}.`);
    const inspected = inspectTarball(tarballPath);
    if (
      inspected.packageJson.name !== expected.name ||
      inspected.packageJson.version !== expected.version
    ) {
      throw new Error(
        `${expected.filename} contains ${inspected.packageJson.name}@${inspected.packageJson.version}; expected ${expected.name}@${expected.version}.`,
      );
    }
    assertPackedPackageJsonMatches(expected.packageJson, inspected.packageJson, releasePackages);
    return {
      directory: expected.directory,
      name: expected.name,
      version: expected.version,
      filename: expected.filename,
      sourcePackageJsonSha256: expected.sourcePackageJsonSha256,
      packedPackageJsonSha256: sha256(stableJson(inspected.packageJson)),
      size: inspected.size,
      sha512: inspected.sha512,
      npmIntegrity: inspected.npmIntegrity,
    };
  });

  const manifest = {
    schemaVersion: RELEASE_INTEGRITY_SCHEMA_VERSION,
    releaseVersion: release.version,
    sourceCommit: sourceState.commit,
    sourceStateSha256: sourceState.sha256,
    sourceFileCount: sourceState.fileCount,
    packageCount: RELEASE_ARTIFACT_COUNT,
    packages: entries,
  };
  writeFileSync(
    join(artifactDirectory, RELEASE_INTEGRITY_MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

export function verifyReleaseArtifacts(root, artifactDirectory) {
  const manifestPath = join(artifactDirectory, RELEASE_INTEGRITY_MANIFEST);
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Missing ${RELEASE_INTEGRITY_MANIFEST}. Run pnpm release:pack and preserve its artifacts.`,
    );
  }

  const { release, packages: expectedPackages } = releasePackageDefinitions(root);
  const releasePackages = new Map(expectedPackages.map((entry) => [entry.name, entry]));
  const manifest = readJson(manifestPath);
  if (manifest.schemaVersion !== RELEASE_INTEGRITY_SCHEMA_VERSION) {
    throw new Error(`Unsupported release integrity schema ${manifest.schemaVersion}.`);
  }
  if (manifest.releaseVersion !== release.version) {
    throw new Error(
      `Integrity manifest is for ${manifest.releaseVersion}; this release is ${release.version}.`,
    );
  }
  const sourceState = captureReleaseSourceState(root);
  if (
    manifest.sourceCommit !== sourceState.commit ||
    manifest.sourceStateSha256 !== sourceState.sha256 ||
    manifest.sourceFileCount !== sourceState.fileCount
  ) {
    throw new Error(
      `Release source changed after ${RELEASE_INTEGRITY_MANIFEST} was created. Rebuild and repack before publishing.`,
    );
  }
  if (
    manifest.packageCount !== RELEASE_ARTIFACT_COUNT ||
    !Array.isArray(manifest.packages) ||
    manifest.packages.length !== RELEASE_ARTIFACT_COUNT
  ) {
    throw new Error(`Integrity manifest must cover exactly ${RELEASE_ARTIFACT_COUNT} packages.`);
  }

  const expectedFiles = [
    RELEASE_INTEGRITY_MANIFEST,
    ...expectedPackages.map(({ filename }) => filename),
  ].sort();
  const actualFiles = readdirSync(artifactDirectory).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    const missing = expectedFiles.filter((name) => !actualFiles.includes(name));
    const extra = actualFiles.filter((name) => !expectedFiles.includes(name));
    throw new Error(
      [
        'Release artifact set does not match the gated manifest.',
        missing.length ? `Missing: ${missing.join(', ')}` : undefined,
        extra.length ? `Extra: ${extra.join(', ')}` : undefined,
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  for (const [index, expected] of expectedPackages.entries()) {
    const entry = manifest.packages[index];
    for (const key of ['directory', 'name', 'version', 'filename', 'sourcePackageJsonSha256']) {
      if (entry[key] !== expected[key]) {
        throw new Error(
          `Integrity manifest package ${index + 1} has ${key}=${entry[key]}; expected ${expected[key]}.`,
        );
      }
    }

    const tarballPath = join(artifactDirectory, entry.filename);
    if (!statSync(tarballPath).isFile()) throw new Error(`${entry.filename} is not a file.`);
    const inspected = inspectTarball(tarballPath);
    if (
      inspected.packageJson.name !== entry.name ||
      inspected.packageJson.version !== entry.version
    ) {
      throw new Error(
        `${entry.filename} npm identity changed to ${inspected.packageJson.name}@${inspected.packageJson.version}.`,
      );
    }
    assertPackedPackageJsonMatches(expected.packageJson, inspected.packageJson, releasePackages);
    if (entry.packedPackageJsonSha256 !== sha256(stableJson(inspected.packageJson))) {
      throw new Error(`${entry.filename} failed its packed package.json integrity check.`);
    }
    for (const key of ['size', 'sha512', 'npmIntegrity']) {
      if (entry[key] !== inspected[key]) {
        throw new Error(`${entry.filename} failed its ${key} integrity check.`);
      }
    }
  }

  return manifest;
}
