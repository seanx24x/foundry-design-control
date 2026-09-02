import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_WORKSPACE_STATE,
  clampUtilityRect,
  resolveInterfaceTheme,
  updateWorkspace,
} from './workspace.js';

test('resolves system appearance without overriding explicit interface themes', () => {
  assert.equal(resolveInterfaceTheme('system', true), 'dark');
  assert.equal(resolveInterfaceTheme('system', false), 'light');
  assert.equal(resolveInterfaceTheme('light', true), 'light');
  assert.equal(resolveInterfaceTheme('dark', false), 'dark');
});

test('keeps primary docks independent while enforcing one utility', () => {
  const withHealth = updateWorkspace(DEFAULT_WORKSPACE_STATE, {
    type: 'open-utility',
    utility: 'health',
  });
  const withMemory = updateWorkspace(withHealth, {
    type: 'open-utility',
    utility: 'memory',
  });
  assert.equal(withMemory.layersOpen, true);
  assert.equal(withMemory.inspectorOpen, true);
  assert.equal(withMemory.utility, 'memory');
});

test('keeps the change summary and review modal separate from inspector visibility', () => {
  const hiddenInspector = updateWorkspace(DEFAULT_WORKSPACE_STATE, {
    type: 'toggle-inspector',
    open: false,
  });
  const withSummary = updateWorkspace(hiddenInspector, {
    type: 'set-change-summary',
    visible: true,
  });
  const reviewing = updateWorkspace(withSummary, { type: 'set-review', open: true });
  assert.equal(reviewing.inspectorOpen, false);
  assert.equal(reviewing.changeSummaryVisible, true);
  assert.equal(reviewing.reviewOpen, true);
});

test('closing the last change also closes review', () => {
  const reviewing = updateWorkspace(
    updateWorkspace(DEFAULT_WORKSPACE_STATE, { type: 'set-change-summary', visible: true }),
    { type: 'set-review', open: true },
  );
  const empty = updateWorkspace(reviewing, { type: 'set-change-summary', visible: false });
  assert.equal(empty.changeSummaryVisible, false);
  assert.equal(empty.reviewOpen, false);
});

test('clamps remembered utility geometry into the available canvas', () => {
  assert.deepEqual(
    clampUtilityRect(
      { x: -400, y: 900, width: 900, height: 100 },
      { left: 276, top: 72, right: 1180, bottom: 760 },
    ),
    { x: 276, y: 480, width: 900, height: 280 },
  );
});
