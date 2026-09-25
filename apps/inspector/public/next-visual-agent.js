import { visualAgentResponsePresentation } from './workflow.js';

export function agentConnectionTitle(connected, listener) {
  if (!connected) return 'Live preview disconnected';
  return listener ? 'Agent listener connected' : 'No agent listening';
}
export function agentConnectionCopy(connected, listener) {
  if (!connected)
    return 'Reconnect the live preview before sending visual context. Your draft is preserved.';
  return listener
    ? 'Listener connected. A request starts when an agent claims it.'
    : 'Questions can be queued locally, but no response can begin until an agent connects. Queuing does not start an agent.';
}
export function agentRequestLabel(request) {
  if (!request) return 'New question';
  if (request.status === 'thinking')
    return request.agent ? `${request.agent.name} is working` : 'Awaiting agent claim';
  if (request.status === 'queued') return 'Queued';
  if (request.status === 'needs_attention') return 'Needs attention';
  return visualAgentResponsePresentation(request).label;
}
export function agentCanSend({ connected, contextCount, prompt, busy }) {
  return Boolean(connected && contextCount && prompt.trim() && !busy);
}
export function agentSourceLabel(source) {
  if (typeof source === 'string') return source;
  return source?.file
    ? `${source.file}${source.line ? `:${source.line}` : ''}${source.column ? `:${source.column}` : ''}`
    : 'Source mapping unavailable';
}
const node = (tag, className = '', text) => {
  const e = document.createElement(tag);
  e.className = className;
  if (text != null) e.textContent = text;
  return e;
};

