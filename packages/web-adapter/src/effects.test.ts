import assert from 'node:assert/strict';
import test from 'node:test';
import { blurAmount, composeShadowEffects, parseShadowEffects, replaceBlur } from './effects.js';

test('round trips editable drop and inner shadows', () => {
  const value = 'rgba(0, 0, 0, 0.12) 0px 4px 8px 0px, rgba(12, 24, 48, 0.25) 1px 2px 4px 1px inset';
  const parsed = parseShadowEffects(value);
  assert.deepEqual(parsed, [
    {
      kind: 'drop-shadow',
      x: 0,
      y: 4,
      blur: 8,
      spread: 0,
      color: '#000000',
      opacity: 0.12,
    },
    {
      kind: 'inner-shadow',
      x: 1,
      y: 2,
      blur: 4,
      spread: 1,
      color: '#0c1830',
      opacity: 0.25,
    },
  ]);
  assert.equal(
    composeShadowEffects(parsed),
    '0px 4px 8px 0px rgb(0 0 0 / 12%), inset 1px 2px 4px 1px rgb(12 24 48 / 25%)',
  );
});

test('edits blur without discarding other filters', () => {
  assert.equal(blurAmount('saturate(1.2) blur(8px)'), 8);
  assert.equal(replaceBlur('saturate(1.2) blur(8px)', 12), 'blur(12px) saturate(1.2)');
  assert.equal(replaceBlur('blur(4px)', null), 'none');
});
