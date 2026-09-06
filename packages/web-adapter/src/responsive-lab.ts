export type ResponsiveStressMode = 'none' | 'browser-zoom' | 'dynamic-type' | 'long-content';

export interface ResponsiveViewportInput {
  id: string;
  label: string;
  width: number;
  height?: number;
}

export interface ResponsiveViewport extends ResponsiveViewportInput {
  height: number;
  minWidth: number;
  maxWidth?: number;
}

export interface ResponsiveSnapshot {
  viewportId: string;
  viewportWidth: number;
  viewportHeight: number;
  elementWidth: number;
  elementHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
  lineCount?: number;
  top?: number;
  left?: number;
}

export interface ContainerQueryInput {
  id: string;
  label: string;
  name?: string;
  condition: string;
  minWidth?: number;
  maxWidth?: number;
}

export interface ResponsiveContainerRange {
  min: number;
  max: number;
  boundaries: number[];
}

export interface ResponsiveComparison {
  changed: boolean;
  viewportWidthDelta: number;
  containerWidthDelta: number;
  elementWidthDelta: number;
  elementHeightDelta: number;
  positionDelta: number;
  lineCountDelta: number;
  overflowDelta: number;
}

export interface ResponsiveFinding {
  kind: 'overflow' | 'clipping' | 'awkward-wrap' | 'layout-jump';
  severity: 'warning' | 'error';
  viewportId: string;
  message: string;
}

export function responsiveViewports(
  configured: ResponsiveViewportInput[] | null | undefined,
  current: { width: number; height: number },
): ResponsiveViewport[] {
  const source = (configured ?? []).filter((item) => Number.isFinite(item.width) && item.width > 0);
  const unique = new Map<string, ResponsiveViewportInput>();
  for (const item of source) unique.set(item.id, item);
  if (!unique.has('current')) {
    unique.set('current', { id: 'current', label: 'Current', ...current });
  }
  const ordered = [...unique.values()].sort((a, b) => a.width - b.width);
  return ordered.map((item, index) => ({
    ...item,
    height: item.height ?? current.height,
    minWidth: index === 0 ? 0 : ordered[index - 1]!.width + 1,
    ...(ordered[index + 1] ? { maxWidth: ordered[index + 1]!.width } : {}),
  }));
}

export function viewportForWidth(
  viewports: ResponsiveViewport[],
  width: number,
): ResponsiveViewport | undefined {
  return [...viewports].reverse().find((viewport) => width >= viewport.width) ?? viewports[0];
}

export function responsiveScale(
  viewport: Pick<ResponsiveViewport, 'width' | 'height'>,
  bounds: { width: number; height: number },
): number {
  if (viewport.width <= 0 || viewport.height <= 0) return 1;
  return Math.min(1, bounds.width / viewport.width, bounds.height / viewport.height);
}

export function responsiveFindings(snapshots: ResponsiveSnapshot[]): ResponsiveFinding[] {
  const findings: ResponsiveFinding[] = [];
  for (const snapshot of snapshots) {
    if (snapshot.scrollWidth > snapshot.clientWidth + 1) {
      findings.push({
        kind: 'overflow',
        severity: 'error',
        viewportId: snapshot.viewportId,
        message: `${Math.round(snapshot.scrollWidth - snapshot.clientWidth)}px horizontal overflow`,
      });
    }
    if (snapshot.scrollHeight > snapshot.clientHeight + 1) {
      findings.push({
        kind: 'clipping',
        severity: 'warning',
        viewportId: snapshot.viewportId,
        message: 'Selected content is clipped by its rendered box',
      });
    }
    if ((snapshot.lineCount ?? 0) > 3) {
      findings.push({
        kind: 'awkward-wrap',
        severity: 'warning',
        viewportId: snapshot.viewportId,
        message: `Text wraps to ${snapshot.lineCount} lines`,
      });
    }
  }
  for (let index = 1; index < snapshots.length; index += 1) {
    const before = snapshots[index - 1]!;
    const after = snapshots[index]!;
    const widthDelta = Math.abs(after.elementWidth - before.elementWidth);
    const positionDelta = Math.hypot(
      (after.left ?? 0) - (before.left ?? 0),
      (after.top ?? 0) - (before.top ?? 0),
    );
    if (widthDelta > Math.max(64, before.elementWidth * 0.5) || positionDelta > 96) {
      findings.push({
        kind: 'layout-jump',
        severity: 'warning',
        viewportId: after.viewportId,
        message: 'Large layout jump between adjacent viewport contexts',
      });
    }
  }
  return findings;
}

export function responsiveContainerRange(
  queries: ContainerQueryInput[] | null | undefined,
  currentWidth: number,
): ResponsiveContainerRange {
  const boundaries = [
    ...new Set(
      (queries ?? [])
        .flatMap((query) => [query.minWidth, query.maxWidth])
        .filter((width): width is number => Number.isFinite(width)),
    ),
  ].sort((a, b) => a - b);
  if (!boundaries.length) {
    return { min: 64, max: Math.max(1280, currentWidth), boundaries };
  }
  return {
    min: Math.max(64, Math.floor(boundaries[0]! - 160)),
    max: Math.max(currentWidth, Math.ceil(boundaries.at(-1)! + 160)),
    boundaries,
  };
}

export function responsiveComparison(
  before: ResponsiveSnapshot & { containerWidth?: number },
  after: ResponsiveSnapshot & { containerWidth?: number },
): ResponsiveComparison {
  const beforeOverflow = Math.max(0, before.scrollWidth - before.clientWidth);
  const afterOverflow = Math.max(0, after.scrollWidth - after.clientWidth);
  const result = {
    viewportWidthDelta: after.viewportWidth - before.viewportWidth,
    containerWidthDelta: (after.containerWidth ?? 0) - (before.containerWidth ?? 0),
    elementWidthDelta: after.elementWidth - before.elementWidth,
    elementHeightDelta: after.elementHeight - before.elementHeight,
    positionDelta: Math.hypot(
      (after.left ?? 0) - (before.left ?? 0),
      (after.top ?? 0) - (before.top ?? 0),
    ),
    lineCountDelta: (after.lineCount ?? 0) - (before.lineCount ?? 0),
    overflowDelta: afterOverflow - beforeOverflow,
  };
  return {
    changed: Object.values(result).some((value) => Math.abs(value) > 0.5),
    ...result,
  };
}

export function responsiveEditScopes(hasSourceMapping: boolean): Array<{
  id: 'breakpoint' | 'all';
  enabled: boolean;
  label: string;
}> {
  return [
    { id: 'breakpoint', enabled: true, label: 'This breakpoint' },
    { id: 'all', enabled: hasSourceMapping, label: 'All breakpoints' },
  ];
}
