import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { agentProposalPresentation } from '../public/foundry-pilot-agent.js';

const file = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
const app = file('app.js');
const fixture = () =>
  readFileSync(
    new URL('../../../scripts/test-foundry-agent-pilot-fixture.mjs', import.meta.url),
    'utf8',
  );

test('pilot proposal labels distinguish proposed, previewed, reviewed and rejected work', () => {
  for (const [status, label, boundary] of [
    ['proposed', 'Proposed', /separate step/],
    ['previewing', 'Preview active', /source is unchanged/],
    ['promoted', 'In Review', /require reviewed Apply/],
    ['rejected', 'Rejected', /No source change is recorded/],
  ]) {
    const result = agentProposalPresentation(status);
    assert.equal(result.label, label);
    assert.match(result.copy, boundary);
    assert.doesNotMatch(result.label, /verified|applied|passed/i);
  }
  assert.deepEqual(agentProposalPresentation('unknown'), agentProposalPresentation('proposed'));
});

function proposalHarness({
  connected = true,
  acknowledged = true,
  persisted = true,
  switchFailure = false,
} = {}) {
  const events = [];
  const proposal = {
    id: 'direction',
    name: 'Headline direction',
    status: 'proposed',
    branchId: 'branch',
    summary: 'A stronger headline.',
    reasoning: ['Keep line breaks readable.'],
    changes: [{ target: { locator: { selector: '#headline' } } }],
  };
  const request = {
    id: 'question',
    proposals: [proposal],
    context: { targets: [{ selector: '#headline' }] },
  };
  const updated = {
    visualAgentRequests: [request],
    designBranches: [{ id: 'branch', changes: proposal.changes }],
    changeSet: { changes: proposal.changes },
  };
  const context = {
    visualAgentProposalBusy: false,
    visualAgentActionError: '',
    visualAgentRequestId: '',
    bridgeConnected: connected,
    sessionId: 'isolated',
    activeDesignDirection: () => ({ changes: ['saved-main'] }),
    api: async (url, options) => {
      const body = JSON.parse(options.body);
      events.push({ type: 'save', body });
      if (body.action === 'previewed' && persisted) proposal.status = 'previewing';
      return updated;
    },
    renderSession: (value) => events.push({ type: 'render', value }),
    requestCommand: async (command, payload) => {
      events.push({ type: 'command', command, payload });
      if (switchFailure) throw Error('Synthetic disconnect');
      return { switched: acknowledged };
    },
    viewSelectionOnCanvas: async (selector) => events.push({ type: 'canvas', selector }),
    setMode: (mode) => events.push({ type: 'mode', mode }),
    toast: (message) => events.push({ type: 'toast', message }),
    renderChangeSummary: () => events.push({ type: 'summary' }),
    renderVisualAgent: () => {},
  };
  const start = app.indexOf('async function handleVisualAgentProposal('),
    end = app.indexOf('function deliveryStatusLabel(', start);
  assert.ok(start >= 0 && end > start);
  const action = runInNewContext(app.slice(start, end) + ';handleVisualAgentProposal', context);
  const button = (kind) => ({
    dataset: { agentProposalAction: kind, agentRequest: 'question', agentProposal: 'direction' },
  });
  return { action, button, events, context, proposal };
}

test('Visual Agent preview reaches Canvas only after rendered and saved acknowledgement', async () => {
  const { action, button, events, context } = proposalHarness();
  await action(button('preview'));
  const switched = events.findIndex((item) => item.command === 'switch-design-branch');
  const acknowledged = events.findIndex((item) => item.body?.action === 'previewed');
  const canvas = events.findIndex((item) => item.type === 'canvas');
  assert.ok(switched >= 0 && acknowledged > switched && canvas > acknowledged);
  assert.equal(events[canvas].selector, '#headline');
  assert.equal(context.visualAgentProposalBusy, false);
  assert.equal(context.visualAgentRequestId, 'question');
  assert.ok(
    !events.some((item) => item.body?.action === 'promote' || item.command?.includes('apply')),
  );
});

test('offline, unacknowledged and unpersisted previews never claim a live Canvas result', async () => {
  for (const options of [
    { connected: false },
    { acknowledged: false },
    { persisted: false },
    { switchFailure: true },
  ]) {
    const { action, button, events, context } = proposalHarness(options);
    await action(button('preview'));
    assert.ok(!events.some((item) => item.type === 'canvas' || item.type === 'mode'));
    assert.ok(
      events.some((item) => item.type === 'toast' && /saved|previewing failed/.test(item.message)),
    );
    assert.equal(context.visualAgentProposalBusy, false);
  }
});

test('proposal busy lock prevents duplicate dispatch and promotion retains Review boundary', async () => {
  const { action, button, events, context } = proposalHarness({ connected: false });
  context.visualAgentProposalBusy = true;
  await action(button('preview'));
  assert.equal(events.length, 0);
  context.visualAgentProposalBusy = false;
  await action(button('promote'));
  assert.ok(events.some((item) => item.body?.action === 'promote'));
  assert.ok(events.some((item) => item.type === 'mode' && item.mode === 'review'));
  assert.ok(
    events.some((item) => item.type === 'toast' && /remain unchanged until/.test(item.message)),
  );
  assert.ok(!events.some((item) => item.type === 'command'));
});

