// Presentation only. Reads native selection; never changes form values, selection,
// focus, event propagation, requests, authored data or workflow status.
export const STUDIO_SEGMENTS = '.segmented, .typography-source-tabs, .motion-curve-tabs';
export function selectedStudioSegment(buttons) {
  const selected = buttons.filter(
    (button) =>
      button.getAttribute('aria-selected') === 'true' ||
      button.getAttribute('aria-pressed') === 'true' ||
      button.classList.contains('is-active') ||
      button.classList.contains('is-selected'),
  );
  return selected.length === 1 ? selected[0] : null;
}
export function studioSpringStep(position, velocity, target, dt, stiffness) {
  const step = Math.min(0.025, Math.max(0, dt)),
    nextVelocity =
      velocity + ((target - position) * stiffness - 2 * Math.sqrt(stiffness) * velocity) * step;
  return { position: position + nextVelocity * step, velocity: nextVelocity };
}
const groups = new Map();
export function refineStudioControls(root = globalThis.document) {
  const doc = root?.ownerDocument ?? root,
    win = doc?.defaultView;
  if (!win?.requestAnimationFrame || !doc?.documentElement?.dataset?.foundryPilot) return;
  for (const [element, controller] of groups)
    if (!element.isConnected) {
      controller.dispose();
      groups.delete(element);
    }
  for (const element of root.querySelectorAll(STUDIO_SEGMENTS)) {
    if (groups.has(element)) {
      groups.get(element).sync();
      continue;
    }
    const buttons = [...element.children].filter((child) => child.tagName === 'BUTTON');
    if (buttons.length < 2 || buttons.length > 8) continue;
    let left = 0,
      right = 0,
      vl = 0,
      vr = 0,
      targetLeft = 0,
      targetRight = 0,
      frame = 0,
      last = 0,
      initialized = false;
    const reduced = () => win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const paint = () => {
      element.style.setProperty('--fd-segment-left', `${left}px`);
      element.style.setProperty('--fd-segment-width', `${Math.max(0, right - left)}px`);
    };
    const tick = (time) => {
      if (!element.isConnected || !element.getClientRects().length) {
        frame = 0;
        return;
      }
      const dt = Math.min(0.025, (time - last) / 1000 || 0.016);
      last = time;
      const forward = targetLeft > left;
      const l = studioSpringStep(left, vl, targetLeft, dt, forward ? 210 : 330),
        r = studioSpringStep(right, vr, targetRight, dt, forward ? 330 : 210);
      left = l.position;
      vl = l.velocity;
      right = r.position;
      vr = r.velocity;
      paint();
      if (
        Math.abs(left - targetLeft) + Math.abs(right - targetRight) + Math.abs(vl) + Math.abs(vr) >
        0.05
      )
        frame = win.requestAnimationFrame(tick);
      else {
        frame = 0;
        left = targetLeft;
        right = targetRight;
        paint();
      }
    };
    const sync = () => {
      const actualButtons = [...element.children].filter((child) => child.tagName === 'BUTTON'),
        button = selectedStudioSegment(actualButtons),
        style = win.getComputedStyle(element);
      if (!button || style.flexDirection === 'column') {
        element.removeAttribute('data-fd-studio-segment');
        return;
      }
      const box = element.getBoundingClientRect(),
        selected = button.getBoundingClientRect();
      if (!box.width || !selected.width) return;
      // offset geometry stays in local CSS pixels, unaffected by browser zoom.
      targetLeft = button.offsetLeft;
      targetRight = targetLeft + button.offsetWidth;
      element.style.setProperty('--fd-segment-top', `${button.offsetTop}px`);
      element.style.setProperty('--fd-segment-height', `${button.offsetHeight}px`);
      element.dataset.fdStudioSegment = '';
      if (!initialized || reduced()) {
        initialized = true;
        left = targetLeft;
        right = targetRight;
        vl = vr = 0;
        if (frame) win.cancelAnimationFrame(frame);
        frame = 0;
        paint();
      } else if (!frame) {
        last = win.performance.now();
        frame = win.requestAnimationFrame(tick);
      }
    };
    const observer = new win.MutationObserver(sync);
    observer.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-selected', 'aria-pressed'],
    });
    const resize = new win.ResizeObserver(sync);
    resize.observe(element);
    groups.set(element, {
      sync,
      dispose() {
        observer.disconnect();
        resize.disconnect();
        if (frame) win.cancelAnimationFrame(frame);
      },
    });
    sync();
  }
}
