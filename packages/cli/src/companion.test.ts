import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CompanionStore } from './companion.js';
import { FOUNDRY_VERSION } from './release.js';

test('records one host installation and recent projects without duplicates', async () => {
  const home = await mkdtemp(join(tmpdir(), 'foundry-companion-'));
  const store = new CompanionStore(home);
  await store.recordInstallation(['codex', 'claude']);
  await store.recordInstallation(['codex', 'cursor']);
  await store.registerProject(join(home, 'project'), 'http://localhost:3000');
  await store.registerProject(join(home, 'project'), 'http://localhost:3001');
  const state = await store.read();
  assert.equal(state.foundryVersion, FOUNDRY_VERSION);
  assert.deepEqual(state.agents, ['codex', 'claude', 'cursor']);
  assert.equal(state.projects.length, 1);
  assert.equal(state.projects[0]?.targetUrl, 'http://localhost:3001');
});
