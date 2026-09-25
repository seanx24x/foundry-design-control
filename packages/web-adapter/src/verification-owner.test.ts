import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const start = source.indexOf('function ownsApplyVerification(');
assert.ok(start >= 0);
const code = ts.transpileModule(
  source.slice(start, source.indexOf('function captureVerifiedRun(', start)),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;

function coordinator(
  frameKind: string,
  alreadyReloaded: boolean,
  parameters = '__foundry_frame=canvas',
  embeddedWorkspace = true,
) {
  const calls: string[] = [];
  const storage = new Map(alreadyReloaded ? [['__foundry_verifying_run', 'run']] : []);
  const verifyingRuns = new Set<string>();
  const dependencies = {
    readinessFrameKind: frameKind,
    verificationChild: frameKind === 'verification',
    query: new URLSearchParams(parameters),
    embeddedWorkspace,
    verifyingRuns,
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    location: { reload: () => calls.push('reload') },
    showToast: (message: string) => calls.push(message),
    verify: async () => {
      calls.push('verify');
    },
  };
  const maybeVerify = new Function(...Object.keys(dependencies), `${code}; return maybeVerifyRun;`)(
    ...Object.values(dependencies),
  ) as (run: unknown) => void;
  const run = {
    id: 'run',
    state: 'verifying',
    claimAttemptId: 'claim',
    applyResultAcknowledgedAt: 'now',
    applyResultClaimAttemptId: 'claim',
    changeIds: ['change'],
  };
  return { maybeVerify, run, calls, storage, verifyingRuns };
}

test('auxiliary previews never race Canvas Apply verification or its shared reload marker', async () => {
  for (const kind of ['responsive', 'workbench', 'verification']) {
    for (const reloaded of [false, true]) {
      const fixture = coordinator(kind, reloaded);
      fixture.maybeVerify(fixture.run);
      await Promise.resolve();
      assert.deepEqual(fixture.calls, [], `${kind} must not reload or verify`);
      assert.equal(fixture.verifyingRuns.size, 0);
      assert.equal(fixture.storage.has('__foundry_verifying_run'), reloaded);
    }
  }
});

test('Canvas still reloads rebuilt source and verifies exactly once after acknowledgement', async () => {
  const fresh = coordinator('canvas', false);
  fresh.maybeVerify(fresh.run);
  assert.deepEqual(fresh.calls, ['reload']);
  assert.equal(fresh.storage.get('__foundry_verifying_run'), 'run');

  const rebuilt = coordinator('canvas', true);
  rebuilt.maybeVerify(rebuilt.run);
  rebuilt.maybeVerify(rebuilt.run);
  assert.deepEqual(rebuilt.calls, ['verify']);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rebuilt.storage.has('__foundry_verifying_run'), false);
  assert.equal(rebuilt.verifyingRuns.size, 0);

  const unacknowledged = coordinator('canvas', true);
  unacknowledged.maybeVerify({ ...unacknowledged.run, applyResultClaimAttemptId: 'stale-claim' });
  assert.deepEqual(unacknowledged.calls, []);
});

test('branch comparisons and unmarked embedded previews cannot impersonate Canvas', async () => {
  for (const parameters of [
    '__foundry_design_branch=main',
    '__foundry_design_branch=direction',
    '__foundry_frame=canvas&__foundry_design_branch=main',
    '',
    '__foundry_frame=component-preview',
  ]) {
    for (const reloaded of [false, true]) {
      const fixture = coordinator('canvas', reloaded, parameters);
      fixture.maybeVerify(fixture.run);
      await Promise.resolve();
      assert.deepEqual(fixture.calls, [], `${parameters} must not coordinate verification`);
      assert.equal(fixture.storage.has('__foundry_verifying_run'), reloaded);
    }
  }
});

test('standalone Canvas retains verification without an embedded frame marker', async () => {
  const fixture = coordinator('canvas', true, '', false);
  fixture.maybeVerify(fixture.run);
  assert.deepEqual(fixture.calls, ['verify']);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fixture.storage.has('__foundry_verifying_run'), false);
});

test('presence only reports genuine Canvas while retaining auxiliary and standalone leases', async () => {
  const presenceStart = source.indexOf('async function publishPreviewPresence(');
  assert.ok(presenceStart >= 0);
  const presenceCode = ts.transpileModule(
    source.slice(presenceStart, source.indexOf('const readinessHeartbeat', presenceStart)),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
  ).outputText;
  for (const [kind, parameters, embedded, allowed] of [
    ['canvas', '__foundry_frame=canvas', true, true],
    ['canvas', '', false, true],
    ['canvas', '__foundry_design_branch=main', true, false],
    ['canvas', '__foundry_frame=canvas&__foundry_design_branch=direction', true, false],
    ['canvas', '', true, false],
    ['responsive', '__foundry_responsive_lab=mobile', true, true],
    ['workbench', '__foundry_frame=state-workbench', true, true],
    ['verification', '__foundry_verification=1', true, true],
  ] as const) {
    const requests: { frameKind: string; connected: boolean }[] = [];
    const dependencies = {
      readinessFrameKind: kind,
      verificationChild: kind === 'verification',
      query: new URLSearchParams(parameters),
      embeddedWorkspace: embedded,
      sessionId: 'session',
      token: 'test-token',
      previewCapability: 'test-capability',
      hydratedOnce: true,
      readinessStopped: false,
      readinessPending: false,
      readinessFrameId: 'frame',
      collectLayerElements: () => [],
      meaningfulLayer: () => true,
      document: {},
      runtimeUrl: 'http://127.0.0.1:4587',
      PROTOCOL_VERSION: 'test',
      packageJson: { version: 'test' },
      fetch: async (_url: string, options: { body: string }) => {
        requests.push(JSON.parse(options.body));
      },
    };
    const publishPresence = new Function(
      ...Object.keys(dependencies),
      `${code};${presenceCode}; return publishPreviewPresence;`,
    )(...Object.values(dependencies)) as (connected: boolean) => Promise<void>;
    await publishPresence(true);
    await publishPresence(false);
    assert.deepEqual(
      requests.map(({ frameKind, connected }) => ({ frameKind, connected })),
      allowed
        ? [
            { frameKind: kind, connected: true },
            { frameKind: kind, connected: false },
          ]
        : [],
      `${kind} ${parameters} embedded=${embedded}`,
    );
  }
});
