// Deliberately bounded: one linear gradient, literal sRGB colors, percent stops.
// Unsupported native CSS returns null; callers must retain it, not flatten it.
const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const color =
  /^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|(?:rgb|rgba|hsl|hsla)\([\d\s.,%/+\-degturnrad]+\)|transparent|black|white|red|green|blue|yellow|cyan|magenta|gray|grey|orange|purple|pink|navy|teal|lime|maroon|olive|silver|aqua|fuchsia)$/i;
export function isInspectorGradientColor(value) {
  return typeof value === 'string' && color.test(value.trim());
}
function splitStops(value) {
  let depth = 0,
    start = 0;
  const items = [];
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    if (value[i] === ')') depth--;
    if (depth < 0) return null;
    if (value[i] === ',' && depth === 0) {
      items.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (depth) return null;
  items.push(value.slice(start).trim());
  return items;
}
export function readInspectorGradient(value) {
  const text = String(value).trim();
  if (text.length > 4096 || /[;{}\\]|\/\*/.test(text)) return null;
  const match = text.match(/^linear-gradient\((.*)\)$/is);
  if (!match) return null;
  const parts = splitStops(match[1]);
  if (!parts) return null;
  let angle = 180;
  const direction = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270 };
  const heading = parts[0].toLowerCase().replace(/\s+/g, ' ');
  const measured = heading.match(new RegExp(`^(${number})(deg|grad|rad|turn)$`));
  if (Object.hasOwn(direction, heading)) {
    angle = direction[heading];
    parts.shift();
  } else if (measured) {
    angle = Number(measured[1]) * { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 }[measured[2]];
    parts.shift();
  }
  if (!Number.isFinite(angle) || Math.abs(angle) > 3600 || parts.length < 2 || parts.length > 8)
    return null;
  const stops = parts.map((part) => {
    const position = part.match(new RegExp(`\\s+(${number})%$`));
    const css = position ? part.slice(0, position.index).trim() : part;
    return { color: css, position: position ? Number(position[1]) : null };
  });
  if (
    stops.some(
      (stop) =>
        !isInspectorGradientColor(stop.color) ||
        (stop.position != null && (stop.position < 0 || stop.position > 100)),
    )
  )
    return null;
  stops[0].position ??= 0;
  stops.at(-1).position ??= 100;
  // Infer omitted percentages using CSS's equal distribution rule. Reject
  // backwards stops rather than clamping an authored value invisibly.
  let previous = 0;
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].position == null) continue;
    if (stops[i].position < stops[previous].position) return null;
    const step = (stops[i].position - stops[previous].position) / (i - previous);
    for (let j = previous + 1; j < i; j++)
      stops[j].position = stops[previous].position + step * (j - previous);
    previous = i;
  }
  return { angle, stops };
}
export function serializeInspectorGradient(model) {
  if (
    !model ||
    !Number.isFinite(model.angle) ||
    Math.abs(model.angle) > 3600 ||
    !Array.isArray(model.stops) ||
    model.stops.length < 2 ||
    model.stops.length > 8
  )
    return null;
  if (
    model.stops.some(
      (stop, i) =>
        !isInspectorGradientColor(stop.color) ||
        !Number.isFinite(stop.position) ||
        stop.position < 0 ||
        stop.position > 100 ||
        (i > 0 && stop.position < model.stops[i - 1].position),
    )
  )
    return null;
  return `linear-gradient(${model.angle}deg, ${model.stops.map((stop) => `${stop.color.trim()} ${stop.position}%`).join(', ')})`;
}
export function moveInspectorGradientStop(model, index, position) {
  if (!model || !model.stops[index] || !Number.isFinite(position)) return null;
  const next = structuredClone(model);
  next.stops[index].position = Math.max(
    model.stops[index - 1]?.position ?? 0,
    Math.min(model.stops[index + 1]?.position ?? 100, position),
  );
  return next;
}
