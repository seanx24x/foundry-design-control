import { deliveryNarrativeReadOnly } from './workflow.js';

// Commands are copied for an explicit terminal action, never executed here.
export function deliveryShellArgument(value) {
  return "'" + String(value).replaceAll("'", "'\"'\"'") + "'";
}

export function deliveryCriteriaSummary(record) {
  const criteria = record.acceptanceCriteria ?? [];
  if (record.blockers?.length)
    return {
      tone: 'warning',
      text: `${record.blockers.length} ${record.blockers.length === 1 ? 'blocker' : 'blockers'}`,
    };
  const failed = criteria.filter((item) => item.status === 'failed').length;
  if (failed) return { tone: 'error', text: `${failed} failed` };
  if (!criteria.length) return { tone: 'neutral', text: 'No criteria recorded' };
  const remaining = criteria.filter((item) => item.status !== 'passed').length;
  return remaining
    ? { tone: 'neutral', text: `${remaining} awaiting results` }
    : { tone: 'success', text: 'All criteria passed' };
}
export function deliveryNarrativeDraft(record) {
  return {
    intent: record.intent ?? '',
    risks: (record.risks ?? []).join('\n'),
    questions: (record.questions ?? []).join('\n'),
  };
}
export function deliveryNarrativePayload(draft) {
  const lines = (text) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  return {
    intent: draft.intent,
    risks: lines(draft.risks),
    questions: lines(draft.questions),
    narrativeSource: 'authored',
  };
}
const equalDraft = (a, b) => ['intent', 'risks', 'questions'].every((key) => a?.[key] === b?.[key]);
const node = (tag, className, text) => {
  const e = document.createElement(tag);
  e.className = className;
  if (text != null) e.textContent = text;
  return e;
};
export function createNextDelivery(root, { saveNarrative, receiveSession, openReview }) {
  root.classList.add('next-delivery');
  root.dataset.nextIconScope = '';
  root.querySelector('.mode-head p').textContent =
    'Reviewed changes, source evidence and the record of what passed';
  const content = root.querySelector('#delivery-content');
  content.setAttribute('role', 'tabpanel');
  content.removeAttribute('aria-live');
  const foot = node('footer', 'next-delivery-footer');
  foot.append(
    node(
      'span',
      '',
      'A handoff is not proof of shipping. Verified records include results from the rebuilt product.',
    ),
  );
  const review = node('button', 'secondary-button', 'Open Review');
  review.type = 'button';
  review.addEventListener('click', openReview);
  foot.append(review);
  root.append(foot);
  const tabs = [...root.querySelectorAll('[data-delivery-tab]')];
  for (const tab of tabs) {
    tab.id = `next-delivery-tab-${tab.dataset.deliveryTab}`;
    tab.setAttribute('aria-controls', content.id);
    tab.addEventListener('keydown', (event) => {
      const index = tabs.indexOf(tab);
      const next =
        event.key === 'ArrowRight'
          ? (index + 1) % tabs.length
          : event.key === 'ArrowLeft'
            ? (index + tabs.length - 1) % tabs.length
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? tabs.length - 1
                : -1;
      if (next < 0) return;
      event.preventDefault();
      tabs[next].click();
      tabs[next].focus();
    });
  }
  let activeKey, activeRecord, base, focus;
  const drafts = new Map(),
    positions = new Map(),
    disclosures = new Map(),
    messages = new Map(),
    pending = new Set();
  const fields = () => [...content.querySelectorAll('[data-delivery-field]')];
  const readDraft = () =>
    Object.fromEntries(fields().map((field) => [field.dataset.deliveryField, field.value]));
  function capture() {
    if (!activeKey) return;
    positions.set(
      activeKey,
      [
        ...content.querySelectorAll(
          '.delivery-stage,.delivery-sidebar > div,.next-delivery-context,.delivery-timeline,.delivery-milestones',
        ),
      ].map((e) => e.scrollTop),
    );
    disclosures.set(
      activeKey,
      [...content.querySelectorAll('details')].map((e) => e.open),
    );
    const field = fields().find((e) => e === document.activeElement);
    focus = field
      ? { key: field.dataset.deliveryField, start: field.selectionStart, end: field.selectionEnd }
      : null;
    if (activeRecord && fields().length) {
      const draft = readDraft();
      if (equalDraft(draft, base)) drafts.delete(activeRecord.id);
      else drafts.set(activeRecord.id, draft);
    }
  }
  let connected = false;
  function syncEditor() {
    const save = content.querySelector('[data-next-save-narrative]');
    if (!save || !activeRecord) return;
    const dirty = !equalDraft(readDraft(), base),
      busy = pending.has(activeRecord.id);
    save.disabled = !connected || !dirty || busy;
    save.textContent = busy ? 'Saving…' : 'Save notes';
    content.querySelector('[data-next-reset-narrative]').disabled = !dirty || busy;
    const message = content.querySelector('.next-delivery-save-status');
    message.textContent = busy
      ? 'Saving handoff notes…'
      : !connected
        ? 'Runtime offline. Your notes stay here; reconnect to save.'
        : messages.get(activeRecord.id) ||
          (dirty
            ? 'Unsaved notes. These describe the handoff; they do not change source.'
            : 'Notes are saved with this handoff. Source changes still require reviewed Apply.');
  }
  content.addEventListener('input', (event) => {
    if (!event.target.matches('[data-delivery-field]')) return;
    if (activeRecord) messages.delete(activeRecord.id);
    syncEditor();
  });
  function addRecordLayout(record) {
    const layout = content.querySelector('.delivery-layout');
    const detail = content.querySelector('.delivery-record-detail');
    if (record.status === 'ready')
      detail.querySelector('.delivery-status').textContent = 'Ready for Apply';
    layout.classList.add('has-record');
    const context = node('aside', 'next-delivery-context');
    context.append(node('header', '', 'Handoff context'));
    const body = node('div', 'next-delivery-context-body');
    context.append(body);
    layout.append(context);
    const grid = detail.querySelector('.delivery-detail-grid');
    const [intent, source, risks, contexts] = [...grid.children];
    body.append(source, contexts);
    const identity = detail.querySelector(':scope > header > code');
    if (identity) {
      const reference = node('section', '');
      reference.append(node('h3', '', 'Record reference'), identity);
      body.append(reference);
    }
    for (const label of root.querySelectorAll('.eyebrow'))
      label.classList.add('next-delivery-label');
    risks.querySelector('.eyebrow').textContent = 'Risks';
    const question = risks.querySelector(
      '[data-delivery-field="questions"], [data-delivery-readonly-field="questions"]',
    );
    question?.before(node('span', 'next-delivery-label', 'Open questions'));
    for (const field of fields())
      field.setAttribute(
        'aria-label',
        { intent: 'Handoff intent', risks: 'Handoff risks', questions: 'Open questions' }[
          field.dataset.deliveryField
        ],
      );
    if (!record.contexts.length)
      contexts.append(node('p', 'delivery-muted', 'No contexts recorded.'));
    const status = detail.querySelector('.delivery-ready,.delivery-blocker');
    const summary = deliveryCriteriaSummary(record);
    status.className = 'next-delivery-criteria-status';
    status.dataset.tone = summary.tone;
    status.textContent = summary.text;
    if (record.blockers.length) {
      const blockers = node('section', 'next-delivery-blockers');
      blockers.append(node('h3', '', 'Needs attention'));
      const list = node('ul', '');
      for (const blocker of record.blockers)
        list.append(
          node(
            'li',
            '',
            typeof blocker === 'string'
              ? blocker
              : (blocker.message ?? blocker.reason ?? JSON.stringify(blocker)),
          ),
        );
      blockers.append(list);
      detail.querySelector('.delivery-criteria').before(blockers);
    }
    if (!deliveryNarrativeReadOnly(record)) {
      const controls = node('footer', 'next-delivery-note-actions');
      const message = node('p', 'next-delivery-save-status');
      message.setAttribute('role', 'status');
      const reset = node('button', 'secondary-button', 'Discard note edits');
      reset.dataset.nextResetNarrative = '';
      const save = node('button', 'primary-button', 'Save notes');
      save.dataset.nextSaveNarrative = '';
      controls.append(message, reset, save);
      grid.append(controls);
      reset.addEventListener('click', () => {
        for (const field of fields()) field.value = base[field.dataset.deliveryField];
        drafts.delete(record.id);
        messages.delete(record.id);
        syncEditor();
      });
      save.addEventListener('click', async () => {
        if (!connected || pending.has(record.id) || equalDraft(readDraft(), base)) return;
        const submitted = readDraft();
        pending.add(record.id);
        syncEditor();
        try {
          const session = await saveNarrative(record.id, deliveryNarrativePayload(submitted));
          const saved = session.deliveryRecords?.find((item) => item.id === record.id);
          if (!saved) throw new Error('The runtime did not return the saved handoff.');
          if (activeRecord?.id === record.id) {
            const current = readDraft();
            base = deliveryNarrativeDraft(saved);
            for (const field of fields()) {
              const key = field.dataset.deliveryField;
              if (current[key] === submitted[key]) field.value = base[key];
            }
            messages.set(
              record.id,
              equalDraft(readDraft(), base)
                ? 'Notes saved.'
                : 'Earlier notes saved. Your newer edits are not saved yet.',
            );
          } else if (equalDraft(drafts.get(record.id), submitted)) drafts.delete(record.id);
          receiveSession(session);
        } catch (error) {
          messages.set(
            record.id,
            `Not saved. ${error instanceof Error ? error.message : 'Try again.'} Your notes are preserved.`,
          );
        } finally {
          pending.delete(record.id);
          syncEditor();
        }
      });
    }
  }
  function update({
    tab,
    records,
    recordId,
    documentId,
    reportId,
    runtimeConnected,
    generating,
    actionError,
  }) {
    connected = runtimeConnected;
    const key = `${tab}:${tab === 'handoff' ? recordId : tab === 'documentation' ? documentId : tab === 'checks' ? reportId : ''}`;
    const changed = key !== activeKey;
    activeKey = key;
    activeRecord = tab === 'handoff' ? records.find((item) => item.id === recordId) : null;
    base = activeRecord ? deliveryNarrativeDraft(activeRecord) : null;
    root.dataset.deliveryView = tab;
    for (const button of tabs) {
      const selected = button.dataset.deliveryTab === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    content.setAttribute('aria-labelledby', `next-delivery-tab-${tab}`);
    const generate = root.querySelector('#delivery-generate-docs');
    generate.hidden = tab !== 'documentation';
    generate.disabled = !connected || generating;
    generate.innerHTML =
      '<i data-icon="refresh"></i>' + (generating ? 'Refreshing…' : 'Refresh documentation');
    const exportButton = root.querySelector('#delivery-export');
    exportButton.hidden = tab !== 'handoff';
    exportButton.disabled = !activeRecord;
    exportButton.title = activeRecord
      ? 'Copy a CLI command. Nothing is exported or written until you run it.'
      : 'Choose a handoff record first';
    foot.querySelector('span').textContent =
      actionError ||
      (tab === 'checks'
        ? 'Visual checks compare approved baselines. They do not apply changes or approve new baselines.'
        : tab === 'documentation'
          ? 'Documentation is derived from indexed sources and delivery records. Refreshing does not edit product source.'
          : tab === 'history'
            ? 'Only passed Apply runs create verified history. Milestones group those entries; they are not deployments.'
            : 'A handoff is not proof of shipping. Verified records include results from the rebuilt product.');
    foot.dataset.error = String(Boolean(actionError));
    if (activeRecord) addRecordLayout(activeRecord);
    for (const label of content.querySelectorAll('.eyebrow'))
      label.classList.add('next-delivery-label');
    for (const count of content.querySelectorAll(
      '.delivery-sidebar > header strong,.delivery-milestones > header strong',
    )) {
      count.textContent = count.textContent
        .replace(/^1 pages$/, '1 page')
        .replace(/^1 groups$/, '1 group');
    }
    if (tab === 'checks') {
      for (const result of content.querySelectorAll('.visual-check-result')) {
        const command = result.querySelector('.visual-check-command');
        if (command)
          command.textContent = `npx foundry-design visual-check approve --run ${deliveryShellArgument(reportId)} --name ${deliveryShellArgument(result.querySelector('h3').textContent)}`;
      }
    }
    for (const button of content.querySelectorAll(
      '[data-delivery-record],[data-delivery-document],[data-visual-report]',
    )) {
      button.setAttribute('aria-pressed', String(button.classList.contains('is-active')));
      button.title = button.querySelector('strong')?.textContent ?? '';
    }
    if (activeRecord && !deliveryNarrativeReadOnly(activeRecord)) {
      const draft = drafts.get(activeRecord.id);
      if (draft) for (const field of fields()) field.value = draft[field.dataset.deliveryField];
      if (!changed && focus) {
        const field = fields().find((e) => e.dataset.deliveryField === focus.key);
        field?.focus({ preventScroll: true });
        field?.setSelectionRange(focus.start, focus.end);
      }
    } else if (activeRecord) drafts.delete(activeRecord.id);
    const empty = content.querySelector('.delivery-stage > .is-stage');
    if (tab === 'handoff' && empty) {
      empty.querySelector('strong').textContent = 'Your reviewed work lands here';
      empty.querySelector('p').textContent =
        'Start in Review. A delivery record collects intent, affected source and acceptance criteria, then adds evidence as the agent applies and verifies the work.';
      const action = node('button', 'secondary-button', 'Open Review');
      action.addEventListener('click', openReview);
      empty.append(action);
    }
    const createMilestone = content.querySelector('#delivery-create-milestone');
    if (createMilestone && !connected) createMilestone.disabled = true;
    for (const [index, e] of [...content.querySelectorAll('details')].entries())
      e.open = disclosures.get(key)?.[index] ?? e.open;
    for (const [index, e] of [
      ...content.querySelectorAll(
        '.delivery-stage,.delivery-sidebar > div,.next-delivery-context,.delivery-timeline,.delivery-milestones',
      ),
    ].entries())
      e.scrollTop = positions.get(key)?.[index] ?? 0;
    syncEditor();
  }
  return { capture, update };
}
