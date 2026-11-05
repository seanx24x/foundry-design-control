import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { deliveryNarrativeDraft, deliveryNarrativePayload } from '../public/next-delivery.js';
import { deliveryDocumentBlocks } from '../public/foundry-pilot-delivery.js';
const file = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
const adapter = file('next-delivery.js');
const fixture = readFileSync(
  new URL('../../../scripts/test-foundry-delivery-pilot-fixture.mjs', import.meta.url),
  'utf8',
);

function noteHarness({ connected = true, failure = false, held = false, missing = false } = {}) {
  const record = { id: 'ready', intent: 'Saved intent', risks: [], questions: [] },
    events = [];
  const fields = ['intent', 'risks', 'questions'].map((key) => ({
    dataset: { deliveryField: key },
    value: key === 'intent' ? 'Draft intent' : key === 'risks' ? ' First risk\n\nSecond risk ' : '',
  }));
  let action, release;
  const context = {
    connected,
    record,
    activeRecord: record,
    base: deliveryNarrativeDraft(record),
    pending: new Set(),
    messages: new Map(),
    drafts: new Map(),
    fields: () => fields,
    readDraft: () =>
      Object.fromEntries(fields.map((field) => [field.dataset.deliveryField, field.value])),
    equalDraft: (a, b) => ['intent', 'risks', 'questions'].every((key) => a?.[key] === b?.[key]),
    deliveryNarrativePayload,
    deliveryNarrativeDraft,
    syncEditor: () => events.push({ type: 'sync' }),
    save: {
      addEventListener: (_, handler) => {
        action = handler;
      },
    },
    saveNarrative: async (id, payload) => {
      events.push({ type: 'save', id, payload });
      if (held)
        await new Promise((resolve) => {
          release = resolve;
        });
      if (failure) throw Error('Synthetic note save failed');
      return { deliveryRecords: missing ? [] : [{ ...record, ...payload }] };
    },
    receiveSession: (session) => events.push({ type: 'receive', session }),
  };
  const start = adapter.indexOf("save.addEventListener('click', async () => {");
  const end = adapter.indexOf('\n      });', start);
  assert.ok(start >= 0 && end > start);
  runInNewContext(adapter.slice(start, end + '\n      });'.length), context);
  return { action, context, fields, events, release: () => release() };
}

test('narrative save uses explicit normalized payload and acknowledges the returned record', async () => {
  const { action, context, events } = noteHarness();
  await action();
  const save = events.find((event) => event.type === 'save');
  assert.equal(save.id, 'ready');
  assert.equal(save.payload.intent, 'Draft intent');
  assert.deepEqual(save.payload.risks, ['First risk', 'Second risk']);
  assert.equal(save.payload.narrativeSource, 'authored');
  assert.equal(context.messages.get('ready'), 'Notes saved.');
  assert.equal(context.pending.size, 0);
  assert.ok(events.some((event) => event.type === 'receive'));
});

test('pending notes reject duplicate saves and preserve newer edits on acknowledgement', async () => {
  const { action, context, fields, events, release } = noteHarness({ held: true });
  const pending = action();
  assert.equal(context.pending.has('ready'), true);
  await action();
  fields[0].value = 'Newer unsaved intent';
  release();
  await pending;
  assert.equal(events.filter((event) => event.type === 'save').length, 1);
  assert.equal(fields[0].value, 'Newer unsaved intent');
  assert.equal(
    context.messages.get('ready'),
    'Earlier notes saved. Your newer edits are not saved yet.',
  );
  assert.equal(context.pending.size, 0);
});

test('offline, rejected and missing-record responses never claim that notes were saved', async () => {
  const offline = noteHarness({ connected: false });
  await offline.action();
  assert.equal(offline.events.length, 0);
  for (const options of [{ failure: true }, { missing: true }]) {
    const { action, context, fields, events } = noteHarness(options);
    await action();
    assert.equal(fields[0].value, 'Draft intent');
    assert.match(context.messages.get('ready'), /^Not saved\..*Your notes are preserved\./);
    assert.equal(context.pending.size, 0);
    assert.ok(!events.some((event) => event.type === 'receive'));
  }
});

