// Isolated Content Stress presentation harness. Real markup, renderer, Next
// adapter and acknowledged action handlers; synthetic transport/evidence only.
// Build Inspector first, then open the loopback URL printed by this script.
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
  if (first < 0 || last <= first) throw Error(`Fixture source boundary missing: ${start}`);
  return text.slice(first, last);
}
const surface = index.indexOf('data-mode-surface="health"');
const start = index.lastIndexOf('<section', surface);
let depth = 0,
  end = -1;
for (const match of index.slice(start).matchAll(/<\/?section\b[^>]*>/g)) {
  depth += match[0].startsWith('</') ? -1 : 1;
  if (!depth) {
    end = start + match.index + match[0].length;
    break;
  }
}
if (surface < 0 || start < 0 || end <= surface) throw Error('Content Stress Lab markup not found');
const markup = index.slice(start, end).replace(/\s+hidden\s*>/, '>');
const renderer = between(source, 'function renderHealth()', 'function renderMemory()');
const actions = between(
  source,
  'async function revealStressSelection()',
  "$('#visual-recipe-search').addEventListener",
);
const accessibility = between(
  workflow,
  'export function isAccessibilityFinding(',
  'export function deliveryNarrativeReadOnly(',
).replace('export ', '');

const script = `
import { foundryFoundationsEnabled } from '/foundry-foundations.js';
import { createNextStressLab as createRealStressLab } from '/next-stress-lab.js';
import { mountFoundryPilot, refinePilotIcons } from '/foundry-pilot.js';
import { foundryPilotIcon } from '/foundry-pilot-icons.js';
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const escapeText = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const escapeAttribute = value => escapeText(value).replaceAll('"','&quot;');
const params = new URLSearchParams(location.search); params.set('ui','next');
const pilot = foundryFoundationsEnabled();
let nextStressLab, originalNodes, bridgeConnected=true, stressActionBusy='', stressActionError='';
let stressSelectionInitialized=false, stressScope='selection', stressSeverity='all', stressGroupBy='severity';
const selectedStressConditions=new Set();
const viewport={width:960,height:640};
const selectedViewport=()=>viewport;
const calls=[];
let revision=0, failNextCommand=false;
const profiles=[
  {id:'long-content',category:'content',label:'Long content',description:'Extend copy to expose clipping and wrapping.'},
  {id:'empty-content',category:'content',label:'Empty content',description:'Check what remains when content is unavailable.'},
  {id:'large-numbers',category:'content',label:'Large numbers',description:'Replace short values with longer numbers.'},
  {id:'missing-images',category:'content',label:'Missing images',description:'Check image fallback behavior.'},
  {id:'loading',category:'state',combination:'state',label:'Loading',description:'Simulate a pending state.'},
  {id:'error',category:'state',combination:'state',label:'Error',description:'Simulate a failed state.'},
  {id:'offline',category:'state',combination:'state',label:'Offline',description:'Simulate missing connectivity.'},
  {id:'text-200',category:'accessibility',label:'Text 200%',description:'Inspect enlarged text.'},
  {id:'high-contrast',category:'accessibility',label:'High contrast',description:'Inspect a high-contrast condition.'},
  {id:'reduced-motion',category:'accessibility',label:'Reduced motion',description:'Inspect reduced motion.'},
];
const originalSelection={selector:'#fixture-card',label:'Workspace invitation',width:400,height:228,targets:[{geometry:{x:280,y:206,width:400,height:228}}],source:{file:'fixture.html',line:12}};
const bridgeState={selection:structuredClone(originalSelection),context:{viewport:'current',theme:'light',state:'current'},health:[],stressTesting:{profiles,active:[],scope:'selection'}};
const activeSession={changeSet:{changes:[]}};
const toast=message=>$('#fixture-action').textContent='Synthetic only: '+message;
function setMode(mode){calls.push({command:'navigate',mode});toast(mode+' navigation is simulated.');}
function renderIcons(root=document) {
  for(const item of $$('[data-icon]',root)) {const svg=foundryPilotIcon(item.dataset.icon); if(svg)item.outerHTML=svg;}
  refinePilotIcons(root);
}
${accessibility}
function createNextStressLab(root, callbacks) {
  originalNodes={frame:$('#product-preview'),stage:$('#canvas-stage'),frameShell:$('#preview-frame'),scan:$('#run-health'),apply:$('#apply-stress'),restore:$('#clear-stress'),scope:$('.stress-scope'),review:$('#stress-review')};
  return createRealStressLab(root, callbacks);
}
${renderer}
${actions}
const fixtureIssues=()=>[
  {id:'clip',severity:'high',kind:'content-overflow',title:'Invitation copy clips',detail:'The longer invitation is cropped at the bottom.',evidence:'Synthetic: scrollHeight 264px exceeds clientHeight 228px.',viewport:'Current · 960 × 640',source:'fixture.html:12',canFix:true,stressConditions:['long-content']},
  {id:'contrast',severity:'medium',kind:'contrast',title:'Supporting text needs contrast review',detail:'Inspect the rendered foreground and background together.',evidence:'Synthetic contrast sample, not an accessibility certification.',viewport:'Current · 960 × 640',canFix:false,stressConditions:[]},
  {id:'target',severity:'low',kind:'target-size',title:'Invitation action was enlarged',detail:'A correction was already recorded in this synthetic example.',evidence:'Synthetic target size: 44 × 44px.',viewport:'Current · 960 × 640',source:'fixture.css:28',canFix:true,previewed:true,stressConditions:[]},
];
function markScan() {bridgeState.stressTesting.scannedAt='synthetic-scan-'+(++revision);bridgeState.stressTesting.target=bridgeState.selection?.label??'Entire canvas';bridgeState.health=fixtureIssues();}
function updatePreview() {
  const doc=$('#product-preview').contentDocument;
  if(!doc?.querySelector('[data-synthetic-preview]'))return;
  const active=bridgeState.stressTesting.active;
  doc.querySelector('#fixture-copy').textContent=active.includes('long-content')?'Invite collaborators to share feedback, keep decisions organized and make room for every perspective. This intentionally longer synthetic invitation illustrates a temporary test condition.':'Keep your workspace in sync. Invite a collaborator to get started.';
  doc.querySelector('#fixture-action-button').textContent=active.includes('loading')?'Sending…':'Send invitation';
}
// Only the transport boundary is simulated. The application action handlers above
// still own busy locking, acknowledgement, failure handling and draft clearing.
async function requestCommand(command,payload) {
  calls.push({command,payload}); await Promise.resolve();
  if(failNextCommand){failNextCommand=false;throw Error('Synthetic acknowledgement failed.');}
  if(command==='apply-health-stress'){bridgeState.stressTesting.active=[...payload.conditions];bridgeState.stressTesting.scope=payload.scope;markScan();}
  if(command==='clear-health-stress'){bridgeState.stressTesting.active=[];bridgeState.stressTesting.error='';markScan();}
  if(command==='scan-health'){bridgeState.stressTesting.scope=payload.scope;markScan();}
  updatePreview();return {synthetic:true};
}
async function runDurableAction(command,payload) {
  calls.push({command,payload});await Promise.resolve();
  if(command==='preview-health-fix'){const issue=bridgeState.health.find(item=>item.id===payload.issueId);if(issue)issue.previewed=true;renderHealth();}
  return {synthetic:true};
}
function showScenario(scenario) {
  bridgeConnected=scenario!=='offline'; stressActionBusy='';stressActionError='';
  stressScope='selection';stressSeverity='all';stressGroupBy='severity';selectedStressConditions.clear();
  bridgeState.selection=structuredClone(originalSelection);
  bridgeState.context={viewport:'current',theme:'light',state:'current'};
  bridgeState.stressTesting={profiles,active:[],scope:'selection',target:'Workspace invitation'};
  bridgeState.health=[];
  if(scenario!=='untested')markScan();
  if(scenario==='busy')stressActionBusy='Scanning…';
  if(scenario==='failed')stressActionError='Synthetic scan could not measure this target.';
  if(scenario==='no-findings')bridgeState.health=[];
  renderHealth();
  if(scenario==='stale'){bridgeState.context={...bridgeState.context,theme:'dark'};renderHealth();}
  updatePreview();refinePilotIcons(document);
  $('#fixture-state').textContent='Synthetic evidence: '+scenario;
  $$('[data-fixture-state]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fixtureState===scenario)));
}
$$('[data-fixture-state]').forEach(button=>button.addEventListener('click',()=>showScenario(button.dataset.fixtureState)));
$('#fixture-theme').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';});
$('[data-view-selection-on-canvas]').addEventListener('click',()=>setMode('canvas'));
mountFoundryPilot();renderHealth();
const frame=originalNodes.frame;
await new Promise(resolve=>{if(frame.contentDocument?.querySelector('[data-synthetic-preview]'))resolve();else frame.addEventListener('load',resolve,{once:true});});
const originalFrame={src:frame.src,width:frame.width,height:frame.height,document:frame.contentDocument};
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
async function runAssertions() {
  const checks=[];
  const check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
  try {
    for(const [scenario,expected] of [['untested','Not tested yet'],['busy','Scanning…'],['failed','Test needs attention'],['offline','Preview disconnected'],['stale','Previous scan'],['measured','Scan complete']]) {
      showScenario(scenario);
      check($('#stress-summary-grid h3').textContent===expected,scenario+' status preserves evidence priority');
      if(['busy','failed','offline','stale'].includes(scenario))check($('.next-stress-heading span').textContent.includes('previous evidence'),'Non-current '+scenario+' results are labeled previous evidence');
      if(['busy','offline','stale'].includes(scenario))check($('[data-stress-fix="clip"]').disabled,'Correction guarded when '+scenario);
      if(scenario==='busy')check($('#apply-stress').disabled&&$('#run-health').disabled,'Busy actions cannot submit twice');
      if(scenario==='untested')check([...$('#stress-summary-grid').querySelectorAll('dd')].every(node=>node.textContent==='—'),'Untested summary does not invent zero results');
    }
    check($('#stress-summary-grid').textContent.includes('not a complete accessibility or design review'),'Measured state retains review boundary');
    check($('#run-health')===originalNodes.scan&&$('#apply-stress')===originalNodes.apply&&$('#clear-stress')===originalNodes.restore,'Original action buttons retained');
    check($('.stress-scope')===originalNodes.scope&&$('#stress-review')===originalNodes.review,'Original scope and Review controls retained');
    check(frame===originalNodes.frame&&frame.isConnected&&frame.src===originalFrame.src&&frame.contentDocument===originalFrame.document,'Original Canvas iframe identity and document retained');
    check(frame.width===originalFrame.width&&frame.height===originalFrame.height,'Intrinsic preview dimensions preserved');
    const actualTarget=frame.contentDocument.querySelector('#fixture-card').getBoundingClientRect();
    check(frame.contentWindow.innerWidth===viewport.width&&frame.contentWindow.innerHeight===viewport.height,'Synthetic iframe viewport matches the declared dimensions');
    check(actualTarget.x===originalSelection.targets[0].geometry.x&&actualTarget.y===originalSelection.targets[0].geometry.y&&actualTarget.width===originalSelection.width&&actualTarget.height===originalSelection.height,'Synthetic target geometry matches the rendered DOM');
    const profile=$('[data-stress-condition="long-content"]');profile.focus();profile.click();
    check(selectedStressConditions.has('long-content')&&!bridgeState.stressTesting.active.length,'Draft choices do not apply temporary conditions');
    check($('.next-stress-draft').textContent.includes('Choices changed'),'Draft versus applied state is explicit');
    check(document.activeElement?.dataset.stressCondition==='long-content','Condition focus survives original renderer updates');
    $('[data-stress-condition="loading"]').click();$('[data-stress-condition="error"]').click();
    check(!selectedStressConditions.has('loading')&&selectedStressConditions.has('error')&&selectedStressConditions.has('long-content'),'State conditions are exclusive while content choices remain');
    const appliedBefore=calls.length;$('#apply-stress').click();await settle();
    check(calls.slice(appliedBefore).filter(call=>call.command==='apply-health-stress').length===1,'Original run handler sends one simulated acknowledged request');
    check(bridgeState.stressTesting.active.length===2&&!stressActionBusy,'Successful run applies selected conditions and releases busy state');
    check(!$('#clear-stress').disabled,'Restore becomes available for applied conditions');
    failNextCommand=true;$('#clear-stress').click();await settle();
    check(bridgeState.stressTesting.active.length===2&&selectedStressConditions.size===2,'Failed restore preserves applied conditions and draft');
    check(stressActionError==='Synthetic acknowledgement failed.'&&!stressActionBusy,'Failed acknowledgement shows error and releases busy state');
    $('#clear-stress').click();await settle();
    check(!bridgeState.stressTesting.active.length&&!selectedStressConditions.size&&$('#clear-stress').disabled,'Acknowledged restore clears draft and temporary conditions');
    showScenario('measured');
    $('[data-stress-severity="medium"]').click();
    check($$('[data-next-stress-finding]').length===1&&$('[data-next-stress-finding]').dataset.nextStressFinding==='contrast','Severity filter keeps matching evidence');
    check($('.next-stress-detail').textContent.includes('Source mapping unavailable')&&!$('.next-stress-detail [data-stress-fix]'),'Unmapped non-correctable finding remains explicit');
    $('[data-stress-severity="all"]').click();$('[data-stress-group="source"]').click();
    check(stressGroupBy==='source'&&$('#stress-finding-groups').textContent.includes('Source mapping unavailable'),'Source grouping preserves unmapped findings');
    $('[data-next-stress-finding="target"]').click();
    check($('[data-stress-fix="target"]').disabled&&$('[data-stress-fix="target"]').textContent==='Added to Review','Previously recorded correction cannot submit again');
    $('[data-next-stress-finding="clip"]').click();
    const correctionBefore=calls.length;$('[data-stress-fix="clip"]').click();await settle();
    check(calls.slice(correctionBefore).filter(call=>call.command==='preview-health-fix'&&call.payload.issueId==='clip').length===1,'Original correction callback reaches simulated boundary once');
    check($('.next-stress-detail').textContent.includes('Source stays unchanged until reviewed Apply'),'Correction discloses Review mutation without source verification');
    const selectBefore=calls.length;$('[data-stress-select="clip"]').click();await settle();
    check(calls.slice(selectBefore).some(call=>call.command==='select-health-issue')&&calls.at(-1).mode==='canvas','Original finding selection retains Canvas navigation callback');
    showScenario('no-findings');check($('.stress-empty strong').textContent==='No findings in this scan','Empty measured state does not claim an accessibility pass');
    showScenario('measured');
    for(let i=0;i<5;i++)renderHealth();
    check($$('.next-stress-preview').length===1&&$$('.next-stress-inspector').length===1,'Repeated rendering does not duplicate workspace regions');
    const framing=$('.next-stress-framing');framing.querySelectorAll('button')[1].click();
    check(framing.querySelectorAll('button')[1].getAttribute('aria-pressed')==='true','Viewport framing remains interactive');
    framing.querySelectorAll('button')[0].click();
    check(framing.querySelectorAll('button')[0].getAttribute('aria-pressed')==='true','Selection framing restores');
    if(pilot) {
      check($('.next-stress-lab').classList.contains('foundry-stress-interior'),'Pilot-only presentation class is mounted');
      check($$('[data-stress-condition]').every(button=>button.querySelectorAll('.foundry-stress-choice-mark').length===1),'Exactly one persistent indicator per condition after repeated updates');
      check($$('.foundry-stress-status-icon').length===1,'Exactly one evidence icon after repeated updates');
      nextStressLab.syncPreview();
      const slot=$('.next-stress-preview-slot').getBoundingClientRect();
      const clip=$('#app-shell').style.getPropertyValue('--stress-preview-clip').match(/-?[\\d.]+px/g)?.map(parseFloat)??[];
      check(slot.width>0&&slot.height>0&&clip.length===4&&clip[1]+clip[3]<slot.width&&clip[0]+clip[2]<slot.height,'Pilot clipping uses a positive rendered boundary, not display-contents shell');
    } else check(!$('.foundry-stress-interior'),'Gate off excludes pilot presentation');
    check(frame===originalNodes.frame&&frame.contentDocument===originalFrame.document,'All interactions retain original iframe document');
    $('#test-results').textContent='PASS: '+checks.length+' isolated assertions';$('#test-results').dataset.result='pass';
    $('#test-details').textContent=checks.map((label,i)=>(i+1)+'. '+label).join(String.fromCharCode(10));
    $('#fixture-action').textContent='Synthetic evidence and simulated actions only. No live session, Review or source changes.';
  } catch(error){$('#test-results').textContent='FAIL: '+error.message;$('#test-results').dataset.result='fail';$('#test-details').textContent=error.stack;console.error(error);}
}
$('#fixture-rerun').addEventListener('click',runAssertions);
await runAssertions();
`;
const diagnosticsScript = `
window.addEventListener('error',event=>{const output=document.querySelector('#fixture-errors');if(output)output.textContent+=(event.error?.stack||event.message||'Resource failed')+'\\n';},true);
window.addEventListener('unhandledrejection',event=>{const output=document.querySelector('#fixture-errors');if(output)output.textContent+=String(event.reason?.stack||event.reason)+'\\n';});
`;
const preview = `<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:Geist;src:url('/fonts/geist-sans.woff2')}*{box-sizing:border-box}body{margin:0;background:#f4f3f1;color:#242426;font:14px/1.5 Geist,Arial,sans-serif;min-height:640px;display:grid;place-items:center}article{width:400px;height:228px;padding:24px;background:white;border:1px solid #e1e1e4;border-radius:12px;overflow:hidden}small{font-size:10px;color:#6a6a72}h1{font-size:24px;line-height:1.2;letter-spacing:-.035em;margin:12px 0}p{font-size:13px;color:#6a6a72;margin:0 0 16px}button{background:#3157ff;color:white;border:0;border-radius:6px;padding:10px 14px;font:500 12px Geist,Arial}</style></head><body data-synthetic-preview><article id="fixture-card"><small>SYNTHETIC PREVIEW · NO PROJECT CONNECTED</small><h1>Invite your team</h1><p id="fixture-copy">Keep your workspace in sync. Invite a collaborator to get started.</p><button id="fixture-action-button">Send invitation</button></article></body></html>`;
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Foundry Content Stress — isolated pilot fixture</title><script>${diagnosticsScript}</script><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/next-workspace.css"><link rel="stylesheet" href="/foundry-pilot.css"><style>
html,body{margin:0;height:100%;overflow:hidden}body{display:flex;flex-direction:column}.fixture-toolbar{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 16px;background:#e9edf5;color:#17243d;font:12px/18px Arial,sans-serif;border-bottom:1px solid #b8c3d5}.fixture-toolbar button{border:1px solid #8a9bb8;border-radius:4px;padding:4px 8px;background:white;color:#17243d;font:12px/18px Arial,sans-serif}.fixture-toolbar button[aria-pressed=true]{background:#17243d;color:white}.fixture-toolbar pre{position:absolute;z-index:100;max-width:calc(100vw - 32px);max-height:50vh;overflow:auto;padding:16px;margin:8px 0;background:white;color:#17243d;border:1px solid #8a9bb8;white-space:pre-wrap}#app-shell.app-shell[data-next]{display:block;flex:1 1 auto;min-height:0;width:100%;height:auto}#app-shell>[data-mode-surface=health]{height:100%;min-height:0}[data-result=fail]{color:#ae1b1b}
</style></head><body><header class="fixture-toolbar" aria-label="Isolated test controls"><strong>Content Stress fixture · synthetic data</strong><span id="fixture-state">Synthetic evidence</span><nav aria-label="Fixture evidence states">${['untested', 'busy', 'measured', 'failed', 'offline', 'stale', 'no-findings'].map((state) => `<button type="button" data-fixture-state="${state}" aria-pressed="false">${state}</button>`).join(' ')}</nav><button id="fixture-theme">Toggle UI theme</button><button id="fixture-rerun">Run checks again</button><a href="/?foundations=off&theme=light">Previous design</a><a href="/?theme=light">Default design</a><a href="/?foundations=pilot&theme=light">Pilot alias</a><details><summary id="test-results">Running isolated assertions</summary><pre id="test-details"></pre></details><details><summary>Runtime errors</summary><pre id="fixture-errors"></pre></details><span role="status" id="fixture-action">No live Foundry session.</span></header><div id="app-shell" class="app-shell" data-next="true" data-mode="health"><section class="canvas-mode" hidden><div class="canvas-stage" id="canvas-stage"><div class="preview-frame" id="preview-frame" style="width:960px;height:640px"><iframe id="product-preview" width="960" height="640" title="Synthetic content stress preview" src="/fixture-preview"></iframe></div></div></section>${markup}</div><script type="module">${script}</script></body></html>`;
if (process.argv.includes('--check')) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: diagnosticsScript + script,
    encoding: 'utf8',
  });
  if (result.status !== 0) process.stderr.write(result.stderr || String(result.error));
  else console.log('Content Stress fixture source extraction and generated module syntax: PASS');
  process.exit(result.status ?? 1);
}
const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const port = Number(process.env.FOUNDRY_STRESS_FIXTURE_PORT ?? 0);
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
    'Isolated Content Stress pilot fixture: http://127.0.0.1:' +
      server.address().port +
      '/?foundations=pilot&theme=light',
  );
  console.log('Synthetic evidence and simulated actions only. No live Foundry session.');
});
