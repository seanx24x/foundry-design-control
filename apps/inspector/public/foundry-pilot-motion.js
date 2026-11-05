// Presentation only. Existing playback and authoring nodes keep their handlers.
export function motionPresentation(motion, availability) {
  return {
    status: availability.label,
    state: !availability.editable
      ? 'unavailable'
      : motion?.playState === 'running'
        ? 'live'
        : 'idle',
    comparisonNote: 'Path diagrams, not rendered product previews.',
    easingNote: 'Local illustration · preview the product on Canvas.',
  };
}

export function refinePilotMotion(root, { motion, availability }) {
  root.classList.add('foundry-motion-interior');
  const model = motionPresentation(motion, availability);
  const make = (tag, className, text) => {
    const element = root.ownerDocument.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  };
  const stage = root.querySelector('#motion-studio-stage');
  const status = stage.querySelector('.next-motion-heading > span');
  status.dataset.motionStatus = model.state;
  status.textContent = model.status;

  // Empty states explain the next step once, in the main panel.
  const empty = stage.querySelector('.next-motion-content > .motion-studio-empty');
  if (!motion && empty) {
    const note = stage.querySelector('.next-motion-notice');
    const description = empty.querySelector('p');
    if (description) description.textContent = availability.reason;
    else empty.append(make('p', '', availability.reason));
    empty.setAttribute('role', 'status');
    note?.remove();
  }

  const curve = root.querySelector('.motion-curve-editor');
  if (curve) {
    curve.querySelector('header strong').textContent = 'Easing';
    curve.querySelector('.motion-curve-source > span').textContent =
      curve.dataset.easingDraft === 'true' ? 'Draft easing' : 'Current easing';
    const note = curve.querySelector('.motion-controls-note');
    if (note)
      note.textContent =
        'Drag or type to explore. Use easing adds to Review; Cancel discards this local draft.';
    for (const button of curve.querySelectorAll('[data-curve-preset]'))
      button.title = `${button.textContent.trim()}: explore locally, then Use easing`;
    const diagnostics = curve.querySelector('.motion-curve-diagnostics');
    diagnostics.append(make('p', 'foundry-motion-caption', model.easingNote));
    curve.querySelector('.motion-curve-presets').setAttribute('role', 'group');
    const choices = curve.querySelector('.motion-curve-tabs');
    if (choices) {
      choices.setAttribute('role', 'group');
      choices.setAttribute('aria-label', 'Replace easing type');
      for (const button of choices.querySelectorAll('[data-curve-kind-select]')) {
        button.removeAttribute('role');
        button.removeAttribute('aria-selected');
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.curveKindSelect === curve.dataset.curveKind),
        );
        button.title = 'Explore this easing type locally; Use easing adds it to Review';
      }
    }
  }

  const comparison = root.querySelector('.motion-comparison');
  if (comparison) {
    comparison
      .querySelector('header > span')
      .append(make('p', 'foundry-motion-caption', model.comparisonNote));
  }

  // Add disclosure artwork without replacing the original disclosure/controls.
  for (const summary of root.querySelectorAll('.next-motion-disclosure > summary')) {
    if (summary.querySelector('[data-foundry-icon]')) continue;
    const icon = root.ownerDocument.createElement('i');
    icon.dataset.icon = 'chevronDown';
    summary.append(icon);
  }
}
