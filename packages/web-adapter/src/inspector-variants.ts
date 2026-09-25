import type { ComponentWorkshopVariant } from './component-workshop.js';

// Only indexed primitive props with authored live data-attribute hooks are supported.
// React props, event handlers and arbitrary DOM attributes are not simulated.
export function inspectorVariantAttributes(
  variant: ComponentWorkshopVariant,
): Array<[string, string]> {
  if (!variant.source?.file) throw new Error('This variant has no indexed source.');
  const entries = Object.entries(variant.props);
  if (!entries.length) throw new Error('This variant exposes no primitive properties.');
  return entries.map(([property, value]) => {
    if (
      !/^[a-z][a-zA-Z0-9]*$/.test(property) ||
      /^foundry/i.test(property) ||
      !['string', 'number', 'boolean'].includes(typeof value) ||
      (typeof value === 'number' && !Number.isFinite(value))
    )
      throw new Error(`The ${property} property has no supported data-attribute mapping.`);
    return [
      `data-${property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      String(value),
    ];
  });
}

export function restoreVariantAttributes(
  element: Pick<HTMLElement, 'getAttribute' | 'setAttribute' | 'removeAttribute'>,
  names: string[],
): () => void {
  const original = names.map((name) => [name, element.getAttribute(name)] as const);
  return () =>
    original.forEach(([name, value]) => {
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    });
}
