import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emptyReviewDraft,
  humanizeProperty,
  parseReviewDraft,
  reviewAfterValue,
  reviewSelection,
  reviewSummary,
} from './review.js';

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

test('turns source properties into calm human labels', () => {
  assert.equal(humanizeProperty('borderRadius'), 'Border radius');
  assert.equal(humanizeProperty('font-size'), 'Font size');
  assert.equal(humanizeProperty('aria_label'), 'Aria label');
});

test('summarizes review readiness across elements and unresolved mappings', () => {
  assert.equal(reviewSummary(3, 3, 2), '3 changes ready across 2 elements');
  assert.equal(
    reviewSummary(1, 2, 1, 1),
    '1 change ready across 1 element · 1 change needs mapping',
  );
  assert.equal(reviewSummary(0, 0, 0), 'No design changes are waiting for review.');
});
