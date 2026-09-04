import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeTypography,
  buildFontIntegrationPlan,
  buildTypographyValidationPlan,
  createProjectTypographyStyle,
  defaultGoogleFontSelection,
  fontFamilyDeclaration,
  fluidTypeClamp,
  googleFontStyles,
  googleFontVariationSettings,
  googleFontWeights,
  googleFontsCssUrl,
  localFontRecords,
  mergeTypographyFonts,
  modularTypeSize,
  normalizeFontFamily,
  parseFontIntegrationPlan,
  parseFontFamilyStack,
  parseTypographyVerificationContexts,
  readProjectTypographyStyles,
  typographyValidationEvidence,
  typographyPropertyMatches,
  typographyVerificationContexts,
  writeProjectTypographyStyles,
} from './typography.js';

const diagnosticBaseline = {
  primaryFamily: 'Inter',
  requestedWeight: 400,
  requestedStyle: 'normal',
  fontSynthesis: 'auto',
  fontCheck: true,
  faces: [{ family: 'Inter', weight: '100 900', style: 'normal', status: 'loaded' as const }],
  text: 'A concise paragraph that remains easy to scan.',
  fontSize: 16,
  lineHeight: 24,
  clientWidth: 320,
  clientHeight: 48,
  scrollWidth: 320,
  scrollHeight: 48,
  whiteSpace: 'normal',
  overflowX: 'visible',
  overflowY: 'visible',
};

const variableFont = {
  family: 'Roboto Flex',
  category: 'Sans Serif',
  variants: ['100', '400', '700'],
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  axes: [
    { tag: 'opsz', min: 8, max: 144, defaultValue: 14 },
    { tag: 'slnt', min: -10, max: 0, defaultValue: 0 },
    { tag: 'wdth', min: 25, max: 151, defaultValue: 100 },
    { tag: 'wght', min: 100, max: 1000, defaultValue: 400 },
  ],
  popularity: 1,
};

test('parses quoted font stacks without splitting family names', () => {
  assert.deepEqual(parseFontFamilyStack('"Avenir Next", Inter, sans-serif'), [
    'Avenir Next',
    'Inter',
    'sans-serif',
  ]);
  assert.equal(normalizeFontFamily("'Foundry Inter'"), 'Foundry Inter');
});

test('creates a safe family declaration and preserves generic fallbacks', () => {
  assert.equal(
    fontFamilyDeclaration('Newsreader', 'Inter, system-ui, sans-serif'),
    '"Newsreader", system-ui, sans-serif',
  );
  assert.equal(fontFamilyDeclaration('Avenir "Next"', 'serif'), '"Avenir \\"Next\\"", serif');
});

test('merges faces by family and keeps active fonts first', () => {
  const fonts = mergeTypographyFonts([
    {
      family: 'Inter',
      styles: ['normal'],
      weights: ['400'],
      origins: ['project'],
      status: 'loaded',
      localOnly: false,
    },
    {
      family: 'inter',
      styles: ['italic'],
      weights: ['700'],
      origins: ['active'],
      status: 'loaded',
      localOnly: false,
    },
    {
      family: 'system-ui',
      styles: ['normal'],
      weights: ['400'],
      origins: ['used'],
    },
  ]);
  assert.equal(fonts.length, 1);
  assert.equal(fonts[0]?.family, 'Inter');
  assert.deepEqual(fonts[0]?.styles, ['normal', 'italic']);
  assert.deepEqual(fonts[0]?.weights, ['400', '700']);
  assert.deepEqual(fonts[0]?.origins, ['project', 'active']);
});

test('normalizes local font records into preview-only families', () => {
  const fonts = localFontRecords([
    { family: 'Avenir Next', style: 'Regular' },
    { family: 'Avenir Next', style: 'Bold' },
  ]);
  assert.deepEqual(fonts, [
    {
      family: 'Avenir Next',
      styles: ['Regular', 'Bold'],
      weights: [],
      origins: ['local'],
      status: 'available',
      localOnly: true,
    },
  ]);
});

