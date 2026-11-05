import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  recipePresentation,
  recipePropertyLabel,
  recipeValueLabel,
  refinePilotRecipes,
} from '../public/foundry-pilot-recipes.js';

const publicFile = (file) => readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8');
const recipe = Object.freeze({ id: 'supporting-treatment' });
const selection = Object.freeze({ label: 'Supporting content' });

test('recipe pilot separates an empty library, filtered library, target choice and mapping', () => {
  const cases = [
    [{ recipe: null, count: 0 }, 'empty'],
    [{ recipe: null, count: 3 }, 'filtered'],
    [{ recipe, count: 3 }, 'target'],
    [{ recipe, selection, count: 3 }, 'mapping'],
  ];
  for (const [input, phase] of cases) {
    const context = Object.freeze({ connected: true, ...input });
    assert.equal(recipePresentation(context).phase, phase);
    assert.deepEqual(recipePresentation(context), recipePresentation(context));
  }
});

test('recipe pilot status preserves offline and unavailable assessment boundaries', () => {
  const cases = [
    [{ connected: false, selection: null }, 'offline'],
    [{ connected: false, selection, assessment: { matched: 3, total: 3 } }, 'offline'],
    [{ connected: true, selection: null }, 'target'],
    [{ connected: true, selection }, 'unavailable'],
    [{ connected: true, selection, assessment: { matched: 3, total: 3 } }, 'supported'],
    [{ connected: true, selection, assessment: { matched: 2, total: 3 } }, 'attention'],
    [{ connected: true, selection, assessment: { matched: 0, total: 3 } }, 'attention'],
    [
      { connected: true, selection, assessment: { matched: 3, total: 3, ambiguous: 1 } },
      'attention',
    ],
  ];
  for (const [input, status] of cases) {
    const context = Object.freeze({ recipe, count: 1, ...input });
    assert.equal(recipePresentation(context).mappingState, status);
  }
});

test('property labels translate camelcase and kebab case without changing source keys', () => {
  assert.equal(recipePropertyLabel('paddingInline'), 'Padding inline');
  assert.equal(recipePropertyLabel('animationTimeline'), 'Animation timeline');
  assert.equal(recipePropertyLabel('border-top-left-radius'), 'Border top left radius');
  assert.equal(recipePropertyLabel('color'), 'Color');
  assert.equal(recipePropertyLabel(''), 'Property');
});

test('unsupported recipe values are excluded even when an old assessment is available', () => {
  const unsupported = Object.freeze({ status: 'unsupported' });
  assert.equal(recipeValueLabel(unsupported, true), 'Saved value · excluded');
  assert.equal(recipeValueLabel(unsupported, false), 'Saved value · excluded');
  assert.equal(recipeValueLabel({ status: 'mapped' }, true), 'Mapped value');
  assert.equal(recipeValueLabel({ status: 'ambiguous' }, true), 'Mapped value');
  assert.equal(recipeValueLabel({ status: 'mapped' }, false), 'Last inspected value');
});

// An opaque-node fixture: no event dispatch, network, cloning, source transport,
// form serialization or replacement methods are available to the adapter.
function node(text = '') {
  const item = {
    textContent: text,
    className: '',
    dataset: {},
    children: [],
    parent: null,
    selectors: new Map(),
    lists: new Map(),
    get nextElementSibling() {
      return this.parent?.children[this.parent.children.indexOf(this) + 1] ?? null;
    },
    get lastElementChild() {
      return this.children.at(-1) ?? null;
    },
    querySelector(selector) {
      return this.selectors.get(selector) ?? null;
    },
    querySelectorAll(selector) {
      return this.lists.get(selector) ?? [];
    },
    append(...items) {
      for (const child of items) {
        child.remove();
        child.parent = this;
        this.children.push(child);
      }
    },
    prepend(...items) {
      for (const child of [...items].reverse()) {
        child.remove();
        child.parent = this;
        this.children.unshift(child);
      }
    },
    before(child) {
      child.remove();
      child.parent = this.parent;
      this.parent.children.splice(this.parent.children.indexOf(this), 0, child);
    },
    remove() {
      if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent = null;
    },
  };
  item.classList = {
    add: (name) => {
      if (!item.className.split(' ').includes(name)) item.className += ` ${name}`;
    },
    contains: (name) => item.className.split(' ').includes(name),
  };
  return item;
}

function fixture() {
  const root = node();
  root.ownerDocument = { createElement: () => node() };
  const rail = node();
  const selected = node('Supporting content');
  const hint = node('No edited values');
  const form = node();
  form.draftName = 'Unsubmitted draft';
  const details = node();
  const summary = node('Selected recipe');
  details.open = true;
  details.append(summary);
  rail.append(selected, hint, form, details);
  root.selectors.set('.next-recipe-property-scroll', rail);
  root.selectors.set('#visual-recipe-selection', selected);
  root.selectors.set('.next-recipe-details > summary', summary);
  root.selectors.set('.next-recipe-details', details);
  const footer = node();
  root.selectors.set('.next-recipe-footer > span', footer);
  root.selectors.set('.next-recipe-heading h2', node('Supporting recipe'));
  const mapping = node();
  const columns = node();
  columns.append(node('Property'), node('Current'), node(''), node('Resolved'));
  mapping.selectors.set('.visual-recipe-map-columns', columns);
  mapping.selectors.set('header strong', node('Supporting content'));
  const row = node();
  const property = node();
  const propertyName = node('animationTimeline');
  property.selectors.set('strong', propertyName);
  const current = node('Unavailable');
  const direction = node();
  const proposed = node();
  const savedCode = node('scroll(block nearest)');
  const unsupported = node('Unsupported');
  proposed.append(savedCode, unsupported);
  row.append(property, current, direction, proposed);
  row.selectors.set(':scope > span:first-child', property);
  row.selectors.set(':scope > code', current);
  row.selectors.set(':scope > span:last-child', proposed);
  mapping.lists.set('.visual-recipe-map-list article', [row]);
  const action = node('Add to Review');
  action.disabled = true;
  mapping.append(row, action);
  root.selectors.set('.visual-recipe-mapping', mapping);
  return {
    root,
    rail,
    selected,
    hint,
    form,
    details,
    summary,
    footer,
    mapping,
    row,
    propertyName,
    current,
    proposed,
    savedCode,
    unsupported,
    action,
  };
}

