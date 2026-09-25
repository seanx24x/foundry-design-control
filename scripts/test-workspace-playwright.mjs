import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { FoundryRuntime, SessionStore } from '../packages/runtime/dist/index.js';
import { verifyConnectionWorkflow, verifyDeliveryWorkflow } from './verify-product-workflow.mjs';
import { verifyInspectorFonts } from './verify-inspector-fonts.mjs';

const root = resolve(import.meta.dirname, '..');
const runtimePort = 47_000 + Math.floor(Math.random() * 500);
const previewPort = runtimePort + 500;
const store = new SessionStore(await mkdtemp(join(tmpdir(), 'foundry-workspace-e2e-')));
let reindexCount = 0;
const runtime = new FoundryRuntime({
  port: runtimePort,
  store,
  reindexProjectDesign: async ({ sessionId: activeSessionId }) => {
    reindexCount += 1;
    const current = await store.read(activeSessionId);
    const graph = current.designGraph;
    return {
      ...graph,
      revision: `workspace-e2e-reindex-${reindexCount}`,
      indexedAt: new Date().toISOString(),
      tokens: [
        ...graph.tokens.filter((token) => token.id !== 'token-space-panel'),
        {
          id: 'token-space-panel',
          name: '--space-panel',
          value: '16px',
          category: 'spacing',
          confidence: 'instrumented',
          evidence: ['Fresh CLI index'],
          cssVariable: '--space-panel',
          resolvedValue: '16px',
          aliasChain: ['--space-panel'],
          aliasStatus: 'direct',
          source: { file: 'style.css', line: 2 },
        },
      ],
    };
  },
});
let sessionId = '';
const preview = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(
    `<!doctype html><html><head><style>html,body{background:rgb(255,255,255);color:rgb(17,17,17)}html[data-theme="dark"],html[data-theme="dark"] body{background:rgb(17,20,17);color:rgb(244,245,242)}button[data-foundry-state="focus"]{outline:4px solid rgb(120,169,154);outline-offset:2px}</style></head><body style="margin:0"><main data-foundry-container="signup-shell" style="container:signup-shell / inline-size;width:640px"><button data-foundry-component="Signup/PrimaryAction" data-story="Primary" style="box-sizing:border-box;width:100px;height:40px;padding:2px 6px;font-family:Inter,sans-serif;font-size:12px;font-weight:600;font-style:italic;font-variation-settings:'wght' 600;line-height:16px;letter-spacing:1px;white-space:normal;overflow-wrap:anywhere;word-break:normal;text-align:center;overflow:hidden">Create workspace</button><button data-foundry-component="Signup/PrimaryAction" data-story="Quiet" style="width:100px;height:40px">Save draft</button></main><script>
      let stressConditions = [];
      let stressScope = 'selection';
      const publish = () => parent.postMessage({ type: 'foundry:workspace-state', sessionId: '${sessionId}', payload: {
        context: { scope: 'instance', breakpoint: workspaceContext?.viewport?.id ?? 'current', theme: workspaceContext?.theme ?? 'current', state: workspaceContext?.state ?? 'current' },
        selection: { id: 'create-workspace', label: 'Create workspace', kind: 'button', selector: 'button', source: { file: 'PrimaryAction.tsx', line: 1 }, component: 'Signup/PrimaryAction', confidence: 'instrumented', width: 100, height: 40, count: 1, targets: [{ id: 'create-workspace', label: 'Create workspace', kind: 'button', selector: 'button', source: 'PrimaryAction.tsx:1', component: 'Signup/PrimaryAction', confidence: 'instrumented', geometry: { x: 20, y: 20, width: 100, height: 40, scale: 1 }, measurements: { fontSize: '16px', borderRadius: '8px' } }] },
        visualAgent: { region: null, capturingRegion: false },
        layers: [{ id: 'create-workspace', selector: 'button:first-of-type', label: 'Create workspace', kind: 'component', component: 'Signup/PrimaryAction', source: { file: 'PrimaryAction.tsx', line: 1 }, width: 100, height: 40, depth: 0, instrumented: true, hasChildren: false, selected: true, variantProps: { story: document.querySelector('button:first-of-type').dataset.story } }, { id: 'save-draft', selector: 'button:last-of-type', label: 'Save draft', kind: 'component', component: 'Signup/PrimaryAction', source: { file: 'PrimaryAction.tsx', line: 2 }, width: 100, height: 40, depth: 0, instrumented: true, hasChildren: false, selected: false, variantProps: { story: document.querySelector('button:last-of-type').dataset.story } }],
        controls: [{ index: 0, category: 'typography', property: 'fontFamily', label: 'Font family', kind: 'text', value: 'Inter, sans-serif' }, { index: 1, category: 'typography', property: 'fontSize', label: 'Font size', kind: 'number', value: '12px' }], typography: { selection: { family: 'Inter, sans-serif', primaryFamily: 'Inter', weight: '600', style: 'italic', size: '12px', lineHeight: '16px', letterSpacing: '1px', variationSettings: '"wght" 600', text: 'Create workspace' }, projectFonts: [{ family: 'Inter', weights: ['400', '600'], styles: ['normal', 'italic'], origins: ['active', 'project'] }, { family: 'Foundry JetBrains Mono', weights: ['400', '600'], styles: ['normal', 'italic'], origins: ['project'] }], savedStyles: [], diagnostics: [], metrics: { lineCount: 1, charactersPerLine: 16, faceStatus: 'loaded' }, usages: [{ family: 'Inter', count: 4, weights: ['400', '600'], sizes: ['12px', '16px'], examples: ['Create workspace'] }], preview: null, treatments: [{ id: 'tight', label: 'Tight', detail: 'Compact display rhythm', lineHeight: 1.1, letterSpacing: '-0.02em' }, { id: 'balanced', label: 'Balanced', detail: 'Default interface rhythm', lineHeight: 1.25, letterSpacing: '0em' }, { id: 'open', label: 'Open', detail: 'Relaxed reading rhythm', lineHeight: 1.5, letterSpacing: '0.01em' }], scale: { base: 12, ratio: 1.25, step: 1, fluid: false, value: '15px' }, strategies: [{ id: 'framework', label: 'Framework native' }, { id: 'stylesheet', label: 'Stylesheet' }], googleSelection: null, validation: { breakpoints: [{ id: 'current', label: 'Current' }], themes: [{ id: 'light', label: 'Light' }], states: [{ id: 'current', label: 'Current' }] }, capabilities: { localFontAccess: false } }, motions: [{ id: 'motion_primary', label: 'Primary action entrance', kind: 'motion-react', authoring: { adapter: 'motion', label: 'Motion for React', source: { file: 'src/PrimaryAction.tsx', line: 18 }, sourceProperties: { duration: 'transition.duration', delay: 'transition.delay', easing: 'transition.ease', keyframes: 'animate / variants' }, evidence: ['motion source import', 'transition authoring site'] }, properties: ['opacity', 'transform'], timing: { duration: 480, delay: 0, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', iterations: 1, direction: 'normal', fill: 'both' }, curve: { kind: 'cubic-bezier', sourceValue: 'cubic-bezier(0.2, 0.8, 0.2, 1)', previewValue: 'cubic-bezier(0.2, 0.8, 0.2, 1)', cubicBezier: { x1: 0.2, y1: 0.8, x2: 0.2, y2: 1 }, points: [{ x: 0, y: 0 }, { x: 0.1, y: 0.3 }, { x: 0.25, y: 0.68 }, { x: 0.5, y: 0.94 }, { x: 0.75, y: 0.99 }, { x: 1, y: 1 }], diagnostics: { duration: 0, overshoot: 0, sampleCount: 61 } }, keyframes: [{ index: 0, offset: 0, easing: 'ease-out', values: { opacity: '0', transform: 'translateY(12px)' } }, { index: 1, offset: 1, easing: 'linear', values: { opacity: '1', transform: 'translateY(0px)' } }], path: { supported: true, property: 'transform', points: [{ index: 0, offset: 0, x: 0, y: 12, sourceValue: 'translateY(12px)' }, { index: 1, offset: 1, x: 0, y: 0, sourceValue: 'translateY(0px)' }], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 12, width: 0, height: 12 }, distance: 12 }, comparison: { changed: true, before: { timing: { duration: 560 }, curve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, path: { supported: true, points: [{ index: 0, offset: 0, x: -16, y: 16 }, { index: 1, offset: 1, x: 0, y: 0 }], distance: 22.6 } }, after: { timing: { duration: 480 }, curve: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, path: { supported: true, points: [{ index: 0, offset: 0, x: 0, y: 12 }, { index: 1, offset: 1, x: 0, y: 0 }], distance: 12 } }, diagnostics: { durationDelta: -80, distanceDelta: -10.6, pointDelta: 0 } }, performance: { tier: 'compositor', label: 'Compositor', detail: 'Transform and opacity stay on the compositor.' }, active: true, playState: 'paused', currentTime: 160, playbackRate: 1, looping: false, reducedMotionProtected: true }], history: { canUndo: false, canRedo: false },
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
      let workspaceContext = { version: 1, requestRevision: 0, viewport: { id: 'current', width: innerWidth, height: innerHeight }, theme: 'current', state: 'current', motionPreference: 'system' };
      const reply = (event, payload, error = '') => {
        if (!event.data.requestId) return;
        parent.postMessage({ type: 'foundry:workspace-result', sessionId: '${sessionId}', requestId: event.data.requestId, ok: !error, ...(error ? { error } : { payload }) }, 'http://127.0.0.1:${runtimePort}');
      };
      const axis = (status, method) => ({ status, method, evidence: [] });
      const typographyMetrics = (family) => {
        const target = document.querySelector('button:first-of-type');
        const style = getComputedStyle(target);
        const rect = target.getBoundingClientRect();
        const visibleSpecimen = {
          version: 1,
          text: target.textContent,
          width: rect.width,
          height: rect.height,
          boxSizing: style.boxSizing,
          paddingTop: style.paddingTop,
          paddingRight: style.paddingRight,
          paddingBottom: style.paddingBottom,
          paddingLeft: style.paddingLeft,
          borderTopWidth: style.borderTopWidth,
          borderRightWidth: style.borderRightWidth,
          borderBottomWidth: style.borderBottomWidth,
          borderLeftWidth: style.borderLeftWidth,
          borderTopStyle: style.borderTopStyle,
          borderRightStyle: style.borderRightStyle,
          borderBottomStyle: style.borderBottomStyle,
          borderLeftStyle: style.borderLeftStyle,
          fontFamily: family,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          fontVariationSettings: style.fontVariationSettings,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          whiteSpace: style.whiteSpace,
          overflowWrap: style.overflowWrap,
          wordBreak: style.wordBreak,
          textAlign: style.textAlign,
          textTransform: style.textTransform,
          textIndent: style.textIndent,
          direction: style.direction,
          writingMode: style.writingMode,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
        };
        return { text: target.textContent, family, primaryFamily: family.split(',')[0], weight: style.fontWeight, style: style.fontStyle, variationSettings: style.fontVariationSettings, fontSize: style.fontSize, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, loadedFaceStatus: 'loaded', fontCheck: true, lineCount: 1, width: rect.width, height: rect.height, scrollWidth: target.scrollWidth, scrollHeight: target.scrollHeight, clientWidth: target.clientWidth, clientHeight: target.clientHeight, clipped: false, visibleSpecimen };
      };
      const knownCommands = new Set(['preview-ping', 'interface-theme', 'set-mode', 'request-state', 'apply-preview-context', 'set-context', 'select', 'select-component-instance', 'preview-component-variant', 'stage-component-variant', 'stage-token-promotion', 'repair-component-variant-drift', 'preview-component-state', 'set-responsive-edit-scope', 'preview-responsive-stress', 'preview-responsive-container', 'audit-responsive', 'replace-design-graph', 'apply-health-stress', 'clear-health-stress', 'scan-health', 'preview-health-fix', 'select-health-issue', 'apply-visual-recipe', 'remove-visual-recipe', 'save-visual-recipe', 'duplicate-visual-recipe', 'import-visual-recipes', 'save-design-decision', 'update-design-decision', 'remove-design-decision', 'import-design-decisions', 'motion-action', 'typography-action', 'typography-compare', 'typography-use-font', 'switch-design-branch', 'preview-design-branch', 'arm-agent-region', 'capture-agent-region', 'clear-agent-region', 'compare', 'undo', 'redo', 'set-control']);
      addEventListener('message', (event) => {
        if (event.data?.type !== 'foundry:workspace-command') return;
        const command = event.data.command;
        const payload = event.data.payload ?? {};
        try {
          if (!knownCommands.has(command)) throw new Error('Unknown workspace command: ' + command);
          let result = { acknowledged: true, command };
          if (command === 'preview-ping') {
            result = { alive: true, receivedAt: Date.now(), sentAt: payload.sentAt, snapshot: { version: 1, currentPreviewContext: workspaceContext, lastPreviewApplication: null }, selection: { id: 'create-workspace', selector: 'button' } };
          } else if (command === 'interface-theme') {
            result = { preference: payload.value, resolved: payload.value === 'system' ? 'light' : payload.value };
          } else if (command === 'set-mode') {
            result = { mode: payload.mode };
          } else if (command === 'request-state') {
            publish();
            result = {
              version: 1,
              currentPreviewContext: workspaceContext,
              lastPreviewApplication: {
                applied: true,
                context: workspaceContext,
                requestRevision: workspaceContext.requestRevision,
              },
              selection: {
                id: 'create-workspace',
                selector: 'button:first-of-type',
                width: document.querySelector('button:first-of-type').getBoundingClientRect().width,
                height: document.querySelector('button:first-of-type').getBoundingClientRect().height,
              },
            };
          } else if (command === 'apply-preview-context') {
            const context = payload.context ?? payload;
            workspaceContext = context;
            document.documentElement.dataset.foundryViewport = context.viewport.id;
            document.documentElement.dataset.foundryMotion = context.motionPreference;
            document.documentElement.dataset.foundryRequestRevision = String(context.requestRevision);
            if (context.theme === 'current') delete document.documentElement.dataset.theme;
            else document.documentElement.dataset.theme = context.theme;
            const contextTarget = document.querySelector('button:first-of-type');
            if (context.state === 'current') {
              delete contextTarget.dataset.foundryState;
              contextTarget.disabled = false;
            } else {
              contextTarget.dataset.foundryState = context.state;
              contextTarget.disabled = context.state === 'disabled';
            }
            result = { version: 1, requestRevision: context.requestRevision, applied: true, context, axes: { viewport: axis('applied', 'frame'), theme: axis(context.theme === 'current' ? 'current' : 'applied', 'root-attribute'), state: axis(context.state === 'current' ? 'current' : 'applied', 'authored-state'), motion: axis(context.motionPreference === 'system' ? 'current' : 'applied', 'system-media-query') } };
            publish();
          } else if (command === 'preview-component-variant') {
            document.querySelector('button').dataset.story = payload.variantId.includes('quiet') ? 'Quiet' : 'Primary';
            result = { completed: true, componentId: payload.componentId, variantId: payload.variantId };
          } else if (command === 'stage-component-variant') {
            document.documentElement.dataset.stagedVariant = payload.value;
            result = { staged: true, componentId: payload.componentId };
            publish();
          } else if (command === 'stage-token-promotion') {
            document.documentElement.dataset.stagedTokenPromotion = payload.candidateId;
            result = { staged: true, candidateId: payload.candidateId };
            publish();
          } else if (command === 'repair-component-variant-drift') {
            document.querySelector('button:last-of-type').dataset.story = payload.variantId.includes('quiet') ? 'Quiet' : 'Primary';
            result = { completed: true, componentId: payload.componentId, variantId: payload.variantId };
            publish();
          } else if (command === 'preview-component-state') {
            const target = document.querySelector('button:first-of-type');
            document.documentElement.dataset.lastWorkshopState = payload.stateId;
            if (payload.stateId === 'current') delete target.dataset.foundryState;
            else target.dataset.foundryState = payload.stateId;
            result = { previewed: true, stateId: payload.stateId };
            publish();
          } else if (command === 'set-responsive-edit-scope') {
            const activeBreakpoint = payload.breakpointId ?? 'current';
            result = { scope: payload.scope, activeBreakpoint, breakpoints: [activeBreakpoint], sourceMapped: true };
          } else if (command === 'preview-responsive-stress') {
            document.documentElement.dataset.foundryResponsiveStress = payload.mode;
            result = { previewed: payload.mode !== 'none', mode: payload.mode };
            publish();
          } else if (command === 'preview-responsive-container') {
            const main = document.querySelector('main'); main.style.inlineSize = payload.width ? payload.width + 'px' : ''; main.style.maxInlineSize = payload.width ? 'none' : '';
            result = { previewed: payload.width != null, width: payload.width ?? null };
            publish();
          } else if (command === 'audit-responsive') {
            if (payload.frameId === 'custom') throw new Error('Responsive audit timed out while waiting for stable layout');
            const button = document.querySelector('button');
            const rect = button.getBoundingClientRect();
            const reportedTop = payload.frameId === 'desktop' ? 160 : rect.top;
            result = { frame: { id: payload.frameId ?? 'current', viewportId: payload.viewportId ?? 'current', width: innerWidth, height: innerHeight, dpr: devicePixelRatio, href: location.href }, fonts: { ready: true, status: 'loaded' }, stableLayout: { stable: payload.frameId !== 'current', samples: 2, durationMs: 32 }, document: { scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }, elements: [{ selector: 'button', rect: { x: rect.x, y: reportedTop, top: reportedTop, width: rect.width, height: rect.height }, scrollWidth: button.scrollWidth, scrollHeight: button.scrollHeight, clientWidth: button.clientWidth, clientHeight: button.clientHeight, lineCount: 1 }], findings: [], summary: { scanned: 1, findings: 0, high: 0, medium: 0, low: 0 }, context: workspaceContext, auditedAt: new Date().toISOString() };
          } else if (command === 'replace-design-graph') {
            const graph = payload.graph ?? {};
            result = { replaced: true, revision: graph.revision, counts: { tokens: graph.tokens?.length ?? 0, components: graph.components?.length ?? 0, breakpoints: graph.breakpoints?.length ?? 0, themes: graph.themes?.length ?? 0, states: graph.states?.length ?? 0 } };
          } else if (command === 'apply-health-stress') {
            stressConditions = payload.conditions; stressScope = payload.scope; document.documentElement.dataset.foundryStress = stressConditions.join(' ');
            result = { applied: true, scope: stressScope, conditions: stressConditions };
            publish();
          } else if (command === 'clear-health-stress') {
            stressConditions = []; delete document.documentElement.dataset.foundryStress;
            result = { cleared: true };
            publish();
          } else if (command === 'scan-health' || command === 'preview-health-fix') {
            publish();
          } else if (command === 'apply-visual-recipe') {
            document.documentElement.dataset.foundryRecipe = payload.recipeId;
            result = { applied: true, recipeId: payload.recipeId };
            publish();
          } else if (command === 'save-design-decision') {
            document.documentElement.dataset.foundryDecision = payload.outcome;
            result = { saved: true };
            publish();
          } else if (command === 'motion-action') {
            document.documentElement.dataset.lastMotionAction = payload.action;
            result = { applied: true, action: payload.action, motionId: payload.id, currentTime: Number(payload.value ?? 0) };
          } else if (command === 'typography-action') {
            document.documentElement.dataset.lastTypographyAction = payload.action;
            result = { completed: true, action: payload.action };
          } else if (command === 'typography-compare') {
            const candidateFamily = String(payload.family || 'Foundry candidate')
              .replaceAll('"', '')
              .replaceAll(String.fromCharCode(92), '');
            result = {
              current: typographyMetrics('Inter, sans-serif'),
              candidate: typographyMetrics(candidateFamily),
              origin: payload.origin,
              context: workspaceContext,
              temporary: true,
              changeCountDelta: 0,
              fontResources: {
                cssText: '@font-face{font-family:"Inter";src:url("/fonts/inter.woff2") format("woff2");font-style:italic;font-weight:600}@font-face{font-family:"' + candidateFamily + '";src:url("/fonts/jetbrains-mono.woff2") format("woff2");font-style:italic;font-weight:600}',
                stylesheets: [],
                faces: [
                  { role: 'current', family: 'Inter', weight: '600', style: 'italic', size: '12px', text: 'Create workspace', renderable: true },
                  { role: 'candidate', family: candidateFamily, weight: '600', style: 'italic', size: '12px', text: 'Create workspace', renderable: true },
                ],
              },
            };
          } else if (command === 'typography-use-font') {
            result = payload.origin === 'local' ? { staged: false, previewOnly: true, changes: 0, reason: 'Local fonts cannot be mapped to portable project source' } : { staged: true, changes: 1, family: payload.family, origin: payload.origin };
            document.documentElement.dataset.typographyUseChanges = String(result.changes);
          } else if (command === 'switch-design-branch' || command === 'preview-design-branch') {
            result = { switched: true, persisted: command === 'switch-design-branch' };
          } else if (command === 'arm-agent-region' || command === 'capture-agent-region') {
            document.documentElement.dataset.agentRegionArmed = 'true';
            result = { armed: true };
          } else if (command === 'clear-agent-region') {
            result = { cleared: true };
          }
          if (command === 'set-responsive-edit-scope' && window.__holdResponsiveScope) {
            window.__releaseResponsiveScope = () => reply(event, result);
            return;
          }
          reply(event, result);
        } catch (error) {
          reply(event, null, error instanceof Error ? error.message : String(error));
        }
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
      { id: 'light', label: 'Light', attribute: 'data-theme', value: 'light' },
      { id: 'dark', label: 'Dark', attribute: 'data-theme', value: 'dark' },
    ],
    states: [
      {
        id: 'focus',
        label: 'Focus',
        pseudoStates: ['focus'],
        confidence: 'instrumented',
        evidence: ['Authored focus treatment'],
      },
      {
        id: 'disabled',
        label: 'Disabled',
        pseudoStates: ['disabled'],
        confidence: 'instrumented',
        evidence: ['Native disabled state'],
      },
    ],
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
  page.setDefaultTimeout(30_000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const url = new URL(`http://127.0.0.1:${runtimePort}`);
  // Preserve the legacy geometry regression suite alongside test:next.
  url.searchParams.set('ui', 'legacy');
  url.searchParams.set('session', sessionId);
  url.searchParams.set('token', session.token);
  url.searchParams.set('preview', `http://127.0.0.1:${previewPort}`);
  await page.goto(url.href, { waitUntil: 'networkidle' });
  await verifyInspectorFonts(page);
  const artifactDirectory = join(root, 'artifacts', 'e2e');
  await mkdir(artifactDirectory, { recursive: true });
  await verifyConnectionWorkflow(page, artifactDirectory);
  const settleBeforeScreenshot = async ({ waitForToasts = true } = {}) => {
    await page.mouse.move(Math.min(640, page.viewportSize()?.width ?? 640), 24);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    if (waitForToasts) {
      await page
        .waitForFunction(
          () =>
            [...document.querySelectorAll('.toast, [role="status"]')].every((element) => {
              if (!(element instanceof HTMLElement)) return true;
              const style = getComputedStyle(element);
              return (
                !element.classList.contains('is-visible') ||
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                Number(style.opacity) === 0
              );
            }),
          null,
          { timeout: 2_500 },
        )
        .catch(() => undefined);
    }
    await page.waitForTimeout(120);
  };
  const captureWorkspace = async (name, options = {}) => {
    await settleBeforeScreenshot(options);
    await page.screenshot({
      path: join(artifactDirectory, name),
      fullPage: false,
    });
  };
  const assertSearchFieldThemeSurface = async (selector) => {
    await page.waitForTimeout(160);
    const fields = page.locator(selector);
    const count = await fields.count();
    assert.ok(count > 0, `${selector} must expose a search field`);
    for (let index = 0; index < count; index += 1) {
      const geometry = await fields.nth(index).evaluate((field) => {
        const input = field.querySelector('input[type="search"]');
        const probe = document.createElement('span');
        probe.style.cssText =
          'position:fixed;pointer-events:none;background:var(--surface);color:var(--ink)';
        document.body.append(probe);
        const fieldStyle = getComputedStyle(field);
        const inputStyle = getComputedStyle(input);
        const probeStyle = getComputedStyle(probe);
        const fieldRect = field.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        const result = {
          fieldBackground: fieldStyle.backgroundColor,
          surfaceBackground: probeStyle.backgroundColor,
          inputBackground: inputStyle.backgroundColor,
          inputColor: inputStyle.color,
          inkColor: probeStyle.color,
          inputFits: inputRect.left >= fieldRect.left && inputRect.right <= fieldRect.right + 1,
        };
        probe.remove();
        return result;
      });
      assert.equal(
        geometry.fieldBackground,
        geometry.surfaceBackground,
        `${selector} must inherit the current theme surface`,
      );
      assert.ok(
        ['transparent', 'rgba(0, 0, 0, 0)'].includes(geometry.inputBackground),
        `${selector} input must not introduce a second surface`,
      );
      assert.equal(geometry.inputColor, geometry.inkColor, `${selector} text must use theme ink`);
      assert.equal(geometry.inputFits, true, `${selector} input must remain inside its field`);
    }
  };
  const assertFullWidthSelectValues = async (selector) => {
    const selects = page.locator(selector);
    const count = await selects.count();
    assert.ok(count > 0, `${selector} must expose a custom select`);
    for (let index = 0; index < count; index += 1) {
      const geometry = await selects.nth(index).evaluate((select) => {
        const wrapper = select.closest('.foundry-select');
        const value = select.querySelector('.foundry-select-value');
        const wrapperRect = wrapper.getBoundingClientRect();
        const selectRect = select.getBoundingClientRect();
        const valueRect = value.getBoundingClientRect();
        return {
          widthDelta: Math.abs(wrapperRect.width - selectRect.width),
          valueWidth: valueRect.width,
          valueClipped: value.scrollWidth > value.clientWidth + 1,
          valueFits: valueRect.left >= selectRect.left && valueRect.right <= selectRect.right + 1,
        };
      });
      assert.ok(geometry.widthDelta <= 1, `${selector} trigger must fill its field`);
      assert.ok(geometry.valueWidth >= 40, `${selector} value must receive the available width`);
      assert.equal(geometry.valueClipped, false, `${selector} value must not be clipped`);
      assert.equal(geometry.valueFits, true, `${selector} value must stay inside the trigger`);
    }
  };
  const assertNoInternalHorizontalOverflow = async (label, selectors) => {
    const overflow = await page.evaluate((queries) => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none';
      };
      return queries.flatMap((selector) =>
        [...document.querySelectorAll(selector)].filter(visible).map((element) => ({
          selector,
          overflow: Math.round((element.scrollWidth - element.clientWidth) * 100) / 100,
        })),
      );
    }, selectors);
    assert.ok(overflow.length > 0, `${label} must expose measurable workspace regions`);
    for (const result of overflow) {
      assert.ok(
        result.overflow <= 1,
        `${label} ${result.selector} must not overflow horizontally (${result.overflow}px)`,
      );
    }
  };
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
  const assertPersistentApplicationBar = async () => {
    const geometry = await page.evaluate(() => {
      const appBar = document.querySelector('.app-bar')?.getBoundingClientRect();
      const workspace = document.querySelector('.workspace')?.getBoundingClientRect();
      return {
        appBarHeight: appBar?.height ?? 0,
        appBarTop: appBar?.top ?? -1,
        appBarBottom: appBar?.bottom ?? -1,
        workspaceTop: workspace?.top ?? -1,
      };
    });
    assert.equal(geometry.appBarHeight, 48, 'every workspace must retain the 48px app bar');
    assert.equal(geometry.appBarTop, 0, 'the app bar must stay pinned to the top of the shell');
    assert.equal(
      geometry.workspaceTop,
      geometry.appBarBottom,
      'workspace content must begin directly below the app bar',
    );
  };
  const assertConnectedWorkspaceBrowser = async (selector) => {
    const geometry = await page.locator(selector).evaluate((element) => {
      const panel = element.getBoundingClientRect();
      const surface = element.closest('[data-mode-surface]');
      const header = surface?.querySelector(':scope > .mode-head');
      const canvasHeader = document.querySelector('.canvas-context');
      const surfaceRect = surface?.getBoundingClientRect();
      const headerRect = header?.getBoundingClientRect();
      const search = element.querySelector('input[type="search"]')?.getBoundingClientRect();
      return {
        leftDelta: surfaceRect ? Math.abs(panel.left - surfaceRect.left) : Number.POSITIVE_INFINITY,
        topDelta: headerRect ? Math.abs(panel.top - headerRect.bottom) : Number.POSITIVE_INFINITY,
        headerHeight: headerRect?.height ?? 0,
        canvasHeaderHeight: canvasHeader?.getBoundingClientRect().height ?? 0,
        borderRadius: getComputedStyle(element).borderRadius,
        overflowsHorizontally: element.scrollWidth > element.clientWidth + 1,
        searchFits: search ? search.left >= panel.left && search.right <= panel.right + 1 : true,
      };
    });
    assert.ok(geometry.leftDelta <= 1, `${selector} must align to the workspace edge`);
    assert.ok(geometry.topDelta <= 1, `${selector} must begin directly below the workspace header`);
    assert.equal(
      geometry.headerHeight,
      geometry.canvasHeaderHeight,
      `${selector} must match the Canvas header height`,
    );
    assert.equal(geometry.borderRadius, '0px', `${selector} must not render as an inset card`);
    assert.equal(
      geometry.overflowsHorizontally,
      false,
      `${selector} must not overflow horizontally`,
    );
    assert.equal(geometry.searchFits, true, `${selector} search must fit inside the panel`);
    await assertPersistentApplicationBar();
    await assertAccessibleWorkspaceSurface();
  };
  const assertCanvasFrameParity = async ({ surfaceSelector, shellSelector, regionSelectors }) => {
    const geometry = await page.locator(surfaceSelector).evaluate(
      (surface, { shellSelector: shellQuery, regionSelectors: regionQueries }) => {
        const header = surface.querySelector(':scope > .mode-head');
        const canvasHeader = document.querySelector('.canvas-context');
        const shell = surface.querySelector(shellQuery);
        const regions = regionQueries.map((query) => surface.querySelector(query));
        const regionGeometry = regions.map((region) => {
          const rect = region.getBoundingClientRect();
          const style = getComputedStyle(region);
          const directHeader = region.querySelector(':scope > header');
          const headerRect = directHeader?.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            borderLeft: Number.parseFloat(style.borderLeftWidth),
            borderRight: Number.parseFloat(style.borderRightWidth),
            borderRadius: style.borderRadius,
            headerTop: headerRect ? Math.round(headerRect.top) : null,
            headerBottom: headerRect ? Math.round(headerRect.bottom) : null,
          };
        });
        return {
          headerHeight: header.getBoundingClientRect().height,
          canvasHeaderHeight: canvasHeader.getBoundingClientRect().height,
          headerBorderBottom: Number.parseFloat(getComputedStyle(header).borderBottomWidth),
          shellBorderTop: Number.parseFloat(getComputedStyle(shell).borderTopWidth),
          regions: regionGeometry,
        };
      },
      { shellSelector, regionSelectors },
    );
    assert.equal(geometry.headerHeight, geometry.canvasHeaderHeight);
    assert.equal(geometry.headerBorderBottom, 1);
    assert.equal(geometry.shellBorderTop, 0);
    geometry.regions.forEach((region) => assert.equal(region.borderRadius, '0px'));
    assert.equal(
      new Set(geometry.regions.map((region) => region.top)).size,
      1,
      'workspace panes must share the same top boundary',
    );
    const paneHeaders = geometry.regions.filter((region) => region.headerTop !== null);
    if (paneHeaders.length > 1) {
      const headerTops = paneHeaders.map((region) => region.headerTop);
      const headerBottoms = paneHeaders.map((region) => region.headerBottom);
      assert.ok(
        Math.max(...headerTops) - Math.min(...headerTops) <= 1,
        `pane headers must share the same top boundary (${headerTops.join(', ')})`,
      );
      assert.ok(
        Math.max(...headerBottoms) - Math.min(...headerBottoms) <= 1,
        `pane header dividers must share the same baseline (${headerBottoms.join(', ')})`,
      );
    }
    for (let index = 0; index < geometry.regions.length - 1; index += 1) {
      const current = geometry.regions[index];
      const next = geometry.regions[index + 1];
      assert.equal(next.left - current.right, 0, 'workspace columns must connect without a gap');
      assert.equal(
        current.borderRight + next.borderLeft,
        1,
        'workspace columns must share exactly one divider',
      );
    }
  };
  const assertSharedRailSelection = async (mode) => {
    await page.waitForTimeout(160);
    const selection = await page.evaluate((activeMode) => {
      const active = [...document.querySelectorAll('.workspace-rail .rail-button.is-active')];
      const selected = active[0];
      const canvas = document.querySelector('.workspace-rail [data-workspace-mode="canvas"]');
      const selectedStyle = selected ? getComputedStyle(selected) : null;
      const canvasStyle = canvas ? getComputedStyle(canvas) : null;
      const probe = document.createElement('span');
      probe.style.color = 'var(--selection)';
      probe.style.borderColor = 'var(--selection-ink, var(--selection))';
      probe.style.backgroundColor = 'var(--selection-soft)';
      document.body.append(probe);
      const probeStyle = getComputedStyle(probe);
      const result = {
        activeCount: active.length,
        activeMode: selected?.dataset.workspaceMode,
        selection: probeStyle.color,
        selectionInk: probeStyle.borderColor,
        selectionSoft: probeStyle.backgroundColor,
        selectedColor: selectedStyle?.color,
        selectedBorderWidth: selectedStyle?.borderWidth,
        selectedBackground: selectedStyle?.backgroundColor,
        canvasColor: canvasStyle?.color,
      };
      probe.remove();
      return result;
    }, mode);
    assert.equal(selection.activeCount, 1, 'the rail must expose one active destination');
    assert.equal(selection.activeMode, mode);
    assert.equal(selection.selectedColor, selection.selectionInk);
    assert.equal(selection.selectedBorderWidth, '0px');
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
  await assertPersistentApplicationBar();

  await assertNoInternalHorizontalOverflow('Canvas at 1920px', [
    '[data-mode-surface="canvas"]',
    '#layers-dock',
    '.canvas-wrap',
    '#inspector-dock',
  ]);
  await captureWorkspace('canvas-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await captureWorkspace('canvas-dark.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });

  await page.locator('#canvas-theme').selectOption('dark');
  await page.frameLocator('#product-preview').locator('html[data-theme="dark"]').waitFor();
  assert.equal(
    await page
      .frameLocator('#product-preview')
      .locator('body')
      .evaluate((element) => getComputedStyle(element).backgroundColor),
    'rgb(17, 20, 17)',
    'Canvas theme must change the rendered product, not only inspector metadata',
  );
  await page.locator('#canvas-state').selectOption('focus');
  await page
    .frameLocator('#product-preview')
    .locator('button:first-of-type[data-foundry-state="focus"]')
    .waitFor();
  assert.equal(
    await page
      .frameLocator('#product-preview')
      .locator('button:first-of-type')
      .evaluate((element) => getComputedStyle(element).outlineWidth),
    '4px',
    'Canvas state must apply the authored focus treatment to the selected target',
  );
  await page.locator('#canvas-state').selectOption('current');
  await page
    .frameLocator('#product-preview')
    .locator('button:first-of-type:not([data-foundry-state])')
    .waitFor();
  await page.locator('#canvas-theme').selectOption('current');
  await page.frameLocator('#product-preview').locator('html:not([data-theme])').waitFor();

  await page.locator('.workspace-rail [data-workspace-mode="states"]').click();
  await page.getByRole('heading', { name: 'State Workbench' }).waitFor();
  await assertSharedRailSelection('states');
  await assertConnectedWorkspaceBrowser('.state-matrix-panel', { matchesCanvasHeader: true });
  await assertCanvasFrameParity({
    surfaceSelector: '[data-mode-surface="states"]',
    shellSelector: '.workbench-grid',
    regionSelectors: ['.state-matrix-panel', '.state-preview-panel', '.state-verification-panel'],
  });
  await assertFullWidthSelectValues('.state-matrix-panel .foundry-select-trigger');
  await page.waitForFunction(
    () => document.querySelector('#state-verification-connection')?.textContent === 'Live',
  );
  await page.locator('[data-state-matrix-state="focus"]').click();
  await page
    .frameLocator('#state-live-preview')
    .locator('button:first-of-type[data-foundry-state="focus"]')
    .waitFor();
  await page.waitForFunction(() =>
    document.querySelector('#state-verification-title')?.textContent?.includes('Measured'),
  );
  assert.match(await page.locator('#state-verification-count').textContent(), /^[1-3] \/ 3$/);
  assert.match(
    (await page.locator('#state-verification-note').textContent()) ?? '',
    /root-attribute|authored-state/,
  );
  await assertNoInternalHorizontalOverflow('State Workbench at 1920px', [
    '[data-mode-surface="states"]',
    '.state-matrix-panel',
    '.state-preview-panel',
    '.state-verification-panel',
  ]);
  await captureWorkspace('state-workbench-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await assertFullWidthSelectValues('.state-matrix-panel .foundry-select-trigger');
  await captureWorkspace('state-workbench-dark.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.locator('.workspace-rail [data-workspace-mode="canvas"]').click();

  await page.locator('#workspace-menu-trigger').click();
  await page.locator('#workspace-menu [data-workspace-mode="components"]').click();
  await page.getByRole('heading', { name: 'Component workshop' }).waitFor();
  await assertConnectedWorkspaceBrowser('.component-workshop-browser', {
    matchesCanvasHeader: true,
  });
  await assertCanvasFrameParity({
    surfaceSelector: '.component-workshop-mode',
    shellSelector: '.component-workshop-shell',
    regionSelectors: [
      '.component-workshop-browser',
      '.component-workshop-detail',
      '.component-workshop-contract',
    ],
  });
  await page.getByRole('heading', { name: 'PrimaryAction' }).waitFor();
  assert.equal(await page.locator('.workshop-instance-row').count(), 2);
  assert.equal(await page.locator('.workshop-variant-row').count(), 2);
  const visibleWorkshopStates = await page
    .locator('[data-workshop-state]')
    .evaluateAll((buttons) => buttons.map((button) => button.dataset.workshopState));
  assert.deepEqual(
    visibleWorkshopStates,
    ['current', 'focus', 'disabled'],
    'Component Workshop must expose Current plus only the sparse authored state graph',
  );
  for (const stateId of visibleWorkshopStates) {
    await page.locator(`[data-workshop-state="${stateId}"]`).click();
    await page
      .frameLocator('#product-preview')
      .locator(`html[data-last-workshop-state="${stateId}"]`)
      .waitFor();
    assert.equal(
      await page.locator('[data-workshop-state].is-active').getAttribute('data-workshop-state'),
      stateId,
      `Visible workshop state ${stateId} must become active only after acknowledgement`,
    );
  }
  await page.locator('[data-workshop-state="current"]').click();
  await page.locator('[data-workshop-state="current"].is-active').waitFor();
  await page
    .frameLocator('#product-preview')
    .locator('button:first-of-type:not([data-foundry-state])')
    .waitFor();
  assert.equal(
    await page
      .frameLocator('#product-preview')
      .locator('button:first-of-type')
      .getAttribute('data-foundry-state'),
    null,
    'Current must acknowledge and restore the rendered source state',
  );
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
  await assertSearchFieldThemeSurface('.component-workshop-browser > .search-field');
  await assertNoInternalHorizontalOverflow('Component Workshop at 1920px', [
    '.component-workshop-mode',
    '.component-workshop-browser',
    '.component-workshop-detail',
    '.component-workshop-contract',
  ]);
  await page.locator('.workshop-variant-row').filter({ hasText: 'Primary' }).click();
  await page.locator('.workshop-drift[data-drift-count="1"]').waitFor();
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

  await captureWorkspace('component-workshop-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await assertSearchFieldThemeSurface('.component-workshop-browser > .search-field');
  await captureWorkspace('component-workshop-dark.png');
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
  await assertNoInternalHorizontalOverflow('Component Workshop at 1280px', [
    '.component-workshop-mode',
    '.component-workshop-browser',
    '.component-workshop-detail',
    '.component-workshop-contract',
  ]);
  await captureWorkspace('component-workshop-compact-light.png');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.workspace-rail [data-workspace-mode="memory"]').click();
  await page.getByRole('heading', { name: 'Design Memory' }).waitFor();
  await assertConnectedWorkspaceBrowser('.decision-memory-browser', { matchesCanvasHeader: true });
  await assertCanvasFrameParity({
    surfaceSelector: '.decision-memory-mode',
    shellSelector: '.decision-memory-shell',
    regionSelectors: [
      '.decision-memory-browser',
      '.decision-memory-stage',
      '.decision-memory-capture',
    ],
  });
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
  await assertSearchFieldThemeSurface('.decision-memory-browser > .search-field');
  await assertNoInternalHorizontalOverflow('Design Memory at 1920px', [
    '.decision-memory-mode',
    '.decision-memory-browser',
    '.decision-memory-stage',
    '.decision-memory-capture',
  ]);
  await captureWorkspace('design-decision-memory-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await assertSearchFieldThemeSurface('.decision-memory-browser > .search-field');
  await captureWorkspace('design-decision-memory-dark.png');
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
  await assertSearchFieldThemeSurface('.visual-recipe-browser > .search-field');
  await assertNoInternalHorizontalOverflow('Visual Recipes at 1920px', [
    '.visual-recipes-mode',
    '.visual-recipe-browser',
    '.visual-recipe-stage',
    '.visual-recipe-create',
  ]);
  await page.getByRole('button', { name: 'Add mapped values to Review' }).click();
  await page
    .frameLocator('#product-preview')
    .locator('html[data-foundry-recipe="recipe-focus"]')
    .waitFor();
  assert.equal(
    await page.frameLocator('#product-preview').locator('html').getAttribute('data-foundry-recipe'),
    'recipe-focus',
  );
  await captureWorkspace('visual-recipes-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await assertSearchFieldThemeSurface('.visual-recipe-browser > .search-field');
  await captureWorkspace('visual-recipes-dark.png');
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
  await assertNoInternalHorizontalOverflow('Visual Recipes at 1280px', [
    '.visual-recipes-mode',
    '.visual-recipe-browser',
    '.visual-recipe-stage',
    '.visual-recipe-create',
  ]);
  await captureWorkspace('visual-recipes-compact-light.png');
  await page.setViewportSize({ width: 1920, height: 1080 });
  const agentPresenceResponse = await fetch(
    `http://127.0.0.1:${runtimePort}/v1/sessions/${sessionId}/agent-presence`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({
        agent: { name: 'codex', taskId: 'workspace-e2e' },
        listening: true,
        ttlMs: 70_000,
      }),
    },
  );
  assert.equal(agentPresenceResponse.ok, true);
  await page.locator('.workspace-rail [data-workspace-mode="agent"]').click();
  await page.getByRole('heading', { name: 'Visual agent' }).waitFor();
  await assertConnectedWorkspaceBrowser('.visual-agent-threads');
  assert.match(
    (await page.locator('#visual-agent-context').textContent()) ?? '',
    /Create workspace/,
  );
  assert.match((await page.locator('#visual-agent-context').textContent()) ?? '', /100 × 40/);
  await page.getByRole('button', { name: 'Ask visual agent' }).waitFor();
  await page.locator('#visual-agent-comment').fill('The primary action feels detached.');
  await page
    .locator('#visual-agent-prompt')
    .fill('Why does this action feel inconsistent? Give me one exact source-safe direction.');
  await page.getByRole('button', { name: 'Ask visual agent' }).click();
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
  assert.equal(await page.getByRole('button', { name: 'Move to Review' }).isEnabled(), false);
  await page.getByRole('button', { name: 'Preview direction' }).click();
  await page.waitForFunction(
    () => document.querySelector('.visual-agent-proposal')?.dataset.status === 'previewing',
  );
  await page.getByRole('button', { name: 'Back to conversation', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Move to Review' }).isEnabled(), true);
  const previewedAgentSession = await store.read(sessionId);
  const previewedAgentRequest = previewedAgentSession.visualAgentRequests.find(
    (request) => request.id === visualRequestId,
  );
  assert.ok(
    previewedAgentRequest?.proposals[0]?.branchId,
    'Preview direction must persist its branch before reporting success',
  );
  assert.equal(previewedAgentRequest?.proposals[0]?.status, 'previewing');
  assert.equal(
    previewedAgentSession.activeDesignBranchId,
    previewedAgentRequest?.proposals[0]?.branchId,
  );
  const restoreMainDirection = await fetch(
    `http://127.0.0.1:${runtimePort}/v1/sessions/${sessionId}/design-branches/activate`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: '{}',
    },
  );
  assert.equal(restoreMainDirection.ok, true);
  await page.waitForFunction(
    () => document.querySelector('#change-count')?.textContent === '1 change · Main direction',
  );
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
  await assertNoInternalHorizontalOverflow('Visual Agent at 1920px', [
    '.visual-agent-mode',
    '.visual-agent-threads',
    '.visual-agent-conversation',
    '.visual-agent-compose',
  ]);
  await captureWorkspace('visual-agent-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await captureWorkspace('visual-agent-dark.png');
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
  await assertNoInternalHorizontalOverflow('Visual Agent at 1280px', [
    '.visual-agent-mode',
    '.visual-agent-threads',
    '.visual-agent-conversation',
    '.visual-agent-compose',
  ]);
  await captureWorkspace('visual-agent-compact-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await captureWorkspace('visual-agent-compact-dark.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.getByRole('button', { name: 'Draw region' }).click();
  await page.locator('[data-mode-surface="canvas"]:not([hidden])').waitFor();
  await page
    .frameLocator('#product-preview')
    .locator('html[data-agent-region-armed="true"]')
    .waitFor();
  await page.locator('.workspace-rail [data-workspace-mode="agent"]').click();
  await page.getByRole('heading', { name: 'Visual agent' }).waitFor();
  const offlinePresenceResponse = await fetch(
    `http://127.0.0.1:${runtimePort}/v1/sessions/${sessionId}/agent-presence`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({ agent: { name: 'codex' }, listening: false }),
    },
  );
  assert.equal(offlinePresenceResponse.ok, true);
  await page.getByRole('button', { name: 'Queue for agent' }).waitFor({ timeout: 5000 });
  await page.locator('#visual-agent-prompt').fill('Check this direction when you reconnect.');
  await page.getByRole('button', { name: 'Queue for agent' }).click();
  await page.waitForFunction(() =>
    document.querySelector('.visual-agent-thinking.is-queued')?.textContent?.includes('Waiting'),
  );
  const queuedAgentSession = await store.read(sessionId);
  assert.equal(queuedAgentSession.visualAgentRequests.at(-1)?.status, 'queued');
  const restoredPresenceResponse = await fetch(
    `http://127.0.0.1:${runtimePort}/v1/sessions/${sessionId}/agent-presence`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({
        agent: { name: 'codex', taskId: 'workspace-e2e' },
        listening: true,
        ttlMs: 70_000,
      }),
    },
  );
  assert.equal(restoredPresenceResponse.ok, true);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.workspace-rail [data-workspace-mode="system"]').click();
  await page.getByRole('heading', { name: 'Design System', exact: true }).waitFor();
  await assertConnectedWorkspaceBrowser('.design-system-browser');
  assert.match((await page.locator('#design-system-status').textContent()) ?? '', /1 token/);
  assert.match((await page.locator('#design-system-status').textContent()) ?? '', /1 promotion/);
  assert.equal(await page.locator('.design-token-row').count(), 1);
  await page.locator('.design-token-row').waitFor({ state: 'visible' });
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
  assert.match(
    (await page.locator('#design-system-detail').textContent()) ?? '',
    /Indexed alias chain/,
  );
  await page.locator('#design-system-reindex').click();
  await page.waitForFunction(() =>
    document.querySelector('#design-system-status')?.textContent?.includes('2 tokens'),
  );
  assert.equal(reindexCount, 1, 'Design System refresh must invoke the real re-index callback');
  assert.equal(await page.locator('.design-token-row').count(), 2);
  assert.match(
    (await page.locator('#design-system-token-list').textContent()) ?? '',
    /--space-panel/,
  );
  const reindexedSession = await store.read(sessionId);
  const reindexedRevision = reindexedSession.designGraph.revision;
  const staleReindexResponse = await fetch(
    `http://127.0.0.1:${runtimePort}/v1/sessions/${sessionId}/design-graph/reindex`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': session.token,
      },
      body: JSON.stringify({ expectedDesignGraphRevision: 'stale-workspace-index' }),
    },
  );
  assert.equal(staleReindexResponse.status, 409);
  assert.equal(
    (await store.read(sessionId)).designGraph.revision,
    reindexedRevision,
    'A failed re-index must preserve the last authoritative graph',
  );
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
  await assertSearchFieldThemeSurface('.design-system-browser > .search-field');
  await assertNoInternalHorizontalOverflow('Design System at 1920px', [
    '.design-system-mode',
    '.design-system-browser',
    '.design-system-detail',
  ]);
  await captureWorkspace('design-system-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await assertSearchFieldThemeSurface('.design-system-browser > .search-field');
  await captureWorkspace('design-system-dark.png');
  await page.setViewportSize({ width: 1280, height: 800 });
  await assertNoInternalHorizontalOverflow('Design System at 1280px', [
    '.design-system-mode',
    '.design-system-browser',
    '.design-system-detail',
  ]);
  await captureWorkspace('design-system-compact-dark.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await assertSearchFieldThemeSurface('.design-system-browser > .search-field');
  await captureWorkspace('design-system-compact-light.png');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
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
  await page
    .frameLocator('[data-responsive-frame="mobile"]')
    .locator('html[data-foundry-viewport="mobile"][data-foundry-motion="system"]')
    .waitFor();
  await page
    .frameLocator('[data-responsive-frame="desktop"]')
    .locator('html[data-foundry-viewport="desktop"][data-foundry-motion="system"]')
    .waitFor();
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
  await page.getByRole('button', { name: 'Run responsive audit' }).click();
  await page.waitForFunction(() =>
    document
      .querySelector('#responsive-lab-status')
      ?.textContent?.includes('2 of 4 frames measured'),
  );
  assert.match(
    (await page.locator('#responsive-lab-status').textContent()) ?? '',
    /2 of 4 frames measured · [1-9]\d* findings · 2 incomplete/,
  );
  assert.equal(
    await page
      .locator('.responsive-viewport-card footer')
      .filter({ hasText: 'Audit passed' })
      .count(),
    2,
  );
  assert.equal(
    await page
      .locator('.responsive-viewport-card footer')
      .filter({ hasText: 'layout did not stabilize' })
      .count(),
    1,
  );
  assert.equal(
    await page
      .locator('.responsive-viewport-card footer')
      .filter({ hasText: 'Audit timed out' })
      .count(),
    1,
  );
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
  await assertNoInternalHorizontalOverflow('Responsive Design Lab at 1920px', [
    '.responsive-lab-mode',
    '.responsive-lab-controls',
    '.responsive-boundaries',
    '.responsive-comparison',
    '.responsive-viewport-grid',
  ]);
  await captureWorkspace('responsive-design-lab-dark.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await captureWorkspace('responsive-design-lab-light.png');
  await page.setViewportSize({ width: 1280, height: 800 });
  await assertNoInternalHorizontalOverflow('Responsive Design Lab at 1280px', [
    '.responsive-lab-mode',
    '.responsive-lab-controls',
    '.responsive-boundaries',
    '.responsive-comparison',
    '.responsive-viewport-grid',
  ]);
  await captureWorkspace('responsive-design-lab-compact-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await captureWorkspace('responsive-design-lab-compact-dark.png');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.locator('[data-responsive-open="mobile"]').click();
  await page.locator('[data-responsive-scope="all"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-responsive-scope="all"]')?.getAttribute('aria-pressed') ===
      'true',
  );
  // Hold a frame synchronization acknowledgement across navigation. A stale sync
  // must not reapply its container width after the exit cleanup has completed.
  const customResponsiveFrame = page.frameLocator('[data-responsive-frame="custom"]');
  await customResponsiveFrame.locator('html').evaluate(() => {
    window.__holdResponsiveScope = true;
  });
  await page.locator('[data-responsive-frame="custom"]').evaluate((frame, sessionId) => {
    frame.dataset.responsiveNeedsSync = 'true';
    frame.contentWindow.postMessage(
      { type: 'foundry:workspace-command', sessionId, command: 'request-state' },
      new URL(frame.src).origin,
    );
  }, sessionId);
  await expect
    .poll(() =>
      customResponsiveFrame.locator('html').evaluate(() => typeof window.__releaseResponsiveScope),
    )
    .toBe('function');
  await page.locator('#responsive-open-canvas').click();
  await page.locator('[data-mode-surface="canvas"]:not([hidden])').waitFor();
  await page.locator('#canvas-responsive-scope:not([hidden])').waitFor();
  assert.equal(
    await page.locator('#canvas-responsive-scope').textContent(),
    'Scope: all breakpoints',
  );
  assert.equal(await page.locator('#canvas-viewport').inputValue(), 'mobile');
  await page.locator('.workspace-rail [data-workspace-mode="health"]').click();
  await page.getByRole('heading', { name: 'Content Stress Lab' }).waitFor();
  await assertConnectedWorkspaceBrowser('.stress-lab-browser', { matchesCanvasHeader: true });
  await assertCanvasFrameParity({
    surfaceSelector: '.stress-lab-mode',
    shellSelector: '.stress-lab-shell',
    regionSelectors: ['.stress-lab-browser', '.stress-result-toolbar', '.stress-summary-grid'],
  });
  await expect
    .poll(
      () =>
        page
          .frameLocator('[data-responsive-frame="custom"]')
          .locator('main')
          .evaluate((element) => element.style.inlineSize),
      { timeout: 10_000, message: 'Leaving Responsive must clear its temporary container width' },
    )
    .toBe('');
  await customResponsiveFrame.locator('html').evaluate(() => {
    window.__holdResponsiveScope = false;
    window.__releaseResponsiveScope();
  });
  // Give the released acknowledgement and any incorrectly continued commands
  // time to cross the frame boundary before checking the restored state again.
  await page.waitForTimeout(300);
  assert.equal(
    await customResponsiveFrame.locator('main').evaluate((element) => element.style.inlineSize),
    '',
    'A late responsive sync must not reapply temporary width after navigation',
  );
  assert.equal(await page.locator('.stress-profile').count(), 3);
  const stressScopeGeometry = await page.evaluate(() => {
    const scope = document.querySelector('.stress-scope');
    const structureTabs = document.querySelector('.layers-dock .segmented');
    const firstProfile = document.querySelector('.stress-profile');
    if (
      !(scope instanceof HTMLElement) ||
      !(structureTabs instanceof HTMLElement) ||
      !(firstProfile instanceof HTMLElement)
    )
      return null;
    const scopeRect = scope.getBoundingClientRect();
    const profileRect = firstProfile.getBoundingClientRect();
    const scopeStyle = getComputedStyle(scope);
    const structureStyle = getComputedStyle(structureTabs);
    return {
      height: scopeRect.height,
      scopeBottom: scopeRect.bottom,
      profileTop: profileRect.top,
      columns: scopeStyle.gridTemplateColumns.split(' ').length,
      referenceHeight: structureTabs.getBoundingClientRect().height,
      padding: scopeStyle.padding,
      referencePadding: structureStyle.padding,
      background: scopeStyle.backgroundColor,
      referenceBackground: structureStyle.backgroundColor,
    };
  });
  assert.ok(stressScopeGeometry, 'stress scope and profile geometry must be measurable');
  assert.equal(stressScopeGeometry.height, stressScopeGeometry.referenceHeight);
  assert.equal(stressScopeGeometry.padding, stressScopeGeometry.referencePadding);
  assert.equal(stressScopeGeometry.background, stressScopeGeometry.referenceBackground);
  assert.equal(stressScopeGeometry.columns, 2);
  assert.ok(
    stressScopeGeometry.profileTop >= stressScopeGeometry.scopeBottom,
    'stress scope must not overlap the content rows below it',
  );
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
  await assertNoInternalHorizontalOverflow('Content Stress Lab at 1920px', [
    '.stress-lab-mode',
    '.stress-lab-browser',
    '.stress-result-toolbar',
    '.stress-summary-grid',
  ]);
  await captureWorkspace('content-accessibility-lab-light.png');
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
  await captureWorkspace('content-accessibility-lab-dark.png');
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
  assert.equal(
    await page.locator('#motion-studio-properties').evaluate((element) => element.scrollTop),
    0,
    'Motion properties must open at the beginning of the editing flow',
  );
  assert.equal(await page.locator('.motion-studio-row').count(), 1);
  assert.equal(await page.locator('.motion-studio-track').count(), 2);
  assert.equal(await page.locator('.motion-curve-editor').count(), 1);
  assert.equal(await page.locator('[data-curve-handle]').count(), 2);
  assert.equal(await page.locator('.motion-path-editor').count(), 1);
  assert.equal(await page.locator('[data-path-point]').count(), 2);
  assert.equal(await page.locator('.motion-path-graph svg').getAttribute('role'), 'group');
  assert.equal(await page.locator('.motion-curve-graph svg').getAttribute('role'), 'group');
  for (const handle of await page.locator('[data-curve-handle], [data-path-point]').all()) {
    assert.notEqual(await handle.getAttribute('aria-valuenow'), null);
  }
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
  await assertNoInternalHorizontalOverflow('Motion Studio at 1920px', [
    '.motion-studio-mode',
    '.motion-studio-browser',
    '.motion-studio-stage',
    '.motion-studio-properties',
  ]);
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
  await captureWorkspace('motion-studio-light.png', { waitForToasts: false });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await captureWorkspace('motion-studio-dark.png', { waitForToasts: false });
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
  await assertNoInternalHorizontalOverflow('Motion Studio at 1280px', [
    '.motion-studio-mode',
    '.motion-studio-browser',
    '.motion-studio-stage',
    '.motion-studio-properties',
  ]);
  await captureWorkspace('motion-studio-compact-light.png', { waitForToasts: false });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await captureWorkspace('motion-studio-compact-dark.png', { waitForToasts: false });
  await page.setViewportSize({ width: 1920, height: 1080 });
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
  const typographyChangeCountBefore = await page.locator('#change-count').textContent();
  await page.locator('.typography-font-row').filter({ hasText: 'Foundry JetBrains Mono' }).click();
  await page.waitForFunction(() => {
    const text = document.querySelector('.typography-comparison-card.is-candidate')?.textContent;
    return text?.includes('loaded') && text.includes('100 × 40');
  });
  assert.equal(
    await page.locator('#change-count').textContent(),
    typographyChangeCountBefore,
    'Comparing a candidate font must not create a design change',
  );
  assert.equal(await page.locator('.typography-comparison-card').count(), 2);
  assert.match(
    (await page.locator('.typography-comparison-card.is-candidate').textContent()) ?? '',
    /Candidate.*Foundry JetBrains Mono.*loaded.*1.*100 × 40.*Clear/s,
  );
  const sourceSpecimen = await page
    .frameLocator('#product-preview')
    .locator('button:first-of-type')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        text: element.textContent,
        width: rect.width,
        height: rect.height,
        boxSizing: style.boxSizing,
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        borderTopWidth: style.borderTopWidth,
        borderRightWidth: style.borderRightWidth,
        borderBottomWidth: style.borderBottomWidth,
        borderLeftWidth: style.borderLeftWidth,
        borderTopStyle: style.borderTopStyle,
        borderRightStyle: style.borderRightStyle,
        borderBottomStyle: style.borderBottomStyle,
        borderLeftStyle: style.borderLeftStyle,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        fontVariationSettings: style.fontVariationSettings,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        whiteSpace: style.whiteSpace,
        overflowWrap: style.overflowWrap,
        wordBreak: style.wordBreak,
        textAlign: style.textAlign,
        textTransform: style.textTransform,
        textIndent: style.textIndent,
        direction: style.direction,
        writingMode: style.writingMode,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
      };
    });
  const renderedSpecimens = await page
    .locator('.typography-comparison-specimen')
    .evaluateAll((specimens) =>
      specimens.map((specimen) => {
        const style = getComputedStyle(specimen);
        const rect = specimen.getBoundingClientRect();
        return {
          contract: specimen.dataset.specimenContract,
          text: specimen.textContent,
          width: rect.width,
          height: rect.height,
          family: style.fontFamily,
          boxSizing: style.boxSizing,
          paddingTop: style.paddingTop,
          paddingRight: style.paddingRight,
          paddingBottom: style.paddingBottom,
          paddingLeft: style.paddingLeft,
          borderTopWidth: style.borderTopWidth,
          borderRightWidth: style.borderRightWidth,
          borderBottomWidth: style.borderBottomWidth,
          borderLeftWidth: style.borderLeftWidth,
          borderTopStyle: style.borderTopStyle,
          borderRightStyle: style.borderRightStyle,
          borderBottomStyle: style.borderBottomStyle,
          borderLeftStyle: style.borderLeftStyle,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          fontVariationSettings: style.fontVariationSettings,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          whiteSpace: style.whiteSpace,
          overflowWrap: style.overflowWrap,
          wordBreak: style.wordBreak,
          textAlign: style.textAlign,
          textTransform: style.textTransform,
          textIndent: style.textIndent,
          direction: style.direction,
          writingMode: style.writingMode,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
        };
      }),
    );
  assert.equal(renderedSpecimens.length, 2);
  for (const { contract, family: _family, ...specimen } of renderedSpecimens) {
    assert.equal(contract, '1', 'Both comparison cards must use the versioned specimen contract');
    assert.deepEqual(
      specimen,
      sourceSpecimen,
      'Current and Candidate must preserve the selected copy, geometry, type settings, and wrapping',
    );
  }
  assert.notEqual(
    renderedSpecimens[0].family,
    renderedSpecimens[1].family,
    'Current and Candidate cards must render with their independently transferred faces',
  );
  assert.ok(await page.locator('#typography-use-candidate').isEnabled());
  await page.locator('#typography-use-candidate').click();
  await page
    .frameLocator('#product-preview')
    .locator('html[data-typography-use-changes="1"]')
    .waitFor();
  const typographyGeometry = await page.locator('.typography-studio-mode').evaluate((surface) => {
    const shell = surface.querySelector('.typography-studio-shell');
    const browserPanel = surface.querySelector('.typography-studio-browser');
    const stage = surface.querySelector('.typography-studio-stage');
    const properties = surface.querySelector('.typography-studio-properties');
    const comparison = surface.querySelector('.typography-comparison');
    const specimenStages = [...surface.querySelectorAll('.typography-comparison-specimen-stage')];
    const comparisonCards = [...surface.querySelectorAll('.typography-comparison-card')];
    const selectionSummary = surface.querySelector('.typography-selection-summary');
    const selectionLabel = selectionSummary.querySelector('strong');
    const sectionCards = [
      ...surface.querySelectorAll(
        '.typography-comparison, .typography-treatment-panel, .typography-usage-panel, .typography-rendered-section, .typography-audit, .typography-google-review, .typography-saved-styles',
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
      comparisonRadius: getComputedStyle(comparison).borderRadius,
      comparisonHeight: Math.round(comparison.getBoundingClientRect().height),
      specimenAlignments: specimenStages.map((item) => ({
        align: getComputedStyle(item).alignItems,
        justify: getComputedStyle(item).justifyItems,
      })),
      comparisonCardSizes: comparisonCards.map((card) => ({
        width: Math.round(card.getBoundingClientRect().width),
        height: Math.round(card.getBoundingClientRect().height),
      })),
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
  assert.equal(typographyGeometry.comparisonRadius, '0px');
  assert.ok(typographyGeometry.comparisonHeight >= 304);
  assert.deepEqual(
    typographyGeometry.comparisonCardSizes[0],
    typographyGeometry.comparisonCardSizes[1],
    'Current and Candidate specimens must use identical geometry',
  );
  assert.ok(
    typographyGeometry.specimenAlignments.every(
      ({ align, justify }) => align === 'center' && justify === 'center',
    ),
  );
  assert.ok(typographyGeometry.sectionRadii.every((radius) => radius === '0px'));
  await assertSearchFieldThemeSurface('.typography-studio-browser > .search-field');
  await assertNoInternalHorizontalOverflow('Typography Studio at 1920px', [
    '.typography-studio-mode',
    '.typography-studio-browser',
    '.typography-studio-stage',
    '.typography-studio-properties',
  ]);
  assert.match(
    (await page.locator('#typography-studio-properties').textContent()) ?? '',
    /Rendered type is stable/,
  );
  await page.locator('[data-treatment-id="balanced"]').click();
  await captureWorkspace('typography-studio-dark.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await assertSearchFieldThemeSurface('.typography-studio-browser > .search-field');
  await captureWorkspace('typography-studio-light.png');
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
        comparisonHeight: Math.round(
          surface.querySelector('.typography-comparison').getBoundingClientRect().height,
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
  assert.ok(compactTypographyGeometry.comparisonHeight >= 304);
  assert.equal(compactTypographyGeometry.treatmentColumns, 3);
  await assertNoInternalHorizontalOverflow('Typography Studio at 1280px', [
    '.typography-studio-mode',
    '.typography-studio-browser',
    '.typography-studio-stage',
    '.typography-studio-properties',
  ]);
  await captureWorkspace('typography-studio-compact-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await captureWorkspace('typography-studio-compact-dark.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.workspace-rail [data-workspace-mode="branches"]').click();
  await page.getByRole('heading', { name: 'Design branches' }).waitFor();
  await assertConnectedWorkspaceBrowser('.design-branch-browser');
  assert.equal(await page.locator('.design-branch-row').count(), 3);
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
  assert.equal(await page.locator('.design-branch-row').count(), 4);
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
  await assertNoInternalHorizontalOverflow('Design Branches at 1920px', [
    '.design-branches-mode',
    '.design-branch-browser',
    '.design-branch-stage',
    '.design-branch-detail',
  ]);
  await captureWorkspace('design-branches-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await captureWorkspace('design-branches-dark.png');
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
  await assertNoInternalHorizontalOverflow('Design Branches at 1280px', [
    '.design-branches-mode',
    '.design-branch-browser',
    '.design-branch-stage',
    '.design-branch-detail',
  ]);
  await captureWorkspace('design-branches-compact-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await captureWorkspace('design-branches-compact-dark.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
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

  await captureWorkspace('review-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await captureWorkspace('review-dark.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  const compactReviewGeometry = await page.locator('.review-workspace').evaluate((workspace) => ({
    columns: getComputedStyle(workspace).gridTemplateColumns.split(' ').length,
    overflow: workspace.scrollWidth - workspace.clientWidth,
  }));
  assert.equal(compactReviewGeometry.columns, 1, 'compact Review must collapse to one column');
  assert.ok(compactReviewGeometry.overflow <= 1, 'compact Review must not clip controls');
  await assertNoInternalHorizontalOverflow('Review at 1024px', [
    '[data-mode-surface="review"]',
    '.review-workspace',
    '.review-list',
    '.review-summary',
  ]);
  await captureWorkspace('review-compact-light.png');
  await page.setViewportSize({ width: 1920, height: 1080 });

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
  await captureWorkspace('apply-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await captureWorkspace('apply-dark.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  const compactApplyGeometry = await page.locator('.apply-workspace').evaluate((workspace) => ({
    columns: getComputedStyle(workspace).gridTemplateColumns.split(' ').length,
    overflow: workspace.scrollWidth - workspace.clientWidth,
  }));
  assert.equal(compactApplyGeometry.columns, 1, 'compact Apply must collapse to one column');
  assert.ok(compactApplyGeometry.overflow <= 1, 'compact Apply must not clip controls');
  await assertNoInternalHorizontalOverflow('Apply at 1024px', [
    '#apply-run',
    '.apply-workspace',
    '.apply-status-group',
    '.apply-evidence',
  ]);
  await captureWorkspace('apply-compact-light.png');
  await page.setViewportSize({ width: 1920, height: 1080 });
  let deliverySession = await store.read(sessionId);
  const deliveryRun = deliverySession.applyRuns.at(-1);
  const baselineSourceHash = 'a'.repeat(64);
  const appliedSourceHash = 'b'.repeat(64);
  const baselineSourceProof = {
    scope: 'mapped-files',
    revision: deliverySession.changeSet.context.revision,
    files: [
      {
        path: 'PrimaryAction.tsx',
        exists: true,
        sha256: baselineSourceHash,
        lineAnchors: [{ line: 1, sha256: baselineSourceHash }],
      },
    ],
  };
  const appliedSourceProof = {
    ...baselineSourceProof,
    revision: `${baselineSourceProof.revision}-applied`,
    files: [
      {
        path: 'PrimaryAction.tsx',
        exists: true,
        sha256: appliedSourceHash,
        lineAnchors: [{ line: 1, sha256: appliedSourceHash }],
      },
    ],
  };
  deliverySession = await store.claimApplyRun(sessionId, deliveryRun.id, {
    agent: { name: 'codex', version: 'e2e' },
    revision: deliverySession.changeSet.context.revision,
    designGraphRevision: deliverySession.designGraph.revision,
    sourceProof: baselineSourceProof,
  });
  const claimedDeliveryRun = deliverySession.applyRuns.at(-1);
  assert.equal(claimedDeliveryRun.state, 'claimed');
  assert.equal(claimedDeliveryRun.revision, deliveryRun.revision);
  assert.equal(claimedDeliveryRun.designGraphRevision, deliveryRun.designGraphRevision);
  assert.ok(claimedDeliveryRun.claimAttemptId);
  const deliveryClaim = claimedDeliveryRun.claimAttemptId;
  await store.updateApplyRun(sessionId, deliveryRun.id, {
    state: 'applying',
    message: 'Applying the reviewed delivery batch.',
    claimAttemptId: deliveryClaim,
  });
  await store.updateApplyRun(
    sessionId,
    deliveryRun.id,
    {
      state: 'rebuilding',
      changedFiles: ['PrimaryAction.tsx'],
      validationResults: [{ name: 'workspace build', passed: true }],
      claimAttemptId: deliveryClaim,
    },
    appliedSourceProof,
  );
  await store.recordApplyResult(
    sessionId,
    deliveryRun.id,
    deliveryClaim,
    applyChanges.map((change) => change.id),
    appliedSourceProof,
  );
  await store.updateApplyRun(sessionId, deliveryRun.id, {
    state: 'verifying',
    claimAttemptId: deliveryClaim,
  });
  deliverySession = await store.addVerifications(
    sessionId,
    applyChanges.map((change) => ({
      applyRunId: deliveryRun.id,
      claimAttemptId: deliveryClaim,
      changeId: change.id,
      property: change.property,
      requested: change.after,
      rendered: change.after,
      passed: true,
      reason: 'Rendered value matches the reviewed value.',
      geometry: change.target.geometry,
      evidence: ['The workspace fixture returned the reviewed rendered value.'],
      context: change.context,
      verifiedAt: new Date().toISOString(),
    })),
    deliveryRun.id,
    deliveryClaim,
    'browser-preview',
    appliedSourceProof,
  );
  await store.createDeliveryMilestone(sessionId, {
    name: 'Workspace refinement',
    summary: 'Verified interaction and presentation refinements.',
    entryIds: deliverySession.designHistory.map((entry) => entry.id),
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.workspace-rail [data-workspace-mode="delivery"]').click();
  await page.getByRole('heading', { name: 'Delivery', exact: true }).waitFor();
  assert.equal(await page.locator('.delivery-record-row').count(), 1);
  assert.equal(await page.locator('.delivery-record-detail').isVisible(), true);
  await assertAccessibleWorkspaceSurface();
  await captureWorkspace('delivery-handoff-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await captureWorkspace('delivery-handoff-dark.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.getByRole('button', { name: 'Refresh documentation' }).click();
  await page.getByRole('tab', { name: 'Documentation' }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.delivery-document-row').length >= 2);
  assert.ok((await page.locator('.delivery-document-row').count()) >= 2);
  await captureWorkspace('delivery-documentation-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await captureWorkspace('delivery-documentation-dark.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.getByRole('tab', { name: 'History' }).click();
  await page.getByText('Workspace refinement').waitFor();
  assert.equal(await page.locator('.delivery-timeline article').count(), 1);
  await captureWorkspace('delivery-history-light.png');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await captureWorkspace('delivery-history-dark.png');
  await verifyDeliveryWorkflow(page, artifactDirectory);
  // A selector is not an exact source mapping. This previously enabled Apply
  // and failed only after the user clicked it during a real recording.
  await store.addChange(sessionId, {
    target: {
      id: 'unmapped-heading',
      platform: 'web',
      semanticRole: 'h1',
      label: 'Make room for the work that matters.',
      componentPath: [],
      geometry: { x: 0, y: 0, width: 573, height: 106, scale: 1 },
      locator: { selector: 'h1#story-title' },
      confidence: 'measured',
      evidence: ['getBoundingClientRect', 'computed styles'],
    },
    category: 'typography',
    property: 'fontSize',
    before: 76,
    after: 54,
    unit: 'px',
    scope: 'instance',
    context: { breakpoint: 'desktop', theme: 'current', state: 'current' },
    confidence: 'inferred',
    evidence: ['computed styles'],
    status: 'approved',
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#workspace-menu-trigger').click();
  await page.locator('#workspace-menu [data-workspace-mode="review"]').click();
  await page.getByText(/Preview only: this layer has no stable source identity/).waitFor();
  assert.equal(await page.locator('#apply-agent').isDisabled(), true);
  assert.equal(
    await page
      .locator('.change-group')
      .filter({ hasText: 'Make room for the work that matters.' })
      .getByRole('checkbox', { name: 'Include fontSize', exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    (await store.read(sessionId)).changeSet.changes.find(
      (change) => change.target.id === 'unmapped-heading',
    ).after,
    54,
  );
  console.log(
    'Workspace Playwright flow passed: session, native viewport, Canvas, State Workbench, Component Workshop, Design System, Responsive Lab, Content and Accessibility Lab, Motion Studio, Typography Studio, Design Branches, change summary, Review, Apply, and Delivery.',
  );
} finally {
  await browser?.close();
  await runtime.stop();
  await new Promise((resolveClose) => preview.close(() => resolveClose()));
}
