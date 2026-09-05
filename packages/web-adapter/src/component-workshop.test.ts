import assert from 'node:assert/strict';
import test from 'node:test';
import {
  availableWorkshopScopes,
  componentWorkshopStates,
  normalizeWorkshopComponents,
  sourceLabel,
} from './component-workshop.js';

test('normalizes indexed Storybook variants into workshop props', () => {
  const [component] = normalizeWorkshopComponents([
    {
      id: 'button',
      name: 'Button',
      source: { file: 'src/Button.tsx', line: 4 },
      instances: 3,
      variants: [
        {
          id: 'primary',
          label: 'Primary',
          property: 'story',
          value: 'Primary',
          source: { file: 'src/Button.stories.tsx', line: 8 },
        },
      ],
    },
  ]);
  assert.equal(component?.variants[0]?.name, 'Primary');
  assert.deepEqual(component?.variants[0]?.props, { story: 'Primary' });
  assert.equal(sourceLabel(component?.source), 'src/Button.tsx:4');
});

test('preserves richer runtime variant props', () => {
  const [component] = normalizeWorkshopComponents([
    {
      id: 'button',
      name: 'Button',
      variants: [{ id: 'quiet', name: 'Quiet', props: { tone: 'quiet', loading: false } }],
    },
  ]);
  assert.deepEqual(component?.variants[0]?.props, { tone: 'quiet', loading: false });
});

test('combines standard interaction states with configured product states', () => {
  const states = componentWorkshopStates([
    {
      id: 'destructive',
      label: 'Destructive',
      evidence: ['Configured in Foundry'],
    },
  ]);
  assert.deepEqual(
    states.slice(0, 8).map(({ id }) => id),
    ['current', 'hover', 'focus', 'active', 'disabled', 'loading', 'empty', 'error'],
  );
  assert.equal(states.at(-1)?.id, 'destructive');
});

test('keeps broader scopes read-only until source mapping is available', () => {
  const scopes = availableWorkshopScopes({
    hasLiveInstance: true,
    hasComponentSource: false,
    selectedVariant: { id: 'quiet', name: 'Quiet', props: {} },
  });
  assert.deepEqual(
    scopes.map(({ enabled }) => enabled),
    [true, false, false],
  );
  const mapped = availableWorkshopScopes({
    hasLiveInstance: true,
    hasComponentSource: true,
    selectedVariant: {
      id: 'quiet',
      name: 'Quiet',
      props: {},
      source: { file: 'Button.stories.tsx' },
    },
  });
  assert.deepEqual(
    mapped.map(({ enabled }) => enabled),
    [true, true, true],
  );
});
