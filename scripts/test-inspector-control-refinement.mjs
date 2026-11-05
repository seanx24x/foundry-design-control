// Actual Inspector renderer, stylesheet order and shared select handlers.
// Synthetic in-memory edit acknowledgements only: no runtime, agent or source writes.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'apps/inspector/dist');
const source = await readFile(resolve(root, 'apps/inspector/public/app.js'), 'utf8');
const index = await readFile(resolve(publicDir, 'index.html'), 'utf8');
function between(start, end) {
  const first = source.indexOf(start),
    last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Missing actual application boundary: ${start}`);
  return source.slice(first, last);
}
const selectFunctions = between('function iconSvg(', 'function escapeText(');
const selectKeys =
  between(
    "document.addEventListener('keydown', (event) => {\n  if (event.isComposing",
    '  const activeTab =',
  ) + '\n});';
const renderInspector =
  between('function renderInspector()', "  const summary = $('#selection-summary');") + '\n}';
const script = `
import { createNextWorkspace } from './next-workspace.js';
import { mountFoundryPilot, refinePilotIcons } from './foundry-pilot.js';
import { NEXT_ICONS as ICONS, NEXT_ICON_SCOPE, refineNextIcons } from './next-icons.js';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const params=new URLSearchParams(location.search); params.set('ui','next');
let selectId=0, openCustomSelect=null, ignoreSelectScrollUntil=0;
let inspectorRenderDeferred=false, workshopRenderDeferred=false, inspectorRenderedSelectionId=null;
const renderComponentWorkshop=()=>{};
const escapeText=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
${selectFunctions}
${selectKeys}
document.addEventListener('pointerdown',event=>{if(openCustomSelect&&!event.composedPath().includes(openCustomSelect.portal)&&!event.composedPath().includes(openCustomSelect.trigger))closeCustomSelect({restoreFocus:false});});
window.addEventListener('resize',()=>closeCustomSelect({restoreFocus:false}));
document.documentElement.dataset.theme=params.get('theme')||'dark';
const controls=[
 {property:'width',label:'Width',kind:'number',value:224,unit:'px',min:0,max:2000},
 {property:'height',label:'Height',kind:'number',value:160,unit:'px',min:0,max:2000},
 {property:'objectFit',label:'Fit',kind:'select',value:'cover',options:['cover','contain','fill','none','scale-down']},
 {property:'objectPosition',label:'Object position',kind:'text',value:'50% 50%'},
 {property:'backgroundImage',label:'Gradient',kind:'text',value:'none'},
 {property:'fontSize',label:'Font size',kind:'number',value:12,unit:'px',min:8,max:200},
 {property:'opacity',label:'Opacity',kind:'number',value:1,min:0,max:1},
 {property:'textContent',label:'Text',kind:'text',value:'A quieter way to create.'},
];
const model={connected:true,runtimeConnected:true,direction:{id:'main'},selection:{id:'fixture-image',label:'Hero image',kind:'img',tagName:'IMG',count:1,width:224,height:160,confidence:'source-mapped',source:'Synthetic fixture / Hero image'},nextControls:controls,nextInspectorRevision:0,nextVariants:{variants:[{id:'paper',name:'Paper',supported:true,current:true},{id:'accent',name:'Accent',supported:true},{id:'ink',name:'Ink',supported:true},{id:'blocked',name:'Unavailable style',supported:false,reason:'Fixture has no mapped source.'}]}};
let bridgeState=model, failed=false, calls=[], ledger=[];
const original=new Map(controls.map(c=>[c.property,c.value]));
const command=async(name,payload)=>{
 calls.push({name,payload});
 if(failed&&payload?.action==='preview')throw Error('Preview unavailable. Your edit is retained.');
 if(name==='inspector-draft'){
  const control=controls.find(c=>c.property===payload.property);
  if(payload.action==='commit'){
   control.value=payload.value; model.nextInspectorRevision++;
   ledger=ledger.filter(c=>c.property!==payload.property);
   if(String(original.get(payload.property))!==String(payload.value))ledger.push({property:payload.property,before:original.get(payload.property),after:payload.value});
   return {recorded:true,value:payload.value,revision:model.nextInspectorRevision};
  }
  return {previewed:true};
 }
 if(name==='inspector-variant')return {recorded:payload.action==='commit',revision:++model.nextInspectorRevision};
 throw Error('Fixture blocks '+name);
};
let nextWorkspace;
${renderInspector}
nextWorkspace=createNextWorkspace({command,renderIcons,state:()=>model,rerender:renderInspector,navigate:mode=>{document.querySelector('#app-shell').dataset.mode=mode;},openConnection:()=>{}});
mountFoundryPilot(); renderIcons(); renderInspector();
$('#project-name').textContent='Isolated control fixture';
$('#live-status span').textContent='Control preview';
$('#live-status').setAttribute('aria-label','Isolated control preview. No connected project.');
for(const [id,label] of [['canvas-viewport','Desktop'],['canvas-theme','Light'],['canvas-state','Default']]) {
 const select=$('#'+id);select.innerHTML='<option>'+label+'</option>';syncCustomSelect(select);
}
nextWorkspace.refineCanvasHeader(model.selection);
$('#preview-loading').hidden=true;$('#preview-fallback').hidden=true;
$('#product-preview').srcdoc='<html><body style="margin:0;background:#f2f1ef;color:#202020;font:18px Arial;padding:70px"><small>Morrow · Synthetic UI fixture</small><h1 style="font-size:56px;letter-spacing:-3px;max-width:500px;margin-top:100px">A quieter way to create.</h1><p>No project, agent or source edits are connected.</p></body></html>';
window.fixture={calls,model,ledger:()=>ledger,refresh:renderInspector,fail:value=>failed=value,
 multi(){model.selection={...model.selection,id:'fixture-multi',count:2,targets:[{id:'a'},{id:'b'}]};renderInspector();},
 mountSelect(container){const host=document.createElement('div');host.innerHTML='<label>Authored value<select aria-label="Fixture authored value"><option selected disabled value="">Current authored values</option><option>Paper</option><optgroup label="Unavailable" disabled><option>Disabled group child</option></optgroup><option>Accent</option><option>Ink</option><option>A long authored token name that must wrap rather than overflow the menu</option></select></label>';container.append(host);renderIcons(host);return host;},
 modal(){const dialog=document.createElement('dialog');document.body.append(dialog);this.mountSelect(dialog);dialog.showModal();},
 edge(){const host=this.mountSelect(document.body);host.style.cssText='position:fixed;right:8px;bottom:8px;width:200px;z-index:500';return host;}
};
`;
const bundle = await build({
  stdin: {
    contents: script,
    resolveDir: resolve(root, 'apps/inspector/public'),
    sourcefile: 'inspector-controls-fixture.js',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  logLevel: 'silent',
});
const html = index
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
  .replace('</body>', '<script type="module" src="/control-fixture.js"></script></body>');
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (request.method !== 'GET') {
    response.writeHead(405).end();
    return;
  }
  if (url.pathname === '/') {
    response.setHeader('Content-Type', 'text/html');
    response.end(html);
    return;
  }
  if (url.pathname === '/control-fixture.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(bundle.outputFiles[0].contents);
    return;
  }
  const path = resolve(publicDir, '.' + decodeURIComponent(url.pathname));
  if (!path.startsWith(publicDir + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    response.setHeader(
      'Content-Type',
      {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.woff2': 'font/woff2',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
      }[extname(path)] ?? 'application/octet-stream',
    );
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolveListen) =>
  server.listen(Number(process.env.FOUNDRY_CONTROL_FIXTURE_PORT ?? 0), '127.0.0.1', resolveListen),
);
const origin = `http://127.0.0.1:${server.address().port}`;
if (process.argv.includes('--serve')) {
  console.log(`Isolated Inspector control preview: ${origin}/?theme=dark`);
} else {
  const output = resolve(root, 'artifacts/inspector-controls');
  await mkdir(output, { recursive: true });
  const report = {
    kind: 'isolated-ui-fixture',
    sourceWrites: false,
    agentConnected: false,
    checks: [],
    errors: [],
    views: [],
  };
  const browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb'] });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
      deviceScaleFactor: 2,
    });
    page.on('pageerror', (e) => report.errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') report.errors.push(m.text());
    });
    const property = (p) => page.locator('[data-property="' + p + '"]');
    const field = (p) => page.locator('[data-next-field="' + p + '"]');
    const positionCss = () =>
      page.getByRole('textbox', { name: 'Object position CSS', exact: true });
    const openPosition = async () => {
      await page.getByRole('button', { name: 'Edit object position', exact: true }).click();
      const details = page.locator('.next-position-css');
      if (!(await details.getAttribute('open'))) {
        if (!(await positionCss().isVisible())) await details.locator('summary').click();
      }
    };
    const savePosition = async (value) => {
      await openPosition();
      await positionCss().fill(value);
      await page.getByRole('button', { name: 'Use position', exact: true }).click();
    };
    const openSection = async (name) => {
      const b = page.locator('[data-section="' + name + '"]');
      if ((await b.getAttribute('aria-expanded')) !== 'true') await b.click();
    };
    const open = async (theme, width) => {
      await page.setViewportSize({ width, height: width === 720 ? 500 : width < 721 ? 844 : 1000 });
      await page.goto(origin + '/?theme=' + theme, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.fixture);
      await page.evaluate(() => document.fonts.ready);
    };
    for (const theme of process.env.FOUNDRY_CONTROL_INTERACTION_ONLY ? [] : ['light', 'dark'])
      for (const width of [1440, 1024, 720, 390, 320]) {
        await open(theme, width);
        const shellMenu = await page.locator('#workspace-menu-trigger').boundingBox();
        assert.ok(
          shellMenu.x + shellMenu.width <= width,
          'Workspace menu remains within the viewport',
        );
        await expect(property('objectPosition')).toContainText('X 50%');
        assert.equal(
          await page
            .locator('.zoom-controls .foundry-select-value')
            .evaluate((node) => node.scrollWidth > node.clientWidth),
          false,
        );
        await expect(property('objectPosition')).toHaveClass(/next-full/);
        assert.equal(
          await property('objectPosition')
            .locator('.next-position-trigger > span:first-child')
            .evaluate((n) => n.scrollWidth > n.clientWidth),
          false,
        );
        assert.equal(
          await property('objectPosition')
            .locator('.next-position-trigger')
            .evaluate((n) => n.scrollWidth > n.clientWidth),
          false,
        );
        assert.equal(
          await page.locator('#inspector-sections select:not([data-foundry-select])').count(),
          0,
        );
        const fit = property('objectFit').getByRole('combobox');
        await fit.focus();
        await page.keyboard.press('ArrowDown');
        await expect(page.getByRole('listbox')).toBeVisible();
        const menuBounds = await page.getByRole('listbox').boundingBox();
        const fieldBounds = await property('objectFit').locator('.next-field').boundingBox();
        assert.ok(
          Math.abs(menuBounds.width - fieldBounds.width) < 1,
          JSON.stringify({
            width,
            menuBounds,
            fieldBounds,
            parents: await property('objectFit').evaluate((node) => {
              const rows = [];
              for (let n = node; n; n = n.parentElement) {
                const s = getComputedStyle(n);
                rows.push({
                  tag: n.tagName,
                  id: n.id,
                  cls: n.className,
                  width: n.getBoundingClientRect().width,
                  min: s.minWidth,
                  display: s.display,
                  grid: s.gridTemplateColumns,
                });
              }
              return rows;
            }),
          }),
        );
        assert.ok(Math.abs(menuBounds.x - fieldBounds.x) < 1);
        await page.keyboard.press('End');
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect(fit).toBeFocused();
        await page.getByRole('button', { name: 'Restore Fit', exact: true }).click();
        await expect(field('objectFit')).toHaveValue('cover');
        await savePosition('25% 75%');
        await openPosition();
        await page
          .locator('.next-position-editor')
          .screenshot({ path: resolve(output, theme + '-' + width + '-position.png') });
        const popup = await page.locator('.next-position-editor').boundingBox();
        assert.ok(popup.x >= 8 && popup.x + popup.width <= width - 8);
        assert.equal(
          await page
            .locator('.next-position-editor')
            .evaluate((node) => node.scrollWidth > node.clientWidth),
          false,
        );
        await page.keyboard.press('Escape');
        await expect(
          property('objectPosition').getByRole('button', {
            name: 'Restore Object position',
            exact: true,
          }),
        ).toBeVisible();
        assert.equal(await page.locator('#inspector-sections .next-change').count(), 0);
        assert.equal(await page.locator('#inspector-sections .next-field-status').count(), 0);
        await openSection('Appearance');
        await openSection('Typography');
        for (const propertyName of ['fontSize', 'opacity']) {
          const singleton = await property(propertyName).boundingBox();
          const row = await property(propertyName).locator('..').boundingBox();
          assert.ok(Math.abs(singleton.width - row.width) < 1, `${propertyName} fills its row`);
        }
        const widthBounds = await property('width').boundingBox();
        const heightBounds = await property('height').boundingBox();
        assert.ok(Math.abs(widthBounds.y - heightBounds.y) < 1);
        assert.ok(widthBounds.width < fieldBounds.width * 0.6);
        await page.locator('[data-gradient-picker]').click();
        await expect(page.locator('.next-gradient-editor')).toBeVisible();
        await page.getByRole('button', { name: 'Create linear gradient', exact: true }).click();
        await page.getByRole('button', { name: 'Use gradient', exact: true }).click();
        await expect(
          property('backgroundImage').getByRole('button', {
            name: 'Restore Gradient',
            exact: true,
          }),
        ).toBeVisible();
        assert.equal(
          await property('backgroundImage')
            .innerText()
            .then((t) => t.includes('linear-gradient(')),
          false,
        );
        await page
          .locator('#inspector-dock')
          .screenshot({ path: resolve(output, theme + '-' + width + '-edited.png') });
        assert.equal(
          await page.locator('#inspector-dock').evaluate((n) => n.scrollWidth > n.clientWidth),
          false,
        );
        await openSection('Content');
        const variants = page.getByRole('combobox', { name: 'Authored variant', exact: true });
        await variants.click();
        await page.evaluate(() => window.fixture.refresh());
        await expect(page.getByRole('listbox')).toBeVisible();
        const menu = await page.getByRole('listbox').boundingBox();
        assert.ok(menu.x >= 7 && menu.y >= 7 && menu.x + menu.width <= width - 7);
        await page.screenshot({ path: resolve(output, theme + '-' + width + '-menu.png') });
        await page.keyboard.press('Escape');
        await expect(variants).toBeFocused();
        report.views.push({ theme, width });
      }
    if (report.views.length === 10)
      report.checks.push(
        'Light/dark Inspector at 1440, 1024, 720, 390 and 320px: full compound fields, shared selects, changed/gradient rows, menu refresh stability, keyboard focus and no horizontal overflow; 720x500 is 200%-equivalent CSS reflow',
      );
    await open('dark', 1440);
    await openPosition();
    const positionDialog = page.locator('.next-position-editor');
    const axis = (name) =>
      page.getByRole('textbox', { name: 'Object position ' + name, exact: true });
    const usePosition = () => page.getByRole('button', { name: 'Use position', exact: true });
    await page.getByRole('button', { name: 'Position top right', exact: true }).click();
    await expect(axis('X')).toHaveValue('100');
    await expect(axis('Y')).toHaveValue('0');
    assert.equal(await page.evaluate(() => window.fixture.ledger().length), 0);
    await page.getByRole('button', { name: 'Position center center', exact: true }).click();
    const pad = page.getByRole('group', { name: 'Object position pad', exact: true });
    await pad.focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(axis('X')).toHaveValue('60');
    await page.keyboard.press('Home');
    await expect(axis('X')).toHaveValue('50');
    const plane = await page.locator('.next-position-plane').boundingBox();
    const start = { x: plane.x + plane.width / 2 + 3, y: plane.y + plane.height / 2 + 2 };
    assert.equal(
      await page.evaluate((point) => document.elementFromPoint(point.x, point.y)?.className, start),
      'next-position-point',
      JSON.stringify(
        await page.evaluate((point) => {
          const marker = document.querySelector('.next-position-point'),
            s = getComputedStyle(marker);
          return {
            node: document.elementFromPoint(point.x, point.y)?.outerHTML,
            html: marker.outerHTML,
            style: { left: s.left, top: s.top, transition: s.transition, position: s.position },
            marker: marker.getBoundingClientRect().toJSON(),
            plane: document.querySelector('.next-position-plane')?.getBoundingClientRect().toJSON(),
            point,
          };
        }, start),
      ),
    );
    await pad.evaluate((node) => {
      window.positionEvents = [];
      for (const type of [
        'pointerdown',
        'pointermove',
        'gotpointercapture',
        'lostpointercapture',
        'pointercancel',
      ])
        node.addEventListener(type, (e) =>
          window.positionEvents.push({
            type,
            target: e.target.className,
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
          }),
        );
    });
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + plane.width * 0.2, start.y - plane.height * 0.1, { steps: 4 });
    assert.equal(
      await axis('X').inputValue(),
      '70',
      JSON.stringify(await page.evaluate(() => window.positionEvents)),
    );
    await expect(axis('Y')).toHaveValue('40');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(positionDialog).toBeVisible();
    await expect(axis('X')).toHaveValue('50');
    await expect(axis('Y')).toHaveValue('50');
    // Lost pointer capture restores the gesture's starting draft, not a new edit.
    await pad.evaluate((node) =>
      node.addEventListener('pointerdown', (e) => (node.dataset.testPointer = e.pointerId)),
    );
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + plane.width * 0.1, start.y + plane.height * 0.1, { steps: 3 });
    await pad.evaluate((node) => node.releasePointerCapture(Number(node.dataset.testPointer)));
    await page.mouse.up();
    await expect(axis('X')).toHaveValue('50');
    assert.equal(await page.evaluate(() => window.fixture.ledger().length), 0);
    await page.getByRole('button', { name: 'Position bottom left', exact: true }).click();
    await expect(usePosition()).toBeEnabled();
    await usePosition().click();
    assert.deepEqual(await page.evaluate(() => window.fixture.ledger().map((item) => item.after)), [
      '0% 100%',
    ]);
    await expect(
      page.getByRole('button', { name: 'Edit object position', exact: true }),
    ).toBeFocused();
    // Opening an advanced/native value neither converts it nor sends a preview.
    await page.evaluate(() => {
      const f = window.fixture;
      f.model.selection.id = 'advanced-position';
      f.model.nextControls.find((c) => c.property === 'objectPosition').value =
        'right 12px bottom 8px';
      f.refresh();
    });
    const callsBefore = await page.evaluate(() => window.fixture.calls.length);
    await openPosition();
    await expect(positionCss()).toHaveValue('right 12px bottom 8px');
    await expect(axis('X')).toBeDisabled();
    await expect(usePosition()).toBeDisabled();
    assert.equal(await page.evaluate(() => window.fixture.calls.length), callsBefore);
    await positionCss().fill('banana');
    await expect(page.locator('#next-position-status')).toContainText('valid CSS');
    await expect(usePosition()).toBeDisabled();
    await page.keyboard.press('Escape');
    await open('dark', 390);
    await page.evaluate(() => {
      const f = window.fixture;
      f.model.nextControls.find((c) => c.property === 'objectPosition').mixed = true;
      f.multi();
    });
    await openPosition();
    await expect(axis('X')).toBeDisabled();
    await expect(positionCss()).toHaveValue('');
    await expect(page.locator('#next-position-status')).toContainText('Mixed positions');
    await page.keyboard.press('Escape');
    report.checks.push(
      'Spatial position: nine-point presets, keyboard nudges, direct drag with grab offset, Escape/lost capture restore, draft-only gestures, one accepted change, exact advanced CSS, invalid/mixed states and focus restoration',
    );
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open('light', 390);
    await openPosition();
    await axis('X').fill('12');
    await axis('X').pressSequentially('.345678');
    await expect(axis('X')).toHaveValue('12.345678');
    await expect(positionCss()).toHaveValue('12.345678% 50%');
    await expect(usePosition()).toBeEnabled();
    await axis('X').fill('50');
    const normalPlane = await page.locator('.next-position-plane').boundingBox();
    const normalStart = {
      x: normalPlane.x + normalPlane.width / 2,
      y: normalPlane.y + normalPlane.height / 2,
    };
    await page.mouse.move(normalStart.x, normalStart.y);
    await page.mouse.down();
    await page.keyboard.down('Shift');
    await page.mouse.move(
      normalStart.x + normalPlane.width * 0.2,
      normalStart.y + normalPlane.height * 0.1,
      { steps: 3 },
    );
    await expect(axis('X')).toHaveValue('70');
    await expect(axis('Y')).toHaveValue('50');
    await page.keyboard.up('Shift');
    await page.mouse.up();
    assert.equal(await page.evaluate(() => window.fixture.ledger().length), 0);
    await usePosition().click();
    assert.equal(await page.evaluate(() => window.fixture.ledger()[0].after), '70% 50%');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    report.checks.push(
      'Normal-motion compact spatial editor: precise typed axes, synchronous drag, Shift axis lock and explicit acceptance; reduced-motion gesture checks run separately',
    );
    await open('dark', 1440);
    await openSection('Content');
    const variants = page.getByRole('combobox', { name: 'Authored variant', exact: true });
    await variants.click();
    await page.getByRole('option', { name: 'Accent', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Add to Review', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(
      page.getByRole('combobox', { name: 'Authored variant', exact: true }),
    ).toBeFocused();
    await openPosition();
    await positionCss().fill('20% 80%');
    await positionCss().press('Escape');
    await expect(property('objectPosition')).toContainText('X 50%');
    await page.evaluate(() => window.fixture.fail(true));
    await openPosition();
    await positionCss().fill('25% 75%');
    await expect(page.locator('#next-position-status')).toContainText('Preview unavailable');
    await expect(positionCss()).toHaveValue('25% 75%');
    await expect(page.getByRole('button', { name: 'Use position', exact: true })).toBeDisabled();
    await page.evaluate(() => window.fixture.fail(false));
    await positionCss().press('Escape');
    await page.evaluate(() => window.fixture.fail(true));
    await property('objectFit').getByRole('combobox').click();
    await page.getByRole('option', { name: 'contain', exact: true }).click();
    await expect(property('objectFit').getByRole('combobox')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await page.evaluate(() => window.fixture.fail(false));
    await property('objectFit').getByRole('combobox').press('Escape');
    await expect(page.locator('#next-edit-error')).toBeHidden();
    await expect(field('objectFit')).toHaveValue('cover');
    report.checks.push(
      'Authored variant preview/cancel returns to visible chooser; text cancellation restores; failed preview retains entered value and visible error',
    );
    await open('dark', 390);
    await page.evaluate(() => window.fixture.edge());
    const edge = page.getByRole('combobox', { name: 'Fixture authored value', exact: true });
    await edge.click();
    const rect = await page.getByRole('listbox').boundingBox();
    assert.ok(
      rect.y >= 8 && rect.y + rect.height < 844 && rect.x >= 8 && rect.x + rect.width <= 382,
    );
    await expect(
      page.getByRole('option', { name: 'Disabled group child', exact: true }),
    ).toBeDisabled();
    await page.keyboard.press('End');
    await page.keyboard.press('Escape');
    await expect(edge).toBeFocused();
    await page.evaluate(() => {
      document
        .querySelector('body > div:has(select[aria-label="Fixture authored value"])')
        ?.remove();
      window.fixture.modal();
    });
    await page.getByRole('dialog').getByRole('combobox').click();
    assert.equal(
      await page.getByRole('listbox').evaluate((n) => !!n.closest('dialog[open]')),
      true,
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeVisible();
    report.checks.push(
      'Viewport-edge placement, wrapping option labels, disabled optgroup, initially disabled placeholder, and menus inside native modal top layer',
    );
    await open('dark', 1440);
    await page.evaluate(() => window.fixture.multi());
    await savePosition('25% 75%');
    await expect(property('objectPosition').getByRole('img', { name: /Use Undo/ })).toBeVisible();
    assert.equal(await property('objectPosition').locator('[data-reset]').count(), 0);
    report.checks.push(
      'Multi-selection retains Undo semantics rather than offering an unsafe one-value restore',
    );
    const craft = await page.evaluate(async () => {
      const { refineWorkspaceCraft } = await import('/workspace-craft.js');
      const host = document.createElement('section');
      host.dataset.next = 'true';
      host.innerHTML = `<div class="typography-property-fields"><label><span>Size</span><input data-typography-control="fontSize" value="12.125"></label></div>
        <div class="next-system-property-scroll"><section><p class="next-system-help" id="craft-evidence-note">Index coverage is not verification.</p><p class="next-system-help" role="alert">Save failed. Retry.</p><p class="next-system-help">Unavailable source mapping</p></section></div>
        <dl><div class="system-value-row"><dt>Authored</dt><dd>var(--paper)</dd></div></dl>
        <dialog class="next-color-picker"><p class="next-position-help" id="craft-position-help">Drag or type.</p><p role="status">Invalid draft</p></dialog>`;
      document.body.append(host);
      const input = host.querySelector('input'),
        owner = input.parentElement;
      let inputs = 0;
      input.addEventListener('input', () => inputs++);
      refineWorkspaceCraft(host);
      refineWorkspaceCraft(host);
      input.dispatchEvent(new Event('input'));
      const result = {
        retained: input.parentElement === owner && input.value === '12.125' && inputs === 1,
        singleton: owner.hasAttribute('data-craft-single'),
        singleDisclosure: host.querySelectorAll('.craft-context-help').length === 1,
        notesRetained:
          host.querySelector('.craft-context-help #craft-evidence-note')?.textContent ===
          'Index coverage is not verification.',
        alertVisible: !host.querySelector('[role="alert"]').closest('details'),
        blockerVisible: ![...host.querySelectorAll('p')]
          .find((p) => p.textContent === 'Unavailable source mapping')
          .closest('details'),
        readout: host.querySelector('.system-value-row').hasAttribute('data-craft-readout'),
        editor:
          host.querySelector('dialog').classList.contains('craft-editor') &&
          host.querySelectorAll('.craft-editor-help').length === 1,
        statusVisible: !host.querySelector('dialog [role="status"]').closest('details'),
      };
      host.remove();
      return result;
    });
    for (const [name, valid] of Object.entries(craft)) assert.equal(valid, true, name);
    report.checks.push(
      'Workspace field packing and readouts preserve native values/listeners; help is idempotent and retains visible errors, blockers and editor status',
    );
    assert.deepEqual(report.errors, []);
    report.passed = true;
  } catch (error) {
    await browser
      .contexts()[0]
      ?.pages()[0]
      ?.screenshot({ path: resolve(output, 'failure.png') });
    report.passed = false;
    report.failure = error.stack;
    process.exitCode = 1;
  } finally {
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify(report, null, 2));
}