test('builds a Google Fonts CSS2 preview URL from available weights', () => {
  assert.equal(
    googleFontsCssUrl({
      family: 'Newsreader',
      category: 'Serif',
      variants: ['400', '700', '700i'],
      subsets: ['latin'],
      axes: [],
      popularity: 1,
    }),
    'https://fonts.googleapis.com/css2?family=Newsreader:wght@400;700&display=swap',
  );
});

test('derives selectable weights, styles, and variable defaults', () => {
  assert.deepEqual(googleFontWeights(variableFont), [100, 200, 300, 400, 500, 600, 700, 800, 900]);
  assert.deepEqual(googleFontStyles(variableFont), ['normal']);
  const selection = defaultGoogleFontSelection(variableFont, 650, 'italic');
  assert.equal(selection.weight, 600);
  assert.equal(selection.style, 'normal');
  assert.deepEqual(selection.axes, { opsz: 14, slnt: 0, wdth: 100, wght: 400 });
  assert.equal(googleFontVariationSettings(selection), '"opsz" 14, "slnt" 0, "wdth" 100');
});

test('builds a sorted variable Google Fonts request for live axis editing', () => {
  assert.equal(
    googleFontsCssUrl(variableFont, {
      weight: 600,
      style: 'normal',
      axes: { opsz: 32, slnt: -8, wdth: 90 },
      variableRanges: true,
    }),
    'https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,slnt,wdth,wght@8..144,-10..0,25..151,100..1000&display=swap',
  );
});

test('reports loaded typography without inventing findings', () => {
  assert.deepEqual(analyzeTypography(diagnosticBaseline), {
    diagnostics: [],
    lineCount: 2,
    charactersPerLine: 23,
    faceStatus: 'loaded',
  });
});

test('finds failed faces, synthetic requests, long lines, and clipping', () => {
  const analysis = analyzeTypography({
    ...diagnosticBaseline,
    requestedWeight: 700,
    requestedStyle: 'italic',
    fontCheck: false,
    faces: [
      { family: 'Inter', weight: '400', style: 'normal', status: 'loaded' },
      { family: 'Inter', weight: '700', style: 'normal', status: 'error' },
    ],
    text: 'x'.repeat(120),
    clientHeight: 24,
    clientWidth: 200,
    scrollWidth: 260,
    overflowX: 'hidden',
    whiteSpace: 'nowrap',
  });
  assert.deepEqual(
    analysis.diagnostics.map((finding) => finding.id),
    ['load', 'weight', 'style', 'line-length', 'clipping'],
  );
  assert.equal(analysis.faceStatus, 'failed');
});

test('does not claim system fonts are missing when no document face is declared', () => {
  const analysis = analyzeTypography({
    ...diagnosticBaseline,
    primaryFamily: 'Avenir Next',
    faces: [],
  });
  assert.equal(analysis.faceStatus, 'system');
  assert.deepEqual(analysis.diagnostics, []);
});

test('builds grid-aligned modular type sizes', () => {
  assert.equal(modularTypeSize(16, 1.25, -1), 12);
  assert.equal(modularTypeSize(16, 1.25, 0), 16);
  assert.equal(modularTypeSize(16, 1.25, 1), 20);
  assert.equal(modularTypeSize(16, 1.25, 2), 24);
  assert.equal(modularTypeSize(16, 1.25, 3), 32);
});

test('creates a deterministic fluid clamp between viewport-safe endpoints', () => {
  assert.equal(fluidTypeClamp(20, 32), 'clamp(20px, calc(16.571px + 1.071vw), 32px)');
  assert.equal(fluidTypeClamp(32, 20), 'clamp(20px, calc(16.571px + 1.071vw), 32px)');
});

