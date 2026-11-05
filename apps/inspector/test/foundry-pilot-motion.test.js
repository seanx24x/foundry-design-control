import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { motionPresentation, refinePilotMotion } from '../public/foundry-pilot-motion.js';
import { motionAvailability } from '../public/next-motion-studio.js';

const publicFile = (name) => readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');

// A deliberately small presentation fixture: unexpected control manipulation
// fails because no event, playback, mutation or cloning APIs are supplied.
function node(text = '') {
  return {
    textContent: text,
    className: '',
    dataset: {},
    attributes: {},
    children: [],
    selectors: new Map(),
    removed: false,
    querySelector(selector) {
      return this.selectors.get(selector) ?? null;
    },
    append(...children) {
      this.children.push(...children);
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    remove() {
      this.removed = true;
    },
  };
}

function fixture({ empty = false, description = true, curve = true, comparison = true } = {}) {
  const root = node();
  const classes = new Set();
  root.classList = { add: (value) => classes.add(value) };
  root.ownerDocument = { createElement: (tag) => Object.assign(node(), { tagName: tag }) };
  const stage = node();
  const status = node();
  root.selectors.set('#motion-studio-stage', stage);
  stage.selectors.set('.next-motion-heading > span', status);
  const emptyState = node();
  const emptyDescription = node('Old description');
  const notice = node();
  if (empty) {
    stage.selectors.set('.next-motion-content > .motion-studio-empty', emptyState);
    stage.selectors.set('.next-motion-notice', notice);
    if (description) emptyState.selectors.set('p', emptyDescription);
  }
  const curveEditor = node();
  const curveTitle = node('Timing curve');
  const curveSource = node('Authored easing');
  const diagnostics = node();
  const presets = node();
  curveEditor.selectors.set('header strong', curveTitle);
  curveEditor.selectors.set('.motion-curve-source > span', curveSource);
  curveEditor.selectors.set('.motion-curve-diagnostics', diagnostics);
  curveEditor.selectors.set('.motion-curve-presets', presets);
  if (curve) root.selectors.set('.motion-curve-editor', curveEditor);
  const comparisonPanel = node();
  const comparisonHeading = node();
  comparisonPanel.selectors.set('header > span', comparisonHeading);
  if (comparison) root.selectors.set('.motion-comparison', comparisonPanel);
  const disclosure = node('Source details');
  const decoratedDisclosure = node('Motion path unavailable');
  const originalIcon = node();
  decoratedDisclosure.selectors.set('[data-foundry-icon]', originalIcon);
  decoratedDisclosure.children.push(originalIcon);
  root.querySelectorAll = (selector) => {
    assert.equal(selector, '.next-motion-disclosure > summary');
    return [disclosure, decoratedDisclosure];
  };
  return {
    root,
    classes,
    stage,
    status,
    emptyState,
    emptyDescription,
    notice,
    curveEditor,
    curveTitle,
    curveSource,
    diagnostics,
    presets,
    comparisonPanel,
    comparisonHeading,
    disclosure,
    decoratedDisclosure,
    originalIcon,
  };
}

test('motion presentation status follows actual availability and playback state', () => {
  const selection = { id: 'moving-layer' };
  const cases = [
    [null, null, true, 'No selection', 'unavailable'],
    [selection, null, true, 'No motion', 'unavailable'],
    [selection, { active: true, playState: 'running' }, false, 'Preview offline', 'unavailable'],
    [selection, { active: false, playState: 'running' }, true, 'Not active', 'unavailable'],
    [selection, { active: true, playState: 'running' }, true, 'Live motion', 'live'],
    [selection, { active: true, playState: 'paused' }, true, 'Paused', 'idle'],
    [selection, { active: true, playState: 'finished' }, true, 'Finished', 'idle'],
  ];
  for (const [selected, motion, connected, label, state] of cases) {
    const availability = Object.freeze(motionAvailability(selected, motion, connected));
    if (motion) Object.freeze(motion);
    const model = motionPresentation(motion, availability);
    assert.equal(model.status, label);
    assert.equal(model.state, state);
    assert.deepEqual(motionPresentation(motion, availability), model);
  }
});

test('motion evidence labels distinguish local diagrams from rendered product evidence', () => {
  const model = motionPresentation(null, { editable: false, label: 'No motion' });
  assert.equal(model.comparisonNote, 'Path diagrams, not rendered product previews.');
  assert.equal(model.easingNote, 'Local illustration · preview the product on Canvas.');
  assert.doesNotMatch(JSON.stringify(model), /verified|source applied|accessibility passed/i);
});

test('pilot refinement makes provenance visible while preserving original section nodes', () => {
  const f = fixture();
  const motion = Object.freeze({ active: true, playState: 'running' });
  const availability = Object.freeze({
    editable: true,
    label: 'Live motion',
    reason: 'Temporary playback.',
  });
  refinePilotMotion(f.root, { motion, availability });
  assert.ok(f.classes.has('foundry-motion-interior'));
  assert.equal(f.status.dataset.motionStatus, 'live');
  assert.equal(f.status.textContent, 'Live motion');
  assert.equal(f.root.querySelector('.motion-curve-editor'), f.curveEditor);
  assert.equal(f.root.querySelector('.motion-comparison'), f.comparisonPanel);
  assert.equal(f.curveTitle.textContent, 'Easing');
  assert.equal(f.curveSource.textContent, 'Current easing');
  assert.equal(f.presets.attributes.role, 'group');
  assert.equal(f.diagnostics.children[0].tagName, 'p');
  assert.match(f.diagnostics.children[0].textContent, /Local illustration/);
  assert.match(f.comparisonHeading.children[0].textContent, /not rendered product previews/);
  assert.equal(f.disclosure.textContent, 'Source details');
  assert.equal(f.disclosure.children[0].dataset.icon, 'chevronDown');
  assert.deepEqual(f.decoratedDisclosure.children, [f.originalIcon]);
});

test('empty motion states explain availability once without fabricating editors or comparisons', () => {
  for (const description of [true, false]) {
    const f = fixture({ empty: true, description, curve: false, comparison: false });
    const availability = {
      editable: false,
      label: 'No selection',
      reason: 'Choose a layer on Canvas.',
    };
    refinePilotMotion(f.root, { motion: null, availability });
    assert.equal(f.status.dataset.motionStatus, 'unavailable');
    assert.equal(f.emptyState.attributes.role, 'status');
    assert.equal(f.notice.removed, true);
    assert.equal(
      description ? f.emptyDescription.textContent : f.emptyState.children[0].textContent,
      availability.reason,
    );
    assert.equal(f.root.querySelector('.motion-curve-editor'), null);
    assert.equal(f.root.querySelector('.motion-comparison'), null);
  }
});

test('motion adapter cannot stage source edits, drive playback or replace bound controls', async () => {
  const source = await publicFile('foundry-pilot-motion.js');
  assert.doesNotMatch(
    source,
    /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\brequestCommand\s*\(|\brunDurableAction\s*\(|\blocalStorage\b|\bsessionStorage\b|\bsetInterval\s*\(/,
  );
  assert.doesNotMatch(source, /from\s+['"](?:node:)?(?:fs|child_process)/);
  assert.doesNotMatch(source, /\.click\s*\(|\.dispatchEvent\s*\(|\.addEventListener\s*\(/);
  assert.doesNotMatch(source, /innerHTML|outerHTML|replaceChildren|cloneNode|insertAdjacentHTML/);
  assert.doesNotMatch(source, /\.disabled\s*=|\.value\s*=/);
  assert.doesNotMatch(source, /(?:createElement|make)\(\s*['"]output['"]|<output\b/);
});

test('Motion pilot is gated and runs after existing availability and local-preview guards', async () => {
  const source = await publicFile('next-motion-studio.js');
  assert.match(source, /import \{ refinePilotMotion \} from '\.\/foundry-pilot-motion\.js'/);
  assert.match(source, /const pilot = foundryFoundationsEnabled\(\)/);
  const hook = source.indexOf('if (pilot) refinePilotMotion(root, { motion, availability })');
  assert.ok(hook > source.indexOf('field.disabled = true'));
  assert.ok(hook > source.indexOf("handle.setAttribute('aria-disabled'"));
  assert.ok(hook > source.indexOf('previewCurve.disabled = !motion?.curve?.points?.length'));
  assert.ok(hook < source.indexOf('scroll.scrollTop = saved?.main'));
  for (const name of ['canvas', 'curve', 'path', 'comparison']) {
    assert.match(source, new RegExp(`content\\.append\\(${name}\\)`));
  }
  assert.match(source, /addEventListener\('pointerdown', blockUnavailable, true\)/);
  assert.match(source, /addEventListener\('keydown', blockUnavailable, true\)/);
});

test('pilot stylesheet is explicitly imported and scoped to Motion interiors', async () => {
  const [stylesheet, importer] = await Promise.all([
    publicFile('foundry-pilot-motion.css'),
    publicFile('foundry-pilot.css'),
  ]);
  assert.match(importer, /@import url\('\.\/foundry-pilot-motion\.css'\)/);
  const rules = stylesheet.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g);
  let selectorCount = 0;
  for (const [, selector] of rules) {
    if (selector.trim().startsWith('@')) continue;
    assert.match(selector, /:root\[data-foundry-pilot='motion'\]/, selector.trim());
    assert.match(selector, /foundry-motion-interior/, selector.trim());
    selectorCount++;
  }
  assert.ok(selectorCount > 0, 'the pilot has scoped presentation rules');
  assert.doesNotMatch(stylesheet, /\.app-shell|\.app-bar|\.next-tabs|\.layers-panel/);
});

test('narrow Motion interiors use two-column curve fields rather than four cramped columns', async () => {
  const stylesheet = await publicFile('foundry-pilot-motion.css');
  assert.match(stylesheet, /container-name:\s*motion-detail/);
  const start = stylesheet.search(/@container motion-detail\s*\(max-width:\s*620px\)/);
  assert.ok(start >= 0, 'Motion responds to its center-panel width, not only viewport width');
  const narrow = stylesheet.slice(start);
  assert.match(
    narrow,
    /\.motion-curve-fields\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.doesNotMatch(narrow, /grid-template-columns:\s*repeat\(4,/);
});

test('editable SVGs retain native viewBox proportions required by pointer-coordinate mapping', async () => {
  const [stylesheet, baseStylesheet, app, adapter] = await Promise.all([
    publicFile('foundry-pilot-motion.css'),
    publicFile('next-motion-studio.css'),
    publicFile('app.js'),
    publicFile('foundry-pilot-motion.js'),
  ]);
  for (const [graph, width, height] of [
    ['motion-curve-graph', 240, 156],
    ['motion-path-graph', 480, 260],
  ]) {
    const editableRules = [
      ...stylesheet.matchAll(new RegExp(`\\.${graph}\\s+svg\\s*\\{([^}]+)\\}`, 'g')),
    ];
    assert.ok(editableRules.length, `${graph} has explicit pilot sizing`);
    for (const [, declarations] of editableRules) {
      assert.match(declarations, /height:\s*auto/, graph);
      assert.doesNotMatch(declarations, /(?:^|;)\s*(?:min-|max-)?height:\s*\d/, graph);
    }
    assert.match(
      baseStylesheet,
      new RegExp(
        `\\.${graph}\\s+svg\\s*\\{[^}]*width:\\s*100%[^}]*aspect-ratio:\\s*${width}\\s*\\/\\s*${height}`,
      ),
    );
    assert.ok(
      app.includes(`viewBox="0 0 ${width} ${height}"`),
      `${graph} keeps its authored viewBox`,
    );
  }
  assert.doesNotMatch(adapter, /setAttribute\(\s*['"](?:viewBox|preserveAspectRatio)['"]/);
});
