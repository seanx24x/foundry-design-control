import { createHash } from 'node:crypto';
import { access, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import type { DeliveryRecord, DocumentationPage } from 'foundry-design-protocol';
import { engineeringVerification, matchingDeliveryCaptures } from 'foundry-design-protocol';
export { matchingDeliveryCaptures } from 'foundry-design-protocol';
import {
  renderDeliveryMarkdown,
  sanitizeDeliveryText,
  type StoredSession,
} from 'foundry-design-runtime';

export interface DeliveryExportManifest {
  format: 'foundry.delivery-export';
  version: 1;
  generatedAt: string;
  deliveryRecordId: string;
  files: Array<{ path: string; sha256: string }>;
  documentationPages: Array<{ pageId: string; path: string; contentHash: string }>;
}

export class DeliveryExportConflictError extends Error {
  readonly conflictingPaths: string[];
  readonly documentationPageIds: string[];

  constructor(conflictingPaths: string[], documentationPageIds: string[]) {
    super(
      `Foundry preserved user-modified documentation. Resolve these conflicts before exporting:\n${conflictingPaths.map((path) => `  ${path}`).join('\n')}`,
    );
    this.name = 'DeliveryExportConflictError';
    this.conflictingPaths = [...conflictingPaths];
    this.documentationPageIds = [...new Set(documentationPageIds)];
  }
}

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function sanitizeJsonValue(value: unknown, projectRoot: string): unknown {
  if (typeof value === 'string') return sanitizeDeliveryText(value, projectRoot);
  if (Array.isArray(value)) return value.map((item) => sanitizeJsonValue(item, projectRoot));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeJsonValue(item, projectRoot)]),
    );
  }
  return value;
}

function safeJson(value: unknown, projectRoot: string): string {
  return `${JSON.stringify(sanitizeJsonValue(value, projectRoot), null, 2)}\n`;
}

export function renderPortableDeliveryJson(
  record: DeliveryRecord,
  projectRoot: string,
  session?: Pick<StoredSession, 'applyRuns'>,
): string {
  const run = session?.applyRuns.find((item) => item.id === record.applyRunId);
  return JSON.stringify(
    sanitizeJsonValue(
      {
        format: 'foundry.delivery-record',
        version: 1,
        record,
        reviewedChangeSet: run?.reviewedChangeSet,
      },
      projectRoot,
    ),
    null,
    2,
  );
}

