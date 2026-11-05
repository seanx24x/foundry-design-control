// Bounded, reversible adapter for approved pilot interiors and shared navigation.
// Source paths/notices are retained in assets/foundry-pilot/. No runtime fetch.
import { GENERAL_ICONS, PROPERTY_ICONS, LEGACY_ROLES } from './foundry-pilot-icon-data.js';

export { LEGACY_ROLES };
export const FOUNDRY_PILOT_ICON_SCOPE =
  '#app-shell > .app-bar, .foundry-sidebar, #layers-dock, #inspector-dock, .canvas-mode, .component-workshop-mode, .design-system-mode, .motion-studio-mode, .typography-studio-mode, .visual-recipes-mode, .next-state-workbench, .next-responsive-lab, .next-stress-lab, .next-visual-agent, .next-design-branches, .next-design-memory, .next-delivery, [data-mode-surface="review"], .foundry-apply-interior, #studio-navigation, #change-summary, [data-foundry-pilot-portal="canvas"], #command-dialog, #delivery-milestone-dialog, #readiness-dialog';

const destinations = Object.freeze({
  canvas: 'canvas',
  components: 'components',
  system: 'designSystem',
  motion: 'motion',
  typography: 'typography',
  recipes: 'recipes',
  states: 'stateWorkbench',
  responsive: 'responsive',
  health: 'contentStress',
  agent: 'visualAgent',
  branches: 'branches',
  memory: 'designMemory',
  delivery: 'delivery',
});
const destinationLegacyRoles = Object.freeze({
  canvas: ['cursor', 'box'],
  components: ['component'],
  system: ['sparkles'],
  motion: ['play'],
  typography: ['typography'],
  recipes: ['copy'],
  states: ['layers'],
  responsive: ['layout'],
  health: ['activity'],
  agent: ['message'],
  branches: ['branch'],
  memory: ['bookmark'],
  delivery: ['fileCheck'],
});
const saved = new WeakMap();
const ownedAttributes = [
  'viewBox',
  'width',
  'height',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'data-icon-family',
  'data-icon-name',
  'aria-hidden',
  'focusable',
  'hidden',
];
const safe = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  );
const otherStyles = (node) =>
  JSON.stringify(
    [...node.style]
      .filter((name) => name !== 'display')
      .sort()
      .map((name) => [
        name,
        node.style.getPropertyValue(name),
        node.style.getPropertyPriority(name),
      ]),
  );

// Context is semantic; no arbitrary CSS, source code or user SVG is accepted.
// A null result means preserve the caller's held/unknown artwork.
export function resolveFoundryPilotRole(name, context = {}) {
  if (context.brand) return null;
  if (context.labelOnly) return 'blur';
  if (context.destination && destinationLegacyRoles[context.destination]?.includes(name))
    return destinations[context.destination];
  if (context.canvasMode === 'select') return 'cursor';
  if (context.canvasMode === 'interact') return 'play';
  if (context.canvasMode === 'pan') return 'pan';
  if (context.dock === 'layers' || context.dock === 'navigation')
    return context.dockVisible === false ? 'panelLeftOpen' : 'panelLeftClose';
  if (context.dock === 'inspector')
    return context.dockVisible === false ? 'panelRightOpen' : 'panelRightClose';
  if (context.contextSelect === 'canvas-viewport') return 'viewport';
  if (context.contextSelect === 'canvas-theme') return 'theme';
  if (context.contextSelect === 'canvas-state') return 'stateWorkbench';
  if (context.compare && name === 'contrast') return 'compare';
  if (context.canvasTab && name === 'box') return 'canvas';
  if (context.layer && name === 'box') return 'element';
  if (context.focus && name === 'external') return 'focus';
  if (context.findCommand && name === 'command') return 'search';
  if (context.connection && name === 'command') return 'connection';
  if (context.archive && name === 'bin') return 'archive';
  return Object.hasOwn(GENERAL_ICONS, name) ? name : null;
}

