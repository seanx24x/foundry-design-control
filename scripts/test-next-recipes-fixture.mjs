// Isolated presentation harness. No Foundry session, adapter or source-write connection.
// Open http://127.0.0.1:4689 after starting this script. Stop with Ctrl-C.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'apps/inspector/dist');
const source = await readFile(resolve(root, 'apps/inspector/public/app.js'), 'utf8');
const index = await readFile(resolve(root, 'apps/inspector/public/index.html'), 'utf8');
const start = index.lastIndexOf(
  '<section',
  index.indexOf('class="mode-surface centered-mode visual-recipes-mode"'),
);
const end = index.indexOf(
  '<section',
  index.indexOf('class="mode-surface centered-mode decision-memory-mode"') - 40,
);
const markup = index.slice(start, end).replace(/\s+hidden\s*>/, '>');
const render = source.slice(
  source.indexOf('function renderVisualRecipes()'),
  source.indexOf('const DESIGN_SYSTEM_CATEGORY_LABELS'),
);
const script = `
import { createNextRecipes } from '/next-recipes.js';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const escapeText = s => String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const escapeAttribute = s => escapeText(s).replaceAll('"','&quot;');
const params = new URLSearchParams('ui=next');
let nextRecipes, visualRecipeId = '', visualRecipeSearch = '', bridgeConnected = true;
const calls = [];
const requestCommand = async (action, payload) => calls.push({action, payload});
const runDurableAction = requestCommand;
const toast = () => {}, renderIcons = () => {};
const recipe = {id:'fixture', name:'Quiet supporting treatment with an intentionally long recipe name', intent:'Keep supporting content legible without competing with the primary action.', sourceLabel:'Card / supporting content', conditions:{components:['Example/Card'],elementKinds:['div']}, values:[{category:'color'}, {category:'spacing'}, {category:'motion'}]};
const assessment = {matched:2,total:3,ambiguous:1,score:85,compatibility:'partial',mappings:[
{property:'color',category:'color',status:'mapped',currentValue:'#222222',resolvedValue:'var(--text-muted)',token:{name:'--text-muted'},detail:'Resolved to destination token'},
{property:'paddingInline',category:'spacing',status:'ambiguous',currentValue:'16px',sourceValue:'24px',detail:'Two equally close token candidates'},
{property:'animationTimeline',category:'motion',status:'unsupported',sourceValue:'scroll(block nearest)',detail:'No editable control on this target'}]};
const bridgeState = {selection:{label:'Supporting content',component:'Example/Card',kind:'div'},visualRecipes:{recipes:[recipe],assessment:{fixture:assessment},canSave:true}};
const visualRecipeTargetSuggestions = () => [{selector:'#card',label:'Supporting content',component:'Example/Card',score:100},{selector:'#other',label:'Another content block with a longer label',kind:'div',score:84}];
const duplicate = $('[data-studio-action="recipe-duplicate"]');
duplicate.addEventListener('click',()=>requestCommand('duplicate-visual-recipe', {recipeId:visualRecipeId}));
const form = $('.visual-recipe-capture-form');
const tests = [];
function check(condition, message) { if(!condition) throw new Error(message); tests.push(message); }
${render}
try {
renderVisualRecipes();
check($('.recipe-compatibility').textContent === '2 of 3 properties supported','Concrete mapping count');
check($$('.next-recipe-map-status').map(n=>n.textContent).join('|') === 'Destination token|Token choice needs review|Unsupported','Mapped, ambiguous and unsupported labels');
check($('[data-visual-recipe-target] code').textContent === 'Same component','Heuristic target labels');
$('#visual-recipe-name').value = 'Unsubmitted draft';
$('#visual-recipe-intent').value = 'Draft intent';
renderVisualRecipes();
check($('.visual-recipe-capture-form') === form && $('#visual-recipe-name').value === 'Unsubmitted draft' && $('#visual-recipe-intent').value === 'Draft intent','Capture nodes and drafts survive render');
$('[data-apply-visual-recipe]').click();
await Promise.resolve();
check(calls.at(-1)?.action === 'apply-visual-recipe','Existing acknowledged apply handler retained');
$('.next-recipe-details').open = true;
duplicate.click();
check(calls.at(-1)?.action === 'duplicate-visual-recipe','Original duplicate handler retained');
window.confirm = () => false;
const before = calls.length;
$('[data-remove-visual-recipe]').click();
check(calls.length === before,'Delete cancellation prevents original action');
window.confirm = () => true;
$('[data-remove-visual-recipe]').click();
check(calls.at(-1)?.action === 'remove-visual-recipe','Confirmed delete preserves original handler');
bridgeConnected = false;
renderVisualRecipes();
check($('[data-apply-visual-recipe]').disabled && $('#visual-recipe-save').disabled && duplicate.disabled && $('[data-remove-visual-recipe]').disabled && $('[data-visual-recipe-target]').disabled,'Offline actions disabled');
check($('#visual-recipe-name').value === 'Unsubmitted draft','Offline preserves draft');
bridgeConnected = true;
bridgeState.selection = null;
renderVisualRecipes();
check(!document.querySelector('[data-apply-visual-recipe]'),'No target cannot apply');
bridgeState.selection = {label:'Supporting content',component:'Example/Card',kind:'div'};
renderVisualRecipes();
document.querySelector('#test-results').textContent = 'PASS: ' + tests.length + ' isolated presentation assertions. Synthetic data; no source/session actions.';
} catch(error) { document.querySelector('#test-results').textContent = 'FAIL: ' + error.stack; }
`;
const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>Recipes isolated presentation test</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/next-workspace.css"><style>[data-next] .visual-recipes-mode:not([hidden]){height:calc(100vh - 32px);min-height:0}#test-results{height:32px;padding:8px;font:12px sans-serif}</style></head><body><div id="test-results">Running isolated assertions</div><div data-next data-mode="recipes">${markup}</div><script type="module">${script}</script></body></html>`;
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
  const file = resolve(publicDir, '.' + new URL(req.url, 'http://localhost').pathname);
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
  console.log('Isolated Recipes test fixture: http://127.0.0.1:4689'),
);
