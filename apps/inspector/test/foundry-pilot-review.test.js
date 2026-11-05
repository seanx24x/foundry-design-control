import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import {
  reviewMappingIssue,
  reviewBatchSummary,
  applyLifecyclePresentation,
  shouldDisplayApplyRun,
} from '../public/workflow.js';
import { reviewPropertyLabel } from '../public/foundry-pilot-review.js';

const file = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
const app = file('app.js');
const fixture = readFileSync(
  new URL('../../../scripts/test-foundry-review-pilot-fixture.mjs', import.meta.url),
  'utf8',
);
const change = (id = 'mapped', extra = {}) => ({
  id,
  target: {
    id,
    platform: 'web',
    locator: { foundryId: id },
    source: { file: 'src/Heading.tsx', line: 12 },
  },
  property: 'fontSize',
  category: 'typography',
  scope: 'instance',
  before: 76,
  after: 80,
  unit: 'px',
  status: 'approved',
  confidence: 'source-mapped',
  ...extra,
});

function applyHarness({
  held = false,
  failure = false,
  connected = true,
  changes = [
    change(),
    change('excluded', { status: 'rejected' }),
    change('unresolved', { confidence: 'unresolved' }),
  ],
} = {}) {
  const calls = [],
    fields = new Map(
      changes.map((item) => [item.id, { value: item.id === 'mapped' ? '80.25px' : '80px' }]),
    );
  let action, release;
  const button = {
    dataset: {},
    disabled: false,
    addEventListener: (_, handler) => {
      action = handler;
    },
  };
  const error = { hidden: true, textContent: '' };
  const context = {
    $: (selector) =>
      selector === '#apply-agent'
        ? button
        : selector === '#review-apply-error'
          ? error
          : fields.get(selector.match(/data-after-id="([^"]+)"/)?.[1]),
    CSS: { escape: (value) => value },
    activeSession: {
      changeSet: {
        context: { revision: 'reviewed-revision' },
        changes,
        operations: [],
      },
    },
    activeAgentPresence: { connected },
    dismissedApplyRunId: 'previous-run',
    sessionId: 'synthetic-review-fixture',
    reviewMappingIssue,
    reviewStatusBlocked: () => false,
    api: async (url, options) => {
      calls.push({ type: 'api', url, body: JSON.parse(options.body) });
      if (held)
        await new Promise((resolve) => {
          release = resolve;
        });
      if (failure) throw Error('Synthetic acknowledgement failed');
    },
    loadSession: async () => calls.push({ type: 'reload' }),
    toast: (message) => calls.push({ type: 'toast', message }),
  };
  const validStart = app.indexOf('function validChange('),
    validEnd = app.indexOf('function changeContextSet(', validStart);
  const start = app.indexOf("$('#apply-agent').addEventListener('click'"),
    end = app.indexOf('async function revealStressSelection(', start);
  assert.ok(validStart >= 0 && validEnd > validStart && start >= 0 && end > start);
  runInNewContext(app.slice(validStart, validEnd) + app.slice(start, end), context);
  return {
    action,
    context,
    button,
    error,
    fields,
    calls,
    release: () => release(),
  };
}

test('real Apply handler submits reviewed revision and numeric values without approving excluded or unresolved edits', async () => {
  const { action, calls, button, context } = applyHarness();
  await action();
  const request = calls.find((item) => item.type === 'api');
  assert.equal(request.url, '/v1/sessions/synthetic-review-fixture/apply-runs');
  assert.deepEqual(request.body, {
    revision: 'reviewed-revision',
    reviews: [
      { changeId: 'mapped', approved: true, after: 80.25 },
      { changeId: 'excluded', approved: false, after: 80 },
      { changeId: 'unresolved', approved: false, after: 80 },
    ],
  });
  assert.equal(context.dismissedApplyRunId, null);
  assert.equal(button.dataset.submitting, undefined);
  assert.equal(button.disabled, false);
  assert.equal(calls.filter((item) => item.type === 'reload').length, 1);
});

test('real Apply handler blocks duplicate pending submissions and keeps the action locked until acknowledgement', async () => {
  const { action, calls, button, release } = applyHarness({ held: true });
  const pending = action();
  assert.equal(button.dataset.submitting, 'true');
  assert.equal(button.disabled, true);
  await action();
  assert.equal(calls.filter((item) => item.type === 'api').length, 1);
  release();
  await pending;
  assert.equal(button.dataset.submitting, undefined);
  assert.equal(button.disabled, false);
});

