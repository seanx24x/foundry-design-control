import assert from 'node:assert/strict';
import test from 'node:test';
import { applyRunAction, applyRunMessage, isActiveApplyRun } from './apply-run.js';

const labels = { applying: 'Applying source changes' };

test('requires explicit resume for an interrupted run without creating a retry', () => {
  assert.deepEqual(
    applyRunAction({ state: 'needs_attention', interruptedState: 'applying' }, false, labels),
    { action: 'resume', label: 'Resume with agent', disabled: false },
  );
});

test('keeps verification mismatch recovery distinct from interruption recovery', () => {
  assert.deepEqual(applyRunAction({ state: 'needs_attention' }, true, labels), {
    action: 'retry',
    label: 'Retry with agent',
    disabled: false,
  });
});

test('reports listener loss without presenting an active run as complete', () => {
  assert.equal(isActiveApplyRun({ state: 'claimed' }), true);
  assert.match(applyRunMessage({ state: 'claimed' }, false), /disconnected/);
  assert.deepEqual(applyRunAction({ state: 'claimed' }, false, labels), {
    action: 'reconnect',
    label: 'Reconnect agent',
    disabled: false,
  });
});
