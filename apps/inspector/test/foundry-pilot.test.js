import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import {
  foundryPilotRequested,
  foundryPilotActive,
  mountFoundryPilot,
} from '../public/foundry-pilot.js';
import { foundryFoundationsEnabled } from '../public/foundry-foundations.js';
import { FOUNDRY_SIDEBAR_PAGES } from '../public/foundry-pilot-sidebar.js';

test('foundations default on, retain the pilot alias, and offer an explicit off fallback', () => {
  for (const search of [
    '',
    '?ui=next',
    '?foundations=pilot',
    '?foundations=',
    '?foundations=unknown',
  ])
    assert.equal(foundryFoundationsEnabled(search), true, search || 'no query');
  for (const search of [
    '?foundations=off',
    '?ui=next&foundations=off',
    '?ui=legacy',
    '?ui=legacy&foundations=pilot',
    '?ui=legacy&foundations=off',
  ])
    assert.equal(foundryFoundationsEnabled(search), false, search);
  assert.equal(foundryPilotRequested, foundryFoundationsEnabled, 'one shared policy');
});

test('foundation activation reads the current query and requires an active migrated workspace', () => {
  const previousLocation = globalThis.location;
  const previousDocument = globalThis.document;
  try {
    for (const search of ['', '?ui=next', '?foundations=pilot']) {
      globalThis.location = { search };
      assert.equal(foundryPilotRequested(), true);
    }
    for (const search of ['?foundations=off', '?ui=legacy', '?ui=legacy&foundations=pilot']) {
      globalThis.location = { search };
      assert.equal(foundryPilotRequested(), false);
    }
    globalThis.document = { documentElement: { dataset: {} } };
    assert.equal(foundryPilotActive(), false);
    for (const { mode } of FOUNDRY_SIDEBAR_PAGES) {
      document.documentElement.dataset.foundryPilot = mode;
      assert.equal(foundryPilotActive(), true, mode);
    }
    document.documentElement.dataset.foundryPilot = 'unknown';
    assert.equal(foundryPilotActive(), false);
  } finally {
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('default mount follows migrated modes while fallback and non-Next shells are untouched', () => {
  const previous = {
    location: globalThis.location,
    document: globalThis.document,
    MutationObserver: globalThis.MutationObserver,
  };
  try {
    // This is a controller-only harness: no rendered UI, session or transport.
    for (const options of [
      { search: '', next: 'true', enabled: true },
      { search: '?foundations=pilot', next: 'true', enabled: true },
      { search: '?foundations=off', next: 'true', enabled: false },
      { search: '?ui=legacy&foundations=pilot', next: 'true', enabled: false },
      { search: '', next: 'false', enabled: false },
      { search: '', next: undefined, enabled: false },
    ]) {
      const shell = { dataset: { next: options.next, mode: 'canvas' } };
      let sync;
      const observations = [];
      globalThis.location = { search: options.search };
      globalThis.document = {
        documentElement: { dataset: {} },
        querySelector: (selector) => (selector === '#app-shell' ? shell : null),
        querySelectorAll: () => [],
      };
      globalThis.MutationObserver = class {
        constructor(callback) {
          sync = callback;
        }
        observe(target, config) {
          observations.push({ target, config });
        }
      };
      mountFoundryPilot();
      if (!options.enabled) {
        assert.equal(sync, undefined, JSON.stringify(options));
        assert.deepEqual(document.documentElement.dataset, {});
        assert.deepEqual(observations, []);
        continue;
      }
      assert.equal(observations.length, 1);
      assert.equal(observations[0].target, shell);
      assert.deepEqual(observations[0].config, {
        attributes: true,
        attributeFilter: ['data-mode'],
      });
      assert.equal(document.documentElement.dataset.foundryPilot, 'canvas');
      for (const { mode } of FOUNDRY_SIDEBAR_PAGES) {
        shell.dataset.mode = mode;
        sync();
        assert.equal(document.documentElement.dataset.foundryPilot, mode);
      }
      shell.dataset.mode = 'unknown';
      sync();
      assert.equal(document.documentElement.dataset.foundryPilot, undefined);
      shell.dataset.mode = 'canvas';
      sync();
      assert.equal(document.documentElement.dataset.foundryPilot, 'canvas');
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test('all presentation entry points use the same default and fallback policy', async () => {
  for (const name of [
    'foundry-pilot.js',
    'foundry-pilot-review.js',
    'next-design-system.js',
    'next-motion-studio.js',
    'next-typography-studio.js',
    'next-recipes.js',
    'next-state-workbench.js',
    'next-responsive-lab.js',
    'next-stress-lab.js',
    'next-visual-agent.js',
    'next-design-branches.js',
    'next-design-memory.js',
    'next-delivery.js',
  ]) {
    const source = await readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');
    assert.match(
      source,
      /import \{ foundryFoundationsEnabled \} from '\.\/foundry-foundations\.js'/,
      name,
    );
    assert.match(source, /foundryFoundationsEnabled(?:\(\)|;)/, name);
  }
  for (const name of await readdir(new URL('../public/', import.meta.url))) {
    if (!name.endsWith('.js') || name === 'foundry-foundations.js') continue;
    const source = await readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\.get\(['"]foundations['"]\)/, name);
  }
});
test('pilot integration is scoped, reversible and preserves the current input implementations', async () => {
  const source = await readFile(new URL('../public/foundry-pilot.js', import.meta.url), 'utf8');
  assert.match(source, /shell\?\.dataset\.next !== 'true'/);
  assert.match(source, /new Set\(FOUNDRY_SIDEBAR_PAGES.map/);
  assert.match(source, /pilotModes\.has\(shell\.dataset\.mode\)/);
  assert.match(source, /delete document\.documentElement\.dataset\.foundryPilot/);
  assert.match(source, /attributeFilter:\s*\['data-mode'\]/);
  assert.doesNotMatch(
    source,
    /fetch\(|localStorage|requestCommand|inspector-edit|apply\/|setInterval/,
  );
  const css = await readFile(new URL('../public/foundry-pilot.css', import.meta.url), 'utf8');
  assert.match(css, /\.next-field\s*\{/);
  assert.match(css, /\.next-field:has\(\[aria-invalid='true'\]\)/);
  assert.match(css, /\.next-color-values input\[aria-invalid='true'\]/);
  assert.match(css, /\.foundry-workspace-switcher\s*\{\s*display: none;\s*\}/);
  assert.match(css, /:root\[data-foundry-pilot\]\[data-theme\]/);
  assert.match(
    css,
    /:root\[data-foundry-pilot\] \.app-shell\[data-next\]\s*\{\s*--layers-dock-width: 320px;/,
  );
  assert.match(css, /@media \(max-width: 1100px\)\s*\{[^}]*--layers-dock-width: 320px;/);
  const workspace = await readFile(new URL('../public/next-workspace.js', import.meta.url), 'utf8');
  assert.match(workspace, /if \(sidebarTriggers\(\)\.includes\(toolsTrigger\)\)/);
  assert.match(workspace, /shell\.dataset\.mode !== toolsTrigger\.dataset\.foundryWorkspace/);
  assert.match(workspace, /\(triggerVisible \? toolsTrigger : tabTools\)\.focus/);
});

test('Workshop extends the pilot without replacing gallery or input ownership', async () => {
  const css = await readFile(
    new URL('../public/foundry-pilot-workshop.css', import.meta.url),
    'utf8',
  );
  const core = await readFile(new URL('../public/foundry-pilot.css', import.meta.url), 'utf8');
  const workspace = await readFile(new URL('../public/next-workspace.js', import.meta.url), 'utf8');
  const icons = await readFile(
    new URL('../public/foundry-pilot-icons.js', import.meta.url),
    'utf8',
  );
  assert.match(css, /data-foundry-pilot='components'/);
  assert.match(css, /grid-template-columns: var\(--layers-dock-width\) minmax\(0, 1fr\) 300px/);
  assert.doesNotMatch(css, /\.next-specimen-stage\s*\{|iframe\s*\{/);
  assert.match(core, /data-foundry-pilot='canvas'\] \[data-next\] \.workspace/);
  assert.match(workspace, /if \(foundryPilotRequested\(\)\) syncFoundrySidebars\(document\)/);
  assert.match(icons, /:not\(\[data-mode-surface="components"\]\)/);
  assert.match(css, /\.next-specimen-select, \.workshop-component-row/);
  assert.match(css, /\.search-field\s+input:focus-visible/);
});

test('pilot fills the browser and corner cut-outs expose the shell instead of a backing rectangle', async () => {
  const core = await readFile(new URL('../public/foundry-pilot.css', import.meta.url), 'utf8');
  const workshop = await readFile(
    new URL('../public/foundry-pilot-workshop.css', import.meta.url),
    'utf8',
  );
  assert.match(
    core,
    /height: 100dvh;\s+width: 100%;\s+margin: 0;\s+padding: 0;\s+border-radius: 0;/,
  );
  assert.doesNotMatch(core, /padding: [46]px;|margin: 8px;|calc\(100dvh - 16px\)/);
  assert.match(core, /\[data-next\] \.workspace\s*\{\s*\/\*[^]*?\*\/\s*background: transparent;/);
  assert.match(core, /border-radius: 0 0 12px 12px;/);
  assert.match(
    workshop,
    /\.center-workspace\s*\{\s*border-radius: 0;\s*background: var\(--fd-shell-background\);/,
  );
  assert.match(workshop, /\.component-workshop-footer\s*\{[^}]*border-radius: 0 0 12px 12px;/);
  assert.match(
    workshop,
    /\.component-workshop-mode:not\(\[hidden\]\)\s*\{\s*display: flex;[^}]*background: var\(--fd-shell-background\);\s*border-radius: 0 0 12px 12px;/,
  );
});
