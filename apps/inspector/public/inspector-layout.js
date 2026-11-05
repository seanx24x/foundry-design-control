// Logical axes, not invented physical left/top mappings. CSS resolves direction,
// reversed flex flow and writing mode in the actual selected product.
import { inspectorInputValue } from './inspector-inputs.js';

const fullWidthProperties = new Set([
  'fontFamily',
  'fontVariationSettings',
  'color',
  'backgroundColor',
  'borderColor',
  'boxShadow',
  'textContent',
  'alt',
  'aria-label',
  'gridTemplateColumns',
  'gridTemplateRows',
  'backgroundImage',
]);
export function inspectorFieldIsFull(control, studio = false) {
  return Boolean(
    control.full ||
    fullWidthProperties.has(control.property) ||
    (studio && (control.kind !== 'number' || inspectorInputValue(control).length > 6)),
  );
}

// Pack consecutive compact fields in pairs. A full-width item ends a run;
// the last compact field in an odd run owns the otherwise empty row.
export function inspectorSingletons(fullWidths) {
  const singles = [];
  let run = [];
  const flush = () => {
    if (run.length % 2) singles.push(run.at(-1));
    run = [];
  };
  fullWidths.forEach((full, index) => {
    if (full) flush();
    else run.push(index);
  });
  flush();
  return singles;
}

export function expandInspectorRows(root) {
  for (const grid of root.querySelectorAll('.next-fields')) {
    const fields = [...grid.children].filter((node) => !node.hidden);
    fields.forEach((node) => node.removeAttribute('data-inspector-single'));
    const full = fields.map(
      (node) => !node.classList.contains('next-property') || node.classList.contains('next-full'),
    );
    inspectorSingletons(full).forEach((index) => {
      fields[index].dataset.inspectorSingle = '';
    });
  }
}

export function inspectorAxisControl(control, controls) {
  const axis = { justifyContent: 'Main axis', alignItems: 'Cross axis' }[control.property];
  if (!axis || control.kind !== 'select') return null;
  const display = controls.find((item) => item.property === 'display');
  const direction = controls.find((item) => item.property === 'flexDirection');
  if (
    !display ||
    display.mixed ||
    !['flex', 'inline-flex'].includes(display.value) ||
    !direction ||
    direction.mixed ||
    !['row', 'row-reverse', 'column', 'column-reverse'].includes(direction.value)
  )
    return null;
  const presets = [
    ['flex-start', 'Start'],
    ['center', 'Center'],
    ['flex-end', 'End'],
  ]
    .filter(([value]) => control.options?.includes(value))
    .map(([value, label]) => ({
      value,
      label,
      selected: !control.mixed && control.value === value,
    }));
  if (presets.length !== 3) return null;
  return { axis, flow: direction.value, presets, expanded: !presets.some((item) => item.selected) };
}

export function inspectorBorderVisibility(controls, value, revealed = false) {
  const width = controls.find((item) => item.property === 'borderWidth');
  const color = controls.find((item) => item.property === 'borderColor');
  // Unknown/unequal shorthands and mixed selections stay fully inspectable.
  const zero = Boolean(
    width &&
    color &&
    width.kind === 'number' &&
    !width.mixed &&
    !color.mixed &&
    String(value ?? width.value).trim() !== '' &&
    Number(value ?? width.value) === 0,
  );
  return { canCollapse: zero, colorVisible: !zero || revealed };
}
