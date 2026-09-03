import activityIcon from '@iconify-icons/keyline-icons/activity';
import arrowUpRightIcon from '@iconify-icons/keyline-icons/arrow-up-right';
import bookmarkIcon from '@iconify-icons/keyline-icons/bookmark';
import boxIcon from '@iconify-icons/keyline-icons/square';
import blurIcon from '@iconify-icons/keyline-icons/circle-dashed';
import chevronDownIcon from '@iconify-icons/keyline-icons/chevron-down';
import chevronRightIcon from '@iconify-icons/keyline-icons/chevron-right';
import checkIcon from '@iconify-icons/keyline-icons/check';
import commandIcon from '@iconify-icons/keyline-icons/square-terminal';
import compassIcon from '@iconify-icons/keyline-icons/compass';
import componentIcon from '@iconify-icons/keyline-icons/shapes';
import contrastIcon from '@iconify-icons/keyline-icons/circle-half';
import cursorIcon from '@iconify-icons/keyline-icons/cursor';
import fileIcon from '@iconify-icons/keyline-icons/file-text';
import interactIcon from '@iconify-icons/keyline-icons/cursor-click';
import layersIcon from '@iconify-icons/keyline-icons/grid-squares';
import layoutIcon from '@iconify-icons/keyline-icons/layout-dashboard';
import menuIcon from '@iconify-icons/keyline-icons/menu';
import minusIcon from '@iconify-icons/keyline-icons/minus';
import panelIcon from '@iconify-icons/keyline-icons/panel-right';
import playIcon from '@iconify-icons/keyline-icons/play';
import plusIcon from '@iconify-icons/keyline-icons/plus';
import redoIcon from '@iconify-icons/keyline-icons/rotate-cw';
import searchIcon from '@iconify-icons/keyline-icons/search';
import sparklesIcon from '@iconify-icons/keyline-icons/star';
import undoIcon from '@iconify-icons/keyline-icons/rotate-ccw';
import xIcon from '@iconify-icons/keyline-icons/x';

const ICONS = {
  activity: activityIcon,
  bookmark: bookmarkIcon,
  box: boxIcon,
  blur: blurIcon,
  chevronDown: chevronDownIcon,
  chevronRight: chevronRightIcon,
  check: checkIcon,
  close: xIcon,
  command: commandIcon,
  pan: compassIcon,
  component: componentIcon,
  contrast: contrastIcon,
  cursor: cursorIcon,
  external: arrowUpRightIcon,
  file: fileIcon,
  interact: interactIcon,
  layers: layersIcon,
  layout: layoutIcon,
  menu: menuIcon,
  minus: minusIcon,
  panel: panelIcon,
  play: playIcon,
  plus: plusIcon,
  redo: redoIcon,
  search: searchIcon,
  sparkles: sparklesIcon,
  undo: undoIcon,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const params = new URLSearchParams(location.search);
const sessionId = params.get('session');
const token = params.get('token');
const previewUrl = params.get('preview');
const preview = $('#product-preview');
const previewOrigin = previewUrl ? new URL(previewUrl).origin : '';
const dockKey = '__foundry_workspace_dock_width';
const themeKey = '__foundry_workspace_theme';
const modeKey = '__foundry_workspace_mode';
const canvasViewKey = '__foundry_workspace_canvas_view';
const queryTheme = params.get('theme');
let activeSession = null;
let bridgeState = null;
let bridgeConnected = false;
let structureTab = 'layers';
let activeMode = sessionStorage.getItem(modeKey) ?? 'canvas';
let lastReviewFocus = null;
let lastModeFocus = null;
let modeFocusReturn = null;
let toastTimer;
let comparisonMode = 'after';
let canvasTool = 'select';
let canvasViewportKey = '';
let canvasView = { x: 12, y: 12, scale: 1 };
let canvasPanning = null;
let canvasSpaceHeld = false;
let openCustomSelect = null;
let selectId = 0;
let ignoreSelectScrollUntil = 0;
const changedControls = new Set();
const effectCommitTimers = new Map();

function scheduleEffectCommit(key, commit) {
  clearTimeout(effectCommitTimers.get(key));
  effectCommitTimers.set(
    key,
    setTimeout(() => {
      effectCommitTimers.delete(key);
      commit();
    }, 180),
  );
}

function iconSvg(icon) {
  const body = icon.body
    .replace(/stroke-width="[^"]+"/g, 'stroke-width="1"')
    .replace(
      /<(path|circle|rect|line|polyline|polygon|ellipse)\b(?![^>]*vector-effect)/g,
      '<$1 vector-effect="non-scaling-stroke"',
    );
  return `<svg viewBox="0 0 ${icon.width ?? 24} ${icon.height ?? 24}" fill="none" stroke-width="1" aria-hidden="true" focusable="false">${body}</svg>`;
}

function renderIcons(root = document) {
  $$('[data-icon]', root).forEach((node) => {
    const icon = ICONS[node.dataset.icon];
    if (icon) node.outerHTML = iconSvg(icon);
  });
}

function closeCustomSelect({ restoreFocus = true } = {}) {
  if (!openCustomSelect) return false;
  const { trigger, portal } = openCustomSelect;
  trigger.setAttribute('aria-expanded', 'false');
  portal.remove();
  openCustomSelect = null;
  if (restoreFocus && trigger.isConnected) trigger.focus();
  return true;
}

function positionCustomSelect(trigger, portal) {
  const rect = trigger.getBoundingClientRect();
  const margin = 8;
  const maxHeight = Math.min(240, innerHeight - margin * 2);
  portal.style.minWidth = `${Math.max(160, rect.width)}px`;
  portal.style.maxWidth = `${Math.max(160, innerWidth - margin * 2)}px`;
  portal.style.maxHeight = `${maxHeight}px`;
  portal.style.left = `${Math.max(margin, Math.min(rect.left, innerWidth - portal.offsetWidth - margin))}px`;
  const roomBelow = innerHeight - rect.bottom - margin;
  const openAbove = roomBelow < Math.min(portal.scrollHeight, maxHeight) && rect.top > roomBelow;
  const top = openAbove
    ? Math.max(margin, rect.top - Math.min(portal.scrollHeight, maxHeight) - 4)
    : Math.min(innerHeight - margin - Math.min(portal.scrollHeight, maxHeight), rect.bottom + 4);
  portal.style.top = `${Math.max(margin, top)}px`;
}

function syncCustomSelect(select) {
  const wrapper = select.closest('.foundry-select');
  const trigger = wrapper?.querySelector('.foundry-select-trigger');
  if (!trigger) return;
  const option = select.selectedOptions[0] ?? select.options[0];
  trigger.querySelector('.foundry-select-value').textContent = option?.textContent ?? '';
  trigger.disabled = select.disabled;
  trigger.setAttribute('aria-disabled', String(select.disabled));
}

function openSelectMenu(select, trigger) {
  if (openCustomSelect?.select === select) {
    closeCustomSelect();
    return;
  }
  closeCustomSelect({ restoreFocus: false });
  ignoreSelectScrollUntil = performance.now() + 250;
  const portal = document.createElement('div');
  portal.className = 'foundry-select-menu';
  portal.id = `${select.id}-listbox`;
  portal.setAttribute('role', 'listbox');
  portal.setAttribute('aria-label', trigger.getAttribute('aria-label') ?? 'Options');
  portal.innerHTML = [...select.options]
    .map(
      (option, index) =>
        `<button type="button" role="option" data-option-index="${index}" aria-selected="${option.selected}" ${option.disabled ? 'disabled' : ''}><span>${escapeText(option.textContent)}</span>${option.selected ? iconSvg(ICONS.check) : ''}</button>`,
    )
    .join('');
  document.body.append(portal);
  trigger.setAttribute('aria-controls', portal.id);
  trigger.setAttribute('aria-expanded', 'true');
  positionCustomSelect(trigger, portal);
  const selected = portal.querySelector('[aria-selected="true"]');
  (selected ?? portal.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
  openCustomSelect = { select, trigger, portal, typeahead: '', typeaheadTimer: 0 };
  portal.addEventListener('click', (event) => {
    const optionButton = event.target.closest('[data-option-index]');
    if (!optionButton || optionButton.disabled) return;
    select.selectedIndex = Number(optionButton.dataset.optionIndex);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    syncCustomSelect(select);
    closeCustomSelect();
  });
}

function moveSelectFocus(portal, direction) {
  const options = [...portal.querySelectorAll('button:not(:disabled)')];
  if (!options.length) return;
  const current = options.indexOf(document.activeElement);
  const next =
    direction === 'first'
      ? 0
      : direction === 'last'
        ? options.length - 1
        : (current + direction + options.length) % options.length;
  options[next].focus({ preventScroll: true });
  options[next].scrollIntoView({ block: 'nearest' });
}

function selectAccessibleLabel(select) {
  const explicit = select.getAttribute('aria-label');
  if (explicit) return explicit;
  const wrappingLabel = select.closest('label');
  const textLabel = [...(wrappingLabel?.childNodes ?? [])]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent?.trim())
    .filter(Boolean)
    .join(' ');
  if (textLabel) return textLabel;
  const visibleLabel = wrappingLabel?.querySelector(
    ':scope > span:not(.foundry-select):not(.fdc-select), :scope > strong, :scope > small',
  );
  return visibleLabel?.textContent?.trim() || 'Choose an option';
}

function upgradeSelect(select) {
  if (select.dataset.foundrySelect === 'true') {
    syncCustomSelect(select);
    return;
  }
  select.dataset.foundrySelect = 'true';
  if (!select.id) select.id = `foundry-select-${++selectId}`;
  const wrapper = document.createElement('span');
  wrapper.className = 'foundry-select';
  select.before(wrapper);
  wrapper.append(select);
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'foundry-select-trigger';
  trigger.dataset.selectFor = select.id;
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const accessibleLabel = selectAccessibleLabel(select);
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;
  trigger.setAttribute('aria-label', accessibleLabel);
  trigger.innerHTML = `<span class="foundry-select-value"></span>${iconSvg(ICONS.chevronDown)}`;
  wrapper.append(trigger);
  trigger.addEventListener('click', () => openSelectMenu(select, trigger));
  trigger.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      if (!openCustomSelect || openCustomSelect.select !== select) openSelectMenu(select, trigger);
      if (event.key === 'ArrowUp') moveSelectFocus(openCustomSelect.portal, -1);
      if (event.key === 'Home') moveSelectFocus(openCustomSelect.portal, 'first');
      if (event.key === 'End') moveSelectFocus(openCustomSelect.portal, 'last');
    }
  });
  select.addEventListener('change', () => syncCustomSelect(select));
  syncCustomSelect(select);
}

