// Real palette/dialog markup and application handlers. Only workspace navigation
// and milestone transport are synthetic; no live session or source writes.
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
function dialog(id) {
  const at = index.indexOf('id="' + id + '"'),
    start = index.lastIndexOf('<dialog', at),
    end = index.indexOf('</dialog>', at);
  if (at < 0 || start < 0 || end < at) throw Error('Missing dialog: ' + id);
  return index.slice(start, end + 9);
}
const stylesheets = [...index.matchAll(/<link\s+rel="stylesheet"\s+href="[^"]+"\s*\/?>/g)]
  .map((match) => match[0])
  .join('');
const palette = between(source, 'const commands = [', 'const dockResizer =');
const toastSource = between(source, 'function toast(', 'function renderConnectionStatus(');
const milestoneBinding = between(
  source,
  "const milestoneDialog = $('#delivery-milestone-dialog');",
  "$('#delivery-export')?.addEventListener",
);
const milestoneOpener = between(
  source,
  "  $('#delivery-create-milestone', root)?.addEventListener",
  '\n}\n\nfunction visualRecipeTargetSuggestions(',
);
const milestoneButton =
  between(
    source,
    '<button class="secondary-button compact" id="delivery-create-milestone"',
    '</button>',
  ) + '</button>';
const script = `
import { foundryFoundationsEnabled } from '/foundry-foundations.js';
import {refinePilotCommandPalette,restorePilotDialogFocus,showPilotFeedback,mountPilotOverlays} from '/foundry-pilot-overlays.js';
import {refinePilotIcons} from '/foundry-pilot.js';
import {foundryPilotIcon} from '/foundry-pilot-icons.js';
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const params=new URLSearchParams(location.search);params.set('ui','next');const pilot=foundryFoundationsEnabled(),sessionId='isolated-overlays-fixture';
if(pilot)document.documentElement.dataset.foundryPilot='canvas';
let activeMode='canvas',modeFocusReturn=null,toastTimer,fixtureRunning=false,failNext=false,holdNext=false,releaseHeld;
let activeSession={designHistory:[{id:'verified-heading'},{id:'verified-button'}],deliveryMilestones:[]};
const calls=[];
function renderIcons(root=document){for(const item of $$('[data-icon]',root)){const icon=foundryPilotIcon(item.dataset.icon);if(icon)item.outerHTML=icon;}refinePilotIcons(root);}
function setMode(mode,restoreFocus,returnFocus){calls.push({type:'navigation',mode,restoreFocus,returnFocusId:returnFocus?.id});activeMode=mode;$('#app-shell').dataset.mode=mode;$('#fixture-destination').textContent='Synthetic destination: '+mode;}
function closeWorkspaceMenu(){$('#workspace-menu').hidden=true;}
function renderSession(session){activeSession=structuredClone(session);const root=$('#milestone-host'),history=activeSession.designHistory;root.innerHTML=\`${milestoneButton}\`;bindMilestoneOpener();renderIcons(root);}
function bindMilestoneOpener(){const root=$('#milestone-host');${milestoneOpener}}
async function api(url,options={}){const body=JSON.parse(options.body||'{}');calls.push({type:'api',url,method:options.method??'GET',body});if(holdNext){holdNext=false;await new Promise(resolve=>{releaseHeld=resolve;});}await Promise.resolve();if(failNext){failNext=false;throw Error('Synthetic <save> failed. Your milestone name is preserved.');}if(!url.endsWith('/delivery-milestones'))throw Error('Unsupported synthetic transport');return {...structuredClone(activeSession),deliveryMilestones:[...activeSession.deliveryMilestones,{id:'synthetic-milestone',name:body.name,entryIds:body.entryIds}]};}
${toastSource}
${palette}
${milestoneBinding}
renderSession(activeSession);renderIcons();mountPilotOverlays();
const original={dialog:$('#command-dialog'),input:$('#command-input'),list:$('#command-list'),close:$('#close-commands'),milestone:$('#delivery-milestone-dialog'),form:$('#delivery-milestone-form'),name:$('#delivery-milestone-name'),toast:$('#toast')};
const settle=async()=>{for(let i=0;i<25;i++)await Promise.resolve();await new Promise(resolve=>window.setTimeout(resolve,0));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));for(let i=0;i<25;i++)await Promise.resolve();};
const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const input=(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));};
const key=(node,value,options={})=>{const event=new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...options});node.dispatchEvent(event);return event;};
const dismissFeedback=()=>{const button=$('#toast button');if(button)button.click();else original.toast.classList.remove('is-visible');clearTimeout(toastTimer);};
async function closeDialogs(){for(const node of $$('dialog[open]'))node.close();await settle();dismissFeedback();}
async function reset(){await closeDialogs();failNext=false;holdNext=false;releaseHeld=null;activeMode='canvas';$('#app-shell').dataset.mode='canvas';activeSession={designHistory:[{id:'verified-heading'},{id:'verified-button'}],deliveryMilestones:[]};renderSession(activeSession);}
function openPalette(query=''){if(!original.dialog.open){$('#command-trigger').focus();$('#command-trigger').click();}input(original.input,query);}
function openMilestone(){$('#delivery-create-milestone').focus();$('#delivery-create-milestone').click();}
$('#fixture-palette').addEventListener('click',()=>openPalette());
$('#fixture-empty').addEventListener('click',()=>openPalette('No matching workspace xyz'));
$('#fixture-milestone').addEventListener('click',openMilestone);
$('#fixture-feedback').addEventListener('click',()=>toast('This is a longer synthetic message. It remains readable, can be dismissed, and never implies a source change.'));
$('#fixture-modal-error').addEventListener('click',()=>{openMilestone();input(original.name,'Introduction checkpoint');failNext=true;original.form.requestSubmit();});
$('#fixture-theme').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';});
async function runAssertions(){
 if(fixtureRunning)return;fixtureRunning=true;$('#fixture-rerun').disabled=true;$('#test-results').dataset.result='running';$('#test-results').textContent='Running isolated assertions';$('#test-details').textContent='';
 const checks=[],check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
 try{
  await reset();const navigationBefore=calls.length;openPalette();await frame();
  check(original.dialog.open&&original.dialog.matches(':modal')&&document.activeElement===original.input,'Original command opener uses a native modal and focuses its search input');
  check($$('[data-command-mode]').length===commands.length&&commands.length===14,'Palette renders the real fourteen workspace destinations');
  const commandNodes=$$('[data-command-mode]');refinePilotCommandPalette();refinePilotCommandPalette();check(commandNodes.every((node,i)=>node===$$('[data-command-mode]')[i]),'Palette refinement preserves the original command buttons and handlers');
  if(pilot){
   check(original.dialog.getAttribute('aria-labelledby')==='foundry-command-title'&&$('#foundry-command-title').textContent==='Go to workspace'&&original.input.getAttribute('aria-label')==='Search workspaces','Pilot palette has an explicit title and searchable workspace label');
   check($('#foundry-command-count').textContent==='14 workspaces'&&$$('.foundry-command-heading').length===1&&$$('.foundry-command-footer').length===1,'Count and keyboard guidance remain singular across refinements');
   check($('[data-command-mode="canvas"]').getAttribute('aria-current')==='page'&&$$('[aria-current="page"]').length===1,'Only the active workspace is exposed as current');
   check(key(original.input,'ArrowDown').defaultPrevented&&document.activeElement===commandNodes[0],'Down from search focuses the first existing command');
   key(document.activeElement,'End');check(document.activeElement===commandNodes.at(-1),'End moves result focus to the final command');key(document.activeElement,'Home');check(document.activeElement===commandNodes[0],'Home returns result focus to the first command');key(document.activeElement,'ArrowUp');check(document.activeElement===commandNodes.at(-1),'Up wraps focus within native command results');key(document.activeElement,'ArrowDown');check(document.activeElement===commandNodes[0],'Down wraps focus within native command results');
   original.input.focus();check(!key(original.input,'Home').defaultPrevented&&document.activeElement===original.input,'Search retains native Home editing semantics');
   for(const options of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}]){const before=calls.length;const event=key(original.input,'Enter',options);check(!event.defaultPrevented&&original.dialog.open&&calls.length===before,'Composition or modifier guard prevents command execution: '+JSON.stringify(options));}
   const searchTop=original.input.getBoundingClientRect().top;input(original.input,'rEvIeW');await frame();check($$('[data-command-mode]').length===1&&$('[data-command-mode]').dataset.commandMode==='review'&&$('#foundry-command-count').textContent==='1 workspace','Original search remains case-insensitive with an accurate singular result count');
   check(Math.abs(original.input.getBoundingClientRect().top-searchTop)<=1,'Search stays vertically anchored when the result list shrinks');
   input(original.input,'No matching workspace xyz');await frame();check(!$$('[data-command-mode]').length&&$('.foundry-command-empty').textContent.includes('No matching workspaces')&&$('#foundry-command-count').textContent==='0 workspaces','Empty search gives guidance without inventing a command');
   const emptyBefore=calls.length;key(original.input,'Enter');check(original.dialog.open&&calls.length===emptyBefore,'Enter with no results performs no navigation');
   check(Math.abs(original.input.getBoundingClientRect().top-searchTop)<=1,'Empty search retains the same anchored input position');
  }else check(!$('.foundry-command-heading')&&!$('.foundry-command-footer')&&original.input.getAttribute('aria-label')==='Search commands','Gate off retains the original palette title and search presentation');
  $('#workspace-menu-trigger').focus();check(original.dialog.contains(document.activeElement),'Native modal prevents focus from escaping into the covered workspace');
  input(original.input,'Review');original.input.focus();if(pilot)key(original.input,'Enter');else $('[data-command-mode="review"]').click();await settle();
  check(!original.dialog.open&&activeMode==='review'&&calls.at(-1).type==='navigation'&&calls.at(-1).mode==='review','Selecting a real result closes the palette and navigates without mutating data');
  check(document.activeElement===$('#command-trigger'),'Palette close restores the original visible opener');
  check(!calls.slice(navigationBefore).some(item=>item.type==='api'),'Workspace commands never submit a source or milestone request');
  if(pilot){
   const temporary=document.createElement('button');temporary.textContent='Temporary opener';$('#fixture-controls').append(temporary);temporary.focus();openCommands();temporary.remove();original.close.click();await settle();check(document.activeElement===$('#workspace-menu-trigger'),'Removed palette openers fall back to the visible workspace menu');
   check(restorePilotDialogFocus(document.body)&&document.activeElement===$('#workspace-menu-trigger'),'Body is not treated as a valid dialog focus return target');
  }
  $('#command-trigger').focus();const shortcut=key(document,'k',{metaKey:true});await settle();check(shortcut.defaultPrevented&&original.dialog.open,'Original Command K shortcut opens the palette');key(document,'k',{metaKey:true,repeat:true});check(original.dialog.open,'Repeated shortcut keydown does not oscillate the modal');key(document,'k',{metaKey:true});await settle();check(!original.dialog.open,'Original Command K shortcut closes an open palette');
  openMilestone();await frame();check(original.milestone.open&&original.milestone.matches(':modal')&&document.activeElement===original.name,'Original milestone opener uses the real dialog and name focus');
  key(document,'k',{metaKey:true});check(!original.dialog.open&&original.milestone.open,'Command shortcut does not stack a second modal over a milestone');
  check(original.milestone.getAttribute('aria-labelledby')==='delivery-milestone-title'&&original.name.required,'Milestone keeps its existing accessible title and required-name contract');
  const emptyBefore=calls.length;original.form.requestSubmit();await settle();check(calls.length===emptyBefore&&original.name.validity.valueMissing,'Blank milestone submission is rejected by native validation before transport');
  input(original.name,'  Introduction checkpoint  ');failNext=true;original.form.requestSubmit();await settle();
  check(original.milestone.open&&original.name.value==='  Introduction checkpoint  '&&activeSession.deliveryMilestones.length===0,'Failed milestone acknowledgement preserves the dialog draft and does not create a record');
  check(original.toast.textContent.includes('Synthetic <save> failed.')&&!original.toast.querySelector('save'),'Feedback treats error text literally rather than injecting markup');
  if(pilot){
   check(original.toast.parentElement===original.milestone&&original.toast.classList.contains('is-visible')&&!original.toast.inert,'Modal failure feedback lives inside the native top layer and remains interactive');
   check($('.foundry-feedback-message',original.toast).getAttribute('role')==='status'&&$('.foundry-feedback-message',original.toast).getAttribute('aria-atomic')==='true','Feedback preserves a single atomic live message with a separate dismiss action');
   const dismiss=$('button',original.toast);dismiss.focus();dismiss.click();check(!original.toast.classList.contains('is-visible')&&original.toast.inert&&document.activeElement===original.name,'Dismissing modal feedback hides it from focus and returns to the retained input');
   failNext=true;original.form.requestSubmit();await settle();$('#delivery-milestone-close').click();await settle();check(original.toast.parentElement===document.body&&!original.toast.classList.contains('is-visible')&&original.toast.inert&&document.activeElement===$('#delivery-create-milestone'),'Closing the modal restores feedback to body, hides it and restores the current opener');
   openMilestone();await frame();input(original.name,'  Introduction checkpoint  ');
  }else check(original.toast.parentElement===document.body&&!original.toast.classList.contains('foundry-feedback'),'Gate off retains the existing body-level feedback behavior');
  const oldOpener=$('#delivery-create-milestone');holdNext=true;const pendingBefore=calls.length;original.form.requestSubmit();await settle();check(original.milestone.open&&activeSession.deliveryMilestones.length===0&&calls.length===pendingBefore+1,'Milestone remains open and uncreated until the original request is acknowledged');
  const payload=calls.at(-1);check(payload.method==='POST'&&payload.url.endsWith('/delivery-milestones')&&payload.body.name==='Introduction checkpoint'&&payload.body.entryIds.join('|')==='verified-heading|verified-button','Milestone payload trims its name and groups only the currently recorded verified entry IDs');
  releaseHeld();await settle();check(!original.milestone.open&&activeSession.deliveryMilestones.length===1&&$('#delivery-create-milestone')!==oldOpener,'Acknowledged milestone creation uses the real close handler after the opener is rerendered');
  if(pilot)check(document.activeElement===$('#delivery-create-milestone'),'Successful milestone close focuses the replacement opener rather than a detached node');
  check(original.toast.textContent.includes('Milestone created.'),'Success feedback appears only after milestone acknowledgement');dismissFeedback();
  openMilestone();await frame();input(original.name,'Cancelled draft');$('#delivery-milestone-cancel').click();await settle();check(!original.milestone.open&&activeSession.deliveryMilestones.length===1,'Native Cancel closes the dialog without creating another milestone');
  activeSession.designHistory=[];renderSession(activeSession);check($('#delivery-create-milestone').disabled,'Empty verified history cannot offer a new milestone');
  if(pilot){
   $('#fixture-feedback').focus();toast('A dismissible synthetic notice.');const feedbackButton=$('button',original.toast);feedbackButton.focus();feedbackButton.click();check(original.toast.inert&&!original.toast.classList.contains('is-visible')&&document.activeElement===$('#fixture-feedback'),'Hidden regular feedback is unfocusable and restores its initiating control');
   for(const theme of ['light','dark']){
    document.documentElement.dataset.theme=theme;openPalette();await frame();const bounds=original.dialog.getBoundingClientRect(),search=original.input.getBoundingClientRect(),list=original.list.getBoundingClientRect(),footer=$('.foundry-command-footer').getBoundingClientRect();
    check(bounds.left>=0&&bounds.right<=innerWidth+1&&bounds.top>=0&&bounds.bottom<=innerHeight+1&&original.dialog.scrollWidth<=original.dialog.clientWidth+1,theme+' command dialog fits the current viewport without horizontal overflow');
    check(search.height>=28&&search.height<=48&&list.bottom<=footer.top+1,theme+' search remains compact and results do not overlap keyboard guidance');
    original.close.click();await settle();activeSession.designHistory=[{id:'verified-heading'},{id:'verified-button'}];renderSession(activeSession);openMilestone();await frame();toast('A persistent synthetic modal error that wraps on narrow screens without obscuring the controls.');await frame();const modalBounds=original.milestone.getBoundingClientRect(),notice=original.toast.getBoundingClientRect();
    check(modalBounds.left>=0&&modalBounds.right<=innerWidth+1&&modalBounds.bottom<=innerHeight+1&&original.milestone.scrollWidth<=original.milestone.clientWidth+1,theme+' milestone and modal feedback fit the viewport width');
    check(notice.left>=modalBounds.left-1&&notice.right<=modalBounds.right+1,theme+' modal feedback remains within its native dialog bounds');$('#delivery-milestone-cancel').click();await settle();
   }
  }
  for(const[name,selector]of Object.entries({dialog:'#command-dialog',input:'#command-input',list:'#command-list',close:'#close-commands',milestone:'#delivery-milestone-dialog',form:'#delivery-milestone-form',name:'#delivery-milestone-name',toast:'#toast'}))check($(selector)===original[name],name+' original overlay node survives repeated rendering and reparenting');
  await reset();$('#test-results').textContent='PASS: '+checks.length+' isolated assertions';$('#test-results').dataset.result='pass';$('#test-details').textContent=checks.map((label,i)=>(i+1)+'. '+label).join(String.fromCharCode(10));$('#fixture-note').textContent='Real native dialogs and handlers; synthetic navigation and milestone transport only.';
 }catch(error){$('#test-results').textContent='FAIL: '+error.message;$('#test-results').dataset.result='fail';$('#test-details').textContent=error.stack;console.error(error);}
 finally{fixtureRunning=false;$('#fixture-rerun').disabled=false;}
}
$('#fixture-rerun').addEventListener('click',runAssertions);await runAssertions();
`;
const diagnostics = `window.addEventListener('error',event=>{const target=document.querySelector('#fixture-errors');if(target)target.textContent+=(event.error?.stack||event.message||'Resource failed')+'\\n';},true);window.addEventListener('unhandledrejection',event=>{document.querySelector('#fixture-errors').textContent+=String(event.reason?.stack||event.reason)+'\\n';});`;
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Foundry overlays — isolated pilot fixture</title><script>${diagnostics}</script>${stylesheets}<style>html,body{margin:0;min-height:100%;overflow:auto}.fixture-toolbar{display:flex;flex-wrap:wrap;gap:8px 14px;padding:12px 16px;background:#e9edf5;color:#17243d;font:12px/18px Arial,sans-serif}.fixture-toolbar button{padding:4px 8px;border:1px solid #8a9bb8;border-radius:4px;background:white;color:#17243d;font:12px/18px Arial,sans-serif}.fixture-toolbar pre{position:absolute;z-index:100;max-width:calc(100vw - 32px);max-height:50vh;overflow:auto;padding:16px;background:white;border:1px solid #8a9bb8;white-space:pre-wrap}#app-shell.app-shell[data-next]{display:block;min-height:500px;height:auto;padding:32px;background:var(--surface)}.fixture-surface{max-width:640px;display:grid;gap:24px}.fixture-surface header{display:flex;gap:12px;align-items:center}.fixture-surface h1{font:550 20px/28px var(--sans);margin:0}.fixture-surface p{font:400 13px/22px var(--sans);color:var(--muted);margin:0}.fixture-surface .icon-button{width:32px;height:32px}.fixture-context{display:grid;gap:16px;padding-top:24px;border-top:1px solid var(--line)}[data-result=fail]{color:#ae1b1b}</style></head><body><header class="fixture-toolbar" id="fixture-controls" aria-label="Isolated test controls"><strong>Overlay fixture · synthetic data</strong><button id="fixture-palette">Open palette</button><button id="fixture-empty">Empty search</button><button id="fixture-milestone">Milestone dialog</button><button id="fixture-modal-error">Modal failure</button><button id="fixture-feedback">Feedback</button><button id="fixture-theme">Toggle UI theme</button><button id="fixture-rerun">Run checks again</button><a href="/?theme=light">Default design</a><a href="/?foundations=pilot&theme=light">Pilot alias</a><a href="/?foundations=off&theme=light">Previous design</a><details><summary id="test-results">Running isolated assertions</summary><pre id="test-details"></pre></details><details><summary>Runtime errors</summary><pre id="fixture-errors"></pre></details></header><div id="app-shell" class="app-shell" data-next="true" data-mode="canvas"><main class="fixture-surface"><header><h1>Overlay interaction fixture</h1><button class="icon-button" id="command-trigger" aria-label="Open commands"><i data-icon="command"></i></button><button class="icon-button" id="workspace-menu-trigger" aria-label="Open workspace menu"><i data-icon="menu"></i></button></header><p id="fixture-note">The native palette and milestone dialogs below use Foundry's original markup and handlers. Navigation and saves stay inside this isolated fixture.</p><p id="fixture-destination">Synthetic destination: canvas</p><section class="fixture-context"><strong>Recorded verified history</strong><p>Two synthetic entries support the original Create milestone action.</p><div id="milestone-host"></div></section><div id="workspace-menu" hidden></div></main></div>${dialog('command-dialog')}${dialog('delivery-milestone-dialog')}<div class="toast" id="toast" role="status"></div><script type="module">${script}</script></body></html>`;
if (process.argv.includes('--check')) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: diagnostics + script,
    encoding: 'utf8',
  });
  if (result.status !== 0) process.stderr.write(result.stderr || String(result.error));
  else console.log('Overlay fixture extraction and module syntax: PASS');
  process.exit(result.status ?? 1);
}
const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};
const port = Number(process.env.FOUNDRY_OVERLAYS_FIXTURE_PORT ?? 0);
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
    'Isolated overlays fixture: http://127.0.0.1:' +
      this.address().port +
      '/?foundations=pilot&theme=light',
  );
  console.log(
    'Synthetic navigation and transport only. No live session, source writer or provider.',
  );
});
