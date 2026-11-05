const groups = {
  Position: ['position', 'left', 'top'],
  Layout: [
    'display',
    'flexDirection',
    'width',
    'height',
    'objectFit',
    'objectPosition',
    'gap',
    'flexWrap',
    'justifyContent',
    'alignItems',
    'minWidth',
    'maxWidth',
    'aspectRatio',
    'overflow',
    'gridTemplateColumns',
    'gridTemplateRows',
    'rowGap',
    'columnGap',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'paddingHorizontal',
    'paddingVertical',
    'paddingLinked',
  ],
  Typography: [
    'fontFamily',
    'fontWeight',
    'fontSize',
    'lineHeight',
    'letterSpacing',
    'textAlign',
    'fontStyle',
    'textTransform',
    'fontVariationSettings',
  ],
  Appearance: [
    'backgroundColor',
    'backgroundImage',
    'color',
    'opacity',
    'borderWidth',
    'borderColor',
    'boxShadow',
    'borderRadius',
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomLeftRadius',
    'borderBottomRightRadius',
    'radiusLinked',
  ],
  Content: ['textContent'],
  Accessibility: ['alt', 'aria-label'],
};
const linked = new Set(['paddingHorizontal', 'paddingVertical', 'paddingLinked', 'radiusLinked']);
export function inspectorSectionRestorePlan(section, controls, entries, count = 1) {
  const items = entries.filter((item) => groups[section]?.includes(item.property));
  let reason = '';
  if (items.length && count !== 1)
    reason = 'Use Undo to restore each selected layer’s original values.';
  const plan = items.map((item) => ({
    ...item,
    control: controls.find((control) => control.property === item.property),
  }));
  if (
    !reason &&
    plan.some((item) => linked.has(item.property) || item.mixed || item.before === 'Mixed')
  )
    reason = 'Use Undo for linked or mixed edits so every original is preserved.';
  if (
    !reason &&
    plan.some(
      (item) =>
        !item.control ||
        item.before == null ||
        (item.control.kind === 'number' &&
          (String(item.before).trim() === '' || !Number.isFinite(Number(item.before)))),
    )
  )
    reason =
      'A captured control is no longer available. Use Undo or review these changes individually.';
  return {
    items: plan,
    reason,
    signature: JSON.stringify(
      plan.map(({ property, before, after, revision, control }) => [
        property,
        before,
        after,
        revision,
        control?.kind,
        control?.unit,
        control?.sourceScale,
      ]),
    ),
  };
}
