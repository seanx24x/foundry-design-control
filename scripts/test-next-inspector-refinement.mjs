import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Read-only visual checks plus cancellable local drafts. Never accept or apply edits.
const { url } = JSON.parse(readFileSync('artifacts/next-workspace/preview.json', 'utf8'));
const artifacts = resolve('artifacts/next-workspace/inspector-refinement');
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
    const ledger = await page.locator('#persistent-review-count').textContent();
    const panel = page.locator('#inspector-dock');
    const select = async (label) => {
      await page
        .locator('#layers-dock .layer-row')
        .filter({ has: page.locator(`.layer-label:text-is("${label}")`) })
        .click();
      await expect(panel.locator('.dock-head strong')).toHaveText(label);
    };
    for (const width of [1280, 1920]) {
      await page.setViewportSize({ width, height: width === 1280 ? 768 : 1080 });
      for (const [name, label] of [
        ['text', 'Make room for the work that matters.'],
        ['container', 'Shared working note'],
        ['component', 'Create workspace'],
      ]) {
        await select(label);
        assert.equal((await panel.boundingBox()).width, 300);
        assert.equal((await panel.locator('.dock-head').boundingBox()).height, 44);
        assert.equal((await panel.locator('.next-source-footer').boundingBox()).height, 44);
        const fields = await panel.locator('.next-field:visible').evaluateAll((nodes) =>
          nodes.map((n) => ({
            width: n.getBoundingClientRect().width,
            height: n.getBoundingClientRect().height,
            overflow: n.scrollWidth > n.clientWidth,
          })),
        );
        assert.ok(fields.length);
        for (const section of await panel
          .locator('.next-section:has(> .next-section-head[aria-expanded="false"])')
          .all()) {
          assert.equal((await section.boundingBox()).height, 40);
        }
        for (const scrub of await panel.locator('.next-scrub:visible').all()) {
          const bounds = await scrub.boundingBox();
          assert.equal(bounds.width, 24);
          assert.equal(bounds.height, 24);
        }
        for (const field of fields)
          assert.ok(
            [130, 268].includes(field.width) && field.height === 32 && !field.overflow,
            JSON.stringify(field),
          );
        const icons = await panel.locator('svg:visible').evaluateAll((nodes) =>
          nodes.map((n) => ({
            family: n.dataset.iconFamily,
            width: n.getBoundingClientRect().width,
            height: n.getBoundingClientRect().height,
          })),
        );
        for (const icon of icons)
          assert.deepEqual(icon, { family: 'heroicons', width: 16, height: 16 });
        assert.equal(
          await panel.locator('.inspector-scroll').evaluate((n) => n.scrollWidth > n.clientWidth),
          false,
        );
        await panel.screenshot({ path: resolve(artifacts, `${theme}-${width}-${name}.png`) });
        const toggle = panel.locator('.next-source-footer');
        const details = panel.locator('.next-source-details');
        const scroll = panel.locator('.inspector-scroll');
        await scroll.evaluate((n) => {
          n.scrollTop = 0;
        });
        await toggle.focus();
        await page.keyboard.press('Enter');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(toggle.locator('svg').last()).toHaveCSS(
          'transform',
          'matrix(-1, 0, 0, -1, 0, 0)',
        );
        await expect(details).toBeVisible();
        assert.equal(await panel.locator('.inspector-scroll .next-source-details').count(), 0);
        const headerBox = await toggle.boundingBox();
        const detailBox = await details.boundingBox();
        const dockBox = await panel.locator('.next-source-dock').boundingBox();
        const panelBox = await panel.boundingBox();
        assert.equal(detailBox.y, headerBox.y + 44);
        assert.equal(dockBox.y + dockBox.height, panelBox.y + panelBox.height);
        assert.ok(dockBox.height <= 320);
        assert.equal(await scroll.evaluate((n) => n.scrollTop), 0);
        assert.equal(await details.evaluate((n) => n.scrollWidth > n.clientWidth), false);
        await page.keyboard.press('Tab');
        await expect(details).toBeFocused();
        await panel.screenshot({
          path: resolve(artifacts, `${theme}-${width}-${name}-source.png`),
        });
        await toggle.focus();
        await page.keyboard.press('Space');
        await expect(details).toBeHidden();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(toggle.locator('svg').last()).toHaveCSS('transform', 'none');
        assert.equal((await panel.locator('.next-source-dock').boundingBox()).height, 44);
        checks.push(
          `${theme} ${width} ${name}: inspector geometry, bottom-anchored source accordion below its header, keyboard toggle, no scroll jump or horizontal overflow`,
        );
      }
    }
    await select('Make room for the work that matters.');
    const footerBefore = await panel.locator('.next-source-footer').boundingBox();
    const more = panel.locator('[data-more="Typography"]');
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    assert.deepEqual(await panel.locator('.next-source-footer').boundingBox(), footerBefore);
    await more.click();
    await panel.locator('[data-font-picker]').click();
    await expect(page.locator('.next-font-picker')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel font selection' }).click();
    await expect(page.locator('.next-font-picker')).toHaveCount(0);
    const input = panel.locator('[data-next-field="fontSize"]');
    const before = await input.inputValue();
    const title = page.frameLocator('#product-preview').locator('[data-foundry-id="story-title"]');
    const originalStyle = await title.getAttribute('style');
    const originalSize = await title.evaluate((n) => getComputedStyle(n).fontSize);
    await input.fill(String(Number(before) + 4));
    await expect
      .poll(() => title.evaluate((n) => getComputedStyle(n).fontSize))
      .not.toBe(originalSize);
    await input.press('Escape');
    await expect.poll(() => title.getAttribute('style')).toBe(originalStyle);
    await expect(input).toHaveValue(before);
    await panel.locator('.next-source-footer').click();
    await expect(panel.locator('.next-source-details')).toBeVisible();
    assert.equal(
      await panel.locator('.inspector-scroll').evaluate((n) => n.scrollWidth > n.clientWidth),
      false,
    );
    await panel.locator('.next-source-footer').click();
    assert.equal(await page.locator('#persistent-review-count').textContent(), ledger);
    checks.push(
      `${theme}: inline expansion, font cancel, local typing and Escape restore, source disclosure; review count unchanged`,
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(resolve(artifacts, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally {
  await browser.close();
}
