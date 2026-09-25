import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { captureDesignReference } from './capture-design-reference.mjs';

// Deliberately separate from the presenter's 4387/4390 recording session.
// This harness never builds the inspector, stops foreign processes, or edits
// the canonical fixture. --baseline-only captures a frozen built inspector.
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const runtimePort = Number(option('--runtime-port', '4487'));
const previewPort = Number(option('--preview-port', '4490'));
assert.ok(
  runtimePort !== previewPort &&
    ![4387, 4390].includes(runtimePort) &&
    ![4387, 4390].includes(previewPort),
  'Recording ports are protected.',
);
for (const port of [runtimePort, previewPort])
  assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
const runtimeUrl = `http://127.0.0.1:${runtimePort}`;
const previewUrl = `http://127.0.0.1:${previewPort}`;
process.env.FOUNDRY_TEST_RUNTIME_URL = runtimeUrl;
process.env.FOUNDRY_TEST_PREVIEW_URL = previewUrl;
if (!process.argv.includes('--mode')) process.argv.push('--mode', 'workspace');
const h = await import('./test-real-golden-path.mjs');
const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(option('--artifacts', join(root, 'artifacts/experience-slice')));
const baselineRoot = resolve(option('--baseline-root', join(artifacts, 'baseline-inspector')));
const baselineOnly = args.includes('--baseline-only');
const project = join(h.harnessRoot, 'morrow');
const isolatedHome = join(h.harnessRoot, 'home');
const report = {
  format: 'foundry.experience-slice',
  version: 1,
  status: 'running',
  baselineOnly,
  runtimePort,
  previewPort,
  startedAt: new Date().toISOString(),
  checks: [],
  errors: [],
  captures: [],
};
mkdirSync(artifacts, { recursive: true });
let page, mcp, claimPromise;
const frameLifecycle = [];
const abortedPolls = [];
const redact = (value) =>
  h
    .redact(value)
    .replace(/"(?:token|previewCapability)"\s*:\s*"[^"]*"/g, '"credential":"[redacted]"');
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const wait = h.waitFor;

async function check(name, action, continueAfterFailure = false) {
  try {
    const evidence = await action();
    report.checks.push({ name, status: 'passed', ...(evidence ? { evidence } : {}) });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, status: 'failed', error: redact(error.stack ?? error) });
    await page
      ?.screenshot({ path: join(artifacts, `${name.replace(/[^a-z0-9-]/gi, '-')}-failure.png`) })
      .catch(() => {});
    if (!continueAfterFailure) throw error;
    console.error(`FAIL ${name}: ${redact(error.message)}`);
  }
}

async function capture(name) {
  await page.screenshot({ path: join(artifacts, `${name}.png`) });
  await captureDesignReference(page, '#app-shell', name, artifacts);
  const reference = {
    name,
    viewport: page.viewportSize(),
    theme: await page.locator('html').getAttribute('data-theme'),
  };
  if (name.startsWith('canvas-')) {
    const frame = await page.locator('#product-preview').evaluate((element) => ({
      box: element.getBoundingClientRect().toJSON(),
      width: element.clientWidth,
      height: element.clientHeight,
    }));
    const native = await page
      .frameLocator('#product-preview')
      .locator('[data-foundry-id="password-reveal"]')
      .evaluate((element) => element.getBoundingClientRect().toJSON());
    const scaleX = frame.box.width / frame.width;
    const scaleY = frame.box.height / frame.height;
    reference.specimenTarget = {
      id: 'password-reveal',
      native,
      frame,
      screen: {
        x: frame.box.x + native.x * scaleX,
        y: frame.box.y + native.y * scaleY,
        width: native.width * scaleX,
        height: native.height * scaleY,
      },
    };
  }
  report.captures.push(reference);
}

function classifyNavigationCancellations() {
  for (const candidate of abortedPolls.splice(0)) {
    const event = frameLifecycle.find(
      (event) => event.frame === candidate.frame && Math.abs(event.at - candidate.at) <= 2000,
    );
    if (candidate.frame.isDetached() || event) {
      (report.cancelledNavigationRequests ??= []).push({
        route: candidate.route,
        method: candidate.method,
        error: 'net::ERR_ABORTED',
        evidence: candidate.frame.isDetached()
          ? 'Owned preview frame detached'
          : `Owned frame ${event.kind}`,
        lifecycleDeltaMs: event ? event.at - candidate.at : null,
      });
    } else report.errors.push(candidate.message);
  }
}

