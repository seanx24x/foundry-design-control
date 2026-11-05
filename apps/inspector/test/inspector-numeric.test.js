import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bindInspectorScrub,
  inspectorBoundedFill,
  nudgeInspectorValue,
} from '../public/inspector-numeric.js';

const size = { kind: 'number', property: 'width', min: 0, max: 400 };
test('fill is reserved for meaningful opacity bounds, never inferred dimensions', () => {
  assert.equal(inspectorBoundedFill(size, 200), null);
  assert.equal(inspectorBoundedFill({ ...size, property: 'opacity' }, 0.755), 0.755);
  assert.equal(
    inspectorBoundedFill({ ...size, property: 'opacity', sourceScale: 100 }, 75.5),
    0.755,
  );
  for (const value of ['', 'bad'])
    assert.equal(inspectorBoundedFill({ ...size, property: 'opacity' }, value), null);
  assert.equal(inspectorBoundedFill({ ...size, property: 'opacity', mixed: true }, 1), null);
});
test('keyboard steps preserve typed decimals, modifier precision and bounds', () => {
  assert.equal(nudgeInspectorValue(size, '12.25', 1), 13.25);
  assert.equal(nudgeInspectorValue(size, '12.25', -1, { altKey: true }), 12.15);
  assert.equal(nudgeInspectorValue(size, '12.25', 1, { shiftKey: true }), 22.25);
  assert.equal(nudgeInspectorValue(size, '399', 1, { shiftKey: true }), 400);
  assert.equal(nudgeInspectorValue(size, '0', -1), 0);
  assert.equal(nudgeInspectorValue(size, '', 1), null);
  assert.equal(nudgeInspectorValue({ ...size, mixed: true }, '4', 1), null);
});
const emit = (target, type, properties = {}) => {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, properties);
  target.dispatchEvent(event);
  return event;
};
const settle = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
function fixture({ previewResult = true, hold = false } = {}) {
  const doc = new EventTarget(),
    win = new EventTarget(),
    handle = new EventTarget(),
    input = new EventTarget(),
    field = { dataset: {} },
    frames = new Map(),
    calls = [];
  let current,
    frameId = 0,
    capture,
    release;
  win.Event = Event;
  win.requestAnimationFrame = (callback) => {
    frames.set(++frameId, callback);
    return frameId;
  };
  win.cancelAnimationFrame = (id) => frames.delete(id);
  doc.defaultView = win;
  handle.ownerDocument = doc;
  input.value = '100';
  input.closest = () => field;
  handle.setPointerCapture = (id) => (capture = id);
  handle.hasPointerCapture = (id) => capture === id;
  handle.releasePointerCapture = (id) => {
    capture = null;
    emit(handle, 'lostpointercapture', { pointerId: id });
  };
  bindInspectorScrub({
    handle,
    input,
    control: size,
    begin: () => (current = {}),
    isCurrent: (edit) => edit === current,
    preview: async (value) => {
      calls.push(['preview', value]);
      if (hold) await new Promise((resolve) => (release = resolve));
      return previewResult;
    },
    commit: async (value) => {
      calls.push(['commit', value]);
      current = null;
    },
    cancel: async () => {
      calls.push(['cancel']);
      current = null;
      input.value = '100';
    },
    editText: () => calls.push(['editText']),
  });
  return {
    doc,
    win,
    handle,
    input,
    field,
    calls,
    frame: () => {
      for (const [id, callback] of [...frames]) {
        frames.delete(id);
        callback();
      }
    },
    release: () => release?.(),
    invalidate: () => (current = null),
    down: () => emit(handle, 'pointerdown', { button: 0, pointerId: 7, clientX: 10 }),
    move: (x, id = 7) => emit(handle, 'pointermove', { pointerId: id, clientX: x }),
    up: () => emit(handle, 'pointerup', { pointerId: 7 }),
  };
}
test('scrubbing follows direct delta and previews on a frame before release', async () => {
  const f = fixture();
  f.down();
  f.move(30);
  assert.equal(f.input.value, '120');
  assert.equal(f.field.dataset.scrubbing, '');
  assert.deepEqual(f.calls, []);
  f.frame();
  await settle();
  assert.deepEqual(f.calls, [['preview', '120']]);
  f.up();
  await settle();
  assert.deepEqual(f.calls, [
    ['preview', '120'],
    ['commit', '120'],
  ]);
  assert.equal(f.field.dataset.scrubbing, undefined);
});
test('one in-flight preview coalesces later moves and releases the final value once', async () => {
  const f = fixture({ hold: true });
  f.down();
  f.move(20);
  f.frame();
  await settle();
  f.move(25);
  f.move(30);
  f.frame();
  f.up();
  await settle();
  assert.deepEqual(f.calls, [['preview', '110']]);
  f.release();
  await settle();
  assert.deepEqual(f.calls, [
    ['preview', '110'],
    ['preview', '120'],
  ]);
  f.release();
  await settle();
  assert.deepEqual(f.calls, [
    ['preview', '110'],
    ['preview', '120'],
    ['commit', '120'],
  ]);
});
for (const type of ['pointercancel', 'lostpointercapture', 'blur', 'Escape'])
  test(`${type} cancels a drag without committing`, async () => {
    const f = fixture();
    f.down();
    f.move(30);
    f.frame();
    await settle();
    if (type === 'Escape') emit(f.doc, 'keydown', { key: 'Escape' });
    else emit(type === 'blur' ? f.win : f.handle, type, type === 'blur' ? {} : { pointerId: 7 });
    f.up();
    await settle();
    assert.deepEqual(f.calls, [['preview', '120'], ['cancel']]);
    assert.equal(f.input.value, '100');
    assert.equal(f.field.dataset.scrubbing, undefined);
  });
