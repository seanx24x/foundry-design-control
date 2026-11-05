import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const edits = readFileSync(new URL('../public/review-edit-state.js', import.meta.url), 'utf8');
function slice(start, end) {
  const first = app.indexOf(start),
    last = app.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, start);
  return app.slice(first, last);
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const settle = () => new Promise((resolve) => setImmediate(resolve));
const change = (id, status = 'approved') => ({
  id,
  status,
  property: 'fontSize',
  after: 80,
  confidence: 'source-mapped',
});
const session = () => ({
  changeSet: {
    id: 'same-batch',
    context: { projectRoot: '/synthetic/project', revision: 'source-one' },
    changes: [change('first'), change('second', 'rejected')],
    operations: [],
  },
  activeDesignBranchId: null,
});

// Real transaction, status reconciliation, loadSession and Apply handler. Only
// DOM render output and network replies are modeled; no live transport exists.
function transactionHarness({ pilot = true } = {}) {
  const patch = deferred(),
    reads = [],
    calls = [],
    document = { createElement: () => element() };
  const element = (dataset = {}) => ({
    dataset,
    disabled: false,
    checked: false,
    attributes: new Map(),
    isConnected: true,
    setAttribute(name, value) {
      this.attributes.set(name, value);
    },
    removeAttribute(name) {
      this.attributes.delete(name);
      if (name === 'data-foundry-dirty') delete this.dataset.foundryDirty;
    },
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    },
    closest() {
      return this.row;
    },
    addEventListener(name, callback) {
      this[name] = callback;
    },
  });
  const apply = element(),
    error = { hidden: true, textContent: '' };
  let inputs = [],
    deletes = [],
    action;
  apply.addEventListener = (name, callback) => {
    if (name === 'click') action = callback;
  };
  const context = {
    Error,
    Promise,
    document,
    CSS: { escape: (value) => value },
    foundryPilotActive: () => pilot,
    activeSession: session(),
    activeAgentPresence: { connected: true },
    activeMode: 'review',
    sessionId: 'synthetic-review',
    token: 'fixture-only',
    latestSessionRequest: 7,
    pendingSessionRender: {
      payload: session(),
      presence: {},
      snapshot: 'older-render',
    },
    sessionPollInFlight: false,
    runtimeConnected: true,
    lastSessionLoadError: '',
    nextVisualAgent: null,
    lastRenderedSessionSnapshot: '',
    sessionRenderSnapshot: (payload) => JSON.stringify(payload),
    sessionRenderBlocked: () => false,
    captureDirtyDrafts: () => [],
    restoreDirtyDrafts() {},
    captureWorkspaceScroll: () => ({}),
    restoreWorkspaceScroll() {},
    dismissedApplyRunId: null,
    reviewMappingIssue: (item) => (item.confidence === 'unresolved' ? 'Mapping needed' : null),
    applyRunActionPending: null,
    applyRunActionError: null,
    $: (selector) => {
      if (selector === '#apply-agent') return apply;
      if (selector === '#review-apply-error') return error;
      return (
        inputs.find((input) => selector === `[data-change-id="${input.dataset.changeId}"]`) ?? null
      );
    },
    $$: (selector) =>
      selector === '[data-change-id]' ? inputs : selector === '[data-delete-change]' ? deletes : [],
    toast: (message) => calls.push({ type: 'toast', message }),
    renderConnectionStatus: () => calls.push({ type: 'connection' }),
    renderReview: () => {
      calls.push({ type: 'review' });
      inputs.forEach((input) => {
        input.isConnected = false;
      });
      inputs = context.activeSession.changeSet.changes
        .filter((item) => item.status !== 'applied')
        .map((item) => {
          const input = element({ changeId: item.id });
          input.disabled = Boolean(context.reviewMappingIssue(item));
          input.checked = item.status === 'approved' && !input.disabled;
          input.row = {
            messages: [],
            append(message) {
              this.messages.push(message);
            },
          };
          return input;
        });
      deletes = inputs.map((input) => element({ deleteChange: input.dataset.changeId }));
      apply.disabled =
        !context.activeSession.changeSet.changes.some(
          (item) => item.status === 'approved' && !context.reviewMappingIssue(item),
        ) || context.actions?.blocked();
      context.actions?.renderStatus();
      context.actions?.bindDelete();
    },
    renderSession: (payload) => {
      calls.push({ type: 'session', payload });
      context.activeSession = payload;
      context.renderReview();
    },
    commitLoadedSession: (payload) => {
      calls.push({ type: 'commit', payload });
      context.renderSession(payload);
    },
    requestCommand: async (command, payload) => {
      calls.push({ type: 'command', command, payload });
      return structuredClone(context.activeSession);
    },
    api: async (url, options = {}) => {
      calls.push({
        type: 'api',
        url,
        method: options.method ?? 'GET',
        body: options.body ? JSON.parse(options.body) : null,
      });
      if (options.method === 'PATCH') return patch.promise;
      if (url.endsWith('/agent-presence')) return { connected: true };
      if (options.method === 'POST') throw Error('Unexpected Apply request');
      const read = deferred();
      reads.push(read);
      return read.promise;
    },
  };
  const source =
    slice('let reviewStatusPending = null;', 'function changeContextSet(') +
    slice('function commitLoadedSession(', 'function flushPendingSessionRender()') +
    slice('async function loadSession(', '// A heartbeat failure') +
    slice("$('#apply-agent').addEventListener('click'", 'async function revealStressSelection(') +
    '\nfunction bindDelete(){' +
    slice("$$('[data-delete-change]').forEach", "$$('[data-preview-change]').forEach") +
    '}\n' +
    '\nthis.actions={setStatus,loadSession,bindDelete,renderStatus:renderReviewStatus,blocked:reviewStatusBlocked,contextKey:reviewContextKey,pending:()=>reviewStatusPending,error:()=>reviewStatusError};';
  runInNewContext(source, context);
  const commit = context.commitLoadedSession;
  context.commitLoadedSession = (...args) => {
    calls.push({ type: 'commit', payload: args[0] });
    return commit(...args);
  };
  context.renderReview();
  const acknowledge = (id, status, extra = {}) => {
    const payload = structuredClone(context.activeSession);
    payload.changeSet.changes.find((item) => item.id === id).status = status;
    Object.assign(payload, extra);
    patch.resolve(payload);
    return payload;
  };
  return {
    context,
    calls,
    patch,
    reads,
    apply,
    error,
    document,
    acknowledge,
    action: (...args) => action(...args),
    input: (id) => inputs.find((input) => input.dataset.changeId === id),
    deletes: () => deletes,
  };
}

