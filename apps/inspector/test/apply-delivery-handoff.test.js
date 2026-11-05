import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../public/workflow.js', import.meta.url), 'utf8');
function slice(text, start, end) {
  const first = text.indexOf(start),
    last = text.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, start);
  return text.slice(first, last);
}
const record = (id, runId = 'passed-run', extra = {}) => ({
  id,
  applyRunId: runId,
  sessionId: 'synthetic-handoff',
  status: 'verified',
  title: id,
  summary: 'Recorded verification',
  intent: 'Retained intent',
  affectedFiles: [],
  affectedComponents: [],
  affectedTokens: [],
  risks: [],
  questions: [],
  contexts: [],
  acceptanceCriteria: [],
  blockers: [],
  validationResults: [],
  verificationResults: [],
  changeIds: ['headline'],
  ...extra,
});
const run = (extra = {}) => ({
  id: 'passed-run',
  state: 'passed',
  attempts: 1,
  messages: [],
  changedFiles: [],
  validationResults: [],
  verificationResults: [],
  ...extra,
});
const session = () => ({
  changeSet: {
    id: 'batch-one',
    sessionId: 'synthetic-handoff',
    context: { projectRoot: '/synthetic/project', revision: 'source-one' },
    changes: [],
  },
  applyRuns: [run()],
  deliveryRecords: [record('unrelated', 'another-run'), record('exact-record')],
  documentationPages: [],
  designHistory: [],
  deliveryMilestones: [],
});

