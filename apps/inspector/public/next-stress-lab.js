// Next presentation only. Retain the existing acknowledged scan and correction actions.
export function stressEvidenceLabel({ connected, busy, error, scannedAt, stale }) {
  if (!connected) return 'Preview disconnected';
  if (busy) return busy;
  if (error) return 'Test needs attention';
  if (!scannedAt) return 'Not tested yet';
  if (stale) return 'Previous scan';
  return 'Scan complete';
}

export function stressDraftMatches(selected, active, scope, appliedScope) {
  return (
    scope === appliedScope &&
    selected.length === active.length &&
    selected.every((id) => active.includes(id))
  );
}

export function stressCorrectionLabel(issue) {
  if (issue.previewed) return issue.recordedBranchId ? 'Saved to direction' : 'Added to Review';
  return 'Preview and add to Review';
}

const node = (tag, className = '', text) => {
  const e = document.createElement(tag);
  e.className = className;
  if (text != null) e.textContent = text;
  return e;
};

export function stressPreviewTransform(width, height, viewport, geometry) {
  const target =
    geometry?.width > 0 && geometry?.height > 0
      ? geometry
      : { x: 0, y: 0, width: viewport.width, height: viewport.height };
  const scale = Math.max(
    0.01,
    Math.min(1, (width - 48) / target.width, (height - 48) / target.height),
  );
  return {
    scale,
    x: width / 2 - (target.x + target.width / 2) * scale,
    y: height / 2 - (target.y + target.height / 2) * scale,
  };
}

