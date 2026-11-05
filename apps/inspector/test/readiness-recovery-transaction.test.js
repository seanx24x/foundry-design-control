import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../public/readiness-ui.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from '\.\/workflow\.js';\n/, '')
  .replace(/^import[\s\S]*?from '\.\/foundry-pilot-readiness\.js';\n/, '')
  .replace('export function createReadinessUI', 'function createReadinessUI');
const settle = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

function harness({ pilot = true } = {}) {
  class Element {
    dataset = {};
    children = new Map();
    listeners = new Map();
    attributes = new Map();
    buttons = [];
    disabled = false;
    hidden = true;
    isConnected = true;
    open = false;
    textContent = '';
    addEventListener(name, callback) {
      this.listeners.set(name, callback);
    }
    setAttribute(name, value) {
      this.attributes.set(name, value);
    }
    removeAttribute(name) {
      this.attributes.delete(name);
    }
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }
    set innerHTML(value) {
      this.markup = value;
      for (const button of this.buttons) button.isConnected = false;
      this.buttons = [...value.matchAll(/data-readiness-recovery="([^"]+)"/g)].map((match) => {
        const button = new Element();
        button.dataset.readinessRecovery = match[1];
        return button;
      });
    }
    get innerHTML() {
      return this.markup;
    }
    querySelector(selector) {
      const id = selector.match(/data-readiness-recovery="([^"]+)"/)?.[1];
      if (id) return this.buttons.find((button) => button.dataset.readinessRecovery === id) ?? null;
      if (!this.children.has(selector)) this.children.set(selector, new Element());
      return this.children.get(selector);
    }
    querySelectorAll() {
      return this.buttons;
    }
    closest(selector) {
      return selector === '[data-readiness-recovery]' ? this : select('.readiness-body');
    }
    focus() {
      document.activeElement = this;
    }
    scrollIntoView() {}
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
      this.listeners.get('close')?.();
    }
  }
  const elements = new Map();
  const select = (selector) => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  const document = { querySelector: select, querySelectorAll: () => [], activeElement: null };
  const timers = new Map();
  const context = {
    document,
    window: new Element(),
    Error,
    AbortSignal,
    queueMicrotask,
    CSS: { escape: (value) => value },
    setInterval: (callback) => {
      timers.set(1, callback);
      return 1;
    },
    clearInterval: (id) => timers.delete(id),
    pilotReadinessActive: () => pilot,
    refinePilotReadiness() {},
    rememberPilotRecovery() {},
    workflowStep: () => ({
      phase: 'Connect',
      label: 'Check connection',
      detail: 'Connect the preview.',
      step: 0,
      action: 'readiness',
    }),
  };
  runInNewContext(source + '\nthis.createReadinessUI = createReadinessUI;', context);
  let report = {
    ready: false,
    checks: [
      {
        id: 'preview',
        status: 'failed',
        label: 'Preview',
        detail: 'Not connected',
        recovery: { id: 'reconnect-preview', label: 'Reconnect preview' },
      },
      {
        id: 'source',
        status: 'warning',
        label: 'Source',
        detail: 'Index missing',
        recovery: { id: 'reindex-project', label: 'Re-index project' },
      },
    ],
  };
  let action = deferred();
  const calls = [],
    reads = [];
  const ui = context.createReadinessUI({
    api: async (url) => {
      reads.push(url);
      return structuredClone(report);
    },
    sessionId: 'synthetic-recovery',
    state: () => ({
      previewConnected: false,
      listenerConnected: false,
      session: { changeSet: { changes: [{ status: 'draft' }] } },
    }),
    navigate() {},
    renderIcons() {},
    recover: (id) => {
      calls.push(id);
      return action.promise;
    },
  });
  const checks = select('#readiness-checks');
  return {
    ui,
    select,
    checks,
    calls,
    reads,
    timers,
    get report() {
      return report;
    },
    get action() {
      return action;
    },
    newAction() {
      action = deferred();
      return action;
    },
    button(id = 'preview') {
      return checks.buttons.find((button) => button.dataset.readinessRecovery === id);
    },
    click(button) {
      return checks.listeners.get('click')({ target: button });
    },
  };
}

