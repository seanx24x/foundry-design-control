export interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LayerSignals {
  instrumented: boolean;
  interactive: boolean;
  semantic: boolean;
  labelled: boolean;
  decorative: boolean;
  area: number;
  depth: number;
}

export interface SpacingSegment {
  axis: 'horizontal' | 'vertical';
  from: number;
  to: number;
  cross: number;
  gap: number;
}

export function layerSelectionScore(signals: LayerSignals): number {
  return (
    (signals.instrumented ? 160 : 0) +
    (signals.interactive ? 90 : 0) +
    (signals.semantic ? 40 : 0) +
    (signals.labelled ? 24 : 0) +
    Math.min(20, signals.depth * 2) +
    (signals.area >= 144 ? 8 : -12) -
    (signals.decorative ? 120 : 0)
  );
}

export function orderedSelectionIndexes(signals: LayerSignals[]): number[] {
  return signals
    .map((item, index) => ({ index, score: layerSelectionScore(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.index);
}

export function nextCycleIndex(current: number, count: number): number {
  if (count <= 0) return -1;
  return (current + 1) % count;
}

export function snapValue(
  value: number,
  guides: number[],
  tolerance = 4,
): { value: number; guide?: number } {
  let closest: number | undefined;
  let distance = Number.POSITIVE_INFINITY;
  for (const guide of guides) {
    const nextDistance = Math.abs(value - guide);
    if (nextDistance <= tolerance && nextDistance < distance) {
      closest = guide;
      distance = nextDistance;
    }
  }
  return closest == null ? { value } : { value: closest, guide: closest };
}

function center(rect: CanvasRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function spacingSegments(rects: CanvasRect[]): SpacingSegment[] {
  if (rects.length < 2) return [];
  const centers = rects.map(center);
  const horizontalSpread =
    Math.max(...centers.map((item) => item.x)) - Math.min(...centers.map((item) => item.x));
  const verticalSpread =
    Math.max(...centers.map((item) => item.y)) - Math.min(...centers.map((item) => item.y));
  const positiveGapCount = (axis: 'horizontal' | 'vertical'): number => {
    const sorted = [...rects].sort((a, b) =>
      axis === 'horizontal' ? a.left - b.left : a.top - b.top,
    );
    let count = 0;
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const current = sorted[index];
      const next = sorted[index + 1];
      if (!current || !next) continue;
      const from =
        axis === 'horizontal' ? current.left + current.width : current.top + current.height;
      const to = axis === 'horizontal' ? next.left : next.top;
      if (to >= from) count += 1;
    }
    return count;
  };
  const horizontalGaps = positiveGapCount('horizontal');
  const verticalGaps = positiveGapCount('vertical');
  const averageWidth = rects.reduce((sum, rect) => sum + rect.width, 0) / rects.length;
  const averageHeight = rects.reduce((sum, rect) => sum + rect.height, 0) / rects.length;
  const axis =
    horizontalGaps === verticalGaps
      ? horizontalSpread / Math.max(1, averageWidth) >= verticalSpread / Math.max(1, averageHeight)
        ? 'horizontal'
        : 'vertical'
      : horizontalGaps > verticalGaps
        ? 'horizontal'
        : 'vertical';
  const sorted = [...rects].sort((a, b) =>
    axis === 'horizontal' ? a.left - b.left : a.top - b.top,
  );
  const segments: SpacingSegment[] = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (!current || !next) continue;
    const from =
      axis === 'horizontal' ? current.left + current.width : current.top + current.height;
    const to = axis === 'horizontal' ? next.left : next.top;
    const gap = to - from;
    if (gap < 0) continue;
    segments.push({
      axis,
      from,
      to,
      cross:
        axis === 'horizontal'
          ? (center(current).y + center(next).y) / 2
          : (center(current).x + center(next).x) / 2,
      gap,
    });
  }
  return segments;
}
