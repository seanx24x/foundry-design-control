import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  analyzeMotionPerformance,
  describeCssMotion,
  editableKeyframes,
  motionKeyframeValue,
  motionCurveSnapshot,
  motionPathSnapshot,
  motionTranslation,
  nativeMotionBinding,
  normalizeMotionKeyframes,
  parseMotionCurve,
  parseCssTime,
  sampleCubicBezier,
  sampleSpring,
  serializeCubicBezier,
  serializeSpring,
  splitCssList,
  springLinearEasing,
  springSettlingDuration,
  stableMotionId,
  replaceMotionTranslation,
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

test('parses, clamps, samples, and serializes cubic Bezier curves exactly', () => {
  assert.deepEqual(parseMotionCurve('ease-out'), {
    kind: 'cubic-bezier',
    x1: 0,
    y1: 0,
    x2: 0.58,
    y2: 1,
  });
  assert.deepEqual(parseMotionCurve('cubic-bezier(1.5, -3, -0.5, 4)'), {
    kind: 'cubic-bezier',
    x1: 1,
    y1: -2,
    x2: 0,
    y2: 3,
  });
  assert.equal(
    serializeCubicBezier({ x1: 0.16, y1: 1, x2: 0.3, y2: 1 }),
    'cubic-bezier(0.16, 1, 0.3, 1)',
  );
  assert.equal(sampleCubicBezier({ x1: 0, y1: 0, x2: 1, y2: 1 }, 0.5), 0.5);
  const snapshot = motionCurveSnapshot('cubic-bezier(0.2, 0.8, 0.2, 1)');
  assert.equal(snapshot.kind, 'cubic-bezier');
  assert.equal(snapshot.points.length, 61);
  assert.equal(snapshot.sourceValue, 'cubic-bezier(0.2, 0.8, 0.2, 1)');
});

test('turns physical spring parameters into deterministic browser-safe source values', () => {
  const spring = parseMotionCurve('spring(1, 170, 26, 0)');
  assert.deepEqual(spring, {
    kind: 'spring',
    mass: 1,
    stiffness: 170,
    damping: 26,
    velocity: 0,
  });
  assert.equal(
    serializeSpring({ mass: 1, stiffness: 170, damping: 26, velocity: 0 }),
    'spring(1, 170, 26, 0)',
  );
  assert.ok(
    springSettlingDuration({
      mass: 1,
      stiffness: 170,
      damping: 26,
      velocity: 0,
    }) > 100,
  );
  assert.equal(sampleSpring({ mass: 1, stiffness: 170, damping: 26, velocity: 0 }, 0), 0);
  const source = springLinearEasing({
    mass: 1,
    stiffness: 170,
    damping: 26,
    velocity: 0,
  });
  assert.match(source, /^linear\(0 0%,/);
  assert.match(source, / 100%\)$/);
  const snapshot = motionCurveSnapshot(spring);
  assert.equal(snapshot.kind, 'spring');
  assert.equal(snapshot.previewValue, snapshot.sourceValue);
  assert.equal(snapshot.spring?.stiffness, 170);
  assert.equal(snapshot.diagnostics.sampleCount, 31);
});

test('normalizes Motion for React without losing native source semantics', () => {
  const binding = nativeMotionBinding({
    adapter: 'motion',
    label: 'Card entrance',
    from: { x: -24, opacity: 0 },
    to: { x: 0, opacity: 1 },
    transition: { duration: 0.48, delay: 0.08, ease: [0.16, 1, 0.3, 1] },
    source: { file: 'src/Card.tsx', line: 24, symbol: 'Card' },
  });
  assert.equal(binding.timing.duration, 480);
  assert.equal(binding.timing.delay, 80);
  assert.equal(binding.timing.easing, 'cubic-bezier(0.16, 1, 0.3, 1)');
  assert.equal(binding.keyframes[0]?.values.transform, 'translate(-24px, 0px)');
  assert.equal(binding.authoring.sourceProperties.duration, 'transition.duration');
  assert.equal(binding.authoring.source?.file, 'src/Card.tsx');
});

test('normalizes GSAP vars and preserves GSAP property paths', () => {
  const binding = nativeMotionBinding({
    adapter: 'gsap',
    from: { y: 32, opacity: 0 },
    to: { y: 0, opacity: 1 },
    config: { duration: 0.6, delay: 0.1, ease: 'power2.out', repeat: 1, yoyo: true },
  });
  assert.equal(binding.timing.duration, 600);
  assert.equal(binding.timing.delay, 100);
  assert.equal(binding.timing.iterations, 2);
  assert.equal(binding.timing.direction, 'alternate');
  assert.equal(binding.authoring.sourceProperties.easing, 'vars.ease');
  assert.match(binding.timing.easing, /^cubic-bezier/);
});

