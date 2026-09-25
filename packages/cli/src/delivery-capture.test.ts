import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { changeSetSchema, PROTOCOL_VERSION } from 'foundry-design-protocol';
import type { DeliveryCaptureRequest } from 'foundry-design-runtime';
import {
  captureDeliveryEvidence,
  deliveryCaptureScreen,
  readDeliveryEvidence,
} from './delivery-capture.js';

function request(root = '/project', url = 'http://127.0.0.1:4390'): DeliveryCaptureRequest {
  const now = new Date().toISOString();
  return {
    phase: 'before',
    revision: 'rev-1',
    signal: new AbortController().signal,
    designGraph: {
      protocolVersion: PROTOCOL_VERSION,
      projectRoot: root,
      indexedAt: now,
      themes: [
        {
          id: 'dark',
          label: 'Dark',
          selector: 'html[data-theme="dark"]',
          attribute: 'data-theme',
          value: 'dark',
        },
      ],
      states: [
        { id: 'error', label: 'Error', query: { state: 'error' } },
        { id: 'hover', label: 'Hover', pseudoStates: ['hover'] },
      ],
      breakpoints: [{ id: 'desktop', label: 'Desktop', width: 1280, height: 720 }],
    },
    changeSet: changeSetSchema.parse({
      protocolVersion: PROTOCOL_VERSION,
      sessionId: 'capture-test',
      context: {
        projectRoot: root,
        revision: 'rev-1',
        platform: 'web',
        targetUrl: url,
        viewport: { width: 1280, height: 720 },
        theme: 'light',
        state: 'current',
        breakpoint: 'current',
      },
      changes: [
        {
          id: 'change-1',
          target: {
            id: 'button',
            platform: 'web',
            label: 'Button',
            source: { file: 'style.css', line: 1 },
            geometry: { x: 20, y: 20, width: 44, height: 40, scale: 1 },
            locator: { selector: '#button' },
            confidence: 'instrumented',
          },
          category: 'layout',
          property: 'minHeight',
          before: 40,
          after: 44,
          context: { breakpoint: 'current', theme: 'current', state: 'current' },
          confidence: 'instrumented',
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    }),
  };
}

test('delivery capture uses recorded dimensions and indexed authored hooks, never staged source or synthetic states', () => {
  const input = request();
  const change = input.changeSet.changes[0]!;
  const screen = deliveryCaptureScreen(input, change, {
    breakpoint: 'desktop',
    theme: 'dark',
    state: 'error',
  });
  assert.deepEqual(screen.viewport, { width: 1280, height: 720 });
  assert.deepEqual(screen.themeHook, { selector: 'html', attribute: 'data-theme', value: 'dark' });
  assert.equal(new URL(screen.url).searchParams.get('state'), 'error');
  assert.equal(screen.url.includes('__foundry'), false);
  assert.throws(
    () =>
      deliveryCaptureScreen(input, change, {
        breakpoint: 'mobile',
        theme: 'current',
        state: 'current',
      }),
    /recorded dimensions/,
  );
  assert.throws(
    () =>
      deliveryCaptureScreen(input, change, {
        breakpoint: 'current',
        theme: 'current',
        state: 'hover',
      }),
    /pseudo-state/,
  );
  assert.throws(
    () =>
      deliveryCaptureScreen(input, change, {
        breakpoint: 'current',
        theme: 'made-up',
        state: 'current',
      }),
    /indexed root/,
  );
});

test('real before and rebuilt captures use fresh pages, retain source provenance and do not add source files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-delivery-capture-'));
  const git = promisify(execFile);
  await git('git', ['init', '-q'], { cwd: root });
  await git('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
  await git('git', ['config', 'user.name', 'Foundry test'], { cwd: root });
  await writeFile(join(root, '.gitignore'), '.foundry/sessions/\n');
  await writeFile(
    join(root, 'style.css'),
    '#button { min-height:40px;width:44px;border:0;padding:0;background:#111;color:white; }',
  );
  await git('git', ['add', '.'], { cwd: root });
  await git('git', ['commit', '-qm', 'fixture'], { cwd: root });
  const paths: string[] = [];
  const server = createServer(async (incoming, response) => {
    paths.push(incoming.url ?? '/');
    response.setHeader('content-type', incoming.url === '/style.css' ? 'text/css' : 'text/html');
    response.end(
      incoming.url === '/style.css'
        ? await readFile(join(root, 'style.css'))
        : '<!doctype html><link rel="stylesheet" href="/style.css"><body><button id="button">Go</button></body>',
    );
  });
  await new Promise<void>((resolveStart) => server.listen(0, '127.0.0.1', resolveStart));
  const port = (server.address() as { port: number }).port;
  try {
    const input = request(root, `http://127.0.0.1:${port}`);
    const before = await captureDeliveryEvidence(input);
    assert.deepEqual(before.unavailable, []);
    assert.equal(before.screenshots.length, 1);
    assert.equal(before.screenshots[0]!.capture!.phase, 'before');
    assert.equal(before.screenshots[0]!.capture!.sourceRevision, 'rev-1');
    const evidence = before.screenshots[0]!;
    assert.deepEqual(
      await readDeliveryEvidence({ projectRoot: root, evidence }),
      await readFile(join(root, evidence.path)),
    );
    await assert.rejects(
      readDeliveryEvidence({
        projectRoot: root,
        evidence: { ...evidence, path: '../outside.png' },
      }),
      /trusted source/,
    );
    await assert.rejects(
      readDeliveryEvidence({ projectRoot: root, evidence: { ...evidence, path: 'style.css' } }),
      /trusted source/,
    );
    await assert.rejects(
      readDeliveryEvidence({
        projectRoot: root,
        evidence: { ...evidence, capture: { ...evidence.capture!, sha256: 'b'.repeat(64) } },
      }),
      /digest/,
    );
    await assert.rejects(
      readDeliveryEvidence({
        projectRoot: root,
        evidence: {
          ...evidence,
          capture: { ...evidence.capture!, viewport: { width: 200, height: 200 } },
        },
      }),
      /viewport/,
    );
    const linkedPath = `.foundry/sessions/delivery-evidence/before-${randomUUID()}.png`;
    await symlink(join(root, evidence.path), join(root, linkedPath));
    await assert.rejects(
      readDeliveryEvidence({ projectRoot: root, evidence: { ...evidence, path: linkedPath } }),
      /capture directory/,
    );
    const linkedRoot = await mkdtemp(join(tmpdir(), 'foundry-linked-evidence-'));
    await symlink(join(root, '.foundry'), join(linkedRoot, '.foundry'));
    await assert.rejects(
      readDeliveryEvidence({ projectRoot: linkedRoot, evidence }),
      /capture directory/,
    );
    await writeFile(
      join(root, 'style.css'),
      '#button { min-height:44px;width:44px;border:0;padding:0;background:#111;color:white; }',
    );
    const after = await captureDeliveryEvidence({
      ...input,
      phase: 'rebuilt',
      revision: 'rev-2',
      applyRunId: 'run-1',
    });
    assert.deepEqual(after.unavailable, []);
    assert.equal(after.screenshots[0]!.capture!.sourceRevision, 'rev-2');
    assert.equal(after.screenshots[0]!.capture!.applyRunId, 'run-1');
    assert.notEqual(after.screenshots[0]!.capture!.sha256, before.screenshots[0]!.capture!.sha256);
    assert.deepEqual(
      after.screenshots[0]!.capture!.conditions,
      before.screenshots[0]!.capture!.conditions,
    );
    assert.ok(
      paths.every((path) => !path.includes('__foundry')),
      'capture must not install the overlay or hydrate staged changes',
    );
    assert.equal(
      (await git('git', ['status', '--porcelain'], { cwd: root })).stdout.trim(),
      'M style.css',
    );
  } finally {
    await new Promise<void>((resolveStop) => server.close(() => resolveStop()));
  }
});
