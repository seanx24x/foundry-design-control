import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertPackedPackageJsonMatches,
  captureReleaseSourceState,
  expectedPackedPackageJson,
} from './release-artifacts.mjs';

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
