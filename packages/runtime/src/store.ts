import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  PROTOCOL_VERSION,
  applyRunSchema,
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
  verificationResultSchema,
  visualAgentContextSchema,
  visualAgentProposalSchema,
  visualAgentRequestSchema,
  type ApplyRun,
  type ApplyRunState,
  type ChangeSet,
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
  type SessionContext,
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

export interface StoredSession {
  token: string;
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

export interface DocumentationExportMetadata {
  pageId: string;
  path: string;
  contentHash: string;
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

export class SessionStore {
  readonly root: string;
  private readonly changeMutationTails = new Map<string, Promise<void>>();
  private readonly applyRunMutationTails = new Map<string, Promise<void>>();
  private readonly visualAgentMutationTails = new Map<string, Promise<void>>();
  private readonly claimLeaseMs: number;
  private readonly now: () => Date;

  constructor(root = defaultStoreRoot(), options: SessionStoreOptions = {}) {
    this.root = root;
    this.claimLeaseMs = options.claimLeaseMs ?? 45_000;
    this.now = options.now ?? (() => new Date());
  }

  private async serializeChangeMutation<T>(id: string, mutation: () => Promise<T>): Promise<T> {
    const previous = this.changeMutationTails.get(id) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(mutation);
    const tail = current.then(
      () => undefined,
      () => undefined,
    );
    this.changeMutationTails.set(id, tail);
    try {
      return await current;
    } finally {
      if (this.changeMutationTails.get(id) === tail) this.changeMutationTails.delete(id);
    }
  }

  private async serializeApplyRunMutation<T>(id: string, mutation: () => Promise<T>): Promise<T> {
    const previous = this.applyRunMutationTails.get(id) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(mutation);
    const tail = current.then(
      () => undefined,
      () => undefined,
    );
    this.applyRunMutationTails.set(id, tail);
    try {
      return await current;
    } finally {
      if (this.applyRunMutationTails.get(id) === tail) this.applyRunMutationTails.delete(id);
    }
  }

  private async serializeVisualAgentMutation<T>(
    id: string,
    mutation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.visualAgentMutationTails.get(id) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(mutation);
    const tail = current.then(
      () => undefined,
      () => undefined,
    );
    this.visualAgentMutationTails.set(id, tail);
    try {
      return await current;
    } finally {
      if (this.visualAgentMutationTails.get(id) === tail) this.visualAgentMutationTails.delete(id);
    }
  }

