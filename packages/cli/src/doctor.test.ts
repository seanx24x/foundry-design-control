import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SessionStore } from 'foundry-design-runtime';
import { collectDoctorReport } from './doctor.js';
import { FOUNDRY_MCP_PACKAGE_SPEC, FOUNDRY_VERSION } from './release.js';

test('distinguishes configured MCP from a live agent listener', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-doctor-project-'));
  const home = await mkdtemp(join(tmpdir(), 'foundry-doctor-home-'));
  const sessions = await mkdtemp(join(tmpdir(), 'foundry-doctor-sessions-'));
  await mkdir(join(root, '.foundry'), { recursive: true });
  await mkdir(join(home, '.codex'), { recursive: true });
  await writeFile(join(root, 'package.json'), '{"scripts":{"dev":"vite"}}\n');
  await writeFile(
    join(root, '.foundry', 'foundry.config.json'),
    JSON.stringify({ platform: 'web', targetUrl: 'http://127.0.0.1:4390', instrumented: true }),
  );
  await writeFile(
    join(root, '.foundry', 'install-manifest.json'),
    JSON.stringify({ generatorVersion: FOUNDRY_VERSION }),
  );
  await writeFile(
    join(home, '.codex', 'config.toml'),
    `[mcp_servers.foundry-design-control]\ncommand = "npx"\nargs = ["-y", "${FOUNDRY_MCP_PACKAGE_SPEC}"]\n`,
  );
  const store = new SessionStore(sessions);
  await store.create({
    projectRoot: root,
    platform: 'web',
    targetUrl: 'http://127.0.0.1:4390',
    theme: 'system',
    breakpoint: 'current',
    state: 'current',
  });
  const report = await collectDoctorReport(root, {
    home,
    store,
    fetcher: async (input) =>
      new Response(
        String(input).endsWith('/v1/health') || String(input).includes(':4390')
          ? JSON.stringify({ ok: true })
          : JSON.stringify({ connected: false, presence: null }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  });
  assert.equal(report.checks.find((check) => check.id === 'agent-configured')?.status, 'passed');
  assert.equal(report.checks.find((check) => check.id === 'agent-listening')?.status, 'warning');
  assert.equal(report.ready, false);
});

test('warns when an installed agent points at a different package version', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-doctor-version-project-'));
  const home = await mkdtemp(join(tmpdir(), 'foundry-doctor-version-home-'));
  await mkdir(join(home, '.claude'), { recursive: true });
  await writeFile(join(root, 'package.json'), '{}\n');
  await writeFile(
    join(home, '.claude.json'),
    JSON.stringify({ mcpServers: { 'foundry-design-control': { args: ['old-version'] } } }),
  );
  const report = await collectDoctorReport(root, {
    home,
    store: new SessionStore(join(root, 'sessions')),
    fetcher: async () => new Response('{}', { status: 503 }),
  });
  assert.equal(report.checks.find((check) => check.id === 'agent-version')?.status, 'warning');
});

test('reports a bare shared MCP object that can prevent Claude from loading every server', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-doctor-claude-project-'));
  const home = await mkdtemp(join(tmpdir(), 'foundry-doctor-claude-home-'));
  await writeFile(join(root, 'package.json'), '{}\n');
  await writeFile(
    join(home, '.claude.json'),
    JSON.stringify({
      mcpServers: {
        'foundry-design-control': { args: [FOUNDRY_MCP_PACKAGE_SPEC] },
      },
    }),
  );
  await writeFile(join(home, '.mcp.json'), '{}\n');
  const report = await collectDoctorReport(root, {
    home,
    store: new SessionStore(join(root, 'sessions')),
    fetcher: async () => new Response('{}', { status: 503 }),
  });
  const schema = report.checks.find((check) => check.id === 'agent-config-valid');
  assert.equal(schema?.status, 'failed');
  assert.match(schema?.detail ?? '', /\.mcp\.json/);
  assert.equal(report.ready, false);
});

test('deduplicates host and project agent paths when the project is the home folder', async () => {
  const home = await mkdtemp(join(tmpdir(), 'foundry-doctor-dedupe-'));
  await mkdir(join(home, '.codex'), { recursive: true });
  await writeFile(join(home, 'package.json'), '{}\n');
  await writeFile(
    join(home, '.codex', 'config.toml'),
    `[mcp_servers.foundry-design-control]\ncommand = "npx"\nargs = ["-y", "${FOUNDRY_MCP_PACKAGE_SPEC}"]\n`,
  );
  const report = await collectDoctorReport(home, {
    home,
    store: new SessionStore(join(home, 'sessions')),
    fetcher: async () => new Response('{}', { status: 503 }),
  });
  assert.deepEqual(report.configuredAgentFiles, [join(home, '.codex', 'config.toml')]);
});
