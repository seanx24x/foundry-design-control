import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { motionAvailability, motionMatches } from '../public/next-motion-studio.js';

test('motion availability separates empty, offline, absent and inactive motion', () => {
  const selection = { id: 'note' };
  assert.equal(motionAvailability(null, null, true).label, 'No selection');
  assert.equal(motionAvailability(selection, { active: true }, false).label, 'Preview offline');
  assert.equal(motionAvailability(selection, null, true).label, 'No motion');
  assert.equal(motionAvailability(selection, { active: false }, true).label, 'Not active');
  assert.equal(motionAvailability(selection, { active: true }, true).editable, true);
  assert.match(
    motionAvailability(selection, { active: true }, true).reason,
    /source stays unchanged until Apply/,
  );
});
test('motion search is trimmed and includes the source kind', () => {
  assert.equal(motionMatches('Note arrive', 'CSS animation', ' ARRIVE '), true);
  assert.equal(motionMatches('Note arrive', 'CSS animation', 'css'), true);
  assert.equal(motionMatches('Note arrive', 'CSS animation', 'spring'), false);
  assert.equal(motionMatches('Note arrive', 'CSS animation', ''), true);
});
test('motion presentation preserves existing handlers and never sends edits itself', () => {
  const source = readFileSync(new URL('../public/next-motion-studio.js', import.meta.url), 'utf8');
  assert.match(source, /content.append\(curve\)/);
  assert.match(source, /content.append\(path\)/);
  assert.match(source, /content.append\(comparison\)/);
  assert.doesNotMatch(source, /fetch\(|requestCommand\(|runDurableAction\(/);
  assert.match(source, /scrollTop = saved\?\.main/);
  assert.match(source, /disclosure.open = saved\?\.open.includes/);
});
test('unavailable SVG editing is blocked along with native controls', () => {
  const source = readFileSync(new URL('../public/next-motion-studio.js', import.meta.url), 'utf8');
  assert.match(source, /addEventListener\('pointerdown', blockUnavailable, true\)/);
  assert.match(source, /addEventListener\('keydown', blockUnavailable, true\)/);
  assert.match(source, /handle.setAttribute\('aria-disabled'/);
  assert.match(source, /previewCurve.disabled = !motion\?\.curve\?\.points\?\.length/);
});
test('Next motion geometry stays scoped, full-width and reduced-motion aware', () => {
  const css = readFileSync(new URL('../public/next-motion-studio.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns: 300px minmax\(0, 1fr\) 300px/);
  assert.match(css, /grid-template-rows: 44px minmax\(0, 1fr\) 44px/);
  assert.match(css, /\.motion-studio-row \{[^}]*height: 32px/);
  assert.match(css, /var\(--motion-scrollbar-width, 0px\)/);
  assert.match(css, /aspect-ratio: 240 \/ 156/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
test('Next refinement runs after the existing curve and keyframe handlers are attached', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const render = app.slice(
    app.indexOf('function renderMotionStudio()'),
    app.indexOf('function focusedInspectorEdit()'),
  );
  assert.ok(
    render.indexOf('refineMotion(motion)') >
      render.indexOf("const curveEditor = $('.motion-curve-editor', properties)"),
  );
  assert.ok(
    render.indexOf('refineMotion(motion)') >
      render.indexOf("$$('[data-studio-keyframe-property]', properties)"),
  );
});

test('comparison playback row grows to include padding above the diagnostics divider', () => {
  const css = readFileSync(new URL('../public/next-motion-studio.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-rows: 52px minmax\(180px, 1fr\) auto 52px/);
  assert.match(css, /\.motion-comparison-controls \{\s*padding: 16px 0/);
});
