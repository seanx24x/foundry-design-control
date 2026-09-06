export type MotionSourceKind =
  'css-animation' | 'css-transition' | 'web-animation' | 'motion-react' | 'gsap' | 'react-spring';

export type NativeMotionAdapter = 'motion' | 'gsap' | 'react-spring';

export interface NativeMotionSource {
  file: string;
  line?: number;
  column?: number;
  symbol?: string;
}

export interface NativeMotionAuthoring {
  adapter: NativeMotionAdapter;
  label: string;
  source?: NativeMotionSource;
  sourceProperties: Record<string, string>;
  evidence: string[];
}

export interface NativeMotionInput {
  adapter: NativeMotionAdapter;
  label?: string;
  from?: Record<string, string | number>;
  to?: Record<string, string | number>;
  keyframes?: Array<Record<string, string | number>>;
  transition?: Record<string, unknown>;
  config?: Record<string, unknown>;
  source?: NativeMotionSource;
  sourceProperties?: Record<string, string>;
  animation?: Animation;
  createPreview?: boolean;
}

export interface NativeMotionBinding {
  adapter: NativeMotionAdapter;
  label: string;
  timing: MotionDescriptor['timing'];
  keyframes: MotionKeyframe[];
  curve: MotionCurveSnapshot;
  authoring: NativeMotionAuthoring;
  animation?: Animation;
}

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
  authoring?: NativeMotionAuthoring;
}

export interface DiscoveredMotion {
  descriptor: MotionDescriptor;
  animation?: Animation;
  native?: NativeMotionBinding;
}

export interface CubicBezierCurve {
  kind: 'cubic-bezier';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SpringCurve {
  kind: 'spring';
  mass: number;
  stiffness: number;
  damping: number;
  velocity: number;
}

export interface CustomMotionCurve {
  kind: 'custom';
  sourceValue: string;
}

export type MotionCurve = CubicBezierCurve | SpringCurve | CustomMotionCurve;

export interface MotionCurveSnapshot {
  kind: MotionCurve['kind'];
  sourceValue: string;
  previewValue: string;
  points: Array<{ x: number; y: number }>;
  cubicBezier?: Omit<CubicBezierCurve, 'kind'>;
  spring?: Omit<SpringCurve, 'kind'>;
  diagnostics: {
    duration: number;
    overshoot: number;
    sampleCount: number;
  };
}

export interface MotionPathPoint {
  index: number;
  offset: number;
  x: number;
  y: number;
  sourceValue: string;
}

export interface MotionPathSnapshot {
  supported: boolean;
  property: 'transform';
  points: MotionPathPoint[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  distance: number;
  reason?: string;
}

const DEFAULT_TIMING: MotionDescriptor['timing'] = {
  duration: 0,
  delay: 0,
  easing: 'linear',
  iterations: 1,
  direction: 'normal',
  fill: 'none',
};

const CUBIC_BEZIER_KEYWORDS: Record<string, Omit<CubicBezierCurve, 'kind'>> = {
  ease: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  'ease-in': { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  'ease-out': { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  'ease-in-out': { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  linear: { x1: 0, y1: 0, x2: 1, y2: 1 },
};

const nativeMotionRegistry = new WeakMap<HTMLElement, NativeMotionBinding[]>();

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function rounded(value: number, precision = 3): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

function compactNumber(value: number, precision = 3): string {
  return String(rounded(value, precision));
}

function pixelValue(value: string | undefined): number | null {
  if (value == null) return 0;
  const trimmed = value.trim();
  if (trimmed === '0') return 0;
  const match = /^(-?[\d.]+)px$/i.exec(trimmed);
  return match ? Number(match[1]) : null;
}

export function motionTranslation(value: string): { x: number; y: number } | null {
  const source = value.trim();
  if (!source || source === 'none') return { x: 0, y: 0 };
  const matrix3d = /^matrix3d\(([^)]+)\)$/i.exec(source);
  if (matrix3d) {
    const values = matrix3d[1]!.split(',').map(Number);
    return values.length === 16 && values.every(Number.isFinite)
      ? { x: values[12]!, y: values[13]! }
      : null;
  }
  const matrix = /^matrix\(([^)]+)\)$/i.exec(source);
  if (matrix) {
    const values = matrix[1]!.split(',').map(Number);
    return values.length === 6 && values.every(Number.isFinite)
      ? { x: values[4]!, y: values[5]! }
      : null;
  }
  let x = 0;
  let y = 0;
  let matched = false;
  const pattern = /(translate3d|translate|translateX|translateY)\(([^)]+)\)/gi;
  for (const match of source.matchAll(pattern)) {
    matched = true;
    const values = match[2]!.split(',').map((part) => part.trim());
    if (match[1]!.toLowerCase() === 'translatex') {
      const next = pixelValue(values[0]);
      if (next == null) return null;
      x += next;
    } else if (match[1]!.toLowerCase() === 'translatey') {
      const next = pixelValue(values[0]);
      if (next == null) return null;
      y += next;
    } else {
      const nextX = pixelValue(values[0]);
      const nextY = pixelValue(values[1]);
      if (nextX == null || nextY == null) return null;
      x += nextX;
      y += nextY;
    }
  }
  return matched ? { x, y } : null;
}

export function replaceMotionTranslation(value: string, x: number, y: number): string {
  const source = value.trim();
  const nextX = rounded(finiteNumber(x, 0), 2);
  const nextY = rounded(finiteNumber(y, 0), 2);
  const matrix3d = /^matrix3d\(([^)]+)\)$/i.exec(source);
  if (matrix3d) {
    const values = matrix3d[1]!.split(',').map(Number);
    if (values.length === 16 && values.every(Number.isFinite)) {
      values[12] = nextX;
      values[13] = nextY;
      return `matrix3d(${values.map((item) => compactNumber(item, 4)).join(', ')})`;
    }
  }
  const matrix = /^matrix\(([^)]+)\)$/i.exec(source);
  if (matrix) {
    const values = matrix[1]!.split(',').map(Number);
    if (values.length === 6 && values.every(Number.isFinite)) {
      values[4] = nextX;
      values[5] = nextY;
      return `matrix(${values.map((item) => compactNumber(item, 4)).join(', ')})`;
    }
  }
  const withoutTranslation = source
    .replace(/(?:translate3d|translate|translateX|translateY)\([^)]+\)\s*/gi, '')
    .trim();
  const translation = `translate(${compactNumber(nextX, 2)}px, ${compactNumber(nextY, 2)}px)`;
  return withoutTranslation && withoutTranslation !== 'none'
    ? `${translation} ${withoutTranslation}`
    : translation;
}

