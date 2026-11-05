import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const file = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
const app = file('app.js');
test('pilot preview refresh uses a neutral non-destructive hover', () => {
  assert.match(
    file('foundry-pilot-branches.css'),
    /\.next-branch-refresh:hover\s*\{\s*color: var\(--text\);\s*background: var\(--surface-2\);/,
  );
});
const fixture = readFileSync(
  new URL('../../../scripts/test-foundry-branches-pilot-fixture.mjs', import.meta.url),
  'utf8',
);

function previewHarness({ acknowledged = true, failure = false } = {}) {
  const events = [];
  const status = { textContent: 'Connecting…', dataset: {}, title: '' };
  const card = {
    querySelector: () => status,
    setAttribute: (name, value) => events.push({ type: 'attribute', name, value }),
  };
  const frame = { closest: () => card };
  const branch = { changes: [{ id: 'font', property: 'fontSize', after: 80 }] };
  const context = {
    nextDesignBranches: {},
    requestFrameCommand: async (target, command, payload) => {
      events.push({ type: 'command', target, command, payload });
      if (failure) throw Error('Synthetic preview disconnect');
      return { switched: acknowledged };
    },
    failNextBranchPreview: (target, reason) => events.push({ type: 'failure', target, reason }),
  };
  const start = app.indexOf('async function sendBranchPreview(');
  const end = app.indexOf('function failNextBranchPreview(', start);
  assert.ok(start >= 0 && end > start);
  const send = runInNewContext(app.slice(start, end) + ';sendBranchPreview', context);
  return { send, frame, branch, events, status };
}

test('direction preview claims readiness only after acknowledged rendered transport', async () => {
  const { send, frame, branch, events, status } = previewHarness();
  await send(frame, branch);
  assert.deepEqual(
    events.filter((item) => item.type === 'command').map((item) => item.command),
    ['preview-design-branch', 'set-mode'],
  );
  assert.equal(events[0].payload.changes, branch.changes);
  assert.equal(events[1].payload.mode, 'interact');
  assert.equal(status.textContent, 'Preview ready');
  assert.equal(status.dataset.status, 'ready');
  assert.match(status.title, /Source is unchanged/);
  assert.ok(
    events.some((item) => item.name === 'data-preview-connection' && item.value === 'live'),
  );
  assert.doesNotMatch(status.textContent, /verified|applied|passed/i);
});

test('unacknowledged and failed previews never claim a rendered result', async () => {
  for (const options of [{ acknowledged: false }, { failure: true }]) {
    const { send, frame, branch, events, status } = previewHarness(options);
    await send(frame, branch);
    assert.equal(events.filter((item) => item.type === 'failure').length, 1);
    assert.ok(!events.some((item) => item.command === 'set-mode' || item.value === 'live'));
    assert.equal(status.textContent, 'Connecting…');
  }
});

test('Branches pilot is explicitly gated and only moves original presentation nodes', () => {
  const adapter = file('next-design-branches.js');
  const helper = file('foundry-pilot-branches.js');
  assert.match(adapter, /foundryFoundationsEnabled\(\)/);
  assert.match(adapter, /if \(pilot\) mountPilotDesignBranches\(root\)/);
  assert.match(adapter, /if \(pilot\)\s+refinePilotDesignBranches/);
  assert.match(
    helper,
    /management\.append\(summary, root\.querySelector\('#design-branch-detail'\)\)/,
  );
  assert.match(helper, /root\.querySelector\('\.design-branch-stage'\)\.append\(management\)/);
  assert.match(helper, /make\('details', 'foundry-branches-management'\)/);
  assert.match(helper, /Active direction details/);
  assert.match(helper, /Editing: \$\{active.name\}/);
  assert.match(helper, /Comparison selectors do not change it/);
  assert.doesNotMatch(
    helper,
    /fetch\(|requestCommand\(|postMessage\(|cloneNode\(|localStorage|sessionStorage/,
  );
  assert.doesNotMatch(helper, /\.(?:value|disabled|open)\s*=/);
  assert.match(adapter, /promote.disabled = active.id === 'main' \|\| savedCount === 0/);
  assert.match(adapter, /notes\.set\(activeId, note\.value\)/);
  assert.match(adapter, /note\.setSelectionRange/);
});

test('Branches fixture extracts real rendering, selects and actions with isolated transport', () => {
  for (const boundary of [
    'function designBranchDirections()',
    'function editableTarget(',
    'function closeCustomSelect(',
    'function escapeText(',
  ])
    assert.ok(fixture.includes(boundary), boundary);
  assert.match(fixture, /createNextDesignBranches as createRealDesignBranches/);
  assert.match(fixture, /async function api\(url,options\)/);
  assert.match(fixture, /async function requestFrameCommand\(frame,command,payload\)/);
  assert.match(fixture, /fixture-only signal/);
  assert.match(fixture, /server.listen\(port,\s*'127\.0\.0\.1'/);
  assert.match(fixture, /FOUNDRY_BRANCHES_FIXTURE_PORT \?\? 0/);
  assert.match(fixture, /No live Foundry session or provider/);
  assert.doesNotMatch(
    fixture,
    /from ['"](?:playwright|@playwright\/test)|chromium\.launch|localStorage|sessionStorage|fetch\(/,
  );
  assert.doesNotMatch(fixture, /ses_[a-z0-9]+|__foundry_token|__foundry_session/);
});

test('pilot preview fitting defers observer writes while retaining the default synchronous path', () => {
  const adapter = file('next-design-branches.js');
  assert.match(adapter, /let fitFrame/);
  assert.match(adapter, /if \(!pilot\) return fit\(\)/);
  assert.match(adapter, /cancelAnimationFrame\(fitFrame\)/);
  assert.match(adapter, /fitFrame = requestAnimationFrame\(fit\)/);
  assert.match(adapter, /const nextScale = String\(scale\)/);
  assert.match(
    adapter,
    /if \(!pilot \|\| viewport\.style\.getPropertyValue\('--branch-scale'\) !== nextScale\)/,
  );
  const css = file('foundry-pilot-branches.css');
  assert.match(css, /\.next-branch-select\s+> span:first-child\s*\{\s*width: 32px/);
  assert.doesNotMatch(css, /\.next-branch-select\s+> span\s*\{\s*width: 32px/);
});

test('Branches isolated assertions cover ownership, drafts, compare semantics and honest recovery', () => {
  for (const state of ['main', 'compare', 'empty', 'terminal', 'records', 'offline']) {
    assert.ok(fixture.includes(`'${state}'`), state);
  }
  for (const assertion of [
    'Main is already collected in Review and cannot promote itself',
    'Terminal-only direction cannot enter Review',
    'Comparison selectors do not activate a direction or change Review',
    'Irrelevant session refresh preserves iframe identity',
    'Direction note draft survives renderer replacement',
    'Direction note focus and selection survive same-direction refresh',
    'Failed creation preserves the user draft',
    'Conflicting decisions remain mutually exclusive',
    'Leaving a compared direction prunes stale selections',
    'Combining remains separate from Review and clears its selection',
    'Current and stale records retain distinct restore eligibility',
    'Unacknowledged previews hide stale pixels',
    'Reload replaces failed frames and clears obsolete errors',
    'Unexpected frame reload invalidates the previous acknowledgement',
    'Active direction details reuse the original node below comparison decisions',
    'Editing details start collapsed with native keyboard semantics',
    'Editing disclosure identity, expansion and focus survive refresh',
    'Editing disclosure stays collapsed and unique after repeated refresh',
    'Gate off retains the original detail rail placement',
    'Upgraded comparison triggers retain at least 120px usable width at the current viewport',
    'Pilot page, sidebar and comparison stage have no horizontal overflow',
    'Desktop root grid and original sidebar use the approved 320px column',
    'Compact root grid and original sidebar use the 320px column',
    'Narrow layout stacks the full-width sidebar above the comparison stage',
    'Gate off does not adopt pilot grid or editing wrappers',
    'No source Apply or provider transaction is invoked',
  ])
    assert.ok(fixture.includes(assertion), assertion);
  assert.match(fixture, /\$\(selector\)===originalNodes\[name\]/);
});
