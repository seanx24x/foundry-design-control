import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  typographyPresentation,
  typographyUsageWeights,
  typographyLibraryMeta,
  refinePilotTypography,
} from '../public/foundry-pilot-typography.js';
import { typographyComparisonState } from '../public/next-typography-studio.js';

const publicFile = (name) => readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');
const selection = Object.freeze({ id: 'headline' });
const typography = Object.freeze({
  selection: Object.freeze({ size: '76px', weight: '550', lineHeight: '80px' }),
});

test('typography presentation distinguishes selection, empty, measured and unavailable states', () => {
  const candidate = Object.freeze({ family: 'Inter', origin: 'project' });
  const cases = [
    [{ connected: true }, null, null, 'selection', 'No text selected'],
    [{ connected: true }, selection, typography, 'empty', 'Choose a candidate'],
    [{ connected: false }, selection, typography, 'unmeasured', 'Preview offline'],
    [
      { connected: true, candidate, pending: true },
      selection,
      typography,
      'unmeasured',
      'Measuring fonts',
    ],
    [{ connected: true, candidate }, selection, typography, 'unmeasured', 'Comparison unavailable'],
    [
      { connected: true, candidate, comparison: { current: {}, candidate: {} } },
      selection,
      typography,
      'ready',
      'Measured comparison',
    ],
  ];
  for (const [input, selected, type, phase, label] of cases) {
    const state = Object.freeze(typographyComparisonState(input));
    const args = Object.freeze({
      selection: selected,
      typography: type,
      candidate: input.candidate,
      state,
    });
    const model = typographyPresentation(args);
    assert.equal(model.phase, phase);
    assert.equal(model.label, label);
    assert.deepEqual(typographyPresentation(args), model, 'presentation is deterministic');
  }
});

test('empty comparison summary contains only supplied computed settings and truthful Review language', () => {
  const state = typographyComparisonState({ connected: true });
  const model = typographyPresentation({ selection, typography, state });
  assert.deepEqual(model.settings, [
    ['Size', '76px'],
    ['Weight', '550'],
    ['Line height', '80px'],
  ]);
  assert.deepEqual(
    typographyPresentation({
      selection,
      typography: { selection: { size: '0px', weight: '', lineHeight: null } },
      state,
    }).settings,
    [['Size', '0px']],
  );
  assert.deepEqual(typographyPresentation({ state }).settings, []);
  assert.match(model.footer, /adds a change to Review/);
  assert.match(model.footer, /Local fonts are preview-only/);
  assert.doesNotMatch(model.footer, /adds a reviewed change|verified|source applied/i);
});

test('font usage weights are unique and numerically ordered without changing source metadata', () => {
  const weights = Object.freeze([700, '400', 500, '700', '1000']);
  assert.equal(typographyUsageWeights(weights), '400, 500, 700, 1000');
  assert.equal(typographyUsageWeights(), '');
  assert.deepEqual(weights, [700, '400', 500, '700', '1000']);
});

test('library metadata distinguishes indexed project assets, page usage and preview-only installed fonts', () => {
  assert.equal(
    typographyLibraryMeta('project', '3 weights · project'),
    'Project asset · 3 weights',
  );
  assert.equal(typographyLibraryMeta('project', '1 weights · project'), 'Project asset · 1 weight');
  assert.equal(typographyLibraryMeta('project', '0 weights · computed'), 'Used on page');
  assert.equal(
    typographyLibraryMeta('project', '2 weights · stylesheet'),
    'Used on page · 2 weights',
  );
  assert.equal(
    typographyLibraryMeta('local', '0 weights · local'),
    'Installed font · preview only',
  );
  assert.equal(typographyLibraryMeta('google', 'sans-serif · 18 styles'), 'sans-serif · 18 styles');
});

// A minimal DOM fixture supports reparenting but exposes no event, transport,
// font-loading or HTML replacement methods. Bound controls are opaque nodes.
function node(text = '') {
  const classes = new Set();
  return {
    textContent: text,
    className: '',
    classList: { add: (value) => classes.add(value), contains: (value) => classes.has(value) },
    dataset: {},
    children: [],
    parent: null,
    selectors: new Map(),
    lists: new Map(),
    get firstChild() {
      return this.children[0] ?? null;
    },
    get firstElementChild() {
      return this.firstChild;
    },
    get nextElementSibling() {
      return this.parent?.children[this.parent.children.indexOf(this) + 1] ?? null;
    },
    querySelector(selector) {
      return this.selectors.get(selector) ?? null;
    },
    querySelectorAll(selector) {
      return this.lists.get(selector) ?? [];
    },
    matches(selector) {
      return selector === `.${this.className}`;
    },
    append(...items) {
      for (const item of items) {
        item.remove();
        item.parent = this;
        this.children.push(item);
      }
    },
    after(item) {
      item.remove();
      item.parent = this.parent;
      this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, item);
    },
    remove() {
      if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent = null;
    },
  };
}

