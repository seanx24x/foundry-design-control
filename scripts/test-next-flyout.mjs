import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const { url } = JSON.parse(readFileSync('artifacts/next-workspace/preview.json', 'utf8'));
const artifacts = resolve('artifacts/next-workspace/flyout');
mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch();
const checks = [],
  errors = [];
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
    const menu = page.locator('#studio-navigation');
    const trigger = page.locator('.canvas-toolbar .next-tools');
    const ledger = await page.locator('#persistent-review-count').textContent();
    for (const width of [1280, 1920]) {
      await page.setViewportSize({ width, height: width === 1280 ? 768 : 1080 });
      await trigger.click();
      await expect(menu).toBeVisible();
      const box = await menu.boundingBox();
      assert.equal(box.width, 552);
      assert.equal(box.height, 240);
      const groups = await menu.locator('.studio-nav-group').evaluateAll((nodes) =>
        nodes.map((node) => {
          const b = node.getBoundingClientRect();
          return { x: b.x, y: b.y, bottom: b.bottom };
        }),
      );
      assert.equal(groups[0].y, groups[1].y);
      assert.ok(groups[1].x > groups[0].x);
      assert.ok(groups[2].x > groups[1].x);
      assert.equal(groups[2].y, groups[1].y);
      await expect(menu.locator('.rail-button')).toHaveCount(13);
      const rows = await menu.locator('.rail-button').evaluateAll((nodes) =>
        nodes.map((node) => {
          const b = node.getBoundingClientRect(),
            svg = node.querySelector('svg'),
            i = svg.getBoundingClientRect(),
            label = node.querySelector('span'),
            l = label.getBoundingClientRect();
          return {
            h: b.height,
            icon: [i.width, i.height],
            labelX: l.x - i.right,
            cy: i.y + i.height / 2 - b.y,
            clipped: label.scrollWidth > label.clientWidth,
            family: svg.dataset.iconFamily,
            mode: node.dataset.workspaceMode,
          };
        }),
      );
      for (const row of rows) {
        assert.equal(row.h, 32);
        assert.deepEqual(row.icon, [16, 16]);
        assert.equal(row.labelX, 8);
        assert.equal(row.cy, 16);
        assert.equal(row.clipped, false, row.mode);
        assert.equal(row.family, row.mode === 'canvas' ? 'foundry' : 'heroicons');
      }
      for (const heading of await menu.locator('h2').all())
        await expect(heading).toHaveCSS('text-transform', 'none');
      await menu.screenshot({ path: resolve(artifacts, `${theme}-${width}.png`) });
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      checks.push(
        `${theme} ${width}: 552x240, three aligned columns, 13 readable 32px rows and 16px icons`,
      );
    }
    const plus = page.locator('[data-next-tools]');
    // Exercise each existing navigation destination without staging changes or running audits.
    const modes = await menu
      .locator('.rail-button')
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.workspaceMode));
    for (const mode of modes) {
      await plus.click();
      const button = menu.locator(`[data-workspace-mode="${mode}"]`);
      await button.focus();
      await page.keyboard.press('Enter');
      await expect(menu).toBeHidden();
      await expect(page.locator('#app-shell')).toHaveAttribute('data-mode', mode);
    }
    await page.locator('[data-next-canvas]').click();
    await trigger.click();
    await expect(menu.locator('[aria-current="page"]')).toHaveAttribute(
      'data-workspace-mode',
      'canvas',
    );
    await page.keyboard.press('Tab');
    await expect(menu.locator('[data-workspace-mode="components"]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    assert.equal(await page.locator('#persistent-review-count').textContent(), ledger);
    checks.push(
      `${theme}: every destination opens by keyboard, selection updates, Tab and Escape return work, ledger unchanged`,
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(resolve(artifacts, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(checks.join('\n'));
} finally {
  await browser.close();
}
