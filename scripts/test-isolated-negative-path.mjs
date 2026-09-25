import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, relative, resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';

const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const runtimePort = Number(option('--runtime-port', '4587'));
const previewPort = Number(option('--preview-port', '4590'));
for (const port of [runtimePort, previewPort]) {
  assert.ok(Number.isInteger(port) && port > 1024 && port < 65536);
  assert.ok(
    ![4387, 4390, 4487, 4490].includes(port),
    'Recording and parallel audit ports are protected.',
  );
}
assert.notEqual(runtimePort, previewPort);
const runtimeUrl = `http://127.0.0.1:${runtimePort}`;
const previewUrl = `http://127.0.0.1:${previewPort}`;
process.env.FOUNDRY_TEST_RUNTIME_URL = runtimeUrl;
process.env.FOUNDRY_TEST_PREVIEW_URL = previewUrl;
process.argv.push('--mode', 'workspace');
const h = await import('./test-real-golden-path.mjs');
const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(option('--artifacts', join(root, 'artifacts/refinement/negative-path')));
const project = join(h.harnessRoot, 'morrow');
const isolatedHome = join(h.harnessRoot, 'home');
const report = {
  format: 'foundry.isolated-negative-path',
  version: 1,
  startedAt: new Date().toISOString(),
  runtimePort,
  previewPort,
  status: 'running',
  checks: [],
  browserErrors: [],
  additionalCoverage: [
    {
      id: 'active-branch-health-acknowledgement',
      evidence:
        'Production-closure unit tests; not exercised by these main-direction browser tests.',
      condition: 'A runtime design branch is active when a health correction is staged.',
      behavior:
        'Acknowledgement now reads the authoritative active branch ledger and labels accepted corrections Saved to direction. Missing, unrelated or empty branch acknowledgements reject and restore the unrecorded preview.',
      limitation:
        'Active-branch behavior has focused unit coverage, not a complete browser Apply rehearsal. Source application and branch promotion are unchanged.',
    },
  ],
};
let page, server, mcp, work;
mkdirSync(artifacts, { recursive: true });

async function check(name, action) {
  const evidence = await action();
  report.checks.push({ name, status: 'passed', evidence });
  console.log(`PASS ${name}`);
}

