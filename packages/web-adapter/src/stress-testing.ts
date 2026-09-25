export type StressCategory = 'content' | 'state' | 'accessibility';

export type StressConditionId =
  | 'long-content'
  | 'empty-content'
  | 'large-numbers'
  | 'missing-images'
  | 'loading-state'
  | 'error-state'
  | 'offline-state'
  | 'text-200'
  | 'browser-zoom-200'
  | 'high-contrast'
  | 'monochrome'
  | 'reduced-motion'
  | 'keyboard-only';

export type StressScope = 'selection' | 'canvas';

export interface StressConditionDefinition {
  id: StressConditionId;
  category: StressCategory;
  label: string;
  description: string;
  combination: 'content' | 'state' | 'preference' | 'navigation';
}

export interface StressFindingContext {
  severity: 'high' | 'medium' | 'low';
  category: string;
  source?: string;
}

export interface StressFindingGroup<T extends StressFindingContext> {
  id: string;
  label: string;
  findings: T[];
}

export const STRESS_CONDITIONS: readonly StressConditionDefinition[] = [
  {
    id: 'long-content',
    category: 'content',
    label: 'Long content',
    description: 'Expands names, labels, values, and translation-like copy.',
    combination: 'content',
  },
  {
    id: 'empty-content',
    category: 'content',
    label: 'Empty content',
    description: 'Removes visible copy without creating a source edit.',
    combination: 'content',
  },
  {
    id: 'large-numbers',
    category: 'content',
    label: 'Large numbers',
    description: 'Replaces rendered numeric values with unusually large data.',
    combination: 'content',
  },
  {
    id: 'missing-images',
    category: 'content',
    label: 'Missing images',
    description: 'Removes image sources to reveal fallback and alt-text behavior.',
    combination: 'content',
  },
  {
    id: 'loading-state',
    category: 'state',
    label: 'Loading',
    description: 'Requests the product loading state through the Foundry stress event.',
    combination: 'state',
  },
  {
    id: 'error-state',
    category: 'state',
    label: 'Error',
    description: 'Requests the product error state through the Foundry stress event.',
    combination: 'state',
  },
  {
    id: 'offline-state',
    category: 'state',
    label: 'Offline',
    description: 'Requests the product offline state through the Foundry stress event.',
    combination: 'state',
  },
  {
    id: 'text-200',
    category: 'accessibility',
    label: 'Text 200%',
    description: 'Doubles the root text size while preserving the viewport.',
    combination: 'preference',
  },
  {
    id: 'browser-zoom-200',
    category: 'accessibility',
    label: 'Zoom 200%',
    description: 'Tests browser zoom independently from the Foundry canvas zoom.',
    combination: 'preference',
  },
  {
    id: 'high-contrast',
    category: 'accessibility',
    label: 'High contrast',
    description: 'Raises rendered contrast to expose fragile color relationships.',
    combination: 'preference',
  },
  {
    id: 'monochrome',
    category: 'accessibility',
    label: 'Monochrome',
    description: 'Removes hue so meaning that depends on color is easier to spot.',
    combination: 'preference',
  },
  {
    id: 'reduced-motion',
    category: 'accessibility',
    label: 'Reduced motion',
    description: 'Suppresses non-essential animation and emits the preference state.',
    combination: 'preference',
  },
  {
    id: 'keyboard-only',
    category: 'accessibility',
    label: 'Keyboard only',
    description: 'Audits focus reachability, order, and visible focus treatment.',
    combination: 'navigation',
  },
] as const;

const stressIds = new Set(STRESS_CONDITIONS.map((condition) => condition.id));

export function normalizeStressConditions(values: readonly unknown[]): StressConditionId[] {
  const normalized: StressConditionId[] = [];
  for (const value of values) {
    if (!stressIds.has(value as StressConditionId)) continue;
    const id = value as StressConditionId;
    const definition = STRESS_CONDITIONS.find((condition) => condition.id === id)!;
    if (definition.combination === 'state') {
      const stateIds = new Set(
        STRESS_CONDITIONS.filter((condition) => condition.combination === 'state').map(
          (condition) => condition.id,
        ),
      );
      for (let index = normalized.length - 1; index >= 0; index -= 1) {
        if (stateIds.has(normalized[index]!)) normalized.splice(index, 1);
      }
    }
    if (!normalized.includes(id)) normalized.push(id);
  }
  return normalized;
}

export function validateStressConditions(values: readonly unknown[]): StressConditionId[] {
  const unsupportedIndex = values.findIndex((value) => !stressIds.has(value as StressConditionId));
  if (unsupportedIndex >= 0) {
    throw new Error(`Unsupported stress test: ${String(values[unsupportedIndex])}`);
  }
  const normalized = normalizeStressConditions(values);
  if (!normalized.length) throw new Error('Select at least one supported stress test');
  return normalized;
}

export function toggleStressCondition(
  active: readonly StressConditionId[],
  id: StressConditionId,
): StressConditionId[] {
  if (active.includes(id)) return active.filter((condition) => condition !== id);
  return normalizeStressConditions([...active, id]);
}

export function stressConditionSummary(active: readonly StressConditionId[]): string {
  const normalized = normalizeStressConditions(active);
  if (!normalized.length) return 'No temporary stress conditions';
  if (normalized.length === 1) {
    return STRESS_CONDITIONS.find((condition) => condition.id === normalized[0])?.label ?? '';
  }
  return `${normalized.length} temporary conditions`;
}

export function designHealthScope(
  active: readonly StressConditionId[],
  requestedScope: StressScope,
): StressScope {
  // Clearing temporary conditions does not turn a selection scan into a canvas scan.
  return requestedScope;
}

export function groupStressFindings<T extends StressFindingContext>(
  findings: readonly T[],
  groupBy: 'severity' | 'source' = 'severity',
): StressFindingGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const finding of findings) {
    const id = groupBy === 'severity' ? finding.severity : finding.source || 'unmapped';
    groups.set(id, [...(groups.get(id) ?? []), finding]);
  }
  const severityOrder = ['high', 'medium', 'low'];
  return [...groups.entries()]
    .sort(([first], [second]) =>
      groupBy === 'severity'
        ? severityOrder.indexOf(first) - severityOrder.indexOf(second)
        : first.localeCompare(second),
    )
    .map(([id, grouped]) => ({
      id,
      label:
        groupBy === 'severity'
          ? `${id[0]?.toUpperCase()}${id.slice(1)} severity`
          : id === 'unmapped'
            ? 'Source mapping unavailable'
            : id,
      findings: grouped,
    }));
}
