import assert from 'node:assert/strict';
import { join } from 'node:path';
import { captureDesignReference } from './capture-design-reference.mjs';

export async function verifyConnectionWorkflow(page, artifacts) {
  const ledger = await page.locator('#change-count').textContent();
  for (const width of [1920, 1280]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      await page.getByRole('button', { name: 'Connection readiness', exact: true }).click();
      await page.locator('.readiness-check').first().waitFor();
      assert.ok((await page.locator('.readiness-check').count()) >= 5);
      assert.equal(await page.locator('#workflow-phase').textContent(), 'Staged');
      const geometry = await page.locator('#readiness-dialog').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const body = element.querySelector('.readiness-body');
        return {
          width: rect.width,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          scrollWidth: body.scrollWidth,
          clientWidth: body.clientWidth,
        };
      });
      assert.ok(geometry.width <= 640 && geometry.left >= 16 && geometry.right <= width - 16);
      assert.ok(geometry.bottom <= 1080 - 16);
      assert.ok(
        geometry.scrollWidth <= geometry.clientWidth + 1,
        'readiness must never overflow horizontally',
      );
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.screenshot({
        path: join(artifacts, `readiness-${theme}-${width}.png`),
        animations: 'disabled',
      });
      await captureDesignReference(
        page,
        '#readiness-dialog',
        `readiness-${theme}-${width}`,
        artifacts,
      );
      await page.keyboard.press('Escape');
      assert.equal(
        await page.locator('#readiness-dialog').evaluate((element) => element.open),
        false,
      );
      assert.equal(
        await page
          .locator('#live-status')
          .evaluate((element) => element === document.activeElement),
        true,
        'Escape returns to the opening control',
      );
    }
  }
  assert.equal(
    await page.locator('#change-count').textContent(),
    ledger,
    'readiness never alters staged changes',
  );
  await page.route('**/readiness', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Runtime unavailable for test' }),
    }),
  );
  // The workflow action navigates to Review when edits are staged. Open the
  // connection dialog explicitly to exercise a failed readiness request.
  await page.getByRole('button', { name: 'Connection readiness', exact: true }).click();
  await page.locator('.readiness-error').waitFor();
  assert.match(await page.locator('#readiness-summary').textContent(), /edits are preserved/);
  await page.unroute('**/readiness');
  await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await page.locator('.readiness-check').first().waitFor();
  assert.equal(
    await page.locator('.readiness-error').count(),
    0,
    'retry recovers without resetting local state',
  );
  await page.route('**/readiness', async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.checks = [
      {
        id: 'bridge-version',
        label: 'Coding agent version',
        status: 'warning',
        detail: 'The coding agent needs to reload the updated MCP server.',
        recovery: {
          id: 'restart-agent',
          label: 'Restart the updated coding agent',
          requiresAgentRestart: true,
        },
      },
    ];
    await route.fulfill({ json: payload });
  });
  await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await page.getByRole('button', { name: 'Restart the updated coding agent', exact: true }).click();
  assert.match(
    await page.locator('#readiness-command').textContent(),
    /cannot restart the agent for you/,
  );
  assert.equal(await page.locator('#readiness-command code').isVisible(), false);
  await page.unroute('**/readiness');
  await page.keyboard.press('Escape');
  let connectionLive = true;
  let readinessReads = 0;
  await page.route('**/readiness', (route) => {
    readinessReads += 1;
    return route.fulfill({
      json: {
        version: 1,
        checkedAt: new Date().toISOString(),
        ready: connectionLive,
        capabilities: { inspect: connectionLive, stage: connectionLive, apply: connectionLive },
        checks: [
          {
            id: 'preview-connection',
            label: 'Rendered preview',
            status: connectionLive ? 'passed' : 'warning',
            detail: connectionLive
              ? 'Live preview acknowledged.'
              : 'No live preview acknowledgement.',
          },
        ],
      },
    });
  });
  await page.getByRole('button', { name: 'Connection readiness', exact: true }).click();
  await page.getByText('Ready for a reviewed design change.', { exact: true }).waitFor();
  const close = page.locator('#readiness-close');
  await close.focus();
  connectionLive = false;
  await page
    .getByText('No live preview acknowledgement.', { exact: true })
    .waitFor({ timeout: 5000 });
  assert.doesNotMatch(await page.locator('#readiness-summary').textContent(), /^Ready/);
  assert.equal(
    await close.evaluate((element) => element === document.activeElement),
    true,
    'background readiness polling preserves keyboard focus',
  );
  connectionLive = true;
  await page
    .getByText('Ready for a reviewed design change.', { exact: true })
    .waitFor({ timeout: 5000 });
  await close.click();
  await page.waitForTimeout(100);
  const readsAfterClose = readinessReads;
  await page.waitForTimeout(2200);
  assert.equal(readinessReads, readsAfterClose, 'readiness polling stops when the dialog closes');
  await page.unroute('**/readiness');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

