import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSetupPlan, setupProject, uninstallProject } from './installer.js';

async function fixture(name: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `foundry-${name}-`));
}

async function skillFixture(): Promise<string> {
  const root = await fixture('skill');
  await mkdir(join(root, 'references'), { recursive: true });
  await mkdir(join(root, 'scripts'), { recursive: true });
  await writeFile(join(root, 'SKILL.md'), '# Foundry Design Control\n');
  await writeFile(join(root, 'references', 'workflow.md'), '# Workflow\n');
  await writeFile(join(root, 'scripts', 'foundry.sh'), '#!/usr/bin/env bash\n');
  return root;
}

test('sets up and reversibly removes Vite and all agent integrations', async () => {
  const root = await fixture('vite');
  const skillRoot = await skillFixture();
  await mkdir(join(root, 'src'), { recursive: true });
  await mkdir(join(root, '.codex'), { recursive: true });
  await mkdir(join(root, '.cursor'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ scripts: { dev: 'vite' }, devDependencies: { vite: '7.0.0' } }),
  );
  await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  await writeFile(join(root, 'src', 'main.ts'), "console.log('product');\n");
  await writeFile(join(root, '.gitignore'), 'coverage/\n');
  await writeFile(join(root, '.codex', 'config.toml'), 'model = "gpt-5.6"\n');
  await writeFile(
    join(root, '.cursor', 'mcp.json'),
    JSON.stringify({ mcpServers: { existing: { command: 'existing' } } }),
  );

  const plan = await createSetupPlan(root, {
    agents: ['codex', 'cursor', 'claude'],
    targetUrl: 'http://127.0.0.1:4173',
  });
  assert.equal(plan.framework, 'vite');
  assert.deepEqual(plan.devCommand, { command: 'pnpm', args: ['dev'] });

  await setupProject(root, {
    agents: ['codex', 'cursor', 'claude'],
    targetUrl: 'http://127.0.0.1:4173',
    packageRoot: '/opt/foundry',
    skillRoot,
  });
  const entry = await readFile(join(root, 'src', 'main.ts'), 'utf8');
  assert.match(entry, /Foundry Design Control/);
  assert.match(entry, /\.\.\/\.foundry\/web-adapter\.ts/);
  const codex = await readFile(join(root, '.codex', 'config.toml'), 'utf8');
  assert.match(codex, /model = "gpt-5\.6"/);
  assert.match(codex, /\[mcp_servers\.foundry-design-control\]/);
  assert.match(codex, /# >>> Foundry Design Control/);
  const cursor = JSON.parse(await readFile(join(root, '.cursor', 'mcp.json'), 'utf8'));
  assert.equal(cursor.mcpServers.existing.command, 'existing');
  assert.equal(cursor.mcpServers['foundry-design-control'].command, 'pnpm');
  const claude = JSON.parse(await readFile(join(root, '.mcp.json'), 'utf8'));
  assert.equal(claude.mcpServers['foundry-design-control'].command, 'pnpm');
  for (const path of [
    join(root, '.agents', 'skills', 'foundry-design-control', 'SKILL.md'),
    join(root, '.cursor', 'skills', 'foundry-design-control', 'SKILL.md'),
    join(root, '.claude', 'skills', 'foundry-design-control', 'SKILL.md'),
  ]) {
    assert.match(await readFile(path, 'utf8'), /Foundry Design Control/);
  }
  const config = JSON.parse(await readFile(join(root, '.foundry', 'foundry.config.json'), 'utf8'));
  assert.equal(config.version, 2);
  assert.equal(config.instrumented, true);
  assert.equal(config.targetUrl, 'http://127.0.0.1:4173');
  assert.deepEqual(
    config.design.viewports.map((viewport: { id: string }) => viewport.id),
    ['mobile', 'tablet', 'desktop'],
  );

  await writeFile(
    join(root, '.foundry', 'web-adapter.ts'),
    `${await readFile(join(root, '.foundry', 'web-adapter.ts'), 'utf8')}\n// user edit\n`,
  );
  const result = await uninstallProject(root);
  assert.deepEqual(result.preserved, [join(root, '.foundry', 'web-adapter.ts')]);
  assert.doesNotMatch(await readFile(join(root, 'src', 'main.ts'), 'utf8'), /Foundry/);
  assert.doesNotMatch(await readFile(join(root, '.codex', 'config.toml'), 'utf8'), /foundry/);
  const cursorAfter = JSON.parse(await readFile(join(root, '.cursor', 'mcp.json'), 'utf8'));
  assert.equal(cursorAfter.mcpServers.existing.command, 'existing');
  assert.equal(cursorAfter.mcpServers['foundry-design-control'], undefined);
  for (const path of [
    join(root, '.agents', 'skills', 'foundry-design-control', 'SKILL.md'),
    join(root, '.cursor', 'skills', 'foundry-design-control', 'SKILL.md'),
    join(root, '.claude', 'skills', 'foundry-design-control', 'SKILL.md'),
  ]) {
    await assert.rejects(readFile(path, 'utf8'));
  }
});

