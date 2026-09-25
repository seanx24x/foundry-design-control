import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { SessionStore } from 'foundry-design-runtime';
import { detectPlatform } from './project.js';
import { FOUNDRY_MCP_PACKAGE_SPEC, FOUNDRY_VERSION } from './release.js';
import {
  createReadinessReport,
  readinessReportSchema,
  type ReadinessReport,
  type ReadinessRecovery,
} from 'foundry-design-protocol';

export type DoctorStatus = 'passed' | 'warning' | 'failed';

export interface DoctorCheck {
  id: string;
  label: string;
  status: DoctorStatus;
  detail: string;
  recovery?: ReadinessRecovery;
}

export interface DoctorReport {
  version: string;
  projectRoot: string;
  checkedAt: string;
  ready: boolean;
  checks: DoctorCheck[];
  configuredAgentFiles: string[];
  activeSessionId?: string;
  readiness: ReadinessReport;
}

export interface DoctorOptions {
  home?: string;
  store?: SessionStore;
  fetcher?: typeof fetch;
  runtimeUrl?: string;
  timeoutMs?: number;
  /** Used by the CLI-owned runtime callback; avoids recursive runtime requests. */
  projectOnly?: boolean;
}

async function text(path: string): Promise<string> {
  return readFile(path, 'utf8').catch(() => '');
}

