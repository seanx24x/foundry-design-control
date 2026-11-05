import { foundryPilotIcon } from './foundry-pilot-icons.js';

// Presentation only. app.js owns assessments, capture drafts and all commands.
export function recipePresentation({ recipe, assessment, selection, connected, count }) {
  return {
    phase: !recipe ? (count ? 'filtered' : 'empty') : !selection ? 'target' : 'mapping',
    mappingState: !connected
      ? 'offline'
      : !selection
        ? 'target'
        : !assessment
          ? 'unavailable'
          : assessment.ambiguous || assessment.matched < assessment.total
            ? 'attention'
            : 'supported',
  };
}

export function recipePropertyLabel(property) {
  const words = String(property)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('-', ' ');
  return words ? words[0].toUpperCase() + words.slice(1).toLowerCase() : 'Property';
}

export function recipeValueLabel(mapping, connected) {
  if (mapping.status === 'unsupported') return 'Saved value · excluded';
  return connected ? 'Mapped value' : 'Last inspected value';
}

export function refinePilotRecipes(root, context) {
  const { recipe, assessment, connected } = context;
  const model = recipePresentation(context);
  const make = (tag, className, text) => {
    const node = root.ownerDocument.createElement(tag);
    node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  if (!root.classList.contains('foundry-recipe-interior')) {
    root.classList.add('foundry-recipe-interior');
    const rail = root.querySelector('.next-recipe-property-scroll');
    const selection = root.querySelector('#visual-recipe-selection');
    const hint = selection.nextElementSibling;
    const capture = make('section', 'foundry-recipe-capture-context');
    capture.append(make('h3', '', 'Selected layer'), selection, hint);
    rail.prepend(capture);
    const summary = root.querySelector('.next-recipe-details > summary');
    const chevron = make('span', 'foundry-recipe-chevron');
    chevron.innerHTML = foundryPilotIcon('chevronDown');
    summary.append(chevron);
    root.querySelector('.next-recipe-footer > span').textContent =
      'Add to Review creates preview changes. Source changes only after Apply.';
  }
  root.dataset.recipePhase = model.phase;
  const heading = root.querySelector('.next-recipe-heading h2');
  heading.title = heading.textContent;
  const overview = root.querySelector('.visual-recipe-overview');
  if (overview) {
    overview.prepend(make('h3', 'foundry-recipe-section-title', 'Treatment intent'));
  }
  const mapping = root.querySelector('.visual-recipe-mapping');
  if (mapping) {
    mapping.dataset.mappingState = model.mappingState;
    const columns = mapping.querySelector('.visual-recipe-map-columns');
    if (columns)
      columns.lastElementChild.textContent = connected ? 'Recipe value' : 'Last inspected value';
    const rows = [...mapping.querySelectorAll('.visual-recipe-map-list article')];
    rows.forEach((row, index) => {
      const item = assessment?.mappings?.[index];
      if (!item) return;
      const property = row.querySelector(':scope > span:first-child');
      property.classList.add('foundry-recipe-property');
      const name = property.querySelector('strong');
      name.textContent = recipePropertyLabel(item.property);
      name.title = item.property;
      const current = row.querySelector(':scope > code');
      const currentCell = make('span', 'foundry-recipe-current');
      current.before(currentCell);
      currentCell.append(make('small', 'foundry-recipe-value-label', 'Current'), current);
      const proposed = row.querySelector(':scope > span:last-child');
      proposed.classList.add('foundry-recipe-proposed');
      // A token reference already names its source; do not repeat that same name.
      if (item.token && item.resolvedValue === `var(${item.token.name})`)
        proposed.querySelector('small:not(.next-recipe-map-status)')?.remove();
      proposed.prepend(
        make('small', 'foundry-recipe-value-label', recipeValueLabel(item, connected)),
      );
      row.dataset.excluded = String(item.status === 'unsupported');
    });
    mapping.querySelector('header strong').title = context.selection?.label ?? '';
  }
  for (const target of root.querySelectorAll('[data-visual-recipe-target]')) {
    const glyph = make('span', 'foundry-recipe-target-icon');
    glyph.innerHTML = foundryPilotIcon('components');
    target.prepend(glyph);
  }
  for (const row of root.querySelectorAll('[data-visual-recipe]')) {
    // Real recipe names and intent remain visible; these are not fake previews.
    row.querySelector('i[data-icon]')?.remove();
    const glyph = make('span', 'foundry-recipe-library-icon');
    glyph.innerHTML = foundryPilotIcon('recipes');
    row.prepend(glyph);
  }
  const empty = root.querySelector('.visual-recipe-empty.is-stage');
  if (empty && model.phase === 'empty') {
    empty.querySelector('i, svg')?.remove();
    empty.querySelector('p').textContent =
      'Capture a treatment once, then inspect how its values map to another layer.';
    const path = make('dl', 'foundry-recipe-empty-path');
    for (const [title, detail] of [
      ['Capture', 'Refine a layer on Canvas and save its edited values.'],
      ['Map', 'Choose a target and inspect its supported properties.'],
      ['Review', 'Add mapped values to Review before any source Apply.'],
    ]) {
      const step = make('div', '');
      step.append(make('dt', '', title), make('dd', '', detail));
      path.append(step);
    }
    empty.append(path);
  }
  root.querySelector('.next-recipe-details').dataset.recipeId = recipe?.id ?? '';
}
