import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyRunSchema,
  coalesceChanges,
  designChangeSchema,
  designOperationSchema,
  projectDesignGraphSchema,
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
    {
      ...base,
      id: 'chg_2',
      before: 120,
      after: 144,
      updatedAt: '2026-08-29T00:01:00.000Z',
    },
  ]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0]?.before, 100);
  assert.equal(changes[0]?.after, 144);
  assert.equal(changes[0]?.id, 'chg_1');
});

test('keeps edits with different responsive scopes separate', () => {
  const changes = coalesceChanges([
    base,
    {
      ...base,
      id: 'chg_2',
      context: { ...base.context, breakpoint: 'mobile' },
    },
  ]);
  assert.equal(changes.length, 2);
});

test('renders a portable prompt from canonical JSON', () => {
  const set: ChangeSet = {
    protocolVersion: '1.2.0',
    sessionId: 'ses_1',
    context: {
      projectRoot: '/project',
      platform: 'web',
      theme: 'light',
      breakpoint: 'desktop',
      state: 'default',
    },
    changes: [base],
    operations: [],
    screenshots: [],
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  };
  const prompt = renderChangePrompt(set);
  assert.match(prompt, /Save button — width/);
  assert.match(prompt, /100px → 120px/);
  assert.match(prompt, /getBoundingClientRect/);
});

test('requires reviewed changes in portable prompt exports', () => {
  const set: ChangeSet = {
    protocolVersion: '1.2.0',
    sessionId: 'ses_1',
    context: {
      projectRoot: '/project',
      platform: 'web',
      theme: 'light',
      breakpoint: 'desktop',
      state: 'default',
    },
    changes: [{ ...base, status: 'draft' }],
    operations: [],
    screenshots: [],
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  };
  assert.match(renderChangePrompt(set), /No reviewed changes are present/);
});

test('parses a portable apply run with progress and validation', () => {
  const run = applyRunSchema.parse({
    id: 'run_1',
    sessionId: 'ses_1',
    changeIds: ['chg_1'],
    revision: 'abc123',
    state: 'rebuilding',
    agent: { name: 'codex' },
    claimAttemptId: 'claim_1',
    claimHeartbeatAt: '2026-08-29T00:00:30.000Z',
    messages: [
      {
        state: 'applying',
        message: 'Updated the button source.',
        createdAt: '2026-08-29T00:01:00.000Z',
      },
    ],
    changedFiles: ['src/Button.tsx'],
    validationResults: [{ name: 'typecheck', passed: true }],
    verificationResults: [],
    attempts: 1,
    requestedAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:01:00.000Z',
  });
  assert.equal(run.state, 'rebuilding');
  assert.equal(run.claimAttemptId, 'claim_1');
  assert.equal(run.requeueCount, 0);
  assert.equal(run.validationResults[0]?.passed, true);
});

test('parses a revisioned project design graph', () => {
  const graph = projectDesignGraphSchema.parse({
    protocolVersion: '1.2.0',
    projectRoot: '/project',
    revision: 'abc123',
    tokens: [
      {
        id: 'token-space-3',
        name: '--space-3',
        value: '12px',
        category: 'spacing',
        cssVariable: '--space-3',
      },
    ],
    components: [],
    breakpoints: [{ id: 'mobile', label: 'Mobile', width: 390 }],
    themes: [],
    states: [],
    motionPresets: [],
    indexedAt: '2026-08-29T00:00:00.000Z',
  });
  assert.equal(graph.tokens[0]?.cssVariable, '--space-3');
  assert.equal(graph.breakpoints[0]?.height, 900);
});

test('requires explicit resolution for ambiguous semantic operations', () => {
  const operation = designOperationSchema.parse({
    id: 'op_1',
    kind: 'resize',
    label: 'Resize Save button',
    targetIds: ['button-primary'],
    mappingCandidates: [
      {
        id: 'map-width',
        label: 'Set element width',
        intent: 'resize',
        property: 'width',
        value: 120,
        confidence: 'inferred',
      },
      {
        id: 'map-basis',
        label: 'Set flex basis',
        intent: 'resize',
        property: 'flexBasis',
        value: 120,
        confidence: 'inferred',
      },
    ],
    status: 'unresolved',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });
  assert.equal(operation.mappingCandidates.length, 2);
  assert.equal(operation.selectedMappingId, undefined);
});