function fixture({ empty = false } = {}) {
  const root = node();
  root.ownerDocument = { createElement: (tag) => Object.assign(node(), { tagName: tag }) };
  const heading = node();
  const headingStatus = node();
  heading.selectors.set('span', headingStatus);
  root.selectors.set('#typography-studio-stage .next-type-heading', heading);
  const comparison = node();
  const card = node();
  const header = node();
  const roleLabel = node('Current');
  const family = node('Morrow Sans');
  header.append(roleLabel, family);
  const metrics = node();
  const face = node('loaded');
  const lines = node('2');
  const dimension = node('Rendered');
  metrics.append(face, lines, dimension);
  metrics.lists.set('dt', [dimension]);
  const specimen = node('The exact product copy');
  specimen.style = Object.freeze({
    fontFamily: 'Morrow Sans',
    fontSize: '76px',
    transform: 'scale(0.5)',
  });
  specimen.dataset.specimenContract = '1';
  const footer = node();
  const control = node('Use this font');
  control.disabled = true;
  footer.append(control);
  card.append(header, specimen, metrics, footer);
  card.selectors.set('dl', metrics);
  card.selectors.set('header', header);
  card.selectors.set('.eyebrow', roleLabel);
  card.selectors.set('footer', footer);
  // Newly created status list is found just as it would be by DOM traversal.
  const queryCard = card.querySelector;
  card.querySelector = function (selector) {
    if (selector === '.foundry-type-face')
      return header.children.find((e) => e.className === 'foundry-type-face') ?? null;
    return queryCard.call(this, selector);
  };
  if (empty) card.selectors.set('.next-type-unmeasured', specimen);
  comparison.append(card);
  comparison.lists.set('.typography-comparison-card', [card]);
  comparison.selectors.set('.typography-comparison-card', card);
  const placeholder = node();
  const invitation = node();
  const help = node();
  placeholder.selectors.set('strong', invitation);
  placeholder.selectors.set('p', help);
  comparison.selectors.set('.typography-comparison-placeholder', placeholder);
  root.selectors.set('.typography-comparison', comparison);
  const properties = node();
  const fields = node();
  const editControl = node('76px');
  fields.append(editControl);
  const notice = node('Editing adds a change to Review.');
  notice.className = 'next-type-help';
  const health = node();
  const disclosure = node('Source details');
  properties.append(fields, notice, disclosure, health);
  properties.selectors.set('.typography-rendered-section', fields);
  properties.selectors.set('.typography-audit', health);
  properties.lists.set('.next-type-disclosure > summary', [disclosure]);
  root.selectors.set('.next-type-property-scroll', properties);
  const pageFooter = node();
  root.selectors.set('.typography-studio-footer > span', pageFooter);
  return {
    root,
    headingStatus,
    comparison,
    card,
    header,
    roleLabel,
    metrics,
    face,
    lines,
    dimension,
    specimen,
    footer,
    control,
    fields,
    editControl,
    notice,
    health,
    properties,
    disclosure,
    invitation,
    help,
    pageFooter,
  };
}

test('ready typography refinement retains exact specimens, measurement nodes and bound controls', () => {
  const f = fixture();
  const candidate = { family: 'Inter', origin: 'local' };
  const state = typographyComparisonState({
    connected: true,
    candidate,
    comparison: { current: {}, candidate: {} },
  });
  const originalStyle = f.specimen.style;
  refinePilotTypography(f.root, { selection, typography, candidate, state });
  assert.ok(f.root.classList.contains('foundry-type-interior'));
  assert.equal(f.root.dataset.typePhase, 'ready');
  assert.equal(f.comparison.dataset.typeReady, 'true');
  assert.equal(f.headingStatus.dataset.typeStatus, 'measured');
  assert.ok(f.card.children.includes(f.specimen));
  assert.equal(f.specimen.style, originalStyle);
  assert.equal(f.specimen.textContent, 'The exact product copy');
  assert.equal(f.specimen.dataset.specimenContract, '1');
  assert.equal(f.face.parent.className, 'foundry-type-face');
  assert.equal(f.face.parent.parent, f.header);
  assert.ok(f.metrics.children.includes(f.lines));
  assert.equal(f.dimension.textContent, 'Product size');
  assert.equal(f.control.parent, f.footer);
  assert.equal(f.control.disabled, true, 'local-font action must not be re-enabled');
  assert.ok(f.fields.children.includes(f.editControl));
  assert.equal(f.notice.parent, f.fields);
  assert.equal(f.fields.nextElementSibling, f.health);
  assert.equal(f.disclosure.children[0].dataset.icon, 'chevronDown');
});

test('empty typography comparison uses computed settings without manufacturing a font specimen', () => {
  const f = fixture({ empty: true });
  refinePilotTypography(f.root, {
    selection,
    typography,
    state: typographyComparisonState({ connected: true }),
  });
  assert.equal(f.root.dataset.typePhase, 'empty');
  assert.equal(f.metrics.hidden, true);
  assert.equal(f.specimen.parent, null);
  assert.equal(f.footer.parent, null);
  assert.equal(f.card.querySelector('.foundry-type-face').hidden, true);
  assert.equal(f.roleLabel.textContent, 'Selected font');
  assert.match(f.invitation.textContent, /Choose a font/);
  assert.match(f.help.textContent, /loads both faces before showing/);
  const settings = f.card.children.find((e) => e.className === 'foundry-type-current-settings');
  assert.equal(settings.children.length, 3);
});

