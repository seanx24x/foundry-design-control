import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { FoundryRuntime, SessionStore } from '../packages/runtime/dist/index.js';

const root = resolve(import.meta.dirname, '..');
const runtimePort = 47_000 + Math.floor(Math.random() * 500);
const previewPort = runtimePort + 500;
const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-workspace-e2e-')));
const runtime = new FoundryRuntime({ port: runtimePort, store });
let sessionId = '';
const preview = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(
    `<!doctype html><html><body style="margin:0"><main data-foundry-container="signup-shell" style="container:signup-shell / inline-size;width:640px"><button data-foundry-component="Signup/PrimaryAction" data-story="Primary" style="width:100px;height:40px">Create workspace</button><button data-foundry-component="Signup/PrimaryAction" data-story="Quiet" style="width:100px;height:40px">Save draft</button></main><script>
      let stressConditions = [];
      let stressScope = 'selection';
      const publish = () => parent.postMessage({ type: 'foundry:workspace-state', sessionId: '${sessionId}', payload: {
        context: { scope: 'instance', breakpoint: 'current', theme: 'current', state: 'current' },
        selection: { id: 'create-workspace', label: 'Create workspace', kind: 'button', selector: 'button', source: { file: 'PrimaryAction.tsx', line: 1 }, component: 'Signup/PrimaryAction', confidence: 'instrumented', width: 100, height: 40, count: 1, targets: [{ id: 'create-workspace', label: 'Create workspace', kind: 'button', selector: 'button', source: 'PrimaryAction.tsx:1', component: 'Signup/PrimaryAction', confidence: 'instrumented', geometry: { x: 20, y: 20, width: 100, height: 40, scale: 1 }, measurements: { fontSize: '16px', borderRadius: '8px' } }] },
        visualAgent: { region: null, capturingRegion: false },
        layers: [{ id: 'create-workspace', selector: 'button:first-of-type', label: 'Create workspace', kind: 'component', component: 'Signup/PrimaryAction', source: { file: 'PrimaryAction.tsx', line: 1 }, width: 100, height: 40, depth: 0, instrumented: true, hasChildren: false, selected: true, variantProps: { story: document.querySelector('button:first-of-type').dataset.story } }, { id: 'save-draft', selector: 'button:last-of-type', label: 'Save draft', kind: 'component', component: 'Signup/PrimaryAction', source: { file: 'PrimaryAction.tsx', line: 2 }, width: 100, height: 40, depth: 0, instrumented: true, hasChildren: false, selected: false, variantProps: { story: document.querySelector('button:last-of-type').dataset.story } }],
        controls: [{ index: 0, category: 'typography', property: 'fontFamily', label: 'Font family', kind: 'text', value: 'Inter, sans-serif' }, { index: 1, category: 'typography', property: 'fontSize', label: 'Font size', kind: 'number', value: '16px' }], typography: { selection: { family: 'Inter, sans-serif', primaryFamily: 'Inter', weight: '600', style: 'normal', size: '16px', lineHeight: '20px', letterSpacing: '0px', variationSettings: 'normal', text: 'Create workspace' }, projectFonts: [{ family: 'Inter', weights: ['400', '600'], styles: ['normal'], origins: ['active', 'project'] }, { family: 'Foundry JetBrains Mono', weights: ['400'], styles: ['normal'], origins: ['project'] }], savedStyles: [], diagnostics: [], metrics: { lineCount: 1, charactersPerLine: 16, faceStatus: 'loaded' }, usages: [{ family: 'Inter', count: 4, weights: ['400', '600'], sizes: ['12px', '16px'], examples: ['Create workspace'] }], preview: null, treatments: [{ id: 'tight', label: 'Tight', detail: 'Compact display rhythm', lineHeight: 1.1, letterSpacing: '-0.02em' }, { id: 'balanced', label: 'Balanced', detail: 'Default interface rhythm', lineHeight: 1.25, letterSpacing: '0em' }, { id: 'open', label: 'Open', detail: 'Relaxed reading rhythm', lineHeight: 1.5, letterSpacing: '0.01em' }], scale: { base: 16, ratio: 1.25, step: 1, fluid: false, value: '20px' }, strategies: [{ id: 'framework', label: 'Framework native' }, { id: 'stylesheet', label: 'Stylesheet' }], googleSelection: null, validation: { breakpoints: [{ id: 'current', label: 'Current' }], themes: [{ id: 'light', label: 'Light' }], states: [{ id: 'current', label: 'Current' }] }, capabilities: { localFontAccess: false } }, motions: [{ id: 'motion_primary', label: 'Primary action entrance', kind: 'motion-react', authoring: { adapter: 'motion', label: 'Motion for React', source: { file: 'src/PrimaryAction.tsx', line: 18 }, sourceProperties: { duration: 'transition.duration', delay: 'transition.delay', easing: 'transition.ease', keyframes: 'animate / variants' }, evidence: ['motion source import', 'transition authoring site'] }, properties: ['opacity', 'transform'], timing: { duration: 480, delay: 0, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', iterations: 1, direction: 'normal', fill: 'both' }, curve: { kind: 'cubic-bezier', sourceValue: 'cubic-bezier(0.2, 0.8, 0.2, 1)', previewValue: 'cubic-bezier(0.2, 0.8, 0.2, 1)', cubicBezier: { x1: 0.2, y1: 0.8, x2: 0.2, y2: 1 }, points: [{ x: 0, y: 0 }, { x: 0.1, y: 0.3 }, { x: 0.25, y: 0.68 }, { x: 0.5, y: 0.94 }, { x: 0.75, y: 0.99 }, { x: 1, y: 1 }], diagnostics: { duration: 0, overshoot: 0, sampleCount: 61 } }, keyframes: [{ index: 0, offset: 0, easing: 'ease-out', values: { opacity: '0', transform: 'translateY(12px)' } }, { index: 1, offset: 1, easing: 'linear', values: { opacity: '1', transform: 'translateY(0px)' } }], path: { supported: true, property: 'transform', points: [{ index: 0, offset: 0, x: 0, y: 12, sourceValue: 'translateY(12px)' }, { index: 1, offset: 1, x: 0, y: 0, sourceValue: 'translateY(0px)' }], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 12, width: 0, height: 12 }, distance: 12 }, comparison: { changed: true, before: { timing: { duration: 560 }, curve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, path: { supported: true, points: [{ index: 0, offset: 0, x: -16, y: 16 }, { index: 1, offset: 1, x: 0, y: 0 }], distance: 22.6 } }, after: { timing: { duration: 480 }, curve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, path: { supported: true, points: [{ index: 0, offset: 0, x: 0, y: 12 }, { index: 1, offset: 1, x: 0, y: 0 }], distance: 12 } }, diagnostics: { durationDelta: -80, distanceDelta: -10.6, pointDelta: 0 } }, performance: { tier: 'compositor', label: 'Compositor', detail: 'Transform and opacity stay on the compositor.' }, active: true, playState: 'paused', currentTime: 160, playbackRate: 1, looping: false, reducedMotionProtected: true }], history: { canUndo: false, canRedo: false },
        responsive: { viewportWidth: innerWidth, viewportHeight: innerHeight, documentScrollWidth: document.documentElement.scrollWidth, documentScrollHeight: document.documentElement.scrollHeight, container: { name: 'signup-shell', type: 'inline-size', width: document.querySelector('main').getBoundingClientRect().width, height: document.querySelector('main').getBoundingClientRect().height, selector: 'main', previewed: Boolean(document.querySelector('main').style.inlineSize) }, selection: { width: 100, height: 40, scrollWidth: 100, scrollHeight: 40, clientWidth: 100, clientHeight: 40, lineCount: 1 } },
        stressTesting: { profiles: [
          { id: 'long-content', category: 'content', label: 'Long content', description: 'Expands rendered labels.', combination: 'content' },
          { id: 'loading-state', category: 'state', label: 'Loading', description: 'Requests the loading state.', combination: 'state' },
          { id: 'keyboard-only', category: 'accessibility', label: 'Keyboard only', description: 'Audits focus behavior.', combination: 'navigation' }
        ], active: stressConditions, scope: stressScope, target: stressScope === 'selection' ? 'Create workspace' : 'Entire canvas' },
        decisionMemory: { canCapture: true, hasEditedValues: true, context: { component: 'Signup/PrimaryAction', kind: 'button', source: 'PrimaryAction.tsx:1', properties: ['fontSize'], breakpoint: 'current', theme: 'current', state: 'current', values: [{ property: 'fontSize', value: '20px', category: 'typography' }] }, decisions: [{ id: 'decision-motion', title: 'Keep primary actions compact', summary: 'Primary action labels stay at the project body size.', rationale: 'The larger branch weakened the form hierarchy.', outcome: 'rejected', categories: ['typography', 'component'], conditions: { components: ['Signup/PrimaryAction'], elementKinds: ['button'], properties: ['fontSize'], sources: ['PrimaryAction.tsx'] }, rules: [{ property: 'fontSize', category: 'typography', operator: 'avoid', value: '20px', guidance: 'Keep the primary action compact.' }], evidence: [{ kind: 'branch', label: 'Editorial scale', refId: 'branch-editorial' }], sourceLocations: ['PrimaryAction.tsx:1'], enabled: true, createdAt: '2026-09-05T00:00:00.000Z', updatedAt: '2026-09-05T00:00:00.000Z' }], relevant: [{ decision: { id: 'decision-motion', title: 'Keep primary actions compact', summary: 'Primary action labels stay at the project body size.', rationale: 'The larger branch weakened the form hierarchy.', outcome: 'rejected', categories: ['typography', 'component'], conditions: { components: ['Signup/PrimaryAction'], elementKinds: ['button'], properties: ['fontSize'], sources: ['PrimaryAction.tsx'] }, rules: [{ property: 'fontSize', category: 'typography', operator: 'avoid', value: '20px', guidance: 'Keep the primary action compact.' }], evidence: [{ kind: 'branch', label: 'Editorial scale', refId: 'branch-editorial' }], sourceLocations: ['PrimaryAction.tsx:1'], enabled: true, createdAt: '2026-09-05T00:00:00.000Z', updatedAt: '2026-09-05T00:00:00.000Z' }, score: 92, reasons: ['Same component', 'Same element kind', 'Affects the same properties', 'Same source location'], conflicts: [{ property: 'fontSize', category: 'typography', operator: 'avoid', value: '20px' }] }] },
        visualRecipes: { canSave: true, recipes: [{ id: 'recipe-focus', name: 'Accessible focus treatment', sourceLabel: 'Primary action', intent: 'Keep keyboard focus visible in every theme.', component: 'Signup/PrimaryAction', categories: ['color', 'effects'], conditions: { components: ['Signup/PrimaryAction'], elementKinds: ['button'], requiredProperties: ['fontSize'] }, values: [{ property: 'fontSize', value: '16px', category: 'typography' }], createdAt: '2026-09-05T00:00:00.000Z' }], assessment: { 'recipe-focus': { compatibility: 'exact', score: 100, matched: 1, total: 1, ambiguous: 0, mappings: [{ property: 'fontSize', category: 'typography', sourceValue: '16px', currentValue: '16px', resolvedValue: '16px', status: 'mapped', detail: 'Uses the saved literal because no compatible destination token was found.' }], reasons: ['1 of 1 properties map to this target.'] } } },
        health: [{ id: 'button:target-size', kind: 'target-size', title: 'Touch target is too small', detail: 'Create workspace: Increase the interactive area.', description: 'Increase the interactive area.', evidence: '100 × 40 px measured; 44 px height recommended', severity: 'medium', source: 'PrimaryAction.tsx:1', viewport: '1440 × 900', stressConditions, canFix: true, previewed: false }]
      }}, 'http://127.0.0.1:${runtimePort}');
      addEventListener('message', (event) => {
        if (event.data?.type !== 'foundry:workspace-command') return;
        if (event.data.command === 'set-context') event.data.payload && publish();
        if (event.data.command === 'preview-component-variant') document.querySelector('button').dataset.story = event.data.payload.variantId.includes('quiet') ? 'Quiet' : 'Primary';
        if (event.data.command === 'stage-component-variant') { document.documentElement.dataset.stagedVariant = event.data.payload.value; publish(); }
        if (event.data.command === 'stage-token-promotion') { document.documentElement.dataset.stagedTokenPromotion = event.data.payload.candidateId; publish(); }
        if (event.data.command === 'repair-component-variant-drift') { document.querySelector('button:last-of-type').dataset.story = event.data.payload.variantId.includes('quiet') ? 'Quiet' : 'Primary'; publish(); }
        if (event.data.command === 'preview-component-state') document.querySelector('button').dataset.foundryState = event.data.payload.stateId;
        if (event.data.command === 'preview-responsive-stress') { document.documentElement.dataset.foundryResponsiveStress = event.data.payload.mode; publish(); }
        if (event.data.command === 'preview-responsive-container') { const main = document.querySelector('main'); main.style.inlineSize = event.data.payload.width ? event.data.payload.width + 'px' : ''; main.style.maxInlineSize = event.data.payload.width ? 'none' : ''; publish(); }
        if (event.data.command === 'apply-health-stress') { stressConditions = event.data.payload.conditions; stressScope = event.data.payload.scope; document.documentElement.dataset.foundryStress = stressConditions.join(' '); publish(); }
        if (event.data.command === 'clear-health-stress') { stressConditions = []; delete document.documentElement.dataset.foundryStress; publish(); }
        if (event.data.command === 'scan-health') publish();
        if (event.data.command === 'preview-health-fix') publish();
        if (event.data.command === 'apply-visual-recipe') { document.documentElement.dataset.foundryRecipe = event.data.payload.recipeId; publish(); }
        if (event.data.command === 'save-design-decision') { document.documentElement.dataset.foundryDecision = event.data.payload.outcome; publish(); }
        if (event.data.command === 'motion-action') document.documentElement.dataset.lastMotionAction = event.data.payload.action;
        if (event.data.command === 'typography-action') document.documentElement.dataset.lastTypographyAction = event.data.payload.action;
      });
      addEventListener('load', () => setTimeout(publish, 50));
    </script></body></html>`,
  );
});
let browser;

