export function responsiveWidthValue(raw, min, max) {
  const value = Number(raw);
  return String(raw).trim() &&
    Number.isInteger(value) &&
    value >= Number(min) &&
    value <= Number(max)
    ? value
    : null;
}

export function responsiveCaptureReady(
  snapshot,
  { selector, target, width, containerWidth, stress },
) {
  if (
    !selector ||
    !snapshot?.selection ||
    snapshot.targetSelector !== selector ||
    snapshot.stressMode !== stress
  )
    return false;
  const size = snapshot.selection;
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return false;
  return target === 'container'
    ? Boolean(snapshot.container?.selector) &&
        Math.abs(snapshot.container.width - containerWidth) <= 2
    : Math.abs(snapshot.viewportWidth - width) <= 1;
}

export function responsiveComparisonMatches(before, after) {
  return Boolean(
    before &&
    after &&
    before.selector &&
    before.selector === after.selector &&
    before.target === after.target &&
    (before.target !== 'container' ||
      (before.containerSelector && before.containerSelector === after.containerSelector)),
  );
}

// A typed companion for the existing range. Native input handlers still own resizing.
export function mountResponsiveWidthEntry(root) {
  const range = root.querySelector('#responsive-width'),
    output = root.querySelector('#responsive-width-output');
  const label = document.createElement('label');
  label.className = 'responsive-width-entry';
  const input = document.createElement('input');
  input.type = 'number';
  input.id = 'responsive-width-entry';
  input.step = '1';
  const unit = document.createElement('span');
  unit.textContent = 'px';
  unit.setAttribute('aria-hidden', 'true');
  label.append(input, unit);
  output.after(label);
  output.hidden = true;
  const error = document.createElement('p');
  error.className = 'responsive-width-error';
  error.id = 'responsive-width-error';
  error.hidden = true;
  error.setAttribute('role', 'alert');
  input.setAttribute('aria-describedby', error.id);
  range.closest('.responsive-control-group').append(error);
  let kind = '',
    dirty = false;
  const restore = () => {
    input.value = range.value;
    dirty = false;
    error.hidden = true;
    input.removeAttribute('aria-invalid');
  };
  const accept = () => {
    if (!dirty) return;
    const value = responsiveWidthValue(input.value, range.min, range.max);
    if (value === null) {
      error.textContent = `Enter a whole number from ${range.min} to ${range.max} px.`;
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    dirty = false;
    error.hidden = true;
    input.removeAttribute('aria-invalid');
    range.value = String(value);
    range.dispatchEvent(new Event('input', { bubbles: true }));
  };
  input.addEventListener('input', () => {
    dirty = true;
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      restore();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      accept();
    }
  });
  input.addEventListener('blur', accept);
  const sync = () => {
    const next = range.getAttribute('aria-label') || 'Custom preview width';
    input.setAttribute('aria-label', next);
    input.min = range.min;
    input.max = range.max;
    if (kind !== next || (!dirty && document.activeElement !== input)) restore();
    kind = next;
  };
  range.addEventListener('input', () => {
    if (document.activeElement !== input) restore();
  });
  return { sync };
}
