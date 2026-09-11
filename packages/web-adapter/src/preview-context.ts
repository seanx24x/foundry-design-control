export const PREVIEW_CONTEXT_VERSION = 1 as const;

export type PreviewAxisStatus = 'applied' | 'current' | 'unsupported';
export type PreviewMotionPreference = 'system' | 'reduce' | 'no-preference';
export type PreviewPseudoState = 'hover' | 'focus' | 'active' | 'disabled';

export interface PreviewViewport {
  id: string;
  width?: number;
  height?: number;
}

export interface PreviewTarget {
  id: string;
  selector: string;
}

export interface PreviewContext {
  version: typeof PREVIEW_CONTEXT_VERSION;
  requestRevision: number;
  viewport: PreviewViewport;
  theme: string;
  state: string;
  motionPreference: PreviewMotionPreference;
  selectedTarget?: PreviewTarget;
}

export interface PreviewAxisResult {
  status: PreviewAxisStatus;
  method: string;
  evidence: string[];
  failureReason?: string;
}

export interface PreviewContextResult {
  version: typeof PREVIEW_CONTEXT_VERSION;
  requestRevision: number;
  applied: boolean;
  context: PreviewContext;
  axes: {
    viewport: PreviewAxisResult;
    theme: PreviewAxisResult;
    state: PreviewAxisResult;
    motion: PreviewAxisResult;
  };
  reloadQuery?: Record<string, string>;
  failureReason?: string;
}

export interface PreviewThemeDefinition {
  id: string;
  label: string;
  selector?: string;
  attribute?: string;
  value?: string;
}

export interface PreviewStateDefinition {
  id: string;
  label: string;
  viewport?: { width: number; height: number };
  theme?: string;
  variant?: Record<string, string | number | boolean>;
  pseudoStates?: PreviewPseudoState[];
  reducedMotion?: boolean;
  query?: Record<string, string>;
  evidence?: string[];
}

export interface PreviewBreakpointDefinition {
  id: string;
  label: string;
  width: number;
  height: number;
}

export interface PreviewDesignGraph {
  breakpoints: PreviewBreakpointDefinition[];
  themes: PreviewThemeDefinition[];
  states: PreviewStateDefinition[];
}

export interface PreviewCapabilities {
  viewports: Array<{ id: string; width: number; height: number }>;
  themes: Array<{
    id: string;
    selector?: string;
    attribute?: string;
    value?: string;
  }>;
  states: Array<{
    id: string;
    methods: Array<'query' | 'variant' | 'pseudo' | 'native' | 'reduced-motion'>;
  }>;
  motionPreferences: PreviewMotionPreference[];
}

