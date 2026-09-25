import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Use the existing isolated session without staging edits or resetting its ledger.
const { url } = JSON.parse(readFileSync('artifacts/next-workspace/preview.json', 'utf8'));
const artifacts = resolve('artifacts/next-workspace/context-header');
mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch();
const checks = [],
  errors = [];
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
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
    await expect(page.locator('.next-context-icon')).toHaveCount(3);
    const ledger = await page.locator('#persistent-review-count').textContent();
    await page.locator('.layer-row[title="Shared working note"]').click();
    await expect(page.locator('.next-selection-name')).toHaveText('Shared working note');
    const scope = '.app-bar, #layers-dock, .canvas-context, #inspector-dock > .dock-head';
    const icons = page.locator(scope).locator('svg[data-foundry-icon]');
    assert.ok((await icons.count()) > 10);
    assert.equal(
      await icons.evaluateAll((nodes) => nodes.every((n) => n.dataset.iconFamily === 'heroicons')),
      true,
    );
    await expect(page.locator('[data-next-tools] svg')).toHaveAttribute('viewBox', '0 0 16 16');
    await expect(page.locator('[data-next-canvas] svg')).toHaveAttribute('viewBox', '0 0 24 24');
    assert.ok((await page.locator('.canvas-toolbar [data-icon-family="heroicons"]').count()) > 0);
    for (const width of [1920, 1280]) {
      await page.setViewportSize({ width, height: width === 1920 ? 1080 : 768 });
      const geometry = await page.evaluate(() => {
        const rect = (selector) => {
          const node = document.querySelector(selector),
            b = node.getBoundingClientRect();
          return {
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            cy: b.y + b.height / 2,
            overflow: node.scrollWidth > node.clientWidth,
          };
        };
        return {
          heads: ['#layers-dock .dock-head', '.canvas-context', '#inspector-dock .dock-head'].map(
            rect,
          ),
          texts: [
            '#layers-dock .dock-head strong',
            '.next-selection-name',
            '.next-selection-size',
            '#inspector-dock .dock-head strong',
            '.next-focus',
          ].map(rect),
          controls: [...document.querySelectorAll('.context-fields .foundry-select-trigger')].map(
            (n) => {
              const b = n.getBoundingClientRect();
              return {
                height: b.height,
                cy: b.y + b.height / 2,
                font: getComputedStyle(n).fontFamily,
                label: n.getAttribute('aria-label'),
              };
            },
          ),
          fields: rect('.context-fields'),
          detail: rect('#canvas-detail'),
          focus: rect('.next-focus'),
        };
      });
      for (const head of geometry.heads) {
        assert.equal(head.height, 44);
        assert.equal(head.y, 48);
        assert.equal(head.overflow, false);
      }
      for (const item of [...geometry.texts, ...geometry.controls])
        assert.ok(Math.abs(item.cy - 69.5) <= 0.5, JSON.stringify(item));
      for (const control of geometry.controls) assert.equal(control.height, 24);
      assert.ok(geometry.detail.x + geometry.detail.width + 15 <= geometry.fields.x);
      const inspector = geometry.heads[2];
      assert.equal(
        Math.round(inspector.x + inspector.width - geometry.focus.x - geometry.focus.width),
        16,
      );
      assert.equal(
        await page.locator('.next-selection-size').getAttribute('title').then(Boolean),
        true,
      );
      await page.screenshot({
        path: resolve(artifacts, `${theme}-${width}.png`),
        clip: { x: 0, y: 0, width, height: 180 },
      });
      checks.push({ theme, width, geometry });
    }
    for (const [id, label] of [
      ['canvas-viewport', 'Viewport'],
      ['canvas-theme', 'Theme'],
      ['canvas-state', 'State'],
    ]) {
      const trigger = page.locator(`[data-select-for="${id}"]`);
      await expect(trigger).toHaveAttribute('aria-label', new RegExp(`^${label}:`));
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator(`#${id}-listbox`)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }
    // Browser-only stress case: preserve full names in tooltips, truncate without moving controls.
    await page.evaluate(() => {
      document.querySelector('.next-selection-name').textContent =
        'A very long selected layer name that cannot fit on one line';
      document.querySelector('#inspector-dock .dock-head strong').textContent =
        'A very long selected layer name that cannot fit on one line';
    });
    assert.equal(
      await page.locator('.canvas-context').evaluate((n) => n.scrollWidth > n.clientWidth),
      false,
    );
    await page.screenshot({
      path: resolve(artifacts, `${theme}-long-name.png`),
      clip: { x: 0, y: 0, width: 1280, height: 180 },
    });
    assert.equal(await page.locator('#persistent-review-count').textContent(), ledger);
    await context.close();
  }
  assert.deepEqual(errors, []);
  const legacy = await browser.newPage();
  const legacyAddress = new URL(url);
  legacyAddress.searchParams.delete('ui');
  await legacy.goto(legacyAddress.href, { waitUntil: 'domcontentloaded' });
  await expect(legacy.locator('.app-bar svg').first()).toBeVisible();
  assert.equal(await legacy.locator('[data-icon-family="heroicons"]').count(), 0);
  await legacy.close();
  writeFileSync(resolve(artifacts, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(
    `Passed ${checks.length} light/dark header layouts, all three chooser keyboard paths, long labels and unchanged ledger.`,
  );
} finally {
  await browser.close();
}
