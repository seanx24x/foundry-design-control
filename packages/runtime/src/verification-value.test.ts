import assert from 'node:assert/strict';
import test from 'node:test';
import { verificationValueMatches } from './verification-value.js';

test('compares rebuilt values without numeric-prefix false positives', () => {
  assert.equal(verificationValueMatches('minHeight', '44px', 44, 'px'), true);
  assert.equal(verificationValueMatches('padding', '8px 20px', '8px'), false);
  assert.equal(verificationValueMatches('width', '44px', '44rem'), false);
  assert.equal(verificationValueMatches('width', '96px', '1in'), true);
});

test('reads the measured value from structured typography evidence', () => {
  assert.equal(
    verificationValueMatches('fontSize', { value: '16px', lineCount: 2 }, 16, 'px'),
    true,
  );
  assert.equal(
    verificationValueMatches('fontSize', { value: '14px', lineCount: 2 }, 16, 'px'),
    false,
  );
});
