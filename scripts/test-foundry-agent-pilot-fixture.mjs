// Isolated Visual Agent harness. Real markup, renderer and action handlers;
// synthetic requests, acknowledgements and transport only. No provider is called.
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'apps/inspector/dist');
const source = await readFile(resolve(root, 'apps/inspector/public/app.js'), 'utf8');
const index = await readFile(resolve(root, 'apps/inspector/public/index.html'), 'utf8');
const workflow = await readFile(resolve(root, 'apps/inspector/public/workflow.js'), 'utf8');
// Both the real Next adapter and fixture renderer consume this pure export. Serve
// its actual source without unrelated package-only engineering-verification imports.
const responseModule = workflow.match(
  /^export function visualAgentResponsePresentation\(request\) \{[\s\S]*?^\}/m,
)?.[0];
if (!responseModule) throw Error('Visual Agent response presentation export not found');
function between(text, start, end) {
  const first = text.indexOf(start);
  const last = text.indexOf(end, first + start.length);
  if (first < 0 || last <= first) throw Error(`Fixture source boundary missing: ${start}`);
  return text.slice(first, last);
}
const surface = index.indexOf('data-mode-surface="agent"');
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
if (surface < 0 || start < 0 || end <= surface) throw Error('Visual Agent markup not found');
const markup = index.slice(start, end).replace(/\s+hidden\s*>/, '>');
const renderer = between(
  source,
  'function visualAgentRequests()',
  'function activeVisualAgentPreview()',
);
const proposalAction = between(
  source,
  'async function handleVisualAgentProposal(',
  'function deliveryStatusLabel(',
);
const bindings = between(
  source,
  "$('#visual-agent-region').addEventListener",
  "$$('[data-studio-action]').forEach",
);
const newQuestion = between(
  source,
  "if (action === 'agent-start')",
  "\n  });\n});\n$$('[data-close-mode]'",
);