function upgradeSelects(root = document) {
  $$('select', root).forEach(upgradeSelect);
}

function escapeText(value) {
  const node = document.createElement('span');
  node.textContent = String(value ?? '');
  return node.innerHTML;
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('is-visible'), 1800);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-foundry-token': token } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('json') ? response.json() : response.text();
}

function resolvedTheme(preference) {
  if (preference === 'light' || preference === 'dark') return preference;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(preference, persist = true) {
  document.documentElement.dataset.theme = resolvedTheme(preference);
  document.documentElement.dataset.themePreference = preference;
  const label = preference[0].toUpperCase() + preference.slice(1);
  $('[data-theme-choice]').querySelector('span').textContent = `Theme: ${label}`;
  if (persist) localStorage.setItem(themeKey, preference);
  sendCommand('interface-theme', { value: preference });
}

function sendCommand(command, payload = {}) {
  if (!bridgeConnected || !preview.contentWindow) return;
  preview.contentWindow.postMessage(
    { type: 'foundry:workspace-command', sessionId, command, payload },
    previewOrigin,
  );
}

function setMode(mode, restoreFocus = true, returnFocus = null) {
  closeCustomSelect({ restoreFocus: false });
  const previousMode = activeMode;
  if (mode !== 'canvas' && previousMode === 'canvas') {
    lastModeFocus = returnFocus ?? document.activeElement;
  }
  activeMode = mode;
  sessionStorage.setItem(modeKey, mode);
  $('#app-shell').dataset.mode = mode;
  $$('[data-mode-surface]').forEach((surface) => {
    surface.hidden = surface.dataset.modeSurface !== mode;
  });
  if (mode === 'review') {
    lastReviewFocus = document.activeElement;
    renderReview();
  } else if (mode === 'canvas' && restoreFocus) {
    const target = modeFocusReturn ?? lastModeFocus ?? lastReviewFocus;
    if (target instanceof HTMLElement && target.isConnected) target.focus();
    modeFocusReturn = null;
  }
  if (mode === 'states') renderStates();
  if (mode === 'health') renderHealth();
  if (mode === 'memory') renderMemory();
  if (activeSession) renderChangeSummary();
  closeWorkspaceMenu();
}

function closeWorkspaceMenu() {
  $('#workspace-menu').hidden = true;
  $('#workspace-menu-trigger').setAttribute('aria-expanded', 'false');
}

function setDockVisibility(name, visible) {
  const dock = $(`#${name}-dock`);
  dock.hidden = !visible;
  const button = $(`[data-dock-toggle="${name}"]`);
  button.classList.toggle('is-active', visible);
  button.setAttribute('aria-pressed', String(visible));
  const layersVisible = !$('#layers-dock').hidden;
  const inspectorVisible = !$('#inspector-dock').hidden;
  const columns = `${layersVisible ? 'var(--dock)' : '0px'} minmax(0,1fr) ${inspectorVisible ? 'var(--dock)' : '0px'}`;
  $('.workspace').style.gridTemplateColumns = columns;
}

function projectCanvasKey() {
  return activeSession?.changeSet?.context?.projectRoot ?? previewOrigin ?? 'project';
}

function projectDesign() {
  const live = bridgeState?.project ?? {};
  const stored = activeSession?.designGraph ?? {};
  const preferLive = (key) => (live[key]?.length ? live[key] : (stored[key] ?? []));
  return {
    tokens: preferLive('tokens'),
    components: preferLive('components'),
    breakpoints: preferLive('breakpoints'),
    themes: preferLive('themes'),
    states: preferLive('states'),
  };
}

function selectedViewport() {
  const breakpoint = $('#canvas-viewport')?.value ?? bridgeState?.context?.breakpoint ?? 'current';
  const project = projectDesign();
  const projectViewport = project.breakpoints.find((item) => item.id === breakpoint);
  if (projectViewport) {
    return {
      key: breakpoint,
      width: projectViewport.width,
      height: projectViewport.height ?? 900,
      label: projectViewport.label,
    };
  }
  const sessionViewport = activeSession?.changeSet?.context?.viewport;
  if (sessionViewport) {
    return { key: 'current', ...sessionViewport, label: 'Current' };
  }
  const desktop = project.breakpoints.find(
    (item) => item.id === 'desktop' || String(item.label).toLowerCase() === 'desktop',
  );
  const fallback = desktop ?? project.breakpoints.at(-1);
  return fallback
    ? { key: 'current', width: fallback.width, height: fallback.height ?? 900, label: 'Current' }
    : { key: 'current', width: 1440, height: 900, label: 'Current' };
}

function canvasStorageKey(viewportKey = selectedViewport().key) {
  return `${canvasViewKey}:${projectCanvasKey()}:${viewportKey}`;
}

function storeCanvasView() {
  sessionStorage.setItem(canvasStorageKey(canvasViewportKey), JSON.stringify(canvasView));
}

function restoreCanvasView(viewportKey) {
  const stored = sessionStorage.getItem(canvasStorageKey(viewportKey));
  if (!stored) return { x: 12, y: 12, scale: 1 };
  try {
    const value = JSON.parse(stored);
    if ([value.x, value.y, value.scale].every(Number.isFinite)) {
      return {
        x: value.x,
        y: value.y,
        scale: Math.max(0.05, Math.min(4, value.scale)),
      };
    }
  } catch {}
  return { x: 12, y: 12, scale: 1 };
}

function clampCanvasView() {
  const stage = $('#canvas-stage');
  const viewport = selectedViewport();
  const visibleEdge = 64;
  canvasView.x = Math.min(
    stage.clientWidth - visibleEdge,
    Math.max(visibleEdge - viewport.width * canvasView.scale, canvasView.x),
  );
  canvasView.y = Math.min(
    stage.clientHeight - visibleEdge,
    Math.max(visibleEdge - viewport.height * canvasView.scale, canvasView.y),
  );
}

function syncZoomControl() {
  const select = $('#canvas-zoom');
  const rounded = Math.round(canvasView.scale * 100);
  let custom = [...select.options].find((option) => option.value === 'custom');
  const preset = [...select.options].find(
    (option) => Number(option.value) === canvasView.scale && option.value !== 'custom',
  );
  if (preset) {
    custom?.remove();
    select.value = preset.value;
  } else {
    if (!custom) {
      custom = new Option(`${rounded}%`, 'custom');
      select.add(custom, 0);
    }
    custom.textContent = `${rounded}%`;
    select.value = 'custom';
  }
  syncCustomSelect(select);
}

function renderCanvasView({ persist = true } = {}) {
  const viewport = selectedViewport();
  const frame = $('#preview-frame');
  frame.style.width = `${viewport.width}px`;
  frame.style.height = `${viewport.height}px`;
  frame.style.transform = `translate3d(${canvasView.x}px, ${canvasView.y}px, 0) scale(${canvasView.scale})`;
  frame.dataset.viewport = `${viewport.width} × ${viewport.height}`;
  syncZoomControl();
  if (persist) storeCanvasView();
}

function updateCanvasViewport({ reset = false } = {}) {
  const viewport = selectedViewport();
  if (reset || canvasViewportKey !== viewport.key) {
    canvasViewportKey = viewport.key;
    canvasView = reset ? { x: 12, y: 12, scale: 1 } : restoreCanvasView(viewport.key);
  }
  clampCanvasView();
  renderCanvasView({ persist: false });
}

function setCanvasZoom(nextScale, clientX, clientY, { resetOrigin = false } = {}) {
  const stage = $('#canvas-stage');
  const rect = stage.getBoundingClientRect();
  const oldScale = canvasView.scale;
  const scale = Math.max(0.05, Math.min(4, nextScale));
  if (resetOrigin) {
    canvasView = { x: 12, y: 12, scale };
  } else {
    const anchorX = (clientX ?? rect.left + rect.width / 2) - rect.left;
    const anchorY = (clientY ?? rect.top + rect.height / 2) - rect.top;
    const worldX = (anchorX - canvasView.x) / oldScale;
    const worldY = (anchorY - canvasView.y) / oldScale;
    canvasView.x = anchorX - worldX * scale;
    canvasView.y = anchorY - worldY * scale;
    canvasView.scale = scale;
  }
  clampCanvasView();
  renderCanvasView();
}

function fitCanvas(mode = 'fit') {
  const stage = $('#canvas-stage');
  const viewport = selectedViewport();
  const gutter = 24;
  const widthScale = Math.max(0.05, (stage.clientWidth - gutter * 2) / viewport.width);
  const heightScale = Math.max(0.05, (stage.clientHeight - gutter * 2) / viewport.height);
  canvasView.scale = Math.min(
    4,
    mode === 'fit-width' ? widthScale : Math.min(widthScale, heightScale),
  );
  canvasView.x = Math.max(gutter, (stage.clientWidth - viewport.width * canvasView.scale) / 2);
  canvasView.y =
    mode === 'fit-width'
      ? gutter
      : Math.max(gutter, (stage.clientHeight - viewport.height * canvasView.scale) / 2);
  clampCanvasView();
  renderCanvasView();
}

function beginCanvasPan(screenX, screenY, pointerId = null) {
  canvasPanning = { screenX, screenY, pointerId };
  $('#canvas-stage').classList.add('is-panning');
}

function moveCanvasPan(screenX, screenY) {
  if (!canvasPanning) return;
  canvasView.x += screenX - canvasPanning.screenX;
  canvasView.y += screenY - canvasPanning.screenY;
  canvasPanning.screenX = screenX;
  canvasPanning.screenY = screenY;
  clampCanvasView();
  renderCanvasView({ persist: false });
}

function endCanvasPan() {
  if (!canvasPanning) return;
  canvasPanning = null;
  $('#canvas-stage').classList.remove('is-panning');
  storeCanvasView();
}

function setCanvasTool(tool) {
  canvasTool = tool;
  $$('[data-canvas-mode]').forEach((candidate) => {
    const active = candidate.dataset.canvasMode === tool;
    candidate.classList.toggle('is-active', active);
    candidate.setAttribute('aria-pressed', String(active));
  });
  $('#canvas-stage').dataset.tool = tool;
  sendCommand('set-mode', { mode: tool });
}

function formatValue(value, unit = '') {
  const rendered = typeof value === 'string' ? value : JSON.stringify(value);
  return `${rendered}${unit ?? ''}`;
}

function renderLayers() {
  const root = $('#structure-list');
  const query = $('#structure-search').value.trim().toLowerCase();
  const layers = bridgeState?.layers ?? [];
  const projectComponents = projectDesign().components;
  $('#layer-total').textContent = String(
    structureTab === 'layers' ? layers.length : projectComponents.length,
  );
  $('#structure-search').placeholder =
    structureTab === 'layers' ? 'Search layers' : 'Search components';
  $('#structure-search').setAttribute(
    'aria-label',
    structureTab === 'layers' ? 'Search layers' : 'Search components',
  );
  if (structureTab === 'components') {
    const fallback = [
      ...new Set(layers.filter((item) => item.kind === 'component').map((item) => item.label)),
    ].map((name) => ({ name, instances: layers.filter((item) => item.label === name).length }));
    const components = (projectComponents.length ? projectComponents : fallback).filter(
      (component) => component.name.toLowerCase().includes(query),
    );
    root.innerHTML = components.length
      ? `<div class="component-list">${components
          .map(
            (component) =>
              `<button class="component-card" data-component-name="${escapeText(component.name)}"><span class="component-icon"><i data-icon="component"></i></span><span class="component-copy"><strong>${escapeText(component.name)}</strong><span>${escapeText(component.source ?? 'Project component')}</span></span><span class="component-count">${component.instances ?? 0}</span></button>`,
          )
          .join('')}</div>`
      : '<div class="empty-inspector">No components match this search.</div>';
    renderIcons(root);
    $$('[data-component-name]', root).forEach((button) =>
      button.addEventListener('click', () => {
        const match = layers.find((item) => item.label === button.dataset.componentName);
        if (match) sendCommand('select', { selector: match.selector });
      }),
    );
    return;
  }
  const visible = layers.filter((layer) =>
    `${layer.label} ${layer.kind}`.toLowerCase().includes(query),
  );
  root.innerHTML = visible.length
    ? visible
        .map(
          (layer) =>
            `<button class="layer-row ${layer.selected ? 'is-selected' : ''}" style="--depth:${Math.min(layer.depth, 10)}" data-layer-selector="${escapeText(layer.selector)}" role="treeitem" aria-level="${layer.depth + 1}" aria-selected="${layer.selected}"><span class="chevron">${layer.hasChildren ? '<i data-icon="chevronDown"></i>' : ''}</span><span class="layer-icon"><i data-icon="${layer.kind === 'component' ? 'component' : 'box'}"></i></span><span class="layer-label">${escapeText(layer.label)}</span><span class="layer-meta">${escapeText(layer.instrumented ? 'Mapped' : layer.kind)}</span></button>`,
        )
        .join('')
    : '<div class="empty-inspector">Select inside the live preview to populate the product structure.</div>';
  renderIcons(root);
  $$('[data-layer-selector]', root).forEach((button) =>
    button.addEventListener('click', (event) =>
      sendCommand('select', { selector: button.dataset.layerSelector, additive: event.shiftKey }),
    ),
  );
}

const POSITION_PROPERTIES = new Set([
  'left',
  'top',
  'width',
  'height',
  'widthMode',
  'heightMode',
  'minWidth',
  'maxWidth',
  'aspectRatio',
  'overflow',
  'rotate',
  'scaleX',
  'scaleY',
]);

function controlGroup(control) {
  if (control.category === 'layout')
    return POSITION_PROPERTIES.has(control.property) ? 'Position' : 'Layout';
  if (control.category === 'typography') return 'Typography';
  if (control.category === 'color') {
    if (control.property === 'backgroundColor' || control.property === 'backgroundImage')
      return 'Fill';
    if (control.property === 'color' || control.property === 'opacity') return 'Appearance';
    return 'Stroke';
  }
  if (control.category === 'effects')
    return control.property.startsWith('border') ? 'Stroke' : 'Effects';
  return control.category[0].toUpperCase() + control.category.slice(1);
}

function controlOptionLabel(control, option) {
  return option;
}

function splitCssList(value) {
  const entries = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    if (value[index] === ')') depth = Math.max(0, depth - 1);
    if (value[index] === ',' && depth === 0) {
      entries.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  entries.push(value.slice(start).trim());
  return entries.filter(Boolean);
}

function channelHex(value) {
  return Math.min(255, Math.max(0, Math.round(value)))
    .toString(16)
    .padStart(2, '0');
}

function parseShadowEffects(value) {
  if (!value || value.trim().toLowerCase() === 'none') return [];
  return splitCssList(value).map((entry) => {
    const rgb = entry.match(
      /rgba?\(\s*([\d.]+)(?:\s+|\s*,\s*)([\d.]+)(?:\s+|\s*,\s*)([\d.]+)(?:\s*(?:\/|,)\s*([\d.]+)%?)?\s*\)/i,
    );
    const hex = entry.match(/#[\da-f]{6,8}/i)?.[0];
    const color = rgb
      ? `#${channelHex(Number(rgb[1]))}${channelHex(Number(rgb[2]))}${channelHex(Number(rgb[3]))}`
      : (hex?.slice(0, 7) ?? '#000000');
    const rawAlpha = rgb?.[4] == null ? 1 : Number(rgb[4]);
    const opacity = rgb
      ? Math.min(1, Math.max(0, rgb[0].includes('%') ? rawAlpha / 100 : rawAlpha))
      : hex?.length === 9
        ? Number.parseInt(hex.slice(7), 16) / 255
        : 1;
    const values = [
      ...entry
        .replace(/rgba?\([^)]*\)/i, '')
        .replace(/#[\da-f]{3,8}/i, '')
        .replace(/\binset\b/i, '')
        .matchAll(/-?[\d.]+(?:px)?/g),
    ].map((match) => Number(match[0].replace('px', '')));
    return {
      kind: /\binset\b/i.test(entry) ? 'inner-shadow' : 'drop-shadow',
      x: values[0] ?? 0,
      y: values[1] ?? 4,
      blur: Math.max(0, values[2] ?? 8),
      spread: values[3] ?? 0,
      color,
      opacity,
    };
  });
}

function composeShadowEffects(effects) {
  if (!effects.length) return 'none';
  return effects
    .map((effect) => {
      const hex = effect.color.replace('#', '').padEnd(6, '0').slice(0, 6);
      const channels = [0, 2, 4].map(
        (start) => Number.parseInt(hex.slice(start, start + 2), 16) || 0,
      );
      const alpha = Math.round(Math.min(1, Math.max(0, effect.opacity)) * 100);
      return `${effect.kind === 'inner-shadow' ? 'inset ' : ''}${effect.x}px ${effect.y}px ${Math.max(0, effect.blur)}px ${effect.spread}px rgb(${channels.join(' ')} / ${alpha}%)`;
    })
    .join(', ');
}

function blurAmount(value) {
  const match = String(value).match(/\bblur\(\s*([\d.]+)px\s*\)/i);
  return match ? Number(match[1]) : null;
}

function replaceBlur(value, amount) {
  const normalized =
    !value || String(value).trim().toLowerCase() === 'none' ? '' : String(value).trim();
  const rest = normalized.replace(/\bblur\(\s*[\d.]+px\s*\)/gi, '').trim();
  return (
    [amount == null ? '' : `blur(${Math.max(0, amount)}px)`, rest].filter(Boolean).join(' ') ||
    'none'
  );
}

function shadowEffectMarkup(effect, effectIndex, controlIndex) {
  const label = effect.kind === 'inner-shadow' ? 'Inner shadow' : 'Drop shadow';
  const field = (part, prefix, value) =>
    `<label class="effect-value"><span>${prefix}</span><input id="effect-shadow-${controlIndex}-${effectIndex}-${part}" type="number" step="1" value="${value}" data-shadow-control="${controlIndex}" data-shadow-index="${effectIndex}" data-shadow-part="${part}" aria-label="${escapeText(`${label} ${part}`)}"></label>`;
  return `<article class="effect-card"><header class="effect-card-head"><span class="effect-symbol"><i data-icon="box"></i></span><select id="effect-shadow-${controlIndex}-${effectIndex}-kind" data-shadow-kind="${effectIndex}" data-shadow-control="${controlIndex}" aria-label="Shadow type"><option value="drop-shadow" ${effect.kind === 'drop-shadow' ? 'selected' : ''}>Drop shadow</option><option value="inner-shadow" ${effect.kind === 'inner-shadow' ? 'selected' : ''}>Inner shadow</option></select><button type="button" class="effect-remove" data-remove-shadow="${effectIndex}" data-shadow-control="${controlIndex}" aria-label="Remove ${label}"><i data-icon="close"></i></button></header><div class="effect-fields effect-shadow-fields">${field('x', 'X', effect.x)}${field('y', 'Y', effect.y)}${field('blur', 'Blur', effect.blur)}${field('spread', 'Spread', effect.spread)}<label class="effect-color"><span>Color</span><span class="effect-color-control"><input id="effect-shadow-${controlIndex}-${effectIndex}-color" type="color" value="${escapeText(effect.color)}" data-shadow-control="${controlIndex}" data-shadow-index="${effectIndex}" data-shadow-part="color" aria-label="${label} color"><input id="effect-shadow-${controlIndex}-${effectIndex}-opacity" type="number" min="0" max="100" step="1" value="${Math.round(effect.opacity * 100)}" data-shadow-control="${controlIndex}" data-shadow-index="${effectIndex}" data-shadow-part="opacity" aria-label="${label} opacity"><span>%</span></span></label></div></article>`;
}

function blurEffectMarkup(label, kind, amount, controlIndex) {
  return `<article class="effect-card"><header class="effect-card-head"><span class="effect-symbol"><i data-icon="blur"></i></span><strong>${label}</strong><button type="button" class="effect-remove" data-remove-blur="${kind}" data-blur-control="${controlIndex}" aria-label="Remove ${label}"><i data-icon="close"></i></button></header><div class="effect-fields"><label class="effect-blur"><span>Blur</span><span class="effect-value"><span>R</span><input id="effect-blur-${controlIndex}" type="number" min="0" max="200" step="1" value="${amount}" data-blur-control="${controlIndex}" aria-label="${label} amount"></span></label></div></article>`;
}

function effectsEditorMarkup(controls) {
  const shadow = controls.find((control) => control.property === 'boxShadow');
  const filter = controls.find((control) => control.property === 'filter');
  const backdrop = controls.find((control) => control.property === 'backdropFilter');
  const shadows = shadow ? parseShadowEffects(String(shadow.value)) : [];
  const layerBlur = filter ? blurAmount(filter.value) : null;
  const backgroundBlur = backdrop ? blurAmount(backdrop.value) : null;
  const active = [
    ...(shadow
      ? shadows.map((effect, index) => shadowEffectMarkup(effect, index, shadow.index))
      : []),
    ...(filter && layerBlur != null
      ? [blurEffectMarkup('Layer blur', 'layer-blur', layerBlur, filter.index)]
      : []),
    ...(backdrop && backgroundBlur != null
      ? [blurEffectMarkup('Background blur', 'background-blur', backgroundBlur, backdrop.index)]
      : []),
  ].join('');
  return `<div class="effects-editor"><div class="effect-stack">${active || '<p class="effect-empty">No effects applied</p>'}</div><details class="effect-add"><summary><i data-icon="plus"></i>Add effect</summary><div class="effect-menu" role="menu"><button type="button" data-add-effect="drop-shadow" data-effect-control="${shadow?.index ?? ''}" role="menuitem"><i data-icon="box"></i><span>Drop shadow</span></button><button type="button" data-add-effect="inner-shadow" data-effect-control="${shadow?.index ?? ''}" role="menuitem"><i data-icon="box"></i><span>Inner shadow</span></button><button type="button" data-add-effect="layer-blur" data-effect-control="${filter?.index ?? ''}" role="menuitem" ${layerBlur != null ? 'disabled' : ''}><i data-icon="blur"></i><span>Layer blur</span></button><button type="button" data-add-effect="background-blur" data-effect-control="${backdrop?.index ?? ''}" role="menuitem" ${backgroundBlur != null ? 'disabled' : ''}><i data-icon="blur"></i><span>Background blur</span></button><button type="button" role="menuitem" disabled title="Available when the project exposes a mapped effect recipe"><i data-icon="sparkles"></i><span>Noise</span><small>Recipe</small></button><button type="button" role="menuitem" disabled title="Available when the project exposes a mapped effect recipe"><i data-icon="layout"></i><span>Texture</span><small>Recipe</small></button></div></details></div>`;
}

function controlField(control) {
  const id = `control-${control.index}`;
  const unit = control.unit ? `<span class="unit">${escapeText(control.unit)}</span>` : '';
  if (control.kind === 'select') {
    return `<select id="${id}" data-control-index="${control.index}">${(control.options ?? [])
      .map(
        (option) =>
          `<option value="${escapeText(option)}" ${String(option) === String(control.value) ? 'selected' : ''}>${escapeText(controlOptionLabel(control, option))}</option>`,
      )
      .join('')}</select>`;
  }
  const type = control.kind === 'number' ? 'number' : control.kind === 'color' ? 'color' : 'text';
  return `<input id="${id}" data-control-index="${control.index}" type="${type}" value="${escapeText(control.value)}" ${control.min != null ? `min="${control.min}"` : ''} ${control.max != null ? `max="${control.max}"` : ''} ${control.step != null ? `step="${control.step}"` : ''}/>${unit}`;
}

function renderInspector() {
  if (openCustomSelect?.trigger.closest('#inspector-sections'))
    closeCustomSelect({ restoreFocus: false });
  const summary = $('#selection-summary');
  const selection = bridgeState?.selection;
  if (!selection) {
    summary.innerHTML =
      '<span class="selection-kind">No layer</span><strong>Nothing selected</strong><code>Click the canvas or choose a layer</code><p>Select mode stays active while you edit.</p>';
    $('#inspector-sections').innerHTML =
      '<div class="empty-inspector">Select a rendered element to reveal only the controls Foundry can measure safely.</div>';
    return;
  }
  summary.innerHTML = `<span class="selection-kind">${escapeText(selection.kind)}</span><strong>${escapeText(selection.label)}</strong><code>${escapeText(selection.source)}</code><p>${selection.width} × ${selection.height} px · ${escapeText(selection.confidence)}${selection.count > 1 ? ` · ${selection.count} selected` : ''}</p>`;
  const groups = new Map();
  for (const control of bridgeState.controls ?? []) {
    const group = controlGroup(control);
    groups.set(group, [...(groups.get(group) ?? []), control]);
  }
  const order = [
    'Position',
    'Layout',
    'Typography',
    'Appearance',
    'Fill',
    'Stroke',
    'Effects',
    'Content',
    'Accessibility',
    'Motion',
  ];
  const root = $('#inspector-sections');
  root.innerHTML = order
    .filter((name) => groups.has(name))
    .map((name) => {
      const controls = groups.get(name);
      const body =
        name === 'Effects'
          ? effectsEditorMarkup(controls)
          : controls
              .map((control) => {
                const changedKey = `${selection.id}:${control.property}`;
                return `<label class="property-row${changedControls.has(changedKey) ? ' is-changed' : ''}" for="control-${control.index}"><span class="property-label" title="${escapeText(control.label)}">${escapeText(control.label)}</span><span class="property-field">${controlField(control)}</span></label>`;
              })
              .join('');
      const count =
        name === 'Effects'
          ? parseShadowEffects(
              String(controls.find((control) => control.property === 'boxShadow')?.value ?? 'none'),
            ).length +
            Number(
              blurAmount(controls.find((control) => control.property === 'filter')?.value) != null,
            ) +
            Number(
              blurAmount(
                controls.find((control) => control.property === 'backdropFilter')?.value,
              ) != null,
            )
          : controls.length;
      return `<section class="inspector-category"><button class="category-head" aria-expanded="true"><i data-icon="chevronDown"></i><strong>${name}</strong><span>${count}</span></button><div class="category-body">${body}</div></section>`;
    })
    .join('');
  renderIcons(root);
  upgradeSelects(root);
  $$('.category-head', root).forEach((button) =>
    button.addEventListener('click', () => {
      const body = button.nextElementSibling;
      const open = !body.hidden;
      body.hidden = open;
      button.setAttribute('aria-expanded', String(!open));
      $('svg', button).style.transform = open ? 'rotate(-90deg)' : '';
    }),
  );
  $$('[data-add-effect]', root).forEach((button) =>
    button.addEventListener('click', () => {
      const control = bridgeState.controls[Number(button.dataset.effectControl)];
      const type = button.dataset.addEffect;
      if (!control || !type) return;
      if (type === 'drop-shadow' || type === 'inner-shadow') {
        const effects = parseShadowEffects(String(control.value));
        effects.push({
          kind: type,
          x: 0,
          y: 4,
          blur: 8,
          spread: 0,
          color: '#000000',
          opacity: 0.12,
        });
        sendCommand('set-control', {
          index: control.index,
          property: control.property,
          value: composeShadowEffects(effects),
        });
      } else {
        sendCommand('set-control', {
          index: control.index,
          property: control.property,
          value: replaceBlur(control.value, 4),
        });
      }
      changedControls.add(`${selection.id}:${control.property}`);
    }),
  );
  $$('[data-remove-shadow]', root).forEach((button) =>
    button.addEventListener('click', () => {
      const control = bridgeState.controls[Number(button.dataset.shadowControl)];
      if (!control) return;
      const effects = parseShadowEffects(String(control.value));
      effects.splice(Number(button.dataset.removeShadow), 1);
      changedControls.add(`${selection.id}:${control.property}`);
      sendCommand('set-control', {
        index: control.index,
        property: control.property,
        value: composeShadowEffects(effects),
      });
    }),
  );
  $$('[data-shadow-kind]', root).forEach((field) =>
    field.addEventListener('change', () => {
      const control = bridgeState.controls[Number(field.dataset.shadowControl)];
      if (!control) return;
      const effects = parseShadowEffects(String(control.value));
      const effect = effects[Number(field.dataset.shadowKind)];
      if (!effect) return;
      effect.kind = field.value === 'inner-shadow' ? 'inner-shadow' : 'drop-shadow';
      changedControls.add(`${selection.id}:${control.property}`);
      sendCommand('set-control', {
        index: control.index,
        property: control.property,
        value: composeShadowEffects(effects),
      });
    }),
  );
  $$('[data-shadow-part]', root).forEach((field) => {
    const commit = () => {
      const control = bridgeState.controls[Number(field.dataset.shadowControl)];
      const effects = control ? parseShadowEffects(String(control.value)) : [];
      const effect = effects[Number(field.dataset.shadowIndex)];
      const part = field.dataset.shadowPart;
      if (!control || !effect || !part) return;
      if (part === 'color') effect.color = field.value;
      else if (part === 'opacity') effect.opacity = Number(field.value) / 100;
      else effect[part] = Number(field.value);
      changedControls.add(`${selection.id}:${control.property}`);
      sendCommand('set-control', {
        index: control.index,
        property: control.property,
        value: composeShadowEffects(effects),
      });
    };
    const key = `${field.dataset.shadowControl}:${field.dataset.shadowIndex}:${field.dataset.shadowPart}`;
    field.addEventListener('input', () => scheduleEffectCommit(key, commit));
    field.addEventListener('change', commit);
    field.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      clearTimeout(effectCommitTimers.get(key));
      commit();
      field.blur();
    });
  });
  $$('[data-blur-control]:not([data-remove-blur])', root).forEach((field) => {
    const commit = (amount) => {
      const control = bridgeState.controls[Number(field.dataset.blurControl)];
      if (!control) return;
      changedControls.add(`${selection.id}:${control.property}`);
      sendCommand('set-control', {
        index: control.index,
        property: control.property,
        value: replaceBlur(control.value, amount),
      });
    };
    const key = `blur:${field.dataset.blurControl}`;
    field.addEventListener('input', () =>
      scheduleEffectCommit(key, () => commit(Number(field.value))),
    );
    field.addEventListener('change', () => commit(Number(field.value)));
    field.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      clearTimeout(effectCommitTimers.get(key));
      commit(Number(field.value));
      field.blur();
    });
  });
  $$('[data-remove-blur]', root).forEach((button) =>
    button.addEventListener('click', () => {
      const control = bridgeState.controls[Number(button.dataset.blurControl)];
      if (!control) return;
      changedControls.add(`${selection.id}:${control.property}`);
      sendCommand('set-control', {
        index: control.index,
        property: control.property,
        value: replaceBlur(control.value, null),
      });
    }),
  );
  $$('[data-control-index]', root).forEach((field) => {
    let lastCommittedValue = String(field.value);
    const commit = () => {
      if (String(field.value) === lastCommittedValue) return;
      const control = bridgeState.controls[Number(field.dataset.controlIndex)];
      lastCommittedValue = String(field.value);
      changedControls.add(`${selection.id}:${control.property}`);
      field.closest('.property-row')?.classList.add('is-changed');
      sendCommand('set-control', {
        index: control.index,
        property: control.property,
        value: control.kind === 'number' ? Number(field.value) : field.value,
      });
    };
    field.addEventListener('change', commit);
    field.addEventListener('blur', commit);
    field.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commit();
      field.blur();
    });
  });
}

