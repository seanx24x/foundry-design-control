export interface RecipeValue {
  property: string;
  value: string | number;
  unit?: string;
  category: string;
}

export interface RecipeConditions {
  components?: string[];
  elementKinds?: string[];
  requiredProperties?: string[];
}

export interface DesignRecipe {
  id: string;
  name: string;
  sourceLabel: string;
  component?: string;
  intent?: string;
  categories?: string[];
  conditions?: RecipeConditions;
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

export type DesignDecisionOutcome = 'approved' | 'rejected' | 'rule';
export type DesignDecisionRuleOperator = 'prefer' | 'avoid' | 'require';

export interface DesignDecisionRule {
  property?: string;
  category?: string;
  operator: DesignDecisionRuleOperator;
  value?: string | number;
  guidance?: string;
}

export interface DesignDecisionConditions {
  components?: string[];
  elementKinds?: string[];
  properties?: string[];
  breakpoints?: string[];
  themes?: string[];
  states?: string[];
  sources?: string[];
}

export interface DesignDecisionEvidence {
  kind: 'manual' | 'branch' | 'recipe' | 'baseline';
  label: string;
  refId?: string;
}

export interface DesignDecision {
  id: string;
  title: string;
  summary: string;
  rationale?: string;
  outcome: DesignDecisionOutcome;
  categories: string[];
  conditions: DesignDecisionConditions;
  rules: DesignDecisionRule[];
  evidence: DesignDecisionEvidence[];
  sourceLocations: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDesignMemory {
  version: 3;
  recipes: DesignRecipe[];
  baselines: VerifiedBaseline[];
  decisions: DesignDecision[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const emptyDesignMemory = (): ProjectDesignMemory => ({
  version: 3,
  recipes: [],
  baselines: [],
  decisions: [],
});

export function projectMemoryKey(projectRoot: string): string {
  return `__foundry_design_memory:${projectRoot || 'local'}`;
}

export function readDesignMemory(storage: StorageLike, projectRoot: string): ProjectDesignMemory {
  try {
    const parsed = JSON.parse(storage.getItem(projectMemoryKey(projectRoot)) ?? 'null');
    if (!parsed || ![1, 2, 3].includes(parsed.version)) return emptyDesignMemory();
    return {
      version: 3,
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
      baselines: Array.isArray(parsed.baselines) ? parsed.baselines : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
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

export function addDesignDecision(
  memory: ProjectDesignMemory,
  decision: DesignDecision,
): ProjectDesignMemory {
  return {
    ...memory,
    decisions: [decision, ...memory.decisions.filter((item) => item.id !== decision.id)],
  };
}

export function updateDesignDecision(
  memory: ProjectDesignMemory,
  decisionId: string,
  update: Partial<Pick<DesignDecision, 'title' | 'summary' | 'rationale' | 'enabled'>>,
  updatedAt = new Date().toISOString(),
): ProjectDesignMemory {
  return {
    ...memory,
    decisions: memory.decisions.map((item) =>
      item.id === decisionId ? { ...item, ...update, updatedAt } : item,
    ),
  };
}

export function removeDesignDecision(
  memory: ProjectDesignMemory,
  decisionId: string,
): ProjectDesignMemory {
  return { ...memory, decisions: memory.decisions.filter((item) => item.id !== decisionId) };
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
