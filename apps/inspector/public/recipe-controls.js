export const recipeTargetKey = (recipeId, selectionId) => JSON.stringify([recipeId, selectionId]);
export function recipeNewCapture(beforeIds, recipes = []) {
  const ids = new Set(beforeIds);
  const added = recipes.filter((recipe) => !ids.has(recipe.id));
  return added.length === 1 ? added[0] : null;
}

export function recipeCaptureModel({ selection, canSave, connected, pending, needsRecheck }) {
  const single = selection && !(selection.count > 1);
  return {
    disabled: !connected || !single || Boolean(pending) || (!needsRecheck && !canSave),
    label:
      pending === 'capture'
        ? 'Saving recipe…'
        : pending === 'library'
          ? 'Rechecking…'
          : needsRecheck
            ? 'Recheck library'
            : 'Save recipe',
    fallbackName: selection ? `${selection.label} treatment` : 'Layer treatment',
    message: !connected
      ? 'Reconnect Canvas. Your capture draft is preserved.'
      : !single
        ? 'Select one edited layer to capture a treatment.'
        : needsRecheck
          ? 'Save was not acknowledged. Recheck the library before trying again; a recipe may still be in memory.'
          : 'Saves edited values to this browser’s project library, not to Review or source.',
  };
}

export function recipeApplyModel({
  recipe,
  selection,
  assessment,
  connected,
  pending,
  needsRecheck,
  scope = 'instance',
}) {
  const supported = assessment?.mappings?.filter((item) => item.status !== 'unsupported') ?? [];
  const same =
    supported.length > 0 &&
    supported.every(
      (item) =>
        item.resolvedValue != null && String(item.currentValue) === String(item.resolvedValue),
    );
  return {
    disabled:
      !recipe ||
      !selection ||
      selection.count > 1 ||
      !connected ||
      Boolean(pending) ||
      !assessment?.matched ||
      (!needsRecheck && same && !assessment.ambiguous),
    label:
      pending === 'apply'
        ? 'Adding values…'
        : pending === 'mapping'
          ? 'Rechecking…'
          : needsRecheck
            ? 'Recheck mapping'
            : same && !assessment?.ambiguous
              ? 'Values match'
              : 'Add to Review',
    message:
      selection?.count > 1
        ? 'Choose one destination layer. Recipes do not apply to a multi-selection here.'
        : needsRecheck
          ? 'Application stopped. Earlier values may already be in Review; inspect Review or Undo, then recheck this mapping. Nothing is retried automatically.'
          : `Previews the selected layer only. Review uses the current ${scope} source scope. Values are recorded separately; source changes only after Apply.`,
    supported: supported.length,
    excluded: assessment?.mappings?.filter((item) => item.status === 'unsupported').length ?? 0,
    ambiguous: assessment?.ambiguous ?? 0,
  };
}

export function recipeOutcomeMessage(result) {
  if (
    !result ||
    !Number.isInteger(result.applied) ||
    !Number.isInteger(result.attempted) ||
    result.applied < 0 ||
    result.applied > result.attempted
  )
    return null;
  return result.applied
    ? `${result.applied} ${result.applied === 1 ? 'change' : 'changes'} recorded from ${result.attempted} supported ${result.attempted === 1 ? 'property' : 'properties'}. Inspect Review before source Apply.`
    : 'No new changes recorded. Supported values may already match the target.';
}
