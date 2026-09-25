import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { inspectorFontAssets } from '../font-assets.mjs';

test('preferred fonts and fallbacks use pinned local variable WOFF2 with distributable licenses', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  for (const font of inspectorFontAssets) {
    const version = manifest.dependencies[`@fontsource-variable/${font.package}`];
    assert.match(version, /^\d+\.\d+\.\d+$/);
    const packageRoot = new URL(
      `../node_modules/@fontsource-variable/${font.package}/`,
      import.meta.url,
    );
    const bytes = await readFile(
      new URL(`files/${font.package}-latin-wght-normal.woff2`, packageRoot),
    );
    assert.equal(bytes.subarray(0, 4).toString(), 'wOF2');
    assert.match(await readFile(new URL('LICENSE', packageRoot), 'utf8'), /SIL OPEN FONT LICENSE/);
    const face = css
      .split('@font-face')
      .find((block) => block.includes(`font-family: '${font.family}'`));
    assert.ok(face, `${font.family} must be defined, not just listed as a fallback preference`);
    assert.ok(face.includes(`url('/fonts/${font.package}.woff2')`));
    assert.ok(face.includes(`font-weight: ${font.weight};`));
    assert.equal(
      face.includes('local('),
      false,
      'Machine-installed copies must not change rendering',
    );
  }
});
