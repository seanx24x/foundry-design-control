import { copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'README.md');
for (const path of [
  'apps/inspector/README.md',
  'packages/cli/README.md',
  'packages/mcp-server/README.md',
  'packages/protocol/README.md',
  'packages/react-native-adapter/README.md',
  'packages/runtime/README.md',
  'packages/web-adapter/README.md',
]) {
  copyFileSync(source, join(root, path));
}
console.log('Synchronized package READMEs from README.md.');