export function createNextStressLab(root) {
  root.classList.add('next-stress-lab');
  root.dataset.nextIconScope = '';
  root.querySelector('.mode-head h1').textContent = 'Content stress lab';
  root.querySelector('.mode-head p').textContent =
    'Test real content, inspect evidence and review corrections';
  root.querySelector('[data-studio-action="stress-run"]').hidden = true;
  root.querySelector('[data-studio-action="stress-reset"]').hidden = true;
  const scan = root.querySelector('#run-health');
  root.querySelector('.mode-actions').prepend(scan);
  const left = root.querySelector('.stress-lab-browser');
  left.querySelector('header').replaceChildren(node('h2', '', 'Conditions'));
  const profiles = root.querySelector('#stress-profile-list');
  const scope = root.querySelector('.stress-scope');
  const scopeHint = node('p', 'next-stress-help');
  const draftHint = node('p', 'next-stress-help next-stress-draft');
  const controls = node('div', 'next-stress-controls');
  controls.append(scope, scopeHint, profiles);
  left.insertBefore(controls, left.querySelector('footer'));
  left.querySelector('footer').prepend(draftHint);

  const results = root.querySelector('.stress-lab-results');
  const workspace = root.closest('.app-shell');
  const previewPanel = node('section', 'next-stress-preview');
  const previewHead = node('header', 'next-stress-preview-head');
  const previewTitle = node('h2', '', 'Live preview');
  const restore = root.querySelector('#clear-stress');
  restore.textContent = 'Restore original';
  previewHead.append(previewTitle, restore);
  const targetLabel = node('strong');
  const appliedLabel = node('span', 'next-stress-help');
  const targetSummary = node('div', 'next-stress-target');
  targetSummary.append(targetLabel, appliedLabel);
  const previewSlot = node('div', 'next-stress-preview-slot');
  previewSlot.setAttribute('role', 'img');
  const previewHelp = node(
    'p',
    'next-stress-preview-help',
    'Preview only. Use View on Canvas to select another layer.',
  );
  const framing = node('div', 'next-stress-framing');
  framing.setAttribute('role', 'group');
  framing.setAttribute('aria-label', 'Preview framing');
  let showPage = false;
  const selectionFrame = node('button', '', 'Selection');
  const pageFrame = node('button', '', 'Viewport');
  for (const button of [selectionFrame, pageFrame]) button.type = 'button';
  framing.append(selectionFrame, pageFrame);
  const previewFooter = node('footer');
  previewFooter.append(previewHelp, framing);
  previewPanel.append(previewHead, targetSummary, previewSlot, previewFooter);
  const center = node('div', 'next-stress-center');
  results.before(center);
  center.append(previewPanel, results);
  const syncPreview = () => {
    if (root.hidden || !model?.connected) {
      delete workspace.dataset.stressPreview;
      return;
    }
    const bounds = previewSlot.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const scrollBounds = root.querySelector('.stress-lab-shell').getBoundingClientRect();
    workspace.style.setProperty(
      '--stress-preview-clip',
      `inset(${Math.max(0, scrollBounds.top - bounds.top)}px ${Math.max(0, bounds.right - scrollBounds.right)}px ${Math.max(0, bounds.bottom - scrollBounds.bottom)}px ${Math.max(0, scrollBounds.left - bounds.left)}px)`,
    );
    const geometry =
      !showPage && model.scope === 'selection' ? model.selection?.targets?.[0]?.geometry : null;
    const view = stressPreviewTransform(bounds.width, bounds.height, model.viewport, geometry);
    // Position the existing Canvas frame over the slot. Never reparent/reload an
    // iframe: that would discard the very temporary conditions being inspected.
    for (const [name, value] of Object.entries({
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    }))
      workspace.style.setProperty(`--stress-preview-${name}`, `${value}px`);
    workspace.style.setProperty(
      '--stress-preview-transform',
      `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
    );
    workspace.dataset.stressPreview = 'visible';
  };
  const setFraming = (page) => {
    showPage = page;
    selectionFrame.setAttribute('aria-pressed', String(!page && !selectionFrame.disabled));
    pageFrame.setAttribute('aria-pressed', String(page || selectionFrame.disabled));
    syncPreview();
  };
  selectionFrame.addEventListener('click', () => setFraming(false));
  pageFrame.addEventListener('click', () => setFraming(true));
  const previewObserver = new ResizeObserver(syncPreview);
  previewObserver.observe(previewSlot);
  window.addEventListener('resize', syncPreview);
  root.addEventListener('scroll', syncPreview, true);
  const resultHead = node('header', 'next-stress-heading');
  resultHead.append(node('h2', '', 'Findings'));
  const count = node('span', 'next-stress-help');
  resultHead.append(count);
  results.prepend(resultHead);
  const groups = root.querySelector('#stress-finding-groups');
  const rail = node('aside', 'next-stress-inspector');
  const heading = node('header', 'next-stress-heading');
  heading.append(node('h2', '', 'Evidence and correction'));
  const railScroll = node('div', 'next-stress-evidence-scroll');
  const summary = root.querySelector('#stress-summary-grid');
  const detail = node('section', 'next-stress-detail');
  railScroll.append(summary, detail);
  rail.append(heading, railScroll);
  root.querySelector('.stress-lab-shell').append(rail);
  const banner = node('p', 'next-stress-banner');
  banner.setAttribute('role', 'status');
  results.insertBefore(banner, groups);
  let selectedId = '',
    model,
    cards = new Map(),
    lastScan,
    scanContext,
    stale = false;
  const footer = root.querySelector('#stress-lab-footnote');
  let preserved = null;
  function capture() {
    const focused = root.ownerDocument.activeElement;
    const attribute = [
      'data-stress-condition',
      'data-stress-severity',
      'data-next-stress-finding',
      'data-stress-select',
      'data-stress-fix',
    ].find((name) => focused?.hasAttribute(name));
    preserved = {
      attribute,
      value: attribute ? focused.getAttribute(attribute) : null,
      left: controls.scrollTop,
      results: groups.scrollTop,
      right: railScroll.scrollTop,
    };
  }

  function showDetail() {
    detail.replaceChildren();
    for (const button of groups.querySelectorAll('[data-next-stress-finding]'))
      button.setAttribute('aria-pressed', String(button.dataset.nextStressFinding === selectedId));
    const card = cards.get(selectedId);
    if (!card) {
      detail.append(
        node('h3', '', 'Inspect a finding'),
        node(
          'p',
          'next-stress-help',
          'Select a result to see its evidence, source and available correction.',
        ),
      );
      return;
    }
    detail.append(card);
    const issue = model.issues.find((item) => item.id === selectedId);
    card.querySelector('.stress-kind').textContent = (issue.kind ?? 'Finding').replaceAll('-', ' ');
    if (!issue.source)
      detail.append(
        node(
          'p',
          'next-stress-help',
          'Source mapping unavailable. A preview correction does not establish a source mapping.',
        ),
      );
    const select = card.querySelector('[data-stress-select]');
    select.textContent = 'View layer on Canvas';
    select.disabled = !model.connected || Boolean(model.busy) || stale;
    const fix = card.querySelector('[data-stress-fix]');
    if (fix) {
      fix.textContent = stressCorrectionLabel(issue);
      fix.disabled = !model.connected || Boolean(model.busy) || stale || Boolean(issue.previewed);
    }
    detail.append(
      node(
        'p',
        'next-stress-help',
        issue.canFix
          ? 'Previewing a correction records a Review change. Source stays unchanged until reviewed Apply.'
          : 'No automatic correction is available. Inspect this layer on Canvas to refine it.',
      ),
    );
  }

  function update(next) {
    model = next;
    const { issues, stress, selection, connected, busy, error, selected, scope: draftScope } = next;
    const context = JSON.stringify([
      selection?.selector,
      selection?.width,
      selection?.height,
      next.context,
    ]);
    if (lastScan !== stress.scannedAt) {
      lastScan = stress.scannedAt;
      scanContext = context;
      stale = false;
    } else if (lastScan && scanContext !== context) stale = true;
    const problem = error || stress.error;
    const label = stressEvidenceLabel({
      connected,
      busy,
      error: problem,
      scannedAt: stress.scannedAt,
      stale,
    });
    const sameDraft = stressDraftMatches(
      selected,
      stress.active ?? [],
      draftScope,
      stress.scope ?? 'selection',
    );
    const activeConditions = stress.active ?? [];
    const currentTarget =
      draftScope === 'canvas' ? 'Entire canvas' : selection?.label || 'No layer selected';
    targetLabel.textContent = `${activeConditions.length ? 'Testing' : 'Target'}: ${activeConditions.length ? stress.target || currentTarget : currentTarget}`;
    appliedLabel.textContent = !connected
      ? 'Preview disconnected. Reconnect to inspect or restore.'
      : busy ||
        (activeConditions.length
          ? `Temporary: ${activeConditions.map((id) => stress.profiles?.find((profile) => profile.id === id)?.label ?? id).join(', ')}`
          : 'Original content. No temporary conditions applied.');
    previewSlot.setAttribute(
      'aria-label',
      `${targetLabel.textContent}. ${appliedLabel.textContent}`,
    );
    selectionFrame.disabled = !selection || draftScope === 'canvas';
    selectionFrame.setAttribute('aria-pressed', String(!showPage && !selectionFrame.disabled));
    pageFrame.setAttribute('aria-pressed', String(showPage || selectionFrame.disabled));
    previewSlot.textContent = connected ? '' : 'Live preview unavailable';
    syncPreview();
    scopeHint.textContent =
      draftScope === 'canvas'
        ? 'Test the entire rendered page.'
        : (selection?.label ?? 'Select a layer on Canvas first.');
    draftHint.textContent = !connected
      ? 'Reconnect the preview to run tests. Choices are preserved.'
      : busy
        ? busy
        : !sameDraft
          ? 'Choices changed. Run to apply them to the preview.'
          : stress.active?.length
            ? `${stress.active.length} temporary ${stress.active.length === 1 ? 'condition' : 'conditions'} applied.`
            : 'Choose conditions, or scan without stress.';
    const unavailable = !connected || Boolean(busy) || (draftScope === 'selection' && !selection);
    scan.disabled = unavailable;
    scan.textContent = busy === 'Scanning…' ? 'Scanning…' : 'Scan current state';
    root.querySelector('#apply-stress').disabled = unavailable || !selected.length;
    root.querySelector('#apply-stress').textContent =
      busy === 'Running tests…'
        ? busy
        : selected.length
          ? `Run ${selected.length} ${selected.length === 1 ? 'condition' : 'conditions'}`
          : 'Choose conditions';
    root.querySelector('#clear-stress').disabled =
      !connected || Boolean(busy) || !stress.active?.length;
    restore.textContent = busy === 'Clearing conditions…' ? 'Restoring…' : 'Restore original';
    for (const button of root.querySelectorAll('[data-stress-condition], [data-stress-scope]'))
      button.disabled = Boolean(busy);
    for (const button of profiles.querySelectorAll('[data-stress-condition]'))
      button.title = button.querySelector('small')?.textContent ?? '';
    const evidenceCurrent = Boolean(stress.scannedAt) && connected && !problem && !stale && !busy;
    count.textContent = !stress.scannedAt
      ? 'Not scanned'
      : `${issues.length} ${issues.length === 1 ? 'finding' : 'findings'}${evidenceCurrent ? '' : ' · previous evidence'}`;
    banner.textContent =
      problem ||
      (!connected
        ? 'Reconnect the live preview. Last results are retained, not re-verified.'
        : stale
          ? 'The rendered context changed. Scan again before previewing a correction.'
          : busy || '');
    banner.hidden = !banner.textContent;
    summary.replaceChildren(node('h3', '', label));
    summary.append(
      node(
        'p',
        'next-stress-help',
        stress.scannedAt
          ? `Last scan: ${stress.scope === 'canvas' ? 'Entire canvas' : (stress.target ?? 'Selection').replace(/[.!?]$/, '')}. ${stress.active?.length ?? 0} temporary ${stress.active?.length === 1 ? 'condition' : 'conditions'}.`
          : 'Scan the current layout or run temporary conditions. No result has been measured yet.',
      ),
    );
    const dl = node('dl');
    for (const [name, value] of [
      ['Findings', issues.length],
      ['High severity', issues.filter((i) => i.severity === 'high').length],
      ['Correctable', issues.filter((i) => i.canFix && !i.previewed).length],
    ]) {
      const row = node('div');
      row.append(node('dt', '', name), node('dd', '', stress.scannedAt ? String(value) : '—'));
      dl.append(row);
    }
    summary.append(
      dl,
      node(
        'p',
        'next-stress-help',
        'Automated checks cover this rendered scope, not a complete accessibility or design review.',
      ),
    );
    if (stress.active?.length)
      summary.append(
        node(
          'p',
          'next-stress-help',
          `Applied: ${stress.active.map((id) => stress.profiles?.find((profile) => profile.id === id)?.label ?? id).join(', ')}`,
        ),
      );
    cards = new Map();
    for (const group of groups.querySelectorAll('.stress-finding-group')) {
      for (const card of group.querySelectorAll('.stress-finding-card')) {
        const id = card.querySelector('[data-stress-select]').dataset.stressSelect;
        cards.set(id, card);
        const issue = issues.find((item) => item.id === id);
        const row = node('button', 'next-stress-finding');
        row.type = 'button';
        row.dataset.nextStressFinding = id;
        const dot = node('i');
        dot.dataset.severity = issue.severity;
        const copy = node('span');
        copy.append(
          node('strong', '', issue.title ?? issue.kind),
          node('small', '', issue.detail ?? issue.description ?? ''),
        );
        row.append(dot, copy, node('span', 'next-stress-severity', issue.severity));
        row.addEventListener('click', () => {
          selectedId = id;
          showDetail();
        });
        card.replaceWith(row);
      }
    }
    if (!cards.has(selectedId)) selectedId = cards.keys().next().value ?? '';
    showDetail();
    const empty = groups.querySelector('.stress-empty');
    if (empty && !issues.length) {
      empty.querySelector('strong').textContent = !connected
        ? 'Preview disconnected'
        : problem
          ? 'Test needs attention'
          : !stress.scannedAt
            ? 'Start with the current layout'
            : stale
              ? 'Scan the updated layout'
              : 'No findings in this scan';
      empty.querySelector('p').textContent =
        problem ||
        (!stress.scannedAt
          ? 'Scan without changing the page, or choose conditions on the left and run them.'
          : 'This result only covers the measured scope and supported checks.');
    }
    footer.textContent = `${label} · Temporary conditions do not create Review edits. Corrections do.`;
    if (preserved) {
      if (preserved.attribute)
        root
          .querySelector(`[${preserved.attribute}="${CSS.escape(preserved.value)}"]`)
          ?.focus({ preventScroll: true });
      controls.scrollTop = preserved.left;
      groups.scrollTop = preserved.results;
      railScroll.scrollTop = preserved.right;
      preserved = null;
    }
  }
  return { update, capture, syncPreview };
}
