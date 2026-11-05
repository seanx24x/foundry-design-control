// Isolated presentation harness. Real State markup, renderer, controls and Next
// adapter; synthetic conditions/evidence only. No live session, bridge or source.
// Build the Inspector first, then run this script and open its printed URL.
// FOUNDRY_STATE_FIXTURE_PORT optionally chooses a port (default: ephemeral).
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'apps/inspector/dist');
const source = await readFile(resolve(root, 'apps/inspector/public/app.js'), 'utf8');
const index = await readFile(resolve(root, 'apps/inspector/public/index.html'), 'utf8');
const workflow = await readFile(resolve(root, 'apps/inspector/public/workflow.js'), 'utf8');
function between(text, start, end) {
  const first = text.indexOf(start);
  const last = text.indexOf(end, first + start.length);
  if (first < 0 || last <= first) throw new Error(`Fixture source boundary missing: ${start}`);
  return text.slice(first, last);
}
const surface = index.indexOf('data-mode-surface="states"');
const sectionStart = index.lastIndexOf('<section', surface);
const sectionEnd = index.indexOf('<section', surface);
if (surface < 0 || sectionStart < 0 || sectionEnd <= surface)
  throw new Error('State Workbench markup not found');
const markup = index.slice(sectionStart, sectionEnd).replace(/\s+hidden\s*>/, '>');
const renderer = between(source, 'function renderStates()', 'function stateWorkbenchPreviewUrl(');
const contexts = between(
  source,
  'function stateWorkbenchPreviewContext(',
  'function previewContextsMatch(',
);
const presentation = between(
  source,
  'function updateStateWorkbenchPresentation()',
  'async function applyStateWorkbenchContext()',
);
const selects = between(source, 'function closeCustomSelect(', 'function escapeText(');
const fit = between(
  workflow,
  'export function previewFitScale(',
  'export function isAccessibilityFinding(',
).replace('export ', '');

