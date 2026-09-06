import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

test('visual agent context contains every selected target and rendered measurement', () => {
  assert.match(source, /targets: selectedElements\.map/);
  assert.match(source, /geometry: \{/);
  assert.match(source, /fontFamily: style\.fontFamily/);
  assert.match(source, /borderRadius: style\.borderRadius/);
  assert.match(source, /source: element\.dataset\.foundrySource/);
});

test('canvas region capture is temporary, cancellable, and workspace-visible', () => {
  assert.match(source, /function captureVisualAgentRegion/);
  assert.match(source, /dataset\.foundryAgentRegion/);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.match(source, /capture-agent-region/);
  assert.match(source, /clear-agent-region/);
  assert.match(source, /visualAgentRegion/);
});
