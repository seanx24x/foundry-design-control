import { foundryPilotIcon, foundryPilotPropertyIcon } from './foundry-pilot-icons.js';

// Presentation only: values are never written back to the project or Review.
export function systemCategoryRole(category) {
  return (
    {
      color: 'designSystem',
      spacing: 'gap',
      size: 'frame',
      radius: 'borderRadius',
      shadow: null,
      typography: 'typography',
      motion: 'motion',
    }[category] ?? (category === 'shadow' ? null : 'layers')
  );
}

// CSS validity alone cannot establish that a value is independent of Foundry's
// own theme, fonts, viewport, or inherited styles. Such values stay literal.
export function systemSampleCanRender(category, value) {
  const text = String(value).trim();
  if (
    !text ||
    /(?:var|url|env|attr)\s*\(/i.test(text) ||
    /\b(?:currentcolor|inherit|initial|unset|revert(?:-layer)?)\b/i.test(text) ||
    /(?:\d|\.)(?:r?em|ex|ch|cap|ic|lh|rlh|[sld]?v[whib]|[sld]?vmin|[sld]?vmax|cq\w+|%)\b/i.test(
      text,
    ) ||
    (category !== 'color' &&
      /%/.test(text.replace(/(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)[a-z]*\([^)]*\)/gi, ''))) ||
    /\blight-dark\s*\(|\b(?:canvastext|canvas|linktext|visitedtext|activetext|buttonface|buttontext|buttonborder|fieldtext|field|highlighttext|highlight|selecteditemtext|selecteditem|marktext|mark|graytext|accentcolortext|accentcolor)\b/i.test(
      text,
    )
  )
    return false;
  return ['color', 'spacing', 'radius', 'shadow'].includes(category);
}

export function promotionImpactText(candidate) {
  const files = new Set((candidate.sources ?? []).map((source) => source.file).filter(Boolean))
    .size;
  const count = candidate.occurrenceCount ?? 0;
  return `${count} authored ${count === 1 ? 'location' : 'locations'} across ${files} ${files === 1 ? 'file' : 'files'}. ${candidate.relation === 'near' ? 'The nearest token may change appearance; review the value difference, rebuild and verify.' : 'Intended to preserve the authored value; rebuild and verification are still required.'}`;
}

const element = (doc, tag, className, text) => {
  const node = doc.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

export function refinePilotSystem(
  root,
  { token, candidate, model, items = [], renderedValues = {}, connected },
) {
  const doc = root.ownerDocument;
  const make = (tag, className, text) => element(doc, tag, className, text);
  root.classList.add('foundry-system-interior');
  const specimen = root.querySelector('.next-system-specimen');
  if (specimen) {
    const stage = specimen.querySelector('.next-system-sample');
    const value = specimen.querySelector('.next-system-preview-value');
    const help = specimen.querySelector('.next-system-help');
    const title = specimen.querySelector('h3');
    title.textContent = candidate ? 'Value to promote' : 'Appearance';
    stage.setAttribute('aria-hidden', 'true'); // The value is expressed in adjacent text.
    const visual = stage.firstElementChild;
    const isVisual = visual && !visual.matches('.next-system-value-specimen');
    specimen.dataset.sample = isVisual ? model.category : 'literal';
    const body = make('div', 'foundry-system-specimen-body');
    const metadata = make('div', 'foundry-system-specimen-meta');
    const live = !candidate && model.evidence === 'Rendered value from Canvas';
    metadata.append(
      make('span', 'foundry-system-evidence', live ? 'Canvas value' : 'Indexed value'),
      value,
    );
    help.textContent = isVisual
      ? candidate
        ? 'Isolated source sample. The project is unchanged.'
        : `${live ? 'Measured on the connected Canvas.' : 'From the current source index.'} Shown in isolation, not in product context.`
      : 'Literal value. A reliable visual sample needs the project context.';
    metadata.append(help);
    if (isVisual) body.append(stage);
    else stage.remove();
    body.append(metadata);
    specimen.replaceChildren(title, body);

    const source = root.querySelector('.next-system-value-section');
    source.querySelector('h3').textContent = 'Source value';
    source.querySelector('code').textContent = String(token?.value ?? candidate?.value ?? '');
    source.querySelector('p').textContent = 'Authored declaration. May differ by theme or context.';
  }

  for (const card of root.querySelectorAll('.design-system-card')) {
    const title = card.querySelector('header > strong')?.textContent;
    card.dataset.systemSection = title ?? '';
    const list = card.querySelector('.design-usage-list');
    if (list?.querySelector('article')) {
      const columns = make('div', 'foundry-system-usage-head');
      columns.setAttribute('aria-hidden', 'true');
      for (const label of ['Kind', 'Property / source', 'Authored value'])
        columns.append(make('span', '', label));
      list.before(columns);
    }
    if (title === 'Recommended plan') card.classList.add('foundry-system-plan');
    if (title === 'System guidance') {
      const status = card.querySelector('header > span');
      status.dataset.systemStatus = card.querySelector('.design-system-empty')
        ? 'neutral'
        : 'warning';
    }
  }

  const records = new Map(items.map((item) => [item.id, item]));
  for (const row of root.querySelectorAll('.design-token-row')) {
    const item = records.get(row.dataset.systemToken ?? row.dataset.systemPromotion);
    if (!item) continue;
    // The preview model also rejects stale bridge values while disconnected.
    const swatch = row.querySelector('.design-token-swatch');
    if (swatch) {
      const previewValue = String(
        (connected && renderedValues[item.id]) || item.resolvedValue || item.value || '',
      );
      row.title = `${item.name} · ${previewValue}`;
      if (systemSampleCanRender('color', previewValue) && CSS.supports('color', previewValue))
        swatch.style.setProperty('--token-color', previewValue);
      else swatch.style.setProperty('--token-color', 'transparent');
    }
    const glyph = row.querySelector('.design-token-glyph');
    if (glyph) {
      const role = systemCategoryRole(item.category);
      glyph.removeAttribute('data-icon');
      glyph.dataset.pilotProperty = '';
      glyph.innerHTML = (role && (foundryPilotPropertyIcon(role) ?? foundryPilotIcon(role))) ?? '';
    }
    // Promotion values can be identical across properties. Retain the token name
    // as a visible second line so each plan is identifiable before selection.
    if (candidate)
      row.title = `${item.property ?? item.category} · ${item.value} · ${item.suggestedTokenName}`;
  }
}
