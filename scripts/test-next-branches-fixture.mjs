// Isolated UI tests: no Foundry session, real preview or persistence writes.
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
  index.indexOf('class="mode-surface centered-mode design-branches-mode"'),
);
const end = index.lastIndexOf(
  '<section',
  index.indexOf('class="mode-surface centered-mode stress-lab-mode"'),
);
const markup = index.slice(start, end).replace(/\s+hidden\s*>/, '>');
const part = (from, to) => source.slice(source.indexOf(from), source.indexOf(to));
const script = String.raw`
import { createNextDesignBranches, branchComparisonDirections, branchPreviewKey } from './apps/inspector/public/next-design-branches.js';
const $=s=>document.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const escapeText=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const escapeAttribute=s=>escapeText(s).replaceAll('"','&quot;');
const formatValue=(v,u)=>String(v)+(u??'');
const changeContextSet=()=>({breakpoints:['desktop'],themes:['light'],states:['current']});
const selectedViewport=()=>({width:1440,height:900});
const renderIcons=()=>{}, upgradeSelects=()=>{}, syncCustomSelect=()=>{}, invalidateFrameTransport=()=>{};
const api=()=>{throw new Error('Persistence is deliberately unavailable in this fixture')};
const activateDesignDirection=()=>{throw new Error('Do not activate fixture directions')};
const requestFrameCommand=api, previewUrl='', sessionId='synthetic', bridgeConnected=false;
const params=new URLSearchParams('ui=next');
let nextDesignBranches, designBranchPreviewRenderKey='', branchCompareLeft='a',branchCompareRight='b';
const designBranchFrames=new Map(),branchFrameTimers=new Map(),branchDecisionSelection=new Set();
const change=(id,value)=>({id,target:{id:'target',label:'An intentionally long component label that must wrap without colliding with status'},property:'minHeight',before:40,after:value,unit:'px',scope:'instance'});
const activeSession={activeDesignBranchId:'a',changeSet:{changes:[],operations:[]},designBranches:[
 {id:'a',name:'A quieter supporting action with a deliberately long direction name',status:'exploring',changes:[change('one',44)],rejectionReason:''},
 {id:'b',name:'A stronger primary hierarchy',status:'exploring',changes:[change('two',48)],rejectionReason:''}
],designBranchRecords:[{id:'record',name:'Saved decision with an intentionally long name',outcome:'rejected',changes:[change('one',44)],rationale:'Keep the stronger primary hierarchy. This portable record documents the decision rather than applying source changes.',compatibility:{status:'stale',matchedSources:0,totalSources:1,warnings:['Source changed. Review the mapping before restoring this direction.']}}]};
${part('function designBranchDirections()', 'function branchPreviewUrl(')}
${part('function branchPreviewUrl(', 'function renderDesignBranchDecisions(')}
${part('function renderDesignBranchDecisions()', 'async function activateDesignDirection(')}
${part('function renderDesignBranchDetail()', "$('#design-branch-create').addEventListener")}
const checks=[];
const check=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label)};
try {
 renderDesignBranches();
 check($$('.design-branch-preview-card').length===2,'Different directions get separate cards');
 check($$('[data-branch-decision]').length===2,'Compared decisions shown');
 const [first,second]=$$('[data-branch-decision]');
 first.click();second.click();
 check(!first.checked && second.checked && branchDecisionSelection.size===1,'Conflicting values are mutually exclusive');
 check(!$('#design-branch-compose').disabled,'Selected decision enables composition');
 const note=$('#design-branch-note');note.value='Unsubmitted rationale';note.focus();note.setSelectionRange(4,8);
 renderDesignBranches();
 check($('#design-branch-note').value==='Unsubmitted rationale','Note survives refresh');
 check(document.activeElement===$('#design-branch-note') && document.activeElement.selectionStart===4,'Note focus and caret survive refresh');
 check($('[data-restore-branch-record]').disabled,'Stale saved decisions cannot be restored');
 branchCompareLeft='main';branchCompareRight='main';renderDesignBranches();
 check($$('.design-branch-preview-card').length===1,'Same direction appears once');
 check(branchDecisionSelection.size===0 && $('#design-branch-compose').disabled,'Hidden decisions cannot remain selected');
 branchCompareLeft='a';branchCompareRight='b';renderDesignBranches();
 $('.next-branch-records').open=true;
 $('#test-results').textContent='PASS: '+checks.length+' isolated assertions. Synthetic directions; no live preview or persistence.';
}catch(error){$('#test-results').textContent='FAIL: '+error.stack;}
`;
const bundle = await build({
  stdin: { contents: script, resolveDir: root, sourcefile: 'branches-fixture.js' },
  bundle: true,
  format: 'esm',
  write: false,
});
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>Design branches isolated test</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/next-workspace.css"><style>[data-next] .next-design-branches:not([hidden]){height:calc(100vh - 32px)}#test-results{height:32px;padding:6px;font:12px/20px sans-serif;background:#fff;color:#111}</style></head><body><div id="test-results">Running isolated checks</div><div data-next data-mode="branches">${markup}</div><script type="module" src="/fixture.js"></script></body></html>`;
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
}).listen(4689, '127.0.0.1', () => console.log('Isolated branch fixture ready on localhost:4689'));
