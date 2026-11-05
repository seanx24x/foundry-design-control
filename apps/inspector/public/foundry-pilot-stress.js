import { foundryPilotIcon } from './foundry-pilot-icons.js';

// Presentation only. Drafts, applied conditions, scans and corrections stay app-owned.
export function mountPilotStressLab(root) {
  root.classList.add('foundry-stress-interior');
  const help = root.ownerDocument.createElement('p');
  help.className = 'next-stress-help foundry-stress-condition-help';
  help.textContent =
    'Choose temporary conditions, then run them. Scanning only measures the current preview.';
  root.querySelector('#stress-profile-list').before(help);
  root.querySelector('.stress-lab-browser > header h2').textContent = 'Test conditions';
}

export function refinePilotStressLab(root, { label }) {
  const summary = root.querySelector('#stress-summary-grid');
  summary.dataset.evidence = label;
  if (!summary.querySelector('.foundry-stress-status-icon')) {
    const icon = root.ownerDocument.createElement('i');
    icon.className = 'foundry-stress-status-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = foundryPilotIcon('contentStress');
    summary.prepend(icon);
  }
  for (const button of root.querySelectorAll('[data-stress-condition]')) {
    // renderIcons replaces i with svg. Keep its original artwork inside a stable
    // decorative box; the button remains the only interactive control.
    if (button.querySelector('.foundry-stress-choice-mark')) continue;
    const artwork = button.querySelector('i, svg');
    if (!artwork) continue;
    const mark = root.ownerDocument.createElement('div');
    mark.className = 'foundry-stress-choice-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.append(artwork);
    button.prepend(mark);
  }
}

export function pilotStressPreviewBounds(root) {
  // Shared pilot shells use display:contents and therefore have no clipping box.
  // Clip the existing Canvas overlay to the visible body, excluding chrome/footer.
  const bounds = root.getBoundingClientRect();
  const header = root.querySelector(':scope > .mode-head').getBoundingClientRect();
  const footer = root.querySelector(':scope > .stress-lab-footer').getBoundingClientRect();
  return {
    left: bounds.left,
    right: bounds.right,
    top: Math.max(bounds.top, header.bottom),
    bottom: Math.min(bounds.bottom, footer.top),
  };
}