test('uses the public beta MCP package outside the monorepo', async () => {
  const root = await fixture('public-mcp');
  const skillRoot = await skillFixture();
  await writeFile(join(root, 'package.json'), JSON.stringify({}));
  await setupProject(root, { agents: ['cursor'], skillRoot });
  const cursor = JSON.parse(await readFile(join(root, '.cursor', 'mcp.json'), 'utf8'));
  assert.deepEqual(cursor.mcpServers['foundry-design-control'].args, [
    '-y',
    'foundry-design-mcp-server@beta',
  ]);
});

test('does not overwrite an existing project skill', async () => {
  const root = await fixture('existing-skill');
  const skillRoot = await skillFixture();
  const target = join(root, '.agents', 'skills', 'foundry-design-control');
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'SKILL.md'), '# My customized Foundry skill\n');
  await writeFile(join(root, 'package.json'), JSON.stringify({}));
  await assert.rejects(
    setupProject(root, { agents: ['codex'], skillRoot }),
    /Foundry skill already exists/,
  );
  assert.match(await readFile(join(target, 'SKILL.md'), 'utf8'), /customized/);
  await assert.rejects(readFile(join(root, '.foundry', 'foundry.config.json'), 'utf8'));
});

test('integrates and removes a Next.js App Router loader', async () => {
  const root = await fixture('next');
  await mkdir(join(root, 'app'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ scripts: { dev: 'next dev' }, dependencies: { next: '16.0.0' } }),
  );
  const original = `export default function Layout({ children }) {
  return <html><body className="app">{children}</body></html>;
}
`;
  await writeFile(join(root, 'app', 'layout.tsx'), original);
  await setupProject(root, { agents: [] });
  const layout = await readFile(join(root, 'app', 'layout.tsx'), 'utf8');
  assert.match(layout, /import \{ FoundryLoader \}/);
  assert.match(layout, /<FoundryLoader \/>/);
  assert.match(await readFile(join(root, 'app', 'foundry-loader.tsx'), 'utf8'), /webpackIgnore/);
  await uninstallProject(root);
  const restored = await readFile(join(root, 'app', 'layout.tsx'), 'utf8');
  assert.doesNotMatch(restored, /FoundryLoader/);
  await assert.rejects(readFile(join(root, 'app', 'foundry-loader.tsx'), 'utf8'));
});

test('reports generic web projects as not yet instrumented', async () => {
  const root = await fixture('generic');
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { dev: 'custom-dev' } }));
  const result = await setupProject(root, { agents: [] });
  assert.equal(result.framework, 'generic');
  const config = JSON.parse(await readFile(join(root, '.foundry', 'foundry.config.json'), 'utf8'));
  assert.equal(config.instrumented, false);
});
