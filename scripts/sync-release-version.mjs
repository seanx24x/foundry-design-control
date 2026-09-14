import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { replaceCursorInstallUrl } from './cursor-install-link.mjs';

const root = resolve(import.meta.dirname, '..');
const release = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));

function replaceFirstJsonStringProperty(source, property, value, label) {
  const pattern = new RegExp(`("${property}"\\s*:\\s*")[^"]*(")`);
  if (!pattern.test(source)) throw new Error(`${label} is missing ${property}.`);
  const updated = source.replace(pattern, `$1${value}$2`);
  JSON.parse(updated);
  return updated;
}

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
  const source = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    replaceFirstJsonStringProperty(source, 'version', release.version, relativePath),
  );
}

writeFileSync(
  join(root, 'packages/cli/src/release.ts'),
  `export const FOUNDRY_VERSION = '${release.version}';\nexport const FOUNDRY_PACKAGE_SPEC = \`foundry-design@\${FOUNDRY_VERSION}\`;\nexport const FOUNDRY_MCP_PACKAGE_SPEC = \`foundry-design-mcp-server@\${FOUNDRY_VERSION}\`;\n\nexport function releasePreflight(action: string): string {\n  return [\n    \`Foundry \${FOUNDRY_VERSION}\`,\n    \`Release preflight: CLI \${FOUNDRY_PACKAGE_SPEC}\`,\n    \`Agent bridge: \${FOUNDRY_MCP_PACKAGE_SPEC}\`,\n    \`Action: \${action}\`,\n  ].join('\\n');\n}\n`,
);

const releaseTestPath = join(root, 'packages/cli/src/release.test.ts');
const releaseTest = readFileSync(releaseTestPath, 'utf8').replaceAll(
  /0\.2\.0-beta\.\d+(?:\.\d+)?/g,
  release.version,
);
writeFileSync(releaseTestPath, releaseTest);

for (const relativePath of [
  '.mcp.json',
  'plugins/foundry-design-control/.mcp.json',
  'plugins/foundry-design-control/mcp.json',
]) {
  const path = join(root, relativePath);
  const source = readFileSync(path, 'utf8');
  const config = JSON.parse(source);
  const args = config.mcpServers?.['foundry-design-control']?.args;
  const currentSpec = Array.isArray(args)
    ? args.find((argument) => String(argument).startsWith('foundry-design-mcp-server@'))
    : undefined;
  if (!currentSpec) throw new Error(`${relativePath} is missing the Foundry MCP package spec.`);
  const updated = source.replace(currentSpec, `foundry-design-mcp-server@${release.version}`);
  JSON.parse(updated);
  writeFileSync(path, updated);
}

for (const relativePath of [
  '.agents/plugins/marketplace.json',
  '.cursor-plugin/marketplace.json',
  '.claude-plugin/marketplace.json',
]) {
  const path = join(root, relativePath);
  const source = readFileSync(path, 'utf8');
  const marketplace = JSON.parse(source);
  const plugin = marketplace.plugins?.find((entry) => entry.name === 'foundry-design-control');
  if (!plugin) throw new Error(`${relativePath} is missing the Foundry plugin entry.`);
  writeFileSync(
    path,
    replaceFirstJsonStringProperty(source, 'version', release.version, relativePath),
  );
}

for (const relativePath of ['README.md', 'DISTRIBUTION.md']) {
  const path = join(root, relativePath);
  const markdown = readFileSync(path, 'utf8');
  writeFileSync(path, replaceCursorInstallUrl(markdown, release.version, relativePath));
}

console.log(`Synchronized Foundry release metadata at ${release.version}.`);
