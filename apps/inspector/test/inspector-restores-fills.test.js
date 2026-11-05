import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectorSectionRestorePlan } from '../public/inspector-restores.js';
import {
  supportsInspectorColorFormats,
  inspectorColorChannels,
  serializeInspectorChannels,
  inspectorColorAlpha,
} from '../public/inspector-color-formats.js';
const controls = [
  { property: 'fontSize', kind: 'number', unit: 'px' },
  { property: 'fontWeight', kind: 'text' },
  { property: 'width', kind: 'number', unit: 'px' },
  { property: 'opacity', kind: 'number', unit: '%', sourceScale: 100 },
];
const entries = [
  { property: 'fontSize', before: 12.625, after: 16, revision: 4 },
  { property: 'fontWeight', before: '400', after: '500', revision: 5 },
  { property: 'width', before: 200, after: 240, revision: 6 },
];
test('section restore lists only its captured fields and never changes the originals', () => {
  const original = structuredClone(entries);
  const plan = inspectorSectionRestorePlan('Typography', controls, entries);
  assert.deepEqual(
    plan.items.map((item) => [item.property, item.before]),
    [
      ['fontSize', 12.625],
      ['fontWeight', '400'],
    ],
  );
  assert.equal(plan.reason, '');
  assert.deepEqual(entries, original);
  assert.equal(inspectorSectionRestorePlan('Unknown', controls, entries).items.length, 0);
});
test('mixed targets and linked captured values require Undo instead of invented originals', () => {
  assert.match(
    inspectorSectionRestorePlan('Typography', controls, entries, 2).reason,
    /each selected/,
  );
  assert.match(
    inspectorSectionRestorePlan('Layout', controls, [
      { property: 'paddingLinked', before: 8, after: 16 },
    ]).reason,
    /linked or mixed/,
  );
  assert.match(
    inspectorSectionRestorePlan('Typography', controls, [
      { ...entries[0], before: 'Mixed', mixed: true },
    ]).reason,
    /linked or mixed/,
  );
});
test('missing capabilities or unknown numerical originals block restore', () => {
  assert.match(
    inspectorSectionRestorePlan('Typography', [], entries).reason,
    /no longer available/,
  );
  for (const before of [undefined, NaN, Infinity, '', ' '])
    assert.ok(
      inspectorSectionRestorePlan('Typography', controls, [{ ...entries[0], before }]).reason,
    );
});
test('restore fingerprint detects changed values and preserves normalized opacity semantics', () => {
  const plan = inspectorSectionRestorePlan('Typography', controls, entries);
  assert.notEqual(
    plan.signature,
    inspectorSectionRestorePlan(
      'Typography',
      controls,
      entries.map((item) => ({ ...item, revision: 99 })),
    ).signature,
  );
  const opacity = inspectorSectionRestorePlan('Appearance', controls, [
    { property: 'opacity', before: 75.3, after: 50, revision: 7 },
  ]);
  assert.equal(opacity.items[0].before, 75.3);
  assert.equal(opacity.items[0].control.sourceScale, 100);
});
test('color conversion eligibility excludes wide-gamut, relative and unresolved CSS syntax', () => {
  for (const value of [
    '#fff',
    '#0000',
    '#123456',
    '#12345680',
    'red',
    'transparent',
    'rgb(32 35 31 / 50%)',
    'hsl(120 100% 50%)',
  ])
    assert.equal(supportsInspectorColorFormats(value), true, value);
  for (const value of [
    'color(display-p3 1 0 0)',
    'oklch(50% .2 30)',
    'lab(40% 1 2)',
    'var(--brand)',
    'currentColor',
    'inherit',
    'rgb(from red r g b)',
    'color-mix(in srgb,red,blue)',
  ])
    assert.equal(supportsInspectorColorFormats(value), false, value);
});
test('RGB and HSL channel readouts agree for primary colors and achromatic limits', () => {
  const red = { hex: '#ff0000', h: 0, s: 100, v: 100 };
  assert.deepEqual(inspectorColorChannels(red, 'rgb'), [255, 0, 0]);
  assert.deepEqual(inspectorColorChannels(red, 'hsl'), [0, 100, 50]);
  assert.deepEqual(inspectorColorChannels({ hex: '#000000', h: 0, s: 0, v: 0 }, 'hsl'), [0, 0, 0]);
  assert.deepEqual(
    inspectorColorChannels({ hex: '#ffffff', h: 0, s: 0, v: 100 }, 'hsl'),
    [0, 0, 100],
  );
});
test('channel serialization preserves deliberate decimals and validates every channel', () => {
  assert.equal(
    serializeInspectorChannels('rgb', ['12.25', 20, 30], 50.3),
    'rgb(12.25 20 30 / 50.3%)',
  );
  assert.equal(serializeInspectorChannels('hsl', [120, 100, 50], 100), 'hsl(120 100% 50% / 100%)');
  for (const values of [
    ['', 20, 30],
    [-1, 2, 3],
    [256, 0, 0],
    ['bad', 0, 0],
  ])
    assert.equal(serializeInspectorChannels('rgb', values, 100), null);
  assert.equal(serializeInspectorChannels('hsl', [361, 0, 0], 100), null);
  assert.equal(serializeInspectorChannels('rgb', [0, 0, 0], 101), null);
});
test('explicit alpha is not rounded away when viewing formatted colors', () => {
  assert.equal(inspectorColorAlpha('rgba(12,20,30,.503)'), 50.3);
  assert.equal(inspectorColorAlpha('hsl(120 100% 50% / 25.5%)'), 25.5);
  assert.equal(inspectorColorAlpha('#abcdef80'), (128 / 255) * 100);
  assert.equal(inspectorColorAlpha('#abcd'), (221 / 255) * 100);
  assert.equal(inspectorColorAlpha('transparent'), 0);
  assert.equal(inspectorColorAlpha('color(display-p3 1 0 0 / .4)', 40), 40);
});
