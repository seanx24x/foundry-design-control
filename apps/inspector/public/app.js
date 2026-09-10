import activityIcon from '@iconify-icons/keyline-icons/activity';
import arrowUpRightIcon from '@iconify-icons/keyline-icons/arrow-up-right';
import bookmarkIcon from '@iconify-icons/keyline-icons/bookmark';
import binIcon from '@iconify-icons/keyline-icons/bin';
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
import cursorTextIcon from '@iconify-icons/keyline-icons/cursor-text';
import fileIcon from '@iconify-icons/keyline-icons/file-text';
import gitBranchIcon from '@iconify-icons/keyline-icons/git-branch';
import gitCompareIcon from '@iconify-icons/keyline-icons/git-compare';
import gitMergeIcon from '@iconify-icons/keyline-icons/git-merge';
import interactIcon from '@iconify-icons/keyline-icons/cursor-click';
import layersIcon from '@iconify-icons/keyline-icons/grid-squares';
import layoutIcon from '@iconify-icons/keyline-icons/layout-dashboard';
import menuIcon from '@iconify-icons/keyline-icons/menu';
import messageIcon from '@iconify-icons/keyline-icons/message';
import minusIcon from '@iconify-icons/keyline-icons/minus';
import panelLeftIcon from '@iconify-icons/keyline-icons/panel-left';
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
  bin: binIcon,
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
  typography: cursorTextIcon,
  external: arrowUpRightIcon,
  file: fileIcon,
  branch: gitBranchIcon,
  compare: gitCompareIcon,
  merge: gitMergeIcon,
  interact: interactIcon,
  layers: layersIcon,
  layout: layoutIcon,
  menu: menuIcon,
  message: messageIcon,
  minus: minusIcon,
  panelLeft: panelLeftIcon,
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
let bridgeBranchSynced = false;
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
let commandRequestId = 0;
let dismissedApplyRunId = null;
let cancelConfirmationRunId = null;
let cancelConfirmationUntil = 0;
let workshopComponentId = '';
let workshopVariantId = '';
let workshopStateId = 'current';
let responsiveCustomWidth = 1280;
let responsiveContainerWidth = 480;
let responsiveScrubTarget = 'viewport';
let responsiveStressMode = 'none';
let responsiveEditScope = 'breakpoint';
let responsiveActiveViewport = 'current';
let designSystemTokenId = '';
let designSystemCategory = 'all';
let designSystemView = 'tokens';
let designSystemPromotionId = '';
let motionStudioId = '';
let motionStudioInteracting = false;
let motionComparisonFrame = 0;
let motionComparisonStartedAt = 0;
let typographySource = 'project';
let typographyGoogleFonts = [];
let typographyGoogleStatus = 'idle';
let typographyLocalFonts = [];
let typographyScale = { base: 16, ratio: 1.25, step: 1, fluid: false };
let typographyGoogleStrategy = 'framework';
let typographyGoogleSelection = null;
let typographySearchTimer = null;
let branchCompareLeft = 'main';
let branchCompareRight = '';
let stressScope = 'selection';
let stressSeverity = 'all';
let stressGroupBy = 'severity';
let stressSelectionInitialized = false;
let visualRecipeId = '';
let visualRecipeSearch = '';
let decisionMemoryId = '';
let decisionMemorySearch = '';
let decisionMemoryFilter = 'all';
let decisionMemoryOutcome = 'approved';
let visualAgentRequestId = '';
let visualAgentRegionPending = false;
const selectedStressConditions = new Set();
const branchDecisionSelection = new Set();
const designBranchFrames = new Map();
const responsiveFrames = new Map();
const responsiveSnapshots = new Map();
let responsiveComparisonBefore = null;
let responsiveComparisonAfter = null;
const pendingCommandRequests = new Map();
const changedControls = new Set();
const effectCommitTimers = new Map();
const expandedMotionTracks = new Set();
const selectedMotionKeyframes = new Map();

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
  (selected ?? portal.querySelector('button:not(:disabled)'))?.focus({
    preventScroll: true,
  });
  openCustomSelect = {
    select,
    trigger,
    portal,
    typeahead: '',
    typeaheadTimer: 0,
  };
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

function escapeAttribute(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
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

function requestCommand(command, payload = {}) {
  if (!bridgeConnected || !preview.contentWindow) {
    return Promise.reject(
      new Error('Reconnect the live preview to delete and restore this change.'),
    );
  }
  const requestId = `workspace_${++commandRequestId}`;
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pendingCommandRequests.delete(requestId);
      reject(new Error('The live preview did not respond. Try again after it reconnects.'));
    }, 5000);
    pendingCommandRequests.set(requestId, { resolve, reject, timeout });
    preview.contentWindow.postMessage(
      {
        type: 'foundry:workspace-command',
        sessionId,
        command,
        payload,
        requestId,
      },
      previewOrigin,
    );
  });
}

