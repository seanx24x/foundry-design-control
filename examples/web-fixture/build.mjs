import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSourceAnnotations } from './validate-source-annotations.mjs';

const fixtureRoot = dirname(fileURLToPath(import.meta.url));
const sourceFiles = ['index.html', 'style.css'];

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export async function buildFixture(sourceRoot = fixtureRoot, outputRoot) {
  const source = resolve(sourceRoot);
  const output = resolve(outputRoot ?? join(source, 'dist'));
  if (output === source || !output.startsWith(`${source}/`)) {
    throw new Error('Fixture output must be a child directory of the fixture source.');
  }
  const annotations = validateSourceAnnotations(source);
  const entries = await Promise.all(
    sourceFiles.map(async (file) => {
      const content = await readFile(join(source, file));
      return [file, content];
    }),
  );
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const [file, content] of entries) await writeFile(join(output, file), content);
  const manifest = {
    version: 1,
    sourceAnnotations: annotations,
    files: Object.fromEntries(
      entries.map(([file, content]) => [
        file,
        { bytes: content.byteLength, sha256: sha256(content) },
      ]),
    ),
  };
  await writeFile(join(output, 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const manifest = await buildFixture(process.cwd());
  console.log(
    `Built Morrow fixture: ${Object.keys(manifest.files).length} files, ${manifest.sourceAnnotations.count} validated annotations.`,
  );
}
