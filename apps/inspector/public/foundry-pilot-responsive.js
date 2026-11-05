import { foundryPilotIcon } from './foundry-pilot-icons.js';

// Presentation only: the app retains frame transport, scope transactions and captures.
const make = (root, tag, className, text) => {
  const node = root.ownerDocument.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const icon = (root, name, className) => {
  const node = make(root, 'i', className);
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = foundryPilotIcon(name);
  return node;
};

export function mountPilotResponsiveLab(root) {
  root.classList.add('foundry-responsive-interior');
  const controls = root.querySelector('.responsive-lab-controls');
  const resize = make(root, 'section', 'foundry-responsive-resize');
  controls.prepend(resize);
  resize.append(
    root.querySelector('.responsive-target-group'),
    root.querySelector('#responsive-width').closest('.responsive-control-group'),
  );
  resize.querySelector('.responsive-target-group > span').textContent = 'Resize Custom preview';
  root.querySelector('.responsive-stress-group > span').textContent = 'Temporary stress';
  const scope = root.querySelector('.responsive-scope-group');
  root.querySelector('.next-responsive-comparison').before(scope);
  scope.querySelector(':scope > span').textContent = 'Scope for future edits';
  const inspection = root.querySelector('.next-responsive-inspection-scroll');
  inspection.prepend(root.querySelector('.next-responsive-audit'));
  const comparison = root.querySelector('.next-responsive-comparison');
  comparison.querySelector('summary').textContent = 'Geometry comparison';
  comparison.querySelector('.responsive-comparison > header p').textContent =
    'Custom frame only. Capture before, resize or stress it, then capture after. These are measurements, not screenshots.';
}

export function refinePilotResponsiveLab(root, { contexts, target, running, summary, stale }) {
  // Label follows the original range's actual function; never change its value or handler.
  root
    .querySelector('#responsive-width')
    .setAttribute(
      'aria-label',
      target === 'container' ? 'Custom container width' : 'Custom viewport width',
    );
  const cards = [...root.querySelectorAll('[data-responsive-card]')];
  for (const choice of root.querySelectorAll('[data-next-responsive-frame]')) {
    const id = choice.dataset.nextResponsiveFrame;
    const context = contexts.find((item) => item.id === id);
    const card = cards.find((item) => item.dataset.responsiveCard === id);
    if (!choice.querySelector('.foundry-responsive-frame-icon')) {
      choice.prepend(icon(root, 'viewport', 'foundry-responsive-frame-icon'));
      choice.append(make(root, 'small', 'foundry-responsive-row-status'));
    }
    // The existing Next model owns status priority and staleness. Reuse its rendered label.
    const status = card?.querySelector('footer > span')?.textContent ?? 'Preview unavailable';
    choice.querySelector('.foundry-responsive-row-status').textContent = status;
    choice.title = `${context?.label ?? id} · ${context?.width ?? '—'} × ${context?.height ?? '—'} · ${status}`;
  }
  const audit = root.querySelector('.next-responsive-audit');
  audit.dataset.auditState = running
    ? 'running'
    : !summary
      ? 'untested'
      : stale
        ? 'stale'
        : summary.failed
          ? 'incomplete'
          : 'measured';
  if (!audit.querySelector('.foundry-responsive-audit-icon'))
    audit.prepend(icon(root, 'responsive', 'foundry-responsive-audit-icon'));
  for (const details of root.querySelectorAll(
    '.next-responsive-boundaries, .next-responsive-comparison, .next-responsive-cross-findings, .responsive-findings',
  )) {
    const heading = details.querySelector(':scope > summary');
    if (!heading || heading.querySelector('.foundry-responsive-chevron')) continue;
    heading.append(icon(root, 'chevronDown', 'foundry-responsive-chevron'));
  }
}
