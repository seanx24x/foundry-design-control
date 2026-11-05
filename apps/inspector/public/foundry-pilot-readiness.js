const enabled = () =>
  Boolean(document.documentElement?.dataset.foundryPilot) &&
  document.querySelector('#app-shell')?.dataset.next === 'true';
export function pilotReadinessActive() {
  return enabled();
}
const text = (node, value) => {
  if (node && node.textContent !== value) node.textContent = value;
};

// Availability is the report's claim, never inferred from configuration or a
// connected preview alone. It is not evidence of a completed source change.
export function readinessCapabilityItems(readiness, failure = '') {
  return [
    ['inspect', 'Inspect'],
    ['stage', 'Stage edits'],
    ['apply', 'Apply to source'],
  ].map(([key, label]) => {
    const value = failure ? undefined : readiness?.capabilities?.[key];
    return {
      key,
      label,
      state: value === true ? 'available' : value === false ? 'unavailable' : 'unknown',
      value: value === true ? 'Available' : value === false ? 'Needs attention' : 'Not confirmed',
    };
  });
}

export function refinePilotReadiness({
  readiness,
  loading = false,
  failure = '',
  backgroundLoading = false,
  recoveryFocusId,
} = {}) {
  if (!enabled()) return false;
  const dialog = document.querySelector('#readiness-dialog');
  const body = dialog?.querySelector('.readiness-body');
  const checks = document.querySelector('#readiness-checks');
  if (!body || !checks) return false;
  if (!body.querySelector('.foundry-readiness-capabilities')) {
    const capabilities = document.createElement('section');
    capabilities.className = 'foundry-readiness-capabilities';
    capabilities.setAttribute('aria-labelledby', 'foundry-capabilities-title');
    capabilities.innerHTML =
      '<h3 id="foundry-capabilities-title">Available in this project</h3><dl></dl><p>Based on the latest project check. Source changes still require review and an explicit Apply.</p>';
    for (const item of readinessCapabilityItems()) {
      const row = document.createElement('div');
      row.dataset.readinessCapability = item.key;
      row.innerHTML = `<dt>${item.label}</dt><dd></dd>`;
      capabilities.querySelector('dl').append(row);
    }
    const heading = document.createElement('div');
    heading.className = 'foundry-readiness-checks-heading';
    heading.innerHTML =
      '<h3 id="foundry-checks-title">Project checks</h3><span id="foundry-checks-count"></span>';
    checks.before(capabilities, heading);
    checks.setAttribute('aria-labelledby', 'foundry-checks-title');
    body.querySelector('.workflow-journey').setAttribute('aria-labelledby', 'workflow-phase');
    document.querySelector('#workflow-phase').setAttribute('role', 'heading');
    document.querySelector('#workflow-phase').setAttribute('aria-level', '3');
    const command = document.querySelector('#readiness-command');
    command.setAttribute('aria-label', 'Manual recovery instructions');
    command.querySelector('code').tabIndex = 0;
  }
  for (const item of readinessCapabilityItems(readiness, failure)) {
    const row = body.querySelector(`[data-readiness-capability="${item.key}"]`);
    row.dataset.state = item.state;
    text(row.querySelector('dd'), item.value);
  }
  const all = readiness?.checks ?? [];
  text(
    body.querySelector('#foundry-checks-count'),
    failure
      ? 'Unavailable'
      : all.length
        ? `${all.filter((item) => item.status === 'passed').length} of ${all.length} passed`
        : loading
          ? 'Checking…'
          : 'Not checked',
  );
  checks.setAttribute('aria-busy', String(loading && !backgroundLoading));
  for (const row of checks.querySelectorAll('.readiness-check')) {
    text(
      row.querySelector('.readiness-result'),
      row.dataset.status === 'warning'
        ? 'Attention'
        : row.dataset.status === 'failed'
          ? 'Failed'
          : row.dataset.status === 'passed'
            ? 'Passed'
            : 'Not confirmed',
    );
  }
  // Put actionable checks first without replacing their original controls or
  // moving them outside the application-owned delegated list.
  const rows = [...checks.querySelectorAll('.readiness-check')];
  const rank = { failed: 0, warning: 1, passed: 2 };
  const ordered = [...rows].sort(
    (a, b) => (rank[a.dataset.status] ?? 3) - (rank[b.dataset.status] ?? 3),
  );
  if (rows.some((row, index) => row !== ordered[index])) {
    const focused = checks.contains(document.activeElement) ? document.activeElement : null;
    const scrollTop = body.scrollTop;
    checks.append(...ordered);
    focused?.focus({ preventScroll: true });
    body.scrollTop = scrollTop;
  }
  const error = checks.querySelector('p.readiness-error');
  if (error) {
    const item = document.createElement('li');
    item.className = error.className;
    item.setAttribute('role', 'alert');
    item.textContent = error.textContent;
    error.replaceWith(item);
  }
  if (
    dialog.open &&
    recoveryFocusId &&
    ![...checks.querySelectorAll('[data-readiness-recovery]')].some(
      (node) => node.dataset.readinessRecovery === recoveryFocusId,
    )
  ) {
    document.querySelector('#readiness-refresh').focus({ preventScroll: true });
  }
  const command = document.querySelector('#readiness-command');
  if (!loading && command.dataset.pilotRecoveryCheck) {
    const sourceCheck = readiness?.checks?.find(
      (item) => item.id === command.dataset.pilotRecoveryCheck,
    );
    const recovery = sourceCheck?.recovery;
    if (
      failure ||
      sourceCheck?.status === 'passed' ||
      JSON.stringify(recovery) !== command.dataset.pilotRecoverySignature
    ) {
      const heldFocus = command.contains(document.activeElement);
      command.hidden = true;
      delete command.dataset.pilotRecoveryCheck;
      delete command.dataset.pilotRecoverySignature;
      if (heldFocus && dialog.open)
        document.querySelector('#readiness-refresh').focus({ preventScroll: true });
    }
  }
  return true;
}

