import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNextValue,
  NEXT_TEXT_PROPERTIES,
  selectionCategory,
  inspectorSections,
  linkedInspectorControls,
  LINKED_INSPECTOR_GROUPS,
  inspectorEditHint,
} from '../public/next-workspace.js';
test('inspector distinguishes temporary preview, direction saves and Main Review', () => {
  const direction = { id: 'alternate', name: 'Larger button label' };
  assert.match(inspectorEditHint(direction, 'preview'), /Preview only\. Not saved/);
  assert.match(inspectorEditHint(direction, 'preview'), /Enter saves to “Larger button label”/);
  assert.match(
    inspectorEditHint(direction, 'saved'),
    /Saved to “Larger button label”\. Review is unchanged/,
  );
  assert.match(inspectorEditHint({ id: 'main' }), /Enter adds to Review/);
  assert.match(inspectorEditHint({ id: 'main' }, 'saved'), /Saved to Review/);
  assert.match(inspectorEditHint(direction), /Escape or leaving the field cancels/);
});

test('linked controls preserve unequal and mixed values instead of choosing the first edge', () => {
  const controls = LINKED_INSPECTOR_GROUPS.paddingLinked.map((property, index) => ({
    property,
    kind: 'number',
    unit: 'px',
    value: index % 2 ? 24 : 16,
    min: 0,
    max: 240,
  }));
  const grouped = linkedInspectorControls(controls);
  assert.equal(grouped.find((item) => item.property === 'paddingLinked').mixed, true);
  assert.equal(grouped.find((item) => item.property === 'paddingHorizontal').value, 24);
  assert.equal(grouped.find((item) => item.property === 'paddingVertical').value, 16);
  assert.equal(grouped.find((item) => item.property === 'paddingVertical').mixed, false);
  controls[0].mixed = true;
  assert.equal(
    linkedInspectorControls(controls).find((item) => item.property === 'paddingVertical').mixed,
    true,
  );
});
test('linked fields require every edge with compatible units and never fabricate capabilities', () => {
  const controls = LINKED_INSPECTOR_GROUPS.radiusLinked.map((property) => ({
    property,
    kind: 'number',
    unit: 'px',
    value: 8,
  }));
  assert.equal(linkedInspectorControls(controls)[0].mixed, false);
  assert.deepEqual(linkedInspectorControls(controls.slice(1)), []);
  controls[1].unit = '%';
  assert.deepEqual(linkedInspectorControls(controls), []);
});

test('numeric validation distinguishes invalid, empty and out-of-range values', () => {
  const control = { kind: 'number', label: 'Font size', min: 0, max: 200 };
  for (const value of ['', ' ', 'not a size', 'Infinity', '-1', '201'])
    assert.ok(validateNextValue(control, value));
  for (const value of ['0', '12', '16.5', '200'])
    assert.equal(validateNextValue(control, value), null);
});

test('selection categories prioritize native semantics over component annotations', () => {
  assert.equal(selectionCategory(null), 'empty');
  for (const [kind, expected] of [
    ['h1', 'text'],
    ['div', 'container'],
    ['img', 'media'],
    ['i', 'icon'],
    ['button', 'component'],
  ])
    assert.equal(selectionCategory({ kind, count: 1 }), expected);
  assert.equal(selectionCategory({ kind: 'h1', component: 'Title', count: 1 }), 'text');
  assert.equal(selectionCategory({ kind: 'h1', count: 2 }), 'multiple');
});
test('mixed fields require explicit replacement while decorative alternative text may be empty', () => {
  assert.match(
    validateNextValue({ kind: 'number', label: 'Width', mixed: true }, ''),
    /Mixed is not zero/,
  );
  assert.equal(validateNextValue({ kind: 'number', label: 'Width', mixed: true }, '0'), null);
  assert.equal(
    validateNextValue({ kind: 'text', property: 'alt', label: 'Alternative text' }, ''),
    null,
  );
});
test('sections retain ordering, omit unsupported properties and never duplicate a field', () => {
  const controls = [
    'top',
    'width',
    'fontSize',
    'opacity',
    'textContent',
    'alt',
    'imaginaryVariant',
  ].map((property) => ({ property }));
  const sections = inspectorSections(controls, 'component');
  assert.deepEqual(
    sections.map((item) => item.name),
    ['Position', 'Layout', 'Typography', 'Appearance', 'Content', 'Accessibility'],
  );
  const fields = sections.flatMap((item) => [...item.controls, ...item.advanced]);
  assert.equal(new Set(fields.map((item) => item.property)).size, fields.length);
  assert.ok(!fields.some((item) => item.property === 'imaginaryVariant'));
});
test('media fit and position follow dimensions as a paired primary layout row', () => {
  const controls = ['width', 'height', 'objectFit', 'objectPosition', 'alt'].map((property) => ({
    property,
  }));
  const layout = inspectorSections(controls, 'media').find((section) => section.name === 'Layout');
  assert.deepEqual(
    layout.controls.map((item) => item.property),
    ['width', 'height', 'objectFit', 'objectPosition'],
  );
  assert.ok(layout.controls.every((item) => !item.full));
  assert.ok(!inspectorSections([], 'media').length, 'No inferred capabilities');
  for (const value of ['50% 50%', 'left top', 'right 12px bottom 8px'])
    assert.equal(validateNextValue({ kind: 'text', label: 'Object position' }, value), null);
});
test('CSS-valued controls preserve keywords and authored units for browser validation', () => {
  const control = { kind: 'text', label: 'Line height' };
  for (const value of ['normal', '1.5', '1.25rem', '24px'])
    assert.equal(validateNextValue(control, value), null);
  assert.ok(validateNextValue(control, ''));
  assert.ok(
    !NEXT_TEXT_PROPERTIES.has('textContent'),
    'Rich content is not replaced by a style gesture.',
  );
});
