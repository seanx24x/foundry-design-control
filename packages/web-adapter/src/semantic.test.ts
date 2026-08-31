import assert from 'node:assert/strict';
import test from 'node:test';
import { matchingTokens, semanticCandidates } from './semantic.js';

test('requires a semantic choice when resizing on the flex axis', () => {
  const candidates = semanticCandidates({
    targetId: 'button',
    property: 'width',
    value: 144,
    scope: 'component',
    source: { file: 'src/Button.tsx', line: 12 },
    parentDisplay: 'flex',
    parentFlexDirection: 'row',
    position: 'static',
    componentInstances: 4,
  });
  assert.deepEqual(
    candidates.map((item) => item.property),
    ['flexBasis', 'width'],
  );
  assert.equal(candidates[0]?.blastRadius, 4);
});

test('uses one exact spacing mapping for a gap gesture', () => {
  const candidates = semanticCandidates({
    targetId: 'toolbar',
    property: 'gap',
    value: 12,
    scope: 'instance',
    parentDisplay: 'block',
    parentFlexDirection: 'row',
    position: 'static',
    componentInstances: 1,
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.intent, 'spacing');
});

test('suggests only exact project-native tokens in the relevant category', () => {
  const matches = matchingTokens(
    [
      { id: 'space', name: '--space-3', value: '12px', category: 'spacing' },
      { id: 'size', name: '--size-3', value: '12px', category: 'size' },
    ],
    'gap',
    '12px',
  );
  assert.deepEqual(
    matches.map((item) => item.name),
    ['--space-3'],
  );
});
