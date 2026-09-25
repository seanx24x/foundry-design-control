import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { sourceLineAnchor } from './source-anchor.js';

const anchor = (source: string, path = 'index.html') =>
  sourceLineAnchor(path, source.split(/\r?\n/), 1);

test('anchors a mapped multiline HTML opening tag including its style attribute', () => {
  const before = '<button\n  class="submit-button"\n  style="width:448px"\n>Save</button>';
  const after = before.replace('width:448px', 'width:100%;max-width:448px');
  assert.equal(anchor(before).endLine, 4);
  assert.notEqual(anchor(before).sha256, anchor(after).sha256);
  assert.equal(anchor(before).line, 1);
});

test('does not count changes to child content, siblings or unrelated source as tag proof', () => {
  const before = '<button\n style="width:448px"\n><span>Save</span></button><button>Other</button>';
  for (const after of [
    before.replace('Save', 'Apply'),
    before.replace('Other', 'Elsewhere'),
    `${before}\n<footer>New</footer>`,
  ]) {
    assert.equal(anchor(before).sha256, anchor(after).sha256);
  }
});

test('quoted angle brackets and CRLF do not truncate the opening tag', () => {
  const before = '<button\r\n title="a > b"\r\n style=\'width:448px\'\r\n>Save</button>';
  assert.equal(anchor(before).endLine, 4);
  assert.notEqual(anchor(before).sha256, anchor(before.replace('448px', '100%')).sha256);
});

test('preserves single-line fallback for non-HTML, malformed and oversized tags', () => {
  const expected = createHash('sha256').update('<button').digest('hex');
  for (const [source, path] of [
    ['<button\n style="width:448px">', 'Button.tsx'],
    ['<button\n style="unterminated>', 'index.html'],
    ['<button\n <span>Not an attribute</span>', 'index.html'],
    ['<button\n {...props}>', 'index.html'],
    [`<button\n${' '.repeat(17_000)}>`, 'index.html'],
    [`<button\n${'\n'.repeat(70)}>`, 'index.html'],
  ]) {
    assert.equal(anchor(source!, path!).endLine, 1);
    assert.equal(anchor(source!, path!).sha256, expected);
  }
});
