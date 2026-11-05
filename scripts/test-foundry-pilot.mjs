import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const checkout = resolve(import.meta.dirname, '..');
const outputRoot = join(checkout, 'artifacts', 'foundry-pilot');
const capabilityPath = join(checkout, 'artifacts', 'next-workspace', 'preview.json');
const privatePreviewPath = join(outputRoot, 'preview-private.json');
const require = createRequire(join(checkout, 'package.json'));
const { chromium } = require('@playwright/test');

const phaseArgument = process.argv.find((argument) => argument.startsWith('--phase='));
const phase = phaseArgument?.split('=')[1] ?? 'baseline';
if (!['baseline', 'pilot'].includes(phase)) throw new Error('--phase must be baseline or pilot.');

const capability = JSON.parse(await readFile(capabilityPath, 'utf8'));
const privateUrl = new URL(capability.url);
assert.equal(privateUrl.hostname, '127.0.0.1', 'Workspace capability must remain loopback-only.');
assert.equal(new URL(privateUrl.searchParams.get('preview')).hostname, '127.0.0.1');
assert.ok(
  resolve(capability.project).startsWith(resolve(tmpdir())),
  'The pilot validator may only target the disposable temporary Morrow fixture.',
);
assert.ok(resolve(capability.project).endsWith('/morrow'));

await mkdir(outputRoot, { recursive: true });
await writeFile(
  privatePreviewPath,
  `${JSON.stringify({ url: capability.url, project: capability.project }, null, 2)}\n`,
  { mode: 0o600 },
);
await chmod(privatePreviewPath, 0o600);

const output = join(outputRoot, phase);
await mkdir(output, { recursive: true });

const cases = [
  { id: '1280', width: 1280, height: 800 },
  { id: '1440', width: 1440, height: 1000 },
  { id: '1920', width: 1920, height: 1080 },
  ...(phase === 'pilot' ? [{ id: '1024', width: 1024, height: 768 }] : []),
  { id: 'narrow', width: 390, height: 844 },
];
const themes = ['light', 'dark'];
const checks = [];
const failures = [];
const browserErrors = [];
const requestFailures = [];
const externalRequests = [];
const writeRequests = [];
const states = [];
const screenshots = [];
const interaction = {};

function check(label, condition, details = undefined) {
  const passed = Boolean(condition);
  checks.push({ label, passed, ...(details === undefined ? {} : { details }) });
  if (!passed) failures.push({ label, details });
}

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

const fixtureSources = ['PrimaryAction.tsx', 'style.css', 'index.html', 'foundry.design.json'];
async function fixtureHashes() {
  return Object.fromEntries(
    await Promise.all(
      fixtureSources.map(async (path) => [
        path,
        hash(await readFile(join(capability.project, path))),
      ]),
    ),
  );
}

function sanitizedRequest(request) {
  const url = new URL(request.url());
  return {
    method: request.method(),
    origin: url.origin,
    pathname: url.pathname.replace(/(\/v1\/sessions\/)[^/]+/g, '$1[session]'),
    resourceType: request.resourceType(),
  };
}

function observe(page, label, allowedOrigins) {
  page.on('pageerror', (error) => browserErrors.push(`${label}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`${label}: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    requestFailures.push({
      label,
      ...sanitizedRequest(request),
      failure: request.failure()?.errorText,
    });
  });
  page.on('request', (request) => {
    const record = { label, ...sanitizedRequest(request) };
    if (!allowedOrigins.has(record.origin)) externalRequests.push(record);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(record.method)) writeRequests.push(record);
  });
}

async function waitForReady(page) {
  await page.locator('#live-status[data-status="live"]').waitFor({ timeout: 30_000 });
  await page.locator('#app-shell[data-next="true"]').waitFor({ timeout: 30_000 });
  const product = page.frameLocator('#product-preview');
  await product.locator('[data-foundry-id="story-title"]').waitFor({ timeout: 30_000 });
  return product;
}

