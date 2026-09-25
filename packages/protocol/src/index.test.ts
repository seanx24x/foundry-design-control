import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROTOCOL_VERSION,
  applyRunSchema,
  changeKey,
  changeSetSchema,
  coalesceChanges,
  designBranchRecordBundleSchema,
  designBranchRecordSchema,
  designChangeSchema,
  designBranchSchema,
  designOperationSchema,
  deliveryRecordSchema,
  projectDesignGraphSchema,
  renderChangePrompt,
  stressTestSessionSchema,
  visualAgentRequestSchema,
  type ChangeSet,
} from './index.js';

test('parses a versioned delivery record with explicit readiness evidence', () => {
  const record = deliveryRecordSchema.parse({
    version: 1,
    id: 'delivery_1',
    sessionId: 'ses_1',
    applyRunId: 'run_1',
    title: 'Refine primary action',
    status: 'ready',
    changeIds: ['change_1'],
    acceptanceCriteria: [{ id: 'criterion_1', label: 'Primary action renders at 48px' }],
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
  });
  assert.equal(record.acceptanceCriteria[0]?.status, 'pending');
  assert.equal(record.narrativeSource, 'deterministic');
});

test('parses portable branch records with source context and compatibility evidence', () => {
  const bundle = designBranchRecordBundleSchema.parse({
    format: 'foundry.design-branch-records',
    version: 1,
    exportedAt: '2026-09-06T00:00:00.000Z',
    records: [
      {
        version: 1,
        id: 'record_1',
        branchId: 'branch_1',
        name: 'Editorial hierarchy',
        outcome: 'chosen',
        rationale: 'Clearer progression from headline to supporting copy.',
        context: {
          projectRoot: '/project',
          revision: 'rev-1',
          designGraphRevision: 'graph-1',
          platform: 'web',
          viewport: { width: 1440, height: 900 },
          theme: 'light',
          breakpoint: 'desktop',
          state: 'default',
        },
        changes: [],
        operations: [],
        sourceRelationships: [
          {
            targetId: 'hero',
            targetLabel: 'Hero heading',
            property: 'fontSize',
            componentPath: ['LandingPage', 'Hero'],
            source: { file: 'src/Hero.tsx', line: 18 },
          },
        ],
        compatibility: {
          status: 'current',
          matchedSources: 1,
          totalSources: 1,
          warnings: [],
          checkedAt: '2026-09-06T00:00:00.000Z',
        },
        createdAt: '2026-09-06T00:00:00.000Z',
        updatedAt: '2026-09-06T00:00:00.000Z',
      },
    ],
  });
  assert.equal(bundle.records[0]?.sourceRelationships[0]?.source?.file, 'src/Hero.tsx');
  assert.equal(bundle.records[0]?.compatibility.status, 'current');
});

test('keeps visual agent proposals grounded and separate from approved changes', () => {
  const request = visualAgentRequestSchema.parse({
    id: 'ask_1',
    sessionId: 'ses_1',
    title: 'Improve hierarchy',
    prompt: 'Why do these labels feel inconsistent?',
    status: 'ready',
    context: {
      targets: [
        {
          id: 'label-1',
          selector: '[data-foundry-id="label-1"]',
          label: 'Field label',
          kind: 'label',
          source: 'src/Form.tsx:20',
          confidence: 'instrumented',
          geometry: { x: 20, y: 40, width: 120, height: 20, scale: 2 },
          measurements: { fontSize: '12px' },
        },
      ],
      comments: [],
      viewport: { width: 1440, height: 900 },
      breakpoint: 'desktop',
      theme: 'dark',
      state: 'default',
      tokens: [],
    },
    messages: [],
    proposals: [
      {
        id: 'proposal_1',
        name: 'Quiet hierarchy',
        summary: 'Align the labels to one shared type token.',
        reasoning: ['The selected labels use two sizes.'],
        exactValues: ['font-size: 12px'],
        sourceLocations: ['src/Form.tsx:20'],
        responsiveImpact: 'No breakpoint change.',
        verificationPlan: ['Measure both labels after rebuild.'],
        changes: [],
        status: 'proposed',
        createdAt: '2026-09-05T00:00:00.000Z',
        updatedAt: '2026-09-05T00:00:00.000Z',
      },
    ],
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
  });
  assert.equal(request.context.targets[0]?.measurements.fontSize, '12px');
  assert.equal(request.proposals[0]?.status, 'proposed');
});

