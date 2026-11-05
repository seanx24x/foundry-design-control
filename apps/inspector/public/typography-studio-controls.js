// Mirrors the native four-pixel modular scale. This is a draft description,
// never a measurement or a source edit; Preview still uses the native adapter.
export function typographyScaleDraft({ base, ratio, step, fluid }) {
  if (
    [base, ratio, step].some(
      (value) => value == null || String(value).trim() === '' || !Number.isFinite(Number(value)),
    ) ||
    Number(base) < 8 ||
    Number(base) > 128 ||
    Number(ratio) <= 0 ||
    Number(ratio) > 4 ||
    Math.abs(Number(step)) > 20
  )
    return null;
  const grid = (value) => Math.max(4, Math.round(value / 4) * 4);
  const high = grid(Number(base) * Number(ratio) ** Number(step));
  if (!fluid) return `${high}px`;
  const previous = grid(Number(base) * Number(ratio) ** (Number(step) - 1));
  const low = Math.min(previous, high),
    maximum = Math.max(previous, high);
  const slope = (maximum - low) / (1440 - 320);
  const intercept = low - slope * 320;
  return `clamp(${low}px, calc(${Number(intercept.toFixed(3))}px + ${Number((slope * 100).toFixed(3))}vw), ${maximum}px)`;
}
export function typographyControlError(control, value, supports = () => true) {
  if (!String(value).trim()) return 'Enter a value, or Escape to keep the captured value.';
  if (control.kind === 'number') {
    const number = Number(value);
    if (
      !Number.isFinite(number) ||
      (control.min != null && number < control.min) ||
      (control.max != null && number > control.max)
    )
      return 'Enter a number within the control’s limits.';
  }
  const property = control.property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  const css = `${value}${control.kind === 'number' ? (control.unit ?? '') : ''}`;
  return supports(property, css) ? '' : 'Enter valid CSS, or Escape to keep the captured value.';
}
export function typographyControlUnit(control) {
  return control.kind === 'number' ? (control.unit ?? '') : '';
}
