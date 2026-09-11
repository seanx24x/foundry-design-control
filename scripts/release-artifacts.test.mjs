import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';
import {
  assertPackedPackageJsonMatches,
  canonicalTarballContentSha256,
  captureReleaseSourceState,
  expectedPackedPackageJson,
} from './release-artifacts.mjs';
import { normalizeNpmPackMetadata } from './public-package-archive.mjs';

const require = createRequire(import.meta.url);
const { sortDependencyMaps } = require('../.pnpmfile.cjs');
const tarOptions = { env: { ...process.env, COPYFILE_DISABLE: '1' }, stdio: 'pipe' };

test('canonical tarball content ignores JSON object order but preserves files and modes', () => {
  const root = mkdtempSync(join(tmpdir(), 'foundry-canonical-tarball-'));
  const firstRoot = join(root, 'first');
  const secondRoot = join(root, 'second');
  const firstPackage = join(firstRoot, 'package');
  const secondPackage = join(secondRoot, 'package');
  const firstTarball = join(root, 'first.tgz');
  const secondTarball = join(root, 'second.tgz');
  try {
    mkdirSync(firstPackage, { recursive: true });
    mkdirSync(secondPackage, { recursive: true });
    writeFileSync(
      join(firstPackage, 'package.json'),
      '{"name":"example","version":"1.0.0","dependencies":{"alpha":"1","beta":"1"},"exports":{".":{"import":"./index.js","default":"./index.js"}}}\n',
    );
    writeFileSync(
      join(secondPackage, 'package.json'),
      '{"exports":{".":{"import":"./index.js","default":"./index.js"}},"dependencies":{"beta":"1","alpha":"1"},"version":"1.0.0","name":"example"}\n',
    );
    writeFileSync(join(firstPackage, 'index.js'), 'export const value = 1;\n');
    writeFileSync(join(secondPackage, 'index.js'), 'export const value = 1;\n');

    const pack = (directory, output) =>
      execFileSync(
        'tar',
        ['--format', 'ustar', '-czf', output, '-C', directory, 'package'],
        tarOptions,
      );
    pack(firstRoot, firstTarball);
    pack(secondRoot, secondTarball);
    assert.equal(
      canonicalTarballContentSha256(firstTarball),
      canonicalTarballContentSha256(secondTarball),
    );

    writeFileSync(
      join(secondPackage, 'package.json'),
      '{"name":"example","version":"1.0.0","dependencies":{"alpha":"1","beta":"1"},"exports":{".":{"default":"./index.js","import":"./index.js"}}}\n',
    );
    pack(secondRoot, secondTarball);
    assert.notEqual(
      canonicalTarballContentSha256(firstTarball),
      canonicalTarballContentSha256(secondTarball),
    );

    writeFileSync(
      join(secondPackage, 'package.json'),
      '{"name":"example","version":"1.0.0","dependencies":{"alpha":"1","beta":"1"},"exports":{".":{"import":"./index.js","default":"./index.js"}}}\n',
    );
    writeFileSync(join(secondPackage, 'index.js'), 'export const value = 2;\n');
    pack(secondRoot, secondTarball);
    assert.notEqual(
      canonicalTarballContentSha256(firstTarball),
      canonicalTarballContentSha256(secondTarball),
    );

    writeFileSync(join(secondPackage, 'index.js'), 'export const value = 1;\n');
    chmodSync(join(secondPackage, 'index.js'), 0o755);
    pack(secondRoot, secondTarball);
    assert.notEqual(
      canonicalTarballContentSha256(firstTarball),
      canonicalTarballContentSha256(secondTarball),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('canonical tarball validation rejects corrupt and unsupported archives', () => {
  const root = mkdtempSync(join(tmpdir(), 'foundry-invalid-tarball-'));
  const packageRoot = join(root, 'package');
  const validTarball = join(root, 'valid.tgz');
  const corruptTarball = join(root, 'corrupt.tgz');
  const unsupportedTarball = join(root, 'unsupported.tgz');
  const duplicateTarball = join(root, 'duplicate.tgz');
  try {
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(join(packageRoot, 'package.json'), '{"name":"example","version":"1.0.0"}\n');
    execFileSync(
      'tar',
      ['--format', 'ustar', '-czf', validTarball, '-C', root, 'package'],
      tarOptions,
    );

    const corruptArchive = gunzipSync(readFileSync(validTarball));
    corruptArchive[0] ^= 1;
    writeFileSync(corruptTarball, gzipSync(corruptArchive));
    assert.throws(() => canonicalTarballContentSha256(corruptTarball), /checksum/);

    const unsupportedArchive = gunzipSync(readFileSync(validTarball));
    unsupportedArchive[156] = 'x'.charCodeAt(0);
    unsupportedArchive.fill(32, 148, 156);
    let checksum = 0;
    for (const byte of unsupportedArchive.subarray(0, 512)) checksum += byte;
    const checksumText = `${checksum.toString(8).padStart(6, '0')}\0 `;
    unsupportedArchive.write(checksumText, 148, 8, 'ascii');
    writeFileSync(unsupportedTarball, gzipSync(unsupportedArchive));
    assert.throws(
      () => canonicalTarballContentSha256(unsupportedTarball),
      /Unsupported tar entry type/,
    );

    execFileSync(
      'tar',
      [
        '--format',
        'ustar',
        '-czf',
        duplicateTarball,
        '-C',
        root,
        'package/package.json',
        'package/package.json',
      ],
      tarOptions,
    );
    assert.throws(() => canonicalTarballContentSha256(duplicateTarball), /Duplicate tar entry/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the pnpm packing hook sorts only dependency maps', () => {
  const manifest = {
    name: 'example',
    dependencies: { zebra: '1', alpha: '1' },
    peerDependencies: { gamma: '1', beta: '1' },
    exports: { '.': { import: './import.js', default: './default.js' } },
  };
  const result = sortDependencyMaps(manifest);
  assert.deepEqual(Object.keys(result.dependencies), ['alpha', 'zebra']);
  assert.deepEqual(Object.keys(result.peerDependencies), ['beta', 'gamma']);
  assert.deepEqual(Object.keys(result.exports['.']), ['import', 'default']);
});

test('npm pack metadata accepts npm 11 arrays and npm 12 objects without ambiguity', () => {
  const result = { name: 'example', version: '1.0.0' };
  assert.equal(normalizeNpmPackMetadata([result], 'example@1.0.0', 'example'), result);
  assert.equal(normalizeNpmPackMetadata(result, 'example@1.0.0', 'example'), result);
  assert.equal(normalizeNpmPackMetadata({ example: result }, 'example@1.0.0', 'example'), result);
  assert.throws(
    () => normalizeNpmPackMetadata([], 'example@1.0.0', 'example'),
    /ambiguous public archive set/,
  );
  assert.throws(
    () => normalizeNpmPackMetadata([result, result], 'example@1.0.0', 'example'),
    /ambiguous public archive set/,
  );
  assert.throws(
    () => normalizeNpmPackMetadata({ unexpected: result }, 'example@1.0.0', 'example'),
    /ambiguous public archive set/,
  );
  assert.throws(
    () => normalizeNpmPackMetadata('unexpected', 'example@1.0.0', 'example'),
    /ambiguous public archive set/,
  );
});

test('packed package metadata must match current source metadata and release workspace versions', () => {
  const source = {
    name: 'example-runtime',
    version: '1.2.3-beta.4',
    scripts: { build: 'tsc' },
    dependencies: {
      'example-protocol': 'workspace:*',
      external: '^2.0.0',
    },
  };
  const releasePackages = new Map([
    ['example-runtime', { name: 'example-runtime', version: source.version }],
    ['example-protocol', { name: 'example-protocol', version: source.version }],
  ]);
  const expected = expectedPackedPackageJson(source, releasePackages);
  assert.equal(expected.dependencies['example-protocol'], source.version);
  assert.doesNotThrow(() => assertPackedPackageJsonMatches(source, expected, releasePackages));
  assert.throws(
    () =>
      assertPackedPackageJsonMatches(
        source,
        { ...expected, dependencies: { external: '^2.0.0' } },
        releasePackages,
      ),
    /does not match the current source manifest/,
  );
  assert.throws(
    () =>
      assertPackedPackageJsonMatches(
        source,
        JSON.parse(
          '{"name":"example-runtime","version":"1.2.3-beta.4","scripts":{"build":"tsc"},"dependencies":{"example-protocol":"1.2.3-beta.4","external":"^2.0.0"},"__proto__":{"unexpected":true}}',
        ),
        releasePackages,
      ),
    /does not match the current source manifest/,
  );
});

test('release source state binds the commit and all non-ignored working-tree files', () => {
  const root = mkdtempSync(join(tmpdir(), 'foundry-release-source-state-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  try {
    writeFileSync(join(root, '.gitignore'), 'artifacts/\n');
    writeFileSync(join(root, 'source.txt'), 'one\n');
    git('init', '--quiet');
    git('config', 'user.name', 'Foundry Release Test');
    git('config', 'user.email', 'release-test@example.invalid');
    git('add', '.');
    git('commit', '--quiet', '-m', 'initial');

    const initial = captureReleaseSourceState(root);
    writeFileSync(join(root, 'source.txt'), 'two\n');
    const modified = captureReleaseSourceState(root);
    assert.equal(modified.commit, initial.commit);
    assert.notEqual(modified.sha256, initial.sha256);

    writeFileSync(join(root, 'source.txt'), 'one\n');
    writeFileSync(join(root, 'new-source.txt'), 'new\n');
    const untracked = captureReleaseSourceState(root);
    assert.notEqual(untracked.sha256, initial.sha256);

    rmSync(join(root, 'new-source.txt'));
    mkdirSync(join(root, 'artifacts'));
    writeFileSync(join(root, 'artifacts', 'ignored.tgz'), 'ignored\n');
    assert.deepEqual(captureReleaseSourceState(root), initial);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