test('keeps stress sessions explicitly temporary and viewport-bound', () => {
  const session = stressTestSessionSchema.parse({
    conditions: ['long-content', 'keyboard-only'],
    scope: 'selection',
    targetId: 'button-primary',
    viewport: { width: 390, height: 844 },
    temporary: true,
    appliedAt: '2026-09-05T00:00:00.000Z',
  });
  assert.deepEqual(session.conditions, ['long-content', 'keyboard-only']);
  assert.equal(session.temporary, true);
  assert.equal(session.viewport.width, 390);
});

test('parses alias-aware tokens and reviewable token promotion candidates', () => {
  const graph = projectDesignGraphSchema.parse({
    protocolVersion: PROTOCOL_VERSION,
    projectRoot: '/project',
    tokens: [
      {
        id: 'semantic',
        name: '--color-action',
        value: 'var(--blue-500)',
        category: 'color',
        aliasOfTokenId: 'primitive',
        aliasOfTokenName: '--blue-500',
        resolvedValue: '#3478f6',
        aliasChain: ['--color-action', '--blue-500'],
        aliasStatus: 'resolved',
      },
    ],
    tokenPromotions: [
      {
        id: 'promotion-1',
        value: '#3478f6',
        category: 'color',
        property: 'background-color',
        occurrenceCount: 3,
        sources: [{ file: 'src/Button.css', line: 12 }],
        recommendation: 'use-existing',
        relation: 'exact',
        suggestedTokenId: 'semantic',
        suggestedTokenName: '--color-action',
        suggestedValue: 'var(--color-action)',
        aliasChain: ['--color-action', '--blue-500'],
      },
    ],
    indexedAt: '2026-09-06T00:00:00.000Z',
  });
  assert.equal(graph.tokens[0]?.aliasStatus, 'resolved');
  assert.equal(graph.tokenPromotions?.[0]?.occurrenceCount, 3);
  assert.equal(graph.tokenPromotions?.[0]?.recommendation, 'use-existing');
});

const base = designChangeSchema.parse({
  id: 'chg_1',
  target: {
    id: 'button-primary',
    platform: 'web',
    semanticRole: 'button',
    label: 'Save button',
    componentPath: ['Toolbar', 'Button'],
    geometry: { x: 10, y: 20, width: 100, height: 40 },
    locator: { selector: '[data-foundry-id="button-primary"]' },
    confidence: 'measured',
    evidence: ['getBoundingClientRect'],
  },
  category: 'layout',
  property: 'width',
  before: 100,
  after: 120,
  unit: 'px',
  scope: 'instance',
  context: { breakpoint: 'desktop', theme: 'light', state: 'default' },
  confidence: 'measured',
  evidence: ['computed style'],
  createdAt: '2026-08-29T00:00:00.000Z',
  updatedAt: '2026-08-29T00:00:00.000Z',
  status: 'approved',
});

test('coalesces repeated edits while preserving the original before value', () => {
  const changes = coalesceChanges([
    { ...base, status: 'draft' },
    {
      ...base,
      id: 'chg_2',
      before: 120,
      after: 144,
      status: 'draft',
      updatedAt: '2026-08-29T00:01:00.000Z',
    },
  ]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0]?.before, 100);
  assert.equal(changes[0]?.after, 144);
  assert.equal(changes[0]?.id, 'chg_1');
});

test('net-zero exploratory edits disappear without removing reviewed history', () => {
  const forward = { ...base, status: 'draft' as const };
  const back = { ...forward, id: 'chg_back', before: base.after, after: base.before };
  assert.deepEqual(coalesceChanges([forward, back]), []);
  for (const status of ['approved', 'applied'] as const) {
    assert.equal(coalesceChanges([{ ...back, status }]).length, 1);
  }
  assert.equal(coalesceChanges([forward, back, { ...forward, id: 'chg_again' }]).length, 1);
});

test('migrates legacy change contexts to singleton context sets', () => {
  const parsed = designChangeSchema.parse({ ...base, contextSet: undefined });
  assert.deepEqual(parsed.contextSet, {
    breakpoints: ['desktop'],
    themes: ['light'],
    states: ['default'],
  });
});

