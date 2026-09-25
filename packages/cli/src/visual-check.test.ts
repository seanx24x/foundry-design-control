import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { visualScreenSchema, type VisualCapture } from 'foundry-design-protocol';
import { screenConfigurationHash, validateVisualUrl } from './visual-check-capture.js';
import {
  approveVisualBaseline,
  compareVisualCaptures,
  listVisualCheckReports,
  registerVisualScreen,
  renderVisualCheckHtml,
  runVisualChecks,
} from './visual-check.js';

test('visual registration restricts capture to local product URLs and keeps storage inside the project', async () => {
  assert.equal(validateVisualUrl('http://127.0.0.1:4000/page?state=error').hostname, '127.0.0.1');
  for (const url of [
    'https://example.com',
    'file:///etc/passwd',
    'http://u:p@localhost',
    'http://localhost/?__foundry_token=secret',
  ])
    assert.throws(() => validateVisualUrl(url));
  const project = await mkdtemp(join(tmpdir(), 'foundry-visual-path-'));
  const external = await mkdtemp(join(tmpdir(), 'foundry-visual-external-'));
  await symlink(external, join(project, '.foundry'));
  await assert.rejects(
    registerVisualScreen(project, {
      version: 1,
      name: 'home',
      url: 'http://localhost:4000',
      viewport: { width: 1280, height: 720 },
    }),
    /symbolic-link/,
  );
  assert.deepEqual(await readdir(external), []);
});

test('comparison measures pixel, geometry and new findings without changing a baseline', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-visual-diff-'));
  const before = join(root, 'before.png');
  const after = join(root, 'after.png');
  const diff = join(root, 'diff.png');
  await sharp({ create: { width: 320, height: 240, channels: 4, background: '#ffffff' } })
    .png()
    .toFile(before);
  await sharp({ create: { width: 320, height: 240, channels: 4, background: '#dddddd' } })
    .png()
    .toFile(after);
  const screen = visualScreenSchema.parse({
    version: 1,
    name: 'screen',
    url: 'http://localhost:4000',
    viewport: { width: 320, height: 240 },
  });
  const capture: VisualCapture = {
    version: 1,
    screen,
    configurationHash: screenConfigurationHash(screen),
    createdAt: new Date().toISOString(),
    browser: 'test',
    platform: 'test',
    deviceScaleFactor: 1,
    motion: 'reduced; CSS animations and transitions disabled',
    screenshot: before,
    screenshotHash: createHash('sha256')
      .update(await readFile(before))
      .digest('hex'),
    geometry: [{ selector: '#button', x: 0, y: 0, width: 44, height: 44 }],
    findings: [],
    evidence: [],
  };
  const same = await compareVisualCaptures(capture, capture, before, before, diff);
  assert.equal(same.status, 'passed');
  assert.equal(same.changedPixels, 0);
  const changed = {
    ...capture,
    screenshotHash: createHash('sha256')
      .update(await readFile(after))
      .digest('hex'),
    geometry: [{ selector: '#button', x: 8, y: 0, width: 44, height: 40 }],
    findings: [{ kind: 'small-target' as const, selector: '#button', message: '40px target.' }],
  };
  const result = await compareVisualCaptures(capture, changed, before, after, diff);
  assert.equal(result.status, 'different');
  assert.equal(result.changedRatio, 1);
  assert.equal(result.geometryChanges.length, 1);
  assert.equal(result.newFindings.length, 1);
  assert.equal(
    (await compareVisualCaptures(capture, { ...changed, platform: 'other' }, before, after, diff))
      .status,
    'unsupported',
  );
  await assert.rejects(compareVisualCaptures(capture, changed, after, after, diff), /hash differs/);
  assert.equal(
    createHash('sha256')
      .update(await readFile(before))
      .digest('hex'),
    capture.screenshotHash,
  );
});

test(
  'capture waits for client-rendered targets, masks and authored hooks',
  { timeout: 30000 },
  async () => {
    const project = await mkdtemp(join(tmpdir(), 'foundry-visual-client-render-'));
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(`<!doctype html><html><head><style>
      #button{width:100px;height:44px}
      #card[data-state="error"] #button{width:120px}
      #dynamic{width:100px;height:20px}
    </style></head><body><script>
      document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
        document.body.insertAdjacentHTML('beforeend', '<main id="card"><button id="button">Save</button><div id="dynamic">Dynamic content</div></main>');
      }, 300));
    </script></body></html>`);
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    try {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      await registerVisualScreen(project, {
        version: 1,
        name: 'client-rendered',
        url: `http://127.0.0.1:${address.port}`,
        viewport: { width: 1280, height: 720 },
        targets: ['#button'],
        masks: ['#dynamic'],
        state: 'error',
        stateHook: { selector: '#card', attribute: 'data-state', value: 'error' },
      });
      const report = await runVisualChecks(project);
      assert.equal(report.results[0]!.status, 'unbaselined', JSON.stringify(report.results));
      const capture = report.results[0]!.capture!;
      assert.equal(capture.geometry[0]!.selector, '#button');
      assert.equal(capture.geometry[0]!.width, 120);
      assert.equal(capture.geometry[0]!.height, 44);
      assert.ok(
        (await readFile(join(project, '.foundry/visual-checks', capture.screenshot))).length > 0,
      );
    } finally {
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
    }
  },
);