function fillSelect(
  select,
  items,
  current,
  value = (item) => item.id,
  label = (item) => item.label,
) {
  if (openCustomSelect?.select === select) closeCustomSelect({ restoreFocus: false });
  const base = [
    { id: 'current', label: 'Current' },
    ...(items ?? []).filter((item) => item.id !== 'current'),
  ];
  select.innerHTML = base
    .map(
      (item) =>
        `<option value="${escapeText(value(item))}" ${String(value(item)) === String(current) ? 'selected' : ''}>${escapeText(label(item))}</option>`,
    )
    .join('');
  upgradeSelect(select);
  syncCustomSelect(select);
}

function renderContext() {
  if (!bridgeState) return;
  const { context } = bridgeState;
  const project = projectDesign();
  fillSelect($('#canvas-viewport'), project.breakpoints, context.breakpoint);
  fillSelect($('#canvas-theme'), project.themes, context.theme);
  fillSelect($('#canvas-state'), project.states, context.state);
  fillSelect($('[data-context="breakpoint"]'), project.breakpoints, context.breakpoint);
  fillSelect($('[data-context="theme"]'), project.themes, context.theme);
  fillSelect($('[data-context="state"]'), project.states, context.state);
  $('[data-context="scope"]').value = context.scope;
  syncCustomSelect($('[data-context="scope"]'));
}

