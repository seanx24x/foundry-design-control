// Isolated Design Memory: real markup, renderer and durable-action callbacks.
// Only the project snapshot and command transport are synthetic. No live session.
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'apps/inspector/dist');
const source = await readFile(resolve(root, 'apps/inspector/public/app.js'), 'utf8');
const index = await readFile(resolve(root, 'apps/inspector/public/index.html'), 'utf8');
function between(text, start, end) {
  const first = text.indexOf(start),
    last = text.indexOf(end, first + start.length);
  if (first < 0 || last <= first) throw Error(`Fixture source boundary missing: ${start}`);
  return text.slice(first, last);
}
const surface = index.indexOf('data-mode-surface="memory"');
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
if (surface < 0 || start < 0 || end <= surface) throw Error('Design Memory markup not found');
const markup = index.slice(start, end).replace(/\s+hidden\s*>/, '>');
const renderer = between(source, 'function renderMemory()', 'function visualAgentRequests()');
const bindings = between(
  source,
  "$('#decision-memory-search').addEventListener",
  "$('#visual-agent-region').addEventListener",
);
const durable = between(
  source,
  'async function runDurableAction(',
  'function rejectPendingFrameCommands(',
);
const sourceText = between(source, 'function sourceText(', 'function workshopVariantDrift(');
const undo = between(source, "$('#undo').addEventListener", "$('#redo').addEventListener");
const studio = between(
  source,
  "    if (action === 'memory-export')",
  "    if (action === 'agent-start')",
);

