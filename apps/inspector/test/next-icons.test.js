import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  NEXT_ICONS,
  NEXT_ICON_SCOPE,
  NEXT_TOOL_ICONS,
  NEXT_PROPERTY_ICONS,
  inspectorPropertyIcon,
  refineNextIcons,
} from '../public/next-icons.js';

test('inspector font and opacity symbols are distinct, native 16px and decorative', () => {
  assert.equal(
    new Set(['fontFamily', 'fontSize', 'opacity'].map((key) => NEXT_PROPERTY_ICONS[key])).size,
    3,
  );
  for (const property of ['fontFamily', 'fontSize', 'opacity']) {
    const svg = inspectorPropertyIcon(property);
    assert.match(svg, /viewBox="0 0 16 16"/);
    assert.match(svg, /data-icon-family="foundry"/);
    assert.match(svg, /aria-hidden="true" focusable="false"/);
    assert.match(svg, /stroke="currentColor" stroke-width="1.25"/);
    assert.doesNotMatch(svg, /<text|non-scaling-stroke/);
    assert.ok(svg.includes(NEXT_PROPERTY_ICONS[property]));
  }
  assert.equal(inspectorPropertyIcon('unsupportedProperty'), null);
  assert.equal(inspectorPropertyIcon('toString'), null);
});

test('each scrubbable Next property has an explicit field icon, never a category fallback', () => {
  const adapter = readFileSync(
    new URL('../../../packages/web-adapter/src/index.ts', import.meta.url),
    'utf8',
  );
  const next = readFileSync(
    new URL('../../../packages/web-adapter/src/next-inspector.ts', import.meta.url),
    'utf8',
  );
  const allowed = new Set([...next.matchAll(/^  '([^']+)',/gm)].map((match) => match[1]));
  const properties = [
    ...adapter.matchAll(/(?:pxControl|numberStyleControl)\(element, computed, '[^']+', '([^']+)'/g),
  ]
    .map((match) => match[1])
    .filter((property) => allowed.has(property));
  assert.ok(properties.length >= 20);
  for (const property of [
    ...properties,
    'paddingHorizontal',
    'paddingVertical',
    'paddingLinked',
    'radiusLinked',
  ]) {
    assert.ok(NEXT_PROPERTY_ICONS[property], `Missing field icon: ${property}`);
    assert.match(inspectorPropertyIcon(property), /viewBox="0 0 16 16"/);
  }
  const source = readFileSync(new URL('../public/next-workspace.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /icon\(control\.category/);
});

test('spacing sides, inside/outside, axes and corners retain distinct geometry', () => {
  const keys = [
    'left',
    'top',
    'width',
    'height',
    'gap',
    'rowGap',
    'columnGap',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'paddingHorizontal',
    'paddingVertical',
    'paddingLinked',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'borderWidth',
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomRightRadius',
    'borderBottomLeftRadius',
    'radiusLinked',
  ];
  assert.equal(new Set(keys.map((key) => NEXT_PROPERTY_ICONS[key])).size, keys.length);
  for (const property of keys) {
    const svg = inspectorPropertyIcon(property);
    assert.match(svg, /aria-hidden="true" focusable="false"/);
    assert.doesNotMatch(svg, /<text|non-scaling-stroke|#[0-9a-f]{3}/i);
  }
});

test('pending changes uses the comparison glyph, not the theme sun', () => {
  const node = {
    dataset: { foundryIcon: 'contrast' },
    closest: (selector) => (selector === NEXT_ICON_SCOPE || selector === '#compare' ? {} : null),
    setAttribute() {},
    innerHTML: '',
  };
  refineNextIcons({ querySelectorAll: () => [node] });
  assert.equal(node.innerHTML, NEXT_ICONS.compare.body);
  assert.equal(node.dataset.iconFamily, 'heroicons');
  assert.ok(NEXT_ICON_SCOPE.includes('#change-summary'));
});

test('canvas tools use an original plain pointer and Heroicons Play without changing State', () => {
  assert.equal(NEXT_TOOL_ICONS.interact, NEXT_ICONS.play);
  assert.notEqual(NEXT_TOOL_ICONS.interact, NEXT_ICONS.interact);
  assert.notEqual(NEXT_TOOL_ICONS.select, NEXT_ICONS.cursor);
  assert.equal(NEXT_TOOL_ICONS.select.width, 24);
  assert.equal(NEXT_TOOL_ICONS.select.height, 24);
  assert.match(NEXT_TOOL_ICONS.select.body, /stroke-width="1.5"/);
  assert.equal((NEXT_TOOL_ICONS.select.body.match(/<path/g) ?? []).length, 1);
});

test('Heroicons trial covers every semantic icon without replacing the legacy registry', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const registry = app.match(/const ICONS = \{([\s\S]*?)\n\};/)[1];
  for (const [, key] of registry.matchAll(/\s+(\w+):/g)) {
    assert.ok(NEXT_ICONS[key]?.body, `Missing Heroicon mapping: ${key}`);
  }
  assert.match(app, /if \(params.get\('ui'\) === 'next'\) refineNextIcons\(root\)/);
  assert.ok(NEXT_ICON_SCOPE.includes('.canvas-toolbar'));
  assert.ok(NEXT_ICON_SCOPE.includes('#inspector-dock'));
  assert.ok(NEXT_ICON_SCOPE.includes('.next-font-picker'));
});

test('small utility icons use native 16px filled geometry, concepts retain outline geometry', () => {
  for (const key of ['plus', 'minus', 'close', 'check', 'chevronDown', 'chevronRight', 'menu']) {
    assert.equal(NEXT_ICONS[key].width, 16);
    assert.match(NEXT_ICONS[key].body, /fill="currentColor"/);
    assert.doesNotMatch(NEXT_ICONS[key].body, /non-scaling-stroke/);
  }
  for (const key of ['box', 'component', 'file', 'command', 'search', 'contrast', 'interact']) {
    assert.equal(NEXT_ICONS[key].width, 24);
    assert.match(NEXT_ICONS[key].body, /stroke-width="1.5"/);
  }
});