function markup(name, role, record, family) {
  if (!record) return null; // Deliberate label-only roles, including Blur.
  return `<svg data-foundry-icon="${safe(name)}" data-icon-family="${family}" data-icon-name="${safe(record.name ?? role)}" data-foundry-pilot-icon="${safe(role)}" class="foundry-pilot-icon${family === 'foundry' ? ' foundry-pilot-property-icon' : ''}" width="16" height="16" viewBox="${record.viewBox}" fill="none" stroke="currentColor" stroke-width="${family === 'foundry' ? 4 / 3 : 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${record.body}</svg>`;
}

/** Synchronous decorative SVG, or null for unknown / label-only / held roles. */
export function foundryPilotIcon(name, context = {}) {
  const role = resolveFoundryPilotRole(name, context);
  return role == null ? null : markup(name, role, GENERAL_ICONS[role], 'lucide');
}
export const icon = foundryPilotIcon;

/** Uses the approved native 16px property geometry, including opacity's explicit fill. */
export function foundryPilotPropertyIcon(property) {
  return Object.hasOwn(PROPERTY_ICONS, property)
    ? markup(property, property, PROPERTY_ICONS[property], 'foundry')
    : null;
}

function nodeContext(node) {
  const dock = node.closest('[data-dock-toggle]');
  const navigation = node.closest('#studio-nav-toggle');
  const select = node
    .closest('.next-context-icon')
    ?.closest('.foundry-select')
    ?.querySelector('select');
  const effect = node.closest('[data-add-effect]')?.dataset.addEffect;
  return {
    brand:
      Boolean(
        node.closest(
          '[data-foundry-brand], .foundry-brand, .wordmark, .visual-agent-message[data-role="system"] .visual-agent-message-icon',
        ),
      ) || Boolean(node.closest('.app-identity') && !node.closest('button')),
    labelOnly:
      Boolean(node.closest('.effect-shadow-fields header')) ||
      ['drop-shadow', 'inner-shadow', 'noise', 'texture'].includes(effect),
    destination:
      node.closest('[data-workspace-mode]')?.dataset.workspaceMode ??
      node.closest('[data-command-mode]')?.dataset.commandMode,
    canvasMode: node.closest('.canvas-toolbar [data-canvas-mode]')?.dataset.canvasMode,
    dock: dock?.dataset.dockToggle ?? (navigation ? 'navigation' : undefined),
    dockVisible:
      (dock ?? navigation)?.getAttribute('aria-pressed') !== 'false' &&
      (dock ?? navigation)?.getAttribute('aria-expanded') !== 'false',
    contextSelect: select?.id,
    compare: Boolean(node.closest('#compare')),
    canvasTab: Boolean(node.closest('#next-tab-canvas')),
    layer: Boolean(node.closest('.layer-row .layer-icon')),
    focus: Boolean(node.closest('[data-next-focus-tab], .next-focus')),
    findCommand: Boolean(node.closest('#command-trigger')),
    connection: Boolean(node.closest('[data-next-connection-details]')),
    archive: node.closest('[data-branch-action]')?.dataset.branchAction === 'archive',
  };
}

function remember(node) {
  if (saved.has(node)) return;
  saved.set(node, {
    body: node.innerHTML,
    attributes: new Map(ownedAttributes.map((name) => [name, node.getAttribute(name)])),
    display: [node.style.getPropertyValue('display'), node.style.getPropertyPriority('display')],
    hadClass: node.hasAttribute('class'),
    hadStyle: node.hasAttribute('style'),
    styleText: node.getAttribute('style'),
    otherStyles: otherStyles(node),
  });
}

