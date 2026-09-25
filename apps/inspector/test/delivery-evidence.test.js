import assert from 'node:assert/strict';
import test from 'node:test';
import { deliveryEvidenceGroups } from '../public/delivery-evidence-ui.js';

test('screenshot pairs require the exact source, context and capture environment', () => {
  const before = {
    label: 'Before',
    capture: {
      phase: 'before',
      sourceRevision: 'a',
      targetId: 'button',
      context: { breakpoint: 'desktop', theme: 'light', state: 'current' },
      viewport: { width: 1440, height: 900 },
      conditions: {
        motion: 'reduce',
        browser: 'chromium',
        platform: 'darwin',
        deviceScaleFactor: 1,
      },
    },
  };
  const after = {
    label: 'After',
    capture: {
      ...structuredClone(before.capture),
      phase: 'rebuilt',
      sourceRevision: 'b',
      applyRunId: 'run',
    },
  };
  const record = {
    applyRunId: 'run',
    baselineRevision: 'a',
    appliedRevision: 'b',
    evidence: [before, after, { label: 'Legacy' }],
  };
  assert.deepEqual(deliveryEvidenceGroups(record), [{ matched: true, indexes: [0, 1] }]);
  const different = structuredClone(record);
  different.evidence[1].capture.context.theme = 'dark';
  assert.deepEqual(deliveryEvidenceGroups(different), [
    { matched: false, indexes: [0] },
    { matched: false, indexes: [1] },
  ]);
  different.evidence[1].capture.context.theme = 'light';
  different.evidence[1].capture.conditions.browser = 'different-browser';
  assert.equal(
    deliveryEvidenceGroups(different).some((group) => group.matched),
    false,
  );
});
