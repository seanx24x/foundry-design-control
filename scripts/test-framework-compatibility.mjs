import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';
import { assertEngineeringDelivery } from './assert-delivery-evidence.mjs';
import {
  compatibilityFixtures,
  capabilityReport,
  sourceAnchor,
} from './compatibility-fixtures.mjs';

const root = resolve(import.meta.dirname, '..');
const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
};
const mode = valueAfter('--mode') ?? 'workspace';
if (!valueAfter('--mode')) process.argv.push('--mode', mode);
const runtimePort = Number(valueAfter('--runtime-port') ?? 4487);
const previewPort = Number(valueAfter('--preview-port') ?? 4490);
for (const port of [runtimePort, previewPort])
  assert.ok(
    Number.isInteger(port) && port > 1024 && port < 65536,
    'Use unprivileged valid test ports.',
  );
assert.notEqual(runtimePort, previewPort);
const runtimeUrl = `http://127.0.0.1:${runtimePort}`;
const previewUrl = `http://127.0.0.1:${previewPort}`;
process.env.FOUNDRY_TEST_RUNTIME_URL = runtimeUrl;
process.env.FOUNDRY_TEST_PREVIEW_URL = previewUrl;
const shared = await import('./test-real-golden-path.mjs');
const {
  command,
  asynchronousCommand,
  installTooling,
  toolingCommand,
  isolatedEnvironment,
  initializeGit,
  commitSetup,
  startProcess,
  stopProcess,
  waitFor,
  waitForHttp,
  assertPortFree,
  sessionRequest,
  McpClient,
  listenerPresence,
  observeBrowserVerification,
  assertBrowserVerification,
  enterReview,
  openWorkspaceMode,
  approveReviewedChange,
  stopOwnedResources,
  harnessRoot,
  retainFailureDiagnostics,
  ownedBrowsers,
  version,
} = shared;
const requested = valueAfter('--fixture');
const fixtures = requested
  ? compatibilityFixtures.filter(({ id }) => id === requested)
  : compatibilityFixtures;
