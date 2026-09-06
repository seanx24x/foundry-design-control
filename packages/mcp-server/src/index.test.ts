import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('the MCP apply workflow carries a leased claim through every progress update', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const leaseSource = readFileSync(new URL('./claim-lease.ts', import.meta.url), 'utf8');
  assert.match(source, /foundry_design_heartbeat_apply_run/);
  assert.match(source, /claimAttemptId: z\.string\(\)\.min\(1\)/);
  assert.match(source, /claimedRun\?\.claimAttemptId/);
  assert.match(source, /apply-runs\/\$\{runId\}\/heartbeat/);
  assert.match(source, /new ClaimLeaseKeeper\(client\)/);
  assert.match(source, /claimLeases\.start/);
  assert.match(leaseSource, /\['claimed', 'applying', 'rebuilding', 'verifying'\]/);
  assert.match(source, /update\.state === 'failed'/);
  assert.match(source, /packageJson\.version/);
});

test('the MCP visual conversation workflow preserves context and isolated proposals', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /foundry_design_wait_for_visual_request/);
  assert.match(source, /foundry_design_get_visual_request/);
  assert.match(source, /foundry_design_respond_to_visual_request/);
  assert.match(source, /visual-agent-requests\?status=queued/);
  assert.match(source, /claimAttemptId: z\.string\(\)\.min\(1\)/);
  assert.match(source, /exactValues/);
  assert.match(source, /responsiveImpact/);
  assert.match(source, /verificationPlan/);
});