const script = `
import { foundryFoundationsEnabled } from '/foundry-foundations.js';
import { createNextVisualAgent as createRealVisualAgent } from '/next-visual-agent.js';
import { visualAgentResponsePresentation } from '/workflow.js';
import { mountFoundryPilot, refinePilotIcons } from '/foundry-pilot.js';
import { foundryPilotIcon } from '/foundry-pilot-icons.js';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escapeText=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const escapeAttribute=value=>escapeText(value).replaceAll('"','&quot;');
const sourceText=value=>typeof value==='string'?value:value?.file?[value.file,value.line,value.column].filter(Boolean).join(':'):'';
const params=new URLSearchParams(location.search);params.set('ui','next');
const pilot=foundryFoundationsEnabled();
const sessionId='isolated-fixture';
let nextVisualAgent, originalNodes, bridgeConnected=true;
let visualAgentRequestId='', visualAgentNewQuestion=false, visualAgentSubmitting=false, visualAgentSubmitError='', visualAgentProposalBusy=false, visualAgentActionError='', visualAgentRegionPending=false;
let activeAgentPresence={connected:false}, failNext=false, nextId=1;
let holdNext=false, releaseHeld;
const calls=[];
const target={id:'headline',selector:'#headline',label:'Make room for the work that matters.',kind:'text',source:{file:'fixture.html',line:43,column:12},width:580,height:149};
const bridgeState={selection:structuredClone(target),context:{breakpoint:'desktop',theme:'light',state:'default'},visualAgent:{},controls:[{property:'fontSize',value:76}],project:{tokens:[]}};
let activeSession={visualAgentRequests:[],designBranches:[],changeSet:{changes:[],context:{viewport:{width:1440,height:900}}}};
const selectedViewport=()=>({width:1440,height:900});
const toast=message=>$('#fixture-action').textContent='Synthetic only: '+message;
const setMode=mode=>{calls.push({type:'navigate',mode});toast(mode+' navigation simulated.');};
const renderChangeSummary=()=>{};
const activeDesignDirection=()=>activeSession.designBranches.find(item=>item.id===activeSession.activeDesignBranchId)??activeSession.changeSet;
const viewSelectionOnCanvas=async selector=>{calls.push({type:'canvas',selector});setMode('canvas');};
function renderSession(value){activeSession=value;renderVisualAgent();}
function renderIcons(root=document){for(const item of $$('[data-icon]',root)){const svg=foundryPilotIcon(item.dataset.icon);if(svg)item.outerHTML=svg;}refinePilotIcons(root);}
function createNextVisualAgent(root){
  originalNodes={prompt:$('#visual-agent-prompt'),comment:$('#visual-agent-comment'),ask:$('#visual-agent-ask'),form:$('.visual-agent-compose-form'),conversation:$('#visual-agent-conversation'),region:$('#visual-agent-region'),clear:$('#visual-agent-clear-region'),review:$('#visual-agent-review'),contextAside:$('.visual-agent-compose'),context:$('#visual-agent-context'),contextSection:$('.visual-agent-context-section')};
  return createRealVisualAgent(root);
}
${renderer}
${proposalAction}
${bindings}
$('[data-studio-action="agent-start"]').addEventListener('click',()=>{const action='agent-start';${newQuestion}});
function context(){return {targets:[structuredClone(target)],viewport:{width:1440,height:900},breakpoint:'desktop',theme:'light',state:'default',comments:[],tokens:[]};}
function proposal(id='direction-a') {return {id,name:'A clearer headline rhythm',status:'proposed',summary:'Increase the headline size while keeping its existing measure and spacing.',reasoning:['The headline should establish a stronger entry point without crowding the form.'],exactValues:['fontSize: 76px → 80px'],responsiveImpact:'Check wrapping at tablet and mobile widths before source Apply.',sourceLocations:['fixture.html:43:12'],verificationPlan:['Rebuild, then measure the headline at the affected breakpoints.'],changes:[{id:'change-a',property:'fontSize',before:76,after:80,target:{id:'headline',label:target.label,locator:{selector:'#headline'}}}]};}
function request(id='question-a',status='ready',proposals=[proposal()]) {return {id,title:'Give the headline a clearer hierarchy',status,context:context(),messages:[{role:'user',body:'Review this headline and suggest one precise improvement. Keep source unchanged.',createdAt:'2026-10-31T10:05:00Z'},{role:status==='ready'?'agent':'system',body:status==='ready'?'The headline can carry slightly more weight in the composition. Try 80px and compare the line breaks before choosing it for Review.':'Context captured from the rendered product. Waiting for an agent to claim the request.',createdAt:'2026-10-31T10:05:10Z'}],proposals};}
// Only transport and acknowledgements are simulated; all controls keep the
// original application callbacks and busy/error behavior extracted above.
async function api(url,options){
  const body=JSON.parse(options?.body||'{}');calls.push({type:'api',url,body});
  if(holdNext){holdNext=false;await new Promise(resolve=>{releaseHeld=resolve;});}
  await Promise.resolve();if(failNext){failNext=false;throw Error('Synthetic request could not be saved.');}
  const updated=structuredClone(activeSession);
  if(url.endsWith('/visual-agent-requests')){
    const item=request('question-'+(++nextId),'queued',[]);item.title=body.prompt;item.context=body.context;item.messages=[{role:'user',body:body.prompt,createdAt:'2026-10-31T10:05:00Z'}];updated.visualAgentRequests.push(item);
  } else if(url.endsWith('/retry')){const id=url.split('/').at(-2);const item=updated.visualAgentRequests.find(item=>item.id===id);item.status='queued';delete item.error;}
  else if(url.includes('/proposals/')){
    const id=url.split('/').at(-1),item=updated.visualAgentRequests.flatMap(item=>item.proposals).find(item=>item.id===id);
    if(body.action==='preview'){item.branchId='synthetic-branch';updated.designBranches=[{id:item.branchId,changes:item.changes}];}
    if(body.action==='previewed'){item.status='previewing';updated.activeDesignBranchId=item.branchId;}
    if(body.action==='promote'){item.status='promoted';updated.changeSet.changes=item.changes;delete updated.activeDesignBranchId;}
    if(body.action==='reject')item.status='rejected';
  }
  return updated;
}
async function requestCommand(command,payload){calls.push({type:'command',command,payload});await Promise.resolve();if(command==='arm-agent-region')return {armed:true};if(command==='clear-agent-region'){delete bridgeState.visualAgent.region;renderVisualAgent();return {cleared:true};}return {switched:true};}
const states=['empty','queued','thinking','needs_attention','proposals','advice','offline'];
function showScenario(state){
  bridgeConnected=state!=='offline';activeAgentPresence={connected:state==='thinking'||state==='proposals'||state==='advice'};
  visualAgentSubmitting=false;visualAgentProposalBusy=false;visualAgentSubmitError='';visualAgentActionError='';visualAgentNewQuestion=false;visualAgentRequestId='';
  bridgeState.selection=structuredClone(target);bridgeState.visualAgent={};
  activeSession={visualAgentRequests:[],designBranches:[],changeSet:{changes:[],context:{viewport:{width:1440,height:900}}}};
  if(!['empty','offline'].includes(state)){
    const item=request('question-a',state==='proposals'||state==='advice'?'ready':state,state==='proposals'?[proposal()]:[]);
    if(state==='thinking')item.agent={name:'Synthetic agent'};
    if(state==='needs_attention')item.error='Synthetic listener disconnected before completing its response.';
    activeSession.visualAgentRequests=[request('question-old','ready',[]),item];
  }
  $('#visual-agent-prompt').value='';$('#visual-agent-comment').value='';
  renderVisualAgent();$('#fixture-state').textContent='Synthetic state: '+state;
  $$('[data-fixture-state]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fixtureState===state)));
}
$$('[data-fixture-state]').forEach(button=>button.addEventListener('click',()=>showScenario(button.dataset.fixtureState)));
$('#fixture-theme').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';});
mountFoundryPilot();renderVisualAgent();
const settle=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
const setPrompt=value=>{originalNodes.prompt.value=value;originalNodes.prompt.dispatchEvent(new Event('input',{bubbles:true}));};
async function runAssertions(){
  const checks=[];const check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
  try{
    showScenario('empty');
    const agentRoot=$('[data-mode-surface="agent"]'),shell=$('.visual-agent-shell');
    if(pilot){
      const attachment=$('.foundry-agent-attachments'),connection=$('.foundry-agent-connection-details');
      check(agentRoot.dataset.agentConversation==='false','Empty pilot uses the dedicated composer-first layout state');
      check(attachment?.tagName==='DETAILS'&&originalNodes.form.contains(attachment)&&attachment.contains(originalNodes.contextAside)&&attachment.contains(originalNodes.context),'Current attachments retain their original nodes inside one native composer disclosure');
      check(shell.children.length===2&&shell.firstElementChild.matches('.visual-agent-threads')&&shell.lastElementChild.matches('.next-agent-main')&&!shell.querySelector(':scope > .visual-agent-compose'),'Pilot shell has only Questions and conversation, without a third direct-child context rail');
      check($('.next-agent-heading').contains($('.next-agent-snapshot'))&&!originalNodes.conversation.contains($('.next-agent-snapshot')),'Captured context lives in the persistent heading outside the renderer-owned conversation');
      check($('.foundry-agent-composer-dock').firstElementChild===originalNodes.form&&originalNodes.form.parentElement.parentElement.matches('.next-agent-main'),'One composer dock preserves the original form within the main panel');
      for(const [details,label] of [[attachment,'Attachment'],[connection,'Connection']]){
        const summary=details.querySelector(':scope > summary');
        check(summary?.tagName==='SUMMARY'&&summary.tabIndex===0,label+' disclosure retains native keyboard-focusable summary semantics');
        summary.focus();check(document.activeElement===summary,label+' disclosure summary accepts keyboard focus');
        details.open=false;summary.click();check(details.open,label+' disclosure opens through its native summary');
      }
      nextVisualAgent.updateConnection({connected:true,listener:true});renderVisualAgent();
      check($('.foundry-agent-attachments')===attachment&&$('.foundry-agent-connection-details')===connection&&attachment.open&&connection.open,'Expanded attachment and connection disclosures survive presence and renderer refresh');
      attachment.open=false;connection.open=false;renderVisualAgent();nextVisualAgent.updateConnection({connected:true,listener:false});
      check(!attachment.open&&!connection.open,'Collapsed attachment and connection disclosures survive refresh');
      check($('.foundry-agent-attachment-name').textContent===target.label,'Collapsed attachment summary identifies the actual current selection');
    }else{
      check(!agentRoot.hasAttribute('data-agent-conversation')&&!$('.foundry-agent-attachments')&&!$('.foundry-agent-connection-details')&&!$('.foundry-agent-composer-dock')&&!$('.foundry-agent-values'),'Gate off does not introduce pilot layout state, wrappers or value summaries');
      check(shell.children.length===3&&originalNodes.contextAside.parentElement===shell&&originalNodes.form.parentElement.matches('.next-agent-main')&&originalNodes.contextAside.contains($('.next-agent-snapshot')),'Gate off retains the original three-panel context rail and form ownership');
    }
    for(const [state,label] of [['empty','Not sent'],['queued','Queued'],['thinking','Synthetic agent is working'],['needs_attention','Needs attention'],['proposals','1 ready'],['advice','Answered']]){showScenario(state);check($('.next-agent-heading').textContent.includes(label),state+' keeps its truthful request label');}
    if(pilot)check(agentRoot.dataset.agentConversation==='true','Saved questions use the conversation layout state');
    showScenario('advice');check($('#visual-agent-conversation').textContent.includes('Advice only. No changes proposed or added to Review.'),'Completed advice does not imply Review changes');
    showScenario('queued');check($('#visual-agent-conversation').textContent.includes('Waiting for a Foundry listener'),'Queueing never implies agent work has begun');
    showScenario('offline');setPrompt('A draft remains here');originalNodes.comment.value='Preserved note';
    check(originalNodes.ask.disabled&&$('#visual-agent-region').disabled,'Offline send and region capture remain unavailable');
    check($('.next-agent-connection-status').textContent.includes('Live preview disconnected'),'Offline status takes precedence over listener presence');
    showScenario('empty');setPrompt('Inspect this headline');originalNodes.comment.value='Preserve this exact context note';
    const question=originalNodes.prompt.value,note=originalNodes.comment.value;originalNodes.prompt.focus();
    nextVisualAgent.updateConnection({connected:true,listener:true});
    check(document.activeElement===originalNodes.prompt&&originalNodes.prompt.value===question&&originalNodes.comment.value===note,'Presence updates preserve focus, draft and context note');
    check(originalNodes.ask.textContent==='Ask visual agent','Listener presence changes send copy without claiming a response');
    nextVisualAgent.updateConnection({connected:true,listener:false});
    check(originalNodes.ask.textContent==='Queue for agent'&&!originalNodes.ask.disabled,'A question may be queued without a listener');
    bridgeState.selection=null;renderVisualAgent();check(originalNodes.ask.disabled,'Sending requires attached rendered context');bridgeState.selection=structuredClone(target);renderVisualAgent();
    failNext=true;originalNodes.ask.click();await settle();
    check(originalNodes.prompt.value===question&&originalNodes.comment.value===note,'Failed save retains draft and context note');
    check($('.next-agent-error').textContent.includes('Synthetic request could not be saved.')&&!visualAgentSubmitting,'Failed save exposes the error and releases busy state');
    const before=calls.length;holdNext=true;originalNodes.ask.click();originalNodes.ask.click();await settle();
    check(originalNodes.ask.disabled&&visualAgentSubmitting,'Pending submission locks the original send control');
    setPrompt('Newer draft while saving');originalNodes.comment.value='Newer note';releaseHeld();await settle();
    check(calls.slice(before).filter(item=>item.type==='api'&&item.url.endsWith('/visual-agent-requests')).length===1,'Repeated send submits one simulated request');
    check(originalNodes.prompt.value==='Newer draft while saving'&&originalNodes.comment.value==='Newer note','Acknowledgement cannot erase newer draft input');
    const sent=activeSession.visualAgentRequests.at(-1);check(sent.context.comments[0].body===note&&sent.context.targets[0].selector==='#headline','Submitted context is captured independently from newer input');
    showScenario('needs_attention');const retryBefore=calls.length;holdNext=true;const retry=$('[data-agent-retry]');retry.click();retry.dispatchEvent(new MouseEvent('click',{bubbles:true}));await settle();check($('[data-agent-retry]').disabled&&$('.next-agent-action-status').textContent.includes('acknowledgement'),'Retry exposes pending feedback and disables repeat submission');releaseHeld();await settle();check(calls.slice(retryBefore).filter(item=>item.type==='api'&&item.url.endsWith('/retry')).length===1&&activeVisualAgentRequest().status==='queued','Original retry handler returns interrupted work to the queue once');
    showScenario('proposals');bridgeState.selection={...target,selector:'#different'};renderVisualAgent();check(!$('.next-agent-attachment-change').hidden,'Changed current attachment is distinguished from saved question context');bridgeState.selection=structuredClone(target);renderVisualAgent();check($('.next-agent-attachment-change').hidden,'Matching attachments remove the identity warning');
    showScenario('empty');setPrompt('Keyboard question');const keyboardBefore=calls.length;originalNodes.prompt.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true}));await settle();check(calls.slice(keyboardBefore).filter(item=>item.type==='api'&&item.url.endsWith('/visual-agent-requests')).length===1,'Keyboard send uses the original acknowledged submission');
    showScenario('proposals');const details=$('[data-next-agent-details]');const disclosure=details.querySelector(':scope > summary');
    if(pilot){
      const values=$('.foundry-agent-values');
      check(values?.parentElement.matches('.visual-agent-proposal')&&!details.contains(values)&&values.querySelector('code').textContent===activeVisualAgentRequest().proposals[0].exactValues[0],'Exact proposed values remain visible outside the collapsed reasoning disclosure');
      check(values.textContent.includes('Proposed change')&&!/measured|verified|applied/i.test(values.textContent),'Exact-value summary remains a proposed change, not rendered verification');
    }
    check(disclosure.tagName==='SUMMARY'&&disclosure.tabIndex===0,'Proposal disclosure retains native keyboard-focusable summary semantics');
    details.open=false;disclosure.click();check(details.open,'Proposal disclosure opens through its original native control');
    originalNodes.conversation.scrollTop=42;const oldScroll=originalNodes.conversation.scrollTop;renderVisualAgent();
    check($('[data-next-agent-details]').open,'Proposal disclosure remains open after refresh');
    check(originalNodes.conversation.scrollTop===oldScroll,'Conversation scroll remains stable on same-request refresh');
    const savedLabel=activeVisualAgentRequest().context.targets[0].label;bridgeState.selection={...target,label:'Different current selection'};renderVisualAgent();
    check($('.next-agent-saved').textContent.includes(savedLabel)&&$('#visual-agent-context').textContent.includes('Different current selection'),'Saved question context stays separate from current selection');
    if(pilot){
      check($('.foundry-agent-attachment-name').textContent==='Different current selection'&&$('.next-agent-saved').textContent.includes(savedLabel)&&!$('.next-agent-saved').textContent.includes('Different current selection'),'Current attachment summary updates without changing the captured question context');
      const snapshot=$('.next-agent-snapshot');snapshot.open=true;renderVisualAgent();
      check($('.next-agent-snapshot')===snapshot&&snapshot.open&&snapshot.parentElement.matches('.next-agent-heading'),'Captured context disclosure identity and open state survive conversation replacement');
    }
    $('[data-visual-agent-thread="question-old"]').click();check(visualAgentRequestId==='question-old'&&originalNodes.conversation.scrollTop===0,'Thread selection resets only the conversation scroll');
    showScenario('proposals');check($('[data-agent-proposal-action="promote"]').disabled,'Move to Review requires an acknowledged preview');
    if(pilot){check($('.visual-agent-proposal > header > div > span').textContent==='Proposed','Unchosen proposal has a proposed label, not an applied claim');check($('.foundry-agent-proposal-boundary').textContent.includes('separate step'),'Proposal boundary separates preview from Review');check($('.visual-agent-proposal-grid').textContent.includes('Verification plan'),'Verification is labeled as a plan rather than completed evidence');}
    const previewBefore=calls.length;$('[data-agent-proposal-action="preview"]').click();await settle();const previewCalls=calls.slice(previewBefore);
    check(previewCalls.findIndex(item=>item.command==='switch-design-branch')<previewCalls.findIndex(item=>item.body?.action==='previewed'),'Preview acknowledgement follows the simulated rendered switch');
    check(previewCalls.findIndex(item=>item.body?.action==='previewed')<previewCalls.findIndex(item=>item.type==='canvas'),'Canvas navigation follows persisted acknowledgement');
    check(activeSession.changeSet.changes.length===0&&!$('[data-agent-proposal-action="promote"]').disabled,'Preview is separate from Review until explicitly chosen');
    if(pilot)check($('.visual-agent-proposal > header > div > span').textContent==='Preview active'&&$('.foundry-agent-proposal-boundary').textContent.includes('source is unchanged'),'Active preview label preserves the source boundary');
    const promoteBefore=calls.length;$('[data-agent-proposal-action="promote"]').click();await settle();
    check(activeSession.changeSet.changes.length===1&&calls.slice(promoteBefore).some(item=>item.type==='navigate'&&item.mode==='review'),'Original promotion handler moves the simulated proposal to Review');
    check($('[data-agent-proposal-action="preview"]').disabled&&$('[data-agent-proposal-action="promote"]').disabled,'Promoted proposal cannot preview or promote again');
    if(pilot)check($('.visual-agent-proposal > header > div > span').textContent==='In Review'&&$('.foundry-agent-proposal-boundary').textContent.includes('require reviewed Apply'),'Review label never implies source Apply is complete');
    check(!calls.some(item=>item.command?.includes('apply')||item.url?.includes('/apply')),'No source Apply or provider activity is invoked');
    showScenario('proposals');$('[data-agent-proposal-action="reject"]').click();await settle();check($('[data-agent-proposal-action="reject"]').disabled,'Rejected proposal retains its original disabled Reject control');
    if(pilot)check($('.visual-agent-proposal > header > div > span').textContent==='Rejected','Rejected proposal keeps an explicit non-applied label');
    showScenario('empty');setPrompt('Keep my new question draft');originalNodes.comment.value='Keep note';$('[data-studio-action="agent-start"]').click();check(visualAgentNewQuestion&&originalNodes.prompt.value==='Keep my new question draft'&&originalNodes.comment.value==='Keep note','New question preserves the current draft');
    $('#visual-agent-region').click();await settle();check(visualAgentRegionPending&&calls.some(item=>item.command==='arm-agent-region'),'Original region handler waits for an acknowledgement');
    bridgeState.visualAgent.region={id:'region',x:0,y:0,width:200,height:160};renderVisualAgent();$('#visual-agent-clear-region').click();await settle();check(!bridgeState.visualAgent.region&&!visualAgentRegionPending,'Original clear-region handler retains acknowledgement semantics');
    showScenario('proposals');for(let i=0;i<5;i++)renderVisualAgent();
    for(const [name,selector] of Object.entries({prompt:'#visual-agent-prompt',comment:'#visual-agent-comment',ask:'#visual-agent-ask',form:'.visual-agent-compose-form',conversation:'#visual-agent-conversation',region:'#visual-agent-region',clear:'#visual-agent-clear-region',review:'#visual-agent-review',contextAside:'.visual-agent-compose',context:'#visual-agent-context',contextSection:'.visual-agent-context-section'}))check($(selector)===originalNodes[name],name+' node ownership survives repeated rendering');
    check($$('.next-agent-main').length===1&&$$('.next-agent-context-scroll').length===1&&$$('[data-next-agent-details]').length===1,'Repeated rendering does not duplicate regions or disclosures');
    if(pilot){
      for(let i=0;i<5;i++)nextVisualAgent.updateConnection({connected:true,listener:Boolean(i%2)});
      check($$('.foundry-agent-attachments').length===1&&$$('.foundry-agent-connection-details').length===1&&$$('.foundry-agent-composer-dock').length===1&&$$('.next-agent-snapshot').length===1,'Repeated rendering and presence updates do not duplicate composer, attachment or captured-context wrappers');
      check($$('.foundry-agent-values').length===$$('.visual-agent-proposal').length&&$$('.foundry-agent-values code').map(item=>item.textContent).join('|')===activeVisualAgentRequest().proposals.flatMap(item=>item.exactValues).join('|'),'Repeated refinement produces one accurate exact-value summary per proposal');
      check(!$('.foundry-agent-attachments').open&&!$('.foundry-agent-connection-details').open,'Collapsed composer disclosures remain collapsed across scenario and presence changes');
      showScenario('empty');check(agentRoot.dataset.agentConversation==='false','Returning to a new question restores the composer-first layout state');showScenario('proposals');
    }else check(!$('.foundry-agent-values')&&originalNodes.contextAside.parentElement===shell,'Gate off retains its original proposal and context layout after repeated rendering');
    check(Boolean($('.foundry-agent-interior'))===pilot,'Pilot presentation class follows the explicit gate');
    $('#test-results').textContent='PASS: '+checks.length+' isolated assertions';$('#test-results').dataset.result='pass';$('#test-details').textContent=checks.map((item,i)=>(i+1)+'. '+item).join(String.fromCharCode(10));$('#fixture-action').textContent='Synthetic requests and simulated actions only. No provider, live session, Review or source changes.';
  }catch(error){$('#test-results').textContent='FAIL: '+error.message;$('#test-results').dataset.result='fail';$('#test-details').textContent=error.stack;console.error(error);}
}
$('#fixture-rerun').addEventListener('click',runAssertions);await runAssertions();
`;
const diagnostics = `window.addEventListener('error',event=>{document.querySelector('#fixture-errors').textContent+=(event.error?.stack||event.message||'Resource failed')+'\\n';},true);window.addEventListener('unhandledrejection',event=>{document.querySelector('#fixture-errors').textContent+=String(event.reason?.stack||event.reason)+'\\n';});`;
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Foundry Visual Agent — isolated pilot fixture</title><script>${diagnostics}</script><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/next-workspace.css"><link rel="stylesheet" href="/foundry-pilot.css"><style>
html,body{margin:0;height:100%;overflow:hidden}body{display:flex;flex-direction:column}.fixture-toolbar{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 16px;background:#e9edf5;color:#17243d;font:12px/18px Arial,sans-serif;border-bottom:1px solid #b8c3d5}.fixture-toolbar button{border:1px solid #8a9bb8;border-radius:4px;padding:4px 8px;background:white;color:#17243d;font:12px/18px Arial,sans-serif}.fixture-toolbar button[aria-pressed=true]{background:#17243d;color:white}.fixture-toolbar pre{position:absolute;z-index:100;max-width:calc(100vw - 32px);max-height:50vh;overflow:auto;padding:16px;margin:8px 0;background:white;color:#17243d;border:1px solid #8a9bb8;white-space:pre-wrap}#app-shell.app-shell[data-next]{display:block;flex:1 1 auto;min-height:0;width:100%;height:auto}#app-shell>[data-mode-surface=agent]{height:100%;min-height:0}[data-result=fail]{color:#ae1b1b}
</style></head><body><header class="fixture-toolbar" aria-label="Isolated test controls"><strong>Visual Agent fixture · synthetic data</strong><span id="fixture-state">Synthetic state</span><nav aria-label="Fixture states">${['empty', 'queued', 'thinking', 'needs_attention', 'proposals', 'advice', 'offline'].map((state) => `<button type="button" data-fixture-state="${state}" aria-pressed="false">${state}</button>`).join(' ')}</nav><button id="fixture-theme">Toggle UI theme</button><button id="fixture-rerun">Run checks again</button><a href="/?foundations=off&theme=light">Previous design</a><a href="/?theme=light">Default design</a><a href="/?foundations=pilot&theme=light">Pilot alias</a><details><summary id="test-results">Running isolated assertions</summary><pre id="test-details"></pre></details><details><summary>Runtime errors</summary><pre id="fixture-errors"></pre></details><span role="status" id="fixture-action">No live Foundry session.</span></header><div id="app-shell" class="app-shell" data-next="true" data-mode="agent">${markup}</div><script type="module">${script}</script></body></html>`;
if (process.argv.includes('--check')) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: diagnostics + script,
    encoding: 'utf8',
  });
  if (result.status !== 0) process.stderr.write(result.stderr || String(result.error));
  else console.log('Visual Agent fixture extraction and module syntax: PASS');
  process.exit(result.status ?? 1);
}
const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const port = Number(process.env.FOUNDRY_AGENT_FIXTURE_PORT ?? 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid fixture port');
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/workflow.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(responseModule);
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
    'Isolated Visual Agent pilot fixture: http://127.0.0.1:' +
      server.address().port +
      '/?foundations=pilot&theme=light',
  );
  console.log(
    'Synthetic requests and simulated actions only. No provider or live Foundry session.',
  );
});
