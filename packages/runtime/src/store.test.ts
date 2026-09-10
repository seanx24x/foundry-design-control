import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SessionStore, type SessionStoreOptions } from './store.js';

test('persists and authenticates a coalesced design session', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-store-'));
  const store = new SessionStore(root);
  const session = await store.create({
    projectRoot: '/project',
    platform: 'web',
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const target = {
    id: 'target',
    platform: 'web' as const,
    semanticRole: 'button',
    label: 'Button',
    componentPath: [],
    geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
    locator: { selector: 'button' },
    confidence: 'measured' as const,
    evidence: ['live geometry'],
  };
  const common = {
    target,
    category: 'layout' as const,
    property: 'width',
    unit: 'px',
    scope: 'instance' as const,
    context: { breakpoint: 'current', theme: 'current', state: 'current' },
    confidence: 'measured' as const,
    evidence: ['computed style'],
    status: 'draft' as const,
  };
  await store.addChange(session.changeSet.sessionId, {
    ...common,
    before: 100,
    after: 120,
  });
  await store.addChange(session.changeSet.sessionId, {
    ...common,
    before: 120,
    after: 144,
  });
  const restored = await store.authenticate(session.changeSet.sessionId, session.token);
  assert.equal(restored.changeSet.changes.length, 1);
  assert.equal(restored.changeSet.changes[0]?.before, 100);
  assert.equal(restored.changeSet.changes[0]?.after, 144);
});

test('preserves concurrent changes and always leaves valid session JSON', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-store-concurrent-'));
  const store = new SessionStore(root);
  const session = await store.create({
    projectRoot: '/project',
    platform: 'web',
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const id = session.changeSet.sessionId;
  await Promise.all(
    Array.from({ length: 24 }, (_, index) =>
      store.addChange(id, {
        target: {
          id: `target-${index}`,
          platform: 'web',
          semanticRole: 'button',
          label: `Button ${index}`,
          componentPath: [],
          geometry: { x: index, y: 0, width: 100, height: 40, scale: 1 },
          locator: { selector: `[data-index="${index}"]` },
          confidence: 'measured',
          evidence: ['live geometry'],
        },
        category: 'layout',
        property: 'width',
        before: 100,
        after: 100 + index,
        unit: 'px',
        scope: 'instance',
        context: { breakpoint: 'current', theme: 'current', state: 'current' },
        confidence: 'measured',
        evidence: ['computed style'],
        status: 'draft',
      }),
    ),
  );
  const restored = await store.authenticate(id, session.token);
  assert.equal(restored.changeSet.changes.length, 24);
});

test('isolates, composes, and promotes design branches into review', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-branches-'));
  const store = new SessionStore(root);
  const session = await store.create({
    projectRoot: '/project',
    platform: 'web',
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const id = session.changeSet.sessionId;
  const target = {
    id: 'hero',
    platform: 'web' as const,
    semanticRole: 'heading',
    label: 'Hero',
    componentPath: [],
    geometry: { x: 0, y: 0, width: 600, height: 120, scale: 1 },
    locator: { selector: 'h1' },
    confidence: 'measured' as const,
    evidence: ['live geometry'],
  };
  const change = (property: string, before: number, after: number) => ({
    target,
    category: 'layout' as const,
    property,
    before,
    after,
    unit: 'px',
    scope: 'instance' as const,
    context: { breakpoint: 'current', theme: 'current', state: 'current' },
    confidence: 'measured' as const,
    evidence: ['computed style'],
    status: 'draft' as const,
  });

  let stored = await store.createDesignBranch(id, { name: 'Option A' });
  const optionA = stored.activeDesignBranchId!;
  stored = await store.addChange(id, change('width', 600, 640));
  assert.equal(stored.changeSet.changes.length, 0);
  assert.equal(stored.designBranches[0]?.changes.length, 1);

  await store.activateDesignBranch(id);
  stored = await store.createDesignBranch(id, { name: 'Option B' });
  const optionB = stored.activeDesignBranchId!;
  stored = await store.addChange(id, change('height', 120, 144));
  assert.equal(stored.designBranches[0]?.changes[0]?.property, 'width');
  assert.equal(stored.designBranches[1]?.changes[0]?.property, 'height');

  stored = await store.composeDesignBranch(id, {
    name: 'Final direction',
    selections: [
      { branchId: optionA, changeIds: [stored.designBranches[0]!.changes[0]!.id] },
      { branchId: optionB, changeIds: [stored.designBranches[1]!.changes[0]!.id] },
    ],
  });
  const finalBranch = stored.activeDesignBranchId!;
  assert.equal(stored.designBranches.at(-1)?.changes.length, 2);

  stored = await store.promoteDesignBranch(id, finalBranch);
  assert.equal(stored.activeDesignBranchId, undefined);
  assert.equal(stored.changeSet.changes.length, 2);
  assert.ok(stored.changeSet.changes.every((item) => item.status === 'draft'));
  assert.equal(stored.designBranches.at(-1)?.status, 'chosen');
});

test('captures, imports, assesses, restores, and removes portable branch records', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-branch-records-'));
  const store = new SessionStore(root);
  const session = await store.create({
    projectRoot: '/project',
    revision: 'rev-1',
    platform: 'web',
    targetName: 'Fixture',
    viewport: { width: 1440, height: 900 },
    theme: 'light',
    breakpoint: 'desktop',
    state: 'default',
  });
  const id = session.changeSet.sessionId;
  await store.setDesignGraph(id, {
    protocolVersion: '1.2.0',
    projectRoot: '/project',
    revision: 'graph-1',
    tokens: [],
    components: [
      {
        id: 'hero',
        name: 'Hero',
        source: { file: 'src/Hero.tsx', line: 1 },
        instances: 1,
        variants: [],
        variantAxes: [],
        evidence: [],
      },
    ],
    breakpoints: [],
    themes: [],
    states: [],
    motionPresets: [],
    tokenUsages: [],
    designSystemFindings: [],
    indexedAt: '2026-09-06T00:00:00.000Z',
  });
  let stored = await store.createDesignBranch(id, { name: 'Editorial hierarchy' });
  const branch = stored.activeDesignBranchId!;
  stored = await store.addChange(id, {
    target: {
      id: 'hero',
      platform: 'web',
      semanticRole: 'heading',
      label: 'Hero heading',
      componentPath: ['LandingPage', 'Hero'],
      source: { file: 'src/Hero.tsx', line: 18 },
      geometry: { x: 0, y: 0, width: 600, height: 120, scale: 1 },
      locator: { selector: 'h1' },
      confidence: 'instrumented',
      evidence: ['source mapping'],
    },
    category: 'typography',
    property: 'fontSize',
    before: '56px',
    after: '64px',
    scope: 'component',
    context: { breakpoint: 'desktop', theme: 'light', state: 'default' },
    confidence: 'instrumented',
    evidence: ['computed style'],
    status: 'draft',
  });
  stored = await store.updateDesignBranch(id, branch, {
    status: 'rejected',
    rejectionReason: 'The larger headline overwhelms the form.',
  });
  assert.equal(stored.designBranchRecords.length, 1);
  assert.equal(stored.designBranchRecords[0]?.outcome, 'rejected');
  assert.equal(stored.designBranchRecords[0]?.compatibility.status, 'current');

  const importedSession = await store.create({
    projectRoot: '/another-machine/project',
    revision: 'rev-1',
    platform: 'web',
    targetName: 'Fixture',
    viewport: { width: 1440, height: 900 },
    theme: 'light',
    breakpoint: 'desktop',
    state: 'default',
  });
  const importedId = importedSession.changeSet.sessionId;
  await store.setDesignGraph(importedId, {
    ...stored.designGraph!,
    projectRoot: '/another-machine/project',
  });
  let imported = await store.importDesignBranchRecords(importedId, {
    format: 'foundry.design-branch-records',
    version: 1,
    exportedAt: '2026-09-06T01:00:00.000Z',
    records: stored.designBranchRecords,
  });
  assert.equal(imported.designBranchRecords[0]?.compatibility.status, 'current');
  assert.ok(imported.designBranchRecords[0]?.importedAt);

  const recordId = imported.designBranchRecords[0]!.id;
  imported = await store.restoreDesignBranchRecord(importedId, recordId);
  assert.equal(imported.designBranches.at(-1)?.name, 'Editorial hierarchy (restored)');
  assert.equal(imported.designBranches.at(-1)?.changes.length, 1);
  imported = await store.removeDesignBranchRecord(importedId, recordId);
  assert.equal(imported.designBranchRecords.length, 0);
});

test('deletes an unapplied change and removes its orphaned operation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-delete-change-'));
  const store = new SessionStore(root);
  const session = await store.create({
    projectRoot: '/project',
    platform: 'web',
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const id = session.changeSet.sessionId;
  const changed = await store.addChange(id, {
    target: {
      id: 'button',
      platform: 'web',
      semanticRole: 'button',
      label: 'Button',
      componentPath: [],
      geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
      locator: { selector: 'button' },
      confidence: 'measured',
      evidence: ['live geometry'],
    },
    category: 'layout',
    property: 'width',
    before: 100,
    after: 120,
    unit: 'px',
    scope: 'instance',
    context: { breakpoint: 'current', theme: 'current', state: 'current' },
    confidence: 'measured',
    evidence: ['computed style'],
    status: 'draft',
  });
  const changeId = changed.changeSet.changes[0]!.id;

  const deleted = await store.deleteChange(id, changeId);

  assert.equal(deleted.removedChange.id, changeId);
  assert.equal(deleted.stored.changeSet.changes.length, 0);
});

test('persists the design graph and resolves an ambiguous semantic operation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-graph-'));
  const store = new SessionStore(root);
  const session = await store.create({
    projectRoot: '/project',
    revision: 'rev-1',
    platform: 'web',
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const id = session.changeSet.sessionId;
  await store.setDesignGraph(id, {
    protocolVersion: '1.2.0',
    projectRoot: '/project',
    revision: 'rev-1',
    tokens: [],
    components: [],
    breakpoints: [],
    themes: [],
    states: [],
    motionPresets: [],
    tokenUsages: [],
    designSystemFindings: [],
    indexedAt: '2026-08-29T00:00:00.000Z',
  });
  let stored = await store.addOperation(id, {
    kind: 'resize',
    label: 'Resize card',
    targetIds: ['card'],
    changeIds: [],
    stateIds: [],
    mappingCandidates: [
      {
        id: 'map-width',
        label: 'Set width',
        intent: 'resize',
        property: 'width',
        value: 320,
        confidence: 'inferred',
        evidence: ['block layout'],
        blastRadius: 1,
        scope: 'instance',
      },
      {
        id: 'map-basis',
        label: 'Set flex basis',
        intent: 'resize',
        property: 'flexBasis',
        value: 320,
        confidence: 'inferred',
        evidence: ['flex parent'],
        blastRadius: 1,
        scope: 'instance',
      },
    ],
    status: 'unresolved',
  });
  const operation = stored.changeSet.operations[0]!;
  stored = await store.resolveOperation(id, operation.id, 'map-basis');
  assert.equal(stored.designGraph?.revision, 'rev-1');
  assert.equal(stored.changeSet.designGraphRevision, 'rev-1');
  assert.equal(stored.changeSet.operations[0]?.status, 'resolved');
  assert.equal(stored.changeSet.operations[0]?.selectedMappingId, 'map-basis');
});

