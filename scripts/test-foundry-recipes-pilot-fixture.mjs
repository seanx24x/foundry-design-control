// Isolated presentation harness: real Recipes markup/renderer and built assets,
// synthetic recipe data, no Foundry session, adapter, storage or source transport.
// Build the Inspector first, then run this script. Open its printed pilot URL.
// FOUNDRY_RECIPE_FIXTURE_PORT may specify a port; the default is an ephemeral port.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'apps/inspector/dist');
const source = await readFile(resolve(root, 'apps/inspector/public/app.js'), 'utf8');
const index = await readFile(resolve(root, 'apps/inspector/public/index.html'), 'utf8');
const sectionStart = index.lastIndexOf(
  '<section',
  index.indexOf('class="mode-surface centered-mode visual-recipes-mode"'),
);
const sectionEnd = index.indexOf(
  '<section',
  index.indexOf('class="mode-surface centered-mode decision-memory-mode"') - 40,
);
if (sectionStart < 0 || sectionEnd <= sectionStart) throw new Error('Recipes markup not found');
const markup = index.slice(sectionStart, sectionEnd).replace(/\s+hidden\s*>/, '>');
const renderStart = source.indexOf('function renderVisualRecipes()');
const renderEnd = source.indexOf('const DESIGN_SYSTEM_CATEGORY_LABELS', renderStart);
const captureStart = source.indexOf("$('#visual-recipe-save').addEventListener");
const captureEnd = source.indexOf("$('#visual-recipe-review').addEventListener", captureStart);
if (renderStart < 0 || renderEnd <= renderStart || captureStart < 0 || captureEnd <= captureStart)
  throw new Error('Recipes renderer or capture handler not found');
const renderer = source.slice(renderStart, renderEnd);
const captureHandler = source.slice(captureStart, captureEnd);

