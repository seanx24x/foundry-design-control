import assert from 'node:assert/strict';
import test from 'node:test';
import {
  responsiveEditScopes,
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
