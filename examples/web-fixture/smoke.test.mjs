import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('fixture contains independently instrumented layers and motion', async () => {
  const html = await readFile(new URL('index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('style.css', import.meta.url), 'utf8');
  assert.match(html, /data-foundry-id="upgrade-button"/);
  assert.match(html, /data-foundry-source=/);
  assert.match(css, /@keyframes breathe/);
});
