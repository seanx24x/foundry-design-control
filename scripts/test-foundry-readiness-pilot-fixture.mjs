// Real readiness controller, original native dialog and connection/reconnect bindings.
// Only reports, recovery transport, preview transport and polling clock are synthetic.
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'apps/inspector/dist');
const index = await readFile(resolve(root, 'apps/inspector/public/index.html'), 'utf8');
const app = await readFile(resolve(root, 'apps/inspector/public/app.js'), 'utf8');
const workspace = await readFile(resolve(root, 'apps/inspector/public/next-workspace.js'), 'utf8');
function between(text, start, end) {
  const first = text.indexOf(start),
    last = text.indexOf(end, first + start.length);
  if (first < 0 || last <= first) throw Error('Missing extraction boundary: ' + start);
  return text.slice(first, last);
}
function dialog(id) {
  const at = index.indexOf('id="' + id + '"'),
    start = index.lastIndexOf('<dialog', at),
    end = index.indexOf('</dialog>', at);
  if (at < 0 || start < 0 || end < at) throw Error('Missing native dialog: ' + id);
  return index.slice(start, end + 9);
}
const stylesheets = [...index.matchAll(/<link\s+rel="stylesheet"\s+href="[^"]+"\s*\/?>/g)]
  .map((match) => match[0])
  .join('');
const fallbackMarkup = index.match(
  /<div class="preview-fallback" id="preview-fallback" hidden>[\s\S]*?<\/div>/,
)?.[0];
if (!fallbackMarkup) throw Error('Missing original preview fallback');
const connectionSource = between(
  workspace,
  "  const liveTrigger = $('#live-status');",
  '  // Tools owns workspace navigation.',
);
const fallbackSource = between(
  app,
  'function showPreviewRecoveryFallback(',
  'function resetPreviewRecovery(',
);
const reconnectSource = between(
  app,
  'function reconnectCanvasPreview()',
  'function setupPreview()',
);
const script = `
import { foundryFoundationsEnabled } from '/foundry-foundations.js';
import {createReadinessUI} from '/readiness-ui.js';
import {refinePilotReadiness,refinePilotConnection,refinePilotPreviewFallback} from '/foundry-pilot-readiness.js';
import {foundryPilotIcon} from '/foundry-pilot-icons.js';
import {previewRecoveryBlocked,previewReconnectBlocked} from '/preview-recovery.js';
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const params=new URLSearchParams(location.search),pilot=foundryFoundationsEnabled(),sessionId='isolated-readiness-fixture';
if(pilot)document.documentElement.dataset.foundryPilot='canvas';
const foundryPilotActive=()=>pilot;
const shell=$('#app-shell'),calls=[],intervals=new Map();let intervalId=0;
window.setInterval=(callback,delay)=>{const id=++intervalId;intervals.set(id,{callback,delay});return id;};
window.clearInterval=id=>intervals.delete(id);
const icon=name=>foundryPilotIcon(name)||'';
function renderIcons(root=document){for(const node of $$('[data-icon]',root)){const markup=icon(node.dataset.icon);if(markup)node.outerHTML=markup;}}
const baseModel=()=>({runtimeConnected:true,connected:true,previewConnected:true,listenerConnected:true,session:{changeSet:{changes:[]},applyRuns:[],designHistory:[]},selection:{id:'headline',label:'Headline',source:{file:'src/Hero.tsx',line:12},confidence:'instrumented'}});
const baseReport=()=>({ready:true,checkedAt:'2026-10-31T12:00:00.000Z',capabilities:{inspect:true,stage:true,apply:true},checks:[
 {id:'runtime',label:'Local runtime',status:'passed',detail:'The local Foundry runtime is connected.'},
 {id:'preview',label:'Live preview',status:'passed',detail:'The project preview is reporting its rendered elements.'},
 {id:'source',label:'Source mapping',status:'passed',detail:'The selected element has an instrumented source reference.'},
 {id:'listener',label:'Apply listener',status:'passed',detail:'A coding agent is available for reviewed work.'}
]});
let model=baseModel(),report=baseReport(),failNext=false,holdNext=false,releaseHeld=null,recoverFailure=false,recoverHeld=false,releaseRecovery=null,running=false,useRealReconnect=false;
const state=()=>model;
async function api(url,options={}){calls.push({type:'readiness',url,method:options.method||'GET',signal:options.signal});const snapshot=structuredClone(report);if(holdNext){holdNext=false;await new Promise(resolve=>releaseHeld=resolve);}if(failNext){failNext=false;throw Error('Synthetic <probe> unavailable. Saved edits are preserved.');}return snapshot;}
async function recover(id){calls.push({type:'recover',id});if(recoverHeld){recoverHeld=false;await new Promise(resolve=>releaseRecovery=resolve);}if(recoverFailure){recoverFailure=false;throw Error('Synthetic recovery failed; no connection was restored.');}if(useRealReconnect&&id==='reconnect-preview')reconnectCanvasPreview();}
function navigate(action){calls.push({type:'navigate',action});$('#fixture-destination').textContent='Synthetic navigation: '+action;}
const ui=createReadinessUI({api,sessionId,state,navigate,recover,renderIcons,bindStatusTrigger:false});
const openConnection=()=>ui.open();
${connectionSource}
let previewUrl='/fixture-preview',preview={contentWindow:{},src:'/fixture-preview'},reconnectCount=0,activeSession=model.session;
function toast(message){calls.push({type:'toast',message});}
function rejectPendingFrameCommands(target,message,code){calls.push({type:'preview-reject',target,message,code});}
function resetPreviewRecovery(){reconnectCount++;$('#preview-fallback').hidden=true;$('#preview-loading').hidden=false;}
function renderConnectionStatus(){calls.push({type:'connection-render'});}
${fallbackSource}
${reconnectSource}
const original={dialog:$('#readiness-dialog'),checks:$('#readiness-checks'),guide:$('#workflow-trigger'),refresh:$('#readiness-refresh'),next:$('#workflow-next'),close:$('#readiness-close'),command:$('#readiness-command'),fallback:$('#preview-fallback'),fallbackTitle:$('#preview-fallback strong'),fallbackMessage:$('#preview-fallback p'),reconnect:$('#reconnect-preview'),direct:$('#direct-preview')};
const canvasStage=$('.fixture-preview');canvasStage.id='canvas-stage';
const previewFrame=document.createElement('div');previewFrame.id='preview-frame';previewFrame.style.cssText='width:100%;min-height:320px;transform:translate(84px,32px) scale(.6);transform-origin:0 0';canvasStage.append(previewFrame);previewFrame.append($('#preview-loading'),original.fallback);
function configurePreview(url){previewUrl=url;original.direct.hidden=!url;if(url)original.direct.href=url;else original.direct.removeAttribute('href');}
configurePreview('/fixture-preview');refinePilotPreviewFallback();renderIcons();ui.update();
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();await new Promise(resolve=>setTimeout(resolve,0));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));for(let i=0;i<30;i++)await Promise.resolve();};
const key=(node,key)=>{const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});node.dispatchEvent(event);return event;};
async function close(){if(original.dialog.open)original.dialog.close();if(connection.matches(':popover-open'))connection.hidePopover();await settle();}
async function scenario(name,{open=true}={}){
 await close();failNext=false;holdNext=false;recoverFailure=false;recoverHeld=false;useRealReconnect=false;model=baseModel();activeSession=model.session;report=baseReport();configurePreview('/fixture-preview');$('#fixture-scenario').value=name;
 if(name==='listener-offline'){model.listenerConnected=false;report.ready=false;report.capabilities.apply=false;report.checks[3]={id:'listener',label:'Apply listener',status:'warning',detail:'Inspection remains available. No agent is listening for Apply work.',recovery:{id:'listener-start',label:'Show listener instructions',command:'npx foundry listen'}};}
 if(name==='no-preview'){model.connected=model.previewConnected=false;report.ready=false;report.capabilities={inspect:false,stage:false,apply:false};report.checks[1]={id:'preview',label:'Live preview',status:'failed',detail:'No live preview is connected.',recovery:{id:'reconnect-preview',label:'Reconnect preview'}};}
 if(name==='unmapped'){model.selection={id:'unmapped',label:'Unmapped heading',confidence:'unresolved'};report.ready=false;report.capabilities.apply=false;report.checks[2]={id:'source',label:'Source mapping',status:'warning',detail:'This selection is not mapped to an editable source location.'};}
 if(name==='unknown'){report={ready:false,checkedAt:null,checks:[]};model.runtimeConnected=false;}
 if(name==='failed'){report={ready:false,checks:[]};failNext=true;}
 if(name==='command'){report.ready=false;report.capabilities.apply=false;report.checks[3]={id:'listener',label:'Agent integration',status:'warning',detail:'Agent setup needs a terminal step.',recovery:{id:'configure-agent',label:'Show setup command',command:['printf "<scr','ipt>not executed</scr','ipt>"'].join(''),requiresAgentRestart:true}};}
 if(name==='recovery'){model.previewConnected=model.connected=false;report.ready=false;report.capabilities={inspect:false,stage:false,apply:false};report.checks[1]={id:'preview',label:'Preview connection',status:'failed',detail:'Reconnect the existing project preview.',recovery:{id:'reconnect-preview',label:'Reconnect preview'}};}
 if(name==='staged'){model.session.changeSet.changes=[{id:'draft',status:'draft'},{id:'excluded',status:'rejected'},{id:'done',status:'applied'}];model.listenerConnected=false;report.ready=false;report.capabilities.apply=false;}
 ui.update();updateConnection();if(open)await ui.open();await settle();
}
$('#fixture-scenario').addEventListener('change',event=>void scenario(event.target.value));
$('#fixture-open').addEventListener('click',()=>void ui.open());
$('#fixture-poll').addEventListener('click',()=>{for(const timer of intervals.values())timer.callback();});
$('#fixture-fallback').addEventListener('click',()=>{void close();configurePreview('/fixture-preview');showPreviewRecoveryFallback();refinePilotPreviewFallback();});
$('#fixture-no-preview').addEventListener('click',()=>{void close();configurePreview(null);showPreviewRecoveryFallback('No preview configured','Configure a project preview URL to connect. Your saved edits remain in Review.');refinePilotPreviewFallback();});
$('#fixture-theme').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';});
function capabilityStates(){return [...document.querySelectorAll('[data-readiness-capability]')].map(node=>({name:node.dataset.readinessCapability,status:node.dataset.state,text:node.textContent}));}
async function runAssertions(){
 if(running)return;running=true;$('#fixture-rerun').disabled=true;$('#test-results').dataset.result='running';$('#test-details').textContent='';
 const checks=[],check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
 try{
  await scenario('ready');
  check(original.dialog.open&&original.dialog.matches(':modal'),'Real readiness opener exposes the existing native modal');
  check(intervals.size===1&&[...intervals.values()][0].delay===2000,'Original controller owns exactly one two-second polling interval');
  check(original.checks.querySelectorAll('.readiness-check').length===4&&$('#readiness-summary').textContent==='Ready for a reviewed design change.','Ready report renders its actual checks and summary');
  check($$('[data-workflow-step][aria-current="step"]').length===1&&$('[data-workflow-step][aria-current]').dataset.workflowStep==='1','Only the current workflow step is indicated, not a fabricated completed journey');
  const row=original.checks.firstElementChild;await ui.load();check(original.checks.firstElementChild===row,'An unchanged background report retains original check node identity');if(pilot){report.checks.unshift({id:'unconfirmed',label:'Additional adapter',status:'unknown',detail:'No result was reported for this adapter.'});await ui.load();const unknown=original.checks.querySelector('[data-status="unknown"]');check(unknown.querySelector('.readiness-result').textContent==='Not confirmed'&&unknown===original.checks.lastElementChild,'Unknown check statuses are not rewritten as passed and follow confirmed diagnostics');}
  check(calls.filter(call=>call.type==='readiness').every(call=>call.method==='GET'&&call.url==='/v1/sessions/isolated-readiness-fixture/readiness'&&call.signal instanceof AbortSignal),'Actual readiness requests are read-only and retain their timeout signal');
  $('#fixture-open').focus();check(original.dialog.contains(document.activeElement),'Native modal prevents focus moving into covered fixture controls');
  const beforeNavigate=calls.length;original.next.click();await settle();check(!original.dialog.open&&calls.slice(beforeNavigate).some(call=>call.type==='navigate'&&call.action==='selection'),'Current-step action uses original selection navigation and closes readiness');check(intervals.size===0,'Closing readiness stops polling');
  await scenario('listener-offline');check($('#agent-connection-status').textContent==='Agent offline'&&$('#workflow-phase').textContent==='Temporary preview','Listener offline does not incorrectly block an available inspected selection');
  if(pilot){const capabilities=capabilityStates();check(capabilities.length===3,'Pilot exposes all three distinct readiness capabilities');check(capabilities.some(item=>item.name==='inspect'&&item.status==='available')&&capabilities.some(item=>item.name==='apply'&&item.status==='unavailable'),'Inspection and Apply are independently reported from explicit capability booleans');check(original.checks.firstElementChild.dataset.status==='warning','Attention checks appear before passed configuration checks');}
  await scenario('no-preview');check($('#workflow-phase').textContent==='Connect'&&$('[data-workflow-step][aria-current]').dataset.workflowStep==='0','Missing preview stays at Connect rather than implying source readiness');if(pilot)check(original.checks.firstElementChild.dataset.status==='failed','Failed checks lead the original diagnostics list');const noNav=calls.filter(call=>call.type==='navigate').length;original.next.click();await settle();check(original.dialog.open&&calls.filter(call=>call.type==='navigate').length===noNav,'Connect action rechecks readiness instead of navigating into a nonexistent preview');
  await scenario('unmapped');check(original.next.textContent==='Inspect source mapping'&&$('#workflow-detail').textContent.toLowerCase().includes('source'),'Unmapped selection offers source inspection without claiming source Apply');
  await scenario('unknown');if(pilot)check(capabilityStates().length===3&&capabilityStates().every(item=>item.status==='unknown'),'Missing capability fields remain unknown rather than false or ready');check(!original.checks.querySelector('.readiness-check'),'An empty report does not fabricate passing checks');
  await scenario('failed');check($('#readiness-summary').textContent.includes('unavailable')&&original.checks.textContent.includes('<probe>')&&!original.checks.querySelector('probe'),'Failed probes preserve truthful summary and literal error text');if(pilot)check(capabilityStates().every(item=>item.status==='unknown'),'Failed readiness requests clear previous capability claims');
  await scenario('command');const commandBefore=calls.length;original.checks.querySelector('[data-readiness-recovery]').click();await settle();check(!original.command.hidden&&original.command.querySelector('code').textContent===report.checks[3].recovery.command&&!original.command.querySelector('script'),'Recovery shell instructions are rendered as inert literal text');check(calls.length===commandBefore&&original.command.textContent.includes('No configuration is changed here'),'Displaying a command never invokes recovery, requests or shell execution');
  report.checks[3].recovery={id:'restart-agent',label:'Show restart instructions',requiresAgentRestart:true};await ui.load();if(pilot)check(original.command.hidden,'Changing a recovery invalidates previously displayed terminal instructions');original.checks.querySelector('[data-readiness-recovery]').click();check(original.command.querySelector('code').hidden&&original.command.textContent.includes('cannot restart the agent'),'Restart-only recovery does not invent a terminal command or restart claim');await close();check(original.command.hidden&&intervals.size===0,'Native close hides terminal instructions and cleans polling');
  if(pilot){await scenario('command');original.checks.querySelector('[data-readiness-recovery]').click();original.command.querySelector('code').focus();delete report.checks[3].recovery;await ui.load();check(original.command.hidden&&document.activeElement===original.refresh,'Resolved manual recovery hides stale instructions and returns held code focus to refresh');await scenario('command');original.checks.querySelector('[data-readiness-recovery]').click();const retainedRecovery=JSON.stringify(report.checks[3].recovery);report.checks[3].status='passed';await ui.load();check(original.command.hidden&&JSON.stringify(report.checks[3].recovery)===retainedRecovery,'A passed check hides old manual instructions even when identical recovery metadata is retained');await scenario('command');original.checks.querySelector('[data-readiness-recovery]').click();failNext=true;await ui.load();check(original.command.hidden,'A failed probe hides unconfirmed recovery instructions');}
  if(pilot){
   await scenario('recovery');report.checks[2].recovery={id:'reindex-project',label:'Re-index project'};report.checks[3].recovery={id:'configure-agent',label:'Show manual instructions',command:'npx foundry listen'};await ui.load();recoverHeld=true;const first=original.checks.querySelector('[data-readiness-recovery="preview"]'),start=calls.length;first.click();await settle();
   check([...original.checks.querySelectorAll('[data-readiness-recovery]')].every(button=>button.disabled),'One pending recovery disables every recovery action, including command-only alternatives');
   report.checks[1].detail='A fresh report arrived while reconnect was still pending.';await ui.load({background:true});const replaced=original.checks.querySelector('[data-readiness-recovery="preview"]');
   check(replaced!==first&&!first.isConnected&&replaced.disabled&&replaced.getAttribute('aria-busy')==='true','Polling preserves transaction ownership and busy state after replacing the original recovery button');
   for(const button of original.checks.querySelectorAll('[data-readiness-recovery]'))button.dispatchEvent(new MouseEvent('click',{bubbles:true}));await settle();
   check(calls.slice(start).filter(call=>call.type==='recover').length===1&&original.command.hidden,'Delegated duplicate and alternative recovery clicks are rejected even when forcibly dispatched');
   await close();await ui.open();await settle();check([...original.checks.querySelectorAll('[data-readiness-recovery]')].every(button=>button.disabled),'Close and reopen retain the pending recovery lock');
   releaseRecovery();await settle();check([...original.checks.querySelectorAll('[data-readiness-recovery]')].every(button=>!button.disabled&&!button.hasAttribute('aria-busy')),'Acknowledgement releases the lock on current controls, not only a detached original');
   recoverHeld=true;const retryStart=calls.length;original.checks.querySelector('[data-readiness-recovery="source"]').click();await settle();check(calls.slice(retryStart).filter(call=>call.type==='recover').length===1&&calls.at(-1).id==='reindex-project','A deliberate subsequent recovery keeps its own exact action identifier');releaseRecovery();await settle();
   await scenario('recovery');recoverHeld=true;recoverFailure=true;original.checks.querySelector('[data-readiness-recovery]').click();await settle();report.checks[1].detail='Fresh diagnostics before a rejected recovery.';await ui.load({background:true});releaseRecovery();await settle();check(original.checks.textContent.includes('Synthetic recovery failed')&&original.dialog.open,'Recovery rejection after report replacement remains visible and does not close the dialog');await ui.load();check(!original.checks.querySelector('[data-readiness-recovery]').disabled,'A failed transaction releases the lock for an explicit later retry');
  }
  if(pilot){
   await scenario('recovery');activeSession.applyRuns=[{state:'applying'}];activeSession.changeSet.changes=[{id:'saved-draft',status:'draft'}];useRealReconnect=true;const blockedStart=calls.length,blockedResets=reconnectCount,blockedSrc=preview.src,savedChanges=JSON.stringify(activeSession.changeSet.changes);original.checks.querySelector('[data-readiness-recovery]').click();await settle();
   check(original.checks.textContent.includes('cannot reconnect while Apply is queued or changing source')&&original.dialog.open,'Readiness exposes the real reconnect guard while source Apply is changing source');
   check(reconnectCount===blockedResets&&preview.src===blockedSrc&&!calls.slice(blockedStart).some(call=>call.type==='preview-reject')&&JSON.stringify(activeSession.changeSet.changes)===savedChanges,'Blocked readiness reconnect does not reject frame commands, reset or reload preview, or alter saved changes');
   activeSession.applyRuns=[{state:'verifying'}];await ui.load();const verifyingResets=reconnectCount;original.checks.querySelector('[data-readiness-recovery]').click();await settle();check(reconnectCount===verifyingResets+1&&$('#workflow-phase').textContent==='Verifying'&&activeSession.applyRuns[0].state==='verifying'&&!model.previewConnected,'A deliberate readiness reconnect is allowed during verification without claiming connection or verification success');
   check(previewRecoveryBlocked(activeSession.applyRuns)&&!previewReconnectBlocked(activeSession.applyRuns)&&JSON.stringify(activeSession.changeSet.changes)===savedChanges,'Verification reconnect retains the separate temporary-edit replay block and preserves reviewed changes');
   activeSession.applyRuns=[{state:'passed'}];await ui.load();original.checks.querySelector('[data-readiness-recovery]').click();await settle();check(reconnectCount===blockedResets+2,'A deliberate readiness reconnect is also allowed after the Apply run finishes');
   await close();activeSession.applyRuns=[{state:'rebuilding'}];showPreviewRecoveryFallback();const fallbackStart=calls.length,fallbackResets=reconnectCount;original.reconnect.click();await settle();check(reconnectCount===fallbackResets&&calls.slice(fallbackStart).some(call=>call.type==='toast'&&call.message.includes('cannot reconnect while Apply is queued or changing source')),'Fallback reconnect catches the source-work guard and explains it without reloading the product');useRealReconnect=false;
  }
  await scenario('recovery');recoverHeld=true;const recoveryButton=original.checks.querySelector('[data-readiness-recovery]'),recoverBefore=calls.length;recoveryButton.click();await settle();check(recoveryButton.disabled&&calls.slice(recoverBefore).filter(call=>call.type==='recover').length===1,'Pending recovery disables the original action while awaiting acknowledgement');check(calls.at(-1).id==='reconnect-preview','Recovery preserves the original recovery identifier');releaseRecovery();await settle();check(calls.slice(recoverBefore).filter(call=>call.type==='readiness').length===1&&!recoveryButton.disabled,'Acknowledged recovery rechecks the actual report and reenables its action');check($('#workflow-phase').textContent==='Connect','Recovery acknowledgement alone does not claim the preview reconnected');
  recoverFailure=true;original.checks.querySelector('[data-readiness-recovery]').click();await settle();check(original.checks.textContent.includes('Synthetic recovery failed')&&original.dialog.open,'Failed recovery remains visible without closing the dialog or claiming success');
  await scenario('recovery');report.checks.push(...Array.from({length:16},(_,i)=>({id:'detail-'+i,label:'Additional configuration '+i,status:'warning',detail:'Synthetic additional diagnostic for testing scroll continuity.'})));await ui.load();const scroller=$('.readiness-body'),focused=original.checks.querySelector('[data-readiness-recovery]');focused.focus({preventScroll:true});scroller.scrollTop=100;const scroll=scroller.scrollTop;report.checks[0].detail='Updated transport detail';await ui.load();check(document.activeElement.dataset.readinessRecovery==='preview','Actual report replacement restores logical recovery focus');check(Math.abs(scroller.scrollTop-scroll)<2,'Actual report replacement preserves readiness body scroll');if(pilot){delete report.checks[1].recovery;await ui.load();check(document.activeElement===original.refresh,'A removed focused recovery action falls back to the existing refresh control');}
  await scenario('ready');holdNext=true;const beforeLoad=calls.length;const pending=ui.load();await settle();check(original.refresh.disabled&&original.refresh.textContent==='Checking…','Foreground check presents its genuine loading state');await ui.load();await ui.load();for(const timer of intervals.values())timer.callback();await settle();check(calls.length===beforeLoad+1,'Concurrent foreground and background probes do not overlap in flight');releaseHeld();await pending;await settle();check(calls.length===beforeLoad+2&&!original.refresh.disabled,'Repeated foreground refreshes coalesce into one follow-up request');
  holdNext=true;const beforeBackground=calls.length;for(const timer of intervals.values())timer.callback();await settle();check(!original.refresh.disabled&&calls.length===beforeBackground+1,'Background polling does not unnecessarily disable manual refresh');model.listenerConnected=false;ui.update();ui.update();await settle();check(calls.length===beforeBackground+1,'Connection changes coalesce behind an in-flight probe');releaseHeld();await settle();check(calls.length===beforeBackground+2,'Connection change schedules exactly one refreshed report');
  holdNext=true;const beforeClose=calls.length;const closing=ui.load();await ui.load();await close();check(intervals.size===0,'Close clears the poll clock even while a probe is pending');releaseHeld();await closing;await settle();check(calls.length===beforeClose+1&&!original.dialog.open,'Closing suppresses a queued follow-up and does not reopen after an in-flight response');
  await scenario('staged');check($('#persistent-review-count').textContent==='1'&&$('#workflow-phase').textContent==='Staged','Review count excludes terminal changes and retains saved work when listener is offline');original.next.click();await settle();check(calls.at(-1).type==='navigate'&&calls.at(-1).action==='review','Saved edits navigate to Review using the original action');
  model=baseModel();model.listenerConnected=false;updateConnection();key(liveTrigger,'ArrowDown');await settle();check(connection.matches(':popover-open')&&document.activeElement===connection.querySelector('button'),'Original connection ArrowDown opens the native popover and focuses details');check(connection.querySelector('[data-next-connection="listenerConnected"]').textContent==='Not listening'&&connection.querySelector('[data-next-connection="connected"]').textContent==='Connected','Original connection labels keep preview and listener states separate');connection.querySelector('button').click();await settle();check(original.dialog.open&&!connection.matches(':popover-open'),'Connection details uses the real opener and dismisses the popover');await close();
  configurePreview('/fixture-preview');showPreviewRecoveryFallback();refinePilotPreviewFallback();check(!original.fallback.hidden&&original.fallbackTitle.textContent==='Live preview unavailable'&&!original.reconnect.disabled&&!original.direct.hidden,'Original unavailable-preview presentation remains functional');const originalFallbackNodes=[original.fallbackTitle,original.fallbackMessage,original.reconnect,original.direct];refinePilotPreviewFallback();check(originalFallbackNodes.every(node=>node.isConnected&&original.fallback.contains(node)),'Repeated fallback refinement preserves all original message/action nodes');
  await settle();if(pilot){const host=$('.foundry-preview-status');check(host.parentElement===canvasStage&&host!==previewFrame&&original.fallback.parentElement===host&&$('#preview-loading').parentElement===host&&!previewFrame.contains(original.fallback),'Pilot moves original fallback and loading nodes into an unscaled sibling of the preview frame');const fallbackBounds=original.fallback.getBoundingClientRect(),frameBounds=previewFrame.getBoundingClientRect();check(Math.abs(fallbackBounds.width-original.fallback.offsetWidth)<1.5&&Math.abs(frameBounds.width-previewFrame.offsetWidth*.6)<1.5,'Recovery geometry remains at native scale while the synthetic preview is scaled to sixty percent');}else check(original.fallback.parentElement===previewFrame&&$('#preview-loading').parentElement===previewFrame&&!$('.foundry-preview-status'),'Gate off keeps original statuses inside the transformed preview frame');
  const reconnectBefore=reconnectCount;original.reconnect.click();check(reconnectCount===reconnectBefore+1&&original.fallback.hidden&&!$('#preview-loading').hidden&&calls.some(call=>call.type==='preview-reject'&&call.code==='WORKSPACE_FRAME_RELOADED'),'Reconnect retains original frame-reset behavior without claiming successful restoration');
  if(pilot){const stage=$('#canvas-stage');let pointerEscapes=0,wheelEscapes=0;const onPointer=()=>pointerEscapes++,onWheel=()=>wheelEscapes++;stage.addEventListener('pointerdown',onPointer);stage.addEventListener('wheel',onWheel);try{for(const mode of ['Pan','Interact']){showPreviewRecoveryFallback();stage.dataset.syntheticInteraction=mode;const pointer=new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:1});const wheel=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120});original.reconnect.dispatchEvent(pointer);original.fallback.dispatchEvent(wheel);check(pointerEscapes===0&&wheelEscapes===0&&!pointer.defaultPrevented&&!wheel.defaultPrevented,mode+' recovery host stops Canvas propagation without cancelling native control or scroll defaults');const before=reconnectCount;original.reconnect.click();check(reconnectCount===before+1,mode+' synthetic interaction mode retains original reconnect click behavior');}}finally{stage.removeEventListener('pointerdown',onPointer);stage.removeEventListener('wheel',onWheel);delete stage.dataset.syntheticInteraction;}check(original.direct.target==='_blank'&&original.direct.rel==='noopener'&&$('.foundry-overlay-explanation').textContent.includes('does not repair'),'Overlay preview is explicitly a separate safe tab, not a connection-repair claim');}
  configurePreview(null);showPreviewRecoveryFallback('No preview configured','Configure a project preview URL to connect. Your saved edits remain in Review.');refinePilotPreviewFallback();check(original.reconnect.disabled&&original.direct.hidden&&!original.direct.hasAttribute('href')&&original.fallbackTitle.textContent==='No preview configured','Missing preview configuration keeps reconnect disabled and its unavailable link hidden');
  for(const theme of ['light','dark']){document.documentElement.dataset.theme=theme;await scenario('listener-offline');const bounds=original.dialog.getBoundingClientRect(),header=$('header',original.dialog).getBoundingClientRect(),body=$('.readiness-body').getBoundingClientRect(),footer=$('footer',original.dialog).getBoundingClientRect();check(bounds.left>=-1&&bounds.right<=innerWidth+1&&bounds.top>=-1&&bounds.bottom<=innerHeight+1,theme+' readiness modal fits current viewport');check(original.dialog.scrollWidth<=original.dialog.clientWidth+1&&original.checks.scrollWidth<=original.checks.clientWidth+1,theme+' readiness content has no horizontal overflow');check(body.top>=header.bottom-1&&body.bottom<=footer.top+1,theme+' scrollable report stays between original header and footer');await close();}
  await scenario('ready');window.dispatchEvent(new Event('pagehide'));check(intervals.size===0,'Pagehide clears the readiness poll clock');await close();
  for(const [name,selector] of Object.entries({dialog:'#readiness-dialog',checks:'#readiness-checks',guide:'#workflow-trigger',refresh:'#readiness-refresh',next:'#workflow-next',close:'#readiness-close',command:'#readiness-command',fallback:'#preview-fallback',reconnect:'#reconnect-preview',direct:'#direct-preview'}))check($(selector)===original[name],name+' original node survives all scenarios');
  if(!pilot)check(!document.querySelector('.foundry-readiness-capabilities')&&!document.querySelector('[data-readiness-capability]'),'Gate off leaves original readiness presentation intact');
  await scenario('ready',{open:false});check(!original.direct.hidden&&original.direct.getAttribute('href')==='/fixture-preview','Resetting a configured scenario restores the overlay action for subsequent manual testing');original.fallback.hidden=true;$('#preview-loading').hidden=true;$('#test-results').textContent='PASS: '+checks.length+' isolated assertions';$('#test-results').dataset.result='pass';$('#test-details').textContent=checks.map((label,i)=>(i+1)+'. '+label).join(String.fromCharCode(10));
 }catch(error){$('#test-results').textContent='FAIL: '+error.message;$('#test-results').dataset.result='fail';$('#test-details').textContent=error.stack;console.error(error);}
 finally{running=false;$('#fixture-rerun').disabled=false;}
}
$('#fixture-rerun').addEventListener('click',runAssertions);await runAssertions();
`;
const diagnostics = `window.addEventListener('error',event=>{const node=document.querySelector('#fixture-errors');if(node)node.textContent+=(event.error?.stack||event.message||'Resource failed')+'\\n';},true);window.addEventListener('unhandledrejection',event=>{document.querySelector('#fixture-errors').textContent+=String(event.reason?.stack||event.reason)+'\\n';});`;
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Foundry readiness — isolated pilot fixture</title><script>${diagnostics}</script><script type="importmap">{"imports":{"foundry-design-protocol/engineering-verification":"/fixture-protocol/engineering-verification.js"}}</script>${stylesheets}<style>html,body{margin:0;min-height:100%;overflow:auto}.fixture-toolbar{display:flex;flex-wrap:wrap;gap:8px 14px;padding:12px 16px;background:#e9edf5;color:#17243d;font:12px/18px Arial,sans-serif}.fixture-toolbar button,.fixture-toolbar select{padding:4px 8px;border:1px solid #8a9bb8;border-radius:4px;background:white;color:#17243d;font:12px/18px Arial,sans-serif}.fixture-toolbar pre{position:absolute;z-index:100;max-width:calc(100vw - 32px);max-height:50vh;overflow:auto;padding:16px;background:white;border:1px solid #8a9bb8;white-space:pre-wrap}#app-shell.app-shell[data-next]{display:block;min-height:500px;height:auto;padding:24px;background:var(--surface)}.fixture-surface{max-width:720px;display:grid;gap:24px}.fixture-surface>header{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.fixture-surface h1{font:550 20px/28px var(--sans);margin:0}.fixture-surface p{font:400 13px/22px var(--sans);color:var(--muted);margin:0}.fixture-surface .live-status{display:flex}.fixture-preview{position:relative;min-height:320px}.fixture-preview .preview-fallback{position:relative;inset:auto;min-height:240px}#fixture-errors{white-space:pre-wrap}[data-result=fail]{color:#ae1b1b}</style></head><body><header class="fixture-toolbar" aria-label="Isolated test controls"><strong>Readiness fixture · synthetic data</strong><select id="fixture-scenario" aria-label="Synthetic scenario">${['ready', 'listener-offline', 'no-preview', 'unmapped', 'unknown', 'failed', 'command', 'recovery', 'staged'].map((name) => `<option>${name}</option>`).join('')}</select><button id="fixture-open">Open readiness</button><button id="fixture-poll">Poll once</button><button id="fixture-fallback">Preview unavailable</button><button id="fixture-no-preview">No preview configured</button><button id="fixture-theme">Toggle UI theme</button><button id="fixture-rerun">Run checks again</button><a href="/?theme=light">Default design</a><a href="/?foundations=pilot&theme=light">Pilot alias</a><a href="/?foundations=off&theme=light">Previous design</a><details><summary id="test-results">Running isolated assertions</summary><pre id="test-details"></pre></details><details><summary>Runtime errors</summary><pre id="fixture-errors"></pre></details></header><div id="app-shell" class="app-shell" data-next="true" data-mode="canvas"><main class="fixture-surface"><header><h1>Connection & readiness</h1><button id="live-status" class="live-status"><span>Project connection</span></button><span id="project-name">Synthetic Morrow project</span><button id="workflow-trigger" class="workflow-trigger"><span></span></button></header><p>Actual readiness lifecycle with local synthetic responses. No live session, provider, terminal command or source mutation.</p><p id="fixture-destination">No navigation yet</p><p><span id="workflow-status"></span> · <span id="workflow-status-detail"></span></p><p><span id="agent-connection-status"></span> · Review <span id="persistent-review-count"></span></p><section class="fixture-preview"><div id="preview-loading" hidden>Waiting for synthetic preview</div>${fallbackMarkup}</section></main></div>${dialog('readiness-dialog')}<script type="module">${script}</script></body></html>`;
if (process.argv.includes('--check')) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: diagnostics + script,
    encoding: 'utf8',
  });
  if (result.status !== 0) process.stderr.write(result.stderr || String(result.error));
  else console.log('Readiness fixture extraction and module syntax: PASS');
  process.exit(result.status ?? 1);
}
const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};
const port = Number(process.env.FOUNDRY_READINESS_FIXTURE_PORT ?? 0);
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
    if (url.pathname === '/fixture-preview') {
      response.setHeader('Content-Type', 'text/html');
      response.end(
        '<!doctype html><title>Synthetic preview</title><p>Isolated preview fixture; no project or source connection.</p>',
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
    'Isolated readiness pilot fixture: http://127.0.0.1:' +
      this.address().port +
      '/?foundations=pilot&theme=light',
  );
  console.log('Synthetic reports, recovery and preview only. No live session or shell execution.');
});