export interface PreviewAttributeNode {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export interface PreviewThemeRoot extends PreviewAttributeNode {
  classList: Pick<DOMTokenList, 'add' | 'contains' | 'toggle'>;
}

export interface PreviewStateTarget extends PreviewAttributeNode {
  focus?(options?: FocusOptions): void;
}

export interface PreviewThemeBaseline {
  attributes: Map<string, string | null>;
  classes: Map<string, boolean>;
}

export function createPreviewThemeBaseline(): PreviewThemeBaseline {
  return { attributes: new Map(), classes: new Map() };
}

function simpleClassHook(selector: string | undefined): string | undefined {
  if (!selector) return undefined;
  const match = selector.trim().match(/^(?:html|:root)?\.([_a-zA-Z]+[_a-zA-Z0-9-]*)$/);
  return match?.[1];
}

function simpleAttributeHook(
  selector: string | undefined,
): { attribute: string; value: string } | undefined {
  if (!selector) return undefined;
  const match = selector
    .trim()
    .match(/^(?:html|:root)?\[([_a-zA-Z]+[_a-zA-Z0-9:-]*)=["']([^"']+)["']\]$/);
  return match ? { attribute: match[1]!, value: match[2]! } : undefined;
}

export function themeHook(
  theme: PreviewThemeDefinition,
):
  | { method: 'attribute'; attribute: string; value: string }
  | { method: 'class'; className: string }
  | { method: 'unsupported' } {
  if (theme.attribute) {
    return {
      method: 'attribute',
      attribute: theme.attribute,
      value: theme.value ?? theme.id,
    };
  }
  const attribute = simpleAttributeHook(theme.selector);
  if (attribute) return { method: 'attribute', ...attribute };
  const className = simpleClassHook(theme.selector);
  if (className) return { method: 'class', className };
  return { method: 'unsupported' };
}

export function capturePreviewThemeBaseline(
  root: PreviewThemeRoot,
  themes: PreviewThemeDefinition[],
  baseline: PreviewThemeBaseline,
): void {
  for (const definition of themes) {
    const hook = themeHook(definition);
    if (hook.method === 'attribute' && !baseline.attributes.has(hook.attribute)) {
      baseline.attributes.set(hook.attribute, root.getAttribute(hook.attribute));
    }
    if (hook.method === 'class' && !baseline.classes.has(hook.className)) {
      baseline.classes.set(hook.className, root.classList.contains(hook.className));
    }
  }
}

export function restorePreviewThemeBaseline(
  root: PreviewThemeRoot,
  baseline: PreviewThemeBaseline,
): void {
  for (const [attribute, value] of baseline.attributes) {
    if (value == null) root.removeAttribute(attribute);
    else root.setAttribute(attribute, value);
  }
  for (const [className, present] of baseline.classes) root.classList.toggle(className, present);
}

export function applyPreviewTheme(
  root: PreviewThemeRoot,
  theme: PreviewThemeDefinition,
  configuredThemes: PreviewThemeDefinition[] = [theme],
): ReturnType<typeof themeHook> {
  const hook = themeHook(theme);
  for (const definition of configuredThemes) {
    const configuredHook = themeHook(definition);
    if (configuredHook.method === 'attribute') {
      root.removeAttribute(configuredHook.attribute);
    }
    if (configuredHook.method === 'class') {
      root.classList.toggle(configuredHook.className, false);
    }
  }
  if (hook.method === 'attribute') root.setAttribute(hook.attribute, hook.value);
  if (hook.method === 'class') root.classList.add(hook.className);
  return hook;
}

export function variantAttribute(property: string): string {
  return `data-${property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

export function replacePreviewPseudoSelector(
  selectorText: string,
  state: PreviewPseudoState,
  replacement = `[data-foundry-force-${state}]`,
): string | null {
  const pattern = new RegExp(`:${state}(?![-_a-zA-Z0-9])`, 'g');
  if (!pattern.test(selectorText)) return null;
  pattern.lastIndex = 0;
  return selectorText.replace(pattern, replacement);
}

export function authoredPseudoSelectorMatches(
  selectorText: string,
  state: PreviewPseudoState,
  markerSelector: string,
  queryMatches: (selector: string) => boolean,
): boolean {
  const rewritten = replacePreviewPseudoSelector(selectorText, state, markerSelector);
  if (!rewritten) return false;
  const matchable = rewritten.replace(/::[-_a-zA-Z]+[-_a-zA-Z0-9]*(?:\([^)]*\))?/g, '');
  try {
    return queryMatches(matchable);
  } catch {
    return false;
  }
}

export function applyPreviewStateAttributes(
  target: PreviewStateTarget,
  state: PreviewStateDefinition,
): () => void {
  const restorers: Array<() => void> = [];
  const preserve = (name: string): void => {
    const before = target.getAttribute(name);
    restorers.push(() => {
      if (before == null) target.removeAttribute(name);
      else target.setAttribute(name, before);
    });
  };
  for (const [property, value] of Object.entries(state.variant ?? {})) {
    const attribute = variantAttribute(property);
    preserve(attribute);
    target.setAttribute(attribute, String(value));
  }
  for (const pseudo of state.pseudoStates ?? []) {
    const forcedAttribute = `data-foundry-force-${pseudo}`;
    preserve(forcedAttribute);
    target.setAttribute(forcedAttribute, 'true');
    if (pseudo === 'focus') target.focus?.({ preventScroll: true });
    if (pseudo === 'disabled') {
      preserve('disabled');
      preserve('aria-disabled');
      target.setAttribute('disabled', '');
      target.setAttribute('aria-disabled', 'true');
    }
  }
  return () => restorers.reverse().forEach((restore) => restore());
}

export function acceptPreviewRevision(
  requestedRevision: number,
  currentRevision: number,
  latestRequestedRevision = currentRevision,
): number {
  const current = Math.max(currentRevision, latestRequestedRevision);
  if (requestedRevision < current) {
    throw new Error(
      `Preview context revision ${requestedRevision} is stale; current revision is ${current}`,
    );
  }
  return Math.max(current, requestedRevision);
}

export async function applyPreviewMutationAtomically<T>(
  apply: () => T | Promise<T>,
  restore: () => void | Promise<void>,
): Promise<T> {
  try {
    return await apply();
  } catch (error) {
    await restore();
    throw error;
  }
}

export function previewCapabilities(graph: PreviewDesignGraph): PreviewCapabilities {
  return {
    viewports: graph.breakpoints.map(({ id, width, height }) => ({ id, width, height })),
    themes: graph.themes.map(({ id, selector, attribute, value }) => ({
      id,
      ...(selector ? { selector } : {}),
      ...(attribute ? { attribute } : {}),
      ...(value ? { value } : {}),
    })),
    states: graph.states.map((state) => {
      const methods: PreviewCapabilities['states'][number]['methods'] = [];
      if (Object.keys(state.query ?? {}).length) methods.push('query');
      if (Object.keys(state.variant ?? {}).length) methods.push('variant');
      if ((state.pseudoStates ?? []).length) methods.push('pseudo');
      if ((state.pseudoStates ?? []).some((item) => item === 'focus' || item === 'disabled'))
        methods.push('native');
      if (state.reducedMotion) methods.push('reduced-motion');
      return { id: state.id, methods: [...new Set(methods)] };
    }),
    motionPreferences: ['system', 'reduce', 'no-preference'],
  };
}

export function previewContextKey(context: PreviewContext): string {
  return [
    context.viewport.id,
    context.theme,
    context.state,
    context.motionPreference,
    context.selectedTarget?.id ?? 'canvas',
  ].join(':');
}

export function queryForPreviewState(
  states: PreviewStateDefinition[],
  stateId: string,
): Record<string, string> {
  if (stateId === 'current') return {};
  return { ...(states.find((state) => state.id === stateId)?.query ?? {}) };
}

export function previewStateMethods(state: PreviewStateDefinition | undefined): string[] {
  if (!state) return [];
  return previewCapabilities({ breakpoints: [], themes: [], states: [state] }).states[0]!.methods;
}
