import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SessionStore } from './store.js';

test('persists and authenticates a coalesced design session', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-store-'));
  const store = new SessionStore(root);
  const session = await store.create({
    projectRoot: '/project',
    platform: 'web',
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const target = {
    id: 'target',
    platform: 'web' as const,
    semanticRole: 'button',
    label: 'Button',
    componentPath: [],
    geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
    locator: { selector: 'button' },
    confidence: 'measured' as const,
    evidence: ['live geometry'],
  };
  const common = {
    target,
    category: 'layout' as const,
    property: 'width',
    unit: 'px',
    scope: 'instance' as const,
    context: { breakpoint: 'current', theme: 'current', state: 'current' },
    confidence: 'measured' as const,
    evidence: ['computed style'],
    status: 'draft' as const,
  };
  await store.addChange(session.changeSet.sessionId, { ...common, before: 100, after: 120 });
  await store.addChange(session.changeSet.sessionId, { ...common, before: 120, after: 144 });
  const restored = await store.authenticate(session.changeSet.sessionId, session.token);
  assert.equal(restored.changeSet.changes.length, 1);
  assert.equal(restored.changeSet.changes[0]?.before, 100);
  assert.equal(restored.changeSet.changes[0]?.after, 144);
});
