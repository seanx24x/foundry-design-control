import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_WORKSPACE_STATE, clampUtilityRect, updateWorkspace } from './workspace.js';

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

test('keeps review tray state separate from inspector visibility', () => {
  const hiddenInspector = updateWorkspace(DEFAULT_WORKSPACE_STATE, {
    type: 'toggle-inspector',
    open: false,
  });
  const reviewing = updateWorkspace(hiddenInspector, { type: 'set-tray', tray: 'expanded' });
  assert.equal(reviewing.inspectorOpen, false);
  assert.equal(reviewing.tray, 'expanded');
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
