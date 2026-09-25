import assert from 'node:assert/strict';
import test from 'node:test';
import {
  affectedContexts,
  deliveryNarrativeReadOnly,
  engineeringEvidence,
  visualAgentResponsePresentation,
  workflowStep,
  previewFitScale,
  isAccessibilityFinding,
  reviewMappingIssue,
  reviewBatchSummary,
  reviewSource,
  applyLifecyclePresentation,
} from '../public/workflow.js';

test('Review blocks measured-only headings before Apply without discarding their preview', () => {
  const change = {
    status: 'approved',
    confidence: 'inferred',
    property: 'fontSize',
    before: 76,
    after: 54,
    target: { platform: 'web', locator: { selector: 'h1#story-title' } },
    mappingCandidates: [{ id: 'font-size' }],
    selectedMappingId: 'font-size',
  };
  const before = structuredClone(change);
  assert.match(reviewMappingIssue(change), /Preview only.*source identity/);
  assert.deepEqual(change, before);
  assert.equal(
    reviewMappingIssue({
      ...change,
      target: { ...change.target, source: { file: 'index.html', line: 43 } },
    }),
    null,
  );
  assert.match(
    reviewMappingIssue({
      ...change,
      target: { ...change.target, locator: { foundryId: 'heading' } },
    }),
    /exact project file and line/,
  );
  assert.equal(
    reviewMappingIssue({
      ...change,
      target: { ...change.target, locator: { foundryId: 'heading' } },
      mappingCandidates: [{ id: 'font-size', source: { file: 'style.css', line: 10 } }],
    }),
    null,
  );
  assert.match(reviewMappingIssue({ ...change, confidence: 'unresolved' }), /Resolve/);
});

test('preview fitting uses visible container bounds at compact and recording sizes', () => {
  for (const width of [240, 420, 760, 1280, 1920]) {
    const scale = previewFitScale(1440, 900, width, 700);
    assert.ok(1440 * scale <= width - 48 + 0.001);
    assert.ok(900 * scale <= 652 + 0.001);
  }
  assert.equal(previewFitScale(100, 100, 400, 400), 1);
  assert.equal(previewFitScale(100, 100, 0, 0), 1);
});

test('accessibility includes measured touch targets and contrast, not layout findings', () => {
  for (const kind of ['accessibility', 'target-size', 'contrast'])
    assert.equal(isAccessibilityFinding({ kind }), true);
  assert.equal(isAccessibilityFinding({ kind: 'overflow' }), false);
});

test('advice-only agent answers are complete, not waiting or zero proposals ready', () => {
  const request = { status: 'ready', proposals: [], messages: [{ role: 'agent', body: 'Advice' }] };
  const before = structuredClone(request);
  assert.deepEqual(visualAgentResponsePresentation(request), { answered: true, label: 'Answered' });
  assert.deepEqual(request, before);
  assert.deepEqual(visualAgentResponsePresentation({ status: 'ready', proposals: [{}] }), {
    answered: false,
    label: '1 ready',
  });
  for (const status of ['queued', 'thinking', 'needs_attention']) {
    assert.deepEqual(visualAgentResponsePresentation({ status, proposals: [] }), {
      answered: false,
      label: status.replaceAll('_', ' '),
    });
  }
});

test('completed Delivery narratives remain readable but immutable; earlier narratives stay editable', () => {
  for (const status of ['verified', 'superseded'])
    assert.equal(deliveryNarrativeReadOnly({ status }), true);
  for (const status of ['draft', 'ready', 'implementing', 'needs_attention'])
    assert.equal(deliveryNarrativeReadOnly({ status }), false);
  assert.equal(deliveryNarrativeReadOnly(undefined), false);
});

test('workflow distinguishes configuration, rendering, staging and verified delivery', () => {
  assert.equal(workflowStep({ session: {}, readiness: { ready: true } }).phase, 'Connect');
  assert.equal(workflowStep({ previewConnected: true }).label, 'Start first edit');
  assert.equal(
    workflowStep({ previewConnected: true, selection: { label: 'Button' } }).label,
    'Inspect source mapping',
  );
  assert.equal(
    workflowStep({ session: { changeSet: { changes: [{ status: 'draft' }] } } }).phase,
    'Staged',
  );
  const session = { applyRuns: [{ id: 'run', state: 'passed' }] };
  assert.notEqual(workflowStep({ session }).phase, 'Verified');
  session.deliveryRecords = [{ applyRunId: 'run', status: 'verified' }];
  assert.equal(workflowStep({ session }).phase, 'Verified');
  session.changeSet = { changes: [{ status: 'approved' }] };
  assert.equal(
    workflowStep({ session }).phase,
    'Staged',
    'new staged edits take precedence over old success',
  );
});