export function motionPathSnapshot(keyframes: MotionKeyframe[]): MotionPathSnapshot {
  const points: MotionPathPoint[] = [];
  for (const frame of keyframes) {
    const sourceValue = String(frame.values.transform ?? 'none');
    const translation = motionTranslation(sourceValue);
    if (!translation) continue;
    points.push({
      index: frame.index,
      offset: frame.offset,
      x: rounded(translation.x, 2),
      y: rounded(translation.y, 2),
      sourceValue,
    });
  }
  const emptyBounds = {
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
    width: 0,
    height: 0,
  };
  if (points.length < 2) {
    return {
      supported: false,
      property: 'transform',
      points,
      bounds: emptyBounds,
      distance: 0,
      reason: 'Two pixel-based transform keyframes are required to author a motion path.',
    };
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const distance = points.slice(1).reduce((total, point, index) => {
    const previous = points[index]!;
    return total + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
  return {
    supported: true,
    property: 'transform',
    points,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      width: rounded(maxX - minX, 2),
      height: rounded(maxY - minY, 2),
    },
    distance: rounded(distance, 2),
  };
}

export function normalizeCubicBezier(curve: Omit<CubicBezierCurve, 'kind'>): CubicBezierCurve {
  return {
    kind: 'cubic-bezier',
    x1: clamp(finiteNumber(curve.x1, 0.25), 0, 1),
    y1: clamp(finiteNumber(curve.y1, 0.1), -2, 3),
    x2: clamp(finiteNumber(curve.x2, 0.25), 0, 1),
    y2: clamp(finiteNumber(curve.y2, 1), -2, 3),
  };
}

export function normalizeSpring(curve: Omit<SpringCurve, 'kind'>): SpringCurve {
  return {
    kind: 'spring',
    mass: clamp(finiteNumber(curve.mass, 1), 0.1, 20),
    stiffness: clamp(finiteNumber(curve.stiffness, 170), 1, 2000),
    damping: clamp(finiteNumber(curve.damping, 26), 0.1, 200),
    velocity: clamp(finiteNumber(curve.velocity, 0), -20, 20),
  };
}

export function parseMotionCurve(value: string): MotionCurve {
  const normalized = value.trim().toLowerCase();
  const keyword = CUBIC_BEZIER_KEYWORDS[normalized];
  if (keyword) return normalizeCubicBezier(keyword);
  const cubic =
    /^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/i.exec(
      value,
    );
  if (cubic) {
    return normalizeCubicBezier({
      x1: Number(cubic[1]),
      y1: Number(cubic[2]),
      x2: Number(cubic[3]),
      y2: Number(cubic[4]),
    });
  }
  const spring =
    /^spring\(\s*(-?[\d.]+)(?:\s*,\s*|\s+)(-?[\d.]+)(?:\s*,\s*|\s+)(-?[\d.]+)(?:(?:\s*,\s*|\s+)(-?[\d.]+))?\s*\)$/i.exec(
      value,
    );
  if (spring) {
    return normalizeSpring({
      mass: Number(spring[1]),
      stiffness: Number(spring[2]),
      damping: Number(spring[3]),
      velocity: Number(spring[4] ?? 0),
    });
  }
  return { kind: 'custom', sourceValue: value.trim() || 'linear' };
}

export function serializeCubicBezier(curve: Omit<CubicBezierCurve, 'kind'>): string {
  const value = normalizeCubicBezier(curve);
  return `cubic-bezier(${compactNumber(value.x1)}, ${compactNumber(value.y1)}, ${compactNumber(value.x2)}, ${compactNumber(value.y2)})`;
}

export function serializeSpring(curve: Omit<SpringCurve, 'kind'>): string {
  const value = normalizeSpring(curve);
  return `spring(${compactNumber(value.mass)}, ${compactNumber(value.stiffness)}, ${compactNumber(value.damping)}, ${compactNumber(value.velocity)})`;
}

function cubicCoordinate(t: number, first: number, second: number): number {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * first + 3 * inverse * t * t * second + t * t * t;
}

function cubicDerivative(t: number, first: number, second: number): number {
  const inverse = 1 - t;
  return (
    3 * inverse * inverse * first + 6 * inverse * t * (second - first) + 3 * t * t * (1 - second)
  );
}

export function sampleCubicBezier(curve: Omit<CubicBezierCurve, 'kind'>, progress: number): number {
  const value = normalizeCubicBezier(curve);
  const target = clamp(progress, 0, 1);
  let parameter = target;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const difference = cubicCoordinate(parameter, value.x1, value.x2) - target;
    const derivative = cubicDerivative(parameter, value.x1, value.x2);
    if (Math.abs(difference) < 0.000001 || Math.abs(derivative) < 0.000001) break;
    parameter = clamp(parameter - difference / derivative, 0, 1);
  }
  return cubicCoordinate(parameter, value.y1, value.y2);
}

function springPositionAtTime(curve: SpringCurve, time: number): number {
  const omega0 = Math.sqrt(curve.stiffness / curve.mass);
  const dampingRatio = curve.damping / (2 * Math.sqrt(curve.stiffness * curve.mass));
  if (dampingRatio < 1) {
    const omegaD = omega0 * Math.sqrt(1 - dampingRatio * dampingRatio);
    const envelope = Math.exp(-dampingRatio * omega0 * time);
    const coefficient = (dampingRatio * omega0 - curve.velocity) / omegaD;
    return 1 - envelope * (Math.cos(omegaD * time) + coefficient * Math.sin(omegaD * time));
  }
  if (Math.abs(dampingRatio - 1) < 0.0001) {
    const envelope = Math.exp(-omega0 * time);
    return 1 - envelope * (1 + (omega0 - curve.velocity) * time);
  }
  const root = Math.sqrt(dampingRatio * dampingRatio - 1);
  const first = -omega0 * (dampingRatio - root);
  const second = -omega0 * (dampingRatio + root);
  const firstCoefficient = (curve.velocity + second) / (first - second);
  const secondCoefficient = 1 - firstCoefficient;
  return (
    1 - firstCoefficient * Math.exp(first * time) - secondCoefficient * Math.exp(second * time)
  );
}

export function springSettlingDuration(curve: Omit<SpringCurve, 'kind'>): number {
  const value = normalizeSpring(curve);
  const step = 1 / 120;
  let settledFrames = 0;
  let previous = springPositionAtTime(value, 0);
  for (let time = step; time <= 10; time += step) {
    const position = springPositionAtTime(value, time);
    const velocity = Math.abs(position - previous) / step;
    previous = position;
    if (Math.abs(1 - position) < 0.001 && velocity < 0.01) settledFrames += 1;
    else settledFrames = 0;
    if (settledFrames >= 12) return rounded((time - step * 11) * 1000, 0);
  }
  return 10_000;
}

export function sampleSpring(
  curve: Omit<SpringCurve, 'kind'>,
  progress: number,
  duration = springSettlingDuration(curve),
): number {
  const value = normalizeSpring(curve);
  return springPositionAtTime(value, clamp(progress, 0, 1) * (duration / 1000));
}

export function springLinearEasing(curve: Omit<SpringCurve, 'kind'>, sampleCount = 31): string {
  const value = normalizeSpring(curve);
  const duration = springSettlingDuration(value);
  const count = Math.round(clamp(sampleCount, 11, 81));
  const samples = Array.from({ length: count }, (_, index) => {
    const progress = index / (count - 1);
    return `${compactNumber(sampleSpring(value, progress, duration), 4)} ${compactNumber(progress * 100, 2)}%`;
  });
  return `linear(${samples.join(', ')})`;
}

export function motionCurveSnapshot(
  input: MotionCurve | string,
  sampleCount = 61,
): MotionCurveSnapshot {
  const curve = typeof input === 'string' ? parseMotionCurve(input) : input;
  const count = Math.round(clamp(sampleCount, 21, 121));
  if (curve.kind === 'spring') {
    const spring = normalizeSpring(curve);
    const duration = springSettlingDuration(spring);
    const points = Array.from({ length: count }, (_, index) => {
      const x = index / (count - 1);
      return { x, y: sampleSpring(spring, x, duration) };
    });
    return {
      kind: 'spring',
      sourceValue: springLinearEasing(spring),
      previewValue: springLinearEasing(spring),
      points,
      spring: {
        mass: spring.mass,
        stiffness: spring.stiffness,
        damping: spring.damping,
        velocity: spring.velocity,
      },
      diagnostics: {
        duration,
        overshoot: rounded(Math.max(0, ...points.map((point) => point.y - 1)) * 100, 1),
        sampleCount: 31,
      },
    };
  }
  if (curve.kind === 'cubic-bezier') {
    const cubicBezier = normalizeCubicBezier(curve);
    const points = Array.from({ length: count }, (_, index) => {
      const x = index / (count - 1);
      return { x, y: sampleCubicBezier(cubicBezier, x) };
    });
    const sourceValue = serializeCubicBezier(cubicBezier);
    return {
      kind: 'cubic-bezier',
      sourceValue,
      previewValue: sourceValue,
      points,
      cubicBezier: {
        x1: cubicBezier.x1,
        y1: cubicBezier.y1,
        x2: cubicBezier.x2,
        y2: cubicBezier.y2,
      },
      diagnostics: { duration: 0, overshoot: 0, sampleCount: count },
    };
  }
  const points = Array.from({ length: count }, (_, index) => {
    const x = index / (count - 1);
    return { x, y: x };
  });
  return {
    kind: 'custom',
    sourceValue: curve.sourceValue,
    previewValue: curve.sourceValue,
    points,
    diagnostics: { duration: 0, overshoot: 0, sampleCount: count },
  };
}

function secondsToMilliseconds(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric * 1000) : fallback;
}

