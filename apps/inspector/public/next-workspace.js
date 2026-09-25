// Foundry Next first slice. All durable actions use the existing acknowledged bridge.
export const NEXT_TEXT_PROPERTIES = new Set([
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
  'opacity',
]);

export function validateNextValue(control, input) {
  if (control.mixed && !input.trim())
    return `Enter a replacement for ${control.label.toLowerCase()}. Mixed is not zero.`;
  if (['alt', 'aria-label', 'textContent'].includes(control.property)) return null;
  if (control.kind !== 'number')
    return input.trim() ? null : `Enter ${control.label.toLowerCase()}.`;
  const value = Number(input);
  if (!input.trim() || !Number.isFinite(value))
    return `Enter a number for ${control.label.toLowerCase()}.`;
  if (control.min != null && value < control.min) return `Use ${control.min} or higher.`;
  if (control.max != null && value > control.max) return `Use ${control.max} or lower.`;
  return null;
}

const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const icon = (name) => `<i data-icon="${name}"></i>`;
const textKinds = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'span',
  'label',
  'a',
  'strong',
  'em',
  'small',
]);

export const LINKED_INSPECTOR_GROUPS = {
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
export function linkedInspectorControls(controls) {
  const labels = {
    paddingHorizontal: 'Horizontal',
    paddingVertical: 'Vertical',
    paddingLinked: 'All sides',
    radiusLinked: 'All corners',
  };
  return Object.entries(LINKED_INSPECTOR_GROUPS).flatMap(([property, names]) => {
    const peers = names.map((name) => controls.find((control) => control.property === name));
    const first = peers[0];
    if (
      !first ||
      peers.some((peer) => !peer || peer.kind !== first.kind || peer.unit !== first.unit)
    )
      return [];
    return [
      {
        ...first,
        property,
        label: labels[property],
        mixed: peers.some((peer) => peer.mixed || String(peer.value) !== String(first.value)),
        min: Math.max(...peers.map((peer) => peer.min ?? -Infinity)),
        max: Math.min(...peers.map((peer) => peer.max ?? Infinity)),
      },
    ];
  });
}

export function selectionCategory(selection) {
  if (!selection) return 'empty';
  if (selection.count > 1) return 'multiple';
  if (['img', 'video', 'audio', 'picture'].includes(selection.kind)) return 'media';
  if (['svg', 'path', 'i'].includes(selection.kind) || selection.icon) return 'icon';
  if (['button', 'input', 'select', 'textarea'].includes(selection.kind)) return 'component';
  if (textKinds.has(selection.kind)) return 'text';
  return selection.component ? 'component' : 'container';
}

export function inspectorSections(controls, category) {
  const take = (names) =>
    names.map((name) => controls.find((control) => control.property === name)).filter(Boolean);
  const section = (name, primary, advanced = []) => ({
    name,
    controls: take(primary),
    advanced: take(advanced),
  });
  const groups = [
    section('Position', ['position', 'left', 'top']),
    section(
      'Layout',
      [
        ...(category === 'container' ? ['display', 'flexDirection'] : []),
        'width',
        'height',
        'objectFit',
        'objectPosition',
        'gap',
        'flexWrap',
        'justifyContent',
        'alignItems',
      ],
      [
        ...(category !== 'container' ? ['display', 'flexDirection'] : []),
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
      ],
    ),
    section(
      'Typography',
      ['fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing', 'textAlign'],
      ['fontStyle', 'textTransform', 'fontVariationSettings'],
    ),
    section(
      'Appearance',
      category === 'text' ? ['color', 'opacity'] : ['backgroundColor', 'color', 'opacity'],
      ['borderWidth', 'borderColor', 'boxShadow'],
    ),
    section('Content', ['textContent']),
    section('Accessibility', ['alt', 'aria-label']),
  ].filter((section) => section.controls.length || section.advanced.length);
  for (const group of groups)
    group.controls = group.controls.map((control) => ({
      ...control,
      full:
        (control.property === 'display' &&
          !group.controls.some((item) => item.property === 'flexDirection')) ||
        (control.property === 'gap' &&
          !group.controls.some((item) => item.property === 'flexWrap')),
    }));
  return groups;
}

export function inspectorEditHint(direction, phase = 'idle') {
  const alternate = direction?.id && direction.id !== 'main';
  const destination = alternate ? `“${direction.name}”` : 'Review';
  if (phase === 'saved')
    return alternate
      ? `Saved to ${destination}. Review is unchanged.`
      : 'Saved to Review. Source is unchanged.';
  const prefix = phase === 'preview' ? 'Preview only. Not saved. ' : '';
  return `${prefix}Enter ${alternate ? 'saves to' : 'adds to'} ${destination}. Escape or leaving the field cancels. Source is unchanged.`;
}

export function createNextWorkspace({
  command,
  navigate,
  renderIcons,
  state,
  rerender,
  openConnection,
}) {
  const $ = (selector) => document.querySelector(selector);
  const shell = $('#app-shell');
  shell.dataset.next = 'true';
  const structureSearch = $('#structure-search');
  const clearStructureSearch = document.createElement('button');
  clearStructureSearch.type = 'button';
  clearStructureSearch.className = 'next-search-clear';
  clearStructureSearch.setAttribute('aria-label', 'Clear search');
  clearStructureSearch.title = 'Clear search';
  clearStructureSearch.innerHTML = icon('close');
  clearStructureSearch.hidden = !structureSearch.value;
  structureSearch.after(clearStructureSearch);
  const resetStructureSearch = () => {
    structureSearch.value = '';
    structureSearch.dispatchEvent(new Event('input', { bubbles: true }));
    structureSearch.focus();
  };
  clearStructureSearch.addEventListener('click', resetStructureSearch);
  structureSearch.addEventListener('input', () => {
    clearStructureSearch.hidden = !structureSearch.value;
  });
  structureSearch.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && structureSearch.value) {
      event.preventDefault();
      event.stopPropagation();
      resetStructureSearch();
    }
  });
  $('#layers-dock .segmented').setAttribute('aria-label', 'Structure');
  renderIcons(clearStructureSearch);
  const contextControls = [
    ['canvas-viewport', 'Viewport', 'box'],
    ['canvas-theme', 'Theme', 'contrast'],
    ['canvas-state', 'State', 'interact'],
  ];
  const refineCanvasHeader = (selection) => {
    const detail = $('#canvas-detail');
    detail.replaceChildren();
    const name = Object.assign(document.createElement('span'), {
      className: 'next-selection-name',
      textContent: selection?.label || 'Select a layer',
    });
    detail.append(name);
    detail.title = selection?.label || 'Select a layer on the canvas or in Layers';
    if (selection && Number.isFinite(selection.width) && Number.isFinite(selection.height)) {
      const format = (value) => String(Math.round(value * 10) / 10);
      const size = Object.assign(document.createElement('span'), {
        className: 'next-selection-size',
        textContent: `${format(selection.width)} × ${format(selection.height)} px`,
        title: `Measured size: ${selection.width} × ${selection.height} px`,
      });
      detail.append(size);
    }
    for (const [id, label, glyph] of contextControls) {
      const select = $(`#${id}`);
      const trigger = select.closest('.foundry-select')?.querySelector('button');
      if (!trigger) continue;
      if (!trigger.querySelector('.next-context-icon')) {
        trigger.insertAdjacentHTML(
          'afterbegin',
          `<span class="next-context-icon" aria-hidden="true">${icon(glyph)}</span>`,
        );
        renderIcons(trigger);
      }
      const value = select.selectedOptions[0]?.textContent || 'Current';
      trigger.querySelector('.foundry-select-value').textContent =
        select.value === 'current' ? label : value;
      trigger.setAttribute('aria-label', `${label}: ${value}`);
      trigger.title = `${label}: ${value}`;
    }
    const heading = $('#inspector-dock .dock-head strong');
    heading.title = heading.textContent;
  };
  const refineStructure = (root, category) => {
    $('#layer-total').title = `${$('#layer-total').textContent} ${category}`;
    root.setAttribute('role', category === 'layers' ? 'tree' : 'group');
    root.setAttribute(
      'aria-label',
      category === 'layers' ? 'Product layers' : 'Project components',
    );
    for (const row of root.querySelectorAll('.layer-row')) {
      row.title = row.querySelector('.layer-label').textContent;
      row.querySelector('.layer-meta').title =
        row.querySelector('.layer-meta').textContent === 'Mapped'
          ? 'Mapped to project source'
          : 'Element type';
    }
    for (const row of root.querySelectorAll('.component-card')) {
      row.title = [...row.querySelector('.component-copy').children]
        .map((node) => node.textContent)
        .join('\n');
      row.querySelector('.component-count').title = 'Instances';
    }
  };
  const liveTrigger = $('#live-status');
  const connection = document.createElement('div');
  connection.id = 'next-connection';
  connection.className = 'next-connection-popover';
  connection.setAttribute('popover', 'auto');
  connection.setAttribute('role', 'dialog');
  connection.setAttribute('aria-labelledby', 'next-connection-title');
  connection.innerHTML = `<header><span id="next-connection-title">Project connection</span></header><dl><div><dt>Runtime</dt><dd data-next-connection="runtimeConnected"></dd></div><div><dt>Live preview</dt><dd data-next-connection="connected"></dd></div><div><dt>Apply listener</dt><dd data-next-connection="listenerConnected"></dd></div></dl><button type="button" data-next-connection-details autofocus>Connection details${icon('chevronRight')}</button>`;
  connection.querySelector('header').append($('#project-name'));
  shell.append(connection);
  liveTrigger.insertAdjacentHTML('beforeend', icon('chevronDown'));
  liveTrigger.setAttribute('popovertarget', connection.id);
  liveTrigger.setAttribute('aria-controls', connection.id);
  liveTrigger.setAttribute('aria-expanded', 'false');
  liveTrigger.setAttribute('aria-label', 'Project connection');
  const positionConnection = () => {
    const rect = liveTrigger.getBoundingClientRect();
    connection.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - connection.offsetWidth - 8))}px`;
    connection.style.top = `${rect.bottom + 12}px`;
  };
  const updateConnection = () => {
    const model = state();
    for (const node of connection.querySelectorAll('[data-next-connection]')) {
      const connected = Boolean(model[node.dataset.nextConnection]);
      const label = connected
        ? 'Connected'
        : node.dataset.nextConnection === 'listenerConnected'
          ? 'Not listening'
          : 'Not connected';
      if (node.textContent !== label) node.textContent = label;
    }
  };
  connection.addEventListener('toggle', () => {
    const open = connection.matches(':popover-open');
    liveTrigger.setAttribute('aria-expanded', String(open));
    if (open) {
      updateConnection();
      positionConnection();
    }
  });
  window.addEventListener('resize', () => {
    if (connection.matches(':popover-open')) positionConnection();
  });
  liveTrigger.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    if (!connection.matches(':popover-open')) connection.showPopover();
    connection.querySelector('button').focus();
  });
  connection.querySelector('button').addEventListener('click', () => {
    connection.hidePopover();
    liveTrigger.focus();
    void openConnection?.();
  });
  renderIcons(liveTrigger);
  renderIcons(connection);
  // Tools owns workspace navigation. Keep this menu for workspace utilities only.
  const workspaceMenu = $('#workspace-menu');
  const menuTrigger = $('#workspace-menu-trigger');
  workspaceMenu
    .querySelectorAll('[data-workspace-mode], .menu-rule')
    .forEach((item) => item.remove());
  const commandTrigger = $('#command-trigger');
  commandTrigger.classList.remove('icon-button');
  commandTrigger.setAttribute('aria-label', 'Find a command');
  const commandShortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
  commandTrigger.innerHTML = `${icon('search')}<span>Find a command</span><kbd>${commandShortcut}</kbd>`;
  const connectionItem = document.createElement('button');
  connectionItem.type = 'button';
  connectionItem.dataset.nextConnectionMenu = '';
  connectionItem.innerHTML = `${icon('command')}<span>Connection details</span>`;
  const closeMenu = () => {
    workspaceMenu.hidden = true;
    menuTrigger.setAttribute('aria-expanded', 'false');
  };
  connectionItem.addEventListener('click', () => {
    closeMenu();
    menuTrigger.focus();
    void openConnection?.();
  });
  workspaceMenu.prepend(commandTrigger, connectionItem);
  menuTrigger.setAttribute('aria-controls', 'workspace-menu');
  menuTrigger.addEventListener('click', () => {
    if (!workspaceMenu.hidden) commandTrigger.focus();
  });
  workspaceMenu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      menuTrigger.focus();
    }
  });
  workspaceMenu
    .querySelector('[data-theme-choice]')
    .addEventListener('click', () => menuTrigger.focus());
  workspaceMenu.querySelector('#direct-preview-menu').addEventListener('click', closeMenu);
  renderIcons(workspaceMenu);
  for (const [id, label] of [
    ['persistent-review', 'Review changes'],
    ['command-trigger', 'Find a command'],
    ['workspace-menu-trigger', 'Open workspace menu'],
  ])
    $(`#${id}`).title = label;
  const tabs = document.createElement('nav');
  tabs.className = 'next-tabs';
  tabs.setAttribute('aria-label', 'Open views');
  tabs.innerHTML = `<div class="next-tab-list" role="tablist" aria-label="Open workspaces"><div class="next-tab-item is-selected"><button type="button" role="tab" id="next-tab-canvas" class="next-tab is-selected" data-next-canvas data-next-mode="canvas" aria-selected="true" aria-current="page" aria-controls="next-workspace-panel" title="Canvas">${icon('box')}<span>Canvas</span></button></div><div class="next-tab-item" hidden><button type="button" role="tab" id="next-tab-focus" class="next-tab" data-next-focus-tab data-next-mode="focus" hidden aria-selected="false" aria-controls="next-workspace-panel" title="Return to focused selection">${icon('external')}<span>Text focus</span></button><button type="button" class="next-tab-close" data-next-close="focus" aria-label="Close focused view" title="Close focused view">${icon('close')}</button></div></div><button type="button" class="icon-button" data-next-tools aria-label="Open tools" title="Open tools" aria-controls="studio-navigation" aria-expanded="false">${icon('plus')}</button>`;
  $('.app-identity').after(tabs);
  const tabList = tabs.querySelector('.next-tab-list');
  const workspacePanel = $('.center-workspace');
  workspacePanel.id = 'next-workspace-panel';
  workspacePanel.setAttribute('role', 'tabpanel');
  const footer = document.createElement('button');
  footer.type = 'button';
  footer.className = 'next-source-footer';
  footer.id = 'next-source-toggle';
  footer.setAttribute('aria-expanded', 'false');
  footer.setAttribute('aria-controls', 'next-source-details');
  footer.innerHTML = `${icon('file')}<span>Choose a layer</span>${icon('chevronDown')}`;
  const sourceDock = document.createElement('section');
  sourceDock.className = 'next-source-dock';
  const sourceDetails = document.createElement('div');
  sourceDetails.id = 'next-source-details';
  sourceDetails.className = 'next-source-details';
  sourceDetails.setAttribute('role', 'region');
  sourceDetails.setAttribute('aria-labelledby', footer.id);
  sourceDetails.tabIndex = 0;
  sourceDetails.hidden = true;
  sourceDock.append(footer, sourceDetails);
  $('#inspector-dock .inspector-scroll').after(sourceDock);
  const focusButton = document.createElement('button');
  focusButton.className = 'icon-button next-focus';
  focusButton.type = 'button';
  focusButton.title = 'Focus selected text';
  focusButton.setAttribute('aria-label', 'Focus selected text');
  focusButton.innerHTML = icon('external');
  $('#inspector-dock .dock-head').replaceChildren(
    Object.assign(document.createElement('strong'), { textContent: 'Inspector' }),
    focusButton,
  );
  const toolsButton = document.createElement('button');
  toolsButton.type = 'button';
  toolsButton.className = 'icon-button next-tools';
  toolsButton.setAttribute('aria-label', 'Open tools');
  toolsButton.setAttribute('aria-controls', 'studio-navigation');
  toolsButton.setAttribute('aria-expanded', 'false');
  toolsButton.title = 'Open tools';
  toolsButton.innerHTML = icon('menu');
  const toolbar = $('.canvas-toolbar');
  const toolsRule = document.createElement('span');
  toolsRule.className = 'tool-rule';
  toolbar.insertBefore(toolsButton, $('#undo'));
  toolsButton.after(toolsRule);
  toolbar
    .querySelectorAll('.tool-rule')
    .forEach((rule) => rule.setAttribute('aria-hidden', 'true'));
  for (const id of ['undo', 'redo']) $(`#${id}`).title = $(`#${id}`).getAttribute('aria-label');
  document.querySelectorAll('.canvas-toolbar [data-canvas-mode]').forEach((button) => {
    button.title = button.textContent.trim();
    button.setAttribute('aria-label', button.title);
  });
  let current = null;
  let lastSnapshot = null;
  let activeEdit = null;
  let focused = false;
  let queue = Promise.resolve();
  let sourceOpen = false;
  let category = 'empty';
  let selectionKey = '';
  const disclosureKey = (name) => `${category}:${name}`;
  const accepted = new Map();
  const expanded = new Map();
  const more = new Set();
  const linkedModes = new Map();
  let pendingLink = null;
  let variantEdit = null;
  const acceptedVariants = new Map();
  let drawingVariant = false;
  const redrawVariant = () => {
    drawingVariant = true;
    rerender();
    drawingVariant = false;
  };
  const enqueue = (task) => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  };
  const tabTools = tabs.querySelector('[data-next-tools]');
  let toolsTrigger = null;
  const positionTools = () => {
    const flyoutWidth = $('#studio-navigation').getBoundingClientRect().width;
    const centerInset = flyoutWidth / 2 + 16;
    if (toolsTrigger === toolsButton) {
      const rect = toolbar.getBoundingClientRect();
      shell.style.setProperty('--next-tools-bottom', `${innerHeight - rect.top + 8}px`);
      shell.style.setProperty(
        '--next-tools-center',
        `${Math.max(centerInset, Math.min(rect.left + rect.width / 2, innerWidth - centerInset))}px`,
      );
      return;
    }
    if (toolsTrigger !== tabTools) return;
    const rect = tabTools.getBoundingClientRect();
    shell.style.setProperty('--next-tools-top', `${tabs.getBoundingClientRect().bottom + 8}px`);
    shell.style.setProperty(
      '--next-tools-left',
      `${Math.max(16, Math.min(rect.left, innerWidth - flyoutWidth - 16))}px`,
    );
  };
  const closeTools = (restoreFocus = false) => {
    shell.classList.remove('next-tools-open', 'next-tools-from-tabs');
    toolsButton.setAttribute('aria-expanded', 'false');
    tabTools.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toolsTrigger?.focus();
  };
  const tools = (event) => {
    if (shell.classList.contains('next-tools-open') && toolsTrigger === event.currentTarget) {
      closeTools(true);
      return;
    }
    toolsTrigger = event.currentTarget;
    shell.classList.add('next-tools-open');
    shell.classList.toggle('next-tools-from-tabs', toolsTrigger === tabTools);
    toolsButton.setAttribute('aria-expanded', 'true');
    tabTools.setAttribute('aria-expanded', 'true');
    positionTools();
    $('#studio-navigation .rail-button[aria-current="page"]')?.focus();
    if (!$('#studio-navigation').contains(document.activeElement))
      $('#studio-navigation .rail-button')?.focus();
  };
  toolsButton.addEventListener('click', tools);
  tabTools.addEventListener('click', tools);
  window.addEventListener('resize', positionTools);
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('#studio-navigation, [data-next-tools], .next-tools')) closeTools();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && shell.classList.contains('next-tools-open')) {
      event.preventDefault();
      closeTools(true);
    }
  });
  tabs.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Delete') {
      const close = event.target.closest('.next-tab-item')?.querySelector('[data-next-close]');
      if (close) {
        event.preventDefault();
        close.click();
      }
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...tabs.querySelectorAll('[role="tab"], [data-next-tools]')].filter(
      (button) => !button.hidden,
    );
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
    buttons[next]
      .closest('.next-tab-item')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  $('#studio-navigation').addEventListener('click', (event) => {
    if (event.target.closest('[data-workspace-mode]')) closeTools(true);
  });
  const syncTabs = () => {
    const mode = shell.dataset.mode || 'canvas';
    if (mode !== 'canvas' && variantEdit && !variantEdit.busy) void variantAction('cancel');
    if (mode !== 'canvas' && !tabs.querySelector(`[data-next-mode="${mode}"]`)) {
      const source =
        $(`#studio-navigation [data-workspace-mode="${mode}"]`) ||
        $(`[data-workspace-mode="${mode}"]`);
      const label =
        source?.getAttribute('aria-label') || workspacePanel.getAttribute('aria-label') || mode;
      const item = document.createElement('div');
      item.className = 'next-tab-item';
      item.innerHTML = `<button type="button" role="tab" id="next-tab-${escape(mode)}" class="next-tab" data-next-mode="${escape(mode)}" aria-controls="next-workspace-panel" title="${escape(label)}"><span>${escape(label)}</span></button><button type="button" class="next-tab-close" data-next-close="${escape(mode)}" aria-label="Close ${escape(label)}" title="Close ${escape(label)}">${icon('close')}</button>`;
      const artwork = source?.querySelector('svg, [data-icon]');
      if (artwork) item.querySelector('.next-tab').prepend(artwork.cloneNode(true));
      tabList.append(item);
      renderIcons(item);
    }
    const activeMode = mode === 'canvas' && focused ? 'focus' : mode;
    for (const button of tabList.querySelectorAll('[role="tab"]')) {
      const selected = button.dataset.nextMode === activeMode;
      if (button.dataset.nextMode === 'focus') {
        button.hidden = !focused;
        button.parentElement.hidden = !focused;
      }
      button.classList.toggle('is-selected', selected);
      button.parentElement.classList.toggle('is-selected', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
      if (selected) {
        workspacePanel.setAttribute('aria-labelledby', button.id);
        button.parentElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  };
  new MutationObserver(syncTabs).observe(shell, {
    attributes: true,
    attributeFilter: ['data-mode'],
  });
  async function focus(enabled) {
    if (!current) return;
    try {
      await command('inspector-focus', { targetId: current.id, enabled });
      focused = enabled;
      tabs.querySelector('[data-next-focus-tab]').hidden = !enabled;
      focusButton.setAttribute('aria-pressed', String(enabled));
      syncTabs();
      return true;
    } catch (error) {
      showError(error.message);
      return false;
    }
  }
  focusButton.addEventListener('click', () => void focus(!focused));
  tabs.querySelector('[data-next-canvas]').addEventListener('click', async () => {
    if (focused && !(await focus(false))) return;
    navigate('canvas');
  });
  tabs.querySelector('[data-next-focus-tab]').addEventListener('click', () => navigate('canvas'));
  tabList.addEventListener('click', async (event) => {
    const close = event.target.closest('[data-next-close]');
    if (close) {
      const item = close.closest('.next-tab-item');
      const active = item.classList.contains('is-selected');
      const visible = [...tabList.children].filter((peer) => !peer.hidden);
      const index = visible.indexOf(item);
      const neighbor = visible[index - 1] || visible[index + 1];
      if (close.dataset.nextClose === 'focus') {
        if (!(await focus(false))) return;
      } else {
        // Closing a view never discards staged work or edits source.
        if (active) {
          const mode = neighbor.querySelector('[data-next-mode]').dataset.nextMode;
          if (mode === 'canvas' && focused && !(await focus(false))) return;
          navigate(mode === 'focus' ? 'canvas' : mode);
        }
        item.remove();
      }
      syncTabs();
      (active
        ? tabList.querySelector('[aria-selected="true"]')
        : neighbor?.querySelector('[role="tab"]')
      )?.focus();
      return;
    }
    const mode = event.target.closest('[data-next-mode]')?.dataset.nextMode;
    if (mode && mode !== 'canvas' && mode !== 'focus') navigate(mode);
  });
  syncTabs();
  footer.addEventListener('click', () => {
    sourceOpen = !sourceOpen;
    footer.setAttribute('aria-expanded', String(sourceOpen));
    sourceDetails.hidden = !sourceOpen;
  });
  function showError(message, field) {
    let error = $('.next-edit-error');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
    field?.setAttribute('aria-invalid', String(Boolean(message)));
  }
  function payload(control, action, value, targetId = current?.id) {
    return {
      targetId,
      targetIds: current?.targets?.map((target) => target.id) ?? [targetId],
      property: control.property,
      action,
      value: control.kind === 'number' ? Number(value) : value,
    };
  }
  async function preview(control, value, field, targetId = current.id) {
    const edit = activeEdit;
    const invalid = validateNextValue(control, String(value));
    if (invalid) {
      showError(invalid, field);
      return false;
    }
    try {
      await enqueue(() => command('inspector-draft', payload(control, 'preview', value, targetId)));
      if (activeEdit === edit) {
        showError('', field);
        const status = field?.closest('.next-property')?.querySelector('.next-field-status');
        if (status) {
          status.textContent = inspectorEditHint(state().direction, 'preview');
          status.hidden = false;
        }
      }
      return true;
    } catch (error) {
      if (activeEdit === edit) showError(error.message, field);
      return false;
    }
  }
  async function cancel(control, targetId = current.id) {
    const edit = activeEdit;
    try {
      await enqueue(() => command('inspector-draft', payload(control, 'cancel', '', targetId)));
      if (activeEdit === edit) {
        activeEdit = null;
        const cancelledLink = pendingLink === control.property;
        if (cancelledLink) pendingLink = null;
        showError('');
        rerender();
        if (cancelledLink) $(`[data-link="${control.property}"]`)?.focus();
      }
      return true;
    } catch (error) {
      showError(error.message);
      return false;
    }
  }
  async function commit(control, value, field, targetId = current.id) {
    const edit = activeEdit;
    const editKey = `${selectionKey}:${control.property}`;
    if (!(await preview(control, value, field, targetId))) return false;
    try {
      const result = await enqueue(() =>
        command('inspector-draft', payload(control, 'commit', value, targetId)),
      );
      const key = editKey;
      if (result.recorded) {
        const entry = accepted.get(key) ?? {
          before: control.mixed ? 'Mixed' : control.value,
          mixed: control.mixed,
        };
        if (String(entry.before) === String(value)) accepted.delete(key);
        else accepted.set(key, { ...entry, after: result.value, revision: result.revision });
      }
      if (activeEdit === edit) {
        activeEdit = null;
        if (pendingLink === control.property) {
          linkedModes.set(`${selectionKey}:${pendingLink}`, 'linked');
          pendingLink = null;
        }
        rerender();
      }
      return true;
    } catch (error) {
      showError(error.message, field);
      return false;
    }
  }
  function field(control) {
    const key = `${selectionKey}:${control.property}`;
    const change = accepted.get(key);
    const full =
      control.full ||
      [
        'fontFamily',
        'fontVariationSettings',
        'color',
        'backgroundColor',
        'borderColor',
        'boxShadow',
        'textContent',
        'alt',
        'aria-label',
        'gridTemplateColumns',
        'gridTemplateRows',
      ].includes(control.property);
    let input;
    if (control.property === 'fontFamily')
      input = `<button type="button" class="next-font-trigger" data-font-picker title="${escape(control.value)}">${icon('typography')}<span>${escape(control.value)}</span>${icon('chevronDown')}</button>`;
    else if (control.kind === 'select')
      input = `<select data-next-field="${escape(control.property)}" aria-label="${escape(control.label)}">${control.mixed ? '<option value="" selected disabled>Mixed</option>' : !(control.options ?? []).includes(String(control.value)) ? `<option selected>${escape(control.value)}</option>` : ''}${(control.options ?? []).map((option) => `<option ${!control.mixed && String(option) === String(control.value) ? 'selected' : ''}>${escape(option)}</option>`).join('')}</select>`;
    else
      input = `${control.kind === 'number' && !control.mixed ? `<button type="button" class="next-scrub" aria-label="Scrub ${escape(control.label)}" title="Drag to adjust ${escape(control.label)}; Shift for coarse, Alt for fine">${icon(control.category === 'typography' ? 'typography' : 'layout')}</button>` : ''}<input data-next-field="${escape(control.property)}" aria-label="${escape(control.label)}" aria-describedby="next-edit-error" type="text" ${control.kind === 'number' ? 'inputmode="decimal"' : ''} ${control.mixed ? 'placeholder="Mixed"' : ''} value="${control.mixed ? '' : escape(control.value)}">${control.unit ? `<span class="next-unit">${escape(control.unit)}</span>` : ''}`;
    return `<div class="next-property${full ? ' next-full' : ''}${change ? ' is-changed' : ''}" data-property="${escape(control.property)}"><span class="next-property-label">${escape(control.label)}</span><div class="next-field">${input}</div><p class="next-field-status" role="status" hidden></p>${change ? `<div class="next-change"><span>${escape(change.before)} → ${escape(change.after)}</span>${change.mixed || current.count > 1 ? '<span>Undo to restore each original</span>' : `<button type="button" data-reset="${escape(control.property)}" title="Reset ${escape(control.label)}" aria-label="Reset ${escape(control.label)}">${icon('undo')}</button>`}</div><p class="next-field-status">${escape(inspectorEditHint(state().direction, 'saved'))}</p>` : ''}</div>`;
  }
  function linkedGroup(property, controls) {
    const names = LINKED_INSPECTOR_GROUPS[property];
    const peers = names.map((name) => controls.find((control) => control.property === name));
    if (peers.some((peer) => !peer)) return '';
    const isPadding = property === 'paddingLinked';
    const label = isPadding ? 'Padding' : 'Corner radius';
    const combined = controls.find((control) => control.property === property);
    const mode = !combined
      ? 'independent'
      : (linkedModes.get(`${selectionKey}:${property}`) ??
        (isPadding &&
        controls.some((control) => control.property === 'paddingHorizontal') &&
        controls.some((control) => control.property === 'paddingVertical')
          ? 'paired'
          : combined && !combined.mixed
            ? 'linked'
            : 'independent'));
    const confirming = pendingLink === property;
    const fields =
      confirming || mode === 'linked'
        ? [combined]
        : mode === 'paired'
          ? ['paddingHorizontal', 'paddingVertical'].map((name) =>
              controls.find((control) => control.property === name),
            )
          : peers.map((control, index) => ({
              ...control,
              label: (isPadding
                ? ['Top', 'Right', 'Bottom', 'Left']
                : ['Top left', 'Top right', 'Bottom right', 'Bottom left'])[index],
            }));
    return `<div class="next-linked-group" data-linked-group="${property}"><div class="next-linked-head"><span>${label}</span>${combined && !confirming ? `<button type="button" data-link="${property}" aria-pressed="${mode === 'linked'}" title="${mode === 'linked' ? 'Edit values independently' : 'Link all values after choosing a replacement if they differ'}">${mode === 'linked' ? 'Unlink' : 'Link all'}</button>` : ''}</div>${confirming ? `<p class="next-link-help">These values differ. Enter a replacement for every ${isPadding ? 'side' : 'corner'}${current.count > 1 ? ` on all ${current.count} selected layers` : ''}. Nothing is accepted until you confirm.</p>` : ''}<div class="next-fields">${fields.filter(Boolean).map(field).join('')}</div>${confirming ? `<div class="next-link-actions"><button type="button" data-cancel-link="${property}">Cancel</button><button type="button" data-confirm-link="${property}">Use value</button></div>` : isPadding && mode !== 'linked' && combined && controls.some((control) => control.property === 'paddingHorizontal') && controls.some((control) => control.property === 'paddingVertical') ? `<button type="button" class="next-more" data-independent="${property}" aria-expanded="${mode === 'independent'}">Independent padding${icon('chevronDown')}</button>` : ''}</div>`;
  }
  function variantFields(snapshot) {
    const variants = snapshot.nextVariants?.variants ?? [];
    const chosen = variantEdit?.variantId ?? variants.find((variant) => variant.current)?.id ?? '';
    const edit = variantEdit;
    return `<div class="next-variants"><span class="next-property-label">Authored properties</span>${variants.length ? `<div class="next-field"><select data-next-variant aria-label="Authored variant" ${edit?.busy ? 'disabled' : ''}><option value="" disabled ${!chosen ? 'selected' : ''}>Current authored values</option>${variants.map((variant) => `<option value="${escape(variant.id)}" ${chosen === variant.id ? 'selected' : ''} ${variant.supported ? '' : 'disabled'}>${escape(variant.name)}${variant.supported ? '' : ' · unavailable'}</option>`).join('')}</select></div>` : '<div class="next-unavailable">No variants exposed</div>'}<p class="next-variant-status" role="status">${escape(edit ? edit.error || (edit.busy ? 'Waiting for preview…' : edit.ready ? 'Temporary preview. Source is unchanged. Finish or cancel this preview to edit other properties.' : 'Preview not confirmed. Retry or cancel.') : variants.length ? 'Preview an authored variant, then add it to Review.' : 'Variants appear only when authored and indexed.')}</p>${edit ? `<div class="next-link-actions"><button type="button" data-variant-cancel ${edit.busy ? 'disabled' : ''}>Cancel</button>${!edit.ready ? `<button type="button" data-variant-retry ${edit.busy ? 'disabled' : ''}>Preview again</button>` : ''}<button type="button" data-variant-use ${!edit.ready || edit.busy ? 'disabled' : ''}>Add to Review</button></div>` : ''}${variants
      .filter((variant) => !variant.supported)
      .map(
        (variant) =>
          `<p class="next-variant-status">${escape(variant.name)}: ${escape(variant.reason)}</p>`,
      )
      .join(
        '',
      )}<button type="button" class="next-more" data-next-workshop>Open Component Workshop${icon('external')}</button></div>`;
  }
  async function variantAction(action, variantId = variantEdit?.variantId) {
    if (variantEdit?.busy) return;
    if (activeEdit && !(await cancel(activeEdit.control, activeEdit.targetId))) return;
    const targetId = current?.id;
    if (!targetId) return;
    const edit = (variantEdit = { targetId, variantId, busy: true, ready: false, error: '' });
    redrawVariant();
    try {
      const result = await enqueue(() =>
        command('inspector-variant', { targetId, variantId, action }),
      );
      if (variantEdit !== edit || current?.id !== targetId) return;
      if (action === 'commit' && result.recorded)
        acceptedVariants.set(selectionKey, { id: variantId, revision: result.revision });
      if (action === 'preview') {
        edit.ready = true;
        edit.busy = false;
      } else variantEdit = null;
    } catch (error) {
      if (variantEdit !== edit) return;
      edit.busy = false;
      edit.error = error.message;
    }
    redrawVariant();
    (action === 'cancel' || action === 'commit'
      ? $('[data-next-variant]')
      : $('[data-variant-cancel]')
    )?.focus({ preventScroll: true });
    if (shell.dataset.mode !== 'canvas' && variantEdit?.ready) void variantAction('cancel');
  }
  function section(name, controls, advanced = [], allControls = [], extra = '') {
    if (!controls.length && !advanced.length && !extra) return '';
    const primary = {
      text: ['Typography', 'Appearance'],
      container: ['Layout'],
      media: ['Layout', 'Accessibility'],
      icon: ['Layout', 'Appearance'],
      component: ['Content', 'Layout'],
      multiple: ['Layout', 'Appearance'],
    };
    const open = expanded.get(disclosureKey(name)) ?? primary[category]?.includes(name);
    const showMore = more.has(disclosureKey(name));
    const linked =
      name === 'Layout'
        ? linkedGroup('paddingLinked', allControls)
        : name === 'Appearance' && category !== 'text'
          ? linkedGroup('radiusLinked', allControls)
          : '';
    return `<section class="next-section"><button type="button" class="next-section-head" data-section="${name}" aria-expanded="${open}"><strong>${name}</strong>${icon('chevronDown')}</button><div class="next-section-body" ${open ? '' : 'hidden'}><div class="next-fields">${controls.map(field).join('')}</div>${extra}${linked}${advanced.length ? `<button type="button" class="next-more" data-more="${name}" aria-expanded="${showMore}">${showMore ? 'Less' : 'More'} ${name.toLowerCase()}${icon('chevronDown')}</button><div class="next-fields" ${showMore ? '' : 'hidden'}>${advanced.map(field).join('')}</div>` : ''}</div></section>`;
  }
  async function fontPicker(control, snapshot) {
    if (activeEdit && !(await cancel(activeEdit.control, activeEdit.targetId))) return;
    const targetId = current.id;
    const dialog = document.createElement('dialog');
    dialog.className = 'next-font-picker';
    dialog.setAttribute('aria-label', 'Choose project font');
    dialog.innerHTML = `<header><strong>Project fonts</strong><button type="button" data-cancel aria-label="Cancel font selection">${icon('close')}</button></header><input type="search" aria-label="Search project fonts" placeholder="Search fonts"><div class="next-font-options"></div><p class="next-font-status" role="status">Preview a font. Source stays unchanged.</p><footer><button type="button" data-cancel>Cancel</button><button type="button" data-use disabled>Use font</button></footer>`;
    document.body.append(dialog);
    renderIcons(dialog);
    const anchor = $('.next-font-trigger').getBoundingClientRect();
    dialog.style.left = `${Math.max(8, anchor.left - 320)}px`;
    dialog.style.top = `${Math.min(anchor.top, window.innerHeight - 420)}px`;
    let candidate = null;
    let busy = false;
    activeEdit = { control, targetId };
    const status = dialog.querySelector('.next-font-status');
    const use = dialog.querySelector('[data-use]');
    const fonts = [
      ...new Set((snapshot.typography?.projectFonts ?? []).map((font) => font.family)),
    ];
    const draw = (query = '') => {
      const options = dialog.querySelector('.next-font-options');
      options.innerHTML =
        fonts
          .filter((font) => font.toLowerCase().includes(query.toLowerCase()))
          .map(
            (font) =>
              `<button type="button" data-family="${escape(font)}" aria-pressed="${candidate === font}">${escape(font)}</button>`,
          )
          .join('') || '<p>No matching project fonts.</p>';
      options.querySelectorAll('button').forEach((button) =>
        button.addEventListener('click', async () => {
          if (busy) return;
          busy = true;
          use.disabled = true;
          status.textContent = 'Loading preview…';
          const ok = await preview(control, button.dataset.family, null, targetId);
          busy = false;
          if (ok) {
            candidate = button.dataset.family;
            status.textContent = `Previewing ${candidate}`;
            use.disabled = false;
          } else status.textContent = $('.next-edit-error')?.textContent || 'Preview unavailable.';
          draw(dialog.querySelector('input').value);
        }),
      );
    };
    draw();
    dialog.querySelector('input').addEventListener('input', (event) => draw(event.target.value));
    const close = async () => {
      if (busy) return;
      if (await cancel(control, targetId)) {
        dialog.close();
        dialog.remove();
        $('.next-font-trigger')?.focus();
      }
    };
    dialog
      .querySelectorAll('[data-cancel]')
      .forEach((button) => button.addEventListener('click', close));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      void close();
    });
    use.addEventListener('click', async () => {
      if (busy || !candidate) return;
      busy = true;
      if (await commit(control, candidate, null, targetId)) {
        dialog.close();
        dialog.remove();
      } else {
        busy = false;
        status.textContent = $('.next-edit-error')?.textContent;
      }
    });
    dialog.showModal();
  }
  function bind(root, snapshot, controls) {
    if (!variantEdit && acceptedVariants.has(selectionKey)) {
      const accepted = acceptedVariants.get(selectionKey);
      const variant = snapshot.nextVariants?.variants.find((variant) => variant.id === accepted.id);
      if ((snapshot.nextInspectorRevision ?? 0) > accepted.revision && !variant?.current)
        acceptedVariants.delete(selectionKey);
      else if (variant) {
        root.querySelector('.next-variant-status').textContent =
          `${variant.name} added to Review. Source is unchanged.`;
        root.querySelector('.next-variants').classList.add('is-changed');
        root.querySelector('[data-next-variant]').value = variant.id;
      }
    }
    root
      .querySelector('[data-next-variant]')
      ?.addEventListener('change', (event) => void variantAction('preview', event.target.value));
    root
      .querySelector('[data-variant-cancel]')
      ?.addEventListener('click', () => void variantAction('cancel'));
    root
      .querySelector('[data-variant-retry]')
      ?.addEventListener('click', () => void variantAction('preview'));
    root
      .querySelector('[data-variant-use]')
      ?.addEventListener('click', () => void variantAction('commit'));
    root.querySelector('.next-variants')?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && variantEdit) {
        event.preventDefault();
        void variantAction('cancel');
      }
    });
    if (variantEdit)
      root
        .querySelectorAll(
          '[data-next-field], .next-scrub, [data-reset], [data-link], [data-independent], [data-font-picker]',
        )
        .forEach((control) => {
          control.disabled = true;
        });
    root.querySelectorAll('[data-link], [data-independent]').forEach((button) =>
      button.addEventListener('click', async () => {
        if (activeEdit && !(await cancel(activeEdit.control, activeEdit.targetId))) return;
        const property = button.dataset.link ?? button.dataset.independent;
        const key = `${selectionKey}:${property}`;
        if (button.dataset.independent)
          linkedModes.set(
            key,
            button.getAttribute('aria-expanded') === 'true' ? 'paired' : 'independent',
          );
        else if (button.getAttribute('aria-pressed') === 'true')
          linkedModes.set(key, 'independent');
        else if (controls.find((control) => control.property === property)?.mixed)
          pendingLink = property;
        else linkedModes.set(key, 'linked');
        rerender();
        (pendingLink === property
          ? $(`[data-next-field="${property}"]`)
          : $(`[data-link="${property}"]`)
        )?.focus();
      }),
    );
    root.querySelector('[data-cancel-link]')?.addEventListener('click', async () => {
      const property = pendingLink;
      const control = controls.find((control) => control.property === property);
      if (!control || !(await cancel(control))) return;
      pendingLink = null;
      rerender();
      $(`[data-link="${property}"]`)?.focus();
    });
    const confirm = root.querySelector('[data-confirm-link]');
    // Keep the input's local draft alive until this explicit acceptance runs.
    confirm?.addEventListener('pointerdown', (event) => event.preventDefault());
    confirm?.addEventListener('click', () => {
      const control = controls.find((control) => control.property === pendingLink);
      const input = root.querySelector(`[data-next-field="${pendingLink}"]`);
      if (control && input) void commit(control, input.value, input);
    });
    root.querySelectorAll('[data-section]').forEach((button) =>
      button.addEventListener('click', () => {
        const open = button.getAttribute('aria-expanded') !== 'true';
        expanded.set(disclosureKey(button.dataset.section), open);
        button.setAttribute('aria-expanded', String(open));
        button.nextElementSibling.hidden = !open;
      }),
    );
    root.querySelectorAll('[data-more]').forEach((button) =>
      button.addEventListener('click', () => {
        const key = disclosureKey(button.dataset.more);
        if (more.has(key)) more.delete(key);
        else more.add(key);
        button.setAttribute('aria-expanded', String(more.has(key)));
        button.nextElementSibling.hidden = !more.has(key);
        button.firstChild.textContent = `${more.has(key) ? 'Less' : 'More'} ${button.dataset.more.toLowerCase()}`;
      }),
    );
    root.querySelector('[data-font-picker]')?.addEventListener(
      'click',
      () =>
        void fontPicker(
          controls.find((control) => control.property === 'fontFamily'),
          snapshot,
        ),
    );
    root.querySelectorAll('[data-next-field]').forEach((input) => {
      const control = controls.find((item) => item.property === input.dataset.nextField);
      const targetId = current.id;
      let start = String(control.value);
      let timer;
      const begin = () => {
        activeEdit = { control, targetId };
      };
      input.addEventListener('focus', begin);
      input.addEventListener('input', () => {
        begin();
        clearTimeout(timer);
        // Native selects emit input before change. Their acknowledged acceptance
        // must not leave a delayed preview that can reapply the value after Undo.
        if (input.tagName === 'SELECT') return;
        timer = setTimeout(() => void preview(control, input.value, input, targetId), 160);
      });
      input.addEventListener('keydown', async (event) => {
        if (!['Enter', 'Escape'].includes(event.key)) return;
        event.preventDefault();
        clearTimeout(timer);
        if (event.key === 'Escape') {
          input.value = start;
          await cancel(control, targetId);
        } else if (await commit(control, input.value, input, targetId)) start = input.value;
      });
      input.addEventListener('blur', () => {
        clearTimeout(timer);
        // Clicking a sibling control must not silently accept an edit.
        // Errors retain their entered value, including while the preview is offline.
        if (input.getAttribute('aria-invalid') === 'true') return;
        if (pendingLink === control.property) return;
        if (activeEdit?.control === control && input.tagName !== 'SELECT') {
          if (input.value === start) activeEdit = null;
          else void cancel(control, targetId);
        }
      });
      if (input.tagName === 'SELECT')
        input.addEventListener('change', () => void commit(control, input.value, input, targetId));
      const scrub = input.parentElement.querySelector('.next-scrub');
      scrub?.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        begin();
        const x = event.clientX,
          before = Number(input.value);
        let moved = false;
        scrub.setPointerCapture(event.pointerId);
        const move = (event) => {
          const delta = event.clientX - x;
          if (!moved && Math.abs(delta) < 4) return;
          moved = true;
          const step = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
          const value = Math.min(
            control.max ?? Infinity,
            Math.max(control.min ?? -Infinity, before + delta * step),
          );
          input.value = String(Math.round(value * 1000) / 1000);
          clearTimeout(timer);
          timer = setTimeout(() => void preview(control, input.value, input, targetId), 32);
        };
        const end = async (event) => {
          clearTimeout(timer);
          scrub.removeEventListener('pointermove', move);
          scrub.removeEventListener('pointerup', end);
          scrub.removeEventListener('pointercancel', end);
          if (event.type === 'pointercancel' || !moved) await cancel(control, targetId);
          else await commit(control, input.value, input, targetId);
        };
        scrub.addEventListener('pointermove', move);
        scrub.addEventListener('pointerup', end);
        scrub.addEventListener('pointercancel', end);
      });
    });
    root.querySelectorAll('[data-reset]').forEach((button) =>
      button.addEventListener('click', () => {
        const control = controls.find((item) => item.property === button.dataset.reset);
        const entry = accepted.get(`${selectionKey}:${control.property}`);
        if (entry) {
          activeEdit = { control, targetId: current.id };
          void commit(control, entry.before);
        }
      }),
    );
  }
  function render(snapshot) {
    // A reloading/offline frame is not a user deselection. Retain the last
    // inspected controls so failed edits and variant candidates can be retried.
    // The first real snapshot (including an empty selection) replaces this cache.
    if (snapshot) lastSnapshot = snapshot;
    else if (!state().connected) snapshot = lastSnapshot;
    const selection = snapshot?.selection;
    const nextKey = (selection?.targets?.map((target) => target.id) ?? [selection?.id])
      .sort()
      .join('|');
    const sameSelection = selectionKey === nextKey;
    if (selectionKey !== nextKey) {
      activeEdit = null;
      variantEdit = null;
      pendingLink = null;
      focused = false;
      tabs.querySelector('[data-next-focus-tab]').hidden = true;
      syncTabs();
    }
    selectionKey = nextKey;
    current = selection;
    category = selectionCategory(selection);
    footer.querySelector('span').textContent = !state().connected
      ? 'Preview disconnected'
      : selection
        ? `${selection.confidence === 'instrumented' || selection.confidence === 'source-mapped' ? 'Source mapped' : 'Source details'} · Local preview`
        : 'Choose a layer';
    focusButton.hidden = !selection || selection.count !== 1;
    focusButton.title = 'Focus selected layer';
    focusButton.setAttribute('aria-label', 'Focus selected layer');
    tabs.querySelector('[data-next-focus-tab] span').textContent =
      category === 'text' ? 'Text focus' : 'Layer focus';
    $('#inspector-dock').classList.add('next-text-inspector');
    $('#inspector-dock').dataset.selectionCategory = category;
    if (!selection) {
      $('#inspector-dock .dock-head strong').textContent = 'Inspector';
      footer.disabled = true;
      sourceOpen = false;
      sourceDetails.hidden = true;
      sourceDetails.replaceChildren();
      footer.setAttribute('aria-expanded', 'false');
      $('#inspector-sections').innerHTML =
        '<div class="next-empty"><strong>Choose a layer</strong><p>Select something on the canvas or in Layers to refine it here.</p><p>Changes preview locally before Review. Your source stays unchanged.</p></div>';
      return true;
    }
    footer.disabled = false;
    sourceDetails.innerHTML = `${(selection.targets ?? [selection]).map((target) => `<code>${escape(target.source)}</code>`).join('')}<p>${escape(selection.width)} × ${escape(selection.height)} px measured</p><p>Pixel fields show computed values. Advanced CSS fields accept units and keywords.</p>`;
    $('#inspector-dock .dock-head strong').textContent =
      selection.count > 1 ? `${selection.count} layers selected` : selection.label;
    if (variantEdit?.ready) {
      if (snapshot.nextVariantPreviewId === variantEdit.variantId) variantEdit.observed = true;
      else if (variantEdit.observed) variantEdit = null;
    }
    if (activeEdit) return true;
    if (variantEdit && !drawingVariant) {
      // Keep the chooser/actions stable while refreshing the read-only measurements.
      const measurements = snapshot.nextControls ?? [];
      for (const control of [...measurements, ...linkedInspectorControls(measurements)]) {
        const input = $(`[data-next-field="${control.property}"]`);
        if (!input) continue;
        input.value = control.mixed ? '' : String(control.value);
        const unit = input.parentElement.querySelector('.next-unit');
        if (unit) unit.textContent = control.unit ?? '';
      }
      return true;
    }
    const controls = (snapshot.nextControls ?? []).map((control) => ({ ...control }));
    controls.push(...linkedInspectorControls(controls));
    for (const control of controls) {
      const key = `${selectionKey}:${control.property}`;
      const entry = accepted.get(key);
      if (!entry) continue;
      if ((snapshot.nextInspectorRevision ?? 0) < entry.revision) {
        control.value = entry.after;
        control.mixed = false;
        continue;
      }
      if (control.mixed || String(control.value) === String(entry.before)) accepted.delete(key);
      else entry.after = control.value;
    }
    const root = $('#inspector-sections');
    // Snapshot updates must not throw keyboard users back to the document body.
    const focusedButton =
      sameSelection && root.contains(document.activeElement)
        ? [
            'data-link',
            'data-independent',
            'data-section',
            'data-more',
            'data-next-variant',
            'data-variant-cancel',
            'data-variant-use',
            'data-variant-retry',
          ].flatMap((attribute) =>
            document.activeElement.hasAttribute(attribute)
              ? [[attribute, document.activeElement.getAttribute(attribute)]]
              : [],
          )[0]
        : null;
    const groups = inspectorSections(controls, category);
    const hasVariants = category === 'component' || Boolean(snapshot.nextVariants);
    if (hasVariants && !groups.some((group) => group.name === 'Content')) {
      const index = groups.findIndex((group) => group.name === 'Accessibility');
      groups.splice(index < 0 ? groups.length : index, 0, {
        name: 'Content',
        controls: [],
        advanced: [],
      });
    }
    root.innerHTML =
      groups
        .map((group) =>
          section(
            group.name,
            group.controls,
            group.advanced,
            controls,
            group.name === 'Content' && hasVariants
              ? variantFields(snapshot)
              : group.name === 'Layout' && controls.some((item) => item.property === 'objectFit')
                ? '<p class="next-media-help">Fit adds to Review. Position previews locally: Enter accepts, Escape cancels. Use percentages or keywords such as left top.</p>'
                : '',
          ),
        )
        .join('') +
      (category === 'multiple'
        ? `<p class="next-edit-help">Shared properties for ${selection.count} layers. Mixed means different values, not zero. Enter a replacement to change every selected layer. Undo restores each original.</p>`
        : '') +
      (category === 'media'
        ? `<p class="next-edit-help">${controls.some((item) => item.property === 'objectFit') ? '' : 'Fit and position apply to an image or video element, not this media wrapper. '}Asset replacement is unavailable until loading and responsive sources can be verified.${selection.kind === 'img' ? ' Alternative text can be empty for a decorative image.' : ''}</p>`
        : '') +
      (category === 'icon'
        ? '<p class="next-edit-help">SVG path fill and stroke require path-level source support. Only the exposed CSS properties can be edited here.</p>'
        : '') +
      (snapshot.motions?.length
        ? `<div class="next-context-note"><strong>Motion</strong><p>${snapshot.motions.length} detected motion ${snapshot.motions.length === 1 ? 'track' : 'tracks'}</p><button type="button" data-next-motion>Open Motion Studio</button></div>`
        : '') +
      `<p class="next-edit-help">${escape(inspectorEditHint(state().direction))}</p><p id="next-edit-error" class="next-edit-error" role="alert" hidden></p>`;
    renderIcons(root);
    bind(root, snapshot, controls);
    if (!sameSelection) $('#inspector-dock .inspector-scroll').scrollTop = 0;
    if (focusedButton)
      root
        .querySelector(`[${focusedButton[0]}="${focusedButton[1]}"]`)
        ?.focus({ preventScroll: true });
    root
      .querySelector('[data-next-workshop]')
      ?.addEventListener('click', () => navigate('components'));
    root.querySelector('[data-next-motion]')?.addEventListener('click', () => navigate('motion'));
    return true;
  }
  renderIcons(tabs);
  renderIcons(footer);
  renderIcons(focusButton);
  renderIcons(toolsButton);
  return {
    refineStructure,
    refineCanvasHeader,
    render,
    editing: () => Boolean(activeEdit),
    connectionChanged: () => {
      updateConnection();
      if (!state().connected) footer.querySelector('span').textContent = 'Preview disconnected';
    },
  };
}