async function measure(page, fixtureCase, theme) {
  return page.evaluate(
    ({ viewport, themeName, expectedPhase }) => {
      const box = (selector) => {
        const element = document.querySelector(selector);
        if (!element || element.hidden || getComputedStyle(element).display === 'none') return null;
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
      const visibleFields = [...document.querySelectorAll('.next-field')].filter(
        (element) => element.getBoundingClientRect().height > 0,
      );
      const selectedTreeItems = [
        ...document.querySelectorAll('[role="treeitem"][aria-selected="true"]'),
      ];
      return {
        id: `${themeName}-${viewport.id}`,
        phase: expectedPhase,
        viewport,
        theme: document.documentElement.dataset.theme,
        themePreference: document.documentElement.dataset.themePreference,
        foundations: new URLSearchParams(location.search).get('foundations'),
        liveStatus: document.querySelector('#live-status')?.dataset.status,
        next: document.querySelector('#app-shell')?.dataset.next,
        mode: document.querySelector('#app-shell')?.dataset.mode,
        duplicateIds: ids.length - new Set(ids).size,
        document: {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          clientHeight: document.documentElement.clientHeight,
          scrollHeight: document.documentElement.scrollHeight,
        },
        boxes: {
          shell: box('#app-shell'),
          appBar: box('.app-bar'),
          tabs: box('.next-tabs'),
          workspace: box('.workspace'),
          navigation: box('#studio-navigation'),
          layers: box('#layers-dock'),
          center: box('.center-workspace'),
          panel: box('#next-workspace-panel'),
          inspector: box('#inspector-dock'),
          context: box('.canvas-context'),
          stage: box('#canvas-stage'),
          toolbar: box('.canvas-toolbar'),
          sourceFooter: box('.next-source-footer'),
        },
        visibility: {
          layers: !document.querySelector('#layers-dock')?.hidden,
          inspector: !document.querySelector('#inspector-dock')?.hidden,
          toolbar: document.querySelector('.canvas-toolbar')?.getBoundingClientRect().height > 0,
          sourceFooter:
            document.querySelector('.next-source-footer')?.getBoundingClientRect().height > 0,
        },
        selection: {
          summary: document
            .querySelector('#selection-summary')
            ?.textContent.replace(/\s+/g, ' ')
            .trim(),
          treeCount: selectedTreeItems.length,
          fontSizeField: document.querySelector('[data-next-field="fontSize"]')?.value ?? null,
          visibleFieldCount: visibleFields.length,
        },
        controlCounts: {
          workspaceDestinations: document.querySelectorAll('[data-workspace-mode]').length,
          dockToggles: document.querySelectorAll('[data-dock-toggle]').length,
          canvasTools: document.querySelectorAll('.canvas-toolbar button').length,
        },
      };
    },
    { viewport: fixtureCase, themeName: theme, expectedPhase: phase },
  );
}

async function openCase(browser, fixtureCase, theme) {
  const context = await browser.newContext({
    viewport: { width: fixtureCase.width, height: fixtureCase.height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    colorScheme: theme,
  });
  const page = await context.newPage();
  const url = new URL(privateUrl);
  url.searchParams.set('theme', theme);
  url.searchParams.delete('foundations');
  if (phase === 'baseline') url.searchParams.set('foundations', 'off');
  const preview = new URL(url.searchParams.get('preview'));
  const allowedOrigins = new Set([url.origin, preview.origin]);
  await context.grantPermissions(['local-network-access'], { origin: url.origin });
  await context.grantPermissions(['local-network-access'], { origin: preview.origin });
  observe(page, `${theme}-${fixtureCase.id}`, allowedOrigins);
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  const product = await waitForReady(page);
  // The accepted baseline's 390px layout gives the Inspector the available
  // workspace width and leaves the canvas at zero width. Preserve that honest
  // narrow baseline instead of force-clicking a target outside the viewport.
  if (fixtureCase.id !== 'narrow') {
    await product.locator('[data-foundry-id="story-title"]').click();
    await page.locator('[data-next-field="fontSize"]').waitFor();
  }
  const state = await measure(page, fixtureCase, theme);
  states.push(state);

  check(
    `${state.id}: runtime and real product preview are live`,
    state.liveStatus === 'live',
    state.liveStatus,
  );
  check(
    `${state.id}: redesigned workspace is active`,
    state.next === 'true' && state.mode === 'canvas',
    {
      next: state.next,
      mode: state.mode,
    },
  );
  check(`${state.id}: requested workspace theme is active`, state.theme === theme, {
    requested: theme,
    actual: state.theme,
    preference: state.themePreference,
  });
  check(
    `${state.id}: foundation query is scoped to the requested phase`,
    phase === 'pilot' ? state.foundations === null : state.foundations === 'off',
    state.foundations,
  );
  check(`${state.id}: document IDs remain unique`, state.duplicateIds === 0, state.duplicateIds);
  check(
    `${state.id}: selection reaches the real Inspector`,
    fixtureCase.id === 'narrow' ||
      (state.selection.fontSizeField !== null && state.selection.visibleFieldCount > 0),
    state.selection,
  );
  check(
    `${state.id}: workspace has no document-level horizontal overflow`,
    state.document.scrollWidth <= state.document.clientWidth + 1,
    state.document,
  );
  if (phase === 'pilot') {
    const aligned = (first, second) =>
      Number.isFinite(first) && Number.isFinite(second) && Math.abs(first - second) <= 0.5;
    if (['1280', '1440', '1920'].includes(fixtureCase.id)) {
      check(
        `${state.id}: desktop Layers, Canvas, context, tab pane and Inspector share exact seams`,
        aligned(state.boxes.layers?.right, state.boxes.center?.left) &&
          aligned(state.boxes.tabs?.left, state.boxes.center?.left) &&
          aligned(state.boxes.context?.left, state.boxes.center?.left) &&
          aligned(state.boxes.center?.right, state.boxes.inspector?.left),
        {
          layersRight: state.boxes.layers?.right,
          tabsLeft: state.boxes.tabs?.left,
          centerLeft: state.boxes.center?.left,
          contextLeft: state.boxes.context?.left,
          centerRight: state.boxes.center?.right,
          inspectorLeft: state.boxes.inspector?.left,
        },
      );
    } else if (fixtureCase.id === '1024') {
      check(
        `${state.id}: hidden-Layers layout keeps Canvas context and Inspector adjoining`,
        state.boxes.layers === null &&
          aligned(state.boxes.context?.left, state.boxes.center?.left) &&
          aligned(state.boxes.center?.right, state.boxes.inspector?.left),
        {
          layers: state.boxes.layers,
          contextLeft: state.boxes.context?.left,
          centerLeft: state.boxes.center?.left,
          centerRight: state.boxes.center?.right,
          inspectorLeft: state.boxes.inspector?.left,
        },
      );
    } else if (fixtureCase.id === 'narrow') {
      check(
        `${state.id}: stacked Canvas and Inspector share aligned horizontal edges and vertical seam`,
        aligned(state.boxes.context?.left, state.boxes.center?.left) &&
          aligned(state.boxes.center?.left, state.boxes.inspector?.left) &&
          aligned(state.boxes.center?.right, state.boxes.inspector?.right) &&
          aligned(state.boxes.center?.bottom, state.boxes.inspector?.top),
        {
          contextLeft: state.boxes.context?.left,
          center: state.boxes.center,
          inspector: state.boxes.inspector,
        },
      );
    }
  }
  check(
    `${state.id}: Canvas toolbar and Inspector source footer remain visible`,
    state.visibility.toolbar && state.visibility.sourceFooter,
    state.visibility,
  );

  const screenshot = `${theme}-${fixtureCase.id}.png`;
  await page.screenshot({ path: join(output, screenshot), fullPage: false });
  screenshots.push(screenshot);

  if (phase === 'pilot' && fixtureCase.id === '1024') {
    check(
      `${state.id}: responsive layout yields Layers to a usable Canvas and Inspector`,
      state.boxes.layers === null &&
        state.boxes.center?.width >= 500 &&
        state.boxes.inspector?.width >= 240 &&
        state.boxes.toolbar?.left >= 0 &&
        state.boxes.toolbar?.right <= state.document.clientWidth,
      {
        layers: state.boxes.layers,
        center: state.boxes.center,
        inspector: state.boxes.inspector,
        toolbar: state.boxes.toolbar,
        viewportWidth: state.document.clientWidth,
      },
    );
  }

  if (phase === 'pilot' && fixtureCase.id === 'narrow') {
    check(
      `${state.id}: stacked narrow Canvas remains meaningfully usable`,
      state.boxes.center?.width >= 300 &&
        state.boxes.stage?.width >= 300 &&
        state.boxes.toolbar?.left >= 0 &&
        state.boxes.toolbar?.right <= state.document.clientWidth,
      {
        center: state.boxes.center,
        stage: state.boxes.stage,
        toolbar: state.boxes.toolbar,
        viewportWidth: state.document.clientWidth,
      },
    );

    await product.locator('[data-foundry-id="story-title"]').click();
    const fontSize = page.locator('[data-next-field="fontSize"]');
    await fontSize.waitFor();
    await fontSize.scrollIntoViewIfNeeded();
    check(
      `${state.id}: real selection exposes editable typography inside the stacked Inspector`,
      (await fontSize.isVisible()) &&
        (await fontSize.inputValue()).length > 0 &&
        (await page.locator('#inspector-dock').getAttribute('data-selection-category')) === 'text',
      {
        value: await fontSize.inputValue(),
        category: await page.locator('#inspector-dock').getAttribute('data-selection-category'),
      },
    );
    const typographyScreenshot = `${theme}-${fixtureCase.id}-selected-typography.png`;
    await page.screenshot({ path: join(output, typographyScreenshot), fullPage: false });
    screenshots.push(typographyScreenshot);

    const colorTrigger = page.locator('[data-color-picker="color"]');
    await colorTrigger.scrollIntoViewIfNeeded();
    check(
      `${state.id}: selected text color control remains reachable within Inspector scrolling`,
      (await colorTrigger.isVisible()) &&
        (await colorTrigger.getAttribute('aria-haspopup')) === 'dialog',
      {
        visible: await colorTrigger.isVisible(),
        popup: await colorTrigger.getAttribute('aria-haspopup'),
        box: await colorTrigger.boundingBox(),
      },
    );
    const colorScreenshot = `${theme}-${fixtureCase.id}-selected-color.png`;
    await page.screenshot({ path: join(output, colorScreenshot), fullPage: false });
    screenshots.push(colorScreenshot);

    await page.locator('#next-source-toggle').scrollIntoViewIfNeeded();
    const narrowReachability = await page.evaluate(() => {
      const workspace = document.querySelector('.workspace');
      const inspector = document.querySelector('#inspector-dock');
      const footer = document.querySelector('#next-source-toggle');
      const rect = (element) => {
        const value = element?.getBoundingClientRect();
        return value
          ? { left: value.left, top: value.top, right: value.right, bottom: value.bottom }
          : null;
      };
      return {
        workspaceScrollTop: workspace?.scrollTop ?? 0,
        workspaceScrollHeight: workspace?.scrollHeight ?? 0,
        workspaceClientHeight: workspace?.clientHeight ?? 0,
        inspector: rect(inspector),
        footer: rect(footer),
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    check(
      `${state.id}: stacked Inspector and source footer are reachable by workspace scroll`,
      narrowReachability.workspaceScrollHeight > narrowReachability.workspaceClientHeight &&
        narrowReachability.workspaceScrollTop > 0 &&
        narrowReachability.footer?.left >= 0 &&
        narrowReachability.footer?.right <= narrowReachability.viewport.width &&
        narrowReachability.footer?.top >= 0 &&
        narrowReachability.footer?.bottom <= narrowReachability.viewport.height,
      narrowReachability,
    );
    const inspectorScreenshot = `${theme}-${fixtureCase.id}-inspector.png`;
    await page.screenshot({ path: join(output, inspectorScreenshot), fullPage: false });
    screenshots.push(inspectorScreenshot);
  }
  return { context, page, product, state };
}

async function poll(checkValue, timeout = 5_000, interval = 50) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await checkValue();
    if (value) return value;
    await new Promise((resolveWait) => setTimeout(resolveWait, interval));
  }
  throw new Error('Timed out waiting for a disposable preview condition.');
}

async function validateEditingContract(page, product) {
  const sourceBefore = await fixtureHashes();
  const title = product.locator('[data-foundry-id="story-title"]');
  const field = page.locator('[data-next-field="fontSize"]');
  // `openCase` already selects the title. Clicking the selected preview target
  // again is an intentional deselection gesture in the real workspace, so only
  // establish selection here when this helper is ever called independently.
  if (!(await field.isVisible())) await title.click();
  await field.waitFor();
  // Make the disposable harness idempotent after an interrupted prior run.
  // This clears only a temporary Font size ledger entry; it never invokes Apply.
  if (Number(await page.locator('#persistent-review-count').textContent()) > 0) {
    const reset = page.locator('[data-reset="fontSize"]');
    if (await reset.isVisible()) {
      await reset.click();
      await poll(
        async () => Number(await page.locator('#persistent-review-count').textContent()) === 0,
      );
    }
  }
  const beforeSize = await title.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  const beforeStyle = await title.getAttribute('style');

  await field.fill(String(beforeSize + 4));
  await poll(
    async () =>
      (await title.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))) ===
      beforeSize + 4,
  );
  await field.press('Escape');
  await poll(
    async () =>
      (await title.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))) ===
      beforeSize,
  );
  check(
    'Disposable fixture: Escape restores exact preview style without accepting a change',
    (await title.getAttribute('style')) === beforeStyle,
    {
      beforeStyle,
      afterStyle: await title.getAttribute('style'),
    },
  );

  await field.fill('not a size');
  await field.press('Enter');
  check(
    'Disposable fixture: invalid numeric input remains visible until correction or cancellation',
    (await field.inputValue()) === 'not a size' &&
      (await page.locator('.next-edit-error').isVisible()) &&
      (await page.locator('.next-edit-error').textContent()).includes('Enter a number'),
    {
      value: await field.inputValue(),
      error: await page.locator('.next-edit-error').textContent(),
    },
  );
  await field.press('Escape');
  await poll(async () => (await field.inputValue()) === String(beforeSize));

  await field.fill(String(beforeSize + 4));
  await field.press('Enter');
  await poll(
    async () => Number(await page.locator('#persistent-review-count').textContent()) === 1,
  );
  check(
    'Disposable fixture: Enter creates one temporary review change',
    (await title.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))) ===
      beforeSize + 4 && Number(await page.locator('#persistent-review-count').textContent()) === 1,
    {
      rendered: await title.evaluate((element) => getComputedStyle(element).fontSize),
      reviewCount: await page.locator('#persistent-review-count').textContent(),
    },
  );

  await page.locator('#persistent-review').click();
  await page.locator('[data-mode-surface="review"]:not([hidden])').waitFor();
  check(
    'Disposable fixture: Review exposes the temporary Font size record without invoking Apply',
    /Font size|fontSize/.test(await page.locator('#changes').textContent()) &&
      Number(await page.locator('#persistent-review-count').textContent()) === 1,
    (await page.locator('#changes').textContent()).replace(/\s+/g, ' ').trim(),
  );
  await page.locator('#next-tab-canvas').click();
  await page.locator('[data-mode-surface="canvas"]:not([hidden])').waitFor();
  await page.locator('[data-reset="fontSize"]').click();
  await poll(
    async () =>
      (await title.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))) ===
      beforeSize,
  );
  await poll(
    async () => Number(await page.locator('#persistent-review-count').textContent()) === 0,
  );
  check(
    'Disposable fixture: reset removes the temporary ledger entry and restores rendering',
    (await title.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))) ===
      beforeSize && Number(await page.locator('#persistent-review-count').textContent()) === 0,
    {
      beforeStyle,
      afterStyle: await title.getAttribute('style'),
      rendered: await title.evaluate((element) => getComputedStyle(element).fontSize),
    },
  );

  const sourceAfter = await fixtureHashes();
  check(
    'Disposable fixture: preview, Review and reset do not modify fixture source files',
    JSON.stringify(sourceAfter) === JSON.stringify(sourceBefore),
    { before: sourceBefore, after: sourceAfter },
  );
  Object.assign(interaction, {
    target: 'Disposable Morrow story title',
    beforeSize,
    temporarySize: beforeSize + 4,
    sourceHashesBefore: sourceBefore,
    sourceHashesAfter: sourceAfter,
    applyInvoked: false,
    cleanup:
      'Font size reset to the exact starting rendered value; temporary Review ledger returned to zero.',
  });
}

