import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  typographyScaleDraft,
  typographyControlError,
  typographyControlUnit,
} from '../public/typography-studio-controls.js';
test('draft scale mirrors the native four-pixel modular grid', () => {
  assert.deepEqual(
    [-1, 0, 1, 2, 3].map((step) => typographyScaleDraft({ base: 16, ratio: 1.25, step })),
    ['12px', '16px', '20px', '24px', '32px'],
  );
  assert.equal(typographyScaleDraft({ base: 16.5, ratio: 1.333, step: 2 }), '28px');
});
test('fluid draft uses the native viewport range and three-decimal clamp expression', () => {
  assert.equal(
    typographyScaleDraft({ base: 16, ratio: 1.25, step: 1, fluid: true }),
    'clamp(16px, calc(14.857px + 0.357vw), 20px)',
  );
});
test('invalid scale drafts never become a zero or a fabricated size', () => {
  for (const base of ['', ' ', null, undefined, NaN, Infinity, 7, 129])
    assert.equal(typographyScaleDraft({ base, ratio: 1.25, step: 1 }), null);
  assert.equal(typographyScaleDraft({ base: 16, ratio: 0, step: 1 }), null);
  assert.equal(typographyScaleDraft({ base: 16, ratio: 1.25, step: NaN }), null);
});
test('numerical native fields retain unit semantics and reject empty/out-of-range drafts', () => {
  const control = { property: 'fontSize', kind: 'number', unit: 'px', min: 0 };
  const seen = [];
  assert.equal(
    typographyControlError(control, '12.625', (...args) => {
      seen.push(args);
      return true;
    }),
    '',
  );
  assert.deepEqual(seen, [['font-size', '12.625px']]);
  for (const value of ['', ' ', 'bad', '-1']) assert.ok(typographyControlError(control, value));
});
test('advanced CSS is validated without rewriting axes, keywords or family stacks', () => {
  const value = '"wght" 512.5, "wdth" 87';
  let received;
  assert.equal(
    typographyControlError(
      { property: 'fontVariationSettings', kind: 'text' },
      value,
      (...args) => {
        received = args;
        return true;
      },
    ),
    '',
  );
  assert.deepEqual(received, ['font-variation-settings', value]);
  assert.equal(typographyControlError({ property: 'lineHeight', kind: 'text' }, 'normal'), '');
  assert.ok(
    typographyControlError({ property: 'fontVariationSettings', kind: 'text' }, 'bad', () => false),
  );
});
test('units are shown only when native numeric controls supply them', () => {
  assert.equal(typographyControlUnit({ kind: 'number', unit: 'px' }), 'px');
  assert.equal(typographyControlUnit({ kind: 'text', unit: 'px' }), '');
  assert.equal(typographyControlUnit({ kind: 'number' }), '');
});
test('scale choices remain local until the existing native Preview action', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(source, /data-type-scale-draft/);
  assert.match(source, /typographyScaleDraft\(typographyScale\)/);
  assert.match(source, /action: 'preview-scale'/);
  assert.match(source, /if \(result.recorded\)/);
  assert.match(source, /bridgeState\?\.selection\?\.id !== selection.id/);
});
test('font settings preserve native fields and do not invent indexed axis ranges', () => {
  const source = readFileSync(
    new URL('../public/next-typography-studio.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /Advanced font settings/);
  assert.match(source, /Per-axis ranges are not indexed here/);
  assert.match(source, /#typography-scale-base, \[data-scale-base-entry\]/);
  assert.match(source, /advanced.append\(field.closest\('label'\)\)/);
});
