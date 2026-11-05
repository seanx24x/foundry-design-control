import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const checkout = resolve(import.meta.dirname, '..');
const capabilityPath = join(checkout, 'artifacts', 'next-workspace', 'preview.json');
const outputRoot = join(checkout, 'artifacts', 'foundry-workshop-pilot');
const privatePreviewPath = join(outputRoot, 'preview-private.json');
const require = createRequire(join(checkout, 'package.json'));
const { chromium } = require('@playwright/test');

const phaseArgument = process.argv.find((argument) => argument.startsWith('--phase='));
const phase = phaseArgument?.split('=')[1] ?? 'baseline';
if (!['baseline', 'pilot'].includes(phase)) throw new Error('--phase must be baseline or pilot.');

const output = join(outputRoot, phase);
const reportPath = join(output, 'report.json');
if (phase === 'baseline') {
  try {
    await readFile(reportPath, 'utf8');
    throw new Error(
      'The Component Workshop baseline is frozen. Refusing to overwrite artifacts/foundry-workshop-pilot/baseline/report.json.',
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const capability = JSON.parse(await readFile(capabilityPath, 'utf8'));
const privateUrl = new URL(capability.url);
const previewUrl = new URL(privateUrl.searchParams.get('preview'));
assert.equal(privateUrl.hostname, '127.0.0.1', 'Workspace capability must remain loopback-only.');
assert.equal(previewUrl.hostname, '127.0.0.1', 'Product preview must remain loopback-only.');
assert.ok(
  resolve(capability.project).startsWith(resolve(tmpdir())),
  'Workshop validation may only target a disposable temporary project.',
);
assert.ok(resolve(capability.project).endsWith('/morrow'));

await mkdir(output, { recursive: true });
await writeFile(
  privatePreviewPath,
  `${JSON.stringify({ url: capability.url, project: capability.project }, null, 2)}\n`,
  { mode: 0o600 },
);
await chmod(privatePreviewPath, 0o600);

const sourceFiles = [
  'PrimaryAction.tsx',
  'PrimaryAction.stories.tsx',
  'style.css',
  'index.html',
  'foundry.design.json',
];
const cases = [
  { id: '1440', width: 1440, height: 1000 },
  { id: '1280', width: 1280, height: 800 },
  { id: '1024', width: 1024, height: 768 },
  { id: '390', width: 390, height: 844 },
];
const themes = ['light', 'dark'];
const expectedVariants = [
  ['morrow-action-primary', 'Primary'],
  ['morrow-action-quiet', 'Quiet'],
  ['morrow-action-danger', 'Danger'],
];
const checks = [];
const failures = [];
const browserErrors = [];
const requestFailures = [];
const expectedRequestAborts = [];
const externalRequests = [];
const writeRequests = [];
const states = [];
const screenshots = [];
const interaction = {};

function check(label, condition, details = undefined) {
  const passed = Boolean(condition);
  const item = { label, passed, ...(details === undefined ? {} : { details }) };
  checks.push(item);
  if (!passed) failures.push({ label, details });
  return passed;
}

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function fixtureHashes() {
  return Object.fromEntries(
    await Promise.all(
      sourceFiles.map(async (name) => [name, hash(await readFile(join(capability.project, name)))]),
    ),
  );
}

function sanitizedRequest(request) {
  const url = new URL(request.url());
  return {
    method: request.method(),
    origin: url.origin,
    pathname: url.pathname.replace(/\/v1\/sessions\/[^/]+/g, '/v1/sessions/[session]'),
    resourceType: request.resourceType(),
  };
}

function sanitizedText(value) {
  let text = String(value ?? '');
  const secrets = [
    privateUrl.href,
    previewUrl.href,
    privateUrl.searchParams.get('session'),
    privateUrl.searchParams.get('token'),
    previewUrl.searchParams.get('__foundry_session'),
    previewUrl.searchParams.get('__foundry_token'),
  ].filter((secret) => typeof secret === 'string' && secret.length > 0);
  for (const secret of secrets) text = text.split(secret).join('[redacted]');
  return text
    .replace(/([?&](?:token|session|__foundry_token|__foundry_session)=)[^&\s)]+/gi, '$1[redacted]')
    .replace(/\/v1\/sessions\/[^/\s?]+/g, '/v1/sessions/[session]');
}

function observe(page, label, allowedOrigins) {
  page.on('pageerror', (error) =>
    browserErrors.push({ label, message: sanitizedText(error.message) }),
  );
  page.on('console', (message) => {
    if (message.type() === 'error')
      browserErrors.push({ label, message: sanitizedText(message.text()) });
  });
  page.on('requestfailed', (request) => {
    const record = {
      label,
      ...sanitizedRequest(request),
      error: sanitizedText(request.failure()?.errorText),
    };
    // Component filtering and context teardown replace/destroy verified gallery frames.
    // Chromium reports those intentional cancellations as ERR_ABORTED; retain them as
    // evidence without treating them as a network failure.
    if (record.error === 'net::ERR_ABORTED') expectedRequestAborts.push(record);
    else requestFailures.push(record);
  });
  page.on('request', (request) => {
    const record = { label, ...sanitizedRequest(request) };
    if (!allowedOrigins.has(record.origin)) externalRequests.push(record);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(record.method)) writeRequests.push(record);
  });
}

async function poll(value, timeout = 8_000, interval = 50) {
  const deadline = Date.now() + timeout;
  let current;
  while (Date.now() < deadline) {
    current = await value();
    if (current) return current;
    await new Promise((resolveWait) => setTimeout(resolveWait, interval));
  }
  throw new Error('Timed out waiting for a disposable Component Workshop condition.');
}

async function openWorkshop(page) {
  await page.locator('#live-status[data-status="live"]').waitFor({ timeout: 30_000 });
  await page.locator('#app-shell[data-next="true"]').waitFor({ timeout: 30_000 });
  if ((await page.locator('#app-shell').getAttribute('data-mode')) !== 'components') {
    await page.locator('[data-next-tools]:visible').first().click();
    await page.locator('#studio-navigation [data-workspace-mode="components"]').click();
  }
  await page.locator('[data-mode-surface="components"]:not([hidden])').waitFor();
  await page.getByRole('heading', { name: 'Component workshop' }).waitFor();
  await page.locator('#component-workshop-list [data-workshop-component]').first().waitFor();
}

async function selectPrimaryAction(page, { requireRendered = true } = {}) {
  const search = page.locator('#component-workshop-search');
  await search.fill('PrimaryAction');
  const component = page.locator('[data-workshop-component="morrow-primary-action"]');
  // Keyboard activation remains reachable even where the pre-pilot narrow layout lets
  // the center pane overlap the catalog's pointer hit area. That visual defect belongs
  // in the frozen screenshots rather than blocking baseline collection.
  await component.focus();
  await component.press('Enter');
  await page.getByRole('heading', { name: 'PrimaryAction' }).waitFor();
  await poll(
    async () => (await page.locator('[data-specimen-id]').count()) === expectedVariants.length,
  );
  let rendered = true;
  if (requireRendered) {
    for (const [id] of expectedVariants) {
      const card = page.locator(`[data-specimen-id="${id}"]`);
      await card.scrollIntoViewIfNeeded();
      try {
        await poll(
          async () =>
            (await card.locator('[data-specimen-status]').textContent()).trim() === 'Rendered',
          15_000,
        );
      } catch (error) {
        rendered = false;
      }
    }
  } else {
    try {
      await poll(
        async () =>
          (await page.locator('[data-specimen-status]').allTextContents()).every(
            (status) => status.trim() === 'Rendered',
          ),
        4_000,
      );
    } catch (error) {
      rendered = false;
    }
  }
  return { search, component, rendered };
}

async function selectVariant(page, id, name) {
  const specimen = page.locator(`[data-specimen-id="${id}"]`);
  await specimen.scrollIntoViewIfNeeded();
  const select = specimen.locator('[data-specimen-index]');
  await select.click();
  await poll(async () => (await select.getAttribute('aria-pressed')) === 'true');
  await poll(async () =>
    (await page.locator('#component-workshop-contract').textContent()).includes(
      `Selected variant${name}`,
    ),
  );
  return select;
}

async function measure(page, fixtureCase, theme) {
  return page.evaluate(
    ({ viewport, requestedTheme, requestedPhase }) => {
      const box = (selector) => {
        const element = document.querySelector(selector);
        if (!element || getComputedStyle(element).display === 'none') return null;
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        };
      };
      const variantCards = [...document.querySelectorAll('[data-specimen-id]')].map((card) => ({
        id: card.dataset.specimenId,
        name: card.querySelector('header strong')?.textContent.trim(),
        status: card.querySelector('[data-specimen-status]')?.textContent.trim(),
        measurement: card.querySelector('[data-specimen-measure]')?.textContent.trim(),
        selected: card.querySelector('[data-specimen-index]')?.getAttribute('aria-pressed'),
        ready: card.dataset.ready,
        selectDisabled: card.querySelector('[data-specimen-index]')?.disabled,
        note: card.querySelector('.next-specimen-note')?.textContent.trim(),
        retryVisible: !card.querySelector('[data-specimen-retry]')?.hidden,
        stage: box.call(
          null,
          `[data-specimen-id="${card.dataset.specimenId}"] .next-specimen-stage`,
        ),
        frame: box.call(null, `[data-specimen-id="${card.dataset.specimenId}"] iframe`),
        frameVisibility: getComputedStyle(card.querySelector('iframe')).visibility,
      }));
      const scopes = [...document.querySelectorAll('[data-workshop-scope]')].map((button) => ({
        id: button.dataset.workshopScope,
        pressed: button.getAttribute('aria-pressed'),
        disabled: button.disabled,
      }));
      const previewStates = [...document.querySelectorAll('[data-workshop-state]')].map(
        (button) => ({
          id: button.dataset.workshopState,
          pressed: button.getAttribute('aria-pressed'),
          disabled: button.disabled,
        }),
      );
      return {
        id: `${requestedTheme}-${viewport.id}`,
        viewport,
        requestedTheme,
        theme: document.documentElement.dataset.theme,
        foundationQuery: new URLSearchParams(location.search).get('foundations'),
        pilotGate: document.documentElement.dataset.foundryPilot ?? null,
        mode: document.querySelector('#app-shell')?.dataset.mode,
        document: {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          clientHeight: document.documentElement.clientHeight,
          scrollHeight: document.documentElement.scrollHeight,
        },
        boxes: {
          surface: box('.component-workshop-mode'),
          header: box('.component-workshop-mode > .mode-head'),
          shell: box('.component-workshop-shell'),
          browser: box('.component-workshop-browser'),
          center: box('.next-workshop-center'),
          detail: box('#component-workshop-detail'),
          contract: box('#component-workshop-contract'),
          footer: box('.component-workshop-footer'),
        },
        catalogCount: document.querySelectorAll('[data-workshop-component]').length,
        searchValue: document.querySelector('#component-workshop-search')?.value,
        component: document.querySelector('.next-gallery-heading h2')?.textContent.trim(),
        variantCards,
        scopes,
        previewStates,
        selectedVariantCopy: document
          .querySelector('#component-workshop-contract')
          ?.textContent.replace(/\s+/g, ' ')
          .trim(),
        sourceCopy: document
          .querySelector('[data-workshop-disclosure="source"]')
          ?.textContent.replace(/\s+/g, ' ')
          .trim(),
        reviewCount: Number(document.querySelector('#persistent-review-count')?.textContent ?? 0),
        expectedPhase: requestedPhase,
      };
    },
    { viewport: fixtureCase, requestedTheme: theme, requestedPhase: phase },
  );
}

