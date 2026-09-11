import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PREVIEW_CONTEXT_VERSION,
  acceptPreviewRevision,
  authoredPseudoSelectorMatches,
  applyPreviewMutationAtomically,
  applyPreviewStateAttributes,
  applyPreviewTheme,
  capturePreviewThemeBaseline,
  createPreviewThemeBaseline,
  previewCapabilities,
  previewContextKey,
  previewStateMethods,
  queryForPreviewState,
  replacePreviewPseudoSelector,
  restorePreviewThemeBaseline,
  themeHook,
  variantAttribute,
  type PreviewContext,
} from './preview-context.js';

class PreviewNodeHarness {
  readonly attributes = new Map<string, string>();
  readonly classes = new Set<string>();
  focusCount = 0;
  readonly classList = {
    add: (...names: string[]) => names.forEach((name) => this.classes.add(name)),
    contains: (name: string) => this.classes.has(name),
    toggle: (name: string, force?: boolean) => {
      const next = force ?? !this.classes.has(name);
      if (next) this.classes.add(name);
      else this.classes.delete(name);
      return next;
    },
  };

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  focus(): void {
    this.focusCount += 1;
  }
}

test('theme hooks only accept configured root attributes and classes', () => {
  assert.deepEqual(themeHook({ id: 'dark', label: 'Dark', attribute: 'data-theme' }), {
    method: 'attribute',
    attribute: 'data-theme',
    value: 'dark',
  });
  assert.deepEqual(themeHook({ id: 'dim', label: 'Dim', selector: 'html.theme-dim' }), {
    method: 'class',
    className: 'theme-dim',
  });
  assert.deepEqual(themeHook({ id: 'night', label: 'Night', selector: '[data-mode="night"]' }), {
    method: 'attribute',
    attribute: 'data-mode',
    value: 'night',
  });
  assert.deepEqual(themeHook({ id: 'unsafe', label: 'Unsafe', selector: '.app .dark' }), {
    method: 'unsupported',
  });
});

test('theme mutations restore the exact root attribute and class baseline', () => {
  const root = new PreviewNodeHarness();
  root.setAttribute('data-theme', 'brand');
  root.classes.add('theme-original');
  const themes = [
    { id: 'dark', label: 'Dark', attribute: 'data-theme', value: 'dark' },
    { id: 'dim', label: 'Dim', selector: 'html.theme-dim' },
    { id: 'original', label: 'Original', selector: '.theme-original' },
  ];
  const baseline = createPreviewThemeBaseline();
  capturePreviewThemeBaseline(root, themes, baseline);
  applyPreviewTheme(root, themes[0]!, themes);
  assert.equal(root.getAttribute('data-theme'), 'dark');
  assert.equal(root.classes.has('theme-original'), false);
  applyPreviewTheme(root, themes[1]!, themes);
  assert.equal(root.getAttribute('data-theme'), null);
  assert.equal(root.classes.has('theme-dim'), true);
  assert.equal(root.classes.has('theme-original'), false);

  restorePreviewThemeBaseline(root, baseline);
  assert.equal(root.getAttribute('data-theme'), 'brand');
  assert.equal(root.classes.has('theme-dim'), false);
  assert.equal(root.classes.has('theme-original'), true);
});

test('authored variant, focus, and native disabled attributes restore exactly', () => {
  const target = new PreviewNodeHarness();
  target.setAttribute('data-product-state', 'idle');
  target.setAttribute('aria-disabled', 'false');
  const restore = applyPreviewStateAttributes(target, {
    id: 'error-focus',
    label: 'Error focus',
    variant: { productState: 'error' },
    pseudoStates: ['focus', 'disabled'],
  });
  assert.equal(target.getAttribute('data-product-state'), 'error');
  assert.equal(target.getAttribute('data-foundry-force-focus'), 'true');
  assert.equal(target.getAttribute('data-foundry-force-disabled'), 'true');
  assert.equal(target.getAttribute('disabled'), '');
  assert.equal(target.getAttribute('aria-disabled'), 'true');
  assert.equal(target.focusCount, 1);

  restore();
  assert.equal(target.getAttribute('data-product-state'), 'idle');
  assert.equal(target.getAttribute('data-foundry-force-focus'), null);
  assert.equal(target.getAttribute('data-foundry-force-disabled'), null);
  assert.equal(target.getAttribute('disabled'), null);
  assert.equal(target.getAttribute('aria-disabled'), 'false');
});