const script = `
import { foundryFoundationsEnabled } from '/foundry-foundations.js';
import { createNextStateWorkbench as createRealStateWorkbench, stateConditionKey } from '/next-state-workbench.js';
import { mountFoundryPilot, refinePilotIcons } from '/foundry-pilot.js';
import { foundryPilotIcon } from '/foundry-pilot-icons.js';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeText = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeAttribute = value => escapeText(value).replaceAll('"', '&quot;');
const params = new URLSearchParams(location.search);
params.set('ui', 'next');
const pilot = foundryFoundationsEnabled();
let nextStateWorkbench, originalNodes;
let stateWorkbenchConnected = false, stateWorkbenchSnapshot = null;
let stateWorkbenchLastResult = null, stateWorkbenchRequestRevision = 0;
let stateWorkbenchApplying = false, stateWorkbenchRequestedContext = null;
let stateWorkbenchGeneration = 0, stateWorkbenchReloading = false;
let stateWorkbenchResizeObserver = null;
const stateWorkbenchResults = new Map();
const stateWorkbenchContext = { viewport: 'current', theme: 'current', state: 'current', motionPreference: 'system' };
const activeMode = 'states';
const activeSession = { changeSet: { context: { viewport: { width: 960, height: 640 }, targetName: 'Synthetic example only' } } };
const bridgeState = { selection: { id: 'fixture-card', selector: '#fixture-card', label: 'Workspace invitation', component: 'Example/InviteCard' } };
const project = {
  states: [ { id: 'loading', label: 'Loading invitation' }, { id: 'empty', label: 'No pending invitations' }, { id: 'error', label: 'Invitation could not be sent' } ],
  breakpoints: [ { id: 'mobile', label: 'Mobile', width: 390, height: 844 }, { id: 'desktop', label: 'Desktop', width: 1280, height: 800 } ],
  themes: [ { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' } ],
};
const projectDesign = () => project;
const activeDesignDirection = () => ({ changes: [] });
const previewUrl = location.origin + '/fixture-preview';
const stateWorkbenchPreviewUrl = () => previewUrl;
const calls = [];
const invalidateFrameTransport = () => {};
let openCustomSelect = null, ignoreSelectScrollUntil = 0, selectId = 0;
let inspectorRenderDeferred = false, workshopRenderDeferred = false;
const renderInspector = () => {}, renderComponentWorkshop = () => {};
const ICONS = { chevronDown: 'chevronDown', check: 'check' };
const iconSvg = name => foundryPilotIcon(name) ?? '';
// The real control functions only need the shared SVG contract; importing the
// unbundled legacy icon module would require application package resolution.
const refineNextIcons = () => {};
const NEXT_ICON_SCOPE = '[data-next-icon-scope]';
function renderIcons(root = document) {
  for (const icon of $$('[data-icon]', root)) {
    const markup = foundryPilotIcon(icon.dataset.icon);
    if (markup) icon.outerHTML = markup;
  }
  refineNextIcons(root);
  refinePilotIcons(root);
}
${selects}
${fit}
document.addEventListener('pointerdown', event => {
  if (openCustomSelect && !openCustomSelect.portal.contains(event.target) && !openCustomSelect.trigger.contains(event.target)) closeCustomSelect({ restoreFocus: false });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeCustomSelect();
});
function createNextStateWorkbench(root, callbacks) {
  originalNodes = {
    frame: $('#state-live-preview'),
    controls: ['state-matrix-viewport', 'state-matrix-theme', 'state-matrix-motion'].map(id => $('#' + id)),
    summary: $('.state-verification-summary'),
    note: $('.state-ready-note'),
  };
  return createRealStateWorkbench(root, callbacks);
}
${contexts}
${presentation}
${renderer}

function recordFor(context) {
  const axes = {
    viewport: { status: 'applied', method: 'synthetic-frame-size', evidence: ['Fixture acknowledgement only; no live product was measured.'] },
    theme: { status: context.theme === 'current' ? 'current' : 'applied', method: 'synthetic-theme' },
    state: { status: context.state === 'current' ? 'current' : 'applied', method: 'synthetic-authored-state' },
    motion: { status: context.motionPreference === 'system' ? 'current' : 'applied', method: 'synthetic-media-preference' },
    selectedTarget: { status: 'applied', method: 'synthetic-target' },
  };
  const result = { applied: true, context, axes };
  return { context, result, measuredAt: '2026-10-31T12:00:00.000Z', measurement: { bounds: { width: 360, height: 228 } } };
}
function updateSyntheticPreview() {
  const doc = $('#state-live-preview')?.contentDocument;
  if (!doc?.querySelector('[data-synthetic-preview]')) return;
  doc.documentElement.dataset.theme = stateWorkbenchContext.theme === 'current' ? 'light' : stateWorkbenchContext.theme;
  const state = stateWorkbenchContext.state;
  doc.querySelector('#fixture-card').dataset.state = state;
  doc.querySelector('#fixture-title').textContent = { current: 'Invite your team', loading: 'Sending invitation', empty: 'You are all caught up', error: 'Invitation not sent' }[state];
  doc.querySelector('#fixture-copy').textContent = { current: 'Keep your workspace in sync. Invite a collaborator to get started.', loading: 'Your invitation is being prepared. This is a synthetic loading condition.', empty: 'There are no invitations waiting for a response.', error: 'The synthetic invitation failed. Check the address and try again.' }[state];
  const button = doc.querySelector('button');
  button.textContent = { current: 'Send invitation', loading: 'Sending…', empty: 'Invite someone', error: 'Try again' }[state];
  button.disabled = state === 'loading';
}
function showFixtureState(state) {
  stateWorkbenchConnected = state !== 'offline';
  stateWorkbenchApplying = state === 'pending';
  stateWorkbenchRequestedContext = null;
  stateWorkbenchLastResult = null;
  stateWorkbenchResults.clear();
  const context = stateWorkbenchPreviewContext({ advanceRevision: false });
  if (['inspected', 'failed', 'offline', 'pending'].includes(state)) {
    const record = recordFor(context);
    stateWorkbenchResults.set(stateWorkbenchResultKey(context), record);
    stateWorkbenchLastResult = record.result;
  }
  if (state === 'failed') stateWorkbenchLastResult = { applied: false, context, failureReason: 'Synthetic authored state is unavailable.', axes: { state: { status: 'unsupported', method: 'synthetic-authored-state', failureReason: 'Fixture failure only; the earlier record is not current success.' } } };
  if (state === 'stale-context') {
    const stale = { ...context, viewport: { ...context.viewport, width: context.viewport.width + 80 } };
    const record = recordFor(stale);
    stateWorkbenchResults.set(stateWorkbenchResultKey(context), record);
    stateWorkbenchLastResult = record.result;
  }
  for (const button of $$('[data-fixture-state]')) button.setAttribute('aria-pressed', String(button.dataset.fixtureState === state));
  $('#fixture-state').textContent = 'Synthetic evidence: ' + state;
  updateStateWorkbenchPresentation();
  updateSyntheticPreview();
}
function requestStateWorkbenchPreviewContext() {
  calls.push(stateWorkbenchPreviewContext());
  showFixtureState('inspected');
  $('#fixture-action').textContent = 'Simulated condition request only. Canvas, Review and source are not connected.';
}
$('#state-run-verification').addEventListener('click', requestStateWorkbenchPreviewContext);
$('#state-save-matrix').addEventListener('click', () => {
  $('#fixture-action').textContent = 'Export is simulated here. No file download or session operation.';
});
for (const button of $$('[data-fixture-state]')) button.addEventListener('click', () => showFixtureState(button.dataset.fixtureState));
$('#fixture-theme').addEventListener('click', () => {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
});
window.addEventListener('resize', updateStateWorkbenchPresentation);
document.addEventListener('click', event => {
  if (event.target.closest('[data-foundry-workspace]')) $('#fixture-action').textContent = 'Workspace navigation is not connected in this isolated fixture.';
});
mountFoundryPilot();
renderStates();
const frame = $('#state-live-preview');
await new Promise(resolve => {
  if (frame.contentDocument?.querySelector('[data-synthetic-preview]')) resolve();
  else frame.addEventListener('load', resolve, { once: true });
});

async function runAssertions() {
  const tests = [];
  function check(condition, message) {
    if (!condition) throw new Error(message);
    tests.push(message);
  }
  try {
    stateWorkbenchContext.viewport = 'current';
    stateWorkbenchContext.theme = 'current';
    stateWorkbenchContext.state = 'current';
    stateWorkbenchContext.motionPreference = 'system';
    for (const [index, id] of ['viewport', 'theme', 'motion'].entries()) {
      const select = $('#state-matrix-' + id);
      select.value = id === 'motion' ? 'system' : 'current';
      syncCustomSelect(select);
      check(select === originalNodes.controls[index], 'Original ' + id + ' control retained');
    }
    const frameSource = frame.src;
    const expected = { untested: 'untested', pending: 'pending', inspected: 'inspected', failed: 'failed', offline: 'offline', 'stale-context': 'untested' };
    for (const [state, status] of Object.entries(expected)) {
      showFixtureState(state);
      check($('.state-ready-note').dataset.status === status, state + ' evidence is honest');
      check($('#state-run-verification').disabled === ['pending', 'offline'].includes(state), state + ' Inspect guard retained');
      if (['pending', 'offline', 'stale-context'].includes(state)) check($$('.next-state-axis').length === 0, state + ' does not present old applied evidence');
      if (state === 'failed') check($('#state-verification-note').textContent.includes('previous condition'), 'Failure warns that preview may be previous condition');
      if (state === 'stale-context') check($('#state-verification-count').textContent === '0 of 4 conditions inspected', 'Mismatched dimensions excluded from coverage');
    }
    showFixtureState('inspected');
    check($('#state-verification-note').textContent.includes('not a full accessibility or visual audit'), 'Inspection is not audit certification');
    const detail = $('.next-state-axis');
    detail.open = true;
    const stateButton = $('[data-state-matrix-state="current"]');
    const label = stateButton.querySelector('span');
    for (let index = 0; index < 5; index++) updateStateWorkbenchPresentation();
    check($('.next-state-axis') === detail && detail.open, 'Unchanged updates preserve open evidence disclosure');
    check($('[data-state-matrix-state="current"]') === stateButton && stateButton.querySelector('span') === label, 'Repeated updates retain authored state label node');
    check($('#state-live-preview') === originalNodes.frame && frame.src === frameSource, 'Presentation retains original iframe and source');
    check($$('.state-verification-summary').length === 1 && $('.state-verification-summary') === originalNodes.summary, 'Coverage summary is moved, never cloned');
    check($$('.state-ready-note').length === 1 && $('.state-ready-note') === originalNodes.note, 'Evidence status is moved, never cloned');
    check(document.documentElement.dataset.foundryPilot === (pilot ? 'states' : undefined), 'Shared foundations default/fallback policy');
    if (pilot) {
      check($('.next-state-controls').contains(originalNodes.summary), 'Pilot coverage lives with state choices');
      check($('.next-state-evidence-scroll').firstElementChild === originalNodes.note, 'Pilot evidence status precedes target');
      check($$('#foundry-state-requested-state').length === 1 && $('#foundry-state-requested-state').textContent === 'Current', 'Requested state row is singular and labeled');
      check($$('.next-state-axis').every(axis => axis.querySelectorAll('.foundry-state-chevron').length === 1), 'One disclosure chevron per axis after repeated updates');
      check($$('[data-state-matrix-state]').every(button => button.querySelectorAll('svg').length === 1), 'One state icon per row after repeated updates');
    } else {
      check(!$('#foundry-state-requested-state') && !$('.foundry-state-chevron'), 'Gate off leaves State pilot additions absent');
      check($('.next-state-evidence-scroll').contains(originalNodes.summary), 'Gate off keeps existing coverage location');
    }
    const beforeSelection = calls.length;
    $('[data-state-matrix-state="loading"]').click();
    check(calls.length === beforeSelection + 1 && calls.at(-1).state === 'loading', 'Authored state selection retains one original callback');
    if (pilot) check($('#foundry-state-requested-state').textContent === 'Loading invitation', 'Requested state follows authored selection');
    const control = originalNodes.controls[1];
    const beforeTheme = calls.length;
    control.value = 'dark';
    control.dispatchEvent(new Event('change', { bubbles: true }));
    check(calls.length === beforeTheme + 1 && calls.at(-1).theme === 'dark', 'Original theme control retains change handler');
    check(control.closest('.foundry-select').querySelector('.foundry-select-value').textContent === 'Dark', 'Original custom select stays synchronized');
    check($('#state-live-preview') === frame && frame.src === frameSource, 'Condition changes do not replace fixture iframe');
    stateWorkbenchContext.state = 'current';
    control.value = stateWorkbenchContext.theme = 'current';
    syncCustomSelect(control);
    showFixtureState('inspected');
    $('.next-state-axis').open = false;
    $('#test-results').textContent = 'PASS: ' + tests.length + ' isolated assertions';
    $('#test-results').dataset.result = 'pass';
    $('#test-details').textContent = tests.map((test, index) => (index + 1) + '. ' + test).join(String.fromCharCode(10));
    $('#fixture-action').textContent = 'All evidence is synthetic. No session, storage, Review or source changes.';
  } catch (error) {
    $('#test-results').textContent = 'FAIL: ' + error.message;
    $('#test-results').dataset.result = 'fail';
    $('#test-details').textContent = error.stack;
    console.error(error);
  }
}
$('#fixture-rerun').addEventListener('click', runAssertions);
await runAssertions();
`;