try {
  await h.assertPortFree(runtimePort);
  await h.assertPortFree(previewPort);
  mkdirSync(isolatedHome, { recursive: true });
  const fixtureRoot = join(root, 'examples/web-fixture');
  cpSync(fixtureRoot, project, {
    recursive: true,
    filter: (path) =>
      !relative(fixtureRoot, path)
        .split(sep)
        .some((part) =>
          [
            'node_modules',
            'dist',
            '.git',
            '.foundry',
            '.agents',
            '.codex',
            '.cursor',
            '.claude',
          ].includes(part),
        ),
  });
  const htmlPath = join(project, 'index.html');
  writeFileSync(
    htmlPath,
    readFileSync(htmlPath, 'utf8').replaceAll(
      'http://127.0.0.1:4387/adapter.js',
      `${runtimeUrl}/adapter.js`,
    ),
  );
  symlinkSync(join(root, 'node_modules'), join(project, 'node_modules'), 'dir');
  const environment = { ...h.isolatedEnvironment(isolatedHome), INIT_CWD: project };
  const tooling = h.installTooling();
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
      previewUrl,
      '--runtime-port',
      String(runtimePort),
      '--yes',
    ],
    environment,
  );
  h.command(project, process.execPath, ['configure-foundry.mjs'], environment);
  h.command(project, process.execPath, ['build.mjs'], environment);
  h.initializeGit(project);
  const directory = resolve(project, 'dist');
  const mime = { '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2' };
  server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, previewUrl).pathname);
    const path = resolve(directory, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(directory + sep)) return void response.writeHead(403).end();
    try {
      response
        .writeHead(200, {
          'content-type': mime[extname(path)] ?? 'application/octet-stream',
          'cache-control': 'no-store',
        })
        .end(readFileSync(path));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(previewPort, '127.0.0.1', resolveListen);
  });
  const cli = h.startProcess(
    'isolated-negative-cli',
    process.execPath,
    [tooling.cli, 'start', '--project', project, '--new', '--no-open', '--no-dev'],
    { cwd: project, env: { ...process.env, ...environment } },
  );
  const workspaceUrl = await h.waitFor(() => {
    if (cli.child.exitCode != null) throw new Error(h.redact(cli.output()));
    return cli.output().match(/^Workspace: (.+)$/m)?.[1];
  }, 'isolated CLI session');
  const workspace = new URL(workspaceUrl);
  assert.equal(workspace.origin, runtimeUrl);
  const session = {
    sessionId: workspace.searchParams.get('session'),
    token: workspace.searchParams.get('token'),
  };
  const browser = await chromium.launch({ headless: true });
  h.ownedBrowsers.add(browser);
  page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (error) => report.browserErrors.push(error.message));
  await page.addInitScript(() => {
    window.addEventListener(
      'message',
      (event) => {
        if (
          window.__dropFoundryPings &&
          event.data?.type === 'foundry:workspace-command' &&
          event.data.command === 'preview-ping'
        )
          event.stopImmediatePropagation();
      },
      { capture: true },
    );
  });
  const verificationTrace = h.observeBrowserVerification(page, session);
  workspace.searchParams.set('ui', 'legacy');
  await page.goto(workspace.href, { waitUntil: 'domcontentloaded' });
  const product = page.frameLocator('#product-preview');
  await page.locator('#live-status[data-status="live"]').waitFor({ timeout: 20_000 });
  await product.locator('[data-foundry-id="password-reveal"]').click({ modifiers: ['Alt'] });
  await page.locator('.workspace-rail [data-workspace-mode="health"]').click();
  const keyboard = page.locator('[data-stress-condition="keyboard-only"]');
  if ((await keyboard.getAttribute('aria-pressed')) !== 'true') await keyboard.click();
  await page.locator('#apply-stress').click();
  const finding = page
    .locator('.stress-finding-card')
    .filter({ hasText: 'Touch target is too small' });
  await finding.waitFor({ timeout: 15_000 });
  await finding.locator('[data-stress-fix]').click();
  const staged = await h.waitFor(async () => {
    const stored = await h.sessionRequest(session);
    return stored.changeSet.changes.length === 1 ? stored : null;
  }, 'real reviewed correction');
  assert.equal(staged.changeSet.changes[0].before, 40);
  assert.equal(staged.changeSet.changes[0].after, 44);

  let run;
  await check('offline-listener-stays-queued', async () => {
    assert.equal((await h.listenerPresence(session)).connected, false);
    await h.enterReview(page);
    await h.approveReviewedChange(page);
    await h.waitFor(
      async () => (await page.locator('#apply-agent').textContent()).includes('Queue 1 for agent'),
      'honest offline action',
    );
    await page.locator('#apply-agent').click();
    const queued = await h.waitFor(async () => {
      const stored = await h.sessionRequest(session);
      return stored.applyRuns.some((item) => item.state === 'queued') ? stored : null;
    }, 'durable queue');
    run = queued.applyRuns.at(-1);
    assert.equal(run.agent, undefined);
    assert.equal(run.claimAttemptId, undefined);
    assert.equal(run.applyResultAcknowledgedAt, undefined);
    assert.deepEqual(run.verificationResults, []);
    assert.equal(queued.designHistory.length, 0);
    assert.equal(h.command(project, 'git', ['diff', '--name-only']).stdout.trim(), '');
    await h.waitFor(
      async () => (await page.locator('#workflow-status').textContent()) === 'Queued',
      'queued lifecycle label',
    );
    await h.waitFor(
      async () =>
        /^Queued/.test((await page.locator('.apply-status-row strong').textContent()) ?? ''),
      'queued Apply surface',
    );
    await page.screenshot({ path: join(artifacts, 'offline-queued.png') });
    return { state: run.state, claimed: false, sourceFilesChanged: 0, verified: false };
  });

  await check('intentional-42px-mismatch-is-not-verified', async () => {
    const prepared = {
      project,
      toolingCwd: project,
      mcpEnvironment: {
        ...environment,
        FOUNDRY_DESIGN_RUNTIME_URL: runtimeUrl,
        FOUNDRY_DESIGN_SESSION_ID: session.sessionId,
        FOUNDRY_DESIGN_SESSION_TOKEN: session.token,
      },
    };
    mcp = new h.McpClient(tooling, prepared);
    await mcp.initialize();
    work = mcp.call(
      'foundry_design_wait_for_work',
      {
        agent: {
          name: 'Foundry Negative Verification Agent',
          version: h.version,
          taskId: 'isolated-mismatch',
        },
        revision: staged.changeSet.context.revision,
        designGraphRevision: staged.changeSet.designGraphRevision,
        waitMs: 45_000,
      },
      55_000,
    );
    const claimed = await work;
    assert.equal(claimed.kind, 'apply_run');
    assert.equal(claimed.run.id, run.id);
    run = claimed.run;
    assert.equal(run.reviewedChangeSet.changes[0].after, 44);
    const common = { runId: run.id, claimAttemptId: run.claimAttemptId };
    await mcp.call('foundry_design_update_apply_run', {
      ...common,
      state: 'applying',
      changedFiles: ['style.css'],
      message: 'Negative test: deliberately write 42px against the reviewed 44px request.',
    });
    const stylePath = join(project, 'style.css');
    const before = readFileSync(stylePath, 'utf8');
    const after = before.replace(/(\.reveal-button\s*\{[\s\S]*?min-height:\s*)40px;/, '$142px;');
    assert.notEqual(after, before);
    writeFileSync(stylePath, after);
    h.command(project, process.execPath, ['validate-source-annotations.mjs'], environment);
    h.command(project, process.execPath, ['build.mjs'], environment);
    h.command(project, 'git', ['diff', '--check']);
    assert.deepEqual(h.command(project, 'git', ['diff', '--name-only']).stdout.trim().split('\n'), [
      'style.css',
    ]);
    await mcp.call('foundry_design_update_apply_run', {
      ...common,
      state: 'rebuilding',
      changedFiles: ['style.css'],
      validationResults: [
        {
          name: 'Source annotations and deterministic fixture build',
          passed: true,
          summary: '42px is intentional. The full 4px-grid fixture suite is not claimed to pass.',
        },
      ],
    });
    const acknowledged = await mcp.call('foundry_design_record_apply_result', {
      ...common,
      changeIds: run.changeIds,
    });
    assert.equal(acknowledged.applyResult.acknowledged, true);
    await mcp.call('foundry_design_update_apply_run', {
      ...common,
      state: 'verifying',
      message:
        'Request real browser-origin measurement of the intentionally incorrect rebuilt value.',
    });
    const measurement = await h.assertBrowserVerification(
      { page, product, verificationTrace },
      run,
      42,
      false,
    );
    const stored = await h.waitFor(async () => {
      const current = await h.sessionRequest(session);
      return current.applyRuns.find((item) => item.id === run.id)?.state === 'needs_attention'
        ? current
        : null;
    }, 'mismatch outcome');
    assert.equal(
      stored.changeSet.changes.find((change) => change.id === run.changeIds[0]).status ===
        'applied',
      false,
    );
    const delivery = stored.deliveryRecords.find((record) => record.applyRunId === run.id);
    assert.notEqual(delivery.status, 'verified');
    assert.equal(
      stored.designHistory.some((entry) => entry.applyRunId === run.id),
      false,
    );
    assert.equal(
      await product
        .locator('[data-foundry-id="password-reveal"]')
        .evaluate((element) => element.getBoundingClientRect().height),
      42,
    );
    await h.waitFor(
      async () =>
        (await page.locator('.apply-status-row strong').textContent()) === 'Needs attention',
      'rendered mismatch outcome',
    );
    await page.screenshot({ path: join(artifacts, 'mismatch-needs-attention.png') });
    await mcp.close();
    mcp = undefined;
    return {
      state: 'needs_attention',
      requested: measurement.requested,
      rendered: measurement.rendered,
      measuredHeight: measurement.geometry.height,
      deliveryStatus: delivery.status,
      history: false,
    };
  });

  await check('disconnected-preview-keeps-reviewed-work', async () => {
    await page.locator('.workspace-rail [data-workspace-mode="canvas"]').click();
    await page.locator('#live-status[data-status="live"]').waitFor({ timeout: 20_000 });
    await product.locator('[data-foundry-id="password-reveal"]').click({ modifiers: ['Alt'] });
    const before = await h.sessionRequest(session);
    const disconnectedAt = Date.now();
    await product.locator('html').evaluate(() => {
      window.__dropFoundryPings = true;
    });
    await page.locator('#live-status:not([data-status="live"])').waitFor({ timeout: 12_000 });
    const elapsed = Date.now() - disconnectedAt;
    assert.ok(elapsed >= 4_900, 'Do not declare disconnection before the liveness timeout.');
    await page.locator('.workspace-rail [data-workspace-mode="health"]').click();
    if ((await keyboard.getAttribute('aria-pressed')) !== 'true') await keyboard.click();
    await page.locator('#apply-stress').click();
    await page
      .locator('.toast')
      .filter({ hasText: /preview|offline|disconnected/i })
      .waitFor({ timeout: 10_000 });
    assert.notEqual(await page.locator('#live-status').getAttribute('data-status'), 'live');
    const after = await h.sessionRequest(session);
    assert.deepEqual(after.changeSet.changes, before.changeSet.changes);
    assert.equal(after.applyRuns.length, before.applyRuns.length);
    assert.equal(after.designHistory.length, before.designHistory.length);
    await page.screenshot({ path: join(artifacts, 'disconnected-preview.png') });
    return {
      offlineAfterMs: elapsed,
      reviewedChangesPreserved: after.changeSet.changes.length,
      newApplyRuns: 0,
      newHistoryEntries: 0,
    };
  });
  assert.deepEqual(report.browserErrors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = h.redact(error.stack ?? String(error));
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  h.retainFailureDiagnostics(error);
  process.exitCode = 1;
} finally {
  work?.catch(() => {});
  await mcp?.close();
  await h.stopOwnedResources();
  if (server) {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(artifacts, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  if (report.status === 'passed') rmSync(h.harnessRoot, { recursive: true, force: true });
  console.log(`Evidence report: ${join(artifacts, 'report.json')}`);
}
