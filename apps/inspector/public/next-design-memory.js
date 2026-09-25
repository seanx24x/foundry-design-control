// Next-only presentation. The adapter remains the owner of saved project memory.
export function memoryCaptureAvailability({ connected, canCapture, busy, title, summary }) {
  if (busy) return { disabled: true, message: 'Saving decision…' };
  if (!connected)
    return {
      disabled: true,
      message: 'Preview offline. Your draft stays here; reconnect to save.',
    };
  if (!canCapture)
    return {
      disabled: true,
      message: 'Select a layer in Canvas to connect this decision to its source.',
    };
  if (!title.trim() || !summary.trim())
    return { disabled: true, message: 'Add a title and guidance to save this decision.' };
  return {
    disabled: false,
    message: 'Saves guidance to this project. Does not apply source changes.',
  };
}
export function memoryScopeRows(decision) {
  const conditions = decision.conditions ?? {};
  return [
    ['Categories', decision.categories],
    ['Components', conditions.components],
    ['Element types', conditions.elementKinds],
    ['Properties', conditions.properties],
    ['Breakpoints', conditions.breakpoints],
    ['Themes', conditions.themes],
    ['States', conditions.states],
    ['Source conditions', conditions.sources],
  ].filter(([, values]) => values?.length);
}
export function sameMemoryDraft(left, right) {
  return ['summary', 'rationale'].every((key) => (left?.[key] ?? '') === (right?.[key] ?? ''));
}
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text != null) element.textContent = text;
  return element;
};
export function createNextDesignMemory(root) {
  root.classList.add('next-design-memory');
  root.dataset.nextIconScope = '';
  root.querySelector('.mode-head h1').textContent = 'Design memory';
  root.querySelector('.mode-head p').textContent =
    'Keep the reasoning behind your design decisions';
  root.querySelector('[data-studio-action="memory-export"]').hidden = true;
  root.querySelector('[data-studio-action="memory-record"]').textContent = 'New decision';
  const library = root.querySelector('.decision-memory-browser');
  library.querySelector('header').replaceChildren(node('strong', '', 'Project decisions'));
  const count = node('span', 'next-memory-count');
  library.querySelector('header').append(count);
  const stage = root.querySelector('#decision-memory-stage');
  const detailPanel = node('section', 'next-memory-detail');
  const detailHead = node('header', 'next-memory-detail-head');
  detailHead.append(node('strong', '', 'Decision details'));
  const detailStatus = node('span', 'next-memory-detail-status');
  detailHead.append(detailStatus);
  stage.before(detailPanel);
  detailPanel.append(detailHead, stage);
  const capturePanel = root.querySelector('.decision-memory-capture');
  const header = capturePanel.querySelector('header');
  header.replaceChildren(node('strong', '', 'New decision'));
  const form = node('div', 'next-memory-capture-fields');
  for (const child of [...capturePanel.children]) if (child !== header) form.append(child);
  capturePanel.append(form);
  const context = root.querySelector('#decision-memory-context');
  context.before(node('h3', 'next-memory-label', 'Captured context'));
  const outcome = root.querySelector('.decision-outcome-picker');
  outcome.before(node('h3', 'next-memory-label', 'Outcome'));
  const outcomeHelp = node('p', 'next-memory-help');
  outcome.after(outcomeHelp);
  const title = root.querySelector('#decision-memory-title');
  const summary = root.querySelector('#decision-memory-summary');
  const rationale = root.querySelector('#decision-memory-rationale');
  title.placeholder = 'Name the decision';
  summary.placeholder = 'What should future design work follow or avoid?';
  rationale.placeholder = 'What evidence or tradeoff led to this?';
  rationale.closest('label').querySelector('span').textContent = 'Reasoning · optional';
  const save = root.querySelector('#decision-memory-save');
  const saveArea = node('footer', 'next-memory-save-area');
  const saveHelp = node('p', 'next-memory-help');
  saveHelp.id = 'next-memory-save-help';
  saveHelp.setAttribute('aria-live', 'polite');
  save.setAttribute('aria-describedby', saveHelp.id);
  saveArea.append(saveHelp, save);
  capturePanel.append(saveArea);
  root.querySelector('.decision-memory-footer > span').textContent =
    'Saved guidance informs future edits. Source changes still require reviewed Apply.';
  let state = {},
    activeId,
    base,
    focus,
    scroll;
  const drafts = new Map(),
    expanded = new Map();
  const fields = () => ({
    summary: stage.querySelector('[data-decision-summary]'),
    rationale: stage.querySelector('[data-decision-rationale]'),
  });
  function capture() {
    const current = fields();
    if (activeId && current.summary) {
      const draft = { summary: current.summary.value, rationale: current.rationale.value };
      if (sameMemoryDraft(draft, base)) drafts.delete(activeId);
      else drafts.set(activeId, draft);
      expanded.set(activeId, Boolean(stage.querySelector('.next-memory-correction')?.open));
    }
    const entry = Object.entries(current).find(
      ([, field]) => field && field === document.activeElement,
    );
    focus = entry
      ? { key: entry[0], start: entry[1].selectionStart, end: entry[1].selectionEnd }
      : null;
    scroll = stage.scrollTop;
  }
  function refreshAvailability() {
    const availability = memoryCaptureAvailability({
      ...state,
      title: title.value,
      summary: summary.value,
    });
    save.disabled = availability.disabled;
    save.textContent = state.busy ? 'Saving…' : 'Save decision';
    saveHelp.textContent = state.error || availability.message;
    saveHelp.dataset.error = String(Boolean(state.error));
    const selectedOutcome = root.querySelector('[data-decision-outcome][aria-pressed="true"]')
      ?.dataset.decisionOutcome;
    outcomeHelp.textContent =
      {
        approved: 'Keep a direction that worked and why it worked.',
        rejected: 'Remember what to avoid and the reason behind it.',
        rule: 'Set explicit guidance for future design decisions.',
      }[selectedOutcome] ?? '';
    const current = fields();
    const correct = stage.querySelector('[data-save-decision-correction]');
    if (correct)
      correct.disabled =
        !state.connected ||
        !current.summary.value.trim() ||
        sameMemoryDraft(
          { summary: current.summary.value, rationale: current.rationale.value },
          base,
        );
    for (const action of stage.querySelectorAll('[data-toggle-decision], [data-remove-decision]'))
      action.disabled = !state.connected;
    root.querySelector('#decision-memory-import').disabled = !state.connected;
    const connection = stage.querySelector('.next-memory-edit-help');
    if (connection)
      connection.textContent = state.connected
        ? 'Updates saved guidance, not the product source. Your unsubmitted edits stay here when you switch decisions.'
        : 'Preview offline. Your edits are preserved; reconnect to update guidance.';
  }
  form.addEventListener('input', refreshAvailability);
  outcome.addEventListener('click', () => queueMicrotask(refreshAvailability));
  stage.addEventListener('input', refreshAvailability);
  function update({ decision, decisions, filtered, connected, canCapture, busy, error }) {
    state = { connected, canCapture, busy, error };
    const changed = activeId !== decision?.id;
    activeId = decision?.id;
    base = decision ? { summary: decision.summary, rationale: decision.rationale ?? '' } : null;
    for (const id of drafts.keys())
      if (!decisions.some((item) => item.id === id)) drafts.delete(id);
    count.textContent = `${filtered.length}${filtered.length !== decisions.length ? ` / ${decisions.length}` : ''}`;
    detailStatus.textContent = decision
      ? decision.enabled
        ? 'Active guidance'
        : 'Disabled guidance'
      : 'No decision selected';
    root.querySelector('#decision-memory-export').disabled = decisions.length === 0;
    for (const row of library.querySelectorAll('[data-design-decision]')) {
      row.setAttribute('aria-pressed', String(row.dataset.designDecision === activeId));
      row.title = row.querySelector('strong').textContent;
      const score = row.querySelector('code');
      if (score) score.title = 'Context match, not a confidence or quality score';
      if (row.dataset.enabled === 'false')
        row.querySelector('small').textContent =
          'Disabled · ' + row.querySelector('small').textContent;
    }
    if (decision) {
      stage.querySelector('.decision-memory-pills')?.remove();
      const scope = node('section', 'next-memory-scope');
      scope.append(node('h3', '', 'Applies to'));
      const rows = memoryScopeRows(decision);
      const list = node('dl', '');
      for (const [label, values] of rows)
        list.append(node('dt', '', label), node('dd', '', values.join(', ')));
      scope.append(
        rows.length
          ? list
          : node('p', 'next-memory-help', 'No specific context restrictions were saved.'),
      );
      stage.querySelector('.decision-memory-overview').after(scope);
      const badge = stage.querySelector('.decision-state');
      badge.dataset.enabled = String(decision.enabled);
      stage.querySelector('.decision-memory-rules .eyebrow')?.remove();
      stage.querySelector('.decision-memory-evidence .eyebrow')?.remove();
      const edit = stage.querySelector('.decision-memory-edit');
      const disclosure = node('details', 'next-memory-correction');
      disclosure.open = expanded.get(activeId) ?? false;
      disclosure.append(node('summary', '', 'Edit guidance'));
      edit.before(disclosure);
      disclosure.append(node('p', 'next-memory-edit-help'), edit);
      const current = fields(),
        draft = drafts.get(activeId);
      if (draft) for (const key of ['summary', 'rationale']) current[key].value = draft[key];
      if (focus && !changed) {
        current[focus.key].focus({ preventScroll: true });
        current[focus.key].setSelectionRange(focus.start, focus.end);
      }
    } else if (!decisions.length) {
      const empty = stage.querySelector('.is-stage');
      empty.querySelector('strong').textContent = 'Keep the why, not just the result';
      empty.querySelector('p').textContent =
        'Save a decision with its selected layer, source and reasoning. Reuse that context when the next design question comes up.';
      const steps = node('ol', 'next-memory-start');
      for (const [heading, text] of [
        ['Capture', 'Select a layer and record what worked, what did not, or a rule to follow.'],
        ['Understand', 'Read the saved guidance, its scope and the evidence behind it.'],
        ['Revisit', 'Correct or disable guidance when the project changes.'],
      ]) {
        const item = node('li', '');
        item.append(node('strong', '', heading), node('span', '', text));
        steps.append(item);
      }
      empty.append(steps);
      library.querySelector('.decision-memory-empty strong').textContent = 'No saved decisions yet';
      library.querySelector('.decision-memory-empty p').textContent =
        'New decisions will appear here. Import an existing library or capture one on the right.';
    }
    refreshAvailability();
    stage.scrollTop = changed ? 0 : (scroll ?? 0);
  }
  return { capture, update, refreshAvailability };
}