async function validatePilotContracts(page, product) {
  const title = product.locator('[data-foundry-id="story-title"]');
  const colorTrigger = page.locator('[data-color-picker="color"]');
  const originalColor = await title.evaluate((element) => getComputedStyle(element).color);
  const sourceBefore = await fixtureHashes();

  check(
    'Default foundations mode matches the real Canvas workspace',
    (await page.locator('html').getAttribute('data-foundry-pilot')) === 'canvas' &&
      (await page.locator('#app-shell').getAttribute('data-mode')) === 'canvas',
    {
      pilot: await page.locator('html').getAttribute('data-foundry-pilot'),
      mode: await page.locator('#app-shell').getAttribute('data-mode'),
    },
  );

  const layerSearch = page.locator('#structure-search');
  await layerSearch.fill('Make room');
  check(
    'Pilot Layers search remains focusable and filters the real product tree',
    (await layerSearch.evaluate((element) => element === document.activeElement)) &&
      (await page.locator('#structure-list [role="treeitem"]').count()) > 0,
    {
      focused: await layerSearch.evaluate((element) => element === document.activeElement),
      visibleResults: await page.locator('#structure-list [role="treeitem"]').count(),
    },
  );
  await layerSearch.fill('');
  await layerSearch.focus();
  check(
    'Pilot Layers search retains keyboard focus after clearing the filter',
    (await page.locator('#layers-dock').isVisible()) &&
      (await layerSearch.evaluate((element) => element === document.activeElement)),
    {
      visible: await page.locator('#layers-dock').isVisible(),
      focused: await layerSearch.evaluate((element) => element === document.activeElement),
    },
  );

  const sizeField = page.locator('[data-next-field="fontSize"]');
  const scrub = sizeField.locator(
    'xpath=preceding-sibling::button[contains(concat(" ", normalize-space(@class), " "), " next-scrub ")]',
  );
  const scrubStart = Number(await sizeField.inputValue());
  const scrubBox = await scrub.boundingBox();
  assert.ok(scrubBox, 'Font size scrub target must have geometry.');
  await page.mouse.move(scrubBox.x + scrubBox.width / 2, scrubBox.y + scrubBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(scrubBox.x + scrubBox.width / 2 + 8, scrubBox.y + scrubBox.height / 2);
  await poll(async () => Number(await sizeField.inputValue()) !== scrubStart);
  const scrubPreview = Number(await sizeField.inputValue());
  await scrub.dispatchEvent('pointercancel', {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    clientX: scrubBox.x + scrubBox.width / 2 + 8,
    clientY: scrubBox.y + scrubBox.height / 2,
  });
  await page.mouse.up();
  await poll(async () => Number(await sizeField.inputValue()) === scrubStart);
  check(
    'Pilot numeric scrub previews whole-number steps and pointer cancellation restores the value',
    Number.isInteger(scrubPreview) &&
      scrubPreview !== scrubStart &&
      Number(await page.locator('#persistent-review-count').textContent()) === 0,
    {
      start: scrubStart,
      preview: scrubPreview,
      restored: await sizeField.inputValue(),
      reviewCount: await page.locator('#persistent-review-count').textContent(),
    },
  );

  await colorTrigger.click();
  let dialog = page.locator('.next-color-picker');
  await dialog.waitFor();
  const invalidColor = dialog.locator('[data-color-value]');
  await invalidColor.fill('not-a-color');
  check(
    'Pilot color picker keeps invalid text explicit and disables acceptance',
    (await invalidColor.getAttribute('aria-invalid')) === 'true' &&
      (await dialog.locator('[data-use]').isDisabled()) &&
      /Enter a color/.test(await dialog.locator('[role="status"]').textContent()),
    {
      value: await invalidColor.inputValue(),
      invalid: await invalidColor.getAttribute('aria-invalid'),
      status: await dialog.locator('[role="status"]').textContent(),
    },
  );
  await dialog.locator('[data-cancel]').first().click();
  await dialog.waitFor({ state: 'detached' });
  check(
    'Pilot color cancel restores rendering and focus without a Review change',
    (await title.evaluate((element) => getComputedStyle(element).color)) === originalColor &&
      Number(await page.locator('#persistent-review-count').textContent()) === 0 &&
      (await colorTrigger.evaluate((element) => element === document.activeElement)),
    {
      before: originalColor,
      after: await title.evaluate((element) => getComputedStyle(element).color),
      reviewCount: await page.locator('#persistent-review-count').textContent(),
      focusRestored: await colorTrigger.evaluate((element) => element === document.activeElement),
    },
  );

  await colorTrigger.click();
  dialog = page.locator('.next-color-picker');
  await dialog.waitFor();
  await dialog.locator('[data-color-value]').fill('#336699');
  await dialog.locator('[data-alpha-value]').fill('42');
  await poll(async () =>
    /rgba?\(51, 102, 153(?:, 0\.42)?\)/.test(
      await title.evaluate((element) => getComputedStyle(element).color),
    ),
  );
  const alphaPreview = await title.evaluate((element) => getComputedStyle(element).color);
  check(
    'Pilot color picker previews a valid alpha-bearing color without source acceptance',
    /rgba\(51, 102, 153, 0\.42\)/.test(alphaPreview) &&
      !(await dialog.locator('[data-use]').isDisabled()),
    { alphaPreview, useDisabled: await dialog.locator('[data-use]').isDisabled() },
  );
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await poll(
    async () =>
      (await title.evaluate((element) => getComputedStyle(element).color)) === originalColor,
  );
  check(
    'Pilot Escape cancels alpha preview and leaves the temporary ledger empty',
    Number(await page.locator('#persistent-review-count').textContent()) === 0 &&
      (await title.evaluate((element) => getComputedStyle(element).color)) === originalColor,
    {
      before: originalColor,
      after: await title.evaluate((element) => getComputedStyle(element).color),
      reviewCount: await page.locator('#persistent-review-count').textContent(),
    },
  );

  const switcher = page.locator('#layers-dock .foundry-workspace-switcher');
  await switcher.click();
  check(
    'Pilot workspace switcher opens the real navigation flyout',
    (await switcher.getAttribute('aria-expanded')) === 'true' &&
      (await page.locator('#studio-navigation').isVisible()),
    {
      expanded: await switcher.getAttribute('aria-expanded'),
      navigationVisible: await page.locator('#studio-navigation').isVisible(),
    },
  );
  await page.keyboard.press('Escape');
  check(
    'Pilot workspace switcher Escape closes the flyout and restores focus',
    (await switcher.getAttribute('aria-expanded')) === 'false' &&
      (await switcher.evaluate((element) => element === document.activeElement)),
    {
      expanded: await switcher.getAttribute('aria-expanded'),
      focused: await switcher.evaluate((element) => element === document.activeElement),
    },
  );
  const workspaceModes = await validateWorkspaceFoundationModes(page, true);
  check(
    'Returning to Canvas retains default foundations and the real selection contract',
    (await page.locator('html').getAttribute('data-foundry-pilot')) === 'canvas' &&
      (await page.locator('[data-next-field="fontSize"]').isVisible()) &&
      Number(await page.locator('#persistent-review-count').textContent()) === 0,
    {
      pilot: await page.locator('html').getAttribute('data-foundry-pilot'),
      fontSizeVisible: await page.locator('[data-next-field="fontSize"]').isVisible(),
      reviewCount: await page.locator('#persistent-review-count').textContent(),
    },
  );

  const sourceAfter = await fixtureHashes();
  check(
    'Pilot color, workspace-gate and return flows do not modify disposable fixture source',
    JSON.stringify(sourceAfter) === JSON.stringify(sourceBefore),
    { before: sourceBefore, after: sourceAfter },
  );
  Object.assign(interaction, {
    ...interaction,
    pilotColor: {
      original: originalColor,
      preview: alphaPreview,
      cancelled: true,
      reviewCount: 0,
    },
    pilotGate: {
      canvas: 'canvas',
      migratedModes: workspaceModes,
      returned: 'canvas',
    },
  });
}

// Exercise navigation through the real flyout. Merely toggling the root attribute
// would miss renderer gates and would not prove the default route works.
async function validateWorkspaceFoundationModes(page, enabled) {
  const modes = [
    'canvas',
    'components',
    'system',
    'motion',
    'typography',
    'recipes',
    'states',
    'responsive',
    'health',
    'agent',
    'branches',
    'memory',
    'delivery',
    'review',
  ];
  const expectedQuery = enabled ? null : 'off';
  check(
    `${enabled ? 'Default' : 'Fallback'} workspace sweep uses the intended URL policy`,
    new URL(page.url()).searchParams.get('foundations') === expectedQuery,
  );
  for (const mode of [...modes, 'canvas']) {
    if ((await page.locator('#app-shell').getAttribute('data-mode')) !== mode) {
      const trigger = enabled
        ? page.locator('.foundry-sidebar .foundry-workspace-switcher:visible').first()
        : page.locator('[data-next-tools]:visible').first();
      await trigger.click();
      await page.locator(`#studio-navigation [data-workspace-mode="${mode}"]`).click();
    }
    await poll(
      async () =>
        (await page.locator('#app-shell').getAttribute('data-mode')) === mode &&
        (await page.locator('html').getAttribute('data-foundry-pilot')) === (enabled ? mode : null),
    );
    const actual = {
      mode: await page.locator('#app-shell').getAttribute('data-mode'),
      foundations: await page.locator('html').getAttribute('data-foundry-pilot'),
      visibleSwitchers: await page
        .locator('.foundry-sidebar .foundry-workspace-switcher:visible')
        .count(),
      reviewCount: Number(await page.locator('#persistent-review-count').textContent()),
    };
    check(
      `${enabled ? 'Default' : 'Explicit fallback'} ${mode} retains the matching presentation and empty Review`,
      actual.mode === mode &&
        actual.foundations === (enabled ? mode : null) &&
        (enabled ? actual.visibleSwitchers === 1 : actual.visibleSwitchers === 0) &&
        actual.reviewCount === 0,
      actual,
    );
  }
  return modes;
}

async function validateFallbackUiPreservation(browser) {
  const baseline = JSON.parse(await readFile(join(outputRoot, 'baseline', 'report.json'), 'utf8'));
  for (const theme of themes) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      colorScheme: theme,
    });
    const page = await context.newPage();
    const url = new URL(privateUrl);
    url.searchParams.set('theme', theme);
    url.searchParams.set('foundations', 'off');
    const preview = new URL(url.searchParams.get('preview'));
    const allowedOrigins = new Set([url.origin, preview.origin]);
    await context.grantPermissions(['local-network-access'], { origin: url.origin });
    await context.grantPermissions(['local-network-access'], { origin: preview.origin });
    observe(page, `fallback-${theme}-1440`, allowedOrigins);
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    const product = await waitForReady(page);
    await product.locator('[data-foundry-id="story-title"]').click();
    await page.locator('[data-next-field="fontSize"]').waitFor();
    const actual = await page.evaluate(() => {
      const width = (selector) =>
        document.querySelector(selector)?.getBoundingClientRect().width ?? null;
      return {
        gate: document.documentElement.getAttribute('data-foundry-pilot'),
        layers: width('#layers-dock'),
        center: width('.center-workspace'),
        inspector: width('#inspector-dock'),
        visibleFieldCount: [...document.querySelectorAll('.next-field')].filter(
          (element) => element.getBoundingClientRect().height > 0,
        ).length,
      };
    });
    const expected = baseline.states.find((state) => state.id === `${theme}-1440`);
    check(
      `Explicit-fallback ${theme} UI remains identical to the frozen 1440 workspace geometry`,
      actual.gate === null &&
        actual.layers === expected?.boxes.layers?.width &&
        actual.center === expected?.boxes.center?.width &&
        actual.inspector === expected?.boxes.inspector?.width &&
        actual.visibleFieldCount === expected?.selection.visibleFieldCount,
      { expected, actual },
    );
    const screenshot = `fallback-${theme}-1440.png`;
    await page.screenshot({ path: join(output, screenshot), fullPage: false });
    screenshots.push(screenshot);
    await validateWorkspaceFoundationModes(page, false);
    await context.close();
  }
}

