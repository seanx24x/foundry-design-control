// Next presentation only. Keep the existing motion nodes and their acknowledged handlers.
export function motionAvailability(selection, motion, connected) {
  if (!selection)
    return {
      editable: false,
      label: 'No selection',
      reason: 'Choose a layer on Canvas to inspect its motion.',
    };
  if (!connected)
    return {
      editable: false,
      label: 'Preview offline',
      reason: 'Reconnect Canvas to play or edit motion. Last inspected values are shown.',
    };
  if (!motion)
    return {
      editable: false,
      label: 'No motion',
      reason:
        'No motion was detected on this layer. Trigger its interaction on Canvas, then inspect it again.',
    };
  if (!motion.active)
    return {
      editable: false,
      label: 'Not active',
      reason: 'This transition is not active. Trigger it on Canvas to enable playback and editing.',
    };
  return {
    editable: true,
    label:
      motion.playState === 'paused'
        ? 'Paused'
        : motion.playState === 'finished'
          ? 'Finished'
          : 'Live motion',
    reason:
      'Playback is temporary. Property edits are added to Review; source stays unchanged until Apply.',
  };
}

export function motionMatches(label, source, query) {
  return `${label} ${source}`.toLowerCase().includes(query.trim().toLowerCase());
}

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text != null) element.textContent = text;
  return element;
};

