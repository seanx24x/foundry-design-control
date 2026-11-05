// Isolated Responsive presentation harness: actual markup/renderers/controls and
// Next adapter, synthetic evidence and transport. No project session or source.
// Build Inspector first, then open the loopback URL printed by this script.
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'apps/inspector/dist');
const source = await readFile(resolve(root, 'apps/inspector/public/app.js'), 'utf8');
const index = await readFile(resolve(root, 'apps/inspector/public/index.html'), 'utf8');
function between(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  if (first < 0 || last <= first) throw new Error(`Fixture source boundary missing: ${start}`);
  return source.slice(first, last);
}
const surface = index.indexOf('data-mode-surface="responsive"');
const sectionStart = index.lastIndexOf('<section', surface);
let depth = 0,
  sectionEnd = -1;
for (const match of index.slice(sectionStart).matchAll(/<\/?section\b[^>]*>/g)) {
  depth += match[0].startsWith('</') ? -1 : 1;
  if (!depth) {
    sectionEnd = sectionStart + match.index + match[0].length;
    break;
  }
}
if (surface < 0 || sectionStart < 0 || sectionEnd <= surface)
  throw new Error('Responsive Design Lab markup not found');
const markup = index.slice(sectionStart, sectionEnd).replace(/\s+hidden\s*>/, '>');
const contexts = between(
  'function responsiveViewportContexts()',
  'function responsivePreviewContext(',
);
const comparison = between(
  'function responsiveComparisonSnapshot(',
  'function responsiveFindingSummary(',
);
const cards = between('function responsiveFindingSummary(', 'function scrubResponsiveCustomFrame(');
const renderer = between('function renderResponsiveLab()', 'function renderHealth(');
const widthHandler = between(
  "$('#responsive-width').addEventListener",
  "$$('[data-responsive-target]')",
);
const captureHandlers = between(
  "$('#responsive-capture-before').addEventListener",
  "$$('[data-responsive-stress]')",
);
const scopeHandlers = between(
  "$$('[data-responsive-scope]').forEach((button) =>\n  button.addEventListener",
  "$$('[data-canvas-mode]')",
);