function restore(node) {
  const original = saved.get(node);
  if (!original) return false;
  node.innerHTML = original.body;
  for (const [name, value] of original.attributes) {
    if (value == null) node.removeAttribute(name);
    else node.setAttribute(name, value);
  }
  if (original.display[0]) node.style.setProperty('display', ...original.display);
  else node.style.removeProperty('display');
  node.classList.remove('foundry-pilot-icon', 'foundry-pilot-property-icon');
  if (!original.hadClass && !node.getAttribute('class')) node.removeAttribute('class');
  if (!original.hadStyle && !node.style.length) node.removeAttribute('style');
  // Keep original serialization when unchanged; never discard another owner's new style.
  if (original.hadStyle && otherStyles(node) === original.otherStyles)
    node.setAttribute('style', original.styleText);
  node.removeAttribute('data-foundry-pilot-icon');
  saved.delete(node);
  return true;
}

/**
 * Call after existing renderIcons/refineNextIcons, with explicit active:true.
 * Call on document with active:false before leaving Canvas to restore all surviving
 * glyphs. It never traverses iframe documents, installs listeners, or starts timers.
 * Caller owns the query/mode gate and must explicitly include its Canvas portals.
 */
export function refineFoundryPilotIcons(
  root,
  { active = false, scope = FOUNDRY_PILOT_ICON_SCOPE } = {},
) {
  const nodes = [
    ...(root.matches?.('svg[data-foundry-icon]') ? [root] : []),
    ...root.querySelectorAll('svg[data-foundry-icon]'),
  ];
  const result = { changed: 0, restored: 0, held: 0 };
  for (const node of nodes) {
    if (!active) {
      if (restore(node)) result.restored++;
      continue;
    }
    if (
      !node.closest(scope) ||
      node.closest('[data-inspected-product]') ||
      (node.closest(
        '[data-mode-surface]:not([data-mode-surface="canvas"]):not([data-mode-surface="components"]):not([data-mode-surface="system"]):not([data-mode-surface="motion"]):not([data-mode-surface="typography"]):not([data-mode-surface="recipes"]):not([data-mode-surface="agent"]):not([data-mode-surface="branches"]):not([data-mode-surface="memory"]):not([data-mode-surface="delivery"]):not([data-mode-surface="review"])',
      ) &&
        !node.closest('.foundry-sidebar'))
    ) {
      if (restore(node)) result.restored++;
      continue;
    }
    const name = node.dataset.foundryIcon;
    const property =
      Object.hasOwn(PROPERTY_ICONS, name) &&
      Boolean(node.closest('.next-property, [data-pilot-property]'));
    const role = property ? name : resolveFoundryPilotRole(name, nodeContext(node));
    if (role == null) {
      if (restore(node)) result.restored++;
      result.held++;
      continue;
    }
    const record = property ? PROPERTY_ICONS[role] : GENERAL_ICONS[role];
    remember(node);
    node.dataset.foundryPilotIcon = role;
    node.classList.add('foundry-pilot-icon');
    node.classList.toggle('foundry-pilot-property-icon', property);
    if (!record) {
      node.innerHTML = '';
      node.style.setProperty('display', 'none');
      node.setAttribute('aria-hidden', 'true');
      result.changed++;
      continue;
    }
    // Original ID, semantic data-foundry-icon, structural classes and transforms stay.
    node.setAttribute('viewBox', record.viewBox);
    node.setAttribute('width', '16');
    node.setAttribute('height', '16');
    node.setAttribute('fill', 'none');
    node.setAttribute('stroke', 'currentColor');
    node.setAttribute('stroke-width', String(property ? 4 / 3 : 2));
    node.setAttribute('stroke-linecap', 'round');
    node.setAttribute('stroke-linejoin', 'round');
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('focusable', 'false');
    node.dataset.iconFamily = property ? 'foundry' : 'lucide';
    node.dataset.iconName = record.name ?? role;
    const originalDisplay = saved.get(node).display;
    if (originalDisplay[0]) node.style.setProperty('display', ...originalDisplay);
    else node.style.removeProperty('display');
    node.innerHTML = record.body;
    result.changed++;
  }
  return result;
}
