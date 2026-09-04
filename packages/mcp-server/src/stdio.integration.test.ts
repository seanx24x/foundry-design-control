import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import test from 'node:test';
import packageJson from '../package.json' with { type: 'json' };

test('starts over stdio and exposes the complete Foundry handoff toolset', async (context) => {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: new URL('..', import.meta.url),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  context.after(() => child.kill('SIGTERM'));
  const lines = createInterface({ input: child.stdout });
  const responses = new Map<number, (value: Record<string, unknown>) => void>();
  lines.on('line', (line) => {
    const message = JSON.parse(line) as { id?: number };
    if (message.id !== undefined) responses.get(message.id)?.(message);
  });
  let nextId = 0;
  const request = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), 5_000);
      responses.set(id, (value) => {
        clearTimeout(timer);
        responses.delete(id);
        resolve(value);
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });

  const initialized = await request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'foundry-release-test', version: '1.0.0' },
  });
  const initializeResult = initialized.result as {
    serverInfo: { name: string; version: string };
  };
  assert.equal(initializeResult.serverInfo.name, 'foundry-design-control');
  assert.equal(initializeResult.serverInfo.version, packageJson.version);
  child.stdin.write(
    `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n`,
  );
  const listed = await request('tools/list');
  const names = ((listed.result as { tools: Array<{ name: string }> }).tools ?? []).map(
    (tool) => tool.name,
  );
  for (const name of [
    'foundry_design_wait_for_apply',
    'foundry_design_heartbeat_apply_run',
    'foundry_design_get_apply_run',
    'foundry_design_update_apply_run',
  ]) {
    assert.ok(names.includes(name), `${name} was not exposed`);
  }
  child.kill('SIGTERM');
  await Promise.race([
    once(child, 'exit'),
    new Promise((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error('MCP server did not close after SIGTERM')),
        5_000,
      );
      timer.unref();
    }),
  ]);
});
