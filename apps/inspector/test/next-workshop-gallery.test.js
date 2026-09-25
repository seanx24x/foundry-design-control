import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  specimenPlacement,
  specimenUrl,
  specimenStateUrl,
  galleryRenderKey,
} from '../public/next-workshop-gallery.js';

test('gallery rebuilds when hydration discovers instances, but not on card selection', () => {
  const model = { component: { key: 'Button', elements: [] }, variants: [], connected: true };
  const hydrated = { ...model, component: { key: 'Button', elements: [{ selector: '#button' }] } };
  assert.notEqual(galleryRenderKey(model), galleryRenderKey(hydrated));
  assert.equal(
    galleryRenderKey(hydrated),
    galleryRenderKey({ ...hydrated, selectedVariantId: 'danger' }),
  );
});

test('authored route states reload only the isolated URL and preserve connection parameters', () => {
  const original = 'http://localhost:4590/?__foundry_session=test&state=old&campaign=demo';
  const url = new URL(
    specimenStateUrl(original, { managedStateKeys: ['state'], reloadQuery: { state: 'loading' } }),
  );
  assert.equal(url.searchParams.get('state'), 'loading');
  assert.equal(url.searchParams.get('campaign'), 'demo');
  assert.equal(url.searchParams.get('__foundry_session'), 'test');
  assert.equal(url.searchParams.get('__foundry_frame'), 'component-specimen');
  assert.equal(
    new URL(
      specimenStateUrl(original, { managedStateKeys: ['state'], reloadQuery: {} }),
    ).searchParams.has('state'),
    false,
  );
  assert.throws(() => specimenStateUrl(original, { reloadQuery: { __foundry_session: 'other' } }));
});

test('specimens center measured source geometry and fit down without enlarging', () => {
  const rect = { x: 800, y: 450, width: 448, height: 52 };
  const fit = specimenPlacement(rect, 360, 200);
  assert.equal(fit.scale, 312 / 448);
  assert.equal(fit.x + rect.x * fit.scale, 24);
  assert.ok(Math.abs(fit.y + (rect.y + rect.height / 2) * fit.scale - 100) < 0.001);
  assert.equal(specimenPlacement(rect, 800, 400).scale, 1);
  assert.throws(() => specimenPlacement({ ...rect, width: 0 }, 360, 200));
  assert.throws(() => specimenPlacement({ ...rect, x: NaN }, 360, 200));
});

test('isolated URLs retain preview authorization and cannot impersonate verification frames', () => {
  const url = new URL(
    specimenUrl(
      'http://localhost:4590/?__foundry_session=test&__foundry_token=example&__foundry_preview_capability=example&__foundry_child=1&__foundry_verification=1',
    ),
  );
  assert.equal(url.searchParams.get('__foundry_session'), 'test');
  assert.equal(url.searchParams.get('__foundry_token'), 'example');
  assert.equal(url.searchParams.get('__foundry_preview_capability'), 'example');
  assert.equal(url.searchParams.get('__foundry_frame'), 'component-specimen');
  assert.equal(url.searchParams.get('__foundry_embedded'), '1');
  assert.equal(url.searchParams.has('__foundry_child'), false);
  assert.equal(url.searchParams.has('__foundry_verification'), false);
});

test('gallery success requires measured acknowledgement, with bounded failures and cleanup', () => {
  const source = readFileSync(
    new URL('../public/next-workshop-gallery.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /result\.evidence\?\.fontsReady/);
  assert.match(source, /result\.evidence\?\.stable/);
  assert.match(source, /attempt !== entry.attempt/);
  assert.match(source, /15000/);
  assert.match(source, /invalidate\(entry.frame/);
  assert.match(source, /entry.frame.remove\(\)/);
  assert.doesNotMatch(source, /preview-component-variant|stage-component|record\(/);
});
