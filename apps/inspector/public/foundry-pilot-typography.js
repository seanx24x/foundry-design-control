// Presentation only. Product specimens, exact font loading and shared fitting
// remain owned by app.js. This adapter never previews, stages or applies a font.
export function typographyPresentation({ selection, typography, candidate, state }) {
  const selected = Boolean(selection && typography);
  return {
    phase: !selected
      ? 'selection'
      : state.ready
        ? 'ready'
        : !candidate && state.label === 'Choose a candidate'
          ? 'empty'
          : 'unmeasured',
    label: selected ? state.label : 'No text selected',
    settings: selected
      ? [
          ['Size', typography.selection?.size],
          ['Weight', typography.selection?.weight],
          ['Line height', typography.selection?.lineHeight],
        ].filter(([, value]) => value != null && value !== '')
      : [],
    footer:
      'Comparisons are temporary. Use this font adds a change to Review. Local fonts are preview-only.',
  };
}

export function typographyUsageWeights(weights = []) {
  return [...new Set(weights.map(String))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .join(', ');
}

export function typographyLibraryMeta(origin, metadata) {
  if (origin === 'local') return 'Installed font · preview only';
  if (origin !== 'project') return metadata;
  const count = Number(metadata.match(/^(\d+) weights?\b/)?.[1]);
  const source = /\bproject\b/.test(metadata) ? 'Project asset' : 'Used on page';
  return Number.isFinite(count) && count > 0
    ? `${source} · ${count} ${count === 1 ? 'weight' : 'weights'}`
    : source;
}

export function refinePilotTypography(root, { selection, typography, candidate, state }) {
  const model = typographyPresentation({ selection, typography, candidate, state });
  const make = (tag, className, text) => {
    const element = root.ownerDocument.createElement(tag);
    element.className = className;
    if (text != null) element.textContent = text;
    return element;
  };
  root.classList.add('foundry-type-interior');
  root.dataset.typePhase = model.phase;
  const heading = root.querySelector('#typography-studio-stage .next-type-heading');
  heading.querySelector('span').textContent = model.label;
  heading.querySelector('span').dataset.typeStatus = state.ready ? 'measured' : 'neutral';
  const comparison = root.querySelector('.typography-comparison');
  if (comparison) {
    comparison.dataset.typeReady = String(state.ready);
    for (const card of comparison.querySelectorAll('.typography-comparison-card')) {
      // Keep every loaded specimen, measurement and action node intact. Face
      // status becomes a compact definition list in the card header.
      const metrics = card.querySelector('dl');
      metrics.classList.add('foundry-type-metrics');
      const face = metrics.firstElementChild;
      const status = make('dl', 'foundry-type-face');
      status.append(face);
      const header = card.querySelector('header');
      const title = make('div', 'foundry-type-card-title');
      while (header.firstChild) title.append(header.firstChild);
      header.append(title, status);
      if (!state.ready) metrics.hidden = true;
      const dimensionLabel = [...metrics.querySelectorAll('dt')].find(
        (label) => label.textContent === 'Rendered',
      );
      if (dimensionLabel) dimensionLabel.textContent = 'Product size';
    }

    if (model.phase === 'empty') {
      // A compact computed summary, not an imitation of an unloaded font specimen.
      const current = comparison.querySelector('.typography-comparison-card');
      current.querySelector('.next-type-unmeasured')?.remove();
      current.querySelector('footer')?.remove();
      current.querySelector('.foundry-type-face').hidden = true;
      current.querySelector('.eyebrow').textContent = 'Selected font';
      const settings = make('dl', 'foundry-type-current-settings');
      for (const [label, value] of model.settings) {
        const field = make('div', '');
        field.append(make('dt', '', label), make('dd', '', String(value)));
        settings.append(field);
      }
      current.append(settings);
      const placeholder = comparison.querySelector('.typography-comparison-placeholder');
      placeholder.querySelector('strong').textContent = 'Choose a font to compare';
      placeholder.querySelector('p').textContent =
        'Pick a family from the library. Foundry loads both faces before showing a comparison.';
      placeholder.querySelector('svg, i')?.remove();
    } else if (!state.ready) {
      // Pending, offline and failed states must not all promise an available render.
      for (const message of comparison.querySelectorAll('.next-type-unmeasured p'))
        message.textContent = state.message;
    }
  }

  for (const row of root.querySelectorAll('[data-typography-family]')) {
    const metadata = row.querySelector('code');
    if (metadata)
      metadata.textContent = typographyLibraryMeta(
        row.dataset.typographyOrigin,
        metadata.textContent,
      );
  }

  const properties = root.querySelector('.next-type-property-scroll');
  const fields = properties.querySelector('.typography-rendered-section');
  const notice = fields?.nextElementSibling;
  if (notice?.matches('.next-type-help')) fields.append(notice);
  const health = properties.querySelector('.typography-audit');
  if (fields && health) fields.after(health);

  for (const summary of properties.querySelectorAll('.next-type-disclosure > summary')) {
    const icon = make('i', '');
    icon.dataset.icon = 'chevronDown';
    summary.append(icon);
  }

  const usage = root.querySelector('.typography-usage-panel');
  if (usage) {
    for (const [index, row] of [...usage.querySelectorAll('article')].entries()) {
      const record = typography?.usages?.[index];
      if (!record) continue;
      row.querySelector('code').textContent =
        `Weights ${typographyUsageWeights(record.weights) || 'not indexed'}`;
      row.append(
        make(
          'span',
          'foundry-type-usage-count',
          `${record.count} ${record.count === 1 ? 'use' : 'uses'}`,
        ),
      );
    }
    usage.querySelector('article:last-child')?.classList.add('is-last');
  }

  root.querySelector('.typography-studio-footer > span').textContent = model.footer;
}
