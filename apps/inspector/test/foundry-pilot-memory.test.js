import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const file = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
const app = file('app.js');
const fixture = readFileSync(
  new URL('../../../scripts/test-foundry-memory-pilot-fixture.mjs', import.meta.url),
  'utf8',
);
function slice(start, end) {
  const first = app.indexOf(start),
    last = app.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first);
  return app.slice(first, last);
}

function captureHarness({
  connected = true,
  canCapture = true,
  busy = false,
  failure = false,
  held = false,
} = {}) {
  const events = [],
    fields = {
      'decision-memory-title': { value: 'Headline hierarchy' },
      'decision-memory-summary': { value: 'Retain the content measure.' },
      'decision-memory-rationale': { value: 'Keep the form visible.' },
    };
  let action, release;
  const context = {
    nextDesignMemory: {},
    memoryCaptureBusy: busy,
    memoryActionBusy: false,
    memoryCaptureError: '',
    bridgeConnected: connected,
    bridgeState: { decisionMemory: { canCapture } },
    decisionMemoryOutcome: 'rejected',
    preview: {},
    activeMode: 'memory',
    $: (selector) =>
      selector === '#decision-memory-save'
        ? {
            addEventListener: (_, handler) => {
              action = handler;
            },
          }
        : fields[selector.slice(1)],
    renderMemory: () => events.push({ type: 'render' }),
    toast: (message) => events.push({ type: 'toast', message }),
    requestCommand: async (command, payload) => {
      events.push({ type: 'command', command, payload });
      if (held)
        await new Promise((resolve) => {
          release = resolve;
        });
      if (failure) throw Error('Synthetic acknowledgement failed.');
      return { saved: true };
    },
  };
  runInNewContext(
    slice('async function runDurableAction(', 'function rejectPendingFrameCommands(') +
      slice(
        "$('#decision-memory-save').addEventListener",
        "$('#decision-memory-review').addEventListener",
      ),
    context,
  );
  return { action, context, events, fields, release: () => release() };
}

test('capture guards offline, absent selection and busy states before durable dispatch', async () => {
  for (const options of [{ connected: false }, { canCapture: false }, { busy: true }]) {
    const { action, events, fields } = captureHarness(options);
    await action();
    assert.equal(events.length, 0);
    assert.equal(fields['decision-memory-title'].value, 'Headline hierarchy');
  }
});

test('acknowledged capture records manual guidance without source application', async () => {
  const { action, context, events, fields } = captureHarness();
  await action();
  const command = events.find((event) => event.type === 'command');
  assert.equal(command.command, 'save-design-decision');
  assert.equal(command.payload.title, 'Headline hierarchy');
  assert.equal(command.payload.outcome, 'rejected');
  assert.equal(command.payload.evidenceKind, 'manual');
  assert.equal(command.payload.evidenceLabel, 'Captured in Design decision memory');
  assert.ok(Object.values(fields).every((field) => field.value === ''));
  assert.equal(context.memoryCaptureBusy, false);
  assert.equal(context.memoryCaptureError, '');
  assert.ok(!events.some((event) => event.command?.includes('apply')));
});

test('failed capture preserves draft and resets busy with an honest not-saved message', async () => {
  const { action, context, fields } = captureHarness({ failure: true });
  await action();
  assert.equal(fields['decision-memory-title'].value, 'Headline hierarchy');
  assert.equal(fields['decision-memory-summary'].value, 'Retain the content measure.');
  assert.equal(fields['decision-memory-rationale'].value, 'Keep the form visible.');
  assert.equal(context.memoryCaptureBusy, false);
  assert.match(context.memoryCaptureError, /Not saved. Your draft is preserved/);
});

test('pending capture cannot dispatch twice or erase newer user input on acknowledgement', async () => {
  const { action, context, events, fields, release } = captureHarness({ held: true });
  const pending = action();
  assert.equal(context.memoryCaptureBusy, true);
  await action();
  assert.equal(events.filter((event) => event.type === 'command').length, 1);
  fields['decision-memory-title'].value = 'Newer title';
  fields['decision-memory-summary'].value = 'Newer guidance';
  release();
  await pending;
  assert.equal(fields['decision-memory-title'].value, 'Newer title');
  assert.equal(fields['decision-memory-summary'].value, 'Newer guidance');
  assert.equal(fields['decision-memory-rationale'].value, '');
  assert.equal(context.memoryCaptureBusy, false);
});

