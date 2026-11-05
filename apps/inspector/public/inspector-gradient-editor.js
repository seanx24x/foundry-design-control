import {
  readInspectorGradient,
  serializeInspectorGradient,
  moveInspectorGradientStop,
} from './inspector-gradients.js';

export function openInspectorGradientEditor({
  control,
  anchor,
  renderIcons,
  preview,
  commit,
  cancel,
  error,
  restoreFocus,
  acceptHint,
}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'next-color-picker next-gradient-editor';
  dialog.setAttribute('aria-label', 'Edit background gradient');
  dialog.innerHTML = `<header><strong>Background gradient</strong><button type="button" data-cancel aria-label="Cancel gradient selection"><i data-icon="close"></i></button></header>
    <div class="next-gradient-preview" aria-label="Gradient preview"></div>
    <div class="next-gradient-track" aria-label="Gradient stops"></div>
    <div class="next-gradient-fields">
      <label>Angle <span>deg</span><input data-angle type="text" inputmode="decimal" aria-label="Gradient angle" aria-describedby="next-gradient-status"></label>
      <div class="next-gradient-stop-heading"><span>Color stops</span><button type="button" data-add>Add stop</button></div>
      <div data-stops></div>
      <p class="next-gradient-help">Drag a stop or use its arrow keys. Positions stay between neighboring stops.</p>
      <button type="button" data-remove-gradient>Remove gradient</button>
    </div>
    <button type="button" data-create hidden>Create linear gradient</button>
    <details class="next-gradient-original"><summary>Captured background image</summary><pre></pre></details>
    <p id="next-gradient-status" role="status"></p>
    <button type="button" data-retry hidden>Preview again</button>
    <footer><button type="button" data-cancel>Cancel</button><button type="button" data-use disabled>Use gradient</button></footer>`;
  const original = String(control.value);
  let model = control.mixed ? null : readInspectorGradient(original);
  const supported = Boolean(model) || (!control.mixed && original === 'none');
  const fields = dialog.querySelector('.next-gradient-fields');
  const track = dialog.querySelector('.next-gradient-track');
  const sample = dialog.querySelector('.next-gradient-preview');
  const angle = dialog.querySelector('[data-angle]');
  const create = dialog.querySelector('[data-create]');
  const add = dialog.querySelector('[data-add]');
  const use = dialog.querySelector('[data-use]');
  const status = dialog.querySelector('[role="status"]');
  const retry = dialog.querySelector('[data-retry]');
  let selected = 0,
    candidate = null,
    pending = null,
    inFlight = false,
    frame = 0,
    revision = 0,
    busy = false,
    disposed = false,
    cleanupDrag = null;
  dialog.querySelector('pre').textContent = control.mixed ? 'Mixed background images' : original;
  status.textContent = !supported
    ? 'This fill is preserved. Layered images, non-linear gradients and advanced CSS are not edited here. Select one supported linear gradient.'
    : 'Opening this editor does not change the fill. Background color remains separate.';
  function paint() {
    fields.hidden = !model;
    track.hidden = !model;
    create.hidden = !supported || Boolean(model);
    sample.hidden = !model;
    if (!model) return;
    const css = serializeInspectorGradient(model);
    if (css && CSS.supports('background-image', css)) sample.style.backgroundImage = css;
    angle.value = String(model.angle);
    angle.removeAttribute('aria-invalid');
    add.disabled = busy || model.stops.length >= 8;
    track.replaceChildren();
    const rows = dialog.querySelector('[data-stops]');
    rows.replaceChildren();
    model.stops.forEach((stop, index) => {
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.dataset.gradientStop = index;
      handle.setAttribute('role', 'slider');
      handle.setAttribute('aria-label', `Stop ${index + 1} position`);
      handle.setAttribute('aria-valuemin', String(model.stops[index - 1]?.position ?? 0));
      handle.setAttribute('aria-valuemax', String(model.stops[index + 1]?.position ?? 100));
      handle.setAttribute('aria-valuenow', String(stop.position));
      handle.setAttribute('aria-valuetext', `${stop.position}%`);
      handle.setAttribute('aria-describedby', 'next-gradient-status');
      handle.dataset.selected = String(index === selected);
      handle.style.left = `${stop.position}%`;
      handle.style.backgroundColor = stop.color;
      track.append(handle);
      const row = document.createElement('div');
      row.className = 'next-gradient-stop-row';
      row.innerHTML = `<input data-stop-color type="text" spellcheck="false" aria-label="Stop ${index + 1} color" aria-describedby="next-gradient-status"><label><input data-stop-position type="text" inputmode="decimal" aria-label="Stop ${index + 1} percentage" aria-describedby="next-gradient-status"><span>%</span></label><button type="button" data-remove-stop aria-label="Remove stop ${index + 1}">−</button>`;
      const color = row.querySelector('[data-stop-color]'),
        position = row.querySelector('[data-stop-position]');
      color.value = stop.color;
      position.value = String(stop.position);
      row.querySelector('[data-remove-stop]').disabled = model.stops.length <= 2;
      rows.append(row);
      const read = () => {
        if (busy || disposed) return;
        const next = structuredClone(model);
        next.stops[index] = {
          color: color.value.trim(),
          position: position.value.trim() ? Number(position.value) : NaN,
        };
        if (!valid(next))
          return invalid(
            color,
            'Use a literal sRGB color and ordered positions from 0 to 100%.',
            position,
          );
        model = next;
        color.removeAttribute('aria-invalid');
        position.removeAttribute('aria-invalid');
        sample.style.backgroundImage = serializeInspectorGradient(model);
        handle.style.left = `${model.stops[index].position}%`;
        handle.style.backgroundColor = model.stops[index].color;
        handle.setAttribute('aria-valuenow', String(model.stops[index].position));
        handle.setAttribute('aria-valuetext', `${model.stops[index].position}%`);
        syncBounds();
        if (!hasInvalid()) update(serializeInspectorGradient(model));
      };
      color.addEventListener('input', read);
      position.addEventListener('input', read);
      row.querySelector('[data-remove-stop]').addEventListener('click', () => {
        if (busy || hasInvalid() || model.stops.length <= 2) return;
        model.stops.splice(index, 1);
        selected = Math.min(index, model.stops.length - 1);
        paint();
        update(serializeInspectorGradient(model));
      });
      const move = (value) => {
        if (busy || disposed || hasInvalid()) return;
        model = moveInspectorGradientStop(model, index, value);
        // Retain the captured pointer node; replacing it mid-drag loses capture.
        position.value = String(model.stops[index].position);
        handle.style.left = `${model.stops[index].position}%`;
        handle.setAttribute('aria-valuenow', position.value);
        handle.setAttribute('aria-valuetext', `${position.value}%`);
        syncBounds();
        sample.style.backgroundImage = serializeInspectorGradient(model);
        update(serializeInspectorGradient(model));
      };
      handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || busy || hasInvalid() || cleanupDrag) return;
        event.preventDefault();
        selected = index;
        handle.focus();
        track
          .querySelectorAll('button')
          .forEach((node) => (node.dataset.selected = String(node === handle)));
        const start = model.stops[index].position;
        handle.setPointerCapture(event.pointerId);
        const rect = track.getBoundingClientRect();
        const drag = (pointer) =>
          move(
            Math.round(
              Math.min(100, Math.max(0, ((pointer.clientX - rect.left) / rect.width) * 100)) * 10,
            ) / 10,
          );
        const end = (pointer) => {
          cleanupDrag = null;
          handle.removeEventListener('pointermove', drag);
          handle.removeEventListener('pointerup', end);
          handle.removeEventListener('pointercancel', end);
          handle.removeEventListener('lostpointercapture', lost);
          window.removeEventListener('blur', lost);
          if (pointer.type === 'pointercancel') move(start);
        };
        const lost = () => {
          move(start);
          end({ type: 'lostpointercapture' });
        };
        cleanupDrag = () => end({ type: 'dispose' });
        handle.addEventListener('pointermove', drag);
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
        handle.addEventListener('lostpointercapture', lost);
        window.addEventListener('blur', lost, { once: true });
      });
      handle.addEventListener('focus', () => {
        selected = index;
        track
          .querySelectorAll('button')
          .forEach((node) => (node.dataset.selected = String(node === handle)));
      });
      handle.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        move(
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? 100
              : model.stops[index].position +
                (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 10 : 1),
        );
      });
    });
  }
  function syncBounds() {
    track.querySelectorAll('[data-gradient-stop]').forEach((node, index) => {
      node.setAttribute('aria-valuemin', String(model.stops[index - 1]?.position ?? 0));
      node.setAttribute('aria-valuemax', String(model.stops[index + 1]?.position ?? 100));
    });
  }
  const hasInvalid = () => Boolean(dialog.querySelector('[aria-invalid="true"]'));
  const valid = (next) => {
    const css = serializeInspectorGradient(next);
    return Boolean(css && CSS.supports('background-image', css));
  };
  function invalid(input, message, other) {
    revision++;
    pending = null;
    use.disabled = true;
    input.setAttribute('aria-invalid', 'true');
    other?.setAttribute('aria-invalid', 'true');
    status.textContent = message;
  }
  async function drain() {
    frame = 0;
    if (inFlight || busy || disposed || !pending) return;
    const request = pending;
    pending = null;
    inFlight = true;
    const ok = await preview(request.value);
    inFlight = false;
    if (disposed || busy) return;
    if (request.revision === revision) {
      use.disabled = !ok;
      status.textContent = ok ? `Preview only. ${acceptHint}` : error();
      retry.hidden = ok;
    }
    if (pending) frame = requestAnimationFrame(drain);
  }
  function update(value) {
    if (busy || disposed) return;
    candidate = value;
    retry.hidden = true;
    use.textContent = value === 'none' ? 'Remove gradient' : 'Use gradient';
    pending = { value, revision: ++revision };
    use.disabled = true;
    status.textContent = 'Loading preview…';
    if (!frame && !inFlight) frame = requestAnimationFrame(drain);
  }
  angle.addEventListener('input', () => {
    if (busy) return;
    const next = { ...model, angle: angle.value.trim() ? Number(angle.value) : NaN };
    if (!valid(next)) return invalid(angle, 'Enter an angle from −3600 to 3600 degrees.');
    angle.removeAttribute('aria-invalid');
    model = next;
    if (!hasInvalid()) {
      sample.style.backgroundImage = serializeInspectorGradient(model);
      update(serializeInspectorGradient(model));
    }
  });
  create.addEventListener('click', () => {
    if (busy || !supported) return;
    model = {
      angle: 90,
      stops: [
        { color: '#3157ff', position: 0 },
        { color: '#c9e4ff', position: 100 },
      ],
    };
    paint();
    update(serializeInspectorGradient(model));
  });
  add.addEventListener('click', () => {
    if (busy || hasInvalid() || model.stops.length >= 8) return;
    const index = Math.min(selected, model.stops.length - 2);
    model.stops.splice(index + 1, 0, {
      color: model.stops[index].color,
      position: (model.stops[index].position + model.stops[index + 1].position) / 2,
    });
    selected = index + 1;
    paint();
    update(serializeInspectorGradient(model));
  });
  dialog.querySelector('[data-remove-gradient]').addEventListener('click', () => {
    if (busy) return;
    dialog
      .querySelectorAll('[aria-invalid]')
      .forEach((node) => node.removeAttribute('aria-invalid'));
    model = null;
    paint();
    update('none');
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
  async function close() {
    if (busy) return;
    busy = true;
    revision++;
    pending = null;
    cancelAnimationFrame(frame);
    if (await cancel()) dispose();
    else {
      busy = false;
      use.disabled = true;
      retry.hidden = candidate == null || hasInvalid();
      status.textContent = error();
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
    if (busy || disposed || use.disabled || candidate == null || hasInvalid()) return;
    busy = true;
    dialog.querySelectorAll('input,button').forEach((node) => {
      node.disabled = true;
    });
    if (await commit(candidate)) dispose();
    else {
      busy = false;
      dialog.querySelectorAll('input,button').forEach((node) => {
        node.disabled = false;
      });
      status.textContent = error();
      use.disabled = true;
      retry.hidden = false;
      // A failed save may have restored the native preview. Explicitly editing
      // a value must obtain a fresh preview acknowledgment before another Use.
      add.disabled = !model || model.stops.length >= 8;
      dialog.querySelectorAll('[data-remove-stop]').forEach((node) => {
        node.disabled = !model || model.stops.length <= 2;
      });
    }
  });
  retry.addEventListener('click', () => {
    if (!busy && candidate != null && !hasInvalid()) update(candidate);
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
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
