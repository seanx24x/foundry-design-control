import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { FoundryRuntime } from './server.js';
import { SessionStore } from './store.js';
import { GoogleFontsCatalog } from './google-fonts.js';

test('records a linked operation and change atomically over loopback HTTP', async () => {
  const port = 45_000 + Math.floor(Math.random() * 500);
  const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-runtime-record-')));
  const runtime = new FoundryRuntime({ port, store });
  await runtime.start();
  try {
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
        intent: 'resize',
        property: 'minHeight',
        targetId: 'button',
        value: 44,
        source: { file: 'src/Button.css', line: 12 },
        scope: 'instance',
        confidence: 'instrumented',
        evidence: ['Exact authored declaration'],
        blastRadius: 1,
      },
    ];
    const response = await fetch(`http://127.0.0.1:${port}/v1/sessions/${id}/change-records`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({
        change: {
          target: {
            id: 'button',
            platform: 'web',
            semanticRole: 'button',
            label: 'Button',
            componentPath: ['Button'],
            source: { file: 'src/Button.css', line: 12 },
            geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
            locator: { selector: '[data-foundry-id="button"]' },
            confidence: 'instrumented',
            evidence: ['live geometry'],
          },
          category: 'accessibility',
          property: 'minHeight',
          before: 40,
          after: 44,
          unit: 'px',
          operationId: 'op-touch-target',
          mappingCandidates,
          selectedMappingId: 'map-height',
          scope: 'instance',
          context: { breakpoint: 'current', theme: 'current', state: 'current' },
          confidence: 'instrumented',
          evidence: ['computed style'],
          status: 'draft',
        },
        operation: {
          id: 'op-touch-target',
          kind: 'resize',
          label: 'Increase touch target height',
          targetIds: ['button'],
          mappingCandidates,
          selectedMappingId: 'map-height',
          status: 'resolved',
        },
      }),
    });
    assert.equal(response.status, 201);
    const payload = (await response.json()) as {
      changeSet: {
        changes: Array<{ id: string; operationId?: string }>;
        operations: Array<{ id: string; changeIds: string[] }>;
      };
    };
    assert.equal(payload.changeSet.changes.length, 1);
    assert.equal(payload.changeSet.operations.length, 1);
    assert.equal(payload.changeSet.changes[0]?.operationId, 'op-touch-target');
    assert.deepEqual(payload.changeSet.operations[0]?.changeIds, [
      payload.changeSet.changes[0]!.id,
    ]);
  } finally {
    await runtime.stop();
  }
});

