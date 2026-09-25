import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { inspectorFontAssets } from './font-assets.mjs';

await rm(new URL('./dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
await cp(new URL('./public/', import.meta.url), new URL('./dist/', import.meta.url), {
  recursive: true,
});
await mkdir(new URL('./dist/fonts/', import.meta.url), { recursive: true });
for (const font of inspectorFontAssets) {
  const packageRoot = new URL(
    `./node_modules/@fontsource-variable/${font.package}/`,
    import.meta.url,
  );
  await cp(
    new URL(`files/${font.package}-latin-wght-normal.woff2`, packageRoot),
    new URL(`./dist/fonts/${font.package}.woff2`, import.meta.url),
  );
  await cp(
    new URL('LICENSE', packageRoot),
    new URL(`./dist/fonts/${font.package}-OFL.txt`, import.meta.url),
  );
}
await build({
  entryPoints: [new URL('./public/app.js', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: new URL('./dist/app.js', import.meta.url).pathname,
});
