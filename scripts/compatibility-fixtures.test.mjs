import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  compatibilityFixtures,
  capabilityReport,
  sourceAnchor,
} from './compatibility-fixtures.mjs';

const root = resolve(import.meta.dirname, '..');
for (const fixture of compatibilityFixtures) {
  test(`${fixture.id} binds the deterministic correction to its current CSS Modules declaration`, () => {
    const project = join(root, 'examples', 'compatibility', fixture.id);
    const anchor = sourceAnchor(project, fixture);
    assert.equal(anchor.line, 3);
    assert.match(anchor.text, /min-height: 40px/);
    const component = readFileSync(
      join(
        project,
        fixture.id === 'next-app'
          ? 'app/ProjectCard.jsx'
          : fixture.id === 'react-vite'
            ? 'src/ProjectCard.jsx'
            : 'src/Action.jsx',
      ),
      'utf8',
    );
    assert.ok(component.includes(`data-foundry-source="${fixture.sourceFile}:${anchor.line}:3"`));
    assert.ok(component.includes(`data-foundry-source-anchor="${anchor.symbol}"`));
    const manifest = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
    assert.equal(manifest.private, true);
    assert.ok(manifest.scripts.build);
    for (const dependency of Object.values({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    }))
      assert.match(dependency, /^\d+\.\d+\.\d+$/, 'Framework dependency versions must be exact.');
  });
}
test('a compatibility report does not turn configured capabilities into verified claims', () => {
  const fixture = compatibilityFixtures.find(({ id }) => id === 'storybook-cva');
  const pending = capabilityReport(fixture);
  assert.equal(
    pending.capabilities.some(({ status }) => status === 'verified'),
    false,
  );
  assert.equal(
    pending.capabilities.find(({ id }) => id === 'storybook-install').status,
    'requires-instrumentation',
  );
  const measured = capabilityReport(fixture, ['themes']);
  assert.deepEqual(
    measured.capabilities.filter(({ status }) => status === 'verified').map(({ id }) => id),
    ['themes'],
  );
  assert.equal(measured.capabilities.find(({ id }) => id === 'source-apply').status, 'untested');
});
