import { foundryPilotIcon } from './foundry-pilot-icons.js';
import { foundryFoundationsEnabled } from './foundry-foundations.js';

const enabled = () =>
  foundryFoundationsEnabled() && document.querySelector('#app-shell')?.dataset.next === 'true';
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text != null) element.textContent = text;
  return element;
};
const observed = new WeakSet();
const lastReviewFocus = new WeakMap();

export function applyReportNeedsFocus({ review, active, body, lastFocus, previousState }) {
  if (previousState || !review) return false;
  if (review.contains(active)) return true;
  // Native disabling blurs a submitting button to body. Retain only that
  // explicit current submission origin, never unrelated earlier Review focus.
  return Boolean(
    active === body &&
    lastFocus?.id === 'apply-agent' &&
    review.contains(lastFocus) &&
    lastFocus.disabled &&
    lastFocus.dataset.submitting === 'true',
  );
}

/** Display names supplement, never replace, exact source property identifiers. */
export function reviewPropertyLabel(property) {
  const labels = {
    fontSize: 'Font size',
    fontFamily: 'Font family',
    fontWeight: 'Font weight',
    lineHeight: 'Line height',
    letterSpacing: 'Letter spacing',
    textAlign: 'Text alignment',
    backgroundColor: 'Background color',
    color: 'Text color',
    borderRadius: 'Corner radius',
    borderWidth: 'Border width',
    borderColor: 'Border color',
    paddingTop: 'Top padding',
    paddingRight: 'Right padding',
    paddingBottom: 'Bottom padding',
    paddingLeft: 'Left padding',
    marginTop: 'Top margin',
    marginRight: 'Right margin',
    marginBottom: 'Bottom margin',
    marginLeft: 'Left margin',
    width: 'Width',
    height: 'Height',
    opacity: 'Opacity',
    gap: 'Gap',
    display: 'Display',
    transform: 'Transform',
    textContent: 'Text content',
  };
  if (Object.hasOwn(labels, property)) return labels[property];
  if (/^motion\.[^.]+\.keyframe\.\d+\.transform$/.test(property)) return 'Keyframe transform';
  if (/^motion\.[^.]+\.direction$/.test(property)) return 'Playback direction';
  return property;
}

function protectCoveredReview(root) {
  const apply = document.querySelector('#apply-run');
  if (!apply || observed.has(apply)) return;
  observed.add(apply);
  root.addEventListener('focusin', (event) => lastReviewFocus.set(root, event.target));
  const sync = () => {
    root.inert = !apply.hidden;
  };
  new MutationObserver(sync).observe(apply, { attributes: true, attributeFilter: ['hidden'] });
  sync();
}

export function refinePilotReview(
  root = document.querySelector('[data-mode-surface="review"]'),
  { changes = [] } = {},
) {
  if (!enabled() || !root) return;
  root.classList.add('foundry-review-interior');
  // Keep the original live error outside the fixed actions, so its text can
  // shrink/scroll without squeezing the buttons or being replaced with metrics.
  const error = root.querySelector('#review-apply-error');
  const footer = root.querySelector('.review-summary .review-footer');
  if (error && footer) {
    if (error.parentElement === footer) footer.before(error);
    error.setAttribute('tabindex', '0');
  }
  protectCoveredReview(root);
  const summaryHeading = root.querySelector('.review-summary > header strong');
  if (summaryHeading) summaryHeading.textContent = 'This batch';
  const list = root.querySelector('#changes');
  if (!list) return;
  if (changes.length && !list.querySelector('.foundry-review-intro')) {
    const intro = node('header', 'foundry-review-intro');
    intro.append(node('h2', '', 'Review the requested changes'));
    intro.append(
      node(
        'p',
        '',
        'Include the changes you want to send. Exact values and source context stay available for every change.',
      ),
    );
    list.prepend(intro);
  }
  for (const row of list.querySelectorAll('.change-row')) {
    if (row.dataset.foundryReview === 'true') continue;
    row.dataset.foundryReview = 'true';
    const input = row.querySelector('[data-change-id]');
    const change = changes.find((item) => item.id === input?.dataset.changeId);
    const property = row.querySelector('.change-property strong');
    if (change && property) {
      const name = reviewPropertyLabel(change.property);
      property.textContent = name;
      if (name !== change.property)
        property.after(node('code', 'foundry-review-property-key', change.property));
    }
    const values = row.querySelector('.change-values');
    for (const [selector, label, tag] of [
      ['.before-value', 'Captured', 'div'],
      ['.after-value', 'Requested', 'label'],
    ]) {
      const value = values?.querySelector(selector);
      if (!value) continue;
      const field = node(tag, 'foundry-review-value');
      field.append(node('span', 'foundry-review-value-label', label));
      value.before(field);
      field.append(value);
    }
    const confidence = values?.querySelector('.status-chip');
    const meta = node('div', 'foundry-review-row-state');
    if (confidence) {
      confidence.title = 'Source mapping confidence, not rendered verification';
      meta.append(confidence);
    }
    const inclusion = input?.disabled
      ? 'Mapping needed'
      : input?.checked
        ? 'Included'
        : 'Not included';
    row.dataset.included = String(Boolean(input?.checked));
    row.dataset.mappingNeeded = String(Boolean(input?.disabled));
    // Mapping is already named by the original confidence chip.
    if (!input?.disabled) meta.append(node('span', 'foundry-review-inclusion', inclusion));
    row.querySelector('.change-line')?.append(meta);
    row
      .querySelector('.change-source-details summary')
      ?.setAttribute(
        'aria-label',
        `Source and context for ${change?.target?.label ?? 'change'}, ${change?.property ?? ''}`,
      );
  }
}

