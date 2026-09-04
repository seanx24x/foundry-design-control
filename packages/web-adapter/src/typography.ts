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

export interface ProjectTypographyStyleValues {
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
  fontVariationSettings: string;
}

export interface ProjectTypographyStyle {
  id: string;
  name: string;
  values: ProjectTypographyStyleValues;
  validation: TypographyValidationPlan;
  createdAt: string;
  updatedAt: string;
}

export interface TypographyValidationPlan {
  breakpoints: Array<{ id: string; label: string }>;
  themes: Array<{ id: string; label: string }>;
  states: Array<{ id: string; label: string }>;
}

export interface TypographyVerificationContext {
  breakpoint: string;
  theme: string;
  state: string;
}

export interface FontIntegrationPlan {
  strategy: FontInstallStrategy;
  label: string;
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  declaration: string;
  cssUrl: string;
  packageName?: string;
  importStatement?: string;
  sourceActions: string[];
  verificationChecks: string[];
  requiresAssetSelection: boolean;
}

export interface TypographyValidationInput {
  breakpoints?: Array<{ id: string; label?: string }>;
  themes?: Array<{ id: string; label?: string }>;
  states?: Array<string | { id: string; label?: string }>;
  currentBreakpoint?: string;
  currentTheme?: string;
  currentState?: string;
}

interface TypographyStyleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function contextOption(value: string | { id: string; label?: string }): {
  id: string;
  label: string;
} {
  return typeof value === 'string'
    ? { id: value, label: value }
    : { id: value.id, label: value.label || value.id };
}

