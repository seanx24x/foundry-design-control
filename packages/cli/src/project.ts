import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { Platform } from 'foundry-design-protocol';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function detectPlatform(root: string): Promise<Platform> {
  const packageFile = join(root, 'package.json');
  if (await exists(packageFile)) {
    try {
      const packageJson = JSON.parse(await readFile(packageFile, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (dependencies['react-native'] || dependencies.expo) return 'react-native';
    } catch {
      /* Fall through to filesystem signals. */
    }
  }
  if (await exists(join(root, 'Package.swift'))) return 'swiftui';
  if (await exists(packageFile)) return 'web';
  return 'web';
}

const PROJECT_MARKERS = ['package.json', 'Package.swift', 'index.html', '.git'];

export async function hasProjectMarker(root: string): Promise<boolean> {
  return (await Promise.all(PROJECT_MARKERS.map((marker) => exists(join(root, marker))))).some(
    Boolean,
  );
}

export async function findProjectRoot(start: string): Promise<string | undefined> {
  let current = resolve(start);
  while (true) {
    if (await hasProjectMarker(current)) return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export async function resolveProjectRoot(
  start: string,
  options: { explicit?: boolean; allowUninitialized?: boolean; home?: string } = {},
): Promise<string> {
  const input = resolve(start);
  const home = resolve(options.home ?? homedir());
  if (input === home && !options.allowUninitialized) {
    throw new Error(
      'Foundry will not use your home folder as a project. Open the project folder in your coding agent, or run this command after cd into the project.',
    );
  }
  const found = options.explicit
    ? (await hasProjectMarker(input)) || options.allowUninitialized
      ? input
      : undefined
    : await findProjectRoot(input);
  if (!found && !options.allowUninitialized) {
    throw new Error(
      `No project was found from ${input}. Open the project folder or pass --project /path/to/project.`,
    );
  }
  return found ?? input;
}

export function normalizeTargetUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const candidate = /^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(trimmed)
    ? `http://${trimmed}`
    : trimmed;
  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Preview URL must use http or https: ${value}`);
  }
  return url.toString().replace(/\/$/, '');
}

export function addSessionParams(targetUrl: string, sessionId: string, token: string): string {
  const url = new URL(targetUrl);
  url.searchParams.set('__foundry_session', sessionId);
  url.searchParams.set('__foundry_token', token);
  return url.toString();
}
