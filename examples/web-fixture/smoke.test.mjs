import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('signup fixture contains mapped form surfaces and accessible interaction states', async () => {
  const html = await readFile(new URL('index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('style.css', import.meta.url), 'utf8');
  assert.match(html, /data-foundry-id="signup-form"/);
  assert.match(html, /data-foundry-id="working-note"/);
  assert.match(html, /data-foundry-id="create-workspace-button"/);
  assert.match(html, /Create your workspace/);
  assert.match(html, /validateField/);
  assert.match(html, /data-foundry-source=/);
  assert.match(css, /@keyframes button-spin/);
  assert.match(css, /prefers-reduced-motion/);
});

test('Morrow fixture styling stays on the 4px grid', async () => {
  const css = await readFile(new URL('style.css', import.meta.url), 'utf8');
  const values = [...css.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
  const offGrid = values.filter(
    (value) => value !== 0 && Math.abs(value) !== 1 && Math.abs(value) % 4 !== 0,
  );
  assert.deepEqual(
    [...new Set(offGrid)].sort((a, b) => a - b),
    [],
  );
});
