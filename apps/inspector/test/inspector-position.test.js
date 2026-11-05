import test from 'node:test';
import assert from 'node:assert/strict';
import { readInspectorPosition, positionFromPointer } from '../public/inspector-position.js';
test('percentage pairs map to a spatial pad without rounding authored precision', () => {
  assert.deepEqual(readInspectorPosition('50% 50%'), { x: 50, y: 50 });
  assert.deepEqual(readInspectorPosition('12.345678% 99.123456%'), { x: 12.345678, y: 99.123456 });
  assert.deepEqual(readInspectorPosition(' +0%\t100.0% '), { x: 0, y: 100 });
});
test('advanced CSS, mixed, edge offsets and positions outside the pad are never flattened', () => {
  for (const value of [
    'left top',
    'center',
    'right 12px bottom 8px',
    'calc(100% - 2rem) 30%',
    'var(--position)',
    '-10% 120%',
    'Mixed',
    '',
    '50 50',
    '50% 50%;color:red',
  ])
    assert.equal(readInspectorPosition(value), null, value);
});
test('pad maps each axis directly, preserves the grab offset and bounds only the user gesture', () => {
  const rect = { left: 10, top: 20, width: 200, height: 100 };
  assert.deepEqual(positionFromPointer({ x: 110, y: 70 }, rect), { x: 50, y: 50 });
  assert.deepEqual(positionFromPointer({ x: 120, y: 75 }, rect, { x: 10, y: 5 }), { x: 50, y: 50 });
  assert.deepEqual(positionFromPointer({ x: -100, y: 300 }, rect), { x: 0, y: 100 });
  assert.equal(positionFromPointer({ x: 0, y: 0 }, { ...rect, width: 0 }), null);
});
