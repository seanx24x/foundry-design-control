import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import test from 'node:test';
import { GENERAL_ICONS, PROPERTY_ICONS, LEGACY_ROLES } from '../public/foundry-pilot-icon-data.js';
import { PROPERTY_ICONS as approvedProperties } from '../public/assets/foundry-pilot/approved-property-icons.mjs';
import {
  foundryPilotIcon,
  foundryPilotPropertyIcon,
  resolveFoundryPilotRole,
} from '../public/foundry-pilot-icons.js';

const publicRoot = new URL('../public/', import.meta.url);
const read = (path) => readFile(new URL(path, publicRoot));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('pilot reuses approved Lucide paths and records every legacy role, including label-only Blur', async () => {
  const approved = JSON.parse(await read('assets/foundry-pilot/approved-icon-map.json'));
  assert.deepEqual(LEGACY_ROLES, approved.legacyRoles);
  assert.equal(LEGACY_ROLES.length, 38);
  assert.equal(Object.keys(GENERAL_ICONS).length, 69);
  for (const [role, entry] of Object.entries(approved.general)) {
    if (!entry.svgMarkup) {
      assert.equal(foundryPilotIcon(role), null);
      continue;
    }
    const source = String(await read(`assets/foundry-pilot/lucide/${entry.name}.svg`));
    const body = source.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)[1].trim();
    assert.equal(GENERAL_ICONS[role].body, body, `${role} retains original paths`);
    const markup = foundryPilotIcon(role);
    assert.ok(markup.includes(body));
    assert.match(markup, /width="16" height="16" viewBox="0 0 24 24"/);
    assert.match(markup, /data-icon-family="lucide"/);
    assert.match(markup, /aria-hidden="true" focusable="false"/);
    assert.doesNotMatch(markup, /<script|\bon\w+=|href=|url\(/i);
  }
  assert.equal(foundryPilotIcon('not-a-role'), null);
  assert.equal(foundryPilotIcon('activity', { brand: true }), null);
});

test('all 28 property diagrams exactly preserve approved geometry and opacity paint', () => {
  assert.equal(Object.keys(PROPERTY_ICONS).length, 28);
  for (const [role, entry] of Object.entries(approvedProperties)) {
    assert.equal(PROPERTY_ICONS[role].body, entry.body, role);
    assert.equal(PROPERTY_ICONS[role].viewBox, entry.viewBox, role);
    assert.ok(foundryPilotPropertyIcon(role).includes(entry.body));
    assert.match(foundryPilotPropertyIcon(role), /data-icon-family="foundry"/);
  }
  assert.match(foundryPilotPropertyIcon('opacity'), /fill="currentColor" stroke="none"/);
  assert.equal(foundryPilotPropertyIcon('unsupported'), null);
});

test('contextual resolution distinguishes product meaning rather than replacing generic names globally', () => {
  for (const [name, context, expected] of [
    ['box', { layer: true }, 'element'],
    ['box', { canvasTab: true }, 'canvas'],
    ['box', { contextSelect: 'canvas-viewport' }, 'viewport'],
    ['interact', { contextSelect: 'canvas-state' }, 'stateWorkbench'],
    ['contrast', { compare: true }, 'compare'],
    ['contrast', { contextSelect: 'canvas-theme' }, 'theme'],
    ['interact', { canvasMode: 'interact' }, 'play'],
    ['cursor', { canvasMode: 'select' }, 'cursor'],
    ['panelLeft', { dock: 'layers', dockVisible: true }, 'panelLeftClose'],
    ['panelLeft', { dock: 'layers', dockVisible: false }, 'panelLeftOpen'],
    ['panel', { dock: 'inspector', dockVisible: false }, 'panelRightOpen'],
    ['command', { findCommand: true }, 'search'],
    ['command', { connection: true }, 'connection'],
    ['external', { focus: true }, 'focus'],
    ['box', { labelOnly: true }, 'blur'],
    ['sparkles', { destination: 'system' }, 'designSystem'],
    ['activity', { destination: 'health' }, 'contentStress'],
    ['chevronDown', { destination: 'canvas' }, 'chevronDown'],
  ])
    assert.equal(resolveFoundryPilotRole(name, context), expected);
});

test('vendored Lucide and Geist hashes and complete license notices are retained', async () => {
  const checksums = JSON.parse(await read('assets/foundry-pilot/lucide/source-checksums.json'));
  for (const entry of checksums.files)
    assert.equal(
      sha(await read(`assets/foundry-pilot/lucide/${basename(entry.file)}`)),
      entry.sha256,
    );
  const provenance = JSON.parse(await read('fonts/geist-source.json'));
  const font = await read('fonts/geist-sans.woff2');
  assert.equal(font.subarray(0, 4).toString(), 'wOF2');
  assert.equal(sha(font), provenance.sha256);
  assert.equal(sha(await read('fonts/geist-OFL.txt')), provenance.license.sha256);
  assert.match(String(await read('fonts/geist-OFL.txt')), /SIL OPEN FONT LICENSE/);
  const license = String(await read('assets/foundry-pilot/lucide/LICENSE'));
  assert.match(license, /ISC License/);
  assert.match(license, /MIT License|The MIT License/);
  assert.match(
    String(await read('assets/foundry-pilot/foundry-LICENSE.txt')),
    /Copyright \(c\) 2026 Sean Lynch/,
  );
  assert.doesNotMatch(
    String(await read('foundry-pilot-icons.js')),
    /\bfetch\s*\(|MutationObserver|setInterval/,
  );
  assert.doesNotMatch(String(await read('foundry-pilot-fonts.css')), /https?:|local\(/);
});
