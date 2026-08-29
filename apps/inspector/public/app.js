const $ = (selector) => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const sessionId = params.get('session');
const token = params.get('token');
let activeSession;
let activeSurface;
let selectedNativeTargetId;

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 1800);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-foundry-token': token } : {}),
      ...options.headers,
    },
  });
  if (!response.ok)
    throw new Error((await response.json()).error ?? `Request failed: ${response.status}`);
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('json') ? response.json() : response.text();
}

function formatValue(value, unit = '') {
  const rendered = typeof value === 'string' ? value : JSON.stringify(value);
  return `${rendered}${unit}`;
}

function escapeText(value) {
  const node = document.createElement('span');
  node.textContent = String(value);
  return node.innerHTML;
}

async function setStatus(changeId, status) {
  await api(`/v1/sessions/${sessionId}/changes/${changeId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  await loadSession();
}

function renderSession(payload) {
  activeSession = payload;
  const { changeSet, verifications } = payload;
  $('#intro').classList.add('hidden');
  $('#sessions-section').classList.add('hidden');
  $('#empty-guide').classList.add('hidden');
  $('#session-view').classList.remove('hidden');
  $('#session-platform').textContent = `${changeSet.context.platform} session`;
  $('#session-title').textContent =
    changeSet.context.targetName || changeSet.context.targetUrl || 'Untitled surface';
  $('#session-meta').textContent =
    `${changeSet.context.projectRoot} · ${changeSet.context.breakpoint} · ${changeSet.context.theme}`;
  $('#change-count').textContent = String(changeSet.changes.length);
  $('#approved-count').textContent = String(
    changeSet.changes.filter((change) => ['approved', 'applied'].includes(change.status)).length,
  );
  $('#verified-count').textContent = String(verifications.filter((result) => result.passed).length);
  $('#updated-at').textContent =
    `Updated ${new Date(changeSet.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const changes = $('#changes');
  if (changeSet.changes.length === 0) {
    changes.innerHTML =
      '<div class="empty-ledger">Hold ⌥ and click an element in the instrumented preview to begin.</div>';
    return;
  }
  changes.innerHTML = changeSet.changes
    .map(
      (change, index) => `
    <article class="change">
      <div class="change-index">${String(index + 1).padStart(2, '0')}</div>
      <div>
        <h4>${escapeText(change.target.label)} · ${escapeText(change.property)}</h4>
        <p class="value-change">${escapeText(formatValue(change.before, change.unit))} → ${escapeText(formatValue(change.after, change.unit))}</p>
        <p>${escapeText(change.scope)} · ${escapeText(change.context.breakpoint)} · ${escapeText(change.context.theme)} · ${escapeText(change.confidence)}</p>
      </div>
      <div class="change-controls">
        <button class="status-button ${change.status === 'approved' ? 'active' : ''}" data-status="approved" data-id="${change.id}">Review</button>
        <button class="status-button ${change.status === 'rejected' ? 'active' : ''}" data-status="rejected" data-id="${change.id}">Exclude</button>
      </div>
    </article>`,
    )
    .join('');
  changes
    .querySelectorAll('[data-status]')
    .forEach((button) =>
      button.addEventListener('click', () => setStatus(button.dataset.id, button.dataset.status)),
    );
}

function nativeControlValue(control) {
  if (typeof control.value === 'object') return JSON.stringify(control.value);
  return String(control.value ?? '');
}

function renderNativeProperties(target) {
  selectedNativeTargetId = target.id;
  const controls = activeSurface.controlsByTarget[target.id] ?? [];
  $('#native-properties').innerHTML =
    `<p class="eyebrow">${escapeText(target.semanticRole)}</p><h3>${escapeText(target.label)}</h3><p>${escapeText(target.source?.file ?? target.confidence)}${target.source?.line ? `:${target.source.line}` : ''}</p>${controls.length ? controls.map((control, index) => `<div class="native-control"><label for="native-${index}">${escapeText(control.label)}</label>${control.valueType === 'select' ? `<select id="native-${index}" data-native-control="${index}">${(control.options ?? []).map((option) => `<option value="${escapeText(option.value)}" ${String(option.value) === String(control.value) ? 'selected' : ''}>${escapeText(option.label)}</option>`).join('')}</select>` : `<input id="native-${index}" data-native-control="${index}" type="${['number', 'length', 'motion'].includes(control.valueType) ? 'number' : control.valueType === 'color' ? 'color' : 'text'}" value="${escapeText(nativeControlValue(control))}" ${control.min != null ? `min="${control.min}"` : ''} ${control.max != null ? `max="${control.max}"` : ''} ${control.step != null ? `step="${control.step}"` : ''}/>`}</div>`).join('') : '<p>No tunable controls are registered for this element.</p>'}`;
  $('#native-properties')
    .querySelectorAll('[data-native-control]')
    .forEach((field) =>
      field.addEventListener('change', async () => {
        const control = controls[Number(field.dataset.nativeControl)];
        const before = control.value;
        const after = ['number', 'length', 'motion'].includes(control.valueType)
          ? Number(field.value)
          : field.value;
        const category = control.category;
        await api(`/v1/sessions/${sessionId}/preview`, {
          method: 'POST',
          body: JSON.stringify({
            targetId: target.id,
            property: control.property,
            value: after,
            change: {
              target,
              category,
              property: control.property,
              before,
              after,
              unit: control.unit,
              scope: 'instance',
              context: {
                breakpoint: activeSession.changeSet.context.breakpoint,
                theme: activeSession.changeSet.context.theme,
                state: activeSession.changeSet.context.state,
              },
              confidence: target.confidence,
              evidence: ['registered native control', 'live mirrored geometry'],
              status: 'draft',
            },
          }),
        });
        control.value = after;
        toast('Preview command sent');
      }),
    );
}

function renderSurface(surface) {
  activeSurface = surface;
  const stage = $('#native-stage');
  stage.classList.remove('hidden');
  const frame = $('#native-frame');
  if (surface.frameDataUrl) frame.src = surface.frameDataUrl;
  frame.style.aspectRatio = `${surface.width}/${surface.height}`;
  requestAnimationFrame(() => {
    const displayed = frame.getBoundingClientRect();
    const canvas = $('#native-canvas').getBoundingClientRect();
    const targets = $('#native-targets');
    Object.assign(targets.style, {
      left: `${displayed.left - canvas.left}px`,
      top: `${displayed.top - canvas.top}px`,
      width: `${displayed.width}px`,
      height: `${displayed.height}px`,
    });
    const scaleX = displayed.width / surface.width,
      scaleY = displayed.height / surface.height;
    targets.innerHTML = surface.targets
      .map(
        (target) =>
          `<button class="native-target ${target.id === selectedNativeTargetId ? 'active' : ''}" aria-label="Select ${escapeText(target.label)}" data-target="${escapeText(target.id)}" style="left:${target.geometry.x * scaleX}px;top:${target.geometry.y * scaleY}px;width:${target.geometry.width * scaleX}px;height:${target.geometry.height * scaleY}px"></button>`,
      )
      .join('');
    targets.querySelectorAll('[data-target]').forEach((button) =>
      button.addEventListener('click', () => {
        const target = surface.targets.find((candidate) => candidate.id === button.dataset.target);
        if (target) renderNativeProperties(target);
      }),
    );
  });
}

async function loadSurface() {
  if (!sessionId || !token || activeSession?.changeSet.context.platform === 'web') return;
  try {
    const { surface } = await api(`/v1/sessions/${sessionId}/surface`);
    if (surface) renderSurface(surface);
  } catch {
    /* Surface bridge may not be connected yet. */
  }
}

async function loadSession() {
  if (!sessionId || !token) return;
  try {
    renderSession(await api(`/v1/sessions/${sessionId}`));
  } catch (error) {
    toast(error.message);
  }
}

async function loadSessions() {
  if (sessionId) return;
  const { sessions } = await api('/v1/sessions');
  const grid = $('#session-grid');
  grid.innerHTML = sessions.length
    ? sessions
        .map(
          ({ changeSet }) => `
    <button class="session-card" data-session="${changeSet.sessionId}">
      <span class="platform">${escapeText(changeSet.context.platform)}</span>
      <h3>${escapeText(changeSet.context.targetName || changeSet.context.targetUrl || 'Untitled surface')}</h3>
      <p>${escapeText(changeSet.context.projectRoot)}</p>
      <span class="card-footer"><span>${changeSet.changes.length} changes</span><span>${new Date(changeSet.updatedAt).toLocaleDateString()}</span></span>
    </button>`,
        )
        .join('')
    : '<div class="empty-ledger">No sessions yet. Start the runtime from a project to create one.</div>';
}

$('#refresh').addEventListener('click', loadSessions);
$('#copy-command').addEventListener('click', async () => {
  await navigator.clipboard.writeText('pnpm foundry start --url http://localhost:3000');
  toast('Command copied');
});
$('#copy-prompt').addEventListener('click', async () => {
  const prompt = await api(`/v1/sessions/${sessionId}/export?format=prompt`);
  await navigator.clipboard.writeText(prompt);
  toast('Agent prompt copied');
});
$('#download-json').addEventListener('click', async () => {
  const data = await api(`/v1/sessions/${sessionId}/export?format=json`);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  link.download = `foundry-${sessionId}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

if (sessionId) {
  await loadSession();
  await loadSurface();
  setInterval(loadSession, 2000);
  setInterval(loadSurface, 1000);
} else {
  await loadSessions();
}