const script = `
import { foundryFoundationsEnabled } from '/foundry-foundations.js';
import { createNextDesignMemory as createRealDesignMemory } from '/next-design-memory.js';
import { mountFoundryPilot, refinePilotIcons } from '/foundry-pilot.js';
import { foundryPilotIcon } from '/foundry-pilot-icons.js';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escapeText=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const escapeAttribute=value=>escapeText(value).replaceAll('"','&quot;');
const params=new URLSearchParams(location.search);params.set('ui','next');
const pilot=foundryFoundationsEnabled(),preview={},activeMode='memory';
let nextDesignMemory,originalNodes,bridgeConnected=true;
let decisionMemoryId='',decisionMemorySearch='',decisionMemoryFilter='all',decisionMemoryOutcome='approved';
let memoryCaptureBusy=false,memoryCaptureError='',memoryActionBusy=false,memoryActionError='',failNext=false,holdNext=false,releaseHeld,nextId=1;
const calls=[],undoSnapshots=[];
const target={id:'headline',label:'Make room for the work that matters.',kind:'text',component:'ProductIntro',source:{file:'fixture.html',line:43}};
const bridgeState={selection:structuredClone(target),decisionMemory:{decisions:[],relevant:[],canCapture:true,hasEditedValues:false}};
const toast=message=>$('#fixture-action').textContent='Synthetic only: '+message;
const setMode=mode=>{calls.push({type:'navigate',mode});toast(mode+' navigation simulated.');};
function renderIcons(root=document){for(const item of $$('[data-icon]',root)){const svg=foundryPilotIcon(item.dataset.icon);if(svg)item.outerHTML=svg;}refinePilotIcons(root);}
function createNextDesignMemory(root){
  originalNodes={root,stage:$('#decision-memory-stage'),library:$('.decision-memory-browser'),capture:$('.decision-memory-capture'),context:$('#decision-memory-context'),search:$('#decision-memory-search'),filters:$('.decision-memory-filters'),outcomes:$('.decision-outcome-picker'),title:$('#decision-memory-title'),summary:$('#decision-memory-summary'),rationale:$('#decision-memory-rationale'),save:$('#decision-memory-save'),import:$('#decision-memory-import'),export:$('#decision-memory-export'),file:$('#decision-memory-file'),review:$('#decision-memory-review'),newDecision:$('[data-studio-action="memory-record"]')};
  return createRealDesignMemory(root);
}
${sourceText}
${durable}
${renderer}
${bindings}
${undo}
$$('[data-studio-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.studioAction;${studio}}));

function decision(id,outcome,title,summary,patch={}){return {id,outcome,title,summary,enabled:true,rationale:'Keep decisions connected to the actual product context, not a generic style preference.',categories:['typography'],conditions:{components:['ProductIntro'],elementKinds:['text'],properties:['fontSize'],breakpoints:['desktop','tablet'],themes:['light','dark'],states:['default'],sources:['fixture.html:43']},rules:[{operator:outcome==='rejected'?'avoid':'prefer',property:'fontSize',value:outcome==='rejected'?'96px':'80px'}],evidence:[{kind:'branch',label:'Editorial rhythm exploration',refId:'synthetic-branch'}],sourceLocations:['fixture.html:43'],...patch};}
function library(){return [
  decision('approved','approved','Give the introduction a clear entry point','Use an 80px headline while preserving the existing content measure.'),
  decision('rejected','rejected','Avoid oversized headlines','Do not use the 96px headline treatment at the current measure.',{rationale:'The large variant crowded the signup form and added an unintended line break.'}),
  decision('rule','rule','Keep motion quiet and purposeful','Use short, restrained transitions that retain the relationship between states.',{categories:['motion'],conditions:{components:['WorkspaceSwitcher'],properties:['duration'],states:['open','closed']},rules:[{operator:'max',property:'duration',value:'240ms'}],evidence:[{kind:'manual',label:'Product motion review'}],sourceLocations:['components/WorkspaceSwitcher.tsx:82']}),
  decision('disabled','approved','Earlier compact treatment','Retained for reference, but no longer active guidance.',{enabled:false,rules:[],evidence:[],conditions:{},sourceLocations:[]}),
];}
function showScenario(state){
  bridgeConnected=state!=='offline';memoryCaptureBusy=false;memoryActionBusy=false;memoryActionError='';memoryCaptureError=state==='error'?'Not saved. Your draft is preserved. Check the preview connection and try again.':'';failNext=false;holdNext=false;undoSnapshots.length=0;
  decisionMemorySearch='';decisionMemoryFilter='all';decisionMemoryId='';decisionMemoryOutcome='approved';
  bridgeState.selection=state==='no-selection'?null:structuredClone(target);
  const decisions=state==='empty'?[]:library();
  if(['approved','rejected','rule','disabled'].includes(state))decisionMemoryId=state;
  if(state==='disabled')decisionMemoryFilter='disabled';
  if(state==='evidence')decisions[0].evidence.push({kind:'baseline',label:'Recorded comparison reference',refId:'synthetic-baseline'});
  bridgeState.decisionMemory={decisions,canCapture:Boolean(bridgeState.selection),hasEditedValues:state==='conflict',relevant:decisions.length?[{decision:decisions[0],score:92,reasons:['Same component','Same font-size property'],conflicts:state==='conflict'?[{property:'fontSize',expected:'80px',actual:'96px'}]:[]}]:[]};
  for(const key of ['title','summary','rationale','search'])if(originalNodes)originalNodes[key].value='';
  if(state==='error'){originalNodes.title.value='Keep this decision draft';originalNodes.summary.value='The first save did not complete.';}
  renderMemory();
  if(pilot&&decisions.length){
    if(['error','no-selection'].includes(state))originalNodes.newDecision.click();
    else $('[data-design-decision="'+decisionMemoryId+'"]').click();
  }
  $('#fixture-state').textContent='Synthetic state: '+state;
  $$('[data-fixture-state]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fixtureState===state)));
}

// Synthetic adapter only: original handlers and runDurableAction above decide
// draft clearing, busy/error state, callbacks and user-visible acknowledgement.
async function requestCommand(command,payload={}){
  calls.push({type:'command',command,payload:structuredClone(payload)});
  if(holdNext){holdNext=false;await new Promise(resolve=>{releaseHeld=resolve;});}
  await Promise.resolve();
  if(!bridgeConnected)throw Error('Synthetic preview disconnected.');
  if(failNext){failNext=false;throw Error('Synthetic save was not acknowledged.');}
  const memory=bridgeState.decisionMemory;
  if(command==='undo'){
    const snapshot=undoSnapshots.pop();if(snapshot)bridgeState.decisionMemory=snapshot;
  }else{
    undoSnapshots.push(structuredClone(memory));
    if(command==='save-design-decision')memory.decisions.unshift(decision('saved-'+(++nextId),payload.outcome,payload.title,payload.summary,{rationale:payload.rationale,evidence:[{kind:payload.evidenceKind,label:payload.evidenceLabel}],sourceLocations:[sourceText(bridgeState.selection?.source)]}));
    else if(command==='update-design-decision')Object.assign(memory.decisions.find(item=>item.id===payload.decisionId),Object.fromEntries(Object.entries(payload).filter(([key])=>key!=='decisionId')));
    else if(command==='remove-design-decision')memory.decisions=memory.decisions.filter(item=>item.id!==payload.decisionId);
    else if(command==='import-design-decisions')memory.decisions.push(...JSON.parse(payload.json).decisions);
    else throw Error('Unsupported synthetic command: '+command);
    memory.relevant=memory.relevant.filter(item=>memory.decisions.some(decision=>decision.id===item.decision.id)).map(item=>({...item,decision:memory.decisions.find(decision=>decision.id===item.decision.id)}));
  }
  renderMemory();return {saved:true,synthetic:true};
}
async function requestFrameCommand(){throw Error('No iframe transport is available in this isolated fixture.');}
const settle=async()=>{for(let i=0;i<32;i++)await Promise.resolve();};
const input=(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));};
const filter=value=>$('[data-decision-filter="'+value+'"]').click();
const select=id=>$('[data-design-decision="'+id+'"]').click();
$$('[data-fixture-state]').forEach(button=>button.addEventListener('click',()=>showScenario(button.dataset.fixtureState)));
$('#fixture-theme').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';});
mountFoundryPilot();renderMemory();
async function runAssertions(){
  const checks=[],check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
  try{
    showScenario('empty');
    check(originalNodes.save.disabled&&originalNodes.export.disabled,'Empty memory cannot export or save a blank decision');
    check(originalNodes.stage.textContent.includes('Keep the why, not just the result'),'Empty memory explains what project guidance retains');
    check($('.decision-memory-footer').textContent.includes('reviewed Apply'),'Saved guidance remains distinct from source Apply');
    if(pilot)check(originalNodes.root.dataset.memoryView==='capture'&&$('.next-memory-detail').hidden&&!originalNodes.capture.hidden,'Empty pilot starts with the original capture form instead of an empty detail rail');
    else check(!originalNodes.root.hasAttribute('data-memory-view')&&!originalNodes.capture.hidden&&!$('.next-memory-detail').hidden,'Gate off retains its original simultaneous detail and capture panels');
    showScenario('approved');
    check($$('[data-design-decision]').length===4&&$('[data-design-decision="approved"]').getAttribute('aria-pressed')==='true','Library selects the current decision without hiding other outcomes');
    check($('[data-design-decision="approved"] code').title==='Context match, not a confidence or quality score','Context-match percentage never claims confidence or quality');
    check($('.next-memory-detail-status').textContent==='Active guidance','Enabled decisions are labeled as active guidance');
    for(const [kind,id] of [['approved','approved'],['rejected','rejected'],['rule','rule'],['disabled','disabled']]){filter(kind);check($$('[data-design-decision]').length===1&&$('[data-design-decision]').dataset.designDecision===id,kind+' filter reflects enabled outcome or disabled state');}
    check($('.next-memory-detail-status').textContent==='Disabled guidance','Disabled decision remains readable without appearing active');
    filter('all');input(originalNodes.search,'SIGNUP FORM');
    check($$('[data-design-decision]').length===1&&$('[data-design-decision]').dataset.designDecision==='rejected','Search includes rationale and ignores case');
    input(originalNodes.search,'no matching decision');
    check(!$$('[data-design-decision]').length&&originalNodes.stage.textContent.includes('No visible decision'),'No search match is distinct from an empty project library');
    $('[data-clear-memory-filter]').click();check(originalNodes.search.value===''&&decisionMemoryFilter==='all'&&document.activeElement===originalNodes.search&&$$('[data-design-decision]').length===4,'Clear filters restores the library and search focus');
    showScenario('evidence');
    check($('.decision-memory-evidence').textContent.includes('Recorded comparison reference')&&$('.decision-memory-evidence').textContent.includes('baseline · synthetic-baseline'),'Saved evidence exposes its kind and reference without invented verification');
    check(!/verified|all checks passed|source applied/i.test($('.decision-memory-evidence').textContent),'Evidence references are not relabeled as verified source changes');
    check($('.next-memory-scope').textContent.includes('Source conditions')&&$('.next-memory-scope').textContent.includes('tablet'),'Saved scope retains source and responsive restrictions');
    if(pilot)check($('.foundry-memory-reason').textContent.includes('actual product context')&&$('.foundry-memory-evidence-help').textContent.includes('do not verify the current product')&&$('.foundry-memory-match-help').textContent.includes('not a confidence or verification score'),'Pilot reasoning and provenance remain explicit about evidence limits');
    showScenario('conflict');check($('.decision-relevance').dataset.conflict==='true'&&$('.decision-relevance').textContent.includes('Potential conflict'),'Conflicting remembered guidance is explicitly potential, not a blocked edit');
    showScenario('approved');
    if(pilot){
      check(originalNodes.root.dataset.memoryView==='read'&&!$('.next-memory-detail').hidden&&originalNodes.capture.hidden,'Saved pilot library starts in a focused decision reading view');
      originalNodes.newDecision.click();
      check(originalNodes.root.dataset.memoryView==='capture'&&!originalNodes.capture.hidden&&$('.next-memory-detail').hidden&&document.activeElement===originalNodes.title,'Original New decision opens capture before focusing the original title input');
    }
    input(originalNodes.title,'A useful draft');input(originalNodes.summary,'Keep the intended measure');input(originalNodes.rationale,'It keeps the form visible.');
    originalNodes.summary.focus();originalNodes.summary.setSelectionRange(2,8);renderMemory();
    check(originalNodes.title.value==='A useful draft'&&originalNodes.rationale.value==='It keeps the form visible.'&&document.activeElement===originalNodes.summary&&originalNodes.summary.selectionStart===2&&originalNodes.summary.selectionEnd===8,'Capture draft, focus and caret survive unrelated rendering');
    if(pilot){
      const beforeBack=calls.length;$('[data-memory-back]').click();
      check(originalNodes.root.dataset.memoryView==='read'&&originalNodes.capture.hidden&&originalNodes.title.value==='A useful draft'&&originalNodes.summary.value==='Keep the intended measure'&&calls.length===beforeBack,'Back to decision changes only presentation and preserves the capture draft');
      originalNodes.newDecision.click();select('rule');
      check(originalNodes.root.dataset.memoryView==='read'&&decisionMemoryId==='rule'&&originalNodes.summary.value==='Keep the intended measure','Selecting a saved row restores reading without discarding capture input');
      originalNodes.newDecision.click();
    }
    bridgeConnected=false;renderMemory();
    check(originalNodes.save.disabled&&originalNodes.import.disabled&&$('[data-toggle-decision]').disabled&&$('[data-remove-decision]').disabled,'Offline capture, import and saved-guidance mutations remain unavailable');
    check($('#next-memory-save-help').textContent.includes('draft stays here')&&originalNodes.summary.value==='Keep the intended measure','Offline state explains recovery and preserves the complete draft');
    const offlineCalls=calls.length;originalNodes.save.click();await settle();check(calls.length===offlineCalls,'Disabled offline save sends no synthetic command');
    bridgeConnected=true;bridgeState.decisionMemory.canCapture=false;renderMemory();check(originalNodes.save.disabled&&$('#next-memory-save-help').textContent.includes('Select a layer'),'Connected capture still requires a current source selection');
    bridgeState.decisionMemory.canCapture=true;renderMemory();check(!originalNodes.save.disabled,'Reconnect with a selection restores valid capture availability');
    $('[data-decision-outcome="rejected"]').click();await settle();check($('.next-memory-capture-fields').textContent.includes('Remember what to avoid'),'Outcome selection explains rejected guidance without changing saved decisions');
    failNext=true;originalNodes.save.click();await settle();check(originalNodes.title.value==='A useful draft'&&$('#next-memory-save-help').dataset.error==='true'&&$('#next-memory-save-help').textContent.includes('Not saved'),'Failed acknowledgement preserves capture draft and reports not saved');
    if(pilot)check(originalNodes.root.dataset.memoryView==='capture'&&!originalNodes.capture.hidden,'Failed capture remains in the visible composer for recovery');
    const savesBefore=calls.filter(item=>item.command==='save-design-decision').length;
    holdNext=true;originalNodes.save.click();
    check(memoryCaptureBusy&&originalNodes.save.disabled&&originalNodes.save.textContent==='Saving…','Pending capture locks repeat submission and reports saving rather than success');
    if(pilot)check(originalNodes.root.dataset.memoryView==='capture'&&!originalNodes.capture.hidden,'Busy capture stays visible instead of silently navigating to a record');
    originalNodes.save.click();input(originalNodes.title,'Newer draft title');input(originalNodes.summary,'Newer guidance while the request is pending');releaseHeld();await settle();
    check(calls.filter(item=>item.command==='save-design-decision').length===savesBefore+1,'Busy capture dispatches only one save command');
    check(originalNodes.title.value==='Newer draft title'&&originalNodes.summary.value==='Newer guidance while the request is pending'&&originalNodes.rationale.value==='','Acknowledgement clears submitted fields but cannot erase newer capture input');
    const captured=bridgeState.decisionMemory.decisions.find(item=>item.id.startsWith('saved-'));
    check(captured.title==='A useful draft'&&captured.outcome==='rejected'&&captured.evidence[0].kind==='manual','Original capture submits its exact snapshot and explicit manual evidence');
    showScenario('approved');
    let correction=$('.next-memory-correction');correction.open=true;
    let guidance=$('[data-decision-summary]');input(guidance,'A revised but unsaved guidance draft');input($('[data-decision-rationale]'),'A revised reason');guidance.focus();guidance.setSelectionRange(3,10);renderMemory();
    check($('.next-memory-correction').open&&$('[data-decision-summary]').value==='A revised but unsaved guidance draft','Correction disclosure and unsaved guidance survive renderer replacement');
    check(document.activeElement===$('[data-decision-summary]')&&$('[data-decision-summary]').selectionStart===3&&$('[data-decision-summary]').selectionEnd===10,'Correction field focus and selection survive same-decision refresh');
    select('rejected');select('approved');check($('[data-decision-summary]').value==='A revised but unsaved guidance draft'&&$('[data-decision-rationale]').value==='A revised reason','Switching decisions restores each unsubmitted correction draft');
    failNext=true;$('[data-save-decision-correction]').click();await settle();check($('[data-decision-summary]').value==='A revised but unsaved guidance draft'&&bridgeState.decisionMemory.decisions[0].summary!==$('[data-decision-summary]').value,'Failed correction keeps the draft separate from saved guidance');
    $('[data-save-decision-correction]').click();await settle();check(bridgeState.decisionMemory.decisions[0].summary==='A revised but unsaved guidance draft'&&$('[data-save-decision-correction]').disabled,'Acknowledged correction updates only saved guidance and is no longer dirty');
    const mutationBefore=calls.length;holdNext=true;const toggle=$('[data-toggle-decision]');toggle.click();toggle.dispatchEvent(new MouseEvent('click',{bubbles:true}));await settle();check(memoryActionBusy&&$('[data-toggle-decision]').disabled&&$('[data-remove-decision]').disabled&&originalNodes.save.disabled,'Guidance updates lock conflicting mutations and duplicate submission');releaseHeld();await settle();check(calls.slice(mutationBefore).filter(item=>item.command==='update-design-decision').length===1,'Repeated guidance toggle sends one acknowledged command');check(!bridgeState.decisionMemory.decisions[0].enabled&&$('.next-memory-detail-status').textContent==='Disabled guidance','Original disable callback changes guidance eligibility, not source');
    $('[data-toggle-decision]').click();await settle();check(bridgeState.decisionMemory.decisions[0].enabled,'Original enable callback restores guidance eligibility');
    const removed=decisionMemoryId;$('[data-remove-decision]').click();await settle();check(!bridgeState.decisionMemory.decisions.some(item=>item.id===removed),'Original remove callback removes only the selected synthetic decision');
    $('#undo').click();await settle();check(bridgeState.decisionMemory.decisions.some(item=>item.id===removed),'Original global Undo restores the synthetic adapter snapshot');
    check(calls.some(item=>item.command==='undo')&&!calls.some(item=>item.command?.includes('apply')||item.type==='provider'),'No source Apply, Review mutation or provider command is invoked');
    originalNodes.review.click();check(calls.at(-1).type==='navigate'&&calls.at(-1).mode==='review','Review action only requests navigation');
    showScenario('approved');for(let i=0;i<5;i++)renderMemory();
    for(const [key,selector]of Object.entries({stage:'#decision-memory-stage',library:'.decision-memory-browser',capture:'.decision-memory-capture',context:'#decision-memory-context',search:'#decision-memory-search',filters:'.decision-memory-filters',outcomes:'.decision-outcome-picker',title:'#decision-memory-title',summary:'#decision-memory-summary',rationale:'#decision-memory-rationale',save:'#decision-memory-save',import:'#decision-memory-import',export:'#decision-memory-export',file:'#decision-memory-file',review:'#decision-memory-review',newDecision:'[data-studio-action="memory-record"]'}))check($(selector)===originalNodes[key],key+' original node survives repeated rendering');
    check($$('.next-memory-detail').length===1&&$$('.next-memory-correction').length===1&&$$('.next-memory-scope').length===1&&$$('.next-memory-save-area').length===1,'Repeated rendering creates no duplicate detail, correction, scope or save regions');
    if(pilot){
      check($$('[data-memory-back]').length===1&&$$('.foundry-memory-interior').length===1,'Pilot presentation retains one view controller and one Back action');
      await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const root=originalNodes.root,sidebar=originalNodes.library,filters=originalNodes.filters.getBoundingClientRect(),search=originalNodes.search.closest('label').getBoundingClientRect();
      check(Math.abs(filters.left-search.left)<=1&&Math.abs(filters.width-search.width)<=1,'Pilot filter group aligns with the full search-field width');
      check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1&&[root,sidebar,originalNodes.stage].every(node=>node.scrollWidth<=node.clientWidth+1),'Pilot memory reading view has no horizontal overflow');
      const style=getComputedStyle(root),sidebarBounds=sidebar.getBoundingClientRect();
      if(innerWidth>1100)check(style.display==='grid'&&Math.abs(parseFloat(style.gridTemplateColumns)-320)<=1&&Math.abs(sidebarBounds.width-320)<=1,'Desktop memory uses the approved 320px shared sidebar');
      else if(innerWidth>800)check(style.display==='grid'&&Math.abs(parseFloat(style.gridTemplateColumns)-320)<=1&&Math.abs(sidebarBounds.width-320)<=1,'Compact memory uses the 320px shared sidebar');
      else check(style.display==='flex'&&style.flexDirection==='column'&&Math.abs(sidebarBounds.width-root.clientWidth)<=1,'Narrow memory stacks the full-width shared sidebar');
      originalNodes.newDecision.click();await new Promise(resolve=>requestAnimationFrame(resolve));
      check([root,originalNodes.capture,$('.next-memory-capture-fields')].every(node=>node.scrollWidth<=node.clientWidth+1),'Pilot capture view fits its available width without horizontal overflow');
      const captureStyle=getComputedStyle(originalNodes.capture);
      if(innerWidth<=800)check(captureStyle.overflowY==='visible'&&captureStyle.overscrollBehaviorY==='auto','Narrow capture lets the containing page scroll instead of trapping wheel or touch input');
      else{
        const captureBounds=originalNodes.capture.getBoundingClientRect(),footerBounds=$('.decision-memory-footer').getBoundingClientRect();
        check(captureStyle.gridRowStart==='2'&&captureBounds.bottom<=footerBounds.top+1,'Desktop and compact capture stay in the content row without overlapping the footer');
      }
      $('[data-memory-back]').click();
    }
    else check(!$('.foundry-memory-interior')&&!$('[data-memory-back]')&&originalNodes.capture.parentElement.matches('.decision-memory-shell'),'Gate off keeps the capture rail and introduces no pilot controls');
    $('#test-results').textContent='PASS: '+checks.length+' isolated assertions';$('#test-results').dataset.result='pass';$('#test-details').textContent=checks.map((item,i)=>(i+1)+'. '+item).join(String.fromCharCode(10));$('#fixture-action').textContent='Synthetic project guidance and command acknowledgements only. No live session, Review mutation, source change or provider.';
  }catch(error){$('#test-results').textContent='FAIL: '+error.message;$('#test-results').dataset.result='fail';$('#test-details').textContent=error.stack;console.error(error);}
}
$('#fixture-rerun').addEventListener('click',runAssertions);await runAssertions();
`;
const diagnostics = `window.addEventListener('error',event=>{document.querySelector('#fixture-errors').textContent+=(event.error?.stack||event.message||'Resource failed')+'\\n';},true);window.addEventListener('unhandledrejection',event=>{document.querySelector('#fixture-errors').textContent+=String(event.reason?.stack||event.reason)+'\\n';});`;
const states = [
  'approved',
  'rejected',
  'rule',
  'disabled',
  'evidence',
  'conflict',
  'empty',
  'no-selection',
  'offline',
  'error',
];
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Foundry Design Memory — isolated pilot fixture</title><script>${diagnostics}</script><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/next-workspace.css"><link rel="stylesheet" href="/foundry-pilot.css"><style>
html,body{margin:0;height:100%;overflow:hidden}body{display:flex;flex-direction:column}.fixture-toolbar{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 16px;background:#e9edf5;color:#17243d;font:12px/18px Arial,sans-serif;border-bottom:1px solid #b8c3d5}.fixture-toolbar button{border:1px solid #8a9bb8;border-radius:4px;padding:4px 8px;background:white;color:#17243d;font:12px/18px Arial,sans-serif}.fixture-toolbar button[aria-pressed=true]{background:#17243d;color:white}.fixture-toolbar pre{position:absolute;z-index:100;max-width:calc(100vw - 32px);max-height:50vh;overflow:auto;padding:16px;margin:8px 0;background:white;color:#17243d;border:1px solid #8a9bb8;white-space:pre-wrap}#app-shell.app-shell[data-next]{display:block;flex:1 1 auto;min-height:0;width:100%;height:auto}#app-shell>[data-mode-surface=memory]{height:100%;min-height:0}[data-result=fail]{color:#ae1b1b}
</style></head><body><header class="fixture-toolbar" aria-label="Isolated test controls"><strong>Design Memory fixture · synthetic data</strong><span id="fixture-state">Synthetic state</span><nav aria-label="Fixture states">${states.map((state) => `<button type="button" data-fixture-state="${state}" aria-pressed="false">${state}</button>`).join(' ')}</nav><button id="fixture-theme">Toggle UI theme</button><button id="fixture-rerun">Run checks again</button><button id="undo">Undo synthetic adapter change</button><a href="/?foundations=off&theme=light">Previous design</a><a href="/?theme=light">Default design</a><a href="/?foundations=pilot&theme=light">Pilot alias</a><details><summary id="test-results">Running isolated assertions</summary><pre id="test-details"></pre></details><details><summary>Runtime errors</summary><pre id="fixture-errors"></pre></details><span role="status" id="fixture-action">No live Foundry session.</span></header><div id="app-shell" class="app-shell" data-next="true" data-mode="memory">${markup}</div><script type="module">${script}</script></body></html>`;
if (process.argv.includes('--check')) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: diagnostics + script,
    encoding: 'utf8',
  });
  if (result.status !== 0) process.stderr.write(result.stderr || String(result.error));
  else console.log('Design Memory fixture extraction and module syntax: PASS');
  process.exit(result.status ?? 1);
}
const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const port = Number(process.env.FOUNDRY_MEMORY_FIXTURE_PORT ?? 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid fixture port');
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  response.setHeader('Cache-Control', 'no-store');
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
  console.log(
    'Isolated Design Memory pilot fixture: http://127.0.0.1:' +
      server.address().port +
      '/?foundations=pilot&theme=light',
  );
  console.log('Synthetic data and transport only. No live Foundry session or provider.');
});
