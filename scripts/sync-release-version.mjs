import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const release = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));
const manifestPaths = [
  'package.json',
  'apps/inspector/package.json',
  'packages/cli/package.json',
  'packages/mcp-server/package.json',
  'packages/protocol/package.json',
  'packages/react-native-adapter/package.json',
  'packages/runtime/package.json',
  'packages/web-adapter/package.json',
  '.codex-plugin/plugin.json',
  'plugins/foundry-design-control/plugin.json',
  'plugins/foundry-design-control/.codex-plugin/plugin.json',
  'plugins/foundry-design-control/.cursor-plugin/plugin.json',
  'plugins/foundry-design-control/.claude-plugin/plugin.json',
  'extensions/claude-desktop/manifest.json',
];

for (const relativePath of manifestPaths) {
  const path = join(root, relativePath);
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  manifest.version = release.version;
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

writeFileSync(
  join(root, 'packages/cli/src/release.ts'),
  `export const FOUNDRY_VERSION = '${release.version}';\nexport const FOUNDRY_PACKAGE_SPEC = \`foundry-design@\${FOUNDRY_VERSION}\`;\nexport const FOUNDRY_MCP_PACKAGE_SPEC = \`foundry-design-mcp-server@\${FOUNDRY_VERSION}\`;\n\nexport function releasePreflight(action: string): string {\n  return [\n    \`Foundry \${FOUNDRY_VERSION}\`,\n    \`Release preflight: CLI \${FOUNDRY_PACKAGE_SPEC}\`,\n    \`Agent bridge: \${FOUNDRY_MCP_PACKAGE_SPEC}\`,\n    \`Action: \${action}\`,\n  ].join('\\n');\n}\n`,
);

for (const relativePath of [
  '.mcp.json',
  'plugins/foundry-design-control/.mcp.json',
  'plugins/foundry-design-control/mcp.json',
]) {
  const path = join(root, relativePath);
  const config = JSON.parse(readFileSync(path, 'utf8'));
  config.mcpServers['foundry-design-control'].args = [
    '-y',
    '--prefer-online',
    `foundry-design-mcp-server@${release.version}`,
  ];
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
}

console.log(`Synchronized Foundry release metadata at ${release.version}.`);
