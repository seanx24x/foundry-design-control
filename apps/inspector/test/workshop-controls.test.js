import test from 'node:test';
import assert from 'node:assert/strict';
import {
  workshopAuthoringModel,
  workshopCreatedChange,
  workshopCreateKey,
} from '../public/workshop-controls.js';
const component = {
  key: 'Button',
  elements: [{ id: 'target' }],
  variantAxes: [
    { id: 'tone', label: 'Tone', property: 'tone', canCreate: true, values: ['Primary', 'Quiet'] },
  ],
  variants: [{ id: 'quiet' }],
};
const draft = { axisId: 'tone', label: ' Emphasis ', value: ' emphasis ', baseVariantId: 'quiet' };
const options = { connected: true };
test('new variant drafts validate trimmed values without normalizing or mutating the draft', () => {
  const frozen = Object.freeze({ ...draft });
  assert.equal(workshopAuthoringModel(component, frozen, [], options).disabled, false);
  assert.equal(frozen.value, ' emphasis ');
  assert.equal(frozen.label, ' Emphasis ');
});
test('blank names and source values remain incomplete instead of creating source operations', () => {
  assert.equal(
    workshopAuthoringModel(component, { ...draft, label: ' ' }, [], options).errors.label,
    'Add a variant name.',
  );
  assert.equal(
    workshopAuthoringModel(component, { ...draft, value: '' }, [], options).errors.value,
    'Add a source value.',
  );
});
test('existing axis values are compared case-insensitively like the native adapter', () => {
  assert.match(
    workshopAuthoringModel(component, { ...draft, value: ' quiet ' }, [], options).errors.value,
    /already exists/,
  );
});
test('read-only missing or disconnected authoring never enables a source action', () => {
  assert.equal(
    workshopAuthoringModel(component, { ...draft, axisId: 'missing' }, [], options).disabled,
    true,
  );
  assert.equal(
    workshopAuthoringModel({ ...component, elements: [] }, draft, [], options).disabled,
    true,
  );
  assert.equal(workshopAuthoringModel(component, draft, [], { connected: false }).disabled, true);
  assert.equal(
    workshopAuthoringModel(
      { ...component, variantAxes: [{ ...component.variantAxes[0], canCreate: false }] },
      draft,
      [],
      options,
    ).disabled,
    true,
  );
});
test('base references must be indexed; they do not claim to clone gallery styling', () => {
  assert.ok(
    workshopAuthoringModel(component, { ...draft, baseVariantId: 'gone' }, [], options).errors
      .baseVariantId,
  );
  assert.equal(
    workshopAuthoringModel(component, { ...draft, baseVariantId: '' }, [], options).disabled,
    false,
  );
});
test('pending or acknowledged options cannot submit twice during the ledger refresh', () => {
  assert.equal(
    workshopAuthoringModel(component, draft, [], { ...options, pending: true }).label,
    'Adding variant…',
  );
  const state = workshopAuthoringModel(component, draft, [], { ...options, acknowledged: true });
  assert.equal(state.disabled, true);
  assert.equal(state.label, 'In Review');
  assert.match(state.message, /not an authored gallery variant/);
});
test('review matching stays on this component property and value; closed edits release the gate', () => {
  const change = {
    target: { id: 'target' },
    property: 'component.variant.create.tone',
    after: 'emphasis',
    status: 'draft',
  };
  assert.equal(workshopCreatedChange(component, draft, [change]), change);
  for (const patch of [
    { target: { id: 'other' } },
    { property: 'component.variant.create.size' },
    { after: 'different' },
    { status: 'rejected' },
    { status: 'applied' },
  ])
    assert.equal(workshopCreatedChange(component, draft, [{ ...change, ...patch }]), undefined);
  assert.equal(
    workshopCreatedChange(component, draft, [{ ...change, status: 'rejected' }], true)?.status,
    'rejected',
  );
});
test('acknowledgement keys are direction component axis and value scoped', () => {
  const key = workshopCreateKey(component, draft, 'main');
  assert.equal(workshopCreateKey(component, { ...draft, value: 'EMPHASIS' }, 'main'), key);
  assert.notEqual(workshopCreateKey(component, draft, 'other'), key);
  assert.notEqual(workshopCreateKey({ ...component, key: 'Card' }, draft, 'main'), key);
  assert.notEqual(workshopCreateKey(component, { ...draft, axisId: 'size' }, 'main'), key);
});
