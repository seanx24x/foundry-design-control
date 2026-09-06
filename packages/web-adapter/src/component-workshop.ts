export type ComponentWorkshopScope = 'instance' | 'variant' | 'component';

export interface ComponentWorkshopSource {
  file: string;
  line?: number;
  column?: number;
}

export interface RawComponentVariant {
  id: string;
  label?: string;
  name?: string;
  property?: string;
  value?: string | number | boolean | null | unknown[] | Record<string, unknown>;
  props?: Record<string, string | number | boolean>;
  source?: ComponentWorkshopSource;
  adapter?: ComponentVariantAdapter;
  sourceProperty?: string;
}

export type ComponentVariantAdapter = 'storybook' | 'cva' | 'typescript' | 'configured';

export interface ComponentVariantAxis {
  id: string;
  label: string;
  property: string;
  values: Array<string | number | boolean | null | unknown[] | Record<string, unknown>>;
  adapter: ComponentVariantAdapter;
  source: ComponentWorkshopSource;
  sourceProperty: string;
  canCreate: boolean;
  evidence: string[];
}

export interface ComponentWorkshopVariant {
  id: string;
  name: string;
  props: Record<string, string | number | boolean>;
  source?: ComponentWorkshopSource;
  adapter?: ComponentVariantAdapter;
  sourceProperty?: string;
}

export interface RawComponentDefinition {
  id: string;
  name: string;
  selector?: string;
  source?: ComponentWorkshopSource;
  instances?: number;
  variants?: RawComponentVariant[];
  variantAxes?: ComponentVariantAxis[];
  evidence?: string[];
}

export interface ComponentWorkshopDefinition {
  id: string;
  name: string;
  selector?: string;
  source?: ComponentWorkshopSource;
  instances: number;
  variants: ComponentWorkshopVariant[];
  variantAxes: ComponentVariantAxis[];
  evidence: string[];
}

export interface ComponentWorkshopState {
  id: string;
  label: string;
  kind: 'default' | 'pseudo' | 'semantic';
  pseudoState?: 'hover' | 'focus' | 'active' | 'disabled';
  confidence: 'instrumented' | 'inferred';
  evidence: string[];
}

export interface RawStateDefinition {
  id: string;
  label: string;
  pseudoStates?: Array<'hover' | 'focus' | 'active' | 'disabled'>;
  confidence?: 'instrumented' | 'inferred' | 'measured' | 'unresolved';
  evidence?: string[];
}

const BUILT_IN_STATES: ComponentWorkshopState[] = [
  {
    id: 'current',
    label: 'Default',
    kind: 'default',
    confidence: 'instrumented',
    evidence: ['Live rendered state'],
  },
  {
    id: 'hover',
    label: 'Hover',
    kind: 'pseudo',
    pseudoState: 'hover',
    confidence: 'instrumented',
    evidence: ['Forced :hover rules'],
  },
  {
    id: 'focus',
    label: 'Focus',
    kind: 'pseudo',
    pseudoState: 'focus',
    confidence: 'instrumented',
    evidence: ['Forced :focus rules'],
  },
  {
    id: 'active',
    label: 'Pressed',
    kind: 'pseudo',
    pseudoState: 'active',
    confidence: 'instrumented',
    evidence: ['Forced :active rules'],
  },
  {
    id: 'disabled',
    label: 'Disabled',
    kind: 'pseudo',
    pseudoState: 'disabled',
    confidence: 'instrumented',
    evidence: ['Native disabled and aria-disabled attributes'],
  },
  {
    id: 'loading',
    label: 'Loading',
    kind: 'semantic',
    confidence: 'inferred',
    evidence: ['data-foundry-state and aria-busy preview'],
  },
  {
    id: 'empty',
    label: 'Empty',
    kind: 'semantic',
    confidence: 'inferred',
    evidence: ['data-foundry-state preview'],
  },
  {
    id: 'error',
    label: 'Error',
    kind: 'semantic',
    confidence: 'inferred',
    evidence: ['data-foundry-state and aria-invalid preview'],
  },
];

function variantProps(variant: RawComponentVariant): Record<string, string | number | boolean> {
  if (variant.props) return { ...variant.props };
  if (!variant.property) return {};
  if (!['string', 'number', 'boolean'].includes(typeof variant.value)) return {};
  return { [variant.property]: variant.value as string | number | boolean };
}