test('requires every context set to include the exact capture context', () => {
  assert.throws(
    () =>
      designChangeSchema.parse({
        ...base,
        contextSet: {
          breakpoints: ['mobile'],
          themes: ['dark'],
          states: ['hover'],
        },
      }),
    /Context set must contain the exact capture breakpoint, theme, state/,
  );
});

test('coalesces equal context sets and preserves the latest exact capture context', () => {
  const changes = coalesceChanges([
    {
      ...base,
      status: 'draft',
      contextSet: {
        breakpoints: ['desktop', 'mobile'],
        themes: ['light'],
        states: ['default'],
      },
    },
    {
      ...base,
      id: 'chg_2',
      before: 120,
      after: 144,
      status: 'draft',
      context: { ...base.context, breakpoint: 'mobile' },
      contextSet: {
        breakpoints: ['mobile', 'desktop'],
        themes: ['light'],
        states: ['default'],
      },
      updatedAt: '2026-08-29T00:01:00.000Z',
    },
  ]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0]?.context.breakpoint, 'mobile');
  assert.deepEqual(changes[0]?.contextSet.breakpoints, ['mobile', 'desktop']);
  assert.equal(changes[0]?.before, 100);
  assert.equal(changes[0]?.after, 144);
});

test('keeps edits with different context sets separate', () => {
  const changes = coalesceChanges([
    { ...base, status: 'draft' },
    {
      ...base,
      id: 'chg_2',
      status: 'draft',
      contextSet: {
        breakpoints: ['desktop', 'mobile'],
        themes: ['light'],
        states: ['default'],
      },
    },
  ]);
  assert.equal(changes.length, 2);
});

test('keeps edits with different responsive scopes separate', () => {
  const changes = coalesceChanges([
    { ...base, status: 'draft' },
    {
      ...base,
      id: 'chg_2',
      status: 'draft',
      context: { ...base.context, breakpoint: 'mobile' },
      contextSet: { ...base.contextSet, breakpoints: ['mobile'] },
    },
  ]);
  assert.equal(changes.length, 2);
});

test('uses structural context-set keys without delimiter collisions', () => {
  const commaValue = designChangeSchema.parse({
    ...base,
    status: 'draft',
    context: { ...base.context, breakpoint: 'a,b' },
    contextSet: {
      breakpoints: ['a,b'],
      themes: ['light'],
      states: ['default'],
    },
  });
  const twoValues = designChangeSchema.parse({
    ...base,
    id: 'chg_2',
    status: 'draft',
    context: { ...base.context, breakpoint: 'a' },
    contextSet: {
      breakpoints: ['a', 'b'],
      themes: ['light'],
      states: ['default'],
    },
  });

  assert.notEqual(changeKey(commaValue), changeKey(twoValues));
  assert.deepEqual(
    coalesceChanges([commaValue, twoValues]).map((change) => change.id),
    ['chg_1', 'chg_2'],
  );
});

test('preserves reviewed history and starts a fresh coalescing chain', () => {
  for (const status of ['approved', 'applied', 'rejected'] as const) {
    const changes = coalesceChanges([
      { ...base, status },
      {
        ...base,
        id: `chg_${status}_next`,
        before: 120,
        after: 144,
        status: 'draft',
        createdAt: '2026-08-29T00:01:00.000Z',
        updatedAt: '2026-08-29T00:01:00.000Z',
      },
      {
        ...base,
        id: `chg_${status}_latest`,
        before: 144,
        after: 160,
        status: 'draft',
        createdAt: '2026-08-29T00:02:00.000Z',
        updatedAt: '2026-08-29T00:02:00.000Z',
      },
    ]);

    assert.equal(changes.length, 2);
    assert.equal(changes[0]?.id, 'chg_1');
    assert.equal(changes[0]?.status, status);
    assert.equal(changes[0]?.after, 120);
    assert.equal(changes[1]?.id, `chg_${status}_next`);
    assert.equal(changes[1]?.before, 120);
    assert.equal(changes[1]?.after, 160);
  }
});

