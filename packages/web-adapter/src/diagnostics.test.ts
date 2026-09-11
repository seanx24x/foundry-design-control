import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createSafeDiagnostics, DIAGNOSTICS_PROTOCOL_VERSION } from './diagnostics.js';

test('safe diagnostics contain only product state and counts', () => {
  const diagnostics = createSafeDiagnostics({
    interfaceTheme: 'dark',
    runtimeConnected: true,
    agentConnected: true,
    agentName: 'Codex',
    selectedCount: 2,
    recordedChangeCount: 3,
    latestApplyState: 'verifying',
  });

  assert.deepEqual(diagnostics.connection, {
    runtime: 'connected',
    agent: 'connected',
    agentName: 'Codex',
  });
  assert.equal(diagnostics.workspace.selectedElementCount, 2);
  assert.equal(diagnostics.workspace.recordedChangeCount, 3);
  assert.equal(DIAGNOSTICS_PROTOCOL_VERSION, '1.3.0');
  assert.equal(diagnostics.protocolVersion, DIAGNOSTICS_PROTOCOL_VERSION);
});

test('production diagnostics use the current protocol version explicitly', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /protocolVersion: DIAGNOSTICS_PROTOCOL_VERSION/);
});

test('safe diagnostics cannot carry project or session details', () => {
  const serialized = JSON.stringify(
    createSafeDiagnostics({
      interfaceTheme: 'light',
      runtimeConnected: false,
      agentConnected: false,
      selectedCount: 0,
      recordedChangeCount: 0,
    }),
  );

  for (const forbidden of [
    'projectRoot',
    'sessionId',
    'token',
    'targetUrl',
    'selector',
    'before',
    'after',
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
