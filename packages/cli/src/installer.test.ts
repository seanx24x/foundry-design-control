import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createSetupPlan,
  createUpdatePlan,
  installHostAgentIntegration,
  installAgentIntegration,
  setupProject,
  uninstallProject,
  updateProject,
} from './installer.js';

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
  const adapter = await readFile(join(root, '.foundry', 'web-adapter.ts'), 'utf8');
  assert.match(adapter, /const adapter = await import/);
  assert.doesNotMatch(adapter, /const module =/);

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

test('installs reusable host integrations without touching a project', async () => {
  const home = await fixture('host-agent');
  const skillRoot = await skillFixture();

  for (const agent of ['codex', 'cursor', 'claude'] as const) {
    const result = await installHostAgentIntegration(home, agent, { skillRoot });
    assert.match(await readFile(join(result.skillDirectory, 'SKILL.md'), 'utf8'), /Foundry/);
    const config = await readFile(result.configFile, 'utf8');
    assert.match(config, /foundry-design-mcp-server@beta/);
  }

  const codex = await readFile(join(home, '.codex', 'config.toml'), 'utf8');
  assert.match(codex, /\[mcp_servers\.foundry-design-control\]/);
  const cursor = JSON.parse(await readFile(join(home, '.cursor', 'mcp.json'), 'utf8'));
  assert.equal(cursor.mcpServers['foundry-design-control'].command, 'npx');
  const claude = JSON.parse(await readFile(join(home, '.claude.json'), 'utf8'));
  assert.equal(claude.mcpServers['foundry-design-control'].command, 'npx');

  const customized = join(home, '.codex', 'skills', 'foundry-design-control', 'SKILL.md');
  await writeFile(customized, '# Foundry Design Control\n\nProject note.\n');
  const updated = await installHostAgentIntegration(home, 'codex', { skillRoot });
  assert.deepEqual(updated.preserved, [customized]);
  assert.match(await readFile(customized, 'utf8'), /Project note/);
});

test('prioritizes the active coding agent over stale project configuration', async () => {
  const root = await fixture('active-agent');
  await writeFile(join(root, 'package.json'), JSON.stringify({}));
  await writeFile(join(root, '.mcp.json'), JSON.stringify({ mcpServers: {} }));
  const plan = await createSetupPlan(root, {
    environment: { CODEX_THREAD_ID: 'thread-1' },
  });
  assert.deepEqual(plan.agents, ['codex']);
  assert.ok(plan.files.includes(join(root, '.codex', 'config.toml')));
});

test('installs Codex MCP configuration directly instead of writing a merge snippet', async () => {
  const root = await fixture('codex-agent');
  await mkdir(join(root, '.codex'), { recursive: true });
  await writeFile(join(root, '.codex', 'config.toml'), 'model = "gpt-5.6"\n');
  const path = await installAgentIntegration(root, 'codex');
  assert.equal(path, join(root, '.codex', 'config.toml'));
  const config = await readFile(path, 'utf8');
  assert.match(config, /model = "gpt-5\.6"/);
  assert.match(config, /\[mcp_servers\.foundry-design-control\]/);
  assert.match(config, /foundry-design-mcp-server@beta/);
  await assert.rejects(readFile(join(root, '.codex', 'foundry-mcp.toml'), 'utf8'));
});

test('updates an existing plugin-only install for the active agent and is repeatable', async () => {
  const root = await fixture('update');
  const skillRoot = await skillFixture();
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { vite: '7.0.0' } }));
  await writeFile(join(root, 'src', 'main.ts'), "console.log('product');\n");
  await setupProject(root, { agents: [], skillRoot });

  await writeFile(join(skillRoot, 'SKILL.md'), '# Foundry Design Control v2\n');
  const plan = await createUpdatePlan(root, {
    environment: { CODEX_THREAD_ID: 'thread-1' },
    skillRoot,
  });
  assert.deepEqual(plan.agents, ['codex']);
  const first = await updateProject(root, {
    environment: { CODEX_THREAD_ID: 'thread-1' },
    skillRoot,
  });
  assert.deepEqual(first.preserved, []);
  assert.match(
    await readFile(join(root, '.agents', 'skills', 'foundry-design-control', 'SKILL.md'), 'utf8'),
    /v2/,
  );
  assert.match(await readFile(join(root, '.codex', 'config.toml'), 'utf8'), /mcp_servers/);
  const manifest = JSON.parse(
    await readFile(join(root, '.foundry', 'install-manifest.json'), 'utf8'),
  );
  assert.deepEqual(manifest.agents, ['codex']);
  assert.equal(typeof manifest.updatedAt, 'string');

  const second = await updateProject(root, {
    environment: { CODEX_THREAD_ID: 'thread-1' },
    skillRoot,
  });
  assert.deepEqual(second.preserved, []);
});

