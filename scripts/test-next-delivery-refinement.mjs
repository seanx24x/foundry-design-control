import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Start scripts/test-next-delivery-fixture.mjs first. All records and writes are
// synthetic. Never point this check at a live Foundry session.
const address = new URL(process.env.FOUNDRY_DELIVERY_FIXTURE_URL ?? 'http://127.0.0.1:4689');
const artifacts = resolve('artifacts/next-workspace/delivery-refinement');
mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch();
const checks = [],
  errors = [];
let page;
try {
  for (const theme of ['light', 'dark']) {
    address.searchParams.set('theme', theme);
    page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(address.href, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#test-results')).toHaveText(
      /^PASS: 26 isolated checks\. Synthetic records;/,
    );
    checks.push(
      `${theme}: 26 existing interaction checks, including draft persistence, failures and verified immutability`,
    );
    await page.locator('[data-delivery-record="verified"]').click();
    const detail = page.locator('.delivery-record-detail');
    await expect(detail).toHaveAttribute('data-readonly', 'true');
    await expect(detail.locator('textarea, [data-next-save-narrative]')).toHaveCount(0);
    await expect(detail.locator('.next-delivery-questions')).toContainText(
      'No open questions recorded.',
    );
    await expect(detail.locator('.engineering-evidence > header h3')).toHaveText(
      'Engineering evidence',
    );
    await expect(detail.locator('.delivery-capture-evidence > header h3')).toHaveText(
      'Recorded screenshots',
    );
    await expect(
      detail.locator(
        '.engineering-evidence > header .eyebrow, .delivery-capture-evidence > header .eyebrow',
      ),
    ).toHaveCount(0);
    await expect(detail.locator('.delivery-capture-group')).toHaveCount(1);
    await expect(detail.locator('.delivery-capture-group > p')).toHaveText(
      'Matching context and capture conditions',
    );

    for (const [width, height] of [
      [1920, 1080],
      [1280, 768],
      [1024, 768],
      [800, 768],
      [640, 768],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      const geometry = await detail.evaluate((node) => {
        const rect = (el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
        };
        const style = (el) => {
          const s = getComputedStyle(el);
          return {
            top: s.borderTopWidth,
            borderBottom: s.borderBottomWidth,
            left: s.paddingLeft,
            right: s.paddingRight,
            minHeight: s.minHeight,
          };
        };
        const direct = (selector) => node.querySelector(':scope > ' + selector);
        const stage = node.closest('.delivery-stage');
        return {
          containerWidth: stage.clientWidth - 48,
          detail: rect(node),
          header: style(direct('header')),
          sections: [...node.children]
            .filter((el) => el.tagName !== 'HEADER')
            .map((el) => ({ name: el.className, ...style(el), ...rect(el) })),
          narrative: [...node.querySelectorAll('.delivery-detail-grid > section')].map((el) => ({
            ...style(el),
            ...rect(el),
          })),
          validation: [...node.querySelector('.delivery-validation').children].map(rect),
          captures: [...node.querySelectorAll('.delivery-capture-grid figure')].map(rect),
          lastRow: [...node.querySelectorAll('.engineering-evidence tbody tr:last-child td')].map(
            style,
          ),
          tableTop: [
            ...node.querySelectorAll('.engineering-evidence th,.engineering-evidence td'),
          ].map((el) => getComputedStyle(el).borderTopWidth),
          stageOverflow: stage.scrollWidth > stage.clientWidth,
          documentOverflow: document.documentElement.scrollWidth > innerWidth,
          tableLocalScroll:
            node.querySelector('.engineering-evidence-grid').scrollWidth >
            node.querySelector('.engineering-evidence-grid').clientWidth,
          overlays: document.querySelectorAll('[data-nextjs-dialog], .vite-error-overlay').length,
        };
      });
      assert.equal(geometry.header.borderBottom, '0px');
      for (const section of geometry.sections) {
        assert.equal(section.top, '1px', section.name + ' owns one separator');
        assert.equal(section.borderBottom, '0px', section.name + ' has no trailing separator');
        assert.equal(section.x, geometry.detail.x, section.name + ' aligns to content edge');
      }
      for (const item of geometry.narrative) {
        assert.equal(item.left, '0px');
        assert.equal(item.right, '0px');
        assert.equal(item.minHeight, '0px');
      }
      for (const item of geometry.lastRow) assert.equal(item.borderBottom, '0px');
      assert.ok(geometry.tableTop.every((value) => value === '0px'));
      const wide = geometry.containerWidth >= 600;
      for (const pair of [geometry.narrative.slice(1), geometry.validation, geometry.captures]) {
        assert.equal(pair.length, 2);
        if (wide) {
          assert.equal(pair[0].y, pair[1].y);
          assert.ok(pair[1].x > pair[0].x);
        } else {
          assert.equal(pair[0].x, pair[1].x);
          assert.ok(pair[1].y >= pair[0].bottom);
        }
      }
      assert.equal(geometry.stageOverflow, false);
      assert.equal(geometry.documentOverflow, false);
      assert.equal(geometry.overlays, 0);
      if (width === 390) assert.equal(geometry.tableLocalScroll, true);
      await detail.locator('h2').scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(artifacts, `${theme}-${width}-record.png`) });
      await detail.locator('.delivery-capture-evidence').scrollIntoViewIfNeeded();
      await expect(detail.locator('[data-load-evidence]').last()).toBeInViewport();
      await page.screenshot({ path: resolve(artifacts, `${theme}-${width}-evidence.png`) });
      checks.push(
        `${theme} ${width}x${height}: single section rules, aligned read-only content, responsive evidence columns, contained table overflow and reachable captures`,
      );
    }
    await page.setViewportSize({ width: 1280, height: 768 });
    await detail.locator('[data-load-evidence]').first().click();
    await expect(detail.locator('[data-evidence-error]')).toHaveText(
      'No image available in this isolated example',
    );
    await expect(detail.getByRole('button', { name: 'Retry image' })).toBeEnabled();
    await expect(detail.locator('textarea, [data-next-save-narrative]')).toHaveCount(0);
    checks.push(
      `${theme}: image failure remains recoverable without making verified records editable`,
    );
    await page.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    resolve(artifacts, 'results.json'),
    JSON.stringify({ passed: checks.length, checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: resolve(artifacts, 'failure.png') });
  throw error;
} finally {
  await browser.close();
}
