import accessibilityIcon from '@iconify-icons/keyline-icons/user-check';
import activityIcon from '@iconify-icons/keyline-icons/activity';
import alignIcon from '@iconify-icons/keyline-icons/align-offset-left';
import arrowDownIcon from '@iconify-icons/keyline-icons/arrow-down';
import arrowLeftIcon from '@iconify-icons/keyline-icons/arrow-left';
import arrowUpIcon from '@iconify-icons/keyline-icons/arrow-up';
import bookmarkIcon from '@iconify-icons/keyline-icons/bookmark';
import boxIcon from '@iconify-icons/keyline-icons/square';
import checkIcon from '@iconify-icons/keyline-icons/check';
import blurIcon from '@iconify-icons/keyline-icons/circle-dashed';
import chevronDownIcon from '@iconify-icons/keyline-icons/chevron-down';
import chevronRightIcon from '@iconify-icons/keyline-icons/chevron-right';
import columnsIcon from '@iconify-icons/keyline-icons/grid-3x2';
import commandIcon from '@iconify-icons/keyline-icons/square-terminal';
import componentIcon from '@iconify-icons/keyline-icons/shapes';
import contrastIcon from '@iconify-icons/keyline-icons/circle-half';
import cursorIcon from '@iconify-icons/keyline-icons/cursor';
import interactIcon from '@iconify-icons/keyline-icons/cursor-click';
import eyeIcon from '@iconify-icons/keyline-icons/eye';
import eyeOffIcon from '@iconify-icons/keyline-icons/eye-off';
import fileTextIcon from '@iconify-icons/keyline-icons/file-text';
import layoutIcon from '@iconify-icons/keyline-icons/layout-dashboard';
import layersIcon from '@iconify-icons/keyline-icons/grid-squares';
import linkIcon from '@iconify-icons/keyline-icons/link';
import linkOffIcon from '@iconify-icons/keyline-icons/link-off';
import lockIcon from '@iconify-icons/keyline-icons/lock';
import maximizeIcon from '@iconify-icons/keyline-icons/maximize';
import paletteIcon from '@iconify-icons/keyline-icons/flower';
import panelsIcon from '@iconify-icons/keyline-icons/panel-right';
import playIcon from '@iconify-icons/keyline-icons/play';
import plusIcon from '@iconify-icons/keyline-icons/plus';
import redoIcon from '@iconify-icons/keyline-icons/rotate-cw';
import resetIcon from '@iconify-icons/keyline-icons/refresh-ccw';
import saveIcon from '@iconify-icons/keyline-icons/download';
import sparklesIcon from '@iconify-icons/keyline-icons/star';
import triangleAlertIcon from '@iconify-icons/keyline-icons/triangle-alert';
import typeIcon from '@iconify-icons/keyline-icons/cursor-text';
import undoIcon from '@iconify-icons/keyline-icons/rotate-ccw';
import wandIcon from '@iconify-icons/keyline-icons/pencil-ruler';
import xIcon from '@iconify-icons/keyline-icons/x';

interface KeylineIconData {
  body: string;
  height?: number;
  width?: number;
}

function normalizeKeylineIcon(icon: KeylineIconData): KeylineIconData {
  const onePixelStroke = icon.body.replace(/stroke-width="[^"]+"/g, 'stroke-width="1"');
  const nonScalingStroke = onePixelStroke.replace(
    /<(path|circle|rect|line|polyline|polygon|ellipse)\b(?![^>]*vector-effect)/g,
    '<$1 vector-effect="non-scaling-stroke"',
  );
  return { ...icon, body: nonScalingStroke };
}

const RAW_KEYLINE_ICONS: Record<string, KeylineIconData> = {
  accessibility: accessibilityIcon,
  activity: activityIcon,
  'align-horizontal-space-around': alignIcon,
  'arrow-down': arrowDownIcon,
  'arrow-left': arrowLeftIcon,
  'arrow-up': arrowUpIcon,
  bookmark: bookmarkIcon,
  box: boxIcon,
  blur: blurIcon,
  check: checkIcon,
  'chevron-down': chevronDownIcon,
  'chevron-right': chevronRightIcon,
  'columns-3': columnsIcon,
  command: commandIcon,
  component: componentIcon,
  contrast: contrastIcon,
  eye: eyeIcon,
  'eye-off': eyeOffIcon,
  'file-text': fileTextIcon,
  'layout-grid': layoutIcon,
  'layers-3': layersIcon,
  'link-2': linkIcon,
  lock: lockIcon,
  'maximize-2': maximizeIcon,
  'mouse-pointer-2': cursorIcon,
  interact: interactIcon,
  palette: paletteIcon,
  'panels-top-left': panelsIcon,
  play: playIcon,
  plus: plusIcon,
  'redo-2': redoIcon,
  'rotate-ccw': resetIcon,
  save: saveIcon,
  sparkles: sparklesIcon,
  'triangle-alert': triangleAlertIcon,
  type: typeIcon,
  'undo-2': undoIcon,
  'unlink-2': linkOffIcon,
  'wand-sparkles': wandIcon,
  x: xIcon,
};

export const KEYLINE_ICONS: Record<string, KeylineIconData> = Object.fromEntries(
  Object.entries(RAW_KEYLINE_ICONS).map(([semantic, icon]) => [
    semantic,
    normalizeKeylineIcon(icon),
  ]),
);

export function renderKeylineIcons(root: HTMLElement | ShadowRoot): void {
  root.querySelectorAll<HTMLElement>('[data-foundry-icon]').forEach((placeholder) => {
    const semanticName = placeholder.dataset.foundryIcon;
    if (!semanticName) return;
    const icon = KEYLINE_ICONS[semanticName];
    if (!icon) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${icon.width ?? 24} ${icon.height ?? 24}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke-width', '1');
    svg.setAttribute('data-keyline-icon', semanticName);
    svg.innerHTML = icon.body;
    placeholder.replaceWith(svg);
  });
}
