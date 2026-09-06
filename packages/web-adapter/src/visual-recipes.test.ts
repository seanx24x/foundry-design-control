import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessRecipe, recipeCategories, resolveRecipeValue } from './visual-recipes.js';

const recipe = {
  id: 'quiet-card',
  name: 'Quiet elevated card',
  sourceLabel: 'Summary card',
  intent: 'Separate supporting content without adding visual noise.',
  component: 'Card',
  categories: ['layout', 'effects'],
  conditions: {
    components: ['Card'],
    elementKinds: ['article'],
    requiredProperties: ['paddingTop', 'borderRadius', 'boxShadow'],
  },
  values: [
    { property: 'paddingTop', value: 15, unit: 'px', category: 'layout' },
    { property: 'borderRadius', value: 11, unit: 'px', category: 'effects' },
    { property: 'boxShadow', value: '0 8px 24px rgb(0 0 0 / 12%)', category: 'effects' },
  ],
  createdAt: '2026-09-05T00:00:00.000Z',
};

const tokens = [
  { id: 'space-4', name: 'space.4', value: '16px', category: 'spacing' },
  { id: 'radius-card', name: 'radius.card', value: '12px', category: 'radius' },
];

describe('visual recipes', () => {
  it('maps compatible properties through destination tokens and reports exact targets', () => {
    const assessment = assessRecipe(
      recipe,
      [
        { property: 'paddingTop', value: 8, unit: 'px', category: 'layout' },
        { property: 'borderRadius', value: 4, unit: 'px', category: 'effects' },
        { property: 'boxShadow', value: 'none', category: 'effects' },
      ],
      tokens,
      { component: 'Card', kind: 'article' },
    );
    assert.equal(assessment.compatibility, 'exact');
    assert.equal(assessment.score, 100);
    assert.equal(assessment.mappings[0]?.token?.name, 'space.4');
    assert.equal(assessment.mappings[0]?.resolvedValue, '16px');
    assert.equal(assessment.mappings[1]?.token?.name, 'radius.card');
  });

  it('never hides unsupported properties on a partial target', () => {
    const assessment = assessRecipe(
      recipe,
      [{ property: 'paddingTop', value: 8, category: 'layout' }],
      tokens,
      { kind: 'div' },
    );
    assert.equal(assessment.compatibility, 'partial');
    assert.equal(assessment.matched, 1);
    assert.equal(
      assessment.mappings.filter((mapping) => mapping.status === 'unsupported').length,
      2,
    );
  });

  it('flags tied destination token choices for review', () => {
    const resolved = resolveRecipeValue({ property: 'gap', value: 16, category: 'layout' }, [
      { id: 'a', name: 'space.component', value: '16px', category: 'spacing' },
      { id: 'b', name: 'space.layout', value: '16px', category: 'spacing' },
    ]);
    assert.equal(resolved.status, 'ambiguous');
    assert.match(resolved.detail, /requires review/);
  });

  it('derives the portable treatment categories', () => {
    assert.deepEqual(recipeCategories(recipe.values), ['layout', 'effects']);
  });
});
