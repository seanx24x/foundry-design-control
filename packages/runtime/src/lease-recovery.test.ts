import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { FoundryRuntime } from './server.js';
import { acquireSessionFileLock } from './session-file-lock.js';
import { SessionStore, type StoredSession } from './store.js';

const START = Date.parse('2030-01-01T00:00:00.000Z');
const LEASE_MS = 45_000;
const BASELINE_HASH = 'a'.repeat(64);
const APPLIED_HASH = 'b'.repeat(64);

function sourceProof(revision = 'rev-1', hash = BASELINE_HASH, paths = ['src/Button.tsx']) {
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

class InterceptReadStore extends SessionStore {
  afterRead?: () => Promise<void>;

  override async read(id: string): Promise<StoredSession> {
    const snapshot = await super.read(id);
    const hook = this.afterRead;
    this.afterRead = undefined;
    if (hook) await hook();
    return snapshot;
  }
}

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'foundry-auth-lease-recovery-'));
  let clock = START;
  let revision = 'rev-1';
  let hash = BASELINE_HASH;
  const now = () => new Date(clock);
  const store = new InterceptReadStore(root, { now, claimLeaseMs: LEASE_MS });
  const runtimes: FoundryRuntime[] = [];
  t.after(async () => {
    await Promise.all(runtimes.map((runtime) => runtime.stop()));
    await rm(root, { recursive: true, force: true });
  });
  const startRuntime = async (activeStore: SessionStore) => {
    const runtime = new FoundryRuntime({
      host: '127.0.0.1',
      port: 0,
      store: activeStore,
      // Synthetic proof only: these tests never inspect or edit a real project.
      resolveProjectRevision: async ({ sourcePaths }) => ({
        supported: true,
        ...sourceProof(revision, hash, sourcePaths),
      }),
    });
    await runtime.start();
    runtimes.push(runtime);
    const address = (runtime as unknown as { server: Server }).server.address();
    assert.ok(address && typeof address === 'object');
    return `http://127.0.0.1:${address.port}`;
  };
  const origin = await startRuntime(store);
  const session = await store.create({
    projectRoot: join(root, 'synthetic-project'),
    revision,
    platform: 'web',
    viewport: { width: 1440, height: 900 },
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const id = session.changeSet.sessionId;
  const path = join(root, `${id}.json`);
  const changed = await store.addChange(id, {
    target: {
      id: 'button',
      platform: 'web',
      semanticRole: 'button',
      label: 'Synthetic button',
      componentPath: [],
      geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
      locator: { selector: 'button' },
      source: { file: 'src/Button.tsx', line: 1 },
      confidence: 'measured',
      evidence: ['Synthetic fixture geometry'],
    },
    category: 'border',
    property: 'borderRadius',
    before: 2,
    after: 24,
    unit: 'px',
    scope: 'instance',
    context: { breakpoint: 'current', theme: 'current', state: 'current' },
    confidence: 'measured',
    evidence: ['Synthetic fixture value'],
    status: 'draft',
  });
  const changeId = changed.changeSet.changes[0]!.id;
  const queued = await store.createApplyRun(id, {
    reviews: [{ changeId, approved: true }],
  });
  const runId = queued.applyRuns[0]!.id;
  const request = async (
    suffix = '',
    options: {
      method?: string;
      body?: unknown;
      token?: string | null;
      origin?: string;
    } = {},
  ) => {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    const token = options.token === undefined ? session.token : options.token;
    if (token !== null) headers['x-foundry-token'] = token;
    return fetch(`${options.origin ?? origin}/v1/sessions/${id}${suffix}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  };
  const claimResponse = await request(`/apply-runs/${runId}/claim`, {
    method: 'POST',
    body: {
      agent: { name: 'test-original-listener', taskId: 'lease-fixture' },
    },
  });
  assert.equal(claimResponse.status, 200, await claimResponse.clone().text());
  const claimed = (await claimResponse.json()) as StoredSession & {
    claimCapability: string;
  };
  const authority = {
    claimAttemptId: claimed.applyRuns[0]!.claimAttemptId!,
    claimCapability: claimed.claimCapability,
  };
  assert.ok(authority.claimAttemptId && authority.claimCapability);
  return {
    root,
    store,
    now,
    id,
    path,
    token: session.token,
    runId,
    changeId,
    request,
    authority,
    claimed,
    startRuntime,
    setTime: (elapsedMs: number) => {
      clock = START + elapsedMs;
    },
    expire: () => {
      clock += LEASE_MS + 1;
    },
    setAppliedSource: () => {
      revision = 'rev-2';
      hash = APPLIED_HASH;
    },
  };
}

test('authenticated HTTP session GET recovers an expired claim and preserves its frozen review', async (t) => {
  const f = await fixture(t);
  const frozen = f.claimed.applyRuns[0]!.reviewedChangeSet;
  f.expire();
  const response = await f.request();
  assert.equal(response.status, 200);
  const recovered = (await response.json()) as StoredSession;
  const run = recovered.applyRuns[0]!;
  assert.equal(run.state, 'queued');
  assert.equal(run.requeueCount, 1);
  assert.equal(run.claimAttemptId, undefined);
  assert.equal(run.claimExpiresAt, undefined);
  assert.deepEqual(run.reviewedChangeSet, frozen);
  assert.deepEqual(run.verificationResults, []);
  assert.deepEqual(recovered.verifications, []);
  assert.deepEqual(recovered.designHistory, []);
  assert.equal(recovered.deliveryRecords.length, 1);
  assert.notEqual(recovered.deliveryRecords[0]?.status, 'implementing');
  const stale = await f.request(`/apply-runs/${f.runId}`, {
    method: 'PATCH',
    body: { state: 'applying', ...f.authority },
  });
  assert.equal(stale.status, 400);
  assert.equal((await f.store.read(f.id)).applyRuns[0]!.state, 'queued');
});

test('a replacement listener can discover expired work from the queued list alone', async (t) => {
  const f = await fixture(t);
  f.expire();
  const response = await f.request('/apply-runs?state=queued');
  assert.equal(response.status, 200);
  const { runs } = (await response.json()) as {
    runs: StoredSession['applyRuns'];
  };
  assert.deepEqual(
    runs.map((run) => run.id),
    [f.runId],
  );
  assert.equal(runs[0]!.requeueCount, 1);
  const next = await f.request(`/apply-runs/${f.runId}/claim`, {
    method: 'POST',
    body: { agent: { name: 'test-replacement-listener' } },
  });
  assert.equal(next.status, 200, await next.clone().text());
  const result = (await next.json()) as StoredSession;
  assert.equal(result.applyRuns[0]!.state, 'claimed');
  assert.notEqual(result.applyRuns[0]!.claimAttemptId, f.authority.claimAttemptId);
  assert.deepEqual(
    result.applyRuns[0]!.reviewedChangeSet,
    f.claimed.applyRuns[0]!.reviewedChangeSet,
  );
});

test('listener presence followed by queued polling discovers recovered work', async (t) => {
  const f = await fixture(t);
  f.expire();
  const presence = await f.request('/agent-presence', {
    method: 'POST',
    body: {
      agent: { name: 'test-replacement-listener' },
      listening: true,
      ttlMs: 15_000,
    },
  });
  assert.equal(presence.status, 200);
  assert.equal(((await presence.json()) as { connected: boolean }).connected, true);
  const response = await f.request('/apply-runs?state=queued');
  const result = (await response.json()) as {
    runs: StoredSession['applyRuns'];
  };
  assert.equal(result.runs[0]?.id, f.runId);
  assert.equal(result.runs[0]?.requeueCount, 1);
});

test('missing and invalid authentication cannot recover or rewrite an expired session', async (t) => {
  const f = await fixture(t);
  f.expire();
  const before = await readFile(f.path);
  for (const token of [null, 'incorrect-token']) {
    for (const suffix of ['', '/apply-runs?state=queued', '/agent-presence']) {
      const response = await f.request(suffix, { token });
      assert.ok(response.status >= 400);
      await response.arrayBuffer();
      assert.deepEqual(await readFile(f.path), before);
    }
  }
  assert.equal((await f.store.read(f.id)).applyRuns[0]!.state, 'claimed');
  const response = await f.request();
  assert.equal(((await response.json()) as StoredSession).applyRuns[0]!.state, 'queued');
});

test('concurrent authenticated readers across store instances recover exactly once', async (t) => {
  const f = await fixture(t);
  const second = new SessionStore(f.root, {
    now: f.now,
    claimLeaseMs: LEASE_MS,
  });
  const secondOrigin = await f.startRuntime(second);
  f.expire();
  const states = await Promise.all(
    Array.from({ length: 12 }, async (_, index) => {
      const response = await f.request('', index % 2 ? { origin: secondOrigin } : {});
      assert.equal(response.status, 200);
      return ((await response.json()) as StoredSession).applyRuns[0]!.state;
    }),
  );
  assert.deepEqual(new Set(states), new Set(['queued']));
  const recovered = (await second.read(f.id)).applyRuns[0]!;
  assert.equal(recovered.requeueCount, 1);
  assert.equal(recovered.messages.length, f.claimed.applyRuns[0]!.messages.length + 1);
});

test('unexpired authenticated reads neither acquire the mutation lock nor rewrite the file', async (t) => {
  const f = await fixture(t);
  const before = await readFile(f.path);
  const beforeStat = await stat(f.path);
  const lock = await acquireSessionFileLock(f.path);
  const abort = new AbortController();
  try {
    const session = await Promise.race([
      f.store.authenticate(f.id, f.token),
      delay(1_000, undefined, { signal: abort.signal }).then(() => {
        throw new Error('An ordinary unexpired read waited for a mutation lock');
      }),
    ]);
    assert.equal(session.applyRuns[0]!.state, 'claimed');
    assert.deepEqual(await readFile(f.path), before);
    assert.equal((await stat(f.path)).mtimeMs, beforeStat.mtimeMs);
  } finally {
    abort.abort();
    await lock.release();
  }
});

test('a heartbeat before expiry keeps the claim active during later authenticated reads', async (t) => {
  const f = await fixture(t);
  f.setTime(44_000);
  const heartbeat = await f.request(`/apply-runs/${f.runId}/heartbeat`, {
    method: 'POST',
    body: f.authority,
  });
  assert.equal(heartbeat.status, 200);
  await heartbeat.arrayBuffer();
  f.setTime(46_000);
  const response = await f.request();
  const run = ((await response.json()) as StoredSession).applyRuns[0]!;
  assert.equal(run.state, 'claimed');
  assert.equal(run.claimAttemptId, f.authority.claimAttemptId);
  assert.equal(run.claimExpiresAt, new Date(START + 89_000).toISOString());
  assert.equal(run.requeueCount ?? 0, 0);
});

test('the locked reread preserves a heartbeat that superseded an expired initial snapshot', async (t) => {
  const f = await fixture(t);
  const second = new SessionStore(f.root, {
    now: f.now,
    claimLeaseMs: LEASE_MS,
  });
  let heartbeatBytes: Buffer | undefined;
  f.setTime(44_000);
  f.store.afterRead = async () => {
    // Clock only moves forward. Authentication holds an old snapshot while a
    // second store renews the lease before its deadline; recovery must reread.
    f.setTime(44_500);
    await second.heartbeatApplyRun(
      f.id,
      f.runId,
      f.authority.claimAttemptId,
      f.authority.claimCapability,
    );
    heartbeatBytes = await readFile(f.path);
    f.setTime(46_000);
  };
  const recovered = await f.store.authenticate(f.id, f.token);
  assert.equal(recovered.applyRuns[0]!.state, 'claimed');
  assert.equal(recovered.applyRuns[0]!.claimAttemptId, f.authority.claimAttemptId);
  assert.equal(recovered.applyRuns[0]!.claimExpiresAt, new Date(START + 89_500).toISOString());
  assert.equal(recovered.applyRuns[0]!.requeueCount ?? 0, 0);
  assert.deepEqual(await readFile(f.path), heartbeatBytes);
});

for (const state of ['applying', 'rebuilding', 'verifying'] as const) {
  test(`expired ${state} work requires explicit Resume, never automatic queueing or verification`, async (t) => {
    const f = await fixture(t);
    await f.store.updateApplyRun(f.id, f.runId, {
      state: 'applying',
      ...f.authority,
    });
    if (state !== 'applying') {
      f.setAppliedSource();
      await f.store.updateApplyRun(
        f.id,
        f.runId,
        {
          state: 'rebuilding',
          ...f.authority,
          changedFiles: ['src/Button.tsx'],
          validationResults: [{ name: 'Synthetic fixture check', passed: true }],
        },
        sourceProof('rev-2', APPLIED_HASH),
      );
    }
    if (state === 'verifying') {
      await f.store.recordApplyResult(
        f.id,
        f.runId,
        f.authority.claimAttemptId,
        [f.changeId],
        sourceProof('rev-2', APPLIED_HASH),
        f.authority.claimCapability,
      );
      await f.store.updateApplyRun(f.id, f.runId, {
        state: 'verifying',
        ...f.authority,
      });
    }
    const prior = await f.store.read(f.id);
    const record = prior.deliveryRecords[0]!;
    await f.store.updateDeliveryRecord(f.id, record.id, {
      intent: 'Preserve this reviewed intention after listener interruption.',
      narrativeSource: 'authored',
      risks: ['Synthetic risk retained for regression coverage.'],
      questions: ['Synthetic question retained for regression coverage.'],
    });
    f.expire();
    const response = await f.request('/apply-runs?state=queued');
    assert.deepEqual(((await response.json()) as { runs: unknown[] }).runs, []);
    const recovered = await f.store.read(f.id);
    const run = recovered.applyRuns[0]!;
    assert.equal(run.state, 'needs_attention');
    assert.equal(run.interruptedState, state);
    assert.equal(run.claimAttemptId, undefined);
    assert.deepEqual(run.reviewedChangeSet, prior.applyRuns[0]!.reviewedChangeSet);
    assert.deepEqual(run.verificationResults, []);
    assert.deepEqual(recovered.verifications, []);
    assert.deepEqual(recovered.designHistory, []);
    assert.notEqual(recovered.deliveryRecords[0]?.status, 'implementing');
    assert.notEqual(recovered.deliveryRecords[0]?.status, 'verified');
    assert.equal(recovered.deliveryRecords[0]?.narrativeSource, 'authored');
    assert.equal(
      recovered.deliveryRecords[0]?.intent,
      'Preserve this reviewed intention after listener interruption.',
    );
    assert.deepEqual(recovered.deliveryRecords[0]?.risks, [
      'Synthetic risk retained for regression coverage.',
    ]);
    assert.deepEqual(recovered.deliveryRecords[0]?.questions, [
      'Synthetic question retained for regression coverage.',
    ]);
    const stale = await f.request(`/apply-runs/${f.runId}`, {
      method: 'PATCH',
      body: { message: 'Stale listener progress', ...f.authority },
    });
    assert.equal(stale.status, 400);
    await stale.arrayBuffer();
    const claim = await f.request(`/apply-runs/${f.runId}/claim`, {
      method: 'POST',
      body: { agent: { name: 'replacement' } },
    });
    assert.equal(claim.status, 409);
    await claim.arrayBuffer();
    const resume = await f.request(`/apply-runs/${f.runId}/resume`, {
      method: 'POST',
      body: {
        expectedRevision: state === 'applying' ? 'rev-1' : 'rev-2',
        expectedDesignGraphRevision: null,
      },
    });
    assert.equal(resume.status, 200, await resume.clone().text());
    const resumed = (await resume.json()) as StoredSession;
    assert.equal(resumed.applyRuns[0]!.state, 'queued');
    assert.deepEqual(
      resumed.applyRuns[0]!.reviewedChangeSet,
      prior.applyRuns[0]!.reviewedChangeSet,
    );
    assert.deepEqual(resumed.verifications, []);
  });
}

test('authenticated polling also exposes an expired Visual Agent claim as interrupted', async (t) => {
  const f = await fixture(t);
  const target = f.claimed.changeSet.changes[0]!.target;
  const created = await f.store.createVisualAgentRequest(f.id, {
    prompt: 'Inspect this synthetic button; do not edit source.',
    context: {
      targets: [
        {
          id: target.id,
          selector: target.locator.selector as string,
          label: target.label,
          kind: target.semanticRole,
          source: `${target.source!.file}:${target.source!.line}`,
          confidence: target.confidence,
          geometry: target.geometry,
          measurements: { borderRadius: '2px' },
        },
      ],
      comments: [],
      tokens: [],
      viewport: { width: 1440, height: 900 },
      breakpoint: 'current',
      theme: 'current',
      state: 'current',
    },
  });
  const requestId = created.visualAgentRequests[0]!.id;
  const visualClaim = await f.store.claimVisualAgentRequest(f.id, requestId, {
    agent: { name: 'original' },
  });
  f.expire();
  const beforeVisualExpiry = (await (await f.request()).json()) as StoredSession;
  assert.equal(beforeVisualExpiry.applyRuns[0]!.state, 'queued');
  assert.equal(beforeVisualExpiry.visualAgentRequests[0]!.status, 'thinking');
  // Visual requests have a different lease from Apply; expire their own deadline
  // after the Apply run has already recovered to test independent discovery.
  f.setTime(Date.parse(visualClaim.visualAgentRequests[0]!.claimExpiresAt!) - START + 1);
  const response = await f.request();
  const recovered = (await response.json()) as StoredSession;
  assert.equal(recovered.visualAgentRequests[0]!.status, 'needs_attention');
  assert.equal(recovered.visualAgentRequests[0]!.claimAttemptId, undefined);
  assert.deepEqual(recovered.visualAgentRequests[0]!.proposals, []);
  assert.deepEqual(recovered.verifications, []);
});
