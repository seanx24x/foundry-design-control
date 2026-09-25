// Next-only layout and evidence presentation. Original iframe/action nodes are retained.
export function responsiveFrameLabel(state = {}, snapshot, stale = false) {
  if (state.connection === 'offline') return 'Preview disconnected';
  if (state.auditStatus === 'running') return 'Measuring layout…';
  if (stale && state.audit) return 'Previous audit · run again';
  if (state.auditStatus === 'timeout') return 'Audit timed out';
  if (state.auditStatus === 'failed') return 'Audit incomplete';
  if (state.error) return 'Preview needs attention';
  if (state.auditStatus === 'passed') {
    const count = state.audit?.findings?.length ?? 0;
    return count
      ? `Measured · ${count} ${count === 1 ? 'finding' : 'findings'}`
      : 'Measured · no findings';
  }
  return snapshot
    ? 'Geometry available · not audited'
    : state.connection === 'live'
      ? 'Preview connected · awaiting geometry'
      : 'Connecting preview…';
}

export function responsiveAuditLabel(summary, running, completed, total, stale) {
  if (running) return `Measuring ${completed} of ${total} frames`;
  if (!summary) return 'Not audited';
  if (stale) return 'Previous audit';
  return summary.failed ? 'Audit incomplete' : 'Audit complete';
}

const node = (tag, className, text) => {
  const e = document.createElement(tag);
  e.className = className;
  if (text != null) e.textContent = text;
  return e;
};

