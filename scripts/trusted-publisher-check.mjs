import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const registry = 'https://registry.npmjs.org';
const contract = JSON.parse(readFileSync(join(root, 'release', 'trusted-publishers.json'), 'utf8'));
const workflow = readFileSync(join(root, '.github', 'workflows', contract.file), 'utf8');
const contractOnly = process.argv.includes('--contract-only');
const failures = [];

const packagePaths = [
  'apps/inspector/package.json',
  'packages/protocol/package.json',
  'packages/web-adapter/package.json',
  'packages/runtime/package.json',
  'packages/cli/package.json',
  'packages/mcp-server/package.json',
  'packages/react-native-adapter/package.json',
];
const packageNames = packagePaths.map(
  (path) => JSON.parse(readFileSync(join(root, path), 'utf8')).name,
);

if (contract.type !== 'github') failures.push('publisher type must be github');
if (contract.repository !== 'seanx24x/foundry-design-control') {
  failures.push(`unexpected trusted repository ${contract.repository}`);
}
if (contract.file !== 'release.yml') failures.push(`unexpected workflow ${contract.file}`);
if (contract.environment !== 'npm') {
  failures.push(`unexpected GitHub environment ${contract.environment}`);
}
for (const permission of ['createPackage', 'createStagedPackage']) {
  if (!contract.permissions.includes(permission)) failures.push(`missing ${permission} permission`);
}
if (JSON.stringify(contract.packages) !== JSON.stringify(packageNames)) {
  failures.push(
    'trusted package list does not match the seven release packages in dependency order',
  );
}
for (const required of [
  'id-token: write',
  'environment: npm',
  'actions/checkout@v6',
  'pnpm/action-setup@v6',
  'actions/setup-node@v6',
]) {
  if (!workflow.includes(required)) failures.push(`${contract.file} is missing ${required}`);
}
if (workflow.includes('package-manager-cache')) {
  failures.push(`${contract.file} contains the unsupported package-manager-cache input`);
}

if (failures.length) {
  console.error(`Trusted publisher contract failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

if (contractOnly) {
  console.log('Trusted publisher contract covers all seven packages.');
  process.exit(0);
}

for (const packageName of contract.packages) {
  const result = spawnSync(
    'npm',
    ['trust', 'list', packageName, '--json', '--registry', registry],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    failures.push(
      `${packageName}: npm authentication is required; run this command in an authenticated npm session`,
    );
    continue;
  }

  let actual;
  try {
    actual = JSON.parse(result.stdout);
  } catch {
    failures.push(`${packageName}: npm returned an unreadable trust record`);
    continue;
  }

  for (const field of ['type', 'repository', 'file', 'environment']) {
    if (actual[field] !== contract[field]) {
      failures.push(`${packageName}: ${field} is ${actual[field] ?? 'missing'}`);
    }
  }
  for (const permission of contract.permissions) {
    if (!actual.permissions?.includes(permission)) {
      failures.push(`${packageName}: missing ${permission} permission`);
    }
  }
}

if (failures.length) {
  console.error(`Trusted publisher registry check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('npm confirms the trusted GitHub publisher for all seven packages.');
