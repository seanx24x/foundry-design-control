import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { indexProjectDesign } from './indexer.js';

test('indexes project-native tokens, breakpoints, components, stories, and motion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-index-'));
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(
    join(root, 'src', 'theme.css'),
    `:root {
  --space-3: 12px;
  --accent: #0070f3;
  --motion-fast: 160ms;
}
@media (min-width: 720px) { .layout { display: grid; } }
[data-theme="dark"] { --accent: #5aa7ff; }
`,
  );
  await writeFile(
    join(root, 'src', 'Button.tsx'),
    `export function Button() { return <button>Save</button>; }
`,
  );
  await writeFile(
    join(root, 'src', 'Button.stories.tsx'),
    `export const Primary = {};
export const Quiet = {};
`,
  );

  const graph = await indexProjectDesign(root, undefined, 'rev-1');
  assert.equal(graph.revision, 'rev-1');
  assert.ok(graph.tokens.some((token) => token.name === '--space-3'));
  assert.ok(graph.tokens.some((token) => token.category === 'color'));
  assert.ok(graph.breakpoints.some((item) => item.width === 720));
  const button = graph.components.find((component) => component.name === 'Button');
  assert.deepEqual(
    button?.variants.map((variant) => variant.label),
    ['Primary', 'Quiet'],
  );
  assert.ok(graph.motionPresets.some((preset) => preset.duration === 160));
  assert.ok(graph.themes.some((theme) => theme.id === 'dark'));
});

test('prefers configured viewport and state definitions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-index-config-'));
  const graph = await indexProjectDesign(root, {
    version: 2,
    platform: 'web',
    runtimeUrl: 'http://127.0.0.1:4387',
    instrumented: true,
    design: {
      viewports: [{ id: 'phone', label: 'Phone', width: 375, height: 812 }],
      states: [
        {
          id: 'hover-dark',
          label: 'Dark hover',
          theme: 'dark',
          pseudoStates: ['hover'],
        },
      ],
    },
  });
  assert.deepEqual(
    graph.breakpoints.map((item) => item.id),
    ['phone'],
  );
  assert.equal(graph.states[0]?.pseudoStates[0], 'hover');
});