async function reviewedSession(options: SessionStoreOptions = {}) {
  const root = await mkdtemp(join(tmpdir(), 'foundry-apply-'));
  const store = new SessionStore(root, options);
  const session = await store.create({
    projectRoot: '/project',
    revision: 'rev-1',
    platform: 'web',
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const target = {
    id: 'button',
    platform: 'web' as const,
    semanticRole: 'button',
    label: 'Button',
    componentPath: [],
    geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
    locator: { selector: 'button' },
    confidence: 'measured' as const,
    evidence: ['live geometry'],
  };
  const changed = await store.addChange(session.changeSet.sessionId, {
    target,
    category: 'border',
    property: 'borderRadius',
    before: 2,
    after: 24,
    unit: 'px',
    scope: 'instance',
    context: { breakpoint: 'current', theme: 'current', state: 'current' },
    confidence: 'measured',
    evidence: ['computed style'],
    status: 'draft',
  });
  return { root, store, session, changeId: changed.changeSet.changes[0]!.id };
}

test('reviews, claims, applies, and verifies one idempotent apply run', async () => {
  const { store, session, changeId } = await reviewedSession();
  let stored = await store.createApplyRun(session.changeSet.sessionId, {
    reviews: [{ changeId, approved: true, after: 28 }],
    revision: 'rev-1',
  });
  const runId = stored.applyRuns[0]!.id;
  stored = await store.claimApplyRun(session.changeSet.sessionId, runId, {
    agent: { name: 'codex' },
    revision: 'rev-1',
  });
  assert.equal(stored.applyRuns[0]?.state, 'claimed');
  const claimAttemptId = stored.applyRuns[0]!.claimAttemptId!;
  assert.ok(claimAttemptId);
  stored = await store.claimApplyRun(session.changeSet.sessionId, runId, {
    agent: { name: 'cursor' },
    revision: 'rev-1',
  });
  assert.equal(stored.applyRuns[0]?.agent?.name, 'codex');
  await store.updateApplyRun(session.changeSet.sessionId, runId, {
    state: 'applying',
    message: 'Editing source.',
    claimAttemptId,
  });
  await store.updateApplyRun(session.changeSet.sessionId, runId, {
    state: 'rebuilding',
    changedFiles: ['src/Button.tsx'],
    validationResults: [{ name: 'typecheck', passed: true }],
    claimAttemptId,
  });
  await store.updateApplyRun(session.changeSet.sessionId, runId, {
    state: 'verifying',
    message: 'Source rebuilt.',
    claimAttemptId,
  });
  stored = await store.addVerifications(
    session.changeSet.sessionId,
    [
      {
        changeId,
        property: 'borderRadius',
        requested: 28,
        rendered: '28px',
        passed: true,
        verifiedAt: '2026-08-29T00:00:00.000Z',
      },
    ],
    runId,
  );
  assert.equal(stored.applyRuns[0]?.state, 'passed');
  assert.equal(stored.changeSet.changes[0]?.status, 'applied');
  assert.equal(stored.deliveryRecords.length, 1);
  assert.equal(stored.deliveryRecords[0]?.status, 'verified');
  assert.equal(stored.deliveryRecords[0]?.acceptanceCriteria[0]?.status, 'passed');
  assert.equal(stored.designHistory.length, 1);
  assert.equal(stored.designHistory[0]?.applyRunId, runId);
  stored = await store.addVerifications(session.changeSet.sessionId, []);
  assert.equal(stored.designHistory.length, 1);
});

test('blocks a stale revision and allows an explicit retry', async () => {
  const { store, session, changeId } = await reviewedSession();
  let stored = await store.createApplyRun(session.changeSet.sessionId, {
    reviews: [{ changeId, approved: true }],
    revision: 'rev-1',
  });
  const first = stored.applyRuns[0]!;
  stored = await store.claimApplyRun(session.changeSet.sessionId, first.id, {
    agent: { name: 'claude' },
    revision: 'rev-2',
  });
  assert.equal(stored.applyRuns[0]?.state, 'needs_attention');
  assert.equal(stored.designHistory.length, 0);
  assert.notEqual(stored.deliveryRecords[0]?.status, 'verified');
  stored = await store.retryApplyRun(session.changeSet.sessionId, first.id);
  const retry = stored.applyRuns[1]!;
  assert.equal(retry.attempts, 2);
  stored = await store.claimApplyRun(session.changeSet.sessionId, retry.id, {
    agent: { name: 'claude' },
    revision: 'rev-2',
  });
  assert.equal(stored.applyRuns[1]?.state, 'claimed');
});

test('blocks a claim made against a stale project design graph', async () => {
  const { store, session, changeId } = await reviewedSession();
  await store.setDesignGraph(session.changeSet.sessionId, {
    protocolVersion: '1.2.0',
    projectRoot: '/project',
    revision: 'graph-1',
    tokens: [],
    components: [],
    breakpoints: [],
    themes: [],
    states: [],
    motionPresets: [],
    tokenUsages: [],
    designSystemFindings: [],
    indexedAt: '2026-08-29T00:00:00.000Z',
  });
  let stored = await store.createApplyRun(session.changeSet.sessionId, {
    reviews: [{ changeId, approved: true }],
  });
  const run = stored.applyRuns[0]!;
  stored = await store.claimApplyRun(session.changeSet.sessionId, run.id, {
    agent: { name: 'codex' },
    revision: 'rev-1',
    designGraphRevision: 'graph-2',
  });
  assert.equal(stored.applyRuns[0]?.state, 'needs_attention');
  assert.match(stored.applyRuns[0]?.error ?? '', /design graph changed/);
});

test('records a rendered mismatch and waits for a user-authorized retry', async () => {
  const { store, session, changeId } = await reviewedSession();
  let stored = await store.createApplyRun(session.changeSet.sessionId, {
    reviews: [{ changeId, approved: true }],
  });
  const run = stored.applyRuns[0]!;
  stored = await store.claimApplyRun(session.changeSet.sessionId, run.id, {
    agent: { name: 'cursor' },
    revision: 'rev-1',
  });
  const claimAttemptId = stored.applyRuns[0]!.claimAttemptId!;
  await store.updateApplyRun(session.changeSet.sessionId, run.id, {
    state: 'applying',
    claimAttemptId,
  });
  await store.updateApplyRun(session.changeSet.sessionId, run.id, {
    state: 'rebuilding',
    changedFiles: ['src/Button.tsx'],
    claimAttemptId,
  });
  await store.updateApplyRun(session.changeSet.sessionId, run.id, {
    state: 'verifying',
    claimAttemptId,
  });
  stored = await store.addVerifications(
    session.changeSet.sessionId,
    [
      {
        changeId,
        property: 'borderRadius',
        requested: 24,
        rendered: '20px',
        passed: false,
        reason: 'Rendered value differs from requested value',
        verifiedAt: '2026-08-29T00:00:00.000Z',
      },
    ],
    run.id,
  );
  assert.equal(stored.applyRuns[0]?.state, 'needs_attention');
  assert.equal(stored.applyRuns.length, 1);
  stored = await store.retryApplyRun(session.changeSet.sessionId, run.id);
  assert.equal(stored.applyRuns[1]?.state, 'queued');
  assert.equal(stored.applyRuns[1]?.retryOf, run.id);
});

test('recovers an abandoned claim and rejects updates from the stale agent', async () => {
  let now = new Date('2026-09-02T20:00:00.000Z');
  const { store, session, changeId } = await reviewedSession({
    claimLeaseMs: 1_000,
    now: () => now,
  });
  let stored = await store.createApplyRun(session.changeSet.sessionId, {
    reviews: [{ changeId, approved: true }],
  });
  const runId = stored.applyRuns[0]!.id;
  stored = await store.claimApplyRun(session.changeSet.sessionId, runId, {
    agent: { name: 'codex', taskId: 'first' },
    revision: 'rev-1',
  });
  const staleClaimId = stored.applyRuns[0]!.claimAttemptId!;
  assert.equal(stored.applyRuns[0]?.claimExpiresAt, '2026-09-02T20:00:01.000Z');

  now = new Date('2026-09-02T20:00:00.800Z');
  stored = await store.heartbeatApplyRun(session.changeSet.sessionId, runId, staleClaimId);
  assert.equal(stored.applyRuns[0]?.claimExpiresAt, '2026-09-02T20:00:01.800Z');

  now = new Date('2026-09-02T20:00:02.000Z');
  stored = await store.read(session.changeSet.sessionId);
  assert.equal(stored.applyRuns[0]?.state, 'queued');
  assert.equal(stored.applyRuns[0]?.requeueCount, 1);
  assert.equal(stored.applyRuns[0]?.claimAttemptId, undefined);

  stored = await store.claimApplyRun(session.changeSet.sessionId, runId, {
    agent: { name: 'codex', taskId: 'second' },
    revision: 'rev-1',
  });
  const currentClaimId = stored.applyRuns[0]!.claimAttemptId!;
  assert.notEqual(currentClaimId, staleClaimId);
  await assert.rejects(
    store.updateApplyRun(session.changeSet.sessionId, runId, {
      state: 'applying',
      claimAttemptId: staleClaimId,
    }),
    /claim is no longer active/,
  );
  stored = await store.updateApplyRun(session.changeSet.sessionId, runId, {
    state: 'applying',
    claimAttemptId: currentClaimId,
  });
  assert.equal(stored.applyRuns[0]?.state, 'applying');
  assert.equal(stored.applyRuns[0]?.claimExpiresAt, '2026-09-02T20:00:03.000Z');
});

test('marks interrupted source work for explicit resume and preserves run identity', async () => {
  let now = new Date('2026-09-02T20:00:00.000Z');
  const { store, session, changeId } = await reviewedSession({
    claimLeaseMs: 1_000,
    now: () => now,
  });
  let stored = await store.createApplyRun(session.changeSet.sessionId, {
    reviews: [{ changeId, approved: true }],
  });
  const runId = stored.applyRuns[0]!.id;
  stored = await store.claimApplyRun(session.changeSet.sessionId, runId, {
    agent: { name: 'codex', taskId: 'first' },
    revision: 'rev-1',
  });
  const firstClaim = stored.applyRuns[0]!.claimAttemptId!;
  stored = await store.updateApplyRun(session.changeSet.sessionId, runId, {
    state: 'applying',
    claimAttemptId: firstClaim,
  });
  assert.equal(stored.applyRuns[0]?.claimExpiresAt, '2026-09-02T20:00:01.000Z');

  now = new Date('2026-09-02T20:00:02.000Z');
  stored = await store.read(session.changeSet.sessionId);
  assert.equal(stored.applyRuns[0]?.id, runId);
  assert.equal(stored.applyRuns[0]?.state, 'needs_attention');
  assert.equal(stored.applyRuns[0]?.interruptedState, 'applying');
  assert.match(stored.applyRuns[0]?.error ?? '', /disconnected while applying/);

  stored = await store.authorizeApplyRunResume(session.changeSet.sessionId, runId);
  assert.equal(stored.applyRuns.length, 1);
  assert.equal(stored.applyRuns[0]?.state, 'queued');
  assert.equal(stored.applyRuns[0]?.agent, undefined);
  assert.equal(stored.applyRuns[0]?.claimAttemptId, undefined);
  assert.equal(stored.applyRuns[0]?.completedAt, undefined);

  stored = await store.claimApplyRun(session.changeSet.sessionId, runId, {
    agent: { name: 'codex', taskId: 'second' },
    revision: 'rev-after-partial-source-work',
  });
  assert.equal(stored.applyRuns[0]?.state, 'claimed');
  assert.equal(stored.applyRuns[0]?.agent?.taskId, 'second');
  assert.notEqual(stored.applyRuns[0]?.claimAttemptId, firstClaim);
  assert.ok(stored.applyRuns[0]?.resumedAt);
});

test('requeues a claimed run created before claim leases were introduced', async () => {
  const { root, store, session, changeId } = await reviewedSession();
  let stored = await store.createApplyRun(session.changeSet.sessionId, {
    reviews: [{ changeId, approved: true }],
  });
  const runId = stored.applyRuns[0]!.id;
  stored = await store.claimApplyRun(session.changeSet.sessionId, runId, {
    agent: { name: 'codex' },
    revision: 'rev-1',
  });
  const path = join(root, `${session.changeSet.sessionId}.json`);
  const legacy = JSON.parse(await readFile(path, 'utf8'));
  delete legacy.applyRuns[0].claimAttemptId;
  delete legacy.applyRuns[0].claimExpiresAt;
  delete legacy.applyRuns[0].claimHeartbeatAt;
  await writeFile(path, `${JSON.stringify(legacy, null, 2)}\n`);

  stored = await store.read(session.changeSet.sessionId);
  assert.equal(stored.applyRuns[0]?.state, 'queued');
  assert.equal(stored.applyRuns[0]?.requeueCount, 1);
  assert.match(stored.applyRuns[0]?.messages.at(-1)?.message ?? '', /returned the batch/);
});

test('blocks unresolved changes from reviewed apply runs', async () => {
  const { store, session } = await reviewedSession();
  const changed = await store.addChange(session.changeSet.sessionId, {
    target: {
      id: 'unknown',
      platform: 'web',
      semanticRole: 'element',
      label: 'Unknown element',
      componentPath: [],
      geometry: { x: 0, y: 0, width: 10, height: 10, scale: 1 },
      locator: {},
      confidence: 'unresolved',
      evidence: [],
    },
    category: 'layout',
    property: 'width',
    before: 10,
    after: 20,
    unit: 'px',
    scope: 'instance',
    context: { breakpoint: 'current', theme: 'current', state: 'current' },
    confidence: 'unresolved',
    evidence: [],
    status: 'unresolved',
  });
  const unresolvedId = changed.changeSet.changes.find(
    (change) => change.target.id === 'unknown',
  )!.id;
  await assert.rejects(
    store.createApplyRun(session.changeSet.sessionId, {
      reviews: [{ changeId: unresolvedId, approved: true }],
    }),
    /Unresolved change cannot be applied/,
  );
});

test('migrates stored protocol 1.0 sessions with empty apply history', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-legacy-'));
  const store = new SessionStore(root);
  const now = '2026-08-29T00:00:00.000Z';
  await writeFile(
    join(root, 'ses_abc.json'),
    JSON.stringify({
      token: 'secret',
      changeSet: {
        protocolVersion: '1.0.0',
        sessionId: 'ses_abc',
        context: { projectRoot: '/project', platform: 'web' },
        changes: [],
        screenshots: [],
        createdAt: now,
        updatedAt: now,
      },
      verifications: [],
    }),
  );
  const migrated = await store.read('ses_abc');
  assert.equal(migrated.changeSet.protocolVersion, '1.2.0');
  assert.deepEqual(migrated.changeSet.operations, []);
  assert.equal(migrated.designGraph, null);
  assert.deepEqual(migrated.applyRuns, []);
});

test('migrates stored protocol 1.1 sessions with semantic defaults', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-apply-legacy-'));
  const store = new SessionStore(root);
  const now = '2026-08-29T00:00:00.000Z';
  await writeFile(
    join(root, 'ses_def.json'),
    JSON.stringify({
      token: 'secret',
      changeSet: {
        protocolVersion: '1.1.0',
        sessionId: 'ses_def',
        context: {
          projectRoot: '/project',
          platform: 'web',
          theme: 'system',
          breakpoint: 'current',
          state: 'current',
        },
        changes: [],
        screenshots: [],
        createdAt: now,
        updatedAt: now,
      },
      verifications: [],
      applyRuns: [],
    }),
  );
  const migrated = await store.read('ses_def');
  assert.equal(migrated.changeSet.protocolVersion, '1.2.0');
  assert.deepEqual(migrated.changeSet.operations, []);
  assert.equal(migrated.changeSet.designGraphRevision, undefined);
});

