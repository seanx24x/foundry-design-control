import { createHash } from 'node:crypto';
import { access, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { DeliveryRecord, DocumentationPage } from 'foundry-design-protocol';
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

function sha256(content: string): string {
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

export function renderPortableDeliveryJson(record: DeliveryRecord, projectRoot: string): string {
  return JSON.stringify(
    sanitizeJsonValue({ format: 'foundry.delivery-record', version: 1, record }, projectRoot),
    null,
    2,
  );
}

function historyMarkdown(session: StoredSession, projectRoot: string): string {
  const safe = (value: string) => sanitizeDeliveryText(value, projectRoot);
  const lines = ['# Foundry design history', ''];
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
    `${renderDeliveryMarkdown(record, root)}\n`,
  );
  addManagedFile(
    files,
    `docs/foundry/handoffs/${recordId}.json`,
    safeJson({ format: 'foundry.delivery-record', version: 1, record }, root),
  );
  addManagedFile(
    files,
    `docs/foundry/handoffs/${recordId}.pr.md`,
    [
      `# ${safe(record.title)}`,
      '',
      safe(record.summary),
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
      ...record.verificationResults.map(
        (item) =>
          `- [${item.passed ? 'x' : ' '}] ${safe(item.property)}${item.reason ? `: ${safe(item.reason)}` : ''}`,
      ),
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
  const files = deliveryExportFiles(session, record);
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
    const actualHash = sha256(await readFile(target, 'utf8'));
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
