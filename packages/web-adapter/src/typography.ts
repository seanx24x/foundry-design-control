export type FontOrigin = 'active' | 'project' | 'used' | 'local';

export interface TypographyFontFace {
  family: string;
  styles: string[];
  weights: string[];
  origins: FontOrigin[];
  status?: string;
  localOnly?: boolean;
}

export interface LocalFontRecord {
  family: string;
  fullName?: string;
  postscriptName?: string;
  style?: string;
}

export interface GoogleFontAxis {
  tag: string;
  min: number;
  max: number;
  defaultValue: number;
}

export interface GoogleFontFamily {
  family: string;
  category: string;
  variants: string[];
  subsets: string[];
  axes: GoogleFontAxis[];
  popularity: number;
}

export interface GoogleFontSelection {
  font: GoogleFontFamily;
  weight: number;
  style: 'normal' | 'italic';
  axes: Record<string, number>;
}

export interface GoogleFontsCssOptions {
  weight?: number;
  style?: 'normal' | 'italic';
  axes?: Record<string, number>;
  variableRanges?: boolean;
}

export interface RenderedFontFace {
  family: string;
  weight: string;
  style: string;
  status: FontFaceLoadStatus;
}

export interface TypographyDiagnosticInput {
  primaryFamily: string;
  requestedWeight: number;
  requestedStyle: string;
  fontSynthesis: string;
  fontCheck: boolean;
  faces: RenderedFontFace[];
  text: string;
  fontSize: number;
  lineHeight: number;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  whiteSpace: string;
  overflowX: string;
  overflowY: string;
  measuredLineCount?: number;
}

export interface TypographyDiagnostic {
  id: 'load' | 'fallback' | 'weight' | 'style' | 'line-length' | 'clipping';
  severity: 'warning' | 'error';
  title: string;
  detail: string;
}

export interface TypographyAnalysis {
  diagnostics: TypographyDiagnostic[];
  lineCount: number;
  charactersPerLine: number;
  faceStatus: 'loaded' | 'system' | 'fallback' | 'failed';
}

export interface TypeTreatment {
  id: 'tight' | 'balanced' | 'open';
  label: string;
  detail: string;
  lineHeight: number;
  letterSpacing: string;
}

export const typeTreatments: TypeTreatment[] = [
  {
    id: 'tight',
    label: 'Tight',
    detail: 'Display rhythm',
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    detail: 'Everyday reading',
    lineHeight: 1.4,
    letterSpacing: '0em',
  },
  {
    id: 'open',
    label: 'Open',
    detail: 'Long-form rhythm',
    lineHeight: 1.6,
    letterSpacing: '0.01em',
  },
];

function roundedGridValue(value: number): number {
  return Math.max(4, Math.round(value / 4) * 4);
}

export function modularTypeSize(base: number, ratio: number, step: number): number {
  return roundedGridValue(base * ratio ** step);
}

export function fluidTypeClamp(
  minSize: number,
  maxSize: number,
  minViewport = 320,
  maxViewport = 1440,
): string {
  const safeMinViewport = Math.min(minViewport, maxViewport - 1);
  const safeMaxViewport = Math.max(maxViewport, safeMinViewport + 1);
  const low = Math.min(minSize, maxSize);
  const high = Math.max(minSize, maxSize);
  const slope = (high - low) / (safeMaxViewport - safeMinViewport);
  const intercept = low - slope * safeMinViewport;
  const preferred = `${Number(intercept.toFixed(3))}px + ${Number((slope * 100).toFixed(3))}vw`;
  return `clamp(${low}px, calc(${preferred}), ${high}px)`;
}

export type FontInstallStrategy = 'framework' | 'package' | 'stylesheet' | 'self-hosted';

export const fontInstallStrategies: Array<{
  id: FontInstallStrategy;
  label: string;
  detail: string;
}> = [
  {
    id: 'framework',
    label: 'Framework',
    detail: 'Use the project framework’s font integration.',
  },
  { id: 'package', label: 'Package', detail: 'Install a versioned font package.' },
  { id: 'stylesheet', label: 'Stylesheet', detail: 'Add a Google Fonts CSS2 request.' },
  { id: 'self-hosted', label: 'Self-host', detail: 'Download and serve font files locally.' },
];

const genericFamilies = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
]);

