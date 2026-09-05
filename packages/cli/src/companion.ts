import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Agent } from './installer.js';
import { FOUNDRY_VERSION } from './release.js';

export interface CompanionProject {
  root: string;
  targetUrl?: string;
  lastOpenedAt: string;
}

export interface CompanionState {
  version: 1;
  foundryVersion: string;
  agents: Agent[];
  projects: CompanionProject[];
  updatedAt: string;
}

export class CompanionStore {
  readonly path: string;

  constructor(home: string) {
    this.path = join(home, '.foundry', 'companion.json');
  }

  async read(): Promise<CompanionState> {
    return readFile(this.path, 'utf8')
      .then((content) => JSON.parse(content) as CompanionState)
      .catch(() => ({
        version: 1,
        foundryVersion: FOUNDRY_VERSION,
        agents: [],
        projects: [],
        updatedAt: new Date(0).toISOString(),
      }));
  }

  async recordInstallation(agents: Agent[]): Promise<CompanionState> {
    const state = await this.read();
    return this.write({
      ...state,
      foundryVersion: FOUNDRY_VERSION,
      agents: [...new Set([...state.agents, ...agents])],
      updatedAt: new Date().toISOString(),
    });
  }

  async registerProject(root: string, targetUrl?: string): Promise<CompanionState> {
    const state = await this.read();
    const project: CompanionProject = {
      root: resolve(root),
      ...(targetUrl ? { targetUrl } : {}),
      lastOpenedAt: new Date().toISOString(),
    };
    return this.write({
      ...state,
      foundryVersion: FOUNDRY_VERSION,
      projects: [project, ...state.projects.filter((candidate) => candidate.root !== project.root)],
      updatedAt: new Date().toISOString(),
    });
  }

  private async write(state: CompanionState): Promise<CompanionState> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.path);
    return state;
  }
}
