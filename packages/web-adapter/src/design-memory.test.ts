import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addRecipe,
  addDesignDecision,
  addVerifiedBaseline,
  baselineForContext,
  emptyDesignMemory,
  projectMemoryKey,
  readDesignMemory,
  removeDesignDecision,
  removeRecipe,
  updateDesignDecision,
  writeDesignMemory,
} from './design-memory.js';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('project design memory', () => {
  it('round trips project-scoped recipes', () => {
    const store = storage();
    const recipe = {
      id: 'recipe-1',
      name: 'Quiet card',
      sourceLabel: 'Billing card',
      values: [{ property: 'borderRadius', value: 12, unit: 'px', category: 'effects' }],
      createdAt: '2026-08-30T00:00:00.000Z',
    };
    const memory = addRecipe(emptyDesignMemory(), recipe);
    writeDesignMemory(store, '/project', memory);
    assert.deepEqual(readDesignMemory(store, '/project').recipes, [recipe]);
    assert.deepEqual(readDesignMemory(store, '/another').recipes, []);
    assert.match(projectMemoryKey('/project'), /\/project/);
    assert.deepEqual(removeRecipe(memory, recipe.id).recipes, []);
  });

  it('keeps only the latest verified baseline for one rendered context', () => {
    const first = {
      id: 'baseline-1',
      runId: 'run-1',
      targetId: 'button',
      targetLabel: 'Upgrade button',
      breakpoint: 'desktop',
      theme: 'light',
      state: 'current',
      values: [{ property: 'borderRadius', requested: 12, rendered: 12, passed: true }],
      verifiedAt: '2026-08-30T00:00:00.000Z',
    };
    const second = {
      ...first,
      id: 'baseline-2',
      runId: 'run-2',
      verifiedAt: '2026-08-30T01:00:00.000Z',
    };
    const memory = addVerifiedBaseline(addVerifiedBaseline(emptyDesignMemory(), first), second);
    assert.equal(memory.baselines.length, 1);
    assert.equal(
      baselineForContext(memory, 'button', 'desktop', 'light', 'current')?.runId,
      'run-2',
    );
  });

  it('recovers from malformed storage', () => {
    const store = storage();
    store.setItem(projectMemoryKey('/project'), '{broken');
    assert.deepEqual(readDesignMemory(store, '/project'), emptyDesignMemory());
  });

  it('migrates older project memory and manages explicit decisions', () => {
    const store = storage();
    store.setItem(
      projectMemoryKey('/project'),
      JSON.stringify({ version: 2, recipes: [], baselines: [] }),
    );
    const migrated = readDesignMemory(store, '/project');
    assert.equal(migrated.version, 3);
    assert.deepEqual(migrated.decisions, []);
    const decision = {
      id: 'decision-1',
      title: 'Restrained motion',
      summary: 'Keep product transitions quiet.',
      outcome: 'rule' as const,
      categories: ['motion'],
      conditions: {},
      rules: [
        { category: 'motion', operator: 'require' as const, guidance: 'Use restrained motion.' },
      ],
      evidence: [{ kind: 'manual' as const, label: 'Project rule' }],
      sourceLocations: [],
      enabled: true,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    };
    const added = addDesignDecision(migrated, decision);
    assert.equal(added.decisions.length, 1);
    assert.equal(
      updateDesignDecision(added, decision.id, { enabled: false }, '2026-09-05T01:00:00.000Z')
        .decisions[0]?.enabled,
      false,
    );
    assert.deepEqual(removeDesignDecision(added, decision.id).decisions, []);
  });
});
