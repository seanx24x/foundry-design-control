import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  branchComparisonDirections,
  branchPreviewKey,
  branchPreviewScale,
  branchReviewableChanges,
} from '../public/next-design-branches.js';
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const helper = readFileSync(new URL('../public/next-design-branches.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/next-design-branches.css', import.meta.url), 'utf8');
test('empty and terminal-only directions cannot enter Review', () => {
  assert.equal(branchReviewableChanges(null).length, 0);
  assert.equal(branchReviewableChanges({ changes: [] }).length, 0);
  assert.equal(
    branchReviewableChanges({ changes: [{ status: 'rejected' }, { status: 'applied' }] }).length,
    0,
  );
  assert.equal(
    branchReviewableChanges({ changes: [{ status: 'draft' }, { status: 'unresolved' }] }).length,
    2,
  );
  assert.match(helper, /promote.disabled = active.id === 'main' \|\| savedCount === 0/);
  assert.match(helper, /No saved changes in this direction/);
  const action = app.slice(
    app.indexOf("$('#design-branch-promote').addEventListener"),
    app.indexOf("$('#design-branch-record-import').addEventListener"),
  );
  assert.ok(
    action.indexOf('!branchReviewableChanges(chosen).length') < action.indexOf('await api('),
  );
});
test('same direction renders once; distinct directions preserve comparison order', () => {
  const main = { id: 'main' },
    alternate = { id: 'alternate' };
  assert.deepEqual(branchComparisonDirections(main, main), [main]);
  assert.deepEqual(branchComparisonDirections(alternate, main), [alternate, main]);
});
test('preview render identity ignores irrelevant session updates but includes edits', () => {
  const direction = { id: 'a', name: 'A', status: 'exploring', changes: [{ after: 44 }] };
  const viewport = { width: 1440, height: 900 };
  const key = branchPreviewKey([direction], viewport, 'preview');
  assert.equal(
    key,
    branchPreviewKey([{ ...direction, rejectionReason: 'note' }], viewport, 'preview'),
  );
  assert.notEqual(
    key,
    branchPreviewKey([{ ...direction, changes: [{ after: 48 }] }], viewport, 'preview'),
  );
  assert.notEqual(key, branchPreviewKey([direction], { ...viewport, width: 768 }, 'preview'));
  assert.notEqual(key, branchPreviewKey([direction], viewport, 'new-preview'));
});
test('frame scale fits available width and caps height without magnification', () => {
  assert.equal(branchPreviewScale(300, { width: 1440, height: 900 }), 300 / 1440);
  assert.equal(branchPreviewScale(1400, { width: 1440, height: 900 }), 480 / 900);
  assert.equal(branchPreviewScale(1000, { width: 200, height: 100 }), 1);
});
test('Next preview refresh is keyed and leaving branches tears down transport', () => {
  assert.match(app, /key === designBranchPreviewRenderKey/);
  assert.match(app, /previousMode === 'branches'.*nextDesignBranches/);
  assert.match(app, /invalidateFrameTransport\(frame, 'The branch comparison changed.'/);
  assert.match(app, /clearTimeout\(timer\)/);
});
test('preview starts after frame load and authenticated workspace state, not load alone', () => {
  assert.match(app, /frame\.dataset\.branchReady = 'true'/);
  assert.match(app, /frame\.dataset\.branchLoaded !== 'true'/);
  assert.match(app, /frame\.dataset\.branchReady !== 'true'/);
  assert.match(app, /frame\.dataset\.branchSynced === 'true'/);
  assert.match(app, /if \(!result\?\.switched\)/);
});
test('unavailable comparisons have explicit recovery and do not show stale pixels', () => {
  assert.match(app, /frame\.style\.visibility = 'hidden'/);
  assert.match(app, /Use Reload previews to try again/);
  assert.match(app, /The preview did not connect/);
  assert.match(app, /failNextBranchPreview\(frame, 'The project reloaded.'/);
});
test('direction note draft and cursor survive periodic rendering', () => {
  assert.match(helper, /notes\.set\(activeId, note\.value\)/);
  assert.match(helper, /note\.value = notes\.get\(activeId\)/);
  assert.match(helper, /note\.setSelectionRange/);
});
test('UI distinguishes comparison from activation and source application', () => {
  assert.match(helper, /compare without changing your active editing direction/);
  assert.match(helper, /Move to Review/);
  assert.match(helper, /not Git branches/);
  assert.match(helper, /aria-pressed/);
  assert.doesNotMatch(helper, /fetch\(|postMessage\(/);
});
test('stale decision selections are pruned before combining', () => {
  assert.match(app, /if \(!eligible\.has\(id\)\) branchDecisionSelection\.delete\(id\)/);
});
test('shared rails and wrapping controls retain compact responsive layout', () => {
  assert.match(css, /300px minmax\(0, 1fr\) 300px/);
  assert.match(css, /flex-direction: row/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /max-width: 1100px/);
});
