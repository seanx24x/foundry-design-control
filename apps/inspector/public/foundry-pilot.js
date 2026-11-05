import { refineFoundryPilotIcons } from './foundry-pilot-icons.js';
import { FOUNDRY_SIDEBAR_PAGES, syncFoundrySidebars } from './foundry-pilot-sidebar.js';
import { mountPilotOverlays } from './foundry-pilot-overlays.js';
import { refinePilotPreviewFallback } from './foundry-pilot-readiness.js';
import { foundryFoundationsEnabled } from './foundry-foundations.js';
import { refineStudioControls } from './foundry-studio-controls.js';

// Retain the internal pilot name for existing integrations; policy is shared by
// the shell and every migrated page so the default cannot produce a mixed UI.
export const foundryPilotRequested = foundryFoundationsEnabled;
const pilotModes = new Set(FOUNDRY_SIDEBAR_PAGES.map(({ mode }) => mode));
export const foundryPilotActive = () =>
  pilotModes.has(document.documentElement.dataset.foundryPilot);

const pilotScope =
  '#app-shell > .app-bar, .foundry-sidebar, #layers-dock, #inspector-dock, .canvas-mode, .component-workshop-mode, .design-system-mode, .motion-studio-mode, .typography-studio-mode, .visual-recipes-mode, .next-state-workbench, .next-responsive-lab, .next-stress-lab, .next-visual-agent, .next-design-branches, .next-design-memory, .next-delivery, [data-mode-surface="review"], .foundry-apply-interior, #studio-navigation, #change-summary, .next-color-picker, .next-font-picker, .foundry-select-menu, .next-connection-popover, #command-dialog, #delivery-milestone-dialog, #readiness-dialog';
export function refinePilotIcons(root = document) {
  if (foundryPilotActive()) {
    syncFoundrySidebars(document);
    refineFoundryPilotIcons(root, { active: true, scope: pilotScope });
    refineStudioControls(document);
  }
}

export function mountFoundryPilot() {
  const shell = document.querySelector('#app-shell');
  if (!foundryPilotRequested() || shell?.dataset.next !== 'true') return;
  const sync = () => {
    const active = pilotModes.has(shell.dataset.mode);
    if (active) document.documentElement.dataset.foundryPilot = shell.dataset.mode;
    else delete document.documentElement.dataset.foundryPilot;
    if (active) {
      syncFoundrySidebars(document);
      mountPilotOverlays();
      refinePilotPreviewFallback();
    }
    refineFoundryPilotIcons(document, { active, scope: pilotScope });
    if (active) refineStudioControls(document);
  };
  new MutationObserver(sync).observe(shell, {
    attributes: true,
    attributeFilter: ['data-mode'],
  });
  sync();
}
