// Isolated Delivery fixture. Real renderer, notes, evidence UI and callbacks;
// synthetic records and transport only. No live session, source Apply or export.
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname, '..'),
  publicDir = resolve(root, 'apps/inspector/dist');
const source = await readFile(resolve(root, 'apps/inspector/public/app.js'), 'utf8');
const index = await readFile(resolve(root, 'apps/inspector/public/index.html'), 'utf8');
const stylesheets = [...index.matchAll(/<link\s+rel="stylesheet"\s+href="[^"]+"\s*\/?>/g)]
  .map((match) => match[0])
  .join('');
function between(text, start, end) {
  const first = text.indexOf(start),
    last = text.indexOf(end, first + start.length);
  if (first < 0 || last <= first) throw Error('Missing fixture boundary: ' + start);
  return text.slice(first, last);
}
const surface = index.indexOf('data-mode-surface="delivery"'),
  start = index.lastIndexOf('<section', surface);
let depth = 0,
  end = -1;
for (const match of index.slice(start).matchAll(/<\/?section\b[^>]*>/g)) {
  depth += match[0].startsWith('</') ? -1 : 1;
  if (!depth) {
    end = start + match.index + match[0].length;
    break;
  }
}
if (surface < 0 || start < 0 || end <= surface) throw Error('Delivery markup not found');
const markup = index.slice(start, end).replace(/\s+hidden\s*>/, '>');
const dialogStart = index.lastIndexOf('<dialog', index.indexOf('id="delivery-milestone-dialog"'));
const dialog = index.slice(dialogStart, index.indexOf('</dialog>', dialogStart) + 9);
const renderer = between(
  source,
  'function deliveryStatusLabel(',
  'function visualRecipeTargetSuggestions(',
);
const connectionRenderer = between(
  source,
  'function renderConnectionStatus(',
  'async function api(',
);
const bindings = between(
  source,
  "\n$$('[data-delivery-tab]').forEach",
  "$('#design-system-search').addEventListener",
);
const handoffSelection = between(
  source,
  'function deliveryHandoffSelection(',
  'function openVerifiedDeliveryHandoff(',
);
const sourceText = between(source, 'function sourceText(', 'function workshopVariantDrift(');
const verificationLabel = between(
  source,
  'function verificationContextLabel(',
  'function runStageIndex(',
);
const evidenceSetup = between(
  source,
  'const deliveryEvidenceUI = createDeliveryEvidenceUI(',
  'let comparisonMode',
);
const script = `
import { foundryFoundationsEnabled } from '/foundry-foundations.js';
import { createNextDelivery as createRealDelivery,deliveryShellArgument } from '/next-delivery.js';
import { engineeringEvidence,deliveryNarrativeReadOnly } from '/workflow.js';
import { createDeliveryEvidenceUI } from '/delivery-evidence-ui.js';
import { mountFoundryPilot,refinePilotIcons,foundryPilotActive } from '/foundry-pilot.js';
import { foundryPilotIcon } from '/foundry-pilot-icons.js';
import { pilotConnectionHeadline } from '/foundry-pilot-readiness.js';
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escapeText=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),escapeAttribute=value=>escapeText(value).replaceAll('"','&quot;');
const params=new URLSearchParams(location.search);params.set('ui','next');const pilot=foundryFoundationsEnabled(),sessionId='isolated-fixture',activeMode='delivery';
const nextWorkspace=null,readinessUI=null,nextDesignMemory=null,bridgeConnected=true,previewUrl='http://127.0.0.1/isolated-preview',lastSessionLoadError='',activeAgentPresence={connected:false};
const syncPilotHeartbeatRecovery=()=>{};
let nextDelivery,originalNodes,runtimeConnected=true,deliveryTab='handoff',deliveryRecordId='',deliveryDocumentId='',deliveryGenerating=false,deliveryActionError='';
let verifiedDeliverySelection=null;
let visualCheckReports=[],visualCheckReportId='',visualChecksStatus='loaded',visualChecksError='',fixtureReports=[];
let failNext=false,holdNext=false,releaseHeld,failImage=false,failReports=false,nextId=1,fixtureRunning=false;
let activeSession={deliveryRecords:[],documentationPages:[],designHistory:[],deliveryMilestones:[],applyRuns:[],changeSet:{context:{projectRoot:'/synthetic/Foundry project'},changes:[]}};
const calls=[],toast=message=>$('#fixture-action').textContent='Synthetic only: '+message,setMode=mode=>calls.push({type:'navigate',mode});
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{calls.push({type:'clipboard',text});}}});
function renderSession(value){activeSession=value;renderDelivery();}
function renderIcons(root=document){for(const item of $$('[data-icon]',root)){const svg=foundryPilotIcon(item.dataset.icon);if(svg)item.outerHTML=svg;}refinePilotIcons(root);}
function createNextDelivery(root,callbacks){originalNodes={root,content:$('#delivery-content'),shell:$('.delivery-shell'),tabs:$('.delivery-tabs'),generate:$('#delivery-generate-docs'),export:$('#delivery-export'),dialog:$('#delivery-milestone-dialog'),form:$('#delivery-milestone-form'),name:$('#delivery-milestone-name')};return createRealDelivery(root,callbacks);}
${sourceText}
${verificationLabel}
${evidenceSetup}
${handoffSelection}
${renderer}
${connectionRenderer}
${bindings}

const context={breakpoint:'desktop',theme:'light',state:'default'};
const target={id:'headline',label:'Product introduction headline',platform:'web',source:{file:'fixture.html',line:43},locator:{selector:'#headline'}};
function change(){return {id:'font-change',target:structuredClone(target),property:'fontSize',before:76,after:80,unit:'px',createdAt:'2026-10-31T10:00:00Z',context:structuredClone(context)};}
function record(id='ready',status='ready'){
 const verified=status==='verified';return {id,status,title:verified?'A clearer introduction, verified':status==='blocked'?'Headline mapping needs attention':'Refine the product introduction',summary:'Increase the headline from 76px to 80px while retaining its existing measure.',intent:'Give the product introduction a clearer entry point without crowding the signup form.',risks:['Check wrapping at tablet widths.'],questions:['Does the new rhythm hold with longer translated content?'],narrativeSource:'authored',changeIds:['font-change'],affectedFiles:['fixture.html'],affectedComponents:['ProductIntro'],affectedTokens:['--text-display'],contexts:[structuredClone(context)],acceptanceCriteria:[{id:'font-size',label:'Headline renders at the requested 80px size',status:verified?'passed':'pending'}],blockers:status==='blocked'?[{message:'Resolve the selected layer source mapping before Apply.'}]:[],validationResults:verified?[{name:'Project build',passed:true,summary:'Synthetic fixture validation result.'}]:[],verificationResults:verified?[{changeId:'font-change',applyRunId:'synthetic-run',claimAttemptId:'synthetic-attempt',property:'fontSize',requested:80,rendered:'80px',passed:true,context:structuredClone(context),geometry:{width:580,height:170},evidence:['synthetic rendered measurement'],verifiedAt:'2026-10-31T10:02:00Z'}]:[],applyRunId:'synthetic-run',baselineRevision:'before-fixture',appliedRevision:verified?'after-fixture':undefined,evidence:[],captureIssues:[]};
}
function run(){return {id:'synthetic-run',state:'passed',changeIds:['font-change'],reviewedChangeSet:{changes:[change()]},applyResultClaimAttemptId:'synthetic-attempt',completedAt:'2026-10-31T10:03:00Z',applyResultAcknowledgedAt:'2026-10-31T10:01:00Z',appliedRevision:'after-fixture',validationResults:[{name:'Project build',passed:true}]};}
function captures(item){item.evidence=['before','rebuilt'].map((phase,i)=>({label:phase==='before'?'Synthetic before capture':'Synthetic rebuilt capture',capture:{phase,sourceRevision:i?'after-fixture':'before-fixture',applyRunId:i?'synthetic-run':undefined,targetId:'headline',context:structuredClone(context),viewport:{width:1440,height:900},conditions:{motion:'reduce',browser:'synthetic-browser',platform:'fixture',deviceScaleFactor:1},sha256:item.id+'-synthetic-'+phase}}));}
function docs(freshness='current'){const tick=String.fromCharCode(96);return [{id:'intro-doc',title:'Product introduction',kind:'component',freshness,summary:'Indexed component guidance and its delivery history.',body:['# Product introduction','','Keep the entry point clear and preserve the signup form measure.','','## Usage','','- Use '+tick+'ProductIntro'+tick+' for the landing page introduction.','- Retain the signup form measure at compact widths.','','## Source and verification','','Source: '+tick+'fixture.html:43'+tick+'. The verified headline size is '+tick+'80px'+tick+'.','','Literal source example: <button data-example>Continue</button>.'].join(String.fromCharCode(10)),sourceFiles:['fixture.html'],deliveryRecordIds:['verified'],updatedAt:'2026-10-31T10:05:00Z'}];}
function history(){return [{id:'history-1',title:'Headline rhythm verified',summary:'The synthetic passed Apply record retains source and rendered evidence.',affectedFiles:['fixture.html'],changeIds:['font-change'],applyRunId:'synthetic-run',createdAt:'2026-10-31T10:03:00Z'}];}
function reports(){return [{format:'foundry.visual-check',version:1,id:'synthetic-checks',createdAt:'2026-10-31T10:06:00Z',exitCode:2,results:['passed','different','unbaselined','failed'].map((status,index)=>({name:['Desktop introduction','Tablet introduction','Mobile introduction','Unavailable screen'][index],status,changedRatio:status==='passed'?0:status==='different'?0.012:undefined,geometryChanges:status==='different'?[{selector:'#headline',description:'Line height changed by 4px.'}]:[],newFindings:[],reason:status==='failed'?'Synthetic capture could not be completed.':undefined,capture:status==='failed'?undefined:{screen:{viewport:{width:index===2?390:1440,height:900},theme:'light',state:'default',masks:[]},sourceRevision:'fixture-revision',sourceDirty:false,browser:'synthetic-browser',platform:'fixture',evidence:['Synthetic local evidence reference']}}))}];}
function showScenario(state){
 $('#delivery-milestone-dialog').close();runtimeConnected=state!=='offline';failNext=false;holdNext=false;failImage=state==='capture-error';failReports=state==='checks-error';deliveryGenerating=false;deliveryActionError='';deliveryTab='handoff';deliveryRecordId='';deliveryDocumentId='';visualCheckReportId='';visualChecksError='';visualChecksStatus='loaded';
 activeSession={deliveryRecords:[record(),record('verified','verified'),record('blocked','blocked')],documentationPages:docs(),designHistory:history(),deliveryMilestones:[{id:'milestone',name:'Introduction refinement',summary:'An internal decision point, not a deployment.',status:'ready',entryIds:['history-1']}],applyRuns:[run()],changeSet:{context:{projectRoot:'/synthetic/Foundry project'},changes:[]}};
 if(['verified','blocked'].includes(state))deliveryRecordId=state;
 if(state==='empty')activeSession.deliveryRecords=[];
 if(state==='source-unavailable')activeSession.applyRuns=[];
 if(['captures','capture-error'].includes(state)){const item=record(state,'verified');captures(item);if(state==='capture-error')item.captureIssues=['One capture request failed in the synthetic fixture.'];activeSession.deliveryRecords=[item];}
 if(state.startsWith('docs-')){deliveryTab='documentation';activeSession.documentationPages=state==='docs-empty'?[]:docs(state==='docs-stale'?'stale':'current');}
 if(state.startsWith('history')){deliveryTab='history';if(state==='history-empty'){activeSession.designHistory=[];activeSession.deliveryMilestones=[];}}
 fixtureReports=reports();visualCheckReports=fixtureReports;
 if(state.startsWith('checks')){deliveryTab='checks';if(state==='checks-error'){visualCheckReports=[];visualChecksStatus='error';visualChecksError='Synthetic local report could not be read.';}}
 $$('[data-delivery-tab]').forEach(button=>button.classList.toggle('is-active',button.dataset.deliveryTab===deliveryTab));
 renderDelivery();$('#fixture-state').textContent='Synthetic state: '+state;$$('[data-fixture-state]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fixtureState===state)));
}
// Transport returns only isolated fixture records; real presentation owns saved,
// pending, stale, read-only and error semantics. Clipboard never leaves this page.
async function api(url,options={}){
 const body=JSON.parse(options.body||'{}');calls.push({type:'api',url,method:options.method??'GET',body});
 if(holdNext){holdNext=false;await new Promise(resolve=>{releaseHeld=resolve;});}
 await Promise.resolve();if(!runtimeConnected)throw Error('Synthetic runtime offline.');if(failNext){failNext=false;throw Error('Synthetic save not acknowledged.');}
 if(url.includes('/evidence/')){if(failImage)throw Error('Synthetic capture unavailable.');return new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC1kAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],{type:'image/png'});}
 if(url.endsWith('/visual-checks')){if(failReports)throw Error('Synthetic local report could not be read.');return {supported:true,reports:structuredClone(fixtureReports)};}
 const updated=structuredClone(activeSession);
 if(url.includes('/delivery-records/'))Object.assign(updated.deliveryRecords.find(item=>item.id===url.split('/').at(-1)),body);
 else if(url.endsWith('/documentation/generate'))updated.documentationPages=docs();
 else if(url.endsWith('/delivery-milestones'))updated.deliveryMilestones.push({id:'milestone-'+(++nextId),name:body.name,entryIds:body.entryIds,summary:'Synthetic internal milestone.',status:'ready'});
 else throw Error('Unsupported synthetic URL: '+url);
 return updated;
}
const settle=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const input=(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));};
const tab=value=>$('[data-delivery-tab="'+value+'"]').click();
const openNotes=()=>{const details=$('.foundry-delivery-notes');if(details)details.open=true;};
function focusRecordHeading(){
 const heading=$('.delivery-record-detail > header h2');
 if(!heading)throw Error('The real connected record heading is missing');
 heading.tabIndex=-1;heading.focus({preventScroll:true});return heading;
}
function runFocusAssertions(check){
 // These nodes belong to the live document. Replacing innerHTML really removes
 // the focused node and resets native focus, unlike the old mocked-DOM tests.
 showScenario('verified');renderConnectionStatus();
 const stableHeading=focusRecordHeading();
 check(stableHeading.isConnected&&document.activeElement===stableHeading,'Focus regression begins on an attached native heading');
 for(let i=0;i<4;i++)renderConnectionStatus();
 if(pilot){
  check(stableHeading.isConnected&&document.activeElement===stableHeading&&$('.delivery-record-detail > header h2')===stableHeading,'Unchanged connection refreshes preserve the exact focused heading node');
  activeSession.deliveryRecords.find(item=>item.id==='verified').summary='Updated evidence summary from an actual-renderer fixture refresh.';
  renderDelivery();
  const refreshedHeading=$('.delivery-record-detail > header h2');
  check(!stableHeading.isConnected&&refreshedHeading!==stableHeading&&refreshedHeading.isConnected&&document.activeElement===refreshedHeading,'Changed record data replaces real DOM and restores focus to the equivalent heading');
  check($('.delivery-record-detail').textContent.includes('Updated evidence summary'),'Necessary record refresh still presents changed data');
  const source=$('.foundry-delivery-context');source.open=true;source.querySelector('summary').focus();renderDelivery();
  check($('.foundry-delivery-context').open&&document.activeElement===$('.foundry-delivery-context > summary'),'Source disclosure expansion and focused native summary survive necessary rendering');
  originalNodes.export.focus();renderDelivery();renderConnectionStatus();
  check(document.activeElement===originalNodes.export,'Refresh never steals focus after the user moves to a persistent outside control');
  const sameRow=$('[data-delivery-record="verified"]');sameRow.focus();renderDelivery();
  check(!sameRow.isConnected&&document.activeElement===$('[data-delivery-record="verified"]'),'Same-view record-row focus follows its stable record ID after replacement');
  focusRecordHeading();$('[data-delivery-record="ready"]').click();
  check(deliveryRecordId==='ready'&&document.activeElement!==$('.delivery-record-detail > header h2'),'Switching records does not focus an unrelated record heading');
  focusRecordHeading();tab('documentation');
  check(deliveryTab==='documentation'&&document.activeElement!==$('.delivery-document h2'),'Switching views does not restore stale Handoff heading focus');
  showScenario('ready');openNotes();const intent=$('[data-delivery-field="intent"]');input(intent,'Connection refresh must preserve this unsaved note.');intent.focus();intent.setSelectionRange(5,14);
  runtimeConnected=false;renderConnectionStatus();
  const offlineIntent=$('[data-delivery-field="intent"]');
  check($('[data-next-save-narrative]').disabled&&$('.next-delivery-save-status').textContent.includes('Runtime offline'),'Changed connection state still disables note saving and explains offline state');
  check(document.activeElement===offlineIntent&&offlineIntent.value==='Connection refresh must preserve this unsaved note.'&&offlineIntent.selectionStart===5&&offlineIntent.selectionEnd===14,'Offline connection rendering preserves the unsaved input and native selection');
  const offlineNode=offlineIntent;renderConnectionStatus();
  check(offlineNode.isConnected&&document.activeElement===offlineNode,'Repeated unchanged offline refresh does not recreate the focused editor');
  runtimeConnected=true;renderConnectionStatus();
  check(!$('[data-next-save-narrative]').disabled&&document.activeElement===$('[data-delivery-field="intent"]'),'Reconnect restores save availability without losing the focused note');
 }else{
  check(!stableHeading.isConnected&&document.activeElement===document.body,'Gate off retains legacy connection refresh and native heading-focus behavior');
 }
 showScenario('ready');
}
$$('[data-fixture-state]').forEach(button=>button.addEventListener('click',()=>showScenario(button.dataset.fixtureState)));
$('#fixture-theme').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';});
mountFoundryPilot();renderDelivery();
async function runAssertions(){
 if(fixtureRunning)return;
 fixtureRunning=true;$('#fixture-rerun').disabled=true;$('#test-results').dataset.result='running';$('#test-results').textContent='Running isolated assertions';$('#test-details').textContent='';
 const checks=[],check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
 const loadFirstEvidence=()=>{const button=$('[data-delivery-evidence="0"] [data-load-evidence]');if(!button)throw Error('First synthetic capture must expose its explicit load or retry action');button.click();};
 try{
  // Each run begins with fresh synthetic image transport. The real cache stays
  // intact within a run; dispose revokes only this fixture's prior object URLs.
  deliveryEvidenceUI.dispose();
  showScenario('empty');check(originalNodes.export.disabled&&$('.delivery-stage').textContent.includes('Your reviewed work lands here'),'Empty handoff explains Review and cannot export a missing record');
  check($('.next-delivery-footer').textContent.includes('not proof of shipping'),'Delivery footer distinguishes handoff from shipping');
  showScenario('ready');check($('.delivery-record-detail .delivery-status').textContent==='Ready for Apply'&&$('.next-delivery-criteria-status').textContent==='1 awaiting results','Ready handoff is not labeled verified while acceptance evidence is pending');
  if(pilot){
   check($('.foundry-delivery-context').contains($('.next-delivery-context'))&&$('.delivery-record-detail').contains($('.foundry-delivery-context'))&&!$('.delivery-layout > .next-delivery-context'),'Handoff context is the original content inside main report disclosure, not a third rail');
   check($('.foundry-delivery-notes').open&&$('.foundry-delivery-notes').contains($('.delivery-detail-grid')),'Editable notes retain their real fields inside an initially open native disclosure');
   const sourceDisclosure=$('.foundry-delivery-context');sourceDisclosure.open=true;renderDelivery();check($('.foundry-delivery-context').open&&$('.foundry-delivery-context summary').tabIndex===0,'Source disclosure expansion and native keyboard semantics survive record refresh');
  }else check(!$('.foundry-delivery-interior')&&!$('.foundry-delivery-context')&&Boolean($('.delivery-layout > .next-delivery-context')),'Gate off preserves the original third-column context rail');
  check($('.delivery-validation').textContent.includes('Validation has not run yet.')&&$('.delivery-validation').textContent.includes('Rendered verification has not completed.'),'Missing source and rendered checks are explicitly unverified');
  check($('.delivery-capture-unavailable').textContent.includes('No authenticated source captures'),'Unavailable screenshots are not replaced with invented evidence');
  showScenario('source-unavailable');check($('.engineering-evidence').textContent.includes('reviewed source snapshot is unavailable'),'Missing reviewed snapshot never invents before-and-after comparisons');
  showScenario('verified');check(!$$('[data-delivery-field]').length&&!$('[data-next-save-narrative]')&&$$('[data-delivery-readonly-field]').length===3,'Verified intent, risks and questions remain read-only');
  if(pilot)check(!$('.foundry-delivery-notes').open&&$('.foundry-delivery-notes').textContent.includes('Read-only narrative'),'Verified notes default to a collapsed read-only disclosure');
  check($('.evidence-status').dataset.status==='passed'&&$('.next-delivery-criteria-status').textContent==='All criteria passed','Synthetic verified record is evaluated by the real frozen-contract evidence helper');
  runFocusAssertions(check);
  showScenario('blocked');check($('.next-delivery-blockers').textContent.includes('Resolve the selected layer source mapping')&&$('.next-delivery-criteria-status').dataset.tone==='warning','Actual blocker text takes priority over nominal readiness');
  showScenario('ready');openNotes();
  input($('[data-delivery-field="intent"]'),'An unsaved intent draft');input($('[data-delivery-field="risks"]'),['First risk',' Second risk '].join(String.fromCharCode(10)));input($('[data-delivery-field="questions"]'),'One open question');
  let intent=$('[data-delivery-field="intent"]');intent.focus();intent.setSelectionRange(3,9);renderDelivery();
  check($('[data-delivery-field="intent"]').value==='An unsaved intent draft'&&document.activeElement===$('[data-delivery-field="intent"]')&&$('[data-delivery-field="intent"]').selectionStart===3&&$('[data-delivery-field="intent"]').selectionEnd===9,'Narrative draft, focus and caret survive record rendering');
  const changedBefore=calls.length;$('[data-delivery-field="intent"]').dispatchEvent(new Event('change',{bubbles:true}));await settle();check(calls.length===changedBefore,'Input blur does not autosave notes in Next Delivery');
  $('[data-delivery-record="verified"]').click();$('[data-delivery-record="ready"]').click();openNotes();check($('[data-delivery-field="intent"]').value==='An unsaved intent draft','Switching records retains unsaved notes by record identity');
  runtimeConnected=false;renderDelivery();check($('[data-next-save-narrative]').disabled&&$('.next-delivery-save-status').textContent.includes('Runtime offline'),'Offline notes remain visible and cannot save');
  runtimeConnected=true;renderDelivery();failNext=true;$('[data-next-save-narrative]').click();await settle();check($('.next-delivery-save-status').textContent.includes('Not saved.')&&$('[data-delivery-field="intent"]').value==='An unsaved intent draft','Failed note acknowledgement preserves drafts with explicit not-saved feedback');
  holdNext=true;const pendingBefore=calls.length;$('[data-next-save-narrative]').click();check($('[data-next-save-narrative]').disabled&&$('[data-next-save-narrative]').textContent==='Saving…','Pending note save locks its action without implying success');
  $('[data-next-save-narrative]').click();input($('[data-delivery-field="intent"]'),'A newer unsaved intent');releaseHeld();await settle();
  check(calls.length===pendingBefore+1&&$('[data-delivery-field="intent"]').value==='A newer unsaved intent'&&$('.next-delivery-save-status').textContent.includes('Earlier notes saved'),'Acknowledgement cannot erase newer note edits or duplicate the pending save');
  const patch=calls.at(-1);check(patch.method==='PATCH'&&patch.body.narrativeSource==='authored'&&patch.body.risks.join('|')==='First risk|Second risk'&&patch.body.questions[0]==='One open question','Original save uses the narrative PATCH contract with normalized risk and question lines');
  $('[data-next-reset-narrative]').click();check($('[data-delivery-field="intent"]').value==='An unsaved intent draft'&&$('[data-next-save-narrative]').disabled,'Discard note edits restores the last acknowledged narrative');
  originalNodes.export.click();await settle();check(calls.at(-1).type==='clipboard'&&calls.at(-1).text.includes("'ready'")&&calls.at(-1).text.includes("'/synthetic/Foundry project'"),'Export only copies a safely quoted command through the isolated clipboard');
  showScenario('captures');check($$('.delivery-capture-group').length===1&&$('.delivery-capture-group').textContent.includes('Matching context and capture conditions'),'Real capture pairing requires the synthetic matching source and context');
  if(pilot){const captured=$('.foundry-delivery-captures');captured.open=true;renderDelivery();check($('.foundry-delivery-captures').open&&$('.foundry-delivery-captures summary').tabIndex===0,'Recorded capture disclosure expansion and native semantics survive refresh');}
  loadFirstEvidence();await settle();check(Boolean($('[data-delivery-evidence="0"] img'))&&!$('[data-evidence-error]'),'Explicit image loading uses the original evidence UI after a synthetic PNG response');
  showScenario('capture-error');loadFirstEvidence();await settle();check($('[data-evidence-error]').textContent.includes('unavailable')&&$('[data-delivery-evidence="0"] [data-load-evidence]').textContent==='Retry image','Failed evidence fetch exposes retry without a false image-success claim');
  failImage=false;loadFirstEvidence();await settle();check(Boolean($('[data-delivery-evidence="0"] img'))&&!$('[data-evidence-error]'),'Evidence retry removes the stale error only after a successful PNG response');
  showScenario('docs-stale');check($('.delivery-document .delivery-status').textContent==='stale','Stale documentation retains its explicit freshness state');
  if(pilot){
   check($('.foundry-delivery-document-source pre').textContent===activeSession.documentationPages[0].body&&Boolean($('.foundry-delivery-document-body p')),'Documentation reading layout retains the unmodified generated source');
   const reading=$('.foundry-delivery-document-body');check($$('h3',reading).map(item=>item.textContent).join('|')==='Usage|Source and verification'&&$$('li',reading).length===2&&$$('code',reading).map(item=>item.textContent).join('|')==='ProductIntro|fixture.html:43|80px'&&reading.textContent.includes('<button data-example>Continue</button>')&&!$('button[data-example]',reading),'Documentation headings, lists and inline code are readable while literal HTML stays inert');
  }
  check(!originalNodes.generate.hidden&&originalNodes.export.hidden,'Documentation exposes refresh rather than handoff export');
  failNext=true;originalNodes.generate.click();await settle();check($('.next-delivery-footer').dataset.error==='true'&&$('.next-delivery-footer').textContent.includes('not refreshed'),'Failed documentation refresh does not claim freshness');
  holdNext=true;const docsBefore=calls.length;originalNodes.generate.click();check(originalNodes.generate.disabled&&originalNodes.generate.textContent.includes('Refreshing'),'Documentation refresh reports its pending state');originalNodes.generate.click();releaseHeld();await settle();
  check(calls.length===docsBefore+1&&$('.delivery-document .delivery-status').textContent==='current','Acknowledged documentation refresh updates once without source edits');
  showScenario('docs-empty');check($('.delivery-stage').textContent.includes('Documentation stays accountable'),'Empty documentation explains source accountability');
  showScenario('history-empty');check($('#delivery-create-milestone').disabled&&$('.delivery-timeline').textContent.includes('Failed and cancelled runs never appear here'),'Empty history cannot invent verified milestones');
  showScenario('history');$('#delivery-create-milestone').click();check(originalNodes.dialog.open,'Original milestone control opens its native dialog');input(originalNodes.name,'An internal checkpoint');failNext=true;originalNodes.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle();
  check(originalNodes.dialog.open&&originalNodes.name.value==='An internal checkpoint','Failed milestone creation preserves its dialog draft');
  originalNodes.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle();check(!originalNodes.dialog.open&&calls.at(-1).body.entryIds.join('|')==='history-1'&&activeSession.deliveryMilestones.at(-1).name==='An internal checkpoint','Milestone submission groups exact existing verified entry IDs only');
  check($('.next-delivery-footer').textContent.includes('not deployments'),'Milestones are not described as deployments');
  if(pilot)check($('.delivery-milestones').matches('.foundry-sidebar-continuation')&&$('.delivery-milestones').parentElement.matches('.delivery-history-layout'),'History milestones remain original renderer-owned contextual sidebar content');
  showScenario('checks');check($$('.visual-check-status').map(item=>item.textContent).join('|')==='passed|different|unbaselined|failed','Visual checks preserve passed, different, unbaselined and incomplete outcomes');
  check($('.visual-check-summary').textContent.includes('not automatic judgments of design quality'),'Pixel differences remain evidence rather than a design-quality verdict');
  const unbaselined=$$('[data-status="unbaselined"]')[0].closest('article');check(unbaselined.textContent.includes('never automatic')&&unbaselined.querySelector('code').textContent.includes("'Mobile introduction'"),'Baseline approval remains an explicitly quoted terminal command');
  check($$('.visual-check-result').at(-1).textContent.includes('No rendered capture'),'Incomplete visual checks never imply a completed capture');
  const evidence=$('.visual-check-result details');evidence.open=true;renderDelivery();check($('.visual-check-result details').open,'Evidence disclosure expansion survives report refresh');
  showScenario('checks-error');check($('.delivery-stage').textContent.includes('Reports could not be read'),'Report-read failures are visible instead of an empty success state');failReports=false;$('[data-refresh-visual-checks]').click();await settle();check($$('.visual-check-result').length===4,'Original reports refresh can recover from the synthetic read failure');
  showScenario('ready');
  const first=$('[data-delivery-tab="handoff"]');first.focus();first.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));await settle();
  check(deliveryTab==='checks'&&document.activeElement===$('[data-delivery-tab="checks"]'),'Keyboard End activates and focuses the final Delivery tab');
  $('[data-delivery-tab="checks"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));check(deliveryTab==='handoff'&&document.activeElement===first,'Keyboard Home returns to the first Delivery tab');
  first.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));check(deliveryTab==='documentation'&&$('[data-delivery-tab="documentation"]').tabIndex===0&&first.tabIndex===-1,'Keyboard tab movement updates selection and roving focus');
  check(originalNodes.content.getAttribute('aria-labelledby')==='next-delivery-tab-documentation'&&originalNodes.content.getAttribute('role')==='tabpanel','Active tab labels the original Delivery content panel');
  if(pilot){
   check(originalNodes.tabs.getAttribute('aria-orientation')===(innerWidth<=800?'horizontal':'vertical'),'Delivery tab semantics follow the actual responsive orientation');
   if(innerWidth>800){$('[data-delivery-tab="documentation"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));check(deliveryTab==='history'&&document.activeElement===$('[data-delivery-tab="history"]'),'Vertical Delivery tabs support Down arrow activation and focus');}
  }
  showScenario('ready');for(let i=0;i<5;i++)renderDelivery();
  for(const[key,selector]of Object.entries({root:'.delivery-mode',content:'#delivery-content',shell:'.delivery-shell',tabs:'.delivery-tabs',generate:'#delivery-generate-docs',export:'#delivery-export',dialog:'#delivery-milestone-dialog',form:'#delivery-milestone-form',name:'#delivery-milestone-name'}))check($(selector)===originalNodes[key],key+' original node survives repeated rendering');
  check($$('.next-delivery-footer').length===1&&$$('.next-delivery-context').length===1&&$$('[data-next-save-narrative]').length===1,'Repeated rendering does not duplicate footer, context or note actions');
  check(!calls.some(item=>item.url?.includes('/apply')||item.type==='provider'),'No source Apply, provider or publication action is invoked');
  if(pilot){
   await document.fonts.ready;
   for(const state of ['ready','docs-fresh','history','checks']){
    showScenario(state);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const root=originalNodes.root,stage=$('.delivery-stage,.delivery-timeline'),navigation=$('.foundry-delivery-navigation');
    check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1&&root.scrollWidth<=root.clientWidth+1&&stage.scrollWidth<=stage.clientWidth+1,state+' view has no page or report horizontal overflow');
    const style=getComputedStyle(root),navBounds=navigation.getBoundingClientRect(),stageStyle=getComputedStyle(stage);
    if(innerWidth>1100)check(style.display==='grid'&&Math.abs(parseFloat(style.gridTemplateColumns)-320)<=1&&Math.abs(navBounds.width-320)<=1,state+' desktop uses the approved 320px shared sidebar');
    else if(innerWidth>800)check(style.display==='grid'&&Math.abs(parseFloat(style.gridTemplateColumns)-320)<=1&&Math.abs(navBounds.width-320)<=1,state+' compact view uses the 320px shared sidebar');
    else check(style.display==='flex'&&stageStyle.overflowY==='visible'&&stageStyle.overscrollBehaviorY==='auto',state+' narrow report stacks and permits outer-page scrolling');
    if(innerWidth>800){
     const footer=$('.next-delivery-footer').getBoundingClientRect(),sidebar=$('.delivery-sidebar,.delivery-milestones').getBoundingClientRect();
     check(stage.getBoundingClientRect().bottom<=footer.top+1,state+' report stays above the footer without overlapping it');
     check(Math.abs(sidebar.top-originalNodes.tabs.getBoundingClientRect().bottom)<=1&&Math.abs(footer.bottom-root.getBoundingClientRect().bottom)<=1,state+' sidebar begins below navigation and footer anchors to workspace bottom');
     check(originalNodes.tabs.scrollHeight<=originalNodes.tabs.clientHeight+1,state+' navigation fits its allotted rows without clipping');
    }
   }
   showScenario('ready');
  }
  $('#test-results').textContent='PASS: '+checks.length+' isolated assertions';$('#test-results').dataset.result='pass';$('#test-details').textContent=checks.map((item,i)=>(i+1)+'. '+item).join(String.fromCharCode(10));$('#fixture-action').textContent='Synthetic records, validated PNG bytes and transport only. No live session or source mutation.';
 }catch(error){$('#test-results').textContent='FAIL: '+error.message;$('#test-results').dataset.result='fail';$('#test-details').textContent=error.stack;console.error(error);}
 finally{fixtureRunning=false;$('#fixture-rerun').disabled=false;}
}
$('#fixture-rerun').addEventListener('click',runAssertions);await runAssertions();
`;
const diagnostics = `window.addEventListener('error',event=>{document.querySelector('#fixture-errors').textContent+=(event.error?.stack||event.message||'Resource failed')+'\\n';},true);window.addEventListener('unhandledrejection',event=>{document.querySelector('#fixture-errors').textContent+=String(event.reason?.stack||event.reason)+'\\n';});`;
const states = [
  'ready',
  'verified',
  'blocked',
  'empty',
  'source-unavailable',
  'captures',
  'capture-error',
  'docs-fresh',
  'docs-stale',
  'docs-empty',
  'history',
  'history-empty',
  'checks',
  'checks-error',
  'offline',
];
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Foundry Delivery — isolated pilot fixture</title><script>${diagnostics}</script><script type="importmap">{"imports":{"foundry-design-protocol/engineering-verification":"/fixture-protocol/engineering-verification.js"}}</script>${stylesheets}<style>
html,body{margin:0;height:100%;overflow:hidden}body{display:flex;flex-direction:column}.fixture-toolbar{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 16px;background:#e9edf5;color:#17243d;font:12px/18px Arial,sans-serif;border-bottom:1px solid #b8c3d5}.fixture-toolbar button{border:1px solid #8a9bb8;border-radius:4px;padding:4px 8px;background:white;color:#17243d;font:12px/18px Arial,sans-serif}.fixture-toolbar button[aria-pressed=true]{background:#17243d;color:white}.fixture-toolbar pre{position:absolute;z-index:100;max-width:calc(100vw - 32px);max-height:50vh;overflow:auto;padding:16px;margin:8px 0;background:white;color:#17243d;border:1px solid #8a9bb8;white-space:pre-wrap}#app-shell.app-shell[data-next]{display:block;flex:1 1 auto;min-height:0;width:100%;height:auto}#app-shell>[data-mode-surface=delivery]{height:100%;min-height:0}[data-result=fail]{color:#ae1b1b}
</style></head><body><header class="fixture-toolbar" aria-label="Isolated test controls"><strong>Delivery fixture · synthetic data</strong><span id="fixture-state">Synthetic state</span><button id="live-status" type="button" aria-label="Synthetic connection status"><span>Runtime</span></button><nav aria-label="Fixture states">${states.map((state) => `<button type="button" data-fixture-state="${state}" aria-pressed="false">${state}</button>`).join(' ')}</nav><button id="fixture-theme">Toggle UI theme</button><button id="fixture-rerun">Run checks again</button><a href="/?foundations=off&theme=light">Previous design</a><a href="/?theme=light">Default design</a><a href="/?foundations=pilot&theme=light">Pilot alias</a><details><summary id="test-results">Running isolated assertions</summary><pre id="test-details"></pre></details><details><summary>Runtime errors</summary><pre id="fixture-errors"></pre></details><span role="status" id="fixture-action">No live Foundry session.</span></header><div id="app-shell" class="app-shell" data-next="true" data-mode="delivery">${markup}</div>${dialog}<script type="module">${script}</script></body></html>`;
if (process.argv.includes('--check')) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: diagnostics + script,
    encoding: 'utf8',
  });
  if (result.status !== 0) process.stderr.write(result.stderr || String(result.error));
  else console.log('Delivery fixture extraction and module syntax: PASS');
  process.exit(result.status ?? 1);
}
const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const port = Number(process.env.FOUNDRY_DELIVERY_FIXTURE_PORT ?? 0);
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
  if (
    [
      '/fixture-protocol/engineering-verification.js',
      '/fixture-protocol/verification-value.js',
    ].includes(url.pathname)
  ) {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(
      await readFile(resolve(root, 'packages/protocol/dist', url.pathname.split('/').at(-1))),
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
    'Isolated Delivery pilot fixture: http://127.0.0.1:' +
      server.address().port +
      '/?foundations=pilot&theme=light',
  );
  console.log('Synthetic data and transport only. No live Foundry session or provider.');
});
