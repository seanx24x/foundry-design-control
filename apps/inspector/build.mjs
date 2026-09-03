import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

await rm(new URL('./dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
await cp(new URL('./public/', import.meta.url), new URL('./dist/', import.meta.url), {
  recursive: true,
});
await mkdir(new URL('./dist/fonts/', import.meta.url), { recursive: true });
await cp(
  new URL(
    './node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
    import.meta.url,
  ),
  new URL('./dist/fonts/inter.woff2', import.meta.url),
);
await cp(
  new URL(
    './node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
    import.meta.url,
  ),
  new URL('./dist/fonts/jetbrains-mono.woff2', import.meta.url),
);
await build({
  entryPoints: [new URL('./public/app.js', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: new URL('./dist/app.js', import.meta.url).pathname,
});
