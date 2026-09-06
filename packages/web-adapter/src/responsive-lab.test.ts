import assert from 'node:assert/strict';
import test from 'node:test';
import {
  responsiveEditScopes,
  responsiveComparison,
  responsiveContainerRange,
  responsiveFindings,
  responsiveScale,
  responsiveViewports,
  viewportForWidth,
} from './responsive-lab.js';

test('preserves configured native viewport dimensions and adds current', () => {
  const viewports = responsiveViewports(
    [
      { id: 'mobile', label: 'Mobile', width: 390, height: 844 },
      { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
    ],
    { width: 1280, height: 720 },
  );
  assert.deepEqual(
    viewports.map(({ id, width, height }) => ({ id, width, height })),
    [
      { id: 'mobile', width: 390, height: 844 },
      { id: 'current', width: 1280, height: 720 },
      { id: 'desktop', width: 1440, height: 900 },
    ],
  );
  assert.equal(viewportForWidth(viewports, 800)?.id, 'mobile');
  assert.equal(viewportForWidth(viewports, 1400)?.id, 'current');
});

test('builds a useful scrub range from authored container query boundaries', () => {
  assert.deepEqual(
    responsiveContainerRange(
      [
        { id: 'compact', label: 'Compact', condition: 'min-width: 320px', minWidth: 320 },
        { id: 'wide', label: 'Wide', condition: 'min-width: 720px', minWidth: 720 },
      ],
      560,
    ),
    { min: 160, max: 880, boundaries: [320, 720] },
  );
});

test('compares responsive snapshots without turning comparison into a design change', () => {
  const comparison = responsiveComparison(
    {
      viewportId: 'before',
      viewportWidth: 1280,
      viewportHeight: 900,
      containerWidth: 360,
      elementWidth: 328,
      elementHeight: 72,
      scrollWidth: 328,
      scrollHeight: 72,
      clientWidth: 328,
      clientHeight: 72,
      lineCount: 2,
      left: 16,
      top: 16,
    },
    {
      viewportId: 'after',
      viewportWidth: 1280,
      viewportHeight: 900,
      containerWidth: 640,
      elementWidth: 608,
      elementHeight: 48,
      scrollWidth: 608,
      scrollHeight: 48,
      clientWidth: 608,
      clientHeight: 48,
      lineCount: 1,
      left: 16,
      top: 16,
    },
  );
  assert.equal(comparison.changed, true);
  assert.equal(comparison.viewportWidthDelta, 0);
  assert.equal(comparison.containerWidthDelta, 280);
  assert.equal(comparison.lineCountDelta, -1);
});

test('scales only the outer presentation while retaining native dimensions', () => {
  assert.equal(responsiveScale({ width: 3840, height: 2160 }, { width: 960, height: 540 }), 0.25);
  assert.equal(
    responsiveScale({ width: 390, height: 844 }, { width: 480, height: 640 }),
    640 / 844,
  );
});

test('detects overflow, clipping, awkward wrapping, and layout jumps', () => {
  const findings = responsiveFindings([
    {
      viewportId: 'mobile',
      viewportWidth: 390,
      viewportHeight: 844,
      elementWidth: 300,
      elementHeight: 80,
      scrollWidth: 420,
      scrollHeight: 120,
      clientWidth: 300,
      clientHeight: 80,
      lineCount: 4,
      left: 16,
      top: 20,
    },
    {
      viewportId: 'desktop',
      viewportWidth: 1440,
      viewportHeight: 900,
      elementWidth: 700,
      elementHeight: 80,
      scrollWidth: 700,
      scrollHeight: 80,
      clientWidth: 700,
      clientHeight: 80,
      lineCount: 1,
      left: 240,
      top: 20,
    },
  ]);
  assert.deepEqual(
    findings.map(({ kind }) => kind),
    ['overflow', 'clipping', 'awkward-wrap', 'layout-jump'],
  );
});

test('requires source mapping before promoting a change across breakpoints', () => {
  assert.deepEqual(
    responsiveEditScopes(false).map(({ enabled }) => enabled),
    [true, false],
  );
  assert.deepEqual(
    responsiveEditScopes(true).map(({ enabled }) => enabled),
    [true, true],
  );
});
