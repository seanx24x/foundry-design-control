import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { VerificationResult } from 'foundry-design-protocol';
import {
  previewCapabilityMatches,
  reviewedSourceFiles,
  SessionStore,
  type SessionStoreOptions,
} from './store.js';

const BASELINE_HASH = 'a'.repeat(64);
const APPLIED_HASH = 'b'.repeat(64);

function projectSourceProof(revision = 'rev-1', hash = BASELINE_HASH, paths = ['src/Button.tsx']) {
  return {
    scope: 'mapped-files' as const,
    revision,
    files: paths.map((path) => ({
      path,
      exists: true,
      sha256: hash,
      lineAnchors: [{ line: 1, sha256: hash }],
    })),
  };
}

test('persists and authenticates a coalesced design session', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-store-'));
  const store = new SessionStore(root);
  const session = await store.create({
    projectRoot: '/project',
    platform: 'web',
    viewport: { width: 1440, height: 900 },
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
    source: { file: 'src/Button.tsx', line: 1 },
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

test('rejects caller-supplied change and operation identity collisions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-store-identities-'));
  const store = new SessionStore(root);
  const session = await store.create({
    projectRoot: '/project',
    platform: 'web',
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const id = session.changeSet.sessionId;
  const operation = {
    id: 'operation-fixed',
    kind: 'resize' as const,
    label: 'Resize button',
    targetIds: ['button'],
    mappingCandidates: [],
    status: 'preview' as const,
  };
  await store.addOperation(id, operation);
  await assert.rejects(store.addOperation(id, operation), /operation id already exists/);
  const input = {
    id: 'change-fixed',
    target: {
      id: 'button',
      platform: 'web' as const,
      semanticRole: 'button',
      label: 'Button',
      componentPath: [],
      geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
      locator: { selector: 'button' },
      confidence: 'measured' as const,
      evidence: ['live geometry'],
    },
    category: 'layout' as const,
    property: 'width',
    before: 100,
    after: 120,
    unit: 'px',
    scope: 'instance' as const,
    context: { breakpoint: 'current', theme: 'current', state: 'current' },
    confidence: 'measured' as const,
    evidence: ['computed style'],
    status: 'draft' as const,
  };
  await store.addChange(id, input);
  await assert.rejects(store.addChange(id, input), /change id already exists/);
});

test('records an operation and its change atomically without orphaning either side', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-store-atomic-record-'));
  const store = new SessionStore(root);
  const session = await store.create({
    projectRoot: '/project',
    platform: 'web',
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const id = session.changeSet.sessionId;
  const mappingCandidates = [
    {
      id: 'map-height',
      label: 'Set minimum height',
      intent: 'resize' as const,
      property: 'minHeight',
      targetId: 'button',
      value: 44,
      source: { file: 'src/Button.css', line: 12 },
      scope: 'instance' as const,
      confidence: 'instrumented' as const,
      evidence: ['Exact authored declaration'],
      blastRadius: 1,
    },
  ];
  const change = {
    target: {
      id: 'button',
      platform: 'web' as const,
      semanticRole: 'button',
      label: 'Button',
      componentPath: ['Button'],
      source: { file: 'src/Button.css', line: 12 },
      geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
      locator: { selector: '[data-foundry-id="button"]' },
      confidence: 'instrumented' as const,
      evidence: ['live geometry'],
    },
    category: 'accessibility' as const,
    property: 'minHeight',
    before: 40,
    after: 44,
    unit: 'px',
    operationId: 'op-touch-target',
    mappingCandidates,
    selectedMappingId: 'map-height',
    scope: 'instance' as const,
    context: { breakpoint: 'current', theme: 'current', state: 'current' },
    confidence: 'instrumented' as const,
    evidence: ['computed style'],
    status: 'draft' as const,
  };
  const operation = {
    id: 'op-touch-target',
    kind: 'resize' as const,
    label: 'Increase touch target height',
    targetIds: ['button'],
    mappingCandidates,
    selectedMappingId: 'map-height',
    status: 'resolved' as const,
  };

  const stored = await store.addOperationWithChange(id, { operation, change });
  assert.equal(stored.changeSet.changes.length, 1);
  assert.equal(stored.changeSet.operations.length, 1);
  assert.equal(stored.changeSet.changes[0]?.operationId, operation.id);
  assert.deepEqual(stored.changeSet.operations[0]?.changeIds, [stored.changeSet.changes[0]!.id]);

  await assert.rejects(
    store.addOperationWithChange(id, {
      operation: { ...operation, id: 'op-invalid', targetIds: ['another-target'] },
      change: { ...change, operationId: 'op-invalid' },
    }),
    /must include the changed target/,
  );
  const restored = await store.authenticate(id, session.token);
  assert.equal(restored.changeSet.changes.length, 1);
  assert.equal(restored.changeSet.operations.length, 1);
});

test('accepts the explicit approved status written by the Review interface', async () => {
  const { store, session, changeId } = await reviewedSession();
  const id = session.changeSet.sessionId;
  await store.setChangeStatus(id, changeId, 'approved');
  let stored = await store.createApplyRun(id, {
    reviews: [{ changeId, approved: true }],
  });
  assert.equal(stored.applyRuns.length, 1);
  assert.equal(stored.applyRuns[0]?.state, 'queued');
  assert.equal(stored.applyRuns[0]?.reviewedChangeSet?.changes[0]?.status, 'approved');
  const runId = stored.applyRuns[0]!.id;
  stored = await store.claimApplyRun(id, runId, {
    agent: { name: 'test-agent' },
    revision: 'rev-1',
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
  });
  const claimAttemptId = stored.applyRuns[0]!.claimAttemptId!;
  await store.updateApplyRun(id, runId, {
    state: 'failed',
    message: 'Intentional first-attempt failure',
    claimAttemptId,
  });
  await assert.rejects(
    store.createApplyRun(id, {
      reviews: [{ changeId, approved: true }],
    }),
    /already belongs to Apply run.*Retry that run/,
  );
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
        after: 101 + index,
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

test('serializes mutations from independent store instances without losing either write', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-store-process-safe-'));
  const firstStore = new SessionStore(root);
  const secondStore = new SessionStore(root);
  const session = await firstStore.create({
    projectRoot: '/project',
    platform: 'web',
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const change = (id: string) => ({
    target: {
      id,
      platform: 'web' as const,
      semanticRole: 'button',
      label: id,
      componentPath: [],
      geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
      locator: { selector: `[data-id="${id}"]` },
      confidence: 'measured' as const,
      evidence: ['live geometry'],
    },
    category: 'layout' as const,
    property: 'width',
    before: 100,
    after: 120,
    unit: 'px',
    scope: 'instance' as const,
    context: { breakpoint: 'current', theme: 'current', state: 'current' },
    confidence: 'measured' as const,
    evidence: ['computed style'],
    status: 'draft' as const,
  });
  await Promise.all([
    firstStore.addChange(session.changeSet.sessionId, change('first')),
    secondStore.addChange(session.changeSet.sessionId, change('second')),
  ]);
  const restored = await firstStore.authenticate(session.changeSet.sessionId, session.token);
  assert.deepEqual(restored.changeSet.changes.map((item) => item.target.id).sort(), [
    'first',
    'second',
  ]);
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
  const emptySnapshot = await store.read(id);
  await assert.rejects(store.promoteDesignBranch(id, optionA), /No saved changes/);
  assert.deepEqual(
    await store.read(id),
    emptySnapshot,
    'Empty promotion must not alter the ledger, active direction or decision history',
  );
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
    viewport: { width: 1440, height: 900 },
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

async function reviewedSession(
  options: SessionStoreOptions = {},
  contextSet?: { breakpoints: string[]; themes: string[]; states: string[] },
  platform: 'web' | 'swiftui' | 'react-native' = 'web',
) {
  const root = await mkdtemp(join(tmpdir(), 'foundry-apply-'));
  const store = new SessionStore(root, options);
  const session = await store.create({
    projectRoot: '/project',
    revision: 'rev-1',
    platform,
    viewport: { width: 1440, height: 900 },
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const target = {
    id: 'button',
    platform,
    semanticRole: 'button',
    label: 'Button',
    componentPath: [],
    geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
    locator: { selector: 'button' },
    source: { file: 'src/Button.tsx', line: 1 },
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
    context: {
      breakpoint: contextSet?.breakpoints[0] ?? 'current',
      theme: contextSet?.themes[0] ?? 'current',
      state: contextSet?.states[0] ?? 'current',
    },
    ...(contextSet ? { contextSet } : {}),
    confidence: 'measured',
    evidence: ['computed style'],
    status: 'draft',
  });
  return { root, store, session, changeId: changed.changeSet.changes[0]!.id };
}

async function moveRunToVerifying(
  store: SessionStore,
  sessionId: string,
  runId: string,
  acknowledge = true,
  claimCapability?: string,
) {
  let stored = await store.claimApplyRun(sessionId, runId, {
    agent: { name: 'codex' },
    revision: 'rev-1',
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
    claimCapability,
  });
  const claimAttemptId = stored.applyRuns.find((run) => run.id === runId)!.claimAttemptId!;
  await store.updateApplyRun(sessionId, runId, {
    state: 'applying',
    claimAttemptId,
    claimCapability,
  });
  await store.updateApplyRun(
    sessionId,
    runId,
    {
      state: 'rebuilding',
      changedFiles: ['src/Button.tsx'],
      validationResults: [boundValidation()],
      claimAttemptId,
      claimCapability,
    },
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  if (acknowledge) {
    await store.recordApplyResult(
      sessionId,
      runId,
      claimAttemptId,
      [...stored.applyRuns.find((run) => run.id === runId)!.changeIds],
      projectSourceProof('rev-2', APPLIED_HASH),
      claimCapability,
    );
    stored = await store.updateApplyRun(sessionId, runId, {
      state: 'verifying',
      claimAttemptId,
      claimCapability,
    });
  }
  return { stored, claimAttemptId };
}

function boundVerification(
  runId: string,
  claimAttemptId: string,
  input: Omit<
    VerificationResult,
    'applyRunId' | 'claimAttemptId' | 'verifiedAt' | 'geometry' | 'evidence'
  > &
    Partial<Pick<VerificationResult, 'verifiedAt' | 'geometry' | 'evidence'>>,
): VerificationResult {
  return {
    applyRunId: runId,
    claimAttemptId,
    geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
    evidence: ['Measured in the rendered web fixture.'],
    verifiedAt: new Date().toISOString(),
    ...input,
  };
}

function boundValidation(input: { name?: string; passed?: boolean } = {}) {
  return {
    name: input.name ?? 'fixture validation',
    passed: input.passed ?? true,
  };
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
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
  });
  assert.equal(stored.applyRuns[0]?.state, 'claimed');
  const claimAttemptId = stored.applyRuns[0]!.claimAttemptId!;
  assert.ok(claimAttemptId);
  await assert.rejects(
    store.claimApplyRun(session.changeSet.sessionId, runId, {
      agent: { name: 'cursor' },
      revision: 'rev-1',
      designGraphRevision: null,
      sourceProof: projectSourceProof(),
    }),
    /no longer queued/,
  );
  stored = await store.read(session.changeSet.sessionId);
  assert.equal(stored.applyRuns[0]?.agent?.name, 'codex');
  await store.updateApplyRun(session.changeSet.sessionId, runId, {
    state: 'applying',
    message: 'Editing source.',
    claimAttemptId,
  });
  await store.updateApplyRun(
    session.changeSet.sessionId,
    runId,
    {
      state: 'rebuilding',
      changedFiles: ['src/Button.tsx'],
      validationResults: [boundValidation({ name: 'typecheck' })],
      claimAttemptId,
    },
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  await assert.rejects(
    store.recordApplyResult(
      session.changeSet.sessionId,
      runId,
      'claim_stale',
      [changeId],
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /claim is no longer active/,
  );
  await assert.rejects(
    store.recordApplyResult(
      session.changeSet.sessionId,
      runId,
      claimAttemptId,
      [changeId, 'chg_unreviewed'],
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /exactly match the frozen reviewed change set/,
  );
  stored = await store.recordApplyResult(
    session.changeSet.sessionId,
    runId,
    claimAttemptId,
    [changeId],
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  await assert.rejects(
    store.updateApplyRun(session.changeSet.sessionId, runId, {
      changedFiles: ['src/Other.tsx'],
      validationResults: [boundValidation({ name: 'replacement validation' })],
      claimAttemptId,
    }),
    /evidence is frozen after the Apply result acknowledgement/,
  );
  stored = await store.read(session.changeSet.sessionId);
  assert.deepEqual(stored.applyRuns[0]?.changedFiles, ['src/Button.tsx']);
  assert.equal(stored.applyRuns[0]?.validationResults[0]?.name, 'typecheck');
  assert.equal(stored.applyRuns[0]?.validationResults[0]?.validatedRevision, 'rev-2');
  stored = await store.updateApplyRun(session.changeSet.sessionId, runId, {
    state: 'verifying',
    message: 'Source rebuilt.',
    claimAttemptId,
  });
  assert.equal(stored.changeSet.changes[0]?.status, 'approved');
  assert.equal(stored.applyRuns[0]?.applyResultClaimAttemptId, claimAttemptId);
  stored = await store.addVerifications(
    session.changeSet.sessionId,
    [
      boundVerification(runId, claimAttemptId, {
        changeId,
        property: 'borderRadius',
        requested: 28,
        rendered: '28px',
        passed: true,
      }),
    ],
    runId,
    claimAttemptId,
    'browser-preview',
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  assert.equal(stored.applyRuns[0]?.state, 'passed');
  assert.equal(stored.changeSet.changes[0]?.status, 'applied');
  assert.equal(stored.deliveryRecords.length, 1);
  assert.equal(stored.deliveryRecords[0]?.status, 'verified');
  assert.equal(stored.deliveryRecords[0]?.acceptanceCriteria[0]?.status, 'passed');
  assert.equal(stored.designHistory.length, 1);
  assert.equal(stored.designHistory[0]?.applyRunId, runId);
  assert.equal(stored.applyRuns[0]?.revision, 'rev-1');
  assert.equal(stored.applyRuns[0]?.appliedRevision, 'rev-2');
  assert.deepEqual(stored.applyRuns[0]?.appliedChangedFiles, ['src/Button.tsx']);
  assert.equal(stored.deliveryRecords[0]?.baselineRevision, 'rev-1');
  assert.equal(stored.deliveryRecords[0]?.appliedRevision, 'rev-2');
  assert.deepEqual(stored.deliveryRecords[0]?.affectedFiles, ['src/Button.tsx']);
  assert.equal(stored.designHistory[0]?.baselineRevision, 'rev-1');
  assert.equal(stored.designHistory[0]?.appliedRevision, 'rev-2');
  assert.deepEqual(stored.designHistory[0]?.affectedFiles, ['src/Button.tsx']);
  assert.equal(stored.verifications[0]?.applyRunId, runId);
  assert.equal(stored.verifications[0]?.claimAttemptId, claimAttemptId);
  stored = await store.read(session.changeSet.sessionId);
  assert.equal(stored.designHistory.length, 1);
});

test('rejects duplicate reviews before mutating the review ledger', async () => {
  const { store, session, changeId } = await reviewedSession();
  await assert.rejects(
    store.createApplyRun(session.changeSet.sessionId, {
      reviews: [
        { changeId, approved: true, after: 28 },
        { changeId, approved: false, after: 32 },
      ],
    }),
    /only once/,
  );
  const stored = await store.read(session.changeSet.sessionId);
  assert.equal(stored.changeSet.changes[0]?.after, 24);
  assert.equal(stored.changeSet.changes[0]?.status, 'draft');
  assert.deepEqual(stored.applyRuns, []);
});

test('locks the design graph, operations, and ledger while an Apply run is active', async () => {
  const { store, session, changeId } = await reviewedSession();
  const id = session.changeSet.sessionId;
  let stored = await store.addOperation(id, {
    kind: 'resize',
    label: 'Resize button',
    targetIds: ['button'],
    mappingCandidates: [
      {
        id: 'map-width',
        label: 'Set width',
        intent: 'resize',
        property: 'width',
        value: 120,
        confidence: 'measured',
        scope: 'instance',
      },
    ],
    status: 'unresolved',
  });
  const operationId = stored.changeSet.operations[0]!.id;
  stored = await store.createApplyRun(id, { reviews: [{ changeId, approved: true }] });
  const current = stored.changeSet.changes[0]!;
  await assert.rejects(store.setChangeStatus(id, changeId, 'draft'), /active Apply run/);
  await assert.rejects(store.deleteChange(id, changeId), /active Apply run/);
  await assert.rejects(
    store.addChange(id, { ...current, after: 32, status: 'draft' }),
    /active Apply run/,
  );
  await assert.rejects(
    store.addOperation(id, {
      kind: 'style',
      label: 'Restyle button',
      targetIds: ['button'],
      status: 'preview',
    }),
    /active Apply run/,
  );
  await assert.rejects(store.resolveOperation(id, operationId, 'map-width'), /active Apply run/);
  await assert.rejects(
    store.setDesignGraph(id, {
      protocolVersion: '1.3.0',
      projectRoot: '/project',
      tokens: [],
      components: [],
      breakpoints: [],
      themes: [],
      states: [],
      motionPresets: [],
      indexedAt: new Date().toISOString(),
    }),
    /active Apply run/,
  );
});

test('requires passing validation, an apply acknowledgement, and attempt-bound web evidence', async () => {
  const { store, session, changeId } = await reviewedSession();
  const id = session.changeSet.sessionId;
  let stored = await store.createApplyRun(id, { reviews: [{ changeId, approved: true }] });
  const run = stored.applyRuns[0]!;
  stored = await store.claimApplyRun(id, run.id, {
    agent: { name: 'codex' },
    revision: 'rev-1',
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
  });
  const claimAttemptId = stored.applyRuns[0]!.claimAttemptId!;
  await assert.rejects(
    store.updateApplyRun(id, run.id, { message: 'unbound evidence' }),
    /claim is no longer active/,
  );
  await store.updateApplyRun(id, run.id, { state: 'applying', claimAttemptId });
  await store.updateApplyRun(id, run.id, {
    state: 'rebuilding',
    changedFiles: ['src/Button.tsx'],
    claimAttemptId,
  });
  await assert.rejects(
    store.updateApplyRun(id, run.id, { state: 'verifying', claimAttemptId }),
    /at least one successful validation/,
  );
  await store.updateApplyRun(
    id,
    run.id,
    {
      validationResults: [boundValidation({ passed: false })],
      claimAttemptId,
    },
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  await assert.rejects(
    store.updateApplyRun(id, run.id, { state: 'verifying', claimAttemptId }),
    /at least one successful validation/,
  );
  await store.updateApplyRun(
    id,
    run.id,
    {
      validationResults: [boundValidation()],
      claimAttemptId,
    },
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  await assert.rejects(
    store.updateApplyRun(id, run.id, { state: 'verifying', claimAttemptId }),
    /acknowledge its source result first/,
  );
  const valid = boundVerification(run.id, claimAttemptId, {
    changeId,
    property: 'borderRadius',
    requested: 24,
    rendered: '24px',
    passed: true,
  });
  await assert.rejects(
    store.addVerifications(
      id,
      [valid],
      run.id,
      claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /not waiting for verification/,
  );
  await assert.rejects(
    store.updateApplyRun(
      id,
      run.id,
      {
        validationResults: [
          {
            ...boundValidation(),
            applyRunId: run.id,
            claimAttemptId: 'claim_from_prior_attempt',
            validatedRevision: 'rev-2',
            validatedAt: new Date().toISOString(),
          },
        ],
        claimAttemptId,
      },
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /provenance is assigned by the Foundry runtime/,
  );
  await store.updateApplyRun(
    id,
    run.id,
    {
      validationResults: [boundValidation()],
      claimAttemptId,
    },
    projectSourceProof('rev-1', BASELINE_HASH),
  );
  await assert.rejects(
    store.recordApplyResult(
      id,
      run.id,
      claimAttemptId,
      [changeId],
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /acknowledged source revision/,
  );
  await store.updateApplyRun(
    id,
    run.id,
    {
      validationResults: [boundValidation()],
      claimAttemptId,
    },
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  stored = await store.recordApplyResult(
    id,
    run.id,
    claimAttemptId,
    [changeId],
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  await assert.rejects(
    store.recordApplyResult(
      id,
      run.id,
      claimAttemptId,
      [changeId],
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /already acknowledged/,
  );
  stored = await store.updateApplyRun(id, run.id, { state: 'verifying', claimAttemptId });
  const acknowledgedAt = stored.applyRuns[0]!.applyResultAcknowledgedAt!;
  valid.verifiedAt = new Date(Date.parse(acknowledgedAt) + 1).toISOString();
  await assert.rejects(
    store.addVerifications(
      id,
      [{ ...valid, applyRunId: 'run_replay' }],
      run.id,
      claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /must name the active apply run/,
  );
  await assert.rejects(
    store.addVerifications(
      id,
      [{ ...valid, claimAttemptId: 'claim_replay' }],
      run.id,
      claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /must name the active claim attempt/,
  );
  await assert.rejects(
    store.addVerifications(
      id,
      [{ ...valid, verifiedAt: new Date(Date.parse(acknowledgedAt) - 1).toISOString() }],
      run.id,
      claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /predates/,
  );
  await assert.rejects(
    store.addVerifications(
      id,
      [{ ...valid, verifiedAt: new Date(Date.now() + 31_000).toISOString() }],
      run.id,
      claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /future/,
  );
  await assert.rejects(
    store.addVerifications(
      id,
      [{ ...valid, geometry: undefined }],
      run.id,
      claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /requires rendered geometry/,
  );
  await assert.rejects(
    store.addVerifications(
      id,
      [{ ...valid, evidence: [] }],
      run.id,
      claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /requires rendered evidence/,
  );
  await assert.rejects(
    store.addVerifications(
      id,
      [{ ...valid, rendered: '20px', passed: true }],
      run.id,
      claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /rendered value contradicts/,
  );
  await assert.rejects(
    store.addVerifications(
      id,
      [{ ...valid, geometry: { x: 0, y: 0, width: 0, height: 40, scale: 1 } }],
      run.id,
      claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /visible geometry/,
  );
  await assert.rejects(
    store.addVerifications(
      id,
      [{ ...valid, geometry: { x: 1500, y: 0, width: 100, height: 40, scale: 1 } }],
      run.id,
      claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /outside the reviewed viewport/,
  );
  await assert.rejects(
    store.addVerifications(
      id,
      [valid, { ...valid }],
      run.id,
      claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /duplicate change and context evidence/,
  );
  await assert.rejects(
    store.addVerifications(
      id,
      [valid],
      run.id,
      claimAttemptId,
      'native-agent',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /configured live preview/,
  );
});

test('requires the private claim capability for native verification', async () => {
  const claimCapability = 'private-native-claim-capability';
  const { store, session, changeId } = await reviewedSession({}, undefined, 'react-native');
  const id = session.changeSet.sessionId;
  let stored = await store.createApplyRun(id, { reviews: [{ changeId, approved: true }] });
  const runId = stored.applyRuns[0]!.id;
  const moved = await moveRunToVerifying(store, id, runId, true, claimCapability);
  const result = boundVerification(runId, moved.claimAttemptId, {
    changeId,
    property: 'borderRadius',
    requested: 24,
    rendered: '24px',
    passed: true,
  });
  await assert.rejects(
    store.addVerifications(
      id,
      [result],
      runId,
      moved.claimAttemptId,
      'native-agent',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /private capability/,
  );
  stored = await store.addVerifications(
    id,
    [result],
    runId,
    moved.claimAttemptId,
    'native-agent',
    projectSourceProof('rev-2', APPLIED_HASH),
    claimCapability,
  );
  assert.equal(stored.applyRuns[0]?.state, 'passed');
});

test('resolves legacy apply results only to one exact active frozen run', async () => {
  const { root, store, session, changeId } = await reviewedSession();
  await assert.rejects(
    store.recordLegacyApplyResult(
      session.changeSet.sessionId,
      [changeId],
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /did not match an active verifying run/,
  );

  let stored = await store.createApplyRun(session.changeSet.sessionId, {
    reviews: [{ changeId, approved: true }],
  });
  const run = stored.applyRuns[0]!;
  await moveRunToVerifying(store, session.changeSet.sessionId, run.id, false);
  await assert.rejects(
    store.recordLegacyApplyResult(
      session.changeSet.sessionId,
      [changeId],
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /only to runs created before protocol 1.3/,
  );
  const sessionPath = join(root, `${session.changeSet.sessionId}.json`);
  const legacySession = JSON.parse(await readFile(sessionPath, 'utf8')) as {
    changeSet: { protocolVersion: string };
  };
  legacySession.changeSet.protocolVersion = '1.2.0';
  await writeFile(sessionPath, `${JSON.stringify(legacySession, null, 2)}\n`, 'utf8');
  await store.setPreviewOrigin(session.changeSet.sessionId, 'http://127.0.0.1:4173');
  await assert.rejects(
    store.recordLegacyApplyResult(
      session.changeSet.sessionId,
      [changeId],
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /did not match an active verifying run/,
  );
  const migrated = await store.read(session.changeSet.sessionId);
  assert.equal(migrated.applyRuns[0]?.state, 'needs_attention');
  assert.deepEqual(migrated.applyRuns[0]?.verificationResults, []);
});

test('freezes the reviewed contract against later coalesced edits and Delivery drift', async () => {
  const { root, store, session, changeId } = await reviewedSession();
  let stored = await store.createApplyRun(session.changeSet.sessionId, {
    reviews: [{ changeId, approved: true }],
  });
  const run = stored.applyRuns[0]!;
  assert.equal(run.reviewedChangeSet?.changes[0]?.after, 24);
  assert.equal(run.reviewedChangeSet?.changes[0]?.status, 'approved');

  const current = stored.changeSet.changes[0]!;
  await assert.rejects(
    store.addChange(session.changeSet.sessionId, {
      ...current,
      after: 32,
      status: 'draft',
    }),
    /active Apply run/,
  );
  stored = await store.read(session.changeSet.sessionId);
  assert.equal(stored.changeSet.changes[0]?.after, 24);
  assert.equal(stored.applyRuns[0]?.reviewedChangeSet?.changes[0]?.after, 24);
  assert.match(stored.deliveryRecords[0]?.summary ?? '', /to 24px/);

  const verifying = await moveRunToVerifying(store, session.changeSet.sessionId, run.id, false);
  const sessionPath = join(root, `${session.changeSet.sessionId}.json`);
  const drifted = JSON.parse(await readFile(sessionPath, 'utf8')) as {
    changeSet: { changes: Array<{ after: unknown }> };
  };
  drifted.changeSet.changes[0]!.after = 32;
  await writeFile(sessionPath, `${JSON.stringify(drifted, null, 2)}\n`, 'utf8');
  await assert.rejects(
    store.recordApplyResult(
      session.changeSet.sessionId,
      run.id,
      verifying.claimAttemptId,
      [changeId],
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /no longer match the frozen reviewed contract/,
  );
  stored = await store.read(session.changeSet.sessionId);
  assert.notEqual(stored.changeSet.changes[0]?.status, 'applied');
  await assert.rejects(
    store.addVerifications(
      session.changeSet.sessionId,
      [
        boundVerification(run.id, verifying.claimAttemptId, {
          changeId,
          property: 'borderRadius',
          requested: 24,
          rendered: '24px',
          passed: true,
        }),
      ],
      run.id,
      verifying.claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /not waiting for verification/,
  );
  stored = await store.read(session.changeSet.sessionId);
  assert.equal(stored.applyRuns[0]?.state, 'rebuilding');
  assert.equal(stored.changeSet.changes[0]?.after, 32);
  assert.notEqual(stored.changeSet.changes[0]?.status, 'applied');
  assert.notEqual(stored.deliveryRecords[0]?.status, 'verified');
});

test('rejects verification outside the active frozen run contract', async () => {
  const { store, session, changeId } = await reviewedSession();
  let stored = await store.createApplyRun(session.changeSet.sessionId, {
    reviews: [{ changeId, approved: true }],
  });
  const run = stored.applyRuns[0]!;
  const verifying = await moveRunToVerifying(store, session.changeSet.sessionId, run.id);
  const result = boundVerification(run.id, verifying.claimAttemptId, {
    changeId,
    property: 'borderRadius',
    requested: 24,
    rendered: '24px',
    passed: true,
  });
  await assert.rejects(
    store.addVerifications(
      session.changeSet.sessionId,
      [{ ...result, property: 'width' }],
      run.id,
      verifying.claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /does not match reviewed property/,
  );
  await assert.rejects(
    store.addVerifications(
      session.changeSet.sessionId,
      [{ ...result, requested: 28 }],
      run.id,
      verifying.claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /does not match reviewed value/,
  );
  await assert.rejects(
    store.addVerifications(
      session.changeSet.sessionId,
      [result],
      run.id,
      'claim_stale',
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /claim is no longer active/,
  );
  stored = await store.read(session.changeSet.sessionId);
  assert.equal(stored.applyRuns[0]?.state, 'verifying');
  assert.deepEqual(stored.applyRuns[0]?.verificationResults, []);
});

test('requires rendered verification for every reviewed context', async () => {
  const { store, session, changeId } = await reviewedSession(
    {},
    {
      breakpoints: ['mobile', 'desktop'],
      themes: ['light', 'dark'],
      states: ['default'],
    },
  );
  let stored = await store.createApplyRun(session.changeSet.sessionId, {
    reviews: [{ changeId, approved: true }],
  });
  const runId = stored.applyRuns[0]!.id;
  stored = await store.claimApplyRun(session.changeSet.sessionId, runId, {
    agent: { name: 'codex' },
    revision: 'rev-1',
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
  });
  const claimAttemptId = stored.applyRuns[0]!.claimAttemptId!;
  await store.updateApplyRun(session.changeSet.sessionId, runId, {
    state: 'applying',
    claimAttemptId,
  });
  await store.updateApplyRun(
    session.changeSet.sessionId,
    runId,
    {
      state: 'rebuilding',
      changedFiles: ['src/Button.tsx'],
      validationResults: [boundValidation()],
      claimAttemptId,
    },
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  await store.recordApplyResult(
    session.changeSet.sessionId,
    runId,
    claimAttemptId,
    [changeId],
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  await store.updateApplyRun(session.changeSet.sessionId, runId, {
    state: 'verifying',
    claimAttemptId,
  });
  const verification = (breakpoint: string, theme: string) =>
    boundVerification(runId, claimAttemptId, {
      changeId,
      property: 'borderRadius',
      requested: 24,
      rendered: '24px',
      context: { breakpoint, theme, state: 'default' },
      passed: true,
    });
  stored = await store.addVerifications(
    session.changeSet.sessionId,
    [verification('mobile', 'light'), verification('mobile', 'dark')],
    runId,
    claimAttemptId,
    'browser-preview',
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  assert.equal(stored.applyRuns[0]?.state, 'verifying');
  assert.deepEqual(stored.deliveryRecords[0]?.contexts, [
    { breakpoint: 'mobile', theme: 'light', state: 'default' },
    { breakpoint: 'mobile', theme: 'dark', state: 'default' },
    { breakpoint: 'desktop', theme: 'light', state: 'default' },
    { breakpoint: 'desktop', theme: 'dark', state: 'default' },
  ]);
  stored = await store.addVerifications(
    session.changeSet.sessionId,
    [verification('desktop', 'light'), verification('desktop', 'dark')],
    runId,
    claimAttemptId,
    'browser-preview',
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  assert.equal(stored.applyRuns[0]?.state, 'passed');
  assert.equal(stored.applyRuns[0]?.verificationResults.length, 4);
  assert.equal(stored.deliveryRecords[0]?.acceptanceCriteria[0]?.status, 'passed');
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
    designGraphRevision: null,
    sourceProof: projectSourceProof('rev-2'),
  });
  assert.equal(stored.applyRuns[0]?.state, 'needs_attention');
  assert.equal(stored.designHistory.length, 0);
  assert.notEqual(stored.deliveryRecords[0]?.status, 'verified');
  stored = await store.retryApplyRun(session.changeSet.sessionId, first.id, {
    revision: 'rev-1',
    designGraphRevision: null,
  });
  const retry = stored.applyRuns[1]!;
  assert.equal(retry.attempts, 2);
  stored = await store.claimApplyRun(session.changeSet.sessionId, retry.id, {
    agent: { name: 'claude' },
    revision: 'rev-1',
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
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
    sourceProof: projectSourceProof(),
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
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
  });
  const claimAttemptId = stored.applyRuns[0]!.claimAttemptId!;
  await store.updateApplyRun(session.changeSet.sessionId, run.id, {
    state: 'applying',
    claimAttemptId,
  });
  await store.updateApplyRun(
    session.changeSet.sessionId,
    run.id,
    {
      state: 'rebuilding',
      changedFiles: ['src/Button.tsx'],
      validationResults: [boundValidation()],
      claimAttemptId,
    },
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  await store.recordApplyResult(
    session.changeSet.sessionId,
    run.id,
    claimAttemptId,
    [changeId],
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  await store.updateApplyRun(session.changeSet.sessionId, run.id, {
    state: 'verifying',
    claimAttemptId,
  });
  stored = await store.addVerifications(
    session.changeSet.sessionId,
    [
      boundVerification(run.id, claimAttemptId, {
        changeId,
        property: 'borderRadius',
        requested: 24,
        rendered: '20px',
        passed: false,
        reason: 'Rendered value differs from requested value',
      }),
    ],
    run.id,
    claimAttemptId,
    'browser-preview',
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  assert.equal(stored.applyRuns[0]?.state, 'needs_attention');
  assert.equal(stored.applyRuns.length, 1);
  stored = await store.retryApplyRun(session.changeSet.sessionId, run.id, {
    revision: 'rev-1',
    designGraphRevision: null,
  });
  assert.equal(stored.applyRuns[1]?.state, 'queued');
  assert.equal(stored.applyRuns[1]?.retryOf, run.id);
});

test('requires fresh verification for every context on a retry attempt', async () => {
  const { store, session, changeId } = await reviewedSession(
    {},
    {
      breakpoints: ['mobile', 'desktop'],
      themes: ['light'],
      states: ['default'],
    },
  );
  let stored = await store.createApplyRun(session.changeSet.sessionId, {
    reviews: [{ changeId, approved: true }],
  });
  const firstRun = stored.applyRuns[0]!;
  const firstAttempt = await moveRunToVerifying(store, session.changeSet.sessionId, firstRun.id);
  const result = (
    targetRunId: string,
    targetClaimAttemptId: string,
    breakpoint: string,
    passed: boolean,
  ) =>
    boundVerification(targetRunId, targetClaimAttemptId, {
      changeId,
      property: 'borderRadius',
      requested: 24,
      rendered: passed ? '24px' : '20px',
      context: { breakpoint, theme: 'light', state: 'default' },
      passed,
    });
  stored = await store.addVerifications(
    session.changeSet.sessionId,
    [
      result(firstRun.id, firstAttempt.claimAttemptId, 'mobile', true),
      result(firstRun.id, firstAttempt.claimAttemptId, 'desktop', false),
    ],
    firstRun.id,
    firstAttempt.claimAttemptId,
    'browser-preview',
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  assert.equal(stored.applyRuns[0]?.state, 'needs_attention');

  stored = await store.retryApplyRun(session.changeSet.sessionId, firstRun.id, {
    revision: 'rev-1',
    designGraphRevision: null,
  });
  const retry = stored.applyRuns[1]!;
  assert.deepEqual(retry.reviewedChangeSet, firstRun.reviewedChangeSet);
  assert.deepEqual(retry.verificationResults, []);
  const retryAttempt = await moveRunToVerifying(store, session.changeSet.sessionId, retry.id);
  stored = await store.addVerifications(
    session.changeSet.sessionId,
    [result(retry.id, retryAttempt.claimAttemptId, 'desktop', true)],
    retry.id,
    retryAttempt.claimAttemptId,
    'browser-preview',
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  assert.equal(stored.applyRuns[1]?.state, 'verifying');
  assert.equal(stored.applyRuns[1]?.verificationResults.length, 1);
  assert.equal(stored.applyRuns[1]?.verificationResults[0]?.applyRunId, retry.id);
  assert.equal(
    stored.applyRuns[1]?.verificationResults[0]?.claimAttemptId,
    retryAttempt.claimAttemptId,
  );

  stored = await store.addVerifications(
    session.changeSet.sessionId,
    [result(retry.id, retryAttempt.claimAttemptId, 'mobile', true)],
    retry.id,
    retryAttempt.claimAttemptId,
    'browser-preview',
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  assert.equal(stored.applyRuns[1]?.state, 'passed');
  assert.equal(stored.applyRuns[1]?.verificationResults.length, 2);
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
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
  });
  const staleClaimId = stored.applyRuns[0]!.claimAttemptId!;
  assert.equal(stored.applyRuns[0]?.claimExpiresAt, '2026-09-02T20:00:01.000Z');

  now = new Date('2026-09-02T20:00:00.800Z');
  stored = await store.heartbeatApplyRun(session.changeSet.sessionId, runId, staleClaimId);
  assert.equal(stored.applyRuns[0]?.claimExpiresAt, '2026-09-02T20:00:01.800Z');

  now = new Date('2026-09-02T20:00:02.000Z');
  stored = await store.recoverSession(session.changeSet.sessionId);
  assert.equal(stored.applyRuns[0]?.state, 'queued');
  assert.equal(stored.applyRuns[0]?.requeueCount, 1);
  assert.equal(stored.applyRuns[0]?.claimAttemptId, undefined);

  stored = await store.claimApplyRun(session.changeSet.sessionId, runId, {
    agent: { name: 'codex', taskId: 'second' },
    revision: 'rev-1',
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
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

test('queued session reconnect rotates preview credentials without replacing its reviewed run', async () => {
  let now = new Date('2026-09-15T12:00:00.000Z');
  const { store, session, changeId } = await reviewedSession({
    claimLeaseMs: 1000,
    now: () => now,
  });
  const id = session.changeSet.sessionId;
  const first = 'first-preview-capability-'.repeat(2);
  const second = 'second-preview-capability-'.repeat(2);
  const third = 'third-preview-capability-'.repeat(2);
  await store.setPreviewCapability(id, first);
  let stored = await store.createApplyRun(id, { reviews: [{ changeId, approved: true }] });
  const reviewed = structuredClone(stored.applyRuns[0]!);
  stored = await store.setPreviewCapability(id, second);
  assert.deepEqual(
    JSON.parse(JSON.stringify(stored.applyRuns[0])),
    JSON.parse(JSON.stringify(reviewed)),
  );
  assert.equal(previewCapabilityMatches(stored.previewCapabilityHash, first), false);
  assert.equal(previewCapabilityMatches(stored.previewCapabilityHash, second), true);
  stored = await store.claimApplyRun(id, reviewed.id, {
    agent: { name: 'rehearsal' },
    revision: 'rev-1',
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
  });
  const staleClaimId = stored.applyRuns[0]!.claimAttemptId!;
  await assert.rejects(store.setPreviewCapability(id, third), /active Apply run/);
  now = new Date('2026-09-15T12:00:02.000Z');
  // The same mutation path used by CLI startup recovers an expired claim first.
  stored = await store.setPreviewCapability(id, third);
  assert.equal(stored.applyRuns[0]!.state, 'queued');
  assert.equal(stored.applyRuns[0]!.id, reviewed.id);
  assert.deepEqual(stored.applyRuns[0]!.reviewedChangeSet, reviewed.reviewedChangeSet);
  assert.equal(stored.applyRuns[0]!.requeueCount, 1);
  assert.equal(previewCapabilityMatches(stored.previewCapabilityHash, second), false);
  assert.equal(previewCapabilityMatches(stored.previewCapabilityHash, third), true);
  stored = await store.claimApplyRun(id, reviewed.id, {
    agent: { name: 'reconnected' },
    revision: 'rev-1',
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
  });
  assert.notEqual(stored.applyRuns[0]!.claimAttemptId, staleClaimId);
  await assert.rejects(
    store.updateApplyRun(id, reviewed.id, {
      state: 'applying',
      claimAttemptId: staleClaimId,
    }),
    /claim is no longer active/,
  );
});

test('preview credentials cannot rotate during active source work or verification', async () => {
  const { store, session, changeId } = await reviewedSession();
  const id = session.changeSet.sessionId;
  const first = 'original-preview-capability-'.repeat(2);
  await store.setPreviewCapability(id, first);
  const queued = await store.createApplyRun(id, { reviews: [{ changeId, approved: true }] });
  await moveRunToVerifying(store, id, queued.applyRuns[0]!.id);
  await assert.rejects(
    store.setPreviewCapability(id, 'replacement-capability-'.repeat(2)),
    /active Apply run/,
  );
  const stored = await store.read(id);
  assert.equal(stored.applyRuns[0]!.state, 'verifying');
  assert.equal(previewCapabilityMatches(stored.previewCapabilityHash, first), true);
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
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
  });
  const firstClaim = stored.applyRuns[0]!.claimAttemptId!;
  stored = await store.updateApplyRun(session.changeSet.sessionId, runId, {
    state: 'applying',
    claimAttemptId: firstClaim,
  });
  assert.equal(stored.applyRuns[0]?.claimExpiresAt, '2026-09-02T20:00:01.000Z');

  now = new Date('2026-09-02T20:00:02.000Z');
  stored = await store.recoverSession(session.changeSet.sessionId);
  assert.equal(stored.applyRuns[0]?.id, runId);
  assert.equal(stored.applyRuns[0]?.state, 'needs_attention');
  assert.equal(stored.applyRuns[0]?.interruptedState, 'applying');
  assert.match(stored.applyRuns[0]?.error ?? '', /disconnected while applying/);

  await assert.rejects(
    store.authorizeApplyRunResume(session.changeSet.sessionId, runId, {
      expectedRevision: 'rev-after-partial-source-work',
      expectedDesignGraphRevision: null,
      currentRevision: 'rev-1',
      currentDesignGraphRevision: null,
    }),
    /Resume revision conflict/,
  );
  stored = await store.authorizeApplyRunResume(session.changeSet.sessionId, runId, {
    expectedRevision: 'rev-1',
    expectedDesignGraphRevision: null,
    currentRevision: 'rev-1',
    currentDesignGraphRevision: null,
  });
  assert.equal(stored.applyRuns.length, 1);
  assert.equal(stored.applyRuns[0]?.state, 'queued');
  assert.equal(stored.applyRuns[0]?.agent, undefined);
  assert.equal(stored.applyRuns[0]?.claimAttemptId, undefined);
  assert.equal(stored.applyRuns[0]?.completedAt, undefined);

  stored = await store.claimApplyRun(session.changeSet.sessionId, runId, {
    agent: { name: 'codex', taskId: 'second' },
    revision: 'rev-1',
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
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
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
  });
  const path = join(root, `${session.changeSet.sessionId}.json`);
  const legacy = JSON.parse(await readFile(path, 'utf8'));
  delete legacy.applyRuns[0].claimAttemptId;
  delete legacy.applyRuns[0].claimExpiresAt;
  delete legacy.applyRuns[0].claimHeartbeatAt;
  await writeFile(path, `${JSON.stringify(legacy, null, 2)}\n`);

  stored = await store.recoverSession(session.changeSet.sessionId);
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
  assert.equal(migrated.changeSet.protocolVersion, '1.3.0');
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
  assert.equal(migrated.changeSet.protocolVersion, '1.3.0');
  assert.deepEqual(migrated.changeSet.operations, []);
  assert.equal(migrated.changeSet.designGraphRevision, undefined);
});

test('migrates stored protocol 1.2 changes and verification context', async () => {
  const { root, store, session, changeId } = await reviewedSession();
  const path = join(root, `${session.changeSet.sessionId}.json`);
  const raw = JSON.parse(await readFile(path, 'utf8')) as {
    changeSet: {
      protocolVersion: string;
      changes: Array<{ contextSet?: unknown; context: unknown }>;
    };
    verifications: Array<Record<string, unknown>>;
  };
  raw.changeSet.protocolVersion = '1.2.0';
  delete raw.changeSet.changes[0]!.contextSet;
  raw.verifications = [
    {
      changeId,
      property: 'borderRadius',
      requested: 24,
      rendered: '24px',
      passed: true,
      verifiedAt: '2026-08-29T00:00:00.000Z',
    },
  ];
  await writeFile(path, JSON.stringify(raw));
  const migrated = await store.read(session.changeSet.sessionId);
  assert.equal(migrated.changeSet.protocolVersion, '1.3.0');
  assert.deepEqual(migrated.changeSet.changes[0]?.contextSet, {
    breakpoints: ['current'],
    themes: ['current'],
    states: ['current'],
  });
  assert.deepEqual(migrated.verifications[0]?.context, {
    breakpoint: 'current',
    theme: 'current',
    state: 'current',
  });
});

test('requires legacy active apply runs without frozen contracts to be reviewed again', async () => {
  const { root, store, session, changeId } = await reviewedSession();
  await store.createApplyRun(session.changeSet.sessionId, {
    reviews: [{ changeId, approved: true }],
  });
  const path = join(root, `${session.changeSet.sessionId}.json`);
  const raw = JSON.parse(await readFile(path, 'utf8')) as {
    changeSet: { protocolVersion: string };
    applyRuns: Array<{ reviewedChangeSet?: unknown }>;
  };
  raw.changeSet.protocolVersion = '1.2.0';
  delete raw.applyRuns[0]!.reviewedChangeSet;
  await writeFile(path, JSON.stringify(raw));

  const migrated = await store.read(session.changeSet.sessionId);
  assert.equal(migrated.applyRuns[0]?.reviewedChangeSet, undefined);
  assert.equal(migrated.applyRuns[0]?.state, 'needs_attention');
  assert.match(migrated.applyRuns[0]?.error ?? '', /reviewed again/);
  let persisted = JSON.parse(await readFile(path, 'utf8')) as {
    applyRuns: Array<{ reviewedChangeSet?: unknown; state?: string }>;
  };
  assert.equal(persisted.applyRuns[0]?.state, 'queued');
  await store.markDocumentationDrift(session.changeSet.sessionId, []);
  persisted = JSON.parse(await readFile(path, 'utf8')) as {
    applyRuns: Array<{ reviewedChangeSet?: unknown; state?: string }>;
  };
  assert.equal(persisted.applyRuns[0]?.reviewedChangeSet, undefined);
  assert.equal(persisted.applyRuns[0]?.state, 'needs_attention');
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
  await assert.rejects(
    store.updateVisualAgentProposal(id, requestId, proposalId, 'previewed'),
    /Save this proposal before confirming it in Preview/,
  );
  const saved = await store.updateVisualAgentProposal(id, requestId, proposalId, 'preview');
  const branchId = saved.visualAgentRequests[0]!.proposals[0]!.branchId!;
  assert.equal(saved.designBranches.find((item) => item.id === branchId)?.changes.length, 2);
  assert.equal(saved.visualAgentRequests[0]!.proposals[0]!.status, 'proposed');
  assert.equal(saved.activeDesignBranchId, undefined);
  const savedAgain = await store.updateVisualAgentProposal(id, requestId, proposalId, 'preview');
  assert.equal(savedAgain.designBranches.filter((item) => item.id === branchId).length, 1);
  assert.equal(savedAgain.visualAgentRequests[0]!.proposals[0]!.status, 'proposed');
  await assert.rejects(
    store.updateVisualAgentProposal(id, requestId, proposalId, 'promote'),
    /Confirm this proposal in Preview before promoting it to Review/,
  );
  const previewed = await store.updateVisualAgentProposal(id, requestId, proposalId, 'previewed');
  assert.equal(previewed.visualAgentRequests[0]!.proposals[0]!.status, 'previewing');
  assert.equal(previewed.activeDesignBranchId, branchId);
  const cancelled = await store.activateDesignBranch(id);
  assert.equal(cancelled.activeDesignBranchId, undefined);
  assert.equal(cancelled.visualAgentRequests[0]!.proposals[0]!.status, 'proposed');
  assert.deepEqual(cancelled.changeSet.changes, changed.changeSet.changes);
  assert.equal(cancelled.designBranches.find((item) => item.id === branchId)?.changes.length, 2);
  await assert.rejects(
    store.updateVisualAgentProposal(id, requestId, proposalId, 'promote'),
    /Confirm this proposal in Preview/,
  );
  await store.updateVisualAgentProposal(id, requestId, proposalId, 'preview');
  await store.updateVisualAgentProposal(id, requestId, proposalId, 'previewed');
  const promoted = await store.updateVisualAgentProposal(id, requestId, proposalId, 'promote');
  assert.equal(promoted.changeSet.changes.length, 2);
  assert.equal(promoted.designBranches.find((item) => item.id === branchId)?.status, 'chosen');
  assert.equal(promoted.visualAgentRequests[0]!.proposals[0]!.status, 'promoted');
});

test('requires private capabilities for durable Apply and Visual Agent mutations', async () => {
  const { store, session, changeId } = await reviewedSession();
  const id = session.changeSet.sessionId;
  let stored = await store.createApplyRun(id, { reviews: [{ changeId, approved: true }] });
  const runId = stored.applyRuns[0]!.id;
  const applyCapability = 'apply-capability-kept-out-of-public-results';
  stored = await store.claimApplyRun(id, runId, {
    agent: { name: 'codex' },
    revision: 'rev-1',
    designGraphRevision: null,
    sourceProof: projectSourceProof(),
    claimCapability: applyCapability,
  });
  const applyAttempt = stored.applyRuns[0]!.claimAttemptId!;
  assert.match(stored.applyRuns[0]!.claimCapabilityHash ?? '', /^[a-f0-9]{64}$/);
  assert.notEqual(stored.applyRuns[0]!.claimCapabilityHash, applyCapability);
  await assert.rejects(store.heartbeatApplyRun(id, runId, applyAttempt), /private capability/);
  await assert.rejects(
    store.updateApplyRun(id, runId, {
      state: 'applying',
      claimAttemptId: applyAttempt,
      claimCapability: 'wrong',
    }),
    /capability is invalid/,
  );
  stored = await store.updateApplyRun(id, runId, {
    state: 'applying',
    claimAttemptId: applyAttempt,
    claimCapability: applyCapability,
  });
  assert.equal(stored.applyRuns[0]?.state, 'applying');

  stored = await store.createVisualAgentRequest(id, {
    prompt: 'Inspect this region.',
    context: {
      targets: [],
      region: { id: 'region', x: 0, y: 0, width: 100, height: 100, label: 'Region' },
      comments: [],
      viewport: { width: 1440, height: 900 },
      breakpoint: 'current',
      theme: 'system',
      state: 'current',
      tokens: [],
    },
  });
  const requestId = stored.visualAgentRequests[0]!.id;
  const visualCapability = 'visual-capability-kept-out-of-public-results';
  stored = await store.claimVisualAgentRequest(id, requestId, {
    agent: { name: 'codex' },
    claimCapability: visualCapability,
  });
  const visualAttempt = stored.visualAgentRequests[0]!.claimAttemptId!;
  await assert.rejects(
    store.respondToVisualAgentRequest(id, requestId, {
      claimAttemptId: visualAttempt,
      message: 'Response',
      proposals: [],
    }),
    /private capability/,
  );
  stored = await store.respondToVisualAgentRequest(id, requestId, {
    claimAttemptId: visualAttempt,
    claimCapability: visualCapability,
    message: 'Response',
    proposals: [],
  });
  assert.equal(stored.visualAgentRequests[0]?.status, 'ready');
  assert.equal(stored.visualAgentRequests[0]?.claimCapabilityHash, undefined);
});

test('proves each reviewed item through its selected semantic source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-source-groups-'));
  const store = new SessionStore(root);
  const session = await store.create({
    projectRoot: '/project',
    revision: 'rev-1',
    platform: 'web',
    viewport: { width: 1440, height: 900 },
    theme: 'light',
    breakpoint: 'desktop',
    state: 'default',
  });
  const id = session.changeSet.sessionId;
  let stored = await store.addOperation(id, {
    id: 'operation-source-a',
    kind: 'resize',
    label: 'Resize the source-backed button',
    targetIds: ['button'],
    mappingCandidates: [
      {
        id: 'mapping-source-a',
        label: 'Authored button rule',
        intent: 'resize',
        property: 'height',
        value: 44,
        source: { file: 'src/A.css', line: 10 },
        confidence: 'instrumented',
      },
    ],
    status: 'resolved',
  });
  stored = await store.addChange(id, {
    id: 'change-source-a',
    operationId: stored.changeSet.operations[0]!.id,
    target: {
      id: 'button',
      platform: 'web',
      semanticRole: 'button',
      label: 'Button',
      componentPath: [],
      geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
      locator: { selector: 'button' },
      source: { file: 'src/B.css', line: 20 },
      confidence: 'instrumented',
      evidence: ['source annotation'],
    },
    category: 'layout',
    property: 'minHeight',
    before: 40,
    after: 44,
    unit: 'px',
    scope: 'instance',
    context: { breakpoint: 'desktop', theme: 'light', state: 'default' },
    confidence: 'instrumented',
    evidence: ['computed style'],
    status: 'draft',
  });
  const operation = stored.changeSet.operations[0]!;
  assert.deepEqual(operation.changeIds, ['change-source-a']);
  stored = await store.createApplyRun(id, {
    reviews: [{ changeId: 'change-source-a', approved: true }],
    revision: 'rev-1',
  });
  assert.deepEqual(reviewedSourceFiles(stored.applyRuns[0]!.reviewedChangeSet!), ['src/A.css']);
  const runId = stored.applyRuns[0]!.id;
  const baseline = {
    scope: 'mapped-files' as const,
    revision: 'rev-1',
    files: [
      {
        path: 'src/A.css',
        exists: true,
        sha256: BASELINE_HASH,
        lineAnchors: [{ line: 10, sha256: BASELINE_HASH }],
      },
      {
        path: 'src/B.css',
        exists: true,
        sha256: BASELINE_HASH,
        lineAnchors: [{ line: 20, sha256: BASELINE_HASH }],
      },
    ],
  };
  stored = await store.claimApplyRun(id, runId, {
    agent: { name: 'codex' },
    revision: 'rev-1',
    designGraphRevision: null,
    sourceProof: baseline,
  });
  const attempt = stored.applyRuns[0]!.claimAttemptId!;
  await store.updateApplyRun(id, runId, { state: 'applying', claimAttemptId: attempt });
  await store.updateApplyRun(
    id,
    runId,
    {
      state: 'rebuilding',
      claimAttemptId: attempt,
      changedFiles: ['src/B.css'],
      validationResults: [boundValidation()],
    },
    {
      ...baseline,
      revision: 'rev-2',
      files: [
        {
          path: 'src/A.css',
          exists: true,
          sha256: BASELINE_HASH,
          lineAnchors: [{ line: 10, sha256: BASELINE_HASH }],
        },
        {
          path: 'src/B.css',
          exists: true,
          sha256: APPLIED_HASH,
          lineAnchors: [{ line: 20, sha256: APPLIED_HASH }],
        },
      ],
    },
  );
  await assert.rejects(
    store.recordApplyResult(id, runId, attempt, ['change-source-a'], {
      ...baseline,
      revision: 'rev-2',
      files: [
        {
          path: 'src/A.css',
          exists: true,
          sha256: BASELINE_HASH,
          lineAnchors: [{ line: 10, sha256: BASELINE_HASH }],
        },
        {
          path: 'src/B.css',
          exists: true,
          sha256: APPLIED_HASH,
          lineAnchors: [{ line: 20, sha256: APPLIED_HASH }],
        },
      ],
    }),
    /does not prove every reviewed item.*src\/A\.css/,
  );
  const unrelatedSameFileProof = {
    ...baseline,
    revision: 'rev-3',
    files: [
      {
        path: 'src/A.css',
        exists: true,
        sha256: APPLIED_HASH,
        lineAnchors: [{ line: 10, sha256: BASELINE_HASH }],
      },
      {
        path: 'src/B.css',
        exists: true,
        sha256: BASELINE_HASH,
        lineAnchors: [{ line: 20, sha256: BASELINE_HASH }],
      },
    ],
  };
  await store.updateApplyRun(
    id,
    runId,
    {
      changedFiles: ['src/A.css'],
      validationResults: [boundValidation()],
      claimAttemptId: attempt,
    },
    unrelatedSameFileProof,
  );
  await assert.rejects(
    store.recordApplyResult(id, runId, attempt, ['change-source-a'], unrelatedSameFileProof),
    /does not prove every reviewed item.*src\/A\.css:10/,
  );
});

test('rejects older evidence replacements atomically across multiple contexts', async () => {
  const { store, session, changeId } = await reviewedSession(
    {},
    {
      breakpoints: ['mobile', 'desktop'],
      themes: ['light'],
      states: ['default'],
    },
  );
  const id = session.changeSet.sessionId;
  let stored = await store.createApplyRun(id, { reviews: [{ changeId, approved: true }] });
  const runId = stored.applyRuns[0]!.id;
  const moved = await moveRunToVerifying(store, id, runId);
  stored = moved.stored;
  const acknowledgedAt = Date.parse(stored.applyRuns[0]!.applyResultAcknowledgedAt!);
  const evidence = (breakpoint: string, passed: boolean, verifiedAt: number) =>
    boundVerification(runId, moved.claimAttemptId, {
      changeId,
      property: 'borderRadius',
      requested: 24,
      rendered: passed ? '24px' : '20px',
      passed,
      context: { breakpoint, theme: 'light', state: 'default' },
      verifiedAt: new Date(verifiedAt).toISOString(),
    });
  stored = await store.addVerifications(
    id,
    [evidence('mobile', false, acknowledgedAt + 20)],
    runId,
    moved.claimAttemptId,
    'browser-preview',
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  assert.equal(stored.applyRuns[0]?.state, 'verifying');
  await assert.rejects(
    store.addVerifications(
      id,
      [
        evidence('mobile', true, acknowledgedAt + 10),
        evidence('desktop', true, acknowledgedAt + 30),
      ],
      runId,
      moved.claimAttemptId,
      'browser-preview',
      projectSourceProof('rev-2', APPLIED_HASH),
    ),
    /strictly newer/,
  );
  stored = await store.read(id);
  assert.equal(stored.applyRuns[0]?.verificationResults.length, 1);
  assert.equal(stored.applyRuns[0]?.verificationResults[0]?.passed, false);
  assert.equal(stored.applyRuns[0]?.state, 'verifying');
});

test('preserves applied history and starts a new draft for later edits', async () => {
  const { store, session, changeId } = await reviewedSession();
  const id = session.changeSet.sessionId;
  let stored = await store.createApplyRun(id, { reviews: [{ changeId, approved: true }] });
  const runId = stored.applyRuns[0]!.id;
  const moved = await moveRunToVerifying(store, id, runId);
  stored = await store.addVerifications(
    id,
    [
      boundVerification(runId, moved.claimAttemptId, {
        changeId,
        property: 'borderRadius',
        requested: 24,
        rendered: '24px',
        passed: true,
      }),
    ],
    runId,
    moved.claimAttemptId,
    'browser-preview',
    projectSourceProof('rev-2', APPLIED_HASH),
  );
  assert.equal(stored.changeSet.changes[0]?.status, 'applied');
  await assert.rejects(
    store.updateApplyRun(id, runId, {
      message: 'rewrite terminal evidence',
      claimAttemptId: moved.claimAttemptId,
    }),
    /immutable/,
  );
  await assert.rejects(
    store.deleteChange(id, changeId),
    /cannot be deleted|attached to an apply run/,
  );
  await assert.rejects(
    store.createApplyRun(id, { reviews: [{ changeId, approved: true }] }),
    /Applied changes cannot enter a new Apply review/,
  );
  await assert.rejects(
    store.updateDeliveryRecord(id, stored.deliveryRecords[0]!.id, { intent: 'Rewrite history' }),
    /immutable/,
  );
  const applied = stored.changeSet.changes[0]!;
  stored = await store.addChange(id, {
    ...applied,
    id: undefined,
    before: applied.after,
    after: 48,
    status: 'draft',
  });
  assert.equal(stored.changeSet.changes.length, 2);
  assert.equal(stored.changeSet.changes[0]?.id, changeId);
  assert.equal(stored.changeSet.changes[0]?.status, 'applied');
  assert.equal(stored.changeSet.changes[0]?.after, 24);
  assert.notEqual(stored.changeSet.changes[1]?.id, changeId);
  assert.equal(stored.changeSet.changes[1]?.before, 24);
  assert.equal(stored.changeSet.changes[1]?.after, 48);
  assert.equal(stored.designHistory.length, 1);
});
