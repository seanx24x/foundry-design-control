import type {
  DesignDecision,
  DesignDecisionConditions,
  DesignDecisionRule,
} from './design-memory.js';

export interface DesignDecisionContext {
  component?: string | null;
  kind?: string | null;
  source?: string | null;
  properties?: string[];
  breakpoint?: string | null;
  theme?: string | null;
  state?: string | null;
  values?: Array<{ property: string; value: string | number; category?: string }>;
}

export interface AssessedDesignDecision {
  decision: DesignDecision;
  score: number;
  reasons: string[];
  conflicts: DesignDecisionRule[];
}

const normalized = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();
const includes = (values: string[] | undefined, value: string | null | undefined): boolean =>
  Boolean(value && values?.some((item) => normalized(item) === normalized(value)));
const intersects = (left: string[] | undefined, right: string[] | undefined): boolean =>
  Boolean(
    left?.some((item) => right?.some((candidate) => normalized(candidate) === normalized(item))),
  );

export function decisionCategories(properties: string[]): string[] {
  const categories = new Set<string>();
  for (const property of properties) {
    const value = property.toLowerCase();
    if (/font|line-height|letter|text/.test(value)) categories.add('typography');
    else if (/color|fill|background|border-color/.test(value)) categories.add('color');
    else if (/radius/.test(value)) categories.add('radius');
    else if (/animation|transition|duration|easing|spring/.test(value)) categories.add('motion');
    else if (/width|height|gap|padding|margin|display|position/.test(value))
      categories.add('density');
    else if (/outline|focus|contrast|aria/.test(value)) categories.add('accessibility');
    else categories.add('component');
  }
  return [...categories];
}

function hasConditions(conditions: DesignDecisionConditions): boolean {
  return Object.values(conditions).some((value) => Array.isArray(value) && value.length > 0);
}

function conflictForRule(rule: DesignDecisionRule, context: DesignDecisionContext): boolean {
  if (!rule.property || rule.value == null) return false;
  const proposal = context.values?.find(
    (item) => normalized(item.property) === normalized(rule.property),
  );
  if (!proposal) return false;
  const same = normalized(proposal.value) === normalized(rule.value);
  return rule.operator === 'avoid' ? same : !same;
}

export function assessDesignDecision(
  decision: DesignDecision,
  context: DesignDecisionContext,
): AssessedDesignDecision {
  if (!decision.enabled)
    return { decision, score: 0, reasons: ['Guidance is disabled'], conflicts: [] };
  const conditions = decision.conditions ?? {};
  const reasons: string[] = [];
  let score = hasConditions(conditions) ? 0 : 24;
  if (includes(conditions.components, context.component)) {
    score += 36;
    reasons.push('Same component');
  }
  if (includes(conditions.elementKinds, context.kind)) {
    score += 16;
    reasons.push('Same element kind');
  }
  if (intersects(conditions.properties, context.properties)) {
    score += 20;
    reasons.push('Affects the same properties');
  }
  if (
    context.source &&
    [...(conditions.sources ?? []), ...(decision.sourceLocations ?? [])].some(
      (source) =>
        normalized(context.source).includes(normalized(source)) ||
        normalized(source).includes(normalized(context.source)),
    )
  ) {
    score += 20;
    reasons.push('Same source location');
  }
  if (includes(conditions.breakpoints, context.breakpoint)) {
    score += 8;
    reasons.push('Same breakpoint');
  }
  if (includes(conditions.themes, context.theme)) {
    score += 6;
    reasons.push('Same theme');
  }
  if (includes(conditions.states, context.state)) {
    score += 6;
    reasons.push('Same state');
  }
  const conflicts = (decision.rules ?? []).filter((rule) => conflictForRule(rule, context));
  return {
    decision,
    score: Math.min(100, score),
    reasons,
    conflicts,
  };
}

export function relevantDesignDecisions(
  decisions: DesignDecision[],
  context: DesignDecisionContext,
): AssessedDesignDecision[] {
  return decisions
    .map((decision) => assessDesignDecision(decision, context))
    .filter((item) => item.score >= 20)
    .sort(
      (left, right) =>
        right.conflicts.length - left.conflicts.length ||
        right.score - left.score ||
        right.decision.updatedAt.localeCompare(left.decision.updatedAt),
    );
}
