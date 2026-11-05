import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectorAxisControl, inspectorBorderVisibility } from '../public/inspector-layout.js';
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
