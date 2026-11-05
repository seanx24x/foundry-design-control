import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { responsiveFrameLabel, responsiveAuditLabel } from '../public/next-responsive-lab.js';

const file = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');

test('Responsive presentation retains truthful evidence priority for all fixture conditions', () => {
  const measured = Object.freeze({
    connection: 'live',
    auditStatus: 'passed',
    audit: Object.freeze({ findings: Object.freeze([{}]) }),
  });
  const snapshot = Object.freeze({ selection: { width: 360, height: 228 } });
  const cases = [
    [{ connection: 'live' }, snapshot, false, 'Geometry available · not audited'],
    [{ ...measured, auditStatus: 'running' }, snapshot, false, 'Measuring layout…'],
    [measured, snapshot, false, 'Measured · 1 finding'],
    [{ ...measured, auditStatus: 'failed' }, snapshot, false, 'Audit incomplete'],
    [{ ...measured, auditStatus: 'timeout' }, snapshot, false, 'Audit timed out'],
    [{ ...measured, connection: 'offline' }, snapshot, true, 'Preview disconnected'],
    [measured, snapshot, true, 'Previous audit · run again'],
  ];
  for (const [state, geometry, stale, expected] of cases)
    assert.equal(responsiveFrameLabel(Object.freeze(state), geometry, stale), expected);
  assert.equal(
    responsiveFrameLabel({ ...measured, audit: { findings: [] } }, snapshot),
    'Measured · no findings',
  );
});

test('audit completion describes measurements rather than certifying a defect-free layout', () => {
  const summary = Object.freeze({ passed: 4, failed: 0, findings: 1 });
  assert.equal(responsiveAuditLabel(null, false, 0, 4, false), 'Not audited');
  assert.equal(responsiveAuditLabel(null, true, 2, 4, false), 'Measuring 2 of 4 frames');
  assert.equal(responsiveAuditLabel(summary, false, 4, 4, false), 'Audit complete');
  assert.equal(
    responsiveAuditLabel({ ...summary, failed: 1 }, false, 4, 4, false),
    'Audit incomplete',
  );
  assert.equal(responsiveAuditLabel(summary, false, 4, 4, true), 'Previous audit');
});

test('Responsive foundations share the default policy and refine the existing rendered evidence', () => {
  const source = file('next-responsive-lab.js');
  assert.match(source, /from ['"]\.\/foundry-pilot-responsive\.js['"]/);
  assert.match(source, /foundryFoundationsEnabled\(\)/);
  assert.match(source, /if \(pilot\) mountPilotResponsiveLab\(root\)/);
  assert.match(source, /if \(pilot\) refinePilotResponsiveLab\(root, \{ \.\.\.next, stale \}\)/);
  assert.ok(
    source.indexOf('refinePilotResponsiveLab(root,') >
      source.indexOf("root.querySelector('#responsive-capture-after').disabled = !canCapture"),
  );
  assert.match(source, /staleAudits.add\(state.audit\)/);
});

test('Responsive pilot retains control ownership and cannot mutate frames or measured state', () => {
  const source = file('foundry-pilot-responsive.js');
  assert.match(source, /export function mountPilotResponsiveLab\(/);
  assert.match(source, /export function refinePilotResponsiveLab\(/);
  assert.match(source, /querySelector\('\.next-responsive-comparison'\)\.before\(scope\)/);
  assert.match(source, /resize.append\(/);
  assert.doesNotMatch(
    source,
    /fetch\(|requestFrameCommand\(|requestCommand\(|runDurableAction\(|postMessage\(|cloneNode\(|localStorage|sessionStorage/,
  );
  assert.doesNotMatch(source, /\.(?:value|disabled|open|src|width|height)\s*=/);
  assert.doesNotMatch(source, /createElement\(['"](?:iframe|canvas|select|input|button)['"]\)/);
  assert.doesNotMatch(source, /(?:summary|context|snapshot|state|target|running)\.[\w]+\s*=/);
  assert.doesNotMatch(source, /addEventListener\(/);
});

test('viewport labels retain Next status priority and disclosure decoration is idempotent', () => {
  const source = file('foundry-pilot-responsive.js');
  assert.match(source, /card\?\.querySelector\('footer > span'\)\?\.textContent/);
  assert.match(source, /if \(!choice.querySelector\('\.foundry-responsive-frame-icon'\)\)/);
  assert.match(source, /heading.querySelector\('\.foundry-responsive-chevron'\)\) continue/);
  assert.match(
    source,
    /target === 'container' \? 'Custom container width' : 'Custom viewport width'/,
  );
  assert.doesNotMatch(source, /choice\.innerHTML\s*=|heading\.innerHTML\s*=/);
});

test('Responsive fixture uses actual renderers and controls with explicit synthetic transport', () => {
  const source = readFileSync(
    new URL('../../../scripts/test-foundry-responsive-pilot-fixture.mjs', import.meta.url),
    'utf8',
  );
  for (const boundary of [
    'function responsiveViewportContexts()',
    'function responsiveComparisonSnapshot(',
    'function responsiveFindingSummary(',
    'function renderResponsiveLab()',
    "$('#responsive-width').addEventListener",
    "$('#responsive-capture-before').addEventListener",
    "$$('[data-responsive-scope]').forEach((button) =>",
  ])
    assert.ok(source.includes(boundary), `Real source boundary: ${boundary}`);
  assert.match(source, /createNextResponsiveLab as createRealResponsiveLab/);
  assert.match(source, /server\.listen\(port,\s*'127\.0\.0\.1'/);
  assert.match(source, /location\.origin\s*\+\s*'\/fixture-preview'/);
  assert.match(source, /data-synthetic-preview/);
  assert.match(source, /Synthetic evidence and simulated transactions only/);
  assert.match(source, /function applyResponsiveScopeTransaction[^\n]*return \{synthetic:true\}/);
  assert.doesNotMatch(
    source,
    /from ['"](?:playwright|@playwright\/test)|chromium\.launch|localStorage|sessionStorage|fetch\(/,
  );
  assert.doesNotMatch(source, /ses_[a-z0-9]+|__foundry_token|__foundry_session/);
});

test('Responsive fixture exposes evidence, retention, semantics and gated browser checks', () => {
  const source = readFileSync(
    new URL('../../../scripts/test-foundry-responsive-pilot-fixture.mjs', import.meta.url),
    'utf8',
  );
  for (const scenario of ['unaudited', 'running', 'measured', 'incomplete', 'offline', 'stale'])
    assert.ok(source.includes(`'${scenario}'`));
  for (const assertion of [
    'Frame identity, source and intrinsic sizes retained',
    'Original width input retained',
    'Original scope controls retained',
    'Original capture controls retained',
    'Unchanged updates preserve open disclosures',
    'Exactly one chevron per disclosure',
    'Hidden previews remain inert and aria-hidden',
    'Selected view retains all iframe nodes',
    'Finishing audit restores Selected view',
    'Sidebar selection remains local frame navigation',
    'Original card selection retains context callback',
    'Original scope handler invokes one synthetic transaction',
    'Original captures render measured geometry delta',
    'Container mode has a matching accessible width label',
    'Gate off excludes pilot presentation',
  ])
    assert.ok(source.includes(assertion), assertion);
  assert.match(source, /id="fixture-theme"/);
  assert.match(source, /data-fixture-state=/);
  assert.match(source, /id="test-results"/);
});