export function renderEngineeringBrief(session: StoredSession, record: DeliveryRecord): string {
  const root = session.changeSet.context.projectRoot;
  const safe = (value: string) =>
    sanitizeDeliveryText(value, root)
      .replace(/\|/g, '\\|')
      .replace(/[\r\n]+/g, ' ');
  const value = (input: unknown) =>
    safe(typeof input === 'string' ? input : (JSON.stringify(input) ?? 'unknown'));
  const run = session.applyRuns.find((item) => item.id === record.applyRunId);
  const reviewed = run?.reviewedChangeSet;
  const changes = reviewed?.changes.filter((change) => record.changeIds.includes(change.id)) ?? [];
  const lines = [
    renderDeliveryMarkdown({ ...record, verificationResults: [] }, root),
    'The coverage below is checked against the frozen request and current Apply attempt.',
    '',
    '## Reviewed implementation contract',
    '',
  ];
  if (!reviewed)
    lines.push(
      'The frozen reviewed contract is unavailable in this older record. Exact edits and complete context verification cannot be reconstructed.',
      '',
    );
  else {
    lines.push(
      '| Target / property | Before | Requested | Source | Context | Verification |',
      '| --- | --- | --- | --- | --- | --- |',
    );
    for (const change of changes) {
      const mapping =
        change.mappingCandidates.find((item) => item.id === change.selectedMappingId) ??
        (change.mappingCandidates.length === 1 ? change.mappingCandidates[0] : undefined);
      const source = mapping?.source ?? change.target.source;
      for (const breakpoint of change.contextSet.breakpoints)
        for (const theme of change.contextSet.themes)
          for (const state of change.contextSet.states) {
            const verification = engineeringVerification(record, run, change, {
              breakpoint,
              theme,
              state,
            });
            const result = verification.result;
            const outcome =
              verification.status === 'passed'
                ? 'Passed'
                : verification.status === 'failed'
                  ? 'Failed'
                  : 'Untested';
            lines.push(
              `| ${safe(change.target.label)} / ${safe(change.property)} | ${value(change.before)} | ${value(change.after)} | ${source ? safe(`${source.file}${source.line ? `:${source.line}` : ''}`) : 'Mapping unavailable'} | ${safe(`${breakpoint} / ${theme} / ${state}`)} | ${outcome}${result ? `: rendered ${value(result.rendered)}` : ''}${verification.reason ? ` (${safe(verification.reason)})` : ''} |`,
            );
          }
    }
    if (!changes.length)
      lines.push('| No matching changes in the frozen contract | | | | | Untested |');
    lines.push('');
  }
  lines.push(
    '## Execution provenance',
    '',
    `- Reviewed source revision: ${safe(record.baselineRevision ?? 'Unavailable')}`,
    `- Applied source revision: ${safe(record.appliedRevision ?? 'Unavailable')}`,
    `- Apply run: ${safe(record.applyRunId)}`,
    `- Design graph revision: ${safe(record.designGraphRevision ?? 'Unavailable')}`,
    `- Narrative origin: ${record.narrativeSource}`,
    '',
  );
  if (record.blockers.length)
    lines.push(
      '## Unresolved blockers',
      '',
      ...record.blockers.map((item) => `- ${safe(item)}`),
      '',
    );
  const pairs = matchingDeliveryCaptures(record);
  lines.push('## Visual evidence', '');
  if (record.captureIssues?.length)
    lines.push(...record.captureIssues.map((issue) => `- Capture unavailable: ${safe(issue)}`), '');
  if (!pairs.length)
    lines.push(
      'No matching before/rebuilt image pair is recorded. Existing references are not proof of a visual comparison.',
      '',
    );
  for (const pair of pairs) {
    const context = pair.after.capture!;
    lines.push(
      `### ${safe(`${context.context.breakpoint} / ${context.context.theme} / ${context.context.state}`)} · ${context.viewport.width} × ${context.viewport.height}`,
      '',
      `Before: ${safe(pair.before.path)}`,
      '',
      `Rebuilt: ${safe(pair.after.path)}`,
      '',
    );
  }
  for (const evidence of record.evidence) {
    const phase =
      evidence.capture?.phase === 'preview'
        ? 'Temporary preview'
        : evidence.capture?.phase === 'rebuilt'
          ? 'Rebuilt capture (see provenance)'
          : evidence.capture?.phase === 'before'
            ? 'Before source change'
            : 'Unclassified reference';
    lines.push(
      `- ${phase}: ${safe(evidence.label)} — ${safe(evidence.path)} (${safe(evidence.createdAt)})`,
    );
  }
  if (!record.validationResults.length) lines.push('', 'No validation results are recorded.');
  if (!record.verificationResults.length)
    lines.push('', 'No rendered verification results are recorded.');
  return `${lines.join('\n')}\n`;
}

function historyMarkdown(session: StoredSession, projectRoot: string): string {
  const safe = (value: string) => sanitizeDeliveryText(value, projectRoot);
  const lines = ['# Foundry design history', ''];
  for (const milestone of session.deliveryMilestones) {
    const entries = session.designHistory.filter((entry) => milestone.entryIds.includes(entry.id));
    lines.push(
      `## Milestone: ${safe(milestone.name)} (${milestone.status})`,
      '',
      safe(milestone.summary),
      '',
      ...entries.map(
        (entry) =>
          `- ${safe(entry.title)}: ${safe(entry.summary)} (${safe(entry.deliveryRecordId)})`,
      ),
      '',
    );
    if (milestone.entryIds.length > entries.length)
      lines.push('Some milestone entries are unavailable in this session.', '');
  }
  if (!session.designHistory.length) lines.push('No verified delivery records yet.', '');
  for (const entry of session.designHistory) {
    lines.push(
      `## ${safe(entry.title)}`,
      '',
      safe(entry.summary),
      '',
      `Verified: ${safe(entry.createdAt)}`,
      '',
    );
  }
  return lines.join('\n');
}

function portableSlug(value: string, fallback: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  if (slug) return slug;
  const safeFallback = fallback
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return safeFallback || 'untitled';
}

function deliveryIdentifier(value: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,127}$/i.test(value)) {
    throw new Error(`Unsafe delivery record id: ${value}`);
  }
  return value;
}

function documentationPath(page: DocumentationPage): string {
  const folder =
    page.kind === 'component' ? 'components' : page.kind === 'system' ? '' : 'features';
  const slug = portableSlug(page.slug, page.id);
  return ['docs/foundry', folder, `${slug}.md`].filter(Boolean).join('/');
}

function documentationExports(
  session: StoredSession,
): DeliveryExportManifest['documentationPages'] {
  return session.documentationPages.map((page) => ({
    pageId: page.id,
    path: documentationPath(page),
    contentHash: page.contentHash,
  }));
}

function addManagedFile(files: Map<string, string>, path: string, content: string): void {
  if (files.has(path)) throw new Error(`Delivery export path collision: ${path}`);
  files.set(path, content);
}

