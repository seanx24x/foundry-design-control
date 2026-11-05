import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  systemSampleCanRender,
  systemCategoryRole,
  promotionImpactText,
} from '../public/foundry-pilot-system.js';
import { GENERAL_ICONS, PROPERTY_ICONS } from '../public/foundry-pilot-icon-data.js';

test('system samples allow literal color and absolute geometry without project mutation', () => {
  for (const [category, value] of [
    ['color', '#3157ff'],
    ['color', 'rgb(36 90 78 / 0.18)'],
    ['color', 'rgb(36 92 78 / 18%)'],
    ['color', 'hsl(215 100% 60%)'],
    ['color', 'transparent'],
    ['spacing', '12px'],
    ['spacing', '0'],
    ['radius', '8px'],
    ['radius', '0'],
    ['shadow', '0 4px 16px rgba(0, 0, 0, 0.12)'],
    ['shadow', 'inset -2px 0 4px #000'],
  ]) {
    assert.equal(systemSampleCanRender(category, value), true, `${category}: ${value}`);
  }
});

test('context-dependent source values remain literal rather than resolving inside Foundry', () => {
  for (const category of ['color', 'spacing', 'radius', 'shadow']) {
    for (const value of [
      'var(--project-token)',
      'env(safe-area-inset-top)',
      'attr(data-value)',
      'url(https://example.invalid/image.svg)',
      'currentColor',
      'CURRENTCOLOR',
      'inherit',
      'initial',
      'unset',
      'revert',
      'revert-layer',
    ]) {
      assert.equal(systemSampleCanRender(category, value), false, `${category}: ${value}`);
    }
  }
  assert.equal(systemSampleCanRender('shadow', '0 4px 12px currentColor'), false);
  assert.equal(systemSampleCanRender('shadow', '0 4px 12px var(--shadow-color)'), false);
});

test('relative lengths do not imply a project-accurate spacing or shape specimen', () => {
  for (const category of ['spacing', 'radius']) {
    for (const value of [
      '1em',
      '1rem',
      '2ch',
      '2ex',
      '1lh',
      '1rlh',
      '50%',
      '10vw',
      '10vh',
      '10dvh',
      '10cqw',
    ]) {
      assert.equal(systemSampleCanRender(category, value), false, `${category}: ${value}`);
    }
  }
  for (const value of ['0 1em 2em #000', '0 2px 1rem black', '0 2vh 4px #000']) {
    assert.equal(systemSampleCanRender('shadow', value), false, value);
  }
});

test('token category roles use existing approved artwork and keep shadows label-only', () => {
  const expected = {
    color: 'designSystem',
    spacing: 'gap',
    size: 'frame',
    radius: 'borderRadius',
    shadow: null,
    typography: 'typography',
    motion: 'motion',
    other: 'layers',
  };
  for (const [category, role] of Object.entries(expected)) {
    assert.equal(systemCategoryRole(category), role, category);
    if (role !== null) {
      assert.ok(GENERAL_ICONS[role] || PROPERTY_ICONS[role], `${category} has approved artwork`);
    }
  }
  assert.equal(systemCategoryRole('future-category'), 'layers');
  assert.equal(systemCategoryRole(undefined), 'layers');
});

test('promotion impact reports authored locations and distinct files, not completed verification', () => {
  const candidate = Object.freeze({
    occurrenceCount: 5,
    sources: Object.freeze([
      Object.freeze({ file: 'src/styles.css', line: 12 }),
      Object.freeze({ file: 'src/styles.css', line: 19 }),
      Object.freeze({ file: 'src/components/button.css', line: 3 }),
    ]),
  });
  const description = promotionImpactText(candidate);
  assert.match(description, /5 authored locations across 2 files/);
  assert.doesNotMatch(description, /(?:the plan )?preserves the current rendered value/i);
  assert.doesNotMatch(description, /(?:is|was|has been) (?:verified|applied|rebuilt)/i);
  assert.equal(promotionImpactText(candidate), description, 'reporting is deterministic');
  const singular = promotionImpactText({
    occurrenceCount: 1,
    sources: [{ file: 'src/theme.css' }],
  });
  assert.match(singular, /1 authored location\b.*1 file\b/);
  assert.doesNotMatch(singular, /1 files\b/);
});

test('the system presentation adapter is local and cannot stage, apply or persist source edits', async () => {
  const source = await readFile(
    new URL('../public/foundry-pilot-system.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\brequestCommand\s*\(|\brunDurableAction\s*\(|\blocalStorage\b|\bsessionStorage\b|\bsetInterval\s*\(/,
  );
  assert.doesNotMatch(source, /from\s+['"](?:node:)?(?:fs|child_process)/);
  assert.doesNotMatch(source, /\.click\s*\(|\.dispatchEvent\s*\(/);
});

test('Design System interior refinement is explicitly gated and preserves original action cards', async () => {
  const source = await readFile(
    new URL('../public/next-design-system.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /const pilot = foundryFoundationsEnabled\(\)/);
  assert.match(source, /if \(pilot\)\s+refinePilotSystem\(root,/);
  assert.match(source, /!pilot \|\| systemSampleCanRender\(model\.category, model\.value\)/);
  assert.match(source, /pilot\s+\? promotionImpactText\(candidate\)/);
  assert.match(source, /content\.append\(card\)/);
  assert.match(source, /scrollTop = saved\?\.main/);
  assert.match(source, /disclosure\.open = saved\?\.open\.includes/);
  assert.doesNotMatch(source, /\bfetch\s*\(|\brequestCommand\s*\(|\brunDurableAction\s*\(/);
});

test('collapsed alias disclosures retain status before the original card header is removed', async () => {
  const source = await readFile(
    new URL('../public/next-design-system.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /const status = card\.querySelector\('\.alias-health'\)/);
  const preserve = source.indexOf('summary.append(status)');
  const remove = source.indexOf("card.querySelector('header')?.remove()");
  assert.ok(
    preserve >= 0 && remove > preserve,
    'status node moves before its former owner is removed',
  );
});
