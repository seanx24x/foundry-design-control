import assert from 'node:assert/strict';
import test from 'node:test';
import { FoundryRuntimeClient } from './client.js';

test('requires a session id when no environment default exists', () => {
  const client = new FoundryRuntimeClient('http://127.0.0.1:4387', undefined, undefined);
  assert.throws(() => client.sessionId(), /Provide sessionId/);
});
