import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { captureDeliveryFocus, restoreDeliveryFocus } from '../public/delivery-focus.js';

// These small mocks exercise key/guard logic, not browser focus acceptance.
// The attached-DOM Delivery fixture separately tests native subtree replacement.
function harness() {
  const document = { body: {}, activeElement: null };
  document.activeElement = document.body;
  let nodes = [];
  const content = {
    ownerDocument: document,
    contains: (element) => nodes.includes(element),
    querySelectorAll: (selector) => nodes.filter((element) => element.matches(selector)),
  };
  function element({
    attributes = {},
    selector,
    hidden = false,
    inert = false,
    visible = true,
    disabled = false,
    focusable = true,
  } = {}) {
    const attrs = new Map(Object.entries(attributes));
    const value = {
      isConnected: true,
      disabled,
      focusCalls: [],
      selectionCalls: [],
      hasAttribute: (name) => attrs.has(name),
      getAttribute: (name) => attrs.get(name) ?? null,
      matches: (query) =>
        query === selector ||
        (query.startsWith('[') && query.endsWith(']') && attrs.has(query.slice(1, -1))),
      closest: (query) => ((hidden || inert) && query === '[hidden], [inert]' ? {} : null),
      getClientRects: () => (visible ? [{}] : []),
      focus(options) {
        this.focusCalls.push(options);
        if (focusable) document.activeElement = this;
      },
      setSelectionRange(...args) {
        this.selectionCalls.push(args);
      },
      get tabIndex() {
        return Number(attrs.get('tabindex') ?? -1);
      },
      set tabIndex(index) {
        attrs.set('tabindex', String(index));
      },
    };
    return value;
  }
  function mount(...next) {
    const previous = nodes;
    for (const item of previous) item.isConnected = false;
    nodes = next;
    for (const item of next) item.isConnected = true;
    if (previous.includes(document.activeElement) && !nodes.includes(document.activeElement))
      document.activeElement = document.body;
  }
  return { document, content, element, mount };
}

test('Delivery capture ignores absent, outside and unrecognized focus owners', () => {
  const h = harness();
  assert.equal(captureDeliveryFocus(h.content), null);
  h.document.activeElement = null;
  assert.equal(captureDeliveryFocus(h.content), null);
  h.document.activeElement = h.element({ attributes: { 'data-delivery-field': 'intent' } });
  assert.equal(captureDeliveryFocus(h.content), null);
  const unknown = h.element({ selector: '.unrelated-control' });
  h.mount(unknown);
  h.document.activeElement = unknown;
  assert.equal(captureDeliveryFocus(h.content), null);
});

test('Delivery restores the verified record heading with programmatic tab index and no scroll', () => {
  const h = harness();
  const old = h.element({
    selector: '.delivery-record-detail > header h2',
    attributes: { tabindex: '-1' },
  });
  h.mount(old);
  h.document.activeElement = old;
  const snapshot = captureDeliveryFocus(h.content);
  const replacement = h.element({ selector: '.delivery-record-detail > header h2' });
  h.mount(replacement);
  assert.equal(restoreDeliveryFocus(h.content, snapshot), true);
  assert.equal(h.document.activeElement, replacement);
  assert.equal(replacement.getAttribute('tabindex'), '-1');
  assert.deepEqual(replacement.focusCalls, [{ preventScroll: true }]);
  assert.deepEqual(replacement.selectionCalls, []);
});

test('Delivery stable attribute keys select the exact item without interpolating its value into a selector', () => {
  for (const name of [
    'data-delivery-field',
    'data-delivery-record',
    'data-delivery-document',
    'data-visual-report',
  ]) {
    const h = harness();
    const key = 'item["with]quotes';
    const old = h.element({ attributes: { [name]: key } });
    h.mount(old);
    h.document.activeElement = old;
    const snapshot = captureDeliveryFocus(h.content);
    assert.equal(snapshot.selector, `[${name}]`);
    assert.equal(snapshot.value, key);
    const other = h.element({ attributes: { [name]: 'different' } });
    const replacement = h.element({ attributes: { [name]: key } });
    h.mount(other, replacement);
    assert.equal(restoreDeliveryFocus(h.content, snapshot), true);
    assert.equal(h.document.activeElement, replacement);
    assert.equal(other.focusCalls.length, 0);
  }
});

