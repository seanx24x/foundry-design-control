import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  RELEASE_ARTIFACT_COUNT,
  RELEASE_INTEGRITY_MANIFEST,
  RELEASE_PACKAGE_DIRECTORIES,
  verifyReleaseArtifacts,
  writeReleaseIntegrityManifest,
} from './release-artifacts.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'artifacts/npm');

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

const build = spawnSync('pnpm', ['build'], {
  cwd: root,
  stdio: 'inherit',
});
if (build.status !== 0) {
  rmSync(output, { recursive: true, force: true });
  console.error('Cannot seal release artifacts: the deterministic release build failed.');
  process.exit(build.status ?? 1);
}

for (const directory of RELEASE_PACKAGE_DIRECTORIES) {
  const result = spawnSync('pnpm', ['pack', '--pack-destination', output], {
    cwd: resolve(root, directory),
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const tarballs = readdirSync(output).filter((name) => name.endsWith('.tgz'));
if (tarballs.length !== RELEASE_ARTIFACT_COUNT) {
  console.error(`Expected ${RELEASE_ARTIFACT_COUNT} tarballs, found ${tarballs.length}.`);
  process.exit(1);
}

try {
  writeReleaseIntegrityManifest(root, output);
  const manifest = verifyReleaseArtifacts(root, output);
  console.log(
    `Packed ${tarballs.length} beta packages into ${output} and saved ${RELEASE_INTEGRITY_MANIFEST} for ${manifest.releaseVersion}.`,
  );
} catch (error) {
  console.error(`Cannot seal release artifacts: ${error.message}`);
  process.exit(1);
}
