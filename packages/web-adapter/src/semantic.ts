export interface BrowserSourceRef {
  file: string;
  line?: number;
  column?: number;
}

export interface BrowserMappingCandidate {
  id: string;
  label: string;
  intent:
    | 'resize'
    | 'spacing'
    | 'align'
    | 'distribute'
    | 'position'
    | 'style'
    | 'content'
    | 'motion'
    | 'state';
  property: string;
  targetId?: string;
  value: string | number;
  source?: BrowserSourceRef;
  scope: 'instance' | 'component';
  confidence: 'measured' | 'instrumented' | 'inferred' | 'unresolved';
  evidence: string[];
  blastRadius: number;
}

export interface LayoutContext {
  targetId: string;
  property: string;
  value: string | number;
  scope: 'instance' | 'component';
  source?: BrowserSourceRef;
  parentDisplay: string;
  parentFlexDirection: string;
  position: string;
  componentInstances: number;
}

function candidate(
  context: LayoutContext,
  property: string,
  label: string,
  intent: BrowserMappingCandidate['intent'],
  evidence: string[],
): BrowserMappingCandidate {
  return {
    id: `map-${context.targetId}-${property}`,
    label,
    intent,
    property,
    targetId: context.targetId,
    value: context.value,
    source: context.source,
    scope: context.scope,
    confidence: context.source ? 'instrumented' : 'inferred',
    evidence,
    blastRadius: context.scope === 'component' ? Math.max(1, context.componentInstances) : 1,
  };
}

export function semanticCandidates(context: LayoutContext): BrowserMappingCandidate[] {
  const property = context.property;
  if (property.startsWith('animation.')) {
    return [
      candidate(context, property, `Set ${property.split('.').at(-1)}`, 'motion', [
        'live Web Animation',
        'computed animation timing',
      ]),
    ];
  }
  if (['textContent', 'src', 'alt', 'aria-label'].includes(property)) {
    return [candidate(context, property, `Set ${property}`, 'content', ['rendered content'])];
  }
  const axisIsFlex =
    (property === 'width' && context.parentFlexDirection.startsWith('row')) ||
    (property === 'height' && context.parentFlexDirection.startsWith('column'));
  if (
    ['width', 'height'].includes(property) &&
    context.parentDisplay.includes('flex') &&
    axisIsFlex
  ) {
    return [
      candidate(context, 'flexBasis', 'Resize along the parent flex axis', 'resize', [
        'parent uses flex layout',
        `parent flex-direction is ${context.parentFlexDirection}`,
      ]),
      candidate(context, property, `Set the element ${property}`, 'resize', [
        'measured element size',
        'explicit element dimension',
      ]),
    ];
  }
  if (['width', 'height'].includes(property)) {
    return [
      candidate(context, property, `Set the element ${property}`, 'resize', [
        `${context.parentDisplay || 'block'} layout`,
        'measured element size',
      ]),
    ];
  }
  if (/^(padding|margin|gap)/.test(property)) {
    return [
      candidate(context, property, `Set ${property}`, 'spacing', [
        'computed box model',
        context.parentDisplay ? `layout context ${context.parentDisplay}` : 'element spacing',
      ]),
    ];
  }
  if (/^(top|right|bottom|left|inset)/.test(property)) {
    return [
      candidate(context, property, `Set ${property}`, 'position', [
        `position is ${context.position}`,
      ]),
    ];
  }
  return [candidate(context, property, `Set ${property}`, 'style', ['computed style'])];
}

export function candidatesForElement(
  element: HTMLElement,
  property: string,
  value: string | number,
  targetId: string,
  scope: 'instance' | 'component',
  source?: BrowserSourceRef,
): BrowserMappingCandidate[] {
  const parent = element.parentElement;
  const parentStyle = parent ? getComputedStyle(parent) : undefined;
  const instances = element.dataset.foundryComponent
    ? document.querySelectorAll(
        `[data-foundry-component="${CSS.escape(element.dataset.foundryComponent)}"]`,
      ).length
    : 1;
  return semanticCandidates({
    targetId,
    property,
    value,
    scope,
    source,
    parentDisplay: parentStyle?.display ?? 'block',
    parentFlexDirection: parentStyle?.flexDirection ?? 'row',
    position: getComputedStyle(element).position,
    componentInstances: instances,
  });
}

export interface BrowserDesignToken {
  id: string;
  name: string;
  value: string;
  category: string;
  cssVariable?: string;
}

function comparable(value: string | number): string {
  return String(value).trim().toLowerCase().replaceAll(' ', '');
}

export function matchingTokens(
  tokens: BrowserDesignToken[],
  property: string,
  value: string | number,
): BrowserDesignToken[] {
  const expectedCategory = /color|background|borderColor/i.test(property)
    ? 'color'
    : /radius/i.test(property)
      ? 'radius'
      : /font|lineHeight|letterSpacing/i.test(property)
        ? 'typography'
        : /gap|padding|margin/i.test(property)
          ? 'spacing'
          : undefined;
  return tokens
    .filter((token) => !expectedCategory || token.category === expectedCategory)
    .filter((token) => comparable(token.value) === comparable(value))
    .slice(0, 6);
}
