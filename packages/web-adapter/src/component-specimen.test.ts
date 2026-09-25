import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const start = source.indexOf("if (command === 'render-component-specimen')");
const end = source.indexOf("if (command === 'inspector-variant')", start);
const command = source.slice(start, end).replace(/\/\/[^\n]*/g, '');

test('specimens are isolated read-only endpoints, never Canvas editors or verification owners', () => {
  assert.ok(start > 0 && end > start);
  assert.match(
    source,
    /componentSpecimen && !\['preview-ping', 'render-component-specimen'\].includes\(command\)/,
  );
  assert.match(command, /!componentSpecimen \|\| !embeddedWorkspace/);
  assert.doesNotMatch(command, /\b(?:record|select|previewWorkshopVariant)\(/);
  assert.match(source, /persistedSelector && !componentSpecimen/);
  assert.match(source, /!verificationChild && !componentSpecimen\) startSessionPolling/);
});

test('rendering uses supported authored hooks, font readiness and actual geometry', () => {
  assert.match(command, /nextVariantSnapshot\(target\)/);
  assert.match(command, /inspectorVariantAttributes\(variant\)/);
  assert.match(command, /applyPreviewContext/);
  assert.match(command, /!context.applied/);
  assert.match(command, /!stability.fontsReady \|\| !stability.stable/);
  assert.match(command, /getBoundingClientRect/);
  assert.match(command, /window.scrollTo/);
  assert.doesNotMatch(command, /scrollIntoView|cloneNode|innerHTML\s*=/);
});