  private nowIso(): string {
    return this.now().toISOString();
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
    const record = existing ?? createDeliveryRecord(stored.changeSet, run, now);
    const synced = syncDeliveryRecord(record, run, stored.changeSet.context.projectRoot, now);
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
      run.claimExpiresAt = undefined;
      run.claimHeartbeatAt = undefined;
      run.claimedAt = undefined;
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
    if (!/^ses_[a-f0-9]+$/.test(id)) throw new Error('Invalid session id');
    const raw = JSON.parse(await readFile(join(this.root, `${id}.json`), 'utf8')) as StoredSession;
    const changeSetInput = raw.changeSet as unknown as Record<string, unknown>;
    if (['1.0.0', '1.1.0'].includes(String(changeSetInput.protocolVersion))) {
      changeSetInput.protocolVersion = PROTOCOL_VERSION;
    }
    const stored: StoredSession = {
      token: String(raw.token),
      changeSet: changeSetSchema.parse(changeSetInput),
      verifications: (raw.verifications ?? []).map((result) =>
        verificationResultSchema.parse(result),
      ),
      applyRuns: (raw.applyRuns ?? []).map((run) => applyRunSchema.parse(run)),
      designGraph: raw.designGraph ? projectDesignGraphSchema.parse(raw.designGraph) : null,
      designBranches: (raw.designBranches ?? []).map((branch) => designBranchSchema.parse(branch)),
      designBranchRecords: (raw.designBranchRecords ?? []).map((record) =>
        assessBranchRecord(
          designBranchRecordSchema.parse(record),
          changeSetSchema.parse(changeSetInput).context,
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
    if (this.recoverExpiredClaims(stored)) await this.write(stored);
    return stored;
  }

  async setDesignGraph(id: string, graphInput: ProjectDesignGraph): Promise<StoredSession> {
    const stored = await this.read(id);
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
    stored.changeSet.updatedAt = new Date().toISOString();
    await this.write(stored);
    return stored;
  }

  async addOperation(
    id: string,
    input: Omit<DesignOperationInput, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<DesignOperationInput, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StoredSession> {
    const stored = await this.read(id);
    const now = this.nowIso();
    const operation = designOperationSchema.parse({
      ...input,
      id: input.id ?? operationId(),
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    });
    const branch = stored.designBranches.find((item) => item.id === stored.activeDesignBranchId);
    const operations = branch?.operations ?? stored.changeSet.operations;
    const existing = operations.findIndex((item) => item.id === operation.id);
    if (existing >= 0) operations[existing] = operation;
    else operations.push(operation);
    if (branch) branch.updatedAt = now;
    stored.changeSet.updatedAt = now;
    await this.write(stored);
    return stored;
  }

  async resolveOperation(
    id: string,
    targetOperationId: string,
    selectedMappingId: string,
  ): Promise<StoredSession> {
    const stored = await this.read(id);
    const branch = stored.designBranches.find((item) => item.id === stored.activeDesignBranchId);
    const operations = branch?.operations ?? stored.changeSet.operations;
    const changes = branch?.changes ?? stored.changeSet.changes;
    const operation = operations.find((item) => item.id === targetOperationId);
    if (!operation) throw new Error(`Unknown operation: ${targetOperationId}`);
    const mapping = operation.mappingCandidates.find((item) => item.id === selectedMappingId);
    if (!mapping) throw new Error(`Unknown source mapping: ${selectedMappingId}`);
    const now = new Date().toISOString();
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
  }

  async addChange(
    id: string,
    input: Omit<DesignChangeInput, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<DesignChangeInput, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StoredSession> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
      const now = new Date().toISOString();
      const parsed = designChangeSchema.parse({
        ...input,
        id: input.id ?? changeId(),
        createdAt: input.createdAt ?? now,
        updatedAt: now,
      });
      const branch = stored.designBranches.find((item) => item.id === stored.activeDesignBranchId);
      if (branch) {
        branch.changes = coalesceChanges([...branch.changes, parsed]);
        branch.updatedAt = now;
      } else {
        stored.changeSet.changes = coalesceChanges([...stored.changeSet.changes, parsed]);
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
      const now = this.nowIso();
      const operationIds = new Map<string, string>();
      stored.changeSet.operations = branch.operations.map((operation) => {
        const nextId = operationId();
        operationIds.set(operation.id, nextId);
        return { ...operation, id: nextId, changeIds: [], updatedAt: now };
      });
      stored.changeSet.changes = branch.changes.map((change) => ({
        ...change,
        id: changeId(),
        operationId: change.operationId ? operationIds.get(change.operationId) : undefined,
        status: change.status === 'unresolved' ? 'unresolved' : 'draft',
        updatedAt: now,
      }));
      for (const operation of stored.changeSet.operations) {
        operation.changeIds = stored.changeSet.changes
          .filter((change) => change.operationId === operation.id)
          .map((change) => change.id);
      }
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
  ): Promise<StoredSession> {
    const stored = await this.read(id);
    const branch = stored.designBranches.find((item) => item.id === stored.activeDesignBranchId);
    const target = (branch?.changes ?? stored.changeSet.changes).find(
      (change) => change.id === targetChangeId,
    );
    if (!target) throw new Error(`Unknown change: ${targetChangeId}`);
    target.status = status;
    target.updatedAt = new Date().toISOString();
    if (branch) branch.updatedAt = target.updatedAt;
    stored.changeSet.updatedAt = target.updatedAt;
    await this.write(stored);
    return stored;
  }

  async deleteChange(
    id: string,
    targetChangeId: string,
  ): Promise<{ stored: StoredSession; removedChange: DesignChange }> {
    return this.serializeChangeMutation(id, async () => {
      const stored = await this.read(id);
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
      revision?: string;
      retryOf?: string;
    },
  ): Promise<StoredSession> {
    const stored = await this.read(id);
    if (stored.applyRuns.some((run) => activeRunStates.has(run.state))) {
      throw new Error('An apply run is already active for this session');
    }
    const now = this.nowIso();
    const approvedIds: string[] = [];
    for (const review of input.reviews) {
      const change = stored.changeSet.changes.find((candidate) => candidate.id === review.changeId);
      if (!change) throw new Error(`Unknown change: ${review.changeId}`);
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
      if (review.approved && operation?.status === 'unresolved') {
        throw new Error(`Unresolved operation cannot be applied: ${operation.id}`);
      }
      change.status = review.approved ? 'approved' : 'rejected';
      change.updatedAt = now;
      if (review.approved) approvedIds.push(change.id);
    }
    if (!approvedIds.length) throw new Error('Select at least one resolved change to apply');
    const retrySource = input.retryOf
      ? stored.applyRuns.find((run) => run.id === input.retryOf)
      : undefined;
    if (input.retryOf && !retrySource) throw new Error(`Unknown apply run: ${input.retryOf}`);
    const run = applyRunSchema.parse({
      id: applyRunId(),
      sessionId: id,
      changeIds: approvedIds,
      revision: input.revision ?? stored.changeSet.context.revision,
      designGraphRevision: stored.changeSet.designGraphRevision,
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
    stored.applyRuns.push(run);
    this.syncDeliveryForRun(stored, run, now);
    stored.changeSet.updatedAt = now;
    await this.write(stored);
    return stored;
  }

  async claimApplyRun(
    id: string,
    runId: string,
    input: { agent: ApplyRun['agent']; revision?: string; designGraphRevision?: string },
  ): Promise<StoredSession> {
    return this.serializeApplyRunMutation(id, async () => {
      const stored = await this.read(id);
      const run = stored.applyRuns.find((candidate) => candidate.id === runId);
      if (!run) throw new Error(`Unknown apply run: ${runId}`);
      if (run.state !== 'queued') return stored;
      const now = this.nowIso();
      const sourceChanged =
        !run.retryOf &&
        !run.interruptedState &&
        run.revision &&
        input.revision &&
        run.revision !== input.revision;
      const graphChanged =
        run.designGraphRevision &&
        input.designGraphRevision &&
        run.designGraphRevision !== input.designGraphRevision;
      if (sourceChanged || graphChanged) {
        run.state = 'needs_attention';
        run.error = sourceChanged
          ? `Project revision changed from ${run.revision} to ${input.revision}. Review the batch before retrying.`
          : `Project design graph changed from ${run.designGraphRevision} to ${input.designGraphRevision}. Review the semantic mappings before retrying.`;
        run.messages.push({
          state: run.state,
          message: run.error,
          createdAt: now,
        });
        run.completedAt = now;
      } else {
        run.state = 'claimed';
        run.agent = input.agent;
        run.claimAttemptId = `claim_${randomUUID().replaceAll('-', '')}`;
        run.claimedAt = now;
        run.claimHeartbeatAt = now;
        run.claimExpiresAt = new Date(this.now().getTime() + this.claimLeaseMs).toISOString();
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
  ): Promise<StoredSession> {
    return this.serializeApplyRunMutation(id, async () => {
      const stored = await this.read(id);
      const run = stored.applyRuns.find((candidate) => candidate.id === runId);
      if (!run) throw new Error(`Unknown apply run: ${runId}`);
      if (!['claimed', 'applying', 'rebuilding', 'verifying'].includes(run.state)) {
        throw new Error('Apply run does not have an active agent lease');
      }
      if (!run.claimAttemptId || run.claimAttemptId !== claimAttemptId) {
        throw new Error('This claim is no longer active. Reclaim the apply run before continuing.');
      }
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
    },
  ): Promise<StoredSession> {
    return this.serializeApplyRunMutation(id, async () => {
      const stored = await this.read(id);
      const run = stored.applyRuns.find((candidate) => candidate.id === runId);
      if (!run) throw new Error(`Unknown apply run: ${runId}`);
      if (
        input.state &&
        ['applying', 'rebuilding', 'verifying', 'failed'].includes(input.state) &&
        run.claimAttemptId !== input.claimAttemptId
      ) {
        throw new Error('This claim is no longer active. Reclaim the apply run before continuing.');
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
      if (input.validationResults) run.validationResults = input.validationResults;
      if (input.error !== undefined) run.error = input.error;
      if (['claimed', 'applying', 'rebuilding', 'verifying'].includes(run.state)) {
        run.claimHeartbeatAt = this.nowIso();
        run.claimExpiresAt = new Date(this.now().getTime() + this.claimLeaseMs).toISOString();
      }
      if (run.state === 'verifying') {
        if (!run.changedFiles.length) {
          throw new Error('Verification requires at least one changed source file');
        }
        for (const change of stored.changeSet.changes) {
          if (run.changeIds.includes(change.id)) change.status = 'applied';
        }
      }
      const now = this.nowIso();
      if (input.message)
        run.messages.push({
          state: run.state,
          message: input.message,
          createdAt: now,
        });
      if (['cancelled', 'failed', 'needs_attention'].includes(run.state)) run.completedAt = now;
      run.updatedAt = now;
      stored.changeSet.updatedAt = now;
      this.syncDeliveryForRun(stored, run, now);
      await this.write(stored);
      return stored;
    });
  }

  async retryApplyRun(id: string, runId: string): Promise<StoredSession> {
    const stored = await this.read(id);
    const run = stored.applyRuns.find((candidate) => candidate.id === runId);
    if (!run) throw new Error(`Unknown apply run: ${runId}`);
    if (!['needs_attention', 'failed'].includes(run.state)) {
      throw new Error('Only failed runs or runs needing attention can be retried');
    }
    return this.createApplyRun(id, {
      reviews: run.changeIds.map((changeId) => ({ changeId, approved: true })),
      revision: stored.changeSet.context.revision,
      retryOf: run.id,
    });
  }

  async authorizeApplyRunResume(id: string, runId: string): Promise<StoredSession> {
    return this.serializeApplyRunMutation(id, async () => {
      const stored = await this.read(id);
      const run = stored.applyRuns.find((candidate) => candidate.id === runId);
      if (!run) throw new Error(`Unknown apply run: ${runId}`);
      if (run.state !== 'needs_attention' || !run.interruptedState) {
        throw new Error('Only an interrupted apply run can be resumed');
      }
      const now = this.nowIso();
      run.state = 'queued';
      run.agent = undefined;
      run.claimAttemptId = undefined;
      run.claimedAt = undefined;
      run.claimHeartbeatAt = undefined;
      run.claimExpiresAt = undefined;
      run.completedAt = undefined;
      run.error = undefined;
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
    runId?: string,
  ): Promise<StoredSession> {
    const stored = await this.read(id);
    const byChange = new Map(stored.verifications.map((item) => [item.changeId, item]));
    for (const input of inputs) {
      const parsed = verificationResultSchema.parse(input);
      byChange.set(parsed.changeId, parsed);
    }
    stored.verifications = [...byChange.values()];
    const now = new Date().toISOString();
    if (runId) {
      const run = stored.applyRuns.find((candidate) => candidate.id === runId);
      if (!run) throw new Error(`Unknown apply run: ${runId}`);
      if (run.state !== 'verifying') throw new Error('Apply run is not waiting for verification');
      run.verificationResults = stored.verifications.filter((result) =>
        run.changeIds.includes(result.changeId),
      );
      const complete = run.changeIds.every((changeId) =>
        run.verificationResults.some((result) => result.changeId === changeId),
      );
      if (complete) {
        const passed = run.verificationResults.every((result) => result.passed);
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
    }
    stored.changeSet.updatedAt = now;
    await this.write(stored);
    return stored;
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
    input: { agent: NonNullable<VisualAgentRequest['agent']>; ttlMs?: number },
  ): Promise<StoredSession> {
    return this.serializeVisualAgentMutation(id, async () => {
      const stored = await this.read(id);
      const request = stored.visualAgentRequests.find((item) => item.id === requestId);
      if (!request) throw new Error(`Unknown visual agent request: ${requestId}`);
      if (request.status !== 'queued') return stored;
      const now = this.now();
      const nowIso = now.toISOString();
      const ttlMs = Math.min(Math.max(input.ttlMs ?? 70_000, 15_000), 10 * 60_000);
      request.status = 'thinking';
      request.agent = input.agent;
      request.claimAttemptId = `claim_${randomUUID().replaceAll('-', '')}`;
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
      message: string;
      proposals: Array<Omit<VisualAgentProposal, 'id' | 'createdAt' | 'updatedAt' | 'status'>>;
    },
  ): Promise<StoredSession> {
    return this.serializeVisualAgentMutation(id, async () => {
      const stored = await this.read(id);
      const request = stored.visualAgentRequests.find((item) => item.id === requestId);
      if (!request) throw new Error(`Unknown visual agent request: ${requestId}`);
      if (request.status !== 'thinking' || request.claimAttemptId !== input.claimAttemptId) {
        throw new Error('This visual request is no longer claimed by the current agent attempt.');
      }
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
  ): Promise<StoredSession> {
    return this.serializeVisualAgentMutation(id, async () => {
      const stored = await this.read(id);
      const request = stored.visualAgentRequests.find((item) => item.id === requestId);
      if (!request) throw new Error(`Unknown visual agent request: ${requestId}`);
      if (request.status !== 'thinking' || request.claimAttemptId !== claimAttemptId) {
        throw new Error('This visual request is no longer claimed by the current agent attempt.');
      }
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
      request.claimExpiresAt = undefined;
      request.messages.push({
        id: visualMessageId(),
        role: 'system',
        body: 'Retry authorized. Waiting for the active agent.',
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
    action: 'preview' | 'promote' | 'reject',
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
        stored.activeDesignBranchId = branch.id;
        proposal.branchId = branch.id;
        proposal.status = 'previewing';
      }
      if (action === 'promote') {
        const branch = stored.designBranches.find((item) => item.id === proposal.branchId);
        if (!branch) throw new Error('Preview this proposal before promoting it to Review.');
        stored.changeSet.changes = branch.changes.map((change) => ({
          ...change,
          id: changeId(),
          status: change.status === 'unresolved' ? 'unresolved' : 'draft',
          updatedAt: now,
        }));
        stored.changeSet.operations = [];
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
    input: Partial<
      Pick<
        DeliveryRecord,
        | 'title'
        | 'summary'
        | 'intent'
        | 'narrativeSource'
        | 'risks'
        | 'questions'
        | 'acceptanceCriteria'
      >
    >,
  ): Promise<StoredSession> {
    const stored = await this.read(id);
    const record = stored.deliveryRecords.find((candidate) => candidate.id === recordId);
    if (!record) throw new Error(`Unknown delivery record: ${recordId}`);
    const now = this.nowIso();
    const next = deliveryRecordSchema.parse({ ...record, ...input, updatedAt: now });
    const missing = 'Add at least one acceptance criterion';
    next.blockers = [
      ...next.blockers.filter((blocker) => blocker !== missing),
      ...(next.acceptanceCriteria.length ? [] : [missing]),
    ];
    if (next.status === 'draft' && next.blockers.length === 0) next.status = 'ready';
    if (next.status === 'ready' && next.blockers.length > 0) next.status = 'draft';
    stored.deliveryRecords[stored.deliveryRecords.indexOf(record)] = next;
    stored.changeSet.updatedAt = now;
    await this.write(stored);
    return stored;
  }

  async generateDocumentation(id: string): Promise<StoredSession> {
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
  }

  async markDocumentationDrift(id: string, changedFiles: string[]): Promise<StoredSession> {
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
  }

  async recordDocumentationExports(
    id: string,
    exports: DocumentationExportMetadata[],
  ): Promise<StoredSession> {
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
  }

  async markDocumentationConflicted(id: string, pageIds: string[]): Promise<StoredSession> {
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
  }

  async createDeliveryMilestone(
    id: string,
    input: { name: string; summary?: string; entryIds?: string[] },
  ): Promise<StoredSession> {
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
  }

  async updateDeliveryMilestone(
    id: string,
    milestoneId: string,
    input: Partial<Pick<DeliveryMilestone, 'name' | 'summary' | 'entryIds' | 'status'>>,
  ): Promise<StoredSession> {
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