async function setStatus(changeId, status) {
  await api(`/v1/sessions/${sessionId}/changes/${encodeURIComponent(changeId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  await loadSession();
}

function validChange(change) {
  return (
    change.status === 'approved' &&
    change.confidence !== 'unresolved' &&
    !(change.mappingCandidates?.length > 1 && !change.selectedMappingId)
  );
}

function renderReview() {
  const changes = activeSession?.changeSet?.changes ?? [];
  const groups = new Map();
  for (const change of changes) {
    const key = change.target.id;
    const group = groups.get(key) ?? { target: change.target, changes: [] };
    group.changes.push(change);
    groups.set(key, group);
  }
  const included = changes.filter(validChange).length;
  $('#review-count').textContent = `${included} included`;
  $('#apply-agent').textContent = included
    ? `Apply ${included} with agent`
    : 'Review changes first';
  $('#apply-agent').disabled = included === 0;
  $('#changes').innerHTML = groups.size
    ? [...groups.values()]
        .map(
          (group) =>
            `<section class="change-group"><header class="change-group-head"><strong>${escapeText(group.target.label)}</strong><span>${group.changes.length} ${group.changes.length === 1 ? 'change' : 'changes'}</span></header>${group.changes
              .map((change) => {
                const unresolved =
                  change.confidence === 'unresolved' ||
                  (change.mappingCandidates?.length > 1 && !change.selectedMappingId);
                return `<div class="change-row"><input type="checkbox" data-change-id="${escapeText(change.id)}" ${validChange(change) ? 'checked' : ''} ${unresolved ? 'disabled' : ''} aria-label="Include ${escapeText(change.property)}"><span class="change-property"><strong>${escapeText(change.property)}</strong><span>${escapeText(change.scope)} · ${escapeText(change.context.breakpoint)} · ${escapeText(change.context.theme)}</span></span><span class="before-value">${escapeText(formatValue(change.before, change.unit))}</span><span class="change-arrow">→</span><input class="after-value" data-after-id="${escapeText(change.id)}" value="${escapeText(formatValue(change.after, change.unit))}" aria-label="New ${escapeText(change.property)} value"><span class="status-chip ${unresolved ? 'unresolved' : ''}">${escapeText(unresolved ? 'Mapping needed' : change.confidence)}</span></div>`;
              })
              .join('')}</section>`,
        )
        .join('')
    : '<div class="empty-mode"><i data-icon="file"></i><strong>No changes recorded</strong><p>Return to Canvas and adjust a measured property.</p></div>';
  renderIcons($('#changes'));
  $$('[data-change-id]').forEach((input) =>
    input.addEventListener('change', () =>
      setStatus(input.dataset.changeId, input.checked ? 'approved' : 'rejected'),
    ),
  );
}

const RUN_ORDER = ['queued', 'claimed', 'applying', 'rebuilding', 'verifying', 'passed'];
function renderApplyRun(runs = []) {
  const root = $('#apply-run');
  const run = runs.at(-1);
  if (!run || ['passed', 'cancelled'].includes(run.state)) {
    root.hidden = true;
    return;
  }
  root.hidden = false;
  const activeIndex = Math.max(0, RUN_ORDER.indexOf(run.state));
  const labels = [
    'Queued for agent',
    'Agent connected',
    'Applying source edits',
    'Rebuilding project',
    'Verifying rendered values',
    'Complete',
  ];
  root.innerHTML = `<div class="apply-card"><span class="eyebrow">Attempt ${run.attempts}</span><h1>${escapeText(run.state.replaceAll('_', ' '))}</h1><p>${escapeText(run.messages?.at(-1)?.message ?? run.error ?? 'The reviewed batch is ready.')}</p><div class="run-steps">${labels.map((label, index) => `<div class="run-step ${index < activeIndex ? 'is-complete' : ''} ${index === activeIndex ? 'is-active' : ''}"><i></i><strong>${label}</strong></div>`).join('')}</div>${['needs_attention', 'failed'].includes(run.state) ? `<button class="primary-button" data-run-action="retry" data-run-id="${run.id}">Retry with agent</button>` : `<button class="secondary-button" data-run-action="cancel" data-run-id="${run.id}">Cancel</button>`}</div>`;
  $$('[data-run-action]', root).forEach((button) =>
    button.addEventListener('click', async () => {
      await api(
        `/v1/sessions/${sessionId}/apply-runs/${button.dataset.runId}/${button.dataset.runAction}`,
        { method: 'POST', body: '{}' },
      );
      await loadSession();
    }),
  );
}

function renderChangeSummary() {
  const changes =
    activeSession?.changeSet?.changes?.filter((change) => change.status !== 'rejected') ?? [];
  const root = $('#change-summary');
  root.hidden = changes.length === 0 || activeMode !== 'canvas';
  if (!changes.length) return;
  const latest = changes.at(-1);
  const run = activeSession?.applyRuns?.at(-1);
  const activeRun =
    run && ['queued', 'claimed', 'applying', 'rebuilding', 'verifying'].includes(run.state);
  $('#change-count').textContent =
    `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} recorded`;
  $('#latest-change').textContent = activeRun
    ? run.state.replaceAll('_', ' ')
    : `${latest.target.label} · ${latest.property}`;
  $('#compare').disabled = changes.length === 0;
}

function renderStates() {
  const breakpoints = projectDesign().breakpoints;
  const cards = [
    ...breakpoints
      .slice(0, 3)
      .map((item) => ({ title: item.label, detail: `${item.width} × ${item.height}px viewport` })),
    {
      title: 'Hover and focus',
      detail: 'Inspect interactive states without leaving the workspace.',
    },
    { title: 'Reduced motion', detail: 'Check motion decisions against the user preference.' },
    {
      title: 'Theme context',
      detail: 'Compare project light and dark states independently of the Foundry UI.',
    },
  ];
  $('#state-grid').innerHTML = cards
    .map(
      (card) =>
        `<article class="condition-card"><strong>${escapeText(card.title)}</strong><span>${escapeText(card.detail)}</span></article>`,
    )
    .join('');
}

function renderHealth() {
  const root = $('[data-mode-surface="health"] .empty-mode');
  const issues = bridgeState?.health ?? [];
  if (!issues.length) return;
  root.innerHTML = issues
    .map(
      (issue) =>
        `<article class="condition-card"><strong>${escapeText(issue.title ?? issue.kind)}</strong><span>${escapeText(issue.detail ?? issue.message)}</span></article>`,
    )
    .join('');
}

function renderMemory() {
  const tokens = projectDesign().tokens;
  const memory = bridgeState?.memory ?? {};
  const cards = [
    {
      title: `${tokens.length} project tokens`,
      detail: 'Native color, type, spacing, radius, and motion values.',
    },
    {
      title: `${memory.recipes?.length ?? 0} saved treatments`,
      detail: 'Reusable decisions that remain local to this project.',
    },
    {
      title: `${memory.baselines?.length ?? 0} verified baselines`,
      detail: 'Rendered values that passed after source application.',
    },
  ];
  $('#memory-grid').innerHTML = cards
    .map(
      (card) =>
        `<article class="memory-card"><strong>${card.title}</strong><p>${card.detail}</p></article>`,
    )
    .join('');
}

function focusedInspectorEdit() {
  const active = document.activeElement;
  const inspectorContent = $('#inspector-content');
  if (!inspectorContent?.contains(active)) return null;
  const customSelect = active?.classList?.contains('foundry-select-trigger')
    ? document.getElementById(active.dataset.selectFor)
    : null;
  const field = customSelect ?? active;
  if (!field?.id || !(field instanceof HTMLInputElement || field instanceof HTMLSelectElement))
    return null;
  return {
    id: field.id,
    value: field.value,
    custom: Boolean(customSelect),
    start: field instanceof HTMLInputElement ? field.selectionStart : null,
    end: field instanceof HTMLInputElement ? field.selectionEnd : null,
  };
}

function restoreInspectorEdit(edit) {
  if (!edit) return;
  const field = document.getElementById(edit.id);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;
  field.value = edit.value;
  syncCustomSelect(field);
  const focusTarget = edit.custom
    ? field.closest('.foundry-select')?.querySelector('.foundry-select-trigger')
    : field;
  focusTarget?.focus({ preventScroll: true });
  if (field instanceof HTMLInputElement && edit.start != null && edit.end != null) {
    field.setSelectionRange(edit.start, edit.end);
  }
}

function renderBridgeState() {
  const focusedEdit = focusedInspectorEdit();
  renderLayers();
  renderInspector();
  restoreInspectorEdit(focusedEdit);
  renderContext();
  updateCanvasViewport();
  $('#canvas-detail').textContent = bridgeState.selection
    ? `${bridgeState.selection.label} · ${bridgeState.selection.width} × ${bridgeState.selection.height}px`
    : 'Select a rendered element';
  $('#undo').disabled = !bridgeState.history?.canUndo;
  $('#redo').disabled = !bridgeState.history?.canRedo;
}

function renderSession(payload) {
  activeSession = payload;
  const context = payload.changeSet.context;
  $('#project-name').textContent = context.targetName ?? 'Design workspace';
  renderChangeSummary();
  renderApplyRun(payload.applyRuns ?? []);
  if (activeMode === 'review') renderReview();
  updateCanvasViewport();
}

async function loadSession() {
  if (!sessionId || !token) return;
  try {
    renderSession(await api(`/v1/sessions/${sessionId}`));
  } catch (error) {
    toast(error.message);
  }
}

function setupPreview() {
  if (!previewUrl) {
    $('#preview-loading').hidden = true;
    $('#preview-fallback').hidden = false;
    $('#direct-preview').hidden = true;
    return;
  }
  const embedded = new URL(previewUrl);
  embedded.searchParams.set('__foundry_embedded', '1');
  preview.src = embedded.href;
  $('#direct-preview').href = previewUrl;
  $('#direct-preview-menu').href = previewUrl;
  setTimeout(() => {
    if (!bridgeConnected) {
      $('#preview-loading').hidden = true;
      $('#preview-fallback').hidden = false;
    }
  }, 5000);
}

window.addEventListener('message', (event) => {
  if (event.source !== preview.contentWindow || event.origin !== previewOrigin) return;
  if (event.data?.sessionId !== sessionId) return;
  if (event.data?.type === 'foundry:canvas-input') {
    const {
      action,
      screenX,
      screenY,
      deltaX = 0,
      deltaY = 0,
      clientX,
      clientY,
    } = event.data.payload ?? {};
    if (action === 'pan-start') beginCanvasPan(screenX, screenY);
    if (action === 'pan-move') moveCanvasPan(screenX, screenY);
    if (action === 'pan-end') endCanvasPan();
    if (action === 'pan-wheel') {
      canvasView.x -= deltaX;
      canvasView.y -= deltaY;
      clampCanvasView();
      renderCanvasView();
    }
    if (action === 'zoom-wheel') {
      const frameRect = $('#preview-frame').getBoundingClientRect();
      const anchorX = frameRect.left + clientX * canvasView.scale;
      const anchorY = frameRect.top + clientY * canvasView.scale;
      setCanvasZoom(canvasView.scale * Math.exp(-deltaY * 0.002), anchorX, anchorY);
    }
    if (action === 'shortcut' && event.data.payload?.key === 'h') setCanvasTool('pan');
    if (action === 'shortcut' && event.data.payload?.key === 'v') setCanvasTool('select');
    if (action === 'space') {
      canvasSpaceHeld = Boolean(event.data.payload?.pressed);
      $('#canvas-stage').classList.toggle('is-space-pan', canvasSpaceHeld);
    }
    return;
  }
  if (event.data?.type !== 'foundry:workspace-state') return;
  bridgeConnected = true;
  bridgeState = event.data.payload;
  $('#preview-loading').hidden = true;
  $('#preview-fallback').hidden = true;
  renderBridgeState();
});

$$('[data-dock-toggle]').forEach((button) =>
  button.addEventListener('click', () => {
    const name = button.dataset.dockToggle;
    setDockVisibility(name, $(`#${name}-dock`).hidden);
  }),
);
$$('[data-workspace-mode]').forEach((button) =>
  button.addEventListener('click', () => {
    const returnFocus = button.closest('.workspace-menu') ? $('#workspace-menu-trigger') : button;
    setMode(button.dataset.workspaceMode, true, returnFocus);
  }),
);
$$('[data-structure-tab]').forEach((button) =>
  button.addEventListener('click', () => {
    structureTab = button.dataset.structureTab;
    $$('[data-structure-tab]').forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle('is-active', selected);
      candidate.setAttribute('aria-selected', String(selected));
    });
    renderLayers();
  }),
);
$('#structure-search').addEventListener('input', renderLayers);
$$('[data-canvas-mode]').forEach((button) =>
  button.addEventListener('click', () => setCanvasTool(button.dataset.canvasMode)),
);
$('#undo').addEventListener('click', () => sendCommand('undo'));
$('#redo').addEventListener('click', () => sendCommand('redo'));
function toggleComparison(mode) {
  comparisonMode = mode ?? (comparisonMode === 'after' ? 'before' : 'after');
  sendCommand('compare', { mode: comparisonMode });
  $('#compare').classList.toggle('is-active', comparisonMode === 'before');
  $('#compare').setAttribute('aria-pressed', String(comparisonMode === 'before'));
  toast(comparisonMode === 'before' ? 'Showing source baseline' : 'Showing current preview');
}