test('protects and serves the apply-run lifecycle over loopback HTTP', async () => {
  const port = 46_000 + Math.floor(Math.random() * 1_000);
  const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-runtime-')));
  let sourceRevision = 'rev-1';
  let sourceHash = 'a'.repeat(64);
  const runtime = new FoundryRuntime({
    port,
    store,
    resolveProjectRevision: async ({ sourcePaths, sourceLocations }) => ({
      supported: true,
      scope: 'mapped-files',
      revision: sourceRevision,
      files: sourcePaths.map((path) => ({
        path,
        exists: true,
        sha256: sourceHash,
        lineAnchors: sourceLocations
          .filter((location) => location.path === path && location.line)
          .map((location) => ({
            line: location.line!,
            endLine: location.line!,
            symbol: location.symbol,
            sha256: sourceHash,
          })),
      })),
    }),
    googleFontsCatalog: new GoogleFontsCatalog(async () =>
      Response.json({
        familyMetadataList: [
          { family: 'Newsreader', category: 'Serif', fonts: { '400': {} }, popularity: 1 },
        ],
      }),
    ),
  });
  await runtime.start();
  try {
    const session = await store.create({
      projectRoot: '/project',
      revision: 'rev-1',
      platform: 'web',
      targetUrl: 'http://127.0.0.1:4173',
      previewOrigin: 'http://127.0.0.1:4173',
      theme: 'system',
      breakpoint: 'current',
      state: 'current',
    });
    const id = session.changeSet.sessionId;
    const unauthorized = await fetch(`http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs`);
    assert.equal(unauthorized.status, 401);

    const fontCatalog = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/google-fonts?query=news`,
      { headers: { 'x-foundry-token': session.token } },
    );
    assert.equal(fontCatalog.status, 200);
    assert.deepEqual(await fontCatalog.json(), {
      fonts: [
        {
          family: 'Newsreader',
          category: 'Serif',
          variants: ['400'],
          subsets: [],
          axes: [],
          popularity: 1,
        },
      ],
      source: 'google',
    });

    const bootstrap = await fetch(`http://127.0.0.1:${port}/adapter-bootstrap.js`);
    assert.equal(bootstrap.status, 200);
    assert.equal(bootstrap.headers.get('cache-control'), 'no-store');
    assert.match(await bootstrap.text(), /installFoundryInspector/);

    const graphResponse = await fetch(`http://127.0.0.1:${port}/v1/sessions/${id}/design-graph`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({
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
      }),
    });
    assert.equal(graphResponse.status, 200);
    const graphRead = await fetch(`http://127.0.0.1:${port}/v1/sessions/${id}/design-graph`, {
      headers: { 'x-foundry-token': session.token },
    });
    const graphPayload = (await graphRead.json()) as {
      designGraph: { revision: string };
    };
    assert.equal(graphPayload.designGraph.revision, 'rev-1');

    const disconnected = await fetch(`http://127.0.0.1:${port}/v1/sessions/${id}/agent-presence`, {
      headers: { 'x-foundry-token': session.token },
    });
    assert.deepEqual(await disconnected.json(), { connected: false, presence: null });

    const heartbeat = await fetch(`http://127.0.0.1:${port}/v1/sessions/${id}/agent-presence`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({ agent: { name: 'codex' }, ttlMs: 5_000 }),
    });
    const heartbeatPayload = (await heartbeat.json()) as {
      connected: boolean;
      presence: { agent: { name: string }; expiresAt: string };
    };
    assert.equal(heartbeatPayload.connected, true);
    assert.equal(heartbeatPayload.presence.agent.name, 'codex');
    assert.ok(Date.parse(heartbeatPayload.presence.expiresAt) > Date.now());

    const visualCreated = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/visual-agent-requests`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({
          prompt: 'Improve the hierarchy in this region.',
          context: {
            targets: [],
            region: { id: 'region-1', x: 20, y: 30, width: 480, height: 320 },
            comments: [],
            viewport: { width: 1440, height: 900 },
            breakpoint: 'desktop',
            theme: 'light',
            state: 'default',
            tokens: [],
          },
        }),
      },
    );
    assert.equal(visualCreated.status, 201);
    const visualPayload = (await visualCreated.json()) as {
      visualAgentRequests: Array<{ id: string; status: string }>;
    };
    const visualRequestId = visualPayload.visualAgentRequests[0]!.id;
    assert.equal(visualPayload.visualAgentRequests[0]?.status, 'queued');
    const visualClaimed = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/visual-agent-requests/${visualRequestId}/claim`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({ agent: { name: 'codex', taskId: 'task-1' } }),
      },
    );
    const visualClaimPayload = (await visualClaimed.json()) as {
      claimCapability: string;
      visualAgentRequests: Array<{ id: string; status: string; claimAttemptId: string }>;
    };
    assert.equal(visualClaimPayload.visualAgentRequests[0]?.status, 'thinking');
    assert.ok(visualClaimPayload.claimCapability);
    assert.doesNotMatch(JSON.stringify(visualClaimPayload.visualAgentRequests), /claimCapability/);
    const duplicateVisualClaim = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/visual-agent-requests/${visualRequestId}/claim`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({ agent: { name: 'other-agent' } }),
      },
    );
    assert.equal(duplicateVisualClaim.status, 409);
    const visualResponded = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/visual-agent-requests/${visualRequestId}/respond`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({
          claimAttemptId: visualClaimPayload.visualAgentRequests[0]!.claimAttemptId,
          claimCapability: visualClaimPayload.claimCapability,
          message: 'The focal point is competing with secondary content.',
          proposals: [],
        }),
      },
    );
    assert.equal(visualResponded.status, 200);
    const visualRespondedPayload = (await visualResponded.json()) as {
      visualAgentRequests: Array<{ status: string }>;
    };
    assert.equal(visualRespondedPayload.visualAgentRequests[0]?.status, 'ready');

    const changed = await store.addChange(id, {
      target: {
        id: 'button',
        platform: 'web',
        semanticRole: 'button',
        label: 'Button',
        componentPath: [],
        geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
        locator: { selector: 'button' },
        source: { file: 'src/Button.tsx', line: 1 },
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
    const deleted = await fetch(`http://127.0.0.1:${port}/v1/sessions/${id}/changes/${changeId}`, {
      method: 'DELETE',
      headers: { 'x-foundry-token': session.token },
    });
    assert.equal(deleted.status, 200);
    const deletedPayload = (await deleted.json()) as {
      changeSet: { changes: unknown[] };
      removedChange: { id: string };
    };
    assert.equal(deletedPayload.removedChange.id, changeId);
    assert.equal(deletedPayload.changeSet.changes.length, 0);

    const restoredChange = await store.addChange(id, {
      ...changed.changeSet.changes[0]!,
      id: undefined,
    });
    const restoredChangeId = restoredChange.changeSet.changes[0]!.id;
    const previewCapability = 'preview-capability-kept-only-in-the-live-frame';
    await store.setPreviewOrigin(id, 'http://127.0.0.1:4399');
    await store.setPreviewCapability(id, previewCapability);
    const rejectedOptimisticApply = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/changes/${restoredChangeId}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({ status: 'applied' }),
      },
    );
    assert.equal(rejectedOptimisticApply.status, 400);
    const created = await fetch(`http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({
        reviews: [{ changeId: restoredChangeId, approved: true }],
        revision: 'rev-1',
      }),
    });
    assert.equal(created.status, 201);
    const payload = (await created.json()) as {
      applyRuns: Array<{ id: string; state: string }>;
    };
    assert.equal(payload.applyRuns[0]?.state, 'queued');

    const claimed = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${payload.applyRuns[0]!.id}/claim`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({
          agent: { name: 'codex' },
          revision: 'rev-1',
          designGraphRevision: null,
        }),
      },
    );
    assert.equal(claimed.status, 200);
    const claimPayload = (await claimed.json()) as {
      claimCapability: string;
      applyRuns: Array<{ id: string; state: string; claimAttemptId?: string }>;
    };
    assert.equal(claimPayload.applyRuns[0]?.state, 'claimed');
    const runId = claimPayload.applyRuns[0]!.id;
    const claimAttemptId = claimPayload.applyRuns[0]!.claimAttemptId!;
    const claimCapability = claimPayload.claimCapability;
    assert.ok(claimAttemptId);
    assert.ok(claimCapability);
    assert.doesNotMatch(JSON.stringify(claimPayload.applyRuns), /claimCapability/);

    const listed = await fetch(`http://127.0.0.1:${port}/v1/sessions`);
    assert.equal(listed.status, 200);
    assert.doesNotMatch(await listed.text(), /claimCapability/);
    const publicRun = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${runId}`,
      { headers: { 'x-foundry-token': session.token } },
    );
    assert.doesNotMatch(await publicRun.text(), /claimCapability/);

    const rejectedUpdate = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${runId}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({ state: 'applying' }),
      },
    );
    assert.equal(rejectedUpdate.status, 400);

    const leaseHeartbeat = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${runId}/heartbeat`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({ claimAttemptId, claimCapability }),
      },
    );
    assert.equal(leaseHeartbeat.status, 200);

    const applying = await fetch(`http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${runId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({ state: 'applying', claimAttemptId, claimCapability }),
    });
    assert.equal(applying.status, 200);

    sourceRevision = 'rev-2';
    sourceHash = 'b'.repeat(64);

    const rebuilding = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${runId}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({
          state: 'rebuilding',
          changedFiles: ['src/Button.tsx'],
          validationResults: [{ name: 'fixture validation', passed: true }],
          claimAttemptId,
          claimCapability,
        }),
      },
    );
    assert.equal(rebuilding.status, 200);
    const rebuildingPayload = (await rebuilding.json()) as {
      applyRuns: Array<{
        id: string;
        validationResults: Array<{
          applyRunId?: string;
          claimAttemptId?: string;
          validatedRevision?: string;
          validatedAt?: string;
        }>;
      }>;
    };
    assert.deepEqual(
      rebuildingPayload.applyRuns.find((run) => run.id === runId)?.validationResults[0],
      {
        name: 'fixture validation',
        passed: true,
        applyRunId: runId,
        claimAttemptId,
        validatedRevision: 'rev-2',
        validatedAt: rebuildingPayload.applyRuns.find((run) => run.id === runId)
          ?.validationResults[0]?.validatedAt,
      },
    );
    assert.ok(
      rebuildingPayload.applyRuns.find((run) => run.id === runId)?.validationResults[0]
        ?.validatedAt,
    );
    const directAppliedStatus = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/changes/${restoredChangeId}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({ status: 'applied' }),
      },
    );
    assert.equal(directAppliedStatus.status, 400);
    const legacyApplyResult = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/apply-result`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({ changeIds: [restoredChangeId] }),
      },
    );
    assert.equal(legacyApplyResult.status, 409);
    const missingApplyAttempt = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${runId}/apply-result`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({ changeIds: [restoredChangeId] }),
      },
    );
    assert.equal(missingApplyAttempt.status, 400);
    const recordedApplyResult = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${runId}/apply-result`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({ claimAttemptId, claimCapability, changeIds: [restoredChangeId] }),
      },
    );
    assert.equal(recordedApplyResult.status, 200);
    const applyResultPayload = (await recordedApplyResult.json()) as {
      applyResult: { acknowledged: boolean; runId: string; claimAttemptId: string };
    };
    assert.deepEqual(applyResultPayload.applyResult, {
      acknowledged: true,
      runId,
      claimAttemptId,
      changeIds: [restoredChangeId],
    });
    const verifying = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${runId}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({ state: 'verifying', claimAttemptId, claimCapability }),
      },
    );
    assert.equal(verifying.status, 200);
    const verificationResults = [
      {
        applyRunId: runId,
        claimAttemptId,
        changeId: restoredChangeId,
        property: 'width',
        requested: 120,
        rendered: '120px',
        passed: true,
        geometry: { x: 0, y: 0, width: 120, height: 40, scale: 1 },
        evidence: ['Measured in the configured preview.'],
        verifiedAt: new Date().toISOString(),
      },
    ];
    const missingAttempt = await fetch(`http://127.0.0.1:${port}/v1/sessions/${id}/verify`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({ runId, results: verificationResults }),
    });
    assert.equal(missingAttempt.status, 400);
    await assert.rejects(
      store.setPreviewOrigin(id, 'http://127.0.0.1:4400'),
      /Finish or stop the active Apply run/i,
    );
    await assert.rejects(
      store.setPreviewCapability(id, 'different-preview-capability-that-is-long-enough'),
      /Finish or stop the active Apply run/i,
    );
    const missingOriginChallenge = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${runId}/verification-challenge`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
        },
        body: JSON.stringify({ claimAttemptId, previewCapability }),
      },
    );
    assert.equal(missingOriginChallenge.status, 403);
    const staleTargetOriginChallenge = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${runId}/verification-challenge`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
          origin: 'http://127.0.0.1:4173',
        },
        body: JSON.stringify({ claimAttemptId, previewCapability }),
      },
    );
    assert.equal(staleTargetOriginChallenge.status, 403);
    const challengeResponse = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${runId}/verification-challenge`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
          origin: 'http://127.0.0.1:4399',
        },
        body: JSON.stringify({ claimAttemptId }),
      },
    );
    assert.equal(challengeResponse.status, 403);
    const wrongCapabilityChallenge = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${runId}/verification-challenge`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
          origin: 'http://127.0.0.1:4399',
        },
        body: JSON.stringify({
          claimAttemptId,
          previewCapability: 'wrong-preview-capability',
        }),
      },
    );
    assert.equal(wrongCapabilityChallenge.status, 403);
    const authorizedChallenge = await fetch(
      `http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${runId}/verification-challenge`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': session.token,
          origin: 'http://127.0.0.1:4399',
        },
        body: JSON.stringify({ claimAttemptId, previewCapability }),
      },
    );
    assert.equal(authorizedChallenge.status, 201);
    const challenge = (await authorizedChallenge.json()) as { challenge: string };
    const verified = await fetch(`http://127.0.0.1:${port}/v1/sessions/${id}/verify`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
        origin: 'http://127.0.0.1:4399',
      },
      body: JSON.stringify({
        source: 'browser-preview',
        challenge: challenge.challenge,
        runId,
        claimAttemptId,
        results: verificationResults,
      }),
    });
    assert.equal(verified.status, 200);
    const verifiedPayload = (await verified.json()) as {
      applyRuns: Array<{ id: string; state: string }>;
    };
    assert.equal(verifiedPayload.applyRuns.find((run) => run.id === runId)?.state, 'passed');
  } finally {
    await runtime.stop();
  }
});

