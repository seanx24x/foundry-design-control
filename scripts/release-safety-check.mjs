import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RELEASE_PACKAGE_DIRECTORIES } from './release-artifacts.mjs';

const root = resolve(import.meta.dirname, '..');
const workflow = readFileSync(join(root, '.github', 'workflows', 'release.yml'), 'utf8');
const publishScript = readFileSync(join(root, 'scripts', 'publish-release.mjs'), 'utf8');
const packScript = readFileSync(join(root, 'scripts', 'pack-release.mjs'), 'utf8');
const tagScript = readFileSync(join(root, 'scripts', 'promote-release.mjs'), 'utf8');
const publicArchiveScript = readFileSync(
  join(root, 'scripts', 'public-package-archive.mjs'),
  'utf8',
);
const verifyPublicScript = readFileSync(join(root, 'scripts', 'verify-public-release.mjs'), 'utf8');
const pnpmFile = readFileSync(join(root, '.pnpmfile.cjs'), 'utf8');
const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const failures = [];

const bridgeIndex = RELEASE_PACKAGE_DIRECTORIES.indexOf('packages/mcp-server');
const cliIndex = RELEASE_PACKAGE_DIRECTORIES.indexOf('packages/cli');
if (bridgeIndex === -1 || cliIndex === -1 || bridgeIndex >= cliIndex) {
  failures.push('the MCP bridge must be published and registry-visible before the CLI');
}

for (const fragment of [
  'fetch-depth: 0',
  'group: foundry-release',
  'refs/heads/main',
  'refs/remotes/origin/main',
  'Recheck release source before registry mutation',
  'git diff --exit-code',
  'pnpm release:tag-beta',
  'targetCommitish',
  'isPrerelease',
  'published SHA-256',
]) {
  if (!workflow.includes(fragment)) failures.push(`release.yml is missing ${fragment}`);
}
if ((workflow.match(/refs\/remotes\/origin\/main/g) ?? []).length < 2) {
  failures.push('release.yml must recheck origin/main immediately before registry mutation');
}

const buildIndex = packScript.indexOf("spawnSync('pnpm', ['build']");
const packIndex = packScript.indexOf('for (const directory of RELEASE_PACKAGE_DIRECTORIES)');
if (buildIndex === -1 || packIndex === -1 || buildIndex >= packIndex) {
  failures.push('release:pack must complete a fresh root build before packing any tarball');
}
if (!packScript.includes('rmSync(output, { recursive: true, force: true });\n  console.error')) {
  failures.push('release:pack must remove stale artifacts when the fresh build fails');
}

if (rootPackage.scripts?.['release:tag-beta'] !== 'node scripts/promote-release.mjs --tag=beta') {
  failures.push('package.json does not expose the authenticated beta-tag convergence command');
}
for (const fragment of ['verifyReleaseArtifacts(root, artifactDirectory)']) {
  if (!tagScript.includes(fragment)) failures.push(`promote-release.mjs is missing ${fragment}`);
}
for (const [label, contents] of [
  ['publish-release.mjs', publishScript],
  ['promote-release.mjs', tagScript],
]) {
  for (const fragment of ['assertPublicPackageMatches(root, entry, registry, state.integrity)']) {
    if (!contents.includes(fragment)) failures.push(`${label} is missing ${fragment}`);
  }
}
for (const fragment of [
  'inspectReleaseTarball',
  'registryIntegrity === entry.npmIntegrity',
  'packed?.integrity !== registryIntegrity',
  'inspected.npmIntegrity !== registryIntegrity',
  'assertPackedPackageJsonMatches',
  'inspected.contentSha256 !== entry.contentSha256',
  'rmSync(directory, { recursive: true, force: true })',
]) {
  if (!publicArchiveScript.includes(fragment)) {
    failures.push(`public-package-archive.mjs is missing ${fragment}`);
  }
}
for (const fragment of [
  'beforePacking: sortDependencyMaps',
  "'dependencies'",
  "'optionalDependencies'",
  "'peerDependencies'",
]) {
  if (!pnpmFile.includes(fragment)) failures.push(`.pnpmfile.cjs is missing ${fragment}`);
}
if (workflow.includes('--clobber')) {
  failures.push('release.yml may not overwrite an existing GitHub release asset');
}

for (const fragment of [
  'waitForPublishedEntry(entry)',
  'assertMatchingPublicIntegrity(entry, state)',
]) {
  if (!publishScript.includes(fragment)) {
    failures.push(`publish-release.mjs is missing ${fragment}`);
  }
}

for (const fragment of [
  'inspectPublicTarball(packageName)',
  "'pack'",
  "'--dry-run'",
  "'--ignore-scripts'",
  "'--prefer-online'",
]) {
  if (!verifyPublicScript.includes(fragment)) {
    failures.push(`verify-public-release.mjs is missing ${fragment}`);
  }
}

const orderedSteps = [
  'pnpm release:publish',
  'pnpm release:tag-beta',
  'pnpm release:verify-public',
  'pnpm test:golden:registry',
  'pnpm release:promote',
];
let previous = -1;
for (const step of orderedSteps) {
  const index = workflow.indexOf(step);
  if (index === -1) failures.push(`release.yml is missing ${step}`);
  else if (index <= previous) failures.push(`release.yml runs ${step} out of release-gate order`);
  previous = index;
}

if (failures.length) {
  console.error(`Release safety check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(
  'Release source, package order, tag convergence, and immutable asset guards are present.',
);
