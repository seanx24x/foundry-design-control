import { readInspectorColor, hsvToHex, colorWithAlpha } from './inspector-inputs.js';
import { foundryPilotRequested } from './foundry-pilot.js';
import {
  supportsInspectorColorFormats,
  inspectorColorChannels,
  serializeInspectorChannels,
  inspectorColorAlpha,
} from './inspector-color-formats.js';

export function openInspectorColorPicker({
  control,
  renderIcons,
  acceptHint,
  anchor,
  preview,
  commit,
  cancel,
  error,
  restoreFocus,
}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'next-color-picker';
  dialog.setAttribute('aria-label', `Choose ${control.label.toLowerCase()}`);
  dialog.innerHTML = `<header><strong></strong><button type="button" data-cancel aria-label="Cancel color selection"><i data-icon="close"></i></button></header>
    <div class="next-color-formats segmented" role="group" aria-label="Color format">${[
      ['css', 'Original'],
      ['hex', 'Hex'],
      ['rgb', 'RGB'],
      ['hsl', 'HSL'],
    ]
      .map(
        ([value, label]) =>
          `<button type="button" data-color-format="${value}" aria-pressed="${value === 'css'}">${label}</button>`,
      )
      .join('')}</div>
    <div class="next-color-plane" role="slider" tabindex="0" aria-label="Saturation and brightness" aria-valuemin="0" aria-valuemax="100" aria-describedby="next-color-help"><span class="next-color-cursor"></span></div>
    <p id="next-color-help" class="next-color-help">← → saturation · ↑ ↓ brightness</p>
    <label class="next-color-range">Hue<input type="range" data-hue min="0" max="360" step="1" aria-label="Hue"></label>
    <label class="next-color-range">Alpha<input type="range" data-alpha min="0" max="100" step="1" aria-label="Color alpha"></label>
    <div class="next-color-channels" hidden>${[0, 1, 2].map((index) => `<label><span data-channel-label="${index}"></span><input type="text" inputmode="decimal" data-color-channel="${index}" aria-describedby="next-color-status"></label>`).join('')}</div>
    <div class="next-color-values"><label data-color-text-field>Color<input type="text" data-color-value aria-label="Color value" spellcheck="false" aria-describedby="next-color-status"></label><label>Alpha %<input type="text" data-alpha-value aria-label="Color alpha percentage" inputmode="decimal" aria-describedby="next-color-status"></label></div>
    <p class="next-color-format-help">Captured CSS is retained until you edit a value. Channel controls use sRGB.</p>
    <p id="next-color-status" role="status"></p>
    <footer><button type="button" data-cancel>Cancel</button><button type="button" data-use disabled>Use color</button></footer>`;
  dialog.querySelector('strong').textContent = control.label;
  dialog.querySelector('.next-color-formats').hidden = !foundryPilotRequested();
  dialog.querySelector('.next-color-format-help').hidden = !foundryPilotRequested();
  const plane = dialog.querySelector('.next-color-plane');
  const cursor = dialog.querySelector('.next-color-cursor');
  const hue = dialog.querySelector('[data-hue]');
  const alpha = dialog.querySelector('[data-alpha]');
  const colorInput = dialog.querySelector('[data-color-value]');
  const alphaInput = dialog.querySelector('[data-alpha-value]');
  const use = dialog.querySelector('[data-use]');
  const status = dialog.querySelector('[role="status"]');
  const channels = [...dialog.querySelectorAll('[data-color-channel]')];
  let format = 'css';
  const parseColor = (value) => {
    const parsed = readInspectorColor(value);
    if (parsed) parsed.alpha = inspectorColorAlpha(value, parsed.alpha);
    return parsed;
  };
  let color = (!control.mixed && parseColor(control.value)) || {
    h: 0,
    s: 0,
    v: 100,
    hex: '#ffffff',
    alpha: 100,
  };
  let candidate = null;
  let timer;
  let revision = 0;
  let busy = false;
  let disposed = false;
  const syncFormats = () => {
    const invalid = Boolean(dialog.querySelector('[aria-invalid="true"]'));
    const supported =
      !control.mixed || candidate != null
        ? supportsInspectorColorFormats(candidate ?? control.value)
        : false;
    dialog.querySelectorAll('[data-color-format]').forEach((button) => {
      button.disabled = busy || invalid || (button.dataset.colorFormat !== 'css' && !supported);
      button.setAttribute('aria-pressed', String(button.dataset.colorFormat === format));
    });
    dialog.querySelector('.next-color-format-help').textContent = supported
      ? 'Captured CSS is retained until you edit a value. Channel controls use sRGB.'
      : 'Choose a replacement in Original before using sRGB channels. Advanced CSS is not converted automatically.';
  };
  status.textContent = control.mixed
    ? 'Mixed colors. Choose a replacement for all selected layers.'
    : acceptHint;
  const draw = (updateText = true) => {
    plane.style.backgroundColor = hsvToHex(color.h, 100, 100);
    cursor.style.left = `${color.s}%`;
    cursor.style.top = `${100 - color.v}%`;
    cursor.style.backgroundColor = color.hex;
    plane.setAttribute('aria-valuenow', String(Math.round(color.s)));
    plane.setAttribute(
      'aria-valuetext',
      `${Math.round(color.s)}% saturation, ${Math.round(color.v)}% brightness`,
    );
    hue.value = String(color.h);
    alpha.value = String(color.alpha);
    alpha.style.setProperty('--next-color', color.hex);
    if (updateText) {
      colorInput.value =
        format === 'hex'
          ? colorWithAlpha(color.hex, color.alpha)
          : (candidate ?? (control.mixed ? '' : String(control.value)));
      colorInput.placeholder = control.mixed ? 'Mixed' : '';
      alphaInput.value = String(color.alpha);
      colorInput.removeAttribute('aria-invalid');
      alphaInput.removeAttribute('aria-invalid');
      const values = inspectorColorChannels(color, format === 'hsl' ? 'hsl' : 'rgb');
      channels.forEach((input, index) => {
        input.value = String(values[index]);
        input.removeAttribute('aria-invalid');
      });
    }
    dialog.querySelector('.next-color-channels').hidden = !['rgb', 'hsl'].includes(format);
    dialog.querySelector('[data-color-text-field]').hidden = ['rgb', 'hsl'].includes(format);
    const labels =
      format === 'hsl' ? ['Hue', 'Saturation %', 'Lightness %'] : ['Red', 'Green', 'Blue'];
    channels.forEach((input, index) => {
      input.setAttribute('aria-label', labels[index]);
      dialog.querySelector(`[data-channel-label="${index}"]`).textContent = labels[index];
    });
    syncFormats();
  };
  const update = (value) => {
    if (busy || disposed) return;
    candidate = value;
    const request = ++revision;
    use.disabled = true;
    clearTimeout(timer);
    status.textContent = 'Loading preview…';
    timer = setTimeout(async () => {
      const ok = await preview(value);
      if (disposed || request !== revision) return;
      use.disabled = !ok;
      status.textContent = ok ? `Preview only. ${acceptHint}` : error();
    }, 32);
  };
  const updateFromControls = () => {
    color.hex = hsvToHex(color.h, color.s, color.v);
    update(colorWithAlpha(color.hex, color.alpha));
    draw();
  };
  const invalid = (input, message) => {
    ++revision;
    clearTimeout(timer);
    use.disabled = true;
    input.setAttribute('aria-invalid', 'true');
    status.textContent = message;
    syncFormats();
  };
  colorInput.addEventListener('input', () => {
    if (
      format === 'hex' &&
      !/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(colorInput.value.trim())
    )
      return invalid(colorInput, 'Enter a valid hex color, or Cancel to keep the captured value.');
    const next = parseColor(colorInput.value.trim());
    if (!next)
      return invalid(colorInput, 'Enter a color such as #20231f, rgb(32 35 31), or transparent.');
    color = next;
    colorInput.removeAttribute('aria-invalid');
    alphaInput.removeAttribute('aria-invalid');
    alphaInput.value = String(color.alpha);
    update(colorInput.value.trim());
    draw(false);
  });
  alphaInput.addEventListener('input', () => {
    const value = Number(alphaInput.value);
    if (!alphaInput.value.trim() || !Number.isFinite(value) || value < 0 || value > 100)
      return invalid(alphaInput, 'Enter an alpha percentage from 0 to 100.');
    color.alpha = value;
    if (['rgb', 'hsl'].includes(format)) updateChannels();
    else updateFromControls();
  });
  function updateChannels() {
    const value = serializeInspectorChannels(
      format,
      channels.map((input) => input.value),
      alphaInput.value,
    );
    if (!value) {
      const limits = format === 'rgb' ? [255, 255, 255] : [360, 100, 100];
      const input =
        channels.find(
          (input, index) =>
            !input.value.trim() ||
            !Number.isFinite(Number(input.value)) ||
            Number(input.value) < 0 ||
            Number(input.value) > limits[index],
        ) ?? alphaInput;
      invalid(
        input,
        format === 'rgb'
          ? 'Use RGB values from 0 to 255 and alpha from 0 to 100.'
          : 'Use hue from 0 to 360, saturation/lightness from 0 to 100, and alpha from 0 to 100.',
      );
      return;
    }
    channels.forEach((input) => input.removeAttribute('aria-invalid'));
    alphaInput.removeAttribute('aria-invalid');
    color = parseColor(value);
    update(value);
    draw(false);
  }
  channels.forEach((input) => input.addEventListener('input', updateChannels));
  dialog.querySelectorAll('[data-color-format]').forEach((button) =>
    button.addEventListener('click', () => {
      if (busy || button.disabled) return;
      format = button.dataset.colorFormat;
      draw();
    }),
  );
  hue.addEventListener('input', () => {
    color.h = Number(hue.value);
    updateFromControls();
  });
  alpha.addEventListener('input', () => {
    color.alpha = Number(alpha.value);
    updateFromControls();
  });
  plane.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || busy) return;
    event.preventDefault();
    plane.focus();
    plane.setPointerCapture(event.pointerId);
    const position = (pointer) => {
      const rect = plane.getBoundingClientRect();
      color.s = Math.round(
        Math.min(100, Math.max(0, ((pointer.clientX - rect.left) / rect.width) * 100)),
      );
      color.v = Math.round(
        Math.min(100, Math.max(0, 100 - ((pointer.clientY - rect.top) / rect.height) * 100)),
      );
      updateFromControls();
    };
    const end = () => {
      plane.removeEventListener('pointermove', position);
      plane.removeEventListener('pointerup', end);
      plane.removeEventListener('pointercancel', end);
    };
    position(event);
    plane.addEventListener('pointermove', position);
    plane.addEventListener('pointerup', end);
    plane.addEventListener('pointercancel', end);
  });
  plane.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    color.s = Math.min(
      100,
      Math.max(
        0,
        color.s + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
      ),
    );
    color.v = Math.min(
      100,
      Math.max(
        0,
        color.v + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0),
      ),
    );
    updateFromControls();
  });
  const dispose = (focus = true) => {
    disposed = true;
    ++revision;
    clearTimeout(timer);
    window.removeEventListener('resize', positionDialog);
    resizeObserver.disconnect();
    dialog.close();
    dialog.remove();
    if (focus) restoreFocus();
  };
  const close = async () => {
    if (busy) return;
    busy = true;
    ++revision;
    clearTimeout(timer);
    if (await cancel()) dispose();
    else {
      busy = false;
      status.textContent = error();
    }
  };
  dialog
    .querySelectorAll('[data-cancel]')
    .forEach((button) => button.addEventListener('click', close));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    void close();
  });
  dialog.addEventListener('foundry-selection-change', () => dispose(false), { once: true });
  use.addEventListener('click', async () => {
    if (busy || !candidate || use.disabled) return;
    busy = true;
    use.disabled = true;
    // Freeze every editing surface while the acknowledged commit is in flight.
    dialog.querySelectorAll('input, button').forEach((element) => {
      element.disabled = true;
    });
    plane.inert = true;
    if (await commit(candidate)) dispose();
    else {
      busy = false;
      dialog.querySelectorAll('input, button').forEach((element) => {
        element.disabled = false;
      });
      plane.inert = false;
      status.textContent = error();
      syncFormats();
    }
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
      event.preventDefault();
      use.click();
    }
  });
  const positionDialog = () => {
    const rect = anchor.getBoundingClientRect();
    const bounds = dialog.getBoundingClientRect();
    dialog.style.left = `${Math.max(8, Math.min(window.innerWidth - bounds.width - 8, rect.left - bounds.width - 8))}px`;
    dialog.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - bounds.height - 8))}px`;
  };
  const resizeObserver = new ResizeObserver(positionDialog);
  draw();
  document.body.append(dialog);
  renderIcons(dialog);
  dialog.showModal();
  positionDialog();
  window.addEventListener('resize', positionDialog);
  resizeObserver.observe(dialog);
}