const script = `
import { foundryFoundationsEnabled } from '/foundry-foundations.js';
import {recipeTargetKey, recipeNewCapture, recipeCaptureModel, recipeApplyModel, recipeOutcomeMessage} from '/recipe-controls.js';
import { createNextRecipes } from '/next-recipes.js';
import { mountFoundryPilot, refinePilotIcons } from '/foundry-pilot.js';
import { foundryPilotIcon } from '/foundry-pilot-icons.js';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeText = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeAttribute = value => escapeText(value).replaceAll('"', '&quot;');
const params = new URLSearchParams(location.search);
params.set('ui', 'next');
let nextRecipes, visualRecipeId = '', visualRecipeSearch = '', bridgeConnected = true;
let recipeCapturePendingSelectionId='', recipeOperationPending=null, recipeCaptureNeedsRecheck=false, recipeCaptureFeedback='';
const recipeMappingRechecks=new Set(), recipeMappingFeedback=new Map();
const activeMode='recipes', foundryPilotActive=foundryFoundationsEnabled;
const loadSession=async()=>{};
let fixtureCaptureCounter=0;
const calls = [];
const requestCommand = async (action, payload) => {
  calls.push({ action, payload });
  $('#fixture-action').textContent = 'Simulated: ' + action + '. No project changes.';
  if(action==='apply-visual-recipe')return {applied:2,attempted:2};
  if(action==='save-visual-recipe'){
    const captured={...recipe,id:'synthetic-capture-'+(++fixtureCaptureCounter),name:payload.name,intent:payload.intent};
    fixtureRecipes.unshift(captured);assessments[captured.id]=assessment;
    return {saved:true,recipe:captured};
  }
  if(action==='request-state')return bridgeState;
  return { completed: true };
};
const runDurableAction = requestCommand;
const toast = message => { $('#fixture-action').textContent = 'Simulated: ' + message; };
function renderIcons(root = document) {
  for (const icon of $$('[data-icon]', root)) {
    const markup = foundryPilotIcon(icon.dataset.icon);
    if (markup) icon.outerHTML = markup;
  }
  refinePilotIcons(root);
}
const fixtureSelection = { label: 'Supporting content', component: 'Example/Card', kind: 'div' };
const recipe = {
  id: 'fixture-quiet',
  name: 'Quiet supporting treatment with an intentionally long recipe name',
  intent: 'Keep supporting content legible without competing with the primary action.',
  sourceLabel: 'Synthetic Card / supporting content',
  conditions: { components: ['Example/Card'], elementKinds: ['div'] },
  values: [
    { property: 'color', category: 'color', value: '#667085' },
    { property: 'paddingInline', category: 'spacing', value: '24px' },
    { property: 'animationTimeline', category: 'motion', value: 'scroll(block nearest)' },
  ],
};
const assessment = {
  matched: 2, total: 3, ambiguous: 1, score: 85, compatibility: 'partial',
  mappings: [
    { property: 'color', category: 'color', status: 'mapped', currentValue: '#222222', sourceValue: '#667085', resolvedValue: 'var(--text-muted)', token: { name: '--text-muted' }, detail: 'Synthetic mapping resolved to a destination token.' },
    { property: 'paddingInline', category: 'spacing', status: 'ambiguous', currentValue: '16px', sourceValue: '24px', resolvedValue: '24px', token: { name: '--space-content' }, detail: 'Synthetic mapping with two equally close token candidates; the shown choice needs Review.' },
    { property: 'animationTimeline', category: 'motion', status: 'unsupported', sourceValue: 'scroll(block nearest)', detail: 'Synthetic target exposes no editable control for this property.' },
  ],
};
const fixtureRecipes = [
  recipe,
  { ...recipe, id: 'fixture-roomy', name: 'Roomier content', intent: 'Give supporting content a little more breathing room.' },
  { ...recipe, id: 'fixture-focus', name: 'Focus treatment', intent: 'Retain a clear focus hierarchy.' },
];
const assessments = Object.fromEntries(fixtureRecipes.map(item => [item.id, assessment]));
let bridgeState = {
  selection: fixtureSelection,
  visualRecipes: { recipes: fixtureRecipes, assessment: assessments, canSave: true },
};
const visualRecipeTargetSuggestions = () => [
  { selector: '#fixture-card', label: 'Supporting content', component: 'Example/Card', score: 100 },
  { selector: '#fixture-other', label: 'Another content block with a longer target label', kind: 'div', score: 84 },
];
const duplicate = $('[data-studio-action="recipe-duplicate"]');
duplicate.addEventListener('click', () => {
  if (visualRecipeId) void requestCommand('duplicate-visual-recipe', { recipeId: visualRecipeId });
});
${captureHandler}
$('#visual-recipe-search').addEventListener('input', event => {
  visualRecipeSearch = event.target.value;
  renderVisualRecipes();
});
$('#visual-recipe-review').addEventListener('click', () => {
  $('#fixture-action').textContent = 'Simulated navigation: Review. No project changes.';
});
$('#next-tab-canvas').addEventListener('click', () => {
  $('#fixture-action').textContent = 'Simulated navigation: Canvas. No project changes.';
});
// Import/export are deliberately simulated: this harness never reads user files
// or downloads data, and has no route to any live project's recipe library.
for (const id of ['visual-recipe-import', 'visual-recipe-export']) {
  $('#' + id).addEventListener('click', () => {
    $('#fixture-action').textContent = 'Simulated: ' + id.replaceAll('-', ' ') + '. No file operation.';
  });
}
${renderer}
mountFoundryPilot();
const tests = [];
function check(condition, message) {
  if (!condition) throw new Error(message);
  tests.push(message);
}
function showFixtureState(state) {
  bridgeConnected = state !== 'offline';
  bridgeState = {
    selection: state === 'no-target' ? null : fixtureSelection,
    visualRecipes: {
      recipes: state === 'empty' ? [] : fixtureRecipes,
      assessment: assessments,
      canSave: state !== 'no-target',
    },
  };
  visualRecipeSearch = '';
  $('#visual-recipe-search').value = '';
  renderVisualRecipes();
  for (const button of $$('[data-fixture-state]'))
    button.setAttribute('aria-pressed', String(button.dataset.fixtureState === state));
  $('#fixture-state').textContent = {
    mapped: 'Synthetic mapping', offline: 'Synthetic offline state',
    'no-target': 'Synthetic no-target state', empty: 'Synthetic empty library',
  }[state];
}
for (const button of $$('[data-fixture-state]'))
  button.addEventListener('click', () => showFixtureState(button.dataset.fixtureState));

async function runAssertions() {
  const settleRecipe=async()=>{
    for(let i=0;i<20 && recipeOperationPending;i++)await Promise.resolve();
    check(!recipeOperationPending,'Simulated acknowledged operation settles');
  };
  const form = $('.visual-recipe-capture-form');
  const name = $('#visual-recipe-name');
  const intent = $('#visual-recipe-intent');
  const originalConfirm = window.confirm;
  try {
    renderVisualRecipes();
    check($('.recipe-compatibility').textContent === '2 of 3 properties supported', 'Concrete mapping count');
    check($$('.next-recipe-map-status').map(element => element.textContent).join('|') === 'Destination token|Token choice needs review|Unsupported', 'Mapped, ambiguous and unsupported labels');
    check($('[data-visual-recipe-target] code').textContent === 'Same component', 'Heuristic target label');
    const details = $('.next-recipe-details');
    details.open = true;
    name.value = 'Unsubmitted draft';
    intent.value = 'Unsubmitted intent';
    renderVisualRecipes();
    check($('.visual-recipe-capture-form') === form && $('#visual-recipe-name') === name && $('#visual-recipe-intent') === intent, 'Original capture nodes preserved');
    check(name.value === 'Unsubmitted draft' && intent.value === 'Unsubmitted intent', 'Capture draft preserved');
    check($('.next-recipe-details') === details && details.open, 'Recipe disclosure state preserved');
    const beforeApply = calls.length;
    $('[data-apply-visual-recipe]').click();
    await settleRecipe();
    check(calls.length === beforeApply + 1 && calls.at(-1)?.action === 'apply-visual-recipe', 'Original Add to Review handler retained');
    duplicate.click();
    check(calls.at(-1)?.action === 'duplicate-visual-recipe', 'Persistent duplicate handler retained');
    const beforeDelete = calls.length;
    window.confirm = () => false;
    $('[data-remove-visual-recipe]').click();
    check(calls.length === beforeDelete, 'Delete cancellation blocks command');
    window.confirm = () => true;
    $('[data-remove-visual-recipe]').click();
    await Promise.resolve();
    check(calls.at(-1)?.action === 'remove-visual-recipe', 'Confirmed delete retains original handler');
    window.confirm = originalConfirm;
    showFixtureState('offline');
    check($('[data-apply-visual-recipe]').disabled && $('#visual-recipe-save').disabled && duplicate.disabled && $('[data-remove-visual-recipe]').disabled && $('[data-visual-recipe-target]').disabled, 'Offline mutation and selection guards');
    check(name.value === 'Unsubmitted draft' && intent.value === 'Unsubmitted intent', 'Offline rerender preserves draft');
    showFixtureState('no-target');
    check(!$('[data-apply-visual-recipe]') && $('#visual-recipe-save').disabled, 'No target cannot stage or capture');
    showFixtureState('empty');
    check($$('[data-visual-recipe]').length === 0 && !$('[data-apply-visual-recipe]'), 'Empty library contains no recipe action');
    showFixtureState('mapped');
    const beforeCapture = calls.length;
    $('#visual-recipe-save').click();
    await settleRecipe();
    const capturedCalls=calls.slice(beforeCapture);
    check(capturedCalls.filter(item=>item.action==='save-visual-recipe').length===1 && capturedCalls[0]?.payload.name==='Unsubmitted draft', 'Original capture handler retained');
    if(foundryFoundationsEnabled())check(capturedCalls.at(-1)?.action==='request-state','Acknowledged synthetic capture refreshes the library');
    check(name.value === '' && intent.value === '', 'Acknowledged capture clears draft');
    visualRecipeSearch = 'no-matching-fixture';
    $('#visual-recipe-search').value = visualRecipeSearch;
    renderVisualRecipes();
    check($$('[data-visual-recipe]').length === 0 && !!$('[data-clear-recipe-search]'), 'Filtered empty state retains Clear search');
    $('[data-clear-recipe-search]').click();
    check($$('[data-visual-recipe]').length === fixtureRecipes.length && $('#visual-recipe-search').value === '', 'Clear search restores library');
    showFixtureState('mapped');
    $('.next-recipe-details').open = false;
    const pilot = foundryFoundationsEnabled();
    check(document.documentElement.dataset.foundryPilot === (pilot ? 'recipes' : undefined), 'Shared foundations default/fallback policy');
    if (pilot) check(!!$('.foundry-sidebar'), 'Shared sidebar mounted');
    $('#test-results').textContent = 'PASS: ' + tests.length + ' isolated assertions';
    $('#test-results').dataset.result = 'pass';
    $('#fixture-action').textContent = 'All actions are simulated. No session, storage or source changes.';
    $('#test-details').textContent = tests.map((test, index) => (index + 1) + '. ' + test).join(String.fromCharCode(10));
  } catch (error) {
    $('#test-results').textContent = 'FAIL: ' + error.message;
    $('#test-results').dataset.result = 'fail';
    $('#test-details').textContent = error.stack;
    console.error(error);
  } finally {
    window.confirm = originalConfirm;
  }
}
await runAssertions();
`;

