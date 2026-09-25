import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  PROTOCOL_VERSION,
  applyRunSchema,
  changeKey,
  changeSetSchema,
  coalesceChanges,
  designBranchRecordBundleSchema,
  designBranchRecordSchema,
  designBranchSchema,
  deliveryMilestoneSchema,
  deliveryRecordSchema,
  designChangeSchema,
  designHistoryEntrySchema,
  designOperationSchema,
  documentationPageSchema,
  projectDesignGraphSchema,
  sessionContextSchema,
  validationResultSchema,
  verificationResultSchema,
  visualAgentContextSchema,
  visualAgentProposalSchema,
  visualAgentRequestSchema,
  type ApplyRun,
  type ApplyRunState,
  type ChangeSet,
  type ChangeContext,
  type DesignChange,
  type DesignChangeInput,
  type DesignBranch,
  type DesignBranchRecord,
  type DesignBranchRecordBundle,
  type DeliveryMilestone,
  type DeliveryRecord,
  type DesignHistoryEntry,
  type DocumentationPage,
  type DesignOperation,
  type DesignOperationInput,
  type ProjectDesignGraph,
  type ProjectDesignGraphInput,
  type SessionContext,
  type SourceFileSnapshot,
  type VerificationResult,
  type VisualAgentContext,
  type VisualAgentProposal,
  type VisualAgentRequest,
} from 'foundry-design-protocol';
import { assessBranchRecord, createBranchRecord } from './branch-records.js';
import {
  createDeliveryRecord,
  createHistoryEntry,
  createMilestone,
  generateDocumentation,
  markDocumentationStale,
  syncDeliveryRecord,
} from './delivery.js';
import { withSessionFileLock } from './session-file-lock.js';
import { verificationValueMatches } from './verification-value.js';

export interface StoredSession {
  token: string;
  /** SHA-256 only. The plaintext preview capability exists only in the launched preview URL. */
  previewCapabilityHash?: string;
  changeSet: ChangeSet;
  verifications: VerificationResult[];
  applyRuns: ApplyRun[];
  designGraph: ProjectDesignGraph | null;
  designBranches: DesignBranch[];
  designBranchRecords: DesignBranchRecord[];
  activeDesignBranchId?: string;
  visualAgentRequests: VisualAgentRequest[];
  deliveryRecords: DeliveryRecord[];
  documentationPages: DocumentationPage[];
  designHistory: DesignHistoryEntry[];
  deliveryMilestones: DeliveryMilestone[];
}

export interface SessionStoreOptions {
  claimLeaseMs?: number;
  now?: () => Date;
}

export interface ApplySourceProof {
  scope: 'git' | 'mapped-files';
  revision: string;
  headRevision?: string;
  files: SourceFileSnapshot[];
  changedRanges?: SourceChangedRange[];
}

export interface ReviewedSourceLocation {
  path: string;
  line?: number;
  symbol?: string;
}

export interface SourceChangedRange {
  path: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
}

export interface DocumentationExportMetadata {
  pageId: string;
  path: string;
  contentHash: string;
}

export interface SetDesignGraphOptions {
  expectedRevision?: string | null;
  expectedDesignGraphRevision?: string | null;
}

function defaultStoreRoot(): string {
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Foundry Design Control', 'sessions');
  }
  return join(
    process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'),
    'foundry-design-control',
    'sessions',
  );
}

function sessionId(): string {
  return `ses_${randomUUID().replaceAll('-', '')}`;
}

function changeId(): string {
  return `chg_${randomUUID().replaceAll('-', '')}`;
}

function applyRunId(): string {
  return `run_${randomUUID().replaceAll('-', '')}`;
}

function claimCapabilityHash(capability: string): string {
  return createHash('sha256').update(capability).digest('hex');
}

export function previewCapabilityMatches(
  storedHash: string | undefined,
  capability: string | undefined,
): boolean {
  if (!storedHash || !capability || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const expected = Buffer.from(storedHash, 'hex');
  const received = Buffer.from(claimCapabilityHash(capability), 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function assertClaimAuthority(
  run: ApplyRun,
  claimAttemptId: string | undefined,
  claimCapability: string | undefined,
): void {
  if (!run.claimAttemptId || run.claimAttemptId !== claimAttemptId) {
    throw new Error('This claim is no longer active. Reclaim the apply run before continuing.');
  }
  if (!run.claimCapabilityHash) return;
  if (!claimCapability) {
    throw new Error('This Apply mutation requires the private capability issued to its claimant.');
  }
  const expected = Buffer.from(run.claimCapabilityHash, 'hex');
  const received = Buffer.from(claimCapabilityHash(claimCapability), 'hex');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error('This Apply claim capability is invalid or no longer active.');
  }
}

function assertVisualClaimAuthority(
  request: VisualAgentRequest,
  claimAttemptId: string | undefined,
  claimCapability: string | undefined,
): void {
  if (request.status !== 'thinking' || request.claimAttemptId !== claimAttemptId) {
    throw new Error('This visual request is no longer claimed by the current agent attempt.');
  }
  if (!request.claimCapabilityHash) return;
  if (!claimCapability) {
    throw new Error('This visual request requires the private capability issued to its claimant.');
  }
  const expected = Buffer.from(request.claimCapabilityHash, 'hex');
  const received = Buffer.from(claimCapabilityHash(claimCapability), 'hex');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error('This visual request claim capability is invalid or no longer active.');
  }
}

function operationId(): string {
  return `op_${randomUUID().replaceAll('-', '')}`;
}

function branchId(): string {
  return `branch_${randomUUID().replaceAll('-', '')}`;
}

function branchRecordId(): string {
  return `record_${randomUUID().replaceAll('-', '')}`;
}

function visualRequestId(): string {
  return `ask_${randomUUID().replaceAll('-', '')}`;
}

function visualMessageId(): string {
  return `msg_${randomUUID().replaceAll('-', '')}`;
}

function visualProposalId(): string {
  return `proposal_${randomUUID().replaceAll('-', '')}`;
}

const activeRunStates = new Set<ApplyRunState>([
  'queued',
  'claimed',
  'applying',
  'rebuilding',
  'verifying',
]);

function contextKey(context: ChangeContext): string {
  return JSON.stringify([context.breakpoint, context.theme, context.state]);
}

function verificationKey(result: VerificationResult): string {
  const context = result.context ?? {
    breakpoint: 'current',
    theme: 'current',
    state: 'current',
  };
  return JSON.stringify([result.changeId, context.breakpoint, context.theme, context.state]);
}

function verificationKeyForContext(changeId: string, context: ChangeContext): string {
  return JSON.stringify([changeId, context.breakpoint, context.theme, context.state]);
}

function expandedChangeContexts(change: DesignChange): ChangeContext[] {
  return change.contextSet.breakpoints.flatMap((breakpoint) =>
    change.contextSet.themes.flatMap((theme) =>
      change.contextSet.states.map((state) => ({ breakpoint, theme, state })),
    ),
  );
}

function freezeReviewedChangeSet(
  changeSet: ChangeSet,
  changeIds: string[],
  updatedAt = changeSet.updatedAt,
): ChangeSet | undefined {
  const changesById = new Map(changeSet.changes.map((change) => [change.id, change]));
  const changes = changeIds.map((id) => changesById.get(id));
  if (changes.some((change) => !change)) return undefined;
  const frozenChanges = changes.map((change) => ({ ...change!, status: 'approved' as const }));
  const operationIds = new Set(
    frozenChanges.map((change) => change.operationId).filter((id): id is string => Boolean(id)),
  );
  const changeIdSet = new Set(changeIds);
  const operations = changeSet.operations
    .filter((operation) => operationIds.has(operation.id))
    .map((operation) => ({
      ...operation,
      changeIds: operation.changeIds.filter((id) => changeIdSet.has(id)),
    }));
  return changeSetSchema.parse({
    ...changeSet,
    changes: frozenChanges,
    operations,
    updatedAt,
  });
}

function changeMatchesFrozenContract(current: DesignChange, frozen: DesignChange): boolean {
  const comparable = (change: DesignChange) => {
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...contract } = change;
    return contract;
  };
  return isDeepStrictEqual(comparable(current), comparable(frozen));
}

function changeIdsExactlyMatch(changeIds: string[], reviewedChangeSet: ChangeSet): boolean {
  const requestedIds = [...new Set(changeIds)];
  const frozenIds = reviewedChangeSet.changes.map((change) => change.id);
  return (
    requestedIds.length === changeIds.length &&
    requestedIds.length === frozenIds.length &&
    requestedIds.every((changeId) => frozenIds.includes(changeId))
  );
}

function currentLedgerMatchesReviewedContract(
  changeSet: ChangeSet,
  reviewedChangeSet: ChangeSet,
): boolean {
  const currentChanges = new Map(changeSet.changes.map((change) => [change.id, change]));
  return reviewedChangeSet.changes.every((frozen) => {
    const current = currentChanges.get(frozen.id);
    return Boolean(current && changeMatchesFrozenContract(current, frozen));
  });
}

function normalizeSourcePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

export function reviewedSourceFiles(reviewedChangeSet: ChangeSet): string[] {
  return [
    ...new Set(
      reviewedSourceGroups(reviewedChangeSet).flatMap((group) =>
        group.locations.map((location) => location.path),
      ),
    ),
  ].sort();
}

function selectedSourceLocation(
  candidates: DesignChange['mappingCandidates'],
  selectedMappingId?: string,
): ReviewedSourceLocation | undefined {
  const selected =
    candidates.find((candidate) => candidate.id === selectedMappingId) ??
    (candidates.length === 1 ? candidates[0] : undefined);
  return selected?.source?.file
    ? {
        path: normalizeSourcePath(selected.source.file),
        line: selected.source.line,
        symbol: selected.source.symbol,
      }
    : undefined;
}

export function reviewedSourceLocations(reviewedChangeSet: ChangeSet): ReviewedSourceLocation[] {
  const locations = reviewedSourceGroups(reviewedChangeSet).flatMap((group) => group.locations);
  return [
    ...new Map(
      locations.map((location) => [
        JSON.stringify([location.path, location.line, location.symbol]),
        location,
      ]),
    ).values(),
  ].sort((left, right) =>
    left.path === right.path
      ? (left.line ?? Number.MAX_SAFE_INTEGER) - (right.line ?? Number.MAX_SAFE_INTEGER)
      : left.path.localeCompare(right.path),
  );
}

function reviewedSourceGroups(
  reviewedChangeSet: ChangeSet,
): Array<{ label: string; locations: ReviewedSourceLocation[] }> {
  const operations = new Map(
    reviewedChangeSet.operations.map((operation) => [operation.id, operation]),
  );
  const changeLocations = new Map<string, ReviewedSourceLocation[]>();
  for (const change of reviewedChangeSet.changes) {
    const operation = change.operationId ? operations.get(change.operationId) : undefined;
    const operationMapped = operation
      ? selectedSourceLocation(operation.mappingCandidates, operation.selectedMappingId)
      : undefined;
    const mapped = selectedSourceLocation(change.mappingCandidates, change.selectedMappingId);
    const fallback = change.target.source?.file
      ? [
          {
            path: normalizeSourcePath(change.target.source.file),
            line: change.target.source.line,
            symbol: change.target.source.symbol,
          },
        ]
      : [];
    changeLocations.set(
      change.id,
      operationMapped ? [operationMapped] : mapped ? [mapped] : fallback,
    );
  }
  const groups = reviewedChangeSet.changes.map((change) => ({
    label: `change ${change.id}`,
    locations: changeLocations.get(change.id) ?? [],
  }));
  for (const operation of reviewedChangeSet.operations) {
    const mapped = selectedSourceLocation(operation.mappingCandidates, operation.selectedMappingId);
    const fallback = operation.changeIds.flatMap((changeId) => changeLocations.get(changeId) ?? []);
    const locations = mapped
      ? [mapped]
      : [
          ...new Map(
            fallback.map((location) => [
              JSON.stringify([location.path, location.line, location.symbol]),
              location,
            ]),
          ).values(),
        ];
    groups.push({ label: `operation ${operation.id}`, locations });
  }
  return groups;
}

