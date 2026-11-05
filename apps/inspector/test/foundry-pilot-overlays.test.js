import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { feedbackDuration } from '../public/foundry-pilot-overlays.js';

const file = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
const helper = file('foundry-pilot-overlays.js'),
  app = file('app.js');
const fixture = readFileSync(
  new URL('../../../scripts/test-foundry-overlays-pilot-fixture.mjs', import.meta.url),
  'utf8',
);

function feedbackHarness({ pilot = true, next = true } = {}) {
  let document,
    nextTimer = 0;
  const timers = new Map();
  class Element {
    constructor(tag = 'div', id = '') {
      this.tag = tag;
      this.id = id;
      this.dataset = {};
      this.parentElement = null;
      this.children = [];
      this.listeners = new Map();
      this.attributes = new Map();
      this.isConnected = true;
      this.inert = false;
      this.hidden = false;
      this.disabled = false;
      this.open = false;
      this.hovered = false;
      this.tabIndex = ['button', 'input'].includes(tag) ? 0 : -1;
      this.textContent = '';
      const classes = new Set();
      this.classList = {
        add: (...values) => values.forEach((value) => classes.add(value)),
        remove: (value) => classes.delete(value),
        contains: (value) => classes.has(value),
      };
    }
    set innerHTML(value) {
      this.children = [];
      if (value.includes('foundry-feedback-message')) {
        const message = new Element('span');
        message.className = 'foundry-feedback-message';
        message.attributes.set('role', 'status');
        message.attributes.set('aria-atomic', 'true');
        this.append(message, new Element('button'));
      }
    }
    append(...nodes) {
      for (const node of nodes) {
        if (node.parentElement)
          node.parentElement.children = node.parentElement.children.filter((item) => item !== node);
        node.parentElement = this;
        this.children.push(node);
      }
    }
    querySelector(selector) {
      const match = (node) =>
        selector === 'button'
          ? node.tag === 'button'
          : selector === '#toast'
            ? node.id === 'toast'
            : selector === '.foundry-feedback-message'
              ? node.className === 'foundry-feedback-message'
              : false;
      for (const child of this.children) {
        if (match(child)) return child;
        const nested = child.querySelector(selector);
        if (nested) return nested;
      }
      return null;
    }
    contains(node) {
      return this === node || this.children.some((child) => child.contains(node));
    }
    closest(selector) {
      for (let current = this; current; current = current.parentElement) {
        if (selector === 'dialog[open]' && current.tag === 'dialog' && current.open) return current;
        if (selector.includes('[hidden]') && (current.hidden || current.inert)) return current;
      }
      return null;
    }
    matches(selector) {
      return selector === ':hover'
        ? this.hovered
        : selector === ':disabled'
          ? this.disabled
          : false;
    }
    getClientRects() {
      return this.isConnected && !this.hidden ? [{}] : [];
    }
    removeAttribute(name) {
      this.attributes.delete(name);
    }
    addEventListener(type, handler) {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(handler);
      this.listeners.set(type, listeners);
    }
    fire(type) {
      for (const handler of this.listeners.get(type) ?? []) handler({ target: this });
    }
    focus() {
      document.activeElement = this;
    }
  }
  const body = new Element('body'),
    toast = new Element('div', 'toast'),
    opener = new Element('button', 'delivery-create-milestone'),
    menu = new Element('button', 'workspace-menu-trigger'),
    trigger = new Element('button', 'command-trigger'),
    input = new Element('input', 'delivery-milestone-name');
  const modal = new Element('dialog', 'delivery-milestone-dialog');
  modal.append(input);
  body.append(opener, menu, trigger, modal, toast);
  const nodes = new Map([
    [opener.id, opener],
    [menu.id, menu],
    [trigger.id, trigger],
    [toast.id, toast],
  ]);
  document = {
    body,
    activeElement: opener,
    documentElement: { dataset: pilot ? { foundryPilot: 'delivery' } : {} },
    querySelector: (selector) =>
      selector === '#app-shell'
        ? { dataset: { next: String(next) } }
        : (nodes.get(selector.slice(1)) ?? null),
    querySelectorAll: () => [modal],
  };
  const context = {
    document,
    HTMLElement: Element,
    getComputedStyle: (node) => ({ visibility: node.hidden ? 'hidden' : 'visible' }),
    foundryPilotIcon: () => '<svg></svg>',
    setTimeout: (callback, delay) => {
      const id = ++nextTimer;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const source = helper.replace(/^import[^\n]*\n/, '').replace(/^export\s+/gm, '');
  const api = runInNewContext(
    source + ';({showPilotFeedback,mountPilotOverlays,restorePilotDialogFocus});',
    context,
  );
  return {
    api,
    document,
    toast,
    modal,
    input,
    opener,
    menu,
    trigger,
    timers,
    Element,
    expire: () => {
      const [id, timer] = [...timers][0];
      timers.delete(id);
      timer.callback();
    },
  };
}

test('feedback dwell is readable and bounded for short and long messages', () => {
  assert.equal(feedbackDuration('Saved'), 6000);
  assert.equal(feedbackDuration('a'.repeat(100)), 6500);
  assert.equal(feedbackDuration('a'.repeat(1000)), 12000);
  assert.equal(feedbackDuration(null), 6000);
});

test('regular feedback preserves literal text, replaces stale timers and becomes inert on expiry', () => {
  const { api, toast, timers, expire } = feedbackHarness();
  assert.equal(api.showPilotFeedback('<script>not markup</script>', toast), true);
  assert.equal(
    toast.querySelector('.foundry-feedback-message').textContent,
    '<script>not markup</script>',
  );
  assert.equal(toast.classList.contains('is-visible'), true);
  assert.equal(toast.inert, false);
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].delay, 6000);
  api.showPilotFeedback('a'.repeat(100), toast);
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].delay, 6500);
  expire();
  assert.equal(toast.classList.contains('is-visible'), false);
  assert.equal(toast.inert, true);
  assert.equal(timers.size, 0);
});