test('workflow is a pure view and never changes the selection, contexts or ledger', () => {
  const input = {
    previewConnected: true,
    selection: { id: 'button', source: { file: 'button.css' }, confidence: 'exact' },
    session: { changeSet: { context: { theme: 'dark' }, changes: [] } },
  };
  const before = structuredClone(input);
  workflowStep(input);
  assert.deepEqual(input, before);
});

test('workflow recognizes instrumented web source labels without treating selectors as mappings', () => {
  const label = (source, confidence = 'instrumented') =>
    workflowStep({ previewConnected: true, selection: { source, confidence } }).label;
  assert.equal(label('index.html:233:12'), 'Refine selection');
  assert.equal(label('style.css:658'), 'Refine selection');
  assert.equal(label({ file: 'index.html', line: 233 }), 'Refine selection');
  for (const source of ['#form-title', 'button:nth-child(2)', '', 'index.html:0'])
    assert.equal(label(source), 'Inspect source mapping');
  assert.equal(label('index.html:233:12', 'unresolved'), 'Inspect source mapping');
  assert.equal(label('index.html:233:12', 'measured'), 'Inspect source mapping');
});

test('engineering evidence requires the exact run and all affected contexts', () => {
  const change = {
    id: 'height',
    property: 'minHeight',
    before: '40px',
    after: '44px',
    context: { breakpoint: 'mobile', theme: 'light', state: 'default' },
    contextSet: {
      breakpoints: ['mobile', 'desktop'],
      themes: ['light', 'dark'],
      states: ['default'],
    },
  };
  assert.equal(affectedContexts(change).length, 4);
  const run = {
    id: 'run',
    state: 'passed',
    changeIds: ['height'],
    claimAttemptId: 'claim',
    applyResultClaimAttemptId: 'claim',
    applyResultAcknowledgedAt: '2026-09-15T00:00:00Z',
    validationResults: [{ passed: true }],
    reviewedChangeSet: { changes: [change] },
  };
  const evidence = {
    changeId: 'height',
    property: 'minHeight',
    applyRunId: 'run',
    passed: true,
    requested: '44px',
    rendered: '44px',
    claimAttemptId: 'claim',
    verifiedAt: '2026-09-15T00:00:00Z',
    context: change.context,
  };
  const record = {
    applyRunId: 'run',
    changeIds: ['height'],
    verificationResults: [
      evidence,
      { ...evidence, applyRunId: 'other', context: { ...change.context, theme: 'dark' } },
      { ...evidence, context: undefined },
    ],
  };
  const rows = engineeringEvidence(record, [run]);
  assert.deepEqual(
    rows.map((row) => row.status),
    ['passed', 'untested', 'untested', 'untested'],
  );
  for (const mismatch of [
    { claimAttemptId: 'old-claim' },
    { requested: '40px' },
    { verifiedAt: '2026-09-14T00:00:00Z' },
  ]) {
    assert.equal(
      engineeringEvidence({ ...record, verificationResults: [{ ...evidence, ...mismatch }] }, [
        run,
      ])[0].status,
      'untested',
    );
  }
  assert.equal(
    engineeringEvidence({ ...record, verificationResults: [{ ...evidence, rendered: '42px' }] }, [
      run,
    ])[0].status,
    'failed',
  );
  assert.equal(engineeringEvidence(record, [{ ...run, state: 'queued' }])[0].status, 'untested');
  assert.equal(
    engineeringEvidence(record, [{ ...run, validationResults: [] }])[0].status,
    'untested',
  );
  assert.equal(
    engineeringEvidence(record, [
      { ...run, claimAttemptId: undefined, completedAt: '2026-09-15T00:00:01Z' },
    ])[0].status,
    'passed',
    'a completed run retains acknowledged evidence after its active lease is released',
  );
  assert.equal(
    engineeringEvidence(record, [{ ...run, claimAttemptId: undefined, state: 'verifying' }])[0]
      .status,
    'untested',
  );
});

