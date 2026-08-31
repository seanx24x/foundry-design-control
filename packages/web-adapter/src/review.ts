export interface ReviewDraft {
  selections: Record<string, boolean>;
  afterValues: Record<string, string>;
}

export function emptyReviewDraft(): ReviewDraft {
  return { selections: {}, afterValues: {} };
}

export function parseReviewDraft(value: string | null): ReviewDraft {
  if (!value) return emptyReviewDraft();
  try {
    const parsed = JSON.parse(value) as Partial<ReviewDraft>;
    return {
      selections:
        parsed.selections && typeof parsed.selections === 'object' ? parsed.selections : {},
      afterValues:
        parsed.afterValues && typeof parsed.afterValues === 'object' ? parsed.afterValues : {},
    };
  } catch {
    return emptyReviewDraft();
  }
}

export function reviewSelection(
  draft: ReviewDraft,
  changeId: string,
  defaultSelected: boolean,
): boolean {
  return draft.selections[changeId] ?? defaultSelected;
}

export function reviewAfterValue(draft: ReviewDraft, changeId: string, fallback: unknown): string {
  return draft.afterValues[changeId] ?? String(fallback);
}

export function humanizeProperty(property: string): string {
  return property
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());
}

export function reviewSummary(
  selectedCount: number,
  selectableCount: number,
  elementCount: number,
  unresolvedCount = 0,
): string {
  if (!selectableCount && !unresolvedCount) return 'No design changes are waiting for review.';
  const changes = `${selectedCount} ${selectedCount === 1 ? 'change' : 'changes'}`;
  const elements = `${elementCount} ${elementCount === 1 ? 'element' : 'elements'}`;
  const unresolved = unresolvedCount
    ? ` · ${unresolvedCount} ${unresolvedCount === 1 ? 'change needs' : 'changes need'} mapping`
    : '';
  return `${changes} ready across ${elements}${unresolved}`;
}