// Original matching/navigation/renderer functions; only DOM and transport are
// synthetic. Any attempted network or source action fails this harness.
function harness({ pilot = true } = {}) {
  const calls = [],
    frames = [];
  let applyButtons = [],
    recordButtons = [],
    applyHTML = '',
    deliveryHTML = '';
  const element = (dataset = {}) => ({
    dataset,
    attributes: new Map(),
    hidden: false,
    disabled: false,
    isConnected: true,
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute(name, value) {
      this.attributes.set(name, value);
    },
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    },
    addEventListener(name, handler) {
      this[name] = handler;
    },
    focus() {
      context.document.activeElement = this;
      calls.push({ type: 'focus', dataset: this.dataset });
    },
    scrollTo() {
      this.scrollTop = 0;
      calls.push({ type: 'scroll' });
    },
    insertAdjacentHTML() {},
  });
  const parseButtons = (html) =>
    [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attrs, text]) => {
      const dataset = Object.fromEntries(
        [...attrs.matchAll(/data-([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [
          key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
          value,
        ]),
      );
      const button = element(dataset);
      button.disabled = /\sdisabled(?:\s|$)/.test(attrs);
      button.textContent = text;
      return button;
    });
  const heading = element(),
    stage = element(),
    detail = element(),
    header = element(),
    mode = element();
  stage.scrollTop = 180;
  mode.scrollTop = 120;
  const applyRoot = {
    ...element(),
    hidden: true,
    get innerHTML() {
      return applyHTML;
    },
    set innerHTML(value) {
      applyButtons.forEach((button) => (button.isConnected = false));
      applyHTML = value;
      applyButtons = parseButtons(value);
    },
  };
  const content = {
    ...element(),
    get innerHTML() {
      return deliveryHTML;
    },
    set innerHTML(value) {
      deliveryHTML = value;
      recordButtons = parseButtons(value);
    },
  };
  const exportButton = element(),
    generate = element();
  const tabs = ['handoff', 'documentation', 'checks', 'history'].map((deliveryTab) =>
    element({ deliveryTab }),
  );
  const matching = (selector) => {
    if (selector === '[data-run-action]')
      return applyButtons.filter((button) => button.dataset.runAction);
    if (selector === '[data-run-navigation="back"]')
      return applyButtons.filter((button) => button.dataset.runNavigation === 'back');
    if (selector === '[data-run-navigation="delivery"]')
      return applyButtons.filter((button) => button.dataset.runNavigation === 'delivery');
    if (selector === '[data-delivery-tab]') return tabs;
    if (selector === '[data-delivery-record]')
      return recordButtons.filter((button) => button.dataset.deliveryRecord);
    return [];
  };
  const query = (selector) => {
    if (selector === '#apply-run') return applyRoot;
    if (selector === '#delivery-content') return content;
    if (selector === '#delivery-generate-docs') return generate;
    if (selector === '#delivery-export') return exportButton;
    if (selector === '.delivery-mode') return mode;
    if (selector === '.delivery-record-detail')
      return deliveryHTML.includes('delivery-record-detail') ? detail : null;
    if (selector === '.delivery-record-detail > header > div') return header;
    if (selector.includes('h2') || selector.includes('h1')) return heading;
    if (selector.includes('delivery-stage')) return stage;
    return matching(selector)[0] ?? null;
  };
  for (const item of [content, stage, detail, applyRoot]) item.querySelector = query;
  const context = {
    Error,
    Promise,
    Date,
    JSON,
    URLSearchParams,
    $: query,
    $$: matching,
    document: { activeElement: null, createElement: () => element() },
    foundryPilotActive: () => pilot,
    sessionId: 'synthetic-handoff',
    activeSession: session(),
    activeMode: 'review',
    activeAgentPresence: { connected: true },
    bridgeConnected: true,
    reviewOriginMode: 'canvas',
    dismissedApplyRunId: null,
    applyRunActionError: null,
    cancelConfirmationRunId: null,
    cancelConfirmationUntil: 0,
    deliveryTab: 'documentation',
    deliveryRecordId: 'unrelated',
    deliveryDocumentId: '',
    visualCheckReportId: '',
    runtimeConnected: true,
    deliveryGenerating: false,
    deliveryActionError: '',
    params: new URLSearchParams('ui=next'),
    capturePilotApplyState: () => null,
    refinePilotApply: (_root, value) => calls.push({ type: 'apply', ...value }),
    escapeText: (value) =>
      String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;'),
    escapeAttribute: (value) => String(value ?? '').replaceAll('"', '&quot;'),
    renderIcons() {},
    engineeringEvidenceMarkup: () => '',
    deliveryVerificationMarkup: () => '',
    deliveryEvidenceUI: { markup: () => '', bind() {} },
    deliveryNarrativeReadOnly: () => true,
    deliveryStatusLabel: (status) => status,
    nextDelivery: {
      capture: () => calls.push({ type: 'capture' }),
      update: (value) => {
        calls.push({ type: 'delivery', ...value });
        exportButton.disabled = !value.records.some((item) => item.id === value.recordId);
      },
    },
    requestAnimationFrame: (callback) => {
      frames.push(callback);
    },
    setTimeout() {},
    toast: (message) => calls.push({ type: 'toast', message }),
    api() {
      throw Error('Navigation must not use transport');
    },
    requestCommand() {
      throw Error('Navigation must not change preview/source');
    },
    setMode: (mode, focus) => {
      context.activeMode = mode;
      calls.push({ type: 'navigation', mode, focus });
      if (mode === 'delivery') context.actions.renderDelivery();
    },
  };
  const source =
    slice(
      workflow,
      'export function shouldDisplayApplyRun(',
      'function selectedMappingSource(',
    ).replace('export ', '') +
    slice(workflow, 'export function applyLifecyclePresentation(', '// Pure view models.').replace(
      'export ',
      '',
    ) +
    slice(app, 'const RUN_ORDER =', 'function renderChangeSummary(') +
    slice(app, 'function renderDelivery(', 'function visualRecipeTargetSuggestions(') +
    '\nthis.actions={renderApply:renderApplyRun,renderDelivery,resolve:resolveVerifiedDelivery,open:openVerifiedDeliveryHandoff,selection:deliveryHandoffSelection,pin:()=>verifiedDeliverySelection,context:applyRunContextKey};';
  runInNewContext(source, context);
  runInNewContext(
    slice(
      app,
      "$$('[data-delivery-tab]').forEach((button) =>\n  button.addEventListener",
      "$('#delivery-generate-docs')?.addEventListener",
    ),
    context,
  );
  const render = () => context.actions.renderApply(context.activeSession.applyRuns);
  render();
  return {
    context,
    calls,
    render,
    tabs,
    content,
    applyRoot,
    exportButton,
    heading,
    stage,
    mode,
    button: () => matching('[data-run-navigation="delivery"]')[0],
    recordButton: (id) => recordButtons.find((button) => button.dataset.deliveryRecord === id),
    flush: () => {
      while (frames.length) frames.shift()();
    },
    open: () => context.actions.open('passed-run', 'exact-record', context.actions.context()),
  };
}

test('verified handoff selects the exact non-first record and resets a previous Delivery tab', () => {
  const h = harness();
  const before = JSON.stringify(h.context.activeSession);
  h.button().click();
  h.flush();
  assert.equal(h.context.activeMode, 'delivery');
  assert.equal(h.context.deliveryTab, 'handoff');
  assert.equal(h.context.deliveryRecordId, 'exact-record');
  assert.equal(h.context.actions.pin().recordId, 'exact-record');
  assert.equal(h.context.actions.pin().runId, 'passed-run');
  assert.match(h.content.innerHTML, /<h2>exact-record<\/h2>/);
  assert.equal(h.exportButton.disabled, false);
  assert.equal(h.context.document.activeElement, h.heading);
  assert.equal(h.stage.scrollTop, 0);
  assert.equal(h.mode.scrollTop, 0);
  assert.equal(
    h.tabs.find((tab) => tab.dataset.deliveryTab === 'handoff').getAttribute('aria-selected'),
    'true',
  );
  assert.equal(
    h.tabs.find((tab) => tab.dataset.deliveryTab === 'documentation').getAttribute('aria-selected'),
    'false',
  );
  assert.equal(JSON.stringify(h.context.activeSession), before, 'navigation is read-only');
  assert.ok(
    h.calls.some((call) => call.type === 'capture'),
    'existing Delivery editor captures before replacement',
  );
});

test('resolver rejects absent, superseded, foreign-session and ambiguous verified records', () => {
  for (const alter of [
    (value) => (value.deliveryRecords = [record('unrelated', 'another-run')]),
    (value) => (value.deliveryRecords[1].status = 'superseded'),
    (value) => (value.deliveryRecords[1].sessionId = 'another-session'),
    (value) => value.deliveryRecords.push(record('duplicate-match')),
    (value) => value.deliveryRecords.push(record('exact-record', 'another-run')),
    (value) => (value.applyRuns[0].state = 'verifying'),
  ]) {
    const h = harness();
    alter(h.context.activeSession);
    const result = h.context.actions.resolve('passed-run', 'exact-record');
    assert.equal(result.record, null);
    assert.ok(result.error);
    h.open();
    assert.equal(h.context.activeMode, 'review');
    assert.equal(h.context.deliveryRecordId, 'unrelated');
    assert.equal(h.context.deliveryTab, 'documentation');
    assert.equal(h.context.actions.pin(), null);
    assert.ok(!h.calls.some((call) => call.type === 'navigation'));
  }
});

test('invalid or ambiguous handoffs never present a verified lifecycle or enabled handoff action', () => {
  for (const alter of [
    (value) => (value.deliveryRecords = []),
    (value) => (value.deliveryRecords[1].status = 'superseded'),
    (value) => (value.deliveryRecords[1].sessionId = 'another-session'),
    (value) => value.deliveryRecords.push(record('second-verified')),
    (value) => value.deliveryRecords.push(record('exact-record', 'another-run')),
  ]) {
    const h = harness();
    alter(h.context.activeSession);
    h.render();
    const presentation = h.calls.filter((call) => call.type === 'apply').at(-1);
    const reason = h.context.actions.resolve('passed-run').error;
    assert.equal(presentation.lifecycle.phase, 'Checks passed');
    assert.equal(presentation.verifiedDelivery, false);
    assert.equal(presentation.lifecycle.detail, `Run checks passed. ${reason}`);
    assert.equal(h.button(), undefined);
    assert.match(h.applyRoot.innerHTML, /<strong>Checks passed<\/strong>/);
    assert.ok(h.applyRoot.innerHTML.includes(reason));
    assert.doesNotMatch(h.applyRoot.innerHTML, />Verified<|Open verified handoff/);
  }
});

test('a recovered exact handoff clears only its own navigation error during render or opening', () => {
  for (const recover of ['render', 'open']) {
    const h = harness();
    const staleButton = h.button();
    h.context.activeSession.deliveryRecords.pop();
    staleButton.click();
    assert.equal(h.context.applyRunActionError.kind, 'handoff');
    assert.match(h.applyRoot.innerHTML, /class="apply-action-error" role="alert"/);
    h.context.activeSession.deliveryRecords.push(record('exact-record'));
    if (recover === 'render') {
      h.render();
      assert.ok(h.button());
      assert.doesNotMatch(h.applyRoot.innerHTML, /class="apply-action-error"/);
    } else {
      assert.equal(h.open(), true);
      assert.equal(h.context.deliveryRecordId, 'exact-record');
    }
    assert.equal(h.context.applyRunActionError, null);
  }
});

test('handoff recovery preserves genuine Apply errors and errors owned by another run or context', () => {
  for (const attributes of [
    { needsRefresh: true },
    { kind: 'handoff', runId: 'another-run' },
    { kind: 'handoff', context: 'another-workspace' },
  ]) {
    const h = harness();
    const error = {
      context: h.context.actions.context(),
      runId: 'passed-run',
      message: 'Existing Apply action failure',
      ...attributes,
    };
    h.context.applyRunActionError = error;
    h.render();
    assert.equal(h.context.applyRunActionError, error);
    assert.equal(h.open(), true);
    assert.equal(h.context.applyRunActionError, error);
  }
});

test('rendered handoff removed or superseded before activation stays on Apply with truthful feedback', () => {
  for (const status of ['missing', 'superseded']) {
    const h = harness(),
      staleButton = h.button();
    if (status === 'missing') h.context.activeSession.deliveryRecords.pop();
    else h.context.activeSession.deliveryRecords[1].status = status;
    staleButton.click();
    assert.equal(h.context.activeMode, 'review');
    assert.equal(h.context.deliveryRecordId, 'unrelated');
    assert.equal(h.context.applyRunActionError.runId, 'passed-run');
    assert.ok(h.context.applyRunActionError.message);
    assert.equal(h.context.applyRunActionError.needsRefresh, undefined);
  }
});

test('stale handoff controls cannot navigate a newer run, another project, or another workspace', () => {
  for (const alter of [
    (value) => value.activeSession.applyRuns.push(run({ id: 'newer-run', state: 'applying' })),
    (value) => (value.activeSession.changeSet.context.projectRoot = '/another/project'),
    (value) => (value.activeSession.changeSet.sessionId = 'another-session'),
    (value) => (value.activeMode = 'canvas'),
  ]) {
    const h = harness(),
      staleButton = h.button();
    alter(h.context);
    const previousMode = h.context.activeMode;
    staleButton.click();
    assert.equal(h.context.activeMode, previousMode);
    assert.equal(h.context.deliveryRecordId, 'unrelated');
    assert.equal(h.context.actions.pin(), null);
    assert.ok(!h.calls.some((call) => call.type === 'navigation'));
  }
});

test('a pinned handoff never falls back to an unrelated record when its evidence disappears', () => {
  const h = harness();
  h.open();
  h.flush();
  h.context.activeSession.deliveryRecords = [record('unrelated', 'another-run')];
  h.context.actions.renderDelivery();
  assert.equal(h.context.deliveryRecordId, '');
  assert.ok(h.context.actions.selection().error);
  assert.match(h.content.innerHTML, /data-delivery-handoff-unavailable/);
  assert.match(h.content.innerHTML, /data-delivery-handoff-unavailable role="alert"/);
  assert.doesNotMatch(h.content.innerHTML, /foundry-empty-state is-stage/);
  assert.doesNotMatch(h.content.innerHTML, /<h2>unrelated<\/h2>/);
  assert.equal(h.exportButton.disabled, true);
  assert.equal(h.context.actions.pin().recordId, 'exact-record');
  h.context.activeSession.deliveryRecords.push(record('different-id'));
  h.context.actions.renderDelivery();
  assert.equal(h.context.deliveryRecordId, '', 'a replacement record is not the captured record');
  h.context.activeSession.deliveryRecords = [
    record('unrelated', 'another-run'),
    record('exact-record'),
  ];
  h.context.actions.renderDelivery();
  assert.equal(h.context.deliveryRecordId, 'exact-record');
  assert.equal(h.exportButton.disabled, false);
});

test('polling keeps an opened handoff stable without repeating navigation or focus transfer', () => {
  const h = harness();
  h.button().click();
  h.flush();
  const readerFocus = { name: 'record evidence' };
  h.context.document.activeElement = readerFocus;
  h.stage.scrollTop = 340;
  h.mode.scrollTop = 40;
  h.context.activeSession.changeSet.context.revision = 'source-two';
  h.context.activeSession.deliveryRecords.reverse();
  const before = JSON.stringify(h.context.activeSession);
  for (let poll = 0; poll < 3; poll += 1) h.context.actions.renderDelivery();
  h.flush();
  assert.equal(h.context.deliveryRecordId, 'exact-record');
  assert.equal(h.context.document.activeElement, readerFocus);
  assert.equal(h.stage.scrollTop, 340);
  assert.equal(h.mode.scrollTop, 40);
  assert.equal(h.calls.filter((call) => call.type === 'focus').length, 1);
  assert.equal(h.calls.filter((call) => call.type === 'navigation').length, 1);
  assert.equal(JSON.stringify(h.context.activeSession), before);
});

test('switching Delivery tabs preserves the exact handoff and cannot restore a wrong fallback', () => {
  const h = harness();
  h.open();
  h.tabs.find((tab) => tab.dataset.deliveryTab === 'documentation').click();
  assert.equal(h.context.deliveryTab, 'documentation');
  assert.equal(h.context.actions.pin().recordId, 'exact-record');
  h.context.activeSession.deliveryRecords = [record('unrelated', 'another-run')];
  h.tabs.find((tab) => tab.dataset.deliveryTab === 'handoff').click();
  assert.equal(h.context.deliveryTab, 'handoff');
  assert.equal(h.context.deliveryRecordId, '');
  assert.match(h.content.innerHTML, /data-delivery-handoff-unavailable/);
  assert.equal(h.exportButton.disabled, true);
});

test('a replacement verified record rebinds the current button without retargeting its stale handler', () => {
  const h = harness(),
    oldButton = h.button();
  h.context.activeSession.deliveryRecords[1] = record('replacement-record');
  h.render();
  assert.notEqual(h.button(), oldButton);
  oldButton.click();
  assert.equal(h.context.activeMode, 'review');
  assert.equal(h.context.actions.pin(), null);
  h.button().click();
  assert.equal(h.context.deliveryRecordId, 'replacement-record');
  assert.equal(h.context.actions.pin().recordId, 'replacement-record');
  assert.match(h.content.innerHTML, /<h2>replacement-record<\/h2>/);
});

test('a pinned record becoming superseded, ambiguous or foreign cannot retain verified detail', () => {
  for (const alter of [
    (value) => (value.deliveryRecords[1].status = 'superseded'),
    (value) => value.deliveryRecords.push(record('second-verified')),
    (value) => (value.deliveryRecords[1].sessionId = 'another-session'),
    (value) => (value.deliveryRecords[1].applyRunId = 'another-run'),
    (value) => (value.changeSet.context.projectRoot = '/another/project'),
  ]) {
    const h = harness();
    h.open();
    h.flush();
    alter(h.context.activeSession);
    h.context.actions.renderDelivery();
    assert.equal(h.context.deliveryRecordId, '');
    assert.match(h.content.innerHTML, /data-delivery-handoff-unavailable/);
    assert.doesNotMatch(h.content.innerHTML, /class="delivery-record-detail"/);
    assert.equal(h.exportButton.disabled, true);
  }
});

test('an explicit Delivery row choice exits exact handoff tracking and preserves normal browsing', () => {
  const h = harness();
  h.open();
  h.flush();
  h.context.activeSession.deliveryRecords = [record('unrelated', 'another-run')];
  h.context.actions.renderDelivery();
  h.recordButton('unrelated').click();
  assert.equal(h.context.actions.pin(), null);
  assert.equal(h.context.deliveryRecordId, 'unrelated');
  assert.match(h.content.innerHTML, /<h2>unrelated<\/h2>/);
  assert.equal(h.exportButton.disabled, false);
});

test('without an exact handoff normal Delivery retains selected records and original first-record fallback', () => {
  const h = harness();
  h.context.deliveryTab = 'handoff';
  h.context.actions.renderDelivery();
  assert.equal(h.context.deliveryRecordId, 'unrelated');
  h.context.deliveryRecordId = 'missing';
  h.context.actions.renderDelivery();
  assert.equal(h.context.deliveryRecordId, 'unrelated');
  h.context.activeSession.deliveryRecords = [];
  h.context.actions.renderDelivery();
  assert.equal(h.context.deliveryRecordId, '');
  assert.doesNotMatch(h.content.innerHTML, /data-delivery-handoff-unavailable/);
});

test('gate off retains navigation-only handoff behavior and existing Delivery selection', () => {
  const h = harness({ pilot: false });
  h.button().click();
  assert.equal(h.context.activeMode, 'delivery');
  assert.equal(h.context.deliveryRecordId, 'unrelated');
  assert.equal(h.context.deliveryTab, 'documentation');
  assert.equal(h.context.actions.pin(), null);
});
