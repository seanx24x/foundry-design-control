import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadinessUI } from '../public/readiness-ui.js';

function shellFixture(t, { omitShell = false } = {}) {
  class Element extends EventTarget {
    dataset = {};
    children = new Map();
    open = false;
    textWrites = 0;
    text = '';
    get textContent() {
      return this.text;
    }
    set textContent(value) {
      this.text = value;
      this.textWrites += 1;
    }
    querySelector(selector) {
      if (!this.children.has(selector)) this.children.set(selector, new Element());
      return this.children.get(selector);
    }
    closest() {
      return this.querySelector('scroller');
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    }
  }
  const elements = new Map();
  const optionalShell = new Set([
    '#workflow-status',
    '#workflow-status-detail',
    '#persistent-review-count',
    '#agent-connection-status',
  ]);
  const select = (selector) => {
    if (omitShell && optionalShell.has(selector)) return null;
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  const previous = { document: globalThis.document, window: globalThis.window };
  globalThis.document = { querySelector: select, querySelectorAll: () => [], activeElement: null };
  globalThis.window = new EventTarget();
  t.after(() => {
    for (const key of ['document', 'window']) {
      if (previous[key] === undefined) delete globalThis[key];
      else globalThis[key] = previous[key];
    }
  });
  t.mock.method(globalThis, 'setInterval', () => 1);
  t.mock.method(globalThis, 'clearInterval', () => {});
  return select;
}

test('readiness refreshes visible connection changes, coalesces requests and stops polling after close', async (t) => {
  class Element extends EventTarget {
    dataset = {};
    children = new Map();
    open = false;
    scrollTop = 0;
    querySelector(selector) {
      if (!this.children.has(selector)) this.children.set(selector, new Element());
      return this.children.get(selector);
    }
    closest() {
      return this.querySelector('scroller');
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    }
  }
  const elements = new Map();
  const select = (selector) => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  const documentBefore = globalThis.document;
  const windowBefore = globalThis.window;
  globalThis.document = { querySelector: select, querySelectorAll: () => [], activeElement: null };
  globalThis.window = new EventTarget();
  t.after(() => {
    if (documentBefore === undefined) delete globalThis.document;
    else globalThis.document = documentBefore;
    if (windowBefore === undefined) delete globalThis.window;
    else globalThis.window = windowBefore;
  });
  const timers = new Map();
  t.mock.method(globalThis, 'setInterval', (callback, milliseconds) => {
    assert.equal(milliseconds, 2000);
    timers.set(1, callback);
    return 1;
  });
  t.mock.method(globalThis, 'clearInterval', (id) => timers.delete(id));
  const model = { previewConnected: true, listenerConnected: true };
  const report = { ready: true, capabilities: { inspect: true }, checks: [] };
  let calls = 0;
  let deferred;
  let resolveDeferred;
  const ui = createReadinessUI({
    api: async () => {
      calls += 1;
      return deferred ? await deferred : report;
    },
    sessionId: 'test',
    state: () => model,
    navigate() {},
    recover() {},
    renderIcons() {},
  });
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  await ui.open();
  assert.equal(calls, 1);
  assert.equal(timers.size, 1);
  model.listenerConnected = false;
  ui.update();
  await settle();
  assert.equal(calls, 2, 'connection transition refreshes before the two-second interval');
  deferred = new Promise((resolve) => {
    resolveDeferred = resolve;
  });
  timers.get(1)();
  await settle();
  model.previewConnected = false;
  ui.update();
  timers.get(1)();
  assert.equal(calls, 3, 'only one readiness request can be in flight');
  deferred = undefined;
  resolveDeferred(report);
  await settle();
  assert.equal(calls, 4, 'a transition during a request schedules exactly one fresh read');
  select('#readiness-dialog').close();
  assert.equal(timers.size, 0);
  model.previewConnected = true;
  ui.update();
  await settle();
  assert.equal(calls, 4, 'closed dialogs do not probe live readiness');
});

test('workflow action follows the next task while live status opens connection readiness', async (t) => {
  const select = shellFixture(t);
  const navigations = [];
  const model = { previewConnected: true, listenerConnected: false };
  let reads = 0;
  const ui = createReadinessUI({
    api: async () => {
      reads += 1;
      return { ready: true, checks: [] };
    },
    sessionId: 'session',
    state: () => model,
    navigate: (action) => navigations.push(action),
    recover() {},
    renderIcons() {},
  });
  ui.update();
  select('#workflow-trigger').dispatchEvent(new Event('click'));
  assert.deepEqual(navigations, ['canvas']);
  assert.equal(select('#readiness-dialog').open, false);
  assert.equal(reads, 0);
  model.session = { changeSet: { changes: [{ status: 'draft' }] } };
  ui.update();
  select('#workflow-trigger').dispatchEvent(new Event('click'));
  assert.deepEqual(navigations, ['canvas', 'review']);
  select('#live-status').dispatchEvent(new Event('click'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(select('#readiness-dialog').open, true);
  assert.equal(reads, 1);
  assert.deepEqual(navigations, ['canvas', 'review']);
  select('#readiness-close').dispatchEvent(new Event('click'));
  model.session = {};
  model.previewConnected = false;
  ui.update();
  select('#workflow-trigger').dispatchEvent(new Event('click'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(select('#readiness-dialog').open, true, 'Connect opens readiness as its next task');
  assert.equal(reads, 2);
});

test('shared shell separates agent availability and updates live text only when values change', (t) => {
  const select = shellFixture(t);
  const model = {
    previewConnected: true,
    listenerConnected: false,
    session: {
      changeSet: {
        changes: ['draft', 'approved', 'unresolved', 'applied', 'rejected'].map((status) => ({
          status,
        })),
      },
    },
  };
  const ui = createReadinessUI({
    api: async () => ({ checks: [] }),
    sessionId: 'session',
    state: () => model,
    navigate() {},
    recover() {},
    renderIcons() {},
  });
  ui.update();
  assert.equal(select('#workflow-status').textContent, 'Staged');
  assert.match(select('#workflow-status-detail').textContent, /queue an approved batch/);
  assert.equal(select('#persistent-review-count').textContent, '3');
  assert.equal(select('#agent-connection-status').textContent, 'Agent offline');
  const liveSelectors = [
    '#workflow-status',
    '#workflow-status-detail',
    '#persistent-review-count',
    '#agent-connection-status',
    '#readiness-summary',
  ];
  const originalWrites = liveSelectors.map((selector) => select(selector).textWrites);
  for (let index = 0; index < 5; index += 1) ui.update();
  assert.deepEqual(
    liveSelectors.map((selector) => select(selector).textWrites),
    originalWrites,
    'unchanged polling does not reannounce live regions',
  );
  model.listenerConnected = true;
  model.previewConnected = false;
  ui.update();
  assert.equal(select('#agent-connection-status').textContent, 'Agent connected');
  assert.match(select('#workflow-status-detail').textContent, /Reconnect the preview/);
  assert.equal(select('#persistent-review-count').textWrites, originalWrites[2]);
});

test('readiness supports the existing markup without optional shared-shell nodes', (t) => {
  shellFixture(t, { omitShell: true });
  const ui = createReadinessUI({
    api: async () => ({ checks: [] }),
    sessionId: 'session',
    state: () => ({ previewConnected: true }),
    navigate() {},
    recover() {},
    renderIcons() {},
  });
  assert.doesNotThrow(() => ui.update());
});
