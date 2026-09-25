import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {
  applyRunSchema,
  designChangeSchema,
  deliveryRecordSchema,
  type DeliveryRecord,
} from 'foundry-design-protocol';
import { SessionStore } from 'foundry-design-runtime';
import {
  DeliveryExportConflictError,
  deliveryExportFiles,
  renderPortableDeliveryJson,
  renderEngineeringBrief,
  matchingDeliveryCaptures,
  resolveManagedDeliveryPath,
  writeRepositoryDeliveryExport,
} from './delivery-export.js';

const now = '2026-09-10T00:00:00.000Z';

function deliveryRecord(sessionId: string, input: Partial<DeliveryRecord> = {}): DeliveryRecord {
  return {
    version: 1,
    id: 'delivery_test',
    sessionId,
    applyRunId: 'run_test',
    title: 'Button spacing',
    summary: 'Align button spacing.',
    intent: 'Preserve behavior.',
    narrativeSource: 'deterministic',
    status: 'verified',
    changeIds: ['change_test'],
    operationIds: [],
    affectedFiles: ['src/Button.tsx'],
    affectedComponents: ['Button'],
    affectedTokens: [],
    contexts: [{ breakpoint: 'desktop', theme: 'light', state: 'default' }],
    risks: [],
    questions: [],
    acceptanceCriteria: [],
    blockers: [],
    validationResults: [],
    verificationResults: [],
    evidence: [],
    captureIssues: [],
    createdAt: now,
    updatedAt: now,
    verifiedAt: now,
    ...input,
  };
}

test('exports managed delivery docs and preserves subsequent human edits', async () => {
  const storeRoot = await mkdtemp(join(tmpdir(), 'foundry-delivery-store-'));
  const output = await mkdtemp(join(tmpdir(), 'foundry-delivery-output-'));
  const store = new SessionStore(storeRoot);
  const session = await store.create({
    projectRoot: output,
    platform: 'web',
    theme: 'light',
    breakpoint: 'desktop',
    state: 'default',
  });
  const record = deliveryRecord(session.changeSet.sessionId);
  session.deliveryRecords = [record];
  await writeRepositoryDeliveryExport(output, session, record, now);
  const handoff = join(output, 'docs/foundry/handoffs/delivery_test.md');
  assert.match(await readFile(handoff, 'utf8'), /Button spacing/);
  await writeFile(handoff, '# Human edit\n');
  await assert.rejects(
    writeRepositoryDeliveryExport(output, session, record, now),
    /preserved user-modified documentation/,
  );
  assert.equal(await readFile(handoff, 'utf8'), '# Human edit\n');
});

