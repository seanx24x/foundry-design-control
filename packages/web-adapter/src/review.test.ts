import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyReviewDraft, parseReviewDraft, reviewAfterValue, reviewSelection } from './review.js';

test('preserves an explicitly unchecked review through repeated renders', () => {
  const draft = emptyReviewDraft();
  draft.selections.changeOne = false;
  assert.equal(reviewSelection(draft, 'changeOne', true), false);
  assert.equal(reviewSelection(draft, 'newChange', true), true);
});

test('preserves edited after values and safely recovers invalid stored drafts', () => {
  const draft = parseReviewDraft(
    JSON.stringify({ selections: { changeOne: false }, afterValues: { changeOne: '28' } }),
  );
  assert.equal(reviewAfterValue(draft, 'changeOne', 24), '28');
  assert.deepEqual(parseReviewDraft('{invalid'), emptyReviewDraft());
});