function numericWeight(value: string): number {
  if (value === 'normal') return 400;
  if (value === 'bold') return 700;
  return Number.parseInt(value, 10) || 400;
}

function faceSupportsWeight(faceWeight: string, requested: number): boolean {
  const values = faceWeight.match(/\d+/g)?.map(Number) ?? [];
  if (values.length > 1) return requested >= values[0]! && requested <= values[1]!;
  return numericWeight(faceWeight) === requested;
}

export function analyzeTypography(input: TypographyDiagnosticInput): TypographyAnalysis {
  const diagnostics: TypographyDiagnostic[] = [];
  const family = normalizeFontFamily(input.primaryFamily).toLocaleLowerCase();
  const matchingFaces = input.faces.filter(
    (face) => normalizeFontFamily(face.family).toLocaleLowerCase() === family,
  );
  const loadedFaces = matchingFaces.filter((face) => face.status === 'loaded');
  const failedFaces = matchingFaces.filter((face) => face.status === 'error');
  const synthesisDisabled = input.fontSynthesis === 'none';

  if (failedFaces.length) {
    diagnostics.push({
      id: 'load',
      severity: 'error',
      title: 'Font failed to load',
      detail: `${input.primaryFamily} has ${failedFaces.length} failed ${failedFaces.length === 1 ? 'face' : 'faces'} in this document.`,
    });
  } else if (matchingFaces.length && (!loadedFaces.length || !input.fontCheck)) {
    diagnostics.push({
      id: 'fallback',
      severity: 'error',
      title: 'Fallback is rendering',
      detail: `${input.primaryFamily} is declared, but the requested face is not available at this viewport.`,
    });
  }

  if (
    loadedFaces.length &&
    !loadedFaces.some((face) => faceSupportsWeight(face.weight, input.requestedWeight))
  ) {
    diagnostics.push({
      id: 'weight',
      severity: 'warning',
      title: synthesisDisabled ? 'Weight is unavailable' : 'Weight may be synthetic',
      detail: `${input.requestedWeight} is not present among the loaded ${input.primaryFamily} faces.`,
    });
  }

  const requestedItalic = input.requestedStyle === 'italic' || input.requestedStyle === 'oblique';
  const hasRequestedStyle = loadedFaces.some((face) => {
    if (!requestedItalic) return face.style === 'normal';
    return face.style === 'italic' || face.style === 'oblique';
  });
  if (loadedFaces.length && !hasRequestedStyle) {
    diagnostics.push({
      id: 'style',
      severity: 'warning',
      title:
        requestedItalic && !synthesisDisabled ? 'Style may be synthetic' : 'Style is unavailable',
      detail: `${input.requestedStyle} is not present among the loaded ${input.primaryFamily} faces.`,
    });
  }

  const lineCount =
    input.measuredLineCount ??
    (input.lineHeight > 0 ? Math.max(1, Math.round(input.clientHeight / input.lineHeight)) : 1);
  const characterCount = input.text.replace(/\s+/g, ' ').trim().length;
  const charactersPerLine = characterCount ? Math.ceil(characterCount / lineCount) : 0;
  if (charactersPerLine > 80) {
    diagnostics.push({
      id: 'line-length',
      severity: 'warning',
      title: 'Line length is difficult to scan',
      detail: `About ${charactersPerLine} characters render per line at this viewport.`,
    });
  }

  const clipsX = ['hidden', 'clip'].includes(input.overflowX);
  const clipsY = ['hidden', 'clip'].includes(input.overflowY);
  const horizontalClip = input.scrollWidth > input.clientWidth + 1 && clipsX;
  const verticalClip = input.scrollHeight > input.clientHeight + 1 && clipsY;
  if (horizontalClip || verticalClip) {
    diagnostics.push({
      id: 'clipping',
      severity: 'error',
      title: 'Text is clipped',
      detail: horizontalClip
        ? input.whiteSpace === 'nowrap'
          ? 'The line cannot wrap and extends beyond its visible width.'
          : 'Text extends beyond its visible width.'
        : 'Wrapped text extends beyond its visible height.',
    });
  }

  return {
    diagnostics,
    lineCount,
    charactersPerLine,
    faceStatus: failedFaces.length
      ? 'failed'
      : matchingFaces.length
        ? loadedFaces.length && input.fontCheck
          ? 'loaded'
          : 'fallback'
        : 'system',
  };
}

