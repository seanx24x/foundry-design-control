import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

// Exercise the public local CLI, real inspector controls, real MCP claim and
// browser-origin verification. Never substitute API ledger writes or fabricated
// verification for the designer's review flow.
process.argv.push('--mode', 'workspace');
const h = await import('./test-real-golden-path.mjs');
const root = resolve(import.meta.dirname, '..');
const directory = h.harnessRoot;
const project = join(directory, 'morrow');
const home = join(directory, 'home');
const reportIndex = process.argv.indexOf('--report');
const headingScenario = process.argv.includes('--heading');
const expectedChanges = headingScenario ? 1 : 2;
const targetId = headingScenario ? 'story-title' : 'create-workspace-button';
const targetLine = headingScenario ? 43 : 247;
const reportPath =
  reportIndex < 0
    ? join(root, 'artifacts/recording-rehearsal/report.json')
    : resolve(process.argv[reportIndex + 1]);
const tooling = h.installTooling();
const report = { status: 'running', mode: 'local-workspace', errors: [], measurements: [] };
let browser, page, mcp, claimPromise;

async function startSession(environment) {
  const cli = h.startProcess(
    'recording-cli',
    process.execPath,
    [tooling.cli, 'start', '--project', project, '--no-open', '--no-dev'],
    { cwd: project, env: { ...process.env, ...environment } },
  );
  const workspaceUrl = await h.waitFor(() => {
    if (cli.child.exitCode != null) throw new Error(h.redact(cli.output()));
    return cli.output().match(/^Workspace: (.+)$/m)?.[1];
  }, 'CLI workspace URL');
  const url = new URL(workspaceUrl);
  return {
    cli,
    workspaceUrl,
    sessionId: url.searchParams.get('session'),
    token: url.searchParams.get('token'),
  };
}

async function open(session) {
  page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (error) => report.errors.push(error.message));
  const launch = new URL(session.workspaceUrl);
  // The heading scenario verifies source Apply through the new default UI.
  // The width-behavior scenario retains coverage of the legacy inspector.
  if (!headingScenario) launch.searchParams.set('ui', 'legacy');
  await page.goto(launch.href, { waitUntil: 'domcontentloaded' });
  await page.locator('#live-status[data-status="live"]').waitFor({ timeout: 20000 });
  const product = page.frameLocator('#product-preview');
  await product.locator('[data-foundry-id="create-workspace-button"]').waitFor();
  return product;
}

