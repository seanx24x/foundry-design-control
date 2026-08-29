export function cssPath(element: Element): string {
  const explicit = element.getAttribute('data-foundry-id');
  if (explicit) return `[data-foundry-id="${CSS.escape(explicit)}"]`;
  const segments: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.documentElement) {
    let segment = current.tagName.toLowerCase();
    if (current.id) {
      segment += `#${CSS.escape(current.id)}`;
      segments.unshift(segment);
      break;
    }
    const parent: Element | null = current.parentElement;
    if (parent) {
      const peers = [...parent.children].filter(
        (candidate) => candidate.tagName === current!.tagName,
      );
      if (peers.length > 1) segment += `:nth-of-type(${peers.indexOf(current) + 1})`;
    }
    segments.unshift(segment);
    current = parent;
  }
  return segments.join(' > ');
}

export function targetId(element: HTMLElement): string {
  const explicit = element.dataset.foundryId;
  if (explicit) return explicit;
  const path = cssPath(element);
  let hash = 2166136261;
  for (const character of path) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `web_${(hash >>> 0).toString(16)}`;
}

export function parseSource(
  value: string | undefined,
): { file: string; line?: number; column?: number } | undefined {
  if (!value) return undefined;
  const match = /^(.*?)(?::(\d+))?(?::(\d+))?$/.exec(value);
  if (!match?.[1]) return undefined;
  return {
    file: match[1],
    ...(match[2] ? { line: Number(match[2]) } : {}),
    ...(match[3] ? { column: Number(match[3]) } : {}),
  };
}
