import { foundryPilotIcon } from './foundry-pilot-icons.js';

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text != null) element.textContent = text;
  return element;
};

// Deliberately small, text-only reader for generated documentation. Unknown
// Markdown stays literal; the unmodified source is always available alongside it.
export function deliveryDocumentBlocks(text) {
  const blocks = [];
  let paragraph = [],
    list = [],
    code = null;
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
    if (list.length) blocks.push({ type: 'list', items: list });
    paragraph = [];
    list = [];
  };
  for (const line of String(text).split(/\r?\n/)) {
    if (/^```/.test(line)) {
      flush();
      if (code) {
        blocks.push({ type: 'code', text: code.join('\n') });
        code = null;
      } else code = [];
    } else if (code) code.push(line);
    else if (!line.trim()) flush();
    else if (/^#{1,6}\s/.test(line)) {
      flush();
      blocks.push({ type: 'heading', text: line.replace(/^#{1,6}\s+/, '') });
    } else if (/^[-*]\s/.test(line)) {
      if (paragraph.length) flush();
      list.push(line.replace(/^[-*]\s+/, ''));
    } else {
      if (list.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  if (code) blocks.push({ type: 'code', text: code.join('\n') });
  return blocks;
}

function inlineText(element, text) {
  let cursor = 0;
  for (const match of text.matchAll(/(?<!\\)`([^`\n]+)(?<!\\)`/g)) {
    element.append(
      document.createTextNode(text.slice(cursor, match.index)),
      node('code', '', match[1]),
    );
    cursor = match.index + match[0].length;
  }
  element.append(document.createTextNode(text.slice(cursor)));
}

function disclosure(className, title, description, content, open = false) {
  const details = node('details', className);
  details.open = open;
  const summary = node('summary', '');
  summary.append(node('span', '', title), node('small', '', description));
  details.append(summary, content);
  return details;
}

export function createPilotDelivery(root) {
  root.classList.add('foundry-delivery-interior');
  const tabs = [...root.querySelectorAll('[data-delivery-tab]')];
  const tablist = root.querySelector('.delivery-tabs');
  const compact = window.matchMedia('(max-width: 800px)');
  const orientation = () =>
    tablist.setAttribute('aria-orientation', compact.matches ? 'horizontal' : 'vertical');
  orientation();
  compact.addEventListener('change', orientation);
  const glyphs = {
    handoff: 'delivery',
    documentation: 'file',
    history: 'clock',
    checks: 'compare',
  };
  for (const tab of tabs) {
    const icon = foundryPilotIcon(glyphs[tab.dataset.deliveryTab]);
    if (icon) tab.insertAdjacentHTML('afterbegin', icon);
    tab.addEventListener('keydown', (event) => {
      if (compact.matches || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const next =
        (tabs.indexOf(tab) + (event.key === 'ArrowDown' ? 1 : tabs.length - 1)) % tabs.length;
      tabs[next].click();
      tabs[next].focus();
    });
  }
  function update({ tab, record }) {
    const content = root.querySelector('#delivery-content');
    if (tab === 'handoff' && record) {
      const detail = content.querySelector('.delivery-record-detail');
      const grid = detail.querySelector('.delivery-detail-grid');
      const readonly = detail.dataset.readonly === 'true';
      const notes = disclosure(
        'foundry-delivery-notes',
        readonly ? 'Recorded intent and notes' : 'Handoff notes',
        readonly ? 'Read-only narrative' : 'Editable narrative · source unchanged',
        grid,
        !readonly,
      );
      detail.append(notes);
      const context = content.querySelector('.next-delivery-context');
      const contextHeader = context.querySelector(':scope > header');
      contextHeader?.remove();
      const sourceDetails = disclosure(
        'foundry-delivery-context',
        'Source and context',
        `${record.affectedFiles.length} ${record.affectedFiles.length === 1 ? 'file' : 'files'} · ${record.contexts.length} ${record.contexts.length === 1 ? 'context' : 'contexts'}`,
        context,
      );
      notes.after(sourceDetails);
      // Evidence bindings stay attached to their original figures and buttons.
      const captures = detail.querySelector('.delivery-capture-evidence');
      if (captures) {
        const captureDetails = disclosure(
          'foundry-delivery-captures',
          'Recorded screenshots',
          'Capture provenance, not verification',
          captures,
        );
        captures.querySelector(':scope > header h3')?.remove();
        sourceDetails.after(captureDetails);
      }
    }
    if (tab === 'documentation') {
      const doc = content.querySelector('.delivery-document');
      const source = doc?.querySelector(':scope > pre');
      if (source) {
        const reading = node('div', 'foundry-delivery-document-body');
        const title = doc.querySelector('h2')?.textContent?.trim();
        const blocks = deliveryDocumentBlocks(source.textContent);
        for (const [index, block] of blocks.entries()) {
          if (index === 0 && block.type === 'heading' && block.text === title) continue;
          if (block.type === 'list') {
            const list = node('ul', '');
            for (const item of block.items) {
              const li = node('li', '');
              inlineText(li, item);
              list.append(li);
            }
            reading.append(list);
          } else {
            const element = node(
              block.type === 'heading' ? 'h3' : block.type === 'code' ? 'pre' : 'p',
              '',
            );
            if (block.type === 'code') element.textContent = block.text;
            else inlineText(element, block.text);
            reading.append(element);
          }
        }
        source.before(reading);
        const raw = disclosure(
          'foundry-delivery-document-source',
          'Document source',
          'Original generated text',
          source,
        );
        doc.append(raw);
      }
    }
    if (tab === 'history') {
      const milestones = content.querySelector('.delivery-milestones');
      milestones?.classList.add('foundry-sidebar', 'foundry-sidebar-continuation');
      const heading = content.querySelector('.delivery-timeline > header > div');
      if (heading) {
        heading.querySelector('.eyebrow')?.remove();
        heading.append(
          node(
            'p',
            'foundry-delivery-description',
            'Passed Apply runs, recorded in order. Milestones group this history; they are not deployments.',
          ),
        );
      }
    }
    if (tab === 'checks') {
      const heading = content.querySelector('.visual-check-summary > header > div');
      heading?.querySelector('.eyebrow')?.remove();
      const selected = content.querySelector('[data-visual-report].is-active strong');
      if (heading && selected)
        heading.append(
          node('p', 'foundry-delivery-description', `Recorded ${selected.textContent}`),
        );
    }
  }
  return { update };
}