test('failed Apply acknowledgement preserves input and makes no session success claim', async () => {
  const { action, calls, error, fields, button } = applyHarness({
    failure: true,
  });
  await action();
  assert.equal(fields.get('mapped').value, '80.25px');
  assert.equal(error.hidden, false);
  assert.match(error.textContent, /Apply was not queued: Synthetic acknowledgement failed/);
  assert.equal(
    calls.some((item) => item.type === 'reload'),
    false,
  );
  assert.equal(button.disabled, false);
});

test('Apply with no valid included source is blocked before transport while offline listeners queue honestly', async () => {
  const blocked = applyHarness({
    changes: [
      change('unresolved', { confidence: 'unresolved' }),
      change('excluded', { status: 'rejected' }),
    ],
  });
  await blocked.action();
  assert.equal(blocked.calls.length, 0);
  assert.equal(blocked.error.hidden, false);
  assert.match(blocked.error.textContent, /Resolve the source mapping/);
  const offline = applyHarness({ connected: false });
  await offline.action();
  assert.match(offline.calls.find((item) => item.type === 'toast').message, /Batch queued/);
});

test('review batch honors ambiguous source candidates and selected operation mappings', () => {
  const ambiguous = change('ambiguous', {
    mappingCandidates: [
      { id: 'one', source: { file: 'src/One.tsx', line: 1 } },
      { id: 'two', source: { file: 'src/Two.tsx', line: 2 } },
    ],
  });
  const operationChange = change('operation', { operationId: 'operation' });
  const operation = { id: 'operation', kind: 'style', status: 'unresolved' };
  const summary = reviewBatchSummary(
    [change(), ambiguous, operationChange, change('excluded', { status: 'rejected' })],
    [operation],
  );
  assert.equal(summary.included, 1);
  assert.equal(summary.mappingIssues, 2);
  assert.equal(summary.mappingLabel, 'Needs review');
  assert.equal(summary.riskLabel, 'Needs review');
  assert.ok(!summary.knownFiles.includes('src/One.tsx'));
  assert.match(reviewMappingIssue(operationChange, [operation]), /operation source mapping/);
  ambiguous.selectedMappingId = 'two';
  assert.equal(reviewMappingIssue(ambiguous), null);
});

test('Apply lifecycle distinguishes a queued claim, source edits, rendered checks and verified Delivery', () => {
  assert.match(
    applyLifecyclePresentation({ state: 'queued' }, { listenerConnected: false }).detail,
    /Source work has not begun/,
  );
  assert.match(
    applyLifecyclePresentation({ state: 'claimed' }, {}).detail,
    /Source work has not begun/,
  );
  assert.match(applyLifecyclePresentation({ state: 'applying' }, {}).detail, /not verified yet/);
  assert.match(
    applyLifecyclePresentation({ state: 'verifying' }, { previewConnected: false }).detail,
    /preview is disconnected/,
  );
  const passed = { id: 'completed', state: 'passed' };
  assert.notEqual(applyLifecyclePresentation(passed, {}).phase, 'Verified');
  assert.equal(
    applyLifecyclePresentation(passed, {
      deliveryRecords: [{ applyRunId: 'unrelated', status: 'verified' }],
    }).action,
    'review',
  );
  assert.equal(
    applyLifecyclePresentation(passed, {
      deliveryRecords: [{ applyRunId: 'completed', status: 'verified' }],
    }).action,
    'delivery',
  );
  assert.equal(shouldDisplayApplyRun(passed, { mode: 'review', changes: [change()] }), false);
  assert.equal(shouldDisplayApplyRun({ state: 'cancelled' }, { mode: 'review' }), false);
});

test('recovery messaging preserves interrupted source and never claims automatic resume or undo', () => {
  assert.match(
    applyLifecyclePresentation({ state: 'needs_attention', interruptedState: 'rebuilding' }, {})
      .detail,
    /source changes may already exist/,
  );
  assert.match(
    applyLifecyclePresentation({ state: 'needs_attention', interruptedState: 'rebuilding' }, {})
      .detail,
    /Nothing resumes automatically/,
  );
  assert.match(
    applyLifecyclePresentation({ state: 'failed' }, {}).detail,
    /Nothing retries automatically/,
  );
  assert.match(
    applyLifecyclePresentation({ state: 'cancelled' }, {}).detail,
    /does not undo source edits or prove verification/,
  );
});

