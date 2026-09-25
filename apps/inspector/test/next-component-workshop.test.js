import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Workshop uses the panel surface and one shared full-width content inset', () => {
  const css = readFileSync(
    new URL('../public/next-component-workshop.css', import.meta.url),
    'utf8',
  );
  assert.match(css, /\.next-workshop-center \{[^}]*background: var\(--surface\)/);
  assert.match(
    css,
    /\.next-workshop-content \{[^}]*max-width: none;[^}]*margin: 0;[^}]*padding: 24px var\(--workshop-content-end\) 24px var\(--workshop-content-inset\)/,
  );
  assert.match(
    css,
    /\.next-gallery-grid \{[^}]*padding: 0 var\(--workshop-content-end\) 24px var\(--workshop-content-inset\)/,
  );
  assert.match(
    css,
    /\.next-workshop-center \.component-workshop-detail \{[^}]*scrollbar-gutter: auto/,
  );
});

test('Workshop keeps its full-width header outside the stable scroll gutter', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = readFileSync(
    new URL('../public/next-component-workshop.css', import.meta.url),
    'utf8',
  );
  assert.match(app, /center.append\(heading, scroll\)/);
  assert.match(app, /scroll.offsetWidth - scroll.clientWidth/);
  assert.match(
    css,
    /\.next-workshop-scroll \{[^}]*var\(--workshop-content-inset\) - var\(--workshop-scrollbar-width, 0px\)/,
  );
  assert.match(css, /\.next-workshop-scroll \{[^}]*scrollbar-gutter: stable/);
});
import {
  nextWorkshopCatalog,
  nextWorkshopPresentation,
  workshopCapabilities,
  workshopDriftLabel,
  workshopMeasurement,
  rememberWorkshopDraft,
  restoreWorkshopDraft,
} from '../public/next-component-workshop.js';

const component = {
  key: 'Button',
  name: 'Button',
  source: 'Button.tsx:12',
  elements: [{ label: 'Create workspace', selected: true, width: 144.123, height: 40 }],
  variantAxes: [{ id: 'tone', label: 'Tone', canCreate: true }],
};
const model = () => ({
  component,
  selectedVariant: undefined,
  variants: [],
  axes: component.variantAxes,
  drift: [],
  scopes: [
    ['instance', true, 'Changes this rendered instance'],
    ['variant', false, 'Choose a mapped variant'],
  ],
  activeScope: ['instance', true, 'Changes this rendered instance'],
  stateId: 'current',
  states: [['current', 'Current']],
  source: component.source,
  tokenCount: 0,
  breakpoints: [{ id: 'mobile', label: 'Mobile', width: 390, height: 844 }],
  connected: true,
});

test('source mapping alone never enables authoring, and disconnected controls stay unavailable', () => {
  assert.equal(workshopCapabilities(component, true).canCreate, true);
  assert.equal(workshopCapabilities({ ...component, variantAxes: [] }, true).canCreate, false);
  assert.equal(workshopCapabilities({ ...component, elements: [] }, true).canCreate, false);
  assert.equal(workshopCapabilities(component, false).live, false);
  assert.equal(workshopCapabilities(component, false).canCreate, false);
});

test('an untested comparison is not represented as a successful zero-drift result', () => {
  assert.equal(workshopDriftLabel(undefined, []), 'Not compared');
  assert.equal(workshopDriftLabel({ id: 'primary' }, []), 'No reported differences');
  assert.equal(workshopDriftLabel({ id: 'primary' }, [{}, {}]), '2 differences');
});

test('measurements are compact without inventing missing dimensions', () => {
  assert.equal(workshopMeasurement(144.12345), '144.1');
  assert.equal(workshopMeasurement(40), '40');
  assert.equal(workshopMeasurement(undefined), '—');
  assert.equal(workshopMeasurement(NaN), '—');
});

