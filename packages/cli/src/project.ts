import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
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

export function addSessionParams(targetUrl: string, sessionId: string, token: string): string {
  const url = new URL(targetUrl);
  url.searchParams.set('__foundry_session', sessionId);
  url.searchParams.set('__foundry_token', token);
  return url.toString();
}