test('pilot recovery lock survives check replacement and guards every recovery action', async () => {
  const h = harness();
  await h.ui.open();
  const original = h.button();
  const pending = h.click(original);
  assert.deepEqual(h.calls, ['reconnect-preview']);
  assert.equal(original.disabled, true);
  assert.equal(h.button('source').disabled, true);
  h.report.checks[0].detail = 'New polling result';
  await h.ui.load({ background: true });
  assert.notEqual(h.button(), original);
  assert.equal(original.isConnected, false);
  assert.equal(h.button().disabled, true);
  assert.equal(h.button().getAttribute('aria-busy'), 'true');
  assert.equal(h.button('source').disabled, true);
  await h.click(h.button());
  await h.click(h.button('source'));
  assert.deepEqual(
    h.calls,
    ['reconnect-preview'],
    'delegation guard works even if a disabled click is dispatched',
  );
  h.action.resolve();
  await pending;
  assert.equal(h.button().disabled, false);
  assert.equal(h.button('source').disabled, false);
  assert.equal(h.button().getAttribute('aria-busy'), null);
  assert.equal(h.select('#persistent-review-count').textContent, '1');
});

test('closing and reopening does not abandon or duplicate a pending recovery', async () => {
  const h = harness();
  await h.ui.open();
  const pending = h.click(h.button());
  h.select('#readiness-dialog').close();
  assert.equal(h.timers.size, 0);
  h.report.checks[0].detail = 'Changed while closed';
  await h.ui.open();
  assert.equal(h.button().disabled, true);
  await h.click(h.button('source'));
  assert.equal(h.calls.length, 1);
  h.action.resolve();
  await pending;
  h.newAction();
  const second = h.click(h.button('source'));
  assert.deepEqual(h.calls, ['reconnect-preview', 'reindex-project']);
  h.action.resolve();
  await second;
  assert.equal(h.button().disabled, false);
});

test('rejection releases the lock, preserves failure and allows a deliberate later retry', async () => {
  const h = harness();
  await h.ui.open();
  const pending = h.click(h.button());
  h.report.checks[0].detail = 'Changed during recovery';
  await h.ui.load({ background: true });
  h.action.reject(new Error('Recovery failed <literally>'));
  await pending;
  assert.match(h.checks.innerHTML, /Recovery failed &lt;literally&gt;/);
  assert.equal(h.select('#readiness-dialog').open, true);
  assert.equal(h.select('#persistent-review-count').textContent, '1');
  await h.ui.load();
  assert.equal(h.button().disabled, false);
  h.newAction();
  const retry = h.click(h.button());
  assert.equal(h.calls.length, 2);
  await settle();
  assert.doesNotMatch(h.checks.innerHTML, /Recovery failed/);
  h.action.resolve();
  await retry;
});

test('command-only instructions do not take a transaction lock or invoke recovery', async () => {
  const h = harness();
  h.report.checks[1].recovery = {
    id: 'configure-agent',
    label: 'Show instructions',
    command: 'npx foundry listen',
  };
  await h.ui.open();
  await h.click(h.button('source'));
  assert.equal(h.calls.length, 0);
  assert.equal(h.select('#readiness-command').hidden, false);
  assert.equal(h.button('source').disabled, false);
  const pending = h.click(h.button());
  await h.click(h.button('source'));
  assert.deepEqual(h.calls, ['reconnect-preview']);
  h.action.resolve();
  await pending;
});

test('gate-off keeps the existing button-local recovery behavior', async () => {
  const h = harness({ pilot: false });
  await h.ui.open();
  const original = h.button();
  const pending = h.click(original);
  assert.equal(original.disabled, true);
  assert.equal(h.button('source').disabled, false);
  h.report.checks[0].detail = 'Original report replacement behavior';
  await h.ui.load({ background: true });
  assert.equal(h.button().disabled, false);
  assert.equal(h.button().getAttribute('aria-busy'), null);
  h.action.resolve();
  await pending;
});