export function deliveryExportFiles(
  session: StoredSession,
  record: DeliveryRecord,
): Map<string, string> {
  const root = session.changeSet.context.projectRoot;
  const files = new Map<string, string>();
  const recordId = deliveryIdentifier(record.id);
  const safe = (value: string) => sanitizeDeliveryText(value, root);
  addManagedFile(
    files,
    `docs/foundry/handoffs/${recordId}.md`,
    renderEngineeringBrief(session, record),
  );
  addManagedFile(
    files,
    `docs/foundry/handoffs/${recordId}.json`,
    `${renderPortableDeliveryJson(record, root, session)}\n`,
  );
  addManagedFile(
    files,
    `docs/foundry/handoffs/${recordId}.pr.md`,
    [
      `# ${safe(record.title)}`,
      '',
      safe(record.summary),
      '',
      '## Intent',
      '',
      safe(record.intent),
      '',
      '## Affected source and contexts',
      '',
      ...record.affectedFiles.map((file) => `- ${safe(file)}`),
      ...record.contexts.map(
        (context) =>
          `- ${safe(context.breakpoint)} / ${safe(context.theme)} / ${safe(context.state)}`,
      ),
      '',
      '## Risks and unresolved questions',
      '',
      ...[...record.risks, ...record.questions, ...record.blockers].map(
        (item) => `- ${safe(item)}`,
      ),
      '',
      '## Validation',
      '',
      ...record.validationResults.map(
        (item) =>
          `- [${item.passed ? 'x' : ' '}] ${safe(item.name)}${item.summary ? `: ${safe(item.summary)}` : ''}`,
      ),
      '',
      '## Rendered verification',
      '',
      'See the engineering brief for exact request, claim and context coverage. Raw pass flags alone are not treated as proof.',
      '',
      `Complete engineering brief: ${recordId}.md`,
      '',
    ].join('\n'),
  );
  for (const page of session.documentationPages)
    addManagedFile(files, documentationPath(page), `${safe(page.body)}\n`);
  addManagedFile(files, 'docs/foundry/history/history.json', safeJson(session.designHistory, root));
  addManagedFile(files, 'docs/foundry/history/CHANGELOG.md', `${historyMarkdown(session, root)}\n`);
  addManagedFile(files, 'docs/foundry/milestones.json', safeJson(session.deliveryMilestones, root));
  addManagedFile(
    files,
    `docs/foundry/assets/${recordId}.json`,
    safeJson(
      {
        screenshots: record.evidence,
        verification: record.verificationResults.map((item) => item.screenshotPath).filter(Boolean),
      },
      root,
    ),
  );
  return files;
}

export function resolveManagedDeliveryPath(outputRoot: string, relativePath: string): string {
  const root = resolve(outputRoot);
  const managedRoot = resolve(root, 'docs/foundry');
  const target = resolve(root, relativePath);
  const withinManagedRoot = relative(managedRoot, target);
  if (
    !withinManagedRoot ||
    withinManagedRoot === '..' ||
    withinManagedRoot.startsWith(`..${sep}`) ||
    isAbsolute(withinManagedRoot)
  ) {
    throw new Error(`Delivery export path must stay inside docs/foundry: ${relativePath}`);
  }
  return target;
}

async function exists(path: string): Promise<boolean> {
  return access(path)
    .then(() => true)
    .catch(() => false);
}

