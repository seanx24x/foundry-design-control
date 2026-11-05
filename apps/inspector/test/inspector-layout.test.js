import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectorAxisControl,
  inspectorBorderVisibility,
  inspectorFieldIsFull,
  inspectorSingletons,
} from '../public/inspector-layout.js';
test('single compact fields span the row without splitting pairs or crossing full-width items', () => {
  assert.deepEqual(inspectorSingletons([false]), [0]);
  assert.deepEqual(inspectorSingletons([false, false]), []);
  assert.deepEqual(inspectorSingletons([false, false, false]), [2]);
  assert.deepEqual(inspectorSingletons([false, true, false, true]), [0, 2]);
  assert.deepEqual(inspectorSingletons([false, false, true, false, true, false, false]), [3]);
  assert.deepEqual(inspectorSingletons([true, true]), []);
});
test('compound CSS, option names and authored content get a full studio row without rewriting values', () => {
  for (const control of [
    { property: 'objectPosition', kind: 'text', value: '50% 50%' },
    { property: 'objectPosition', kind: 'text', value: 'left top' },
    { property: 'objectFit', kind: 'select', value: 'scale-down' },
    { property: 'minWidth', kind: 'text', value: 'calc(100% - 2rem)' },
    { property: 'width', kind: 'number', value: 10000000 },
    { property: 'fontSize', kind: 'number', value: 70, authoredValue: '70.12345px', unit: 'px' },
  ]) {
    const before = structuredClone(control);
    assert.equal(inspectorFieldIsFull(control, true), true);
    assert.deepEqual(control, before);
  }
});
test('ordinary measurements remain paired; mixed state and legacy layouts are preserved', () => {
  for (const value of [12, 224, 1024, 70.123456])
    assert.equal(inspectorFieldIsFull({ property: 'width', kind: 'number', value }, true), false);
  assert.equal(
    inspectorFieldIsFull({ property: 'width', kind: 'number', mixed: true, value: 10 }, true),
    false,
  );
  assert.equal(
    inspectorFieldIsFull({ property: 'objectPosition', kind: 'text', value: '50% 50%' }),
    false,
  );
  assert.equal(
    inspectorFieldIsFull({ property: 'backgroundImage', kind: 'text', value: 'none' }),
    true,
  );
  assert.equal(
    inspectorFieldIsFull({ property: 'width', kind: 'number', full: true, value: 10 }),
    true,
  );
});
const controls = [
  { property: 'display', value: 'flex' },
  { property: 'flexDirection', value: 'row' },
  {
    property: 'justifyContent',
    kind: 'select',
    value: 'center',
    options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
  },
  {
    property: 'alignItems',
    kind: 'select',
    value: 'stretch',
    options: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'],
  },
];
test('Flex shortcuts use logical axes and preserve every native option', () => {
  const main = inspectorAxisControl(controls[2], controls),
    cross = inspectorAxisControl(controls[3], controls);
  assert.equal(main.axis, 'Main axis');
  assert.equal(cross.axis, 'Cross axis');
  assert.deepEqual(
    main.presets.map((item) => item.value),
    ['flex-start', 'center', 'flex-end'],
  );
  assert.equal(main.presets[1].selected, true);
  assert.equal(main.expanded, false);
  assert.ok(cross.presets.every((item) => !item.selected));
  assert.equal(cross.expanded, true);
  assert.ok(controls[2].options.includes('space-between'));
  assert.ok(controls[3].options.includes('baseline'));
});
test('column/reversed flows keep logical start/end rather than claim physical top/left', () => {
  for (const value of ['row', 'row-reverse', 'column', 'column-reverse']) {
    const list = controls.map((item) =>
      item.property === 'flexDirection' ? { ...item, value } : item,
    );
    const model = inspectorAxisControl(list[2], list);
    assert.equal(model.flow, value);
    assert.equal(model.axis, 'Main axis');
    assert.deepEqual(
      model.presets.map((item) => item.label),
      ['Start', 'Center', 'End'],
    );
  }
});
test('Grid, missing capabilities and ambiguous multi-selection retain native selectors', () => {
  for (const display of [{ value: 'grid' }, { value: 'block' }, { value: 'flex', mixed: true }]) {
    const list = controls.map((item) =>
      item.property === 'display' ? { ...item, ...display } : item,
    );
    assert.equal(inspectorAxisControl(list[2], list), null);
  }
  assert.equal(inspectorAxisControl(controls[2], controls.slice(1)), null);
  assert.equal(inspectorAxisControl({ ...controls[2], kind: 'text' }, controls), null);
  assert.equal(inspectorAxisControl({ ...controls[2], options: ['center'] }, controls), null);
  const mixed = controls.map((item) =>
    item.property === 'flexDirection' ? { ...item, mixed: true } : item,
  );
  assert.equal(inspectorAxisControl(mixed[2], mixed), null);
});
test('mixed alignment never chooses or implies the first selected value', () => {
  const model = inspectorAxisControl({ ...controls[2], mixed: true }, controls);
  assert.ok(model.presets.every((item) => !item.selected));
  assert.equal(model.expanded, true);
});
const border = [
  { property: 'borderWidth', kind: 'number', value: 0 },
  { property: 'borderColor', kind: 'color', value: '#abc123' },
];
test('zero-width color collapses without modifying authored color', () => {
  const before = structuredClone(border);
  assert.deepEqual(inspectorBorderVisibility(border, 0), {
    canCollapse: true,
    colorVisible: false,
  });
  assert.deepEqual(inspectorBorderVisibility(border, '0', true), {
    canCollapse: true,
    colorVisible: true,
  });
  assert.deepEqual(border, before);
});
test('positive, unknown, empty, invalid and mixed border values remain inspectable', () => {
  for (const value of [2, '0 1px', '', -2, 'bad'])
    assert.equal(inspectorBorderVisibility(border, value).colorVisible, true);
  for (const index of [0, 1]) {
    const mixed = border.map((item, i) => (i === index ? { ...item, mixed: true } : item));
    assert.equal(inspectorBorderVisibility(mixed, 0).colorVisible, true);
  }
  assert.equal(
    inspectorBorderVisibility([{ ...border[0], kind: 'text' }, border[1]], '0').colorVisible,
    true,
  );
  assert.equal(inspectorBorderVisibility(border.slice(1), 0).colorVisible, true);
});