const diagnosticsScript = `
window.__foundryFixtureErrors = [];
window.__foundryFixtureReportError = detail => {
  window.__foundryFixtureErrors.push(detail);
  const output = document.querySelector('#fixture-runtime-details');
  if (output) output.textContent = JSON.stringify(window.__foundryFixtureErrors, null, 2);
  const summary = document.querySelector('#fixture-runtime-summary');
  if (summary) {
    summary.textContent = window.__foundryFixtureErrors.length + ' runtime errors — inspect details';
    summary.dataset.result = 'fail';
  }
  if (window.parent !== window && typeof window.parent.__foundryFixtureReportError === 'function')
    window.parent.__foundryFixtureReportError({ ...detail, frame: 'synthetic-preview' });
};
window.addEventListener('error', event => {
  window.__foundryFixtureReportError({
    type: 'error', message: event.message || 'Resource could not be loaded',
    filename: event.filename || event.target?.src || event.target?.href || '',
    line: event.lineno || null, column: event.colno || null,
    stack: event.error?.stack || null, frame: 'fixture', document: location.href,
  });
}, true);
window.addEventListener('unhandledrejection', event => {
  window.__foundryFixtureReportError({
    type: 'unhandledrejection', message: String(event.reason?.message || event.reason),
    stack: event.reason?.stack || null, frame: 'fixture', document: location.href,
  });
});
document.addEventListener('DOMContentLoaded', () => {
  const output = document.querySelector('#fixture-runtime-details');
  if (output) output.textContent = JSON.stringify(window.__foundryFixtureErrors, null, 2);
  const summary = document.querySelector('#fixture-runtime-summary');
  if (summary && window.__foundryFixtureErrors.length) {
    summary.textContent = window.__foundryFixtureErrors.length + ' runtime errors — inspect details';
    summary.dataset.result = 'fail';
  }
});
`;
const diagnostics = `<script>${diagnosticsScript}</script>`;

