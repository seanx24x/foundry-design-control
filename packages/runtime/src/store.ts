import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  PROTOCOL_VERSION,
  applyRunSchema,
  changeSetSchema,
  coalesceChanges,
  designChangeSchema,
  designOperationSchema,
  projectDesignGraphSchema,
  sessionContextSchema,
  verificationResultSchema,
  type ApplyRun,
  type ApplyRunState,
  type ChangeSet,
  type DesignChange,
  type DesignChangeInput,
  type DesignOperation,
  type DesignOperationInput,
  type ProjectDesignGraph,
  type SessionContext,
  type VerificationResult,
} from 'foundry-design-protocol';

export interface StoredSession {
  token: string;
  changeSet: ChangeSet;
  verifications: VerificationResult[];
  applyRuns: ApplyRun[];
  designGraph: ProjectDesignGraph | null;
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

  constructor(root = defaultStoreRoot()) {
    this.root = root;
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

  async create(contextInput: SessionContext): Promise<StoredSession> {
    const context = sessionContextSchema.parse(contextInput);
    const now = new Date().toISOString();
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
    return {
      token: String(raw.token),
      changeSet: changeSetSchema.parse(changeSetInput),
      verifications: (raw.verifications ?? []).map((result) =>
        verificationResultSchema.parse(result),
      ),
      applyRuns: (raw.applyRuns ?? []).map((run) => applyRunSchema.parse(run)),
      designGraph: raw.designGraph ? projectDesignGraphSchema.parse(raw.designGraph) : null,
    };
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
    const now = new Date().toISOString();
    const operation = designOperationSchema.parse({
      ...input,
      id: input.id ?? operationId(),
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    });
    const existing = stored.changeSet.operations.findIndex((item) => item.id === operation.id);
    if (existing >= 0) stored.changeSet.operations[existing] = operation;
    else stored.changeSet.operations.push(operation);
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
    const operation = stored.changeSet.operations.find((item) => item.id === targetOperationId);
    if (!operation) throw new Error(`Unknown operation: ${targetOperationId}`);
    const mapping = operation.mappingCandidates.find((item) => item.id === selectedMappingId);
    if (!mapping) throw new Error(`Unknown source mapping: ${selectedMappingId}`);
    const now = new Date().toISOString();
    operation.selectedMappingId = selectedMappingId;
    operation.status = 'resolved';
    operation.updatedAt = now;
    for (const change of stored.changeSet.changes) {
      if (change.operationId !== operation.id) continue;
      change.selectedMappingId = selectedMappingId;
      change.confidence = mapping.confidence;
      change.status = change.status === 'unresolved' ? 'draft' : change.status;
      change.updatedAt = now;
    }
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
      stored.changeSet.changes = coalesceChanges([...stored.changeSet.changes, parsed]);
      stored.changeSet.updatedAt = now;
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
    const target = stored.changeSet.changes.find((change) => change.id === targetChangeId);
    if (!target) throw new Error(`Unknown change: ${targetChangeId}`);
    target.status = status;
    target.updatedAt = new Date().toISOString();
    stored.changeSet.updatedAt = target.updatedAt;
    await this.write(stored);
    return stored;
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
    const now = new Date().toISOString();
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
    stored.changeSet.updatedAt = now;
    await this.write(stored);
    return stored;
  }

  async claimApplyRun(
    id: string,
    runId: string,
    input: { agent: ApplyRun['agent']; revision?: string; designGraphRevision?: string },
  ): Promise<StoredSession> {
    const stored = await this.read(id);
    const run = stored.applyRuns.find((candidate) => candidate.id === runId);
    if (!run) throw new Error(`Unknown apply run: ${runId}`);
    if (run.state !== 'queued') return stored;
    const now = new Date().toISOString();
    const sourceChanged =
      !run.retryOf && run.revision && input.revision && run.revision !== input.revision;
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
      run.claimedAt = now;
      run.messages.push({
        state: run.state,
        message: `${input.agent?.name ?? 'Agent'} claimed the reviewed batch.`,
        createdAt: now,
      });
    }
    run.updatedAt = now;
    await this.write(stored);
    return stored;
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
    },
  ): Promise<StoredSession> {
    const stored = await this.read(id);
    const run = stored.applyRuns.find((candidate) => candidate.id === runId);
    if (!run) throw new Error(`Unknown apply run: ${runId}`);
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
    if (run.state === 'verifying') {
      if (!run.changedFiles.length) {
        throw new Error('Verification requires at least one changed source file');
      }
      for (const change of stored.changeSet.changes) {
        if (run.changeIds.includes(change.id)) change.status = 'applied';
      }
    }
    const now = new Date().toISOString();
    if (input.message)
      run.messages.push({
        state: run.state,
        message: input.message,
        createdAt: now,
      });
    if (['cancelled', 'failed', 'needs_attention'].includes(run.state)) run.completedAt = now;
    run.updatedAt = now;
    stored.changeSet.updatedAt = now;
    await this.write(stored);
    return stored;
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
    }
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
    };
    const target = join(this.root, `${stored.changeSet.sessionId}.json`);
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(parsed, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporary, target);
  }
}
