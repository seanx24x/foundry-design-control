import { resolve } from 'node:path';
import { join } from 'node:path';
import { verifyReleaseArtifacts } from './release-artifacts.mjs';

const root = resolve(import.meta.dirname, '..');
const artifactDirectory = join(root, 'artifacts', 'npm');

try {
  const manifest = verifyReleaseArtifacts(root, artifactDirectory);
  console.log(
    `Verified ${manifest.packages.length} unchanged release tarballs for ${manifest.releaseVersion}.`,
  );
  for (const entry of manifest.packages) {
    console.log(`✓ ${entry.name}@${entry.version} ${entry.npmIntegrity}`);
  }
} catch (error) {
  console.error(`Release artifact verification failed: ${error.message}`);
  process.exit(1);
}