test('hover and focus pause feedback dismissal; leaving restarts its readable dwell', () => {
  const { api, toast, timers, document, opener } = feedbackHarness();
  api.showPilotFeedback('Saved', toast);
  toast.hovered = true;
  toast.fire('mouseenter');
  assert.equal(timers.size, 0);
  toast.hovered = false;
  toast.fire('mouseleave');
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].delay, 6000);
  document.activeElement = toast.querySelector('button');
  toast.fire('focusin');
  assert.equal(timers.size, 0);
  document.activeElement = opener;
  toast.fire('focusout');
  assert.equal(timers.size, 1);
});

test('dismissing focused feedback restores its initiating control and keeps the hidden notice inert', () => {
  const { api, toast, document, opener, timers } = feedbackHarness();
  api.showPilotFeedback('Saved', toast);
  const dismiss = toast.querySelector('button');
  dismiss.focus();
  dismiss.fire('click');
  assert.equal(document.activeElement, opener);
  assert.equal(toast.inert, true);
  assert.equal(toast.classList.contains('is-visible'), false);
  assert.equal(timers.size, 0);
});

test('modal feedback is sticky in the native top layer and closing returns it to body', () => {
  const { api, toast, modal, input, document, timers, opener } = feedbackHarness();
  api.mountPilotOverlays();
  api.mountPilotOverlays();
  assert.equal(modal.listeners.get('close').length, 1);
  modal.open = true;
  input.focus();
  api.showPilotFeedback('Name could not be saved.', toast);
  assert.equal(toast.parentElement, modal);
  assert.equal(timers.size, 0);
  assert.equal(toast.inert, false);
  toast.fire('mouseleave');
  assert.equal(timers.size, 0);
  modal.open = false;
  modal.fire('close');
  assert.equal(toast.parentElement, document.body);
  assert.equal(toast.inert, true);
  assert.equal(toast.classList.contains('is-visible'), false);
  assert.equal(document.activeElement, opener);
});

test('focus restoration rejects hidden, disabled, detached and nonfocusable openers', () => {
  const { api, document, menu, opener, Element } = feedbackHarness();
  for (const preferred of [
    document.body,
    Object.assign(new Element('button'), { hidden: true }),
    Object.assign(new Element('button'), { disabled: true }),
    Object.assign(new Element('button'), { isConnected: false }),
  ]) {
    assert.equal(api.restorePilotDialogFocus(preferred), true);
    assert.equal(document.activeElement, menu);
  }
  assert.equal(api.restorePilotDialogFocus(opener), true);
  assert.equal(document.activeElement, opener);
});

test('gate off or non-Next shell leaves feedback and focus under existing application ownership', () => {
  for (const options of [{ pilot: false }, { next: false }]) {
    const { api, toast, timers, document, opener, modal } = feedbackHarness(options);
    assert.equal(api.showPilotFeedback('Original notice', toast), false);
    assert.equal(api.restorePilotDialogFocus(document.body), false);
    api.mountPilotOverlays();
    assert.equal(toast.children.length, 0);
    assert.equal(timers.size, 0);
    assert.equal(document.activeElement, opener);
    assert.equal(modal.listeners.has('close'), false);
  }
});

