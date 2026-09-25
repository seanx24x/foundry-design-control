import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import {
  engineeringVerification,
  matchingDeliveryCaptures,
} from '../packages/protocol/dist/engineering-verification.js';

const contextKey = (targetId, context) =>
  JSON.stringify([targetId, context.breakpoint, context.theme, context.state]);

// Both real harnesses use the same truth predicate as Delivery and engineering
// export. A terminal status alone must never stand in for frozen-context proof.
export async function assertEngineeringDelivery({ project, runtimeUrl, session, stored, runId }) {
  const run = stored.applyRuns.find((candidate) => candidate.id === runId);
  const record = stored.deliveryRecords.find((candidate) => candidate.applyRunId === runId);
  assert.equal(run?.state, 'passed');
  assert.equal(record?.status, 'verified');
  assert.ok(run.reviewedChangeSet?.changes.length, 'A frozen reviewed contract is required.');
  assert.equal(record.baselineRevision, run.revision);
  assert.equal(record.appliedRevision, run.appliedRevision);
  assert.notEqual(record.baselineRevision, record.appliedRevision);
  const expectedCaptures = new Set();
  let reviewedContexts = 0;
  for (const change of run.reviewedChangeSet.changes) {
    assert.ok(run.changeIds.includes(change.id));
    const contexts = change.contextSet ?? {
      breakpoints: [change.context.breakpoint],
      themes: [change.context.theme],
      states: [change.context.state],
    };
    for (const breakpoint of contexts.breakpoints)
      for (const theme of contexts.themes)
        for (const state of contexts.states) {
          const context = { breakpoint, theme, state };
          const verification = engineeringVerification(record, run, change, context);
          assert.equal(
            verification.status,
            'passed',
            `${change.id} ${JSON.stringify(context)}: ${verification.reason ?? 'engineering verification did not pass'}`,
          );
          assert.equal(verification.result.applyRunId, run.id);
          assert.equal(verification.result.claimAttemptId, run.applyResultClaimAttemptId);
          reviewedContexts += 1;
          expectedCaptures.add(contextKey(change.target.id, context));
        }
  }

  const pairs = matchingDeliveryCaptures(record);
  const capturedContexts = pairs.map(({ after }) =>
    contextKey(after.capture.targetId, after.capture.context),
  );
  assert.deepEqual(
    [...new Set(capturedContexts)].sort(),
    [...expectedCaptures].sort(),
    `Every reviewed target/context needs before and rebuilt source images. Capture issues: ${JSON.stringify(record.captureIssues ?? [])}`,
  );
  assert.equal(pairs.length, expectedCaptures.size, 'Do not accept duplicate capture pairs.');
  for (const { before, after } of pairs) {
    assert.equal(before.capture.phase, 'before');
    assert.equal(after.capture.phase, 'rebuilt');
    assert.equal(before.capture.sourceRevision, run.revision);
    assert.equal(after.capture.sourceRevision, run.appliedRevision);
    assert.equal(after.capture.applyRunId, run.id);
    // A transparent hit-area change can leave the screenshot pixels identical.
    // The source revisions, measured geometry and authenticated image hashes
    // prove the two captures; a pixel delta is not required or fabricated.
    for (const evidence of [before, after]) {
      assert.equal(isAbsolute(evidence.path), false);
      assert.equal(evidence.path.split(/[\\/]/).includes('..'), false);
      const bytes = readFileSync(join(project, evidence.path));
      assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), evidence.capture.sha256);
      const { viewport, conditions } = evidence.capture;
      assert.equal(bytes.readUInt32BE(16), viewport.width * conditions.deviceScaleFactor);
      assert.equal(bytes.readUInt32BE(20), viewport.height * conditions.deviceScaleFactor);
      const index = record.evidence.indexOf(evidence);
      const url = `${runtimeUrl}/v1/sessions/${session.sessionId}/delivery-records/${record.id}/evidence/${index}`;
      const denied = await fetch(url);
      assert.equal(denied.status, 401, 'Evidence must never be served without the session token.');
      const response = await fetch(url, { headers: { 'x-foundry-token': session.token } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    }
  }
  return {
    status: 'passed',
    reviewedContexts,
    sourceImagePairs: pairs.length,
    authenticatedImages: pairs.length * 2,
    baselineRevision: run.revision,
    appliedRevision: run.appliedRevision,
  };
}
