import test from 'node:test';
import assert from 'node:assert/strict';
import {
  systemValueRows,
  systemScopeRows,
  systemPromotionState,
  systemPromotionWarning,
  systemPromotionValueRows,
} from '../public/design-system-controls.js';
import { promotionImpactText } from '../public/foundry-pilot-system.js';

test('authored, indexed resolution and actual Canvas values retain distinct provenance', () => {
  const token = Object.freeze({ value: 'var(--ink)', resolvedValue: '#111' });
  assert.deepEqual(systemValueRows(token, 'rgb(240, 240, 240)', true), [
    { id: 'authored', label: 'Authored', value: 'var(--ink)' },
    { id: 'resolved', label: 'Resolved · index', value: '#111' },
    { id: 'canvas', label: 'Canvas', value: 'rgb(240, 240, 240)' },
  ]);
});
test('offline and empty live values are not presented as Canvas evidence', () => {
  for (const value of [undefined, null, '', ' '])
    assert.equal(systemValueRows({ value: '0' }, value, true).length, 1);
  assert.equal(systemValueRows({ value: '0' }, '99px', false).length, 1);
  assert.equal(systemValueRows({ value: 0, resolvedValue: 0 }, 0, true).length, 3);
});
test('unresolved and relative source values remain exact text without fabricated resolution', () => {
  for (const value of ['var(--missing)', '1.125rem', 'clamp(1rem, 2vw, 2rem)', '"wght" 512.5'])
    assert.deepEqual(systemValueRows({ value }), [{ id: 'authored', label: 'Authored', value }]);
});
test('scope counts declarations, distinct files and mapped components without claiming live coverage', () => {
  assert.deepEqual(
    systemScopeRows(
      {
        declarations: [
          { source: { file: 'a.css' } },
          { source: { file: 'a.css' } },
          { source: { file: 'b.css' } },
        ],
      },
      null,
      [{ componentId: 'Button' }, { componentId: 'Button' }],
    ),
    [
      { label: 'Declarations', value: '3' },
      { label: 'Source files', value: '2' },
      { label: 'Mapped components', value: '1' },
    ],
  );
  assert.deepEqual(
    systemScopeRows(null, { sources: [{ file: 'a.css' }], componentIds: ['Button', 'Card'] }),
    [
      { label: 'Authored locations', value: '1' },
      { label: 'Source files', value: '1' },
      { label: 'Mapped components', value: '2' },
    ],
  );
});
const plan = { id: 'p1', canStage: true, sources: [{ file: 'a.css' }] };
test('pending, disconnected and unmapped promotion plans cannot stage', () => {
  assert.equal(systemPromotionState(plan, [], { connected: true }).disabled, false);
  assert.equal(
    systemPromotionState(plan, [], { connected: true, pending: true }).label,
    'Adding to Review…',
  );
  assert.equal(systemPromotionState(plan, [], { connected: false }).disabled, true);
  assert.equal(
    systemPromotionState({ ...plan, sources: [] }, [], { connected: true }).disabled,
    true,
  );
  assert.match(
    systemPromotionState({ ...plan, canStage: false, blockers: ['Missing mapping'] }, [], {
      connected: true,
    }).message,
    /Missing mapping/,
  );
});
test('only active reviewed plans for the exact candidate count as staged', () => {
  const change = {
    id: 'c1',
    target: { id: 'token-source:p1' },
    property: 'designToken.create',
    status: 'draft',
  };
  assert.equal(systemPromotionState(plan, [change], { connected: true }).label, 'In Review');
  for (const status of ['rejected', 'applied'])
    assert.equal(
      systemPromotionState(plan, [{ ...change, status }], { connected: true }).staged,
      false,
    );
  assert.equal(
    systemPromotionState(plan, [{ ...change, target: { id: 'token-source:p2' } }], {
      connected: true,
    }).staged,
    false,
  );
  assert.equal(
    systemPromotionState(plan, [{ ...change, property: 'color' }], { connected: true }).staged,
    false,
  );
});
test('a real receipt bridges the saved-ledger refresh without allowing duplicate submission', () => {
  assert.equal(
    systemPromotionState(plan, [], { connected: true, acknowledged: true }).label,
    'In Review',
  );
  assert.equal(
    systemPromotionState(plan, [], { connected: true, acknowledged: true }).disabled,
    true,
  );
});
test('nearest matches explicitly warn of changed appearance, unlike exact or new plans', () => {
  assert.deepEqual(
    systemPromotionValueRows({
      recommendation: 'create-token',
      suggestedTokenName: '--new',
      value: '12px',
    })[1],
    { label: 'Proposed value', value: '12px' },
  );
  assert.deepEqual(
    systemPromotionValueRows({ recommendation: 'use-existing', suggestedTokenId: 'a' }, [
      { id: 'a', value: 'var(--base)', resolvedValue: '16px' },
    ])[1],
    { label: 'Target · index', value: '16px' },
  );
  assert.equal(
    systemPromotionValueRows({ recommendation: 'use-existing' })[1].value,
    'Not resolved in index',
  );
  assert.match(systemPromotionWarning({ relation: 'near' }), /not an exact value/);
  assert.match(
    promotionImpactText({ relation: 'near', sources: [], occurrenceCount: 2 }),
    /may change appearance/,
  );
  assert.doesNotMatch(
    promotionImpactText({ relation: 'near', sources: [], occurrenceCount: 2 }),
    /preserve/,
  );
  for (const relation of ['exact', 'new']) assert.equal(systemPromotionWarning({ relation }), '');
});
