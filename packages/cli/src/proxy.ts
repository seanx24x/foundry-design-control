import { createServer, request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { AddressInfo, Socket } from 'node:net';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

export function injectFoundryBootstrap(html: string, runtimeUrl: string): string {
  const tag = `<script src="${runtimeUrl}/adapter-bootstrap.js" data-foundry-basic-mode></script>`;
  if (html.includes('data-foundry-basic-mode')) return html;
  return html.includes('</head>') ? html.replace('</head>', `${tag}</head>`) : `${tag}${html}`;
}

function requestHeaders(request: IncomingMessage, target: URL): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (value == null || HOP_BY_HOP.has(name.toLowerCase())) continue;
    headers[name] = value;
  }
  headers.host = target.host;
  return headers;
}

export interface BasicPreviewProxy {
  url: string;
  stop(): Promise<void>;
}

export async function startBasicPreviewProxy(
  targetInput: string,
  runtimeUrl: string,
): Promise<BasicPreviewProxy> {
  const targetBase = new URL(targetInput);
  if (!['http:', 'https:'].includes(targetBase.protocol))
    throw new Error('Basic preview requires an HTTP or HTTPS project URL.');
  if (!['127.0.0.1', 'localhost', '::1'].includes(targetBase.hostname))
    throw new Error('Basic preview only proxies loopback project URLs.');
  const transport = targetBase.protocol === 'https:' ? httpsRequest : httpRequest;
  const server = createServer((incoming, response) => {
    const target = new URL(incoming.url ?? '/', targetBase);
    const upstream = transport(
      target,
      {
        method: incoming.method,
        headers: requestHeaders(incoming, targetBase),
      },
      (upstreamResponse) => {
        const contentType = String(upstreamResponse.headers['content-type'] ?? '');
        if (!contentType.includes('text/html')) {
          response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
          upstreamResponse.pipe(response);
          return;
        }
        const chunks: Buffer[] = [];
        upstreamResponse.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        upstreamResponse.on('end', () => {
          const body = injectFoundryBootstrap(Buffer.concat(chunks).toString('utf8'), runtimeUrl);
          const headers = { ...upstreamResponse.headers };
          delete headers['content-length'];
          delete headers['content-encoding'];
          delete headers['transfer-encoding'];
          headers['content-length'] = String(Buffer.byteLength(body));
          response.writeHead(upstreamResponse.statusCode ?? 200, headers);
          response.end(body);
        });
      },
    );
    upstream.on('error', (error) => {
      if (!response.headersSent) response.writeHead(502, { 'content-type': 'text/plain' });
      response.end(`Foundry could not reach the project preview: ${error.message}`);
    });
    incoming.pipe(upstream);
  });
  server.on('upgrade', (incoming, socket: Socket, head) => {
    const target = new URL(incoming.url ?? '/', targetBase);
    const upstream = transport(target, {
      method: incoming.method,
      headers: {
        ...requestHeaders(incoming, targetBase),
        connection: 'Upgrade',
        upgrade: 'websocket',
      },
    });
    upstream.on('upgrade', (upstreamResponse, upstreamSocket, upstreamHead) => {
      const lines = [
        `HTTP/1.1 ${upstreamResponse.statusCode ?? 101} ${upstreamResponse.statusMessage ?? 'Switching Protocols'}`,
      ];
      for (const [name, value] of Object.entries(upstreamResponse.headers)) {
        if (value != null)
          lines.push(`${name}: ${Array.isArray(value) ? value.join(', ') : value}`);
      }
      socket.write(`${lines.join('\r\n')}\r\n\r\n`);
      if (head.length) upstreamSocket.write(head);
      if (upstreamHead.length) socket.write(upstreamHead);
      upstreamSocket.pipe(socket).pipe(upstreamSocket);
    });
    upstream.on('error', () => socket.destroy());
    upstream.end();
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolveListen());
  });
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    stop: () =>
      new Promise<void>((resolveStop, reject) =>
        server.close((error) => (error ? reject(error) : resolveStop())),
      ),
  };
}