async function exerciseWorkshop(page) {
  const reviewBefore = Number(await page.locator('#persistent-review-count').textContent());
  const hashesBefore = await fixtureHashes();
  const search = page.locator('#component-workshop-search');

  await search.fill('definitely-not-a-component');
  check(
    'Workshop search exposes an honest no-match state and clear action',
    (await page.locator('[data-workshop-component]').count()) === 0 &&
      (await page.locator('[data-clear-workshop-search]').isVisible()),
    {
      rows: await page.locator('[data-workshop-component]').count(),
      clearVisible: await page.locator('[data-clear-workshop-search]').isVisible(),
    },
  );
  await page.locator('[data-clear-workshop-search]').click();
  check(
    'Workshop clear-search action restores focus and the real catalog',
    (await search.evaluate((element) => element === document.activeElement)) &&
      (await page.locator('[data-workshop-component]').count()) >= 10,
    {
      focused: await search.evaluate((element) => element === document.activeElement),
      rows: await page.locator('[data-workshop-component]').count(),
    },
  );

  await selectPrimaryAction(page);
  for (const [id, name] of expectedVariants) {
    await selectVariant(page, id, name);
    check(
      `Workshop ${name} uses a rendered real-project preview and honest selected properties`,
      (
        await page.locator(`[data-specimen-id="${id}"] [data-specimen-status]`).textContent()
      ).trim() === 'Rendered' &&
        /448 × 52/.test(
          await page.locator(`[data-specimen-id="${id}"] [data-specimen-measure]`).textContent(),
        ) &&
        (await page.locator('#component-workshop-contract').textContent()).includes(name),
      {
        status: await page
          .locator(`[data-specimen-id="${id}"] [data-specimen-status]`)
          .textContent(),
        measurement: await page
          .locator(`[data-specimen-id="${id}"] [data-specimen-measure]`)
          .textContent(),
      },
    );
  }

  const scopeComponent = page.locator('[data-workshop-scope="component"]');
  const scopeInstance = page.locator('[data-workshop-scope="instance"]');
  check(
    'Workshop scope affordances expose instance, selected-variant and component scopes',
    !(await scopeComponent.isDisabled()) &&
      !(await page.locator('[data-workshop-scope="variant"]').isDisabled()) &&
      (await scopeInstance.getAttribute('aria-pressed')) === 'true',
    {
      componentDisabled: await scopeComponent.isDisabled(),
      variantDisabled: await page.locator('[data-workshop-scope="variant"]').isDisabled(),
      instancePressed: await scopeInstance.getAttribute('aria-pressed'),
    },
  );
  await scopeComponent.click();
  await poll(async () => (await scopeComponent.getAttribute('aria-pressed')) === 'true');
  await scopeInstance.click();
  await poll(async () => (await scopeInstance.getAttribute('aria-pressed')) === 'true');

  const loadingState = page.locator('[data-workshop-state="loading"]');
  const currentState = page.locator('[data-workshop-state="current"]');
  await loadingState.click();
  await poll(async () => (await loadingState.getAttribute('aria-pressed')) === 'true');
  await currentState.click();
  await poll(async () => (await currentState.getAttribute('aria-pressed')) === 'true');
  check(
    'Workshop preview state returns to Current without adding a design change',
    Number(await page.locator('#persistent-review-count').textContent()) === reviewBefore,
    { reviewBefore, reviewAfter: await page.locator('#persistent-review-count').textContent() },
  );

  const authoring = page.locator('[data-workshop-disclosure="authoring"]');
  const drift = page.locator('[data-workshop-disclosure="drift"]');
  const source = page.locator('[data-workshop-disclosure="source"]');
  await authoring.locator('summary').click();
  await drift.locator('summary').click();
  await source.locator('summary').click();
  await page.locator('[data-workshop-variant-label]').fill('Pilot draft');
  await page.locator('[data-workshop-variant-value]').fill('pilot-draft');
  await selectVariant(page, 'morrow-action-danger', 'Danger');
  check(
    'Workshop preserves draft fields and disclosures across a safe variant rerender',
    (await page.locator('[data-workshop-variant-label]').inputValue()) === 'Pilot draft' &&
      (await page.locator('[data-workshop-variant-value]').inputValue()) === 'pilot-draft' &&
      (await authoring.getAttribute('open')) !== null &&
      (await drift.getAttribute('open')) !== null &&
      (await source.getAttribute('open')) !== null,
    {
      label: await page.locator('[data-workshop-variant-label]').inputValue(),
      value: await page.locator('[data-workshop-variant-value]').inputValue(),
      disclosures: {
        authoring: await authoring.getAttribute('open'),
        drift: await drift.getAttribute('open'),
        source: await source.getAttribute('open'),
      },
    },
  );
  await page.locator('[data-workshop-variant-label]').fill('');
  await page.locator('[data-workshop-variant-value]').fill('');
  for (const details of [authoring, drift, source]) {
    if ((await details.getAttribute('open')) !== null) await details.locator('summary').click();
  }
  await selectVariant(page, 'morrow-action-quiet', 'Quiet');

  const hashesAfter = await fixtureHashes();
  check(
    'Workshop search, variants, state, scope and drafts do not modify source files',
    JSON.stringify(hashesAfter) === JSON.stringify(hashesBefore),
    { before: hashesBefore, after: hashesAfter },
  );
  check(
    'Workshop interaction leaves Review empty and never stages the draft',
    Number(await page.locator('#persistent-review-count').textContent()) === reviewBefore,
    { reviewBefore, reviewAfter: await page.locator('#persistent-review-count').textContent() },
  );
  Object.assign(interaction, {
    component: 'PrimaryAction',
    variants: expectedVariants.map(([, name]) => name),
    previewState: 'current',
    scope: 'instance',
    draft: 'cleared without staging',
    reviewBefore,
    reviewAfter: Number(await page.locator('#persistent-review-count').textContent()),
    sourceHashesBefore: hashesBefore,
    sourceHashesAfter: hashesAfter,
    applyInvoked: false,
  });
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
  const allowedOrigins = new Set([url.origin, previewUrl.origin]);
  await context.grantPermissions(['local-network-access'], { origin: url.origin });
  await context.grantPermissions(['local-network-access'], { origin: previewUrl.origin });
  observe(page, `${theme}-${fixtureCase.id}`, allowedOrigins);
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await openWorkshop(page);
  const catalogSearch = page.locator('#component-workshop-search');
  await catalogSearch.fill('');
  await poll(async () => (await page.locator('[data-workshop-component]').count()) >= 10);
  await page.waitForTimeout(200);
  const initialCatalogCount = await page.locator('[data-workshop-component]').count();
  const preview = await selectPrimaryAction(page, {
    requireRendered: phase === 'pilot' || fixtureCase.width > 390,
  });
  if (preview.rendered) await selectVariant(page, 'morrow-action-quiet', 'Quiet');
  await page.evaluate(() => {
    for (const selector of [
      '.component-workshop-mode',
      '.next-workshop-center',
      '.next-workshop-scroll',
      '.next-workshop-properties',
      '#component-workshop-contract',
    ]) {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollTop = 0;
        element.scrollLeft = 0;
      }
    }
  });
  await page.evaluate(
    () => new Promise((resolveFrame) => requestAnimationFrame(() => resolveFrame())),
  );
  await page.waitForTimeout(500);
  const state = await measure(page, fixtureCase, theme);
  state.previewReady = preview.rendered;
  state.initialCatalogCount = initialCatalogCount;
  states.push(state);

  check(
    `${state.id}: Component Workshop is the active real workspace`,
    state.mode === 'components',
    state,
  );
  check(`${state.id}: requested theme is active`, state.theme === theme, state.theme);
  check(
    `${state.id}: foundations query matches the validation phase`,
    phase === 'pilot' ? state.foundationQuery === null : state.foundationQuery === 'off',
    state.foundationQuery,
  );
  check(
    `${state.id}: real catalog filters to PrimaryAction from at least ten indexed components`,
    initialCatalogCount >= 10 && state.catalogCount === 1 && state.searchValue === 'PrimaryAction',
    { initialCatalogCount, filtered: state.catalogCount, query: state.searchValue },
  );
  check(
    `${state.id}: PrimaryAction exposes Primary, Quiet and Danger rendered previews`,
    phase === 'baseline' && !state.previewReady
      ? JSON.stringify(state.variantCards.map(({ id, name }) => [id, name])) ===
          JSON.stringify(expectedVariants)
      : JSON.stringify(state.variantCards.map(({ id, name }) => [id, name])) ===
          JSON.stringify(expectedVariants) &&
          state.variantCards.every(
            ({ status, measurement }) => status === 'Rendered' && /448 × 52/.test(measurement),
          ),
    state.variantCards,
  );
  if (phase === 'baseline' && !state.previewReady) {
    check(
      `${state.id}: baseline records unavailable narrow preview evidence without claiming a selected variant`,
      state.variantCards.every(({ selected }) => selected !== 'true') &&
        !/Selected variant/.test(state.selectedVariantCopy) &&
        /Canvas and source stay unchanged\./.test(state.selectedVariantCopy),
      { cards: state.variantCards, properties: state.selectedVariantCopy },
    );
  } else {
    check(
      `${state.id}: Quiet is selected and its properties are honest preview-only evidence`,
      state.variantCards.find(({ id }) => id === 'morrow-action-quiet')?.selected === 'true' &&
        /Selected variantQuiet/.test(state.selectedVariantCopy) &&
        /Gallery preview only\. No changes added to Review\./.test(state.selectedVariantCopy),
      state.selectedVariantCopy,
    );
  }
  check(
    `${state.id}: source mapping and preview boundaries remain explicit`,
    /(?:index\.html:247|style\.css:793)/.test(state.sourceCopy) &&
      /New variants are staged for Review/.test(state.sourceCopy) &&
      state.reviewCount === 0,
    { sourceCopy: state.sourceCopy, reviewCount: state.reviewCount },
  );
  const noHorizontalOverflow =
    state.document.scrollWidth <= state.document.clientWidth + 1 &&
    ['surface', 'shell', 'browser', 'center', 'detail', 'contract', 'footer'].every(
      (key) =>
        !state.boxes[key] || state.boxes[key].scrollWidth <= state.boxes[key].clientWidth + 1,
    );
  if (phase === 'pilot') {
    check(
      `${state.id}: Workshop has no document or region horizontal overflow`,
      noHorizontalOverflow,
      { document: state.document, boxes: state.boxes },
    );
  } else {
    check(`${state.id}: baseline records Workshop overflow geometry without normalizing it`, true, {
      noHorizontalOverflow,
      document: state.document,
      boxes: state.boxes,
    });
  }
  if (phase === 'pilot') {
    const b = state.boxes;
    const aligned = (a, c) => Math.abs(a - c) <= 1;
    const geometryMatches =
      fixtureCase.width >= 1100
        ? aligned(b.browser.right, b.header.left) &&
          aligned(b.header.left, b.center.left) &&
          aligned(b.center.right, b.contract.left) &&
          aligned(b.contract.right, b.header.right) &&
          aligned(b.footer.left, b.header.left) &&
          aligned(b.footer.right, b.header.right)
        : fixtureCase.width > 700
          ? aligned(b.browser.right, b.header.left) &&
            aligned(b.header.left, b.center.left) &&
            aligned(b.center.bottom, b.contract.top) &&
            aligned(b.contract.left, b.center.left) &&
            aligned(b.contract.right, b.center.right) &&
            aligned(b.footer.left, b.center.left)
          : aligned(b.browser.left, b.header.left) &&
            aligned(b.header.left, b.center.left) &&
            aligned(b.center.left, b.contract.left) &&
            aligned(b.contract.left, b.footer.left) &&
            aligned(b.browser.bottom, b.header.top) &&
            aligned(b.header.bottom, b.center.top) &&
            aligned(b.center.bottom, b.contract.top) &&
            aligned(b.contract.bottom, b.footer.top);
    check(`${state.id}: pilot grid regions meet without gaps or overlaps`, geometryMatches, b);
  }
  check(
    `${state.id}: Workshop footer closes the visible grid or reachable scroll content`,
    fixtureCase.width <= 700
      ? Math.abs(
          state.boxes.footer.bottom - (state.boxes.surface.top + state.boxes.surface.scrollHeight),
        ) <= 1
      : Math.abs(state.boxes.footer.bottom - state.boxes.surface.bottom) <= 1,
    { footer: state.boxes.footer, surface: state.boxes.surface },
  );

  const screenshot = `${theme}-${fixtureCase.id}.png`;
  await page.screenshot({ path: join(output, screenshot), fullPage: false });
  screenshots.push(screenshot);
  return { context, page };
}

