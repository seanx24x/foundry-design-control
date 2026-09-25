import assert from 'node:assert/strict';
import test from 'node:test';
import {
  designHealthScope,
  groupStressFindings,
  normalizeStressConditions,
  stressConditionSummary,
  toggleStressCondition,
  validateStressConditions,
} from './stress-testing.js';

test('clearing conditions preserves the explicitly requested scan scope', () => {
  assert.equal(designHealthScope([], 'selection'), 'selection');
  assert.equal(designHealthScope([], 'canvas'), 'canvas');
  assert.equal(designHealthScope(['keyboard-only'], 'selection'), 'selection');
  assert.equal(designHealthScope(['long-content'], 'canvas'), 'canvas');
});

test('normalizes known conditions, removes duplicates, and keeps one requested product state', () => {
  assert.deepEqual(
    normalizeStressConditions([
      'long-content',
      'loading-state',
      'long-content',
      'error-state',
      'unknown',
      'text-200',
    ]),
    ['long-content', 'error-state', 'text-200'],
  );
});

test('rejects unsupported and empty durable stress requests', () => {
  assert.throws(() => validateStressConditions(['unknown']), /Unsupported stress test: unknown/);
  assert.throws(() => validateStressConditions([]), /Select at least one supported stress test/);
  assert.deepEqual(validateStressConditions(['keyboard-only']), ['keyboard-only']);
});

test('toggles temporary conditions without losing compatible combinations', () => {
  assert.deepEqual(toggleStressCondition(['long-content'], 'text-200'), [
    'long-content',
    'text-200',
  ]);
  assert.deepEqual(toggleStressCondition(['long-content', 'text-200'], 'long-content'), [
    'text-200',
  ]);
});

test('summarizes empty, single, and combined stress selections', () => {
  assert.equal(stressConditionSummary([]), 'No temporary stress conditions');
  assert.equal(stressConditionSummary(['keyboard-only']), 'Keyboard only');
  assert.equal(stressConditionSummary(['keyboard-only', 'text-200']), '2 temporary conditions');
});

test('groups findings by severity and source with stable labels', () => {
  const findings = [
    { severity: 'low' as const, category: 'spacing', source: 'button.css:4' },
    { severity: 'high' as const, category: 'accessibility' },
    { severity: 'medium' as const, category: 'overflow', source: 'card.css:8' },
  ];
  assert.deepEqual(
    groupStressFindings(findings).map((group) => [group.id, group.findings.length]),
    [
      ['high', 1],
      ['medium', 1],
      ['low', 1],
    ],
  );
  assert.deepEqual(
    groupStressFindings(findings, 'source').map((group) => group.label),
    ['button.css:4', 'card.css:8', 'Source mapping unavailable'],
  );
});
