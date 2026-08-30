import assert from 'node:assert/strict';
import test from 'node:test';
import { createDebouncedChangeRecorder } from './recording.js';

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

test('preserves the initial value across one rapid edit burst', async () => {
  const recorded: Array<[number, number]> = [];
  const recorder = createDebouncedChangeRecorder<number>(10, (before, after) => {
    recorded.push([before, after]);
  });

  recorder.push(6, 2);
  recorder.push(2, 12);
  recorder.push(12, 24);
  await wait(30);

  assert.deepEqual(recorded, [[6, 24]]);
});

test('starts a new initial value after the previous burst is recorded', async () => {
  const recorded: Array<[number, number]> = [];
  const recorder = createDebouncedChangeRecorder<number>(10, (before, after) => {
    recorded.push([before, after]);
  });

  recorder.push(6, 24);
  await wait(30);
  recorder.push(24, 32);
  await wait(30);

  assert.deepEqual(recorded, [
    [6, 24],
    [24, 32],
  ]);
});