const preview = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${diagnostics}<style>
@font-face{font-family:Geist;src:url('/fonts/geist-sans.woff2') format('woff2')}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#f4f3f1;color:#242426;font:14px/1.5 Geist,Arial,sans-serif;display:grid;place-items:center;padding:32px}
article{max-width:400px;width:100%;background:#fff;border:1px solid #e1e1e4;border-radius:12px;padding:30px;box-shadow:0 8px 28px #00000008}small{font-size:11px;letter-spacing:.03em;color:#777780}h1{font-size:26px;line-height:1.2;letter-spacing:-.035em;margin:20px 0 12px}p{color:#6a6a72;margin:0 0 24px}button{border:0;background:#3157ff;color:white;border-radius:6px;padding:10px 16px;font:500 13px/20px Geist,Arial,sans-serif;width:100%}button:disabled{opacity:.5}
html[data-theme=dark] body{background:#19191c;color:#f3f3f5}html[data-theme=dark] article{background:#242428;border-color:#37373e}html[data-theme=dark] p{color:#b8b8c1}article[data-state=error] button{background:#a13c3c}
</style></head><body data-synthetic-preview><article id="fixture-card"><small>SYNTHETIC PREVIEW · NO PROJECT CONNECTED</small><h1 id="fixture-title">Invite your team</h1><p id="fixture-copy">Keep your workspace in sync. Invite a collaborator to get started.</p><button type="button">Send invitation</button></article></body></html>`;

const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${diagnostics}
<title>Foundry State Workbench — isolated pilot fixture</title>
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/next-workspace.css"><link rel="stylesheet" href="/foundry-pilot.css">
<style>
html,body{margin:0;height:100%;overflow:hidden}body{display:flex;flex-direction:column}
.fixture-toolbar{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 16px;background:#e9edf5;color:#17243d;font:12px/18px Arial,sans-serif;border-bottom:1px solid #b8c3d5}
.fixture-toolbar button{border:1px solid #8a9bb8;border-radius:4px;padding:4px 8px;background:white;color:#17243d;font:12px/18px Arial,sans-serif;cursor:pointer}.fixture-toolbar button[aria-pressed=true]{background:#17243d;color:white}.fixture-toolbar button:focus-visible{outline:2px solid #3157ff;outline-offset:2px}
.fixture-toolbar pre{position:absolute;z-index:100;max-width:calc(100vw - 32px);max-height:50vh;overflow:auto;padding:16px;margin:8px 0;background:white;color:#17243d;border:1px solid #8a9bb8;white-space:pre-wrap}
#app-shell.app-shell[data-next]{display:block;flex:1 1 auto;min-height:0;width:100%;height:auto}#app-shell>[data-mode-surface=states]{height:100%;min-height:0}[data-result=fail]{color:#ae1b1b}
</style></head><body>
<header class="fixture-toolbar" aria-label="Isolated test controls"><strong>State fixture · synthetic data</strong><span id="fixture-state">Synthetic evidence</span>
<nav aria-label="Fixture evidence states">${['untested', 'pending', 'inspected', 'failed', 'offline', 'stale-context'].map((state) => `<button type="button" data-fixture-state="${state}" aria-pressed="false">${state}</button>`).join(' ')}</nav>
<button type="button" id="fixture-theme">Toggle UI theme</button><button type="button" id="fixture-rerun">Run checks again</button>
<a href="/?foundations=off&theme=light">Previous design</a><a href="/?theme=light">Default design</a><a href="/?foundations=pilot&theme=light">Pilot alias</a>
<details><summary id="test-results">Running isolated assertions</summary><pre id="test-details"></pre></details><details><summary id="fixture-runtime-summary">No runtime errors captured</summary><pre id="fixture-runtime-details"></pre></details><span id="fixture-action" role="status">No live Foundry session.</span></header>
<div id="app-shell" class="app-shell" data-next="true" data-mode="states">${markup}</div><script type="module">${script}</script></body></html>`;

// Validate the fully extracted browser module without opening a browser/server.
if (process.argv.includes('--check')) {
  const checked = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: diagnosticsScript + script,
    encoding: 'utf8',
  });
  if (checked.status !== 0) process.stderr.write(checked.stderr || String(checked.error));
  else console.log('State fixture source extraction and generated module syntax: PASS');
  process.exit(checked.status ?? 1);
}

const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const port = Number(process.env.FOUNDRY_STATE_FIXTURE_PORT ?? 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid fixture port');
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/' || url.pathname === '/fixture-preview') {
    response.setHeader('Content-Type', 'text/html');
    const page = url.pathname === '/fixture-preview' ? preview : html;
    response.end(
      url.searchParams.get('theme') === 'dark'
        ? page.replace('data-theme="light"', 'data-theme="dark"')
        : page,
    );
    return;
  }
  const file = resolve(publicDir, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(publicDir + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(
    'Isolated State pilot fixture: http://127.0.0.1:' +
      server.address().port +
      '/?foundations=pilot&theme=light',
  );
  console.log('Synthetic data and simulated requests only. No live Foundry session.');
});
