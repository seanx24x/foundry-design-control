import type { DesignRecipe, RecipeValue } from './design-memory.js';

export type RecipeCompatibility = 'exact' | 'compatible' | 'partial' | 'incompatible';

export interface RecipeControl {
  property: string;
  value: string | number;
  category: string;
  unit?: string;
}

export interface RecipeToken {
  id: string;
  name: string;
  value: string;
  category: string;
  cssVariable?: string;
}

export interface RecipeMapping {
  property: string;
  category: string;
  sourceValue: string | number;
  currentValue?: string | number;
  resolvedValue?: string | number;
  token?: { id: string; name: string; value: string };
  status: 'mapped' | 'ambiguous' | 'unsupported';
  detail: string;
}

export interface RecipeAssessment {
  compatibility: RecipeCompatibility;
  score: number;
  matched: number;
  total: number;
  ambiguous: number;
  mappings: RecipeMapping[];
  reasons: string[];
}

const TOKEN_CATEGORY: Record<string, string[]> = {
  layout: ['spacing', 'size'],
  spacing: ['spacing', 'size'],
  typography: ['typography', 'size'],
  color: ['color'],
  effects: ['radius', 'shadow', 'other'],
  effect: ['radius', 'shadow', 'other'],
  motion: ['motion'],
};

function numeric(value: string | number): number | undefined {
  const match = String(value)
    .trim()
    .match(/^(-?\d*\.?\d+)(?:[a-z%]+)?$/i);
  return match ? Number(match[1]) : undefined;
}

function normalized(value: string | number): string {
  return String(value).trim().toLowerCase().replace(/\s+/g, '');
}

function tokenDistance(value: RecipeValue, token: RecipeToken): number {
  if (normalized(value.value) === normalized(token.value)) return 0;
  const sourceNumber = numeric(value.value);
  const tokenNumber = numeric(token.value);
  if (sourceNumber == null || tokenNumber == null) return Number.POSITIVE_INFINITY;
  return Math.abs(sourceNumber - tokenNumber) / Math.max(1, Math.abs(sourceNumber));
}

export function resolveRecipeValue(
  value: RecipeValue,
  tokens: RecipeToken[],
): Pick<RecipeMapping, 'resolvedValue' | 'token' | 'status' | 'detail'> {
  const categories = TOKEN_CATEGORY[value.category] ?? [value.category];
  const ranked = tokens
    .filter((token) => categories.includes(token.category))
    .map((token) => ({ token, distance: tokenDistance(value, token) }))
    .filter((candidate) => Number.isFinite(candidate.distance))
    .sort((a, b) => a.distance - b.distance || a.token.name.localeCompare(b.token.name));
  const best = ranked[0];
  if (!best || best.distance > 0.2) {
    return {
      resolvedValue: value.value,
      status: 'mapped',
      detail: 'Uses the saved literal because no compatible destination token was found.',
    };
  }
  const tied = ranked[1] && Math.abs(ranked[1].distance - best.distance) < 0.001;
  return {
    resolvedValue: best.token.value,
    token: { id: best.token.id, name: best.token.name, value: best.token.value },
    status: tied ? 'ambiguous' : 'mapped',
    detail: tied
      ? `Multiple destination tokens match. ${best.token.name} is shown and requires review.`
      : `Resolves through destination token ${best.token.name}.`,
  };
}

export function assessRecipe(
  recipe: DesignRecipe,
  controls: RecipeControl[],
  tokens: RecipeToken[] = [],
  target: { component?: string | null; kind?: string | null } = {},
): RecipeAssessment {
  const controlByProperty = new Map(controls.map((control) => [control.property, control]));
  const mappings: RecipeMapping[] = recipe.values.map((value) => {
    const control = controlByProperty.get(value.property);
    if (!control) {
      return {
        property: value.property,
        category: value.category,
        sourceValue: value.value,
        status: 'unsupported',
        detail: 'This target does not expose the required property.',
      };
    }
    return {
      property: value.property,
      category: value.category,
      sourceValue: value.value,
      currentValue: control.value,
      ...resolveRecipeValue(value, tokens),
    };
  });
  const matched = mappings.filter((mapping) => mapping.status !== 'unsupported').length;
  const ambiguous = mappings.filter((mapping) => mapping.status === 'ambiguous').length;
  const coverage = recipe.values.length ? matched / recipe.values.length : 0;
  const componentMatch = Boolean(recipe.conditions?.components?.includes(target.component ?? ''));
  const kindMatch = Boolean(recipe.conditions?.elementKinds?.includes(target.kind ?? ''));
  const score = Math.round(
    Math.min(1, coverage * 0.8 + (componentMatch ? 0.15 : 0) + (kindMatch ? 0.05 : 0)) * 100,
  );
  const compatibility: RecipeCompatibility =
    matched === 0
      ? 'incompatible'
      : coverage === 1 && (componentMatch || kindMatch)
        ? 'exact'
        : coverage === 1
          ? 'compatible'
          : 'partial';
  const reasons = [
    `${matched} of ${recipe.values.length} properties map to this target.`,
    ...(componentMatch ? ['The component condition matches.'] : []),
    ...(kindMatch ? ['The element type matches.'] : []),
    ...(ambiguous ? [`${ambiguous} token choice requires review.`] : []),
  ];
  return {
    compatibility,
    score,
    matched,
    total: recipe.values.length,
    ambiguous,
    mappings,
    reasons,
  };
}

export function recipeCategories(values: RecipeValue[]): string[] {
  return [...new Set(values.map((value) => value.category))];
}
