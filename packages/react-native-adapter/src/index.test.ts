import assert from 'node:assert/strict';
import test from 'node:test';
import { createFoundryNativeAdapter } from './index.js';

test('register returns an idempotent removal function', () => {
  const adapter = createFoundryNativeAdapter({
    sessionId: 'ses_1',
    token: 'token',
    width: 390,
    height: 844,
  });
  const remove = adapter.register({
    id: 'button',
    label: 'Button',
    semanticRole: 'button',
    measure: async () => ({ x: 0, y: 0, width: 100, height: 44 }),
    controls: [],
    applyPreview: () => {},
  });
  assert.equal(typeof remove, 'function');
  remove();
  remove();
  adapter.stop();
});
