import assert from 'node:assert/strict';
import test from 'node:test';
import {
  coalesceChanges,
  designChangeSchema,
  renderChangePrompt,
  type ChangeSet,
} from './index.js';

const base = designChangeSchema.parse({
  id: 'chg_1',
  target: {
    id: 'button-primary',
    platform: 'web',
    semanticRole: 'button',
    label: 'Save button',
    componentPath: ['Toolbar', 'Button'],
    geometry: { x: 10, y: 20, width: 100, height: 40 },
    locator: { selector: '[data-foundry-id="button-primary"]' },
    confidence: 'measured',
    evidence: ['getBoundingClientRect'],
  },
  category: 'layout',
  property: 'width',
  before: 100,
  after: 120,
  unit: 'px',
  scope: 'instance',
  context: { breakpoint: 'desktop', theme: 'light', state: 'default' },
  confidence: 'measured',
  evidence: ['computed style'],
  createdAt: '2026-08-29T00:00:00.000Z',
  updatedAt: '2026-08-29T00:00:00.000Z',
  status: 'approved',
});

test('coalesces repeated edits while preserving the original before value', () => {
  const changes = coalesceChanges([
    base,
    { ...base, id: 'chg_2', before: 120, after: 144, updatedAt: '2026-08-29T00:01:00.000Z' },
  ]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0]?.before, 100);
  assert.equal(changes[0]?.after, 144);
  assert.equal(changes[0]?.id, 'chg_1');
});

test('keeps edits with different responsive scopes separate', () => {
  const changes = coalesceChanges([
    base,
    { ...base, id: 'chg_2', context: { ...base.context, breakpoint: 'mobile' } },
  ]);
  assert.equal(changes.length, 2);
});

test('renders a portable prompt from canonical JSON', () => {
  const set: ChangeSet = {
    protocolVersion: '1.0.0',
    sessionId: 'ses_1',
    context: {
      projectRoot: '/project',
      platform: 'web',
      theme: 'light',
      breakpoint: 'desktop',
      state: 'default',
    },
    changes: [base],
    screenshots: [],
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  };
  const prompt = renderChangePrompt(set);
  assert.match(prompt, /Save button — width/);
  assert.match(prompt, /100px → 120px/);
  assert.match(prompt, /getBoundingClientRect/);
});
