// Next-only presentation. Commands remain owned by the acknowledged workspace bridge.
const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const icon = (name) => `<i data-icon="${name}"></i>`;
const pressed = (value) => `aria-pressed="${Boolean(value)}"`;

export function workshopMeasurement(value) {
  return Number.isFinite(value) ? String(Math.round(value * 10) / 10) : '—';
}

export function workshopDriftLabel(variant, drift) {
  if (!variant) return 'Not compared';
  return drift.length
    ? `${drift.length} ${drift.length === 1 ? 'difference' : 'differences'}`
    : 'No reported differences';
}

export function workshopCapabilities(component, connected) {
  const live = Boolean(connected && component?.elements?.length);
  return {
    live,
    canCreate: Boolean(live && component.variantAxes?.some((axis) => axis.canCreate)),
    reason: !connected
      ? 'Reconnect the preview to use this component.'
      : !component?.elements?.length
        ? 'This component has no rendered instance on the current page.'
        : 'No writable variant property was discovered in the source.',
  };
}

export function nextWorkshopCatalog(items, selectedKey, sourceText) {
  return items
    .map(
      (
        item,
      ) => `<button class="workshop-component-row ${item.key === selectedKey ? 'is-active' : ''}"
    data-workshop-component="${escape(item.key)}" ${pressed(item.key === selectedKey)}
    title="${escape(`${item.name}\n${sourceText(item.source)}\n${item.elements.length} live instances`)}">
    ${icon('component')}<strong>${escape(item.name)}</strong>
    <span class="next-workshop-count" aria-label="${item.elements.length} live instances">${item.elements.length}</span>
  </button>`,
    )
    .join('');
}