test('requires setup before update', async () => {
  const root = await fixture('update-missing');
  await writeFile(join(root, 'package.json'), JSON.stringify({}));
  await assert.rejects(createUpdatePlan(root), /Run setup first/);
  await assert.rejects(updateProject(root), /Run setup first/);
});

test('retains configured preview and runtime URLs during update', async () => {
  const root = await fixture('update-urls');
  const skillRoot = await skillFixture();
  await writeFile(join(root, 'package.json'), JSON.stringify({}));
  await setupProject(root, {
    agents: ['codex'],
    runtimeUrl: 'http://127.0.0.1:4487',
    targetUrl: 'http://127.0.0.1:4490',
    skillRoot,
  });

  await updateProject(root, { agents: ['codex'], skillRoot });
  const config = JSON.parse(await readFile(join(root, '.foundry', 'foundry.config.json'), 'utf8'));
  assert.equal(config.runtimeUrl, 'http://127.0.0.1:4487');
  assert.equal(config.targetUrl, 'http://127.0.0.1:4490');
});

test('preserves customized skill files while refreshing unchanged siblings', async () => {
  const root = await fixture('update-preserve');
  const skillRoot = await skillFixture();
  await writeFile(join(root, 'package.json'), JSON.stringify({}));
  await setupProject(root, { agents: ['codex'], skillRoot });
  const installedRoot = join(root, '.agents', 'skills', 'foundry-design-control');
  const customized = join(installedRoot, 'SKILL.md');
  await writeFile(customized, '# My customized Foundry workflow\n');
  await writeFile(join(skillRoot, 'SKILL.md'), '# Foundry Design Control v2\n');
  await writeFile(join(skillRoot, 'references', 'workflow.md'), '# Updated workflow\n');

  const result = await updateProject(root, { agents: ['codex'], skillRoot });
  assert.deepEqual(result.preserved, [customized]);
  assert.match(await readFile(customized, 'utf8'), /customized/);
  assert.match(await readFile(join(installedRoot, 'references', 'workflow.md'), 'utf8'), /Updated/);
});

test('rolls back an update when refreshed integration introduces a validation failure', async () => {
  const root = await fixture('update-rollback');
  const skillRoot = await skillFixture();
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      scripts: {
        typecheck: `node -e "const fs=require('fs');const p='.agents/skills/foundry-design-control/SKILL.md';if(fs.existsSync(p)&&fs.readFileSync(p,'utf8').includes('v2'))process.exit(1)"`,
      },
    }),
  );
  await setupProject(root, { agents: ['codex'], skillRoot });
  const installed = join(root, '.agents', 'skills', 'foundry-design-control', 'SKILL.md');
  const before = await readFile(installed, 'utf8');
  await writeFile(join(skillRoot, 'SKILL.md'), '# Foundry Design Control v2\n');

  await assert.rejects(
    updateProject(root, { agents: ['codex'], skillRoot }),
    /introduced a typecheck failure/,
  );
  assert.equal(await readFile(installed, 'utf8'), before);
  await assert.rejects(readFile(join(root, '.foundry', 'setup-transaction.json'), 'utf8'));
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
  const loader = await readFile(join(root, 'app', 'foundry-loader.tsx'), 'utf8');
  assert.match(loader, /adapter-bootstrap\.js/);
  assert.doesNotMatch(loader, /import\(.*127\.0\.0\.1/);
  const manifest = JSON.parse(
    await readFile(join(root, '.foundry', 'install-manifest.json'), 'utf8'),
  );
  assert.equal(manifest.version, 2);
  assert.equal(manifest.generatorVersion, '0.2.0-beta.8');
  assert.equal(manifest.validation.length, 2);
  await uninstallProject(root);
  const restored = await readFile(join(root, 'app', 'layout.tsx'), 'utf8');
  assert.doesNotMatch(restored, /FoundryLoader/);
  await assert.rejects(readFile(join(root, 'app', 'foundry-loader.tsx'), 'utf8'));
});

