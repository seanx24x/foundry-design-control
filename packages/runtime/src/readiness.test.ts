import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PROTOCOL_VERSION, type ReadinessReport } from 'foundry-design-protocol';
import { FoundryRuntime } from './server.js';
import { SessionStore } from './store.js';
import packageJson from '../package.json' with { type: 'json' };

test('readiness requires a live mapped preview and versioned listener, preserves the ledger and rejects spoofed preview evidence', async () => {
  const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-readiness-')));
  const session = await store.create({
    projectRoot: '/project',
    revision: 'r1',
    platform: 'web',
    targetUrl: 'http://127.0.0.1:4390',
    previewOrigin: 'http://127.0.0.1:4390',
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const id = session.changeSet.sessionId;
  const capability = 'readiness-private-capability-test-123456';
  await store.setPreviewCapability(id, capability);
  const before = (await store.read(id)).changeSet;
  const port = 46_500 + Math.floor(Math.random() * 400);
  let checks = 0;
  const runtime = new FoundryRuntime({
    port,
    store,
    resolveProjectReadiness: async () => {
      checks++;
      return {
        checks: [{ id: 'config', label: 'Configuration', status: 'passed', detail: 'Configured.' }],
        revision: 'r1',
      };
    },
  });
  await runtime.start();
  const base = `http://127.0.0.1:${port}/v1/sessions/${id}`;
  const headers = { 'x-foundry-token': session.token, 'content-type': 'application/json' };
  const read = async () =>
    (await (await fetch(`${base}/readiness`, { headers })).json()) as ReadinessReport;
  const heartbeat = {
    version: 1,
    previewCapability: capability,
    frameId: 'canvas-1',
    frameKind: 'canvas',
    protocolVersion: PROTOCOL_VERSION,
    adapterVersion: packageJson.version,
    targetCount: 4,
    mappedTargetCount: 2,
  };
  const postPreview = (input: object, origin = 'http://127.0.0.1:4390') =>
    fetch(`${base}/preview-presence`, {
      method: 'POST',
      headers: { ...headers, origin },
      body: JSON.stringify(input),
    });
  try {
    assert.notEqual((await fetch(`${base}/readiness`)).status, 200);
    assert.equal((await read()).ready, false);
    assert.equal((await postPreview(heartbeat, 'http://127.0.0.1:9999')).status, 403);
    assert.equal((await postPreview({ ...heartbeat, previewCapability: 'forged' })).status, 403);
    assert.equal((await read()).capabilities.inspect, false);
    assert.equal((await postPreview(heartbeat)).status, 200);
    const previewOnly = await read();
    assert.equal(previewOnly.capabilities.inspect, true);
    assert.equal(previewOnly.capabilities.stage, true);
    assert.equal(previewOnly.capabilities.apply, false);
    await fetch(`${base}/agent-presence`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agent: { name: 'Test agent' },
        bridgeVersion: 'old',
        listening: true,
      }),
    });
    assert.equal(
      (await read()).checks.find((check) => check.id === 'bridge-version')?.status,
      'failed',
    );
    await fetch(`${base}/agent-presence`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agent: { name: 'Test agent' },
        bridgeVersion: packageJson.version,
        listening: true,
      }),
    });
    assert.equal((await read()).ready, true);
    assert.equal(checks, 1, 'filesystem diagnostics are cached independently of live leases');
    await postPreview({ ...heartbeat, mappedTargetCount: 0 });
    assert.equal((await read()).capabilities.stage, false);
    await postPreview(heartbeat);
    await new Promise((resolve) => setTimeout(resolve, 5100));
    const expired = await read();
    assert.equal(expired.capabilities.inspect, false, 'a stale preview cannot stay live');
    assert.equal(expired.ready, false);
    await postPreview(heartbeat);
    assert.equal(
      (await read()).ready,
      true,
      'reconnecting restores readiness without losing drafts',
    );
    await postPreview({ ...heartbeat, connected: false });
    assert.equal((await read()).capabilities.inspect, false);
    assert.deepEqual((await store.read(id)).changeSet, before);
  } finally {
    await runtime.stop();
  }
});

test('a live isolated studio cannot impersonate the Canvas and stale source requires renewed review', async () => {
  const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-stale-readiness-')));
  const session = await store.create({
    projectRoot: '/project',
    revision: 'old',
    platform: 'web',
    targetUrl: 'http://127.0.0.1:4390',
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const capability = 'readiness-private-capability-test-654321';
  await store.setPreviewCapability(session.changeSet.sessionId, capability);
  const port = 47_000 + Math.floor(Math.random() * 400);
  const runtime = new FoundryRuntime({
    port,
    store,
    resolveProjectReadiness: async () => ({
      checks: [{ id: 'config', label: 'Configuration', status: 'passed', detail: '' }],
      revision: 'new',
    }),
  });
  await runtime.start();
  const base = `http://127.0.0.1:${port}/v1/sessions/${session.changeSet.sessionId}`;
  const headers = {
    'x-foundry-token': session.token,
    'content-type': 'application/json',
    origin: 'http://127.0.0.1:4390',
  };
  try {
    await fetch(`${base}/preview-presence`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        version: 1,
        previewCapability: capability,
        frameId: 'workbench',
        frameKind: 'workbench',
        protocolVersion: PROTOCOL_VERSION,
        adapterVersion: packageJson.version,
        targetCount: 10,
        mappedTargetCount: 5,
      }),
    });
    const report = (await (
      await fetch(`${base}/readiness`, { headers })
    ).json()) as ReadinessReport;
    assert.equal(report.capabilities.inspect, false);
    assert.equal(report.checks.find((check) => check.id === 'session-current')?.status, 'failed');
    assert.equal(
      report.checks.find((check) => check.id === 'session-current')?.recovery?.id,
      'resume',
    );
  } finally {
    await runtime.stop();
  }
});
