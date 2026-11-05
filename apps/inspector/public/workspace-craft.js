import { inspectorSingletons } from './inspector-layout.js';

// Bounded presentation adapters. Native inputs, listeners, values, disabled
// states and workflow status owners are retained; no observer watches values.
export const CRAFT_FIELD_GRIDS =
  '.typography-property-fields, .motion-studio-fields, .motion-curve-fields';
const helpers = [
  ['.next-type-property-scroll', '.next-type-help', 'Editing help'],
  ['.next-motion-property-scroll', '.next-motion-help', 'Editing help'],
  ['.next-system-property-scroll', '.next-system-help', 'About this evidence'],
  ['.next-state-controls', '[data-craft-supporting]', 'About state coverage'],
  ['.decision-memory-evidence', '.foundry-memory-evidence-help', 'About these references'],
  [
    '.next-workshop-properties',
    '.workshop-variant-properties > .workshop-help',
    'About variant properties',
  ],
];
const helpViews = new Map();
export function refineWorkspaceCraft(root) {
  const doc = root?.ownerDocument ?? root;
  if (!doc?.documentElement?.dataset.foundryPilot) return;
  for (const grid of root.querySelectorAll(CRAFT_FIELD_GRIDS)) {
    grid.dataset.craftFields = '';
    const rows = [...grid.children].filter((node) => node.tagName === 'LABEL' && !node.hidden);
    const full = rows.map((row) => {
      const input = row.querySelector('input, select, textarea');
      const name =
        input?.dataset.typographyControl ??
        input?.dataset.studioProperty ??
        input?.dataset.studioKeyframeProperty;
      const wide =
        input?.tagName === 'SELECT' ||
        row.classList.contains('is-wide') ||
        [
          'fontFamily',
          'fontVariationSettings',
          'easing',
          'value',
          'segmentEasing',
          'duration',
          'delay',
          'iterations',
          'lineHeight',
          'letterSpacing',
        ].includes(name);
      row.dataset.craftText = String(
        ['fontFamily', 'fontVariationSettings', 'easing', 'value', 'segmentEasing'].includes(name),
      );
      row.classList.toggle('craft-field-wide', wide);
      row.dataset.craftField = '';
      return wide;
    });
    rows.forEach((row) => row.removeAttribute('data-craft-single'));
    inspectorSingletons(full).forEach((index) => (rows[index].dataset.craftSingle = ''));
  }
  for (const row of root.querySelectorAll('.system-value-row, .next-workshop-facts > div')) {
    row.dataset.craftReadout = '';
  }
  for (const [ownerSelector, textSelector, title] of helpers) {
    for (const owner of root.querySelectorAll(ownerSelector)) {
      const notes = [...owner.querySelectorAll(textSelector)].filter(
        (node) =>
          !node.closest('details, [role="alert"], [role="status"]') &&
          !node.querySelector('input, button, select, textarea') &&
          !node.className.includes('error') &&
          !node.hidden &&
          !/^(Reconnect|Select one|Unavailable|Unsupported|Failed|Cannot|Could not|Preview offline|Disconnected|No .*?(?:available|indexed|found)|Choose a)/i.test(
            node.textContent.trim(),
          ),
      );
      if (!notes.length) continue;
      let help = owner.querySelector(':scope > .craft-context-help');
      if (!help) {
        help = doc.createElement('details');
        help.className = 'craft-context-help';
        const summary = doc.createElement('summary');
        summary.textContent = title;
        help.append(summary);
        const key = `${doc.documentElement.dataset.foundryPilot}:${ownerSelector}:${title}`;
        help.open = helpViews.get(key) ?? false;
        help.addEventListener('toggle', () => {
          if (help.isConnected) helpViews.set(key, help.open);
        });
        owner.append(help);
      }
      help.append(...notes);
    }
  }
  for (const dialog of root.querySelectorAll('.next-color-picker')) {
    dialog.classList.add('craft-editor');
    const help = dialog.querySelector(
      '.next-color-format-help, .next-gradient-help, .next-position-help',
    );
    if (help && !help.closest('details')) {
      const details = doc.createElement('details');
      details.className = 'craft-editor-help';
      const summary = doc.createElement('summary');
      summary.textContent = 'Editing help';
      details.append(summary);
      help.before(details);
      details.append(help);
    }
  }
}
