import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const artifactDirectory = resolve(root, 'artifacts/npm');
const matrixRoot = mkdtempSync(join(tmpdir(), 'foundry-packed-install-'));
const agents = ['codex', 'cursor', 'claude'];
const releaseVersion = JSON.parse(
  readFileSync(join(root, 'packages', 'cli', 'package.json'), 'utf8'),
).version;
const publicMcpSpec = `foundry-design-mcp-server@${releaseVersion}`;

function run(cwd, command, args, environment = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      INIT_CWD: cwd,
      npm_config_cache: join(matrixRoot, '.npm-cache'),
      ...environment,
    },
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runExpectFailure(cwd, command, args, environment = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      INIT_CWD: cwd,
      npm_config_cache: join(matrixRoot, '.npm-cache'),
      ...environment,
    },
    encoding: 'utf8',
  });
  if (result.status === 0) throw new Error(`Expected ${command} ${args.join(' ')} to fail.`);
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function expectedPaths(agent) {
  if (agent === 'codex') {
    return {
      skill: '.agents/skills/foundry-design-control/SKILL.md',
      config: '.codex/config.toml',
    };
  }
  if (agent === 'cursor') {
    return {
      skill: '.cursor/skills/foundry-design-control/SKILL.md',
      config: '.cursor/mcp.json',
    };
  }
  return {
    skill: '.claude/skills/foundry-design-control/SKILL.md',
    config: '.mcp.json',
  };
}

function assertAgentInstall(fixture, agent) {
  const expected = expectedPaths(agent);
  for (const path of [expected.skill, expected.config, '.foundry/install-manifest.json']) {
    if (!existsSync(join(fixture, path))) throw new Error(`${agent} setup did not install ${path}`);
  }
  for (const other of agents.filter((candidate) => candidate !== agent)) {
    const otherSkill = expectedPaths(other).skill;
    if (existsSync(join(fixture, otherSkill))) {
      throw new Error(`${agent} setup unexpectedly installed ${otherSkill}`);
    }
  }
  const config = readFileSync(join(fixture, expected.config), 'utf8');
  if (!config.includes(publicMcpSpec)) {
    throw new Error(`${agent} setup did not configure ${publicMcpSpec}.`);
  }
}

