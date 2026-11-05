// Presentation only. Existing direction transactions and preview transport stay app-owned.
export function mountPilotDesignBranches(root) {
  root.classList.add('foundry-branches-interior');
  const make = (tag, className, text) => {
    const element = root.ownerDocument.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const editing = make('span', 'foundry-branches-editing');
  root.querySelector('.mode-head h1').after(editing);
  const management = make('details', 'foundry-branches-management');
  const summary = make('summary', 'foundry-branches-management-summary');
  summary.append(
    make('strong', '', 'Active direction details'),
    make('span', 'foundry-branches-management-name'),
  );
  management.append(summary, root.querySelector('#design-branch-detail'));
  root.querySelector('.design-branch-stage').append(management);
}

export function refinePilotDesignBranches(root, { active, comparisonCount }) {
  const editing = root.querySelector('.foundry-branches-editing');
  editing.textContent = `Editing: ${active.name}`;
  editing.title = `Active editing direction: ${active.name}. Comparison selectors do not change it.`;
  root.querySelector('.foundry-branches-management-name').textContent = active.name;
  root.dataset.branchComparison = comparisonCount === 1 ? 'single' : 'pair';
  for (const badge of root.querySelectorAll('.branch-status[data-status="main"]')) {
    badge.textContent = 'Main';
    badge.title = 'Main direction, not a verified or applied source result.';
  }
  // The original promote eligibility and described-by explanation remain authoritative.
  root.querySelector('.next-branch-detail-heading').textContent = 'Editing context';
  root
    .querySelector('.design-branch-compare-head')
    .before(root.querySelector('#next-branch-promote-help'));
}