let fatalError;
const browser = await chromium.launch({ headless: true });
try {
  for (const theme of themes) {
    for (const fixtureCase of cases) {
      const opened = await openCase(browser, fixtureCase, theme);
      if (theme === 'light' && fixtureCase.id === '1440') {
        await validateEditingContract(opened.page, opened.product);
        if (phase === 'pilot') await validatePilotContracts(opened.page, opened.product);
      } else if (phase === 'pilot' && fixtureCase.id === '1440') {
        await validateWorkspaceFoundationModes(opened.page, true);
      }
      await opened.context.close();
    }
  }
  if (phase === 'pilot') await validateFallbackUiPreservation(browser);
} catch (error) {
  fatalError = error;
  failures.push({
    label: 'Validator completed without an exception',
    details: error.stack || error.message,
  });
} finally {
  await browser.close();
}

const unexpectedWrites = writeRequests.filter(({ pathname }) => /apply/i.test(pathname));
check('No source Apply endpoint was invoked', unexpectedWrites.length === 0, unexpectedWrites);
check('No external network origin was contacted', externalRequests.length === 0, externalRequests);
check('No browser page errors were recorded', browserErrors.length === 0, browserErrors);
check('No browser request failures were recorded', requestFailures.length === 0, requestFailures);

let baselineComparison;
if (phase === 'pilot') {
  const baseline = JSON.parse(await readFile(join(outputRoot, 'baseline', 'report.json'), 'utf8'));
  const baselineById = new Map(baseline.states.map((state) => [state.id, state]));
  const comparisons = states
    .filter((state) => baselineById.has(state.id))
    .map((state) => {
      const before = baselineById.get(state.id);
      return {
        id: state.id,
        found: Boolean(before),
        stable: Boolean(
          before &&
          before.controlCounts.workspaceDestinations ===
            state.controlCounts.workspaceDestinations &&
          before.controlCounts.dockToggles === state.controlCounts.dockToggles &&
          before.controlCounts.canvasTools === state.controlCounts.canvasTools &&
          before.visibility.toolbar === state.visibility.toolbar &&
          before.visibility.sourceFooter === state.visibility.sourceFooter &&
          before.selection.visibleFieldCount === state.selection.visibleFieldCount,
        ),
      };
    });
  baselineComparison = { comparisons };
  check(
    'Pilot preserves baseline workspace structure and selected Inspector capability across all states',
    comparisons.length === baseline.states.length &&
      comparisons.every((comparison) => comparison.found && comparison.stable),
    comparisons,
  );
}