test('normalizes React Spring tension and friction as physical parameters', () => {
  const binding = nativeMotionBinding({
    adapter: 'react-spring',
    from: { scale: 0.92, opacity: 0 },
    to: { scale: 1, opacity: 1 },
    config: { mass: 1, tension: 210, friction: 24, velocity: 0 },
  });
  assert.equal(binding.curve.kind, 'spring');
  assert.equal(binding.curve.spring?.stiffness, 210);
  assert.equal(binding.curve.spring?.damping, 24);
  assert.equal(
    binding.authoring.sourceProperties.spring,
    'config.mass / tension / friction / velocity',
  );
  assert.match(binding.timing.easing, /^spring\(/);
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

test('extracts and replaces pixel motion translations without losing other transforms', () => {
  assert.deepEqual(motionTranslation('translateX(24px) translateY(-8px) scale(0.9)'), {
    x: 24,
    y: -8,
  });
  assert.deepEqual(motionTranslation('matrix(1, 0, 0, 1, 18, 32)'), {
    x: 18,
    y: 32,
  });
  assert.equal(motionTranslation('translateX(40%)'), null);
  assert.equal(
    replaceMotionTranslation('translateX(24px) rotate(8deg)', 48, -12),
    'translate(48px, -12px) rotate(8deg)',
  );
  assert.equal(
    replaceMotionTranslation('matrix(1, 0, 0, 1, 18, 32)', 44, 16),
    'matrix(1, 0, 0, 1, 44, 16)',
  );
});

test('builds measurable motion paths from transform keyframes', () => {
  const path = motionPathSnapshot([
    {
      index: 0,
      offset: 0,
      easing: 'linear',
      composite: 'auto',
      values: { transform: 'translate(0px, 0px)' },
    },
    {
      index: 1,
      offset: 0.5,
      easing: 'linear',
      composite: 'auto',
      values: { transform: 'translate(30px, 40px)' },
    },
    {
      index: 2,
      offset: 1,
      easing: 'linear',
      composite: 'auto',
      values: { transform: 'translate(60px, 40px)' },
    },
  ]);
  assert.equal(path.supported, true);
  assert.equal(path.points.length, 3);
  assert.deepEqual(path.bounds, {
    minX: 0,
    maxX: 60,
    minY: 0,
    maxY: 40,
    width: 60,
    height: 40,
  });
  assert.equal(path.distance, 80);
  assert.equal(motionPathSnapshot([]).supported, false);
});

test('keeps playback transport out of the source-bound change ledger', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const commandStart = source.indexOf("command === 'motion-action'");
  const commandEnd = source.indexOf("command === 'typography-compare'", commandStart);
  assert.ok(commandStart > 0 && commandEnd > commandStart);
  const workspaceTransport = source.slice(commandStart, commandEnd);
  assert.match(workspaceTransport, /animation\.playbackRate =/);
  assert.match(workspaceTransport, /animation\.currentTime = 0/);
  assert.doesNotMatch(workspaceTransport, /\brecord\s*\(/);
});

test('workspace bridge serializes and accepts motion studio commands', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /motions: selected \? workspaceMotionSnapshot\(selected\) : \[\]/);
  assert.match(source, /command === 'motion-action'/);
  assert.match(source, /action === 'scrub'/);
  assert.match(
    source,
    /\['duration', 'delay', 'easing', 'iterations', 'direction', 'fill'\]\.includes\(action\)/,
  );
  assert.match(source, /action === 'curve'/);
  assert.match(source, /action === 'path-point'/);
  assert.match(source, /motionPathSnapshot/);
  assert.match(source, /motionComparisonBaselines/);
  assert.match(source, /applyMotionCurve\(motion, requestedMotionCurve\(payload\)\)/);
  assert.match(source, /curve:/);
  assert.match(source, /previewMotionCurves/);
  assert.match(source, /applyMotionTiming\([\s\S]*?motion,[\s\S]*?action as/);
  assert.match(source, /reducedMotionProtected:/);
  assert.match(source, /action === 'keyframe-value'/);
  assert.match(source, /applyMotionKeyframe\([\s\S]*?Number\(payload\.index\),[\s\S]*?property,/);
  assert.match(source, /motionKeyframeValue\(/);
  assert.match(source, /function nativeMotionAuthoring\(/);
  assert.match(source, /Project motion preset:/);
  assert.match(source, /native source property:/);
  assert.match(source, /authoring,/);
});
