import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'skills', 'foundry-design-control');
const targets = [
  join(root, 'packages', 'cli', 'dist', 'skill', 'foundry-design-control'),
  join(root, 'plugins', 'foundry-design-control', 'skills', 'foundry-design-control'),
];

if (!existsSync(join(source, 'SKILL.md'))) {
  throw new Error(`Foundry skill source is missing from ${source}`);
}

for (const target of targets) {
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  // Public plugin review must not execute a moving CLI tag. Keep the direct
  // npm-installed skill's existing update behavior separate from this package.
  if (target.includes(join('plugins', 'foundry-design-control'))) {
    const version = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8')).version;
    const launcher = join(target, 'scripts/foundry.sh');
    writeFileSync(
      launcher,
      readFileSync(launcher, 'utf8').replace(
        '--package=foundry-design@latest',
        `--package=foundry-design@${version}`,
      ),
    );
  }
}
