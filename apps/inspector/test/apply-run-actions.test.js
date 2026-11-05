import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { applyLifecyclePresentation, shouldDisplayApplyRun } from '../public/workflow.js';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function slice(start, end) {
  const first = app.indexOf(start),
    last = app.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, start);
  return app.slice(first, last);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
const run = (extra = {}) => ({
  id: 'original-run',
  state: 'failed',
  attempts: 1,
  requestedAt: '2026-11-01T10:00:00Z',
  changeIds: ['heading'],
  messages: [],
  changedFiles: [],
  validationResults: [],
  verificationResults: [],
  ...extra,
});
const session = (value = run()) => ({
  changeSet: {
    id: 'batch-one',
    sessionId: 'synthetic-apply',
    context: { projectRoot: '/synthetic/project', revision: 'source-one' },
    designGraphRevision: 7,
    changes: [],
    operations: [],
  },
  applyRuns: [value],
  deliveryRecords: [],
});

// Execute the original transaction, renderer, loadSession and canonical commit.
// Only the DOM button surface, network and timer clock are synthetic.
function harness({ pilot = true, initialRun = run(), connected = true } = {}) {
  const calls = [],
    posts = [],
    reads = [],
    timers = [];
  let buttons = [],
    html = '';
  const root = {
    hidden: true,
    dataset: {},
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = value;
      for (const button of buttons) button.isConnected = false;
      buttons = [...value.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(
        ([, attributes, text]) => {
          const dataset = Object.fromEntries(
            [...attributes.matchAll(/data-([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [
              key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
              value,
            ]),
          );
          return {
            dataset,
            disabled: /\sdisabled(?:\s|$)/.test(attributes),
            textContent: text,
            isConnected: true,
            attributes: new Map(),
            setAttribute(name, value) {
              this.attributes.set(name, value);
            },
            getAttribute(name) {
              return this.attributes.get(name) ?? null;
            },
            addEventListener(name, callback) {
              this[name] = callback;
            },
          };
        },
      );
    },
  };
  const matching = (selector) =>
    buttons.filter((button) => {
      if (selector === '[data-run-action]') return Boolean(button.dataset.runAction);
      if (selector === '[data-run-navigation="back"]')
        return button.dataset.runNavigation === 'back';
      if (selector === '[data-run-navigation="delivery"]')
        return button.dataset.runNavigation === 'delivery';
      return false;
    });
  const context = {
    Error,
    Promise,
    Date,
    JSON,
    $: (selector) => (selector === '#apply-run' ? root : (matching(selector)[0] ?? null)),
    $$: matching,
    foundryPilotActive: () => pilot,
    activeSession: session(initialRun),
    activeAgentPresence: { connected },
    activeMode: 'review',
    reviewOriginMode: 'canvas',
    bridgeConnected: true,
    sessionId: 'synthetic-apply',
    token: 'synthetic-only',
    applyRunActionError: null,
    dismissedApplyRunId: null,
    cancelConfirmationRunId: null,
    cancelConfirmationUntil: 0,
    latestSessionRequest: 0,
    pendingSessionRender: null,
    sessionPollInFlight: false,
    runtimeConnected: true,
    lastSessionLoadError: '',
    lastRenderedSessionSnapshot: '',
    nextVisualAgent: null,
    syncReviewAgentPresence() {},
    reviewStatusPending: null,
    reviewStatusError: null,
    reviewContextKey: () => 'synthetic-review',
    sessionRenderSnapshot: (payload) => JSON.stringify(payload),
    sessionRenderBlocked: () => false,
    captureDirtyDrafts: () => [],
    restoreDirtyDrafts() {},
    captureWorkspaceScroll: () => ({}),
    restoreWorkspaceScroll() {},
    applyLifecyclePresentation,
    shouldDisplayApplyRun,
    escapeText: (value) =>
      String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;'),
    capturePilotApplyState: () => null,
    refinePilotApply: (element, { run }) => {
      element.dataset.foundryRunId = run.id;
    },
    renderConnectionStatus: () => calls.push({ type: 'connection' }),
    setTimeout: (callback) => {
      timers.push(callback);
      return timers.length;
    },
    toast: (message) => calls.push({ type: 'toast', message }),
    setMode: (mode) => {
      context.activeMode = mode;
      calls.push({ type: 'navigation', mode });
    },
    renderSession: (payload) => {
      calls.push({ type: 'renderSession', payload });
      context.activeSession = payload;
      context.lastRenderedSessionSnapshot = JSON.stringify(payload);
      context.actions.render(payload.applyRuns);
    },
    api: async (url, options = {}) => {
      calls.push({
        type: 'api',
        url,
        method: options.method ?? 'GET',
        body: options.body ? JSON.parse(options.body) : null,
      });
      if (options.method === 'POST') {
        const request = deferred();
        posts.push(request);
        return request.promise;
      }
      if (url.endsWith('/agent-presence'))
        return { connected: context.activeAgentPresence.connected };
      const request = deferred();
      reads.push(request);
      return request.promise;
    },
  };
  runInNewContext(
    slice('const RUN_ORDER =', 'function renderChangeSummary(') +
      slice('function commitLoadedSession(', 'function flushPendingSessionRender()') +
      slice('async function loadSession(', '// A heartbeat failure') +
      '\nthis.actions={submit:submitPilotApplyRunAction,render:renderApplyRun,load:loadSession,commit:commitLoadedSession,blocked:applyRunActionBlocked,contextKey:applyRunContextKey,errorFor:applyRunErrorFor,pending:()=>applyRunActionPending};',
    context,
  );
  context.actions.render(context.activeSession.applyRuns);
  return {
    context,
    calls,
    posts,
    reads,
    timers,
    root,
    button: (action) => buttons.find((button) => button.dataset.runAction === action),
    latest: () => context.activeSession.applyRuns.at(-1),
    render: () => context.actions.render(context.activeSession.applyRuns),
    submit: (action) => context.actions.submit(context.activeSession.applyRuns.at(-1), action),
    ack: (action, original = context.activeSession) => {
      const payload = structuredClone(original),
        previous = payload.applyRuns.at(-1);
      if (action === 'retry')
        payload.applyRuns.push(run({ id: 'retried-run', retryOf: previous.id, state: 'queued' }));
      else
        Object.assign(previous, {
          state: action === 'cancel' ? 'cancelled' : 'queued',
        });
      return payload;
    },
  };
}
const postCalls = (h) => h.calls.filter((call) => call.type === 'api' && call.method === 'POST');
const successClaims = (h) =>
  h.calls.filter((call) => call.type === 'toast' && call.message.includes('request queued'));
const resumeContext = (extra = {}) => ({
  runId: 'original-run',
  reviewedRevision: 'source-one',
  expectedRevision: 'source-one-dirty-retained-edit',
  expectedDesignGraphRevision: 7,
  changedFiles: ['src/Action.module.css'],
  ...extra,
});
const resumeHarness = (extra = {}) =>
  harness({
    initialRun: run({ state: 'needs_attention', interruptedState: 'applying' }),
    ...extra,
  });
async function prepareResume(h, response = resumeContext()) {
  const pending = h.button('resume').click();
  h.reads.at(-1).resolve(response);
  await pending;
}

test('retry has a request-owned guard across original and replacement buttons until acknowledgement', async () => {
  const h = harness(),
    oldButton = h.button('retry');
  const pending = oldButton.click();
  assert.equal(h.context.actions.pending().action, 'retry');
  assert.equal(h.button('retry').disabled, true);
  assert.equal(h.button('retry').getAttribute('aria-busy'), 'true');
  assert.equal(h.button('retry').textContent, 'Requesting retry…');
  h.latest().messages.push({
    state: 'failed',
    message: 'Progress refreshed while pending',
  });
  h.render();
  assert.notEqual(h.button('retry'), oldButton);
  assert.equal(h.button('retry').disabled, true);
  await h.button('retry').click();
  await oldButton.click();
  await h.submit('resume');
  await h.submit('cancel');
  assert.deepEqual(postCalls(h), [
    {
      type: 'api',
      url: '/v1/sessions/synthetic-apply/apply-runs/original-run/retry',
      method: 'POST',
      body: {},
    },
  ]);
  h.posts[0].resolve(h.ack('retry'));
  await pending;
  assert.equal(h.context.actions.pending(), null);
  assert.equal(h.latest().id, 'retried-run');
  assert.equal(h.latest().retryOf, 'original-run');
  assert.equal(h.reads.length, 0, 'uncontended acknowledgement is authoritative');
});

test('resume displays live source review and only a separate confirm click posts its exact revisions', async () => {
  for (const pilot of [true, false]) {
    const h = resumeHarness({ pilot });
    const original = JSON.stringify(h.context.activeSession);
    const pending = h.button('resume').click();
    assert.equal(h.button('resume').disabled, true);
    assert.equal(h.button('resume').textContent, 'Reading current source…');
    assert.equal(h.posts.length, 0);
    assert.equal(
      h.calls.find((call) => call.type === 'api').url,
      '/v1/sessions/synthetic-apply/apply-runs/original-run/resume-context',
    );
    await h.button('resume').click();
    assert.equal(h.reads.length, 1, 'preparation is single-flight');
    h.reads[0].resolve(resumeContext({ expectedDesignGraphRevision: null }));
    await pending;
    assert.equal(h.posts.length, 0, 'source preparation never authorizes automatically');
    assert.equal(JSON.stringify(h.context.activeSession), original);
    assert.equal(h.button('confirm-resume').textContent, 'Confirm resume');
    assert.match(h.root.innerHTML, /original reviewed baseline is preserved/);
    assert.match(h.root.innerHTML, /source-one-dirty-retained-edit/);
    assert.match(h.root.innerHTML, /src\/Action.module.css/);
    const confirm = h.button('confirm-resume').click();
    assert.equal(h.button('confirm-resume').disabled, true);
    assert.equal(h.button('confirm-resume').textContent, 'Authorizing resume…');
    assert.deepEqual(postCalls(h)[0], {
      type: 'api',
      url: '/v1/sessions/synthetic-apply/apply-runs/original-run/resume',
      method: 'POST',
      body: {
        expectedRevision: 'source-one-dirty-retained-edit',
        expectedDesignGraphRevision: null,
      },
    });
    await h.button('confirm-resume').click();
    assert.equal(h.posts.length, 1);
    h.posts[0].resolve(h.ack('resume'));
    await confirm;
    assert.equal(h.latest().id, 'original-run');
    assert.equal(h.latest().state, 'queued');
  }
});

test('resume preparation failure never authorizes and requires a fresh explicit review', async () => {
  const h = resumeHarness();
  const pending = h.button('resume').click();
  h.reads[0].reject(new Error('Original source baseline is unavailable. Review changes again.'));
  await pending;
  assert.equal(h.posts.length, 0);
  assert.equal(h.button('confirm-resume'), undefined);
  assert.equal(h.button('resume').disabled, false);
  assert.match(h.context.actions.errorFor(h.latest()), /Resume is paused.*baseline is unavailable/);
  assert.equal(successClaims(h).length, 0);
});

test('incomplete or mismatched resume contexts cannot become a confirmation', async () => {
  for (const response of [
    resumeContext({ runId: 'another-run' }),
    resumeContext({ expectedRevision: null }),
    resumeContext({ expectedRevision: '' }),
    resumeContext({ reviewedRevision: undefined }),
    resumeContext({ expectedDesignGraphRevision: undefined }),
    resumeContext({ changedFiles: [14] }),
    resumeContext({ changedFiles: null }),
  ]) {
    const h = resumeHarness();
    await prepareResume(h, response);
    assert.equal(h.posts.length, 0);
    assert.equal(h.button('confirm-resume'), undefined);
    assert.match(h.context.actions.errorFor(h.latest()), /complete source review/);
  }
});

test('revision conflict clears the confirmation and never retries or silently rebases', async () => {
  const h = resumeHarness();
  await prepareResume(h);
  const oldConfirm = h.button('confirm-resume');
  const pending = oldConfirm.click();
  h.posts[0].reject(new Error('Resume revision conflict: source changed again'));
  await pending;
  assert.equal(h.latest().state, 'needs_attention');
  assert.match(
    h.context.actions.errorFor(h.latest()),
    /Action was not acknowledged.*revision conflict/,
  );
  assert.equal(h.button('confirm-resume'), undefined);
  assert.equal(h.button('resume').disabled, false);
  await oldConfirm.click();
  assert.equal(h.posts.length, 1);
  assert.equal(h.reads.length, 1);
  await prepareResume(h, resumeContext({ expectedRevision: 'source-one-dirty-new' }));
  await oldConfirm.click();
  assert.equal(h.posts.length, 1, 'old confirmation cannot authorize a refreshed source review');
  const confirmed = h.button('confirm-resume').click();
  assert.equal(postCalls(h)[1].body.expectedRevision, 'source-one-dirty-new');
  h.posts[1].resolve(h.ack('resume'));
  await confirmed;
});

test('late preparation cannot expose a confirmation after run, graph, project or view changes', async () => {
  for (const change of [
    'run',
    'updatedAt',
    'requeueCount',
    'resumedAt',
    'graph',
    'project',
    'view',
  ]) {
    const h = resumeHarness();
    const pending = h.button('resume').click();
    if (change === 'run') h.latest().id = 'another-run';
    if (change === 'updatedAt') h.latest().updatedAt = '2026-11-02T12:00:00Z';
    if (change === 'requeueCount') h.latest().requeueCount = 2;
    if (change === 'resumedAt') h.latest().resumedAt = '2026-11-02T12:00:00Z';
    if (change === 'graph') h.context.activeSession.changeSet.designGraphRevision = 8;
    if (change === 'project') h.context.activeSession.changeSet.context.projectRoot = '/another';
    if (change === 'view') h.context.activeMode = 'canvas';
    h.reads[0].resolve(resumeContext());
    await pending;
    h.render();
    assert.equal(h.button('confirm-resume'), undefined, change);
    assert.equal(h.posts.length, 0, change);
  }
});

test('stale first-click handler cannot confirm and obsolete confirmation cannot follow a changed run', async () => {
  const h = resumeHarness();
  const firstClick = h.button('resume');
  await prepareResume(h);
  const oldConfirm = h.button('confirm-resume');
  const pending = firstClick.click();
  assert.equal(h.posts.length, 0);
  assert.equal(h.reads.length, 2, 'stale prepare action only prepares again');
  h.reads[1].resolve(resumeContext());
  await pending;
  await oldConfirm.click();
  assert.equal(h.posts.length, 0, 'old confirmation object is invalidated');
  const confirmation = h.button('confirm-resume');
  h.latest().updatedAt = '2026-11-02T12:00:00Z';
  h.render();
  await confirmation.click();
  assert.equal(h.posts.length, 0);
});

test('resume source paths are escaped and an empty delta is explicitly described', async () => {
  const h = resumeHarness();
  await prepareResume(h, resumeContext({ changedFiles: ['<img src=x onerror=alert(1)>'] }));
  assert.ok(!h.root.innerHTML.includes('<img src=x'));
  assert.match(h.root.innerHTML, /&lt;img/);
  const pending = h.submit('resume');
  h.reads.at(-1).resolve(resumeContext({ changedFiles: [] }));
  await pending;
  assert.match(h.root.innerHTML, /No source changes detected/);
  assert.equal(h.posts.length, 0);
});

test('failed acknowledgement unlocks with a current-run error and requires an explicit retry', async () => {
  const h = harness({ connected: false }),
    before = JSON.stringify(h.context.activeSession);
  const pending = h.button('retry').click();
  h.posts[0].reject(new Error('Synthetic request failed'));
  await pending;
  assert.equal(JSON.stringify(h.context.activeSession), before);
  assert.equal(h.context.actions.blocked(), false);
  assert.equal(h.button('retry').disabled, false);
  assert.match(
    h.context.actions.errorFor(h.latest()),
    /Action was not acknowledged.*Synthetic request failed/,
  );
  assert.equal(h.posts.length, 1);
  assert.equal(h.reads.length, 0);
  assert.equal(successClaims(h).length, 0);
  const retry = h.button('retry').click();
  assert.equal(h.posts.length, 2);
  assert.equal(h.context.applyRunActionError, null);
  h.posts[1].resolve(h.ack('retry'));
  await retry;
  assert.equal(successClaims(h).length, 1);
});

test('invalid acknowledgement context, lineage or state never installs a response or claims success', async () => {
  for (const mutate of [
    (payload) => {
      payload.changeSet.id = 'different-batch';
    },
    (payload) => {
      payload.applyRuns.at(-1).retryOf = 'different-run';
    },
    (payload) => {
      payload.applyRuns.at(-1).state = 'failed';
    },
    (payload) => {
      payload.applyRuns.pop();
    },
  ]) {
    const h = harness({ connected: false }),
      baseline = h.context.activeSession;
    const pending = h.submit('retry'),
      response = h.ack('retry');
    mutate(response);
    h.posts[0].resolve(response);
    await pending;
    assert.equal(h.context.activeSession, baseline);
    assert.equal(h.context.actions.blocked(), false);
    assert.match(h.context.actions.errorFor(h.latest()), /matching run acknowledgement/);
    assert.equal(successClaims(h).length, 0);
  }
});

test('departed project or newer run ignores late success and failure without stealing state or feedback', async () => {
  for (const differentProject of [false, true])
    for (const reject of [false, true]) {
      const h = harness({ connected: false }),
        baseline = h.context.activeSession;
      const pending = h.submit('retry');
      const next = structuredClone(baseline);
      if (differentProject) next.changeSet.context.projectRoot = '/another/project';
      else next.applyRuns.push(run({ id: 'newer-run', state: 'applying' }));
      h.context.renderSession(next);
      const nextHTML = h.root.innerHTML;
      if (reject) h.posts[0].reject(new Error('Late old-run failure'));
      else h.posts[0].resolve(h.ack('retry', baseline));
      await pending;
      assert.equal(h.context.activeSession, next);
      assert.equal(h.context.applyRunActionError, null);
      assert.equal(successClaims(h).length, 0);
      assert.equal(h.root.innerHTML, nextHTML);
    }
});

test('stale attempt handlers and ineligible actions cannot submit against the canonical run', async () => {
  for (const key of ['id', 'state', 'attempts', 'interruptedState', 'claimAttemptId']) {
    const h = harness(),
      previous = h.button('retry');
    const latest = structuredClone(h.context.activeSession);
    latest.applyRuns[0][key] = key === 'attempts' ? 2 : key === 'state' ? 'applying' : 'changed';
    h.context.renderSession(latest);
    await previous.click();
    assert.equal(h.posts.length, 0, key);
  }
  const h = harness();
  for (const action of ['resume', 'cancel', 'unknown']) await h.submit(action);
  assert.equal(h.posts.length, 0);
});

test('progress polling remains live while pending and a changed snapshot requires fresh reconciliation', async () => {
  const h = harness(),
    baseline = h.context.activeSession;
  const pending = h.submit('retry');
  const poll = h.context.actions.load({ isPoll: true });
  assert.equal(h.reads.length, 1, 'pending POST does not freeze progress polling');
  const polled = structuredClone(baseline);
  polled.applyRuns[0].messages.push({
    state: 'failed',
    message: 'Fresh progress',
  });
  h.reads[0].resolve(polled);
  await poll;
  assert.equal(h.context.activeSession, polled);
  assert.equal(h.button('retry').disabled, true);
  h.posts[0].resolve(h.ack('retry', baseline));
  await settle();
  assert.equal(h.context.actions.pending().phase, 'reconciling');
  assert.equal(h.reads.length, 2);
  await h.context.actions.load({ isPoll: true });
  assert.equal(h.reads.length, 2, 'background poll does not supersede action reconciliation');
  await h.submit('retry');
  assert.equal(h.posts.length, 1);
  const fresh = h.ack('retry', polled);
  fresh.applyRuns.at(-1).state = 'applying';
  h.reads[1].resolve(fresh);
  await pending;
  assert.equal(h.context.activeSession, fresh);
  assert.equal(h.latest().state, 'applying');
  assert.equal(h.context.actions.blocked(), false);
  assert.equal(
    h.calls.filter(
      (call) => call.type === 'renderSession' && call.payload.applyRuns.at(-1).state === 'queued',
    ).length,
    0,
    'older POST snapshot was not rendered',
  );
});

test('acknowledged action with failed reconciliation stays paused until canonical refresh succeeds', async () => {
  const h = harness(),
    baseline = h.context.activeSession;
  const pending = h.submit('retry');
  h.context.renderSession(structuredClone(baseline));
  h.posts[0].resolve(h.ack('retry', baseline));
  await settle();
  h.reads[0].reject(new Error('Synthetic progress unavailable'));
  await pending;
  assert.equal(h.context.actions.pending(), null);
  assert.equal(h.context.actions.blocked(), true);
  assert.equal(h.context.applyRunActionError.needsRefresh, true);
  assert.match(
    h.context.actions.errorFor(h.latest()),
    /Action acknowledged, but current progress could not be refreshed/,
  );
  assert.equal(h.button('retry').disabled, true);
  assert.equal(h.button('retry').getAttribute('aria-busy'), 'false');
  await h.button('retry').click();
  assert.equal(h.posts.length, 1);
  const sameSnapshot = h.context.activeSession;
  h.context.lastRenderedSessionSnapshot = JSON.stringify(sameSnapshot);
  h.context.actions.commit(sameSnapshot, { connected: true });
  assert.equal(h.context.applyRunActionError, null);
  assert.equal(h.context.actions.blocked(), false);
  assert.equal(
    h.button('retry').disabled,
    false,
    'same canonical snapshot rerenders to release lock',
  );
});

test('pre-action GET and deferred render cannot overwrite an acknowledged recovery', async () => {
  const h = harness(),
    original = structuredClone(h.context.activeSession);
  const oldRead = h.context.actions.load({ isPoll: true });
  h.context.pendingSessionRender = { payload: original };
  const pending = h.submit('retry');
  assert.equal(h.context.pendingSessionRender, null);
  h.posts[0].resolve(h.ack('retry'));
  await pending;
  const accepted = h.context.activeSession;
  h.reads[0].resolve(original);
  await oldRead;
  assert.equal(h.context.activeSession, accepted);
  assert.equal(h.latest().id, 'retried-run');
});

test('late pre-action GET errors do not disconnect an acknowledged run', async () => {
  const h = harness();
  const oldRead = h.context.actions.load({ isPoll: true });
  const pending = h.submit('retry');
  h.posts[0].resolve(h.ack('retry'));
  await pending;
  h.reads[0].reject(new Error('Old read failed after acknowledgement'));
  await oldRead;
  assert.equal(h.context.runtimeConnected, true);
  assert.equal(h.context.lastSessionLoadError, '');
  assert.equal(h.context.applyRunActionError, null);
  assert.equal(h.latest().id, 'retried-run');
});

test('departed context rejects late reconciliation without replacing the new workspace', async () => {
  const h = harness(),
    baseline = h.context.activeSession;
  const pending = h.submit('retry');
  h.context.renderSession(structuredClone(baseline));
  h.posts[0].resolve(h.ack('retry', baseline));
  await settle();
  const newWorkspace = structuredClone(baseline);
  newWorkspace.changeSet.id = 'another-batch';
  h.context.renderSession(newWorkspace);
  h.reads[0].resolve(h.ack('retry', baseline));
  await pending;
  assert.equal(h.context.activeSession, newWorkspace);
  assert.equal(h.context.applyRunActionError, null);
  assert.equal(h.context.actions.blocked(), false);
  assert.equal(successClaims(h).length, 0);
});

test('revision changes keep the same pending guard while a new context may start its own action', async () => {
  const h = harness(),
    original = h.context.activeSession;
  const first = h.submit('retry');
  const sourceUpdate = structuredClone(original);
  sourceUpdate.changeSet.context.revision = 'source-two';
  sourceUpdate.activeDesignBranchId = 'another-direction';
  h.context.renderSession(sourceUpdate);
  assert.equal(
    h.context.actions.blocked(),
    true,
    'revision and branch changes do not lose a run lock',
  );
  await h.submit('retry');
  assert.equal(h.posts.length, 1);
  const nextContext = structuredClone(sourceUpdate);
  nextContext.changeSet.id = 'next-context';
  h.context.renderSession(nextContext);
  assert.equal(h.context.actions.blocked(), false);
  const second = h.submit('retry');
  assert.equal(h.posts.length, 2);
  const currentPending = h.context.actions.pending();
  h.posts[0].resolve(h.ack('retry', original));
  await first;
  assert.equal(
    h.context.actions.pending(),
    currentPending,
    'old finally cannot release a new transaction',
  );
  assert.equal(h.button('retry').disabled, true);
  h.posts[1].resolve(h.ack('retry', nextContext));
  await second;
  assert.equal(h.context.actions.pending(), null);
  assert.equal(h.context.activeSession.changeSet.id, 'next-context');
});

test('cancel keeps two-step confirmation and locks replacement Stop buttons until acknowledgement', async () => {
  const h = harness({ initialRun: run({ state: 'applying' }) });
  await h.button('cancel').click();
  assert.equal(h.posts.length, 0);
  assert.equal(h.button('cancel').textContent, 'Confirm stop');
  const confirmed = h.button('cancel').click();
  assert.equal(h.button('cancel').disabled, true);
  assert.equal(h.button('cancel').textContent, 'Stopping run…');
  h.latest().messages.push({ state: 'applying', message: 'Still applying' });
  h.render();
  await h.button('cancel').click();
  assert.deepEqual(postCalls(h), [
    {
      type: 'api',
      url: '/v1/sessions/synthetic-apply/apply-runs/original-run/cancel',
      method: 'POST',
      body: {},
    },
  ]);
  h.posts[0].resolve(h.ack('cancel'));
  await confirmed;
  assert.equal(h.latest().state, 'cancelled');
  assert.equal(h.root.hidden, true);
  assert.equal(successClaims(h).length, 0);
});

test('gate off retains legacy retry payload and follow-up read without pilot locking', async () => {
  for (const action of ['retry']) {
    const h = harness({
      pilot: false,
      initialRun: run(
        action === 'resume' ? { state: 'needs_attention', interruptedState: 'rebuilding' } : {},
      ),
    });
    const pending = h.button(action).click();
    assert.equal(h.context.actions.pending(), null);
    assert.equal(h.context.actions.blocked(), false);
    assert.deepEqual(postCalls(h)[0].body, {});
    h.posts[0].resolve(h.ack(action));
    await settle();
    assert.equal(h.reads.length, 1);
    h.reads[0].resolve(h.ack(action));
    await pending;
  }
});