async function boundedFetch(
  fetcher: typeof fetch,
  url: string,
  timeoutMs: number,
  init: RequestInit = {},
): Promise<Response | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    return await Promise.race([
      fetcher(url, { ...init, signal: controller.signal }),
      new Promise<undefined>((resolveTimeout) => {
        timer = setTimeout(() => {
          controller.abort();
          resolveTimeout(undefined);
        }, timeoutMs);
      }),
    ]);
  } catch {
    return undefined;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function available(fetcher: typeof fetch, timeoutMs: number, url?: string): Promise<boolean> {
  if (!url) return false;
  return Boolean((await boundedFetch(fetcher, url, timeoutMs))?.ok);
}

export async function collectDoctorReport(
  projectRoot: string,
  options: DoctorOptions = {},
): Promise<DoctorReport> {
  const root = resolve(projectRoot);
  const home = options.home ?? homedir();
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 1500;
  const store = options.store ?? new SessionStore();
  const platform = await detectPlatform(root);
  const configPath = join(root, '.foundry', 'foundry.config.json');
  const config = await text(configPath).then((content) => {
    try {
      return JSON.parse(content) as {
        platform?: string;
        framework?: string;
        targetUrl?: string;
        runtimeUrl?: string;
        instrumented?: boolean;
        connection?: { mode?: 'global' | 'project' };
      };
    } catch {
      return undefined;
    }
  });
  const manifest = await text(join(root, '.foundry', 'install-manifest.json')).then((content) => {
    try {
      return JSON.parse(content) as {
        generatorVersion?: string;
        connectionMode?: 'global' | 'project';
        agents?: string[];
      };
    } catch {
      return undefined;
    }
  });
  const hostAgentFiles = [
    ...new Set([
      join(home, '.codex', 'config.toml'),
      join(home, '.cursor', 'mcp.json'),
      join(home, '.claude.json'),
    ]),
  ];
  const projectAgentFiles = [
    join(root, '.codex', 'config.toml'),
    join(root, '.cursor', 'mcp.json'),
    join(root, '.mcp.json'),
  ].filter((path) => !hostAgentFiles.includes(path));
  const schemaCheckedAgentFiles = [
    ...new Set([
      join(root, '.cursor', 'mcp.json'),
      join(root, '.mcp.json'),
      join(home, '.cursor', 'mcp.json'),
      join(home, '.mcp.json'),
    ]),
  ];
  const invalidAgentFiles = (
    await Promise.all(
      schemaCheckedAgentFiles.map(async (path) => {
        const content = await text(path);
        if (!content) return undefined;
        try {
          const parsed = JSON.parse(content) as { mcpServers?: unknown };
          return parsed.mcpServers && typeof parsed.mcpServers === 'object' ? undefined : path;
        } catch {
          return path;
        }
      }),
    )
  ).filter((path): path is string => Boolean(path));
  const agentFiles = (
    await Promise.all(hostAgentFiles.map(async (path) => ({ path, content: await text(path) })))
  ).filter(({ content }) => content.includes('foundry-design-control'));
  const legacyAgentFiles = (
    await Promise.all(projectAgentFiles.map(async (path) => ({ path, content: await text(path) })))
  ).filter(({ content }) => content.includes('foundry-design-control'));
  const exactAgentFiles = agentFiles.filter(({ content }) =>
    content.includes(FOUNDRY_MCP_PACKAGE_SPEC),
  );
  const staleAgentFiles = agentFiles.filter(
    ({ content }) => !content.includes(FOUNDRY_MCP_PACKAGE_SPEC),
  );
  const runtimeUrl = (options.runtimeUrl ?? config?.runtimeUrl ?? 'http://127.0.0.1:4387').replace(
    /\/$/,
    '',
  );
  const runtimeHealthy =
    !options.projectOnly && (await available(fetcher, timeoutMs, `${runtimeUrl}/v1/health`));
  const sessions = options.projectOnly ? [] : await store.list().catch(() => []);
  const activeSession = [...sessions]
    .filter((session) => session.changeSet.context.projectRoot === root)
    .sort((left, right) => right.changeSet.updatedAt.localeCompare(left.changeSet.updatedAt))[0];
  let listening = false;
  let listenerDetail = 'No live agent listener for this project session.';
  let runtimeReadiness: ReadinessReport | undefined;
  if (runtimeHealthy && activeSession) {
    const stored = await store.read(activeSession.changeSet.sessionId).catch(() => undefined);
    if (stored) {
      const readinessResponse = await boundedFetch(
        fetcher,
        `${runtimeUrl}/v1/sessions/${activeSession.changeSet.sessionId}/readiness`,
        timeoutMs,
        { headers: { 'x-foundry-token': stored.token } },
      );
      if (readinessResponse?.ok) {
        const parsed = readinessReportSchema.safeParse(
          await readinessResponse.json().catch(() => null),
        );
        if (
          parsed.success &&
          parsed.data.projectRoot === root &&
          parsed.data.sessionId === activeSession.changeSet.sessionId
        )
          runtimeReadiness = parsed.data;
      }
      const response = await boundedFetch(
        fetcher,
        `${runtimeUrl}/v1/sessions/${activeSession.changeSet.sessionId}/agent-presence`,
        timeoutMs,
        { headers: { 'x-foundry-token': stored.token } },
      );
      const presence = response?.ok
        ? ((await response.json().catch(() => ({}))) as {
            connected?: boolean;
            presence?: { agent?: { name?: string }; expiresAt?: string };
          })
        : undefined;
      listening = presence?.connected === true;
      if (listening) {
        listenerDetail = `${presence?.presence?.agent?.name ?? 'Agent'} is listening until ${presence?.presence?.expiresAt ?? 'the current lease expires'}.`;
      }
    }
  }
  const checks: DoctorCheck[] = [
    { id: 'project', label: 'Project', status: 'passed', detail: root },
    { id: 'platform', label: 'Detected platform', status: 'passed', detail: platform },
    {
      id: 'config',
      label: 'Foundry configuration',
      status: config ? 'passed' : 'failed',
      detail: config ? configPath : 'Not configured.',
    },
    {
      id: 'project-connection',
      label: 'Project connection',
      status:
        config && (config.connection?.mode === 'global' || manifest?.connectionMode === 'global')
          ? 'passed'
          : config
            ? 'warning'
            : 'failed',
      detail:
        config?.connection?.mode === 'global' || manifest?.connectionMode === 'global'
          ? 'Lightweight project connection using the shared agent bridge.'
          : config
            ? 'Legacy project connection. Run doctor --repair to migrate it.'
            : 'Not connected.',
    },
    {
      id: 'integration',
      label: 'Managed integration',
      status:
        manifest?.generatorVersion === FOUNDRY_VERSION
          ? 'passed'
          : manifest?.generatorVersion
            ? 'warning'
            : 'failed',
      detail: manifest?.generatorVersion ?? 'Not installed.',
    },
    {
      id: 'instrumentation',
      label: 'Instrumentation',
      status: config?.instrumented ? 'passed' : 'warning',
      detail: config?.instrumented
        ? `${config.framework ?? config.platform}`
        : 'Integration pending.',
    },
    {
      id: 'agent-configured',
      label: 'Agent configured',
      status: agentFiles.length ? 'passed' : 'failed',
      detail: agentFiles.length ? agentFiles.map(({ path }) => path).join(', ') : 'Not configured.',
    },
    {
      id: 'agent-config-valid',
      label: 'Agent configuration schema',
      status: invalidAgentFiles.length ? 'failed' : 'passed',
      detail: invalidAgentFiles.length
        ? `Invalid MCP configuration: ${invalidAgentFiles.join(', ')}.`
        : 'All detected MCP configuration files have an mcpServers record.',
    },
    {
      id: 'agent-version',
      label: 'Agent package version',
      status:
        exactAgentFiles.length === agentFiles.length && agentFiles.length
          ? 'passed'
          : agentFiles.length
            ? 'warning'
            : 'failed',
      detail: staleAgentFiles.length
        ? `Expected ${FOUNDRY_MCP_PACKAGE_SPEC}. Update: ${staleAgentFiles.map(({ path }) => path).join(', ')}`
        : exactAgentFiles.length
          ? FOUNDRY_MCP_PACKAGE_SPEC
          : `Expected ${FOUNDRY_MCP_PACKAGE_SPEC}.`,
    },
    {
      id: 'legacy-project-agent',
      label: 'Project-scoped agent configuration',
      status: legacyAgentFiles.length ? 'warning' : 'passed',
      detail: legacyAgentFiles.length
        ? `Foundry can migrate these legacy paths: ${legacyAgentFiles.map(({ path }) => path).join(', ')}`
        : 'None. Agent integration is owned at machine level.',
    },
    {
      id: 'preview',
      label: 'Project preview',
      status:
        platform !== 'web' ||
        (!options.projectOnly &&
          config?.targetUrl &&
          (await available(fetcher, timeoutMs, config.targetUrl)))
          ? 'passed'
          : config?.targetUrl
            ? 'warning'
            : 'failed',
      detail: config?.targetUrl
        ? `${config.targetUrl}. HTTP availability does not confirm the rendered adapter connection.`
        : platform === 'web'
          ? 'Not configured.'
          : 'Not required.',
    },
    {
      id: 'runtime',
      label: 'Runtime',
      status: runtimeHealthy ? 'passed' : 'warning',
      detail: runtimeHealthy ? `Healthy at ${runtimeUrl}.` : `Not responding at ${runtimeUrl}.`,
    },
    {
      id: 'agent-listening',
      label: 'Active agent listener',
      status: listening ? 'passed' : 'warning',
      detail: listenerDetail,
    },
  ];
  const staticChecks = checks
    .filter((check) => !['preview', 'runtime', 'agent-listening'].includes(check.id))
    .map((check): DoctorCheck => ({
      ...check,
      recovery:
        check.status === 'passed'
          ? undefined
          : {
              id: 'repair',
              label: 'Repair project integration',
              command: `foundry-design doctor --project ${JSON.stringify(root)} --repair`,
            },
    }));
  const readiness =
    runtimeReadiness ??
    createReadinessReport({
      projectRoot: root,
      sessionId: activeSession?.changeSet.sessionId,
      checks: options.projectOnly
        ? staticChecks
        : [
            ...staticChecks,
            ...checks.filter((check) =>
              ['preview', 'runtime', 'agent-listening'].includes(check.id),
            ),
            {
              id: 'preview-connection',
              label: 'Rendered preview',
              status: 'warning',
              detail: 'No authenticated rendered-preview acknowledgement is available.',
              recovery: {
                id: activeSession ? 'retry-preview' : 'start',
                label: activeSession ? 'Reconnect preview' : 'Start Foundry',
                command: 'foundry-design start',
              },
            },
            {
              id: 'source-mapping',
              label: 'Source mapping',
              status: 'warning',
              detail: 'Waiting for rendered source mapping evidence.',
            },
            {
              id: 'session-current',
              label: 'Session source',
              status: 'warning',
              detail: 'The current source revision has not been confirmed.',
              recovery: {
                id: 'resume',
                label: 'Resume this project',
                command: 'foundry-design start',
              },
            },
            {
              id: 'bridge-version',
              label: 'Active bridge version',
              status: 'warning',
              detail: 'Waiting for a connected bridge to report its package version.',
            },
          ],
    });
  return {
    version: FOUNDRY_VERSION,
    projectRoot: root,
    checkedAt: new Date().toISOString(),
    ready: readiness.ready,
    checks: readiness.checks,
    readiness,
    configuredAgentFiles: agentFiles.map(({ path }) => path),
    activeSessionId: activeSession?.changeSet.sessionId,
  };
}
