import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { FoundryRuntime, SessionStore } from '../packages/runtime/dist/index.js';

const root = resolve(import.meta.dirname, '..');
const runtimePort = 47_000 + Math.floor(Math.random() * 500);
const previewPort = runtimePort + 500;
const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-workspace-e2e-')));
const runtime = new FoundryRuntime({ port: runtimePort, store });
const preview = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(
    '<!doctype html><html><body style="margin:0"><main><button style="width:100px;height:40px">Create workspace</button></main></body></html>',
  );
});
let browser;

try {
  await runtime.start();
  await new Promise((resolveStart, reject) => {
    preview.once('error', reject);
    preview.listen(previewPort, '127.0.0.1', resolveStart);
  });
  const session = await store.create({
    projectRoot: '/foundry/workspace-e2e',
    revision: 'workspace-e2e',
    platform: 'web',
    targetUrl: `http://127.0.0.1:${previewPort}`,
    targetName: 'Workspace fixture',
    viewport: { width: 1440, height: 900 },
    theme: 'light',
    breakpoint: 'current',
    state: 'current',
  });
  const sessionId = session.changeSet.sessionId;
  await store.addChange(sessionId, {
    target: {
      id: 'create-workspace',
      platform: 'web',
      semanticRole: 'button',
      label: 'Create workspace',
      componentPath: [],
      source: { file: 'index.html', line: 1 },
      geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
      locator: { selector: 'button' },
      confidence: 'instrumented',
      evidence: ['data-foundry-source', 'live geometry'],
    },
    category: 'effect',
    property: 'borderRadius',
    before: '4px',
    after: '12px',
    unit: 'px',
    scope: 'instance',
    context: { breakpoint: 'current', theme: 'current', state: 'current' },
    confidence: 'instrumented',
    evidence: ['data-foundry-source', 'computed style'],
    status: 'approved',
  });

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1728, height: 1117 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const url = new URL(`http://127.0.0.1:${runtimePort}`);
  url.searchParams.set('session', sessionId);
  url.searchParams.set('token', session.token);
  url.searchParams.set('preview', `http://127.0.0.1:${previewPort}`);
  await page.goto(url.href, { waitUntil: 'networkidle' });

  await page.locator('#layers-dock').waitFor();
  await page.locator('#inspector-dock').waitFor();
  await page.locator('#change-summary').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#change-count').textContent(), '1 change recorded');
  const frame = page.locator('#preview-frame');
  assert.equal(await frame.getAttribute('data-viewport'), '1440 × 900');

  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('heading', { name: 'Review and apply' }).waitFor();
  assert.match((await page.locator('#review-count').textContent()) ?? '', /1 included/);
  assert.deepEqual(pageErrors, []);

  const artifactDirectory = join(root, 'artifacts', 'e2e');
  await mkdir(artifactDirectory, { recursive: true });
  await page.screenshot({
    path: join(artifactDirectory, 'workspace-review-beta.12.png'),
    fullPage: true,
  });
  console.log(
    'Workspace Playwright flow passed: session, native viewport, change summary, and review.',
  );
} finally {
  await browser?.close();
  await runtime.stop();
  await new Promise((resolveClose) => preview.close(() => resolveClose()));
}
