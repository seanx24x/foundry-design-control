import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Exercise the current isolated Morrow session. No staging, source writes or resets.
const { url } = JSON.parse(readFileSync('artifacts/next-workspace/preview.json', 'utf8'));
const artifacts = resolve('artifacts/next-workspace/structure');
mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
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
    const panel = page.locator('#layers-dock');
    const rows = panel.locator('.layer-row');
    await expect(rows.first()).toBeVisible();
    const originalCount = await rows.count();
    const ledger = await page.locator('#persistent-review-count').textContent();
    const search = page.locator('#structure-search');
    const list = page.locator('#structure-list');
    const intro = panel.locator('.layer-row[title="Product introduction"]');
    for (const width of [1280, 1920]) {
      await page.setViewportSize({ width, height: width === 1920 ? 1080 : 768 });
      const bounds = await panel.boundingBox();
      assert.equal(bounds.width, 300);
      assert.equal((await panel.locator('.dock-head').boundingBox()).height, 44);
      const segments = await panel.locator('.segmented').boundingBox();
      assert.equal(segments.height, 48);
      assert.equal(
        (await panel.locator('[data-structure-tab="layers"]').boundingBox()).x - bounds.x,
        16,
      );
      const field = await panel.locator('.search-field').boundingBox();
      assert.equal(field.x - bounds.x, 16);
      assert.equal(field.width, 268);
      assert.equal(field.height, 24);
      assert.equal(field.y, segments.y + segments.height);
      const geometry = await rows.evaluateAll((items) =>
        items.map((row) => {
          const box = row.getBoundingClientRect();
          const nodes = ['.chevron', '.layer-icon', '.layer-label', '.layer-meta'].map((selector) =>
            row.querySelector(selector).getBoundingClientRect(),
          );
          return {
            height: box.height,
            depth: Number(row.style.getPropertyValue('--depth')),
            left: box.left,
            columnX: nodes[0].x,
            centers: nodes.map((rect) => rect.y + rect.height / 2 - box.y),
            overflow: row.scrollWidth > row.clientWidth,
          };
        }),
      );
      for (const row of geometry) {
        assert.equal(row.height, 32);
        assert.equal(row.columnX - row.left, 8 + row.depth * 12);
        assert.ok(row.centers.every((center) => Math.abs(center - 16) < 0.5));
        assert.equal(row.overflow, false);
      }
      await intro.click();
      await expect(intro).toHaveCSS('line-height', '20px');
      await expect(intro.locator('.layer-icon svg')).toHaveCSS('width', '16px');
      await expect(intro.locator('.layer-icon svg')).toHaveCSS('height', '16px');
      await expect(intro).toHaveAttribute('aria-selected', 'true');
      await expect(intro).toHaveCSS('box-shadow', 'none');
      await expect(intro.locator('.layer-meta')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await panel.screenshot({ path: resolve(artifacts, `${theme}-layers-${width}.png`) });
      await intro.screenshot({ path: resolve(artifacts, `${theme}-selected-${width}.png`) });
      checks.push(
        `${theme} ${width}: fixed panel, shared insets, row geometry and measured selection`,
      );
    }
    await page.setViewportSize({ width: 1280, height: 768 });
    const rowWidth = (await intro.boundingBox()).width;
    await search.fill('Product introduction');
    await expect(rows).toHaveCount(1);
    assert.equal((await intro.boundingBox()).width, rowWidth);
    await expect(search).toHaveCSS('box-shadow', 'none');
    await expect(search).toHaveCSS('outline-width', '0px');
    await panel.screenshot({ path: resolve(artifacts, `${theme}-search.png`) });
    await search.fill('no-such-morrow-layer-927');
    await expect(list).toContainText('No layers match this search.');
    await search.press('Escape');
    await expect(rows).toHaveCount(originalCount);
    await expect(search).toBeFocused();
    await expect(panel.locator('.next-search-clear')).toBeHidden();
    await search.fill('Product introduction');
    await panel.getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(rows).toHaveCount(originalCount);
    await expect(search).toBeFocused();
    await page.keyboard.press('Tab');
    await intro.focus();
    assert.match(await intro.evaluate((el) => getComputedStyle(el).boxShadow), /inset/);
    await intro.screenshot({ path: resolve(artifacts, `${theme}-keyboard-focus.png`) });
    checks.push(
      `${theme}: stable search width, truthful empty result, clear/Escape and distinct keyboard focus`,
    );
    await panel.locator('[data-structure-tab="components"]').click();
    await expect(search).toHaveAttribute('placeholder', 'Search components');
    await expect(list).toHaveAttribute('role', 'group');
    const cards = panel.locator('.component-card');
    await expect(cards.first()).toBeVisible();
    assert.equal((await cards.first().boundingBox()).height, 48);
    await expect(cards.first()).toHaveAttribute('title', /.+/);
    await panel.screenshot({ path: resolve(artifacts, `${theme}-components.png`) });
    await search.fill('no-such-morrow-component-927');
    await expect(list).toContainText('No components match this search.');
    await search.press('Escape');
    await cards.first().click();
    await expect(page.locator('#app-shell')).toHaveAttribute('data-mode', 'components');
    await page.locator('[data-next-canvas]').click();
    await expect(panel).toBeVisible();
    await panel.locator('[data-structure-tab="layers"]').click();
    await expect(list).toHaveAttribute('role', 'tree');
    await expect(page.locator('#persistent-review-count')).toHaveText(ledger);
    checks.push(
      `${theme}: compact components, working search and Workshop navigation, unchanged review ledger`,
    );
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
