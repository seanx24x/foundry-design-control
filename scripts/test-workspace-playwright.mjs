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
let sessionId = '';
const preview = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(
    `<!doctype html><html><body style="margin:0"><main><button data-foundry-component="Signup/PrimaryAction" data-story="Primary" style="width:100px;height:40px">Create workspace</button></main><script>
      const publish = () => parent.postMessage({ type: 'foundry:workspace-state', sessionId: '${sessionId}', payload: {
        context: { scope: 'instance', breakpoint: 'current', theme: 'current', state: 'current' },
        selection: { id: 'create-workspace', label: 'Create workspace', selector: 'button', source: { file: 'PrimaryAction.tsx', line: 1 }, component: 'Signup/PrimaryAction', width: 100, height: 40 },
        layers: [{ id: 'create-workspace', selector: 'button', label: 'Create workspace', kind: 'component', component: 'Signup/PrimaryAction', source: { file: 'PrimaryAction.tsx', line: 1 }, width: 100, height: 40, depth: 0, instrumented: true, hasChildren: false, selected: true }],
        controls: [{ index: 0, category: 'typography', property: 'fontFamily', label: 'Font family', kind: 'text', value: 'Inter, sans-serif' }, { index: 1, category: 'typography', property: 'fontSize', label: 'Font size', kind: 'number', value: '16px' }], typography: { selection: { family: 'Inter, sans-serif', primaryFamily: 'Inter', weight: '600', style: 'normal', size: '16px', lineHeight: '20px', letterSpacing: '0px', variationSettings: 'normal', text: 'Create workspace' }, projectFonts: [{ family: 'Inter', weights: ['400', '600'], styles: ['normal'], origins: ['active', 'project'] }, { family: 'Foundry JetBrains Mono', weights: ['400'], styles: ['normal'], origins: ['project'] }], savedStyles: [], diagnostics: [], metrics: { lineCount: 1, charactersPerLine: 16, faceStatus: 'loaded' }, usages: [{ family: 'Inter', count: 4, weights: ['400', '600'], sizes: ['12px', '16px'], examples: ['Create workspace'] }], preview: null, treatments: [{ id: 'tight', label: 'Tight', detail: 'Compact display rhythm', lineHeight: 1.1, letterSpacing: '-0.02em' }, { id: 'balanced', label: 'Balanced', detail: 'Default interface rhythm', lineHeight: 1.25, letterSpacing: '0em' }, { id: 'open', label: 'Open', detail: 'Relaxed reading rhythm', lineHeight: 1.5, letterSpacing: '0.01em' }], scale: { base: 16, ratio: 1.25, step: 1, fluid: false, value: '20px' }, strategies: [{ id: 'framework', label: 'Framework native' }, { id: 'stylesheet', label: 'Stylesheet' }], googleSelection: null, validation: { breakpoints: [{ id: 'current', label: 'Current' }], themes: [{ id: 'light', label: 'Light' }], states: [{ id: 'current', label: 'Current' }] }, capabilities: { localFontAccess: false } }, motions: [{ id: 'motion_primary', label: 'Primary action entrance', kind: 'web-animation', properties: ['opacity', 'transform'], timing: { duration: 480, delay: 0, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', iterations: 1, direction: 'normal', fill: 'both' }, keyframes: [{ index: 0, offset: 0, easing: 'ease-out', values: { opacity: '0', transform: 'translateY(12px)' } }, { index: 1, offset: 1, easing: 'linear', values: { opacity: '1', transform: 'translateY(0px)' } }], performance: { tier: 'compositor', label: 'Compositor', detail: 'Transform and opacity stay on the compositor.' }, active: true, playState: 'paused', currentTime: 160, playbackRate: 1, looping: false, reducedMotionProtected: true }], history: { canUndo: false, canRedo: false },
        responsive: { viewportWidth: innerWidth, viewportHeight: innerHeight, documentScrollWidth: document.documentElement.scrollWidth, documentScrollHeight: document.documentElement.scrollHeight, selection: { scrollWidth: 100, scrollHeight: 40, clientWidth: 100, clientHeight: 40 } }
      }}, 'http://127.0.0.1:${runtimePort}');
      addEventListener('message', (event) => {
        if (event.data?.type !== 'foundry:workspace-command') return;
        if (event.data.command === 'set-context') event.data.payload && publish();
        if (event.data.command === 'preview-component-variant') document.querySelector('button').dataset.story = event.data.payload.variantId.includes('quiet') ? 'Quiet' : 'Primary';
        if (event.data.command === 'preview-component-state') document.querySelector('button').dataset.foundryState = event.data.payload.stateId;
        if (event.data.command === 'preview-responsive-stress') { document.documentElement.dataset.foundryResponsiveStress = event.data.payload.mode; publish(); }
        if (event.data.command === 'motion-action') document.documentElement.dataset.lastMotionAction = event.data.payload.action;
        if (event.data.command === 'typography-action') document.documentElement.dataset.lastTypographyAction = event.data.payload.action;
      });
      addEventListener('load', () => setTimeout(publish, 50));
    </script></body></html>`,
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
  sessionId = session.changeSet.sessionId;
  await store.setDesignGraph(sessionId, {
    protocolVersion: '1.2.0',
    projectRoot: '/foundry/workspace-e2e',
    revision: 'workspace-e2e',
    tokens: [
      {
        id: 'token-color-signal',
        name: '--color-signal',
        value: '#3478f6',
        category: 'color',
        confidence: 'measured',
        evidence: ['CSS custom property'],
        cssVariable: '--color-signal',
        source: { file: 'style.css', line: 1 },
      },
    ],
    components: [
      {
        id: 'Signup/PrimaryAction',
        name: 'PrimaryAction',
        source: { file: 'PrimaryAction.tsx', line: 1 },
        instances: 1,
        variants: [
          {
            id: 'variant-primary',
            label: 'Primary',
            property: 'story',
            value: 'Primary',
            props: { story: 'Primary' },
            source: { file: 'PrimaryAction.stories.tsx', line: 1 },
          },
          {
            id: 'variant-quiet',
            label: 'Quiet',
            property: 'story',
            value: 'Quiet',
            props: { story: 'Quiet' },
            source: { file: 'PrimaryAction.stories.tsx', line: 2 },
          },
        ],
        evidence: ['Storybook story'],
      },
    ],
    breakpoints: [
      { id: 'mobile', label: 'Mobile', width: 390, height: 844 },
      { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
    ],
    themes: [
      { id: 'light', label: 'Light' },
      { id: 'dark', label: 'Dark' },
    ],
    states: [],
    motionPresets: [],
    tokenUsages: [
      {
        id: 'usage-color-signal',
        tokenId: 'token-color-signal',
        tokenName: '--color-signal',
        value: '#3478f6',
        category: 'color',
        kind: 'reference',
        property: 'background-color',
        componentId: 'Signup/PrimaryAction',
        source: { file: 'PrimaryAction.tsx', line: 1 },
        evidence: ['CSS variable reference'],
      },
    ],
    designSystemFindings: [
      {
        id: 'finding-color-signal',
        kind: 'component-drift',
        severity: 'warning',
        title: '#397bfa is close to --color-signal',
        detail: 'background-color uses a near-duplicate literal.',
        category: 'color',
        tokenIds: ['token-color-signal'],
        usageIds: ['usage-color-signal'],
        componentIds: ['Signup/PrimaryAction'],
        suggestedTokenId: 'token-color-signal',
        source: { file: 'PrimaryAction.tsx', line: 1 },
        evidence: ['Literal is close to a project token'],
      },
    ],
    indexedAt: new Date().toISOString(),
  });
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
  await store.createDesignBranch(sessionId, { name: 'Editorial scale' });
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
    category: 'typography',
    property: 'fontSize',
    before: '16px',
    after: '20px',
    unit: 'px',
    scope: 'instance',
    context: { breakpoint: 'current', theme: 'current', state: 'current' },
    confidence: 'instrumented',
    evidence: ['data-foundry-source', 'computed style'],
    status: 'draft',
  });
  await store.activateDesignBranch(sessionId);

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
  assert.equal(await page.locator('#change-count').textContent(), '1 change · Main direction');
  assert.match(
    (await page.locator('#selection-summary').textContent()) ?? '',
    /PrimaryAction\.tsx:1/,
  );
  assert.doesNotMatch(
    (await page.locator('#selection-summary').textContent()) ?? '',
    /\[object Object\]/,
  );
  const frame = page.locator('#preview-frame');
  assert.equal(await frame.getAttribute('data-viewport'), '1440 × 900');

  await page.locator('#workspace-menu-trigger').click();
  await page.getByRole('button', { name: /Component workshop/ }).click();
  await page.getByRole('heading', { name: 'Component workshop' }).waitFor();
  await page.getByRole('heading', { name: 'PrimaryAction' }).waitFor();
  assert.equal(await page.locator('.workshop-instance-row').count(), 1);
  assert.equal(await page.locator('.workshop-variant-row').count(), 2);
  assert.equal(await page.locator('[data-workshop-state]').count(), 8);

  const artifactDirectory = join(root, 'artifacts', 'e2e');
  await mkdir(artifactDirectory, { recursive: true });
  await page.screenshot({
    path: join(artifactDirectory, 'component-workshop-light.png'),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'component-workshop-dark.png'),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.locator('#workspace-menu-trigger').click();
  await page.getByRole('button', { name: /Design system/ }).click();
  await page.getByRole('heading', { name: 'Design System' }).waitFor();
  assert.match((await page.locator('#design-system-status').textContent()) ?? '', /1 token/);
  assert.equal(await page.locator('.design-token-row').count(), 1);
  assert.match((await page.locator('#design-system-detail').textContent()) ?? '', /--color-signal/);
  assert.match((await page.locator('#design-system-detail').textContent()) ?? '', /1 indexed/);
  assert.match(
    (await page.locator('#design-system-detail').textContent()) ?? '',
    /near-duplicate literal/,
  );
  await page.screenshot({
    path: join(artifactDirectory, 'design-system-light.png'),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'design-system-dark.png'),
    fullPage: true,
  });
  await page.locator('#workspace-menu-trigger').click();
  await page.getByRole('button', { name: /Responsive design lab/ }).click();
  await page.getByRole('heading', { name: 'Responsive design lab' }).waitFor();
  await page.locator('[data-responsive-frame="mobile"]').waitFor();
  assert.equal(await page.locator('[data-responsive-frame="mobile"]').getAttribute('width'), '390');
  assert.equal(
    await page.locator('[data-responsive-frame="desktop"]').getAttribute('width'),
    '1440',
  );
  await page.locator('#responsive-width').evaluate((element) => {
    element.value = '1024';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(
    await page.locator('[data-responsive-frame="custom"]').getAttribute('width'),
    '1024',
  );
  await page.locator('[data-responsive-stress="dynamic-type"]').click();
  assert.equal(await page.locator('#change-count').textContent(), '1 change · Main direction');
  await page.screenshot({
    path: join(artifactDirectory, 'responsive-design-lab-dark.png'),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'responsive-design-lab-light.png'),
    fullPage: true,
  });
  await page.locator('#workspace-menu-trigger').click();
  await page.getByRole('button', { name: /Motion studio/ }).click();
  await page.getByRole('heading', { name: 'Motion studio' }).waitFor();
  assert.equal(await page.locator('.motion-studio-row').count(), 1);
  assert.equal(await page.locator('.motion-studio-track').count(), 2);
  assert.match(
    (await page.locator('#motion-studio-properties').textContent()) ?? '',
    /Reduced motion covered/,
  );
  await page.locator('[data-studio-action="replay"]').click();
  assert.equal(await page.locator('#change-count').textContent(), '1 change · Main direction');
  await page.screenshot({
    path: join(artifactDirectory, 'motion-studio-light.png'),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'motion-studio-dark.png'),
    fullPage: true,
  });
  await page.locator('#workspace-menu-trigger').click();
  await page.getByRole('button', { name: /Typography studio/ }).click();
  await page.getByRole('heading', { name: 'Typography studio' }).waitFor();
  assert.equal(await page.locator('.typography-font-row').count(), 2);
  assert.equal(await page.locator('.typography-treatment-grid button').count(), 3);
  assert.match(
    (await page.locator('#typography-studio-properties').textContent()) ?? '',
    /Rendered type is stable/,
  );
  await page.locator('[data-treatment-id="balanced"]').click();
  await page.screenshot({
    path: join(artifactDirectory, 'typography-studio-dark.png'),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'typography-studio-light.png'),
    fullPage: true,
  });
  await page.locator('#workspace-menu-trigger').click();
  await page.getByRole('button', { name: /Design branches/ }).click();
  await page.getByRole('heading', { name: 'Design branches' }).waitFor();
  assert.equal(await page.locator('.design-branch-row').count(), 2);
  assert.equal(await page.locator('.design-branch-preview-card').count(), 2);
  assert.equal(await page.locator('.design-branch-decision-row').count(), 2);
  await page.locator('.design-branch-row').filter({ hasText: 'Editorial scale' }).click();
  await page.locator('#design-branch-status').getByText('Editorial scale').waitFor();
  assert.equal(await page.locator('#design-branch-status').textContent(), 'Editorial scale');
  assert.equal(await page.locator('#change-count').textContent(), '2 changes · Editorial scale');
  await page.screenshot({
    path: join(artifactDirectory, 'design-branches-light.png'),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'design-branches-dark.png'),
    fullPage: true,
  });
  await page.locator('.design-branch-row').filter({ hasText: 'Main direction' }).click();
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.locator('#workspace-menu-trigger').click();
  await page.getByRole('button', { name: /Review changes/ }).click();

  await page.getByRole('heading', { name: 'Review and apply' }).waitFor();
  assert.match((await page.locator('#review-count').textContent()) ?? '', /1 included/);
  assert.deepEqual(pageErrors, []);

  await page.screenshot({
    path: join(artifactDirectory, 'workspace-review-beta.12.png'),
    fullPage: true,
  });
  console.log(
    'Workspace Playwright flow passed: session, native viewport, Component Workshop, Design System, Responsive Lab, Motion Studio, Typography Studio, Design Branches, change summary, and review.',
  );
} finally {
  await browser?.close();
  await runtime.stop();
  await new Promise((resolveClose) => preview.close(() => resolveClose()));
}