export function normalizeWorkshopComponents(
  components: RawComponentDefinition[] | null | undefined,
): ComponentWorkshopDefinition[] {
  return (components ?? []).map((component) => ({
    id: component.id,
    name: component.name,
    selector: component.selector,
    source: component.source,
    instances: component.instances ?? 0,
    evidence: [...(component.evidence ?? [])],
    variants: (component.variants ?? []).map((variant) => ({
      id: variant.id,
      name: variant.name ?? variant.label ?? 'Unnamed variant',
      props: variantProps(variant),
      source: variant.source,
      adapter: variant.adapter,
      sourceProperty: variant.sourceProperty,
    })),
    variantAxes: (component.variantAxes ?? []).map((axis) => ({
      ...axis,
      values: [...axis.values],
      evidence: [...axis.evidence],
    })),
  }));
}

export interface ComponentVariantDraft {
  componentId: string;
  label: string;
  property: string;
  value: string;
  adapter: ComponentVariantAdapter;
  source: ComponentWorkshopSource;
  sourceProperty: string;
  baseVariantId?: string;
}

export function createComponentVariantDraft(input: {
  component: ComponentWorkshopDefinition;
  axisId: string;
  label: string;
  value: string;
  baseVariantId?: string;
}): ComponentVariantDraft {
  const axis = input.component.variantAxes.find((item) => item.id === input.axisId);
  const label = input.label.trim();
  const value = input.value.trim();
  if (!axis?.canCreate) throw new Error('This variant source is read-only.');
  if (!label || !value) throw new Error('Add both a variant name and source value.');
  if (axis.values.some((item) => String(item).toLowerCase() === value.toLowerCase()))
    throw new Error(`${value} already exists on ${axis.label}.`);
  return {
    componentId: input.component.id,
    label,
    property: axis.property,
    value,
    adapter: axis.adapter,
    source: axis.source,
    sourceProperty: axis.sourceProperty,
    baseVariantId: input.baseVariantId,
  };
}

export interface ComponentVariantInstance {
  id: string;
  label: string;
  props: Record<string, string | number | boolean>;
}

export interface ComponentVariantDrift {
  instanceId: string;
  label: string;
  property: string;
  expected: string | number | boolean;
  actual: string | number | boolean;
}

export function componentVariantDrift(
  instances: ComponentVariantInstance[],
  variant?: ComponentWorkshopVariant,
): ComponentVariantDrift[] {
  if (!variant) return [];
  return instances.flatMap((instance) =>
    Object.entries(variant.props).flatMap(([property, expected]) => {
      const actual = instance.props[property];
      if (actual == null || String(actual) === String(expected)) return [];
      return [{ instanceId: instance.id, label: instance.label, property, expected, actual }];
    }),
  );
}

export function componentWorkshopStates(
  configured: RawStateDefinition[] | null | undefined,
): ComponentWorkshopState[] {
  const states = new Map(BUILT_IN_STATES.map((state) => [state.id, { ...state }]));
  for (const state of configured ?? []) {
    const pseudoState = state.pseudoStates?.[0];
    states.set(state.id, {
      id: state.id,
      label: state.label,
      kind: pseudoState ? 'pseudo' : 'semantic',
      pseudoState,
      confidence: state.confidence === 'instrumented' ? 'instrumented' : 'inferred',
      evidence: [...(state.evidence ?? ['Configured project state'])],
    });
  }
  return [...states.values()];
}

export function availableWorkshopScopes(input: {
  hasLiveInstance: boolean;
  hasComponentSource: boolean;
  selectedVariant?: ComponentWorkshopVariant;
}): Array<{ id: ComponentWorkshopScope; enabled: boolean; reason: string }> {
  return [
    {
      id: 'instance',
      enabled: input.hasLiveInstance,
      reason: input.hasLiveInstance ? 'Changes this rendered instance' : 'No live instance',
    },
    {
      id: 'variant',
      enabled: Boolean(input.hasLiveInstance && input.selectedVariant?.source),
      reason: input.selectedVariant?.source
        ? 'Changes the mapped variant definition'
        : 'Choose a source-mapped variant',
    },
    {
      id: 'component',
      enabled: Boolean(input.hasLiveInstance && input.hasComponentSource),
      reason: input.hasComponentSource
        ? 'Changes every instance through the component source'
        : 'Component source mapping unavailable',
    },
  ];
}

export function sourceLabel(source?: ComponentWorkshopSource): string {
  if (!source) return 'Source mapping unavailable';
  return `${source.file}${source.line ? `:${source.line}` : ''}`;
}
