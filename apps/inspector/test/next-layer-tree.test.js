import assert from 'node:assert/strict';
import test from 'node:test';
import { layerTreeRows } from '../public/next-layer-tree.js';

const layer = (id, depth, kind = 'div') => ({
  id,
  selector: `#${id}`,
  label: id,
  depth,
  kind,
});
const layers = [
  layer('page', 0),
  layer('section', 1),
  layer('text', 2),
  layer('nested', 2),
  layer('child', 3),
  layer('sibling', 1),
  layer('other', 0),
];
const ids = (rows) => rows.map((row) => row.key);

test('collapse hides the entire subtree but keeps siblings and other roots', () => {
  const rows = layerTreeRows(layers, new Set(['section']));
  assert.deepEqual(ids(rows), ['page', 'section', 'sibling', 'other']);
  assert.equal(rows[1].expandable, true);
  assert.equal(rows[2].expandable, false);
});
test('reopening a parent preserves a separately collapsed child', () => {
  const collapsed = new Set(['section', 'nested']);
  collapsed.delete('section');
  assert.deepEqual(ids(layerTreeRows(layers, collapsed)), [
    'page',
    'section',
    'text',
    'nested',
    'sibling',
    'other',
  ]);
  collapsed.delete('nested');
  assert.deepEqual(
    ids(layerTreeRows(layers, collapsed)),
    layers.map((item) => item.id),
  );
});
test('fresh bridge objects retain collapse state by stable identity, without mutating selection', () => {
  const updated = layers.map((item) => ({ ...item, selected: item.id === 'text' }));
  assert.deepEqual(ids(layerTreeRows(updated, new Set(['section']))), [
    'page',
    'section',
    'sibling',
    'other',
  ]);
  assert.equal(updated.find((item) => item.id === 'text').selected, true);
});
test('document wrappers contain legacy body-relative roots and all their descendants', () => {
  const wrapped = [layer('html', 0, 'html'), layer('body', 1, 'body'), ...layers];
  assert.deepEqual(ids(layerTreeRows(wrapped, new Set(['html']))), ['html']);
  assert.deepEqual(ids(layerTreeRows(wrapped, new Set(['body']))), ['html', 'body']);
  assert.deepEqual(
    layerTreeRows(wrapped)
      .slice(0, 5)
      .map((row) => row.depth),
    [0, 1, 2, 3, 4],
  );
  assert.deepEqual(ids(layerTreeRows([layer('body', 1, 'body'), ...layers], new Set(['body']))), [
    'body',
  ]);
});
test('search includes the complete ancestor path and can collapse its own results', () => {
  assert.deepEqual(ids(layerTreeRows(layers, new Set(), 'CHILD')), [
    'page',
    'section',
    'nested',
    'child',
  ]);
  assert.deepEqual(ids(layerTreeRows(layers, new Set(['nested']), 'child')), [
    'page',
    'section',
    'nested',
  ]);
  assert.deepEqual(layerTreeRows(layers, new Set(), 'missing'), []);
});
test('a truncated list never exposes a chevron that has no available children', () => {
  const rows = layerTreeRows([{ ...layer('truncated', 0), hasChildren: true }]);
  assert.equal(rows[0].expandable, false);
});
test('missing IDs fall back to selector, and empty document selectors remain stable', () => {
  const rows = layerTreeRows(
    [
      { kind: 'html', depth: 0, label: 'html', selector: '' },
      { kind: 'div', depth: 1, label: 'content', selector: '#content' },
    ],
    new Set(['document:html']),
  );
  assert.deepEqual(ids(rows), ['document:html']);
});
