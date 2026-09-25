import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const compatibilityFixtures = [
  {
    id: 'react-vite',
    name: 'React + Vite + CSS Modules',
    sourceFile: 'src/Action.module.css',
    output: 'dist',
    instrumentation: 'automatic-html',
  },
  {
    id: 'next-app',
    name: 'Next.js App Router + CSS Modules',
    sourceFile: 'app/Action.module.css',
    output: 'out',
    instrumentation: 'automatic-next-loader',
  },
  {
    id: 'storybook-cva',
    name: 'Storybook + CVA',
    sourceFile: 'src/Action.module.css',
    output: 'storybook-static',
    instrumentation: 'authored-preview-head',
    entry: '/iframe.html?id=project-action--primary&viewMode=story',
  },
];

export function sourceAnchor(project, fixture) {
  const lines = readFileSync(join(project, fixture.sourceFile), 'utf8').split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes('/* foundry: compat-action */'));
  assert.ok(index >= 0, `${fixture.id} is missing its exact source anchor.`);
  assert.equal(index + 1, 3, 'Update source annotations when the reviewed declaration moves.');
  assert.match(lines[index], /min-height:\s*(40|44)px;/);
  return { line: index + 1, symbol: '/* foundry: compat-action */', text: lines[index] };
}

export function capabilityReport(fixture, evidence = []) {
  const verified = (id, scope) => ({
    id,
    status: evidence.includes(id) ? 'verified' : 'untested',
    scope,
  });
  return {
    fixture: fixture.id,
    framework: fixture.name,
    capabilities: [
      verified(
        'source-apply',
        'One nested source-annotated CSS Modules action, reviewed 40px to 44px, rebuilt and verified.',
      ),
      verified('themes', 'Authored root data-theme light/dark tokens and computed colors.'),
      verified('states', 'Authored hover and temporary data-tone variant selectors.'),
      verified(
        'responsive',
        'Configured mobile and desktop viewports with measured overflow checks.',
      ),
      verified('ambiguity', 'Flex width versus flex-basis ambiguity blocks Apply until resolved.'),
      verified(
        'framing-fallback',
        'A real X-Frame-Options denial exposes the direct overlay, retaining session and source mapping.',
      ),
      ...(fixture.id === 'storybook-cva'
        ? [verified('variants', 'Indexed CSF stories and CVA tone axis.')]
        : []),
      {
        id: 'source-inference',
        status: 'requires-instrumentation',
        scope:
          'Exact JSX-to-CSS mapping in these fixtures uses explicit source annotations; arbitrary source inference is not asserted.',
      },
      ...(fixture.instrumentation === 'authored-preview-head'
        ? [
            {
              id: 'storybook-install',
              status: 'requires-instrumentation',
              scope: 'Storybook preview-head.html loads the adapter only for an explicit session.',
            },
          ]
        : []),
      {
        id: 'cross-origin-styles',
        status: 'unsupported',
        scope: 'Authored pseudo-state replay requires readable same-origin CSS.',
      },
    ],
  };
}