test('builds a responsive and state validation plan without duplicate contexts', () => {
  const plan = buildTypographyValidationPlan({
    breakpoints: [
      { id: 'mobile', label: 'Mobile' },
      { id: 'desktop', label: 'Desktop' },
    ],
    themes: [
      { id: 'light', label: 'Light' },
      { id: 'dark', label: 'Dark' },
    ],
    states: ['current', { id: 'focus', label: 'Focus' }, 'focus'],
    currentBreakpoint: 'desktop',
    currentTheme: 'dark',
    currentState: 'current',
  });
  assert.deepEqual(plan, {
    breakpoints: [
      { id: 'mobile', label: 'Mobile' },
      { id: 'desktop', label: 'Desktop' },
    ],
    themes: [
      { id: 'dark', label: 'dark' },
      { id: 'light', label: 'Light' },
    ],
    states: [
      { id: 'current', label: 'current' },
      { id: 'focus', label: 'Focus' },
    ],
  });
  assert.deepEqual(typographyValidationEvidence(plan), [
    'responsive validation contexts: Mobile, Desktop',
    'theme validation contexts: dark, Light',
    'state validation contexts: current, Focus',
    `typography verification plan: ${JSON.stringify(typographyVerificationContexts(plan))}`,
    'verify the rebuilt style in every listed context',
  ]);
  assert.equal(typographyVerificationContexts(plan).length, 8);
  assert.deepEqual(
    parseTypographyVerificationContexts(typographyValidationEvidence(plan)),
    typographyVerificationContexts(plan),
  );
});

test('builds exact, reviewable font integration plans for each source strategy', () => {
  const selection = defaultGoogleFontSelection(variableFont, 600, 'normal');
  const stylesheet = buildFontIntegrationPlan(selection, 'stylesheet', 'Inter, sans-serif');
  assert.equal(stylesheet.strategy, 'stylesheet');
  assert.match(stylesheet.cssUrl, /fonts\.googleapis\.com\/css2/);
  assert.match(stylesheet.sourceActions[0]!, /exact stylesheet request/);
  assert.equal(stylesheet.requiresAssetSelection, false);

  const packagePlan = buildFontIntegrationPlan(selection, 'package', 'Inter, sans-serif');
  assert.equal(packagePlan.packageName, '@fontsource-variable/roboto-flex');
  assert.equal(packagePlan.importStatement, "import '@fontsource-variable/roboto-flex';");

  const selfHosted = buildFontIntegrationPlan(selection, 'self-hosted', 'Inter, sans-serif');
  assert.equal(selfHosted.requiresAssetSelection, true);
  assert.match(selfHosted.sourceActions.join(' '), /licensed Roboto Flex WOFF2 asset/);

  const evidence = [`font integration plan: ${JSON.stringify(packagePlan)}`];
  assert.deepEqual(parseFontIntegrationPlan(evidence), packagePlan);
});

test('matches rendered typography semantically instead of comparing browser formatting', () => {
  assert.equal(
    typographyPropertyMatches(
      'fontFamily',
      '"Roboto Flex", Arial, sans-serif',
      'Roboto Flex, sans-serif',
    ),
    true,
  );
  assert.equal(typographyPropertyMatches('fontWeight', 'normal', '400'), true);
  assert.equal(
    typographyPropertyMatches(
      'fontVariationSettings',
      '"opsz" 14, "wdth" 100',
      '"opsz" 14,"wdth" 100',
    ),
    true,
  );
  assert.equal(typographyPropertyMatches('fontSize', '31.999px', '32px'), true);
  assert.equal(typographyPropertyMatches('fontStyle', 'normal', 'italic'), false);
});

test('stores project typography styles locally and replaces matching names deterministically', () => {
  const values = {
    fontFamily: 'Inter, sans-serif',
    fontWeight: '600',
    fontStyle: 'normal',
    fontSize: '32px',
    lineHeight: '40px',
    letterSpacing: '-0.02em',
    fontVariationSettings: 'normal',
  };
  const validation = buildTypographyValidationPlan({
    breakpoints: [{ id: 'desktop', label: 'Desktop' }],
    currentTheme: 'light',
    states: ['current'],
  });
  const style = createProjectTypographyStyle({
    name: 'Display / Tight',
    values,
    validation,
    now: '2026-09-04T12:00:00.000Z',
  });
  assert.equal(style.id, 'type_display-tight');
  const valuesByKey = new Map<string, string>();
  const storage = {
    getItem: (key: string) => valuesByKey.get(key) ?? null,
    setItem: (key: string, value: string) => void valuesByKey.set(key, value),
  };
  writeProjectTypographyStyles(storage, '/project', [style]);
  assert.deepEqual(readProjectTypographyStyles(storage, '/project'), [style]);
  assert.deepEqual(readProjectTypographyStyles(storage, '/another-project'), []);
});
