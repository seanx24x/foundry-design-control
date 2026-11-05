export function workshopCreateKey(component, draft, branchId) {
  return JSON.stringify([
    branchId,
    component.key ?? component.id,
    draft.axisId,
    String(draft.value ?? '')
      .trim()
      .toLowerCase(),
  ]);
}

export function workshopCreatedChange(component, draft, changes, includeClosed = false) {
  const axis = component.variantAxes?.find((item) => item.id === draft.axisId);
  if (!axis) return undefined;
  const ids = new Set((component.elements ?? []).map((item) => item.id));
  return changes.find(
    (change) =>
      ids.has(change.target?.id) &&
      change.property === `component.variant.create.${axis.property}` &&
      String(change.after ?? '')
        .trim()
        .toLowerCase() ===
        String(draft.value ?? '')
          .trim()
          .toLowerCase() &&
      (includeClosed || !['rejected', 'applied'].includes(change.status)),
  );
}

// Mirrors the existing adapter's validation, without rewriting authored values.
// A base variant is a source reference, never a promise to clone gallery pixels.
export function workshopAuthoringModel(
  component,
  draft,
  changes = [],
  { connected, pending = false, acknowledged = false } = {},
) {
  const axis = component.variantAxes?.find((item) => item.id === draft.axisId);
  const errors = {};
  const label = String(draft.label ?? '').trim(),
    value = String(draft.value ?? '').trim();
  if (!axis?.canCreate) errors.axisId = 'Choose a writable variant property.';
  if (!label) errors.label = 'Add a variant name.';
  if (!value) errors.value = 'Add a source value.';
  else if (axis?.values?.some((item) => String(item).toLowerCase() === value.toLowerCase()))
    errors.value = `${value} already exists on ${axis.label}.`;
  if (draft.baseVariantId && !component.variants?.some((item) => item.id === draft.baseVariantId))
    errors.baseVariantId = 'Choose an indexed base reference.';
  const staged = acknowledged || Boolean(workshopCreatedChange(component, draft, changes));
  const live = connected && component.elements?.length > 0;
  return {
    axis,
    errors,
    staged,
    disabled: !live || pending || staged || Object.keys(errors).length > 0,
    label: pending ? 'Adding variant…' : staged ? 'In Review' : 'Add variant to Review',
    message: pending
      ? 'Waiting for Review acknowledgement. Keep this draft open.'
      : staged
        ? 'This source option is in Review. It is not an authored gallery variant until Apply and re-index.'
        : !connected
          ? 'Reconnect Canvas to add this variant. Your draft is preserved.'
          : !component.elements?.length
            ? 'Select a component with a rendered instance.'
            : Object.values(errors)[0] ||
              'Creates a reviewed source change. The live instance receives the draft attribute; source is written only after Apply.',
  };
}
