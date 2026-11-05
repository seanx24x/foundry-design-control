import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { stateMeasurementDimensions } from '../public/foundry-pilot-state.js';
import {
  sameStateCondition,
  stateEvidenceModel,
  stateConditionKey,
} from '../public/next-state-workbench.js';

const context = {
  viewport: { id: 'desktop', width: 1440, height: 900 },
  theme: 'light',
  state: 'loading',
  motionPreference: 'system',
  selectedTarget: { id: 'heading', selector: '#heading' },
};
const record = { context, result: { applied: true, axes: {} } };
const model = (extra = {}) => stateEvidenceModel({ connected: true, context, record, ...extra });

test('measurement receipts read actual adapter dimensions without inventing missing or invalid bounds', () => {
  assert.deepEqual(stateMeasurementDimensions({ width: 581.13, height: 148.94 }), {
    width: 581.13,
    height: 148.94,
  });
  assert.deepEqual(stateMeasurementDimensions({ bounds: { width: 360, height: 228 } }), {
    width: 360,
    height: 228,
  });
  for (const input of [
    null,
    {},
    { width: 0, height: NaN },
    { width: -1, height: 12 },
    { width: '581', height: 149 },
  ])
    assert.equal(stateMeasurementDimensions(input), null);
});

test('condition keys include measured dimensions and target selector rather than collapsing matching IDs', () => {
  assert.equal(stateConditionKey(context), stateConditionKey({ ...context, requestRevision: 999 }));
  for (const change of [
    { viewport: { ...context.viewport, width: 1280 } },
    { viewport: { ...context.viewport, height: 800 } },
    { selectedTarget: { ...context.selectedTarget, selector: '.different' } },
    { theme: 'dark' },
    { motionPreference: 'reduce' },
    { state: 'current' },
  ])
    assert.notEqual(stateConditionKey(context), stateConditionKey({ ...context, ...change }));
});
test('condition keys cannot collide when IDs contain delimiters', () => {
  assert.notEqual(
    stateConditionKey({ ...context, theme: 'light:loading', state: 'current' }),
    stateConditionKey({ ...context, theme: 'light', state: 'loading:current' }),
  );
});
test('failed evidence retains real per-axis diagnostics without a successful measurement receipt', () => {
  const failure = {
    context,
    applied: false,
    axes: {
      motion: {
        status: 'unsupported',
        method: 'system-media-query',
        failureReason: 'Cannot override system reduced motion',
      },
    },
  };
  const value = model({ lastResult: failure });
  assert.equal(value.status, 'failed');
  assert.equal(value.result, failure);
  assert.equal(value.record, undefined);
  const source = readFileSync(
    new URL('../public/next-state-workbench.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /model.status === 'failed' \? 'Context diagnostics' : 'Applied context'/);
  assert.match(source, /model.status === 'failed' \? 'Supported' : 'Applied'/);
});
test('replaced state preview generations cannot publish a late receipt or release the new operation', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const operation = source.slice(
    source.indexOf('async function applyStateWorkbenchContext()'),
    source.indexOf('function requestStateWorkbenchPreviewContext()'),
  );
  assert.match(operation, /generation === stateWorkbenchGeneration/);
  assert.match(operation, /frame === \$\('#state-live-preview'\)/);
  assert.equal((operation.match(/if \(!current\(\)\) return null/g) || []).length, 3);
  assert.match(operation, /finally \{\s*if \(current\(\)\)/);
  const destroy = source.slice(
    source.indexOf('function destroyStateWorkbenchPreview()'),
    source.indexOf('function canvasPreviewContext()'),
  );
  assert.match(destroy, /stateWorkbenchGeneration\+\+/);
  assert.match(destroy, /stateWorkbenchResults.clear\(\)/);
  assert.match(operation, /stateWorkbenchReloading = true/);
  assert.match(source, /if \(stateWorkbenchReloading\) return/);
});
test('state controls preserve native inputs and visibly separate inspection from Review', () => {
  const source = readFileSync(new URL('../public/foundry-pilot-state.js', import.meta.url), 'utf8');
  assert.match(source, /Inspection only\. No Review changes/);
  assert.match(source, /model.status === 'inspected'/);
  assert.match(source, /model.record\?\.measuredAt/);
  const css = readFileSync(new URL('../public/foundry-pilot-state.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns: 64px minmax\(0, 1fr\)/);
});

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
  assert.equal(model({ record: { context, result: { applied: false } } }).status, 'failed');
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
