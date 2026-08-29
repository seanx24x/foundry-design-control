import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const server = createServer(async (request, response) => {
  const path =
    new URL(request.url, 'http://127.0.0.1').pathname === '/'
      ? 'index.html'
      : new URL(request.url, 'http://127.0.0.1').pathname.slice(1);
  try {
    const body = await readFile(new URL(path, import.meta.url));
    response.writeHead(200, { 'content-type': path.endsWith('.css') ? 'text/css' : 'text/html' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
server.listen(4390, '127.0.0.1', () => console.log('Foundry fixture: http://127.0.0.1:4390'));
