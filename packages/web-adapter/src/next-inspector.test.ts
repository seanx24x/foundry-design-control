import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sharedInspectorControls,
  inspectorEditProperties,
  supportsInspectorObjectLayout,
  inspectorStyleProperties,
} from './next-inspector.js';

test('object layout is exposed only for rendered image and video elements', () => {
  for (const kind of ['img', 'IMG', 'video', 'VIDEO'])
    assert.equal(supportsInspectorObjectLayout(kind), true);
  for (const kind of ['picture', 'audio', 'source', 'svg', 'canvas', 'div', 'iframe'])
    assert.equal(supportsInspectorObjectLayout(kind), false);
  for (const property of ['objectFit', 'objectPosition'])
    assert.ok(inspectorStyleProperties.has(property));
  for (const property of ['src', 'srcset', 'poster'])
    assert.ok(!inspectorStyleProperties.has(property));
});

test('mixed media edits require object layout support on every target', () => {
  const image = [
    { property: 'objectFit', kind: 'select', value: 'cover', options: ['cover', 'contain'] },
    { property: 'objectPosition', kind: 'text', value: '50% 50%' },
  ];
  const video = image.map((item) => ({
    ...item,
    value: item.property === 'objectFit' ? 'contain' : '0% 0%',
  }));
  assert.ok(sharedInspectorControls([image, video]).every((item) => item.mixed));
  assert.deepEqual(sharedInspectorControls([image, []]), []);
});

test('linked edits expand only named groups to real CSS properties', async () => {
  const { LINKED_INSPECTOR_GROUPS } = await import(
    new URL('../../../apps/inspector/public/next-workspace.js', import.meta.url).href
  );
  for (const [name, properties] of Object.entries(LINKED_INSPECTOR_GROUPS))
    assert.deepEqual(inspectorEditProperties(name), properties);
  assert.deepEqual(inspectorEditProperties('paddingHorizontal'), ['paddingLeft', 'paddingRight']);
  for (const name of ['width', 'imaginaryBatch', '__proto__', 'constructor'])
    assert.deepEqual(inspectorEditProperties(name), [name]);
});

const width = (value: number) => ({ property: 'width', kind: 'number', unit: 'px', value });
test('background image keeps its native CSS and shares only with matching capabilities', () => {
  assert.ok(inspectorStyleProperties.has('backgroundImage'));
  const image = {
    property: 'backgroundImage',
    kind: 'text',
    value: 'linear-gradient(90deg, red, blue)',
  };
  assert.equal(sharedInspectorControls([[image]])[0]?.value, image.value);
  assert.equal(sharedInspectorControls([[image], [{ ...image, value: 'none' }]])[0]?.mixed, true);
  assert.deepEqual(sharedInspectorControls([[image], []]), []);
  assert.deepEqual(inspectorEditProperties('backgroundImage'), ['backgroundImage']);
});
test('shared inspector reports mixed values without replacing them with zero', () => {
  const [control] = sharedInspectorControls([[width(44)], [width(120)]]);
  assert.equal(control?.mixed, true);
  assert.equal(control?.value, 44);
  assert.equal(sharedInspectorControls([[width(44)], [width(44)]])[0]?.mixed, false);
});
test('intersection requires matching property kind and unit across every target', () => {
  assert.deepEqual(sharedInspectorControls([[width(44)], []]), []);
  assert.deepEqual(sharedInspectorControls([[width(44)], [{ ...width(44), unit: '%' }]]), []);
  assert.deepEqual(sharedInspectorControls([[width(44)], [{ ...width(44), kind: 'text' }]]), []);
});
test('shared values retain authored precision only when every target agrees', () => {
  const first = { ...width(70.2812), authoredValue: '70.293px' };
  assert.equal(sharedInspectorControls([[first], [first]])[0]?.authoredValue, '70.293px');
  assert.equal(
    sharedInspectorControls([[first], [{ ...first, authoredValue: '70.29px' }]])[0]?.authoredValue,
    undefined,
  );
});
test('single-target content and font operations cannot become multi-target edits', () => {
  const items = ['textContent', 'alt', 'aria-label', 'fontFamily'].map((property) => ({
    property,
    kind: 'text',
    value: 'value',
  }));
  assert.equal(sharedInspectorControls([items]).length, 4);
  assert.deepEqual(sharedInspectorControls([items, items]), []);
});
test('shared chooser only exposes options every target supports', () => {
  const first = { property: 'display', kind: 'select', value: 'flex', options: ['flex', 'grid'] };
  assert.deepEqual(
    sharedInspectorControls([[first], [{ ...first, options: ['flex'] }]])[0]?.options,
    ['flex'],
  );
});