test('Memory fixture uses actual rendering, durable callbacks and Undo with synthetic transport', () => {
  for (const boundary of [
    'function renderMemory()',
    'function visualAgentRequests()',
    'async function runDurableAction(',
    'function rejectPendingFrameCommands(',
    "$('#decision-memory-search').addEventListener",
    "$('#visual-agent-region').addEventListener",
    "$('#undo').addEventListener",
    "$('#redo').addEventListener",
  ])
    assert.ok(fixture.includes(boundary), boundary);
  assert.match(fixture, /createNextDesignMemory as createRealDesignMemory/);
  assert.match(fixture, /async function requestCommand\(command,payload=\{\}\)/);
  assert.match(fixture, /server.listen\(port,\s*'127\.0\.0\.1'/);
  assert.match(fixture, /FOUNDRY_MEMORY_FIXTURE_PORT\s*\?\?\s*0/);
  assert.match(fixture, /No live Foundry session or provider/);
  assert.doesNotMatch(
    fixture,
    /fetch\(|localStorage|sessionStorage|chromium\.launch|from ['"](?:playwright|@playwright\/test)/,
  );
  assert.doesNotMatch(fixture, /ses_[a-z0-9]+|__foundry_session|__foundry_token/);
});

test('Memory pilot gates a presentation-only view controller around original capture nodes', () => {
  const adapter = file('next-design-memory.js'),
    helper = file('foundry-pilot-memory.js');
  assert.match(adapter, /foundryFoundationsEnabled\(\)\s*\? createPilotDesignMemory\(root\)/);
  assert.match(
    adapter,
    /pilot\?\.update\(\{ decision, decisions, filtered, connected, canCapture, busy, error \}\)/,
  );
  assert.match(helper, /detail.hidden = next === 'capture'/);
  assert.match(helper, /capture.hidden = next !== 'capture'/);
  assert.match(helper, /show\(!hasDecisions \? 'capture' : \(view \?\? 'read'\)\)/);
  assert.match(helper, /context.append\(contextNode.previousElementSibling, contextNode\)/);
  assert.match(
    helper,
    /outcome.append\(outcomeNode.previousElementSibling, outcomeNode, outcomeHelp\)/,
  );
  assert.match(helper, /form.prepend\(context, outcome\)/);
  assert.match(
    helper,
    /root.addEventListener\([\s\S]*?'click',[\s\S]*?show\('capture'\)[\s\S]*?true,\s*\)/,
  );
  assert.match(
    helper,
    /Saved references explain this decision. They do not verify the current product/,
  );
  assert.match(helper, /Context match, not a confidence or verification score/);
  assert.doesNotMatch(
    helper,
    /fetch\(|requestCommand\(|runDurableAction\(|postMessage\(|cloneNode\(|localStorage|sessionStorage/,
  );
  assert.doesNotMatch(helper, /\.(?:value|disabled)\s*=/);
});

test('isolated Memory assertions cover truthful evidence, state, drafts and original ownership', () => {
  for (const state of [
    'approved',
    'rejected',
    'rule',
    'disabled',
    'evidence',
    'conflict',
    'empty',
    'no-selection',
    'offline',
    'error',
  ]) {
    assert.ok(fixture.includes(`'${state}'`), state);
  }
  for (const assertion of [
    'Search includes rationale and ignores case',
    'No search match is distinct from an empty project library',
    'Context-match percentage never claims confidence or quality',
    'Evidence references are not relabeled as verified source changes',
    'Capture draft, focus and caret survive unrelated rendering',
    'Failed acknowledgement preserves capture draft and reports not saved',
    'Acknowledgement clears submitted fields but cannot erase newer capture input',
    'Switching decisions restores each unsubmitted correction draft',
    'Correction field focus and selection survive same-decision refresh',
    'Original global Undo restores the synthetic adapter snapshot',
    'Empty pilot starts with the original capture form instead of an empty detail rail',
    'Original New decision opens capture before focusing the original title input',
    'Back to decision changes only presentation and preserves the capture draft',
    'Selecting a saved row restores reading without discarding capture input',
    'Failed capture remains in the visible composer for recovery',
    'Busy capture stays visible instead of silently navigating to a record',
    'Gate off keeps the capture rail and introduces no pilot controls',
    'Narrow capture lets the containing page scroll instead of trapping wheel or touch input',
    'Desktop and compact capture stay in the content row without overlapping the footer',
  ])
    assert.ok(fixture.includes(assertion), assertion);
  assert.match(fixture, /\$\(selector\)===originalNodes\[key\]/);
});
