import { foundryPilotIcon } from './foundry-pilot-icons.js';

export function stateMeasurementDimensions(measurement) {
  const size = measurement?.bounds ?? measurement;
  return Number.isFinite(size?.width) &&
    Number.isFinite(size?.height) &&
    size.width >= 0 &&
    size.height >= 0
    ? { width: size.width, height: size.height }
    : null;
}

// Presentation only: keep authored controls, evidence and the isolated frame intact.
const make = (root, tag, className, text) => {
  const element = root.ownerDocument.createElement(tag);
  element.className = className;
  if (text != null) element.textContent = text;
  return element;
};
const glyph = (root, name, className) => {
  const element = make(root, 'i', className);
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = foundryPilotIcon(name);
  return element;
};

export function mountPilotStateWorkbench(root) {
  root.classList.add('foundry-state-interior');
  const scroll = root.querySelector('.next-state-controls');
  const coverage = root.querySelector('.state-verification-summary');
  coverage.prepend(make(root, 'h2', '', 'Inspection coverage'));
  scroll.querySelector('.next-state-conditions').before(coverage);
  const conditions = scroll.querySelector('.next-state-conditions');
  conditions
    .querySelector('h2')
    .after(
      make(
        root,
        'p',
        'next-state-help foundry-state-condition-help',
        'Changes inspect this isolated preview automatically. Canvas stays unchanged.',
      ),
    );
  const evidence = root.querySelector('.next-state-evidence-scroll');
  const note = root.querySelector('.state-ready-note');
  note.prepend(glyph(root, 'stateWorkbench', 'foundry-state-status-icon'));
  note.setAttribute('role', 'status');
  evidence.prepend(note);
  const receipt = make(root, 'p', 'next-state-help foundry-state-measurement');
  receipt.dataset.stateMeasurement = '';
  receipt.hidden = true;
  note.after(receipt);
  root.querySelector('.next-state-footer > span').textContent =
    'Inspection only. No Review changes; Canvas and source stay unchanged.';
  root
    .querySelector('#state-run-verification')
    .setAttribute('aria-describedby', 'state-verification-note');
  const requested = root.querySelector('.next-state-requested dl');
  const stateRow = make(root, 'div', 'foundry-state-requested-state');
  const stateValue = make(root, 'dd', '');
  stateValue.id = 'foundry-state-requested-state';
  stateRow.append(make(root, 'dt', '', 'State'), stateValue);
  requested.prepend(stateRow);
  // Connection is already shown by the preview header and footer, not a requested axis.
  root.querySelector('#state-verification-connection').closest('div').hidden = true;
  root.querySelector('.state-preview-panel > header strong').textContent = 'Isolated preview';
}

export function refinePilotStateWorkbench(root, { model, context, states }) {
  const receipt = root.querySelector('[data-state-measurement]');
  const timestamp = model.record?.measuredAt;
  const date = new Date(timestamp ?? '');
  const bounds = stateMeasurementDimensions(model.record?.measurement);
  const hasReceipt = model.status === 'inspected' && Number.isFinite(date.getTime());
  receipt.hidden = !hasReceipt;
  receipt.textContent = hasReceipt
    ? `Measured ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}${bounds ? ` · ${Math.round(bounds.width)} × ${Math.round(bounds.height)} px target` : ''}`
    : '';
  receipt.title = hasReceipt ? timestamp : '';
  root.querySelector('#foundry-state-requested-state').textContent =
    states.find((state) => state.id === context.state)?.label ?? context.state;
  for (const button of root.querySelectorAll('[data-state-matrix-state]')) {
    if (!button.querySelector('.foundry-state-choice-icon')) {
      button.querySelector('i, svg')?.remove();
      button.prepend(glyph(root, 'stateWorkbench', 'foundry-state-choice-icon'));
    }
  }
  const axes = Object.values(model.result?.axes ?? {});
  root.querySelectorAll('.next-state-axis').forEach((detail, index) => {
    detail.dataset.status = axes[index]?.status ?? '';
    const summary = detail.querySelector('summary');
    if (!summary.querySelector('.foundry-state-chevron'))
      summary.append(glyph(root, 'chevronDown', 'foundry-state-chevron'));
  });
}
