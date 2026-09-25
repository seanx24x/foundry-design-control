// The bridge sends a preorder list. Document wrappers have legacy depths that
// restart at zero below body; normalize those wrappers before building ancestry.
export function layerTreeRows(layers, collapsed = new Set(), query = '') {
  const rows = [];
  const stack = [];
  let bodyDepth = null;
  for (const layer of layers) {
    const depth =
      layer.kind === 'html'
        ? 0
        : layer.kind === 'body'
          ? rows.some((row) => row.layer.kind === 'html')
            ? 1
            : 0
          : layer.depth + (bodyDepth === null ? 0 : bodyDepth + 1);
    if (layer.kind === 'body') bodyDepth = depth;
    while (stack.length && stack.at(-1).depth >= depth) stack.pop();
    const row = {
      layer,
      depth,
      key: layer.id || layer.selector || `document:${layer.kind}`,
      parent: stack.at(-1) ?? null,
      children: [],
    };
    row.parent?.children.push(row);
    rows.push(row);
    stack.push(row);
  }
  const included = new Set();
  const search = query.trim().toLowerCase();
  for (const row of rows) {
    if (!search || `${row.layer.label} ${row.layer.kind}`.toLowerCase().includes(search)) {
      for (let current = row; current; current = current.parent) included.add(current);
    }
  }
  return rows
    .filter((row) => {
      if (!included.has(row)) return false;
      for (let parent = row.parent; parent; parent = parent.parent) {
        if (collapsed.has(parent.key)) return false;
      }
      return true;
    })
    .map((row) => ({ ...row, expandable: row.children.some((child) => included.has(child)) }));
}

export function createNextLayerTree({ root, renderIcons, onSelect }) {
  const collapsed = new Set();
  const searchCollapsed = new Set();
  let layers = [],
    query = '',
    rows = [];
  const elementFor = (key) =>
    [...root.querySelectorAll('[data-layer-key]')].find(
      (element) => element.dataset.layerKey === key,
    );
  const activeSet = () => (query ? searchCollapsed : collapsed);
  function render() {
    const focused = root.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = focused?.closest('[data-layer-key]')?.dataset.layerKey;
    const focusDisclosure = focused?.matches('[data-layer-toggle]');
    const scrollTop = root.scrollTop;
    rows = layerTreeRows(layers, activeSet(), query);
    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const { layer, key, depth, expandable } = row;
      const element = document.createElement('div');
      element.className = `layer-row${layer.selected ? ' is-selected' : ''}`;
      element.dataset.layerKey = key;
      element.dataset.layerSelector = layer.selector;
      element.style.setProperty('--depth', Math.min(depth, 10));
      element.setAttribute('role', 'treeitem');
      element.setAttribute('aria-level', depth + 1);
      element.setAttribute('aria-selected', Boolean(layer.selected));
      element.tabIndex = 0;
      element.title = layer.label;
      const toggle = document.createElement(expandable ? 'button' : 'span');
      toggle.className = 'chevron';
      if (expandable) {
        const expanded = !activeSet().has(key);
        element.setAttribute('aria-expanded', expanded);
        toggle.type = 'button';
        toggle.tabIndex = -1;
        toggle.dataset.layerToggle = '';
        toggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${layer.label}`);
        toggle.title = toggle.getAttribute('aria-label');
        toggle.innerHTML = `<i data-icon="${expanded ? 'chevronDown' : 'chevronRight'}"></i>`;
      } else toggle.setAttribute('aria-hidden', 'true');
      const icon = document.createElement('span');
      icon.className = 'layer-icon';
      icon.innerHTML = `<i data-icon="${layer.kind === 'component' ? 'component' : 'box'}"></i>`;
      const label = document.createElement('span');
      label.className = 'layer-label';
      label.textContent = layer.label;
      const meta = document.createElement('span');
      meta.className = 'layer-meta';
      meta.textContent = layer.instrumented ? 'Mapped' : layer.kind;
      element.append(toggle, icon, label, meta);
      fragment.append(element);
    }
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-inspector';
      empty.textContent = query
        ? 'No layers match this search.'
        : 'Select inside the live preview to populate the product structure.';
      fragment.append(empty);
    }
    root.replaceChildren(fragment);
    renderIcons(root);
    if (focusKey) {
      const target = elementFor(focusKey);
      (focusDisclosure ? target?.querySelector('[data-layer-toggle]') : target)?.focus({
        preventScroll: true,
      });
    }
    root.scrollTop = scrollTop;
  }
  function toggle(row, expand = activeSet().has(row.key)) {
    if (!row.expandable) return;
    if (expand) activeSet().delete(row.key);
    else activeSet().add(row.key);
    render();
  }
  root.addEventListener('click', (event) => {
    const element = event.target.closest('[data-layer-key]');
    const row = rows.find((item) => item.key === element?.dataset.layerKey);
    if (!row) return;
    if (event.target.closest('[data-layer-toggle]')) {
      event.stopPropagation();
      toggle(row);
    } else onSelect(row.layer.selector, event.shiftKey);
  });
  root.addEventListener('keydown', (event) => {
    if (!event.target.matches('[data-layer-key]')) return;
    const index = rows.findIndex((row) => row.key === event.target.dataset.layerKey);
    const row = rows[index];
    if (!row) return;
    const focusRow = (target) => target && elementFor(target.key)?.focus();
    switch (event.key) {
      case 'ArrowRight':
        if (activeSet().has(row.key)) toggle(row, true);
        else if (row.expandable) focusRow(rows[index + 1]);
        break;
      case 'ArrowLeft':
        if (row.expandable && !activeSet().has(row.key)) toggle(row, false);
        else focusRow(row.parent);
        break;
      case 'ArrowDown':
        focusRow(rows[index + 1]);
        break;
      case 'ArrowUp':
        focusRow(rows[index - 1]);
        break;
      case 'Home':
        focusRow(rows[0]);
        break;
      case 'End':
        focusRow(rows.at(-1));
        break;
      case 'Enter':
      case ' ':
        onSelect(row.layer.selector, event.shiftKey);
        break;
      default:
        return;
    }
    event.preventDefault();
  });
  return {
    update(nextLayers, nextQuery) {
      if (nextQuery !== query) searchCollapsed.clear();
      layers = nextLayers;
      query = nextQuery;
      render();
    },
  };
}
