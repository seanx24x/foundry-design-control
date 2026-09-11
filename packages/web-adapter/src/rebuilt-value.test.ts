import assert from 'node:assert/strict';
import test from 'node:test';
import { rebuiltPropertyValueMatches } from './rebuilt-value.js';

test('does not reduce CSS shorthand or multi-value properties to their first number', () => {
  assert.equal(rebuiltPropertyValueMatches('borderRadius', '8px', '8px 0px 0px'), false);
  assert.equal(rebuiltPropertyValueMatches('padding', '8px', '8px 20px'), false);
  assert.equal(rebuiltPropertyValueMatches('borderWidth', '1px', '1px 0 0'), false);
});

test('canonically compares complete shorthand and nonnumeric values', () => {
  assert.equal(rebuiltPropertyValueMatches('padding', '8px   20px', '8px 20px'), true);
  assert.equal(
    rebuiltPropertyValueMatches('boxShadow', '0 4px 8px rgb(0, 0, 0)', '0 4px 8px rgb(0,0,0)'),
    true,
  );
  assert.equal(
    rebuiltPropertyValueMatches('justifyContent', 'space-between', 'space-between'),
    true,
  );
  assert.equal(rebuiltPropertyValueMatches('justifyContent', 'space-between', 'center'), false);
});

test('allows small rendering tolerance only on explicitly scalar properties', () => {
  assert.equal(rebuiltPropertyValueMatches('width', '44.006px', '44px'), true);
  assert.equal(rebuiltPropertyValueMatches('opacity', '0.50001', 0.5), true);
  assert.equal(rebuiltPropertyValueMatches('width', '44.02px', '44px'), false);
  assert.equal(rebuiltPropertyValueMatches('padding', '8.00001px', '8px'), false);
});

test('converts compatible absolute length, angle, and time units', () => {
  assert.equal(rebuiltPropertyValueMatches('width', '96px', '1in'), true);
  assert.equal(rebuiltPropertyValueMatches('rotate', '180deg', '0.5turn'), true);
  assert.equal(rebuiltPropertyValueMatches('motion.motion_1.duration', 500, '0.5s'), true);
  assert.equal(rebuiltPropertyValueMatches('motion.motion_1.delay', 250, '250ms'), true);
});

test('does not equate context-dependent or invalid scalar units', () => {
  assert.equal(rebuiltPropertyValueMatches('width', '16px', '1rem'), false);
  assert.equal(rebuiltPropertyValueMatches('width', '44px', 44), false);
  assert.equal(rebuiltPropertyValueMatches('opacity', '0.5%', '0.5'), false);
  assert.equal(rebuiltPropertyValueMatches('rotate', '180deg', '3.14159px'), false);
});

test('understands scalar motion values without relaxing keyframe value strings', () => {
  assert.equal(rebuiltPropertyValueMatches('motion.motion_1.iterations', 2, '2.00001'), true);
  assert.equal(rebuiltPropertyValueMatches('motion.motion_1.keyframe.1.offset', 84, '84%'), true);
  assert.equal(
    rebuiltPropertyValueMatches(
      'motion.motion_1.keyframe.1.transform',
      'translateX(8px)',
      'translateX(8px) scale(2)',
    ),
    false,
  );
});
