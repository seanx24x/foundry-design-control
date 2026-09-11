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
  const applyResult = source.slice(source.indexOf("'foundry_design_record_apply_result'"));
  assert.match(applyResult, /runId: z\.string\(\)\.min\(1\)\.optional\(\)/);
  assert.match(applyResult, /claimAttemptId: z\.string\(\)\.min\(1\)\.optional\(\)/);
  assert.match(applyResult, /runId and claimAttemptId must be provided together/);
  assert.match(applyResult, /apply-runs\/\$\{runId\}\/apply-result/);
  assert.match(applyResult, /apply-runs\/apply-result/);
  assert.match(applyResult, /\{ claimAttemptId, claimCapability, changeIds \}/);
  assert.match(applyResult, /claimLeases\.capability\(runId, claimAttemptId\)/);
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
  assert.match(source, /claimLeases\.capability\(requestId, input\.claimAttemptId\)/);
  assert.match(source, /const \{ claimCapability: _secret, \.\.\.publicClaim \} = claimed/);
  assert.match(source, /No private capability is held for this visual request claim/);
});

test('the MCP verification workflow accepts an exact preview context', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const verification = source.slice(source.indexOf("'foundry_design_record_verification'"));
  assert.match(source, /const verificationContextSchema = z\.object/);
  assert.match(verification, /runId: z\.string\(\)\.min\(1\)/);
  assert.match(verification, /claimAttemptId: z\.string\(\)\.min\(1\)/);
  assert.match(verification, /context: verificationContextSchema\.optional\(\)/);
  assert.match(verification, /claimLeases\.capability\(runId, claimAttemptId\)/);
  assert.match(verification, /source: 'native-agent'/);
  assert.match(verification, /claimCapability,/);
  assert.match(verification, /The private Apply claim capability is unavailable/);
});
