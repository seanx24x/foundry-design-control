import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  recipeMappingSummary,
  recipeMappingLabel,
  recipeCaptureHint,
} from '../public/next-recipes.js';

test('mapping uses concrete property counts, never a compatibility percentage', () => {
  assert.equal(
    recipeMappingSummary({ matched: 2, total: 3, score: 85 }, {}, true),
    '2 of 3 properties supported',
  );
  assert.equal(
    recipeMappingSummary({ matched: 0, total: 3 }, {}, true),
    '0 of 3 properties supported',
  );
});
test('mapping distinguishes no target, offline and unavailable assessment', () => {
  assert.equal(recipeMappingSummary(null, null, true), 'Choose a target');
  assert.equal(recipeMappingSummary(null, {}, false), 'Preview offline');
  assert.equal(recipeMappingSummary({ matched: 2, total: 3 }, {}, false), 'Last inspected mapping');
  assert.equal(recipeMappingSummary(null, {}, true), 'Mapping unavailable');
});
test('mapping labels expose unsupported and ambiguous outcomes before token or literal values', () => {
  assert.equal(recipeMappingLabel({ status: 'unsupported', token: {} }), 'Unsupported');
  assert.equal(recipeMappingLabel({ status: 'ambiguous', token: {} }), 'Token choice needs review');
  assert.equal(recipeMappingLabel({ status: 'mapped', token: {} }), 'Destination token');
  assert.equal(recipeMappingLabel({ status: 'mapped' }), 'Saved literal');
});
test('capture explains eligibility without claiming a source edit', () => {
  assert.match(recipeCaptureHint({}, true, false), /Reconnect/);
  assert.match(recipeCaptureHint(null, false, true), /Select and refine/);
  assert.match(recipeCaptureHint({}, false, true), /No edited values/);
  assert.match(recipeCaptureHint({}, true, true), /does not apply source changes/);
});
test('presentation preserves capture nodes and confirmation gates original delete handler', () => {
  const source = readFileSync(new URL('../public/next-recipes.js', import.meta.url), 'utf8');
  assert.match(source, /railScroll.append\(selectionPanel, captureHint, form, selectedDetails\)/);
  assert.match(source, /window.confirm\(/);
  assert.match(source, /event.stopImmediatePropagation\(\)/);
  assert.match(source, /run.disabled = !connected \|\| !assessment\?\.matched/);
  assert.match(source, /scroll.scrollTop = scrolls.get\(key\)/);
  assert.doesNotMatch(source, /fetch\(|requestCommand\(|runDurableAction\(/);
});
test('refinement runs after acknowledged recipe handlers are attached', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const render = source.slice(
    source.indexOf('function renderVisualRecipes()'),
    source.indexOf('const DESIGN_SYSTEM_CATEGORY_LABELS'),
  );
  assert.ok(
    render.indexOf('nextRecipes?.render({') >
      render.indexOf("await requestCommand('remove-visual-recipe'"),
  );
  assert.match(render, /await requestCommand\('apply-visual-recipe'/);
});
test('recipes share panel geometry, full-width content and independent scrolling', () => {
  const css = readFileSync(new URL('../public/next-recipes.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns: 300px minmax\(0, 1fr\) 300px/);
  assert.match(css, /grid-template-rows: 44px minmax\(0, 1fr\) 44px/);
  assert.match(css, /var\(--recipe-scrollbar-width, 0px\)/);
  assert.match(css, /\.visual-recipe-row \{[^}]*min-height: 32px/);
  assert.match(css, /\.visual-recipe-selection \{[^}]*min-height: 0/);
  assert.match(css, /\.visual-recipe-mapping > footer \{[^}]*padding: 16px 0/);
});
