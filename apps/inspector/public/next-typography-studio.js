export function typographyComparisonState({ candidate, comparison, pending, connected }) {
  if (!connected)
    return {
      ready: false,
      label: 'Preview offline',
      message: 'Reconnect Canvas to measure fonts or preview changes.',
    };
  if (pending)
    return {
      ready: false,
      label: 'Measuring fonts',
      message: 'Loading the exact faces and measuring both specimens.',
    };
  if (!candidate)
    return {
      ready: false,
      label: 'Choose a candidate',
      message: 'Choose a font from the library to compare the same copy, size and layout.',
    };
  if (!comparison?.current || !comparison?.candidate)
    return {
      ready: false,
      label: 'Comparison unavailable',
      message: 'The candidate could not be rendered. Try another font or compare again.',
    };
  return {
    ready: true,
    label: 'Measured comparison',
    message:
      'Both specimens share the same copy and type settings. Metrics describe the product, not this fitted view.',
  };
}

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text != null) element.textContent = text;
  return element;
};

export function createNextTypographyStudio(root, clearComparison) {
  const stage = root.querySelector('#typography-studio-stage');
  const properties = root.querySelector('#typography-studio-properties');
  const summary = root.querySelector('#typography-selection-summary');
  const list = root.querySelector('#typography-font-list');
  root.dataset.nextIconScope = '';
  root.querySelector('.mode-head h1').textContent = 'Typography studio';
  root.querySelector('.mode-head p').textContent =
    'Compare fonts, refine rhythm and review changes';
  const cancel = node('button', 'secondary-button', 'Clear comparison');
  cancel.type = 'button';
  cancel.dataset.nextClearComparison = '';
  cancel.addEventListener('click', clearComparison);
  root.querySelector('.mode-actions').prepend(cancel);
  const sourceButton = node('button', 'secondary-button', 'View on Canvas');
  sourceButton.type = 'button';
  sourceButton.dataset.nextTypeCanvas = '';
  sourceButton.addEventListener('click', () => document.querySelector('#next-tab-canvas')?.click());
  root.querySelector('.mode-actions').append(sourceButton);
  let key = '';
  const views = new Map();
  let activeFont = null;
  const observer = new ResizeObserver((entries) =>
    entries.forEach(({ target }) =>
      target.style.setProperty(
        '--type-scrollbar-width',
        `${target.offsetWidth - target.clientWidth}px`,
      ),
    ),
  );
  return {
    isEditing() {
      const active = root.ownerDocument.activeElement;
      return (
        root.contains(active) &&
        active.matches(
          '[data-typography-control], #typography-style-name, .foundry-select-trigger[aria-expanded="true"]',
        )
      );
    },
    capture() {
      activeFont = root.ownerDocument.activeElement?.dataset.typographyFamily;
      if (!key) return;
      views.set(key, {
        main: stage.querySelector('.next-type-scroll')?.scrollTop ?? 0,
        properties: properties.querySelector('.next-type-property-scroll')?.scrollTop ?? 0,
        open: [...properties.querySelectorAll('details[open]')].map((e) => e.dataset.typeSection),
        styleName: properties.querySelector('#typography-style-name')?.value ?? '',
      });
    },
    render({ selection, typography, candidate, comparison, pending, connected }) {
      observer.disconnect();
      key = selection?.id ?? '';
      const saved = views.get(key);
      const state = typographyComparisonState({ candidate, comparison, pending, connected });
      const heading = node('header', 'next-type-heading');
      heading.append(node('h2', '', 'Font comparison'), node('span', '', state.label));
      const scroll = node('div', 'next-type-scroll');
      const content = node('div', 'next-type-content');
      scroll.append(content);
      const propertyHead = node('header', 'next-type-heading');
      propertyHead.append(
        node('h2', '', 'Properties'),
        node('span', '', connected ? 'Canvas selection' : 'Last inspected'),
      );
      const propertyScroll = node('div', 'next-type-property-scroll');
      properties.querySelector('.typography-properties-head')?.remove();
      const disclosure = (element, title, id) => {
        if (!element) return null;
        const details = node('details', 'next-type-disclosure');
        details.dataset.typeSection = id;
        details.open = saved?.open.includes(id) ?? false;
        details.append(node('summary', '', title), element);
        return details;
      };
      const treatment = stage.querySelector('.typography-treatment-panel');
      if (treatment) {
        treatment.querySelector('.eyebrow')?.remove();
        treatment.querySelector('header strong').textContent = 'Preview treatments';
        treatment.prepend(
          node(
            'p',
            'next-type-help',
            'Temporary changes on Canvas. These do not change the font-comparison specimens.',
          ),
        );
        propertyScroll.append(disclosure(treatment, 'Rhythm and type scale', 'rhythm'));
      }
      const styles = properties.querySelector('.typography-saved-styles');
      if (styles) styles.remove();
      const fields = properties.querySelector('.typography-rendered-section');
      let editNotice = null;
      if (fields) {
        fields.querySelector('header code').textContent = connected
          ? 'Computed values'
          : 'Last inspected';
        for (const field of fields.querySelectorAll('[data-typography-control]')) {
          field.closest('label').dataset.typeProperty = field.dataset.typographyControl;
          field.title = field.value;
        }
        editNotice = node(
          'p',
          'next-type-help',
          'Editing these values adds changes to Review. Source updates only after Apply.',
        );
      }
      while (properties.firstChild) propertyScroll.append(properties.firstChild);
      if (fields) propertyScroll.prepend(fields);
      if (editNotice) fields.after(editNotice);
      if (styles) {
        styles.querySelector('header')?.remove();
        propertyScroll.append(
          disclosure(styles, `Saved styles (${typography?.savedStyles?.length ?? 0})`, 'styles'),
        );
        const name = styles.querySelector('#typography-style-name');
        if (name && saved) name.value = saved.styleName;
      }
      const location = summary.querySelector('p')?.textContent;
      if (location)
        propertyScroll.append(
          disclosure(node('code', 'next-type-source', location), 'Source details', 'source'),
        );
      const auditClear = propertyScroll.querySelector('.typography-audit .is-clear');
      if (auditClear) {
        auditClear.querySelector('strong').textContent = 'No reported type issues';
        auditClear.querySelector('p').textContent =
          'No diagnostics in this snapshot. This is not a full typography or accessibility audit.';
      }
      const comparisonSection = stage.querySelector('.typography-comparison');
      if (comparisonSection) {
        comparisonSection.querySelector(':scope > header')?.remove();
        content.append(node('p', 'next-type-help', state.message));
        for (const card of comparisonSection.querySelectorAll('.typography-comparison-card')) {
          const specimenStage = card.querySelector('.typography-comparison-specimen-stage');
          if (!state.ready) {
            specimenStage.replaceChildren(
              node(
                'p',
                'next-type-help',
                pending
                  ? 'Measuring specimen…'
                  : 'Choose a candidate to render an exact comparison.',
              ),
            );
            specimenStage.className = 'next-type-unmeasured';
            // No green clipping or face claims without the paired renderable resources.
            for (const value of card.querySelectorAll('dd')) {
              value.textContent = 'Not measured';
              value.removeAttribute('data-status');
            }
          }
          const use = card.querySelector('#typography-use-candidate');
          if (use) use.disabled ||= !state.ready || candidate?.origin === 'local';
          if (use && candidate?.origin === 'local')
            use.title = 'Local fonts remain preview-only until a project source is mapped.';
        }
        const placeholder = comparisonSection.querySelector('.typography-comparison-placeholder');
        if (placeholder)
          placeholder.querySelector('p').textContent =
            'Pick a font on the left. Comparing creates no design changes.';
      }
      while (stage.firstChild) content.append(stage.firstChild);
      const usage = content.querySelector('.typography-usage-panel');
      if (usage) usage.querySelector('header strong').textContent = 'Fonts used on this page';
      for (const sample of [
        ...list.querySelectorAll('.typography-font-sample'),
        ...content.querySelectorAll('.typography-font-sample'),
      ]) {
        const icon = node('i', 'next-type-font-icon');
        icon.dataset.icon = 'typography';
        sample.replaceWith(icon);
      }
      for (const row of list.querySelectorAll('[data-typography-family]')) {
        row.title = `${row.dataset.typographyFamily} · ${row.querySelector('code')?.textContent ?? ''}`;
        const active =
          row.dataset.typographyFamily ===
          (candidate?.family ?? typography?.selection?.primaryFamily);
        row.classList.toggle('is-active', active);
        row.setAttribute('aria-pressed', String(active));
        row.disabled = pending || !connected;
        row.querySelector(':scope > svg:last-child')?.remove();
      }
      const empty = list.querySelector('.typography-studio-empty');
      const search = root.querySelector('#typography-search');
      if (empty && search.value) {
        const clearSearch = node('button', 'secondary-button', 'Clear search');
        clearSearch.type = 'button';
        clearSearch.dataset.nextClearFontSearch = '';
        clearSearch.addEventListener('click', () => {
          search.value = '';
          search.dispatchEvent(new Event('input', { bubbles: true }));
          search.focus();
        });
        empty.append(clearSearch);
      } else if (empty && list.querySelector('#typography-local-access')) {
        empty.querySelector('strong').textContent = 'Installed fonts';
        empty.querySelector('p').textContent =
          'Choose Read installed fonts to request browser permission. No access is requested automatically.';
      }
      // Uniform, neutral library icons avoid pretending unloaded fonts have rendered here.
      summary.querySelector('code')?.setAttribute('hidden', '');
      summary.querySelector('p')?.setAttribute('hidden', '');
      const selected = summary.querySelector('strong');
      if (selected) selected.title = selected.textContent;
      properties.replaceChildren(propertyHead, propertyScroll);
      stage.replaceChildren(heading, scroll);
      cancel.hidden = !candidate;
      cancel.disabled = pending;
      const compare = root.querySelector('#typography-compare');
      compare.textContent = candidate ? 'Compare again' : 'Choose a font';
      compare.disabled = !selection || !typography || pending || !connected;
      sourceButton.disabled = !connected;
      if (!connected) {
        for (const field of properties.querySelectorAll('input, select, button'))
          field.disabled = true;
      }
      root.querySelector('#typography-studio-review').textContent = 'Review changes';
      root.querySelector('.typography-studio-footer > span').textContent =
        'Comparisons are temporary. Use this font adds a reviewed change. Local fonts remain preview-only.';
      observer.observe(scroll);
      scroll.style.setProperty(
        '--type-scrollbar-width',
        `${scroll.offsetWidth - scroll.clientWidth}px`,
      );
      scroll.scrollTop = saved?.main ?? 0;
      propertyScroll.scrollTop = saved?.properties ?? 0;
      if (activeFont)
        [...list.querySelectorAll('[data-typography-family]')]
          .find((e) => e.dataset.typographyFamily === activeFont)
          ?.focus({ preventScroll: true });
    },
  };
}