const html = `<!doctype html>
<html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Foundry Recipes — isolated pilot fixture</title>
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/next-workspace.css"><link rel="stylesheet" href="/foundry-pilot.css">
<style>
html,body{margin:0;height:100%;overflow:hidden}body{display:flex;flex-direction:column}
.fixture-toolbar{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:10px 16px;background:#e9edf5;color:#17243d;font:12px/18px Arial,sans-serif;border-bottom:1px solid #b8c3d5}
.fixture-toolbar strong{font-weight:700}.fixture-toolbar button{border:1px solid #8a9bb8;border-radius:4px;padding:4px 8px;background:white;color:#17243d;font:12px/18px Arial,sans-serif;cursor:pointer}
.fixture-toolbar button[aria-pressed=true]{background:#17243d;color:white}.fixture-toolbar button:focus-visible{outline:2px solid #3157ff;outline-offset:2px}
.fixture-toolbar details{max-width:100%}.fixture-toolbar pre{position:absolute;z-index:100;max-width:calc(100vw - 32px);max-height:50vh;overflow:auto;padding:16px;margin:8px 0;background:white;color:#17243d;border:1px solid #8a9bb8;white-space:pre-wrap}
#app-shell.app-shell[data-next]{display:block;flex:1 1 auto;min-height:0;width:100%;height:auto}
#app-shell>.visual-recipes-mode{height:100%;min-height:0}
[data-result=fail]{color:#ae1b1b}
</style></head><body>
<header class="fixture-toolbar" aria-label="Isolated test controls">
<strong>Recipes fixture · synthetic data</strong><span id="fixture-state">Synthetic mapping</span>
<nav aria-label="Fixture states"><button data-fixture-state="mapped" aria-pressed="true">Restore mapping</button> <button data-fixture-state="offline" aria-pressed="false">Offline</button> <button data-fixture-state="no-target" aria-pressed="false">No target</button> <button data-fixture-state="empty" aria-pressed="false">Empty library</button></nav>
<details><summary id="test-results">Running isolated assertions</summary><pre id="test-details"></pre></details>
<span id="fixture-action" role="status">All actions are simulated. No session, storage or source changes.</span>
<button id="next-tab-canvas" hidden>Fixture Canvas destination</button>
</header>
<div id="app-shell" class="app-shell" data-next="true" data-mode="recipes">${markup}</div>
<script type="module">${script}</script></body></html>`;

const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const port = Number(process.env.FOUNDRY_RECIPE_FIXTURE_PORT ?? 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid fixture port');
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/') {
    response.setHeader('Content-Type', 'text/html');
    response.end(
      url.searchParams.get('theme') === 'dark'
        ? html.replace('data-theme="light"', 'data-theme="dark"')
        : html,
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
  const address = server.address();
  console.log(
    `Isolated Recipes pilot fixture: http://127.0.0.1:${address.port}/?foundations=pilot&theme=light`,
  );
  console.log('Synthetic data and simulated commands only. No live Foundry session.');
});