test('engineering brief uses frozen exact changes and leaves unmatched contexts untested', async () => {
  const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-brief-store-')));
  const project = await mkdtemp(join(tmpdir(), 'foundry-brief-project-'));
  const session = await store.create({
    projectRoot: project,
    platform: 'web',
    theme: 'light',
    breakpoint: 'desktop',
    state: 'default',
  });
  const change = designChangeSchema.parse({
    id: 'change_test',
    target: {
      id: 'button',
      platform: 'web',
      semanticRole: 'button',
      label: 'Save',
      componentPath: ['Button'],
      source: { file: 'src/Button.css', line: 12 },
      geometry: { x: 0, y: 0, width: 100, height: 40 },
      confidence: 'instrumented',
    },
    category: 'layout',
    property: 'minHeight',
    before: 40,
    after: 44,
    context: { breakpoint: 'desktop', theme: 'light', state: 'default' },
    contextSet: { breakpoints: ['desktop', 'mobile'], themes: ['light'], states: ['default'] },
    confidence: 'instrumented',
    status: 'approved',
    createdAt: now,
    updatedAt: now,
  });
  session.applyRuns = [
    applyRunSchema.parse({
      id: 'run_test',
      sessionId: session.changeSet.sessionId,
      changeIds: [change.id],
      reviewedChangeSet: { ...session.changeSet, changes: [change] },
      state: 'passed',
      claimAttemptId: 'claim_test',
      applyResultClaimAttemptId: 'claim_test',
      applyResultAcknowledgedAt: now,
      appliedRevision: 'revision',
      appliedChangedFiles: ['src/Button.css'],
      appliedSourceFiles: [{ path: 'src/Button.css', exists: true, sha256: 'a'.repeat(64) }],
      validationResults: [{ name: 'Build', passed: true }],
      requestedAt: now,
      updatedAt: now,
    }),
  ];
  session.changeSet.changes = [{ ...change, after: 88 }];
  const record = deliveryRecord(session.changeSet.sessionId, {
    verificationResults: [
      {
        changeId: change.id,
        applyRunId: 'run_test',
        claimAttemptId: 'claim_test',
        property: 'minHeight',
        requested: 44,
        rendered: 44,
        passed: true,
        context: { breakpoint: 'desktop', theme: 'light', state: 'default' },
        geometry: { x: 0, y: 0, width: 100, height: 44, scale: 1 },
        evidence: ['Measured'],
        verifiedAt: now,
      },
      {
        changeId: change.id,
        applyRunId: 'wrong_run',
        property: 'minHeight',
        requested: 44,
        rendered: 44,
        passed: true,
        context: { breakpoint: 'mobile', theme: 'light', state: 'default' },
        evidence: [],
        verifiedAt: now,
      },
    ],
  });
  const brief = renderEngineeringBrief(session, record);
  assert.match(brief, /Save \/ minHeight \| 40 \| 44 \| src\/Button.css:12/);
  assert.match(brief, /desktop \/ light \/ default \| Passed: rendered 44/);
  assert.match(brief, /mobile \/ light \/ default \| Untested/);
  assert.doesNotMatch(brief, /\| 88 \|/);
});

test('visual pairs require exact context, dimensions, phase and source/run provenance; old records remain readable', () => {
  const record = deliveryRecord('session', { baselineRevision: 'old', appliedRevision: 'new' });
  const context = { breakpoint: 'desktop', theme: 'light', state: 'default' };
  const conditions = {
    motion: 'reduced',
    browser: 'chromium',
    platform: 'darwin',
    deviceScaleFactor: 1,
  };
  record.evidence = [
    {
      label: 'Before',
      path: 'before.png',
      createdAt: now,
      capture: {
        version: 1,
        phase: 'before',
        context,
        conditions,
        viewport: { width: 1280, height: 720 },
        sourceRevision: 'old',
      },
    },
    {
      label: 'Rebuilt',
      path: 'after.png',
      createdAt: now,
      capture: {
        version: 1,
        phase: 'rebuilt',
        context,
        conditions,
        viewport: { width: 1280, height: 720 },
        sourceRevision: 'new',
        applyRunId: 'run_test',
      },
    },
  ];
  assert.equal(matchingDeliveryCaptures(record).length, 1);
  const after = record.evidence[1]!;
  after.capture!.viewport.width = 1920;
  assert.equal(matchingDeliveryCaptures(record).length, 0);
  after.capture!.viewport.width = 1280;
  after.capture!.phase = 'preview';
  assert.equal(matchingDeliveryCaptures(record).length, 0);
  delete after.capture;
  assert.equal(matchingDeliveryCaptures(record).length, 0);
  assert.equal(deliveryRecordSchema.parse(record).evidence[1]?.capture, undefined);
});

