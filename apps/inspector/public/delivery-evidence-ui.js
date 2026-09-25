import { matchingDeliveryCaptures } from 'foundry-design-protocol/engineering-verification';

const escape = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export function deliveryEvidenceGroups(record) {
  const matched = new Set();
  const groups = matchingDeliveryCaptures(record).map((pair) => {
    const indexes = [record.evidence.indexOf(pair.before), record.evidence.indexOf(pair.after)];
    indexes.forEach((index) => matched.add(index));
    return { matched: true, indexes };
  });
  record.evidence.forEach((evidence, index) => {
    if (evidence.capture && !matched.has(index)) groups.push({ matched: false, indexes: [index] });
  });
  return groups;
}

// Object URLs are scoped to this inspector page, never credential-bearing links.
export function createDeliveryEvidenceUI({ readImage }) {
  const images = new Map();
  const requests = new Map();
  const keyFor = (record, index) =>
    `${record.id}:${index}:${record.evidence[index]?.capture?.sha256 ?? ''}`;
  function content(record, index) {
    const evidence = record.evidence[index];
    const key = keyFor(record, index);
    const url = images.get(key);
    return url
      ? `<img src="${escape(url)}" alt="${escape(evidence.label)}" decoding="async" />`
      : '<button class="secondary-button" data-load-evidence>Load captured image</button>';
  }
  function markup(record) {
    const groups = deliveryEvidenceGroups(record);
    const issues = record.captureIssues ?? [];
    const figure = (index) => {
      const evidence = record.evidence[index];
      const proof = evidence.capture;
      return `<figure data-delivery-evidence="${index}"><figcaption><strong>${proof.phase === 'before' ? 'Before source edit' : proof.phase === 'rebuilt' ? 'Rebuilt product' : 'Temporary preview'}</strong><small>${escape(proof.context.breakpoint)} · ${escape(proof.context.theme)} · ${escape(proof.context.state)} · ${proof.viewport.width} × ${proof.viewport.height}</small></figcaption><div class="delivery-capture-image">${content(record, index)}</div><small>Source ${escape(proof.sourceRevision || 'revision unavailable')}</small></figure>`;
    };
    return `<section class="delivery-capture-evidence"><header><span class="eyebrow">Recorded screenshots</span><h3>Before and rebuilt</h3><p>Source revision, target, context and capture conditions travel with each image. Rendered verification remains the acceptance evidence.</p></header>${groups.length ? groups.map((group) => `<section class="delivery-capture-group"><p>${group.matched ? 'Matching context and capture conditions' : 'Individual capture. No comparable before/rebuilt pair is recorded.'}</p><div class="delivery-capture-grid">${group.indexes.map(figure).join('')}</div></section>`).join('') : '<p class="delivery-capture-unavailable">No authenticated source captures are recorded for this handoff.</p>'}${issues.length ? `<details class="delivery-capture-issues"><summary>Capture limitations (${issues.length})</summary><ul>${issues.map((issue) => `<li>${escape(issue)}</li>`).join('')}</ul></details>` : ''}</section>`;
  }
  function bind(root, record) {
    root.querySelectorAll('[data-delivery-evidence]').forEach((figure) => {
      const button = figure.querySelector('[data-load-evidence]');
      if (!button) return;
      const index = Number(figure.dataset.deliveryEvidence);
      button.addEventListener('click', async () => {
        const key = keyFor(record, index);
        button.disabled = true;
        button.textContent = 'Loading image…';
        try {
          if (!requests.has(key))
            requests.set(
              key,
              readImage(record.id, index)
                .then((blob) => {
                  if (blob.type !== 'image/png')
                    throw new Error('The runtime did not return a validated PNG capture.');
                  const url = URL.createObjectURL(blob);
                  images.set(key, url);
                  return url;
                })
                .finally(() => requests.delete(key)),
            );
          await requests.get(key);
          if (figure.isConnected) {
            figure.querySelector('.delivery-capture-image').innerHTML = content(record, index);
            figure.querySelector('[data-evidence-error]')?.remove();
          }
        } catch (error) {
          if (!figure.isConnected) return;
          button.disabled = false;
          button.textContent = 'Retry image';
          let message = figure.querySelector('[data-evidence-error]');
          if (!message) {
            message = document.createElement('p');
            message.dataset.evidenceError = '';
            message.setAttribute('role', 'alert');
            figure.append(message);
          }
          message.textContent = error instanceof Error ? error.message : 'Image unavailable.';
        }
      });
    });
  }
  function dispose() {
    for (const url of images.values()) URL.revokeObjectURL(url);
    images.clear();
  }
  window.addEventListener('pagehide', dispose);
  return { markup, bind, dispose };
}
