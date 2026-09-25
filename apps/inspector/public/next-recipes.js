// Presentation only: preserve existing recipe, capture and acknowledged command handlers.
export function recipeMappingSummary(assessment, selected, connected) {
  if (!selected) return 'Choose a target';
  if (!connected) return assessment ? 'Last inspected mapping' : 'Preview offline';
  if (!assessment) return 'Mapping unavailable';
  return `${assessment.matched} of ${assessment.total} properties supported`;
}

export function recipeMappingLabel(mapping) {
  if (mapping.status === 'unsupported') return 'Unsupported';
  if (mapping.status === 'ambiguous') return 'Token choice needs review';
  return mapping.token ? 'Destination token' : 'Saved literal';
}

export function recipeCaptureHint(selection, canSave, connected) {
  if (!connected) return 'Reconnect Canvas to capture a treatment.';
  if (!selection) return 'Select and refine a layer on Canvas first.';
  if (!canSave)
    return 'No edited values to capture on this layer. Refine it on Canvas, then return here.';
  return 'Save the edited values on this layer as a reusable recipe. This does not apply source changes.';
}

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text != null) element.textContent = text;
  return element;
};

export function createNextRecipes(root) {
  const stage = root.querySelector('#visual-recipe-stage');
  const rail = root.querySelector('.visual-recipe-create');
  const selectionPanel = root.querySelector('#visual-recipe-selection');
  const form = root.querySelector('.visual-recipe-capture-form');
  const duplicate = root.querySelector('[data-studio-action="recipe-duplicate"]');
  const oldGate = root.querySelector('.visual-recipe-review-gate');
  duplicate.remove();
  oldGate.remove();
  const railHead = root.querySelector('.visual-recipe-create-head');
  railHead.replaceChildren(node('h2', '', 'Capture treatment'));
  const railScroll = node('div', 'next-recipe-property-scroll');
  const captureHint = node('p', 'next-recipe-help');
  const selectedDetails = node('details', 'next-recipe-details');
  selectedDetails.append(node('summary', '', 'Selected recipe'));
  const recipeInfo = node('div', 'next-recipe-info');
  selectedDetails.append(recipeInfo);
  railScroll.append(selectionPanel, captureHint, form, selectedDetails);
  rail.append(railScroll);
  root.dataset.nextIconScope = '';
  root.querySelector('.mode-head h1').textContent = 'Recipes';
  root.querySelector('.mode-head p').textContent =
    'Reuse a treatment, inspect its mapping and review the changes';
  const actions = root.querySelector('.mode-actions');
  root.querySelector('#visual-recipe-review').textContent = 'Review changes';
  const importButton = root.querySelector('#visual-recipe-import');
  importButton.className = 'secondary-button';
  importButton.textContent = 'Import recipes';
  actions.prepend(importButton, root.querySelector('#visual-recipe-export'));
  root.querySelector('.visual-recipe-browser-actions').hidden = true;
  root.querySelector('.visual-recipe-browser > footer').hidden = true;
  const canvas = node('button', 'secondary-button', 'View on Canvas');
  canvas.type = 'button';
  canvas.dataset.nextRecipeCanvas = '';
  canvas.addEventListener('click', () => document.querySelector('#next-tab-canvas')?.click());
  actions.append(canvas);
  const footer = node('footer', 'next-recipe-footer');
  footer.append(
    node('span', '', 'Mapped values enter Review as previews. Source changes only after Apply.'),
  );
  const connection = node('span', '');
  footer.append(connection);
  root.append(footer);
  const scrolls = new Map();
  let key = '';
  let focusedRecipe = null;
  const observer = new ResizeObserver((entries) =>
    entries.forEach(({ target }) =>
      target.style.setProperty(
        '--recipe-scrollbar-width',
        `${target.offsetWidth - target.clientWidth}px`,
      ),
    ),
  );
  return {
    capture() {
      focusedRecipe = root.ownerDocument.activeElement?.dataset.visualRecipe;
      if (key) scrolls.set(key, stage.querySelector('.next-recipe-scroll')?.scrollTop ?? 0);
    },
    render({ recipe, assessment, selection, connected, canSave, count }) {
      observer.disconnect();
      key = recipe?.id ?? '';
      const heading = node('header', 'next-recipe-heading');
      heading.append(
        node('h2', '', recipe?.name ?? 'Recipe library'),
        node('span', '', recipe ? `${recipe.values?.length ?? 0} saved values` : `${count} saved`),
      );
      const scroll = node('div', 'next-recipe-scroll');
      const content = node('div', 'next-recipe-content');
      scroll.append(content);
      const overview = stage.querySelector('.visual-recipe-overview');
      const remove = overview?.querySelector('[data-remove-visual-recipe]');
      if (remove) {
        remove.remove();
        remove.className = 'secondary-button next-recipe-remove';
        remove.textContent = 'Delete recipe';
        remove.disabled = !connected;
        // Existing removal handler only runs after explicit confirmation.
        remove.addEventListener(
          'click',
          (event) => {
            if (
              !window.confirm(
                `Delete the saved recipe “${recipe.name}”? This does not remove staged changes.`,
              )
            ) {
              event.preventDefault();
              event.stopImmediatePropagation();
            }
          },
          true,
        );
      }
      if (overview) {
        overview.querySelector('h2')?.remove();
        overview.querySelector('.eyebrow')?.remove();
      }
      while (stage.firstChild) content.append(stage.firstChild);
      const mapping = content.querySelector('.visual-recipe-mapping');
      if (mapping) {
        const label =
          mapping.querySelector('.recipe-compatibility') ?? node('span', 'recipe-compatibility');
        label.textContent = recipeMappingSummary(assessment, selection, connected);
        mapping.querySelector('header').append(label);
        mapping.querySelector('.eyebrow').textContent = 'Mapping to selected layer';
        const run = mapping.querySelector('[data-apply-visual-recipe]');
        if (run) {
          run.disabled = !connected || !assessment?.matched;
          run.textContent = 'Add to Review';
          mapping.querySelector('footer > span').textContent = !connected
            ? 'Reconnect Canvas before previewing these values.'
            : assessment?.ambiguous
              ? `${assessment.ambiguous} token ${assessment.ambiguous === 1 ? 'choice needs' : 'choices need'} review. Unsupported values are excluded.`
              : 'Supported values become previews in Review. Source stays unchanged.';
        }
        const rows = [...mapping.querySelectorAll('.visual-recipe-map-list article')];
        rows.forEach((row, index) => {
          const item = assessment?.mappings?.[index];
          if (!item) return;
          if (!item.token) row.querySelector(':scope > span:last-child > small')?.remove();
          row
            .querySelector(':scope > span:last-child')
            ?.append(node('small', 'next-recipe-map-status', recipeMappingLabel(item)));
        });
        if (selection && !assessment?.mappings?.length) {
          mapping
            .querySelector('.visual-recipe-map-list')
            ?.append(
              node(
                'p',
                'next-recipe-help',
                'No property mapping is available for this target. Select another target or reconnect the preview.',
              ),
            );
        }
      }
      const targets = content.querySelector('.visual-recipe-targets');
      if (targets) {
        targets.querySelector('.eyebrow')?.remove();
        targets.querySelector('header strong').textContent = 'Suggested targets';
        const targetCount = targets.querySelectorAll('[data-visual-recipe-target]').length;
        targets.querySelector('header > span').textContent =
          `${targetCount} ${targetCount === 1 ? 'suggestion' : 'suggestions'}`;
        targets.insertBefore(
          node(
            'p',
            'next-recipe-help',
            'Suggestions match recipe conditions, not verified compatibility. Select a target to inspect its actual mapping.',
          ),
          targets.querySelector(':scope > div'),
        );
        for (const target of targets.querySelectorAll('[data-visual-recipe-target]')) {
          const score = Number(target.querySelector('code')?.textContent.replace('%', ''));
          target.querySelector('code').textContent =
            score === 100
              ? 'Same component'
              : score === 84
                ? 'Same element type'
                : 'Inspect mapping';
          target.disabled = !connected;
        }
      }
      const empty = content.querySelector('.is-stage');
      if (empty && !count) {
        empty.querySelector('strong').textContent = 'Save your first treatment';
        empty.querySelector('p').textContent =
          'Refine a layer on Canvas, then give its edited values a name and intent here. When you reuse it, inspect the destination mapping before adding it to Review.';
        const go = node('button', 'secondary-button', 'Refine on Canvas');
        go.type = 'button';
        go.disabled = !connected;
        go.addEventListener('click', () => canvas.click());
        empty.append(go);
      }
      stage.replaceChildren(heading, scroll);
      const selectionText = selectionPanel.querySelector('strong');
      if (selectionText) selectionText.title = selectionText.textContent;
      selectionPanel.querySelector('small')?.remove();
      captureHint.textContent = recipeCaptureHint(selection, canSave, connected);
      root.querySelector('#visual-recipe-save').disabled = !selection || !canSave || !connected;
      canvas.disabled = !connected;
      importButton.disabled = !connected;
      root.querySelector('#visual-recipe-export').disabled = !count;
      connection.textContent = connected ? 'Preview connected' : 'Preview offline';
      recipeInfo.replaceChildren();
      selectedDetails.hidden = !recipe;
      if (recipe) {
        recipeInfo.append(
          node('strong', '', recipe.name),
          node('p', 'next-recipe-help', recipe.intent ?? 'No intent supplied.'),
          node('code', '', recipe.sourceLabel ?? 'Saved treatment'),
        );
        const conditions = [
          ...(recipe.conditions?.components ?? []),
          ...(recipe.conditions?.elementKinds ?? []),
        ];
        recipeInfo.append(
          node(
            'p',
            'next-recipe-help',
            conditions.length
              ? `Target conditions: ${conditions.join(', ')}`
              : 'No target conditions. Inspect each destination before reuse.',
          ),
        );
        duplicate.disabled = !connected;
        duplicate.textContent = 'Duplicate recipe';
        const recipeActions = node('div', 'next-recipe-actions');
        recipeActions.append(duplicate);
        if (remove) recipeActions.append(remove);
        recipeInfo.append(recipeActions);
      }
      for (const row of root.querySelectorAll('[data-visual-recipe]')) {
        row.setAttribute('aria-pressed', String(row.classList.contains('is-active')));
        row.title = row.textContent;
        const icon = node('i', '');
        icon.dataset.icon = 'copy';
        row.prepend(icon);
      }
      scroll.style.setProperty(
        '--recipe-scrollbar-width',
        `${scroll.offsetWidth - scroll.clientWidth}px`,
      );
      observer.observe(scroll);
      observer.observe(railScroll);
      scroll.scrollTop = scrolls.get(key) ?? 0;
      if (focusedRecipe)
        [...root.querySelectorAll('[data-visual-recipe]')]
          .find((row) => row.dataset.visualRecipe === focusedRecipe)
          ?.focus({ preventScroll: true });
    },
  };
}
