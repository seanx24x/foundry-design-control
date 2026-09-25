import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  PROTOCOL_VERSION,
  createReadinessReport,
  previewPresenceInputSchema,
  type ReadinessCheck,
  type PreviewPresenceInput,
  type VisualCheckReport,
  previewCommandSchema,
  projectDesignGraphSchema,
  renderChangePrompt,
  surfaceSnapshotSchema,
  type ApplyRunState,
  type ApplyRun,
  type ChangeSet,
  type DesignChange,
  type DesignChangeInput,
  type DeliveryRecord,
  type DesignOperationInput,
  type PreviewCommand,
  type ProjectDesignGraphInput,
  type SessionContext,
  type SurfaceSnapshot,
  type SourceFileSnapshot,
  type VerificationResult,
  type VisualAgentContext,
  type VisualAgentProposal,
  type VisualAgentRequest,
} from 'foundry-design-protocol';
import {
  SessionStore,
  previewCapabilityMatches,
  reviewedSourceFiles,
  reviewedSourceLocations,
  type ApplySourceProof,
  type ReviewedSourceLocation,
  type SourceChangedRange,
  type StoredSession,
} from './store.js';
import { GoogleFontsCatalog } from './google-fonts.js';
import packageJson from '../package.json' with { type: 'json' };

export interface RuntimeOptions {
  host?: string;
  port?: number;
  store?: SessionStore;
  googleFontsCatalog?: GoogleFontsCatalog;
  reindexProjectDesign?: (input: ReindexProjectDesignInput) => Promise<ProjectDesignGraphInput>;
  /** CLI owns filesystem/project knowledge. Runtime owns observed connection leases. */
  resolveProjectReadiness?: (projectRoot: string) => Promise<{
    checks: ReadinessCheck[];
    revision?: string;
  }>;
  listVisualCheckReports?: (projectRoot: string) => Promise<VisualCheckReport[]>;
  captureDeliveryEvidence?: (input: DeliveryCaptureRequest) => Promise<DeliveryCaptureResult>;
  readDeliveryEvidence?: (input: DeliveryEvidenceRequest) => Promise<Uint8Array>;
  resolveProjectRevision?: (input: {
    sessionId: string;
    projectRoot: string;
    sourcePaths: string[];
    sourceLocations: ReviewedSourceLocation[];
  }) => Promise<{
    supported: boolean;
    scope?: 'git' | 'mapped-files';
    revision: string | null;
    headRevision?: string;
    files?: SourceFileSnapshot[];
    changedRanges?: SourceChangedRange[];
    reason?: string;
  }>;
}

export interface DeliveryCaptureRequest {
  phase: 'before' | 'rebuilt';
  changeSet: ChangeSet;
  designGraph: ProjectDesignGraphInput | null;
  revision: string;
  applyRunId?: string;
  signal: AbortSignal;
}

export interface DeliveryCaptureResult {
  screenshots: ChangeSet['screenshots'];
  unavailable: string[];
}

export interface DeliveryEvidenceRequest {
  projectRoot: string;
  evidence: DeliveryRecord['evidence'][number];
}

export interface ReindexProjectDesignInput {
  sessionId: string;
  projectRoot: string;
  revision?: string;
  designGraphRevision?: string;
}

class RuntimeRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RuntimeRequestError';
  }
}

interface AgentPresence {
  agent: { name: string; version?: string; taskId?: string };
  listening: boolean;
  lastSeenAt: string;
  expiresAt: string;
  bridgeVersion?: string;
}

const inspectorRoot = dirname(
  fileURLToPath(import.meta.resolve('foundry-design-inspector/index.html')),
);
const adapterFile = fileURLToPath(import.meta.resolve('foundry-design-web-adapter'));

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(value));
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const next = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += next.byteLength;
    if (size > 8_000_000) throw new Error('Request body exceeds 8 MB');
    chunks.push(next);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function tokenFrom(request: IncomingMessage, url: URL): string | undefined {
  const header = request.headers['x-foundry-token'];
  return (Array.isArray(header) ? header[0] : header) ?? url.searchParams.get('token') ?? undefined;
}

function isLoopbackOrigin(value: string): boolean {
  try {
    const origin = new URL(value);
    return (
      (origin.protocol === 'http:' || origin.protocol === 'https:') &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)
    );
  } catch {
    return false;
  }
}

