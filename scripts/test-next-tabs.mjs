import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Existing isolated Next preview; temporary selection/Focus only, no ledger edits.
const { url } = JSON.parse(readFileSync('artifacts/next-workspace/preview.json', 'utf8'));
const artifacts = resolve('artifacts/next-workspace/tabs');
mkdirSync(artifacts, { recursive: true });
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
    const tabs = page.locator('.next-tabs');
    const canvas = page.locator('[data-next-canvas]');
    const plus = page.locator('[data-next-tools]');
    const focusTab = page.locator('[data-next-focus-tab]');
    const menu = page.locator('#studio-navigation');
    for (const width of [1280, 1920]) {
      await page.setViewportSize({ width, height: width === 1920 ? 1080 : 768 });
      const strip = await tabs.boundingBox();
      const button = await canvas.boundingBox();
      assert.equal(strip.y, 0);
      assert.equal(strip.height, 48);
      const item = await canvas.locator('..').boundingBox();
      assert.equal(item.x, strip.x);
      assert.equal(item.y, 4);
      assert.equal(item.height, 44);
      assert.equal(item.y + item.height, strip.y + strip.height);
      assert.equal(button.height, 24);
      assert.ok(button.width < 112, 'Content-led Canvas tab, not a fixed-width button');
      const label = await canvas.locator('span').boundingBox();
      assert.ok(button.x + button.width - (label.x + label.width) >= 12);
      assert.equal((await canvas.locator('svg').boundingBox()).x, strip.x + 24);
      assert.equal(button.y, 12);
      await assertHeaderAlignment(page);
      assert.equal((await page.locator('.workspace').boundingBox()).y, 48);
      assert.equal(
        await canvas
          .locator('svg path')
          .first()
          .evaluate((el) => getComputedStyle(el).vectorEffect),
        'none',
      );
      assert.equal((await plus.boundingBox()).height, 24);
      assert.equal((await page.locator('.app-bar').boundingBox()).height, 48);
      await expect(canvas).toHaveAttribute('aria-current', 'page');
      await expect(canvas).toHaveAttribute('aria-selected', 'true');
      const shape = await canvas.locator('..').evaluate((el) => {
        const body = getComputedStyle(el, '::before');
        const feet = getComputedStyle(el, '::after');
        return {
          radius: body.borderTopLeftRadius,
          bottomRadius: body.borderBottomLeftRadius,
          background: body.backgroundColor,
          wings: feet.backgroundImage,
          height: feet.height,
          pointerEvents: feet.pointerEvents,
          border: getComputedStyle(el).borderTopWidth,
        };
      });
      assert.equal(shape.radius, '12px');
      assert.equal(shape.bottomRadius, '0px');
      assert.equal(
        shape.background,
        await page
          .locator('.dock-head')
          .first()
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      );
      assert.equal(shape.border, '0px');
      assert.equal(shape.height, '12px');
      assert.equal(shape.pointerEvents, 'none');
      assert.equal(shape.wings.match(/radial-gradient/g)?.length, 2);
      await tabs.screenshot({ path: resolve(artifacts, `${theme}-${width}.png`) });
      await plus.hover();
      await expect(plus).toHaveCSS(
        'background-color',
        await plus.evaluate((el) => {
          const hex = getComputedStyle(el).getPropertyValue('--chrome-hover').trim();
          return `rgb(${hex
            .slice(1)
            .match(/../g)
            .map((value) => parseInt(value, 16))
            .join(', ')})`;
        }),
      );
      await page.mouse.move(width - 16, 120);
      await expect(plus).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      checks.push(
        `${theme} ${width}: browser tab geometry, connected active surface, scaled icon strokes`,
      );
    }
    await page.setViewportSize({ width: 1280, height: 768 });
    await canvas.focus();
    await page.keyboard.press('ArrowRight');
    await expect(plus).toBeFocused();
    await page.keyboard.press('Home');
    await expect(canvas).toBeFocused();
    await page.keyboard.press('End');
    await expect(plus).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(plus).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toBeVisible();
    assert.equal((await menu.boundingBox()).y, (await tabs.boundingBox()).y + 56);
    assert.equal((await menu.boundingBox()).x, (await plus.boundingBox()).x);
    await page.screenshot({ path: resolve(artifacts, `${theme}-tools.png`) });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(plus).toBeFocused();
    await expect(plus).toHaveAttribute('aria-expanded', 'false');
    assert.match(await plus.evaluate((el) => getComputedStyle(el).boxShadow), /inset/);
    await tabs.screenshot({ path: resolve(artifacts, `${theme}-keyboard-focus.png`) });
    checks.push(`${theme}: keyboard navigation, anchored Tools, Escape focus return`);
    await plus.click();
    await menu.locator('[data-workspace-mode="system"]').click();
    await expect(page.locator('#app-shell')).toHaveAttribute('data-mode', 'system');
    const systemTab = page.locator('[data-next-mode="system"]');
    await expect(systemTab).toContainText('Design');
    await expect(systemTab).toHaveAttribute('aria-selected', 'true');
    await expect(canvas).not.toHaveAttribute('aria-current', 'page');
    await expect(menu).toBeHidden();
    await expect(plus).toHaveAttribute('aria-expanded', 'false');
    const canvasBounds = await canvas.locator('..').boundingBox();
    const systemBounds = await systemTab.locator('..').boundingBox();
    assert.ok(canvasBounds.width >= 112 && canvasBounds.width < 116);
    assert.equal(Math.round(systemBounds.x - (canvasBounds.x + canvasBounds.width)), -16);
    assert.equal(Math.round(systemBounds.x + 12 - (canvasBounds.x + canvasBounds.width - 12)), 8);
    await tabs.screenshot({ path: resolve(artifacts, `${theme}-studio.png`) });
    await canvas.click();
    await expect(canvas).toHaveAttribute('aria-current', 'page');
    await expect(systemTab).toBeVisible();
    await systemTab.click();
    await expect(page.locator('#app-shell')).toHaveAttribute('data-mode', 'system');
    await plus.click();
    await menu.locator('[data-workspace-mode="system"]').click();
    await expect(systemTab).toHaveCount(1);
    await expect(page.locator('#next-workspace-panel')).toHaveAttribute(
      'aria-labelledby',
      'next-tab-system',
    );
    await page.locator('[data-next-close="system"]').click();
    await expect(systemTab).toHaveCount(0);
    await expect(canvas).toBeFocused();
    await expect(canvas).toHaveAttribute('aria-selected', 'true');
    checks.push(`${theme}: open, revisit, deduplicate and close tool tabs; pinned Canvas return`);
    const frame = page.frameLocator('#product-preview');
    await frame.locator('[data-foundry-id="story-title"]').click();
    await expect(page.locator('.next-focus')).toBeVisible();
    await page.locator('.next-focus').click();
    await expect(focusTab).toBeVisible();
    await expect(focusTab).toHaveAttribute('aria-current', 'page');
    await expect(canvas).not.toHaveAttribute('aria-current', 'page');
    await tabs.screenshot({ path: resolve(artifacts, `${theme}-selection-focus.png`) });
    await focusTab.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(canvas).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(focusTab).toBeHidden();
    await expect(canvas).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.next-focus')).toHaveAttribute('aria-pressed', 'false');
    checks.push(`${theme}: acknowledged Focus and keyboard Canvas return`);
    for (const mode of [
      'system',
      'typography',
      'components',
      'motion',
      'recipes',
      'health',
      'states',
      'responsive',
      'memory',
    ]) {
      await plus.click();
      await menu.locator(`[data-workspace-mode="${mode}"]`).click();
      await expect(page.locator(`[data-next-mode="${mode}"]`)).toHaveAttribute(
        'aria-selected',
        'true',
      );
      const currentTab = page.locator(`[data-next-mode="${mode}"]`);
      const item = await currentTab.locator('..').boundingBox();
      const artwork = await currentTab.locator('svg').boundingBox();
      const label = await currentTab.locator('span').boundingBox();
      const close = page.locator(`[data-next-close="${mode}"]`);
      const target = await close.boundingBox();
      assert.equal(artwork.x - (item.x + 12), 12, 'Icon inset from tab body');
      assert.equal(label.x - (artwork.x + artwork.width), 8, 'Icon to label');
      assert.ok(Math.abs(target.x - (label.x + label.width) - 8) < 1, 'Label to close target');
      assert.equal(
        item.x + item.width - 12 - (target.x + target.width),
        12,
        'Close inset from tab body',
      );
      assert.equal(target.y - item.y, 8);
      assert.equal(item.y + item.height - target.y - target.height, 12);
      assert.equal(artwork.y + artwork.height / 2, target.y + target.height / 2);
      assert.equal(label.y + label.height / 2, target.y + target.height / 2);
      await assertHeaderAlignment(page);
      if (mode === 'components') {
        await page
          .locator('.app-bar')
          .screenshot({ path: resolve(artifacts, `${theme}-header-alignment.png`) });
        await close.hover();
        await currentTab
          .locator('..')
          .screenshot({ path: resolve(artifacts, `${theme}-component-padding.png`) });
      }
    }
    const list = page.locator('.next-tab-list');
    assert.equal(await list.evaluate((el) => el.scrollWidth > el.clientWidth), true);
    assert.ok((await plus.boundingBox()).x + 24 <= 1280);
    assert.ok(
      (await plus.boundingBox()).x + 24 <=
        (await page.locator('.app-actions').boundingBox()).x - 16,
    );
    const activeItem = await page.locator('[data-next-mode="memory"]').locator('..').boundingBox();
    const listBounds = await list.boundingBox();
    assert.ok(activeItem.x >= listBounds.x);
    assert.ok(
      activeItem.x + activeItem.width <= listBounds.x + listBounds.width + 1,
      'Active tab including close stays entirely visible',
    );
    await tabs.screenshot({ path: resolve(artifacts, `${theme}-many-tabs.png`) });
    await page.locator('[data-next-mode="memory"]').focus();
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-next-mode="memory"]')).toHaveCount(0);
    await expect(page.locator('[data-next-mode="responsive"]')).toBeFocused();
    await expect(page.locator('[data-next-mode="responsive"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.locator('[data-next-close="system"]').click();
    await expect(page.locator('#app-shell')).toHaveAttribute('data-mode', 'responsive');
    await canvas.click();
    await expect(canvas).toHaveAttribute('aria-selected', 'true');
    assert.equal(await list.evaluate((el) => el.scrollLeft), 0);
    await expect(tabListSelected(page)).toHaveCount(1);
    checks.push(
      `${theme}: overflow keeps plus reachable, Delete selects adjacent tab, inactive close preserves active view`,
    );
    await plus.click();
    await page.locator('.app-identity strong').click();
    await expect(menu).toBeHidden();
    await expect(plus).toHaveAttribute('aria-expanded', 'false');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.ok(
      await canvas.evaluate((el) =>
        getComputedStyle(el)
          .transitionDuration.split(',')
          .every((value) => parseFloat(value) <= 0.00001),
      ),
    );
    assert.equal(await tabs.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    checks.push(`${theme}: outside dismissal, no overflow and reduced motion`);
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

function tabListSelected(page) {
  return page.locator('.next-tab-list [aria-selected="true"]');
}

async function assertHeaderAlignment(page) {
  const positions = await page.locator('.app-bar').evaluate((bar) => {
    const centre = bar.getBoundingClientRect().y + bar.getBoundingClientRect().height / 2;
    const selector =
      '.app-identity > strong, #live-status i, #live-status span, #live-status svg, .next-tab span, .next-tab svg, .next-tab-close svg, [data-next-tools] svg, .app-actions button > span, .app-actions button > svg';
    return [...bar.querySelectorAll(selector)].flatMap((el) => {
      const rect = el.getBoundingClientRect();
      return rect.height && rect.width
        ? [
            {
              name:
                el.textContent || el.closest('button')?.getAttribute('aria-label') || el.tagName,
              delta: rect.y + rect.height / 2 - centre,
            },
          ]
        : [];
    });
  });
  assert.ok(positions.length >= 10);
  for (const position of positions)
    assert.ok(
      Math.abs(position.delta) < 0.5,
      `${position.name} is ${position.delta}px off the shared header centreline`,
    );
}