try {
  await runtime.start();
  await new Promise((resolveStart, reject) => {
    preview.once('error', reject);
    preview.listen(previewPort, '127.0.0.1', resolveStart);
  });
  const session = await store.create({
    projectRoot: '/foundry/workspace-e2e',
    revision: 'workspace-e2e',
    platform: 'web',
    targetUrl: `http://127.0.0.1:${previewPort}`,
    targetName: 'Workspace fixture',
    viewport: { width: 1440, height: 900 },
    theme: 'light',
    breakpoint: 'current',
    state: 'current',
  });
  sessionId = session.changeSet.sessionId;
  await store.setDesignGraph(sessionId, {
    protocolVersion: '1.2.0',
    projectRoot: '/foundry/workspace-e2e',
    revision: 'workspace-e2e',
    tokens: [
      {
        id: 'token-color-signal',
        name: '--color-signal',
        value: '#3478f6',
        category: 'color',
        confidence: 'measured',
        evidence: ['CSS custom property'],
        cssVariable: '--color-signal',
        resolvedValue: '#3478f6',
        aliasChain: ['--color-signal'],
        aliasStatus: 'direct',
        source: { file: 'style.css', line: 1 },
      },
      {
        id: 'token-runtime-preview-width',
        name: '--preview-width',
        value: '${viewportWidth',
        category: 'size',
        confidence: 'inferred',
        evidence: ['Source template placeholder'],
        cssVariable: '--preview-width',
        aliasChain: ['--preview-width'],
        aliasStatus: 'direct',
        source: { file: 'Preview.tsx', line: 1 },
      },
    ],
    components: [
      {
        id: 'Signup/PrimaryAction',
        name: 'PrimaryAction',
        source: { file: 'PrimaryAction.tsx', line: 1 },
        instances: 2,
        variantAxes: [
          {
            id: 'storybook-story',
            label: 'Story',
            property: 'story',
            values: ['Primary', 'Quiet'],
            adapter: 'storybook',
            source: { file: 'PrimaryAction.stories.tsx', line: 1 },
            sourceProperty: 'named export',
            canCreate: true,
            evidence: ['Storybook named exports'],
          },
        ],
        variants: [
          {
            id: 'variant-primary',
            label: 'Primary',
            property: 'story',
            value: 'Primary',
            props: { story: 'Primary' },
            source: { file: 'PrimaryAction.stories.tsx', line: 1 },
          },
          {
            id: 'variant-quiet',
            label: 'Quiet',
            property: 'story',
            value: 'Quiet',
            props: { story: 'Quiet' },
            source: { file: 'PrimaryAction.stories.tsx', line: 2 },
          },
        ],
        evidence: ['Storybook story'],
      },
    ],
    breakpoints: [
      { id: 'mobile', label: 'Mobile', width: 390, height: 844 },
      { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
    ],
    containerQueries: [
      {
        id: 'container-compact',
        label: 'signup-shell ≥ 480px',
        name: 'signup-shell',
        condition: 'min-width: 480px',
        axis: 'inline-size',
        minWidth: 480,
        source: { file: 'Signup.css', line: 12 },
        evidence: ['CSS @container query'],
      },
      {
        id: 'container-wide',
        label: 'signup-shell ≤ 720px',
        name: 'signup-shell',
        condition: 'width <= 720px',
        axis: 'inline-size',
        maxWidth: 720,
        source: { file: 'Signup.css', line: 20 },
        evidence: ['CSS @container query'],
      },
    ],
    themes: [
      { id: 'light', label: 'Light' },
      { id: 'dark', label: 'Dark' },
    ],
    states: [],
    motionPresets: [],
    tokenUsages: [
      {
        id: 'usage-color-signal',
        tokenId: 'token-color-signal',
        tokenName: '--color-signal',
        value: '#3478f6',
        category: 'color',
        kind: 'reference',
        property: 'background-color',
        componentId: 'Signup/PrimaryAction',
        source: { file: 'PrimaryAction.tsx', line: 1 },
        evidence: ['CSS variable reference'],
      },
    ],
    designSystemFindings: [
      {
        id: 'finding-color-signal',
        kind: 'component-drift',
        severity: 'warning',
        title: '#397bfa is close to --color-signal',
        detail: 'background-color uses a near-duplicate literal.',
        category: 'color',
        tokenIds: ['token-color-signal'],
        usageIds: ['usage-color-signal'],
        componentIds: ['Signup/PrimaryAction'],
        suggestedTokenId: 'token-color-signal',
        source: { file: 'PrimaryAction.tsx', line: 1 },
        evidence: ['Literal is close to a project token'],
      },
    ],
    tokenPromotions: [
      {
        id: 'promotion-color-signal',
        value: '#3478f6',
        category: 'color',
        property: 'background-color',
        occurrenceCount: 3,
        sources: [
          { file: 'PrimaryAction.css', line: 12 },
          { file: 'PrimaryAction.css', line: 28 },
          { file: 'Banner.css', line: 8 },
        ],
        componentIds: ['Signup/PrimaryAction'],
        recommendation: 'use-existing',
        relation: 'exact',
        suggestedTokenId: 'token-color-signal',
        suggestedTokenName: '--color-signal',
        suggestedValue: 'var(--color-signal)',
        aliasChain: ['--color-signal'],
        canStage: true,
        blockers: [],
        evidence: [
          '3 authored literal occurrences',
          'Resolved value matches an existing project token',
        ],
      },
    ],
    indexedAt: new Date().toISOString(),
  });
  await store.addChange(sessionId, {
    target: {
      id: 'create-workspace',
      platform: 'web',
      semanticRole: 'button',
      label: 'Create workspace',
      componentPath: [],
      source: { file: 'PrimaryAction.tsx', line: 1 },
      geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
      locator: { selector: 'button' },
      confidence: 'instrumented',
      evidence: ['data-foundry-source', 'live geometry'],
    },
    category: 'effect',
    property: 'borderRadius',
    before: '4px',
    after: '12px',
    unit: 'px',
    scope: 'instance',
    context: { breakpoint: 'current', theme: 'current', state: 'current' },
    confidence: 'instrumented',
    evidence: ['data-foundry-source', 'computed style'],
    status: 'approved',
  });
  await store.createDesignBranch(sessionId, { name: 'Editorial scale' });
  await store.addChange(sessionId, {
    target: {
      id: 'create-workspace',
      platform: 'web',
      semanticRole: 'button',
      label: 'Create workspace',
      componentPath: [],
      source: { file: 'PrimaryAction.tsx', line: 1 },
      geometry: { x: 0, y: 0, width: 100, height: 40, scale: 1 },
      locator: { selector: 'button' },
      confidence: 'instrumented',
      evidence: ['data-foundry-source', 'live geometry'],
    },
    category: 'typography',
    property: 'fontSize',
    before: '16px',
    after: '20px',
    unit: 'px',
    scope: 'instance',
    context: { breakpoint: 'current', theme: 'current', state: 'current' },
    confidence: 'instrumented',
    evidence: ['data-foundry-source', 'computed style'],
    status: 'draft',
  });
  await store.activateDesignBranch(sessionId);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const url = new URL(`http://127.0.0.1:${runtimePort}`);
  url.searchParams.set('session', sessionId);
  url.searchParams.set('token', session.token);
  url.searchParams.set('preview', `http://127.0.0.1:${previewPort}`);
  await page.goto(url.href, { waitUntil: 'networkidle' });
  const artifactDirectory = join(root, 'artifacts', 'e2e');
  await mkdir(artifactDirectory, { recursive: true });
  const assertAccessibleWorkspaceSurface = async () => {
    const audit = await page.evaluate(() => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      };
      return {
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        unlabeledButtons: [...document.querySelectorAll('button')].filter(
          (button) =>
            visible(button) &&
            !(
              button.innerText.trim() ||
              button.getAttribute('aria-label') ||
              button.getAttribute('title')
            ),
        ).length,
        oversizedIcons: [...document.querySelectorAll('button svg')].filter((icon) => {
          if (!visible(icon)) return false;
          const rect = icon.getBoundingClientRect();
          return rect.width > 24 || rect.height > 24;
        }).length,
      };
    });
    assert.ok(audit.pageOverflow <= 1, 'workspace must not overflow the page horizontally');
    assert.equal(audit.unlabeledButtons, 0, 'every visible icon button needs an accessible name');
    assert.equal(audit.oversizedIcons, 0, 'button icons must remain at or below 24px');
  };
  const assertConnectedWorkspaceBrowser = async (selector) => {
    const geometry = await page.locator(selector).evaluate((element) => {
      const panel = element.getBoundingClientRect();
      const surface = element.closest('[data-mode-surface]');
      const header = surface?.querySelector(':scope > .mode-head');
      const surfaceRect = surface?.getBoundingClientRect();
      const headerRect = header?.getBoundingClientRect();
      const search = element.querySelector('input[type="search"]')?.getBoundingClientRect();
      return {
        leftDelta: surfaceRect ? Math.abs(panel.left - surfaceRect.left) : Number.POSITIVE_INFINITY,
        topDelta: headerRect ? Math.abs(panel.top - headerRect.bottom) : Number.POSITIVE_INFINITY,
        headerHeight: headerRect?.height ?? 0,
        borderRadius: getComputedStyle(element).borderRadius,
        overflowsHorizontally: element.scrollWidth > element.clientWidth + 1,
        searchFits: search ? search.left >= panel.left && search.right <= panel.right + 1 : true,
      };
    });
    assert.ok(geometry.leftDelta <= 1, `${selector} must align to the workspace edge`);
    assert.ok(geometry.topDelta <= 1, `${selector} must begin directly below the workspace header`);
    assert.equal(geometry.headerHeight, 80, `${selector} must share the 80px workspace header`);
    assert.equal(geometry.borderRadius, '0px', `${selector} must not render as an inset card`);
    assert.equal(
      geometry.overflowsHorizontally,
      false,
      `${selector} must not overflow horizontally`,
    );
    assert.equal(geometry.searchFits, true, `${selector} search must fit inside the panel`);
    await assertAccessibleWorkspaceSurface();
  };
  const assertSharedRailSelection = async (mode) => {
    const selection = await page.evaluate((activeMode) => {
      const active = [...document.querySelectorAll('.workspace-rail .rail-button.is-active')];
      const selected = active[0];
      const canvas = document.querySelector('.workspace-rail [data-workspace-mode="canvas"]');
      const selectedStyle = selected ? getComputedStyle(selected) : null;
      const canvasStyle = canvas ? getComputedStyle(canvas) : null;
      const probe = document.createElement('span');
      probe.style.color = 'var(--selection)';
      probe.style.backgroundColor = 'var(--selection-soft)';
      document.body.append(probe);
      const probeStyle = getComputedStyle(probe);
      const result = {
        activeCount: active.length,
        activeMode: selected?.dataset.workspaceMode,
        selection: probeStyle.color,
        selectionSoft: probeStyle.backgroundColor,
        selectedColor: selectedStyle?.color,
        selectedBorder: selectedStyle?.borderColor,
        selectedBackground: selectedStyle?.backgroundColor,
        canvasColor: canvasStyle?.color,
      };
      probe.remove();
      return result;
    }, mode);
    assert.equal(selection.activeCount, 1, 'the rail must expose one active destination');
    assert.equal(selection.activeMode, mode);
    assert.equal(selection.selectedColor, selection.selection);
    assert.equal(selection.selectedBorder, selection.selection);
    assert.equal(selection.selectedBackground, selection.selectionSoft);
    if (mode !== 'canvas') assert.notEqual(selection.canvasColor, selection.selection);
  };

  await page.locator('#layers-dock').waitFor();
  await page.locator('#inspector-dock').waitFor();
  await page.locator('#change-summary').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#change-count').textContent(), '1 change · Main direction');
  assert.match(
    (await page.locator('#selection-summary').textContent()) ?? '',
    /PrimaryAction\.tsx:1/,
  );
  assert.doesNotMatch(
    (await page.locator('#selection-summary').textContent()) ?? '',
    /\[object Object\]/,
  );
  const frame = page.locator('#preview-frame');
  assert.equal(await frame.getAttribute('data-viewport'), '1440 × 900');

  await page.screenshot({
    path: join(artifactDirectory, 'canvas-light.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'canvas-dark.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });

  await page.locator('.workspace-rail [data-workspace-mode="states"]').click();
  await page.getByRole('heading', { name: 'State Workbench' }).waitFor();
  await assertSharedRailSelection('states');
  await assertConnectedWorkspaceBrowser('.state-matrix-panel');
  await page.screenshot({
    path: join(artifactDirectory, 'state-workbench-light.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'state-workbench-dark.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.locator('.workspace-rail [data-workspace-mode="canvas"]').click();

  await page.locator('#workspace-menu-trigger').click();
  await page.locator('#workspace-menu [data-workspace-mode="components"]').click();
  await page.getByRole('heading', { name: 'Component workshop' }).waitFor();
  await assertConnectedWorkspaceBrowser('.component-workshop-browser');
  await page.getByRole('heading', { name: 'PrimaryAction' }).waitFor();
  assert.equal(await page.locator('.workshop-instance-row').count(), 2);
  assert.equal(await page.locator('.workshop-variant-row').count(), 2);
  assert.equal(await page.locator('[data-workshop-state]').count(), 8);
  const workshopGeometry = await page.locator('.component-workshop-mode').evaluate((surface) => {
    const detail = surface.querySelector('.component-workshop-detail');
    const contract = surface.querySelector('.component-workshop-contract');
    const footer = surface.querySelector('.component-workshop-footer');
    const responsiveGrid = surface.querySelector('.workshop-responsive-grid');
    return {
      detailOverflow: detail.scrollWidth - detail.clientWidth,
      contractOverflow: contract.scrollWidth - contract.clientWidth,
      footerHeight: footer.getBoundingClientRect().height,
      footerBottom: Math.round(footer.getBoundingClientRect().bottom),
      surfaceBottom: Math.round(surface.getBoundingClientRect().bottom),
      responsiveOverflow: responsiveGrid.scrollWidth - responsiveGrid.clientWidth,
      responsiveColumns: getComputedStyle(responsiveGrid).gridTemplateColumns.split(' ').length,
    };
  });
  assert.ok(
    workshopGeometry.detailOverflow <= 1,
    'component canvas must not overflow horizontally',
  );
  assert.ok(workshopGeometry.contractOverflow <= 1, 'source contract must fit its rail');
  assert.equal(workshopGeometry.footerHeight, 56, 'review readiness remains visible');
  assert.equal(workshopGeometry.footerBottom, workshopGeometry.surfaceBottom);
  assert.ok(
    workshopGeometry.responsiveOverflow <= 1,
    'responsive verification must use the component grid, not the outer workspace grid',
  );
  assert.equal(workshopGeometry.responsiveColumns, 3);
  await page.locator('.workshop-variant-row').filter({ hasText: 'Primary' }).click();
  assert.equal(await page.locator('.workshop-drift').getAttribute('data-drift-count'), '1');
  assert.match((await page.locator('.workshop-drift-list').textContent()) ?? '', /Save draft/);
  await page.locator('[data-workshop-variant-label]').fill('Danger');
  await page.locator('[data-workshop-variant-value]').fill('danger');
  await page.getByRole('button', { name: 'Stage source variant' }).click();
  await page
    .frameLocator('#product-preview')
    .locator('html[data-staged-variant="danger"]')
    .waitFor();
  await page.getByRole('button', { name: 'Repair 1 value' }).click();
  await page.locator('.workshop-drift[data-drift-count="0"]').waitFor();

  await page.screenshot({
    path: join(artifactDirectory, 'component-workshop-light.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'component-workshop-dark.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  const compactWorkshopGeometry = await page
    .locator('.component-workshop-mode')
    .evaluate((surface) => {
      const detail = surface.querySelector('.component-workshop-detail');
      const responsiveGrid = surface.querySelector('.workshop-responsive-grid');
      const footer = surface.querySelector('.component-workshop-footer');
      return {
        detailOverflow: detail.scrollWidth - detail.clientWidth,
        responsiveColumns: getComputedStyle(responsiveGrid).gridTemplateColumns.split(' ').length,
        footerBottom: Math.round(footer.getBoundingClientRect().bottom),
        surfaceBottom: Math.round(surface.getBoundingClientRect().bottom),
      };
    });
  assert.ok(compactWorkshopGeometry.detailOverflow <= 1);
  assert.equal(compactWorkshopGeometry.responsiveColumns, 1);
  assert.equal(compactWorkshopGeometry.footerBottom, compactWorkshopGeometry.surfaceBottom);
  await page.screenshot({
    path: join(artifactDirectory, 'component-workshop-compact-light.png'),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.workspace-rail [data-workspace-mode="memory"]').click();
  await page.getByRole('heading', { name: 'Design Memory' }).waitFor();
  await assertConnectedWorkspaceBrowser('.decision-memory-browser');
  assert.equal(await page.locator('.decision-memory-row').count(), 1);
  assert.match(
    (await page.locator('.decision-relevance').textContent()) ?? '',
    /Potential conflict/,
  );
  assert.match((await page.locator('#decision-memory-stage').textContent()) ?? '', /fontSize/);
  await page.locator('#decision-memory-title').fill('Retain compact primary actions');
  await page
    .locator('#decision-memory-summary')
    .fill('Keep primary action labels at the project body size.');
  await page.getByRole('button', { name: 'Save decision' }).click();
  await page
    .frameLocator('#product-preview')
    .locator('html[data-foundry-decision="approved"]')
    .waitFor();
  await page.waitForTimeout(1900);
  await page.screenshot({
    path: join(artifactDirectory, 'design-decision-memory-light.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'design-decision-memory-dark.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.locator('.workspace-rail [data-workspace-mode="recipes"]').click();
  await page.getByRole('heading', { name: 'Visual recipes' }).waitFor();
  await assertConnectedWorkspaceBrowser('.visual-recipe-browser');
  assert.equal(await page.locator('.visual-recipe-row').count(), 1);
  assert.match((await page.locator('.visual-recipe-mapping').textContent()) ?? '', /100% exact/);
  assert.match((await page.locator('.visual-recipe-mapping').textContent()) ?? '', /fontSize/);
  assert.equal(await page.locator('.visual-recipe-map-columns').count(), 1);
  const recipeGeometry = await page.locator('.visual-recipes-mode').evaluate((surface) => {
    const browser = surface.querySelector('.visual-recipe-browser');
    const stage = surface.querySelector('.visual-recipe-stage');
    const create = surface.querySelector('.visual-recipe-create');
    const browserRect = browser.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const createRect = create.getBoundingClientRect();
    return {
      browserWidth: Math.round(browserRect.width),
      createWidth: Math.round(createRect.width),
      browserStageGap: Math.round(stageRect.left - browserRect.right),
      stageCreateGap: Math.round(createRect.left - stageRect.right),
      stageRadius: getComputedStyle(stage).borderRadius,
      createRadius: getComputedStyle(create).borderRadius,
      stageOverflow: stage.scrollWidth - stage.clientWidth,
      createOverflow: create.scrollWidth - create.clientWidth,
    };
  });
  assert.equal(recipeGeometry.browserWidth, 320);
  assert.equal(recipeGeometry.createWidth, 360);
  assert.equal(recipeGeometry.browserStageGap, 0);
  assert.equal(recipeGeometry.stageCreateGap, 0);
  assert.equal(recipeGeometry.stageRadius, '0px');
  assert.equal(recipeGeometry.createRadius, '0px');
  assert.ok(recipeGeometry.stageOverflow <= 1);
  assert.ok(recipeGeometry.createOverflow <= 1);
  await page.getByRole('button', { name: 'Add mapped values to Review' }).click();
  await page
    .frameLocator('#product-preview')
    .locator('html[data-foundry-recipe="recipe-focus"]')
    .waitFor();
  await page.waitForTimeout(1900);
  assert.equal(
    await page.frameLocator('#product-preview').locator('html').getAttribute('data-foundry-recipe'),
    'recipe-focus',
  );
  await page.screenshot({
    path: join(artifactDirectory, 'visual-recipes-light.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'visual-recipes-dark.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  const compactRecipeGeometry = await page.locator('.visual-recipes-mode').evaluate((surface) => {
    const browser = surface.querySelector('.visual-recipe-browser');
    const stage = surface.querySelector('.visual-recipe-stage');
    const create = surface.querySelector('.visual-recipe-create');
    const browserRect = browser.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const createRect = create.getBoundingClientRect();
    const columns = surface.querySelector('.visual-recipe-map-columns');
    return {
      browserWidth: Math.round(browserRect.width),
      createWidth: Math.round(createRect.width),
      browserStageGap: Math.round(stageRect.left - browserRect.right),
      stageCreateGap: Math.round(createRect.left - stageRect.right),
      stageOverflow: stage.scrollWidth - stage.clientWidth,
      createOverflow: create.scrollWidth - create.clientWidth,
      mappingColumns: getComputedStyle(columns).gridTemplateColumns.split(' ').length,
      reviewVisible: Boolean(surface.querySelector('#visual-recipe-review')?.offsetParent),
    };
  });
  assert.equal(compactRecipeGeometry.browserWidth, 280);
  assert.equal(compactRecipeGeometry.createWidth, 300);
  assert.equal(compactRecipeGeometry.browserStageGap, 0);
  assert.equal(compactRecipeGeometry.stageCreateGap, 0);
  assert.ok(compactRecipeGeometry.stageOverflow <= 1);
  assert.ok(compactRecipeGeometry.createOverflow <= 1);
  assert.equal(compactRecipeGeometry.mappingColumns, 4);
  assert.equal(compactRecipeGeometry.reviewVisible, true);
  await page.screenshot({
    path: join(artifactDirectory, 'visual-recipes-compact-light.png'),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.workspace-rail [data-workspace-mode="agent"]').click();
  await page.getByRole('heading', { name: 'Visual agent' }).waitFor();
  await assertConnectedWorkspaceBrowser('.visual-agent-threads');
  assert.match(
    (await page.locator('#visual-agent-context').textContent()) ?? '',
    /Create workspace/,
  );
  assert.match((await page.locator('#visual-agent-context').textContent()) ?? '', /100 × 40/);
  await page.locator('#visual-agent-comment').fill('The primary action feels detached.');
  await page
    .locator('#visual-agent-prompt')
    .fill('Why does this action feel inconsistent? Give me one exact source-safe direction.');
  await page.getByRole('button', { name: 'Ask active agent' }).click();
  await page.locator('.visual-agent-thread').waitFor();
  const visualStored = await store.read(sessionId);
  const visualRequest = visualStored.visualAgentRequests.at(-1);
  assert.ok(visualRequest);
  const visualRequestId = visualRequest.id;
  const visualClaimed = await store.claimVisualAgentRequest(sessionId, visualRequestId, {
    agent: { name: 'codex', taskId: 'workspace-e2e' },
  });
  const visualChange = visualClaimed.changeSet.changes[0];
  const visualClaim = visualClaimed.visualAgentRequests.at(-1);
  assert.ok(visualChange);
  assert.ok(visualClaim?.claimAttemptId);
  await store.respondToVisualAgentRequest(sessionId, visualRequestId, {
    claimAttemptId: visualClaim.claimAttemptId,
    message: 'The action uses a different corner rhythm than the surrounding interface.',
    proposals: [
      {
        name: 'Shared action radius',
        summary: 'Map the button to the project radius while preserving its measured size.',
        reasoning: ['The current radius is the only value outside the nearby component rhythm.'],
        exactValues: ['border-radius: 8px'],
        sourceLocations: ['PrimaryAction.tsx:1'],
        responsiveImpact: 'The fixed radius is stable across configured breakpoints.',
        verificationPlan: ['Rebuild, measure the radius, and compare mobile and desktop.'],
        changes: [{ ...visualChange, after: '8px', status: 'draft' }],
      },
    ],
  });
  await page.waitForTimeout(1700);
  await page.locator('.visual-agent-proposal').waitFor();
  assert.match(
    (await page.locator('.visual-agent-proposal').textContent()) ?? '',
    /Shared action radius/,
  );
  assert.match(
    (await page.locator('.visual-agent-proposal').textContent()) ?? '',
    /border-radius: 8px/,
  );
  assert.equal(await page.getByRole('button', { name: 'Preview direction' }).isEnabled(), true);
  const visualAgentGeometry = await page.evaluate(() => {
    const shell = document.querySelector('.visual-agent-shell');
    const threads = document.querySelector('.visual-agent-threads');
    const conversation = document.querySelector('.visual-agent-conversation');
    const compose = document.querySelector('.visual-agent-compose');
    const proposalGrid = document.querySelector('.visual-agent-proposal-grid');
    const verification = proposalGrid?.lastElementChild;
    const review = document.querySelector('#visual-agent-review');
    const shellStyle = getComputedStyle(shell);
    const conversationStyle = getComputedStyle(conversation);
    return {
      threadWidth: Math.round(threads.getBoundingClientRect().width),
      composeWidth: Math.round(compose.getBoundingClientRect().width),
      threadConversationGap: Math.round(
        conversation.getBoundingClientRect().left - threads.getBoundingClientRect().right,
      ),
      conversationComposeGap: Math.round(
        compose.getBoundingClientRect().left - conversation.getBoundingClientRect().right,
      ),
      shellColumnGap: Number.parseFloat(shellStyle.columnGap),
      conversationOverflow: conversation.scrollWidth - conversation.clientWidth,
      conversationRadius: conversationStyle.borderRadius,
      evidenceColumns: getComputedStyle(proposalGrid).gridTemplateColumns.split(' ').length,
      verificationWidth: Math.round(verification.getBoundingClientRect().width),
      proposalGridWidth: Math.round(proposalGrid.getBoundingClientRect().width),
      reviewVisible: review.getBoundingClientRect().width > 0,
    };
  });
  assert.equal(visualAgentGeometry.threadWidth, 320);
  assert.equal(visualAgentGeometry.composeWidth, 360);
  assert.equal(visualAgentGeometry.threadConversationGap, 0);
  assert.equal(visualAgentGeometry.conversationComposeGap, 0);
  assert.equal(visualAgentGeometry.shellColumnGap, 0);
  assert.ok(visualAgentGeometry.conversationOverflow <= 1);
  assert.equal(visualAgentGeometry.conversationRadius, '0px');
  assert.equal(visualAgentGeometry.evidenceColumns, 2);
  assert.ok(
    Math.abs(visualAgentGeometry.verificationWidth - visualAgentGeometry.proposalGridWidth) <= 2,
  );
  assert.equal(visualAgentGeometry.reviewVisible, true);
  await page.screenshot({
    path: join(artifactDirectory, 'visual-agent-light.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'visual-agent-dark.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  const compactVisualAgentGeometry = await page.evaluate(() => {
    const threads = document.querySelector('.visual-agent-threads');
    const conversation = document.querySelector('.visual-agent-conversation');
    const compose = document.querySelector('.visual-agent-compose');
    const review = document.querySelector('#visual-agent-review');
    return {
      threadWidth: Math.round(threads.getBoundingClientRect().width),
      composeWidth: Math.round(compose.getBoundingClientRect().width),
      threadConversationGap: Math.round(
        conversation.getBoundingClientRect().left - threads.getBoundingClientRect().right,
      ),
      conversationComposeGap: Math.round(
        compose.getBoundingClientRect().left - conversation.getBoundingClientRect().right,
      ),
      conversationOverflow: conversation.scrollWidth - conversation.clientWidth,
      reviewVisible: review.getBoundingClientRect().width > 0,
    };
  });
  assert.equal(compactVisualAgentGeometry.threadWidth, 280);
  assert.equal(compactVisualAgentGeometry.composeWidth, 300);
  assert.equal(compactVisualAgentGeometry.threadConversationGap, 0);
  assert.equal(compactVisualAgentGeometry.conversationComposeGap, 0);
  assert.ok(compactVisualAgentGeometry.conversationOverflow <= 1);
  assert.equal(compactVisualAgentGeometry.reviewVisible, true);
  await page.screenshot({
    path: join(artifactDirectory, 'visual-agent-compact-light.png'),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.workspace-rail [data-workspace-mode="system"]').click();
  await page.getByRole('heading', { name: 'System', exact: true }).waitFor();
  await assertConnectedWorkspaceBrowser('.design-system-browser');
  assert.match((await page.locator('#design-system-status').textContent()) ?? '', /1 token/);
  assert.match((await page.locator('#design-system-status').textContent()) ?? '', /1 promotion/);
  assert.equal(await page.locator('.design-token-row').count(), 1);
  assert.equal(await page.getByText('--preview-width', { exact: true }).count(), 0);
  assert.equal(
    await page
      .locator('.design-token-row')
      .evaluate((element) => element.getBoundingClientRect().height),
    48,
  );
  assert.match((await page.locator('#design-system-detail').textContent()) ?? '', /--color-signal/);
  assert.match((await page.locator('#design-system-detail').textContent()) ?? '', /1 indexed/);
  assert.match(
    (await page.locator('#design-system-detail').textContent()) ?? '',
    /near-duplicate literal/,
  );
  assert.match((await page.locator('#design-system-detail').textContent()) ?? '', /Alias chain/);
  const usageKindGeometry = await page
    .locator('.usage-kind')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        width: element.getBoundingClientRect().width,
        textTransform: style.textTransform,
        backgroundColor: style.backgroundColor,
      };
    });
  assert.equal(usageKindGeometry.height, 20, 'usage trace tags use the compact metadata height');
  assert.ok(usageKindGeometry.width <= 72, 'usage trace tags hug their content');
  assert.equal(usageKindGeometry.textTransform, 'uppercase');
  assert.ok(
    ['transparent', 'rgba(0, 0, 0, 0)'].includes(usageKindGeometry.backgroundColor),
    'reference tags remain visually quiet',
  );
  await page.locator('[data-system-view="promotions"]').click();
  assert.equal(await page.locator('[data-system-promotion]').count(), 1);
  assert.match(
    (await page.locator('#design-system-detail').textContent()) ?? '',
    /Recommended plan/,
  );
  assert.match(
    (await page.locator('#design-system-detail').textContent()) ?? '',
    /3 authored occurrences/,
  );
  await page.locator('[data-stage-token-promotion]').click();
  await page
    .frameLocator('#product-preview')
    .locator('html[data-staged-token-promotion="promotion-color-signal"]')
    .waitFor();
  await page.screenshot({
    path: join(artifactDirectory, 'design-system-light.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'design-system-dark.png'),
    fullPage: false,
  });
  await page.locator('.workspace-rail [data-workspace-mode="responsive"]').click();
  await page.getByRole('heading', { name: 'Responsive design lab' }).waitFor();
  await assertConnectedWorkspaceBrowser('.responsive-lab-controls');
  const responsiveControlGeometry = await page
    .locator('.responsive-lab-controls')
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      firstGroupHeight: element.firstElementChild?.getBoundingClientRect().height ?? 0,
    }));
  assert.ok(
    responsiveControlGeometry.scrollWidth <= responsiveControlGeometry.clientWidth,
    'responsive controls must not overflow horizontally',
  );
  assert.ok(
    responsiveControlGeometry.firstGroupHeight <= 48,
    'responsive scrub controls must hug their content',
  );
  await page.locator('[data-responsive-frame="mobile"]').waitFor();
  assert.equal(await page.locator('[data-responsive-frame="mobile"]').getAttribute('width'), '390');
  assert.equal(
    await page.locator('[data-responsive-frame="desktop"]').getAttribute('width'),
    '1440',
  );
  await page.locator('#responsive-width').evaluate((element) => {
    element.value = '1024';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(
    await page.locator('[data-responsive-frame="custom"]').getAttribute('width'),
    '1024',
  );
  await page.locator('[data-responsive-target="container"]').click();
  assert.equal(await page.locator('[data-responsive-container-boundary]').count(), 2);
  await page.locator('#responsive-width').evaluate((element) => {
    element.value = '420';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page
    .frameLocator('[data-responsive-frame="custom"]')
    .locator('main')
    .evaluate(
      (element) =>
        new Promise((resolve) => {
          const done = () => element.style.inlineSize === '420px' && resolve();
          done();
          const observer = new MutationObserver(() => {
            done();
            if (element.style.inlineSize === '420px') observer.disconnect();
          });
          observer.observe(element, { attributes: true, attributeFilter: ['style'] });
        }),
    );
  await page.locator('#responsive-capture-before').click();
  await page.locator('#responsive-width').evaluate((element) => {
    element.value = '640';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page
    .frameLocator('[data-responsive-frame="custom"]')
    .locator('main')
    .evaluate(
      (element) =>
        new Promise((resolve) => {
          const done = () => element.style.inlineSize === '640px' && resolve();
          done();
          const observer = new MutationObserver(() => {
            done();
            if (element.style.inlineSize === '640px') observer.disconnect();
          });
          observer.observe(element, { attributes: true, attributeFilter: ['style'] });
        }),
    );
  await page.locator('#responsive-capture-after').click();
  await page.locator('.responsive-comparison-delta').getByText('+220px container').waitFor();
  await page.locator('[data-responsive-stress="dynamic-type"]').click();
  assert.equal(await page.locator('#change-count').textContent(), '1 change · Main direction');
  const responsiveDarkSelection = await page
    .locator('.responsive-viewport-card.is-active')
    .evaluate((element) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--selection)';
      document.body.append(probe);
      const selection = getComputedStyle(probe).color;
      probe.remove();
      return {
        selection,
        border: getComputedStyle(element).borderColor,
      };
    });
  assert.equal(
    responsiveDarkSelection.border,
    responsiveDarkSelection.selection,
    'dark responsive selection must use the orange system accent',
  );
  await page.screenshot({
    path: join(artifactDirectory, 'responsive-design-lab-dark.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'responsive-design-lab-light.png'),
    fullPage: false,
  });
  await page.locator('.workspace-rail [data-workspace-mode="health"]').click();
  await page.getByRole('heading', { name: 'Content Stress Lab' }).waitFor();
  await assertConnectedWorkspaceBrowser('.stress-lab-browser');
  await page
    .frameLocator('[data-responsive-frame="custom"]')
    .locator('main')
    .evaluate(
      (element) =>
        new Promise((resolve) => {
          const done = () => element.style.inlineSize === '' && resolve();
          done();
          const observer = new MutationObserver(() => {
            done();
            if (element.style.inlineSize === '') observer.disconnect();
          });
          observer.observe(element, { attributes: true, attributeFilter: ['style'] });
        }),
    );
  assert.equal(await page.locator('.stress-profile').count(), 3);
  await page.getByRole('button', { name: /Long content/ }).click();
  await page.getByRole('button', { name: /Keyboard only/ }).click();
  await page.locator('#apply-stress').click();
  await page.waitForFunction(
    () => document.querySelector('#stress-lab-status')?.textContent === '2 conditions active',
  );
  assert.equal(
    await page.frameLocator('#product-preview').locator('html').getAttribute('data-foundry-stress'),
    'long-content keyboard-only',
  );
  assert.equal(await page.locator('#change-count').textContent(), '1 change · Main direction');
  assert.match(
    (await page.locator('.stress-finding-card').first().textContent()) ?? '',
    /PrimaryAction\.tsx:1/,
  );
  await page.screenshot({
    path: join(artifactDirectory, 'content-accessibility-lab-light.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  const stressDarkSelection = await page
    .locator('.stress-profile.is-active')
    .first()
    .evaluate((element) => {
      const colorProbe = document.createElement('span');
      colorProbe.style.color = 'var(--selection)';
      const backgroundProbe = document.createElement('span');
      backgroundProbe.style.backgroundColor = 'var(--selection-soft)';
      document.body.append(colorProbe, backgroundProbe);
      const selection = getComputedStyle(colorProbe).color;
      const selectionSoft = getComputedStyle(backgroundProbe).backgroundColor;
      colorProbe.remove();
      backgroundProbe.remove();
      const style = getComputedStyle(element);
      return {
        selection,
        selectionSoft,
        border: style.borderColor,
        background: style.backgroundColor,
        iconColor: getComputedStyle(element.querySelector('svg')).color,
      };
    });
  assert.equal(stressDarkSelection.border, stressDarkSelection.selection);
  assert.equal(stressDarkSelection.background, stressDarkSelection.selectionSoft);
  assert.equal(stressDarkSelection.iconColor, stressDarkSelection.selection);
  await page.screenshot({
    path: join(artifactDirectory, 'content-accessibility-lab-dark.png'),
    fullPage: false,
  });
  await page.getByRole('button', { name: 'Source' }).click();
  assert.match(
    (await page.locator('.stress-finding-group > header').first().textContent()) ?? '',
    /PrimaryAction\.tsx:1/,
  );
  await page.locator('#clear-stress').click();
  await page.waitForFunction(
    () => document.querySelector('#stress-lab-status')?.textContent === 'No temporary conditions',
  );
  assert.equal(
    await page.frameLocator('#product-preview').locator('html').getAttribute('data-foundry-stress'),
    null,
  );
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.locator('.workspace-rail [data-workspace-mode="motion"]').click();
  await page.getByRole('heading', { name: 'Motion studio' }).waitFor();
  await assertConnectedWorkspaceBrowser('.motion-studio-browser');
  assert.equal(await page.locator('.motion-studio-row').count(), 1);
  assert.equal(await page.locator('.motion-studio-track').count(), 2);
  assert.equal(await page.locator('.motion-curve-editor').count(), 1);
  assert.equal(await page.locator('[data-curve-handle]').count(), 2);
  assert.equal(await page.locator('.motion-path-editor').count(), 1);
  assert.equal(await page.locator('[data-path-point]').count(), 2);
  assert.equal(await page.locator('.motion-comparison').count(), 1);
  assert.equal(await page.locator('[data-comparison-dot]').count(), 2);
  assert.equal(await page.locator('[data-native-adapter="motion"]').count(), 1);
  const motionGeometry = await page.locator('.motion-studio-mode').evaluate((surface) => {
    const shell = surface.querySelector('.motion-studio-shell');
    const browserPanel = surface.querySelector('.motion-studio-browser');
    const stage = surface.querySelector('.motion-studio-stage');
    const canvas = surface.querySelector('.motion-studio-canvas');
    const properties = surface.querySelector('.motion-studio-properties');
    const comparison = surface.querySelector('.motion-comparison');
    const sectionCards = [
      ...surface.querySelectorAll(
        '.motion-native-source, .motion-timing-section, .motion-path-editor, .motion-curve-editor, .motion-studio-audit, .motion-studio-keyframe',
      ),
    ];
    const browserRect = browserPanel.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const propertiesRect = properties.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    return {
      browserWidth: Math.round(browserRect.width),
      browserStageGap: Math.round(stageRect.left - browserRect.right),
      stagePropertiesGap: Math.round(propertiesRect.left - stageRect.right),
      shellBottom: Math.round(shellRect.bottom),
      canvasBottom: Math.round(canvas.getBoundingClientRect().bottom),
      comparisonMinHeight: comparison.getBoundingClientRect().height,
      stageOverflow: stage.scrollWidth - stage.clientWidth,
      propertiesOverflow: properties.scrollWidth - properties.clientWidth,
      stageRadius: getComputedStyle(stage).borderRadius,
      canvasRadius: getComputedStyle(canvas).borderRadius,
      sectionRadii: sectionCards.map((section) => getComputedStyle(section).borderRadius),
    };
  });
  assert.equal(motionGeometry.browserWidth, 320);
  assert.equal(motionGeometry.browserStageGap, 0);
  assert.equal(motionGeometry.stagePropertiesGap, 0);
  assert.equal(motionGeometry.canvasBottom, motionGeometry.shellBottom);
  assert.ok(motionGeometry.comparisonMinHeight >= 300);
  assert.ok(motionGeometry.stageOverflow <= 1);
  assert.ok(motionGeometry.propertiesOverflow <= 1);
  assert.equal(motionGeometry.stageRadius, '0px');
  assert.equal(motionGeometry.canvasRadius, '0px');
  assert.ok(motionGeometry.sectionRadii.every((radius) => radius === '0px'));
  assert.match(
    (await page.locator('.motion-native-source').textContent()) ?? '',
    /Motion for React.*transition\.duration.*animate \/ variants/s,
  );
  assert.match(
    (await page.locator('.motion-curve-source').textContent()) ?? '',
    /cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)/,
  );
  assert.match(
    (await page.locator('#motion-studio-properties').textContent()) ?? '',
    /Reduced motion covered/,
  );
  await page.locator('[data-studio-action="replay"]').click();
  assert.equal(await page.locator('#change-count').textContent(), '1 change · Main direction');
  await page.getByRole('button', { name: 'Ease out' }).click();
  await page
    .frameLocator('#product-preview')
    .locator('html[data-last-motion-action="curve"]')
    .waitFor();
  assert.equal(
    await page
      .frameLocator('#product-preview')
      .locator('html')
      .getAttribute('data-last-motion-action'),
    'curve',
  );
  await page.locator('.motion-comparison.is-changed').waitFor();
  await page.getByRole('button', { name: 'Replay synchronized comparison' }).click();
  await page.waitForFunction(
    () => Number(document.querySelector('[data-comparison-scrub]')?.value ?? 0) > 0,
  );
  await page.getByRole('button', { name: 'Preview curve' }).click();
  await page.waitForFunction(() =>
    document.querySelector('.motion-curve-preview-dot')?.classList.contains('is-playing'),
  );
  assert.ok(
    await page
      .locator('.motion-curve-preview-dot')
      .evaluate((node) => node.classList.contains('is-playing')),
  );
  await page.screenshot({
    path: join(artifactDirectory, 'motion-studio-light.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'motion-studio-dark.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  const compactMotionGeometry = await page.locator('.motion-studio-mode').evaluate((surface) => {
    const shell = surface.querySelector('.motion-studio-shell');
    const browserPanel = surface.querySelector('.motion-studio-browser');
    const stage = surface.querySelector('.motion-studio-stage');
    const properties = surface.querySelector('.motion-studio-properties');
    const browserRect = browserPanel.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const propertiesRect = properties.getBoundingClientRect();
    return {
      shellDisplay: getComputedStyle(shell).display,
      browserWidth: Math.round(browserRect.width),
      browserStageGap: Math.round(stageRect.left - browserRect.right),
      stagePropertiesGap: Math.round(propertiesRect.left - stageRect.right),
      stageOverflow: stage.scrollWidth - stage.clientWidth,
      propertiesOverflow: properties.scrollWidth - properties.clientWidth,
    };
  });
  assert.equal(compactMotionGeometry.shellDisplay, 'grid');
  assert.equal(compactMotionGeometry.browserWidth, 280);
  assert.equal(compactMotionGeometry.browserStageGap, 0);
  assert.equal(compactMotionGeometry.stagePropertiesGap, 0);
  assert.ok(compactMotionGeometry.stageOverflow <= 1);
  assert.ok(compactMotionGeometry.propertiesOverflow <= 1);
  await page.screenshot({
    path: join(artifactDirectory, 'motion-studio-compact-light.png'),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.locator('.workspace-rail [data-workspace-mode="typography"]').click();
  await page.getByRole('heading', { name: 'Typography studio' }).waitFor();
  await assertConnectedWorkspaceBrowser('.typography-studio-browser');
  assert.equal(await page.locator('.typography-font-row').count(), 2);
  assert.equal(await page.locator('.typography-font-row.is-active').count(), 1);
  assert.equal(
    await page.locator('.typography-font-row.is-active').getAttribute('aria-pressed'),
    'true',
  );
  assert.equal(await page.locator('.typography-treatment-grid button').count(), 3);
  const typographyGeometry = await page.locator('.typography-studio-mode').evaluate((surface) => {
    const shell = surface.querySelector('.typography-studio-shell');
    const browserPanel = surface.querySelector('.typography-studio-browser');
    const stage = surface.querySelector('.typography-studio-stage');
    const properties = surface.querySelector('.typography-studio-properties');
    const specimen = surface.querySelector('.typography-specimen');
    const specimenText = surface.querySelector('.typography-specimen-text');
    const selectionSummary = surface.querySelector('.typography-selection-summary');
    const selectionLabel = selectionSummary.querySelector('strong');
    const sectionCards = [
      ...surface.querySelectorAll(
        '.typography-specimen, .typography-treatment-panel, .typography-usage-panel, .typography-rendered-section, .typography-audit, .typography-google-review, .typography-saved-styles',
      ),
    ];
    const browserRect = browserPanel.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const propertiesRect = properties.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    return {
      browserWidth: Math.round(browserRect.width),
      browserStageGap: Math.round(stageRect.left - browserRect.right),
      stagePropertiesGap: Math.round(propertiesRect.left - stageRect.right),
      shellBottom: Math.round(shellRect.bottom),
      stageBottom: Math.round(stageRect.bottom),
      stageOverflow: stage.scrollWidth - stage.clientWidth,
      propertiesOverflow: properties.scrollWidth - properties.clientWidth,
      selectionInset: Math.round(selectionLabel.getBoundingClientRect().left - browserRect.left),
      selectionLabelWidth: Math.round(selectionLabel.getBoundingClientRect().width),
      stageRadius: getComputedStyle(stage).borderRadius,
      specimenRadius: getComputedStyle(specimen).borderRadius,
      specimenHeight: Math.round(specimen.getBoundingClientRect().height),
      specimenAlign: getComputedStyle(specimenText).alignItems,
      specimenJustify: getComputedStyle(specimenText).justifyContent,
      specimenTextAlign: getComputedStyle(specimenText).textAlign,
      sectionRadii: sectionCards.map((section) => getComputedStyle(section).borderRadius),
    };
  });
  assert.equal(typographyGeometry.browserWidth, 320);
  assert.equal(typographyGeometry.browserStageGap, 0);
  assert.equal(typographyGeometry.stagePropertiesGap, 0);
  assert.equal(typographyGeometry.stageBottom, typographyGeometry.shellBottom);
  assert.ok(typographyGeometry.stageOverflow <= 1);
  assert.ok(typographyGeometry.propertiesOverflow <= 1);
  assert.equal(typographyGeometry.selectionInset, 16);
  assert.ok(typographyGeometry.selectionLabelWidth > 200);
  assert.equal(typographyGeometry.stageRadius, '0px');
  assert.equal(typographyGeometry.specimenRadius, '0px');
  assert.equal(typographyGeometry.specimenHeight, 280);
  assert.equal(typographyGeometry.specimenAlign, 'center');
  assert.equal(typographyGeometry.specimenJustify, 'center');
  assert.equal(typographyGeometry.specimenTextAlign, 'center');
  assert.ok(typographyGeometry.sectionRadii.every((radius) => radius === '0px'));
  assert.match(
    (await page.locator('#typography-studio-properties').textContent()) ?? '',
    /Rendered type is stable/,
  );
  await page.locator('[data-treatment-id="balanced"]').click();
  await page.screenshot({
    path: join(artifactDirectory, 'typography-studio-dark.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'typography-studio-light.png'),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  const compactTypographyGeometry = await page
    .locator('.typography-studio-mode')
    .evaluate((surface) => {
      const shell = surface.querySelector('.typography-studio-shell');
      const browserPanel = surface.querySelector('.typography-studio-browser');
      const stage = surface.querySelector('.typography-studio-stage');
      const properties = surface.querySelector('.typography-studio-properties');
      const browserRect = browserPanel.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const propertiesRect = properties.getBoundingClientRect();
      return {
        shellDisplay: getComputedStyle(shell).display,
        browserWidth: Math.round(browserRect.width),
        browserStageGap: Math.round(stageRect.left - browserRect.right),
        stagePropertiesGap: Math.round(propertiesRect.left - stageRect.right),
        stageOverflow: stage.scrollWidth - stage.clientWidth,
        propertiesOverflow: properties.scrollWidth - properties.clientWidth,
        specimenHeight: Math.round(
          surface.querySelector('.typography-specimen').getBoundingClientRect().height,
        ),
        treatmentColumns: getComputedStyle(
          surface.querySelector('.typography-treatment-grid'),
        ).gridTemplateColumns.split(' ').length,
      };
    });
  assert.equal(compactTypographyGeometry.shellDisplay, 'grid');
  assert.equal(compactTypographyGeometry.browserWidth, 280);
  assert.equal(compactTypographyGeometry.browserStageGap, 0);
  assert.equal(compactTypographyGeometry.stagePropertiesGap, 0);
  assert.ok(compactTypographyGeometry.stageOverflow <= 1);
  assert.ok(compactTypographyGeometry.propertiesOverflow <= 1);
  assert.equal(compactTypographyGeometry.specimenHeight, 240);
  assert.equal(compactTypographyGeometry.treatmentColumns, 3);
  await page.screenshot({
    path: join(artifactDirectory, 'typography-studio-compact-light.png'),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.workspace-rail [data-workspace-mode="branches"]').click();
  await page.getByRole('heading', { name: 'Design branches' }).waitFor();
  await assertConnectedWorkspaceBrowser('.design-branch-browser');
  assert.equal(await page.locator('.design-branch-row').count(), 2);
  assert.equal(await page.locator('.design-branch-preview-card').count(), 2);
  assert.equal(await page.locator('.design-branch-decision-row').count(), 2);
  await page.locator('.design-branch-row').filter({ hasText: 'Editorial scale' }).click();
  await page.waitForFunction(
    () => document.querySelector('#design-branch-status')?.textContent === 'Editorial scale',
  );
  assert.equal(await page.locator('#design-branch-status').textContent(), 'Editorial scale');
  assert.equal(await page.locator('#change-count').textContent(), '2 changes · Editorial scale');
  await page.getByRole('button', { name: 'Choose direction' }).click();
  await page.getByRole('heading', { name: 'Review and apply' }).waitFor();
  await page.locator('.workspace-rail [data-workspace-mode="branches"]').click();
  await page.getByRole('heading', { name: 'Design branches' }).waitFor();
  assert.equal(await page.locator('.design-branch-record').count(), 1);
  assert.match(
    (await page.locator('.design-branch-record').textContent()) ?? '',
    /Editorial scale.*chosen.*Ready/s,
  );
  await page.getByRole('button', { name: 'Add to Memory' }).click();
  await page
    .frameLocator('#product-preview')
    .locator('html[data-foundry-decision="approved"]')
    .waitFor();
  await page.getByRole('button', { name: 'Restore direction' }).click();
  await page.waitForFunction(() =>
    document
      .querySelector('#design-branch-status')
      ?.textContent?.includes('Editorial scale (restored)'),
  );
  assert.equal(await page.locator('.design-branch-row').count(), 3);
  const branchGeometry = await page.locator('.design-branches-mode').evaluate((surface) => {
    const shell = surface.querySelector('.design-branches-shell');
    const browserPanel = surface.querySelector('.design-branch-browser');
    const stage = surface.querySelector('.design-branch-stage');
    const detail = surface.querySelector('.design-branch-detail');
    const previews = [...surface.querySelectorAll('.design-branch-preview-card')];
    const browserRect = browserPanel.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const detailRect = detail.getBoundingClientRect();
    return {
      shellDisplay: getComputedStyle(shell).display,
      browserWidth: Math.round(browserRect.width),
      detailWidth: Math.round(detailRect.width),
      browserStageGap: Math.round(stageRect.left - browserRect.right),
      stageDetailGap: Math.round(detailRect.left - stageRect.right),
      stageOverflow: stage.scrollWidth - stage.clientWidth,
      detailOverflow: detail.scrollWidth - detail.clientWidth,
      previewWidths: previews.map((preview) => Math.round(preview.getBoundingClientRect().width)),
      previewTops: previews.map((preview) => Math.round(preview.getBoundingClientRect().top)),
      previewRadius: previews.map((preview) => getComputedStyle(preview).borderRadius),
      footerCount: surface.querySelectorAll('.design-branch-footer').length,
    };
  });
  assert.equal(branchGeometry.shellDisplay, 'grid');
  assert.equal(branchGeometry.browserWidth, 320);
  assert.equal(branchGeometry.detailWidth, 360);
  assert.equal(branchGeometry.browserStageGap, 0);
  assert.equal(branchGeometry.stageDetailGap, 0);
  assert.ok(branchGeometry.stageOverflow <= 1);
  assert.ok(branchGeometry.detailOverflow <= 1);
  assert.ok(branchGeometry.previewWidths.every((width) => width >= 480));
  assert.equal(new Set(branchGeometry.previewTops).size, 1);
  assert.ok(branchGeometry.previewRadius.every((radius) => radius === '8px'));
  assert.equal(branchGeometry.footerCount, 0);
  assert.equal(await page.locator('#design-branch-compose').isVisible(), true);
  assert.equal(await page.getByRole('button', { name: 'Return to main' }).isVisible(), true);
  await page.screenshot({
    path: join(artifactDirectory, 'design-branches-light.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({
    path: join(artifactDirectory, 'design-branches-dark.png'),
    fullPage: false,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  const compactBranchGeometry = await page.locator('.design-branches-mode').evaluate((surface) => {
    const browserPanel = surface.querySelector('.design-branch-browser');
    const stage = surface.querySelector('.design-branch-stage');
    const detail = surface.querySelector('.design-branch-detail');
    const browserRect = browserPanel.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const detailRect = detail.getBoundingClientRect();
    return {
      browserWidth: Math.round(browserRect.width),
      detailWidth: Math.round(detailRect.width),
      browserStageGap: Math.round(stageRect.left - browserRect.right),
      stageDetailGap: Math.round(detailRect.left - stageRect.right),
      stageOverflow: stage.scrollWidth - stage.clientWidth,
      detailOverflow: detail.scrollWidth - detail.clientWidth,
      previewCount: surface.querySelectorAll('.design-branch-preview-card').length,
      decisionActionsVisible:
        surface.querySelector('#design-branch-compose').getBoundingClientRect().width > 0,
    };
  });
  assert.equal(compactBranchGeometry.browserWidth, 280);
  assert.equal(compactBranchGeometry.detailWidth, 300);
  assert.equal(compactBranchGeometry.browserStageGap, 0);
  assert.equal(compactBranchGeometry.stageDetailGap, 0);
  assert.ok(compactBranchGeometry.stageOverflow <= 1);
  assert.ok(compactBranchGeometry.detailOverflow <= 1);
  assert.equal(compactBranchGeometry.previewCount, 2);
  assert.equal(compactBranchGeometry.decisionActionsVisible, true);
  await page.screenshot({
    path: join(artifactDirectory, 'design-branches-compact-light.png'),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole('button', { name: 'Return to main' }).click();
  await page.waitForFunction(
    () => document.querySelector('#design-branch-status')?.textContent === 'Main direction',
  );
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.locator('.workspace-rail [data-workspace-mode="canvas"]').click();
  await page.locator('#workspace-menu-trigger').click();
  await page.locator('#workspace-menu [data-workspace-mode="review"]').click();

  await page.getByRole('heading', { name: 'Review and apply' }).waitFor();
  assert.equal(await page.locator('#review-count').textContent(), '0 included');
  assert.equal(await page.locator('.change-row').count(), 2);
  assert.doesNotMatch((await page.locator('#changes').textContent()) ?? '', /pxpx/);
  assert.deepEqual(pageErrors, []);
  await assertAccessibleWorkspaceSurface();

  await page.screenshot({ path: join(artifactDirectory, 'review-light.png'), fullPage: false });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({ path: join(artifactDirectory, 'review-dark.png'), fullPage: false });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });

  const reviewSession = await store.read(sessionId);
  const applyChanges = reviewSession.changeSet.changes.filter(
    (change) => change.confidence !== 'unresolved',
  );
  await store.createApplyRun(sessionId, {
    reviews: applyChanges.map((change) => ({ changeId: change.id, approved: true })),
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#apply-run:not([hidden])').waitFor();
  await page.getByRole('heading', { name: 'Apply and verify', exact: true }).first().waitFor();
  await assertAccessibleWorkspaceSurface();
  await page.screenshot({ path: join(artifactDirectory, 'apply-light.png'), fullPage: false });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({ path: join(artifactDirectory, 'apply-dark.png'), fullPage: false });
  console.log(
    'Workspace Playwright flow passed: session, native viewport, Canvas, State Workbench, Component Workshop, System, Responsive Lab, Content and Accessibility Lab, Motion Studio, Typography Studio, Design Branches, change summary, Review, and Apply.',
  );
} finally {
  await browser?.close();
  await runtime.stop();
  await new Promise((resolveClose) => preview.close(() => resolveClose()));
}
