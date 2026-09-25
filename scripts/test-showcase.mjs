import assert from 'node:assert/strict';
import { cpSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

process.argv.push('--mode', 'workspace');
const h = await import('./test-real-golden-path.mjs');
const root = resolve(import.meta.dirname, '..');
const viewportWidth = Number(process.env.FOUNDRY_TEST_WIDTH || 1920);
const directory = join(root, `artifacts/showcase-${viewportWidth}`);
mkdirSync(directory, { recursive: true });
const project = join(h.harnessRoot, 'morrow');
const home = join(h.harnessRoot, 'home');
const report = { status: 'running', checks: [], errors: [] };
let page, product, session, mcp;
async function check(name, action) {
  try {
    await action();
    report.checks.push({ name, status: 'passed' });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, status: 'failed', error: h.redact(error.stack) });
    console.error(`FAIL ${name}: ${h.redact(error.message)}`);
    await page?.screenshot({ path: join(directory, `${name}-failure.png`) }).catch(() => {});
  }
}
async function mode(name) {
  await page.locator(`.workspace-rail [data-workspace-mode="${name}"]`).click();
}
async function select(id) {
  await mode('canvas');
  const row = page.locator(`.layer-row[data-layer-selector*="${id}"]`).first();
  await row.click();
  await h.waitFor(
    async () => (await row.getAttribute('aria-selected')) === 'true',
    'exact selected layer',
  );
}
async function capture(name) {
  await page.screenshot({ path: join(directory, `${name}.png`) });
  writeFileSync(join(directory, `${name}.txt`), await page.locator('body').innerText());
  writeFileSync(
    join(directory, `${name}-controls.json`),
    JSON.stringify(
      await page.locator('button,input,select,textarea').evaluateAll((elements) =>
        elements
          .filter((el) => el.getBoundingClientRect().width > 0)
          .map((el) => ({
            tag: el.tagName,
            text: el.textContent.slice(0, 80),
            id: el.id,
            label: el.getAttribute('aria-label'),
            placeholder: el.getAttribute('placeholder'),
            data: { ...el.dataset },
          })),
      ),
      null,
      2,
    ),
  );
}
try {
  await h.assertPortFree(h.runtimePort);
  await h.assertPortFree(h.previewPort);
  mkdirSync(project);
  mkdirSync(home);
  for (const file of [
    'index.html',
    'style.css',
    'fonts',
    'server.mjs',
    'build.mjs',
    'smoke.test.mjs',
    'configure-foundry.mjs',
    'validate-source-annotations.mjs',
    'foundry.design.json',
    'package.json',
    'PrimaryAction.tsx',
    'PrimaryAction.stories.tsx',
  ])
    cpSync(join(root, 'examples/web-fixture', file), join(project, file), { recursive: true });
  h.configureFixturePorts(project);
  writeFileSync(join(project, '.gitignore'), 'node_modules\ndist\n');
  h.initializeGit(project);
  symlinkSync(join(root, 'node_modules'), join(project, 'node_modules'), 'dir');
  const env = h.isolatedEnvironment(home);
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
      h.previewUrl,
      '--runtime-port',
      String(h.runtimePort),
      '--yes',
    ],
    env,
  );
  h.command(project, process.execPath, ['configure-foundry.mjs'], env);
  h.commitSetup(project);
  h.command(project, process.execPath, ['build.mjs'], env);
  h.startProcess('showcase-fixture', process.execPath, ['server.mjs'], {
    cwd: project,
    env: { ...process.env, ...env, FOUNDRY_FIXTURE_ROOT: 'dist' },
  });
  await h.waitForHttp(h.previewUrl, 'fixture');
  const cli = h.startProcess(
    'showcase-cli',
    process.execPath,
    [tooling.cli, 'start', '--project', project, '--no-open', '--no-dev'],
    { cwd: project, env: { ...process.env, ...env } },
  );
  const workspaceUrl = await h.waitFor(
    () => cli.output().match(/^Workspace: (.+)$/m)?.[1],
    'workspace',
  );
  const url = new URL(workspaceUrl);
  session = { sessionId: url.searchParams.get('session'), token: url.searchParams.get('token') };
  const browser = await chromium.launch({ headless: true });
  h.ownedBrowsers.add(browser);
  page = await browser.newPage({ viewport: { width: viewportWidth, height: 1080 } });
  page.on('pageerror', (error) => report.errors.push(error.message));
  url.searchParams.set('ui', 'legacy');
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.locator('#live-status[data-status="live"]').waitFor({ timeout: 20000 });
  product = page.frameLocator('#product-preview');
  await product.locator('[data-foundry-id="create-workspace-button"]').waitFor();
  await check('canvas', async () => {
    await select('create-workspace-button');
    await page.getByRole('combobox', { name: 'Canvas zoom', exact: true }).click();
    await page.getByRole('option', { name: 'Fit', exact: true }).click();
    const bounds = await page.locator('#canvas-stage').evaluate((stage) => {
      const host = stage.getBoundingClientRect();
      const frame = document.querySelector('#preview-frame').getBoundingClientRect();
      const panel = stage.closest('.canvas-mode').getBoundingClientRect();
      return { host: host.toJSON(), frame: frame.toJSON(), panel: panel.toJSON() };
    });
    assert.ok(bounds.host.right <= bounds.panel.right + 1, 'stage stays inside canvas');
    assert.ok(bounds.frame.right <= bounds.host.right - 23, 'Fit preserves right gutter');
    assert.ok(bounds.frame.left >= bounds.host.left + 23, 'Fit preserves left gutter');
    assert.ok(await page.locator('body').innerText());
    await capture('canvas');
  });
  for (const name of [
    'components',
    'states',
    'system',
    'responsive',
    'health',
    'recipes',
    'branches',
    'memory',
    'agent',
    'delivery',
  ]) {
    await check(name, async () => {
      await mode(name);
      await capture(name);
    });
  }
  await check('motion', async () => {
    await select('working-note');
    await mode('motion');
    await page.locator('.motion-studio-row').first().waitFor();
    await capture('motion');
    assert.match(await page.locator('.motion-studio-mode').innerText(), /note-arrive/);
  });
  await check('typography', async () => {
    await select('create-workspace-button');
    await mode('typography');
    await page.locator('.typography-font-row').first().waitFor();
    await capture('typography');
  });
  await check('variant-preview', async () => {
    await select('create-workspace-button');
    await mode('components');
    await page.locator('.workshop-variant-row').filter({ hasText: 'Quiet' }).click();
    await h.waitFor(
      async () =>
        (await product
          .locator('[data-foundry-id="create-workspace-button"]')
          .getAttribute('data-story')) === 'Quiet',
      'quiet variant',
    );
    await h.waitFor(
      async () =>
        (await product
          .locator('.submit-button')
          .evaluate((el) => getComputedStyle(el).backgroundColor)) === 'rgba(0, 0, 0, 0)',
      'settled quiet style',
    );
    await page.getByRole('button', { name: 'View on Canvas', exact: true }).click();
    assert.equal(await page.locator('#app-shell').getAttribute('data-mode'), 'canvas');
    await mode('components');
    await page.locator('.workshop-variant-row').filter({ hasText: 'Primary' }).click();
    await h.waitFor(
      async () =>
        !(await h.sessionRequest(session)).changeSet.changes.some(
          (c) => c.property === 'variant.story',
        ),
      'net-zero variant removed',
    );
    await capture('variant-preview');
  });
  await check('authored-state', async () => {
    await mode('states');
    await page.locator('[data-state-matrix-state="loading"]').click();
    const frame = page.frameLocator('#state-live-preview');
    await frame.locator('.submit-button.is-loading[aria-busy="true"]').waitFor();
    assert.equal(await frame.locator('.submit-button').isDisabled(), true);
    assert.equal(
      await frame.locator('.submit-button b').evaluate((el) => getComputedStyle(el).animationName),
      'button-spin',
    );
    await capture('authored-state');
    const previewBounds = await page.locator('.state-preview-viewport').evaluate((el) => {
      const rect = el.getBoundingClientRect(),
        host = el.parentElement.getBoundingClientRect();
      return { right: rect.right, left: rect.left, hostRight: host.right, hostLeft: host.left };
    });
    assert.ok(previewBounds.right <= previewBounds.hostRight - 23);
    assert.ok(previewBounds.left >= previewBounds.hostLeft + 23);
    await mode('canvas');
    assert.equal(await page.locator('#state-live-preview').count(), 0);
    assert.equal(await product.locator('.submit-button').getAttribute('aria-busy'), null);
  });
  await check('source-variant-plan', async () => {
    await select('create-workspace-button');
    await mode('components');
    assert.match(await page.locator('.component-workshop-contract').innerText(), /style.css:/);
    await page.locator('[data-workshop-variant-label]').fill('Outline');
    await page.locator('[data-workshop-variant-value]').fill('Outline');
    await page.getByRole('button', { name: 'Stage source variant', exact: true }).click();
    const stored = await h.waitFor(async () => {
      const s = await h.sessionRequest(session);
      return s.changeSet.operations.some((o) => JSON.stringify(o).includes('Outline')) ? s : null;
    }, 'source-backed variant operation');
    assert.match(JSON.stringify(stored.changeSet.operations), /style.css/);
    await capture('source-variant-plan');
  });
  await check('font-comparison', async () => {
    await select('create-workspace-button');
    await mode('typography');
    const before = (await h.sessionRequest(session)).changeSet.changes.length;
    await page.locator('.typography-font-row').filter({ hasText: 'Morrow Display' }).click();
    await h.waitFor(
      async () =>
        /loaded/.test(await page.locator('.typography-comparison-card.is-candidate').innerText()),
      'loaded comparison',
    );
    assert.equal((await h.sessionRequest(session)).changeSet.changes.length, before);
    await capture('font-comparison');
    const specimens = await page.locator('.typography-comparison-specimen').evaluateAll((items) =>
      items.map((el) => {
        const rect = el.getBoundingClientRect(),
          host = el.parentElement.getBoundingClientRect();
        return (
          rect.left >= host.left &&
          rect.right <= host.right &&
          rect.top >= host.top &&
          rect.bottom <= host.bottom
        );
      }),
    );
    assert.ok(specimens.every(Boolean), 'both complete specimens fit their hosts');
    assert.equal(
      await page
        .locator('.typography-comparison-card')
        .first()
        .locator('dl > div')
        .filter({ hasText: 'Lines' })
        .locator('dd')
        .innerText(),
      '1',
    );
    await page.getByRole('button', { name: 'Use this font', exact: true }).click();
    await h.waitFor(
      async () => (await h.sessionRequest(session)).changeSet.changes.length === before + 1,
      'single font change',
    );
    await h.waitFor(
      async () =>
        await page.getByRole('button', { name: 'Staged in Review', exact: true }).isDisabled(),
      'staged comparison status',
    );
    assert.match(
      await product.locator('.submit-button').evaluate((el) => getComputedStyle(el).fontFamily),
      /Morrow Display/,
    );
  });
  await check('heading-comparison-fit', async () => {
    await select('form-title');
    await mode('typography');
    await page.locator('.typography-font-row').filter({ hasText: 'Morrow Display' }).click();
    await h.waitFor(
      async () =>
        /loaded/.test(await page.locator('.typography-comparison-card.is-candidate').innerText()),
      'heading comparison loaded',
    );
    await capture('heading-comparison-fit');
    const fits = await page.locator('.typography-comparison-specimen').evaluateAll((items) =>
      items.map((el) => {
        const rect = el.getBoundingClientRect(),
          host = el.parentElement.getBoundingClientRect();
        return (
          rect.left >= host.left &&
          rect.right <= host.right &&
          rect.top >= host.top &&
          rect.bottom <= host.bottom
        );
      }),
    );
    assert.ok(fits.every(Boolean), 'full heading specimens fit');
    await select('create-workspace-button');
  });
  await check('recipe-save-and-reuse', async () => {
    await mode('recipes');
    await page.locator('#visual-recipe-name').fill('Clear action typography');
    await page
      .locator('#visual-recipe-intent')
      .fill('Use the project display face for a deliberate primary action.');
    await page.locator('#visual-recipe-save').click();
    await page
      .locator('.visual-recipe-row')
      .filter({ hasText: 'Clear action typography' })
      .waitFor();
    await select('working-note');
    await mode('recipes');
    await page.getByRole('button', { name: 'Add mapped values to Review' }).click();
    await h.waitFor(
      async () =>
        /Morrow Display/.test(
          await product.locator('.working-note').evaluate((el) => getComputedStyle(el).fontFamily),
        ),
      'recipe reused on another target',
    );
    await capture('recipe-save-and-reuse');
  });
  await check('decision-memory', async () => {
    await mode('memory');
    await page.locator('#decision-memory-title').fill('Deliberate primary action');
    await page
      .locator('#decision-memory-summary')
      .fill('Keep action labels distinct without increasing control size.');
    await page
      .locator('#decision-memory-rationale')
      .fill('The same text was compared using two loaded project faces.');
    await page.locator('#decision-memory-save').click();
    await page
      .locator('.decision-memory-row')
      .filter({ hasText: 'Deliberate primary action' })
      .waitFor();
    await capture('decision-memory');
  });
  await check('branch-create', async () => {
    await mode('branches');
    await page.locator('#design-branch-name').fill('Editorial action');
    await page.locator('#design-branch-create').click();
    await page.locator('.design-branch-row').filter({ hasText: 'Editorial action' }).waitFor();
    await capture('branch-create');
  });
  await check('motion-transport-and-edit', async () => {
    await select('working-note');
    await mode('motion');
    const before = (await h.sessionRequest(session)).changeSet.changes.length;
    await page.getByRole('button', { name: 'Replay motion', exact: true }).click();
    await page.locator('[data-studio-action="scrub"]').fill('240');
    assert.equal((await h.sessionRequest(session)).changeSet.changes.length, before);
    const opacity = await h.waitFor(async () => {
      const value = await product
        .locator('.working-note')
        .evaluate((el) => Number(getComputedStyle(el).opacity));
      return value > 0 && value < 1 ? value : null;
    }, 'rendered scrub position');
    assert.ok(opacity > 0 && opacity < 1, `scrub opacity ${opacity}`);
    await page.locator('[data-studio-property="duration"]').fill('600');
    await page.locator('[data-studio-property="duration"]').press('Tab');
    await h.waitFor(async () => {
      const stored = await h.sessionRequest(session);
      const changes = [
        ...stored.changeSet.changes,
        ...(stored.designBranches ?? []).flatMap((branch) => branch.changes),
      ];
      return changes.some((c) => c.property.endsWith('.duration') && Number(c.after) === 600);
    }, 'duration change');
    assert.equal(
      await product
        .locator('.working-note')
        .evaluate((el) => el.getAnimations()[0].effect.getTiming().duration),
      600,
    );
    await capture('motion-transport-and-edit');
    await page.getByRole('button', { name: 'Preview on Canvas', exact: true }).click();
    await h.waitFor(
      async () => (await page.locator('#app-shell').getAttribute('data-mode')) === 'canvas',
      'motion preview navigation',
    );
    assert.match(await page.locator('#selection-summary').innerText(), /Shared working note/);
  });
  await check('branch-switch-and-restore', async () => {
    await mode('branches');
    await page.locator('[data-activate-branch="main"]').click();
    await h.waitFor(
      async () =>
        (await product
          .locator('.working-note')
          .evaluate((el) => el.getAnimations()[0]?.effect.getTiming().duration)) === 480,
      'main motion restored',
    );
    await page.locator('.design-branch-row').filter({ hasText: 'Editorial action' }).click();
    await h.waitFor(
      async () =>
        (await product
          .locator('.working-note')
          .evaluate((el) => el.getAnimations()[0]?.effect.getTiming().duration)) === 600,
      'branch motion restored',
    );
    await capture('branch-switch-and-restore');
  });
  await check('system-live-tokens', async () => {
    await mode('canvas');
    await page.locator('#canvas-theme').selectOption('light', { force: true });
    await h.waitFor(
      async () => (await product.locator('html').getAttribute('data-theme')) === 'light',
      'light theme',
    );
    await mode('system');
    await page.locator('.design-token-row').filter({ hasText: '--canvas' }).click();
    await h.waitFor(
      async () =>
        (await page.locator('.design-system-detail-head').innerText()).includes('#f3f4f0'),
      'live light token',
    );
    assert.match(await page.locator('.design-system-source').innerText(), /#111411/);
    assert.match(await page.locator('.design-system-source').innerText(), /#f3f4f0/);
    await page.locator('#design-system-reindex').click();
    await h.waitFor(
      async () => !(await page.locator('#design-system-reindex').isDisabled()),
      'reindex completed',
    );
    await capture('system-live-tokens');
  });
  await check('content-stress', async () => {
    await select('create-workspace-button');
    await mode('health');
    const target = product.locator('.submit-button span');
    const before = await target.innerText();
    await page.locator('.stress-profile').filter({ hasText: 'Long content' }).click();
    await page.locator('#apply-stress').click();
    await h.waitFor(
      async () => (await target.innerText()).length > before.length,
      'expanded content',
    );
    await h.waitFor(
      async () => /1 condition/.test(await page.locator('#stress-lab-status').innerText()),
      'stress scan acknowledgement',
    );
    await capture('content-stress');
    await page.locator('#clear-stress').click();
    await h.waitFor(async () => (await target.innerText()) === before, 'restored content');
    assert.equal(
      await page.locator('[data-stress-scope="selection"]').getAttribute('aria-pressed'),
      'true',
    );
    assert.ok(
      !(await page.locator('#stress-finding-groups').innerText()).includes('Password reveal'),
      'clear did not broaden to whole canvas',
    );
  });
  await check('responsive-audit', async () => {
    await mode('responsive');
    await page.locator('[data-studio-action="responsive-audit"]').click();
    const result = await h.waitFor(
      async () =>
        (await page.locator('#responsive-lab-status').innerText()).match(
          /(\d+) of (\d+) frames measured/,
        ),
      'responsive audit',
      30000,
    );
    assert.equal(result[1], result[2]);
    assert.ok(Number(result[1]) >= 3);
    await page.locator('.responsive-findings summary').first().click();
    assert.ok(await page.locator('.responsive-findings[open]').innerText());
    await capture('responsive-audit');
    await page.locator('.responsive-findings[open] [data-locate-finding]').first().click();
    await h.waitFor(
      async () => (await page.locator('#app-shell').getAttribute('data-mode')) === 'canvas',
      'responsive finding located',
    );
    await page.waitForTimeout(3000);
    assert.ok(
      !(await page.locator('body').innerText()).includes('Responsive selection was restored:'),
      'intentional navigation has no stale error',
    );
  });
  await check('accessibility-target', async () => {
    await select('password-reveal');
    await mode('health');
    await page.locator('[data-stress-condition="keyboard-only"]').click();
    await page.locator('#apply-stress').click();
    const finding = page
      .locator('.stress-finding-card')
      .filter({ hasText: /44|target/i })
      .first();
    await finding.waitFor();
    await capture('accessibility-target');
    const accessibilityCount = await page
      .locator('#stress-summary-grid article')
      .filter({ hasText: 'Accessibility' })
      .locator('strong')
      .innerText();
    assert.ok(Number(accessibilityCount) >= 1, 'touch targets count as accessibility');
    assert.equal(
      await product
        .locator('[data-foundry-id="password-reveal"]')
        .evaluate((el) => Math.round(el.getBoundingClientRect().height)),
      40,
    );
  });
  await check('visual-agent-mcp', async () => {
    await select('create-workspace-button');
    await mode('agent');
    await page
      .locator('#visual-agent-prompt')
      .fill('Compare the primary action typography using its measured context.');
    await page.locator('#visual-agent-ask').click();
    await page.locator('.visual-agent-thread').first().waitFor();
    mcp = new h.McpClient(tooling, {
      mcpEnvironment: { ...env, FOUNDRY_DESIGN_RUNTIME_URL: h.runtimeUrl },
    });
    await mcp.initialize();
    const claimed = await mcp.call('foundry_design_wait_for_visual_request', {
      sessionId: session.sessionId,
      token: session.token,
      waitMs: 1000,
      agent: { name: 'showcase-test', taskId: 'real-morrow' },
    });
    const request = claimed.visualAgentRequests.find((r) => r.status === 'thinking');
    assert.ok(request?.claimAttemptId);
    await mcp.call('foundry_design_respond_to_visual_request', {
      sessionId: session.sessionId,
      token: session.token,
      requestId: request.id,
      claimAttemptId: request.claimAttemptId,
      message:
        'The attached context identifies the selected Morrow primary action. This deterministic test confirms the real conversation transport, not model reasoning.',
      proposals: [],
    });
    await h.waitFor(
      async () =>
        (await page.locator('.visual-agent-conversation').innerText()).includes(
          'deterministic test',
        ),
      'real listener response',
    );
    await capture('visual-agent-mcp');
  });
  await check('persisted-memory', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#live-status[data-status="live"]').waitFor({ timeout: 20000 });
    await mode('memory');
    await page
      .locator('.decision-memory-row')
      .filter({ hasText: 'Deliberate primary action' })
      .waitFor();
    await capture('persisted-memory');
  });
  assert.equal(h.command(project, 'git', ['diff', '--name-only']).stdout.trim(), '');
  report.sourceUnchanged = true;
} catch (error) {
  report.errors.push(h.redact(error.stack));
} finally {
  report.status =
    report.errors.length || report.checks.some((c) => c.status === 'failed') ? 'failed' : 'passed';
  await mcp?.close();
  await h.stopOwnedResources();
  writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Showcase ${report.status}: ${directory}`);
  if (report.status !== 'passed') process.exitCode = 1;
}
