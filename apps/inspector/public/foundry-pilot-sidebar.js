import { foundryPilotIcon } from './foundry-pilot-icons.js';
const compactLibraries = new Map();

// Presentation only. Keep each library in the subtree owned by its renderer.
export const FOUNDRY_SIDEBAR_PAGES = Object.freeze([
  { mode: 'canvas', label: 'Canvas', panel: '#layers-dock', glyph: 'canvas' },
  {
    mode: 'components',
    label: 'Components',
    panel: '.component-workshop-browser',
    shell: '.component-workshop-shell',
    glyph: 'components',
  },
  {
    mode: 'system',
    label: 'Design system',
    panel: '.design-system-browser',
    shell: '.design-system-shell',
    glyph: 'designSystem',
  },
  {
    mode: 'motion',
    label: 'Motion studio',
    panel: '.motion-studio-browser',
    shell: '.motion-studio-shell',
    glyph: 'motion',
  },
  {
    mode: 'typography',
    label: 'Typography',
    panel: '.typography-studio-browser',
    shell: '.typography-studio-shell',
    glyph: 'typography',
  },
  {
    mode: 'recipes',
    label: 'Recipes',
    panel: '.visual-recipe-browser',
    shell: '.visual-recipes-shell',
    glyph: 'recipes',
  },
  {
    mode: 'states',
    label: 'State workbench',
    panel: '.state-matrix-panel',
    shell: '.workbench-grid',
    glyph: 'stateWorkbench',
  },
  {
    mode: 'responsive',
    label: 'Responsive',
    panel: '.next-responsive-library',
    shell: '.next-responsive-shell',
    glyph: 'responsive',
  },
  {
    mode: 'health',
    label: 'Content stress lab',
    panel: '.stress-lab-browser',
    shell: '.stress-lab-shell',
    glyph: 'contentStress',
  },
  {
    mode: 'agent',
    label: 'Visual agent',
    panel: '.visual-agent-threads',
    shell: '.visual-agent-shell',
    glyph: 'visualAgent',
  },
  {
    mode: 'branches',
    label: 'Design branches',
    panel: '.design-branch-browser',
    shell: '.design-branches-shell',
    glyph: 'branches',
  },
  {
    mode: 'memory',
    label: 'Design memory',
    panel: '.decision-memory-browser',
    shell: '.decision-memory-shell',
    glyph: 'designMemory',
  },
  {
    mode: 'delivery',
    label: 'Delivery',
    panel: '.foundry-delivery-navigation',
    shell: '.delivery-shell',
    glyph: 'delivery',
  },
  {
    mode: 'review',
    label: 'Review',
    panel: '.review-summary',
    shell: '.review-workspace',
    glyph: 'check',
  },
]);

export function syncFoundrySidebars(root = document) {
  for (const page of FOUNDRY_SIDEBAR_PAGES) {
    const surface = root.querySelector(`[data-mode-surface="${page.mode}"]`);
    const shell = surface?.querySelector(page.shell ?? ':scope');
    if (page.mode === 'delivery' && shell && !shell.querySelector(page.panel)) {
      const navigation = root.createElement('aside');
      navigation.className = 'foundry-delivery-navigation';
      navigation.setAttribute('aria-label', 'Delivery navigation');
      shell.prepend(navigation);
    }
    const panel = root.querySelector(page.panel);
    if (!panel) continue;
    panel.classList.add('foundry-sidebar');
    if (page.mode !== 'canvas' && page.mode !== 'components') {
      surface.classList.add('foundry-studio-page');
      shell?.classList.add('foundry-studio-shell');
    }
    if (!panel.querySelector(':scope > .foundry-workspace-switcher')) {
      const button = root.createElement('button');
      button.type = 'button';
      button.className = 'foundry-workspace-switcher';
      button.dataset.foundryWorkspace = page.mode;
      button.setAttribute('aria-label', `${page.label}, switch workspace`);
      button.setAttribute('aria-controls', 'studio-navigation');
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = `${foundryPilotIcon(page.glyph) ?? ''}<span>${page.label}</span>${foundryPilotIcon('chevronDown')}`;
      panel.prepend(button);
    }
    const switcher = panel.querySelector(':scope > .foundry-workspace-switcher');
    if (panel.children[0] !== switcher) panel.prepend(switcher);
    if (!['canvas', 'review', 'delivery'].includes(page.mode)) {
      panel.dataset.craftLibrary = page.mode;
      if (!panel.id) panel.id = `craft-library-${page.mode}`;
      let toggle = panel.querySelector(':scope > .craft-library-toggle');
      if (!toggle) {
        toggle = root.createElement('button');
        toggle.type = 'button';
        toggle.className = 'craft-library-toggle';
        const label = root.createElement('span');
        label.className = 'craft-library-selection';
        toggle.append(label);
        toggle.insertAdjacentHTML('beforeend', foundryPilotIcon('chevronDown') ?? '');
        toggle.setAttribute('aria-controls', panel.id);
        switcher.after(toggle);
        toggle.addEventListener('click', () => {
          const expanded = toggle.getAttribute('aria-expanded') !== 'true';
          compactLibraries.set(page.mode, expanded);
          panel.dataset.craftLibraryOpen = String(expanded);
          toggle.setAttribute('aria-expanded', String(expanded));
          toggle.setAttribute(
            'aria-label',
            `${expanded ? 'Hide' : 'Show'} ${page.label.toLowerCase()} library`,
          );
        });
      }
      const expanded = compactLibraries.get(page.mode) ?? false;
      panel.dataset.craftLibraryOpen = String(expanded);
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute(
        'aria-label',
        `${expanded ? 'Hide' : 'Show'} ${page.label.toLowerCase()} library`,
      );
      const selected = panel.querySelector(
        '.is-active strong, [aria-selected="true"] strong, [aria-pressed="true"] strong',
      );
      const label = selected?.textContent?.trim() || `Browse ${page.label.toLowerCase()}`;
      toggle.querySelector('span').textContent = label;
      toggle.title = label;
    }
  }
  // Delivery replaces this subtree on every tab/record change; never move it.
  root
    .querySelectorAll('.delivery-sidebar')
    .forEach((panel) => panel.classList.add('foundry-sidebar', 'foundry-sidebar-continuation'));
}
