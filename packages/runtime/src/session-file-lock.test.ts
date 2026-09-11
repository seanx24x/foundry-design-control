import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import test from 'node:test';
import {
  SessionFileLockTimeoutError,
  acquireSessionFileLock,
  sessionFileLockPath,
  withSessionFileLock,
} from './session-file-lock.js';

interface ChildEvent {
  user: string;
  event: 'enter' | 'exit';
  at: string;
}

function startIndependentLockUser(
  sessionPath: string,
  user: string,
  holdMs: number,
): { entered: Promise<void>; completed: Promise<ChildEvent[]> } {
  const moduleUrl = pathToFileURL(
    join(dirname(fileURLToPath(import.meta.url)), 'session-file-lock.ts'),
  ).href;
  const script = `
    import { withSessionFileLock } from ${JSON.stringify(moduleUrl)};
    const [sessionPath, user, holdMs] = process.argv.slice(1);
    await withSessionFileLock(sessionPath, async () => {
      console.log(JSON.stringify({ user, event: 'enter', at: process.hrtime.bigint().toString() }));
      await new Promise((resolve) => setTimeout(resolve, Number(holdMs)));
      console.log(JSON.stringify({ user, event: 'exit', at: process.hrtime.bigint().toString() }));
    }, { timeoutMs: 5_000, retryDelayMs: 5, staleMs: 5_000 });
  `;
  const child = spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      script,
      '--',
      sessionPath,
      user,
      `${holdMs}`,
    ],
    { cwd: dirname(fileURLToPath(import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const events: ChildEvent[] = [];
  let resolveEntered: (() => void) | undefined;
  const entered = new Promise<void>((resolve) => {
    resolveEntered = resolve;
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    const event = JSON.parse(line) as ChildEvent;
    events.push(event);
    if (event.event === 'enter') resolveEntered?.();
  });
  const completed = new Promise<ChildEvent[]>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve(events);
      else reject(new Error(`Lock user ${user} exited with ${code ?? signal}: ${stderr}`));
    });
  });
  return { entered, completed };
}

test('serializes two independent processes using the same session path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-session-lock-processes-'));
  const sessionPath = join(root, 'session.json');
  const first = startIndependentLockUser(sessionPath, 'first', 750);
  await first.entered;
  const second = startIndependentLockUser(sessionPath, 'second', 0);

  const [firstEvents, secondEvents] = await Promise.all([first.completed, second.completed]);
  assert.deepEqual(
    firstEvents.map(({ user, event }) => ({ user, event })),
    [
      { user: 'first', event: 'enter' },
      { user: 'first', event: 'exit' },
    ],
  );
  assert.deepEqual(
    secondEvents.map(({ user, event }) => ({ user, event })),
    [
      { user: 'second', event: 'enter' },
      { user: 'second', event: 'exit' },
    ],
  );
  assert.ok(BigInt(secondEvents[0]!.at) >= BigInt(firstEvents[1]!.at));
});

test('recovers a stale lock whose owning process is dead', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-session-lock-stale-'));
  const sessionPath = join(root, 'session.json');
  const lockPath = sessionFileLockPath(sessionPath);
  const oldDate = new Date('2000-01-01T00:00:00.000Z');
  await writeFile(
    lockPath,
    `${JSON.stringify({ pid: 2_147_483_647, createdAt: oldDate.toISOString(), nonce: 'dead' })}\n`,
  );
  await utimes(lockPath, oldDate, oldDate);

  let entered = false;
  await withSessionFileLock(
    sessionPath,
    () => {
      entered = true;
    },
    { timeoutMs: 200, retryDelayMs: 5, staleMs: 10, isProcessAlive: () => false },
  );
  assert.equal(entered, true);
  await assert.rejects(access(lockPath), { code: 'ENOENT' });
});

test('times out without evicting a live owner even when its lock is old', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-session-lock-live-'));
  const sessionPath = join(root, 'session.json');
  const lock = await acquireSessionFileLock(sessionPath);
  try {
    await assert.rejects(
      acquireSessionFileLock(sessionPath, {
        timeoutMs: 60,
        retryDelayMs: 5,
        staleMs: 0,
      }),
      (error: unknown) => {
        assert.ok(error instanceof SessionFileLockTimeoutError);
        assert.equal(error.owner?.pid, process.pid);
        assert.equal(error.code, 'FOUNDRY_SESSION_LOCK_TIMEOUT');
        return true;
      },
    );
    await access(lock.path);
  } finally {
    await lock.release();
  }
  await assert.rejects(access(lock.path), { code: 'ENOENT' });
});

test('releases the lock when the protected operation throws', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-session-lock-finally-'));
  const sessionPath = join(root, 'session.json');
  await assert.rejects(
    withSessionFileLock(sessionPath, () => {
      throw new Error('operation failed');
    }),
    /operation failed/,
  );
  await assert.rejects(access(sessionFileLockPath(sessionPath)), { code: 'ENOENT' });
});
