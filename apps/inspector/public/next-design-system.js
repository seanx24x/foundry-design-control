// Next-only presentation. Source actions remain on the existing acknowledged paths.
export function tokenPreviewModel(token, renderedValue, connected) {
  const live = Boolean(connected && renderedValue);
  return {
    category: token?.category ?? 'other',
    value: String((live ? renderedValue : undefined) || token?.resolvedValue || token?.value || ''),
    evidence: live ? 'Rendered value from Canvas' : 'Indexed source value',
  };
}

export function systemCardDestination(title) {
  return [
    'Source of truth',
    'Impact preview',
    'Indexed alias chain',
    'System guidance',
    'Source impact',
    'Alias resolution',
  ].includes(title)
    ? 'properties'
    : 'main';
}

export function indexedImpact(usages) {
  const references = usages.filter((usage) => usage.kind !== 'literal').length;
  const files = new Set(usages.map((usage) => usage.source?.file).filter(Boolean)).size;
  const components = new Set(usages.map((usage) => usage.componentId).filter(Boolean)).size;
  return `${references} indexed ${references === 1 ? 'reference' : 'references'} across ${files} ${files === 1 ? 'file' : 'files'}. ${components ? `${components} mapped ${components === 1 ? 'component' : 'components'}.` : 'No component mappings in this index.'}`;
}

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text != null) element.textContent = text;
  return element;
};

