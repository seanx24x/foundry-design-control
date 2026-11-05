// Isolated Design Branches harness: original markup, renderer, selects and actions.
// Records, iframe contents and all transport are synthetic; no live session is used.
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'apps/inspector/dist');
const source = await readFile(resolve(root, 'apps/inspector/public/app.js'), 'utf8');
const index = await readFile(resolve(root, 'apps/inspector/public/index.html'), 'utf8');
function between(text, start, end) {
  const first = text.indexOf(start);
  const last = text.indexOf(end, first + start.length);
  if (first < 0 || last <= first) throw Error(`Fixture source boundary missing: ${start}`);
  return text.slice(first, last);
}
const surface = index.indexOf('data-mode-surface="branches"');
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
if (surface < 0 || start < 0 || end <= surface) throw Error('Design Branches markup not found');
const markup = index.slice(start, end).replace(/\s+hidden\s*>/, '>');
const renderer = between(source, 'function designBranchDirections()', 'function editableTarget(');
const selects = between(source, 'function closeCustomSelect(', 'function escapeText(');
const format = between(source, 'function formatValue(', 'function renderLayers(');
const contexts = between(source, 'function changeContextSet(', 'function changeContextSummary(');

const script = `
import { foundryFoundationsEnabled } from '/foundry-foundations.js';
import { createNextDesignBranches as createRealDesignBranches, branchComparisonDirections, branchPreviewKey, branchPreviewScale, branchReviewableChanges } from '/next-design-branches.js';
import { mountFoundryPilot, refinePilotIcons } from '/foundry-pilot.js';
import { foundryPilotIcon } from '/foundry-pilot-icons.js';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escapeText=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const escapeAttribute=value=>escapeText(value).replaceAll('"','&quot;');
const params=new URLSearchParams(location.search);params.set('ui','next');
const pilot=foundryFoundationsEnabled();
const sessionId='isolated-fixture';
let nextDesignBranches, originalNodes, branchCompareLeft='main', branchCompareRight='main';
let designBranchPreviewRenderKey='', bridgeConnected=true, previewFailure=false, failNextSave=false, nextId=1;
let previewUrl=location.origin+'/preview';
const designBranchFrames=new Map(), branchFrameTimers=new Map(), branchDecisionSelection=new Set();
let activeSession={changeSet:{changes:[],operations:[]},designBranches:[],designBranchRecords:[]};
let openCustomSelect=null, inspectorRenderDeferred=false, workshopRenderDeferred=false, ignoreSelectScrollUntil=0, selectId=0;
const NEXT_ICON_SCOPE='[data-next-icon-scope]';
const ICONS={check:'check',chevronDown:'chevronDown'};
const iconSvg=name=>foundryPilotIcon(name);
const refineNextIcons=root=>refinePilotIcons(root);
const renderInspector=()=>{}, renderComponentWorkshop=()=>{};
const calls=[];
const selectedViewport=()=>({width:1440,height:900});
const toast=message=>$('#fixture-action').textContent='Synthetic only: '+message;
const setMode=mode=>{calls.push({type:'navigate',mode});toast(mode+' navigation simulated.');};
function renderIcons(root=document){for(const item of $$('[data-icon]',root)){const svg=foundryPilotIcon(item.dataset.icon);if(svg)item.outerHTML=svg;}refinePilotIcons(root);}
function renderSession(value){activeSession=value;renderDesignBranches();}
function invalidateFrameTransport(frame,reason){calls.push({type:'invalidate',direction:frame.closest('article')?.dataset.directionId,reason});}
async function requestFrameCommand(frame,command,payload){
  calls.push({type:'frame-command',direction:frame.closest('article')?.dataset.directionId,command,payload});
  await Promise.resolve();
  if(command==='preview-design-branch'){
    if(previewFailure)return {switched:false};
    frame.contentWindow?.postMessage({type:'fixture:preview',changes:payload.changes},location.origin);
  }
  return {switched:true};
}
async function requestCommand(command,payload){calls.push({type:'command',command,payload});await Promise.resolve();return {switched:true};}
async function runDurableAction(action,payload){calls.push({type:'durable',action,payload});toast('Memory save simulated; no live record created.');}
function createNextDesignBranches(root){
  originalNodes={name:$('#design-branch-name'),create:$('#design-branch-create'),left:$('#design-branch-left'),right:$('#design-branch-right'),promote:$('#design-branch-promote'),combine:$('#design-branch-compose'),stage:$('.design-branch-stage'),detail:$('#design-branch-detail'),list:$('#design-branch-list'),records:$('.design-branch-records'),import:$('#design-branch-record-import'),export:$('#design-branch-record-export'),file:$('#design-branch-record-file')};
  return createRealDesignBranches(root);
}
${selects}
${format}
${contexts}
${renderer}

// The isolated preview is a synthetic document. This fixture-only signal feeds
// the real renderer's load/readiness gate; it is not production authentication.
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data?.type!=='fixture:ready')return;
  const frame=[...designBranchFrames.values()].find(item=>item.contentWindow===event.source);
  if(!frame)return;frame.dataset.branchReady='true';syncNextBranchFrame(frame,designBranchById(frame.closest('article').dataset.directionId));
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeCustomSelect();});
const target={id:'headline',label:'Make room for the work that matters.',source:{file:'fixture.html',line:43},locator:{selector:'#headline'}};
function change(id,property,before,after){return {id,target:structuredClone(target),property,before,after,unit:property==='fontSize'||property==='letterSpacing'?'px':'',scope:'instance',status:'draft',context:{breakpoint:'desktop',theme:'light',state:'default'}};}
function direction(id,name,changes,status='exploring'){return {id,name,status,changes,rejectionReason:'',operations:[]};}
function record(id,status){return {id,name:status==='current'?'A calmer signup flow':'Earlier editorial exploration',outcome:'chosen',changes:[change('record-font','fontSize',76,80)],rationale:'Keep the form readable while giving the product introduction a clearer entry point.',compatibility:{status,matchedSources:status==='current'?1:0,totalSources:1,warnings:status==='current'?[]:['The saved source revision no longer matches. Review the mapping before restoring.']}};}
function showScenario(state){
  closeCustomSelect({restoreFocus:false});destroyNextBranchPreviews();branchDecisionSelection.clear();
  bridgeConnected=state!=='offline';previewFailure=state==='offline';previewUrl=location.origin+'/preview';
  activeSession={changeSet:{changes:[],operations:[]},designBranches:[],designBranchRecords:[]};
  branchCompareLeft='main';branchCompareRight='main';
  if(state!=='main'){
    const a=direction('editorial','Editorial rhythm',[change('font-a','fontSize',76,80),change('spacing-a','letterSpacing',-2,-1.5)]);
    const b=direction('compact','Compact and focused',[change('font-b','fontSize',76,72),change('line-b','lineHeight',1.06,1.12)]);
    activeSession.designBranches=[a,b];activeSession.activeDesignBranchId=a.id;branchCompareLeft=a.id;branchCompareRight=b.id;
    if(state==='empty'){a.changes=[];branchCompareLeft='main';branchCompareRight=a.id;}
    if(state==='terminal'){a.changes[0].status='applied';a.changes[1].status='rejected';}
    if(state==='records')activeSession.designBranchRecords=[record('current-record','current'),record('stale-record','stale')];
  }
  originalNodes?.name && (originalNodes.name.value='');
  renderDesignBranches();$('#fixture-state').textContent='Synthetic state: '+state;
  $$('[data-fixture-state]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fixtureState===state)));
}
async function api(url,options){
  const body=JSON.parse(options?.body||'{}');calls.push({type:'api',url,body,method:options?.method??'GET'});
  await Promise.resolve();if(failNextSave){failNextSave=false;throw Error('Synthetic save failed.');}
  const updated=structuredClone(activeSession);
  if(!options)return updated;
  if(url.endsWith('/design-branches/activate'))updated.activeDesignBranchId=body.branchId;
  else if(url.endsWith('/design-branches')){
    const changes=body.selections?body.selections.flatMap(selection=>updated.designBranches.find(item=>item.id===selection.branchId).changes.filter(item=>selection.changeIds.includes(item.id))):body.sourceBranchId?updated.designBranches.find(item=>item.id===body.sourceBranchId).changes:updated.changeSet.changes;
    const item=direction('created-'+(++nextId),body.name,structuredClone(changes));updated.designBranches.push(item);updated.activeDesignBranchId=item.id;
  }else if(url.endsWith('/promote')){
    const item=updated.designBranches.find(item=>item.id===url.split('/').at(-2));updated.changeSet.changes=structuredClone(branchReviewableChanges(item));item.status='chosen';delete updated.activeDesignBranchId;
  }else if(url.endsWith('/restore')){
    const saved=updated.designBranchRecords.find(item=>item.id===url.split('/').at(-2));if(saved.compatibility.status!=='current')throw Error('Synthetic stale record blocked.');
    const item=direction('restored-'+(++nextId),saved.name,structuredClone(saved.changes));updated.designBranches.push(item);updated.activeDesignBranchId=item.id;
  }else if(url.includes('/design-branch-records/'))updated.designBranchRecords=updated.designBranchRecords.filter(item=>item.id!==url.split('/').at(-1));
  else if(url.endsWith('/design-branch-records'))updated.designBranchRecords.push(...body.records);
  else if(options.method==='PATCH')Object.assign(updated.designBranches.find(item=>item.id===url.split('/').at(-1)),body);
  return updated;
}
const settle=async()=>{for(let i=0;i<32;i++)await Promise.resolve();};
const waitFor=async(predicate,label)=>{const deadline=performance.now()+6000;while(!predicate()){if(performance.now()>deadline)throw Error(label);await new Promise(resolve=>requestAnimationFrame(resolve));}};
const framesReady=()=>$$('[data-design-branch-frame]').length>0&&$$('.design-branch-preview-card').every(card=>card.dataset.previewConnection==='live');
const changeSelect=(id,value)=>{const select=$(id);select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));};
$$('[data-fixture-state]').forEach(button=>button.addEventListener('click',()=>showScenario(button.dataset.fixtureState)));
$('#fixture-theme').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';});
mountFoundryPilot();renderDesignBranches();
async function runAssertions(){
  const checks=[],check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
  try{
    showScenario('main');
    check($('#design-branch-promote').disabled,'Main is already collected in Review and cannot promote itself');
    check($$('.design-branch-preview-card').length===1,'Same-direction comparison renders one preview');
    check($('.next-branch-comparison-help').textContent.includes('Create a direction'),'Main-only state explains how to start comparing');
    check($('#design-branch-compose').disabled,'No selected decisions keeps Combine disabled');
    check($('.next-branch-footer').textContent.includes('not Git branches')&&$('.next-branch-footer').textContent.includes('reviewed Apply'),'Directions remain distinct from Git and source Apply');
    check(Boolean($('.foundry-branches-interior'))===pilot,'Branch pilot presentation follows the explicit gate');
    showScenario('empty');check($('#design-branch-promote').disabled&&!$('#next-branch-promote-help').hidden,'Empty alternative explains why it cannot enter Review');
    if(pilot)check(!$('#next-branch-promote-help').closest('details'),'Empty-direction eligibility explanation remains outside collapsed editing details');
    showScenario('terminal');check($('#design-branch-promote').disabled,'Terminal-only direction cannot enter Review');
    const terminalCalls=calls.length;$('#design-branch-promote').click();await settle();check(calls.length===terminalCalls,'Disabled promotion sends no simulated transaction');
    showScenario('compare');
    check(!$('#design-branch-promote').disabled,'A saved alternative retains its original Review eligibility');
    await waitFor(framesReady,'Synthetic comparison did not become ready');
    check($$('.design-branch-preview-card').every(card=>card.querySelector('.branch-status').textContent==='Preview ready'),'Ready labels follow simulated frame acknowledgements');
    const frameCalls=calls.filter(item=>item.type==='frame-command');
    check(frameCalls.some(item=>item.command==='preview-design-branch')&&frameCalls.some(item=>item.command==='set-mode'&&item.payload.mode==='interact'),'Original frame renderer requests direction preview then non-editing mode');
    const frames=$$('[data-design-branch-frame]'),initialKey=designBranchPreviewRenderKey;
    activeSession.designBranches[0].rejectionReason='Saved note only';renderDesignBranches();
    check($$('[data-design-branch-frame]').every((frame,index)=>frame===frames[index])&&designBranchPreviewRenderKey===initialKey,'Irrelevant session refresh preserves iframe identity');
    const beforeCompare=calls.length,activeBefore=activeSession.activeDesignBranchId;
    changeSelect('#design-branch-left','main');
    check(activeSession.activeDesignBranchId===activeBefore&&!calls.slice(beforeCompare).some(item=>item.type==='api'||item.type==='command'),'Comparison selectors do not activate a direction or change Review');
    check($('#design-branch-left').value==='main'&&$('#design-branch-right').value==='compact','Comparison selection is independently represented');
    changeSelect('#design-branch-left','compact');check($$('.design-branch-preview-card').length===1,'Identical comparison choices keep one frame');
    changeSelect('#design-branch-left','editorial');
    check($$('.design-branch-preview-card').length===2,'Distinct comparison choices restore two previews');
    if(pilot){
      const management=$('.foundry-branches-management'),summary=management.querySelector('summary');
      check(management.parentElement===originalNodes.stage&&originalNodes.detail.parentElement===management,'Active direction details reuse the original node below comparison decisions');
      check(!management.open&&summary.tabIndex===0,'Editing details start collapsed with native keyboard semantics');
      check($('.foundry-branches-editing').textContent==='Editing: Editorial rhythm','Heading identifies the active editing direction independently of comparison');
      management.open=true;summary.focus();renderDesignBranches();
      check($('.foundry-branches-management')===management&&management.open&&document.activeElement===summary,'Editing disclosure identity, expansion and focus survive refresh');
    }
    const note=$('#design-branch-note');note.value='Keep this unsaved direction note';note.focus();note.setSelectionRange(5,9);renderDesignBranches();
    check($('#design-branch-note').value==='Keep this unsaved direction note','Direction note draft survives renderer replacement');
    check(document.activeElement===$('#design-branch-note')&&$('#design-branch-note').selectionStart===5&&$('#design-branch-note').selectionEnd===9,'Direction note focus and selection survive same-direction refresh');
    const draftName='An unsaved new direction';originalNodes.name.value=draftName;renderDesignBranches();check(originalNodes.name.value===draftName,'Create-direction draft survives unrelated refresh');
    const disclosures=$('.next-branch-records');disclosures.open=true;renderDesignBranches();check($('.next-branch-records')===disclosures&&disclosures.open,'Saved-decision disclosure identity and expansion survive refresh');
    check(disclosures.querySelector('summary').tabIndex===0,'Saved-decision disclosure keeps native keyboard semantics');
    const a=$('[data-branch-decision="editorial:font-a"]'),b=$('[data-branch-decision="compact:font-b"]');a.click();b.click();
    check(!a.checked&&b.checked&&branchDecisionSelection.size===1,'Conflicting decisions remain mutually exclusive');
    $('[data-branch-decision="editorial:spacing-a"]').click();check(branchDecisionSelection.size===2&&!$('#design-branch-compose').disabled,'Distinct decisions can be selected together');
    renderDesignBranches();check($('[data-branch-decision="compact:font-b"]').checked&&$('[data-branch-decision="editorial:spacing-a"]').checked,'Decision selection survives unchanged rerender');
    changeSelect('#design-branch-right','main');check(!branchDecisionSelection.has('compact:font-b')&&branchDecisionSelection.size===1,'Leaving a compared direction prunes stale selections');
    changeSelect('#design-branch-right','compact');$('[data-branch-decision="compact:font-b"]').click();
    const combinedBefore=calls.length;$('#design-branch-compose').click();await settle();
    check(activeDesignDirection().name==='Combined direction'&&activeDesignDirection().changes.length===2,'Original Combine creates one synthetic alternative from chosen decisions');
    check(activeSession.changeSet.changes.length===0&&branchDecisionSelection.size===0,'Combining remains separate from Review and clears its selection');
    check(calls.slice(combinedBefore).some(item=>item.body?.selections?.length===2),'Combine dispatches explicit source direction/change selections');
    const savedDraft=$('#design-branch-note');savedDraft.value='Saved rationale';$('[data-branch-action="save-note"]').click();await settle();
    check(activeDesignDirection().rejectionReason==='Saved rationale','Original save-note action persists only simulated direction metadata');
    const promotedBefore=calls.length;$('#design-branch-promote').click();await settle();
    check(activeSession.changeSet.changes.length===2&&calls.slice(promotedBefore).some(item=>item.type==='navigate'&&item.mode==='review'),'Original promotion routes the synthetic direction to Review');
    check(!calls.some(item=>item.command?.includes('apply')||item.url?.includes('/apply')),'No source Apply or provider transaction is invoked');
    showScenario('compare');const newBefore=calls.length;originalNodes.name.value='A deliberate alternative';originalNodes.create.click();await settle();
    check(activeDesignDirection().name==='A deliberate alternative'&&originalNodes.name.value==='','Create direction preserves its original callback and clears only on acknowledgement');
    check(calls.slice(newBefore).some(item=>item.body?.sourceBranchId==='editorial'),'Creation explicitly copies the active direction');
    showScenario('compare');originalNodes.name.value='Keep failed creation';failNextSave=true;originalNodes.create.click();await settle();check(originalNodes.name.value==='Keep failed creation','Failed creation preserves the user draft');
    showScenario('records');$('.next-branch-records').open=true;
    check(!$('[data-restore-branch-record="current-record"]').disabled&&$('[data-restore-branch-record="stale-record"]').disabled,'Current and stale records retain distinct restore eligibility');
    check($('[data-compatibility="stale"]').textContent.includes('no longer matches'),'Stale records expose the actual compatibility warning');
    const staleBefore=calls.length;$('[data-restore-branch-record="stale-record"]').click();await settle();check(calls.length===staleBefore,'Disabled stale restore invokes no transaction');
    $('[data-restore-branch-record="current-record"]').click();await settle();check(activeDesignDirection().name==='A calmer signup flow','Original restore creates a simulated direction without applying source');
    showScenario('offline');await waitFor(()=>$$('.next-branch-preview-error').length===2,'Synthetic failed preview did not expose recovery');
    check($$('[data-design-branch-frame]').every(frame=>frame.style.visibility==='hidden'),'Unacknowledged previews hide stale pixels');
    check($$('.branch-status[data-status="offline"]').length===2&&$('.next-branch-preview-error').textContent.includes('Reload previews'),'Failed previews expose explicit reload guidance');
    const oldFailedFrames=$$('[data-design-branch-frame]');previewFailure=false;bridgeConnected=true;$('#next-branch-refresh').click();await waitFor(framesReady,'Reloaded synthetic previews did not become ready');
    check($$('[data-design-branch-frame]').every(frame=>!oldFailedFrames.includes(frame))&&!$('.next-branch-preview-error'),'Reload replaces failed frames and clears obsolete errors');
    const reloaded=$('[data-design-branch-frame]');reloaded.dispatchEvent(new Event('load'));
    check(reloaded.dataset.branchFailed==='true'&&reloaded.style.visibility==='hidden','Unexpected frame reload invalidates the previous acknowledgement');
    showScenario('compare');await waitFor(framesReady,'Final fixture previews did not become ready');
    for(let i=0;i<5;i++)renderDesignBranches();
    for(const [name,selector] of Object.entries({name:'#design-branch-name',create:'#design-branch-create',left:'#design-branch-left',right:'#design-branch-right',promote:'#design-branch-promote',combine:'#design-branch-compose',stage:'.design-branch-stage',detail:'#design-branch-detail',list:'#design-branch-list',records:'.design-branch-records',import:'#design-branch-record-import',export:'#design-branch-record-export',file:'#design-branch-record-file'}))check($(selector)===originalNodes[name],name+' original node survives repeated rendering');
    check($$('.next-branch-records').length===1&&$$('.next-branch-detail-heading').length===1&&$$('#next-branch-refresh').length===1,'Repeated rendering creates no duplicate disclosures, headings or controls');
    if(pilot){const management=$('.foundry-branches-management');management.open=false;renderDesignBranches();check(!management.open&&$$('.foundry-branches-management').length===1,'Editing disclosure stays collapsed and unique after repeated refresh');}
    if(!pilot)check(originalNodes.detail.parentElement.matches('.design-branches-shell'),'Gate off retains the original detail rail placement');
    // Assert the rendered upgraded controls at this viewport, not hidden native selects.
    // Rerun after resizing to exercise the actual compact/stacked layout breakpoints.
    if(pilot){
      await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const root=$('.foundry-branches-interior'),sidebar=$('.design-branch-browser'),stage=originalNodes.stage;
      const triggers=$$('.design-branch-compare-selects .foundry-select-trigger');
      check(triggers.length===2&&triggers.every(trigger=>trigger.getBoundingClientRect().width>=120&&trigger.getBoundingClientRect().height>0),'Upgraded comparison triggers retain at least 120px usable width at the current viewport');
      check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1&&[root,sidebar,stage].every(node=>node.scrollWidth<=node.clientWidth+1),'Pilot page, sidebar and comparison stage have no horizontal overflow');
      const rootStyle=getComputedStyle(root),sidebarBounds=sidebar.getBoundingClientRect(),stageBounds=stage.getBoundingClientRect();
      if(innerWidth>1100){
        check(rootStyle.display==='grid'&&Math.abs(parseFloat(rootStyle.gridTemplateColumns)-320)<=1&&Math.abs(sidebarBounds.width-320)<=1,'Desktop root grid and original sidebar use the approved 320px column');
      }else if(innerWidth>800){
        check(rootStyle.display==='grid'&&Math.abs(parseFloat(rootStyle.gridTemplateColumns)-320)<=1&&Math.abs(sidebarBounds.width-320)<=1,'Compact root grid and original sidebar use the 320px column');
      }else{
        check(rootStyle.display==='flex'&&rootStyle.flexDirection==='column'&&Math.abs(sidebarBounds.width-root.clientWidth)<=1&&stageBounds.top>=sidebarBounds.bottom-1,'Narrow layout stacks the full-width sidebar above the comparison stage');
      }
    }else check(!$('.foundry-branches-interior')&&!$('.foundry-branches-management'),'Gate off does not adopt pilot grid or editing wrappers');
    $('#test-results').textContent='PASS: '+checks.length+' isolated assertions';$('#test-results').dataset.result='pass';$('#test-details').textContent=checks.map((item,i)=>(i+1)+'. '+item).join(String.fromCharCode(10));$('#fixture-action').textContent='Synthetic directions, previews and transport only. No live session, Review, provider or source changes.';
  }catch(error){$('#test-results').textContent='FAIL: '+error.message;$('#test-results').dataset.result='fail';$('#test-details').textContent=error.stack;console.error(error);}
}
$('#fixture-rerun').addEventListener('click',runAssertions);await runAssertions();
`;
const diagnostics = `window.addEventListener('error',event=>{document.querySelector('#fixture-errors').textContent+=(event.error?.stack||event.message||'Resource failed')+'\\n';},true);window.addEventListener('unhandledrejection',event=>{document.querySelector('#fixture-errors').textContent+=String(event.reason?.stack||event.reason)+'\\n';});`;
const states = ['main', 'compare', 'empty', 'terminal', 'records', 'offline'];
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Foundry Design Branches — isolated pilot fixture</title><script>${diagnostics}</script><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/next-workspace.css"><link rel="stylesheet" href="/foundry-pilot.css"><style>
html,body{margin:0;height:100%;overflow:hidden}body{display:flex;flex-direction:column}.fixture-toolbar{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 16px;background:#e9edf5;color:#17243d;font:12px/18px Arial,sans-serif;border-bottom:1px solid #b8c3d5}.fixture-toolbar button{border:1px solid #8a9bb8;border-radius:4px;padding:4px 8px;background:white;color:#17243d;font:12px/18px Arial,sans-serif}.fixture-toolbar button[aria-pressed=true]{background:#17243d;color:white}.fixture-toolbar pre{position:absolute;z-index:100;max-width:calc(100vw - 32px);max-height:50vh;overflow:auto;padding:16px;margin:8px 0;background:white;color:#17243d;border:1px solid #8a9bb8;white-space:pre-wrap}#app-shell.app-shell[data-next]{display:block;flex:1 1 auto;min-height:0;width:100%;height:auto}#app-shell>[data-mode-surface=branches]{height:100%;min-height:0}[data-result=fail]{color:#ae1b1b}
</style></head><body><header class="fixture-toolbar" aria-label="Isolated test controls"><strong>Design Branches fixture · synthetic data</strong><span id="fixture-state">Synthetic state</span><nav aria-label="Fixture states">${states.map((state) => `<button type="button" data-fixture-state="${state}" aria-pressed="false">${state}</button>`).join(' ')}</nav><button id="fixture-theme">Toggle UI theme</button><button id="fixture-rerun">Run checks again</button><a href="/?foundations=off&theme=light">Previous design</a><a href="/?theme=light">Default design</a><a href="/?foundations=pilot&theme=light">Pilot alias</a><details><summary id="test-results">Running isolated assertions</summary><pre id="test-details"></pre></details><details><summary>Runtime errors</summary><pre id="fixture-errors"></pre></details><span role="status" id="fixture-action">No live Foundry session.</span></header><div id="app-shell" class="app-shell" data-next="true" data-mode="branches">${markup}</div><script type="module">${script}</script></body></html>`;
const preview = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Geist;src:url('/assets/foundry-pilot/Geist-Regular.woff2')}*{box-sizing:border-box}html,body{margin:0;background:#f2f3ee;color:#203b32;font-family:Geist,Arial,sans-serif}body{padding:52px 64px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #c8d0c6;padding-bottom:26px;font-size:24px}header small{font-size:16px;color:#68746b}main{display:grid;grid-template-columns:1.15fr 1fr;gap:90px;padding-top:82px}h1{font-size:76px;line-height:1.06;letter-spacing:-2px;margin:20px 0 28px;font-weight:600}p{font-size:23px;line-height:1.5;color:#68746b}.form{background:white;border:1px solid #d6ddd4;border-radius:16px;padding:42px;margin-top:0}h2{font-size:34px;margin:0 0 15px}.field{font-size:18px;border:1px solid #d0d7cf;border-radius:7px;padding:18px;margin-top:22px;color:#7b877c}.button{margin-top:30px;padding:20px;background:#245c4c;color:white;border-radius:7px;font-size:19px}label{font-size:18px}.note{margin-top:45px;padding:25px;background:#e4ebe0;border-radius:12px;font-size:19px}</style></head><body><header><strong>Morrow</strong><small>Isolated preview fixture</small></header><main><section><label>A workspace for ideas in progress</label><h1 id="headline">Make room for the work that matters.</h1><p>Bring briefs, feedback, and decisions into one calm place your whole team can shape.</p><div class="note">A quieter way to bring the launch together.</div></section><section class="form"><h2>Create your workspace</h2><p>No credit card. Set up takes less than a minute.</p><div class="field">Full name</div><div class="field">Work email</div><div class="field">Password</div><div class="button">Create workspace</div></section></main><script>window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='fixture:preview')return;const h=document.querySelector('#headline');for(const change of event.data.changes??[]){if(['fontSize','letterSpacing','lineHeight'].includes(change.property))h.style[change.property]=String(change.after)+(change.unit||'');}});parent.postMessage({type:'fixture:ready'},location.origin);</script></body></html>`;

if (process.argv.includes('--check')) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: diagnostics + script,
    encoding: 'utf8',
  });
  if (result.status !== 0) process.stderr.write(result.stderr || String(result.error));
  else console.log('Design Branches fixture extraction and module syntax: PASS');
  process.exit(result.status ?? 1);
}
const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const port = Number(process.env.FOUNDRY_BRANCHES_FIXTURE_PORT ?? 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid fixture port');
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/preview') {
    response.setHeader('Content-Type', 'text/html');
    response.end(
      preview.replace('/assets/foundry-pilot/Geist-Regular.woff2', '/fonts/geist-sans.woff2'),
    );
    return;
  }
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
    'Isolated Design Branches pilot fixture: http://127.0.0.1:' +
      server.address().port +
      '/?foundations=pilot&theme=light',
  );
  console.log(
    'Synthetic directions, iframe contents and transport only. No live Foundry session or provider.',
  );
});
