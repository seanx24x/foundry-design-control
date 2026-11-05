// Ephemeral Review editing state only. Never persists, submits, or restores
// inclusion decisions; those belong to the acknowledged session.
export function captureReviewEditState(root, contextKey) {
  if (!root || root.dataset.reviewContext !== contextKey) return null;
  const active = root.contains(document.activeElement) ? document.activeElement : null;
  const fields = [...root.querySelectorAll('[data-after-id]')];
  const control = active?.closest(
    '[data-after-id], [data-change-id], [data-preview-change], [data-delete-change]',
  );
  const attribute = [
    'data-after-id',
    'data-change-id',
    'data-preview-change',
    'data-delete-change',
  ].find((name) => control?.hasAttribute(name));
  return {
    contextKey,
    drafts: fields
      .filter((field) => field.value !== field.defaultValue)
      .map((field) => ({
        id: field.dataset.afterId,
        identity: field.dataset.reviewIdentity,
        baseline: field.defaultValue,
        value: field.value,
      })),
    focus: attribute
      ? {
          attribute,
          id: control.getAttribute(attribute),
          start: control.selectionStart,
          end: control.selectionEnd,
          direction: control.selectionDirection,
        }
      : null,
    top: root.scrollTop,
    left: root.scrollLeft,
  };
}

export function restoreReviewEditState(root, state, contextKey) {
  if (!root) return;
  root.dataset.reviewContext = contextKey;
  if (!state || state.contextKey !== contextKey) return;
  for (const field of root.querySelectorAll('[data-after-id]')) {
    const draft = state.drafts.find(
      (item) =>
        item.id === field.dataset.afterId &&
        item.identity === field.dataset.reviewIdentity &&
        item.baseline === field.defaultValue,
    );
    if (!draft) continue;
    field.value = draft.value;
    field.dataset.foundryDirty = 'true';
  }
  if (state.focus) {
    const { attribute, id, start, end, direction } = state.focus;
    const field = [...root.querySelectorAll('[' + attribute + ']')].find(
      (item) => item.getAttribute(attribute) === id,
    );
    // A native disabled control cannot retain focus; keep pending inclusion
    // controls focusable via aria-disabled, with the transaction guard in app.js.
    if (field && !field.disabled && !root.closest('[inert]')) {
      field.focus({ preventScroll: true });
      if (start != null && end != null && typeof field.setSelectionRange === 'function') {
        field.setSelectionRange(start, end, direction ?? 'none');
      }
    }
  }
  root.scrollTop = state.top;
  root.scrollLeft = state.left;
}