test('pilot inclusion uses exact original PATCH, confirmed state and a global pending guard', async () => {
  const h = transactionHarness(),
    original = h.context.activeSession,
    before = JSON.stringify(original);
  h.input('first').checked = false;
  h.input('first').dataset.foundryDirty = 'true';
  const pending = h.context.actions.setStatus('first', 'rejected');
  assert.equal(h.context.actions.pending().changeId, 'first');
  assert.equal(h.context.latestSessionRequest, 8);
  assert.equal(h.context.pendingSessionRender, null);
  assert.equal(h.input('first').checked, true);
  assert.equal(h.input('first').dataset.foundryDirty, undefined);
  assert.equal(h.input('first').getAttribute('aria-busy'), 'true');
  assert.equal(h.input('second').getAttribute('aria-disabled'), 'true');
  assert.equal(h.input('first').disabled, false, 'pending inclusion stays focusable');
  assert.ok(h.deletes().every((button) => button.disabled));
  assert.equal(h.apply.disabled, true);
  await h.context.actions.setStatus('second', 'approved');
  await h.action();
  await h.deletes()[0].click();
  assert.equal(h.calls.filter((call) => call.type === 'api').length, 1);
  assert.equal(
    h.calls.some((call) => call.type === 'command'),
    false,
    'programmatic delete cannot bypass the global pending lock',
  );
  assert.deepEqual(
    h.calls.find((call) => call.type === 'api'),
    {
      type: 'api',
      url: '/v1/sessions/synthetic-review/changes/first',
      method: 'PATCH',
      body: { status: 'rejected' },
    },
  );
  assert.equal(JSON.stringify(original), before, 'pending UI never mutates canonical session');
  h.context.renderReview();
  assert.ok(h.context.actions.blocked(), 'lock survives checkbox replacement');
  assert.equal(h.input('first').checked, true);
  const updated = h.acknowledge('first', 'rejected');
  await pending;
  assert.equal(h.context.activeSession, updated);
  assert.equal(h.context.latestSessionRequest, 9);
  assert.equal(h.context.actions.pending(), null);
  assert.equal(h.input('first').checked, false);
  assert.equal(h.input('first').getAttribute('aria-busy'), null);
  assert.equal(h.context.actions.error(), null);
  assert.equal(
    h.calls.some((call) => call.type === 'api' && call.method === 'GET'),
    false,
    'acknowledged session does not need a redundant refresh',
  );
});