function setMode(mode, restoreFocus = true, returnFocus = null) {
  closeCustomSelect({ restoreFocus: false });
  const previousMode = activeMode;
  if (previousMode === 'responsive' && mode !== 'responsive') {
    responsiveStressMode = 'none';
    $$('[data-responsive-stress]').forEach((button) =>
      button.classList.toggle('is-active', button.dataset.responsiveStress === 'none'),
    );
    $$('[data-responsive-frame]').forEach((frame) => {
      responsiveFrameCommand(frame, 'preview-responsive-stress', { mode: 'none' });
      responsiveFrameCommand(frame, 'preview-responsive-container', { width: null });
    });
  }
  if (mode !== 'canvas' && previousMode === 'canvas') {
    lastModeFocus = returnFocus ?? document.activeElement;
  }
  activeMode = mode;
  sessionStorage.setItem(modeKey, mode);
  $('#app-shell').dataset.mode = mode;
  $$('[data-workspace-mode].rail-button').forEach((button) => {
    const selected = button.dataset.workspaceMode === mode;
    button.classList.toggle('is-active', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $$('[data-mode-surface]').forEach((surface) => {
    surface.hidden = surface.dataset.modeSurface !== mode;
  });
  if (mode === 'review') {
    dismissedApplyRunId = null;
    lastReviewFocus = document.activeElement;
    renderReview();
    renderApplyRun(activeSession?.applyRuns ?? []);
  } else if (mode === 'canvas' && restoreFocus) {
    const target = modeFocusReturn ?? lastModeFocus ?? lastReviewFocus;
    if (target instanceof HTMLElement && target.isConnected) target.focus();
    modeFocusReturn = null;
  }
  if (mode === 'states') renderStates();
  if (mode === 'health') renderHealth();
  if (mode === 'memory') renderMemory();
  if (mode === 'components') renderComponentWorkshop();
  if (mode === 'responsive') renderResponsiveLab();
  if (mode === 'system') renderDesignSystem();
  if (mode === 'motion') renderMotionStudio();
  if (mode === 'typography') {
    renderTypographyStudio();
    if (typographyGoogleStatus === 'idle') void loadTypographyGoogleFonts('');
  }
  if (mode === 'branches') renderDesignBranches();
  if (mode === 'recipes') renderVisualRecipes();
  if (mode === 'agent') renderVisualAgent();
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
  $$(`[data-dock-toggle="${name}"]`).forEach((button) => {
    button.classList.toggle('is-active', visible);
    button.setAttribute('aria-pressed', String(visible));
  });
  const layersVisible = !$('#layers-dock').hidden;
  const inspectorVisible = !$('#inspector-dock').hidden;
  const columns = `48px ${layersVisible ? 'var(--dock)' : '0px'} minmax(0,1fr) ${inspectorVisible ? 'var(--dock)' : '0px'}`;
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
    containerQueries: preferLive('containerQueries'),
    themes: preferLive('themes'),
    states: preferLive('states'),
    tokenUsages: preferLive('tokenUsages'),
    designSystemFindings: preferLive('designSystemFindings'),
    tokenPromotions: preferLive('tokenPromotions'),
  };
}

function sourceText(source) {
  if (!source) return 'Source mapping unavailable';
  if (typeof source === 'string') return source;
  return `${source.file ?? 'Source mapping unavailable'}${source.line ? `:${source.line}` : ''}`;
}

function workshopVariantDrift(instances, variant) {
  if (!variant) return [];
  return instances.flatMap((instance) =>
    Object.entries(variant.props ?? {}).flatMap(([property, expected]) => {
      const actual = instance.variantProps?.[property];
      if (actual == null || String(actual) === String(expected)) return [];
      return [{ instance, property, expected, actual }];
    }),
  );
}

function normalizedWorkshopComponents() {
  const layers = bridgeState?.layers ?? [];
  const definitions = projectDesign().components.map((component) => ({
    ...component,
    instances: component.instances ?? 0,
    variants: (component.variants ?? []).map((variant) => ({
      id: variant.id,
      name: variant.name ?? variant.label ?? 'Unnamed variant',
      props:
        variant.props ??
        (variant.property && ['string', 'number', 'boolean'].includes(typeof variant.value)
          ? { [variant.property]: variant.value }
          : {}),
      source: variant.source,
    })),
  }));
  const catalog = new Map();
  definitions.forEach((component) => {
    catalog.set(component.id || component.name, {
      ...component,
      key: component.id || component.name,
      elements: [],
    });
  });
  layers
    .filter((layer) => layer.component)
    .forEach((layer) => {
      const name = layer.component.split('/').filter(Boolean).at(-1) ?? layer.label;
      const definition = definitions.find(
        (component) =>
          component.id === layer.component ||
          component.name === layer.component ||
          component.name === name,
      );
      const key = definition?.id || layer.component;
      const entry = catalog.get(key) ?? {
        id: layer.component,
        key,
        name,
        source: layer.source,
        instances: 0,
        variants: [],
        elements: [],
      };
      entry.elements.push(layer);
      entry.instances = Math.max(entry.instances ?? 0, entry.elements.length);
      catalog.set(key, entry);
    });
  return [...catalog.values()].sort(
    (a, b) =>
      Number(b.elements.length > 0) - Number(a.elements.length > 0) || a.name.localeCompare(b.name),
  );
}

const WORKSHOP_STATES = [
  ['current', 'Default', 'instrumented'],
  ['hover', 'Hover', 'instrumented'],
  ['focus', 'Focus', 'instrumented'],
  ['active', 'Pressed', 'instrumented'],
  ['disabled', 'Disabled', 'instrumented'],
  ['loading', 'Loading', 'inferred'],
  ['empty', 'Empty', 'inferred'],
  ['error', 'Error', 'inferred'],
];

function workshopStates() {
  const states = new Map(WORKSHOP_STATES.map((item) => [item[0], item]));
  projectDesign().states.forEach((state) => {
    states.set(state.id, [
      state.id,
      state.label,
      state.confidence === 'instrumented' ? 'instrumented' : 'inferred',
    ]);
  });
  return [...states.values()];
}

function currentWorkshopComponent() {
  const catalog = normalizedWorkshopComponents();
  const selectedComponent = bridgeState?.selection?.component;
  return (
    catalog.find(
      (component) => component.key === workshopComponentId || component.id === workshopComponentId,
    ) ??
    catalog.find((component) => component.elements.some((element) => element.selected)) ??
    catalog.find((component) => component.id === selectedComponent) ??
    catalog.find((component) => component.elements.length) ??
    catalog[0]
  );
}

function renderComponentWorkshop() {
  const list = $('#component-workshop-list');
  const detail = $('#component-workshop-detail');
  const contract = $('#component-workshop-contract');
  if (!list || !detail || !contract) return;
  const query = $('#component-workshop-search').value.trim().toLowerCase();
  const catalog = normalizedWorkshopComponents();
  const component = currentWorkshopComponent();
  if (component) workshopComponentId = component.key;
  const visible = catalog.filter((item) =>
    `${item.name} ${sourceText(item.source)}`.toLowerCase().includes(query),
  );
  list.innerHTML = visible.length
    ? visible
        .map(
          (item) =>
            `<button class="workshop-component-row ${item.key === component?.key ? 'is-active' : ''}" data-workshop-component="${escapeAttribute(item.key)}"><i data-icon="component"></i><span><strong>${escapeText(item.name)}</strong><span>${escapeText(sourceText(item.source))}</span></span><code>${item.elements.length || '—'}</code></button>`,
        )
        .join('')
    : '<div class="empty-inspector">No components match this search.</div>';
  renderIcons(list);
  $$('[data-workshop-component]', list).forEach((button) =>
    button.addEventListener('click', () => {
      workshopComponentId = button.dataset.workshopComponent;
      workshopVariantId = '';
      workshopStateId = 'current';
      const next = currentWorkshopComponent();
      if (next?.elements.length)
        sendCommand('select-component-instance', {
          componentId: next.key,
          index: 0,
        });
      renderComponentWorkshop();
    }),
  );
  if (!component) {
    detail.innerHTML = '<div class="workshop-empty">No indexed components are available yet.</div>';
    contract.innerHTML =
      '<div class="workshop-empty"><strong>No source contract</strong><span>Choose an indexed component.</span></div>';
    $('#component-workshop-readiness').textContent = 'Instrument a component to begin.';
    return;
  }
  const variants = component.variants ?? [];
  if (workshopVariantId && !variants.some((variant) => variant.id === workshopVariantId))
    workshopVariantId = '';
  const selectedVariant = variants.find((variant) => variant.id === workshopVariantId);
  const axes = component.variantAxes ?? [];
  const drift = workshopVariantDrift(component.elements, selectedVariant);
  const source = sourceText(selectedVariant?.source ?? component.source);
  const tokenCount = new Set(
    component.elements.flatMap((element) =>
      (element.controls ?? []).map((control) => control.token).filter(Boolean),
    ),
  ).size;
  const scope = bridgeState?.context?.scope ?? 'instance';
  const scopes = [
    ['instance', component.elements.length > 0, 'Changes this rendered instance'],
    [
      'variant',
      Boolean(component.elements.length && selectedVariant?.source),
      selectedVariant?.source
        ? 'Changes the mapped variant definition'
        : 'Choose a source-mapped variant',
    ],
    [
      'component',
      Boolean(component.elements.length && component.source),
      component.source
        ? `Updates ${component.instances || component.elements.length} component instances`
        : 'Component source mapping unavailable',
    ],
  ];
  const activeScope = scopes.find((item) => item[0] === scope && item[1]) ?? scopes[0];
  const authoring = axes.length
    ? `<section class="workshop-card workshop-authoring"><header><strong>Create source variant</strong><span>Reviewed source operation</span></header><div class="workshop-authoring-form"><label>Variant property<select data-workshop-axis>${axes.map((axis) => `<option value="${escapeAttribute(axis.id)}">${escapeText(axis.label)} · ${escapeText(axis.adapter)}</option>`).join('')}</select></label><label>Variant name<input data-workshop-variant-label placeholder="Danger" /></label><label>Source value<input data-workshop-variant-value placeholder="danger" /></label><label>Start from<select data-workshop-base><option value="">Current preview</option>${variants.map((variant) => `<option value="${escapeAttribute(variant.id)}">${escapeText(variant.name)}</option>`).join('')}</select></label><button class="primary-button" data-workshop-create-variant ${component.elements.length && axes.some((axis) => axis.canCreate) ? '' : 'disabled'}>Stage source variant</button></div><span class="workshop-help">Foundry records the exact authoring location. The coding agent creates the option only after Review.</span></section>`
    : '<section class="workshop-card workshop-authoring"><header><strong>Create source variant</strong><span>Read-only</span></header><span class="workshop-help">No writable Storybook, CVA, or TypeScript variant axis was found.</span></section>';
  const driftCard = `<section class="workshop-card workshop-drift" data-drift-count="${drift.length}"><header><strong>Cross-instance drift</strong><span>${selectedVariant ? `${drift.length} ${drift.length === 1 ? 'difference' : 'differences'}` : 'Choose a variant'}</span></header>${
    drift.length
      ? `<div class="workshop-drift-list">${drift
          .slice(0, 6)
          .map(
            (item) =>
              `<div><span>${escapeText(item.instance.label)}</span><code>${escapeText(item.property)} ${escapeText(item.actual)} → ${escapeText(item.expected)}</code></div>`,
          )
          .join(
            '',
          )}</div><button class="secondary-button" data-workshop-repair-drift>Repair ${drift.length} ${drift.length === 1 ? 'value' : 'values'}</button>`
      : `<span class="workshop-help">${selectedVariant ? 'Every explicitly instrumented instance matches this variant.' : 'Select a source variant to compare its rendered instances.'}</span>`
  }</section>`;
  detail.innerHTML = `<div class="workshop-detail-head"><div><span class="eyebrow">Component canvas</span><h2>${escapeText(component.name)}</h2><p>${escapeText(selectedVariant?.name ?? (component.elements.length ? 'Live instance' : 'Source definition'))}</p></div><span class="workshop-source-state">${component.source ? 'Source linked' : 'Read only'}</span></div><div class="workshop-grid"><section class="workshop-card workshop-scope-section"><header><strong>Change scope</strong><span>${escapeText(activeScope[2])}</span></header><div class="workshop-scope">${scopes
    .map(
      ([id, enabled, reason]) =>
        `<button data-workshop-scope="${id}" class="${scope === id ? 'is-active' : ''}" title="${escapeAttribute(reason)}" ${enabled ? '' : 'disabled'}>${id[0].toUpperCase()}${id.slice(1)}</button>`,
    )
    .join(
      '',
    )}</div><span class="workshop-help">Broader scopes remain unavailable until Foundry has an exact source target.</span></section><section class="workshop-card workshop-instances-section"><header><strong>Instances</strong><span>${component.elements.length ? 'Choose the live target' : 'Not on this canvas'}</span></header><div class="workshop-instances">${
    component.elements.length
      ? component.elements
          .map(
            (element, index) =>
              `<button class="workshop-instance-row ${element.selected ? 'is-active' : ''}" data-workshop-instance="${index}"><span>${escapeText(element.label)}</span><code>${element.width ?? '—'} × ${element.height ?? '—'}</code></button>`,
          )
          .join('')
      : '<span class="workshop-help">The definition is read-only until a live instance is available.</span>'
  }</div></section><section class="workshop-card workshop-variants-section"><header><strong>Variants</strong><span>${selectedVariant ? escapeText(selectedVariant.name) : 'Choose one to preview'}</span></header><div class="workshop-variants">${
    variants.length
      ? variants
          .map(
            (variant) =>
              `<button class="workshop-variant-row ${variant.id === workshopVariantId ? 'is-active' : ''}" data-workshop-variant="${escapeAttribute(variant.id)}" ${component.elements.length && Object.keys(variant.props).length ? '' : 'disabled'}><span>${escapeText(variant.name)}</span><code>${escapeText(
                Object.entries(variant.props)
                  .map(([key, value]) => `${key}=${value}`)
                  .join(' · ') || 'No preview mapping',
              )}</code></button>`,
          )
          .join('')
      : '<span class="workshop-help">No Storybook or project variants were discovered.</span>'
  }</div></section>${authoring}${driftCard}<section class="workshop-card workshop-states"><header><strong>Visual states</strong><span>Preview only</span></header><div class="workshop-state-grid">${workshopStates()
    .map(
      ([id, label, confidence]) =>
        `<button data-workshop-state="${escapeAttribute(id)}" data-confidence="${confidence}" class="${workshopStateId === id ? 'is-active' : ''}" ${component.elements.length ? '' : 'disabled'}><i class="workshop-state-dot"></i>${escapeText(label)}</button>`,
    )
    .join(
      '',
    )}</div><span class="workshop-help">Green states use native browser behavior. Product-specific states expose semantic attributes without creating a design change.</span></section><section class="workshop-card workshop-responsive is-wide"><header><strong>Responsive verification</strong><span>${projectDesign().breakpoints.length} viewports · ${Math.max(1, projectDesign().themes.length)} themes</span></header><div class="workshop-responsive-grid">${projectDesign()
    .breakpoints.map(
      (viewport) =>
        `<article class="condition-card"><strong>${escapeText(viewport.label)}</strong><span>${viewport.width} × ${viewport.height ?? 900} · Open the state matrix to verify</span></article>`,
    )
    .join('')}</div></section></div>`;
  contract.innerHTML = `<header><strong>Source contract</strong><p>The component API, variants, tokens, and implementation stay visible.</p></header><div class="workshop-contract-summary"><strong>${variants.length} variants</strong><span>${component.source ? 'mapped to source' : 'indexed definition'}</span></div><dl><div><dt>Component</dt><dd>${escapeText(component.name)}</dd></div><div><dt>Source</dt><dd title="${escapeAttribute(source)}">${escapeText(source.split('/').at(-1) || source)}</dd></div><div><dt>Instances</dt><dd>${component.elements.length}</dd></div><div><dt>Tokens</dt><dd class="is-accent">${tokenCount || '—'}</dd></div><div><dt>Drift</dt><dd>${drift.length || 'None'}</dd></div></dl><div class="workshop-contract-note"><strong>${component.source ? 'Safe to extend' : 'Source mapping required'}</strong><span>${component.source ? 'Create another state or density only when the source contract supports it. Visual-only variants stay out of the library.' : 'This definition remains read-only until Foundry can resolve its authoring location.'}</span></div>`;
  upgradeSelects(detail);
  $$('[data-workshop-scope]', detail).forEach((button) =>
    button.addEventListener('click', () => {
      sendCommand('set-context', {
        key: 'scope',
        value: button.dataset.workshopScope,
      });
      bridgeState.context.scope = button.dataset.workshopScope;
      renderComponentWorkshop();
    }),
  );
  $$('[data-workshop-instance]', detail).forEach((button) =>
    button.addEventListener('click', () =>
      sendCommand('select-component-instance', {
        componentId: component.key,
        index: Number(button.dataset.workshopInstance),
      }),
    ),
  );
  $$('[data-workshop-variant]', detail).forEach((button) =>
    button.addEventListener('click', () => {
      workshopVariantId = button.dataset.workshopVariant;
      sendCommand('preview-component-variant', {
        componentId: component.key,
        variantId: workshopVariantId,
      });
      renderComponentWorkshop();
    }),
  );
  $$('[data-workshop-state]', detail).forEach((button) =>
    button.addEventListener('click', () => {
      workshopStateId = button.dataset.workshopState;
      sendCommand('preview-component-state', { stateId: workshopStateId });
      renderComponentWorkshop();
    }),
  );
  $('[data-workshop-create-variant]', detail)?.addEventListener('click', () => {
    sendCommand('stage-component-variant', {
      componentId: component.key,
      axisId: $('[data-workshop-axis]', detail).value,
      label: $('[data-workshop-variant-label]', detail).value,
      value: $('[data-workshop-variant-value]', detail).value,
      baseVariantId: $('[data-workshop-base]', detail).value,
    });
  });
  $('[data-workshop-repair-drift]', detail)?.addEventListener('click', () => {
    if (!selectedVariant) return;
    sendCommand('repair-component-variant-drift', {
      componentId: component.key,
      variantId: selectedVariant.id,
    });
  });
  $('#component-workshop-readiness').textContent = component.elements.length
    ? `${component.name} is ready · ${activeScope[2]}`
    : `${component.name} is indexed but not rendered on this canvas.`;
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
    ? {
        key: 'current',
        width: fallback.width,
        height: fallback.height ?? 900,
        label: 'Current',
      }
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
  const suffix = unit ?? '';
  if (!suffix) return rendered;
  if (typeof value === 'number' || /^-?(?:\d+\.?\d*|\.\d+)$/.test(rendered.trim())) {
    return `${rendered}${suffix}`;
  }
  return rendered;
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
    ].map((name) => ({
      name,
      instances: layers.filter((item) => item.label === name).length,
    }));
    const components = (projectComponents.length ? projectComponents : fallback).filter(
      (component) => component.name.toLowerCase().includes(query),
    );
    root.innerHTML = components.length
      ? `<div class="component-list">${components
          .map(
            (component) =>
              `<button class="component-card" data-component-name="${escapeAttribute(component.name)}"><span class="component-icon"><i data-icon="component"></i></span><span class="component-copy"><strong>${escapeText(component.name)}</strong><span>${escapeText(sourceText(component.source))}</span></span><span class="component-count">${component.instances ?? 0}</span></button>`,
          )
          .join('')}</div>`
      : '<div class="empty-inspector">No components match this search.</div>';
    renderIcons(root);
    $$('[data-component-name]', root).forEach((button) =>
      button.addEventListener('click', () => {
        const name = button.dataset.componentName;
        const definition = projectComponents.find((item) => item.name === name);
        const match = layers.find(
          (item) =>
            item.component === definition?.id || item.component === name || item.label === name,
        );
        workshopComponentId = definition?.id ?? match?.component ?? name;
        workshopVariantId = '';
        workshopStateId = 'current';
        if (match) sendCommand('select', { selector: match.selector });
        setMode('components', true, button);
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
            `<button class="layer-row ${layer.selected ? 'is-selected' : ''}" style="--depth:${Math.min(layer.depth, 10)}" data-layer-selector="${escapeAttribute(layer.selector)}" role="treeitem" aria-level="${layer.depth + 1}" aria-selected="${layer.selected}"><span class="chevron">${layer.hasChildren ? '<i data-icon="chevronDown"></i>' : ''}</span><span class="layer-icon"><i data-icon="${layer.kind === 'component' ? 'component' : 'box'}"></i></span><span class="layer-label">${escapeText(layer.label)}</span><span class="layer-meta">${escapeText(layer.instrumented ? 'Mapped' : layer.kind)}</span></button>`,
        )
        .join('')
    : '<div class="empty-inspector">Select inside the live preview to populate the product structure.</div>';
  renderIcons(root);
  $$('[data-layer-selector]', root).forEach((button) =>
    button.addEventListener('click', (event) =>
      sendCommand('select', {
        selector: button.dataset.layerSelector,
        additive: event.shiftKey,
      }),
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

function motionEditorMarkup(motions, selection) {
  return `<div class="motion-editor">${motions
    .map((motion) => {
      const timing = motion.timing ?? {};
      const duration = Number(timing.duration) || 1000;
      const currentTime = Math.min(duration, Number(motion.currentTime) || 0);
      const source =
        motion.kind === 'css-animation'
          ? 'CSS animation'
          : motion.kind === 'css-transition'
            ? 'CSS transition'
            : 'Web animation';
      const properties = motion.properties?.length
        ? motion.properties.join(', ')
        : 'Properties appear while the transition is running';
      const disabled = motion.active ? '' : 'disabled';
      const changed = (property) =>
        changedControls.has(`${selection.id}:motion.${motion.id}.${property}`) ? ' is-changed' : '';
      const keyframes = Array.isArray(motion.keyframes) ? motion.keyframes : [];
      const keyframeProperties = [
        ...new Set(keyframes.flatMap((frame) => Object.keys(frame.values ?? {}))),
      ];
      const selectedKey = selectedMotionKeyframes.get(motion.id);
      const selectedProperty = keyframeProperties.includes(selectedKey?.property)
        ? selectedKey.property
        : keyframeProperties[0];
      const selectedFrame =
        keyframes.find(
          (frame) => frame.index === selectedKey?.index && frame.values?.[selectedProperty] != null,
        ) ?? keyframes.find((frame) => frame.values?.[selectedProperty] != null);
      if (selectedFrame && selectedProperty)
        selectedMotionKeyframes.set(motion.id, {
          index: selectedFrame.index,
          property: selectedProperty,
        });
      const tracks = keyframeProperties
        .map(
          (property) =>
            `<div class="motion-track"><code>${escapeText(property)}</code><div class="motion-track-rail">${keyframes
              .filter((frame) => frame.values?.[property] != null)
              .map(
                (frame) =>
                  `<button type="button" class="motion-keyframe${selectedFrame?.index === frame.index && selectedProperty === property ? ' is-selected' : ''}" data-motion-keyframe-index="${frame.index}" data-motion-keyframe-property="${escapeText(property)}" style="--keyframe-offset:${Math.round(Number(frame.offset) * 10000) / 100}%" aria-label="Edit ${escapeText(property)} keyframe at ${Math.round(Number(frame.offset) * 100)} percent"></button>`,
              )
              .join('')}</div></div>`,
        )
        .join('');
      const selectedValue = selectedFrame?.values?.[selectedProperty] ?? '';
      const selectedPath = selectedFrame
        ? `motion.${motion.id}.keyframe.${selectedFrame.index}`
        : '';
      const keyframeEditor =
        motion.active && keyframes.length > 1 && selectedFrame && selectedProperty
          ? `<div class="motion-keyframe-shell"><button type="button" class="motion-keyframe-toggle" data-motion-keyframes-toggle aria-expanded="${expandedMotionTracks.has(motion.id)}"><span>Keyframes</span><code>${keyframes.length} frames · ${keyframeProperties.length} tracks</code><i data-icon="chevronDown"></i></button><div class="motion-keyframe-editor" ${expandedMotionTracks.has(motion.id) ? '' : 'hidden'}><div class="motion-tracks">${tracks}</div><div class="motion-keyframe-detail"><span class="motion-keyframe-heading">Frame ${selectedFrame.index + 1} · ${escapeText(selectedProperty)}</span><div class="motion-keyframe-fields"><label class="${changedControls.has(`${selection.id}:${selectedPath}.offset`) ? 'is-changed' : ''}"><span>Position</span><span class="motion-field-with-unit"><input data-motion-keyframe-action="offset" data-motion-keyframe-index="${selectedFrame.index}" data-motion-keyframe-property="${escapeText(selectedProperty)}" type="number" min="0" max="100" step="1" value="${Math.round(Number(selectedFrame.offset) * 100)}"><i>%</i></span></label><label class="motion-keyframe-value${changedControls.has(`${selection.id}:${selectedPath}.${selectedProperty}`) ? ' is-changed' : ''}"><span>Value</span><input data-motion-keyframe-action="value" data-motion-keyframe-index="${selectedFrame.index}" data-motion-keyframe-property="${escapeText(selectedProperty)}" type="text" value="${escapeText(selectedValue)}"></label><label class="motion-keyframe-easing${changedControls.has(`${selection.id}:${selectedPath}.easing`) ? ' is-changed' : ''}"><span>Segment easing</span><input data-motion-keyframe-action="easing" data-motion-keyframe-index="${selectedFrame.index}" data-motion-keyframe-property="${escapeText(selectedProperty)}" type="text" value="${escapeText(selectedFrame.easing ?? 'linear')}"></label></div></div></div></div>`
          : motion.active
            ? '<p class="motion-help">This animation does not expose an editable multi-keyframe track.</p>'
            : '';
      const speeds = [
        [0.1, '10%'],
        [0.25, '25%'],
        [0.5, '50%'],
        [1, '100%'],
        [2, '200%'],
      ]
        .map(
          ([rate, label]) =>
            `<option value="${rate}" ${Math.abs(Number(motion.playbackRate ?? 1) - rate) < 0.001 ? 'selected' : ''}>${label}</option>`,
        )
        .join('');
      return `<article class="motion-card" data-motion-id="${escapeText(motion.id)}"><header class="motion-card-head"><span><strong>${escapeText(motion.label)}</strong><code>${escapeText(source)} · ${Math.round(Number(timing.duration) || 0)} ms</code></span><span class="motion-cost" data-tier="${escapeText(motion.performance?.tier ?? 'unknown')}" title="${escapeText(motion.performance?.detail ?? '')}">${escapeText(motion.performance?.label ?? 'Unresolved')}</span></header><p class="motion-properties" title="${escapeText(properties)}">${escapeText(properties)}</p><input class="motion-timeline" data-motion-action="scrub" type="range" min="0" max="${duration}" step="1" value="${currentTime}" aria-label="Scrub ${escapeText(motion.label)}" ${disabled}><div class="motion-transport"><button type="button" data-motion-action="toggle" ${disabled}>${motion.playState === 'paused' ? 'Play' : 'Pause'}</button><button type="button" data-motion-action="replay" ${disabled}>Replay</button><button type="button" data-motion-action="loop" ${disabled}>${motion.looping ? 'Looping' : 'Loop'}</button><select data-motion-action="speed" aria-label="Preview speed" ${disabled}>${speeds}</select></div><div class="motion-fields"><label class="${changed('duration')}"><span>Duration</span><input data-motion-action="duration" type="number" min="0" step="10" value="${Math.round(Number(timing.duration) || 0)}" ${disabled}></label><label class="${changed('delay')}"><span>Delay</span><input data-motion-action="delay" type="number" step="10" value="${Math.round(Number(timing.delay) || 0)}" ${disabled}></label><label class="motion-easing${changed('easing')}"><span>Easing</span><input data-motion-action="easing" type="text" value="${escapeText(timing.easing ?? 'linear')}" ${disabled}></label></div>${keyframeEditor}${motion.active ? '' : '<p class="motion-help">Trigger this transition in Interact mode to scrub and tune its live timing.</p>'}</article>`;
    })
    .join('')}</div>`;
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
    $('#decision-guidance').hidden = true;
    return;
  }
  summary.innerHTML = `<span class="selection-kind">${escapeText(selection.kind)}</span><strong>${escapeText(selection.label)}</strong><code>${escapeText(sourceText(selection.source))}</code><p>${selection.width} × ${selection.height} px · ${escapeText(selection.confidence)}${selection.count > 1 ? ` · ${selection.count} selected` : ''}</p>`;
  renderDecisionGuidance();
  const groups = new Map();
  for (const control of bridgeState.controls ?? []) {
    const group = controlGroup(control);
    groups.set(group, [...(groups.get(group) ?? []), control]);
  }
  if (bridgeState.motions?.length) groups.set('Motion', bridgeState.motions);
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
          : name === 'Motion'
            ? motionEditorMarkup(controls, selection)
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
  $$('[data-motion-keyframes-toggle]', root).forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('.motion-card');
      const id = card?.dataset.motionId;
      const editor = card?.querySelector('.motion-keyframe-editor');
      if (!id || !editor) return;
      if (expandedMotionTracks.has(id)) expandedMotionTracks.delete(id);
      else expandedMotionTracks.add(id);
      editor.hidden = !expandedMotionTracks.has(id);
      button.setAttribute('aria-expanded', String(expandedMotionTracks.has(id)));
    });
  });
  $$('[data-motion-keyframe-index]', root).forEach((marker) => {
    if (!marker.classList.contains('motion-keyframe')) return;
    marker.addEventListener('click', () => {
      const card = marker.closest('.motion-card');
      const id = card?.dataset.motionId;
      if (!id) return;
      selectedMotionKeyframes.set(id, {
        index: Number(marker.dataset.motionKeyframeIndex),
        property: marker.dataset.motionKeyframeProperty,
      });
      const scroller = $('.inspector-scroll');
      const scrollTop = scroller?.scrollTop ?? 0;
      renderInspector();
      if (scroller) scroller.scrollTop = scrollTop;
    });
  });
  $$('[data-motion-keyframe-action]', root).forEach((field) => {
    const card = field.closest('.motion-card');
    const id = card?.dataset.motionId;
    const index = Number(field.dataset.motionKeyframeIndex);
    const frameProperty = field.dataset.motionKeyframeProperty;
    const action = field.dataset.motionKeyframeAction;
    if (!id || !frameProperty || !action || !Number.isInteger(index)) return;
    let lastValue = String(field.value);
    const commit = () => {
      if (String(field.value) === lastValue) return;
      lastValue = String(field.value);
      const property = action === 'value' ? frameProperty : action;
      changedControls.add(`${selection.id}:motion.${id}.keyframe.${index}.${property}`);
      field.closest('label')?.classList.add('is-changed');
      sendCommand('motion-action', {
        id,
        action: `keyframe-${action}`,
        index,
        property: frameProperty,
        value: action === 'offset' ? Number(field.value) : field.value,
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
  $$('.motion-card', root).forEach((card) => {
    const id = card.dataset.motionId;
    if (!id) return;
    $$('[data-motion-action]', card).forEach((control) => {
      const action = control.dataset.motionAction;
      if (!action) return;
      if (action === 'scrub') {
        control.addEventListener('input', () =>
          sendCommand('motion-action', {
            id,
            action,
            value: Number(control.value),
          }),
        );
        return;
      }
      if (action === 'speed') {
        control.addEventListener('change', () =>
          sendCommand('motion-action', {
            id,
            action,
            value: Number(control.value),
          }),
        );
        return;
      }
      if (action === 'duration' || action === 'delay' || action === 'easing') {
        let lastValue = String(control.value);
        const commit = () => {
          if (String(control.value) === lastValue) return;
          lastValue = String(control.value);
          changedControls.add(`${selection.id}:motion.${id}.${action}`);
          control.closest('label')?.classList.add('is-changed');
          sendCommand('motion-action', {
            id,
            action,
            value: action === 'easing' ? control.value : Number(control.value),
          });
        };
        control.addEventListener('change', commit);
        control.addEventListener('blur', commit);
        control.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          commit();
          control.blur();
        });
        return;
      }
      control.addEventListener('click', () => sendCommand('motion-action', { id, action }));
    });
  });
}

function renderDecisionGuidance() {
  const root = $('#decision-guidance');
  const relevant = bridgeState?.decisionMemory?.relevant ?? [];
  if (!relevant.length) {
    root.hidden = true;
    root.innerHTML = '';
    return;
  }
  const conflicts = relevant.filter((item) => item.conflicts?.length);
  const lead = conflicts[0] ?? relevant[0];
  root.hidden = false;
  root.dataset.status = conflicts.length ? 'conflict' : 'guidance';
  root.innerHTML = `<button type="button" data-open-decision-memory><i data-icon="${conflicts.length ? 'activity' : 'bookmark'}"></i><span><strong>${conflicts.length ? 'Check remembered guidance' : 'Relevant project decision'}</strong><small>${escapeText(lead.decision.title)} · ${lead.score}% match</small></span><i data-icon="chevronRight"></i></button>`;
  renderIcons(root);
  $('[data-open-decision-memory]', root).addEventListener('click', () => {
    decisionMemoryId = lead.decision.id;
    setMode('memory');
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
  const unresolvedCount = changes.filter((change) => !validChange(change)).length;
  const affectedFiles = new Set(
    changes
      .map(
        (change) =>
          change.source?.file ??
          change.source?.path ??
          change.target?.source?.file ??
          change.target?.source?.path,
      )
      .filter(Boolean),
  ).size;
  const reviewTarget = changes[0]?.target?.label ?? 'Current selection';
  $('#review-context').textContent =
    `${reviewTarget} · ${bridgeState?.context?.breakpoint ?? 'current'} viewport`;
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
                const deletable = change.status !== 'applied';
                return `<div class="change-row"><div class="change-line"><label class="change-include"><input type="checkbox" data-change-id="${escapeText(change.id)}" ${validChange(change) ? 'checked' : ''} ${unresolved ? 'disabled' : ''} aria-label="Include ${escapeText(change.property)}"><span class="change-property"><strong>${escapeText(change.property)}</strong></span></label><div class="change-values"><span class="before-value">${escapeText(formatValue(change.before, change.unit))}</span><span class="change-arrow">→</span><input class="after-value" data-after-id="${escapeText(change.id)}" value="${escapeText(formatValue(change.after, change.unit))}" aria-label="New ${escapeText(change.property)} value"><span class="status-chip ${unresolved ? 'unresolved' : ''}">${escapeText(unresolved ? 'Mapping needed' : change.confidence)}</span></div><div class="change-actions"><button class="secondary-button compact" data-preview-change="${escapeText(change.id)}">Preview before</button><button class="danger-button compact delete-change" data-delete-change="${escapeText(change.id)}" aria-label="Delete ${escapeText(change.property)} change and restore its original value" ${deletable ? '' : 'disabled'}>Delete and restore</button></div></div><span class="change-source">${escapeText(change.property)} · ${escapeText(change.scope)} · ${escapeText(change.context.breakpoint)} · ${escapeText(change.context.theme)}</span></div>`;
              })
              .join('')}</section>`,
        )
        .join('')
    : '<div class="empty-mode"><i data-icon="file"></i><strong>No changes recorded</strong><p>Return to Canvas and adjust a measured property.</p></div>';
  $('#review-summary-content').innerHTML =
    `<div class="review-summary-metrics"><div><span>Included</span><strong>${included} of ${changes.length}</strong></div><div><span>Source mapping</span><strong class="is-accent">${unresolvedCount ? 'Review' : 'Exact'}</strong></div><div><span>Affected files</span><strong>${affectedFiles || (changes.length ? 1 : 0)}</strong></div><div><span>Risk</span><strong>${unresolvedCount ? 'Needs review' : 'Local styles'}</strong></div></div><div class="review-agent-state" data-connected="${bridgeConnected}"><strong>${bridgeConnected ? 'Agent ready' : 'Agent not connected'}</strong><span>${bridgeConnected ? 'The live listener is connected and ready to claim this reviewed batch.' : 'Start an agent listener before applying this reviewed batch.'}</span></div>`;
  renderIcons($('#changes'));
  $$('[data-change-id]').forEach((input) =>
    input.addEventListener('change', () =>
      setStatus(input.dataset.changeId, input.checked ? 'approved' : 'rejected'),
    ),
  );
  $$('[data-delete-change]').forEach((button) =>
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const payload = await requestCommand('delete-change', {
          changeId: button.dataset.deleteChange,
        });
        renderSession(payload);
        toast('Change deleted and original value restored');
      } catch (error) {
        toast(error.message);
        button.disabled = false;
      }
    }),
  );
  $$('[data-preview-change]').forEach((button) => {
    const showBefore = () => toggleComparison('before');
    const showAfter = () => toggleComparison('after');
    button.addEventListener('pointerdown', showBefore);
    button.addEventListener('pointerup', showAfter);
    button.addEventListener('pointercancel', showAfter);
    button.addEventListener('mouseleave', showAfter);
    button.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') showBefore();
    });
    button.addEventListener('keyup', showAfter);
  });
}

const RUN_ORDER = ['queued', 'claimed', 'applying', 'rebuilding', 'verifying', 'passed'];
const RUN_LABELS = {
  queued: 'Queued for agent',
  claimed: 'Handoff received',
  applying: 'Applying source edits',
  rebuilding: 'Rebuilding project',
  verifying: 'Verifying rendered values',
  passed: 'Applied and verified',
  needs_attention: 'Needs attention',
  failed: 'Apply failed',
};

function runValue(value) {
  if (value == null) return 'Not reported';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function runStageIndex(run) {
  if (run.state === 'passed') return RUN_ORDER.length;
  if (run.state === 'needs_attention') return RUN_ORDER.indexOf('verifying');
  const directIndex = RUN_ORDER.indexOf(run.state);
  if (directIndex >= 0) return directIndex;
  const previousState = [...(run.messages ?? [])]
    .reverse()
    .find((message) => RUN_ORDER.includes(message.state))?.state;
  return Math.max(0, RUN_ORDER.indexOf(previousState));
}

function renderApplyRun(runs = []) {
  const root = $('#apply-run');
  const run = runs.at(-1);
  if (!run || run.state === 'cancelled' || run.id === dismissedApplyRunId) {
    root.hidden = true;
    root.dataset.signature = '';
    return;
  }
  root.hidden = false;
  const attention = ['needs_attention', 'failed'].includes(run.state);
  const passed = run.state === 'passed';
  const active = ['queued', 'claimed', 'applying', 'rebuilding', 'verifying'].includes(run.state);
  const stageIndex = runStageIndex(run);
  const latestMessage =
    run.state === 'claimed'
      ? 'The agent received this batch. Foundry is keeping the handoff active while source work begins.'
      : (run.messages?.at(-1)?.message ?? run.error ?? 'The reviewed batch is ready.');
  const signature = JSON.stringify([
    run.id,
    run.state,
    run.attempts,
    latestMessage,
    run.messages,
    run.changedFiles,
    run.validationResults,
    run.verificationResults,
    cancelConfirmationRunId === run.id && Date.now() < cancelConfirmationUntil,
  ]);
  if (root.dataset.signature === signature) return;
  root.dataset.signature = signature;
  const stageRows = RUN_ORDER.map((state, index) => {
    const complete = passed || index < stageIndex;
    const current = !passed && index === stageIndex;
    const stateClass = complete
      ? 'is-complete'
      : current
        ? attention
          ? 'needs-attention'
          : 'is-active'
        : '';
    return `<div class="run-step ${stateClass}"><span class="run-step-index">${String(index + 1).padStart(2, '0')}</span><i></i><strong>${escapeText(RUN_LABELS[state])}</strong><span>${complete ? 'Complete' : current ? 'In progress' : 'Waiting'}</span></div>`;
  }).join('');
  const changedFiles = run.changedFiles?.length
    ? `<section class="apply-result-group"><header class="change-group-head"><strong>Changed files</strong><span>${run.changedFiles.length}</span></header>${run.changedFiles.map((file) => `<div class="apply-result-row"><code>${escapeText(file)}</code><span>Edited</span></div>`).join('')}</section>`
    : '';
  const validationResults = run.validationResults?.length
    ? `<section class="apply-result-group"><header class="change-group-head"><strong>Validation</strong><span>${run.validationResults.filter((result) => result.passed).length} of ${run.validationResults.length} passed</span></header>${run.validationResults.map((result) => `<div class="apply-result-row ${result.passed ? 'is-passed' : 'is-failed'}"><div><strong>${escapeText(result.name)}</strong>${result.summary ? `<span>${escapeText(result.summary)}</span>` : ''}</div><span>${result.passed ? 'Passed' : 'Failed'}</span></div>`).join('')}</section>`
    : '';
  const verificationResults = run.verificationResults?.length
    ? `<section class="apply-result-group"><header class="change-group-head"><strong>Rendered verification</strong><span>${run.verificationResults.filter((result) => result.passed).length} of ${run.verificationResults.length} matched</span></header>${run.verificationResults.map((result) => `<div class="apply-result-row ${result.passed ? 'is-passed' : 'is-failed'}"><div><strong>${escapeText(result.property)}</strong><span>${escapeText(runValue(result.requested))} → ${escapeText(runValue(result.rendered))}${result.reason ? ` · ${escapeText(result.reason)}` : ''}</span></div><span>${result.passed ? 'Matched' : 'Mismatch'}</span></div>`).join('')}</section>`
    : '';
  const completedStages = passed ? RUN_ORDER.length : stageIndex;
  const confirmingCancel =
    active && cancelConfirmationRunId === run.id && Date.now() < cancelConfirmationUntil;
  const secondaryAction = active
    ? `<button class="secondary-button" data-run-action="cancel" data-run-id="${run.id}">${confirmingCancel ? 'Confirm stop' : 'Stop apply'}</button>`
    : `<button class="secondary-button" data-run-navigation="back">Back to canvas</button>`;
  const primaryAction = attention
    ? `<button class="primary-button" data-run-action="${run.interruptedState ? 'resume' : 'retry'}" data-run-id="${run.id}">${run.interruptedState ? 'Resume with agent' : 'Retry with agent'}</button>`
    : passed
      ? `<button class="primary-button" data-run-navigation="back">Done</button>`
      : `<button class="primary-button" disabled>${escapeText(RUN_LABELS[run.state] ?? run.state)}</button>`;
  root.innerHTML = `<div class="apply-surface"><header class="mode-head apply-head"><div><h1>Apply and verify</h1><p>Follow the approved source changes through rebuild and rendered verification.</p></div><div class="mode-actions"><span class="mode-count">Attempt ${run.attempts}</span></div></header><div class="apply-workspace"><section class="apply-result-group apply-status-group"><header class="change-group-head"><strong>Apply and verify</strong><span>${completedStages} of ${RUN_ORDER.length} complete</span></header><div class="apply-status-row"><i class="${passed ? 'is-passed' : attention ? 'needs-attention' : 'is-active'}"></i><div><strong>${escapeText(RUN_LABELS[run.state] ?? run.state)}</strong><span>${escapeText(latestMessage)}</span></div></div><div class="run-steps">${stageRows}</div></section><aside class="apply-evidence"><header><div><strong>Live source activity</strong><span>Files, checks, and rendered evidence update as the agent works.</span></div><span class="status-chip ${attention ? 'unresolved' : ''}">${passed ? 'Passed' : attention ? 'Needs attention' : 'Running'}</span></header><div class="apply-progress-list">${changedFiles || '<section class="apply-result-group"><header class="change-group-head"><strong>Changed files</strong><span>Waiting</span></header><div class="apply-result-row"><div><strong>Source edits</strong><span>Files appear here when the agent begins writing.</span></div><span>Pending</span></div></section>'}${validationResults}${verificationResults}</div><footer class="review-footer apply-footer">${secondaryAction}${primaryAction}</footer></aside></div></div>`;
  $$('[data-run-navigation="back"]', root).forEach((button) =>
    button.addEventListener('click', () => {
      dismissedApplyRunId = run.id;
      root.hidden = true;
      setMode('canvas');
    }),
  );
  $$('[data-run-action]', root).forEach((button) =>
    button.addEventListener('click', async () => {
      if (button.dataset.runAction === 'cancel') {
        const now = Date.now();
        if (cancelConfirmationRunId !== run.id || now >= cancelConfirmationUntil) {
          cancelConfirmationRunId = run.id;
          cancelConfirmationUntil = now + 5_000;
          root.dataset.signature = '';
          renderApplyRun(activeSession?.applyRuns ?? []);
          toast('Press Confirm stop within 5 seconds to cancel this source run.');
          setTimeout(() => {
            if (cancelConfirmationRunId !== run.id || Date.now() < cancelConfirmationUntil) return;
            cancelConfirmationRunId = null;
            cancelConfirmationUntil = 0;
            root.dataset.signature = '';
            renderApplyRun(activeSession?.applyRuns ?? []);
          }, 5_100);
          return;
        }
        cancelConfirmationRunId = null;
        cancelConfirmationUntil = 0;
      }
      await api(
        `/v1/sessions/${sessionId}/apply-runs/${button.dataset.runId}/${button.dataset.runAction}`,
        { method: 'POST', body: '{}' },
      );
      await loadSession();
    }),
  );
}

function renderChangeSummary() {
  const direction = activeDesignDirection();
  const changes = (direction?.changes ?? []).filter((change) => change.status !== 'rejected');
  const root = $('#change-summary');
  root.hidden = changes.length === 0 || activeMode !== 'canvas';
  if (!changes.length) return;
  const latest = changes.at(-1);
  const run = activeSession?.applyRuns?.at(-1);
  const activeRun =
    run && ['queued', 'claimed', 'applying', 'rebuilding', 'verifying'].includes(run.state);
  $('#change-count').textContent =
    `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} · ${direction.name}`;
  $('#latest-change').textContent = activeRun
    ? run.state.replaceAll('_', ' ')
    : `${latest.target.label} · ${latest.property}`;
  $('#compare').disabled = changes.length === 0;
}

function renderStates() {
  const breakpoints = projectDesign().breakpoints;
  const sessionViewport = activeSession?.changeSet?.context?.viewport ?? {
    width: 1440,
    height: 900,
  };
  const viewportOptions = breakpoints.length
    ? breakpoints
    : [{ id: 'current', label: 'Current', ...sessionViewport }];
  const selectedViewportId = $('#canvas-viewport')?.value || viewportOptions[0].id;
  const selectedViewport =
    viewportOptions.find((item) => item.id === selectedViewportId) ?? viewportOptions[0];
  const themes = projectDesign().themes.length
    ? projectDesign().themes
    : [
        { id: 'light', label: 'Light' },
        { id: 'dark', label: 'Dark' },
      ];
  const selectedTheme = $('#canvas-theme')?.value || themes[0].id;
  const authoredStates = projectDesign().states ?? [];
  const states = authoredStates.length
    ? authoredStates.slice(0, 8)
    : ['Default', 'Hover', 'Focus', 'Error', 'Disabled'].map((label) => ({
        id: label.toLowerCase(),
        label,
      }));
  const selectedState = $('#canvas-state')?.value || states[0]?.id || 'current';
  const viewportWidth = Number(selectedViewport.width) || sessionViewport.width;
  const viewportHeight = Number(selectedViewport.height) || sessionViewport.height;
  const previewScale = Math.min(1, 760 / viewportWidth, 620 / viewportHeight);
  const changeCount = (activeDesignDirection()?.changes ?? []).filter(
    (change) => change.status !== 'rejected',
  ).length;
  const root = $('#state-grid');
  root.innerHTML = `<aside class="state-matrix-panel"><header><strong>Matrix setup</strong><span>Choose the conditions to compare.</span></header><label><span>Viewport</span><select id="state-matrix-viewport">${viewportOptions.map((item) => `<option value="${escapeAttribute(item.id)}" ${item.id === selectedViewport.id ? 'selected' : ''}>${item.width} × ${item.height}</option>`).join('')}</select></label><label><span>Theme</span><select id="state-matrix-theme">${themes.map((item) => `<option value="${escapeAttribute(item.id)}" ${item.id === selectedTheme ? 'selected' : ''}>${escapeText(item.label)}</option>`).join('')}</select></label><label><span>Motion</span><select id="state-matrix-motion"><option value="system">System</option><option value="reduce">Reduced</option><option value="no-preference">Full motion</option></select></label><span class="state-panel-rule"></span><div class="state-matrix-list"><code>STATES</code>${states.map((item, index) => `<button class="${item.id === selectedState || (!selectedState && index === 0) ? 'is-active' : ''}" data-state-matrix-state="${escapeAttribute(item.id)}"><i></i><span>${escapeText(item.label)}</span></button>`).join('')}</div></aside><section class="state-preview-panel"><header><div><strong>Preview</strong><code>${escapeText(states.find((item) => item.id === selectedState)?.label ?? 'Default')} · ${viewportWidth}px</code></div><span>LIVE</span></header><div class="state-preview-stage"><div class="state-preview-viewport" style="--state-preview-width:${viewportWidth}px;--state-preview-height:${viewportHeight}px;--state-preview-scale:${previewScale}">${previewUrl ? '<iframe id="state-live-preview" title="State Workbench live preview"></iframe>' : '<div class="state-preview-empty">Live preview unavailable</div>'}</div></div></section><aside class="state-verification-panel"><header><strong>Verification</strong><span>One clear result for every condition.</span></header><div class="state-verification-summary"><code id="state-verification-count">${bridgeConnected ? states.length : 0} / ${states.length}</code><span id="state-verification-copy">${bridgeConnected ? 'states connected to the live product' : 'waiting for the live product'}</span></div><dl><div><dt>Viewport</dt><dd>${viewportWidth} × ${viewportHeight}</dd></div><div><dt>Theme</dt><dd>${escapeText(themes.find((item) => item.id === selectedTheme)?.label ?? selectedTheme)}</dd></div><div><dt>Motion</dt><dd>System</dd></div><div><dt>Changes</dt><dd>${changeCount}</dd></div><div><dt>Connection</dt><dd id="state-verification-connection" class="${bridgeConnected ? 'is-passed' : ''}">${bridgeConnected ? 'Live' : 'Waiting'}</dd></div></dl><div class="state-ready-note"><strong id="state-verification-title">${bridgeConnected ? 'Ready to review' : 'Connect the product'}</strong><span id="state-verification-note">${bridgeConnected ? 'Every state preserves its requested viewport and native page behavior.' : 'State verification begins when the live adapter reconnects.'}</span></div></aside>`;
  renderIcons(root);
  upgradeSelects(root);
  const statePreview = $('#state-live-preview');
  if (statePreview && previewUrl) {
    const url = new URL(previewUrl);
    url.searchParams.set('__foundry_embedded', '1');
    url.searchParams.set('__foundry_state_workbench', '1');
    statePreview.src = url.href;
  }
  $('#state-matrix-viewport')?.addEventListener('change', (event) => {
    $('#canvas-viewport').value = event.currentTarget.value;
    syncCustomSelect($('#canvas-viewport'));
    sendCommand('set-context', { key: 'breakpoint', value: event.currentTarget.value });
    renderStates();
  });
  $('#state-matrix-theme')?.addEventListener('change', (event) => {
    $('#canvas-theme').value = event.currentTarget.value;
    syncCustomSelect($('#canvas-theme'));
    sendCommand('set-context', { key: 'theme', value: event.currentTarget.value });
    renderStates();
  });
  $$('[data-state-matrix-state]', root).forEach((button) =>
    button.addEventListener('click', () => {
      $('#canvas-state').value = button.dataset.stateMatrixState;
      syncCustomSelect($('#canvas-state'));
      sendCommand('set-context', { key: 'state', value: button.dataset.stateMatrixState });
      renderStates();
    }),
  );
}

function syncStateWorkbenchConnection() {
  if (activeMode !== 'states') return;
  const total = $$('[data-state-matrix-state]').length;
  const count = $('#state-verification-count');
  const copy = $('#state-verification-copy');
  const connection = $('#state-verification-connection');
  const title = $('#state-verification-title');
  const note = $('#state-verification-note');
  if (count) count.textContent = `${bridgeConnected ? total : 0} / ${total}`;
  if (copy) {
    copy.textContent = bridgeConnected
      ? 'states connected to the live product'
      : 'waiting for the live product';
  }
  if (connection) {
    connection.textContent = bridgeConnected ? 'Live' : 'Waiting';
    connection.classList.toggle('is-passed', bridgeConnected);
  }
  if (title) title.textContent = bridgeConnected ? 'Ready to review' : 'Connect the product';
  if (note) {
    note.textContent = bridgeConnected
      ? 'Every state preserves its requested viewport and native page behavior.'
      : 'State verification begins when the live adapter reconnects.';
  }
}

function responsiveViewportContexts() {
  const sessionViewport = activeSession?.changeSet?.context?.viewport ?? {
    width: 1440,
    height: 900,
  };
  const configured = projectDesign()
    .breakpoints.filter((item) => Number.isFinite(item.width) && item.width > 0)
    .map((item) => ({
      id: item.id,
      label: item.label,
      width: item.width,
      height: item.height ?? sessionViewport.height,
    }));
  const contexts = [...configured];
  if (!contexts.some((item) => item.id === 'current')) {
    contexts.push({ id: 'current', label: 'Current', ...sessionViewport });
  }
  const customHeight = Math.max(
    480,
    Math.round((responsiveCustomWidth * sessionViewport.height) / sessionViewport.width),
  );
  contexts.push({
    id: 'custom',
    label: 'Custom',
    width: responsiveCustomWidth,
    height: customHeight,
  });
  return contexts.sort((a, b) => a.width - b.width);
}

function responsiveFrameCommand(frame, command, payload = {}) {
  if (!frame?.contentWindow) return;
  frame.contentWindow.postMessage(
    { type: 'foundry:workspace-command', sessionId, command, payload },
    previewOrigin,
  );
}

function syncResponsiveFrame(frame) {
  const selector = bridgeState?.selection?.selector;
  if (selector) responsiveFrameCommand(frame, 'select', { selector });
  responsiveFrameCommand(frame, 'preview-responsive-stress', {
    mode: responsiveStressMode,
  });
  responsiveFrameCommand(frame, 'preview-responsive-container', {
    width:
      responsiveScrubTarget === 'container' && frame.dataset.responsiveFrame === 'custom'
        ? responsiveContainerWidth
        : null,
  });
}

function responsiveComparisonSnapshot(snapshot) {
  if (!snapshot) return null;
  const selection = snapshot.selection ?? {};
  return {
    target: responsiveScrubTarget,
    viewportWidth: Number(snapshot.viewportWidth ?? 0),
    containerWidth: Number(snapshot.container?.width ?? 0),
    containerName: snapshot.container?.name ?? 'Anonymous container',
    elementWidth: Number(selection.width ?? selection.clientWidth ?? 0),
    elementHeight: Number(selection.height ?? selection.clientHeight ?? 0),
    lineCount: Number(selection.lineCount ?? 0),
    overflow: Math.max(0, Number(selection.scrollWidth ?? 0) - Number(selection.clientWidth ?? 0)),
  };
}

function responsiveDelta(before, after) {
  if (!before || !after) return null;
  return {
    viewport: after.viewportWidth - before.viewportWidth,
    container: after.containerWidth - before.containerWidth,
    width: after.elementWidth - before.elementWidth,
    height: after.elementHeight - before.elementHeight,
    lines: after.lineCount - before.lineCount,
    overflow: after.overflow - before.overflow,
  };
}

function signedResponsiveValue(value, suffix = 'px') {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${Math.round(value * 100) / 100}${suffix}`;
}

function renderResponsiveComparison() {
  const root = $('#responsive-comparison-grid');
  if (!root) return;
  const card = (label, snapshot) =>
    `<article class="responsive-comparison-card ${snapshot ? 'is-captured' : ''}"><span>${label}</span>${
      snapshot
        ? `<strong>${snapshot.target === 'container' ? `${Math.round(snapshot.containerWidth)}px container` : `${Math.round(snapshot.viewportWidth)}px viewport`}</strong><code>${Math.round(snapshot.elementWidth)} × ${Math.round(snapshot.elementHeight)} · ${snapshot.lineCount || '—'} lines · ${Math.round(snapshot.overflow)}px overflow</code>`
        : '<strong>Not captured</strong><code>Scrub to a useful state, then capture it.</code>'
    }</article>`;
  const delta = responsiveDelta(responsiveComparisonBefore, responsiveComparisonAfter);
  root.innerHTML = `${card('BEFORE', responsiveComparisonBefore)}${card('AFTER', responsiveComparisonAfter)}<article class="responsive-comparison-card responsive-comparison-delta ${delta ? 'is-captured' : ''}"><span>CHANGE</span>${
    delta
      ? `<strong>${signedResponsiveValue(responsiveComparisonBefore.target === 'container' ? delta.container : delta.viewport)} ${responsiveComparisonBefore.target}</strong><code>Element ${signedResponsiveValue(delta.width)} wide · ${signedResponsiveValue(delta.height)} high · ${signedResponsiveValue(delta.lines, ' lines')} · ${signedResponsiveValue(delta.overflow)} overflow</code>`
      : '<strong>Waiting for both states</strong><code>Comparison remains presentation-only.</code>'
  }</article>`;
}

function captureResponsiveComparison(position) {
  const snapshot =
    responsiveSnapshots.get('custom') ?? responsiveSnapshots.get(responsiveActiveViewport);
  const captured = responsiveComparisonSnapshot(snapshot);
  if (!captured) {
    toast('Wait for the live responsive preview before capturing.');
    return;
  }
  if (position === 'before') responsiveComparisonBefore = captured;
  else responsiveComparisonAfter = captured;
  renderResponsiveComparison();
  toast(`${position === 'before' ? 'Before' : 'After'} state captured`);
}

function responsiveFindingSummary(snapshot) {
  if (!snapshot) return ['Live preview'];
  const issues = [];
  if (snapshot.documentScrollWidth > snapshot.viewportWidth + 1)
    issues.push(`${Math.round(snapshot.documentScrollWidth - snapshot.viewportWidth)}px overflow`);
  if (snapshot.selection?.scrollWidth > snapshot.selection?.clientWidth + 1)
    issues.push('Selection clips horizontally');
  if (snapshot.selection?.scrollHeight > snapshot.selection?.clientHeight + 1)
    issues.push('Selection clips vertically');
  return issues.length ? issues : ['No overflow detected'];
}

function updateResponsiveCard(viewportId) {
  const card = $(`[data-responsive-card="${CSS.escape(viewportId)}"]`);
  const snapshot = responsiveSnapshots.get(viewportId);
  if (!card || !snapshot) return;
  const findings = responsiveFindingSummary(snapshot);
  const footer = $('footer', card);
  footer.className = findings[0] === 'No overflow detected' ? 'is-clear' : 'has-issue';
  $('span', footer).textContent = findings.join(' · ');
}

function scrubResponsiveCustomFrame() {
  const frame = $('[data-responsive-frame="custom"]');
  const shell = frame?.closest('.responsive-frame-viewport');
  const card = frame?.closest('[data-responsive-card]');
  if (!frame || !shell || !card) return;
  const sessionViewport = activeSession?.changeSet?.context?.viewport ?? {
    width: 1440,
    height: 900,
  };
  if (responsiveScrubTarget === 'viewport') {
    const height = Math.max(
      480,
      Math.round((responsiveCustomWidth * sessionViewport.height) / sessionViewport.width),
    );
    const scale = Math.min(1, 320 / responsiveCustomWidth, 220 / height);
    frame.width = responsiveCustomWidth;
    frame.height = height;
    shell.style.setProperty('--preview-width', `${responsiveCustomWidth}px`);
    shell.style.setProperty('--preview-height', `${height}px`);
    shell.style.setProperty('--preview-scale', scale);
    const dimensions = $('header span', card);
    if (dimensions) dimensions.textContent = `${responsiveCustomWidth} × ${height}`;
  }
  window.clearTimeout(scrubResponsiveCustomFrame.timer);
  scrubResponsiveCustomFrame.timer = window.setTimeout(() => {
    syncResponsiveFrame(frame);
    responsiveSnapshots.delete('custom');
  }, 120);
}

function renderResponsiveLab() {
  const root = $('#responsive-viewport-grid');
  if (!root) return;
  const contexts = responsiveViewportContexts();
  const minWidth = contexts[0]?.width ?? 320;
  const maxWidth = contexts.at(-1)?.width ?? 1920;
  const queries = projectDesign().containerQueries ?? [];
  const queryWidths = queries
    .flatMap((query) => [query.minWidth, query.maxWidth])
    .filter((width) => Number.isFinite(width));
  const range = $('#responsive-width');
  if (responsiveScrubTarget === 'container') {
    range.min = String(Math.max(64, Math.min(...queryWidths, 320) - 160));
    range.max = String(Math.max(responsiveContainerWidth, ...queryWidths, 1120) + 160);
    range.value = String(responsiveContainerWidth);
    $('#responsive-width-label').textContent = 'Container width';
    $('#responsive-width-output').textContent = `${responsiveContainerWidth}px`;
    $('#responsive-boundaries').innerHTML = queries.length
      ? queries
          .map((query) => {
            const width = query.minWidth ?? query.maxWidth;
            return `<button data-responsive-container-boundary="${width}" title="${escapeAttribute(sourceText(query.source))}"><strong>${escapeText(query.name || 'Container')}</strong><span>${escapeText(query.condition)}</span></button>`;
          })
          .join('')
      : '<span class="responsive-boundary-empty">No authored container queries were indexed.</span>';
  } else {
    range.min = String(Math.min(320, minWidth));
    range.max = String(Math.max(3840, maxWidth));
    range.value = String(responsiveCustomWidth);
    $('#responsive-width-label').textContent = 'Viewport width';
    $('#responsive-width-output').textContent = `${responsiveCustomWidth}px`;
    $('#responsive-boundaries').innerHTML = contexts
      .filter((item) => item.id !== 'custom')
      .map(
        (item) =>
          `<button data-responsive-boundary="${escapeAttribute(item.id)}"><strong>${escapeText(item.label)}</strong><span>${item.width}px</span></button>`,
      )
      .join('');
  }
  root.innerHTML = contexts
    .map((item) => {
      const scale = Math.min(1, 320 / item.width, 220 / item.height);
      const snapshot = responsiveSnapshots.get(item.id);
      const findings = responsiveFindingSummary(snapshot);
      const preview = previewUrl
        ? `<div class="responsive-frame-viewport" style="--preview-width:${item.width}px;--preview-height:${item.height}px;--preview-scale:${scale}"><iframe data-responsive-frame="${escapeAttribute(item.id)}" title="${escapeAttribute(item.label)} live viewport" width="${item.width}" height="${item.height}"></iframe></div>`
        : '<div class="responsive-frame-empty">Preview unavailable</div>';
      return `<article class="responsive-viewport-card ${responsiveActiveViewport === item.id ? 'is-active' : ''}" data-responsive-card="${escapeAttribute(item.id)}"><header><div><strong>${escapeText(item.label)}</strong><span>${item.width} × ${item.height}</span></div><button class="chip-button" data-responsive-open="${escapeAttribute(item.id)}">Inspect</button></header>${preview}<footer class="${findings[0] === 'No overflow detected' ? 'is-clear' : findings[0] === 'Live preview' ? '' : 'has-issue'}"><i></i><span>${escapeText(findings.join(' · '))}</span></footer></article>`;
    })
    .join('');
  responsiveFrames.clear();
  $$('[data-responsive-frame]', root).forEach((frame) => {
    const item = contexts.find((candidate) => candidate.id === frame.dataset.responsiveFrame);
    if (!item) return;
    responsiveFrames.set(frame.contentWindow, item.id);
    const url = new URL(previewUrl);
    url.searchParams.set('__foundry_embedded', '1');
    url.searchParams.set('__foundry_responsive_lab', item.id);
    frame.addEventListener('load', () => syncResponsiveFrame(frame));
    frame.src = url.href;
  });
  $$('[data-responsive-open]', root).forEach((button) =>
    button.addEventListener('click', () => {
      responsiveActiveViewport = button.dataset.responsiveOpen;
      const viewport = contexts.find((item) => item.id === responsiveActiveViewport);
      if (viewport?.id !== 'custom') {
        $('#canvas-viewport').value = viewport.id;
        syncCustomSelect($('#canvas-viewport'));
        sendCommand('set-context', { key: 'breakpoint', value: viewport.id });
      }
      renderResponsiveLab();
    }),
  );
  $$('[data-responsive-boundary]', $('#responsive-boundaries')).forEach((button) =>
    button.addEventListener('click', () => {
      responsiveActiveViewport = button.dataset.responsiveBoundary;
      renderResponsiveLab();
    }),
  );
  $$('[data-responsive-container-boundary]', $('#responsive-boundaries')).forEach((button) =>
    button.addEventListener('click', () => {
      responsiveContainerWidth = Number(button.dataset.responsiveContainerBoundary);
      range.value = String(responsiveContainerWidth);
      $('#responsive-width-output').textContent = `${responsiveContainerWidth}px`;
      scrubResponsiveCustomFrame();
    }),
  );
  const issueCount = [...responsiveSnapshots.values()].reduce(
    (total, snapshot) =>
      total +
      Math.max(
        0,
        responsiveFindingSummary(snapshot).length -
          (responsiveFindingSummary(snapshot)[0] === 'No overflow detected' ? 1 : 0),
      ),
    0,
  );
  $('#responsive-lab-status').textContent = bridgeState?.selection
    ? `${bridgeState.selection.label} linked across ${contexts.length} live viewports${issueCount ? ` · ${issueCount} findings` : ''}`
    : 'Select an element on the canvas to link it across every viewport.';
  renderResponsiveComparison();
}

function renderHealth() {
  const issues = bridgeState?.health ?? [];
  const stress = bridgeState?.stressTesting ?? {};
  const profiles = stress.profiles ?? [];
  if (!stressSelectionInitialized) {
    (stress.active ?? []).forEach((id) => selectedStressConditions.add(id));
    stressScope = stress.scope === 'canvas' ? 'canvas' : 'selection';
    stressSelectionInitialized = true;
  }
  const active = stress.active ?? [];
  const high = issues.filter((issue) => issue.severity === 'high').length;
  const accessibility = issues.filter((issue) => issue.kind === 'accessibility').length;
  const temporary = active.length;
  $('#stress-lab-status').textContent = temporary
    ? `${temporary} ${temporary === 1 ? 'condition' : 'conditions'} active`
    : 'No temporary conditions';
  $('#stress-summary-grid').innerHTML = [
    [issues.length, 'Findings', active.length ? 'Under active stress' : 'Current rendered state'],
    [high, 'High severity', high ? 'Review first' : 'No critical failures'],
    [accessibility, 'Accessibility', 'Keyboard, naming, focus, and contrast'],
    [temporary, 'Temporary tests', stress.target ?? 'No preview applied'],
  ]
    .map(
      ([value, label, detail]) =>
        `<article><strong>${value}</strong><span>${escapeText(label)}</span><small>${escapeText(detail)}</small></article>`,
    )
    .join('');

  const categories = [
    ['content', 'Content'],
    ['state', 'Product states'],
    ['accessibility', 'Accessibility'],
  ];
  $('#stress-profile-list').innerHTML = categories
    .map(([category, label]) => {
      const categoryProfiles = profiles.filter((profile) => profile.category === category);
      return `<section class="stress-profile-group"><header><strong>${label}</strong><span>${categoryProfiles.length}</span></header>${categoryProfiles
        .map(
          (profile) =>
            `<button class="stress-profile ${selectedStressConditions.has(profile.id) ? 'is-active' : ''}" data-stress-condition="${escapeAttribute(profile.id)}" aria-pressed="${String(selectedStressConditions.has(profile.id))}"><span><strong>${escapeText(profile.label)}</strong><small>${escapeText(profile.description)}</small></span><i data-icon="check"></i></button>`,
        )
        .join('')}</section>`;
    })
    .join('');

  $$('[data-stress-scope]').forEach((button) => {
    const selected = button.dataset.stressScope === stressScope;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('#apply-stress').disabled = selectedStressConditions.size === 0;
  $('#clear-stress').disabled = selectedStressConditions.size === 0 && active.length === 0;

  const filters = ['all', 'high', 'medium', 'low'];
  $('#stress-severity-filters').innerHTML = filters
    .map((filter) => {
      const count =
        filter === 'all'
          ? issues.length
          : issues.filter((issue) => issue.severity === filter).length;
      return `<button class="${stressSeverity === filter ? 'is-active' : ''}" data-stress-severity="${filter}" aria-pressed="${String(stressSeverity === filter)}">${filter === 'all' ? 'All' : `${filter[0].toUpperCase()}${filter.slice(1)}`} <span>${count}</span></button>`;
    })
    .join('');
  $$('[data-stress-group]').forEach((button) => {
    const selected = button.dataset.stressGroup === stressGroupBy;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  const visibleIssues = issues.filter(
    (issue) => stressSeverity === 'all' || issue.severity === stressSeverity,
  );
  const order = ['high', 'medium', 'low'];
  const grouped = new Map();
  visibleIssues.forEach((issue) => {
    const key = stressGroupBy === 'source' ? issue.source || 'unmapped' : issue.severity;
    grouped.set(key, [...(grouped.get(key) ?? []), issue]);
  });
  const groups = [...grouped.entries()].sort(([first], [second]) =>
    stressGroupBy === 'severity'
      ? order.indexOf(first) - order.indexOf(second)
      : first.localeCompare(second),
  );
  $('#stress-finding-groups').innerHTML = groups.length
    ? groups
        .map(([key, findings]) => {
          const label =
            stressGroupBy === 'severity'
              ? `${key[0].toUpperCase()}${key.slice(1)} severity`
              : key === 'unmapped'
                ? 'Source mapping unavailable'
                : key;
          return `<section class="stress-finding-group"><header><strong>${escapeText(label)}</strong><span>${findings.length}</span></header>${findings
            .map(
              (issue) =>
                `<article class="stress-finding-card"><div class="stress-finding-title"><i data-severity="${escapeAttribute(issue.severity)}"></i><span><strong>${escapeText(issue.title ?? issue.kind)}</strong><small>${escapeText(issue.detail ?? issue.description ?? '')}</small></span><span class="stress-kind">${escapeText(issue.kind)}</span></div><div class="stress-finding-evidence"><span>${escapeText(issue.viewport ?? 'Current viewport')}</span><p>${escapeText(issue.evidence ?? '')}</p>${issue.source ? `<code>${escapeText(issue.source)}</code>` : ''}</div>${issue.stressConditions?.length ? `<div class="stress-context">Found under ${issue.stressConditions.map((condition) => `<span>${escapeText(condition.replaceAll('-', ' '))}</span>`).join('')}</div>` : ''}<footer><button class="secondary-button compact" data-stress-select="${escapeAttribute(issue.id)}">Select layer</button>${issue.canFix ? `<button class="primary-button compact" data-stress-fix="${escapeAttribute(issue.id)}" ${issue.previewed ? 'disabled' : ''}>${issue.previewed ? 'Added to review' : 'Preview correction'}</button>` : ''}</footer></article>`,
            )
            .join('')}</section>`;
        })
        .join('')
    : `<div class="stress-empty"><i data-icon="${issues.length ? 'search' : 'check'}"></i><strong>${issues.length ? 'No findings match this filter' : 'No issues found'}</strong><p>${issues.length ? 'Choose another severity to continue reviewing.' : active.length ? 'The rendered product passed under the active stress conditions.' : 'Apply temporary conditions or scan the current state.'}</p></div>`;
  $('#stress-lab-footnote').textContent = active.length
    ? `${active.length} temporary ${active.length === 1 ? 'condition is' : 'conditions are'} active on ${stress.target ?? 'the canvas'}. Clearing them restores the original rendered state.`
    : 'Temporary conditions remain outside the design change history.';
  $('#stress-review').disabled = !(activeSession?.changeSet?.changes ?? []).length;

  $$('[data-stress-condition]').forEach((button) =>
    button.addEventListener('click', () => {
      const id = button.dataset.stressCondition;
      const profile = profiles.find((candidate) => candidate.id === id);
      if (selectedStressConditions.has(id)) selectedStressConditions.delete(id);
      else {
        if (profile?.combination === 'state') {
          profiles
            .filter((candidate) => candidate.combination === 'state')
            .forEach((candidate) => selectedStressConditions.delete(candidate.id));
        }
        selectedStressConditions.add(id);
      }
      renderHealth();
    }),
  );
  $$('[data-stress-severity]').forEach((button) =>
    button.addEventListener('click', () => {
      stressSeverity = button.dataset.stressSeverity;
      renderHealth();
    }),
  );
  $$('[data-stress-select]').forEach((button) =>
    button.addEventListener('click', () => {
      sendCommand('select-health-issue', {
        issueId: button.dataset.stressSelect,
      });
      setMode('canvas');
    }),
  );
  $$('[data-stress-fix]').forEach((button) =>
    button.addEventListener('click', () =>
      sendCommand('preview-health-fix', { issueId: button.dataset.stressFix }),
    ),
  );
  renderIcons($('[data-mode-surface="health"]'));
}

function renderMemory() {
  const memory = bridgeState?.decisionMemory ?? {};
  const decisions = memory.decisions ?? bridgeState?.memory?.decisions ?? [];
  const relevant = new Map(
    (memory.relevant ?? []).map((assessment) => [assessment.decision.id, assessment]),
  );
  const filtered = decisions.filter((decision) => {
    const matchesQuery = `${decision.title} ${decision.summary} ${decision.rationale ?? ''}`
      .toLowerCase()
      .includes(decisionMemorySearch.toLowerCase());
    const matchesFilter =
      decisionMemoryFilter === 'all' ||
      (decisionMemoryFilter === 'disabled'
        ? !decision.enabled
        : decision.enabled && decision.outcome === decisionMemoryFilter);
    return matchesQuery && matchesFilter;
  });
  if (!decisions.some((decision) => decision.id === decisionMemoryId))
    decisionMemoryId = decisions[0]?.id ?? '';
  const decision = decisions.find((candidate) => candidate.id === decisionMemoryId);
  const assessment = decision ? relevant.get(decision.id) : null;
  const enabled = decisions.filter((item) => item.enabled).length;
  $('#decision-memory-status').textContent = decisions.length
    ? `${enabled} active · ${decisions.length} saved`
    : 'No decisions saved';
  $('#decision-memory-save').disabled = !memory.canCapture;
  const context = memory.context ?? {};
  $('#decision-memory-context').innerHTML = bridgeState?.selection
    ? `<strong>${escapeText(bridgeState.selection.label)}</strong><code>${escapeText(sourceText(bridgeState.selection.source) || bridgeState.selection.kind)}</code><span>${memory.hasEditedValues ? 'Edited values will become explicit preference or avoidance rules.' : 'This decision will be connected to the selected component and source.'}</span>`
    : '<span>Select a layer before capturing contextual guidance.</span>';
  $('#decision-memory-list').innerHTML = filtered.length
    ? filtered
        .map((item) => {
          const match = relevant.get(item.id);
          return `<button class="decision-memory-row ${item.id === decisionMemoryId ? 'is-active' : ''}" data-design-decision="${escapeAttribute(item.id)}" data-outcome="${escapeAttribute(item.outcome)}" data-enabled="${item.enabled}"><i data-icon="${item.outcome === 'rejected' ? 'close' : item.outcome === 'rule' ? 'bookmark' : 'check'}"></i><span><strong>${escapeText(item.title)}</strong><small>${escapeText(item.summary)}</small></span>${match ? `<code>${match.score}%</code>` : ''}</button>`;
        })
        .join('')
    : `<div class="decision-memory-empty"><i data-icon="bookmark"></i><strong>${decisions.length ? 'No decisions match' : 'Build useful project memory'}</strong><p>${decisions.length ? 'Try another search or filter.' : 'Capture an approved direction, rejected experiment, or explicit project rule.'}</p></div>`;

  if (!decision) {
    $('#decision-memory-stage').innerHTML =
      '<div class="decision-memory-empty is-stage"><i data-icon="bookmark"></i><strong>Context before conflict</strong><p>Foundry connects remembered guidance to components, properties, source locations, responsive context, and themes before an edited value reaches Review.</p></div>';
  } else {
    const conditions = [
      ...(decision.conditions.components ?? []),
      ...(decision.conditions.elementKinds ?? []),
      ...(decision.conditions.properties ?? []),
      ...(decision.conditions.breakpoints ?? []),
      ...(decision.conditions.themes ?? []),
      ...(decision.conditions.states ?? []),
    ];
    const rules = decision.rules?.length
      ? decision.rules
          .map(
            (rule) =>
              `<article><span data-operator="${escapeAttribute(rule.operator)}">${escapeText(rule.operator)}</span><strong>${escapeText(rule.property ?? rule.category ?? 'Project guidance')}</strong><code>${escapeText(rule.value ?? rule.guidance ?? decision.summary)}</code></article>`,
          )
          .join('')
      : '<p>No property rule was captured.</p>';
    const evidence = decision.evidence?.length
      ? decision.evidence
          .map(
            (item) =>
              `<article><i data-icon="${item.kind === 'branch' ? 'branch' : item.kind === 'baseline' ? 'check' : 'bookmark'}"></i><span><strong>${escapeText(item.label)}</strong><small>${escapeText(item.kind)}${item.refId ? ` · ${escapeText(item.refId)}` : ''}</small></span></article>`,
          )
          .join('')
      : '<p>Captured directly in Foundry.</p>';
    $('#decision-memory-stage').innerHTML =
      `<section class="decision-memory-overview" data-outcome="${escapeAttribute(decision.outcome)}"><header><div><span class="eyebrow">${escapeText(decision.outcome)} decision</span><h2>${escapeText(decision.title)}</h2><p>${escapeText(decision.summary)}</p></div><span class="decision-state">${decision.enabled ? 'Active' : 'Disabled'}</span></header><div class="decision-memory-pills">${(decision.categories ?? []).map((category) => `<span>${escapeText(category)}</span>`).join('')}${conditions
        .slice(0, 6)
        .map((condition) => `<span>${escapeText(condition)}</span>`)
        .join(
          '',
        )}</div>${assessment ? `<div class="decision-relevance" data-conflict="${Boolean(assessment.conflicts?.length)}"><strong>${assessment.conflicts?.length ? 'Potential conflict' : 'Relevant to the current selection'}</strong><span>${assessment.score}% match · ${escapeText(assessment.reasons.join(' · ') || 'Project-wide guidance')}</span></div>` : ''}</section><section class="decision-memory-rules"><header><span class="eyebrow">Remembered guidance</span><strong>Explicit rules</strong></header><div>${rules}</div></section><section class="decision-memory-evidence"><header><span class="eyebrow">Why this exists</span><strong>Evidence and source</strong></header><div>${evidence}</div>${decision.sourceLocations?.length ? `<code>${decision.sourceLocations.map(escapeText).join('\n')}</code>` : ''}${decision.rationale ? `<p>${escapeText(decision.rationale)}</p>` : ''}</section><section class="decision-memory-edit"><label><span>Correct guidance</span><textarea data-decision-summary rows="3">${escapeText(decision.summary)}</textarea></label><label><span>Why</span><textarea data-decision-rationale rows="3">${escapeText(decision.rationale ?? '')}</textarea></label><footer><button class="secondary-button" data-toggle-decision="${escapeAttribute(decision.id)}">${decision.enabled ? 'Disable guidance' : 'Enable guidance'}</button><button class="quiet-button" data-remove-decision="${escapeAttribute(decision.id)}"><i data-icon="bin"></i>Remove</button><button class="primary-button" data-save-decision-correction="${escapeAttribute(decision.id)}">Save correction</button></footer></section>`;
  }
  $$('[data-design-decision]').forEach((button) =>
    button.addEventListener('click', () => {
      decisionMemoryId = button.dataset.designDecision;
      renderMemory();
    }),
  );
  $('[data-toggle-decision]')?.addEventListener('click', (event) => {
    const current = decisions.find(
      (item) => item.id === event.currentTarget.dataset.toggleDecision,
    );
    sendCommand('update-design-decision', {
      decisionId: current?.id,
      enabled: !current?.enabled,
    });
  });
  $('[data-remove-decision]')?.addEventListener('click', (event) => {
    sendCommand('remove-design-decision', {
      decisionId: event.currentTarget.dataset.removeDecision,
    });
    decisionMemoryId = '';
  });
  $('[data-save-decision-correction]')?.addEventListener('click', (event) => {
    sendCommand('update-design-decision', {
      decisionId: event.currentTarget.dataset.saveDecisionCorrection,
      summary: $('[data-decision-summary]').value,
      rationale: $('[data-decision-rationale]').value,
    });
    toast('Remembered guidance corrected');
  });
  renderIcons($('[data-mode-surface="memory"]'));
}

function visualAgentRequests() {
  return activeSession?.visualAgentRequests ?? [];
}

function activeVisualAgentRequest() {
  const requests = visualAgentRequests();
  if (!requests.some((request) => request.id === visualAgentRequestId)) {
    visualAgentRequestId = requests.at(-1)?.id ?? '';
  }
  return requests.find((request) => request.id === visualAgentRequestId) ?? null;
}

function visualAgentContextSnapshot(comment) {
  const viewport = activeSession?.changeSet?.context?.viewport ?? selectedViewport();
  const selection = bridgeState?.selection;
  const targets = selection?.targets?.length
    ? selection.targets
    : selection
      ? [
          {
            id: selection.id,
            selector: selection.selector,
            label: selection.label,
            kind: selection.kind,
            component: selection.component,
            source: selection.source,
            confidence: selection.confidence,
            geometry: {
              x: 0,
              y: 0,
              width: selection.width,
              height: selection.height,
              scale: 1,
            },
            measurements: Object.fromEntries(
              (bridgeState?.controls ?? []).map((control) => [control.property, control.value]),
            ),
          },
        ]
      : [];
  const region = bridgeState?.visualAgent?.region
    ? { ...bridgeState.visualAgent.region, label: 'Drawn canvas region' }
    : undefined;
  const comments = comment
    ? [
        {
          id: `comment_${Date.now()}`,
          body: comment,
          ...(targets[0] ? { targetId: targets[0].id } : region ? { regionId: region.id } : {}),
          createdAt: new Date().toISOString(),
        },
      ]
    : [];
  return {
    targets,
    ...(region ? { region } : {}),
    comments,
    viewport: { width: viewport.width, height: viewport.height },
    breakpoint: bridgeState?.context?.breakpoint ?? 'current',
    theme: bridgeState?.context?.theme ?? 'current',
    state: bridgeState?.context?.state ?? 'current',
    tokens: bridgeState?.project?.tokens ?? [],
    designGraphRevision: activeSession?.changeSet?.designGraphRevision,
  };
}

function renderVisualAgent() {
  const root = $('[data-mode-surface="agent"]');
  if (!root) return;
  const requests = visualAgentRequests();
  const request = activeVisualAgentRequest();
  const selection = bridgeState?.selection;
  const targets = selection?.targets ?? (selection ? [selection] : []);
  const region = bridgeState?.visualAgent?.region;
  const contextCount = targets.length + (region ? 1 : 0);
  $('#visual-agent-status').textContent = request
    ? request.status === 'ready'
      ? `${request.proposals.length} ready`
      : request.status.replace('_', ' ')
    : contextCount
      ? `${contextCount} attached`
      : 'No context';
  $('#visual-agent-thread-list').innerHTML = requests.length
    ? [...requests]
        .reverse()
        .map(
          (item) =>
            `<button class="visual-agent-thread ${item.id === request?.id ? 'is-active' : ''}" data-visual-agent-thread="${escapeAttribute(item.id)}"><i data-icon="${item.status === 'ready' ? 'check' : item.status === 'needs_attention' ? 'activity' : 'message'}"></i><span><strong>${escapeText(item.title)}</strong><small>${escapeText(item.status.replace('_', ' '))} · ${item.context.targets.length} ${item.context.targets.length === 1 ? 'layer' : 'layers'}${item.context.region ? ' + region' : ''}</small></span></button>`,
        )
        .join('')
    : '<div class="visual-agent-empty"><i data-icon="message"></i><strong>Start with the pixels</strong><p>Select several layers or draw a region, then ask about hierarchy, consistency, or layout.</p></div>';

  $('#visual-agent-context').innerHTML = contextCount
    ? `${targets
        .map(
          (target) =>
            `<article><i data-icon="component"></i><span><strong>${escapeText(target.label)}</strong><code>${escapeText(sourceText(target.source) || target.kind)}</code></span><small>${Math.round(target.geometry?.width ?? target.width)} × ${Math.round(target.geometry?.height ?? target.height)}</small></article>`,
        )
        .join(
          '',
        )}${region ? `<article><i data-icon="cursor"></i><span><strong>Drawn canvas region</strong><code>${Math.round(region.x)}, ${Math.round(region.y)}</code></span><small>${Math.round(region.width)} × ${Math.round(region.height)}</small></article>` : ''}<footer><span>${escapeText(bridgeState?.context?.breakpoint ?? 'current')}</span><span>${escapeText(bridgeState?.context?.theme ?? 'current')}</span><span>${escapeText(bridgeState?.context?.state ?? 'current')}</span></footer>`
    : '<div class="visual-agent-empty"><i data-icon="cursor"></i><strong>No rendered context</strong><p>Select layers on Canvas or draw a region here.</p></div>';
  $('#visual-agent-clear-region').disabled = !region;

  if (!request) {
    $('#visual-agent-conversation').innerHTML =
      '<div class="visual-agent-empty is-stage"><i data-icon="message"></i><strong>Ask a visual question in context</strong><p>Foundry sends the exact selected pixels, source locations, measurements, responsive context, project tokens, and your attached comments to the active coding agent.</p></div>';
  } else {
    const messages = request.messages
      .map((message) => {
        const roleLabel =
          message.role === 'user' ? 'You' : message.role === 'agent' ? 'Agent' : 'Foundry';
        const roleIcon =
          message.role === 'user' ? 'cursor' : message.role === 'agent' ? 'sparkles' : 'activity';
        return `<article class="visual-agent-message" data-role="${message.role}"><span class="visual-agent-message-icon"><i data-icon="${roleIcon}"></i></span><div><header><strong>${roleLabel}</strong><time>${new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></header><p>${escapeText(message.body)}</p></div></article>`;
      })
      .join('');
    const proposals = request.proposals.length
      ? `<section class="visual-agent-proposals"><header><div><span class="eyebrow">Source-safe directions</span><strong>${request.proposals.length} ${request.proposals.length === 1 ? 'proposal' : 'proposals'} to compare</strong></div><span>Nothing changes until you choose</span></header>${request.proposals
          .map(
            (proposal) =>
              `<article class="visual-agent-proposal" data-status="${proposal.status}"><header><div><strong>${escapeText(proposal.name)}</strong><span>${escapeText(proposal.status)}</span></div><p>${escapeText(proposal.summary)}</p></header><div class="visual-agent-proposal-grid"><section><span>Why</span>${proposal.reasoning.map((item) => `<p>${escapeText(item)}</p>`).join('') || '<p>Grounded in the attached context.</p>'}</section><section><span>Exact values</span>${proposal.exactValues.map((item) => `<code>${escapeText(item)}</code>`).join('') || '<code>No value changes proposed</code>'}</section><section><span>Responsive impact</span><p>${escapeText(proposal.responsiveImpact)}</p></section><section><span>Affected source</span>${proposal.sourceLocations.map((item) => `<code>${escapeText(item)}</code>`).join('') || '<code>No mapped source</code>'}</section><section><span>Verification</span>${proposal.verificationPlan.map((item) => `<p>${escapeText(item)}</p>`).join('') || '<p>Rebuild and measure the selected targets.</p>'}</section></div><footer><span>${proposal.changes.length} reviewable ${proposal.changes.length === 1 ? 'change' : 'changes'}</span><button class="quiet-button compact" data-agent-proposal-action="reject" data-agent-request="${request.id}" data-agent-proposal="${proposal.id}" ${proposal.status === 'rejected' ? 'disabled' : ''}>Reject</button><button class="secondary-button compact" data-agent-proposal-action="preview" data-agent-request="${request.id}" data-agent-proposal="${proposal.id}" ${!proposal.changes.length || proposal.status === 'promoted' ? 'disabled' : ''}>${proposal.branchId ? 'Preview again' : 'Preview direction'}</button><button class="primary-button compact" data-agent-proposal-action="promote" data-agent-request="${request.id}" data-agent-proposal="${proposal.id}" ${!proposal.branchId || proposal.status === 'promoted' ? 'disabled' : ''}>Move to Review</button></footer></article>`,
          )
          .join('')}</section>`
      : request.status === 'needs_attention'
        ? `<div class="visual-agent-recovery"><i data-icon="activity"></i><div><strong>Agent response interrupted</strong><p>${escapeText(request.error ?? 'The request needs attention before retrying.')}</p></div><button class="primary-button compact" data-agent-retry="${request.id}">Retry request</button></div>`
        : '<div class="visual-agent-thinking"><i data-icon="sparkles"></i><span><strong>The active agent is inspecting context</strong><small>Source-safe directions will appear here without entering Review.</small></span></div>';
    $('#visual-agent-conversation').innerHTML =
      `<header class="visual-agent-conversation-head"><div><span class="eyebrow">Active question</span><strong>${escapeText(request.title)}</strong></div><span data-status="${escapeAttribute(request.status)}">${escapeText(request.status.replace('_', ' '))}</span></header><div class="visual-agent-conversation-body"><div class="visual-agent-messages">${messages}</div>${proposals}</div>`;
  }
  $$('[data-visual-agent-thread]', root).forEach((button) =>
    button.addEventListener('click', () => {
      visualAgentRequestId = button.dataset.visualAgentThread;
      renderVisualAgent();
    }),
  );
  $$('[data-agent-proposal-action]', root).forEach((button) =>
    button.addEventListener('click', () => void handleVisualAgentProposal(button)),
  );
  $('[data-agent-retry]', root)?.addEventListener('click', async (event) => {
    try {
      renderSession(
        await api(
          `/v1/sessions/${sessionId}/visual-agent-requests/${event.currentTarget.dataset.agentRetry}/retry`,
          { method: 'POST', body: '{}' },
        ),
      );
      toast('Visual request returned to the active agent');
    } catch (error) {
      toast(error.message);
    }
  });
  renderIcons(root);
}

async function handleVisualAgentProposal(button) {
  const action = button.dataset.agentProposalAction;
  const current = activeDesignDirection();
  try {
    const updated = await api(
      `/v1/sessions/${sessionId}/visual-agent-requests/${button.dataset.agentRequest}/proposals/${button.dataset.agentProposal}`,
      { method: 'POST', body: JSON.stringify({ action }) },
    );
    const request = updated.visualAgentRequests.find(
      (item) => item.id === button.dataset.agentRequest,
    );
    const proposal = request?.proposals.find((item) => item.id === button.dataset.agentProposal);
    if (action === 'preview') {
      const branch = updated.designBranches.find((item) => item.id === proposal?.branchId);
      if (bridgeConnected && branch) {
        await requestCommand('switch-design-branch', {
          previousChanges: current.changes ?? [],
          nextChanges: branch.changes ?? [],
        });
      }
      toast(`${proposal?.name ?? 'Direction'} is live on the canvas`);
    }
    if (action === 'promote') {
      if (bridgeConnected) {
        await requestCommand('switch-design-branch', {
          previousChanges: current.changes ?? [],
          nextChanges: updated.changeSet.changes ?? [],
        });
        sendCommand('save-design-decision', {
          title: `${proposal?.name ?? 'Visual proposal'} approved`,
          summary: proposal?.summary ?? 'Approved through Visual agent.',
          rationale: proposal?.reasoning?.join(' ') ?? '',
          outcome: 'approved',
          evidenceKind: 'branch',
          evidenceLabel: proposal?.name ?? 'Visual agent proposal',
          refId: proposal?.branchId,
          changes: proposal?.changes ?? [],
        });
      }
      renderSession(updated);
      setMode('review');
      toast('Chosen direction moved to Review');
      return;
    }
    renderSession(updated);
  } catch (error) {
    toast(error.message);
  }
}

function visualRecipeTargetSuggestions(recipe) {
  const layers = bridgeState?.layers ?? [];
  const components =
    recipe?.conditions?.components ?? (recipe?.component ? [recipe.component] : []);
  const kinds = recipe?.conditions?.elementKinds ?? [];
  return layers
    .map((layer) => {
      const componentMatch = components.includes(layer.component);
      const kindMatch = kinds.includes(layer.kind);
      return {
        ...layer,
        compatibility: componentMatch ? 'exact' : kindMatch ? 'compatible' : 'possible',
        score: componentMatch ? 100 : kindMatch ? 84 : 48,
      };
    })
    .filter((layer) => layer.score > 48 || (!components.length && !kinds.length))
    .sort((a, b) => b.score - a.score || a.depth - b.depth)
    .slice(0, 8);
}

function renderVisualRecipes() {
  const visual = bridgeState?.visualRecipes ?? {};
  const recipes = visual.recipes ?? bridgeState?.memory?.recipes ?? [];
  const filtered = recipes.filter((recipe) =>
    `${recipe.name} ${recipe.intent ?? ''} ${recipe.sourceLabel ?? ''}`
      .toLowerCase()
      .includes(visualRecipeSearch.toLowerCase()),
  );
  if (!recipes.some((recipe) => recipe.id === visualRecipeId))
    visualRecipeId = recipes[0]?.id ?? '';
  const recipe = recipes.find((candidate) => candidate.id === visualRecipeId);
  const assessment = recipe ? visual.assessment?.[recipe.id] : null;
  const selection = bridgeState?.selection;
  $('#visual-recipe-status').textContent = recipes.length ? String(recipes.length) : '0';
  $('#visual-recipe-save').disabled = !visual.canSave;
  $('#visual-recipe-selection').innerHTML = selection
    ? `<i data-icon="component"></i><span><strong>${escapeText(selection.label)}</strong><code>${escapeText(selection.component ?? selection.kind)}</code><small>${visual.canSave ? 'Edited values are ready to capture.' : 'Refine this layer before saving a recipe.'}</small></span>`
    : '<i data-icon="cursor"></i><span><strong>No editable selection</strong><small>Select and refine a layer on the canvas first.</small></span>';
  $('#visual-recipe-list').innerHTML = filtered.length
    ? filtered
        .map((item) => {
          const categories = item.categories ?? [
            ...new Set(item.values.map((value) => value.category)),
          ];
          return `<button class="visual-recipe-row ${item.id === visualRecipeId ? 'is-active' : ''}" data-visual-recipe="${escapeAttribute(item.id)}"><span><strong>${escapeText(item.name)}</strong><small>${escapeText(item.intent ?? item.sourceLabel)}</small></span><code>${categories.length}</code></button>`;
        })
        .join('')
    : `<div class="visual-recipe-empty"><i data-icon="bookmark"></i><strong>${recipes.length ? 'No recipes match' : 'No recipes saved yet'}</strong><p>${recipes.length ? 'Try another search.' : 'Refine a layer, then save its treatment with a clear intent.'}</p></div>`;

  if (!recipe) {
    $('#visual-recipe-stage').innerHTML =
      `<div class="visual-recipe-empty is-stage"><i data-icon="sparkles"></i><strong>Reusable, not copied</strong><p>A recipe carries visual intent and conditions. Foundry resolves its values through each destination project and shows the exact mapping before Review.</p></div>`;
  } else {
    const categories = recipe.categories ?? [
      ...new Set(recipe.values.map((value) => value.category)),
    ];
    const suggestions = visualRecipeTargetSuggestions(recipe);
    const mappingRows = assessment?.mappings ?? [];
    $('#visual-recipe-stage').innerHTML =
      `<section class="visual-recipe-overview"><header><div><span class="eyebrow">${escapeText(recipe.sourceLabel)}</span><h2>${escapeText(recipe.name)}</h2><p>${escapeText(recipe.intent ?? 'Reusable project treatment')}</p></div><button class="icon-button" data-remove-visual-recipe="${escapeAttribute(recipe.id)}" aria-label="Remove ${escapeAttribute(recipe.name)}"><i data-icon="bin"></i></button></header><div class="visual-recipe-pills">${categories.map((category) => `<span>${escapeText(category)}</span>`).join('')}</div></section><section class="visual-recipe-mapping"><header><div><span class="eyebrow">Destination mapping</span><strong>${selection ? escapeText(selection.label) : 'Select a compatible target'}</strong></div>${assessment ? `<span class="recipe-compatibility" data-compatibility="${assessment.compatibility}">${assessment.score}% ${assessment.compatibility}</span>` : ''}</header>${selection ? `<div class="visual-recipe-map-columns" aria-hidden="true"><span>Property</span><span>Current</span><span></span><span>Resolved</span></div><div class="visual-recipe-map-list">${mappingRows.map((mapping) => `<article data-status="${mapping.status}" title="${escapeAttribute(mapping.detail)}"><span><strong>${escapeText(mapping.property)}</strong><small>${escapeText(mapping.category)}</small></span><code>${escapeText(mapping.currentValue ?? 'Unavailable')}</code><i data-icon="chevronRight"></i><span><code>${escapeText(mapping.resolvedValue ?? mapping.sourceValue)}</code><small>${mapping.token ? escapeText(mapping.token.name) : mapping.status === 'unsupported' ? 'Unsupported on target' : 'Destination literal'}</small></span></article>`).join('')}</div><footer><span>${assessment?.ambiguous ? `${assessment.ambiguous} token choice requires explicit review.` : 'Every supported value is visible before it enters Review.'}</span><button class="primary-button" data-apply-visual-recipe="${escapeAttribute(recipe.id)}" ${assessment?.matched ? '' : 'disabled'}>Add mapped values to Review</button></footer>` : '<div class="visual-recipe-empty is-mapping"><i data-icon="cursor"></i><strong>Select a target</strong><p>Choose one of the compatible targets below to inspect the destination mapping.</p></div>'}</section><section class="visual-recipe-targets"><header><div><span class="eyebrow">Compatible targets</span><strong>Suggested, never automatic</strong></div><span>${suggestions.length} matches</span></header><div>${suggestions.map((target) => `<button data-visual-recipe-target="${escapeAttribute(target.selector)}"><span><strong>${escapeText(target.label)}</strong><small>${escapeText(target.component ?? target.kind)}</small></span><code>${target.score}%</code></button>`).join('') || '<p>No component or element conditions match the current project.</p>'}</div></section>`;
  }
  $$('[data-visual-recipe]').forEach((button) =>
    button.addEventListener('click', () => {
      visualRecipeId = button.dataset.visualRecipe;
      renderVisualRecipes();
    }),
  );
  $$('[data-visual-recipe-target]').forEach((button) =>
    button.addEventListener('click', () =>
      sendCommand('select', { selector: button.dataset.visualRecipeTarget }),
    ),
  );
  $$('[data-apply-visual-recipe]').forEach((button) =>
    button.addEventListener('click', () => {
      sendCommand('apply-visual-recipe', {
        recipeId: button.dataset.applyVisualRecipe,
      });
      toast('Mapped values added as previews for Review');
    }),
  );
  $$('[data-remove-visual-recipe]').forEach((button) =>
    button.addEventListener('click', () => {
      sendCommand('remove-visual-recipe', {
        recipeId: button.dataset.removeVisualRecipe,
      });
      visualRecipeId = '';
    }),
  );
  renderIcons($('[data-mode-surface="recipes"]'));
}

const DESIGN_SYSTEM_CATEGORY_LABELS = {
  color: 'Color',
  spacing: 'Spacing',
  size: 'Size',
  radius: 'Radius',
  typography: 'Typography',
  shadow: 'Shadow',
  motion: 'Motion',
  other: 'Other',
};

const DESIGN_SYSTEM_CATEGORY_ORDER = Object.keys(DESIGN_SYSTEM_CATEGORY_LABELS);

function isAuthoredDesignToken(token) {
  const value = String(token?.value ?? '').trim();
  return Boolean(
    token?.name?.startsWith('--') &&
    value &&
    !value.includes('${') &&
    !value.includes('\\s*') &&
    !value.endsWith('/)'),
  );
}

function compareDesignSystemItems(left, right) {
  const leftCategory = DESIGN_SYSTEM_CATEGORY_ORDER.indexOf(left.category);
  const rightCategory = DESIGN_SYSTEM_CATEGORY_ORDER.indexOf(right.category);
  return (
    (leftCategory < 0 ? DESIGN_SYSTEM_CATEGORY_ORDER.length : leftCategory) -
      (rightCategory < 0 ? DESIGN_SYSTEM_CATEGORY_ORDER.length : rightCategory) ||
    String(left.name ?? left.suggestedTokenName ?? left.value).localeCompare(
      String(right.name ?? right.suggestedTokenName ?? right.value),
    )
  );
}

function renderDesignSystem() {
  const project = projectDesign();
  const tokens = (project.tokens ?? []).filter(isAuthoredDesignToken);
  const tokenIds = new Set(tokens.map((token) => token.id));
  const usages = (project.tokenUsages ?? []).filter((usage) => tokenIds.has(usage.tokenId));
  const findings = (project.designSystemFindings ?? []).filter(
    (finding) => !finding.tokenIds?.length || finding.tokenIds.some((id) => tokenIds.has(id)),
  );
  const promotions = project.tokenPromotions ?? [];
  const warnings = findings.filter((finding) => finding.severity === 'warning');
  const literals = usages.filter((usage) => usage.kind === 'literal');
  const mappedComponents = new Set(usages.map((usage) => usage.componentId).filter(Boolean));
  $('#design-system-status').textContent =
    `${tokens.length} ${tokens.length === 1 ? 'token' : 'tokens'} · ${promotions.length} ${promotions.length === 1 ? 'promotion' : 'promotions'}`;
  $('#design-system-summary').innerHTML = [
    [tokens.length, 'Native tokens', 'Indexed from project source'],
    [usages.length, 'Mapped usages', `${literals.length} literals to review`],
    [promotions.length, 'Promotion plans', `${mappedComponents.size} components reached`],
    [warnings.length, 'Drift warnings', 'No automatic changes'],
  ]
    .map(
      ([value, label, detail]) =>
        `<article><strong>${value}</strong><span>${label}</span><small>${detail}</small></article>`,
    )
    .join('');

  $$('[data-system-view]').forEach((button) => {
    const active = button.dataset.systemView === designSystemView;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const search = $('#design-system-search');
  search.placeholder =
    designSystemView === 'promotions' ? 'Search promotion plans' : 'Search tokens';
  search.setAttribute(
    'aria-label',
    designSystemView === 'promotions' ? 'Search token promotion plans' : 'Search project tokens',
  );

  const collection = designSystemView === 'promotions' ? promotions : tokens;
  const categoryCounts = collection.reduce((counts, item) => {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
    return counts;
  }, {});
  const categories = [
    'all',
    ...Object.keys(DESIGN_SYSTEM_CATEGORY_LABELS).filter((key) => categoryCounts[key]),
  ];
  $('#design-system-categories').innerHTML = categories
    .map(
      (category) =>
        `<button class="chip-button ${designSystemCategory === category ? 'is-active' : ''}" data-system-category="${category}"><span>${category === 'all' ? 'All' : DESIGN_SYSTEM_CATEGORY_LABELS[category]}</span><code>${category === 'all' ? collection.length : categoryCounts[category]}</code></button>`,
    )
    .join('');

  const query = search.value.trim().toLowerCase();
  const detail = $('#design-system-detail');
  if (designSystemView === 'promotions') {
    const visible = promotions
      .filter(
        (candidate) =>
          (designSystemCategory === 'all' || candidate.category === designSystemCategory) &&
          `${candidate.value} ${candidate.property} ${candidate.suggestedTokenName} ${candidate.category}`
            .toLowerCase()
            .includes(query),
      )
      .sort(compareDesignSystemItems);
    if (!promotions.some((candidate) => candidate.id === designSystemPromotionId)) {
      designSystemPromotionId = visible[0]?.id ?? promotions[0]?.id ?? '';
    }
    $('#design-system-token-list').innerHTML = visible.length
      ? visible
          .map(
            (candidate) =>
              `<button class="design-token-row is-promotion ${candidate.id === designSystemPromotionId ? 'is-active' : ''}" data-system-promotion="${escapeAttribute(candidate.id)}"><i class="design-token-glyph"></i><span><strong>${escapeText(candidate.value)}</strong><code>${escapeText(candidate.suggestedTokenName)}</code></span><span class="design-token-count ${candidate.relation === 'near' ? 'has-warning' : ''}">${candidate.occurrenceCount}</span></button>`,
          )
          .join('')
      : '<div class="empty-inspector">No recurring values match this search.</div>';
    const candidate = promotions.find((item) => item.id === designSystemPromotionId);
    if (!candidate) {
      detail.innerHTML =
        '<div class="workshop-empty">No recurring authored values are ready for promotion.</div>';
    } else {
      const action =
        candidate.recommendation === 'use-existing'
          ? `Replace with var(${candidate.suggestedTokenName})`
          : `Create ${candidate.suggestedTokenName}`;
      const chain = candidate.aliasChain?.length
        ? candidate.aliasChain
            .map((name, index) => `${index ? '<i>→</i>' : ''}<code>${escapeText(name)}</code>`)
            .join('')
        : `<code>${escapeText(candidate.suggestedTokenName)}</code><i>→</i><code>${escapeText(candidate.value)}</code>`;
      const sources = candidate.sources
        .map(
          (source) =>
            `<article><span class="usage-kind" data-kind="literal">literal</span><span><strong>${escapeText(candidate.property)}</strong><code>${escapeText(sourceText(source))}</code></span><code>${escapeText(candidate.value)}</code></article>`,
        )
        .join('');
      detail.innerHTML = `<div class="design-system-detail-head"><div><span class="eyebrow">${escapeText(candidate.recommendation === 'use-existing' ? 'Existing token' : 'New project token')}</span><h2>${escapeText(candidate.value)}</h2><code>${escapeText(`${candidate.occurrenceCount} authored occurrences · ${candidate.relation} match`)}</code></div></div><div class="design-system-grid"><section class="design-system-card"><header><strong>Recommended plan</strong><span>${escapeText(candidate.relation)}</span></header><div class="design-system-source"><code>${escapeText(action)}</code><p>${escapeText(candidate.evidence?.join(' · ') || 'Recurring project value')}</p></div></section><section class="design-system-card"><header><strong>Source impact</strong><span>Review first</span></header><p>This plan touches <strong>${candidate.occurrenceCount}</strong> exact authored locations across <strong>${new Set(candidate.sources.map((source) => source.file)).size}</strong> files and preserves the current rendered value.</p></section><section class="design-system-card is-wide"><header><strong>Alias resolution</strong><span class="alias-health" data-status="${escapeAttribute(candidate.relation)}">${escapeText(candidate.relation === 'new' ? 'New semantic token' : 'Preserve chain')}</span></header><div class="alias-chain">${chain}</div></section><section class="design-system-card is-wide"><header><strong>Authored occurrences</strong><span>${candidate.sources.length} mapped</span></header><div class="design-usage-list">${sources}</div></section><section class="design-system-card is-action"><footer><p>Nothing changes until this exact source plan is reviewed, applied by the active coding agent, rebuilt, and verified.</p><button class="primary-button" data-stage-token-promotion="${escapeAttribute(candidate.id)}" ${candidate.canStage ? '' : 'disabled'}>Add plan to Review</button></footer></section></div>`;
    }
  } else {
    const visible = tokens
      .filter(
        (item) =>
          (designSystemCategory === 'all' || item.category === designSystemCategory) &&
          `${item.name} ${item.value} ${item.resolvedValue ?? ''} ${item.category}`
            .toLowerCase()
            .includes(query),
      )
      .sort(compareDesignSystemItems);
    if (!tokens.some((item) => item.id === designSystemTokenId)) {
      designSystemTokenId = visible[0]?.id ?? tokens[0]?.id ?? '';
    }
    $('#design-system-token-list').innerHTML = visible.length
      ? visible
          .map((item) => {
            const tokenUsages = usages.filter((usage) => usage.tokenId === item.id);
            const tokenFindings = findings.filter((finding) => finding.tokenIds?.includes(item.id));
            const previewValue = item.resolvedValue ?? item.value;
            const sample =
              item.category === 'color'
                ? `<i class="design-token-swatch" style="--token-color:${escapeAttribute(previewValue)}"></i>`
                : '<i class="design-token-glyph"></i>';
            return `<button class="design-token-row ${item.id === designSystemTokenId ? 'is-active' : ''}" data-system-token="${escapeAttribute(item.id)}">${sample}<span><strong>${escapeText(item.name)}</strong><code>${escapeText(item.value)}</code></span><span class="design-token-count ${tokenFindings.some((finding) => finding.severity === 'warning') || ['broken', 'circular'].includes(item.aliasStatus) ? 'has-warning' : ''}">${tokenUsages.length}</span></button>`;
          })
          .join('')
      : '<div class="empty-inspector">No project tokens match this search.</div>';

    const token = tokens.find((item) => item.id === designSystemTokenId);
    if (!token) {
      detail.innerHTML =
        '<div class="workshop-empty">Index project tokens to map the design system.</div>';
    } else {
      const tokenUsages = usages.filter((usage) => usage.tokenId === token.id);
      const tokenFindings = findings.filter((finding) => finding.tokenIds?.includes(token.id));
      const files = new Set(tokenUsages.map((usage) => usage.source?.file).filter(Boolean));
      const components = new Set(tokenUsages.map((usage) => usage.componentId).filter(Boolean));
      const references = tokenUsages.filter((usage) => usage.kind !== 'literal');
      const aliases = tokenUsages.filter((usage) => usage.kind === 'alias');
      const literalUsages = tokenUsages.filter((usage) => usage.kind === 'literal');
      const previewValue = token.resolvedValue ?? token.value;
      const colorPreview =
        token.category === 'color'
          ? `<span class="design-system-color-preview" style="--token-color:${escapeAttribute(previewValue)}"></span>`
          : '';
      const chain = (token.aliasChain?.length ? token.aliasChain : [token.name])
        .map((name, index) => `${index ? '<i>→</i>' : ''}<code>${escapeText(name)}</code>`)
        .join('');
      const usageMarkup = tokenUsages.length
        ? tokenUsages
            .slice(0, 40)
            .map(
              (usage) =>
                `<article><span class="usage-kind" data-kind="${escapeAttribute(usage.kind)}">${escapeText(usage.kind)}</span><span><strong>${escapeText(usage.property ?? token.name)}</strong><code>${escapeText(sourceText(usage.source))}</code></span><code>${escapeText(usage.value)}</code></article>`,
            )
            .join('')
        : '<p class="design-system-empty">No indexed references. This token may be reserved or loaded dynamically.</p>';
      const findingMarkup = tokenFindings.length
        ? tokenFindings
            .map(
              (finding) =>
                `<article data-severity="${escapeAttribute(finding.severity)}"><i></i><span><strong>${escapeText(finding.title)}</strong><p>${escapeText(finding.detail)}</p><small>${escapeText(finding.evidence?.join(' · ') || 'Project source analysis')}</small></span>${finding.componentIds?.length ? `<button class="secondary-button" data-system-component="${escapeAttribute(finding.componentIds[0])}">Inspect component</button>` : ''}</article>`,
            )
            .join('')
        : '<p class="design-system-empty">This token follows the indexed project system.</p>';
      detail.innerHTML = `<div class="design-system-detail-head"><div><span class="eyebrow">${escapeText(DESIGN_SYSTEM_CATEGORY_LABELS[token.category] ?? 'Project token')}</span><h2>${escapeText(token.name)}</h2><code>${escapeText(token.value)}</code></div>${colorPreview}</div><div class="design-system-grid"><section class="design-system-card"><header><strong>Source of truth</strong><span>${escapeText(token.confidence ?? 'inferred')}</span></header><div class="design-system-source"><code>${escapeText(sourceText(token.source))}</code><p>${escapeText(token.evidence?.join(' · ') || 'Indexed project value')}</p></div></section><section class="design-system-card"><header><strong>Impact preview</strong><span>Read only</span></header><p>Changing this token can affect <strong>${references.length}</strong> indexed references across <strong>${files.size}</strong> files and <strong>${components.size}</strong> mapped components.</p><div class="design-impact-pills"><span>${literalUsages.length} literals</span><span>${aliases.length} aliases</span><span>${tokenFindings.length} findings</span></div></section><section class="design-system-card is-wide"><header><strong>Alias chain</strong><span class="alias-health" data-status="${escapeAttribute(token.aliasStatus ?? 'direct')}">${escapeText(token.aliasStatus ?? 'direct')}</span></header><div class="alias-chain">${chain}${token.resolvedValue ? `<i>=</i><code>${escapeText(token.resolvedValue)}</code>` : ''}</div></section><section class="design-system-card is-wide"><header><strong>Usage trace</strong><span>${tokenUsages.length} indexed</span></header><div class="design-usage-list">${usageMarkup}</div></section><section class="design-system-card is-wide"><header><strong>System guidance</strong><span>${tokenFindings.length ? 'Review suggested' : 'Aligned'}</span></header><div class="design-finding-list">${findingMarkup}</div></section></div>`;
    }
  }

  $$('[data-system-view]').forEach((button) =>
    button.addEventListener('click', () => {
      designSystemView = button.dataset.systemView;
      designSystemCategory = 'all';
      designSystemTokenId = '';
      designSystemPromotionId = '';
      renderDesignSystem();
    }),
  );
  $$('[data-system-category]').forEach((button) =>
    button.addEventListener('click', () => {
      designSystemCategory = button.dataset.systemCategory;
      designSystemTokenId = '';
      designSystemPromotionId = '';
      renderDesignSystem();
    }),
  );
  $$('[data-system-token]').forEach((button) =>
    button.addEventListener('click', () => {
      designSystemTokenId = button.dataset.systemToken;
      renderDesignSystem();
    }),
  );
  $$('[data-system-promotion]').forEach((button) =>
    button.addEventListener('click', () => {
      designSystemPromotionId = button.dataset.systemPromotion;
      renderDesignSystem();
    }),
  );
  $('[data-stage-token-promotion]')?.addEventListener('click', (event) => {
    sendCommand('stage-token-promotion', {
      candidateId: event.currentTarget.dataset.stageTokenPromotion,
    });
  });
  $$('[data-system-component]').forEach((button) =>
    button.addEventListener('click', () => {
      workshopComponentId = button.dataset.systemComponent;
      setMode('components', true, button);
    }),
  );
}

async function loadTypographyGoogleFonts(query = '') {
  typographyGoogleStatus = 'loading';
  if (activeMode === 'typography') renderTypographyStudio();
  try {
    const payload = await api(
      `/v1/sessions/${sessionId}/google-fonts?query=${encodeURIComponent(query)}&limit=60`,
    );
    typographyGoogleFonts = payload.fonts ?? [];
    typographyGoogleStatus = payload.source ?? 'google';
  } catch {
    typographyGoogleFonts = [];
    typographyGoogleStatus = 'error';
  }
  if (activeMode === 'typography') renderTypographyStudio();
}

function typographyControl(property) {
  return (bridgeState?.controls ?? []).find((control) => control.property === property);
}

function typographyChanged(property) {
  const selection = bridgeState?.selection;
  return selection && changedControls.has(`${selection.id}:${property}`) ? ' is-changed' : '';
}

function typographyFontRows(fonts, origin) {
  const query = $('#typography-search')?.value?.trim().toLowerCase() ?? '';
  const filtered = fonts.filter((font) => font.family.toLowerCase().includes(query));
  if (!filtered.length) {
    if (origin === 'google' && typographyGoogleStatus === 'loading')
      return '<div class="typography-studio-empty"><strong>Loading Google Fonts</strong><p>Fetching the current catalog.</p></div>';
    return '<div class="typography-studio-empty"><strong>No matching fonts</strong><p>Try another search or font source.</p></div>';
  }
  return filtered
    .slice(0, 80)
    .map((font) => {
      const index = origin === 'google' ? typographyGoogleFonts.indexOf(font) : -1;
      const activeFamily =
        bridgeState?.typography?.preview?.family ??
        bridgeState?.typography?.selection?.primaryFamily;
      const isActive = activeFamily === font.family;
      const meta =
        origin === 'google'
          ? `${font.category} · ${font.variants?.length ?? 0} styles`
          : `${font.weights?.length ?? 0} weights · ${(font.origins ?? [origin]).join(', ')}`;
      return `<button class="typography-font-row${isActive ? ' is-active' : ''}" data-typography-family="${escapeAttribute(font.family)}" data-typography-origin="${origin}" aria-pressed="${String(isActive)}" ${index >= 0 ? `data-google-index="${index}"` : ''}><span class="typography-font-sample" style="font-family:${escapeAttribute(`&quot;${font.family}&quot;`)}">Ag</span><span><strong>${escapeText(font.family)}</strong><code>${escapeText(meta)}</code></span>${isActive ? '<i data-icon="check"></i>' : ''}</button>`;
    })
    .join('');
}

function renderTypographyStudio() {
  const selection = bridgeState?.selection;
  const typography = bridgeState?.typography;
  const summary = $('#typography-selection-summary');
  const list = $('#typography-font-list');
  const stage = $('#typography-studio-stage');
  const properties = $('#typography-studio-properties');
  if (!summary || !list || !stage || !properties) return;
  $('#typography-studio-status').textContent = selection
    ? `${typography?.metrics?.lineCount ?? 1} lines · ${typography?.metrics?.faceStatus ?? 'unresolved'}`
    : 'Select a text layer';

  if (!selection || !typography) {
    summary.innerHTML =
      '<span class="eyebrow">Selection</span><strong>No text selected</strong><p>Choose a rendered text layer on the canvas first.</p>';
    list.innerHTML = '';
    stage.innerHTML =
      '<div class="typography-studio-empty"><i data-icon="typography"></i><strong>Select a text layer</strong><p>Foundry will reveal its rendered font, rhythm, usage, and source-safe options.</p></div>';
    properties.innerHTML =
      '<div class="typography-studio-empty"><strong>No typography properties</strong></div>';
    renderIcons(stage);
    return;
  }

  typographyScale = { ...typographyScale, ...(typography.scale ?? {}) };
  typographyGoogleSelection = typography.googleSelection ?? typographyGoogleSelection;
  summary.innerHTML = `<span class="eyebrow">Selection</span><strong>${escapeText(selection.label)}</strong><code>${escapeText(typography.selection.primaryFamily)}</code><p>${escapeText(sourceText(selection.source))}</p>`;
  $$('[data-typography-source]').forEach((button) => {
    const active = button.dataset.typographySource === typographySource;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const projectFonts = typography.projectFonts ?? [];
  const localFonts = typographyLocalFonts.map((font) => ({
    family: font.family,
    styles: font.styles,
    weights: [],
    origins: ['local'],
  }));
  list.innerHTML =
    typographySource === 'google'
      ? typographyFontRows(typographyGoogleFonts, 'google')
      : typographySource === 'local'
        ? `${typography.capabilities?.localFontAccess ? '<button class="secondary-button typography-local-access" id="typography-local-access">Read installed fonts</button>' : '<p class="typography-source-note">This browser does not expose local font access.</p>'}${typographyFontRows(localFonts, 'local')}`
        : typographyFontRows(projectFonts, 'project');
  renderIcons(list);

  const specimen = typography.selection.text || selection.label;
  const treatments = typography.treatments ?? [];
  const usages = typography.usages ?? [];
  stage.innerHTML = `<div class="typography-specimen"><header><span class="eyebrow">Live specimen</span><span>${escapeText(typography.selection.size)} / ${escapeText(typography.selection.lineHeight)}</span></header><div class="typography-specimen-text" style="font-family:${escapeAttribute(typography.selection.family)};font-weight:${escapeAttribute(typography.selection.weight)};font-style:${escapeAttribute(typography.selection.style)};font-size:${escapeAttribute(typography.selection.size)};line-height:${escapeAttribute(typography.selection.lineHeight)};letter-spacing:${escapeAttribute(typography.selection.letterSpacing)}">${escapeText(specimen)}</div></div><section class="typography-treatment-panel"><header><div><span class="eyebrow">Rhythm</span><strong>Type treatments</strong></div><button class="secondary-button compact" data-typography-action="reset-preview">Reset preview</button></header><div class="typography-treatment-grid">${treatments.map((treatment) => `<button data-treatment-id="${escapeAttribute(treatment.id)}" aria-pressed="${String(typography.preview?.treatmentId === treatment.id)}"><strong>${escapeText(treatment.label)}</strong><span>${escapeText(treatment.detail)}</span></button>`).join('')}</div><div class="typography-scale-panel"><label><span>Base size</span><input id="typography-scale-base" type="range" min="8" max="128" step="4" value="${Number(typographyScale.base)}"><output>${Number(typographyScale.base)}px</output></label><div class="typography-scale-options"><span>Ratio</span>${[1.125, 1.2, 1.25, 1.333].map((ratio) => `<button data-scale-ratio="${ratio}" aria-pressed="${String(Number(typographyScale.ratio) === ratio)}">${ratio}</button>`).join('')}</div><div class="typography-scale-options"><span>Step</span>${[-1, 0, 1, 2, 3].map((step) => `<button data-scale-step="${step}" aria-pressed="${String(Number(typographyScale.step) === step)}">${step > 0 ? '+' : ''}${step}</button>`).join('')}</div><div class="typography-scale-result"><code>${escapeText(typography.scale?.value ?? typography.selection.size)}</code><button data-scale-fluid aria-pressed="${String(Boolean(typographyScale.fluid))}">${typographyScale.fluid ? 'Fluid' : 'Fixed'}</button><button class="primary-button compact" data-preview-scale>Preview scale</button></div></div></section><section class="typography-usage-panel"><header><strong>Project usage</strong><span>${usages.reduce((total, usage) => total + usage.count, 0)} text nodes</span></header><div>${usages
    .slice(0, 6)
    .map(
      (usage) =>
        `<article><span class="typography-font-sample" style="font-family:${escapeAttribute(usage.family)}">Ag</span><span><strong>${escapeText(usage.family)}</strong><code>${usage.count} uses · ${escapeText(usage.weights.join(', '))}</code></span></article>`,
    )
    .join('')}</div></section>`;

  const diagnosticMarkup = typography.diagnostics?.length
    ? typography.diagnostics
        .map(
          (finding) =>
            `<article data-severity="${escapeAttribute(finding.severity)}"><i></i><span><strong>${escapeText(finding.title)}</strong><p>${escapeText(finding.detail)}</p></span></article>`,
        )
        .join('')
    : '<article class="is-clear"><i></i><span><strong>Rendered type is stable</strong><p>The active face and wrapping pass at this viewport.</p></span></article>';
  const controlField = (property, label) => {
    const control = typographyControl(property);
    return control
      ? `<label class="${typographyChanged(property)}"><span>${label}</span><input data-typography-control="${property}" value="${escapeAttribute(control.value)}"></label>`
      : '';
  };
  const strategies = typography.strategies ?? [];
  const savedStyles = typography.savedStyles ?? [];
  properties.innerHTML = `<div class="typography-properties-head"><span class="eyebrow">Typography</span><strong>Selection properties</strong><code>${escapeText(typography.selection.primaryFamily)}</code></div><section class="typography-rendered-section"><header><strong>Rendered values</strong><code>Computed from canvas</code></header><div class="typography-property-fields">${controlField('fontFamily', 'Font family')}${controlField('fontWeight', 'Weight')}${controlField('fontStyle', 'Style')}${controlField('fontSize', 'Size')}${controlField('lineHeight', 'Line height')}${controlField('letterSpacing', 'Tracking')}${controlField('fontVariationSettings', 'Variable axes')}</div></section><section class="typography-audit"><header><strong>Type health</strong><span>${typography.metrics.charactersPerLine} chars/line</span></header>${diagnosticMarkup}</section>${typographyGoogleSelection ? `<section class="typography-google-review"><header><strong>${escapeText(typographyGoogleSelection.font.family)}</strong><span>Google Fonts preview</span></header><label><span>Add to source</span><select id="typography-google-strategy">${strategies.map((strategy) => `<option value="${strategy.id}" ${strategy.id === typographyGoogleStrategy ? 'selected' : ''}>${escapeText(strategy.label)}</option>`).join('')}</select></label><button class="primary-button" id="typography-review-google">Add font to review</button></section>` : ''}<section class="typography-saved-styles"><header><strong>Project styles</strong><span>${savedStyles.length} saved</span></header><label><span>Style name</span><input id="typography-style-name" placeholder="Display / Balanced"></label><button class="secondary-button" id="typography-save-style" ${typography.preview ? '' : 'disabled'}>Save current preview</button><div>${savedStyles.map((style) => `<article><span><strong>${escapeText(style.name)}</strong><code>${escapeText(style.values.fontSize)} · ${escapeText(style.values.lineHeight)}</code></span><button data-apply-style="${escapeAttribute(style.id)}" aria-label="Apply ${escapeAttribute(style.name)}"><i data-icon="check"></i></button><button data-remove-style="${escapeAttribute(style.id)}" aria-label="Remove ${escapeAttribute(style.name)}"><i data-icon="bin"></i></button></article>`).join('')}</div></section>`;
  renderIcons(properties);
  upgradeSelects(properties);

  $$('[data-typography-family]', list).forEach((button) =>
    button.addEventListener('click', () => {
      const origin = button.dataset.typographyOrigin;
      if (origin === 'google') {
        const font = typographyGoogleFonts[Number(button.dataset.googleIndex)];
        if (font) sendCommand('typography-action', { action: 'preview-google', font });
      } else {
        sendCommand('typography-action', {
          action: 'preview-family',
          family: button.dataset.typographyFamily,
          origin,
        });
      }
    }),
  );
  $('#typography-local-access')?.addEventListener('click', async () => {
    try {
      const fonts = await window.queryLocalFonts();
      const grouped = new Map();
      for (const font of fonts) {
        const record = grouped.get(font.family) ?? {
          family: font.family,
          styles: [],
        };
        if (font.style && !record.styles.includes(font.style)) record.styles.push(font.style);
        grouped.set(font.family, record);
      }
      typographyLocalFonts = [...grouped.values()].sort((a, b) => a.family.localeCompare(b.family));
      renderTypographyStudio();
    } catch {
      toast('Local font access was not allowed.');
    }
  });
  $$('[data-treatment-id]', stage).forEach((button) =>
    button.addEventListener('click', () =>
      sendCommand('typography-action', {
        action: 'preview-treatment',
        treatmentId: button.dataset.treatmentId,
      }),
    ),
  );
  $('[data-typography-action="reset-preview"]', stage)?.addEventListener('click', () =>
    sendCommand('typography-action', { action: 'reset-preview' }),
  );
  $$('[data-scale-ratio]', stage).forEach((button) =>
    button.addEventListener('click', () => {
      typographyScale.ratio = Number(button.dataset.scaleRatio);
      renderTypographyStudio();
    }),
  );
  $$('[data-scale-step]', stage).forEach((button) =>
    button.addEventListener('click', () => {
      typographyScale.step = Number(button.dataset.scaleStep);
      renderTypographyStudio();
    }),
  );
  $('[data-scale-fluid]', stage)?.addEventListener('click', () => {
    typographyScale.fluid = !typographyScale.fluid;
    renderTypographyStudio();
  });
  $('#typography-scale-base')?.addEventListener('input', (event) => {
    typographyScale.base = Number(event.target.value);
    event.target
      .closest('label')
      ?.querySelector('output')
      ?.replaceChildren(`${typographyScale.base}px`);
  });
  $('[data-preview-scale]', stage)?.addEventListener('click', () =>
    sendCommand('typography-action', {
      action: 'preview-scale',
      ...typographyScale,
    }),
  );
  $$('[data-typography-control]', properties).forEach((field) => {
    let previous = field.value;
    const commit = () => {
      if (field.value === previous) return;
      previous = field.value;
      const property = field.dataset.typographyControl;
      changedControls.add(`${selection.id}:${property}`);
      field.closest('label')?.classList.add('is-changed');
      sendCommand('set-control', { property, value: field.value });
    };
    field.addEventListener('change', commit);
    field.addEventListener('blur', commit);
  });
  $('#typography-google-strategy')?.addEventListener('change', (event) => {
    typographyGoogleStrategy = event.target.value;
  });
  $('#typography-review-google')?.addEventListener('click', () =>
    sendCommand('typography-action', {
      action: 'review-google',
      strategy: typographyGoogleStrategy,
      weight: typographyGoogleSelection.weight,
      style: typographyGoogleSelection.style,
    }),
  );
  $('#typography-save-style')?.addEventListener('click', () =>
    sendCommand('typography-action', {
      action: 'save-style',
      name: $('#typography-style-name').value,
    }),
  );
  $$('[data-apply-style]', properties).forEach((button) =>
    button.addEventListener('click', () =>
      sendCommand('typography-action', {
        action: 'apply-style',
        styleId: button.dataset.applyStyle,
      }),
    ),
  );
  $$('[data-remove-style]', properties).forEach((button) =>
    button.addEventListener('click', () =>
      sendCommand('typography-action', {
        action: 'remove-style',
        styleId: button.dataset.removeStyle,
      }),
    ),
  );
}

function motionSourceLabel(kind) {
  if (kind === 'css-animation') return 'CSS animation';
  if (kind === 'css-transition') return 'CSS transition';
  if (kind === 'motion-react' || kind === 'motion') return 'Motion for React';
  if (kind === 'gsap') return 'GSAP';
  if (kind === 'react-spring') return 'React Spring';
  return 'Web animation';
}

function renderNativeMotionSource(motion) {
  const authoring = motion.authoring;
  if (!authoring?.adapter) return '';
  const properties = Object.entries(authoring.sourceProperties ?? {})
    .filter(([, value]) => value)
    .map(
      ([property, value]) =>
        `<span><small>${escapeText(property)}</small><code>${escapeText(value)}</code></span>`,
    )
    .join('');
  const source = authoring.source
    ? `${authoring.source.file}:${authoring.source.line ?? 1}`
    : 'Runtime registration';
  return `<section class="motion-native-source" data-native-adapter="${escapeAttribute(authoring.adapter)}"><header><span><span class="eyebrow">Source adapter</span><strong>${escapeText(authoring.label ?? motionSourceLabel(motion.kind))}</strong></span><span class="motion-source-chip">Project native</span></header><code class="motion-native-location" title="${escapeAttribute(source)}">${escapeText(source)}</code><div class="motion-native-properties">${properties}</div><footer><i data-icon="check"></i><span>Edits retain the library's source-property semantics for review and Apply with agent.</span></footer></section>`;
}

function motionStudioChanged(selection, motion, property) {
  return changedControls.has(`${selection.id}:motion.${motion.id}.${property}`)
    ? ' is-changed'
    : '';
}

function motionCurvePath(points = []) {
  if (!points.length) return '';
  const width = 240;
  const height = 156;
  const padding = 16;
  const x = (value) => padding + Number(value) * (width - padding * 2);
  const y = (value) =>
    padding +
    (1 - (Math.max(-0.25, Math.min(1.25, Number(value))) + 0.25) / 1.5) * (height - padding * 2);
  return points
    .map((point, index) => `${index ? 'L' : 'M'} ${x(point.x).toFixed(2)} ${y(point.y).toFixed(2)}`)
    .join(' ');
}

function motionCurvePoint(value, axis) {
  const padding = 16;
  if (axis === 'x') return padding + Number(value) * 208;
  return padding + (1 - (Math.max(-0.25, Math.min(1.25, Number(value))) + 0.25) / 1.5) * 124;
}

function motionBezierPoints(curve) {
  return Array.from({ length: 61 }, (_, index) => {
    const t = index / 60;
    const inverse = 1 - t;
    return {
      x: 3 * inverse * inverse * t * curve.x1 + 3 * inverse * t * t * curve.x2 + t * t * t,
      y: 3 * inverse * inverse * t * curve.y1 + 3 * inverse * t * t * curve.y2 + t * t * t,
    };
  });
}

function motionCurvePayload(editor) {
  const values = Object.fromEntries(
    $$('[data-curve-field]', editor).map((field) => [
      field.dataset.curveField,
      Number(field.value),
    ]),
  );
  return {
    kind: editor.dataset.curveKind === 'spring' ? 'spring' : 'cubic-bezier',
    ...values,
  };
}

function commitMotionCurve(editor) {
  const payload = motionCurvePayload(editor);
  sendCommand('motion-action', {
    id: editor.dataset.motionId,
    action: 'curve',
    ...payload,
  });
}

function updateBezierEditorPreview(editor) {
  const curve = motionCurvePayload(editor);
  if (curve.kind !== 'cubic-bezier') return;
  const path = $('.motion-curve-line', editor);
  if (path) path.setAttribute('d', motionCurvePath(motionBezierPoints(curve)));
  [1, 2].forEach((index) => {
    const x = curve[`x${index}`];
    const y = curve[`y${index}`];
    const handle = $(`[data-curve-handle="${index}"]`, editor);
    const line = $(`.motion-curve-handle-line:nth-of-type(${index})`, editor);
    handle?.setAttribute('cx', motionCurvePoint(x, 'x'));
    handle?.setAttribute('cy', motionCurvePoint(y, 'y'));
    handle?.setAttribute('aria-valuetext', `${Number(x).toFixed(2)}, ${Number(y).toFixed(2)}`);
    line?.setAttribute('x2', motionCurvePoint(x, 'x'));
    line?.setAttribute('y2', motionCurvePoint(y, 'y'));
  });
}

function motionPathGeometry(paths = []) {
  const all = paths.flatMap((path) => path?.points ?? []);
  const minX = Math.min(0, ...all.map((point) => Number(point.x) || 0));
  const maxX = Math.max(0, ...all.map((point) => Number(point.x) || 0));
  const minY = Math.min(0, ...all.map((point) => Number(point.y) || 0));
  const maxY = Math.max(0, ...all.map((point) => Number(point.y) || 0));
  const width = maxX - minX;
  const height = maxY - minY;
  const spanX = Math.max(24, width);
  const spanY = Math.max(24, height);
  const scale = Math.min(400 / spanX, 180 / spanY, 6);
  const originX = 40 + (400 - width * scale) / 2;
  const originY = 220 - (180 - height * scale) / 2;
  return {
    minX,
    minY,
    scale,
    originX,
    originY,
    x: (value) => originX + (Number(value) - minX) * scale,
    y: (value) => originY - (Number(value) - minY) * scale,
    sourceX: (value) => minX + (Number(value) - originX) / scale,
    sourceY: (value) => minY + (originY - Number(value)) / scale,
  };
}

function motionPathSvg(path, geometry) {
  return (path?.points ?? [])
    .map(
      (point, index) =>
        `${index ? 'L' : 'M'} ${geometry.x(point.x).toFixed(2)} ${geometry.y(point.y).toFixed(2)}`,
    )
    .join(' ');
}

function motionPathSample(path, progress) {
  const points = path?.points ?? [];
  if (!points.length) return { x: 0, y: 0 };
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  const following = points.find((point) => Number(point.offset) >= clamped) ?? points.at(-1);
  const followingIndex = points.indexOf(following);
  const previous = points[Math.max(0, followingIndex - 1)] ?? following;
  const range = Math.max(0.0001, Number(following.offset) - Number(previous.offset));
  const local = Math.max(0, Math.min(1, (clamped - Number(previous.offset)) / range));
  return {
    x: Number(previous.x) + (Number(following.x) - Number(previous.x)) * local,
    y: Number(previous.y) + (Number(following.y) - Number(previous.y)) * local,
  };
}

function motionCurveSample(curve, progress) {
  const points = curve?.points ?? [];
  if (!points.length) return progress;
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  const following = points.find((point) => Number(point.x) >= clamped) ?? points.at(-1);
  const followingIndex = points.indexOf(following);
  const previous = points[Math.max(0, followingIndex - 1)] ?? following;
  const range = Math.max(0.0001, Number(following.x) - Number(previous.x));
  const local = Math.max(0, Math.min(1, (clamped - Number(previous.x)) / range));
  return Number(previous.y) + (Number(following.y) - Number(previous.y)) * local;
}

function renderMotionPathEditor(selection, motion, disabled) {
  const path = motion.path;
  if (!path?.supported) {
    return `<section class="motion-path-editor is-unavailable"><header><span><strong>Motion path</strong><code>Transform keyframes</code></span></header><p>${escapeText(path?.reason ?? 'This motion does not expose an editable pixel path.')}</p></section>`;
  }
  const geometry = motionPathGeometry([path]);
  const handles = path.points
    .map(
      (point) =>
        `<circle class="motion-path-handle" data-path-point="${point.index}" tabindex="0" role="slider" aria-label="Motion path keyframe ${point.index + 1}" aria-valuetext="${point.x}px, ${point.y}px" cx="${geometry.x(point.x)}" cy="${geometry.y(point.y)}" r="7"></circle>`,
    )
    .join('');
  const fields = path.points
    .map(
      (point) =>
        `<div class="motion-path-row" data-path-row="${point.index}" data-path-offset="${point.offset}"><span><strong>${Math.round(Number(point.offset) * 100)}%</strong><code>Keyframe ${point.index + 1}</code></span><label>X<input data-path-field="x" type="number" step="1" value="${point.x}" ${disabled}></label><label>Y<input data-path-field="y" type="number" step="1" value="${point.y}" ${disabled}></label></div>`,
    )
    .join('');
  return `<section class="motion-path-editor${motionStudioChanged(selection, motion, 'path')}"><header><span><strong>Motion path</strong><code>${path.points.length} transform points · ${Math.round(Number(path.distance))} px travel</code></span><span class="motion-path-size">${Math.round(Number(path.bounds.width))} × ${Math.round(Number(path.bounds.height))} px</span></header><div class="motion-path-graph" data-min-x="${geometry.minX}" data-min-y="${geometry.minY}" data-scale="${geometry.scale}" data-origin-x="${geometry.originX}" data-origin-y="${geometry.originY}"><svg viewBox="0 0 480 260" role="img" aria-label="Editable transform motion path"><path class="motion-path-grid" d="M40 40V220M140 40V220M240 40V220M340 40V220M440 40V220M40 40H440M40 100H440M40 160H440M40 220H440"></path><path class="motion-path-line" d="${motionPathSvg(path, geometry)}"></path>${handles}</svg></div><div class="motion-path-fields">${fields}</div><footer><span>Drag points or enter exact coordinates</span><code>transform</code></footer></section>`;
}

function renderMotionComparison(motion) {
  const comparison = motion.comparison;
  const before = comparison?.before;
  const after = comparison?.after;
  if (!before?.path?.supported || !after?.path?.supported) return '';
  const geometry = motionPathGeometry([before.path, after.path]);
  const beforeStart = motionPathSample(before.path, 0);
  const afterStart = motionPathSample(after.path, 0);
  const changed = Boolean(comparison.changed);
  return `<section class="motion-comparison${changed ? ' is-changed' : ''}" data-comparison-motion="${escapeAttribute(motion.id)}"><header><span><span class="eyebrow">Synchronized comparison</span><strong>Before and after</strong></span><span class="motion-comparison-state">${changed ? 'Preview differs' : 'No preview changes'}</span></header><div class="motion-comparison-stage"><svg viewBox="0 0 480 260" role="img" aria-label="Before and after motion paths"><path class="motion-path-grid" d="M40 40V220M140 40V220M240 40V220M340 40V220M440 40V220M40 40H440M40 100H440M40 160H440M40 220H440"></path><path class="motion-comparison-path is-before" d="${motionPathSvg(before.path, geometry)}"></path><path class="motion-comparison-path is-after" d="${motionPathSvg(after.path, geometry)}"></path><circle class="motion-comparison-dot is-before" data-comparison-dot="before" cx="${geometry.x(beforeStart.x)}" cy="${geometry.y(beforeStart.y)}" r="7"></circle><circle class="motion-comparison-dot is-after" data-comparison-dot="after" cx="${geometry.x(afterStart.x)}" cy="${geometry.y(afterStart.y)}" r="7"></circle></svg><div class="motion-comparison-legend"><span><i class="is-before"></i>Before</span><span><i class="is-after"></i>After</span></div></div><div class="motion-comparison-controls"><button class="icon-button" data-comparison-action="replay" aria-label="Replay synchronized comparison"><i data-icon="undo"></i></button><button class="primary-button compact" data-comparison-action="play">Play together</button><input data-comparison-scrub type="range" min="0" max="1000" step="1" value="0" aria-label="Scrub synchronized comparison"><output>0%</output></div><div class="motion-comparison-diagnostics"><span><small>Duration</small><strong>${Math.round(Number(comparison.diagnostics?.durationDelta) || 0) >= 0 ? '+' : ''}${Math.round(Number(comparison.diagnostics?.durationDelta) || 0)} ms</strong></span><span><small>Travel</small><strong>${Math.round(Number(comparison.diagnostics?.distanceDelta) || 0) >= 0 ? '+' : ''}${Math.round(Number(comparison.diagnostics?.distanceDelta) || 0)} px</strong></span><span><small>Keyframes</small><strong>${Number(comparison.diagnostics?.pointDelta) >= 0 ? '+' : ''}${Number(comparison.diagnostics?.pointDelta) || 0}</strong></span></div></section>`;
}

function renderMotionCurveEditor(selection, motion, disabled) {
  const curve = motion.curve ?? {
    kind: 'custom',
    sourceValue: motion.timing?.easing ?? 'linear',
    points: [],
    diagnostics: {},
  };
  const isSpring = curve.kind === 'spring';
  const isBezier = curve.kind === 'cubic-bezier';
  const cubic = curve.cubicBezier ?? { x1: 0.2, y1: 0.8, x2: 0.2, y2: 1 };
  const spring = curve.spring ?? {
    mass: 1,
    stiffness: 170,
    damping: 26,
    velocity: 0,
  };
  const fields = isSpring
    ? [
        ['mass', 'Mass', spring.mass, 0.1, 20, 0.1],
        ['stiffness', 'Stiffness', spring.stiffness, 1, 2000, 1],
        ['damping', 'Damping', spring.damping, 0.1, 200, 0.1],
        ['velocity', 'Velocity', spring.velocity, -20, 20, 0.1],
      ]
        .map(
          ([property, label, value, min, max, step]) =>
            `<label><span>${label}</span><input data-curve-field="${property}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" ${disabled}></label>`,
        )
        .join('')
    : [
        ['x1', 'X1', cubic.x1, 0, 1],
        ['y1', 'Y1', cubic.y1, -2, 3],
        ['x2', 'X2', cubic.x2, 0, 1],
        ['y2', 'Y2', cubic.y2, -2, 3],
      ]
        .map(
          ([property, label, value, min, max]) =>
            `<label><span>${label}</span><input data-curve-field="${property}" type="number" min="${min}" max="${max}" step="0.01" value="${value}" ${disabled}></label>`,
        )
        .join('');
  const presets = isSpring
    ? [
        ['gentle', 'Gentle', 1, 120, 20, 0],
        ['responsive', 'Responsive', 1, 210, 24, 0],
        ['expressive', 'Expressive', 0.8, 260, 18, 0],
      ]
        .map(
          ([id, label, mass, stiffness, damping, velocity]) =>
            `<button type="button" class="motion-curve-preset" data-curve-preset="${id}" data-mass="${mass}" data-stiffness="${stiffness}" data-damping="${damping}" data-velocity="${velocity}" ${disabled}>${label}</button>`,
        )
        .join('')
    : [
        ['linear', 'Linear', 0, 0, 1, 1],
        ['ease-out', 'Ease out', 0.16, 1, 0.3, 1],
        ['ease-in-out', 'Ease in out', 0.65, 0, 0.35, 1],
      ]
        .map(
          ([id, label, x1, y1, x2, y2]) =>
            `<button type="button" class="motion-curve-preset" data-curve-preset="${id}" data-x1="${x1}" data-y1="${y1}" data-x2="${x2}" data-y2="${y2}" ${disabled}>${label}</button>`,
        )
        .join('');
  const handles = isBezier
    ? `<line class="motion-curve-handle-line" x1="16" y1="${motionCurvePoint(0, 'y')}" x2="${motionCurvePoint(cubic.x1, 'x')}" y2="${motionCurvePoint(cubic.y1, 'y')}"></line><line class="motion-curve-handle-line" x1="224" y1="${motionCurvePoint(1, 'y')}" x2="${motionCurvePoint(cubic.x2, 'x')}" y2="${motionCurvePoint(cubic.y2, 'y')}"></line><circle class="motion-curve-handle" data-curve-handle="1" tabindex="0" role="slider" aria-label="First cubic Bezier handle" aria-valuetext="${cubic.x1}, ${cubic.y1}" cx="${motionCurvePoint(cubic.x1, 'x')}" cy="${motionCurvePoint(cubic.y1, 'y')}" r="7"></circle><circle class="motion-curve-handle" data-curve-handle="2" tabindex="0" role="slider" aria-label="Second cubic Bezier handle" aria-valuetext="${cubic.x2}, ${cubic.y2}" cx="${motionCurvePoint(cubic.x2, 'x')}" cy="${motionCurvePoint(cubic.y2, 'y')}" r="7"></circle>`
    : '';
  const duration = Math.max(
    120,
    Number(curve.diagnostics?.duration) || Number(motion.timing?.duration) || 480,
  );
  const sourceLabel = isSpring
    ? `CSS linear() · ${curve.diagnostics?.sampleCount ?? 31} stops`
    : isBezier
      ? 'CSS cubic-bezier()'
      : 'Authored easing';
  return `<section class="motion-curve-editor${motionStudioChanged(selection, motion, 'easing')}" data-curve-kind="${escapeAttribute(curve.kind)}" data-motion-id="${escapeAttribute(motion.id)}"><header><span><strong>Timing curve</strong><code>${sourceLabel}</code></span><div class="motion-curve-tabs" role="tablist" aria-label="Timing curve type"><button type="button" role="tab" aria-selected="${!isSpring}" class="${!isSpring ? 'is-active' : ''}" data-curve-kind-select="cubic-bezier" ${disabled}>Bézier</button><button type="button" role="tab" aria-selected="${isSpring}" class="${isSpring ? 'is-active' : ''}" data-curve-kind-select="spring" ${disabled}>Spring</button></div></header><div class="motion-curve-graph"><svg viewBox="0 0 240 156" role="img" aria-label="${isSpring ? 'Spring response curve' : 'Cubic Bezier timing curve'}"><path class="motion-curve-grid" d="M16 16V140M68 16V140M120 16V140M172 16V140M224 16V140M16 37H224M16 78H224M16 119H224M16 140H224"></path><path class="motion-curve-line" d="${motionCurvePath(curve.points)}"></path>${handles}</svg><div class="motion-curve-preview"><span class="motion-curve-preview-dot" style="--curve-duration:${duration}ms;--curve-easing:${escapeAttribute(curve.previewValue ?? curve.sourceValue)}"></span></div></div><div class="motion-curve-presets" aria-label="Curve presets">${presets}</div><div class="motion-curve-fields">${fields}</div><div class="motion-curve-diagnostics"><span><small>${isSpring ? 'Settle' : 'Duration'}</small><strong>${isSpring ? `${Math.round(duration)} ms` : `${Math.round(Number(motion.timing?.duration) || 0)} ms`}</strong></span><span><small>Overshoot</small><strong>${Number(curve.diagnostics?.overshoot ?? 0).toFixed(1)}%</strong></span><button type="button" class="chip-button" data-curve-preview ${disabled}>Preview curve</button></div><div class="motion-curve-source"><span>Source value</span><code title="${escapeAttribute(curve.sourceValue)}">${escapeText(curve.sourceValue)}</code></div></section>`;
}

function renderMotionStudio() {
  if (motionComparisonFrame) {
    cancelAnimationFrame(motionComparisonFrame);
    motionComparisonFrame = 0;
  }
  const selection = bridgeState?.selection;
  const motions = bridgeState?.motions ?? [];
  const summary = $('#motion-selection-summary');
  const list = $('#motion-studio-list');
  const stage = $('#motion-studio-stage');
  const properties = $('#motion-studio-properties');
  $('#motion-studio-status').textContent = selection
    ? `${motions.length} ${motions.length === 1 ? 'motion' : 'motions'} detected`
    : 'Select a moving layer';

  if (!selection) {
    summary.innerHTML =
      '<span class="eyebrow">Selection</span><strong>No layer selected</strong><p>Choose a rendered layer on the canvas first.</p>';
    list.innerHTML = '';
    stage.innerHTML =
      '<div class="motion-studio-empty"><i data-icon="play"></i><strong>Select a moving layer</strong><p>Foundry will reveal CSS, Web Animations, Motion for React, GSAP, and React Spring motion.</p></div>';
    properties.innerHTML =
      '<div class="motion-studio-empty"><strong>No motion properties</strong></div>';
    renderIcons(stage);
    return;
  }

  summary.innerHTML = `<span class="eyebrow">Selection</span><strong>${escapeText(selection.label)}</strong><code>${escapeText(sourceText(selection.source))}</code>`;
  if (!motions.some((motion) => motion.id === motionStudioId))
    motionStudioId = motions[0]?.id ?? '';
  list.innerHTML = motions.length
    ? motions
        .map(
          (motion) =>
            `<button class="motion-studio-row ${motion.id === motionStudioId ? 'is-active' : ''}" data-motion-studio-select="${escapeAttribute(motion.id)}"><i data-icon="play"></i><span><strong>${escapeText(motion.label)}</strong><code>${escapeText(motionSourceLabel(motion.kind))} · ${Math.round(Number(motion.timing?.duration) || 0)} ms</code></span><span class="motion-cost" data-tier="${escapeAttribute(motion.performance?.tier ?? 'unknown')}">${escapeText(motion.performance?.label ?? 'Unresolved')}</span></button>`,
        )
        .join('')
    : '<div class="motion-studio-empty"><strong>No motion detected</strong><p>Trigger the interaction in Interact mode, then return here while it is active.</p></div>';
  renderIcons(list);

  const motion = motions.find((candidate) => candidate.id === motionStudioId);
  if (!motion) {
    stage.innerHTML =
      '<div class="motion-studio-empty"><i data-icon="play"></i><strong>No live animation</strong><p>Motion appears here when the selected layer exposes an animation.</p></div>';
    properties.innerHTML =
      '<div class="motion-studio-empty"><strong>No motion properties</strong></div>';
    renderIcons(stage);
    return;
  }

  const timing = motion.timing ?? {};
  const duration = Math.max(1, Number(timing.duration) || 1000);
  const currentTime = Math.min(duration, Math.max(0, Number(motion.currentTime) || 0));
  const keyframes = Array.isArray(motion.keyframes) ? motion.keyframes : [];
  const trackProperties = [
    ...new Set(keyframes.flatMap((frame) => Object.keys(frame.values ?? {}))),
  ];
  const selectedKey = selectedMotionKeyframes.get(motion.id);
  const selectedProperty = trackProperties.includes(selectedKey?.property)
    ? selectedKey.property
    : trackProperties[0];
  const selectedFrame =
    keyframes.find(
      (frame) => frame.index === selectedKey?.index && frame.values?.[selectedProperty] != null,
    ) ?? keyframes.find((frame) => frame.values?.[selectedProperty] != null);
  if (selectedFrame && selectedProperty)
    selectedMotionKeyframes.set(motion.id, {
      index: selectedFrame.index,
      property: selectedProperty,
    });
  const tracks = trackProperties.length
    ? trackProperties
        .map(
          (property) =>
            `<div class="motion-studio-track"><code>${escapeText(property)}</code><div class="motion-studio-rail">${keyframes
              .filter((frame) => frame.values?.[property] != null)
              .map(
                (frame) =>
                  `<button type="button" class="motion-keyframe${selectedFrame?.index === frame.index && selectedProperty === property ? ' is-selected' : ''}" data-studio-keyframe-index="${frame.index}" data-studio-keyframe-property="${escapeAttribute(property)}" style="--keyframe-offset:${Math.round(Number(frame.offset) * 10000) / 100}%" aria-label="Edit ${escapeAttribute(property)} keyframe at ${Math.round(Number(frame.offset) * 100)} percent"></button>`,
              )
              .join('')}</div></div>`,
        )
        .join('')
    : '<div class="motion-studio-empty is-compact"><strong>No editable keyframes</strong><p>The live animation exposes timing but not a multi-keyframe track.</p></div>';
  const speedOptions = [
    [0.1, '10%'],
    [0.25, '25%'],
    [0.5, '50%'],
    [1, '100%'],
    [2, '200%'],
  ]
    .map(
      ([rate, label]) =>
        `<option value="${rate}" ${Math.abs(Number(motion.playbackRate ?? 1) - rate) < 0.001 ? 'selected' : ''}>${label}</option>`,
    )
    .join('');
  const disabled = motion.active ? '' : 'disabled';
  stage.innerHTML = `<div class="motion-studio-canvas" data-motion-id="${escapeAttribute(motion.id)}"><header class="motion-studio-canvas-head"><div><span class="eyebrow">Timeline</span><h2>${escapeText(motion.label)}</h2><p>${escapeText(motion.properties?.join(', ') || 'Properties appear when the transition runs')}</p></div><span class="motion-source-chip">${escapeText(motionSourceLabel(motion.kind))}</span></header><div class="motion-studio-transport"><button class="icon-button" data-studio-action="replay" aria-label="Replay motion" ${disabled}><i data-icon="undo"></i></button><button class="primary-button compact" data-studio-action="toggle" ${disabled}>${motion.playState === 'paused' ? 'Play' : 'Pause'}</button><button class="chip-button ${motion.looping ? 'is-active' : ''}" data-studio-action="loop" ${disabled}>Loop</button><select data-studio-action="speed" aria-label="Preview speed" ${disabled}>${speedOptions}</select><output>${Math.round(currentTime)} / ${Math.round(duration)} ms</output></div><div class="motion-studio-scrubber"><input data-studio-action="scrub" type="range" min="0" max="${duration}" step="1" value="${currentTime}" aria-label="Scrub ${escapeAttribute(motion.label)}" ${disabled}><div class="motion-studio-ruler"><span>0</span><span>25%</span><span>50%</span><span>75%</span><span>${Math.round(duration)} ms</span></div></div><div class="motion-studio-tracks">${tracks}</div>${renderMotionComparison(motion)}</div>`;
  renderIcons(stage);
  upgradeSelects(stage);

  const selectedValue = selectedFrame?.values?.[selectedProperty] ?? '';
  const keyframePath = selectedFrame ? `keyframe.${selectedFrame.index}` : '';
  const directionOptions = ['normal', 'reverse', 'alternate', 'alternate-reverse'];
  const fillOptions = ['none', 'forwards', 'backwards', 'both', 'auto'];
  properties.innerHTML = `<div class="motion-properties-head"><span class="eyebrow">Motion</span><strong>Animation properties</strong><code>${escapeText(motion.performance?.detail ?? 'Performance not classified')}</code></div>${renderNativeMotionSource(motion)}<section class="motion-timing-section"><header><strong>Playback timing</strong><code>Authored values</code></header><div class="motion-studio-fields" data-motion-id="${escapeAttribute(motion.id)}"><label class="${motionStudioChanged(selection, motion, 'duration')}"><span>Duration</span><span class="motion-field-with-unit"><input data-studio-property="duration" type="number" min="0" step="10" value="${Math.round(Number(timing.duration) || 0)}" ${disabled}><i>ms</i></span></label><label class="${motionStudioChanged(selection, motion, 'delay')}"><span>Delay</span><span class="motion-field-with-unit"><input data-studio-property="delay" type="number" step="10" value="${Math.round(Number(timing.delay) || 0)}" ${disabled}><i>ms</i></span></label><label class="is-wide${motionStudioChanged(selection, motion, 'easing')}"><span>Easing</span><input data-studio-property="easing" type="text" value="${escapeAttribute(timing.easing ?? 'linear')}" ${disabled}></label><label class="${motionStudioChanged(selection, motion, 'iterations')}"><span>Iterations</span><input data-studio-property="iterations" type="number" min="0" step="1" value="${Number.isFinite(Number(timing.iterations)) ? Number(timing.iterations) : 1}" ${disabled}></label><label class="${motionStudioChanged(selection, motion, 'direction')}"><span>Direction</span><select data-studio-property="direction" ${disabled}>${directionOptions.map((value) => `<option value="${value}" ${timing.direction === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="is-wide${motionStudioChanged(selection, motion, 'fill')}"><span>Fill</span><select data-studio-property="fill" ${disabled}>${fillOptions.map((value) => `<option value="${value}" ${timing.fill === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div></section><section class="motion-studio-audit"><header><strong>Motion health</strong><span class="motion-cost" data-tier="${escapeAttribute(motion.performance?.tier ?? 'unknown')}">${escapeText(motion.performance?.label ?? 'Unresolved')}</span></header><div><i class="motion-audit-dot ${motion.reducedMotionProtected ? 'is-clear' : 'has-warning'}"></i><span><strong>${motion.reducedMotionProtected ? 'Reduced motion covered' : 'Reduced motion needs review'}</strong><p>${motion.reducedMotionProtected ? 'A matching preference rule or short duration protects this motion.' : 'No matching reduced-motion rule was found for this element.'}</p></span></div></section>${selectedFrame && selectedProperty ? `<section class="motion-studio-keyframe" data-motion-id="${escapeAttribute(motion.id)}"><header><strong>Keyframe ${selectedFrame.index + 1}</strong><code>${escapeText(selectedProperty)}</code></header><div class="motion-studio-fields"><label class="${motionStudioChanged(selection, motion, `${keyframePath}.offset`)}"><span>Position</span><span class="motion-field-with-unit"><input data-studio-keyframe-property="offset" data-studio-keyframe-index="${selectedFrame.index}" data-studio-track-property="${escapeAttribute(selectedProperty)}" type="number" min="0" max="100" step="1" value="${Math.round(Number(selectedFrame.offset) * 100)}"><i>%</i></span></label><label class="is-wide${motionStudioChanged(selection, motion, `${keyframePath}.${selectedProperty}`)}"><span>Value</span><input data-studio-keyframe-property="value" data-studio-keyframe-index="${selectedFrame.index}" data-studio-track-property="${escapeAttribute(selectedProperty)}" type="text" value="${escapeAttribute(selectedValue)}"></label><label class="is-wide${motionStudioChanged(selection, motion, `${keyframePath}.easing`)}"><span>Segment easing</span><input data-studio-keyframe-property="easing" data-studio-keyframe-index="${selectedFrame.index}" data-studio-track-property="${escapeAttribute(selectedProperty)}" type="text" value="${escapeAttribute(selectedFrame.easing ?? 'linear')}"></label></div></section>` : ''}`;
  $('.motion-studio-audit', properties)?.insertAdjacentHTML(
    'beforebegin',
    renderMotionCurveEditor(selection, motion, disabled),
  );
  $('.motion-curve-editor', properties)?.insertAdjacentHTML(
    'beforebegin',
    renderMotionPathEditor(selection, motion, disabled),
  );
  upgradeSelects(properties);

  $$('[data-motion-studio-select]', list).forEach((button) =>
    button.addEventListener('click', () => {
      motionStudioId = button.dataset.motionStudioSelect;
      renderMotionStudio();
    }),
  );
  $$('[data-studio-keyframe-index]', stage).forEach((button) =>
    button.addEventListener('click', () => {
      selectedMotionKeyframes.set(motion.id, {
        index: Number(button.dataset.studioKeyframeIndex),
        property: button.dataset.studioKeyframeProperty,
      });
      renderMotionStudio();
    }),
  );
  $$('[data-studio-action]', stage).forEach((control) => {
    const action = control.dataset.studioAction;
    if (action === 'scrub') {
      control.addEventListener('pointerdown', () => (motionStudioInteracting = true));
      control.addEventListener('input', () => {
        $('output', stage).textContent =
          `${Math.round(Number(control.value))} / ${Math.round(duration)} ms`;
        sendCommand('motion-action', {
          id: motion.id,
          action,
          value: Number(control.value),
        });
      });
    } else if (action === 'speed') {
      control.addEventListener('change', () =>
        sendCommand('motion-action', {
          id: motion.id,
          action,
          value: Number(control.value),
        }),
      );
    } else {
      control.addEventListener('click', () =>
        sendCommand('motion-action', { id: motion.id, action }),
      );
    }
  });
  const comparison = $('.motion-comparison', stage);
  if (comparison) {
    const before = motion.comparison.before;
    const after = motion.comparison.after;
    const geometry = motionPathGeometry([before.path, after.path]);
    const scrub = $('[data-comparison-scrub]', comparison);
    const output = $('output', comparison);
    const play = $('[data-comparison-action="play"]', comparison);
    const setComparisonProgress = (progress) => {
      const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
      [
        ['before', before],
        ['after', after],
      ].forEach(([name, snapshot]) => {
        const eased = motionCurveSample(snapshot.curve, clamped);
        const point = motionPathSample(snapshot.path, eased);
        const dot = $(`[data-comparison-dot="${name}"]`, comparison);
        dot?.setAttribute('cx', geometry.x(point.x));
        dot?.setAttribute('cy', geometry.y(point.y));
      });
      scrub.value = String(Math.round(clamped * 1000));
      output.textContent = `${Math.round(clamped * 100)}%`;
    };
    const stopComparison = () => {
      if (motionComparisonFrame) cancelAnimationFrame(motionComparisonFrame);
      motionComparisonFrame = 0;
      if (play) play.textContent = 'Play together';
    };
    const startComparison = (from = Number(scrub.value) / 1000) => {
      stopComparison();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setComparisonProgress(1);
        return;
      }
      const comparisonDuration = Math.max(
        1,
        Number(before.timing?.duration) || 0,
        Number(after.timing?.duration) || 0,
      );
      const rate = Math.max(0.1, Number(motion.playbackRate) || 1);
      motionComparisonStartedAt = performance.now() - (from * comparisonDuration) / rate;
      if (play) play.textContent = 'Pause';
      const tick = (now) => {
        const progress = Math.min(
          1,
          ((now - motionComparisonStartedAt) * rate) / comparisonDuration,
        );
        setComparisonProgress(progress);
        if (progress < 1) motionComparisonFrame = requestAnimationFrame(tick);
        else stopComparison();
      };
      motionComparisonFrame = requestAnimationFrame(tick);
    };
    scrub?.addEventListener('input', () => {
      stopComparison();
      setComparisonProgress(Number(scrub.value) / 1000);
    });
    $('[data-comparison-action="replay"]', comparison)?.addEventListener('click', () => {
      setComparisonProgress(0);
      startComparison(0);
    });
    play?.addEventListener('click', () => {
      if (motionComparisonFrame) stopComparison();
      else startComparison(Number(scrub.value) >= 1000 ? 0 : Number(scrub.value) / 1000);
    });
  }
  $$('[data-studio-property]', properties).forEach((field) => {
    let previous = String(field.value);
    const commit = () => {
      if (String(field.value) === previous) return;
      previous = String(field.value);
      const property = field.dataset.studioProperty;
      changedControls.add(`${selection.id}:motion.${motion.id}.${property}`);
      field.closest('label')?.classList.add('is-changed');
      sendCommand('motion-action', {
        id: motion.id,
        action: property,
        value: ['duration', 'delay', 'iterations'].includes(property)
          ? Number(field.value)
          : field.value,
      });
    };
    field.addEventListener('change', commit);
    field.addEventListener('blur', commit);
  });
  const curveEditor = $('.motion-curve-editor', properties);
  if (curveEditor) {
    $$('[data-curve-kind-select]', curveEditor).forEach((button) =>
      button.addEventListener('click', () => {
        sendCommand('motion-action', {
          id: motion.id,
          action: 'curve',
          ...(button.dataset.curveKindSelect === 'spring'
            ? {
                kind: 'spring',
                mass: 1,
                stiffness: 170,
                damping: 26,
                velocity: 0,
              }
            : { kind: 'cubic-bezier', x1: 0.2, y1: 0.8, x2: 0.2, y2: 1 }),
        });
      }),
    );
    $$('[data-curve-preset]', curveEditor).forEach((button) =>
      button.addEventListener('click', () => {
        $$('[data-curve-field]', curveEditor).forEach((field) => {
          const value = button.dataset[field.dataset.curveField];
          if (value != null) field.value = value;
        });
        updateBezierEditorPreview(curveEditor);
        commitMotionCurve(curveEditor);
      }),
    );
    $$('[data-curve-field]', curveEditor).forEach((field) => {
      let previous = String(field.value);
      const commit = () => {
        if (String(field.value) === previous) return;
        previous = String(field.value);
        updateBezierEditorPreview(curveEditor);
        commitMotionCurve(curveEditor);
      };
      field.addEventListener('input', () => updateBezierEditorPreview(curveEditor));
      field.addEventListener('change', commit);
      field.addEventListener('blur', commit);
    });
    $('[data-curve-preview]', curveEditor)?.addEventListener('click', () => {
      const dot = $('.motion-curve-preview-dot', curveEditor);
      dot?.classList.remove('is-playing');
      requestAnimationFrame(() => dot?.classList.add('is-playing'));
    });
    $$('[data-curve-handle]', curveEditor).forEach((handle) => {
      const index = Number(handle.dataset.curveHandle);
      const setFromPoint = (clientX, clientY) => {
        const svg = handle.ownerSVGElement;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const x = Math.max(
          0,
          Math.min(1, (clientX - rect.left - (16 / 240) * rect.width) / ((208 / 240) * rect.width)),
        );
        const normalizedY =
          (clientY - rect.top - (16 / 156) * rect.height) / ((124 / 156) * rect.height);
        const y = Math.max(-2, Math.min(3, 1.25 - normalizedY * 1.5));
        const xField = $(`[data-curve-field="x${index}"]`, curveEditor);
        const yField = $(`[data-curve-field="y${index}"]`, curveEditor);
        if (xField) xField.value = x.toFixed(2);
        if (yField) yField.value = y.toFixed(2);
        updateBezierEditorPreview(curveEditor);
      };
      handle.addEventListener('pointerdown', (event) => {
        motionStudioInteracting = true;
        handle.setPointerCapture(event.pointerId);
        setFromPoint(event.clientX, event.clientY);
      });
      handle.addEventListener('pointermove', (event) => {
        if (!handle.hasPointerCapture(event.pointerId)) return;
        setFromPoint(event.clientX, event.clientY);
      });
      handle.addEventListener('pointerup', (event) => {
        if (handle.hasPointerCapture(event.pointerId))
          handle.releasePointerCapture(event.pointerId);
        commitMotionCurve(curveEditor);
        motionStudioInteracting = false;
      });
      handle.addEventListener('keydown', (event) => {
        const directions = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, 1],
          ArrowDown: [0, -1],
        };
        const direction = directions[event.key];
        if (!direction) return;
        event.preventDefault();
        const step = event.shiftKey ? 0.1 : 0.01;
        const xField = $(`[data-curve-field="x${index}"]`, curveEditor);
        const yField = $(`[data-curve-field="y${index}"]`, curveEditor);
        if (xField)
          xField.value = Math.max(
            0,
            Math.min(1, Number(xField.value) + direction[0] * step),
          ).toFixed(2);
        if (yField)
          yField.value = Math.max(
            -2,
            Math.min(3, Number(yField.value) + direction[1] * step),
          ).toFixed(2);
        updateBezierEditorPreview(curveEditor);
        commitMotionCurve(curveEditor);
      });
    });
  }
  const pathEditor = $('.motion-path-editor:not(.is-unavailable)', properties);
  if (pathEditor) {
    const graph = $('.motion-path-graph', pathEditor);
    const geometry = {
      minX: Number(graph.dataset.minX),
      minY: Number(graph.dataset.minY),
      scale: Number(graph.dataset.scale),
      originX: Number(graph.dataset.originX),
      originY: Number(graph.dataset.originY),
      x(value) {
        return this.originX + (Number(value) - this.minX) * this.scale;
      },
      y(value) {
        return this.originY - (Number(value) - this.minY) * this.scale;
      },
      sourceX(value) {
        return this.minX + (Number(value) - this.originX) / this.scale;
      },
      sourceY(value) {
        return this.minY + (this.originY - Number(value)) / this.scale;
      },
    };
    const previewPath = () => {
      const points = $$('[data-path-row]', pathEditor).map((row) => ({
        x: Number($('[data-path-field="x"]', row).value),
        y: Number($('[data-path-field="y"]', row).value),
      }));
      $('.motion-path-line', pathEditor)?.setAttribute(
        'd',
        points
          .map(
            (point, index) =>
              `${index ? 'L' : 'M'} ${geometry.x(point.x).toFixed(2)} ${geometry.y(point.y).toFixed(2)}`,
          )
          .join(' '),
      );
      $$('[data-path-row]', pathEditor).forEach((row) => {
        const handle = $(`[data-path-point="${row.dataset.pathRow}"]`, pathEditor);
        const x = Number($('[data-path-field="x"]', row).value);
        const y = Number($('[data-path-field="y"]', row).value);
        handle?.setAttribute('cx', geometry.x(x));
        handle?.setAttribute('cy', geometry.y(y));
        handle?.setAttribute('aria-valuetext', `${x}px, ${y}px`);
      });
    };
    const commitPathRow = (row) => {
      const index = Number(row.dataset.pathRow);
      changedControls.add(`${selection.id}:motion.${motion.id}.path`);
      changedControls.add(`${selection.id}:motion.${motion.id}.keyframe.${index}.transform`);
      pathEditor.classList.add('is-changed');
      sendCommand('motion-action', {
        id: motion.id,
        action: 'path-point',
        index,
        x: Number($('[data-path-field="x"]', row).value),
        y: Number($('[data-path-field="y"]', row).value),
      });
    };
    $$('[data-path-field]', pathEditor).forEach((field) => {
      let previous = field.value;
      const commit = () => {
        if (field.value === previous) return;
        previous = field.value;
        previewPath();
        commitPathRow(field.closest('[data-path-row]'));
      };
      field.addEventListener('input', previewPath);
      field.addEventListener('change', commit);
      field.addEventListener('blur', commit);
    });
    $$('[data-path-point]', pathEditor).forEach((handle) => {
      const row = $(`[data-path-row="${handle.dataset.pathPoint}"]`, pathEditor);
      const setFromPointer = (clientX, clientY) => {
        const svg = handle.ownerSVGElement;
        const rect = svg?.getBoundingClientRect();
        if (!rect) return;
        const viewX = ((clientX - rect.left) / rect.width) * 480;
        const viewY = ((clientY - rect.top) / rect.height) * 260;
        $('[data-path-field="x"]', row).value = geometry.sourceX(viewX).toFixed(1);
        $('[data-path-field="y"]', row).value = geometry.sourceY(viewY).toFixed(1);
        previewPath();
      };
      handle.addEventListener('pointerdown', (event) => {
        motionStudioInteracting = true;
        handle.setPointerCapture(event.pointerId);
        setFromPointer(event.clientX, event.clientY);
      });
      handle.addEventListener('pointermove', (event) => {
        if (handle.hasPointerCapture(event.pointerId)) setFromPointer(event.clientX, event.clientY);
      });
      handle.addEventListener('pointerup', (event) => {
        if (handle.hasPointerCapture(event.pointerId))
          handle.releasePointerCapture(event.pointerId);
        motionStudioInteracting = false;
        commitPathRow(row);
      });
      handle.addEventListener('keydown', (event) => {
        const direction = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        }[event.key];
        if (!direction) return;
        event.preventDefault();
        const step = event.shiftKey ? 8 : 1;
        const xField = $('[data-path-field="x"]', row);
        const yField = $('[data-path-field="y"]', row);
        xField.value = String(Number(xField.value) + direction[0] * step);
        yField.value = String(Number(yField.value) + direction[1] * step);
        previewPath();
        commitPathRow(row);
      });
    });
  }
  $$('[data-studio-keyframe-property]', properties).forEach((field) => {
    let previous = String(field.value);
    const commit = () => {
      if (String(field.value) === previous) return;
      previous = String(field.value);
      const action = field.dataset.studioKeyframeProperty;
      const property = action === 'value' ? field.dataset.studioTrackProperty : action;
      changedControls.add(
        `${selection.id}:motion.${motion.id}.keyframe.${field.dataset.studioKeyframeIndex}.${property}`,
      );
      field.closest('label')?.classList.add('is-changed');
      sendCommand('motion-action', {
        id: motion.id,
        action: `keyframe-${action}`,
        index: Number(field.dataset.studioKeyframeIndex),
        property: field.dataset.studioTrackProperty,
        value: action === 'offset' ? Number(field.value) : field.value,
      });
    };
    field.addEventListener('change', commit);
    field.addEventListener('blur', commit);
  });
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
  if (activeMode === 'components') renderComponentWorkshop();
  if (activeMode === 'health') renderHealth();
  if (activeMode === 'responsive') {
    responsiveSnapshots.clear();
    renderResponsiveLab();
  }
  if (activeMode === 'system') renderDesignSystem();
  if (activeMode === 'motion' && !motionStudioInteracting) renderMotionStudio();
  if (activeMode === 'typography') renderTypographyStudio();
  if (activeMode === 'branches') renderDesignBranches();
  if (activeMode === 'recipes') renderVisualRecipes();
  if (activeMode === 'memory') renderMemory();
  if (activeMode === 'agent') renderVisualAgent();
  syncStateWorkbenchConnection();
}

function renderSession(payload) {
  activeSession = payload;
  const context = payload.changeSet.context;
  $('#project-name').textContent = context.targetName ?? 'Design workspace';
  renderChangeSummary();
  renderApplyRun(payload.applyRuns ?? []);
  if (activeMode === 'review') renderReview();
  if (activeMode === 'components') renderComponentWorkshop();
  if (activeMode === 'health') renderHealth();
  if (activeMode === 'system') renderDesignSystem();
  if (activeMode === 'motion') renderMotionStudio();
  if (activeMode === 'typography') renderTypographyStudio();
  if (activeMode === 'branches') renderDesignBranches();
  if (activeMode === 'recipes') renderVisualRecipes();
  if (activeMode === 'memory') renderMemory();
  if (activeMode === 'agent') renderVisualAgent();
  updateCanvasViewport();
}

function designBranchDirections() {
  const main = {
    id: 'main',
    name: 'Main direction',
    status: 'main',
    changes: activeSession?.changeSet?.changes ?? [],
    operations: activeSession?.changeSet?.operations ?? [],
  };
  return [
    main,
    ...(activeSession?.designBranches ?? []).filter((branch) => branch.status !== 'archived'),
  ];
}

function designBranchById(id) {
  return designBranchDirections().find((branch) => branch.id === id) ?? designBranchDirections()[0];
}

function activeDesignDirection() {
  return designBranchById(activeSession?.activeDesignBranchId ?? 'main');
}

function branchChangeKey(change) {
  return [
    change.target?.id,
    change.property,
    change.scope,
    change.context?.breakpoint,
    change.context?.theme,
    change.context?.state,
  ].join(':');
}

function designBranchOptionMarkup(selectedId) {
  return designBranchDirections()
    .map(
      (branch) =>
        `<option value="${escapeAttribute(branch.id)}" ${branch.id === selectedId ? 'selected' : ''}>${escapeText(branch.name)}</option>`,
    )
    .join('');
}

function branchPreviewUrl(branchId) {
  if (!previewUrl) return '';
  const url = new URL(previewUrl);
  url.searchParams.set('__foundry_embedded', '1');
  url.searchParams.set('__foundry_design_branch', branchId);
  return url.href;
}

function sendBranchPreview(frame, branch) {
  if (!frame.contentWindow) return;
  frame.contentWindow.postMessage(
    {
      type: 'foundry:workspace-command',
      sessionId,
      command: 'preview-design-branch',
      payload: { changes: branch.changes ?? [] },
    },
    previewOrigin,
  );
}

function renderDesignBranchPreviews() {
  const root = $('#design-branch-previews');
  if (!root) return;
  designBranchFrames.clear();
  const directions = [designBranchById(branchCompareLeft), designBranchById(branchCompareRight)];
  const viewport = selectedViewport();
  const availablePreviewWidth = Math.max(160, (root.clientWidth - 12) / 2);
  const previewScale = Math.min(1, availablePreviewWidth / viewport.width, 360 / viewport.height);
  root.innerHTML = directions
    .map((branch, index) => {
      const source = branchPreviewUrl(branch.id);
      const count = branch.changes?.length ?? 0;
      return `<article class="design-branch-preview-card" data-direction-id="${escapeAttribute(branch.id)}"><header><div><strong>${escapeText(branch.name)}</strong><span>${count} ${count === 1 ? 'decision' : 'decisions'} · ${viewport.width} × ${viewport.height}</span></div><span class="branch-status" data-status="${escapeAttribute(branch.status)}">${escapeText(branch.status === 'main' ? 'Source-ready' : branch.status)}</span></header><div class="design-branch-preview-viewport" style="--branch-width:${viewport.width};--branch-height:${viewport.height};--branch-scale:${previewScale}">${source ? `<iframe data-design-branch-frame="${index}" title="${escapeAttribute(branch.name)} preview" src="${escapeAttribute(source)}" width="${viewport.width}" height="${viewport.height}"></iframe>` : '<div class="branch-preview-empty">Project preview is not configured.</div>'}</div></article>`;
    })
    .join('');
  $$('[data-design-branch-frame]', root).forEach((frame) => {
    const index = Number(frame.dataset.designBranchFrame);
    const branch = directions[index];
    designBranchFrames.set(branch.id, frame);
    frame.addEventListener('load', () => sendBranchPreview(frame, branch));
  });
}

function renderDesignBranchDecisions() {
  const root = $('#design-branch-decision-list');
  if (!root) return;
  const directionIds = [...new Set([branchCompareLeft, branchCompareRight])].filter(
    (id) => id && id !== 'main',
  );
  const directions = directionIds.map(designBranchById);
  const propertyCounts = new Map();
  for (const branch of directions) {
    for (const change of branch.changes ?? []) {
      const key = branchChangeKey(change);
      propertyCounts.set(key, (propertyCounts.get(key) ?? 0) + 1);
    }
  }
  const rows = directions.flatMap((branch) =>
    (branch.changes ?? []).map((change) => ({ branch, change })),
  );
  root.innerHTML = rows.length
    ? rows
        .map(({ branch, change }) => {
          const selectionId = `${branch.id}:${change.id}`;
          return `<label class="design-branch-decision-row"><input type="checkbox" data-branch-decision="${escapeAttribute(selectionId)}" data-branch-change-key="${escapeAttribute(branchChangeKey(change))}" ${branchDecisionSelection.has(selectionId) ? 'checked' : ''}><span class="branch-decision-source">${escapeText(branch.name)}</span><span class="branch-decision-property"><strong>${escapeText(change.target?.label ?? 'Selection')} · ${escapeText(change.property)}</strong><span>${escapeText(formatValue(change.before, change.unit))} → ${escapeText(formatValue(change.after, change.unit))}</span></span><span class="status-chip">${propertyCounts.get(branchChangeKey(change)) > 1 ? 'Alternative' : 'Distinct'}</span></label>`;
        })
        .join('')
    : '<div class="branch-decisions-empty"><strong>No branch decisions to combine</strong><span>Compare two saved directions to select their strongest changes.</span></div>';
  $$('[data-branch-decision]', root).forEach((input) =>
    input.addEventListener('change', () => {
      if (input.checked) {
        $$('[data-branch-decision]', root)
          .filter(
            (other) =>
              other !== input && other.dataset.branchChangeKey === input.dataset.branchChangeKey,
          )
          .forEach((other) => {
            other.checked = false;
            branchDecisionSelection.delete(other.dataset.branchDecision);
          });
        branchDecisionSelection.add(input.dataset.branchDecision);
      } else branchDecisionSelection.delete(input.dataset.branchDecision);
      updateDesignBranchSelection();
    }),
  );
  updateDesignBranchSelection();
}

function updateDesignBranchSelection() {
  const count = branchDecisionSelection.size;
  $('#design-branch-selection-count').textContent = `${count} selected`;
  $('#design-branch-compose').disabled = count === 0;
}

async function activateDesignDirection(branchId) {
  const previous = activeDesignDirection();
  const updated = await api(`/v1/sessions/${sessionId}/design-branches/activate`, {
    method: 'POST',
    body: JSON.stringify({
      branchId: branchId === 'main' ? undefined : branchId,
    }),
  });
  const next =
    branchId === 'main'
      ? { name: 'Main direction', changes: updated.changeSet.changes }
      : updated.designBranches.find((branch) => branch.id === branchId);
  if (bridgeConnected) {
    await requestCommand('switch-design-branch', {
      previousChanges: previous.changes ?? [],
      nextChanges: next?.changes ?? [],
    });
  }
  renderSession(updated);
  toast(`${next?.name ?? 'Main direction'} is active`);
}

function renderDesignBranchDetail() {
  const root = $('#design-branch-detail');
  const active = activeDesignDirection();
  const isMain = active.id === 'main';
  const changes = active.changes ?? [];
  const status = isMain ? 'main' : active.status;
  root.innerHTML = `<div class="design-branch-detail-head"><div class="design-branch-detail-title"><i data-icon="${isMain ? 'file' : 'branch'}"></i><span><span class="eyebrow">Active direction</span><h2>${escapeText(active.name)}</h2></span></div><span class="branch-status" data-status="${escapeAttribute(status)}">${escapeText(isMain ? 'Source-ready' : status)}</span><p>${isMain ? 'The source-ready design change set.' : `${changes.length} isolated ${changes.length === 1 ? 'decision' : 'decisions'} in this direction.`}</p></div><div class="design-branch-metrics"><div><strong>${changes.length}</strong><span>Decisions</span></div><div><strong>${new Set(changes.map((change) => change.target?.id)).size}</strong><span>Layers</span></div></div>${isMain ? '<div class="branch-detail-note"><strong>Create a direction to explore safely</strong><span>New edits stay isolated until you explicitly choose a direction.</span></div>' : `<label class="branch-rejection-field"><span>Direction note</span><textarea id="design-branch-note" maxlength="280" placeholder="Why keep or reject this direction?">${escapeText(active.rejectionReason ?? '')}</textarea></label><div class="branch-detail-actions"><button class="secondary-button" data-branch-action="save-note">Save note</button><button class="secondary-button" data-branch-action="return-main">Return to main</button><button class="secondary-button" data-branch-action="reject">Reject direction</button><button class="quiet-button" data-branch-action="archive"><i data-icon="bin"></i>Archive direction</button></div>`}`;
  renderIcons(root);
  $$('[data-branch-action]', root).forEach((button) =>
    button.addEventListener('click', async () => {
      const action = button.dataset.branchAction;
      const note = $('#design-branch-note')?.value ?? '';
      if (action === 'return-main') {
        void activateDesignDirection('main').catch((error) => toast(error.message));
        return;
      }
      try {
        const updated = await api(
          `/v1/sessions/${sessionId}/design-branches/${encodeURIComponent(active.id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              rejectionReason: note,
              ...(action === 'reject'
                ? { status: 'rejected' }
                : action === 'archive'
                  ? { status: 'archived' }
                  : {}),
            }),
          },
        );
        renderSession(updated);
        toast(
          action === 'archive'
            ? 'Direction archived'
            : action === 'reject'
              ? 'Direction rejected'
              : 'Direction note saved',
        );
      } catch (error) {
        toast(error.message);
      }
    }),
  );
}

function branchRecordStatusLabel(record) {
  if (record.compatibility.status === 'current') return 'Ready';
  if (record.compatibility.status === 'stale') return 'Review';
  return 'Missing source';
}

function renderDesignBranchRecords() {
  const root = $('#design-branch-record-list');
  if (!root) return;
  const records = activeSession?.designBranchRecords ?? [];
  root.innerHTML = records.length
    ? records
        .map(
          (record) =>
            `<article class="design-branch-record" data-compatibility="${escapeAttribute(record.compatibility.status)}"><header><span><strong>${escapeText(record.name)}</strong><small>${escapeText(record.outcome)} · ${record.changes.length} ${record.changes.length === 1 ? 'decision' : 'decisions'}</small></span><span class="branch-record-status">${escapeText(branchRecordStatusLabel(record))}</span></header>${record.rationale ? `<p>${escapeText(record.rationale)}</p>` : ''}<div class="branch-record-evidence"><span>${record.compatibility.matchedSources}/${record.compatibility.totalSources} sources matched</span>${record.importedAt ? '<span>Imported</span>' : '<span>Local</span>'}</div>${record.compatibility.warnings?.length ? `<small class="branch-record-warning">${escapeText(record.compatibility.warnings[0])}</small>` : ''}<footer><button class="quiet-button compact" data-remove-branch-record="${escapeAttribute(record.id)}"><i data-icon="bin"></i>Remove</button><button class="secondary-button compact" data-memory-branch-record="${escapeAttribute(record.id)}">Add to Memory</button><button class="primary-button compact" data-restore-branch-record="${escapeAttribute(record.id)}" ${record.compatibility.status === 'current' ? '' : 'disabled'}>Restore direction</button></footer></article>`,
        )
        .join('')
    : '<div class="branch-records-empty"><strong>No saved decisions yet</strong><span>Choosing or rejecting a direction creates a portable record.</span></div>';
  $$('[data-restore-branch-record]', root).forEach((button) =>
    button.addEventListener('click', async () => {
      const previous = activeDesignDirection();
      try {
        const updated = await api(
          `/v1/sessions/${sessionId}/design-branch-records/${encodeURIComponent(button.dataset.restoreBranchRecord)}/restore`,
          { method: 'POST', body: '{}' },
        );
        const restored = updated.designBranches.find(
          (branch) => branch.id === updated.activeDesignBranchId,
        );
        branchCompareRight = restored?.id ?? branchCompareRight;
        renderSession(updated);
        if (bridgeConnected && restored) {
          try {
            await requestCommand('switch-design-branch', {
              previousChanges: previous.changes ?? [],
              nextChanges: restored.changes ?? [],
            });
          } catch (error) {
            toast(`${restored.name} restored. ${error.message}`);
            return;
          }
        }
        toast(`${restored?.name ?? 'Direction'} restored for exploration`);
      } catch (error) {
        toast(error.message);
      }
    }),
  );
  $$('[data-memory-branch-record]', root).forEach((button) =>
    button.addEventListener('click', () => {
      const record = records.find((item) => item.id === button.dataset.memoryBranchRecord);
      if (!record) return;
      sendCommand('save-design-decision', {
        title: `${record.name} ${record.outcome}`,
        summary:
          record.rationale?.trim() ||
          (record.outcome === 'chosen'
            ? 'Chosen direction promoted to Review.'
            : 'Do not repeat this direction without new evidence.'),
        rationale: record.rationale?.trim() || '',
        outcome: record.outcome === 'chosen' ? 'approved' : 'rejected',
        evidenceKind: 'branch',
        evidenceLabel: record.name,
        refId: record.id,
        changes: record.changes ?? [],
      });
      toast(`${record.name} added to Design Memory`);
    }),
  );
  $$('[data-remove-branch-record]', root).forEach((button) =>
    button.addEventListener('click', async () => {
      try {
        renderSession(
          await api(
            `/v1/sessions/${sessionId}/design-branch-records/${encodeURIComponent(button.dataset.removeBranchRecord)}`,
            { method: 'DELETE' },
          ),
        );
        toast('Portable record removed');
      } catch (error) {
        toast(error.message);
      }
    }),
  );
  renderIcons(root);
}

function renderDesignBranches() {
  if (!activeSession || !$('#design-branch-list')) return;
  const directions = designBranchDirections();
  const activeId = activeSession.activeDesignBranchId ?? 'main';
  if (!directions.some((branch) => branch.id === branchCompareLeft)) branchCompareLeft = 'main';
  if (!directions.some((branch) => branch.id === branchCompareRight)) {
    branchCompareRight = directions.find((branch) => branch.id !== branchCompareLeft)?.id ?? 'main';
  }
  $('#design-branch-status').textContent = activeDesignDirection().name;
  $('#design-branch-direction-count').textContent = String(directions.length);
  $('#design-branch-list').innerHTML = directions
    .map(
      (branch) =>
        `<button class="design-branch-row ${branch.id === activeId ? 'is-active' : ''}" data-activate-branch="${escapeAttribute(branch.id)}"><i data-icon="${branch.id === 'main' ? 'file' : 'branch'}"></i><span><strong>${escapeText(branch.name)}</strong><small>${branch.changes?.length ?? 0} decisions</small></span>${branch.id === activeId ? '<i data-icon="check"></i>' : ''}</button>`,
    )
    .join('');
  renderIcons($('#design-branch-list'));
  $$('[data-activate-branch]').forEach((button) =>
    button.addEventListener(
      'click',
      () =>
        void activateDesignDirection(button.dataset.activateBranch).catch((error) =>
          toast(error.message),
        ),
    ),
  );

  const left = $('#design-branch-left');
  const right = $('#design-branch-right');
  left.innerHTML = designBranchOptionMarkup(branchCompareLeft);
  right.innerHTML = designBranchOptionMarkup(branchCompareRight);
  left.value = branchCompareLeft;
  right.value = branchCompareRight;
  upgradeSelects($('.design-branch-compare-selects'));
  syncCustomSelect(left);
  syncCustomSelect(right);
  left.onchange = () => {
    branchCompareLeft = left.value;
    renderDesignBranches();
  };
  right.onchange = () => {
    branchCompareRight = right.value;
    renderDesignBranches();
  };
  renderDesignBranchPreviews();
  renderDesignBranchDecisions();
  renderDesignBranchDetail();
  renderDesignBranchRecords();
  $('#design-branch-promote').disabled = activeId === 'main';
}

$('#design-branch-create').addEventListener('click', async () => {
  const input = $('#design-branch-name');
  const name =
    input.value.trim() || `Direction ${(activeSession?.designBranches?.length ?? 0) + 1}`;
  try {
    const previous = activeDesignDirection();
    const updated = await api(`/v1/sessions/${sessionId}/design-branches`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        sourceBranchId: activeSession?.activeDesignBranchId,
      }),
    });
    const next = updated.designBranches.find(
      (branch) => branch.id === updated.activeDesignBranchId,
    );
    if (bridgeConnected) {
      await requestCommand('switch-design-branch', {
        previousChanges: previous.changes ?? [],
        nextChanges: next?.changes ?? [],
      });
    }
    input.value = '';
    branchCompareRight = next?.id ?? branchCompareRight;
    renderSession(updated);
    toast(`${name} created`);
  } catch (error) {
    toast(error.message);
  }
});

$('#design-branch-name').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') $('#design-branch-create').click();
});

$('#design-branch-compose').addEventListener('click', async () => {
  const grouped = new Map();
  for (const selection of branchDecisionSelection) {
    const separator = selection.indexOf(':');
    const branchId = selection.slice(0, separator);
    const changeId = selection.slice(separator + 1);
    grouped.set(branchId, [...(grouped.get(branchId) ?? []), changeId]);
  }
  try {
    const previous = activeDesignDirection();
    const updated = await api(`/v1/sessions/${sessionId}/design-branches`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Combined direction',
        selections: [...grouped].map(([branchId, changeIds]) => ({
          branchId,
          changeIds,
        })),
      }),
    });
    const next = updated.designBranches.find(
      (branch) => branch.id === updated.activeDesignBranchId,
    );
    if (bridgeConnected) {
      await requestCommand('switch-design-branch', {
        previousChanges: previous.changes ?? [],
        nextChanges: next?.changes ?? [],
      });
    }
    branchDecisionSelection.clear();
    branchCompareRight = next?.id ?? branchCompareRight;
    renderSession(updated);
    toast('Selected decisions combined');
  } catch (error) {
    toast(error.message);
  }
});

$('#design-branch-promote').addEventListener('click', async () => {
  const chosen = activeDesignDirection();
  if (chosen.id === 'main') return;
  try {
    const updated = await api(
      `/v1/sessions/${sessionId}/design-branches/${encodeURIComponent(chosen.id)}/promote`,
      { method: 'POST', body: '{}' },
    );
    renderSession(updated);
    setMode('review');
    if (bridgeConnected) {
      try {
        await requestCommand('switch-design-branch', {
          previousChanges: chosen.changes ?? [],
          nextChanges: updated.changeSet.changes ?? [],
        });
      } catch (error) {
        toast(`Direction moved to Review. ${error.message}`);
        return;
      }
    }
    toast(`${chosen.name} moved to Review and apply`);
  } catch (error) {
    toast(error.message);
  }
});

$('#design-branch-record-import').addEventListener('click', () =>
  $('#design-branch-record-file').click(),
);
$('#design-branch-record-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const bundle = JSON.parse(await file.text());
    const updated = await api(`/v1/sessions/${sessionId}/design-branch-records`, {
      method: 'POST',
      body: JSON.stringify(bundle),
    });
    renderSession(updated);
    toast(`${bundle.records?.length ?? 0} portable branch records imported`);
  } catch (error) {
    toast(error.message);
  } finally {
    event.target.value = '';
  }
});
$('#design-branch-record-export').addEventListener('click', () => {
  const records = activeSession?.designBranchRecords ?? [];
  const blob = new Blob(
    [
      JSON.stringify(
        {
          format: 'foundry.design-branch-records',
          version: 1,
          exportedAt: new Date().toISOString(),
          records,
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = 'foundry-branch-decisions.json';
  anchor.click();
  URL.revokeObjectURL(href);
  toast(`${records.length} portable ${records.length === 1 ? 'record' : 'records'} exported`);
});

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
  preview.addEventListener('load', () => {
    bridgeBranchSynced = false;
  });
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
  const responsiveViewportId = responsiveFrames.get(event.source);
  if (
    responsiveViewportId &&
    event.origin === previewOrigin &&
    event.data?.sessionId === sessionId &&
    event.data?.type === 'foundry:workspace-state'
  ) {
    responsiveSnapshots.set(responsiveViewportId, event.data.payload?.responsive ?? {});
    updateResponsiveCard(responsiveViewportId);
    return;
  }
  if (event.source !== preview.contentWindow || event.origin !== previewOrigin) return;
  if (event.data?.sessionId !== sessionId) return;
  if (event.data?.type === 'foundry:workspace-result') {
    const pending = pendingCommandRequests.get(event.data.requestId);
    if (!pending) return;
    window.clearTimeout(pending.timeout);
    pendingCommandRequests.delete(event.data.requestId);
    if (event.data.ok) pending.resolve(event.data.payload);
    else
      pending.reject(
        new Error(event.data.error ?? 'The live preview could not complete this action.'),
      );
    return;
  }
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
  if (visualAgentRegionPending && bridgeState?.visualAgent?.region) {
    visualAgentRegionPending = false;
    setMode('agent', false);
    requestAnimationFrame(() => $('#visual-agent-prompt')?.focus());
  }
  if (!bridgeBranchSynced) {
    bridgeBranchSynced = true;
    const branch = activeDesignDirection();
    if (branch.id !== 'main') {
      sendCommand('switch-design-branch', {
        previousChanges: [],
        nextChanges: branch.changes ?? [],
      });
    }
  }
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
$('#state-save-matrix')?.addEventListener('click', () =>
  toast('State matrix saved for this design session.'),
);
$('#state-run-verification')?.addEventListener('click', () => {
  renderStates();
  toast(bridgeConnected ? 'State verification refreshed.' : 'Connect the live product first.');
});
$('#component-workshop-search').addEventListener('input', renderComponentWorkshop);
$('#component-open-canvas').addEventListener('click', () => setMode('canvas'));
$('#component-workshop-review').addEventListener('click', () => setMode('review'));
$('#responsive-open-canvas')?.addEventListener('click', () => setMode('canvas'));
$('#responsive-review').addEventListener('click', () => setMode('review'));
$('#design-system-search').addEventListener('input', () => renderDesignSystem());
$('#motion-studio-review').addEventListener('click', () => setMode('review'));
$('#typography-studio-review').addEventListener('click', () => setMode('review'));
$$('[data-typography-source]').forEach((button) =>
  button.addEventListener('click', () => {
    typographySource = button.dataset.typographySource;
    renderTypographyStudio();
    if (typographySource === 'google' && typographyGoogleStatus === 'idle')
      void loadTypographyGoogleFonts('');
  }),
);
$('#typography-search').addEventListener('input', (event) => {
  clearTimeout(typographySearchTimer);
  if (typographySource === 'google') {
    typographySearchTimer = setTimeout(
      () => void loadTypographyGoogleFonts(event.target.value.trim()),
      220,
    );
  } else {
    renderTypographyStudio();
    const input = $('#typography-search');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
});
$('#responsive-width').addEventListener('input', (event) => {
  if (responsiveScrubTarget === 'container') responsiveContainerWidth = Number(event.target.value);
  else responsiveCustomWidth = Number(event.target.value);
  $('#responsive-width-output').textContent = `${event.target.value}px`;
  scrubResponsiveCustomFrame();
});
$$('[data-responsive-target]').forEach((button) =>
  button.addEventListener('click', () => {
    responsiveScrubTarget = button.dataset.responsiveTarget;
    $$('[data-responsive-target]').forEach((candidate) =>
      candidate.classList.toggle('is-active', candidate === button),
    );
    if (responsiveScrubTarget === 'viewport')
      $$('[data-responsive-frame]').forEach((frame) =>
        responsiveFrameCommand(frame, 'preview-responsive-container', { width: null }),
      );
    renderResponsiveLab();
    scrubResponsiveCustomFrame();
  }),
);
$('#responsive-capture-before').addEventListener('click', () =>
  captureResponsiveComparison('before'),
);
$('#responsive-capture-after').addEventListener('click', () =>
  captureResponsiveComparison('after'),
);
$('#responsive-clear-comparison').addEventListener('click', () => {
  responsiveComparisonBefore = null;
  responsiveComparisonAfter = null;
  renderResponsiveComparison();
});
$$('[data-responsive-stress]').forEach((button) =>
  button.addEventListener('click', () => {
    responsiveStressMode = button.dataset.responsiveStress;
    $$('[data-responsive-stress]').forEach((candidate) =>
      candidate.classList.toggle('is-active', candidate === button),
    );
    $$('[data-responsive-frame]').forEach((frame) =>
      responsiveFrameCommand(frame, 'preview-responsive-stress', {
        mode: responsiveStressMode,
      }),
    );
    toast(
      responsiveStressMode === 'none'
        ? 'Temporary stress test cleared'
        : 'Temporary stress test applied',
    );
  }),
);
$$('[data-responsive-scope]').forEach((button) =>
  button.addEventListener('click', () => {
    const wantsAll = button.dataset.responsiveScope === 'all';
    const hasSource = Boolean(bridgeState?.selection?.source);
    if (wantsAll && !hasSource) {
      toast('Source mapping is required to promote a change across breakpoints.');
      return;
    }
    responsiveEditScope = wantsAll ? 'all' : 'breakpoint';
    $$('[data-responsive-scope]').forEach((candidate) =>
      candidate.classList.toggle(
        'is-active',
        candidate.dataset.responsiveScope === responsiveEditScope,
      ),
    );
    if (responsiveEditScope === 'breakpoint') {
      sendCommand('set-context', {
        key: 'breakpoint',
        value: responsiveActiveViewport === 'custom' ? 'current' : responsiveActiveViewport,
      });
    }
  }),
);
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
    sendCommand('set-context', {
      key: select.dataset.context,
      value: select.value,
    }),
  ),
);
$('#canvas-viewport').addEventListener(
  'change',
  (event) => (
    sendCommand('set-context', {
      key: 'breakpoint',
      value: event.target.value,
    }),
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
    dismissedApplyRunId = null;
    await api(`/v1/sessions/${sessionId}/apply-runs`, {
      method: 'POST',
      body: JSON.stringify({
        reviews,
        revision: activeSession.changeSet.context.revision,
      }),
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
$$('[data-stress-scope]').forEach((button) =>
  button.addEventListener('click', () => {
    stressScope = button.dataset.stressScope === 'canvas' ? 'canvas' : 'selection';
    renderHealth();
  }),
);
$$('[data-stress-group]').forEach((button) =>
  button.addEventListener('click', () => {
    stressGroupBy = button.dataset.stressGroup === 'source' ? 'source' : 'severity';
    renderHealth();
  }),
);
$('#apply-stress').addEventListener('click', () => {
  if (stressScope === 'selection' && !bridgeState?.selection) {
    toast('Select a layer before applying selection stress tests');
    return;
  }
  sendCommand('apply-health-stress', {
    conditions: [...selectedStressConditions],
    scope: stressScope,
  });
  toast('Temporary conditions applied. Scanning the rendered state.');
});
$('#clear-stress').addEventListener('click', () => {
  selectedStressConditions.clear();
  sendCommand('clear-health-stress');
  renderHealth();
  toast('Temporary conditions cleared');
});
$('#stress-review').addEventListener('click', () => setMode('review'));
$('#visual-recipe-search').addEventListener('input', (event) => {
  visualRecipeSearch = event.target.value;
  renderVisualRecipes();
});
$('#visual-recipe-save').addEventListener('click', () => {
  const name = $('#visual-recipe-name').value.trim();
  const intent = $('#visual-recipe-intent').value.trim();
  sendCommand('save-visual-recipe', { name, intent });
  $('#visual-recipe-name').value = '';
  $('#visual-recipe-intent').value = '';
  toast('Treatment saved to this project');
});
$('#visual-recipe-review').addEventListener('click', () => setMode('review'));
$('#visual-recipe-import').addEventListener('click', () => $('#visual-recipe-file').click());
$('#visual-recipe-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  sendCommand('import-visual-recipes', { json: await file.text() });
  event.target.value = '';
});
$('#visual-recipe-export').addEventListener('click', () => {
  const recipes = bridgeState?.visualRecipes?.recipes ?? [];
  const blob = new Blob(
    [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), recipes }, null, 2)],
    { type: 'application/json' },
  );
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = 'foundry-visual-recipes.json';
  anchor.click();
  URL.revokeObjectURL(href);
  toast(`${recipes.length} visual ${recipes.length === 1 ? 'recipe' : 'recipes'} exported`);
});
$('#decision-memory-search').addEventListener('input', (event) => {
  decisionMemorySearch = event.target.value;
  renderMemory();
});
$$('[data-decision-filter]').forEach((button) =>
  button.addEventListener('click', () => {
    decisionMemoryFilter = button.dataset.decisionFilter;
    $$('[data-decision-filter]').forEach((candidate) =>
      candidate.classList.toggle('is-active', candidate === button),
    );
    renderMemory();
  }),
);
$$('[data-decision-outcome]').forEach((button) =>
  button.addEventListener('click', () => {
    decisionMemoryOutcome = button.dataset.decisionOutcome;
    $$('[data-decision-outcome]').forEach((candidate) =>
      candidate.classList.toggle('is-active', candidate === button),
    );
  }),
);
$('#decision-memory-save').addEventListener('click', () => {
  const title = $('#decision-memory-title').value.trim();
  const summary = $('#decision-memory-summary').value.trim();
  const rationale = $('#decision-memory-rationale').value.trim();
  if (!title || !summary) {
    toast('Add a title and clear guidance first');
    return;
  }
  sendCommand('save-design-decision', {
    title,
    summary,
    rationale,
    outcome: decisionMemoryOutcome,
    evidenceKind: 'manual',
    evidenceLabel: 'Captured in Design decision memory',
  });
  $('#decision-memory-title').value = '';
  $('#decision-memory-summary').value = '';
  $('#decision-memory-rationale').value = '';
  toast('Decision saved to this project');
});
$('#decision-memory-review').addEventListener('click', () => setMode('review'));
$('#decision-memory-import').addEventListener('click', () => $('#decision-memory-file').click());
$('#decision-memory-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  sendCommand('import-design-decisions', { json: await file.text() });
  event.target.value = '';
});
$('#decision-memory-export').addEventListener('click', () => {
  const decisions = bridgeState?.decisionMemory?.decisions ?? [];
  const blob = new Blob(
    [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), decisions }, null, 2)],
    { type: 'application/json' },
  );
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = 'foundry-design-decisions.json';
  anchor.click();
  URL.revokeObjectURL(href);
  toast(`${decisions.length} design ${decisions.length === 1 ? 'decision' : 'decisions'} exported`);
});
$('#visual-agent-region').addEventListener('click', () => {
  visualAgentRegionPending = true;
  sendCommand('capture-agent-region');
  setMode('canvas', false);
  toast('Drag a region on the rendered product');
});
$('#visual-agent-clear-region').addEventListener('click', () => {
  visualAgentRegionPending = false;
  sendCommand('clear-agent-region');
});
$('#visual-agent-ask').addEventListener('click', async () => {
  const prompt = $('#visual-agent-prompt').value.trim();
  const comment = $('#visual-agent-comment').value.trim();
  if (!prompt) {
    toast('Describe the visual question first');
    return;
  }
  const context = visualAgentContextSnapshot(comment);
  if (!context.targets.length && !context.region) {
    toast('Select rendered layers or draw a canvas region first');
    return;
  }
  try {
    const updated = await api(`/v1/sessions/${sessionId}/visual-agent-requests`, {
      method: 'POST',
      body: JSON.stringify({ prompt, context }),
    });
    visualAgentRequestId = updated.visualAgentRequests.at(-1)?.id ?? '';
    $('#visual-agent-prompt').value = '';
    $('#visual-agent-comment').value = '';
    renderSession(updated);
    toast('Visual question sent to the active agent');
  } catch (error) {
    toast(error.message);
  }
});
$('#visual-agent-review').addEventListener('click', () => setMode('review'));
$$('[data-studio-action]').forEach((button) => {
  if (button.closest('#motion-studio-stage')) return;
  button.addEventListener('click', () => {
    const action = button.dataset.studioAction;
    if (action === 'component-create') {
      const field = $('[data-workshop-variant-label]');
      if (field) field.focus();
      else toast('Choose a source-backed component with a writable variant axis.');
    }
    if (action === 'responsive-fit') {
      responsiveCustomWidth = selectedViewport().width;
      renderResponsiveLab();
      toast('Responsive viewports fitted to the current project context.');
    }
    if (action === 'responsive-audit') {
      sendCommand('scan-health');
      toast('Running responsive and overflow verification.');
    }
    if (action === 'system-export') {
      const project = projectDesign();
      const blob = new Blob(
        [
          JSON.stringify(
            {
              version: 1,
              exportedAt: new Date().toISOString(),
              tokens: project.tokens ?? [],
              usages: project.tokenUsages ?? [],
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      );
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = 'foundry-design-system.json';
      anchor.click();
      URL.revokeObjectURL(href);
      toast('Design system tokens exported.');
    }
    if (action === 'system-sync') {
      renderDesignSystem();
      toast('Design system refreshed from the live project index.');
    }
    if (action === 'motion-compare') {
      const compare = $('[data-comparison-action="play"]', $('#motion-studio-stage'));
      if (compare) compare.click();
      else toast('Select a moving layer to compare its motion.');
    }
    if (action === 'motion-preview') {
      const toggle = $('[data-studio-action="toggle"]', $('#motion-studio-stage'));
      if (toggle) toggle.click();
      else toast('Select a moving layer to preview its motion.');
    }
    if (action === 'typography-compare') {
      const source = $('[data-typography-source="google"]');
      source?.click();
      $('#typography-search')?.focus();
    }
    if (action === 'typography-apply') setMode('review');
    if (action === 'branches-compare') {
      const select = $('#design-branch-left');
      const trigger = select?.closest('.foundry-select')?.querySelector('.foundry-select-trigger');
      (trigger ?? select)?.focus();
    }
    if (action === 'branches-create') $('#design-branch-name')?.focus();
    if (action === 'stress-reset') $('#clear-stress')?.click();
    if (action === 'stress-run') {
      if (selectedStressConditions.size) $('#apply-stress')?.click();
      else $('#run-health')?.click();
    }
    if (action === 'recipe-duplicate') {
      if (visualRecipeId) sendCommand('duplicate-visual-recipe', { recipeId: visualRecipeId });
      else toast('Choose a saved recipe to duplicate.');
    }
    if (action === 'recipe-run') {
      const run = $('[data-apply-visual-recipe]');
      if (run && !run.disabled) run.click();
      else toast('Choose a compatible recipe and live target first.');
    }
    if (action === 'memory-export') $('#decision-memory-export')?.click();
    if (action === 'memory-record') $('#decision-memory-title')?.focus();
    if (action === 'agent-start') $('#visual-agent-prompt')?.focus();
  });
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
  ['states', 'State workbench', '3', 'layers'],
  ['health', 'Content stress lab', '4', 'activity'],
  ['memory', 'Design memory', '5', 'bookmark'],
  ['components', 'Component workshop', '6', 'component'],
  ['responsive', 'Responsive design lab', '7', 'layout'],
  ['system', 'Design system', '8', 'sparkles'],
  ['motion', 'Motion studio', '9', 'play'],
  ['typography', 'Typography studio', '0', 'typography'],
  ['branches', 'Design branches', 'b', 'branch'],
  ['recipes', 'Visual recipes', 'r', 'file'],
  ['agent', 'Visual agent', 'a', 'message'],
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
document.addEventListener('pointerup', () => {
  if (!motionStudioInteracting) return;
  motionStudioInteracting = false;
  if (activeMode === 'motion') renderMotionStudio();
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
