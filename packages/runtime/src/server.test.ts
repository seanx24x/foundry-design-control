import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { FoundryRuntime } from './server.js';
import { SessionStore } from './store.js';
import { GoogleFontsCatalog } from './google-fonts.js';

test('protects and serves the apply-run lifecycle over loopback HTTP', async () => {
  const port = 46_000 + Math.floor(Math.random() * 1_000);
  const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-runtime-')));
  const runtime = new FoundryRuntime({
    port,
    store,
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
      visualAgentRequests: Array<{ id: string; status: string; claimAttemptId: string }>;
    };
    assert.equal(visualClaimPayload.visualAgentRequests[0]?.status, 'thinking');
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
        body: JSON.stringify({ agent: { name: 'codex' }, revision: 'rev-1' }),
      },
    );
    assert.equal(claimed.status, 200);
    const claimPayload = (await claimed.json()) as {
      applyRuns: Array<{ id: string; state: string; claimAttemptId?: string }>;
    };
    assert.equal(claimPayload.applyRuns[0]?.state, 'claimed');
    const runId = claimPayload.applyRuns[0]!.id;
    const claimAttemptId = claimPayload.applyRuns[0]!.claimAttemptId!;
    assert.ok(claimAttemptId);

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
        body: JSON.stringify({ claimAttemptId }),
      },
    );
    assert.equal(leaseHeartbeat.status, 200);

    const applying = await fetch(`http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs/${runId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({ state: 'applying', claimAttemptId }),
    });
    assert.equal(applying.status, 200);
  } finally {
    await runtime.stop();
  }
});
