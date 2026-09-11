import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, stat, unlink, type FileHandle } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export interface SessionFileLockOwner {
  pid: number;
  createdAt: string;
  nonce: string;
}

export interface SessionFileLockOptions {
  timeoutMs?: number;
  retryDelayMs?: number;
  staleMs?: number;
  signal?: AbortSignal;
  isProcessAlive?: (pid: number) => boolean;
  now?: () => Date;
}

export interface SessionFileLock {
  path: string;
  owner: SessionFileLockOwner;
  release(): Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRY_DELAY_MS = 25;
const DEFAULT_STALE_MS = 30_000;

export class SessionFileLockTimeoutError extends Error {
  readonly code = 'FOUNDRY_SESSION_LOCK_TIMEOUT';
  readonly lockPath: string;
  readonly timeoutMs: number;
  readonly owner?: SessionFileLockOwner;

  constructor(lockPath: string, timeoutMs: number, owner?: SessionFileLockOwner) {
    super(
      `Timed out after ${timeoutMs}ms waiting for the session lock ${lockPath}` +
        (owner ? ` held by process ${owner.pid}` : ''),
    );
    this.name = 'SessionFileLockTimeoutError';
    this.lockPath = lockPath;
    this.timeoutMs = timeoutMs;
    this.owner = owner;
  }
}

export function sessionFileLockPath(sessionPath: string): string {
  return `${sessionPath}.lock`;
}

function isAlreadyExists(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'EEXIST';
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'EPERM';
  }
}

function parseOwner(value: string): SessionFileLockOwner | undefined {
  try {
    const candidate = JSON.parse(value) as Partial<SessionFileLockOwner>;
    if (
      !Number.isSafeInteger(candidate.pid) ||
      candidate.pid! <= 0 ||
      typeof candidate.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(candidate.createdAt)) ||
      typeof candidate.nonce !== 'string' ||
      candidate.nonce.length === 0
    ) {
      return undefined;
    }
    return {
      pid: candidate.pid,
      createdAt: candidate.createdAt,
      nonce: candidate.nonce,
    } as SessionFileLockOwner;
  } catch {
    return undefined;
  }
}

async function readOwner(lockPath: string): Promise<SessionFileLockOwner | undefined> {
  try {
    return parseOwner(await readFile(lockPath, 'utf8'));
  } catch (error) {
    if (isMissing(error)) return undefined;
    return undefined;
  }
}

async function removeIfOwned(lockPath: string, owner: SessionFileLockOwner): Promise<void> {
  let current: SessionFileLockOwner | undefined;
  try {
    current = parseOwner(await readFile(lockPath, 'utf8'));
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  if (current?.nonce !== owner.nonce) return;
  try {
    await unlink(lockPath);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

async function reclaimOrphanedLock(
  lockPath: string,
  staleMs: number,
  now: Date,
  isProcessAlive: (pid: number) => boolean,
): Promise<SessionFileLockOwner | undefined> {
  let contents: string;
  let modifiedAt: number;
  try {
    [contents, modifiedAt] = await Promise.all([
      readFile(lockPath, 'utf8'),
      stat(lockPath).then((entry) => entry.mtimeMs),
    ]);
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }

  const owner = parseOwner(contents);
  if (owner && isProcessAlive(owner.pid)) return owner;

  const oldEnoughToBeOrphaned = now.getTime() - modifiedAt >= staleMs;
  if (owner || oldEnoughToBeOrphaned) {
    try {
      await unlink(lockPath);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
  return owner;
}

async function createLock(
  lockPath: string,
  owner: SessionFileLockOwner,
): Promise<FileHandle | undefined> {
  let handle: FileHandle;
  try {
    handle = await open(lockPath, 'wx', 0o600);
  } catch (error) {
    if (isAlreadyExists(error)) return undefined;
    throw error;
  }
  try {
    await handle.writeFile(`${JSON.stringify(owner)}\n`, 'utf8');
    await handle.sync();
    return handle;
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(lockPath).catch(() => undefined);
    throw error;
  }
}

export async function acquireSessionFileLock(
  sessionPath: string,
  options: SessionFileLockOptions = {},
): Promise<SessionFileLock> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
  if (timeoutMs < 0 || retryDelayMs <= 0 || staleMs < 0) {
    throw new RangeError(
      'Session lock timing values must be non-negative with a positive retry delay',
    );
  }

  const now = options.now ?? (() => new Date());
  const isProcessAlive = options.isProcessAlive ?? defaultIsProcessAlive;
  const lockPath = sessionFileLockPath(sessionPath);
  const startedAt = Date.now();
  let observedOwner: SessionFileLockOwner | undefined;
  await mkdir(dirname(lockPath), { recursive: true });

  while (true) {
    options.signal?.throwIfAborted();
    const owner: SessionFileLockOwner = {
      pid: process.pid,
      createdAt: now().toISOString(),
      nonce: randomUUID(),
    };
    const handle = await createLock(lockPath, owner);
    if (handle) {
      let released = false;
      return {
        path: lockPath,
        owner,
        async release() {
          if (released) return;
          released = true;
          await handle.close();
          await removeIfOwned(lockPath, owner);
        },
      };
    }

    observedOwner = await reclaimOrphanedLock(lockPath, staleMs, now(), isProcessAlive);
    if (Date.now() - startedAt >= timeoutMs) {
      throw new SessionFileLockTimeoutError(lockPath, timeoutMs, observedOwner);
    }
    await delay(
      Math.min(retryDelayMs, Math.max(1, timeoutMs - (Date.now() - startedAt))),
      undefined,
      {
        signal: options.signal,
      },
    );
  }
}

export async function withSessionFileLock<T>(
  sessionPath: string,
  operation: () => T | Promise<T>,
  options: SessionFileLockOptions = {},
): Promise<T> {
  const lock = await acquireSessionFileLock(sessionPath, options);
  try {
    return await operation();
  } finally {
    await lock.release();
  }
}
