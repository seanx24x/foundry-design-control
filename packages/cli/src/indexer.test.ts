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
  --space-near: 13px;
  --spacing-margin-22px: 15px;
  --accent: #0070f3;
  --accent-primitive: #0070f3;
  --accent-semantic: var(--accent-primitive);
  --accent-action: var(--accent-semantic);
  --motion-fast: 160ms;
}
.card { container: card / inline-size; gap: 12px; padding: 14px; color: var(--accent); border-color: #0070f3; }
.notice { margin: 22px; border-color: #0070f3; }
.banner { margin: 22px; }
@media (min-width: 720px) { .layout { display: grid; } }
@container card (min-width: 480px) { .card-content { display: grid; } }
@container card (width <= 720px) { .card-content { gap: 8px; } }
[data-theme="dark"] { --accent: #5aa7ff; }
`,
  );
  await writeFile(
    join(root, 'src', 'Button.tsx'),
    `import { cva } from 'class-variance-authority';
const button = cva('button', {
  variants: {
    tone: { primary: 'bg-blue', quiet: 'bg-clear' },
    size: { small: 'h-8', medium: 'h-10' }
  }
});
type ButtonProps = { emphasis?: 'solid' | 'outline' };
export function Button(_props: ButtonProps) { return <button className={button()}>Save</button>; }
`,
  );
  await writeFile(
    join(root, 'src', 'Button.stories.tsx'),
    `export const Primary = {};
export const Quiet = {};
`,
  );
  await writeFile(
    join(root, 'src', 'MotionCard.tsx'),
    `import { motion } from 'motion/react';
export function MotionCard() { return <motion.article initial={{ x: -24 }} animate={{ x: 0 }} transition={{ duration: 0.48, delay: 0.08, ease: [0.16, 1, 0.3, 1] }} />; }
`,
  );
  await writeFile(
    join(root, 'src', 'GsapPanel.tsx'),
    `import gsap from 'gsap';
export function GsapPanel(node) { gsap.to(node, { x: 40, duration: 0.6, delay: 0.1, ease: 'power2.out' }); }
`,
  );
  await writeFile(
    join(root, 'src', 'SpringNotice.tsx'),
    `import { useSpring } from '@react-spring/web';
export function SpringNotice() { return useSpring({ from: { opacity: 0 }, to: { opacity: 1 }, config: { mass: 1, tension: 210, friction: 24 } }); }
`,
  );

  const graph = await indexProjectDesign(root, undefined, 'rev-1');
  assert.equal(graph.revision, 'rev-1');
  assert.ok(graph.tokens.some((token) => token.name === '--space-3'));
  assert.ok(graph.tokens.some((token) => token.category === 'color'));
  const actionToken = graph.tokens.find((token) => token.name === '--accent-action');
  assert.equal(actionToken?.aliasOfTokenName, '--accent-semantic');
  assert.deepEqual(actionToken?.aliasChain, [
    '--accent-action',
    '--accent-semantic',
    '--accent-primitive',
  ]);
  assert.equal(actionToken?.resolvedValue, '#0070f3');
  assert.equal(actionToken?.aliasStatus, 'resolved');
  assert.ok(graph.breakpoints.some((item) => item.width === 720));
  assert.deepEqual(
    graph.containerQueries?.map(({ name, minWidth, maxWidth }) => ({ name, minWidth, maxWidth })),
    [
      { name: 'card', minWidth: 480, maxWidth: undefined },
      { name: 'card', minWidth: undefined, maxWidth: 720 },
    ],
  );
  const button = graph.components.find((component) => component.name === 'Button');
  assert.deepEqual(
    button?.variants
      .filter((variant) => variant.adapter === 'storybook')
      .map((variant) => variant.label),
    ['Primary', 'Quiet'],
  );
  assert.deepEqual(button?.variants[1]?.props, { story: 'Quiet' });
  assert.deepEqual(
    button?.variantAxes.map((axis) => [axis.adapter, axis.property, axis.values]),
    [
      ['storybook', 'story', ['Primary', 'Quiet']],
      ['cva', 'tone', ['primary', 'quiet']],
      ['cva', 'size', ['small', 'medium']],
      ['typescript', 'emphasis', ['solid', 'outline']],
    ],
  );
  assert.ok(button?.variantAxes.every((axis) => axis.canCreate && axis.source.file));
  assert.ok(
    button?.variants.some(
      (variant) => variant.adapter === 'cva' && variant.sourceProperty === 'variants.tone.quiet',
    ),
  );
  assert.ok(graph.motionPresets.some((preset) => preset.duration === 160));
  const motion = graph.motionPresets.find((preset) => preset.adapter === 'motion');
  const gsap = graph.motionPresets.find((preset) => preset.adapter === 'gsap');
  const spring = graph.motionPresets.find((preset) => preset.adapter === 'react-spring');
  assert.equal(motion?.duration, 480);
  assert.equal(motion?.easing, 'cubic-bezier(0.16, 1, 0.3, 1)');
  assert.equal(motion?.sourceProperty, 'transition');
  assert.equal(gsap?.duration, 600);
  assert.equal(gsap?.easing, 'power2.out');
  assert.equal(spring?.configuration.tension, 210);
  assert.equal(spring?.configuration.friction, 24);
  assert.ok(graph.themes.some((theme) => theme.id === 'dark'));
  assert.ok(
    graph.tokenUsages.some((usage) => usage.tokenName === '--accent' && usage.kind === 'reference'),
  );
  assert.ok(
    graph.tokenUsages.some((usage) => usage.tokenName === '--space-3' && usage.kind === 'literal'),
  );
  assert.ok(graph.designSystemFindings.some((finding) => finding.kind === 'near-duplicate'));
  assert.ok(
    graph.designSystemFindings.some(
      (finding) => finding.kind === 'literal-drift' && finding.suggestedTokenId,
    ),
  );
  const existingPromotion = graph.tokenPromotions?.find(
    (candidate) => candidate.value === '#0070f3',
  );
  assert.equal(existingPromotion?.recommendation, 'use-existing');
  assert.equal(existingPromotion?.suggestedTokenName, '--accent-action');
  assert.deepEqual(existingPromotion?.aliasChain, [
    '--accent-action',
    '--accent-semantic',
    '--accent-primitive',
  ]);
  const newPromotion = graph.tokenPromotions?.find((candidate) => candidate.value === '22px');
  assert.equal(newPromotion?.recommendation, 'create-token');
  assert.equal(newPromotion?.relation, 'new');
  assert.equal(newPromotion?.occurrenceCount, 2);
  assert.match(newPromotion?.suggestedTokenName ?? '', /^--spacing-margin-22px-[a-z0-9]{4}$/);
  assert.notEqual(newPromotion?.suggestedTokenName, '--spacing-margin-22px');
});

test('marks broken and circular token aliases without inventing resolved values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-index-alias-'));
  await writeFile(
    join(root, 'theme.css'),
    `:root {
  --broken: var(--missing);
  --loop-a: var(--loop-b);
  --loop-b: var(--loop-a);
}`,
  );
  const graph = await indexProjectDesign(root, undefined);
  assert.equal(graph.tokens.find((token) => token.name === '--broken')?.aliasStatus, 'broken');
  assert.equal(graph.tokens.find((token) => token.name === '--loop-a')?.aliasStatus, 'circular');
  assert.equal(graph.tokens.find((token) => token.name === '--loop-a')?.resolvedValue, undefined);
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
