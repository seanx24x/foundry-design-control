import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  PROTOCOL_VERSION,
  changeSetSchema,
  coalesceChanges,
  designChangeSchema,
  sessionContextSchema,
  verificationResultSchema,
  type ChangeSet,
  type DesignChange,
  type SessionContext,
  type VerificationResult,
} from 'foundry-design-protocol';

export interface StoredSession {
  token: string;
  changeSet: ChangeSet;
  verifications: VerificationResult[];
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

export class SessionStore {
  readonly root: string;

  constructor(root = defaultStoreRoot()) {
    this.root = root;
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
        screenshots: [],
        createdAt: now,
        updatedAt: now,
      },
      verifications: [],
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
        sessions.push({ changeSet: stored.changeSet, verifications: stored.verifications });
      } catch {
        // Ignore incomplete files from interrupted development sessions.
      }
    }
    return sessions.sort((a, b) => b.changeSet.updatedAt.localeCompare(a.changeSet.updatedAt));
  }

  async read(id: string): Promise<StoredSession> {
    if (!/^ses_[a-f0-9]+$/.test(id)) throw new Error('Invalid session id');
    const raw = JSON.parse(await readFile(join(this.root, `${id}.json`), 'utf8')) as StoredSession;
    return {
      token: String(raw.token),
      changeSet: changeSetSchema.parse(raw.changeSet),
      verifications: (raw.verifications ?? []).map((result) =>
        verificationResultSchema.parse(result),
      ),
    };
  }

  async addChange(
    id: string,
    input: Omit<DesignChange, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<DesignChange, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StoredSession> {
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

  async addVerifications(id: string, inputs: VerificationResult[]): Promise<StoredSession> {
    const stored = await this.read(id);
    const byChange = new Map(stored.verifications.map((item) => [item.changeId, item]));
    for (const input of inputs) {
      const parsed = verificationResultSchema.parse(input);
      byChange.set(parsed.changeId, parsed);
    }
    stored.verifications = [...byChange.values()];
    stored.changeSet.updatedAt = new Date().toISOString();
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
    };
    const target = join(this.root, `${stored.changeSet.sessionId}.json`);
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, target);
  }
}
