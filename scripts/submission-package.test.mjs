import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { createInterface } from 'node:readline';
import test from 'node:test';
import { buildSubmission, root } from './build-openai-submission.mjs';

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const files = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    assert.equal(lstatSync(path).isSymbolicLink(), false, `No symlinks: ${path}`);
    return entry.isDirectory() ? files(path) : [path];
  });

test('desktop candidate is self-contained, isolated and honest about review gates', async (t) => {
  const candidate = await buildSubmission();
  const temporary = mkdtempSync(join(tmpdir(), 'foundry-submission-test-'));
  try {
    const extracted = join(temporary, 'unpacked');
    mkdirSync(extracted);
    execFileSync('unzip', ['-q', candidate.zip, '-d', extracted]);
    const manifest = json(join(extracted, 'plugin.json'));
    const extension = manifest.extensions['com.openai'];
    await t.test('root manifest and listing metadata match the desktop route', () => {
      assert.equal(extension.requires_local_executor, true);
      assert.ok(extension.interface.shortDescription.length <= 30);
      assert.ok(extension.interface.displayName.length <= 30);
      assert.ok(extension.interface.longDescription.length <= 4000);
      for (const key of ['logo', 'composerIcon'])
        assert.ok(existsSync(join(extracted, extension.interface[key])));
      for (const key of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL'])
        assert.equal(new URL(extension.interface[key]).protocol, 'https:');
      assert.equal(extension.review.test_cases.positive.length, 5);
      assert.equal(extension.review.test_cases.negative.length, 3);
      assert.equal(manifest.repository, 'https://github.com/seanx24x/foundry-design-control');
      assert.equal(candidate.report.status, 'candidate-not-submitted');
      assert.ok(
        candidate.report.outstanding.includes('OpenAI organization allowlist confirmation'),
      );
    });
    await t.test('ZIP excludes lifecycle hooks, app references, private paths and sessions', () => {
      for (const path of [
        'hooks',
        'commands',
        '.app.json',
        '.mcp.json',
        '.codex-plugin',
        '.claude-plugin',
        '.cursor-plugin',
        'node_modules',
        'provenance.json',
        '.foundry',
      ])
        assert.equal(existsSync(join(extracted, path)), false, path);
      assert.equal(extension.hooks, undefined);
      assert.equal(extension.apps, undefined);
      for (const path of files(extracted)) {
        if (/\.svg$/.test(path)) continue;
        const source = readFileSync(path, 'utf8');
        assert.doesNotMatch(source, /\/Users\/seanlynch|[?&]__foundry_token=|[?&]session=ses_/);
      }
    });
    await t.test('dependency code, sources, licensing and input hashes are retained', () => {
      for (const path of [
        'server/index.mjs',
        'server/index.mjs.map',
        'THIRD_PARTY_NOTICES.md',
        'LICENSE',
        'PRIVACY.md',
        'TERMS.md',
      ])
        assert.ok(existsSync(join(extracted, path)), path);
      assert.ok(
        candidate.report.dependencies.some(({ name }) => name === '@modelcontextprotocol/server'),
      );
      assert.ok(candidate.report.dependencies.some(({ name }) => name === 'zod'));
      for (const input of candidate.report.inputs) assert.match(input.sha256, /^[a-f0-9]{64}$/);
      assert.match(candidate.report.sha256, /^[a-f0-9]{64}$/);
      assert.ok(
        readFileSync(join(extracted, 'README.md'), 'utf8').includes(
          `foundry-design@${manifest.version}`,
        ),
      );
    });
    await t.test('skill helper forwards arguments to the exact CLI without running npm', () => {
      const bin = join(temporary, 'bin');
      mkdirSync(bin);
      const stub = join(bin, 'npx');
      writeFileSync(stub, '#!/bin/sh\nprintf "%s\\n" "$@"\n');
      chmodSync(stub, 0o755);
      const helper = join(extracted, 'skills/foundry-design-control/scripts/foundry.sh');
      const result = execFileSync('bash', [helper, 'doctor', '--project', '/disposable project'], {
        cwd: temporary,
        env: { PATH: `${bin}:/usr/bin:/bin` },
        encoding: 'utf8',
      });
      assert.deepEqual(result.trim().split('\n'), [
        '-y',
        '--prefer-online',
        `--package=foundry-design@${manifest.version}`,
        'foundry-design',
        'doctor',
        '--project',
        '/disposable project',
      ]);
    });
    await t.test(
      'unpacked bridge starts and lists real tools without a runtime or workspace access',
      async () => {
        const config = json(join(extracted, 'mcp.json')).mcpServers['foundry-design-control'];
        assert.equal(config.type, 'stdio');
        assert.equal(config.command, 'node');
        assert.equal(config.cwd, '${PLUGIN_ROOT}');
        const args = config.args.map((arg) => arg.replaceAll('${PLUGIN_ROOT}', extracted));
        const child = spawn(process.execPath, args, {
          cwd: temporary,
          env: { PATH: process.env.PATH },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const pending = new Map();
        let errors = '';
        child.stderr.on('data', (chunk) => {
          errors += chunk;
        });
        const lines = createInterface({ input: child.stdout });
        lines.on('line', (line) => {
          const message = JSON.parse(line);
          pending.get(message.id)?.(message);
        });
        const request = (id, method, params) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error(`MCP ${method} timeout: ${errors}`)),
              10000,
            );
            pending.set(id, (message) => {
              clearTimeout(timer);
              pending.delete(id);
              message.error
                ? reject(new Error(JSON.stringify(message.error)))
                : resolve(message.result);
            });
            child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
          });
        try {
          const initialized = await request(1, 'initialize', {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'submission-structural-smoke', version: '1' },
          });
          assert.equal(initialized.serverInfo.version, manifest.version);
          child.stdin.write(
            `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
          );
          const result = await request(2, 'tools/list', {});
          const names = result.tools.map(({ name }) => name);
          for (const name of [
            'foundry_design_wait_for_work',
            'foundry_design_get_change_set',
            'foundry_design_record_apply_result',
          ])
            assert.ok(names.includes(name), name);
          assert.ok(names.length > 10);
          console.log(`Unpacked bridge discovered ${names.length} tools; no tools invoked.`);
        } finally {
          lines.close();
          child.kill();
        }
      },
    );
    await t.test('Claude source stays within file and prose limits', () => {
      const plugin = join(root, 'plugins/foundry-design-control');
      const list = files(plugin);
      assert.ok(list.length <= 512);
      for (const path of list) assert.ok(lstatSync(path).size < 256 * 1024, relative(plugin, path));
      const readme = readFileSync(join(plugin, 'README.md'), 'utf8').replace(/```[\s\S]*?```/g, '');
      assert.ok(readme.split(/\s+/).length >= 40);
      assert.equal(json(join(plugin, '.claude-plugin/plugin.json')).license, 'MIT');
      for (const path of ['.mcp.json', 'mcp.json'])
        assert.ok(
          json(join(plugin, path)).mcpServers['foundry-design-control'].args.includes(
            `foundry-design-mcp-server@${manifest.version}`,
          ),
        );
      const canonical = join(root, 'skills/foundry-design-control');
      for (const path of files(canonical)) {
        const localPath = relative(canonical, path);
        const source = readFileSync(path, 'utf8');
        const expected =
          localPath === join('scripts', 'foundry.sh')
            ? source.replace(
                '--package=foundry-design@latest',
                `--package=foundry-design@${manifest.version}`,
              )
            : source;
        assert.equal(
          readFileSync(join(plugin, 'skills/foundry-design-control', localPath), 'utf8'),
          expected,
          localPath,
        );
      }
    });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
