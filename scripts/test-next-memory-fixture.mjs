// Isolated rendering and interaction tests. No real Foundry session or persistence.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { build } from 'esbuild';
const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'apps/inspector/dist');
const source = await readFile(resolve(root, 'apps/inspector/public/app.js'), 'utf8');
const index = await readFile(resolve(root, 'apps/inspector/public/index.html'), 'utf8');
const start = index.lastIndexOf(
  '<section',
  index.indexOf('class="mode-surface centered-mode decision-memory-mode"'),
);
const end = index.lastIndexOf(
  '<section',
  index.indexOf('class="mode-surface centered-mode visual-agent-mode"'),
);
if (start < 0 || end <= start) throw new Error('Cannot find memory markup boundaries');
const markup = index.slice(start, end).replace(/\s+hidden\s*>/, '>');
const part = (from, to) => source.slice(source.indexOf(from), source.indexOf(to));
const script = String.raw`
import { createNextDesignMemory } from './apps/inspector/public/next-design-memory.js';
const $=s=>document.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const escapeText=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const escapeAttribute=s=>escapeText(s).replaceAll('"','&quot;');
const sourceText=()=> 'fixture/style.css:24';
const renderIcons=()=>{}, toast=()=>{}, setMode=()=>{};
const params=new URLSearchParams('ui=next');
let nextDesignMemory, memoryCaptureBusy=false, memoryCaptureError='', bridgeConnected=true;
let decisionMemoryId='',decisionMemorySearch='',decisionMemoryFilter='all',decisionMemoryOutcome='approved';
const decisions=[
 {id:'one',title:'Keep supporting actions quiet, even with deliberately long component labels',summary:'Use the quiet variant for secondary actions. Reserve the primary treatment for the next meaningful step.',rationale:'The primary action needs to remain visually distinct when several actions sit together.',outcome:'approved',enabled:true,categories:['appearance'],conditions:{components:['Signup/PrimaryAction','Signup/SecondaryAction'],elementKinds:['button'],properties:['backgroundColor','borderColor'],breakpoints:['desktop','tablet','mobile'],themes:['light','dark'],states:['current','hover','focus']},rules:[{operator:'prefer',property:'backgroundColor',value:'var(--action-quiet-background)'}],sourceLocations:['fixture/style.css:24','fixture/a-deliberately-long-source-name-that-must-wrap-without-clipping/component.css:120'],evidence:[{kind:'manual',label:'Captured supporting-action comparison',refId:'synthetic-only'}]},
 {id:'two',title:'Avoid competing primary actions',summary:'Do not place equally prominent calls to action beside one another.',rationale:'Retained for context, not active guidance.',outcome:'rejected',enabled:false,categories:['hierarchy'],conditions:{components:['Signup/PrimaryAction']},rules:[],evidence:[],sourceLocations:[]},
 {id:'three',title:'Respect reduced motion',summary:'Keep meaning available without animation.',outcome:'rule',enabled:true,conditions:{},rules:[],evidence:[]}
];
let bridgeState={selection:{label:'Selected fixture button',kind:'button',source:{}},decisionMemory:{canCapture:true,hasEditedValues:true,decisions,relevant:[{decision:decisions[0],score:90,reasons:['Matching component and property'],conflicts:[{property:'backgroundColor'}]}]}};
let pending,failSave=false;
const commands=[];
async function runDurableAction(command,payload,options={}) {
 commands.push({command,payload});
 if(command==='save-design-decision') await new Promise(resolve=>pending=resolve);
 if(failSave) return null;
 await options.onSuccess?.({saved:true});
 return {saved:true};
}
${part('function renderMemory()', 'function visualAgentRequests()')}
${part("$('#decision-memory-search').addEventListener", "$('#visual-agent-region').addEventListener")}
const checks=[];
const check=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label)};
const input=(selector,value)=>{const e=$(selector);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));};
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
try {
 renderMemory();
 check($$('.decision-memory-row').length===3,'Saved decisions displayed');
 check($$('.next-memory-scope dt').length===7,'Every saved scope axis has a label');
 check($('.next-memory-scope').textContent.includes('focus'),'No truncation after six context conditions');
 check(!$('.next-memory-correction').open,'Corrections start collapsed');
 check($('#decision-memory-save').disabled,'Blank capture cannot save');
 input('#decision-memory-title','New title');input('#decision-memory-summary','New guidance');
 check(!$('#decision-memory-save').disabled,'Valid capture enables save');
 $('.next-memory-correction').open=true;
 input('[data-decision-summary]','Unsubmitted correction');
 $('[data-decision-summary]').focus();$('[data-decision-summary]').setSelectionRange(2,6);
 renderMemory();
 check($('[data-decision-summary]').value==='Unsubmitted correction','Draft survives workspace update');
 check(document.activeElement===$('[data-decision-summary]') && document.activeElement.selectionStart===2,'Correction focus and caret survive update');
 check($('.next-memory-correction').open,'Disclosure stays expanded');
 $('[data-design-decision="two"]').click();
 check($('.decision-state').dataset.enabled==='false','Disabled guidance uses explicit state');
 $('[data-design-decision="one"]').click();
 check($('[data-decision-summary]').value==='Unsubmitted correction','Switching decisions retains unsaved correction');
 input('#decision-memory-search','no possible match');
 check($('.is-stage').textContent.includes('No visible decision'),'Empty search is distinct from empty library');
 $('[data-clear-memory-filter]').click();
 check($$('.decision-memory-row').length===3,'Clear filters restores list');
 bridgeConnected=false;renderMemory();
 check($('#decision-memory-save').disabled && $('[data-save-decision-correction]').disabled,'Disconnected persistence actions disabled');
 check($('#decision-memory-title').value==='New title' && $('[data-decision-summary]').value==='Unsubmitted correction','Offline state preserves capture and correction');
 check($('#next-memory-save-help').textContent.includes('offline'),'Offline recovery visible');
 bridgeConnected=true;renderMemory();
 failSave=true;$('#decision-memory-save').click();
 check(memoryCaptureBusy && $('#decision-memory-save').disabled,'Save guarded while pending');
 $('#decision-memory-save').dispatchEvent(new Event('click'));await settle();
 check(commands.length===1,'Duplicate capture suppressed');
 pending();await settle();
 check($('#decision-memory-title').value==='New title' && $('#next-memory-save-help').textContent.includes('Not saved'),'Failed capture retains inputs and explicit error');
 failSave=false;$('#decision-memory-save').click();
 input('#decision-memory-title','Newer unsent title');pending();await settle();
 check($('#decision-memory-title').value==='Newer unsent title','Acknowledgement cannot clear newer typing');
 check($('#decision-memory-summary').value==='','Acknowledged unchanged input clears');
 input('#decision-memory-title','');
 input('[data-decision-summary]','');
 check($('[data-save-decision-correction]').disabled,'Blank correction cannot save');
 input('[data-decision-summary]','Unsubmitted correction');
 const saved=bridgeState.decisionMemory.decisions;
 bridgeState.decisionMemory.decisions=[];renderMemory();
 check($('.is-stage').textContent.includes('Keep the why') && $('#decision-memory-export').disabled,'Honest empty library with export disabled');
 bridgeState.decisionMemory.decisions=saved;renderMemory();
 $('.next-memory-correction').open=true;
 $('#test-results').textContent='PASS: '+checks.length+' isolated assertions. Synthetic records; no session or persistence writes.';
} catch(error) { $('#test-results').textContent='FAIL: '+error.stack; }
`;
const bundle = await build({
  stdin: { contents: script, resolveDir: root, sourcefile: 'memory-fixture.js' },
  bundle: true,
  format: 'esm',
  write: false,
});
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>Design memory isolated test</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/next-workspace.css"><style>[data-next] .next-design-memory:not([hidden]){height:calc(100vh - 32px)}#test-results{height:32px;padding:6px;font:12px/20px sans-serif;background:#fff;color:#111;overflow:auto}</style></head><body><div id="test-results">Running isolated checks</div><div data-next data-mode="memory">${markup}</div><script type="module" src="/fixture.js"></script></body></html>`;
const types = { '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      url.searchParams.get('theme') === 'dark'
        ? html.replace('data-theme="light"', 'data-theme="dark"')
        : html,
    );
    return;
  }
  if (url.pathname === '/fixture.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(bundle.outputFiles[0].text);
    return;
  }
  const file = resolve(publicDir, '.' + url.pathname);
  if (!file.startsWith(publicDir + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
}).listen(4689, '127.0.0.1', () => console.log('Isolated memory fixture ready on localhost:4689'));
