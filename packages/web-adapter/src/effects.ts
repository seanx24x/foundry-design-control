export type ShadowEffectKind = 'drop-shadow' | 'inner-shadow';

export interface ShadowEffectValue {
  kind: ShadowEffectKind;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function hexChannel(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

function rgbColor(value: string): { color: string; opacity: number } | undefined {
  const match = value.match(
    /rgba?\(\s*([\d.]+)(?:\s+|\s*,\s*)([\d.]+)(?:\s+|\s*,\s*)([\d.]+)(?:\s*(?:\/|,)\s*([\d.]+)%?)?\s*\)/i,
  );
  if (!match) return undefined;
  const rawAlpha = match[4] == null ? 1 : Number(match[4]);
  const percentAlpha = match[0].includes('%') ? rawAlpha / 100 : rawAlpha;
  return {
    color: `#${hexChannel(Number(match[1]))}${hexChannel(Number(match[2]))}${hexChannel(Number(match[3]))}`,
    opacity: clamp(percentAlpha, 0, 1),
  };
}

function splitCssList(value: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    if (character === ',' && depth === 0) {
      entries.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  entries.push(value.slice(start).trim());
  return entries.filter(Boolean);
}

export function parseShadowEffects(value: string): ShadowEffectValue[] {
  if (!value || value.trim().toLowerCase() === 'none') return [];
  return splitCssList(value).map((entry) => {
    const rgb = rgbColor(entry);
    const hex = entry.match(/#[\da-f]{6,8}/i)?.[0];
    const color = rgb?.color ?? (hex ? hex.slice(0, 7) : '#000000');
    const opacity =
      rgb?.opacity ?? (hex?.length === 9 ? Number.parseInt(hex.slice(7), 16) / 255 : 1);
    const withoutColor = entry
      .replace(/rgba?\([^)]*\)/i, '')
      .replace(/#[\da-f]{3,8}/i, '')
      .replace(/\binset\b/i, '')
      .trim();
    const values = [...withoutColor.matchAll(/-?[\d.]+(?:px)?/g)].map((match) =>
      Number(match[0].replace('px', '')),
    );
    return {
      kind: /\binset\b/i.test(entry) ? 'inner-shadow' : 'drop-shadow',
      x: values[0] ?? 0,
      y: values[1] ?? 4,
      blur: Math.max(0, values[2] ?? 8),
      spread: values[3] ?? 0,
      color,
      opacity: clamp(opacity, 0, 1),
    };
  });
}

export function composeShadowEffects(effects: ShadowEffectValue[]): string {
  if (!effects.length) return 'none';
  return effects
    .map((effect) => {
      const hex = effect.color.replace('#', '').padEnd(6, '0').slice(0, 6);
      const red = Number.parseInt(hex.slice(0, 2), 16) || 0;
      const green = Number.parseInt(hex.slice(2, 4), 16) || 0;
      const blue = Number.parseInt(hex.slice(4, 6), 16) || 0;
      const alpha = Math.round(clamp(effect.opacity, 0, 1) * 100);
      return `${effect.kind === 'inner-shadow' ? 'inset ' : ''}${effect.x}px ${effect.y}px ${Math.max(0, effect.blur)}px ${effect.spread}px rgb(${red} ${green} ${blue} / ${alpha}%)`;
    })
    .join(', ');
}

export function blurAmount(value: string): number | null {
  const match = value.match(/\bblur\(\s*([\d.]+)px\s*\)/i);
  return match ? Number(match[1]) : null;
}

export function replaceBlur(value: string, amount: number | null): string {
  const normalized = !value || value.trim().toLowerCase() === 'none' ? '' : value.trim();
  const withoutBlur = normalized.replace(/\bblur\(\s*[\d.]+px\s*\)/gi, '').trim();
  const parts = [amount == null ? '' : `blur(${Math.max(0, amount)}px)`, withoutBlur].filter(
    Boolean,
  );
  return parts.join(' ') || 'none';
}
