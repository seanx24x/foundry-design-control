export const STUDIO_NAMES = Object.freeze({
  canvas: 'Canvas',
  review: 'Review and apply',
  states: 'State workbench',
  health: 'Content stress lab',
  memory: 'Design memory',
  components: 'Component workshop',
  responsive: 'Responsive design lab',
  system: 'Design system',
  motion: 'Motion studio',
  typography: 'Typography studio',
  branches: 'Design branches',
  recipes: 'Visual recipes',
  agent: 'Visual agent',
  delivery: 'Delivery',
});

export function navigationExpanded(preference, compact) {
  return preference === 'expanded' || (preference !== 'collapsed' && !compact);
}

export function createStudioNavigation() {
  const shell = document.querySelector('#app-shell');
  const toggle = document.querySelector('#studio-nav-toggle');
  const compact = window.matchMedia('(max-width: 1359px)');
  const key = 'foundry:studio-navigation';
  let preference;
  try {
    preference = localStorage.getItem(key);
  } catch {
    /* Storage is optional. */
  }
  function update() {
    const expanded = navigationExpanded(preference, compact.matches);
    shell.dataset.navLayout = expanded ? 'expanded' : 'collapsed';
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} studio navigation`);
    toggle.title = toggle.getAttribute('aria-label');
  }
  toggle.addEventListener('click', () => {
    preference = navigationExpanded(preference, compact.matches) ? 'collapsed' : 'expanded';
    try {
      localStorage.setItem(key, preference);
    } catch {
      /* Keep the local choice in memory. */
    }
    update();
  });
  compact.addEventListener('change', update);
  update();
  return { update };
}
