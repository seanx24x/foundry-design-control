import assert from 'node:assert/strict';
import test from 'node:test';
import type { DesignBranch, ProjectDesignGraph, SessionContext } from 'foundry-design-protocol';
import { assessBranchRecord, createBranchRecord } from './branch-records.js';

const now = '2026-09-06T00:00:00.000Z';
const context: SessionContext = {
  projectRoot: '/project',
  revision: 'rev-1',
  designGraphRevision: 'graph-1',
  platform: 'web',
  targetName: 'Fixture',
  viewport: { width: 1440, height: 900 },
  theme: 'light',
  breakpoint: 'desktop',
  state: 'default',
};
const branch: DesignBranch = {
  id: 'branch_1',
  name: 'Editorial hierarchy',
  status: 'chosen',
  rejectionReason: 'The hierarchy reads clearly at every breakpoint.',
  changes: [
    {
      id: 'change_1',
      target: {
        id: 'hero',
        platform: 'web',
        semanticRole: 'heading',
        label: 'Hero heading',
        componentPath: ['LandingPage', 'Hero'],
        source: { file: 'src/Hero.tsx', line: 18 },
        geometry: { x: 0, y: 0, width: 600, height: 120, scale: 1 },
        locator: { selector: 'h1' },
        confidence: 'instrumented',
        evidence: ['source mapping'],
      },
      category: 'typography',
      property: 'fontSize',
      before: '56px',
      after: '64px',
      stateIds: [],
      mappingCandidates: [],
      scope: 'component',
      context: { breakpoint: 'desktop', theme: 'light', state: 'default' },
      contextSet: { breakpoints: ['desktop'], themes: ['light'], states: ['default'] },
      confidence: 'instrumented',
      evidence: ['computed style'],
      createdAt: now,
      updatedAt: now,
      status: 'draft',
    },
  ],
  operations: [],
  createdAt: now,
  updatedAt: now,
};
const graph: ProjectDesignGraph = {
  protocolVersion: '1.3.0',
  projectRoot: '/project',
  revision: 'graph-1',
  tokens: [],
  components: [
    {
      id: 'hero',
      name: 'Hero',
      source: { file: 'src/Hero.tsx', line: 1 },
      instances: 1,
      variants: [],
      variantAxes: [],
      evidence: [],
    },
  ],
  breakpoints: [],
  themes: [],
  states: [],
  motionPresets: [],
  tokenUsages: [],
  designSystemFindings: [],
  indexedAt: now,
};

test('creates a current portable record from a source-backed branch', () => {
  const record = createBranchRecord(branch, 'chosen', context, graph, 'record_1', now);
  assert.equal(record.compatibility.status, 'current');
  assert.equal(record.compatibility.matchedSources, 1);
  assert.equal(record.sourceRelationships[0]?.source?.file, 'src/Hero.tsx');
  assert.equal(record.context.viewport?.width, 1440);
});

test('marks changed revisions stale and missing source relationships missing', () => {
  const record = createBranchRecord(branch, 'chosen', context, graph, 'record_1', now);
  const stale = assessBranchRecord(
    record,
    { ...context, revision: 'rev-2', designGraphRevision: 'graph-2' },
    graph,
    '2026-09-06T01:00:00.000Z',
  );
  assert.equal(stale.compatibility.status, 'stale');
  assert.equal(stale.compatibility.warnings.length, 2);

  const missing = assessBranchRecord(
    record,
    context,
    { ...graph, components: [] },
    '2026-09-06T02:00:00.000Z',
  );
  assert.equal(missing.compatibility.status, 'missing');
  assert.equal(missing.compatibility.matchedSources, 0);
});

test('remaps portable records by relative source path on another machine', () => {
  const record = createBranchRecord(branch, 'chosen', context, graph, 'record_1', now);
  const movedContext = { ...context, projectRoot: '/another-machine/project' };
  const movedGraph = { ...graph, projectRoot: movedContext.projectRoot };
  const moved = assessBranchRecord(record, movedContext, movedGraph, now);
  assert.equal(moved.compatibility.status, 'current');
  assert.match(moved.compatibility.warnings[0] ?? '', /project location changed/i);
});