function cssEase(value: unknown): string {
  if (Array.isArray(value) && value.length === 4) {
    return serializeCubicBezier({
      x1: Number(value[0]),
      y1: Number(value[1]),
      x2: Number(value[2]),
      y2: Number(value[3]),
    });
  }
  const raw = String(value ?? 'ease').trim();
  const aliases: Record<string, string> = {
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    'power1.in': 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
    'power1.out': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    'power1.inOut': 'cubic-bezier(0.455, 0.03, 0.515, 0.955)',
    'power2.in': 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
    'power2.out': 'cubic-bezier(0.215, 0.61, 0.355, 1)',
    'power2.inOut': 'cubic-bezier(0.645, 0.045, 0.355, 1)',
  };
  return aliases[raw] ?? raw;
}

function nativeValues(values: Record<string, string | number>): Record<string, string | number> {
  const next = { ...values };
  const transforms: string[] = [];
  const x = next.x;
  const y = next.y;
  const scale = next.scale;
  const rotate = next.rotate;
  delete next.x;
  delete next.y;
  delete next.scale;
  delete next.rotate;
  if (x != null || y != null) {
    const xValue = typeof x === 'number' ? `${x}px` : String(x ?? '0px');
    const yValue = typeof y === 'number' ? `${y}px` : String(y ?? '0px');
    transforms.push(`translate(${xValue}, ${yValue})`);
  }
  if (scale != null) transforms.push(`scale(${scale})`);
  if (rotate != null) {
    transforms.push(`rotate(${typeof rotate === 'number' ? `${rotate}deg` : rotate})`);
  }
  if (transforms.length) next.transform = transforms.join(' ');
  return next;
}