test('failed include and exclude reconcile the authoritative checkbox and permit explicit retry', async () => {
  for (const [id, target, confirmed] of [
    ['first', 'rejected', true],
    ['second', 'approved', false],
  ]) {
    const h = transactionHarness(),
      before = JSON.stringify(h.context.activeSession);
    const pending = h.context.actions.setStatus(id, target);
    h.patch.reject(Error('Synthetic PATCH disconnected'));
    await pending;
    assert.equal(h.input(id).checked, confirmed);
    assert.equal(JSON.stringify(h.context.activeSession), before);
    assert.equal(h.context.actions.blocked(), false);
    assert.equal(h.context.actions.pending(), null);
    assert.equal(h.input(id).row.messages.at(-1).getAttribute('role'), 'alert');
    assert.match(
      h.input(id).row.messages.at(-1).textContent,
      /not acknowledged.*Synthetic PATCH disconnected/,
    );
    assert.equal(
      h.calls.filter((call) => call.type === 'api').length,
      1,
      'no automatic retry or reload',
    );
  }
});

test('invalid acknowledgement is not treated as a saved inclusion change', async () => {
  const h = transactionHarness(),
    before = h.context.activeSession;
  const pending = h.context.actions.setStatus('first', 'rejected');
  h.patch.resolve(structuredClone(before));
  await pending;
  assert.equal(h.context.activeSession, before);
  assert.equal(h.input('first').checked, true);
  assert.match(h.context.actions.error().message, /did not confirm/);
});

test('an acknowledgement for a departed Review context cannot overwrite its successor', async () => {
  const h = transactionHarness(),
    old = structuredClone(h.context.activeSession);
  const pending = h.context.actions.setStatus('first', 'rejected');
  const next = structuredClone(h.context.activeSession);
  next.changeSet.context.revision = 'source-two';
  h.context.activeSession = next;
  old.changeSet.changes[0].status = 'rejected';
  h.patch.resolve(old);
  await pending;
  assert.equal(h.context.activeSession, next);
  assert.equal(h.context.actions.error(), null);
  assert.equal(h.context.actions.pending(), null);
  assert.equal(h.reads.length, 0);
});

test('concurrent canonical updates trigger a fresh read instead of consuming an older full PATCH snapshot', async () => {
  const h = transactionHarness(),
    acknowledged = structuredClone(h.context.activeSession);
  const pending = h.context.actions.setStatus('first', 'rejected');
  const newer = structuredClone(h.context.activeSession);
  newer.changeSet.changes[1].after = 96;
  h.context.activeSession = newer;
  acknowledged.changeSet.changes[0].status = 'rejected';
  h.patch.resolve(acknowledged);
  await settle();
  assert.equal(h.context.activeSession, newer);
  assert.equal(h.reads.length, 1);
  assert.equal(h.context.actions.blocked(), true);
  const fresh = structuredClone(newer);
  fresh.changeSet.changes[0].status = 'rejected';
  h.reads[0].resolve(fresh);
  await pending;
  assert.equal(h.context.activeSession, fresh);
  assert.equal(h.context.activeSession.changeSet.changes[1].after, 96);
  assert.equal(h.context.actions.error(), null);
});

test('PATCH acknowledgement followed by failed reconciliation pauses Apply without falsely claiming save failure', async () => {
  const h = transactionHarness(),
    acknowledged = structuredClone(h.context.activeSession);
  const pending = h.context.actions.setStatus('first', 'rejected');
  h.context.activeSession = structuredClone(h.context.activeSession);
  acknowledged.changeSet.changes[0].status = 'rejected';
  h.patch.resolve(acknowledged);
  await settle();
  h.reads[0].reject(Error('Synthetic refresh failed'));
  await pending;
  assert.equal(h.context.actions.pending(), null);
  assert.equal(h.context.actions.blocked(), true);
  assert.equal(h.apply.disabled, true);
  assert.ok(
    ['first', 'second'].every((id) => h.input(id).getAttribute('aria-disabled') === 'true'),
    'all inclusion controls expose the refresh-required lock',
  );
  assert.ok(
    h.deletes().every((button) => button.disabled),
    'Delete controls expose the same refresh-required lock as their handlers',
  );
  assert.equal(h.context.actions.error().needsRefresh, true);
  assert.match(
    h.context.actions.error().message,
    /Selection acknowledged, but Review could not refresh/,
  );
  assert.doesNotMatch(h.context.actions.error().message, /not acknowledged/);
  const fresh = structuredClone(acknowledged);
  fresh.changeSet.changes[1].status = 'approved';
  const recovery = h.context.actions.loadSession({ isPoll: true });
  await settle();
  h.reads[1].resolve(fresh);
  await recovery;
  assert.equal(
    h.context.actions.error(),
    null,
    'a fresh canonical session clears only the needs-refresh lock',
  );
  assert.equal(h.context.actions.blocked(), false);
  assert.equal(h.context.activeSession, fresh);
  assert.equal(h.apply.disabled, false);
});