test('pilot reuses selection, capture drafts, original value nodes and guarded Review control', () => {
  const f = fixture();
  const assessment = Object.freeze({
    matched: 0,
    total: 1,
    mappings: Object.freeze([
      Object.freeze({ property: 'animationTimeline', status: 'unsupported' }),
    ]),
  });
  refinePilotRecipes(f.root, { recipe, selection, assessment, connected: true, count: 1 });
  const capture = f.rail.children[0];
  assert.equal(capture.className, 'foundry-recipe-capture-context');
  assert.equal(capture.children[1], f.selected);
  assert.equal(capture.children[2], f.hint);
  assert.equal(f.rail.children[1], f.form);
  assert.equal(f.form.draftName, 'Unsubmitted draft');
  assert.equal(f.details.open, true);
  assert.equal(f.details.dataset.recipeId, recipe.id);
  assert.equal(f.propertyName.textContent, 'Animation timeline');
  assert.equal(f.propertyName.title, 'animationTimeline');
  assert.equal(f.current.textContent, 'Unavailable');
  assert.equal(f.current.parent.children[1], f.current);
  assert.equal(f.proposed.children[1], f.savedCode);
  assert.equal(f.proposed.children[2], f.unsupported);
  assert.equal(f.savedCode.textContent, 'scroll(block nearest)');
  assert.equal(f.row.dataset.excluded, 'true');
  assert.equal(f.action.disabled, true);
  assert.equal(f.mapping.children[1], f.action);
  assert.match(f.footer.textContent, /preview changes.*only after Apply/);
});

test('pilot hook is explicit and runs after existing connected and capture guards', () => {
  const source = publicFile('next-recipes.js');
  assert.match(source, /foundryFoundationsEnabled\(\)/);
  assert.match(source, /if \(pilot\)\s*refinePilotRecipes\(root,/);
  assert.ok(
    source.indexOf('refinePilotRecipes(root,') >
      source.indexOf("root.querySelector('#visual-recipe-save').disabled"),
  );
  assert.ok(
    source.indexOf('refinePilotRecipes(root,') > source.indexOf('duplicate.disabled = !connected'),
  );
  assert.match(source, /run.disabled = !connected \|\| !assessment\?\.matched/);
  assert.match(source, /window.confirm\(/);
  assert.match(source, /event.stopImmediatePropagation\(\)/);
  assert.match(source, /railScroll.append\(selectionPanel, captureHint, form, selectedDetails\)/);
});

test('pilot has no transport, clone, field-value writes or fabricated preview surfaces', () => {
  const source = publicFile('foundry-pilot-recipes.js');
  assert.doesNotMatch(
    source,
    /fetch\(|requestCommand\(|runDurableAction\(|cloneNode\(|localStorage|sessionStorage/,
  );
  assert.doesNotMatch(source, /\.value\s*=|\.disabled\s*=|\.open\s*=/);
  assert.doesNotMatch(source, /createElement\(['"](?:iframe|canvas)['"]\)/);
  assert.match(source, /if \(!root.classList.contains\('foundry-recipe-interior'\)\)/);
  assert.match(source, /currentCell.append\([^;]*current\)/s);
});

test('Recipes pilot CSS is scoped and uses named center-width queries without owning sidebar width', () => {
  const css = publicFile('foundry-pilot-recipes.css');
  assert.match(
    css,
    /:root\[data-foundry-pilot='recipes'\] \[data-next\] \.foundry-recipe-interior/,
  );
  assert.match(css, /container-name: recipe-detail/);
  assert.match(css, /@container recipe-detail \(max-width: 600px\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 16px minmax\(0, 1fr\)/);
  assert.match(css, /\.foundry-recipe-property\s*\{[^}]*grid-column: 1 \/ -1/s);
  assert.match(
    css,
    /\[data-excluded='true'\][^{]*\.foundry-recipe-value-label\s*\{\s*display: block/s,
  );
  assert.match(css, /outline: var\(--fd-focus-width\) solid var\(--selection\)/);
  assert.doesNotMatch(css, /grid-template-columns:\s*320px|\.visual-recipes-shell\s*\{/);
});

test('Recipes assets and icon scope are included while other page exclusion remains explicit', () => {
  assert.match(publicFile('foundry-pilot.css'), /@import url\('\.\/foundry-pilot-recipes.css'\)/);
  assert.match(publicFile('foundry-pilot.js'), /\.visual-recipes-mode/);
  const icons = publicFile('foundry-pilot-icons.js');
  assert.match(icons, /\.visual-recipes-mode/);
  assert.match(icons, /:not\(\[data-mode-surface="recipes"\]\)/);
});