test('pseudo-state preflight only accepts selectors activated by the selected target marker', () => {
  const marker = '[data-foundry-pseudo-match="hover-1"]';
  const matchingSelectors = new Set([
    `.primary${marker}`,
    `.primary${marker}::before`,
    `.primary${marker} > .label`,
  ]);
  const matches = (selector: string) => matchingSelectors.has(selector);

  assert.equal(replacePreviewPseudoSelector('.primary', 'hover'), null);
  assert.equal(authoredPseudoSelectorMatches('.secondary:hover', 'hover', marker, matches), false);
  assert.equal(authoredPseudoSelectorMatches('.primary:hover', 'hover', marker, matches), true);
  assert.equal(
    authoredPseudoSelectorMatches('.primary:hover::before', 'hover', marker, matches),
    true,
  );
  assert.equal(
    authoredPseudoSelectorMatches('.primary:hover > .label', 'hover', marker, matches),
    true,
  );
});

test('failed preview mutations atomically restore theme and state', async () => {
  const root = new PreviewNodeHarness();
  const target = new PreviewNodeHarness();
  root.setAttribute('data-theme', 'light');
  target.setAttribute('data-status', 'ready');
  const theme = { id: 'dark', label: 'Dark', attribute: 'data-theme', value: 'dark' };
  const baseline = createPreviewThemeBaseline();
  capturePreviewThemeBaseline(root, [theme], baseline);
  let restoreState = () => {};

  await assert.rejects(
    applyPreviewMutationAtomically(
      () => {
        applyPreviewTheme(root, theme);
        restoreState = applyPreviewStateAttributes(target, {
          id: 'loading',
          label: 'Loading',
          variant: { status: 'loading' },
        });
        throw new Error('font load failed');
      },
      () => {
        restoreState();
        restorePreviewThemeBaseline(root, baseline);
      },
    ),
    /font load failed/,
  );
  assert.equal(root.getAttribute('data-theme'), 'light');
  assert.equal(target.getAttribute('data-status'), 'ready');
});

test('stale requests are rejected against the latest concurrent revision', () => {
  assert.equal(acceptPreviewRevision(8, 6, 7), 8);
  assert.throws(() => acceptPreviewRevision(7, 6, 8), /revision 7 is stale.*revision is 8/);
});

test('preview capabilities expose authored context methods without synthetic states', () => {
  const capabilities = previewCapabilities({
    breakpoints: [{ id: 'phone', label: 'Phone', width: 390, height: 844 }],
    themes: [{ id: 'dark', label: 'Dark', attribute: 'data-theme', value: 'dark' }],
    states: [
      {
        id: 'error',
        label: 'Error',
        variant: { status: 'error' },
        pseudoStates: ['focus'],
        query: { state: 'error' },
      },
    ],
  });
  assert.equal(PREVIEW_CONTEXT_VERSION, 1);
  assert.deepEqual(capabilities.themes, [{ id: 'dark', attribute: 'data-theme', value: 'dark' }]);
  assert.deepEqual(capabilities.states, [
    { id: 'error', methods: ['query', 'variant', 'pseudo', 'native'] },
  ]);
  assert.equal(
    capabilities.states.some((state) => state.id === 'hover'),
    false,
  );
});

test('preview query restoration clears authored state keys by returning an empty query', () => {
  const states = [{ id: 'error', label: 'Error', query: { mode: 'error', panel: 'signup' } }];
  assert.deepEqual(queryForPreviewState(states, 'error'), {
    mode: 'error',
    panel: 'signup',
  });
  assert.deepEqual(queryForPreviewState(states, 'current'), {});
});

test('variant attributes and matrix keys are deterministic', () => {
  assert.equal(variantAttribute('productState'), 'data-product-state');
  const context: PreviewContext = {
    version: 1,
    requestRevision: 4,
    viewport: { id: 'phone', width: 390, height: 844 },
    theme: 'dark',
    state: 'error',
    motionPreference: 'reduce',
    selectedTarget: { id: 'field', selector: '#field' },
  };
  assert.equal(previewContextKey(context), 'phone:dark:error:reduce:field');
  assert.deepEqual(previewStateMethods({ id: 'quiet', label: 'Quiet' }), []);
});
