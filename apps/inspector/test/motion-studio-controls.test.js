import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MOTION_CURVE_PRESETS,
  matchingMotionPreset,
  motionPresetPath,
  motionPresetParameters,
  motionTimingValue,
  motionNumericValid,
  bindMotionCurveHandle,
} from '../public/motion-studio-controls.js';
test('timing values preserve fractions and zero without manufacturing missing values', () => {
  assert.equal(motionTimingValue(425.75), '425.75');
  assert.equal(motionTimingValue(-12.5), '-12.5');
  assert.equal(motionTimingValue(0), '0');
  for (const value of [undefined, null, '', ' ', NaN, Infinity, 'auto'])
    assert.equal(motionTimingValue(value), '');
});
test('numeric editing rejects empty and nonfinite values rather than converting to zero', () => {
  for (const value of ['', ' ', null, undefined, NaN, Infinity, 'bad', -1])
    assert.equal(motionNumericValid(value, 0), false);
  assert.equal(motionNumericValid(0, 0), true);
  assert.equal(motionNumericValid(-12.5), true);
  assert.equal(motionNumericValid(1.001, 0, 1), false);
});
test('preset selection compares actual parameters and never guesses from a curve kind', () => {
  const cubicBezier = { x1: 0.16, y1: 1, x2: 0.3, y2: 1 };
  assert.equal(matchingMotionPreset({ kind: 'cubic-bezier', cubicBezier }), 'ease-out');
  assert.equal(
    matchingMotionPreset({ kind: 'cubic-bezier', cubicBezier: { ...cubicBezier, x1: 0.2 } }),
    null,
  );
  assert.equal(
    matchingMotionPreset({ kind: 'spring', spring: MOTION_CURVE_PRESETS.spring[0] }),
    'gentle',
  );
  for (const curve of [null, {}, { kind: 'custom' }, { kind: 'cubic-bezier' }])
    assert.equal(matchingMotionPreset(curve), null);
});
test('preset payloads are complete, bounded and independent of absent editor fields', () => {
  for (const [kind, presets] of Object.entries(MOTION_CURVE_PRESETS))
    for (const preset of presets) {
      const value = motionPresetParameters(kind, preset);
      assert.equal(value.kind, kind);
      assert.equal(Object.keys(value).length, 5);
      assert.equal('id' in value, false);
    }
  assert.equal(motionPresetParameters('custom', {}), null);
  assert.equal(motionPresetParameters('cubic-bezier', { x1: '', y1: 0, x2: 1, y2: 1 }), null);
});
test('preset diagrams are finite deterministic paths for the actual built-in parameters', () => {
  for (const [kind, presets] of Object.entries(MOTION_CURVE_PRESETS))
    for (const preset of presets) {
      const path = motionPresetPath(kind, preset);
      assert.match(path, /^M2(?:\.00)? 22/);
      assert.doesNotMatch(path, /NaN|Infinity/);
      assert.equal(path, motionPresetPath(kind, preset));
    }
  assert.equal(motionPresetPath('custom', {}), '');
});
function fixture() {
  const doc = new EventTarget(),
    win = new EventTarget();
  doc.defaultView = win;
  const handle = new EventTarget();
  handle.ownerDocument = doc;
  handle.isConnected = true;
  let capture = false,
    value = { x: 0.2, y: 0.8 },
    commits = 0;
  const states = [];
  handle.getAttribute = () => 'false';
  handle.focus = () => {};
  handle.hasPointerCapture = () => capture;
  handle.setPointerCapture = () => (capture = true);
  handle.releasePointerCapture = () => {
    capture = false;
    handle.dispatchEvent(new Event('lostpointercapture'));
  };
  const dispose = bindMotionCurveHandle(handle, {
    read: () => ({ ...value }),
    write: (next) => (value = next),
    geometry: () => ({ width: 240, height: 156 }),
    commit: () => commits++,
    interacting: (state) => states.push(state),
  });
  const event = (target, type, props = {}) => {
    const next = new Event(type, { cancelable: true });
    Object.assign(next, { pointerId: 1, button: 0, clientX: 30, clientY: 50, ...props });
    target.dispatchEvent(next);
    return next;
  };
  return { doc, win, handle, event, value: () => value, commits: () => commits, states, dispose };
}
test('curve handle keeps grab offset, tracks local movement and commits once on release', () => {
  const f = fixture();
  f.event(f.handle, 'pointerdown');
  assert.deepEqual(f.value(), { x: 0.2, y: 0.8 });
  f.event(f.doc, 'pointermove', { clientX: 50.8, clientY: 50 });
  assert.deepEqual(f.value(), { x: 0.3, y: 0.8 });
  assert.equal(f.commits(), 0);
  f.event(f.doc, 'pointerup');
  f.event(f.doc, 'pointerup');
  assert.equal(f.commits(), 1);
  assert.deepEqual(f.states, [true, false]);
});
test('Escape, pointer cancellation, capture loss and blur restore without accepting', () => {
  for (const action of ['Escape', 'pointercancel', 'lostpointercapture', 'blur']) {
    const f = fixture();
    f.event(f.handle, 'pointerdown');
    f.event(f.doc, 'pointermove', { clientX: 60 });
    if (action === 'Escape') f.event(f.doc, 'keydown', { key: 'Escape' });
    else
      f.event(
        action === 'blur' ? f.win : action === 'lostpointercapture' ? f.handle : f.doc,
        action,
      );
    f.event(f.doc, 'pointerup');
    assert.deepEqual(f.value(), { x: 0.2, y: 0.8 }, action);
    assert.equal(f.commits(), 0, action);
    assert.deepEqual(f.states, [true, false]);
  }
});
test('press and release without movement is not an edit; disposed handlers stay inert', () => {
  const f = fixture();
  f.event(f.handle, 'pointerdown');
  f.event(f.doc, 'pointerup');
  assert.equal(f.commits(), 0);
  f.dispose();
  f.event(f.handle, 'pointerdown');
  f.event(f.doc, 'pointermove', { clientX: 100 });
  assert.deepEqual(f.value(), { x: 0.2, y: 0.8 });
});
test('handle limits are bounded and a removed handle cancels instead of saving stale values', () => {
  const f = fixture();
  f.event(f.handle, 'pointerdown');
  f.event(f.doc, 'pointermove', { clientX: 10000, clientY: -10000 });
  assert.deepEqual(f.value(), { x: 1, y: 3 });
  f.handle.isConnected = false;
  f.event(f.doc, 'pointermove');
  f.event(f.doc, 'pointerup');
  assert.equal(f.commits(), 0);
  assert.deepEqual(f.value(), { x: 0.2, y: 0.8 });
});
test('studio retains native payloads and exposes explicit replacement semantics', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /motionTimingValue\(timing.duration\)/);
  assert.match(app, /motionTimingValue\(timing.delay\)/);
  assert.match(app, /studio && !isBezier/);
  assert.match(app, /button.dataset.curveKindSelect === curveEditor.dataset.curveKind/);
  assert.match(app, /motionPresetParameters\(button.dataset.presetKind, button.dataset\)/);
});
