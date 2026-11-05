import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { previewRecoveryBlocked, previewReconnectBlocked } from '../public/preview-recovery.js';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const slice = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
function harness({ pilot = true, loaded = true } = {}) {
  const main = {},
    state = {},
    comparison = {},
    calls = [];
  const nodes = {
    '#preview-fallback': { hidden: true },
    '#preview-loading': { hidden: false },
    '#preview-fallback strong': { textContent: '' },
    '#preview-fallback p': { textContent: '' },
    '#reconnect-preview': { disabled: false, addEventListener() {} },
    '#state-live-preview': { contentWindow: state },
  };
  const session = { applyRuns: [], changeSet: { changes: [{ id: 'saved', after: 80 }] } };
  const context = {
    foundryPilotActive: () => pilot,
    previewRecoveryBlocked,
    previewReconnectBlocked,
    activeSession: session,
    previewUrl: 'http://localhost:1234/fixture',
    preview: { contentWindow: main, src: 'unchanged' },
    bridgeConnected: true,
    stateWorkbenchReloading: false,
    bridgeState: loaded ? { context: { theme: 'light' }, selection: { id: 'headline' } } : null,
    bridgeBranchSynced: true,
    previewRecoveryFailed: false,
    previewHeartbeatLost: false,
    frameLastSeen: new Map(),
    nextDesignBranches: null,
    designBranchFrames: new Map(),
    responsiveFrames: new Map([[comparison, 'phone']]),
    responsiveFrameStates: new Map(),
    $: (selector) => nodes[selector],
    rejectPendingFrameCommands: (source, reason) => calls.push(['reject', source, reason]),
    updateStateWorkbenchPresentation: () => calls.push(['state-update']),
    updateResponsiveCard: (id) => calls.push(['responsive-update', id]),
    failNextBranchPreview: (frame, reason) => calls.push(['branch-offline', frame, reason]),
    resetPreviewRecovery: () => calls.push(['reset']),
    toast: (message) => calls.push(['toast', message]),
    Date,
  };
  const source = [
    slice('function markFrameSeen(', 'async function pingPreviewFrame('),
    slice('function syncPilotHeartbeatRecovery()', 'async function restoreSavedCanvasPreview()'),
    slice('function showPreviewRecoveryFallback(', 'function resetPreviewRecovery()'),
    slice('function reconnectCanvasPreview()', 'function setupPreview()'),
    'function renderConnectionStatus(){syncPilotHeartbeatRecovery();}',
    'this.actions={seen:markFrameSeen,offline:markFrameOffline,sync:syncPilotHeartbeatRecovery,reconnect:reconnectCanvasPreview,click:handleCanvasPreviewReconnect};',
  ].join('\n');
  runInNewContext(source, context);
  return { context, actions: context.actions, nodes, main, state, comparison, calls, session };
}

test('pilot main-preview heartbeat loss reveals existing recovery without resetting saved state', () => {
  const h = harness(),
    saved = JSON.stringify(h.session),
    bridgeState = h.context.bridgeState;
  h.actions.offline(h.main, 'Ping timed out');
  assert.equal(h.context.bridgeConnected, false);
  assert.equal(h.nodes['#preview-fallback'].hidden, false);
  assert.equal(h.nodes['#preview-loading'].hidden, true);
  assert.equal(h.nodes['#reconnect-preview'].disabled, false);
  assert.equal(h.nodes['#preview-fallback strong'].textContent, 'Live preview disconnected');
  assert.match(h.nodes['#preview-fallback p'].textContent, /saved edits are safe in Review/);
  assert.equal(JSON.stringify(h.session), saved);
  assert.equal(h.context.bridgeState, bridgeState);
  assert.equal(h.context.bridgeBranchSynced, true);
  assert.equal(h.context.preview.src, 'unchanged');
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0], ['reject', h.main, 'Ping timed out']);
});

test('same-frame traffic clears only heartbeat-owned recovery without replay or reload', () => {
  const h = harness();
  h.actions.offline(h.main);
  h.actions.seen(h.main);
  assert.equal(h.context.bridgeConnected, true);
  assert.equal(h.context.previewHeartbeatLost, false);
  assert.equal(h.nodes['#preview-fallback'].hidden, true);
  assert.equal(h.nodes['#preview-loading'].hidden, true);
  assert.equal(h.context.preview.src, 'unchanged');
  assert.equal(h.calls.length, 1);
});

test('unrelated comparison and state frames neither reveal nor clear main recovery', () => {
  const h = harness();
  h.actions.offline(h.comparison);
  h.actions.offline(h.state);
  assert.equal(h.context.bridgeConnected, true);
  assert.equal(h.context.previewHeartbeatLost, false);
  assert.equal(h.nodes['#preview-fallback'].hidden, true);
  h.actions.offline(h.main);
  h.actions.seen(h.comparison);
  h.actions.seen(h.state);
  assert.equal(h.context.bridgeConnected, false);
  assert.equal(h.context.previewHeartbeatLost, true);
  assert.equal(h.nodes['#preview-fallback'].hidden, false);
});

test('old state-frame traffic cannot mark an authored-query reload connected', () => {
  const h = harness();
  h.context.stateWorkbenchConnected = false;
  h.context.stateWorkbenchReloading = true;
  h.actions.seen(h.state);
  assert.equal(h.context.stateWorkbenchConnected, false);
  assert.deepEqual(h.calls, []);
  h.context.stateWorkbenchReloading = false;
  h.actions.seen(h.state);
  assert.equal(h.context.stateWorkbenchConnected, true);
  assert.deepEqual(h.calls, [['state-update']]);
});

