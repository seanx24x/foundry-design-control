import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Use actual public CLI + adapter, but never the presenter's ports or fixture.
process.env.FOUNDRY_TEST_RUNTIME_URL ??= 'http://127.0.0.1:4587';
process.env.FOUNDRY_TEST_PREVIEW_URL ??= 'http://127.0.0.1:4590';
process.argv.push('--mode', 'workspace');
const h = await import('./test-real-golden-path.mjs');
const root = resolve(import.meta.dirname, '..');
const artifacts = join(root, 'artifacts/next-workspace');
mkdirSync(artifacts, { recursive: true });
const checks = [];
async function openCompactLibrary(page) {
  const toggle = page.locator('.craft-library-toggle:visible').first();
  if ((await toggle.count()) && (await toggle.getAttribute('aria-expanded')) === 'false') {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
}
async function visibleInspectorEntry(select) {
  return (await select.getAttribute('data-foundry-select')) === 'true'
    ? select.locator('..').locator('.foundry-select-trigger')
    : select;
}
// Exercise the visible chooser, preserving the native fallback for legacy UI.
async function chooseInspectorOption(select, value) {
  if ((await select.getAttribute('data-foundry-select')) !== 'true')
    return select.selectOption(value);
  const index = await select.evaluate(
    (node, chosen) => [...node.options].findIndex((option) => option.value === chosen),
    value,
  );
  assert.ok(index >= 0, `Missing option ${value}`);
  await select.locator('..').locator('.foundry-select-trigger').click();
  await select.page().locator(`.foundry-select-menu [data-option-index="${index}"]`).click();
}
const previewOnly = process.argv.includes('--preview');
const motionControlsOnly = process.argv.includes('--motion-controls');
const typographyControlsOnly = process.argv.includes('--typography-controls');
const systemControlsOnly = process.argv.includes('--system-controls');
const workshopControlsOnly = process.argv.includes('--workshop-controls');
const recipeControlsOnly = process.argv.includes('--recipe-controls');
const stateControlsOnly = process.argv.includes('--state-controls');
const responsiveControlsOnly = process.argv.includes('--responsive-controls');
const stressControlsOnly = process.argv.includes('--stress-controls');
const agentControlsOnly = process.argv.includes('--agent-controls');
const memoryControlsOnly = process.argv.includes('--memory-controls');
let memoryLedger, memoryDecision;
let agentLedger, agentRequest;
let stressLedger, stressOriginalText;
let responsiveLedger;
let stateLedger;
let capturedRecipeId, recipeLedgerBeforeCapture;
let workshopDefinition, workshopAxis, workshopQuiet, workshopOriginal;
let systemGraph, systemPlan;
let page;
let failed;
const commandTrace = [];
const check = async (name, action) => {
  if (memoryControlsOnly && !/^(Design Memory |no source files)/.test(name)) return;
  if (agentControlsOnly && !/^(Visual Agent |no source files)/.test(name)) return;
  if (stressControlsOnly && !/^(Content Stress |no source files)/.test(name)) return;
  if (responsiveControlsOnly && !/^(Responsive Lab |no source files)/.test(name)) return;
  if (stateControlsOnly && !/^(State Workbench |no source files)/.test(name)) return;
  if (recipeControlsOnly && !/^(Recipes |no source files)/.test(name)) return;
  if (workshopControlsOnly && !/^(Workshop |no source files)/.test(name)) return;
  if (systemControlsOnly && !/^(Design System |no source files)/.test(name)) return;
  if (typographyControlsOnly && !/^(Typography |no source files)/.test(name)) return;
  if (
    motionControlsOnly &&
    !/^(Motion |curve type |native curve |unrecognized native easing|failed Motion |no source files)/.test(
      name,
    )
  )
    return;
  await action();
  checks.push(name);
  console.log(`PASS ${name}`);
};
try {
  await h.assertPortFree(h.runtimePort);
  await h.assertPortFree(h.previewPort);
  const tooling = h.installTooling();
  const project = join(h.harnessRoot, 'morrow');
  const home = join(h.harnessRoot, 'home');
  mkdirSync(project);
  mkdirSync(home);
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
  ])
    cpSync(join(root, 'examples/web-fixture', file), join(project, file), { recursive: true });
  h.configureFixturePorts(project);
  writeFileSync(join(project, '.gitignore'), 'node_modules\ndist\n');
  h.initializeGit(project);
  symlinkSync(join(root, 'node_modules'), join(project, 'node_modules'), 'dir');
  const env = h.isolatedEnvironment(home);
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
      h.previewUrl,
      '--runtime-port',
      String(h.runtimePort),
      '--yes',
    ],
    env,
  );
  h.command(project, process.execPath, ['configure-foundry.mjs'], env);
  h.commitSetup(project);
  h.command(project, process.execPath, ['build.mjs'], env);
  h.startProcess('next-fixture', process.execPath, ['server.mjs'], {
    cwd: project,
    env: { ...process.env, ...env, FOUNDRY_FIXTURE_ROOT: 'dist' },
  });
  await h.waitForHttp(h.previewUrl, 'Morrow');
  const cli = h.startProcess(
    'next-cli',
    process.execPath,
    [
      tooling.cli,
      'start',
      '--project',
      project,
      '--runtime-port',
      String(h.runtimePort),
      '--new',
      '--no-open',
      '--no-dev',
    ],
    { cwd: project, env: { ...process.env, ...env } },
  );
  const workspace = await h.waitFor(
    () => cli.output().match(/^Workspace: (.+)$/m)?.[1],
    'workspace URL',
    30000,
  );
  const url = new URL(workspace);
  url.searchParams.delete('ui');
  url.searchParams.set('theme', 'light');
  const browser = await chromium.launch({ headless: true });
  h.ownedBrowsers.add(browser);
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    reducedMotion: 'reduce',
  });
  await context.grantPermissions(['local-network-access'], { origin: h.runtimeUrl });
  await context.grantPermissions(['local-network-access'], { origin: h.previewUrl });
  page = await context.newPage();
  await context.exposeBinding('__nextTestMessage', (_, message) => commandTrace.push(message));
  await context.addInitScript(() => {
    window.addEventListener('message', ({ data }) => {
      if (
        data?.command?.startsWith('inspector-') ||
        data?.command === 'motion-action' ||
        data?.command?.startsWith('typography-') ||
        data?.command === 'stage-token-promotion' ||
        data?.command === 'stage-component-variant' ||
        data?.command?.includes('visual-recipe') ||
        data?.command?.includes('health') ||
        data?.command?.includes('design-decision') ||
        data?.type === 'foundry:workspace-result'
      )
        window.__nextTestMessage({
          type: data.type,
          command: data.command,
          payload: data.payload,
          result: data.result,
          error: data.error,
        });
    });
  });
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error('Browser error:', error.message);
  });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#live-status')).toHaveAttribute('data-status', 'live', {
    timeout: 30000,
  });
  if (!previewOnly) {
    await check('default launch uses the redesigned UI with explicit legacy fallback', async () => {
      assert.equal(new URL(page.url()).searchParams.has('ui'), false);
      await expect(page.locator('#app-shell')).toHaveAttribute('data-next', 'true');
      const legacy = new URL(url);
      legacy.searchParams.set('ui', 'legacy');
      await page.goto(legacy.href, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#live-status')).toHaveAttribute('data-status', 'live', {
        timeout: 30000,
      });
      await expect(page.locator('#app-shell')).not.toHaveAttribute('data-next', 'true');
      await expect(page.locator('#next-tab-canvas')).toHaveCount(0);
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#live-status')).toHaveAttribute('data-status', 'live', {
        timeout: 30000,
      });
      await expect(page.locator('#app-shell')).toHaveAttribute('data-next', 'true');
    });
  }
  if (!previewOnly)
    await check('empty inspector retains fixed shell and selection guidance', async () => {
      await expect(page.locator('#inspector-dock')).toHaveAttribute(
        'data-selection-category',
        'empty',
      );
      await expect(page.locator('.next-empty')).toContainText('Choose a layer');
      assert.equal((await page.locator('.next-source-footer').boundingBox()).height, 44);
    });
  const frame = page.frameLocator('#product-preview');
  const title = frame.locator('[data-foundry-id="story-title"]');
  await title.click();
  await expect(page.locator('[data-next-field="fontSize"]')).toBeVisible();
  const fontSize = () => page.locator('[data-next-field="fontSize"]');
  const renderedSize = () =>
    title.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const session = {
    sessionId: url.searchParams.get('session'),
    token: url.searchParams.get('token'),
  };
  const changes = async () => {
    const response = await fetch(`${h.runtimeUrl}/v1/sessions/${session.sessionId}`, {
      headers: { 'x-foundry-token': session.token },
    });
    assert.ok(response.ok);
    const data = await response.json();
    return data.changeSet?.changes ?? data.session?.changeSet?.changes ?? [];
  };
  const before = await renderedSize();
  if (previewOnly) {
    // Local capability is written privately, never printed in release diagnostics.
    writeFileSync(join(artifacts, 'preview.json'), JSON.stringify({ url: url.href, project }), {
      mode: 0o600,
    });
    console.log(
      `Foundry Next preview ready on port ${h.runtimePort}. Press Ctrl-C to stop only this preview.`,
    );
    await browser.close();
    await new Promise((resolve) => {
      process.once('SIGINT', resolve);
      process.once('SIGTERM', resolve);
    });
  } else {
    await check('320px Layers, 300px Inspector, fixed header and footer', async () => {
      assert.equal((await page.locator('#layers-dock').boundingBox()).width, 320);
      assert.equal((await page.locator('#inspector-dock').boundingBox()).width, 300);
      assert.equal((await page.locator('#inspector-dock .dock-head').boundingBox()).height, 44);
      assert.equal((await page.locator('.next-source-footer').boundingBox()).height, 44);
      assert.equal(
        await page
          .locator('.next-field:visible')
          .first()
          .evaluate((el) => el.getBoundingClientRect().height),
        32,
      );
      assert.equal(
        (await page.locator('[data-property="fontSize"] .next-field').boundingBox()).width,
        268,
      );
      assert.equal(
        (await page.locator('[data-property="fontFamily"] .next-field').boundingBox()).width,
        268,
      );
    });
    await check('stale-target commands are rejected without mutation', async () => {
      const result = await page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const requestId = crypto.randomUUID();
            const iframe = document.querySelector('#product-preview');
            const timer = setTimeout(() => {
              window.removeEventListener('message', receive);
              reject(new Error('No acknowledgement'));
            }, 5000);
            const receive = ({ data, source }) => {
              if (
                source !== iframe.contentWindow ||
                data?.requestId !== requestId ||
                data.type !== 'foundry:workspace-result'
              )
                return;
              clearTimeout(timer);
              window.removeEventListener('message', receive);
              resolve({ ok: data.ok, error: data.error });
            };
            window.addEventListener('message', receive);
            iframe.contentWindow.postMessage(
              {
                type: 'foundry:workspace-command',
                sessionId: new URLSearchParams(location.search).get('session'),
                requestId,
                command: 'inspector-draft',
                payload: {
                  targetId: 'not-the-selected-layer',
                  property: 'fontSize',
                  action: 'preview',
                  value: 100,
                },
              },
              new URL(iframe.src).origin,
            );
          }),
      );
      assert.equal(result.ok, false);
      assert.match(result.error, /selection changed/i);
      assert.equal(await renderedSize(), before);
      assert.equal((await changes()).length, 0);
    });
    await check('temporary preview and Escape restore exact style', async () => {
      const style = await title.getAttribute('style');
      await fontSize().fill(String(before + 4));
      await expect.poll(renderedSize).toBe(before + 4);
      assert.equal((await changes()).length, 0);
      await fontSize().press('Escape');
      await expect.poll(renderedSize).toBe(before);
      await expect.poll(() => title.getAttribute('style')).toBe(style);
      assert.equal((await changes()).length, 0);
    });
    await check('Enter adds one change and reset restores', async () => {
      await fontSize().fill(String(before + 4));
      await fontSize().press('Enter');
      await expect.poll(renderedSize).toBe(before + 4);
      await expect.poll(async () => (await changes()).length).toBe(1);
      await expect(page.locator('[data-reset="fontSize"]')).toBeVisible();
      await page.locator('[data-reset="fontSize"]').click();
      await expect.poll(renderedSize).toBe(before);
    });
    await check('invalid numeric input stays visible with correction', async () => {
      await fontSize().fill('not a size');
      await fontSize().press('Enter');
      await expect(fontSize()).toHaveValue('not a size');
      await expect(page.locator('.next-edit-error')).toContainText('Enter a number');
      assert.equal(await renderedSize(), before);
      await fontSize().press('Escape');
    });
    await check('inline expansion preserves header and footer', async () => {
      const footer = await page.locator('.next-source-footer').boundingBox();
      await page.locator('[data-more="Typography"]').click();
      await expect(page.locator('[data-next-field="fontVariationSettings"]')).toBeVisible();
      assert.deepEqual(await page.locator('.next-source-footer').boundingBox(), footer);
    });
    await check('project font preview and cancel leave ledger unchanged', async () => {
      const count = (await changes()).length;
      const family = await title.evaluate((el) => getComputedStyle(el).fontFamily);
      await page.locator('[data-font-picker]').click();
      const option = page.locator('.next-font-options button').first();
      await option.click();
      await expect(page.locator('.next-font-status')).toContainText('Previewing');
      await page.locator('.next-font-picker footer [data-cancel]').click();
      await expect.poll(() => title.evaluate((el) => getComputedStyle(el).fontFamily)).toBe(family);
      assert.equal((await changes()).length, count);
    });
    await check('Focus and Canvas return preserve selection', async () => {
      await page.locator('.next-focus').click();
      await expect(page.locator('[data-next-focus-tab]')).toBeVisible();
      await page.locator('[data-next-canvas]').click();
      await expect(page.locator('[data-next-focus-tab]')).toBeHidden();
      await expect(fontSize()).toHaveValue(String(before));
    });
    await check('Use font creates one real font change and preserves fallbacks', async () => {
      const family = await title.evaluate((el) => getComputedStyle(el).fontFamily);
      await page.locator('[data-font-picker]').click();
      await page
        .locator('.next-font-options button')
        .filter({ hasText: 'Morrow Sans' })
        .first()
        .click();
      await expect(page.locator('.next-font-status')).toContainText('Previewing');
      await page.locator('.next-font-picker [data-use]').click();
      await expect(page.locator('.next-font-picker')).toHaveCount(0);
      await expect
        .poll(
          async () => (await changes()).filter((change) => change.property === 'fontFamily').length,
        )
        .toBe(1);
      await expect
        .poll(() => title.evaluate((el) => getComputedStyle(el).fontFamily))
        .toContain('sans-serif');
      await page.locator('[data-reset="fontFamily"]').click();
      await expect.poll(() => title.evaluate((el) => getComputedStyle(el).fontFamily)).toBe(family);
      await expect(page.locator('[data-reset="fontFamily"]')).toHaveCount(0);
    });
    await check('one scrub creates one undoable preview operation', async () => {
      await fontSize().focus();
      await expect(fontSize()).toBeFocused();
      const scrub = await page.locator('[data-property="fontSize"] .next-scrub').boundingBox();
      await page.mouse.move(scrub.x + 16, scrub.y + 16);
      await page.mouse.down();
      await page.mouse.move(scrub.x + 24, scrub.y + 16, { steps: 4 });
      await page.mouse.up();
      await expect.poll(renderedSize).toBe(before + 8);
      await page.locator('#undo').click();
      await expect.poll(renderedSize).toBe(before);
      await expect(fontSize()).toHaveValue(String(before));
      await expect(page.locator('[data-reset="fontSize"]')).toHaveCount(0);
    });
    await check('numeric label click opens exact entry without adding to Review', async () => {
      const count = (await changes()).length;
      await page.locator('[data-property="fontSize"] .next-scrub').click();
      await expect(fontSize()).toBeFocused();
      assert.equal(
        await fontSize().evaluate((el) => el.selectionEnd - el.selectionStart),
        String(before).length,
      );
      assert.equal((await changes()).length, count);
      const originalInput = await fontSize().elementHandle();
      await fontSize().press('Escape');
      await expect.poll(() => originalInput.evaluate((el) => !el.isConnected)).toBe(true);
      await expect(fontSize()).toBeFocused();
    });
    await check('scrubbing previews while held and Escape cancels without recording', async () => {
      const count = (await changes()).length;
      await fontSize().focus();
      await expect(fontSize()).toBeFocused();
      await page.locator('[data-property="fontSize"] .next-scrub').hover();
      const box = await page.locator('[data-property="fontSize"] .next-scrub').boundingBox();
      await page.mouse.move(box.x + 12, box.y + 12);
      await page.mouse.down();
      await page.mouse.move(box.x + 32, box.y + 12, { steps: 8 });
      await expect.poll(renderedSize).toBe(before + 20);
      await expect(page.locator('[data-property="fontSize"] .next-field')).toHaveAttribute(
        'data-scrubbing',
        '',
      );
      assert.equal((await changes()).length, count);
      const originalInput = await fontSize().elementHandle();
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect.poll(renderedSize).toBe(before);
      await expect.poll(() => originalInput.evaluate((el) => !el.isConnected)).toBe(true);
      await expect(page.locator('[data-property="fontSize"] .next-field')).not.toHaveAttribute(
        'data-scrubbing',
      );
      assert.equal((await changes()).length, count);
    });
    await check('lost pointer capture cancels instead of accepting a numeric drag', async () => {
      const count = (await changes()).length;
      const scrub = page.locator('[data-property="fontSize"] .next-scrub');
      await fontSize().focus();
      await expect(fontSize()).toBeFocused();
      // A pre-drag snapshot may replace the idle handle. Capture the actual
      // pointer event at document scope rather than on a soon-stale node.
      await page.evaluate(() =>
        document.addEventListener(
          'pointerdown',
          (event) => {
            window.testScrubPointerId = event.pointerId;
          },
          { once: true, capture: true },
        ),
      );
      const box = await scrub.boundingBox();
      await page.mouse.move(box.x + 12, box.y + 12);
      await page.mouse.down();
      await page.mouse.move(box.x + 22, box.y + 12, { steps: 4 });
      await expect.poll(renderedSize).toBe(before + 10);
      const originalInput = await fontSize().elementHandle();
      await scrub.evaluate((el) => el.releasePointerCapture(window.testScrubPointerId));
      await page.mouse.up();
      await expect.poll(renderedSize).toBe(before);
      await expect.poll(() => originalInput.evaluate((el) => !el.isConnected)).toBe(true);
      assert.equal((await changes()).length, count);
    });
    await check('keyboard nudges preserve decimals and remain drafts until Enter', async () => {
      const count = (await changes()).length;
      const unrelated = (await changes()).filter((item) => item.property !== 'fontSize');
      await fontSize().fill(String(before + 0.25));
      await fontSize().press('Alt+ArrowUp');
      await expect(fontSize()).toHaveValue(String(before + 0.35));
      await expect.poll(renderedSize).toBe(before + 0.35);
      assert.equal((await changes()).length, count);
      await fontSize().press('Shift+ArrowUp');
      await expect(fontSize()).toHaveValue(String(before + 10.35));
      const originalInput = await fontSize().elementHandle();
      await fontSize().press('Escape');
      await expect.poll(renderedSize).toBe(before);
      await expect.poll(() => originalInput.evaluate((el) => !el.isConnected)).toBe(true);
      await expect(fontSize()).toBeFocused();
      await fontSize().press('ArrowUp');
      await fontSize().press('Enter');
      await expect.poll(renderedSize).toBe(before + 1);
      await expect
        .poll(
          async () =>
            (await changes()).filter(
              (item) => item.property === 'fontSize' && Number(item.after) === before + 1,
            ).length,
        )
        .toBe(1);
      assert.deepEqual(
        (await changes()).filter((item) => item.property !== 'fontSize'),
        unrelated,
      );
      await page.locator('#undo').click();
      await expect.poll(renderedSize).toBe(before);
    });
    // All selections and edits go through the authenticated parent/preview bridge.
    const send = (command, payload = {}) =>
      page.evaluate(
        ({ command, payload }) =>
          new Promise((resolve, reject) => {
            const iframe = document.querySelector('#product-preview');
            const requestId = crypto.randomUUID();
            const timer = setTimeout(() => {
              window.removeEventListener('message', receive);
              reject(new Error('No acknowledgement'));
            }, 5000);
            function receive({ source, data }) {
              if (
                source !== iframe.contentWindow ||
                data?.requestId !== requestId ||
                data.type !== 'foundry:workspace-result'
              )
                return;
              clearTimeout(timer);
              window.removeEventListener('message', receive);
              data.ok === false ? reject(new Error(data.error)) : resolve(data.payload);
            }
            window.addEventListener('message', receive);
            iframe.contentWindow.postMessage(
              {
                type: 'foundry:workspace-command',
                sessionId: new URLSearchParams(location.search).get('session'),
                requestId,
                command,
                payload,
              },
              new URL(iframe.src).origin,
            );
          }),
        { command, payload },
      );
    const select = async (selector, additive = false) => {
      await send('select', { selector, additive });
      await expect.poll(async () => (await send('request-state')).selection?.selector).toBeTruthy();
    };
    const open = async (name) => {
      const button = page.locator(`[data-section="${name}"]`);
      if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
    };
    const edit = async (property, value) => {
      if (property === 'objectPosition') {
        await page.getByRole('button', { name: 'Edit object position', exact: true }).click();
        const css = page.getByRole('textbox', { name: 'Object position CSS', exact: true });
        if (!(await css.isVisible())) await page.locator('.next-position-css summary').click();
        await css.fill(String(value));
        await page.getByRole('button', { name: 'Use position', exact: true }).click();
        await expect(page.locator(`[data-property="${property}"].is-changed`)).toBeVisible();
        await expect(page.locator('.next-edit-error')).toBeHidden();
        return;
      }
      const input = page.locator(`[data-next-field="${property}"]`);
      await input.fill(String(value));
      await input.press('Enter');
      await expect(page.locator(`[data-property="${property}"].is-changed`)).toBeVisible();
      await expect(page.locator('.next-edit-error')).toBeHidden();
    };
    await check(
      'fractional measurements stay exact while idle fields and scrubs use whole numbers',
      async () => {
        // Supplemental specimen: a computed fraction, not an authored inline edit.
        await frame.locator('body').evaluate((body) => {
          const style = document.createElement('style');
          style.textContent = '#next-number-test { font-size:70.293px; width:210.293px; }';
          const element = document.createElement('p');
          element.id = 'next-number-test';
          element.textContent = 'Inspector number precision';
          body.append(style, element);
        });
        const specimen = frame.locator('#next-number-test');
        await select('#next-number-test');
        const original = await specimen.getAttribute('style');
        await expect(fontSize()).toHaveValue('70');
        await fontSize().focus();
        await expect(fontSize()).toHaveValue('70');
        await expect(fontSize()).toHaveAttribute('title', 'Measured: 70.293px');
        await page.locator('.next-source-footer').focus();
        await expect(fontSize()).toHaveValue('70');
        assert.equal(await specimen.getAttribute('style'), original);
        await edit('fontSize', '70.625');
        await expect(fontSize()).toHaveValue('70.625');
        await expect(specimen).toHaveCSS('font-size', '70.625px');
        await select('[data-foundry-id="story-title"]');
        await select('#next-number-test');
        await expect(fontSize()).toHaveValue('70.625');
        await send('undo');
        await expect(fontSize()).toHaveValue('70');
        for (const modifier of [null, 'Alt', 'Shift']) {
          await page.locator('.next-source-footer').focus();
          await fontSize().focus();
          await expect(fontSize()).toBeFocused();
          const box = await page.locator('[data-property="fontSize"] .next-scrub').boundingBox();
          if (modifier) await page.keyboard.down(modifier);
          await page.mouse.move(box.x + 12, box.y + 12);
          await page.mouse.down();
          await page.mouse.move(box.x + 20, box.y + 12, { steps: 4 });
          await page.mouse.up();
          if (modifier) await page.keyboard.up(modifier);
          const expected = modifier === 'Shift' ? 150 : modifier === 'Alt' ? 71 : 78;
          await expect(specimen).toHaveCSS('font-size', `${expected}px`);
          await expect(fontSize()).toHaveValue(String(expected));
          await expect(page.locator('[data-property="fontSize"].is-changed')).toBeVisible();
          await send('undo');
          await expect.poll(() => specimen.getAttribute('style')).toBe(original);
          await expect(page.locator('[data-property="fontSize"].is-changed')).toHaveCount(0);
        }
        await open('Layout');
        await edit('width', '213.293');
        await expect(page.locator('[data-next-field="width"]')).toHaveValue('213.293');
        assert.equal(await specimen.evaluate((el) => el.style.width), '213.293px');
        await send('undo');
        await expect.poll(() => specimen.getAttribute('style')).toBe(original);
        await select('[data-foundry-id="story-title"]');
      },
    );
    await check(
      'opacity displays percentages and writes normalized CSS without losing typed decimals',
      async () => {
        await open('Appearance');
        const original = await title.getAttribute('style');
        const opacity = page.locator('[data-next-field="opacity"]');
        await expect(opacity).toHaveValue('100');
        await expect(page.locator('[data-property="opacity"] .next-field')).toHaveAttribute(
          'data-bounded',
          '',
        );
        await expect(page.locator('[data-property="fontSize"] .next-field')).not.toHaveAttribute(
          'data-bounded',
        );
        await edit('opacity', '75.5');
        await expect(title).toHaveCSS('opacity', '0.755');
        await expect(opacity).toHaveValue('75.5');
        assert.equal(
          await page
            .locator('[data-property="opacity"] .next-field')
            .evaluate((el) => el.style.getPropertyValue('--fd-control-fill')),
          '75.5%',
        );
        await opacity.focus();
        await expect(opacity).toBeFocused();
        await page.screenshot({ path: join(artifacts, 'numeric-opacity.png') });
        await send('undo');
        await expect.poll(() => title.getAttribute('style')).toBe(original);
      },
    );
    await check(
      'color picker previews, cancels, validates, accepts once and undoes exactly',
      async () => {
        await open('Appearance');
        const original = await title.getAttribute('style');
        const originalColor = await title.evaluate((el) => getComputedStyle(el).color);
        const count = (await changes()).length;
        const trigger = page.locator('[data-color-picker="color"]');
        const dialog = page.locator('.next-color-picker');
        await trigger.click();
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('[data-use]')).toBeDisabled();
        assert.equal(await title.getAttribute('style'), original);
        const plane = dialog.locator('.next-color-plane');
        await plane.click({ position: { x: 60, y: 70 } });
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await expect
          .poll(() => title.evaluate((el) => getComputedStyle(el).color))
          .not.toBe(originalColor);
        assert.equal((await changes()).length, count);
        await plane.press('ArrowRight');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect.poll(() => title.getAttribute('style')).toBe(original);
        await expect(trigger).toBeFocused();
        await trigger.click();
        const colorValue = dialog.locator('[data-color-value]');
        await colorValue.fill('not-a-color');
        await expect(colorValue).toHaveAttribute('aria-invalid', 'true');
        await expect(dialog.locator('[data-use]')).toBeDisabled();
        await colorValue.fill('#204060');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await dialog.locator('[data-alpha-value]').fill('50');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await expect(title).toHaveCSS('color', 'rgba(32, 64, 96, 0.5)');
        assert.equal((await changes()).length, count);
        for (const theme of ['light', 'dark']) {
          await page.locator('html').evaluate((el, theme) => {
            el.dataset.theme = theme;
          }, theme);
          for (const height of [768, 1080]) {
            await page.setViewportSize({ width: 1600, height });
            await expect
              .poll(async () => {
                const bounds = await dialog.boundingBox();
                return (
                  bounds.x >= 8 &&
                  bounds.y >= 8 &&
                  bounds.x + bounds.width <= 1592 &&
                  bounds.y + bounds.height <= height - 8
                );
              })
              .toBe(true);
            assert.equal(await dialog.evaluate((el) => el.scrollWidth > el.clientWidth), false);
            await page.screenshot({ path: join(artifacts, `color-picker-${theme}-${height}.png`) });
          }
        }
        await page.locator('html').evaluate((el) => {
          el.dataset.theme = 'light';
        });
        await dialog.locator('[data-use]').click();
        await expect(dialog).toHaveCount(0);
        await expect.poll(async () => (await changes()).length).toBe(count + 1);
        await send('undo');
        await expect.poll(() => title.getAttribute('style')).toBe(original);
        await trigger.click();
        await dialog.locator('[data-color-value]').fill('transparent');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await expect(dialog.locator('[data-alpha-value]')).toHaveValue('0');
        await dialog.locator('footer [data-cancel]').click();
        await expect.poll(() => title.getAttribute('style')).toBe(original);
      },
    );
    await check('color format views preserve Original without preview or acceptance', async () => {
      const original = await title.getAttribute('style'),
        ledger = await changes();
      await page.locator('[data-color-picker="color"]').click();
      const dialog = page.locator('.next-color-picker');
      const raw = await dialog.locator('[data-color-value]').inputValue();
      for (const format of ['hex', 'rgb', 'hsl', 'css']) {
        await dialog.locator(`[data-color-format="${format}"]`).click();
        await expect(dialog.locator('[data-use]')).toBeDisabled();
        assert.equal(await title.getAttribute('style'), original);
        assert.deepEqual(await changes(), ledger);
      }
      await expect(dialog.locator('[data-color-value]')).toHaveValue(raw);
      await dialog.locator('footer [data-cancel]').click();
      await expect(dialog).toHaveCount(0);
    });
    await check(
      'RGB channels validate ranges, preserve decimal alpha and cancel exactly',
      async () => {
        const original = await title.getAttribute('style'),
          ledger = await changes();
        await page.locator('[data-color-picker="color"]').click();
        const dialog = page.locator('.next-color-picker');
        await dialog.locator('[data-color-format="rgb"]').click();
        await dialog.locator('[data-color-channel="0"]').fill('64');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await expect(title).toHaveCSS('color', 'rgb(64, 35, 31)');
        await dialog.locator('[data-color-channel="0"]').fill('300');
        await expect(dialog.locator('[data-use]')).toBeDisabled();
        await expect(dialog.locator('[role=status]')).toContainText('0 to 255');
        await expect(dialog.locator('[data-color-format="hsl"]')).toBeDisabled();
        await dialog.locator('[data-color-channel="0"]').fill('64');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await dialog.locator('[data-alpha-value]').fill('50.3');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        const alphaReference = await frame.locator('body').evaluate((body) => {
          const el = document.createElement('span');
          el.style.color = 'rgb(64 35 31 / 50.3%)';
          body.append(el);
          const color = getComputedStyle(el).color;
          el.remove();
          return color;
        });
        await expect
          .poll(() =>
            commandTrace.some(
              (item) =>
                item.command === 'inspector-draft' &&
                item.payload?.value === 'rgb(64 35 31 / 50.3%)',
            ),
          )
          .toBe(true);
        await expect(title).toHaveCSS('color', alphaReference);
        await dialog.locator('[data-color-format="hsl"]').click();
        await expect(dialog.locator('[data-alpha-value]')).toHaveValue('50.3');
        await expect(title).toHaveCSS('color', alphaReference);
        assert.deepEqual(await changes(), ledger);
        await page.screenshot({ path: join(artifacts, 'color-format-channels.png') });
        const viewport = page.viewportSize(),
          theme = await page.locator('html').getAttribute('data-theme');
        for (const colorTheme of ['light', 'dark']) {
          await page
            .locator('html')
            .evaluate((el, theme) => (el.dataset.theme = theme), colorTheme);
          await page.setViewportSize({ width: 390, height: 844 });
          await expect
            .poll(async () => {
              const box = await dialog.boundingBox();
              return (
                box.x >= 8 && box.y >= 8 && box.x + box.width <= 382 && box.y + box.height <= 836
              );
            })
            .toBe(true);
          assert.equal(await dialog.evaluate((el) => el.scrollWidth > el.clientWidth), false);
          await page.screenshot({ path: join(artifacts, `color-channels-${colorTheme}-390.png`) });
        }
        await page.locator('html').evaluate((el, theme) => (el.dataset.theme = theme), theme);
        await page.setViewportSize(viewport);
        await dialog.locator('footer [data-cancel]').click();
        await expect.poll(() => title.getAttribute('style')).toBe(original);
      },
    );
    await check(
      'HSL edit records one native color change and Undo restores the exact original',
      async () => {
        const original = await title.getAttribute('style');
        await page.locator('[data-color-picker="color"]').click();
        const dialog = page.locator('.next-color-picker');
        await dialog.locator('[data-color-value]').fill('red');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await dialog.locator('[data-color-format="hsl"]').click();
        await expect(dialog.locator('[data-color-channel="1"]')).toHaveValue('100');
        await dialog.locator('[data-color-channel="0"]').fill('120');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await expect(title).toHaveCSS('color', 'rgb(0, 255, 0)');
        await dialog.locator('[data-use]').click();
        await expect(dialog).toHaveCount(0);
        await expect(page.locator('[data-property="color"].is-changed')).toBeVisible();
        await send('undo');
        await expect.poll(() => title.getAttribute('style')).toBe(original);
      },
    );
    await check(
      'wide-gamut CSS stays in Original instead of silently converting to sRGB',
      async () => {
        if (!(await page.evaluate(() => CSS.supports('color', 'color(display-p3 1 0 0 / .4)'))))
          return;
        const original = await title.getAttribute('style'),
          ledger = await changes();
        await page.locator('[data-color-picker="color"]').click();
        const dialog = page.locator('.next-color-picker');
        await dialog.locator('[data-color-value]').fill('color(display-p3 1 0 0 / .4)');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        for (const format of ['hex', 'rgb', 'hsl'])
          await expect(dialog.locator(`[data-color-format="${format}"]`)).toBeDisabled();
        await expect(dialog.locator('[data-color-value]')).toHaveValue(
          'color(display-p3 1 0 0 / .4)',
        );
        assert.deepEqual(await changes(), ledger);
        await dialog.locator('footer [data-cancel]').click();
        await expect.poll(() => title.getAttribute('style')).toBe(original);
      },
    );
    await check(
      'background and border pickers share the same cancellable editing flow',
      async () => {
        await select('.social-actions');
        await open('Appearance');
        const more = page.locator('[data-more="Appearance"]');
        if ((await more.getAttribute('aria-expanded')) !== 'true') await more.click();
        const target = frame.locator('.social-actions');
        const original = await target.getAttribute('style');
        for (const property of ['backgroundColor', 'borderColor']) {
          if (
            property === 'borderColor' &&
            (await page.locator('[data-reveal-border]').isVisible()) &&
            !(await page.locator('[data-color-picker="borderColor"]').isVisible())
          )
            await page.locator('[data-reveal-border]').click();
          await page.locator(`[data-color-picker="${property}"]`).click();
          const dialog = page.locator('.next-color-picker');
          await dialog.locator('[data-color-value]').fill('#abcdef');
          await expect(dialog.locator('[data-use]')).toBeEnabled();
          await dialog.locator('footer [data-cancel]').click();
          await expect.poll(() => target.getAttribute('style')).toBe(original);
        }
      },
    );
    await check(
      'mixed color picker never applies its initial value and restores every original',
      async () => {
        await frame.locator('body').evaluate((body) => {
          for (const [id, color] of [
            ['one', 'red'],
            ['two', 'blue'],
          ]) {
            const element = document.createElement('p');
            element.id = `next-color-${id}`;
            element.textContent = `Mixed color ${id}`;
            element.style.color = color;
            body.append(element);
          }
        });
        await select('#next-color-one');
        await select('#next-color-two', true);
        await open('Appearance');
        const targets = frame.locator('#next-color-one, #next-color-two');
        const originals = await targets.evaluateAll((els) =>
          els.map((el) => el.getAttribute('style')),
        );
        const count = (await changes()).length;
        const trigger = page.locator('[data-color-picker="color"]');
        await expect(trigger).toHaveClass(/is-mixed/);
        await trigger.click();
        const dialog = page.locator('.next-color-picker');
        await expect(dialog.locator('[data-color-value]')).toHaveValue('');
        await expect(dialog.locator('[data-use]')).toBeDisabled();
        assert.deepEqual(
          await targets.evaluateAll((els) => els.map((el) => el.getAttribute('style'))),
          originals,
        );
        await dialog.locator('[data-color-value]').fill('#204060');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await dialog.locator('[data-use]').click();
        await expect(dialog).toHaveCount(0);
        await expect.poll(async () => (await changes()).length).toBe(count + 2);
        await send('undo');
        await expect
          .poll(() => targets.evaluateAll((els) => els.map((el) => el.getAttribute('style'))))
          .toEqual(originals);
        await select('[data-foundry-id="story-title"]');
      },
    );
    await check('container controls preview, restore and remember category expansion', async () => {
      await select('.social-actions');
      await expect(page.locator('#inspector-dock')).toHaveAttribute(
        'data-selection-category',
        'container',
      );
      const target = frame.locator('.social-actions');
      const original = await target.getAttribute('style');
      const count = (await changes()).length;
      const gap = page.locator('[data-next-field="gap"]');
      await gap.fill('28');
      await expect.poll(() => target.evaluate((el) => getComputedStyle(el).gap)).toBe('28px');
      assert.equal((await changes()).length, count);
      await gap.press('Escape');
      await expect.poll(() => target.getAttribute('style')).toBe(original);
      await page.locator('[data-section="Layout"]').click();
      await select('[data-foundry-id="story-title"]');
      await expect(page.locator('[data-section="Typography"]')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await select('.social-actions');
      await expect(page.locator('[data-section="Layout"]')).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      await open('Layout');
    });
    await check(
      'section restore lists captured fields; Cancel is read-only and other sections survive',
      async () => {
        await frame.locator('body').evaluate((body) => {
          const el = document.createElement('p');
          el.id = 'next-section-restore-fixture';
          el.textContent = 'Captured values specimen';
          el.style.cssText = 'font-size:20px;font-weight:400;color:rgb(10,20,30);width:240px;';
          body.append(el);
        });
        await select('#next-section-restore-fixture');
        await open('Typography');
        const target = frame.locator('#next-section-restore-fixture');
        await edit('fontSize', 24);
        await edit('fontWeight', '600');
        await open('Appearance');
        await edit('color', '#3157ff');
        const before = await target.getAttribute('style'),
          ledger = await changes();
        await page.locator('[data-section-restore="Typography"]').click();
        const dialog = page.locator('.next-section-restore-dialog');
        await expect(dialog.locator('li')).toHaveCount(2);
        await expect(dialog).toContainText('24px → 20px');
        await expect(dialog).toContainText('600 → 400');
        await expect(dialog).toContainText('separately undoable');
        const viewport = page.viewportSize(),
          theme = await page.locator('html').getAttribute('data-theme');
        for (const restoreTheme of ['light', 'dark']) {
          await page
            .locator('html')
            .evaluate((el, theme) => (el.dataset.theme = theme), restoreTheme);
          await page.setViewportSize({ width: 390, height: 844 });
          await expect
            .poll(async () => {
              const box = await dialog.boundingBox();
              return (
                box.x >= 8 && box.y >= 8 && box.x + box.width <= 382 && box.y + box.height <= 836
              );
            })
            .toBe(true);
          assert.equal(await dialog.evaluate((el) => el.scrollWidth > el.clientWidth), false);
          await page.screenshot({
            path: join(artifacts, `section-restore-${restoreTheme}-390.png`),
          });
        }
        await page.locator('html').evaluate((el, theme) => (el.dataset.theme = theme), theme);
        await page.setViewportSize(viewport);
        await dialog.locator('[data-close-restore]').click();
        assert.equal(await target.getAttribute('style'), before);
        assert.deepEqual(await changes(), ledger);
        await page.locator('[data-section-restore="Typography"]').click();
        await expect(dialog).toBeVisible();
        await select('[data-foundry-id="story-title"]');
        await expect(dialog).toHaveCount(0);
        assert.equal(await target.getAttribute('style'), before);
        assert.deepEqual(await changes(), ledger);
        await select('#next-section-restore-fixture');
        await open('Typography');
        await page.locator('[data-section-restore="Typography"]').click();
        await dialog.locator('[data-confirm-restore]').click();
        await expect(dialog.locator('[role=status]')).toContainText('Restored 2 captured fields');
        await expect(target).toHaveCSS('font-size', '20px');
        await expect(target).toHaveCSS('font-weight', '400');
        await expect(target).toHaveCSS('color', 'rgb(49, 87, 255)');
        await expect(dialog.locator('[data-close-restore]')).toBeEnabled();
        await expect(dialog).not.toHaveAttribute('aria-busy');
        await expect(page.locator('[data-next-field="fontSize"]')).toHaveValue('20');
        await expect(page.locator('[data-next-field="fontWeight"]')).toHaveValue('400');
        await page.screenshot({ path: join(artifacts, 'section-restore.png') });
        await dialog.locator('[data-close-restore]').click();
        await expect(page.locator('[data-section-restore="Typography"]')).toHaveCount(0);
        await expect(page.locator('[data-section-restore="Appearance"]')).toBeVisible();
        await send('undo');
        await expect(target).toHaveCSS('font-weight', '600');
        await expect(target).toHaveCSS('font-size', '20px');
        await send('undo');
        await expect(target).toHaveCSS('font-size', '24px');
        for (let i = 0; i < 3; i++) await send('undo');
        await expect(target).toHaveCSS('font-size', '20px');
        await expect(target).toHaveCSS('font-weight', '400');
        await expect(target).toHaveCSS('color', 'rgb(10, 20, 30)');
        // Undo's adapter acknowledgement arrives before its refreshed Inspector
        // snapshot. The next edit must start from the visible restored baseline.
        await expect(page.locator('[data-next-field="fontSize"]')).toHaveValue('20');
        await expect(page.locator('[data-next-field="fontWeight"]')).toHaveValue('400');
      },
    );
    await check(
      'section restore stops on a failed save, reports exact progress and never duplicates while pending',
      async () => {
        const target = frame.locator('#next-section-restore-fixture');
        await open('Typography');
        await edit('fontSize', 25);
        await edit('fontWeight', '600');
        await page.locator('[data-section-restore="Typography"]').click();
        const dialog = page.locator('.next-section-restore-dialog');
        let posts = 0,
          release;
        await context.route('**/change-records', async (route) => {
          posts++;
          if (posts === 1) {
            await new Promise((resolve) => (release = resolve));
            await route.continue();
          } else
            await route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Test: second restore failed' }),
            });
        });
        await dialog.locator('[data-confirm-restore]').click();
        await expect.poll(() => posts).toBe(1);
        await expect(dialog).toHaveAttribute('aria-busy', 'true');
        await expect(dialog.locator('[data-confirm-restore]')).toBeDisabled();
        await expect(dialog.locator('[data-close-restore]')).toBeDisabled();
        await dialog.locator('[data-confirm-restore]').dispatchEvent('click');
        assert.equal(posts, 1);
        release();
        await expect(dialog.locator('[role=status]')).toContainText('Restored 1 of 2 fields');
        await expect(dialog.locator('[role=status]')).toContainText(
          'Nothing retries automatically',
        );
        assert.equal(posts, 2);
        await expect(target).toHaveCSS('font-size', '20px');
        await expect(target).toHaveCSS('font-weight', '600');
        await context.unroute('**/change-records');
        await dialog.locator('[data-close-restore]').click();
        await page.locator('[data-section-restore="Typography"]').click();
        await expect(dialog.locator('li')).toHaveCount(1);
        await dialog.locator('[data-confirm-restore]').click();
        await expect(dialog.locator('[role=status]')).toContainText('Restored 1 captured field');
        await dialog.locator('[data-close-restore]').click();
        await expect(target).toHaveCSS('font-size', '20px');
        await expect(target).toHaveCSS('font-weight', '400');
      },
    );
    await check(
      'mixed and linked section restores require Undo rather than flatten originals',
      async () => {
        await frame.locator('body').evaluate((body) => {
          for (const [id, size] of [
            ['next-restore-one', 20],
            ['next-restore-two', 22],
          ]) {
            const el = document.createElement('p');
            el.id = id;
            el.textContent = id;
            el.style.cssText = `font-size:${size}px;padding:8px;`;
            body.append(el);
          }
        });
        await select('#next-restore-one');
        await select('#next-restore-two', true);
        await open('Typography');
        await edit('fontSize', 24);
        const ledger = await changes();
        await expect(page.locator('[data-section-restore="Typography"]')).toHaveAttribute(
          'aria-disabled',
          'true',
        );
        await page.locator('[data-section-restore="Typography"]').dispatchEvent('click');
        await expect(page.locator('.next-edit-error')).toContainText('Use Undo');
        await expect(page.locator('.next-section-restore-dialog')).toHaveCount(0);
        assert.deepEqual(await changes(), ledger);
        await send('undo');
        await expect(frame.locator('#next-restore-one')).toHaveCSS('font-size', '20px');
        await expect(frame.locator('#next-restore-two')).toHaveCSS('font-size', '22px');
        await select('#next-restore-one');
        await open('Layout');
        await edit('paddingHorizontal', 16);
        await expect(page.locator('[data-section-restore="Layout"]')).toHaveAttribute(
          'aria-disabled',
          'true',
        );
        await page.locator('[data-section-restore="Layout"]').dispatchEvent('click');
        await expect(page.locator('.next-edit-error')).toContainText('Use Undo');
        await expect(page.locator('.next-section-restore-dialog')).toHaveCount(0);
        await send('undo');
        await expect(frame.locator('#next-restore-one')).toHaveCSS('padding', '8px');
      },
    );
    await check(
      'native gradient capture is view-only; editing previews and Cancel restores exact inline CSS',
      async () => {
        await frame.locator('body').evaluate((body) => {
          const el = document.createElement('div');
          el.id = 'next-gradient-fixture';
          el.textContent = 'Gradient surface';
          el.style.cssText =
            'width:360px;height:160px;background-color:rgb(20,30,40);background-image:linear-gradient(90deg, #3157ff 0%, #7597de 50%, #c9e4ff 100%);';
          body.append(el);
        });
        await select('#next-gradient-fixture');
        await open('Appearance');
        const target = frame.locator('#next-gradient-fixture');
        const before = await target.getAttribute('style');
        const ledger = await changes();
        const trace = commandTrace.length;
        await page.locator('[data-gradient-picker]').click();
        const dialog = page.locator('.next-gradient-editor');
        await expect(dialog.locator('[data-angle]')).toHaveValue('90');
        await expect(dialog.locator('[data-stop-color]')).toHaveCount(3);
        await expect(dialog.locator('[data-use]')).toBeDisabled();
        assert.deepEqual(await changes(), ledger);
        assert.equal(
          commandTrace.slice(trace).filter((entry) => entry.command === 'inspector-draft').length,
          0,
        );
        await dialog.locator('[data-angle]').fill('125.25');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await expect(target).toHaveCSS('background-image', /125\.25deg/);
        await expect(target).toHaveCSS('background-color', 'rgb(20, 30, 40)');
        await dialog.locator('[data-cancel]').last().click();
        await expect(dialog).toHaveCount(0);
        await expect(target).toHaveAttribute('style', before);
        assert.deepEqual(await changes(), ledger);
      },
    );
    await check(
      'gradient stop dragging, keyboard positioning and color edits accept only one native Review change',
      async () => {
        const target = frame.locator('#next-gradient-fixture');
        const before = await target.getAttribute('style');
        const ledger = await changes();
        await page.locator('[data-gradient-picker]').click();
        const dialog = page.locator('.next-gradient-editor');
        const handle = dialog.locator('[data-gradient-stop="1"]');
        await handle.focus();
        await expect(handle).toBeFocused();
        // Wait for anchored modal geometry before measuring a manual drag.
        await handle.hover();
        const track = await dialog.locator('.next-gradient-track').boundingBox();
        const box = await handle.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(track.x + track.width * 0.65, box.y + box.height / 2, { steps: 12 });
        await page.mouse.up();
        await expect
          .poll(async () => Number(await handle.getAttribute('aria-valuenow')))
          .toBeGreaterThan(60);
        const releasedPosition = await handle.getAttribute('aria-valuenow');
        const releasedBox = await handle.boundingBox();
        await page.mouse.move(
          releasedBox.x + releasedBox.width / 2,
          releasedBox.y + releasedBox.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(track.x + track.width * 0.8, releasedBox.y + releasedBox.height / 2, {
          steps: 6,
        });
        await expect
          .poll(async () => Number(await handle.getAttribute('aria-valuenow')))
          .toBeGreaterThan(75);
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await expect(handle).toHaveAttribute('aria-valuenow', releasedPosition);
        await page.mouse.up();
        assert.deepEqual(await changes(), ledger);
        await handle.press('End');
        await expect(handle).toHaveAttribute('aria-valuenow', '100');
        await handle.press('Home');
        await expect(handle).toHaveAttribute('aria-valuenow', '0');
        await dialog.locator('[data-stop-position]').nth(1).fill('62.5');
        await dialog.locator('[data-stop-color]').nth(1).fill('rgb(12.25 20 30 / 50.3%)');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        assert.deepEqual(await changes(), ledger);
        await dialog.locator('[data-use]').click();
        await expect(dialog).toHaveCount(0);
        await expect(page.locator('[data-property="backgroundImage"]')).toHaveClass(/is-changed/);
        const after = await changes();
        assert.equal(after.length, ledger.length + 1);
        assert.equal(after.at(-1).property, 'backgroundImage');
        await expect(target).toHaveCSS('background-image', /62\.5%/);
        await expect(target).toHaveCSS('background-color', 'rgb(20, 30, 40)');
        await send('undo');
        await expect(target).toHaveAttribute('style', before);
      },
    );
    await check(
      'gradient stop add/remove and invalid drafts remain cancellable in light, dark and phone layouts',
      async () => {
        await page.locator('[data-gradient-picker]').click();
        const dialog = page.locator('.next-gradient-editor');
        await dialog.locator('[data-add]').click();
        await expect(dialog.locator('[data-stop-color]')).toHaveCount(4);
        await dialog.locator('[data-remove-stop]').nth(1).click();
        await expect(dialog.locator('[data-stop-color]')).toHaveCount(3);
        await dialog.locator('[data-stop-position]').nth(1).fill('101');
        await expect(dialog.locator('[data-use]')).toBeDisabled();
        await expect(dialog.locator('[role="status"]')).toContainText('ordered positions');
        await dialog.locator('[data-stop-position]').nth(1).fill('50');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await dialog.locator('[data-angle]').fill('bad');
        await expect(dialog.locator('[data-use]')).toBeDisabled();
        await dialog.locator('[data-stop-color]').first().fill('#3157ff');
        await expect(dialog.locator('[data-use]')).toBeDisabled();
        await dialog.locator('[data-angle]').fill('110');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        for (const gradientTheme of ['light', 'dark']) {
          await page
            .locator('html')
            .evaluate((el, theme) => (el.dataset.theme = theme), gradientTheme);
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
            await expect
              .poll(async () => {
                const rect = await dialog.boundingBox();
                return (
                  rect.x >= 0 &&
                  rect.y >= 0 &&
                  rect.x + rect.width <= width &&
                  rect.y + rect.height <= (width === 390 ? 844 : 1000)
                );
              })
              .toBe(true);
            assert.equal(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
            await page.screenshot({
              path: join(artifacts, `gradient-editor-${gradientTheme}-${width}.png`),
            });
          }
        }
        await dialog.press('Escape');
        await expect(dialog).toHaveCount(0);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.locator('html').evaluate((el) => (el.dataset.theme = 'light'));
      },
    );
    await check(
      'explicit gradient removal and creation preserve the independent background color',
      async () => {
        const target = frame.locator('#next-gradient-fixture');
        const original = await target.getAttribute('style');
        await page.locator('[data-gradient-picker]').click();
        const dialog = page.locator('.next-gradient-editor');
        await dialog.locator('[data-remove-gradient]').click();
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await expect(target).toHaveCSS('background-image', 'none');
        await dialog.locator('[data-cancel]').last().click();
        await expect(dialog).toHaveCount(0);
        await expect(target).toHaveAttribute('style', original);
        await target.evaluate((el) => (el.style.backgroundImage = 'none'));
        await select('[data-foundry-id="story-title"]');
        await select('#next-gradient-fixture');
        await open('Appearance');
        await page.locator('[data-gradient-picker]').click();
        await expect(dialog.locator('[data-create]')).toBeVisible();
        await expect(dialog.locator('[data-use]')).toBeDisabled();
        await dialog.locator('[data-create]').click();
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await dialog.locator('[data-use]').click();
        await expect(dialog).toHaveCount(0);
        await expect(target).toHaveCSS('background-image', /linear-gradient/);
        await expect(target).toHaveCSS('background-color', 'rgb(20, 30, 40)');
        await send('undo');
        await expect(target).toHaveCSS('background-image', 'none');
      },
    );
    await check(
      'layered and wide-gamut fills are inspectable but never replaced or normalized',
      async () => {
        const target = frame.locator('#next-gradient-fixture');
        for (const css of [
          'linear-gradient(red,blue), radial-gradient(white,black)',
          'linear-gradient(color(display-p3 1 0 0),color(display-p3 0 1 0))',
        ]) {
          await target.evaluate((el, value) => (el.style.backgroundImage = value), css);
          await select('[data-foundry-id="story-title"]');
          await select('#next-gradient-fixture');
          await open('Appearance');
          const before = await target.getAttribute('style');
          const ledger = await changes();
          await page.locator('[data-gradient-picker]').click();
          const dialog = page.locator('.next-gradient-editor');
          await expect(dialog.locator('[role="status"]')).toContainText('This fill is preserved');
          await expect(dialog.locator('[data-create]')).toBeHidden();
          await expect(dialog.locator('[data-angle]')).toBeHidden();
          await expect(dialog.locator('[data-use]')).toBeDisabled();
          await dialog.locator('[data-cancel]').last().click();
          await expect(dialog).toHaveCount(0);
          await expect(target).toHaveAttribute('style', before);
          assert.deepEqual(await changes(), ledger);
        }
      },
    );
    await check(
      'failed gradient save restores the native fill and requires fresh preview acknowledgment',
      async () => {
        const target = frame.locator('#next-gradient-fixture');
        await target.evaluate(
          (el) => (el.style.backgroundImage = 'linear-gradient(90deg,red,blue)'),
        );
        await select('[data-foundry-id="story-title"]');
        await select('#next-gradient-fixture');
        await open('Appearance');
        const before = await target.getAttribute('style');
        const ledger = await changes();
        await page.locator('[data-gradient-picker]').click();
        const dialog = page.locator('.next-gradient-editor');
        await dialog.locator('[data-angle]').fill('45');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        let posts = 0,
          release;
        await context.route('**/change-records', async (route) => {
          posts++;
          await new Promise((resolve) => (release = resolve));
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Test: gradient save failed' }),
          });
        });
        await dialog.locator('[data-use]').click();
        await expect.poll(() => posts).toBe(1);
        await expect(dialog.locator('[data-use]')).toBeDisabled();
        await dialog.locator('[data-use]').dispatchEvent('click');
        assert.equal(posts, 1);
        release();
        await expect(dialog.locator('[role="status"]')).toContainText('preview was restored');
        await expect(dialog.locator('[data-use]')).toBeDisabled();
        await expect(target).toHaveAttribute('style', before);
        assert.deepEqual(await changes(), ledger);
        await context.unroute('**/change-records');
        await dialog.locator('[data-retry]').click();
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await dialog.locator('[data-cancel]').last().click();
        await expect(dialog).toHaveCount(0);
      },
    );
    await check(
      'mixed gradient originals stay intact and selection changes dismiss drafts',
      async () => {
        const target = frame.locator('#next-gradient-fixture');
        await select('#next-gradient-fixture');
        await open('Appearance');
        const before = await target.getAttribute('style');
        const ledger = await changes();
        await page.locator('[data-gradient-picker]').click();
        const dialog = page.locator('.next-gradient-editor');
        await dialog.locator('[data-angle]').fill('150');
        await expect(dialog.locator('[data-use]')).toBeEnabled();
        await select('[data-foundry-id="story-title"]');
        await expect(dialog).toHaveCount(0);
        await expect(target).toHaveAttribute('style', before);
        assert.deepEqual(await changes(), ledger);
        await select('#next-gradient-fixture', true);
        await open('Appearance');
        await page.locator('[data-gradient-picker]').click();
        await expect(dialog.locator('pre')).toHaveText('Mixed background images');
        await expect(dialog.locator('[data-angle]')).toBeHidden();
        await expect(dialog.locator('[data-create]')).toBeHidden();
        await expect(dialog.locator('[data-use]')).toBeDisabled();
        await dialog.locator('[data-cancel]').last().click();
        await expect(dialog).toHaveCount(0);
        await expect(target).toHaveAttribute('style', before);
        assert.deepEqual(await changes(), ledger);
      },
    );
    await check(
      'Motion Studio captures fractional native timing and keeps local previews out of Review',
      async () => {
        await frame.locator('body').evaluate((body) => {
          const el = document.createElement('div');
          el.id = 'next-motion-fixture';
          el.textContent = 'Authored motion';
          el.style.cssText = 'width:220px;height:80px;background:#3157ff;color:white;';
          body.append(el);
          window.__motionControlFixture = el.animate(
            [
              { opacity: 0.2, transform: 'translateY(12px)' },
              { opacity: 1, transform: 'translateY(0px)' },
            ],
            {
              duration: 425.75,
              delay: -12.5,
              iterations: 2,
              fill: 'both',
              easing: 'cubic-bezier(.16,1,.3,1)',
            },
          );
          window.__motionControlFixture.pause();
          window.__motionControlFixture.currentTime = 180;
        });
        await select('#next-motion-fixture');
        await page.locator('.foundry-workspace-switcher:visible').first().click();
        await page.locator('#studio-navigation [data-workspace-mode="motion"]').click();
        await expect(page.locator('#app-shell')).toHaveAttribute('data-mode', 'motion');
        await expect(page.locator('[data-studio-property="duration"]')).toHaveValue('425.75');
        await expect(page.locator('[data-studio-property="delay"]')).toHaveValue('-12.5');
        await expect(page.locator('[data-curve-preset="ease-out"]')).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await expect(page.locator('[data-motion-section="timing-options"]')).not.toHaveAttribute(
          'open',
          '',
        );
        const before = await changes();
        await page.locator('[data-curve-preview]').click();
        await page.locator('[data-studio-action="scrub"]').fill('200');
        await expect
          .poll(() =>
            frame
              .locator('#next-motion-fixture')
              .evaluate(() => window.__motionControlFixture.currentTime),
          )
          .toBe(200);
        assert.deepEqual(await changes(), before);
      },
    );
    await check(
      'Motion timing rejects empty drafts, cancels locally and records exact fractional edits',
      async () => {
        const duration = page.locator('[data-studio-property="duration"]');
        const before = await changes();
        await duration.fill('');
        await duration.press('Enter');
        await expect(duration).toHaveAttribute('aria-invalid', 'true');
        assert.deepEqual(await changes(), before);
        await duration.press('Escape');
        await expect(duration).toHaveValue('425.75');
        await duration.fill('600.125');
        await duration.press('Enter');
        await expect
          .poll(() =>
            frame
              .locator('#next-motion-fixture')
              .evaluate(() => window.__motionControlFixture.effect.getTiming().duration),
          )
          .toBe(600.125);
        await expect
          .poll(async () =>
            (await changes()).some(
              (change) => change.property.endsWith('.duration') && Number(change.after) === 600.125,
            ),
          )
          .toBe(true);
        await page.locator('[data-studio-action="toggle"]').focus();
        await page.locator('[data-motion-section="timing-options"] > summary').click();
        await expect(page.locator('[data-studio-property="iterations"]')).toHaveValue('2');
      },
    );
    await check(
      'curve type and preset choices reflect actual parameters without resetting the current type',
      async () => {
        const ledger = await changes();
        const trace = commandTrace.length;
        await page.locator('[data-curve-kind-select="cubic-bezier"]').click();
        assert.deepEqual(await changes(), ledger);
        assert.equal(
          commandTrace
            .slice(trace)
            .filter(
              (entry) => entry.command === 'motion-action' && entry.payload?.action === 'curve',
            ).length,
          0,
        );
        await page.locator('[data-curve-preset="ease-in-out"]').click();
        assert.deepEqual(await changes(), ledger);
        await expect(page.locator('[data-use-easing]')).toBeEnabled();
        await page.locator('[data-use-easing]').click();
        await expect(page.locator('[data-curve-preset="ease-in-out"]')).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await expect
          .poll(async () =>
            (await changes()).some(
              (change) => change.property.endsWith('.easing') && /0.65/.test(change.after),
            ),
          )
          .toBe(true);
        await page.locator('[data-curve-kind-select="spring"]').click();
        await expect(page.locator('.motion-curve-editor')).toHaveAttribute(
          'data-curve-kind',
          'spring',
        );
        await expect(page.locator('[data-curve-preset][aria-pressed="true"]')).toHaveCount(0);
        await page.locator('[data-curve-preset="gentle"]').click();
        await expect(page.locator('[data-curve-preset="gentle"]')).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await expect(page.locator('[data-curve-field="stiffness"]')).toHaveValue('120');
        await page.locator('[data-use-easing]').click();
        await expect(page.locator('.motion-curve-editor')).toHaveAttribute(
          'data-easing-busy',
          'false',
        );
        await page.locator('[data-curve-kind-select="cubic-bezier"]').click();
        await page.locator('[data-use-easing]').click();
        await expect(page.locator('.motion-curve-editor')).toHaveAttribute(
          'data-easing-busy',
          'false',
        );
        await expect(page.locator('[data-curve-handle="1"]')).toBeVisible();
      },
    );
    await check(
      'failed Motion preset save restores the native easing and leaves Review unchanged',
      async () => {
        const before = await frame
          .locator('#next-motion-fixture')
          .evaluate(() => window.__motionControlFixture.effect.getTiming().easing);
        const ledger = await changes();
        let posts = 0;
        await context.route('**/change-records', (route) => {
          posts++;
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Test: Motion save unavailable' }),
          });
        });
        await page.locator('[data-curve-preset="linear"]').click();
        assert.equal(posts, 0);
        await page.locator('[data-use-easing]').click();
        await expect(page.locator('#toast')).toContainText('could not be recorded');
        assert.equal(posts, 1);
        assert.deepEqual(await changes(), ledger);
        await expect
          .poll(() =>
            frame
              .locator('#next-motion-fixture')
              .evaluate(() => window.__motionControlFixture.effect.getTiming().easing),
          )
          .toBe(before);
        await context.unroute('**/change-records');
        await expect(page.locator('[data-easing-status]')).toContainText('draft is retained');
        await page.locator('[data-cancel-easing]').click();
        await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
      },
    );
    await check(
      'Motion easing Cancel discards only the local draft and external changes require reinspection',
      async () => {
        const ledger = await changes();
        const before = await frame
          .locator('#next-motion-fixture')
          .evaluate(() => window.__motionControlFixture.effect.getTiming().easing);
        await page.locator('[data-curve-preset="linear"]').click();
        await expect(page.locator('.motion-curve-editor')).toHaveAttribute(
          'data-easing-draft',
          'true',
        );
        await expect(page.locator('[data-studio-action="motion-preview"]')).toBeDisabled();
        assert.equal(
          await frame
            .locator('#next-motion-fixture')
            .evaluate(() => window.__motionControlFixture.effect.getTiming().easing),
          before,
        );
        await page.locator('[data-cancel-easing]').click();
        await expect(page.locator('.motion-curve-editor')).toHaveAttribute(
          'data-easing-draft',
          'false',
        );
        assert.deepEqual(await changes(), ledger);
        await page.locator('[data-curve-preset="linear"]').click();
        await frame
          .locator('#next-motion-fixture')
          .evaluate(() => window.__motionControlFixture.effect.updateTiming({ easing: 'ease-in' }));
        await select('#next-motion-fixture');
        await expect(page.locator('[data-easing-status]')).toContainText('Current easing changed');
        await expect(page.locator('[data-use-easing]')).toBeDisabled();
        await page.locator('[data-cancel-easing]').click();
        await frame
          .locator('#next-motion-fixture')
          .evaluate(
            (_, easing) => window.__motionControlFixture.effect.updateTiming({ easing }),
            before,
          );
        await select('#next-motion-fixture');
        assert.deepEqual(await changes(), ledger);
      },
    );
    await check(
      'native curve handles preserve the grab point and cancel without adding to Review',
      async () => {
        const handle = page.locator('[data-curve-handle="1"]');
        const original = await page.locator('[data-curve-field="x1"]').inputValue();
        const ledger = await changes();
        await page.locator('[data-curve-field="x1"]').fill('');
        await page.locator('[data-curve-field="x1"]').press('Enter');
        await expect(page.locator('[data-curve-field="x1"]')).toHaveAttribute(
          'aria-invalid',
          'true',
        );
        assert.deepEqual(await changes(), ledger);
        await page.locator('[data-curve-field="x1"]').press('Escape');
        await expect(page.locator('[data-curve-field="x1"]')).toHaveValue(original);
        await handle.hover();
        const box = await handle.boundingBox();
        await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2);
        await page.mouse.down();
        await expect(page.locator('[data-curve-field="x1"]')).toHaveValue(original);
        await page.mouse.move(box.x + box.width / 2 + 22, box.y + box.height / 2 - 12, {
          steps: 8,
        });
        await expect(page.locator('[data-curve-field="x1"]')).not.toHaveValue(original);
        await page.keyboard.press('Escape');
        await page.mouse.up();
        await expect(page.locator('[data-curve-field="x1"]')).toHaveValue(original);
        assert.deepEqual(await changes(), ledger);
        await handle.hover();
        const current = await handle.boundingBox();
        await page.mouse.move(current.x + current.width / 2, current.y + current.height / 2);
        await page.mouse.down();
        await page.mouse.move(current.x + current.width / 2 + 24, current.y + current.height / 2, {
          steps: 8,
        });
        await expect(page.locator('[data-curve-field="x1"]')).not.toHaveValue(original);
        const trace = commandTrace.length;
        await page.mouse.up();
        assert.deepEqual(await changes(), ledger);
        assert.equal(
          commandTrace
            .slice(trace)
            .filter(
              (entry) => entry.command === 'motion-action' && entry.payload?.action === 'curve',
            ).length,
          0,
        );
        await page.locator('[data-use-easing]').click();
        await expect
          .poll(
            () =>
              commandTrace
                .slice(trace)
                .filter(
                  (entry) => entry.command === 'motion-action' && entry.payload?.action === 'curve',
                ).length,
          )
          .toBe(1);
        await expect
          .poll(async () =>
            frame
              .locator('#next-motion-fixture')
              .evaluate(() => window.__motionControlFixture.effect.getTiming().easing),
          )
          .not.toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');
      },
    );
    await check(
      'Motion controls stay readable and bounded in both themes and phone layouts',
      async () => {
        for (const theme of ['light', 'dark']) {
          for (
            let i = 0;
            i < 3 && (await page.locator('html').getAttribute('data-theme')) !== theme;
            i++
          ) {
            await page.locator('#workspace-menu-trigger').click();
            await page.locator('[data-theme-choice]').click();
          }
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
            await expect
              .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
              .toBe(true);
            const content = page.locator('.next-motion-scroll');
            const library = page.locator('[data-craft-library="motion"]');
            if (width === 390) {
              await expect(library.locator('.craft-library-toggle')).toHaveAttribute(
                'aria-expanded',
                'false',
              );
              assert.ok((await library.boundingBox()).height < 170);
              await library.locator('.craft-library-toggle').focus();
              await page.keyboard.press('Enter');
              await expect(library).toHaveAttribute('data-craft-library-open', 'true');
              await expect(library.locator('input[type="search"]')).toBeVisible();
              await page.keyboard.press('Enter');
              await expect(library).toHaveAttribute('data-craft-library-open', 'false');
            } else {
              assert.equal(Math.round((await library.boundingBox()).width), 320);
            }
            await content.evaluate((el) => (el.scrollTop = 0));
            // Snapshot scrolling is not a gesture. The native bridge can replace
            // this panel after an acknowledged edit; do not retain its old node
            // through Playwright's animated-scroll stability wait.
            if (width === 390)
              await page
                .locator('.motion-curve-fields')
                .evaluate((el) => el.scrollIntoView({ block: 'center' }));
            const graph = await page.locator('.motion-curve-graph svg').boundingBox();
            assert.ok(Math.abs(graph.width / graph.height - 240 / 156) < 0.01);
            await expect
              .poll(() =>
                page
                  .locator('[data-curve-field]')
                  .evaluateAll((fields) => fields.map((field) => getComputedStyle(field).fontSize)),
              )
              .toEqual(['12px', '12px', '12px', '12px']);
            await expect
              .poll(() =>
                page
                  .locator('.motion-curve-editor header strong')
                  .evaluate((el) => getComputedStyle(el).color),
              )
              .toBe(theme === 'light' ? 'rgb(32, 32, 32)' : 'rgb(245, 245, 245)');
            await page.evaluate(async () => {
              await document.fonts.ready;
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
            });
            await page.screenshot({
              path: join(artifacts, `motion-controls-${theme}-${width}.png`),
            });
            if (width === 390) {
              await page
                .locator('.motion-timing-section')
                .evaluate((el) => el.scrollIntoView({ block: 'center' }));
              await expect
                .poll(() =>
                  page
                    .locator('[data-studio-property="iterations"]')
                    .evaluate(
                      (el) => getComputedStyle(el.closest('label').querySelector('span')).color,
                    ),
                )
                .toBe(theme === 'light' ? 'rgb(104, 104, 104)' : 'rgb(163, 163, 163)');
              await page.evaluate(
                () =>
                  new Promise((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve)),
                  ),
              );
              await page.screenshot({ path: join(artifacts, `motion-timing-${theme}-390.png`) });
            }
            const direction = page
              .locator('[data-studio-property="direction"]')
              .locator('..')
              .locator('.foundry-select-trigger');
            await direction.click();
            const menuBox = await page.locator('.foundry-select-menu:visible').boundingBox();
            const fieldBox = await direction.locator('xpath=ancestor::label').boundingBox();
            assert.ok(Math.abs(menuBox.width - fieldBox.width) < 2);
            await page.keyboard.press('Escape');
          }
        }
        await page.setViewportSize({ width: 1600, height: 1000 });
        for (
          let i = 0;
          i < 3 && (await page.locator('html').getAttribute('data-theme')) !== 'light';
          i++
        ) {
          await page.locator('#workspace-menu-trigger').click();
          await page.locator('[data-theme-choice]').click();
        }
      },
    );
    await check(
      'unrecognized native easing stays captured until an explicit complete preset replaces it',
      async () => {
        await frame.locator('#next-motion-fixture').evaluate((el) => {
          window.__motionControlFixture.cancel();
          window.__motionControlFixture = el.animate([{ opacity: 0.2 }, { opacity: 1 }], {
            duration: 500,
            fill: 'both',
            easing: 'steps(4, end)',
          });
          window.__motionControlFixture.pause();
          window.__motionControlFixture.currentTime = 100;
        });
        await select('[data-foundry-id="story-title"]');
        await select('#next-motion-fixture');
        await expect(page.locator('.motion-curve-editor')).toHaveAttribute(
          'data-curve-kind',
          'custom',
        );
        await expect(page.locator('[data-curve-field]')).toHaveCount(0);
        await expect(page.locator('[data-curve-kind-select][aria-pressed="true"]')).toHaveCount(0);
        await expect(page.locator('.motion-curve-source code')).toContainText('steps(4');
        const ledger = await changes();
        await page.locator('[data-curve-preset="ease-out"]').click();
        assert.deepEqual(await changes(), ledger);
        await expect(page.locator('.craft-captured-easing code')).toContainText('steps(4');
        await page.locator('[data-use-easing]').click();
        await expect(page.locator('[data-curve-preset="ease-out"]')).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await expect.poll(async () => (await changes()).length).toBeGreaterThan(ledger.length);
        await page.locator('.foundry-workspace-switcher:visible').first().click();
        await page.locator('#studio-navigation [data-workspace-mode="canvas"]').click();
        await expect(page.locator('#app-shell')).toHaveAttribute('data-mode', 'canvas');
      },
    );
    await check(
      'Typography controls capture native units, preserve advanced CSS and cancel invalid drafts',
      async () => {
        await context.route('**/google-fonts?*', (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ fonts: [], source: 'isolated-project-font-test' }),
          }),
        );
        await frame.locator('body').evaluate((body) => {
          const el = document.createElement('p');
          el.id = 'next-type-fixture';
          el.textContent = 'A considered space for work in progress.';
          el.style.cssText =
            'font-family:"Morrow Sans", sans-serif;font-size:24.625px;line-height:32px;letter-spacing:0.125px;font-variation-settings:"wght" 450;width:360px;';
          body.append(el);
        });
        await select('#next-type-fixture');
        await page.locator('.foundry-workspace-switcher:visible').first().click();
        await page.locator('#studio-navigation [data-workspace-mode="typography"]').click();
        await expect(page.locator('[data-typography-control="fontSize"]')).toHaveValue('24.625');
        const field = page.locator('[data-typography-control="fontSize"]');
        const ledger = await changes();
        await field.fill('');
        await field.press('Enter');
        await expect(field).toHaveAttribute('aria-invalid', 'true');
        assert.deepEqual(await changes(), ledger);
        await field.press('Escape');
        await expect(field).toHaveValue('24.625');
        await field.fill('26.375');
        await field.press('Enter');
        await expect(frame.locator('#next-type-fixture')).toHaveCSS('font-size', '26.375px');
        await expect
          .poll(async () =>
            (await changes()).some((c) => c.property === 'fontSize' && Number(c.after) === 26.375),
          )
          .toBe(true);
        // Persistence can precede the bridge's commit response. Do not blur the
        // accepted field into a disclosure until the UI has acknowledged it.
        await expect(field.locator('xpath=ancestor::label')).toHaveClass(/is-changed/);
        await field.blur();
        await page.locator('[data-type-section="font-settings"] > summary').click();
        await expect(page.locator('[data-type-section="font-settings"]')).toHaveAttribute(
          'open',
          '',
        );
        const axes = page.locator('[data-typography-control="fontVariationSettings"]');
        await expect(page.locator('.typography-font-settings input[type="range"]')).toHaveCount(0);
        await axes.fill('bad');
        await axes.press('Enter');
        await expect(axes).toHaveAttribute('aria-invalid', 'true');
        await axes.press('Escape');
        await expect(axes).toHaveValue('"wght" 450');
        await axes.fill('"wght" 512.5');
        await axes.press('Enter');
        await expect(frame.locator('#next-type-fixture')).toHaveCSS(
          'font-variation-settings',
          '"wght" 512.5',
        );
        await expect(axes.locator('xpath=ancestor::label')).toHaveClass(/is-changed/);
        await page.locator('[data-type-section="font-settings"] > summary').focus();
      },
    );
    await check(
      'Typography failed saves restore the exact native style and retain an explicit retry',
      async () => {
        const target = frame.locator('#next-type-fixture'),
          field = page.locator('[data-typography-control="fontSize"]');
        const original = await target.getAttribute('style'),
          ledger = await changes();
        let posts = 0,
          release;
        await context.route('**/change-records', async (route) => {
          posts++;
          await new Promise((resolve) => (release = resolve));
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Test: typography save failed' }),
          });
        });
        await field.fill('30.125');
        await field.press('Enter');
        await expect.poll(() => posts).toBe(1);
        await field.press('Enter');
        assert.equal(posts, 1);
        release();
        await expect(page.locator('#toast')).toContainText('preview was restored');
        await expect(target).toHaveAttribute('style', original);
        await expect(field).toHaveValue('30.125');
        assert.deepEqual(await changes(), ledger);
        await context.unroute('**/change-records');
        await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
        await field.press('Enter');
        await expect(target).toHaveCSS('font-size', '30.125px');
        await expect
          .poll(async () =>
            (await changes()).some((c) => c.property === 'fontSize' && Number(c.after) === 30.125),
          )
          .toBe(true);
        await page.locator('[data-type-section="font-settings"] > summary').focus();
        await send('undo');
        await expect(target).toHaveCSS('font-size', '26.375px');
      },
    );
    await check(
      'Typography scale choices are accurate local drafts until native Preview and Reset',
      async () => {
        const target = frame.locator('#next-type-fixture'),
          ledger = await changes();
        await page.locator('[data-type-section="rhythm"] > summary').click();
        const base = page.locator('[data-scale-base-entry]');
        await base.fill('20.5');
        await base.press('Enter');
        await page.locator('[data-scale-ratio="1.25"]').click();
        await page.locator('[data-scale-step="2"]').click();
        await expect(page.locator('[data-type-scale-draft]')).toHaveText('32px');
        await expect(target).toHaveCSS('font-size', '26.375px');
        assert.deepEqual(await changes(), ledger);
        await base.fill('');
        await expect(page.locator('[data-preview-scale]')).toBeDisabled();
        await base.press('Escape');
        await expect(base).toHaveValue('20.5');
        await page.locator('[data-preview-scale]').click();
        await expect(target).toHaveCSS('font-size', '32px');
        assert.deepEqual(await changes(), ledger);
        await page.locator('[data-typography-action="reset-preview"]').click();
        await expect(target).toHaveCSS('font-size', '26.375px');
        await page.locator('[data-scale-fluid]').click();
        await expect(page.locator('[data-type-scale-draft]')).toHaveText(
          'clamp(24px, calc(21.714px + 0.714vw), 32px)',
        );
        await page.locator('[data-preview-scale]').click();
        const expected = await target.evaluate((el) => {
          const ref = document.createElement('p');
          ref.style.fontSize = 'clamp(24px, calc(21.714px + 0.714vw), 32px)';
          return ref.style.fontSize;
        });
        await expect.poll(() => target.evaluate((el) => el.style.fontSize)).toBe(expected);
        await page.locator('[data-typography-action="reset-preview"]').click();
        await expect(target).toHaveCSS('font-size', '26.375px');
        assert.deepEqual(await changes(), ledger);
      },
    );
    await check(
      'Typography font comparison loads real paired project faces before one reviewed font change',
      async () => {
        const ledger = await changes();
        await page
          .locator('[data-typography-family="Morrow Display"][data-typography-origin="project"]')
          .click();
        await expect(page.locator('.foundry-type-interior')).toHaveAttribute(
          'data-type-phase',
          'ready',
          { timeout: 15000 },
        );
        await expect(
          page.locator('.typography-comparison-specimen[data-specimen-contract="1"]'),
        ).toHaveCount(2);
        await expect(page.locator('.foundry-type-face dd[data-status="loaded"]')).toHaveCount(2);
        assert.deepEqual(await changes(), ledger);
        await page.getByRole('button', { name: 'Use this font', exact: true }).click();
        await expect.poll(async () => (await changes()).length).toBe(ledger.length + 1);
        await expect(frame.locator('#next-type-fixture')).toHaveCSS(
          'font-family',
          /Morrow Display/,
        );
        await expect(
          page.getByRole('button', { name: 'Staged in Review', exact: true }),
        ).toBeDisabled();
        if (
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).isVisible()
        )
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
      },
    );
    await check(
      'Typography controls and paired specimens remain readable in actual light and dark layouts',
      async () => {
        for (const theme of ['light', 'dark']) {
          for (
            let i = 0;
            i < 3 && (await page.locator('html').getAttribute('data-theme')) !== theme;
            i++
          ) {
            await page.locator('#workspace-menu-trigger').click();
            await page.locator('[data-theme-choice]').click();
          }
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
            await page.evaluate(async () => {
              await document.fonts.ready;
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
            });
            await expect
              .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
              .toBe(true);
            if (width === 390)
              await page
                .locator('.typography-comparison-card.is-candidate')
                .scrollIntoViewIfNeeded();
            await expect
              .poll(() =>
                page
                  .locator('.next-type-heading h2')
                  .first()
                  .evaluate((el) => getComputedStyle(el).color),
              )
              .toBe(theme === 'light' ? 'rgb(32, 32, 32)' : 'rgb(245, 245, 245)');
            if (width === 1440) {
              await page
                .locator('.typography-rendered-section')
                .evaluate((el) => el.scrollIntoView({ block: 'start' }));
              await page.evaluate(
                () =>
                  new Promise((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve)),
                  ),
              );
              await expect
                .poll(
                  async () =>
                    (await page.locator('[data-typography-control="fontSize"]').boundingBox())?.y ??
                    Infinity,
                )
                .toBeLessThan(400);
            }
            for (const property of ['lineHeight', 'letterSpacing']) {
              const field = page
                .locator(`[data-typography-control="${property}"]`)
                .locator('xpath=ancestor::label');
              const grid = field.locator('..');
              assert.ok(
                Math.abs((await field.boundingBox()).width - (await grid.boundingBox()).width) < 2,
              );
              const geometry = await field.evaluate((el) => {
                const label = el.firstElementChild.getBoundingClientRect();
                const value = el.querySelector('input').getBoundingClientRect();
                return { labelRight: label.right, valueLeft: value.left };
              });
              assert.ok(
                geometry.valueLeft >= geometry.labelRight,
                `${property} label cannot overlap its value`,
              );
            }
            await page.screenshot({
              path: join(artifacts, `typography-controls-${theme}-${width}.png`),
            });
            if (width === 390) {
              await page.locator('.typography-rendered-section').scrollIntoViewIfNeeded();
              await page.screenshot({
                path: join(artifacts, `typography-properties-${theme}-390.png`),
              });
              await page.locator('.typography-scale-panel').scrollIntoViewIfNeeded();
              await page.screenshot({ path: join(artifacts, `typography-scale-${theme}-390.png`) });
            }
          }
        }
        await page.setViewportSize({ width: 1600, height: 1000 });
      },
    );
    await check(
      'Typography multi-selection properties are read-only instead of flattening native values',
      async () => {
        const ledger = await changes(),
          original = await frame.locator('#next-type-fixture').getAttribute('style');
        await select('[data-foundry-id="story-title"]', true);
        await expect(page.locator('[data-typography-control="fontSize"]')).toBeDisabled();
        await expect(
          page
            .locator('.typography-rendered-section .next-type-help')
            .filter({ hasText: 'Select one text layer' }),
        ).toContainText('Select one text layer');
        assert.deepEqual(await changes(), ledger);
        await expect(frame.locator('#next-type-fixture')).toHaveAttribute('style', original);
        await context.unroute('**/google-fonts?*');
        await page.locator('.foundry-workspace-switcher:visible').first().click();
        await page.locator('#studio-navigation [data-workspace-mode="canvas"]').click();
      },
    );
    await check(
      'Design System separates authored, indexed and real Canvas evidence without edits',
      async () => {
        const response = await fetch(`${h.runtimeUrl}/v1/sessions/${session.sessionId}`, {
          headers: { 'x-foundry-token': session.token },
        });
        const payload = await response.json();
        systemGraph = payload.designGraph ?? payload.session?.designGraph;
        assert.ok(systemGraph?.tokens?.length);
        const token = systemGraph.tokens.find((item) => item.name === '--green');
        assert.ok(token);
        const ledger = await changes();
        await page.locator('.foundry-workspace-switcher:visible').first().click();
        await page.locator('#studio-navigation [data-workspace-mode="system"]').click();
        await page.locator(`[data-system-token="${token.id}"]`).click();
        await expect(page.locator('[data-system-value="authored"] dd')).toHaveText(token.value);
        if (token.resolvedValue)
          await expect(page.locator('[data-system-value="resolved"] dd')).toHaveText(
            token.resolvedValue,
          );
        const live = await frame
          .locator('html')
          .evaluate((el) => getComputedStyle(el).getPropertyValue('--green').trim());
        await expect(page.locator('[data-system-value="canvas"] dd')).toHaveText(live);
        assert.equal(await page.locator('.system-value-rows input').count(), 0);
        await expect(page.locator('.system-scope')).toContainText('Indexed scope');
        await expect(
          page.locator('.next-system-property-scroll > .craft-context-help'),
        ).toContainText('Source-index coverage');
        const source = page.locator('[data-section="Source of truth"]');
        await source.locator('summary').click();
        await expect(source).toHaveAttribute('open', '');
        await expect(source).toContainText(token.source.file);
        assert.deepEqual(await changes(), ledger);
      },
    );
    await check(
      'Design System failed promotion remains unchanged and suppresses duplicate pending submissions',
      async () => {
        systemPlan = systemGraph.tokenPromotions.find(
          (item) => item.canStage && item.sources?.length,
        );
        assert.ok(systemPlan);
        const ledger = await changes();
        const original = await frame.locator('html').getAttribute('style');
        await page.locator('[data-system-view="promotions"]').click();
        await page.locator(`[data-system-promotion="${systemPlan.id}"]`).click();
        await expect(page.locator('[data-system-value="authored"] dd')).toHaveText(
          systemPlan.value,
        );
        await expect(page.locator('.system-value-rows')).toContainText(
          systemPlan.suggestedTokenName,
        );
        assert.equal(
          await page.locator('.foundry-system-plan + .design-system-card.is-action').count(),
          1,
        );
        if (systemPlan.relation === 'near')
          await expect(page.locator('.system-near-warning')).toContainText('not an exact value');
        let posts = 0,
          release;
        await context.route('**/change-records', async (route) => {
          posts++;
          await new Promise((resolve) => (release = resolve));
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Test: plan save failed' }),
          });
        });
        const action = page.locator('[data-stage-token-promotion]');
        await action.click();
        await expect(action).toHaveText('Adding to Review…');
        await expect(action).toBeDisabled();
        await expect.poll(() => posts).toBe(1);
        await action.dispatchEvent('click');
        assert.equal(posts, 1);
        release();
        await expect(page.locator('.system-action-error')).toContainText('not acknowledged');
        await expect(action).toBeEnabled();
        assert.deepEqual(await changes(), ledger);
        assert.equal(await frame.locator('html').getAttribute('style'), original);
        await context.unroute('**/change-records');
        await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
      },
    );
    await check(
      'Design System acknowledged promotion records one exact source plan and stays in Review',
      async () => {
        const ledger = await changes();
        let posts = 0;
        await context.route('**/change-records', (route) => {
          posts++;
          return route.continue();
        });
        const action = page.locator('[data-stage-token-promotion]');
        await action.click();
        await expect(action).toHaveText('In Review');
        await expect(action).toBeDisabled();
        await expect.poll(async () => (await changes()).length).toBe(ledger.length + 1);
        const change = (await changes()).find(
          (item) => item.target?.id === `token-source:${systemPlan.id}`,
        );
        assert.equal(change.before, systemPlan.value);
        assert.equal(change.token, systemPlan.suggestedTokenName);
        assert.deepEqual(change.target.locator.sources, systemPlan.sources);
        assert.match(change.property, /^designToken\.(?:create|promote)$/);
        await action.dispatchEvent('click');
        assert.equal(posts, 1);
        await page.locator('[data-system-view="tokens"]').click();
        await page.locator('[data-system-view="promotions"]').click();
        await page.locator(`[data-system-promotion="${systemPlan.id}"]`).click();
        await expect(action).toHaveText('In Review');
        await expect(action).toBeDisabled();
        await context.unroute('**/change-records');
        if (
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).isVisible()
        )
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
      },
    );
    await check(
      'Design System token and promotion controls fit actual light dark and phone layouts',
      async () => {
        for (const theme of ['light', 'dark']) {
          for (
            let i = 0;
            i < 3 && (await page.locator('html').getAttribute('data-theme')) !== theme;
            i++
          ) {
            await page.locator('#workspace-menu-trigger').click();
            await page.locator('[data-theme-choice]').click();
          }
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
            await openCompactLibrary(page);
            await page.locator('[data-system-view="tokens"]').click();
            const token = systemGraph.tokens.find((item) => item.name === '--green');
            await page.locator(`[data-system-token="${token.id}"]`).click();
            await page.evaluate(async () => {
              await document.fonts.ready;
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
            });
            await expect
              .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
              .toBe(true);
            if (width === 390)
              await page
                .locator('.system-value-rows')
                .evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await expect
              .poll(() =>
                page
                  .locator('.next-system-heading h2')
                  .first()
                  .evaluate((el) => getComputedStyle(el).color),
              )
              .toBe(theme === 'light' ? 'rgb(32, 32, 32)' : 'rgb(245, 245, 245)');
            await page.screenshot({
              path: join(artifacts, `system-controls-${theme}-${width}.png`),
            });
            await page.locator('[data-system-view="promotions"]').click();
            await page.locator(`[data-system-promotion="${systemPlan.id}"]`).click();
            await page
              .locator('[data-stage-token-promotion]')
              .evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
            await page.screenshot({
              path: join(artifacts, `system-promotion-${theme}-${width}.png`),
            });
          }
        }
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.locator('.foundry-workspace-switcher:visible').first().click();
        await page.locator('#studio-navigation [data-workspace-mode="canvas"]').click();
      },
    );
    await check(
      'Workshop gallery renders authored variants without changing Canvas or Review',
      async () => {
        await select('[data-foundry-id="create-workspace-button"]');
        const target = frame.locator('[data-foundry-id="create-workspace-button"]');
        workshopOriginal = {
          attribute: await target.getAttribute('data-story'),
          style: await target.getAttribute('style'),
        };
        const ledger = await changes();
        const response = await fetch(`${h.runtimeUrl}/v1/sessions/${session.sessionId}`, {
          headers: { 'x-foundry-token': session.token },
        });
        const payload = await response.json(),
          graph = payload.designGraph ?? payload.session?.designGraph;
        workshopDefinition = graph.components.find((item) => item.name === 'PrimaryAction');
        workshopAxis = workshopDefinition.variantAxes.find((item) => item.canCreate);
        workshopQuiet = workshopDefinition.variants.find(
          (item) => (item.name ?? item.label) === 'Quiet',
        );
        assert.ok(workshopAxis && workshopQuiet);
        await page.locator('.foundry-workspace-switcher:visible').first().click();
        await page.locator('#studio-navigation [data-workspace-mode="components"]').click();
        await page.locator(`[data-workshop-component="${workshopDefinition.id}"]`).click();
        const card = page.locator(`[data-specimen-id="${workshopQuiet.id}"]`);
        await expect(card).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
        await card.locator('.next-specimen-select').click();
        await expect(card.locator('.next-specimen-select')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.workshop-variant-properties')).toContainText('Read only');
        await expect(page.locator('.next-workshop-properties > .craft-context-help')).toContainText(
          'Read-only authored properties',
        );
        assert.equal(await page.locator('.workshop-variant-properties input').count(), 0);
        assert.equal(await target.getAttribute('data-story'), workshopOriginal.attribute);
        assert.equal(await target.getAttribute('style'), workshopOriginal.style);
        assert.deepEqual(await changes(), ledger);
        await page.locator('[data-workshop-disclosure="authoring"] > summary').click();
        await expect(page.locator('[data-workshop-axis]')).toHaveValue(workshopAxis.id);
        await expect(page.locator('.workshop-axis-summary')).toContainText(
          workshopAxis.source.file,
        );
        await expect(page.locator('.workshop-axis-summary')).toContainText(
          'does not copy gallery styling',
        );
        const action = page.locator('[data-workshop-create-variant]');
        await expect(action).toBeDisabled();
        await page.locator('[data-workshop-variant-label]').fill('Emphasis');
        await page.locator('[data-workshop-variant-value]').fill(String(workshopAxis.values[0]));
        await expect(page.locator('[data-workshop-variant-value]')).toHaveAttribute(
          'aria-invalid',
          'true',
        );
        await expect(page.locator('[data-workshop-authoring-status]')).toContainText(
          'already exists',
        );
        await expect(action).toBeDisabled();
        await page.locator('[data-workshop-variant-value]').fill('Emphasis');
        await expect(action).toBeEnabled();
        assert.deepEqual(await changes(), ledger);
      },
    );
    await check(
      'Workshop failed source-variant save preserves the draft and exact live attribute',
      async () => {
        const ledger = await changes();
        let posts = 0,
          release;
        await context.route('**/change-records', async (route) => {
          posts++;
          await new Promise((resolve) => (release = resolve));
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Test: source variant save failed' }),
          });
        });
        const action = page.locator('[data-workshop-create-variant]');
        await action.click();
        await expect(action).toHaveText('Adding variant…');
        await expect(action).toBeDisabled();
        await expect(page.locator('[data-workshop-variant-value]')).toBeDisabled();
        await expect.poll(() => posts).toBe(1);
        await action.dispatchEvent('click');
        assert.equal(posts, 1);
        release();
        await expect(page.locator('[data-workshop-authoring-status]')).toContainText(
          'Not acknowledged',
        );
        await expect(page.locator('[data-workshop-variant-value]')).toHaveValue('Emphasis');
        await expect(action).toBeEnabled();
        const target = frame.locator('[data-foundry-id="create-workspace-button"]');
        assert.equal(await target.getAttribute('data-story'), workshopOriginal.attribute);
        assert.equal(await target.getAttribute('style'), workshopOriginal.style);
        assert.deepEqual(await changes(), ledger);
        await context.unroute('**/change-records');
        await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
      },
    );
    await check(
      'Workshop source authoring records one acknowledged option without inventing a gallery variant',
      async () => {
        const ledger = await changes();
        let posts = 0;
        await context.route('**/change-records', (route) => {
          posts++;
          return route.continue();
        });
        const action = page.locator('[data-workshop-create-variant]');
        await action.click();
        await expect(action).toHaveText('In Review');
        await expect(action).toBeDisabled();
        await expect.poll(async () => (await changes()).length).toBe(ledger.length + 1);
        const change = (await changes()).find(
          (item) =>
            item.property === `component.variant.create.${workshopAxis.property}` &&
            item.after === 'Emphasis',
        );
        assert.ok(change);
        await expect(page.locator('#persistent-review-count')).toHaveText(
          String(
            (await changes()).filter((item) => !['applied', 'rejected'].includes(item.status))
              .length,
          ),
        );
        assert.ok(
          change.evidence.some((item) => item === `Variant adapter: ${workshopAxis.adapter}`),
        );
        assert.equal(change.scope, 'component');
        // The target remains the rendered instance. The variant authoring
        // location is carried by its source mapping, not target.source.
        assert.ok(
          change.mappingCandidates.some(
            (mapping) =>
              mapping.source?.file === workshopAxis.source.file &&
              mapping.source?.line === workshopAxis.source.line,
          ),
        );
        await action.dispatchEvent('click');
        assert.equal(posts, 1);
        await page.locator('[data-workshop-variant-value]').fill('EmphasisTwo');
        await expect(action).toBeEnabled();
        await page.locator('[data-workshop-variant-value]').fill('Emphasis');
        await expect(action).toBeDisabled();
        await expect(page.locator('.next-specimen')).toHaveCount(
          workshopDefinition.variants.length,
        );
        await expect(
          page.locator('.next-specimen header strong').filter({ hasText: 'Emphasis' }),
        ).toHaveCount(0);
        await expect(page.locator('[data-workshop-authoring-status]')).toContainText(
          'until Apply and re-index',
        );
        await context.unroute('**/change-records');
        if (
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).isVisible()
        )
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
      },
    );
    await check(
      'Workshop controls remain legible in light dark desktop and phone layouts',
      async () => {
        for (const theme of ['light', 'dark']) {
          for (
            let i = 0;
            i < 3 && (await page.locator('html').getAttribute('data-theme')) !== theme;
            i++
          ) {
            await page.locator('#workspace-menu-trigger').click();
            await page.locator('[data-theme-choice]').click();
          }
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
            await page.evaluate(async () => {
              await document.fonts.ready;
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
            });
            await expect
              .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
              .toBe(true);
            await expect(page.locator(`[data-specimen-id="${workshopQuiet.id}"]`)).toHaveAttribute(
              'data-ready',
              'true',
            );
            if (width === 1440)
              await page.locator('.next-workshop-scroll').evaluate((el) => (el.scrollTop = 0));
            else
              await page
                .locator(`[data-specimen-id="${workshopQuiet.id}"]`)
                .evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await page.screenshot({
              path: join(artifacts, `workshop-controls-${theme}-${width}.png`),
            });
            await page
              .locator('.workshop-authoring-form')
              .evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
            for (const size of await page
              .locator('.workshop-authoring-form input')
              .evaluateAll((fields) => fields.map((field) => getComputedStyle(field).fontSize)))
              assert.equal(size, '12px');
            if (width === 390) {
              for (const fits of await page
                .locator('.workshop-authoring-form .foundry-select-value')
                .evaluateAll((values) =>
                  values.map((value) => value.scrollWidth <= value.clientWidth + 1),
                ))
                assert.equal(fits, true, 'Phone authoring choices must not be truncated');
            }
            assert.ok(
              (await page.locator('[data-workshop-create-variant]').boundingBox()).height >= 32,
            );
            await page.screenshot({
              path: join(artifacts, `workshop-authoring-${theme}-${width}.png`),
            });
          }
        }
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.locator('[data-next-canvas]').click();
      },
    );
    await check(
      'Recipes capture persistence failure preserves drafts and requires a library recheck',
      async () => {
        await frame.locator('body').evaluate((body) => {
          for (const [id, label] of [
            ['next-recipe-source', 'Recipe source action'],
            ['next-recipe-target', 'Recipe destination action'],
            ['next-recipe-fresh', 'Preview destination'],
          ]) {
            const button = document.createElement('button');
            button.id = id;
            button.textContent = label;
            button.style.cssText =
              'display:block;width:260px;height:48px;font-size:12px;border-radius:4px;margin:16px;transition:width 800ms ease,font-size 800ms ease;';
            body.append(button);
          }
        });
        await select('#next-recipe-source');
        await open('Typography');
        await edit('fontSize', 14.5);
        await open('Layout');
        await edit('width', 280.25);
        recipeLedgerBeforeCapture = await changes();
        await page.locator('.foundry-workspace-switcher:visible').first().click();
        await page.locator('#studio-navigation [data-workspace-mode="recipes"]').click();
        await page.locator('#visual-recipe-name').fill('Refined action');
        await page
          .locator('#visual-recipe-intent')
          .fill('Clearer type and more room for a secondary action.');
        await frame.locator('html').evaluate(() => {
          const memory = () =>
            JSON.stringify(
              Object.keys(localStorage)
                .filter((key) => key.startsWith('__foundry_design_memory:'))
                .sort()
                .map((key) => [key, localStorage.getItem(key)]),
            );
          window.__recipeMemorySnapshot = memory();
          window.__recipeMemoryRead = memory;
          window.__recipeStorageOriginal = Storage.prototype.setItem;
          Storage.prototype.setItem = function (key, value) {
            if (key.startsWith('__foundry_design_memory:'))
              throw new DOMException('Test: recipe quota failure', 'QuotaExceededError');
            return window.__recipeStorageOriginal.call(this, key, value);
          };
        });
        const trace = commandTrace.length,
          save = page.locator('#visual-recipe-save');
        const pending = await save.evaluate((button) => {
          button.click();
          button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return {
            label: button.textContent,
            disabled: button.disabled,
            fieldDisabled: document.querySelector('#visual-recipe-name').disabled,
          };
        });
        assert.equal(pending.label, 'Saving recipe…');
        assert.equal(pending.disabled, true);
        assert.equal(pending.fieldDisabled, true);
        await expect(save).toHaveText('Recheck library');
        assert.equal(
          await frame
            .locator('html')
            .evaluate(() => window.__recipeMemoryRead() === window.__recipeMemorySnapshot),
          true,
        );
        await frame
          .locator('html')
          .evaluate(() => (Storage.prototype.setItem = window.__recipeStorageOriginal));
        await expect(page.locator('#visual-recipe-name')).toHaveValue('Refined action');
        await expect(page.locator('#visual-recipe-intent')).toHaveValue(
          'Clearer type and more room for a secondary action.',
        );
        await save.click();
        await expect(save).toHaveText('Save recipe');
        assert.equal(
          commandTrace.slice(trace).filter((item) => item.command === 'save-visual-recipe').length,
          1,
        );
        await expect(page.locator('[data-recipe-capture-status]')).toContainText(
          'Library refreshed',
        );
        assert.deepEqual(await changes(), recipeLedgerBeforeCapture);
        if (
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).isVisible()
        )
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
      },
    );
    await check(
      'Recipes a second acknowledged capture selects the actual new local entry without adding Review changes',
      async () => {
        await page.locator('#visual-recipe-name').fill('Refined action confirmed');
        await page.locator('#visual-recipe-save').click();
        await expect(page.locator('[data-recipe-capture-status]')).toContainText(
          'Saved “Refined action confirmed”',
        );
        await expect(page.locator('#visual-recipe-name')).toHaveValue('');
        await expect(page.locator('#visual-recipe-intent')).toHaveValue('');
        await expect(page.locator('.next-recipe-heading h2')).toHaveText(
          'Refined action confirmed',
        );
        const snapshot = await send('request-state');
        const saved = snapshot.visualRecipes.recipes.find(
          (recipe) => recipe.name === 'Refined action confirmed',
        );
        assert.ok(saved);
        capturedRecipeId = saved.id;
        assert.equal(saved.values.length, 2);
        assert.equal(Number(saved.values.find((item) => item.property === 'fontSize').value), 14.5);
        assert.equal(Number(saved.values.find((item) => item.property === 'width').value), 280.25);
        await expect(page.locator(`[data-visual-recipe="${saved.id}"]`)).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        assert.deepEqual(await changes(), recipeLedgerBeforeCapture);
        await select('#next-recipe-target');
        await expect(page.locator('[data-apply-visual-recipe]')).toHaveText('Add to Review');
        if (
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).isVisible()
        )
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
      },
    );
    await check(
      'Recipes partial application keeps earlier recorded values and requires explicit mapping recheck',
      async () => {
        const before = await changes();
        let posts = 0,
          release;
        await context.route('**/change-records', async (route) => {
          posts++;
          if (posts === 1) return route.continue();
          await new Promise((resolve) => (release = resolve));
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Test: second recipe value failed' }),
          });
        });
        const action = page.locator('[data-apply-visual-recipe]');
        await action.click();
        await expect(action).toHaveText('Adding values…');
        await expect(action).toBeDisabled();
        await expect.poll(() => posts).toBe(2);
        await action.dispatchEvent('click');
        assert.equal(posts, 2);
        release();
        await expect(action).toHaveText('Recheck mapping');
        await expect(page.locator('[data-recipe-apply-status]')).toContainText(
          'Earlier changes may remain',
        );
        const target = frame.locator('#next-recipe-target');
        await expect(target).toHaveCSS('font-size', '14.5px');
        await expect(target).toHaveCSS('width', '260px');
        assert.equal(
          await target.evaluate((element) => element.style.transitionProperty),
          'width, font-size',
        );
        await expect.poll(async () => (await changes()).length).toBe(before.length + 1);
        await context.unroute('**/change-records');
        if (
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).isVisible()
        )
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
      },
    );
    await check(
      'Recipes explicit recheck is read-only and retry records only remaining supported changes',
      async () => {
        const before = await changes();
        let posts = 0;
        await context.route('**/change-records', (route) => {
          posts++;
          return route.continue();
        });
        const action = page.locator('[data-apply-visual-recipe]');
        await action.click();
        await expect(action).toHaveText('Add to Review');
        assert.equal(posts, 0);
        assert.deepEqual(await changes(), before);
        await action.click();
        await expect(page.locator('[data-recipe-apply-status]')).toContainText(
          '1 change recorded from 2 supported properties',
        );
        await expect(action).toHaveText('Values match');
        await expect(action).toBeDisabled();
        assert.equal(posts, 1);
        await expect(frame.locator('#next-recipe-target')).toHaveCSS('width', '280.25px');
        assert.equal(
          await frame
            .locator('#next-recipe-target')
            .evaluate((element) => element.style.transitionProperty),
          'width, font-size',
        );
        await expect.poll(async () => (await changes()).length).toBe(before.length + 1);
        await expect(page.locator('#persistent-review-count')).toHaveText(
          String(
            (await changes()).filter((item) => !['applied', 'rejected'].includes(item.status))
              .length,
          ),
        );
        await context.unroute('**/change-records');
        if (
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).isVisible()
        )
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
      },
    );
    await check(
      'Recipes mapping and capture controls remain readable in actual light dark and phone layouts',
      async () => {
        await select('#next-recipe-fresh');
        for (const theme of ['light', 'dark']) {
          for (
            let i = 0;
            i < 3 && (await page.locator('html').getAttribute('data-theme')) !== theme;
            i++
          ) {
            await page.locator('#workspace-menu-trigger').click();
            await page.locator('[data-theme-choice]').click();
          }
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
            await page.evaluate(async () => {
              await document.fonts.ready;
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
            });
            await expect
              .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
              .toBe(true);
            await page.locator('.visual-recipe-mapping').evaluate((el) => {
              el.style.scrollMarginTop = '72px';
              el.scrollIntoView({ block: 'start' });
            });
            await page.screenshot({
              path: join(artifacts, `recipe-controls-${theme}-${width}.png`),
            });
            await page
              .locator('.visual-recipe-capture-form')
              .evaluate((el) => el.scrollIntoView({ block: 'center' }));
            for (const size of await page
              .locator('.visual-recipe-capture-form input, .visual-recipe-capture-form textarea')
              .evaluateAll((fields) => fields.map((field) => getComputedStyle(field).fontSize)))
              assert.equal(size, '12px');
            await page.screenshot({
              path: join(artifacts, `recipe-capture-${theme}-${width}.png`),
            });
          }
        }
        const ledger = await changes();
        await select('#next-recipe-source', true);
        await expect(page.locator('[data-apply-visual-recipe]')).toBeDisabled();
        await expect(page.locator('#visual-recipe-save')).toBeDisabled();
        assert.deepEqual(await changes(), ledger);
        await select('#next-recipe-fresh');
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.locator('[data-next-recipe-canvas]').click();
      },
    );
    await check(
      'State Workbench inspects the actual isolated target without adding Review changes',
      async () => {
        await select('[data-foundry-id="story-title"]');
        stateLedger = await changes();
        await page.locator('.foundry-workspace-switcher:visible').first().click();
        await page.locator('#studio-navigation [data-workspace-mode="states"]').click();
        await expect(page.locator('#state-verification-title')).toHaveText('Context inspected', {
          timeout: 30000,
        });
        await expect(page.locator('[data-state-measurement]')).toBeVisible();
        await expect(page.locator('[data-state-measurement]')).toContainText('px target');
        await expect(page.locator('.next-state-footer')).toContainText('No Review changes');
        await expect(page.locator('.next-state-axis')).toHaveCount(4);
        assert.deepEqual(await changes(), stateLedger);
      },
    );
    await check(
      'State Workbench authored loading reloads only the isolated preview and exports unsupported motion honestly',
      async () => {
        await page.locator('[data-state-matrix-state="loading"]').click();
        const isolated = page.frameLocator('#state-live-preview');
        await expect(page.locator('#state-verification-title')).toHaveText('Context inspected', {
          timeout: 30000,
        });
        await expect(isolated.locator('.submit-button')).toHaveAttribute('aria-busy', 'true');
        await expect(frame.locator('.submit-button')).not.toHaveAttribute('aria-busy', 'true');
        await page
          .locator('#state-matrix-motion')
          .locator('..')
          .locator('.foundry-select-trigger')
          .click();
        await page.getByRole('option', { name: 'Full motion', exact: true }).click();
        await expect(page.locator('#state-verification-title')).toHaveText('Context not applied');
        await expect(page.locator('.next-state-axes h2')).toHaveText('Context diagnostics');
        const unsupported = page.locator('.next-state-axis[data-status="unsupported"]');
        await expect(unsupported).toHaveCount(1);
        await unsupported.locator('summary').click();
        await expect(unsupported).toContainText('cannot override');
        await expect(page.locator('[data-state-measurement]')).toBeHidden();
        const downloadPromise = page.waitForEvent('download');
        await page.locator('#state-save-matrix').click();
        const download = await downloadPromise;
        const matrix = JSON.parse(readFileSync(await download.path(), 'utf8'));
        const loading = matrix.contexts.find((item) => item.context.state === 'loading');
        assert.equal(loading.status, 'unsupported');
        assert.equal(loading.axes.motion.status, 'unsupported');
        assert.equal(loading.measurement, null);
        assert.equal(loading.measuredAt, null);
        assert.deepEqual(await changes(), stateLedger);
      },
    );
    await check(
      'State Workbench controls and evidence remain readable in light dark desktop and phone layouts',
      async () => {
        if (
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).isVisible()
        )
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
        await page
          .locator('#state-matrix-motion')
          .locator('..')
          .locator('.foundry-select-trigger')
          .click();
        await page.getByRole('option', { name: 'System', exact: true }).click();
        await expect(page.locator('#state-verification-title')).toHaveText('Context inspected');
        await page.locator('.next-state-axis').first().locator('summary').click();
        for (const theme of ['light', 'dark']) {
          for (
            let i = 0;
            i < 3 && (await page.locator('html').getAttribute('data-theme')) !== theme;
            i++
          ) {
            await page.locator('#workspace-menu-trigger').click();
            await page.locator('[data-theme-choice]').click();
          }
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
            await page.evaluate(async () => {
              await document.fonts.ready;
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            });
            assert.equal(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              true,
            );
            await expect
              .poll(() =>
                page.locator('.state-preview-viewport').evaluate((element) => {
                  const preview = element.getBoundingClientRect(),
                    host = element.closest('.state-preview-stage').getBoundingClientRect();
                  return preview.width <= host.width - 40 && preview.height <= host.height - 40;
                }),
              )
              .toBe(true);
            await openCompactLibrary(page);
            await page
              .locator('.next-state-conditions')
              .evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await page
              .locator('.next-state-controls')
              .evaluate((el) => (el.scrollTop = el.scrollHeight));
            for (const size of await page
              .locator('.next-state-conditions .foundry-select-trigger')
              .evaluateAll((nodes) => nodes.map((el) => getComputedStyle(el).fontSize)))
              assert.equal(size, '12px');
            await page.screenshot({
              path: join(artifacts, `state-controls-${theme}-${width}.png`),
            });
            await page
              .locator('.next-state-evidence-scroll')
              .evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await page.screenshot({
              path: join(artifacts, `state-evidence-${theme}-${width}.png`),
            });
          }
        }
        assert.deepEqual(await changes(), stateLedger);
        await page.setViewportSize({ width: 1600, height: 1000 });
      },
    );
    await check(
      'State Workbench closing an in-flight request cannot publish an old receipt into a fresh visit',
      async () => {
        // Hold the real authored-query reload, then navigate away. No acknowledgement is fabricated.
        let release,
          held = 0;
        await context.route('**/*morrow-state=loading*', async (route) => {
          if (route.request().resourceType() !== 'document') return route.continue();
          held++;
          await new Promise((resolve) => (release = resolve));
          await route.continue().catch(() => {});
        });
        await page.locator('[data-state-matrix-state="current"]').click();
        await expect(page.locator('#state-verification-title')).toHaveText('Context inspected', {
          timeout: 30000,
        });
        await page.locator('[data-state-matrix-state="loading"]').click();
        await expect.poll(() => held).toBe(1);
        await expect(page.locator('#state-run-verification')).toBeDisabled();
        await page.locator('[data-next-canvas]').click();
        release();
        await context.unroute('**/*morrow-state=loading*');
        await page.locator('.foundry-workspace-switcher:visible').first().click();
        await page.locator('#studio-navigation [data-workspace-mode="states"]').click();
        await expect(page.locator('#state-verification-title')).toHaveText('Context inspected', {
          timeout: 30000,
        });
        await expect(page.locator('#state-verification-count')).toHaveText(
          '1 of 2 conditions inspected',
        );
        await expect(page.locator('#state-run-verification')).toBeEnabled();
        assert.deepEqual(await changes(), stateLedger);
        await page.locator('[data-next-canvas]').click();
      },
    );
    await check(
      'Responsive Lab typed widths validate cancel and resize only the Custom preview',
      async () => {
        await select('[data-foundry-id="story-title"]');
        responsiveLedger = await changes();
        await page.locator('.foundry-workspace-switcher:visible').first().click();
        await page.locator('#studio-navigation [data-workspace-mode="responsive"]').click();
        await page.locator('[data-next-responsive-frame="custom"]').click();
        await page.locator('[data-responsive-view="selected"]').click();
        const input = page.locator('#responsive-width-entry');
        const custom = page.locator('[data-responsive-frame="custom"]');
        const original = await custom.getAttribute('width');
        await input.fill('100');
        await input.press('Enter');
        await expect(input).toHaveAttribute('aria-invalid', 'true');
        await expect(custom).toHaveAttribute('width', original);
        await input.press('Escape');
        await expect(input).toHaveValue(original);
        await expect(page.locator('#responsive-width-error')).toBeHidden();
        await input.fill('960');
        await input.press('Enter');
        await expect(custom).toHaveAttribute('width', '960');
        await expect
          .poll(() =>
            page
              .frameLocator('[data-responsive-frame="custom"]')
              .locator('html')
              .evaluate(() => innerWidth),
          )
          .toBe(960);
        await expect(page.locator('#responsive-capture-before')).toBeEnabled({ timeout: 30000 });
        assert.deepEqual(await changes(), responsiveLedger);
      },
    );
    await check(
      'Responsive Lab compares matching geometry and refuses deltas across different targets',
      async () => {
        await page.locator('.next-responsive-comparison > summary').click();
        await page.locator('#responsive-capture-before').click();
        await page.locator('#responsive-width-entry').fill('880');
        await page.locator('#responsive-width-entry').press('Enter');
        await expect(page.locator('#responsive-capture-after')).toBeEnabled({ timeout: 30000 });
        await page.locator('#responsive-capture-after').click();
        await expect(page.locator('.responsive-comparison-delta')).toContainText('-80px viewport');
        await select('.submit-button');
        await expect(page.locator('#responsive-capture-after')).toBeEnabled({ timeout: 30000 });
        await page.locator('#responsive-capture-after').click();
        await expect(page.locator('.responsive-comparison-delta')).toContainText(
          'Different contexts',
        );
        assert.deepEqual(await changes(), responsiveLedger);
        await select('[data-foundry-id="story-title"]');
        await page.locator('#responsive-clear-comparison').click();
        await expect(page.locator('#responsive-capture-before')).toBeEnabled({ timeout: 30000 });
        await page.locator('#responsive-capture-before').click();
        await page.locator('#responsive-width-entry').fill('960');
        await page.locator('#responsive-width-entry').press('Enter');
        await expect(page.locator('#responsive-capture-after')).toBeEnabled({ timeout: 30000 });
        await page.locator('#responsive-capture-after').click();
      },
    );
    await check(
      'Responsive Lab edit scope stays pending until native acknowledgements without staging edits',
      async () => {
        const all = page.locator('[data-responsive-scope="all"]');
        const pending = await all.evaluate((button) => {
          button.click();
          return {
            disabled: button.disabled,
            busy: button.closest('.responsive-scope-group').getAttribute('aria-busy'),
          };
        });
        assert.equal(pending.disabled, true);
        assert.equal(pending.busy, 'true');
        await expect(all).toHaveAttribute('aria-pressed', 'true', { timeout: 30000 });
        await expect(all).toBeEnabled();
        assert.equal((await send('request-state')).responsive.editScope.scope, 'all-breakpoints');
        await page.locator('[data-responsive-scope="breakpoint"]').click();
        await expect(page.locator('[data-responsive-scope="breakpoint"]')).toHaveAttribute(
          'aria-pressed',
          'true',
          { timeout: 30000 },
        );
        assert.equal((await send('request-state')).responsive.editScope.scope, 'breakpoint');
        assert.deepEqual(await changes(), responsiveLedger);
      },
    );
    await check(
      'Responsive Lab controls and geometry remain legible in light dark desktop and phone layouts',
      async () => {
        if (
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).isVisible()
        )
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
        for (const theme of ['light', 'dark']) {
          for (
            let i = 0;
            i < 3 && (await page.locator('html').getAttribute('data-theme')) !== theme;
            i++
          ) {
            await page.locator('#workspace-menu-trigger').click();
            await page.locator('[data-theme-choice]').click();
          }
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
            await page.evaluate(async () => {
              await document.fonts.ready;
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            });
            assert.equal(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              true,
            );
            await openCompactLibrary(page);
            await page
              .locator('.foundry-responsive-resize')
              .evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await expect(page.locator('#responsive-width-entry')).toHaveCSS('font-size', '12px');
            await page.screenshot({
              path: join(artifacts, `responsive-controls-${theme}-${width}.png`),
            });
            await page
              .locator('.next-responsive-comparison')
              .evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await page.screenshot({
              path: join(artifacts, `responsive-geometry-${theme}-${width}.png`),
            });
          }
        }
        assert.deepEqual(await changes(), responsiveLedger);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.locator('[data-next-canvas]').click();
      },
    );
    await check(
      'Content Stress separates draft reset from applied conditions and preserves the Review ledger',
      async () => {
        await select('[data-foundry-id="story-title"]');
        stressLedger = await changes();
        stressOriginalText = await title.textContent();
        await page.locator('.foundry-workspace-switcher:visible').first().click();
        await page.locator('#studio-navigation [data-workspace-mode="health"]').click();
        await page.locator('[data-stress-scope="selection"]').click();
        const choice = page.locator('[data-stress-condition="long-content"]');
        await choice.click();
        await expect(choice.locator('.next-stress-condition-status')).toHaveText('Draft');
        const trace = commandTrace.length;
        const pending = await page.locator('#apply-stress').evaluate((button) => {
          button.click();
          return {
            disabled: button.disabled,
            resetDisabled: document.querySelector('[data-reset-stress-draft]').disabled,
          };
        });
        assert.equal(pending.disabled, true);
        assert.equal(pending.resetDisabled, true);
        await expect(choice.locator('.next-stress-condition-status')).toHaveText('Applied', {
          timeout: 30000,
        });
        await expect.poll(() => title.textContent()).not.toBe(stressOriginalText);
        const appliedText = await title.textContent();
        await page.locator('[data-reset-stress-draft]').click();
        await expect(choice).toHaveAttribute('aria-pressed', 'false');
        await expect(choice.locator('.next-stress-condition-status')).toHaveText(
          'Applied · not chosen',
        );
        assert.equal(await title.textContent(), appliedText);
        assert.equal(
          commandTrace.slice(trace).filter((item) => item.command === 'apply-health-stress').length,
          1,
        );
        await expect(page.locator('#clear-stress')).toBeEnabled();
        assert.deepEqual(await changes(), stressLedger);
      },
    );
    await check(
      'Content Stress Restore original returns exact content and leaves draft choices separate',
      async () => {
        await page.locator('#clear-stress').click();
        await expect.poll(() => title.textContent()).toBe(stressOriginalText);
        await expect(page.locator('#clear-stress')).toBeDisabled();
        await expect(page.locator('[data-stress-condition="long-content"]')).toHaveAttribute(
          'aria-pressed',
          'false',
        );
        await expect(page.locator('.next-stress-receipt')).toBeVisible();
        assert.deepEqual(await changes(), stressLedger);
      },
    );
    await check(
      'Content Stress native correction records acknowledged edits and rejects duplicate submission',
      async () => {
        await frame.locator('body').evaluate((body) => {
          const button = document.createElement('button');
          button.id = 'next-stress-small';
          button.textContent = 'Small test action';
          button.setAttribute('aria-label', 'Small test action');
          button.style.cssText =
            'display:block;width:20px;height:20px;padding:0;border:0;font-size:12px;overflow:hidden;';
          body.append(button);
        });
        await select('#next-stress-small');
        await page.locator('[data-stress-scope="selection"]').click();
        await page.locator('#run-health').click();
        await expect(page.locator('#stress-summary-grid h3')).toHaveText('Scan complete', {
          timeout: 30000,
        });
        const state = await send('request-state');
        const issue = state.health.find(
          (item) => item.canFix && /target|touch/i.test(item.kind + ' ' + item.title),
        );
        assert.ok(issue, 'Native health scan must expose a real correctable small-target finding');
        await page.locator(`[data-next-stress-finding="${issue.id}"]`).click();
        const before = (await changes()).length,
          trace = commandTrace.length;
        const action = page.locator(`[data-stress-fix="${issue.id}"]`);
        const pending = await action.evaluate((button) => {
          button.click();
          button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return document.querySelector('#apply-stress').disabled;
        });
        assert.equal(pending, true);
        await expect(page.locator(`[data-stress-fix="${issue.id}"]`)).toHaveText(
          'Added to Review',
          { timeout: 30000 },
        );
        await expect(page.locator(`[data-stress-fix="${issue.id}"]`)).toBeDisabled();
        await expect.poll(async () => (await changes()).length).toBeGreaterThan(before);
        assert.equal(
          commandTrace.slice(trace).filter((item) => item.command === 'preview-health-fix').length,
          1,
        );
        assert.ok(
          await frame
            .locator('#next-stress-small')
            .evaluate(
              (el) =>
                el.getBoundingClientRect().width >= 44 && el.getBoundingClientRect().height >= 44,
            ),
        );
      },
    );
    await check(
      'Content Stress controls findings and receipts remain readable in light dark desktop and phone layouts',
      async () => {
        if (
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).isVisible()
        )
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
        await select('[data-foundry-id="story-title"]');
        await page.locator('[data-stress-scope="canvas"]').click();
        await page.locator('#run-health').click();
        await expect(page.locator('#stress-summary-grid h3')).toHaveText('Scan complete', {
          timeout: 30000,
        });
        await page.locator('[data-stress-condition="long-content"]').click();
        if (
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).isVisible()
        )
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
        for (const theme of ['light', 'dark']) {
          for (
            let i = 0;
            i < 3 && (await page.locator('html').getAttribute('data-theme')) !== theme;
            i++
          ) {
            await page.locator('#workspace-menu-trigger').click();
            await page.locator('[data-theme-choice]').click();
          }
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
            await page.evaluate(async () => {
              await document.fonts.ready;
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            });
            assert.equal(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              true,
            );
            await openCompactLibrary(page);
            await page
              .locator('[data-stress-condition="long-content"]')
              .evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await page.evaluate(
              () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
            );
            await page.screenshot({
              path: join(artifacts, `stress-controls-${theme}-${width}.png`),
            });
            await page
              .locator('.next-stress-evidence-scroll')
              .evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await page.evaluate(
              () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
            );
            await expect
              .poll(() =>
                page.evaluate(() => {
                  const slot = document
                      .querySelector('.next-stress-preview-slot')
                      .getBoundingClientRect(),
                    overlay = document.querySelector('.canvas-mode').getBoundingClientRect();
                  return {
                    left: Math.round(overlay.left - slot.left),
                    top: Math.round(overlay.top - slot.top),
                  };
                }),
              )
              .toEqual({ left: 0, top: 0 });
            await page.screenshot({
              path: join(artifacts, `stress-evidence-${theme}-${width}.png`),
            });
          }
        }
        await page.locator('[data-reset-stress-draft]').click();
        await page.locator('[data-stress-scope="selection"]').click();
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.locator('[data-next-canvas]').click();
      },
    );
    await check(
      'Visual Agent keyboard submission captures native context in a local queued request without changing Review',
      async () => {
        await select('[data-foundry-id="story-title"]');
        agentLedger = await changes();
        await page.locator('.foundry-workspace-switcher:visible').first().click();
        await page.locator('#studio-navigation [data-workspace-mode="agent"]').click();
        const prompt = page.locator('#visual-agent-prompt');
        await prompt.fill('Assess this heading; keep source unchanged.');
        await prompt.press('Control+Enter');
        await expect(prompt).toHaveValue('');
        await expect(page.locator('.visual-agent-conversation-head strong')).toHaveText(
          'Assess this heading; keep source unchanged.',
        );
        const response = await fetch(`${h.runtimeUrl}/v1/sessions/${session.sessionId}`, {
          headers: { 'x-foundry-token': session.token },
        });
        assert.ok(response.ok);
        const data = await response.json();
        agentRequest = (data.visualAgentRequests ?? data.session?.visualAgentRequests).at(-1);
        assert.equal(agentRequest.status, 'queued');
        assert.equal(agentRequest.context.targets[0].selector, '[data-foundry-id="story-title"]');
        assert.equal(agentRequest.proposals.length, 0);
        assert.deepEqual(await changes(), agentLedger);
      },
    );
    await check(
      'Visual Agent current attachments remain distinct from the saved question and preserve newer draft input',
      async () => {
        await page.locator('#visual-agent-prompt').fill('A separate follow-up draft');
        await select('.submit-button');
        await expect(page.locator('.next-agent-attachment-change')).toBeVisible();
        await expect(page.locator('#visual-agent-prompt')).toHaveValue(
          'A separate follow-up draft',
        );
        await page.locator('.next-agent-snapshot > summary').click();
        await expect(page.locator('.next-agent-saved')).toContainText(
          'Make room for the work that matters.',
        );
        await page.locator('.next-agent-snapshot > summary').click();
        assert.equal(agentRequest.context.targets[0].selector, '[data-foundry-id="story-title"]');
        assert.deepEqual(await changes(), agentLedger);
      },
    );
    await check(
      'Visual Agent composer and captured context remain readable in light dark desktop and phone layouts',
      async () => {
        if (
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).isVisible()
        )
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
        for (const theme of ['light', 'dark']) {
          for (
            let i = 0;
            i < 3 && (await page.locator('html').getAttribute('data-theme')) !== theme;
            i++
          ) {
            await page.locator('#workspace-menu-trigger').click();
            await page.locator('[data-theme-choice]').click();
          }
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
            await page
              .locator('.foundry-agent-composer-dock')
              .evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await page.evaluate(async () => {
              await document.fonts.ready;
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            });
            assert.equal(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              true,
            );
            await expect(page.locator('#visual-agent-prompt')).toHaveCSS('font-size', '12px');
            await page.screenshot({
              path: join(artifacts, `agent-controls-${theme}-${width}.png`),
            });
            const details = page.locator('.foundry-agent-attachments');
            await details.evaluate((el) => {
              el.open = true;
              el.scrollIntoView({ block: 'center' });
            });
            await page.evaluate(
              () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
            );
            await page.screenshot({ path: join(artifacts, `agent-context-${theme}-${width}.png`) });
            await details.evaluate((el) => {
              el.open = false;
            });
          }
        }
        assert.deepEqual(await changes(), agentLedger);
        await page.locator('#visual-agent-prompt').fill('');
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.locator('[data-next-canvas]').click();
      },
    );
    await check(
      'Design Memory captures actual selected context as saved guidance without changing Review',
      async () => {
        await select('[data-foundry-id="story-title"]');
        memoryLedger = await changes();
        await page.locator('.foundry-workspace-switcher:visible').first().click();
        await page.locator('#studio-navigation [data-workspace-mode="memory"]').click();
        await page.locator('[data-studio-action="memory-record"]').click();
        await page.locator('#decision-memory-title').fill('Keep the headline measure');
        await page
          .locator('#decision-memory-summary')
          .fill('Preserve room beside the signup form.');
        await page
          .locator('#decision-memory-rationale')
          .fill('A local acceptance-test decision, not source verification.');
        await page.locator('#decision-memory-save').click();
        await expect(page.locator('#decision-memory-title')).toHaveValue('');
        const state = await send('request-state');
        memoryDecision = state.decisionMemory.decisions.find(
          (item) => item.title === 'Keep the headline measure',
        );
        assert.ok(memoryDecision);
        assert.equal(memoryDecision.summary, 'Preserve room beside the signup form.');
        assert.ok(memoryDecision.evidence.some((item) => item.kind === 'manual'));
        await page.locator(`[data-design-decision="${memoryDecision.id}"]`).click();
        assert.deepEqual(await changes(), memoryLedger);
      },
    );
    await check(
      'Design Memory correction and eligibility toggles wait for native acknowledgement and reject duplicates',
      async () => {
        await page.locator('.next-memory-correction > summary').click();
        await page
          .locator('[data-decision-summary]')
          .fill('Preserve the current measure and test wrapping at narrow widths.');
        const start = commandTrace.length;
        const pending = await page.locator('[data-save-decision-correction]').evaluate((button) => {
          button.click();
          button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return {
            toggle: document.querySelector('[data-toggle-decision]').disabled,
            remove: document.querySelector('[data-remove-decision]').disabled,
          };
        });
        assert.deepEqual(pending, { toggle: true, remove: true });
        await expect(page.locator('[data-save-decision-correction]')).toBeDisabled();
        await expect
          .poll(
            async () =>
              (await send('request-state')).decisionMemory.decisions.find(
                (item) => item.id === memoryDecision.id,
              ).summary,
          )
          .toBe('Preserve the current measure and test wrapping at narrow widths.');
        const corrected = (await send('request-state')).decisionMemory.decisions.find(
          (item) => item.id === memoryDecision.id,
        );
        assert.equal(corrected.title, 'Keep the headline measure');
        assert.equal(corrected.enabled, true);
        assert.equal(
          commandTrace.slice(start).filter((item) => item.command === 'update-design-decision')
            .length,
          1,
        );
        await page.locator('[data-toggle-decision]').click();
        await expect(page.locator('.next-memory-detail-status')).toHaveText('Disabled guidance');
        await page.locator('[data-toggle-decision]').click();
        await expect(page.locator('.next-memory-detail-status')).toHaveText('Active guidance');
        assert.deepEqual(await changes(), memoryLedger);
      },
    );
    await check(
      'Design Memory saved guidance and correction controls remain readable in both themes and phone layouts',
      async () => {
        if (
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).isVisible()
        )
          await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
        for (const theme of ['light', 'dark']) {
          for (
            let i = 0;
            i < 3 && (await page.locator('html').getAttribute('data-theme')) !== theme;
            i++
          ) {
            await page.locator('#workspace-menu-trigger').click();
            await page.locator('[data-theme-choice]').click();
          }
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
            await page
              .locator('.decision-memory-overview')
              .evaluate((el) => el.scrollIntoView({ block: 'start' }));
            await page.evaluate(async () => {
              await document.fonts.ready;
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            });
            assert.equal(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              true,
            );
            await page.screenshot({
              path: join(artifacts, `memory-controls-${theme}-${width}.png`),
            });
            await page
              .locator('.next-memory-correction')
              .evaluate((el) => el.scrollIntoView({ block: 'center' }));
            await page.evaluate(
              () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
            );
            await page.screenshot({
              path: join(artifacts, `memory-correction-${theme}-${width}.png`),
            });
          }
        }
        assert.deepEqual(await changes(), memoryLedger);
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.locator('[data-next-canvas]').click();
      },
    );
    await check(
      'logical axis controls edit native Flex values and undo in reversed RTL flow',
      async () => {
        await frame.locator('body').evaluate((body) => {
          const element = document.createElement('div');
          element.id = 'next-axis-fixture';
          element.dir = 'rtl';
          element.style.cssText =
            'display:flex;flex-direction:row-reverse;justify-content:flex-start;align-items:flex-start;width:360px;height:160px;gap:8px;';
          for (let i = 0; i < 3; i++) {
            const child = document.createElement('div');
            child.textContent = String(i + 1);
            child.style.cssText = 'width:32px;height:32px;background:#3157ff;color:white;';
            element.append(child);
          }
          body.append(element);
        });
        await select('#next-axis-fixture');
        await open('Layout');
        const target = frame.locator('#next-axis-fixture'),
          original = await target.getAttribute('style');
        await expect(page.locator('[data-align-preset]')).toHaveCount(6);
        const firstX = await target
          .locator('div')
          .first()
          .evaluate((el) => el.getBoundingClientRect().x);
        await page.locator('[data-align-preset="justifyContent:flex-end"]').click();
        await expect(target).toHaveCSS('justify-content', 'flex-end');
        await expect(page.locator('[data-align-preset="justifyContent:flex-end"]')).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        assert.notEqual(
          await target
            .locator('div')
            .first()
            .evaluate((el) => el.getBoundingClientRect().x),
          firstX,
        );
        await send('undo');
        await expect.poll(() => target.getAttribute('style')).toBe(original);
        await page.locator('[data-align-preset="alignItems:center"]').click();
        await expect(target).toHaveCSS('align-items', 'center');
        await expect(page.locator('[data-align-preset="alignItems:center"]')).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await send('undo');
        await expect.poll(() => target.getAttribute('style')).toBe(original);
      },
    );
    await check(
      'axis keyboard focus does not accept; full distribution/stretch/baseline options remain',
      async () => {
        const target = frame.locator('#next-axis-fixture'),
          original = await target.getAttribute('style'),
          ledger = await changes();
        await page.locator('[data-align-preset="justifyContent:flex-start"]').focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('[data-align-preset="justifyContent:center"]')).toBeFocused();
        assert.equal(await target.getAttribute('style'), original);
        assert.deepEqual(await changes(), ledger);
        await page.keyboard.press('Enter');
        await expect(target).toHaveCSS('justify-content', 'center');
        await expect(page.locator('[data-align-preset="justifyContent:center"]')).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await send('undo');
        await expect.poll(() => target.getAttribute('style')).toBe(original);
        const details = page.locator('[data-axis-more="justifyContent"]');
        if (!(await details.evaluate((el) => el.open))) await details.locator('summary').click();
        await chooseInspectorOption(
          page.locator('[data-next-field="justifyContent"]'),
          'space-between',
        );
        await expect(target).toHaveCSS('justify-content', 'space-between');
        await expect(
          page.locator('[data-align-preset^="justifyContent:"][aria-pressed="true"]'),
        ).toHaveCount(0);
        const cross = page.locator('[data-axis-more="alignItems"]');
        if (!(await cross.evaluate((el) => el.open))) await cross.locator('summary').click();
        assert.ok(
          (await page.locator('[data-next-field="alignItems"] option').allTextContents()).includes(
            'baseline',
          ),
        );
        assert.ok(
          (await page.locator('[data-next-field="alignItems"] option').allTextContents()).includes(
            'stretch',
          ),
        );
        await send('undo');
        await expect.poll(() => target.getAttribute('style')).toBe(original);
      },
    );
    await check(
      'failed axis acceptance restores the product and leaves an explicit retry possible',
      async () => {
        const target = frame.locator('#next-axis-fixture'),
          original = await target.getAttribute('style'),
          ledger = await changes();
        await context.route('**/change-records', (route) =>
          route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Test: Review unavailable' }),
          }),
        );
        await page.locator('[data-align-preset="justifyContent:center"]').click();
        await expect(page.locator('.next-edit-error')).toContainText('preview was restored');
        await expect.poll(() => target.getAttribute('style')).toBe(original);
        assert.deepEqual(await changes(), ledger);
        await expect(page.locator('[data-align-preset="justifyContent:center"]')).toBeEnabled();
        await context.unroute('**/change-records');
        await page.locator('[data-align-preset="justifyContent:center"]').click();
        await expect(target).toHaveCSS('justify-content', 'center');
        await expect(page.locator('[data-align-preset="justifyContent:center"]')).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await send('undo');
        await expect.poll(() => target.getAttribute('style')).toBe(original);
        await expect(
          page.locator('[data-align-preset="justifyContent:flex-start"]'),
        ).toHaveAttribute('aria-pressed', 'true');
        await page.screenshot({ path: join(artifacts, 'logical-alignment.png') });
      },
    );
    await check(
      'Grid and mixed flex directions never receive a misleading spatial shortcut',
      async () => {
        await frame.locator('body').evaluate((body) => {
          for (const [id, display, direction] of [
            ['next-axis-grid', 'grid', 'row'],
            ['next-axis-other', 'flex', 'column'],
          ]) {
            const el = document.createElement('div');
            el.id = id;
            el.textContent = id;
            el.style.cssText = `display:${display};flex-direction:${direction};width:200px;height:80px;`;
            body.append(el);
          }
        });
        const ledger = await changes();
        await select('#next-axis-grid');
        await open('Layout');
        await expect(page.locator('[data-align-preset]')).toHaveCount(0);
        await expect(page.locator('[data-next-field="justifyContent"]')).toBeVisible();
        await select('#next-axis-fixture');
        await select('#next-axis-other', true);
        await open('Layout');
        await expect(page.locator('[data-align-preset]')).toHaveCount(0);
        await expect(page.locator('[data-next-field="flexDirection"]')).toHaveValue('');
        assert.deepEqual(await changes(), ledger);
      },
    );
    await check(
      'inactive border color reveal is view-only; width drafts reveal/cancel without losing color',
      async () => {
        await frame.locator('body').evaluate((body) => {
          const el = document.createElement('button');
          el.id = 'next-border-fixture';
          el.textContent = 'Border control specimen';
          el.style.cssText = 'border:0px solid rgb(80,90,100);padding:20px;';
          body.append(el);
        });
        await select('#next-border-fixture');
        await open('Appearance');
        const more = page.locator('[data-more="Appearance"]');
        if ((await more.getAttribute('aria-expanded')) !== 'true') await more.click();
        const target = frame.locator('#next-border-fixture'),
          original = await target.getAttribute('style'),
          ledger = await changes();
        const color = page.locator('[data-next-field="borderColor"]'),
          initialColor = await color.inputValue();
        await expect(color).toBeHidden();
        await page.locator('[data-reveal-border]').click();
        await expect(color).toBeVisible();
        await expect(color).toHaveValue(initialColor);
        assert.equal(await target.getAttribute('style'), original);
        assert.deepEqual(await changes(), ledger);
        await page.locator('[data-reveal-border]').click();
        await expect(color).toBeHidden();
        const width = page.locator('[data-next-field="borderWidth"]');
        await width.fill('4');
        await expect(color).toBeVisible();
        await expect(target).toHaveCSS('border-top-width', '4px');
        assert.deepEqual(await changes(), ledger);
        await width.press('Escape');
        await expect.poll(() => target.getAttribute('style')).toBe(original);
        await expect(color).toBeHidden();
        await edit('borderWidth', 4);
        await expect(color).toBeVisible();
        await expect(color).toHaveValue(initialColor);
        await send('undo');
        await expect.poll(() => target.getAttribute('style')).toBe(original);
        await expect(color).toBeHidden();
        await page.screenshot({ path: join(artifacts, 'conditional-border.png') });
      },
    );
    await check(
      'mixed border colors stay inspectable at zero width without changing either target',
      async () => {
        await frame.locator('body').evaluate((body) => {
          const el = document.createElement('button');
          el.id = 'next-border-other';
          el.textContent = 'Other border';
          el.style.cssText = 'border:0px solid blue;padding:20px;';
          body.append(el);
        });
        const ledger = await changes();
        const targets = frame.locator('#next-border-fixture,#next-border-other');
        const original = await targets.evaluateAll((els) =>
          els.map((el) => el.getAttribute('style')),
        );
        await select('#next-border-fixture');
        await select('#next-border-other', true);
        await open('Appearance');
        const more = page.locator('[data-more="Appearance"]');
        if ((await more.getAttribute('aria-expanded')) !== 'true') await more.click();
        await expect(page.locator('[data-next-field="borderColor"]')).toBeVisible();
        await expect(page.locator('[data-next-field="borderColor"]')).toHaveAttribute(
          'placeholder',
          'Mixed',
        );
        assert.deepEqual(
          await targets.evaluateAll((els) => els.map((el) => el.getAttribute('style'))),
          original,
        );
        assert.deepEqual(await changes(), ledger);
      },
    );
    await check(
      'new alignment and border groups fit light/dark desktop and narrow layouts',
      async () => {
        for (const theme of ['light', 'dark'])
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 900 });
            for (
              let i = 0;
              i < 3 && (await page.locator('html').getAttribute('data-theme')) !== theme;
              i++
            ) {
              await page.locator('#workspace-menu-trigger').click();
              await page.locator('[data-theme-choice]').click();
            }
            await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
            await select('#next-axis-fixture');
            await open('Layout');
            await expect(page.locator('[data-align-preset]')).toHaveCount(6);
            assert.equal(
              await page
                .locator('#inspector-dock')
                .evaluate((el) => el.scrollWidth <= el.clientWidth),
              true,
            );
            assert.equal(
              await page
                .locator('.next-axis-presets button')
                .evaluateAll((els) => els.every((el) => el.scrollWidth <= el.clientWidth + 1)),
              true,
            );
            await page.locator('#inspector-dock').scrollIntoViewIfNeeded();
            await page.screenshot({ path: join(artifacts, `alignment-${theme}-${width}.png`) });
            await select('#next-border-fixture');
            await open('Appearance');
            const more = page.locator('[data-more="Appearance"]');
            if ((await more.getAttribute('aria-expanded')) !== 'true') await more.click();
            await expect(page.locator('[data-next-field="borderColor"]')).toBeHidden();
            assert.equal(
              await page
                .locator('.next-border-controls')
                .evaluate((el) => el.scrollWidth <= el.clientWidth),
              true,
            );
            await page.locator('#inspector-dock').scrollIntoViewIfNeeded();
            await page.screenshot({ path: join(artifacts, `border-${theme}-${width}.png`) });
          }
        await page.setViewportSize({ width: 1600, height: 1000 });
        if ((await page.locator('html').getAttribute('data-theme')) !== 'light') {
          await page.locator('#workspace-menu-trigger').click();
          await page.locator('[data-theme-choice]').click();
        }
      },
    );
    await check('paired padding edits affect only their two sides and undo together', async () => {
      await select('.social-actions');
      await open('Layout');
      const target = frame.locator('.social-actions');
      const original = await target.getAttribute('style');
      const count = (await changes()).length;
      const padding = () =>
        target.evaluate((el) => {
          const s = getComputedStyle(el);
          return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft];
        });
      const before = await padding();
      const input = page.locator('[data-next-field="paddingHorizontal"]');
      const draftNode = await input.elementHandle();
      await input.fill('28');
      await expect.poll(padding).toEqual([before[0], '28px', before[2], '28px']);
      assert.equal((await changes()).length, count);
      await input.press('Escape');
      await expect.poll(() => target.getAttribute('style')).toBe(original);
      // Adapter restoration precedes the Inspector's acknowledged redraw. Wait
      // for the actual field/focus handoff before starting another entry.
      await expect.poll(() => draftNode.evaluate((node) => node.isConnected)).toBe(false);
      await expect(page.locator('[data-next-field="paddingHorizontal"]')).toBeFocused();
      await edit('paddingHorizontal', 28);
      await send('undo');
      await expect.poll(() => target.getAttribute('style')).toBe(original);
    });
    await check(
      'unequal padding requires confirmation; cancel, grouped undo and redo restore exactly',
      async () => {
        const target = frame.locator('.social-actions');
        const original = await target.getAttribute('style');
        await page.locator('[data-independent="paddingLinked"]').click();
        await edit('paddingTop', 12);
        const unequal = await target.getAttribute('style');
        const count = (await changes()).length;
        const footer = await page.locator('.next-source-footer').boundingBox();
        await page.locator('[data-link="paddingLinked"]').click();
        await expect(page.locator('.next-link-help')).toContainText('These values differ');
        const input = page.locator('[data-next-field="paddingLinked"]');
        await expect(input).toHaveAttribute('placeholder', 'Mixed');
        await expect(input).toHaveValue('');
        assert.equal(await target.getAttribute('style'), unequal);
        await page.locator('[data-confirm-link]').click();
        await expect(page.locator('.next-edit-error')).toContainText('Mixed is not zero');
        await input.fill('20');
        await expect.poll(() => target.evaluate((el) => getComputedStyle(el).padding)).toBe('20px');
        assert.equal((await changes()).length, count);
        assert.deepEqual(await page.locator('.next-source-footer').boundingBox(), footer);
        await page.locator('[data-cancel-link]').click();
        await expect.poll(() => target.getAttribute('style')).toBe(unequal);
        await page.locator('[data-link="paddingLinked"]').click();
        await input.fill('20');
        await page.locator('[data-confirm-link]').click();
        await expect(page.locator('[data-link="paddingLinked"]')).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await expect(page.locator('[data-property="paddingLinked"].is-changed')).toBeVisible();
        await expect
          .poll(
            async () =>
              (await changes()).filter(
                (item) =>
                  /^padding(Top|Right|Bottom|Left)$/.test(item.property) &&
                  Number(item.after) === 20,
              ).length,
          )
          .toBe(4);
        await send('undo');
        await expect.poll(() => target.getAttribute('style')).toBe(unequal);
        await expect(input).toHaveAttribute('placeholder', 'Mixed');
        await send('redo');
        await expect.poll(() => target.evaluate((el) => getComputedStyle(el).padding)).toBe('20px');
        await send('undo');
        await send('undo');
        await expect.poll(() => target.getAttribute('style')).toBe(original);
      },
    );
    await check(
      'corner radii link deliberately and retain exact independent originals on undo',
      async () => {
        await select('.social-actions .icon-button');
        await open('Appearance');
        const target = frame.locator('.social-actions .icon-button').first();
        const original = await target.getAttribute('style');
        const link = page.locator('[data-link="radiusLinked"]');
        if ((await link.getAttribute('aria-pressed')) === 'true') await link.click();
        await edit('borderTopLeftRadius', 12);
        const unequal = await target.getAttribute('style');
        const count = (await changes()).length;
        await link.click();
        const input = page.locator('[data-next-field="radiusLinked"]');
        await expect(input).toHaveAttribute('placeholder', 'Mixed');
        await input.fill('24');
        await expect
          .poll(() => target.evaluate((el) => getComputedStyle(el).borderRadius))
          .toBe('24px');
        await input.press('Escape');
        await expect.poll(() => target.getAttribute('style')).toBe(unequal);
        assert.equal((await changes()).length, count);
        await link.click();
        await edit('radiusLinked', 24);
        await send('undo');
        await expect.poll(() => target.getAttribute('style')).toBe(unequal);
        await send('undo');
        await expect.poll(() => target.getAttribute('style')).toBe(original);
      },
    );
    await check(
      'linked edits preflight every target and undo across a multiple selection',
      async () => {
        await select('.social-actions button:first-child');
        await select('.social-actions button:last-child', true);
        await open('Layout');
        const targets = frame.locator('.social-actions button');
        const originals = await targets.evaluateAll((els) =>
          els.map((el) => el.getAttribute('style')),
        );
        const selection = (await send('request-state')).selection;
        await assert.rejects(
          send('inspector-draft', {
            targetId: selection.id,
            targetIds: selection.targets.map((target) => target.id),
            property: 'paddingLinked',
            action: 'preview',
            value: -4,
          }),
          /valid/,
        );
        assert.deepEqual(
          await targets.evaluateAll((els) => els.map((el) => el.getAttribute('style'))),
          originals,
        );
        await page.locator('[data-link="paddingLinked"]').click();
        await edit('paddingLinked', 8);
        await expect
          .poll(() => targets.evaluateAll((els) => els.map((el) => getComputedStyle(el).padding)))
          .toEqual(originals.map(() => '8px'));
        await send('undo');
        await expect
          .poll(() => targets.evaluateAll((els) => els.map((el) => el.getAttribute('style'))))
          .toEqual(originals);
      },
    );
    await check(
      'partial linked Review failure reports exact progress and remains one undoable group',
      async () => {
        await select('.social-actions');
        await open('Layout');
        const target = frame.locator('.social-actions');
        const original = await target.getAttribute('style');
        let requests = 0;
        await context.route('**/change-records', (route) => {
          if (++requests === 2)
            return route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Test: second edge unavailable' }),
            });
          return route.continue();
        });
        const input = page.locator('[data-next-field="paddingLinked"]');
        await input.fill('32');
        await input.press('Enter');
        await expect(page.locator('.next-edit-error')).toContainText('1 of 4 property changes');
        await expect(input).toHaveValue('32');
        assert.deepEqual(
          await target.evaluate((el) => {
            const style = getComputedStyle(el);
            return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
          }),
          ['32px', '0px', '0px', '0px'],
        );
        await context.unroute('**/change-records');
        await input.press('Escape');
        await send('undo');
        await expect.poll(() => target.getAttribute('style')).toBe(original);
      },
    );
    await check(
      'component content and accessibility cancel exactly, without replacing child icons',
      async () => {
        await select('[data-foundry-id="password-reveal"]');
        await expect(page.locator('#inspector-dock')).toHaveAttribute(
          'data-selection-category',
          'component',
        );
        const target = frame.locator('[data-foundry-id="password-reveal"]');
        const original = await target.textContent();
        const input = page.locator('[data-next-field="textContent"]');
        await input.fill('Reveal');
        await expect(target).toHaveText('Reveal');
        await input.press('Escape');
        await expect.poll(() => target.textContent()).toBe(original);
        await open('Accessibility');
        const label = await target.getAttribute('aria-label');
        await edit('aria-label', 'Reveal password');
        await expect(target).toHaveAttribute('aria-label', 'Reveal password');
        await send('undo');
        await expect(target).toHaveAttribute('aria-label', label);
        await expect(page.locator('[data-next-field="aria-label"]')).toHaveValue(label);
        await expect(page.locator('[data-property="aria-label"].is-changed')).toHaveCount(0);
        await select('[data-foundry-id="create-workspace-button"]');
        await expect(page.locator('[data-next-field="textContent"]')).toHaveCount(0);
        assert.ok(await frame.locator('[data-foundry-id="create-workspace-button"] svg').count());
        await page.locator('[data-next-workshop]').click();
        await expect(page.locator('#app-shell')).toHaveAttribute('data-mode', 'components');
        await page.locator('[data-next-canvas]').click();
      },
    );
    await check(
      'authored variants preview real CSS, switch cleanly and cancel with zero changes',
      async () => {
        await select('[data-foundry-id="create-workspace-button"]');
        await open('Content');
        const target = frame.locator('[data-foundry-id="create-workspace-button"]');
        const original = await target.getAttribute('data-story');
        const style = await target.getAttribute('style');
        const count = (await changes()).length;
        const snapshot = await send('request-state');
        assert.equal(snapshot.nextVariants.variants.filter((item) => item.supported).length, 3);
        const chooser = page.locator('[data-next-variant]');
        await chooseInspectorOption(chooser, 'morrow-action-quiet');
        await expect(page.locator('[data-variant-use]')).toBeEnabled();
        await expect(target).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(page.locator('[data-next-field="backgroundColor"]')).toHaveValue(
          'rgba(0, 0, 0, 0)',
        );
        assert.equal((await changes()).length, count);
        await chooseInspectorOption(chooser, 'morrow-action-danger');
        await expect(page.locator('[data-variant-use]')).toBeEnabled();
        await expect(target).toHaveCSS('background-color', 'rgb(158, 47, 47)');
        assert.equal((await changes()).length, count);
        await page.locator('[data-variant-cancel]').click();
        await expect.poll(() => target.getAttribute('data-story')).toBe(original);
        assert.equal(await target.getAttribute('style'), style);
        await expect(await visibleInspectorEntry(chooser)).toBeFocused();
      },
    );
    await check(
      'variant acceptance makes one source-traceable change with exact undo and redo',
      async () => {
        const target = frame.locator('[data-foundry-id="create-workspace-button"]');
        const original = await target.getAttribute('data-story');
        await chooseInspectorOption(page.locator('[data-next-variant]'), 'morrow-action-quiet');
        await page.locator('[data-variant-use]').click();
        await expect(page.locator('[data-variant-use]')).toHaveCount(0);
        await expect(page.locator('.next-variant-status').first()).toContainText(
          'Quiet added to Review',
        );
        await expect
          .poll(
            async () =>
              (await changes()).filter(
                (item) => item.property === 'variant.story' && item.after === 'Quiet',
              ).length,
          )
          .toBe(1);
        await send('undo');
        await expect.poll(() => target.getAttribute('data-story')).toBe(original);
        await send('redo');
        await expect(target).toHaveAttribute('data-story', 'Quiet');
        await send('undo');
        await expect.poll(() => target.getAttribute('data-story')).toBe(original);
      },
    );
    await check(
      'variant preview cancels on selection and workspace changes, but survives Focus return',
      async () => {
        const target = frame.locator('[data-foundry-id="create-workspace-button"]');
        const original = await target.getAttribute('data-story');
        const count = (await changes()).length;
        await chooseInspectorOption(page.locator('[data-next-variant]'), 'morrow-action-quiet');
        await expect(page.locator('[data-variant-use]')).toBeEnabled();
        await page.locator('.next-focus').click();
        await page.locator('[data-next-canvas]').click();
        await expect(target).toHaveAttribute('data-story', 'Quiet');
        await select('[data-foundry-id="password-reveal"]');
        await expect.poll(() => target.getAttribute('data-story')).toBe(original);
        await expect(page.locator('.next-unavailable')).toHaveText('No variants exposed');
        await select('[data-foundry-id="create-workspace-button"]');
        await chooseInspectorOption(page.locator('[data-next-variant]'), 'morrow-action-danger');
        await expect(page.locator('[data-variant-use]')).toBeEnabled();
        await page.locator('[data-next-workshop]').click();
        await expect.poll(() => target.getAttribute('data-story')).toBe(original);
        await page.locator('[data-next-canvas]').click();
        assert.equal((await changes()).length, count);
      },
    );
    await check(
      'failed variant acceptance restores attributes and retains the candidate for retry',
      async () => {
        const target = frame.locator('[data-foundry-id="create-workspace-button"]');
        const original = await target.getAttribute('data-story');
        const count = (await changes()).length;
        await chooseInspectorOption(page.locator('[data-next-variant]'), 'morrow-action-quiet');
        await expect(page.locator('[data-variant-use]')).toBeEnabled();
        await context.route('**/change-records', (route) =>
          route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Test: variant persistence unavailable' }),
          }),
        );
        await page.locator('[data-variant-use]').click();
        await expect(page.locator('.next-variant-status').first()).toContainText(
          'preview was restored',
        );
        await expect(page.locator('[data-next-variant]')).toHaveValue('morrow-action-quiet');
        await expect(page.locator('[data-variant-use]')).toBeDisabled();
        await expect.poll(() => target.getAttribute('data-story')).toBe(original);
        assert.equal((await changes()).length, count);
        await context.unroute('**/change-records');
        await page.locator('[data-variant-retry]').click();
        await expect(target).toHaveAttribute('data-story', 'Quiet');
        await expect(page.locator('[data-variant-use]')).toBeEnabled();
        await page.locator('[data-variant-cancel]').press('Escape');
        await expect.poll(() => target.getAttribute('data-story')).toBe(original);
      },
    );
    await check(
      'missing live CSS hooks and stale variant targets return explicit errors',
      async () => {
        const selection = (await send('request-state')).selection;
        const count = (await changes()).length;
        await assert.rejects(
          send('inspector-variant', {
            targetId: 'not-selected',
            variantId: 'morrow-action-quiet',
            action: 'preview',
          }),
          /selection changed/,
        );
        await assert.rejects(
          send('inspector-variant', {
            targetId: selection.id,
            variantId: 'invented-variant',
            action: 'preview',
          }),
          /unavailable/,
        );
        const rules = await frame.locator('body').evaluate(() => {
          const sheet = [...document.styleSheets].find((sheet) =>
            sheet.href?.endsWith('/style.css'),
          );
          const rules = [...sheet.cssRules].flatMap((rule, index) =>
            rule.selectorText?.includes('.submit-button[data-story=')
              ? [{ index, css: rule.cssText }]
              : [],
          );
          for (const rule of [...rules].reverse()) sheet.deleteRule(rule.index);
          // Similar attribute names and ancestor hooks do not control this target.
          sheet.insertRule(
            '.submit-button[data-storybook="Quiet"] { color: red; }',
            sheet.cssRules.length,
          );
          sheet.insertRule(
            'body[data-story="Quiet"] .submit-button { color: red; }',
            sheet.cssRules.length,
          );
          return rules;
        });
        assert.equal(rules.length, 2);
        const state = await send('request-state');
        assert.ok(state.nextVariants.variants.every((variant) => !variant.supported));
        await assert.rejects(
          send('inspector-variant', {
            targetId: selection.id,
            variantId: 'morrow-action-quiet',
            action: 'preview',
          }),
          /No authored live CSS hook/,
        );
        await frame.locator('body').evaluate((_, rules) => {
          const sheet = [...document.styleSheets].find((sheet) =>
            sheet.href?.endsWith('/style.css'),
          );
          sheet.deleteRule(sheet.cssRules.length - 1);
          sheet.deleteRule(sheet.cssRules.length - 1);
          for (const rule of rules) sheet.insertRule(rule.css, rule.index);
        }, rules);
        await send('request-state');
        assert.equal((await changes()).length, count);
      },
    );
    await check(
      'real SVG selection exposes CSS controls without inventing path editing',
      async () => {
        await frame.locator('.social-actions .icon-button svg').click();
        await expect(page.locator('#inspector-dock')).toHaveAttribute(
          'data-selection-category',
          'icon',
        );
        await expect(page.locator('[data-next-field="fill"]')).toHaveCount(0);
        await expect(page.locator('[data-next-field="stroke"]')).toHaveCount(0);
        const target = frame.locator('.social-actions .icon-button svg');
        const original = await target.getAttribute('style');
        await edit('opacity', '50');
        await expect.poll(() => target.evaluate((el) => getComputedStyle(el).opacity)).toBe('0.5');
        await send('undo');
        await expect.poll(() => target.getAttribute('style')).toBe(original);
      },
    );
    await check(
      'mixed selection previews every target and one Undo restores the group',
      async () => {
        await select('[data-foundry-id="story-title"]');
        await select('[data-foundry-id="form-title"]', true);
        await expect(page.locator('#inspector-dock .dock-head strong')).toHaveText(
          '2 layers selected',
        );
        await open('Typography');
        await expect(fontSize()).toHaveAttribute('placeholder', 'Mixed');
        await expect(fontSize()).toHaveValue('');
        await expect(page.locator('[data-property="fontSize"] .next-scrub')).toHaveCount(0);
        const snapshot = await send('request-state');
        await assert.rejects(
          () =>
            send('inspector-draft', {
              targetId: snapshot.selection.id,
              property: 'fontSize',
              action: 'preview',
              value: 40,
            }),
          /selection changed/,
        );
        const targets = frame.locator(
          '[data-foundry-id="story-title"], [data-foundry-id="form-title"]',
        );
        const originals = await targets.evaluateAll((els) =>
          els.map((el) => el.getAttribute('style')),
        );
        const count = (await changes()).length;
        await fontSize().press('Enter');
        await expect(page.locator('.next-edit-error')).toContainText('Mixed is not zero');
        await fontSize().fill('40');
        await expect
          .poll(() => targets.evaluateAll((els) => els.map((el) => getComputedStyle(el).fontSize)))
          .toEqual(['40px', '40px']);
        assert.equal((await changes()).length, count);
        await fontSize().press('Escape');
        await expect
          .poll(() => targets.evaluateAll((els) => els.map((el) => el.getAttribute('style'))))
          .toEqual(originals);
        await edit('fontSize', 40);
        await expect
          .poll(
            async () =>
              (await changes()).filter(
                (item) => item.property === 'fontSize' && Number(item.after) === 40,
              ).length,
          )
          .toBe(2);
        await send('undo');
        await expect
          .poll(() => targets.evaluateAll((els) => els.map((el) => el.getAttribute('style'))))
          .toEqual(originals);
        await expect(fontSize()).toHaveAttribute('placeholder', 'Mixed');
      },
    );
    await check(
      'media specimen has editable alt text and exact cancellation of a missing attribute',
      async () => {
        // Morrow has no image element. This supplemental DOM specimen is not presented as Morrow content.
        await frame.locator('body').evaluate((body) => {
          const img = document.createElement('img');
          img.id = 'next-media-test';
          img.width = 120;
          img.height = 80;
          img.src =
            'data:image/svg+xml,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><rect width="120" height="80" fill="#2f6fed"/><rect x="120" width="120" height="80" fill="#78a99a"/></svg>',
            );
          img.srcset = `${img.src} 1x`;
          body.append(img);
        });
        await select('#next-media-test');
        await expect(page.locator('#inspector-dock')).toHaveAttribute(
          'data-selection-category',
          'media',
        );
        const alt = page.locator('[data-next-field="alt"]');
        await alt.fill('Product preview');
        await expect(frame.locator('#next-media-test')).toHaveAttribute('alt', 'Product preview');
        await alt.press('Escape');
        await expect.poll(() => frame.locator('#next-media-test').getAttribute('alt')).toBe(null);
        await select('[data-foundry-id="story-title"]');
      },
    );
    await check(
      'image fit and position edit real CSS, preserve source candidates and undo exactly',
      async () => {
        await select('#next-media-test');
        await open('Layout');
        const image = frame.locator('#next-media-test');
        const original = await image.getAttribute('style');
        const originalSource = await image.getAttribute('src');
        const originalCandidates = await image.getAttribute('srcset');
        await expect
          .poll(() => image.evaluate((element) => element.complete && element.naturalWidth))
          .toBe(240);
        const count = (await changes()).length;
        const fit = page.locator('[data-next-field="objectFit"]');
        await expect(fit).toHaveValue('fill');
        await expect(page.locator('[data-property="objectPosition"]')).toContainText('X 50%');
        await expect(page.locator('[data-next-field="src"]')).toHaveCount(0);
        await expect(page.locator('[data-section="Typography"]')).toHaveCount(0);
        await expect(page.locator('[data-next-field="color"]')).toHaveCount(0);
        await expect(page.locator('[data-next-field="textContent"]')).toHaveCount(0);
        await page.getByRole('button', { name: 'Edit object position', exact: true }).click();
        await page.getByRole('button', { name: 'Position top right', exact: true }).click();
        await expect(image).toHaveCSS('object-position', '100% 0%');
        assert.equal((await changes()).length, count);
        await page.getByRole('group', { name: 'Object position pad', exact: true }).focus();
        await page.keyboard.press('Shift+ArrowDown');
        await expect(image).toHaveCSS('object-position', '100% 10%');
        await page.keyboard.press('Escape');
        await expect.poll(() => image.getAttribute('style')).toBe(original);
        await page.getByRole('button', { name: 'Edit object position', exact: true }).click();
        await page.locator('.next-position-css summary').click();
        const position = page.getByRole('textbox', { name: 'Object position CSS', exact: true });
        await position.fill('left top');
        await expect(image).toHaveCSS('object-position', '0% 0%');
        assert.equal((await changes()).length, count);
        await position.press('Escape');
        await expect.poll(() => image.getAttribute('style')).toBe(original);
        await page.getByRole('button', { name: 'Edit object position', exact: true }).click();
        await page.locator('.next-position-css summary').click();
        await position.fill('banana');
        await expect(page.locator('#next-position-status')).toContainText(
          'valid CSS object position',
        );
        await expect(
          page.getByRole('button', { name: 'Use position', exact: true }),
        ).toBeDisabled();
        await expect(position).toHaveValue('banana');
        assert.equal((await changes()).length, count);
        await position.press('Escape');
        await expect(page.locator('.next-edit-error')).toBeHidden();
        await chooseInspectorOption(fit, 'cover');
        await expect(page.locator('[data-property="objectFit"].is-changed')).toBeVisible();
        await expect(image).toHaveCSS('object-fit', 'cover');
        assert.equal((await changes()).length, count + 1);
        assert.equal((await changes()).at(-1).property, 'objectFit');
        assert.equal(await image.getAttribute('src'), originalSource);
        assert.equal(await image.getAttribute('srcset'), originalCandidates);
        await send('undo');
        await expect.poll(() => image.getAttribute('style')).toBe(original);
        await edit('objectPosition', 'right 12px bottom 8px');
        await expect(image).toHaveCSS('object-position', 'calc(100% - 12px) calc(100% - 8px)');
        assert.equal((await changes()).at(-1).property, 'objectPosition');
        await send('undo');
        await expect.poll(() => image.getAttribute('style')).toBe(original);
      },
    );
    await check(
      'video supports shared object layout, while audio and picture wrappers reject it',
      async () => {
        await frame.locator('body').evaluate((body) => {
          for (const tag of ['video', 'audio', 'picture']) {
            const element = document.createElement(tag);
            element.id = `next-${tag}-test`;
            element.style.cssText =
              'display:block;width:120px;height:80px;object-fit:contain;object-position:20% 30%';
            body.append(element);
          }
        });
        await select('#next-video-test');
        const video = frame.locator('#next-video-test');
        const original = await video.getAttribute('style');
        await open('Layout');
        await edit('objectPosition', '25% 75%');
        await expect(video).toHaveCSS('object-position', '25% 75%');
        await send('undo');
        await expect.poll(() => video.getAttribute('style')).toBe(original);
        await select('#next-media-test', true);
        await open('Layout');
        await expect(page.locator('[data-next-field="objectFit"]')).toHaveValue('');
        await chooseInspectorOption(page.locator('[data-next-field="objectFit"]'), 'contain');
        await expect(page.locator('[data-property="objectFit"].is-changed')).toBeVisible();
        await expect(frame.locator('#next-media-test')).toHaveCSS('object-fit', 'contain');
        await expect(video).toHaveCSS('object-fit', 'contain');
        await send('undo');
        await expect(frame.locator('#next-media-test')).toHaveCSS('object-fit', 'fill');
        await expect.poll(() => video.getAttribute('style')).toBe(original);
        for (const tag of ['audio', 'picture']) {
          await select(`#next-${tag}-test`);
          const snapshot = await send('request-state');
          assert.ok(
            !snapshot.nextControls.some((control) =>
              ['objectFit', 'objectPosition', 'textContent'].includes(control.property),
            ),
          );
          await assert.rejects(
            () =>
              send('inspector-draft', {
                targetId: snapshot.selection.id,
                property: 'objectFit',
                value: 'cover',
                action: 'preview',
              }),
            /does not support/,
          );
        }
        await select('#next-media-test');
        await select('.social-actions', true);
        await expect(page.locator('[data-next-field="objectFit"]')).toHaveCount(0);
        await select('[data-foundry-id="story-title"]');
        await frame
          .locator('#next-video-test, #next-audio-test, #next-picture-test')
          .evaluateAll((elements) => elements.forEach((element) => element.remove()));
      },
    );
    await check(
      'failed image fit save restores the preview and retains the chosen value',
      async () => {
        await select('#next-media-test');
        await open('Layout');
        const image = frame.locator('#next-media-test');
        const original = await image.getAttribute('style');
        const count = (await changes()).length;
        await context.route('**/change-records', (route) =>
          route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Media save unavailable' }),
          }),
        );
        await chooseInspectorOption(page.locator('[data-next-field="objectFit"]'), 'contain');
        await expect(page.locator('.next-edit-error')).toBeVisible();
        await expect(page.locator('[data-next-field="objectFit"]')).toHaveValue('contain');
        await expect.poll(() => image.getAttribute('style')).toBe(original);
        assert.equal((await changes()).length, count);
        await context.unroute('**/change-records');
        await (
          await visibleInspectorEntry(page.locator('[data-next-field="objectFit"]'))
        ).press('Escape');
        await expect(page.locator('.next-edit-error')).toBeHidden();
      },
    );
    await select('[data-foundry-id="story-title"]');
    await check('failed Review save restores the preview and preserves entered input', async () => {
      const count = (await changes()).length;
      const original = await title.getAttribute('style');
      await context.route('**/change-records', (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Test: Review unavailable' }),
        }),
      );
      await fontSize().fill('88');
      await fontSize().press('Enter');
      await expect(page.locator('.next-edit-error')).toContainText('preview was restored');
      await expect(fontSize()).toHaveValue('88');
      await expect.poll(() => title.getAttribute('style')).toBe(original);
      assert.equal((await changes()).length, count);
      await context.unroute('**/change-records');
      const originalInput = await fontSize().elementHandle();
      await fontSize().press('Escape');
      await expect.poll(() => originalInput.evaluate((el) => !el.isConnected)).toBe(true);
      await expect(fontSize()).toBeFocused();
    });
    await check('late acknowledgement cannot erase newer invalid input', async () => {
      const previous = commandTrace.filter(
        (item) => item.payload?.recorded && item.payload?.value === before + 6,
      ).length;
      await context.route('**/change-records', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await route.continue();
      });
      await fontSize().fill(String(before + 6));
      const request = page.waitForRequest(
        (request) => request.url().endsWith('/change-records') && request.method() === 'POST',
      );
      await fontSize().press('Enter');
      await request;
      await fontSize().fill('new invalid value');
      await fontSize().press('Enter');
      await expect
        .poll(
          () =>
            commandTrace.filter(
              (item) => item.payload?.recorded && item.payload?.value === before + 6,
            ).length,
        )
        .toBeGreaterThan(previous);
      await expect(fontSize()).toHaveValue('new invalid value');
      await expect(page.locator('.next-edit-error')).toContainText('Enter a number');
      await context.unroute('**/change-records');
      await fontSize().press('Escape');
      await expect(fontSize()).toHaveValue(String(before + 6));
      await send('undo');
      await expect(fontSize()).toHaveValue(String(before));
    });
    for (const theme of ['light', 'dark'])
      for (const height of [1080, 768]) {
        await check(`${theme} ${height}px layout`, async () => {
          await page.setViewportSize({ width: height === 1080 ? 1920 : 1280, height });
          // Exercise the actual theme control, not injected stylesheet overrides.
          for (
            let i = 0;
            i < 3 && (await page.locator('html').getAttribute('data-theme')) !== theme;
            i++
          ) {
            await page.locator('#workspace-menu-trigger').click();
            await page.locator('[data-theme-choice]').click();
          }
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          assert.equal(
            await page
              .locator('#inspector-dock')
              .evaluate((el) => el.scrollWidth <= el.clientWidth),
            true,
          );
          await expect
            .poll(async () => (await page.locator('.next-source-footer').boundingBox()).y + 44)
            .toBe(height);
          await page.screenshot({ path: join(artifacts, `${theme}-${height}.png`) });
          for (const [category, selector] of [
            ['container', '.social-actions'],
            ['component', '[data-foundry-id="password-reveal"]'],
            ['icon', '.social-actions .icon-button svg'],
            ['media', '#next-media-test'],
          ]) {
            await select(selector);
            await expect(page.locator('#inspector-dock')).toHaveAttribute(
              'data-selection-category',
              category,
            );
            const dock = page.locator('#inspector-dock');
            if (category === 'media') {
              await expect(
                await visibleInspectorEntry(page.locator('[data-next-field="objectFit"]')),
              ).toBeInViewport();
              const fit = await page
                .locator('[data-property="objectFit"] .next-field')
                .boundingBox();
              const position = await page
                .locator('[data-property="objectPosition"] .next-field')
                .boundingBox();
              assert.equal(fit.width, 268);
              assert.equal(fit.height, 32);
              assert.equal(position.width, 268);
              assert.equal(position.x, fit.x);
              assert.equal(position.y - fit.y - fit.height, 8);
            }
            assert.equal((await dock.boundingBox()).width, 300);
            assert.equal((await page.locator('.next-source-footer').boundingBox()).y + 44, height);
            const geometry = await dock.evaluate((el) =>
              [...el.querySelectorAll('.next-field')]
                .filter((field) => field.getBoundingClientRect().height)
                .map((field) => ({
                  width: field.getBoundingClientRect().width,
                  height: field.getBoundingClientRect().height,
                  overflow: field.scrollWidth > field.clientWidth,
                })),
            );
            assert.ok(
              geometry.every(
                (field) =>
                  [130, 268].includes(field.width) && field.height === 32 && !field.overflow,
              ),
            );
            await dock.screenshot({ path: join(artifacts, `${category}-${theme}-${height}.png`) });
          }
          await select('[data-foundry-id="password-reveal"]');
          await open('Layout');
          await page.locator('[data-link="paddingLinked"]').click();
          await expect(page.locator('[data-next-field="paddingLinked"]')).toBeFocused();
          await expect(page.locator('.next-link-help')).toBeVisible();
          await page
            .locator('#inspector-dock')
            .screenshot({ path: join(artifacts, `link-confirmation-${theme}-${height}.png`) });
          await page.locator('[data-next-field="paddingLinked"]').press('Escape');
          await expect(page.locator('[data-link="paddingLinked"]')).toBeFocused();
          await select('[data-foundry-id="create-workspace-button"]');
          await open('Content');
          await chooseInspectorOption(page.locator('[data-next-variant]'), 'morrow-action-quiet');
          await expect(page.locator('[data-variant-use]')).toBeEnabled();
          await page.locator('[data-section="Content"]').scrollIntoViewIfNeeded();
          await expect(page.locator('[data-next-field="backgroundColor"]')).toHaveValue(
            'rgba(0, 0, 0, 0)',
          );
          const variantField = await page.locator('.next-variants .next-field').boundingBox();
          assert.equal(variantField.width, 268);
          assert.equal(variantField.height, 32);
          assert.equal((await page.locator('.next-source-footer').boundingBox()).y + 44, height);
          await page
            .locator('#inspector-dock')
            .screenshot({ path: join(artifacts, `variant-preview-${theme}-${height}.png`) });
          await page.locator('[data-variant-cancel]').press('Escape');
          await expect(
            await visibleInspectorEntry(page.locator('[data-next-variant]')),
          ).toBeFocused();
          await select('[data-foundry-id="story-title"]');
        });
      }
    await check('no source files changed and no browser exceptions', async () => {
      assert.equal(h.command(project, 'git', ['diff', '--name-only']).stdout.trim(), '');
      assert.deepEqual(errors, []);
    });
    await check('offline preview preserves input and cannot report success', async () => {
      const count = (await changes()).length;
      await page.locator('#product-preview').evaluate((el) => {
        el.src = 'about:blank';
      });
      await expect(page.locator('#live-status')).not.toHaveAttribute('data-status', 'live', {
        timeout: 10000,
      });
      await fontSize().fill('88');
      await fontSize().press('Enter');
      await expect(page.locator('.next-edit-error')).toBeVisible();
      await expect(fontSize()).toHaveValue('88');
      await page.locator('.next-source-footer').click();
      await expect(fontSize()).toHaveValue('88');
      await expect(page.locator('.next-source-footer')).toContainText('disconnected');
      assert.equal((await changes()).length, count);
    });
    await check(
      'disconnected variant preview retains its candidate without reporting acceptance',
      async () => {
        await page.goto(url.href, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('#live-status')).toHaveAttribute('data-status', 'live', {
          timeout: 30000,
        });
        await select('[data-foundry-id="create-workspace-button"]');
        await open('Content');
        await chooseInspectorOption(page.locator('[data-next-variant]'), 'morrow-action-quiet');
        await expect(page.locator('[data-variant-use]')).toBeEnabled();
        const count = (await changes()).length;
        await page.locator('#product-preview').evaluate((el) => {
          el.src = 'about:blank';
        });
        await expect(page.locator('#live-status')).not.toHaveAttribute('data-status', 'live', {
          timeout: 10000,
        });
        await page.locator('[data-variant-use]').click();
        await expect(page.locator('.next-variant-status').first()).not.toContainText(
          'Waiting for preview',
        );
        await expect(page.locator('[data-next-variant]')).toHaveValue('morrow-action-quiet');
        await expect(page.locator('[data-variant-use]')).toBeDisabled();
        await expect(page.locator('[data-variant-retry]')).toBeVisible();
        assert.equal((await changes()).length, count);
      },
    );
    await check(
      'disconnected color picker retains the candidate and does not accept a failed preview',
      async () => {
        await page.goto(url.href, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('#live-status')).toHaveAttribute('data-status', 'live', {
          timeout: 30000,
        });
        await select('[data-foundry-id="story-title"]');
        await open('Appearance');
        await page.locator('[data-color-picker="color"]').click();
        const count = (await changes()).length;
        await page.locator('#product-preview').evaluate((el) => {
          el.src = 'about:blank';
        });
        await expect(page.locator('#live-status')).not.toHaveAttribute('data-status', 'live', {
          timeout: 10000,
        });
        const dialog = page.locator('.next-color-picker');
        await dialog.locator('[data-color-value]').fill('#336699');
        await expect(dialog.locator('[role="status"]')).toContainText(
          /not connected|unavailable|disconnected|reconnect/i,
          { timeout: 10000 },
        );
        await expect(dialog.locator('[data-color-value]')).toHaveValue('#336699');
        await expect(dialog.locator('[data-use]')).toBeDisabled();
        assert.equal((await changes()).length, count);
        assert.deepEqual(errors, []);
      },
    );
  }
} catch (error) {
  failed = error;
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error(h.redact(error.stack));
  // Keep full evidence local; avoid dumping whole project snapshots into diagnostics.
  writeFileSync(join(artifacts, 'command-trace.json'), h.redact(JSON.stringify(commandTrace)));
} finally {
  if (!previewOnly)
    writeFileSync(
      join(artifacts, 'report.json'),
      JSON.stringify(
        {
          checks,
          status: failed ? 'failed' : 'passed',
          error: failed ? h.redact(failed.message) : null,
        },
        null,
        2,
      ),
    );
  await h.stopOwnedResources();
  if (previewOnly) rmSync(join(artifacts, 'preview.json'), { force: true });
  if (failed) h.retainFailureDiagnostics(failed);
  else rmSync(h.harnessRoot, { recursive: true, force: true });
}
if (failed) process.exitCode = 1;