test('parses an isolated design branch with decisions and provenance', () => {
  const branch = designBranchSchema.parse({
    id: 'branch_a',
    name: 'Quiet direction',
    status: 'exploring',
    changes: [base],
    operations: [],
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
  });
  assert.equal(branch.name, 'Quiet direction');
  assert.equal(branch.changes[0]?.property, 'width');
  assert.equal(branch.status, 'exploring');
});

test('renders a portable prompt from canonical JSON', () => {
  const set: ChangeSet = {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'ses_1',
    context: {
      projectRoot: '/project',
      platform: 'web',
      theme: 'light',
      breakpoint: 'desktop',
      state: 'default',
    },
    changes: [base],
    operations: [],
    screenshots: [],
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  };
  const prompt = renderChangePrompt(set);
  assert.match(prompt, /Save button — width/);
  assert.match(prompt, /100px → 120px/);
  assert.match(prompt, /Affected contexts: breakpoints=desktop; themes=light; states=default/);
  assert.match(prompt, /getBoundingClientRect/);
});

test('requires reviewed changes in portable prompt exports', () => {
  const set: ChangeSet = {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'ses_1',
    context: {
      projectRoot: '/project',
      platform: 'web',
      theme: 'light',
      breakpoint: 'desktop',
      state: 'default',
    },
    changes: [{ ...base, status: 'draft' }],
    operations: [],
    screenshots: [],
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  };
  assert.match(renderChangePrompt(set), /No reviewed changes are present/);
});

test('reads protocol 1.2 change sets and migrates them to 1.3 context sets', () => {
  const parsed = changeSetSchema.parse({
    protocolVersion: '1.2.0',
    sessionId: 'ses_legacy',
    context: {
      projectRoot: '/project',
      platform: 'web',
      theme: 'light',
      breakpoint: 'desktop',
      state: 'default',
    },
    changes: [{ ...base, contextSet: undefined }],
    operations: [],
    screenshots: [],
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });
  assert.equal(parsed.protocolVersion, '1.3.0');
  assert.deepEqual(parsed.changes[0]?.contextSet.breakpoints, ['desktop']);
});

test('parses a portable apply run with progress and validation', () => {
  const run = applyRunSchema.parse({
    id: 'run_1',
    sessionId: 'ses_1',
    changeIds: ['chg_1'],
    revision: 'abc123',
    state: 'rebuilding',
    agent: { name: 'codex' },
    claimAttemptId: 'claim_1',
    claimHeartbeatAt: '2026-08-29T00:00:30.000Z',
    messages: [
      {
        state: 'applying',
        message: 'Updated the button source.',
        createdAt: '2026-08-29T00:01:00.000Z',
      },
    ],
    changedFiles: ['src/Button.tsx'],
    validationResults: [{ name: 'typecheck', passed: true }],
    verificationResults: [],
    attempts: 1,
    requestedAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:01:00.000Z',
  });
  assert.equal(run.state, 'rebuilding');
  assert.equal(run.claimAttemptId, 'claim_1');
  assert.equal(run.requeueCount, 0);
  assert.equal(run.validationResults[0]?.passed, true);
});

test('freezes one exact reviewed change set on an apply run', () => {
  const reviewedChangeSet = changeSetSchema.parse({
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'ses_1',
    context: {
      projectRoot: '/project',
      platform: 'web',
      breakpoint: 'desktop',
      theme: 'light',
      state: 'default',
    },
    changes: [base],
    operations: [],
    screenshots: [],
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });
  const run = applyRunSchema.parse({
    id: 'run_frozen',
    sessionId: 'ses_1',
    changeIds: ['chg_1'],
    reviewedChangeSet,
    state: 'queued',
    requestedAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });
  assert.equal(run.reviewedChangeSet?.changes[0]?.after, 120);
  assert.deepEqual(run.reviewedChangeSet?.changes[0]?.contextSet, {
    breakpoints: ['desktop'],
    themes: ['light'],
    states: ['default'],
  });

  assert.throws(
    () =>
      applyRunSchema.parse({
        ...run,
        changeIds: ['a-different-change'],
      }),
    /must contain each apply run change exactly once/,
  );
});

