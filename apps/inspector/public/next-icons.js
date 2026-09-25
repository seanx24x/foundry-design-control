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