function nativeKeyframes(input: NativeMotionInput): MotionKeyframe[] {
  const raw = input.keyframes?.length
    ? input.keyframes
    : input.from || input.to
      ? [input.from ?? {}, input.to ?? {}]
      : [];
  const last = Math.max(1, raw.length - 1);
  return raw.map((values, index) => ({
    index,
    offset: index / last,
    easing: 'linear',
    composite: 'auto',
    values: nativeValues(values),
  }));
}

function nativeAdapterDefaults(adapter: NativeMotionAdapter): {
  label: string;
  sourceProperties: Record<string, string>;
  evidence: string[];
} {
  if (adapter === 'motion') {
    return {
      label: 'Motion for React',
      sourceProperties: {
        duration: 'transition.duration',
        delay: 'transition.delay',
        easing: 'transition.ease',
        spring: 'transition',
        keyframes: 'initial / animate',
      },
      evidence: ['Motion for React transition', 'initial and animate values'],
    };
  }
  if (adapter === 'gsap') {
    return {
      label: 'GSAP',
      sourceProperties: {
        duration: 'vars.duration',
        delay: 'vars.delay',
        easing: 'vars.ease',
        keyframes: 'from / to vars',
      },
      evidence: ['GSAP tween vars', 'from and to values'],
    };
  }
  return {
    label: 'React Spring',
    sourceProperties: {
      duration: 'config.duration',
      delay: 'delay',
      easing: 'config.easing',
      spring: 'config.mass / tension / friction / velocity',
      keyframes: 'from / to',
    },
    evidence: ['React Spring config', 'from and to values'],
  };
}