assert.ok(fixtures.length, `Unknown fixture ${requested}.`);
const reportPath = resolve(
  valueAfter('--report') ?? join(root, 'artifacts', 'compatibility', `${mode}.json`),
);
const report = {
  version: 1,
  foundryVersion: version,
  mode,
  startedAt: new Date().toISOString(),
  fixtures: [],
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const log = (message) => console.log(`[compatibility:${mode}] ${message}`);

async function prepare(fixture, tooling) {
  const scenarioRoot = join(harnessRoot, fixture.id);
  const project = join(scenarioRoot, 'project');
  const home = join(scenarioRoot, 'home');
  mkdirSync(home, { recursive: true });
  cpSync(join(root, 'examples', 'compatibility', fixture.id), project, { recursive: true });
  const environment = {
    ...isolatedEnvironment(home),
    INIT_CWD: project,
    NEXT_TELEMETRY_DISABLED: '1',
    STORYBOOK_DISABLE_TELEMETRY: '1',
  };
  // Installation happens only in this owned temporary project and isolated cache.
  await asynchronousCommand(
    project,
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--fetch-retries=0',
      '--fetch-timeout=30000',
    ],
    environment,
    { label: `${fixture.id} dependencies`, timeoutMs: 180_000 },
  );
  const manifest = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
  const frameworkPackages = {};
  for (const [name, pinned] of Object.entries({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  })) {
    const installed = JSON.parse(
      readFileSync(join(project, 'node_modules', name, 'package.json'), 'utf8'),
    ).version;
    assert.equal(installed, pinned, `${name} must resolve to its pinned fixture version.`);
    frameworkPackages[name] = installed;
  }
  initializeGit(project);
  const prepared = {
    scenarioRoot,
    project,
    home,
    environment,
    cliEnvironment: environment,
    mcpEnvironment: { ...environment, npm_config_cache: join(scenarioRoot, 'mcp-cache') },
    toolingCwd: project,
    frameworkPackages,
  };
  const setup = toolingCommand(tooling, 'cli', [
    'setup',
    '--project',
    project,
    '--agent',
    'none',
    '--url',
    previewUrl + (fixture.entry ?? ''),
    '--runtime-port',
    String(runtimePort),
    '--yes',
  ]);
  command(project, setup.executable, setup.args, environment, {
    label: `${fixture.id} public CLI setup`,
  });
  const configPath = join(project, '.foundry', 'foundry.config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.runtimeUrl = runtimeUrl;
  if (fixture.id === 'storybook-cva') {
    config.instrumented = true;
    config.mode = 'precision';
  } else {
    assert.equal(
      config.instrumented,
      true,
      'The public installer must recognize this framework entry.',
    );
  }
  config.design = {
    ...config.design,
    exclude: ['node_modules', 'dist', 'out', '.next', 'storybook-static', '.foundry'],
    states: [
      {
        id: 'hover',
        label: 'Hover',
        pseudoStates: ['hover'],
        confidence: 'instrumented',
        evidence: ['Authored Action.module.css :hover rule'],
      },
      {
        id: 'quiet',
        label: 'Quiet',
        variant: { tone: 'quiet' },
        confidence: 'instrumented',
        evidence: ['Authored Action.module.css data-tone selector'],
      },
    ],
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  // Storybook requires its explicitly authored preview-head integration; the
  // other integrations are generated by the public setup command itself.
  const integration =
    fixture.id === 'next-app'
      ? 'app/foundry-loader.tsx'
      : fixture.id === 'storybook-cva'
        ? '.storybook/preview-head.html'
        : 'index.html';
  const integrationPath = join(project, integration);
  const loader = readFileSync(integrationPath, 'utf8');
  if (fixture.id === 'storybook-cva') {
    writeFileSync(integrationPath, loader.replaceAll('http://127.0.0.1:4387', runtimeUrl));
  } else {
    assert.ok(
      loader.includes(`${runtimeUrl}/adapter`),
      `${fixture.id} setup must generate a real adapter integration at the configured runtime.`,
    );
  }
  sourceAnchor(project, fixture);
  await build(prepared, fixture);
  commitSetup(project);
  return prepared;
}

async function build(prepared, fixture) {
  await asynchronousCommand(prepared.project, 'npm', ['run', 'build'], prepared.environment, {
    label: `${fixture.id} actual production build`,
    timeoutMs: 180_000,
  });
  assert.ok(
    existsSync(
      join(
        prepared.project,
        fixture.output,
        fixture.id === 'storybook-cva' ? 'iframe.html' : 'index.html',
      ),
    ),
  );
}

async function serve(project, fixture) {
  const directory = resolve(project, fixture.output);
  const mime = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.png': 'image/png',
  };
  const server = createServer((request, response) => {
    const url = new URL(request.url, previewUrl);
    const pathname = decodeURIComponent(url.pathname);
    const path = resolve(directory, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(directory + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = readFileSync(path);
      response.writeHead(200, {
        'content-type': mime[extname(path)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
        ...(server.rejectFraming && extname(path) === '.html' ? { 'x-frame-options': 'DENY' } : {}),
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('Missing built asset');
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(previewPort, '127.0.0.1', resolveListen);
  });
  return server;
}

async function start(prepared, fixture, tooling) {
  await assertPortFree(runtimePort);
  await assertPortFree(previewPort);
  const server = await serve(prepared.project, fixture);
  let cli;
  try {
    const start = toolingCommand(tooling, 'cli', [
      'start',
      '--project',
      prepared.project,
      '--new',
      '--no-open',
      '--no-dev',
    ]);
    cli = startProcess(`${fixture.id}:cli`, start.executable, start.args, {
      cwd: prepared.project,
      env: { ...process.env, ...prepared.environment },
    });
    const workspaceUrl = await waitFor(() => {
      if (cli.child.exitCode != null) throw new Error(cli.output());
      return cli.output().match(/^Workspace: (.+)$/m)?.[1];
    }, `${fixture.id} CLI session`);
    assert.equal(
      new URL(workspaceUrl).origin,
      runtimeUrl,
      'CLI must honor the isolated runtime URL.',
    );
    await waitForHttp(`${runtimeUrl}/v1/health`, 'compatibility runtime');
    const query = new URL(workspaceUrl).searchParams;
    return {
      server,
      cli,
      workspaceUrl,
      sessionId: query.get('session'),
      token: query.get('token'),
    };
  } catch (error) {
    await stopProcess(cli, { includeExitedGroup: true });
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
    throw error;
  }
}

async function open(session) {
  const browser = await chromium.launch({ headless: true });
  ownedBrowsers.add(browser);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const verificationTrace = observeBrowserVerification(page, session);
  page.on('pageerror', (error) => shared.diagnostics.push(`[browser] ${error.message}`));
  await page.goto(session.workspaceUrl, { waitUntil: 'domcontentloaded' });
  const product = page.frameLocator('#product-preview');
  await product.locator('[data-foundry-id="compat-action"]').waitFor({ timeout: 30_000 });
  await page.locator('#live-status[data-status="live"]').waitFor({ timeout: 20_000 });
  await product
    .locator('[data-foundry-id="compat-action"]')
    .click({ modifiers: ['Alt'], position: { x: 20, y: 20 } });
  return { browser, page, product, verificationTrace };
}

async function contexts(session, state, fixture) {
  const { page, product } = state;
  await page.evaluate(() => {
    window.__compatContextResults = [];
    window.addEventListener('message', (event) => {
      if (
        event.source === document.querySelector('#product-preview')?.contentWindow &&
        event.data?.type === 'foundry:workspace-result' &&
        event.data.payload?.axes
      )
        window.__compatContextResults.push(event.data.payload);
    });
  });
  const chooseContext = async (axis, value) => {
    await page.evaluate(() => {
      window.__compatContextResults = [];
    });
    await page.locator(`#canvas-${axis}`).selectOption(value, { force: true });
    await page.waitForFunction(
      ({ axis, value }) =>
        window.__compatContextResults.some(
          (result) =>
            result.applied &&
            (axis === 'viewport' ? result.context.viewport.id : result.context[axis]) === value,
        ),
      { axis, value },
    );
    await waitFor(
      () =>
        page
          .locator(`#canvas-${axis}`)
          .evaluate((element, expected) => element.value === expected, value),
      `${axis} control to agree with its acknowledged preview context`,
    );
  };
  const stored = await sessionRequest(session);
  assert.ok(stored.designGraph.tokens.some(({ name }) => name === '--space-control'));
  assert.ok(stored.designGraph.components.some(({ name }) => /Action|ProjectCard/.test(name)));
  for (const [theme, expected] of [
    ['dark', 'rgb(17, 20, 17)'],
    ['light', 'rgb(244, 245, 242)'],
  ]) {
    await chooseContext('theme', theme);
    await waitFor(
      () =>
        product
          .locator('body')
          .evaluate(
            (element, color) => getComputedStyle(element).backgroundColor === color,
            expected,
          ),
      `rendered ${theme} theme`,
    );
    assert.equal(
      await product
        .locator('main section')
        .evaluate((element) => getComputedStyle(element).backgroundColor),
      theme === 'dark' ? 'rgb(32, 37, 32)' : 'rgb(255, 255, 255)',
    );
  }
  const target = product.locator('[data-foundry-id="compat-action"]');
  await chooseContext('state', 'quiet');
  await waitFor(
    async () => (await target.getAttribute('data-tone')) === 'quiet',
    'authored quiet variant',
  );
  await chooseContext('state', 'hover');
  await waitFor(
    () => target.evaluate((element) => getComputedStyle(element).filter === 'brightness(1.1)'),
    'authored CSS Modules hover replay',
  );
  await chooseContext('state', 'current');
  await chooseContext('theme', 'current');
  for (const viewport of ['mobile', 'desktop']) {
    await chooseContext('viewport', viewport);
    const width = stored.designGraph.breakpoints.find(({ id }) => id === viewport).width;
    await waitFor(
      () =>
        product
          .locator('html')
          .evaluate(
            (element, expectedWidth) =>
              innerWidth === expectedWidth && element.scrollWidth <= innerWidth,
            width,
          ),
      `no overflow at ${viewport}`,
    );
  }
  await chooseContext('viewport', 'current');
  assert.equal(
    (await sessionRequest(session)).changeSet.changes.length,
    0,
    'Context exploration must create no source changes.',
  );
  if (fixture.id === 'storybook-cva') {
    assert.ok(
      stored.designGraph.components.some((component) =>
        (component.variants ?? []).some(({ label }) => label === 'Quiet'),
      ),
      'Storybook CSF Quiet story must be indexed.',
    );
    assert.ok(
      stored.designGraph.components.some((component) =>
        (component.variantAxes ?? []).some(({ property }) => property === 'tone'),
      ),
      'CVA tone axis must be indexed.',
    );
  }
}

async function stage(session, state, fixture) {
  const { page } = state;
  await openWorkspaceMode(page, 'health');
  const keyboard = page.locator('[data-stress-condition="keyboard-only"]');
  await keyboard.waitFor();
  if ((await keyboard.getAttribute('aria-pressed')) !== 'true') await keyboard.click();
  await page.locator('#apply-stress').click();
  const finding = page
    .locator('.stress-finding-card')
    .filter({ hasText: 'Touch target is too small' });
  await finding.waitFor({ timeout: 15_000 });
  assert.equal(await finding.count(), 1);
  assert.match(await finding.textContent(), new RegExp(fixture.sourceFile.replaceAll('.', '\\.')));
  await finding.locator('[data-stress-fix]').click();
  const stored = await waitFor(async () => {
    const result = await sessionRequest(session);
    return result.changeSet.changes.length === 1 ? result : undefined;
  }, 'single mapped correction');
  const change = stored.changeSet.changes[0];
  assert.equal(change.target.id, 'compat-action');
  assert.equal(change.target.source.file, fixture.sourceFile);
  assert.equal(change.target.source.line, 3);
  assert.equal(change.property, 'minHeight');
  assert.equal(Number.parseFloat(change.before), 40);
  assert.equal(Number.parseFloat(change.after), 44);
}

async function apply(prepared, fixture, tooling, session, state) {
  const baseline = await sessionRequest(session);
  const revision = baseline.changeSet.context.revision;
  const designGraphRevision = baseline.changeSet.designGraphRevision;
  const mcp = new McpClient(tooling, {
    ...prepared,
    mcpEnvironment: {
      ...prepared.mcpEnvironment,
      FOUNDRY_DESIGN_RUNTIME_URL: runtimeUrl,
      FOUNDRY_DESIGN_SESSION_ID: session.sessionId,
      FOUNDRY_DESIGN_SESSION_TOKEN: session.token,
    },
  });
  let work;
  try {
    await mcp.initialize();
    work = mcp.call(
      'foundry_design_wait_for_work',
      {
        agent: { name: 'Foundry Framework Compatibility Agent', version, taskId: fixture.id },
        revision,
        designGraphRevision,
        waitMs: 60_000,
      },
      70_000,
    );
    await waitFor(async () => (await listenerPresence(session)).connected, 'real MCP listener');
    await enterReview(state.page);
    await approveReviewedChange(state.page);
    await waitFor(
      async () =>
        (await state.page.locator('#apply-agent').textContent()).includes('Apply 1 with agent'),
      'agent acknowledgement',
    );
    await state.page.locator('#apply-agent').click();
    const claimed = await work;
    assert.equal(claimed.kind, 'apply_run');
    const run = claimed.run;
    assert.equal(run.revision, revision);
    assert.equal(run.designGraphRevision, designGraphRevision);
    assert.equal(run.sourceProofScope, 'git');
    const change = run.reviewedChangeSet.changes.find(({ id }) => run.changeIds.includes(id));
    assert.equal(change.target.source.file, fixture.sourceFile);
    const sourcePath = join(prepared.project, fixture.sourceFile);
    assert.equal(
      run.baselineSourceFiles.find(({ path }) => path === fixture.sourceFile).sha256,
      hash(readFileSync(sourcePath)),
    );
    const common = { runId: run.id, claimAttemptId: run.claimAttemptId };
    await mcp.call('foundry_design_update_apply_run', {
      ...common,
      state: 'applying',
      message: `Editing ${fixture.sourceFile}:3 from the frozen review.`,
      changedFiles: [fixture.sourceFile],
    });
    const before = readFileSync(sourcePath, 'utf8');
    const after = before.replace(
      'min-height: 40px; /* foundry: compat-action */',
      'min-height: 44px; /* foundry: compat-action */',
    );
    assert.notEqual(after, before);
    writeFileSync(sourcePath, after);
    sourceAnchor(prepared.project, fixture);
    await mcp.call('foundry_design_update_apply_run', {
      ...common,
      state: 'rebuilding',
      message: `Building the actual ${fixture.name} project.`,
      changedFiles: [fixture.sourceFile],
    });
    await build(prepared, fixture);
    await mcp.call('foundry_design_update_apply_run', {
      ...common,
      state: 'rebuilding',
      changedFiles: [fixture.sourceFile],
      validationResults: [
        {
          name: `${fixture.name} production build`,
          passed: true,
          summary: 'Framework build completed against the reviewed one-file source edit.',
        },
      ],
    });
    const acknowledgement = await mcp.call('foundry_design_record_apply_result', {
      ...common,
      changeIds: run.changeIds,
    });
    assert.equal(acknowledgement.applyResult.acknowledged, true);
    await mcp.call('foundry_design_update_apply_run', {
      ...common,
      state: 'verifying',
      message: 'Waiting for the rebuilt browser preview to measure the result.',
    });
    const measured = await assertBrowserVerification(state, run, 44, true);
    const stored = await waitFor(async () => {
      const result = await sessionRequest(session);
      return result.applyRuns.find(({ id }) => id === run.id)?.state === 'passed'
        ? result
        : undefined;
    }, 'verified source application');
    assert.equal(
      stored.deliveryRecords.find(({ applyRunId }) => applyRunId === run.id).status,
      'verified',
    );
    assert.ok(stored.designHistory.some(({ applyRunId }) => applyRunId === run.id));
    const engineering = await assertEngineeringDelivery({
      project: prepared.project,
      runtimeUrl,
      session,
      stored,
      runId: run.id,
    });
    assert.deepEqual(
      command(prepared.project, 'git', ['diff', '--name-only']).stdout.trim().split('\n'),
      [fixture.sourceFile],
    );
    const patch = command(prepared.project, 'git', [
      'diff',
      '--unified=0',
      '--',
      fixture.sourceFile,
    ]).stdout;
    assert.equal(patch.split('\n').filter((line) => /^[+-](?![+-])/.test(line)).length, 2);
    // Measure inside the product frame. Playwright's boundingBox includes the
    // inspector's Fit transform, which is presentation scale, not product size.
    assert.equal(
      Math.round(
        await state.product
          .locator('[data-foundry-id="compat-action"]')
          .evaluate((element) => element.getBoundingClientRect().height),
      ),
      44,
    );
    return {
      runId: run.id,
      before: 40,
      after: 44,
      rendered: measured.rendered,
      sourceFile: fixture.sourceFile,
      sourceRevision: revision,
      appliedRevision: stored.applyRuns.find(({ id }) => id === run.id).appliedRevision,
      deliveryStatus: 'verified',
      engineering,
    };
  } finally {
    work?.catch(() => {});
    await mcp.close();
  }
}

async function ambiguity(session, state, prepared) {
  await openWorkspaceMode(state.page, 'canvas');
  await state.product
    .locator('[data-foundry-id="compat-action"]')
    .click({ modifiers: ['Alt'], position: { x: 20, y: 20 } });
  const width = state.page
    .locator('.property-row')
    .filter({ has: state.page.locator('.property-label[title="Width"]') })
    .locator('input');
  await width.fill('48');
  await width.press('Tab');
  const stored = await waitFor(async () => {
    const result = await sessionRequest(session);
    return result.changeSet.changes.some(({ status }) => status === 'unresolved')
      ? result
      : undefined;
  }, 'ambiguous flex sizing mapping');
  const change = stored.changeSet.changes.find(({ status }) => status === 'unresolved');
  assert.deepEqual(change.mappingCandidates.map(({ property }) => property).sort(), [
    'flexBasis',
    'width',
  ]);
  assert.equal(change.selectedMappingId, undefined);
  await enterReview(state.page);
  assert.equal(await state.page.locator(`[data-change-id="${change.id}"]`).isDisabled(), true);
  const response = await fetch(`${runtimeUrl}/v1/sessions/${session.sessionId}/apply-runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-foundry-token': session.token },
    body: JSON.stringify({
      reviews: [{ changeId: change.id, approved: true }],
      revision: stored.changeSet.context.revision,
      designGraphRevision: stored.changeSet.designGraphRevision,
    }),
  });
  const rejection = await response.json();
  assert.equal(
    response.status,
    400,
    `Ambiguous source intent must be rejected: ${JSON.stringify(rejection)}`,
  );
  assert.equal(rejection.error, `Unresolved change cannot be applied: ${change.id}`);
  assert.equal((await sessionRequest(session)).applyRuns.length, 1);
  assert.equal(
    command(prepared.project, 'git', ['diff', '--numstat']).stdout.trim().split('\n').length,
    1,
  );
}

async function framingFallback(session, state) {
  await openWorkspaceMode(state.page, 'canvas');
  session.server.rejectFraming = true;
  await state.page.reload({ waitUntil: 'domcontentloaded' });
  await state.page.locator('#preview-fallback').waitFor({ state: 'visible', timeout: 12_000 });
  assert.notEqual(await state.page.locator('#live-status').getAttribute('data-status'), 'live');
  const popupPromise = state.page.waitForEvent('popup');
  await state.page.locator('#direct-preview').click();
  const overlay = await popupPromise;
  try {
    await overlay
      .locator('[data-foundry-overlay][data-embedded="false"] .workspace-bar')
      .waitFor({ timeout: 15_000 });
    assert.equal(new URL(overlay.url()).searchParams.get('__foundry_session'), session.sessionId);
    const target = overlay.locator('[data-foundry-id="compat-action"]');
    await target.click({ modifiers: ['Alt'], position: { x: 20, y: 20 } });
    assert.equal(Math.round((await target.boundingBox()).height), 44);
    assert.ok(await target.getAttribute('data-foundry-source'));
    assert.equal((await sessionRequest(session)).applyRuns.length, 1);
  } finally {
    await overlay.close();
    session.server.rejectFraming = false;
  }
}

let failure;
let interrupted = false;
process.once('SIGINT', () => {
  interrupted = true;
});
process.once('SIGTERM', () => {
  interrupted = true;
});
try {
  const tooling = installTooling();
  for (const fixture of fixtures) {
    if (interrupted) break;
    const entry = capabilityReport(fixture);
    report.fixtures.push(entry);
    let session, state;
    const evidence = [];
    const mark = (...ids) => {
      evidence.push(...ids);
      entry.capabilities = capabilityReport(fixture, evidence).capabilities;
    };
    try {
      log(`Preparing ${fixture.name}.`);
      const prepared = await prepare(fixture, tooling);
      entry.frameworkPackages = prepared.frameworkPackages;
      session = await start(prepared, fixture, tooling);
      state = await open(session);
      await contexts(session, state, fixture);
      mark('themes', 'states', 'responsive', 'variants');
      await stage(session, state, fixture);
      entry.application = await apply(prepared, fixture, tooling, session, state);
      mark('source-apply');
      await ambiguity(session, state, prepared);
      mark('ambiguity');
      await framingFallback(session, state);
      mark('framing-fallback');
      entry.status = 'passed';
      log(
        `${fixture.name}: reviewed source change, rebuild, browser verification and ambiguity rejection passed.`,
      );
    } catch (error) {
      entry.status = 'failed';
      entry.error = shared.redact(error.stack ?? error);
      failure ??= error;
      if (state)
        await state.page
          .screenshot({ path: join(harnessRoot, `${fixture.id}-failure.png`), fullPage: true })
          .catch(() => {});
      log(`${fixture.name}: FAILED. ${error.message}`);
    } finally {
      await state?.browser.close();
      await stopProcess(session?.cli, { includeExitedGroup: true });
      if (session?.server) {
        session.server.closeAllConnections();
        await new Promise((done) => session.server.close(done));
      }
    }
  }
} catch (error) {
  failure = error;
} finally {
  await stopOwnedResources();
  report.finishedAt = new Date().toISOString();
  report.status = failure ? 'failed' : 'passed';
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  log(`Evidence report: ${reportPath}`);
  if (failure) retainFailureDiagnostics(failure);
  else rmSync(harnessRoot, { recursive: true, force: true });
}
if (failure) process.exitCode = 1;
