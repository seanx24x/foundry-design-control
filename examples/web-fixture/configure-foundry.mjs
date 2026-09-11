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
  await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`);
  return { configPath, states: authored.states };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const result = await configureFoundry(process.cwd());
  console.log(`Configured ${result.states.length} authored Morrow state in ${result.configPath}`);
}