test('re-indexes project design atomically and preserves the last good graph', async () => {
  const port = 47_000 + Math.floor(Math.random() * 1_000);
  const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-reindex-')));
  let mode: 'success' | 'failure' | 'concurrent' = 'success';
  let calls = 0;
  const graph = (revision: string) => ({
    protocolVersion: '1.2.0' as const,
    projectRoot: '/project',
    revision,
    tokens: [],
    components: [],
    breakpoints: [],
    themes: [],
    states: [],
    motionPresets: [],
    indexedAt: `2026-09-10T00:00:0${calls}.000Z`,
  });
  const runtime = new FoundryRuntime({
    port,
    store,
    reindexProjectDesign: async ({ sessionId, projectRoot, revision, designGraphRevision }) => {
      calls += 1;
      assert.equal(projectRoot, '/project');
      assert.equal(revision, 'source-1');
      assert.ok(designGraphRevision);
      if (mode === 'failure') throw new Error('Indexer failed safely');
      if (mode === 'concurrent') await store.setDesignGraph(sessionId, graph('graph-concurrent'));
      return graph(mode === 'concurrent' ? 'graph-stale' : 'graph-2');
    },
  });
  const session = await store.create({
    projectRoot: '/project',
    revision: 'source-1',
    platform: 'web',
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const id = session.changeSet.sessionId;
  await store.setDesignGraph(id, graph('graph-1'));
  await runtime.start();
  try {
    const endpoint = `http://127.0.0.1:${port}/v1/sessions/${id}/design-graph/reindex`;
    const unauthorized = await fetch(endpoint, { method: 'POST' });
    assert.equal(unauthorized.status, 401);

    const stale = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({ expectedDesignGraphRevision: 'older-graph' }),
    });
    assert.equal(stale.status, 409);
    assert.equal(calls, 0);

    mode = 'failure';
    const failed = await fetch(endpoint, {
      method: 'POST',
      headers: { 'x-foundry-token': session.token },
    });
    assert.equal(failed.status, 400);
    assert.equal((await store.read(id)).designGraph?.revision, 'graph-1');

    mode = 'success';
    const succeeded = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({
        expectedRevision: 'source-1',
        expectedDesignGraphRevision: 'graph-1',
      }),
    });
    assert.equal(succeeded.status, 200);
    const payload = (await succeeded.json()) as {
      designGraph: { protocolVersion: string; revision: string };
      reindex: { previousDesignGraphRevision: string; designGraphRevision: string };
    };
    assert.equal(payload.designGraph.protocolVersion, '1.3.0');
    assert.equal(payload.designGraph.revision, 'graph-2');
    assert.equal(payload.reindex.previousDesignGraphRevision, 'graph-1');
    assert.equal(payload.reindex.designGraphRevision, 'graph-2');

    mode = 'concurrent';
    const conflicted = await fetch(endpoint, {
      method: 'POST',
      headers: { 'x-foundry-token': session.token },
    });
    assert.equal(conflicted.status, 409);
    assert.equal((await store.read(id)).designGraph?.revision, 'graph-concurrent');
  } finally {
    await runtime.stop();
  }
});