function applyCors(request: IncomingMessage, response: ServerResponse): boolean {
  const origin = request.headers.origin;
  if (origin && !isLoopbackOrigin(origin)) {
    sendJson(response, 403, {
      error: 'Foundry accepts browser requests only from loopback origins.',
    });
    return false;
  }
  if (origin) response.setHeader('access-control-allow-origin', origin);
  response.setHeader('access-control-allow-headers', 'content-type,x-foundry-token');
  response.setHeader('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  response.setHeader('vary', 'Origin');
  return true;
}

function publicApplyRun(run: ApplyRun): Omit<ApplyRun, 'claimCapabilityHash'> {
  const { claimCapabilityHash: _secret, ...visible } = run;
  return visible;
}

function publicVisualAgentRequest(
  request: VisualAgentRequest,
): Omit<VisualAgentRequest, 'claimCapabilityHash'> {
  const { claimCapabilityHash: _secret, ...visible } = request;
  return visible;
}

function publicSession(
  stored: Omit<StoredSession, 'token'>,
): Omit<StoredSession, 'token' | 'previewCapabilityHash'> {
  return {
    changeSet: stored.changeSet,
    verifications: stored.verifications,
    applyRuns: stored.applyRuns.map(publicApplyRun),
    designGraph: stored.designGraph,
    designBranches: stored.designBranches,
    designBranchRecords: stored.designBranchRecords,
    activeDesignBranchId: stored.activeDesignBranchId,
    visualAgentRequests: stored.visualAgentRequests.map(publicVisualAgentRequest),
    deliveryRecords: stored.deliveryRecords,
    documentationPages: stored.documentationPages,
    designHistory: stored.designHistory,
    deliveryMilestones: stored.deliveryMilestones,
  };
}

function reviewedPreviewOrigin(run: ApplyRun | undefined): string | undefined {
  const context = run?.reviewedChangeSet?.context;
  if (!context) return undefined;
  if (context.previewOrigin) return new URL(context.previewOrigin).origin;
  return context.targetUrl ? new URL(context.targetUrl).origin : undefined;
}

async function staticFile(pathname: string, response: ServerResponse): Promise<boolean> {
  if (pathname === '/adapter-bootstrap.js') {
    response.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(
      "import { installFoundryInspector } from '/adapter.js';\ninstallFoundryInspector();\n",
    );
    return true;
  }
  const path = pathname === '/' ? '/index.html' : pathname;
  const file = path === '/adapter.js' ? adapterFile : resolve(inspectorRoot, `.${path}`);
  if (file !== adapterFile && !file.startsWith(inspectorRoot)) return false;
  try {
    const content = await readFile(file);
    response.writeHead(200, {
      'content-type': contentTypes[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(content);
    return true;
  } catch {
    return false;
  }
}

export class FoundryRuntime {
  readonly host: string;
  readonly port: number;
  readonly store: SessionStore;
  readonly googleFontsCatalog: GoogleFontsCatalog;
  readonly reindexProjectDesign?: RuntimeOptions['reindexProjectDesign'];
  readonly resolveProjectRevision?: RuntimeOptions['resolveProjectRevision'];
  readonly resolveProjectReadiness?: RuntimeOptions['resolveProjectReadiness'];
  readonly listVisualCheckReports?: RuntimeOptions['listVisualCheckReports'];
  readonly captureDeliveryEvidence?: RuntimeOptions['captureDeliveryEvidence'];
  readonly readDeliveryEvidence?: RuntimeOptions['readDeliveryEvidence'];
  private previewPresence = new Map<
    string,
    Map<
      string,
      Omit<PreviewPresenceInput, 'previewCapability'> & {
        receivedAt: number;
        capabilityHash?: string;
      }
    >
  >();
  private projectReadinessCache = new Map<
    string,
    { at: number; value: Promise<{ checks: ReadinessCheck[]; revision?: string }> }
  >();
  private surfaces = new Map<string, SurfaceSnapshot>();
  private commands = new Map<string, PreviewCommand[]>();
  private agentPresence = new Map<string, AgentPresence>();
  private verificationChallenges = new Map<
    string,
    {
      sessionId: string;
      runId: string;
      claimAttemptId: string;
      origin: string;
      expiresAt: number;
    }
  >();
  private server = createServer((request, response) => void this.handle(request, response));

  constructor(options: RuntimeOptions = {}) {
    this.host = options.host ?? '127.0.0.1';
    this.port = options.port ?? 4387;
    this.store = options.store ?? new SessionStore();
    this.googleFontsCatalog = options.googleFontsCatalog ?? new GoogleFontsCatalog();
    this.reindexProjectDesign = options.reindexProjectDesign;
    this.resolveProjectRevision = options.resolveProjectRevision;
    this.resolveProjectReadiness = options.resolveProjectReadiness;
    this.listVisualCheckReports = options.listVisualCheckReports;
    this.captureDeliveryEvidence = options.captureDeliveryEvidence;
    this.readDeliveryEvidence = options.readDeliveryEvidence;
  }

  async start(): Promise<void> {
    await new Promise<void>((resolveStart, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.port, this.host, () => {
        this.server.off('error', reject);
        resolveStart();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server.listening) return;
    await new Promise<void>((resolveStop, reject) =>
      this.server.close((error) => (error ? reject(error) : resolveStop())),
    );
  }

  private async captureDelivery(
    input: Omit<DeliveryCaptureRequest, 'signal'>,
  ): Promise<DeliveryCaptureResult> {
    if (!this.captureDeliveryEvidence || input.changeSet.context.platform !== 'web')
      return { screenshots: [], unavailable: ['Visual capture is unavailable in this runtime.'] };
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.captureDeliveryEvidence({ ...input, signal: controller.signal }),
        new Promise<DeliveryCaptureResult>((resolveTimeout) => {
          timer = setTimeout(() => {
            controller.abort();
            resolveTimeout({
              screenshots: [],
              unavailable: [`${input.phase} screenshot capture exceeded the 20 second limit.`],
            });
          }, 20_000);
        }),
      ]);
    } catch (error) {
      return {
        screenshots: [],
        unavailable: [
          `${input.phase} screenshot unavailable: ${error instanceof Error ? error.message : 'capture failed'}`,
        ],
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async sourceProofForRun(stored: StoredSession, runId: string): Promise<ApplySourceProof> {
    const run = stored.applyRuns.find((candidate) => candidate.id === runId);
    if (!run) throw new RuntimeRequestError(`Unknown apply run: ${runId}`, 404);
    if (!run.reviewedChangeSet) {
      throw new RuntimeRequestError(
        'The frozen reviewed contract is unavailable. Review the changes again.',
        409,
      );
    }
    const sourcePaths = [
      ...reviewedSourceFiles(run.reviewedChangeSet),
      ...run.baselineSourceFiles.map((file) => file.path),
      ...run.appliedSourceFiles.map((file) => file.path),
    ];
    return this.resolveSourceProof(
      stored,
      sourcePaths,
      reviewedSourceLocations(run.reviewedChangeSet),
    );
  }

  private async resolveSourceProof(
    stored: StoredSession,
    sourcePaths: string[],
    sourceLocations: ReviewedSourceLocation[] = [],
  ): Promise<ApplySourceProof> {
    if (!this.resolveProjectRevision) {
      throw new RuntimeRequestError(
        'Apply requires a live project source resolver. Restart Foundry from the project CLI.',
        409,
      );
    }
    const resolved = await this.resolveProjectRevision({
      sessionId: stored.changeSet.sessionId,
      projectRoot: stored.changeSet.context.projectRoot,
      sourcePaths: [...new Set(sourcePaths)],
      sourceLocations,
    });
    if (!resolved.supported || !resolved.scope || !resolved.revision || !resolved.files) {
      throw new RuntimeRequestError(
        resolved.reason ?? 'Live project source proof is unavailable.',
        409,
      );
    }
    return {
      scope: resolved.scope,
      revision: resolved.revision,
      headRevision: resolved.headRevision,
      files: resolved.files,
      changedRanges: resolved.changedRanges,
    };
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      if (!applyCors(request, response)) return;
      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
      }
      const url = new URL(request.url ?? '/', `http://${this.host}:${this.port}`);
      const parts = url.pathname.split('/').filter(Boolean);

      if (request.method === 'GET' && url.pathname === '/v1/health') {
        sendJson(response, 200, {
          status: 'ok',
          protocolVersion: PROTOCOL_VERSION,
          version: packageJson.version,
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/v1/sessions') {
        sendJson(response, 200, {
          sessions: (await this.store.list()).map(publicSession),
        });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/v1/sessions') {
        const input = (await body(request)) as { context: SessionContext };
        const stored = await this.store.create(input.context);
        sendJson(response, 201, {
          ...publicSession(stored),
          token: stored.token,
        });
        return;
      }

      if (parts[0] === 'v1' && parts[1] === 'sessions' && parts[2]) {
        const id = parts[2];
        const stored = await this.store.authenticate(id, tokenFrom(request, url));
        if (request.method === 'GET' && parts.length === 3) {
          sendJson(response, 200, publicSession(stored));
          return;
        }
        if (request.method === 'GET' && parts[3] === 'visual-checks') {
          sendJson(response, 200, {
            supported: Boolean(this.listVisualCheckReports),
            reports: this.listVisualCheckReports
              ? await this.listVisualCheckReports(stored.changeSet.context.projectRoot)
              : [],
          });
          return;
        }
        if (request.method === 'POST' && parts[3] === 'preview-presence') {
          const input = previewPresenceInputSchema.parse(await body(request));
          const expectedOrigin =
            stored.changeSet.context.previewOrigin ??
            (stored.changeSet.context.targetUrl
              ? new URL(stored.changeSet.context.targetUrl).origin
              : undefined);
          if (
            !expectedOrigin ||
            request.headers.origin !== expectedOrigin ||
            !previewCapabilityMatches(stored.previewCapabilityHash, input.previewCapability)
          ) {
            throw new RuntimeRequestError(
              'Preview presence requires the configured origin and private preview capability.',
              403,
            );
          }
          const frames = this.previewPresence.get(id) ?? new Map();
          if (!input.connected) frames.delete(input.frameId);
          else {
            const { previewCapability: _capability, ...presence } = input;
            frames.set(input.frameId, {
              ...presence,
              receivedAt: Date.now(),
              capabilityHash: stored.previewCapabilityHash,
            });
          }
          for (const [key, frame] of frames)
            if (Date.now() - frame.receivedAt >= 5000) frames.delete(key);
          this.previewPresence.set(id, frames);
          sendJson(response, 200, { acknowledged: true, expiresInMs: 5000 });
          return;
        }
        if (request.method === 'GET' && parts[3] === 'readiness') {
          const root = stored.changeSet.context.projectRoot;
          let project = this.projectReadinessCache.get(root);
          if (!project || Date.now() - project.at >= 5000) {
            const value = this.resolveProjectReadiness
              ? Promise.race([
                  this.resolveProjectReadiness(root),
                  new Promise<never>((_resolve, reject) => {
                    const timer = setTimeout(
                      () => reject(new Error('Project readiness check timed out.')),
                      2500,
                    );
                    timer.unref();
                  }),
                ]).catch((error) => ({
                  checks: [
                    {
                      id: 'config',
                      label: 'Project configuration',
                      status: 'failed' as const,
                      detail:
                        error instanceof Error ? error.message : 'Project readiness unavailable.',
                      recovery: { id: 'start' as const, label: 'Restart from the project CLI' },
                    },
                  ],
                }))
              : Promise.resolve({
                  checks: [
                    {
                      id: 'config',
                      label: 'Project configuration',
                      status: 'warning' as const,
                      detail: 'Start Foundry from the project CLI to inspect its configuration.',
                      recovery: { id: 'start' as const, label: 'Start from the project CLI' },
                    },
                  ],
                });
            project = { at: Date.now(), value };
            this.projectReadinessCache.set(root, project);
          }
          const projectResult = await project.value;
          const now = Date.now();
          const frames = [...(this.previewPresence.get(id)?.values() ?? [])].filter(
            (frame) =>
              now - frame.receivedAt < 5000 &&
              frame.capabilityHash === stored.previewCapabilityHash,
          );
          const canvas = frames
            .filter((frame) => frame.frameKind === 'canvas')
            .sort((a, b) => b.receivedAt - a.receivedAt)[0];
          const nativeSurface = this.surfaces.get(id);
          const liveNative =
            stored.changeSet.context.platform !== 'web' &&
            nativeSurface &&
            now - Date.parse(nativeSurface.updatedAt) < 5000;
          const live = Boolean(canvas || liveNative);
          const mapped =
            canvas?.mappedTargetCount ??
            (liveNative ? nativeSurface.targets.filter((target) => target.source).length : 0);
          const presence = this.agentPresence.get(id);
          const listening = Boolean(presence?.listening && Date.parse(presence.expiresAt) > now);
          const current = Boolean(
            projectResult.revision && projectResult.revision === stored.changeSet.context.revision,
          );
          const hasRevision = Boolean(projectResult.revision && stored.changeSet.context.revision);
          const checks: ReadinessCheck[] = [
            ...projectResult.checks,
            {
              id: 'runtime',
              label: 'Runtime',
              status: 'passed',
              detail: `Foundry ${packageJson.version} is responding.`,
            },
            {
              id: 'preview-connection',
              label: 'Rendered preview',
              status: live ? 'passed' : 'warning',
              detail: live
                ? 'The rendered product has acknowledged a live connection.'
                : 'No live Canvas preview acknowledgement within five seconds.',
              recovery: live ? undefined : { id: 'retry-preview', label: 'Reconnect preview' },
            },
            {
              id: 'preview-version',
              label: 'Preview compatibility',
              status: canvas
                ? canvas.protocolVersion === PROTOCOL_VERSION &&
                  canvas.adapterVersion === packageJson.version
                  ? 'passed'
                  : 'failed'
                : liveNative
                  ? 'passed'
                  : 'warning',
              detail: canvas
                ? `Adapter ${canvas.adapterVersion}; protocol ${canvas.protocolVersion}. Runtime ${packageJson.version}; protocol ${PROTOCOL_VERSION}.`
                : liveNative
                  ? 'Native surface available.'
                  : 'Waiting for the preview version.',
              recovery:
                canvas &&
                (canvas.protocolVersion !== PROTOCOL_VERSION ||
                  canvas.adapterVersion !== packageJson.version)
                  ? { id: 'retry-preview', label: 'Reload the current adapter' }
                  : undefined,
            },
            {
              id: 'source-mapping',
              label: 'Source mapping',
              status: mapped > 0 ? 'passed' : 'warning',
              detail:
                mapped > 0
                  ? `${mapped} rendered targets carry source locations. Each edit still requires a resolved mapping in Review.`
                  : 'No rendered source locations reported. Inspecting remains available; source edits require instrumentation.',
              recovery:
                mapped > 0
                  ? undefined
                  : {
                      id: 'repair',
                      label: 'Check project instrumentation',
                      command: 'foundry-design doctor --repair',
                    },
            },
            {
              id: 'session-current',
              label: 'Session source',
              status: current ? 'passed' : hasRevision ? 'failed' : 'warning',
              detail: current
                ? 'Session matches the current project revision.'
                : hasRevision
                  ? 'Source changed since this session was captured. Draft changes are preserved; review against the current source before applying.'
                  : 'The current source revision could not be confirmed.',
              recovery: current
                ? undefined
                : {
                    id: 'resume',
                    label: 'Open a session for the current source',
                    command: 'foundry-design start',
                  },
            },
            {
              id: 'agent-listening',
              label: 'Active agent listener',
              status: listening ? 'passed' : 'warning',
              detail: listening
                ? `${presence!.agent.name} is actively listening.`
                : 'The agent is not listening. Open this project in your coding agent and ask it to keep listening for Foundry work.',
              recovery: listening
                ? undefined
                : {
                    id: 'restart-agent',
                    label: 'Reconnect the coding agent',
                    requiresAgentRestart: true,
                  },
            },
            {
              id: 'bridge-version',
              label: 'Active bridge version',
              status:
                listening && presence?.bridgeVersion === packageJson.version
                  ? 'passed'
                  : listening && presence?.bridgeVersion
                    ? 'failed'
                    : 'warning',
              detail:
                listening && presence?.bridgeVersion
                  ? `Bridge ${presence.bridgeVersion}; runtime ${packageJson.version}.`
                  : 'An active bridge has not reported its package version.',
              recovery:
                listening && presence?.bridgeVersion === packageJson.version
                  ? undefined
                  : {
                      id: 'restart-agent',
                      label: 'Restart the updated coding agent',
                      requiresAgentRestart: true,
                    },
            },
          ];
          sendJson(
            response,
            200,
            createReadinessReport({ projectRoot: root, sessionId: id, checks }),
          );
          return;
        }
        if (parts[3] === 'agent-presence') {
          if (request.method === 'GET') {
            const presence = this.agentPresence.get(id);
            const connected = Boolean(
              presence?.listening && Date.parse(presence.expiresAt) > Date.now(),
            );
            if (!connected) this.agentPresence.delete(id);
            sendJson(response, 200, {
              connected,
              presence: connected ? presence : null,
            });
            return;
          }
          if (request.method === 'POST') {
            const input = (await body(request)) as {
              agent: AgentPresence['agent'];
              listening?: boolean;
              ttlMs?: number;
              bridgeVersion?: string;
            };
            if (!input.agent?.name) throw new Error('Agent presence requires an agent name.');
            if (input.listening === false) {
              this.agentPresence.delete(id);
              sendJson(response, 200, { connected: false, presence: null });
              return;
            }
            const now = new Date();
            const ttlMs = Math.min(Math.max(input.ttlMs ?? 15_000, 5_000), 70_000);
            const presence: AgentPresence = {
              agent: input.agent,
              listening: true,
              lastSeenAt: now.toISOString(),
              expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
              bridgeVersion: input.bridgeVersion,
            };
            this.agentPresence.set(id, presence);
            sendJson(response, 200, { connected: true, presence });
            return;
          }
        }
        if (request.method === 'GET' && parts[3] === 'google-fonts') {
          const catalog = await this.googleFontsCatalog.search(
            url.searchParams.get('query') ?? '',
            Number(url.searchParams.get('limit') ?? 60),
          );
          sendJson(response, 200, catalog);
          return;
        }
        if (request.method === 'POST' && parts[3] === 'changes') {
          const updated = await this.store.addChange(id, (await body(request)) as never);
          sendJson(response, 201, publicSession(updated));
          return;
        }
        if (request.method === 'POST' && parts[3] === 'change-records') {
          const input = (await body(request)) as {
            operation: Omit<DesignOperationInput, 'id' | 'createdAt' | 'updatedAt' | 'changeIds'> &
              Partial<Pick<DesignOperationInput, 'id' | 'createdAt' | 'updatedAt'>>;
            change: Omit<DesignChangeInput, 'id' | 'createdAt' | 'updatedAt' | 'operationId'> &
              Partial<Pick<DesignChangeInput, 'id' | 'createdAt' | 'updatedAt' | 'operationId'>>;
          };
          const updated = await this.store.addOperationWithChange(id, input);
          sendJson(response, 201, publicSession(updated));
          return;
        }
        if (parts[3] === 'visual-agent-requests') {
          if (request.method === 'GET' && parts.length === 4) {
            const status = url.searchParams.get('status');
            sendJson(response, 200, {
              requests: status
                ? stored.visualAgentRequests
                    .filter((item) => item.status === status)
                    .map(publicVisualAgentRequest)
                : stored.visualAgentRequests.map(publicVisualAgentRequest),
            });
            return;
          }
          if (request.method === 'POST' && parts.length === 4) {
            const input = (await body(request)) as {
              title?: string;
              prompt: string;
              context: VisualAgentContext;
            };
            const updated = await this.store.createVisualAgentRequest(id, input);
            sendJson(response, 201, publicSession(updated));
            return;
          }
          const requestId = parts[4];
          if (requestId && request.method === 'GET' && parts.length === 5) {
            const visualRequest = stored.visualAgentRequests.find((item) => item.id === requestId);
            if (!visualRequest) throw new Error(`Unknown visual agent request: ${requestId}`);
            sendJson(response, 200, { request: publicVisualAgentRequest(visualRequest) });
            return;
          }
          if (requestId && request.method === 'POST' && parts[5] === 'claim') {
            const input = (await body(request)) as {
              agent: { name: string; version?: string; taskId?: string };
              ttlMs?: number;
            };
            const visualRequest = stored.visualAgentRequests.find((item) => item.id === requestId);
            if (!visualRequest) throw new Error(`Unknown visual agent request: ${requestId}`);
            if (visualRequest.status !== 'queued') {
              throw new RuntimeRequestError(
                'Visual request is no longer queued. Fetch the current request before claiming it.',
                409,
              );
            }
            const claimCapability = randomBytes(32).toString('base64url');
            const updated = await this.store.claimVisualAgentRequest(id, requestId, {
              ...input,
              claimCapability,
            });
            sendJson(response, 200, { ...publicSession(updated), claimCapability });
            return;
          }
          if (requestId && request.method === 'POST' && parts[5] === 'respond') {
            const input = (await body(request)) as {
              claimAttemptId: string;
              claimCapability?: string;
              message: string;
              proposals: Array<
                Omit<VisualAgentProposal, 'id' | 'createdAt' | 'updatedAt' | 'status'>
              >;
            };
            const updated = await this.store.respondToVisualAgentRequest(id, requestId, input);
            sendJson(response, 200, publicSession(updated));
            return;
          }
          if (requestId && request.method === 'POST' && parts[5] === 'heartbeat') {
            const input = (await body(request)) as {
              claimAttemptId: string;
              claimCapability?: string;
            };
            const updated = await this.store.heartbeatVisualAgentRequest(
              id,
              requestId,
              input.claimAttemptId,
              input.claimCapability,
            );
            sendJson(response, 200, publicSession(updated));
            return;
          }
          if (requestId && request.method === 'POST' && parts[5] === 'retry') {
            const updated = await this.store.retryVisualAgentRequest(id, requestId);
            sendJson(response, 200, publicSession(updated));
            return;
          }
          if (requestId && parts[5] === 'proposals' && parts[6] && request.method === 'POST') {
            const input = (await body(request)) as { action?: unknown };
            const action = input.action;
            if (
              action !== 'preview' &&
              action !== 'previewed' &&
              action !== 'promote' &&
              action !== 'reject'
            ) {
              throw new Error(`Unknown visual proposal action: ${String(action)}`);
            }
            const updated = await this.store.updateVisualAgentProposal(
              id,
              requestId,
              parts[6],
              action,
            );
            sendJson(response, 200, publicSession(updated));
            return;
          }
        }
        if (parts[3] === 'design-branches') {
          if (request.method === 'POST' && parts.length === 4) {
            const input = (await body(request)) as {
              name: string;
              sourceBranchId?: string;
              selections?: Array<{ branchId: string; changeIds: string[] }>;
            };
            const updated = input.selections
              ? await this.store.composeDesignBranch(id, {
                  name: input.name,
                  selections: input.selections,
                })
              : await this.store.createDesignBranch(id, {
                  name: input.name,
                  sourceBranchId: input.sourceBranchId,
                });
            sendJson(response, 201, publicSession(updated));
            return;
          }
          if (request.method === 'POST' && parts[4] === 'activate') {
            const input = (await body(request)) as { branchId?: string };
            const updated = await this.store.activateDesignBranch(id, input.branchId);
            sendJson(response, 200, publicSession(updated));
            return;
          }
          if (request.method === 'POST' && parts[4] && parts[5] === 'promote') {
            const updated = await this.store.promoteDesignBranch(id, parts[4]);
            sendJson(response, 200, publicSession(updated));
            return;
          }
          if (request.method === 'PATCH' && parts[4]) {
            const input = (await body(request)) as {
              name?: string;
              status?: 'exploring' | 'chosen' | 'rejected' | 'archived';
              rejectionReason?: string;
            };
            const updated = await this.store.updateDesignBranch(id, parts[4], input);
            sendJson(response, 200, publicSession(updated));
            return;
          }
        }
        if (parts[3] === 'design-branch-records') {
          if (request.method === 'POST' && parts.length === 4) {
            const updated = await this.store.importDesignBranchRecords(id, await body(request));
            sendJson(response, 200, publicSession(updated));
            return;
          }
          if (request.method === 'POST' && parts[4] && parts[5] === 'restore') {
            const updated = await this.store.restoreDesignBranchRecord(id, parts[4]);
            sendJson(response, 200, publicSession(updated));
            return;
          }
          if (request.method === 'DELETE' && parts[4]) {
            const updated = await this.store.removeDesignBranchRecord(id, parts[4]);
            sendJson(response, 200, publicSession(updated));
            return;
          }
        }
        if (parts[3] === 'design-graph') {
          if (request.method === 'GET') {
            sendJson(response, 200, { designGraph: stored.designGraph });
            return;
          }
          if (request.method === 'POST' && parts[4] === 'reindex') {
            if (!this.reindexProjectDesign) {
              throw new RuntimeRequestError(
                'Project design re-indexing is unavailable in this runtime.',
                501,
              );
            }
            const input = (await body(request)) as {
              expectedRevision?: string | null;
              expectedDesignGraphRevision?: string | null;
            };
            const revision = stored.changeSet.context.revision ?? null;
            const designGraphRevision =
              stored.designGraph?.revision ?? stored.designGraph?.indexedAt ?? null;
            if (input.expectedRevision !== undefined && input.expectedRevision !== revision) {
              throw new RuntimeRequestError(
                `Revision conflict: expected ${input.expectedRevision ?? 'unrecorded'}, found ${revision ?? 'unrecorded'}`,
                409,
              );
            }
            if (
              input.expectedDesignGraphRevision !== undefined &&
              input.expectedDesignGraphRevision !== designGraphRevision
            ) {
              throw new RuntimeRequestError(
                `Design graph revision conflict: expected ${input.expectedDesignGraphRevision ?? 'unrecorded'}, found ${designGraphRevision ?? 'unrecorded'}`,
                409,
              );
            }
            const graph = await this.reindexProjectDesign({
              sessionId: id,
              projectRoot: stored.changeSet.context.projectRoot,
              revision: stored.changeSet.context.revision,
              designGraphRevision: designGraphRevision ?? undefined,
            });
            let updated: StoredSession;
            try {
              updated = await this.store.setDesignGraph(id, graph, {
                expectedRevision: revision,
                expectedDesignGraphRevision: designGraphRevision,
              });
            } catch (error) {
              if (error instanceof Error && /revision conflict/i.test(error.message)) {
                throw new RuntimeRequestError(error.message, 409);
              }
              throw error;
            }
            sendJson(response, 200, {
              ...publicSession(updated),
              reindex: {
                previousDesignGraphRevision: designGraphRevision,
                designGraphRevision: updated.changeSet.designGraphRevision,
                revision: updated.designGraph?.revision,
              },
            });
            return;
          }
          if (request.method === 'POST' && parts.length === 4) {
            const graph = projectDesignGraphSchema.parse(await body(request));
            const updated = await this.store.setDesignGraph(id, graph);
            sendJson(response, 200, publicSession(updated));
            return;
          }
        }
        if (parts[3] === 'operations') {
          if (request.method === 'POST' && parts.length === 4) {
            const updated = await this.store.addOperation(
              id,
              (await body(request)) as Omit<DesignOperationInput, 'id' | 'createdAt' | 'updatedAt'>,
            );
            sendJson(response, 201, publicSession(updated));
            return;
          }
          if (request.method === 'PATCH' && parts[4]) {
            const input = (await body(request)) as { selectedMappingId: string };
            const updated = await this.store.resolveOperation(
              id,
              parts[4],
              input.selectedMappingId,
            );
            sendJson(response, 200, publicSession(updated));
            return;
          }
        }
        if (request.method === 'PATCH' && parts[3] === 'changes' && parts[4]) {
          const input = (await body(request)) as {
            status: 'draft' | 'approved' | 'applied' | 'rejected' | 'unresolved';
          };
          const legacyRun =
            input.status === 'applied'
              ? stored.applyRuns.filter(
                  (run) =>
                    run.legacyApplyCompatibility === true &&
                    run.state === 'verifying' &&
                    run.reviewedChangeSet?.changes.length === 1 &&
                    run.changeIds[0] === parts[4],
                )
              : [];
          const sourceProof =
            legacyRun.length === 1
              ? await this.sourceProofForRun(stored, legacyRun[0]!.id)
              : undefined;
          const updated = await this.store.setChangeStatus(id, parts[4], input.status, sourceProof);
          sendJson(response, 200, {
            ...publicSession(updated),
            ...(input.status === 'applied' ? { legacyApplyResultAcknowledged: true } : {}),
          });
          return;
        }
        if (request.method === 'DELETE' && parts[3] === 'changes' && parts[4]) {
          const { stored: updated, removedChange } = await this.store.deleteChange(id, parts[4]);
          sendJson(response, 200, { ...publicSession(updated), removedChange });
          return;
        }
        if (request.method === 'POST' && parts[3] === 'verify') {
          const input = (await body(request)) as {
            results: VerificationResult[];
            runId?: string;
            claimAttemptId?: string;
            claimCapability?: string;
            source?: 'browser-preview' | 'native-agent';
            challenge?: string;
          };
          if (!input.runId) {
            throw new RuntimeRequestError('Apply verification requires an explicit runId', 400);
          }
          if (!input.claimAttemptId) {
            throw new RuntimeRequestError(
              'Apply verification requires an explicit claimAttemptId',
              400,
            );
          }
          const verificationRun = stored.applyRuns.find((run) => run.id === input.runId);
          const requiresBrowserPreview =
            verificationRun?.reviewedChangeSet?.changes.some(
              (change) => change.target.platform === 'web',
            ) ?? stored.changeSet.context.platform === 'web';
          let authority: 'browser-preview' | 'native-agent' = 'native-agent';
          if (requiresBrowserPreview) {
            const targetUrl = verificationRun?.reviewedChangeSet?.context.targetUrl;
            if (!targetUrl) {
              throw new RuntimeRequestError(
                'Web apply verification requires a configured preview URL',
                409,
              );
            }
            const expectedOrigin =
              reviewedPreviewOrigin(verificationRun) ?? new URL(targetUrl).origin;
            const requestOrigin = request.headers.origin;
            if (input.source !== 'browser-preview' || requestOrigin !== expectedOrigin) {
              throw new RuntimeRequestError(
                `Web apply verification must come from the configured preview origin ${expectedOrigin}`,
                403,
              );
            }
            const challenge = input.challenge
              ? this.verificationChallenges.get(input.challenge)
              : undefined;
            if (
              !input.challenge ||
              !challenge ||
              challenge.sessionId !== id ||
              challenge.runId !== input.runId ||
              challenge.claimAttemptId !== input.claimAttemptId ||
              challenge.origin !== requestOrigin ||
              challenge.expiresAt < Date.now()
            ) {
              throw new RuntimeRequestError(
                'Web apply verification requires a fresh one-use preview challenge',
                403,
              );
            }
            this.verificationChallenges.delete(input.challenge);
            authority = 'browser-preview';
          }
          const sourceProof = await this.sourceProofForRun(stored, input.runId);
          let updated = await this.store.addVerifications(
            id,
            input.results,
            input.runId,
            input.claimAttemptId,
            authority,
            sourceProof,
            input.claimCapability,
          );
          const completed = updated.applyRuns.find((run) => run.id === input.runId);
          if (completed?.state === 'passed')
            this.projectReadinessCache.delete(updated.changeSet.context.projectRoot);
          if (
            completed?.state === 'passed' &&
            completed.reviewedChangeSet &&
            completed.appliedRevision
          ) {
            const capture = await this.captureDelivery({
              phase: 'rebuilt',
              changeSet: completed.reviewedChangeSet,
              designGraph: updated.designGraph,
              revision: completed.appliedRevision,
              applyRunId: completed.id,
            });
            try {
              const afterCapture = await this.sourceProofForRun(updated, completed.id);
              if (afterCapture.revision !== completed.appliedRevision)
                throw new Error('Source changed during rebuilt screenshot capture.');
            } catch (error) {
              capture.screenshots = [];
              capture.unavailable.push(
                `${error instanceof Error ? error.message : 'Source proof unavailable.'} No matched visual evidence was retained.`,
              );
            }
            updated = await this.store.attachDeliveryCapture(id, completed.id, capture);
          }
          sendJson(response, 200, publicSession(updated));
          return;
        }
        if (parts[3] === 'delivery-records') {
          if (request.method === 'GET' && parts[5] === 'evidence' && parts.length === 7) {
            const record = stored.deliveryRecords.find((candidate) => candidate.id === parts[4]);
            const index = /^(0|[1-9]\d*)$/.test(parts[6] ?? '') ? Number(parts[6]) : -1;
            const evidence = Number.isSafeInteger(index) ? record?.evidence[index] : undefined;
            if (!this.readDeliveryEvidence || !evidence?.capture) {
              sendJson(response, 404, { error: 'Delivery image evidence is unavailable.' });
              return;
            }
            try {
              const png = await this.readDeliveryEvidence({
                projectRoot: stored.changeSet.context.projectRoot,
                evidence,
              });
              response.writeHead(200, {
                'content-type': 'image/png',
                'content-length': png.byteLength,
                'cache-control': 'private, no-store',
                'x-content-type-options': 'nosniff',
              });
              response.end(png);
            } catch {
              sendJson(response, 404, {
                error: 'Delivery image evidence is unavailable or invalid.',
              });
            }
            return;
          }
          if (request.method === 'GET' && parts.length === 4) {
            sendJson(response, 200, { records: stored.deliveryRecords });
            return;
          }
          if (request.method === 'PATCH' && parts[4]) {
            const updated = await this.store.updateDeliveryRecord(
              id,
              parts[4],
              (await body(request)) as Parameters<SessionStore['updateDeliveryRecord']>[2],
            );
            sendJson(response, 200, publicSession(updated));
            return;
          }
        }
        if (parts[3] === 'documentation') {
          if (request.method === 'GET') {
            sendJson(response, 200, { pages: stored.documentationPages });
            return;
          }
          if (request.method === 'POST' && parts[4] === 'generate') {
            const updated = await this.store.generateDocumentation(id);
            sendJson(response, 200, publicSession(updated));
            return;
          }
          if (request.method === 'POST' && parts[4] === 'drift') {
            const input = (await body(request)) as { changedFiles?: string[] };
            const updated = await this.store.markDocumentationDrift(id, input.changedFiles ?? []);
            sendJson(response, 200, publicSession(updated));
            return;
          }
        }
        if (parts[3] === 'design-history' && request.method === 'GET') {
          sendJson(response, 200, { entries: stored.designHistory });
          return;
        }
        if (parts[3] === 'delivery-milestones') {
          if (request.method === 'GET' && parts.length === 4) {
            sendJson(response, 200, { milestones: stored.deliveryMilestones });
            return;
          }
          if (request.method === 'POST' && parts.length === 4) {
            const input = (await body(request)) as {
              name: string;
              summary?: string;
              entryIds?: string[];
            };
            const updated = await this.store.createDeliveryMilestone(id, input);
            sendJson(response, 201, publicSession(updated));
            return;
          }
          if (request.method === 'PATCH' && parts[4]) {
            const updated = await this.store.updateDeliveryMilestone(
              id,
              parts[4],
              (await body(request)) as Parameters<SessionStore['updateDeliveryMilestone']>[2],
            );
            sendJson(response, 200, publicSession(updated));
            return;
          }
        }
        if (parts[3] === 'apply-runs') {
          if (request.method === 'GET' && parts.length === 4) {
            const state = url.searchParams.get('state');
            sendJson(response, 200, {
              runs: state
                ? stored.applyRuns.filter((run) => run.state === state).map(publicApplyRun)
                : stored.applyRuns.map(publicApplyRun),
            });
            return;
          }
          if (request.method === 'POST' && parts[4] === 'apply-result' && parts.length === 5) {
            const input = (await body(request)) as { changeIds?: string[] };
            if (!input.changeIds?.length) {
              throw new RuntimeRequestError('Apply result requires reviewed change ids', 400);
            }
            const matches = stored.applyRuns.filter(
              (run) =>
                run.legacyApplyCompatibility === true &&
                ['rebuilding', 'verifying'].includes(run.state) &&
                run.changeIds.length === input.changeIds!.length &&
                run.changeIds.every((changeId) => input.changeIds!.includes(changeId)),
            );
            if (matches.length !== 1) {
              throw new RuntimeRequestError(
                'Legacy apply result must resolve to exactly one pre-1.3 active run.',
                409,
              );
            }
            const sourceProof = await this.sourceProofForRun(stored, matches[0]!.id);
            const resolved = await this.store.recordLegacyApplyResult(
              id,
              input.changeIds,
              sourceProof,
            );
            sendJson(response, 200, {
              ...publicSession(resolved.stored),
              applyResult: {
                acknowledged: true,
                runId: resolved.runId,
                claimAttemptId: resolved.claimAttemptId,
                changeIds: input.changeIds,
                resolvedFromLegacyInput: true,
              },
            });
            return;
          }
          if (request.method === 'POST' && parts.length === 4) {
            const input = (await body(request)) as {
              reviews: Array<{
                changeId: string;
                approved: boolean;
                after?: DesignChange['after'];
              }>;
              revision?: string | null;
              designGraphRevision?: string | null;
              retryOf?: string;
            };
            const approvedIds = input.reviews
              .filter((review) => review.approved)
              .map((review) => review.changeId);
            const approved = stored.changeSet.changes.filter((change) =>
              approvedIds.includes(change.id),
            );
            const operationIds = new Set(
              approved
                .map((change) => change.operationId)
                .filter((operationId): operationId is string => Boolean(operationId)),
            );
            const sourcePaths = reviewedSourceFiles({
              ...stored.changeSet,
              changes: approved,
              operations: stored.changeSet.operations.filter((operation) =>
                operationIds.has(operation.id),
              ),
            });
            const reviewedSubset = {
              ...stored.changeSet,
              changes: approved,
              operations: stored.changeSet.operations.filter((operation) =>
                operationIds.has(operation.id),
              ),
            };
            const currentSource = await this.resolveSourceProof(
              stored,
              sourcePaths,
              reviewedSourceLocations(reviewedSubset),
            );
            if (
              stored.changeSet.context.revision &&
              stored.changeSet.context.revision !== currentSource.revision
            ) {
              throw new RuntimeRequestError(
                'Project source changed after capture. Refresh the session before reviewing Apply.',
                409,
              );
            }
            const capture = currentSource.revision
              ? await this.captureDelivery({
                  phase: 'before',
                  changeSet: reviewedSubset,
                  designGraph: stored.designGraph,
                  revision: currentSource.revision,
                })
              : {
                  screenshots: [],
                  unavailable: ['Baseline screenshot requires an exact source revision.'],
                };
            const afterCapture = await this.resolveSourceProof(
              stored,
              sourcePaths,
              reviewedSourceLocations(reviewedSubset),
            );
            if (afterCapture.revision !== currentSource.revision)
              throw new RuntimeRequestError(
                'Source changed while capturing the review baseline. Review the current source before applying.',
                409,
              );
            const updated = await this.store.createApplyRun(id, {
              ...input,
              revision: currentSource.revision,
              designGraphRevision: stored.changeSet.designGraphRevision ?? null,
              baselineScreenshots: capture.screenshots,
              captureIssues: capture.unavailable,
            });
            sendJson(response, 201, publicSession(updated));
            return;
          }
          const runId = parts[4];
          if (runId && request.method === 'GET' && parts.length === 5) {
            const run = stored.applyRuns.find((candidate) => candidate.id === runId);
            if (!run) throw new Error(`Unknown apply run: ${runId}`);
            sendJson(response, 200, { run: publicApplyRun(run) });
            return;
          }
          if (runId && request.method === 'POST' && parts[5] === 'claim') {
            const input = (await body(request)) as {
              agent: { name: string; version?: string; taskId?: string };
              revision?: string | null;
              designGraphRevision?: string | null;
            };
            const queued = stored.applyRuns.find((candidate) => candidate.id === runId);
            if (!queued) throw new Error(`Unknown apply run: ${runId}`);
            if (queued.state !== 'queued') {
              throw new RuntimeRequestError('Apply run is no longer available to claim', 409);
            }
            const currentSource = await this.sourceProofForRun(stored, runId);
            const claimCapability = randomBytes(32).toString('base64url');
            const updated = await this.store.claimApplyRun(id, runId, {
              agent: input.agent,
              revision: currentSource.revision,
              designGraphRevision: stored.changeSet.designGraphRevision ?? null,
              sourceProof: currentSource,
              claimCapability,
            });
            sendJson(response, 200, {
              ...publicSession(updated),
              claimCapability,
              claimAuthority: {
                revision: 'server',
                designGraphRevision: 'server',
                callerRevisionFieldsDeprecated: true,
                callerRevision: input.revision ?? null,
                callerDesignGraphRevision: input.designGraphRevision ?? null,
              },
            });
            return;
          }
          if (runId && request.method === 'POST' && parts[5] === 'heartbeat') {
            const input = (await body(request)) as {
              claimAttemptId: string;
              claimCapability: string;
            };
            const updated = await this.store.heartbeatApplyRun(
              id,
              runId,
              input.claimAttemptId,
              input.claimCapability,
            );
            sendJson(response, 200, publicSession(updated));
            return;
          }
          if (runId && request.method === 'POST' && parts[5] === 'verification-challenge') {
            const input = (await body(request)) as {
              claimAttemptId?: string;
              previewCapability?: string;
            };
            const run = stored.applyRuns.find((candidate) => candidate.id === runId);
            if (
              !run ||
              run.state !== 'verifying' ||
              !input.claimAttemptId ||
              run.claimAttemptId !== input.claimAttemptId ||
              run.applyResultClaimAttemptId !== input.claimAttemptId ||
              !run.applyResultAcknowledgedAt
            ) {
              throw new RuntimeRequestError(
                'Verification challenge requires the acknowledged active Apply claim',
                409,
              );
            }
            const expectedOrigin = reviewedPreviewOrigin(run);
            if (
              !run.reviewedChangeSet?.changes.some((change) => change.target.platform === 'web') ||
              !expectedOrigin ||
              request.headers.origin !== expectedOrigin
            ) {
              throw new RuntimeRequestError(
                'Verification challenge is available only to the configured live preview origin',
                403,
              );
            }
            if (!previewCapabilityMatches(stored.previewCapabilityHash, input.previewCapability)) {
              throw new RuntimeRequestError(
                'Verification challenge requires the private capability issued to the live preview.',
                403,
              );
            }
            const challenge = `verify_${randomUUID().replaceAll('-', '')}`;
            this.verificationChallenges.set(challenge, {
              sessionId: id,
              runId,
              claimAttemptId: input.claimAttemptId,
              origin: expectedOrigin,
              expiresAt: Date.now() + 60_000,
            });
            sendJson(response, 201, { challenge, expiresInMs: 60_000 });
            return;
          }
          if (runId && request.method === 'POST' && parts[5] === 'apply-result') {
            const input = (await body(request)) as {
              claimAttemptId?: string;
              claimCapability?: string;
              changeIds?: string[];
            };
            if (!input.claimAttemptId) {
              throw new RuntimeRequestError(
                'Apply result requires an explicit claimAttemptId',
                400,
              );
            }
            if (!input.changeIds?.length) {
              throw new RuntimeRequestError('Apply result requires reviewed change ids', 400);
            }
            const sourceProof = await this.sourceProofForRun(stored, runId);
            const updated = await this.store.recordApplyResult(
              id,
              runId,
              input.claimAttemptId,
              input.changeIds,
              sourceProof,
              input.claimCapability ?? '',
            );
            sendJson(response, 200, {
              ...publicSession(updated),
              applyResult: {
                acknowledged: true,
                runId,
                claimAttemptId: input.claimAttemptId,
                changeIds: input.changeIds,
              },
            });
            return;
          }
          if (runId && request.method === 'POST' && parts[5] === 'retry') {
            if (!this.resolveProjectRevision) {
              throw new RuntimeRequestError(
                'Retry requires a live project revision resolver. Restart Foundry from the project CLI.',
                409,
              );
            }
            const currentRevision = await this.sourceProofForRun(stored, runId);
            const updated = await this.store.retryApplyRun(id, runId, {
              revision: currentRevision.revision,
              designGraphRevision: stored.changeSet.designGraphRevision ?? null,
            });
            sendJson(response, 201, publicSession(updated));
            return;
          }
          if (runId && request.method === 'POST' && parts[5] === 'resume') {
            const input = (await body(request)) as {
              expectedRevision: string | null;
              expectedDesignGraphRevision: string | null;
            };
            if (
              !Object.hasOwn(input, 'expectedRevision') ||
              !Object.hasOwn(input, 'expectedDesignGraphRevision')
            ) {
              throw new RuntimeRequestError(
                'Apply resume requires explicit expected source and design graph revisions',
                400,
              );
            }
            if (!this.resolveProjectRevision) {
              throw new RuntimeRequestError(
                'Resume requires a live project revision resolver. Restart Foundry from the project CLI.',
                409,
              );
            }
            const currentRevision = await this.sourceProofForRun(stored, runId);
            const updated = await this.store.authorizeApplyRunResume(id, runId, {
              ...input,
              currentRevision: currentRevision.revision,
              currentDesignGraphRevision: stored.changeSet.designGraphRevision ?? null,
            });
            sendJson(response, 200, publicSession(updated));
            return;
          }
          if (runId && request.method === 'POST' && parts[5] === 'cancel') {
            const updated = await this.store.updateApplyRun(id, runId, {
              state: 'cancelled',
            });
            sendJson(response, 200, publicSession(updated));
            return;
          }
          if (runId && request.method === 'PATCH' && parts.length === 5) {
            const input = (await body(request)) as {
              state?: ApplyRunState;
              message?: string;
              changedFiles?: string[];
              validationResults?: Array<{
                name: string;
                passed: boolean;
                summary?: string;
              }>;
              error?: string;
              claimAttemptId?: string;
              claimCapability?: string;
            };
            const validationSourceProof = input.validationResults
              ? await this.sourceProofForRun(stored, runId)
              : undefined;
            const updated = await this.store.updateApplyRun(
              id,
              runId,
              input,
              validationSourceProof,
            );
            sendJson(response, 200, publicSession(updated));
            return;
          }
        }
        if (request.method === 'GET' && parts[3] === 'surface') {
          sendJson(response, 200, { surface: this.surfaces.get(id) ?? null });
          return;
        }
        if (request.method === 'POST' && parts[3] === 'surface') {
          const surface = surfaceSnapshotSchema.parse(await body(request));
          this.surfaces.set(id, surface);
          sendJson(response, 202, {
            accepted: true,
            updatedAt: surface.updatedAt,
          });
          return;
        }
        if (request.method === 'GET' && parts[3] === 'commands') {
          const after = url.searchParams.get('after') ?? '';
          const commands = (this.commands.get(id) ?? []).filter(
            (command) => command.createdAt > after,
          );
          sendJson(response, 200, { commands });
          return;
        }
        if (request.method === 'POST' && parts[3] === 'preview') {
          const input = (await body(request)) as {
            targetId: string;
            property: string;
            value: unknown;
            change: never;
          };
          const command = previewCommandSchema.parse({
            id: `cmd_${randomUUID().replaceAll('-', '')}`,
            targetId: input.targetId,
            property: input.property,
            value: input.value,
            createdAt: new Date().toISOString(),
          });
          const queue = this.commands.get(id) ?? [];
          this.commands.set(id, [...queue.slice(-99), command]);
          const updated = await this.store.addChange(id, input.change);
          sendJson(response, 201, { command, session: publicSession(updated) });
          return;
        }
        if (request.method === 'GET' && parts[3] === 'export') {
          const format = url.searchParams.get('format') ?? 'json';
          if (format === 'prompt') {
            response.writeHead(200, {
              'content-type': 'text/markdown; charset=utf-8',
            });
            response.end(renderChangePrompt(stored.changeSet));
          } else if (format === 'full') {
            sendJson(response, 200, publicSession(stored));
          } else {
            sendJson(response, 200, stored.changeSet);
          }
          return;
        }
      }

      if (request.method === 'GET' && (await staticFile(url.pathname, response))) return;
      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown runtime error';
      const status =
        error instanceof RuntimeRequestError
          ? error.status
          : /token|Invalid session/.test(message)
            ? 401
            : /ENOENT/.test(message)
              ? 404
              : 400;
      sendJson(response, status, { error: message });
    }
  }
}
