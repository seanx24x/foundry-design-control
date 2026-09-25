const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

export function specimenPlacement(rect, width, height) {
  if (
    ![rect.x, rect.y, rect.width, rect.height, width, height].every(Number.isFinite) ||
    rect.width <= 0 ||
    rect.height <= 0
  )
    throw new Error('Invalid component geometry');
  const scale = Math.min(
    1,
    Math.max(1, width - 48) / rect.width,
    Math.max(1, height - 48) / rect.height,
  );
  return {
    scale,
    x: (width - rect.width * scale) / 2 - rect.x * scale,
    y: (height - rect.height * scale) / 2 - rect.y * scale,
  };
}

export function specimenUrl(previewUrl) {
  const url = new URL(previewUrl);
  url.searchParams.set('__foundry_embedded', '1');
  url.searchParams.set('__foundry_frame', 'component-specimen');
  url.searchParams.delete('__foundry_child');
  url.searchParams.delete('__foundry_verification');
  return url.href;
}

export function galleryRenderKey(next) {
  return JSON.stringify([
    next.component.key,
    next.component.elements.map((element) => element.selector ?? element.id),
    next.variants,
    next.instanceIndex,
    next.viewport,
    next.theme,
    next.state,
    next.previewUrl,
    next.connected,
  ]);
}

export function specimenStateUrl(previewUrl, result) {
  const url = new URL(specimenUrl(previewUrl));
  for (const key of result.managedStateKeys ?? []) {
    if (!key.startsWith('__foundry_')) url.searchParams.delete(key);
  }
  for (const [key, value] of Object.entries(result.reloadQuery)) {
    if (key.startsWith('__foundry_'))
      throw new Error('Authored states cannot replace preview connection parameters.');
    url.searchParams.set(key, String(value));
  }
  return url.href;
}

