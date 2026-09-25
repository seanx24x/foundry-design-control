import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Read-only workflow against an existing isolated Next session. No source edits,
// Review staging or session reset. Synthetic long labels are browser-only cases.
const artifacts = resolve('artifacts/next-workspace/chrome');
mkdirSync(artifacts, { recursive: true });
const { url } = JSON.parse(readFileSync('artifacts/next-workspace/preview.json', 'utf8'));
const browser = await chromium.launch({ headless: true });
const checks = [];
const errors = [];
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 768 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    const address = new URL(url);
    address.searchParams.set('theme', theme);
    await page.goto(address.href, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#live-status')).toHaveAttribute('data-status', 'live', {
      timeout: 30000,
    });
    await page.evaluate(() => document.fonts.ready);
    const bar = page.locator('.app-bar');
    const ledger = await page.locator('#persistent-review-count').textContent();
    for (const width of [1280, 1920, 1024, 768]) {
      await page.setViewportSize({ width, height: width === 1920 ? 1080 : 768 });
      const geometry = await bar.evaluate((element) => {
        const box = (el) => {
          const rect = el.getBoundingClientRect();
          return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
        };
        return {
          bar: box(element),
          identity: box(element.querySelector('.app-identity')),
          actions: box(element.querySelector('.app-actions')),
          tabs: box(element.querySelector('.next-tabs')),
          controls: [
            ...element.querySelectorAll(
              '#live-status, #persistent-review, #workspace-menu-trigger',
            ),
          ].map(box),
          icons: [...element.querySelectorAll('.app-actions > button svg')]
            .filter((el) => el.getBoundingClientRect().width)
            .map(box),
        };
      });
      assert.equal(geometry.bar.h, 48);
      await expect(page.locator('#persistent-review')).toHaveCSS(
        'background-color',
        'rgb(255, 255, 255)',
      );
      await expect(bar).toHaveCSS('background-color', 'rgb(29, 29, 31)');
      await expect(bar.locator('.app-identity > strong')).toHaveCSS('color', 'rgb(251, 251, 253)');
      await expect(page.locator('#workspace-menu-trigger')).toHaveCSS(
        'color',
        'rgb(161, 161, 166)',
      );
      assert.equal(geometry.identity.x, 16);
      assert.equal(geometry.actions.x + geometry.actions.w, width - 16);
      assert.ok(geometry.controls.every((box) => box.h === 24 && box.y === 12));
      assert.ok(
        geometry.icons.length === 2 && geometry.icons.every((box) => box.w === 16 && box.h === 16),
      );
      assert.equal(geometry.tabs.y, 0);
      assert.equal(geometry.tabs.h, 48);
      await expect(page.locator('.next-tabs')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      assert.ok(Math.abs(geometry.tabs.x - (geometry.identity.x + geometry.identity.w + 16)) < 1);
      assert.ok(Math.abs(geometry.actions.x - (geometry.tabs.x + geometry.tabs.w + 16)) < 1);
      assert.equal((await page.locator('.workspace').boundingBox()).y, 48);
      await bar.screenshot({ path: resolve(artifacts, `${theme}-${width}.png`) });
      checks.push(`${theme} ${width}: 48px bar, 24px controls, 16px icons, aligned groups`);
    }
    await page.setViewportSize({ width: 1280, height: 768 });
    await page.locator('#workspace-menu-trigger').click();
    await expect(page.locator('#workspace-menu')).toBeVisible();
    await expect(page.locator('#workspace-menu')).toHaveCSS(
      'background-color',
      theme === 'light' ? 'rgb(251, 251, 253)' : 'rgb(22, 22, 23)',
    );
    await expect(page.locator('.app-actions #command-trigger')).toHaveCount(0);
    await expect(page.locator('#workspace-menu [data-workspace-mode]')).toHaveCount(0);
    assert.deepEqual(
      (await page.locator('#workspace-menu button, #workspace-menu a').allTextContents()).map(
        (text) => text.replace(/\s+/g, ' ').trim(),
      ),
      [
        /Mac/.test(await page.evaluate(() => navigator.platform))
          ? 'Find a command⌘K'
          : 'Find a commandCtrl K',
        'Connection details',
        `Theme: ${theme === 'light' ? 'Light' : 'Dark'}`,
        'Open direct preview',
      ],
    );
    await expect(page.locator('#workspace-menu-trigger')).toHaveAttribute('aria-expanded', 'true');
    await page
      .locator('#workspace-menu')
      .screenshot({ path: resolve(artifacts, `${theme}-menu-open.png`) });
    await page.locator('#command-trigger').click();
    await expect(page.locator('#workspace-menu')).toBeHidden();
    await expect(page.locator('#command-dialog')).toBeVisible();
    await page.locator('#command-input').fill('typography');
    await expect(page.locator('#command-list button')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#command-dialog')).toBeHidden();
    await expect(page.locator('#workspace-menu-trigger')).toBeFocused();
    for (const shortcut of ['Meta+k', 'Control+k']) {
      await page.locator('#structure-search').focus();
      await page.keyboard.press(shortcut);
      await expect(page.locator('#command-dialog')).toBeVisible();
      await expect(page.locator('#command-input')).toHaveValue('');
      await page.keyboard.press(shortcut);
      await expect(page.locator('#command-dialog')).toBeHidden();
      await expect(page.locator('#structure-search')).toBeFocused();
    }
    await page.keyboard.press('Meta+k');
    await page.locator('#command-input').fill('typography');
    await page.locator('[data-command-mode="typography"]').click();
    await expect(page.locator('#app-shell')).toHaveAttribute('data-mode', 'typography');
    await expect(page.locator('#command-dialog')).toBeHidden();
    await page.locator('[data-next-canvas]').click();
    for (let i = 0; i < 3; i++) {
      await page.locator('#workspace-menu-trigger').click();
      await page.locator('#workspace-menu [data-theme-choice]').click();
      await expect(page.locator('#workspace-menu')).toBeHidden();
      await expect(page.locator('#workspace-menu-trigger')).toBeFocused();
    }
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('#direct-preview-menu')).toHaveAttribute('target', '_blank');
    assert.ok(await page.locator('#direct-preview-menu').getAttribute('href'));
    await page.locator('#workspace-menu-trigger').click();
    await page.locator('[data-next-connection-menu]').click();
    await expect(page.locator('#workspace-menu')).toBeHidden();
    await expect(page.locator('#readiness-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#workspace-menu-trigger')).toBeFocused();
    await page.locator('#live-status').click();
    const connection = page.locator('#next-connection');
    await expect(connection).toBeVisible();
    await expect(page.locator('.app-identity #project-name')).toHaveCount(0);
    await expect(connection.locator('#project-name')).toHaveText('morrow');
    await expect(connection.locator('[data-next-connection="runtimeConnected"]')).toHaveText(
      'Connected',
    );
    await expect(connection.locator('[data-next-connection="connected"]')).toHaveText('Connected');
    await expect(connection.locator('[data-next-connection="listenerConnected"]')).toHaveText(
      /^(Connected|Not listening)$/,
    );
    await expect(page.locator('#readiness-dialog')).toBeHidden();
    await expect(page.locator('#live-status')).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: resolve(artifacts, `${theme}-connection.png`) });
    await page.keyboard.press('Escape');
    await expect(connection).toBeHidden();
    await expect(page.locator('#live-status')).toBeFocused();
    await expect(page.locator('#live-status')).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowDown');
    await expect(connection).toBeVisible();
    await expect(connection.locator('button')).toBeFocused();
    await connection.locator('button').click();
    await expect(connection).toBeHidden();
    await expect(page.locator('#readiness-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#readiness-dialog')).toBeHidden();
    await expect(page.locator('#live-status')).toBeFocused();
    await page.locator('#live-status').click();
    await page.locator('.app-identity strong').click();
    await expect(connection).toBeHidden();
    checks.push(
      `${theme}: project dropdown, separate connection states, details, keyboard and outside dismissal`,
    );
    await page.locator('#persistent-review').click();
    await expect(page.locator('#persistent-review')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#persistent-review')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    );
    await page.locator('[data-next-canvas]').click();
    await expect(page.locator('#app-shell')).toHaveAttribute('data-mode', 'canvas');
    checks.push(`${theme}: menu, commands, readiness and Review navigation work`);
    await page.locator('#persistent-review').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#workspace-menu-trigger')).toBeFocused();
    assert.equal(
      await page
        .locator('#workspace-menu-trigger')
        .evaluate((el) => getComputedStyle(el).outlineWidth),
      '0px',
    );
    assert.match(
      await page
        .locator('#workspace-menu-trigger')
        .evaluate((el) => getComputedStyle(el).boxShadow),
      /inset/,
    );
    await bar.screenshot({ path: resolve(artifacts, `${theme}-focus.png`) });
    checks.push(`${theme}: single inset keyboard focus`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.ok(
      await page.locator('#workspace-menu-trigger').evaluate((el) =>
        getComputedStyle(el)
          .transitionDuration.split(',')
          .every((duration) => parseFloat(duration) <= 0.00001),
      ),
      'Global reduced-motion rules may use 0.01ms rather than zero',
    );
    assert.equal(await page.locator('#persistent-review-count').textContent(), ledger);
    // Synthetic visual stress only, not a claim of an actual connection failure.
    await page.evaluate(() => {
      document.querySelector('#project-name').textContent =
        'Morrow / A deliberately long project name with more context than the available chrome width';
      document.querySelector('#persistent-review-count').textContent = '128';
      const status = document.querySelector('#live-status');
      status.dataset.status = 'degraded';
      status.querySelector('span').textContent = 'Reconnecting';
    });
    assert.equal(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    await bar.screenshot({ path: resolve(artifacts, `${theme}-long-labels.png`) });
    await page.setViewportSize({ width: 768, height: 768 });
    assert.equal(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    const plus = await page.locator('[data-next-tools]').boundingBox();
    const actions = await page.locator('.app-actions').boundingBox();
    assert.ok(plus.x + plus.width <= actions.x - 16);
    await bar.screenshot({ path: resolve(artifacts, `${theme}-long-labels-768.png`) });
    await page.locator('#live-status').click();
    await expect(connection).toBeVisible();
    assert.equal(await connection.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    assert.ok((await connection.locator('#project-name').boundingBox()).height >= 40);
    await connection.screenshot({ path: resolve(artifacts, `${theme}-connection-long-name.png`) });
    checks.push(`${theme}: long labels, three-digit count and reduced motion`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    resolve(artifacts, 'report.json'),
    JSON.stringify({ passed: checks.length, checks, errors }, null, 2),
  );
  console.log(checks.map((check) => `PASS ${check}`).join('\n'));
} finally {
  await browser.close();
}
