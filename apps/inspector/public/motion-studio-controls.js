export const MOTION_CURVE_PRESETS = {
  'cubic-bezier': [
    { id: 'linear', label: 'Linear', x1: 0, y1: 0, x2: 1, y2: 1 },
    { id: 'ease-out', label: 'Ease out', x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
    { id: 'ease-in-out', label: 'Ease in out', x1: 0.65, y1: 0, x2: 0.35, y2: 1 },
  ],
  spring: [
    { id: 'gentle', label: 'Gentle', mass: 1, stiffness: 120, damping: 20, velocity: 0 },
    { id: 'responsive', label: 'Responsive', mass: 1, stiffness: 210, damping: 24, velocity: 0 },
    { id: 'expressive', label: 'Expressive', mass: 0.8, stiffness: 260, damping: 18, velocity: 0 },
  ],
};
const keys = {
  'cubic-bezier': ['x1', 'y1', 'x2', 'y2'],
  spring: ['mass', 'stiffness', 'damping', 'velocity'],
};
export function motionPresetParameters(kind, values) {
  const names = keys[kind];
  if (!names) return null;
  const limits =
    kind === 'spring'
      ? [
          [0.1, 20],
          [1, 2000],
          [0.1, 200],
          [-20, 20],
        ]
      : [
          [0, 1],
          [-2, 3],
          [0, 1],
          [-2, 3],
        ];
  if (names.some((name, index) => !motionNumericValid(values[name], ...limits[index]))) return null;
  return { kind, ...Object.fromEntries(names.map((name) => [name, Number(values[name])])) };
}
export function motionNumericValid(value, min = -Infinity, max = Infinity) {
  return (
    value != null &&
    String(value).trim() !== '' &&
    Number.isFinite(Number(value)) &&
    Number(value) >= min &&
    Number(value) <= max
  );
}
export function motionTimingValue(value) {
  return motionNumericValid(value) ? String(value) : '';
}
export function matchingMotionPreset(curve) {
  const kind = curve?.kind;
  const values = kind === 'spring' ? curve.spring : curve?.cubicBezier;
  if (!values) return null;
  return (
    (MOTION_CURVE_PRESETS[kind] ?? []).find((preset) =>
      keys[kind].every(
        (name) =>
          motionNumericValid(values[name]) && Math.abs(Number(values[name]) - preset[name]) <= 1e-6,
      ),
    )?.id ?? null
  );
}
// Small illustrative paths, not product playback or verification evidence.
export function motionPresetPath(kind, preset) {
  if (!motionPresetParameters(kind, preset)) return '';
  if (kind === 'cubic-bezier')
    return `M2 22 C${2 + preset.x1 * 32} ${22 - preset.y1 * 18},${2 + preset.x2 * 32} ${22 - preset.y2 * 18},34 4`;
  const omega = Math.sqrt(preset.stiffness / preset.mass);
  const ratio = preset.damping / (2 * Math.sqrt(preset.stiffness * preset.mass));
  // Built-in spring presets are underdamped and have zero initial velocity.
  if (ratio >= 1 || preset.velocity !== 0) return '';
  const damped = omega * Math.sqrt(1 - ratio * ratio);
  return Array.from({ length: 41 }, (_, index) => {
    const t = index / 40;
    const y =
      1 -
      Math.exp(-ratio * omega * t) *
        (Math.cos(damped * t) + ((ratio * omega) / damped) * Math.sin(damped * t));
    return `${index ? 'L' : 'M'}${(2 + t * 32).toFixed(2)} ${(22 - y * 18).toFixed(2)}`;
  }).join(' ');
}

// A local curve diagram is manipulated here; only commit() can invoke the native
// Review action. No request, source mutation or inferred spring is performed.
export function bindMotionCurveHandle(handle, { read, write, geometry, commit, interacting }) {
  const doc = handle.ownerDocument,
    win = doc.defaultView;
  let drag = null;
  const finish = (accept) => {
    const current = drag;
    if (!current) return;
    drag = null;
    doc.removeEventListener('pointermove', move, { capture: true });
    doc.removeEventListener('pointerup', up, { capture: true });
    doc.removeEventListener('pointercancel', cancel, { capture: true });
    doc.removeEventListener('keydown', key, { capture: true });
    handle.removeEventListener('lostpointercapture', cancel);
    win.removeEventListener('blur', cancel);
    if (handle.hasPointerCapture(current.id)) handle.releasePointerCapture(current.id);
    if (!accept) write(current.value);
    interacting(false);
    if (accept && JSON.stringify(read()) !== JSON.stringify(current.value)) void commit();
  };
  const cancel = () => finish(false);
  const up = (event) => {
    if (event.pointerId === drag?.id) finish(true);
  };
  const key = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancel();
  };
  const move = (event) => {
    if (event.pointerId !== drag?.id) return;
    if (!handle.isConnected) return cancel();
    const rect = drag.rect;
    write({
      x: Number(
        Math.max(
          0,
          Math.min(1, drag.value.x + (event.clientX - drag.x) / ((rect.width * 208) / 240)),
        ).toFixed(4),
      ),
      y: Number(
        Math.max(
          -2,
          Math.min(
            3,
            drag.value.y - ((event.clientY - drag.y) / ((rect.height * 124) / 156)) * 1.5,
          ),
        ).toFixed(4),
      ),
    });
  };
  const down = (event) => {
    if (event.button !== 0 || drag || handle.getAttribute('aria-disabled') === 'true') return;
    const value = read(),
      rect = geometry();
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !rect.width || !rect.height)
      return;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, value, rect };
    interacting(true);
    handle.setPointerCapture(event.pointerId);
    doc.addEventListener('pointermove', move, true);
    doc.addEventListener('pointerup', up, true);
    doc.addEventListener('pointercancel', cancel, true);
    doc.addEventListener('keydown', key, true);
    handle.addEventListener('lostpointercapture', cancel);
    win.addEventListener('blur', cancel, { once: true });
  };
  handle.addEventListener('pointerdown', down);
  return () => {
    cancel();
    handle.removeEventListener('pointerdown', down);
  };
}
