import { workflowStep } from './workflow.js';

const escape = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export function createReadinessUI({
  api,
  sessionId,
  state,
  navigate,
  recover,
  renderIcons,
  bindStatusTrigger = true,
}) {
  const dialog = document.querySelector('#readiness-dialog');
  const checks = document.querySelector('#readiness-checks');
  const guide = document.querySelector('#workflow-trigger');
  const refresh = document.querySelector('#readiness-refresh');
  let readiness = null;
  let loading = false;
  let failure = '';
  let lastMarkup = '';
  let refreshTimer;
  let refreshPending = false;
  let backgroundLoading = false;
  let lastConnection;

  // Keep polite live regions quiet when a polling update has no new information.
  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function update() {
    const model = state();
    const connection = `${Boolean(model.previewConnected)}:${Boolean(model.listenerConnected)}`;
    const connectionChanged = lastConnection !== undefined && connection !== lastConnection;
    lastConnection = connection;
    if (connectionChanged && dialog.open) {
      if (loading) refreshPending = true;
      else queueMicrotask(() => dialog.open && void load({ background: true }));
    }
    const step = workflowStep({ ...model, readiness });
    guide.dataset.phase = step.phase;
    setText(guide.querySelector('span'), step.label);
    guide.title = `${step.phase}. ${step.detail}`;
    setText(document.querySelector('#workflow-phase'), step.phase);
    setText(document.querySelector('#workflow-detail'), step.detail);
    setText(document.querySelector('#workflow-next'), step.label);
    setText(document.querySelector('#workflow-status'), step.phase);
    setText(document.querySelector('#workflow-status-detail'), step.detail);
    const pendingCount = (model.session?.changeSet?.changes ?? []).filter(
      (change) => !['applied', 'rejected'].includes(change.status),
    ).length;
    setText(document.querySelector('#persistent-review-count'), String(pendingCount));
    setText(
      document.querySelector('#agent-connection-status'),
      model.listenerConnected ? 'Agent connected' : 'Agent offline',
    );
    document.querySelectorAll('[data-workflow-step]').forEach((node) => {
      const current = Number(node.dataset.workflowStep) === step.step;
      if (current) node.setAttribute('aria-current', 'step');
      else node.removeAttribute('aria-current');
    });
    setText(
      document.querySelector('#readiness-summary'),
      failure
        ? 'Readiness unavailable. Your edits are preserved.'
        : loading && !readiness
          ? 'Checking this project and its live connections…'
          : readiness?.ready
            ? 'Ready for a reviewed design change.'
            : readiness
              ? 'Some capabilities need attention. You can keep inspecting where supported.'
              : 'Check configuration separately from live connections.',
    );
    setText(
      document.querySelector('#readiness-updated'),
      readiness?.checkedAt ? `Checked ${new Date(readiness.checkedAt).toLocaleTimeString()}` : '',
    );
    refresh.disabled = loading && !backgroundLoading;
    setText(refresh, loading && !backgroundLoading ? 'Checking…' : 'Check again');
    const markup = failure
      ? `<p class="readiness-error" role="alert">${escape(failure)}</p>`
      : (readiness?.checks ?? [])
          .map(
            (check) =>
              `<li class="readiness-check" data-status="${escape(check.status)}"><span class="readiness-mark" aria-hidden="true"><i data-icon="${check.status === 'passed' ? 'check' : check.status === 'failed' ? 'close' : 'activity'}"></i></span><div><strong>${escape(check.label)}</strong><p>${escape(check.detail)}</p>${check.recovery ? `<button class="readiness-recovery" data-readiness-recovery="${escape(check.id)}">${escape(check.recovery.label)}</button>` : ''}</div><span class="readiness-result">${escape(check.status)}</span></li>`,
          )
          .join('');
    if (markup !== lastMarkup) {
      const focusedId = document.activeElement?.dataset?.readinessRecovery;
      const scroller = checks.closest('.readiness-body');
      const scrollTop = scroller?.scrollTop;
      checks.innerHTML = markup;
      renderIcons(checks);
      lastMarkup = markup;
      if (focusedId)
        checks
          .querySelector(`[data-readiness-recovery="${CSS.escape(focusedId)}"]`)
          ?.focus({ preventScroll: true });
      if (scroller && scrollTop !== undefined) scroller.scrollTop = scrollTop;
    }
  }

  async function load({ background = false } = {}) {
    if (!sessionId) return;
    if (loading) {
      if (!background) refreshPending = true;
      return;
    }
    loading = true;
    backgroundLoading = background;
    failure = '';
    update();
    try {
      readiness = await api(`/v1/sessions/${sessionId}/readiness`, {
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      failure = error instanceof Error ? error.message : 'The runtime did not return readiness.';
      readiness = null;
    } finally {
      loading = false;
      backgroundLoading = false;
      update();
      if (refreshPending) {
        refreshPending = false;
        if (dialog.open) void load({ background: true });
      }
    }
  }

  async function open() {
    if (!dialog.open) dialog.showModal();
    if (refreshTimer === undefined)
      refreshTimer = setInterval(() => {
        if (dialog.open) void load({ background: true });
      }, 2000);
    update();
    await load();
  }
  function next() {
    const step = workflowStep({ ...state(), readiness });
    if (step.action === 'readiness') return void open();
    dialog.close();
    navigate(step.action);
  }
  if (bindStatusTrigger)
    document.querySelector('#live-status').addEventListener('click', () => void open());
  document.querySelector('#readiness-close').addEventListener('click', () => dialog.close());
  document.querySelector('#workflow-next').addEventListener('click', next);
  guide.addEventListener('click', next);
  refresh.addEventListener('click', () => void load());
  checks.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-readiness-recovery]');
    if (!button) return;
    const recovery = readiness?.checks.find(
      (item) => item.id === button.dataset.readinessRecovery,
    )?.recovery;
    if (!recovery) return;
    button.disabled = true;
    const command = document.querySelector('#readiness-command');
    if (recovery.command || recovery.requiresAgentRestart) {
      command.hidden = false;
      command.querySelector('strong').textContent = recovery.command
        ? 'Next step in your terminal'
        : 'Restart your coding agent';
      command.querySelector('code').hidden = !recovery.command;
      command.querySelector('code').textContent = recovery.command ?? '';
      command.querySelector('p').textContent = recovery.requiresAgentRestart
        ? recovery.command
          ? 'Run this in the project terminal, then restart your agent session to reload its MCP connection. No configuration is changed here.'
          : 'Restart the coding agent session so it loads the updated Foundry MCP server, then ask it to listen for Foundry work. Return here and choose Check again. This button cannot restart the agent for you.'
        : 'Run this in the project terminal. Foundry will not execute shell commands from this dialog.';
      command.scrollIntoView({ block: 'nearest' });
      button.disabled = false;
      return;
    }
    try {
      await recover(recovery.id);
      await load();
    } catch (error) {
      failure = error instanceof Error ? error.message : 'The recovery did not complete.';
      update();
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
  dialog.addEventListener('close', () => {
    clearInterval(refreshTimer);
    refreshTimer = undefined;
    refreshPending = false;
    document.querySelector('#readiness-command').hidden = true;
  });
  window.addEventListener('pagehide', () => {
    clearInterval(refreshTimer);
    refreshTimer = undefined;
    refreshPending = false;
  });
  return { update, open, load };
}