test(
  'real browser pipeline: approve, unchanged, regression, masks, authored contexts and unavailable preview',
  { timeout: 90000 },
  async () => {
    const project = await mkdtemp(join(tmpdir(), 'foundry-visual-browser-'));
    const source = join(project, 'source.txt');
    await writeFile(source, 'untouched product source');
    let padding = 16;
    let dynamic = 'initial dynamic copy';
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(
        `<!doctype html><html><head><style>html{background:white;color:#111}html[data-theme="dark"]{background:#111;color:white}#card{padding:${padding}px}#button{width:100px;height:44px}#card[data-state="error"]{border:4px solid red}#dynamic{width:200px;height:40px;overflow:hidden}</style></head><body><main id="card"><h1>Foundry</h1><button id="button">Save</button><div id="dynamic">${dynamic}</div></main></body></html>`,
      );
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const url = `http://127.0.0.1:${address.port}`;
    try {
      await registerVisualScreen(project, {
        version: 1,
        name: 'home',
        url,
        viewport: { width: 1280, height: 720 },
        masks: ['#dynamic'],
      });
      const initial = await runVisualChecks(project);
      assert.equal(initial.exitCode, 3, JSON.stringify(initial.results));
      assert.equal(initial.results[0]!.status, 'unbaselined');
      const approved = await approveVisualBaseline(project, initial.id, 'home');
      const baselineFile = join(
        project,
        '.foundry/visual-checks/baselines',
        approved,
        'capture.png',
      );
      const baseline = await readFile(baselineFile);
      dynamic = 'Different dynamic copy that must be masked';
      assert.equal((await runVisualChecks(project)).exitCode, 0);
      padding = 24;
      const changed = await runVisualChecks(project);
      assert.equal(changed.exitCode, 1);
      assert.ok(changed.results[0]!.geometryChanges.some((item) => item.selector === '#button'));
      assert.deepEqual(await readFile(baselineFile), baseline);
      const updated = await approveVisualBaseline(project, changed.id, 'home');
      assert.notEqual(updated, approved);
      assert.deepEqual(await readFile(baselineFile), baseline);
      assert.equal((await runVisualChecks(project)).exitCode, 0);
      await registerVisualScreen(project, {
        version: 1,
        name: 'dark',
        url,
        viewport: { width: 1280, height: 720 },
        theme: 'dark',
        themeHook: { selector: 'html', attribute: 'data-theme', value: 'dark' },
        state: 'error',
        stateHook: { selector: '#card', attribute: 'data-state', value: 'error' },
      });
      const dark = await runVisualChecks(project, 'dark');
      assert.equal(dark.results[0]!.status, 'unbaselined');
      await registerVisualScreen(project, {
        version: 1,
        name: 'unsupported',
        url,
        viewport: { width: 1280, height: 720 },
        theme: 'sepia',
      });
      const unsupported = await runVisualChecks(project, 'unsupported');
      assert.equal(unsupported.exitCode, 2);
      assert.equal(unsupported.results[0]!.status, 'unsupported');
      await assert.rejects(
        approveVisualBaseline(project, unsupported.id, 'unsupported'),
        /successful, supported/,
      );
      await registerVisualScreen(project, {
        version: 1,
        name: 'missing-target',
        url,
        viewport: { width: 1280, height: 720 },
        targets: ['#missing'],
      });
      assert.equal(
        (await runVisualChecks(project, 'missing-target')).results[0]!.status,
        'unsupported',
      );
      const reports = await listVisualCheckReports(project);
      assert.ok(reports.length >= 6);
      const html = renderVisualCheckHtml({
        ...initial,
        results: [{ ...initial.results[0]!, reason: '<script>alert(1)</script>' }],
      });
      assert.ok(html.includes('&lt;script&gt;'));
      assert.ok(!html.includes('<script>'));
      assert.equal(await readFile(source, 'utf8'), 'untouched product source');
    } finally {
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
    }
    const disconnected = await runVisualChecks(project, 'home');
    assert.equal(disconnected.results[0]!.status, 'failed');
    assert.equal(disconnected.exitCode, 2);
  },
);
