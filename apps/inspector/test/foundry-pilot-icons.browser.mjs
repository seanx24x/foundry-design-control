// Isolated DOM/font harness only: no Foundry session, adapter, or source action.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || '@playwright/test');
const publicRoot = new URL('../public/', import.meta.url);
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><title>Isolated pilot asset test</title>');
      return;
    }
    const file = new URL(`.${pathname}`, publicRoot);
    if (!file.href.startsWith(publicRoot.href)) throw new Error('Outside harness');
    response.setHeader(
      'Content-Type',
      pathname.endsWith('.js')
        ? 'text/javascript'
        : pathname.endsWith('.css')
          ? 'text/css'
          : pathname.endsWith('.woff2')
            ? 'font/woff2'
            : 'text/plain',
    );
    response.end(await readFile(file));
  } catch {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const external = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(base)) external.push(request.url());
  });
  await page.goto(base);
  const results = await page.evaluate(async () => {
    const api = await import('/foundry-pilot-icons.js');
    const svg = (name, id) =>
      `<svg id="${id}" data-foundry-icon="${name}" data-icon-family="heroicons" viewBox="0 0 24 24" class="retained" style="transform:rotate(90deg)"><path d="M0 0h1"/></svg>`;
    document.body.innerHTML = `<div id="outside">${svg('search', 'outside-icon')}</div><div id="app-shell"><header class="app-bar"><div class="app-identity">${svg('activity', 'brand')}</div></header><aside id="layers-dock"><div class="layer-row"><span class="layer-icon">${svg('box', 'layer')}</span><button>${svg('chevronDown', 'disclosure')}</button></div><button data-dock-toggle="layers" aria-pressed="true">${svg('panelLeft', 'dock')}</button></aside><aside id="inspector-dock"><div class="next-property">${svg('opacity', 'property')}</div>${svg('blur', 'blur')}</aside></div>`;
    document
      .querySelector('#app-shell')
      .insertAdjacentHTML(
        'beforeend',
        `<section data-mode-surface="components" class="component-workshop-mode">${svg('component', 'workshop')}</section><section data-mode-surface="delivery" class="component-workshop-mode">${svg('component', 'other-mode')}</section>`,
      );
    const original = new Map(
      [...document.querySelectorAll('svg')].map((node) => [node.id, node.outerHTML]),
    );
    const checks = [];
    const check = (name, passed) => {
      if (!passed) throw new Error(name);
      checks.push(name);
    };
    check('Inactive is a no-op', api.refineFoundryPilotIcons(document).changed === 0);
    api.refineFoundryPilotIcons(document, { active: true });
    check(
      'Workshop uses approved component artwork',
      document.querySelector('#workshop').dataset.iconFamily === 'lucide',
    );
    check(
      'Other migrated workspaces also use approved component artwork',
      document.querySelector('#other-mode').dataset.iconFamily === 'lucide',
    );
    check(
      'Out-of-scope artwork held',
      document.querySelector('#outside-icon').outerHTML === original.get('outside-icon'),
    );
    check(
      'Brand artwork held',
      document.querySelector('#brand').outerHTML === original.get('brand'),
    );
    check(
      'Plain layer uses square',
      document.querySelector('#layer').dataset.iconName === 'square',
    );
    check(
      'Disclosure stays chevron',
      document.querySelector('#disclosure').dataset.iconName === 'chevron-down',
    );
    check(
      'Source names and transforms retained',
      document.querySelector('#layer').dataset.foundryIcon === 'box' &&
        document.querySelector('#layer').style.transform === 'rotate(90deg)',
    );
    check(
      'Opacity retains its solid half',
      document.querySelector('#property path[fill="currentColor"][stroke="none"]') !== null,
    );
    check(
      'Label-only Blur hidden',
      getComputedStyle(document.querySelector('#blur')).display === 'none',
    );
    check(
      'Visible Layers action uses close',
      document.querySelector('#dock').dataset.iconName === 'panel-left-close',
    );
    document.querySelector('[data-dock-toggle]').setAttribute('aria-pressed', 'false');
    api.refineFoundryPilotIcons(document, { active: true });
    check(
      'Hidden Layers action updates to open',
      document.querySelector('#dock').dataset.iconName === 'panel-left-open',
    );
    api.refineFoundryPilotIcons(document, { active: false });
    check(
      'Every original SVG restored exactly',
      [...document.querySelectorAll('svg')].every(
        (node) => node.outerHTML === original.get(node.id),
      ),
    );
    api.refineFoundryPilotIcons(document, { active: true });
    document.querySelector('#layer').style.color = 'red';
    api.refineFoundryPilotIcons(document, { active: false });
    check(
      'Restoration preserves another owner’s new styles',
      document.querySelector('#layer').style.color === 'red',
    );
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/foundry-pilot-fonts.css';
    const loaded = new Promise((resolve, reject) => {
      link.onload = resolve;
      link.onerror = reject;
    });
    document.head.append(link);
    await loaded;
    const fonts = await document.fonts.load('400 12px "Foundry Geist"', 'Foundry 0123456789');
    check('Vendored Geist font loads', fonts.length === 1 && fonts[0].status === 'loaded');
    return checks;
  });
  assert.deepEqual(external, []);
  console.log(JSON.stringify({ checks: results, externalRequests: external }, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
