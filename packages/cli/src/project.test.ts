import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { addSessionParams, detectPlatform } from './project.js';

test('detects React Native before generic web projects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-project-'));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ dependencies: { 'react-native': '0.83.0' } }),
  );
  assert.equal(await detectPlatform(root), 'react-native');
});

test('adds session credentials without losing an existing query', () => {
  const result = new URL(
    addSessionParams('http://localhost:3000/demo?theme=dark', 'ses_1', 'token'),
  );
  assert.equal(result.searchParams.get('theme'), 'dark');
  assert.equal(result.searchParams.get('__foundry_session'), 'ses_1');
});