export function rememberPilotRecovery(checkId, recovery) {
  if (!enabled()) return;
  const command = document.querySelector('#readiness-command');
  command.dataset.pilotRecoveryCheck = checkId;
  command.dataset.pilotRecoverySignature = JSON.stringify(recovery);
}

export function pilotConnectionHeadline(current, model) {
  return enabled() && model.connected && !model.runtimeConnected
    ? {
        state: 'degraded',
        label: 'Preview only',
        title:
          'Live preview connected; the local Foundry runtime is unavailable. Apply-agent availability is separate.',
      }
    : current;
}

const connectionDetails = {
  runtimeConnected: 'Local Foundry workspace',
  connected: 'Selection and rendered measurements',
  listenerConnected: 'Executes reviewed source changes',
};
export function refinePilotConnection(connection, model) {
  if (!enabled() || !connection) return false;
  for (const node of connection.querySelectorAll('[data-next-connection]')) {
    const row = node.parentElement;
    row.dataset.connected = String(Boolean(model[node.dataset.nextConnection]));
    if (!row.querySelector('.foundry-connection-detail')) {
      const detail = document.createElement('span');
      detail.className = 'foundry-connection-detail';
      detail.textContent = connectionDetails[node.dataset.nextConnection] ?? '';
      row.querySelector('dt').append(detail);
    }
  }
  if (!connection.querySelector('.foundry-connection-note')) {
    const note = document.createElement('p');
    note.className = 'foundry-connection-note';
    note.textContent =
      'Preview and Apply-agent availability are separate. Configuration alone is not a live connection.';
    connection.querySelector('[data-next-connection-details]').before(note);
  }
  return true;
}

export function refinePilotPreviewFallback() {
  if (!enabled()) return false;
  const stage = document.querySelector('#canvas-stage');
  const fallback = document.querySelector('#preview-fallback');
  const loading = document.querySelector('#preview-loading');
  if (!stage || !fallback || !loading) return false;
  const menuLink = document.querySelector('#direct-preview-menu');
  if (menuLink) menuLink.hidden = !document.querySelector('#direct-preview')?.getAttribute('href');
  if (!stage.querySelector('.foundry-preview-status')) {
    const host = document.createElement('div');
    host.className = 'foundry-preview-status';
    // Recovery UI is workspace chrome, not a Canvas manipulation target. Keep
    // native scrolling and control clicks even while Pan or Space is active.
    host.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true });
    host.addEventListener('pointerdown', (event) => event.stopPropagation());
    stage.append(host);
    host.append(loading, fallback);
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-live', 'polite');
    fallback.setAttribute('role', 'region');
    fallback.setAttribute('aria-labelledby', 'foundry-preview-status-title');
    fallback.querySelector('strong').id = 'foundry-preview-status-title';
    const actions = document.createElement('div');
    actions.className = 'foundry-preview-recovery-actions';
    actions.append(
      document.querySelector('#reconnect-preview'),
      document.querySelector('#direct-preview'),
    );
    fallback.append(actions);
    const note = document.createElement('small');
    note.className = 'foundry-overlay-explanation';
    note.textContent =
      'Overlay preview opens the product in a new tab. It does not repair the embedded connection.';
    fallback.append(note);
    const link = document.querySelector('#direct-preview');
    link.setAttribute('rel', 'noopener');
    link.setAttribute('aria-label', 'Open overlay preview in a new tab');
    link.title = 'Open overlay preview in a new tab';
  }
  return true;
}