test('Visual Agent pilot uses explicit gating and keeps the original renderer/action ownership', () => {
  const source = file('next-visual-agent.js');
  assert.match(source, /foundryFoundationsEnabled\(\)/);
  assert.match(source, /foundry-pilot-agent\.js/);
  assert.match(source, /main.append\(mainHeader, conversation, form\)/);
  assert.match(source, /savedScroll.requestId === request\?\.id/);
  assert.match(source, /proposalDetails.has\(id\)/);
  assert.match(source, /request.context.targets/);
  const helper = file('foundry-pilot-agent.js');
  assert.doesNotMatch(
    helper,
    /fetch\(|requestCommand\(|runDurableAction\(|postMessage\(|cloneNode\(|localStorage|sessionStorage/,
  );
  assert.doesNotMatch(helper, /\.(?:value|disabled)\s*=/);
  assert.match(helper, /attachment\.append\(summary, context\)/);
  assert.match(helper, /dock\.append\(form\)/);
  assert.match(
    helper,
    /root\.querySelector\('\.next-agent-heading'\)\.append\(root\.querySelector\('\.next-agent-snapshot'\)\)/,
  );
  assert.match(helper, /root\.dataset\.agentConversation = String\(Boolean\(request\)\)/);
  assert.match(helper, /value\.textContent = source\.textContent/);
  assert.match(helper, /if \(exact && !values\)/);
  assert.match(file('foundry-pilot-agent.css'), /:root\[data-foundry-pilot='agent'\]/);
});

test('Visual Agent fixture extracts real rendering and original actions with synthetic transport only', () => {
  const source = fixture();
  for (const boundary of [
    'function visualAgentRequests()',
    'function activeVisualAgentPreview()',
    'async function handleVisualAgentProposal(',
    'function deliveryStatusLabel(',
  ])
    assert.ok(source.includes(boundary), boundary);
  assert.match(source, /createNextVisualAgent as createRealVisualAgent/);
  assert.match(source, /const responseModule = workflow.match/);
  assert.match(source, /response.end\(responseModule\)/);
  assert.match(source, /async function api\(url,options\)/);
  assert.match(source, /async function requestCommand\(command,payload\)/);
  assert.match(source, /server.listen\(port,\s*'127\.0\.0\.1'/);
  assert.match(source, /No provider or live Foundry session/);
  assert.doesNotMatch(
    source,
    /from ['"](?:playwright|@playwright\/test)|chromium\.launch|localStorage|sessionStorage|fetch\(/,
  );
  assert.doesNotMatch(source, /ses_[a-z0-9]+|__foundry_token|__foundry_session/);
});

test('Visual Agent isolated browser assertions cover truthful states, persistence and acknowledgements', () => {
  const source = fixture();
  for (const state of [
    'empty',
    'queued',
    'thinking',
    'needs_attention',
    'proposals',
    'advice',
    'offline',
  ])
    assert.ok(source.includes(`'${state}'`), state);
  for (const assertion of [
    'Presence updates preserve focus, draft and context note',
    'Failed save retains draft and context note',
    'Acknowledgement cannot erase newer draft input',
    'Original retry handler returns interrupted work to the queue',
    'Proposal disclosure remains open after refresh',
    'Proposal disclosure retains native keyboard-focusable summary semantics',
    'Review label never implies source Apply is complete',
    'Saved question context stays separate from current selection',
    'Preview is separate from Review until explicitly chosen',
    'No source Apply or provider activity is invoked',
    'Repeated rendering does not duplicate regions or disclosures',
    'Pilot presentation class follows the explicit gate',
    'Empty pilot uses the dedicated composer-first layout state',
    'Saved questions use the conversation layout state',
    'Current attachments retain their original nodes inside one native composer disclosure',
    'Pilot shell has only Questions and conversation, without a third direct-child context rail',
    'Captured context lives in the persistent heading outside the renderer-owned conversation',
    'One composer dock preserves the original form within the main panel',
    'Expanded attachment and connection disclosures survive presence and renderer refresh',
    'Collapsed attachment and connection disclosures survive refresh',
    'Collapsed attachment summary identifies the actual current selection',
    'Exact proposed values remain visible outside the collapsed reasoning disclosure',
    'Exact-value summary remains a proposed change, not rendered verification',
    'Current attachment summary updates without changing the captured question context',
    'Captured context disclosure identity and open state survive conversation replacement',
    'Repeated rendering and presence updates do not duplicate composer, attachment or captured-context wrappers',
    'Repeated refinement produces one accurate exact-value summary per proposal',
    'Collapsed composer disclosures remain collapsed across scenario and presence changes',
    'Returning to a new question restores the composer-first layout state',
    'Gate off does not introduce pilot layout state, wrappers or value summaries',
    'Gate off retains the original three-panel context rail and form ownership',
    'Gate off retains its original proposal and context layout after repeated rendering',
  ])
    assert.ok(source.includes(assertion), assertion);
  assert.match(source, /summary\.tabIndex===0/);
  assert.match(source, /summary\.focus\(\);check\(document\.activeElement===summary/);
  for (const node of ['contextAside', 'context', 'contextSection'])
    assert.match(source, new RegExp(`${node}:`));
});