test('persists, claims, and resolves a grounded visual agent request', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-visual-agent-'));
  const store = new SessionStore(root);
  const session = await store.create({
    projectRoot: '/project',
    platform: 'web',
    viewport: { width: 1440, height: 900 },
    theme: 'dark',
    breakpoint: 'desktop',
    state: 'default',
  });
  const id = session.changeSet.sessionId;
  const created = await store.createVisualAgentRequest(id, {
    prompt: 'Why do these labels feel inconsistent?',
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
  });
  const requestId = created.visualAgentRequests[0]!.id;
  const claimed = await store.claimVisualAgentRequest(id, requestId, {
    agent: { name: 'codex', taskId: 'task-1' },
  });
  const claimAttemptId = claimed.visualAgentRequests[0]!.claimAttemptId!;
  assert.equal(claimed.visualAgentRequests[0]?.status, 'thinking');
  const responded = await store.respondToVisualAgentRequest(id, requestId, {
    claimAttemptId,
    message: 'The labels use two different type scales.',
    proposals: [
      {
        name: 'Shared label token',
        summary: 'Use one label size and weight.',
        reasoning: ['The rendered values differ.'],
        exactValues: ['font-size: 12px'],
        sourceLocations: ['src/Form.tsx:20'],
        responsiveImpact: 'No breakpoint change.',
        verificationPlan: ['Measure both labels after rebuild.'],
        changes: [],
      },
    ],
  });
  assert.equal(responded.visualAgentRequests[0]?.status, 'ready');
  assert.equal(responded.visualAgentRequests[0]?.proposals[0]?.status, 'proposed');
  assert.equal((await store.read(id)).visualAgentRequests.length, 1);
});