export function createWorkshopGallery({ root, heading, request, invalidate, onSelect }) {
  let model = null;
  let signature = '';
  let page = 0;
  let entries = [];
  let generation = 0;
  const pageSize = 6;
  const observer = new ResizeObserver(() => entries.forEach(layout));
  function layout(entry) {
    if (!entry.result) return;
    const place = specimenPlacement(
      entry.result.rect,
      entry.stage.clientWidth,
      entry.stage.clientHeight,
    );
    entry.frame.style.transform = `translate(${place.x}px, ${place.y}px) scale(${place.scale})`;
    entry.measure.textContent = `${Math.round(entry.result.rect.width)} × ${Math.round(entry.result.rect.height)} · ${Math.round(place.scale * 100)}%`;
  }
  function clear() {
    generation++;
    observer.disconnect();
    entries.forEach((entry) => {
      clearTimeout(entry.timeout);
      invalidate(entry.frame, 'Component preview closed.');
      entry.frame.remove();
    });
    entries = [];
  }
  function fail(entry, message) {
    if (!entries.includes(entry)) return;
    entry.attempt++;
    invalidate(entry.frame, 'Component preview unavailable.');
    entry.ready = false;
    entry.status.textContent = 'Preview unavailable';
    entry.note.hidden = false;
    entry.note.textContent = message;
    entry.retry.hidden = false;
    entry.frame.style.visibility = 'hidden';
    entry.card.dataset.ready = 'false';
    entry.select.disabled = true;
    clearTimeout(entry.timeout);
  }
  async function render(entry) {
    if (entry.started || !entries.includes(entry)) return;
    entry.started = true;
    entry.status.textContent = 'Rendering…';
    const revision = generation;
    const attempt = entry.attempt;
    try {
      const result = await request(
        entry.frame,
        'render-component-specimen',
        {
          componentId: model.component.key,
          variantId: entry.variant.id,
          instanceIndex: model.instanceIndex,
          theme: model.theme,
          state: model.state,
        },
        { timeoutMs: 12000 },
      );
      if (revision !== generation || attempt !== entry.attempt || !entries.includes(entry)) return;
      if (result?.reloadQuery) {
        if (entry.stateReloaded) throw new Error('The authored route did not activate this state.');
        entry.stateReloaded = true;
        start(entry, specimenStateUrl(model.previewUrl, result));
        return;
      }
      if (!result?.rendered || !result.evidence?.fontsReady || !result.evidence?.stable)
        throw new Error('The project did not confirm a rendered component.');
      entry.result = result;
      entry.ready = true;
      entry.lastSeen = Date.now();
      entry.status.textContent = 'Rendered';
      entry.note.hidden = true;
      entry.retry.hidden = true;
      entry.select.disabled = false;
      entry.card.dataset.ready = 'true';
      entry.stage.style.background = result.background;
      layout(entry);
      entry.frame.style.visibility = 'visible';
      clearTimeout(entry.timeout);
    } catch (error) {
      if (revision === generation && attempt === entry.attempt) fail(entry, error.message);
    }
  }
  function start(entry, url = specimenUrl(model.previewUrl)) {
    entry.attempt = (entry.attempt ?? 0) + 1;
    entry.started = false;
    entry.ready = false;
    entry.result = null;
    entry.card.dataset.ready = 'false';
    entry.select.disabled = true;
    entry.retry.hidden = true;
    entry.note.hidden = false;
    entry.note.textContent = 'Loading the project…';
    entry.status.textContent = 'Connecting…';
    entry.frame.style.visibility = 'hidden';
    clearTimeout(entry.timeout);
    entry.timeout = setTimeout(
      () =>
        fail(entry, 'The project preview did not connect. Check the preview server, then retry.'),
      15000,
    );
    entry.frame.src = url;
  }
  function paint() {
    clear();
    const variants = model.variants.length
      ? model.variants
      : [{ id: '', name: 'Current component', props: {} }];
    const totalPages = Math.ceil(variants.length / pageSize);
    page = Math.min(page, totalPages - 1);
    const slice = variants.slice(page * pageSize, (page + 1) * pageSize);
    root.hidden = false;
    root.innerHTML = `<div class="next-gallery-intro"><h3>${model.variants.length ? 'Variants' : 'Component preview'}</h3><p>Real project rendering. Select a preview to inspect its options. Source stays unchanged.</p></div>
      <div class="next-gallery-grid">${slice.map((variant, index) => `<article class="next-specimen" data-specimen-id="${escape(variant.id)}"><header><strong>${escape(variant.name)}</strong><span data-specimen-status>Connecting…</span></header><div class="next-specimen-stage"><iframe title="${escape(model.component.name)}: ${escape(variant.name)} live preview" tabindex="-1" aria-hidden="true" inert style="width:${model.viewport.width}px;height:${model.viewport.height}px"></iframe><button class="next-specimen-select" data-specimen-index="${index}" aria-label="Select ${escape(variant.name)} preview" aria-pressed="${model.selectedVariantId === variant.id}" disabled></button><p class="next-specimen-note" role="status">Loading the project…</p></div><footer><span data-specimen-measure>Not measured</span><button class="secondary-button" data-specimen-retry hidden>Retry preview</button></footer></article>`).join('')}</div>
      ${totalPages > 1 ? `<nav class="next-gallery-pages" aria-label="Variant pages"><button class="secondary-button" data-gallery-prev ${page === 0 ? 'disabled' : ''}>Previous</button><span>${page + 1} of ${totalPages}</span><button class="secondary-button" data-gallery-next ${page === totalPages - 1 ? 'disabled' : ''}>Next</button></nav>` : ''}`;
    entries = [...root.querySelectorAll('.next-specimen')].map((card, index) => ({
      card,
      variant: slice[index],
      frame: card.querySelector('iframe'),
      stage: card.querySelector('.next-specimen-stage'),
      status: card.querySelector('[data-specimen-status]'),
      note: card.querySelector('.next-specimen-note'),
      retry: card.querySelector('[data-specimen-retry]'),
      measure: card.querySelector('[data-specimen-measure]'),
      select: card.querySelector('.next-specimen-select'),
      started: false,
      ready: false,
      lastSeen: 0,
    }));
    for (const entry of entries) {
      observer.observe(entry.stage);
      entry.select.addEventListener('click', () => {
        if (entry.ready) onSelect(entry.variant.id);
      });
      entry.retry.addEventListener('click', () => {
        invalidate(entry.frame, 'Retrying component preview.');
        entry.stateReloaded = false;
        start(entry);
      });
      entry.frame.addEventListener('load', () => {
        // Commands are sent only after the authenticated adapter handshake, not iframe load.
        if (entry.ready) fail(entry, 'The project reloaded. Retry to render this variant again.');
      });
      start(entry);
    }
    root.querySelector('[data-gallery-prev]')?.addEventListener('click', () => {
      page--;
      paint();
    });
    root.querySelector('[data-gallery-next]')?.addEventListener('click', () => {
      page++;
      paint();
    });
  }
  return {
    update(next) {
      const key = galleryRenderKey(next);
      model = next;
      heading.hidden = false;
      heading.innerHTML = `<div><h2>${escape(model.component.name)}</h2><span>${model.variants.length ? `${model.variants.length} authored variants` : 'Live component'}</span></div><span>${model.viewport.width}px viewport</span>`;
      if (key !== signature) {
        signature = key;
        page = 0;
        if (!next.connected || !next.previewUrl || !next.component.elements.length) {
          clear();
          root.hidden = false;
          root.innerHTML =
            '<div class="next-gallery-intro"><h3>Live preview unavailable</h3><p>Connect the project and choose a component rendered on this page.</p></div>';
        } else paint();
      }
      for (const entry of entries) {
        const active = entry.variant.id === model.selectedVariantId;
        entry.card.classList.toggle('is-selected', active);
        entry.select.setAttribute('aria-pressed', String(active));
      }
    },
    receive(event) {
      if (
        !model ||
        event.origin !== new URL(model.previewUrl).origin ||
        event.data?.sessionId !== model.sessionId
      )
        return false;
      const entry = entries.find((item) => item.frame.contentWindow === event.source);
      if (!entry) return false;
      if (event.data?.type === 'foundry:workspace-state' && event.data.payload?.specimenReady)
        void render(entry);
      return true;
    },
    ping() {
      for (const entry of entries) {
        if (!entry.ready || entry.pinging) continue;
        entry.pinging = true;
        request(entry.frame, 'preview-ping', { sentAt: Date.now() }, { timeoutMs: 2500 })
          .then((result) => {
            if (result?.alive) entry.lastSeen = Date.now();
          })
          .catch(() => {
            if (Date.now() - entry.lastSeen >= 5000)
              fail(entry, 'Preview disconnected. Reconnect the project, then retry.');
          })
          .finally(() => {
            entry.pinging = false;
          });
      }
    },
    destroy() {
      clear();
      signature = '';
      model = null;
      root.replaceChildren();
      root.hidden = true;
      heading.hidden = true;
      heading.replaceChildren();
    },
  };
}
