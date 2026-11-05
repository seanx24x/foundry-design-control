import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeUIThemeCSS, palettes, geometry, shell } from '../ui-system.mjs';
import { selectedStudioSegment, studioSpringStep } from '../public/foundry-studio-controls.js';
import { FOUNDRY_SIDEBAR_PAGES } from '../public/foundry-pilot-sidebar.js';
import { applyReportNeedsFocus } from '../public/foundry-pilot-review.js';

test('Apply focus follows only the current Review origin, including native submit blur', () => {
  const submit = { id: 'apply-agent', disabled: true, dataset: { submitting: 'true' } },
    field = {},
    external = {},
    body = {};
  const review = { contains: (element) => element === submit || element === field };
  assert.equal(applyReportNeedsFocus({ review, active: field, body }), true);
  assert.equal(applyReportNeedsFocus({ review, active: body, body, lastFocus: submit }), true);
  assert.equal(applyReportNeedsFocus({ review, active: external, body, lastFocus: submit }), false);
  assert.equal(applyReportNeedsFocus({ review, active: body, body, lastFocus: field }), false);
  assert.equal(
    applyReportNeedsFocus({ review, active: body, body, lastFocus: submit, previousState: {} }),
    false,
  );
  submit.dataset.submitting = 'false';
  assert.equal(applyReportNeedsFocus({ review, active: body, body, lastFocus: submit }), false);
});
test('generated public tokens match the canonical internal UI system', async () =>
  assert.equal(
    await readFile(new URL('../public/foundry-pilot-tokens.css', import.meta.url), 'utf8'),
    makeUIThemeCSS(),
  ));
test('light and dark selection/surfaces use neutral RGB rather than tinted highlight', () => {
  for (const theme of Object.values(palettes))
    for (const role of [
      'canvas',
      'panel',
      'field',
      'hover',
      'ink',
      'muted',
      'selected',
      'selectionInk',
    ]) {
      const hex = theme[role].slice(1);
      assert.equal(hex.slice(0, 2), hex.slice(2, 4), role);
      assert.equal(hex.slice(2, 4), hex.slice(4, 6), role);
    }
  assert.equal(shell.selected, '#292929');
});
test('control geometry preserves approved density and focus separation', () => {
  assert.equal(geometry.controlHeight, 32);
  assert.equal(geometry.radiusControl, 8);
  assert.equal(geometry.focusWidth, 2);
  assert.equal(geometry.radiusFloating, 12);
});
test('all fourteen native workspaces remain registered', () =>
  assert.deepEqual(
    FOUNDRY_SIDEBAR_PAGES.map((page) => page.mode),
    [
      'canvas',
      'components',
      'system',
      'motion',
      'typography',
      'recipes',
      'states',
      'responsive',
      'health',
      'agent',
      'branches',
      'memory',
      'delivery',
      'review',
    ],
  ));
const button = (attrs = {}, classes = []) => ({
  getAttribute: (key) => attrs[key] ?? null,
  classList: { contains: (key) => classes.includes(key) },
});
test('segment decoration reads selected state without choosing a value', () => {
  const a = button({ 'aria-selected': 'true' }),
    b = button();
  assert.equal(selectedStudioSegment([a, b]), a);
  assert.equal(selectedStudioSegment([a, button({ 'aria-pressed': 'true' })]), null);
  assert.equal(selectedStudioSegment([b]), null);
});
test('segment spring converges and retains current presentation on reversal', () => {
  let x = 0,
    v = 0;
  for (let i = 0; i < 120; i++) {
    const step = studioSpringStep(x, v, 100, 1 / 60, 240);
    x = step.position;
    v = step.velocity;
  }
  assert.ok(Math.abs(100 - x) < 0.01);
  const reversed = studioSpringStep(x, v, 0, 1 / 60, 240);
  assert.ok(reversed.position > 90 && reversed.position < 100);
  assert.ok(reversed.velocity < 0);
});
test('shared presentation has no transport, source edits, focus or native selection writes', async () => {
  const source = await readFile(
    new URL('../public/foundry-studio-controls.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /fetch\(|localStorage|sessionStorage|requestCommand|\.focus\(|\.value\s*=|preventDefault|stopPropagation|setInterval/,
  );
  assert.doesNotMatch(source, /setAttribute\(['"]aria-(?:pressed|selected)/);
});
test('native controls, reduced motion and fallback boundaries remain authoritative', async () => {
  const source = await readFile(
    new URL('../public/foundry-studio-controls.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /dataset\?\.foundryPilot/);
  assert.match(source, /selected\.length\s*===\s*1/);
  const css = await readFile(
    new URL('../public/foundry-studio-controls.css', import.meta.url),
    'utf8',
  );
  assert.match(css, /forced-colors/);
  assert.match(css, /pointer:\s*coarse/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /aria-invalid/);
});