export function nextWorkshopPresentation({
  component,
  selectedVariant,
  variants,
  axes,
  drift,
  scopes,
  activeScope,
  stateId,
  states,
  source,
  tokenCount,
  breakpoints,
  connected,
}) {
  const capability = workshopCapabilities(component, connected);
  const liveDisabled = capability.live ? '' : 'disabled';
  const selectedInstance = component.elements.find((element) => element.selected);
  const header = (title, note = '') =>
    `<header><h3>${title}</h3>${note ? `<span>${escape(note)}</span>` : ''}</header>`;
  const instances = component.elements
    .map(
      (element, index) =>
        `<button class="workshop-instance-row ${element.selected ? 'is-active' : ''}" data-workshop-instance="${index}"
      ${pressed(element.selected)} ${liveDisabled} title="${escape(element.label)}">
      ${icon('box')}<span>${escape(element.label)}</span>
      <span class="next-workshop-measure">${workshopMeasurement(element.width)} × ${workshopMeasurement(element.height)} px</span>
      <span class="next-workshop-check">${element.selected ? icon('check') : ''}</span>
    </button>`,
    )
    .join('');
  const authoring = `<details class="next-workshop-disclosure" data-workshop-disclosure="authoring">
    <summary>${icon('plus')}<span>Create a source variant</span>${icon('chevronDown')}</summary>
    ${
      axes.length
        ? `<div class="workshop-authoring-form">
      <label>Variant property<select data-workshop-axis>${axes.map((axis) => `<option value="${escape(axis.id)}" ${axis.canCreate ? '' : 'disabled'}>${escape(axis.label)}${axis.canCreate ? '' : ' (read-only)'}</option>`).join('')}</select></label>
      <label>Start from<select data-workshop-base><option value="">Current preview</option>${variants.map((variant) => `<option value="${escape(variant.id)}">${escape(variant.name)}</option>`).join('')}</select></label>
      <label>Variant name<input data-workshop-variant-label placeholder="e.g. Danger" autocomplete="off" /></label>
      <label>Source value<input data-workshop-variant-value placeholder="e.g. danger" autocomplete="off" /></label>
      <p class="workshop-help">Creates a reviewed source change. Nothing is written until Apply.</p>
      <button class="primary-button" data-workshop-create-variant ${capability.canCreate ? '' : 'disabled'}>Add variant to Review</button>
    </div>`
        : `<p class="workshop-help">No writable Storybook, CVA or TypeScript variant property was discovered. Existing instances can still be inspected on Canvas.</p>`
    }
    ${!capability.canCreate && axes.length ? `<p class="workshop-help">${escape(capability.reason)}</p>` : ''}
  </details>`;
  const detail = `<div class="workshop-detail-head"><div>${icon('component')}<h2 title="${escape(component.name)}">${escape(component.name)}</h2></div><span class="workshop-source-state">${component.source ? 'Source mapped' : 'Read-only'}</span></div>
    <div class="next-workshop-content">
      <section class="next-workshop-section">${header('Live instances', `${component.elements.length} on this page`)}
        <p class="workshop-help">Select an instance, then open Canvas to refine its appearance in context.</p>
        <div class="workshop-instances">${instances || '<p class="workshop-help">This source definition has no live instance on the current page.</p>'}</div>
      </section>
      <section class="next-workshop-section">${header('Source authoring')}
        ${authoring}
      </section>
      <details class="next-workshop-disclosure next-workshop-drift" data-workshop-disclosure="drift">
        <summary>${icon('compare')}<span>Compare instances</span><span class="next-workshop-disclosure-status">${escape(workshopDriftLabel(selectedVariant, drift))}</span>${icon('chevronDown')}</summary>
        <p class="workshop-help">${selectedVariant ? 'Compares only explicitly instrumented variant properties, not a full visual audit.' : 'Preview an authored variant to compare the properties reported by its live instances.'}</p>
        ${drift.length ? `<div class="workshop-drift-list">${drift.map((item) => `<div><span>${escape(item.instance.label)}</span><code>${escape(item.property)}: ${escape(item.actual)} → ${escape(item.expected)}</code></div>`).join('')}</div><button class="secondary-button" data-workshop-repair-drift ${liveDisabled}>Add ${drift.length} corrections to Review</button>` : ''}
      </details>
    </div>`;
  const contract = `<header><strong>Properties</strong><span>${connected ? 'Local preview' : 'Preview offline'}</span></header>
    <div class="next-workshop-properties">
      ${
        selectedVariant
          ? `<section class="next-workshop-section">${header('Selected variant', selectedVariant.name)}<dl class="next-workshop-facts">${Object.entries(
              selectedVariant.props,
            )
              .map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`)
              .join(
                '',
              )}</dl><p class="workshop-help">Gallery preview only. No changes added to Review.</p></section>`
          : ''
      }
      ${!connected ? '<p class="next-workshop-offline" role="status">Preview offline. Your inputs are kept. Reconnect before previewing or staging a change.</p>' : ''}
      <section class="next-workshop-section">${header('Change scope')}
        <div class="workshop-scope" role="group" aria-label="Change scope">${scopes.map(([id, enabled, reason]) => `<button data-workshop-scope="${id}" class="${activeScope[0] === id ? 'is-active' : ''}" ${pressed(activeScope[0] === id)} title="${escape(selectedInstance ? reason : 'Select a live instance first')}" ${enabled && capability.live && selectedInstance ? '' : 'disabled'}>${id[0].toUpperCase()}${id.slice(1)}</button>`).join('')}</div>
        <p class="workshop-help">${escape(activeScope[2])}. Applies to subsequent edits.</p>
      </section>
      <section class="next-workshop-section">${header('Preview state')}
        <div class="workshop-state-grid" role="group" aria-label="Preview state">${states.map(([id, label]) => `<button data-workshop-state="${escape(id)}" ${pressed(stateId === id)} class="${stateId === id ? 'is-active' : ''}" ${liveDisabled} title="Preview this state in the isolated gallery">${escape(label)}</button>`).join('')}</div>
        <p class="workshop-help">Applies to the gallery previews. Canvas and source stay unchanged.</p>
      </section>
      <section class="next-workshop-section">${header('Source')}
        <dl class="next-workshop-facts"><div><dt>Mapping</dt><dd>${component.source ? 'Available' : 'Unavailable'}</dd></div><div><dt>Referenced tokens</dt><dd>${tokenCount}</dd></div></dl>
        <details class="next-workshop-disclosure" data-workshop-disclosure="source"><summary>${icon('file')}<span>Source details</span>${icon('chevronDown')}</summary><code class="next-workshop-source-path">${escape(source)}</code><p class="workshop-help">${capability.canCreate ? 'A writable variant property is available. New variants are staged for Review.' : 'Source mapping does not imply a writable variant API.'}</p></details>
      </section>
      <section class="next-workshop-section">${header('Verification')}
        <p class="workshop-help">Inspect this selection across authored contexts in State Workbench. Listed sizes are configured, not verified.</p>
        <dl class="next-workshop-facts">${breakpoints.map((point) => `<div><dt>${escape(point.label)}</dt><dd>${point.width} × ${point.height ?? 900}</dd></div>`).join('') || '<p class="workshop-help">No project breakpoints indexed.</p>'}</dl>
        <button class="secondary-button next-workshop-matrix" data-workshop-open-states ${capability.live && selectedInstance ? '' : 'disabled'} title="${selectedInstance ? 'Inspect the selected instance in State Workbench' : 'Select a live instance first'}">Open State Workbench${icon('external')}</button>
      </section>
    </div>`;
  return { detail, contract };
}

const fieldSelectors = [
  '[data-workshop-axis]',
  '[data-workshop-base]',
  '[data-workshop-variant-label]',
  '[data-workshop-variant-value]',
];
const drafts = new Map();

export function rememberWorkshopDraft(root) {
  const key = root.dataset.workshopKey;
  if (!key) return;
  const active = root.ownerDocument.activeElement;
  const attribute = [...(active?.attributes ?? [])].find((item) =>
    item.name.startsWith('data-workshop-'),
  );
  const disclosureId =
    active?.tagName === 'SUMMARY' ? active.parentElement.dataset.workshopDisclosure : null;
  drafts.set(key, {
    values: fieldSelectors.map((selector) => [selector, root.querySelector(selector)?.value]),
    disclosures: [...root.querySelectorAll('[data-workshop-disclosure]')].map((item) => [
      item.dataset.workshopDisclosure,
      item.open,
    ]),
    scroll: ['.next-workshop-scroll', '.next-workshop-properties'].map((selector) => [
      selector,
      root.querySelector(selector)?.scrollTop ?? 0,
    ]),
    focus:
      fieldSelectors.find((selector) => root.querySelector(selector) === active) ??
      (attribute ? `[${attribute.name}=${JSON.stringify(attribute.value)}]` : null) ??
      (disclosureId
        ? `[data-workshop-disclosure=${JSON.stringify(disclosureId)}] > summary`
        : null),
    selection: active?.tagName === 'INPUT' ? [active.selectionStart, active.selectionEnd] : null,
  });
}

export function restoreWorkshopDraft(root, key, syncSelect) {
  const sameComponent = root.dataset.workshopKey === key;
  root.dataset.workshopKey = key;
  const draft = drafts.get(key);
  if (!draft) return;
  for (const [selector, value] of draft.values) {
    const field = root.querySelector(selector);
    if (!field || value == null) continue;
    if (
      field.tagName === 'SELECT' &&
      ![...field.options].some((option) => option.value === value && !option.disabled)
    )
      continue;
    field.value = value;
    if (field.tagName === 'SELECT') syncSelect(field);
  }
  for (const [id, open] of draft.disclosures) {
    const details = root.querySelector(`[data-workshop-disclosure="${id}"]`);
    if (details) details.open = open;
  }
  for (const [selector, top] of draft.scroll) {
    const area = root.querySelector(selector);
    if (area) area.scrollTop = top;
  }
  const focused = sameComponent && draft.focus && root.querySelector(draft.focus);
  if (focused) {
    focused.focus({ preventScroll: true });
    if (draft.selection && focused.setSelectionRange) focused.setSelectionRange(...draft.selection);
  }
}