test('unavailable comparison hides metrics and explains the actual pending or offline state', () => {
  for (const input of [
    { connected: false },
    { connected: true, pending: true },
    { connected: true },
  ]) {
    const f = fixture();
    const message = node('Generic invitation');
    f.comparison.lists.set('.next-type-unmeasured p', [message]);
    const candidate = { family: 'Inter', origin: 'project' };
    const state = typographyComparisonState({ ...input, candidate });
    refinePilotTypography(f.root, { selection, typography, candidate, state });
    assert.equal(f.root.dataset.typePhase, 'unmeasured');
    assert.equal(f.comparison.dataset.typeReady, 'false');
    assert.equal(f.metrics.hidden, true);
    assert.equal(message.textContent, state.message);
    assert.equal(f.control.disabled, true);
  }
});

test('typography adapter has no commands, font permission requests or specimen/control writes', async () => {
  const source = await publicFile('foundry-pilot-typography.js');
  assert.doesNotMatch(
    source,
    /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\brequestCommand\s*\(|\brunDurableAction\s*\(|\blocalStorage\b|\bsessionStorage\b|\bqueryLocalFonts\s*\(|\bFontFace\b|document\.fonts/,
  );
  assert.doesNotMatch(source, /\.click\s*\(|\.dispatchEvent\s*\(|\.addEventListener\s*\(/);
  assert.doesNotMatch(source, /innerHTML|outerHTML|replaceChildren|cloneNode|insertAdjacentHTML/);
  assert.doesNotMatch(source, /\.disabled\s*=|\.value\s*=|\.style\b|setAttribute\(\s*['"]style/);
  assert.doesNotMatch(
    source,
    /(?:querySelector|querySelectorAll)\(['"]\.typography-comparison-specimen['"]/,
  );
});

test('Typography pilot runs only after existing availability, resource and local-font guards', async () => {
  const source = await publicFile('next-typography-studio.js');
  assert.match(source, /const pilot = foundryFoundationsEnabled\(\)/);
  const hook = source.indexOf(
    'if (pilot) refinePilotTypography(root, { selection, typography, candidate, state })',
  );
  assert.ok(hook > source.indexOf('field.disabled = true'));
  assert.ok(
    hook > source.indexOf("use.disabled ||= !state.ready || candidate?.origin === 'local'"),
  );
  assert.ok(hook > source.indexOf("value.textContent = 'Not measured'"));
  assert.ok(hook < source.indexOf('scroll.scrollTop = saved?.main'));
  assert.match(source, /name.value = saved.styleName/);
  assert.match(source, /details.open = saved\?\.open.includes\(id\)/);
});

test('Typography pilot CSS is isolated and never overrides the measured specimen itself', async () => {
  const [css, importer] = await Promise.all([
    publicFile('foundry-pilot-typography.css'),
    publicFile('foundry-pilot.css'),
  ]);
  assert.match(importer, /@import url\('\.\/foundry-pilot-typography\.css'\)/);
  let selectors = 0;
  for (const [, selector] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)) {
    if (selector.trim().startsWith('@')) continue;
    assert.match(selector, /:root\[data-foundry-pilot='typography'\]/);
    assert.match(selector, /foundry-type-interior/);
    assert.doesNotMatch(selector, /\.typography-comparison-specimen(?![-\w])/);
    assert.doesNotMatch(selector, /\.foundry-type-interior\s+\*/);
    selectors++;
  }
  assert.ok(selectors > 0);
  assert.doesNotMatch(css, /\.app-shell|\.app-bar|\.typography-studio-shell|\.layers-panel/);
  assert.match(
    css,
    /:is\(\.foundry-type-face, \.foundry-type-metrics\)\[hidden\]\s*\{\s*display:\s*none/,
  );
});

test('Typography comparison responds to center width while source geometry and fit remain app-owned', async () => {
  const [css, app] = await Promise.all([
    publicFile('foundry-pilot-typography.css'),
    publicFile('app.js'),
  ]);
  assert.match(css, /container-name:\s*type-detail/);
  const start = css.search(/@container type-detail\s*\(max-width:\s*640px\)/);
  assert.ok(start >= 0);
  assert.match(
    css.slice(start),
    /\.typography-comparison\s*>\s*div\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
  assert.match(app, /installTypographyComparisonFonts\(typographyComparison\.fontResources\)/);
  assert.match(app, /loadedFaces\.length === 0 \|\| !document\.fonts\.check/);
  assert.match(app, /const scale = Math\.min\([\s\S]*?\.\.\.stages\.map/);
  assert.match(
    app,
    /specimen\.offsetWidth,[\s\S]*?specimen\.offsetHeight,[\s\S]*?stage\.clientWidth,[\s\S]*?stage\.clientHeight/,
  );
  assert.match(app, /\.style\.transform = `scale\(\$\{scale\}\)`/);
});