test('Delivery retains native input selection including backwards direction', () => {
  const h = harness();
  const old = h.element({ attributes: { 'data-delivery-field': 'questions' } });
  Object.assign(old, { selectionStart: 3, selectionEnd: 14, selectionDirection: 'backward' });
  h.mount(old);
  h.document.activeElement = old;
  const snapshot = captureDeliveryFocus(h.content);
  const replacement = h.element({ attributes: { 'data-delivery-field': 'questions' } });
  h.mount(replacement);
  assert.equal(restoreDeliveryFocus(h.content, snapshot), true);
  assert.deepEqual(replacement.selectionCalls, [[3, 14, 'backward']]);
});

test('Delivery defaults missing selection direction and skips selection for non-input controls', () => {
  const h = harness();
  const old = h.element({ attributes: { 'data-delivery-field': 'intent' } });
  Object.assign(old, { selectionStart: 0, selectionEnd: 0 });
  h.mount(old);
  h.document.activeElement = old;
  const snapshot = captureDeliveryFocus(h.content);
  const replacement = h.element({ attributes: { 'data-delivery-field': 'intent' } });
  h.mount(replacement);
  assert.equal(restoreDeliveryFocus(h.content, snapshot), true);
  assert.deepEqual(replacement.selectionCalls, [[0, 0, 'none']]);
  h.document.activeElement = replacement;
  const nextSnapshot = captureDeliveryFocus(h.content);
  const noSelectionApi = h.element({ attributes: { 'data-delivery-field': 'intent' } });
  delete noSelectionApi.setSelectionRange;
  h.mount(noSelectionApi);
  assert.equal(restoreDeliveryFocus(h.content, nextSnapshot), true);
});

test('Delivery recognizes disclosure summaries and local action controls by semantic selectors', () => {
  for (const selector of [
    '.foundry-delivery-notes > summary',
    '.foundry-delivery-context > summary',
    '.foundry-delivery-captures > summary',
    '.foundry-delivery-document-source > summary',
    '[data-next-save-narrative]',
    '[data-next-reset-narrative]',
    '#delivery-create-milestone',
  ]) {
    const h = harness();
    const old = h.element({ selector });
    h.mount(old);
    h.document.activeElement = old;
    const snapshot = captureDeliveryFocus(h.content);
    assert.equal(snapshot.selector, selector);
    const replacement = h.element({ selector });
    h.mount(replacement);
    assert.equal(restoreDeliveryFocus(h.content, snapshot), true);
    assert.equal(h.document.activeElement, replacement);
  }
});

test('Delivery refuses missing or ambiguous targets rather than focusing another item', () => {
  for (const count of [0, 2]) {
    const h = harness();
    const old = h.element({ attributes: { 'data-delivery-record': 'exact' } });
    h.mount(old);
    h.document.activeElement = old;
    const snapshot = captureDeliveryFocus(h.content);
    const other = h.element({ attributes: { 'data-delivery-record': 'other' } });
    const matches = Array.from({ length: count }, () =>
      h.element({ attributes: { 'data-delivery-record': 'exact' } }),
    );
    h.mount(other, ...matches);
    assert.equal(restoreDeliveryFocus(h.content, snapshot), false);
    assert.equal(h.document.activeElement, h.document.body);
    assert.ok([other, ...matches].every((item) => item.focusCalls.length === 0));
  }
});

test('Delivery refuses disabled, hidden, inert or non-rendered replacement controls', () => {
  for (const properties of [
    { disabled: true },
    { hidden: true },
    { inert: true },
    { visible: false },
  ]) {
    const h = harness();
    const old = h.element({ selector: '.foundry-delivery-notes > summary' });
    h.mount(old);
    h.document.activeElement = old;
    const snapshot = captureDeliveryFocus(h.content);
    const replacement = h.element({ selector: '.foundry-delivery-notes > summary', ...properties });
    h.mount(replacement);
    assert.equal(restoreDeliveryFocus(h.content, snapshot), false);
    assert.equal(replacement.focusCalls.length, 0);
    assert.equal(h.document.activeElement, h.document.body);
  }
});

test('Delivery never steals focus from a new outside or inside control', () => {
  for (const inside of [false, true]) {
    const h = harness();
    const old = h.element({ selector: '.delivery-record-detail > header h2' });
    h.mount(old);
    h.document.activeElement = old;
    const snapshot = captureDeliveryFocus(h.content);
    const replacement = h.element({ selector: '.delivery-record-detail > header h2' });
    const newOwner = h.element({ attributes: { 'data-delivery-record': 'another' } });
    h.mount(replacement, ...(inside ? [newOwner] : []));
    h.document.activeElement = newOwner;
    assert.equal(restoreDeliveryFocus(h.content, snapshot), false);
    assert.equal(h.document.activeElement, newOwner);
    assert.equal(replacement.focusCalls.length, 0);
  }
});