test('a restored transport does not dismiss a saved-preview restoration failure', () => {
  const h = harness();
  h.actions.offline(h.main);
  h.context.previewRecoveryFailed = true;
  h.nodes['#preview-fallback strong'].textContent = 'Saved preview could not be restored';
  h.nodes['#preview-fallback p'].textContent = 'Existing exact recovery instructions';
  h.actions.sync();
  h.actions.seen(h.main);
  assert.equal(h.context.previewHeartbeatLost, false);
  assert.equal(h.nodes['#preview-fallback'].hidden, false);
  assert.equal(
    h.nodes['#preview-fallback strong'].textContent,
    'Saved preview could not be restored',
  );
  assert.equal(h.nodes['#preview-fallback p'].textContent, 'Existing exact recovery instructions');
});

test('queued and active source work disable the exposed reconnect control without changing the run', () => {
  for (const state of ['queued', 'claimed', 'applying', 'rebuilding']) {
    const h = harness();
    h.session.applyRuns = [{ id: 'same-run', state }];
    h.actions.offline(h.main);
    assert.equal(h.nodes['#reconnect-preview'].disabled, true, state);
    assert.match(h.nodes['#preview-fallback p'].textContent, /queued or changing source/);
    assert.equal(h.session.applyRuns[0].state, state);
    assert.equal(h.context.preview.src, 'unchanged');
    assert.equal(h.calls.length, 1);
  }
});

test('changing Apply lifecycle while offline updates recovery affordance on status refresh', () => {
  const h = harness();
  h.actions.offline(h.main);
  assert.equal(h.nodes['#reconnect-preview'].disabled, false);
  h.session.applyRuns = [{ state: 'rebuilding' }];
  h.actions.sync();
  assert.equal(h.nodes['#reconnect-preview'].disabled, true);
  h.session.applyRuns = [{ state: 'passed' }];
  h.actions.sync();
  assert.equal(h.nodes['#reconnect-preview'].disabled, false);
  assert.doesNotMatch(h.nodes['#preview-fallback p'].textContent, /queued or changing source/);
  assert.equal(h.context.bridgeConnected, false);
});

test('gate-off and initial connection failures retain original recovery ownership', () => {
  for (const options of [{ pilot: false }, { loaded: false }]) {
    const h = harness(options);
    h.actions.offline(h.main);
    assert.equal(h.context.bridgeConnected, false);
    assert.equal(h.context.previewHeartbeatLost, false);
    assert.equal(h.nodes['#preview-fallback'].hidden, true);
    assert.equal(h.nodes['#preview-loading'].hidden, false);
  }
});

test('connection polling updates the fallback and explicit reset clears its ownership', () => {
  assert.match(app, /function renderConnectionStatus\(\)\s*\{\s*syncPilotHeartbeatRecovery\(\)/);
  assert.match(
    app,
    /function resetPreviewRecovery\(\)\s*\{\s*previewRecoveryGeneration \+= 1;\s*previewHeartbeatLost = false;/,
  );
  const helper = slice(
    'function syncPilotHeartbeatRecovery()',
    'async function restoreSavedCanvasPreview()',
  );
  assert.doesNotMatch(helper, /requestCommand|runDurableAction|\.src\s*=|loadSession|api\(/);
});

test('shared pilot reconnect rejects queued or active Apply before any transport side effect', () => {
  for (const state of ['queued', 'claimed', 'applying', 'rebuilding']) {
    const h = harness();
    h.session.applyRuns = [{ id: 'same-run', state }];
    assert.throws(h.actions.reconnect, /cannot reconnect while Apply is queued or changing source/);
    assert.deepEqual(h.calls, []);
    assert.equal(h.context.preview.src, 'unchanged');
    assert.equal(h.context.bridgeConnected, true);
    assert.equal(h.session.applyRuns[0].state, state);
  }
});

test('pilot fallback click catches a late Apply race and reports it without reload', () => {
  const h = harness();
  h.actions.offline(h.main);
  assert.equal(h.nodes['#reconnect-preview'].disabled, false);
  h.calls.length = 0;
  h.session.applyRuns = [{ state: 'applying' }];
  assert.doesNotThrow(h.actions.click);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0], 'toast');
  assert.match(h.calls[0][1], /cannot reconnect while Apply is queued or changing source/);
  assert.equal(h.context.preview.src, 'unchanged');
});

test('terminal runs allow explicit reconnect while gate-off retains the original action behavior', () => {
  for (const [pilot, state] of [
    [true, 'passed'],
    [true, 'failed'],
    [false, 'applying'],
  ]) {
    const h = harness({ pilot });
    h.session.applyRuns = [{ state }];
    h.actions.reconnect();
    assert.deepEqual(
      h.calls.map((call) => call[0]),
      ['reject', 'reset'],
    );
  }
});

test('verification allows deliberate reconnect but never permits temporary edit replay', () => {
  const h = harness();
  h.session.applyRuns = [{ id: 'same-run', state: 'verifying' }];
  h.actions.offline(h.main);
  assert.equal(h.nodes['#reconnect-preview'].disabled, false);
  assert.match(
    h.nodes['#preview-fallback p'].textContent,
    /Reconnect the preview to continue verification/,
  );
  assert.match(h.nodes['#preview-fallback p'].textContent, /verification is not complete/);
  assert.equal(previewReconnectBlocked(h.session.applyRuns), false);
  assert.equal(previewRecoveryBlocked(h.session.applyRuns), true);
  h.calls.length = 0;
  assert.doesNotThrow(h.actions.reconnect);
  assert.deepEqual(
    h.calls.map((call) => call[0]),
    ['reject', 'reset'],
  );
  assert.equal(h.session.applyRuns[0].state, 'verifying');
});
