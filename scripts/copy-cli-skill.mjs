import { cpSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'skills', 'foundry-design-control');
const target = join(root, 'packages', 'cli', 'dist', 'skill', 'foundry-design-control');

if (!existsSync(join(source, 'SKILL.md'))) {
  throw new Error(`Foundry skill source is missing from ${source}`);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