async function theme(name) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await page.locator('html').getAttribute('data-theme-preference')) === name) break;
    await page.locator('#workspace-menu-trigger').click();
    await page.locator('[data-theme-choice]').click();
  }
  assert.equal(await page.locator('html').getAttribute('data-theme-preference'), name);
  await page.evaluate(() => document.fonts.ready);
}

async function mode(name) {
  await page
    .locator(
      name === 'review' ? '#persistent-review' : `.workspace-rail [data-workspace-mode="${name}"]`,
    )
    .click();
  await page.locator(`[data-mode-surface="${name}"]`).waitFor({ state: 'visible' });
}

async function selectTarget(id) {
  await mode('canvas');
  const row = page.locator(`.layer-row[data-layer-selector*="${id}"]`).first();
  await row.click();
  await wait(
    async () => (await row.getAttribute('aria-selected')) === 'true',
    'exact layer selection',
  );
}

async function contextSnapshot() {
  return page.evaluate(() => ({
    target: document.querySelector('#selection-summary strong')?.textContent,
    viewport: document.querySelector('#canvas-viewport')?.value,
    theme: document.querySelector('#canvas-theme')?.value,
    state: document.querySelector('#canvas-state')?.value,
    scope: document.querySelector('[data-context="scope"]')?.value,
  }));
}

async function assertLayout() {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  const geometry = await page.evaluate(() => {
    const selectors = [
      '.topbar',
      '.workspace-rail',
      '#persistent-review',
      '#studio-nav-toggle',
      '.mode-surface:not([hidden])',
      '.mode-surface:not([hidden]) .mode-head',
      '.canvas-mode:not([hidden]) .canvas-context',
    ];
    return {
      width: innerWidth,
      mode: document.querySelector('#app-shell')?.dataset.mode,
      workspaceGrid: getComputedStyle(document.querySelector('.workspace')).gridTemplateColumns,
      center: document.querySelector('.center-workspace')?.getBoundingClientRect().toJSON(),
      documentOverflow: document.documentElement.scrollWidth - innerWidth,
      boxes: selectors
        .flatMap((selector) =>
          [...document.querySelectorAll(selector)].map((element) => ({
            selector,
            box: element.getBoundingClientRect().toJSON(),
            hiddenAncestor: element.closest('[hidden]')?.outerHTML.slice(0, 140),
            markup: element.outerHTML.slice(0, 200),
          })),
        )
        .filter(({ box }) => box.width > 0 && box.height > 0),
    };
  });
  assert.ok(geometry.documentOverflow <= 1, `document overflow: ${geometry.documentOverflow}`);
  for (const { selector, box } of geometry.boxes)
    assert.ok(
      box.x >= -1 && box.right <= geometry.width + 1,
      `${selector} outside horizontal viewport: ${JSON.stringify(geometry)}`,
    );
  return geometry;
}