export async function verifyDeliveryWorkflow(page, artifacts) {
  await page.getByRole('tab', { name: 'Handoff', exact: true }).click();
  await page.locator('.engineering-evidence').waitFor();
  const narrative = page.locator('[data-delivery-readonly-field]');
  assert.equal(await narrative.count(), 3);
  assert.equal(await page.locator('[data-delivery-field]').count(), 0);
  for (const field of await narrative.all()) {
    assert.equal(
      await field.evaluate((element) => element.isContentEditable),
      false,
      'verified Delivery narrative must not offer editing',
    );
    assert.equal(
      await field.isVisible(),
      true,
      'read-only evidence stays visible as selectable text',
    );
    assert.equal(await field.getAttribute('aria-describedby'), 'delivery-narrative-readonly');
  }
  await page
    .getByText('Read-only record. Intent, risks and questions are preserved.', { exact: true })
    .waitFor();
  const intent = page.locator('[data-delivery-readonly-field="intent"]');
  const originalIntent = await intent.textContent();
  // This is selectable evidence, not a read-only input. Typing here would invoke
  // workspace navigation shortcuts rather than test the narrative's editability.
  const selectedIntent = await intent.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const text = selection.toString();
    selection.removeAllRanges();
    return text;
  });
  assert.equal(selectedIntent, originalIntent);
  assert.ok((await page.locator('.engineering-evidence tbody tr').count()) >= 1);
  assert.match(await page.locator('.engineering-evidence').textContent(), /each affected context/i);
  assert.ok(
    (await page.locator('.engineering-evidence .evidence-status').allTextContents()).every(
      (status) => status === 'passed',
    ),
    'completed Apply evidence survives releasing its active lease',
  );
  for (const width of [1920, 1280]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      await page.locator('.engineering-evidence').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: join(artifacts, `engineering-brief-${theme}-${width}.png`),
        animations: 'disabled',
      });
      await captureDesignReference(
        page,
        '#delivery-content',
        `engineering-brief-${theme}-${width}`,
        artifacts,
      );
    }
  }
  let checkUnsafeText = true;
  await page.route('**/visual-checks', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        supported: true,
        reports: [
          {
            format: 'foundry.visual-check',
            version: 1,
            id: 'ui-contract-run',
            createdAt: '2026-09-15T10:00:00.000Z',
            exitCode: 1,
            results: [
              {
                name: 'signup-desktop',
                status: 'different',
                changedRatio: 0.00125,
                reason: 'Reviewed spacing differs from the approved baseline.',
                geometryChanges: [
                  { selector: '.signup-form', description: 'height changed by 4px' },
                ],
                newFindings: [],
              },
              {
                name: 'signup-dark',
                status: 'unsupported',
                reason: checkUnsafeText
                  ? '<img src=x onerror=alert(1)> is not a supported theme hook.'
                  : 'This theme has no authored project selector.',
                geometryChanges: [],
                newFindings: [],
              },
            ],
          },
        ],
      }),
    }),
  );
  await page.getByRole('tab', { name: 'Visual checks', exact: true }).click();
  await page.locator('.visual-check-result').first().waitFor();
  assert.equal(await page.locator('.visual-check-result').count(), 2);
  assert.equal(
    await page.locator('.visual-check-result img').count(),
    0,
    'report text must never create HTML',
  );
  assert.match(await page.locator('.visual-check-results').textContent(), /0.125%/);
  checkUnsafeText = false;
  await page.getByRole('button', { name: 'Refresh reports', exact: true }).click();
  await page.getByText('This theme has no authored project selector.', { exact: true }).waitFor();
  for (const width of [1920, 1280]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      const overflow = await page
        .locator('.delivery-stage')
        .evaluate((node) => node.scrollWidth - node.clientWidth);
      assert.ok(overflow <= 1, 'visual-check cards must fit both workspace widths');
      await page.screenshot({
        path: join(artifacts, `visual-checks-${theme}-${width}.png`),
        animations: 'disabled',
      });
      await captureDesignReference(
        page,
        '#delivery-content',
        `visual-checks-${theme}-${width}`,
        artifacts,
      );
    }
  }
  await page.unroute('**/visual-checks');
  await page.getByRole('button', { name: 'Refresh reports', exact: true }).click();
  await page
    .getByText('This runtime does not expose local visual checks.', { exact: false })
    .waitFor();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
}
