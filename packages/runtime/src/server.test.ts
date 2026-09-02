import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { FoundryRuntime } from './server.js';
import { SessionStore } from './store.js';

test('protects and serves the apply-run lifecycle over loopback HTTP', async () => {
  const port = 46_000 + Math.floor(Math.random() * 1_000);
  const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-runtime-')));
  const runtime = new FoundryRuntime({ port, store });
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
    const created = await fetch(`http://127.0.0.1:${port}/v1/sessions/${id}/apply-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({
        reviews: [{ changeId, approved: true }],
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
      applyRuns: Array<{ state: string }>;
    };
    assert.equal(claimPayload.applyRuns[0]?.state, 'claimed');
  } finally {
    await runtime.stop();
  }
});
