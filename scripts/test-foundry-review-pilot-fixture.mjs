// Isolated Review/Apply fixture: original markup, renderer and action handlers;
// synthetic session/transport only. No live session, source writer or provider.
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname, '..'),
  publicDir = resolve(root, 'apps/inspector/dist');
const source = await readFile(resolve(root, 'apps/inspector/public/app.js'), 'utf8');
const index = await readFile(resolve(root, 'apps/inspector/public/index.html'), 'utf8');
function between(text, start, end) {
  const first = text.indexOf(start),
    last = text.indexOf(end, first + start.length);
  if (first < 0 || last <= first) throw Error('Missing fixture boundary: ' + start);
  return text.slice(first, last);
}
function sectionAt(marker) {
  const at = index.indexOf(marker),
    start = index.lastIndexOf('<section', at);
  let depth = 0,
    end = -1;
  for (const match of index.slice(start).matchAll(/<\/?section\b[^>]*>/g)) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (!depth) {
      end = start + match.index + match[0].length;
      break;
    }
  }
  if (at < 0 || end <= at) throw Error('Missing fixture section: ' + marker);
  return index.slice(start, end);
}
const markup = sectionAt('data-mode-surface="review"').replace(/\s+hidden\s*>/, '>');
const applyMarkup = sectionAt('id="apply-run"');
const deliveryMarkup = sectionAt('data-mode-surface="delivery"');
const stylesheets = [...index.matchAll(/<link\s+rel="stylesheet"\s+href="[^"]+"\s*\/?>/g)]
  .map((match) => match[0])
  .join('');
const renderer = between(
  source,
  'let reviewStatusPending = null;',
  'function renderChangeSummary(',
);
const sourceText = between(source, 'function sourceText(', 'function workshopVariantDrift(');
const formatValue = between(source, 'function formatValue(', 'function renderLayers(');
const compareBindings = between(
  source,
  'async function toggleComparison(',
  "$$('[data-context]').forEach",
);
const applyBinding = between(
  source,
  "$('#apply-agent').addEventListener('click'",
  'async function revealStressSelection(',
);
const navigationBinding = between(
  source,
  "$$('[data-workspace-mode]').forEach",
  "$$('[data-structure-tab]').forEach",
);
const deliveryRenderer = between(
  source,
  'function deliveryStatusLabel(',
  'function visualRecipeTargetSuggestions(',
);
const deliveryTabBinding = between(
  source,
  "\n$$('[data-delivery-tab]').forEach",
  "$('#delivery-generate-docs')?.addEventListener",
);
const deliveryEvidenceSetup = between(
  source,
  'const deliveryEvidenceUI = createDeliveryEvidenceUI(',
  'let comparisonMode',
);
const script = `
import { foundryFoundationsEnabled } from '/foundry-foundations.js';
import {reviewMappingIssue,reviewBatchSummary,reviewSource,applyLifecyclePresentation,shouldDisplayApplyRun,engineeringEvidence,deliveryNarrativeReadOnly} from '/workflow.js';
import {createNextDelivery,deliveryShellArgument} from '/next-delivery.js';
import {createDeliveryEvidenceUI} from '/delivery-evidence-ui.js';
import {refinePilotReview,capturePilotApplyState,refinePilotApply} from '/foundry-pilot-review.js';
import {captureReviewEditState,restoreReviewEditState} from '/review-edit-state.js';
import {mountFoundryPilot,refinePilotIcons,foundryPilotActive} from '/foundry-pilot.js';
import {foundryPilotIcon} from '/foundry-pilot-icons.js';
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escapeText=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),escapeAttribute=value=>escapeText(value).replaceAll('"','&quot;');
const params=new URLSearchParams(location.search);params.set('ui','next');const pilot=foundryFoundationsEnabled(),sessionId='isolated-review-fixture';
let activeMode='review',reviewOriginMode='typography',activeSession,serverSession,bridgeConnected=true,activeAgentPresence={connected:true},comparisonMode='after';
let dismissedApplyRunId=null,applyRunActionError=null,cancelConfirmationRunId=null,cancelConfirmationUntil=0;
let latestSessionRequest=0,pendingSessionRender=null;
let nextDelivery,runtimeConnected=true,deliveryTab='handoff',deliveryRecordId='',deliveryDocumentId='',deliveryGenerating=false,deliveryActionError='';
let visualCheckReports=[],visualCheckReportId='',visualChecksStatus='loaded',visualChecksError='';
let failNext=false,holdNext=false,releaseHeld,fixtureRunning=false,nextRunId=0,failNextLoad=false,sessionLoads=0,statusResponseOverride=null;
const calls=[],toasts=[],timers=new Set();
const setTimeout=(callback,delay)=>{const id=window.setTimeout(()=>{timers.delete(id);callback();},delay);timers.add(id);return id;};
const toast=message=>{toasts.push(message);$('#fixture-action').textContent='Synthetic only: '+message;};
function renderIcons(root=document){for(const item of $$('[data-icon]',root)){const icon=foundryPilotIcon(item.dataset.icon);if(icon)item.outerHTML=icon;}refinePilotIcons(root);}
function setMode(mode){activeMode=mode;calls.push({type:'navigation',mode});$('#app-shell').dataset.mode=mode;$$('[data-mode-surface]').forEach(surface=>{surface.hidden=surface.dataset.modeSurface!==mode;});$('#fixture-navigation').hidden=['review','delivery'].includes(mode);$('#fixture-navigation').textContent='Synthetic navigation: '+mode+' — no real workspace was opened.';renderApplyRun(activeSession?.applyRuns??[]);if(mode==='delivery')renderDelivery();}
function renderChangeSummary(){}
function renderSession(session){activeSession=structuredClone(session);renderReview();renderApplyRun(activeSession.applyRuns);if(activeMode==='delivery')renderDelivery();}
async function loadSession({expectedReviewContext,expectedApplyContext}={}){sessionLoads+=1;if((expectedReviewContext&&expectedReviewContext!==reviewContextKey())||(expectedApplyContext&&expectedApplyContext!==applyRunContextKey()))return {ok:false};if(failNextLoad){failNextLoad=false;return {ok:false,error:'Synthetic session refresh was unavailable.'};}if(pilot&&applyRunActionError?.needsRefresh&&applyRunActionError.context===applyRunContextKey(serverSession))applyRunActionError=null;renderSession(serverSession);return {ok:true};}
${sourceText}
${formatValue}
${renderer}
${compareBindings}
${applyBinding}
${navigationBinding}
${deliveryEvidenceSetup}
${deliveryRenderer}
${deliveryTabBinding}
const originalNodes={surface:$('[data-mode-surface="review"]'),changes:$('#changes'),summary:$('#review-summary'),summaryContent:$('#review-summary-content'),apply:$('#apply-agent'),compare:$('#review-compare'),return:$('#review-return'),run:$('#apply-run')};
const context={breakpoint:'desktop',theme:'light',state:'default'};
function change(id='headline-size',extra={}){return {id,target:{id:'headline',label:'Product introduction headline',platform:'web',locator:{selector:'#headline',foundryId:'headline'},source:{file:'src/ProductIntro.tsx',line:43}},property:'fontSize',category:'typography',scope:'instance',before:76,after:80,unit:'px',status:'approved',confidence:'source-mapped',context:{...context},createdAt:'2026-10-31T10:00:00Z',...extra};}
function changes(){return [change(),change('headline-tracking',{property:'letterSpacing',before:-2,after:-1.5}),change('button-width',{target:{id:'button',label:'Create workspace button',platform:'web',locator:{selector:'#create-workspace',foundryId:'create-workspace'},source:{file:'src/CreateWorkspace.tsx',line:18}},property:'width',category:'layout',before:448,after:480,status:'rejected'})];}
function run(state='queued',extra={}){return {id:'synthetic-run',state,attempts:1,changeIds:['headline-size','headline-tracking'],requestedAt:'2026-10-31T10:01:00Z',reviewedChangeSet:{changes:changes().slice(0,2)},messages:[{state:'queued',message:'Synthetic reviewed batch retained.'}],changedFiles:[],validationResults:[],verificationResults:[],...extra};}
function session(){return {changeSet:{id:'synthetic-batch',sessionId,context:{projectRoot:'/isolated/foundry-fixture',revision:'synthetic-revision'},designGraphRevision:'synthetic-graph',changes:changes(),operations:[]},applyRuns:[],deliveryRecords:[],documentationPages:[],designHistory:[],deliveryMilestones:[]};}
function syntheticVerificationResults(applyRunId){
 return changes().slice(0,2).map(item=>({changeId:item.id,applyRunId,claimAttemptId:'synthetic-attempt',property:item.property,requested:item.after,rendered:item.after+'px',passed:true,context:{...item.context},geometry:{width:580,height:180},evidence:['Synthetic in-memory measurement fixture; no real browser or source verification.'],reason:'Synthetic measurement for isolated handoff testing.',verifiedAt:'2026-11-01T10:02:00Z'}));
}
function deliveryRecord(id,applyRunId,status='verified'){
 return {id,sessionId,applyRunId,status,title:id==='verified-record'?'Product introduction — verified handoff':'Earlier unrelated handoff',summary:'Synthetic record for checking exact handoff navigation, not real source evidence.',intent:'Preserve the exact reviewed headline change and its recorded evidence.',risks:['Check the introduction at compact widths.'],questions:[],narrativeSource:'authored',changeIds:['headline-size','headline-tracking'],affectedFiles:['src/ProductIntro.tsx'],affectedComponents:['ProductIntro'],affectedTokens:[],contexts:[{...context}],acceptanceCriteria:changes().slice(0,2).map(item=>({id:item.id,label:'Headline '+item.property+' matches the reviewed '+item.after+'px',status:status==='verified'?'passed':'pending'})),blockers:[],validationResults:status==='verified'?[{name:'Project build',passed:true,summary:'Synthetic contract fixture result.'}]:[],verificationResults:status==='verified'?syntheticVerificationResults(applyRunId):[],baselineRevision:'synthetic-before',appliedRevision:status==='verified'?'synthetic-after':undefined,evidence:[],captureIssues:[]};
}
function showScenario(state){
 for(const timer of timers)window.clearTimeout(timer);timers.clear();
 failNext=false;holdNext=false;releaseHeld=null;failNextLoad=false;statusResponseOverride=null;reviewStatusPending=null;reviewStatusError=null;applyRunActionPending=null;applyRunResumeReview=null;pendingSessionRender=null;activeMode='review';reviewOriginMode='typography';comparisonMode='after';dismissedApplyRunId=null;applyRunActionError=null;cancelConfirmationRunId=null;cancelConfirmationUntil=0;
 verifiedDeliverySelection=null;deliveryTab='handoff';deliveryRecordId='';deliveryDocumentId='';deliveryGenerating=false;deliveryActionError='';
 $$('[data-after-id]').forEach(field=>{field.value=field.defaultValue;});
 bridgeConnected=state!=='preview-offline';activeAgentPresence={connected:state!=='agent-offline'&&state!=='queued'};serverSession=session();
 if(state==='empty')serverSession.changeSet.changes=[];
 if(state==='excluded')serverSession.changeSet.changes.forEach(item=>item.status='rejected');
 if(state==='unresolved')serverSession.changeSet.changes=[change('unmapped',{confidence:'unresolved',target:{id:'unmapped',label:'Unmapped heading',platform:'web',locator:{selector:'.unknown'}}})];
 if(state==='conflicts')serverSession.changeSet.changes=[change('ambiguous',{mappingCandidates:[{id:'one',source:{file:'src/One.tsx',line:4}},{id:'two',source:{file:'src/Two.tsx',line:7}}]})];
 const runStates=['queued','claimed','applying','rebuilding','verifying','passed-unverified','verified','needs-attention','failed','cancelled','stale'];
 if(runStates.includes(state)){
  const terminal=['passed-unverified','verified','stale'].includes(state),value=run(terminal?'passed':state==='needs-attention'?'needs_attention':state);
  if(['applying','rebuilding','verifying','needs-attention','failed',...['passed-unverified','verified','stale']].includes(state))value.changedFiles=['src/ProductIntro.tsx'];
  if(state==='needs-attention'){value.interruptedState='rebuilding';value.error='Synthetic build interrupted. Source edits are retained for inspection.';value.messages.push({state:'rebuilding',message:'Build interrupted.'});}
  if(state==='failed'){value.error='Synthetic type check failed in ProductIntro.tsx:43.';value.validationResults=[{name:'Type check',passed:false,summary:'Property type could not be resolved.'}];value.messages.push({state:'rebuilding',message:'Type check failed.'});}
  if(terminal){serverSession.changeSet.changes.forEach(item=>item.status='applied');value.validationResults=[{name:'Project build',passed:true,summary:'Synthetic local build result.'}];value.verificationResults=[{property:'fontSize',requested:80,rendered:'80px',passed:true,context:{...context},reason:'Synthetic rendered measurement.'}];}
  if(state==='verified'){
   Object.assign(value,{applyResultClaimAttemptId:'synthetic-attempt',applyResultAcknowledgedAt:'2026-11-01T10:01:00Z',completedAt:'2026-11-01T10:03:00Z',appliedRevision:'synthetic-after',verificationResults:syntheticVerificationResults(value.id)});
   serverSession.deliveryRecords=[deliveryRecord('unrelated-record','unrelated-run','ready'),deliveryRecord('verified-record',value.id)];
  }
  if(state==='stale')serverSession.changeSet.changes.push(change('new-edit',{property:'lineHeight',before:84,after:88}));
  serverSession.applyRuns=[value];
 }
 $('#app-shell').dataset.mode='review';$$('[data-mode-surface]').forEach(surface=>{surface.hidden=surface.dataset.modeSurface!=='review';});$('#fixture-navigation').hidden=true;$('#review-apply-error').hidden=true;$('#review-apply-error').textContent='';delete originalNodes.apply.dataset.submitting;originalNodes.run.dataset.signature='';
 renderSession(serverSession);
 if(state==='long-error'){
  const error=$('#review-apply-error');error.hidden=false;
  error.textContent='Synthetic layout-only failure: the reviewed batch could not be queued because its source revision is no longer available. Reconnect the preview, inspect the current source mapping and review the preserved values before trying again. No request has been sent and no source changes have been made. This deliberately long message exercises wrapping and action placement without invoking any transaction.';
 }
 $('#fixture-state').textContent='Synthetic state: '+state;$$('[data-fixture-state]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fixtureState===state)));
}
async function transport(){if(holdNext){holdNext=false;await new Promise(resolve=>{releaseHeld=resolve;});}await Promise.resolve();if(failNext){failNext=false;throw Error('Synthetic request was not acknowledged.');}}
async function api(url,options={}){
 const body=JSON.parse(options.body||'{}'),requestSession=serverSession;calls.push({type:'api',url,method:options.method??'GET',body});await transport();
 if(url.includes('/changes/')){const id=decodeURIComponent(url.split('/').at(-1));Object.assign(serverSession.changeSet.changes.find(item=>item.id===id),body);if(statusResponseOverride){const response=statusResponseOverride;statusResponseOverride=null;return structuredClone(response);}}
 else if(url.endsWith('/apply-runs'))serverSession.applyRuns.push(run('queued',{id:'queued-'+(++nextRunId),changeIds:body.reviews.filter(item=>item.approved).map(item=>item.changeId)}));
 else if(url.endsWith('/resume-context')){
  const runId=decodeURIComponent(url.split('/').at(-2)),value=requestSession.applyRuns.find(item=>item.id===runId);
  if(!value)throw Error('Unknown synthetic Apply run.');
  return {runId,reviewedRevision:'synthetic-revision',expectedRevision:requestSession.changeSet.context.revision,expectedDesignGraphRevision:requestSession.changeSet.designGraphRevision,changedFiles:[...value.changedFiles]};
 }
 else if(url.includes('/apply-runs/')&&['cancel','resume','retry'].includes(url.split('/').at(-1))){
  const action=url.split('/').at(-1),runId=decodeURIComponent(url.split('/').at(-2)),value=requestSession.applyRuns.find(item=>item.id===runId);
  if(!value)throw Error('Unknown synthetic Apply run.');
  if(action==='retry')requestSession.applyRuns.push(run('queued',{id:'retry-'+(++nextRunId),retryOf:value.id,attempts:value.attempts+1,reviewedChangeSet:structuredClone(value.reviewedChangeSet)}));
  else if(action==='resume'){
   if(!Object.hasOwn(body,'expectedRevision')||!Object.hasOwn(body,'expectedDesignGraphRevision'))throw Error('Apply resume requires explicit expected source and design graph revisions');
   if(body.expectedRevision!==(requestSession.changeSet.context.revision??null)||body.expectedDesignGraphRevision!==(requestSession.changeSet.designGraphRevision??null))throw Error('Synthetic resume revision conflict.');
   value.state='queued';value.error=undefined;
  }else value.state='cancelled';
  return structuredClone(requestSession);
 }
 else throw Error('Unsupported synthetic request: '+url);
 return structuredClone(serverSession);
}
async function requestCommand(command,payload={}){
 calls.push({type:'command',command,payload});await transport();
 if(command==='delete-change')serverSession.changeSet.changes=serverSession.changeSet.changes.filter(item=>item.id!==payload.changeId);
 else if(!['compare','select'].includes(command))throw Error('Unsupported synthetic command: '+command);
 return structuredClone(serverSession);
}
const settle=async()=>{for(let i=0;i<50;i++)await Promise.resolve();};
const click=(selector)=>{const button=$(selector);if(!button)throw Error('Expected action: '+selector);button.click();};
const input=(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));};
$$('[data-fixture-state]').forEach(button=>button.addEventListener('click',()=>showScenario(button.dataset.fixtureState)));
$('#fixture-theme').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';});
const failureControl=document.createElement('button');failureControl.id='fixture-fail-next';failureControl.type='button';failureControl.textContent='Fail next request';failureControl.title='Reject the next isolated synthetic request; no live session is used.';$('#fixture-theme').after(failureControl);
failureControl.addEventListener('click',()=>{failNext=true;$('#fixture-action').textContent='The next synthetic request will fail. Use an inclusion or recovery action to inspect its recoverable error.';});
const holdControl=document.createElement('button');holdControl.id='fixture-hold-next';holdControl.type='button';holdControl.textContent='Hold next request';failureControl.after(holdControl);
holdControl.addEventListener('click',()=>{holdNext=true;$('#fixture-action').textContent='The next synthetic request will wait for Release request. No live transport.';});
const releaseControl=document.createElement('button');releaseControl.id='fixture-release';releaseControl.type='button';releaseControl.textContent='Release request';holdControl.after(releaseControl);
releaseControl.addEventListener('click',()=>{releaseHeld?.();releaseHeld=null;});
const refreshControl=document.createElement('button');refreshControl.id='fixture-progress-refresh';refreshControl.type='button';refreshControl.textContent='Refresh progress';releaseControl.after(refreshControl);
refreshControl.addEventListener('click',()=>{const current=serverSession.applyRuns.at(-1);if(current){current.messages.push({state:current.state,message:'Synthetic progress refresh '+current.messages.length});renderSession(serverSession);}$('#fixture-action').textContent='Synthetic progress refreshed; action requests: '+calls.filter(item=>item.type==='api'&&/apply-runs\\/[^/]+\\/(retry|resume|cancel)$/.test(item.url)).length;});
function mutateVerifiedHandoff(session,kind){
 const record=session.deliveryRecords.find(item=>item.id==='verified-record');
 if(kind==='removed')session.deliveryRecords=session.deliveryRecords.filter(item=>item.id!=='verified-record');
 else if(kind==='replaced'){session.deliveryRecords=session.deliveryRecords.filter(item=>item.id!=='verified-record');session.deliveryRecords.push(deliveryRecord('replacement-record','synthetic-run'));}
 else if(kind==='superseded')record.status='superseded';
 else if(kind==='reassigned')record.applyRunId='other-run';
 else if(kind==='foreign-session')record.sessionId='another-session';
 else if(kind==='ambiguous')session.deliveryRecords.push(deliveryRecord('second-verified-record','synthetic-run'));
 else if(kind==='duplicate-id')session.deliveryRecords.push({...record});
 else if(kind==='run-reopened')session.applyRuns.find(item=>item.id==='synthetic-run').state='verifying';
}
const handoffControls=['removed','superseded'].map(kind=>{const button=document.createElement('button');button.type='button';button.id='fixture-handoff-'+kind;button.textContent=kind==='removed'?'Remove handoff':'Supersede handoff';button.title='Change only the in-memory synthetic handoff, then refresh the real renderer.';refreshControl.after(button);button.addEventListener('click',()=>{if(!serverSession.deliveryRecords.some(item=>item.id==='verified-record'))return;mutateVerifiedHandoff(serverSession,kind);renderSession(serverSession);$('#fixture-action').textContent='Synthetic verified handoff '+kind+'. No source or live record changed.';});return button;});
mountFoundryPilot();
async function runAssertions(){
 if(fixtureRunning)return;fixtureRunning=true;$('#fixture-rerun').disabled=true;for(const control of [failureControl,holdControl,releaseControl,refreshControl,...handoffControls])control.disabled=true;$('#test-results').dataset.result='running';$('#test-results').textContent='Running isolated assertions';$('#test-details').textContent='';
 const checks=[],check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
 try{
  showScenario('ready');await settle();
  check($$('.change-group').length===2&&$$('.change-row').length===3&&$('#review-count').textContent==='2 included','Review groups exact changes by target and counts only included mappings');
  check(originalNodes.apply.textContent==='Apply 2 with agent'&&!originalNodes.apply.disabled,'Connected agent offers an explicit Apply handoff');
  check($('[data-change-id="button-width"]').checked===false&&$('.review-summary-metrics').textContent.includes('Local styles'),'Excluded changes remain visible and local style scope is not inflated');
  check(originalNodes.return.textContent==='Back to Typography Studio'&&originalNodes.return.dataset.workspaceMode==='typography','Review remembers the originating workspace');
  const sourceDisclosure=$('.change-source-details');sourceDisclosure.open=true;renderReview();check($('.change-source-details').open,'Expanded source details survive the real Review renderer');
  if(pilot){const field=$('[data-after-id="headline-size"]'),button=$('[data-preview-change="headline-size"]');input(field,'80.25px');field.focus();field.setSelectionRange(1,4);refinePilotReview(originalNodes.surface,{changes:activeSession.changeSet.changes});check(field===$('[data-after-id="headline-size"]')&&button===$('[data-preview-change="headline-size"]')&&field.value==='80.25px'&&document.activeElement===field&&field.selectionStart===1&&field.selectionEnd===4,'Pilot refinement preserves original field and action nodes, drafts, focus and caret');}
  else check(!$('.foundry-review-interior')&&!$('.foundry-apply-interior'),'Gate off keeps the existing Review and Apply surfaces');
  showScenario('unresolved');check(originalNodes.apply.disabled&&$('[data-change-id="unmapped"]').disabled&&$('#changes').textContent.includes('source mapping'),'Unresolved mappings remain visible and cannot be included');
  showScenario('conflicts');check(originalNodes.apply.disabled&&$('[data-change-id="ambiguous"]').disabled&&$('#changes').textContent.includes('Mapping needed')&&$('#changes').textContent.includes('Source mapping unavailable'),'Ambiguous candidates do not pick or imply an exact source');
  showScenario('excluded');check(originalNodes.apply.disabled&&$('#review-count').textContent==='0 included','A fully excluded batch cannot Apply');
  showScenario('empty');check(originalNodes.apply.disabled&&originalNodes.compare.disabled&&$('#changes').textContent.includes('No changes recorded'),'Empty Review explains the next step and disables unavailable actions');
  showScenario('preview-offline');check(originalNodes.compare.disabled,'Disconnected preview disables batch comparison');
  showScenario('agent-offline');check(originalNodes.apply.textContent==='Queue 2 for agent'&&$('.review-agent-state').textContent.includes('does not begin source work'),'Offline agent copy distinguishes queuing from source work');
  showScenario('ready');const inclusion=$('[data-change-id="button-width"]');inclusion.checked=true;inclusion.dispatchEvent(new Event('change',{bubbles:true}));await settle();check(calls.at(-1).method==='PATCH'&&calls.at(-1).body.status==='approved'&&$('#review-count').textContent==='3 included','Original inclusion action persists the exact change approval');
  if(pilot){
   for(const [id,previousChecked,expectedCount]of [['button-width',false,'3 included'],['headline-tracking',true,'1 included']]){
    showScenario('ready');const draft=$('[data-after-id="headline-size"]');input(draft,'81.125px');draft.focus();draft.setSelectionRange(1,5,'backward');
    const errorLog=$('#fixture-errors').textContent,beforeFailure=calls.length;failNext=true;click('[data-change-id="'+id+'"]');await settle();await new Promise(resolve=>window.setTimeout(resolve,0));
    const failed=$('[data-change-id="'+id+'"]'),row=failed.closest('.change-row'),restoredDraft=$('[data-after-id="headline-size"]');
    check(failed.checked===previousChecked&&!failed.disabled&&$('#review-count').textContent==='2 included'&&activeSession.changeSet.changes.find(item=>item.id===id).status===(previousChecked?'approved':'rejected'),'Failed '+(previousChecked?'exclude':'include')+' restores confirmed checkbox, ledger and count');
    check(row.querySelector('[role="alert"][data-review-status="error"]')?.textContent.includes('Synthetic request was not acknowledged.'),'Failed '+(previousChecked?'exclude':'include')+' exposes an inline row error with explicit retry');
    check(restoredDraft.value==='81.125px'&&document.activeElement===restoredDraft&&restoredDraft.selectionStart===1&&restoredDraft.selectionEnd===5&&restoredDraft.selectionDirection==='backward','Failed '+(previousChecked?'exclude':'include')+' preserves another raw draft, focus and caret');
    check($('#fixture-errors').textContent===errorLog&&calls.slice(beforeFailure).filter(item=>item.method==='PATCH').length===1,'Failed '+(previousChecked?'exclude':'include')+' is caught without unhandled rejection or automatic retry');
    click('[data-change-id="'+id+'"]');await settle();
    check($('#review-count').textContent===expectedCount&&!$('[data-change-id="'+id+'"]').closest('.change-row').querySelector('[data-review-status="error"]')&&$('[data-after-id="headline-size"]').value==='81.125px','Explicit '+(previousChecked?'exclude':'include')+' retry acknowledges only inclusion and retains the requested-value draft');
   }
   showScenario('ready');input($('[data-after-id="headline-size"]'),'80.25px');const beforeHeld=calls.length,loadsBeforeHeld=sessionLoads;holdNext=true;$('[data-change-id="button-width"]').focus();click('[data-change-id="button-width"]');await settle();
   check(originalNodes.apply.disabled&&$$('[data-change-id]').every(field=>field.getAttribute('aria-disabled')==='true')&&$$('[data-delete-change]').every(button=>button.disabled)&&!$('[data-change-id="button-width"]').checked&&$('#review-count').textContent==='2 included','Pending inclusion keeps confirmed counts and locks inclusion, deletion and Apply');
   check(document.activeElement===$('[data-change-id="button-width"]')&&!document.activeElement.disabled,'Pending inclusion retains keyboard focus on its guarded original checkbox action');
   await setStatus('button-width','approved');originalNodes.apply.dispatchEvent(new MouseEvent('click',{bubbles:true}));
   check(calls.length===beforeHeld+1&&calls.at(-1).method==='PATCH','Pending inclusion rejects duplicate status and Apply dispatches before transport');
   renderReview();check(originalNodes.apply.disabled&&$$('[data-change-id]').every(field=>field.getAttribute('aria-disabled')==='true'),'Pending inclusion locks survive a Review rerender');
   const latestDraft=$('[data-after-id="headline-size"]');input(latestDraft,'80.875px');latestDraft.focus();latestDraft.setSelectionRange(2,6,'backward');releaseHeld();await settle();
   const acknowledgedDraft=$('[data-after-id="headline-size"]');
   check($('#review-count').textContent==='3 included'&&$('[data-change-id="button-width"]').checked&&!originalNodes.apply.disabled&&calls.slice(beforeHeld).filter(item=>item.method==='PATCH').length===1,'Acknowledged inclusion releases pending controls with one authoritative update');
   check(acknowledgedDraft.value==='80.875px'&&document.activeElement===acknowledgedDraft&&acknowledgedDraft.selectionStart===2&&acknowledgedDraft.selectionEnd===6&&acknowledgedDraft.selectionDirection==='backward','Status acknowledgement preserves the newest other draft and caret rather than the request-start snapshot');
   check(activeSession.changeSet.changes.find(item=>item.id==='headline-size').after===80&&!calls.slice(beforeHeld).some(item=>item.body?.after!==undefined),'Inclusion transport never submits another unsubmitted requested-value draft');
   check(sessionLoads===loadsBeforeHeld,'Matching inclusion acknowledgement consumes its authoritative PATCH response without a redundant session load');
   showScenario('ready');holdNext=true;click('[data-change-id="button-width"]');await settle();const focusDraft=$('[data-after-id="headline-size"]');input(focusDraft,'82.5px');focusDraft.focus();const externalControl=$('#fixture-theme');externalControl.focus();releaseHeld();await settle();
   check(document.activeElement===externalControl&&$('[data-after-id="headline-size"]').value==='82.5px','Status acknowledgement preserves a raw draft without stealing focus after the user leaves it');
   showScenario('ready');statusResponseOverride=structuredClone(serverSession);statusResponseOverride.changeSet.changes.find(item=>item.id==='button-width').status='approved';holdNext=true;const loadsBeforeRace=sessionLoads;click('[data-change-id="button-width"]');await settle();
   serverSession.changeSet.changes.push(change('newer-ledger-edit',{property:'lineHeight',before:84,after:88}));renderSession(serverSession);input($('[data-after-id="headline-size"]'),'83.75px');releaseHeld();await settle();
   check(sessionLoads===loadsBeforeRace+1&&$('[data-after-id="newer-ledger-edit"]')&&$('[data-change-id="button-width"]').checked&&$('[data-after-id="headline-size"]').value==='83.75px','A newer same-context ledger is refreshed rather than overwritten by an older PATCH snapshot');
   showScenario('ready');holdNext=true;click('[data-change-id="button-width"]');await settle();renderSession(serverSession);input($('[data-after-id="headline-size"]'),'84.125px');failNextLoad=true;releaseHeld();await settle();
   const acknowledgedError=$('[data-change-id="button-width"]').closest('.change-row').querySelector('[data-review-status="error"]');
   check(acknowledgedError?.textContent.includes('Selection acknowledged, but Review could not refresh')&&!acknowledgedError.textContent.includes('not acknowledged')&&originalNodes.apply.disabled&&serverSession.changeSet.changes.find(item=>item.id==='button-width').status==='approved','Accepted inclusion with unavailable refresh is distinguished from a rejected PATCH and keeps Apply paused');
   check($('[data-after-id="headline-size"]').value==='84.125px'&&!$('[data-change-id="button-width"]').checked,'Unavailable inclusion refresh retains the local draft and last displayed confirmed selection');
   const beforeUncertain=calls.length;originalNodes.apply.dispatchEvent(new MouseEvent('click',{bubbles:true}));await setStatus('button-width','approved');check(calls.length===beforeUncertain,'Uncertain refreshed inclusion does not allow another status or Apply transaction');
   showScenario('ready');input($('[data-after-id="headline-size"]'),'82.5px');serverSession.changeSet.changes.find(item=>item.id==='headline-size').after=84;renderSession(serverSession);
   check($('[data-after-id="headline-size"]').value===formatValue(84,'px'),'A changed server requested-value baseline is not overwritten by an older local draft');
   showScenario('ready');input($('[data-after-id="headline-size"]'),'82.5px');serverSession.changeSet.changes=serverSession.changeSet.changes.filter(item=>item.id!=='headline-size');renderSession(serverSession);
   check(!$('[data-after-id="headline-size"]'),'A removed Review change is not recreated from a local draft');
   showScenario('ready');input($('[data-after-id="headline-size"]'),'82.5px');serverSession.changeSet.changes.find(item=>item.id==='headline-size').status='applied';renderSession(serverSession);
   check(!$('[data-after-id="headline-size"]'),'An applied Review change does not regain its stale draft field');
   showScenario('ready');input($('[data-after-id="headline-size"]'),'82.5px');serverSession.changeSet.context.revision='different-synthetic-revision';renderSession(serverSession);
   check($('[data-after-id="headline-size"]').value===formatValue(80,'px'),'A changed Review source context does not inherit an earlier raw draft');
  }else{
   showScenario('ready');input($('[data-after-id="headline-size"]'),'80.25px');click('[data-change-id="button-width"]');await settle();
   check($('#review-count').textContent==='3 included'&&$('[data-after-id="headline-size"]').value===formatValue(80,'px'),'Gate-off inclusion keeps its existing refresh behavior without pilot draft restoration');
  }
  showScenario('ready');const beforeView=calls.length;click('[data-preview-change="headline-size"]');await settle();check(calls[beforeView].command==='select'&&calls[beforeView].payload.selector==='#headline'&&calls[beforeView+1].command==='compare'&&calls[beforeView+1].payload.mode==='after'&&activeMode==='canvas','View on canvas selects the exact target and compares after before navigation');
  showScenario('ready');failNext=true;click('[data-preview-change="headline-size"]');await settle();check(activeMode==='review'&&!$('#review-apply-error').hidden&&activeSession.changeSet.changes.length===3,'Failed preview navigation remains in Review with its ledger intact');
  showScenario('ready');click('#review-compare');await settle();check(activeMode==='canvas'&&comparisonMode==='before','Batch comparison shows the source baseline before navigating');
  showScenario('ready');failNext=true;click('#review-compare');await settle();check(activeMode==='review'&&!$('#review-apply-error').hidden,'Failed batch comparison does not navigate or imply a changed preview');
  showScenario('ready');click('#review-return');check(activeMode==='typography','Return action navigates to the original workspace without editing source');
  showScenario('ready');failNext=true;click('[data-delete-change="headline-size"]');await settle();check(!$('#review-apply-error').hidden&&!$('[data-delete-change="headline-size"]').disabled&&activeSession.changeSet.changes.length===3,'Failed delete-and-restore retains the change and allows retry');
  click('[data-delete-change="headline-size"]');await settle();check(!$('[data-change-id="headline-size"]')&&calls.at(-1).command==='delete-change'&&calls.at(-1).payload.changeId==='headline-size','Delete and restore uses the original command with only the selected change ID');
  showScenario('ready');input($('[data-after-id="headline-size"]'),'80.25px');failNext=true;click('#apply-agent');await settle();check(!$('#review-apply-error').hidden&&$('#review-apply-error').textContent.includes('Apply was not queued')&&$('[data-after-id="headline-size"]').value==='80.25px'&&!originalNodes.apply.disabled,'Rejected Apply submission preserves the entered value and reports not queued');
  holdNext=true;const beforeApply=calls.length;originalNodes.apply.focus();click('#apply-agent');check(originalNodes.apply.disabled&&originalNodes.apply.dataset.submitting==='true','Apply submission locks the original action while awaiting acknowledgement');click('#apply-agent');check(calls.length===beforeApply+1,'A pending Apply submission cannot submit twice');const submitted=calls.at(-1);check(submitted.body.revision==='synthetic-revision'&&submitted.body.reviews.length===3&&submitted.body.reviews[0].after===80.25&&submitted.body.reviews[2].approved===false,'Apply submits reviewed values, inclusion and the captured source revision');releaseHeld();await settle();check(activeSession.applyRuns.at(-1).state==='queued'&&!originalNodes.run.hidden,'Acknowledged Apply opens a queued run without claiming source edits');
  if(pilot){
   check(document.activeElement===$('.apply-status-row h2')&&document.activeElement.tabIndex===-1,'Initial Apply exposure transfers keyboard focus from covered Review to the report heading');
   const external=$('[data-fixture-state="queued"]');external.focus();external.click();await settle();check(document.activeElement===external,'External fixture controls retain focus when exposing an Apply scenario');
  }
  for(const[state,phase]of [['queued','Queued'],['claimed','Claimed'],['applying','Applying'],['rebuilding','Rebuilding'],['verifying','Verifying']]){showScenario(state);check(!originalNodes.run.hidden&&$('.apply-status-row h2,.apply-status-row strong').textContent===phase,state+' is labeled from the real lifecycle presentation');check($('[data-run-action="cancel"]')&&!$('[data-run-navigation="delivery"]'),state+' offers a stop request, never a verified handoff');}
  showScenario('queued');check($('.apply-status-row').textContent.includes('Source work has not begun.')&&$('.apply-evidence').textContent.includes('listener reconnects'),'Queued source work remains explicitly unstarted while offline');
  showScenario('claimed');check($('.apply-status-row').textContent.includes('Source work has not begun.'),'Claim acknowledgement alone does not imply source edits');
  showScenario('verifying');bridgeConnected=false;renderApplyRun(activeSession.applyRuns);check($('.apply-status-row').textContent.includes('preview is disconnected'),'Verification reports a disconnected preview without claiming completion');
  showScenario('passed-unverified');check($('.apply-evidence .status-chip').textContent==='Checks passed'&&!$('[data-run-navigation="delivery"]'),'Passed checks without a verified Delivery record do not expose a verified handoff');
  if(pilot)check(!$('.run-steps').textContent.includes('Applied and verified'),'Pilot final progress label avoids claiming verified Delivery before it exists');
  showScenario('verified');check($('.apply-status-row h2,.apply-status-row strong').textContent==='Verified'&&$('[data-run-navigation="delivery"]'),'Verified Delivery provenance enables the handoff destination');
  const handoffCalls=calls.length;
  deliveryRecordId='unrelated-record';deliveryTab='documentation';click('[data-run-navigation="delivery"]');
  check(activeMode==='delivery','Verified handoff action only navigates to Delivery');
  if(pilot){
   check(deliveryTab==='handoff'&&deliveryRecordId==='verified-record'&&verifiedDeliverySelection?.recordId==='verified-record','Verified handoff opens the exact matching record, not the first record or the remembered tab');
   check($('.delivery-record-detail h2')?.textContent==='Product introduction — verified handoff'&&$('[data-delivery-record="verified-record"]').getAttribute('aria-pressed')==='true'&&$('[data-delivery-record="unrelated-record"]').getAttribute('aria-pressed')==='false','Actual Delivery detail and sidebar agree on the exact verified handoff');
   check($('[data-delivery-tab="handoff"]').getAttribute('aria-selected')==='true'&&$('[data-delivery-tab="documentation"]').getAttribute('aria-selected')==='false'&&$('.delivery-mode').dataset.deliveryView==='handoff','Actual Delivery tabs expose Handoff as the selected view');
   check(document.activeElement===$('.delivery-record-detail h2')&&$('.delivery-mode').scrollTop===0&&$('.delivery-stage').scrollTop===0,'Explicit handoff navigation focuses the record heading and starts at the top');
   check($('.delivery-record-detail').dataset.readonly==='true'&&!$('[data-delivery-field]')&&$('[data-delivery-readonly-field="intent"]'),'Verified handoff uses the real read-only Delivery narrative rather than editable notes');
   const syntheticEvidence=engineeringEvidence(activeSession.deliveryRecords.find(item=>item.id==='verified-record'),activeSession.applyRuns);
   check(syntheticEvidence.length===2&&syntheticEvidence.every(item=>item.status==='passed')&&$$('.engineering-evidence .evidence-status').length===2&&$$('.engineering-evidence .evidence-status').every(item=>item.dataset.status==='passed'),'Both synthetic frozen change contexts match their acknowledged attempt and render passed in the actual engineering evidence table');
   click('[data-delivery-tab="documentation"]');click('[data-delivery-tab="handoff"]');check(deliveryRecordId==='verified-record','Switching Delivery tabs retains the requested verified record');
   click('[data-delivery-record="unrelated-record"]');check(verifiedDeliverySelection===null&&deliveryRecordId==='unrelated-record','Explicit Delivery row selection releases the exact-handoff pin');
   const rawNotes='Unsent earlier-record notes.  Preserve spacing.\\nA second line stays local.';input($('[data-delivery-field="intent"]'),rawNotes);
   click('[data-delivery-tab="documentation"]');setMode('review');click('[data-run-navigation="delivery"]');check($('.delivery-record-detail h2')?.textContent==='Product introduction — verified handoff','A handoff opens the requested record even after another record and tab were visited');
   click('[data-delivery-record="unrelated-record"]');check($('[data-delivery-field="intent"]').value===rawNotes&&!$('[data-next-save-narrative]').disabled,'Opening a verified handoff preserves unsaved notes on the previously viewed record');
   const mutations=['removed','replaced','superseded','reassigned','foreign-session','ambiguous','duplicate-id','run-reopened'];
   for(const kind of mutations){
    showScenario('verified');deliveryRecordId='unrelated-record';deliveryTab='documentation';const staleAction=$('[data-run-navigation="delivery"]'),before=calls.length;mutateVerifiedHandoff(activeSession,kind);staleAction.click();
    check(activeMode==='review'&&deliveryTab==='documentation'&&deliveryRecordId==='unrelated-record'&&verifiedDeliverySelection===null&&calls.length===before,'A captured handoff action rejects '+kind+' canonical evidence before navigation');
    if(kind==='replaced'){
     const currentAction=$('[data-run-navigation="delivery"]');check(!staleAction.isConnected&&currentAction&&currentAction!==staleAction&&!$('.apply-action-error'),'A replaced handoff removes its stale action and presents the newly resolved handoff without an obsolete error');
     currentAction.click();check(activeMode==='delivery'&&deliveryTab==='handoff'&&deliveryRecordId==='replacement-record'&&verifiedDeliverySelection?.recordId==='replacement-record'&&$('[data-delivery-record="replacement-record"]').getAttribute('aria-pressed')==='true','Only a fresh explicit action opens the replacement handoff record');
    }else check(Boolean($('.apply-action-error'))&&!staleAction.isConnected&&!$('[data-run-navigation="delivery"]'),'A '+kind+' handoff reports the current failure and removes its stale verified action');
    showScenario('verified');click('[data-run-navigation="delivery"]');mutateVerifiedHandoff(serverSession,kind);renderSession(serverSession);
    check(activeMode==='delivery'&&deliveryRecordId===''&&!$('.delivery-record-detail')&&!$('[data-delivery-record].is-active')&&$('[data-delivery-handoff-unavailable]')?.getAttribute('role')==='alert'&&$('#delivery-export').disabled,'An open '+kind+' handoff renders unavailable without selecting an unrelated record');
    click('[data-delivery-tab="documentation"]');click('[data-delivery-tab="handoff"]');check(deliveryRecordId===''&&Boolean($('[data-delivery-handoff-unavailable]')),'A '+kind+' handoff cannot regain an arbitrary fallback by changing tabs');
    click('[data-delivery-record="unrelated-record"]');check(verifiedDeliverySelection===null&&deliveryRecordId==='unrelated-record'&&$('.delivery-record-detail h2')?.textContent==='Earlier unrelated handoff','After '+kind+' evidence, only explicit row selection opens another handoff');
   }
   showScenario('verified');const olderAction=$('[data-run-navigation="delivery"]'),newerCalls=calls.length;activeSession.applyRuns.push(run('passed',{id:'newer-run'}));olderAction.click();check(activeMode==='review'&&calls.length===newerCalls&&toasts.at(-1).includes('displayed run has changed'),'A captured handoff action cannot navigate after a newer run replaces the report');
   showScenario('verified');const foreignAction=$('[data-run-navigation="delivery"]'),foreignCalls=calls.length;serverSession=session();serverSession.changeSet.id='different-batch';serverSession.changeSet.context.projectRoot='/isolated/other-project';renderSession(serverSession);foreignAction.click();check(activeMode==='review'&&calls.length===foreignCalls&&!verifiedDeliverySelection,'A detached handoff action cannot navigate a different project or batch');
   showScenario('verified');click('[data-run-navigation="delivery"]');serverSession.changeSet.context.projectRoot='/isolated/other-project';renderSession(serverSession);check(deliveryRecordId===''&&$('[data-delivery-handoff-unavailable]')?.textContent.includes('another session or project')&&!$('.delivery-record-detail'),'An open handoff cannot carry its record into another project');
  }else{
   check(deliveryTab==='documentation'&&deliveryRecordId==='unrelated-record'&&$('.delivery-mode').dataset.deliveryView==='documentation'&&!$('.delivery-record-detail'),'Gate off retains its original destination-only navigation and remembered Delivery tab');
  }
  check(calls.slice(handoffCalls).every(item=>item.type==='navigation'),'Verified handoff navigation, revalidation and preserved drafts use no transport or source mutation');
  showScenario('stale');check(originalNodes.run.hidden&&Boolean($('[data-after-id="new-edit"]')),'New pending edits take priority over stale completed run evidence');
  showScenario('cancelled');check(originalNodes.run.hidden&&$$('.change-row').length===3,'Cancelled runs return to the preserved Review ledger');
  showScenario('failed');check($('[data-run-action="retry"]')&&$('.apply-status-row').textContent.includes('Nothing retries automatically.'),'Failed runs require explicit retry and preserve failure evidence');
  if(pilot)check(originalNodes.run.textContent.includes('Synthetic type check failed in ProductIntro.tsx:43.'),'Pilot recovery exposes the recorded failure cause');
  failNext=true;click('[data-run-action="retry"]');await settle();check($('.apply-action-error')?.textContent.includes('not acknowledged')&&Boolean($('[data-run-action="retry"]')),'Unacknowledged retry shows an error and does not advance the run');
  holdNext=true;const retryBefore=calls.length;click('[data-run-action="retry"]');check($('[data-run-action="retry"]').disabled,'Recovery action remains disabled while its request is pending');click('[data-run-action="retry"]');check(calls.length===retryBefore+1,'Pending recovery action does not duplicate its request');releaseHeld();await settle();check(activeSession.applyRuns.at(-1).state==='queued'&&activeSession.applyRuns.at(-1).id!=='synthetic-run'&&activeSession.applyRuns.at(-1).retryOf==='synthetic-run'&&activeSession.applyRuns.at(-1).attempts===2&&calls.at(-1).url.endsWith('/retry'),'Retry acknowledgement creates a distinct queued run linked to the original frozen contract');
  showScenario('needs-attention');check($('[data-run-action="resume"]')&&$('.apply-status-row').textContent.includes('source changes may already exist'),'Interrupted source work offers Resume rather than discarding prior edits');
  if(pilot){const steps=$$('.run-step');check(steps[3].classList.contains('needs-attention')&&!steps[3].classList.contains('is-complete')&&steps[3].querySelector('span:last-child').textContent==='Needs attention'&&steps[4].querySelector('span:last-child').textContent==='Waiting'&&$('.apply-status-group .change-group-head > span').textContent==='3 of 6 complete','Interrupted rebuild remains the attention stage rather than a completed rebuild or active verification');}
  activeAgentPresence.connected=false;renderApplyRun(activeSession.applyRuns);check($('[data-run-action="resume"]').textContent==='Queue resume for agent','Offline recovery accurately offers a queued resume');click('[data-run-action="resume"]');await settle();
  if(pilot){check(activeSession.applyRuns.at(-1).state==='needs_attention'&&Boolean($('[data-run-action="confirm-resume"]'))&&calls.at(-1).method==='GET'&&calls.at(-1).url.endsWith('/resume-context'),'Preparing Resume only reads the current source and requires separate confirmation');click('[data-run-action="confirm-resume"]');await settle();check(activeSession.applyRuns.at(-1).state==='queued'&&activeSession.applyRuns.at(-1).id==='synthetic-run'&&calls.at(-1).url.endsWith('/resume')&&calls.at(-1).body.expectedRevision==='synthetic-revision'&&calls.at(-1).body.expectedDesignGraphRevision==='synthetic-graph','Resume sends explicit captured revisions and queues the same interrupted run');}
  else check(activeSession.applyRuns.at(-1).state==='needs_attention'&&$('.apply-action-error')?.textContent.includes('explicit expected source and design graph revisions')&&JSON.stringify(calls.at(-1).body)==='{}','Gate off retains its existing empty resume payload, honestly rejected by the runtime-shaped fixture');
  if(pilot){
   for(const [scenario,action]of [['failed','retry'],['needs-attention','confirm-resume']]){
    showScenario(scenario);if(action==='confirm-resume'){click('[data-run-action="resume"]');await settle();}const frozen=JSON.stringify(activeSession.applyRuns[0].reviewedChangeSet),before=calls.length,original=$('[data-run-action="'+action+'"]');holdNext=true;original.focus();original.click();
    serverSession.applyRuns[0].messages.push({state:serverSession.applyRuns[0].state,message:'Synthetic evidence update while request is held.'});serverSession.applyRuns[0].changedFiles.push('src/AdditionalEvidence.tsx');renderSession(serverSession);
    const replacement=$('[data-run-action="'+action+'"]');check(replacement!==original&&replacement.disabled&&replacement.getAttribute('aria-busy')==='true',action+' pending state and accessible busy feedback survive a full progress rerender');
    replacement.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));replacement.click();original.dispatchEvent(new MouseEvent('click',{bubbles:true}));await settle();
    check(calls.slice(before).filter(item=>item.type==='api').length===1,action+' replacement and detached action cannot issue duplicate recovery requests');
    setMode('canvas');setMode('review');check($('[data-run-action="'+action+'"]').disabled,action+' pending guard survives leaving and reopening the report');
    const queued=structuredClone(serverSession);queued.applyRuns[0].state='queued';renderSession(queued);const conflicting=$('[data-run-action="cancel"]');check(conflicting.disabled,action+' pending guard also disables a conflicting Stop action after a queued progress snapshot');conflicting.dispatchEvent(new MouseEvent('click',{bubbles:true}));check(calls.slice(before).filter(item=>item.type==='api').length===1&&cancelConfirmationRunId===null,action+' pending action cannot interleave cancellation or arm its confirmation');
    renderSession(serverSession);releaseHeld();await settle();const acknowledged=activeSession.applyRuns.at(-1);check(acknowledged.state==='queued'&&JSON.stringify(acknowledged.reviewedChangeSet)===frozen,action+' acknowledgement preserves the frozen reviewed contract');
    check(!applyRunActionBlocked()&&!applyRunActionPending&&$('[data-run-action="cancel"]')&&!$('[data-run-action="cancel"]').disabled,action+' acknowledgement and canonical refresh release pending controls');
   }
   showScenario('needs-attention');holdNext=true;failNext=true;const failedResumeBefore=calls.length;click('[data-run-action="resume"]');serverSession.applyRuns[0].messages.push({state:'needs_attention',message:'Still awaiting explicit recovery.'});renderSession(serverSession);releaseHeld();await settle();
   check(!applyRunActionBlocked()&&!$('[data-run-action="resume"]').disabled&&$('.apply-action-error')?.textContent.includes('not acknowledged')&&activeSession.applyRuns[0].state==='needs_attention'&&calls.length===failedResumeBefore+1,'Rejected resume unlocks an explicit retry without inventing progress or retrying automatically');
   click('[data-run-action="resume"]');await settle();check(activeSession.applyRuns[0].state==='needs_attention'&&Boolean($('[data-run-action="confirm-resume"]')),'An explicit retry after source-review failure still requires confirmation');click('[data-run-action="confirm-resume"]');await settle();check(activeSession.applyRuns[0].state==='queued','A separately confirmed retry after resume failure can be acknowledged');
   showScenario('failed');holdNext=true;click('[data-run-action="retry"]');serverSession.applyRuns[0].messages.push({state:'failed',message:'A concurrent canonical update forces reconciliation.'});renderSession(serverSession);failNextLoad=true;releaseHeld();await settle();
   check(applyRunActionError?.needsRefresh&&applyRunActionBlocked()&&$('.apply-action-error')?.textContent.includes('acknowledged')&&$('[data-run-action="retry"]').disabled,'Acknowledged retry with unavailable reconciliation keeps actions paused and distinguishes refresh failure from request failure');
   const pausedCalls=calls.length;$('[data-run-action="retry"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));check(calls.length===pausedCalls,'Reconciliation pause blocks another retry until fresh canonical state arrives');await loadSession();check(!applyRunActionBlocked()&&activeSession.applyRuns.at(-1).retryOf==='synthetic-run','A valid fresh session read recovers the paused retry without a second POST');
   showScenario('failed');holdNext=true;activeAgentPresence.connected=false;const departureToasts=toasts.length;click('[data-run-action="retry"]');const originalSession=serverSession;serverSession=session();serverSession.changeSet.id='different-batch';serverSession.changeSet.context.projectRoot='/isolated/different-project';serverSession.applyRuns=[run('failed',{id:'different-run'})];renderSession(serverSession);releaseHeld();await settle();
   check(activeSession.changeSet.id==='different-batch'&&activeSession.applyRuns[0].id==='different-run'&&!$('.apply-action-error')&&toasts.length===departureToasts,'A departed project ignores old retry success, error and queued notification');check(originalSession.applyRuns.at(-1).retryOf==='synthetic-run','Only the captured synthetic request session receives the departed acknowledgement');
   showScenario('failed');holdNext=true;activeAgentPresence.connected=false;const newerToasts=toasts.length;click('[data-run-action="retry"]');serverSession.applyRuns.push(run('failed',{id:'newer-unrelated-run'}));renderSession(serverSession);releaseHeld();await settle();
   check(activeSession.applyRuns.at(-1).id==='newer-unrelated-run'&&toasts.length===newerToasts,'A newer unrelated run is not replaced or given an old queued notification');
  }
  showScenario('applying');const stopBefore=calls.length;click('[data-run-action="cancel"]');check(calls.length===stopBefore&&$('[data-run-action="cancel"]').textContent==='Confirm stop','Stopping source work requires a second explicit confirmation');cancelConfirmationUntil=Date.now()-1;click('[data-run-action="cancel"]');check(calls.length===stopBefore&&$('[data-run-action="cancel"]').textContent==='Confirm stop','Expired stop confirmation requires a fresh confirmation');failNext=true;click('[data-run-action="cancel"]');await settle();check(activeSession.applyRuns.at(-1).state==='applying'&&$('.apply-action-error'),'Failed stop acknowledgement leaves the original run visible');click('[data-run-action="cancel"]');click('[data-run-action="cancel"]');await settle();check(activeSession.applyRuns.at(-1).state==='cancelled'&&originalNodes.run.hidden,'Acknowledged stop hides progress without erasing reviewed changes');
  showScenario('failed');click('[data-run-navigation="back"]');check(activeMode==='typography'&&dismissedApplyRunId==='synthetic-run'&&originalNodes.run.hidden,'Back from recovery dismisses only this run and restores the origin');
  if(pilot){
   showScenario('applying');serverSession.applyRuns[0].changedFiles=Array.from({length:32},(_,i)=>'src/synthetic/Component'+i+'.tsx');renderSession(serverSession);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const footer=$('.apply-footer'),stop=$('[data-run-action="cancel"]'),report=$('.foundry-apply-report');stop.focus();report.scrollTop=80;if(innerWidth<=800)originalNodes.run.scrollTop=80;const scroll=report.scrollTop,outerScroll=originalNodes.run.scrollTop;
   refinePilotApply(originalNodes.run,{run:activeSession.applyRuns[0],lifecycle:applyLifecyclePresentation(activeSession.applyRuns[0],{}),verifiedDelivery:false,stages:RUN_ORDER});
   check($('.apply-footer')===footer&&$('[data-run-action="cancel"]')===stop&&$$('.foundry-apply-report').length===1,'Pilot Apply refinement keeps original actions and report ownership without duplication');
   check(originalNodes.surface.inert,'Covered Review is inert while Apply progress is visible');
   serverSession.applyRuns[0].state='rebuilding';renderSession(serverSession);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   check(document.activeElement?.dataset.runAction==='cancel','Apply progress updates restore the same logical keyboard action');
   if(innerWidth>800)check(scroll>0&&$('.foundry-apply-report').scrollTop===scroll,'Apply report scroll survives a real progress rerender');
   else check(outerScroll>0&&originalNodes.run.scrollTop===outerScroll,'Narrow Apply outer scroll survives a same-run progress update');
   serverSession.applyRuns[0].id='different-synthetic-run';renderSession(serverSession);check($('.foundry-apply-report').scrollTop===0&&originalNodes.run.scrollTop===0,'A different run starts its report at the beginning rather than borrowing prior scroll');
   $('.foundry-apply-report').scrollTop=80;if(innerWidth<=800)originalNodes.run.scrollTop=80;setMode('canvas');setMode('review');check($('.foundry-apply-report').scrollTop===0&&originalNodes.run.scrollTop===0,'Reopening a hidden run starts at the report beginning');
   showScenario('cancelled');await settle();check(!originalNodes.surface.inert,'Review becomes interactive again when cancelled progress is hidden');
  }
  showScenario('ready');for(let i=0;i<4;i++){renderReview();renderApplyRun([]);}for(const[key,selector]of Object.entries({surface:'[data-mode-surface="review"]',changes:'#changes',summary:'#review-summary',summaryContent:'#review-summary-content',apply:'#apply-agent',compare:'#review-compare',return:'#review-return',run:'#apply-run'}))check($(selector)===originalNodes[key],key+' original shell node survives repeated renders');
  check(!calls.some(item=>item.type==='provider'||item.type==='publication'),'All source and recovery requests stay inside the synthetic transport');
  if(pilot){
   await document.fonts.ready;
   const geometryCalls=calls.length;
   for(const state of ['empty','ready','long-error']){
    showScenario(state);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const summary=originalNodes.summary,content=originalNodes.summaryContent,footer=summary.querySelector('.review-footer'),list=originalNodes.changes;
    const summaryBounds=summary.getBoundingClientRect(),contentBounds=content.getBoundingClientRect(),footerBounds=footer.getBoundingClientRect(),listBounds=list.getBoundingClientRect();
    const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
    check(!overlap(summaryBounds,listBounds)&&!overlap(footerBounds,listBounds),state+' Review summary and footer do not overlap the change list');
    check(contentBounds.bottom<=footerBounds.top+1&&footerBounds.top>=summaryBounds.top-1&&footerBounds.bottom<=summaryBounds.bottom+1,state+' Review summary contains its footer after the summary content');
    check(summary.scrollWidth<=summary.clientWidth+1&&footer.scrollWidth<=footer.clientWidth+1&&list.scrollWidth<=list.clientWidth+1,state+' Review summary, footer and list fit their widths');
    if(innerWidth<=800){
     const styles=getComputedStyle(summary);
     check(styles.minHeight==='0px'&&styles.maxHeight==='none'&&summary.scrollHeight<=summary.clientHeight+1,state+' narrow Review summary grows intrinsically without the shared fixed sidebar height');
     check(listBounds.top>=footerBounds.bottom-1,state+' narrow Review list follows all summary actions without overlap');
    }
    if(state==='long-error'){
     const error=$('#review-apply-error'),errorBounds=error.getBoundingClientRect();
     check(!error.hidden&&error.textContent.includes('Synthetic layout-only failure')&&$$('button',footer).every(button=>!overlap(errorBounds,button.getBoundingClientRect())),'Long Review error stays separate from the original action buttons');
     if(innerWidth>800)check(error.clientHeight>=60&&error.clientHeight<=160&&error.tabIndex===0&&getComputedStyle(error).overflowY==='auto'&&errorBounds.bottom<=footerBounds.top+1,'Desktop long errors retain a readable keyboard-scrollable area above the pinned actions');
    }
   }
   check(calls.slice(geometryCalls).every(item=>item.type==='navigation'),'Responsive Review geometry scenarios invoke no source or recovery transport');
   for(const state of ['ready','queued','needs-attention']){
    showScenario(state);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const reviewing=state==='ready',surface=reviewing?originalNodes.surface:originalNodes.run,rail=reviewing?originalNodes.summary:$('.apply-status-group'),report=reviewing?originalNodes.changes:$('.foundry-apply-report'),footer=reviewing?$('.review-summary .review-footer'):$('.apply-footer');
    const bounds=surface.getBoundingClientRect(),railBounds=rail.getBoundingClientRect(),footerBounds=footer.getBoundingClientRect();
    check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1&&surface.scrollWidth<=surface.clientWidth+1&&report.scrollWidth<=report.clientWidth+1,state+' has no workspace or report horizontal overflow');
    check(footerBounds.left>=bounds.left-1&&footerBounds.right<=bounds.right+1,state+' footer fits the workspace width');
    if(innerWidth>800){
     const railWidth=320;
     check(Math.abs(railBounds.width-railWidth)<=1,state+' uses the shared '+railWidth+'px sidebar at this viewport');
     check(footerBounds.bottom<=bounds.bottom+1,state+' actions remain inside the visible workspace footer');
     if(!reviewing)check(report.getBoundingClientRect().bottom<=footerBounds.top+1,state+' scrollable report does not overlap its actions');
    }else{
     const layout=reviewing?surface:$('.apply-surface');
     check(getComputedStyle(layout).display==='flex'&&Math.abs(railBounds.width-surface.clientWidth)<=1&&report.getBoundingClientRect().top>=railBounds.bottom-1,state+' stacks its full-width sidebar above the report at narrow widths');
     check(getComputedStyle(report).overflowY==='visible'&&getComputedStyle(report).overscrollBehaviorY==='auto',state+' report permits outer workspace scrolling on narrow screens');
     check($$('button',footer).every(button=>button.getBoundingClientRect().height<=64),state+' narrow action buttons retain compact heights rather than stretched flex bases');
    }
   }
   showScenario('ready');
  }
  $('#test-results').textContent='PASS: '+checks.length+' isolated assertions';$('#test-results').dataset.result='pass';$('#test-details').textContent=checks.map((label,i)=>(i+1)+'. '+label).join(String.fromCharCode(10));$('#fixture-action').textContent='Real renderer and actions; synthetic session and transport only. No source mutation.';
 }catch(error){$('#test-results').textContent='FAIL: '+error.message;$('#test-results').dataset.result='fail';$('#test-details').textContent=error.stack;console.error(error);}
 finally{for(const timer of timers)window.clearTimeout(timer);timers.clear();fixtureRunning=false;$('#fixture-rerun').disabled=false;for(const control of [failureControl,holdControl,releaseControl,refreshControl,...handoffControls])control.disabled=false;}
}
$('#fixture-rerun').addEventListener('click',runAssertions);await runAssertions();
`;
const diagnostics = `window.addEventListener('error',event=>{const target=document.querySelector('#fixture-errors');if(target)target.textContent+=(event.error?.stack||event.message||'Resource failed')+'\\n';},true);window.addEventListener('unhandledrejection',event=>{document.querySelector('#fixture-errors').textContent+=String(event.reason?.stack||event.reason)+'\\n';});`;
const states = [
  'ready',
  'unresolved',
  'conflicts',
  'excluded',
  'empty',
  'long-error',
  'agent-offline',
  'preview-offline',
  'queued',
  'claimed',
  'applying',
  'rebuilding',
  'verifying',
  'passed-unverified',
  'verified',
  'needs-attention',
  'failed',
  'cancelled',
  'stale',
];
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Foundry Review — isolated pilot fixture</title><script>${diagnostics}</script><script type="importmap">{"imports":{"foundry-design-protocol/engineering-verification":"/fixture-protocol/engineering-verification.js"}}</script>${stylesheets}<style>
html,body{margin:0;height:100%;overflow:hidden}body{display:flex;flex-direction:column}.fixture-toolbar{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 16px;background:#e9edf5;color:#17243d;font:12px/18px Arial,sans-serif;border-bottom:1px solid #b8c3d5}.fixture-toolbar button{border:1px solid #8a9bb8;border-radius:4px;padding:4px 8px;background:white;color:#17243d;font:12px/18px Arial,sans-serif}.fixture-toolbar button[aria-pressed=true]{background:#17243d;color:white}.fixture-toolbar pre{position:absolute;z-index:100;max-width:calc(100vw - 32px);max-height:50vh;overflow:auto;padding:16px;margin:8px 0;background:white;color:#17243d;border:1px solid #8a9bb8;white-space:pre-wrap}#app-shell.app-shell[data-next]{display:block;flex:1 1 auto;min-height:0;width:100%;height:auto}#app-shell>.center-workspace{position:relative;height:100%;min-height:0;width:100%;overflow:hidden}#fixture-navigation:not([hidden]){position:absolute;inset:auto 20px 20px;z-index:100;background:#e9edf5;color:#17243d;padding:16px;border:1px solid #8a9bb8}[data-result=fail]{color:#ae1b1b}
</style></head><body><header class="fixture-toolbar" aria-label="Isolated test controls"><strong>Review / Apply fixture · synthetic data</strong><span id="fixture-state"></span><nav aria-label="Fixture states">${states.map((state) => `<button type="button" data-fixture-state="${state}" aria-pressed="false">${state}</button>`).join(' ')}</nav><button id="fixture-theme">Toggle UI theme</button><button id="fixture-rerun">Run checks again</button><a href="/?foundations=off&theme=light">Previous design</a><a href="/?theme=light">Default design</a><a href="/?foundations=pilot&theme=light">Pilot alias</a><details><summary id="test-results">Running isolated assertions</summary><pre id="test-details"></pre></details><details><summary>Runtime errors</summary><pre id="fixture-errors"></pre></details><span role="status" id="fixture-action">No live session.</span></header><div id="app-shell" class="app-shell" data-next="true" data-mode="review" data-experience="precision"><section class="center-workspace">${markup}${applyMarkup}${deliveryMarkup}<p id="fixture-navigation" hidden></p></section></div><div hidden><button id="compare"></button><p id="canvas-action-error"></p><p id="canvas-action-error-detail"></p></div><script type="module">${script}</script></body></html>`;
if (process.argv.includes('--check')) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: diagnostics + script,
    encoding: 'utf8',
  });
  if (result.status !== 0) process.stderr.write(result.stderr || String(result.error));
  else console.log('Review fixture extraction and module syntax: PASS');
  process.exit(result.status ?? 1);
}
const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};
const port = Number(process.env.FOUNDRY_REVIEW_FIXTURE_PORT ?? 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid fixture port');
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  response.setHeader('Cache-Control', 'no-store');
  try {
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
    response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, '127.0.0.1', function () {
  console.log(
    'Isolated Review pilot fixture: http://127.0.0.1:' +
      this.address().port +
      '/?foundations=pilot&theme=light',
  );
  console.log('Synthetic data and transport only. No live session, source writer or provider.');
});