function normalizeSourceSnapshots(files: SourceFileSnapshot[]): SourceFileSnapshot[] {
  const byPath = new Map<string, SourceFileSnapshot>();
  for (const file of files) {
    const path = normalizeSourcePath(file.path);
    if (!path || path.startsWith('../') || path.includes('/../')) {
      throw new Error(`Source proof contains an unsafe project path: ${file.path}`);
    }
    if (byPath.has(path)) throw new Error(`Source proof contains duplicate path: ${path}`);
    if (file.exists !== Boolean(file.sha256)) {
      throw new Error(`Source proof for ${path} has inconsistent existence and content hash`);
    }
    const anchorLines = new Set<number>();
    const lineAnchors = (file.lineAnchors ?? []).map((anchor) => {
      if (!Number.isInteger(anchor.line) || anchor.line < 1) {
        throw new Error(`Source proof for ${path} contains an invalid line anchor`);
      }
      if (anchorLines.has(anchor.line)) {
        throw new Error(`Source proof for ${path} contains duplicate line ${anchor.line}`);
      }
      anchorLines.add(anchor.line);
      if (!/^[a-f0-9]{64}$/.test(anchor.sha256)) {
        throw new Error(`Source proof for ${path}:${anchor.line} has an invalid content hash`);
      }
      return anchor;
    });
    if (!file.exists && lineAnchors.length) {
      throw new Error(`Missing source file ${path} cannot contain line anchors`);
    }
    byPath.set(path, { ...file, path, lineAnchors });
  }
  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function lineAnchorChanged(
  before: SourceFileSnapshot | undefined,
  after: SourceFileSnapshot | undefined,
  location: ReviewedSourceLocation,
): { changed: boolean; startLine: number; endLine: number } {
  const matches = (anchor: NonNullable<SourceFileSnapshot['lineAnchors']>[number]) =>
    anchor.line === location.line && (!location.symbol || anchor.symbol === location.symbol);
  const beforeAnchor = before?.lineAnchors?.find(matches);
  const afterAnchor = after?.lineAnchors?.find(matches);
  return {
    changed: Boolean(beforeAnchor && afterAnchor && beforeAnchor.sha256 !== afterAnchor.sha256),
    startLine: beforeAnchor?.line ?? location.line ?? 0,
    endLine: beforeAnchor?.endLine ?? beforeAnchor?.line ?? location.line ?? 0,
  };
}

function rangeIntersectsAnchor(
  range: SourceChangedRange,
  path: string,
  startLine: number,
  endLine: number,
): boolean {
  if (normalizeSourcePath(range.path) !== path) return false;
  const intersects = (start: number, count: number) =>
    count > 0 && start <= endLine && start + count - 1 >= startLine;
  return intersects(range.oldStart, range.oldLines) || intersects(range.newStart, range.newLines);
}

function sourceSnapshotChanged(
  before: SourceFileSnapshot | undefined,
  after: SourceFileSnapshot | undefined,
): boolean {
  return !before || !after || before.exists !== after.exists || before.sha256 !== after.sha256;
}

function assertSourceProof(
  run: ApplyRun,
  proof: ApplySourceProof,
): {
  changedFiles: string[];
  files: SourceFileSnapshot[];
} {
  if (!proof.revision) throw new Error('Apply source proof requires a live project revision');
  if (!run.revision) throw new Error('The reviewed Apply run has no source revision baseline');
  if (!run.sourceProofScope || proof.scope !== run.sourceProofScope) {
    throw new Error('Apply source proof scope changed after the reviewed claim');
  }
  if (proof.scope === 'git' && proof.headRevision !== run.sourceHeadRevision) {
    throw new Error(
      'The Git HEAD changed after review. This Apply run needs attention and must be reviewed again.',
    );
  }
  if (proof.revision === run.revision) {
    throw new Error('No source revision change was detected after the reviewed Apply claim');
  }
  const baseline = new Map(
    normalizeSourceSnapshots(run.baselineSourceFiles).map((file) => [file.path, file]),
  );
  const currentFiles = normalizeSourceSnapshots(proof.files);
  const current = new Map(currentFiles.map((file) => [file.path, file]));
  const allPaths = new Set([...baseline.keys(), ...current.keys()]);
  const actualFiles = [...allPaths]
    .filter((path) => sourceSnapshotChanged(baseline.get(path), current.get(path)))
    .sort();
  if (!actualFiles.length) {
    throw new Error('No source file content changed after the reviewed Apply claim');
  }
  const reportedFiles = [...new Set(run.changedFiles.map(normalizeSourcePath).filter(Boolean))];
  const unprovenReported = reportedFiles.filter((file) => !actualFiles.includes(file));
  const unreportedActual = actualFiles.filter((file) => !reportedFiles.includes(file));
  if (unprovenReported.length || unreportedActual.length) {
    throw new Error(
      `Reported changed files do not match the baseline-relative source delta (unproven: ${unprovenReported.join(', ') || 'none'}; unreported: ${unreportedActual.join(', ') || 'none'})`,
    );
  }
  const sourceGroups = run.reviewedChangeSet ? reviewedSourceGroups(run.reviewedChangeSet) : [];
  const unprovenItems = sourceGroups.filter((group) =>
    group.locations.every((location) => {
      if (!location.line || !actualFiles.includes(location.path)) return true;
      const anchorDelta = lineAnchorChanged(
        baseline.get(location.path),
        current.get(location.path),
        location,
      );
      if (!anchorDelta.changed) return true;
      return (
        proof.scope === 'git' &&
        !(proof.changedRanges ?? []).some((range) =>
          rangeIntersectsAnchor(range, location.path, anchorDelta.startLine, anchorDelta.endLine),
        )
      );
    }),
  );
  if (unprovenItems.length) {
    throw new Error(
      `The source delta does not prove every reviewed item: ${unprovenItems
        .map(
          (group) =>
            `${group.label} (${group.locations.map((location) => `${location.path}${location.line ? `:${location.line}` : ':no-line'}`).join(', ') || 'no mapped source'})`,
        )
        .join('; ')}`,
    );
  }
  return { changedFiles: actualFiles, files: currentFiles };
}

function assertAppliedSourceUnchanged(run: ApplyRun, proof: ApplySourceProof): void {
  if (
    !run.appliedRevision ||
    proof.revision !== run.appliedRevision ||
    proof.scope !== run.sourceProofScope ||
    (proof.scope === 'git' && proof.headRevision !== run.sourceHeadRevision)
  ) {
    throw new Error('Project source changed after the Apply result was acknowledged');
  }
  const applied = normalizeSourceSnapshots(run.appliedSourceFiles);
  const current = new Map(normalizeSourceSnapshots(proof.files).map((file) => [file.path, file]));
  const drifted = applied.filter((file) => sourceSnapshotChanged(file, current.get(file.path)));
  if (drifted.length) {
    throw new Error(
      `Reviewed source files changed after Apply acknowledgement: ${drifted.map((file) => file.path).join(', ')}`,
    );
  }
}

function mergePromotedLedger(
  stored: StoredSession,
  promotedChanges: DesignChange[],
  promotedOperations: DesignOperation[],
  now: string,
): { changes: DesignChange[]; operations: DesignOperation[] } {
  const terminalChanges = stored.changeSet.changes.filter((change) =>
    ['applied', 'rejected'].includes(change.status),
  );
  const appliedByKey = new Map(
    terminalChanges
      .filter((change) => change.status === 'applied')
      .map((change) => [changeKey(change), change]),
  );
  const operationIds = new Map<string, string>();
  const promotedDrafts: DesignChange[] = [];
  for (const change of promotedChanges) {
    const applied = appliedByKey.get(changeKey(change));
    if (applied && isDeepStrictEqual(applied.after, change.after)) continue;
    let nextOperationId: string | undefined;
    if (change.operationId) {
      nextOperationId = operationIds.get(change.operationId);
      if (!nextOperationId) {
        nextOperationId = operationId();
        operationIds.set(change.operationId, nextOperationId);
      }
    }
    promotedDrafts.push({
      ...change,
      id: changeId(),
      operationId: nextOperationId,
      before: applied?.after ?? change.before,
      status: change.status === 'unresolved' ? 'unresolved' : 'draft',
      createdAt: now,
      updatedAt: now,
    });
  }
  const historicalOperationIds = new Set(
    terminalChanges.map((change) => change.operationId).filter((id): id is string => Boolean(id)),
  );
  const operations = [
    ...stored.changeSet.operations.filter((operation) => historicalOperationIds.has(operation.id)),
    ...promotedOperations
      .filter((operation) => operationIds.has(operation.id))
      .map((operation) => ({
        ...operation,
        id: operationIds.get(operation.id)!,
        changeIds: [],
        createdAt: now,
        updatedAt: now,
      })),
  ];
  const changes = coalesceChanges([...terminalChanges, ...promotedDrafts]);
  for (const operation of operations) {
    operation.changeIds = changes
      .filter((change) => change.operationId === operation.id)
      .map((change) => change.id);
  }
  return { changes, operations };
}

export class SessionStore {
  readonly root: string;
  private readonly sessionMutationTails = new Map<string, Promise<void>>();
  private readonly mutationContext = new AsyncLocalStorage<Set<string>>();
  private readonly claimLeaseMs: number;
  private readonly now: () => Date;

  constructor(root = defaultStoreRoot(), options: SessionStoreOptions = {}) {
    this.root = root;
    this.claimLeaseMs = options.claimLeaseMs ?? 45_000;
    this.now = options.now ?? (() => new Date());
  }

  private async serializeSessionMutation<T>(id: string, mutation: () => Promise<T>): Promise<T> {
    const active = this.mutationContext.getStore();
    if (active?.has(id)) return mutation();
    const previous = this.sessionMutationTails.get(id) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(() =>
        withSessionFileLock(join(this.root, `${id}.json`), () =>
          this.mutationContext.run(new Set([...(active ?? []), id]), async () => {
            await this.readUnserialized(id, true);
            return mutation();
          }),
        ),
      );
    const tail = current.then(
      () => undefined,
      () => undefined,
    );
    this.sessionMutationTails.set(id, tail);
    try {
      return await current;
    } finally {
      if (this.sessionMutationTails.get(id) === tail) this.sessionMutationTails.delete(id);
    }
  }

  private serializeChangeMutation<T>(id: string, mutation: () => Promise<T>): Promise<T> {
    return this.serializeSessionMutation(id, mutation);
  }

  private serializeApplyRunMutation<T>(id: string, mutation: () => Promise<T>): Promise<T> {
    return this.serializeSessionMutation(id, mutation);
  }

  private serializeVisualAgentMutation<T>(id: string, mutation: () => Promise<T>): Promise<T> {
    return this.serializeSessionMutation(id, mutation);
  }

  private nowIso(): string {
    return this.now().toISOString();
  }

  private assertNoActiveApplyRun(stored: StoredSession, action: string): void {
    if (stored.applyRuns.some((run) => activeRunStates.has(run.state))) {
      throw new Error(`Finish or stop the active Apply run before ${action}.`);
    }
  }

  private captureBranchRecord(
    stored: StoredSession,
    branch: DesignBranch,
    outcome: 'chosen' | 'rejected',
    now: string,
  ): void {
    const existing = stored.designBranchRecords.find((record) => record.branchId === branch.id);
    const record = createBranchRecord(
      branch,
      outcome,
      stored.changeSet.context,
      stored.designGraph,
      existing?.id ?? branchRecordId(),
      now,
    );
    if (existing) {
      const index = stored.designBranchRecords.indexOf(existing);
      stored.designBranchRecords[index] = {
        ...record,
        importedAt: existing.importedAt,
        createdAt: existing.createdAt,
      };
    } else {
      stored.designBranchRecords.unshift(record);
    }
  }

  private syncDeliveryForRun(stored: StoredSession, run: ApplyRun, now: string): DeliveryRecord {
    const existing = stored.deliveryRecords.find((record) => record.applyRunId === run.id);
    const reviewedChangeSet = run.reviewedChangeSet ?? stored.changeSet;
    const record = existing ?? createDeliveryRecord(reviewedChangeSet, run, now);
    const synced = syncDeliveryRecord(record, run, reviewedChangeSet.context.projectRoot, now);
    if (existing) stored.deliveryRecords[stored.deliveryRecords.indexOf(existing)] = synced;
    else stored.deliveryRecords.unshift(synced);
    return synced;
  }

  private recoverExpiredClaims(stored: StoredSession): boolean {
    const now = this.now();
    const nowIso = now.toISOString();
    let recovered = false;
    for (const run of stored.applyRuns) {
      if (!['claimed', 'applying', 'rebuilding', 'verifying'].includes(run.state)) continue;
      const incompleteLegacyClaim = !run.claimAttemptId || !run.claimExpiresAt;
      const expiredClaim =
        Boolean(run.claimExpiresAt) && Date.parse(run.claimExpiresAt!) <= now.getTime();
      if (!incompleteLegacyClaim && !expiredClaim) continue;
      const interruptedState = run.state;
      run.state = interruptedState === 'claimed' ? 'queued' : 'needs_attention';
      if (
        interruptedState === 'applying' ||
        interruptedState === 'rebuilding' ||
        interruptedState === 'verifying'
      ) {
        run.interruptedState = interruptedState;
        run.error = `The agent disconnected while ${interruptedState}. Reinspect the current source before resuming this run.`;
        run.completedAt = nowIso;
      }
      run.agent = undefined;
      run.claimAttemptId = undefined;
      run.claimCapabilityHash = undefined;
      run.claimExpiresAt = undefined;
      run.claimHeartbeatAt = undefined;
      run.claimedAt = undefined;
      run.changedFiles = [];
      run.validationResults = [];
      run.verificationResults = [];
      run.applyResultAcknowledgedAt = undefined;
      run.applyResultClaimAttemptId = undefined;
      run.sourceProofScope = undefined;
      run.sourceHeadRevision = undefined;
      run.baselineSourceFiles = [];
      run.appliedRevision = undefined;
      run.appliedChangedFiles = [];
      run.appliedSourceFiles = [];
      run.requeueCount += 1;
      run.messages.push({
        state: run.state,
        message:
          interruptedState === 'claimed'
            ? 'The agent did not begin source work. Foundry returned the batch to the queue.'
            : run.error!,
        createdAt: nowIso,
      });
      run.updatedAt = nowIso;
      recovered = true;
    }
    for (const request of stored.visualAgentRequests) {
      if (request.status !== 'thinking' || !request.claimExpiresAt) continue;
      if (Date.parse(request.claimExpiresAt) > now.getTime()) continue;
      request.status = 'needs_attention';
      request.error =
        'The agent disconnected before returning a visual proposal. Review the context, then retry this request.';
      request.agent = undefined;
      request.claimAttemptId = undefined;
      request.claimCapabilityHash = undefined;
      request.claimExpiresAt = undefined;
      request.messages.push({
        id: visualMessageId(),
        role: 'system',
        body: request.error,
        createdAt: nowIso,
      });
      request.updatedAt = nowIso;
      recovered = true;
    }
    if (recovered) stored.changeSet.updatedAt = nowIso;
    return recovered;
  }

  async create(contextInput: SessionContext): Promise<StoredSession> {
    const context = sessionContextSchema.parse(contextInput);
    const now = this.nowIso();
    const stored: StoredSession = {
      token: randomBytes(24).toString('base64url'),
      changeSet: {
        protocolVersion: PROTOCOL_VERSION,
        sessionId: sessionId(),
        context,
        changes: [],
        operations: [],
        screenshots: [],
        createdAt: now,
        updatedAt: now,
      },
      verifications: [],
      applyRuns: [],
      designGraph: null,
      designBranches: [],
      designBranchRecords: [],
      visualAgentRequests: [],
      deliveryRecords: [],
      documentationPages: [],
      designHistory: [],
      deliveryMilestones: [],
    };
    await this.write(stored);
    return stored;
  }

  async list(): Promise<Array<Omit<StoredSession, 'token'>>> {
    await mkdir(this.root, { recursive: true });
    const names = await readdir(this.root);
    const sessions: Array<Omit<StoredSession, 'token'>> = [];
    for (const name of names.filter((entry) => entry.endsWith('.json'))) {
      try {
        const stored = await this.read(name.slice(0, -5));
        sessions.push({
          changeSet: stored.changeSet,
          verifications: stored.verifications,
          applyRuns: stored.applyRuns,
          designGraph: stored.designGraph,
          designBranches: stored.designBranches,
          designBranchRecords: stored.designBranchRecords,
          activeDesignBranchId: stored.activeDesignBranchId,
          visualAgentRequests: stored.visualAgentRequests,
          deliveryRecords: stored.deliveryRecords,
          documentationPages: stored.documentationPages,
          designHistory: stored.designHistory,
          deliveryMilestones: stored.deliveryMilestones,
        });
      } catch {
        // Ignore incomplete files from interrupted development sessions.
      }
    }
    return sessions.sort((a, b) => b.changeSet.updatedAt.localeCompare(a.changeSet.updatedAt));
  }

  async read(id: string): Promise<StoredSession> {
    return this.readUnserialized(id);
  }

  async recoverSession(id: string): Promise<StoredSession> {
    return this.serializeSessionMutation(id, () => this.read(id));
  }

  private async readUnserialized(id: string, persistRepairs = false): Promise<StoredSession> {
    if (!/^ses_[a-f0-9]+$/.test(id)) throw new Error('Invalid session id');
    const raw = JSON.parse(await readFile(join(this.root, `${id}.json`), 'utf8')) as StoredSession;
    const changeSetInput = raw.changeSet as unknown as Record<string, unknown>;
    const storedProtocolVersion = String(changeSetInput.protocolVersion);
    if (['1.0.0', '1.1.0', '1.2.0'].includes(String(changeSetInput.protocolVersion))) {
      changeSetInput.protocolVersion = PROTOCOL_VERSION;
    }
    const changeSet = changeSetSchema.parse(changeSetInput);
    const crossPlatformChange = changeSet.changes.find(
      (change) => change.target.platform !== changeSet.context.platform,
    );
    if (crossPlatformChange) {
      throw new Error(
        `Change ${crossPlatformChange.id} targets ${crossPlatformChange.target.platform}, but the session platform is ${changeSet.context.platform}`,
      );
    }
    const changeById = new Map(changeSet.changes.map((change) => [change.id, change]));
    let migratedLegacyRun = false;
    const applyRuns = (raw.applyRuns ?? []).map((run) => {
      const parsed = applyRunSchema.parse({
        ...run,
        legacyApplyCompatibility:
          run.legacyApplyCompatibility ??
          (storedProtocolVersion !== PROTOCOL_VERSION ? true : undefined),
      });
      if (storedProtocolVersion !== PROTOCOL_VERSION && activeRunStates.has(parsed.state)) {
        const migratedAt = this.nowIso();
        migratedLegacyRun = true;
        return applyRunSchema.parse({
          ...parsed,
          state: 'needs_attention',
          agent: undefined,
          claimAttemptId: undefined,
          claimCapabilityHash: undefined,
          claimExpiresAt: undefined,
          claimHeartbeatAt: undefined,
          claimedAt: undefined,
          applyResultAcknowledgedAt: undefined,
          applyResultClaimAttemptId: undefined,
          sourceProofScope: undefined,
          sourceHeadRevision: undefined,
          verificationResults: [],
          changedFiles: [],
          validationResults: [],
          baselineSourceFiles: [],
          appliedRevision: undefined,
          appliedChangedFiles: [],
          appliedSourceFiles: [],
          error: 'This pre-1.3 Apply run must be reviewed again before new source work can begin.',
          completedAt: migratedAt,
          updatedAt: migratedAt,
          messages: [
            ...parsed.messages,
            {
              state: 'needs_attention',
              message:
                'This pre-1.3 Apply run must be reviewed again before new source work can begin.',
              createdAt: migratedAt,
            },
          ],
        });
      }
      const frozenChangesById = new Map(
        parsed.reviewedChangeSet?.changes.map((change) => [change.id, change]) ?? [],
      );
      return applyRunSchema.parse({
        ...parsed,
        verificationResults: parsed.verificationResults.map((result) => ({
          ...result,
          context:
            result.context ??
            frozenChangesById.get(result.changeId)?.context ??
            changeById.get(result.changeId)?.context,
        })),
      });
    });
    const stored: StoredSession = {
      token: String(raw.token),
      previewCapabilityHash:
        typeof raw.previewCapabilityHash === 'string' &&
        /^[a-f0-9]{64}$/.test(raw.previewCapabilityHash)
          ? raw.previewCapabilityHash
          : undefined,
      changeSet,
      verifications: (raw.verifications ?? []).map((result) => {
        const legacy = verificationResultSchema.parse(result);
        return verificationResultSchema.parse({
          ...legacy,
          context: legacy.context ?? changeById.get(legacy.changeId)?.context,
        });
      }),
      applyRuns,
      designGraph: raw.designGraph ? projectDesignGraphSchema.parse(raw.designGraph) : null,
      designBranches: (raw.designBranches ?? []).map((branch) => designBranchSchema.parse(branch)),
      designBranchRecords: (raw.designBranchRecords ?? []).map((record) =>
        assessBranchRecord(
          designBranchRecordSchema.parse(record),
          changeSet.context,
          raw.designGraph ? projectDesignGraphSchema.parse(raw.designGraph) : null,
          this.nowIso(),
        ),
      ),
      activeDesignBranchId: raw.activeDesignBranchId,
      visualAgentRequests: (raw.visualAgentRequests ?? []).map((request) =>
        visualAgentRequestSchema.parse(request),
      ),
      deliveryRecords: (raw.deliveryRecords ?? []).map((record) =>
        deliveryRecordSchema.parse(record),
      ),
      documentationPages: (raw.documentationPages ?? []).map((page) =>
        documentationPageSchema.parse(page),
      ),
      designHistory: (raw.designHistory ?? []).map((entry) =>
        designHistoryEntrySchema.parse(entry),
      ),
      deliveryMilestones: (raw.deliveryMilestones ?? []).map((milestone) =>
        deliveryMilestoneSchema.parse(milestone),
      ),
    };
    const liveChangeIds = [
      ...stored.changeSet.changes,
      ...stored.designBranches.flatMap((branch) => branch.changes),
    ].map((change) => change.id);
    if (new Set(liveChangeIds).size !== liveChangeIds.length) {
      throw new Error('Design change ids must be globally unique across the live session ledger');
    }
    const liveOperationIds = [
      ...stored.changeSet.operations,
      ...stored.designBranches.flatMap((branch) => branch.operations),
    ].map((operation) => operation.id);
    if (new Set(liveOperationIds).size !== liveOperationIds.length) {
      throw new Error(
        'Design operation ids must be globally unique across the live session ledger',
      );
    }
    const recoveredExpiredClaims = persistRepairs ? this.recoverExpiredClaims(stored) : false;
    if (persistRepairs && (migratedLegacyRun || recoveredExpiredClaims)) {
      await this.write(stored);
    }
    return stored;
  }

  async setPreviewOrigin(id: string, previewOrigin: string): Promise<StoredSession> {
    return this.serializeSessionMutation(id, async () => {
      const stored = await this.read(id);
      const parsed = new URL(previewOrigin);
      if (parsed.origin !== previewOrigin) {
        throw new Error('Preview origin must contain only scheme, host, and port');
      }
      if (stored.changeSet.context.previewOrigin !== previewOrigin) {
        this.assertNoActiveApplyRun(stored, 'changing the preview origin');
      }
      stored.changeSet.context = sessionContextSchema.parse({
        ...stored.changeSet.context,
        previewOrigin,
      });
      stored.changeSet.updatedAt = this.nowIso();
      await this.write(stored);
      return stored;
    });
  }

  async setPreviewCapability(id: string, capability: string): Promise<StoredSession> {
    return this.serializeSessionMutation(id, async () => {
      const stored = await this.read(id);
      if (capability.length < 32) {
        throw new Error('Preview capability must contain at least 32 characters.');
      }
      const nextHash = claimCapabilityHash(capability);
      if (stored.previewCapabilityHash !== nextHash) {
        // Queued batches have no active claimant or browser verification challenge.
        // Let a restarted CLI reconnect them without changing the frozen review.
        // Expired claims are recovered by serializeSessionMutation before this check.
        if (
          stored.applyRuns.some((run) =>
            ['claimed', 'applying', 'rebuilding', 'verifying'].includes(run.state),
          )
        ) {
          throw new Error(
            'Finish or stop the active Apply run before rotating the live preview capability.',
          );
        }
      }
      stored.previewCapabilityHash = nextHash;
      stored.changeSet.updatedAt = this.nowIso();
      await this.write(stored);
      return stored;
    });
  }

  async setDesignGraph(
    id: string,
    graphInput: ProjectDesignGraphInput,
    options: SetDesignGraphOptions = {},
  ): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      this.assertNoActiveApplyRun(stored, 're-indexing the project');
      const currentRevision = stored.changeSet.context.revision ?? null;
      if ('expectedRevision' in options && currentRevision !== options.expectedRevision) {
        throw new Error(
          `Revision conflict: expected ${options.expectedRevision ?? 'unrecorded'}, found ${currentRevision ?? 'unrecorded'}`,
        );
      }
      const currentGraphRevision =
        stored.designGraph?.revision ?? stored.designGraph?.indexedAt ?? undefined;
      if (
        'expectedDesignGraphRevision' in options &&
        (currentGraphRevision ?? null) !== options.expectedDesignGraphRevision
      ) {
        throw new Error(
          `Design graph revision conflict: expected ${options.expectedDesignGraphRevision ?? 'unrecorded'}, found ${currentGraphRevision ?? 'unrecorded'}`,
        );
      }
      const graph = projectDesignGraphSchema.parse(graphInput);
      if (graph.projectRoot !== stored.changeSet.context.projectRoot) {
        throw new Error('Design graph belongs to a different project root');
      }
      stored.designGraph = graph;
      stored.changeSet.designGraphRevision = graph.revision ?? graph.indexedAt;
      stored.changeSet.context.designGraphRevision = stored.changeSet.designGraphRevision;
      stored.designBranchRecords = stored.designBranchRecords.map((record) =>
        assessBranchRecord(record, stored.changeSet.context, graph, this.nowIso()),
      );
      stored.changeSet.updatedAt = this.nowIso();
      await this.write(stored);
      return stored;
    });
  }

  async addOperation(
    id: string,
    input: Omit<DesignOperationInput, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<DesignOperationInput, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      this.assertNoActiveApplyRun(stored, 'changing design operations');
      const now = this.nowIso();
      const operation = designOperationSchema.parse({
        ...input,
        id: input.id ?? operationId(),
        createdAt: input.createdAt ?? now,
        updatedAt: now,
      });
      const allOperations = [
        ...stored.changeSet.operations,
        ...stored.designBranches.flatMap((candidate) => candidate.operations),
      ];
      if (allOperations.some((candidate) => candidate.id === operation.id)) {
        throw new Error(`Design operation id already exists in this session: ${operation.id}`);
      }
      const branch = stored.designBranches.find((item) => item.id === stored.activeDesignBranchId);
      const operations = branch?.operations ?? stored.changeSet.operations;
      operations.push(operation);
      if (branch) branch.updatedAt = now;
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async addOperationWithChange(
    id: string,
    input: {
      operation: Omit<DesignOperationInput, 'id' | 'createdAt' | 'updatedAt' | 'changeIds'> &
        Partial<Pick<DesignOperationInput, 'id' | 'createdAt' | 'updatedAt'>>;
      change: Omit<DesignChangeInput, 'id' | 'createdAt' | 'updatedAt' | 'operationId'> &
        Partial<Pick<DesignChangeInput, 'id' | 'createdAt' | 'updatedAt' | 'operationId'>>;
    },
  ): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      this.assertNoActiveApplyRun(stored, 'recording a design operation');
      const now = this.nowIso();
      const requestedOperationId = input.operation.id ?? input.change.operationId ?? operationId();
      if (
        input.operation.id &&
        input.change.operationId &&
        input.operation.id !== input.change.operationId
      ) {
        throw new Error('The design change must reference the operation recorded with it');
      }
      const parsedChange = designChangeSchema.parse({
        ...input.change,
        id: input.change.id ?? changeId(),
        operationId: requestedOperationId,
        createdAt: input.change.createdAt ?? now,
        updatedAt: now,
      });
      const operation = designOperationSchema.parse({
        ...input.operation,
        id: requestedOperationId,
        changeIds: [parsedChange.id],
        createdAt: input.operation.createdAt ?? now,
        updatedAt: now,
      });
      if (parsedChange.target.platform !== stored.changeSet.context.platform) {
        throw new Error(
          `Change target platform ${parsedChange.target.platform} does not match session platform ${stored.changeSet.context.platform}`,
        );
      }
      if (!operation.targetIds.includes(parsedChange.target.id)) {
        throw new Error('The design operation must include the changed target');
      }
      const allOperations = [
        ...stored.changeSet.operations,
        ...stored.designBranches.flatMap((candidate) => candidate.operations),
      ];
      if (allOperations.some((candidate) => candidate.id === operation.id)) {
        throw new Error(`Design operation id already exists in this session: ${operation.id}`);
      }
      if (
        input.change.id &&
        [
          ...stored.changeSet.changes,
          ...stored.designBranches.flatMap((candidate) => candidate.changes),
        ].some((change) => change.id === input.change.id)
      ) {
        throw new Error(`Design change id already exists in this session: ${input.change.id}`);
      }

      const branch = stored.designBranches.find((item) => item.id === stored.activeDesignBranchId);
      const operations = branch?.operations ?? stored.changeSet.operations;
      operations.push(operation);
      if (branch) {
        branch.changes = coalesceChanges([...branch.changes, parsedChange]);
        branch.updatedAt = now;
      } else {
        stored.changeSet.changes = coalesceChanges([...stored.changeSet.changes, parsedChange]);
      }
      const changes = branch?.changes ?? stored.changeSet.changes;
      for (const candidate of operations) {
        candidate.changeIds = changes
          .filter((change) => change.operationId === candidate.id)
          .map((change) => change.id);
        candidate.updatedAt = now;
      }
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async resolveOperation(
    id: string,
    targetOperationId: string,
    selectedMappingId: string,
  ): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      this.assertNoActiveApplyRun(stored, 'resolving design operations');
      const branch = stored.designBranches.find((item) => item.id === stored.activeDesignBranchId);
      const operations = branch?.operations ?? stored.changeSet.operations;
      const changes = branch?.changes ?? stored.changeSet.changes;
      const operation = operations.find((item) => item.id === targetOperationId);
      if (!operation) throw new Error(`Unknown operation: ${targetOperationId}`);
      const historical =
        changes.some(
          (change) => change.operationId === targetOperationId && change.status === 'applied',
        ) ||
        stored.applyRuns.some(
          (run) =>
            run.state === 'passed' &&
            run.reviewedChangeSet?.operations.some((item) => item.id === targetOperationId),
        );
      if (historical) {
        throw new Error('Verified design operations are immutable. Create a new operation.');
      }
      const mapping = operation.mappingCandidates.find((item) => item.id === selectedMappingId);
      if (!mapping) throw new Error(`Unknown source mapping: ${selectedMappingId}`);
      const now = this.nowIso();
      operation.selectedMappingId = selectedMappingId;
      operation.status = 'resolved';
      operation.updatedAt = now;
      for (const change of changes) {
        if (change.operationId !== operation.id) continue;
        change.selectedMappingId = selectedMappingId;
        change.confidence = mapping.confidence;
        change.status = change.status === 'unresolved' ? 'draft' : change.status;
        change.updatedAt = now;
      }
      if (branch) branch.updatedAt = now;
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async addChange(
    id: string,
    input: Omit<DesignChangeInput, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<DesignChangeInput, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      this.assertNoActiveApplyRun(stored, 'editing the change ledger');
      if (
        input.id &&
        [
          ...stored.changeSet.changes,
          ...stored.designBranches.flatMap((candidate) => candidate.changes),
        ].some((change) => change.id === input.id)
      ) {
        throw new Error(`Design change id already exists in this session: ${input.id}`);
      }
      const now = new Date().toISOString();
      const parsed = designChangeSchema.parse({
        ...input,
        id: input.id ?? changeId(),
        createdAt: input.createdAt ?? now,
        updatedAt: now,
      });
      if (parsed.target.platform !== stored.changeSet.context.platform) {
        throw new Error(
          `Change target platform ${parsed.target.platform} does not match session platform ${stored.changeSet.context.platform}`,
        );
      }
      const branch = stored.designBranches.find((item) => item.id === stored.activeDesignBranchId);
      const operations = branch?.operations ?? stored.changeSet.operations;
      if (
        parsed.operationId &&
        !operations.some((operation) => operation.id === parsed.operationId)
      ) {
        throw new Error(`Unknown operation for design change: ${parsed.operationId}`);
      }
      if (branch) {
        branch.changes = coalesceChanges([...branch.changes, parsed]);
        branch.updatedAt = now;
      } else {
        stored.changeSet.changes = coalesceChanges([...stored.changeSet.changes, parsed]);
      }
      const changes = branch?.changes ?? stored.changeSet.changes;
      for (const operation of operations) {
        operation.changeIds = changes
          .filter((change) => change.operationId === operation.id)
          .map((change) => change.id);
        operation.updatedAt = now;
      }
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async createDesignBranch(
    id: string,
    input: { name: string; sourceBranchId?: string },
  ): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      if (stored.designBranches.filter((branch) => branch.status !== 'archived').length >= 8) {
        throw new Error('Archive a direction before creating another one.');
      }
      const source = input.sourceBranchId
        ? stored.designBranches.find((branch) => branch.id === input.sourceBranchId)
        : undefined;
      if (input.sourceBranchId && !source) {
        throw new Error(`Unknown design branch: ${input.sourceBranchId}`);
      }
      const now = this.nowIso();
      const operationIds = new Map<string, string>();
      const operations: DesignOperation[] = (source?.operations ?? stored.changeSet.operations).map(
        (operation) => {
          const nextId = operationId();
          operationIds.set(operation.id, nextId);
          return { ...operation, id: nextId, changeIds: [], createdAt: now, updatedAt: now };
        },
      );
      const changes = (source?.changes ?? stored.changeSet.changes).map((change) => ({
        ...change,
        id: changeId(),
        operationId: change.operationId ? operationIds.get(change.operationId) : undefined,
        status: change.status === 'unresolved' ? ('unresolved' as const) : ('draft' as const),
        createdAt: now,
        updatedAt: now,
      }));
      for (const operation of operations) {
        operation.changeIds = changes
          .filter((change) => change.operationId === operation.id)
          .map((change) => change.id);
      }
      const branch = designBranchSchema.parse({
        id: branchId(),
        name: input.name.trim(),
        status: 'exploring',
        originBranchId: source?.id,
        changes,
        operations,
        createdAt: now,
        updatedAt: now,
      });
      stored.designBranches.push(branch);
      stored.activeDesignBranchId = branch.id;
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async activateDesignBranch(id: string, targetBranchId?: string): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      if (
        targetBranchId &&
        !stored.designBranches.some(
          (branch) => branch.id === targetBranchId && branch.status !== 'archived',
        )
      ) {
        throw new Error(`Unknown design branch: ${targetBranchId}`);
      }
      stored.activeDesignBranchId = targetBranchId;
      // A proposal is only "Previewing" while its direction is active.
      // Leaving the preview keeps the proposal, without promoting or rejecting it.
      for (const request of stored.visualAgentRequests) {
        for (const proposal of request.proposals) {
          if (proposal.status === 'previewing' && proposal.branchId !== targetBranchId) {
            proposal.status = 'proposed';
            proposal.updatedAt = this.nowIso();
            request.updatedAt = proposal.updatedAt;
          }
        }
      }
      stored.changeSet.updatedAt = this.nowIso();
      await this.write(stored);
      return stored;
    });
  }

  async composeDesignBranch(
    id: string,
    input: { name: string; selections: Array<{ branchId: string; changeIds: string[] }> },
  ): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      const now = this.nowIso();
      const selected: DesignChange[] = [];
      for (const selection of input.selections) {
        const branch = stored.designBranches.find((item) => item.id === selection.branchId);
        if (!branch) throw new Error(`Unknown design branch: ${selection.branchId}`);
        for (const selectedId of selection.changeIds) {
          const change = branch.changes.find((item) => item.id === selectedId);
          if (!change) throw new Error(`Unknown branch change: ${selectedId}`);
          selected.push({
            ...change,
            id: changeId(),
            operationId: undefined,
            status: change.status === 'unresolved' ? 'unresolved' : 'draft',
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      if (!selected.length) throw new Error('Select at least one decision to combine.');
      const branch = designBranchSchema.parse({
        id: branchId(),
        name: input.name.trim(),
        status: 'exploring',
        changes: coalesceChanges(selected),
        operations: [],
        createdAt: now,
        updatedAt: now,
      });
      stored.designBranches.push(branch);
      stored.activeDesignBranchId = branch.id;
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async updateDesignBranch(
    id: string,
    targetBranchId: string,
    input: { name?: string; status?: DesignBranch['status']; rejectionReason?: string },
  ): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      const branch = stored.designBranches.find((item) => item.id === targetBranchId);
      if (!branch) throw new Error(`Unknown design branch: ${targetBranchId}`);
      if (input.name !== undefined) branch.name = input.name.trim();
      if (input.status !== undefined) branch.status = input.status;
      if (input.rejectionReason !== undefined) {
        branch.rejectionReason = input.rejectionReason.trim() || undefined;
      }
      branch.updatedAt = this.nowIso();
      if (branch.status === 'archived' && stored.activeDesignBranchId === branch.id) {
        stored.activeDesignBranchId = undefined;
      }
      if (branch.status === 'rejected') {
        this.captureBranchRecord(stored, branch, 'rejected', branch.updatedAt);
      }
      stored.changeSet.updatedAt = branch.updatedAt;
      await this.write(stored);
      return stored;
    });
  }

  async promoteDesignBranch(id: string, targetBranchId: string): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      if (stored.applyRuns.some((run) => activeRunStates.has(run.state))) {
        throw new Error('Finish or stop the active Apply run before choosing another direction.');
      }
      const branch = stored.designBranches.find((item) => item.id === targetBranchId);
      if (!branch) throw new Error(`Unknown design branch: ${targetBranchId}`);
      const reviewable = branch.changes.filter(
        (change) => !['applied', 'rejected'].includes(change.status),
      );
      if (!reviewable.length) {
        throw new Error(
          'No saved changes in this direction. Save an edit before moving it to Review.',
        );
      }
      const now = this.nowIso();
      const merged = mergePromotedLedger(stored, reviewable, branch.operations, now);
      if (!merged.changes.some((change) => !['applied', 'rejected'].includes(change.status))) {
        throw new Error('This direction has no new changes to move to Review.');
      }
      stored.changeSet.changes = merged.changes;
      stored.changeSet.operations = merged.operations;
      for (const item of stored.designBranches) {
        if (item.id === branch.id) item.status = 'chosen';
        else if (item.status === 'chosen') item.status = 'exploring';
      }
      branch.updatedAt = now;
      this.captureBranchRecord(stored, branch, 'chosen', now);
      stored.activeDesignBranchId = undefined;
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async importDesignBranchRecords(
    id: string,
    input: DesignBranchRecordBundle | unknown,
  ): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      const bundle = designBranchRecordBundleSchema.parse(input);
      const now = this.nowIso();
      for (const imported of bundle.records) {
        const record = assessBranchRecord(
          { ...imported, importedAt: now },
          stored.changeSet.context,
          stored.designGraph,
          now,
        );
        const existing = stored.designBranchRecords.findIndex((item) => item.id === record.id);
        if (existing >= 0) stored.designBranchRecords[existing] = record;
        else stored.designBranchRecords.push(record);
      }
      stored.designBranchRecords = stored.designBranchRecords
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 100);
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async restoreDesignBranchRecord(id: string, recordId: string): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      if (stored.designBranches.filter((branch) => branch.status !== 'archived').length >= 8) {
        throw new Error('Archive a direction before restoring another one.');
      }
      const record = stored.designBranchRecords.find((item) => item.id === recordId);
      if (!record) throw new Error(`Unknown branch record: ${recordId}`);
      const checked = assessBranchRecord(
        record,
        stored.changeSet.context,
        stored.designGraph,
        this.nowIso(),
      );
      if (checked.compatibility.status !== 'current') {
        throw new Error(
          'Refresh or repair stale source relationships before restoring this record.',
        );
      }
      const now = this.nowIso();
      const operationIds = new Map<string, string>();
      const operations: DesignOperation[] = checked.operations.map((operation) => {
        const nextId = operationId();
        operationIds.set(operation.id, nextId);
        return {
          ...operation,
          id: nextId,
          changeIds: [],
          status: 'preview' as const,
          createdAt: now,
          updatedAt: now,
        };
      });
      const changes = checked.changes.map((change) => ({
        ...change,
        id: changeId(),
        operationId: change.operationId ? operationIds.get(change.operationId) : undefined,
        status: change.status === 'unresolved' ? ('unresolved' as const) : ('draft' as const),
        createdAt: now,
        updatedAt: now,
      }));
      for (const operation of operations) {
        operation.changeIds = changes
          .filter((change) => change.operationId === operation.id)
          .map((change) => change.id);
      }
      const branch = designBranchSchema.parse({
        id: branchId(),
        name: `${checked.name} (restored)`.slice(0, 80),
        status: 'exploring',
        changes,
        operations,
        rejectionReason: checked.rationale,
        createdAt: now,
        updatedAt: now,
      });
      stored.designBranches.push(branch);
      stored.activeDesignBranchId = branch.id;
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async removeDesignBranchRecord(id: string, recordId: string): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      const before = stored.designBranchRecords.length;
      stored.designBranchRecords = stored.designBranchRecords.filter(
        (item) => item.id !== recordId,
      );
      if (stored.designBranchRecords.length === before) {
        throw new Error(`Unknown branch record: ${recordId}`);
      }
      stored.changeSet.updatedAt = this.nowIso();
      await this.write(stored);
      return stored;
    });
  }

  async setChangeStatus(
    id: string,
    targetChangeId: string,
    status: DesignChange['status'],
    sourceProof?: ApplySourceProof,
  ): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      if (status === 'applied') {
        const current = stored.changeSet.changes.find((change) => change.id === targetChangeId);
        const matchingRuns = stored.applyRuns.filter((run) => {
          if (
            !['rebuilding', 'verifying'].includes(run.state) ||
            !run.claimAttemptId ||
            !run.reviewedChangeSet
          ) {
            return false;
          }
          if (!run.legacyApplyCompatibility) return false;
          if (run.reviewedChangeSet.changes.length !== 1) return false;
          const frozen = run.reviewedChangeSet.changes.find(
            (change) => change.id === targetChangeId,
          );
          return Boolean(current && frozen && changeMatchesFrozenContract(current, frozen));
        });
        if (matchingRuns.length !== 1) {
          throw new Error(
            'Legacy applied status requires exactly one active verifying run with a matching frozen change contract.',
          );
        }
        const run = matchingRuns[0]!;
        if (run.applyResultAcknowledgedAt) {
          throw new Error('This Apply claim already acknowledged its source result.');
        }
        if (
          !run.changedFiles.length ||
          !run.validationResults.length ||
          run.validationResults.some((validation) => !validation.passed)
        ) {
          throw new Error('Apply acknowledgement requires changed files and passing validation.');
        }
        if (!sourceProof)
          throw new Error('Legacy Apply acknowledgement requires live source proof');
        const applied = assertSourceProof(run, sourceProof);
        const now = this.nowIso();
        run.applyResultAcknowledgedAt = now;
        run.applyResultClaimAttemptId = run.claimAttemptId;
        run.appliedRevision = sourceProof.revision;
        run.appliedChangedFiles = applied.changedFiles;
        run.appliedSourceFiles = applied.files;
        run.updatedAt = now;
        await this.write(stored);
        return stored;
      }
      this.assertNoActiveApplyRun(stored, 'changing reviewed change status');
      const branch = stored.designBranches.find((item) => item.id === stored.activeDesignBranchId);
      const target = (branch?.changes ?? stored.changeSet.changes).find(
        (change) => change.id === targetChangeId,
      );
      if (!target) throw new Error(`Unknown change: ${targetChangeId}`);
      if (target.status === 'applied') {
        throw new Error('Applied changes are immutable. Stage a new change to reverse them.');
      }
      target.status = status;
      target.updatedAt = this.nowIso();
      if (branch) branch.updatedAt = target.updatedAt;
      stored.changeSet.updatedAt = target.updatedAt;
      await this.write(stored);
      return stored;
    });
  }

  async recordApplyResult(
    id: string,
    runId: string,
    claimAttemptId: string,
    changeIds: string[],
    sourceProof: ApplySourceProof,
    claimCapability?: string,
  ): Promise<StoredSession> {
    return this.serializeApplyRunMutation(id, async () => {
      const stored = await this.read(id);
      const run = stored.applyRuns.find((candidate) => candidate.id === runId);
      if (!run) throw new Error(`Unknown apply run: ${runId}`);
      if (['passed', 'cancelled', 'failed', 'needs_attention'].includes(run.state)) {
        throw new Error('Completed Apply runs are immutable. Use Retry or Resume for new work.');
      }
      if (run.state !== 'rebuilding') {
        throw new Error(
          'Apply results can only be acknowledged after rebuilding and before verification.',
        );
      }
      assertClaimAuthority(run, claimAttemptId, claimCapability);
      if (!run.reviewedChangeSet) {
        throw new Error('Apply run has no frozen reviewed change contract. Re-review the changes.');
      }
      if (run.applyResultAcknowledgedAt) {
        throw new Error('This Apply claim already acknowledged its source result.');
      }
      if (
        !run.changedFiles.length ||
        !run.validationResults.length ||
        run.validationResults.some((validation) => !validation.passed)
      ) {
        throw new Error('Apply acknowledgement requires changed files and passing validation.');
      }
      if (!changeIdsExactlyMatch(changeIds, run.reviewedChangeSet)) {
        throw new Error(
          'Apply result change ids must exactly match the frozen reviewed change set.',
        );
      }
      if (!currentLedgerMatchesReviewedContract(stored.changeSet, run.reviewedChangeSet)) {
        throw new Error('Current changes no longer match the frozen reviewed contract.');
      }
      const applied = assertSourceProof(run, sourceProof);
      const nowDate = this.now();
      const claimedAt = run.claimedAt ? Date.parse(run.claimedAt) : Number.NaN;
      for (const validation of run.validationResults) {
        if (validation.applyRunId !== run.id || validation.claimAttemptId !== run.claimAttemptId) {
          throw new Error('Validation evidence must name the active Apply run and claim attempt.');
        }
        if (validation.validatedRevision !== sourceProof.revision) {
          throw new Error(
            'Validation evidence must be measured against the acknowledged source revision.',
          );
        }
        const validatedAt = validation.validatedAt
          ? Date.parse(validation.validatedAt)
          : Number.NaN;
        if (
          !Number.isFinite(claimedAt) ||
          !Number.isFinite(validatedAt) ||
          validatedAt < claimedAt
        ) {
          throw new Error('Validation evidence must be recorded after the active claim begins.');
        }
        if (validatedAt > nowDate.getTime() + 30_000) {
          throw new Error('Validation evidence timestamp is implausibly far in the future.');
        }
      }
      const now = nowDate.toISOString();
      run.applyResultAcknowledgedAt = now;
      run.applyResultClaimAttemptId = claimAttemptId;
      run.appliedRevision = sourceProof.revision;
      run.appliedChangedFiles = applied.changedFiles;
      run.appliedSourceFiles = applied.files;
      run.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async recordLegacyApplyResult(
    id: string,
    changeIds: string[],
    sourceProof: ApplySourceProof,
  ): Promise<{
    stored: StoredSession;
    runId: string;
    claimAttemptId: string;
  }> {
    return this.serializeApplyRunMutation(id, async () => {
      const stored = await this.read(id);
      const contractMatches = (run: ApplyRun) =>
        ['rebuilding', 'verifying'].includes(run.state) &&
        Boolean(run.claimAttemptId) &&
        Boolean(run.reviewedChangeSet) &&
        changeIdsExactlyMatch(changeIds, run.reviewedChangeSet!) &&
        currentLedgerMatchesReviewedContract(stored.changeSet, run.reviewedChangeSet!);
      if (stored.applyRuns.some((run) => contractMatches(run) && !run.legacyApplyCompatibility)) {
        throw new Error(
          'Legacy apply acknowledgement is available only to runs created before protocol 1.3. Pass runId and claimAttemptId.',
        );
      }
      const matchingRuns = stored.applyRuns.filter(
        (run) => run.legacyApplyCompatibility === true && contractMatches(run),
      );
      if (matchingRuns.length === 0) {
        throw new Error(
          'Legacy apply result did not match an active verifying run. Pass runId and claimAttemptId.',
        );
      }
      if (matchingRuns.length > 1) {
        throw new Error(
          'Legacy apply result is ambiguous. Pass runId and claimAttemptId for the intended run.',
        );
      }
      const run = matchingRuns[0]!;
      if (run.applyResultAcknowledgedAt) {
        throw new Error('This Apply claim already acknowledged its source result.');
      }
      if (
        !run.changedFiles.length ||
        !run.validationResults.length ||
        run.validationResults.some((validation) => !validation.passed)
      ) {
        throw new Error('Apply acknowledgement requires changed files and passing validation.');
      }
      const applied = assertSourceProof(run, sourceProof);
      const now = this.nowIso();
      run.applyResultAcknowledgedAt = now;
      run.applyResultClaimAttemptId = run.claimAttemptId;
      run.appliedRevision = sourceProof.revision;
      run.appliedChangedFiles = applied.changedFiles;
      run.appliedSourceFiles = applied.files;
      run.updatedAt = now;
      await this.write(stored);
      return {
        stored,
        runId: run.id,
        claimAttemptId: run.claimAttemptId!,
      };
    });
  }

  async deleteChange(
    id: string,
    targetChangeId: string,
  ): Promise<{ stored: StoredSession; removedChange: DesignChange }> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      this.assertNoActiveApplyRun(stored, 'deleting reviewed changes');
      const branch = stored.designBranches.find((item) => item.id === stored.activeDesignBranchId);
      const changes = branch?.changes ?? stored.changeSet.changes;
      let operations = branch?.operations ?? stored.changeSet.operations;
      const targetIndex = changes.findIndex((change) => change.id === targetChangeId);
      if (targetIndex < 0) throw new Error(`Unknown change: ${targetChangeId}`);
      const target = changes[targetIndex]!;
      if (target.status === 'applied') {
        throw new Error('Applied changes cannot be deleted from review.');
      }
      if (stored.applyRuns.some((run) => run.changeIds.includes(targetChangeId))) {
        throw new Error('Changes attached to an apply run cannot be deleted.');
      }

      changes.splice(targetIndex, 1);
      if (target.operationId) {
        const operationStillUsed = changes.some(
          (change) => change.operationId === target.operationId,
        );
        if (!operationStillUsed) {
          operations = operations.filter((operation) => operation.id !== target.operationId);
        } else {
          operations = operations.map((operation) =>
            operation.id === target.operationId
              ? {
                  ...operation,
                  changeIds: operation.changeIds.filter((changeId) => changeId !== targetChangeId),
                }
              : operation,
          );
        }
        if (branch) branch.operations = operations;
        else stored.changeSet.operations = operations;
      }
      stored.verifications = stored.verifications.filter(
        (verification) => verification.changeId !== targetChangeId,
      );
      stored.changeSet.updatedAt = this.nowIso();
      if (branch) branch.updatedAt = stored.changeSet.updatedAt;
      await this.write(stored);
      return { stored, removedChange: target };
    });
  }

  async createApplyRun(
    id: string,
    input: {
      reviews: Array<{
        changeId: string;
        approved: boolean;
        after?: DesignChange['after'];
      }>;
      revision?: string | null;
      designGraphRevision?: string | null;
      retryOf?: string;
      baselineScreenshots?: ChangeSet['screenshots'];
      captureIssues?: string[];
    },
  ): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      if (stored.applyRuns.some((run) => activeRunStates.has(run.state))) {
        throw new Error('An apply run is already active for this session');
      }
      const reviewIds = input.reviews.map((review) => review.changeId);
      if (new Set(reviewIds).size !== reviewIds.length) {
        throw new Error('Each reviewed change may appear only once in an Apply request');
      }
      const now = this.nowIso();
      const retrySource = input.retryOf
        ? stored.applyRuns.find((run) => run.id === input.retryOf)
        : undefined;
      if (input.retryOf && !retrySource) throw new Error(`Unknown apply run: ${input.retryOf}`);
      if (retrySource && !['needs_attention', 'failed'].includes(retrySource.state)) {
        throw new Error('Only failed runs or runs needing attention can be retried');
      }

      let approvedIds: string[];
      let reviewedChangeSet: ChangeSet;
      if (retrySource) {
        if (!retrySource.reviewedChangeSet) {
          throw new Error(
            'The original reviewed contract is unavailable. Review the changes again.',
          );
        }
        approvedIds = [...retrySource.changeIds];
        const approvedReviewIds = input.reviews
          .filter((review) => review.approved)
          .map((review) => review.changeId);
        if (
          approvedReviewIds.length !== approvedIds.length ||
          approvedIds.some((changeId) => !approvedReviewIds.includes(changeId))
        ) {
          throw new Error('A retry must preserve the exact original reviewed change set');
        }
        for (const review of input.reviews) {
          const frozen = retrySource.reviewedChangeSet.changes.find(
            (change) => change.id === review.changeId,
          );
          if (
            review.after !== undefined &&
            frozen &&
            !isDeepStrictEqual(review.after, frozen.after)
          ) {
            throw new Error('A retry cannot change the original reviewed value');
          }
        }
        reviewedChangeSet = changeSetSchema.parse(retrySource.reviewedChangeSet);
      } else {
        const selectedIds: string[] = [];
        for (const review of input.reviews) {
          const change = stored.changeSet.changes.find(
            (candidate) => candidate.id === review.changeId,
          );
          if (!change) throw new Error(`Unknown change: ${review.changeId}`);
          if (change.status === 'applied') {
            throw new Error(`Applied changes cannot enter a new Apply review: ${change.id}`);
          }
          const priorRun = review.approved
            ? stored.applyRuns.find((run) => run.changeIds.includes(change.id))
            : undefined;
          if (priorRun) {
            throw new Error(
              `Change ${change.id} already belongs to Apply run ${priorRun.id}. Retry that run or create a new draft change.`,
            );
          }
          if (review.after !== undefined) change.after = review.after;
          if (review.approved && change.confidence === 'unresolved') {
            throw new Error(`Unresolved change cannot be applied: ${change.id}`);
          }
          if (review.approved && change.mappingCandidates.length > 1 && !change.selectedMappingId) {
            throw new Error(`Ambiguous change requires a selected source mapping: ${change.id}`);
          }
          const operation = change.operationId
            ? stored.changeSet.operations.find((item) => item.id === change.operationId)
            : undefined;
          if (review.approved && change.operationId && !operation) {
            throw new Error(`Missing operation for reviewed change: ${change.operationId}`);
          }
          if (review.approved && operation?.status === 'unresolved') {
            throw new Error(`Unresolved operation cannot be applied: ${operation.id}`);
          }
          change.status = review.approved ? 'approved' : 'rejected';
          change.updatedAt = now;
          if (review.approved) selectedIds.push(change.id);
        }
        approvedIds = [...new Set(selectedIds)];
        if (!approvedIds.length) throw new Error('Select at least one resolved change to apply');
        const frozen = freezeReviewedChangeSet(stored.changeSet, approvedIds, now);
        if (!frozen) throw new Error('Could not freeze the complete reviewed change set');
        reviewedChangeSet = frozen;
      }
      if (
        reviewedChangeSet.changes.some(
          (change) => change.target.platform !== stored.changeSet.context.platform,
        )
      ) {
        throw new Error('Every reviewed change must target the active session platform');
      }
      const unstableWebTarget = reviewedChangeSet.changes.find(
        (change) =>
          change.target.platform === 'web' &&
          typeof change.target.locator.foundryId !== 'string' &&
          (!change.target.source?.file || !change.target.source.line),
      );
      if (unstableWebTarget) {
        throw new Error(
          `Web target ${unstableWebTarget.target.id} has no stable explicit id or exact source identity and cannot enter Apply.`,
        );
      }

      const run = applyRunSchema.parse({
        id: applyRunId(),
        sessionId: id,
        changeIds: approvedIds,
        reviewedChangeSet,
        revision:
          'revision' in input ? (input.revision ?? undefined) : stored.changeSet.context.revision,
        designGraphRevision:
          'designGraphRevision' in input
            ? (input.designGraphRevision ?? undefined)
            : (retrySource?.designGraphRevision ?? stored.changeSet.designGraphRevision),
        state: 'queued',
        messages: [
          {
            state: 'queued',
            message: 'Waiting for the active agent.',
            createdAt: now,
          },
        ],
        changedFiles: [],
        validationResults: [],
        verificationResults: [],
        attempts: (retrySource?.attempts ?? 0) + 1,
        retryOf: retrySource?.id,
        requestedAt: now,
        updatedAt: now,
      });
      if (!retrySource && input.baselineScreenshots?.length) {
        const screenshots = deliveryRecordSchema.shape.evidence.parse(input.baselineScreenshots);
        for (const screenshot of screenshots) {
          const capture = screenshot.capture;
          if (
            !capture ||
            capture.phase !== 'before' ||
            capture.sourceRevision !== run.revision ||
            !capture.sha256 ||
            !capture.conditions ||
            !run.reviewedChangeSet!.changes.some(
              (change) =>
                change.target.id === capture.targetId &&
                expandedChangeContexts(change).some(
                  (context) => contextKey(context) === contextKey(capture.context),
                ),
            )
          )
            throw new Error(
              'Baseline screenshot does not match the reviewed source, target and context.',
            );
          capture.applyRunId = run.id;
        }
        run.reviewedChangeSet!.screenshots.push(...screenshots);
      }
      stored.applyRuns.push(run);
      const delivery = this.syncDeliveryForRun(stored, run, now);
      delivery.captureIssues = [...new Set(input.captureIssues ?? [])];
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  /** Trusted CLI capture evidence only; no route accepts screenshot paths from clients. */
  async attachDeliveryCapture(
    id: string,
    runId: string,
    input: { screenshots: ChangeSet['screenshots']; unavailable: string[] },
  ): Promise<StoredSession> {
    return this.serializeApplyRunMutation(id, async () => {
      const stored = await this.read(id);
      const run = stored.applyRuns.find((candidate) => candidate.id === runId);
      const record = stored.deliveryRecords.find((candidate) => candidate.applyRunId === runId);
      if (!run?.reviewedChangeSet || run.state !== 'passed' || !record || !run.appliedRevision)
        throw new Error('Rebuilt visual evidence requires a completed verified Apply run.');
      const screenshots = deliveryRecordSchema.shape.evidence.parse(input.screenshots);
      for (const screenshot of screenshots) {
        const capture = screenshot.capture;
        if (
          !capture ||
          capture.phase !== 'rebuilt' ||
          capture.applyRunId !== run.id ||
          capture.sourceRevision !== run.appliedRevision ||
          !capture.sha256 ||
          !capture.conditions ||
          !run.reviewedChangeSet.changes.some(
            (change) =>
              change.target.id === capture.targetId &&
              expandedChangeContexts(change).some(
                (context) => contextKey(context) === contextKey(capture.context),
              ),
          )
        )
          throw new Error(
            'Rebuilt screenshot does not match the verified source, target and context.',
          );
        if (!record.evidence.some((existing) => existing.path === screenshot.path))
          record.evidence.push(screenshot);
      }
      record.captureIssues = [...new Set([...record.captureIssues, ...input.unavailable])];
      record.updatedAt = this.nowIso();
      await this.write(stored);
      return stored;
    });
  }

  async claimApplyRun(
    id: string,
    runId: string,
    input: {
      agent: ApplyRun['agent'];
      revision: string | null;
      designGraphRevision: string | null;
      sourceProof: ApplySourceProof;
      claimCapability?: string;
    },
  ): Promise<StoredSession> {
    return this.serializeApplyRunMutation(id, async () => {
      const stored = await this.read(id);
      const run = stored.applyRuns.find((candidate) => candidate.id === runId);
      if (!run) throw new Error(`Unknown apply run: ${runId}`);
      if (run.state !== 'queued') {
        throw new Error('Apply run is no longer queued and cannot be claimed again.');
      }
      const now = this.nowIso();
      const contractUnavailable = !run.reviewedChangeSet;
      const expectedRevision = run.revision ?? null;
      const expectedDesignGraphRevision = run.designGraphRevision ?? null;
      const sourceChanged = expectedRevision !== input.revision;
      const graphChanged = expectedDesignGraphRevision !== input.designGraphRevision;
      if (contractUnavailable || sourceChanged || graphChanged) {
        run.state = 'needs_attention';
        run.error = contractUnavailable
          ? 'The original reviewed contract is unavailable. Review the changes again before applying.'
          : sourceChanged
            ? `Project revision changed from ${expectedRevision ?? 'unrecorded'} to ${input.revision ?? 'unrecorded'}. Review the batch before retrying.`
            : `Project design graph changed from ${expectedDesignGraphRevision ?? 'unrecorded'} to ${input.designGraphRevision ?? 'unrecorded'}. Review the semantic mappings before retrying.`;
        run.messages.push({
          state: run.state,
          message: run.error,
          createdAt: now,
        });
        run.completedAt = now;
      } else {
        const baselineSourceFiles = normalizeSourceSnapshots(input.sourceProof.files);
        const unmappedItems = reviewedSourceGroups(run.reviewedChangeSet!).filter(
          (group) => group.locations.length === 0 || group.locations.every((item) => !item.line),
        );
        if (unmappedItems.length) {
          throw new Error(
            `Every reviewed item requires a source mapping before Apply: ${unmappedItems
              .map((group) => group.label)
              .join(', ')}`,
          );
        }
        const reviewedPaths = reviewedSourceFiles(run.reviewedChangeSet!);
        const capturedPaths = new Set(baselineSourceFiles.map((file) => file.path));
        const missingPaths = reviewedPaths.filter((path) => !capturedPaths.has(path));
        if (missingPaths.length) {
          throw new Error(
            `Live source proof did not capture reviewed source paths: ${missingPaths.join(', ')}`,
          );
        }
        const baselineByPath = new Map(baselineSourceFiles.map((file) => [file.path, file]));
        const missingAnchors = reviewedSourceLocations(run.reviewedChangeSet!).filter(
          (location) =>
            !location.line ||
            !baselineByPath
              .get(location.path)
              ?.lineAnchors?.some(
                (anchor) =>
                  anchor.line === location.line &&
                  (!location.symbol || anchor.symbol === location.symbol),
              ),
        );
        if (missingAnchors.length) {
          throw new Error(
            `Live source proof did not capture exact reviewed source lines: ${missingAnchors
              .map((location) => `${location.path}:${location.line ?? 'no-line'}`)
              .join(', ')}`,
          );
        }
        if (input.sourceProof.revision !== input.revision) {
          throw new Error('Claim source proof revision does not match the authoritative revision');
        }
        run.state = 'claimed';
        run.agent = input.agent;
        run.claimAttemptId = `claim_${randomUUID().replaceAll('-', '')}`;
        run.claimCapabilityHash = input.claimCapability
          ? claimCapabilityHash(input.claimCapability)
          : undefined;
        run.claimedAt = now;
        run.claimHeartbeatAt = now;
        run.claimExpiresAt = new Date(this.now().getTime() + this.claimLeaseMs).toISOString();
        run.applyResultAcknowledgedAt = undefined;
        run.applyResultClaimAttemptId = undefined;
        run.sourceProofScope = input.sourceProof.scope;
        run.sourceHeadRevision = input.sourceProof.headRevision;
        run.baselineSourceFiles = baselineSourceFiles;
        run.appliedRevision = undefined;
        run.appliedChangedFiles = [];
        run.appliedSourceFiles = [];
        run.changedFiles = [];
        run.validationResults = [];
        run.verificationResults = [];
        if (run.interruptedState) run.resumedAt = now;
        run.completedAt = undefined;
        run.error = undefined;
        run.messages.push({
          state: run.state,
          message: run.interruptedState
            ? `${input.agent?.name ?? 'Agent'} received the resumed ${run.interruptedState} run. Reinspect source before continuing.`
            : `${input.agent?.name ?? 'Agent'} received the reviewed batch. Waiting for source work to begin.`,
          createdAt: now,
        });
      }
      run.updatedAt = now;
      this.syncDeliveryForRun(stored, run, now);
      await this.write(stored);
      return stored;
    });
  }

  async heartbeatApplyRun(
    id: string,
    runId: string,
    claimAttemptId: string,
    claimCapability?: string,
  ): Promise<StoredSession> {
    return this.serializeApplyRunMutation(id, async () => {
      const stored = await this.read(id);
      const run = stored.applyRuns.find((candidate) => candidate.id === runId);
      if (!run) throw new Error(`Unknown apply run: ${runId}`);
      if (!['claimed', 'applying', 'rebuilding', 'verifying'].includes(run.state)) {
        throw new Error('Apply run does not have an active agent lease');
      }
      assertClaimAuthority(run, claimAttemptId, claimCapability);
      const now = this.nowIso();
      run.claimHeartbeatAt = now;
      run.claimExpiresAt = new Date(this.now().getTime() + this.claimLeaseMs).toISOString();
      run.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async updateApplyRun(
    id: string,
    runId: string,
    input: {
      state?: ApplyRunState;
      message?: string;
      changedFiles?: string[];
      validationResults?: ApplyRun['validationResults'];
      error?: string;
      claimAttemptId?: string;
      claimCapability?: string;
    },
    validationSourceProof?: ApplySourceProof,
  ): Promise<StoredSession> {
    return this.serializeApplyRunMutation(id, async () => {
      const stored = await this.read(id);
      const run = stored.applyRuns.find((candidate) => candidate.id === runId);
      if (!run) throw new Error(`Unknown apply run: ${runId}`);
      if (['passed', 'cancelled', 'failed', 'needs_attention'].includes(run.state)) {
        throw new Error('Completed Apply runs are immutable. Use Retry or Resume for new work.');
      }
      const mutatesClaimEvidence =
        input.message !== undefined ||
        input.changedFiles !== undefined ||
        input.validationResults !== undefined ||
        input.error !== undefined;
      if (
        mutatesClaimEvidence ||
        (input.state && ['applying', 'rebuilding', 'verifying', 'failed'].includes(input.state))
      ) {
        assertClaimAuthority(run, input.claimAttemptId, input.claimCapability);
      }
      if (
        run.applyResultAcknowledgedAt &&
        (input.changedFiles !== undefined || input.validationResults !== undefined)
      ) {
        throw new Error(
          'Apply source and validation evidence is frozen after the Apply result acknowledgement.',
        );
      }
      const transitions: Partial<Record<ApplyRunState, ApplyRunState[]>> = {
        queued: ['cancelled'],
        claimed: ['applying', 'cancelled', 'failed'],
        applying: ['rebuilding', 'cancelled', 'failed'],
        rebuilding: ['verifying', 'cancelled', 'failed'],
        verifying: ['needs_attention', 'cancelled', 'failed'],
      };
      if (input.state && input.state !== run.state) {
        if (!(transitions[run.state] ?? []).includes(input.state)) {
          throw new Error(`Invalid apply run transition: ${run.state} -> ${input.state}`);
        }
        run.state = input.state;
      }
      if (input.changedFiles) run.changedFiles = [...new Set(input.changedFiles)];
      if (input.validationResults) {
        if (run.state !== 'rebuilding') {
          throw new Error('Validation results can only be recorded while rebuilding.');
        }
        if (!validationSourceProof?.revision) {
          throw new Error('Validation results require a server-resolved live project revision.');
        }
        const includesCallerProvenance = input.validationResults.some(
          (validation) =>
            validation.applyRunId !== undefined ||
            validation.claimAttemptId !== undefined ||
            validation.validatedRevision !== undefined ||
            validation.validatedAt !== undefined,
        );
        if (includesCallerProvenance) {
          throw new Error(
            'Validation provenance is assigned by the Foundry runtime and cannot be supplied by the caller.',
          );
        }
        const validatedAt = this.nowIso();
        run.validationResults = input.validationResults.map((validation) =>
          validationResultSchema.parse({
            name: validation.name,
            passed: validation.passed,
            summary: validation.summary,
            applyRunId: run.id,
            claimAttemptId: run.claimAttemptId,
            validatedRevision: validationSourceProof.revision,
            validatedAt,
          }),
        );
      }
      if (input.error !== undefined) run.error = input.error;
      if (
        run.state === 'verifying' &&
        (!run.validationResults.length ||
          run.validationResults.some((validation) => !validation.passed))
      ) {
        throw new Error(
          'Verification requires at least one successful validation and no failures.',
        );
      }
      if (['claimed', 'applying', 'rebuilding', 'verifying'].includes(run.state)) {
        run.claimHeartbeatAt = this.nowIso();
        run.claimExpiresAt = new Date(this.now().getTime() + this.claimLeaseMs).toISOString();
      }
      if (run.state === 'verifying') {
        if (!run.changedFiles.length) {
          throw new Error('Verification requires at least one changed source file');
        }
        if (
          !run.applyResultAcknowledgedAt ||
          run.applyResultClaimAttemptId !== run.claimAttemptId
        ) {
          throw new Error(
            'Verification requires the active claim to acknowledge its source result first.',
          );
        }
      }
      const now = this.nowIso();
      if (input.message !== undefined)
        run.messages.push({
          state: run.state,
          message: input.message,
          createdAt: now,
        });
      if (['cancelled', 'failed', 'needs_attention'].includes(run.state)) {
        run.completedAt = now;
        run.claimAttemptId = undefined;
        run.claimCapabilityHash = undefined;
        run.claimExpiresAt = undefined;
        run.claimHeartbeatAt = undefined;
      }
      run.updatedAt = now;
      stored.changeSet.updatedAt = now;
      this.syncDeliveryForRun(stored, run, now);
      await this.write(stored);
      return stored;
    });
  }

  async retryApplyRun(
    id: string,
    runId: string,
    current: { revision: string | null; designGraphRevision: string | null },
  ): Promise<StoredSession> {
    const stored = await this.read(id);
    const run = stored.applyRuns.find((candidate) => candidate.id === runId);
    if (!run) throw new Error(`Unknown apply run: ${runId}`);
    if (!['needs_attention', 'failed'].includes(run.state)) {
      throw new Error('Only failed runs or runs needing attention can be retried');
    }
    return this.createApplyRun(id, {
      reviews: run.changeIds.map((changeId) => ({ changeId, approved: true })),
      revision: current.revision,
      designGraphRevision: current.designGraphRevision,
      retryOf: run.id,
    });
  }

  async authorizeApplyRunResume(
    id: string,
    runId: string,
    input: {
      expectedRevision: string | null;
      expectedDesignGraphRevision: string | null;
      currentRevision: string | null;
      currentDesignGraphRevision: string | null;
    },
  ): Promise<StoredSession> {
    return this.serializeApplyRunMutation(id, async () => {
      const stored = await this.read(id);
      const run = stored.applyRuns.find((candidate) => candidate.id === runId);
      if (!run) throw new Error(`Unknown apply run: ${runId}`);
      if (run.state !== 'needs_attention' || !run.interruptedState) {
        throw new Error('Only an interrupted apply run can be resumed');
      }
      if (!run.reviewedChangeSet) {
        throw new Error('The frozen reviewed contract is unavailable. Review the changes again.');
      }
      const currentRevision = input.currentRevision;
      const currentDesignGraphRevision = input.currentDesignGraphRevision;
      if (input.expectedRevision !== currentRevision) {
        throw new Error(
          `Resume revision conflict: expected ${input.expectedRevision ?? 'unrecorded'}, found ${currentRevision ?? 'unrecorded'}`,
        );
      }
      if (input.expectedDesignGraphRevision !== currentDesignGraphRevision) {
        throw new Error(
          `Resume design graph revision conflict: expected ${input.expectedDesignGraphRevision ?? 'unrecorded'}, found ${currentDesignGraphRevision ?? 'unrecorded'}`,
        );
      }
      const now = this.nowIso();
      run.state = 'queued';
      run.agent = undefined;
      run.claimAttemptId = undefined;
      run.claimCapabilityHash = undefined;
      run.claimedAt = undefined;
      run.claimHeartbeatAt = undefined;
      run.claimExpiresAt = undefined;
      run.completedAt = undefined;
      run.error = undefined;
      run.changedFiles = [];
      run.validationResults = [];
      run.verificationResults = [];
      run.applyResultAcknowledgedAt = undefined;
      run.applyResultClaimAttemptId = undefined;
      run.sourceProofScope = undefined;
      run.sourceHeadRevision = undefined;
      run.baselineSourceFiles = [];
      run.appliedRevision = undefined;
      run.appliedChangedFiles = [];
      run.appliedSourceFiles = [];
      run.revision = currentRevision ?? undefined;
      run.designGraphRevision = currentDesignGraphRevision ?? undefined;
      run.messages.push({
        state: 'queued',
        message: `Resume authorized. Waiting for an agent to reinspect the interrupted ${run.interruptedState} run.`,
        createdAt: now,
      });
      run.updatedAt = now;
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async addVerifications(
    id: string,
    inputs: VerificationResult[],
    runId: string,
    claimAttemptId: string,
    authority: 'browser-preview' | 'native-agent',
    sourceProof: ApplySourceProof,
    claimCapability?: string,
  ): Promise<StoredSession> {
    return this.serializeApplyRunMutation(id, async () => {
      const stored = await this.read(id);
      const run = stored.applyRuns.find((candidate) => candidate.id === runId);
      if (!run) throw new Error(`Unknown apply run: ${runId}`);
      if (run.state !== 'verifying') throw new Error('Apply run is not waiting for verification');
      if (!run.claimAttemptId || run.claimAttemptId !== claimAttemptId) {
        throw new Error('This claim is no longer active. Reclaim the apply run before verifying.');
      }
      if (!run.reviewedChangeSet) {
        throw new Error('The frozen reviewed contract is unavailable. Review the changes again.');
      }
      const requiresBrowserPreview = run.reviewedChangeSet.changes.some(
        (change) => change.target.platform === 'web',
      );
      if (requiresBrowserPreview && authority !== 'browser-preview') {
        throw new Error('Web apply verification must come from the configured live preview.');
      }
      if (authority === 'native-agent') {
        assertClaimAuthority(run, claimAttemptId, claimCapability);
      }
      if (!run.applyResultAcknowledgedAt || run.applyResultClaimAttemptId !== run.claimAttemptId) {
        throw new Error(
          'The active claim must acknowledge its exact source apply result before verification.',
        );
      }
      assertAppliedSourceUnchanged(run, sourceProof);
      if (
        !run.validationResults.length ||
        run.validationResults.some((validation) => !validation.passed)
      ) {
        throw new Error(
          'Verification requires at least one successful validation and no failures.',
        );
      }
      const frozenChangesById = new Map(
        run.reviewedChangeSet.changes.map((change) => [change.id, change]),
      );
      const byChange = new Map(
        run.verificationResults
          .filter(
            (result) =>
              result.applyRunId === run.id && result.claimAttemptId === run.claimAttemptId,
          )
          .map((result) => [verificationKey(result), result]),
      );
      const requestKeys = new Set<string>();
      for (const input of inputs) {
        if (input.applyRunId !== run.id) {
          throw new Error(
            `Verification must name the active apply run ${run.id}, received ${input.applyRunId ?? 'none'}`,
          );
        }
        if (input.claimAttemptId !== run.claimAttemptId) {
          throw new Error('Verification must name the active claim attempt');
        }
        const change = frozenChangesById.get(input.changeId);
        if (!change) throw new Error(`Unknown verification change: ${input.changeId}`);
        const parsed = verificationResultSchema.parse({
          ...input,
          context: input.context ?? change.context,
        });
        const resultKey = verificationKey(parsed);
        if (requestKeys.has(resultKey)) {
          throw new Error('Verification request contains duplicate change and context evidence');
        }
        requestKeys.add(resultKey);
        const existing = byChange.get(resultKey);
        if (existing && Date.parse(parsed.verifiedAt) <= Date.parse(existing.verifiedAt)) {
          throw new Error('Replacement verification evidence must be strictly newer');
        }
        const verifiedAt = Date.parse(parsed.verifiedAt);
        const acknowledgedAt = Date.parse(run.applyResultAcknowledgedAt);
        if (!Number.isFinite(acknowledgedAt) || verifiedAt < acknowledgedAt) {
          throw new Error('Verification evidence predates the acknowledged source apply result');
        }
        if (verifiedAt > this.now().getTime() + 30_000) {
          throw new Error('Verification evidence timestamp is implausibly far in the future');
        }
        if (parsed.property !== change.property) {
          throw new Error(
            `Verification property ${parsed.property} does not match reviewed property ${change.property}`,
          );
        }
        if (!isDeepStrictEqual(parsed.requested, change.after)) {
          throw new Error(
            `Verification requested value does not match reviewed value for ${change.id}`,
          );
        }
        if (
          parsed.passed &&
          !verificationValueMatches(change.property, parsed.rendered, change.after, change.unit)
        ) {
          throw new Error(
            `Verification cannot pass because the rendered value contradicts the frozen request for ${change.id}`,
          );
        }
        if (
          !expandedChangeContexts(change).some(
            (context) => contextKey(context) === contextKey(parsed.context!),
          )
        ) {
          throw new Error(
            `Verification context ${contextKey(parsed.context!)} is outside the reviewed context set for ${input.changeId}`,
          );
        }
        if (change.target.platform === 'web' && parsed.passed) {
          if (!parsed.geometry) {
            throw new Error(`Browser verification for ${change.id} requires rendered geometry`);
          }
          if (!parsed.evidence.length) {
            throw new Error(`Browser verification for ${change.id} requires rendered evidence`);
          }
          if (
            !Number.isFinite(parsed.geometry.width) ||
            !Number.isFinite(parsed.geometry.height) ||
            parsed.geometry.width <= 0 ||
            parsed.geometry.height <= 0
          ) {
            throw new Error(`Browser verification for ${change.id} requires visible geometry`);
          }
          const viewport = run.reviewedChangeSet.context.viewport;
          if (
            viewport &&
            (parsed.geometry.x >= viewport.width ||
              parsed.geometry.y >= viewport.height ||
              parsed.geometry.x + parsed.geometry.width <= 0 ||
              parsed.geometry.y + parsed.geometry.height <= 0)
          ) {
            throw new Error(
              `Browser verification for ${change.id} is outside the reviewed viewport`,
            );
          }
        }
        byChange.set(resultKey, parsed);
      }
      run.verificationResults = [...byChange.values()];
      const legacyVerificationView = new Map(
        stored.verifications.map((result) => [verificationKey(result), result]),
      );
      for (const result of run.verificationResults) {
        legacyVerificationView.set(verificationKey(result), result);
      }
      stored.verifications = [...legacyVerificationView.values()];
      const now = this.nowIso();
      const expected = run.reviewedChangeSet.changes.flatMap((change) =>
        expandedChangeContexts(change).map((context) =>
          verificationKeyForContext(change.id, context),
        ),
      );
      const resultKeys = new Set(run.verificationResults.map(verificationKey));
      const complete = expected.every((key) => resultKeys.has(key));
      if (complete) {
        if (!currentLedgerMatchesReviewedContract(stored.changeSet, run.reviewedChangeSet)) {
          throw new Error('Current changes no longer match the frozen reviewed contract.');
        }
        for (const key of expected) {
          const result = byChange.get(key)!;
          if (
            result.applyRunId !== run.id ||
            result.claimAttemptId !== run.claimAttemptId ||
            Date.parse(result.verifiedAt) < Date.parse(run.applyResultAcknowledgedAt)
          ) {
            throw new Error('The complete verification set contains stale claim evidence');
          }
        }
        const passed = expected.every((key) => byChange.get(key)?.passed === true);
        run.state = passed ? 'passed' : 'needs_attention';
        run.error = passed
          ? undefined
          : 'One or more rendered values do not match the reviewed batch.';
        run.messages.push({
          state: run.state,
          message: passed
            ? 'Every requested rendered value passed verification.'
            : 'Verification found a mismatch. Review the results before retrying.',
          createdAt: now,
        });
        run.completedAt = now;
        if (passed) {
          const frozenChanges = new Map(
            run.reviewedChangeSet.changes.map((change) => [change.id, change]),
          );
          for (const change of stored.changeSet.changes) {
            const frozen = frozenChanges.get(change.id);
            if (frozen && changeMatchesFrozenContract(change, frozen)) {
              change.status = 'applied';
              change.updatedAt = now;
            }
          }
          const appliedIds = new Set(
            stored.changeSet.changes
              .filter((change) => change.status === 'applied')
              .map((change) => change.id),
          );
          if (run.reviewedChangeSet.changes.some((change) => !appliedIds.has(change.id))) {
            throw new Error('Every frozen reviewed change must transition to applied atomically');
          }
          // Only complete, claim-authorized verification with unchanged applied source can
          // advance the next editing baseline. Frozen Review/Delivery keep their old revision.
          stored.changeSet.context.revision = run.appliedRevision;
        }
        run.claimAttemptId = undefined;
        run.claimCapabilityHash = undefined;
        run.claimExpiresAt = undefined;
        run.claimHeartbeatAt = undefined;
      }
      run.updatedAt = now;
      const record = this.syncDeliveryForRun(stored, run, now);
      if (run.state === 'passed') {
        if (!stored.designHistory.some((entry) => entry.applyRunId === run.id)) {
          stored.designHistory.unshift(createHistoryEntry(record, now));
        }
        stored.documentationPages = markDocumentationStale(
          stored.documentationPages,
          record.affectedFiles,
          now,
        );
      }
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async createVisualAgentRequest(
    id: string,
    input: { title?: string; prompt: string; context: VisualAgentContext },
  ): Promise<StoredSession> {
    return this.serializeVisualAgentMutation(id, async () => {
      const stored = await this.read(id);
      const now = this.nowIso();
      const prompt = input.prompt.trim();
      if (!prompt) throw new Error('Describe the visual improvement you want to discuss.');
      const context = visualAgentContextSchema.parse(input.context);
      if (!context.targets.length && !context.region) {
        throw new Error('Attach at least one rendered element or canvas region.');
      }
      const request = visualAgentRequestSchema.parse({
        id: visualRequestId(),
        sessionId: id,
        title: input.title?.trim() || prompt.slice(0, 72),
        prompt,
        status: 'queued',
        context,
        messages: [
          { id: visualMessageId(), role: 'user', body: prompt, createdAt: now },
          {
            id: visualMessageId(),
            role: 'system',
            body: 'Context captured from the rendered product. Waiting for the active agent.',
            createdAt: now,
          },
        ],
        proposals: [],
        createdAt: now,
        updatedAt: now,
      });
      stored.visualAgentRequests = [...stored.visualAgentRequests.slice(-49), request];
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async claimVisualAgentRequest(
    id: string,
    requestId: string,
    input: {
      agent: NonNullable<VisualAgentRequest['agent']>;
      ttlMs?: number;
      claimCapability?: string;
    },
  ): Promise<StoredSession> {
    return this.serializeVisualAgentMutation(id, async () => {
      const stored = await this.read(id);
      const request = stored.visualAgentRequests.find((item) => item.id === requestId);
      if (!request) throw new Error(`Unknown visual agent request: ${requestId}`);
      if (request.status !== 'queued') {
        throw new Error('Visual request is no longer queued and cannot be claimed again.');
      }
      const now = this.now();
      const nowIso = now.toISOString();
      const ttlMs = Math.min(Math.max(input.ttlMs ?? 70_000, 15_000), 10 * 60_000);
      request.status = 'thinking';
      request.agent = input.agent;
      request.claimAttemptId = `claim_${randomUUID().replaceAll('-', '')}`;
      request.claimCapabilityHash = input.claimCapability
        ? claimCapabilityHash(input.claimCapability)
        : undefined;
      request.claimExpiresAt = new Date(now.getTime() + ttlMs).toISOString();
      request.error = undefined;
      request.messages.push({
        id: visualMessageId(),
        role: 'system',
        body: `${input.agent.name} is inspecting the attached pixels and source context.`,
        createdAt: nowIso,
      });
      request.updatedAt = nowIso;
      stored.changeSet.updatedAt = nowIso;
      await this.write(stored);
      return stored;
    });
  }

  async respondToVisualAgentRequest(
    id: string,
    requestId: string,
    input: {
      claimAttemptId: string;
      claimCapability?: string;
      message: string;
      proposals: Array<Omit<VisualAgentProposal, 'id' | 'createdAt' | 'updatedAt' | 'status'>>;
    },
  ): Promise<StoredSession> {
    return this.serializeVisualAgentMutation(id, async () => {
      const stored = await this.read(id);
      const request = stored.visualAgentRequests.find((item) => item.id === requestId);
      if (!request) throw new Error(`Unknown visual agent request: ${requestId}`);
      assertVisualClaimAuthority(request, input.claimAttemptId, input.claimCapability);
      const now = this.nowIso();
      request.messages.push({
        id: visualMessageId(),
        role: 'agent',
        body: input.message.trim(),
        createdAt: now,
      });
      request.proposals = input.proposals.map((proposal) =>
        visualAgentProposalSchema.parse({
          ...proposal,
          id: visualProposalId(),
          status: 'proposed',
          createdAt: now,
          updatedAt: now,
        }),
      );
      request.status = 'ready';
      request.claimAttemptId = undefined;
      request.claimCapabilityHash = undefined;
      request.claimExpiresAt = undefined;
      request.updatedAt = now;
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async heartbeatVisualAgentRequest(
    id: string,
    requestId: string,
    claimAttemptId: string,
    claimCapability?: string,
  ): Promise<StoredSession> {
    return this.serializeVisualAgentMutation(id, async () => {
      const stored = await this.read(id);
      const request = stored.visualAgentRequests.find((item) => item.id === requestId);
      if (!request) throw new Error(`Unknown visual agent request: ${requestId}`);
      assertVisualClaimAuthority(request, claimAttemptId, claimCapability);
      const now = this.now();
      request.claimExpiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
      request.updatedAt = now.toISOString();
      await this.write(stored);
      return stored;
    });
  }

  async retryVisualAgentRequest(id: string, requestId: string): Promise<StoredSession> {
    return this.serializeVisualAgentMutation(id, async () => {
      const stored = await this.read(id);
      const request = stored.visualAgentRequests.find((item) => item.id === requestId);
      if (!request) throw new Error(`Unknown visual agent request: ${requestId}`);
      if (!['needs_attention', 'ready'].includes(request.status)) {
        throw new Error('Only completed or interrupted visual requests can be retried.');
      }
      const now = this.nowIso();
      request.status = 'queued';
      request.agent = undefined;
      request.error = undefined;
      request.claimAttemptId = undefined;
      request.claimCapabilityHash = undefined;
      request.claimExpiresAt = undefined;
      request.messages.push({
        id: visualMessageId(),
        role: 'system',
        body: 'Retry authorized. Waiting for a Foundry listener.',
        createdAt: now,
      });
      request.updatedAt = now;
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async updateVisualAgentProposal(
    id: string,
    requestId: string,
    proposalId: string,
    action: 'preview' | 'previewed' | 'promote' | 'reject',
  ): Promise<StoredSession> {
    return this.serializeVisualAgentMutation(id, async () => {
      const stored = await this.read(id);
      const request = stored.visualAgentRequests.find((item) => item.id === requestId);
      const proposal = request?.proposals.find((item) => item.id === proposalId);
      if (!request || !proposal) throw new Error(`Unknown visual proposal: ${proposalId}`);
      const now = this.nowIso();
      if (action === 'reject') proposal.status = 'rejected';
      if (action === 'preview') {
        if (!proposal.changes.length)
          throw new Error('This proposal does not include previewable changes.');
        if (
          proposal.changes.some(
            (change) => change.target.platform !== stored.changeSet.context.platform,
          )
        ) {
          throw new Error('Visual proposal changes must target the active session platform.');
        }
        let branch = stored.designBranches.find((item) => item.id === proposal.branchId);
        if (!branch) {
          if (stored.designBranches.filter((item) => item.status !== 'archived').length >= 8) {
            throw new Error('Archive a direction before previewing another proposal.');
          }
          branch = designBranchSchema.parse({
            id: branchId(),
            name: proposal.name,
            status: 'exploring',
            changes: coalesceChanges([...stored.changeSet.changes, ...proposal.changes]).map(
              (change) => ({
                ...change,
                id: changeId(),
                status: change.status === 'unresolved' ? 'unresolved' : 'draft',
                createdAt: now,
                updatedAt: now,
              }),
            ),
            operations: [],
            createdAt: now,
            updatedAt: now,
          });
          stored.designBranches.push(branch);
        }
        proposal.branchId = branch.id;
        if (stored.activeDesignBranchId !== branch.id) proposal.status = 'proposed';
      }
      if (action === 'previewed') {
        const branch = stored.designBranches.find((item) => item.id === proposal.branchId);
        if (!branch) {
          throw new Error('Save this proposal before confirming it in Preview.');
        }
        for (const visualRequest of stored.visualAgentRequests) {
          for (const visualProposal of visualRequest.proposals) {
            if (visualProposal.id === proposal.id || visualProposal.status !== 'previewing')
              continue;
            visualProposal.status = 'proposed';
            visualProposal.updatedAt = now;
          }
        }
        stored.activeDesignBranchId = branch.id;
        proposal.status = 'previewing';
      }
      if (action === 'promote') {
        this.assertNoActiveApplyRun(stored, 'promoting a Visual Agent proposal');
        const branch = stored.designBranches.find((item) => item.id === proposal.branchId);
        if (
          !branch ||
          proposal.status !== 'previewing' ||
          stored.activeDesignBranchId !== branch.id
        ) {
          throw new Error('Confirm this proposal in Preview before promoting it to Review.');
        }
        const merged = mergePromotedLedger(stored, branch.changes, branch.operations, now);
        stored.changeSet.changes = merged.changes;
        stored.changeSet.operations = merged.operations;
        for (const item of stored.designBranches) {
          if (item.status === 'chosen') item.status = 'exploring';
        }
        branch.status = 'chosen';
        branch.updatedAt = now;
        stored.activeDesignBranchId = undefined;
        proposal.status = 'promoted';
      }
      proposal.updatedAt = now;
      request.updatedAt = now;
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async updateDeliveryRecord(
    id: string,
    recordId: string,
    input: Partial<Pick<DeliveryRecord, 'intent' | 'narrativeSource' | 'risks' | 'questions'>>,
  ): Promise<StoredSession> {
    return this.serializeSessionMutation(id, async () => {
      const stored = await this.read(id);
      const record = stored.deliveryRecords.find((candidate) => candidate.id === recordId);
      if (!record) throw new Error(`Unknown delivery record: ${recordId}`);
      if (record.status === 'verified' || record.status === 'superseded') {
        throw new Error('Verified and superseded Delivery records are immutable.');
      }
      const allowed = new Set(['intent', 'narrativeSource', 'risks', 'questions']);
      const forbidden = Object.keys(input).filter((key) => !allowed.has(key));
      if (forbidden.length) {
        throw new Error(
          `Machine-derived Delivery fields cannot be overwritten: ${forbidden.join(', ')}`,
        );
      }
      const now = this.nowIso();
      const next = deliveryRecordSchema.parse({ ...record, ...input, updatedAt: now });
      stored.deliveryRecords[stored.deliveryRecords.indexOf(record)] = next;
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async generateDocumentation(id: string): Promise<StoredSession> {
    return this.serializeSessionMutation(id, async () => {
      const stored = await this.read(id);
      const now = this.nowIso();
      stored.documentationPages = generateDocumentation(
        stored.designGraph,
        stored.deliveryRecords,
        stored.changeSet.context,
        stored.documentationPages,
        now,
      );
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async markDocumentationDrift(id: string, changedFiles: string[]): Promise<StoredSession> {
    return this.serializeSessionMutation(id, async () => {
      const stored = await this.read(id);
      const now = this.nowIso();
      stored.documentationPages = markDocumentationStale(
        stored.documentationPages,
        changedFiles.map((path) => path.replaceAll('\\', '/')),
        now,
      );
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async recordDocumentationExports(
    id: string,
    exports: DocumentationExportMetadata[],
  ): Promise<StoredSession> {
    return this.serializeSessionMutation(id, async () => {
      const stored = await this.read(id);
      const unknown = exports.filter(
        (item) => !stored.documentationPages.some((page) => page.id === item.pageId),
      );
      if (unknown.length) {
        throw new Error(
          `Unknown documentation pages: ${unknown.map((item) => item.pageId).join(', ')}`,
        );
      }
      const now = this.nowIso();
      const exportedById = new Map(exports.map((item) => [item.pageId, item]));
      stored.documentationPages = stored.documentationPages.map((page) => {
        const exported = exportedById.get(page.id);
        if (!exported) return page;
        const matchesCurrentContent = exported.contentHash === page.contentHash;
        return {
          ...page,
          exportedHash: exported.contentHash,
          exportedPath: exported.path,
          freshness:
            page.freshness === 'conflicted' && matchesCurrentContent ? 'current' : page.freshness,
          updatedAt: now,
        };
      });
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async markDocumentationConflicted(id: string, pageIds: string[]): Promise<StoredSession> {
    return this.serializeSessionMutation(id, async () => {
      const stored = await this.read(id);
      const requested = new Set(pageIds);
      const unknown = [...requested].filter(
        (pageId) => !stored.documentationPages.some((page) => page.id === pageId),
      );
      if (unknown.length) throw new Error(`Unknown documentation pages: ${unknown.join(', ')}`);
      const now = this.nowIso();
      stored.documentationPages = stored.documentationPages.map((page) =>
        requested.has(page.id) ? { ...page, freshness: 'conflicted', updatedAt: now } : page,
      );
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async createDeliveryMilestone(
    id: string,
    input: { name: string; summary?: string; entryIds?: string[] },
  ): Promise<StoredSession> {
    return this.serializeSessionMutation(id, async () => {
      const stored = await this.read(id);
      const unknown = (input.entryIds ?? []).filter(
        (entryId) => !stored.designHistory.some((entry) => entry.id === entryId),
      );
      if (unknown.length) throw new Error(`Unknown history entries: ${unknown.join(', ')}`);
      const now = this.nowIso();
      stored.deliveryMilestones.unshift(
        createMilestone(input.name.trim(), input.summary?.trim() ?? '', input.entryIds ?? [], now),
      );
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async updateDeliveryMilestone(
    id: string,
    milestoneId: string,
    input: Partial<Pick<DeliveryMilestone, 'name' | 'summary' | 'entryIds' | 'status'>>,
  ): Promise<StoredSession> {
    return this.serializeSessionMutation(id, async () => {
      const stored = await this.read(id);
      const milestone = stored.deliveryMilestones.find((candidate) => candidate.id === milestoneId);
      if (!milestone) throw new Error(`Unknown milestone: ${milestoneId}`);
      const unknown = (input.entryIds ?? []).filter(
        (entryId) => !stored.designHistory.some((entry) => entry.id === entryId),
      );
      if (unknown.length) throw new Error(`Unknown history entries: ${unknown.join(', ')}`);
      const now = this.nowIso();
      const next = deliveryMilestoneSchema.parse({
        ...milestone,
        ...input,
        updatedAt: now,
        publishedAt:
          input.status === 'published' ? (milestone.publishedAt ?? now) : milestone.publishedAt,
      });
      stored.deliveryMilestones[stored.deliveryMilestones.indexOf(milestone)] = next;
      stored.changeSet.updatedAt = now;
      await this.write(stored);
      return stored;
    });
  }

  async authenticate(id: string, token: string | undefined): Promise<StoredSession> {
    const stored = await this.read(id);
    if (!token || token !== stored.token) throw new Error('Invalid session token');
    return stored;
  }

  private async write(stored: StoredSession): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const parsed: StoredSession = {
      token: stored.token,
      previewCapabilityHash: stored.previewCapabilityHash,
      changeSet: changeSetSchema.parse(stored.changeSet),
      verifications: stored.verifications.map((result) => verificationResultSchema.parse(result)),
      applyRuns: stored.applyRuns.map((run) => applyRunSchema.parse(run)),
      designGraph: stored.designGraph ? projectDesignGraphSchema.parse(stored.designGraph) : null,
      designBranches: stored.designBranches.map((branch) => designBranchSchema.parse(branch)),
      designBranchRecords: stored.designBranchRecords.map((record) =>
        designBranchRecordSchema.parse(record),
      ),
      activeDesignBranchId: stored.activeDesignBranchId,
      visualAgentRequests: stored.visualAgentRequests.map((request) =>
        visualAgentRequestSchema.parse(request),
      ),
      deliveryRecords: stored.deliveryRecords.map((record) => deliveryRecordSchema.parse(record)),
      documentationPages: stored.documentationPages.map((page) =>
        documentationPageSchema.parse(page),
      ),
      designHistory: stored.designHistory.map((entry) => designHistoryEntrySchema.parse(entry)),
      deliveryMilestones: stored.deliveryMilestones.map((milestone) =>
        deliveryMilestoneSchema.parse(milestone),
      ),
    };
    const target = join(this.root, `${stored.changeSet.sessionId}.json`);
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(parsed, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporary, target);
  }
}