async function assertNoSymlinkTraversal(root: string, target: string): Promise<void> {
  const parts = relative(root, target).split(sep).filter(Boolean);
  let cursor = root;
  for (const part of parts) {
    cursor = join(cursor, part);
    try {
      if ((await lstat(cursor)).isSymbolicLink()) {
        throw new Error(`Delivery export refuses symbolic-link paths: ${cursor}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }
}

async function bundledDeliveryEvidence(projectRoot: string, record: DeliveryRecord) {
  const files = new Map<string, Buffer>();
  const attachments: Array<{
    source: string;
    status: 'bundled' | 'unavailable';
    path?: string;
    sha256?: string;
    reason?: string;
  }> = [];
  const candidates = [
    ...new Set([
      ...record.evidence.map((item) => item.path),
      ...record.verificationResults
        .map((item) => item.screenshotPath)
        .filter((item): item is string => Boolean(item)),
    ]),
  ];
  for (const [index, source] of candidates.entries()) {
    try {
      const target = resolve(projectRoot, source);
      const inside = relative(projectRoot, target);
      if (!inside || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside))
        throw new Error('Evidence is outside the project and was not copied.');
      await assertNoSymlinkTraversal(projectRoot, target);
      const extension = extname(target).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extension))
        throw new Error('Only PNG, JPEG and WebP evidence can be bundled.');
      const stat = await lstat(target);
      if (!stat.isFile() || stat.size > 20 * 1024 * 1024)
        throw new Error('Evidence is not a supported image file below 20 MB.');
      const content = await readFile(target);
      const metadata = await sharp(content).metadata();
      if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? ''))
        throw new Error('Evidence file content is not a supported image.');
      const provenance = record.evidence.find((item) => item.path === source)?.capture;
      const scale = provenance?.conditions?.deviceScaleFactor ?? 1;
      if (
        provenance &&
        (metadata.width !== Math.round(provenance.viewport.width * scale) ||
          metadata.height !== Math.round(provenance.viewport.height * scale))
      )
        throw new Error('Image dimensions do not match the recorded capture viewport.');
      const expected = record.evidence.find((item) => item.path === source)?.capture?.sha256;
      const contentHash = sha256(content);
      if (expected && expected !== contentHash)
        throw new Error('Evidence hash no longer matches the capture provenance.');
      const path = `docs/foundry/assets/${deliveryIdentifier(record.id)}-${index}${extension}`;
      files.set(path, content);
      attachments.push({ source, status: 'bundled', path, sha256: contentHash });
    } catch (error) {
      attachments.push({
        source,
        status: 'unavailable',
        reason:
          (error as NodeJS.ErrnoException).code === 'ENOENT'
            ? 'Evidence file is not present in the project.'
            : String((error as Error).message),
      });
    }
  }
  return { files, attachments };
}

export async function writeRepositoryDeliveryExport(
  outputRoot: string,
  session: StoredSession,
  record: DeliveryRecord,
  now = new Date().toISOString(),
): Promise<DeliveryExportManifest> {
  const root = resolve(outputRoot);
  const manifestPath = resolveManagedDeliveryPath(root, 'docs/foundry/manifest.json');
  await assertNoSymlinkTraversal(root, manifestPath);
  const previous = (await exists(manifestPath))
    ? (JSON.parse(await readFile(manifestPath, 'utf8')) as DeliveryExportManifest)
    : undefined;
  const priorHashes = new Map(previous?.files.map((file) => [file.path, file.sha256]) ?? []);
  const files = new Map<string, string | Buffer>(deliveryExportFiles(session, record));
  const bundled = await bundledDeliveryEvidence(session.changeSet.context.projectRoot, record);
  for (const [path, content] of bundled.files) files.set(path, content);
  files.set(
    `docs/foundry/assets/${deliveryIdentifier(record.id)}.json`,
    safeJson(
      { screenshots: record.evidence, attachments: bundled.attachments },
      session.changeSet.context.projectRoot,
    ),
  );
  const handoffPath = `docs/foundry/handoffs/${deliveryIdentifier(record.id)}.md`;
  files.set(
    handoffPath,
    `${files.get(handoffPath)}\n## Bundled image files\n\n${bundled.attachments.length ? bundled.attachments.map((item) => (item.status === 'bundled' ? `- [${sanitizeDeliveryText(item.source, session.changeSet.context.projectRoot)}](../assets/${item.path!.split('/').pop()}) · SHA-256 ${item.sha256}` : `- Unavailable: ${sanitizeDeliveryText(item.source, session.changeSet.context.projectRoot)}. ${sanitizeDeliveryText(item.reason ?? '', session.changeSet.context.projectRoot)}`)).join('\n') : 'No image files are referenced.'}\n`,
  );
  const documentationPages = documentationExports(session);
  const targets = new Map<string, string>();
  for (const relativePath of files.keys()) {
    const target = resolveManagedDeliveryPath(root, relativePath);
    await assertNoSymlinkTraversal(root, target);
    targets.set(relativePath, target);
  }
  const conflicts: string[] = [];
  for (const [relativePath, content] of files) {
    const target = targets.get(relativePath)!;
    if (!(await exists(target))) continue;
    const actualHash = sha256(await readFile(target));
    const managedHash = priorHashes.get(relativePath);
    if (
      (managedHash && actualHash !== managedHash) ||
      (!managedHash && actualHash !== sha256(content))
    ) {
      conflicts.push(relativePath);
    }
  }
  if (conflicts.length) {
    const conflictingPathSet = new Set(conflicts);
    throw new DeliveryExportConflictError(
      conflicts,
      documentationPages
        .filter((page) => conflictingPathSet.has(page.path))
        .map((page) => page.pageId),
    );
  }
  for (const [relativePath, content] of files) {
    const target = targets.get(relativePath)!;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  const manifest: DeliveryExportManifest = {
    format: 'foundry.delivery-export',
    version: 1,
    generatedAt: now,
    deliveryRecordId: record.id,
    files: [...files].map(([path, content]) => ({ path, sha256: sha256(content) })),
    documentationPages,
  };
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
