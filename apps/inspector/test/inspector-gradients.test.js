import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readInspectorGradient,
  serializeInspectorGradient,
  moveInspectorGradientStop,
} from '../public/inspector-gradients.js';
import { inspectorSections } from '../public/next-workspace.js';
import { inspectorSectionRestorePlan } from '../public/inspector-restores.js';
test('native linear capture preserves literal color precision and explicit alpha', () => {
  const value = 'linear-gradient(125.25deg, rgb(12.25 20 30 / 50.3%) 12.5%, #abcdef80 80%)';
  assert.equal(serializeInspectorGradient(readInspectorGradient(value)), value);
});
test('omitted stop positions follow equal CSS distribution without changing input', () => {
  const value = 'linear-gradient(to right, red, rgb(0, 255, 0), #00f 80%, transparent)';
  const model = readInspectorGradient(value);
  assert.equal(model.angle, 90);
  assert.deepEqual(
    model.stops.map((item) => item.position),
    [0, 40, 80, 100],
  );
  assert.equal(readInspectorGradient('linear-gradient(red, blue)').angle, 180);
  assert.equal(readInspectorGradient('linear-gradient(.25turn, red, blue)').angle, 90);
  assert.equal(readInspectorGradient('linear-gradient(100grad, red, blue)').angle, 90);
});
test('layered, contextual, wide gamut and unrepresented fills are never flattened', () => {
  for (const css of [
    'none',
    'url("private.png")',
    'linear-gradient(red, blue), url(x)',
    'radial-gradient(red,blue)',
    'repeating-linear-gradient(red,blue)',
    'linear-gradient(to top right,red,blue)',
    'linear-gradient(in oklab,red,blue)',
    'linear-gradient(red 0% 20%,blue)',
    'linear-gradient(red, 30%, blue)',
    'linear-gradient(red -20%,blue)',
    'linear-gradient(red 80%,blue 20%)',
    'linear-gradient(var(--brand),blue)',
    'linear-gradient(currentColor,blue)',
    'linear-gradient(color(display-p3 1 0 0),blue)',
    'linear-gradient(rgb(from red r g b),blue)',
    'linear-gradient(red 12px,blue)',
    'linear-gradient(red)',
    'linear-gradient(red,blue);color:red',
    'linear-gradient(red,blue) /* x */',
  ])
    assert.equal(readInspectorGradient(css), null, css);
});
test('serialization refuses invalid or reversed positions and excessive stop counts', () => {
  const model = readInspectorGradient('linear-gradient(red,blue)');
  for (const angle of [NaN, Infinity, 3601])
    assert.equal(serializeInspectorGradient({ ...model, angle }), null);
  for (const position of [NaN, -1, 101])
    assert.equal(
      serializeInspectorGradient({ ...model, stops: [{ color: 'red', position }, model.stops[1]] }),
      null,
    );
  assert.equal(
    serializeInspectorGradient({
      ...model,
      stops: Array.from({ length: 9 }, () => ({ color: 'red', position: 50 })),
    }),
    null,
  );
});
test('direct stop manipulation stays between neighbors and never mutates capture', () => {
  const model = readInspectorGradient('linear-gradient(red 20%,green 40%,blue 80%)');
  assert.equal(moveInspectorGradientStop(model, 1, 90).stops[1].position, 80);
  assert.equal(moveInspectorGradientStop(model, 1, -20).stops[1].position, 20);
  assert.equal(model.stops[1].position, 40);
  assert.equal(moveInspectorGradientStop(model, 9, 50), null);
});
test('native background image belongs to Appearance and captured restore keeps its exact CSS', () => {
  const control = { property: 'backgroundImage', kind: 'text', value: 'none' };
  assert.equal(inspectorSections([control], 'container')[0].name, 'Appearance');
  assert.equal(inspectorSections([control], 'text')[0].controls[0].property, 'backgroundImage');
  const before = 'linear-gradient(90deg, rgb(0, 0, 0), rgb(255, 255, 255))';
  assert.equal(
    inspectorSectionRestorePlan(
      'Appearance',
      [control],
      [{ property: control.property, before, after: 'none' }],
    ).items[0].before,
    before,
  );
});