try {
  await h.assertPortFree(h.runtimePort);
  await h.assertPortFree(h.previewPort);
  mkdirSync(project);
  mkdirSync(home);
  for (const file of [
    'index.html',
    'style.css',
    'server.mjs',
    'build.mjs',
    'smoke.test.mjs',
    'configure-foundry.mjs',
    'validate-source-annotations.mjs',
    'foundry.design.json',
    'package.json',
    'PrimaryAction.tsx',
    'PrimaryAction.stories.tsx',
    'fonts',
  ]) {
    cpSync(join(root, 'examples/web-fixture', file), join(project, file), { recursive: true });
  }
  h.configureFixturePorts(project);
  writeFileSync(join(project, '.gitignore'), 'node_modules\ndist\n');
  h.initializeGit(project);
  symlinkSync(join(root, 'node_modules'), join(project, 'node_modules'), 'dir');
  const environment = h.isolatedEnvironment(home);
  h.command(
    project,
    process.execPath,
    [
      tooling.cli,
      'setup',
      '--project',
      project,
      '--agent',
      'none',
      '--url',
      h.previewUrl,
      '--runtime-port',
      String(h.runtimePort),
      '--yes',
    ],
    environment,
  );
  h.command(project, process.execPath, ['configure-foundry.mjs'], environment);
  h.commitSetup(project);
  h.command(project, process.execPath, ['build.mjs'], environment);
  h.startProcess('recording-fixture', process.execPath, ['server.mjs'], {
    cwd: project,
    env: { ...process.env, ...environment, FOUNDRY_FIXTURE_ROOT: 'dist' },
  });
  await h.waitForHttp(h.previewUrl, 'rebuilt fixture');
  let session = await startSession(environment);
  browser = await chromium.launch({ headless: true });
  h.ownedBrowsers.add(browser);
  let product = await open(session);
  console.log('Live inspector and preview acknowledged.');
  await page
    .locator('#canvas-viewport')
    .selectOption(headingScenario ? 'desktop' : 'mobile', { force: true });
  await h.waitFor(
    async () =>
      (await product.locator('html').evaluate(() => innerWidth)) === (headingScenario ? 1440 : 390),
    'mobile context',
  );
  const target = product.locator(`[data-foundry-id="${targetId}"]`);
  await target.click({ modifiers: ['Alt'], position: { x: 30, y: 20 } });
  if (headingScenario) {
    await page.getByLabel(/^Font size/).fill('54');
    await page.getByLabel(/^Font size/).press('Enter');
  } else {
    await page.getByRole('combobox', { name: 'Width behavior', exact: true }).click();
    // A presenter pauses to narrate while passive snapshots arrive.
    await page.waitForTimeout(3000);
    assert.equal(await page.getByRole('option', { name: 'fill', exact: true }).isVisible(), true);
    await page.getByRole('option', { name: 'fill', exact: true }).click();
    await h.waitFor(
      async () =>
        (await h.sessionRequest(session)).changeSet.changes.some((c) => c.property === 'widthMode'),
      'fluid width ledger entry',
    );
    await page.getByLabel('Maximum width', { exact: true }).fill('448px');
    await page.getByLabel('Maximum width', { exact: true }).press('Enter');
  }
  const staged = await h.waitFor(async () => {
    const s = await h.sessionRequest(session);
    return s.changeSet.changes.length === expectedChanges ? s : null;
  }, 'both staged changes');
  assert.ok(
    staged.changeSet.changes.every(
      (c) =>
        c.target.id === targetId &&
        c.target.source.file === 'index.html' &&
        c.target.source.line === targetLine,
    ),
  );
  assert.equal(h.command(project, 'git', ['diff', '--name-only']).stdout.trim(), '');
  await h.enterReview(page);
  await page
    .locator('input[data-change-id]')
    .nth(expectedChanges - 1)
    .waitFor();
  for (const summary of await page.locator('.change-source-details > summary').all())
    await summary.click();
  assert.ok((await page.locator('#changes').innerText()).includes(`index.html:${targetLine}`));
  for (const change of staged.changeSet.changes) {
    const checkbox = page.locator(`input[data-change-id="${change.id}"]`);
    if (!(await checkbox.isChecked())) await checkbox.check();
    await h.waitFor(
      async () =>
        (await h.sessionRequest(session)).changeSet.changes.find((c) => c.id === change.id)
          ?.status === 'approved',
      'review approval',
    );
  }
  await page.screenshot({ path: join(directory, 'review.png') });
  await h.waitFor(async () => !(await page.locator('#apply-agent').isDisabled()), 'approved batch');
  await page.locator('#apply-agent').click();
  const queued = await h.waitFor(async () => {
    const s = await h.sessionRequest(session);
    return s.applyRuns[0]?.state === 'queued' ? s : null;
  }, 'durable offline queue');
  const frozen = queued.applyRuns[0];

  // Regression: reconnect the same queued batch, do not discard or create a retry.
  await page.close();
  await h.stopProcess(session.cli, { includeExitedGroup: true });
  const firstId = session.sessionId;
  const firstPreview = new URL(new URL(session.workspaceUrl).searchParams.get('preview'));
  session = await startSession(environment);
  assert.equal(session.sessionId, firstId);
  const secondPreview = new URL(new URL(session.workspaceUrl).searchParams.get('preview'));
  assert.notEqual(
    firstPreview.searchParams.get('__foundry_preview_capability'),
    secondPreview.searchParams.get('__foundry_preview_capability'),
  );
  const reopened = await h.sessionRequest(session);
  assert.equal(reopened.applyRuns.length, 1);
  assert.equal(reopened.applyRuns[0].id, frozen.id);
  assert.deepEqual(reopened.applyRuns[0].reviewedChangeSet, frozen.reviewedChangeSet);
  report.recovery = { sameSession: true, sameReviewedRun: true, previewCredentialsRotated: true };
  console.log('CLI restart preserved the same queued review and rotated preview credentials.');

  mcp = new h.McpClient(tooling, {
    toolingCwd: project,
    mcpEnvironment: {
      ...environment,
      FOUNDRY_DESIGN_RUNTIME_URL: h.runtimeUrl,
      FOUNDRY_DESIGN_SESSION_ID: session.sessionId,
      FOUNDRY_DESIGN_SESSION_TOKEN: session.token,
    },
  });
  await mcp.initialize();
  await mcp.call('foundry_design_get_project_design', {});
  claimPromise = mcp.call(
    'foundry_design_wait_for_apply',
    {
      agent: { name: 'Foundry Recording Rehearsal', taskId: 'responsive-signup' },
      revision: reopened.changeSet.context.revision,
      designGraphRevision: reopened.changeSet.designGraphRevision,
      waitMs: 30000,
    },
    40000,
  );
  const claimed = await claimPromise;
  const run = claimed.applyRuns.find((r) => r.id === frozen.id);
  assert.equal(run.state, 'claimed');
  assert.equal(run.changeIds.length, expectedChanges);
  assert.deepEqual(run.reviewedChangeSet, frozen.reviewedChangeSet);
  assert.ok(
    run.reviewedChangeSet.operations.every((o) => o.status === 'resolved' && o.selectedMappingId),
  );
  const anchor = run.baselineSourceFiles
    .find((f) => f.path === 'index.html')
    .lineAnchors.find((a) => a.line === targetLine);
  assert.ok(
    anchor.endLine >= targetLine + 2 && anchor.endLine < targetLine + 14,
    'Source span must include attributes but not child content.',
  );
  const common = { runId: run.id, claimAttemptId: run.claimAttemptId };
  await mcp.call('foundry_design_update_apply_run', {
    ...common,
    state: 'applying',
    changedFiles: ['index.html'],
  });
  product = await open(session);
  const before = readFileSync(join(project, 'index.html'), 'utf8');
  const original = headingScenario ? '              id="story-title"' : 'style="width: 448px"';
  const replacement = headingScenario
    ? '              id="story-title" style="font-size: 54px"'
    : 'style="width: 100%; max-width: 448px"';
  assert.equal(before.split(original).length, 2);
  writeFileSync(join(project, 'index.html'), before.replace(original, replacement));
  const tests = h.command(project, process.execPath, ['--test', 'smoke.test.mjs'], environment);
  h.command(project, process.execPath, ['validate-source-annotations.mjs'], environment);
  h.command(project, process.execPath, ['build.mjs'], environment);
  h.command(project, 'git', ['diff', '--check']);
  assert.deepEqual(h.command(project, 'git', ['diff', '--name-only']).stdout.trim().split('\n'), [
    'index.html',
  ]);
  report.diff = h.command(project, 'git', ['diff', '--', 'index.html']).stdout;
  report.fixtureTests = tests.stdout;
  await mcp.call('foundry_design_update_apply_run', {
    ...common,
    state: 'rebuilding',
    changedFiles: ['index.html'],
    validationResults: [
      { name: 'Fixture tests, source annotations, build and diff check', passed: true },
    ],
  });
  const ack = await mcp.call('foundry_design_record_apply_result', {
    ...common,
    changeIds: run.changeIds,
  });
  assert.equal(ack.applyResult.acknowledged, true);
  console.log('One-line source edit, tests, rebuild and source-proof acknowledgement passed.');
  await mcp.call('foundry_design_update_apply_run', { ...common, state: 'verifying' });
  const stored = await h.waitFor(
    async () => {
      const s = await h.sessionRequest(session);
      const r = s.applyRuns.find((r) => r.id === run.id);
      return ['passed', 'needs_attention', 'failed'].includes(r?.state) ? s : null;
    },
    'browser-origin verification',
    45000,
  );
  const final = stored.applyRuns.find((r) => r.id === run.id);
  report.verification = final.verificationResults;
  assert.equal(final.state, 'passed', JSON.stringify(final.verificationResults));
  assert.equal(final.verificationResults.length, expectedChanges);
  assert.ok(final.verificationResults.every((v) => v.passed));
  report.delivery = stored.deliveryRecords.find((r) => r.applyRunId === run.id)?.status;
  report.history = stored.designHistory.some((r) => r.applyRunId === run.id);
  assert.equal(report.delivery, 'verified');
  assert.equal(report.history, true);
  await h.enterReview(page);
  await h.waitFor(
    async () =>
      (await page.locator('#apply-run .apply-status-row strong').textContent()) === 'Verified',
    'visible verified result',
  );
  await page.screenshot({ path: join(directory, 'verified.png') });

  const independent = await browser.newPage();
  independent.on('pageerror', (error) => report.errors.push(error.message));
  for (const theme of ['light', 'dark'])
    for (const width of headingScenario ? [1440] : [390, 768, 1440]) {
      await independent.setViewportSize({ width, height: 1080 });
      await independent.goto(h.previewUrl, { waitUntil: 'domcontentloaded' });
      await independent.reload({ waitUntil: 'domcontentloaded' });
      await independent.evaluate(
        (theme) => document.documentElement.setAttribute('data-theme', theme),
        theme,
      );
      await independent.evaluate(() => document.fonts.ready);
      if (headingScenario) {
        const rendered = await independent
          .locator('[data-foundry-id="story-title"]')
          .evaluate((el) => ({
            fontSize: getComputedStyle(el).fontSize,
            height: el.getBoundingClientRect().height,
          }));
        assert.equal(rendered.fontSize, '54px');
        assert.ok(rendered.height > 0);
        report.measurements.push({ theme, viewport: width, ...rendered });
        await independent.screenshot({
          path: join(directory, `rebuilt-${theme}.png`),
          fullPage: true,
        });
        continue;
      }
      const geometry = await independent
        .locator('[data-foundry-id="create-workspace-button"]')
        .evaluate((el) => {
          const box = el.getBoundingClientRect();
          const parent = el.parentElement.getBoundingClientRect();
          return {
            width: box.width,
            overflow: Math.max(0, box.right - parent.right),
            authoredWidth: el.style.width,
            maximum: el.style.maxWidth,
          };
        });
      assert.equal(geometry.width, width === 390 ? 354 : 448);
      assert.equal(geometry.overflow, 0);
      assert.equal(geometry.authoredWidth, '100%');
      assert.equal(geometry.maximum, '448px');
      report.measurements.push({ theme, viewport: width, ...geometry });
      if (width === 390)
        await independent.screenshot({
          path: join(directory, `rebuilt-${theme}.png`),
          fullPage: true,
        });
    }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  console.log(
    `Passed: real verification, verified Delivery, History, and ${report.measurements.length} rebuilt reload checks.`,
  );
} catch (error) {
  report.status = 'failed';
  report.error = h.redact(error.stack ?? String(error));
  console.error(report.error);
  await page?.screenshot({ path: join(directory, 'failure.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  claimPromise?.catch(() => {});
  await mcp?.close();
  await h.stopOwnedResources();
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  for (const file of [
    'review.png',
    'verified.png',
    'rebuilt-light.png',
    'rebuilt-dark.png',
    'failure.png',
  ]) {
    try {
      cpSync(join(directory, file), join(dirname(reportPath), file));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  console.log(`Rehearsal evidence: ${directory}`);
  console.log(`Report: ${reportPath}`);
}
