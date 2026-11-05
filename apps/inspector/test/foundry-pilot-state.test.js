import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { sameStateCondition, stateEvidenceModel } from '../public/next-state-workbench.js';

const file = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
const context = Object.freeze({
  version: 1,
  requestRevision: 4,
  viewport: Object.freeze({ id: 'desktop', width: 1280, height: 800 }),
  state: 'loading',
  theme: 'dark',
  motionPreference: 'reduce',
  selectedTarget: Object.freeze({
    id: 'invite-card',
    selector: '#invite-card',
  }),
});
const result = Object.freeze({
  applied: true,
  context,
  axes: Object.freeze({
    state: { status: 'applied', method: 'authored-state' },
  }),
});
const record = Object.freeze({
  context,
  result,
  measuredAt: '2026-10-31T12:00:00.000Z',
});

test('State pilot preserves the six evidence conditions without promoting stale evidence', () => {
  const cases = [
    [{ connected: true }, 'untested'],
    [{ connected: true, pending: true, record }, 'pending'],
    [{ connected: true, record }, 'inspected'],
    [{ connected: false, record }, 'offline'],
    [
      {
        connected: true,
        record,
        lastResult: {
          applied: false,
          context,
          failureReason: 'Unavailable authored state.',
        },
      },
      'failed',
    ],
    [
      {
        connected: true,
        record: {
          ...record,
          context: {
            ...context,
            viewport: { ...context.viewport, width: 1440 },
          },
        },
      },
      'untested',
    ],
  ];
  for (const [input, status] of cases) {
    const model = stateEvidenceModel(Object.freeze({ context, ...input }));
    assert.equal(model.status, status);
    if (['pending', 'offline', 'untested'].includes(status)) assert.equal(model.result, undefined);
  }
  assert.match(
    stateEvidenceModel({ connected: true, context, record }).note,
    /not a full accessibility or visual audit/,
  );
});

test('same-condition cache matching excludes changed dimensions and target selectors', () => {
  assert.equal(sameStateCondition(context, { ...context, requestRevision: 99 }), true);
  for (const change of [
    { viewport: { ...context.viewport, width: 1440 } },
    { viewport: { ...context.viewport, height: 900 } },
    { selectedTarget: { ...context.selectedTarget, selector: '#other-card' } },
    { state: 'empty' },
    { theme: 'light' },
    { motionPreference: 'system' },
  ])
    assert.equal(sameStateCondition(context, { ...context, ...change }), false);
});

test('State foundations hooks share the default policy and follow the existing evidence model', () => {
  const source = file('next-state-workbench.js');
  assert.match(source, /from ['"]\.\/foundry-pilot-state\.js['"]/);
  assert.match(source, /foundryFoundationsEnabled\(\)/);
  assert.match(source, /if \(pilot\)\s*mountPilotStateWorkbench\(root\)/);
  assert.match(
    source,
    /if \(pilot\)\s*refinePilotStateWorkbench\(root,\s*\{\s*model,\s*context,\s*states\s*\}\)/,
  );
  assert.ok(
    source.indexOf('refinePilotStateWorkbench(root,') >
      source.indexOf('const model = stateEvidenceModel('),
  );
  assert.match(source, /refresh\.disabled = !connected \|\| pending/);
  assert.match(
    source,
    /saved\?\.result\?\.applied && sameStateCondition\(saved\.context, candidate\)/,
  );
});

test('State pilot presentation cannot mutate controls, preview transport or evidence', () => {
  const source = file('foundry-pilot-state.js');
  assert.match(source, /export function mountPilotStateWorkbench\(/);
  assert.match(source, /export function refinePilotStateWorkbench\(/);
  assert.doesNotMatch(
    source,
    /fetch\(|requestFrameCommand\(|requestCommand\(|runDurableAction\(|postMessage\(|cloneNode\(|localStorage|sessionStorage/,
  );
  assert.doesNotMatch(source, /\.value\s*=|\.disabled\s*=|\.open\s*=|\.src\s*=/);
  assert.doesNotMatch(source, /createElement\(['"](?:iframe|canvas|select|input)['"]\)/);
  assert.doesNotMatch(source, /model\.[\w]+\s*=(?!=)|context\.[\w]+\s*=(?!=)|\.result\s*=(?!=)/);
});

test('State fixture exercises real rendering with local synthetic data and browser-visible checks', () => {
  const source = readFileSync(
    new URL('../../../scripts/test-foundry-state-pilot-fixture.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /function renderStates\(\)/);
  assert.match(source, /function updateStateWorkbenchPresentation\(\)/);
  assert.match(source, /createNextStateWorkbench as createRealStateWorkbench/);
  assert.match(source, /function closeCustomSelect\(/);
  assert.match(source, /server\.listen\(port, '127\.0\.0\.1'/);
  assert.match(source, /location\.origin \+ '\/fixture-preview'/);
  assert.match(source, /data-synthetic-preview/);
  for (const state of ['untested', 'pending', 'inspected', 'failed', 'offline', 'stale-context'])
    assert.ok(source.includes(`'${state}'`));
  assert.match(source, /Original .* control retained/);
  assert.match(source, /Unchanged updates preserve open evidence disclosure/);
  assert.match(source, /Presentation retains original iframe and source/);
  assert.match(source, /Gate off leaves State pilot additions absent/);
  assert.match(source, /One disclosure chevron per axis after repeated updates/);
  assert.doesNotMatch(
    source,
    /from ['"](?:playwright|@playwright\/test)|chromium\.launch|localStorage|sessionStorage|requestFrameCommand\(|fetch\(/,
  );
});