test('previews one reusable proposal branch and promotes it without dropping main changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-visual-agent-proposal-'));
  const store = new SessionStore(root);
  const session = await store.create({
    projectRoot: '/project',
    platform: 'web',
    theme: 'light',
    breakpoint: 'desktop',
    state: 'default',
  });
  const id = session.changeSet.sessionId;
  const changed = await store.addChange(id, {
    target: {
      id: 'card',
      platform: 'web',
      semanticRole: 'article',
      label: 'Card',
      componentPath: [],
      geometry: { x: 0, y: 0, width: 320, height: 180, scale: 1 },
      locator: { selector: '[data-card]' },
      confidence: 'instrumented',
      evidence: ['live geometry'],
    },
    category: 'layout',
    property: 'padding',
    before: 16,
    after: 20,
    unit: 'px',
    scope: 'instance',
    context: { breakpoint: 'desktop', theme: 'light', state: 'default' },
    confidence: 'instrumented',
    evidence: ['computed style'],
    status: 'draft',
  });
  const created = await store.createVisualAgentRequest(id, {
    prompt: 'Make this card hierarchy clearer.',
    context: {
      targets: [
        {
          id: 'card',
          selector: '[data-card]',
          label: 'Card',
          kind: 'article',
          source: 'src/Card.tsx:12',
          confidence: 'instrumented',
          geometry: { x: 0, y: 0, width: 320, height: 180, scale: 1 },
          measurements: { padding: '20px' },
        },
      ],
      comments: [],
      viewport: { width: 1440, height: 900 },
      breakpoint: 'desktop',
      theme: 'light',
      state: 'default',
      tokens: [],
    },
  });
  const requestId = created.visualAgentRequests[0]!.id;
  const claimed = await store.claimVisualAgentRequest(id, requestId, {
    agent: { name: 'codex', taskId: 'task-2' },
  });
  const claimAttemptId = claimed.visualAgentRequests[0]!.claimAttemptId!;
  const proposalChange = {
    ...changed.changeSet.changes[0]!,
    id: 'proposal-change',
    property: 'gap',
    before: 12,
    after: 16,
  };
  const responded = await store.respondToVisualAgentRequest(id, requestId, {
    claimAttemptId,
    message: 'Use a consistent spacing step.',
    proposals: [
      {
        name: 'Clearer spacing rhythm',
        summary: 'Increase the internal gap.',
        reasoning: ['The card mixes adjacent spacing values.'],
        exactValues: ['gap: 16px'],
        sourceLocations: ['src/Card.tsx:12'],
        responsiveImpact: 'Applies at desktop only.',
        verificationPlan: ['Measure the rebuilt card.'],
        changes: [proposalChange],
      },
    ],
  });
  const proposalId = responded.visualAgentRequests[0]!.proposals[0]!.id;
  const previewed = await store.updateVisualAgentProposal(id, requestId, proposalId, 'preview');
  const branchId = previewed.visualAgentRequests[0]!.proposals[0]!.branchId!;
  assert.equal(previewed.designBranches.find((item) => item.id === branchId)?.changes.length, 2);
  const previewedAgain = await store.updateVisualAgentProposal(
    id,
    requestId,
    proposalId,
    'preview',
  );
  assert.equal(previewedAgain.designBranches.filter((item) => item.id === branchId).length, 1);
  const promoted = await store.updateVisualAgentProposal(id, requestId, proposalId, 'promote');
  assert.equal(promoted.changeSet.changes.length, 2);
  assert.equal(promoted.designBranches.find((item) => item.id === branchId)?.status, 'chosen');
  assert.equal(promoted.visualAgentRequests[0]!.proposals[0]!.status, 'promoted');
});
