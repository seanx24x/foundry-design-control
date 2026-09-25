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
const previewOnly = process.argv.includes('--preview');
let page;
let failed;
const commandTrace = [];
const check = async (name, action) => {
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
      if (data?.command?.startsWith('inspector-') || data?.type === 'foundry:workspace-result')
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
  page.on('pageerror', (error) => errors.push(error.message));
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
    await check('300px panels, fixed header and footer', async () => {
      for (const selector of ['#layers-dock', '#inspector-dock'])
        assert.equal((await page.locator(selector).boundingBox()).width, 300);
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
        130,
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
    });
    await check('one scrub creates one undoable preview operation', async () => {
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
      const input = page.locator(`[data-next-field="${property}"]`);
      await input.fill(String(value));
      await input.press('Enter');
      await expect(page.locator(`[data-property="${property}"].is-changed`)).toBeVisible();
      await expect(page.locator('.next-edit-error')).toBeHidden();
    };
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
      await input.fill('28');
      await expect.poll(padding).toEqual([before[0], '28px', before[2], '28px']);
      assert.equal((await changes()).length, count);
      await input.press('Escape');
      await expect.poll(() => target.getAttribute('style')).toBe(original);
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
        await chooser.selectOption('morrow-action-quiet');
        await expect(page.locator('[data-variant-use]')).toBeEnabled();
        await expect(target).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(page.locator('[data-next-field="backgroundColor"]')).toHaveValue(
          'rgba(0, 0, 0, 0)',
        );
        assert.equal((await changes()).length, count);
        await chooser.selectOption('morrow-action-danger');
        await expect(page.locator('[data-variant-use]')).toBeEnabled();
        await expect(target).toHaveCSS('background-color', 'rgb(158, 47, 47)');
        assert.equal((await changes()).length, count);
        await page.locator('[data-variant-cancel]').click();
        await expect.poll(() => target.getAttribute('data-story')).toBe(original);
        assert.equal(await target.getAttribute('style'), style);
        await expect(chooser).toBeFocused();
      },
    );
    await check(
      'variant acceptance makes one source-traceable change with exact undo and redo',
      async () => {
        const target = frame.locator('[data-foundry-id="create-workspace-button"]');
        const original = await target.getAttribute('data-story');
        await page.locator('[data-next-variant]').selectOption('morrow-action-quiet');
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
        await page.locator('[data-next-variant]').selectOption('morrow-action-quiet');
        await expect(page.locator('[data-variant-use]')).toBeEnabled();
        await page.locator('.next-focus').click();
        await page.locator('[data-next-canvas]').click();
        await expect(target).toHaveAttribute('data-story', 'Quiet');
        await select('[data-foundry-id="password-reveal"]');
        await expect.poll(() => target.getAttribute('data-story')).toBe(original);
        await expect(page.locator('.next-unavailable')).toHaveText('No variants exposed');
        await select('[data-foundry-id="create-workspace-button"]');
        await page.locator('[data-next-variant]').selectOption('morrow-action-danger');
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
        await page.locator('[data-next-variant]').selectOption('morrow-action-quiet');
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
        await edit('opacity', '.5');
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
        const position = page.locator('[data-next-field="objectPosition"]');
        await expect(fit).toHaveValue('fill');
        await expect(position).toHaveValue('50% 50%');
        await expect(page.locator('[data-next-field="src"]')).toHaveCount(0);
        await expect(page.locator('[data-section="Typography"]')).toHaveCount(0);
        await expect(page.locator('[data-next-field="color"]')).toHaveCount(0);
        await expect(page.locator('[data-next-field="textContent"]')).toHaveCount(0);
        await position.fill('left top');
        await expect(image).toHaveCSS('object-position', '0% 0%');
        assert.equal((await changes()).length, count);
        await position.press('Escape');
        await expect.poll(() => image.getAttribute('style')).toBe(original);
        await position.fill('banana');
        await position.press('Enter');
        await expect(page.locator('.next-edit-error')).toContainText('valid object position');
        await expect(position).toHaveValue('banana');
        assert.equal((await changes()).length, count);
        await position.press('Escape');
        await expect(page.locator('.next-edit-error')).toBeHidden();
        await fit.selectOption('cover');
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
        await page.locator('[data-next-field="objectFit"]').selectOption('contain');
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
        await page.locator('[data-next-field="objectFit"]').selectOption('contain');
        await expect(page.locator('.next-edit-error')).toBeVisible();
        await expect(page.locator('[data-next-field="objectFit"]')).toHaveValue('contain');
        await expect.poll(() => image.getAttribute('style')).toBe(original);
        assert.equal((await changes()).length, count);
        await context.unroute('**/change-records');
        await page.locator('[data-next-field="objectFit"]').press('Escape');
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
      await fontSize().press('Escape');
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
      await fontSize().press('Enter');
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
          assert.equal((await page.locator('.next-source-footer').boundingBox()).y + 44, height);
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
              await expect(page.locator('[data-next-field="objectFit"]')).toBeInViewport();
              const fit = await page
                .locator('[data-property="objectFit"] .next-field')
                .boundingBox();
              const position = await page
                .locator('[data-property="objectPosition"] .next-field')
                .boundingBox();
              assert.equal(fit.width, 130);
              assert.equal(fit.height, 32);
              assert.equal(position.width, 130);
              assert.equal(position.y, fit.y);
              assert.equal(position.x - fit.x - fit.width, 8);
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
          await page.locator('[data-next-variant]').selectOption('morrow-action-quiet');
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
          await expect(page.locator('[data-next-variant]')).toBeFocused();
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
        await page.locator('[data-next-variant]').selectOption('morrow-action-quiet');
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
