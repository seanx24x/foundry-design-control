type ScalarKind = 'angle' | 'length' | 'length-or-number' | 'number' | 'percentage' | 'time';

const lengthProperties = new Set([
  'blocksize',
  'bottom',
  'columnrulewidth',
  'columnwidth',
  'flexbasis',
  'fontsize',
  'height',
  'insetblockend',
  'insetblockstart',
  'insetinlineend',
  'insetinlinestart',
  'inlinesize',
  'left',
  'letterspacing',
  'marginblockend',
  'marginblockstart',
  'marginbottom',
  'margininlineend',
  'margininlinestart',
  'marginleft',
  'marginright',
  'margintop',
  'maxblocksize',
  'maxheight',
  'maxinlinesize',
  'maxwidth',
  'minblocksize',
  'minheight',
  'mininlinesize',
  'minwidth',
  'outlineoffset',
  'outlinewidth',
  'paddingblockend',
  'paddingblockstart',
  'paddingbottom',
  'paddinginlineend',
  'paddinginlinestart',
  'paddingleft',
  'paddingright',
  'paddingtop',
  'perspective',
  'right',
  'rowgap',
  'columngap',
  'scrollmarginblockend',
  'scrollmarginblockstart',
  'scrollmarginbottom',
  'scrollmargininlineend',
  'scrollmargininlinestart',
  'scrollmarginleft',
  'scrollmarginright',
  'scrollmargintop',
  'scrollpaddingblockend',
  'scrollpaddingblockstart',
  'scrollpaddingbottom',
  'scrollpaddinginlineend',
  'scrollpaddinginlinestart',
  'scrollpaddingleft',
  'scrollpaddingright',
  'scrollpaddingtop',
  'textdecorationthickness',
  'textindent',
  'top',
  'width',
  'wordspacing',
]);
const numberProperties = new Set([
  'flexgrow',
  'flexshrink',
  'fontweight',
  'opacity',
  'order',
  'orphans',
  'scale',
  'scalex',
  'scaley',
  'strokeopacity',
  'strokemiterlimit',
  'widows',
  'zindex',
  'zoom',
]);
const lengthUnits = new Set([
  '%',
  'cap',
  'ch',
  'cm',
  'cqb',
  'cqh',
  'cqi',
  'cqmax',
  'cqmin',
  'cqw',
  'dvb',
  'dvh',
  'dvi',
  'dvmax',
  'dvmin',
  'dvw',
  'em',
  'ex',
  'ic',
  'in',
  'lh',
  'lvb',
  'lvh',
  'lvi',
  'lvmax',
  'lvmin',
  'lvw',
  'mm',
  'pc',
  'pt',
  'px',
  'q',
  'rcap',
  'rch',
  'rem',
  'rex',
  'ric',
  'rlh',
  'svb',
  'svh',
  'svi',
  'svmax',
  'svmin',
  'svw',
  'vb',
  'vh',
  'vi',
  'vmax',
  'vmin',
  'vw',
]);
const absoluteLengths: Record<string, number> = {
  cm: 96 / 2.54,
  in: 96,
  mm: 96 / 25.4,
  pc: 16,
  pt: 96 / 72,
  px: 1,
  q: 96 / 101.6,
};
const angles: Record<string, number> = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };
const times: Record<string, number> = { ms: 1, s: 1_000 };
const scalarPattern = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)$/i;

function scalarKind(property: string): { kind: ScalarKind; implicitUnit?: string } | undefined {
  const normalized = property.replaceAll('-', '').toLowerCase();
  if (lengthProperties.has(normalized)) return { kind: 'length' };
  if (numberProperties.has(normalized)) return { kind: 'number' };
  if (normalized === 'lineheight') return { kind: 'length-or-number' };
  if (normalized === 'rotate') return { kind: 'angle' };
  const timing = /^motion\.[^.]+\.(duration|delay|iterations)$/.exec(property.toLowerCase());
  if (timing)
    return timing[1] === 'iterations' ? { kind: 'number' } : { kind: 'time', implicitUnit: 'ms' };
  const keyframe = /^motion\.[^.]+\.keyframe\.\d+\.(.+)$/.exec(property.toLowerCase());
  if (!keyframe) return undefined;
  if (keyframe[1] === 'offset') return { kind: 'percentage', implicitUnit: '%' };
  return scalarKind(keyframe[1]!);
}

function measuredValue(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.hasOwn(value, 'value')
  ) {
    return (value as { value: unknown }).value;
  }
  return value;
}

function exact(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*\/\s*/g, '/');
}

function scalar(
  value: unknown,
  implicitUnit?: string,
): { value: number; unit: string } | undefined {
  if (typeof value === 'boolean' || value === null || value === undefined) return undefined;
  const match = scalarPattern.exec(String(value).trim());
  if (!match) return undefined;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return undefined;
  return {
    value: parsed,
    unit: (match[2] ?? '').toLowerCase() || (typeof value === 'number' ? (implicitUnit ?? '') : ''),
  };
}

function close(left: number, right: number, tolerance: number): boolean {
  return (
    Math.abs(left - right) <= Math.max(tolerance, Math.max(Math.abs(left), Math.abs(right)) * 1e-6)
  );
}

function converted(
  left: { value: number; unit: string },
  right: { value: number; unit: string },
  factors: Record<string, number>,
  tolerance: number,
): boolean {
  const leftFactor = factors[left.unit];
  const rightFactor = factors[right.unit];
  return (
    leftFactor !== undefined &&
    rightFactor !== undefined &&
    close(left.value * leftFactor, right.value * rightFactor, tolerance)
  );
}

function lengthsMatch(
  left: { value: number; unit: string },
  right: { value: number; unit: string },
): boolean {
  if (
    (!lengthUnits.has(left.unit) && left.unit !== '') ||
    (!lengthUnits.has(right.unit) && right.unit !== '')
  )
    return false;
  if (left.unit === right.unit) return close(left.value, right.value, 0.01);
  if (left.value === 0 && left.unit === '') return right.value === 0;
  if (right.value === 0 && right.unit === '') return left.value === 0;
  return converted(left, right, absoluteLengths, 0.01);
}

/** Strict canonical comparison shared by preview and server verification. */
export function verificationValueMatches(
  property: string,
  renderedInput: unknown,
  requestedInput: unknown,
  unit?: string,
): boolean {
  const rendered = measuredValue(renderedInput);
  const requested =
    typeof requestedInput === 'number' && unit ? `${requestedInput}${unit}` : requestedInput;
  if (exact(rendered) === exact(requested)) return true;
  const rule = scalarKind(property);
  if (!rule) return false;
  const left = scalar(rendered, rule.implicitUnit);
  const right = scalar(requested, rule.implicitUnit);
  if (!left || !right) return false;
  if (rule.kind === 'number')
    return left.unit === '' && right.unit === '' && close(left.value, right.value, 0.0001);
  if (rule.kind === 'length') return lengthsMatch(left, right);
  if (rule.kind === 'length-or-number') {
    return left.unit === '' && right.unit === ''
      ? close(left.value, right.value, 0.0001)
      : lengthsMatch(left, right);
  }
  if (rule.kind === 'percentage')
    return left.unit === '%' && right.unit === '%' && close(left.value, right.value, 0.01);
  return converted(
    left,
    right,
    rule.kind === 'angle' ? angles : times,
    rule.kind === 'angle' ? 0.01 : 0.1,
  );
}