$('#compare').addEventListener('click', () => toggleComparison());
$('#review-compare').addEventListener('click', () => {
  setMode('canvas', false);
  toggleComparison('before');
});
$$('[data-context]').forEach((select) =>
  select.addEventListener('change', () =>
    sendCommand('set-context', { key: select.dataset.context, value: select.value }),
  ),
);
$('#canvas-viewport').addEventListener(
  'change',
  (event) => (
    sendCommand('set-context', { key: 'breakpoint', value: event.target.value }),
    updateCanvasViewport()
  ),
);
$('#canvas-theme').addEventListener('change', (event) =>
  sendCommand('set-context', { key: 'theme', value: event.target.value }),
);
$('#canvas-state').addEventListener('change', (event) =>
  sendCommand('set-context', { key: 'state', value: event.target.value }),
);
$('#apply-agent').addEventListener('click', async () => {
  const reviews = (activeSession?.changeSet?.changes ?? []).map((change) => {
    const afterField = $(`[data-after-id="${CSS.escape(change.id)}"]`);
    const raw = afterField?.value;
    const after = typeof change.after === 'number' && raw != null ? Number.parseFloat(raw) : raw;
    return {
      changeId: change.id,
      approved: validChange(change),
      ...(raw != null ? { after } : {}),
    };
  });
  try {
    await api(`/v1/sessions/${sessionId}/apply-runs`, {
      method: 'POST',
      body: JSON.stringify({ reviews, revision: activeSession.changeSet.context.revision }),
    });
    await loadSession();
  } catch (error) {
    toast(error.message);
  }
});
$('#run-health').addEventListener('click', () => {
  sendCommand('scan-health');
  toast('Scanning the rendered canvas');
});
$$('[data-close-mode]').forEach((button) =>
  button.addEventListener('click', () => setMode('canvas')),
);