export function createNextDesignSystem(root) {
  const detail = root.querySelector('#design-system-detail');
  const rail = node('aside', 'next-system-properties');
  rail.setAttribute('aria-label', 'Token properties');
  root.querySelector('.design-system-shell').append(rail);
  root.dataset.nextIconScope = '';
  root.querySelector('.mode-head h1').textContent = 'Design system';
  root.querySelector('.mode-head p').textContent =
    'Explore tokens, trace usage and review source improvements';
  root.querySelector('[data-system-view="promotions"]').textContent = 'Promote';
  let currentKey = '';
  let focused = null;
  const views = new Map();
  const observer = new ResizeObserver((entries) => {
    for (const { target } of entries)
      target.style.setProperty(
        '--system-scrollbar-width',
        `${target.offsetWidth - target.clientWidth}px`,
      );
  });
  return {
    capture() {
      const active = root.ownerDocument.activeElement;
      focused = root.contains(active)
        ? {
            key: currentKey,
            section: active?.tagName === 'SUMMARY' ? active.parentElement.dataset.section : null,
            token: active?.dataset.systemToken,
            promotion: active?.dataset.systemPromotion,
          }
        : null;
      if (!currentKey) return;
      views.set(currentKey, {
        main: detail.querySelector('.next-system-scroll')?.scrollTop ?? 0,
        properties: rail.querySelector('.next-system-property-scroll')?.scrollTop ?? 0,
        open: [...rail.querySelectorAll('details[open]')].map((item) => item.dataset.section),
      });
    },
    render({ token, candidate, renderedValue, connected, usages = [] }) {
      observer.disconnect();
      currentKey = token ? `token:${token.id}` : candidate ? `promotion:${candidate.id}` : '';
      const saved = views.get(currentKey);
      const head = node('header', 'next-system-heading');
      head.append(
        node('h2', '', token?.name ?? candidate?.suggestedTokenName ?? 'Design system'),
        node('span', '', candidate ? 'Promotion plan' : (token?.category ?? 'Project index')),
      );
      const scroll = node('div', 'next-system-scroll');
      const content = node('div', 'next-system-content');
      scroll.append(content);
      const propertyScroll = node('div', 'next-system-property-scroll');
      const propertyHead = node('header', 'next-system-heading');
      propertyHead.append(
        node('h2', '', 'Properties'),
        node('span', '', candidate ? 'Source plan' : 'Read only'),
      );
      rail.replaceChildren(propertyHead, propertyScroll);
      const cards = [...detail.querySelectorAll('.design-system-card')];
      if (!token && !candidate) {
        const empty = detail.firstElementChild;
        if (empty) content.append(empty);
        propertyScroll.append(
          node('p', 'next-system-help', 'Choose a token or promotion plan to inspect its source.'),
        );
      } else {
        const model = tokenPreviewModel(token ?? candidate, renderedValue, connected);
        const specimen = node('section', 'next-system-specimen');
        specimen.append(node('h3', '', candidate ? 'Value to promote' : 'Token preview'));
        const stage = node('div', 'next-system-sample');
        const sample = node('div', 'next-system-sample-shape');
        const property = { color: 'color', radius: 'border-radius', shadow: 'box-shadow' }[
          model.category
        ];
        if (property && !/var\(|url\(/i.test(model.value) && CSS.supports(property, model.value)) {
          sample.dataset.kind = model.category;
          sample.style.setProperty(
            model.category === 'color' ? 'background-color' : property,
            model.value,
          );
          stage.append(sample);
        } else if (
          model.category === 'spacing' &&
          /^\d+(?:\.\d+)?px$/.test(model.value) &&
          parseFloat(model.value) <= 160
        ) {
          const spacing = node('div', 'next-system-spacing-sample');
          spacing.style.gap = model.value;
          spacing.append(node('span', ''), node('span', ''));
          stage.append(spacing);
        } else {
          stage.append(node('code', 'next-system-value-specimen', model.value));
        }
        specimen.append(
          stage,
          node('code', 'next-system-preview-value', model.value),
          node(
            'p',
            'next-system-help',
            candidate
              ? 'Indexed authored value. This plan does not change the preview.'
              : `${model.evidence}. This sample does not edit the project.`,
          ),
        );
        content.append(specimen);
        const value = node('section', 'next-system-value-section');
        value.append(
          node('h3', '', 'Value'),
          node('code', 'next-system-property-value', model.value),
          node('p', 'next-system-help', model.evidence),
        );
        if (!connected)
          value.append(
            node('p', 'next-system-help', 'Preview offline. Live values are unavailable.'),
          );
        propertyScroll.append(value);
        for (const card of cards) {
          const title = card.querySelector('header > strong')?.textContent ?? '';
          if (title === 'Impact preview') {
            card.querySelector('header > strong').textContent = 'Indexed impact';
            card.querySelector('p').textContent = indexedImpact(usages);
          }
          if (title === 'Source impact') {
            const files = new Set(candidate.sources.map((source) => source.file)).size;
            card.querySelector('p').textContent =
              `${candidate.occurrenceCount} authored locations across ${files} ${files === 1 ? 'file' : 'files'}. The plan preserves the current rendered value.`;
          }
          if (title === 'Usage trace')
            card
              .querySelector('header')
              .after(
                node(
                  'p',
                  'next-system-trace-note',
                  'Indexed source references, not live measurements. Values can differ by theme.',
                ),
              );
          if (systemCardDestination(title) === 'main') {
            content.append(card);
          } else {
            if (title === 'System guidance') {
              const empty = card.querySelector('.design-system-empty');
              if (empty)
                empty.textContent =
                  'No findings in the current index. This is not a full visual verification.';
              if (empty) card.querySelector('header > span').textContent = 'No indexed findings';
            }
            if (
              title === 'Source of truth' ||
              title.includes('alias') ||
              title === 'Alias resolution'
            ) {
              const disclosure = node('details', 'next-system-disclosure');
              disclosure.dataset.section = title;
              const summary = node(
                'summary',
                '',
                title === 'Source of truth' ? 'Source declarations' : title,
              );
              const confidence = card.querySelector('header > span')?.textContent;
              if (title === 'Source of truth' && confidence)
                card.append(node('p', 'next-system-help', `Index confidence: ${confidence}.`));
              const arrow = node('i', '');
              arrow.dataset.icon = 'chevronDown';
              summary.append(arrow);
              card.querySelector('header')?.remove();
              disclosure.append(summary, card);
              disclosure.open = saved?.open.includes(title) ?? false;
              propertyScroll.append(disclosure);
            } else propertyScroll.append(card);
          }
        }
      }
      detail.replaceChildren(head, scroll);
      observer.observe(scroll);
      scroll.style.setProperty(
        '--system-scrollbar-width',
        `${scroll.offsetWidth - scroll.clientWidth}px`,
      );
      scroll.scrollTop = saved?.main ?? 0;
      propertyScroll.scrollTop = saved?.properties ?? 0;
      root.querySelectorAll('.design-token-row').forEach((row) => {
        row.setAttribute('aria-pressed', String(row.classList.contains('is-active')));
        row.title = [...row.querySelectorAll('strong, code')]
          .map((item) => item.textContent)
          .join(' · ');
        const count = row.querySelector('.design-token-count');
        if (count) count.title = `${count.textContent} indexed usages`;
      });
      root.querySelectorAll('.design-token-glyph').forEach((glyph) => {
        glyph.dataset.icon = 'layers';
      });
      for (const article of root.querySelectorAll('.design-system-summary article'))
        article.title = article.querySelector('small')?.textContent ?? '';
      if (focused?.section && focused.key === currentKey)
        rail
          .querySelector(`[data-section="${CSS.escape(focused.section)}"] > summary`)
          ?.focus({ preventScroll: true });
      if (focused?.token)
        root
          .querySelector(`[data-system-token="${CSS.escape(focused.token)}"]`)
          ?.focus({ preventScroll: true });
      if (focused?.promotion)
        root
          .querySelector(`[data-system-promotion="${CSS.escape(focused.promotion)}"]`)
          ?.focus({ preventScroll: true });
    },
  };
}
