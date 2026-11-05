import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pilotStressPreviewBounds } from '../public/foundry-pilot-stress.js';
import {
  stressEvidenceLabel,
  stressDraftMatches,
  stressCorrectionLabel,
} from '../public/next-stress-lab.js';

const file = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
const fixture = () =>
  readFileSync(
    new URL('../../../scripts/test-foundry-stress-pilot-fixture.mjs', import.meta.url),
    'utf8',
  );

test('Content Stress pilot clips against real body geometry rather than a display-contents shell', () => {
  const rootBounds = Object.freeze({ left: 320, right: 1642, top: 44, bottom: 1248 });
  const headerBounds = Object.freeze({ top: 44, bottom: 88 });
  const footerBounds = Object.freeze({ top: 1204, bottom: 1248 });
  const queried = [];
  const root = {
    getBoundingClientRect: () => rootBounds,
    querySelector(selector) {
      queried.push(selector);
      return {
        getBoundingClientRect: () => (selector.includes('mode-head') ? headerBounds : footerBounds),
      };
    },
  };
  assert.deepEqual(pilotStressPreviewBounds(root), {
    left: 320,
    right: 1642,
    top: 88,
    bottom: 1204,
  });
  assert.deepEqual(queried, [':scope > .mode-head', ':scope > .stress-lab-footer']);
  assert.ok(!queried.some((selector) => selector.includes('stress-lab-shell')));
  const scrolled = {
    getBoundingClientRect: () => rootBounds,
    querySelector(selector) {
      return {
        getBoundingClientRect: () =>
          selector.includes('mode-head') ? { bottom: -180 } : { top: 1900 },
      };
    },
  };
  assert.deepEqual(pilotStressPreviewBounds(scrolled), {
    left: 320,
    right: 1642,
    top: 44,
    bottom: 1248,
  });
});

test('Content Stress labels preserve stale, failure, busy and disconnected evidence precedence', () => {
  const scanned = { connected: true, scannedAt: 'synthetic-scan' };
  const cases = [
    [{ connected: true }, 'Not tested yet'],
    [scanned, 'Scan complete'],
    [{ ...scanned, stale: true }, 'Previous scan'],
    [{ ...scanned, error: 'Unavailable', stale: true }, 'Test needs attention'],
    [{ ...scanned, busy: 'Scanning…', error: 'Previous error' }, 'Scanning…'],
    [{ ...scanned, connected: false, busy: 'Scanning…' }, 'Preview disconnected'],
  ];
  for (const [state, label] of cases)
    assert.equal(stressEvidenceLabel(Object.freeze(state)), label);
  assert.equal(stressCorrectionLabel({ previewed: true }), 'Added to Review');
  assert.equal(
    stressCorrectionLabel({ previewed: true, recordedBranchId: 'direction' }),
    'Saved to direction',
  );
});

test('draft conditions and applied conditions remain separate and scope-sensitive', () => {
  const selected = Object.freeze(['long-content', 'loading']);
  assert.equal(
    stressDraftMatches(selected, ['loading', 'long-content'], 'selection', 'selection'),
    true,
  );
  assert.equal(stressDraftMatches(selected, [], 'selection', 'selection'), false);
  assert.equal(
    stressDraftMatches(selected, ['loading', 'long-content'], 'canvas', 'selection'),
    false,
  );
  assert.deepEqual(selected, ['long-content', 'loading']);
});

