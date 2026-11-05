export function supportsInspectorColorFormats(value) {
  const text = String(value).trim();
  return (
    /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(text) ||
    (/^[a-z]+$/i.test(text) &&
      !['currentcolor', 'inherit', 'initial', 'unset', 'revert', 'revert-layer'].includes(
        text.toLowerCase(),
      )) ||
    (/^(?:rgb|rgba|hsl|hsla)\([^()]+\)$/i.test(text) && !/(?:\bfrom\b|\bnone\b)/i.test(text))
  );
}
export function inspectorColorChannels(color, format) {
  if (format === 'rgb')
    return [1, 3, 5].map((index) => parseInt(color.hex.slice(index, index + 2), 16));
  const v = color.v / 100,
    s = color.s / 100,
    l = v * (1 - s / 2),
    saturation = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return [color.h, saturation * 100, l * 100].map((value) => Number(value.toFixed(3)));
}
export function inspectorColorAlpha(value, fallback = 100) {
  const text = String(value).trim();
  if (text.toLowerCase() === 'transparent') return 0;
  if (/^#[\da-f]{4}$/i.test(text)) return (parseInt(text[4] + text[4], 16) / 255) * 100;
  if (/^#[\da-f]{8}$/i.test(text)) return (parseInt(text.slice(-2), 16) / 255) * 100;
  if (!supportsInspectorColorFormats(text)) return fallback;
  const functional = text.match(/^(?:rgb|rgba|hsl|hsla)\((.*)\)$/i);
  if (!functional) return 100;
  const body = functional[1],
    commas = body.split(','),
    raw = body.includes('/')
      ? body.split('/').at(-1).trim()
      : commas.length === 4
        ? commas[3].trim()
        : null;
  if (raw == null) return 100;
  const alpha = parseFloat(raw) * (raw.endsWith('%') ? 1 : 100);
  return Number.isFinite(alpha) ? Math.min(100, Math.max(0, alpha)) : fallback;
}
export function serializeInspectorChannels(format, values, alpha) {
  const limits = format === 'rgb' ? [255, 255, 255] : format === 'hsl' ? [360, 100, 100] : null;
  if (
    !limits ||
    values.length !== 3 ||
    values.some(
      (value, index) =>
        String(value).trim() === '' ||
        !Number.isFinite(Number(value)) ||
        Number(value) < 0 ||
        Number(value) > limits[index],
    ) ||
    String(alpha).trim() === '' ||
    !Number.isFinite(Number(alpha)) ||
    Number(alpha) < 0 ||
    Number(alpha) > 100
  )
    return null;
  const [a, b, c] = values.map(Number),
    opacity = Number(alpha);
  return format === 'rgb'
    ? `rgb(${a} ${b} ${c} / ${opacity}%)`
    : `hsl(${a} ${b}% ${c}% / ${opacity}%)`;
}
