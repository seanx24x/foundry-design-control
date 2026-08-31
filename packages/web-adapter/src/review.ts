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