async function assertDoubleText() {
  const originalStyles = await page.evaluateHandle(() => {
    const roots = [
      ...document.querySelectorAll('.app-bar,.workspace-rail,[data-mode-surface="review"]'),
    ];
    const elements = [
      ...new Set(roots.flatMap((root) => [root, ...root.querySelectorAll('*')])),
    ].filter((element) => {
      const rect = element.getBoundingClientRect();
      return (
        element instanceof HTMLElement &&
        element.tagName !== 'IFRAME' &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    // Snapshot every computed size first; never multiply inherited values twice.
    const snapshot = elements.map((element) => {
      const computed = getComputedStyle(element);
      return {
        element,
        original: element.getAttribute('style'),
        font: parseFloat(computed.fontSize),
        line: parseFloat(computed.lineHeight),
      };
    });
    for (const { element, font, line } of snapshot) {
      element.style.fontSize = `${font * 2}px`;
      if (Number.isFinite(line)) element.style.lineHeight = `${line * 2}px`;
    }
    return snapshot;
  });
  try {
    await assertLayout();
    await capture('review-1280-text-200');
    const clipping = await page.evaluate(() => {
      const buttons = [
        ...document.querySelectorAll(
          '.app-bar button,.workspace-rail button,[data-mode-surface="review"] button',
        ),
      ].flatMap((button) => {
        const box = button.getBoundingClientRect();
        if (!box.width || !box.height) return [];
        const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
        const issues = [];
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (!node.textContent.trim() || !(node.parentElement instanceof HTMLElement)) continue;
          if (getComputedStyle(node.parentElement).display === 'none') continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (
              rect.width &&
              rect.height &&
              (rect.left < box.left - 1 ||
                rect.right > box.right + 1 ||
                rect.top < box.top - 1 ||
                rect.bottom > box.bottom + 1)
            )
              issues.push({
                button: button.id || button.getAttribute('aria-label') || button.textContent.trim(),
                text: node.textContent.trim(),
                box: box.toJSON(),
                textBox: rect.toJSON(),
              });
          }
        }
        return issues;
      });
      const values = [...document.querySelectorAll('.change-values > *')].flatMap((element) => {
        const row = element.closest('.change-row').getBoundingClientRect();
        const box = element.getBoundingClientRect();
        if (!box.width || !box.height) return [];
        return box.left < row.left - 1 || box.right > row.right + 1
          ? [
              {
                text: element.textContent.trim() || element.value,
                box: box.toJSON(),
                row: row.toJSON(),
              },
            ]
          : [];
      });
      return [...buttons, ...values];
    });
    assert.deepEqual(
      clipping,
      [],
      'Text and values must fit their actionable or row bounds at 200%',
    );
  } finally {
    await originalStyles.evaluate((snapshot) => {
      for (const { element, original } of snapshot) {
        if (original === null) element.removeAttribute('style');
        else element.setAttribute('style', original);
      }
    });
    await originalStyles.dispose();
  }
}

try {
  await h.assertPortFree(runtimePort);
  await h.assertPortFree(previewPort);
  const tooling = h.installTooling();
  mkdirSync(project);
  mkdirSync(isolatedHome);
  for (const file of [
    'index.html',
    'style.css',
    'fonts',
    'server.mjs',
    'build.mjs',
    'smoke.test.mjs',
    'configure-foundry.mjs',
    'validate-source-annotations.mjs',
    'foundry.design.json',
    'package.json',
    'PrimaryAction.tsx',
    'PrimaryAction.stories.tsx',
  ]) {
    cpSync(join(root, 'examples/web-fixture', file), join(project, file), { recursive: true });
  }
  // Port substitution is confined to the isolated test copy and committed baseline.
  const serverPath = join(project, 'server.mjs');
  const serverSource = readFileSync(serverPath, 'utf8');
  assert.match(serverSource, /server\.listen\(4390,/);
  writeFileSync(serverPath, serverSource.replaceAll('4390', String(previewPort)));
  const fixtureHtmlPath = join(project, 'index.html');
  const fixtureHtml = readFileSync(fixtureHtmlPath, 'utf8');
  assert.match(fixtureHtml, /http:\/\/127\.0\.0\.1:4387\/adapter\.js/);
  writeFileSync(
    fixtureHtmlPath,
    fixtureHtml.replaceAll('http://127.0.0.1:4387/adapter.js', `${runtimeUrl}/adapter.js`),
  );
  writeFileSync(join(project, '.gitignore'), 'node_modules\ndist\n');
  h.initializeGit(project);
  symlinkSync(join(root, 'node_modules'), join(project, 'node_modules'), 'dir');
  const environment = h.isolatedEnvironment(isolatedHome);
  h.command(
    project,
    process.execPath,
    [
      tooling.cli,
      'setup',
      '--project',
      project,
      '--agent',
      'none',
      '--url',
      previewUrl,
      '--runtime-port',
      String(runtimePort),
      '--yes',
    ],
    environment,
  );
  h.command(project, process.execPath, ['configure-foundry.mjs'], environment);
  h.commitSetup(project);
  h.command(project, process.execPath, ['build.mjs'], environment);
  h.startProcess('experience-fixture', process.execPath, ['server.mjs'], {
    cwd: project,
    env: { ...process.env, ...environment, FOUNDRY_FIXTURE_ROOT: 'dist' },
  });
  await h.waitForHttp(previewUrl, 'isolated Morrow');
  const cli = h.startProcess(
    'experience-cli',
    process.execPath,
    [
      tooling.cli,
      'start',
      '--project',
      project,
      '--runtime-port',
      String(runtimePort),
      '--new',
      '--no-open',
      '--no-dev',
    ],
    { cwd: project, env: { ...process.env, ...environment } },
  );
  const workspaceUrl = await wait(
    () => {
      if (cli.child.exitCode != null) throw new Error(redact(cli.output()));
      return cli.output().match(/^Workspace: (.+)$/m)?.[1];
    },
    'isolated workspace URL',
    30000,
  );
  assert.equal(new URL(workspaceUrl).origin, runtimeUrl);
  const url = new URL(workspaceUrl);
  const session = {
    sessionId: url.searchParams.get('session'),
    token: url.searchParams.get('token'),
  };
  report.sourceRevision = h.command(project, 'git', ['rev-parse', 'HEAD']).stdout.trim();
  report.workingRevision = h.command(root, 'git', ['rev-parse', 'HEAD']).stdout.trim();
  report.inspectorBuildHash = hash(join(root, 'apps/inspector/dist/app.js'));
  report.inspectorAssetHashes = Object.fromEntries(
    [
      'app.js',
      'index.html',
      'experience.js',
      'experience.css',
      'styles.css',
      'workflow.js',
      'workflow.css',
    ].map((file) => [file, hash(join(root, 'apps/inspector/dist', file))]),
  );
  report.adapterBuildHash = hash(join(root, 'packages/web-adapter/dist/adapter.js'));
  const browser = await chromium.launch({ headless: true });
  h.ownedBrowsers.add(browser);
  const browserContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  });
  // Chromium treats intercepted baseline HTML as an unknown address space.
  // Grant the normal explicit localhost permission to these two test origins,
  // without disabling browser security or changing the recording browser.
  await browserContext.grantPermissions(['local-network-access'], { origin: runtimeUrl });
  await browserContext.grantPermissions(['local-network-access'], { origin: previewUrl });
  report.environment = {
    browser: browser.version(),
    platform: process.platform,
    reducedMotion: 'reduce',
  };
  if (baselineOnly) {
    assert.ok(
      existsSync(join(baselineRoot, 'index.html')),
      'Freeze the built inspector before rebuilding.',
    );
    report.inspectorBuildHash = hash(join(baselineRoot, 'app.js'));
    await browserContext.route(`${runtimeUrl}/**`, async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      const file = resolve(baselineRoot, relative);
      if (file.startsWith(`${baselineRoot}/`) && existsSync(file) && !pathname.startsWith('/v1/'))
        await route.fulfill({ path: file });
      else await route.continue();
    });
  }
  page = await browserContext.newPage();
  page.on('framedetached', (frame) =>
    frameLifecycle.push({ frame, kind: 'detached', at: Date.now() }),
  );
  page.on('framenavigated', async (frame) => {
    frameLifecycle.push({ frame, kind: 'navigated', at: Date.now() });
    if (!frame.url().includes('__foundry_verification=1')) return;
    const parentUrl = new URL(frame.parentFrame().url());
    const parentRole = {
      name: frame.parentFrame().name(),
      frame: parentUrl.searchParams.get('__foundry_frame'),
      responsive: parentUrl.searchParams.get('__foundry_responsive_lab'),
      child: parentUrl.searchParams.get('__foundry_child'),
      branch: parentUrl.searchParams.has('__foundry_design_branch'),
    };
    const geometry = await frame
      .evaluate(() => {
        const ancestors = [];
        let element = frameElement;
        while (element) {
          const style = element.ownerDocument.defaultView.getComputedStyle(element);
          ancestors.push({
            tag: element.tagName,
            id: element.id,
            class: element.className,
            overlay: element.getAttribute('data-foundry-overlay'),
            connected: element.isConnected,
            display: style.display,
            visibility: style.visibility,
            width: style.width,
            height: style.height,
            box: element.getBoundingClientRect().toJSON(),
          });
          element = element.parentElement ?? element.getRootNode().host;
        }
        return {
          width: innerWidth,
          height: innerHeight,
          frameWidth: frameElement?.getBoundingClientRect().width,
          frameHeight: frameElement?.getBoundingClientRect().height,
          ancestors,
        };
      })
      .catch(() => null);
    (report.verificationFrameGeometry ??= []).push({ ...geometry, parentRole });
  });
  page.on('pageerror', (error) => report.errors.push(redact(error.message)));
  page.on('console', (message) => {
    if (message.type() === 'error') report.errors.push(redact(message.text()));
  });
  page.on('requestfailed', (request) => {
    const message = redact(`${request.url()}: ${request.failure()?.errorText}`);
    const pathname = new URL(request.url()).pathname;
    const sessionPath = `/v1/sessions/${session.sessionId}`;
    const method = request.method();
    const ownedReadPoll =
      method === 'GET' && [sessionPath, `${sessionPath}/agent-presence`].includes(pathname);
    const ownedHeartbeat = method === 'POST' && pathname === `${sessionPath}/preview-presence`;
    if ((ownedReadPoll || ownedHeartbeat) && request.failure()?.errorText === 'net::ERR_ABORTED') {
      abortedPolls.push({
        frame: request.frame(),
        at: Date.now(),
        message,
        method,
        route: pathname.replace(sessionPath, '/v1/sessions/:id'),
      });
    } else report.errors.push(message);
  });
  page.on('response', async (response) => {
    if (response.status() >= 400)
      report.errors.push(redact(`HTTP ${response.status()}: ${response.url()}`));
    if (!response.url().endsWith('/change-records')) return;
    const submitted = response.request().postDataJSON();
    const result = await response.json().catch(() => ({}));
    (report.changeRequests ??= []).push({
      status: response.status(),
      property: submitted?.change?.property,
      before: submitted?.change?.before,
      after: submitted?.change?.after,
      target: submitted?.change?.target?.id,
      recorded: result.changeSet?.changes?.length,
      error: result.error,
    });
  });
  const verificationTrace = h.observeBrowserVerification(page, session);
  url.searchParams.set('ui', 'legacy');
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.locator('#live-status[data-status="live"]').waitFor({ timeout: 25000 });
  const product = page.frameLocator('#product-preview');
  await product.locator('[data-foundry-id="password-reveal"]').waitFor();
  await check('page-load', async () => {
    assert.ok((await page.locator('body').innerText()).includes('Foundry'));
    assert.equal(
      await page
        .locator('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay')
        .count(),
      0,
    );
    assert.deepEqual(report.errors, []);
  });

  if (baselineOnly) {
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport);
      for (const name of ['light', 'dark']) {
        await theme(name);
        await capture(`baseline-canvas-${viewport.width}-${name}`);
      }
    }
  } else {
    await check('compact-default-navigation', async () => {
      assert.equal(await page.locator('#studio-nav-toggle').getAttribute('aria-expanded'), 'false');
      await assertLayout();
      await capture('canvas-1280-default-compact');
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await assertLayout();
    await check('navigation-discovery-and-preference', async () => {
      const nav = page.locator('.workspace-rail');
      const toggle = page.locator('#studio-nav-toggle');
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
      await assertLayout();
      const normalNavigationWidth = (await nav.boundingBox()).width;
      assert.ok(
        Math.abs(normalNavigationWidth - 184) <= 1,
        `Normal expanded navigation is 184px; got ${normalNavigationWidth}px`,
      );
      for (const label of ['Design', 'Test', 'Collaborate'])
        assert.equal(
          await nav.locator(`.studio-nav-group[aria-label="${label}"]`).count(),
          1,
          `Missing navigation group ${label}`,
        );
      assert.equal(await nav.locator('[data-workspace-mode]').count(), 13);
      await page.locator('#persistent-review').waitFor({ state: 'visible' });
      const original = await toggle.getAttribute('aria-expanded');
      const before = await page.evaluate(() => ({ ...localStorage }));
      await toggle.click();
      await wait(
        async () => (await toggle.getAttribute('aria-expanded')) !== original,
        'navigation toggle',
      );
      const after = await page.evaluate(() => ({ ...localStorage }));
      const key = Object.keys(after).find((candidate) => before[candidate] !== after[candidate]);
      assert.ok(key, 'Navigation preference must be persisted.');
      const changed = await toggle.getAttribute('aria-expanded');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('#live-status[data-status="live"]').waitFor();
      assert.equal(
        await toggle.getAttribute('aria-expanded'),
        changed,
        'Navigation preference survives reload',
      );
      if (changed !== 'true') await toggle.click();
      await toggle.focus();
      await page.keyboard.press('Enter');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      await page.keyboard.press('Space');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      return { preferenceKey: key };
    });
    await selectTarget('password-reveal');
    const retained = await contextSnapshot();
    await check('selection-and-context-across-studios', async () => {
      for (const destination of [
        'components',
        'states',
        'responsive',
        'health',
        'typography',
        'motion',
        'system',
        'memory',
        'branches',
        'recipes',
        'agent',
        'delivery',
        'review',
      ]) {
        await mode(destination);
        await page.locator('#persistent-review').waitFor({ state: 'visible' });
        await mode('canvas');
        assert.deepEqual(await contextSnapshot(), retained, `Context changed after ${destination}`);
      }
    });
    await check(
      'responsive-shell-and-themed-references',
      async () => {
        const failures = [];
        for (const viewport of [
          { width: 1280, height: 800 },
          { width: 1440, height: 900 },
          { width: 1920, height: 1080 },
        ]) {
          await page.setViewportSize(viewport);
          for (const name of ['light', 'dark']) {
            await theme(name);
            for (const destination of ['canvas', 'review', 'delivery']) {
              await mode(destination);
              try {
                await assertLayout();
              } catch (error) {
                failures.push(`${destination}/${viewport.width}/${name}: ${error.message}`);
              }
              await capture(`${destination}-${viewport.width}-${name}`);
            }
          }
        }
        assert.deepEqual(failures, []);
      },
      true,
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await theme('light');
    await selectTarget('password-reveal');
    await check('real-stress-correction-and-review', async () => {
      await mode('health');
      const profile = page.locator('[data-stress-condition="keyboard-only"]');
      if ((await profile.getAttribute('aria-pressed')) !== 'true') await profile.click();
      await page.locator('#apply-stress').click();
      const finding = page
        .locator('.stress-finding-card')
        .filter({ hasText: 'Touch target is too small' })
        .filter({ hasText: 'style.css:' });
      await finding.waitFor({ timeout: 15000 });
      assert.equal(await finding.count(), 1);
      await finding.locator('[data-stress-fix]').click();
      const staged = await wait(async () => {
        const current = await h.sessionRequest(session);
        return current.changeSet.changes.length === 1 ? current.changeSet.changes[0] : null;
      }, 'single staged correction');
      assert.equal(staged.property, 'minHeight');
      assert.equal(staged.target.id, 'password-reveal');
      assert.equal(Number.parseFloat(staged.before), 40);
      assert.equal(Number.parseFloat(staged.after), 44);
      await wait(
        async () => (await page.locator('#persistent-review-count').innerText()) === '1',
        'acknowledged persistent Review count',
        5000,
      );
      await mode('review');
      await h.approveReviewedChange(page);
      await wait(
        async () => (await page.locator('#apply-agent').innerText()).includes('Queue 1'),
        'truthful offline Apply',
      );
      assert.match(await page.locator('#review-summary-content').innerText(), /offline/i);
      await page.locator('.change-source-details summary').first().click();
      assert.match(await page.locator('.change-source').first().innerText(), /style.css/);
      for (let poll = 0; poll < 2; poll++) {
        await page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === `/v1/sessions/${session.sessionId}` &&
            response.request().method() === 'GET',
        );
      }
      await assertLayout();
      assert.equal(await page.locator('.change-source-details').first().getAttribute('open'), '');
      await capture('review-offline-one-change');
      return { property: staged.property, before: staged.before, after: staged.after };
    });
    await check('visible-comparison-preserves-ledger', async () => {
      const before = (await h.sessionRequest(session)).changeSet.changes;
      await page.locator('#review-compare').click();
      await page.locator('[data-mode-surface="canvas"]').waitFor({ state: 'visible' });
      await wait(
        async () =>
          (await page.locator('body').innerText()).toLowerCase().includes('source baseline'),
        'visible source baseline label',
      );
      await wait(
        async () =>
          (await product
            .locator('[data-foundry-id="password-reveal"]')
            .evaluate((element) => getComputedStyle(element).minHeight)) === '40px',
        'actual source baseline measurement',
      );
      await page.locator('#compare').click();
      await wait(
        async () => (await page.locator('#compare').getAttribute('aria-pressed')) === 'false',
        'return to current preview',
      );
      await wait(
        async () =>
          (await product
            .locator('[data-foundry-id="password-reveal"]')
            .evaluate((element) => getComputedStyle(element).minHeight)) === '44px',
        'actual current preview measurement',
      );
      assert.deepEqual((await h.sessionRequest(session)).changeSet.changes, before);
      await mode('review');
    });
    await check(
      'text-200-percent',
      async () => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await assertDoubleText();
        await page.setViewportSize({ width: 1440, height: 900 });
      },
      true,
    );
    await check('real-mcp-apply-rebuild-verification-delivery', async () => {
      const beforeClaim = await h.sessionRequest(session);
      mcp = new h.McpClient(tooling, {
        mcpEnvironment: {
          ...environment,
          FOUNDRY_DESIGN_RUNTIME_URL: runtimeUrl,
          FOUNDRY_DESIGN_SESSION_ID: session.sessionId,
          FOUNDRY_DESIGN_SESSION_TOKEN: session.token,
        },
      });
      await mcp.initialize();
      claimPromise = mcp.call(
        'foundry_design_wait_for_work',
        {
          agent: { name: 'Experience Slice Agent', version: h.version, taskId: 'experience-slice' },
          revision: beforeClaim.changeSet.context.revision,
          designGraphRevision: beforeClaim.changeSet.designGraphRevision,
          waitMs: 60000,
        },
        70000,
      );
      await wait(async () => (await h.listenerPresence(session)).connected, 'real MCP listener');
      await wait(
        async () => (await page.locator('#apply-agent').innerText()).includes('Apply 1'),
        'connected Apply',
      );
      await page.locator('#apply-agent').click();
      const claimed = await claimPromise;
      assert.equal(claimed.kind, 'apply_run');
      const run = claimed.run;
      assert.equal(run.state, 'claimed');
      assert.equal(run.changeIds.length, 1);
      assert.equal(run.revision, beforeClaim.changeSet.context.revision);
      assert.equal(run.designGraphRevision, beforeClaim.changeSet.designGraphRevision);
      assert.equal(run.sourceProofScope, 'git');
      assert.ok(run.claimAttemptId);
      const change = run.reviewedChangeSet.changes.find((item) => item.id === run.changeIds[0]);
      assert.equal(change.target.id, 'password-reveal');
      assert.equal(change.target.source.file, 'style.css');
      assert.equal(change.property, 'minHeight');
      const common = { runId: run.id, claimAttemptId: run.claimAttemptId };
      await mcp.call('foundry_design_update_apply_run', {
        ...common,
        state: 'applying',
        changedFiles: ['style.css'],
        message: 'Applying the reviewed 40px to 44px source correction.',
      });
      const cssPath = join(project, 'style.css');
      const before = readFileSync(cssPath, 'utf8');
      const after = before.replace(
        /(\.reveal-button\s*\{[\s\S]*?min-height:\s*)40px;/,
        (_, prefix) => `${prefix}44px;`,
      );
      assert.notEqual(after, before);
      writeFileSync(cssPath, after);
      await wait(
        async () =>
          (await page.locator('#apply-run .apply-status-row strong').innerText()) === 'Applying',
        'acknowledged applying presentation',
      );
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 1920, height: 1080 },
      ]) {
        await page.setViewportSize(viewport);
        for (const name of ['light', 'dark']) {
          await theme(name);
          await assertLayout();
          await capture(`apply-in-progress-${viewport.width}-${name}`);
        }
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await theme('light');
      await h.asynchronousCommand(
        project,
        process.execPath,
        ['--test', 'smoke.test.mjs'],
        { ...environment, FOUNDRY_EXPECT_REVEAL_HEIGHT: '44' },
        { label: 'Morrow tests', timeoutMs: 60000 },
      );
      h.command(project, process.execPath, ['validate-source-annotations.mjs'], environment);
      h.command(project, process.execPath, ['build.mjs'], environment);
      h.command(project, 'git', ['diff', '--check']);
      assert.deepEqual(
        h.command(project, 'git', ['diff', '--name-only']).stdout.trim().split('\n'),
        ['style.css'],
      );
      await mcp.call('foundry_design_update_apply_run', {
        ...common,
        state: 'rebuilding',
        changedFiles: ['style.css'],
        message: 'Fixture tests, annotations and rebuilt assets passed.',
        validationResults: [{ name: 'Morrow fixture suite, annotations and build', passed: true }],
      });
      const acknowledged = await mcp.call('foundry_design_record_apply_result', {
        ...common,
        changeIds: run.changeIds,
      });
      assert.equal(acknowledged.applyResult?.acknowledged, true);
      await mcp.call('foundry_design_update_apply_run', {
        ...common,
        state: 'verifying',
        message: 'Waiting for real browser-origin rebuilt measurement.',
      });
      report.verificationParentGeometry = await product.locator('body').evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        body: document.body.getBoundingClientRect().toJSON(),
      }));
      const measured = await h.assertBrowserVerification(
        { page, product, verificationTrace },
        run,
        44,
        true,
      );
      for (const frame of report.verificationFrameGeometry ?? []) {
        assert.equal(frame.parentRole.responsive, null, 'Responsive copies never own verification');
        assert.equal(frame.parentRole.child, null, 'Auxiliary copies never own verification');
        assert.equal(frame.parentRole.branch, false, 'Branch copies never own verification');
        assert.notEqual(frame.parentRole.frame, 'state-workbench');
        assert.equal(frame.width, 1440);
        assert.equal(frame.height, 900);
      }
      const verified = await wait(
        async () => {
          const current = await h.sessionRequest(session);
          return current.applyRuns.find((item) => item.id === run.id)?.state === 'passed'
            ? current
            : null;
        },
        'passed Apply and Delivery',
        45000,
      );
      const record = verified.deliveryRecords.find((item) => item.applyRunId === run.id);
      assert.equal(record.status, 'verified');
      assert.ok(verified.designHistory.some((item) => item.applyRunId === run.id));
      await wait(
        async () => (await page.locator('#persistent-review-count').innerText()) === '0',
        'verified changes leave the pending Review count',
      );
      await capture('apply-verified');
      await mode('delivery');
      await page.getByText('Rendered evidence', { exact: true }).waitFor();
      const verifiedDetail = page.locator('.delivery-record-detail[data-readonly="true"]');
      await verifiedDetail.waitFor();
      assert.equal(await verifiedDetail.locator('[data-delivery-field]').count(), 0);
      assert.equal(await verifiedDetail.locator('[data-delivery-readonly-field]').count(), 3);
      await capture('delivery-verified');
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 1920, height: 1080 },
      ]) {
        await page.setViewportSize(viewport);
        for (const name of ['light', 'dark']) {
          await theme(name);
          for (const destination of ['review', 'delivery']) {
            await mode(destination);
            await capture(`${destination}-verified-${viewport.width}-${name}`);
          }
        }
      }
      return {
        sourceFiles: ['style.css'],
        renderedHeight: measured.geometry.height,
        status: 'passed',
        delivery: record.status,
        history: true,
      };
    });
    await check('no-browser-errors', async () => {
      classifyNavigationCancellations();
      assert.deepEqual(report.errors, []);
      assert.equal(await page.locator('#live-status').getAttribute('data-status'), 'live');
    });
  }
  report.status = report.checks.some((item) => item.status === 'failed') ? 'failed' : 'passed';
  if (report.status === 'failed') process.exitCode = 1;
} catch (error) {
  report.status = 'failed';
  report.errors.push(redact(error.stack ?? error));
  if (page) {
    await page
      .screenshot({ path: join(artifacts, baselineOnly ? 'baseline-failure.png' : 'failure.png') })
      .catch(() => {});
    report.failureScreen = redact(
      await page
        .locator('body')
        .innerText()
        .catch(() => 'unavailable'),
    );
  }
  h.retainFailureDiagnostics(error);
  process.exitCode = 1;
} finally {
  classifyNavigationCancellations();
  if (report.status === 'passed' && report.errors.length) {
    report.status = 'failed';
    process.exitCode = 1;
  }
  await mcp?.close().catch(() => {});
  await claimPromise?.catch(() => {});
  await h.stopOwnedResources();
  report.completedAt = new Date().toISOString();
  writeFileSync(
    join(artifacts, baselineOnly ? 'baseline-report.json' : 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  if (report.status === 'passed') rmSync(h.harnessRoot, { recursive: true, force: true });
  console.log(
    `Experience slice ${report.status}; report: ${join(artifacts, baselineOnly ? 'baseline-report.json' : 'report.json')}`,
  );
}
