import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectorInputValue,
  inspectorUIControl,
  scrubInspectorValue,
  rgbToHsv,
  hsvToHex,
  colorWithAlpha,
} from '../public/inspector-inputs.js';

const size = { property: 'fontSize', kind: 'number', unit: 'px', value: 70.293, min: 0, max: 200 };
test('computed numbers display quietly without modifying the exact measured data', () => {
  assert.equal(inspectorInputValue(size), '70');
  assert.equal(size.value, 70.293);
  assert.equal(inspectorInputValue({ ...size, mixed: true }), '');
  assert.equal(inspectorInputValue({ kind: 'text', value: '80.123px' }), '80px');
  for (const value of ['auto', 'normal', '1.25rem', 'calc(100% - 1px)'])
    assert.equal(inspectorInputValue({ kind: 'text', value }), value);
});
test('deliberately typed decimals and authored CSS are not replaced by computed precision', () => {
  assert.equal(
    inspectorInputValue({ ...size, authoredValue: '70.293px', value: 70.2812 }),
    '70.293',
  );
  assert.equal(inspectorInputValue({ ...size, authoredValue: '4rem' }), '70');
  assert.equal(
    inspectorInputValue({ kind: 'text', value: '20.3px', authoredValue: '1.25' }),
    '1.25',
  );
});
test('scrub results are whole numbers for normal, coarse and slow fine drags', () => {
  assert.equal(scrubInspectorValue(size, 70.293, 8.2), 78);
  assert.equal(scrubInspectorValue(size, 70.293, 8.2, { shiftKey: true }), 152);
  assert.equal(scrubInspectorValue(size, 70.293, 8.2, { altKey: true }), 71);
  assert.equal(scrubInspectorValue(size, 70.293, -800), 0);
  assert.equal(scrubInspectorValue(size, 70.293, 800), 200);
});
test('opacity uses whole percentages without turning a normalized value into on/off', () => {
  const opacity = inspectorUIControl({
    property: 'opacity',
    kind: 'number',
    value: 0.753,
    min: 0,
    max: 1,
  });
  assert.equal(inspectorInputValue(opacity), '75');
  assert.equal(opacity.value, 75.3);
  assert.equal(scrubInspectorValue(opacity, 75, 8), 83);
  assert.equal(opacity.sourceScale, 100);
  assert.equal(opacity.unit, '%');
  assert.equal(
    inspectorInputValue(inspectorUIControl({ ...opacity, value: 0.753, authoredValue: '0.753' })),
    '75.3',
  );
});
test('picker color conversion retains channel values and transparent alpha', () => {
  for (const rgb of [
    [32, 35, 31],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 255],
    [0, 0, 0],
  ]) {
    const { h, s, v } = rgbToHsv(...rgb);
    assert.equal(hsvToHex(h, s, v), '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join(''));
  }
  assert.equal(colorWithAlpha('#20231f', 100), '#20231f');
  assert.equal(colorWithAlpha('#20231f', 50), '#20231f80');
  assert.equal(colorWithAlpha('#20231f', 0), '#20231f00');
});
