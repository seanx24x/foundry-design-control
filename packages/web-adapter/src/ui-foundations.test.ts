import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  FOUNDRY_UI_CONTROL_SIZES,
  FOUNDRY_UI_GRID,
  FOUNDRY_UI_ICON_SIZES,
  FOUNDRY_UI_RADII,
  FOUNDRY_UI_TYPE_SIZES,
  nearestFoundryGridValue,
} from './ui-foundations.js';

test('Foundry UI foundations use the 4px grid', () => {
  for (const value of [
    ...FOUNDRY_UI_ICON_SIZES,
    ...FOUNDRY_UI_CONTROL_SIZES,
    ...FOUNDRY_UI_RADII,
    ...FOUNDRY_UI_TYPE_SIZES,
  ]) {
    assert.equal(value % FOUNDRY_UI_GRID, 0, String(value));
  }
});

test('grid rounding uses the nearest multiple with ties away from zero', () => {
  assert.equal(nearestFoundryGridValue(5), 4);
  assert.equal(nearestFoundryGridValue(6), 8);
  assert.equal(nearestFoundryGridValue(10), 12);
  assert.equal(nearestFoundryGridValue(-6), -8);
});

test('the Foundry interface contains no off-grid pixel literals', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const values = [...source.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
  const offGrid = values.filter(
    (value) => value !== 0 && Math.abs(value) !== 1 && Math.abs(value) % FOUNDRY_UI_GRID !== 0,
  );
  assert.deepEqual(
    [...new Set(offGrid)].sort((a, b) => a - b),
    [],
  );
});

test('the review flow requires a live coding-agent listener before apply', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /sessionRequest\('\/agent-presence'\)/);
  assert.match(source, /Connect agent to apply/);
  assert.match(source, /keep listening for Apply with agent requests/);
});
