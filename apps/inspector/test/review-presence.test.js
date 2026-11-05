import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function slice(start, end) {
  const first = source.indexOf(start),
    last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first);
  return source.slice(first, last);
}
function harness() {
  const field = { value: '56 draft', selectionStart: 2, selectionEnd: 4 };
  const button = { dataset: {}, textContent: 'Queue 1 for agent', disabled: false };
  const title = { textContent: 'Agent offline' },
    detail = { textContent: 'Offline detail' };
  const state = {
    dataset: { connected: 'false' },
    querySelector: (s) => (s === 'strong' ? title : detail),
  };
  let renders = 0;
  const context = {
    document: { activeElement: field },
    $: (s) => (s === '#apply-agent' ? button : s === '.review-agent-state' ? state : null),
    activeSession: null,
    activeAgentPresence: { connected: false },
    applyRunActionError: null,
    reviewStatusError: null,
    foundryPilotActive: () => true,
    reviewBatchSummary: (changes) => ({
      included: changes.filter((c) => c.status === 'approved').length,
    }),
    blocked: false,
    reviewStatusBlocked: () => context.blocked,
    nextVisualAgent: null,
    lastRenderedSessionSnapshot: 'older',
    pendingSessionRender: null,
    sessionRenderSnapshot: (payload, presence) => JSON.stringify({ payload, presence }),
    sessionRenderBlocked: () => true,
    renderSession: () => {
      renders++;
    },
  };
  runInNewContext(
    slice('function syncReviewAgentPresence(', 'function renderReview()') +
      slice('function commitLoadedSession(', 'function flushPendingSessionRender()'),
    context,
  );
  const payload = (status) => ({ changeSet: { changes: [{ id: 'one', status }], operations: [] } });
  return {
    context,
    button,
    field,
    state,
    title,
    detail,
    renders: () => renders,
    commit: (connected, status = 'approved') =>
      context.commitLoadedSession(
        payload(status),
        { connected, presence: connected ? { agent: { name: 'Real listener' } } : null },
        { deferRender: true },
      ),
  };
}
test('connected and disconnected agent chrome updates while full Review rendering stays deferred', () => {
  const h = harness();
  h.commit(true);
  assert.equal(h.button.textContent, 'Apply 1 with agent');
  assert.equal(h.button.disabled, false);
  assert.equal(h.state.dataset.connected, 'true');
  assert.equal(h.title.textContent, 'Agent listener connected');
  assert.match(h.detail.textContent, /Source edits begin only after/);
  assert.equal(h.renders(), 0);
  assert.equal(h.context.document.activeElement, h.field);
  assert.equal(h.field.value, '56 draft');
  assert.deepEqual([h.field.selectionStart, h.field.selectionEnd], [2, 4]);
  assert.ok(h.context.pendingSessionRender);
  h.commit(false);
  assert.equal(h.button.textContent, 'Queue 1 for agent');
  assert.equal(h.state.dataset.connected, 'false');
  assert.equal(h.title.textContent, 'Agent offline');
  assert.equal(h.renders(), 0);
});
test('presence-only refresh retains submission, inclusion and review-transaction safety gates', () => {
  const h = harness();
  h.button.dataset.submitting = 'true';
  h.button.textContent = 'Submitting…';
  h.commit(true);
  assert.equal(h.button.textContent, 'Submitting…');
  assert.equal(h.button.disabled, true);
  delete h.button.dataset.submitting;
  h.context.blocked = true;
  h.commit(true);
  assert.equal(h.button.disabled, true);
  h.context.blocked = false;
  h.commit(true, 'rejected');
  assert.equal(h.button.textContent, 'Review changes first');
  assert.equal(h.button.disabled, true);
  h.commit(true);
  assert.equal(h.button.disabled, false);
  assert.equal(h.renders(), 0);
});
