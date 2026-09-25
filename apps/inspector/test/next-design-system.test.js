import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  tokenPreviewModel,
  systemCardDestination,
  indexedImpact,
} from '../public/next-design-system.js';

test('connected rendered values take precedence without replacing indexed source values', () => {
  const token = { category: 'color', value: 'var(--ink)', resolvedValue: '#111111' };
  assert.deepEqual(tokenPreviewModel(token, '#eeeeee', true), {
    category: 'color',
    value: '#eeeeee',
    evidence: 'Rendered value from Canvas',
  });
  assert.equal(token.resolvedValue, '#111111');
});
test('offline or missing preview evidence is always labelled indexed', () => {
  const token = { category: 'color', value: '#111111' };
  assert.equal(tokenPreviewModel(token, '#eeeeee', false).value, '#111111');
  assert.equal(tokenPreviewModel(token, '#eeeeee', false).evidence, 'Indexed source value');
  assert.equal(tokenPreviewModel(token, undefined, true).evidence, 'Indexed source value');
});
test('promotion values and unsupported categories remain literal source values', () => {
  assert.deepEqual(tokenPreviewModel({ value: '12px', category: 'spacing' }), {
    value: '12px',
    category: 'spacing',
    evidence: 'Indexed source value',
  });
  assert.equal(
    tokenPreviewModel({ value: 'Morrow Sans', category: 'typography' }).value,
    'Morrow Sans',
  );
});
test('main content owns usage and reviewed actions, properties own source and analysis', () => {
  for (const title of ['Usage trace', 'Recommended plan', 'Authored occurrences', ''])
    assert.equal(systemCardDestination(title), 'main');
  for (const title of [
    'Source of truth',
    'Impact preview',
    'Indexed alias chain',
    'System guidance',
    'Source impact',
    'Alias resolution',
  ])
    assert.equal(systemCardDestination(title), 'properties');
});
test('missing component mappings are not presented as verified coverage', () => {
  assert.equal(
    indexedImpact([{ kind: 'reference', source: { file: 'style.css' } }]),
    '1 indexed reference across 1 file. No component mappings in this index.',
  );
  assert.equal(
    indexedImpact([
      { kind: 'reference', source: { file: 'style.css' }, componentId: 'Button' },
      { kind: 'literal', source: { file: 'style.css' }, componentId: 'Button' },
    ]),
    '1 indexed reference across 1 file. 1 mapped component.',
  );
});
test('Next Design System preserves scoped geometry, full width, and reduced motion', () => {
  const css = readFileSync(new URL('../public/next-design-system.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns: 300px minmax\(0, 1fr\) 300px/);
  assert.match(css, /--system-inset: 24px/);
  assert.match(css, /var\(--system-inset\) - var\(--system-scrollbar-width, 0px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.design-token-row \{[^}]*height: 32px/);
  assert.match(css, /\.design-system-summary article \{[^}]*min-height: 20px/);
});
test('presentation preserves existing action nodes and does not send or stage source commands', () => {
  const source = readFileSync(new URL('../public/next-design-system.js', import.meta.url), 'utf8');
  assert.match(source, /content.append\(card\)/);
  assert.doesNotMatch(source, /fetch\(|requestCommand\(|runDurableAction\(/);
  assert.match(source, /This is not a full visual verification/);
  assert.match(source, /scrollTop = saved\?\.main/);
  assert.match(source, /disclosure.open = saved\?\.open.includes/);
});
