import { inspectorInputValue } from './inspector-inputs.js';

// Only map literal percentage pairs to a bounded pad. Native keywords, lengths,
// edge offsets, expressions and out-of-range values remain exact CSS, not 50/50.
export function readInspectorPosition(value) {
  const match = String(value)
    .trim()
    .match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))%\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+))%$/);
  if (!match) return null;
  const [x, y] = match.slice(1).map(Number);
  return [x, y].every((n) => Number.isFinite(n) && n >= 0 && n <= 100) ? { x, y } : null;
}

export function positionFromPointer(point, rect, offset = { x: 0, y: 0 }) {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const axis = (n) => Math.round(Math.max(0, Math.min(100, n)) * 10) / 10;
  return {
    x: axis(((point.x - rect.left - offset.x) / rect.width) * 100),
    y: axis(((point.y - rect.top - offset.y) / rect.height) * 100),
  };
}

export function openInspectorPositionEditor({
  control,
  anchor,
  renderIcons,
  preview,
  commit,
  cancel,
  error,
  restoreFocus,
}) {
  const original = inspectorInputValue(control);
  const dialog = document.createElement('dialog');
  dialog.className = 'next-color-picker next-position-editor';
  dialog.setAttribute('aria-label', 'Object position');
  dialog.innerHTML = `<header><strong>Object position</strong><button type="button" data-cancel aria-label="Cancel position selection"><i data-icon="close"></i></button></header>
    <div class="next-position-axes">${['X', 'Y'].map((axis) => `<label><span>${axis}</span><input data-position-axis="${axis.toLowerCase()}" type="text" inputmode="decimal" aria-label="Object position ${axis}" aria-describedby="next-position-status"><span>%</span></label>`).join('')}</div>
    <div class="next-position-pad" tabindex="0" role="group" aria-label="Object position pad" aria-describedby="next-position-help"><div class="next-position-plane">
      ${[0, 50, 100].flatMap((y, row) => [0, 50, 100].map((x, col) => `<button type="button" data-position-preset="${x},${y}" aria-label="Position ${['top', 'center', 'bottom'][row]} ${['left', 'center', 'right'][col]}" style="left:${x}%;top:${y}%"><span></span></button>`)).join('')}
      <span class="next-position-point" aria-hidden="true"></span></div></div>
    <p id="next-position-help" class="next-position-help">Drag to position. Arrow keys adjust 1%; Shift adjusts 10%. Escape cancels a drag.</p>
    <details class="next-position-css"><summary>CSS value</summary><input data-position-css type="text" spellcheck="false" aria-label="Object position CSS" aria-describedby="next-position-status"></details>
    <p id="next-position-status" role="status"></p><button type="button" data-retry hidden>Preview again</button>
    <footer><button type="button" data-cancel>Cancel</button><button type="button" data-use disabled>Use position</button></footer>`;
  const css = dialog.querySelector('[data-position-css]');
  const pad = dialog.querySelector('.next-position-pad');
  const plane = dialog.querySelector('.next-position-plane');
  const marker = dialog.querySelector('.next-position-point');
  const axes = [...dialog.querySelectorAll('[data-position-axis]')];
  const use = dialog.querySelector('[data-use]');
  const retry = dialog.querySelector('[data-retry]');
  const status = dialog.querySelector('[role="status"]');
  let model = control.mixed ? null : readInspectorPosition(original);
  let candidate = null,
    pending = null,
    revision = 0,
    frame = 0,
    flight = null;
  let busy = false,
    disposed = false,
    cleanupDrag = null;
  css.value = control.mixed ? '' : original;
  css.placeholder = control.mixed ? 'Mixed — enter a replacement' : '';
  status.textContent = control.mixed
    ? 'Mixed positions. A preset or CSS replacement changes every selected layer; Undo restores each original.'
    : model
      ? 'Choose an anchor, drag, or enter X and Y. Nothing is saved until Use position.'
      : 'Custom CSS is preserved. Edit it below, or choose an anchor to replace it with percentages.';
  if (!model) dialog.querySelector('details').open = true;
  function paint(updateAxes = true) {
    marker.hidden = !model;
    pad.dataset.custom = String(!model);
    if (model) {
      marker.style.left = `${model.x}%`;
      marker.style.top = `${model.y}%`;
    }
    if (updateAxes)
      for (const input of axes) {
        input.disabled = busy || !model;
        input.value = model ? String(model[input.dataset.positionAxis]) : '';
        input.placeholder = model ? '' : '—';
      }
    for (const button of dialog.querySelectorAll('[data-position-preset]')) {
      const [x, y] = button.dataset.positionPreset.split(',').map(Number);
      button.setAttribute('aria-pressed', String(Boolean(model && model.x === x && model.y === y)));
    }
  }
  function invalid(input, message) {
    ++revision;
    pending = null;
    use.disabled = true;
    retry.hidden = true;
    input.setAttribute('aria-invalid', 'true');
    status.textContent = message;
  }
  const hasInvalid = () => Boolean(dialog.querySelector('[aria-invalid="true"]'));
  async function drain() {
    frame = 0;
    if (flight || busy || disposed || !pending) return;
    const request = pending;
    pending = null;
    flight = Promise.resolve(preview(request.value));
    const ok = await flight;
    flight = null;
    if (busy || disposed) return;
    if (request.revision === revision) {
      use.disabled = !ok;
      retry.hidden = ok;
      status.textContent = ok
        ? 'Preview only. Use position saves this change to Review or the active direction.'
        : error();
    }
    if (pending) frame = requestAnimationFrame(drain);
  }
  function update(value) {
    if (busy || disposed) return;
    candidate = value;
    pending = { value, revision: ++revision };
    use.disabled = true;
    retry.hidden = true;
    status.textContent = 'Loading preview…';
    if (!frame && !flight) frame = requestAnimationFrame(drain);
  }
  function move(next) {
    if (busy || disposed || !next) return;
    model = next;
    css.value = `${model.x}% ${model.y}%`;
    dialog
      .querySelectorAll('[aria-invalid]')
      .forEach((node) => node.removeAttribute('aria-invalid'));
    paint();
    update(css.value);
  }
  axes.forEach((input) => {
    const read = () => {
      if (busy || !model) return;
      const value = input.value.trim() ? Number(input.value) : NaN;
      if (!Number.isFinite(value) || value < 0 || value > 100)
        return invalid(
          input,
          'Use 0–100% for this pad. Other positions can be entered in CSS value.',
        );
      input.removeAttribute('aria-invalid');
      model = { ...model, [input.dataset.positionAxis]: value };
      // Do not rewrite a sibling's partially entered or invalid text.
      marker.style.left = `${model.x}%`;
      marker.style.top = `${model.y}%`;
      if (!hasInvalid()) {
        css.value = `${model.x}% ${model.y}%`;
        // Keep the user's caret and intermediate decimal text (e.g. "12.").
        // Only direct manipulation or an explicit preset rewrites axis fields.
        paint(false);
        update(css.value);
      }
    };
    input.addEventListener('input', read);
    input.addEventListener('keydown', (event) => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key) || event.metaKey || event.ctrlKey || busy)
        return;
      const value = Number(input.value);
      if (!input.value.trim() || !Number.isFinite(value)) return;
      event.preventDefault();
      input.value = String(
        Math.max(
          0,
          Math.min(100, value + (event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 10 : 1)),
        ),
      );
      read();
    });
  });
  css.addEventListener('input', () => {
    if (busy) return;
    if (!css.value.trim() || !CSS.supports('object-position', css.value))
      return invalid(css, 'Enter a valid CSS object position. The last valid preview is retained.');
    dialog
      .querySelectorAll('[aria-invalid]')
      .forEach((node) => node.removeAttribute('aria-invalid'));
    model = readInspectorPosition(css.value);
    paint();
    update(css.value);
  });
  dialog.querySelectorAll('[data-position-preset]').forEach((button) =>
    button.addEventListener('click', () => {
      const [x, y] = button.dataset.positionPreset.split(',').map(Number);
      move({ x, y });
    }),
  );
  pad.addEventListener('keydown', (event) => {
    if (
      event.target !== pad ||
      busy ||
      !model ||
      event.metaKey ||
      event.ctrlKey ||
      event.isComposing
    )
      return;
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      event.key
    ];
    if (!delta && event.key !== 'Home') return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    move(
      event.key === 'Home'
        ? { x: 50, y: 50 }
        : {
            x: Math.max(0, Math.min(100, model.x + delta[0] * step)),
            y: Math.max(0, Math.min(100, model.y + delta[1] * step)),
          },
    );
  });
  pad.addEventListener('pointerdown', (event) => {
    if (
      event.button !== 0 ||
      busy ||
      !model ||
      cleanupDrag ||
      hasInvalid() ||
      event.target.closest('button')
    )
      return;
    event.preventDefault();
    pad.focus();
    const start = { ...model },
      startCss = css.value;
    const rect = plane.getBoundingClientRect();
    const offset =
      event.target === marker
        ? {
            x: event.clientX - rect.left - (rect.width * model.x) / 100,
            y: event.clientY - rect.top - (rect.height * model.y) / 100,
          }
        : { x: 0, y: 0 };
    const id = event.pointerId;
    const drag = (pointer) => {
      if (pointer.pointerId !== id) return;
      const next = positionFromPointer({ x: pointer.clientX, y: pointer.clientY }, rect, offset);
      if (pointer.shiftKey) {
        if (Math.abs(next.x - start.x) >= Math.abs(next.y - start.y)) next.y = start.y;
        else next.x = start.x;
      }
      move(next);
    };
    const end = (restore = false) => {
      cleanupDrag = null;
      pad.removeEventListener('pointermove', drag);
      pad.removeEventListener('pointerup', release);
      pad.removeEventListener('pointercancel', lost);
      pad.removeEventListener('lostpointercapture', lost);
      window.removeEventListener('blur', lost);
      dialog.removeEventListener('keydown', escapeDrag, true);
      delete pad.dataset.dragging;
      if (pad.hasPointerCapture(id)) pad.releasePointerCapture(id);
      if (restore) {
        model = start;
        css.value = startCss;
        paint();
        update(startCss);
      }
    };
    const release = (pointer) => {
      if (pointer.pointerId === id) {
        // Keep the last manipulated position. Releasing Shift before the pointer
        // must not reinterpret an axis-locked drag and jump the other coordinate.
        end();
      }
    };
    const lost = () => end(true);
    const escapeDrag = (key) => {
      if (key.key === 'Escape') {
        key.preventDefault();
        key.stopPropagation();
        end(true);
      }
    };
    cleanupDrag = () => end();
    pad.setPointerCapture(id);
    pad.dataset.dragging = '';
    pad.addEventListener('pointermove', drag);
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', lost);
    pad.addEventListener('lostpointercapture', lost);
    window.addEventListener('blur', lost);
    dialog.addEventListener('keydown', escapeDrag, true);
    if (event.target !== marker) drag(event);
  });
  const positionDialog = () => {
    const rect = anchor.getBoundingClientRect(),
      bounds = dialog.getBoundingClientRect();
    dialog.style.left = `${Math.max(8, Math.min(innerWidth - bounds.width - 8, rect.left - bounds.width - 8))}px`;
    dialog.style.top = `${Math.max(8, Math.min(rect.top, innerHeight - bounds.height - 8))}px`;
  };
  const observer = new ResizeObserver(positionDialog);
  function dispose(focus = true) {
    disposed = true;
    pending = null;
    revision++;
    cancelAnimationFrame(frame);
    cleanupDrag?.();
    observer.disconnect();
    window.removeEventListener('resize', positionDialog);
    dialog.close();
    dialog.remove();
    if (focus) restoreFocus();
  }
  const lock = (value) => {
    busy = value;
    dialog.querySelectorAll('input,button').forEach((node) => (node.disabled = value));
    pad.setAttribute('aria-disabled', String(value));
    if (!value) {
      paint();
      use.disabled = true;
    }
  };
  async function close() {
    if (busy) return;
    cleanupDrag?.();
    lock(true);
    pending = null;
    ++revision;
    cancelAnimationFrame(frame);
    frame = 0;
    if (flight) await flight;
    if (await cancel()) dispose();
    else {
      lock(false);
      status.textContent = error();
      retry.hidden = candidate == null || hasInvalid();
    }
  }
  dialog
    .querySelectorAll('[data-cancel]')
    .forEach((button) => button.addEventListener('click', close));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    void close();
  });
  dialog.addEventListener('foundry-selection-change', () => dispose(false), { once: true });
  use.addEventListener('click', async () => {
    if (busy || use.disabled || candidate == null || hasInvalid() || cleanupDrag) return;
    lock(true);
    if (await commit(candidate)) dispose();
    else {
      lock(false);
      status.textContent = error();
      retry.hidden = false;
    }
  });
  retry.addEventListener('click', () => {
    if (!busy && candidate != null && !hasInvalid()) update(candidate);
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT' && !event.isComposing) {
      event.preventDefault();
      use.click();
    }
  });
  paint();
  document.body.append(dialog);
  renderIcons(dialog);
  dialog.showModal();
  positionDialog();
  observer.observe(dialog);
  window.addEventListener('resize', positionDialog);
}