const script = `
import { foundryFoundationsEnabled } from '/foundry-foundations.js';
import {responsiveCaptureReady,responsiveComparisonMatches} from '/responsive-controls.js';
const foundryPilotActive=foundryFoundationsEnabled;
import { createNextResponsiveLab as createRealResponsiveLab } from '/next-responsive-lab.js';
import { mountFoundryPilot, refinePilotIcons } from '/foundry-pilot.js';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeText = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const escapeAttribute = value => escapeText(value).replaceAll('"','&quot;');
const sourceText = value => value ? (value.file || 'fixture.css') + ':' + (value.line || 1) : 'Synthetic fixture';
const params = new URLSearchParams(location.search);
params.set('ui','next');
const pilot = foundryFoundationsEnabled();
const activeMode = 'responsive';
const activeSession = { changeSet: { context: { viewport: {width:960,height:640} }, designGraphRevision:'synthetic-r1' } };
const bridgeState = { selection:{id:'fixture-card',selector:'#fixture-card',label:'Workspace invitation',source:{file:'fixture.html',line:12}} };
const project = {breakpoints:[{id:'mobile',label:'Mobile',width:390,height:844},{id:'desktop',label:'Desktop',width:1280,height:800}],containerQueries:[{name:'Invitation',minWidth:480,condition:'(min-width: 480px)',source:{file:'fixture.css',line:24}}]};
const projectDesign = () => project;
let nextResponsiveLab, responsiveRenderKey = '', responsiveActiveViewport = 'custom';
let responsiveCustomWidth=800, responsiveContainerWidth=560, responsiveScrubTarget='viewport';
let responsiveStressMode='none', responsiveEditScope='breakpoint', bridgeConnected=true;
let responsiveScopePending=false, responsiveScopeError='';
let responsiveAuditRunning=false, responsiveAuditSummary=null;
let responsiveComparisonBefore=null, responsiveComparisonAfter=null;
const responsiveFrames=new Map(), responsiveFrameStates=new Map(), responsiveSnapshots=new Map();
const calls=[];
const previewUrl=location.origin+'/fixture-preview';
const responsivePreviewUrl=id=>previewUrl+'?frame='+encodeURIComponent(id);
const invalidateFrameTransport=()=>{};
const disposeResponsiveFrames=()=>responsiveFrames.clear();
const syncResponsiveFrame=async()=>{};
const syncCustomSelect=()=>{};
const toast=message=>$('#fixture-action').textContent='Synthetic only: '+message;
const responsiveStatusText=()=> 'Synthetic frame evidence';
async function runDurableAction(command,payload,options={}) { calls.push({command,payload}); options.onSuccess?.(); return {synthetic:true}; }
async function requestCommand(command,payload) { calls.push({command,payload}); return {synthetic:true}; }
async function requestFrameCommand(frame,command,payload) { calls.push({command,payload,frame:frame.dataset.responsiveFrame}); return {synthetic:true}; }
async function viewSelectionOnCanvas(selector) { calls.push({command:'view-selection',selector}); toast('Canvas navigation is not connected.'); }
async function applyResponsiveScopeTransaction(options) { calls.push({command:'scope',options}); return {synthetic:true}; }
let originalNodes;
function createNextResponsiveLab(root, callbacks) {
  originalNodes={
    range:$('#responsive-width'), scope:$('.responsive-scope-group'),
    captures:['responsive-capture-before','responsive-capture-after','responsive-clear-comparison'].map(id=>$('#'+id)),
    comparison:$('.responsive-comparison'), boundaries:$('#responsive-boundaries'), grid:$('#responsive-viewport-grid'),
  };
  return createRealResponsiveLab(root,callbacks);
}
${contexts}
${comparison}
${cards}
${renderer}
function scrubResponsiveCustomFrame() {
  calls.push({command:'synthetic-scrub',target:responsiveScrubTarget,width:responsiveScrubTarget==='container'?responsiveContainerWidth:responsiveCustomWidth});
  if(responsiveScrubTarget==='viewport') {
    const context=responsiveViewportContexts().find(item=>item.id==='custom');
    const frame=$('[data-responsive-frame="custom"]');
    frame.width=context.width; frame.height=context.height;
    const shell=frame.closest('.responsive-frame-viewport');
    shell.style.setProperty('--preview-width',context.width+'px');
    shell.style.setProperty('--preview-height',context.height+'px');
  }
  refreshNextResponsiveLab();
}
${widthHandler}
${captureHandlers}
${scopeHandlers}
// These scenario controls only change local synthetic conditions. They do not
// attempt the real adapter's container/stress or source-edit transactions.
$$('[data-responsive-target]').forEach(button=>button.addEventListener('click',()=>{
  responsiveScrubTarget=button.dataset.responsiveTarget;
  $$('[data-responsive-target]').forEach(item=>{const active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active));});
  $('#responsive-width-label').textContent=responsiveScrubTarget==='container'?'Container width':'Viewport width';
  $('#responsive-width').value=String(responsiveScrubTarget==='container'?responsiveContainerWidth:responsiveCustomWidth);
  $('#responsive-width-output').textContent=$('#responsive-width').value+'px';
  refreshNextResponsiveLab();
}));
$$('[data-responsive-stress]').forEach(button=>button.addEventListener('click',()=>{
  responsiveStressMode=button.dataset.responsiveStress;
  $$('[data-responsive-stress]').forEach(item=>{const active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active));});
  refreshNextResponsiveLab();
}));
$('#responsive-open-canvas').addEventListener('click',()=>toast('Canvas is not connected.'));
$('#responsive-review').addEventListener('click',()=>toast('Review is not connected.'));
$('[data-studio-action="responsive-audit"]').addEventListener('click',()=>showScenario('measured'));
$('[data-studio-action="responsive-fit"]').addEventListener('click',()=>nextResponsiveLab.fit());
mountFoundryPilot();
renderResponsiveLab();
refinePilotIcons(document);
const originalFrames=$$('[data-responsive-frame]').map(frame=>({frame,src:frame.src,width:frame.width,height:frame.height}));
await Promise.all(originalFrames.map(({frame})=>new Promise(resolve=>{
  if(frame.contentDocument?.querySelector('[data-synthetic-preview]')) resolve();
  else frame.addEventListener('load',resolve,{once:true});
})));
const fixtureFinding={title:'Invitation copy clips at this width',ruleId:'fixture-clipping',label:'Invitation',description:'Synthetic example for presentation testing.',evidence:'390px frame, 24px horizontal overflow',selector:'#fixture-card',severity:'high',source:{file:'fixture.css',line:24}};
function seedMeasured() {
  responsiveAuditRunning=false;
  for(const context of responsiveViewportContexts()) {
    responsiveSnapshots.set(context.id,{targetSelector:'#fixture-card',stressMode:responsiveStressMode,viewportWidth:context.width,viewportHeight:context.height,documentScrollWidth:context.width,container:{selector:'#fixture-container',name:'Invitation',width:560},selection:{width:360,height:228,clientWidth:360,clientHeight:228,scrollWidth:360,scrollHeight:228,lineCount:3}});
    responsiveFrameStates.set(context.id,{connection:'live',auditStatus:'passed',audit:{findings:context.id==='mobile'?[fixtureFinding]:[]}});
  }
  responsiveAuditSummary={passed:4,failed:0,findings:1,crossFrameFindings:1,aggregateFindings:[{title:'Content clips across responsive contexts',selector:'#fixture-card',evidence:['Mobile: 24px horizontal overflow'],severity:'high'}]};
}
function showScenario(scenario) {
  responsiveStressMode='none';
  bridgeConnected=true;
  seedMeasured();
  if(scenario==='unaudited') { responsiveAuditSummary=null; for(const state of responsiveFrameStates.values()){state.audit=null;state.auditStatus='idle';} }
  if(scenario==='running') { responsiveAuditSummary=null; responsiveAuditRunning=true; for(const state of responsiveFrameStates.values()){state.audit=null;state.auditStatus='running';} }
  if(scenario==='incomplete') { const state=responsiveFrameStates.get('custom'); state.auditStatus='failed';state.error='Synthetic font readiness failure.';responsiveAuditSummary={...responsiveAuditSummary,passed:3,failed:1}; }
  if(scenario==='offline') { bridgeConnected=false;for(const state of responsiveFrameStates.values()) state.connection='offline'; }
  for(const context of responsiveViewportContexts()) updateResponsiveCard(context.id);
  refreshNextResponsiveLab();
  if(scenario==='stale') { responsiveStressMode='long-content';refreshNextResponsiveLab(); }
  refinePilotIcons(document);
  $('#fixture-state').textContent='Synthetic evidence: '+scenario;
  $$('[data-fixture-state]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fixtureState===scenario)));
}
for(const button of $$('[data-fixture-state]')) button.addEventListener('click',()=>showScenario(button.dataset.fixtureState));
$('#fixture-theme').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';});
window.addEventListener('resize',()=>nextResponsiveLab.fit());
async function runAssertions() {
  const checks=[];
  const check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
  try {
    responsiveActiveViewport='custom';responsiveScrubTarget='viewport';responsiveEditScope='breakpoint';
    for(const [scenario,expected] of [['unaudited','Not audited'],['running','Measuring'],['measured','Audit complete'],['incomplete','Audit incomplete'],['stale','Previous audit']]) {
      showScenario(scenario);
      check($('.next-responsive-audit h3').textContent.includes(expected),scenario+' audit status remains explicit');
      if(scenario==='unaudited')check($$('.responsive-viewport-card footer > span').every(node=>node.textContent.includes('not audited')),'Connected geometry is not an audit');
      if(scenario==='running')check($$('[data-responsive-view]').every(button=>button.disabled),'View controls are locked during audit');
      if(scenario==='stale')check($$('.responsive-viewport-card footer > span').every(node=>node.textContent.includes('Previous audit')),'Stale frame results are labeled previous audit');
    }
    showScenario('offline');
    check($$('.responsive-viewport-card footer > span').every(node=>node.textContent==='Preview disconnected'),'Offline frame labels supersede old measurements');
    check($('#responsive-capture-before').disabled&&$('#responsive-capture-after').disabled,'Offline captures are disabled');
    check($('[data-responsive-scope="all"]').disabled,'Offline all-breakpoint scope is disabled');
    showScenario('measured');
    check($('.next-responsive-audit').textContent.includes('heuristic'),'Cross-frame findings retain heuristic boundary');
    check($('[data-responsive-card="mobile"] footer > span').textContent==='Measured · 1 finding','Measured does not mean no findings');
    check($('#responsive-width')===originalNodes.range,'Original width input retained');
    check($('.responsive-scope-group')===originalNodes.scope,'Original scope controls retained');
    check(originalNodes.captures.every(node=>node.isConnected),'Original capture controls retained');
    check($('.responsive-comparison')===originalNodes.comparison,'Original comparison retained');
    check($('#responsive-boundaries')===originalNodes.boundaries,'Original boundary list retained');
    check($('#responsive-viewport-grid')===originalNodes.grid,'Original preview grid retained');
    check(originalFrames.every(({frame,src,width,height})=>frame.isConnected&&frame.src===src&&frame.width===width&&frame.height===height),'Frame identity, source and intrinsic sizes retained');
    const details=$$('.next-responsive-boundaries, .next-responsive-comparison, .next-responsive-cross-findings');
    details.forEach(detail=>detail.open=true);
    for(let i=0;i<5;i++)refreshNextResponsiveLab();
    check(details.every(detail=>detail.isConnected&&detail.open),'Unchanged updates preserve open disclosures');
    if(pilot) {
      check($('.next-responsive-inspection-scroll').contains(originalNodes.scope),'Pilot moves original edit scope into Inspection');
      check($('.next-responsive-inspection-scroll').firstElementChild.classList.contains('next-responsive-audit'),'Pilot inspection leads with audit status');
      check($('.foundry-responsive-resize').contains(originalNodes.range),'Custom resize controls are grouped');
      check($$('[data-next-responsive-frame]').every(button=>button.querySelectorAll('.foundry-responsive-row-status').length===1),'Exactly one status per viewport choice');
      check(details.every(detail=>detail.querySelectorAll('.foundry-responsive-chevron').length===1),'Exactly one chevron per disclosure');
    } else {
      check(!$('.foundry-responsive-resize')&&!$('.foundry-responsive-row-status'),'Gate off excludes pilot presentation');
      check($('.responsive-lab-controls').contains(originalNodes.scope),'Gate off retains original scope location');
    }
    $('[data-responsive-view="selected"]').click();
    check($$('.responsive-viewport-card:not([hidden])').length===1,'Selected view shows one active card');
    check($$('.responsive-viewport-card[hidden]').every(card=>card.inert&&card.getAttribute('aria-hidden')==='true'),'Hidden previews remain inert and aria-hidden');
    check(originalFrames.every(({frame})=>frame.isConnected),'Selected view retains all iframe nodes');
    showScenario('running');
    check($$('.responsive-viewport-card[hidden]').length===0,'Audit reveals all retained frames');
    showScenario('measured');
    check($$('.responsive-viewport-card:not([hidden])').length===1,'Finishing audit restores Selected view');
    $('[data-responsive-view="all"]').click();
    const beforeCalls=calls.length;
    $('[data-next-responsive-frame="mobile"]').click();
    check(responsiveActiveViewport==='mobile'&&calls.length===beforeCalls,'Sidebar selection remains local frame navigation');
    const cardButton=$('[data-responsive-open="desktop"]');cardButton.click();await Promise.resolve();await Promise.resolve();
    check(calls.some(call=>call.command==='set-context'&&call.payload.value==='desktop'),'Original card selection retains context callback');
    responsiveActiveViewport='custom';refreshNextResponsiveLab();
    $('#responsive-capture-before').click();
    const snapshot=responsiveSnapshots.get('custom');snapshot.selection.width=420;
    $('#responsive-capture-after').click();
    check($('.responsive-comparison-delta').textContent.includes('+60px'),'Original captures render measured geometry delta');
    $('#responsive-clear-comparison').click();
    check(responsiveComparisonBefore===null&&responsiveComparisonAfter===null,'Original clear comparison control retained');
    const scopeCalls=calls.length;$('[data-responsive-scope="all"]').click();await Promise.resolve();await Promise.resolve();
    check(responsiveEditScope==='all'&&calls.length===scopeCalls+1,'Original scope handler invokes one synthetic transaction');
    $('[data-responsive-scope="breakpoint"]').click();await Promise.resolve();await Promise.resolve();
    const initialWidth=responsiveCustomWidth;const initialFrame=originalFrames.find(item=>item.frame.dataset.responsiveFrame==='custom');
    $('#responsive-width').value=String(initialWidth+40);$('#responsive-width').dispatchEvent(new Event('input',{bubbles:true}));
    check(responsiveCustomWidth===initialWidth+40&&calls.at(-1).command==='synthetic-scrub','Original width handler reaches synthetic scrubbing boundary');
    $('#responsive-width').value=String(initialWidth);$('#responsive-width').dispatchEvent(new Event('input',{bubbles:true}));
    check(initialFrame.frame.width===initialFrame.width&&initialFrame.frame.height===initialFrame.height,'Synthetic custom resize restores original intrinsic dimensions');
    if(pilot){
      $('[data-responsive-target="container"]').click();
      check($('#responsive-width').getAttribute('aria-label')==='Custom container width','Container mode has a matching accessible width label');
      $('[data-responsive-target="viewport"]').click();
      check($('#responsive-width').getAttribute('aria-label')==='Custom viewport width','Viewport accessible width label restores');
    }
    showScenario('measured');
    $$('.next-responsive-boundaries, .next-responsive-comparison, .next-responsive-cross-findings').forEach(detail=>detail.open=false);
    $('#test-results').textContent='PASS: '+checks.length+' isolated assertions';$('#test-results').dataset.result='pass';
    $('#test-details').textContent=checks.map((label,i)=>(i+1)+'. '+label).join(String.fromCharCode(10));
    $('#fixture-action').textContent='Synthetic evidence and simulated transactions only. No session, Review or source changes.';
  } catch(error) {$('#test-results').textContent='FAIL: '+error.message;$('#test-results').dataset.result='fail';$('#test-details').textContent=error.stack;console.error(error);}
}
$('#fixture-rerun').addEventListener('click',runAssertions);
await runAssertions();
`;

