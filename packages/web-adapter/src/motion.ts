export type MotionSourceKind = 'css-animation' | 'css-transition' | 'web-animation';

export type MotionPerformanceTier = 'compositor' | 'paint' | 'layout' | 'unknown';

export interface MotionStyleSnapshot {
  animationName: string;
  animationDuration: string;
  animationDelay: string;
  animationTimingFunction: string;
  animationIterationCount: string;
  animationDirection: string;
  animationFillMode: string;
  transitionProperty: string;
  transitionDuration: string;
  transitionDelay: string;
  transitionTimingFunction: string;
}

export interface ActiveMotionSnapshot {
  animation: Animation;
  animationName?: string;
  transitionProperty?: string;
  properties: string[];
  timing: {
    duration: number;
    delay: number;
    easing: string;
    iterations: number;
    direction: PlaybackDirection;
    fill: FillMode;
  };
  keyframes: MotionKeyframe[];
}

export interface MotionKeyframe {
  index: number;
  offset: number;
  easing: string;
  composite: CompositeOperationOrAuto;
  values: Record<string, string | number>;
}

export interface MotionDescriptor {
  id: string;
  label: string;
  kind: MotionSourceKind;
  properties: string[];
  timing: {
    duration: number;
    delay: number;
    easing: string;
    iterations: number;
    direction: PlaybackDirection;
    fill: FillMode;
  };
  performance: {
    tier: MotionPerformanceTier;
    label: string;
    detail: string;
  };
  keyframes: MotionKeyframe[];
  evidence: string[];
}

export interface DiscoveredMotion {
  descriptor: MotionDescriptor;
  animation?: Animation;
}

const DEFAULT_TIMING: MotionDescriptor['timing'] = {
  duration: 0,
  delay: 0,
  easing: 'linear',
  iterations: 1,
  direction: 'normal',
  fill: 'none',
};