test('rolls back every managed file when setup introduces a project failure', async () => {
  const root = await fixture('rollback');
  await mkdir(join(root, 'app'), { recursive: true });
  const original = `export default function Layout({ children }) {
  return <html><body>{children}</body></html>;
}
`;
  await writeFile(join(root, 'app', 'layout.tsx'), original);
  await writeFile(join(root, '.gitignore'), 'coverage/\n');
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      scripts: {
        typecheck:
          "node -e \"const fs=require('fs');if(fs.existsSync('app/foundry-loader.tsx')){console.error('app/foundry-loader.tsx: generated failure');process.exit(1)}\"",
      },
      dependencies: { next: '16.0.0' },
    }),
  );

  await assert.rejects(setupProject(root, { agents: [] }), /introduced a typecheck failure/);
  assert.equal(await readFile(join(root, 'app', 'layout.tsx'), 'utf8'), original);
  assert.equal(await readFile(join(root, '.gitignore'), 'utf8'), 'coverage/\n');
  await assert.rejects(readFile(join(root, 'app', 'foundry-loader.tsx'), 'utf8'));
  await assert.rejects(readFile(join(root, '.foundry', 'install-manifest.json'), 'utf8'));
  await assert.rejects(readFile(join(root, '.foundry', 'setup-transaction.json'), 'utf8'));
});

test('recovers an interrupted setup before applying a new transaction', async () => {
  const root = await fixture('recover');
  await mkdir(join(root, 'app'), { recursive: true });
  await mkdir(join(root, '.foundry'), { recursive: true });
  const original = `export default function Layout({ children }) {
  return <html><body data-recovered>{children}</body></html>;
}
`;
  const layout = join(root, 'app', 'layout.tsx');
  await writeFile(layout, 'interrupted setup content\n');
  await writeFile(
    join(root, '.foundry', 'setup-transaction.json'),
    `${JSON.stringify({
      version: 1,
      root,
      snapshots: [{ path: layout, content: Buffer.from(original).toString('base64') }],
    })}\n`,
  );
  await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { next: '16.0.0' } }));

  await setupProject(root, { agents: [] });
  const integrated = await readFile(layout, 'utf8');
  assert.match(integrated, /data-recovered/);
  assert.doesNotMatch(integrated, /interrupted setup content/);
  await assert.rejects(readFile(join(root, '.foundry', 'setup-transaction.json'), 'utf8'));
});

test('migrates the known beta Next.js loader repair without treating it as a user edit', async () => {
  const root = await fixture('legacy-loader');
  await mkdir(join(root, 'app'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { next: '16.0.0' } }));
  await writeFile(
    join(root, 'app', 'layout.tsx'),
    'export default function Layout({ children }) { return <html><body>{children}</body></html>; }\n',
  );
  await setupProject(root, { agents: [] });
  const loader = join(root, 'app', 'foundry-loader.tsx');
  await writeFile(
    loader,
    `'use client';

import { useEffect } from 'react';

export function FoundryLoader(): null {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (!query.has('__foundry_session')) return;
    // @ts-expect-error The Foundry adapter is served by the local runtime during an active session.
    void import(/* webpackIgnore: true */ 'http://127.0.0.1:4387/adapter.js').then((module) =>
      module.installFoundryInspector(),
    );
  }, []);
  return null;
}
`,
  );
  const manifestPath = join(root, '.foundry', 'install-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.version = 1;
  delete manifest.generatorVersion;
  delete manifest.validation;
  const loaderEntry = manifest.generatedFiles.find(
    (file: { path: string }) => file.path === loader,
  );
  loaderEntry.sha256 = 'ec45810b798224907a947c3bf9e01e5e342b64f506c910a35f08fdc0399aac0e';
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  await setupProject(root, { agents: [] });
  assert.match(await readFile(loader, 'utf8'), /adapter-bootstrap\.js/);
});

test('reports generic web projects as not yet instrumented', async () => {
  const root = await fixture('generic');
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { dev: 'custom-dev' } }));
  const result = await setupProject(root, { agents: [] });
  assert.equal(result.framework, 'generic');
  const config = JSON.parse(await readFile(join(root, '.foundry', 'foundry.config.json'), 'utf8'));
  assert.equal(config.instrumented, false);
});
