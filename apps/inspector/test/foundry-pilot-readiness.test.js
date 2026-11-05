import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { readinessCapabilityItems } from '../public/foundry-pilot-readiness.js';

const file = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
const helper = file('foundry-pilot-readiness.js');
const controller = file('readiness-ui.js');
const workspace = file('next-workspace.js');
const fixture = readFileSync(
  new URL('../../../scripts/test-foundry-readiness-pilot-fixture.mjs', import.meta.url),
  'utf8',
);
function harness({ pilot = true, next = true } = {}) {
  const command = { dataset: {} };
  const shell = { dataset: { next: String(next) } };
  const document = {
    documentElement: { dataset: pilot ? { foundryPilot: 'canvas' } : {} },
    querySelector(selector) {
      return selector === '#app-shell' ? shell : selector === '#readiness-command' ? command : null;
    },
  };
  const context = { document };
  runInNewContext(
    helper.replaceAll('export function ', 'function ') +
      '\nthis.api={refinePilotReadiness,refinePilotConnection,refinePilotPreviewFallback,rememberPilotRecovery,pilotConnectionHeadline};',
    context,
  );
  return { api: context.api, document, command };
}

test('readiness capability roles preserve distinct explicit report booleans', () => {
  assert.deepEqual(
    readinessCapabilityItems({ capabilities: { inspect: true, stage: true, apply: false } }),
    [
      { key: 'inspect', label: 'Inspect', state: 'available', value: 'Available' },
      { key: 'stage', label: 'Stage edits', state: 'available', value: 'Available' },
      { key: 'apply', label: 'Apply to source', state: 'unavailable', value: 'Needs attention' },
    ],
  );
});

test('missing and nonboolean capability claims remain unknown rather than inferred', () => {
  for (const report of [
    null,
    undefined,
    { ready: true },
    { capabilities: {} },
    { capabilities: { inspect: 'true', stage: 1, apply: null } },
    { previewConnected: true, listenerConnected: true },
  ]) {
    assert.deepEqual(
      readinessCapabilityItems(report).map((item) => item.state),
      ['unknown', 'unknown', 'unknown'],
    );
  }
});

test('readiness failure invalidates previously available capabilities', () => {
  const report = { ready: true, capabilities: { inspect: true, stage: true, apply: true } };
  assert.deepEqual(
    readinessCapabilityItems(report, 'Connection request failed').map((item) => item.state),
    ['unknown', 'unknown', 'unknown'],
  );
  assert.deepEqual(
    readinessCapabilityItems(report).map((item) => item.state),
    ['available', 'available', 'available'],
  );
  assert.equal(report.capabilities.apply, true);
});

test('presentation helper requires both explicit pilot and next workspace gates', () => {
  for (const options of [{ pilot: false }, { next: false }, { pilot: false, next: false }]) {
    const { api, command } = harness(options),
      original = { state: 'connected', label: 'Connected' };
    assert.equal(api.refinePilotReadiness(), false);
    assert.equal(api.refinePilotConnection({}, {}), false);
    assert.equal(api.refinePilotPreviewFallback(), false);
    api.rememberPilotRecovery('listener', { id: 'restart' });
    assert.deepEqual(command.dataset, {});
    assert.equal(
      api.pilotConnectionHeadline(original, { connected: true, runtimeConnected: false }),
      original,
    );
  }
});

test('missing documentElement safely retains gate-off original behavior', () => {
  const { api, document } = harness();
  delete document.documentElement;
  assert.equal(api.refinePilotReadiness(), false);
  assert.equal(api.refinePilotConnection({}, {}), false);
  assert.equal(api.refinePilotPreviewFallback(), false);
});

test('preview-only connection headline does not misrepresent the local runtime', () => {
  const { api } = harness(),
    original = { state: 'connected', label: 'Connected' };
  const result = api.pilotConnectionHeadline(original, {
    connected: true,
    runtimeConnected: false,
    listenerConnected: true,
  });
  assert.equal(result.state, 'degraded');
  assert.equal(result.label, 'Preview only');
  assert.match(result.title, /runtime is unavailable/);
  assert.equal(
    api.pilotConnectionHeadline(original, { connected: true, runtimeConnected: true }),
    original,
  );
  assert.equal(
    api.pilotConnectionHeadline(original, { connected: false, runtimeConnected: false }),
    original,
  );
});

