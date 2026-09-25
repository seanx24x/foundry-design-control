import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Inspect the current session in isolated browser contexts. Never stage or apply edits.
const { url } = JSON.parse(readFileSync('artifacts/next-workspace/preview.json', 'utf8'));
const artifacts = resolve('artifacts/next-workspace/toolbar');
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
    const bar = page.locator('.canvas-toolbar');
    const ledger = await page.locator('#persistent-review-count').textContent();
    for (const width of [1280, 1920]) {
      await page.setViewportSize({ width, height: width === 1280 ? 768 : 1080 });
      const b = await bar.boundingBox(),
        canvas = await page.locator('.canvas-mode').boundingBox();
      assert.equal(b.height, 40);
      assert.ok(Math.abs(b.x + b.width / 2 - canvas.x - canvas.width / 2) < 1);
      assert.equal(canvas.y + canvas.height - b.y - b.height, 24);
      const summary = page.locator('#change-summary');
      if (await summary.isVisible()) {
        const s = await summary.boundingBox();
        assert.equal(s.height, 56);
        assert.equal(b.y - s.y - s.height, 8);
        assert.ok(Math.abs(s.x + s.width / 2 - b.x - b.width / 2) < 1);
        assert.ok(s.width <= Math.min(480, canvas.width - 32));
        assert.equal(await summary.evaluate((el) => el.scrollWidth > el.clientWidth), false);
        await expect(summary.locator('#compare svg')).toHaveAttribute(
          'data-icon-family',
          'heroicons',
        );
        for (const button of await summary.locator('button').all()) {
          assert.equal((await button.boundingBox()).height, 32);
        }
      }
      await expect(bar).toHaveCSS('border-radius', '8px');
      const geometry = await bar.locator('button:visible').evaluateAll((nodes) =>
        nodes.map((n) => {
          const b = n.getBoundingClientRect(),
            icon = n.querySelector('svg').getBoundingClientRect();
          return {
            width: b.width,
            height: b.height,
            cy: b.y + b.height / 2,
            iconW: icon.width,
            iconH: icon.height,
            iconCy: icon.y + icon.height / 2,
            iconCx: icon.x + icon.width / 2,
            cx: b.x + b.width / 2,
            label: n.getAttribute('aria-label'),
            family: n.querySelector('svg').dataset.iconFamily,
          };
        }),
      );
      assert.equal(geometry.length, 6);
      assert.deepEqual(
        geometry.slice(0, 5).map((n) => n.label),
        ['Select', 'Interact', 'Open tools', 'Undo', 'Redo'],
      );
      for (const control of geometry) {
        assert.equal(control.height, 24);
        assert.equal(control.iconW, 16);
        assert.equal(control.iconH, 16);
        assert.equal(control.cy, b.y + 20);
        assert.equal(control.iconCy, control.cy);
        assert.equal(control.family, control.label === 'Select' ? 'foundry' : 'heroicons');
        if (control.label !== 'Canvas zoom') {
          assert.equal(control.width, 24);
          assert.equal(control.iconCx, control.cx);
        }
      }
      await expect(bar.locator('.tool-rule')).toHaveCount(3);
      await bar.screenshot({ path: resolve(artifacts, `${theme}-${width}.png`) });
      checks.push(
        `${theme} ${width}: 40px bar, 24px targets, 16px icons, shared centreline and grouping`,
      );
    }
    const select = bar.locator('[data-canvas-mode="select"]'),
      interact = bar.locator('[data-canvas-mode="interact"]');
    await interact.click();
    await expect(interact).toHaveAttribute('aria-pressed', 'true');
    await expect(select).toHaveAttribute('aria-pressed', 'false');
    await select.click();
    await expect(select).toHaveAttribute('aria-pressed', 'true');
    await expect(select).toHaveCSS(
      'background-color',
      await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.backgroundColor = 'var(--selection-soft)';
        document.body.append(probe);
        const color = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return color;
      }),
    );
    const tools = bar.locator('.next-tools');
    await tools.focus();
    await page.keyboard.press('Enter');
    await expect(tools).toHaveAttribute('aria-expanded', 'true');
    const menu = page.locator('#studio-navigation');
    await expect(menu).toBeVisible();
    const m = await menu.boundingBox(),
      b = await bar.boundingBox();
    assert.equal(b.y - m.y - m.height, 8);
    assert.ok(Math.abs(m.x + m.width / 2 - b.x - b.width / 2) < 1);
    await page.screenshot({ path: resolve(artifacts, `${theme}-tools.png`) });
    await page.keyboard.press('Escape');
    await expect(tools).toBeFocused();
    await expect(tools).toHaveAttribute('aria-expanded', 'false');
    await tools.click();
    await page.locator('#layers-dock .dock-head').click();
    await expect(menu).toBeHidden();
    const zoom = bar.locator('[data-select-for="canvas-zoom"]');
    await zoom.click();
    await expect(page.locator('#canvas-zoom-listbox')).toBeVisible();
    await page.getByRole('option', { name: '50%', exact: true }).click();
    await expect(page.locator('#preview-frame')).toHaveAttribute('style', /scale\(0\.5\)/);
    await expect(zoom).toHaveAttribute('title', 'Canvas zoom: 50%');
    await zoom.click();
    await page.keyboard.press('Escape');
    await expect(zoom).toBeFocused();
    await zoom.click();
    await page.getByRole('option', { name: 'Fit', exact: true }).click();
    assert.equal(await page.locator('#persistent-review-count').textContent(), ledger);
    checks.push(
      `${theme}: Select/Interact, Tools keyboard/cancel/outside dismissal, real zoom, unchanged ledger`,
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(resolve(artifacts, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(checks.join('\n'));
} finally {
  await browser.close();
}