const sourceHashesBeforeRun = await fixtureHashes();
const browser = await chromium.launch({ headless: true });
let fatalError;
try {
  for (const theme of themes) {
    for (const fixtureCase of cases) {
      const opened = await openCase(browser, fixtureCase, theme);
      try {
        if (theme === 'light' && fixtureCase.id === '1440') await exerciseWorkshop(opened.page);
      } finally {
        await opened.context.close();
      }
    }
  }
} catch (error) {
  fatalError = error;
  failures.push({
    label: 'Validator completed without an exception',
    details: sanitizedText(error.stack || error.message),
  });
} finally {
  await browser.close();
}

const sourceHashesAfterRun = await fixtureHashes();
check(
  'Entire Workshop validation leaves disposable fixture source unchanged',
  JSON.stringify(sourceHashesAfterRun) === JSON.stringify(sourceHashesBeforeRun),
  { before: sourceHashesBeforeRun, after: sourceHashesAfterRun },
);
const unexpectedApply = writeRequests.filter(({ pathname }) => /apply/i.test(pathname));
check('No source Apply endpoint was invoked', unexpectedApply.length === 0, unexpectedApply);
check('No external network origin was contacted', externalRequests.length === 0, externalRequests);
check('No browser page errors were recorded', browserErrors.length === 0, browserErrors);
check('No browser request failures were recorded', requestFailures.length === 0, requestFailures);

