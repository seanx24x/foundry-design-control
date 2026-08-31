import test from 'node:test';
import assert from 'node:assert/strict';
import {
  layerSelectionScore,
  nextCycleIndex,
  orderedSelectionIndexes,
  snapValue,
  spacingSegments,
} from './canvas.js';

test('prioritizes instrumented and interactive layers over decorative descendants', () => {
  const decorative = layerSelectionScore({
    instrumented: false,
    interactive: false,
    semantic: false,
    labelled: false,
    decorative: true,
    area: 64,
    depth: 6,
  });
  const button = layerSelectionScore({
    instrumented: true,
    interactive: true,
    semantic: true,
    labelled: true,
    decorative: false,
    area: 4000,
    depth: 4,
  });
  assert.ok(button > decorative);
  assert.deepEqual(
    orderedSelectionIndexes([
      {
        instrumented: false,
        interactive: false,
        semantic: false,
        labelled: false,
        decorative: true,
        area: 64,
        depth: 6,
      },
      {
        instrumented: true,
        interactive: true,
        semantic: true,
        labelled: true,
        decorative: false,
        area: 4000,
        depth: 4,
      },
    ]),
    [1, 0],
  );
});

test('cycles overlapping targets without leaving the stack', () => {
  assert.equal(nextCycleIndex(-1, 3), 0);
  assert.equal(nextCycleIndex(0, 3), 1);
  assert.equal(nextCycleIndex(2, 3), 0);
  assert.equal(nextCycleIndex(0, 0), -1);
});

test('snaps only to the closest guide inside the tolerance', () => {
  assert.deepEqual(snapValue(98, [40, 100, 102]), { value: 100, guide: 100 });
  assert.deepEqual(snapValue(94, [100]), { value: 94 });
});

test('measures horizontal and vertical gaps between selected layers', () => {
  assert.deepEqual(
    spacingSegments([
      { left: 0, top: 0, width: 20, height: 20 },
      { left: 28, top: 0, width: 20, height: 20 },
      { left: 56, top: 0, width: 20, height: 20 },
    ]).map((segment) => ({ axis: segment.axis, gap: segment.gap })),
    [
      { axis: 'horizontal', gap: 8 },
      { axis: 'horizontal', gap: 8 },
    ],
  );
  const vertical = spacingSegments([
    { left: 0, top: 0, width: 20, height: 20 },
    { left: 0, top: 32, width: 20, height: 20 },
  ]);
  assert.equal(vertical[0]?.gap, 12);

  const variedWidthStack = spacingSegments([
    { left: 0, top: 0, width: 70, height: 16 },
    { left: 0, top: 24, width: 430, height: 80 },
    { left: 0, top: 120, width: 430, height: 48 },
  ]);
  assert.deepEqual(
    variedWidthStack.map((segment) => ({ axis: segment.axis, gap: segment.gap })),
    [
      { axis: 'vertical', gap: 8 },
      { axis: 'vertical', gap: 16 },
    ],
  );
});
