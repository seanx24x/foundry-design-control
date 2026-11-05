// Presentation only: the adapter retains saved guidance and all transactions.
export function createPilotDesignMemory(root) {
  root.classList.add('foundry-memory-interior');
  const make = (tag, className, text) => {
    const element = root.ownerDocument.createElement(tag);
    element.className = className;
    if (text != null) element.textContent = text;
    return element;
  };
  const detail = root.querySelector('.next-memory-detail');
  const capture = root.querySelector('.decision-memory-capture');
  const header = capture.querySelector('header');
  const form = capture.querySelector('.next-memory-capture-fields');
  const newDecision = root.querySelector('[data-studio-action="memory-record"]');
  capture.id = 'foundry-memory-capture';
  newDecision.setAttribute('aria-controls', capture.id);
  const back = make('button', 'secondary-button foundry-memory-back', 'Back to decision');
  back.type = 'button';
  back.dataset.memoryBack = '';
  header.append(
    back,
    make(
      'p',
      'foundry-memory-capture-intro',
      'Record what to keep, what to avoid, or a rule to follow. Guidance is saved to this project; it does not change source.',
    ),
  );
  const context = make('section', 'foundry-memory-capture-context');
  const contextNode = root.querySelector('#decision-memory-context');
  context.append(contextNode.previousElementSibling, contextNode);
  const outcome = make('section', 'foundry-memory-capture-outcome');
  const outcomeNode = root.querySelector('.decision-outcome-picker');
  const outcomeHelp = outcomeNode.nextElementSibling;
  outcome.append(outcomeNode.previousElementSibling, outcomeNode, outcomeHelp);
  form.prepend(context, outcome);
  let view,
    hasDecisions = false;
  const show = (next) => {
    view = next;
    root.dataset.memoryView = next;
    detail.hidden = next === 'capture';
    capture.hidden = next !== 'capture';
    newDecision.setAttribute('aria-expanded', String(next === 'capture'));
    back.hidden = !hasDecisions;
  };
  // Capture phase opens the original field before the app's focus handler runs.
  root.addEventListener(
    'click',
    (event) => {
      if (event.target.closest('[data-studio-action="memory-record"]')) show('capture');
      else if (event.target.closest('[data-design-decision]')) show('read');
    },
    true,
  );
  back.addEventListener('click', () => {
    show('read');
    (
      root.querySelector('.decision-memory-row[aria-pressed="true"]') ??
      root.querySelector('#decision-memory-search')
    )?.focus();
  });
  function update({ decision, decisions }) {
    hasDecisions = decisions.length > 0;
    show(!hasDecisions ? 'capture' : (view ?? 'read'));
    root.querySelector('.next-memory-detail-head > strong').textContent = 'Saved guidance';
    const emptyCopy = root.querySelector('.decision-memory-browser .decision-memory-empty p');
    if (!hasDecisions && emptyCopy)
      emptyCopy.textContent = 'Capture your first decision or import an existing project library.';
    if (!decision) return;
    const overview = root.querySelector('.decision-memory-overview');
    const outcomeLabel = overview.querySelector('.eyebrow');
    outcomeLabel.textContent =
      { approved: 'Approved direction', rejected: 'Rejected direction', rule: 'Project rule' }[
        decision.outcome
      ] ?? 'Saved decision';
    const relevance = overview.querySelector('.decision-relevance');
    if (relevance) {
      relevance.setAttribute('aria-label', 'Current context relevance');
      relevance.append(
        make(
          'small',
          'foundry-memory-match-help',
          'Context match, not a confidence or verification score.',
        ),
      );
    }
    const evidence = root.querySelector('.decision-memory-evidence');
    evidence.querySelector('header strong').textContent = 'Evidence and provenance';
    evidence
      .querySelector('header')
      .after(
        make(
          'p',
          'foundry-memory-evidence-help',
          'Saved references explain this decision. They do not verify the current product.',
        ),
      );
    if (decision.rationale) {
      const reason = [...evidence.children].findLast(
        (item) => item.tagName === 'P' && !item.classList.contains('foundry-memory-evidence-help'),
      );
      if (reason) {
        const section = make('section', 'foundry-memory-reason');
        section.append(make('h3', '', 'Reasoning'), reason);
        overview.after(section);
      }
    }
  }
  return { update };
}