test('Review fixture keeps real renderers, stylesheets, actions and loopback transport boundaries', () => {
  for (const marker of [
    'let reviewStatusPending = null;',
    'function renderChangeSummary(',
    "$('#apply-agent').addEventListener('click'",
    'async function revealStressSelection(',
    'async function toggleComparison(',
  ])
    assert.ok(fixture.includes(marker), marker);
  assert.match(
    fixture,
    /refinePilotReview\s*,\s*capturePilotApplyState\s*,\s*refinePilotApply[\s\S]*?from\s+'\/foundry-pilot-review.js'/,
  );
  assert.match(fixture, /const\s+stylesheets\s*=\s*\[\s*\.\.\.index.matchAll/);
  assert.match(fixture, /packages\/protocol\/dist/);
  assert.match(fixture, /FOUNDRY_REVIEW_FIXTURE_PORT\s*\?\?\s*0/);
  assert.match(fixture, /\.listen\(\s*port,\s*'127\.0\.0\.1'/);
  assert.doesNotMatch(fixture, /fetch\(|sessionStorage|localStorage|chromium\.launch/);
  assert.doesNotMatch(fixture, /ses_[a-z0-9]+|__foundry_token|__foundry_session/);
});

test('Review fixture reruns are guarded and dispose prior cancellation confirmation timers', () => {
  assert.match(fixture, /if\s*\(fixtureRunning\)\s*return/);
  assert.match(
    fixture,
    /finally\s*\{\s*for\s*\(const timer of timers\)\s*window.clearTimeout\(timer\);\s*timers.clear\(\)/,
  );
  assert.match(fixture, /cancelConfirmationRunId\s*=\s*null;\s*cancelConfirmationUntil\s*=\s*0/);
  for (const label of [
    'Pilot refinement preserves original field and action nodes, drafts, focus and caret',
    'Acknowledged Apply opens a queued run without claiming source edits',
    'Passed checks without a verified Delivery record do not expose a verified handoff',
    'Expired stop confirmation requires a fresh confirmation',
    'New pending edits take priority over stale completed run evidence',
  ])
    assert.ok(fixture.includes(label), label);
});

test('Review display labels stay familiar without inventing names for unknown properties', () => {
  assert.equal(reviewPropertyLabel('fontSize'), 'Font size');
  assert.equal(reviewPropertyLabel('paddingRight'), 'Right padding');
  assert.equal(reviewPropertyLabel('motion.intro.keyframe.2.transform'), 'Keyframe transform');
  assert.equal(reviewPropertyLabel('motion.intro.direction'), 'Playback direction');
  assert.equal(reviewPropertyLabel('--unknown-property'), '--unknown-property');
});

test('Review and Apply pilot hooks remain presentation-only and explicitly gated', () => {
  const helper = file('foundry-pilot-review.js');
  assert.match(helper, /foundryFoundationsEnabled\(\)/);
  assert.match(helper, /dataset.next === 'true'/);
  assert.match(app, /refinePilotReview\(\s*undefined,\s*\{\s*changes\s*\}\s*\)/);
  assert.match(app, /capturePilotApplyState\(root\)/);
  assert.match(app, /previousState:\s*pilotApplyState/);
  assert.match(app, /pilotWasVisible\s*&&\s*root.dataset.foundryRunId\s*===\s*run.id/);
  assert.match(app, /stages:\s*RUN_ORDER/);
  assert.match(helper, /root.inert = !apply.hidden/);
  assert.match(helper, /attributeFilter: \['hidden'\]/);
  assert.match(helper, /field.append\(value\)/);
  assert.match(helper, /verifiedDelivery \? 'Verified handoff' : 'Run complete'/);
  assert.match(helper, /stages.indexOf\(run.interruptedState\)/);
  assert.match(helper, /classList.toggle\(\s*'is-complete',\s*index\s*<\s*interruptedIndex\s*\)/);
  assert.match(
    helper,
    /classList.toggle\(\s*'needs-attention',\s*index\s*===\s*interruptedIndex\s*\)/,
  );
  assert.match(helper, /report.scrollTop = previousState.reportScroll/);
  assert.match(helper, /focus\(\{ preventScroll: true \}\)/);
  assert.match(helper, /applyReportNeedsFocus\(\{/);
  assert.match(helper, /if \(previousState \|\| !review\) return false/);
  assert.match(helper, /lastFocus\.dataset.submitting === 'true'/);
  assert.match(helper, /heading.tabIndex\s*=\s*-1/);
  assert.doesNotMatch(
    helper,
    /fetch\(|requestCommand\(|postMessage\(|cloneNode\(|localStorage|sessionStorage/,
  );
  assert.doesNotMatch(helper, /\.(?:value|disabled)\s*=/);
});

test('Review fixture checks interrupted progress, fresh run scroll and responsive action geometry', () => {
  for (const label of [
    'Interrupted rebuild remains the attention stage rather than a completed rebuild or active verification',
    'A different run starts its report at the beginning rather than borrowing prior scroll',
    'Reopening a hidden run starts at the report beginning',
    'has no workspace or report horizontal overflow',
    'narrow action buttons retain compact heights rather than stretched flex bases',
    'Initial Apply exposure transfers keyboard focus from covered Review to the report heading',
    'External fixture controls retain focus when exposing an Apply scenario',
    'Narrow Apply outer scroll survives a same-run progress update',
  ])
    assert.ok(fixture.includes(label), label);
  assert.match(fixture, /const railWidth\s*=\s*320/);
  assert.match(fixture, /\[\s*'ready',\s*'queued',\s*'needs-attention'\s*\]/);
});

test('narrow Review summary uses intrinsic height without changing desktop sidebar sizing', () => {
  const css = file('foundry-pilot-review.css');
  const narrowStart = css.indexOf('@media (max-width: 800px)');
  const narrowEnd = css.indexOf('@media (pointer: coarse)', narrowStart);
  assert.ok(narrowStart >= 0 && narrowEnd > narrowStart);
  const selector =
    /:root\[data-foundry-pilot='review'\]\s+\[data-next\]\s+\.foundry-review-interior\s+\.review-summary\s*\{([^}]+)\}/g;
  const narrowSummary = [...css.slice(narrowStart, narrowEnd).matchAll(selector)];
  assert.equal(narrowSummary.length, 1);
  for (const declaration of [/height:\s*auto\s*;/, /min-height:\s*0\s*;/, /max-height:\s*none\s*;/])
    assert.match(narrowSummary[0][1], declaration);
  const desktopSummary = [...css.slice(0, narrowStart).matchAll(selector)];
  for (const rule of desktopSummary)
    assert.doesNotMatch(rule[1], /(?:^|[;\s])(?:min-|max-)?height\s*:/);
  assert.match(fixture, /\[\s*'empty',\s*'ready',\s*'long-error'\s*\]/);
  for (const label of [
    'Review summary and footer do not overlap the change list',
    'Review summary contains its footer after the summary content',
    'Review summary, footer and list fit their widths',
    'narrow Review summary grows intrinsically without the shared fixed sidebar height',
    'narrow Review list follows all summary actions without overlap',
    'Long Review error stays separate from the original action buttons',
    'Responsive Review geometry scenarios invoke no source or recovery transport',
  ])
    assert.ok(fixture.includes(label), label);
});

test('Apply render signature tracks recorded errors, interruption and prepared resume review', () => {
  const render = app.slice(app.indexOf('function renderApplyRun('));
  const expression = render.match(
    /const\s+signature\s*=\s*JSON\.stringify\((\[[\s\S]*?\])\s*\);/,
  )?.[1];
  assert.ok(expression, 'real Apply signature extraction');
  const context = {
    run: {
      id: 'synthetic-run',
      state: 'needs_attention',
      attempts: 1,
      error: 'First issue',
      interruptedState: 'rebuilding',
    },
    latestMessage: 'The same lifecycle summary',
    listenerConnected: true,
    lifecycle: { phase: 'Needs attention' },
    handoff: null,
    handoffContext: null,
    bridgeConnected: true,
    applyRunActionError: null,
    applyRunErrorFor: () => '',
    applyRunActionBlocked: () => false,
    applyRunActionPending: null,
    applyRunContextKey: () => 'synthetic-context',
    resumeReview: null,
    foundryPilotActive: () => false,
    cancelConfirmationRunId: null,
    cancelConfirmationUntil: 0,
  };
  const signature = () => runInNewContext(`JSON.stringify(${expression})`, context);
  const initial = signature();
  context.run.error = 'A new failure cause';
  const changedError = signature();
  assert.notEqual(changedError, initial);
  context.run.interruptedState = 'verifying';
  assert.notEqual(signature(), changedError);
  const interrupted = signature();
  context.resumeReview = {
    key: 'synthetic-review',
    reviewedRevision: 'original-source',
    expectedRevision: 'retained-edit',
    expectedDesignGraphRevision: 'graph-one',
    changedFiles: ['src/Action.module.css'],
  };
  const reviewReady = signature();
  assert.notEqual(
    reviewReady,
    interrupted,
    'preparation exposes the source review and Confirm action',
  );
  context.applyRunActionPending = {
    context: 'synthetic-context',
    action: 'confirm-resume',
    phase: 'request',
  };
  const confirming = signature();
  assert.notEqual(
    confirming,
    reviewReady,
    'confirmation pending state rerenders even outside pilot',
  );
  context.applyRunActionPending = null;
  context.resumeReview = null;
  assert.equal(signature(), interrupted, 'clearing stale review removes its confirmation');
});