test('pre-PATCH GET and deferred renders cannot revert its acknowledgement; polling skips pending transactions', async () => {
  const h = transactionHarness(),
    old = structuredClone(h.context.activeSession);
  const polling = h.context.actions.loadSession({
    isPoll: true,
    deferRender: true,
  });
  await settle();
  const pending = h.context.actions.setStatus('first', 'rejected');
  assert.equal(h.context.pendingSessionRender, null);
  const beforeSkipped = h.calls.length;
  const skipped = await h.context.actions.loadSession({
    isPoll: true,
    deferRender: true,
  });
  assert.equal(skipped.ok, false);
  assert.equal(h.calls.length, beforeSkipped);
  h.reads[0].resolve(old);
  const stale = await polling;
  assert.equal(stale.ok, false);
  assert.equal(
    h.calls.some((call) => call.type === 'commit'),
    false,
  );
  const acknowledged = h.acknowledge('first', 'rejected');
  await pending;
  assert.equal(h.context.activeSession, acknowledged);
  assert.equal(h.context.pendingSessionRender, null);
});

test('late pre-PATCH GET errors do not mark a newly acknowledged session disconnected', async () => {
  const h = transactionHarness();
  const polling = h.context.actions.loadSession({ isPoll: true });
  await settle();
  const pending = h.context.actions.setStatus('first', 'rejected');
  h.acknowledge('first', 'rejected');
  await pending;
  h.reads[0].reject(Error('Old failed read'));
  await polling;
  assert.equal(h.context.runtimeConnected, true);
  assert.equal(h.context.lastSessionLoadError, '');
  assert.equal(
    h.calls.some((call) => call.type === 'toast' && call.message === 'Old failed read'),
    false,
  );
});

test('gate off retains original PATCH then refresh path and failure propagation', async () => {
  const h = transactionHarness({ pilot: false });
  const pending = h.context.actions.setStatus('second', 'approved');
  assert.equal(h.context.actions.pending(), null);
  assert.equal(h.context.latestSessionRequest, 7);
  h.acknowledge('second', 'approved');
  await settle();
  assert.equal(h.reads.length, 1);
  h.reads[0].resolve(session());
  await pending;
  const failed = transactionHarness({ pilot: false });
  const rejected = failed.context.actions.setStatus('first', 'rejected');
  failed.patch.reject(Error('Baseline PATCH failure'));
  await assert.rejects(rejected, /Baseline PATCH failure/);
  assert.equal(failed.context.actions.error(), null);
});

function editHarness() {
  const document = { activeElement: null };
  const make = (
    id,
    baseline = '80px',
    identity = 'same-property',
    attribute = 'data-after-id',
  ) => ({
    dataset:
      attribute === 'data-after-id' ? { afterId: id, reviewIdentity: identity } : { changeId: id },
    value: baseline,
    defaultValue: baseline,
    checked: false,
    disabled: false,
    selectionStart: 0,
    selectionEnd: 0,
    selectionDirection: 'none',
    hasAttribute: (name) => name === attribute,
    getAttribute: (name) => (name === attribute ? id : null),
    closest() {
      return this;
    },
    focus() {
      document.activeElement = this;
    },
    setSelectionRange(start, end, direction) {
      this.selectionStart = start;
      this.selectionEnd = end;
      this.selectionDirection = direction;
    },
  });
  const root = {
    dataset: { reviewContext: 'same-context' },
    scrollTop: 0,
    scrollLeft: 0,
    fields: [],
    controls: [],
    inert: false,
    contains(node) {
      return this.fields.includes(node) || this.controls.includes(node);
    },
    querySelectorAll(selector) {
      return selector === '[data-after-id]'
        ? this.fields
        : this.controls.filter((control) => control.hasAttribute(selector.slice(1, -1)));
    },
    closest() {
      return this.inert ? this : null;
    },
  };
  const context = { document };
  runInNewContext(
    edits.replaceAll('export function ', 'function ') +
      '\nthis.actions={capture:captureReviewEditState,restore:restoreReviewEditState};',
    context,
  );
  return { root, document, make, ...context.actions };
}