test('catalog uses editable names, actual instance counts and escaped source tooltips', () => {
  const html = nextWorkshopCatalog(
    [{ ...component, name: '<Button>' }],
    'Button',
    () => '"Button".tsx',
  );
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /&lt;Button&gt;/);
  assert.match(html, /&quot;Button&quot;.tsx/);
  assert.match(html, /1 live instances/);
  assert.doesNotMatch(html, /<Button>/);
});

test('the center owns instances and authoring while the properties rail owns scope, state and source', () => {
  const { detail, contract } = nextWorkshopPresentation(model());
  assert.match(detail, /data-workshop-instance="0"/);
  assert.match(detail, /data-workshop-variant-label/);
  assert.match(detail, /Creates a reviewed source change/);
  assert.doesNotMatch(detail, /data-workshop-scope|data-workshop-state=/);
  assert.match(contract, /data-workshop-scope/);
  assert.match(contract, /data-workshop-state=/);
  assert.match(contract, /configured, not verified/);
  assert.match(contract, /data-workshop-open-states/);
  assert.doesNotMatch(contract, /Safe to extend|workshop-state-dot/);
});

test('offline presentation keeps authoring fields visible but disables success-bearing actions', () => {
  const { detail, contract } = nextWorkshopPresentation({ ...model(), connected: false });
  assert.match(detail, /data-workshop-variant-label/);
  assert.match(detail, /data-workshop-create-variant disabled/);
  assert.match(contract, /Preview offline/);
  assert.match(contract, /Your inputs are kept/);
  assert.match(contract, /data-workshop-open-states disabled/);
});

test('metadata never offers a misleading Canvas-only variant preview', () => {
  const { detail } = nextWorkshopPresentation({
    ...model(),
    variants: [{ id: 'unknown', name: 'Unknown', props: {} }],
  });
  assert.doesNotMatch(detail, /data-workshop-variant="unknown"/);
  assert.doesNotMatch(detail, /Preview this authored variant on Canvas/);
});

test('draft restoration preserves values, inline disclosures, scroll and cursor across refresh', () => {
  let focused = false;
  let restoredSelection;
  const input = {
    tagName: 'INPUT',
    value: 'Danger',
    selectionStart: 2,
    selectionEnd: 4,
    focus: () => {
      focused = true;
    },
    setSelectionRange: (...range) => {
      restoredSelection = range;
    },
  };
  const disclosure = { dataset: { workshopDisclosure: 'authoring' }, open: true };
  const area = { scrollTop: 120 };
  const root = {
    dataset: { workshopKey: 'draft-test' },
    ownerDocument: { activeElement: input },
    querySelector: (selector) =>
      selector === '[data-workshop-variant-label]'
        ? input
        : selector === '.next-workshop-scroll'
          ? area
          : selector === '[data-workshop-disclosure="authoring"]'
            ? disclosure
            : null,
    querySelectorAll: () => [disclosure],
  };
  rememberWorkshopDraft(root);
  input.value = '';
  disclosure.open = false;
  area.scrollTop = 0;
  restoreWorkshopDraft(root, 'draft-test', () => {});
  assert.equal(input.value, 'Danger');
  assert.equal(disclosure.open, true);
  assert.equal(area.scrollTop, 120);
  assert.equal(focused, true);
  assert.deepEqual(restoredSelection, [2, 4]);
});

test('Next keeps Workshop preview measurable but out of the keyboard and accessibility tree', () => {
  const css = readFileSync(
    new URL('../public/next-component-workshop.css', import.meta.url),
    'utf8',
  );
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(
    css,
    /\[data-next\]\[data-mode='components'\] \.canvas-mode\[hidden\][\s\S]*?display: grid !important/,
  );
  assert.match(css, /grid-template-columns: 300px minmax\(0, 1fr\) 300px/);
  assert.match(app, /surface.inert = mode !== 'canvas'/);
  assert.match(app, /surface.setAttribute\('aria-hidden', 'true'\)/);
});
