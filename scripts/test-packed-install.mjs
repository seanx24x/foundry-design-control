import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const artifactDirectory = resolve(root, 'artifacts/npm');
const fixture = mkdtempSync(join(tmpdir(), 'foundry-packed-install-'));

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: fixture,
    env: {
      ...process.env,
      INIT_CWD: fixture,
      npm_config_cache: join(fixture, '.npm-cache'),
    },
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  writeFileSync(
    join(fixture, 'package.json'),
    '{"name":"foundry-release-fixture","private":true,"type":"module"}\n',
  );
  const tarballs = readdirSync(artifactDirectory)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => join(artifactDirectory, name));
  if (tarballs.length !== 7) throw new Error(`Expected 7 tarballs, found ${tarballs.length}`);

  run('npm', ['install', '--ignore-scripts', ...tarballs]);
  run('node', ['node_modules/foundry-design/dist/index.js', '--help']);
  const bundledSkill = join(
    fixture,
    'node_modules',
    'foundry-design',
    'dist',
    'skill',
    'foundry-design-control',
    'SKILL.md',
  );
  if (!existsSync(bundledSkill)) throw new Error('The CLI package is missing its bundled skill.');
  if (!readFileSync(bundledSkill, 'utf8').includes('Foundry Design Control')) {
    throw new Error('The bundled Foundry skill is invalid.');
  }
  run('node', [
    'node_modules/foundry-design/dist/index.js',
    'setup',
    '--agent',
    'codex,cursor,claude',
    '--yes',
  ]);
  for (const path of [
    '.agents/skills/foundry-design-control/SKILL.md',
    '.cursor/skills/foundry-design-control/SKILL.md',
    '.claude/skills/foundry-design-control/SKILL.md',
  ]) {
    if (!existsSync(join(fixture, path))) throw new Error(`Setup did not install ${path}`);
  }
  run('node', ['node_modules/foundry-design/dist/index.js', 'uninstall', '--yes']);
  for (const path of [
    '.agents/skills/foundry-design-control/SKILL.md',
    '.cursor/skills/foundry-design-control/SKILL.md',
    '.claude/skills/foundry-design-control/SKILL.md',
  ]) {
    if (existsSync(join(fixture, path))) throw new Error(`Uninstall left behind ${path}`);
  }
  run('node', [
    '--input-type=module',
    '--eval',
    "await import('foundry-design-protocol'); await import('foundry-design-runtime'); await import('foundry-design-web-adapter'); await import('foundry-design-react-native-adapter');",
  ]);
  console.log('Clean packed installation passed.');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
