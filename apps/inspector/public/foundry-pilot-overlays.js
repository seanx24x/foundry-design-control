import { foundryPilotIcon } from './foundry-pilot-icons.js';

// Native dialogs, command buttons and save handlers retain ownership. This
// adapter only supplies pilot presentation, keyboard navigation and feedback.
const enabled = () =>
  Boolean(document.documentElement.dataset.foundryPilot) &&
  document.querySelector('#app-shell')?.dataset.next === 'true';
const modalSelector = '#command-dialog, #delivery-milestone-dialog, #readiness-dialog';
const bound = new WeakSet();
const feedbackStates = new WeakMap();

const focusable = (node) =>
  node instanceof HTMLElement &&
  node.tabIndex >= 0 &&
  node.isConnected &&
  !node.closest('[hidden], [inert]') &&
  !node.matches(':disabled') &&
  node.getClientRects().length > 0 &&
  getComputedStyle(node).visibility !== 'hidden';

export function restorePilotDialogFocus(preferred, fallbackSelector = '#workspace-menu-trigger') {
  if (!enabled()) return false;
  const candidate = [
    preferred,
    document.querySelector(fallbackSelector),
    document.querySelector('#workspace-menu-trigger'),
    document.querySelector('#command-trigger'),
  ].find(focusable);
  candidate?.focus({ preventScroll: true });
  return true;
}

export function refinePilotCommandPalette() {
  if (!enabled()) return false;
  const dialog = document.querySelector('#command-dialog');
  const input = document.querySelector('#command-input');
  const list = document.querySelector('#command-list');
  if (!dialog || !input || !list) return false;
  if (!bound.has(dialog)) {
    bound.add(dialog);
    dialog.setAttribute('aria-labelledby', 'foundry-command-title');
    const header = document.createElement('header');
    header.className = 'foundry-command-heading';
    header.innerHTML =
      '<h2 id="foundry-command-title">Go to workspace</h2><span id="foundry-command-count" role="status" aria-live="polite" aria-atomic="true"></span>';
    dialog.prepend(header);
    const footer = document.createElement('footer');
    footer.className = 'foundry-command-footer';
    footer.innerHTML =
      '<span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>esc</kbd> Close</span>';
    dialog.append(footer);
    input.placeholder = 'Search workspaces…';
    input.setAttribute('aria-label', 'Search workspaces');
    input.setAttribute('aria-controls', 'command-list');
    input.autocomplete = 'off';
    input.spellcheck = false;
    dialog.addEventListener('keydown', (event) => {
      if (
        !enabled() ||
        event.defaultPrevented ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.altKey ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey
      )
        return;
      const buttons = [...list.querySelectorAll('[data-command-mode]')];
      const current = buttons.indexOf(document.activeElement);
      const inSearch = document.activeElement === input;
      if (!buttons.length || (!inSearch && current < 0)) return;
      let next;
      if (event.key === 'ArrowDown') next = inSearch ? 0 : (current + 1) % buttons.length;
      if (event.key === 'ArrowUp')
        next = inSearch ? buttons.length - 1 : (current - 1 + buttons.length) % buttons.length;
      if (!inSearch && event.key === 'Home') next = 0;
      if (!inSearch && event.key === 'End') next = buttons.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        buttons[next].focus({ preventScroll: true });
        buttons[next].scrollIntoView({ block: 'nearest' });
      } else if (inSearch && event.key === 'Enter') {
        event.preventDefault();
        buttons[0].click();
      }
    });
  }
  const buttons = [...list.querySelectorAll('[data-command-mode]')];
  dialog.querySelector('#foundry-command-count').textContent =
    `${buttons.length} ${buttons.length === 1 ? 'workspace' : 'workspaces'}`;
  list.querySelector('.foundry-command-empty')?.remove();
  if (!buttons.length) {
    const empty = document.createElement('div');
    empty.className = 'foundry-command-empty';
    empty.innerHTML = `${foundryPilotIcon('search')}<strong>No matching workspaces</strong><p>Try a different name, or clear your search.</p>`;
    list.append(empty);
  }
  const mode = document.querySelector('#app-shell').dataset.mode;
  for (const button of buttons) {
    button.querySelector('.foundry-command-current')?.remove();
    button.removeAttribute('aria-current');
    if (button.dataset.commandMode === mode) {
      button.setAttribute('aria-current', 'page');
      const label = document.createElement('span');
      label.className = 'foundry-command-current';
      label.textContent = 'Current';
      button.insertBefore(label, button.querySelector('kbd'));
    }
  }
  return true;
}

export const feedbackDuration = (message) =>
  Math.min(12000, Math.max(6000, String(message).length * 65));

export function showPilotFeedback(message, element = document.querySelector('#toast')) {
  if (!enabled() || !element) return false;
  let state = feedbackStates.get(element);
  if (!state) {
    element.removeAttribute('role');
    element.classList.add('foundry-feedback');
    element.innerHTML = `<span class="foundry-feedback-message" role="status" aria-atomic="true"></span><button type="button" class="icon-button" aria-label="Dismiss notification">${foundryPilotIcon('close')}</button>`;
    const dismiss = element.querySelector('button');
    state = { timer: null, duration: 6000, returnFocus: null };
    state.hide = () => {
      clearTimeout(state.timer);
      const heldFocus = element.contains(document.activeElement);
      element.classList.remove('is-visible');
      element.inert = true;
      if (heldFocus && focusable(state.returnFocus))
        state.returnFocus.focus({ preventScroll: true });
    };
    state.schedule = () => {
      clearTimeout(state.timer);
      if (
        !element.classList.contains('is-visible') ||
        element.closest('dialog[open]') ||
        element.matches(':hover') ||
        element.contains(document.activeElement)
      )
        return;
      state.timer = setTimeout(state.hide, state.duration);
    };
    dismiss.addEventListener('click', state.hide);
    element.addEventListener('mouseenter', () => clearTimeout(state.timer));
    element.addEventListener('mouseleave', state.schedule);
    element.addEventListener('focusin', () => clearTimeout(state.timer));
    element.addEventListener('focusout', state.schedule);
    feedbackStates.set(element, state);
  }
  clearTimeout(state.timer);
  const modal = [...document.querySelectorAll(modalSelector)].find((node) => node.open);
  (modal ?? document.body).append(element);
  if (!element.contains(document.activeElement)) state.returnFocus = document.activeElement;
  state.duration = feedbackDuration(message);
  element.querySelector('.foundry-feedback-message').textContent = String(message);
  element.inert = false;
  element.classList.add('is-visible');
  state.schedule();
  return true;
}

export function mountPilotOverlays() {
  if (!enabled()) return;
  for (const dialog of document.querySelectorAll(modalSelector)) {
    if (dialog.dataset.foundryOverlayMounted) continue;
    dialog.dataset.foundryOverlayMounted = 'true';
    dialog.addEventListener('close', () => {
      const feedback = dialog.querySelector('#toast');
      if (feedback) {
        feedbackStates.get(feedback)?.hide();
        document.body.append(feedback);
      }
      if (dialog.id === 'delivery-milestone-dialog')
        restorePilotDialogFocus(null, '#delivery-create-milestone');
    });
  }
}
