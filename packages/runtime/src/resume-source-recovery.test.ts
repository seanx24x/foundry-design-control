import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { FoundryRuntime } from './server.js';
import { SessionStore, type ApplySourceProof, type StoredSession } from './store.js';

// These are synthetic source/preview proofs against a real temporary HTTP runtime.
// They are regression evidence, not rendered acceptance of any connected project.
const START = Date.parse('2030-01-01T00:00:00.000Z');
const LEASE_MS = 1_000;
const ORIGINAL_HASH = 'a'.repeat(64);
const APPLIED_HASH = 'b'.repeat(64);
const PARTIAL_HASH = 'c'.repeat(64);
const PATH = 'src/Button.tsx';
const PREVIEW = 'http://127.0.0.1:5999';
const PREVIEW_CAPABILITY = 'synthetic-resume-preview-capability-only';

function proof(revision = 'rev-1', hash = ORIGINAL_HASH): ApplySourceProof {
  return {
    scope: 'git',
    revision,
    headRevision: 'head-1',
    files: [
      {
        path: PATH,
        exists: true,
        sha256: hash,
        lineAnchors: [{ line: 1, sha256: hash }],
      },
    ],
    changedRanges:
      revision === 'rev-1'
        ? []
        : [{ path: PATH, oldStart: 1, oldLines: 1, newStart: 1, newLines: 1 }],
  };
}

