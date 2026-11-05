// Isolated Canvas layout fixture. The original index, stylesheet order, Next
// shell initializer, pilot presentation and dock handler are used unchanged.
// Product content, selection data and the visible test controls are synthetic.
// No app.js bootstrap, live session, runtime, source writer or provider runs.
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'apps/inspector/public');
const index = await readFile(resolve(publicDir, 'index.html'), 'utf8');
const app = await readFile(resolve(publicDir, 'app.js'), 'utf8');
function between(text, start, end) {
  const first = text.indexOf(start),
    last = text.indexOf(end, first + start.length);
  if (first < 0 || last <= first) throw Error('Missing extraction boundary: ' + start);
  return text.slice(first, last);
}
const dockHandler = between(app, 'function setDockVisibility(', 'function projectCanvasKey(');
const dockBinding = between(
  app,
  "$$('[data-dock-toggle]').forEach",
  "$$('[data-workspace-mode]').forEach",
);
const stylesheetOrder = [
  ...index.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g),
].map((match) => match[1]);
if (!stylesheetOrder.includes('/foundry-pilot.css')) throw Error('Missing real pilot stylesheet');

const sceneScript = `
import { foundryFoundationsEnabled } from './foundry-foundations.js';
import {createNextWorkspace} from './next-workspace.js';
import {mountFoundryPilot,refinePilotIcons} from './foundry-pilot.js';
import {foundryPilotIcon} from './foundry-pilot-icons.js';
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const params=new URLSearchParams(location.search),pilot=foundryFoundationsEnabled();
const forbidden=[];
const deny=name=>(...args)=>{forbidden.push(name);throw Error('Fixture blocks '+name+'; no product transport is available.');};
window.fetch=deny('fetch');window.WebSocket=class{constructor(){deny('WebSocket')();}};
XMLHttpRequest.prototype.open=deny('XMLHttpRequest');navigator.sendBeacon=deny('sendBeacon');
const model={runtimeConnected:false,connected:false,listenerConnected:false,selection:null,session:{changeSet:{changes:[]}}};
const modelBefore=JSON.stringify(model);
const shell=$('#app-shell'),layers=$('#layers-dock'),inspector=$('#inspector-dock'),center=$('.center-workspace'),stage=$('#canvas-stage');
function renderIcons(root=document){for(const node of $$('[data-icon]',root)){const glyph=foundryPilotIcon(node.dataset.icon);if(glyph)node.outerHTML=glyph;}refinePilotIcons(root);}
const next=createNextWorkspace({command:deny('command'),navigate:deny('navigation'),renderIcons,state:()=>model,rerender:()=>{},openConnection:deny('connection')});
mountFoundryPilot();renderIcons();next.refineCanvasHeader(null);
$('#project-name').textContent='Synthetic Canvas layout fixture';
$('#preview-loading').hidden=true;$('#preview-fallback').hidden=true;
$('#product-preview').src='/fixture-preview';
$('#structure-search').placeholder='Find a layer';
$('#structure-search').setAttribute('aria-label','Find a layer');
$('#layer-total').textContent='Synthetic';
$('#structure-list').innerHTML=['Home','Navigation','Product introduction','Headline','Description','Create workspace','Supporting note',...Array.from({length:18},(_,i)=>'Synthetic layer '+(i+1))].map((label,i)=>'<div class="layer-row" role="treeitem" aria-selected="false" tabindex="-1"><span class="layer-label">'+label+'</span><span class="layer-meta">Fixture</span></div>').join('');
${dockHandler}
${dockBinding}
const originals={layers,inspector,center,stage,search:$('#structure-search')};
window.fixtureCanvas={
  setLayersVisible(visible){setDockVisibility('layers',visible);},
  setTheme(theme){document.documentElement.dataset.theme=theme;},
  snapshot(){
    const box=node=>{const b=node.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};
    const shown=getComputedStyle(layers).display!=='none';
    return {pilot,pilotMode:document.documentElement.getAttribute('data-foundry-pilot'),sharedSidebar:layers.classList.contains('foundry-sidebar'),width:innerWidth,height:innerHeight,theme:document.documentElement.dataset.theme,layersHidden:layers.hidden,layersShown:shown,layers:box(layers),center:box(center),stage:box(stage),inspector:box(inspector),workspace:box($('.workspace')),documentWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth,columns:getComputedStyle($('.workspace')).gridTemplateColumns,font:getComputedStyle(shell).fontFamily,forbidden:[...forbidden],modelUnchanged:JSON.stringify(model)===modelBefore,originalsIntact:Object.entries(originals).every(([name,node])=>node.isConnected&&(name!=='layers'||node===$('#layers-dock'))),togglePressed:$('[data-dock-toggle="layers"]').getAttribute('aria-pressed'),stylesheetOrder:[...document.querySelectorAll('link[rel="stylesheet"]')].map(link=>new URL(link.href).pathname)};
  }
};
await document.fonts.ready;
window.fixtureCanvas.ready=true;
`;
const diagnostics = `window.fixtureErrors=[];window.addEventListener('error',event=>window.fixtureErrors.push(event.error?.stack||event.message||'Resource error'),true);window.addEventListener('unhandledrejection',event=>window.fixtureErrors.push(String(event.reason?.stack||event.reason)));`;
const scene = index
  .replace('<head>', '<head><script>' + diagnostics + '</script>')
  .replace(
    /<script\b[^>]*src="\/app\.js"[^>]*><\/script>/,
    '<script type="module" src="/fixture-scene.js"></script>',
  );