test('bundles actual local image evidence and preserves modified exported images', async () => {
  const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-assets-store-')));
  const project = await mkdtemp(join(tmpdir(), 'foundry-assets-project-'));
  const output = await mkdtemp(join(tmpdir(), 'foundry-assets-export-'));
  const session = await store.create({
    projectRoot: project,
    platform: 'web',
    theme: 'light',
    breakpoint: 'desktop',
    state: 'default',
  });
  await sharp({ create: { width: 32, height: 32, channels: 4, background: '#ffffff' } })
    .png()
    .toFile(join(project, 'evidence.png'));
  const record = deliveryRecord(session.changeSet.sessionId, {
    evidence: [
      { label: 'Preview', path: 'evidence.png', createdAt: now },
      { label: 'Missing', path: 'missing.png', createdAt: now },
      { label: 'Outside', path: '../outside.png', createdAt: now },
    ],
  });
  await writeRepositoryDeliveryExport(output, session, record, now);
  const exported = join(output, 'docs/foundry/assets/delivery_test-0.png');
  assert.deepEqual(await readFile(exported), await readFile(join(project, 'evidence.png')));
  const assets = JSON.parse(
    await readFile(join(output, 'docs/foundry/assets/delivery_test.json'), 'utf8'),
  );
  assert.deepEqual(
    assets.attachments.map((item: { status: string }) => item.status),
    ['bundled', 'unavailable', 'unavailable'],
  );
  const brief = await readFile(join(output, 'docs/foundry/handoffs/delivery_test.md'), 'utf8');
  assert.match(brief, /No matching before\/rebuilt image pair/);
  assert.match(brief, /\.\.\/assets\/delivery_test-0.png/);
  await writeFile(exported, 'Human-owned replacement');
  await assert.rejects(
    writeRepositoryDeliveryExport(output, session, record, now),
    /preserved user-modified/,
  );
  assert.equal(await readFile(exported, 'utf8'), 'Human-owned replacement');
});