export function createNextVisualAgent(root) {
  root.classList.add('next-visual-agent');
  root.dataset.nextIconScope = '';
  root.querySelector('.mode-head h1').textContent = 'Visual agent';
  root.querySelector('.mode-head p').textContent =
    'Ask in context, compare proposals and choose what enters Review';
  root.querySelector('#visual-agent-review').textContent = 'Review changes';
  const history = root.querySelector('.visual-agent-threads');
  const historyHeader = history.querySelector('header');
  const status = root.querySelector('#visual-agent-status');
  historyHeader.replaceChildren(node('h2', '', 'Questions'), status);
  const shell = root.querySelector('.visual-agent-shell');
  const conversation = root.querySelector('#visual-agent-conversation');
  const main = node('section', 'next-agent-main');
  const mainHeader = node('header', 'next-agent-heading');
  const heading = node('h2', '', 'New question');
  const requestStatus = node('span', 'next-agent-muted');
  mainHeader.append(heading, requestStatus);
  conversation.before(main);
  const form = root.querySelector('.visual-agent-compose-form');
  const prompt = root.querySelector('#visual-agent-prompt');
  const comment = root.querySelector('#visual-agent-comment');
  const ask = root.querySelector('#visual-agent-ask');
  const connectionNotice = node('section', 'next-agent-connection-notice');
  connectionNotice.id = 'visual-agent-connection-notice';
  const connectionStatus = node('div', 'next-agent-connection-status');
  connectionStatus.setAttribute('role', 'status');
  connectionStatus.setAttribute('aria-live', 'polite');
  const connectionTitle = node('strong');
  const connectionMessage = node('p', 'next-agent-help');
  connectionStatus.append(connectionTitle, connectionMessage);
  const connectionHelp = node('details', 'next-agent-connect-help');
  connectionHelp.append(
    node('summary', '', 'How to connect'),
    node(
      'p',
      'next-agent-help',
      'In your coding agent, ask: “Start listening to this Foundry session for Visual Agent requests.” Keep that task running, then return here. Saved questions do not need to be sent again.',
    ),
  );
  connectionNotice.append(connectionStatus, connectionHelp);
  for (const field of [prompt, ask]) {
    const descriptions = new Set(
      (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean),
    );
    descriptions.add(connectionNotice.id);
    field.setAttribute('aria-describedby', [...descriptions].join(' '));
  }
  const note = node('details', 'next-agent-comment');
  note.append(node('summary', '', 'Add a context note'), comment.closest('label'));
  const composerHead = node('div', 'next-agent-composer-head');
  const composeLabel = node('strong', '', 'New question');
  composerHead.append(composeLabel, note);
  const sendRow = node('div', 'next-agent-send-row');
  const hint = node('p', 'next-agent-help');
  sendRow.append(hint, ask);
  const error = node('p', 'next-agent-error');
  error.setAttribute('role', 'alert');
  form.prepend(connectionNotice, composerHead);
  form.append(error, sendRow);
  prompt.rows = 3;
  prompt.placeholder = 'What would you like to improve in the attached selection?';
  main.append(mainHeader, conversation, form);
  const right = root.querySelector('.visual-agent-compose');
  right.querySelector('header').replaceChildren(node('h2', '', 'Visual context'));
  const scroll = node('div', 'next-agent-context-scroll');
  const connection = node('section', 'next-agent-connection');
  const live = node('p', 'next-agent-help');
  connection.append(node('h3', '', 'Connection'), live);
  const current = root.querySelector('.visual-agent-context-section');
  current.prepend(node('h3', '', 'For your next question'));
  current.append(
    node(
      'p',
      'next-agent-help',
      'The current selection and region are captured when you send. They do not alter earlier questions.',
    ),
  );
  const snapshot = node('details', 'next-agent-snapshot');
  snapshot.append(node('summary', '', 'Context sent with this question'));
  const saved = node('div', 'next-agent-saved');
  snapshot.append(saved);
  scroll.append(connection, current, snapshot, root.querySelector('.visual-agent-safety'));
  right.append(scroll);
  const footer = node('footer', 'next-agent-footer');
  footer.append(
    node(
      'span',
      '',
      'Proposals stay separate from Review until you choose. Source changes require reviewed Apply.',
    ),
  );
  root.append(footer);
  let model,
    savedScroll,
    proposalDetails = new Set();
  function sendState() {
    if (!model) return;
    ask.disabled = !agentCanSend({ ...model, prompt: prompt.value });
    ask.textContent = model.busy
      ? 'Queueing…'
      : model.listener
        ? 'Ask visual agent'
        : 'Queue for agent';
  }
  function updateConnection({ connected = model?.connected, listener = model?.listener } = {}) {
    if (!model) return;
    model = { ...model, connected, listener };
    const title = agentConnectionTitle(connected, listener);
    const copy = agentConnectionCopy(connected, listener);
    if (connectionTitle.textContent !== title) connectionTitle.textContent = title;
    if (connectionMessage.textContent !== copy) connectionMessage.textContent = copy;
    connectionNotice.dataset.state = !connected ? 'offline' : listener ? 'connected' : 'waiting';
    connectionHelp.hidden = !connected || listener;
    live.textContent = copy;
    hint.textContent = !connected
      ? 'Preview offline. Reconnect to send.'
      : !model.contextCount
        ? 'Select layers or draw a region first.'
        : `${model.contextCount} attached · ${listener ? 'ready to queue' : 'saved until an agent connects'}`;
    sendState();
  }
  prompt.addEventListener('input', sendState);
  function capture() {
    savedScroll = {
      requestId: model?.request?.id,
      conversation: conversation.scrollTop,
      history: root.querySelector('#visual-agent-thread-list').scrollTop,
      context: scroll.scrollTop,
    };
    proposalDetails = new Set(
      [...conversation.querySelectorAll('[data-next-agent-details][open]')].map(
        (e) => e.dataset.nextAgentDetails,
      ),
    );
  }
  function update(next) {
    model = next;
    const { request, requests, connected, listener, contextCount, busy, error: failure } = next;
    heading.textContent = request ? 'Conversation' : 'New question';
    requestStatus.textContent = request ? agentRequestLabel(request) : 'Not sent';
    status.textContent = String(requests.length);
    updateConnection({ connected, listener });
    composeLabel.textContent = request ? 'Ask another question' : 'New question';
    error.textContent = failure || '';
    error.hidden = !failure;
    root.querySelector('#visual-agent-region').disabled = !connected || busy;
    root.querySelector('#visual-agent-clear-region').disabled ||= !connected || busy;
    for (const button of root.querySelectorAll('[data-visual-agent-thread]')) {
      const item = requests.find((r) => r.id === button.dataset.visualAgentThread);
      button.setAttribute('aria-pressed', String(item?.id === request?.id));
      button.querySelector('small').textContent = agentRequestLabel(item);
      button.title = item?.title ?? '';
    }
    const headStatus = conversation.querySelector('.visual-agent-conversation-head > span');
    if (headStatus) headStatus.textContent = agentRequestLabel(request);
    const empty = root.querySelector('#visual-agent-thread-list .visual-agent-empty');
    if (empty) {
      empty.querySelector('strong').textContent = 'No questions yet';
      empty.querySelector('p').textContent = 'Sent questions and responses stay in this session.';
    }
    const contextFooter = root.querySelector('#visual-agent-context > footer');
    if (contextFooter)
      [...contextFooter.children].forEach((span, index) => {
        span.textContent = `${['Breakpoint', 'Theme', 'State'][index]}: ${span.textContent}`;
      });
    snapshot.hidden = !request;
    saved.replaceChildren();
    if (request) {
      for (const target of request.context.targets ?? []) {
        const item = node('article');
        item.append(
          node('strong', '', target.label),
          node('code', '', agentSourceLabel(target.source)),
        );
        saved.append(item);
      }
      if (request.context.region)
        saved.append(
          node(
            'p',
            'next-agent-help',
            `Captured region · ${Math.round(request.context.region.width)} × ${Math.round(request.context.region.height)}`,
          ),
        );
      saved.append(
        node(
          'p',
          'next-agent-help',
          `${request.context.viewport?.width ?? '—'} × ${request.context.viewport?.height ?? '—'} · ${request.context.breakpoint ?? 'current'} · ${request.context.theme ?? 'current'} · ${request.context.state ?? 'current'}`,
        ),
      );
    }
    for (const proposal of conversation.querySelectorAll('.visual-agent-proposal')) {
      const grid = proposal.querySelector('.visual-agent-proposal-grid');
      const id = proposal.querySelector('[data-agent-proposal]')?.dataset.agentProposal;
      const details = node('details', 'next-agent-proposal-details');
      details.dataset.nextAgentDetails = id;
      details.open = proposalDetails.has(id);
      details.append(node('summary', '', 'Reasoning, values and verification'), grid);
      proposal.querySelector('footer').before(details);
    }
    sendState();
    if (savedScroll) {
      conversation.scrollTop = savedScroll.requestId === request?.id ? savedScroll.conversation : 0;
      root.querySelector('#visual-agent-thread-list').scrollTop = savedScroll.history;
      scroll.scrollTop = savedScroll.context;
      savedScroll = null;
    }
  }
  return { capture, update, updateConnection };
}