test('manual recovery provenance records only its check and literal signature', () => {
  const { api, command } = harness();
  const recovery = {
    id: 'configure-agent',
    command: 'echo "<script>literal</script>"',
    requiresAgentRestart: true,
  };
  api.rememberPilotRecovery('agent-setup', recovery);
  assert.equal(command.dataset.pilotRecoveryCheck, 'agent-setup');
  assert.equal(command.dataset.pilotRecoverySignature, JSON.stringify(recovery));
  assert.deepEqual(Object.keys(command.dataset), ['pilotRecoveryCheck', 'pilotRecoverySignature']);
});

test('unknown check statuses remain unconfirmed instead of silently becoming passed', () => {
  const { api, document } = harness();
  const result = { textContent: 'unknown' },
    count = { textContent: '' };
  const unknown = { dataset: { status: 'unknown' }, querySelector: () => result };
  const checks = {
    setAttribute() {},
    querySelectorAll: () => [unknown],
    querySelector: () => null,
    contains: () => false,
  };
  const capabilityRows = Object.fromEntries(
    ['inspect', 'stage', 'apply'].map((key) => [
      key,
      { dataset: {}, querySelector: () => ({ textContent: '' }) },
    ]),
  );
  const body = {
    querySelector(selector) {
      if (selector === '.foundry-readiness-capabilities') return {};
      if (selector === '#foundry-checks-count') return count;
      const key = selector.match(/data-readiness-capability="(.*?)"/)?.[1];
      return capabilityRows[key] ?? null;
    },
  };
  const originalQuery = document.querySelector.bind(document);
  document.querySelector = (selector) =>
    selector === '#readiness-dialog'
      ? { open: false, querySelector: () => body }
      : selector === '#readiness-checks'
        ? checks
        : originalQuery(selector);
  assert.equal(api.refinePilotReadiness({ readiness: { checks: [{ status: 'unknown' }] } }), true);
  assert.equal(result.textContent, 'Not confirmed');
  assert.equal(count.textContent, '0 of 1 passed');
});

test('a passed originating check invalidates manual instructions despite unchanged recovery metadata', () => {
  const { api, document, command } = harness();
  const recovery = { id: 'configure-agent', command: 'npx foundry listen' };
  api.rememberPilotRecovery('listener', recovery);
  command.hidden = false;
  command.contains = () => false;
  const checks = {
    setAttribute() {},
    querySelectorAll: () => [],
    querySelector: () => null,
    contains: () => false,
  };
  const capabilityRows = Object.fromEntries(
    ['inspect', 'stage', 'apply'].map((key) => [
      key,
      { dataset: {}, querySelector: () => ({ textContent: '' }) },
    ]),
  );
  const count = { textContent: '' };
  const body = {
    querySelector(selector) {
      if (selector === '.foundry-readiness-capabilities') return {};
      if (selector === '#foundry-checks-count') return count;
      const key = selector.match(/data-readiness-capability="(.*?)"/)?.[1];
      return capabilityRows[key] ?? null;
    },
  };
  const originalQuery = document.querySelector.bind(document);
  document.querySelector = (selector) =>
    selector === '#readiness-dialog'
      ? { open: false, querySelector: () => body }
      : selector === '#readiness-checks'
        ? checks
        : originalQuery(selector);
  api.refinePilotReadiness({
    readiness: { checks: [{ id: 'listener', status: 'warning', recovery }] },
  });
  assert.equal(command.hidden, false);
  api.refinePilotReadiness({
    readiness: { checks: [{ id: 'listener', status: 'passed', recovery }] },
  });
  assert.equal(command.hidden, true);
  assert.deepEqual(command.dataset, {});
  assert.equal(count.textContent, '1 of 1 passed');
});

