import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSource } from './locator.js';

test('parses instrumented source references', () => {
  assert.deepEqual(parseSource('src/Button.tsx:42:8'), {
    file: 'src/Button.tsx',
    line: 42,
    column: 8,
  });
});

test('keeps file-only source references valid', () => {
  assert.deepEqual(parseSource('src/Button.tsx'), { file: 'src/Button.tsx' });
});
