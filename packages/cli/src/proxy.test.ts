import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { injectFoundryBootstrap, startBasicPreviewProxy } from './proxy.js';

test('basic preview injects the runtime bootstrap once', () => {
  const first = injectFoundryBootstrap(
    '<html><head></head><body></body></html>',
    'http://127.0.0.1:4387',
  );
  assert.match(first, /adapter-bootstrap\.js/);
  assert.equal(injectFoundryBootstrap(first, 'http://127.0.0.1:4387'), first);
});

test('basic preview proxies a loopback page and injects the adapter', async () => {
  const target = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<html><head></head><body>Fixture</body></html>');
  });
  await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
  const targetPort = (target.address() as AddressInfo).port;
  const proxy = await startBasicPreviewProxy(
    `http://127.0.0.1:${targetPort}`,
    'http://127.0.0.1:4387',
  );
  try {
    const body = await fetch(proxy.url).then((response) => response.text());
    assert.match(body, /Fixture/);
    assert.match(body, /http:\/\/127\.0\.0\.1:4387\/adapter-bootstrap\.js/);
  } finally {
    await proxy.stop();
    await new Promise<void>((resolve, reject) =>
      target.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