test('Content Stress pilot is explicitly gated and preserves the existing frame and correction guards', () => {
  const source = file('next-stress-lab.js');
  assert.match(source, /foundryFoundationsEnabled\(\)/);
  assert.match(source, /if \(pilot\) mountPilotStressLab\(root\)/);
  assert.match(source, /if \(pilot\) refinePilotStressLab\(root, \{ label \}\)/);
  assert.match(
    source,
    /const scrollBounds = pilot\s*\? pilotStressPreviewBounds\(root\)\s*:\s*root\.querySelector\('\.stress-lab-shell'\)\.getBoundingClientRect\(\)/,
  );
  assert.match(source, /fix.disabled = !correctionReady \|\| Boolean\(issue.previewed\)/);
  assert.match(source, /detail.append\(card\)/);
  assert.match(source, /workspace.style.setProperty\(\s*'--stress-preview-transform'/);
  assert.doesNotMatch(source, /createElement\(['"]iframe|\.src\s*=/);
});

test('Content Stress decorations cannot submit commands or replace control ownership', () => {
  const source = file('foundry-pilot-stress.js');
  assert.match(source, /summary.dataset.evidence = label/);
  assert.match(source, /if \(!summary.querySelector\('\.foundry-stress-status-icon'\)\)/);
  assert.match(source, /Scanning only measures the current preview/);
  assert.doesNotMatch(
    source,
    /fetch\(|requestCommand\(|runDurableAction\(|postMessage\(|cloneNode\(|localStorage|sessionStorage|addEventListener\(/,
  );
  assert.doesNotMatch(source, /\.(?:value|disabled|open|src|width|height)\s*=/);
  assert.doesNotMatch(source, /createElement\(['"](?:iframe|canvas|select|input|button)['"]\)/);
  const css = file('foundry-pilot-stress.css');
  assert.match(css, /:root\[data-foundry-pilot='health'\]/);
});

test('Content Stress fixture extracts real rendering and acknowledged handlers with only synthetic transport', () => {
  const source = fixture();
  for (const boundary of [
    'function renderHealth()',
    'async function revealStressSelection()',
    'export function isAccessibilityFinding(',
  ])
    assert.ok(source.includes(boundary), boundary);
  assert.match(source, /createNextStressLab as createRealStressLab/);
  assert.match(source, /async function requestCommand\(command,payload\)/);
  assert.match(source, /async function runDurableAction\(command,payload\)/);
  assert.match(source, /server\.listen\(port,\s*'127\.0\.0\.1'/);
  assert.match(source, /Synthetic evidence and simulated actions only/);
  assert.doesNotMatch(
    source,
    /from ['"](?:playwright|@playwright\/test)|chromium\.launch|localStorage|sessionStorage|fetch\(/,
  );
  assert.doesNotMatch(source, /ses_[a-z0-9]+|__foundry_token|__foundry_session/);
});

test('Content Stress fixture includes ownership, guard, draft, filter and clipping regressions', () => {
  const source = fixture();
  for (const scenario of [
    'untested',
    'busy',
    'measured',
    'failed',
    'offline',
    'stale',
    'no-findings',
  ])
    assert.ok(source.includes(`'${scenario}'`), scenario);
  for (const assertion of [
    'Original Canvas iframe identity and document retained',
    'Synthetic iframe viewport matches the declared dimensions',
    'Synthetic target geometry matches the rendered DOM',
    'Draft choices do not apply temporary conditions',
    'Condition focus survives original renderer updates',
    'State conditions are exclusive while content choices remain',
    'Failed restore preserves applied conditions and draft',
    'Acknowledged restore clears draft and temporary conditions',
    'Severity filter keeps matching evidence',
    'Unmapped non-correctable finding remains explicit',
    'Previously recorded correction cannot submit again',
    'Original correction callback reaches simulated boundary once',
    'Pilot clipping uses a positive rendered boundary, not display-contents shell',
    'Exactly one persistent indicator per condition after repeated updates',
    'Exactly one evidence icon after repeated updates',
    'Gate off excludes pilot presentation',
  ])
    assert.ok(source.includes(assertion), assertion);
  assert.match(source, /id="fixture-theme"/);
  assert.match(source, /data-fixture-state=/);
  assert.match(source, /id="test-results"/);
  assert.match(source, /class="canvas-stage" id="canvas-stage"/);
  assert.match(source, /class="preview-frame" id="preview-frame"/);
  assert.match(source, /getPropertyValue\('--stress-preview-clip'\)/);
});
