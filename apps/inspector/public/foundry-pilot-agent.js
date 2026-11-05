import { foundryPilotIcon } from './foundry-pilot-icons.js';

// Presentation only. Requests, draft values, proposals and their handlers remain app-owned.
export function agentProposalPresentation(status) {
  switch (status) {
    case 'previewing':
      return {
        label: 'Preview active',
        copy: 'This direction is previewing on Canvas. Move to Review to keep it for review; source is unchanged.',
      };
    case 'promoted':
      return {
        label: 'In Review',
        copy: 'This direction was moved to Review. Source changes still require reviewed Apply.',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        copy: 'This proposal is marked rejected. No source change is recorded by this action.',
      };
    default:
      return {
        label: 'Proposed',
        copy: 'Preview on Canvas first. Moving to Review is a separate step.',
      };
  }
}

export function mountPilotVisualAgent(root) {
  root.classList.add('foundry-agent-interior');
  const make = (tag, className, text) => {
    const element = root.ownerDocument.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const form = root.querySelector('.visual-agent-compose-form');
  const context = root.querySelector('.visual-agent-compose');
  const attachment = make('details', 'foundry-agent-attachments');
  const summary = make('summary', 'foundry-agent-attachment-summary');
  const icon = make('span', 'foundry-agent-attachment-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = foundryPilotIcon('layers');
  const label = make('span', 'foundry-agent-attachment-label');
  label.append(
    make('span', '', 'Attached context'),
    make('strong', 'foundry-agent-attachment-name'),
  );
  summary.append(icon, label, make('span', 'foundry-agent-attachment-count'));
  attachment.append(summary, context);
  const box = make('div', 'foundry-agent-composer-box');
  box.append(
    attachment,
    root.querySelector('#visual-agent-prompt').closest('label'),
    root.querySelector('.next-agent-composer-head'),
    root.querySelector('.next-agent-error'),
    root.querySelector('.next-agent-send-row'),
  );
  const connection = root.querySelector('.next-agent-connection-notice');
  const connectionDetails = make('details', 'foundry-agent-connection-details');
  connectionDetails.append(make('summary', 'foundry-agent-connection-summary'));
  connectionDetails.append(...connection.children);
  connection.append(connectionDetails);
  const safety = context.querySelector('.visual-agent-safety');
  form.append(box, connection, safety);
  // One visible connection owner. The attached-context pane no longer repeats
  // the same status; the original live node and update owner remain intact.
  context.querySelector('.next-agent-connection').hidden = true;
  const dock = make('div', 'foundry-agent-composer-dock');
  form.before(dock);
  dock.append(form);
  // Captured context stays outside the renderer-replaced conversation body.
  root.querySelector('.next-agent-heading').append(root.querySelector('.next-agent-snapshot'));
  root.querySelector('.visual-agent-context-section > h3').textContent = 'Current attachments';
  root.querySelector('.next-agent-snapshot > summary').textContent = 'Captured context';
  safety.textContent = 'Preview is temporary. Source changes require reviewed Apply.';
}

export function refinePilotVisualAgent(root, { request, connected, listener, contextCount }) {
  root.dataset.agentConversation = String(Boolean(request));
  const names = [...root.querySelectorAll('#visual-agent-context article strong')].map(
    (element) => element.textContent,
  );
  root.querySelector('.foundry-agent-attachment-name').textContent = names.length
    ? names[0]
    : 'Select layers or draw a region';
  root.querySelector('.foundry-agent-attachment-count').textContent =
    contextCount > 1 ? `+${contextCount - 1} more` : contextCount ? 'Inspect' : 'Add context';
  root.querySelector('.foundry-agent-connection-summary').textContent = !connected
    ? 'Preview offline · Reconnect to send'
    : listener
      ? 'Listener connected · Ready to queue'
      : 'No agent listening · Questions will queue locally';
  const empty = root.querySelector('.visual-agent-conversation .visual-agent-empty');
  if (empty && !request) {
    empty.querySelector('strong').textContent = 'What would you like to improve?';
    empty.querySelector('p').textContent =
      'A closer look at hierarchy, spacing or consistency. Ask about the UI you have selected, then explore a direction on Canvas.';
  }
  const proposalHeading = root.querySelector('.visual-agent-proposals > header > span');
  if (proposalHeading) proposalHeading.textContent = 'Preview first. Review when ready.';
  for (const proposal of root.querySelectorAll('.visual-agent-proposal')) {
    const presentation = agentProposalPresentation(proposal.dataset.status);
    proposal.querySelector(':scope > header > div > span').textContent = presentation.label;
    let explanation = proposal.querySelector('.foundry-agent-proposal-boundary');
    if (!explanation) {
      explanation = root.ownerDocument.createElement('p');
      explanation.className = 'foundry-agent-proposal-boundary';
    }
    proposal.querySelector(':scope > footer').before(explanation);
    explanation.textContent = presentation.copy;
    // A readable exact-change summary uses the already rendered proposal values.
    // It is not a measured result, and the original source disclosure remains.
    let values = proposal.querySelector('.foundry-agent-values');
    const exact = [...proposal.querySelectorAll('.visual-agent-proposal-grid section')].find(
      (section) => section.querySelector('span')?.textContent === 'Exact values',
    );
    if (exact && !values) {
      values = root.ownerDocument.createElement('div');
      values.className = 'foundry-agent-values';
      const title = root.ownerDocument.createElement('span');
      title.textContent = 'Proposed change';
      values.append(title);
      for (const source of exact.querySelectorAll('code')) {
        const value = root.ownerDocument.createElement('code');
        value.textContent = source.textContent;
        values.append(value);
      }
      proposal.querySelector(':scope > header').after(values);
    }
    // This is a future verification plan, not evidence of a completed test.
    const verification = [
      ...proposal.querySelectorAll('.visual-agent-proposal-grid section > span'),
    ].find((label) => label.textContent === 'Verification');
    if (verification) verification.textContent = 'Verification plan';
  }
}