let baselineComparison;
if (phase === 'pilot') {
  const baseline = JSON.parse(await readFile(join(outputRoot, 'baseline', 'report.json'), 'utf8'));
  const beforeById = new Map(baseline.states.map((state) => [state.id, state]));
  const comparisons = states.map((state) => {
    const before = beforeById.get(state.id);
    return {
      id: state.id,
      found: Boolean(before),
      stable: Boolean(
        before &&
        JSON.stringify(before.variantCards.map(({ id, name }) => [id, name])) ===
          JSON.stringify(state.variantCards.map(({ id, name }) => [id, name])) &&
        JSON.stringify(before.previewStates.map(({ id }) => id)) ===
          JSON.stringify(state.previewStates.map(({ id }) => id)) &&
        JSON.stringify(before.scopes.map(({ id }) => id)) ===
          JSON.stringify(state.scopes.map(({ id }) => id)),
      ),
    };
  });
  baselineComparison = { comparisons };
  check(
    'Pilot preserves the frozen real catalog, variants, preview states and scope choices',
    comparisons.length === baseline.states.length &&
      comparisons.every(({ found, stable }) => found && stable),
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
    previewPort: Number(previewUrl.port),
    foundationQuery: phase === 'pilot' ? 'omitted (default)' : 'foundations=off',
    boundary:
      'Component search, local variant previews, preview state, scope and unstaged draft only. Apply was not invoked.',
    credentials:
      'Stored only in artifacts/foundry-workshop-pilot/preview-private.json with mode 0600; omitted from this report.',
  },
  counts: {
    passed: checks.filter(({ passed }) => passed).length,
    failed: failures.length,
    browserErrors: browserErrors.length,
    requestFailures: requestFailures.length,
    states: states.length,
  },
  checks,
  failures,
  browserErrors,
  requestFailures,
  expectedRequestAborts,
  externalRequests,
  writeRequests,
  sourceHashesBeforeRun,
  sourceHashesAfterRun,
  states,
  interaction,
  baselineComparison,
  screenshots,
  limitations: [
    'This validates the real disposable Morrow Workshop, not the user’s active Foundry session.',
    'Variant cards are live local previews; no source variant was staged or applied.',
    'The pilot comparison preserves behavior and evidence contracts but intentionally permits approved visual changes.',
  ],
};

const successful =
  !fatalError &&
  failures.length === 0 &&
  browserErrors.length === 0 &&
  requestFailures.length === 0;
const finalReportPath =
  phase === 'baseline' && !successful ? join(output, 'report.failed.json') : reportPath;
await writeFile(finalReportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `${phase} workshop validation: ${report.counts.passed} passed, ${report.counts.failed} failed, ${report.counts.browserErrors} browser errors, ${report.counts.states} states`,
);
if (!successful) process.exitCode = 1;
