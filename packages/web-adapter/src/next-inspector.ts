// The Next inspector only exposes properties with a reversible local edit.
export const inspectorStyleProperties = new Set([
  'left',
  'top',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'aspectRatio',
  'objectFit',
  'objectPosition',
  'overflow',
  'display',
  'position',
  'gap',
  'rowGap',
  'columnGap',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'flexDirection',
  'flexWrap',
  'justifyContent',
  'alignItems',
  'gridTemplateColumns',
  'gridTemplateRows',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'fontStyle',
  'textAlign',
  'textTransform',
  'fontVariationSettings',
  'color',
  'backgroundColor',
  'opacity',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderWidth',
  'borderColor',
  'boxShadow',
]);
export const inspectorAttributes = new Set(['aria-label', 'alt']);

// Picture is a source-selection wrapper, not the rendered image box. Audio
// controls, SVG and CSS background images do not use this media editing path.
export function supportsInspectorObjectLayout(tagName: string): boolean {
  return ['IMG', 'VIDEO'].includes(tagName.toUpperCase());
}

// Named groups only: a client cannot turn a linked field into an arbitrary batch.
const linkedProperties: Record<string, readonly string[]> = {
  paddingHorizontal: ['paddingLeft', 'paddingRight'],
  paddingVertical: ['paddingTop', 'paddingBottom'],
  paddingLinked: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  radiusLinked: [
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomRightRadius',
    'borderBottomLeftRadius',
  ],
};
export function inspectorEditProperties(property: string): readonly string[] {
  return Object.hasOwn(linkedProperties, property) ? linkedProperties[property]! : [property];
}

export function sharedInspectorControls<
  T extends {
    property: string;
    kind: string;
    unit?: string;
    value: string | number;
    options?: string[];
  },
>(groups: T[][]): Array<T & { mixed: boolean }> {
  if (!groups.length) return [];
  return groups[0]!.flatMap((control) => {
    const peers = groups.map((group) =>
      group.find(
        (item) =>
          item.property === control.property &&
          item.kind === control.kind &&
          item.unit === control.unit,
      ),
    );
    if (peers.some((peer) => !peer)) return [];
    // Font chooser and content editing remain single-target operations.
    if (groups.length > 1 && !inspectorStyleProperties.has(control.property)) return [];
    if (groups.length > 1 && control.property === 'fontFamily') return [];
    const mixed = peers.some((peer) => String(peer!.value) !== String(control.value));
    const options = control.options?.filter((option) =>
      peers.every((peer) => peer!.options?.includes(option)),
    );
    return [{ ...control, ...(options ? { options } : {}), mixed }];
  });
}
