export type SizingMode = 'fixed' | 'hug' | 'fill' | 'min-max';

export interface ImpactInput {
  scope: 'instance' | 'component';
  breakpoint: string;
  theme: string;
  state?: string;
  token?: string;
  componentInstances?: number;
  unresolved?: boolean;
}

export function detectSizingMode(
  authoredValue: string,
  flexGrow = '0',
  minValue = '0px',
  maxValue = 'none',
): SizingMode {
  const constrainedMinimum = !['0', '0px', 'auto', 'none', ''].includes(minValue.trim());
  const constrainedMaximum = !['none', 'auto', ''].includes(maxValue.trim());
  if (constrainedMinimum || constrainedMaximum) return 'min-max';
  if (authoredValue === 'max-content' || authoredValue === 'fit-content') return 'hug';
  if (authoredValue === '100%' || Number.parseFloat(flexGrow) > 0) return 'fill';
  return 'fixed';
}

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function parseColor(value: string): [number, number, number, number] | null {
  const normalized = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(normalized)?.[1];
  if (hex) {
    const expanded =
      hex.length === 3 || hex.length === 4
        ? [...hex].map((character) => character.repeat(2)).join('')
        : hex;
    if (expanded.length !== 6 && expanded.length !== 8) return null;
    return [
      Number.parseInt(expanded.slice(0, 2), 16),
      Number.parseInt(expanded.slice(2, 4), 16),
      Number.parseInt(expanded.slice(4, 6), 16),
      expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    ];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(
    normalized,
  );
  if (!rgb) return null;
  const alpha = rgb[4]?.endsWith('%')
    ? Number.parseFloat(rgb[4]) / 100
    : Number.parseFloat(rgb[4] ?? '1');
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), alpha];
}

export function contrastRatio(foreground: string, background: string): number | null {
  const front = parseColor(foreground);
  const back = parseColor(background);
  if (!front || !back) return null;
  const blended = front
    .slice(0, 3)
    .map((value, index) => Math.round(value! * front[3] + back[index]! * (1 - front[3])));
  const luminance = (color: number[]): number =>
    0.2126 * channel(color[0]!) + 0.7152 * channel(color[1]!) + 0.0722 * channel(color[2]!);
  const foregroundLuminance = luminance(blended);
  const backgroundLuminance = luminance(back);
  const light = Math.max(foregroundLuminance, backgroundLuminance);
  const dark = Math.min(foregroundLuminance, backgroundLuminance);
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

export function impactMessages(input: ImpactInput): string[] {
  const messages: string[] = [];
  if (input.unresolved) messages.push('Choose a source mapping before applying');
  if (input.scope === 'component') {
    messages.push(
      input.componentInstances && input.componentInstances > 1
        ? `Updates ${input.componentInstances} component instances`
        : 'Updates the shared component',
    );
  } else messages.push('Changes this instance only');
  messages.push(input.token ? `Uses ${input.token}` : 'Creates or preserves a literal value');
  if (input.breakpoint !== 'current') messages.push(`Limited to ${input.breakpoint}`);
  if (input.theme !== 'current') messages.push(`Limited to ${input.theme} theme`);
  if (input.state && input.state !== 'current') messages.push(`Limited to ${input.state} state`);
  return messages;
}

export function virtualRange(
  count: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight = 30,
  overscan = 6,
): { start: number; end: number; before: number; after: number } {
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(count, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return {
    start,
    end,
    before: start * rowHeight,
    after: Math.max(0, (count - end) * rowHeight),
  };
}

export function nearestNumericToken(
  value: number,
  tokens: Array<{ name: string; value: string }>,
): { name: string; value: number } | null {
  const numeric = tokens
    .map((token) => ({ name: token.name, value: Number.parseFloat(token.value) }))
    .filter((token) => Number.isFinite(token.value));
  if (!numeric.length) return null;
  return numeric.reduce((closest, token) =>
    Math.abs(token.value - value) < Math.abs(closest.value - value) ? token : closest,
  );
}
