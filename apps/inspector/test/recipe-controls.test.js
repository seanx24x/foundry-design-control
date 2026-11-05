import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recipeTargetKey,
  recipeCaptureModel,
  recipeApplyModel,
  recipeOutcomeMessage,
  recipeNewCapture,
} from '../public/recipe-controls.js';
const selection = { id: 'one', label: 'Primary action' },
  recipe = { id: 'recipe' };
const assessment = {
  matched: 2,
  total: 3,
  ambiguous: 1,
  mappings: [
    { status: 'mapped', currentValue: 12, resolvedValue: 16 },
    { status: 'ambiguous', currentValue: 4, resolvedValue: 8 },
    { status: 'unsupported', sourceValue: 'unknown' },
  ],
};
const model = (extra = {}) =>
  recipeApplyModel({ recipe, selection, assessment, connected: true, ...extra });
test('capture preserves native optional naming and browser-local persistence boundaries', () => {
  const entry = { id: 'new', name: 'New treatment' };
  assert.equal(recipeNewCapture(['old'], [entry, { id: 'old' }]), entry);
  assert.equal(recipeNewCapture(['old'], [{ id: 'old' }]), null);
  assert.equal(recipeNewCapture([], [{ id: 'one' }, { id: 'two' }]), null);
  const state = recipeCaptureModel({ selection, canSave: true, connected: true });
  assert.equal(state.disabled, false);
  assert.equal(state.fallbackName, 'Primary action treatment');
  assert.match(state.message, /browser’s project library/);
  assert.match(state.message, /not to Review or source/);
});
test('capture cannot act while pending offline unedited or multi-selected', () => {
  for (const extra of [
    { connected: false },
    { canSave: false },
    { pending: 'capture' },
    { selection: { ...selection, count: 2 } },
    { selection: null },
  ])
    assert.equal(
      recipeCaptureModel({ selection, canSave: true, connected: true, ...extra }).disabled,
      true,
    );
});
test('uncertain capture outcomes require a read-only library check instead of automatic saving', () => {
  const state = recipeCaptureModel({
    selection,
    canSave: false,
    connected: true,
    needsRecheck: true,
  });
  assert.equal(state.disabled, false);
  assert.equal(state.label, 'Recheck library');
  assert.match(state.message, /may still be in memory/);
});
test('mapping counts preserve unsupported and ambiguous distinctions and actual source scope', () => {
  const state = model({ scope: 'variant' });
  assert.equal(state.supported, 2);
  assert.equal(state.excluded, 1);
  assert.equal(state.ambiguous, 1);
  assert.match(state.message, /current variant source scope/);
  assert.match(state.message, /recorded separately/);
});
test('application rejects offline missing and multi-selection mappings and suppresses pending actions', () => {
  for (const extra of [
    { connected: false },
    { selection: null },
    { selection: { ...selection, count: 2 } },
    { recipe: null },
    { assessment: null },
    { assessment: { matched: 0, mappings: [] } },
    { pending: 'apply' },
  ])
    assert.equal(model(extra).disabled, true);
});
test('matching current values do not invent a saved or verified Review state', () => {
  const state = model({
    assessment: {
      matched: 1,
      ambiguous: 0,
      mappings: [{ status: 'mapped', currentValue: 0, resolvedValue: 0 }],
    },
  });
  assert.equal(state.label, 'Values match');
  assert.equal(state.disabled, true);
  assert.doesNotMatch(state.label, /Review|verified|saved/i);
});
test('partial failure requires explicit mapping recheck without claiming atomic rollback', () => {
  const state = model({ needsRecheck: true });
  assert.equal(state.label, 'Recheck mapping');
  assert.equal(state.disabled, false);
  assert.match(state.message, /Earlier values may already be in Review/);
  assert.match(state.message, /Nothing is retried automatically/);
  assert.notEqual(recipeTargetKey('r', 'one'), recipeTargetKey('r', 'two'));
});
test('results report actual recorded counts including zero and reject malformed acknowledgements', () => {
  assert.match(
    recipeOutcomeMessage({ applied: 1, attempted: 2 }),
    /1 change recorded from 2 supported properties/,
  );
  assert.match(recipeOutcomeMessage({ applied: 0, attempted: 2 }), /No new changes recorded/);
  for (const result of [
    null,
    {},
    { applied: -1, attempted: 1 },
    { applied: 3, attempted: 2 },
    { applied: 1.2, attempted: 2 },
  ])
    assert.equal(recipeOutcomeMessage(result), null);
});
