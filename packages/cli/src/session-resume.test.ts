import assert from 'node:assert/strict';
import test from 'node:test';
import type { SessionContext } from 'foundry-design-protocol';
import { projectRuntimeUrl, selectResumableSession } from './session-resume.js';

const context: SessionContext = {
  projectRoot: '/project',
  revision: 'r1',
  platform: 'web',
  targetUrl: 'http://127.0.0.1:4390',
  theme: 'system',
  breakpoint: 'current',
  state: 'current',
};
const candidate = (
  sessionId: string,
  revision: string | undefined,
  updatedAt = '2026-09-15T00:00:00.000Z',
) => ({
  changeSet: { sessionId, context: { ...context, revision }, updatedAt },
  draft: ['preserved'],
});

test('resumes the newest compatible session without changing its draft; identifies incompatible source', () => {
  const old = candidate('old', 'old-revision');
  const compatible = candidate('compatible', 'r1');
  const latest = candidate('latest', 'r1', '2026-09-16T00:00:00.000Z');
  const sessions = [old, compatible, latest];
  const before = structuredClone(sessions);
  assert.equal(selectResumableSession(sessions, context).resumable, latest);
  assert.equal(
    selectResumableSession(sessions, { ...context, revision: 'changed' }).resumable,
    undefined,
  );
  assert.equal(selectResumableSession(sessions, { ...context, revision: 'changed' }).stale, latest);
  assert.equal(
    selectResumableSession([candidate('unknown', undefined)], { ...context, revision: undefined })
      .resumable,
    undefined,
  );
  assert.equal(
    selectResumableSession(sessions, { ...context, projectRoot: '/another' }).stale,
    undefined,
  );
  assert.deepEqual(sessions, before);
});

test('runtime port overrides remain loopback and do not accept unsafe or ambiguous URLs', () => {
  assert.equal(projectRuntimeUrl(undefined, '4487'), 'http://127.0.0.1:4487');
  assert.equal(projectRuntimeUrl('http://localhost:4487'), 'http://localhost:4487');
  assert.throws(() => projectRuntimeUrl('https://example.com'));
  assert.throws(() => projectRuntimeUrl('http://user:pass@localhost:4387'));
  assert.throws(() => projectRuntimeUrl(undefined, '-1'));
  assert.throws(() => projectRuntimeUrl(undefined, '4487evil'));
});