function uniqueContextOptions(
  values: Array<string | { id: string; label?: string }>,
): Array<{ id: string; label: string }> {
  const seen = new Set<string>();
  return values.map(contextOption).filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function buildTypographyValidationPlan(
  input: TypographyValidationInput,
): TypographyValidationPlan {
  const breakpoints = uniqueContextOptions(
    input.breakpoints?.length ? input.breakpoints : [input.currentBreakpoint || 'current'],
  );
  const themes = uniqueContextOptions([input.currentTheme || 'current', ...(input.themes ?? [])]);
  const states = uniqueContextOptions([input.currentState || 'current', ...(input.states ?? [])]);
  return { breakpoints, themes, states };
}

export function typographyVerificationContexts(
  plan: TypographyValidationPlan,
): TypographyVerificationContext[] {
  return plan.breakpoints.flatMap((breakpoint) =>
    plan.themes.flatMap((theme) =>
      plan.states.map((state) => ({
        breakpoint: breakpoint.id,
        theme: theme.id,
        state: state.id,
      })),
    ),
  );
}

export function typographyValidationEvidence(plan: TypographyValidationPlan): string[] {
  const list = (items: Array<{ label: string }>): string =>
    items.map((item) => item.label).join(', ');
  return [
    `responsive validation contexts: ${list(plan.breakpoints)}`,
    `theme validation contexts: ${list(plan.themes)}`,
    `state validation contexts: ${list(plan.states)}`,
    `typography verification plan: ${JSON.stringify(typographyVerificationContexts(plan))}`,
    'verify the rebuilt style in every listed context',
  ];
}

export function parseTypographyVerificationContexts(
  evidence: string[] | undefined,
): TypographyVerificationContext[] {
  const prefix = 'typography verification plan:';
  const encoded = evidence
    ?.find((item) => item.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
  if (!encoded) return [];
  try {
    const parsed = JSON.parse(encoded) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((context): context is TypographyVerificationContext =>
      Boolean(
        context &&
        typeof context === 'object' &&
        typeof (context as TypographyVerificationContext).breakpoint === 'string' &&
        typeof (context as TypographyVerificationContext).theme === 'string' &&
        typeof (context as TypographyVerificationContext).state === 'string',
      ),
    );
  } catch {
    return [];
  }
}

export function parseFontIntegrationPlan(
  evidence: string[] | undefined,
): FontIntegrationPlan | undefined {
  const prefix = 'font integration plan:';
  const encoded = evidence
    ?.find((item) => item.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
  if (!encoded) return undefined;
  try {
    const parsed = JSON.parse(encoded) as Partial<FontIntegrationPlan>;
    return parsed &&
      typeof parsed.family === 'string' &&
      typeof parsed.strategy === 'string' &&
      typeof parsed.weight === 'number' &&
      typeof parsed.style === 'string' &&
      Array.isArray(parsed.sourceActions) &&
      Array.isArray(parsed.verificationChecks)
      ? (parsed as FontIntegrationPlan)
      : undefined;
  } catch {
    return undefined;
  }
}

function typographyStyleSlug(name: string): string {
  return (
    name
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'type-style'
  );
}

export function createProjectTypographyStyle(input: {
  name: string;
  values: ProjectTypographyStyleValues;
  validation: TypographyValidationPlan;
  now?: string;
}): ProjectTypographyStyle {
  const timestamp = input.now ?? new Date().toISOString();
  const name = input.name.trim() || 'Untitled type style';
  return {
    id: `type_${typographyStyleSlug(name)}`,
    name,
    values: input.values,
    validation: input.validation,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function projectTypographyStylesKey(projectRoot: string): string {
  return `__foundry_typography_styles:${projectRoot || 'local'}`;
}

export function readProjectTypographyStyles(
  storage: TypographyStyleStorage,
  projectRoot: string,
): ProjectTypographyStyle[] {
  try {
    const parsed = JSON.parse(storage.getItem(projectTypographyStylesKey(projectRoot)) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((style): style is ProjectTypographyStyle =>
          Boolean(style?.id && style?.name && style?.values && style?.validation),
        )
      : [];
  } catch {
    return [];
  }
}

export function writeProjectTypographyStyles(
  storage: TypographyStyleStorage,
  projectRoot: string,
  styles: ProjectTypographyStyle[],
): void {
  storage.setItem(projectTypographyStylesKey(projectRoot), JSON.stringify(styles));
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

function fontPackageSlug(family: string): string {
  return family
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildFontIntegrationPlan(
  selection: GoogleFontSelection,
  strategy: FontInstallStrategy,
  currentStack = 'system-ui, sans-serif',
): FontIntegrationPlan {
  const family = selection.font.family;
  const declaration = fontFamilyDeclaration(family, currentStack);
  const cssUrl = googleFontsCssUrl(selection.font, {
    weight: selection.weight,
    style: selection.style,
    axes: selection.axes,
    variableRanges: selection.font.axes.length > 0,
  });
  const packageSlug = fontPackageSlug(family);
  const variable = selection.font.axes.length > 0;
  const packageName = variable
    ? `@fontsource-variable/${packageSlug}`
    : `@fontsource/${packageSlug}`;
  const faceSuffix = selection.style === 'italic' ? '-italic' : '';
  const importStatement = variable
    ? `import '${packageName}';`
    : `import '${packageName}/${selection.weight}${faceSuffix}.css';`;
  const axes = googleFontVariationSettings(selection);
  const commonChecks = [
    `family resolves to ${family}`,
    `weight resolves to ${selection.weight}`,
    `style resolves to ${selection.style}`,
    ...(axes === 'normal' ? [] : [`variable axes resolve to ${axes}`]),
    'requested font face reports loaded in the rebuilt document',
    'text wrapping and clipping match the recorded validation contexts',
  ];
  const strategyLabel =
    fontInstallStrategies.find((item) => item.id === strategy)?.label ?? strategy;
  const plan: FontIntegrationPlan = {
    strategy,
    label: strategyLabel,
    family,
    weight: selection.weight,
    style: selection.style,
    declaration,
    cssUrl,
    sourceActions: [],
    verificationChecks: commonChecks,
    requiresAssetSelection: false,
  };
  if (strategy === 'framework') {
    plan.sourceActions = [
      'Use the detected framework-native font loader in the existing root typography entry point.',
      `Request ${family} at weight ${selection.weight}, style ${selection.style}${axes === 'normal' ? '' : `, and axes ${axes}`}.`,
      `Expose the loaded family through the project’s existing class, variable, or token convention and set the selected source target to ${declaration}.`,
    ];
  } else if (strategy === 'package') {
    plan.packageName = packageName;
    plan.importStatement = importStatement;
    plan.sourceActions = [
      `Install ${packageName} with the project package manager and record the resolved version in the lockfile.`,
      `Add ${importStatement} to the existing root typography entry point.`,
      `Set the selected source target to ${declaration}.`,
    ];
  } else if (strategy === 'stylesheet') {
    plan.sourceActions = [
      `Add the exact stylesheet request ${cssUrl} to the project’s existing document or root stylesheet integration point.`,
      `Set the selected source target to ${declaration}.`,
    ];
  } else {
    plan.requiresAssetSelection = true;
    plan.sourceActions = [
      `Use an existing licensed ${family} WOFF2 asset in the project. Do not download or substitute an unreviewed file.`,
      `Create or extend the project’s existing @font-face declaration for weight ${selection.weight} and style ${selection.style}.`,
      `Set the selected source target to ${declaration}. If no licensed asset can be mapped exactly, report the change as unresolved.`,
    ];
  }
  return plan;
}

function comparableTypographyValue(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replaceAll(/\s+/g, ' ')
    .toLocaleLowerCase();
}

export function typographyPropertyMatches(
  property: string,
  rendered: unknown,
  expected: unknown,
): boolean {
  if (property === 'fontFamily') {
    const renderedFamilies = parseFontFamilyStack(String(rendered ?? '')).map((family) =>
      family.toLocaleLowerCase(),
    );
    const expectedFamilies = parseFontFamilyStack(String(expected ?? '')).map((family) =>
      family.toLocaleLowerCase(),
    );
    return Boolean(
      renderedFamilies[0] && expectedFamilies[0] && renderedFamilies[0] === expectedFamilies[0],
    );
  }
  if (property === 'fontWeight') {
    return numericWeight(String(rendered)) === numericWeight(String(expected));
  }
  if (property === 'fontStyle') {
    return comparableTypographyValue(rendered) === comparableTypographyValue(expected);
  }
  if (property === 'fontVariationSettings') {
    return (
      comparableTypographyValue(rendered).replaceAll(' ', '') ===
      comparableTypographyValue(expected).replaceAll(' ', '')
    );
  }
  const numericProperties = new Set([
    'fontSize',
    'lineHeight',
    'letterSpacing',
    'wordSpacing',
    'textIndent',
  ]);
  if (numericProperties.has(property)) {
    const renderedNumber = Number.parseFloat(String(rendered));
    const expectedNumber = Number.parseFloat(String(expected));
    return (
      Number.isFinite(renderedNumber) &&
      Number.isFinite(expectedNumber) &&
      Math.abs(renderedNumber - expectedNumber) < 0.02
    );
  }
  return comparableTypographyValue(rendered) === comparableTypographyValue(expected);
}

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
