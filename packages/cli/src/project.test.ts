import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { findProjectRoot, normalizeTargetUrl, resolveProjectRoot } from './project.js';

test('finds the nearest project from a nested working directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-root-'));
  const nested = join(root, 'src', 'features');
  await mkdir(nested, { recursive: true });
  await writeFile(join(root, 'package.json'), '{}\n');
  assert.equal(await findProjectRoot(nested), root);
  assert.equal(await resolveProjectRoot(nested, { home: join(root, 'not-home') }), root);
});

test('refuses to configure a home directory as a project', async () => {
  const home = await mkdtemp(join(tmpdir(), 'foundry-home-'));
  await mkdir(join(home, '.codex'), { recursive: true });
  await assert.rejects(resolveProjectRoot(home, { home }), /will not use your home folder/);
});

test('requires a recognizable project unless initialization is explicit', async () => {
  const empty = await mkdtemp(join(tmpdir(), 'foundry-empty-'));
  await assert.rejects(
    resolveProjectRoot(empty, { home: join(empty, 'not-home') }),
    /No project was found/,
  );
  assert.equal(
    await resolveProjectRoot(empty, { allowUninitialized: true, home: join(empty, 'not-home') }),
    empty,
  );
});

test('normalizes common local preview addresses', () => {
  assert.equal(normalizeTargetUrl('localhost:3000'), 'http://localhost:3000');
  assert.equal(normalizeTargetUrl('127.0.0.1:5173/'), 'http://127.0.0.1:5173');
  assert.equal(normalizeTargetUrl('https://example.com/preview/'), 'https://example.com/preview');
  assert.throws(() => normalizeTargetUrl('file:///tmp/index.html'), /must use http or https/);
});