export function normalizeFontFamily(value: string): string {
  return value
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .trim();
}

export function parseFontFamilyStack(value: string): string[] {
  const families: string[] = [];
  let quote = '';
  let current = '';
  for (const character of value) {
    if ((character === '"' || character === "'") && (!quote || quote === character)) {
      quote = quote ? '' : character;
      current += character;
      continue;
    }
    if (character === ',' && !quote) {
      const family = normalizeFontFamily(current);
      if (family) families.push(family);
      current = '';
      continue;
    }
    current += character;
  }
  const finalFamily = normalizeFontFamily(current);
  if (finalFamily) families.push(finalFamily);
  return [...new Set(families)];
}

export function fontFamilyDeclaration(family: string, currentStack = ''): string {
  const normalized = normalizeFontFamily(family);
  const escaped = normalized.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const fallback = parseFontFamilyStack(currentStack).filter(
    (candidate) => candidate !== normalized && genericFamilies.has(candidate.toLowerCase()),
  );
  return [`"${escaped}"`, ...fallback].join(', ');
}

export function googleFontWeights(font: GoogleFontFamily): number[] {
  const weights = font.variants
    .map((variant) => Number(variant.match(/\d+/)?.[0]))
    .filter((weight) => Number.isFinite(weight));
  const weightAxis = font.axes.find((axis) => axis.tag === 'wght');
  if (weightAxis) {
    const stepped = [100, 200, 300, 400, 500, 600, 700, 800, 900].filter(
      (weight) => weight >= weightAxis.min && weight <= weightAxis.max,
    );
    weights.push(...stepped, Math.round(weightAxis.defaultValue));
  }
  return [...new Set(weights)].sort((a, b) => a - b);
}

export function googleFontStyles(font: GoogleFontFamily): Array<'normal' | 'italic'> {
  return font.variants.some((variant) => /i(?:talic)?$/i.test(variant)) ||
    font.axes.some((axis) => axis.tag === 'ital')
    ? ['normal', 'italic']
    : ['normal'];
}

export function defaultGoogleFontSelection(
  font: GoogleFontFamily,
  currentWeight = 400,
  currentStyle = 'normal',
): GoogleFontSelection {
  const weights = googleFontWeights(font);
  const weight = weights.reduce(
    (nearest, candidate) =>
      Math.abs(candidate - currentWeight) < Math.abs(nearest - currentWeight) ? candidate : nearest,
    weights[0] ?? 400,
  );
  const styles = googleFontStyles(font);
  return {
    font,
    weight,
    style: currentStyle === 'italic' && styles.includes('italic') ? 'italic' : 'normal',
    axes: Object.fromEntries(font.axes.map((axis) => [axis.tag, axis.defaultValue])),
  };
}

export function googleFontVariationSettings(selection: GoogleFontSelection): string {
  const entries = selection.font.axes
    .filter((axis) => !['ital', 'wght'].includes(axis.tag))
    .map((axis) => [axis.tag, selection.axes[axis.tag] ?? axis.defaultValue] as const);
  return entries.length
    ? entries.map(([tag, value]) => `"${tag}" ${Number(value.toFixed(2))}`).join(', ')
    : 'normal';
}

export function googleFontsCssUrl(
  font: GoogleFontFamily,
  options: GoogleFontsCssOptions = {},
): string {
  const family = font.family.trim().replaceAll(' ', '+');
  if (options.weight != null || options.style || options.axes || options.variableRanges) {
    const axisValues = new Map<string, string>();
    const style = options.style ?? 'normal';
    const weightAxis = font.axes.find((axis) => axis.tag === 'wght');
    if (weightAxis && options.variableRanges) {
      axisValues.set('wght', `${weightAxis.min}..${weightAxis.max}`);
    } else {
      axisValues.set('wght', String(options.weight ?? 400));
    }
    for (const axis of font.axes) {
      if (axis.tag === 'wght' || axis.tag === 'ital') continue;
      axisValues.set(
        axis.tag,
        options.variableRanges
          ? `${axis.min}..${axis.max}`
          : String(options.axes?.[axis.tag] ?? axis.defaultValue),
      );
    }
    const italicAxis = font.axes.find((axis) => axis.tag === 'ital');
    if (italicAxis || font.variants.some((variant) => /i(?:talic)?$/i.test(variant))) {
      axisValues.set('ital', style === 'italic' ? '1' : '0');
    }
    const axes = [...axisValues].sort(([a], [b]) => a.localeCompare(b, 'en-US'));
    const specification = axes.length
      ? `${family}:${axes.map(([tag]) => tag).join(',')}@${axes.map(([, value]) => value).join(',')}`
      : family;
    return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(specification).replaceAll('%2B', '+').replaceAll('%3A', ':').replaceAll('%40', '@').replaceAll('%2C', ',').replaceAll('%2E', '.')}&display=swap`;
  }
  const weights = googleFontWeights(font).map(String);
  const specification = weights.length ? `${family}:wght@${weights.join(';')}` : family;
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(specification).replaceAll('%2B', '+').replaceAll('%3A', ':').replaceAll('%40', '@').replaceAll('%3B', ';')}&display=swap`;
}

