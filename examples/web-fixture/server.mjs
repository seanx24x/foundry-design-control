import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const fixtureRoot = resolve(import.meta.dirname, process.env.FOUNDRY_FIXTURE_ROOT ?? '.');
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
]);

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const path = pathname === '/' ? 'index.html' : pathname.slice(1);
  const absolutePath = resolve(fixtureRoot, path);
  if (absolutePath !== fixtureRoot && !absolutePath.startsWith(`${fixtureRoot}/`)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  try {
    const body = await readFile(absolutePath);
    response.writeHead(200, {
      'content-type': contentTypes.get(extname(path)) ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
server.listen(4390, '127.0.0.1', () => console.log('Foundry fixture: http://127.0.0.1:4390'));