$('#workspace-menu-trigger').addEventListener('click', () => {
  const menu = $('#workspace-menu');
  menu.hidden = !menu.hidden;
  $('#workspace-menu-trigger').setAttribute('aria-expanded', String(!menu.hidden));
});
document.addEventListener('pointerdown', (event) => {
  if (
    !$('#workspace-menu').hidden &&
    !event.composedPath().includes($('#workspace-menu')) &&
    !event.composedPath().includes($('#workspace-menu-trigger'))
  )
    closeWorkspaceMenu();
});

const themeChoices = ['system', 'light', 'dark'];
$('[data-theme-choice]').addEventListener('click', () => {
  const current = document.documentElement.dataset.themePreference ?? 'system';
  applyTheme(themeChoices[(themeChoices.indexOf(current) + 1) % themeChoices.length]);
  closeWorkspaceMenu();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (document.documentElement.dataset.themePreference === 'system') applyTheme('system', false);
});

const commands = [
  ['canvas', 'Canvas', '1', 'cursor'],
  ['review', 'Review changes', '2', 'file'],
  ['states', 'State workbench', '3', 'play'],
  ['health', 'Design health', '4', 'activity'],
  ['memory', 'Design memory', '5', 'bookmark'],
];
function renderCommands(query = '') {
  const root = $('#command-list');
  root.innerHTML = commands
    .filter((command) => command[1].toLowerCase().includes(query.toLowerCase()))
    .map(
      (command) =>
        `<button data-command-mode="${command[0]}"><i data-icon="${command[3]}"></i><span>${command[1]}</span><kbd>${command[2]}</kbd></button>`,
    )
    .join('');
  renderIcons(root);
  $$('[data-command-mode]', root).forEach((button) =>
    button.addEventListener('click', () => {
      modeFocusReturn = $('#command-trigger');
      setMode(button.dataset.commandMode, true, modeFocusReturn);
      $('#command-dialog').close();
    }),
  );
}
$('#command-trigger').addEventListener('click', () => {
  renderCommands();
  $('#command-dialog').showModal();
  $('#command-input').focus();
});
$('#close-commands').addEventListener('click', () => $('#command-dialog').close());
$('#command-input').addEventListener('input', (event) => renderCommands(event.target.value));

