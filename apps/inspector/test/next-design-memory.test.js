import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  memoryCaptureAvailability,
  memoryScopeRows,
  sameMemoryDraft,
} from '../public/next-design-memory.js';
const valid = {
  connected: true,
  canCapture: true,
  busy: false,
  title: 'Decision',
  summary: 'Guidance',
};
test('capture needs a live preview, selected layer and nonblank guidance', () => {
  assert.equal(memoryCaptureAvailability(valid).disabled, false);
  for (const patch of [
    { connected: false },
    { canCapture: false },
    { title: '  ' },
    { summary: '\n' },
  ])
    assert.equal(memoryCaptureAvailability({ ...valid, ...patch }).disabled, true);
});
test('pending capture prevents duplicate submission and describes pending rather than success', () => {
  assert.deepEqual(memoryCaptureAvailability({ ...valid, busy: true }), {
    disabled: true,
    message: 'Saving decision…',
  });
});
test('offline and missing selection explain recovery without clearing the draft', () => {
  assert.match(
    memoryCaptureAvailability({ ...valid, connected: false }).message,
    /draft stays here/,
  );
  assert.match(
    memoryCaptureAvailability({ ...valid, canCapture: false }).message,
    /Select a layer/,
  );
  assert.equal(valid.title, 'Decision');
});
test('saved context groups every axis and does not truncate long condition lists', () => {
  const values = Array.from({ length: 12 }, (_, i) => `component-${i}`);
  assert.deepEqual(
    memoryScopeRows({
      categories: ['layout'],
      conditions: { components: values, properties: ['gap'], themes: ['dark'], states: ['hover'] },
    }),
    [
      ['Categories', ['layout']],
      ['Components', values],
      ['Properties', ['gap']],
      ['Themes', ['dark']],
      ['States', ['hover']],
    ],
  );
  assert.deepEqual(memoryScopeRows({}), []);
});
test('correction identity respects whitespace and optional rationale', () => {
  assert.equal(sameMemoryDraft({ summary: 'a' }, { summary: 'a', rationale: '' }), true);
  assert.equal(sameMemoryDraft({ summary: 'a ' }, { summary: 'a' }), false);
  assert.equal(sameMemoryDraft({ summary: 'a', rationale: 'new' }, { summary: 'a' }), false);
});
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const helper = readFileSync(new URL('../public/next-design-memory.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/next-design-memory.css', import.meta.url), 'utf8');
test('studio integration remains opt-in and uses acknowledged persistence', () => {
  assert.match(app, /params.get\('ui'\) === 'next'\)\s+nextDesignMemory/);
  assert.match(app, /const result = await runDurableAction\(\s+'save-design-decision'/);
  assert.match(app, /field.value.trim\(\) === submitted/);
  assert.doesNotMatch(helper, /fetch\(|postMessage\(/);
});
test('dirty correction, disclosure and caret are retained across updates', () => {
  assert.match(helper, /drafts.set\(activeId, draft\)/);
  assert.match(helper, /expanded.get\(activeId\)/);
  assert.match(helper, /setSelectionRange\(focus.start, focus.end\)/);
  assert.match(helper, /aria-pressed/);
});
test('preview connection transitions update memory availability immediately', () => {
  assert.match(
    app,
    /connectionChanged && nextDesignMemory && activeMode === 'memory'\) renderMemory\(\)/,
  );
});
test('shared rail dimensions, independent scrolling and explicit footer override', () => {
  assert.match(css, /300px minmax\(0, 1fr\) 300px/);
  assert.match(css, /grid-template-rows: 44px minmax\(0, 1fr\) auto/);
  assert.match(css, /display: flex !important/);
  assert.match(css, /overflow-wrap: anywhere/);
});