export function capturePilotApplyState(root) {
  if (!enabled() || !root) return null;
  const focus = root.contains(document.activeElement) ? document.activeElement : null;
  return {
    action: focus?.dataset.runAction,
    navigation: focus?.dataset.runNavigation,
    outerScroll: root.scrollTop,
    reportScroll: root.querySelector('.foundry-apply-report')?.scrollTop ?? 0,
    sidebarScroll: root.querySelector('.apply-status-group')?.scrollTop ?? 0,
  };
}

/** Move original report/action nodes; never issue, retry or acknowledge a run. */
export function refinePilotApply(
  root,
  { run, lifecycle, verifiedDelivery, stages = [], previousState } = {},
) {
  if (!enabled() || !root || !run || root.hidden) return;
  root.classList.add('foundry-apply-interior');
  root.dataset.runState = run.state;
  root.dataset.foundryRunId = run.id;
  const review = document.querySelector('[data-mode-surface="review"]');
  const moveFocusFromReview = applyReportNeedsFocus({
    review,
    active: document.activeElement,
    body: document.body,
    lastFocus: review && lastReviewFocus.get(review),
    previousState,
  });
  if (review) {
    protectCoveredReview(review);
    review.inert = true;
  }
  const status = root.querySelector('.apply-status-group');
  const evidence = root.querySelector('.apply-evidence');
  if (!status || !evidence || evidence.querySelector('.foundry-apply-report')) return;
  status.classList.add('foundry-sidebar');
  const switcher = node('button', 'foundry-workspace-switcher');
  switcher.type = 'button';
  switcher.dataset.foundryWorkspace = 'review';
  switcher.setAttribute('aria-label', 'Review, switch workspace');
  switcher.setAttribute('aria-controls', 'studio-navigation');
  switcher.setAttribute('aria-expanded', 'false');
  switcher.innerHTML = `${foundryPilotIcon('check')}<span>Review</span>${foundryPilotIcon('chevronDown')}`;
  status.prepend(switcher);
  const stepsHeading = status.querySelector('.change-group-head strong');
  if (stepsHeading) stepsHeading.textContent = 'Run progress';
  // An interrupted rebuild is not a completed rebuild. Use the recorded phase,
  // without altering the original run or its retry/resume eligibility.
  const interruptedIndex =
    run.state === 'needs_attention' ? stages.indexOf(run.interruptedState) : -1;
  if (interruptedIndex >= 0) {
    const rows = [...status.querySelectorAll('.run-step')];
    rows.forEach((row, index) => {
      row.classList.toggle('is-complete', index < interruptedIndex);
      row.classList.remove('is-active');
      row.classList.toggle('needs-attention', index === interruptedIndex);
      row.querySelector('span:last-child').textContent =
        index < interruptedIndex
          ? 'Complete'
          : index === interruptedIndex
            ? 'Needs attention'
            : 'Waiting';
    });
    status.querySelector('.change-group-head > span').textContent =
      `${interruptedIndex} of ${rows.length} complete`;
  }
  const finalStep = status.querySelector('.run-step:last-child strong');
  if (finalStep) finalStep.textContent = verifiedDelivery ? 'Verified handoff' : 'Run complete';
  const identity = node('div', 'foundry-apply-identity');
  identity.append(node('span', '', 'Recorded run'), node('code', '', run.id));
  if (run.interruptedState)
    identity.append(
      node('span', '', `Interrupted during ${String(run.interruptedState).replaceAll('_', ' ')}`),
    );
  status.append(identity);
  const report = node('div', 'foundry-apply-report');
  const statusRow = root.querySelector('.apply-status-row');
  if (statusRow) {
    const title = statusRow.querySelector('strong');
    if (title) {
      const heading = node('h2', '', title.textContent);
      heading.tabIndex = -1;
      title.replaceWith(heading);
    }
    report.append(statusRow);
  }
  if (run.error && !String(lifecycle?.detail ?? '').includes(run.error)) {
    const error = node('div', 'foundry-apply-run-error');
    error.setAttribute('role', 'note');
    error.append(node('strong', '', 'Reported issue'), node('p', '', run.error));
    report.append(error);
  }
  const evidenceHeading = evidence.querySelector(':scope > header');
  const list = evidence.querySelector('.apply-progress-list');
  if (evidenceHeading) {
    const title = evidenceHeading.querySelector('strong');
    if (title)
      title.textContent = run.state === 'queued' ? 'Agent handoff' : 'Source and verification';
    report.append(evidenceHeading);
  }
  if (list) report.append(list);
  evidence.prepend(report);
  root.scrollTop = previousState?.outerScroll ?? 0;
  if (moveFocusFromReview) report.querySelector('h2')?.focus({ preventScroll: true });
  if (previousState) {
    report.scrollTop = previousState.reportScroll;
    status.scrollTop = previousState.sidebarScroll;
    const selector = previousState.action
      ? `[data-run-action="${CSS.escape(previousState.action)}"]`
      : previousState.navigation
        ? `[data-run-navigation="${CSS.escape(previousState.navigation)}"]`
        : null;
    if (selector) root.querySelector(selector)?.focus({ preventScroll: true });
  }
}
