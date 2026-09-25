// Presentation only. Existing commands own branch activation and Review promotion.
export function branchReviewableChanges(direction) {
  return (direction?.changes ?? []).filter(
    (change) => !['applied', 'rejected'].includes(change.status),
  );
}
export function branchComparisonDirections(left, right) {
  return left.id === right.id ? [left] : [left, right];
}
export function branchPreviewKey(directions, viewport, url) {
  return JSON.stringify([
    url,
    viewport.width,
    viewport.height,
    directions.map(({ id, name, status, changes }) => ({ id, name, status, changes })),
  ]);
}
export function branchPreviewScale(width, viewport) {
  return Math.max(0.01, Math.min(1, Math.max(1, width) / viewport.width, 480 / viewport.height));
}
const node = (tag, className, text) => {
  const e = document.createElement(tag);
  e.className = className;
  if (text != null) e.textContent = text;
  return e;
};
export function createNextDesignBranches(root) {
  root.classList.add('next-design-branches');
  root.dataset.nextIconScope = '';
  root.querySelector('.mode-head h1').textContent = 'Design branches';
  root.querySelector('.mode-head p').textContent =
    'Explore alternatives, compare changes and choose what enters Review';
  const promote = root.querySelector('#design-branch-promote');
  promote.textContent = 'Move to Review';
  promote.title = 'Move the active direction into Review. This does not apply source changes.';
  const promoteHelp = node('p', 'next-branch-help next-branch-promote-help');
  promoteHelp.id = 'next-branch-promote-help';
  promoteHelp.setAttribute('role', 'status');
  promote.setAttribute('aria-describedby', promoteHelp.id);
  const browser = root.querySelector('.design-branch-browser');
  browser.prepend(root.querySelector('.design-branch-list-head'));
  const create = root.querySelector('.design-branch-create');
  create.append(
    node(
      'p',
      'next-branch-help',
      'Copies the active direction. New edits stay separate from Main.',
    ),
  );
  const records = root.querySelector('.design-branch-records');
  const disclosure = node('details', 'next-branch-records');
  const recordSummary = node('summary', '', 'Saved decisions');
  disclosure.append(recordSummary);
  records.before(disclosure);
  disclosure.append(records);
  records.querySelector('header strong').textContent = 'Import or restore';
  const stage = root.querySelector('.design-branch-stage');
  const comparison = root.querySelector('.design-branch-compare-head');
  comparison.querySelector('strong').textContent = 'Comparison';
  const help = node('p', 'next-branch-comparison-help');
  comparison.after(help);
  const refresh = node('button', 'quiet-button next-branch-refresh', 'Reload previews');
  refresh.type = 'button';
  refresh.id = 'next-branch-refresh';
  refresh.title = 'Reload the comparison frames without changing your directions';
  comparison.append(refresh);
  for (const [id, title] of [
    ['design-branch-left', 'Left'],
    ['design-branch-right', 'Right'],
  ]) {
    const select = root.querySelector(`#${id}`);
    const control = select.closest('.foundry-select') ?? select;
    const label = node('label', 'next-branch-select');
    label.append(node('span', '', title));
    control.before(label);
    label.append(control);
  }
  root.querySelector('.design-branch-decisions header strong').textContent = 'Combine decisions';
  const decisionHelp = node(
    'p',
    'next-branch-help',
    'Choose changes from the compared alternatives. Conflicting values are mutually exclusive. Combining creates a new direction, not a source edit.',
  );
  root.querySelector('.design-branch-decisions > header').after(decisionHelp);
  const detail = root.querySelector('#design-branch-detail');
  const footer = node(
    'footer',
    'next-branch-footer',
    'Design directions are local alternatives, not Git branches. Source changes require reviewed Apply.',
  );
  root.append(footer);
  const notes = new Map();
  let activeId, noteFocus, scroll;
  function capture() {
    const note = detail.querySelector('#design-branch-note');
    if (note && activeId) notes.set(activeId, note.value);
    noteFocus =
      note && document.activeElement === note
        ? { start: note.selectionStart, end: note.selectionEnd }
        : null;
    scroll = {
      stage: stage.scrollTop,
      detail: detail.scrollTop,
      list: root.querySelector('#design-branch-list').scrollTop,
    };
  }
  function fit() {
    for (const viewport of root.querySelectorAll('.design-branch-preview-viewport')) {
      const frame = viewport.querySelector('iframe');
      if (!frame) continue;
      const scale = branchPreviewScale(viewport.clientWidth, {
        width: Number(frame.width),
        height: Number(frame.height),
      });
      viewport.style.setProperty('--branch-scale', String(scale));
    }
  }
  new ResizeObserver(fit).observe(root.querySelector('#design-branch-previews'));
  function update({ active, directions, comparisonCount, recordsCount }) {
    const changed = activeId !== active.id;
    activeId = active.id;
    const savedCount = branchReviewableChanges(active).length;
    promote.disabled = active.id === 'main' || savedCount === 0;
    promoteHelp.hidden = active.id === 'main' || savedCount > 0;
    promoteHelp.textContent =
      'No saved changes in this direction. Edit a property on Canvas and press Enter to save it before moving to Review.';
    promote.title = promote.disabled
      ? active.id === 'main'
        ? 'Main edits are already in Review.'
        : promoteHelp.textContent
      : `Move ${savedCount} saved ${savedCount === 1 ? 'change' : 'changes'} to Review. Source stays unchanged.`;
    help.textContent =
      directions.length === 1
        ? 'Start with Main. Create a direction on the left to compare an alternative here.'
        : comparisonCount === 1
          ? 'Both selectors point to the same direction. Choose a different direction to compare side by side.'
          : 'Live project previews at the same viewport. Use the selectors to compare without changing your active editing direction.';
    root.querySelector('#design-branch-previews').dataset.single = String(comparisonCount === 1);
    const heading = node('h2', 'next-branch-detail-heading', 'Active direction');
    detail.prepend(heading);
    heading.after(promoteHelp);
    const badge = detail.querySelector('.branch-status');
    if (active.id === 'main') {
      badge.textContent = 'Main';
      detail.querySelector('.design-branch-detail-head > p').textContent =
        'Edits in Main are collected in Review. They are not applied to source yet.';
    }
    detail.querySelector('.design-branch-detail-title .eyebrow')?.remove();
    recordSummary.textContent = `Saved decisions${recordsCount ? ` · ${recordsCount}` : ''}`;
    const note = detail.querySelector('#design-branch-note');
    if (note && notes.has(activeId)) note.value = notes.get(activeId);
    if (note && noteFocus && !changed) {
      note.focus({ preventScroll: true });
      note.setSelectionRange(noteFocus.start, noteFocus.end);
    }
    for (const row of root.querySelectorAll('[data-activate-branch]')) {
      const direction = directions.find((item) => item.id === row.dataset.activateBranch);
      const count = direction?.changes?.length ?? 0;
      row.querySelector('small').textContent = `${count} ${count === 1 ? 'decision' : 'decisions'}`;
      row.setAttribute('aria-pressed', String(row.dataset.activateBranch === active.id));
      row.title = `Activate ${row.querySelector('strong').textContent} for editing`;
    }
    if (scroll) {
      stage.scrollTop = scroll.stage;
      detail.scrollTop = changed ? 0 : scroll.detail;
      root.querySelector('#design-branch-list').scrollTop = scroll.list;
    }
    fit();
  }
  return { capture, update, fit };
}
