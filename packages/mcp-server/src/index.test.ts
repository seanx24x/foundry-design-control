import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('the MCP apply workflow carries a leased claim through every progress update', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /foundry_design_heartbeat_apply_run/);
  assert.match(source, /claimAttemptId: z\.string\(\)\.min\(1\)/);
  assert.match(source, /claimedRun\?\.claimAttemptId/);
  assert.match(source, /apply-runs\/\$\{runId\}\/heartbeat/);
  assert.match(source, /new ClaimLeaseKeeper\(client\)/);
  assert.match(source, /claimLeases\.start/);
  assert.match(source, /claimLeases\.stop\(runId\)/);
});