$('#dock-resizer').addEventListener('pointerdown', (event) => {
  if (innerWidth <= 680 || event.button !== 0) return;
  const startX = event.clientX;
  const startWidth =
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock')) || 384;
  event.currentTarget.setPointerCapture(event.pointerId);
  const move = (pointer) => {
    const width = Math.max(340, Math.min(520, startWidth + startX - pointer.clientX));
    document.documentElement.style.setProperty('--dock', `${Math.round(width)}px`);
  };
  const stop = () => {
    event.currentTarget.removeEventListener('pointermove', move);
    event.currentTarget.removeEventListener('pointerup', stop);
    localStorage.setItem(
      dockKey,
      getComputedStyle(document.documentElement).getPropertyValue('--dock').trim(),
    );
  };
  event.currentTarget.addEventListener('pointermove', move);
  event.currentTarget.addEventListener('pointerup', stop);
});

const canvasStage = $('#canvas-stage');
const canvasResizeObserver = new ResizeObserver(() => {
  clampCanvasView();
  renderCanvasView({ persist: false });
});
canvasResizeObserver.observe(canvasStage);
canvasStage.addEventListener('pointerdown', (event) => {
  const shouldPan = canvasTool === 'pan' || canvasSpaceHeld || event.button === 1;
  if (!shouldPan) return;
  event.preventDefault();
  canvasStage.setPointerCapture(event.pointerId);
  beginCanvasPan(event.screenX, event.screenY, event.pointerId);
});
canvasStage.addEventListener('pointermove', (event) => {
  if (!canvasPanning || canvasPanning.pointerId !== event.pointerId) return;
  moveCanvasPan(event.screenX, event.screenY);
});
canvasStage.addEventListener('pointerup', (event) => {
  if (!canvasPanning || canvasPanning.pointerId !== event.pointerId) return;
  if (canvasStage.hasPointerCapture(event.pointerId))
    canvasStage.releasePointerCapture(event.pointerId);
  endCanvasPan();
});
canvasStage.addEventListener('pointercancel', endCanvasPan);
canvasStage.addEventListener(
  'wheel',
  (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      setCanvasZoom(
        canvasView.scale * Math.exp(-event.deltaY * 0.002),
        event.clientX,
        event.clientY,
      );
      return;
    }
    if (canvasTool === 'interact' && event.target.closest('.preview-frame')) return;
    event.preventDefault();
    canvasView.x -= event.deltaX;
    canvasView.y -= event.deltaY;
    clampCanvasView();
    renderCanvasView();
  },
  { passive: false },
);