if (scene.includes('src="/app.js"'))
  throw Error('Real application bootstrap must not run in fixture');

const harnessScript = `
import { foundryFoundationsEnabled } from '/foundry-foundations.js';
const frame=document.querySelector('#fixture-viewport'),params=new URLSearchParams(location.search),pilot=foundryFoundationsEnabled();
let running=false,notes=[];
const results=document.querySelector('#test-results'),details=document.querySelector('#test-details');
const check=(condition,label,checks)=>{if(!condition)throw Error(label);checks.push(label);};
const settle=async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));};
async function ready(){for(let i=0;i<100;i++){if(frame.contentWindow.fixtureCanvas?.ready)return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Canvas fixture did not initialize: '+JSON.stringify(frame.contentWindow.fixtureErrors));}
async function resize(width,height=844){frame.style.width=width+'px';frame.style.height=height+'px';await settle();await settle();return frame.contentWindow.fixtureCanvas.snapshot();}
function recordSnapshot(){const snapshot=frame.contentWindow.fixtureCanvas.snapshot();document.querySelector('#fixture-state').textContent=snapshot.width+'px · '+snapshot.theme+' · Layers '+(snapshot.layersShown?'visible':'hidden')+' · hidden preference '+snapshot.layersHidden;window.fixtureSnapshot=snapshot;return snapshot;}
function validate(snapshot,checks){
 const label=snapshot.theme+' '+snapshot.width+'px';
 check(snapshot.documentWidth===snapshot.width&&snapshot.scrollWidth<=snapshot.width+1&&snapshot.bodyScrollWidth<=snapshot.width+1,label+' has no document horizontal overflow',checks);
 check(snapshot.originalsIntact&&snapshot.modelUnchanged&&snapshot.forbidden.length===0,label+' retains original nodes and untouched synthetic session; no transport',checks);
 check(snapshot.stylesheetOrder.join('|')===${JSON.stringify(stylesheetOrder.join('|'))},label+' uses original stylesheet order',checks);
 if(!pilot)check(snapshot.pilotMode===null&&!snapshot.sharedSidebar,label+' gate off has no pilot mode attribute or shared sidebar class',checks);
 if(snapshot.width<=1050){check(!snapshot.layersShown&&snapshot.layers.width===0,label+' Layers yields without overlaying Canvas',checks);if(pilot||snapshot.width>680)check(snapshot.center.width>0&&snapshot.stage.width>0,label+' Canvas retains positive usable width',checks);}
 // Gate-off preserves baseline behavior, not the pilot's narrow usability fix:
 // legacy <=680 column 2 meets Next's zero-width second track. Report it.
 if(!pilot&&snapshot.width<=680&&(snapshot.center.width<=0||snapshot.stage.width<=0))notes.push(label+' baseline Canvas has a zero-width region. Gate-preservation passes do not establish baseline narrow usability.');
 if(!snapshot.layersHidden&&snapshot.width>1050){check(snapshot.layersShown,label+' shown Layers preference is visible',checks);check(snapshot.layers.right<=snapshot.center.x+1,label+' Layers does not overlap Canvas',checks);if(pilot)check(Math.abs(snapshot.layers.width-320)<1,label+' uses the expected shared sidebar width',checks);}
 if(snapshot.layersHidden)check(!snapshot.layersShown&&snapshot.togglePressed==='false',label+' explicit hidden state and original toggle ARIA stay authoritative',checks);
 if(snapshot.width<=720&&pilot)check(snapshot.inspector.y>=snapshot.center.bottom-1,label+' Inspector follows Canvas in the narrow stack',checks);
 check(frame.contentWindow.fixtureErrors.length===0,label+' has no runtime/resource errors',checks);
}
async function run(){
 if(running)return;running=true;document.querySelector('#fixture-rerun').disabled=true;results.dataset.result='running';results.textContent='Running geometry matrix';details.textContent='';
 const checks=[];notes=[];
 try{
  await ready();const api=frame.contentWindow.fixtureCanvas;
  for(const theme of ['light','dark']){
   api.setTheme(theme);api.setLayersVisible(true);
   for(const width of [1440,1100,1051,1050,1000,800,720,680,390]){const snapshot=await resize(width);validate(snapshot,checks);check(!snapshot.layersHidden&&snapshot.togglePressed==='true',theme+' '+width+'px compact CSS does not mutate shown preference',checks);}
   api.setLayersVisible(false);
   for(const width of [390,1050,1440])validate(await resize(width),checks);
   check(api.snapshot().layersHidden,theme+' hidden preference survives narrow-to-desktop resize',checks);
   api.setLayersVisible(true);const restored=await resize(1440);validate(restored,checks);check(restored.layersShown&&!restored.layersHidden&&restored.togglePressed==='true',theme+' original dock handler restores shown state on desktop',checks);
  }
  api.setTheme(params.get('theme')==='dark'?'dark':'light');api.setLayersVisible(true);await resize(Number(document.querySelector('#fixture-width').value));recordSnapshot();
  notes=[...new Set(notes)];results.dataset.result='pass';results.textContent='PASS: '+checks.length+' '+(pilot?'isolated checks':'gate-preservation checks')+(notes.length?' · baseline narrow limitations recorded':'');details.textContent=checks.join(String.fromCharCode(10))+(notes.length?'\\n\\nBaseline limitations (not acceptance):\\n'+notes.join(String.fromCharCode(10)):'');
 }catch(error){results.dataset.result='fail';results.textContent='FAIL: '+error.message;details.textContent=checks.join(String.fromCharCode(10))+'\\n'+error.stack;console.error(error);}
 finally{running=false;document.querySelector('#fixture-rerun').disabled=false;window.fixtureChecks={status:results.dataset.result,count:checks.length,checks,notes:[...new Set(notes)]};}
}
document.querySelector('#fixture-width').addEventListener('change',async event=>{await ready();await resize(Number(event.target.value));recordSnapshot();});
document.querySelector('#fixture-hide').addEventListener('click',async()=>{await ready();frame.contentWindow.fixtureCanvas.setLayersVisible(false);await settle();recordSnapshot();});
document.querySelector('#fixture-show').addEventListener('click',async()=>{await ready();frame.contentWindow.fixtureCanvas.setLayersVisible(true);await settle();recordSnapshot();});
document.querySelector('#fixture-theme').addEventListener('click',async()=>{await ready();const api=frame.contentWindow.fixtureCanvas;api.setTheme(api.snapshot().theme==='light'?'dark':'light');await settle();recordSnapshot();});
document.querySelector('#fixture-rerun').addEventListener('click',run);
frame.src='/scene?'+params.toString();await run();
`;
const harness = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Foundry Canvas layout — isolated fixture</title><style>
body{margin:0;background:#e9edf3;color:#17243d;font:12px/18px system-ui,sans-serif}header{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:12px}button,select,a{font:inherit;color:inherit}button,select{border:1px solid #93a0b5;border-radius:4px;background:white;padding:4px 8px}#fixture-scroll{overflow:auto;padding:0 12px 12px}iframe{display:block;border:0;width:1440px;height:844px;background:white}details{padding:0 12px 12px}pre{white-space:pre-wrap;max-height:35vh;overflow:auto;background:white;padding:12px}#test-results[data-result=fail]{color:#a21b1b}#test-results[data-result=pass]{color:#146036}
</style></head><body><header><strong>Canvas layout · synthetic fixture</strong><select id="fixture-width" aria-label="Synthetic viewport width">${[1440, 1100, 1051, 1050, 1000, 800, 720, 680, 390].map((width) => `<option value="${width}">${width}px</option>`).join('')}</select><button id="fixture-hide">Hide Layers (original handler)</button><button id="fixture-show">Show Layers (original handler)</button><button id="fixture-theme">Toggle UI theme</button><button id="fixture-rerun">Run matrix</button><a href="/?theme=light">Default design</a><a href="/?foundations=pilot&theme=light">Pilot alias</a><a href="/?foundations=off&theme=light">Previous design</a><span id="fixture-state"></span><strong id="test-results" data-result="running">Starting</strong></header><details><summary>Isolated assertions and failures</summary><pre id="test-details"></pre></details><div id="fixture-scroll"><iframe id="fixture-viewport" title="Isolated original Canvas layout"></iframe></div><script type="module">${harnessScript}</script></body></html>`;
if (process.argv.includes('--check')) {
  const servedScripts = [...scene.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)].map(
    (match) => match[1],
  );
  if (servedScripts.length !== 1 || !scene.includes('src="/fixture-scene.js"'))
    throw Error('Expected diagnostics and isolated scene entry point');
  for (const script of [...servedScripts, sceneScript, harnessScript]) {
    const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
      input: script,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      process.stderr.write(result.stderr || String(result.error));
      process.exit(result.status ?? 1);
    }
  }
  console.log('Canvas layout fixture extraction and both browser modules: PASS');
  process.exit(0);
}
// Bundle only this isolated entry point, never app.js. Reuse installed project
// dependencies without installing packages or writing into either checkout.
const installedApp = process.env.FOUNDRY_FIXTURE_TOOLING_ROOT || root;
const projectRequire = createRequire(resolve(root, 'package.json'));
const installedRequire = createRequire(resolve(installedApp, 'package.json'));
let esbuildPath;
try {
  esbuildPath = projectRequire.resolve('esbuild');
} catch {
  esbuildPath = installedRequire.resolve('esbuild');
}
const { build } = await import(pathToFileURL(esbuildPath).href);
const built = await build({
  stdin: {
    contents: sceneScript,
    resolveDir: publicDir,
    sourcefile: 'canvas-layout-fixture.js',
    loader: 'js',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  nodePaths: [
    resolve(root, 'apps/inspector/node_modules'),
    resolve(root, 'node_modules'),
    resolve(installedApp, 'apps/inspector/node_modules'),
    resolve(installedApp, 'node_modules'),
  ],
  logLevel: 'silent',
});
const bundledScene = built.outputFiles[0].contents;
if (process.argv.includes('--bundle-check')) {
  console.log(
    'Canvas layout fixture in-memory dependency bundle: PASS (' +
      bundledScene.byteLength +
      ' bytes)',
  );
  process.exit(0);
}
const types = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};
const port = Number(process.env.FOUNDRY_CANVAS_LAYOUT_FIXTURE_PORT ?? 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid fixture port');
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; frame-src 'self'; object-src 'none'; base-uri 'none'",
  );
  try {
    if (request.method !== 'GET') {
      response.writeHead(405).end();
      return;
    }
    if (url.pathname === '/fixture-scene.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(bundledScene);
      return;
    }
    if (url.pathname === '/' || url.pathname === '/scene') {
      response.setHeader('Content-Type', 'text/html');
      const html =
        url.pathname === '/'
          ? harness
          : scene.replace(
              '<html lang="en">',
              '<html lang="en" data-theme="' +
                (url.searchParams.get('theme') === 'dark' ? 'dark' : 'light') +
                '">',
            );
      response.end(html);
      return;
    }
    if (url.pathname === '/fixture-preview') {
      response.setHeader('Content-Type', 'text/html');
      response.end(
        '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:32px;background:#f2f1ef;color:#20231f;font:20px/1.5 system-ui}h1{font-size:48px;line-height:1.1;max-width:500px}</style></head><body><small>SYNTHETIC PREVIEW</small><h1>Room for the work that matters.</h1><p>No product adapter, session or source transport.</p></body></html>',
      );
      return;
    }
    const file = resolve(publicDir, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(publicDir + sep) || !types[extname(file)] || url.pathname === '/app.js') {
      response.writeHead(403).end();
      return;
    }
    response.setHeader('Content-Type', types[extname(file)]);
    let bytes;
    try {
      bytes = await readFile(file);
    } catch (error) {
      // Pilot Geist is in public/. Other original UI font bytes are build
      // assets, so reuse dist without changing stylesheet order or font family.
      if (!url.pathname.startsWith('/fonts/') || extname(file) !== '.woff2') throw error;
      const fontName = url.pathname.slice('/fonts/'.length);
      if (fontName.includes('/') || fontName.includes('..')) throw error;
      try {
        bytes = await readFile(resolve(root, 'apps/inspector/dist/fonts', fontName));
      } catch {
        bytes = await readFile(resolve(installedApp, 'apps/inspector/dist/fonts', fontName));
      }
    }
    response.end(bytes);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, '127.0.0.1', function () {
  console.log(
    'Isolated Canvas layout fixture: http://127.0.0.1:' +
      this.address().port +
      '/?foundations=pilot&theme=light',
  );
  console.log(
    'Actual source styles and shell, synthetic preview. No live session or source mutation.',
  );
});
