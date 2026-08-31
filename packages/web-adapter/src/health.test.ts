import test from 'node:test';
import assert from 'node:assert/strict';
import { auditHealthSnapshot, healthScore, textContrastThreshold } from './health.js';

const baseline = {
  hasVisibleText: false,
  color: '#111',
  backgroundColor: '#fff',
  fontSize: 16,
  fontWeight: 400,
  interactive: false,
  targetSizeEligible: false,
  accessibleName: '',
  width: 200,
  height: 80,
  left: 0,
  right: 200,
  top: 0,
  bottom: 80,
  viewportWidth: 1280,
  viewportHeight: 800,
  scrollWidth: 200,
  scrollHeight: 80,
  clientWidth: 200,
  clientHeight: 80,
  overflowX: 'visible',
  overflowY: 'visible',
  motionDuration: 0,
  reducedMotionProtected: true,
  layoutMode: 'block',
  gap: 0,
  spacingTokens: [],
};

test('uses WCAG thresholds for body and large text', () => {
  assert.equal(textContrastThreshold(16, 400), 4.5);
  assert.equal(textContrastThreshold(24, 400), 3);
  assert.equal(textContrastThreshold(19, 700), 3);
});

test('finds contrast, target size, naming, motion, and spacing issues', () => {
  const findings = auditHealthSnapshot({
    ...baseline,
    hasVisibleText: true,
    color: '#777',
    interactive: true,
    targetSizeEligible: true,
    width: 30,
    height: 20,
    motionDuration: 500,
    reducedMotionProtected: false,
    layoutMode: 'flex',
    gap: 18,
    spacingTokens: [{ name: 'space-4', value: '16px' }],
    contrastFix: { value: '#111', token: 'ink-strong' },
  });
  assert.deepEqual(
    findings.map((finding) => finding.ruleId),
    ['text-contrast', 'target-size', 'accessible-name', 'reduced-motion', 'spacing-token'],
  );
  assert.equal(findings[0]?.fix?.token, 'ink-strong');
  assert.equal(findings.at(-1)?.fix?.changes[0]?.value, 16);
});

test('finds viewport and content overflow', () => {
  const viewport = auditHealthSnapshot({ ...baseline, width: 1400, right: 1400 });
  assert.equal(viewport[0]?.ruleId, 'viewport-overflow');
  assert.equal(viewport[0]?.fix?.changes[0]?.property, 'maxWidth');
  const clipped = auditHealthSnapshot({ ...baseline, scrollWidth: 260, overflowX: 'hidden' });
  assert.equal(clipped[0]?.ruleId, 'content-overflow');
  assert.equal(auditHealthSnapshot({ ...baseline, scrollHeight: 100 }).length, 0);
});

test('scores health by severity without going below zero', () => {
  assert.equal(healthScore([]), 100);
  assert.equal(healthScore([{ severity: 'high' }, { severity: 'medium' }]), 73);
  assert.equal(healthScore(Array.from({ length: 10 }, () => ({ severity: 'high' as const }))), 0);
});
