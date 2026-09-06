import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DesignDecision } from './design-memory.js';
import {
  assessDesignDecision,
  decisionCategories,
  relevantDesignDecisions,
} from './design-decisions.js';

const decision: DesignDecision = {
  id: 'decision-1',
  title: 'Avoid pure black',
  summary: 'Use the project ink token instead.',
  outcome: 'rule',
  categories: ['color'],
  conditions: { components: ['PrimaryAction'], properties: ['color'] },
  rules: [{ property: 'color', operator: 'avoid', value: '#000000' }],
  evidence: [{ kind: 'manual', label: 'Project rule' }],
  sourceLocations: ['PrimaryAction.tsx'],
  enabled: true,
  createdAt: '2026-09-05T00:00:00.000Z',
  updatedAt: '2026-09-05T00:00:00.000Z',
};

describe('design decision memory', () => {
  it('surfaces matching project guidance and detects a conflicting proposal', () => {
    const assessed = assessDesignDecision(decision, {
      component: 'PrimaryAction',
      source: 'src/PrimaryAction.tsx:12',
      properties: ['color'],
      values: [{ property: 'color', value: '#000000' }],
    });
    assert.equal(assessed.score, 76);
    assert.equal(assessed.conflicts.length, 1);
    assert.deepEqual(assessed.reasons, [
      'Same component',
      'Affects the same properties',
      'Same source location',
    ]);
  });

  it('keeps disabled guidance out of relevant results', () => {
    assert.deepEqual(
      relevantDesignDecisions([{ ...decision, enabled: false }], {
        component: 'PrimaryAction',
        properties: ['color'],
      }),
      [],
    );
  });

  it('derives preference categories from affected properties', () => {
    assert.deepEqual(
      decisionCategories(['fontSize', 'borderRadius', 'transitionDuration', 'paddingLeft']),
      ['typography', 'radius', 'motion', 'density'],
    );
  });
});