test('workflow follows the newest requested Apply run rather than an older verified run', () => {
  const session = {
    applyRuns: [
      { id: 'old', state: 'passed', requestedAt: '2026-09-14T00:00:00Z' },
      { id: 'new', state: 'failed', requestedAt: '2026-09-15T00:00:00Z' },
    ],
    deliveryRecords: [{ applyRunId: 'old', status: 'verified' }],
  };
  assert.equal(workflowStep({ session }).phase, 'Needs attention');
});

test('Apply lifecycle distinguishes queueing, claiming, source work and measured verification', () => {
  const phases = {
    reviewing: 'Review',
    queued: 'Queued',
    claimed: 'Claimed',
    applying: 'Applying',
    rebuilding: 'Rebuilding',
    verifying: 'Verifying',
    failed: 'Needs attention',
    needs_attention: 'Needs attention',
    cancelled: 'Cancelled',
  };
  for (const [state, phase] of Object.entries(phases)) {
    const run = { id: 'run', state };
    assert.equal(applyLifecyclePresentation(run).phase, phase);
    assert.equal(workflowStep({ session: { applyRuns: [run] } }).phase, phase);
  }
  assert.equal(applyLifecyclePresentation(undefined), null);
  assert.equal(applyLifecyclePresentation({ state: 'unknown' }), null);
  for (const state of ['queued', 'claimed']) {
    assert.match(applyLifecyclePresentation({ state }).detail, /Source work has not begun/);
    const resumed = applyLifecyclePresentation({ state, interruptedState: 'applying' });
    assert.match(resumed.detail, /Existing source work is preserved/);
    assert.doesNotMatch(resumed.detail, /Source work has not begun/);
    const retry = applyLifecyclePresentation({ state, retryOf: 'earlier-run' });
    assert.match(retry.detail, /Earlier attempts may have changed source/);
    assert.doesNotMatch(retry.detail, /Source work has not begun/);
  }
  assert.match(
    applyLifecyclePresentation({ state: 'queued' }, { listenerConnected: false }).detail,
    /saved and waiting for an agent listener/,
  );
  assert.match(
    applyLifecyclePresentation({ state: 'queued' }, { listenerConnected: true }).detail,
    /waiting for a listener to claim/,
  );
});

test('disconnected Apply and staged work retain their state and explain the next action', () => {
  for (const state of ['applying', 'rebuilding', 'verifying']) {
    const presentation = applyLifecyclePresentation({ state }, { previewConnected: false });
    assert.match(presentation.detail, /Reconnect/);
    assert.match(presentation.detail, /preserved/);
  }
  const interrupted = applyLifecyclePresentation({
    state: 'needs_attention',
    interruptedState: 'rebuilding',
  });
  assert.match(interrupted.detail, /source changes may already exist/);
  assert.match(interrupted.detail, /Resume with agent/);
  assert.match(interrupted.detail, /Nothing resumes automatically/);
  assert.match(
    applyLifecyclePresentation({ state: 'failed' }).detail,
    /Nothing retries automatically/,
  );
  const session = { changeSet: { changes: [{ status: 'draft' }] } };
  const disconnected = workflowStep({ session, previewConnected: false });
  assert.equal(disconnected.phase, 'Staged');
  assert.match(disconnected.detail, /staged edits are saved.*Reconnect/);
  assert.match(
    workflowStep({ session, previewConnected: true, listenerConnected: false }).detail,
    /queue an approved batch/,
  );
});

test('Verified requires the passed run and its own verified Delivery record', () => {
  const run = { id: 'run', state: 'passed' };
  for (const deliveryRecords of [
    [],
    [{ applyRunId: 'other', status: 'verified' }],
    [{ applyRunId: 'run', status: 'ready' }],
  ]) {
    const result = applyLifecyclePresentation(run, { deliveryRecords });
    assert.equal(result.phase, 'Verification complete');
    assert.equal(result.action, 'review');
  }
  const input = { deliveryRecords: [{ applyRunId: 'run', status: 'verified' }] };
  const original = structuredClone({ run, input });
  const verified = applyLifecyclePresentation(run, input);
  assert.equal(verified.phase, 'Verified');
  assert.equal(verified.action, 'delivery');
  assert.equal(verified.busy, false);
  assert.equal(applyLifecyclePresentation({ ...run, state: 'queued' }, input).phase, 'Queued');
  assert.deepEqual({ run, input }, original);
});