test('redacts project paths and runtime credentials from every portable delivery format', async () => {
  const storeRoot = await mkdtemp(join(tmpdir(), 'foundry-delivery-redaction-store-'));
  const output = await mkdtemp(join(tmpdir(), 'foundry-delivery-redaction-output-'));
  const store = new SessionStore(storeRoot);
  const session = await store.create({
    projectRoot: output,
    platform: 'web',
    theme: 'light',
    breakpoint: 'desktop',
    state: 'default',
  });
  const sensitiveUrl = `${output}/src/Button.tsx?__foundry_token=secret-value&session=session-value&__foundry_session=foundry-session-value&__foundry_preview_capability=preview-capability-value`;
  const record = deliveryRecord(session.changeSet.sessionId, {
    title: `Button from ${sensitiveUrl}`,
    summary: 'Authenticated with x-foundry-token: header-value',
    validationResults: [{ name: `Validate ${sensitiveUrl}`, passed: true, summary: sensitiveUrl }],
    verificationResults: [
      {
        changeId: 'change_test',
        property: `Path ${sensitiveUrl}`,
        requested: 48,
        rendered: 48,
        passed: true,
        reason: 'x-foundry-token=verification-value',
        evidence: [`Measured at ${sensitiveUrl}`],
        verifiedAt: now,
      },
    ],
  });
  session.deliveryRecords = [record];
  session.documentationPages = [
    {
      version: 1,
      id: 'doc_test',
      kind: 'component',
      slug: '../../Button / Primary',
      title: 'Button',
      summary: 'Button reference.',
      body: `Source: ${sensitiveUrl}`,
      narrativeSource: 'authored',
      freshness: 'current',
      sourceFiles: ['src/Button.tsx'],
      componentIds: ['Button'],
      deliveryRecordIds: [record.id],
      contentHash: 'hash',
      createdAt: now,
      updatedAt: now,
    },
  ];
  session.designHistory = [
    {
      version: 1,
      id: 'history_test',
      deliveryRecordId: record.id,
      applyRunId: record.applyRunId,
      title: `Shipped ${sensitiveUrl}`,
      summary: 'x-foundry-token: history-value',
      changeIds: record.changeIds,
      affectedFiles: record.affectedFiles,
      contexts: record.contexts,
      validationResults: record.validationResults,
      verificationResults: record.verificationResults,
      createdAt: now,
    },
  ];

  const files = deliveryExportFiles(session, record);
  assert.ok(files.has('docs/foundry/components/button-primary.md'));
  assert.ok([...files.keys()].every((path) => path.startsWith('docs/foundry/')));
  const exportedText = [...files.values()].join('\n');
  for (const privateValue of [
    output,
    'secret-value',
    'session-value',
    'foundry-session-value',
    'preview-capability-value',
    'header-value',
    'verification-value',
    'history-value',
  ]) {
    assert.doesNotMatch(
      exportedText,
      new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    assert.doesNotMatch(
      renderPortableDeliveryJson(record, output),
      new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  }
});

test('records successful documentation exports and marks human edits conflicted', async () => {
  const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-delivery-state-store-')));
  const output = await mkdtemp(join(tmpdir(), 'foundry-delivery-state-output-'));
  let session = await store.create({
    projectRoot: output,
    platform: 'web',
    theme: 'light',
    breakpoint: 'desktop',
    state: 'default',
  });
  session = await store.generateDocumentation(session.changeSet.sessionId);
  const record = deliveryRecord(session.changeSet.sessionId);

  let manifest = await writeRepositoryDeliveryExport(output, session, record, now);
  assert.equal(manifest.documentationPages.length, 1);
  const exported = manifest.documentationPages[0]!;
  session = await store.recordDocumentationExports(session.changeSet.sessionId, [exported]);
  let page = session.documentationPages.find((candidate) => candidate.id === exported.pageId)!;
  assert.equal(page.exportedHash, page.contentHash);
  assert.equal(page.exportedPath, exported.path);
  assert.equal(page.freshness, 'current');

  await writeFile(join(output, exported.path), '# Human edit\n');
  let conflict: DeliveryExportConflictError | undefined;
  try {
    await writeRepositoryDeliveryExport(output, session, record, now);
  } catch (error) {
    assert.ok(error instanceof DeliveryExportConflictError);
    conflict = error;
  }
  assert.deepEqual(conflict?.conflictingPaths, [exported.path]);
  assert.deepEqual(conflict?.documentationPageIds, [exported.pageId]);
  session = await store.markDocumentationConflicted(
    session.changeSet.sessionId,
    conflict!.documentationPageIds,
  );
  assert.equal(session.documentationPages[0]?.freshness, 'conflicted');

  session = await store.generateDocumentation(session.changeSet.sessionId);
  page = session.documentationPages.find((candidate) => candidate.id === exported.pageId)!;
  assert.equal(page.freshness, 'conflicted');

  await writeFile(join(output, exported.path), `${page.body}\n`);
  manifest = await writeRepositoryDeliveryExport(output, session, record, now);
  session = await store.recordDocumentationExports(
    session.changeSet.sessionId,
    manifest.documentationPages,
  );
  page = session.documentationPages.find((candidate) => candidate.id === exported.pageId)!;
  assert.equal(page.freshness, 'current');
  assert.equal(page.exportedHash, page.contentHash);
});

test('keeps every delivery target inside docs/foundry and rejects unsafe identifiers', async () => {
  const output = await mkdtemp(join(tmpdir(), 'foundry-delivery-path-output-'));
  assert.equal(
    resolveManagedDeliveryPath(output, 'docs/foundry/handoffs/delivery_test.md'),
    join(output, 'docs/foundry/handoffs/delivery_test.md'),
  );
  assert.throws(
    () => resolveManagedDeliveryPath(output, 'docs/foundry/../escape.md'),
    /must stay inside docs\/foundry/,
  );
  assert.throws(
    () => resolveManagedDeliveryPath(output, '../escape.md'),
    /must stay inside docs\/foundry/,
  );

  const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-delivery-path-store-')));
  const session = await store.create({
    projectRoot: output,
    platform: 'web',
    theme: 'light',
    breakpoint: 'desktop',
    state: 'default',
  });
  assert.throws(
    () =>
      deliveryExportFiles(
        session,
        deliveryRecord(session.changeSet.sessionId, { id: '../../outside' }),
      ),
    /Unsafe delivery record id/,
  );
});

test('refuses to write through symbolic links below the managed delivery root', async () => {
  const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-delivery-link-store-')));
  const output = await mkdtemp(join(tmpdir(), 'foundry-delivery-link-output-'));
  const outside = await mkdtemp(join(tmpdir(), 'foundry-delivery-link-outside-'));
  const session = await store.create({
    projectRoot: output,
    platform: 'web',
    theme: 'light',
    breakpoint: 'desktop',
    state: 'default',
  });
  const record = deliveryRecord(session.changeSet.sessionId);
  session.deliveryRecords = [record];
  await mkdir(join(output, 'docs/foundry'), { recursive: true });
  await symlink(outside, join(output, 'docs/foundry/handoffs'), 'dir');
  await assert.rejects(
    writeRepositoryDeliveryExport(output, session, record, now),
    /refuses symbolic-link paths/,
  );
});