function addValue(values: string[], value?: string): void {
  const normalized = value?.trim();
  if (normalized && !values.includes(normalized)) values.push(normalized);
}

function addOrigin(origins: FontOrigin[], origin: FontOrigin): void {
  if (!origins.includes(origin)) origins.push(origin);
}

export function mergeTypographyFonts(fonts: TypographyFontFace[]): TypographyFontFace[] {
  const merged = new Map<string, TypographyFontFace>();
  for (const font of fonts) {
    const family = normalizeFontFamily(font.family);
    if (!family || genericFamilies.has(family.toLowerCase())) continue;
    const key = family.toLocaleLowerCase();
    const entry = merged.get(key) ?? {
      family,
      styles: [],
      weights: [],
      origins: [],
      status: font.status,
      localOnly: true,
    };
    font.styles.forEach((style) => addValue(entry.styles, style));
    font.weights.forEach((weight) => addValue(entry.weights, weight));
    font.origins.forEach((origin) => addOrigin(entry.origins, origin));
    if (font.status === 'loaded' || !entry.status) entry.status = font.status;
    entry.localOnly = Boolean(entry.localOnly && font.localOnly);
    merged.set(key, entry);
  }
  return [...merged.values()].sort((a, b) => {
    const aActive = a.origins.includes('active') ? 0 : 1;
    const bActive = b.origins.includes('active') ? 0 : 1;
    return aActive - bActive || a.family.localeCompare(b.family);
  });
}

export function localFontRecords(records: LocalFontRecord[]): TypographyFontFace[] {
  return mergeTypographyFonts(
    records.map((record) => ({
      family: record.family,
      styles: [record.style ?? 'normal'],
      weights: [],
      origins: ['local'],
      status: 'available',
      localOnly: true,
    })),
  );
}

export function collectProjectFonts(
  document: Document,
  selected?: HTMLElement | null,
  elementLimit = 400,
): TypographyFontFace[] {
  const found: TypographyFontFace[] = [];
  const view = document.defaultView;
  const activeStack = selected && view ? view.getComputedStyle(selected).fontFamily : '';
  for (const family of parseFontFamilyStack(activeStack)) {
    found.push({
      family,
      styles: selected && view ? [view.getComputedStyle(selected).fontStyle] : [],
      weights: selected && view ? [view.getComputedStyle(selected).fontWeight] : [],
      origins: ['active'],
      status: document.fonts.check(`16px "${family.replaceAll('"', '\\"')}"`)
        ? 'loaded'
        : 'fallback',
      localOnly: false,
    });
  }

  for (const face of document.fonts) {
    found.push({
      family: face.family,
      styles: [face.style],
      weights: [face.weight],
      origins: ['project'],
      status: face.status,
      localOnly: false,
    });
  }

  if (view) {
    const elements = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => !element.closest('[data-foundry-overlay="true"]'))
      .slice(0, elementLimit);
    for (const element of elements) {
      const computed = view.getComputedStyle(element);
      for (const family of parseFontFamilyStack(computed.fontFamily)) {
        found.push({
          family,
          styles: [computed.fontStyle],
          weights: [computed.fontWeight],
          origins: ['used'],
          status: document.fonts.check(`16px "${family.replaceAll('"', '\\"')}"`)
            ? 'loaded'
            : 'fallback',
          localOnly: false,
        });
      }
    }
  }
  return mergeTypographyFonts(found);
}
