import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  analyzeMotionPerformance,
  describeCssMotion,
  editableKeyframes,
  motionKeyframeValue,
  normalizeMotionKeyframes,
  parseCssTime,
  splitCssList,
  stableMotionId,
  updateMotionKeyframe,
  type MotionStyleSnapshot,
} from './motion.js';

const snapshot = (partial: Partial<MotionStyleSnapshot> = {}): MotionStyleSnapshot => ({
  animationName: 'none',
  animationDuration: '0s',
  animationDelay: '0s',
  animationTimingFunction: 'ease',
  animationIterationCount: '1',
  animationDirection: 'normal',
  animationFillMode: 'none',
  transitionProperty: 'none',
  transitionDuration: '0s',
  transitionDelay: '0s',
  transitionTimingFunction: 'ease',
  ...partial,
});

test('splits CSS lists without breaking easing functions', () => {
  assert.deepEqual(splitCssList('ease, cubic-bezier(0.2, 0.8, 0.2, 1)'), [
    'ease',
    'cubic-bezier(0.2, 0.8, 0.2, 1)',
  ]);
  assert.equal(parseCssTime('180ms'), 180);
  assert.equal(parseCssTime('0.7s'), 700);
});

test('discovers authored animations and inactive transitions with stable ids', () => {
  const motions = describeCssMotion(
    snapshot({
      animationName: 'button-spin',
      animationDuration: '700ms',
      animationTimingFunction: 'linear',
      animationIterationCount: 'infinite',
      transitionProperty: 'background-color, transform',
      transitionDuration: '160ms, 240ms',
      transitionTimingFunction: 'ease, cubic-bezier(0.2, 0.8, 0.2, 1)',
    }),
  );
  assert.equal(motions.length, 3);
  assert.equal(motions[0]?.label, 'button-spin');
  assert.equal(motions[0]?.timing.duration, 700);
  assert.equal(motions[0]?.timing.iterations, Number.POSITIVE_INFINITY);
  assert.equal(motions[2]?.properties[0], 'transform');
  assert.equal(motions[2]?.timing.easing, 'cubic-bezier(0.2, 0.8, 0.2, 1)');
  assert.equal(
    motions[2]?.id,
    stableMotionId('css-transition', 'transform transition', ['transform']),
  );
});

test('classifies compositor, paint, layout, and unresolved motion', () => {
  assert.equal(analyzeMotionPerformance(['transform', 'opacity']).tier, 'compositor');
  assert.equal(analyzeMotionPerformance(['background-color']).tier, 'paint');
  assert.equal(analyzeMotionPerformance(['width']).tier, 'layout');
  assert.equal(analyzeMotionPerformance(['all']).tier, 'unknown');
});

test('normalizes, edits, and serializes rendered keyframe tracks', () => {
  const frames = normalizeMotionKeyframes([
    {
      offset: null,
      computedOffset: 0,
      easing: 'ease-in',
      composite: 'auto',
      opacity: '0',
      transform: 'translateX(0px)',
    },
    {
      offset: null,
      computedOffset: 1,
      easing: 'linear',
      composite: 'replace',
      opacity: '1',
      transform: 'translateX(24px)',
    },
  ] as ComputedKeyframe[]);
  assert.equal(frames[0]?.offset, 0);
  assert.equal(frames[1]?.values.transform, 'translateX(24px)');
  const moved = updateMotionKeyframe(frames, 1, 'offset', 84);
  const edited = updateMotionKeyframe(moved, 1, 'transform', 'translateX(32px)');
  assert.equal(motionKeyframeValue(edited, 1, 'offset'), 84);
  assert.equal(motionKeyframeValue(edited, 1, 'transform'), 'translateX(32px)');
  assert.deepEqual(editableKeyframes(edited)[1], {
    opacity: '1',
    transform: 'translateX(32px)',
    offset: 0.84,
    easing: 'linear',
    composite: 'replace',
  });
});

test('keeps playback transport out of the source-bound change ledger', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const commandStart = source.indexOf("message.command === 'motion-action'");
  const commandEnd = source.indexOf("message.command === 'set-context'", commandStart);
  assert.ok(commandStart > 0 && commandEnd > commandStart);
  const workspaceTransport = source.slice(commandStart, commandEnd);
  assert.match(workspaceTransport, /animation\.playbackRate =/);
  assert.match(workspaceTransport, /animation\.currentTime = 0/);
  assert.doesNotMatch(workspaceTransport, /\brecord\s*\(/);
});

test('workspace bridge serializes and accepts motion studio commands', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /motions: selected \? workspaceMotionSnapshot\(selected\) : \[\]/);
  assert.match(source, /message\.command === 'motion-action'/);
  assert.match(source, /action === 'scrub'/);
  assert.match(source, /action === 'duration'/);
  assert.match(source, /applyMotionTiming\(motion, action, after\)/);
  assert.match(source, /action === 'keyframe-value'/);
  assert.match(source, /applyMotionKeyframe\(motion, Number\(payload\.index\), property, after\)/);
  assert.match(source, /motionKeyframeValue\(/);
});
