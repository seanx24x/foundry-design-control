import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  responsiveWidthValue,
  responsiveCaptureReady,
  responsiveComparisonMatches,
} from '../public/responsive-controls.js';
const context = {
  selector: '#action',
  target: 'viewport',
  width: 1280,
  containerWidth: 480,
  stress: 'none',
};
const snapshot = {
  targetSelector: '#action',
  viewportWidth: 1280,
  stressMode: 'none',
  selection: { width: 200, height: 48 },
  container: { selector: '#panel', width: 480 },
};
test('width entry accepts exact native-range integers without silently clamping invalid drafts', () => {
  assert.equal(responsiveWidthValue('1280', 320, 3840), 1280);
  for (const input of ['', ' ', 'abc', '1280.5', 'Infinity', '319', '3841'])
    assert.equal(responsiveWidthValue(input, 320, 3840), null);
});
test('geometry capture requires the matching custom target width and acknowledged stress mode', () => {
  assert.equal(responsiveCaptureReady(snapshot, context), true);
  for (const change of [
    { targetSelector: '#other' },
    { viewportWidth: 1440 },
    { stressMode: 'long-content' },
    { selection: null },
  ])
    assert.equal(responsiveCaptureReady({ ...snapshot, ...change }, context), false);
  assert.equal(responsiveCaptureReady(null, context), false);
});
test('container captures require a real matching container rather than treating unavailable geometry as zero', () => {
  const c = { ...context, target: 'container' };
  assert.equal(responsiveCaptureReady(snapshot, c), true);
  for (const container of [null, {}, { selector: '#panel', width: 640 }])
    assert.equal(responsiveCaptureReady({ ...snapshot, container }, c), false);
});
test('geometry deltas never mix targets modes or containers', () => {
  const before = { selector: '#action', target: 'viewport' },
    after = { ...before };
  assert.equal(responsiveComparisonMatches(before, after), true);
  assert.equal(responsiveComparisonMatches(before, { ...after, selector: '#other' }), false);
  assert.equal(responsiveComparisonMatches(before, { ...after, target: 'container' }), false);
  assert.equal(
    responsiveComparisonMatches(
      { ...before, target: 'container', containerSelector: '#one' },
      { ...after, target: 'container', containerSelector: '#two' },
    ),
    false,
  );
  assert.equal(responsiveComparisonMatches({}, {}), false);
});
test('typed width companion retains original input dispatch and cancels without transport', () => {
  const source = readFileSync(new URL('../public/responsive-controls.js', import.meta.url), 'utf8');
  assert.match(source, /range.dispatchEvent\(new Event\('input'/);
  assert.match(source, /event.key === 'Escape'/);
  assert.match(source, /kind !== next/);
  assert.doesNotMatch(source, /fetch\(|postMessage\(|requestFrameCommand\(|requestCommand\(/);
});
test('edit-scope changes guard duplicate submissions and publish selection only after the native transaction', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = source.lastIndexOf("$$('[data-responsive-scope]').forEach((button) =>");
  const scope = source.slice(start, source.indexOf("$$('[data-canvas-mode]')", start));
  assert.match(scope, /if \(responsiveScopePending\) return/);
  assert.ok(
    scope.indexOf('await applyResponsiveScopeTransaction') <
      scope.indexOf('responsiveEditScope = nextScope'),
  );
  assert.match(scope, /responsiveScopeError/);
  assert.match(scope, /finally/);
});
