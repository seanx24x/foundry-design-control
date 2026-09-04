import assert from 'node:assert/strict';
import test from 'node:test';
import { GoogleFontsCatalog, parseGoogleFontsMetadata } from './google-fonts.js';

test('normalizes the Google Fonts catalog into the local typography contract', () => {
  assert.deepEqual(
    parseGoogleFontsMetadata({
      familyMetadataList: [
        {
          family: 'Newsreader',
          category: 'Serif',
          fonts: { '400': {}, '700i': {} },
          subsets: ['latin', 'latin-ext'],
          axes: [{ tag: 'wght', min: 200, max: 800, defaultValue: 400 }],
          popularity: 12,
        },
      ],
    }),
    [
      {
        family: 'Newsreader',
        category: 'Serif',
        variants: ['400', '700i'],
        subsets: ['latin', 'latin-ext'],
        axes: [{ tag: 'wght', min: 200, max: 800, defaultValue: 400 }],
        popularity: 12,
      },
    ],
  );
});

test('searches live metadata and falls back without breaking discovery', async () => {
  const live = new GoogleFontsCatalog(async () =>
    Response.json({
      familyMetadataList: [
        { family: 'Inter', fonts: { '400': {} }, popularity: 2 },
        { family: 'Instrument Sans', fonts: { '400': {} }, popularity: 1 },
      ],
    }),
  );
  assert.deepEqual(
    (await live.search('instrument')).fonts.map((font) => font.family),
    ['Instrument Sans'],
  );

  const offline = new GoogleFontsCatalog(async () => {
    throw new Error('offline');
  });
  const result = await offline.search('News');
  assert.equal(result.source, 'fallback');
  assert.equal(result.fonts[0]?.family, 'Newsreader');
});
