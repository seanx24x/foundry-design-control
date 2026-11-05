import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FOUNDRY_SIDEBAR_PAGES, syncFoundrySidebars } from '../public/foundry-pilot-sidebar.js';

const expectedModes = [
  'canvas',
  'components',
  'system',
  'motion',
  'typography',
  'recipes',
  'states',
  'responsive',
  'health',
  'agent',
  'branches',
  'memory',
  'delivery',
  'review',
];

// Only the selector/DOM operations used by the presentation reconciler are
// modeled here. These checks establish node preservation, not browser geometry.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.className = '';
    this.classList = {
      add: (...names) => {
        this.className = [
          ...new Set([...this.className.split(/\s+/).filter(Boolean), ...names]),
        ].join(' ');
      },
      contains: (name) => this.className.split(/\s+/).includes(name),
    };
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  prepend(child) {
    if (child.parentNode) child.remove();
    this.children.unshift(child);
    child.parentNode = this;
  }

  append(child) {
    this.children.push(child);
    child.parentNode = this;
  }

  after(child) {
    if (child.parentNode) child.remove();
    this.parentNode.children.splice(this.parentNode.children.indexOf(this) + 1, 0, child);
    child.parentNode = this.parentNode;
  }

  insertAdjacentHTML(position, html) {
    assert.equal(position, 'beforeend');
    this.iconHTML = html;
  }

  addEventListener(type, handler) {
    this[`on${type}`] = handler;
  }

  remove() {
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  matches(selector) {
    if (selector === 'span') return this.tagName === 'SPAN';
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    const mode = selector.match(/^\[data-mode-surface="(.+)"\]$/);
    return mode ? this.dataset.modeSurface === mode[1] : false;
  }

  querySelectorAll(selector) {
    if (selector === ':scope') return [this];
    if (selector.startsWith(':scope > ')) {
      return this.children.filter((child) => child.matches(selector.slice(9)));
    }
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

const elementFor = (selector) => {
  const element = new Element();
  if (selector.startsWith('.')) element.className = selector.slice(1);
  else if (selector.startsWith('#')) element.id = selector.slice(1);
  return element;
};

function fixture({ omit = [] } = {}) {
  const root = new Element('document');
  root.createElement = (tag) => new Element(tag);
  const records = new Map();
  for (const page of FOUNDRY_SIDEBAR_PAGES) {
    const surface = new Element('section');
    surface.dataset.modeSurface = page.mode;
    root.append(surface);
    const shell = page.shell ? elementFor(page.shell) : surface;
    if (shell !== surface) surface.append(shell);
    if (omit.includes(page.mode)) {
      records.set(page.mode, { surface, shell });
      continue;
    }
    // Delivery's navigation is created by the reconciler; this is its existing
    // independently rendered records subtree and tab navigation.
    const panel = elementFor(page.mode === 'delivery' ? '.delivery-sidebar' : page.panel);
    const control = new Element('input');
    control.value = 'Untouched authored value';
    control.onchange = () => 'existing handler';
    panel.append(control);
    shell.append(panel);
    if (page.mode === 'delivery') {
      const tabs = elementFor('.delivery-tabs');
      shell.append(tabs);
    }
    records.set(page.mode, { surface, shell, panel, control });
  }
  return { root, records };
}

test('shared sidebar registry covers every workspace exactly once', () => {
  assert.equal(typeof syncFoundrySidebars, 'function');
  assert.deepEqual(FOUNDRY_SIDEBAR_PAGES.map(({ mode }) => mode).sort(), [...expectedModes].sort());
  assert.equal(new Set(FOUNDRY_SIDEBAR_PAGES.map(({ mode }) => mode)).size, expectedModes.length);
  for (const page of FOUNDRY_SIDEBAR_PAGES) {
    assert.ok(page.label?.trim(), `${page.mode} has a readable switcher label`);
    assert.ok(page.panel?.trim(), `${page.mode} has an explicit panel selector`);
  }
});

test('sidebar reconciliation is idempotent and retains original controls, handlers and owners', () => {
  const { root, records } = fixture();
  const owners = new Map([...records].map(([mode, { panel }]) => [mode, panel.parentNode]));
  const handlers = new Map([...records].map(([mode, { control }]) => [mode, control.onchange]));
  const tabs = root.querySelector('.delivery-tabs');
  syncFoundrySidebars(root);
  const firstSwitchers = root.querySelectorAll('.foundry-workspace-switcher');
  assert.equal(firstSwitchers.length, expectedModes.length);
  syncFoundrySidebars(root);
  assert.deepEqual(root.querySelectorAll('.foundry-workspace-switcher'), firstSwitchers);
  assert.equal(root.querySelectorAll('.foundry-delivery-navigation').length, 1);
  assert.equal(root.querySelector('.delivery-tabs'), tabs);
  assert.equal(tabs.parentNode, records.get('delivery').shell);

  for (const page of FOUNDRY_SIDEBAR_PAGES) {
    const { panel, control, surface, shell } = records.get(page.mode);
    assert.equal(panel.parentNode, owners.get(page.mode), `${page.mode} retains its render owner`);
    assert.equal(control.parentNode, panel);
    assert.equal(control.value, 'Untouched authored value');
    assert.equal(control.onchange, handlers.get(page.mode));
    assert.equal(panel.classList.contains('foundry-sidebar'), true);
    const switcher = root
      .querySelector(page.panel)
      .querySelector(':scope > .foundry-workspace-switcher');
    assert.equal(switcher.type, 'button');
    assert.equal(switcher.dataset.foundryWorkspace, page.mode);
    assert.equal(switcher.getAttribute('aria-label'), `${page.label}, switch workspace`);
    assert.equal(switcher.getAttribute('aria-controls'), 'studio-navigation');
    assert.equal(switcher.getAttribute('aria-expanded'), 'false');
    if (!['canvas', 'components'].includes(page.mode)) {
      assert.equal(surface.classList.contains('foundry-studio-page'), true);
      assert.equal(shell.classList.contains('foundry-studio-shell'), true);
    }
  }
  assert.equal(records.get('delivery').panel.querySelector('.foundry-workspace-switcher'), null);
});

test('late-created rails and replaced Delivery records are refined without duplicate navigation', () => {
  const { root, records } = fixture({ omit: ['states', 'responsive'] });
  syncFoundrySidebars(root);
  const navigation = root.querySelector('.foundry-delivery-navigation');
  for (const mode of ['states', 'responsive']) {
    const definition = FOUNDRY_SIDEBAR_PAGES.find((page) => page.mode === mode);
    records.get(mode).shell.append(elementFor(definition.panel));
  }
  const previousRecords = records.get('delivery').panel;
  previousRecords.remove();
  const replacementRecords = elementFor('.delivery-sidebar');
  records.get('delivery').shell.append(replacementRecords);
  syncFoundrySidebars(root);
  syncFoundrySidebars(root);
  assert.equal(root.querySelectorAll('.foundry-workspace-switcher').length, expectedModes.length);
  assert.equal(root.querySelector('.foundry-delivery-navigation'), navigation);
  assert.equal(replacementRecords.classList.contains('foundry-sidebar-continuation'), true);
  assert.equal(replacementRecords.querySelector('.foundry-workspace-switcher'), null);
  assert.equal(previousRecords.parentNode, null);
});

test('compact library disclosure retains its owner, native controls and expanded state', () => {
  const { root, records } = fixture();
  syncFoundrySidebars(root);
  const { panel, control } = records.get('motion');
  const toggle = panel.querySelector('.craft-library-toggle');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-controls'), panel.id);
  toggle.onclick();
  assert.equal(panel.dataset.craftLibraryOpen, 'true');
  syncFoundrySidebars(root);
  assert.equal(panel.querySelector('.craft-library-toggle'), toggle);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(control.parentNode, panel);
  assert.equal(control.onchange(), 'existing handler');
  toggle.onclick();
  assert.equal(panel.dataset.craftLibraryOpen, 'false');
});

test('a renderer prepending a heading cannot displace the shared navigation', () => {
  const { root, records } = fixture();
  syncFoundrySidebars(root);
  const panel = records.get('branches').panel;
  const switcher = panel.children[0];
  const heading = new Element('header');
  panel.prepend(heading);
  syncFoundrySidebars(root);
  assert.equal(panel.children[0], switcher);
  assert.equal(panel.children.includes(heading), true);
  assert.equal(panel.querySelectorAll('.foundry-workspace-switcher').length, 1);
});

test('sidebar refinement cannot edit source, input values, preview state or transports', async () => {
  const source = await readFile(
    new URL('../public/foundry-pilot-sidebar.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /\bfetch\s*\(|\bapi\s*\(|requestFrameCommand\s*\(|requestCommand\s*\(|postMessage\s*\(|localStorage|sessionStorage|\.value\s*=|\.checked\s*=|\.src\s*=|\.submit\s*\(|dispatchEvent\s*\(|setInterval\s*\(/,
  );
  assert.doesNotMatch(source, /\.cloneNode\s*\(|\.replaceChildren\s*\(/);
});

test('shared desktop width and compact widths use the same sidebar token', async () => {
  const css = await readFile(new URL('../public/foundry-pilot.css', import.meta.url), 'utf8');
  assert.match(
    css,
    /:root\[data-foundry-pilot\] \.app-shell\[data-next\]\s*\{[^}]*--layers-dock-width:\s*320px;/,
  );
  assert.match(css, /@media \(max-width: 1100px\)\s*\{[^}]*--layers-dock-width:\s*320px;/);
  assert.match(css, /@media \(max-width: 800px\)\s*\{[^}]*--layers-dock-width:\s*176px;/);
  const shared = await readFile(
    new URL('../public/foundry-pilot-sidebar.css', import.meta.url),
    'utf8',
  );
  assert.match(shared, /:root\[data-foundry-pilot\]/);
  assert.match(shared, /var\(--layers-dock-width\)/);
  assert.doesNotMatch(shared, /iframe\s*\{|\[data-inspected-product\]\s*\{/);
});

test('compact Canvas hides Layers with pilot sidebar specificity without changing dock state', async () => {
  const css = await readFile(new URL('../public/foundry-pilot.css', import.meta.url), 'utf8');
  const compact = css.slice(
    css.indexOf('@media (max-width: 1050px)'),
    css.indexOf('@media (max-width: 720px)'),
  );
  assert.match(
    compact,
    /:root\[data-foundry-pilot='canvas'\] \[data-next\] \.layers-dock\s*\{[^}]*display:\s*none;/,
  );
  assert.match(compact, /grid-template-columns:\s*0 0 minmax\(0, 1fr\) var\(--dock\) !important/);
  // CSS visibility must not change the saved dock preference or revive [hidden].
  assert.doesNotMatch(compact, /display:\s*flex|\[hidden\]/);
  const next = await readFile(new URL('../public/next-workspace.css', import.meta.url), 'utf8');
  assert.match(next, /\[data-next\] \[hidden\],[\s\S]*?display:\s*none !important/);
});