export function createNextResponsiveLab(root, { selectFrame }) {
  root.classList.add('next-responsive-lab');
  root.dataset.nextIconScope = '';
  root.querySelector('.mode-head h1').textContent = 'Responsive design lab';
  root.querySelector('.mode-head p').textContent =
    'Compare real sizes, inspect differences and choose an edit scope';
  const shell = node('div', 'next-responsive-shell');
  const panel = (name, className) => {
    const rail = node('section', className);
    const header = node('header', 'next-responsive-heading');
    header.append(node('h2', '', name));
    rail.append(header);
    shell.append(rail);
    return rail;
  };
  const left = panel('Sizes and conditions', 'next-responsive-library');
  const leftScroll = node('div', 'next-responsive-controls-scroll');
  const frameList = node('div', 'next-responsive-frame-list');
  const controls = root.querySelector('.responsive-lab-controls');
  const boundaries = root.querySelector('#responsive-boundaries');
  const boundaryDetails = node('details', 'next-responsive-boundaries');
  boundaryDetails.append(node('summary', '', 'Authored boundaries'), boundaries);
  controls.querySelector('.responsive-target-group > span').textContent = 'Resize custom frame';
  const scopeNote = node('p', 'next-responsive-help');
  controls.querySelector('.responsive-scope-group').append(scopeNote);
  leftScroll.append(frameList, controls, boundaryDetails);
  left.append(leftScroll);

  const main = panel('Live previews', 'next-responsive-main');
  const viewControls = node('div', 'next-responsive-view-controls');
  let view = 'all',
    renderingView = 'all',
    model;
  for (const [value, label] of [
    ['all', 'All sizes'],
    ['selected', 'Selected'],
  ]) {
    const button = node('button', '', label);
    button.type = 'button';
    button.dataset.responsiveView = value;
    button.addEventListener('click', () => {
      view = value;
      if (model) update(model);
    });
    viewControls.append(button);
  }
  main.querySelector('header').append(viewControls);
  const grid = root.querySelector('#responsive-viewport-grid');
  main.append(grid);

  const right = panel('Inspection', 'next-responsive-inspector');
  const rightScroll = node('div', 'next-responsive-inspection-scroll');
  const target = node('section', 'next-responsive-target');
  target.append(node('h3', '', 'Selected layer'));
  const targetName = node('p', '');
  target.append(targetName);
  const active = node('section', 'next-responsive-active');
  const audit = node('section', 'next-responsive-audit');
  const comparison = root.querySelector('.responsive-comparison');
  const comparisonDetails = node('details', 'next-responsive-comparison');
  comparisonDetails.append(node('summary', '', 'Before and after'));
  comparison
    .querySelector('header > div:first-child')
    .replaceChildren(
      node(
        'p',
        'next-responsive-help',
        'Measurements from the Custom frame. Capture before, resize or stress it, then capture after.',
      ),
    );
  comparisonDetails.append(comparison);
  rightScroll.append(target, active, audit, comparisonDetails);
  right.append(rightScroll);
  const footer = root.querySelector('.responsive-lab-footer');
  root.insertBefore(shell, footer);
  footer.querySelector('button').textContent = 'Review changes';
  let listSignature = '',
    activeSignature = '',
    auditSignature = '',
    conditionSignature = '';
  let lastSummary,
    stale = false,
    auditScrollTop = null;
  const staleAudits = new WeakSet();
  const observer = new ResizeObserver(() => fit());
  function fit() {
    for (const card of grid.querySelectorAll('[data-responsive-card]')) {
      if (card.hidden) continue;
      const frame = card.querySelector('iframe');
      const viewport = card.querySelector('.responsive-frame-viewport');
      if (!frame || !viewport) continue;
      const heightLimit =
        renderingView === 'selected' ? Math.max(240, grid.clientHeight - 160) : 320;
      const scale = Math.min(
        1,
        Math.max(40, card.clientWidth - 32) / Number(frame.width),
        heightLimit / Number(frame.height),
      );
      viewport.style.setProperty('--next-responsive-preview-height', `${heightLimit + 32}px`);
      viewport.style.setProperty('--preview-scale', String(scale));
    }
  }
  function update(next) {
    model = next;
    const {
      contexts,
      activeId,
      frames,
      snapshots,
      selection,
      running,
      summary,
      stress,
      scope,
      target: scrubTarget,
      connected,
    } = next;
    const conditions = JSON.stringify([
      contexts,
      selection?.selector,
      stress,
      scrubTarget,
      scrubTarget === 'container' ? next.containerWidth : null,
    ]);
    if (conditions !== conditionSignature) {
      if (conditionSignature) {
        stale = Boolean(summary);
        for (const state of frames.values()) if (state.audit) staleAudits.add(state.audit);
      }
      conditionSignature = conditions;
    }
    if (lastSummary !== summary) {
      lastSummary = summary;
      stale = false;
    }
    const listKey = JSON.stringify(contexts);
    if (listSignature !== listKey) {
      listSignature = listKey;
      frameList.replaceChildren();
      for (const item of contexts) {
        const button = node('button', '');
        button.type = 'button';
        button.dataset.nextResponsiveFrame = item.id;
        button.append(node('span', '', item.label), node('small', '', `${item.width}px`));
        button.addEventListener('click', () => selectFrame(item.id));
        frameList.append(button);
      }
    }
    for (const button of frameList.querySelectorAll('button'))
      button.setAttribute('aria-pressed', String(button.dataset.nextResponsiveFrame === activeId));
    // Offscreen iframes can throttle layout readiness. Reveal every frame for the
    // audit, then restore the user's focused view without reloading any frame.
    if (running && auditScrollTop === null) auditScrollTop = grid.scrollTop;
    renderingView = running ? 'all' : view;
    for (const button of viewControls.children) {
      button.setAttribute('aria-pressed', String(button.dataset.responsiveView === renderingView));
      button.disabled = running;
    }
    grid.dataset.view = renderingView;
    for (const card of grid.querySelectorAll('[data-responsive-card]')) {
      const id = card.dataset.responsiveCard;
      const isActive = id === activeId;
      card.hidden = renderingView === 'selected' && !isActive;
      card.inert = card.hidden;
      if (card.hidden) card.setAttribute('aria-hidden', 'true');
      else card.removeAttribute('aria-hidden');
      card.classList.toggle('is-active', isActive);
      const button = card.querySelector('[data-responsive-open]');
      button.textContent = isActive ? 'Selected' : 'Select';
      button.setAttribute('aria-pressed', String(isActive));
      const state = frames.get(id) ?? {};
      card.querySelector('footer > span').textContent = responsiveFrameLabel(
        state,
        snapshots.get(id),
        staleAudits.has(state.audit),
      );
      card.querySelector('footer').className =
        state.connection === 'offline' || state.error
          ? 'has-issue'
          : state.auditStatus === 'running'
            ? 'is-running'
            : '';
    }
    targetName.textContent =
      selection?.label ?? 'Choose a layer on Canvas to compare its geometry.';
    scopeNote.textContent = !selection?.source
      ? 'All breakpoints requires a source-mapped layer.'
      : scope === 'all'
        ? 'Future edits include every configured breakpoint. Source changes still require Review and Apply.'
        : `Future edits are scoped to ${activeId === 'custom' ? 'the current breakpoint, not the custom width' : (contexts.find((item) => item.id === activeId)?.label ?? activeId)}.`;
    root.querySelector('[data-responsive-scope="all"]').disabled = !connected || !selection?.source;
    root.querySelector('#responsive-open-canvas').disabled = !connected;
    root.querySelector('[data-studio-action="responsive-audit"]').disabled =
      running || !contexts.length;
    root.querySelector('[data-studio-action="responsive-audit"]').textContent = running
      ? 'Auditing…'
      : 'Run audit';
    const snapshot = snapshots.get(activeId),
      frameState = frames.get(activeId) ?? {};
    const selectedContext = contexts.find((item) => item.id === activeId);
    const activeKey = JSON.stringify([
      selectedContext,
      snapshot,
      frameState.connection,
      frameState.error,
    ]);
    if (activeKey !== activeSignature) {
      activeSignature = activeKey;
      active.replaceChildren(node('h3', '', selectedContext?.label ?? 'Selected frame'));
      active.append(
        node(
          'p',
          'next-responsive-help',
          frameState.connection === 'live' ? 'Preview connected' : 'Preview not connected',
        ),
      );
      if (frameState.error) active.append(node('p', 'next-responsive-help', frameState.error));
      const geometry = snapshot?.selection;
      const items = [
        [
          'Viewport',
          selectedContext ? `${selectedContext.width} × ${selectedContext.height}` : 'Unavailable',
        ],
        [
          'Layer size',
          geometry
            ? `${Math.round(geometry.width ?? geometry.clientWidth ?? 0)} × ${Math.round(geometry.height ?? geometry.clientHeight ?? 0)} px`
            : 'Not measured',
        ],
        ['Text lines', geometry?.lineCount ?? 'Not measured'],
      ];
      const dl = node('dl', '');
      for (const [label, value] of items) {
        const row = node('div', '');
        row.append(node('dt', '', label), node('dd', '', String(value)));
        dl.append(row);
      }
      active.append(dl);
    }
    const complete = [...frames.values()].filter((item) =>
      ['passed', 'failed', 'timeout'].includes(item.auditStatus),
    ).length;
    const auditKey = JSON.stringify([summary, running, complete, stale]);
    if (auditKey !== auditSignature) {
      auditSignature = auditKey;
      audit.replaceChildren(
        node('h3', '', responsiveAuditLabel(summary, running, complete, contexts.length, stale)),
      );
      if (summary) {
        audit.append(
          node(
            'p',
            'next-responsive-help',
            `${summary.passed} frames measured · ${summary.failed} incomplete. ${summary.findings} frame findings and ${summary.crossFrameFindings} cross-frame findings.`,
          ),
        );
        audit.append(
          node(
            'p',
            'next-responsive-help',
            'Cross-frame checks are heuristic. Inspect the rendered context before treating a finding as a defect.',
          ),
        );
        if (stale)
          audit.append(
            node(
              'p',
              'next-responsive-help',
              'Conditions changed since this audit. Run it again for current evidence.',
            ),
          );
        if (summary.aggregateFindings?.length) {
          const details = node('details', 'next-responsive-cross-findings');
          details.append(node('summary', '', 'Cross-frame findings'));
          for (const finding of summary.aggregateFindings) {
            const item = node('article', '');
            item.append(
              node('strong', '', finding.title),
              node('p', 'next-responsive-help', (finding.evidence ?? []).join(' · ')),
              node('code', '', finding.selector),
            );
            details.append(item);
          }
          audit.append(details);
        }
      } else
        audit.append(
          node(
            'p',
            'next-responsive-help',
            running
              ? 'Bringing each size into view to measure fonts and stable layout. Your view is restored afterward.'
              : 'Audit every frame for clipping, overflow and layout changes. Auditing does not add Review edits.',
          ),
        );
    }
    const canCapture =
      connected &&
      frames.get('custom')?.connection === 'live' &&
      Boolean(snapshots.get('custom')?.selection) &&
      Boolean(selection);
    root.querySelector('#responsive-capture-before').disabled = !canCapture;
    root.querySelector('#responsive-capture-after').disabled = !canCapture;
    const live = contexts.filter((item) => frames.get(item.id)?.connection === 'live').length;
    root.querySelector('#responsive-lab-status').textContent = running
      ? `Measuring ${complete} of ${contexts.length} frames…`
      : `${live} of ${contexts.length} previews connected · ${scope === 'all' ? 'All breakpoints' : 'This breakpoint'} edit scope`;
    fit();
    if (!running && auditScrollTop !== null) {
      grid.scrollTop = auditScrollTop;
      auditScrollTop = null;
    }
  }
  observer.observe(grid);
  function prepareAuditFrame(id) {
    const card = [...grid.querySelectorAll('[data-responsive-card]')].find(
      (item) => item.dataset.responsiveCard === id,
    );
    card?.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
  }
  return { update, fit, prepareAuditFrame };
}
