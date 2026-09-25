import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  agentConnectionCopy,
  agentConnectionTitle,
  agentRequestLabel,
  agentCanSend,
  agentSourceLabel,
} from '../public/next-visual-agent.js';
const helper = readFileSync(new URL('../public/next-visual-agent.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/next-visual-agent.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function previewHarness({ offline = false, switchFails = false, saveFails = false } = {}) {
  const events = [];
  const proposal = { id: 'p', branchId: 'branch', status: 'previewing' };
  const request = { id: 'q', proposals: [proposal] };
  const context = {
    activeSession: { activeDesignBranchId: 'branch', visualAgentRequests: [request] },
    visualAgentProposalBusy: false,
    visualAgentRequestId: '',
    visualAgentNewQuestion: true,
    bridgeConnected: !offline,
    sessionId: 'session',
    activeDesignDirection: () => ({ changes: ['proposal'] }),
    designBranchById: () => ({ changes: ['existing-main-change'] }),
    renderChangeSummary: () => {},
    requestCommand: async (command, payload) => {
      events.push(['command', command, payload]);
      if (switchFails) throw new Error('Preview offline');
      return { switched: true };
    },
    api: async (url, options) => {
      events.push(['save', url, options]);
      if (saveFails) throw new Error('Save failed');
      return { restored: true };
    },
    renderSession: (session) => events.push(['render', session]),
    setMode: (mode) => events.push(['mode', mode]),
    toast: (message) => events.push(['toast', message]),
  };
  const start = app.indexOf('function activeVisualAgentPreview()');
  const end = app.indexOf("$('#visual-preview-back').addEventListener", start);
  const actions = runInNewContext(
    `${app.slice(start, end)}; ({cancelVisualAgentPreview, returnToVisualAgentConversation, activeVisualAgentPreview})`,
    context,
  );
  return { actions, events, context };
}
test('cancel restores saved Main edits before saving direction and returns to the same conversation', async () => {
  const { actions, events, context } = previewHarness();
  await actions.cancelVisualAgentPreview();
  assert.deepEqual(events[0][2].nextChanges, ['existing-main-change']);
  assert.equal(events[1][0], 'save');
  assert.equal(events[2][0], 'render');
  assert.deepEqual(events[3], ['mode', 'agent']);
  assert.equal(context.visualAgentRequestId, 'q');
  assert.equal(context.visualAgentNewQuestion, false);
  assert.equal(context.visualAgentProposalBusy, false);
});
test('offline or unacknowledged cancellation does not save or navigate', async () => {
  for (const options of [{ offline: true }, { switchFails: true }]) {
    const { actions, events } = previewHarness(options);
    await actions.cancelVisualAgentPreview();
    assert.equal(
      events.some(([type]) => ['save', 'mode', 'render'].includes(type)),
      false,
    );
    assert.equal(events.at(-1)[0], 'toast');
  }
});
test('a failed cancellation save rolls rendered preview back and does not claim success', async () => {
  const { actions, events } = previewHarness({ saveFails: true });
  await actions.cancelVisualAgentPreview();
  assert.deepEqual(events.filter(([type]) => type === 'command').at(-1)[2].nextChanges, [
    'proposal',
  ]);
  assert.equal(
    events.some(([type]) => type === 'mode'),
    false,
  );
  assert.match(events.at(-1)[1], /Could not finish cancelling/);
});
test('Back to conversation preserves preview and restores its question', () => {
  const { actions, events, context } = previewHarness();
  actions.returnToVisualAgentConversation();
  assert.equal(context.visualAgentRequestId, 'q');
  assert.deepEqual(events, [['mode', 'agent']]);
});
test('successful preview reveals the proposal target only after acknowledgement', () => {
  const handler = app.slice(
    app.indexOf('async function handleVisualAgentProposal'),
    app.indexOf('function deliveryStatusLabel'),
  );
  assert.ok(
    handler.indexOf("action: 'previewed'") <
      handler.indexOf('await viewSelectionOnCanvas(selector)'),
  );
  assert.match(handler, /if \(!result\?\.switched\)/);
  assert.match(handler, /proposal.changes\[0\]\?\.target\?\.locator\?\.selector/);
  assert.match(app, /\$\('#compare'\).hidden = Boolean\(preview\)/);
});
test('connection copy distinguishes preview access, listener presence and claim', () => {
  assert.match(agentConnectionCopy(false, true), /Reconnect/);
  assert.match(agentConnectionCopy(true, false), /queued locally/);
  assert.match(agentConnectionCopy(true, true), /starts when an agent claims/);
});
test('preflight separates the live preview from the agent and explains queueing', () => {
  assert.equal(agentConnectionTitle(false, true), 'Live preview disconnected');
  assert.equal(agentConnectionTitle(false, false), 'Live preview disconnected');
  assert.equal(agentConnectionTitle(true, false), 'No agent listening');
  assert.equal(agentConnectionTitle(true, true), 'Agent listener connected');
  assert.match(agentConnectionCopy(true, false), /Queuing does not start an agent/);
  assert.match(agentConnectionCopy(false, false), /draft is preserved/);
  assert.equal(
    agentCanSend({
      connected: true,
      listener: false,
      contextCount: 1,
      prompt: 'Advice only',
      busy: false,
    }),
    true,
  );
});
test('connection notice is before the prompt and describes the prompt and send action', () => {
  assert.match(helper, /form.prepend\(connectionNotice, composerHead\)/);
  assert.match(helper, /for \(const field of \[prompt, ask\]\)/);
  assert.match(helper, /field.setAttribute\('aria-describedby'/);
  assert.match(helper, /connectionStatus.setAttribute\('role', 'status'\)/);
  assert.match(helper, /Saved questions do not need to be sent again/);
});
test('presence updates while typing without rebuilding the form or changing its draft', () => {
  const commit = app.slice(
    app.indexOf('function commitLoadedSession'),
    app.indexOf('function flushPendingSessionRender'),
  );
  assert.ok(
    commit.indexOf('nextVisualAgent?.updateConnection') < commit.indexOf('sessionRenderBlocked()'),
  );
  const update = helper.slice(
    helper.indexOf('function updateConnection'),
    helper.indexOf("prompt.addEventListener('input'"),
  );
  assert.doesNotMatch(update, /prompt.value\s*=|replaceChildren|innerHTML|\.focus\(/);
  assert.match(update, /sendState\(\)/);
});
test('only claimed work names an agent and completed advice is answered', () => {
  assert.equal(agentRequestLabel({ status: 'queued', agent: { name: 'Old agent' } }), 'Queued');
  assert.equal(agentRequestLabel({ status: 'thinking' }), 'Awaiting agent claim');
  assert.equal(
    agentRequestLabel({ status: 'thinking', agent: { name: 'Codex' } }),
    'Codex is working',
  );
  assert.equal(agentRequestLabel({ status: 'ready', proposals: [] }), 'Answered');
  assert.equal(agentRequestLabel({ status: 'needs_attention' }), 'Needs attention');
});
test('send requires a live preview, context, nonempty prompt and no pending submission', () => {
  const ready = { connected: true, contextCount: 1, prompt: 'Question', busy: false };
  assert.equal(agentCanSend(ready), true);
  for (const patch of [{ connected: false }, { contextCount: 0 }, { prompt: '  ' }, { busy: true }])
    assert.equal(agentCanSend({ ...ready, ...patch }), false);
});
test('saved source labels preserve exact file and line information', () => {
  assert.equal(agentSourceLabel({ file: 'src/a.tsx', line: 12, column: 4 }), 'src/a.tsx:12:4');
  assert.equal(agentSourceLabel('style.css:660:20'), 'style.css:660:20');
  assert.equal(agentSourceLabel(null), 'Source mapping unavailable');
});
test('composer and proposal actions remain original nodes, not optimistic replacements', () => {
  assert.match(helper, /main.append\(mainHeader, conversation, form\)/);
  assert.match(helper, /details.append\(node\('summary'.*\), grid\)/);
  assert.doesNotMatch(helper, /fetch\(|postMessage\(|requestCommand\(/);
});
test('new questions preserve drafts while pending requests cannot erase newer input', () => {
  assert.match(app, /visualAgentNewQuestion \? null : activeVisualAgentRequest\(\)/);
  assert.match(app, /if \(visualAgentSubmitting\) return/);
  assert.match(app, /if \(\$\('#visual-agent-prompt'\)\.value.trim\(\) === prompt\)/);
  assert.match(app, /finally \{\s*visualAgentSubmitting = false/);
});
test('saved request context is independent of current selection and disclosures survive refresh', () => {
  assert.match(helper, /request.context.targets/);
  assert.match(helper, /proposalDetails.has\(id\)/);
  assert.match(helper, /savedScroll.requestId === request\?\.id/);
});
test('Visual Agent uses shared rails, persistent composer and wrapping source evidence', () => {
  assert.match(css, /300px minmax\(0, 1fr\) 300px/);
  assert.match(css, /grid-template-rows: 44px minmax\(0, 1fr\) auto/);
  assert.match(css, /\.visual-agent-proposal-grid code \{[^}]*white-space: pre-wrap/);
  assert.match(css, /\.next-agent-footer \{[^}]*display: flex !important/);
});
