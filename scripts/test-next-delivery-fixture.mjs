// Isolated production-renderer checks with synthetic records and mock persistence.
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
  index.indexOf('class="mode-surface centered-mode delivery-mode"'),
);
const end = index.indexOf('<section class="apply-run"', start);
if (start < 0 || end <= start) throw new Error('Delivery markup boundaries not found');
const markup = index.slice(start, end).replace(/\s+hidden\s*>/, '>');
const part = (from, to) => source.slice(source.indexOf(from), source.indexOf(to));
const script = String.raw`
import { createNextDelivery } from './apps/inspector/public/next-delivery.js';
import { deliveryNarrativeReadOnly } from './apps/inspector/public/workflow.js';
import { createDeliveryEvidenceUI } from './apps/inspector/public/delivery-evidence-ui.js';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const escapeText=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const escapeAttribute=s=>escapeText(s).replaceAll('"','&quot;');
const sourceText=()=> 'fixture/style.css:24', verificationContextLabel=()=> 'Desktop · light · current';
const renderIcons=()=>{},toast=()=>{},setMode=()=>{},loadVisualCheckReports=()=>{};
const params=new URLSearchParams('ui=next'),sessionId='synthetic';
let nextDelivery,deliveryTab='handoff',deliveryRecordId='',deliveryDocumentId='',visualCheckReportId='',runtimeConnected=true,deliveryGenerating=false,deliveryActionError='';
let visualChecksStatus='loaded',visualChecksError='',visualCheckReports=[{id:'synthetic-run',createdAt:'2026-09-23T12:00:00Z',exitCode:3,results:[{name:'Signup at desktop',status:'unbaselined',geometryChanges:[],newFindings:[],reason:'No approved baseline exists for this screen.'}]}];
const record={id:'draft',title:'Improve the primary action without competing with supporting controls',summary:'A reviewed design handoff, still awaiting rebuilt verification.',intent:'Keep the main action clear.',risks:['Long translations must remain readable.'],questions:['Does the label fit at mobile width?'],narrativeSource:'authored',status:'ready',changeIds:['change'],affectedFiles:['fixture/a-deliberately-long-path-to-the-component-styles/action-button.css'],affectedComponents:['Signup/PrimaryAction'],affectedTokens:['--action-background'],contexts:[{breakpoint:'desktop',theme:'light',state:'current'},{breakpoint:'mobile',theme:'dark',state:'focus'}],acceptanceCriteria:[{label:'Rebuilt target meets the requested dimensions',status:'pending'}],blockers:['Rebuilt measurement is not available yet.'],validationResults:[],verificationResults:[],evidence:[],captureIssues:[]};
record.status='draft';
let activeSession={deliveryRecords:[record,{...record,id:'verified',title:'Verified touch-target correction',status:'verified',blockers:[],acceptanceCriteria:[{label:'Target height matches 44px',status:'passed'}],validationResults:[{name:'Fixture tests',passed:true,summary:'Passed in the isolated example.'}],verificationResults:[{property:'minHeight',passed:true}]}],documentationPages:[{id:'doc',title:'Primary action component',summary:'Source-derived documentation.',kind:'component',freshness:'stale',body:'# Primary action\n\nSource: fixture/a-long-path-to-current-project-component-styles.css\n\nThis document is stale and needs a refresh.',sourceFiles:['style.css'],deliveryRecordIds:['verified'],updatedAt:'2026-09-23T12:00:00Z'}],designHistory:[{id:'entry',title:'Touch target verified',summary:'Changed minimum height from 40px to 44px.',createdAt:'2026-09-23T12:00:00Z',affectedFiles:['style.css'],changeIds:['change'],applyRunId:'synthetic-apply'}],deliveryMilestones:[{status:'draft',name:'Recording readiness',summary:'A grouping of verified decisions, not a deployment.',entryIds:['entry']}],applyRuns:[]};
const engineeringEvidence=()=>[];
const deliveryEvidenceUI=createDeliveryEvidenceUI({readImage:()=>{throw new Error('No image available in this isolated example');}});
let pendingResolve,pendingReject;const writes=[];
const api=(path,options)=>{writes.push({path,options});return new Promise((resolve,reject)=>{pendingResolve=()=>{const id=path.split('/').at(-1),payload=JSON.parse(options.body);activeSession={...activeSession,deliveryRecords:activeSession.deliveryRecords.map(r=>r.id===id?{...r,...payload}:r)};resolve(activeSession)};pendingReject=reject;});};
const renderSession=session=>{activeSession=session;renderDelivery();};
${part('function deliveryStatusLabel(', 'async function loadVisualCheckReports()')}
${part('function visualChecksMarkup()', 'function visualRecipeTargetSuggestions(')}
${part("$$('[data-delivery-tab]').forEach", 'const milestoneDialog =')}
const checks=[];
const check=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label)};
const input=(selector,value)=>{const e=$(selector);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));};
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
try {
 renderDelivery();
 check($('.delivery-layout').classList.contains('has-record'),'Handoff has a separate context rail');
 check($('.next-delivery-context').textContent.includes(record.affectedFiles[0]),'Full source path retained');
 check($('.next-delivery-criteria-status').textContent==='1 blocker','Blockers replace misleading Ready');
 check($('.next-delivery-blockers').textContent.includes(record.blockers[0]),'Blocker reasons visible');
 check($('#delivery-generate-docs').hidden,'Documentation action belongs to Documentation');
 input('[data-delivery-field="intent"]','Unsubmitted intent');
 $('[data-delivery-field="intent"]').focus();$('[data-delivery-field="intent"]').setSelectionRange(3,7);
 renderDelivery();
 check($('[data-delivery-field="intent"]').value==='Unsubmitted intent','Narrative survives refresh');
 check(document.activeElement===$('[data-delivery-field="intent"]') && document.activeElement.selectionStart===3,'Caret survives refresh');
 $('[data-delivery-field="intent"]').dispatchEvent(new Event('change'));
 check(writes.length===0,'Blur does not silently save Next notes');
 $('[data-delivery-record="verified"]').click();
 check($$('[data-delivery-field]').length===0 && !$('[data-next-save-narrative]'),'Verified narratives remain read only');
 check($('.next-delivery-criteria-status').textContent==='All criteria passed','Passed status names its evidence');
 $('[data-delivery-record="draft"]').click();
 check($('[data-delivery-field="intent"]').value==='Unsubmitted intent','Record switching preserves draft');
 runtimeConnected=false;renderDelivery();
 check($('[data-next-save-narrative]').disabled && $('.next-delivery-save-status').textContent.includes('offline'),'Offline persistence disabled with recovery');
 runtimeConnected=true;renderDelivery();
 $('[data-next-save-narrative]').click();
 check($('[data-next-save-narrative]').disabled,'Pending save disabled');
 $('[data-next-save-narrative]').dispatchEvent(new Event('click'));await settle();
 check(writes.length===1,'Duplicate note save suppressed');
 pendingReject(new Error('Synthetic failure'));await settle();
 check($('[data-delivery-field="intent"]').value==='Unsubmitted intent' && $('.next-delivery-save-status').textContent.includes('Not saved'),'Failed save preserves notes');
 $('[data-next-save-narrative]').click();
 input('[data-delivery-field="intent"]','Newer unsubmitted intent');pendingResolve();await settle();
 check($('[data-delivery-field="intent"]').value==='Newer unsubmitted intent','Earlier acknowledgement cannot erase newer edits');
 $('[data-next-reset-narrative]').click();
 check($('[data-delivery-field="intent"]').value==='Unsubmitted intent' && $('[data-next-save-narrative]').disabled,'Discard restores latest acknowledged notes');
 $('[data-delivery-tab="documentation"]').click();
 check(!$('#delivery-generate-docs').hidden && $('#delivery-export').hidden,'View-specific actions');
 check($('.delivery-document pre').textContent.includes('This document is stale'),'Documentation content and freshness retained');
 $('#delivery-generate-docs').click();
 check($('#delivery-generate-docs').disabled,'Documentation refresh has a pending state');
 const beforeDuplicate=writes.length;$('#delivery-generate-docs').dispatchEvent(new Event('click'));await settle();
 check(writes.length===beforeDuplicate,'Duplicate documentation refresh blocked');
 pendingReject(new Error('Synthetic refresh failure'));await settle();
 check($('.next-delivery-footer').textContent.includes('Documentation was not refreshed'),'Refresh failure reported without false success');
 deliveryActionError='';renderDelivery();
 $('[data-delivery-tab="history"]').click();
 check($('.delivery-timeline').textContent.includes('Touch target verified') && $('.delivery-milestones').textContent.includes('Recording readiness'),'History and milestones retained');
 $('[data-delivery-tab="checks"]').click();
 check($('.visual-check-status').textContent==='unbaselined','Missing baseline does not imply passing');
 $('[data-delivery-tab="checks"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));
 check(deliveryTab==='handoff' && $('[data-delivery-tab="handoff"]').getAttribute('aria-selected')==='true','Keyboard tab navigation selects matching panel');
 const saved=activeSession.deliveryRecords;activeSession.deliveryRecords=[];renderDelivery();
 check($('#delivery-export').disabled && $('.delivery-empty.is-stage').textContent.includes('Your reviewed work lands here'),'Empty handoff has honest CTA and no export');
 activeSession.deliveryRecords=saved;renderDelivery();
 $('#test-results').textContent='PASS: '+checks.length+' isolated checks. Synthetic records; no live writes or exports.';
}catch(error){$('#test-results').textContent='FAIL: '+error.stack;}
`;
const bundle = await build({
  stdin: { contents: script, resolveDir: root, sourcefile: 'delivery-fixture.js' },
  bundle: true,
  format: 'esm',
  write: false,
});
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>Delivery isolated test</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/workflow.css"><link rel="stylesheet" href="/experience.css"><link rel="stylesheet" href="/next-workspace.css"><style>[data-next] .next-delivery:not([hidden]){height:calc(100vh - 32px)}#test-results{height:32px;padding:6px;font:12px/20px sans-serif;background:#fff;color:#111;overflow:auto}</style></head><body><div id="test-results">Running isolated checks</div><div data-next data-mode="delivery">${markup}</div><script type="module" src="/fixture.js"></script></body></html>`;
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
}).listen(4689, '127.0.0.1', () =>
  console.log('Isolated Delivery fixture ready on localhost:4689'),
);