const mappedReviewChange = (overrides = {}) => ({
  id: 'edit',
  status: 'approved',
  confidence: 'instrumented',
  category: 'typography',
  scope: 'instance',
  property: 'fontSize',
  target: {
    platform: 'web',
    locator: { foundryId: 'heading' },
    source: { file: 'index.html', line: 43 },
  },
  ...overrides,
});

test('Review counts source issues separately from the inclusion decision', () => {
  const changes = ['draft', 'approved', 'rejected', 'applied'].map((status) =>
    mappedReviewChange({ status }),
  );
  const result = reviewBatchSummary(changes);
  assert.equal(result.total, 4);
  assert.equal(result.included, 1);
  assert.equal(result.mappingIssues, 0);
  assert.equal(result.mappingLabel, 'Mapped');
  assert.equal(result.riskLabel, 'Local styles');
  for (const status of ['draft', 'approved', 'rejected']) {
    const summary = reviewBatchSummary([mappedReviewChange({ status, confidence: 'unresolved' })]);
    assert.equal(summary.mappingIssues, 1);
    assert.equal(summary.included, 0);
    assert.equal(summary.riskLabel, 'Needs review');
  }
});

test('Review uses selected operation, change, then target sources without invented file counts', () => {
  const operation = {
    id: 'operation',
    kind: 'style',
    status: 'resolved',
    selectedMappingId: 'selected',
    mappingCandidates: [
      { id: 'unselected', source: { file: 'ignored.css', line: 1 } },
      { id: 'selected', source: { file: 'styles.css', line: 10 } },
    ],
  };
  const change = mappedReviewChange({
    operationId: operation.id,
    mappingCandidates: [{ id: 'change', source: { file: 'heading.css', line: 20 } }],
  });
  const original = structuredClone({ change, operation });
  assert.deepEqual(reviewSource(change, operation), { file: 'styles.css', line: 10 });
  assert.deepEqual(reviewSource(change), { file: 'heading.css', line: 20 });
  assert.deepEqual(reviewBatchSummary([change], [operation]).knownFiles, ['styles.css']);
  assert.deepEqual(reviewBatchSummary([change]).knownFiles, ['heading.css']);
  assert.deepEqual(reviewBatchSummary([mappedReviewChange()]).knownFiles, ['index.html']);
  const unknown = mappedReviewChange({ target: { platform: 'web', locator: { foundryId: 'x' } } });
  assert.equal(reviewBatchSummary([unknown]).knownFileCount, 0);
  assert.equal(reviewBatchSummary([unknown]).filesLabel, 'Unknown');
  assert.equal(reviewBatchSummary([unknown, change]).filesLabel, '1 known · Unknown');
  const ambiguous = { ...operation, selectedMappingId: undefined };
  assert.equal(reviewSource(change, ambiguous), undefined);
  assert.equal(reviewBatchSummary([change], [ambiguous]).mappingIssues, 1);
  assert.equal(reviewBatchSummary([change], [ambiguous]).knownFileCount, 0);
  assert.deepEqual({ change, operation }, original);
});

test('Review scope labels derive from explicit categories, scopes and source operation kinds', () => {
  const source = mappedReviewChange({ category: 'content' });
  assert.equal(reviewBatchSummary([source]).riskLabel, 'Source operations');
  assert.equal(reviewBatchSummary([source, mappedReviewChange()]).riskLabel, 'Mixed changes');
  assert.equal(
    reviewBatchSummary([mappedReviewChange({ scope: 'component' })]).riskLabel,
    'Shared styles',
  );
  assert.equal(
    reviewBatchSummary([mappedReviewChange({ category: undefined })]).riskLabel,
    'Unknown',
  );
  assert.equal(
    reviewBatchSummary(
      [mappedReviewChange({ operationId: 'token' })],
      [{ id: 'token', kind: 'token-refactor' }],
    ).riskLabel,
    'Source operations',
  );
  const empty = reviewBatchSummary();
  assert.equal(empty.included, 0);
  assert.equal(empty.knownFileCount, 0);
  for (const key of ['filesLabel', 'mappingLabel', 'riskLabel'])
    assert.equal(empty[key], 'No changes');
});