const report = {
  generatedAt: new Date().toISOString(),
  phase,
  scope: {
    fixture:
      'Disposable temporary Morrow project created by scripts/test-next-workspace.mjs --preview',
    runtimePort: Number(privateUrl.port),
    previewPort: Number(new URL(privateUrl.searchParams.get('preview')).port),
    foundationQuery: phase === 'pilot' ? 'omitted (default)' : 'foundations=off',
    boundary:
      'Local preview, cancellation, temporary Review and reset only. Apply was not invoked.',
    credentials: 'Stored only in preview-private.json with mode 0600; omitted from this report.',
  },
  counts: {
    passed: checks.filter((item) => item.passed).length,
    failed: failures.length,
    browserErrors: browserErrors.length,
    requestFailures: requestFailures.length,
    states: states.length,
  },
  checks,
  failures,
  browserErrors,
  requestFailures,
  externalRequests,
  writeRequests,
  states,
  interaction,
  baselineComparison,
  screenshots,
  limitations: [
    'This is a disposable browser harness, not the user’s active Foundry session.',
    'Screenshots validate local rendering and interaction only; they are not source Apply or production evidence.',
    'The pilot comparison preserves semantic and interaction invariants but intentionally does not require pixel equality.',
  ],
};
await writeFile(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(
  `${phase} product-pilot validation: ${report.counts.passed} passed, ${report.counts.failed} failed, ${report.counts.browserErrors} browser errors, ${report.counts.states} states`,
);
console.log(`Private preview capability retained at ${privatePreviewPath}`);
if (fatalError || failures.length || browserErrors.length || requestFailures.length)
  process.exitCode = 1;
