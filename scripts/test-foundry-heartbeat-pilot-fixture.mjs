// Real heartbeat presentation/frame handlers; synthetic frames, session and transport.
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'apps/inspector/dist');
const index = await readFile(resolve(root, 'apps/inspector/public/index.html'), 'utf8');
const app = await readFile(resolve(root, 'apps/inspector/public/app.js'), 'utf8');
function between(text, start, end) {
  const first = text.indexOf(start),
    last = text.indexOf(end, first + start.length);
  if (first < 0 || last <= first) throw Error('Missing extraction boundary: ' + start);
  return text.slice(first, last);
}
const stylesheets = [...index.matchAll(/<link\s+rel="stylesheet"\s+href="[^"]+"\s*\/?>/g)]
  .map((match) => match[0])
  .join('');
const fallbackMarkup = index.match(
  /<div class="preview-fallback" id="preview-fallback" hidden>[\s\S]*?<\/div>/,
)?.[0];
if (!fallbackMarkup) throw Error('Missing original preview fallback');
const frameHandlers = between(app, 'function markFrameSeen(', 'async function pingPreviewFrame(');
const heartbeatHandler = between(
  app,
  'function syncPilotHeartbeatRecovery()',
  'async function restoreSavedCanvasPreview()',
);
const fallbackHandler = between(
  app,
  'function showPreviewRecoveryFallback(',
  'function resetPreviewRecovery()',
);
const reconnectHandler = between(
  app,
  'function reconnectCanvasPreview()',
  'function setupPreview()',
);
const rejectionHandler = between(
  app,
  'function rejectPendingFrameCommands(',
  'function invalidateFrameTransport(',
);
// Keep the original origin/session/request/source validation before acknowledging a frame.
const messageHandler =
  between(
    app,
    "window.addEventListener('message', (event) => {",
    '  if (workshopGallery?.receive(event)) return;',
  ) + '\n});';

const script = `
import { foundryFoundationsEnabled } from '/foundry-foundations.js';
import {foundryPilotActive} from '/foundry-pilot.js';
import {previewRecoveryBlocked,previewReconnectBlocked} from '/preview-recovery.js';
import {refinePilotPreviewFallback} from '/foundry-pilot-readiness.js';
import {foundryPilotIcon} from '/foundry-pilot-icons.js';
const $=(selector,root=document)=>root.querySelector(selector);
const pilot=foundryFoundationsEnabled();
if(pilot)document.documentElement.dataset.foundryPilot='canvas';
const preview=$('#product-preview'),comparison=$('#comparison-preview'),previewUrl='/fixture-preview';
const previewOrigin=location.origin,sessionId='isolated-heartbeat-fixture',frameLastSeen=new Map(),pendingCommandRequests=new Map();
const nextDesignBranches=null,designBranchFrames=new Map(),responsiveFrames=new Map([[comparison.contentWindow,'comparison']]),responsiveFrameStates=new Map();
let bridgeConnected=true,bridgeState={context:{theme:'light'},selection:{id:'synthetic-headline'}},bridgeBranchSynced=true;
let previewRecoveryFailed=false,previewHeartbeatLost=false,stateWorkbenchConnected=false,reconnectCount=0,ackCount=0,running=false,sequence=0;
const activeSession={applyRuns:[],changeSet:{changes:[{id:'saved-edit',status:'draft',before:76,after:80}]}};
const savedSession=JSON.stringify(activeSession.changeSet),initialSource=preview.src,calls=[];
function toast(message){calls.push('toast:'+message);$('#fixture-feedback').textContent=message;$('#fixture-feedback').hidden=false;}
function workspaceCommandError(message,code,command){return Object.assign(new Error(message),{code,command});}
function updateStateWorkbenchPresentation(){calls.push('state-update');}
function updateResponsiveCard(id){calls.push('comparison-update:'+id);}
function failNextBranchPreview(){throw Error('No branch frame is configured in this fixture');}
function renderConnectionStatus(){syncPilotHeartbeatRecovery();$('#fixture-connection').textContent=bridgeConnected?'Preview connected':'Preview offline';$('#fixture-run').textContent=activeSession.applyRuns.at(-1)?.state??'No Apply run';}
function resetPreviewRecovery(){reconnectCount++;previewHeartbeatLost=false;bridgeConnected=false;bridgeState=null;bridgeBranchSynced=false;previewRecoveryFailed=false;$('#preview-fallback').hidden=true;$('#preview-loading').hidden=false;}
${rejectionHandler}
${frameHandlers}
${heartbeatHandler}
${fallbackHandler}
${reconnectHandler}
${messageHandler}
const originals={fallback:$('#preview-fallback'),loading:$('#preview-loading'),reconnect:$('#reconnect-preview'),direct:$('#direct-preview')};
originals.direct.href=previewUrl;refinePilotPreviewFallback();
for(const node of document.querySelectorAll('[data-icon]')){const markup=foundryPilotIcon(node.dataset.icon);if(markup)node.outerHTML=markup;}
function reset(){pendingCommandRequests.clear();activeSession.applyRuns=[];bridgeConnected=true;bridgeState={context:{theme:'light'},selection:{id:'synthetic-headline'}};bridgeBranchSynced=true;previewRecoveryFailed=false;previewHeartbeatLost=false;originals.fallback.hidden=true;originals.loading.hidden=true;originals.reconnect.disabled=false;$('#fixture-feedback').hidden=true;renderConnectionStatus();}
function acknowledge({source=preview.contentWindow,expected=source,origin=previewOrigin,session=sessionId}={}){
 const requestId='fixture-ping-'+(++sequence);pendingCommandRequests.set(requestId,{source:expected,command:'preview-ping',timeout:null,resolve:()=>ackCount++,reject:error=>calls.push(error.code)});
 window.dispatchEvent(new MessageEvent('message',{origin,source,data:{sessionId:session,type:'foundry:workspace-result',requestId,ok:true,payload:{pong:true}}}));
}
function scenario(name){reset();if(name==='active')activeSession.applyRuns=[{id:'same-run',state:'rebuilding'}];if(name==='verifying')activeSession.applyRuns=[{id:'same-run',state:'verifying'}];if(['disconnected','active','verifying'].includes(name))markFrameOffline(preview.contentWindow,'Synthetic heartbeat timed out.');if(name==='restoration-failed'){markFrameOffline(preview.contentWindow);previewRecoveryFailed=true;showPreviewRecoveryFallback('Saved preview could not be restored','Synthetic restoration failure. A heartbeat acknowledgement is not evidence that saved edits were restored.');}$('#fixture-scenario').value=name;renderConnectionStatus();}
const verifyingOption=document.createElement('option');verifyingOption.value='verifying';verifyingOption.textContent='Verification disconnected';$('#fixture-scenario').append(verifyingOption);
$('#fixture-scenario').addEventListener('change',event=>scenario(event.target.value));
$('#fixture-ack').addEventListener('click',()=>acknowledge());
$('#fixture-comparison').addEventListener('click',()=>acknowledge({source:comparison.contentWindow}));
$('#fixture-terminal').addEventListener('click',()=>{activeSession.applyRuns=[{id:'same-run',state:'passed'}];renderConnectionStatus();});
$('#fixture-theme').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';});
const settle=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
async function runAssertions(){
 if(running)return;running=true;$('#fixture-rerun').disabled=true;$('#test-results').dataset.result='running';const checks=[];
 const check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
 try{
  await document.fonts.ready;reset();const state=bridgeState;markFrameOffline(preview.contentWindow,'Synthetic timeout');
  check(!bridgeConnected,'Main-frame timeout reports the preview offline');
  check(bridgeState===state&&bridgeBranchSynced&&preview.src===initialSource&&JSON.stringify(activeSession.changeSet)===savedSession,'Heartbeat loss preserves saved edits, inspected context and original frame source');
  if(pilot){
   check(!originals.fallback.hidden&&originals.loading.hidden&&originals.fallback.querySelector('strong').textContent==='Live preview disconnected','Loaded main preview exposes the actual disconnected fallback');
   check(!originals.reconnect.disabled,'Disconnected preview without active Apply offers the original reconnect control');
   const host=$('.foundry-preview-status');check(host.parentElement===$('#canvas-stage')&&originals.fallback.parentElement===host&&!$('#preview-frame').contains(originals.fallback),'Actual pilot helper mounts fallback outside the transformed preview frame');
   await settle();check(Math.abs(originals.fallback.getBoundingClientRect().width-originals.fallback.offsetWidth)<1.5,'Disconnected recovery renders at native scale');
   const beforeAck=ackCount;acknowledge({origin:'http://untrusted.invalid'});acknowledge({session:'unrelated-session'});acknowledge({source:comparison.contentWindow,expected:preview.contentWindow});
   check(ackCount===beforeAck&&!originals.fallback.hidden&&!bridgeConnected,'Original message handler rejects wrong origin, session and frame acknowledgements');
   acknowledge({source:comparison.contentWindow});check(!bridgeConnected&&!originals.fallback.hidden,'Authenticated comparison traffic cannot clear main preview recovery');
   acknowledge();check(bridgeConnected&&!previewHeartbeatLost&&originals.fallback.hidden&&originals.loading.hidden,'Authenticated same-frame response clears only the heartbeat-owned fallback');
   check(preview.src===initialSource&&JSON.stringify(activeSession.changeSet)===savedSession,'Acknowledgement neither reloads the iframe nor mutates saved edits');
   scenario('restoration-failed');acknowledge();check(!originals.fallback.hidden&&originals.fallback.querySelector('strong').textContent==='Saved preview could not be restored','Transport recovery does not dismiss a saved-preview restoration failure');
   for(const state of ['queued','claimed','applying','rebuilding']){reset();activeSession.applyRuns=[{id:'same-run',state}];markFrameOffline(preview.contentWindow);const before=reconnectCount;originals.reconnect.click();check(originals.reconnect.disabled&&reconnectCount===before&&activeSession.applyRuns[0].state===state,'Queued/active '+state+' retains the run and disables reconnect');}
   scenario('active');const blockedCount=reconnectCount,blockedSource=preview.src;let guarded=false;try{reconnectCanvasPreview();}catch(error){guarded=error.message.includes('cannot reconnect while Apply is queued or changing source');}check(guarded&&reconnectCount===blockedCount&&preview.src===blockedSource,'Shared reconnect boundary rejects active source work before resetting or reloading the frame');
   originals.reconnect.dispatchEvent(new MouseEvent('click',{bubbles:true}));check(reconnectCount===blockedCount&&preview.src===blockedSource&&!$('#fixture-feedback').hidden&&$('#fixture-feedback').textContent.includes('cannot reconnect while Apply is queued or changing source'),'Fallback event catches a late or forced blocked reconnect and presents its error without reload');
   scenario('disconnected');activeSession.applyRuns=[{state:'rebuilding'}];renderConnectionStatus();check(originals.reconnect.disabled&&originals.fallback.textContent.includes('queued or changing source'),'Status refresh updates the wait state after Apply becomes active');
   activeSession.applyRuns=[{state:'passed'}];renderConnectionStatus();check(!originals.reconnect.disabled&&!bridgeConnected&&!originals.fallback.hidden,'A terminal run reenables deliberate recovery without claiming the preview reconnected');
   const before=reconnectCount;originals.reconnect.click();check(reconnectCount===before+1&&originals.loading.hidden===false&&originals.fallback.hidden&&!bridgeConnected,'Original reconnect binding enters synthetic reset without claiming restoration');
   scenario('disconnected');activeSession.applyRuns=[{id:'same-run',state:'verifying'}];renderConnectionStatus();check(!originals.reconnect.disabled&&originals.fallback.textContent.includes('Reconnect the preview to continue verification')&&previewRecoveryBlocked(activeSession.applyRuns),'Verification offers deliberate reconnect while temporary edit replay stays blocked');const beforeVerification=reconnectCount;originals.reconnect.click();check(reconnectCount===beforeVerification+1&&!bridgeConnected&&activeSession.applyRuns[0].state==='verifying','Explicit reconnect during verification resets only the frame and makes no verification claim');
   reset();bridgeState=null;markFrameOffline(preview.contentWindow);check(!previewHeartbeatLost&&originals.fallback.hidden,'Initial connection failure remains owned by the existing initial-load timeout');
   for(const theme of ['light','dark']){document.documentElement.dataset.theme=theme;scenario('disconnected');await settle();const stage=$('#canvas-stage').getBoundingClientRect(),fallback=originals.fallback.getBoundingClientRect();check(fallback.left>=stage.left-1&&fallback.right<=stage.right+1&&originals.fallback.scrollWidth<=originals.fallback.clientWidth+1,theme+' recovery fits the current workspace width');check(originals.reconnect.getBoundingClientRect().width>0&&originals.direct.getBoundingClientRect().width>0,theme+' original actions remain visibly rendered');}
  }else{
   check(!previewHeartbeatLost&&originals.fallback.hidden,'Gate off does not reveal the pilot heartbeat fallback');
   check(originals.fallback.parentElement===$('#preview-frame')&&!$('.foundry-preview-status'),'Gate off retains original transformed-frame ownership');
   acknowledge();check(bridgeConnected&&originals.fallback.hidden,'Gate off retains original connection acknowledgement');
  }
  for(const [key,selector]of Object.entries({fallback:'#preview-fallback',loading:'#preview-loading',reconnect:'#reconnect-preview',direct:'#direct-preview'}))check($(selector)===originals[key],key+' original node survives lifecycle changes');
  check(JSON.stringify(activeSession.changeSet)===savedSession,'Saved Review changes remain byte-for-byte unchanged through all scenarios');
  scenario('disconnected');$('#test-results').dataset.result='pass';$('#test-results').textContent='PASS: '+checks.length+' isolated assertions';$('#test-details').textContent=checks.map((label,i)=>(i+1)+'. '+label).join(String.fromCharCode(10));
 }catch(error){$('#test-results').dataset.result='fail';$('#test-results').textContent='FAIL: '+error.message;$('#test-details').textContent=error.stack;console.error(error);}
 finally{running=false;$('#fixture-rerun').disabled=false;}
}
$('#fixture-rerun').addEventListener('click',runAssertions);await runAssertions();
`;
const diagnostics = `window.addEventListener('error',event=>{const node=document.querySelector('#fixture-errors');if(node)node.textContent+=(event.error?.stack||event.message||'Resource failed')+'\\n';},true);window.addEventListener('unhandledrejection',event=>{document.querySelector('#fixture-errors').textContent+=String(event.reason?.stack||event.reason)+'\\n';});`;
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Foundry heartbeat — isolated pilot fixture</title><script>${diagnostics}</script>${stylesheets}<style>
html,body{margin:0;min-height:100%;overflow:auto}.fixture-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:12px 16px;background:#e9edf5;color:#17243d;font:12px/18px Arial,sans-serif}.fixture-toolbar button,.fixture-toolbar select{padding:4px 8px;border:1px solid #8a9bb8;border-radius:4px;background:white;color:#17243d;font:12px/18px Arial,sans-serif}.fixture-toolbar pre{position:absolute;z-index:100;max-width:calc(100vw - 32px);max-height:50vh;overflow:auto;padding:16px;background:white;border:1px solid #8a9bb8;white-space:pre-wrap}#app-shell.app-shell[data-next]{display:block;min-height:500px;height:auto;padding:24px;background:var(--surface)}.fixture-heading{max-width:1080px;margin:0 auto 24px;display:grid;gap:8px}.fixture-heading h1{font:550 18px/26px var(--sans);margin:0}.fixture-heading p{font:400 12px/20px var(--sans);color:var(--muted);margin:0}.fixture-status{display:flex;flex-wrap:wrap;gap:16px;font:500 12px/20px var(--sans)}#canvas-stage{position:relative;margin:auto;max-width:1080px;width:100%;height:500px;overflow:hidden;border:1px solid var(--line);border-radius:12px}#preview-frame{position:relative;width:1200px;height:800px;transform:translate(84px,32px) scale(.6);transform-origin:0 0}#product-preview{width:1200px;height:800px;border:0}.fixture-comparison{display:none}[data-result=fail]{color:#ae1b1b}@media(max-width:520px){#app-shell.app-shell[data-next]{padding:16px}#canvas-stage{height:540px}.fixture-heading{margin-bottom:16px}}
</style></head><body><header class="fixture-toolbar" aria-label="Isolated test controls"><strong>Heartbeat fixture · synthetic data</strong><select id="fixture-scenario" aria-label="Synthetic scenario"><option value="disconnected">Disconnected</option><option value="active">Apply active</option><option value="restoration-failed">Restoration failed</option><option value="connected">Connected</option></select><button id="fixture-ack">Acknowledge main preview</button><button id="fixture-comparison">Acknowledge comparison</button><button id="fixture-terminal">Finish synthetic run</button><button id="fixture-theme">Toggle UI theme</button><button id="fixture-rerun">Run checks again</button><a href="/?theme=light">Default design</a><a href="/?foundations=pilot&theme=light">Pilot alias</a><a href="/?foundations=off&theme=light">Previous design</a><details><summary id="test-results">Running isolated assertions</summary><pre id="test-details"></pre></details><details><summary>Runtime errors</summary><pre id="fixture-errors"></pre></details></header><div id="app-shell" class="app-shell" data-next="true" data-mode="canvas"><main class="canvas-mode"><header class="fixture-heading"><h1>Connection recovery</h1><p>Actual heartbeat handlers and recovery controls. Synthetic preview, saved edit and Apply run; no live project or source mutation.</p><div class="fixture-status"><span id="fixture-connection">Preview connected</span><span id="fixture-run">No Apply run</span><span>Review 1 synthetic edit</span></div><p id="fixture-feedback" role="status" hidden></p></header><section class="canvas-stage" id="canvas-stage"><div class="preview-frame" id="preview-frame"><iframe id="product-preview" title="Synthetic product preview" src="/fixture-preview"></iframe><div class="preview-loading" id="preview-loading" hidden>Waiting for synthetic preview</div>${fallbackMarkup}</div></section></main></div><iframe class="fixture-comparison" id="comparison-preview" title="Synthetic comparison" src="/fixture-preview"></iframe><script type="module">${script}</script></body></html>`;
if (process.argv.includes('--check')) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: diagnostics + script,
    encoding: 'utf8',
  });
  if (result.status !== 0) process.stderr.write(result.stderr || String(result.error));
  else console.log('Heartbeat fixture extraction and module syntax: PASS');
  process.exit(result.status ?? 1);
}
const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};
const port = Number(process.env.FOUNDRY_HEARTBEAT_FIXTURE_PORT ?? 0);
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
        '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:72px;background:#f3f4f0;color:#20231f;font:24px/1.5 system-ui}h1{font-size:64px;max-width:680px;line-height:1.08}p{max-width:700px}button{padding:20px 32px;background:#245c4e;color:white;border:0;border-radius:6px;font:inherit}</style></head><body><small>SYNTHETIC PRODUCT</small><h1>Make room for the work that matters.</h1><p>Fixture content only. The embedded frame has no Foundry adapter, live project, external origin or source Apply connection.</p><button>Example control</button></body></html>',
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
    'Isolated heartbeat pilot fixture: http://127.0.0.1:' +
      this.address().port +
      '/?foundations=pilot&theme=light',
  );
  console.log(
    'Synthetic frame acknowledgements, session and Apply states only. No live project or source mutation.',
  );
});