export function nativeMotionBinding(input: NativeMotionInput): NativeMotionBinding {
  const defaults = nativeAdapterDefaults(input.adapter);
  const transition = input.transition ?? {};
  const config = input.config ?? transition;
  const springRequested =
    input.adapter === 'react-spring' || String(transition.type ?? '').toLowerCase() === 'spring';
  const spring = normalizeSpring({
    mass: Number(config.mass ?? 1),
    stiffness: Number(config.stiffness ?? config.tension ?? 170),
    damping: Number(config.damping ?? config.friction ?? 26),
    velocity: Number(config.velocity ?? config.initialVelocity ?? 0),
  });
  const sourceEasing = springRequested
    ? serializeSpring(spring)
    : cssEase(transition.ease ?? config.ease ?? config.easing ?? 'ease');
  const curve = motionCurveSnapshot(springRequested ? spring : sourceEasing);
  const springDuration = springSettlingDuration(spring);
  const duration =
    input.adapter === 'react-spring' && config.duration != null
      ? Math.max(0, Number(config.duration))
      : transition.duration != null
        ? secondsToMilliseconds(transition.duration, curve.diagnostics.duration || 300)
        : input.adapter === 'gsap' && config.duration != null
          ? secondsToMilliseconds(config.duration, 300)
          : springRequested
            ? springDuration
            : 300;
  const delaySource = transition.delay ?? config.delay ?? 0;
  const delay =
    input.adapter === 'react-spring'
      ? Math.max(0, Number(delaySource) || 0)
      : secondsToMilliseconds(delaySource, 0);
  const repeat = Number(transition.repeat ?? config.repeat ?? 0);
  const repeatType = String(transition.repeatType ?? config.yoyo ?? 'normal');
  return {
    adapter: input.adapter,
    label: input.label ?? defaults.label,
    timing: {
      duration,
      delay,
      easing: sourceEasing,
      iterations: Number.isFinite(repeat) ? Math.max(1, repeat + 1) : 1,
      direction:
        repeatType === 'reverse' || repeatType === 'mirror' || repeatType === 'true'
          ? 'alternate'
          : 'normal',
      fill: 'both',
    },
    keyframes: nativeKeyframes(input),
    curve,
    authoring: {
      adapter: input.adapter,
      label: defaults.label,
      source: input.source,
      sourceProperties: { ...defaults.sourceProperties, ...input.sourceProperties },
      evidence: [...defaults.evidence, 'Foundry native motion adapter'],
    },
    animation: input.animation,
  };
}

