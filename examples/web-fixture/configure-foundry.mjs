import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtureRoot = dirname(fileURLToPath(import.meta.url));

export async function configureFoundry(root = fixtureRoot) {
  const projectRoot = resolve(root);
  const configPath = join(projectRoot, '.foundry', 'foundry.config.json');
  const authoredPath = join(projectRoot, 'foundry.design.json');
  const [config, authored] = await Promise.all(
    [configPath, authoredPath].map(async (path) => JSON.parse(await readFile(path, 'utf8'))),
  );
  if (!Array.isArray(authored.states) || authored.states.length === 0) {
    throw new Error('foundry.design.json must define at least one authored state.');
  }
  const next = {
    ...config,
    design: {
      ...(config.design ?? {}),
      states: authored.states,
    },
  };
  const html = await readFile(join(projectRoot, 'index.html'), 'utf8').catch(() => '');
  const css = await readFile(join(projectRoot, 'style.css'), 'utf8').catch(() => '');
  if (html && css) {
    const htmlLines = html.split(/\r?\n/);
    const cssLines = css.split(/\r?\n/);
    const source = {
      file: 'index.html',
      line: Number(
        html.match(
          /data-foundry-component="Signup\/PrimaryAction"\s+data-foundry-source="index.html:(\d+)/,
        )?.[1],
      ),
    };
    if (!source.line || !htmlLines[source.line - 1]?.includes('<button'))
      throw new Error('Primary action source annotation is stale.');
    const values = ['Primary', 'Quiet', 'Danger'];
    const variants = values.map((value) => {
      const selector =
        value === 'Primary' ? '.submit-button {' : `.submit-button[data-story='${value}'] {`;
      const line = cssLines.findIndex((text) => text.trim() === selector) + 1;
      if (!line) throw new Error(`Missing authored variant: ${value}`);
      return {
        id: `morrow-action-${value.toLowerCase()}`,
        label: value,
        property: 'story',
        value,
        props: { story: value },
        source: { file: 'style.css', line },
        adapter: 'configured',
        sourceProperty: selector,
      };
    });
    next.design.exclude = [
      ...new Set([
        ...(next.design.exclude ?? []),
        'PrimaryAction.tsx',
        'PrimaryAction.stories.tsx',
      ]),
    ];
    next.design.components = [
      {
        id: 'morrow-primary-action',
        name: 'PrimaryAction',
        selector: '.submit-button',
        source,
        instances: 1,
        variants,
        variantAxes: [
          {
            id: 'morrow-action-story',
            label: 'Appearance',
            property: 'story',
            values,
            adapter: 'configured',
            source: variants[1].source,
            sourceProperty: '.submit-button[data-story]',
            canCreate: true,
            evidence: ['Authored data-story CSS selectors in style.css'],
          },
        ],
        evidence: ['Fixture-authored HTML component and CSS variant contract'],
      },
    ];
  }
  await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`);
  return { configPath, states: authored.states };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const result = await configureFoundry(process.cwd());
  console.log(`Configured ${result.states.length} authored Morrow state in ${result.configPath}`);
}