test('Delivery does not repeat focus when the captured node is still connected or no capture exists', () => {
  const h = harness();
  const old = h.element({ selector: '.delivery-record-detail > header h2' });
  h.mount(old);
  h.document.activeElement = old;
  const snapshot = captureDeliveryFocus(h.content);
  h.document.activeElement = h.document.body;
  assert.equal(restoreDeliveryFocus(h.content, snapshot), false);
  assert.equal(restoreDeliveryFocus(h.content, null), false);
  assert.equal(old.focusCalls.length, 0);
  assert.equal(h.document.activeElement, h.document.body);
});

test('Delivery reports unsuccessful native focus without claiming restoration', () => {
  const h = harness();
  const old = h.element({ selector: '.delivery-record-detail > header h2' });
  h.mount(old);
  h.document.activeElement = old;
  const snapshot = captureDeliveryFocus(h.content);
  const replacement = h.element({
    selector: '.delivery-record-detail > header h2',
    focusable: false,
  });
  h.mount(replacement);
  assert.equal(restoreDeliveryFocus(h.content, snapshot), false);
  assert.equal(h.document.activeElement, h.document.body);
});

const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const connectionSource = appSource.slice(
  appSource.indexOf('function renderConnectionStatus()'),
  appSource.indexOf(
    '\nasync function api(',
    appSource.indexOf('function renderConnectionStatus()'),
  ),
);
function connectionHarness({ pilot = true, mode = 'delivery' } = {}) {
  const status = { dataset: { status: 'live' }, title: '' };
  const label = { textContent: '' };
  let renderedConnected = true;
  const calls = [];
  const context = {
    $: (selector) => (selector === '#live-status' ? status : selector === 'span' ? label : null),
    syncPilotHeartbeatRecovery() {},
    nextWorkspace: null,
    bridgeConnected: true,
    runtimeConnected: true,
    activeAgentPresence: { connected: true },
    previewUrl: 'http://127.0.0.1:1',
    lastSessionLoadError: '',
    pilotConnectionHeadline: (headline) => headline,
    readinessUI: null,
    params: new URLSearchParams('ui=next'),
    activeMode: mode,
    nextDesignMemory: null,
    foundryPilotActive: () => pilot,
    nextDelivery: {
      needsConnectionRender(value) {
        calls.push({ kind: 'compare', value });
        return renderedConnected !== value;
      },
    },
    renderDelivery() {
      calls.push({ kind: 'render', value: context.runtimeConnected });
      renderedConnected = context.runtimeConnected;
    },
    renderComponentWorkshop() {},
    renderMemory() {},
  };
  runInNewContext(connectionSource, context);
  return { context, calls, status };
}

test('pilot skips unchanged connection renders but responds to actual runtime changes beneath a live preview', () => {
  const h = connectionHarness();
  for (let poll = 0; poll < 3; poll += 1) h.context.renderConnectionStatus();
  assert.equal(h.calls.filter((item) => item.kind === 'render').length, 0);
  h.context.runtimeConnected = false;
  h.context.renderConnectionStatus();
  assert.equal(
    h.status.dataset.status,
    'live',
    'preview headline is not the runtime-availability signal',
  );
  assert.deepEqual(
    h.calls.filter((item) => item.kind === 'render'),
    [{ kind: 'render', value: false }],
  );
  h.context.renderConnectionStatus();
  assert.equal(h.calls.filter((item) => item.kind === 'render').length, 1);
  h.context.runtimeConnected = true;
  h.context.renderConnectionStatus();
  assert.deepEqual(
    h.calls.filter((item) => item.kind === 'render'),
    [
      { kind: 'render', value: false },
      { kind: 'render', value: true },
    ],
  );
});

test('pilot does not rerender Delivery for agent presence alone or while another view is active', () => {
  const h = connectionHarness();
  h.context.activeAgentPresence.connected = false;
  h.context.renderConnectionStatus();
  assert.equal(h.calls.filter((item) => item.kind === 'render').length, 0);
  h.context.activeMode = 'canvas';
  h.context.runtimeConnected = false;
  const before = h.calls.length;
  h.context.renderConnectionStatus();
  assert.equal(h.calls.length, before);
});

test('gate-off connection refresh keeps the existing unconditional Delivery render', () => {
  const h = connectionHarness({ pilot: false });
  h.context.renderConnectionStatus();
  h.context.renderConnectionStatus();
  assert.equal(h.calls.filter((item) => item.kind === 'render').length, 2);
  assert.equal(h.calls.filter((item) => item.kind === 'compare').length, 0);
});
