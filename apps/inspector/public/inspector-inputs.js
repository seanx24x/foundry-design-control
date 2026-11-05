// Display precision is not source precision. Only gestures quantize values.
export function inspectorUIControl(control) {
  if (control.property !== 'opacity' || control.kind !== 'number') return control;
  const percent = (value) => Number((Number(value) * 100).toFixed(8));
  return {
    ...control,
    value: percent(control.value),
    authoredValue: control.authoredValue ? String(percent(control.authoredValue)) : undefined,
    min: 0,
    max: 100,
    unit: '%',
    sourceScale: 100,
  };
}

export function inspectorInputValue(control) {
  if (control.mixed) return '';
  const authored = control.authoredValue;
  if (control.kind === 'number') {
    const raw = String(authored ?? '');
    const number =
      control.unit && raw.endsWith(control.unit) ? raw.slice(0, -control.unit.length) : raw;
    if (number.trim() && Number.isFinite(Number(number))) return String(Number(number));
    return String(Math.round(Number(control.value)));
  }
  if (authored) return String(authored);
  const value = String(control.value);
  if (/^-?\d*\.?\d+px$/.test(value)) return `${Math.round(parseFloat(value))}px`;
  return value;
}

export function scrubInspectorValue(control, before, delta, modifiers = {}) {
  const speed = modifiers.shiftKey ? 10 : modifiers.altKey ? 0.1 : 1;
  // Alt makes the movement slower, not the result fractional.
  return Math.min(
    Math.floor(control.max ?? Infinity),
    Math.max(Math.ceil(control.min ?? -Infinity), Math.round(before + delta * speed)),
  );
}

export function rgbToHsv(r, g, b) {
  [r, g, b] = [r, g, b].map((value) => value / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? (delta / max) * 100 : 0, v: max * 100 };
}

export function hsvToHex(h, s, v) {
  s /= 100;
  v /= 100;
  const channel = (n) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}

export function colorWithAlpha(hex, alpha) {
  return alpha >= 100
    ? hex
    : `${hex}${Math.round((Math.max(0, alpha) / 100) * 255)
        .toString(16)
        .padStart(2, '0')}`;
}

export function readInspectorColor(value) {
  if (
    !value ||
    !CSS.supports('color', value) ||
    /^(var\(|currentcolor|inherit|initial|unset|revert)/i.test(value)
  )
    return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return {
    ...rgbToHsv(r, g, b),
    hex: `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`,
    alpha: Math.round((a / 255) * 100),
  };
}
