import { scrubInspectorValue } from './inspector-inputs.js';

// Only opacity has a meaningful, universal bounded scale here. A measured
// width/font size is not a percentage of an arbitrary implementation maximum.
export function inspectorBoundedFill(control, value) {
  if (control.property !== 'opacity' || control.kind !== 'number' || control.mixed) return null;
  if (String(value).trim() === '' || !Number.isFinite(Number(value))) return null;
  const scale = control.sourceScale === 100 ? 100 : 1;
  return Math.min(1, Math.max(0, Number(value) / scale));
}

export function nudgeInspectorValue(control, value, direction, modifiers = {}) {
  if (control.mixed || String(value).trim() === '' || !Number.isFinite(Number(value))) return null;
  const step = modifiers.shiftKey ? 10 : modifiers.altKey ? 0.1 : 1;
  return Math.min(
    control.max ?? Infinity,
    Math.max(control.min ?? -Infinity, Number((Number(value) + direction * step).toFixed(8))),
  );
}

/** Native transaction callbacks own values/Review. This controller owns one
 * pointer only, coalesces previews and never queues an obsolete release. */
export function bindInspectorScrub({
  handle,
  input,
  control,
  begin,
  preview,
  commit,
  cancel,
  isCurrent,
  editText,
}) {
  const doc = handle.ownerDocument,
    win = doc.defaultView,
    field = input.closest('.next-field');
  let gesture = null;
  const detach = (g) => {
    handle.removeEventListener('pointermove', g.move);
    handle.removeEventListener('pointerup', g.up);
    handle.removeEventListener('pointercancel', g.abort);
    handle.removeEventListener('lostpointercapture', g.abort);
    doc.removeEventListener('pointerup', g.up, { capture: true });
    doc.removeEventListener('pointercancel', g.abort, { capture: true });
    doc.removeEventListener('lostpointercapture', g.abort, { capture: true });
    doc.removeEventListener('keydown', g.key, { capture: true });
    win.removeEventListener('blur', g.abort);
    if (g.frame) win.cancelAnimationFrame(g.frame);
    g.frame = 0;
    delete field.dataset.scrubbing;
    if (handle.hasPointerCapture(g.id)) handle.releasePointerCapture(g.id);
  };
  const drain = (g) => {
    if (g.flight) return g.flight;
    g.flight = (async () => {
      while (!g.cancelled && isCurrent(g.edit) && g.pending != null) {
        const value = g.pending;
        g.pending = null;
        if (!(await preview(value))) {
          g.failed = true;
          g.pending = null;
          break;
        }
      }
    })().finally(() => {
      g.flight = null;
    });
    return g.flight;
  };
  const finish = async (g, accept) => {
    if (gesture !== g || g.finishing) return;
    g.finishing = true;
    detach(g);
    if (!accept || !g.moved) {
      g.cancelled = true;
      g.pending = null;
      await g.flight;
      if (isCurrent(g.edit)) await cancel();
    } else {
      await drain(g);
      if (isCurrent(g.edit) && !g.failed) await commit(input.value);
    }
    if (gesture === g) gesture = null;
  };
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || gesture || control.mixed || !Number.isFinite(Number(input.value)))
      return;
    event.preventDefault();
    const g = {
      id: event.pointerId,
      x: event.clientX,
      before: Number(input.value),
      edit: begin(),
      moved: false,
      pending: null,
      frame: 0,
      flight: null,
    };
    gesture = g;
    g.move = (event) => {
      if (event.pointerId !== g.id || g.finishing || !isCurrent(g.edit)) return;
      const delta = event.clientX - g.x;
      if (!g.moved && Math.abs(delta) < 4) return;
      g.moved = true;
      field.dataset.scrubbing = '';
      const value = String(scrubInspectorValue(control, g.before, delta, event));
      if (value === input.value) return;
      input.value = value;
      input.dispatchEvent(new win.Event('foundry-numeric-preview'));
      g.pending = value;
      if (!g.frame)
        g.frame = win.requestAnimationFrame(() => {
          g.frame = 0;
          void drain(g);
        });
    };
    g.up = (event) => {
      if (event.pointerId !== g.id) return;
      const moved = g.moved;
      void finish(g, true).then(() => {
        if (!moved) editText();
      });
    };
    g.abort = (event) => {
      if (event.pointerId != null && event.pointerId !== g.id) return;
      void finish(g, false);
    };
    g.key = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      void finish(g, false);
    };
    handle.addEventListener('pointermove', g.move);
    handle.addEventListener('pointerup', g.up);
    handle.addEventListener('pointercancel', g.abort);
    handle.addEventListener('lostpointercapture', g.abort);
    // A removed capture element delivers loss/up at the document, not the old
    // element. Keep lifecycle cleanup independent of a stale renderer node.
    doc.addEventListener('pointerup', g.up, { capture: true });
    doc.addEventListener('pointercancel', g.abort, { capture: true });
    doc.addEventListener('lostpointercapture', g.abort, { capture: true });
    doc.addEventListener('keydown', g.key, { capture: true });
    win.addEventListener('blur', g.abort);
    handle.setPointerCapture(g.id);
  });
  handle.addEventListener('click', (event) => {
    // Native keyboard activation opens exact text entry; pointer click is handled
    // after the acknowledged no-drag cancellation above.
    if (event.detail === 0 && !gesture) editText();
  });
}