export function createNextMotionStudio(root) {
  const stage = root.querySelector('#motion-studio-stage');
  const properties = root.querySelector('#motion-studio-properties');
  const list = root.querySelector('#motion-studio-list');
  const summary = root.querySelector('#motion-selection-summary');
  root.dataset.nextIconScope = '';
  root.querySelector('.mode-head h1').textContent = 'Motion studio';
  root.querySelector('.mode-head p').textContent =
    'Inspect movement, refine timing and review changes';
  const search = node('label', 'next-motion-search');
  const searchIcon = node('i', '');
  searchIcon.dataset.icon = 'search';
  const input = node('input', '');
  input.type = 'search';
  input.placeholder = 'Search motion';
  input.setAttribute('aria-label', 'Search detected motion');
  search.append(searchIcon, input);
  summary.after(search);
  const noResults = node('div', 'next-motion-no-results');
  noResults.append(node('p', '', 'No matching motion.'));
  const clear = node('button', 'secondary-button', 'Clear search');
  clear.type = 'button';
  noResults.append(clear);
  list.after(noResults);
  const filter = () => {
    const rows = [...list.querySelectorAll('[data-motion-studio-select]')];
    rows.forEach((row) => {
      row.hidden = !motionMatches(row.dataset.searchText ?? '', '', input.value);
    });
    noResults.hidden = !rows.length || rows.some((row) => !row.hidden);
  };
  input.addEventListener('input', filter);
  clear.addEventListener('click', () => {
    input.value = '';
    filter();
    input.focus();
  });
  let currentKey = '';
  let focus = null;
  const views = new Map();
  const observer = new ResizeObserver((entries) =>
    entries.forEach(({ target }) => {
      target.style.setProperty(
        '--motion-scrollbar-width',
        `${target.offsetWidth - target.clientWidth}px`,
      );
    }),
  );
  // SVG sliders are not native disabled controls. Block their existing handlers as well.
  const blockUnavailable = (event) => {
    if (
      !event.target.closest('[data-curve-handle], [data-path-point]') ||
      root.dataset.motionEditable === 'true'
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  root.addEventListener('pointerdown', blockUnavailable, true);
  root.addEventListener('keydown', blockUnavailable, true);

  return {
    isEditing() {
      const active = root.ownerDocument.activeElement;
      return (
        root.contains(active) &&
        active.matches(
          'input:not([type="search"]):not([type="range"]), .foundry-select-trigger[aria-expanded="true"]',
        )
      );
    },
    capture() {
      const active = root.ownerDocument.activeElement;
      focus = root.contains(active)
        ? {
            motion: active.dataset.motionStudioSelect,
            section: active.closest('details')?.dataset.motionSection,
            summary: active.tagName === 'SUMMARY',
          }
        : null;
      if (!currentKey) return;
      views.set(currentKey, {
        main: stage.querySelector('.next-motion-scroll')?.scrollTop ?? 0,
        properties: properties.querySelector('.next-motion-property-scroll')?.scrollTop ?? 0,
        open: [...root.querySelectorAll('details[open]')].map((item) => item.dataset.motionSection),
      });
    },
    render({ selection, motion, connected }) {
      observer.disconnect();
      currentKey = `${selection?.id ?? ''}:${motion?.id ?? ''}`;
      const saved = views.get(currentKey);
      const availability = motionAvailability(selection, motion, connected);
      root.dataset.motionEditable = String(availability.editable);
      const header = node('header', 'next-motion-heading');
      header.append(
        node('h2', '', motion?.label ?? 'Motion'),
        node('span', '', availability.label),
      );
      const scroll = node('div', 'next-motion-scroll');
      const content = node('div', 'next-motion-content');
      scroll.append(content);
      const propertyScroll = node('div', 'next-motion-property-scroll');
      const propertyHead = node('header', 'next-motion-heading');
      propertyHead.append(
        node('h2', '', 'Properties'),
        node('span', '', availability.editable ? 'Reviewable edits' : 'Read only'),
      );
      const oldPropertyHead = properties.querySelector('.motion-properties-head');
      const performanceDetail = oldPropertyHead?.querySelector('code')?.textContent;
      oldPropertyHead?.remove();
      const canvas = stage.querySelector('.motion-studio-canvas');
      const curve = properties.querySelector('.motion-curve-editor');
      const path = properties.querySelector('.motion-path-editor');
      const comparison = stage.querySelector('.motion-comparison');
      const details = (element, title, key) => {
        if (!element) return;
        const disclosure = node('details', 'next-motion-disclosure');
        disclosure.dataset.motionSection = key;
        disclosure.open = saved?.open.includes(key) ?? false;
        disclosure.append(node('summary', '', title), element);
        return disclosure;
      };
      const note = node('p', 'next-motion-notice', availability.reason);
      note.setAttribute('role', 'status');
      if (!availability.editable) content.append(note);
      if (canvas) {
        const oldHeader = canvas.querySelector('.motion-studio-canvas-head');
        const transport = canvas.querySelector('.motion-studio-transport');
        const timelineTitle = node('header', 'next-motion-section-head');
        timelineTitle.append(
          node('h3', '', 'Timeline'),
          node('span', '', oldHeader?.querySelector('.motion-source-chip')?.textContent ?? ''),
        );
        oldHeader?.replaceWith(timelineTitle);
        transport
          ?.querySelector('[data-studio-action="loop"]')
          ?.setAttribute('aria-pressed', String(Boolean(motion.looping)));
        const toggle = transport?.querySelector('[data-studio-action="toggle"]');
        if (toggle && !motion.active) toggle.textContent = 'Play';
        content.append(canvas);
        if (curve) content.append(curve);
        if (path && !path.classList.contains('is-unavailable')) content.append(path);
        if (comparison) {
          comparison.querySelector('.eyebrow')?.remove();
          const comparisonTitle = comparison.querySelector('header strong');
          if (comparisonTitle) comparisonTitle.textContent = 'Before and after paths';
          comparison.title = 'Synchronized path diagrams, not rendered product previews';
          content.append(comparison);
        }
      } else {
        while (stage.firstChild) content.append(stage.firstChild);
      }
      if (path?.classList.contains('is-unavailable')) {
        path.querySelector('header')?.remove();
        propertyScroll.append(details(path, 'Motion path unavailable', 'path'));
      }
      const source = properties.querySelector('.motion-native-source');
      if (source) source.remove();
      while (properties.firstChild) propertyScroll.append(properties.firstChild);
      if (source) propertyScroll.append(details(source, 'Source details', 'source'));
      else if (selection?.source) {
        const location = node('section', 'next-motion-source');
        location.append(
          node('h3', '', 'Selected layer source'),
          node('code', '', summary.querySelector('code')?.textContent ?? ''),
        );
        propertyScroll.append(details(location, 'Source details', 'source'));
      }
      const audit = propertyScroll.querySelector('.motion-studio-audit');
      if (audit) {
        if (performanceDetail) audit.append(node('p', 'next-motion-help', performanceDetail));
        const label = audit.querySelector('div > span > strong');
        const explanation = audit.querySelector('div > span > p');
        if (motion.reducedMotionProtected) {
          label.textContent = 'Reduced-motion heuristic';
          explanation.textContent =
            'A preference rule or short duration was detected. Verify the experience with reduced motion enabled.';
        }
      }
      const timingLabel = propertyScroll.querySelector('.motion-timing-section header code');
      if (timingLabel) timingLabel.textContent = 'Current values';
      const keyframe = propertyScroll.querySelector('.motion-studio-keyframe');
      const timing = propertyScroll.querySelector('.motion-timing-section');
      if (timing) propertyScroll.prepend(timing);
      if (keyframe && timing) timing.after(keyframe);
      properties.replaceChildren(propertyHead, propertyScroll);
      stage.replaceChildren(header, scroll);
      const selectedTitle = summary.querySelector('strong');
      if (selectedTitle) selectedTitle.title = selectedTitle.textContent;
      if (summary.querySelector('code')) summary.querySelector('code').hidden = true;
      for (const row of list.querySelectorAll('[data-motion-studio-select]')) {
        row.dataset.searchText = row.textContent;
        row.title = row.textContent.replace(/\s+/g, ' ').trim();
        row.setAttribute('aria-pressed', String(row.classList.contains('is-active')));
      }
      filter();
      for (const button of root.querySelectorAll('.mode-actions button')) {
        const action = button.dataset.studioAction;
        button.disabled =
          action === 'motion-compare'
            ? !comparison
            : action === 'motion-preview'
              ? !availability.editable
              : !selection || !connected;
        button.title = button.disabled
          ? action === 'motion-compare'
            ? 'A before and after pixel path is required for comparison.'
            : availability.reason
          : button.textContent.trim();
      }
      if (!availability.editable) {
        for (const field of root.querySelectorAll(
          '.motion-studio-canvas button, .motion-studio-canvas input, .motion-studio-canvas select, .motion-curve-editor button, .motion-curve-editor input, .motion-path-editor input, .motion-studio-fields input, .motion-studio-fields select, .motion-studio-fields button',
        ))
          field.disabled = true;
      }
      for (const handle of root.querySelectorAll('[data-curve-handle], [data-path-point]')) {
        handle.setAttribute('aria-disabled', String(!availability.editable));
        handle.setAttribute('tabindex', availability.editable ? '0' : '-1');
      }
      // A curve illustration can be previewed locally even if the product transition has ended.
      const previewCurve = curve?.querySelector('[data-curve-preview]');
      if (previewCurve) {
        previewCurve.disabled = !motion?.curve?.points?.length;
        previewCurve.textContent = 'Preview easing';
        previewCurve.title = 'Play this timing curve locally; does not change the product';
      }
      root.querySelector('#motion-studio-review').textContent = 'Review changes';
      root.querySelector('.motion-studio-footer > span').textContent =
        'Playback is temporary. Property edits go to Review before source Apply.';
      observer.observe(scroll);
      scroll.style.setProperty(
        '--motion-scrollbar-width',
        `${scroll.offsetWidth - scroll.clientWidth}px`,
      );
      scroll.scrollTop = saved?.main ?? 0;
      propertyScroll.scrollTop = saved?.properties ?? 0;
      if (focus?.motion)
        [...list.querySelectorAll('[data-motion-studio-select]')]
          .find((row) => row.dataset.motionStudioSelect === focus.motion)
          ?.focus({ preventScroll: true });
      if (focus?.summary)
        [...root.querySelectorAll('details')]
          .find((item) => item.dataset.motionSection === focus.section)
          ?.querySelector('summary')
          ?.focus({ preventScroll: true });
    },
  };
}
