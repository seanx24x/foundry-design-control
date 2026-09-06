import {
  designBranchRecordSchema,
  type DesignBranch,
  type DesignBranchRecord,
  type DesignBranchRecordSource,
  type DesignChange,
  type ProjectDesignGraph,
  type SessionContext,
  type SourceMappingCandidate,
  type SourceRef,
} from 'foundry-design-protocol';

function normalizeFile(file: string, projectRoot?: string): string {
  const normalized = file.replaceAll('\\', '/').replace(/^\.\//, '');
  const root = projectRoot?.replaceAll('\\', '/').replace(/\/$/, '');
  return root && normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized;
}

function selectedSource(change: DesignChange): SourceRef | undefined {
  const mapping = change.mappingCandidates.find(
    (candidate: SourceMappingCandidate) => candidate.id === change.selectedMappingId,
  );
  return mapping?.source ?? change.target.source;
}

function sourceRelationships(branch: DesignBranch): DesignBranchRecordSource[] {
  const seen = new Set<string>();
  const relationships: DesignBranchRecordSource[] = [];
  for (const change of branch.changes) {
    const source = selectedSource(change);
    const key = [change.target.id, change.property, source?.file, source?.line].join(':');
    if (seen.has(key)) continue;
    seen.add(key);
    relationships.push({
      targetId: change.target.id,
      targetLabel: change.target.label,
      property: change.property,
      componentPath: change.target.componentPath,
      source,
    });
  }
  return relationships;
}

export function graphSourceFiles(graph: ProjectDesignGraph | null): Set<string> {
  if (!graph) return new Set();
  const files = new Set<string>();
  const add = (source?: SourceRef): void => {
    if (source?.file) files.add(normalizeFile(source.file, graph.projectRoot));
  };
  graph.tokens.forEach((item) => add(item.source));
  graph.components.forEach((item) => {
    add(item.source);
    item.variants.forEach((variant) => add(variant.source));
    item.variantAxes.forEach((axis) => add(axis.source));
  });
  graph.breakpoints.forEach((item) => add(item.source));
  graph.containerQueries?.forEach((item) => add(item.source));
  graph.themes.forEach((item) => add(item.source));
  graph.motionPresets.forEach((item) => add(item.source));
  graph.tokenUsages.forEach((item) => add(item.source));
  graph.designSystemFindings.forEach((item) => add(item.source));
  graph.tokenPromotions?.forEach((item) => item.sources.forEach(add));
  return files;
}

export function assessBranchRecord(
  input: DesignBranchRecord,
  context: SessionContext,
  graph: ProjectDesignGraph | null,
  checkedAt = new Date().toISOString(),
): DesignBranchRecord {
  const record = designBranchRecordSchema.parse(input);
  const relationships = record.sourceRelationships.filter((item) => item.source?.file);
  const currentFiles = graphSourceFiles(graph);
  const matchedSources = relationships.filter((item) =>
    currentFiles.has(normalizeFile(item.source!.file, record.context.projectRoot)),
  ).length;
  const warnings: string[] = [];
  if (!graph) warnings.push('Refresh the project index to verify source relationships.');
  if (!relationships.length) warnings.push('This record has no mapped source relationships.');
  if (graph && matchedSources < relationships.length) {
    warnings.push(
      `${relationships.length - matchedSources} source relationship${relationships.length - matchedSources === 1 ? '' : 's'} could not be matched.`,
    );
  }
  if (record.context.revision && context.revision && record.context.revision !== context.revision) {
    warnings.push('The source revision has changed since this decision was recorded.');
  }
  if (
    record.context.designGraphRevision &&
    context.designGraphRevision &&
    record.context.designGraphRevision !== context.designGraphRevision
  ) {
    warnings.push('The project design graph has changed since this decision was recorded.');
  }
  if (record.context.projectRoot !== context.projectRoot && matchedSources > 0) {
    warnings.push('The project location changed; sources were matched by relative path.');
  }
  const status =
    !relationships.length || (graph && matchedSources === 0)
      ? 'missing'
      : !graph ||
          matchedSources < relationships.length ||
          warnings.some((item) => item.includes('revision') || item.includes('design graph'))
        ? 'stale'
        : 'current';
  return designBranchRecordSchema.parse({
    ...record,
    compatibility: {
      status,
      matchedSources,
      totalSources: relationships.length,
      warnings,
      checkedAt,
    },
  });
}

export function createBranchRecord(
  branch: DesignBranch,
  outcome: 'chosen' | 'rejected',
  context: SessionContext,
  graph: ProjectDesignGraph | null,
  id: string,
  now = new Date().toISOString(),
): DesignBranchRecord {
  const draft = designBranchRecordSchema.parse({
    version: 1,
    id,
    branchId: branch.id,
    name: branch.name,
    outcome,
    rationale: branch.rejectionReason,
    context,
    changes: branch.changes,
    operations: branch.operations,
    sourceRelationships: sourceRelationships(branch),
    compatibility: {
      status: 'stale',
      matchedSources: 0,
      totalSources: 0,
      warnings: ['Compatibility has not been checked.'],
      checkedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  });
  return assessBranchRecord(draft, context, graph, now);
}
