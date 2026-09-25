import type { SessionContext } from 'foundry-design-protocol';

interface SessionCandidate {
  changeSet: { sessionId: string; context: SessionContext; updatedAt: string };
}

/** No revision means compatibility is unknown, never permission to reuse a draft. */
export function selectResumableSession<T extends SessionCandidate>(
  sessions: T[],
  context: SessionContext,
): { resumable?: T; stale?: T } {
  const candidates = sessions
    .filter(
      (session) =>
        session.changeSet.context.projectRoot === context.projectRoot &&
        session.changeSet.context.platform === context.platform &&
        session.changeSet.context.targetUrl === context.targetUrl,
    )
    .sort((a, b) => b.changeSet.updatedAt.localeCompare(a.changeSet.updatedAt));
  const resumable = context.revision
    ? candidates.find((session) => session.changeSet.context.revision === context.revision)
    : undefined;
  return { resumable, stale: candidates.find((session) => session !== resumable) };
}

export function projectRuntimeUrl(configured?: string, port?: string): string {
  const url = new URL(configured ?? 'http://127.0.0.1:4387');
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  )
    throw new Error('Foundry runtime must use a loopback HTTP origin.');
  if (port !== undefined) {
    if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535)
      throw new Error('--runtime-port must be between 1024 and 65535.');
    url.port = port;
  }
  return url.origin;
}
