// Source SVG geometry, scoped to the Next shell, structure and inspector panels.
// Outline for concepts; native 16px artwork for small utility actions.
import activity from '@iconify-icons/heroicons/beaker';
import bookmark from '@iconify-icons/heroicons/bookmark';
import bin from '@iconify-icons/heroicons/trash';
import box from '@iconify-icons/heroicons/window';
import blur from '@iconify-icons/heroicons/swatch';
import chevronDown from '@iconify-icons/heroicons/chevron-down-16-solid';
import chevronRight from '@iconify-icons/heroicons/chevron-right-16-solid';
import check from '@iconify-icons/heroicons/check-16-solid';
import close from '@iconify-icons/heroicons/x-mark-16-solid';
import command from '@iconify-icons/heroicons/command-line';
import pan from '@iconify-icons/heroicons/hand-raised';
import component from '@iconify-icons/heroicons/squares-2x2';
import contrast from '@iconify-icons/heroicons/sun';
import copy from '@iconify-icons/heroicons/document-duplicate';
import cursor from '@iconify-icons/heroicons/cursor-arrow-rays';
import typography from '@iconify-icons/heroicons/language';
import external from '@iconify-icons/heroicons/arrow-up-right-16-solid';
import fileCheck from '@iconify-icons/heroicons/document-check';
import file from '@iconify-icons/heroicons/document-text';
import branch from '@iconify-icons/heroicons/share';
import compare from '@iconify-icons/heroicons/view-columns';
import merge from '@iconify-icons/heroicons/arrows-pointing-in';
import interact from '@iconify-icons/heroicons/cursor-arrow-ripple';
import layers from '@iconify-icons/heroicons/rectangle-stack';
import layout from '@iconify-icons/heroicons/rectangle-group';
import menu from '@iconify-icons/heroicons/bars-3-16-solid';
import message from '@iconify-icons/heroicons/chat-bubble-left-ellipsis';
import minus from '@iconify-icons/heroicons/minus-16-solid';
import panel from '@iconify-icons/heroicons/view-columns';
import play from '@iconify-icons/heroicons/play';
import plus from '@iconify-icons/heroicons/plus-16-solid';
import redo from '@iconify-icons/heroicons/arrow-uturn-right';
import refresh from '@iconify-icons/heroicons/arrow-path';
import search from '@iconify-icons/heroicons/magnifying-glass';
import sparkles from '@iconify-icons/heroicons/sparkles';
import undo from '@iconify-icons/heroicons/arrow-uturn-left';
import viewport from '@iconify-icons/heroicons/computer-desktop';
import element from '@iconify-icons/heroicons/stop';

export const NEXT_ICONS = {
  activity,
  bookmark,
  bin,
  box,
  blur,
  chevronDown,
  chevronRight,
  check,
  close,
  command,
  pan,
  component,
  contrast,
  copy,
  cursor,
  typography,
  external,
  fileCheck,
  file,
  branch,
  compare,
  merge,
  interact,
  layers,
  layout,
  window: box,
  menu,
  message,
  minus,
  panelLeft: panel,
  panel,
  play,
  plus,
  redo,
  refresh,
  search,
  sparkles,
  undo,
};

export const NEXT_ICON_SCOPE =
  '.app-bar, #layers-dock, .canvas-context, .canvas-toolbar, #change-summary, #studio-navigation, #inspector-dock, .next-font-picker, [data-next-icon-scope]';

// Original, native 16px property symbols, scoped to inspector fields. Faint
// geometry is the box; the strong edge/space is what the field changes.
const propertyPath = (d, attributes = '') =>
  `<path fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" d="${d}" ${attributes}/>`;
const propertyBox = (inset, size) =>
  `<rect x="${inset}" y="${inset}" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.25" opacity=".4"/>`;
const rotateProperty = (body, angle) => `<g transform="rotate(${angle} 8 8)">${body}</g>`;
const spacingProperty = (outside, sides) => {
  const edge = outside ? 'M2.5 2h11' : 'M5 5h6';
  return (
    propertyBox(outside ? 5 : 2.5, outside ? 6 : 11) +
    sides.map((angle) => rotateProperty(propertyPath(edge), angle)).join('')
  );
};
const cornerProperty = (angle) =>
  propertyBox(3, 10) + rotateProperty(propertyPath('M3 12V7a4 4 0 0 1 4-4h5'), angle);
const widthProperty = propertyPath(
  'M2.5 4v8M13.5 4v8M2.5 8h11M5 5.5 2.5 8 5 10.5M11 5.5 13.5 8 11 10.5',
);
const rowGapProperty =
  propertyPath('M3 1.5h10v3H3zM3 11.5h10v3H3z', 'opacity=".4"') +
  propertyPath('M8 5v6M6 6.5 8 5l2 1.5M6 9.5 8 11l2-1.5');
