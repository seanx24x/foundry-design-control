import assert from 'node:assert/strict';
import test from 'node:test';
import { ClaimLeaseKeeper, type ClaimLeaseRequestClient } from './claim-lease.js';

const claim = {
  sessionId: 'session',
  token: 'token',
  runId: 'run',
  claimAttemptId: 'claim',
};

test('renews a claimed run and stops when source work begins', async () => {
  const requests: string[] = [];
  let state = 'claimed';
  const client: ClaimLeaseRequestClient = {
    async request(path) {
      requests.push(path);
      return {
        applyRuns: [{ id: claim.runId, state, claimAttemptId: claim.claimAttemptId }],
      };
    },
  };
  const keeper = new ClaimLeaseKeeper(client, 60_000);
  keeper.start(claim);

  await keeper.pulse(claim.runId);
  assert.equal(keeper.has(claim.runId), true);
  assert.deepEqual(requests, ['/v1/sessions/session/apply-runs/run/heartbeat']);

  state = 'applying';
  await keeper.pulse(claim.runId);
  assert.equal(keeper.has(claim.runId), false);
});

test('tolerates a transient heartbeat failure and stops after the retry budget', async () => {
  let shouldFail = true;
  const client: ClaimLeaseRequestClient = {
    async request() {
      if (shouldFail) throw new Error('Runtime temporarily unavailable');
      return {
        applyRuns: [{ id: claim.runId, state: 'claimed', claimAttemptId: claim.claimAttemptId }],
      };
    },
  };
  const keeper = new ClaimLeaseKeeper(client, 60_000, 3);
  keeper.start(claim);

  await keeper.pulse(claim.runId);
  assert.equal(keeper.has(claim.runId), true);

  shouldFail = false;
  await keeper.pulse(claim.runId);
  assert.equal(keeper.has(claim.runId), true);

  shouldFail = true;
  await keeper.pulse(claim.runId);
  await keeper.pulse(claim.runId);
  assert.equal(keeper.has(claim.runId), true);

  await keeper.pulse(claim.runId);
  assert.equal(keeper.has(claim.runId), false);
});
