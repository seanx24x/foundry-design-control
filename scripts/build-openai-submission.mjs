import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import sharp from 'sharp';

export const root = resolve(import.meta.dirname, '..');
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function buildSubmission() {
  const release = json(join(root, 'release.json'));
  const source = join(root, 'plugins/foundry-design-control');
  const listing = json(join(root, 'submission/openai/submission.json'));
  const cases = json(join(root, 'submission/openai/test-cases.json'));
  if (listing.shortDescription.length > 30)
    throw new Error('Listing subtitle exceeds 30 characters.');
  const launcher = readFileSync(
    join(source, 'skills/foundry-design-control/scripts/foundry.sh'),
    'utf8',
  );
  if (!launcher.includes(`--package=foundry-design@${release.version} `))
    throw new Error('Plugin helper must pin the reviewed release.');

  // Never replace earlier submission candidates or sealed npm artifacts.
  const output = join(root, 'artifacts/openai');
  mkdirSync(output, { recursive: true });
  const run = mkdtempSync(join(output, `${release.version}-`));
  const plugin = join(run, 'foundry-design-control');
  mkdirSync(join(plugin, 'server'), { recursive: true });
  for (const path of ['skills', 'assets'])
    cpSync(join(source, path), join(plugin, path), { recursive: true });
  // Rasterize the supplied branding without redesigning it. Public listing
  // requirements are stricter than the portable format's SVG allowance.
  await sharp(join(source, 'assets/logo.svg'), { density: 384 })
    .resize(512, 512)
    .png()
    .toFile(join(plugin, 'assets/logo.png'));
  for (const path of ['LICENSE', 'PRIVACY.md', 'TERMS.md'])
    cpSync(join(root, path), join(plugin, path));
  const readme = readFileSync(join(root, 'submission/openai/PACKAGE_README.md'), 'utf8');
  writeFileSync(join(plugin, 'README.md'), readme.replaceAll('{{VERSION}}', release.version));

  const interfaceMetadata = {
    displayName: listing.name,
    shortDescription: listing.shortDescription,
    longDescription: listing.longDescription,
    developerName: listing.developerName,
    category: listing.category,
    capabilities: ['Interactive', 'Write'],
    websiteURL: listing.websiteURL,
    supportURL: listing.supportURL,
    privacyPolicyURL: listing.privacyPolicyURL,
    termsOfServiceURL: listing.termsOfServiceURL,
    defaultPrompt: listing.starterPrompts,
    logo: './assets/logo.png',
    composerIcon: './assets/logo.png',
  };
  const manifest = json(join(source, 'plugin.json'));
  manifest.extensions = {
    'com.openai': {
      requires_local_executor: true,
      interface: interfaceMetadata,
      review: {
        prompts: listing.starterPrompts,
        ...(typeof listing.commerce === 'boolean'
          ? {
              commerce: listing.commerce,
              commerce_description: listing.commerceDescription,
            }
          : {}),
        test_cases: {
          positive: cases.positive.map(({ name, setup, prompt, tools_triggered, expected }) => ({
            description: `${name}. Setup: ${setup}`,
            prompt,
            tools_triggered,
            expected_behavior: expected,
          })),
          negative: cases.negative.map(({ name, setup, prompt, expected }) => ({
            description: `${name}. Setup: ${setup}. Expected: ${expected}`,
            prompt,
          })),
        },
      },
      publication: {
        release_notes: listing.releaseNotes,
        // Omit unknown targeting; [] would explicitly remove restrictions.
        ...(Array.isArray(listing.countries) ? { countries: listing.countries } : {}),
      },
    },
  };
  writeJson(join(plugin, 'plugin.json'), manifest);
  writeJson(join(plugin, 'mcp.json'), {
    $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
    mcpServers: {
      'foundry-design-control': {
        type: 'stdio',
        command: 'node',
        args: ['${PLUGIN_ROOT}/server/index.mjs'],
        cwd: '${PLUGIN_ROOT}',
      },
    },
  });

  const bundled = await build({
    absWorkingDir: root,
    entryPoints: ['packages/mcp-server/src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: join(plugin, 'server/index.mjs'),
    minify: false,
    legalComments: 'external',
    metafile: true,
    sourcemap: 'external',
    sourcesContent: true,
  });
  const dependencies = new Map();
  const inputs = Object.keys(bundled.metafile.inputs)
    .sort()
    .map((input) => {
      const path = resolve(root, input);
      if (input.includes('node_modules/')) {
        let directory = dirname(path);
        while (directory !== root && directory !== dirname(directory)) {
          if (existsSync(join(directory, 'package.json'))) {
            const dependency = json(join(directory, 'package.json'));
            // Some packages use nested package.json files just to declare module type.
            if (!dependency.name || !dependency.version) {
              directory = dirname(directory);
              continue;
            }
            const licenses = readdirSync(directory).filter((name) =>
              /^(licen[cs]e|copying|notice)(\.|$)/i.test(name),
            );
            if (!licenses.length) throw new Error(`Missing license text for ${dependency.name}`);
            dependencies.set(`${dependency.name}@${dependency.version}`, {
              name: dependency.name,
              version: dependency.version,
              license: dependency.license,
              texts: licenses.map((name) => readFileSync(join(directory, name), 'utf8')),
            });
            break;
          }
          directory = dirname(directory);
        }
      }
      return { path: input, sha256: digest(readFileSync(path)) };
    });
  writeFileSync(
    join(plugin, 'THIRD_PARTY_NOTICES.md'),
    '# Bundled bridge dependencies\n\n' +
      [...dependencies.values()]
        .map(
          (dependency) =>
            `## ${dependency.name}@${dependency.version}\n\nLicense: ${dependency.license}\n\n${dependency.texts.join('\n\n')}`,
        )
        .join('\n\n'),
  );

  const zip = join(run, `foundry-design-control-openai-desktop-${release.version}-candidate.zip`);
  execFileSync('zip', ['-q', '-r', '-X', zip, '.'], {
    cwd: plugin,
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  });
  const report = {
    status: 'candidate-not-submitted',
    version: release.version,
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    sourceDirty: Boolean(
      execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
        cwd: root,
        encoding: 'utf8',
      }).trim(),
    ),
    zip: relative(root, zip),
    sha256: digest(readFileSync(zip)),
    inputs,
    dependencies: [...dependencies.values()].map(({ texts: _texts, ...dependency }) => dependency),
    outstanding: [
      'OpenAI organization allowlist confirmation',
      'Fresh desktop client install and workflow review',
      'Genuine reviewer recording',
      'Publisher country availability decision',
      'Publisher identity, availability and policy decisions',
      'Portal validation and review',
    ],
  };
  writeJson(join(run, 'provenance.json'), report);
  console.log(`Desktop-only local-MCP candidate (NOT submitted): ${zip}`);
  console.log(`Provenance: ${join(run, 'provenance.json')}`);
  return { run, plugin, zip, report };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await buildSubmission();