const diagnosticsScript = `
window.addEventListener('error',event=>{const output=document.querySelector('#fixture-errors');if(output)output.textContent+=(event.error?.stack||event.message||'Resource failed')+'\\n';},true);
window.addEventListener('unhandledrejection',event=>{const output=document.querySelector('#fixture-errors');if(output)output.textContent+=String(event.reason?.stack||event.reason)+'\\n';});
`;
const preview = `<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:Geist;src:url('/fonts/geist-sans.woff2')}*{box-sizing:border-box}body{margin:0;padding:32px;background:#f4f3f1;color:#242426;font:14px/1.5 Geist,Arial,sans-serif;min-height:100vh;display:grid;place-items:center}article{width:100%;max-width:400px;padding:28px;background:white;border:1px solid #e1e1e4;border-radius:12px}small{font-size:11px;color:#6a6a72}h1{font-size:26px;line-height:1.2;letter-spacing:-.035em;margin:20px 0 12px}p{color:#6a6a72}button{width:100%;background:#3157ff;color:white;border:0;border-radius:6px;padding:12px;font:500 13px Geist,Arial}</style></head><body data-synthetic-preview><article id="fixture-card"><small>SYNTHETIC PREVIEW · NO PROJECT CONNECTED</small><h1>Invite your team</h1><p>Keep your workspace in sync. Invite a collaborator to get started.</p><button>Send invitation</button></article></body></html>`;
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Foundry Responsive — isolated pilot fixture</title><script>${diagnosticsScript}</script><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/next-workspace.css"><link rel="stylesheet" href="/foundry-pilot.css"><style>
html,body{margin:0;height:100%;overflow:hidden}body{display:flex;flex-direction:column}.fixture-toolbar{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 16px;background:#e9edf5;color:#17243d;font:12px/18px Arial,sans-serif;border-bottom:1px solid #b8c3d5}.fixture-toolbar button{border:1px solid #8a9bb8;border-radius:4px;padding:4px 8px;background:white;color:#17243d;font:12px/18px Arial,sans-serif}.fixture-toolbar button[aria-pressed=true]{background:#17243d;color:white}.fixture-toolbar pre{position:absolute;z-index:100;max-width:calc(100vw - 32px);max-height:50vh;overflow:auto;padding:16px;margin:8px 0;background:white;color:#17243d;border:1px solid #8a9bb8;white-space:pre-wrap}#app-shell.app-shell[data-next]{display:block;flex:1 1 auto;min-height:0;width:100%;height:auto}#app-shell>[data-mode-surface=responsive]{height:100%;min-height:0}[data-result=fail]{color:#ae1b1b}
</style></head><body><header class="fixture-toolbar" aria-label="Isolated test controls"><strong>Responsive fixture · synthetic data</strong><span id="fixture-state">Synthetic evidence</span><nav aria-label="Fixture evidence states">${['unaudited', 'running', 'measured', 'incomplete', 'offline', 'stale'].map((state) => `<button type="button" data-fixture-state="${state}" aria-pressed="false">${state}</button>`).join(' ')}</nav><button id="fixture-theme">Toggle UI theme</button><button id="fixture-rerun">Run checks again</button><a href="/?foundations=off&theme=light">Previous design</a><a href="/?theme=light">Default design</a><a href="/?foundations=pilot&theme=light">Pilot alias</a><details><summary id="test-results">Running isolated assertions</summary><pre id="test-details"></pre></details><details><summary>Runtime errors</summary><pre id="fixture-errors"></pre></details><span role="status" id="fixture-action">No live Foundry session.</span></header><select id="canvas-viewport" hidden><option value="mobile">Mobile</option><option value="desktop">Desktop</option><option value="current">Current</option></select><div id="app-shell" class="app-shell" data-next="true" data-mode="responsive">${markup}</div><script type="module">${script}</script></body></html>`;

if (process.argv.includes('--check')) {
  const checked = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: diagnosticsScript + script,
    encoding: 'utf8',
  });
  if (checked.status !== 0) process.stderr.write(checked.stderr || String(checked.error));
  else console.log('Responsive fixture source extraction and generated module syntax: PASS');
  process.exit(checked.status ?? 1);
}
const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const port = Number(process.env.FOUNDRY_RESPONSIVE_FIXTURE_PORT ?? 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid fixture port');
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
    'Isolated Responsive pilot fixture: http://127.0.0.1:' +
      server.address().port +
      '/?foundations=pilot&theme=light',
  );
  console.log('Synthetic evidence and simulated transactions only. No live Foundry session.');
});
