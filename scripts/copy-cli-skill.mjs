import { cpSync, existsSync, rmSync } from 'node:fs';
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
}