test('existing controller retains read-only probes, timeout, coalescing and cleanup ownership', () => {
  assert.match(controller, /api\(`\/v1\/sessions\/\$\{sessionId\}\/readiness`/);
  assert.match(controller, /AbortSignal\.timeout\(8000\)/);
  assert.match(
    controller,
    /if\s*\(loading\)\s*\{[\s\S]*?if\s*\(!background\)\s*refreshPending\s*=\s*true;[\s\S]*?return;/,
  );
  assert.match(controller, /setInterval\([\s\S]*?2000\)/);
  assert.match(
    controller,
    /dialog\.addEventListener\('close',[\s\S]*?clearInterval\(refreshTimer\)[\s\S]*?refreshPending\s*=\s*false/,
  );
  assert.match(
    controller,
    /window\.addEventListener\('pagehide',[\s\S]*?clearInterval\(refreshTimer\)/,
  );
  assert.match(controller, /refinePilotReadiness\(\{[\s\S]*?recoveryFocusId/);
  assert.match(
    controller,
    /rememberPilotRecovery\(button\.dataset\.readinessRecovery,\s*recovery\)/,
  );
  assert.doesNotMatch(helper, /fetch\(|setInterval\(|exec\(|eval\(|new Function/);
});

test('recovery information remains text-only and is invalidated when its source report changes', () => {
  assert.match(controller, /querySelector\('code'\)\.textContent\s*=\s*recovery\.command/);
  assert.match(
    helper,
    /JSON\.stringify\(recovery\)\s*!==\s*command\.dataset\.pilotRecoverySignature/,
  );
  assert.match(helper, /command\.hidden\s*=\s*true/);
  assert.match(helper, /heldFocus\s*&&\s*dialog\.open/);
  assert.match(
    helper,
    /querySelector\('#readiness-refresh'\)\.focus\(\{\s*preventScroll:\s*true\s*\}\)/,
  );
});

test('connection and fallback refinements preserve original nodes and honest action roles', () => {
  assert.match(workspace, /refinePilotConnection\(connection,\s*model\)/);
  assert.match(helper, /String\(Boolean\(model\[node\.dataset\.nextConnection\]\)\)/);
  assert.match(helper, /host\.append\(loading,\s*fallback\)/);
  assert.match(
    helper,
    /actions\.append\([\s\S]*?querySelector\('#reconnect-preview'\)[\s\S]*?querySelector\('#direct-preview'\)/,
  );
  assert.match(helper, /does not repair the embedded connection/);
  assert.match(helper, /setAttribute\('rel',\s*'noopener'\)/);
  assert.match(
    helper,
    /addEventListener\('wheel',[\s\S]*?event\.stopPropagation\(\)[\s\S]*?passive:\s*true/,
  );
  assert.match(helper, /addEventListener\('pointerdown',[\s\S]*?event\.stopPropagation\(\)/);
  assert.doesNotMatch(helper, /preventDefault\(/);
  assert.doesNotMatch(helper, /fallback\.innerHTML\s*=/);
});

test('isolated fixture imports the actual controller and extracts actual connection and reconnect bindings', () => {
  assert.match(fixture, /import\s*\{\s*createReadinessUI\s*\}\s*from\s*'\/readiness-ui\.js'/);
  assert.match(fixture, /between\(\s*workspace,\s*"  const liveTrigger = \$\('#live-status'\);"/);
  assert.match(fixture, /between\(\s*app,\s*'function reconnectCanvasPreview\(\)'/);
  assert.match(fixture, /const stylesheets\s*=\s*\[\s*\.\.\.index\.matchAll/);
  assert.match(fixture, /window\.setInterval\s*=/);
  assert.match(fixture, /FOUNDRY_READINESS_FIXTURE_PORT\s*\?\?\s*0/);
  assert.match(fixture, /listen\(port,\s*'127\.0\.0\.1'/);
  assert.match(fixture, /process\.argv\.includes\('--check'\)/);
  assert.doesNotMatch(fixture, /__foundry_token|__foundry_session|ses_[0-9a-f]{20}/);
});
