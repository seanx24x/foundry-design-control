import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  NEXT_ICONS,
  NEXT_ICON_SCOPE,
  NEXT_TOOL_ICONS,
  refineNextIcons,
} from '../public/next-icons.js';

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
