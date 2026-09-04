import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeTypography,
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
  parseFontFamilyStack,
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
