// Synthetic presentation/handler test. No connection to a Foundry session or agent.
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
  index.indexOf('class="mode-surface centered-mode visual-agent-mode"'),
);
const end = index.lastIndexOf(
  '<section',
  index.indexOf('class="mode-surface centered-mode delivery-mode"'),
);
const markup = index.slice(start, end).replace(/\s+hidden\s*>/, '>');
const render = source.slice(
  source.indexOf('function renderVisualAgent()'),
  source.indexOf('async function handleVisualAgentProposal'),
);
const submit = source.slice(
  source.indexOf("$('#visual-agent-ask').addEventListener"),
  source.indexOf("$('#visual-agent-review').addEventListener"),
);
const script = String.raw`
import { createNextVisualAgent } from './apps/inspector/public/next-visual-agent.js';
import { visualAgentResponsePresentation } from './apps/inspector/public/workflow.js';
const $=s=>document.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const escapeText=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const escapeAttribute=s=>escapeText(s).replaceAll('"','&quot;');
const sourceText=s=>typeof s==='string'?s:s?.file??'';
const params=new URLSearchParams('ui=next');
let nextVisualAgent, visualAgentNewQuestion=false,visualAgentSubmitting=false,visualAgentSubmitError='',visualAgentRequestId='request';
let bridgeConnected=true;
const activeAgentPresence={connected:false};
const bridgeState={selection:{label:'Current selection (not the sent snapshot)',source:{file:'current.tsx',line:10},width:448,height:52},context:{breakpoint:'desktop',theme:'light',state:'current'},visualAgent:{}};
const proposal={id:'proposal',name:'A quieter supporting action',summary:'An intentionally long explanation of the suggested hierarchy, spacing and contrast adjustment that must remain readable at compact workspace sizes.',status:'draft',reasoning:['Keep the primary action visually dominant.'],exactValues:['minHeight: 40px → 44px','padding-inline: var(--space-control-inline)'],responsiveImpact:'Verify the authored mobile and desktop breakpoints.',sourceLocations:['src/components/signup/PasswordReveal/PasswordReveal.module.css:660:20'],verificationPlan:['Rebuild and measure the rendered target.'],changes:[{property:'minHeight'}]};
const request={id:'request',title:'Improve the hierarchy of this selected component without losing clarity at narrower widths',status:'ready',context:{targets:[{label:'Captured selection',source:{file:'captured.tsx',line:42}}],viewport:{width:1440,height:900},breakpoint:'desktop',theme:'light',state:'current'},messages:[{role:'user',body:'How could this action feel more deliberate?',createdAt:'2026-09-23T12:00:00Z'},{role:'agent',body:'Keep the primary action recognizable.\n\nHere is a proposal grounded in the captured source context.',createdAt:'2026-09-23T12:01:00Z'}],proposals:[proposal]};
const requests=[request];
const visualAgentRequests=()=>requests;
const activeVisualAgentRequest=()=>requests.find(r=>r.id===visualAgentRequestId);
const visualAgentContextSnapshot=()=>request.context;
const calls=[]; let completeRequest;
const api=async(path,payload)=>{calls.push({path,payload});return new Promise(resolve=>{completeRequest=resolve})};
const renderSession=()=>renderVisualAgent();
const handleVisualAgentProposal=button=>calls.push({action:button.dataset.agentProposalAction});
const renderIcons=()=>{},toast=()=>{};
const sessionId='synthetic';
${render}
${submit}
const tests=[];
const check=(condition,label)=>{if(!condition)throw new Error(label);tests.push(label)};
try {
renderVisualAgent();
check($('.next-agent-main').contains($('#visual-agent-prompt')),'Question editor belongs to main conversation');
check($('.next-agent-saved').textContent.includes('captured.tsx:42'),'Saved context uses exact captured source');
check(!$('.next-agent-saved').textContent.includes('current.tsx'),'Live selection does not replace sent context');
check($('.next-agent-proposal-details'),'Proposal details expand inline');
$('.next-agent-proposal-details').open=true;
$('[data-agent-proposal-action="preview"]').click();
check(calls.at(-1)?.action==='preview','Original proposal action retained');
$('#visual-agent-prompt').value='Unsubmitted draft';
renderVisualAgent();
check($('.next-agent-proposal-details').open,'Proposal disclosure survives refresh');
check($('#visual-agent-prompt').value==='Unsubmitted draft','Draft survives refresh');
bridgeConnected=false;renderVisualAgent();
check($('#visual-agent-ask').disabled && $('#visual-agent-region').disabled,'Offline live actions disabled');
check($('#visual-agent-prompt').value==='Unsubmitted draft','Offline preserves draft');
bridgeConnected=true;
request.proposals=[];renderVisualAgent();
check($('#visual-agent-conversation').textContent.includes('Response complete'),'Advice-only answer is complete');
check(!$('#visual-agent-conversation').textContent.includes('Waiting for a Foundry listener'),'Answered request does not show queued state');
request.status='thinking';request.agent={name:'Fixture agent'};renderVisualAgent();
check($('.next-agent-heading').textContent.includes('Fixture agent is working'),'Claimed request names its agent');
request.status='queued';delete request.agent;renderVisualAgent();
check($('#visual-agent-conversation').textContent.includes('Waiting for a Foundry listener'),'Queued request waits truthfully');
request.status='needs_attention';request.error='Synthetic interrupted response';renderVisualAgent();
check($('[data-agent-retry]'),'Interrupted request offers retry');
visualAgentNewQuestion=true;renderVisualAgent();
check(!$('.visual-agent-conversation-head'),'New question does not display previous request');
check($('#visual-agent-prompt').value==='Unsubmitted draft','New question preserves draft');
const before=calls.length;
$('#visual-agent-ask').click();$('#visual-agent-ask').click();
check(calls.length===before+1,'Submitting guard prevents duplicate requests');
$('#visual-agent-prompt').value='New typing while submission is pending';
completeRequest({visualAgentRequests:[request]});
await new Promise(resolve=>setTimeout(resolve,0));
check($('#visual-agent-prompt').value==='New typing while submission is pending','Acknowledgement preserves newer input');
$('#visual-agent-prompt').value='';
request.status='ready';request.proposals=[proposal];visualAgentNewQuestion=false;renderVisualAgent();
check($('#visual-agent-ask').disabled,'Empty prompt disabled');
$('.next-agent-proposal-details').open=true;
$('#test-results').textContent='PASS: '+tests.length+' isolated assertions. Synthetic data only; no real session or agent request.';
} catch(error){$('#test-results').textContent='FAIL: '+error.stack;}
`;
const bundle = await build({
  stdin: { contents: script, resolveDir: root, sourcefile: 'agent-fixture.js' },
  bundle: true,
  format: 'esm',
  write: false,
});
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>Visual Agent isolated presentation test</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/next-workspace.css"><style>[data-next] .next-visual-agent:not([hidden]){height:calc(100vh - 32px)}#test-results{height:32px;padding:6px;font:12px/20px sans-serif;background:#fff;color:#111}</style></head><body><div id="test-results">Running isolated assertions</div><div data-next data-mode="agent">${markup}</div><script type="module" src="/fixture.js"></script></body></html>`;
const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};
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
  console.log('Isolated Visual Agent fixture: http://127.0.0.1:4689'),
);