try {
  const tarballs = readdirSync(artifactDirectory)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => join(artifactDirectory, name));
  if (tarballs.length !== 7) throw new Error(`Expected 7 tarballs, found ${tarballs.length}`);

  for (const agent of agents) {
    const fixture = join(matrixRoot, agent);
    const isolatedHome = join(matrixRoot, `home-${agent}`);
    mkdirSync(fixture, { recursive: true });
    mkdirSync(isolatedHome, { recursive: true });
    writeFileSync(
      join(fixture, 'package.json'),
      `${JSON.stringify({
        name: `foundry-${agent}-release-fixture`,
        private: true,
        type: 'module',
        scripts: { dev: 'node server.mjs' },
      })}\n`,
    );
    writeFileSync(join(fixture, 'index.html'), '<main>Unrelated product</main>\n');

    const isolatedEnvironment = { HOME: isolatedHome };
    run(fixture, 'npm', ['install', '--ignore-scripts', ...tarballs], isolatedEnvironment);
    run(
      fixture,
      'node',
      ['node_modules/foundry-design/dist/index.js', '--help'],
      isolatedEnvironment,
    );
    run(
      fixture,
      'node',
      ['node_modules/foundry-design/dist/index.js', 'setup', '--agent', agent, '--yes'],
      isolatedEnvironment,
    );
    assertAgentInstall(fixture, agent);
    run(
      fixture,
      'node',
      ['node_modules/foundry-design/dist/index.js', 'doctor'],
      isolatedEnvironment,
    );

    const customizedSkill = join(fixture, expectedPaths(agent).skill);
    writeFileSync(
      customizedSkill,
      `${readFileSync(customizedSkill, 'utf8')}\n<!-- project note -->\n`,
    );
    run(
      fixture,
      'node',
      ['node_modules/foundry-design/dist/index.js', 'update', '--agent', agent, '--yes'],
      isolatedEnvironment,
    );
    if (!readFileSync(customizedSkill, 'utf8').includes('project note')) {
      throw new Error(`${agent} update overwrote a customized skill file.`);
    }
    run(
      fixture,
      'node',
      ['node_modules/foundry-design/dist/index.js', 'uninstall', '--yes'],
      isolatedEnvironment,
    );
    if (!existsSync(customizedSkill)) {
      throw new Error(`${agent} uninstall removed a customized skill file.`);
    }
  }

  const pluginFixture = join(matrixRoot, 'plugin-provided');
  mkdirSync(pluginFixture, { recursive: true });
  writeFileSync(
    join(pluginFixture, 'package.json'),
    '{"name":"foundry-plugin-fixture","private":true,"type":"module","scripts":{"dev":"node server.mjs"}}\n',
  );
  writeFileSync(join(pluginFixture, 'index.html'), '<main>Plugin product</main>\n');
  run(pluginFixture, 'npm', ['install', '--ignore-scripts', ...tarballs]);
  const hostFixture = join(matrixRoot, 'host');
  run(pluginFixture, 'node', ['node_modules/foundry-design/dist/index.js', 'install', '--yes'], {
    HOME: hostFixture,
  });
  run(pluginFixture, 'node', ['node_modules/foundry-design/dist/index.js', '--yes', '--no-start'], {
    HOME: hostFixture,
  });
  for (const path of ['.codex/config.toml', '.cursor/mcp.json', '.mcp.json']) {
    if (existsSync(join(pluginFixture, path))) {
      throw new Error(`Plugin-provided setup unexpectedly created ${path}`);
    }
  }

  for (const path of [
    '.codex/config.toml',
    '.codex/skills/foundry-design-control/SKILL.md',
    '.cursor/mcp.json',
    '.cursor/skills/foundry-design-control/SKILL.md',
    '.claude.json',
    '.claude/skills/foundry-design-control/SKILL.md',
    '.foundry/companion.json',
  ]) {
    if (!existsSync(join(hostFixture, path))) {
      throw new Error(`Shared agent installation did not create ${path}`);
    }
  }

  const accidentalHome = join(matrixRoot, 'accidental-home');
  mkdirSync(accidentalHome, { recursive: true });
  const homeFailure = runExpectFailure(
    accidentalHome,
    'node',
    [join(pluginFixture, 'node_modules/foundry-design/dist/index.js'), 'doctor'],
    { HOME: accidentalHome },
  );
  if (!homeFailure.includes('will not use your home folder as a project')) {
    throw new Error('Home-folder guard did not explain how to open a real project.');
  }

  const bundledSkill = join(
    pluginFixture,
    'node_modules',
    'foundry-design',
    'dist',
    'skill',
    'foundry-design-control',
    'SKILL.md',
  );
  if (!readFileSync(bundledSkill, 'utf8').includes('Foundry Design Control')) {
    throw new Error('The CLI package is missing its bundled skill.');
  }
  const bundledRunner = join(
    pluginFixture,
    'node_modules',
    'foundry-design',
    'dist',
    'skill',
    'foundry-design-control',
    'scripts',
    'foundry.sh',
  );
  const runner = readFileSync(bundledRunner, 'utf8');
  if (!runner.includes('--prefer-online --package=foundry-design@latest')) {
    throw new Error('The bundled skill launcher does not revalidate the latest Foundry release.');
  }
  if (runner.includes('command -v foundry-design')) {
    throw new Error('The bundled skill launcher can still select a stale global Foundry binary.');
  }
  run(pluginFixture, 'node', [
    '--input-type=module',
    '--eval',
    "await import('foundry-design-protocol'); await import('foundry-design-runtime'); await import('foundry-design-web-adapter'); await import('foundry-design-react-native-adapter');",
  ]);
  console.log('Clean packed installation matrix passed for Codex, Cursor, and Claude Code.');
} finally {
  rmSync(matrixRoot, { recursive: true, force: true });
}
