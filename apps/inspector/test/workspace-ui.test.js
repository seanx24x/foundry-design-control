import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveWorkspaceUI } from '../public/workspace-ui.js';

test('the redesigned workspace is the default for fresh and existing launch URLs', () => {
  for (const search of ['', '?session=example&theme=dark', '?ui=next', '?ui=', '?ui=unknown'])
    assert.equal(resolveWorkspaceUI(search), 'next');
});

test('only an explicit legacy parameter opts out of the redesigned workspace', () => {
  assert.equal(resolveWorkspaceUI('?ui=legacy&theme=light'), 'legacy');
});

test('the UI choice is resolved before the application reads any feature gates', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const resolution = app.indexOf("params.set('ui', resolveWorkspaceUI(location.search))");
  assert.ok(resolution >= 0 && resolution < app.indexOf("params.get('ui')"));
});
