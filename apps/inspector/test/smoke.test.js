import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('inspector entry includes accessible review and export actions', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /Change ledger/);
  assert.match(html, /Copy agent prompt/);
  assert.match(html, /Export JSON/);
  assert.match(html, /aria-live="polite"/);
});
