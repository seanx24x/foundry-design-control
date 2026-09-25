import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { typographyComparisonState } from '../public/next-typography-studio.js';

test('font comparison distinguishes offline, pending, empty and failed measurements', () => {
  assert.equal(typographyComparisonState({ connected: false }).label, 'Preview offline');
  assert.equal(
    typographyComparisonState({ connected: true, pending: true }).label,
    'Measuring fonts',
  );
  assert.equal(typographyComparisonState({ connected: true }).label, 'Choose a candidate');
  assert.equal(
    typographyComparisonState({ connected: true, candidate: { family: 'Inter' } }).label,
    'Comparison unavailable',
  );
});
test('a candidate needs both measured specimens before it is ready', () => {
  const model = {
    connected: true,
    candidate: { family: 'Inter' },
    comparison: { current: {}, candidate: {} },
  };
  assert.equal(typographyComparisonState(model).ready, true);
  assert.equal(typographyComparisonState({ ...model, pending: true }).ready, false);
  assert.equal(typographyComparisonState({ ...model, connected: false }).ready, false);
  assert.equal(typographyComparisonState({ ...model, comparison: { current: {} } }).ready, false);
});
test('unmeasured specimens cannot masquerade as loaded font previews', () => {
  const source = readFileSync(
    new URL('../public/next-typography-studio.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /specimenStage.replaceChildren/);
  assert.match(source, /value.textContent = 'Not measured'/);
  assert.match(source, /use.disabled \|\|= !state.ready/);
  assert.match(source, /root.querySelector\('#typography-search'\)/);
});
test('typography presentation preserves editing nodes, scroll and draft style names', () => {
  const source = readFileSync(
    new URL('../public/next-typography-studio.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /disclosure\(treatment, 'Rhythm and type scale'/);
  assert.match(source, /name.value = saved.styleName/);
  assert.match(source, /scroll.scrollTop = saved\?\.main/);
  assert.doesNotMatch(source, /fetch\(|requestCommand\(|runDurableAction\(/);
});
test('typography layout uses shared rails, measured insets and two-up specimens', () => {
  const css = readFileSync(
    new URL('../public/next-typography-studio.css', import.meta.url),
    'utf8',
  );
  assert.match(css, /grid-template-columns: 300px minmax\(0, 1fr\) 300px/);
  assert.match(css, /grid-template-rows: 44px minmax\(0, 1fr\) 44px/);
  assert.match(css, /var\(--type-scrollbar-width, 0px\)/);
  assert.match(css, /\.typography-font-row \{[^}]*min-height: 32px/);
  assert.match(css, /\.typography-comparison > div \{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
});
test('refinement runs after existing typography action handlers are attached', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const render = source.slice(
    source.indexOf('function renderTypographyStudio()'),
    source.indexOf('function motionSourceLabel('),
  );
  assert.ok(
    render.lastIndexOf('refineTypography();') >
      render.indexOf("$$('[data-remove-style]', properties)"),
  );
  assert.match(render, /clearTypographyComparisonFonts\(\)/);
  assert.equal((render.match(/typographyScale = \{/g) ?? []).length, 1);
  assert.match(render, /typographySelectionId = selectionId;\s*typographyScale =/);
});