function milestoneHarness({
  failed = false,
  held = false,
  history = [{ id: 'one' }, { id: 'two' }],
} = {}) {
  let action, release;
  const events = [],
    field = { value: '  Milestone name  ' };
  const context = {
    $: (selector) =>
      selector === '#delivery-milestone-name'
        ? field
        : {
            addEventListener: (_, handler) => {
              action = handler;
            },
          },
    activeSession: { designHistory: history },
    sessionId: 'synthetic-overlay-fixture',
    milestoneDialog: { close: () => events.push({ type: 'close' }) },
    api: async (url, options) => {
      events.push({ type: 'api', url, body: JSON.parse(options.body) });
      if (held)
        await new Promise((resolve) => {
          release = resolve;
        });
      if (failed) throw Error('Not acknowledged');
      return { deliveryMilestones: [{ id: 'created' }] };
    },
    renderSession: (session) => events.push({ type: 'render', session }),
    toast: (message) => events.push({ type: 'feedback', message }),
  };
  const start = app.indexOf("$('#delivery-milestone-form')?.addEventListener"),
    end = app.indexOf("$('#delivery-export')?.addEventListener", start);
  assert.ok(start >= 0 && end > start);
  runInNewContext(app.slice(start, end), context);
  return { action: () => action({ preventDefault() {} }), events, field, release: () => release() };
}

test('real milestone submission preserves failed drafts and closes only after an acknowledged payload', async () => {
  const failed = milestoneHarness({ failed: true });
  await failed.action();
  assert.equal(failed.field.value, '  Milestone name  ');
  assert.equal(
    failed.events.some((item) => item.type === 'close' || item.type === 'render'),
    false,
  );
  assert.equal(failed.events.at(-1).message, 'Not acknowledged');
  const pending = milestoneHarness({ held: true });
  const operation = pending.action();
  assert.equal(pending.events.length, 1);
  assert.deepEqual(pending.events[0].body, { name: 'Milestone name', entryIds: ['one', 'two'] });
  pending.release();
  await operation;
  assert.deepEqual(
    pending.events.map((item) => item.type),
    ['api', 'render', 'close', 'feedback'],
  );
  assert.equal(pending.events.at(-1).message, 'Milestone created.');
});

test('real milestone submission cannot create a group without verified history or a name', async () => {
  const noHistory = milestoneHarness({ history: [] });
  await noHistory.action();
  assert.equal(noHistory.events.length, 0);
  const noName = milestoneHarness();
  noName.field.value = ' ';
  await noName.action();
  assert.equal(noName.events.length, 0);
});

test('overlay fixture uses actual dialogs and handlers with synthetic navigation and loopback only', () => {
  for (const marker of [
    'const commands = [',
    'const dockResizer =',
    'function toast(',
    'function renderConnectionStatus(',
    "const milestoneDialog = $('#delivery-milestone-dialog');",
    "$('#delivery-create-milestone', root)?.addEventListener",
  ])
    assert.ok(fixture.includes(marker), marker);
  assert.match(fixture, /const\s+stylesheets\s*=\s*\[\s*\.\.\.index.matchAll/);
  assert.match(fixture, /FOUNDRY_OVERLAYS_FIXTURE_PORT\s*\?\?\s*0/);
  assert.match(fixture, /\.listen\(\s*port,\s*'127\.0\.0\.1'/);
  assert.doesNotMatch(
    fixture,
    /fetch\(|sessionStorage|localStorage|chromium\.launch|__foundry_session|__foundry_token/,
  );
});

test('palette fixtures preserve native modality and guard composition, modifiers and empty results', () => {
  for (const label of [
    'Native modal prevents focus from escaping into the covered workspace',
    'Search retains native Home editing semantics',
    'Composition or modifier guard prevents command execution',
    'Enter with no results performs no navigation',
    'Search stays vertically anchored when the result list shrinks',
    'Successful milestone close focuses the replacement opener rather than a detached node',
    'Hidden regular feedback is unfocusable and restores its initiating control',
  ])
    assert.ok(fixture.includes(label), label);
  assert.match(helper, /event.isComposing/);
  assert.match(helper, /event.keyCode\s*===\s*229/);
  assert.match(
    helper,
    /event.altKey\s*\|\|\s*event.metaKey\s*\|\|\s*event.ctrlKey\s*\|\|\s*event.shiftKey/,
  );
  assert.doesNotMatch(helper, /fetch\(|requestCommand\(|postMessage\(|\.showModal\(|\.close\(/);
});
