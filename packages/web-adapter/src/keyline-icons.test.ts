import assert from 'node:assert/strict';
import test from 'node:test';
import { KEYLINE_ICONS } from './keyline-icons.js';

const expectedSemantics = [
  'accessibility',
  'activity',
  'align-horizontal-space-around',
  'arrow-down',
  'arrow-left',
  'arrow-up',
  'bookmark',
  'box',
  'check',
  'chevron-down',
  'chevron-right',
  'columns-3',
  'command',
  'component',
  'contrast',
  'eye',
  'eye-off',
  'file-text',
  'layout-grid',
  'layers-3',
  'link-2',
  'lock',
  'maximize-2',
  'mouse-pointer-2',
  'interact',
  'palette',
  'panels-top-left',
  'play',
  'redo-2',
  'rotate-ccw',
  'save',
  'sparkles',
  'triangle-alert',
  'type',
  'undo-2',
  'unlink-2',
  'wand-sparkles',
  'x',
] as const;

test('every Foundry icon semantic resolves to normalized 24px Keyline artwork', () => {
  assert.deepEqual(Object.keys(KEYLINE_ICONS).sort(), [...expectedSemantics].sort());
  for (const semantic of expectedSemantics) {
    const icon = KEYLINE_ICONS[semantic];
    assert.ok(icon, semantic);
    assert.equal(icon.width ?? 24, 24, semantic);
    assert.equal(icon.height ?? 24, 24, semantic);
    assert.match(icon.body, /currentColor/, semantic);
    assert.doesNotMatch(icon.body, /stroke-width="(?!1")/, semantic);
    assert.match(icon.body, /vector-effect="non-scaling-stroke"/, semantic);
  }
});