test('parses a revisioned project design graph', () => {
  const graph = projectDesignGraphSchema.parse({
    protocolVersion: '1.2.0',
    projectRoot: '/project',
    revision: 'abc123',
    tokens: [
      {
        id: 'token-space-3',
        name: '--space-3',
        value: '12px',
        category: 'spacing',
        cssVariable: '--space-3',
      },
    ],
    components: [
      {
        id: 'component-button',
        name: 'Button',
        variants: [
          {
            id: 'variant-quiet',
            label: 'Quiet',
            property: 'story',
            value: 'Quiet',
            props: { story: 'Quiet', disabled: false },
          },
        ],
      },
    ],
    breakpoints: [{ id: 'mobile', label: 'Mobile', width: 390 }],
    themes: [],
    states: [],
    motionPresets: [
      {
        id: 'motion-card',
        label: 'Motion article',
        duration: 480,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        adapter: 'motion',
        sourceProperty: 'transition',
        configuration: { type: 'tween' },
        source: { file: 'Card.tsx', line: 12 },
        evidence: ['Motion source import'],
      },
    ],
    tokenUsages: [
      {
        id: 'usage-space-3',
        tokenId: 'token-space-3',
        tokenName: '--space-3',
        value: '12px',
        category: 'spacing',
        kind: 'reference',
        source: { file: 'theme.css', line: 8 },
      },
    ],
    designSystemFindings: [
      {
        id: 'finding-space-3',
        kind: 'literal-drift',
        title: 'Use --space-3',
        detail: 'A literal repeats the project token.',
        tokenIds: ['token-space-3'],
        suggestedTokenId: 'token-space-3',
      },
    ],
    indexedAt: '2026-08-29T00:00:00.000Z',
  });
  assert.equal(graph.tokens[0]?.cssVariable, '--space-3');
  assert.equal(graph.motionPresets[0]?.adapter, 'motion');
  assert.equal(graph.motionPresets[0]?.sourceProperty, 'transition');
  assert.equal(graph.breakpoints[0]?.height, 900);
  assert.deepEqual(graph.components[0]?.variants[0]?.props, {
    story: 'Quiet',
    disabled: false,
  });
  assert.equal(graph.tokenUsages[0]?.source.line, 8);
  assert.equal(graph.designSystemFindings[0]?.kind, 'literal-drift');
  assert.equal(graph.protocolVersion, '1.3.0');
});

test('accepts source-aware variant change scope', () => {
  assert.equal(designChangeSchema.parse({ ...base, scope: 'variant' }).scope, 'variant');
});

test('requires explicit resolution for ambiguous semantic operations', () => {
  const operation = designOperationSchema.parse({
    id: 'op_1',
    kind: 'resize',
    label: 'Resize Save button',
    targetIds: ['button-primary'],
    mappingCandidates: [
      {
        id: 'map-width',
        label: 'Set element width',
        intent: 'resize',
        property: 'width',
        value: 120,
        confidence: 'inferred',
      },
      {
        id: 'map-basis',
        label: 'Set flex basis',
        intent: 'resize',
        property: 'flexBasis',
        value: 120,
        confidence: 'inferred',
      },
    ],
    status: 'unresolved',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });
  assert.equal(operation.mappingCandidates.length, 2);
  assert.equal(operation.selectedMappingId, undefined);
});

test('validates mapping identities while preserving sole-candidate compatibility', () => {
  const soleCandidate = {
    id: 'map-width',
    label: 'Set element width',
    intent: 'resize' as const,
    property: 'width',
    value: 120,
    confidence: 'inferred' as const,
  };
  const operation = designOperationSchema.parse({
    id: 'op-sole',
    kind: 'resize',
    label: 'Resize Save button',
    targetIds: ['button-primary'],
    mappingCandidates: [soleCandidate],
    status: 'resolved',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });
  assert.equal(operation.selectedMappingId, undefined);

  assert.throws(
    () =>
      designOperationSchema.parse({
        ...operation,
        mappingCandidates: [],
      }),
    /Resolved operations require a selected source mapping/,
  );
  assert.throws(
    () =>
      designOperationSchema.parse({
        ...operation,
        selectedMappingId: 'missing',
      }),
    /Selected source mapping must name an existing candidate/,
  );
  assert.throws(
    () =>
      designChangeSchema.parse({
        ...base,
        mappingCandidates: [soleCandidate, { ...soleCandidate }],
      }),
    /Source mapping candidate ids must be unique/,
  );
});

