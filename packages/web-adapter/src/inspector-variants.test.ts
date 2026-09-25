import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectorVariantAttributes, restoreVariantAttributes } from './inspector-variants.js';

const variant = {
  id: 'quiet',
  name: 'Quiet',
  props: { story: 'Quiet', iconSize: 16, selected: false },
  source: { file: 'style.css', line: 1 },
};
test('variant attributes preserve indexed primitive values and camel-case mapping', () => {
  assert.deepEqual(inspectorVariantAttributes(variant), [
    ['data-story', 'Quiet'],
    ['data-icon-size', '16'],
    ['data-selected', 'false'],
  ]);
});
test('unmapped, complex and reserved variant props are rejected', () => {
  assert.throws(() => inspectorVariantAttributes({ ...variant, source: undefined }), /source/);
  assert.throws(() => inspectorVariantAttributes({ ...variant, props: {} }), /no primitive/);
  for (const property of ['foundryToken', 'foo.bar', 'data-story', 'on click'])
    assert.throws(
      () => inspectorVariantAttributes({ ...variant, props: { [property]: 'value' } }),
      /mapping/,
    );
  assert.throws(() => inspectorVariantAttributes({ ...variant, props: { size: NaN } }), /mapping/);
});
test('variant cancellation distinguishes an absent attribute from an empty value', () => {
  const attributes = new Map([
    ['data-empty', ''],
    ['data-story', 'Primary'],
    ['data-other', 'keep'],
  ]);
  const element = {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => {
      attributes.set(name, value);
    },
    removeAttribute: (name: string) => {
      attributes.delete(name);
    },
  };
  const restore = restoreVariantAttributes(element, ['data-empty', 'data-story', 'data-missing']);
  element.setAttribute('data-empty', 'new');
  element.setAttribute('data-story', 'Quiet');
  element.setAttribute('data-missing', 'new');
  restore();
  assert.deepEqual(
    [...attributes],
    [
      ['data-empty', ''],
      ['data-story', 'Primary'],
      ['data-other', 'keep'],
    ],
  );
});