type Authority = { claimAttemptId: string; claimCapability: string };
type ResumeContext = {
  runId: string;
  reviewedRevision: string;
  expectedRevision: string;
  expectedDesignGraphRevision: string | null;
  changedFiles: string[];
};

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'foundry-resume-source-'));
  let clock = START;
  let current = proof();
  const store = new SessionStore(root, {
    now: () => new Date(clock),
    claimLeaseMs: LEASE_MS,
  });
  const runtime = new FoundryRuntime({
    host: '127.0.0.1',
    port: 0,
    store,
    resolveProjectRevision: async () => ({
      supported: true,
      ...structuredClone(current),
    }),
  });
  t.after(async () => {
    await runtime.stop();
    await rm(root, { recursive: true, force: true });
  });
  await runtime.start();
  const address = (runtime as unknown as { server: Server }).server.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const session = await store.create({
    projectRoot: join(root, 'synthetic-project'),
    targetUrl: PREVIEW,
    revision: 'rev-1',
    platform: 'web',
    viewport: { width: 1440, height: 900 },
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const id = session.changeSet.sessionId;
  const storedPath = join(root, `${id}.json`);
  await store.setPreviewCapability(id, PREVIEW_CAPABILITY);
  const changed = await store.addChange(id, {
    target: {
      id: 'resume-button',
      platform: 'web',
      semanticRole: 'button',
      label: 'Synthetic recovery button',
      componentPath: [],
      geometry: { x: 20, y: 20, width: 180, height: 44, scale: 1 },
      locator: { selector: '#resume-button' },
      source: { file: PATH, line: 1 },
      confidence: 'measured',
      evidence: ['Synthetic fixture geometry'],
    },
    category: 'typography',
    property: 'fontSize',
    before: 12,
    after: 14,
    unit: 'px',
    scope: 'instance',
    context: { theme: 'current', breakpoint: 'current', state: 'current' },
    confidence: 'measured',
    evidence: ['Synthetic fixture measurement'],
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
      preview?: boolean;
    } = {},
  ) => {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    const token = options.token === undefined ? session.token : options.token;
    if (token !== null) headers['x-foundry-token'] = token;
    if (options.preview) headers.origin = PREVIEW;
    return fetch(`${origin}/v1/sessions/${id}${suffix}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  };
  const read = () => store.read(id);
  const claim = async (): Promise<Authority> => {
    const response = await request(`/apply-runs/${runId}/claim`, {
      method: 'POST',
      body: { agent: { name: 'synthetic-recovery-listener' } },
    });
    assert.equal(response.status, 200, await response.clone().text());
    const payload = (await response.json()) as StoredSession & {
      claimCapability: string;
    };
    assert.equal(payload.applyRuns[0]!.state, 'claimed');
    return {
      claimAttemptId: payload.applyRuns[0]!.claimAttemptId!,
      claimCapability: payload.claimCapability,
    };
  };
  const update = (authority: Authority, body: Record<string, unknown>) =>
    request(`/apply-runs/${runId}`, {
      method: 'PATCH',
      body: { ...body, ...authority },
    });
  const mustUpdate = async (authority: Authority, body: Record<string, unknown>) => {
    const response = await update(authority, body);
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()) as StoredSession;
  };
  const acknowledge = (authority: Authority) =>
    request(`/apply-runs/${runId}/apply-result`, {
      method: 'POST',
      body: { ...authority, changeIds: [changeId] },
    });
  const expire = async () => {
    clock += LEASE_MS + 1;
    const response = await request();
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()) as StoredSession;
  };
  const prepare = async () => {
    const response = await request(`/apply-runs/${runId}/resume-context`);
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()) as ResumeContext;
  };
  const resume = (context: ResumeContext) =>
    request(`/apply-runs/${runId}/resume`, {
      method: 'POST',
      body: {
        expectedRevision: context.expectedRevision,
        expectedDesignGraphRevision: context.expectedDesignGraphRevision,
      },
    });
  const authorize = async () => {
    const context = await prepare();
    const response = await resume(context);
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()) as StoredSession;
  };
  const mutateStored = async (mutate: (stored: StoredSession) => void) => {
    const stored = JSON.parse(await readFile(storedPath, 'utf8')) as StoredSession;
    mutate(stored);
    await writeFile(storedPath, `${JSON.stringify(stored, null, 2)}\n`);
  };
  const authority = await claim();
  const original = structuredClone((await read()).applyRuns[0]!);
  await mustUpdate(authority, { state: 'applying' });
  return {
    runId,
    changeId,
    authority,
    original,
    request,
    read,
    claim,
    update,
    mustUpdate,
    acknowledge,
    expire,
    prepare,
    resume,
    authorize,
    mutateStored,
    setSource: (next: ApplySourceProof) => {
      current = next;
    },
    now: () => new Date(clock).toISOString(),
  };
}

async function denied(response: Response, expected: RegExp) {
  assert.ok(response.status >= 400, `Expected rejection; got ${response.status}`);
  assert.match(await response.text(), expected);
}

for (const stage of ['applying', 'rebuilding', 'verifying'] as const) {
  test(`resumes complete source edits interrupted while ${stage} without inventing a second edit`, async (t) => {
    const f = await fixture(t);
    f.setSource(proof('rev-2', APPLIED_HASH));
    if (stage !== 'applying') {
      await f.mustUpdate(f.authority, {
        state: 'rebuilding',
        changedFiles: [PATH],
        validationResults: [{ name: 'Before-interruption synthetic check', passed: true }],
      });
    }
    if (stage === 'verifying') {
      const ack = await f.acknowledge(f.authority);
      assert.equal(ack.status, 200, await ack.clone().text());
      await f.mustUpdate(f.authority, { state: 'verifying' });
    }
    const paused = await f.expire();
    const run = paused.applyRuns[0]!;
    assert.equal(run.state, 'needs_attention');
    assert.equal(run.interruptedState, stage);
    assert.equal(run.revision, 'rev-1');
    assert.deepEqual(run.baselineSourceFiles, f.original.baselineSourceFiles);
    assert.equal(run.sourceHeadRevision, 'head-1');
    assert.equal(run.claimAttemptId, undefined);
    assert.equal(run.claimCapabilityHash, undefined);
    assert.equal(run.applyResultAcknowledgedAt, undefined);
    assert.deepEqual(run.validationResults, []);
    assert.deepEqual(run.verificationResults, []);

    const context = await f.prepare();
    assert.deepEqual(context, {
      runId: f.runId,
      reviewedRevision: 'rev-1',
      expectedRevision: 'rev-2',
      expectedDesignGraphRevision: null,
      changedFiles: [PATH],
    });
    assert.equal(
      (await f.read()).applyRuns[0]!.state,
      'needs_attention',
      'prepare is not authorization',
    );
    const resumed = await f.resume(context);
    assert.equal(resumed.status, 200, await resumed.clone().text());
    const next = await f.claim();
    assert.notEqual(next.claimAttemptId, f.authority.claimAttemptId);
    const reclaimed = (await f.read()).applyRuns[0]!;
    assert.equal(reclaimed.revision, 'rev-1');
    assert.deepEqual(reclaimed.baselineSourceFiles, f.original.baselineSourceFiles);
    assert.deepEqual(reclaimed.reviewedChangeSet, f.original.reviewedChangeSet);
    await denied(await f.update(f.authority, { state: 'applying' }), /claim|capability/i);
    await f.mustUpdate(next, { state: 'applying' });
    await denied(await f.acknowledge(next), /rebuilding/i);
    await f.mustUpdate(next, { state: 'rebuilding', changedFiles: [PATH] });
    await denied(await f.acknowledge(next), /passing validation/i);
    await f.mustUpdate(next, {
      validationResults: [{ name: 'Fresh synthetic rebuilt check', passed: true }],
    });
    const result = await f.acknowledge(next);
    assert.equal(result.status, 200, await result.clone().text());
    const acknowledged = (await f.read()).applyRuns[0]!;
    assert.equal(acknowledged.appliedRevision, 'rev-2');
    assert.equal(acknowledged.validationResults[0]!.claimAttemptId, next.claimAttemptId);
    assert.equal(acknowledged.validationResults[0]!.validatedRevision, 'rev-2');
    await denied(await f.acknowledge(next), /already acknowledged/i);
    await f.mustUpdate(next, { state: 'verifying' });

    const challengeResponse = await f.request(`/apply-runs/${f.runId}/verification-challenge`, {
      method: 'POST',
      preview: true,
      body: {
        claimAttemptId: next.claimAttemptId,
        previewCapability: PREVIEW_CAPABILITY,
      },
    });
    assert.equal(challengeResponse.status, 201, await challengeResponse.clone().text());
    const { challenge } = (await challengeResponse.json()) as {
      challenge: string;
    };
    const verified = await f.request('/verify', {
      method: 'POST',
      preview: true,
      body: {
        runId: f.runId,
        claimAttemptId: next.claimAttemptId,
        source: 'browser-preview',
        challenge,
        results: [
          {
            applyRunId: f.runId,
            claimAttemptId: next.claimAttemptId,
            changeId: f.changeId,
            property: 'fontSize',
            requested: 14,
            rendered: '14px',
            passed: true,
            geometry: { x: 20, y: 20, width: 180, height: 44, scale: 1 },
            evidence: ['Synthetic HTTP regression proof, not browser acceptance'],
            verifiedAt: f.now(),
          },
        ],
      },
    });
    assert.equal(verified.status, 200, await verified.clone().text());
    const completed = await f.read();
    assert.equal(completed.applyRuns.length, 1);
    assert.equal(completed.applyRuns[0]!.state, 'passed');
    assert.equal(completed.deliveryRecords[0]!.status, 'verified');
    assert.equal(completed.deliveryRecords[0]!.baselineRevision, 'rev-1');
    assert.equal(completed.deliveryRecords[0]!.appliedRevision, 'rev-2');
  });
}

test('partially edited source resumes against its original baseline and proves the completed delta', async (t) => {
  const f = await fixture(t);
  f.setSource(proof('rev-partial', PARTIAL_HASH));
  await f.expire();
  await f.authorize();
  const next = await f.claim();
  await f.mustUpdate(next, { state: 'applying' });
  f.setSource(proof('rev-completed', APPLIED_HASH));
  await f.mustUpdate(next, {
    state: 'rebuilding',
    changedFiles: [PATH],
    validationResults: [{ name: 'Completed synthetic source check', passed: true }],
  });
  const response = await f.acknowledge(next);
  assert.equal(response.status, 200, await response.clone().text());
  const run = (await f.read()).applyRuns[0]!;
  assert.equal(run.revision, 'rev-1');
  assert.equal(run.appliedRevision, 'rev-completed');
  assert.deepEqual(run.baselineSourceFiles, f.original.baselineSourceFiles);
});

test('context reads require authentication and never queue the paused run', async (t) => {
  const f = await fixture(t);
  f.setSource(proof('rev-2', APPLIED_HASH));
  await f.expire();
  for (const token of [null, 'invalid-token']) {
    const response = await f.request(`/apply-runs/${f.runId}/resume-context`, {
      token,
    });
    assert.equal(response.status, 401);
    await response.arrayBuffer();
  }
  await f.prepare();
  const run = (await f.read()).applyRuns[0]!;
  assert.equal(run.state, 'needs_attention');
  assert.equal(run.claimAttemptId, undefined);
});

test('source drift after displayed recovery context rejects confirmation without queuing', async (t) => {
  const f = await fixture(t);
  f.setSource(proof('rev-2', APPLIED_HASH));
  await f.expire();
  const context = await f.prepare();
  f.setSource(proof('rev-drift', PARTIAL_HASH));
  await denied(await f.resume(context), /Resume revision conflict/i);
  assert.equal((await f.read()).applyRuns[0]!.state, 'needs_attention');
});

test('source drift after resume authorization prevents a replacement claim', async (t) => {
  const f = await fixture(t);
  f.setSource(proof('rev-2', APPLIED_HASH));
  await f.expire();
  await f.authorize();
  f.setSource(proof('rev-drift', PARTIAL_HASH));
  const response = await f.request(`/apply-runs/${f.runId}/claim`, {
    method: 'POST',
    body: { agent: { name: 'replacement-after-drift' } },
  });
  await response.arrayBuffer();
  const run = (await f.read()).applyRuns[0]!;
  assert.equal(run.state, 'needs_attention');
  assert.equal(run.claimAttemptId, undefined);
  assert.match(run.error ?? '', /revision changed/i);
  assert.deepEqual(run.baselineSourceFiles, f.original.baselineSourceFiles);
});

for (const drift of ['head', 'scope', 'graph', 'unrelated-file'] as const) {
  test(`recovery rejects ${drift} drift at preparation and confirmation`, async (t) => {
    const f = await fixture(t);
    f.setSource(proof('rev-2', APPLIED_HASH));
    await f.expire();
    const before = await f.prepare();
    const altered = proof('rev-2', APPLIED_HASH);
    let reason: RegExp;
    if (drift === 'head') {
      altered.headRevision = 'different-head';
      reason = /HEAD|head/i;
    } else if (drift === 'scope') {
      altered.scope = 'mapped-files';
      reason = /scope/i;
    } else if (drift === 'graph') {
      await f.mutateStored((stored) => {
        stored.changeSet.designGraphRevision = 'changed-graph';
      });
      reason = /graph/i;
    } else {
      altered.files.push({
        path: 'src/Unreviewed.tsx',
        exists: true,
        sha256: PARTIAL_HASH,
      });
      reason = /outside|unreviewed|unrelated/i;
    }
    f.setSource(altered);
    await denied(await f.request(`/apply-runs/${f.runId}/resume-context`), reason);
    await denied(await f.resume(before), reason);
    assert.equal((await f.read()).applyRuns[0]!.state, 'needs_attention');
  });
}

test('a second disconnect before replacement source work still pauses and preserves the original baseline', async (t) => {
  const f = await fixture(t);
  f.setSource(proof('rev-2', APPLIED_HASH));
  await f.expire();
  await f.authorize();
  const replacement = await f.claim();
  const paused = await f.expire();
  const run = paused.applyRuns[0]!;
  assert.equal(run.state, 'needs_attention');
  assert.equal(run.interruptedState, 'applying');
  assert.equal(run.requeueCount, 2);
  assert.equal(run.claimAttemptId, undefined);
  assert.deepEqual(run.baselineSourceFiles, f.original.baselineSourceFiles);
  await denied(await f.update(replacement, { state: 'applying' }), /claim|transition|completed/i);
  const rejected = await f.request(`/apply-runs/${f.runId}/claim`, {
    method: 'POST',
    body: { agent: { name: 'must-not-auto-reclaim' } },
  });
  assert.equal(rejected.status, 409);
  await rejected.arrayBuffer();
  await f.authorize();
  const third = await f.claim();
  assert.notEqual(third.claimAttemptId, replacement.claimAttemptId);
  assert.deepEqual(
    (await f.read()).applyRuns[0]!.baselineSourceFiles,
    f.original.baselineSourceFiles,
  );
});

test('legacy interrupted runs without an original source baseline fail closed', async (t) => {
  const f = await fixture(t);
  f.setSource(proof('rev-2', APPLIED_HASH));
  await f.expire();
  const context = await f.prepare();
  await f.mutateStored((stored) => {
    stored.applyRuns[0]!.baselineSourceFiles = [];
  });
  await denied(await f.request(`/apply-runs/${f.runId}/resume-context`), /baseline/i);
  await denied(await f.resume(context), /baseline/i);
  const run = (await f.read()).applyRuns[0]!;
  assert.equal(run.state, 'needs_attention');
  assert.deepEqual(run.baselineSourceFiles, []);
  assert.equal(run.claimAttemptId, undefined);
});

test('a resumed ordinary build failure is a Retry case, not another source interruption', async (t) => {
  const f = await fixture(t);
  f.setSource(proof('rev-2', APPLIED_HASH));
  await f.expire();
  await f.authorize();
  const next = await f.claim();
  assert.equal((await f.read()).applyRuns[0]!.interruptedState, 'applying');
  await f.mustUpdate(next, { state: 'applying' });
  assert.equal((await f.read()).applyRuns[0]!.interruptedState, undefined);
  await f.mustUpdate(next, { state: 'failed', error: 'Synthetic rebuild failed' });
  const run = (await f.read()).applyRuns[0]!;
  assert.equal(run.state, 'failed');
  assert.equal(run.interruptedState, undefined);
  assert.deepEqual(run.baselineSourceFiles, f.original.baselineSourceFiles);
});

test('a resumed ordinary verification mismatch remains a Retry case rather than Resume', async (t) => {
  const f = await fixture(t);
  f.setSource(proof('rev-2', APPLIED_HASH));
  await f.expire();
  await f.authorize();
  const next = await f.claim();
  await f.mustUpdate(next, { state: 'applying' });
  await f.mustUpdate(next, {
    state: 'rebuilding',
    changedFiles: [PATH],
    validationResults: [{ name: 'Fresh synthetic source check', passed: true }],
  });
  const acknowledged = await f.acknowledge(next);
  assert.equal(acknowledged.status, 200, await acknowledged.clone().text());
  await f.mustUpdate(next, { state: 'verifying' });
  const challengeResponse = await f.request(`/apply-runs/${f.runId}/verification-challenge`, {
    method: 'POST',
    preview: true,
    body: { claimAttemptId: next.claimAttemptId, previewCapability: PREVIEW_CAPABILITY },
  });
  assert.equal(challengeResponse.status, 201, await challengeResponse.clone().text());
  const { challenge } = (await challengeResponse.json()) as { challenge: string };
  const mismatch = await f.request('/verify', {
    method: 'POST',
    preview: true,
    body: {
      runId: f.runId,
      claimAttemptId: next.claimAttemptId,
      source: 'browser-preview',
      challenge,
      results: [
        {
          applyRunId: f.runId,
          claimAttemptId: next.claimAttemptId,
          changeId: f.changeId,
          property: 'fontSize',
          requested: 14,
          rendered: '13px',
          passed: false,
          geometry: { x: 20, y: 20, width: 180, height: 44, scale: 1 },
          evidence: ['Synthetic mismatch regression, not browser acceptance'],
          verifiedAt: f.now(),
        },
      ],
    },
  });
  assert.equal(mismatch.status, 200, await mismatch.clone().text());
  const run = (await f.read()).applyRuns[0]!;
  assert.equal(run.state, 'needs_attention');
  assert.equal(run.interruptedState, undefined);
  assert.match(run.error ?? '', /do not match/i);
  await denied(await f.request(`/apply-runs/${f.runId}/resume-context`), /Only an interrupted/i);
});
