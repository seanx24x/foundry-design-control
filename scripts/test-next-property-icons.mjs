import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { NEXT_PROPERTY_ICONS } from '../apps/inspector/public/next-icons.js';

// Exercise real inspector fields without accepting edits or touching source.
const { url } = JSON.parse(readFileSync('artifacts/next-workspace/preview.json', 'utf8'));
const artifacts = resolve('artifacts/next-workspace/property-icons');
mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch();
const checks = [],
  errors = [];
let activePage;
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 768 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(10000);
    page.on('pageerror', (error) => errors.push(error.message));
    const address = new URL(url);
    address.searchParams.set('theme', theme);
    await page.goto(address.href, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#live-status')).toHaveAttribute('data-status', 'live', {
      timeout: 30000,
    });
    const ledger = await page.locator('#persistent-review-count').textContent();
    const panel = page.locator('#inspector-dock');
    const select = async (label) => {
      await page
        .locator('#layers-dock .layer-row')
        .filter({
          has: page.locator(`.layer-label:text-is("${label}")`),
        })
        .click();
      await expect(panel.locator('.dock-head strong')).toHaveText(label);
      const sections = await panel
        .locator('[data-section][aria-expanded="false"]')
        .evaluateAll((nodes) => nodes.map((node) => node.dataset.section));
      for (const name of sections) await panel.locator(`[data-section="${name}"]`).click();
      const advanced = await panel
        .locator('[data-more][aria-expanded="false"]')
        .evaluateAll((nodes) => nodes.map((node) => node.dataset.more));
      for (const name of advanced) await panel.locator(`[data-more="${name}"]`).click();
    };
    const audit = async (properties) => {
      for (const property of properties) {
        const field = panel.locator(`[data-property="${property}"]`);
        const scrub = field.locator('.next-scrub');
        await expect(scrub).toBeVisible();
        await expect(scrub).toHaveAccessibleName(
          `Scrub ${await field.locator('input').getAttribute('aria-label')}`,
        );
        await expect(scrub).toHaveAttribute('title', /: drag in whole-number steps/);
        const icon = scrub.locator('svg');
        await expect(icon).toHaveAttribute('data-foundry-icon', property);
        await expect(icon).toHaveAttribute('data-icon-family', 'foundry');
        await expect(icon).toHaveAttribute('viewBox', '0 0 16 16');
        const bounds = await icon.boundingBox();
        assert.equal(bounds.width, 16);
        assert.equal(bounds.height, 16);
        const target = await scrub.boundingBox();
        assert.equal(target.width, 24);
        assert.equal(target.height, 24);
        const wrapper = await field.locator('.next-field').boundingBox();
        assert.equal(wrapper.height, 32);
        assert.equal(bounds.y + 8, wrapper.y + 16);
      }
      assert.equal(
        await panel
          .locator(
            '.next-scrub svg[data-foundry-icon="layout"], .next-scrub svg[data-foundry-icon="typography"]',
          )
          .count(),
        0,
      );
    };
    for (const width of [1280, 1920]) {
      await page.setViewportSize({ width, height: width === 1280 ? 768 : 1080 });
      await select('Quick signup options');
      const padding = panel.locator('[data-linked-group="paddingLinked"]');
      const independent = padding.locator('[data-independent]');
      if ((await independent.getAttribute('aria-expanded')) === 'true') await independent.click();
      await audit([
        'width',
        'height',
        'gap',
        'rowGap',
        'columnGap',
        'paddingHorizontal',
        'paddingVertical',
      ]);
      await expect(padding.locator('[data-next-field="paddingHorizontal"]')).toHaveAccessibleName(
        'Padding horizontal',
      );
      await padding.screenshot({
        path: resolve(artifacts, `${theme}-${width}-padding-paired.png`),
      });
      await independent.click();
      await audit(['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']);
      await expect(padding.locator('[data-next-field="paddingTop"]')).toHaveAccessibleName(
        'Padding top',
      );
      await padding.screenshot({ path: resolve(artifacts, `${theme}-${width}-padding-sides.png`) });
      await padding.locator('[data-link]').click();
      await audit(['paddingLinked']);
      await padding.locator('[data-link]').click();
      await audit(['marginTop', 'marginRight', 'marginBottom', 'marginLeft']);
      await panel
        .locator('[data-more="Layout"] + .next-fields')
        .screenshot({ path: resolve(artifacts, `${theme}-${width}-layout-details.png`) });
      const radii = panel.locator('[data-linked-group="radiusLinked"]');
      if ((await radii.locator('[data-link]').getAttribute('aria-pressed')) === 'false')
        await radii.locator('[data-link]').click();
      await audit(['radiusLinked']);
      await radii.locator('[data-link]').click();
      await audit([
        'borderTopLeftRadius',
        'borderTopRightRadius',
        'borderBottomRightRadius',
        'borderBottomLeftRadius',
        'borderWidth',
      ]);
      await expect(radii.locator('[data-next-field="borderTopLeftRadius"]')).toHaveAccessibleName(
        'Top left radius',
      );
      await panel
        .locator('.next-section:has([data-section="Appearance"])')
        .screenshot({ path: resolve(artifacts, `${theme}-${width}-appearance.png`) });
      assert.equal(
        await panel
          .locator('.inspector-scroll')
          .evaluate((node) => node.scrollWidth > node.clientWidth),
        false,
      );
      checks.push(
        `${theme} ${width}: paired/independent/linked padding, outside margins, gap axes, dimensions, corners and border; 16px symbols centered in 24px scrubbers`,
      );
    }
    await select('Quick signup options');
    const target = page.frameLocator('#product-preview').locator('.social-actions');
    const originalStyle = await target.getAttribute('style');
    const padding = panel.locator('[data-linked-group="paddingLinked"]');
    const independent = padding.locator('[data-independent]');
    if ((await independent.getAttribute('aria-expanded')) !== 'true') await independent.click();
    const field = panel.locator('[data-property="paddingTop"]');
    await field.locator('.next-scrub').scrollIntoViewIfNeeded();
    const before = await field.locator('input').inputValue();
    const box = await field.locator('.next-scrub').boundingBox();
    await page.mouse.move(box.x + 12, box.y + 12);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 12, { steps: 4 });
    await expect(field.locator('input')).toHaveValue(String(Number(before) + 8));
    await expect
      .poll(() => target.evaluate((node) => getComputedStyle(node).paddingTop))
      .toBe(`${Number(before) + 8}px`);
    await field.locator('.next-scrub').dispatchEvent('pointercancel');
    await page.mouse.up();
    await expect.poll(() => target.getAttribute('style')).toBe(originalStyle);
    assert.equal(await page.locator('#persistent-review-count').textContent(), ledger);
    for (const icon of await panel.locator('.next-scrub svg').all()) {
      assert.ok(Object.hasOwn(NEXT_PROPERTY_ICONS, await icon.getAttribute('data-foundry-icon')));
    }
    checks.push(
      `${theme}: padding scrub previews and cancellation restores exact style; Review unchanged`,
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(resolve(artifacts, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} catch (error) {
  if (activePage && !activePage.isClosed())
    await activePage.screenshot({ path: resolve(artifacts, 'failure.png') });
  throw error;
} finally {
  await browser.close();
}