export function splitCssList(value: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;
  let quote = '';
  for (const character of value) {
    if (quote) {
      current += character;
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    if (character === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  if (current.trim() || !result.length) result.push(current.trim());
  return result;
}

export function parseCssTime(value: string): number {
  const trimmed = value.trim().toLowerCase();
  const numeric = Number.parseFloat(trimmed);
  if (!Number.isFinite(numeric)) return 0;
  return trimmed.endsWith('ms') ? numeric : numeric * 1000;
}

function listValue(values: string[], index: number, fallback: string): string {
  if (!values.length) return fallback;
  return values[index % values.length] || fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function iterationCount(value: string): number {
  return value.trim() === 'infinite' ? Number.POSITIVE_INFINITY : finiteNumber(value, 1);
}

function timingFromEffect(effect: AnimationEffect | null): MotionDescriptor['timing'] {
  const timing = effect?.getTiming();
  return {
    duration: finiteNumber(timing?.duration, 0),
    delay: finiteNumber(timing?.delay, 0),
    easing: String(timing?.easing ?? 'linear'),
    iterations: finiteNumber(timing?.iterations, 1),
    direction: timing?.direction ?? 'normal',
    fill: timing?.fill ?? 'none',
  };
}

function keyframeProperties(effect: AnimationEffect | null): string[] {
  if (!(effect instanceof KeyframeEffect)) return [];
  const ignored = new Set(['offset', 'easing', 'composite', 'computedOffset']);
  return [...new Set(effect.getKeyframes().flatMap((frame) => Object.keys(frame)))]
    .filter((property) => !ignored.has(property))
    .sort();
}

function keyframeValue(value: unknown): string | number {
  return typeof value === 'number' ? value : String(value ?? '');
}

export function normalizeMotionKeyframes(frames: ComputedKeyframe[]): MotionKeyframe[] {
  const ignored = new Set(['offset', 'easing', 'composite', 'computedOffset']);
  const lastIndex = Math.max(1, frames.length - 1);
  return frames.map((frame, index) => {
    const explicitOffset = typeof frame.offset === 'number' ? frame.offset : undefined;
    const computedOffset =
      typeof frame.computedOffset === 'number' ? frame.computedOffset : index / lastIndex;
    return {
      index,
      offset: Math.max(0, Math.min(1, explicitOffset ?? computedOffset)),
      easing: String(frame.easing ?? 'linear'),
      composite: frame.composite ?? 'auto',
      values: Object.fromEntries(
        Object.entries(frame)
          .filter(([property]) => !ignored.has(property))
          .map(([property, value]) => [property, keyframeValue(value)]),
      ),
    };
  });
}

export function motionKeyframes(effect: AnimationEffect | null): MotionKeyframe[] {
  return effect instanceof KeyframeEffect ? normalizeMotionKeyframes(effect.getKeyframes()) : [];
}

export function editableKeyframes(keyframes: MotionKeyframe[]): Keyframe[] {
  return keyframes.map(({ offset, easing, composite, values }) => ({
    ...values,
    offset,
    easing,
    composite,
  }));
}

export function updateMotionKeyframe(
  keyframes: MotionKeyframe[],
  index: number,
  property: string,
  value: string | number,
): MotionKeyframe[] {
  const current = keyframes[index];
  if (!current) return keyframes;
  const next = keyframes.map((frame) => ({ ...frame, values: { ...frame.values } }));
  const target = next[index]!;
  if (property === 'offset') {
    const previous = next[index - 1]?.offset ?? 0;
    const following = next[index + 1]?.offset ?? 1;
    target.offset = Math.max(previous, Math.min(following, Number(value) / 100));
  } else if (property === 'easing') {
    target.easing = String(value);
  } else {
    target.values[property] = value;
  }
  return next;
}

export function motionKeyframeValue(
  keyframes: MotionKeyframe[],
  index: number,
  property: string,
): string | number | null {
  const frame = keyframes[index];
  if (!frame) return null;
  if (property === 'offset') return Math.round(frame.offset * 10_000) / 100;
  if (property === 'easing') return frame.easing;
  return frame.values[property] ?? null;
}

export function analyzeMotionPerformance(properties: string[]): MotionDescriptor['performance'] {
  const normalized = properties.map((property) => property.trim()).filter(Boolean);
  if (!normalized.length || normalized.includes('all')) {
    return {
      tier: 'unknown',
      label: 'Needs inspection',
      detail: 'The animated properties cannot be isolated from the rendered surface.',
    };
  }
  const layoutProperties = new Set([
    'block-size',
    'bottom',
    'column-gap',
    'flex-basis',
    'font-size',
    'gap',
    'height',
    'inline-size',
    'left',
    'line-height',
    'margin',
    'margin-bottom',
    'margin-left',
    'margin-right',
    'margin-top',
    'max-height',
    'max-width',
    'min-height',
    'min-width',
    'padding',
    'padding-bottom',
    'padding-left',
    'padding-right',
    'padding-top',
    'right',
    'row-gap',
    'top',
    'width',
  ]);
  if (normalized.some((property) => layoutProperties.has(property))) {
    return {
      tier: 'layout',
      label: 'Layout cost',
      detail: 'This motion changes layout and may trigger work on every frame.',
    };
  }
  if (normalized.every((property) => property === 'transform' || property === 'opacity')) {
    return {
      tier: 'compositor',
      label: 'Compositor friendly',
      detail: 'This motion is limited to transform and opacity.',
    };
  }
  return {
    tier: 'paint',
    label: 'Paint cost',
    detail: 'This motion may repaint pixels while it runs.',
  };
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function stableMotionId(
  kind: MotionSourceKind,
  label: string,
  properties: string[],
): string {
  return `motion_${stableHash(`${kind}|${label}|${[...properties].sort().join(',')}`)}`;
}

function descriptor(
  kind: MotionSourceKind,
  label: string,
  properties: string[],
  timing: MotionDescriptor['timing'],
  evidence: string[],
  keyframes: MotionKeyframe[] = [],
): MotionDescriptor {
  return {
    id: stableMotionId(kind, label, properties),
    label,
    kind,
    properties,
    timing,
    performance: analyzeMotionPerformance(properties),
    keyframes,
    evidence,
  };
}

export function describeCssMotion(snapshot: MotionStyleSnapshot): MotionDescriptor[] {
  const result: MotionDescriptor[] = [];
  const names = splitCssList(snapshot.animationName);
  const durations = splitCssList(snapshot.animationDuration);
  const delays = splitCssList(snapshot.animationDelay);
  const easings = splitCssList(snapshot.animationTimingFunction);
  const iterations = splitCssList(snapshot.animationIterationCount);
  const directions = splitCssList(snapshot.animationDirection);
  const fills = splitCssList(snapshot.animationFillMode);
  names.forEach((name, index) => {
    if (!name || name === 'none') return;
    result.push(
      descriptor(
        'css-animation',
        name.replace(/^['"]|['"]$/g, ''),
        [],
        {
          duration: parseCssTime(listValue(durations, index, '0s')),
          delay: parseCssTime(listValue(delays, index, '0s')),
          easing: listValue(easings, index, 'ease'),
          iterations: iterationCount(listValue(iterations, index, '1')),
          direction: listValue(directions, index, 'normal') as PlaybackDirection,
          fill: listValue(fills, index, 'none') as FillMode,
        },
        ['computed animation styles', `@keyframes ${name}`],
      ),
    );
  });

  const transitionProperties = splitCssList(snapshot.transitionProperty);
  const transitionDurations = splitCssList(snapshot.transitionDuration);
  const transitionDelays = splitCssList(snapshot.transitionDelay);
  const transitionEasings = splitCssList(snapshot.transitionTimingFunction);
  transitionProperties.forEach((property, index) => {
    const duration = parseCssTime(listValue(transitionDurations, index, '0s'));
    if (!property || property === 'none' || duration <= 0) return;
    result.push(
      descriptor(
        'css-transition',
        property === 'all' ? 'All property transitions' : `${property} transition`,
        [property],
        {
          ...DEFAULT_TIMING,
          duration,
          delay: parseCssTime(listValue(transitionDelays, index, '0s')),
          easing: listValue(transitionEasings, index, 'ease'),
        },
        ['computed transition styles', `transition-property: ${property}`],
      ),
    );
  });
  return result;
}

function activeSnapshot(animation: Animation): ActiveMotionSnapshot {
  const cssAnimation = animation as Animation & { animationName?: string };
  const cssTransition = animation as Animation & { transitionProperty?: string };
  return {
    animation,
    animationName: cssAnimation.animationName,
    transitionProperty: cssTransition.transitionProperty,
    properties: keyframeProperties(animation.effect),
    timing: timingFromEffect(animation.effect),
    keyframes: motionKeyframes(animation.effect),
  };
}

export function discoverElementMotion(element: HTMLElement): DiscoveredMotion[] {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style) return [];
  const snapshot: MotionStyleSnapshot = {
    animationName: style.animationName,
    animationDuration: style.animationDuration,
    animationDelay: style.animationDelay,
    animationTimingFunction: style.animationTimingFunction,
    animationIterationCount: style.animationIterationCount,
    animationDirection: style.animationDirection,
    animationFillMode: style.animationFillMode,
    transitionProperty: style.transitionProperty,
    transitionDuration: style.transitionDuration,
    transitionDelay: style.transitionDelay,
    transitionTimingFunction: style.transitionTimingFunction,
  };
  const active = element.getAnimations().map(activeSnapshot);
  const discovered = describeCssMotion(snapshot).map((item) => {
    const match = active.find((candidate) =>
      item.kind === 'css-animation'
        ? candidate.animationName === item.label
        : candidate.transitionProperty === item.properties[0],
    );
    const properties = match?.properties.length ? match.properties : item.properties;
    return {
      descriptor: {
        ...item,
        properties,
        timing: match?.timing ?? item.timing,
        performance: analyzeMotionPerformance(properties),
        keyframes: match?.keyframes ?? item.keyframes,
      },
      animation: match?.animation,
    };
  });
  const claimed = new Set(discovered.map((item) => item.animation).filter(Boolean));
  active.forEach((item, index) => {
    if (claimed.has(item.animation)) return;
    const label = item.animationName || item.transitionProperty || `Web animation ${index + 1}`;
    discovered.push({
      descriptor: descriptor(
        'web-animation',
        label,
        item.properties,
        item.timing,
        ['active Web Animations API effect', 'rendered keyframes'],
        item.keyframes,
      ),
      animation: item.animation,
    });
  });
  return discovered;
}

export function motionTimingValue(
  descriptor: MotionDescriptor,
  property: keyof MotionDescriptor['timing'],
): string | number {
  return descriptor.timing[property];
}

export function findDiscoveredMotion(
  element: HTMLElement,
  id: string,
): DiscoveredMotion | undefined {
  return discoverElementMotion(element).find((item) => item.descriptor.id === id);
}
