import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { shouldDisplayApplyRun } from '../public/workflow.js';

const passed = { id: 'previous-run', state: 'passed' };
const pending = { id: 'new-edit', status: 'draft', before: 14, after: 16 };
const options = { mode: 'review', changes: [pending] };

test('new draft, approved, and unresolved edits take priority over a passed run', () => {
  for (const status of ['draft', 'approved', 'unresolved']) {
    assert.equal(
      shouldDisplayApplyRun(passed, {
        ...options,
        changes: [{ ...pending, status }],
      }),
      false,
    );
  }
});

test('active runs and failure recovery retain priority over pending edits', () => {
  for (const state of [
    'queued',
    'claimed',
    'applying',
    'rebuilding',
    'verifying',
    'failed',
    'needs_attention',
  ]) {
    assert.equal(shouldDisplayApplyRun({ ...passed, state }, options), true);
  }
});

test('completed evidence remains available when there are no pending edits', () => {
  assert.equal(shouldDisplayApplyRun(passed, { mode: 'review' }), true);
  assert.equal(
    shouldDisplayApplyRun(passed, {
      mode: 'review',
      changes: [{ status: 'applied' }, { status: 'rejected' }],
    }),
    true,
  );
});

test('missing, cancelled, dismissed runs and non-Review modes stay hidden', () => {
  assert.equal(shouldDisplayApplyRun(undefined, options), false);
  assert.equal(shouldDisplayApplyRun({ ...passed, state: 'cancelled' }, options), false);
  assert.equal(shouldDisplayApplyRun(passed, { mode: 'canvas' }), false);
  assert.equal(shouldDisplayApplyRun(passed, { mode: 'review', dismissedRunId: passed.id }), false);
});

test('renderApplyRun clears the old overlay and signature on every pending Review render', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = app.indexOf('function renderApplyRun(');
  const end = app.indexOf('\nfunction ', start + 1);
  const root = { hidden: false, dataset: { signature: 'previous-run' } };
  const session = { changeSet: { changes: [pending] } };
  const before = structuredClone(session);
  const render = runInNewContext(`${app.slice(start, end)}; renderApplyRun`, {
    $: () => root,
    activeMode: 'review',
    activeSession: session,
    dismissedApplyRunId: null,
    shouldDisplayApplyRun,
  });
  render([passed]);
  assert.equal(root.hidden, true);
  assert.equal(root.dataset.signature, '');
  render([passed]); // polling or reopening Review must not restore the old overlay
  assert.equal(root.hidden, true);
  assert.deepEqual(session, before);
});