export function registerNativeMotion(element: HTMLElement, input: NativeMotionInput): () => void {
  const binding = nativeMotionBinding(input);
  const existing = element.getAnimations().at(-1);
  let created = false;
  if (!binding.animation && existing) binding.animation = existing;
  if (!binding.animation && input.createPreview !== false && binding.keyframes.length >= 2) {
    binding.animation = element.animate(editableKeyframes(binding.keyframes), {
      ...binding.timing,
      easing: binding.curve.previewValue,
    });
    binding.animation.pause();
    created = true;
  }
  const current = nativeMotionRegistry.get(element) ?? [];
  current.push(binding);
  nativeMotionRegistry.set(element, current);
  return () => {
    const remaining = (nativeMotionRegistry.get(element) ?? []).filter(
      (candidate) => candidate !== binding,
    );
    if (remaining.length) nativeMotionRegistry.set(element, remaining);
    else nativeMotionRegistry.delete(element);
    if (created) binding.animation?.cancel();
  };
}

function elementNativeMotion(element: HTMLElement): NativeMotionBinding[] {
  const current = nativeMotionRegistry.get(element);
  if (current?.length) return current;
  const encoded = element.dataset.foundryMotion;
  if (!encoded) return [];
  try {
    const decoded = JSON.parse(encoded) as NativeMotionInput | NativeMotionInput[];
    const entries = Array.isArray(decoded) ? decoded : [decoded];
    entries.forEach((entry) => registerNativeMotion(element, entry));
  } catch {
    return [];
  }
  return nativeMotionRegistry.get(element) ?? [];
}

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
  const next = keyframes.map((frame) => ({
    ...frame,
    values: { ...frame.values },
  }));
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
  authoring?: NativeMotionAuthoring,
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
    authoring,
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
  const cssTransition = animation as Animation & {
    transitionProperty?: string;
  };
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
  const native = elementNativeMotion(element);
  const nativeDiscovered: DiscoveredMotion[] = native.map((binding) => {
    const kind: MotionSourceKind =
      binding.adapter === 'motion'
        ? 'motion-react'
        : binding.adapter === 'gsap'
          ? 'gsap'
          : 'react-spring';
    const properties = [
      ...new Set(binding.keyframes.flatMap((frame) => Object.keys(frame.values))),
    ].sort();
    return {
      descriptor: descriptor(
        kind,
        binding.label,
        properties,
        binding.timing,
        [...binding.authoring.evidence, ...(binding.authoring.source ? ['source mapped'] : [])],
        binding.keyframes,
        binding.authoring,
      ),
      animation: binding.animation,
      native: binding,
    };
  });
  const nativeAnimations = new Set(native.map((binding) => binding.animation).filter(Boolean));
  const active = element
    .getAnimations()
    .filter((animation) => !nativeAnimations.has(animation))
    .map(activeSnapshot);
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
  return [...nativeDiscovered, ...discovered];
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
