import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { SessionStore } from 'foundry-design-runtime';
import { detectPlatform } from './project.js';
import { FOUNDRY_MCP_PACKAGE_SPEC, FOUNDRY_VERSION } from './release.js';

export type DoctorStatus = 'passed' | 'warning' | 'failed';

export interface DoctorCheck {
  id:
    | 'project'
    | 'platform'
    | 'config'
    | 'integration'
    | 'instrumentation'
    | 'agent-configured'
    | 'agent-config-valid'
    | 'agent-version'
    | 'preview'
    | 'runtime'
    | 'agent-listening';
  label: string;
  status: DoctorStatus;
  detail: string;
}

export interface DoctorReport {
  version: string;
  projectRoot: string;
  checkedAt: string;
  ready: boolean;
  checks: DoctorCheck[];
  configuredAgentFiles: string[];
  activeSessionId?: string;
}

export interface DoctorOptions {
  home?: string;
  store?: SessionStore;
  fetcher?: typeof fetch;
}

async function text(path: string): Promise<string> {
  return readFile(path, 'utf8').catch(() => '');
}

async function available(fetcher: typeof fetch, url?: string): Promise<boolean> {
  if (!url) return false;
  return fetcher(url)
    .then((response) => response.ok)
    .catch(() => false);
}

export async function collectDoctorReport(
  projectRoot: string,
  options: DoctorOptions = {},
): Promise<DoctorReport> {
  const root = resolve(projectRoot);
  const home = options.home ?? homedir();
  const fetcher = options.fetcher ?? fetch;
  const store = options.store ?? new SessionStore();
  const platform = await detectPlatform(root);
  const configPath = join(root, '.foundry', 'foundry.config.json');
  const config = await text(configPath).then((content) => {
    try {
      return JSON.parse(content) as {
        platform?: string;
        framework?: string;
        targetUrl?: string;
        instrumented?: boolean;
      };
    } catch {
      return undefined;
    }
  });
  const manifest = await text(join(root, '.foundry', 'install-manifest.json')).then((content) => {
    try {
      return JSON.parse(content) as { generatorVersion?: string };
    } catch {
      return undefined;
    }
  });
  const candidateAgentFiles = [
    ...new Set([
      join(root, '.codex', 'config.toml'),
      join(root, '.cursor', 'mcp.json'),
      join(root, '.mcp.json'),
      join(home, '.codex', 'config.toml'),
      join(home, '.cursor', 'mcp.json'),
      join(home, '.claude.json'),
      join(home, '.mcp.json'),
    ]),
  ];
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
    await Promise.all(
      candidateAgentFiles.map(async (path) => ({ path, content: await text(path) })),
    )
  ).filter(({ content }) => content.includes('foundry-design-control'));
  const exactAgentFiles = agentFiles.filter(({ content }) =>
    content.includes(FOUNDRY_MCP_PACKAGE_SPEC),
  );
  const staleAgentFiles = agentFiles.filter(
    ({ content }) => !content.includes(FOUNDRY_MCP_PACKAGE_SPEC),
  );
  const runtimeHealthy = await available(fetcher, 'http://127.0.0.1:4387/v1/health');
  const sessions = await store.list().catch(() => []);
  const activeSession = [...sessions]
    .filter((session) => session.changeSet.context.projectRoot === root)
    .sort((left, right) => right.changeSet.updatedAt.localeCompare(left.changeSet.updatedAt))[0];
  let listening = false;
  let listenerDetail = 'No live agent listener for this project session.';
  if (runtimeHealthy && activeSession) {
    const stored = await store.read(activeSession.changeSet.sessionId).catch(() => undefined);
    if (stored) {
      const response = await fetcher(
        `http://127.0.0.1:4387/v1/sessions/${activeSession.changeSet.sessionId}/agent-presence`,
        { headers: { 'x-foundry-token': stored.token } },
      ).catch(() => undefined);
      const presence = response?.ok
        ? ((await response.json()) as {
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
      id: 'preview',
      label: 'Project preview',
      status:
        platform !== 'web' || (config?.targetUrl && (await available(fetcher, config.targetUrl)))
          ? 'passed'
          : config?.targetUrl
            ? 'warning'
            : 'failed',
      detail: config?.targetUrl ?? (platform === 'web' ? 'Not configured.' : 'Not required.'),
    },
    {
      id: 'runtime',
      label: 'Runtime',
      status: runtimeHealthy ? 'passed' : 'warning',
      detail: runtimeHealthy ? 'Healthy on 127.0.0.1:4387.' : 'Not running.',
    },
    {
      id: 'agent-listening',
      label: 'Active agent listener',
      status: listening ? 'passed' : 'warning',
      detail: listenerDetail,
    },
  ];
  return {
    version: FOUNDRY_VERSION,
    projectRoot: root,
    checkedAt: new Date().toISOString(),
    ready: checks.every((check) => check.status !== 'failed') && listening,
    checks,
    configuredAgentFiles: agentFiles.map(({ path }) => path),
    activeSessionId: activeSession?.changeSet.sessionId,
  };
}
