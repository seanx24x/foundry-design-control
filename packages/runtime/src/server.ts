import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  PROTOCOL_VERSION,
  previewCommandSchema,
  projectDesignGraphSchema,
  renderChangePrompt,
  surfaceSnapshotSchema,
  type ApplyRunState,
  type DesignChange,
  type DesignOperationInput,
  type PreviewCommand,
  type SessionContext,
  type SurfaceSnapshot,
  type VerificationResult,
} from 'foundry-design-protocol';
import { SessionStore, type StoredSession } from './store.js';

export interface RuntimeOptions {
  host?: string;
  port?: number;
  store?: SessionStore;
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

function applyCors(request: IncomingMessage, response: ServerResponse): boolean {
  const origin = request.headers.origin;
  if (origin && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    sendJson(response, 403, {
      error: 'Foundry accepts browser requests only from loopback origins.',
    });
    return false;
  }
  if (origin) response.setHeader('access-control-allow-origin', origin);
  response.setHeader('access-control-allow-headers', 'content-type,x-foundry-token');
  response.setHeader('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
  response.setHeader('vary', 'Origin');
  return true;
}

function publicSession(stored: StoredSession): Omit<StoredSession, 'token'> {
  return {
    changeSet: stored.changeSet,
    verifications: stored.verifications,
    applyRuns: stored.applyRuns,
    designGraph: stored.designGraph,
  };
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
  private surfaces = new Map<string, SurfaceSnapshot>();
  private commands = new Map<string, PreviewCommand[]>();
  private server = createServer((request, response) => void this.handle(request, response));

  constructor(options: RuntimeOptions = {}) {
    this.host = options.host ?? '127.0.0.1';
    this.port = options.port ?? 4387;
    this.store = options.store ?? new SessionStore();
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
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/v1/sessions') {
        sendJson(response, 200, { sessions: await this.store.list() });
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
        if (request.method === 'POST' && parts[3] === 'changes') {
          const updated = await this.store.addChange(id, (await body(request)) as never);
          sendJson(response, 201, publicSession(updated));
          return;
        }
        if (parts[3] === 'design-graph') {
          if (request.method === 'GET') {
            sendJson(response, 200, { designGraph: stored.designGraph });
            return;
          }
          if (request.method === 'POST') {
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
          const updated = await this.store.setChangeStatus(id, parts[4], input.status);
          sendJson(response, 200, publicSession(updated));
          return;
        }
        if (request.method === 'POST' && parts[3] === 'verify') {
          const input = (await body(request)) as {
            results: VerificationResult[];
            runId?: string;
          };
          const updated = await this.store.addVerifications(id, input.results, input.runId);
          sendJson(response, 200, publicSession(updated));
          return;
        }
        if (parts[3] === 'apply-runs') {
          if (request.method === 'GET' && parts.length === 4) {
            const state = url.searchParams.get('state');
            sendJson(response, 200, {
              runs: state
                ? stored.applyRuns.filter((run) => run.state === state)
                : stored.applyRuns,
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
              revision?: string;
              retryOf?: string;
            };
            const updated = await this.store.createApplyRun(id, input);
            sendJson(response, 201, publicSession(updated));
            return;
          }
          const runId = parts[4];
          if (runId && request.method === 'GET' && parts.length === 5) {
            const run = stored.applyRuns.find((candidate) => candidate.id === runId);
            if (!run) throw new Error(`Unknown apply run: ${runId}`);
            sendJson(response, 200, { run });
            return;
          }
          if (runId && request.method === 'POST' && parts[5] === 'claim') {
            const input = (await body(request)) as {
              agent: { name: string; version?: string; taskId?: string };
              revision?: string;
              designGraphRevision?: string;
            };
            const updated = await this.store.claimApplyRun(id, runId, input);
            sendJson(response, 200, publicSession(updated));
            return;
          }
          if (runId && request.method === 'POST' && parts[5] === 'retry') {
            const updated = await this.store.retryApplyRun(id, runId);
            sendJson(response, 201, publicSession(updated));
            return;
          }
          if (runId && request.method === 'POST' && parts[5] === 'cancel') {
            const updated = await this.store.updateApplyRun(id, runId, {
              state: 'cancelled',
              message: 'Apply run cancelled by the user.',
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
            };
            const updated = await this.store.updateApplyRun(id, runId, input);
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
      const status = /token|Invalid session/.test(message)
        ? 401
        : /ENOENT/.test(message)
          ? 404
          : 400;
      sendJson(response, status, { error: message });
    }
  }
}
