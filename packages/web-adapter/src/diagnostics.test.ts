import assert from 'node:assert/strict';
import test from 'node:test';
import { createSafeDiagnostics } from './diagnostics.js';

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