test('acknowledges a saved visual proposal before exposing it as previewing', async () => {
  const port = 48_000 + Math.floor(Math.random() * 1_000);
  const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-visual-preview-')));
  const runtime = new FoundryRuntime({ port, store });
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
    property: 'gap',
    before: 12,
    after: 16,
    unit: 'px',
    scope: 'instance',
    context: { breakpoint: 'desktop', theme: 'light', state: 'default' },
    confidence: 'instrumented',
    evidence: ['computed style'],
    status: 'draft',
  });
  const created = await store.createVisualAgentRequest(id, {
    prompt: 'Improve this card hierarchy.',
    context: {
      targets: [],
      region: {
        id: 'region-1',
        x: 0,
        y: 0,
        width: 320,
        height: 180,
        label: 'Card region',
      },
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
    agent: { name: 'codex', taskId: 'visual-preview-test' },
  });
  const responded = await store.respondToVisualAgentRequest(id, requestId, {
    claimAttemptId: claimed.visualAgentRequests[0]!.claimAttemptId!,
    message: 'Use a consistent gap.',
    proposals: [
      {
        name: 'Clearer spacing rhythm',
        summary: 'Increase the internal gap.',
        reasoning: ['The card mixes adjacent spacing values.'],
        exactValues: ['gap: 16px'],
        sourceLocations: ['src/Card.tsx:12'],
        responsiveImpact: 'Applies at desktop only.',
        verificationPlan: ['Measure the rebuilt card.'],
        changes: [changed.changeSet.changes[0]!],
      },
    ],
  });
  const proposalId = responded.visualAgentRequests[0]!.proposals[0]!.id;
  const endpoint = `http://127.0.0.1:${port}/v1/sessions/${id}/visual-agent-requests/${requestId}/proposals/${proposalId}`;
  const postAction = (action: string) =>
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({ action }),
    });

  await runtime.start();
  try {
    const savedResponse = await postAction('preview');
    assert.equal(savedResponse.status, 200);
    const saved = (await savedResponse.json()) as {
      activeDesignBranchId?: string;
      visualAgentRequests: Array<{
        proposals: Array<{ branchId?: string; status: string }>;
      }>;
    };
    assert.ok(saved.visualAgentRequests[0]!.proposals[0]!.branchId);
    assert.equal(saved.visualAgentRequests[0]!.proposals[0]!.status, 'proposed');
    assert.equal(saved.activeDesignBranchId, undefined);

    const prematurePromotion = await postAction('promote');
    assert.equal(prematurePromotion.status, 400);
    assert.match(
      ((await prematurePromotion.json()) as { error: string }).error,
      /Confirm this proposal in Preview/,
    );

    const acknowledgedResponse = await postAction('previewed');
    assert.equal(acknowledgedResponse.status, 200);
    const acknowledged = (await acknowledgedResponse.json()) as {
      activeDesignBranchId?: string;
      visualAgentRequests: Array<{
        proposals: Array<{ branchId?: string; status: string }>;
      }>;
    };
    assert.equal(acknowledged.visualAgentRequests[0]!.proposals[0]!.status, 'previewing');
    assert.equal(
      acknowledged.activeDesignBranchId,
      acknowledged.visualAgentRequests[0]!.proposals[0]!.branchId,
    );

    const unknownAction = await postAction('saved');
    assert.equal(unknownAction.status, 400);
    assert.match(
      ((await unknownAction.json()) as { error: string }).error,
      /Unknown visual proposal action: saved/,
    );
  } finally {
    await runtime.stop();
  }
});