const radiusProperty = propertyPath(
  'M6.5 2.5h3a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4v-3a4 4 0 0 1 4-4Z',
);

export const NEXT_PROPERTY_ICONS = {
  left: propertyPath('m4.5 4 7 8M11.5 4l-7 8'),
  top: propertyPath('m4.5 4 3.5 4L11.5 4M8 8v4'),
  width: widthProperty,
  height: rotateProperty(widthProperty, 90),
  gap:
    propertyPath('M2 2h3v3H2zM11 2h3v3h-3zM2 11h3v3H2zM11 11h3v3h-3z', 'opacity=".4"') +
    propertyPath('M8 2v12M2 8h12'),
  rowGap: rowGapProperty,
  columnGap: rotateProperty(rowGapProperty, 90),
  paddingTop: spacingProperty(false, [0]),
  paddingRight: spacingProperty(false, [90]),
  paddingBottom: spacingProperty(false, [180]),
  paddingLeft: spacingProperty(false, [270]),
  paddingHorizontal: spacingProperty(false, [90, 270]),
  paddingVertical: spacingProperty(false, [0, 180]),
  paddingLinked: spacingProperty(false, [0, 90, 180, 270]),
  marginTop: spacingProperty(true, [0]),
  marginRight: spacingProperty(true, [90]),
  marginBottom: spacingProperty(true, [180]),
  marginLeft: spacingProperty(true, [270]),
  borderWidth:
    '<rect x="2.5" y="2.5" width="11" height="11" rx=".5" fill="none" stroke="currentColor" stroke-width="2.5"/>',
  borderRadius: radiusProperty,
  radiusLinked: radiusProperty,
  borderTopLeftRadius: cornerProperty(0),
  borderTopRightRadius: cornerProperty(90),
  borderBottomRightRadius: cornerProperty(180),
  borderBottomLeftRadius: cornerProperty(270),
  fontFamily:
    '<path fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" d="m1.5 12.5 3.25-9 3.25 9M2.6 9.5h4.3M10 7.25c.5-.5 1.1-.75 1.85-.75 1.4 0 2.15.75 2.15 2v4M14 9.25h-2c-1.4 0-2.25.6-2.25 1.65 0 1 .75 1.6 1.85 1.6 1.45 0 2.4-.9 2.4-2.15"/>',
  fontSize:
    '<path fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" d="M1.5 4h7M5 4v8M10 7h4.5M12.25 7v5"/>',
  opacity:
    '<path fill="currentColor" d="M8 2.5a5.5 5.5 0 0 0 0 11Z"/><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.25"/>',
};

export function inspectorPropertyIcon(property) {
  if (!Object.hasOwn(NEXT_PROPERTY_ICONS, property)) return null;
  return `<svg data-foundry-icon="${property}" data-icon-family="foundry" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${NEXT_PROPERTY_ICONS[property]}</svg>`;
}

// Original Foundry pointer, not a Heroicon. Match the outline family's 24px
// coordinate system and 1.5px stroke without its click rays or ripple decoration.
export const NEXT_TOOL_ICONS = {
  select: {
    width: 24,
    height: 24,
    body: '<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M5.25 3.75v15.5l4.25-4.25 3 6 3-1.5-3-6H19.5Z"/>',
  },
  interact: play,
};

export function refineNextIcons(root) {
  for (const node of root.querySelectorAll('svg[data-foundry-icon]:not([data-icon-family])')) {
    if (!node.closest(NEXT_ICON_SCOPE)) continue;
    const name = node.dataset.foundryIcon;
    const mode = node.closest('.canvas-toolbar [data-canvas-mode]')?.dataset.canvasMode;
    const canvasDestination = node.closest('#studio-navigation [data-workspace-mode="canvas"]');
    // A viewport and an HTML layer should not both inherit the Canvas tab's window glyph.
    const icon =
      (canvasDestination ? NEXT_TOOL_ICONS.select : NEXT_TOOL_ICONS[mode]) ??
      (node.closest('#compare') && name === 'contrast'
        ? compare
        : name === 'box' && node.closest('.next-context-icon')
          ? viewport
          : name === 'box' && node.closest('.layer-row')
            ? element
            : NEXT_ICONS[name]);
    if (!icon) continue;
    node.setAttribute('viewBox', `0 0 ${icon.width ?? 24} ${icon.height ?? 24}`);
    node.dataset.iconFamily = mode === 'select' || canvasDestination ? 'foundry' : 'heroicons';
    node.innerHTML = icon.body;
  }
}