test('rejects duplicate and inconsistent change-operation identities', () => {
  const operation = designOperationSchema.parse({
    id: 'op-1',
    kind: 'resize',
    label: 'Resize Save button',
    targetIds: ['button-primary'],
    changeIds: ['chg_1'],
    mappingCandidates: [
      {
        id: 'map-width',
        label: 'Set element width',
        intent: 'resize',
        property: 'width',
        value: 120,
        confidence: 'inferred',
      },
    ],
    status: 'resolved',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });
  const set = {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'ses_1',
    context: {
      projectRoot: '/project',
      platform: 'web' as const,
      theme: 'light',
      breakpoint: 'desktop',
      state: 'default',
    },
    changes: [{ ...base, operationId: operation.id }],
    operations: [operation],
    screenshots: [],
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  };
  assert.equal(changeSetSchema.parse(set).operations[0]?.id, 'op-1');
  assert.throws(
    () => changeSetSchema.parse({ ...set, changes: [set.changes[0], set.changes[0]] }),
    /Design change ids must be unique/,
  );
  assert.throws(
    () => changeSetSchema.parse({ ...set, operations: [operation, operation] }),
    /Design operation ids must be unique/,
  );
  assert.throws(
    () =>
      changeSetSchema.parse({
        ...set,
        operations: [{ ...operation, changeIds: [] }],
      }),
    /references an inconsistent operation/,
  );
  assert.throws(
    () =>
      designBranchSchema.parse({
        id: 'branch-duplicate',
        name: 'Duplicate operation',
        status: 'exploring',
        changes: set.changes,
        operations: [operation, operation],
        createdAt: set.createdAt,
        updatedAt: set.updatedAt,
      }),
    /Design operation ids must be unique/,
  );
  assert.throws(
    () =>
      designBranchRecordSchema.parse({
        version: 1,
        id: 'record-duplicate',
        branchId: 'branch-duplicate',
        name: 'Duplicate operation record',
        outcome: 'chosen',
        context: set.context,
        changes: set.changes,
        operations: [operation, operation],
        sourceRelationships: [],
        compatibility: {
          status: 'current',
          matchedSources: 0,
          totalSources: 0,
          warnings: [],
          checkedAt: set.updatedAt,
        },
        createdAt: set.createdAt,
        updatedAt: set.updatedAt,
      }),
    /Design operation ids must be unique/,
  );
});

test('preserves source-backed component variant authoring and operations', () => {
  const graph = projectDesignGraphSchema.parse({
    protocolVersion: PROTOCOL_VERSION,
    projectRoot: '/tmp/project',
    components: [
      {
        id: 'button',
        name: 'Button',
        variantAxes: [
          {
            id: 'tone',
            label: 'Tone',
            property: 'tone',
            values: ['primary', 'quiet'],
            adapter: 'cva',
            source: { file: 'src/Button.tsx', line: 5 },
            sourceProperty: 'variants.tone',
            canCreate: true,
            evidence: ['CVA variants object'],
          },
        ],
      },
    ],
    containerQueries: [
      {
        id: 'container-card-480',
        label: 'card · min 480px',
        name: 'card',
        condition: 'min-width: 480px',
        minWidth: 480,
        source: { file: 'src/Card.css', line: 24 },
        evidence: ['CSS @container rule'],
      },
    ],
    indexedAt: '2026-09-05T00:00:00.000Z',
  });
  assert.equal(graph.components[0]?.variantAxes[0]?.adapter, 'cva');
  assert.equal(graph.containerQueries?.[0]?.minWidth, 480);
  const operation = designOperationSchema.parse({
    id: 'op-variant',
    kind: 'component-variant',
    label: 'Create Danger variant',
    targetIds: ['button'],
    mappingCandidates: [
      {
        id: 'map-variant',
        label: 'Create source-backed component variant',
        intent: 'component-variant',
        property: 'component.variant.create.tone',
        value: 'danger',
        source: { file: 'src/Button.tsx', line: 5 },
        scope: 'component',
        confidence: 'instrumented',
        evidence: ['indexed component variant axis'],
        blastRadius: 4,
      },
    ],
    selectedMappingId: 'map-variant',
    status: 'resolved',
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
  });
  assert.equal(operation.kind, 'component-variant');
});
