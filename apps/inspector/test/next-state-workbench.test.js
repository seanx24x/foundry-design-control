import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { sameStateCondition, stateEvidenceModel } from '../public/next-state-workbench.js';

const context = {
  viewport: { id: 'desktop', width: 1440, height: 900 },
  theme: 'light',
  state: 'loading',
  motionPreference: 'system',
  selectedTarget: { id: 'heading', selector: '#heading' },
};
const record = { context, result: { applied: true, axes: {} } };
const model = (extra = {}) => stateEvidenceModel({ connected: true, context, record, ...extra });

test('state evidence requires exact viewport, theme, state, motion and target', () => {
  assert.equal(
    sameStateCondition({ ...context, requestRevision: 2 }, { ...context, requestRevision: 3 }),
    true,
  );
  for (const change of [
    { theme: 'dark' },
    { state: 'current' },
    { motionPreference: 'reduce' },
    { viewport: { ...context.viewport, width: 1280 } },
    { selectedTarget: { ...context.selectedTarget, selector: '.other' } },
  ]) {
    assert.equal(sameStateCondition(context, { ...context, ...change }), false);
    assert.equal(model({ context: { ...context, ...change } }).status, 'untested');
  }
});
test('connected is not equivalent to inspected', () => {
  assert.equal(model({ record: null }).status, 'untested');
  assert.equal(model().status, 'inspected');
  assert.equal(model({ record: { context, result: { applied: false } } }).status, 'untested');
});
test('pending and offline cannot present earlier measurements as current success', () => {
  assert.equal(model({ pending: true }).status, 'pending');
  assert.equal(model({ connected: false }).status, 'offline');
  assert.equal(model({ connected: false }).result, undefined);
});
test('a failure for this combination takes precedence over its previous successful result', () => {
  const lastResult = {
    context,
    applied: false,
    failureReason: 'Authored motion rules unavailable',
    axes: {},
  };
  assert.equal(model({ lastResult }).status, 'failed');
  assert.match(model({ lastResult }).note, /Authored motion rules unavailable/);
  assert.equal(
    model({ lastResult: { ...lastResult, context: { ...context, theme: 'dark' } } }).status,
    'inspected',
  );
});
test('evidence is explicit about the boundary between inspection and audit', () => {
  assert.match(model().note, /not a full accessibility or visual audit/);
});
test('presentation hydrates authored choices without rebuilding the live frame', () => {
  const source = readFileSync(
    new URL('../public/next-state-workbench.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /choices !== choicesSignature/);
  assert.match(source, /selectState\(state.id\)/);
  assert.match(source, /syncControls\(\)/);
  assert.match(source, /conditions.append\(\.\.\.left.querySelectorAll/);
  assert.doesNotMatch(source, /innerHTML|\.src\s*=|requestFrameCommand\(|requestCommand\(|fetch\(/);
});
test('state layout shares 300px rails, compact controls and independently scrolling evidence', () => {
  const css = readFileSync(new URL('../public/next-state-workbench.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns: 300px minmax\(0, 1fr\) 300px/);
  assert.match(css, /grid-template-rows: 44px minmax\(0, 1fr\) 44px/);
  assert.match(css, /\.foundry-select-trigger \{[^}]*height: 32px/);
  assert.match(css, /\.next-state-evidence-scroll \{[^}]*overflow: auto/);
});
test('original context engine retains matching snapshot and failure-context checks', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(
    source,
    /previewContextsMatch\(measurement\?\.currentPreviewContext, result.context\)/,
  );
  assert.match(source, /stateWorkbenchLastResult = \{\s*applied: false,\s*context,/);
  assert.match(source, /nextStateWorkbench\.mount\(\)/);
});
