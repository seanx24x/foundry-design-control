import { createHash } from 'node:crypto';
import { basename, isAbsolute, relative } from 'node:path';
import type {
  ApplyRun,
  ChangeSet,
  DeliveryMilestone,
  DeliveryRecord,
  DesignChange,
  DesignHistoryEntry,
  DocumentationPage,
  ProjectDesignGraph,
} from 'foundry-design-protocol';

export function deliveryId(
  prefix: 'delivery' | 'doc' | 'history' | 'milestone',
  seed: string,
): string {
  return `${prefix}_${createHash('sha256').update(seed).digest('hex').slice(0, 20)}`;
}

export function sanitizeProjectPath(projectRoot: string, path: string): string {
  const normalized = path.replaceAll('\\', '/').trim();
  if (!normalized) return '';
  if (!isAbsolute(normalized)) {
    const safe = normalized.replace(/^\.\//, '');
    return safe.startsWith('../') || safe.includes('/../') ? basename(safe) : safe;
  }
  const candidate = relative(projectRoot, normalized).replaceAll('\\', '/');
  return candidate.startsWith('../') || isAbsolute(candidate) ? basename(normalized) : candidate;
}

export function sanitizeDeliveryText(value: string, projectRoot: string): string {
  const projectPaths = [
    projectRoot.trim(),
    projectRoot.replaceAll('\\', '/').trim(),
    projectRoot.replaceAll('/', '\\').trim(),
  ].filter((path, index, paths) => path && paths.indexOf(path) === index);
  let sanitized = value;
  for (const path of projectPaths) sanitized = sanitized.replaceAll(path, '.');
  return sanitized
    .replace(
      /([?&](?:token|__foundry_token|session|__foundry_session|__foundry_preview_capability)=)[^&\s)]+/gi,
      '$1[redacted]',
    )
    .replace(/(x-foundry-token\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]');
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function renderValue(value: unknown, unit?: string): string {
  const rendered = typeof value === 'string' ? value : JSON.stringify(value);
  return `${rendered}${unit ?? ''}`;
}

function changeContexts(change: DesignChange): DeliveryRecord['contexts'] {
  return change.contextSet.breakpoints.flatMap((breakpoint) =>
    change.contextSet.themes.flatMap((theme) =>
      change.contextSet.states.map((state) => ({ breakpoint, theme, state })),
    ),
  );
}

export function deliveryBlockers(
  changes: DesignChange[],
  operations: ChangeSet['operations'],
): string[] {
  const blockers: string[] = [];
  for (const change of changes) {
    if (change.confidence === 'unresolved')
      blockers.push(`${change.target.label}: source mapping is unresolved`);
    if (change.mappingCandidates.length > 1 && !change.selectedMappingId)
      blockers.push(`${change.target.label}: choose a source mapping`);
    if (!change.property)
      blockers.push(`${change.target.label}: required property context is missing`);
    const operation = change.operationId
      ? operations.find((candidate) => candidate.id === change.operationId)
      : undefined;
    if (operation?.status === 'unresolved')
      blockers.push(`${operation.label}: operation is unresolved`);
  }
  return unique(blockers);
}

export function createDeliveryRecord(
  changeSet: ChangeSet,
  run: ApplyRun,
  now: string,
): DeliveryRecord {
  const reviewedChangeSet = run.reviewedChangeSet ?? changeSet;
  const changes = reviewedChangeSet.changes.filter((change) => run.changeIds.includes(change.id));
  const operationIds = unique(changes.map((change) => change.operationId));
  const components = unique(changes.flatMap((change) => change.target.componentPath));
  const files = unique([
    ...changes.flatMap((change) => {
      const mapping =
        change.mappingCandidates.find((candidate) => candidate.id === change.selectedMappingId) ??
        (change.mappingCandidates.length === 1 ? change.mappingCandidates[0] : undefined);
      return [change.target.source?.file, mapping?.source?.file];
    }),
    ...reviewedChangeSet.operations
      .filter((operation) => operationIds.includes(operation.id))
      .flatMap((operation) => {
        const mapping =
          operation.mappingCandidates.find(
            (candidate) => candidate.id === operation.selectedMappingId,
          ) ??
          (operation.mappingCandidates.length === 1 ? operation.mappingCandidates[0] : undefined);
        return [mapping?.source?.file];
      }),
  ]).map((path) => sanitizeProjectPath(reviewedChangeSet.context.projectRoot, path));
  const contexts = Array.from(
    new Map(
      changes
        .flatMap(changeContexts)
        .map((context) => [
          JSON.stringify([context.breakpoint, context.theme, context.state]),
          context,
        ]),
    ).values(),
  );
  const blockers = deliveryBlockers(changes, reviewedChangeSet.operations);
  const title =
    changes.length === 1
      ? `${changes[0]!.target.label}: ${changes[0]!.property}`
      : `${changes[0]?.target.label ?? 'Design'} and ${changes.length - 1} more change${changes.length === 2 ? '' : 's'}`;
  const summary = changes
    .slice(0, 4)
    .map(
      (change) =>
        `${change.target.label} ${change.property}: ${renderValue(change.before, change.unit)} to ${renderValue(change.after, change.unit)}`,
    )
    .join('; ');
  return {
    version: 1,
    id: deliveryId('delivery', `${changeSet.sessionId}:${run.id}`),
    sessionId: reviewedChangeSet.sessionId,
    applyRunId: run.id,
    title,
    summary,
    intent: `Implement the reviewed ${changes.length === 1 ? 'change' : 'changes'} without altering unrelated product behavior.`,
    narrativeSource: 'deterministic',
    status: blockers.length ? 'draft' : 'ready',
    changeIds: run.changeIds,
    operationIds,
    affectedFiles: files,
    affectedComponents: components,
    affectedTokens: unique(changes.map((change) => change.token)),
    contexts,
    risks: changes.some((change) => change.scope === 'component')
      ? ['Component-scoped changes can affect more than the selected instance.']
      : [],
    questions: [],
    acceptanceCriteria: changes.map((change) => {
      const affectedContexts = changeContexts(change);
      return {
        id: `criterion_${change.id}`,
        label: `${change.target.label} renders ${change.property} as ${renderValue(change.after, change.unit)}${affectedContexts.length > 1 ? ` in all ${affectedContexts.length} reviewed contexts` : ''}`,
        status: 'pending',
        evidence: [
          ...change.evidence,
          ...affectedContexts.map(
            (context) => `Context: ${context.breakpoint} / ${context.theme} / ${context.state}`,
          ),
        ],
      };
    }),
    blockers,
    validationResults: [],
    verificationResults: [],
    evidence: reviewedChangeSet.screenshots.map((item) => ({
      ...item,
      path: sanitizeProjectPath(reviewedChangeSet.context.projectRoot, item.path),
    })),
    revision: run.revision,
    baselineRevision: run.revision,
    appliedRevision: run.appliedRevision,
    designGraphRevision: run.designGraphRevision,
    createdAt: now,
    updatedAt: now,
  };
}

export function syncDeliveryRecord(
  record: DeliveryRecord,
  run: ApplyRun,
  projectRoot: string,
  now: string,
): DeliveryRecord {
  const status =
    run.state === 'passed'
      ? 'verified'
      : ['claimed', 'applying', 'rebuilding', 'verifying'].includes(run.state)
        ? 'implementing'
        : record.status === 'implementing'
          ? 'ready'
          : record.status;
  const verificationByChange = new Map<string, typeof run.verificationResults>();
  for (const result of run.verificationResults) {
    const results = verificationByChange.get(result.changeId) ?? [];
    results.push(result);
    verificationByChange.set(result.changeId, results);
  }
  return {
    ...record,
    status,
    affectedFiles: (run.applyResultAcknowledgedAt
      ? run.appliedChangedFiles
      : record.affectedFiles
    ).map((path) => sanitizeProjectPath(projectRoot, path)),
    validationResults: run.validationResults,
    verificationResults: run.verificationResults.map((result) => ({
      ...result,
      screenshotPath: result.screenshotPath
        ? sanitizeProjectPath(projectRoot, result.screenshotPath)
        : undefined,
    })),
    acceptanceCriteria: record.acceptanceCriteria.map((criterion) => {
      const changeId = criterion.id.replace(/^criterion_/, '');
      const results = verificationByChange.get(changeId) ?? [];
      const complete = ['passed', 'needs_attention'].includes(run.state) && results.length > 0;
      return complete
        ? {
            ...criterion,
            status: results.every((result) => result.passed)
              ? ('passed' as const)
              : ('failed' as const),
            evidence: unique([
              ...criterion.evidence,
              ...results.flatMap((result) => [
                result.reason,
                result.context
                  ? `Verified context: ${result.context.breakpoint} / ${result.context.theme} / ${result.context.state}`
                  : undefined,
                result.screenshotPath
                  ? sanitizeProjectPath(projectRoot, result.screenshotPath)
                  : undefined,
              ]),
            ]),
          }
        : criterion;
    }),
    updatedAt: now,
    revision: run.appliedRevision ?? record.revision,
    baselineRevision: record.baselineRevision ?? run.revision,
    appliedRevision: run.appliedRevision ?? record.appliedRevision,
    verifiedAt: run.state === 'passed' ? now : record.verifiedAt,
  };
}

export function createHistoryEntry(record: DeliveryRecord, now: string): DesignHistoryEntry {
  if (record.status !== 'verified') throw new Error('Only verified delivery records enter history');
  return {
    version: 1,
    id: deliveryId('history', record.id),
    deliveryRecordId: record.id,
    applyRunId: record.applyRunId,
    title: record.title,
    summary: record.summary,
    changeIds: record.changeIds,
    affectedFiles: record.affectedFiles,
    contexts: record.contexts,
    validationResults: record.validationResults,
    verificationResults: record.verificationResults,
    revision: record.revision,
    baselineRevision: record.baselineRevision,
    appliedRevision: record.appliedRevision,
    createdAt: now,
  };
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'untitled'
  );
}

function hashBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

export function generateDocumentation(
  graph: ProjectDesignGraph | null,
  records: DeliveryRecord[],
  context: ChangeSet['context'],
  existing: DocumentationPage[],
  now: string,
): DocumentationPage[] {
  const verified = records.filter((record) => record.status === 'verified');
  const specs: Array<
    Omit<DocumentationPage, 'id' | 'version' | 'contentHash' | 'createdAt' | 'updatedAt'>
  > = [];
  if (graph) {
    const systemBody = [
      '# Design system',
      '',
      `Generated from design graph ${graph.revision ?? graph.indexedAt}.`,
      '',
      `- ${graph.tokens.length} tokens`,
      `- ${graph.components.length} components`,
      `- ${graph.breakpoints.length} breakpoints`,
      `- ${graph.themes.length} themes`,
      `- ${graph.states.length} states`,
      `- ${graph.motionPresets.length} motion presets`,
    ].join('\n');
    specs.push({
      kind: 'system',
      slug: 'design-system',
      title: 'Design system',
      summary: 'Current source-backed design-system inventory.',
      body: systemBody,
      narrativeSource: 'deterministic',
      freshness: 'current',
      sourceFiles: unique(graph.components.map((item) => item.source?.file)).map((path) =>
        sanitizeProjectPath(context.projectRoot, path),
      ),
      componentIds: graph.components.map((item) => item.id),
      deliveryRecordIds: verified.map((item) => item.id),
      revision: context.revision,
      designGraphRevision: graph.revision ?? graph.indexedAt,
      exportedHash: undefined,
      exportedPath: undefined,
    });
    for (const component of graph.components) {
      const body = [
        `# ${component.name}`,
        '',
        component.source
          ? `Source: \`${sanitizeProjectPath(context.projectRoot, component.source.file)}${component.source.line ? `:${component.source.line}` : ''}\``
          : 'Source mapping unavailable.',
        '',
        `Instances: ${component.instances}`,
        `Variants: ${component.variants.length ? component.variants.join(', ') : 'None recorded'}`,
        `Variant axes: ${component.variantAxes.length ? component.variantAxes.map((axis) => axis.label).join(', ') : 'None recorded'}`,
      ].join('\n');
      specs.push({
        kind: 'component',
        slug: slugify(component.name),
        title: component.name,
        summary: 'Source-backed component reference.',
        body,
        narrativeSource: 'deterministic',
        freshness: 'current',
        sourceFiles: component.source
          ? [sanitizeProjectPath(context.projectRoot, component.source.file)]
          : [],
        componentIds: [component.id],
        deliveryRecordIds: verified
          .filter((record) => record.affectedComponents.includes(component.name))
          .map((record) => record.id),
        revision: context.revision,
        designGraphRevision: graph.revision ?? graph.indexedAt,
        exportedHash: undefined,
        exportedPath: undefined,
      });
    }
  }
  const screenTitle = context.targetName || 'Product surface';
  const relevant = verified.filter((record) =>
    record.contexts.some(
      (item) => item.breakpoint === context.breakpoint || item.state === context.state,
    ),
  );
  const screenBody = [
    `# ${screenTitle}`,
    '',
    `Platform: ${context.platform}`,
    `Default context: ${context.breakpoint} / ${context.theme} / ${context.state}`,
    '',
    '## Verified delivery records',
    '',
    ...(relevant.length
      ? relevant.map((record) => `- ${record.title} (${record.id})`)
      : ['No verified records yet.']),
  ].join('\n');
  specs.push({
    kind: 'screen',
    slug: slugify(screenTitle),
    title: screenTitle,
    summary: 'Verified surface behavior and delivery history.',
    body: screenBody,
    narrativeSource: 'deterministic',
    freshness: 'current',
    sourceFiles: unique(relevant.flatMap((item) => item.affectedFiles)),
    componentIds: unique(relevant.flatMap((item) => item.affectedComponents)),
    deliveryRecordIds: relevant.map((item) => item.id),
    revision: context.revision,
    designGraphRevision: context.designGraphRevision,
    exportedHash: undefined,
    exportedPath: undefined,
  });
  return specs.map((spec) => {
    const prior = existing.find((item) => item.kind === spec.kind && item.slug === spec.slug);
    const contentHash = hashBody(spec.body);
    const conflicted =
      prior?.freshness === 'conflicted' ||
      Boolean(prior?.exportedHash && prior.exportedHash !== prior.contentHash);
    return {
      ...spec,
      version: 1,
      id: prior?.id ?? deliveryId('doc', `${spec.kind}:${spec.slug}`),
      contentHash,
      freshness: conflicted ? 'conflicted' : spec.freshness,
      exportedHash: prior?.exportedHash,
      exportedPath: prior?.exportedPath,
      createdAt: prior?.createdAt ?? now,
      updatedAt: prior?.contentHash === contentHash ? prior.updatedAt : now,
    };
  });
}

export function markDocumentationStale(
  pages: DocumentationPage[],
  affectedFiles: string[],
  now: string,
): DocumentationPage[] {
  const changed = new Set(affectedFiles);
  return pages.map((page) =>
    page.sourceFiles.some((file) => changed.has(file))
      ? {
          ...page,
          freshness: page.freshness === 'conflicted' ? 'conflicted' : 'stale',
          updatedAt: now,
        }
      : page,
  );
}

export function renderDeliveryMarkdown(record: DeliveryRecord, projectRoot = ''): string {
  const safe = (value: string) => sanitizeDeliveryText(value, projectRoot);
  const list = (values: string[], empty = 'None') =>
    values.length ? values.map((value) => `- ${safe(value)}`).join('\n') : `- ${empty}`;
  return [
    `# ${safe(record.title)}`,
    '',
    `Status: ${record.status}`,
    `Delivery record: ${record.id}`,
    '',
    '## Intent',
    '',
    safe(record.intent),
    '',
    '## Summary',
    '',
    safe(record.summary),
    '',
    '## Affected source',
    '',
    list(record.affectedFiles),
    '',
    '## Components',
    '',
    list(record.affectedComponents),
    '',
    '## Tokens',
    '',
    list(record.affectedTokens),
    '',
    '## Contexts',
    '',
    ...record.contexts.map(
      (context) =>
        `- ${safe(context.breakpoint)} / ${safe(context.theme)} / ${safe(context.state)}`,
    ),
    '',
    '## Risks',
    '',
    list(record.risks),
    '',
    '## Open questions',
    '',
    list(record.questions),
    '',
    '## Acceptance criteria',
    '',
    ...record.acceptanceCriteria.map(
      (item) => `- [${item.status === 'passed' ? 'x' : ' '}] ${safe(item.label)} (${item.status})`,
    ),
    '',
    '## Validation',
    '',
    ...record.validationResults.map(
      (item) =>
        `- ${item.passed ? 'Passed' : 'Failed'}: ${safe(item.name)}${item.summary ? ` — ${safe(item.summary)}` : ''}`,
    ),
    '',
    '## Rendered verification',
    '',
    ...record.verificationResults.map(
      (item) =>
        `- ${item.passed ? 'Passed' : 'Failed'}: ${safe(item.property)}${item.context ? ` (${safe(item.context.breakpoint)} / ${safe(item.context.theme)} / ${safe(item.context.state)})` : ''}${item.reason ? ` — ${safe(item.reason)}` : ''}`,
    ),
    '',
  ].join('\n');
}

export function createMilestone(
  name: string,
  summary: string,
  entryIds: string[],
  now: string,
): DeliveryMilestone {
  return {
    version: 1,
    id: deliveryId('milestone', `${name}:${now}`),
    name,
    summary,
    entryIds: unique(entryIds),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}
