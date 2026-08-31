import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contrastRatio,
  detectSizingMode,
  impactMessages,
  nearestNumericToken,
  parseColor,
  virtualRange,
} from './intelligence.js';

test('detects fixed, hug, fill, and constrained sizing', () => {
  assert.equal(detectSizingMode('240px'), 'fixed');
  assert.equal(detectSizingMode('max-content'), 'hug');
  assert.equal(detectSizingMode('auto', '1'), 'fill');
  assert.equal(detectSizingMode('auto', '0', 'auto', 'none'), 'fixed');
  assert.equal(detectSizingMode('auto', '0', '120px', '480px'), 'min-max');
});

test('parses colors and measures WCAG contrast', () => {
  assert.deepEqual(parseColor('#fff'), [255, 255, 255, 1]);
  assert.deepEqual(parseColor('rgb(0, 0, 0)'), [0, 0, 0, 1]);
  assert.equal(contrastRatio('#000', '#fff'), 21);
  assert.ok((contrastRatio('rgba(0,0,0,.5)', '#fff') ?? 0) > 3.9);
});

test('explains component, token, responsive, and unresolved impact', () => {
  assert.deepEqual(
    impactMessages({
      scope: 'component',
      componentInstances: 14,
      breakpoint: 'mobile',
      theme: 'dark',
      state: 'hover',
      token: '--space-4',
      unresolved: true,
    }),
    [
      'Choose a source mapping before applying',
      'Updates 14 component instances',
      'Uses --space-4',
      'Limited to mobile',
      'Limited to dark theme',
      'Limited to hover state',
    ],
  );
});

test('calculates a bounded virtual layer range', () => {
  assert.deepEqual(virtualRange(1000, 600, 300, 30, 2), {
    start: 18,
    end: 32,
    before: 540,
    after: 29040,
  });
});

test('finds the nearest numeric project token', () => {
  assert.deepEqual(
    nearestNumericToken(15, [
      { name: '--space-2', value: '8px' },
      { name: '--space-4', value: '16px' },
      { name: '--space-6', value: '24px' },
    ]),
    { name: '--space-4', value: 16 },
  );
});