const zoomSteps = [0.05, 0.1, 0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
function stepZoom(direction) {
  const current = canvasView.scale;
  const next =
    direction > 0
      ? (zoomSteps.find((value) => value > current + 0.001) ?? 4)
      : ([...zoomSteps].reverse().find((value) => value < current - 0.001) ?? 0.05);
  setCanvasZoom(next);
}
$('#zoom-out').addEventListener('click', () => stepZoom(-1));
$('#zoom-in').addEventListener('click', () => stepZoom(1));
$('#canvas-zoom').addEventListener('change', (event) => {
  const value = event.target.value;
  if (value === 'fit' || value === 'fit-width') fitCanvas(value);
  else if (value === 'actual') setCanvasZoom(1, undefined, undefined, { resetOrigin: true });
  else if (value !== 'custom') setCanvasZoom(Number(value));
});
window.addEventListener('resize', () => {
  closeCustomSelect({ restoreFocus: false });
  clampCanvasView();
  renderCanvasView({ persist: false });
});
window.addEventListener(
  'scroll',
  (event) => {
    if (performance.now() < ignoreSelectScrollUntil) return;
    if (openCustomSelect?.portal.contains(event.target)) return;
    closeCustomSelect({ restoreFocus: false });
  },
  true,
);
document.addEventListener('pointerdown', (event) => {
  if (
    openCustomSelect &&
    !event.composedPath().includes(openCustomSelect.portal) &&
    !event.composedPath().includes(openCustomSelect.trigger)
  )
    closeCustomSelect({ restoreFocus: false });
});

document.addEventListener('keydown', (event) => {
  if (openCustomSelect) {
    const { portal } = openCustomSelect;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCustomSelect();
      return;
    }
    if (event.key === 'Tab') {
      closeCustomSelect({ restoreFocus: false });
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelectFocus(portal, event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      moveSelectFocus(portal, event.key === 'Home' ? 'first' : 'last');
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const option = document.activeElement?.closest?.('[data-option-index]');
      if (option) {
        event.preventDefault();
        option.click();
      }
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key)) {
      clearTimeout(openCustomSelect.typeaheadTimer);
      openCustomSelect.typeahead += event.key.toLowerCase();
      const match = [...portal.querySelectorAll('button:not(:disabled)')].find((button) =>
        button.textContent.trim().toLowerCase().startsWith(openCustomSelect.typeahead),
      );
      match?.focus({ preventScroll: true });
      openCustomSelect.typeaheadTimer = setTimeout(() => {
        if (openCustomSelect) openCustomSelect.typeahead = '';
      }, 500);
      return;
    }
  }
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if (event.key === 'Escape') {
    if ($('#command-dialog').open) $('#command-dialog').close();
    else if (!$('#workspace-menu').hidden) closeWorkspaceMenu();
    else if (activeMode !== 'canvas') setMode('canvas');
    return;
  }
  if (event.code === 'Space' && activeMode === 'canvas') {
    event.preventDefault();
    canvasSpaceHeld = true;
    canvasStage.classList.add('is-space-pan');
    return;
  }
  if (event.key.toLowerCase() === 'h' && activeMode === 'canvas') {
    event.preventDefault();
    setCanvasTool('pan');
    return;
  }
  if (event.key.toLowerCase() === 'v' && activeMode === 'canvas') {
    event.preventDefault();
    setCanvasTool('select');
    return;
  }
  const command = commands.find((item) => item[2] === event.key);
  if (command) setMode(command[0], true, document.activeElement);
});
document.addEventListener('keyup', (event) => {
  if (event.code !== 'Space') return;
  canvasSpaceHeld = false;
  canvasStage.classList.remove('is-space-pan');
});

const storedDock = Number.parseFloat(localStorage.getItem(dockKey));
if (Number.isFinite(storedDock))
  document.documentElement.style.setProperty(
    '--dock',
    `${Math.max(340, Math.min(520, storedDock))}px`,
  );
applyTheme(
  queryTheme === 'light' || queryTheme === 'dark'
    ? queryTheme
    : (localStorage.getItem(themeKey) ?? 'system'),
  false,
);
renderIcons();
upgradeSelects();
setMode(activeMode, false);
setupPreview();
await loadSession();
setInterval(loadSession, 1500);