test('cancelling waits for the in-flight preview and discards queued values', async () => {
  const f = fixture({ hold: true });
  f.down();
  f.move(20);
  f.frame();
  await settle();
  f.move(30);
  emit(f.doc, 'keydown', { key: 'Escape' });
  assert.deepEqual(f.calls, [['preview', '110']]);
  f.release();
  await settle();
  assert.deepEqual(f.calls, [['preview', '110'], ['cancel']]);
});
test('a foreign pointer cannot move or finish the captured gesture', async () => {
  const f = fixture();
  f.down();
  f.move(40, 8);
  emit(f.handle, 'pointerup', { pointerId: 8 });
  assert.equal(f.input.value, '100');
  f.move(20);
  f.up();
  await settle();
  assert.deepEqual(f.calls, [
    ['preview', '110'],
    ['commit', '110'],
  ]);
});
test('no-drag label click opens text entry without accepting a value', async () => {
  const f = fixture();
  f.down();
  f.move(12);
  f.up();
  await settle();
  assert.deepEqual(f.calls, [['cancel'], ['editText']]);
});
test('rejected previews and stale selections never commit', async () => {
  const f = fixture({ previewResult: false });
  f.down();
  f.move(20);
  f.up();
  await settle();
  assert.deepEqual(f.calls, [['preview', '110']]);
  const stale = fixture({ hold: true });
  stale.down();
  stale.move(20);
  stale.frame();
  await settle();
  stale.invalidate();
  stale.up();
  stale.release();
  await settle();
  assert.deepEqual(stale.calls, [['preview', '110']]);
});
test('document-level capture loss cleans up a removed field and its Escape listener', async () => {
  const f = fixture();
  f.down();
  f.move(20);
  f.frame();
  await settle();
  f.invalidate();
  emit(f.doc, 'lostpointercapture', { pointerId: 7 });
  await settle();
  const escape = emit(f.doc, 'keydown', { key: 'Escape' });
  assert.equal(escape.defaultPrevented, false);
  assert.equal(f.field.dataset.scrubbing, undefined);
  assert.deepEqual(f.calls, [['preview', '110']]);
});