test('requested-value drafts preserve exact raw text, current caret direction and scroll, never checkboxes', () => {
  const h = editHarness(),
    field = h.make('first'),
    checkbox = h.make('second', '', '', 'data-change-id');
  h.root.fields = [field];
  h.root.controls = [checkbox];
  field.value = '80.25px';
  field.focus();
  field.setSelectionRange(1, 5, 'backward');
  checkbox.checked = true;
  h.root.scrollTop = 94;
  h.root.scrollLeft = 8;
  const captured = h.capture(h.root, 'same-context');
  const replacement = h.make('first'),
    newCheckbox = h.make('second', '', '', 'data-change-id');
  h.root.fields = [replacement];
  h.root.controls = [newCheckbox];
  h.root.scrollTop = 0;
  h.restore(h.root, captured, 'same-context');
  assert.equal(replacement.value, '80.25px');
  assert.equal(replacement.defaultValue, '80px');
  assert.equal(replacement.dataset.foundryDirty, 'true');
  assert.equal(h.document.activeElement, replacement);
  assert.deepEqual(
    [replacement.selectionStart, replacement.selectionEnd, replacement.selectionDirection],
    [1, 5, 'backward'],
  );
  assert.equal(newCheckbox.checked, false);
  assert.equal(h.root.scrollTop, 94);
  assert.equal(h.root.scrollLeft, 8);
});

test('server baseline changes, different identities, removed rows and changed contexts reject stale drafts', () => {
  for (const kind of ['baseline', 'identity', 'removed', 'context']) {
    const h = editHarness(),
      old = h.make('first');
    h.root.fields = [old];
    old.value = '80.25px';
    const captured = h.capture(h.root, 'same-context');
    const replacement = h.make(
      'first',
      kind === 'baseline' ? '96px' : '80px',
      kind === 'identity' ? 'other-property' : 'same-property',
    );
    h.root.fields = kind === 'removed' ? [] : [replacement];
    h.restore(h.root, captured, kind === 'context' ? 'different-context' : 'same-context');
    assert.equal(replacement.value, replacement.defaultValue, kind);
    assert.equal(replacement.dataset.foundryDirty, undefined, kind);
  }
});

test('capture at render time retains newest typing and never steals external focus or focuses inert Review', () => {
  const h = editHarness(),
    field = h.make('first');
  h.root.fields = [field];
  field.value = '80.25px';
  field.focus();
  field.value = '80.75px';
  field.setSelectionRange(2, 4, 'forward');
  const captured = h.capture(h.root, 'same-context'),
    replacement = h.make('first');
  h.root.fields = [replacement];
  h.restore(h.root, captured, 'same-context');
  assert.equal(replacement.value, '80.75px');
  assert.deepEqual([replacement.selectionStart, replacement.selectionEnd], [2, 4]);
  const external = {};
  h.document.activeElement = external;
  const externalState = h.capture(h.root, 'same-context');
  h.restore(h.root, externalState, 'same-context');
  assert.equal(h.document.activeElement, external);
  h.root.inert = true;
  h.restore(h.root, captured, 'same-context');
  assert.equal(h.document.activeElement, external);
  assert.equal(h.capture(h.root, 'different-context'), null);
});

test('actual Review renderer and generic draft capture preserve pilot-only state ownership', () => {
  const render = slice('function renderReview()', 'const RUN_ORDER');
  assert.ok(render.indexOf('captureReviewEditState') < render.indexOf("$('#changes').innerHTML"));
  assert.match(render, /foundryPilotActive\(\)\s*\? captureReviewEditState/);
  assert.match(render, /if \(foundryPilotActive\(\)\) restoreReviewEditState/);
  assert.match(render, /dataset\.reviewIdentity/);
  assert.match(render, /\$\('#apply-agent'\)\.disabled\s*=[^;]*reviewStatusBlocked\(\)/);
  assert.match(render, /\[data-delete-change\][\s\S]*?if \(reviewStatusBlocked\(\)\) return/);
  const dirty = slice('function captureDirtyDrafts()', 'function restoreDirtyDrafts(');
  assert.match(dirty, /foundryPilotActive\(\)/);
  assert.match(dirty, /\[data-change-id\].*\[data-after-id\]/);
});
