export interface RecipeValue {
  property: string;
  value: string | number;
  unit?: string;
  category: string;
}

export interface DesignRecipe {
  id: string;
  name: string;
  sourceLabel: string;
  component?: string;
  values: RecipeValue[];
  createdAt: string;
}

export interface VerifiedBaselineValue {
  property: string;
  requested: unknown;
  rendered: unknown;
  passed: boolean;
}

export interface VerifiedBaseline {
  id: string;
  runId: string;
  targetId: string;
  targetLabel: string;
  breakpoint: string;
  theme: string;
  state: string;
  revision?: string;
  values: VerifiedBaselineValue[];
  verifiedAt: string;
}

export interface ProjectDesignMemory {
  version: 1;
  recipes: DesignRecipe[];
  baselines: VerifiedBaseline[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const emptyDesignMemory = (): ProjectDesignMemory => ({
  version: 1,
  recipes: [],
  baselines: [],
});

export function projectMemoryKey(projectRoot: string): string {
  return `__foundry_design_memory:${projectRoot || 'local'}`;
}

export function readDesignMemory(storage: StorageLike, projectRoot: string): ProjectDesignMemory {
  try {
    const parsed = JSON.parse(storage.getItem(projectMemoryKey(projectRoot)) ?? 'null');
    if (!parsed || parsed.version !== 1) return emptyDesignMemory();
    return {
      version: 1,
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
      baselines: Array.isArray(parsed.baselines) ? parsed.baselines : [],
    };
  } catch {
    return emptyDesignMemory();
  }
}

export function writeDesignMemory(
  storage: StorageLike,
  projectRoot: string,
  memory: ProjectDesignMemory,
): void {
  storage.setItem(projectMemoryKey(projectRoot), JSON.stringify(memory));
}

export function addRecipe(memory: ProjectDesignMemory, recipe: DesignRecipe): ProjectDesignMemory {
  return {
    ...memory,
    recipes: [recipe, ...memory.recipes.filter((item) => item.id !== recipe.id)],
  };
}

export function removeRecipe(memory: ProjectDesignMemory, recipeId: string): ProjectDesignMemory {
  return { ...memory, recipes: memory.recipes.filter((item) => item.id !== recipeId) };
}

export function addVerifiedBaseline(
  memory: ProjectDesignMemory,
  baseline: VerifiedBaseline,
): ProjectDesignMemory {
  const sameContext = (item: VerifiedBaseline): boolean =>
    item.targetId === baseline.targetId &&
    item.breakpoint === baseline.breakpoint &&
    item.theme === baseline.theme &&
    item.state === baseline.state;
  return {
    ...memory,
    baselines: [baseline, ...memory.baselines.filter((item) => !sameContext(item))],
  };
}

export function baselineForContext(
  memory: ProjectDesignMemory,
  targetId: string,
  breakpoint: string,
  theme: string,
  state: string,
): VerifiedBaseline | undefined {
  return memory.baselines.find(
    (item) =>
      item.targetId === targetId &&
      item.breakpoint === breakpoint &&
      item.theme === theme &&
      item.state === state,
  );
}
