import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  stressEvidenceLabel,
  stressDraftMatches,
  stressCorrectionLabel,
  stressPreviewTransform,
} from '../public/next-stress-lab.js';

const helper = readFileSync(new URL('../public/next-stress-lab.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/next-stress-lab.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('preview fits the real viewport without changing its dimensions', () => {
  const viewport = { width: 1440, height: 900 };
  const view = stressPreviewTransform(720, 500, viewport);
  assert.equal(view.scale, 672 / 1440);
  assert.equal(view.x, 24);
  assert.equal(view.y, 40);
  assert.deepEqual(viewport, { width: 1440, height: 900 });
});
test('selection framing centers the target with a gutter and never enlarges it', () => {
  const target = { x: 800, y: 600, width: 448, height: 52 };
  const view = stressPreviewTransform(800, 400, { width: 1440, height: 900 }, target);
  assert.equal(view.scale, 1);
  assert.equal(view.x + (target.x + target.width / 2) * view.scale, 400);
  assert.equal(view.y + (target.y + target.height / 2) * view.scale, 200);
  const narrow = stressPreviewTransform(300, 160, { width: 1440, height: 900 }, target);
  assert.equal(narrow.scale, 252 / 448);
});
test('live preview reuses the Canvas frame and retains the existing restoration action', () => {
  assert.match(helper, /previewHead.append\(previewTitle, restore\)/);
  assert.match(helper, /center.append\(previewPanel, results\)/);
  assert.match(helper, /workspace.dataset.stressPreview = 'visible'/);
  assert.doesNotMatch(helper, /createElement\(['"]iframe|\.src\s*=|append\([^)]*iframe/);
  assert.match(app, /mode !== 'health'\) delete .*dataset.stressPreview/);
  assert.match(app, /nextStressLab && activeMode === 'health'\) return/);
  assert.match(app, /selection.targets\?\.length > 1\) return/);
  assert.match(
    app,
    /await requestCommand\('select', \{ selector: selection.selector, reveal: true \}\)/,
  );
});

test('stress evidence distinguishes untested, measured and stale results', () => {
  assert.equal(stressEvidenceLabel({ connected: true }), 'Not tested yet');
  assert.equal(stressEvidenceLabel({ connected: true, scannedAt: 'now' }), 'Scan complete');
  assert.equal(
    stressEvidenceLabel({ connected: true, scannedAt: 'now', stale: true }),
    'Previous scan',
  );
});
test('offline, busy and error states cannot be reported as completed scans', () => {
  assert.equal(stressEvidenceLabel({ connected: false, scannedAt: 'now' }), 'Preview disconnected');
  assert.equal(
    stressEvidenceLabel({ connected: true, scannedAt: 'now', busy: 'Scanning…' }),
    'Scanning…',
  );
  assert.equal(
    stressEvidenceLabel({ connected: true, scannedAt: 'now', error: 'No target' }),
    'Test needs attention',
  );
});
test('draft conditions compare sets and scope rather than assuming a selection is applied', () => {
  assert.equal(stressDraftMatches(['a', 'b'], ['b', 'a'], 'canvas', 'canvas'), true);
  assert.equal(stressDraftMatches(['a'], [], 'canvas', 'canvas'), false);
  assert.equal(stressDraftMatches(['a'], ['a'], 'selection', 'canvas'), false);
});
test('correction labels explicitly disclose Review changes and recorded outcomes', () => {
  assert.equal(stressCorrectionLabel({}), 'Preview and add to Review');
  assert.equal(stressCorrectionLabel({ previewed: true }), 'Added to Review');
  assert.equal(
    stressCorrectionLabel({ previewed: true, recordedBranchId: 'branch' }),
    'Saved to direction',
  );
});
test('stress presentation retains acknowledged action nodes and does not create its own commands', () => {
  assert.match(helper, /detail.append\(card\)/);
  assert.match(helper, /prepend\(scan\)/);
  assert.doesNotMatch(helper, /fetch\(|requestCommand\(|postMessage\(/);
  assert.match(helper, /Source mapping unavailable/);
});
test('untested evidence does not invent zero results or claim an accessibility pass', () => {
  assert.match(helper, /stress.scannedAt \? String\(value\) : '—'/);
  assert.match(helper, /not a complete accessibility or design review/);
  assert.doesNotMatch(helper, /No critical failures|passed this health scan/);
});
test('live updates preserve focus, selection and independent scroll positions', () => {
  assert.match(helper, /focus\(\{ preventScroll: true \}\)/);
  assert.match(helper, /groups.scrollTop = preserved.results/);
  assert.match(helper, /railScroll.scrollTop = preserved.right/);
  assert.match(app, /nextStressLab\?\.capture\(\)/);
});
test('stress geometry overrides legacy grid placement and keeps action footer accessible', () => {
  assert.match(css, /300px minmax\(0, 1fr\) 300px/);
  assert.match(css, /\.stress-result-toolbar \{[^}]*grid-row: 2;[^}]*grid-column: 1/);
  assert.match(css, /\.stress-finding-groups \{[^}]*grid-row: 4;[^}]*grid-column: 1/);
  assert.match(css, /\.stress-lab-footer \{[^}]*display: flex !important/);
  assert.match(css, /\.stress-finding-evidence \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
});
test('stress actions await acknowledgement, preserve drafts on failure and release busy state', () => {
  const actions = app.slice(
    app.indexOf('async function runStressAction'),
    app.indexOf("$('#stress-review').addEventListener"),
  );
  assert.match(actions, /if \(stressActionBusy\) return/);
  assert.match(actions, /await action\(\)/);
  assert.match(actions, /finally \{\s*stressActionBusy = ''/);
  assert.match(
    actions,
    /await requestCommand\('clear-health-stress'\);\s*selectedStressConditions.clear\(\)/,
  );
});
