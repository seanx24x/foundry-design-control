import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { navigationExpanded, STUDIO_NAMES } from '../public/experience.js';

test('studio navigation adapts until the user explicitly chooses a layout', () => {
  assert.equal(navigationExpanded(null, false), true);
  assert.equal(navigationExpanded(null, true), false);
  assert.equal(navigationExpanded('expanded', true), true);
  assert.equal(navigationExpanded('collapsed', false), false);
  assert.equal(navigationExpanded('invalid', true), false);
});

test('shared shell preserves every destination and permanent review access', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.equal(Object.keys(STUDIO_NAMES).length, 14);
  for (const mode of Object.keys(STUDIO_NAMES))
    assert.ok(html.includes(`data-workspace-mode="${mode}"`));
  for (const group of ['Design', 'Test', 'Collaborate'])
    assert.ok(html.includes(`aria-label="${group}"`));
  assert.ok(html.includes('id="persistent-review-count"'));
  assert.ok(source.includes("setAttribute('aria-label', STUDIO_NAMES[mode]"));
  assert.ok(source.includes('reviewBatchSummary(changes, activeSession?.changeSet?.operations)'));
  assert.ok(source.includes('data-run-navigation="delivery"'));
  assert.ok(!source.includes('Preview before</button>'));
  assert.ok(html.includes('Compare batch on canvas'));
  assert.ok(html.includes('id="compare-label"'));
  assert.ok(source.includes("comparisonMode === 'before' ? 'End compare' : 'Compare'"));
  assert.ok(source.includes('sourceText(source)'));
  assert.ok(source.includes('value.dataset.deliveryReadonlyField = field.dataset.deliveryField'));
  assert.ok(source.includes('No open questions recorded.'));
});