test('notes saved after switching records cannot overwrite a newer stored draft', async () => {
  const { action, context, fields, release } = noteHarness({ held: true });
  const pending = action();
  context.activeRecord = { id: 'another' };
  context.drafts.set('ready', { intent: 'Later notes', risks: '', questions: '' });
  release();
  await pending;
  assert.equal(context.drafts.get('ready').intent, 'Later notes');
  assert.equal(fields[0].value, 'Draft intent');
});

test('documentation reader keeps unknown markup literal and retains code as text', () => {
  const blocks = deliveryDocumentBlocks(
    '# Heading\n\nParagraph with `code`.\n\n- First\n- Second\n\n```html\n<script>unsafe()</script>\n```\n\n<img src=x onerror=unsafe()>',
  );
  assert.deepEqual(blocks, [
    { type: 'heading', text: 'Heading' },
    { type: 'paragraph', text: 'Paragraph with `code`.' },
    { type: 'list', items: ['First', 'Second'] },
    { type: 'code', text: '<script>unsafe()</script>' },
    { type: 'paragraph', text: '<img src=x onerror=unsafe()>' },
  ]);
  assert.deepEqual(deliveryDocumentBlocks('```\nunclosed'), [{ type: 'code', text: 'unclosed' }]);
  const helper = file('foundry-pilot-delivery.js');
  assert.match(helper, /element.textContent = block.text/);
  assert.match(helper, /const raw = disclosure\(\s*'foundry-delivery-document-source'/);
  const children = [],
    element = { append: (...items) => children.push(...items) };
  const context = {
    document: { createTextNode: (textContent) => ({ type: 'text', textContent }) },
    node: (type, className, textContent) => ({ type, className, textContent }),
  };
  const start = helper.indexOf('function inlineText('),
    end = helper.indexOf('function disclosure(', start);
  assert.ok(start >= 0 && end > start);
  runInNewContext(helper.slice(start, end), context);
  const input = 'Literal <img src=x> with `safe code` and an unmatched ` tick.';
  context.inlineText(element, input);
  assert.equal(
    children.map((item) => item.textContent).join(''),
    'Literal <img src=x> with safe code and an unmatched ` tick.',
  );
  assert.deepEqual(
    children.filter((item) => item.type === 'code').map((item) => item.textContent),
    ['safe code'],
  );
  assert.equal(children.filter((item) => item.type !== 'text' && item.type !== 'code').length, 0);
});

test('Delivery fixture uses actual rendering, evidence matching and isolated transport', () => {
  for (const boundary of [
    'function deliveryStatusLabel(',
    'function visualRecipeTargetSuggestions(',
    "$$('[data-delivery-tab]').forEach",
    "$('#design-system-search').addEventListener",
    'const deliveryEvidenceUI = createDeliveryEvidenceUI(',
  ])
    assert.ok(fixture.includes(boundary), boundary);
  assert.match(fixture, /createNextDelivery as createRealDelivery/);
  assert.match(fixture, /createDeliveryEvidenceUI.*from '\/delivery-evidence-ui.js'/);
  assert.match(fixture, /engineeringEvidence,deliveryNarrativeReadOnly.*from '\/workflow.js'/);
  assert.match(fixture, /packages\/protocol\/dist/);
  assert.match(fixture, /const stylesheets\s*=\s*\[\.\.\.index\.matchAll/);
  assert.match(fixture, /Object.defineProperty\(navigator,'clipboard'/);
  assert.match(fixture, /server.listen\(port,\s*'127\.0\.0\.1'/);
  assert.match(fixture, /FOUNDRY_DELIVERY_FIXTURE_PORT\s*\?\?\s*0/);
  assert.doesNotMatch(fixture, /fetch\(|localStorage|sessionStorage|chromium\.launch/);
  assert.doesNotMatch(fixture, /ses_[a-z0-9]+|__foundry_session|__foundry_token/);
});

test('Delivery pilot gates original report nodes into native disclosures without changing actions', () => {
  const helper = file('foundry-pilot-delivery.js');
  assert.match(adapter, /foundryFoundationsEnabled\(\)\s*\? createPilotDelivery\(root\)/);
  assert.match(adapter, /pilot\?\.update\(\{ tab, record: activeRecord \}\)/);
  assert.match(helper, /disclosure\(\s*'foundry-delivery-notes'/);
  assert.match(helper, /disclosure\(\s*'foundry-delivery-context'/);
  assert.match(helper, /disclosure\(\s*'foundry-delivery-captures'/);
  assert.match(helper, /details.append\(summary, content\)/);
  assert.match(
    helper,
    /milestones\?\.classList.add\('foundry-sidebar', 'foundry-sidebar-continuation'\)/,
  );
  assert.match(helper, /compact.matches \? 'horizontal' : 'vertical'/);
  assert.match(helper, /\['ArrowUp', 'ArrowDown'\]/);
  assert.doesNotMatch(
    helper,
    /fetch\(|requestCommand\(|postMessage\(|cloneNode\(|localStorage|sessionStorage/,
  );
  assert.doesNotMatch(helper, /\.(?:value|disabled)\s*=/);
});

test('Delivery browser assertions cover status truthfulness, note ownership and original actions', () => {
  for (const state of [
    'ready',
    'verified',
    'blocked',
    'empty',
    'source-unavailable',
    'captures',
    'capture-error',
    'docs-fresh',
    'docs-stale',
    'docs-empty',
    'history',
    'history-empty',
    'checks',
    'checks-error',
    'offline',
  ])
    assert.ok(fixture.includes(`'${state}'`), state);
  for (const assertion of [
    'Ready handoff is not labeled verified while acceptance evidence is pending',
    'Verified intent, risks and questions remain read-only',
    'Missing reviewed snapshot never invents before-and-after comparisons',
    'Narrative draft, focus and caret survive record rendering',
    'Input blur does not autosave notes in Next Delivery',
    'Failed note acknowledgement preserves drafts with explicit not-saved feedback',
    'Acknowledgement cannot erase newer note edits or duplicate the pending save',
    'Export only copies a safely quoted command through the isolated clipboard',
    'Failed evidence fetch exposes retry without a false image-success claim',
    'Failed documentation refresh does not claim freshness',
    'Milestone submission groups exact existing verified entry IDs only',
    'Visual checks preserve passed, different, unbaselined and incomplete outcomes',
    'Keyboard tab movement updates selection and roving focus',
    'No source Apply, provider or publication action is invoked',
  ])
    assert.ok(fixture.includes(assertion), assertion);
  assert.match(fixture, /\$\(selector\)===originalNodes\[key\]/);
});

test('isolated Delivery reruns reset their image cache and prevent concurrent assertion runs', () => {
  const start = fixture.indexOf('async function runAssertions(){');
  const end = fixture.indexOf("$('#fixture-rerun').addEventListener", start);
  const run = fixture.slice(start, end);
  assert.match(run, /if\(fixtureRunning\)return/);
  assert.match(run, /deliveryEvidenceUI\.dispose\(\)/);
  assert.ok(run.indexOf('deliveryEvidenceUI.dispose()') < run.indexOf("showScenario('empty')"));
  assert.match(run, /dataset\.result='running'/);
  assert.match(run, /\[data-delivery-evidence="0"\] \[data-load-evidence\]/);
  assert.match(run, /finally\{fixtureRunning=false;\$\('#fixture-rerun'\)\.disabled=false;/);
});
