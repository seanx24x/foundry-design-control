import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { recoverablePreviewChanges, previewRecoveryBlocked } from '../public/preview-recovery.js';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const change = (status, extra = {}) => ({ status, before: 14, after: 16, ...extra });

function harness(requestCommand = async () => ({ switched: true })) {
  const calls = [];
  const context = {
    activeSession: { applyRuns: [] },
    bridgeConnected: true,
    bridgeState: { context: {} },
    bridgeBranchSynced: false,
    bridgeBranchSyncing: false,
    previewRecoveryFailed: false,
    previewRecoveryGeneration: 0,
    recoverablePreviewChanges,
    previewRecoveryBlocked,
    activeDesignDirection: () => ({
      id: 'main',
      changes: [change('applied'), change('rejected'), change('draft')],
    }),
    requestCommand: async (...args) => {
      calls.push(args);
      return requestCommand(...args);
    },
    showPreviewRecoveryFallback: (...args) => calls.push(['fallback', ...args]),
    toast: () => {},
  };
  const source = app.slice(
    app.indexOf('async function restoreSavedCanvasPreview()'),
    app.indexOf('function showPreviewRecoveryFallback('),
  );
  const restore = runInNewContext(`${source}; restoreSavedCanvasPreview`, context);
  return { context, calls, restore };
}

test('recovery restores only pending edits in the current context', () => {
  const draft = change('draft');
  const approved = change('approved');
  const dark = change('draft', { context: { theme: 'dark' } });
  assert.deepEqual(
    recoverablePreviewChanges({
      changes: [draft, approved, dark, change('applied'), change('rejected')],
    }),
    [draft, approved],
  );
  assert.deepEqual(recoverablePreviewChanges({ changes: [dark] }, { theme: 'dark' }), [dark]);
  const multi = change('draft', {
    contextSet: { breakpoints: ['phone', 'desktop'], themes: ['dark'], states: ['hover'] },
  });
  assert.deepEqual(
    recoverablePreviewChanges(
      { changes: [multi] },
      { breakpoint: 'phone', theme: 'dark', state: 'hover' },
    ),
    [multi],
  );
});

test('Main restores once without a persistence write or repeated replay', async () => {
  const h = harness();
  await h.restore();
  await h.restore();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0], 'switch-design-branch');
  assert.equal(h.calls[0][1].nextChanges.length, 1);
  assert.equal(h.calls[0][1].nextChanges[0].status, 'draft');
  assert.equal(h.context.bridgeBranchSynced, true);
});

test('adapter-before-session and session-before-adapter races wait for both', async () => {
  for (const field of ['activeSession', 'bridgeState', 'bridgeConnected']) {
    const h = harness();
    const saved = h.context[field];
    h.context[field] = null;
    await h.restore();
    assert.equal(h.calls.length, 0);
    assert.equal(h.context.bridgeBranchSynced, false);
    h.context[field] = saved;
    await h.restore();
    assert.equal(h.calls.length, 1);
  }
});

test('named directions recover their own edits and empty directions need no command', async () => {
  const h = harness();
  h.context.activeDesignDirection = () => ({
    id: 'alternate',
    changes: [change('draft', { after: 20 })],
  });
  await h.restore();
  assert.equal(h.calls[0][1].nextChanges[0].after, 20);
  const empty = harness();
  empty.context.activeDesignDirection = () => ({ id: 'main', changes: [change('applied')] });
  await empty.restore();
  assert.equal(empty.calls.length, 0);
  assert.equal(empty.context.bridgeBranchSynced, true);
});

test('transport failure keeps recovery unconfirmed and exposes retry guidance', async () => {
  const h = harness(async () => {
    throw new Error('Disconnected');
  });
  await h.restore();
  assert.equal(h.context.bridgeBranchSynced, false);
  assert.equal(h.context.bridgeBranchSyncing, false);
  assert.equal(h.context.previewRecoveryFailed, true);
  assert.match(h.calls.at(-1)[2], /still saved in Review/);
});

test('no replay races with source Apply or verification', async () => {
  for (const state of ['queued', 'claimed', 'applying', 'rebuilding', 'verifying']) {
    const h = harness();
    h.context.activeSession.applyRuns = [{ state }];
    await h.restore();
    assert.equal(h.calls.length, 0);
  }
  assert.equal(previewRecoveryBlocked([{ state: 'passed' }]), false);
});

test('in-flight and failed restores do not loop or claim success', async () => {
  let resolve;
  const h = harness(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const task = h.restore();
  await h.restore();
  assert.equal(h.calls.length, 1);
  resolve({ switched: false });
  await task;
  assert.equal(h.context.bridgeBranchSynced, false);
  assert.equal(h.context.previewRecoveryFailed, true);
  await h.restore();
  assert.equal(h.calls.length, 2); // one command and one honest fallback
});

test('an old frame acknowledgement cannot mark a new frame restored', async () => {
  let resolve;
  const h = harness(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const task = h.restore();
  h.context.previewRecoveryGeneration += 1;
  h.context.bridgeBranchSyncing = false;
  resolve({ switched: true });
  await task;
  assert.equal(h.context.bridgeBranchSynced, false);
});

test('offline guidance does not infer framing policy and exposes a shared retry path', () => {
  assert.doesNotMatch(html, /This product blocks embedded previews/);
  assert.match(html, /id="reconnect-preview"/);
  assert.match(app, /Your saved edits are safe in Review/);
  assert.match(
    app,
    /\$\('#reconnect-preview'\).addEventListener\('click', reconnectCanvasPreview\)/,
  );
  assert.match(app, /action === 'reconnect-preview'\) \{\s+reconnectCanvasPreview\(\)/);
});
