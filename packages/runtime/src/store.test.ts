import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SessionStore } from './store.js';

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

async function reviewedSession() {
  const root = await mkdtemp(join(tmpdir(), 'foundry-apply-'));
  const store = new SessionStore(root);
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
  stored = await store.claimApplyRun(session.changeSet.sessionId, runId, {
    agent: { name: 'cursor' },
    revision: 'rev-1',
  });
  assert.equal(stored.applyRuns[0]?.agent?.name, 'codex');
  await store.updateApplyRun(session.changeSet.sessionId, runId, {
    state: 'applying',
    message: 'Editing source.',
  });
  await store.updateApplyRun(session.changeSet.sessionId, runId, {
    state: 'rebuilding',
    changedFiles: ['src/Button.tsx'],
    validationResults: [{ name: 'typecheck', passed: true }],
  });
  await store.updateApplyRun(session.changeSet.sessionId, runId, {
    state: 'verifying',
    message: 'Source rebuilt.',
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
  await store.claimApplyRun(session.changeSet.sessionId, run.id, {
    agent: { name: 'cursor' },
    revision: 'rev-1',
  });
  await store.updateApplyRun(session.changeSet.sessionId, run.id, { state: 'applying' });
  await store.updateApplyRun(session.changeSet.sessionId, run.id, {
    state: 'rebuilding',
    changedFiles: ['src/Button.tsx'],
  });
  await store.updateApplyRun(session.changeSet.sessionId, run.id, { state: 'verifying' });
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
