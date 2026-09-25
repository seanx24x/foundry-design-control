import { cssPath, parseSource } from './locator.js';
import { inspectorVariantAttributes, restoreVariantAttributes } from './inspector-variants.js';
import {
  inspectorStyleProperties,
  inspectorAttributes,
  sharedInspectorControls,
  inspectorEditProperties,
  supportsInspectorObjectLayout,
} from './next-inspector.js';
import { PROTOCOL_VERSION } from 'foundry-design-protocol';
import packageJson from '../package.json' with { type: 'json' };
import { createDebouncedChangeRecorder } from './recording.js';
import {
  emptyReviewDraft,
  humanizeProperty,
  parseReviewDraft,
  reviewAfterValue,
  reviewSelection,
  reviewSummary,
} from './review.js';
import {
  nextCycleIndex,
  orderedSelectionIndexes,
  snapValue,
  spacingSegments,
  type LayerSignals,
} from './canvas.js';
import {
  contrastRatio,
  detectSizingMode,
  impactMessages,
  nearestNumericToken,
  virtualRange,
} from './intelligence.js';
import {
  auditHealthSnapshot,
  healthScore,
  textContrastThreshold,
  type HealthFinding,
  type HealthFixChange,
} from './health.js';
import {
  candidatesForElement,
  matchingTokens,
  rankedProjectTokens,
  type BrowserDesignToken,
  type BrowserMappingCandidate,
} from './semantic.js';
import {
  addDesignDecision,
  addRecipe,
  addVerifiedBaseline,
  baselineForContext,
  emptyDesignMemory,
  readDesignMemory,
  removeDesignDecision,
  removeRecipe,
  updateDesignDecision,
  writeDesignMemory,
  type ProjectDesignMemory,
  type VerifiedBaseline,
} from './design-memory.js';
import { decisionCategories, relevantDesignDecisions } from './design-decisions.js';
import { assessRecipe, recipeCategories } from './visual-recipes.js';
import { renderKeylineIcons } from './keyline-icons.js';
import { FOUNDRY_UI_FOUNDATION_CSS } from './ui-foundations.js';
import { createSafeDiagnostics, DIAGNOSTICS_PROTOCOL_VERSION } from './diagnostics.js';
import { rebuiltPropertyValueMatches } from './rebuilt-value.js';
import { rebuiltTargetIdentityMatches } from './rebuilt-identity.js';
import {
  STRESS_CONDITIONS,
  designHealthScope,
  normalizeStressConditions,
  validateStressConditions,
  type StressConditionId,
  type StressScope,
} from './stress-testing.js';
import { applyRunAction, applyRunMessage, isActiveApplyRun } from './apply-run.js';
import {
  DEFAULT_WORKSPACE_STATE,
  clampUtilityRect,
  resolveInterfaceTheme,
  updateWorkspace,
  type FoundryRect,
  type FoundryUtility,
  type FoundryWorkspaceState,
  type InterfaceThemePreference,
} from './workspace.js';
import {
  availableWorkshopScopes,
  componentVariantDrift,
  componentWorkshopStates,
  createComponentVariantDraft,
  normalizeWorkshopComponents,
  sourceLabel as workshopSourceLabel,
  type ComponentWorkshopDefinition,
  type ComponentWorkshopScope,
  type ComponentWorkshopState,
  type ComponentWorkshopVariant,
  type ComponentWorkshopSource,
} from './component-workshop.js';
import {
  blurAmount,
  composeShadowEffects,
  parseShadowEffects,
  replaceBlur,
  type ShadowEffectValue,
} from './effects.js';
import {
  analyzeTypography,
  buildFontIntegrationPlan,
  buildTypographyValidationPlan,
  collectProjectFonts,
  createProjectTypographyStyle,
  defaultGoogleFontSelection,
  fontInstallStrategies,
  fontFamilyDeclaration,
  fluidTypeClamp,
  googleFontStyles,
  googleFontVariationSettings,
  googleFontWeights,
  googleFontsCssUrl,
  localFontRecords,
  modularTypeSize,
  parseFontIntegrationPlan,
  parseFontFamilyStack,
  parseTypographyVerificationContexts,
  readProjectTypographyStyles,
  typeTreatments,
  typographyValidationEvidence,
  typographyPropertyMatches,
  writeProjectTypographyStyles,
  type FontInstallStrategy,
  type GoogleFontFamily,
  type GoogleFontSelection,
  type LocalFontRecord,
  type RenderedFontFace,
  type ProjectTypographyStyle,
  type ProjectTypographyStyleValues,
  type TypographyFontFace,
  type TypographyVerificationContext,
} from './typography.js';
import {
  discoverElementMotion,
  setRenderedMotionEasing,
  editableKeyframes,
  findDiscoveredMotion,
  motionCurveSnapshot,
  motionKeyframeValue,
  motionKeyframes,
  motionPathSnapshot,
  normalizeCubicBezier,
  normalizeSpring,
  parseMotionCurve,
  replaceMotionTranslation,
  updateMotionKeyframe,
  type DiscoveredMotion,
  type MotionCurve,
  type MotionCurveSnapshot,
  type MotionKeyframe,
  type NativeMotionAuthoring,
} from './motion.js';
import {
  PREVIEW_CONTEXT_VERSION,
  acceptPreviewRevision,
  authoredPseudoSelectorMatches,
  applyPreviewMutationAtomically,
  applyPreviewStateAttributes,
  applyPreviewTheme,
  capturePreviewThemeBaseline as captureThemeBaseline,
  createPreviewThemeBaseline,
  previewCapabilities,
  previewStateMethods,
  queryForPreviewState,
  replacePreviewPseudoSelector,
  restorePreviewThemeBaseline,
  themeHook,
  variantAttribute,
  type PreviewAxisResult,
  type PreviewContext,
  type PreviewContextResult,
  type PreviewDesignGraph,
  type PreviewMotionPreference,
  type PreviewPseudoState,
  type PreviewStateDefinition,
} from './preview-context.js';

export { nativeMotionBinding, registerNativeMotion } from './motion.js';
export type {
  NativeMotionAdapter,
  NativeMotionBinding,
  NativeMotionInput,
  NativeMotionSource,
} from './motion.js';

export interface FoundryInspectorOptions {
  runtimeUrl?: string;
  sessionId?: string;
  token?: string;
  previewCapability?: string;
  startInspecting?: boolean;
}

export interface FoundryInspectorController {
  inspect(): void;
  stopInspecting(): void;
  select(element: HTMLElement): void;
  destroy(): void;
}

interface VerificationContextSet {
  breakpoints?: string[];
  themes?: string[];
  states?: string[];
}

export function verificationFrameUrl(
  frozenContext: { targetUrl?: string; previewOrigin?: string },
  sessionId: string,
  token: string,
  previewCapability: string,
): string {
  if (!frozenContext.targetUrl) {
    throw new Error('The frozen reviewed contract has no target URL');
  }
  if (!previewCapability) {
    throw new Error('The live preview has no private verification capability');
  }
  const target = new URL(frozenContext.targetUrl);
  const previewOrigin = frozenContext.previewOrigin
    ? new URL(frozenContext.previewOrigin).origin
    : target.origin;
  const url =
    previewOrigin === target.origin
      ? target
      : new URL(`${target.pathname}${target.search}${target.hash}`, previewOrigin);
  url.searchParams.set('__foundry_session', sessionId);
  url.searchParams.set('__foundry_token', token);
  url.searchParams.set('__foundry_preview_capability', previewCapability);
  url.searchParams.set('__foundry_child', '1');
  url.searchParams.set('__foundry_verification', '1');
  return url.toString();
}

export function verificationContextsForChange(change: {
  context?: TypographyVerificationContext;
  contextSet?: VerificationContextSet;
}): TypographyVerificationContext[] {
  const fallback = change.context ?? {
    breakpoint: 'current',
    theme: 'current',
    state: 'current',
  };
  const values = (items: string[] | undefined, current: string): string[] => {
    const normalized = (items?.length ? items : [current]).map(String).filter(Boolean);
    return [...new Set(normalized.length ? normalized : [current])];
  };
  const breakpoints = values(change.contextSet?.breakpoints, fallback.breakpoint);
  const themes = values(change.contextSet?.themes, fallback.theme);
  const states = values(change.contextSet?.states, fallback.state);
  return breakpoints.flatMap((breakpoint) =>
    themes.flatMap((theme) => states.map((state) => ({ breakpoint, theme, state }))),
  );
}

export function verificationViewportForContext(
  frozenViewport: { width: number; height: number } | undefined,
  breakpointViewport: { width: number; height?: number } | undefined,
): { width: number; height: number } | undefined {
  if (breakpointViewport) {
    return {
      width: breakpointViewport.width,
      height: breakpointViewport.height ?? frozenViewport?.height ?? 900,
    };
  }
  return frozenViewport
    ? { width: frozenViewport.width, height: frozenViewport.height }
    : undefined;
}

type VerificationDisplayContext = Partial<TypographyVerificationContext> & {
  motionPreference?: string;
};

export function verificationContextLabel(result: {
  context?: VerificationDisplayContext;
  motionPreference?: string;
}): string {
  const axes = [
    `Breakpoint: ${result.context?.breakpoint ?? 'not reported'}`,
    `Theme: ${result.context?.theme ?? 'not reported'}`,
    `State: ${result.context?.state ?? 'not reported'}`,
  ];
  const motionPreference = result.context?.motionPreference ?? result.motionPreference;
  if (motionPreference) axes.push(`Motion: ${motionPreference}`);
  return axes.join(' · ');
}

export function reviewContextSetLabel(change: {
  context?: TypographyVerificationContext;
  contextSet?: VerificationContextSet;
}): string {
  const contexts = verificationContextsForChange(change);
  const values = (axis: keyof TypographyVerificationContext) => [
    ...new Set(contexts.map((context) => context[axis])),
  ];
  const breakpoints = values('breakpoint');
  const themes = values('theme');
  const states = values('state');
  return `Breakpoint: ${breakpoints.join(', ')} · Theme: ${themes.join(', ')} · State: ${states.join(', ')} · ${contexts.length} ${contexts.length === 1 ? 'context' : 'contexts'}`;
}

type Category =
  'layout' | 'typography' | 'color' | 'effects' | 'content' | 'accessibility' | 'motion';
type ControlKind = 'number' | 'text' | 'color' | 'select';

interface InspectorGroup {
  key: string;
  category: Category;
  label: string;
  icon: string;
  sectionLabels?: string[];
  showContext?: boolean;
}

const CATEGORY_LABELS: Record<Category, string> = {
  layout: 'Layout and spacing',
  typography: 'Typography',
  color: 'Fill and stroke',
  effects: 'Effects',
  content: 'Content',
  accessibility: 'Accessibility',
  motion: 'Motion',
};

const CATEGORY_ICONS: Record<Category, string> = {
  layout: 'layout-grid',
  typography: 'type',
  color: 'palette',
  effects: 'sparkles',
  content: 'file-text',
  accessibility: 'accessibility',
  motion: 'play',
};

interface ControlSection {
  label: string;
  properties: string[];
  columns?: 2;
  stacked?: true;
  prefixes?: Record<string, string>;
}

const CONTROL_SECTIONS: Partial<Record<Category, ControlSection[]>> = {
  layout: [
    {
      label: 'Position and size',
      properties: [
        'left',
        'top',
        'width',
        'height',
        'widthMode',
        'heightMode',
        'minWidth',
        'maxWidth',
        'aspectRatio',
        'overflow',
        'rotate',
        'scaleX',
        'scaleY',
      ],
      columns: 2,
      prefixes: {
        widthMode: 'W',
        heightMode: 'H',
        width: 'W',
        height: 'H',
        minWidth: 'Min',
        maxWidth: 'Max',
        aspectRatio: 'Ratio',
        overflow: 'Clip',
        left: 'X',
        top: 'Y',
        rotate: '°',
        scaleX: 'FX',
        scaleY: 'FY',
      },
    },
    {
      label: 'Flow',
      properties: [
        'display',
        'position',
        'flexDirection',
        'flexWrap',
        'justifyContent',
        'alignItems',
        'gap',
        'rowGap',
        'columnGap',
        'gridTemplateColumns',
        'gridTemplateRows',
      ],
    },
    {
      label: 'Padding',
      properties: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
      columns: 2,
      prefixes: {
        paddingTop: 'T',
        paddingRight: 'R',
        paddingBottom: 'B',
        paddingLeft: 'L',
      },
    },
    {
      label: 'Margin',
      properties: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
      columns: 2,
      prefixes: {
        marginTop: 'T',
        marginRight: 'R',
        marginBottom: 'B',
        marginLeft: 'L',
      },
    },
  ],
  typography: [
    { label: 'Typeface', properties: ['fontFamily'], stacked: true },
    {
      label: 'Metrics',
      properties: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'],
      columns: 2,
      prefixes: {
        fontSize: 'Size',
        fontWeight: 'Wgt',
        lineHeight: 'LH',
        letterSpacing: 'LS',
      },
    },
    {
      label: 'Alignment',
      properties: ['textAlign', 'fontStyle', 'textTransform', 'fontVariationSettings'],
    },
  ],
  color: [
    { label: 'Appearance', properties: ['opacity'] },
    {
      label: 'Fill',
      properties: ['color', 'backgroundColor', 'backgroundImage'],
      stacked: true,
    },
  ],
  effects: [
    {
      label: 'Corners',
      properties: [
        'borderRadius',
        'borderTopLeftRadius',
        'borderTopRightRadius',
        'borderBottomLeftRadius',
        'borderBottomRightRadius',
      ],
      columns: 2,
      prefixes: {
        borderRadius: 'All',
        borderTopLeftRadius: 'TL',
        borderTopRightRadius: 'TR',
        borderBottomLeftRadius: 'BL',
        borderBottomRightRadius: 'BR',
      },
    },
    { label: 'Stroke', properties: ['borderWidth', 'borderColor'] },
    {
      label: 'Effects',
      properties: ['boxShadow', 'filter', 'backdropFilter'],
      stacked: true,
    },
  ],
  content: [
    {
      label: 'Content',
      properties: ['textContent', 'src'],
      stacked: true,
    },
  ],
  accessibility: [
    {
      label: 'Semantics',
      properties: ['aria-label', 'role', 'tabindex', 'alt'],
      stacked: true,
    },
  ],
};

interface Control {
  category: Category;
  property: string;
  label: string;
  kind: ControlKind;
  value: string | number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  read(): string | number;
  apply(value: string | number): void;
}

const PANEL_CSS = `
  ${FOUNDRY_UI_FOUNDATION_CSS}
  @font-face { font-family:"Foundry Inter";src:url("http://127.0.0.1:4387/fonts/inter.woff2") format("woff2");font-style:normal;font-weight:100 900;font-display:swap; }
  @font-face { font-family:"Foundry JetBrains Mono";src:url("http://127.0.0.1:4387/fonts/jetbrains-mono.woff2") format("woff2");font-style:normal;font-weight:100 800;font-display:swap; }
  :host { all:initial; color-scheme:dark; --fdc-ink:#f0f1f3; --fdc-paper:#141416; --fdc-surface:#1c1c1f; --fdc-subtle:#242428; --fdc-elevated:#29292e; --fdc-line:#303035; --fdc-signal:var(--fdc-canvas-accent); --fdc-signal-soft:#172d50; --fdc-component:var(--fdc-ink); --fdc-component-soft:var(--fdc-subtle); --fdc-muted:#9a9aa2; --fdc-font:var(--fdc-font-sans); font-family:var(--fdc-font); color:var(--fdc-ink); }
  *,*::before,*::after { box-sizing:border-box;font-family:inherit; }
  button,select,input { font:inherit; }
  button:focus-visible,select:focus-visible,input:focus-visible { outline:4px solid var(--fdc-signal);outline-offset:4px; }
  .outline { position:fixed;z-index:2147483645;pointer-events:none;border:1px solid var(--fdc-signal);box-shadow:0 0 0 1px rgb(255 255 255 / 90%),0 0 0 4px rgb(54 89 244 / 12%);transition:top 80ms linear,left 80ms linear,width 80ms linear,height 80ms linear; }
  .measure { position:absolute;left:-4px;top:-28px;height:24px;display:flex;align-items:center;padding:0 8px;color:white;background:var(--fdc-signal);border-radius:4px 4px 4px 0;font:650 12px/1 var(--fdc-font);letter-spacing:.02em;white-space:nowrap;box-shadow:0 4px 16px rgb(25 43 124 / 20%); }
  .cross::before,.cross::after { content:"";position:absolute;background:var(--fdc-signal); }.cross::before { width:12px;height:1px;left:-8px;top:-1px; }.cross::after { width:1px;height:12px;left:-1px;top:-8px; }
  .panel { position:fixed;z-index:2147483646;top:12px;right:12px;width:384px;min-width:340px;max-width:min(520px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:hidden;display:flex;flex-direction:column;color:var(--fdc-ink);background:var(--fdc-surface);border:1px solid var(--fdc-line);box-shadow:0 1px 4px rgb(0 0 0 / 5%),0 12px 28px rgb(0 0 0 / 10%);pointer-events:auto;border-radius:12px; }
  .top { flex:none;background:var(--fdc-surface);border-bottom:1px solid var(--fdc-line); }
  .top-identity { position:relative;min-height:44px;display:flex;align-items:center;padding:0 12px; }
  .brand { flex:1;display:flex;align-items:center;min-width:0; }
  .brand-copy { display:flex;align-items:baseline;gap:4px; }.brand-copy b { font-size:12px;line-height:1;font-weight:550;letter-spacing:-.02em; }.brand-copy span { color:var(--fdc-muted);font:400 12px/1 var(--fdc-font); }
  .session-status { flex:none;margin-left:8px;display:flex;align-items:center;gap:4px;padding:4px 8px;border:0;color:#236c59;background:#eef8f4;border-radius:1000px;font:500 12px/1 var(--fdc-font);cursor:pointer; }.session-status i { width:4px;height:4px;background:#2ca67f;border-radius:50%; }.session-status.saving { color:#6b570f;background:#fff8d8; }.session-status.saving i { background:#d5a91d;animation:fdc-pulse 1s ease-in-out infinite; }.session-status.error,.session-status.offline { color:#8b4d3d;background:#faece7; }.session-status.error i,.session-status.offline i { background:#d16d51; }.session-status.saved { color:#236c59;background:#eef8f4; }.status-popover { position:absolute;z-index:2;top:40px;right:40px;width:240px;padding:12px;border:1px solid var(--fdc-line);border-radius:8px;background:white;box-shadow:0 12px 28px rgb(0 0 0 / 14%); }.status-popover[hidden] { display:none; }.status-popover strong { display:block;font-size:12px;font-weight:550; }.status-popover span,.status-popover code { display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;color:var(--fdc-muted);font:400 8px/1.45 var(--fdc-font);white-space:nowrap; }.status-popover button { width:100%;height:28px;margin-top:8px;border:1px solid var(--fdc-line);border-radius:4px;background:white;color:var(--fdc-ink);font-size:8px;cursor:pointer; }
  .top-identity>.close { flex:none;margin-left:4px; }.top-actions { min-height:40px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));align-items:center;padding:4px 8px;border-top:1px solid var(--fdc-line);background:var(--fdc-surface); }.top-actions .icon-button { justify-self:center; }.icon-button { width:32px;height:32px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:var(--fdc-muted);cursor:pointer; }.icon-button:hover { background:var(--fdc-subtle);color:var(--fdc-ink); }.icon-button.active { color:#0761d1;background:#edf6ff; }.icon-button:disabled { opacity:.35;cursor:not-allowed; }.icon-button:disabled:hover { color:var(--fdc-muted);background:transparent; }
  .selection { position:relative;padding:16px;background:var(--fdc-surface);border-bottom:1px solid var(--fdc-line); }.selection::before { content:"";position:absolute;top:12px;left:0;width:4px;height:0;background:var(--fdc-signal);border-radius:0 4px 4px 0;transition:height .18s ease; }.panel.has-selection .selection::before { height:24px; }.selection-heading { display:flex;align-items:center;justify-content:space-between;margin-bottom:8px; }.selection-kind { max-width:220px;overflow:hidden;text-overflow:ellipsis;padding:4px 8px;color:#4d4d4d;background:var(--fdc-subtle);border-radius:4px;font:500 12px/1 var(--fdc-font);text-transform:uppercase;letter-spacing:.025em;white-space:nowrap; }.selection-state { color:var(--fdc-muted);font:450 12px/1 var(--fdc-font); }.panel.has-selection .selection-state { color:#0761d1; }.selection strong { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;line-height:1.3;font-weight:550;letter-spacing:-.025em; }.selection code { display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;color:var(--fdc-muted);font:400 12px/1.45 var(--fdc-font);white-space:nowrap; }.selection-hint { display:block;margin-top:8px;color:#858585;font:400 12px/1.45 var(--fdc-font); }.selection-stats { display:flex;gap:4px;margin-top:12px; }.selection-stats[hidden] { display:none; }.selection-stats span { padding:4px 8px;color:#4d4d4d;background:var(--fdc-subtle);border-radius:4px;font:400 12px/1 var(--fdc-font); }.selection-stats span:first-child { color:#0761d1;background:#edf6ff; }.selection.selected-flash strong { animation:fdc-selection-title .2s ease-out; }
  .scope { display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 16px;background:var(--fdc-surface);border-bottom:1px solid var(--fdc-line); }.scope label { display:flex;flex-direction:column;gap:8px;color:var(--fdc-muted);font:500 12px/1.2 var(--fdc-font); }.scope select { width:100%;height:36px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-surface);color:var(--fdc-ink);font:400 12px/1 var(--fdc-font);text-transform:none;letter-spacing:0;outline:none;cursor:pointer; }
  .fdc-select { position:relative;min-width:0;min-height:32px;display:flex;flex:1;align-self:stretch; }.fdc-select[hidden] { display:none; }.fdc-select>select { position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;opacity:0!important;pointer-events:none!important; }.fdc-select-trigger { width:100%;min-width:0;height:36px;display:grid;grid-template-columns:minmax(0,1fr) 12px;align-items:center;gap:8px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:8px;color:var(--fdc-ink);background:var(--fdc-paper);font:400 12px/1 var(--fdc-font-mono);text-align:left;cursor:pointer; }.fdc-select-trigger:hover { border-color:var(--fdc-line-strong);background:var(--fdc-subtle); }.fdc-select-trigger[aria-expanded="true"],.fdc-select-trigger:focus-visible { border-color:var(--fdc-signal);box-shadow:0 0 0 4px color-mix(in srgb,var(--fdc-signal) 18%,transparent);outline:0; }.fdc-select-trigger:disabled { opacity:.4;cursor:not-allowed; }.fdc-select-value { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }.fdc-select-trigger svg { width:12px;height:12px;color:var(--fdc-muted); }.fdc-select-menu { position:fixed;z-index:2147483647;overflow-x:hidden;overflow-y:auto;padding:4px;border:1px solid var(--fdc-line);border-radius:8px;color:var(--fdc-ink);background:rgb(28 28 31 / 98%);box-shadow:0 16px 36px rgb(0 0 0 / 34%);backdrop-filter:blur(16px);pointer-events:auto; }.fdc-select-menu button { width:100%;min-height:36px;display:grid;grid-template-columns:minmax(0,1fr) 12px;align-items:center;gap:8px;padding:0 8px;border:0;border-radius:4px;color:var(--fdc-muted);background:transparent;font:400 12px/1 var(--fdc-font-mono);text-align:left;cursor:pointer; }.fdc-select-menu button:hover,.fdc-select-menu button:focus-visible { color:var(--fdc-ink);background:var(--fdc-subtle);outline:0; }.fdc-select-menu button[aria-selected="true"] { color:#9ec5ff;background:var(--fdc-signal-soft); }.fdc-select-menu button svg { width:12px;height:12px; }.control-field .fdc-select { min-height:32px; }.control-field .fdc-select-trigger { height:32px;border:0;border-radius:4px;background:transparent;box-shadow:none; }.effect-card-head .fdc-select { min-height:32px; }.effect-card-head .fdc-select-trigger { height:32px;padding-left:0;border:0;background:transparent;box-shadow:none;font-family:var(--fdc-font); }.workbench-controls .fdc-select { width:112px;flex:none;align-self:center; }.workbench-controls .fdc-select-trigger { height:32px; }.fdc-canvas-variant { position:fixed;z-index:2147483645;width:180px;min-height:32px;pointer-events:auto; }.fdc-canvas-variant .fdc-select-trigger { height:32px;color:#9ec5ff;background:var(--fdc-signal-soft);border-color:var(--fdc-signal); }
  .tool-shelf { position:fixed;z-index:2147483646;left:50%;bottom:20px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:calc(100vw - 32px);padding:8px;background:var(--fdc-surface);border:1px solid var(--fdc-line);border-radius:12px;box-shadow:0 4px 4px rgb(0 0 0 / 4%),0 8px 16px -4px rgb(0 0 0 / 14%);pointer-events:auto; }.mode-copy { min-width:96px;display:flex;flex-direction:column;gap:4px;padding:0 8px 0 1px; }.mode-copy strong { font-size:12px;font-weight:550;line-height:1.1; }.mode-copy span { color:var(--fdc-muted);font-size:8px;line-height:1.2;white-space:nowrap; }
  .tool-select,.tab { position:relative;flex:none;width:36px;height:36px;display:grid;place-items:center;padding:0;border:0;border-radius:8px;background:transparent;color:#4d4d4d;cursor:pointer; }.tool-select:hover,.tab:hover { color:var(--fdc-ink);background:var(--fdc-subtle); }.tool-select.active,.tab.active { color:white;background:var(--fdc-ink); }.tool-select svg,.icon-button svg { width:20px;height:20px;pointer-events:none; }.tab svg { width:16px;height:16px;pointer-events:none; }.tool-select::after,.tab::after { content:attr(data-tooltip);position:absolute;left:50%;bottom:calc(100% + 8px);transform:translate(-50%,4px);padding:8px 8px;border-radius:4px;background:var(--fdc-ink);color:white;font:400 12px/1 var(--fdc-font);white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s ease,transform .12s ease; }.tool-select:hover::after,.tool-select:focus-visible::after,.tab:not(:disabled):hover::after,.tab:not(:disabled):focus-visible::after { opacity:1;transform:translate(-50%,0); }.tool-divider { width:1px;height:24px;flex:none;background:var(--fdc-line); }.tabs { display:flex;gap:4px;overflow:visible;scrollbar-width:none; }.tab:disabled { color:#a1a1a1;cursor:default; }.tab:disabled:hover { background:transparent; }
  .controls { min-height:212px;overflow:auto;background:var(--fdc-surface); }.inspector-heading { position:sticky;top:0;z-index:1;height:44px;display:flex;align-items:center;gap:8px;padding:0 12px;background:rgb(255 255 255 / 96%);border-bottom:1px solid var(--fdc-line);backdrop-filter:blur(8px); }.inspector-heading svg { width:16px;height:16px;color:#4d4d4d; }.inspector-heading strong { font-size:12px;font-weight:550; }.property-count { margin-left:auto;color:var(--fdc-muted);font:400 12px/1 var(--fdc-font);letter-spacing:.01em; }.property-section { padding:0;border-bottom:1px solid var(--fdc-line); }.section-head { width:100%;min-height:40px;display:flex;align-items:center;padding:0 8px 0 4px;background:white;color:#3f3f3f; }.section-head:hover { background:#fcfcfc; }.section-toggle { min-width:0;min-height:40px;flex:1;display:flex;align-items:center;gap:8px;padding:0 8px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer; }.section-toggle>svg { width:12px;height:12px;color:#858585;transition:transform .12s ease; }.property-section.collapsed .section-toggle>svg { transform:rotate(-90deg); }.section-head strong { font-size:12px;font-weight:500; }.section-grid { display:grid;gap:8px;padding:0 12px 12px; }.property-section.collapsed .section-grid { display:none; }.section-grid.two { grid-template-columns:1fr 1fr; }.section-grid.stacked .property-control { grid-template-columns:1fr;gap:8px; }.property-control { display:grid;grid-template-columns:minmax(0,1fr) 132px 24px;align-items:center;gap:8px;min-height:36px; }.property-label { overflow:hidden;text-overflow:ellipsis;color:#4d4d4d;font-size:12px;font-weight:400;white-space:nowrap; }.control-field { position:relative;display:flex;align-items:center;min-width:0;height:32px;border:1px solid var(--fdc-line);border-radius:4px;background:var(--fdc-paper);overflow:hidden;transition:border-color .12s ease,box-shadow .12s ease,background .12s ease; }.control-field:hover { background:var(--fdc-surface); }.control-field:focus-within { border-color:var(--fdc-signal);background:var(--fdc-surface);box-shadow:0 0 0 4px rgb(0 112 243 / 10%); }.control-reset { width:24px;height:24px;display:grid;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:#8a8a8a;cursor:pointer;opacity:0; }.property-control:hover .control-reset,.compact-control:hover .control-reset,.control-reset:focus-visible { opacity:1; }.control-reset:hover { color:var(--fdc-ink);background:var(--fdc-subtle); }.control-reset svg { width:12px;height:12px; }.compact-control { min-width:0;display:grid;grid-template-columns:minmax(0,1fr) 24px;gap:4px;align-items:center; }.compact-control .control-field { width:100%; }.field-prefix { min-width:28px;padding-left:8px;color:#7a7a7a;font:400 12px/1 var(--fdc-font); }.compact-control .field-prefix.wide { min-width:40px; }.property-control input,.property-control select,.compact-control input,.compact-control select { width:100%;min-width:0;height:32px;padding:0 8px;border:0;background:transparent;color:var(--fdc-ink);font:400 12px/1 var(--fdc-font);outline:none; }.property-control input[type="number"],.compact-control input[type="number"] { appearance:textfield; }.property-control input[type="number"]::-webkit-inner-spin-button,.property-control input[type="number"]::-webkit-outer-spin-button,.compact-control input[type="number"]::-webkit-inner-spin-button,.compact-control input[type="number"]::-webkit-outer-spin-button { margin:0;appearance:none; }.property-control select { font-family:var(--fdc-font); }.control-field .unit-select { width:40px;flex:none;padding:0 4px;color:#707070;font-size:8px;cursor:pointer; }[data-scrub-for] { cursor:ew-resize;user-select:none;touch-action:none; }.property-label[data-scrub-for]:hover,.field-prefix[data-scrub-for]:hover,[data-scrub-for].scrubbing { color:var(--fdc-signal); }.color-swatch { width:16px;height:16px;flex:none;margin-left:8px;border:1px solid rgb(0 0 0 / 10%);border-radius:4px;background:var(--swatch-color); }.color-swatch.transparent { background-color:white;background-image:linear-gradient(45deg,#d9d9d9 25%,transparent 25%),linear-gradient(-45deg,#d9d9d9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d9d9d9 75%),linear-gradient(-45deg,transparent 75%,#d9d9d9 75%);background-size:8px 8px;background-position:0 0,0 4px,4px -4px,-4px 0; }.color-value { overflow:hidden;text-overflow:ellipsis;margin-left:8px;color:#4d4d4d;font:400 12px/1 var(--fdc-font);white-space:nowrap; }.color-picker { position:absolute;inset:0;width:100%!important;height:100%!important;opacity:0;cursor:pointer; }.unit { padding-right:8px;color:#7a7a7a;font:400 12px/1 var(--fdc-font); }.sr-only { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0; }
  .effect-section { display:block;padding:0 12px 12px; }.effects-editor,.effect-stack { display:grid;gap:8px; }.effect-empty { margin:0;padding:16px 12px;border:1px dashed var(--fdc-line);border-radius:8px;color:var(--fdc-muted);font-size:12px;text-align:center; }.effect-card { overflow:hidden;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-paper); }.effect-card-head { min-height:36px;display:flex;align-items:center;gap:8px;padding:0 4px 0 8px;border-bottom:1px solid var(--fdc-line); }.effect-card-head strong,.effect-card-head select { min-width:0;flex:1;height:32px;border:0;background:transparent;color:var(--fdc-ink);font:500 12px/1 var(--fdc-font);outline:none; }.effect-symbol { width:20px;height:20px;display:grid;place-items:center;color:var(--fdc-muted); }.effect-symbol svg,.effect-remove svg,.effect-add summary svg,.effect-menu svg { width:16px;height:16px; }.effect-remove { width:28px;height:28px;display:grid;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--fdc-muted);cursor:pointer; }.effect-remove:hover { color:var(--fdc-ink);background:var(--fdc-subtle); }.effect-fields { display:grid;gap:8px;padding:8px; }.effect-shadow-fields { grid-template-columns:1fr 1fr; }.effect-value { min-width:0;height:32px;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;overflow:hidden;border:1px solid var(--fdc-line);border-radius:4px;background:var(--fdc-surface); }.effect-value>span { min-width:28px;padding:0 8px;color:var(--fdc-muted);font:500 12px/1 var(--fdc-font); }.effect-value input { width:100%;height:100%;min-width:0;padding:0 8px;border:0;background:transparent;color:var(--fdc-ink);font:400 12px/1 var(--fdc-font-mono);outline:none; }.effect-color,.effect-blur { display:grid;grid-template-columns:52px minmax(0,1fr);align-items:center;gap:8px;color:var(--fdc-muted);font-size:12px; }.effect-color { grid-column:1/-1; }.effect-color-control { height:32px;display:grid;grid-template-columns:40px minmax(0,1fr) 24px;align-items:center;overflow:hidden;border:1px solid var(--fdc-line);border-radius:4px;background:var(--fdc-surface); }.effect-color-control input[type="color"] { width:40px;height:100%;padding:4px;border:0;background:transparent; }.effect-color-control input[type="color"]::-webkit-color-swatch-wrapper { padding:0; }.effect-color-control input[type="color"]::-webkit-color-swatch { border:0;border-radius:4px; }.effect-color-control input[type="number"] { width:100%;height:100%;min-width:0;padding:0 8px;border:0;border-left:1px solid var(--fdc-line);background:transparent;color:var(--fdc-ink);font:400 12px/1 var(--fdc-font-mono);outline:none; }.effect-color-control>span { color:var(--fdc-muted);font:400 12px/1 var(--fdc-font); }.effect-add { position:relative; }.effect-add summary { min-height:32px;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-paper);color:var(--fdc-ink);font-size:12px;cursor:pointer;list-style:none; }.effect-add summary::-webkit-details-marker { display:none; }.effect-add summary:hover { background:var(--fdc-subtle); }.effect-menu { position:absolute;z-index:8;right:0;bottom:calc(100% + 4px);width:220px;padding:4px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-elevated);box-shadow:0 12px 28px rgb(0 0 0 / 24%); }.effect-menu button { width:100%;height:32px;display:grid;grid-template-columns:20px minmax(0,1fr) auto;align-items:center;gap:8px;padding:0 8px;border:0;border-radius:4px;background:transparent;color:var(--fdc-ink);font-size:12px;text-align:left;cursor:pointer; }.effect-menu button:hover:not(:disabled) { background:var(--fdc-subtle); }.effect-menu button:disabled { color:var(--fdc-muted);cursor:not-allowed; }.effect-menu small { font:500 8px/1 var(--fdc-font-mono); }.motion-list { display:grid;gap:8px;padding:0 12px 12px; }.motion-row { display:grid;gap:12px;padding:12px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-paper); }.motion-title { display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:8px; }.motion-title strong { display:block;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:550;white-space:nowrap; }.motion-title code { display:block;margin-top:4px;color:var(--fdc-muted);font:400 8px/1.4 var(--fdc-font-mono);text-transform:uppercase;letter-spacing:.04em; }.motion-badge { min-height:20px;display:inline-flex;align-items:center;padding:0 8px;border-radius:1000px;color:var(--fdc-muted);background:var(--fdc-subtle);font:500 8px/1 var(--fdc-font);white-space:nowrap; }.motion-badge[data-tier="compositor"] { color:#236c59;background:#e8f7f1; }.motion-badge[data-tier="layout"] { color:#8b4d3d;background:#faece7; }.motion-timeline { width:100%;accent-color:var(--fdc-signal); }.motion-timeline:disabled { opacity:.32; }.motion-transport { display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) minmax(88px,1.2fr);gap:4px; }.motion-transport button,.motion-transport select { min-width:0;height:32px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;color:var(--fdc-ink);background:var(--fdc-surface);font:400 12px/1 var(--fdc-font);cursor:pointer; }.motion-transport button:hover:not(:disabled) { border-color:var(--fdc-line-strong);background:var(--fdc-subtle); }.motion-transport button:disabled,.motion-transport select:disabled { opacity:.35;cursor:not-allowed; }.motion-transport .fdc-select { min-height:32px; }.motion-transport .fdc-select-trigger { height:32px;border-radius:4px;font-family:var(--fdc-font-mono); }.motion-fields { display:grid;grid-template-columns:1fr 1fr;gap:8px; }.motion-fields label { display:grid;gap:8px;color:var(--fdc-muted);font:500 8px/1 var(--fdc-font); }.motion-fields label:last-child { grid-column:1/-1; }.motion-fields input { width:100%;height:32px;min-width:0;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;color:var(--fdc-ink);background:var(--fdc-surface);font:400 12px/1 var(--fdc-font-mono);outline:0; }.motion-fields input:focus-visible { border-color:var(--fdc-signal);box-shadow:0 0 0 4px color-mix(in srgb,var(--fdc-signal) 18%,transparent); }.motion-fields input:disabled { opacity:.35;cursor:not-allowed; }.motion-properties { overflow:hidden;text-overflow:ellipsis;color:var(--fdc-muted);font:400 8px/1.4 var(--fdc-font-mono);white-space:nowrap; }
  .empty { padding:48px 28px;text-align:center;color:var(--fdc-muted);font-size:12px;line-height:1.6; }.empty::before { content:"⌖";display:grid;place-items:center;width:40px;height:40px;margin:0 auto 12px;color:var(--fdc-signal);background:var(--fdc-signal-soft);border-radius:12px;font:20px/1 var(--fdc-font); }
  .change-dock { min-height:48px;display:grid;grid-template-columns:minmax(0,1fr) 32px 68px;align-items:center;gap:8px;padding:8px 8px;border-top:1px solid var(--fdc-line);background:white; }.change-dock[hidden] { display:none; }.change-dock-copy { min-width:0;padding-left:4px; }.change-dock-copy strong,.change-dock-copy span { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }.change-dock-copy strong { font-size:12px;font-weight:550; }.change-dock-copy span { margin-top:4px;color:var(--fdc-muted);font-size:8px; }.change-dock button { height:32px;border:1px solid var(--fdc-line);border-radius:4px;background:white;color:var(--fdc-ink);font-size:8px;cursor:pointer; }.change-dock .dock-review { color:white;border-color:var(--fdc-ink);background:var(--fdc-ink); }.change-dock svg { width:12px;height:12px; }.footer { display:grid;grid-template-columns:84px 1fr;gap:8px;padding:8px;background:var(--fdc-surface);border-top:1px solid var(--fdc-line); }.footer:has(.review[hidden]) { grid-template-columns:1fr; }.footer button[hidden] { display:none; }.footer button { min-height:36px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-surface);color:var(--fdc-ink);font-size:12px;font-weight:450;cursor:pointer; }.footer button:hover { border-color:#d0d0d0;background:var(--fdc-paper); }.footer .review { align-items:center;justify-content:center;gap:8px;color:white;background:var(--fdc-ink);border-color:var(--fdc-ink); }.footer .review:not([hidden]) { display:flex; }.footer .review:hover { background:#2f2f2f; }.change-count { min-width:20px;height:20px;display:inline-grid;place-items:center;padding:0 4px;color:var(--fdc-ink);background:white;border-radius:1000px;font:500 8px/1 var(--fdc-font); }.change-count[hidden] { display:none; }
  .review-view { min-height:0;flex:1;display:none;flex-direction:column;background:var(--fdc-surface); }.panel.reviewing .selection,.panel.reviewing .scope,.panel.reviewing .controls,.panel.reviewing>.footer,.panel.reviewing>.change-dock { display:none; }.panel.reviewing .review-view { display:flex; }.review-head { min-height:48px;display:flex;align-items:center;gap:8px;padding:0 12px;border-bottom:1px solid var(--fdc-line); }.review-head button { width:32px;height:32px;display:grid;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--fdc-muted);cursor:pointer; }.review-head button:hover { background:var(--fdc-subtle);color:var(--fdc-ink); }.review-head svg { width:16px;height:16px; }.review-head strong { font-size:12px;font-weight:550; }.review-head span { margin-left:auto;color:var(--fdc-muted);font-size:12px; }.review-body { min-height:160px;overflow-x:hidden;overflow-y:auto; }.review-toolbar { position:sticky;top:0;z-index:1;display:flex;gap:4px;padding:8px 8px;border-bottom:1px solid var(--fdc-line);background:rgb(255 255 255 / 96%);backdrop-filter:blur(8px); }.review-toolbar button { height:28px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;background:white;color:#555;font-size:8px;cursor:pointer; }.review-toolbar button:last-child { margin-left:auto; }.review-empty { padding:44px 24px;color:var(--fdc-muted);font-size:12px;line-height:1.55;text-align:center; }.review-group { border-bottom:1px solid var(--fdc-line); }.review-group-title { width:100%;min-height:36px;display:flex;align-items:center;gap:8px;padding:0 12px;border:0;background:white;color:var(--fdc-muted);font-size:12px;font-weight:500;text-align:left;cursor:pointer; }.review-group-title span { margin-left:auto;font-size:8px; }.review-group-title svg { width:12px;height:12px;transition:transform .12s ease; }.review-group.collapsed .review-group-title svg { transform:rotate(-90deg); }.review-group.collapsed .review-card { display:none; }.review-card { display:grid;grid-template-columns:20px minmax(0,1fr);gap:8px;padding:8px 12px 12px; }.review-card.rejected { opacity:.62; }.review-card+.review-card { border-top:1px solid var(--fdc-line); }.review-card input[type="checkbox"] { width:16px;height:16px;margin:4px 0 0;accent-color:var(--fdc-ink); }.review-card-main { min-width:0; }.review-card-line { display:flex;align-items:center;gap:8px; }.review-card-line strong { min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:500;white-space:nowrap; }.review-card-tools { display:flex;gap:4px;margin-left:auto; }.review-card-tools button { height:24px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;background:white;color:#666;font-size:8px;cursor:pointer; }.confidence-pill { flex:none;padding:4px 4px;border-radius:4px;background:#edf6ff;color:#0761d1;font-size:8px;text-transform:capitalize; }.confidence-pill.unresolved { color:#984a2b;background:#fff0e8; }.review-values { display:grid;grid-template-columns:minmax(0,1fr) 12px minmax(0,1fr);align-items:center;gap:4px;margin-top:8px; }.review-before { overflow:hidden;text-overflow:ellipsis;padding:8px;color:var(--fdc-muted);background:var(--fdc-subtle);border-radius:4px;font-size:12px;white-space:nowrap; }.review-values>span { color:var(--fdc-muted);font-size:12px;text-align:center; }.review-after { width:100%;height:28px;min-width:0;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;background:white;font-size:12px;outline:none; }.review-after:focus { border-color:var(--fdc-signal);box-shadow:0 0 0 4px rgb(0 112 243 / 10%); }.review-context,.verification-context { display:block;margin-top:4px;overflow-wrap:anywhere;color:var(--fdc-muted);font-size:8px;line-height:1.45; }.review-context { margin-top:8px; }.review-source { margin-top:8px;overflow-wrap:anywhere;color:var(--fdc-muted);font-size:8px;line-height:1.45; }.review-actions { display:grid;grid-template-columns:84px 1fr;gap:8px;padding:8px;border-top:1px solid var(--fdc-line); }.review-actions button { min-height:36px;border:1px solid var(--fdc-line);border-radius:8px;background:white;font-size:12px;cursor:pointer; }.review-actions .apply { color:white;background:var(--fdc-ink);border-color:var(--fdc-ink); }.review-actions button:disabled { opacity:.45;cursor:not-allowed; }.run-summary { padding:16px 12px;border-bottom:1px solid var(--fdc-line); }.run-state { display:flex;align-items:center;gap:8px; }.run-state i { width:8px;height:8px;border-radius:50%;background:#a3a3a3; }.run-state i.active { background:var(--fdc-signal);box-shadow:0 0 0 4px rgb(0 112 243 / 10%); }.run-state i.passed { background:#2ca67f; }.run-state i.attention { background:#d16d51; }.run-state strong { font-size:12px;font-weight:550;text-transform:capitalize; }.run-summary p { margin:8px 0 0;color:var(--fdc-muted);font-size:12px;line-height:1.5; }.run-steps { padding:4px 12px 12px; }.run-step { display:grid;grid-template-columns:20px minmax(0,1fr);gap:8px;padding:8px 0;border-bottom:1px solid var(--fdc-line); }.run-step:last-child { border-bottom:0; }.run-step span:first-child { color:var(--fdc-muted);font-size:12px; }.run-step strong { display:block;font-size:12px;font-weight:500;text-transform:capitalize; }.run-step p { margin:4px 0 0;color:var(--fdc-muted);font-size:8px;line-height:1.45; }.result-list { padding:0 12px 12px; }.result-row { display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:8px 0;border-top:1px solid var(--fdc-line);font-size:12px; }.result-row span:last-child { color:var(--fdc-muted);text-align:right; }.result-row.pass span:first-child { color:#23715c; }.result-row.fail span:first-child { color:#a24d30; }.run-files { padding:0 12px 12px;color:var(--fdc-muted);font-size:8px;line-height:1.5; }.run-files code { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .toast { position:fixed;left:50%;bottom:76px;transform:translate(-50%,8px);padding:8px 12px;background:var(--fdc-ink);color:white;border-radius:8px;font-size:12px;font-weight:450;opacity:0;transition:.15s ease;pointer-events:none;white-space:nowrap;box-shadow:0 8px 20px rgb(0 0 0 / 16%); }.toast.show { opacity:1;transform:translate(-50%,0); }
  .resize-handle { position:absolute;width:8px;height:8px;min-width:8px;min-height:8px;aspect-ratio:1;padding:0;border:1px solid #f0f1f3;border-radius:1px;background:var(--fdc-signal);box-shadow:0 1px 4px rgb(0 0 0 / 28%);appearance:none;pointer-events:auto;touch-action:none; }
  .resize-handle[data-handle="n"]{top:-4px;left:calc(50% - 4px);cursor:ns-resize}.resize-handle[data-handle="s"]{bottom:-4px;left:calc(50% - 4px);cursor:ns-resize}.resize-handle[data-handle="e"]{right:-4px;top:calc(50% - 4px);cursor:ew-resize}.resize-handle[data-handle="w"]{left:-4px;top:calc(50% - 4px);cursor:ew-resize}.resize-handle[data-handle="ne"]{right:-4px;top:-4px;cursor:nesw-resize}.resize-handle[data-handle="nw"]{left:-4px;top:-4px;cursor:nwse-resize}.resize-handle[data-handle="se"]{right:-4px;bottom:-4px;cursor:nwse-resize}.resize-handle[data-handle="sw"]{left:-4px;bottom:-4px;cursor:nesw-resize}
  .panel-resizer { position:absolute;z-index:3;top:84px;bottom:0;left:-4px;width:8px;border:0;background:transparent;cursor:ew-resize;touch-action:none; }.panel-resizer::after { content:"";position:absolute;top:50%;left:4px;width:4px;height:28px;transform:translateY(-50%);border-radius:4px;background:#4a4a50;opacity:0;transition:opacity .12s ease; }.panel:hover .panel-resizer::after,.panel-resizer:focus-visible::after { opacity:1; }.radius-handle { position:absolute;top:8px;left:8px;width:12px;height:12px;min-width:12px;min-height:12px;aspect-ratio:1;padding:0;border:4px solid #f0f1f3;border-radius:50%;background:#ff4d8d;box-shadow:0 1px 4px rgb(0 0 0 / 28%);appearance:none;pointer-events:auto;cursor:nwse-resize;touch-action:none; }
  .canvas-variant { position:fixed;z-index:2147483645;height:28px;max-width:180px;padding:0 24px 0 8px;border:1px solid #b8d5ff;border-radius:8px;background:white;color:#075fc5;font-size:8px;box-shadow:0 4px 16px rgb(0 0 0 / 10%);pointer-events:auto; }.canvas-variant[hidden] { display:none; }
  .onboarding-card { position:fixed;z-index:2147483647;left:50%;bottom:80px;width:288px;transform:translateX(-50%);padding:12px;border:1px solid var(--fdc-line);border-radius:12px;background:white;box-shadow:0 12px 32px rgb(0 0 0 / 14%);pointer-events:auto; }.onboarding-card[hidden] { display:none; }.onboarding-card-head { display:flex;align-items:center;gap:8px; }.onboarding-card-head svg { width:16px;height:16px;color:var(--fdc-signal); }.onboarding-card-head strong { font-size:12px;font-weight:550; }.onboarding-card p { margin:8px 0 12px;color:var(--fdc-muted);font-size:12px;line-height:1.5; }.onboarding-steps { display:grid;grid-template-columns:repeat(3,1fr);gap:4px; }.onboarding-steps span { padding:8px 4px;border:1px solid var(--fdc-line);border-radius:8px;color:#555;font-size:8px;line-height:1.35;text-align:center; }.onboarding-actions { display:flex;justify-content:flex-end;gap:4px;margin-top:12px; }.onboarding-actions button { height:28px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;background:white;font-size:8px;cursor:pointer; }.onboarding-actions .onboarding-start { color:white;border-color:var(--fdc-ink);background:var(--fdc-ink); }
  .review-details { margin-top:8px;color:var(--fdc-muted);font-size:8px; }.review-details summary { cursor:pointer;user-select:none; }.review-details[open] summary { margin-bottom:4px; }.review-details .review-source { display:block; }.review-details .impact-list { display:grid;gap:4px;margin-top:4px; }
  @keyframes fdc-pulse { 50% { opacity:.35; } }
  @media (prefers-reduced-motion:reduce){.session-status i,.section-head>svg,.toast,.tool-select::after,.tab::after{animation:none!important;transition:none!important}}
  .multi-outline { position:fixed;z-index:2147483644;border:1px dashed var(--fdc-signal);background:rgb(0 112 243 / 4%);pointer-events:none; }
  .hover-outline { position:fixed;z-index:2147483643;border:1px solid rgb(0 112 243 / 62%);background:rgb(0 112 243 / 4%);pointer-events:none; }
  .hover-outline::after { content:attr(data-label);position:absolute;left:-1px;top:-1px;transform:translateY(-100%);max-width:180px;padding:4px 8px;border-radius:4px 4px 4px 0;background:#0070f3;color:white;font:500 12px/1.2 var(--fdc-font);overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .snap-guide { position:fixed;z-index:2147483644;pointer-events:none;background:#ff4d8d;box-shadow:0 0 0 1px rgb(255 255 255 / 80%); }.snap-guide.vertical { width:1px;top:0;bottom:0; }.snap-guide.horizontal { height:1px;left:0;right:0; }
  .spacing-guide { position:fixed;z-index:2147483644;pointer-events:auto;background:#ff4d8d; }.spacing-guide.horizontal { height:1px;cursor:ew-resize; }.spacing-guide.vertical { width:1px;cursor:ns-resize; }.spacing-guide span { position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:4px 4px;border-radius:4px;background:#ff4d8d;color:white;font:600 8px/1 var(--fdc-font);white-space:nowrap; }
  .selection-path { display:flex;align-items:center;gap:4px;margin-top:8px;min-width:0; }.selection-path button { min-width:0;height:24px;display:flex;align-items:center;gap:4px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;background:var(--fdc-paper);color:#555;font-size:8px;cursor:pointer; }.selection-path button:hover { color:var(--fdc-ink);border-color:#d2d2d2;background:white; }.selection-path button:disabled { opacity:.4;cursor:default; }.selection-path svg { width:12px;height:12px; }.selection-path .path-name { flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .selection-path[hidden] { display:none; }
  .layers-panel { position:fixed;z-index:2147483646;top:12px;left:12px;width:252px;max-height:calc(100vh - 24px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--fdc-line);border-radius:12px;background:var(--fdc-surface);box-shadow:0 1px 4px rgb(0 0 0 / 5%),0 12px 28px rgb(0 0 0 / 10%);pointer-events:auto; }.layers-panel[hidden] { display:none; }.layers-head { min-height:44px;display:flex;flex:none;align-items:center;gap:8px;padding:0 8px 0 12px;border-bottom:1px solid var(--fdc-line); }.layers-head svg { width:16px;height:16px; }.layers-head strong { font-size:12px;font-weight:550; }.layers-head span { color:var(--fdc-muted);font-size:8px; }.layers-head .icon-button { margin-left:auto; }.layers-search { flex:none;padding:8px;border-bottom:1px solid var(--fdc-line);background:var(--fdc-paper); }.layers-search input { width:100%;height:32px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;background:white;color:var(--fdc-ink);font-size:12px;outline:none; }.layers-search input:focus { border-color:var(--fdc-signal);box-shadow:0 0 0 4px rgb(0 112 243 / 10%); }.layer-tree { min-height:120px;overflow:auto;padding:4px; }.layer-row { width:100%;height:32px;display:grid;grid-template-columns:16px 16px minmax(0,1fr) auto;align-items:center;gap:4px;padding:0 8px 0 calc(8px + var(--layer-depth) * 12px);border:0;border-radius:4px;background:transparent;color:#474747;text-align:left;cursor:pointer; }.layer-row:hover { background:var(--fdc-subtle); }.layer-row.selected { color:#075fc5;background:#eaf3ff; }.layer-row .chevron,.layer-row .layer-icon { width:12px;height:12px;color:#8a8a8a; }.layer-row .layer-label { overflow:hidden;text-overflow:ellipsis;font-size:12px;white-space:nowrap; }.layer-row .layer-meta { padding:4px 4px;border-radius:4px;background:#f0f0f0;color:#747474;font-size:8px;text-transform:uppercase; }.layer-row.selected .layer-meta { color:#075fc5;background:#d8e9ff; }.layers-empty { padding:36px 20px;color:var(--fdc-muted);font-size:12px;line-height:1.5;text-align:center; }
  .layers-switch { display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-bottom:1px solid var(--fdc-line);background:var(--fdc-paper); }.layers-switch button { min-width:0;height:28px;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 8px;border:0;border-radius:4px;background:transparent;color:var(--fdc-muted);font-size:12px;cursor:pointer; }.layers-switch button:hover { color:var(--fdc-ink);background:white; }.layers-switch button.active { color:var(--fdc-ink);background:white;box-shadow:0 0 0 1px var(--fdc-line),0 1px 4px rgb(0 0 0 / 5%); }.layers-switch button span { min-width:16px;height:16px;display:grid;place-items:center;padding:0 4px;border-radius:1000px;background:var(--fdc-subtle);color:#747474;font-size:8px; }.layers-switch button[data-layer-view="components"].active { color:var(--fdc-ink); }.layers-switch button[data-layer-view="components"].active span { color:var(--fdc-ink);background:var(--fdc-component-soft); }.component-list { display:grid;gap:4px;padding:4px; }.component-card { overflow:hidden;border:1px solid var(--fdc-line);border-radius:8px;background:white; }.component-card:hover { border-color:var(--fdc-line-strong);box-shadow:0 4px 8px rgb(0 0 0 / 6%); }.component-card.selected { border-color:var(--fdc-ink);background:var(--fdc-subtle);box-shadow:0 0 0 4px rgb(0 0 0 / 8%); }.component-main { width:100%;min-height:52px;display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 8px;border:0;background:transparent;color:var(--fdc-ink);text-align:left;cursor:pointer; }.component-main:disabled { cursor:default; }.component-mark { width:28px;height:28px;display:grid;place-items:center;border-radius:8px;color:var(--fdc-component);background:var(--fdc-component-soft); }.component-mark svg { width:16px;height:16px; }.component-copy { min-width:0; }.component-copy strong,.component-copy span { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }.component-copy strong { font-size:12px;font-weight:550; }.component-copy span { margin-top:4px;color:var(--fdc-muted);font-size:8px; }.component-status { display:flex;flex-direction:column;align-items:flex-end;gap:4px; }.component-status span { padding:4px 4px;border-radius:1000px;color:var(--fdc-ink);background:var(--fdc-component-soft);font-size:8px;white-space:nowrap; }.component-status small { color:#8b8b8b;font-size:8px;white-space:nowrap; }.component-variants { display:flex;gap:4px;overflow:hidden;padding:0 8px 8px 44px; }.component-variants span { max-width:88px;overflow:hidden;text-overflow:ellipsis;padding:4px 4px;border:1px solid var(--fdc-line);border-radius:4px;color:var(--fdc-muted);background:var(--fdc-paper);font-size:8px;white-space:nowrap; }
  .layer-tree { position:relative;scrollbar-gutter:stable; }.layer-selection-glide { position:absolute;z-index:0;top:0;right:4px;left:4px;height:32px;border:1px solid rgb(72 132 220 / 22%);border-radius:8px;background:var(--fdc-signal-soft);transform:translateY(var(--layer-glide-y));transition:transform .24s cubic-bezier(.16,1,.3,1),height .18s cubic-bezier(.16,1,.3,1);pointer-events:none; }.layer-row { position:relative;z-index:1;grid-template-columns:16px minmax(0,1fr);gap:1px;padding-right:4px;cursor:default; }.layer-row.entering { animation:layer-row-enter .22s cubic-bezier(.16,1,.3,1) both;animation-delay:min(calc(var(--layer-position) * 18ms),90ms); }.layer-row.selected { background:transparent; }.layer-row.dragging { opacity:.45; }.layer-row.drop-target { box-shadow:inset 0 4px 0 var(--fdc-signal); }.layer-branch { position:absolute;z-index:-1;top:-1px;bottom:-1px;left:var(--layer-branch-left);width:1px;background:var(--fdc-line);transform-origin:top;animation:layer-branch-draw .28s cubic-bezier(.16,1,.3,1) both;pointer-events:none; }.layer-spacer { width:1px;pointer-events:none; }.layer-toggle { width:16px;height:28px;display:grid;place-items:center;padding:0;border:0;background:transparent;color:#858585;cursor:pointer;transition:color .16s ease; }.layer-toggle:hover { color:var(--fdc-ink); }.layer-toggle:disabled { visibility:hidden; }.layer-toggle svg { width:12px;height:12px;transition:transform .24s cubic-bezier(.16,1,.3,1); }.layer-select { min-width:0;height:28px;display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:center;gap:4px;padding:0 4px;border:0;border-radius:4px;background:transparent;color:inherit;text-align:left;cursor:pointer;outline:none; }.layer-select:focus-visible { box-shadow:inset 0 0 0 1px var(--fdc-signal); }.layer-select:active .layer-icon { transform:scale(.88); }.layer-icon { transition:color .16s ease,transform .16s cubic-bezier(.16,1,.3,1); }@keyframes layer-row-enter { from { opacity:0;transform:translateY(-4px); } to { opacity:1;transform:translateY(0); } }@keyframes layer-branch-draw { from { opacity:0;transform:scaleY(0); } to { opacity:1;transform:scaleY(1); } }
  .health-panel { position:fixed;z-index:2147483646;top:12px;left:12px;width:304px;max-height:calc(100vh - 24px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--fdc-line);border-radius:12px;background:var(--fdc-surface);box-shadow:0 1px 4px rgb(0 0 0 / 5%),0 12px 28px rgb(0 0 0 / 10%);pointer-events:auto; }.health-panel[hidden] { display:none; }.health-head { min-height:48px;display:flex;align-items:center;gap:8px;padding:0 8px 0 12px;border-bottom:1px solid var(--fdc-line); }.health-head>svg { width:16px;height:16px; }.health-head strong { font-size:12px;font-weight:550; }.health-head .icon-button { margin-left:auto; }.health-summary { display:grid;grid-template-columns:56px minmax(0,1fr);gap:12px;padding:12px;border-bottom:1px solid var(--fdc-line); }.health-score { width:56px;height:56px;display:grid;place-items:center;border-radius:50%;background:conic-gradient(var(--score-color) calc(var(--score) * 1%),#ececec 0); }.health-score::before { content:"";grid-area:1/1;width:44px;height:44px;border-radius:50%;background:white; }.health-score strong { z-index:1;grid-area:1/1;font-size:16px;font-weight:600; }.health-summary-copy { min-width:0;align-self:center; }.health-summary-copy strong { display:block;font-size:12px;font-weight:550; }.health-summary-copy span { display:block;margin-top:4px;color:var(--fdc-muted);font-size:8px;line-height:1.4; }.health-filters { display:flex;gap:4px;padding:8px 8px;border-bottom:1px solid var(--fdc-line);background:var(--fdc-paper); }.health-filters button { min-height:28px;padding:0 8px;border:1px solid transparent;border-radius:4px;background:transparent;color:#666;font-size:8px;cursor:pointer; }.health-filters button:hover,.health-filters button.active { border-color:var(--fdc-line);background:white;color:var(--fdc-ink); }.health-list { min-height:120px;overflow:auto;padding:8px; }.health-card { padding:12px;border:1px solid var(--fdc-line);border-radius:8px;background:white; }.health-card+.health-card { margin-top:8px; }.health-card-top { display:flex;align-items:center;gap:8px; }.health-severity { width:8px;height:8px;flex:none;border-radius:50%;background:#a3a3a3; }.health-severity.high { background:#d15d43; }.health-severity.medium { background:#d69b3c; }.health-severity.low { background:#4b84cb; }.health-card-top strong { min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:550;white-space:nowrap; }.health-card-top span:last-child { margin-left:auto;color:var(--fdc-muted);font-size:8px;text-transform:capitalize; }.health-card p { margin:8px 0 0;color:#5d5d5d;font-size:8px;line-height:1.45; }.health-evidence { margin-top:8px;padding:8px;border-radius:4px;background:var(--fdc-paper);color:#777;font-size:8px;line-height:1.4; }.health-actions { display:flex;gap:4px;margin-top:8px; }.health-actions button { min-height:28px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;background:white;color:#555;font-size:8px;cursor:pointer; }.health-actions button:hover { border-color:#c8c8c8;color:var(--fdc-ink); }.health-actions .health-fix { margin-left:auto;color:white;border-color:var(--fdc-ink);background:var(--fdc-ink); }.health-actions .health-fix.previewed { color:#23715c;border-color:#bcded2;background:#edf8f4;cursor:default; }.health-actions .health-fix:disabled { opacity:1; }.health-actions .health-ignore { padding:0 8px;color:#888;border-color:transparent; }.health-footer { display:flex;align-items:center;gap:4px;padding:8px;border-top:1px solid var(--fdc-line); }.health-footer button { min-height:32px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;background:white;color:#555;font-size:8px;cursor:pointer; }.health-footer .health-rescan { flex:1;color:white;border-color:var(--fdc-ink);background:var(--fdc-ink); }.health-empty { padding:36px 20px;text-align:center;color:var(--fdc-muted);font-size:12px;line-height:1.5; }.health-empty svg { display:block;width:24px;height:24px;margin:0 auto 12px;color:#2b9a76; }
  .health-stress { padding:8px;border-bottom:1px solid var(--fdc-line);background:var(--fdc-paper); }.health-stress-head { display:flex;align-items:center;justify-content:space-between;min-height:24px;padding:0 4px 4px; }.health-stress-head strong { font-size:12px;font-weight:550; }.health-stress-head span { color:var(--fdc-muted);font:400 8px/1 var(--fdc-font-mono); }.health-stress-scope { display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px;padding:4px;border-radius:4px;background:var(--fdc-subtle); }.health-stress-scope button,.health-stress-options button { min-height:28px;padding:0 8px;border:1px solid transparent;border-radius:4px;color:var(--fdc-muted);background:transparent;font-size:8px;cursor:pointer; }.health-stress-scope button.active,.health-stress-options button.active { color:var(--fdc-ink);border-color:var(--fdc-line);background:var(--fdc-surface); }.health-stress-options { max-height:96px;display:flex;flex-wrap:wrap;gap:4px;overflow:auto;padding:4px 0; }.health-stress-actions { display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px; }.health-stress-actions button { min-height:28px;border:1px solid var(--fdc-line);border-radius:4px;color:var(--fdc-ink);background:var(--fdc-surface);font-size:8px;cursor:pointer; }.health-stress-actions button:last-child { color:var(--fdc-paper);border-color:var(--fdc-ink);background:var(--fdc-ink); }
  .tool-select:disabled { color:#b6b6b6;cursor:default; }.tool-select:disabled:hover { background:transparent; }
  .token-row { grid-column:2;display:flex;flex-wrap:wrap;gap:4px;margin-top:8px; }.token-chip { height:24px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:1000px;background:var(--fdc-paper);color:#4d4d4d;font-size:8px;cursor:pointer; }.token-chip:hover { border-color:#b7d5ff;color:#0761d1;background:#edf6ff; }
  .section-head .section-action { width:24px;height:24px;display:grid;place-items:center;margin-left:auto;padding:0;border:0;border-radius:4px;background:transparent;color:var(--fdc-muted);cursor:pointer; }.section-head .section-action:hover,.section-head .section-action.active { color:var(--fdc-signal);background:#edf6ff; }.section-head .section-action svg { width:12px;height:12px; }
  .context-tools { display:flex;flex-wrap:wrap;gap:4px;padding:8px 12px;border-bottom:1px solid var(--fdc-line);background:var(--fdc-surface); }.context-tools button { min-height:28px;display:flex;align-items:center;gap:4px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;background:white;color:#4d4d4d;font-size:8px;cursor:pointer; }.context-tools button:hover { border-color:#c8c8c8;color:var(--fdc-ink); }.context-tools button.active { color:#075fc5;border-color:#bad7ff;background:#edf6ff; }.context-tools svg { width:12px;height:12px; }
  .native-panel { padding:12px 12px;border-bottom:1px solid var(--fdc-line); }.native-panel-head { display:flex;align-items:center;margin-bottom:8px; }.native-panel-head strong { font-size:12px;font-weight:550; }.native-panel-head span { margin-left:auto;color:var(--fdc-muted);font-size:8px; }.native-search { width:100%;height:28px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;background:var(--fdc-paper);font-size:8px;outline:none; }.native-search:focus { border-color:var(--fdc-signal); }.native-grid { display:flex;flex-wrap:wrap;gap:4px;margin-top:8px; }.native-chip { min-height:28px;display:flex;align-items:center;gap:4px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;background:white;color:#4d4d4d;font-size:8px;cursor:pointer; }.native-chip:hover { border-color:#bdd7fb;background:#f5f9ff; }.native-chip .swatch { width:12px;height:12px;border:1px solid rgb(0 0 0 / 10%);border-radius:4px;background:var(--token-color); }.design-health { display:flex;align-items:center;gap:8px;margin-top:8px;padding:8px 8px;border-radius:4px;background:#f3f3f3;color:#575757;font-size:8px; }.design-health.pass { color:#23715c;background:#edf8f4; }.design-health.fail { color:#9a4930;background:#fff0e9; }.design-health svg { width:12px;height:12px; }
  .variant-list { display:grid;gap:4px;margin-top:8px; }.variant-button { min-height:32px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;background:white;font-size:8px;cursor:pointer; }.variant-button code { overflow:hidden;text-overflow:ellipsis;color:var(--fdc-muted);font-size:8px;white-space:nowrap; }
  .compare-bar { position:fixed;z-index:2147483646;left:50%;bottom:80px;transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:8px;border:1px solid var(--fdc-line);border-radius:8px;background:white;box-shadow:0 8px 24px rgb(0 0 0 / 14%);pointer-events:auto; }.compare-bar[hidden] { display:none; }.compare-bar strong { padding:0 8px;font-size:12px;font-weight:550; }.compare-bar button { height:32px;display:flex;align-items:center;gap:4px;padding:0 8px;border:0;border-radius:4px;background:transparent;color:#555;font-size:8px;cursor:pointer; }.compare-bar button:hover,.compare-bar button.active { color:white;background:var(--fdc-ink); }.compare-bar svg { width:12px;height:12px; }.compare-bar input[type="range"] { width:96px;accent-color:var(--fdc-ink);cursor:ew-resize; }
  .command-palette { position:fixed;z-index:2147483647;left:50%;top:18%;transform:translateX(-50%);width:min(480px,calc(100vw - 32px));overflow:hidden;border:1px solid #d8d8d8;border-radius:12px;background:white;box-shadow:0 24px 80px rgb(0 0 0 / 24%);pointer-events:auto; }.command-palette[hidden] { display:none; }.command-search { display:flex;align-items:center;border-bottom:1px solid var(--fdc-line);background:var(--fdc-paper); }.command-palette input { min-width:0;flex:1;width:auto;height:48px;padding:0 16px;border:0;font-size:12px;outline:none; }.command-search .icon-button { flex:none;margin-right:8px; }.command-list { max-height:320px;overflow:auto;padding:4px; }.command-item { width:100%;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:#333;text-align:left;font-size:12px;cursor:pointer; }.command-item:hover,.command-item.active { background:var(--fdc-subtle); }.command-item svg { width:16px;height:16px;color:#777; }.command-item small { margin-left:auto;color:#8a8a8a;font-size:8px; }
  .comparison-stage { position:fixed;z-index:2147483647;inset:12px;display:flex;flex-direction:column;overflow:hidden;border:1px solid #303030;border-radius:12px;background:#111;box-shadow:0 24px 80px rgb(0 0 0 / 35%);pointer-events:auto; }.comparison-stage[hidden] { display:none; }.comparison-stage header { min-height:48px;display:flex;align-items:center;padding:0 8px 0 16px;color:white;border-bottom:1px solid #292929;background:#171717; }.comparison-stage header strong { font-size:12px;font-weight:550; }.comparison-stage header span { margin-left:8px;color:#8d8d8d;font-size:12px; }.comparison-stage header button { width:32px;height:32px;display:grid;place-items:center;margin-left:auto;padding:0;border:0;border-radius:4px;background:transparent;color:#aaa;cursor:pointer; }.comparison-stage header button:hover { color:white;background:#292929; }.comparison-stage header svg { width:16px;height:16px; }.comparison-frames { min-height:0;flex:1;display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#343434; }.comparison-frame { position:relative;min-width:0;min-height:0;background:white; }.comparison-frame span { position:absolute;z-index:1;top:12px;left:12px;padding:4px 8px;border-radius:4px;background:rgb(17 17 17 / 88%);color:white;font-size:8px; }.comparison-frame iframe { width:100%;height:100%;display:block;border:0;background:white; }
  .impact-list { display:grid;gap:4px;margin-top:8px; }.impact-item { display:flex;align-items:flex-start;gap:4px;color:#666;font-size:8px;line-height:1.35; }.impact-item::before { content:"";width:4px;height:4px;flex:none;margin-top:4px;border-radius:50%;background:#9a9a9a; }.impact-item.warning { color:#985033; }.impact-item.warning::before { background:#d16d51; }
  .mapping-chooser { grid-column:2;margin-top:8px;padding:8px;background:#fff9ed;border:1px solid #f4ddb2;border-radius:8px; }.mapping-chooser>strong { display:block;margin-bottom:4px;color:#80561c;font-size:8px;font-weight:550; }.mapping-option { display:flex;align-items:flex-start;gap:8px;padding:4px 0;color:#5f4b2d;font-size:8px;line-height:1.35;cursor:pointer; }.mapping-option input { margin:1px 0 0;accent-color:var(--fdc-signal); }.mapping-option small { display:block;color:#8b7758;font-size:8px; }
  .workbench { position:fixed;z-index:2147483647;inset:12px;display:flex;flex-direction:column;overflow:hidden;border:1px solid #303030;border-radius:12px;background:#111;box-shadow:0 24px 80px rgb(0 0 0 / 35%);pointer-events:auto; }.workbench[hidden] { display:none; }.workbench-head { min-height:48px;display:flex;align-items:center;gap:8px;padding:0 8px 0 16px;color:white;border-bottom:1px solid #292929;background:#171717; }.workbench-head strong { font-size:12px;font-weight:550; }.workbench-context { color:#8d8d8d;font-size:12px; }.workbench-controls,[data-workbench-states] { display:flex;align-items:center;gap:4px; }.workbench-controls { margin-left:auto; }.workbench-controls button,.workbench-controls select { height:32px;padding:0 8px;border:1px solid #343434;border-radius:8px;background:#202020;color:#d7d7d7;font-size:12px;cursor:pointer; }.workbench-controls button.active { color:#111;background:white;border-color:white; }.workbench-controls button:disabled { opacity:.44;cursor:not-allowed; }.workbench-controls .icon-button { width:32px;padding:0; }.workbench-stage { min-height:0;flex:1;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:28px;background-color:#151515;background-image:linear-gradient(#202020 1px,transparent 1px),linear-gradient(90deg,#202020 1px,transparent 1px);background-size:24px 24px; }.frame-shell { position:relative;flex:none;border-radius:8px;background:white;box-shadow:0 0 0 1px #333,0 20px 60px rgb(0 0 0 / 35%);overflow:hidden; }.frame-label { position:absolute;left:0;top:-20px;color:#8f8f8f;font-size:8px; }.frame-shell iframe { display:block;width:100%;height:100%;border:0;background:white; }.workbench-warning { position:absolute;left:50%;bottom:20px;transform:translateX(-50%);max-width:520px;padding:8px 12px;border:1px solid #3b3b3b;border-radius:8px;background:#1d1d1d;color:#aaa;font-size:12px;line-height:1.4; }
  .library-panel { position:fixed;z-index:2147483647;top:12px;right:352px;width:300px;max-height:calc(100vh - 24px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--fdc-line);border-radius:12px;background:white;box-shadow:0 12px 32px rgb(0 0 0 / 14%);pointer-events:auto; }.library-panel[hidden] { display:none; }.library-head { min-height:48px;display:flex;align-items:center;gap:8px;padding:0 8px 0 12px;border-bottom:1px solid var(--fdc-line); }.library-head svg { width:16px;height:16px; }.library-head strong { font-size:12px;font-weight:550; }.library-head span { color:var(--fdc-muted);font-size:8px; }.library-head .icon-button { margin-left:auto; }.library-actions { display:flex;gap:4px;padding:8px;border-bottom:1px solid var(--fdc-line); }.library-actions button { min-height:32px;display:flex;align-items:center;justify-content:center;gap:8px;flex:1;border:1px solid var(--fdc-line);border-radius:4px;background:white;color:#4d4d4d;font-size:8px;cursor:pointer; }.library-actions button:disabled { opacity:.45;cursor:not-allowed; }.library-actions svg { width:12px;height:12px; }.library-body { min-height:120px;overflow:auto;padding:8px; }.library-section+.library-section { margin-top:12px; }.library-section-head { display:flex;align-items:center;margin:0 4px 8px;color:#666;font-size:8px;text-transform:uppercase;letter-spacing:.04em; }.library-section-head span { margin-left:auto;text-transform:none;letter-spacing:0; }.memory-card { padding:8px;border:1px solid var(--fdc-line);border-radius:8px;background:white; }.memory-card+.memory-card { margin-top:4px; }.memory-card-top { display:flex;align-items:center;gap:8px; }.memory-card-top strong { min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:550;white-space:nowrap; }.memory-status { width:8px;height:8px;flex:none;border-radius:50%;background:#2ca67f; }.memory-card p { margin:4px 0 0;color:var(--fdc-muted);font-size:8px;line-height:1.45; }.memory-card-actions { display:flex;gap:4px;margin-top:8px; }.memory-card-actions button { height:28px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;background:white;color:#555;font-size:8px;cursor:pointer; }.memory-card-actions button:first-child { flex:1;color:white;border-color:var(--fdc-ink);background:var(--fdc-ink); }.library-empty { padding:20px 12px;color:var(--fdc-muted);font-size:8px;line-height:1.5;text-align:center; }
  .review-visual { display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:8px; }.review-sample { position:relative;min-height:36px;display:grid;place-items:center;overflow:hidden;border:1px solid var(--fdc-line);border-radius:4px;background:#fafafa;color:#777;font-size:8px; }.review-sample::after { content:attr(data-label);position:absolute;left:4px;bottom:4px;padding:4px 4px;border-radius:4px;background:rgb(255 255 255 / 84%);color:#777;font-size:8px; }.review-sample>i { width:32px;height:16px;display:block;border:1px solid #bbb;background:var(--sample-color,#e8e8e8);border-radius:var(--sample-radius,4px);transform:scale(var(--sample-scale,1)); }.review-card.locating { background:#f5f9ff; }.review-group-title .included-count { margin-left:auto;color:#23715c; }.review-group-title .group-total { margin-left:4px; }.baseline-badge { display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:4px 8px;border-radius:4px;color:#23715c;background:#edf8f4;font-size:8px; }.baseline-badge::before { content:"";width:4px;height:4px;border-radius:50%;background:#2ca67f; }
  .workbench-matrix { display:grid;grid-template-columns:92px repeat(var(--matrix-columns),minmax(112px,1fr));gap:1px;width:min(900px,100%);margin:0 auto 24px;padding:1px;background:#303030;border-radius:8px;overflow:hidden; }.matrix-cell { min-height:52px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;padding:8px;border:0;background:#1d1d1d;color:#ddd;font-size:8px;text-align:left;cursor:pointer; }.matrix-cell:hover { background:#252525; }.matrix-cell.header { min-height:32px;color:#888;background:#181818;cursor:default; }.matrix-cell strong { font-size:8px;font-weight:500; }.matrix-cell span { color:#777;font-size:8px; }.matrix-cell.verified span { color:#68caa8; }.workbench-stage.matrix-mode { display:block; }.workbench-stage.matrix-mode .frame-shell { margin:0 auto; }
  .component-actions { display:flex;gap:4px;padding:0 8px 8px 44px; }.component-actions button,.component-variants button { height:24px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;color:var(--fdc-ink);background:var(--fdc-paper);font-size:8px;cursor:pointer; }.component-actions button:hover,.component-variants button:hover { border-color:var(--fdc-line-strong);background:var(--fdc-subtle); }
  .component-workshop-panel { width:384px;display:flex;flex-direction:column;overflow:hidden;color:var(--fdc-ink);background:var(--fdc-surface);border:1px solid var(--fdc-line);border-radius:12px;pointer-events:auto; }.component-workshop-head { min-height:48px;display:grid;grid-template-columns:24px minmax(0,1fr) 32px;align-items:center;gap:8px;padding:0 8px 0 12px;border-bottom:1px solid var(--fdc-line); }.component-workshop-head>svg { width:20px;height:20px;color:var(--fdc-muted); }.component-workshop-head strong,.component-workshop-head span { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }.component-workshop-head strong { font-size:12px;font-weight:550; }.component-workshop-head span { margin-top:4px;color:var(--fdc-muted);font-size:8px; }.component-workshop-body { min-height:0;flex:1;overflow:auto; }.component-workshop-empty { padding:40px 20px;color:var(--fdc-muted);font-size:12px;line-height:1.5;text-align:center; }.component-workshop-section { padding:12px;border-bottom:1px solid var(--fdc-line); }.component-workshop-section>header { display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:12px; }.component-workshop-section>header strong { font-size:12px;font-weight:550; }.component-workshop-section>header span { color:var(--fdc-muted);font:400 8px/1.4 var(--fdc-font-mono);text-align:right; }.component-workshop-picker { display:grid;gap:8px;padding:12px;border-bottom:1px solid var(--fdc-line); }.component-workshop-picker label { color:var(--fdc-muted);font-size:12px; }.component-workshop-picker .fdc-select { margin-top:8px; }.component-workshop-meta { display:grid;grid-template-columns:1fr 1fr;gap:8px; }.component-workshop-stat { min-width:0;padding:8px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-paper); }.component-workshop-stat strong,.component-workshop-stat span { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }.component-workshop-stat strong { font:550 12px/1.2 var(--fdc-font); }.component-workshop-stat span { margin-top:4px;color:var(--fdc-muted);font:400 8px/1.4 var(--fdc-font-mono); }.component-workshop-scope,.component-workshop-states { display:grid;grid-template-columns:repeat(3,1fr);gap:4px; }.component-workshop-scope button,.component-workshop-states button,.component-workshop-variant,.component-workshop-instance { min-width:0;min-height:36px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:8px;color:var(--fdc-muted);background:var(--fdc-paper);font-size:12px;cursor:pointer; }.component-workshop-scope button:hover:not(:disabled),.component-workshop-states button:hover:not(:disabled),.component-workshop-variant:hover:not(:disabled),.component-workshop-instance:hover { color:var(--fdc-ink);background:var(--fdc-subtle); }.component-workshop-scope button.active,.component-workshop-states button.active,.component-workshop-variant.active,.component-workshop-instance.active { color:var(--fdc-ink);border-color:var(--fdc-ink);background:var(--fdc-subtle); }.component-workshop-scope button:disabled,.component-workshop-variant:disabled { opacity:.4;cursor:not-allowed; }.component-workshop-scope-note,.component-workshop-state-note { display:block;margin-top:8px;color:var(--fdc-muted);font-size:8px;line-height:1.45; }.component-workshop-variants,.component-workshop-instances { display:grid;gap:4px; }.component-workshop-variant,.component-workshop-instance { display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;text-align:left; }.component-workshop-variant span,.component-workshop-instance span { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }.component-workshop-variant code,.component-workshop-instance code { margin-left:8px;color:var(--fdc-muted);font:400 8px/1 var(--fdc-font-mono); }.component-workshop-states { grid-template-columns:repeat(2,1fr); }.component-workshop-state-signal { width:8px;height:8px;margin-right:8px;display:inline-block;border-radius:50%;background:var(--fdc-muted); }.component-workshop-states button[data-confidence="instrumented"] .component-workshop-state-signal { background:#2ca67f; }.component-workshop-actions { display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px; }.component-workshop-actions button { min-height:36px;border:1px solid var(--fdc-line);border-radius:8px;color:var(--fdc-ink);background:var(--fdc-paper);font-size:12px;cursor:pointer; }.component-workshop-actions button.primary { color:var(--fdc-paper);background:var(--fdc-ink);border-color:var(--fdc-ink); }.component-workshop-form { display:grid;grid-template-columns:1fr 1fr;gap:8px; }.component-workshop-form label { min-width:0;color:var(--fdc-muted);font-size:8px;line-height:1.4; }.component-workshop-form input,.component-workshop-form select { width:100%;min-height:36px;margin-top:4px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:8px;color:var(--fdc-ink);background:var(--fdc-paper);font:400 12px/1 var(--fdc-font-mono);box-sizing:border-box; }.component-workshop-form>button { grid-column:1/-1;min-height:36px;border:1px solid var(--fdc-ink);border-radius:8px;color:var(--fdc-paper);background:var(--fdc-ink);font-size:12px;cursor:pointer; }.component-workshop-form>button:disabled { opacity:.4;cursor:not-allowed; }.component-workshop-drift[data-drift-count="0"] { background:transparent; }.component-workshop-drift-list { display:grid;gap:4px;margin-bottom:8px; }.component-workshop-drift-list>span { min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:8px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-paper); }.component-workshop-drift-list strong,.component-workshop-drift-list code { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }.component-workshop-drift-list strong { font-size:12px;font-weight:500; }.component-workshop-drift-list code { color:var(--fdc-muted);font:400 8px/1.4 var(--fdc-font-mono); }.component-workshop-drift>button { width:100%;min-height:36px;border:1px solid var(--fdc-line);border-radius:8px;color:var(--fdc-ink);background:var(--fdc-paper);font-size:12px;cursor:pointer; }
  .token-provenance { grid-column:2;display:flex;align-items:center;gap:4px;margin-top:4px;color:#23715c;font-size:8px; }.token-provenance.literal { color:#985033; }.token-provenance::before { content:"";width:4px;height:4px;border-radius:50%;background:currentColor; }
  .workbench-matrix[hidden] { display:none; }
  /* Foundry dark instrument theme */
  .panel,.layers-panel,.health-panel,.library-panel,.tool-shelf,.onboarding-card,.compare-bar,.command-palette,.status-popover,.canvas-variant { color:var(--fdc-ink);background:var(--fdc-surface);border-color:var(--fdc-line);box-shadow:0 1px 4px rgb(0 0 0 / 24%),0 16px 36px rgb(0 0 0 / 36%); }
  .top,.top-actions,.selection,.scope,.controls,.property-section,.change-dock,.footer,.review-view,.review-head,.review-group,.review-group-title,.review-actions,.layers-head,.layer-tree,.health-head,.health-list,.health-footer,.library-head,.library-actions,.library-body,.memory-card,.context-tools,.native-panel { color:var(--fdc-ink);background:var(--fdc-surface);border-color:var(--fdc-line); }
  .inspector-heading,.review-toolbar { background:rgb(28 28 31 / 96%);border-color:var(--fdc-line); }
  .section-head,.section-head:hover,.onboarding-step { color:var(--fdc-ink);background:var(--fdc-surface); }
  .icon-button,.tool-select,.tab,.section-toggle,.review-head button,.review-group-title,.compare-bar button { color:var(--fdc-muted); }
  .icon-button:hover,.review-head button:hover,.section-head:hover,.layer-row:hover,.command-item:hover,.command-item.active { color:var(--fdc-ink);background:var(--fdc-subtle); }
  .tool-select.active,.tab.active { color:var(--fdc-ink);background:#34343a; }.tool-select.inspect.active { color:white;background:var(--fdc-signal); }
  .icon-button.active,.section-head .section-action.active,.context-tools button.active { color:#9ec5ff;background:var(--fdc-signal-soft);border-color:#315482; }
  .tool-select::after,.tab::after { color:#141416;background:#f0f1f3;border:1px solid #ffffff; }
  .selection-kind,.selection-stats span,.layer-badge { color:#c8c8ce;background:var(--fdc-subtle); }.selection-stats span:first-child { color:#86b7ff;background:var(--fdc-signal-soft); }
  .selection-path button,.control-field,.native-search,.layers-search input,.review-after,.review-toolbar button,.review-card-tools button,.review-actions button,.change-dock button,.footer button,.status-popover button,.health-actions button,.health-footer button,.context-tools button,.native-chip,.variant-button,.library-actions button,.memory-card-actions button,.empty-state-actions button,.onboarding-actions button { color:var(--fdc-ink);background:var(--fdc-elevated);border-color:var(--fdc-line); }
  .selection-path button:hover,.control-field:hover,.footer button:hover { color:var(--fdc-ink);background:#303036;border-color:#494950; }
  .scope select,.property-control input,.property-control select,.compact-control input,.compact-control select,.native-search,.command-palette input { color:var(--fdc-ink);background:var(--fdc-paper);border-color:var(--fdc-line); }
  .scope select option,.property-control select option,.compact-control select option { color:var(--fdc-ink);background:var(--fdc-paper); }
  .property-label,.section-head,.color-value,.layer-row,.command-item,.library-section-head { color:#d1d1d6; }.field-prefix,.unit,.control-field .unit-select,.section-toggle>svg,.layer-row .chevron,.layer-row .layer-icon,.command-item svg,.command-item small { color:var(--fdc-muted); }
  .layer-row.selected { color:#a9cbff;background:transparent; }.layer-row.selected .layer-icon { color:#86b7ff; }
  .layer-row .layer-meta { color:#b5b5bc;background:var(--fdc-elevated); }.layer-row.selected .layer-meta { color:#a9cbff;background:#23416d; }
  .layers-search { background:var(--fdc-paper); }.layers-switch { background:var(--fdc-paper);border-color:var(--fdc-line); }.layers-switch button { color:var(--fdc-muted);background:transparent; }.layers-switch button:hover,.layers-switch button.active { color:var(--fdc-ink);background:var(--fdc-elevated); }.layers-switch button[data-layer-view="components"].active,.layers-switch button[data-layer-view="components"].active span { color:var(--fdc-ink);background:var(--fdc-component-soft); }
  .token-chip { color:#d1d1d6;background:var(--fdc-paper);border-color:var(--fdc-line); }.token-chip:hover { color:#9ec5ff;background:var(--fdc-signal-soft);border-color:#315482; }
  .section-actions { flex:none;display:flex;align-items:center;gap:4px; }.section-action,.section-actions button,.category-action,.token-menu-trigger { height:28px;display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:0 8px;border:1px solid transparent;border-radius:4px;color:var(--fdc-muted);background:transparent;font:500 8px/1 var(--fdc-font);cursor:pointer; }.section-action:hover,.section-actions button:hover,.category-action:hover,.token-menu-trigger:hover { color:var(--fdc-ink);background:var(--fdc-elevated);border-color:var(--fdc-line); }.section-action svg,.category-action svg,.token-menu-trigger svg { width:12px;height:12px; }.type-presets button { width:28px;padding:0; }.category-action { margin-left:auto; }.inspector-heading .property-count { margin-left:4px; }
  .token-menu-wrap { position:relative;display:flex;align-items:center;margin-top:4px; }.token-menu-trigger { width:28px;padding:0; }.token-menu { position:absolute;z-index:8;top:32px;right:0;width:232px;max-height:220px;overflow:auto;padding:4px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-elevated);box-shadow:0 16px 36px rgb(0 0 0 / 38%); }.token-menu[hidden] { display:none; }.token-option { width:100%;height:32px;display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:center;gap:8px;padding:0 8px;border:0;border-radius:4px;color:var(--fdc-ink);background:transparent;text-align:left;cursor:pointer; }.token-option:hover { background:var(--fdc-subtle); }.token-option .swatch { width:12px;height:12px;border:1px solid rgb(255 255 255 / 14%);border-radius:4px;background:var(--token-color); }.token-option span { overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px; }.token-option span small { margin-left:8px;color:var(--fdc-muted);font:500 8px/1 var(--fdc-font);text-transform:uppercase; }.token-option code { color:var(--fdc-muted);font:400 8px/1 var(--fdc-font); }
  .color-picker-trigger { width:100%;height:32px;display:flex;align-items:center;gap:8px;padding:0 32px 0 8px;border:0;background:transparent;color:var(--fdc-ink);font:400 12px/1 var(--fdc-font);text-align:left;cursor:pointer; }.color-picker-trigger .color-swatch { margin-left:0; }.color-popover { position:fixed;z-index:2147483647;width:280px;padding:12px;border:1px solid var(--fdc-line);border-radius:12px;color:var(--fdc-ink);background:var(--fdc-elevated);box-shadow:0 20px 60px rgb(0 0 0 / 48%);pointer-events:auto; }.color-popover[hidden] { display:none; }.color-popover-head { height:28px;display:flex;align-items:center;margin-bottom:8px; }.color-popover-head strong { font-size:12px;font-weight:550; }.color-popover-head button { margin-left:auto; }.color-plane { position:relative;width:100%;height:152px;overflow:hidden;border-radius:8px;background:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),hsl(var(--picker-hue) 100% 50%);cursor:crosshair;touch-action:none; }.color-plane-handle { position:absolute;width:12px;height:12px;transform:translate(-50%,-50%);border:4px solid white;border-radius:50%;box-shadow:0 1px 4px #000;pointer-events:none; }.color-sliders { display:grid;gap:8px;margin-top:8px; }.color-sliders label { display:grid;grid-template-columns:36px minmax(0,1fr);align-items:center;gap:8px;color:var(--fdc-muted);font-size:8px; }.color-sliders input[type="range"] { width:100%;accent-color:var(--fdc-signal); }.color-fields { display:grid;grid-template-columns:minmax(0,1fr) 36px;gap:8px;margin-top:8px; }.color-fields input { min-width:0;height:32px;padding:0 8px;border:1px solid var(--fdc-line);border-radius:4px;color:var(--fdc-ink);background:var(--fdc-paper);font:400 12px/1 var(--fdc-font);outline:none; }.color-fields button { height:32px;display:grid;place-items:center;padding:0;border:1px solid var(--fdc-line);border-radius:4px;color:var(--fdc-muted);background:var(--fdc-paper);cursor:pointer; }.color-fields button:hover { color:var(--fdc-ink); }.color-fields svg { width:12px;height:12px; }.color-popover-section { margin-top:12px;padding-top:8px;border-top:1px solid var(--fdc-line); }.color-popover-section strong { display:block;margin-bottom:8px;color:var(--fdc-muted);font-size:8px;font-weight:500;text-transform:uppercase;letter-spacing:.04em; }.color-swatches { display:flex;flex-wrap:wrap;gap:8px; }.color-swatches button { width:24px;height:24px;padding:0;border:1px solid rgb(255 255 255 / 16%);border-radius:4px;background:var(--picker-swatch);cursor:pointer; }.color-swatches button:hover { box-shadow:0 0 0 4px var(--fdc-signal); }
  .typography-popover { position:fixed;z-index:2147483647;width:360px;max-width:calc(100vw - 16px);max-height:min(560px,calc(100vh - 16px));overflow:hidden;display:flex;flex-direction:column;border:1px solid var(--fdc-line);border-radius:12px;color:var(--fdc-ink);background:var(--fdc-elevated);box-shadow:0 20px 60px rgb(0 0 0 / 48%);pointer-events:auto; }.typography-popover[hidden] { display:none; }.typography-popover-head { min-height:44px;display:flex;align-items:center;gap:8px;padding:0 8px 0 12px;border-bottom:1px solid var(--fdc-line); }.typography-popover-head>span { width:28px;height:28px;display:grid;place-items:center;border-radius:8px;color:#9ec5ff;background:var(--fdc-signal-soft); }.typography-popover-head>span svg { width:16px;height:16px; }.typography-popover-head strong { font-size:12px;font-weight:550; }.typography-popover-head small { margin-left:4px;color:var(--fdc-muted);font-size:8px; }.typography-popover-head button { margin-left:auto; }.typography-search { padding:8px 12px;border-bottom:1px solid var(--fdc-line); }.typography-search input { width:100%;height:36px;padding:0 12px;border:1px solid var(--fdc-line);border-radius:8px;color:var(--fdc-ink);background:var(--fdc-paper);font:400 12px/1 var(--fdc-font);outline:none; }.typography-search input:focus { border-color:var(--fdc-signal);box-shadow:0 0 0 4px color-mix(in srgb,var(--fdc-signal) 18%,transparent); }.typography-fonts { min-height:0;overflow:auto;padding:8px; }.typography-group+.typography-group { margin-top:12px;padding-top:12px;border-top:1px solid var(--fdc-line); }.typography-group-head { display:flex;align-items:center;min-height:24px;padding:0 4px 4px; }.typography-group-head strong { color:var(--fdc-muted);font-size:8px;font-weight:550; }.typography-group-head span { margin-left:auto;color:var(--fdc-muted);font:400 8px/1 var(--fdc-font-mono); }.typography-font-row { width:100%;min-height:52px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px;border:0;border-radius:8px;color:var(--fdc-ink);background:transparent;text-align:left;cursor:pointer; }.typography-font-row:hover,.typography-font-row:focus-visible { background:var(--fdc-subtle);outline:0; }.typography-font-row.active { background:var(--fdc-signal-soft); }.typography-font-copy { min-width:0;display:grid;gap:4px; }.typography-font-copy strong { overflow:hidden;text-overflow:ellipsis;font-size:16px;line-height:20px;font-weight:450;white-space:nowrap; }.typography-font-copy span { overflow:hidden;text-overflow:ellipsis;color:var(--fdc-muted);font-size:8px;line-height:12px;white-space:nowrap; }.typography-font-meta { padding:4px 8px;border-radius:4px;color:var(--fdc-muted);background:var(--fdc-paper);font:400 8px/1 var(--fdc-font-mono); }.typography-local-empty { display:grid;gap:8px;padding:12px;border:1px dashed var(--fdc-line);border-radius:8px; }.typography-local-empty p { margin:0;color:var(--fdc-muted);font-size:12px;line-height:16px; }.typography-local-empty button { justify-self:start;height:32px;padding:0 12px;border:1px solid var(--fdc-line);border-radius:8px;color:var(--fdc-ink);background:var(--fdc-paper);font-size:12px;cursor:pointer; }.typography-local-empty button:hover { background:var(--fdc-subtle); }.typography-preview-note { display:flex;align-items:flex-start;gap:8px;padding:8px 12px;border-top:1px solid var(--fdc-line);color:var(--fdc-muted);font-size:8px;line-height:12px; }.typography-preview-note svg { width:12px;height:12px;flex:none; }.typography-preview-note strong { color:var(--fdc-ink);font-weight:550; }
  .typography-google-plan { display:grid;gap:8px;margin-top:8px;padding:12px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-paper); }.typography-google-plan>div:first-child { display:grid;gap:4px; }.typography-google-plan>div:first-child strong { font-size:12px;font-weight:550; }.typography-google-plan>div:first-child span { color:var(--fdc-muted);font-size:12px;line-height:16px; }.typography-strategies { display:grid;grid-template-columns:1fr 1fr;gap:4px; }.typography-strategies button { min-width:0;min-height:48px;display:grid;grid-template-columns:minmax(0,1fr) 12px;align-items:center;gap:4px;padding:8px;border:1px solid var(--fdc-line);border-radius:4px;color:var(--fdc-ink);background:var(--fdc-surface);text-align:left;cursor:pointer; }.typography-strategies button:hover,.typography-strategies button[aria-checked="true"] { border-color:var(--fdc-signal);background:var(--fdc-signal-soft); }.typography-strategies button>span { min-width:0;display:grid;gap:4px; }.typography-strategies strong { font-size:12px;font-weight:550; }.typography-strategies small { overflow:hidden;color:var(--fdc-muted);font-size:8px;line-height:12px;text-overflow:ellipsis;white-space:nowrap; }.typography-strategies svg { width:12px;height:12px;color:var(--fdc-signal); }.typography-strategies button[aria-checked="false"] svg { visibility:hidden; }.typography-review-font { height:32px;border:1px solid var(--fdc-ink);border-radius:8px;color:var(--fdc-paper);background:var(--fdc-ink);font-size:12px;font-weight:550;cursor:pointer; }.typography-review-font:hover { opacity:.88; }
  .typography-strategies button { min-height:64px;align-items:start; }.typography-strategies small { overflow:visible;line-height:12px;text-overflow:clip;white-space:normal; }
  .typography-google-summary { display:grid;gap:4px;padding-bottom:8px;border-bottom:1px solid var(--fdc-line); }.typography-google-summary strong { font-size:16px;line-height:20px;font-weight:550; }.typography-google-summary span { color:var(--fdc-muted);font-size:8px;line-height:12px; }.typography-choice-section { display:grid;gap:8px; }.typography-choice-label { color:var(--fdc-muted);font-size:8px;line-height:12px;font-weight:550; }.typography-weight-options { display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px; }.typography-weight-options button,.typography-style-options button { min-width:0;height:32px;border:1px solid var(--fdc-line);border-radius:4px;color:var(--fdc-muted);background:var(--fdc-surface);font:400 8px/1 var(--fdc-font-mono);cursor:pointer; }.typography-weight-options button:hover,.typography-style-options button:hover,.typography-weight-options button[aria-checked="true"],.typography-style-options button[aria-checked="true"] { border-color:var(--fdc-signal);color:var(--fdc-signal);background:var(--fdc-signal-soft); }.typography-style-options { display:grid;grid-template-columns:1fr 1fr;gap:4px; }.typography-style-options button { font-family:var(--fdc-font);font-size:12px; }.typography-axis-list { max-height:208px;overflow:auto;display:grid;gap:4px;padding-right:4px; }.typography-axis { min-height:40px;display:grid;grid-template-columns:92px minmax(0,1fr) 40px;align-items:center;gap:8px;padding:4px 8px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-surface); }.typography-axis>span { min-width:0;display:grid;grid-template-columns:32px minmax(0,1fr);align-items:baseline;gap:4px; }.typography-axis strong { font:550 8px/1 var(--fdc-font-mono); }.typography-axis small { overflow:hidden;color:var(--fdc-muted);font-size:8px;line-height:12px;text-overflow:ellipsis;white-space:nowrap; }.typography-axis input { width:100%;height:16px;margin:0;accent-color:var(--fdc-signal); }.typography-axis output { color:var(--fdc-ink);font:400 8px/1 var(--fdc-font-mono);text-align:right; }.typography-subsets { display:flex;flex-wrap:wrap;gap:4px; }.typography-subsets span { padding:4px 8px;border:1px solid var(--fdc-line);border-radius:4px;color:var(--fdc-muted);background:var(--fdc-surface);font:400 8px/1 var(--fdc-font-mono);text-transform:capitalize; }
  .typography-source-plan { display:grid;gap:8px;padding:8px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-elevated); }.typography-source-plan-head { display:flex;align-items:center;gap:8px; }.typography-source-plan-head strong { font-size:12px;line-height:16px;font-weight:550; }.typography-source-plan-head span { margin-left:auto;color:var(--fdc-muted);font:400 8px/12px var(--fdc-font-mono); }.typography-source-plan code { overflow-wrap:anywhere;padding:8px;border-radius:4px;color:var(--fdc-ink);background:var(--fdc-subtle);font:400 8px/12px var(--fdc-font-mono); }.typography-source-plan ol { display:grid;gap:4px;margin:0;padding-left:20px;color:var(--fdc-muted);font-size:8px;line-height:12px; }.typography-source-plan-foot { display:flex;align-items:flex-start;gap:8px;padding-top:8px;border-top:1px solid var(--fdc-line);color:var(--fdc-muted);font-size:8px;line-height:12px; }.typography-source-plan-foot svg { width:12px;height:12px;flex:none;color:var(--fdc-signal); }.typography-source-plan[data-requires-assets="true"] .typography-source-plan-foot svg { color:#d08b43; }
  .typography-diagnostics { display:grid;gap:8px;margin-bottom:12px;padding:12px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-paper); }.typography-diagnostics-head { display:grid;gap:4px; }.typography-diagnostics-head strong { font-size:12px;font-weight:550; }.typography-diagnostics-head span { color:var(--fdc-muted);font:400 8px/12px var(--fdc-font-mono); }.typography-diagnostic-list { display:grid;gap:4px; }.typography-diagnostic { display:grid;grid-template-columns:16px minmax(0,1fr);align-items:start;gap:8px;padding:8px;border:1px solid #634236;border-radius:4px;color:#efb39e;background:#2b201d; }.typography-diagnostic[data-severity="warning"] { border-color:#62502d;color:#e5c477;background:#29251b; }.typography-diagnostic>svg { width:12px;height:12px;place-self:center; }.typography-diagnostic>span { min-width:0;display:grid;gap:4px; }.typography-diagnostic strong { font-size:12px;line-height:16px;font-weight:550; }.typography-diagnostic small { color:var(--fdc-muted);font-size:8px;line-height:12px; }.typography-diagnostic-clear { display:flex;align-items:center;gap:8px;padding:8px;border-radius:4px;color:#74c7aa;background:#182922;font-size:8px;line-height:12px; }.typography-diagnostic-clear svg { width:12px;height:12px;flex:none; }:host([data-interface-theme="light"]) .typography-diagnostic { border-color:#efc5b7;color:#8b4431;background:#fff3ee; }:host([data-interface-theme="light"]) .typography-diagnostic[data-severity="warning"] { border-color:#ead69f;color:#735714;background:#fff9e8; }:host([data-interface-theme="light"]) .typography-diagnostic-clear { color:#236c59;background:#eef8f4; }
  .typography-lab { display:grid;gap:12px;margin-bottom:12px;padding:12px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-paper); }.typography-lab-head { display:grid;gap:4px; }.typography-lab-head strong { font-size:12px;font-weight:550; }.typography-lab-head span { color:var(--fdc-muted);font-size:12px;line-height:16px; }.typography-treatment-options { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px; }.typography-treatment { min-width:0;height:64px;display:grid;align-content:center;gap:4px;padding:8px;border:1px solid var(--fdc-line);border-radius:8px;color:var(--fdc-ink);background:var(--fdc-elevated);text-align:left;cursor:pointer; }.typography-treatment:hover,.typography-treatment:focus-visible,.typography-treatment[aria-pressed="true"] { border-color:var(--fdc-signal);background:var(--fdc-signal-soft);outline:0; }.typography-treatment strong { font-size:12px;font-weight:550; }.typography-treatment span { overflow:hidden;color:var(--fdc-muted);font-size:12px;line-height:16px;text-overflow:ellipsis;white-space:nowrap; }.typography-lab-actions { display:flex;align-items:center;gap:8px; }.typography-lab-actions button { height:32px;padding:0 12px;border:1px solid var(--fdc-line);border-radius:8px;color:var(--fdc-ink);background:var(--fdc-elevated);font-size:12px;cursor:pointer; }.typography-lab-actions button.primary { margin-left:auto;color:white;background:var(--fdc-signal);border-color:var(--fdc-signal); }.typography-lab-actions button:disabled { opacity:.42;cursor:default; }.typography-scale { display:grid;gap:8px;padding-top:12px;border-top:1px solid var(--fdc-line); }.typography-scale-row { display:grid;grid-template-columns:72px minmax(0,1fr) 40px;align-items:center;gap:8px; }.typography-scale-row>span { color:var(--fdc-muted);font-size:12px; }.typography-scale-row input[type="range"] { width:100%;accent-color:var(--fdc-signal); }.typography-scale-row output { font:400 12px/16px var(--fdc-font-mono);text-align:right; }.typography-scale-ratios,.typography-scale-steps { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px; }.typography-scale-steps { grid-template-columns:repeat(5,minmax(0,1fr)); }.typography-scale-ratios button,.typography-scale-steps button { height:28px;padding:0;border:1px solid var(--fdc-line);border-radius:4px;color:var(--fdc-muted);background:var(--fdc-elevated);font:400 12px/1 var(--fdc-font-mono);cursor:pointer; }.typography-scale-ratios button[aria-pressed="true"],.typography-scale-steps button[aria-pressed="true"] { color:var(--fdc-ink);border-color:var(--fdc-signal);background:var(--fdc-signal-soft); }.typography-scale-result { display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px;border-radius:4px;background:var(--fdc-elevated); }.typography-scale-result code { overflow:hidden;color:var(--fdc-muted);font:400 12px/16px var(--fdc-font-mono);text-overflow:ellipsis;white-space:nowrap; }.typography-scale-result button { height:28px;padding:0 8px;border:0;border-radius:4px;color:var(--fdc-ink);background:var(--fdc-subtle);font-size:12px;cursor:pointer; }
  .typography-project-style { display:grid;gap:8px;padding-top:12px;border-top:1px solid var(--fdc-line); }.typography-style-name { display:grid;gap:4px;color:var(--fdc-muted);font-size:8px;line-height:12px; }.typography-style-name input { width:100%;height:36px;padding:0 12px;border:1px solid var(--fdc-line);border-radius:8px;color:var(--fdc-ink);background:var(--fdc-elevated);font:400 12px/16px var(--fdc-font-mono);outline:none; }.typography-style-name input:focus { border-color:var(--fdc-signal);box-shadow:0 0 0 4px color-mix(in srgb,var(--fdc-signal) 18%,transparent); }.typography-validation-plan { display:grid;gap:4px;padding:8px;border-radius:8px;background:var(--fdc-elevated); }.typography-validation-plan strong { font-size:8px;line-height:12px;font-weight:550; }.typography-validation-plan span { color:var(--fdc-muted);font-size:8px;line-height:12px; }.typography-style-list { display:grid;gap:4px; }.typography-style-row { min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-elevated); }.typography-style-copy { min-width:0;display:grid;gap:4px; }.typography-style-copy strong { overflow:hidden;font-size:12px;line-height:16px;font-weight:550;text-overflow:ellipsis;white-space:nowrap; }.typography-style-copy span { overflow:hidden;color:var(--fdc-muted);font:400 8px/12px var(--fdc-font-mono);text-overflow:ellipsis;white-space:nowrap; }.typography-style-actions { display:flex;gap:4px; }.typography-style-actions button { width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:4px;color:var(--fdc-muted);background:transparent;cursor:pointer; }.typography-style-actions button:hover,.typography-style-actions button:focus-visible { color:var(--fdc-ink);background:var(--fdc-subtle);outline:0; }.typography-style-actions svg { width:12px;height:12px; }
  .review-summary { background:var(--fdc-paper); }.review-before { color:var(--fdc-muted);background:var(--fdc-subtle); }.review-sample { color:var(--fdc-muted);background:var(--fdc-paper);border-color:var(--fdc-line); }.review-sample::after { color:var(--fdc-muted);background:rgb(28 28 31 / 88%); }
  .confidence-pill { color:#9ec5ff;background:var(--fdc-signal-soft); }.confidence-pill.unresolved { color:#f2ae8f;background:#42271d; }
  .session-status,.session-status.saved { color:#83d8bb;background:#18352c; }.session-status.saving { color:#efd979;background:#3d3417; }.session-status.error,.session-status.offline { color:#f0a18b;background:#40251f; }
  .empty-state-icon { color:#9ec5ff;background:var(--fdc-signal-soft); }.onboarding-card-head span { color:#e7a68c;background:#36231d; }
  .change-count { color:var(--fdc-ink);background:var(--fdc-paper); }
  .compare-bar button:hover { color:var(--fdc-ink);background:var(--fdc-subtle); }
  .compare-bar button.active { color:#141416;background:#f0f1f3; }
  .toast { color:#141416;background:#f0f1f3;border:1px solid #ffffff;box-shadow:0 8px 20px rgb(0 0 0 / 30%); }
  .change-dock .dock-review,.footer .review,.review-actions .apply,.onboarding-actions .onboarding-start,.health-actions .health-fix,.health-footer .health-rescan,.memory-card-actions button:first-child,.empty-state-actions button:first-child { color:#141416;background:#f0f1f3;border-color:#f0f1f3; }.change-dock .dock-review:hover,.footer .review:hover,.review-actions .apply:hover { color:#141416;background:#ffffff; }
  .panel-resizer::after { background:#4a4a50; }
  .empty-state { min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 32px;text-align:center; }.empty-state-icon { width:40px;height:40px;display:grid;place-items:center;margin-bottom:16px;border-radius:12px; }.empty-state-icon svg { width:16px;height:16px; }.empty-state strong { font-size:12px;font-weight:550;letter-spacing:-.01em; }.empty-state p { max-width:232px;margin:8px 0 0;color:var(--fdc-muted);font-size:12px;line-height:1.55; }.empty-state-actions { display:flex;align-items:center;gap:8px;margin-top:16px; }.empty-state-actions button { height:32px;padding:0 12px;border:1px solid var(--fdc-line);border-radius:8px;font-size:12px;cursor:pointer; }.empty-state kbd { margin-top:12px;color:var(--fdc-muted);font:400 8px/1.4 var(--fdc-font); }
  .review-head strong { font-size:12px; }.review-summary { padding:12px 16px 12px;border-bottom:1px solid var(--fdc-line);background:#fcfcfc; }.review-summary strong { display:block;font-size:12px;font-weight:550;letter-spacing:-.01em; }.review-summary span { display:block;margin-top:4px;color:var(--fdc-muted);font-size:12px;line-height:1.45; }.review-summary.attention strong { color:#8b4d3d; }.review-toolbar button { height:28px;padding:0 8px;font-size:12px; }
  .onboarding-card { bottom:84px;width:340px;padding:16px;border-radius:12px;box-shadow:0 16px 40px rgb(0 0 0 / 15%); }.onboarding-card-head { gap:8px; }.onboarding-card-head span { width:28px;height:28px;display:grid;place-items:center;color:#a75031;background:#fbf1ed;border-radius:8px; }.onboarding-card-head svg { width:16px;height:16px;color:inherit; }.onboarding-card-head strong { font-size:12px;letter-spacing:-.015em; }.onboarding-card>p { margin:8px 0 16px;font-size:12px;line-height:1.55; }.onboarding-steps { display:grid;grid-template-columns:1fr;gap:1px;border:1px solid var(--fdc-line);border-radius:8px;overflow:hidden;background:var(--fdc-line); }.onboarding-step { display:grid;grid-template-columns:24px 1fr;gap:8px;padding:8px 12px;background:white;text-align:left; }.onboarding-step b { color:#8a8a8a;font-size:8px;font-weight:500;letter-spacing:.04em; }.onboarding-step strong { display:block;font-size:12px;font-weight:550; }.onboarding-step small { display:block;margin-top:4px;color:var(--fdc-muted);font-size:8px;line-height:1.35; }.onboarding-actions { gap:8px;margin-top:12px; }.onboarding-actions button { height:32px;padding:0 12px;border-radius:8px;font-size:12px; }
  .onboarding-card,.onboarding-step { color:var(--fdc-ink);background:var(--fdc-surface); }.onboarding-card-head span { color:#e7a68c;background:#36231d; }.onboarding-actions button { color:var(--fdc-ink);background:var(--fdc-elevated);border-color:var(--fdc-line); }.onboarding-actions .onboarding-start { color:#141416;background:#f0f1f3;border-color:#f0f1f3; }
  .status-popover { width:256px; }.status-popover-actions { display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:8px; }.status-popover .status-popover-actions button { height:32px;margin:0; }.status-popover .status-popover-actions [data-status-retry],.status-popover .status-popover-actions [data-status-repair] { grid-column:1/-1; }
  .onboarding-card { width:360px; }.onboarding-card-head>strong { flex:1; }.onboarding-card-head .onboarding-close { width:28px;height:28px;display:grid;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--fdc-muted);cursor:pointer; }.onboarding-card-head .onboarding-close:hover { color:var(--fdc-ink);background:var(--fdc-subtle); }.onboarding-card-head .onboarding-close svg { width:12px;height:12px; }.onboarding-steps { gap:4px;border:0;overflow:visible;background:transparent; }.onboarding-step { min-height:40px;grid-template-columns:24px minmax(0,1fr);align-items:center;gap:8px;padding:8px;border:1px solid var(--fdc-line);border-radius:8px; }.onboarding-step b { width:20px;height:20px;display:grid;place-items:center;border:1px solid var(--fdc-line);border-radius:50%;color:var(--fdc-muted);font:500 8px/1 var(--fdc-font);letter-spacing:0; }.onboarding-step b svg { width:12px;height:12px; }.onboarding-step.complete>b { color:#141416;background:#8ae0c2;border-color:#8ae0c2; }.onboarding-step.current { border-color:var(--fdc-signal);box-shadow:0 0 0 4px rgb(59 130 246 / 10%); }
  .review-summary { color:var(--fdc-ink);background:var(--fdc-paper); }.empty-state-icon { color:#9ec5ff;background:var(--fdc-signal-soft); }
  .component-card,.health-card { color:var(--fdc-ink);background:var(--fdc-surface);border-color:var(--fdc-line); }.component-card.selected { color:var(--fdc-ink);background:var(--fdc-component-soft);border-color:var(--fdc-ink);box-shadow:0 0 0 4px rgb(255 255 255 / 8%); }.component-variants span,.component-actions button,.component-variants button { color:var(--fdc-ink);background:var(--fdc-component-soft);border-color:var(--fdc-line); }.health-score::before { background:var(--fdc-surface); }.health-filters button { color:var(--fdc-muted); }.health-filters button:hover,.health-filters button.active { color:var(--fdc-ink);background:var(--fdc-elevated);border-color:var(--fdc-line); }.health-card p,.health-evidence { color:var(--fdc-muted); }.mapping-chooser { color:#f0c9a8;background:#35291d;border-color:#665039; }.mapping-chooser>strong,.mapping-option,.mapping-option small { color:#e7c29f; }.review-card.locating { background:var(--fdc-signal-soft); }.baseline-badge { color:#83d8bb;background:#18352c; }
  /* Workspace ownership */
  .workspace-bar { position:fixed;z-index:2147483647;top:12px;left:50%;min-height:48px;display:flex;align-items:center;gap:4px;padding:8px;transform:translateX(-50%);color:var(--fdc-ink);background:rgb(28 28 31 / 96%);border:1px solid var(--fdc-line);border-radius:12px;box-shadow:0 4px 4px rgb(0 0 0 / 20%),0 16px 36px rgb(0 0 0 / 34%);backdrop-filter:blur(16px);pointer-events:auto; }.workspace-bar .brand { flex:none;padding:0 8px; }.workspace-bar .brand-copy b { font-size:12px; }.workspace-bar .session-status { margin:0; }.workspace-actions { display:flex;align-items:center;gap:4px; }.workspace-divider { width:1px;height:24px;background:var(--fdc-line); }.workspace-bar .icon-button { width:36px;height:36px; }.workspace-bar .icon-button.active { color:#9ec5ff;background:var(--fdc-signal-soft); }.workspace-bar .status-popover { top:44px;right:auto;left:60px; }
  .panel { top:72px;bottom:12px;max-height:none;overflow:clip; }.panel[hidden] { display:none; }.inspector-head { min-height:44px;display:flex;align-items:center;gap:8px;padding:0 8px 0 12px;border-bottom:1px solid var(--fdc-line);background:var(--fdc-surface); }.inspector-head strong { font-size:12px;font-weight:550; }.inspector-head span { color:var(--fdc-muted);font-size:8px; }.inspector-head .icon-button { margin-left:auto; }.controls { min-height:0;flex:1; }.inspector-baseline { padding:0 12px 8px;border-bottom:1px solid var(--fdc-line); }.inspector-category { border-bottom:1px solid var(--fdc-line); }.inspector-category>.inspector-heading { position:sticky;top:0;z-index:2;height:44px;padding:0 8px 0 4px;background:rgb(28 28 31 / 97%); }.inspector-category>.inspector-heading .section-toggle { min-height:44px; }.inspector-category>.inspector-heading .section-toggle>svg { width:16px;height:16px;color:var(--fdc-muted);transform:none; }.inspector-category.collapsed>.category-body { display:none; }.inspector-category.collapsed>.inspector-heading .section-toggle>svg { transform:rotate(-90deg); }.inspector-category .property-section { margin-left:12px;border-left:1px solid var(--fdc-line); }.inspector-category .property-section .section-head { padding-left:8px; }.inspector-category[data-category="position"]>.category-body>.property-section>.section-head { display:none; }.category-body>.context-tools,.category-body>.native-panel,.category-body>.design-health { margin-left:12px; }
  .inspector-scroll { min-width:0;min-height:0;flex:1;overflow-x:hidden;overflow-y:auto;background:var(--fdc-surface); }
  .inspector-scroll::-webkit-scrollbar { width:8px; }
  .inspector-scroll::-webkit-scrollbar-track { background:transparent; }
  .inspector-scroll::-webkit-scrollbar-thumb { background:#4a4a50;border-radius:1000px; }
  .inspector-scroll::-webkit-scrollbar-thumb:hover { background:#626269; }
  .inspector-scroll>.selection,.inspector-scroll>.scope,.inspector-scroll>.controls { width:100%;box-sizing:border-box; }
  .inspector-scroll>.controls { min-height:0;overflow:visible;flex:none; }
  /* Fluid inspector controls */
  .inspector-category .property-section { width:100%;margin-left:0;border-left:0; }
  .inspector-category .property-section .section-head { padding-left:12px; }
  .category-body>.context-tools,.category-body>.native-panel { width:100%;margin-left:0; }
  .category-body>.design-health { width:auto;margin:12px 16px 0; }
  .section-grid { width:100%;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:12px 16px 16px;box-sizing:border-box; }
  .section-grid.stacked { grid-template-columns:minmax(0,1fr); }
  .section-grid:not(.stacked)>:last-child:nth-child(odd) { grid-column:1/-1; }
  .property-control { min-width:0;display:flex;flex-direction:column;align-items:stretch;gap:8px; }
  .property-control .property-label { min-height:12px;line-height:12px; }
  .property-control .control-field { width:100%;height:36px; }
  .property-control input,.property-control select { height:32px; }
  .section-grid.two { grid-template-columns:repeat(2,minmax(0,1fr));gap:8px; }
  .section-grid.two .compact-control { position:relative;display:block; }
  .compact-control .field-prefix,.compact-control .field-prefix.wide { width:44px;min-width:44px;box-sizing:border-box;padding-left:12px; }
  .section-grid.two .control-field { width:100%;height:36px; }
  .section-grid.two .compact-control input,.section-grid.two .compact-control select { height:32px; }
  .control-field>.control-reset { position:absolute;z-index:2;top:4px;right:4px;width:24px;height:24px; }
  .control-field>input { padding-right:32px; }
  .control-field:has(>select:not(.unit-select))>.control-reset { right:32px; }
  .control-field:has(>select:not(.unit-select))>select:not(.unit-select) { padding-right:56px!important; }
  .control-field:has(>.unit-select)>.control-reset { right:48px; }
  .control-field:has(>.unit)>.control-reset { right:24px; }
  /* Consistent inset chevrons for every select input */
  select { -webkit-appearance:none;appearance:none;padding-right:32px!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none' stroke='%238f8f96' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 6.5 3 3 3-3'/%3E%3C/svg%3E")!important;background-repeat:no-repeat!important;background-position:right 8px center!important;background-size:16px 16px!important; }
  .control-field .unit-select { width:48px;padding-right:20px!important;padding-left:4px!important;background-position:right 4px center!important;background-size:16px 16px!important; }
  .layers-panel { top:72px;bottom:auto;max-height:min(560px,calc(100vh - 84px)); }.layers-panel[hidden] { display:none; }.layers-switch { flex:none; }
  /* Compact tree rhythm: rows use the panel width while hierarchy remains legible. */
  .layer-tree { padding:4px 4px;scrollbar-gutter:auto;scrollbar-width:thin;scrollbar-color:#4a4a50 transparent; }
  .layer-tree::-webkit-scrollbar { width:8px; }
  .layer-tree::-webkit-scrollbar-track { background:transparent; }
  .layer-tree::-webkit-scrollbar-thumb { background:#4a4a50;border-radius:1000px; }
  .layer-row { padding-left:calc(4px + var(--layer-depth) * 12px);padding-right:4px; }
  .layer-selection-glide { right:4px;left:4px; }
  .layer-toggle,.layer-select { height:32px; }
  .layer-select { padding-right:4px;padding-left:4px; }
  .layer-row .layer-meta { margin-right:4px; }
  .component-list { padding-right:0;padding-left:0; }
  .component-main { padding-right:8px;padding-left:8px; }
  .component-variants,.component-actions { padding-right:8px;padding-left:40px; }
  /* Keep every inspector field on the same 36px interaction rhythm. */
  .property-control .control-field,.section-grid.two .control-field,.compact-control .control-field { height:36px; }
  .property-control input,.property-control select,.section-grid.two .compact-control input,.section-grid.two .compact-control select { height:36px; }
  .control-field>.control-reset { top:4px; }
  .utility-panel { z-index:2147483646;max-height:none;min-width:280px;min-height:280px;box-shadow:0 4px 4px rgb(0 0 0 / 22%),0 20px 48px rgb(0 0 0 / 42%); }.utility-panel[hidden] { display:none; }.utility-handle { cursor:grab;user-select:none;touch-action:none; }.utility-handle:active { cursor:grabbing; }.utility-resizer { position:absolute;right:4px;bottom:4px;width:20px;height:20px;padding:0;border:0;background:transparent;cursor:nwse-resize; }.utility-resizer::after { content:"";position:absolute;right:4px;bottom:4px;width:8px;height:8px;border-right:1px solid var(--fdc-muted);border-bottom:1px solid var(--fdc-muted); }.health-panel,.library-panel { right:auto;max-height:none; }.health-list,.library-body { min-height:0;flex:1; }
  .change-tray { position:fixed;z-index:2147483646;right:var(--fdc-canvas-right,376px);bottom:12px;left:var(--fdc-canvas-left,276px);min-height:0;display:flex;flex-direction:column;align-items:stretch;padding:0;overflow:hidden;color:var(--fdc-ink);background:var(--fdc-surface);border:1px solid var(--fdc-line);border-radius:12px;box-shadow:0 4px 4px rgb(0 0 0 / 22%),0 20px 48px rgb(0 0 0 / 36%);pointer-events:auto; }.change-tray[hidden] { display:none; }.change-tray-summary { min-height:48px;display:grid;grid-template-columns:minmax(0,1fr) auto 32px 72px;align-items:center;gap:8px;padding:8px 8px 8px 12px; }.change-tray-summary .change-count { margin-right:4px; }.change-tray-summary button { height:32px;border:1px solid var(--fdc-line);border-radius:8px;color:var(--fdc-ink);background:var(--fdc-elevated);cursor:pointer; }.change-tray-summary .tray-compare { width:32px;display:grid;place-items:center;padding:0; }.change-tray-summary .tray-compare svg { width:12px;height:12px; }.change-tray-summary button:disabled { opacity:.35;cursor:not-allowed; }.change-tray.expanded { height:min(420px,45vh); }.change-tray.expanded .change-tray-summary { border-bottom:1px solid var(--fdc-line); }.change-tray .review-view:not([hidden]) { min-width:0;min-height:0;display:flex; }.change-tray .review-body { min-height:0;flex:1;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));align-content:start;overflow:auto; }.change-tray .review-group { min-width:0;border-right:1px solid var(--fdc-line); }.change-tray .review-actions { flex:none;grid-template-columns:100px minmax(180px,280px);justify-content:end; }.change-tray .review-head { flex:none; }.change-tray .review-head span { margin-left:auto; }
  /* Focused review list */
  .change-tray .review-body { display:block;overflow-x:hidden;overflow-y:auto; }
  .review-overview { position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:12px;min-height:52px;padding:8px 12px;border-bottom:1px solid var(--fdc-line);background:rgb(20 20 22 / 97%);backdrop-filter:blur(12px); }
  .review-overview .review-summary { min-width:0;flex:1;padding:0;border:0;background:transparent; }
  .review-overview .review-summary strong { overflow:hidden;text-overflow:ellipsis;font-size:12px;white-space:nowrap; }
  .review-overview .review-summary span { overflow:hidden;text-overflow:ellipsis;margin-top:4px;font-size:8px;white-space:nowrap; }
  .review-overview .review-toolbar { position:static;z-index:auto;flex:none;padding:0;border:0;background:transparent;backdrop-filter:none; }
  .review-overview .review-toolbar button { height:28px;padding:0 8px;border-color:transparent;background:transparent;color:var(--fdc-muted);font-size:8px; }
  .review-overview .review-toolbar button:hover { color:var(--fdc-ink);background:var(--fdc-elevated);border-color:var(--fdc-line); }
  .review-agent { display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:12px;margin:12px 16px 0;padding:12px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-paper); }
  .review-agent>i { width:8px;height:8px;border-radius:50%;background:#d16d51; }
  .review-agent.connected>i { background:#2ca67f;box-shadow:0 0 0 4px rgb(44 166 127 / 12%); }
  .review-agent strong,.review-agent span { display:block; }
  .review-agent strong { font-size:12px;font-weight:600; }
  .review-agent span { margin-top:4px;color:var(--fdc-muted);font-size:12px;line-height:1.45; }
  .review-agent button { height:32px;padding:0 12px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-elevated);color:var(--fdc-ink);font-size:12px;cursor:pointer; }
  .review-agent button:hover { border-color:var(--fdc-muted); }
  .change-tray .review-group { border-right:0;border-bottom:1px solid var(--fdc-line); }
  .change-tray .review-group-title { position:sticky;top:52px;z-index:2;min-height:40px;padding:0 12px;background:rgb(28 28 31 / 98%); }
  .review-group-title .included-count { font-size:8px; }
  .review-card { min-height:52px;grid-template-columns:20px minmax(0,1fr);align-items:start;gap:8px;padding:8px 12px; }
  .review-card input[type="checkbox"] { margin-top:8px; }
  .review-card-line { min-height:32px;display:grid;grid-template-columns:minmax(120px,1fr) auto minmax(220px,320px) 32px;align-items:center;gap:8px; }
  .review-card-line>strong { font-size:12px; }
  .review-values { min-width:0;display:grid;grid-template-columns:minmax(72px,1fr) 12px minmax(92px,1fr);align-items:center;gap:4px;margin:0; }
  .review-before { min-width:0;overflow:hidden;text-overflow:ellipsis;padding:0 8px;color:var(--fdc-muted);background:transparent;font-size:12px;text-align:right;white-space:nowrap; }
  .review-after { height:32px;font-size:12px; }
  .review-more { position:relative;justify-self:end; }
  .review-more>summary { width:28px;height:28px;display:grid;place-items:center;border:1px solid transparent;border-radius:4px;color:var(--fdc-muted);font:600 12px/1 var(--fdc-font);letter-spacing:1px;list-style:none;cursor:pointer; }
  .review-more>summary::-webkit-details-marker { display:none; }
  .review-more>summary:hover,.review-more[open]>summary { color:var(--fdc-ink);background:var(--fdc-elevated);border-color:var(--fdc-line); }
  .review-more .review-card-tools { position:absolute;z-index:5;right:0;top:32px;width:260px;display:flex;flex-direction:column;gap:4px;padding:4px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-elevated);box-shadow:0 12px 24px rgb(0 0 0 / 34%); }
  .review-more .review-card-tools button { width:100%;height:28px;padding:0 8px;border:0;text-align:left;background:transparent; }
  .review-more .review-card-tools button { display:flex;align-items:center;gap:8px; }
  .review-more .review-card-tools button svg { width:16px;height:16px;flex:none; }
  .review-more .review-card-tools button[data-review-delete]:not(:disabled) { color:#d16d51; }
  .review-more .review-card-tools button:hover { background:var(--fdc-subtle); }
  .review-details { margin-top:4px;padding-top:4px;border-top:1px solid var(--fdc-line); }
  .review-details summary { min-height:28px;display:flex;align-items:center;padding:0 8px;color:var(--fdc-muted);font-size:8px;cursor:pointer; }
  .review-details[open] { padding-bottom:8px; }
  .review-details .review-source,.review-details .impact-list { padding-right:8px;padding-left:8px; }
  .review-visual { display:none; }
  @media (max-width:980px){.review-card-line{grid-template-columns:minmax(100px,1fr) auto minmax(192px,260px) 32px}.review-overview .review-summary span{display:none}}
  @media (max-width:760px){.review-card-line{grid-template-columns:minmax(0,1fr) auto 32px}.review-values{grid-column:1/-1;width:100%}.review-overview{align-items:flex-start}.review-overview .review-toolbar{margin-left:auto}.review-overview .review-toolbar button{padding:0 8px}}
  .tool-shelf { bottom:calc(20px + var(--fdc-tray-lift,0px)); }.tool-select[hidden],.tool-divider[hidden] { display:none; }.tool-select.interact.active { color:white;background:var(--fdc-signal); }.mode-copy { min-width:88px; }.canvas-actions-divider { margin-left:4px; }.multi-actions-divider { margin-left:4px; }
  .compare-bar { bottom:calc(80px + var(--fdc-tray-lift,0px)); }
  @keyframes fdc-selection-title { from { opacity:.45;transform:translateY(4px) } to { opacity:1;transform:none } }
  @media (max-width:680px){.workspace-bar{right:8px;left:8px;transform:none;overflow-x:auto}.workspace-bar .brand{padding-right:4px}.workspace-bar .brand-copy{display:none}.workspace-bar .status-popover{position:fixed;top:68px;right:8px;left:8px;width:auto}.panel{top:calc(76px + min(32vh,220px));right:8px;bottom:76px;left:8px;width:auto;max-height:none}.layers-panel{top:68px;right:8px;bottom:auto;left:8px;width:auto;max-height:min(32vh,220px)}.utility-panel{top:68px!important;right:8px!important;bottom:76px!important;left:8px!important;width:auto!important;height:auto!important;max-height:none}.utility-resizer{display:none}.scope{display:grid;grid-template-columns:1fr 1fr}.controls{min-height:172px}.change-tray{right:8px;bottom:8px;left:8px}.change-tray.expanded{height:48vh}.change-tray .review-body{grid-template-columns:1fr}.tool-shelf{right:8px;bottom:calc(8px + var(--fdc-tray-lift,0px));left:8px;transform:none;max-width:none}.mode-copy{min-width:0}.mode-copy span{display:none}.tool-select::after,.tab::after{display:none}.onboarding-card{right:12px;bottom:68px;left:12px;width:auto;transform:none}.workbench-controls select,.workbench-controls button:not(.icon-button){max-width:92px}.workbench-matrix{grid-template-columns:76px repeat(var(--matrix-columns),minmax(92px,1fr))}}
  /* Shared dock geometry and focused review takeover. */
  .panel,.layers-panel,.change-tray { width:var(--fdc-dock-width,384px); }
  .layers-panel { max-width:min(520px,calc(100vw - 24px)); }
  .change-tray { z-index:2147483647;top:68px;right:auto;bottom:auto;left:var(--fdc-canvas-center,50vw);height:48px;min-height:48px;transform:translateX(-50%); }
  .change-tray-summary { min-height:48px;grid-template-columns:minmax(0,1fr) 32px 72px; }
  .tool-shelf { bottom:20px; }
  .compare-bar { bottom:80px; }
  .review-takeover { position:fixed;z-index:2147483647;inset:0;display:grid;place-items:center;padding:24px;background:rgb(8 8 10 / 72%);backdrop-filter:blur(8px);pointer-events:auto; }
  .review-takeover[hidden] { display:none; }
  .review-modal { width:min(1120px,calc(100vw - 48px));height:min(760px,calc(100vh - 48px));display:flex;overflow:hidden;color:var(--fdc-ink);background:var(--fdc-surface);border:1px solid var(--fdc-line);border-radius:12px;box-shadow:0 24px 80px rgb(0 0 0 / 52%); }
  .review-modal .review-view { width:100%;min-width:0;min-height:0;display:flex; }
  .review-modal .review-head { flex:none;min-height:52px;padding:0 16px; }
  .review-modal .review-body { min-height:0;flex:1;display:block;overflow-x:hidden;overflow-y:auto; }
  .review-modal .review-group { border-right:0;border-bottom:1px solid var(--fdc-line); }
  .review-modal .review-group-title { position:sticky;top:52px;z-index:2;background:rgb(28 28 31 / 98%); }
  .review-modal .review-actions { position:sticky;bottom:0;flex:none;grid-template-columns:100px minmax(220px,320px);justify-content:end;padding:12px 16px;background:rgb(28 28 31 / 98%);backdrop-filter:blur(12px); }
  /* Review is a reading surface, so it uses a larger type scale than the dense inspector. */
  .review-modal .review-head strong { font-size:16px;font-weight:600;letter-spacing:-.015em; }
  .review-modal .review-head span { font-size:12px; }
  .review-modal .review-overview { min-height:60px;padding:12px 16px; }
  .review-modal .review-overview .review-summary strong { font-size:16px;font-weight:600; }
  .review-modal .review-overview .review-summary span { margin-top:4px;font-size:12px;line-height:1.45; }
  .review-modal .review-overview .review-toolbar button { height:36px;padding:0 12px;font-size:12px; }
  .review-modal .review-group-title { min-height:48px;padding:0 16px;font-size:12px; }
  .review-modal .review-group-title strong { font-size:16px;font-weight:600; }
  .review-modal .review-group-title .included-count,.review-modal .review-group-title .group-total { font-size:12px; }
  .review-modal .review-card { min-height:64px;gap:12px;padding:12px 16px; }
  .review-modal .review-card input[type="checkbox"] { width:16px;height:16px;margin-top:8px; }
  .review-modal .review-card-line { min-height:36px;gap:12px; }
  .review-modal .review-card-line>strong { font-size:16px;font-weight:550; }
  .review-modal .confidence-pill { padding:4px 8px;font-size:12px; }
  .review-modal .review-before { padding:0 8px;font-size:12px; }
  .review-modal .review-after { height:36px;padding:0 12px;font-size:12px; }
  .review-modal .review-more>summary { width:32px;height:32px;font-size:12px; }
  .review-modal .review-more .review-card-tools { top:36px; }
  .review-modal .review-more .review-card-tools button { height:32px;padding:0 8px;font-size:12px; }
  .review-modal .review-details summary { min-height:32px;font-size:12px; }
  .review-modal .review-source,.review-modal .review-context,.review-modal .verification-context { font-size:12px;line-height:1.5; }
  .review-modal .impact-list,.review-modal .impact-list li { font-size:12px;line-height:1.5; }
  .review-modal .review-actions button { min-height:44px;font-size:12px;font-weight:550; }
  .review-modal .run-state strong { font-size:16px; }
  .review-modal .run-summary p { font-size:12px; }
  .review-modal .run-step strong,.review-modal .result-row { font-size:12px; }
  .review-modal .run-step p,.review-modal .run-files { font-size:12px; }
  .interface-theme-menu { position:fixed;z-index:2147483647;width:164px;padding:4px;border:1px solid var(--fdc-line);border-radius:8px;color:var(--fdc-ink);background:var(--fdc-elevated);box-shadow:0 16px 36px rgb(0 0 0 / 34%);pointer-events:auto; }
  .interface-theme-menu[hidden] { display:none; }
  .interface-theme-menu button { width:100%;height:32px;display:grid;grid-template-columns:minmax(0,1fr) 16px;align-items:center;padding:0 8px;border:0;border-radius:4px;color:var(--fdc-muted);background:transparent;font-size:12px;text-align:left;cursor:pointer; }
  .interface-theme-menu button:hover { color:var(--fdc-ink);background:var(--fdc-subtle); }
  .interface-theme-menu button[aria-checked="true"] { color:var(--fdc-ink);background:var(--fdc-subtle); }
  .interface-theme-menu button svg { width:12px;height:12px;color:var(--fdc-signal); }
  .interface-theme-menu button:not([aria-checked="true"]) svg { visibility:hidden; }
  :host([data-interface-theme="light"]) { color-scheme:light;--fdc-ink:#141416;--fdc-paper:#f0f1f3;--fdc-surface:#ffffff;--fdc-subtle:#f0f1f3;--fdc-elevated:#f7f7f8;--fdc-line:#dedfe2;--fdc-signal:#2563eb;--fdc-signal-soft:#e8f0ff;--fdc-component:var(--fdc-ink);--fdc-component-soft:var(--fdc-subtle);--fdc-muted:#666870; }
  :host([data-interface-theme="light"]) .component-workshop-panel { color:var(--fdc-ink);background:rgb(255 255 255 / 97%);border-color:var(--fdc-line);box-shadow:0 1px 4px rgb(0 0 0 / 8%),0 16px 36px rgb(0 0 0 / 14%); }
  :host([data-interface-theme="light"]) .panel,:host([data-interface-theme="light"]) .layers-panel,:host([data-interface-theme="light"]) .health-panel,:host([data-interface-theme="light"]) .library-panel,:host([data-interface-theme="light"]) .tool-shelf,:host([data-interface-theme="light"]) .onboarding-card,:host([data-interface-theme="light"]) .compare-bar,:host([data-interface-theme="light"]) .command-palette,:host([data-interface-theme="light"]) .status-popover,:host([data-interface-theme="light"]) .canvas-variant,:host([data-interface-theme="light"]) .workspace-bar,:host([data-interface-theme="light"]) .change-tray,:host([data-interface-theme="light"]) .review-modal { color:var(--fdc-ink);background:rgb(255 255 255 / 97%);border-color:var(--fdc-line);box-shadow:0 1px 4px rgb(0 0 0 / 8%),0 16px 36px rgb(0 0 0 / 14%); }
  :host([data-interface-theme="light"]) .fdc-select-menu { color:var(--fdc-ink);background:rgb(255 255 255 / 98%);border-color:var(--fdc-line);box-shadow:0 1px 4px rgb(0 0 0 / 8%),0 16px 36px rgb(0 0 0 / 14%); }
  :host([data-interface-theme="light"]) .top,:host([data-interface-theme="light"]) .top-actions,:host([data-interface-theme="light"]) .selection,:host([data-interface-theme="light"]) .scope,:host([data-interface-theme="light"]) .controls,:host([data-interface-theme="light"]) .property-section,:host([data-interface-theme="light"]) .change-dock,:host([data-interface-theme="light"]) .footer,:host([data-interface-theme="light"]) .review-view,:host([data-interface-theme="light"]) .review-head,:host([data-interface-theme="light"]) .review-group,:host([data-interface-theme="light"]) .review-group-title,:host([data-interface-theme="light"]) .review-actions,:host([data-interface-theme="light"]) .layers-head,:host([data-interface-theme="light"]) .layer-tree,:host([data-interface-theme="light"]) .health-head,:host([data-interface-theme="light"]) .health-list,:host([data-interface-theme="light"]) .health-footer,:host([data-interface-theme="light"]) .library-head,:host([data-interface-theme="light"]) .library-actions,:host([data-interface-theme="light"]) .library-body,:host([data-interface-theme="light"]) .memory-card,:host([data-interface-theme="light"]) .context-tools,:host([data-interface-theme="light"]) .native-panel,:host([data-interface-theme="light"]) .section-head,:host([data-interface-theme="light"]) .onboarding-step { color:var(--fdc-ink);background:var(--fdc-surface);border-color:var(--fdc-line); }
  :host([data-interface-theme="light"]) .inspector-heading,:host([data-interface-theme="light"]) .review-toolbar,:host([data-interface-theme="light"]) .review-overview,:host([data-interface-theme="light"]) .review-modal .review-actions { color:var(--fdc-ink);background:rgb(255 255 255 / 97%);border-color:var(--fdc-line); }
  :host([data-interface-theme="light"]) .review-modal .review-group-title { background:rgb(247 247 248 / 98%); }
  :host([data-interface-theme="light"]) .property-label,:host([data-interface-theme="light"]) .section-head,:host([data-interface-theme="light"]) .color-value,:host([data-interface-theme="light"]) .layer-row,:host([data-interface-theme="light"]) .command-item,:host([data-interface-theme="light"]) .library-section-head { color:#303136; }
  :host([data-interface-theme="light"]) .selection-path button,:host([data-interface-theme="light"]) .control-field,:host([data-interface-theme="light"]) .native-search,:host([data-interface-theme="light"]) .layers-search input,:host([data-interface-theme="light"]) .review-after,:host([data-interface-theme="light"]) .review-toolbar button,:host([data-interface-theme="light"]) .review-card-tools button,:host([data-interface-theme="light"]) .review-actions button,:host([data-interface-theme="light"]) .change-dock button,:host([data-interface-theme="light"]) .footer button,:host([data-interface-theme="light"]) .status-popover button,:host([data-interface-theme="light"]) .health-actions button,:host([data-interface-theme="light"]) .health-footer button,:host([data-interface-theme="light"]) .context-tools button,:host([data-interface-theme="light"]) .native-chip,:host([data-interface-theme="light"]) .variant-button,:host([data-interface-theme="light"]) .library-actions button,:host([data-interface-theme="light"]) .memory-card-actions button,:host([data-interface-theme="light"]) .empty-state-actions button,:host([data-interface-theme="light"]) .onboarding-actions button { color:var(--fdc-ink);background:var(--fdc-elevated);border-color:var(--fdc-line); }
  :host([data-interface-theme="light"]) .scope select,:host([data-interface-theme="light"]) .property-control input,:host([data-interface-theme="light"]) .property-control select,:host([data-interface-theme="light"]) .compact-control input,:host([data-interface-theme="light"]) .compact-control select,:host([data-interface-theme="light"]) .native-search,:host([data-interface-theme="light"]) .command-palette input { color:var(--fdc-ink);background:var(--fdc-surface);border-color:var(--fdc-line); }
  :host([data-interface-theme="light"]) .scope select option,:host([data-interface-theme="light"]) .property-control select option,:host([data-interface-theme="light"]) .compact-control select option { color:var(--fdc-ink);background:var(--fdc-surface); }
  :host([data-interface-theme="light"]) .layers-search,:host([data-interface-theme="light"]) .layers-switch,:host([data-interface-theme="light"]) .review-summary { background:var(--fdc-paper);border-color:var(--fdc-line); }
  :host([data-interface-theme="light"]) .layers-switch button:hover,:host([data-interface-theme="light"]) .layers-switch button.active,:host([data-interface-theme="light"]) .health-filters button:hover,:host([data-interface-theme="light"]) .health-filters button.active { color:var(--fdc-ink);background:var(--fdc-surface); }
  :host([data-interface-theme="light"]) .component-card,:host([data-interface-theme="light"]) .health-card { color:var(--fdc-ink);background:var(--fdc-surface);border-color:var(--fdc-line); }
  :host([data-interface-theme="light"]) .layer-row.selected { color:#1458b8;background:transparent; }
  :host([data-interface-theme="light"]) .layer-row .layer-meta { color:#65676e;background:var(--fdc-subtle); }
  :host([data-interface-theme="light"]) .layer-row.selected .layer-meta { color:#1458b8;background:#dceaff; }
  :host([data-interface-theme="light"]) .tool-select.active,:host([data-interface-theme="light"]) .tab.active { color:var(--fdc-ink);background:#e4e5e8; }
  :host([data-interface-theme="light"]) .tool-select.inspect.active { color:white;background:var(--fdc-signal); }
  :host([data-interface-theme="light"]) .change-dock .dock-review,:host([data-interface-theme="light"]) .review-actions .apply,:host([data-interface-theme="light"]) .health-footer .health-rescan { color:#f0f1f3;background:#141416;border-color:#141416; }
  :host([data-interface-theme="light"]) .session-status,:host([data-interface-theme="light"]) .session-status.saved { color:#236c59;background:#eef8f4; }
  :host([data-interface-theme="light"]) .interface-theme-menu { color:var(--fdc-ink);background:var(--fdc-surface);border-color:var(--fdc-line);box-shadow:0 16px 36px rgb(0 0 0 / 16%); }
  .control-field { height:36px;border-radius:8px; }
  .compact-control .field-prefix,.compact-control .field-prefix.wide { width:36px;min-width:36px;height:100%;display:grid;place-items:center;padding:0;border-right:1px solid var(--fdc-line);background:rgb(255 255 255 / 2%);color:var(--fdc-muted);font:500 12px/1 var(--fdc-font); }
  .field-prefix svg { width:12px;height:12px; }
  .property-control input,.property-control select,.compact-control input,.compact-control select { height:36px;font-size:12px;font-weight:400; }
  .control-field .unit-select { width:44px;padding-right:24px!important;background-position:right 8px center!important; }
  .section-grid { gap:8px;padding:0 16px 16px; }
  .inspector-category[data-category="position"]>.category-body>.property-section>.section-grid { padding-top:12px; }
  @media (max-width:680px){.panel,.layers-panel{width:auto}.panel-resizer{display:none}.change-tray{top:68px;right:8px;bottom:auto;left:8px;width:calc(100vw - 16px);transform:none}.review-takeover{padding:8px}.review-modal{width:calc(100vw - 16px);height:calc(100vh - 16px);border-radius:12px}.review-modal .review-actions{grid-template-columns:84px 1fr}}
  :host([data-embedded="true"]) .workspace-bar,
  :host([data-embedded="true"]) .interface-theme-menu,
  :host([data-embedded="true"]) .status-popover,
  :host([data-embedded="true"]) .layers-panel,
  :host([data-embedded="true"]) .health-panel,
  :host([data-embedded="true"]) .panel,
  :host([data-embedded="true"]) .change-tray,
  :host([data-embedded="true"]) .review-takeover,
  :host([data-embedded="true"]) .tool-shelf,
  :host([data-embedded="true"]) .onboarding-card,
  :host([data-embedded="true"]) .compare-bar,
  :host([data-embedded="true"]) .command-palette,
  :host([data-embedded="true"]) .color-popover,
  :host([data-embedded="true"]) .typography-popover,
  :host([data-embedded="true"]) .library-panel,
  :host([data-embedded="true"]) .workbench,
  :host([data-embedded="true"]) .comparison-stage,
  :host([data-embedded="true"]) .canvas-variant { display:none!important; }
  @media (prefers-reduced-motion:reduce){*{transition-duration:.01ms!important}.layer-row.entering,.layer-branch{animation:none!important}}
`;

function numberFrom(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pxControl(
  element: HTMLElement,
  computed: CSSStyleDeclaration,
  category: Category,
  property: keyof CSSStyleDeclaration,
  label: string,
  max = 600,
  min = 0,
): Control {
  return {
    category,
    property: String(property),
    label,
    kind: 'number',
    value: numberFrom(String(computed[property])),
    unit: 'px',
    min,
    max,
    step: 1,
    read: () => numberFrom(getComputedStyle(element)[property] as string),
    apply: (value) =>
      element.style.setProperty(
        String(property).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
        `${value}px`,
      ),
  };
}

function styleControl(
  element: HTMLElement,
  computed: CSSStyleDeclaration,
  category: Category,
  property: keyof CSSStyleDeclaration,
  label: string,
  kind: ControlKind = 'text',
  options?: string[],
): Control {
  return {
    category,
    property: String(property),
    label,
    kind,
    options,
    value: String(computed[property]),
    read: () => String(getComputedStyle(element)[property]),
    apply: (value) =>
      element.style.setProperty(
        String(property).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
        String(value),
      ),
  };
}

function effectStyleControl(
  element: HTMLElement,
  computed: CSSStyleDeclaration,
  property: 'boxShadow' | 'filter' | 'backdropFilter',
  label: string,
): Control {
  const control = styleControl(element, computed, 'effects', property, label);
  if (property === 'backdropFilter') {
    control.apply = (value) => {
      element.style.setProperty('backdrop-filter', String(value));
      element.style.setProperty('-webkit-backdrop-filter', String(value));
    };
  }
  return control;
}

function numberStyleControl(
  element: HTMLElement,
  computed: CSSStyleDeclaration,
  category: Category,
  property: keyof CSSStyleDeclaration,
  label: string,
  min: number,
  max: number,
  step: number,
): Control {
  return {
    category,
    property: String(property),
    label,
    kind: 'number',
    value: numberFrom(String(computed[property])),
    min,
    max,
    step,
    read: () => numberFrom(String(getComputedStyle(element)[property])),
    apply: (value) =>
      element.style.setProperty(
        String(property).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
        String(value),
      ),
  };
}

function degreeControl(element: HTMLElement, computed: CSSStyleDeclaration): Control {
  const read = (): number => numberFrom(getComputedStyle(element).rotate || '0');
  return {
    category: 'layout',
    property: 'rotate',
    label: 'Rotation',
    kind: 'number',
    value: numberFrom(computed.rotate || '0'),
    unit: 'deg',
    min: -360,
    max: 360,
    step: 1,
    read,
    apply: (value) => element.style.setProperty('rotate', `${value}deg`),
  };
}

function scaleAxisControl(
  element: HTMLElement,
  computed: CSSStyleDeclaration,
  axis: 'x' | 'y',
): Control {
  const readScale = (): [number, number] => {
    const raw = getComputedStyle(element).scale;
    if (!raw || raw === 'none') return [1, 1];
    const values = raw.split(/\s+/).map(numberFrom);
    return [values[0] || 1, values[1] ?? values[0] ?? 1];
  };
  const initial = computed.scale && computed.scale !== 'none' ? readScale() : [1, 1];
  return {
    category: 'layout',
    property: axis === 'x' ? 'scaleX' : 'scaleY',
    label: axis === 'x' ? 'Flip horizontal' : 'Flip vertical',
    kind: 'select',
    options: ['1', '-1'],
    value: String(axis === 'x' ? initial[0] : initial[1]),
    read: () => String(axis === 'x' ? readScale()[0] : readScale()[1]),
    apply: (value) => {
      const current = readScale();
      current[axis === 'x' ? 0 : 1] = Number(value);
      element.style.setProperty('scale', `${current[0]} ${current[1]}`);
    },
  };
}

function sizingModeControl(
  element: HTMLElement,
  computed: CSSStyleDeclaration,
  axis: 'width' | 'height',
): Control {
  const capitalized = axis === 'width' ? 'Width' : 'Height';
  const minProperty = axis === 'width' ? 'minWidth' : 'minHeight';
  const maxProperty = axis === 'width' ? 'maxWidth' : 'maxHeight';
  const mode = (): string =>
    detectSizingMode(
      element.style[axis] || String(computed[axis]),
      computed.flexGrow,
      String(getComputedStyle(element)[minProperty]),
      String(getComputedStyle(element)[maxProperty]),
    );
  return {
    category: 'layout',
    property: `${axis}Mode`,
    label: `${capitalized} behavior`,
    kind: 'select',
    options: ['fixed', 'hug', 'fill', 'min-max'],
    value: mode(),
    read: mode,
    apply: (value) => {
      const next = String(value);
      const rect = element.getBoundingClientRect();
      if (next === 'fixed') {
        element.style[axis] = `${Math.round(rect[axis])}px`;
        element.style.flexGrow = '0';
      }
      if (next === 'hug') {
        element.style[axis] = 'max-content';
        element.style.flex = '0 0 auto';
      }
      if (next === 'fill') {
        element.style[axis] = '100%';
        element.style.flex = '1 1 0';
      }
      if (next === 'min-max') {
        const minimum = String(getComputedStyle(element)[minProperty] || '0px');
        const maximum = String(getComputedStyle(element)[maxProperty] || '100%');
        element.style[axis] =
          `clamp(${minimum}, ${Math.round(rect[axis])}px, ${maximum === 'none' ? '100%' : maximum})`;
      }
    },
  };
}

function controlsFor(element: HTMLElement): Control[] {
  const computed = getComputedStyle(element);
  const controls: Control[] = [
    ...(computed.position !== 'static'
      ? [
          pxControl(element, computed, 'layout', 'left', 'X position', 5000, -5000),
          pxControl(element, computed, 'layout', 'top', 'Y position', 5000, -5000),
        ]
      : []),
    sizingModeControl(element, computed, 'width'),
    sizingModeControl(element, computed, 'height'),
    styleControl(element, computed, 'layout', 'minWidth', 'Minimum width'),
    styleControl(element, computed, 'layout', 'maxWidth', 'Maximum width'),
    styleControl(element, computed, 'layout', 'aspectRatio', 'Aspect ratio'),
    styleControl(element, computed, 'layout', 'overflow', 'Overflow', 'select', [
      'visible',
      'hidden',
      'clip',
      'auto',
      'scroll',
    ]),
    degreeControl(element, computed),
    scaleAxisControl(element, computed, 'x'),
    scaleAxisControl(element, computed, 'y'),
    pxControl(element, computed, 'layout', 'width', 'Width', 1600),
    pxControl(element, computed, 'layout', 'height', 'Height', 1200),
    styleControl(element, computed, 'layout', 'display', 'Display', 'select', [
      'block',
      'inline',
      'inline-block',
      'flex',
      'grid',
      'none',
    ]),
    styleControl(element, computed, 'layout', 'position', 'Position', 'select', [
      'static',
      'relative',
      'absolute',
      'fixed',
      'sticky',
    ]),
    pxControl(element, computed, 'layout', 'gap', 'Gap', 160),
    pxControl(element, computed, 'layout', 'rowGap', 'Row gap', 160),
    pxControl(element, computed, 'layout', 'columnGap', 'Column gap', 160),
    pxControl(element, computed, 'layout', 'paddingTop', 'Padding top', 240),
    pxControl(element, computed, 'layout', 'paddingRight', 'Padding right', 240),
    pxControl(element, computed, 'layout', 'paddingBottom', 'Padding bottom', 240),
    pxControl(element, computed, 'layout', 'paddingLeft', 'Padding left', 240),
    pxControl(element, computed, 'layout', 'marginTop', 'Margin top', 240),
    pxControl(element, computed, 'layout', 'marginRight', 'Margin right', 240),
    pxControl(element, computed, 'layout', 'marginBottom', 'Margin bottom', 240),
    pxControl(element, computed, 'layout', 'marginLeft', 'Margin left', 240),
    pxControl(element, computed, 'typography', 'fontSize', 'Font size', 200),
    styleControl(element, computed, 'typography', 'fontFamily', 'Font family'),
    styleControl(element, computed, 'typography', 'fontWeight', 'Font weight'),
    styleControl(element, computed, 'typography', 'lineHeight', 'Line height'),
    styleControl(element, computed, 'typography', 'letterSpacing', 'Letter spacing'),
    styleControl(element, computed, 'typography', 'fontStyle', 'Font style', 'select', [
      'normal',
      'italic',
      'oblique',
    ]),
    styleControl(element, computed, 'typography', 'textTransform', 'Text transform', 'select', [
      'none',
      'uppercase',
      'lowercase',
      'capitalize',
    ]),
    styleControl(element, computed, 'typography', 'fontVariationSettings', 'Variable axes'),
    styleControl(element, computed, 'typography', 'textAlign', 'Text align', 'select', [
      'left',
      'center',
      'right',
      'justify',
    ]),
    styleControl(element, computed, 'color', 'color', 'Text color', 'color'),
    styleControl(element, computed, 'color', 'backgroundColor', 'Background', 'color'),
    numberStyleControl(element, computed, 'color', 'opacity', 'Opacity', 0, 1, 0.05),
    styleControl(element, computed, 'color', 'backgroundImage', 'Gradient'),
    pxControl(element, computed, 'effects', 'borderRadius', 'Corner radius', 200),
    pxControl(element, computed, 'effects', 'borderTopLeftRadius', 'Top left radius', 200),
    pxControl(element, computed, 'effects', 'borderTopRightRadius', 'Top right radius', 200),
    pxControl(element, computed, 'effects', 'borderBottomLeftRadius', 'Bottom left radius', 200),
    pxControl(element, computed, 'effects', 'borderBottomRightRadius', 'Bottom right radius', 200),
    pxControl(element, computed, 'effects', 'borderWidth', 'Border width', 32),
    styleControl(element, computed, 'effects', 'borderColor', 'Border color', 'color'),
    effectStyleControl(element, computed, 'boxShadow', 'Shadow'),
    effectStyleControl(element, computed, 'filter', 'Layer effects'),
    effectStyleControl(element, computed, 'backdropFilter', 'Background effects'),
    {
      category: 'content',
      property: 'textContent',
      label: 'Text',
      kind: 'text',
      value: element.textContent?.trim() ?? '',
      read: () => element.textContent?.trim() ?? '',
      apply: (value) => {
        element.textContent = String(value);
      },
    },
    {
      category: 'accessibility',
      property: 'aria-label',
      label: 'Accessible label',
      kind: 'text',
      value: element.getAttribute('aria-label') ?? '',
      read: () => element.getAttribute('aria-label') ?? '',
      apply: (value) => element.setAttribute('aria-label', String(value)),
    },
    {
      category: 'accessibility',
      property: 'role',
      label: 'Role',
      kind: 'text',
      value: element.getAttribute('role') ?? '',
      read: () => element.getAttribute('role') ?? '',
      apply: (value) => element.setAttribute('role', String(value)),
    },
    {
      category: 'accessibility',
      property: 'tabindex',
      label: 'Tab index',
      kind: 'number',
      value: Number(element.getAttribute('tabindex') ?? 0),
      read: () => Number(element.getAttribute('tabindex') ?? 0),
      apply: (value) => element.setAttribute('tabindex', String(value)),
    },
  ];
  if (computed.display.includes('flex')) {
    controls.push(
      styleControl(element, computed, 'layout', 'flexDirection', 'Direction', 'select', [
        'row',
        'column',
        'row-reverse',
        'column-reverse',
      ]),
      styleControl(element, computed, 'layout', 'flexWrap', 'Wrap', 'select', [
        'nowrap',
        'wrap',
        'wrap-reverse',
      ]),
      styleControl(element, computed, 'layout', 'justifyContent', 'Distribution', 'select', [
        'flex-start',
        'center',
        'flex-end',
        'space-between',
        'space-around',
        'space-evenly',
      ]),
      styleControl(element, computed, 'layout', 'alignItems', 'Alignment', 'select', [
        'stretch',
        'flex-start',
        'center',
        'flex-end',
        'baseline',
      ]),
    );
  }
  if (computed.display.includes('grid')) {
    controls.push(
      styleControl(element, computed, 'layout', 'gridTemplateColumns', 'Grid columns'),
      styleControl(element, computed, 'layout', 'gridTemplateRows', 'Grid rows'),
      styleControl(element, computed, 'layout', 'justifyContent', 'Distribution'),
      styleControl(element, computed, 'layout', 'alignItems', 'Alignment'),
    );
  }
  if (element instanceof HTMLImageElement) {
    controls.push({
      category: 'content',
      property: 'src',
      label: 'Image source',
      kind: 'text',
      value: element.currentSrc || element.src,
      read: () => element.currentSrc || element.src,
      apply: (value) => {
        element.src = String(value);
      },
    });
    controls.push({
      category: 'accessibility',
      property: 'alt',
      label: 'Alternative text',
      kind: 'text',
      value: element.alt,
      read: () => element.alt,
      apply: (value) => {
        element.alt = String(value);
      },
    });
  }
  const textBearing =
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    Boolean(element.textContent?.trim());
  const editableText =
    element.childElementCount === 0 ||
    ['BUTTON', 'A', 'LABEL', 'SUMMARY'].includes(element.tagName);
  return controls.filter((control) => {
    if (control.category === 'typography') return textBearing;
    if (control.property === 'textContent') return textBearing && editableText;
    if (control.property === 'color') return textBearing;
    return true;
  });
}

function colorForInput(value: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d');
  if (!context) return '#000000';
  context.fillStyle = '#000000';
  context.fillStyle = value;
  const normalized = context.fillStyle;
  if (normalized.startsWith('#')) return normalized;
  const channels = normalized
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number);
  if (!channels || channels.length < 3) return '#000000';
  return `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

function hexChannels(value: string): [number, number, number] {
  const hex = colorForInput(value).slice(1);
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function colorAlpha(value: string): number {
  const slash = value.match(/\/\s*([\d.]+)%?\s*\)/);
  if (slash) return value.includes('%') ? Number(slash[1]) / 100 : Number(slash[1]);
  const comma = value.match(/rgba?\([^)]*,\s*([\d.]+)\s*\)$/);
  return comma ? Number(comma[1]) : isTransparentColor(value) ? 0 : 1;
}

function rgbToHsv(red: number, green: number, blue: number): [number, number, number] {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta) {
    if (maximum === r) hue = 60 * (((g - b) / delta) % 6);
    else if (maximum === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return [hue, maximum ? delta / maximum : 0, maximum];
}

function hsvToRgb(hue: number, saturation: number, value: number): [number, number, number] {
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = value - chroma;
  const [r, g, b] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return [r, g, b].map((channel) => Math.round((channel + match) * 255)) as [
    number,
    number,
    number,
  ];
}

function rgbHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0'))
    .join('')}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function displayValue(control: Control): string {
  if (typeof control.value !== 'number') return control.value;
  return String(Math.round(control.value * 100) / 100);
}

function controlOptionLabel(control: Control, option: string): string {
  return option;
}

function renderShadowEffect(
  effect: ShadowEffectValue,
  effectIndex: number,
  controlIndex: number,
): string {
  const label = effect.kind === 'inner-shadow' ? 'Inner shadow' : 'Drop shadow';
  const numberField = (part: 'x' | 'y' | 'blur' | 'spread', prefix: string, value: number) =>
    `<label class="effect-value"><span>${prefix}</span><input type="number" step="1" value="${value}" data-shadow-control="${controlIndex}" data-shadow-index="${effectIndex}" data-shadow-part="${part}" aria-label="${escapeHtml(`${label} ${part}`)}"/></label>`;
  return `<article class="effect-card" data-effect-card="${effect.kind}"><header class="effect-card-head"><span class="effect-symbol"><i data-foundry-icon="box"></i></span><select data-shadow-kind="${effectIndex}" data-shadow-control="${controlIndex}" aria-label="Shadow type"><option value="drop-shadow" ${effect.kind === 'drop-shadow' ? 'selected' : ''}>Drop shadow</option><option value="inner-shadow" ${effect.kind === 'inner-shadow' ? 'selected' : ''}>Inner shadow</option></select><button type="button" class="effect-remove" data-remove-shadow="${effectIndex}" data-shadow-control="${controlIndex}" aria-label="Remove ${label}"><i data-foundry-icon="x"></i></button></header><div class="effect-fields effect-shadow-fields">${numberField('x', 'X', effect.x)}${numberField('y', 'Y', effect.y)}${numberField('blur', 'Blur', effect.blur)}${numberField('spread', 'Spread', effect.spread)}<label class="effect-color"><span>Color</span><span class="effect-color-control"><input type="color" value="${escapeHtml(effect.color)}" data-shadow-control="${controlIndex}" data-shadow-index="${effectIndex}" data-shadow-part="color" aria-label="${label} color"/><input type="number" min="0" max="100" step="1" value="${Math.round(effect.opacity * 100)}" data-shadow-control="${controlIndex}" data-shadow-index="${effectIndex}" data-shadow-part="opacity" aria-label="${label} opacity"/><span>%</span></span></label></div></article>`;
}

function renderBlurEffect(
  label: string,
  kind: 'layer-blur' | 'background-blur',
  amount: number,
  controlIndex: number,
): string {
  return `<article class="effect-card" data-effect-card="${kind}"><header class="effect-card-head"><span class="effect-symbol"><i data-foundry-icon="blur"></i></span><strong>${label}</strong><button type="button" class="effect-remove" data-remove-blur="${kind}" data-blur-control="${controlIndex}" aria-label="Remove ${label}"><i data-foundry-icon="x"></i></button></header><div class="effect-fields"><label class="effect-blur"><span>Blur</span><span class="effect-value"><span>R</span><input type="number" min="0" max="200" step="1" value="${amount}" data-blur-control="${controlIndex}" aria-label="${label} amount"/></span></label></div></article>`;
}

function renderEffectsEditor(entries: { control: Control; index: number }[]): string {
  const shadowEntry = entries.find(({ control }) => control.property === 'boxShadow');
  const filterEntry = entries.find(({ control }) => control.property === 'filter');
  const backdropEntry = entries.find(({ control }) => control.property === 'backdropFilter');
  const shadows = shadowEntry ? parseShadowEffects(String(shadowEntry.control.value)) : [];
  const layerBlur = filterEntry ? blurAmount(String(filterEntry.control.value)) : null;
  const backgroundBlur = backdropEntry ? blurAmount(String(backdropEntry.control.value)) : null;
  const active = [
    ...(shadowEntry
      ? shadows.map((effect, index) => renderShadowEffect(effect, index, shadowEntry.index))
      : []),
    ...(filterEntry && layerBlur != null
      ? [renderBlurEffect('Layer blur', 'layer-blur', layerBlur, filterEntry.index)]
      : []),
    ...(backdropEntry && backgroundBlur != null
      ? [
          renderBlurEffect(
            'Background blur',
            'background-blur',
            backgroundBlur,
            backdropEntry.index,
          ),
        ]
      : []),
  ].join('');
  return `<div class="effects-editor"><div class="effect-stack">${active || '<p class="effect-empty">No effects applied</p>'}</div><details class="effect-add"><summary><i data-foundry-icon="plus"></i>Add effect</summary><div class="effect-menu" role="menu"><button type="button" data-add-effect="drop-shadow" data-effect-control="${shadowEntry?.index ?? ''}" role="menuitem"><i data-foundry-icon="box"></i><span>Drop shadow</span></button><button type="button" data-add-effect="inner-shadow" data-effect-control="${shadowEntry?.index ?? ''}" role="menuitem"><i data-foundry-icon="box"></i><span>Inner shadow</span></button><button type="button" data-add-effect="layer-blur" data-effect-control="${filterEntry?.index ?? ''}" role="menuitem" ${layerBlur != null ? 'disabled' : ''}><i data-foundry-icon="blur"></i><span>Layer blur</span></button><button type="button" data-add-effect="background-blur" data-effect-control="${backdropEntry?.index ?? ''}" role="menuitem" ${backgroundBlur != null ? 'disabled' : ''}><i data-foundry-icon="blur"></i><span>Background blur</span></button><button type="button" role="menuitem" disabled title="Available when the project exposes a mapped effect recipe"><i data-foundry-icon="sparkles"></i><span>Noise</span><small>Recipe</small></button><button type="button" role="menuitem" disabled title="Available when the project exposes a mapped effect recipe"><i data-foundry-icon="layout-grid"></i><span>Texture</span><small>Recipe</small></button></div></details></div>`;
}

function isTransparentColor(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === 'transparent' ||
    /^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(normalized) ||
    /^rgb\([^)]*\/\s*0%?\s*\)$/.test(normalized)
  );
}

function renderControlInput(control: Control, index: number): string {
  const id = `fdc-${index}`;
  if (control.kind === 'select') {
    return `<select id="${id}" data-control="${index}" aria-label="${escapeHtml(control.label)}">${control.options
      ?.map(
        (option) =>
          `<option value="${escapeHtml(option)}" ${String(control.value) === option ? 'selected' : ''}>${escapeHtml(controlOptionLabel(control, option))}</option>`,
      )
      .join('')}</select>`;
  }
  if (control.kind === 'color') {
    const rawValue = String(control.value);
    const value = colorForInput(rawValue);
    const transparent = isTransparentColor(rawValue);
    return `<button type="button" class="color-picker-trigger" id="${id}" data-color-control="${index}" aria-label="Edit ${escapeHtml(control.label)}"><span class="color-swatch ${transparent ? 'transparent' : ''}" style="--swatch-color:${value}"></span><span class="color-value">${transparent ? 'Transparent' : escapeHtml(value.toUpperCase())}</span></button>`;
  }
  const type = control.kind === 'number' ? 'number' : 'text';
  const value = displayValue(control);
  return `<input id="${id}" data-control="${index}" aria-label="${escapeHtml(control.label)}" type="${type}" value="${escapeHtml(value)}" ${control.min != null ? `min="${control.min}"` : ''} ${control.max != null ? `max="${control.max}"` : ''} ${control.step != null ? `step="${control.step}"` : ''}/>`;
}

function renderPropertyControl(control: Control, index: number, prefix?: string): string {
  const unitControl =
    control.kind === 'number' && control.unit && ['px', 'rem', '%'].includes(control.unit)
      ? `<select class="unit-select" data-unit-control="${index}" aria-label="${escapeHtml(control.label)} unit"><option selected>${control.unit}</option>${[
          'px',
          'rem',
          '%',
        ]
          .filter((unit) => unit !== control.unit)
          .map((unit) => `<option>${unit}</option>`)
          .join('')}</select>`
      : control.unit
        ? `<span class="unit">${control.unit}</span>`
        : '';
  const field = `${renderControlInput(control, index)}${unitControl}`;
  const reset = `<button type="button" class="control-reset" data-reset-control="${index}" title="Reset ${escapeHtml(control.label)}" aria-label="Reset ${escapeHtml(control.label)}"><i data-foundry-icon="rotate-ccw"></i></button>`;
  const scrubAttributes =
    control.kind === 'number'
      ? ` data-scrub-for="${index}" title="Drag left or right to adjust ${escapeHtml(control.label)}. Hold Shift for larger steps or Option for finer steps."`
      : '';
  if (prefix) {
    const prefixIcon = prefix === 'Ratio' ? 'maximize-2' : prefix === 'Clip' ? 'box' : undefined;
    const prefixContent = prefixIcon
      ? `<i data-foundry-icon="${prefixIcon}"></i>`
      : escapeHtml(prefix);
    return `<label class="compact-control"><span class="sr-only">${escapeHtml(control.label)}</span><span class="control-field"><span class="field-prefix" aria-hidden="true" title="${escapeHtml(control.label)}"${scrubAttributes}>${prefixContent}</span>${field}${reset}</span></label>`;
  }
  return `<label class="property-control"><span class="property-label"${scrubAttributes}>${escapeHtml(control.label)}</span><span class="control-field">${field}${reset}</span></label>`;
}

export function installFoundryInspector(
  options: FoundryInspectorOptions = {},
): FoundryInspectorController {
  const query = new URLSearchParams(location.search);
  const verificationChild = query.get('__foundry_verification') === '1';
  const componentSpecimen = query.get('__foundry_frame') === 'component-specimen';
  if (query.get('__foundry_child') === '1' && !verificationChild) {
    return {
      inspect() {},
      stopInspecting() {},
      select() {},
      destroy() {},
    };
  }
  const importedRuntime = new URL(import.meta.url);
  const runtimeUrl = (
    options.runtimeUrl ??
    (importedRuntime.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(importedRuntime.hostname)
      ? importedRuntime.origin
      : 'http://127.0.0.1:4387')
  ).replace(/\/$/, '');
  const sessionId = options.sessionId ?? query.get('__foundry_session') ?? '';
  const token = options.token ?? query.get('__foundry_token') ?? '';
  const previewCapability =
    options.previewCapability ?? query.get('__foundry_preview_capability') ?? '';
  const readinessFrameId = crypto.randomUUID();
  const readinessFrameKind = verificationChild
    ? 'verification'
    : query.has('__foundry_responsive_lab')
      ? 'responsive'
      : query.get('__foundry_frame') === 'state-workbench'
        ? 'workbench'
        : 'canvas';
  const embeddedWorkspace =
    (query.get('__foundry_embedded') === '1' || verificationChild) && window.parent !== window;
  const runtimeOrigin = new URL(runtimeUrl).origin;
  const workspaceParentOrigin = verificationChild ? location.origin : runtimeOrigin;
  const host = document.createElement('div');
  const interfaceThemeKey = '__foundry_interface_theme';
  const systemDarkTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const storedInterfaceTheme = localStorage.getItem(interfaceThemeKey);
  let interfaceThemePreference: InterfaceThemePreference =
    storedInterfaceTheme === 'light' || storedInterfaceTheme === 'dark'
      ? storedInterfaceTheme
      : 'system';
  const resolvedInterfaceTheme = (): 'light' | 'dark' =>
    resolveInterfaceTheme(interfaceThemePreference, systemDarkTheme.matches);
  host.dataset.foundryOverlay = 'true';
  host.dataset.embedded = String(embeddedWorkspace);
  host.dataset.interfaceTheme = resolvedInterfaceTheme();
  host.dataset.interfaceThemePreference = interfaceThemePreference;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${PANEL_CSS}</style>
    <div class="outline" hidden><span class="cross"></span><span class="measure"></span></div>
    <div class="hover-outline" hidden></div>
    <header class="workspace-bar" aria-label="Foundry workspace">
      <div class="brand"><span class="brand-copy"><b>Foundry</b></span></div>
      <span class="session-status"><i></i><span>Live</span></span>
      <span class="workspace-divider"></span>
      <nav class="workspace-actions" aria-label="Workspace destinations">
        <button class="icon-button toggle-layers" title="Toggle layers" aria-label="Toggle layers" aria-pressed="true"><i data-foundry-icon="layers-3"></i></button>
        <button class="icon-button open-component-workshop" title="Component workshop" aria-label="Open component workshop" aria-pressed="false"><i data-foundry-icon="component"></i></button>
        <button class="icon-button toggle-inspector" title="Toggle inspector" aria-label="Toggle inspector" aria-pressed="true"><i data-foundry-icon="panels-top-left"></i></button>
        <button class="icon-button open-health" title="Design health" aria-label="Open design health" aria-pressed="false"><i data-foundry-icon="activity"></i></button>
        <button class="icon-button open-workbench" title="State workbench" aria-label="Open state workbench" aria-pressed="false"><i data-foundry-icon="play"></i></button>
        <button class="icon-button open-library" title="Design memory" aria-label="Open design memory" aria-pressed="false"><i data-foundry-icon="bookmark"></i></button>
        <button class="icon-button open-commands" title="Commands" aria-label="Open commands"><i data-foundry-icon="command"></i></button>
        <button class="icon-button interface-theme-trigger" title="Interface theme: System" aria-label="Interface theme: System" aria-haspopup="menu" aria-expanded="false"><i data-foundry-icon="contrast"></i></button>
      </nav>
      <span class="workspace-divider"></span>
      <button class="icon-button close" title="Exit Foundry" aria-label="Exit Foundry"><i data-foundry-icon="x"></i></button>
    </header>
    <div class="interface-theme-menu" role="menu" aria-label="Interface theme" hidden><button role="menuitemradio" aria-checked="true" data-interface-theme-choice="system"><span>System</span><i data-foundry-icon="check"></i></button><button role="menuitemradio" aria-checked="false" data-interface-theme-choice="light"><span>Light</span><i data-foundry-icon="check"></i></button><button role="menuitemradio" aria-checked="false" data-interface-theme-choice="dark"><span>Dark</span><i data-foundry-icon="check"></i></button></div>
    <aside class="layers-panel" aria-label="Foundry layers" hidden>
      <div class="layers-head"><i data-foundry-icon="layers-3"></i><strong>Layers</strong><span data-layer-count></span><button class="icon-button close-layers" aria-label="Close layers"><i data-foundry-icon="x"></i></button></div>
      <div class="layers-search"><input type="search" aria-label="Search layers" placeholder="Search layers" /></div><div class="layer-tree" role="tree" aria-label="Canvas layers"></div>
    </aside>
    <aside class="health-panel utility-panel" data-utility="health" aria-label="Design health" hidden>
      <div class="health-head utility-handle"><i data-foundry-icon="activity"></i><strong>Design health</strong><button class="icon-button close-health" aria-label="Close design health"><i data-foundry-icon="x"></i></button></div>
      <div class="health-summary"></div><div class="health-stress"></div><div class="health-filters" role="group" aria-label="Filter design health issues"></div><div class="health-list"></div><div class="health-footer"><button class="health-show-ignored" hidden></button><button class="health-rescan">Scan again</button></div><button class="utility-resizer" aria-label="Resize design health"></button>
    </aside>
    <aside class="panel" aria-label="Foundry design inspector">
      <div class="inspector-head"><strong>Inspector</strong><span>Selection properties</span><button class="icon-button toggle-inspector inspector-collapse" aria-label="Close inspector"><i data-foundry-icon="x"></i></button></div>
      <div class="inspector-scroll">
        <div class="selection"><div class="selection-heading"><small class="selection-kind">No layer</small><span class="selection-state">Ready</span></div><strong>Nothing selected</strong><code>Click any element to inspect it</code><div class="selection-stats" hidden><span data-selection-size></span><span data-selection-confidence></span></div><div class="selection-path" hidden><button data-select-parent aria-label="Select parent layer"><i data-foundry-icon="chevron-right"></i><span>Parent</span></button><span class="path-name"></span><button data-select-child aria-label="Select first child layer"><span>Child</span><i data-foundry-icon="chevron-down"></i></button></div></div>
        <div class="scope"><label>Scope<select data-scope><option value="instance">Instance</option><option value="variant">Variant</option><option value="component">Component</option></select></label><label>Breakpoint<select data-breakpoint><option value="current">Current</option></select></label><label>Theme<select data-theme><option value="current">Current</option></select></label></div>
        <div class="controls"><div class="empty">Select an element to inspect its measured design controls.</div></div>
      </div>
    </aside>
    <section class="change-dock change-tray" aria-label="Foundry changes" hidden>
      <div class="change-tray-summary"><div class="change-dock-copy"><strong data-dock-count>No changes</strong><span data-dock-last>Edits will appear here</span></div><button class="tray-compare" title="Compare changes" aria-label="Compare changes" disabled><i data-foundry-icon="contrast"></i></button><button class="dock-review">Review</button></div>
    </section>
    <section class="review-takeover" role="dialog" aria-modal="true" aria-label="Review and apply changes" hidden>
      <div class="review-modal"><div class="review-view"><div class="review-head"><button class="review-back" aria-label="Back to canvas"><i data-foundry-icon="arrow-left"></i></button><strong>Review and apply</strong><span class="review-count"></span></div><div class="review-body"></div><div class="review-actions"><button class="review-cancel">Back</button><button class="apply">Apply with agent</button></div></div></div>
    </section>
    <div class="tool-shelf" role="toolbar" aria-label="Canvas tools"><button class="tool-select inspect" data-tooltip="Select" title="Select: click any element" aria-label="Select mode" aria-pressed="true"><i data-foundry-icon="mouse-pointer-2"></i></button><button class="tool-select interact" data-tooltip="Interact" title="Interact with the app" aria-label="Interact mode" aria-pressed="false"><i data-foundry-icon="interact"></i></button></div>
    <div class="toast"></div>`;
  document.body.append(host);
  shadow
    .querySelector<HTMLElement>('.layers-search')!
    .insertAdjacentHTML(
      'beforebegin',
      '<div class="layers-switch" role="tablist" aria-label="Structure view"><button class="active" data-layer-view="layers" role="tab" aria-selected="true">Layers <span data-layer-tab-count>0</span></button><button data-layer-view="components" role="tab" aria-selected="false">Components <span data-component-tab-count>0</span></button></div>',
    );
  const statusPill = shadow.querySelector<HTMLElement>('.session-status')!;
  statusPill.setAttribute('role', 'button');
  statusPill.setAttribute('tabindex', '0');
  statusPill.setAttribute('aria-expanded', 'false');
  statusPill.setAttribute('aria-label', 'Foundry session status');
  statusPill.insertAdjacentHTML(
    'afterend',
    '<div class="status-popover" hidden><strong data-status-title>Session connected</strong><span data-status-detail>Changes are stored locally.</span><code data-status-project></code><code data-status-revision></code><div class="status-popover-actions"><button data-status-checklist>Getting started</button><button data-status-diagnostics>Copy diagnostics</button><button data-status-retry>Check connection</button><button data-status-repair>Copy repair command</button></div></div>',
  );
  shadow
    .querySelector<HTMLElement>('.panel')!
    .insertAdjacentHTML(
      'beforeend',
      '<button class="panel-resizer" aria-label="Resize inspector panel" title="Drag to resize inspector"></button>',
    );
  const onboarding = document.createElement('section');
  onboarding.className = 'onboarding-card';
  onboarding.hidden = true;
  onboarding.setAttribute('aria-label', 'Getting started with Foundry');
  onboarding.innerHTML =
    '<div class="onboarding-card-head"><span><i data-foundry-icon="sparkles"></i></span><strong>Getting started</strong><button class="onboarding-close" aria-label="Close getting started"><i data-foundry-icon="x"></i></button></div><p>Complete one real design loop. Progress stays in this browser and contains no project content.</p><div class="onboarding-steps"></div><div class="onboarding-actions"><button class="onboarding-shortcuts">View shortcuts</button><button class="onboarding-start">Continue</button></div>';
  shadow.append(onboarding);
  const compareBar = document.createElement('div');
  compareBar.className = 'compare-bar';
  compareBar.hidden = true;
  compareBar.setAttribute('aria-label', 'Preview comparison');
  compareBar.innerHTML = `<strong>Compare</strong><button data-compare="before"><i data-foundry-icon="eye-off"></i>Before</button><input data-compare-scrub type="range" min="0" max="100" value="100" aria-label="Scrub between before and after"/><button data-compare="after" class="active"><i data-foundry-icon="eye"></i>After</button><button data-compare="split"><i data-foundry-icon="columns-3"></i>Side by side</button><button data-compare="isolate"><i data-foundry-icon="contrast"></i>Isolate</button><button data-compare="reset"><i data-foundry-icon="rotate-ccw"></i>Reset element</button><button data-compare="close" aria-label="Close comparison"><i data-foundry-icon="x"></i></button>`;
  shadow.append(compareBar);
  const commandPalette = document.createElement('section');
  commandPalette.className = 'command-palette';
  commandPalette.hidden = true;
  commandPalette.setAttribute('aria-label', 'Foundry commands');
  commandPalette.setAttribute('role', 'dialog');
  commandPalette.innerHTML = `<div class="command-search"><input type="search" aria-label="Search commands" placeholder="Type a command"/><button class="icon-button close-commands" aria-label="Close commands" title="Close commands"><i data-foundry-icon="x"></i></button></div><div class="command-list"></div>`;
  shadow.append(commandPalette);
  const colorPopover = document.createElement('section');
  colorPopover.className = 'color-popover';
  colorPopover.hidden = true;
  colorPopover.setAttribute('role', 'dialog');
  colorPopover.setAttribute('aria-label', 'Color editor');
  shadow.append(colorPopover);
  const typographyPopover = document.createElement('section');
  typographyPopover.className = 'typography-popover';
  typographyPopover.hidden = true;
  typographyPopover.setAttribute('role', 'dialog');
  typographyPopover.setAttribute('aria-label', 'Typography Studio');
  shadow.append(typographyPopover);
  const libraryPanel = document.createElement('aside');
  libraryPanel.className = 'library-panel utility-panel';
  libraryPanel.dataset.utility = 'memory';
  libraryPanel.hidden = true;
  libraryPanel.setAttribute('aria-label', 'Foundry design memory');
  libraryPanel.innerHTML = `<div class="library-head utility-handle"><i data-foundry-icon="bookmark"></i><strong>Design memory</strong><span>Local to this project</span><button class="icon-button close-library" aria-label="Close design memory"><i data-foundry-icon="x"></i></button></div><div class="library-actions"><button data-save-recipe disabled><i data-foundry-icon="save"></i>Save treatment</button><button data-capture-baseline disabled><i data-foundry-icon="check"></i>Save baseline</button></div><div class="library-body"></div><button class="utility-resizer" aria-label="Resize design memory"></button>`;
  shadow.append(libraryPanel);
  const componentWorkshopPanel = document.createElement('aside');
  componentWorkshopPanel.className = 'component-workshop-panel utility-panel';
  componentWorkshopPanel.dataset.utility = 'component';
  componentWorkshopPanel.hidden = true;
  componentWorkshopPanel.setAttribute('aria-label', 'Foundry component workshop');
  componentWorkshopPanel.innerHTML = `<div class="component-workshop-head utility-handle"><i data-foundry-icon="component"></i><span><strong>Component workshop</strong><span>Instances, variants, and states</span></span><button class="icon-button close-component-workshop" aria-label="Close component workshop"><i data-foundry-icon="x"></i></button></div><div class="component-workshop-body"></div><div class="component-workshop-actions"><button data-workshop-matrix>Open state matrix</button><button class="primary" data-workshop-review>Review changes</button></div><button class="utility-resizer" aria-label="Resize component workshop"></button>`;
  shadow.append(componentWorkshopPanel);

  shadow
    .querySelector<HTMLElement>('.outline')!
    .insertAdjacentHTML(
      'beforeend',
      ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
        .map(
          (handle) =>
            `<button class="resize-handle" data-handle="${handle}" aria-label="Resize ${handle}"></button>`,
        )
        .join(''),
    );
  shadow
    .querySelector<HTMLElement>('.outline')!
    .insertAdjacentHTML(
      'beforeend',
      '<button class="radius-handle" aria-label="Adjust corner radius" title="Drag to adjust corner radius"></button>',
    );
  const canvasVariant = document.createElement('select');
  canvasVariant.className = 'canvas-variant';
  canvasVariant.hidden = true;
  canvasVariant.setAttribute('aria-label', 'Component variant');
  shadow.append(canvasVariant);
  shadow
    .querySelector<HTMLElement>('.scope')!
    .insertAdjacentHTML(
      'beforeend',
      '<label>State<select data-state><option value="current">Current</option></select></label>',
    );
  shadow
    .querySelector<HTMLElement>('.tool-shelf')!
    .querySelector<HTMLElement>('.interact')!
    .insertAdjacentHTML(
      'afterend',
      '<span class="mode-copy" aria-live="polite"><strong>Select mode</strong><span>Click any element</span></span>',
    );
  shadow
    .querySelector<HTMLElement>('.tool-shelf')!
    .insertAdjacentHTML(
      'beforeend',
      '<span class="tool-divider canvas-actions-divider"></span><button class="tool-select undo" data-tooltip="Undo" aria-label="Undo preview" disabled><i data-foundry-icon="undo-2"></i></button><button class="tool-select redo" data-tooltip="Redo" aria-label="Redo preview" disabled><i data-foundry-icon="redo-2"></i></button><span class="tool-divider multi-actions-divider" hidden></span><button class="tool-select align" data-tooltip="Align" aria-label="Align selected elements" hidden><i data-foundry-icon="align-horizontal-space-around"></i></button><button class="tool-select distribute" data-tooltip="Distribute" aria-label="Distribute selected elements" hidden><i data-foundry-icon="columns-3"></i></button>',
    );
  const workbench = document.createElement('section');
  workbench.className = 'workbench';
  workbench.hidden = true;
  workbench.setAttribute('aria-label', 'Foundry state workbench');
  workbench.innerHTML = `<header class="workbench-head"><strong>State workbench</strong><span class="workbench-context">Live application frame</span><div class="workbench-controls"><button data-workbench-matrix>Matrix</button><select data-workbench-viewport aria-label="Viewport"></select><select data-workbench-theme aria-label="Theme"><option value="current">Current theme</option></select><div data-workbench-states role="group" aria-label="Authored states"></div><button class="icon-button close-workbench" aria-label="Close state workbench"><i data-foundry-icon="x"></i></button></div></header><div class="workbench-stage"><div class="workbench-matrix" hidden></div><div class="frame-shell"><span class="frame-label"></span><iframe title="Foundry live state preview"></iframe></div><div class="workbench-warning" hidden></div></div>`;
  shadow.append(workbench);
  const comparisonStage = document.createElement('section');
  comparisonStage.className = 'comparison-stage';
  comparisonStage.hidden = true;
  comparisonStage.setAttribute('aria-label', 'Side by side comparison');
  comparisonStage.innerHTML = `<header><strong>Before and after</strong><span>Source baseline compared with the current Foundry preview</span><button data-close-comparison-stage aria-label="Close side by side comparison"><i data-foundry-icon="x"></i></button></header><div class="comparison-frames"><div class="comparison-frame"><span>Before</span><iframe data-comparison-before title="Before source preview"></iframe></div><div class="comparison-frame"><span>After</span><iframe data-comparison-after title="After Foundry preview"></iframe></div></div>`;
  shadow.append(comparisonStage);

  function renderIcons(root: HTMLElement | ShadowRoot): void {
    renderKeylineIcons(root);
  }

  let openFdcSelect:
    | {
        select: HTMLSelectElement;
        trigger: HTMLButtonElement;
        menu: HTMLElement;
        typeahead: string;
        typeaheadTimer?: ReturnType<typeof setTimeout>;
      }
    | undefined;
  let fdcSelectId = 0;
  let ignoreFdcSelectScrollUntil = 0;

  function closeFdcSelect(restoreFocus = true): boolean {
    if (!openFdcSelect) return false;
    const { trigger, menu, typeaheadTimer } = openFdcSelect;
    if (typeaheadTimer) clearTimeout(typeaheadTimer);
    trigger.setAttribute('aria-expanded', 'false');
    menu.remove();
    openFdcSelect = undefined;
    if (restoreFocus && trigger.isConnected) trigger.focus();
    return true;
  }

  function syncFdcSelect(select: HTMLSelectElement): void {
    const wrapper = select.parentElement;
    const trigger = wrapper?.querySelector<HTMLButtonElement>('.fdc-select-trigger');
    if (!wrapper || !trigger) return;
    if (wrapper.hidden !== select.hidden) wrapper.hidden = select.hidden;
    if (select.classList.contains('canvas-variant')) {
      wrapper.style.left = select.style.left;
      wrapper.style.top = select.style.top;
    }
    const label = select.selectedOptions[0]?.textContent ?? select.options[0]?.textContent ?? '';
    const value = trigger.querySelector<HTMLElement>('.fdc-select-value');
    if (value && value.textContent !== label) value.textContent = label;
    if (trigger.disabled !== select.disabled) trigger.disabled = select.disabled;
    trigger.setAttribute('aria-disabled', String(select.disabled));
  }

  function positionFdcSelect(trigger: HTMLButtonElement, menu: HTMLElement): void {
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const maxHeight = Math.min(240, window.innerHeight - margin * 2);
    menu.style.minWidth = `${Math.max(160, rect.width)}px`;
    menu.style.maxWidth = `${Math.max(160, window.innerWidth - margin * 2)}px`;
    menu.style.maxHeight = `${maxHeight}px`;
    const left = Math.max(
      margin,
      Math.min(rect.left, window.innerWidth - menu.offsetWidth - margin),
    );
    menu.style.left = `${left}px`;
    const menuHeight = Math.min(menu.scrollHeight, maxHeight);
    const roomBelow = window.innerHeight - rect.bottom - margin;
    const openAbove = roomBelow < menuHeight && rect.top > roomBelow;
    menu.style.top = `${Math.max(
      margin,
      openAbove
        ? rect.top - menuHeight - 4
        : Math.min(rect.bottom + 4, window.innerHeight - menuHeight - margin),
    )}px`;
  }

  function moveFdcSelectFocus(menu: HTMLElement, direction: number | 'first' | 'last'): void {
    const options = [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    if (!options.length) return;
    const current = options.indexOf(shadow.activeElement as HTMLButtonElement);
    const next =
      direction === 'first'
        ? 0
        : direction === 'last'
          ? options.length - 1
          : (current + direction + options.length) % options.length;
    options[next]?.focus({ preventScroll: true });
    options[next]?.scrollIntoView({ block: 'nearest' });
  }

  function openFdcSelectMenu(select: HTMLSelectElement, trigger: HTMLButtonElement): void {
    if (openFdcSelect?.select === select) {
      closeFdcSelect();
      return;
    }
    closeFdcSelect(false);
    ignoreFdcSelectScrollUntil = performance.now() + 250;
    const menu = document.createElement('div');
    menu.className = 'fdc-select-menu';
    menu.id = `${select.id}-listbox`;
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', trigger.getAttribute('aria-label') ?? 'Options');
    menu.innerHTML = [...select.options]
      .map(
        (option, index) =>
          `<button type="button" role="option" data-fdc-option="${index}" aria-selected="${option.selected}" ${option.disabled ? 'disabled' : ''}><span>${escapeHtml(option.textContent)}</span>${option.selected ? '<i data-foundry-icon="check"></i>' : ''}</button>`,
      )
      .join('');
    shadow.append(menu);
    renderIcons(menu);
    trigger.setAttribute('aria-controls', menu.id);
    trigger.setAttribute('aria-expanded', 'true');
    positionFdcSelect(trigger, menu);
    const selected = menu.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    (selected ?? menu.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus({
      preventScroll: true,
    });
    openFdcSelect = { select, trigger, menu, typeahead: '' };
    menu.addEventListener('click', (event) => {
      const option = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-fdc-option]');
      if (!option || option.disabled) return;
      select.selectedIndex = Number(option.dataset.fdcOption);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncFdcSelect(select);
      closeFdcSelect();
    });
  }

  function selectAccessibleLabel(select: HTMLSelectElement): string {
    const explicit = select.getAttribute('aria-label');
    if (explicit) return explicit;
    const wrappingLabel = select.closest('label');
    const textLabel = [...(wrappingLabel?.childNodes ?? [])]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
      .join(' ');
    if (textLabel) return textLabel;
    const visibleLabel = wrappingLabel?.querySelector<HTMLElement>(
      ':scope > span:not(.foundry-select):not(.fdc-select), :scope > strong, :scope > small',
    );
    return visibleLabel?.textContent?.trim() || 'Choose an option';
  }

  function upgradeFdcSelect(select: HTMLSelectElement): void {
    if (select.dataset.foundrySelect === 'true') {
      syncFdcSelect(select);
      return;
    }
    select.dataset.foundrySelect = 'true';
    if (!select.id) select.id = `foundry-overlay-select-${++fdcSelectId}`;
    const wrapper = document.createElement('span');
    wrapper.className = select.classList.contains('canvas-variant')
      ? 'fdc-select fdc-canvas-variant'
      : 'fdc-select';
    select.before(wrapper);
    wrapper.append(select);
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'fdc-select-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const accessibleLabel = selectAccessibleLabel(select);
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    trigger.setAttribute('aria-label', accessibleLabel);
    trigger.innerHTML =
      '<span class="fdc-select-value"></span><i data-foundry-icon="chevron-down"></i>';
    wrapper.append(trigger);
    renderIcons(trigger);
    trigger.addEventListener('click', () => openFdcSelectMenu(select, trigger));
    trigger.addEventListener('keydown', (event) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      if (!openFdcSelect || openFdcSelect.select !== select) openFdcSelectMenu(select, trigger);
      if (!openFdcSelect) return;
      if (event.key === 'ArrowUp') moveFdcSelectFocus(openFdcSelect.menu, -1);
      if (event.key === 'Home') moveFdcSelectFocus(openFdcSelect.menu, 'first');
      if (event.key === 'End') moveFdcSelectFocus(openFdcSelect.menu, 'last');
    });
    select.addEventListener('focus', () => trigger.focus());
    select.addEventListener('change', () => syncFdcSelect(select));
    syncFdcSelect(select);
  }

  function upgradeFdcSelects(root: HTMLElement | ShadowRoot = shadow): void {
    root.querySelectorAll<HTMLSelectElement>('select').forEach(upgradeFdcSelect);
  }

  const fdcSelectObserver = new MutationObserver(() => upgradeFdcSelects());

  function handleFdcSelectKeydown(event: Event): void {
    if (!(event instanceof KeyboardEvent)) return;
    if (!openFdcSelect) return;
    const { menu } = openFdcSelect;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeFdcSelect();
      return;
    }
    if (event.key === 'Tab') {
      closeFdcSelect(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveFdcSelectFocus(menu, event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      moveFdcSelectFocus(menu, event.key === 'Home' ? 'first' : 'last');
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const option = (shadow.activeElement as HTMLElement | null)?.closest<HTMLButtonElement>(
        '[data-fdc-option]',
      );
      if (option) {
        event.preventDefault();
        option.click();
      }
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key)) {
      if (openFdcSelect.typeaheadTimer) clearTimeout(openFdcSelect.typeaheadTimer);
      openFdcSelect.typeahead += event.key.toLowerCase();
      const match = [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].find(
        (button) =>
          button.textContent
            ?.trim()
            .toLowerCase()
            .startsWith(openFdcSelect?.typeahead ?? ''),
      );
      match?.focus({ preventScroll: true });
      openFdcSelect.typeaheadTimer = setTimeout(() => {
        if (openFdcSelect) openFdcSelect.typeahead = '';
      }, 500);
    }
  }

  function handleFdcSelectDismiss(event: PointerEvent): void {
    if (!openFdcSelect) return;
    const path = event.composedPath();
    if (!path.includes(openFdcSelect.menu) && !path.includes(openFdcSelect.trigger))
      closeFdcSelect(false);
  }

  function closeFdcSelectForViewportChange(event?: Event): void {
    if (event?.type === 'scroll' && performance.now() < ignoreFdcSelectScrollUntil) return;
    if (
      event?.type === 'scroll' &&
      event.target instanceof Node &&
      openFdcSelect?.menu.contains(event.target)
    )
      return;
    closeFdcSelect(false);
  }

  renderIcons(shadow);
  upgradeFdcSelects();
  fdcSelectObserver.observe(shadow, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled', 'hidden'],
  });
  shadow.addEventListener('keydown', handleFdcSelectKeydown);
  document.addEventListener('pointerdown', handleFdcSelectDismiss, true);
  window.addEventListener('resize', closeFdcSelectForViewportChange);
  window.addEventListener('scroll', closeFdcSelectForViewportChange, true);

  const outline = shadow.querySelector<HTMLElement>('.outline')!;
  const panel = shadow.querySelector<HTMLElement>('.panel')!;
  const controlsRoot = shadow.querySelector<HTMLElement>('.controls')!;
  const inspectButton = shadow.querySelector<HTMLButtonElement>('.inspect')!;
  const interactButton = shadow.querySelector<HTMLButtonElement>('.interact')!;
  const workspaceBar = shadow.querySelector<HTMLElement>('.workspace-bar')!;
  const interfaceThemeTrigger = shadow.querySelector<HTMLButtonElement>(
    '.interface-theme-trigger',
  )!;
  const interfaceThemeMenu = shadow.querySelector<HTMLElement>('.interface-theme-menu')!;
  const sessionStatus = shadow.querySelector<HTMLElement>('.session-status')!;
  const statusPopover = shadow.querySelector<HTMLElement>('.status-popover')!;
  const changeDock = shadow.querySelector<HTMLElement>('.change-dock')!;
  const trayCompare = shadow.querySelector<HTMLButtonElement>('.tray-compare')!;
  const selectionKind = shadow.querySelector<HTMLElement>('.selection-kind')!;
  const selectionTitle = shadow.querySelector<HTMLElement>('.selection strong')!;
  const selectionCode = shadow.querySelector<HTMLElement>('.selection code')!;
  selectionCode.insertAdjacentHTML(
    'afterend',
    '<span class="selection-hint">Select mode stays on · click anywhere to begin</span>',
  );
  const selectionHint = shadow.querySelector<HTMLElement>('.selection-hint')!;
  const selectionRoot = shadow.querySelector<HTMLElement>('.selection')!;
  const modeCopyTitle = shadow.querySelector<HTMLElement>('.mode-copy strong')!;
  const modeCopyDetail = shadow.querySelector<HTMLElement>('.mode-copy span')!;
  const selectionState = shadow.querySelector<HTMLElement>('.selection-state')!;
  const selectionStats = shadow.querySelector<HTMLElement>('.selection-stats')!;
  const selectionSize = shadow.querySelector<HTMLElement>('[data-selection-size]')!;
  const selectionConfidence = shadow.querySelector<HTMLElement>('[data-selection-confidence]')!;
  const selectionPath = shadow.querySelector<HTMLElement>('.selection-path')!;
  const selectParentButton = shadow.querySelector<HTMLButtonElement>('[data-select-parent]')!;
  const selectChildButton = shadow.querySelector<HTMLButtonElement>('[data-select-child]')!;
  const pathName = shadow.querySelector<HTMLElement>('.path-name')!;
  const layersPanel = shadow.querySelector<HTMLElement>('.layers-panel')!;
  const layerTree = shadow.querySelector<HTMLElement>('.layer-tree')!;
  const layerSearch = shadow.querySelector<HTMLInputElement>('.layers-search input')!;
  const layerCount = shadow.querySelector<HTMLElement>('[data-layer-count]')!;
  const layerTitle = shadow.querySelector<HTMLElement>('.layers-head strong')!;
  const layerViewButtons = shadow.querySelectorAll<HTMLButtonElement>('[data-layer-view]');
  const layerTabCount = shadow.querySelector<HTMLElement>('[data-layer-tab-count]')!;
  const componentTabCount = shadow.querySelector<HTMLElement>('[data-component-tab-count]')!;
  const hoverOutline = shadow.querySelector<HTMLElement>('.hover-outline')!;
  const healthPanel = shadow.querySelector<HTMLElement>('.health-panel')!;
  const healthSummary = shadow.querySelector<HTMLElement>('.health-summary')!;
  const healthStress = shadow.querySelector<HTMLElement>('.health-stress')!;
  const healthFilters = shadow.querySelector<HTMLElement>('.health-filters')!;
  const healthList = shadow.querySelector<HTMLElement>('.health-list')!;
  const scope = shadow.querySelector<HTMLSelectElement>('[data-scope]')!;
  const breakpoint = shadow.querySelector<HTMLSelectElement>('[data-breakpoint]')!;
  const theme = shadow.querySelector<HTMLSelectElement>('[data-theme]')!;
  const state = shadow.querySelector<HTMLSelectElement>('[data-state]')!;
  const reviewTakeover = shadow.querySelector<HTMLElement>('.review-takeover')!;
  const reviewModal = shadow.querySelector<HTMLElement>('.review-modal')!;
  const reviewBody = shadow.querySelector<HTMLElement>('.review-body')!;
  const reviewCount = shadow.querySelector<HTMLElement>('.review-count')!;
  const applyButton = shadow.querySelector<HTMLButtonElement>('.review-actions .apply')!;
  const reviewCancel = shadow.querySelector<HTMLButtonElement>('.review-cancel')!;
  let cancelConfirmationRunId: string | undefined;
  let cancelConfirmationUntil = 0;

  function applyInterfaceTheme(preference: InterfaceThemePreference, persist = true): void {
    interfaceThemePreference = preference;
    const resolved = resolvedInterfaceTheme();
    host.dataset.interfaceTheme = resolved;
    host.dataset.interfaceThemePreference = preference;
    const label = preference[0]!.toUpperCase() + preference.slice(1);
    interfaceThemeTrigger.title = `Interface theme: ${label}`;
    interfaceThemeTrigger.setAttribute('aria-label', `Interface theme: ${label}`);
    interfaceThemeMenu
      .querySelectorAll<HTMLButtonElement>('[data-interface-theme-choice]')
      .forEach((button) =>
        button.setAttribute(
          'aria-checked',
          String(button.dataset.interfaceThemeChoice === preference),
        ),
      );
    if (persist) localStorage.setItem(interfaceThemeKey, preference);
  }

  function closeInterfaceThemeMenu(restoreFocus = false): void {
    interfaceThemeMenu.hidden = true;
    interfaceThemeTrigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) interfaceThemeTrigger.focus();
  }

  function openInterfaceThemeMenu(): void {
    const rect = interfaceThemeTrigger.getBoundingClientRect();
    const menuWidth = 164;
    interfaceThemeMenu.style.top = `${Math.round(rect.bottom + 8)}px`;
    interfaceThemeMenu.style.left = `${Math.round(Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.right - menuWidth)))}px`;
    interfaceThemeMenu.hidden = false;
    interfaceThemeTrigger.setAttribute('aria-expanded', 'true');
    interfaceThemeMenu.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }

  applyInterfaceTheme(interfaceThemePreference, false);
  const handleSystemThemeChange = (): void => {
    if (interfaceThemePreference === 'system') applyInterfaceTheme('system', false);
  };
  systemDarkTheme.addEventListener('change', handleSystemThemeChange);
  const handleInterfaceThemeDismiss = (event: PointerEvent): void => {
    if (interfaceThemeMenu.hidden) return;
    const path = event.composedPath();
    if (!path.includes(interfaceThemeMenu) && !path.includes(interfaceThemeTrigger)) {
      closeInterfaceThemeMenu();
    }
  };
  document.addEventListener('pointerdown', handleInterfaceThemeDismiss, true);
  let workspaceState: FoundryWorkspaceState = { ...DEFAULT_WORKSPACE_STATE };
  let selected: HTMLElement | null = null;
  let selectedElements: HTMLElement[] = [];
  let layerEntries: Array<{
    element: HTMLElement;
    depth: number;
    label: string;
    kind: string;
    instrumented: boolean;
    hasChildren: boolean;
  }> = [];
  const collapsedLayers = new WeakSet<HTMLElement>();
  let visibleLayerElements = new Set<HTMLElement>();
  let layerGlideTop: number | null = null;
  const layerViewPreferenceKey = '__foundry_layer_view';
  let layerView: 'layers' | 'components' =
    sessionStorage.getItem(layerViewPreferenceKey) === 'components' ? 'components' : 'layers';
  let clickCycle = { x: -1, y: -1, at: 0, index: -1, signature: '' };
  let inspecting = options.startInspecting ?? true;
  let selectedControls: Control[] = [];
  let nextInspectorRevision = 0;
  // A transient inspector gesture is separate from the reviewed change ledger.
  let inspectorDraft: {
    element: HTMLElement;
    property: string;
    restores: Array<() => void>;
  } | null = null;
  let focusSpotlight: HTMLDivElement | null = null;

  function cancelInspectorDraft(): void {
    if (!inspectorDraft) return;
    inspectorDraft.restores.forEach((restore) => restore());
    inspectorDraft = null;
    if (selected) selectedControls = controlsFor(selected);
    updateOutline();
  }

  function clearInspectorFocus(): void {
    focusSpotlight?.remove();
    focusSpotlight = null;
  }

  function measureVariantMutation(element: HTMLElement, mutate: () => void): void {
    const style = element.getAttribute('style');
    element.style.setProperty('transition-property', 'none', 'important');
    try {
      mutate();
      void getComputedStyle(element).backgroundColor;
    } finally {
      if (style === null) {
        element.style.cssText = '';
        void element.getAttribute('style');
        element.removeAttribute('style');
      } else element.setAttribute('style', style);
    }
  }

  function variantRestoration(element: HTMLElement, names: string[]): () => void {
    const restore = restoreVariantAttributes(element, names);
    return () => measureVariantMutation(element, restore);
  }

  function inspectorRestore(element: HTMLElement, property: string): () => void {
    const style = element.getAttribute('style');
    const attribute = element.getAttribute(property);
    const nodes = [...element.childNodes];
    return () => {
      if (inspectorAttributes.has(property)) {
        if (attribute === null) element.removeAttribute(property);
        else element.setAttribute(property, attribute);
      } else if (property === 'textContent') element.replaceChildren(...nodes);
      if (style === null) element.removeAttribute('style');
      else element.setAttribute('style', style);
      element.style.setProperty('transition-property', 'none', 'important');
      void getComputedStyle(element).fontSize;
      if (style === null) {
        element.style.cssText = '';
        void element.getAttribute('style');
        element.removeAttribute('style');
      } else element.setAttribute('style', style);
    };
  }

  function nextControlsFor(element: HTMLElement): Control[] {
    const computed = getComputedStyle(element);
    const media = ['IMG', 'VIDEO', 'AUDIO', 'PICTURE'].includes(element.tagName);
    const controls = controlsFor(element);
    if (supportsInspectorObjectLayout(element.tagName))
      controls.push(
        styleControl(element, computed, 'layout', 'objectFit', 'Object fit', 'select', [
          'fill',
          'contain',
          'cover',
          'none',
          'scale-down',
        ]),
        styleControl(element, computed, 'layout', 'objectPosition', 'Object position'),
      );
    return controls
      .filter(
        (control) =>
          !media ||
          (!['typography', 'content'].includes(control.category) && control.property !== 'color'),
      )
      .filter(
        (control) =>
          (inspectorStyleProperties.has(control.property) &&
            (!['gap', 'rowGap', 'columnGap'].includes(control.property) ||
              /flex|grid/.test(computed.display))) ||
          inspectorAttributes.has(control.property) ||
          (control.property === 'textContent' &&
            element.childElementCount === 0 &&
            !['INPUT', 'TEXTAREA', 'SELECT', 'SCRIPT', 'STYLE'].includes(element.tagName)),
      )
      .map((control) => {
        // Do not turn CSS keywords or unequal shorthand values into an invented zero
        // or a misleading first number. Such values remain explicit CSS fields.
        const cssValue = String(computed[control.property as keyof CSSStyleDeclaration]);
        if (control.unit === 'px' && !/^-?[\d.]+px$/.test(cssValue))
          return styleControl(
            element,
            computed,
            control.category,
            control.property as keyof CSSStyleDeclaration,
            control.label,
          );
        return control;
      });
  }

  function applyInspectorValue(control: Control, value: string | number, element = selected): void {
    if (!element) return;
    const transition = element.style.getPropertyValue('transition-property');
    const priority = element.style.getPropertyPriority('transition-property');
    element.style.setProperty('transition-property', 'none', 'important');
    control.apply(value);
    void control.read();
    if (transition) element.style.setProperty('transition-property', transition, priority);
    else element.style.removeProperty('transition-property');
  }
  let resizeObserver: ResizeObserver | undefined;
  let activeReviewPayload: any = null;
  let activeAgentPresence: {
    connected: boolean;
    presence?: { agent?: { name?: string }; expiresAt?: string } | null;
  } = { connected: false, presence: null };
  const reviewDraftKey = `__foundry_review_draft:${sessionId || 'local'}`;
  let reviewDraft = (() => {
    try {
      return parseReviewDraft(sessionStorage.getItem(reviewDraftKey));
    } catch {
      return emptyReviewDraft();
    }
  })();
  let reviewShowRejected = false;
  const collapsedReviewGroups = new Set<string>();
  let reviewPoll: ReturnType<typeof setInterval> | undefined;
  let sessionPoll: ReturnType<typeof setInterval> | undefined;
  let lastReviewTrigger: HTMLElement | null = null;
  let reviewScrollTop = 0;
  let reviewSuspended = false;
  let suspendedPreviewRestore: (() => void) | undefined;
  const dockReviewButton = shadow.querySelector<HTMLButtonElement>('.dock-review')!;
  const dockWidthKey = '__foundry_dock_width';
  const legacyDockWidthKey = '__foundry_panel_width';
  const storedDockWidth = Number(
    localStorage.getItem(dockWidthKey) ?? localStorage.getItem(legacyDockWidthKey),
  );
  let dockWidth = Number.isFinite(storedDockWidth)
    ? Math.max(340, Math.min(520, storedDockWidth))
    : 384;
  host.style.setProperty('--fdc-dock-width', `${Math.round(dockWidth)}px`);
  let designGraph: {
    version?: string;
    revision?: string;
    tokens: BrowserDesignToken[];
    components: ComponentWorkshopDefinition[];
    breakpoints: Array<{
      id: string;
      label: string;
      width: number;
      height: number;
    }>;
    containerQueries?: Array<{
      id: string;
      label: string;
      name?: string;
      condition: string;
      axis: 'inline-size' | 'block-size' | 'size';
      minWidth?: number;
      maxWidth?: number;
      source: { file: string; line?: number; column?: number };
      evidence: string[];
    }>;
    themes: Array<{
      id: string;
      label: string;
      selector?: string;
      attribute?: string;
      value?: string;
    }>;
    states: Array<any>;
    motionPresets: Array<any>;
    tokenPromotions?: Array<{
      id: string;
      value: string;
      category: string;
      property: string;
      occurrenceCount: number;
      sources: Array<{ file: string; line?: number; column?: number }>;
      componentIds: string[];
      recommendation: 'use-existing' | 'create-token';
      relation: 'exact' | 'near' | 'new';
      suggestedTokenId?: string;
      suggestedTokenName: string;
      suggestedValue: string;
      aliasChain: string[];
      canStage: boolean;
      blockers: string[];
      evidence: string[];
    }>;
  } | null = null;
  const previewThemeBaseline = createPreviewThemeBaseline();
  let restorePreviewState = (): void => {};
  let previewApplicationRevision = 0;
  let currentPreviewContext: PreviewContext = {
    version: PREVIEW_CONTEXT_VERSION,
    requestRevision: 0,
    viewport: { id: 'current' },
    theme: 'current',
    state: 'current',
    motionPreference: 'system',
  };
  let lastPreviewApplication: PreviewContextResult | null = null;
  let workshopComponentId = '';
  let workshopVariantId = '';
  let workshopStateId = 'current';
  let workshopStateCleanup: (() => void) | undefined;
  interface HistoryEntry {
    element: HTMLElement;
    property: string;
    before: string | number;
    after: string | number;
    unit?: string;
    category: Category;
    label: string;
    gestureId?: string;
    inspectorRestore?: { before: () => void; after: () => void };
  }
  interface BrowserHealthIssue extends HealthFinding {
    id: string;
    element: HTMLElement;
    elementLabel: string;
    previewed: boolean;
    recordedBranchId?: string;
    recordedBranchName?: string;
    source?: string;
    stressConditions: StressConditionId[];
  }
  const previewHistory: HistoryEntry[] = [];
  let historyCursor = 0;
  let paddingLinked = true;
  let radiusLinked = true;
  let tokenOnly = false;
  let activeControlProperty = '';
  const recentColors = new Set<string>();
  let activeColor:
    | {
        index: number;
        control: Control;
        element: HTMLElement;
        hue: number;
        saturation: number;
        value: number;
        alpha: number;
      }
    | undefined;
  let localTypographyFonts: TypographyFontFace[] = [];
  let googleTypographyFonts: GoogleFontFamily[] = [];
  let googleTypographySource: 'google' | 'fallback' | 'loading' | 'error' = 'loading';
  let googleTypographySelection: GoogleFontSelection | undefined;
  const pendingGoogleFontFamilies = new Set<string>();
  let googleTypographyStrategy: FontInstallStrategy = 'framework';
  let typographyQuery = '';
  let typographySearchTimer: ReturnType<typeof setTimeout> | undefined;
  let typographyCatalogRequest = 0;
  let typographyTrigger: HTMLButtonElement | null = null;
  let typographyScaleBase = 16;
  let typographyScaleRatio = 1.25;
  let typographyScaleStep = 1;
  let typographyScaleFluid = false;
  let projectTypographyStyles: ProjectTypographyStyle[] = [];
  let typographyStyleName = '';
  let typographyTreatmentPreview:
    | {
        element: HTMLElement;
        inlineFontSize: string;
        inlineLineHeight: string;
        inlineLetterSpacing: string;
        baselineFontSize: number;
        treatmentId?: string;
        scaleValue?: string;
      }
    | undefined;
  let typographyPreview:
    | {
        element: HTMLElement;
        inlineFamily: string;
        inlineWeight: string;
        inlineStyle: string;
        inlineVariationSettings: string;
        family: string;
        origin: 'local' | 'google' | 'project';
        link?: HTMLLinkElement;
      }
    | undefined;
  let lastRecordedSummary = '';
  let statusResetTimer: ReturnType<typeof setTimeout> | undefined;
  let hydratedOnce = false;
  const collapsedSections = new Set<string>();
  let sectionPreferenceTouched = sessionStorage.getItem('__foundry_collapsed_sections') != null;
  try {
    for (const key of JSON.parse(sessionStorage.getItem('__foundry_collapsed_sections') ?? '[]')) {
      if (typeof key === 'string') collapsedSections.add(key);
    }
  } catch {
    sessionStorage.removeItem('__foundry_collapsed_sections');
  }
  let comparisonActive = false;
  let isolatedComparisonElement: HTMLElement | null = null;
  let draggedLayer: HTMLElement | null = null;
  let layerScrollFrame = 0;
  let healthIssues: BrowserHealthIssue[] = [];
  let healthScanError = '';
  let healthScannedAt = '';
  let healthFilter = 'all';
  const ignoredHealthIssues = new Set<string>();
  try {
    for (const id of JSON.parse(localStorage.getItem('__foundry_health_ignored') ?? '[]')) {
      if (typeof id === 'string') ignoredHealthIssues.add(id);
    }
  } catch {
    localStorage.removeItem('__foundry_health_ignored');
  }
  const verifyingRuns = new Set<string>();
  const capturedBaselineRuns = new Set<string>();
  let projectRoot = location.origin;
  let projectRevision = '';
  let runtimeConnected = false;
  let recordedChangeCount = 0;
  let latestApplyState = 'none';
  type OnboardingStepId = 'setup' | 'agent' | 'selection' | 'change' | 'apply';
  const onboardingCompleted = new Set<OnboardingStepId>();
  let designMemory: ProjectDesignMemory = emptyDesignMemory();
  let matrixMode = false;
  let workbenchStateId = 'current';
  let restoreWorkbenchPreview = (): void => {};
  let lastUtilityTrigger: HTMLElement | null = null;
  let workspaceCanvasTool: 'select' | 'interact' | 'pan' = inspecting ? 'select' : 'interact';
  let embeddedSpaceHeld = false;
  let embeddedPanActive = false;
  let embeddedPanPointer: Element | null = null;
  let responsiveStressMode = 'none';
  type ResponsiveEditScopeMode = 'breakpoint' | 'all-breakpoints';
  let responsiveEditScope: {
    scope: ResponsiveEditScopeMode;
    activeBreakpoint: string;
  } = {
    scope: 'breakpoint',
    activeBreakpoint: 'current',
  };
  let responsiveStressTextTarget: HTMLElement | null = null;
  let responsiveStressOriginalText = '';
  let responsiveContainerPreview: {
    element: HTMLElement;
    inlineSize: string;
    maxInlineSize: string;
    flexBasis: string;
  } | null = null;
  let activeStressConditions: StressConditionId[] = [];
  let activeStressScope: StressScope = 'selection';
  let activeStressTarget: { element: HTMLElement; label: string } | null = null;
  let stressDraftConditions: StressConditionId[] = [];
  let stressDraftScope: StressScope = 'selection';
  let stressAppliedAt = '';
  let stressRestore: Array<() => void> = [];
  const utilityRects = new Map<Exclude<FoundryUtility, null>, FoundryRect>();
  let workspacePublishFrame = 0;
  let visualAgentRegion: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;
  let visualAgentRegionCleanup: (() => void) | null = null;

  function captureVisualAgentRegion(): void {
    visualAgentRegionCleanup?.();
    const overlay = document.createElement('div');
    overlay.dataset.foundryAgentRegion = 'true';
    Object.assign(overlay.style, {
      position: 'fixed',
      zIndex: '2147483646',
      border: '1px solid #3478f6',
      background: 'rgb(52 120 246 / 10%)',
      pointerEvents: 'none',
      display: 'none',
    });
    document.body.append(overlay);
    let start: { x: number; y: number } | null = null;
    const move = (event: PointerEvent): void => {
      if (!start) return;
      const x = Math.min(start.x, event.clientX);
      const y = Math.min(start.y, event.clientY);
      const width = Math.abs(event.clientX - start.x);
      const height = Math.abs(event.clientY - start.y);
      Object.assign(overlay.style, {
        display: 'block',
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
      });
    };
    const cleanup = (): void => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('keydown', keydown, true);
      overlay.remove();
      visualAgentRegionCleanup = null;
      document.documentElement.style.cursor = '';
    };
    const down = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      start = { x: event.clientX, y: event.clientY };
      move(event);
    };
    const up = (event: PointerEvent): void => {
      if (!start) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const x = Math.min(start.x, event.clientX);
      const y = Math.min(start.y, event.clientY);
      const width = Math.abs(event.clientX - start.x);
      const height = Math.abs(event.clientY - start.y);
      visualAgentRegion =
        width >= 8 && height >= 8 ? { id: `region_${Date.now()}`, x, y, width, height } : null;
      cleanup();
      publishWorkspaceState();
    };
    const keydown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      cleanup();
      publishWorkspaceState();
    };
    visualAgentRegionCleanup = cleanup;
    document.documentElement.style.cursor = 'crosshair';
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('keydown', keydown, true);
  }

  function workspaceSnapshot(): Record<string, unknown> {
    if (!layerEntries.length) discoverLayers();
    const rect = selected?.getBoundingClientRect();
    const selectionStyle = selected ? getComputedStyle(selected) : null;
    const lineHeight = selectionStyle ? Number.parseFloat(selectionStyle.lineHeight) : 0;
    const decisionEntries = selected
      ? [
          ...new Map(
            previewHistory
              .slice(0, historyCursor)
              .filter((entry) => entry.element === selected)
              .map((entry) => [entry.property, entry]),
          ).values(),
        ]
      : [];
    const decisionContext = {
      component: selected?.dataset.foundryComponent,
      kind: selected?.tagName.toLowerCase(),
      source: selected?.dataset.foundrySource,
      properties:
        decisionEntries.length > 0
          ? decisionEntries.map((entry) => entry.property)
          : selectedControls.map((control) => control.property),
      breakpoint: breakpoint.value,
      theme: theme.value,
      state: state.value,
      values: decisionEntries.map((entry) => ({
        property: entry.property,
        value: entry.after,
        category: entry.category,
      })),
    };
    return {
      version: 1,
      ...(verificationChild ? { verificationReady: hydratedOnce } : {}),
      ...(componentSpecimen ? { specimenReady: hydratedOnce } : {}),
      capabilities: configuredPreviewCapabilities(),
      currentPreviewContext,
      lastPreviewApplication,
      mode: inspecting ? 'select' : 'interact',
      interfaceTheme: resolvedInterfaceTheme(),
      context: {
        scope: scope.value,
        breakpoint: breakpoint.value,
        theme: theme.value,
        state: state.value,
      },
      selection: selected
        ? {
            id: foundryTargetId(selected),
            selector: foundrySelector(selected),
            label: targetFor(selected).label,
            kind: selected.tagName.toLowerCase(),
            source: selected.dataset.foundrySource ?? foundrySelector(selected),
            component: selected.dataset.foundryComponent ?? null,
            confidence: targetFor(selected).confidence,
            width: rect ? Math.round(rect.width * 100) / 100 : 0,
            height: rect ? Math.round(rect.height * 100) / 100 : 0,
            count: selectedElements.length,
            targets: selectedElements.map((element) => {
              const target = targetFor(element);
              const targetRect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return {
                id: foundryTargetId(element),
                selector: foundrySelector(element),
                label: target.label,
                kind: element.tagName.toLowerCase(),
                component: element.dataset.foundryComponent ?? null,
                source: element.dataset.foundrySource ?? foundrySelector(element),
                confidence: target.confidence,
                geometry: {
                  x: targetRect.x,
                  y: targetRect.y,
                  width: targetRect.width,
                  height: targetRect.height,
                  scale: window.devicePixelRatio || 1,
                },
                measurements: {
                  display: style.display,
                  position: style.position,
                  color: style.color,
                  backgroundColor: style.backgroundColor,
                  fontFamily: style.fontFamily,
                  fontSize: style.fontSize,
                  fontWeight: style.fontWeight,
                  lineHeight: style.lineHeight,
                  padding: style.padding,
                  margin: style.margin,
                  gap: style.gap,
                  borderRadius: style.borderRadius,
                },
              };
            }),
          }
        : null,
      visualAgent: {
        region: visualAgentRegion,
        capturingRegion: Boolean(visualAgentRegionCleanup),
      },
      layers: layerEntries.slice(0, 500).map((entry) => {
        const layerRect = entry.element.getBoundingClientRect();
        const definition = designGraph?.components.find((component) => {
          const path = entry.element.dataset.foundryComponent;
          const name = path?.split('/').filter(Boolean).at(-1);
          return component.id === path || component.name === path || component.name === name;
        });
        const variantProperties = new Set(
          definition?.variants.flatMap((variant) => Object.keys(variant.props)) ?? [],
        );
        const variantProps = Object.fromEntries(
          [...variantProperties].flatMap((property) => {
            const attribute = `data-${property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
            const value = entry.element.getAttribute(attribute);
            return value == null ? [] : [[property, value]];
          }),
        );
        return {
          id: foundryTargetId(entry.element),
          selector: foundrySelector(entry.element),
          label: entry.label,
          kind: entry.kind,
          component: entry.element.dataset.foundryComponent ?? null,
          source: entry.element.dataset.foundrySource ?? null,
          width: Math.round(layerRect.width * 100) / 100,
          height: Math.round(layerRect.height * 100) / 100,
          depth: entry.depth,
          instrumented: entry.instrumented,
          hasChildren: entry.hasChildren,
          selected: selectedElements.includes(entry.element),
          variantProps,
        };
      }),
      controls: selectedControls.map((control, index) => ({
        index,
        category: control.category,
        property: control.property,
        label: control.label,
        kind: control.kind,
        value: control.read(),
        unit: control.unit,
        min: control.min,
        max: control.max,
        step: control.step,
        options: control.options,
      })),
      nextControls: sharedInspectorControls(
        selectedElements.map((element) =>
          nextControlsFor(element).map(({ read, apply, ...control }) => ({
            ...control,
            value: read(),
          })),
        ),
      ),
      nextInspectorRevision,
      nextVariantPreviewId: inspectorDraft?.property.startsWith('variant:')
        ? inspectorDraft.property.slice(8)
        : null,
      nextVariants:
        selected && selectedElements.length === 1 ? nextVariantSnapshot(selected) : null,
      typography: selected ? workspaceTypographySnapshot(selected) : null,
      motions: selected ? workspaceMotionSnapshot(selected) : [],
      history: {
        canUndo: historyCursor > 0,
        canRedo: historyCursor < previewHistory.length,
      },
      project: {
        tokens: designGraph?.tokens ?? [],
        renderedTokens: Object.fromEntries(
          (designGraph?.tokens ?? [])
            .filter((token) => token.cssVariable)
            .map((token) => [
              token.id,
              getComputedStyle(document.documentElement)
                .getPropertyValue(token.cssVariable!)
                .trim(),
            ]),
        ),
        components: designGraph?.components ?? [],
        breakpoints: designGraph?.breakpoints ?? [],
        containerQueries: designGraph?.containerQueries ?? [],
        themes: designGraph?.themes ?? [],
        states: designGraph?.states ?? [],
      },
      health: healthIssues.map((issue) => ({
        id: issue.id,
        ruleId: issue.ruleId,
        kind: issue.category,
        title: issue.title,
        detail: `${issue.elementLabel}: ${issue.description}`,
        description: issue.description,
        evidence: issue.evidence,
        severity: issue.severity,
        source: issue.source,
        viewport: `${window.innerWidth} × ${window.innerHeight}`,
        stressConditions: issue.stressConditions,
        canFix: Boolean(issue.fix),
        previewed: issue.previewed,
        recordedBranchId: issue.recordedBranchId,
        recordedBranchName: issue.recordedBranchName,
      })),
      stressTesting: {
        profiles: STRESS_CONDITIONS,
        active: activeStressConditions,
        scope: activeStressScope,
        appliedAt: stressAppliedAt || null,
        scannedAt: healthScannedAt || null,
        error: healthScanError || null,
        target:
          activeStressScope === 'selection'
            ? (activeStressTarget?.label ?? (selected ? layerLabel(selected) : 'No selection'))
            : 'Entire canvas',
      },
      memory: designMemory,
      decisionMemory: {
        decisions: designMemory.decisions,
        canCapture: Boolean(selected),
        hasEditedValues: decisionEntries.length > 0,
        relevant: relevantDesignDecisions(designMemory.decisions, decisionContext),
        context: decisionContext,
      },
      visualRecipes: {
        recipes: designMemory.recipes,
        canSave: Boolean(selected && previewHistory.some((entry) => entry.element === selected)),
        assessment: selected
          ? Object.fromEntries(
              designMemory.recipes.map((recipe) => [
                recipe.id,
                assessRecipe(
                  recipe,
                  selectedControls.map((control) => ({
                    property: control.property,
                    value: control.read(),
                    category: control.category,
                    unit: control.unit,
                  })),
                  designGraph?.tokens ?? [],
                  {
                    component: selected!.dataset.foundryComponent,
                    kind: selected!.tagName.toLowerCase(),
                  },
                ),
              ]),
            )
          : {},
        suggestions: selected
          ? designMemory.recipes
              .map((recipe) => ({
                recipeId: recipe.id,
                recipeName: recipe.name,
                ...assessRecipe(
                  recipe,
                  selectedControls.map((control) => ({
                    property: control.property,
                    value: control.read(),
                    category: control.category,
                    unit: control.unit,
                  })),
                  designGraph?.tokens ?? [],
                  {
                    component: selected!.dataset.foundryComponent,
                    kind: selected!.tagName.toLowerCase(),
                  },
                ),
              }))
              .filter((item) => item.compatibility !== 'incompatible')
              .sort((a, b) => b.score - a.score)
          : [],
      },
      responsive: {
        editScope: {
          scope: responsiveEditScope.scope,
          activeBreakpoint: responsiveEditScope.activeBreakpoint,
          breakpoints:
            responsiveEditScope.scope === 'all-breakpoints'
              ? (designGraph?.breakpoints ?? []).map((item) => item.id)
              : [responsiveEditScope.activeBreakpoint],
          sourceMapped: Boolean(selected && targetFor(selected).source),
        },
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentScrollWidth: document.documentElement.scrollWidth,
        documentScrollHeight: document.documentElement.scrollHeight,
        stressMode: responsiveStressMode,
        container: selected
          ? (() => {
              const container = nearestResponsiveContainer(selected);
              if (!container) return null;
              const containerRect = container.getBoundingClientRect();
              const containerStyle = getComputedStyle(container) as CSSStyleDeclaration & {
                containerName?: string;
                containerType?: string;
              };
              return {
                name: containerStyle.containerName || container.dataset.foundryContainer || null,
                type: containerStyle.containerType || 'inline-size',
                width: containerRect.width,
                height: containerRect.height,
                selector: foundrySelector(container),
                previewed: responsiveContainerPreview?.element === container,
              };
            })()
          : null,
        selection: selected
          ? {
              width: rect?.width ?? 0,
              height: rect?.height ?? 0,
              top: rect?.top ?? 0,
              left: rect?.left ?? 0,
              scrollWidth: selected.scrollWidth,
              scrollHeight: selected.scrollHeight,
              clientWidth: selected.clientWidth,
              clientHeight: selected.clientHeight,
              lineCount:
                lineHeight > 0 && rect ? Math.max(1, Math.round(rect.height / lineHeight)) : 1,
            }
          : null,
      },
    };
  }

  function workspaceTypographySnapshot(element: HTMLElement): Record<string, unknown> {
    const computed = getComputedStyle(element);
    const analysis = currentTypographyAnalysis(element);
    const projectFonts = collectProjectFonts(document, element);
    const usages = new Map<
      string,
      {
        family: string;
        count: number;
        weights: Set<string>;
        sizes: Set<string>;
        examples: string[];
      }
    >();
    for (const candidate of [...document.body.querySelectorAll<HTMLElement>('*')].slice(0, 1200)) {
      const text = candidate.textContent?.replace(/\s+/g, ' ').trim();
      if (!text || candidate.children.length > 0) continue;
      const style = getComputedStyle(candidate);
      const family = parseFontFamilyStack(style.fontFamily)[0] ?? style.fontFamily;
      const key = family.toLocaleLowerCase();
      const usage = usages.get(key) ?? {
        family,
        count: 0,
        weights: new Set<string>(),
        sizes: new Set<string>(),
        examples: [],
      };
      usage.count += 1;
      usage.weights.add(style.fontWeight);
      usage.sizes.add(style.fontSize);
      if (usage.examples.length < 2) usage.examples.push(text.slice(0, 72));
      usages.set(key, usage);
    }
    return {
      selection: {
        family: computed.fontFamily,
        primaryFamily: parseFontFamilyStack(computed.fontFamily)[0] ?? computed.fontFamily,
        weight: computed.fontWeight,
        style: computed.fontStyle,
        size: computed.fontSize,
        lineHeight: computed.lineHeight,
        letterSpacing: computed.letterSpacing,
        variationSettings: computed.fontVariationSettings,
        text:
          element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 280) ||
          targetFor(element).label,
      },
      projectFonts,
      savedStyles: projectTypographyStyles,
      diagnostics: analysis.diagnostics,
      metrics: {
        lineCount: analysis.lineCount,
        charactersPerLine: analysis.charactersPerLine,
        faceStatus: analysis.faceStatus,
      },
      usages: [...usages.values()]
        .map((usage) => ({
          family: usage.family,
          count: usage.count,
          weights: [...usage.weights],
          sizes: [...usage.sizes],
          examples: usage.examples,
        }))
        .sort((left, right) => right.count - left.count),
      preview: typographyPreview
        ? { family: typographyPreview.family, origin: typographyPreview.origin }
        : typographyTreatmentPreview
          ? {
              treatmentId: typographyTreatmentPreview.treatmentId,
              scaleValue: typographyTreatmentPreview.scaleValue,
            }
          : null,
      treatments: typeTreatments,
      scale: {
        base: typographyScaleBase,
        ratio: typographyScaleRatio,
        step: typographyScaleStep,
        fluid: typographyScaleFluid,
        value: currentScaleValue(),
      },
      strategies: fontInstallStrategies,
      googleSelection: googleTypographySelection,
      validation: currentTypographyValidationPlan(),
      capabilities: {
        localFontAccess:
          typeof (
            window as Window & {
              queryLocalFonts?: () => Promise<LocalFontRecord[]>;
            }
          ).queryLocalFonts === 'function',
      },
    };
  }

  function clearResponsiveStress(): void {
    document.documentElement.style.removeProperty('zoom');
    document.documentElement.style.removeProperty('font-size');
    document.documentElement.removeAttribute('data-foundry-responsive-stress');
    if (responsiveStressTextTarget?.isConnected) {
      responsiveStressTextTarget.textContent = responsiveStressOriginalText;
    }
    responsiveStressTextTarget = null;
    responsiveStressOriginalText = '';
    responsiveStressMode = 'none';
  }

  function nearestResponsiveContainer(element: HTMLElement): HTMLElement | null {
    let candidate: HTMLElement | null = element;
    while (candidate) {
      const style = getComputedStyle(candidate) as CSSStyleDeclaration & {
        containerType?: string;
      };
      if (
        candidate.dataset.foundryContainer != null ||
        (style.containerType && style.containerType !== 'normal')
      )
        return candidate;
      candidate = candidate.parentElement;
    }
    return null;
  }

  function clearResponsiveContainerPreview(): void {
    if (!responsiveContainerPreview) return;
    const { element, inlineSize, maxInlineSize, flexBasis } = responsiveContainerPreview;
    if (element.isConnected) {
      element.style.inlineSize = inlineSize;
      element.style.maxInlineSize = maxInlineSize;
      element.style.flexBasis = flexBasis;
    }
    responsiveContainerPreview = null;
  }

  function previewResponsiveContainer(width?: number): void {
    const container = selected ? nearestResponsiveContainer(selected) : null;
    if (!container || !Number.isFinite(width) || Number(width) <= 0) {
      clearResponsiveContainerPreview();
      window.setTimeout(publishWorkspaceState, 0);
      return;
    }
    if (responsiveContainerPreview?.element !== container) clearResponsiveContainerPreview();
    if (!responsiveContainerPreview) {
      responsiveContainerPreview = {
        element: container,
        inlineSize: container.style.inlineSize,
        maxInlineSize: container.style.maxInlineSize,
        flexBasis: container.style.flexBasis,
      };
    }
    container.style.inlineSize = `${Math.round(Number(width))}px`;
    container.style.maxInlineSize = 'none';
    container.style.flexBasis = `${Math.round(Number(width))}px`;
    window.setTimeout(publishWorkspaceState, 0);
  }

  function stressRoots(scope: StressScope): HTMLElement[] {
    if (scope === 'selection') return selected?.isConnected ? [selected] : [];
    return [document.body];
  }

  function textNodesInside(root: HTMLElement): Text[] {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (
          !parent ||
          ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(parent.tagName) ||
          !node.textContent?.trim()
        )
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode() && nodes.length < 200) nodes.push(walker.currentNode as Text);
    return nodes;
  }

  function restoreStressConditions(announce = true): void {
    for (const restore of stressRestore.reverse()) restore();
    stressRestore = [];
    activeStressConditions = [];
    if (!announce) activeStressTarget = null;
    healthScanError = '';
    stressAppliedAt = '';
    document.documentElement.removeAttribute('data-foundry-stress');
    window.dispatchEvent(
      new CustomEvent('foundry:stress-state', {
        detail: { active: [], scope: activeStressScope, temporary: true },
      }),
    );
    if (announce) {
      window.setTimeout(() => {
        scanDesignHealth();
        publishWorkspaceState();
      }, 0);
    }
  }

  function applyStressConditions(conditions: readonly unknown[], scope: StressScope): number {
    const normalizedConditions = validateStressConditions(conditions);
    const roots = stressRoots(scope);
    if (scope === 'selection' && !roots[0]) {
      throw new Error('The selected stress target is no longer available. Select it again.');
    }
    restoreStressConditions(false);
    activeStressScope = scope;
    activeStressConditions = normalizedConditions;
    stressDraftScope = scope;
    stressDraftConditions = [...activeStressConditions];
    activeStressTarget =
      scope === 'selection' && roots[0]
        ? {
            element: roots[0],
            label: layerLabel(roots[0]),
          }
        : null;
    healthScanError = '';
    const textNodes = roots.flatMap(textNodesInside);
    const saveStyle = (
      element: HTMLElement,
      property: keyof CSSStyleDeclaration,
      value: string,
    ) => {
      const previous = String(element.style[property] ?? '');
      (element.style[property] as string) = value;
      stressRestore.push(() => {
        (element.style[property] as string) = previous;
      });
    };
    const replaceText = (node: Text, value: string) => {
      const previous = node.data;
      node.data = value;
      stressRestore.push(() => {
        if (node.isConnected) node.data = previous;
      });
    };

    if (activeStressConditions.includes('long-content')) {
      for (const node of textNodes) {
        const original = node.data.trim();
        replaceText(
          node,
          `${original} · ${original} with a deliberately longer localized value for layout testing`,
        );
      }
    }
    if (activeStressConditions.includes('large-numbers')) {
      for (const node of textNodes) {
        if (!/\d/.test(node.data)) continue;
        replaceText(node, node.data.replace(/[\d,.]+/g, '9,999,999,999.99'));
      }
    }
    if (activeStressConditions.includes('empty-content')) {
      for (const node of textNodes) replaceText(node, '');
    }
    if (activeStressConditions.includes('missing-images')) {
      for (const root of roots) {
        const images = [
          ...(root instanceof HTMLImageElement ? [root] : []),
          ...root.querySelectorAll<HTMLImageElement>('img'),
        ];
        for (const image of images) {
          const source = image.getAttribute('src');
          const sourceSet = image.getAttribute('srcset');
          image.removeAttribute('src');
          image.removeAttribute('srcset');
          image.dataset.foundryMissingImage = 'true';
          stressRestore.push(() => {
            if (source == null) image.removeAttribute('src');
            else image.setAttribute('src', source);
            if (sourceSet == null) image.removeAttribute('srcset');
            else image.setAttribute('srcset', sourceSet);
            delete image.dataset.foundryMissingImage;
          });
        }
      }
    }
    if (activeStressConditions.includes('text-200')) {
      saveStyle(document.documentElement, 'fontSize', '200%');
    }
    if (activeStressConditions.includes('browser-zoom-200')) {
      saveStyle(document.documentElement, 'zoom', '2');
    }
    const filters: string[] = [];
    if (activeStressConditions.includes('high-contrast')) filters.push('contrast(1.5)');
    if (activeStressConditions.includes('monochrome')) filters.push('grayscale(1)');
    if (filters.length) saveStyle(document.body, 'filter', filters.join(' '));
    if (activeStressConditions.includes('reduced-motion')) {
      const style = document.createElement('style');
      style.dataset.foundryStressStyle = 'reduced-motion';
      style.textContent =
        '*,:before,:after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}';
      document.head.append(style);
      stressRestore.push(() => style.remove());
    }
    if (activeStressConditions.includes('keyboard-only')) {
      const first = roots
        .flatMap((root) => [root, ...root.querySelectorAll<HTMLElement>('*')])
        .find((element) => isInteractiveElement(element) && element.tabIndex >= 0);
      const previous = document.activeElement as HTMLElement | null;
      first?.focus({ preventScroll: true });
      stressRestore.push(() => previous?.isConnected && previous.focus({ preventScroll: true }));
    }

    stressAppliedAt = new Date().toISOString();
    document.documentElement.dataset.foundryStress = activeStressConditions.join(' ');
    window.dispatchEvent(
      new CustomEvent('foundry:stress-state', {
        detail: {
          active: activeStressConditions,
          scope: activeStressScope,
          temporary: true,
        },
      }),
    );
    return scanDesignHealthOrThrow();
  }

  function applyResponsiveStress(mode: string): void {
    clearResponsiveStress();
    if (mode === 'browser-zoom') document.documentElement.style.zoom = '2';
    if (mode === 'dynamic-type') document.documentElement.style.fontSize = '150%';
    if (mode === 'long-content' && selected) {
      const textTarget =
        [...selected.querySelectorAll<HTMLElement>('h1,h2,h3,p,span,button,a')].find((element) =>
          Boolean(element.textContent?.trim()),
        ) ?? selected;
      responsiveStressTextTarget = textTarget;
      responsiveStressOriginalText = textTarget.textContent ?? '';
      textTarget.textContent = `${responsiveStressOriginalText} — longer localized content for responsive verification`;
    }
    responsiveStressMode = mode;
    document.documentElement.dataset.foundryResponsiveStress = mode;
    window.setTimeout(publishWorkspaceState, 0);
  }

  function responsiveLayoutSignature(): string {
    const root = document.documentElement;
    const body = document.body.getBoundingClientRect();
    const selectedRect = selected?.getBoundingClientRect();
    return [
      root.scrollWidth,
      root.scrollHeight,
      Math.round(body.width * 100) / 100,
      Math.round(body.height * 100) / 100,
      selectedRect ? Math.round(selectedRect.width * 100) / 100 : 0,
      selectedRect ? Math.round(selectedRect.height * 100) / 100 : 0,
    ].join(':');
  }

  async function waitForResponsiveAuditStability(timeoutMs = 2400): Promise<{
    stable: boolean;
    samples: number;
    durationMs: number;
    fontsReady: boolean;
    fontStatus: string;
  }> {
    const startedAt = performance.now();
    const maximum = Math.max(240, Math.min(5000, Number(timeoutMs) || 2400));
    let fontsReady = document.fonts.status === 'loaded';
    await Promise.race([
      document.fonts.ready.then(() => {
        fontsReady = true;
      }),
      new Promise<void>((resolve) => window.setTimeout(resolve, maximum)),
    ]);
    let previous = '';
    let matchingSamples = 0;
    let samples = 0;
    while (performance.now() - startedAt < maximum) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const signature = responsiveLayoutSignature();
      samples += 1;
      if (signature === previous) matchingSamples += 1;
      else matchingSamples = 0;
      previous = signature;
      if (matchingSamples >= 2) break;
    }
    return {
      stable: matchingSamples >= 2,
      samples,
      durationMs: Math.round(performance.now() - startedAt),
      fontsReady,
      fontStatus: document.fonts.status,
    };
  }

  function responsiveAuditFindingSnapshot(element: HTMLElement): HealthFinding[] {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const backgroundColor = opaqueBackground(element);
    const animationDuration = durationMilliseconds(style.animationDuration);
    const transitionDuration = durationMilliseconds(style.transitionDuration);
    const interactive = isInteractiveElement(element);
    const keyboardCandidate =
      interactive &&
      element.getAttribute('aria-disabled') !== 'true' &&
      !(
        (element instanceof HTMLButtonElement ||
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement) &&
        element.disabled
      );
    return auditHealthSnapshot({
      hasVisibleText: Boolean(directText(element)),
      color: style.color,
      backgroundColor,
      fontSize: Number.parseFloat(style.fontSize) || 16,
      fontWeight: Number.parseFloat(style.fontWeight) || 400,
      interactive,
      targetSizeEligible:
        interactive && !(element.tagName === 'A' && ['inline', 'contents'].includes(style.display)),
      accessibleName: accessibleName(element),
      keyboardCandidate,
      keyboardReachable: keyboardCandidate ? keyboardReachable(element) : false,
      positiveTabIndex: element.tabIndex > 0,
      imageElement: element instanceof HTMLImageElement,
      imageHasAlternative:
        !(element instanceof HTMLImageElement) ||
        element.hasAttribute('alt') ||
        Boolean(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby')),
      width: rect.width,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      motionDuration: Math.max(animationDuration, transitionDuration),
      reducedMotionProtected:
        Math.max(animationDuration, transitionDuration) <= 300 || hasReducedMotionRule(element),
      layoutMode: style.display,
      gap: Number.parseFloat(style.gap) || 0,
      spacingTokens: (designGraph?.tokens ?? []).filter((token) => token.category === 'spacing'),
      contrastFix: accessibleTextColor(element, backgroundColor),
    });
  }

  async function responsiveAudit(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const stability = await waitForResponsiveAuditStability(Number(payload.timeoutMs));
    const elements = collectLayerElements(document)
      .filter(
        (element) =>
          element.getAttribute('aria-hidden') !== 'true' &&
          isVisibleLayer(element) &&
          element !== document.documentElement &&
          element !== document.body,
      )
      .slice(0, 10_000);
    const geometry = elements.map((element) => {
      const rect = element.getBoundingClientRect();
      const computed = getComputedStyle(element);
      return {
        id: foundryTargetId(element),
        selector: foundrySelector(element),
        source: element.dataset.foundrySource ?? null,
        label: layerLabel(element),
        rect: {
          x: Number(rect.x.toFixed(2)),
          y: Number(rect.y.toFixed(2)),
          width: Number(rect.width.toFixed(2)),
          height: Number(rect.height.toFixed(2)),
          top: Number(rect.top.toFixed(2)),
          right: Number(rect.right.toFixed(2)),
          bottom: Number(rect.bottom.toFixed(2)),
          left: Number(rect.left.toFixed(2)),
        },
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        lineCount: measuredTextLineCount(element) ?? 0,
        display: computed.display,
        whiteSpace: computed.whiteSpace,
      };
    });
    const findings = elements.flatMap((element) =>
      responsiveAuditFindingSnapshot(element).map((finding) => ({
        ...finding,
        id: `${foundrySelector(element)}:${finding.ruleId}`,
        selector: foundrySelector(element),
        source: element.dataset.foundrySource ?? null,
        label: layerLabel(element),
      })),
    );
    return {
      frame: {
        id: String(payload.frameId ?? currentPreviewContext.viewport.id ?? 'current'),
        viewportId: String(payload.viewportId ?? currentPreviewContext.viewport.id ?? 'current'),
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
        href: location.href,
      },
      fonts: { ready: stability.fontsReady, status: stability.fontStatus },
      stableLayout: {
        stable: stability.stable,
        samples: stability.samples,
        durationMs: stability.durationMs,
      },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      },
      elements: geometry,
      findings,
      summary: {
        scanned: geometry.length,
        findings: findings.length,
        high: findings.filter((finding) => finding.severity === 'high').length,
        medium: findings.filter((finding) => finding.severity === 'medium').length,
        low: findings.filter((finding) => finding.severity === 'low').length,
      },
      context: currentPreviewContext,
      auditedAt: new Date().toISOString(),
    };
  }

  async function replaceWorkspaceDesignGraph(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const candidate = (payload.designGraph ?? payload.graph) as Record<string, unknown> | undefined;
    if (!candidate || typeof candidate !== 'object') throw new Error('A design graph is required');
    for (const field of ['tokens', 'components', 'breakpoints', 'themes', 'states']) {
      if (!Array.isArray(candidate[field]))
        throw new Error(`Design graph ${field} must be an array`);
    }
    const expectedRevision = String(payload.expectedRevision ?? '');
    const currentRevision = designGraph?.revision ?? '';
    if (expectedRevision && currentRevision && expectedRevision !== currentRevision) {
      throw new Error(
        `Design graph revision conflict: expected ${expectedRevision}, current ${currentRevision}`,
      );
    }
    const nextGraph = {
      ...(candidate as NonNullable<typeof designGraph>),
      components: normalizeWorkshopComponents(
        candidate.components as ComponentWorkshopDefinition[],
      ),
      motionPresets: Array.isArray(candidate.motionPresets) ? candidate.motionPresets : [],
    };

    const previousGraph = designGraph;
    const previousApplication = lastPreviewApplication;
    const previousThemeBaseline = {
      attributes: new Map(previewThemeBaseline.attributes),
      classes: new Map(previewThemeBaseline.classes),
    };
    const activeContext = currentPreviewContext;
    try {
      restorePreviewState();
      restorePreviewState = (): void => {};
      restoreConfiguredPreviewTheme();
      previewThemeBaseline.attributes.clear();
      previewThemeBaseline.classes.clear();
      designGraph = nextGraph;
      capturePreviewThemeBaseline();

      const reappliedContext = await applyPreviewContext({
        ...activeContext,
        requestRevision: Math.max(previewApplicationRevision, activeContext.requestRevision) + 1,
      });
      let previewContextPreserved = reappliedContext.applied;
      let activeContextResult = reappliedContext;
      if (!previewContextPreserved) {
        activeContextResult = await applyPreviewContext({
          version: PREVIEW_CONTEXT_VERSION,
          requestRevision:
            Math.max(previewApplicationRevision, reappliedContext.requestRevision) + 1,
          viewport: { id: 'current' },
          theme: 'current',
          state: 'current',
          motionPreference: 'system',
          ...(activeContext.selectedTarget ? { selectedTarget: activeContext.selectedTarget } : {}),
        });
        if (!activeContextResult.applied) {
          throw new Error(
            activeContextResult.failureReason ||
              'The refreshed design graph could not restore a safe preview baseline',
          );
        }
        previewContextPreserved = false;
      }

      populateDesignContext();
      if (!layersPanel.hidden) renderLayers();
      if (!componentWorkshopPanel.hidden) renderComponentWorkshop();
      if (!healthPanel.hidden) scanDesignHealth();
      publishWorkspaceState();
      return {
        replaced: true,
        revision: designGraph.revision ?? null,
        previewContext: {
          preserved: previewContextPreserved,
          requested: reappliedContext,
          current: activeContextResult,
        },
        counts: {
          tokens: designGraph.tokens.length,
          components: designGraph.components.length,
          breakpoints: designGraph.breakpoints.length,
          themes: designGraph.themes.length,
          states: designGraph.states.length,
        },
      };
    } catch (error) {
      restorePreviewState();
      restorePreviewState = (): void => {};
      restoreConfiguredPreviewTheme();
      designGraph = previousGraph;
      previewThemeBaseline.attributes.clear();
      previewThemeBaseline.classes.clear();
      for (const [attribute, value] of previousThemeBaseline.attributes) {
        previewThemeBaseline.attributes.set(attribute, value);
      }
      for (const [className, present] of previousThemeBaseline.classes) {
        previewThemeBaseline.classes.set(className, present);
      }
      restoreConfiguredPreviewTheme();
      const restoredContext = await applyPreviewContext({
        ...activeContext,
        requestRevision: Math.max(previewApplicationRevision, activeContext.requestRevision) + 1,
      });
      if (!restoredContext.applied) {
        currentPreviewContext = {
          ...activeContext,
          requestRevision: restoredContext.requestRevision,
        };
        lastPreviewApplication = previousApplication;
      }
      populateDesignContext();
      throw error;
    }
  }

  function typographyCommandTarget(payload: Record<string, unknown>): HTMLElement {
    const selector = String(payload.selector ?? '').trim();
    const target = selector ? resolveFoundrySelector(document, selector) : selected;
    if (!target) throw new Error('Select a rendered text layer before comparing fonts');
    return target;
  }

  interface TransferableTypographyRule {
    family: string;
    cssText: string;
    baseUrl: string;
  }

  function typographyRuleFamily(cssText: string): string {
    const declaration = cssText.match(/font-family\s*:\s*([^;}]+)/i)?.[1] ?? '';
    return parseFontFamilyStack(declaration)[0]?.trim() ?? '';
  }

  function typographyFontFaceBlocks(cssText: string): string[] {
    const blocks: string[] = [];
    const normalized = cssText.toLocaleLowerCase();
    let cursor = 0;
    while (cursor < cssText.length) {
      const start = normalized.indexOf('@font-face', cursor);
      if (start < 0) break;
      const openingBrace = cssText.indexOf('{', start);
      if (openingBrace < 0) break;
      let depth = 1;
      let quote = '';
      let index = openingBrace + 1;
      for (; index < cssText.length && depth > 0; index += 1) {
        const character = cssText[index];
        const previous = cssText[index - 1];
        if (quote) {
          if (character === quote && previous !== '\\') quote = '';
          continue;
        }
        if (character === '"' || character === "'") {
          quote = character;
          continue;
        }
        if (character === '{') depth += 1;
        else if (character === '}') depth -= 1;
      }
      if (depth === 0) blocks.push(cssText.slice(start, index));
      cursor = Math.max(index, openingBrace + 1);
    }
    return blocks;
  }

  async function transferableTypographyRules(
    families: string[],
    extraStylesheets: string[] = [],
  ): Promise<TransferableTypographyRule[]> {
    const requested = new Set(families.map((family) => family.toLocaleLowerCase()));
    const rules: TransferableTypographyRule[] = [];
    const fetched = new Set<string>();
    const addRule = (cssText: string, baseUrl: string): void => {
      const family = typographyRuleFamily(cssText);
      if (!family || !requested.has(family.toLocaleLowerCase())) return;
      const key = `${family.toLocaleLowerCase()}\n${cssText}`;
      if (rules.some((rule) => `${rule.family.toLocaleLowerCase()}\n${rule.cssText}` === key))
        return;
      rules.push({ family, cssText, baseUrl });
    };
    const visitRules = (cssRules: CSSRuleList, baseUrl: string): void => {
      for (const rule of cssRules) {
        if (rule.type === CSSRule.FONT_FACE_RULE) addRule(rule.cssText, baseUrl);
        const nested = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules;
        if (nested) visitRules(nested, baseUrl);
      }
    };
    const readStylesheet = async (href: string): Promise<void> => {
      const absolute = new URL(href, document.baseURI).href;
      if (fetched.has(absolute)) return;
      fetched.add(absolute);
      try {
        const response = await fetch(absolute, {
          credentials: new URL(absolute).origin === location.origin ? 'same-origin' : 'omit',
        });
        if (!response.ok) return;
        typographyFontFaceBlocks(await response.text()).forEach((block) =>
          addRule(block, absolute),
        );
      } catch {
        // A caller may still provide the isolated font stylesheet to the inspector directly.
      }
    };
    for (const sheet of document.styleSheets) {
      const baseUrl = sheet.href || document.baseURI;
      try {
        visitRules(sheet.cssRules, baseUrl);
      } catch {
        if (sheet.href) await readStylesheet(sheet.href);
      }
    }
    for (const href of extraStylesheets) await readStylesheet(href);
    return rules;
  }

  function typographyDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolveData, rejectData) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolveData(String(reader.result)), { once: true });
      reader.addEventListener('error', () => rejectData(reader.error), { once: true });
      reader.readAsDataURL(blob);
    });
  }

  async function inlineTypographyRuleUrls(
    rule: TransferableTypographyRule,
  ): Promise<{ cssText: string; complete: boolean }> {
    const matches = [...rule.cssText.matchAll(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi)];
    let cssText = rule.cssText;
    let complete = true;
    for (const match of matches.reverse()) {
      if (match.index == null) continue;
      const rawUrl = (match[2] ?? '').trim();
      if (/^(?:data:|blob:)/i.test(rawUrl)) continue;
      const absolute = new URL(rawUrl, rule.baseUrl).href;
      try {
        const response = await fetch(absolute, {
          credentials: new URL(absolute).origin === location.origin ? 'same-origin' : 'omit',
        });
        if (!response.ok) throw new Error(`Font resource returned ${response.status}`);
        const replacement = `url("${await typographyDataUrl(await response.blob())}")`;
        cssText = `${cssText.slice(0, match.index)}${replacement}${cssText.slice(
          match.index + match[0].length,
        )}`;
      } catch {
        complete = false;
      }
    }
    return { cssText, complete };
  }

  async function typographyComparisonResources(
    current: Record<string, unknown>,
    candidate: Record<string, unknown>,
    origin: 'google' | 'local' | 'project',
    googleStylesheet?: string,
  ): Promise<Record<string, unknown>> {
    const faces = [
      { role: 'current', measurement: current },
      { role: 'candidate', measurement: candidate },
    ] as const;
    const families: [string, string] = [
      String(current.primaryFamily ?? current.family ?? '').trim(),
      String(candidate.primaryFamily ?? candidate.family ?? '').trim(),
    ];
    const sourceRules = await transferableTypographyRules(
      families,
      googleStylesheet ? [googleStylesheet] : [],
    );
    const preparedRules = await Promise.all(sourceRules.map(inlineTypographyRuleUrls));
    const cssRules = preparedRules.filter((rule) => rule.complete).map((rule) => rule.cssText);
    const resourceFaces = faces.map(({ role, measurement }) => {
      const family = role === 'current' ? families[0] : families[1];
      const matchingSourceRules = sourceRules
        .map((rule, ruleIndex) => ({ rule, prepared: preparedRules[ruleIndex] }))
        .filter(({ rule }) => rule.family.toLocaleLowerCase() === family.toLocaleLowerCase());
      const registeredFaces = [...document.fonts].filter(
        (face) =>
          (parseFontFamilyStack(face.family)[0] ?? face.family).toLocaleLowerCase() ===
          family.toLocaleLowerCase(),
      );
      const localFace = role === 'candidate' && origin === 'local';
      const systemFace = registeredFaces.length === 0 && matchingSourceRules.length === 0;
      if (localFace || systemFace) {
        const escaped = family.replaceAll('"', '\\"');
        cssRules.push(
          `@font-face{font-family:"${escaped}";src:local("${escaped}");font-style:${String(
            measurement.style ?? 'normal',
          )};font-weight:${String(measurement.weight ?? 400)}}`,
        );
      }
      const googleFallback = role === 'candidate' && origin === 'google' && googleStylesheet;
      const transferable =
        localFace ||
        systemFace ||
        matchingSourceRules.some(({ prepared }) => prepared?.complete === true) ||
        Boolean(googleFallback);
      return {
        role,
        family,
        weight: String(measurement.weight ?? 400),
        style: String(measurement.style ?? 'normal'),
        size: String(measurement.fontSize ?? '16px'),
        text: String(measurement.text ?? 'BESbswy').slice(0, 32),
        renderable: transferable,
        ...(transferable
          ? {}
          : {
              reason: `${family} was measurable in the product preview, but its font resource could not be transferred to the visible comparison.`,
            }),
      };
    });
    return {
      cssText: cssRules.join('\n'),
      stylesheets:
        origin === 'google' &&
        googleStylesheet &&
        !cssRules.some((rule) => rule.includes(families[1]))
          ? [googleStylesheet]
          : [],
      faces: resourceFaces,
    };
  }

  async function typographySpecimenMeasurement(
    element: HTMLElement,
    options: {
      family?: string;
      weight?: number;
      style?: string;
      variationSettings?: string;
      text?: string;
    } = {},
  ): Promise<Record<string, unknown>> {
    const sourceStyle = getComputedStyle(element);
    const sourceRect = element.getBoundingClientRect();
    const candidate = Boolean(options.family);
    const specimen = candidate ? (element.cloneNode(true) as HTMLElement) : element;
    if (candidate) {
      specimen.removeAttribute('id');
      specimen.querySelectorAll<HTMLElement>('[id]').forEach((item) => item.removeAttribute('id'));
      Object.assign(specimen.style, {
        position: 'fixed',
        left: '-20000px',
        top: '0',
        margin: '0',
        boxSizing: sourceStyle.boxSizing,
        width: `${sourceRect.width}px`,
        height: `${sourceRect.height}px`,
        minWidth: `${sourceRect.width}px`,
        maxWidth: `${sourceRect.width}px`,
        minHeight: `${sourceRect.height}px`,
        maxHeight: `${sourceRect.height}px`,
        padding: sourceStyle.padding,
        border: sourceStyle.border,
        fontFamily: fontFamilyDeclaration(options.family!, sourceStyle.fontFamily),
        fontSize: sourceStyle.fontSize,
        fontWeight: String(options.weight ?? sourceStyle.fontWeight),
        fontStyle: options.style ?? sourceStyle.fontStyle,
        fontVariationSettings: options.variationSettings ?? sourceStyle.fontVariationSettings,
        lineHeight: sourceStyle.lineHeight,
        letterSpacing: sourceStyle.letterSpacing,
        whiteSpace: sourceStyle.whiteSpace,
        overflowWrap: sourceStyle.overflowWrap,
        wordBreak: sourceStyle.wordBreak,
        textAlign: sourceStyle.textAlign,
        textTransform: sourceStyle.textTransform,
        textIndent: sourceStyle.textIndent,
        direction: sourceStyle.direction,
        writingMode: sourceStyle.writingMode,
        overflow: sourceStyle.overflow,
        opacity: '0',
        pointerEvents: 'none',
        zIndex: '-1',
      });
      if (typeof options.text === 'string') specimen.textContent = options.text;
      document.body.append(specimen);
    }
    try {
      await document.fonts.ready;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const computed = getComputedStyle(specimen);
      const rect = specimen.getBoundingClientRect();
      const primaryFamily = parseFontFamilyStack(computed.fontFamily)[0] ?? computed.fontFamily;
      const escapedFamily = primaryFamily.replaceAll('"', '\\"');
      const fontCheck = document.fonts.check(
        `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} "${escapedFamily}"`,
        specimen.textContent?.trim().slice(0, 32) || 'BESbswy',
      );
      const matchingFaces = [...document.fonts].filter(
        (face) =>
          parseFontFamilyStack(face.family)[0]?.toLocaleLowerCase() ===
          primaryFamily.toLocaleLowerCase(),
      );
      const clipped =
        (['hidden', 'clip'].includes(computed.overflowX) &&
          specimen.scrollWidth > specimen.clientWidth + 1) ||
        (['hidden', 'clip'].includes(computed.overflowY) &&
          specimen.scrollHeight > specimen.clientHeight + 1);
      const width = Number(rect.width.toFixed(2));
      const height = Number(rect.height.toFixed(2));
      const visibleSpecimen = {
        version: 1,
        text: specimen.textContent ?? '',
        width,
        height,
        boxSizing: computed.boxSizing,
        display: computed.display,
        alignItems: computed.alignItems,
        justifyContent: computed.justifyContent,
        paddingTop: computed.paddingTop,
        paddingRight: computed.paddingRight,
        paddingBottom: computed.paddingBottom,
        paddingLeft: computed.paddingLeft,
        borderTopWidth: computed.borderTopWidth,
        borderRightWidth: computed.borderRightWidth,
        borderBottomWidth: computed.borderBottomWidth,
        borderLeftWidth: computed.borderLeftWidth,
        borderTopStyle: computed.borderTopStyle,
        borderRightStyle: computed.borderRightStyle,
        borderBottomStyle: computed.borderBottomStyle,
        borderLeftStyle: computed.borderLeftStyle,
        fontFamily: computed.fontFamily,
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        fontStyle: computed.fontStyle,
        fontVariationSettings: computed.fontVariationSettings,
        lineHeight: computed.lineHeight,
        letterSpacing: computed.letterSpacing,
        whiteSpace: computed.whiteSpace,
        overflowWrap: computed.overflowWrap,
        wordBreak: computed.wordBreak,
        textAlign: computed.textAlign,
        textTransform: computed.textTransform,
        textIndent: computed.textIndent,
        direction: computed.direction,
        writingMode: computed.writingMode,
        overflowX: computed.overflowX,
        overflowY: computed.overflowY,
      };
      return {
        text: specimen.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        family: computed.fontFamily,
        primaryFamily,
        weight: computed.fontWeight,
        style: computed.fontStyle,
        variationSettings: computed.fontVariationSettings,
        fontSize: computed.fontSize,
        lineHeight: computed.lineHeight,
        letterSpacing: computed.letterSpacing,
        loadedFaceStatus: fontCheck
          ? matchingFaces.some((face) => face.status !== 'loaded')
            ? 'loading'
            : 'loaded'
          : 'missing',
        fontCheck,
        lineCount: measuredTextLineCount(specimen) ?? 1,
        width,
        height,
        scrollWidth: specimen.scrollWidth,
        scrollHeight: specimen.scrollHeight,
        clientWidth: specimen.clientWidth,
        clientHeight: specimen.clientHeight,
        clipped,
        visibleSpecimen,
      };
    } finally {
      if (candidate) specimen.remove();
    }
  }

  function googleFontFromPayload(
    payload: Record<string, unknown>,
    family: string,
  ): GoogleFontFamily {
    const supplied = payload.font as GoogleFontFamily | undefined;
    const font =
      supplied?.family === family
        ? supplied
        : googleTypographyFonts.find(
            (item) => item.family.toLocaleLowerCase() === family.toLocaleLowerCase(),
          );
    if (!font) throw new Error(`Google Font ${family} is not available in the loaded catalog`);
    return font;
  }

  function googleSelectionFromPayload(
    payload: Record<string, unknown>,
    font: GoogleFontFamily,
    element: HTMLElement,
  ): GoogleFontSelection {
    const computed = getComputedStyle(element);
    const selection = defaultGoogleFontSelection(
      font,
      Number(payload.weight ?? (Number.parseInt(computed.fontWeight, 10) || 400)),
      payload.style === 'italic' ? 'italic' : 'normal',
    );
    if (payload.axes && typeof payload.axes === 'object') {
      selection.axes = {
        ...selection.axes,
        ...(payload.axes as Record<string, number>),
      };
    }
    return selection;
  }

  async function compareTypography(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const element = typographyCommandTarget(payload);
    const family = String(payload.family ?? '').trim();
    if (!family) throw new Error('A candidate font family is required');
    const origin =
      payload.origin === 'google' ? 'google' : payload.origin === 'local' ? 'local' : 'project';
    if (
      origin === 'project' &&
      !collectProjectFonts(document, element).some(
        (font) => font.family.toLocaleLowerCase() === family.toLocaleLowerCase(),
      )
    ) {
      throw new Error(`Project font ${family} is not indexed`);
    }
    if (
      origin === 'local' &&
      !localTypographyFonts.some(
        (font) => font.family.toLocaleLowerCase() === family.toLocaleLowerCase(),
      )
    ) {
      throw new Error(`Local font ${family} is not permitted for this preview`);
    }
    const changeCountBefore = recordedChangeCount;
    let previewLink: HTMLLinkElement | undefined;
    let selection: GoogleFontSelection | undefined;
    if (origin === 'google') {
      selection = googleSelectionFromPayload(
        payload,
        googleFontFromPayload(payload, family),
        element,
      );
      previewLink = await loadGoogleFontStylesheet(selection);
    }
    try {
      const [current, candidate] = await Promise.all([
        typographySpecimenMeasurement(element),
        typographySpecimenMeasurement(element, {
          family,
          weight: Number(payload.weight) || undefined,
          style: String(payload.style ?? getComputedStyle(element).fontStyle),
          variationSettings: selection ? googleFontVariationSettings(selection) : undefined,
          text: typeof payload.text === 'string' ? payload.text : undefined,
        }),
      ]);
      const fontResources = await typographyComparisonResources(
        current,
        candidate,
        origin,
        previewLink?.href,
      );
      return {
        current,
        candidate,
        origin,
        context: currentPreviewContext,
        temporary: true,
        changeCountDelta: recordedChangeCount - changeCountBefore,
        fontResources,
      };
    } finally {
      previewLink?.remove();
    }
  }

  async function useTypographyFont(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const element = typographyCommandTarget(payload);
    if (element !== selected) select(element);
    const family = String(payload.family ?? '').trim();
    if (!family) throw new Error('A font family is required');
    const origin =
      payload.origin === 'google' ? 'google' : payload.origin === 'local' ? 'local' : 'project';
    const familyControl = selectedControls.find((item) => item.property === 'fontFamily');
    if (!familyControl)
      throw new Error('The selected target does not expose a font-family control');
    if (origin === 'local') {
      if (
        !localTypographyFonts.some(
          (font) => font.family.toLocaleLowerCase() === family.toLocaleLowerCase(),
        )
      ) {
        throw new Error(`Local font ${family} is not permitted for this preview`);
      }
      restoreTypographyPreview();
      typographyPreview = {
        element,
        inlineFamily: element.style.fontFamily,
        inlineWeight: element.style.fontWeight,
        inlineStyle: element.style.fontStyle,
        inlineVariationSettings: element.style.fontVariationSettings,
        family,
        origin: 'local',
      };
      element.style.fontFamily = fontFamilyDeclaration(family, String(familyControl.read()));
      selectedControls = controlsFor(element);
      publishWorkspaceState();
      return {
        staged: false,
        previewOnly: true,
        changes: 0,
        reason: 'Local fonts cannot be mapped to portable project source',
      };
    }
    const currentFamily = String(familyControl.read());
    if (origin === 'project') {
      if (
        !collectProjectFonts(document, element).some(
          (font) => font.family.toLocaleLowerCase() === family.toLocaleLowerCase(),
        )
      ) {
        throw new Error(`Project font ${family} is not indexed`);
      }
      const next = fontFamilyDeclaration(family, currentFamily);
      if (next === currentFamily)
        return { staged: false, changes: 0, reason: 'Font is already active' };
      const outcome = await applyControlValue(familyControl, next, `Use ${family}`);
      if (!outcome.recorded) {
        throw new Error('The font preview changed, but its source change could not be recorded');
      }
      selectedControls = controlsFor(element);
      publishWorkspaceState();
      return { staged: true, changes: 1, family, origin };
    }
    const selection = googleSelectionFromPayload(
      payload,
      googleFontFromPayload(payload, family),
      element,
    );
    const strategy = (payload.strategy ?? googleTypographyStrategy) as FontInstallStrategy;
    if (!fontInstallStrategies.some((item) => item.id === strategy)) {
      throw new Error(`Font source strategy ${String(strategy)} is not supported`);
    }
    const link = await loadGoogleFontStylesheet(selection, true);
    const integration = buildFontIntegrationPlan(selection, strategy, currentFamily);
    const validation = currentTypographyValidationPlan();
    const evidence = [
      'Google Fonts CSS2 preview loaded',
      `font integration plan: ${JSON.stringify(integration)}`,
      `font integration strategy: ${strategy}`,
      `Google Fonts family: ${family}`,
      ...integration.sourceActions.map((action) => `source action: ${action}`),
      ...integration.verificationChecks.map((check) => `verification check: ${check}`),
      ...typographyValidationEvidence(validation),
    ];
    const next = fontFamilyDeclaration(family, currentFamily);
    if (next === currentFamily) {
      link.remove();
      return { staged: false, changes: 0, reason: 'Font is already active' };
    }
    const outcome = await applyControlValue(
      familyControl,
      next,
      `Use ${family} through ${
        fontInstallStrategies.find((item) => item.id === strategy)?.label.toLocaleLowerCase() ??
        strategy
      }`,
      evidence,
    );
    if (!outcome.recorded) {
      throw new Error('The font preview changed, but its source plan could not be recorded');
    }
    pendingGoogleFontFamilies.add(family.toLocaleLowerCase());
    selectedControls = controlsFor(element);
    publishWorkspaceState();
    return { staged: true, changes: 1, family, origin, sourcePlan: integration };
  }

  function publishWorkspaceState(): void {
    if (!embeddedWorkspace) return;
    const publish = (): void => {
      window.parent.postMessage(
        {
          type: 'foundry:workspace-state',
          sessionId,
          payload: workspaceSnapshot(),
        },
        workspaceParentOrigin,
      );
    };
    if (verificationChild) {
      publish();
      return;
    }
    cancelAnimationFrame(workspacePublishFrame);
    workspacePublishFrame = requestAnimationFrame(publish);
  }

  function publishCanvasInput(action: string, payload: Record<string, unknown> = {}): void {
    if (!embeddedWorkspace) return;
    window.parent.postMessage(
      {
        type: 'foundry:canvas-input',
        sessionId,
        payload: { action, ...payload },
      },
      workspaceParentOrigin,
    );
  }

  function publishWorkspaceResult(
    requestId: string | undefined,
    result: { ok: true; payload: unknown } | { ok: false; error: string; payload?: unknown },
  ): void {
    if (!requestId) return;
    window.parent.postMessage(
      {
        type: 'foundry:workspace-result',
        sessionId,
        requestId,
        ...result,
      },
      workspaceParentOrigin,
    );
  }

  async function executeWorkspaceCommand(
    command: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    // A specimen is a read-only rendering endpoint, never an editing/Apply endpoint.
    if (componentSpecimen && !['preview-ping', 'render-component-specimen'].includes(command)) {
      throw new Error('Component specimens are read-only. Return to Canvas to edit source.');
    }
    if (command === 'render-component-specimen') {
      if (!componentSpecimen || !embeddedWorkspace)
        throw new Error('Component specimens require an isolated preview frame.');
      await initialHydration;
      if (!hydratedOnce) throw new Error('The project index has not loaded.');
      const componentId = String(payload.componentId ?? '');
      const entry = workshopCatalog().find(
        (item) =>
          item.id === componentId ||
          item.definition?.id === componentId ||
          item.name === componentId,
      );
      const target = entry?.elements[Number(payload.instanceIndex ?? 0)];
      if (!entry || !target)
        throw new Error('No live instance of this component exists on this page.');
      const variantId = String(payload.variantId ?? '');
      const variant = variantId
        ? entry.definition?.variants.find((item) => item.id === variantId)
        : undefined;
      if (variantId && (!variant || !Object.keys(variant.props).length))
        throw new Error('This variant has no authored preview mapping.');
      if (variant) {
        const support = nextVariantSnapshot(target)?.variants.find(
          (item) => item.id === variant.id,
        );
        if (!support?.supported)
          throw new Error(support?.reason ?? 'This variant has no confirmed live CSS hook.');
      }
      // Preserve the original element, ancestors, layout constraints and project styles.
      // Do not call select(), previewWorkshopVariant() or record(): those own user state.
      const context = await applyPreviewContext({
        version: 1,
        requestRevision: currentPreviewContext.requestRevision + 1,
        viewport: { id: 'current', width: innerWidth, height: innerHeight },
        theme: String(payload.theme ?? 'current'),
        state: String(payload.state ?? 'current'),
        motionPreference: 'system',
        selectedTarget: { id: foundryTargetId(target), selector: foundrySelector(target) },
      });
      if (!context.applied && context.reloadQuery)
        return {
          rendered: false,
          reloadQuery: context.reloadQuery,
          managedStateKeys: [
            ...new Set(
              (designGraph?.states ?? []).flatMap((state) => Object.keys(state.query ?? {})),
            ),
          ],
        };
      if (!context.applied)
        throw new Error(
          context.failureReason ??
            'This state requires a route reload. Preview it in State Workbench.',
        );
      for (const [attribute, value] of variant ? inspectorVariantAttributes(variant) : [])
        target.setAttribute(attribute, value);
      const stability = await waitForResponsiveAuditStability();
      if (!stability.fontsReady || !stability.stable)
        throw new Error('Fonts or layout did not settle. Retry when the project is ready.');
      // Scroll only this document. scrollIntoView also scrolls the parent Workshop.
      const beforeScroll = target.getBoundingClientRect();
      window.scrollTo({
        top: scrollY + beforeScroll.y + beforeScroll.height / 2 - innerHeight / 2,
        left: 0,
        behavior: 'instant',
      });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const rect = target.getBoundingClientRect();
      const style = getComputedStyle(target);
      if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none')
        throw new Error('This variant is not visible in the current context.');
      if (rect.width > innerWidth || rect.height > innerHeight)
        throw new Error('This component exceeds the preview viewport. Inspect it on Canvas.');
      const background = opaqueBackground(target.parentElement ?? document.body);
      target.setAttribute('data-foundry-specimen-target', '');
      const isolation = document.createElement('style');
      isolation.textContent =
        'body { visibility: hidden !important; } body *:not([data-foundry-specimen-target]):not([data-foundry-specimen-target] *):not(:has([data-foundry-specimen-target])) { visibility: hidden !important; } [data-foundry-specimen-target] { visibility: visible !important; } [data-foundry-overlay] { display: none !important; }';
      document.head.append(isolation);
      return {
        rendered: true,
        componentId,
        variantId,
        targetId: foundryTargetId(target),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        background,
        viewport: { width: innerWidth, height: innerHeight },
        evidence: { fontsReady: true, stable: true, method: 'authored-dom-in-isolated-frame' },
      };
    }
    if (command === 'inspector-variant') {
      const element = selected;
      if (
        !element ||
        selectedElements.length !== 1 ||
        foundryTargetId(element) !== payload.targetId
      )
        throw new Error('The selection changed. Select one component before choosing a variant.');
      if (payload.action === 'cancel') {
        if (inspectorDraft?.property.startsWith('variant:')) cancelInspectorDraft();
        publishWorkspaceState();
        return { cancelled: true };
      }
      if (!['preview', 'commit'].includes(String(payload.action)))
        throw new Error('Unknown variant action.');
      const snapshot = nextVariantSnapshot(element);
      const definition = nextVariantDefinition(element);
      const variant = definition?.variants.find((item) => item.id === payload.variantId);
      const support = snapshot?.variants.find((item) => item.id === payload.variantId);
      if (!variant || !support?.supported)
        throw new Error(
          support?.reason ?? 'This authored variant is unavailable for the selected component.',
        );
      if (!targetFor(element).source)
        throw new Error('This component needs an exact source mapping before editing variants.');
      const attributes = inspectorVariantAttributes(variant);
      cancelInspectorDraft();
      if (payload.action === 'preview') {
        inspectorDraft = {
          element,
          property: `variant:${variant.id}`,
          restores: [
            variantRestoration(
              element,
              attributes.map(([name]) => name),
            ),
          ],
        };
        measureVariantMutation(element, () =>
          attributes.forEach(([name, value]) => element.setAttribute(name, value)),
        );
        selectedControls = controlsFor(element);
        updateOutline();
        publishWorkspaceState();
        return { previewed: true, recorded: false, variantId: variant.id };
      }
      const gestureId = crypto.randomUUID();
      let recordedCount = 0;
      for (const [attribute, value] of attributes) {
        const key = Object.keys(variant.props).find(
          (key) =>
            `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}` === attribute,
        )!;
        const before = element.getAttribute(attribute) ?? '';
        if (before === value && element.hasAttribute(attribute)) continue;
        const restoreBefore = variantRestoration(element, [attribute]);
        measureVariantMutation(element, () => element.setAttribute(attribute, value));
        const control: Control = {
          category: 'content',
          property: `variant.${key}`,
          label: `${definition!.name} ${key}`,
          kind: 'text',
          value,
          read: () => element.getAttribute(attribute) ?? '',
          apply: (next) => element.setAttribute(attribute, String(next)),
        };
        const recorded = await record(
          control,
          before,
          value,
          element,
          `Set ${variant.name} variant`,
          [
            `Inspector gesture ${gestureId}`,
            `Authored variant: ${variant.name}`,
            `Variant source: ${workshopSourceLabel(variant.source)}`,
            `Live CSS hook: ${attribute}`,
          ],
        );
        if (!recorded) {
          restoreBefore();
          if (recordedCount) nextInspectorRevision++;
          publishWorkspaceState();
          throw new Error(
            recordedCount
              ? `${recordedCount} of ${attributes.length} variant properties added to Review. Undo restores the recorded group.`
              : 'The variant could not be added to Review. The preview was restored; your choice is retained.',
          );
        }
        recordedCount++;
        pushHistory({
          element,
          property: control.property,
          category: control.category,
          label: control.label,
          before,
          after: value,
          gestureId,
          inspectorRestore: {
            before: restoreBefore,
            after: variantRestoration(element, [attribute]),
          },
        });
      }
      if (recordedCount) nextInspectorRevision++;
      selectedControls = selected ? controlsFor(selected) : [];
      updateOutline();
      publishWorkspaceState();
      return {
        recorded: recordedCount > 0,
        recordedCount,
        variantId: variant.id,
        revision: nextInspectorRevision,
      };
    }
    if (command === 'inspector-draft' || command === 'inspector-focus') {
      if (!selected || foundryTargetId(selected) !== payload.targetId)
        throw new Error('The selection changed. Choose the layer again before editing.');
      if (command === 'inspector-focus') {
        if (selectedElements.length !== 1) throw new Error('Focus requires one selected layer.');
        clearInspectorFocus();
        if (payload.enabled) {
          focusSpotlight = document.createElement('div');
          focusSpotlight.style.cssText =
            'position:fixed;pointer-events:none;z-index:2147483644;box-shadow:0 0 0 100vmax rgb(0 0 0 / 36%);border-radius:0';
          shadow.append(focusSpotlight);
          updateOutline();
        }
        return { focused: Boolean(focusSpotlight), targetId: payload.targetId };
      }
      const elements = [...selectedElements];
      const ids = elements.map(foundryTargetId).sort();
      const requestedIds = Array.isArray(payload.targetIds)
        ? [...payload.targetIds].sort()
        : [payload.targetId];
      if (JSON.stringify(ids) !== JSON.stringify(requestedIds))
        throw new Error('The selection changed. Review the selected layers before editing.');
      const property = String(payload.property ?? '');
      const properties = inspectorEditProperties(property);
      const edits = elements.flatMap((element) =>
        properties.map((name) => ({
          element,
          control: nextControlsFor(element).find((item) => item.property === name),
        })),
      );
      const control = edits[0]?.control;
      if (
        !control ||
        edits.some(
          ({ control: item }) => !item || item.kind !== control.kind || item.unit !== control.unit,
        ) ||
        (elements.length > 1 &&
          (properties.some((name) => !inspectorStyleProperties.has(name)) ||
            property === 'fontFamily'))
      )
        throw new Error('This property does not support a temporary inspector edit.');
      if (payload.action === 'cancel') {
        const restores = inspectorDraft?.restores ?? [];
        cancelInspectorDraft();
        publishWorkspaceState();
        restores.forEach((restore) => restore());
        return { cancelled: true, value: control.read() };
      }
      if (!['preview', 'commit'].includes(String(payload.action)))
        throw new Error('Unknown inspector edit action.');
      const value =
        property === 'fontFamily' && !String(payload.value).includes(',')
          ? fontFamilyDeclaration(String(payload.value), String(control.read()))
          : (payload.value as string | number);
      // Preflight every edge on every target before changing any of them.
      for (const { control: item } of edits) {
        const candidate = item!;
        const cssProperty = candidate.property.replace(
          /[A-Z]/g,
          (letter) => `-${letter.toLowerCase()}`,
        );
        const cssValue = `${value}${candidate.unit ?? ''}`;
        if (
          (candidate.kind === 'number' &&
            (String(value).trim() === '' ||
              !Number.isFinite(Number(value)) ||
              (candidate.min != null && Number(value) < candidate.min) ||
              (candidate.max != null && Number(value) > candidate.max))) ||
          (inspectorStyleProperties.has(candidate.property) &&
            !CSS.supports(cssProperty, cssValue)) ||
          (candidate.kind === 'select' && !candidate.options?.includes(String(value)))
        )
          throw new Error(
            `Enter a valid ${candidate.label.toLowerCase()}${candidate.unit ? ` in ${candidate.unit}` : ''}.`,
          );
      }
      if (
        inspectorDraft &&
        (inspectorDraft.element !== selected || inspectorDraft.property !== property)
      )
        cancelInspectorDraft();
      if (payload.action === 'commit') {
        cancelInspectorDraft();
        const gestureId = crypto.randomUUID();
        let recordedCount = 0;
        for (const { element, control: candidate } of edits) {
          const item = candidate!;
          const before = item.read();
          const restoreBefore = inspectorRestore(element, item.property);
          applyInspectorValue(item, value, element);
          const after = item.read();
          if (String(before) === String(after)) {
            restoreBefore();
            continue;
          }
          const recorded = await record(item, before, after, element, `Adjust ${item.label}`, [
            `Inspector gesture ${gestureId}`,
            `${elements.length} selected layers`,
            ...(properties.length > 1 ? [`Linked ${property}: ${properties.join(', ')}`] : []),
          ]);
          if (!recorded) {
            restoreBefore();
            publishWorkspaceState();
            throw new Error(
              recordedCount
                ? `${recordedCount} of ${edits.length} property changes added to Review. The remaining properties were not changed. Undo to revert the recorded group.`
                : 'The edit could not be added to Review. The preview was restored; your input is retained.',
            );
          }
          recordedCount++;
          pushHistory({
            element,
            property: item.property,
            before,
            after,
            unit: item.unit,
            category: item.category,
            label: item.label,
            gestureId,
            inspectorRestore: {
              before: restoreBefore,
              after: inspectorRestore(element, item.property),
            },
          });
        }
        if (recordedCount) nextInspectorRevision++;
        selectedControls = selected ? controlsFor(selected) : [];
        publishWorkspaceState();
        return {
          applied: recordedCount > 0,
          recorded: recordedCount > 0,
          recordedCount,
          revision: nextInspectorRevision,
          value: control.read(),
        };
      }
      if (!inspectorDraft)
        inspectorDraft = {
          element: selected,
          property,
          restores: elements.map((element) => inspectorRestore(element, properties[0]!)),
        };
      if (property === 'fontFamily') {
        const families = collectProjectFonts(document, selected);
        const family = parseFontFamilyStack(String(value))[0] ?? String(value);
        if (!families.some((font) => font.family === family))
          throw new Error('Choose an indexed project font.');
        await document.fonts.load(`16px "${family.replaceAll('"', '')}"`);
        if (!selected || inspectorDraft?.element !== selected)
          throw new Error('The selection changed while loading the font.');
      }
      edits.forEach(({ control: item, element }) => applyInspectorValue(item!, value, element));
      updateOutline();
      return { previewed: true, recorded: false, value: control.read() };
    }
    if (
      ['apply-preview-context', 'set-context', 'audit-responsive'].includes(command) &&
      !hydratedOnce
    ) {
      await initialHydration;
      if (!hydratedOnce)
        throw new Error(
          'The project graph has not loaded. Reconnect the preview before applying a context.',
        );
    }
    if (command === 'preview-ping') {
      return {
        alive: true,
        receivedAt: Date.now(),
        ...(Number.isFinite(Number(payload.sentAt)) ? { sentAt: Number(payload.sentAt) } : {}),
        snapshot: {
          version: 1,
          verificationReady: verificationChild ? hydratedOnce : true,
          currentPreviewContext,
          lastPreviewApplication,
        },
        selection: selected
          ? { id: foundryTargetId(selected), selector: foundrySelector(selected) }
          : null,
      };
    }
    if (command === 'request-state') {
      const snapshot = workspaceSnapshot();
      publishWorkspaceState();
      return snapshot;
    }
    if (command === 'audit-responsive') return responsiveAudit(payload);
    if (command === 'replace-design-graph') return await replaceWorkspaceDesignGraph(payload);
    if (command === 'set-responsive-edit-scope') {
      const nextScope: ResponsiveEditScopeMode =
        payload.scope === 'all-breakpoints' ? 'all-breakpoints' : 'breakpoint';
      const activeBreakpoint = String(
        payload.breakpointId ??
          (currentPreviewContext.viewport.id !== 'current'
            ? currentPreviewContext.viewport.id
            : breakpoint.value || 'current'),
      );
      if (
        activeBreakpoint !== 'current' &&
        !(designGraph?.breakpoints ?? []).some((item) => item.id === activeBreakpoint)
      ) {
        throw new Error(`Breakpoint ${activeBreakpoint} is not indexed`);
      }
      const sourceMapped = Boolean(selected && targetFor(selected).source);
      if (nextScope === 'all-breakpoints' && !selected) {
        throw new Error('Select a target before editing every breakpoint');
      }
      if (nextScope === 'all-breakpoints' && !sourceMapped) {
        throw new Error('All breakpoints requires a source-mapped target');
      }
      const breakpoints =
        nextScope === 'all-breakpoints'
          ? (designGraph?.breakpoints ?? []).map((item) => item.id)
          : [activeBreakpoint];
      if (nextScope === 'all-breakpoints' && breakpoints.length === 0) {
        throw new Error('No indexed breakpoints are available');
      }
      responsiveEditScope = { scope: nextScope, activeBreakpoint };
      if ([...breakpoint.options].some((option) => option.value === activeBreakpoint)) {
        breakpoint.value = activeBreakpoint;
        syncFdcSelect(breakpoint);
      }
      publishWorkspaceState();
      return { scope: nextScope, activeBreakpoint, breakpoints, sourceMapped };
    }
    if (command === 'apply-preview-context' || command === 'set-context') {
      if (command === 'set-context' && String(payload.key) === 'scope') {
        const nextScope = String(payload.value ?? 'instance');
        if (![...scope.options].some((option) => option.value === nextScope)) {
          throw new Error(`Scope ${nextScope} is not available`);
        }
        scope.value = nextScope;
        syncFdcSelect(scope);
        publishWorkspaceState();
        return { scope: nextScope, compatibilityAlias: true };
      }
      let contextRequest: unknown = payload.context ?? payload;
      if (command === 'set-context') {
        const key = String(payload.key);
        const value = String(payload.value ?? 'current');
        const next: PreviewContext = {
          ...currentPreviewContext,
          requestRevision: ++previewApplicationRevision,
          selectedTarget: selected
            ? { id: foundryTargetId(selected), selector: foundrySelector(selected) }
            : currentPreviewContext.selectedTarget,
        };
        if (key === 'breakpoint') {
          const definition = previewGraph().breakpoints.find((item) => item.id === value);
          next.viewport = definition
            ? { id: definition.id, width: definition.width, height: definition.height }
            : { id: value };
        } else if (key === 'theme') next.theme = value;
        else if (key === 'state') next.state = value;
        else if (key === 'motion' || key === 'motionPreference') {
          next.motionPreference =
            value === 'reduce' || value === 'no-preference' ? value : 'system';
        } else {
          throw new Error(`Context axis ${key} is not supported`);
        }
        contextRequest = next;
      }
      const result = await applyPreviewContext(contextRequest);
      publishWorkspaceState();
      return result;
    }
    if (command === 'switch-design-branch' || command === 'preview-design-branch') {
      applyDesignBranch(
        Array.isArray(payload.previousChanges) ? payload.previousChanges : [],
        Array.isArray(payload.changes)
          ? payload.changes
          : Array.isArray(payload.nextChanges)
            ? payload.nextChanges
            : [],
        command === 'switch-design-branch',
      );
      return { switched: true, persisted: command === 'switch-design-branch' };
    }
    if (command === 'delete-change') {
      const changeId = String(payload.changeId ?? '');
      if (!changeId) throw new Error('A change id is required');
      return deleteReviewChange(changeId);
    }
    if (command === 'arm-agent-region' || command === 'capture-agent-region') {
      captureVisualAgentRegion();
      if (!visualAgentRegionCleanup) throw new Error('The preview could not arm region capture');
      publishWorkspaceState();
      return { armed: true };
    }
    if (command === 'clear-agent-region') {
      visualAgentRegionCleanup?.();
      visualAgentRegion = null;
      publishWorkspaceState();
      return { cleared: true };
    }
    if (command === 'set-mode') {
      workspaceCanvasTool =
        payload.mode === 'pan' ? 'pan' : payload.mode === 'interact' ? 'interact' : 'select';
      inspecting = workspaceCanvasTool === 'select';
      document.documentElement.style.cursor = workspaceCanvasTool === 'pan' ? 'grab' : '';
      updateInspectionMode();
      publishWorkspaceState();
      return { mode: workspaceCanvasTool };
    }
    if (command === 'select') {
      const selector = String(payload.selector ?? '');
      if (!selector) throw new Error('A target selector is required');
      const element = resolveFoundrySelector(document, selector);
      if (!element) throw new Error(`Target ${selector} did not resolve in this preview`);
      select(element, Boolean(payload.additive));
      if (payload.reveal)
        element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      return { selected: true, id: foundryTargetId(element), selector: foundrySelector(element) };
    }
    if (command === 'select-component-instance') {
      const componentId = String(payload.componentId ?? '');
      if (!componentId) throw new Error('A component id is required');
      const entry = workshopCatalog().find(
        (item) =>
          item.id === componentId ||
          item.definition?.id === componentId ||
          item.name === componentId,
      );
      const element = entry?.elements[Number(payload.index ?? 0)];
      if (!element) throw new Error(`Component instance ${componentId} did not resolve`);
      select(element);
      return { selected: true, id: foundryTargetId(element) };
    }
    if (command === 'preview-component-state') {
      if (!selected) throw new Error('Select a component instance before previewing a state');
      const stateId = String(payload.stateId ?? 'current');
      const nextState: ComponentWorkshopState | undefined =
        stateId === 'current'
          ? {
              id: 'current',
              label: 'Current',
              kind: 'default',
              confidence: 'instrumented',
              evidence: ['Current rendered source state'],
            }
          : componentWorkshopStates(designGraph?.states).find((item) => item.id === stateId);
      if (!nextState) throw new Error(`State ${stateId} is not authored for this project`);
      workshopStateId = nextState.id;
      applyWorkshopStatePreview(selected, nextState);
      publishWorkspaceState();
      return { previewed: true, stateId };
    }
    if (command === 'preview-component-variant' || command === 'repair-component-variant-drift') {
      workshopComponentId = String(payload.componentId ?? workshopComponentId);
      const entry = currentWorkshopEntry();
      if (!entry) throw new Error('The requested component is not available');
      const variantId = String(payload.variantId ?? '');
      const variant = entry.definition?.variants.find((item) => item.id === variantId);
      if (!variant) throw new Error(`Variant ${variantId} is not available`);
      const outcome =
        command === 'preview-component-variant'
          ? await previewWorkshopVariant(entry, variant)
          : await repairWorkshopVariantDrift(entry, variant);
      publishWorkspaceState();
      return { completed: true, componentId: entry.id, variantId, ...outcome };
    }
    if (command === 'stage-component-variant') {
      workshopComponentId = String(payload.componentId ?? workshopComponentId);
      const entry = currentWorkshopEntry();
      if (!entry?.definition)
        throw new Error('The requested source-backed component is unavailable');
      if (!String(payload.axisId ?? '').trim() || !String(payload.value ?? '').trim()) {
        throw new Error('A variant axis and value are required');
      }
      const outcome = await stageWorkshopVariant(entry, {
        axisId: String(payload.axisId),
        label: String(payload.label ?? ''),
        value: String(payload.value),
        baseVariantId: String(payload.baseVariantId ?? '') || undefined,
      });
      publishWorkspaceState();
      return { staged: true, componentId: entry.id, ...outcome };
    }
    if (command === 'stage-token-promotion') {
      const candidateId = String(payload.candidateId ?? '');
      const candidate = designGraph?.tokenPromotions?.find((item) => item.id === candidateId);
      if (!candidate) throw new Error(`Token promotion ${candidateId} is not available`);
      if (!candidate.canStage || !candidate.sources.length) {
        throw new Error(candidate.blockers[0] ?? 'This promotion has no exact source mapping');
      }
      const outcome = await stageTokenPromotion(candidateId);
      return { staged: true, candidateId, ...outcome };
    }
    if (command === 'preview-responsive-stress') {
      const mode = String(payload.mode ?? 'none');
      if (!['none', 'browser-zoom', 'dynamic-type', 'long-content'].includes(mode)) {
        throw new Error(`Responsive stress mode ${mode} is not supported`);
      }
      applyResponsiveStress(mode);
      return { previewed: true, mode };
    }
    if (command === 'preview-responsive-container') {
      const width = payload.width == null ? undefined : Number(payload.width);
      if (width !== undefined && (!selected || !nearestResponsiveContainer(selected))) {
        throw new Error('Select an element inside an indexed container first');
      }
      if (width !== undefined && (!Number.isFinite(width) || width <= 0)) {
        throw new Error('Container width must be a positive number');
      }
      previewResponsiveContainer(width);
      return { previewed: width !== undefined, width: width ?? null };
    }
    if (command === 'apply-health-stress') {
      const stressScope: StressScope = payload.scope === 'canvas' ? 'canvas' : 'selection';
      if (stressScope === 'selection' && !selected?.isConnected) {
        throw new Error('Select a connected target first');
      }
      const findings = applyStressConditions(
        Array.isArray(payload.conditions) ? payload.conditions : [],
        stressScope,
      );
      return {
        applied: true,
        scope: stressScope,
        conditions: activeStressConditions,
        findings,
      };
    }
    if (command === 'clear-health-stress') {
      stressDraftConditions = [];
      const target = activeStressTarget;
      restoreStressConditions(false);
      activeStressTarget = target;
      return { cleared: true, findings: scanDesignHealthOrThrow() };
    }
    if (command === 'select-health-issue' || command === 'preview-health-fix') {
      const issueId = String(payload.issueId ?? '');
      const issue = healthIssues.find((item) => item.id === issueId);
      if (!issue?.element.isConnected) throw new Error(`Health finding ${issueId} is unavailable`);
      if (command === 'select-health-issue') select(issue.element);
      else if (!issue.previewed) await previewHealthFix(issue);
      publishWorkspaceState();
      return { completed: true, issueId };
    }
    if (command === 'save-visual-recipe') {
      if (!selected) throw new Error('Select a target before saving a visual recipe');
      if (!previewHistory.some((entry) => entry.element === selected)) {
        throw new Error('Refine the selected target before saving a visual recipe');
      }
      const before = designMemory.recipes.length;
      saveSelectedRecipe(String(payload.name ?? ''), String(payload.intent ?? ''));
      if (designMemory.recipes.length !== before + 1)
        throw new Error('The visual recipe was not saved');
      publishWorkspaceState();
      return { saved: true, recipe: designMemory.recipes.at(-1) };
    }
    if (command === 'duplicate-visual-recipe') {
      const recipeId = String(payload.recipeId ?? '');
      const recipe = designMemory.recipes.find((item) => item.id === recipeId);
      if (!recipe) throw new Error(`Visual recipe ${recipeId} was not found`);
      const copy = {
        ...recipe,
        id: `recipe_${Date.now().toString(36)}`,
        name: `${recipe.name} copy`,
        createdAt: new Date().toISOString(),
      };
      designMemory = addRecipe(designMemory, copy);
      persistDesignMemory();
      renderDesignMemory();
      publishWorkspaceState();
      return { duplicated: true, recipe: copy };
    }
    if (command === 'remove-visual-recipe') {
      const recipeId = String(payload.recipeId ?? '');
      if (!designMemory.recipes.some((item) => item.id === recipeId)) {
        throw new Error(`Visual recipe ${recipeId} was not found`);
      }
      designMemory = removeRecipe(designMemory, recipeId);
      persistDesignMemory();
      renderDesignMemory();
      publishWorkspaceState();
      return { removed: true, recipeId };
    }
    if (command === 'apply-visual-recipe') {
      const recipeId = String(payload.recipeId ?? '');
      if (!selected) throw new Error('Select a compatible target first');
      if (!designMemory.recipes.some((item) => item.id === recipeId)) {
        throw new Error(`Visual recipe ${recipeId} was not found`);
      }
      const outcome = await applyRecipe(recipeId);
      publishWorkspaceState();
      return { recipeId, ...outcome };
    }
    if (command === 'import-visual-recipes') {
      const imported = JSON.parse(String(payload.json ?? ''));
      const recipes = Array.isArray(imported) ? imported : imported?.recipes;
      if (!Array.isArray(recipes)) throw new Error('No recipes were found in this file');
      let importedCount = 0;
      for (const recipe of recipes) {
        if (!recipe?.id || !recipe?.name || !Array.isArray(recipe.values)) continue;
        designMemory = addRecipe(designMemory, recipe);
        importedCount += 1;
      }
      persistDesignMemory();
      renderDesignMemory();
      publishWorkspaceState();
      return { imported: importedCount };
    }
    if (command === 'save-design-decision') {
      if (!String(payload.title ?? '').trim() || !String(payload.summary ?? '').trim()) {
        throw new Error('A decision title and clear guidance are required');
      }
      const before = designMemory.decisions.length;
      saveSelectedDesignDecision(payload);
      if (designMemory.decisions.length !== before + 1)
        throw new Error('The design decision was not saved');
      publishWorkspaceState();
      return { saved: true, decision: designMemory.decisions.at(-1) };
    }
    if (command === 'update-design-decision') {
      const decisionId = String(payload.decisionId ?? '');
      if (!designMemory.decisions.some((item) => item.id === decisionId)) {
        throw new Error(`Design decision ${decisionId} was not found`);
      }
      designMemory = updateDesignDecision(designMemory, decisionId, {
        title: typeof payload.title === 'string' ? payload.title.trim() : undefined,
        summary: typeof payload.summary === 'string' ? payload.summary.trim() : undefined,
        rationale: typeof payload.rationale === 'string' ? payload.rationale.trim() : undefined,
        enabled: typeof payload.enabled === 'boolean' ? payload.enabled : undefined,
      });
      persistDesignMemory();
      renderDesignMemory();
      publishWorkspaceState();
      return { updated: true, decisionId };
    }
    if (command === 'remove-design-decision') {
      const decisionId = String(payload.decisionId ?? '');
      if (!designMemory.decisions.some((item) => item.id === decisionId)) {
        throw new Error(`Design decision ${decisionId} was not found`);
      }
      designMemory = removeDesignDecision(designMemory, decisionId);
      persistDesignMemory();
      renderDesignMemory();
      publishWorkspaceState();
      return { removed: true, decisionId };
    }
    if (command === 'import-design-decisions') {
      const imported = JSON.parse(String(payload.json ?? ''));
      const decisions = Array.isArray(imported) ? imported : imported?.decisions;
      if (!Array.isArray(decisions)) throw new Error('No design decisions were found');
      let importedCount = 0;
      for (const decision of decisions) {
        if (!decision?.id || !decision?.title || !decision?.outcome) continue;
        designMemory = addDesignDecision(designMemory, {
          ...decision,
          categories: Array.isArray(decision.categories) ? decision.categories : [],
          conditions: decision.conditions ?? {},
          rules: Array.isArray(decision.rules) ? decision.rules : [],
          evidence: Array.isArray(decision.evidence) ? decision.evidence : [],
          sourceLocations: Array.isArray(decision.sourceLocations) ? decision.sourceLocations : [],
          enabled: decision.enabled !== false,
        });
        importedCount += 1;
      }
      persistDesignMemory();
      renderDesignMemory();
      publishWorkspaceState();
      return { imported: importedCount };
    }
    if (command === 'set-control') {
      if (!selected) throw new Error('Select a target before changing a control');
      if (responsiveEditScope.scope === 'all-breakpoints' && !targetFor(selected).source) {
        throw new Error('All breakpoints requires a source-mapped target');
      }
      const control =
        selectedControls[Number(payload.index)] ??
        selectedControls.find((item) => item.property === payload.property);
      if (!control)
        throw new Error(
          `Control ${String(payload.property ?? payload.index ?? '')} is unavailable`,
        );
      const outcome = await applyControlValue(
        control,
        payload.value as string | number,
        `Adjust ${control.label}`,
      );
      if (outcome.applied && !outcome.recorded) {
        throw new Error('The preview changed, but its source change could not be recorded');
      }
      selectedControls = controlsFor(selected);
      renderControls();
      publishWorkspaceState();
      return {
        applied: outcome.applied,
        recorded: outcome.recorded,
        property: control.property,
        value: control.read(),
      };
    }
    if (command === 'motion-action') {
      if (!selected) throw new Error('Select a moving layer first');
      const motionId = String(payload.id ?? '');
      const motion = findDiscoveredMotion(selected, motionId);
      const animation = motion?.animation;
      const action = String(payload.action ?? '');
      if (!motion || !animation)
        throw new Error(`Motion ${motionId} is not available on this target`);
      let outcome = { applied: true, recorded: false };
      if (action === 'scrub') {
        animation.pause();
        animation.currentTime = Number(payload.value ?? 0);
      } else if (action === 'speed') {
        animation.playbackRate = Number(payload.value ?? 1);
      } else if (action === 'toggle') {
        if (animation.playState === 'paused') animation.play();
        else animation.pause();
      } else if (action === 'replay') {
        animation.currentTime = 0;
        animation.play();
      } else if (action === 'loop') {
        toggleMotionLoop(animation);
      } else if (
        ['duration', 'delay', 'easing', 'iterations', 'direction', 'fill'].includes(action)
      ) {
        const after = ['easing', 'direction', 'fill'].includes(action)
          ? String(payload.value ?? '')
          : Number(payload.value);
        outcome = await applyMotionTiming(
          motion,
          action as 'duration' | 'delay' | 'easing' | 'iterations' | 'direction' | 'fill',
          after,
        );
      } else if (action === 'curve') {
        outcome = await applyMotionCurve(motion, requestedMotionCurve(payload));
      } else if (action === 'path-point') {
        const index = Number(payload.index);
        const frame = motion.descriptor.keyframes.find((candidate) => candidate.index === index);
        if (!frame) throw new Error(`Motion keyframe ${index} was not found`);
        const nextTransform = replaceMotionTranslation(
          String(frame.values.transform ?? 'none'),
          Number(payload.x),
          Number(payload.y),
        );
        outcome = await applyMotionKeyframe(motion, index, 'transform', nextTransform);
      } else if (['keyframe-value', 'keyframe-offset', 'keyframe-easing'].includes(action)) {
        const property =
          action === 'keyframe-value'
            ? String(payload.property ?? '')
            : action === 'keyframe-offset'
              ? 'offset'
              : 'easing';
        if (!property) throw new Error('A keyframe property is required');
        outcome = await applyMotionKeyframe(
          motion,
          Number(payload.index),
          property,
          action === 'keyframe-offset' ? Number(payload.value) : String(payload.value),
        );
      } else {
        throw new Error(`Motion action ${action} is not supported`);
      }
      if (
        outcome.applied &&
        !outcome.recorded &&
        !['scrub', 'speed', 'toggle', 'replay', 'loop'].includes(action)
      ) {
        throw new Error('The motion preview changed, but its source change could not be recorded');
      }
      publishWorkspaceState();
      return { ...outcome, action, motionId, currentTime: animation.currentTime };
    }
    if (command === 'typography-compare') return compareTypography(payload);
    if (command === 'typography-use-font') return useTypographyFont(payload);
    if (command === 'typography-action') {
      if (!selected) throw new Error('Select a rendered text layer first');
      const action = String(payload.action ?? '');
      if (action === 'compare-font') return compareTypography(payload);
      if (action === 'use-font') return useTypographyFont(payload);
      if (action === 'preview-family') {
        const family = String(payload.family ?? '').trim();
        const origin = payload.origin === 'local' ? 'local' : 'project';
        if (!family) throw new Error('A font family is required');
        if (origin === 'local' && !localTypographyFonts.some((font) => font.family === family)) {
          throw new Error(`Local font ${family} is not permitted for this preview`);
        }
        if (
          origin === 'project' &&
          !collectProjectFonts(document, selected).some((font) => font.family === family)
        ) {
          throw new Error(`Project font ${family} is not indexed`);
        }
        const control = selectedControls.find((item) => item.property === 'fontFamily');
        if (!control) throw new Error('This layer does not expose a font-family control');
        restoreTypographyPreview();
        typographyPreview = {
          element: selected,
          inlineFamily: selected.style.fontFamily,
          inlineWeight: selected.style.fontWeight,
          inlineStyle: selected.style.fontStyle,
          inlineVariationSettings: selected.style.fontVariationSettings,
          family,
          origin,
        };
        selected.style.fontFamily = fontFamilyDeclaration(family, String(control.read()));
      } else if (action === 'preview-google') {
        const font = payload.font as GoogleFontFamily | undefined;
        if (!font?.family) throw new Error('A Google Font record is required');
        await previewGoogleFont(font);
        if (typographyPreview?.family !== font.family)
          throw new Error(`${font.family} could not be previewed`);
      } else if (action === 'review-google') {
        const font = googleTypographySelection?.font;
        if (!font) throw new Error('Preview a Google Font before adding it to review');
        return useTypographyFont({
          ...payload,
          family: font.family,
          font,
          origin: 'google',
          weight: payload.weight ?? googleTypographySelection?.weight,
          style: payload.style ?? googleTypographySelection?.style,
          axes: googleTypographySelection?.axes,
        });
      } else if (action === 'preview-treatment') {
        previewTypeTreatment(String(payload.treatmentId ?? 'balanced'));
      } else if (action === 'preview-scale') {
        typographyScaleBase = Number(payload.base ?? typographyScaleBase);
        typographyScaleRatio = Number(payload.ratio ?? typographyScaleRatio);
        typographyScaleStep = Number(payload.step ?? typographyScaleStep);
        typographyScaleFluid = Boolean(payload.fluid);
        previewTypeScale();
      } else if (action === 'review-treatment') {
        if (!typographyTreatmentPreview?.treatmentId)
          throw new Error('Preview a type treatment first');
        await reviewTypeTreatment();
      } else if (action === 'review-scale') {
        if (!typographyTreatmentPreview?.scaleValue) throw new Error('Preview a type scale first');
        await reviewTypeScale();
      } else if (action === 'reset-preview') {
        restoreTypographyPreview();
      } else if (action === 'save-style') {
        typographyStyleName = String(payload.name ?? '');
        if (!typographyStyleName.trim()) throw new Error('A project style name is required');
        await saveCurrentProjectTypographyStyle();
      } else if (action === 'apply-style') {
        const styleId = String(payload.styleId ?? '');
        if (!projectTypographyStyles.some((item) => item.id === styleId))
          throw new Error(`Typography style ${styleId} was not found`);
        await applyProjectTypographyStyle(styleId);
      } else if (action === 'remove-style') {
        const styleId = String(payload.styleId ?? '');
        if (!projectTypographyStyles.some((item) => item.id === styleId))
          throw new Error(`Typography style ${styleId} was not found`);
        removeProjectTypographyStyle(styleId);
      } else {
        throw new Error(`Typography action ${action} is not supported`);
      }
      if (selected) selectedControls = controlsFor(selected);
      publishWorkspaceState();
      return { completed: true, action };
    }
    if (command === 'undo' || command === 'redo') {
      const direction = command === 'undo' ? -1 : 1;
      if (direction === -1 && historyCursor <= 0)
        throw new Error('There is no preview change to undo');
      if (direction === 1 && historyCursor >= previewHistory.length)
        throw new Error('There is no preview change to redo');
      const outcome = await replayHistory(direction);
      publishWorkspaceState();
      return { completed: true, historyCursor, ...outcome };
    }
    if (command === 'compare') {
      const mode = payload.mode === 'before' ? 'before' : 'after';
      showComparison(mode);
      publishWorkspaceState();
      return { mode };
    }
    if (command === 'interface-theme') {
      const preference = String(payload.value);
      if (preference !== 'system' && preference !== 'light' && preference !== 'dark') {
        throw new Error(`Interface theme ${preference} is not supported`);
      }
      applyInterfaceTheme(preference);
      publishWorkspaceState();
      return { preference, resolved: resolvedInterfaceTheme() };
    }
    if (command === 'scan-health') {
      activeStressScope = payload.scope === 'selection' ? 'selection' : 'canvas';
      activeStressTarget =
        activeStressScope === 'selection' && selected
          ? { element: selected, label: layerLabel(selected) }
          : null;
      return { scanned: true, findings: scanDesignHealthOrThrow() };
    }
    throw new Error(`Unknown workspace command: ${command}`);
  }

  function handleWorkspaceMessage(event: MessageEvent): void {
    if (
      !embeddedWorkspace ||
      event.source !== window.parent ||
      event.origin !== workspaceParentOrigin
    )
      return;
    const message = event.data as {
      type?: string;
      sessionId?: string;
      command?: string;
      payload?: Record<string, unknown>;
      requestId?: string;
    };
    if (message.type !== 'foundry:workspace-command' || message.sessionId !== sessionId) return;
    const payload = message.payload ?? {};
    const command = String(message.command ?? '');
    if (!command) {
      publishWorkspaceResult(message.requestId, {
        ok: false,
        error: 'Workspace command is required',
      });
      return;
    }
    void executeWorkspaceCommand(command, payload)
      .then((result) => {
        publishWorkspaceResult(message.requestId, {
          ok: true,
          payload: result ?? { acknowledged: true, command },
        });
      })
      .catch((error) => {
        const detail =
          error instanceof Error ? error.message : `Workspace command ${command} failed`;
        publishWorkspaceResult(message.requestId, { ok: false, error: detail });
        if (!message.requestId) showToast(detail);
      });
  }

  function handleEmbeddedCanvasKeyDown(event: KeyboardEvent): void {
    if (
      !embeddedWorkspace ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    )
      return;
    if (event.code === 'Space') {
      event.preventDefault();
      embeddedSpaceHeld = true;
      publishCanvasInput('space', { pressed: true });
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'h' || key === 'v') {
      event.preventDefault();
      event.stopImmediatePropagation();
      publishCanvasInput('shortcut', { key });
    }
  }

  function handleEmbeddedCanvasKeyUp(event: KeyboardEvent): void {
    if (!embeddedWorkspace || event.code !== 'Space') return;
    embeddedSpaceHeld = false;
    publishCanvasInput('space', { pressed: false });
  }

  function handleEmbeddedCanvasPointerDown(event: PointerEvent): void {
    if (!embeddedWorkspace) return;
    const shouldPan = workspaceCanvasTool === 'pan' || embeddedSpaceHeld || event.button === 1;
    if (!shouldPan || event.composedPath().includes(host)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    embeddedPanActive = true;
    embeddedPanPointer = event.target instanceof Element ? event.target : null;
    if (embeddedPanPointer instanceof HTMLElement)
      embeddedPanPointer.setPointerCapture(event.pointerId);
    document.documentElement.style.cursor = 'grabbing';
    publishCanvasInput('pan-start', {
      screenX: event.screenX,
      screenY: event.screenY,
    });
  }

  function handleEmbeddedCanvasPointerMove(event: PointerEvent): void {
    if (!embeddedPanActive) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    publishCanvasInput('pan-move', {
      screenX: event.screenX,
      screenY: event.screenY,
    });
  }

  function handleEmbeddedCanvasPointerUp(event: PointerEvent): void {
    if (!embeddedPanActive) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    embeddedPanActive = false;
    if (
      embeddedPanPointer instanceof HTMLElement &&
      embeddedPanPointer.hasPointerCapture(event.pointerId)
    )
      embeddedPanPointer.releasePointerCapture(event.pointerId);
    embeddedPanPointer = null;
    document.documentElement.style.cursor = workspaceCanvasTool === 'pan' ? 'grab' : '';
    publishCanvasInput('pan-end');
  }

  function handleEmbeddedCanvasWheel(event: WheelEvent): void {
    if (!embeddedWorkspace || event.composedPath().includes(host)) return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      publishCanvasInput('zoom-wheel', {
        deltaY: event.deltaY,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }
    if (workspaceCanvasTool === 'interact') return;
    event.preventDefault();
    publishCanvasInput('pan-wheel', {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
    });
  }

  window.addEventListener('message', handleWorkspaceMessage);
  document.addEventListener('keydown', handleEmbeddedCanvasKeyDown, true);
  document.addEventListener('keyup', handleEmbeddedCanvasKeyUp, true);
  document.addEventListener('pointerdown', handleEmbeddedCanvasPointerDown, true);
  document.addEventListener('pointermove', handleEmbeddedCanvasPointerMove, true);
  document.addEventListener('pointerup', handleEmbeddedCanvasPointerUp, true);
  document.addEventListener('pointercancel', handleEmbeddedCanvasPointerUp, true);
  document.addEventListener('wheel', handleEmbeddedCanvasWheel, {
    capture: true,
    passive: false,
  });

  const onboardingSteps: Array<{
    id: OnboardingStepId;
    title: string;
    detail: string;
  }> = [
    {
      id: 'setup',
      title: 'Setup complete',
      detail: 'The project adapter and local session are ready.',
    },
    {
      id: 'agent',
      title: 'Agent connection',
      detail: 'Keep it listening while you design. Offline batches wait safely.',
    },
    {
      id: 'selection',
      title: 'First element selected',
      detail: 'Click the canvas or choose an item in Layers.',
    },
    {
      id: 'change',
      title: 'First change recorded',
      detail: 'Adjust a measured value in the Inspector.',
    },
    {
      id: 'apply',
      title: 'First batch applied and verified',
      detail: 'Review once, update source, then measure the rebuild.',
    },
  ];

  function onboardingStorageKey(suffix: string): string {
    return `__foundry_getting_started:${suffix}:${projectRoot}`;
  }

  function loadOnboardingProgress(): void {
    onboardingCompleted.clear();
    try {
      const stored = JSON.parse(localStorage.getItem(onboardingStorageKey('completed')) ?? '[]');
      for (const id of stored) {
        if (onboardingSteps.some((step) => step.id === id)) onboardingCompleted.add(id);
      }
    } catch {
      localStorage.removeItem(onboardingStorageKey('completed'));
    }
  }

  function completeOnboardingStep(id: OnboardingStepId): void {
    if (onboardingCompleted.has(id)) return;
    onboardingCompleted.add(id);
    try {
      localStorage.setItem(
        onboardingStorageKey('completed'),
        JSON.stringify([...onboardingCompleted]),
      );
    } catch {
      // Progress remains available for this live session.
    }
    renderOnboardingChecklist();
  }

  function renderOnboardingChecklist(forceOpen = false): void {
    const nextStep = onboardingSteps.find((step) => !onboardingCompleted.has(step.id));
    const complete = !nextStep;
    const stepsRoot = onboarding.querySelector<HTMLElement>('.onboarding-steps')!;
    stepsRoot.innerHTML = onboardingSteps
      .map((step, index) => {
        const done = onboardingCompleted.has(step.id);
        const current = step.id === nextStep?.id;
        return `<div class="onboarding-step ${done ? 'complete' : ''} ${current ? 'current' : ''}"><b>${done ? '<i data-foundry-icon="check"></i>' : String(index + 1).padStart(2, '0')}</b><span><strong>${step.title}</strong><small>${step.detail}</small></span></div>`;
      })
      .join('');
    renderIcons(stepsRoot);
    const continueButton = onboarding.querySelector<HTMLButtonElement>('.onboarding-start')!;
    const action = nextStep?.id ?? 'done';
    continueButton.dataset.action = action;
    continueButton.textContent =
      action === 'agent'
        ? 'Copy restart prompt'
        : action === 'selection'
          ? 'Select an element'
          : action === 'change'
            ? 'Adjust a value'
            : action === 'apply'
              ? 'Review changes'
              : 'Done';
    const dismissed = localStorage.getItem(onboardingStorageKey('dismissed')) === '1';
    onboarding.hidden = complete || (!forceOpen && dismissed);
  }

  function utilityStorageKey(utility: Exclude<FoundryUtility, null>): string {
    return `__foundry_utility_rect:${utility}:${projectRoot}`;
  }

  function canvasBounds() {
    const layersRect = workspaceState.layersOpen ? layersPanel.getBoundingClientRect() : null;
    const inspectorRect = workspaceState.inspectorOpen ? panel.getBoundingClientRect() : null;
    const trayRect = !changeDock.hidden ? changeDock.getBoundingClientRect() : null;
    return {
      left: Math.round((layersRect?.right ?? 0) + 12),
      top: Math.round(workspaceBar.getBoundingClientRect().bottom + 12),
      right: Math.round((inspectorRect?.left ?? window.innerWidth) - 12),
      bottom: Math.round((trayRect?.top ?? window.innerHeight) - 12),
    };
  }

  function readUtilityRect(utility: Exclude<FoundryUtility, null>): FoundryRect | undefined {
    try {
      const value = JSON.parse(localStorage.getItem(utilityStorageKey(utility)) ?? 'null');
      if (value && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(value[key]))) {
        return value as FoundryRect;
      }
    } catch {
      localStorage.removeItem(utilityStorageKey(utility));
    }
    return undefined;
  }

  function utilityPanelFor(utility: Exclude<FoundryUtility, null>): HTMLElement {
    if (utility === 'health') return healthPanel;
    if (utility === 'memory') return libraryPanel;
    return componentWorkshopPanel;
  }

  function applyUtilityRect(utility: Exclude<FoundryUtility, null>): void {
    const utilityPanel = utilityPanelFor(utility);
    if (window.matchMedia('(max-width: 680px)').matches) {
      utilityPanel.style.removeProperty('left');
      utilityPanel.style.removeProperty('top');
      utilityPanel.style.removeProperty('width');
      utilityPanel.style.removeProperty('height');
      return;
    }
    const bounds = canvasBounds();
    const fallback = {
      x: bounds.left + 12,
      y: bounds.top + 12,
      width: 320,
      height: Math.min(560, Math.max(320, bounds.bottom - bounds.top - 24)),
    };
    const rect = clampUtilityRect(
      utilityRects.get(utility) ?? readUtilityRect(utility) ?? fallback,
      bounds,
    );
    utilityRects.set(utility, rect);
    Object.assign(utilityPanel.style, {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }

  function positionWorkspaceSurfaces(): void {
    const bounds = canvasBounds();
    host.style.setProperty('--fdc-canvas-left', `${Math.max(12, bounds.left)}px`);
    host.style.setProperty(
      '--fdc-canvas-right',
      `${Math.max(12, window.innerWidth - bounds.right)}px`,
    );
    host.style.setProperty('--fdc-canvas-center', `${(bounds.left + bounds.right) / 2}px`);
    host.style.setProperty('--fdc-tray-lift', '0px');
    if (workspaceState.utility) applyUtilityRect(workspaceState.utility);
  }

  function persistUtilityRect(utility: Exclude<FoundryUtility, null>, rect: FoundryRect): void {
    utilityRects.set(utility, rect);
    try {
      localStorage.setItem(utilityStorageKey(utility), JSON.stringify(rect));
    } catch {
      showToast('Panel position could not be saved in this browser');
    }
  }

  function setUtility(utility: Exclude<FoundryUtility, null> | null): void {
    const closing = utility == null;
    if (!closing && shadow.activeElement instanceof HTMLElement) {
      lastUtilityTrigger = shadow.activeElement;
    }
    workspaceState = utility
      ? updateWorkspace(workspaceState, { type: 'open-utility', utility })
      : updateWorkspace(workspaceState, { type: 'close-utility' });
    healthPanel.hidden = workspaceState.utility !== 'health';
    libraryPanel.hidden = workspaceState.utility !== 'memory';
    componentWorkshopPanel.hidden = workspaceState.utility !== 'component';
    shadow
      .querySelector<HTMLButtonElement>('.open-health')!
      .classList.toggle('active', workspaceState.utility === 'health');
    shadow
      .querySelector<HTMLButtonElement>('.open-library')!
      .classList.toggle('active', workspaceState.utility === 'memory');
    shadow
      .querySelector<HTMLButtonElement>('.open-health')!
      .setAttribute('aria-pressed', String(workspaceState.utility === 'health'));
    shadow
      .querySelector<HTMLButtonElement>('.open-library')!
      .setAttribute('aria-pressed', String(workspaceState.utility === 'memory'));
    shadow
      .querySelector<HTMLButtonElement>('.open-component-workshop')!
      .classList.toggle('active', workspaceState.utility === 'component');
    shadow
      .querySelector<HTMLButtonElement>('.open-component-workshop')!
      .setAttribute('aria-pressed', String(workspaceState.utility === 'component'));
    if (workspaceState.utility === 'health') scanDesignHealth();
    if (workspaceState.utility === 'memory') renderDesignMemory();
    if (workspaceState.utility === 'component') renderComponentWorkshop();
    positionWorkspaceSurfaces();
    if (closing) lastUtilityTrigger?.focus();
  }

  function installUtilityGeometry(
    utilityPanel: HTMLElement,
    utility: Exclude<FoundryUtility, null>,
  ): void {
    const handle = utilityPanel.querySelector<HTMLElement>('.utility-handle')!;
    const resizer = utilityPanel.querySelector<HTMLElement>('.utility-resizer')!;
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
      const start = utilityPanel.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      const move = (pointerMove: PointerEvent): void => {
        const rect = clampUtilityRect(
          {
            x: start.x + pointerMove.clientX - startX,
            y: start.y + pointerMove.clientY - startY,
            width: start.width,
            height: start.height,
          },
          canvasBounds(),
        );
        Object.assign(utilityPanel.style, {
          left: `${rect.x}px`,
          top: `${rect.y}px`,
        });
        utilityRects.set(utility, rect);
      };
      const finish = (): void => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', finish);
        handle.removeEventListener('pointercancel', finish);
        const rect = utilityRects.get(utility);
        if (rect) persistUtilityRect(utility, rect);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', finish);
      handle.addEventListener('pointercancel', finish);
    });
    resizer.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const start = utilityPanel.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      resizer.setPointerCapture(event.pointerId);
      const move = (pointerMove: PointerEvent): void => {
        const rect = clampUtilityRect(
          {
            x: start.x,
            y: start.y,
            width: start.width + pointerMove.clientX - startX,
            height: start.height + pointerMove.clientY - startY,
          },
          canvasBounds(),
        );
        Object.assign(utilityPanel.style, {
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
        utilityRects.set(utility, rect);
      };
      const finish = (): void => {
        resizer.removeEventListener('pointermove', move);
        resizer.removeEventListener('pointerup', finish);
        resizer.removeEventListener('pointercancel', finish);
        const rect = utilityRects.get(utility);
        if (rect) persistUtilityRect(utility, rect);
      };
      resizer.addEventListener('pointermove', move);
      resizer.addEventListener('pointerup', finish);
      resizer.addEventListener('pointercancel', finish);
    });
  }

  if (!sessionId || !token) {
    setSessionStatus(
      'offline',
      'Session credentials are missing. Restart Foundry for this project.',
    );
  }

  function setSessionStatus(
    stateValue: 'live' | 'saving' | 'saved' | 'offline' | 'error',
    detail = '',
  ): void {
    clearTimeout(statusResetTimer);
    sessionStatus.classList.remove('saving', 'saved', 'offline', 'error');
    if (stateValue !== 'live') sessionStatus.classList.add(stateValue);
    const label =
      stateValue === 'live'
        ? 'Live'
        : stateValue === 'saving'
          ? 'Saving…'
          : stateValue === 'saved'
            ? 'Saved'
            : stateValue === 'offline'
              ? 'Offline'
              : 'Session error';
    sessionStatus.querySelector('span')!.textContent = label;
    statusPopover.querySelector<HTMLElement>('[data-status-title]')!.textContent = label;
    statusPopover.querySelector<HTMLElement>('[data-status-detail]')!.textContent =
      detail ||
      (stateValue === 'live'
        ? 'Connected to the local Foundry runtime.'
        : stateValue === 'saved'
          ? 'Your latest visual decision is stored locally.'
          : 'Foundry is checking the local session.');
    if (stateValue === 'saved') {
      statusResetTimer = setTimeout(() => setSessionStatus('live'), 1400);
    }
  }

  function updateChangeCount(count: number, latest?: any): void {
    changeDock.hidden = count === 0;
    workspaceState = updateWorkspace(workspaceState, {
      type: 'set-change-summary',
      visible: count > 0,
    });
    panel.classList.toggle('change-summary-visible', count > 0);
    if (count === 0) {
      reviewTakeover.hidden = true;
      reviewSuspended = false;
      dockReviewButton.textContent = 'Review';
    }
    trayCompare.disabled = count === 0 || historyCursor === 0;
    changeDock.querySelector<HTMLElement>('[data-dock-count]')!.textContent =
      `${count} ${count === 1 ? 'change' : 'changes'} recorded`;
    if (latest) {
      lastRecordedSummary = `${latest.target?.label ?? 'Element'} · ${latest.property} ${reviewValue(latest.before, latest.unit)} → ${reviewValue(latest.after, latest.unit)}`;
    }
    changeDock.querySelector<HTMLElement>('[data-dock-last]')!.textContent =
      lastRecordedSummary || 'Ready to review';
    positionWorkspaceSurfaces();
  }

  function populateDesignContext(): void {
    if (!designGraph) return;
    const selectedBreakpoint = breakpoint.value || 'current';
    const selectedTheme = theme.value || 'current';
    const selectedState = state.value || 'current';
    const workbenchViewport = shadow.querySelector<HTMLSelectElement>('[data-workbench-viewport]')!;
    const selectedWorkbenchViewport = workbenchViewport.value;
    const workbenchTheme = shadow.querySelector<HTMLSelectElement>('[data-workbench-theme]')!;
    const selectedWorkbenchTheme = workbenchTheme.value || 'current';
    const workbenchStates = shadow.querySelector<HTMLElement>('[data-workbench-states]')!;
    breakpoint.innerHTML = [
      '<option value="current">Current</option>',
      ...designGraph.breakpoints.map(
        (item) =>
          `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)} · ${item.width}px</option>`,
      ),
    ].join('');
    theme.innerHTML = [
      '<option value="current">Current</option>',
      ...designGraph.themes.map(
        (item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`,
      ),
    ].join('');
    state.innerHTML = [
      '<option value="current">Current</option>',
      ...designGraph.states.map(
        (item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`,
      ),
    ].join('');
    workbenchViewport.innerHTML = designGraph.breakpoints
      .map(
        (item) =>
          `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)} · ${item.width}px</option>`,
      )
      .join('');
    workbenchTheme.innerHTML = [
      '<option value="current">Current theme</option>',
      ...designGraph.themes.map(
        (item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`,
      ),
    ].join('');
    if (!designGraph.states.some((item) => item.id === workbenchStateId)) {
      workbenchStateId = 'current';
    }
    workbenchStates.innerHTML = designGraph.states
      .map((item) => {
        const methods = previewStateMethods(item as PreviewStateDefinition);
        const supported = methods.length > 0;
        return `<button type="button" data-workbench-state="${escapeHtml(item.id)}" class="${item.id === workbenchStateId ? 'active' : ''}" aria-pressed="${item.id === workbenchStateId}" ${supported ? '' : 'disabled'} title="${supported ? escapeHtml(methods.join(', ')) : 'No authored preview method'}">${escapeHtml(item.label)}</button>`;
      })
      .join('');
    const restoreValue = (field: HTMLSelectElement, value: string, fallback?: string): void => {
      const available = [...field.options].some((option) => option.value === value);
      field.value = available ? value : (fallback ?? field.options[0]?.value ?? '');
      syncFdcSelect(field);
    };
    restoreValue(breakpoint, selectedBreakpoint, 'current');
    restoreValue(theme, selectedTheme, 'current');
    restoreValue(state, selectedState, 'current');
    restoreValue(workbenchViewport, selectedWorkbenchViewport);
    restoreValue(workbenchTheme, selectedWorkbenchTheme, 'current');
  }

  async function hydrateSession(): Promise<void> {
    if (!sessionId || !token) return;
    const firstHydration = !hydratedOnce;
    try {
      const [response, presence] = await Promise.all([
        fetch(`${runtimeUrl}/v1/sessions/${sessionId}`, {
          headers: { 'x-foundry-token': token },
        }),
        sessionRequest('/agent-presence').catch(() => ({
          connected: false,
          presence: null,
        })),
      ]);
      if (!response.ok) throw new Error('The local session could not be read.');
      const payload = await response.json();
      const { changeSet, designGraph: graph } = payload;
      runtimeConnected = true;
      activeAgentPresence = presence;
      statusPopover.querySelector<HTMLElement>('[data-status-project]')!.textContent =
        changeSet.context.projectRoot;
      statusPopover.querySelector<HTMLElement>('[data-status-revision]')!.textContent =
        `Revision ${changeSet.context.revision ?? 'working tree'}`;
      const nextProjectRoot = changeSet.context.projectRoot || location.origin;
      if (projectRoot !== nextProjectRoot || !hydratedOnce) {
        projectRoot = nextProjectRoot;
        loadOnboardingProgress();
        designMemory = readDesignMemory(localStorage, projectRoot);
        projectTypographyStyles = readProjectTypographyStyles(localStorage, projectRoot);
        utilityRects.clear();
        positionWorkspaceSurfaces();
      }
      projectRevision = changeSet.context.revision ?? '';
      designGraph = graph
        ? {
            ...graph,
            components: normalizeWorkshopComponents(graph.components),
          }
        : null;
      populateDesignContext();
      if (!layersPanel.hidden) renderLayers();
      if (!componentWorkshopPanel.hidden) renderComponentWorkshop();
      if (!healthPanel.hidden) scanDesignHealth();
      const activeChanges = changeSet.changes.filter(
        (change: any) =>
          change.status !== 'rejected' && String(change.before) !== String(change.after),
      );
      recordedChangeCount = activeChanges.length;
      const latestRun = payload.applyRuns?.at(-1);
      latestApplyState = latestRun?.state ?? 'none';
      updateChangeCount(activeChanges.length, activeChanges.at(-1));
      completeOnboardingStep('setup');
      if (activeAgentPresence.connected) completeOnboardingStep('agent');
      if (selectedElements.length) completeOnboardingStep('selection');
      if (activeChanges.length) completeOnboardingStep('change');
      if (latestApplyState === 'passed') completeOnboardingStep('apply');
      renderOnboardingChecklist();
      setSessionStatus('live');
      if (!libraryPanel.hidden) renderDesignMemory();
      if (latestRun?.state === 'verifying') maybeVerifyRun(latestRun);
      if (changeSet.changes.length === 0 && !hydratedOnce) {
        showToast('Click any element. Shift-click builds a selection.');
      }
      hydratedOnce = true;
      if (verificationChild || firstHydration) publishWorkspaceState();
    } catch (error) {
      runtimeConnected = false;
      setSessionStatus(
        'error',
        error instanceof Error ? error.message : 'The local session could not be read.',
      );
    }
  }

  const initialHydration = hydrateSession();
  function startSessionPolling(): void {
    clearInterval(sessionPoll);
    sessionPoll = setInterval(() => void hydrateSession(), 5000);
  }
  if (!verificationChild && !componentSpecimen) startSessionPolling();

  function showToast(message: string): void {
    const toast = shadow.querySelector<HTMLElement>('.toast')!;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
  }

  function persistDesignMemory(): void {
    try {
      writeDesignMemory(localStorage, projectRoot, designMemory);
    } catch {
      throw new Error('Design memory could not be saved in this browser.');
    }
  }

  function baselineLabel(baseline: VerifiedBaseline): string {
    return (
      [baseline.breakpoint, baseline.theme, baseline.state]
        .filter((value) => value && value !== 'current')
        .join(' · ') || 'Current rendered context'
    );
  }

  function renderDesignMemory(): void {
    const body = libraryPanel.querySelector<HTMLElement>('.library-body')!;
    const decisions = designMemory.decisions
      .slice(0, 12)
      .map(
        (decision) =>
          `<article class="memory-card"><div class="memory-card-top"><i class="memory-status"></i><strong>${escapeHtml(decision.title)}</strong></div><p>${escapeHtml(decision.outcome)} · ${escapeHtml(decision.summary)}${decision.enabled ? '' : ' · disabled'}</p></article>`,
      )
      .join('');
    const recipes = designMemory.recipes
      .map(
        (recipe) =>
          `<article class="memory-card"><div class="memory-card-top"><i class="memory-status"></i><strong>${escapeHtml(recipe.name)}</strong></div><p>${escapeHtml(recipe.sourceLabel)} · ${recipe.values.length} reusable ${recipe.values.length === 1 ? 'value' : 'values'}${recipe.component ? ` · ${escapeHtml(recipe.component)}` : ''}</p><div class="memory-card-actions"><button data-apply-recipe="${escapeHtml(recipe.id)}">Apply to selection</button><button data-remove-recipe="${escapeHtml(recipe.id)}">Remove</button></div></article>`,
      )
      .join('');
    const baselines = designMemory.baselines
      .slice(0, 12)
      .map(
        (baseline) =>
          `<article class="memory-card"><div class="memory-card-top"><i class="memory-status"></i><strong>${escapeHtml(baseline.targetLabel)}</strong></div><p>${escapeHtml(baselineLabel(baseline))} · ${baseline.values.length} rendered ${baseline.values.length === 1 ? 'value' : 'values'} verified · ${new Date(baseline.verifiedAt).toLocaleString()}</p></article>`,
      )
      .join('');
    body.innerHTML = `<section class="library-section"><div class="library-section-head">Decisions <span>${designMemory.decisions.length}</span></div>${decisions || '<div class="library-empty">Approved directions, rejected experiments, and project rules appear here.</div>'}</section><section class="library-section"><div class="library-section-head">Treatments <span>${designMemory.recipes.length}</span></div>${recipes || '<div class="library-empty">Select and refine an element, then save its treatment for similar components.</div>'}</section><section class="library-section"><div class="library-section-head">Verified baselines <span>${designMemory.baselines.length}</span></div>${baselines || '<div class="library-empty">Passed apply runs become exact local baselines automatically.</div>'}</section>`;
    libraryPanel.querySelector<HTMLButtonElement>('[data-save-recipe]')!.disabled =
      !selected || !previewHistory.some((entry) => entry.element === selected);
    libraryPanel.querySelector<HTMLButtonElement>('[data-capture-baseline]')!.disabled = !selected;
    body
      .querySelectorAll<HTMLButtonElement>('[data-apply-recipe]')
      .forEach((button) =>
        button.addEventListener('click', () => void applyRecipe(button.dataset.applyRecipe!)),
      );
    body.querySelectorAll<HTMLButtonElement>('[data-remove-recipe]').forEach((button) =>
      button.addEventListener('click', () => {
        designMemory = removeRecipe(designMemory, button.dataset.removeRecipe!);
        persistDesignMemory();
        renderDesignMemory();
      }),
    );
  }

  function openDesignMemory(): void {
    if (workspaceState.utility !== 'memory') setUtility('memory');
  }

  function closeDesignMemory(): void {
    if (workspaceState.utility === 'memory') setUtility(null);
  }

  function saveSelectedRecipe(requestedName = '', requestedIntent = ''): void {
    if (!selected) return;
    const entries = previewHistory.filter((entry) => entry.element === selected);
    if (!entries.length) {
      showToast('Refine this element before saving a treatment');
      return;
    }
    const component = selected.dataset.foundryComponent;
    const sourceLabel = layerLabel(selected);
    const values = [...new Map(entries.map((entry) => [entry.property, entry])).values()].map(
      (entry) => ({
        property: entry.property,
        value: entry.after,
        unit: entry.unit,
        category: entry.category,
      }),
    );
    designMemory = addRecipe(designMemory, {
      id: `recipe_${Date.now().toString(36)}`,
      name: requestedName.trim() || `${sourceLabel} treatment`,
      sourceLabel,
      component,
      intent:
        requestedIntent.trim() ||
        `Reuse the approved visual treatment from ${sourceLabel} without copying its source structure.`,
      categories: recipeCategories(values),
      conditions: {
        components: component ? [component] : undefined,
        elementKinds: [selected.tagName.toLowerCase()],
        requiredProperties: values.map((value) => value.property),
      },
      values,
      createdAt: new Date().toISOString(),
    });
    persistDesignMemory();
    renderDesignMemory();
    showToast('Treatment saved to this project');
  }

  function saveSelectedDesignDecision(payload: Record<string, unknown>): void {
    const title = String(payload.title ?? '').trim();
    const summary = String(payload.summary ?? '').trim();
    if (!title || !summary) {
      showToast('Add a clear title and guidance before saving');
      return;
    }
    const outcome =
      payload.outcome === 'rejected' || payload.outcome === 'rule' ? payload.outcome : 'approved';
    const providedChanges = Array.isArray(payload.changes)
      ? payload.changes.filter((change): change is Record<string, any> =>
          Boolean(change && typeof change === 'object' && change.property),
        )
      : [];
    const entries = providedChanges.length
      ? providedChanges.map((change) => ({
          property: String(change.property),
          category: String(change.category ?? 'other') as Category,
          after: change.after as string | number,
        }))
      : selected
        ? [
            ...new Map(
              previewHistory
                .slice(0, historyCursor)
                .filter((entry) => entry.element === selected)
                .map((entry) => [entry.property, entry]),
            ).values(),
          ]
        : [];
    const properties = entries.map((entry) => entry.property);
    const firstChange = providedChanges[0];
    const source =
      String(firstChange?.target?.source?.file ?? firstChange?.target?.selector ?? '') ||
      selected?.dataset.foundrySource ||
      '';
    const component =
      String(firstChange?.target?.component ?? '') || selected?.dataset.foundryComponent;
    const now = new Date().toISOString();
    const evidenceKind =
      payload.evidenceKind === 'branch' ||
      payload.evidenceKind === 'recipe' ||
      payload.evidenceKind === 'baseline'
        ? payload.evidenceKind
        : 'manual';
    const rules = entries.length
      ? entries.map((entry) => ({
          property: entry.property,
          category: entry.category,
          operator: outcome === 'rejected' ? ('avoid' as const) : ('prefer' as const),
          value: entry.after,
          guidance: summary,
        }))
      : [{ operator: 'require' as const, guidance: summary }];
    designMemory = addDesignDecision(designMemory, {
      id: `decision_${Date.now().toString(36)}`,
      title,
      summary,
      rationale: String(payload.rationale ?? '').trim() || undefined,
      outcome,
      categories:
        Array.isArray(payload.categories) && payload.categories.length
          ? payload.categories.map(String)
          : decisionCategories(properties),
      conditions: {
        components: component ? [component] : undefined,
        elementKinds:
          selected && !providedChanges.length ? [selected.tagName.toLowerCase()] : undefined,
        properties: properties.length ? properties : undefined,
        breakpoints: breakpoint.value !== 'current' ? [breakpoint.value] : undefined,
        themes: theme.value !== 'current' ? [theme.value] : undefined,
        states: state.value !== 'current' ? [state.value] : undefined,
        sources: source ? [source] : undefined,
      },
      rules,
      evidence: [
        {
          kind: evidenceKind,
          label: String(payload.evidenceLabel ?? '').trim() || 'Captured in Foundry',
          refId: String(payload.refId ?? '').trim() || undefined,
        },
      ],
      sourceLocations: source ? [source] : [],
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    persistDesignMemory();
    renderDesignMemory();
    showToast('Decision saved to this project');
  }

  async function applyRecipe(recipeId: string): Promise<{ applied: number; attempted: number }> {
    if (!selected) {
      throw new Error('Select a compatible element first');
    }
    const recipe = designMemory.recipes.find((item) => item.id === recipeId);
    if (!recipe) throw new Error(`Visual recipe ${recipeId} was not found`);
    const available = controlsFor(selected);
    const assessment = assessRecipe(
      recipe,
      available.map((control) => ({
        property: control.property,
        value: control.read(),
        category: control.category,
        unit: control.unit,
      })),
      designGraph?.tokens ?? [],
      {
        component: selected.dataset.foundryComponent,
        kind: selected.tagName.toLowerCase(),
      },
    );
    let applied = 0;
    let attempted = 0;
    for (const mapping of assessment.mappings) {
      if (mapping.status === 'unsupported' || mapping.resolvedValue == null) continue;
      const control = available.find((item) => item.property === mapping.property);
      if (!control) continue;
      attempted += 1;
      const before = control.read();
      const historyLength = previewHistory.length;
      const cursorBefore = historyCursor;
      const outcome = await applyControlValue(
        control,
        mapping.resolvedValue,
        `Apply ${recipe.name}`,
      );
      if (outcome.applied && !outcome.recorded) {
        control.apply(before);
        previewHistory.splice(historyLength);
        historyCursor = Math.min(cursorBefore, previewHistory.length);
        updateHistoryActions();
        updateOutline();
        throw new Error(
          applied
            ? `${applied} recipe values were recorded, but the next source change failed`
            : 'The recipe preview changed, but its source changes could not be recorded',
        );
      }
      if (outcome.recorded) applied += 1;
    }
    selectedControls = controlsFor(selected);
    renderControls();
    renderDesignMemory();
    showToast(applied ? `${applied} treatment values previewed` : 'No compatible values found');
    return { applied, attempted };
  }

  function saveManualBaseline(): void {
    if (!selected) return;
    const targetId = foundryTargetId(selected);
    const values = controlsFor(selected).map((control) => ({
      property: control.property,
      requested: control.read(),
      rendered: control.read(),
      passed: true,
    }));
    designMemory = addVerifiedBaseline(designMemory, {
      id: `baseline_${Date.now().toString(36)}`,
      runId: 'manual',
      targetId,
      targetLabel: layerLabel(selected),
      breakpoint: breakpoint.value,
      theme: theme.value,
      state: state.value,
      revision: projectRevision || undefined,
      values,
      verifiedAt: new Date().toISOString(),
    });
    persistDesignMemory();
    renderDesignMemory();
    showToast('Current rendered state saved as a local baseline');
  }

  const semanticTags = new Set([
    'a',
    'article',
    'aside',
    'button',
    'footer',
    'form',
    'header',
    'h1',
    'h2',
    'h3',
    'h4',
    'img',
    'iframe',
    'input',
    'label',
    'li',
    'main',
    'nav',
    'p',
    'section',
    'select',
    'textarea',
  ]);
  const ignoredLayerTags = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'PATH', 'DEFS']);

  function directText(element: HTMLElement): string {
    return [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ')
      .slice(0, 48);
  }

  function composedParent(element: HTMLElement | null): HTMLElement | null {
    if (!element) return null;
    if (element.parentElement) return element.parentElement;
    const root = element.getRootNode();
    return root instanceof ShadowRoot && root.host instanceof HTMLElement ? root.host : null;
  }

  function foundrySelector(element: HTMLElement): string {
    let selector = cssPath(element);
    let root = element.getRootNode();
    while (root instanceof ShadowRoot) {
      if (!(root.host instanceof HTMLElement)) break;
      selector = `${cssPath(root.host)} >>> ${selector}`;
      root = root.host.getRootNode();
    }
    return selector;
  }

  function resolveFoundrySelector(
    root: Document | ShadowRoot,
    selector: string,
  ): HTMLElement | null {
    if (!selector.trim()) return null;
    const parts = selector.split('>>>').map((part) => part.trim());
    let currentRoot: Document | ShadowRoot = root;
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      if (!part) return null;
      let element: HTMLElement | null;
      try {
        element = currentRoot.querySelector<HTMLElement>(part);
      } catch {
        return null;
      }
      if (!element) return null;
      if (index === parts.length - 1) return element;
      if (!element.shadowRoot) return null;
      currentRoot = element.shadowRoot;
    }
    return null;
  }

  function foundryTargetId(element: HTMLElement): string {
    if (element.dataset.foundryId) return element.dataset.foundryId;
    const path = foundrySelector(element);
    let hash = 2166136261;
    for (const character of path) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `web_${(hash >>> 0).toString(16)}`;
  }

  function previewGraph(): PreviewDesignGraph {
    return {
      breakpoints: designGraph?.breakpoints ?? [],
      themes: designGraph?.themes ?? [],
      states: (designGraph?.states ?? []) as PreviewStateDefinition[],
    };
  }

  function configuredPreviewCapabilities() {
    return previewCapabilities(previewGraph());
  }

  function normalizePreviewContext(value: unknown): PreviewContext {
    const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const viewportInput =
      input.viewport && typeof input.viewport === 'object'
        ? (input.viewport as Record<string, unknown>)
        : {};
    const targetInput =
      input.selectedTarget && typeof input.selectedTarget === 'object'
        ? (input.selectedTarget as Record<string, unknown>)
        : null;
    const requestRevision = Number(input.requestRevision);
    const motion = String(input.motionPreference ?? 'system');
    return {
      version: PREVIEW_CONTEXT_VERSION,
      requestRevision: Number.isFinite(requestRevision)
        ? Math.max(0, Math.round(requestRevision))
        : ++previewApplicationRevision,
      viewport: {
        id: String(viewportInput.id ?? 'current'),
        ...(Number.isFinite(Number(viewportInput.width))
          ? { width: Number(viewportInput.width) }
          : {}),
        ...(Number.isFinite(Number(viewportInput.height))
          ? { height: Number(viewportInput.height) }
          : {}),
      },
      theme: String(input.theme ?? 'current'),
      state: String(input.state ?? 'current'),
      motionPreference: motion === 'reduce' || motion === 'no-preference' ? motion : 'system',
      ...(targetInput && typeof targetInput.selector === 'string' && targetInput.selector
        ? {
            selectedTarget: {
              id: String(targetInput.id ?? targetInput.selector),
              selector: targetInput.selector,
            },
          }
        : {}),
    };
  }

  function previewAxis(
    status: PreviewAxisResult['status'],
    method: string,
    evidence: string[],
    failureReason?: string,
  ): PreviewAxisResult {
    return {
      status,
      method,
      evidence,
      ...(failureReason ? { failureReason } : {}),
    };
  }

  function previewTarget(context: PreviewContext): HTMLElement | null {
    if (context.selectedTarget?.selector) {
      return resolveFoundrySelector(document, context.selectedTarget.selector);
    }
    return selected;
  }

  function capturePreviewThemeBaseline(): void {
    captureThemeBaseline(document.documentElement, previewGraph().themes, previewThemeBaseline);
  }

  function restoreConfiguredPreviewTheme(): void {
    restorePreviewThemeBaseline(document.documentElement, previewThemeBaseline);
  }

  function deepestActiveElement(documentRoot: Document): HTMLElement | null {
    let active = documentRoot.activeElement;
    const HTMLElementConstructor = documentRoot.defaultView?.HTMLElement;
    while (
      HTMLElementConstructor &&
      active instanceof HTMLElementConstructor &&
      active.shadowRoot?.activeElement
    ) {
      active = active.shadowRoot.activeElement;
    }
    return HTMLElementConstructor && active instanceof HTMLElementConstructor
      ? (active as HTMLElement)
      : null;
  }

  function restoreOriginalFocus(
    documentRoot: Document,
    target: HTMLElement,
    previouslyFocused: HTMLElement | null,
  ): void {
    if (deepestActiveElement(documentRoot) !== target || previouslyFocused === target) return;
    if (
      previouslyFocused &&
      previouslyFocused !== documentRoot.body &&
      previouslyFocused.isConnected
    ) {
      previouslyFocused.focus({ preventScroll: true });
      return;
    }
    target.blur();
  }

  function authoredReducedMotionEvidence(documentRoot: Document): string[] {
    const matches: string[] = [];
    const visit = (rules: CSSRuleList): void => {
      for (const rule of [...rules]) {
        const condition =
          'conditionText' in rule ? String((rule as CSSConditionRule).conditionText ?? '') : '';
        if (condition.includes('prefers-reduced-motion')) matches.push(condition);
        if ('cssRules' in rule) {
          try {
            visit((rule as CSSGroupingRule).cssRules);
          } catch {
            // Cross-origin nested rules cannot be inspected safely.
          }
        }
      }
    };
    for (const sheet of [...documentRoot.styleSheets]) {
      try {
        visit(sheet.cssRules);
      } catch {
        // Cross-origin stylesheets remain visible but cannot prove authored behavior.
      }
    }
    return [...new Set(matches)];
  }

  function managedStateQueryNeedsReload(
    stateDefinition: PreviewStateDefinition | undefined,
    stateId: string,
  ): boolean {
    const managedKeys = new Set(
      previewGraph().states.flatMap((item) => Object.keys(item.query ?? {})),
    );
    const requested = queryForPreviewState(previewGraph().states, stateId);
    for (const key of managedKeys) {
      const actual = new URL(location.href).searchParams.get(key);
      const expected = requested[key] ?? null;
      if (actual !== expected) return true;
    }
    return Boolean(
      stateDefinition && Object.keys(stateDefinition.query ?? {}).length && !managedKeys.size,
    );
  }

  function applyAuthoredPreviewState(
    target: HTMLElement | null,
    definition: PreviewStateDefinition | undefined,
    pseudoRules: Map<PreviewPseudoState, { css: string; evidence: string[] }>,
  ): void {
    restorePreviewState();
    restorePreviewState = (): void => {};
    if (!target || !definition) return;
    const previouslyFocused = deepestActiveElement(document);
    const restorers: Array<() => void> = [applyPreviewStateAttributes(target, definition)];
    for (const pseudo of definition.pseudoStates ?? []) {
      const authored = pseudoRules.get(pseudo);
      if (authored?.css) {
        const style = document.createElement('style');
        style.dataset.foundryPreviewState = pseudo;
        style.textContent = authored.css;
        document.head.append(style);
        restorers.push(() => style.remove());
      }
    }
    const restore = () => {
      restorers.reverse().forEach((restore) => restore());
      restoreOriginalFocus(document, target, previouslyFocused);
    };
    restorePreviewState = restore;
    if (definition.pseudoStates?.includes('focus') && deepestActiveElement(document) !== target) {
      restore();
      restorePreviewState = (): void => {};
      throw new Error('The selected target did not accept native focus');
    }
    if (
      definition.pseudoStates?.includes('disabled') &&
      (!('disabled' in target) || !(target as HTMLButtonElement).disabled)
    ) {
      restore();
      restorePreviewState = (): void => {};
      throw new Error('The selected target did not accept the native disabled state');
    }
  }

  function supportsNativeFocus(target: HTMLElement): boolean {
    if ('disabled' in target && Boolean((target as HTMLButtonElement).disabled)) return false;
    return target.matches(
      'button, input, select, textarea, a[href], area[href], summary, iframe, object, embed, audio[controls], video[controls], [contenteditable]:not([contenteditable="false"]), [tabindex]',
    );
  }

  async function applyPreviewContext(
    requested: unknown,
    rollback = false,
  ): Promise<PreviewContextResult> {
    const graph = previewGraph();
    const request = normalizePreviewContext(requested);
    previewApplicationRevision = acceptPreviewRevision(
      request.requestRevision,
      currentPreviewContext.requestRevision,
      previewApplicationRevision,
    );
    const stateDefinition =
      request.state === 'current'
        ? undefined
        : graph.states.find((definition) => definition.id === request.state);
    const effectiveContext: PreviewContext = {
      ...request,
      theme:
        request.theme === 'current' && stateDefinition?.theme
          ? stateDefinition.theme
          : request.theme,
      motionPreference:
        request.motionPreference === 'system' && stateDefinition?.reducedMotion
          ? 'reduce'
          : request.motionPreference,
      viewport:
        request.viewport.id === 'current' && stateDefinition?.viewport
          ? { ...request.viewport, ...stateDefinition.viewport }
          : request.viewport,
    };
    const target = previewTarget(effectiveContext);
    const breakpointDefinition = graph.breakpoints.find(
      (definition) => definition.id === effectiveContext.viewport.id,
    );
    const expectedWidth = effectiveContext.viewport.width ?? breakpointDefinition?.width;
    const expectedHeight = effectiveContext.viewport.height ?? breakpointDefinition?.height;
    const viewportRequested =
      effectiveContext.viewport.id !== 'current' ||
      expectedWidth !== undefined ||
      expectedHeight !== undefined;
    const viewportMatches =
      (!expectedWidth || Math.abs(window.innerWidth - expectedWidth) <= 2) &&
      (!expectedHeight || Math.abs(window.innerHeight - expectedHeight) <= 2);
    const viewportResult = !viewportRequested
      ? previewAxis('current', 'frame', [
          `Current frame is ${window.innerWidth} × ${window.innerHeight}`,
        ])
      : !breakpointDefinition && !stateDefinition?.viewport && !expectedWidth
        ? previewAxis(
            'unsupported',
            'frame',
            [],
            `Viewport ${effectiveContext.viewport.id} is not indexed`,
          )
        : viewportMatches
          ? previewAxis('applied', 'frame', [
              `Rendered frame matches ${expectedWidth ?? window.innerWidth} × ${expectedHeight ?? window.innerHeight}`,
            ])
          : previewAxis(
              'unsupported',
              'frame',
              [`Rendered frame is ${window.innerWidth} × ${window.innerHeight}`],
              `Resize the preview to ${expectedWidth ?? window.innerWidth} × ${expectedHeight ?? window.innerHeight}`,
            );

    const themeDefinition =
      effectiveContext.theme === 'current'
        ? undefined
        : graph.themes.find((definition) => definition.id === effectiveContext.theme);
    const resolvedThemeHook = themeDefinition ? themeHook(themeDefinition) : null;
    const themeResult =
      effectiveContext.theme === 'current'
        ? previewAxis('current', 'root-baseline', ['Original root theme hooks preserved'])
        : !themeDefinition
          ? previewAxis(
              'unsupported',
              'root-hook',
              [],
              `Theme ${effectiveContext.theme} is not indexed`,
            )
          : resolvedThemeHook?.method === 'unsupported'
            ? previewAxis(
                'unsupported',
                'root-hook',
                themeDefinition.selector ? [themeDefinition.selector] : [],
                'The indexed theme does not expose a root attribute or class hook',
              )
            : previewAxis('applied', `root-${resolvedThemeHook?.method}`, [
                themeDefinition.attribute
                  ? `${themeDefinition.attribute}=${themeDefinition.value ?? themeDefinition.id}`
                  : (themeDefinition.selector ?? themeDefinition.id),
              ]);

    const stateMethods = previewStateMethods(stateDefinition);
    const stateNeedsTarget = Boolean(
      Object.keys(stateDefinition?.variant ?? {}).length ||
      (stateDefinition?.pseudoStates ?? []).length,
    );
    const pseudoRules = new Map<PreviewPseudoState, { css: string; evidence: string[] }>();
    if (target) {
      for (const pseudo of stateDefinition?.pseudoStates ?? []) {
        pseudoRules.set(pseudo, authoredPseudoCss(document, pseudo, target));
      }
    }
    const unmatchedAuthoredPseudo = (stateDefinition?.pseudoStates ?? []).find(
      (pseudo) =>
        (pseudo === 'hover' || pseudo === 'active') && !pseudoRules.get(pseudo)?.evidence.length,
    );
    let stateFailure = '';
    if (effectiveContext.state !== 'current' && !stateDefinition) {
      stateFailure = `State ${effectiveContext.state} is not indexed`;
    } else if (stateNeedsTarget && !target) {
      stateFailure = 'Select the authored target before previewing this state';
    } else if (
      stateDefinition &&
      !stateMethods.length &&
      !stateDefinition.theme &&
      !stateDefinition.viewport
    ) {
      stateFailure = 'This state has no authored query, variant, pseudo, viewport, or theme hook';
    } else if (
      target &&
      stateDefinition?.pseudoStates?.includes('disabled') &&
      !('disabled' in target)
    ) {
      stateFailure = 'The selected target does not support the native disabled state';
    } else if (
      target &&
      stateDefinition?.pseudoStates?.includes('focus') &&
      !supportsNativeFocus(target)
    ) {
      stateFailure = 'The selected target does not support native focus';
    } else if (unmatchedAuthoredPseudo) {
      stateFailure = `No readable same-origin authored :${unmatchedAuthoredPseudo} rule matches the selected target`;
    }
    const stateEvidence = [
      ...(stateDefinition?.evidence ?? []),
      ...[...pseudoRules.values()].flatMap((item) => item.evidence),
    ];
    const stateResult =
      effectiveContext.state === 'current'
        ? previewAxis('current', 'source-baseline', ['Original target state preserved'])
        : stateFailure
          ? previewAxis(
              'unsupported',
              stateMethods.join('+') || 'authored-state',
              stateEvidence,
              stateFailure,
            )
          : previewAxis('applied', stateMethods.join('+') || 'authored-context', [
              ...stateEvidence,
              `Applied indexed state ${stateDefinition?.label ?? effectiveContext.state}`,
            ]);

    const reducedMotionRules = authoredReducedMotionEvidence(document);
    const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let motionResult: PreviewAxisResult;
    if (effectiveContext.motionPreference === 'system') {
      motionResult = previewAxis('current', 'system-media-query', [
        `System preference is ${systemReducedMotion ? 'reduce' : 'no-preference'}`,
      ]);
    } else if (effectiveContext.motionPreference === 'reduce') {
      motionResult = !reducedMotionRules.length
        ? previewAxis(
            'unsupported',
            'authored-media-query',
            [],
            'No authored prefers-reduced-motion rule was found',
          )
        : !systemReducedMotion
          ? previewAxis(
              'unsupported',
              'authored-media-query',
              reducedMotionRules,
              'This browser frame cannot emulate reduced motion; enable the system preference',
            )
          : previewAxis('applied', 'authored-media-query', reducedMotionRules);
    } else {
      motionResult = systemReducedMotion
        ? previewAxis(
            'unsupported',
            'system-media-query',
            [],
            'This browser frame cannot override the active reduced-motion system preference',
          )
        : previewAxis('applied', 'system-media-query', ['System preference is no-preference']);
    }

    const axes = {
      viewport: viewportResult,
      theme: themeResult,
      state: stateResult,
      motion: motionResult,
    };
    const unsupported = Object.entries(axes).filter(
      ([, result]) => result.status === 'unsupported',
    );
    if (unsupported.length) {
      return {
        version: PREVIEW_CONTEXT_VERSION,
        requestRevision: effectiveContext.requestRevision,
        applied: false,
        context: effectiveContext,
        axes,
        failureReason: unsupported
          .map(([axis, result]) => `${axis}: ${result.failureReason}`)
          .join('; '),
      };
    }

    if (managedStateQueryNeedsReload(stateDefinition, effectiveContext.state)) {
      return {
        version: PREVIEW_CONTEXT_VERSION,
        requestRevision: effectiveContext.requestRevision,
        applied: false,
        context: effectiveContext,
        axes,
        reloadQuery: queryForPreviewState(graph.states, effectiveContext.state),
      };
    }

    const previousContext = currentPreviewContext;
    try {
      await applyPreviewMutationAtomically(
        async () => {
          capturePreviewThemeBaseline();
          restoreConfiguredPreviewTheme();
          if (themeDefinition && resolvedThemeHook?.method !== 'unsupported') {
            applyPreviewTheme(document.documentElement, themeDefinition, graph.themes);
          }
          applyAuthoredPreviewState(target, stateDefinition, pseudoRules);
          if (
            [...breakpoint.options].some((option) => option.value === effectiveContext.viewport.id)
          ) {
            breakpoint.value = effectiveContext.viewport.id;
            syncFdcSelect(breakpoint);
          }
          if ([...theme.options].some((option) => option.value === effectiveContext.theme)) {
            theme.value = effectiveContext.theme;
            syncFdcSelect(theme);
          }
          if ([...state.options].some((option) => option.value === effectiveContext.state)) {
            state.value = effectiveContext.state;
            syncFdcSelect(state);
          }
          currentPreviewContext = effectiveContext;
          await document.fonts?.ready;
          await new Promise<void>((resolve) => {
            if (verificationChild) window.setTimeout(resolve, 0);
            else requestAnimationFrame(() => resolve());
          });
        },
        () => {
          restorePreviewState();
          restoreConfiguredPreviewTheme();
          currentPreviewContext = previousContext;
        },
      );
      const result: PreviewContextResult = {
        version: PREVIEW_CONTEXT_VERSION,
        requestRevision: effectiveContext.requestRevision,
        applied: true,
        context: effectiveContext,
        axes,
      };
      lastPreviewApplication = result;
      return result;
    } catch (error) {
      restorePreviewState();
      restoreConfiguredPreviewTheme();
      const rollbackContext = {
        ...previousContext,
        requestRevision: effectiveContext.requestRevision,
      };
      currentPreviewContext = previousContext;
      if (!rollback) {
        const restored = await applyPreviewContext(rollbackContext, true).catch(() => null);
        if (!restored?.applied) currentPreviewContext = rollbackContext;
      } else {
        currentPreviewContext = rollbackContext;
      }
      return {
        version: PREVIEW_CONTEXT_VERSION,
        requestRevision: effectiveContext.requestRevision,
        applied: false,
        context: effectiveContext,
        axes,
        failureReason:
          error instanceof Error ? error.message : 'The preview context could not be applied',
      };
    }
  }

  function collectLayerElements(root: Document | ShadowRoot): HTMLElement[] {
    const collected: HTMLElement[] = [];
    for (const element of [...root.querySelectorAll<HTMLElement>('*')]) {
      if (element === host || host.contains(element)) continue;
      collected.push(element);
      if (element.shadowRoot) collected.push(...collectLayerElements(element.shadowRoot));
    }
    return collected;
  }

  function layerLabel(element: HTMLElement): string {
    return (
      element.dataset.foundryLabel ||
      element.getAttribute('aria-label') ||
      element.getAttribute('alt') ||
      directText(element) ||
      element.dataset.foundryComponent?.split('/').at(-1) ||
      element.id ||
      element.tagName.toLowerCase()
    );
  }

  function isVisibleLayer(element: HTMLElement): boolean {
    if (
      element === host ||
      host.contains(element) ||
      ignoredLayerTags.has(element.tagName.toUpperCase())
    ) {
      return false;
    }
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity || 1) > 0 &&
      rect.width > 1 &&
      rect.height > 1
    );
  }

  function layerSignals(element: HTMLElement, depth: number): LayerSignals {
    const rect = element.getBoundingClientRect();
    const tag = element.tagName.toLowerCase();
    const instrumented = Boolean(element.dataset.foundrySource || element.dataset.foundryId);
    const interactive =
      ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'].includes(element.tagName) ||
      Boolean(element.getAttribute('role')) ||
      element.tabIndex >= 0;
    const semantic = semanticTags.has(tag);
    const labelled = Boolean(
      element.dataset.foundryLabel ||
      element.getAttribute('aria-label') ||
      element.getAttribute('alt') ||
      directText(element),
    );
    return {
      instrumented,
      interactive,
      semantic,
      labelled,
      decorative:
        element.getAttribute('aria-hidden') === 'true' ||
        ['I', 'SVG', 'CANVAS'].includes(element.tagName),
      area: rect.width * rect.height,
      depth,
    };
  }

  function meaningfulLayer(element: HTMLElement): boolean {
    if (!isVisibleLayer(element)) return false;
    // SVG roots support the existing CSS/attribute inspector. Individual paths
    // remain outside the editable layer model until path-level mapping exists.
    if (element instanceof SVGSVGElement) return true;
    const signals = layerSignals(element, 0);
    const style = getComputedStyle(element);
    return (
      signals.instrumented ||
      signals.interactive ||
      signals.semantic ||
      signals.labelled ||
      style.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
      style.borderStyle !== 'none'
    );
  }

  function nearestLayerParent(element: HTMLElement | null): HTMLElement | null {
    let current = composedParent(element);
    while (current && current !== document.body) {
      if (meaningfulLayer(current)) return current;
      current = composedParent(current);
    }
    return current === document.body && meaningfulLayer(current) ? current : null;
  }

  function firstLayerChild(element: HTMLElement | null): HTMLElement | null {
    if (!element) return null;
    const children = [
      ...[...element.children].filter(
        (child): child is HTMLElement => child instanceof HTMLElement,
      ),
      ...[...(element.shadowRoot?.children ?? [])].filter(
        (child): child is HTMLElement => child instanceof HTMLElement,
      ),
    ];
    for (const current of children) {
      if (meaningfulLayer(current)) return current;
      const nested = firstLayerChild(current);
      if (nested) return nested;
    }
    return null;
  }

  function updateSelectionPath(): void {
    const parent = nearestLayerParent(selected);
    const child = firstLayerChild(selected);
    selectionPath.hidden = !selected;
    selectParentButton.disabled = !parent;
    selectChildButton.disabled = !child;
    pathName.textContent = selected ? layerLabel(selected) : '';
  }

  function discoverLayers(): void {
    const candidates = collectLayerElements(document).filter(meaningfulLayer).slice(0, 10_000);
    const candidateSet = new Set(candidates);
    layerEntries = candidates.map((element) => {
      let depth = 0;
      let parent = composedParent(element);
      while (parent && parent !== document.body) {
        if (candidateSet.has(parent)) depth += 1;
        parent = composedParent(parent);
      }
      const instrumented = Boolean(element.dataset.foundrySource || element.dataset.foundryId);
      return {
        element,
        depth,
        label: layerLabel(element),
        kind: element.dataset.foundryComponent ? 'component' : element.tagName.toLowerCase(),
        instrumented,
        hasChildren: candidates.some(
          (candidate) => candidate !== element && nearestLayerParent(candidate) === element,
        ),
      };
    });
  }

  function componentCatalog(): Array<{
    id: string;
    path: string;
    name: string;
    namespace: string;
    elements: HTMLElement[];
    indexedInstances: number;
    variants: Array<{ id: string; name: string }>;
  }> {
    const catalog = new Map<
      string,
      {
        id: string;
        path: string;
        name: string;
        namespace: string;
        elements: HTMLElement[];
        indexedInstances: number;
        variants: Array<{ id: string; name: string }>;
      }
    >();
    for (const entry of layerEntries) {
      const path = entry.element.dataset.foundryComponent;
      if (!path) continue;
      const segments = path.split('/').filter(Boolean);
      const name = segments.at(-1) ?? path;
      const existing = catalog.get(path);
      if (existing) {
        existing.elements.push(entry.element);
        existing.indexedInstances = Math.max(existing.indexedInstances, existing.elements.length);
      } else {
        catalog.set(path, {
          id: path,
          path,
          name,
          namespace: segments.slice(0, -1).join(' / ') || 'Local component',
          elements: [entry.element],
          indexedInstances: 1,
          variants: [],
        });
      }
    }
    for (const component of designGraph?.components ?? []) {
      const match = [...catalog.values()].find(
        (entry) =>
          entry.id === component.id ||
          entry.path === component.name ||
          entry.name === component.name,
      );
      if (match) {
        match.indexedInstances = Math.max(match.indexedInstances, component.instances);
        match.variants = component.variants.map(({ id, name }) => ({
          id,
          name,
        }));
        continue;
      }
      const path = component.id || component.name;
      const segments = path.split('/').filter(Boolean);
      catalog.set(path, {
        id: component.id,
        path,
        name: component.name || segments.at(-1) || path,
        namespace: segments.slice(0, -1).join(' / ') || 'Project component',
        elements: [],
        indexedInstances: component.instances,
        variants: component.variants.map(({ id, name }) => ({ id, name })),
      });
    }
    return [...catalog.values()].sort(
      (a, b) =>
        Number(b.elements.length > 0) - Number(a.elements.length > 0) ||
        a.name.localeCompare(b.name),
    );
  }

  function nextVariantDefinition(element: HTMLElement): ComponentWorkshopDefinition | null {
    const path = element.dataset.foundryComponent;
    const matches = (designGraph?.components ?? []).filter((component) => {
      if (!component.variants.length) return false;
      if (
        path &&
        [component.id, component.name].some(
          (name) => name === path || name === path.split('/').at(-1),
        )
      )
        return true;
      try {
        return Boolean(component.selector && element.matches(component.selector));
      } catch {
        return false;
      }
    });
    return matches.length === 1 ? matches[0]! : null;
  }

  function nextVariantSnapshot(element: HTMLElement) {
    const component = nextVariantDefinition(element);
    if (!component) return null;
    const selectors: string[] = [];
    const visit = (rules: CSSRuleList): void => {
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule && rule.style.length)
          selectors.push(...rule.selectorText.split(','));
        if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        if (sheet.href && new URL(sheet.href, location.href).origin !== location.origin) continue;
        visit(sheet.cssRules);
      } catch {
        /* Cross-origin styles cannot substantiate a live preview hook. */
      }
    }
    const hasHook = (attribute: string) =>
      selectors.some((selector) => {
        selector = selector.trim();
        const pattern = new RegExp(`\\[${attribute}(?:\\s*[~|^$*]?=[^\\]]*)?\\s*\\]`);
        const match = pattern.exec(selector);
        if (!match) return false;
        // The hook must be on the selected subject, not on one of its ancestors.
        if (/[\s>+~]/.test(selector.slice(match.index + match[0].length))) return false;
        try {
          return element.matches(selector.replace(pattern, '').trim() || '*');
        } catch {
          return false;
        }
      });
    return {
      componentId: component.id,
      name: component.name,
      variants: component.variants.map((variant) => {
        let reason: string | null = null;
        let attributes: Array<[string, string]> = [];
        try {
          attributes = inspectorVariantAttributes(variant);
          const unsupported = attributes.find(([name]) => !hasHook(name));
          if (unsupported)
            reason = `No authored live CSS hook for ${unsupported[0]}. Use Component Workshop for source planning.`;
          if (!targetFor(element).source)
            reason = 'The selected instance has no exact source mapping.';
        } catch (error) {
          reason = error instanceof Error ? error.message : 'Variant unavailable.';
        }
        return {
          id: variant.id,
          name: variant.name,
          source: variant.source,
          props: variant.props,
          supported: !reason,
          reason,
          current:
            attributes.length > 0 &&
            attributes.every(([name, value]) => element.getAttribute(name) === value),
        };
      }),
    };
  }

  function workshopCatalog(): Array<{
    id: string;
    name: string;
    namespace: string;
    elements: HTMLElement[];
    definition?: ComponentWorkshopDefinition;
  }> {
    return componentCatalog().map((entry) => ({
      id: entry.id,
      name: entry.name,
      namespace: entry.namespace,
      elements: entry.elements,
      definition: designGraph?.components.find(
        (component) =>
          component.id === entry.id ||
          component.name === entry.path ||
          component.name === entry.name,
      ),
    }));
  }

  function currentWorkshopEntry() {
    const catalog = workshopCatalog();
    const selectedPath = selected?.dataset.foundryComponent;
    const selectedName = selectedPath?.split('/').at(-1);
    const requested = catalog.find(
      (entry) =>
        entry.id === workshopComponentId ||
        entry.definition?.id === workshopComponentId ||
        entry.name === workshopComponentId,
    );
    const selectedEntry = catalog.find(
      (entry) =>
        entry.id === selectedPath ||
        entry.name === selectedPath ||
        entry.name === selectedName ||
        entry.elements.includes(selected!),
    );
    return (
      requested ?? selectedEntry ?? catalog.find((entry) => entry.elements.length) ?? catalog[0]
    );
  }

  function clearWorkshopStatePreview(): void {
    workshopStateCleanup?.();
    workshopStateCleanup = undefined;
  }

  function applyWorkshopStatePreview(
    target: HTMLElement,
    workshopState: ComponentWorkshopState,
  ): void {
    const pseudo = workshopState.pseudoState;
    const authored = pseudo ? authoredPseudoCss(document, pseudo, target) : undefined;
    if ((pseudo === 'hover' || pseudo === 'active') && !authored?.evidence.length) {
      throw new Error(
        `No readable same-origin authored :${pseudo} rule matches the selected component`,
      );
    }
    if (pseudo === 'focus' && !supportsNativeFocus(target)) {
      throw new Error('The selected component does not support native focus');
    }
    if (pseudo === 'disabled' && !('disabled' in target)) {
      throw new Error('The selected component does not support the native disabled state');
    }
    clearWorkshopStatePreview();
    if (workshopState.kind === 'default') {
      state.value = 'current';
      syncFdcSelect(state);
      return;
    }
    const previous = {
      disabled: target.hasAttribute('disabled'),
      ariaDisabled: target.getAttribute('aria-disabled'),
      ariaBusy: target.getAttribute('aria-busy'),
      ariaInvalid: target.getAttribute('aria-invalid'),
      foundryState: target.getAttribute('data-foundry-state'),
    };
    let style: HTMLStyleElement | undefined;
    if (pseudo) {
      target.setAttribute(`data-foundry-force-${pseudo}`, 'true');
      if (authored?.css) {
        style = document.createElement('style');
        style.dataset.foundryWorkshopState = pseudo;
        style.textContent = authored.css;
        document.head.append(style);
      }
      if (pseudo === 'focus') target.focus({ preventScroll: true });
      if (pseudo === 'disabled') {
        target.setAttribute('disabled', '');
        target.setAttribute('aria-disabled', 'true');
      }
      if (pseudo === 'focus' && deepestActiveElement(document) !== target) {
        style?.remove();
        target.removeAttribute(`data-foundry-force-${pseudo}`);
        throw new Error('The selected component did not accept native focus');
      }
    } else {
      target.setAttribute('data-foundry-state', workshopState.id);
      if (workshopState.id === 'loading') target.setAttribute('aria-busy', 'true');
      if (workshopState.id === 'error') target.setAttribute('aria-invalid', 'true');
    }
    state.value = workshopState.id;
    syncFdcSelect(state);
    workshopStateCleanup = () => {
      if (pseudo) target.removeAttribute(`data-foundry-force-${pseudo}`);
      style?.remove();
      if (previous.disabled) target.setAttribute('disabled', '');
      else target.removeAttribute('disabled');
      const restore = (name: string, value: string | null): void => {
        if (value == null) target.removeAttribute(name);
        else target.setAttribute(name, value);
      };
      restore('aria-disabled', previous.ariaDisabled);
      restore('aria-busy', previous.ariaBusy);
      restore('aria-invalid', previous.ariaInvalid);
      restore('data-foundry-state', previous.foundryState);
    };
  }

  async function previewWorkshopVariant(
    entry: NonNullable<ReturnType<typeof currentWorkshopEntry>>,
    variant: ComponentWorkshopVariant,
  ): Promise<{ recorded: number; requested: number }> {
    const target = selected && entry.elements.includes(selected) ? selected : entry.elements[0];
    if (!target) throw new Error('The requested component instance is unavailable');
    select(target);
    workshopVariantId = variant.id;
    let recorded = 0;
    const requested = Object.keys(variant.props).length;
    for (const [key, value] of Object.entries(variant.props)) {
      const attribute = `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
      const previous = target.getAttribute(attribute);
      const before = previous ?? '';
      target.setAttribute(attribute, String(value));
      const control: Control = {
        category: 'content',
        property: `variant.${key}`,
        label: `${entry.name} ${key}`,
        kind: 'text',
        value: before,
        read: () => target.getAttribute(attribute) ?? '',
        apply: (next) => target.setAttribute(attribute, String(next)),
      };
      const didRecord = await record(
        control,
        before,
        String(value),
        target,
        `Set ${variant.name} variant`,
        [
          `Component Workshop variant: ${variant.name}`,
          `Variant source: ${workshopSourceLabel(variant.source)}`,
        ],
      );
      if (!didRecord) {
        if (previous == null) target.removeAttribute(attribute);
        else target.setAttribute(attribute, previous);
        renderComponentWorkshop();
        throw new Error(
          recorded
            ? `${recorded} variant values were recorded, but the next source change failed`
            : 'The variant preview changed, but its source changes could not be recorded',
        );
      }
      recorded += 1;
    }
    renderComponentWorkshop();
    showToast(`${variant.name} previewed on ${entry.name}`);
    return { recorded, requested };
  }

  function workshopElementProps(
    element: HTMLElement,
    variant: ComponentWorkshopVariant,
  ): Record<string, string> {
    return Object.fromEntries(
      Object.keys(variant.props).flatMap((property) => {
        const attribute = `data-${property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
        const value = element.getAttribute(attribute);
        return value == null ? [] : [[property, value]];
      }),
    );
  }

  async function stageWorkshopVariant(
    entry: NonNullable<ReturnType<typeof currentWorkshopEntry>>,
    input: { axisId: string; label: string; value: string; baseVariantId?: string },
  ): Promise<{ recorded: boolean; property: string }> {
    const definition = entry.definition;
    const target = selected && entry.elements.includes(selected) ? selected : entry.elements[0];
    if (!definition || !target)
      throw new Error('The requested source-backed component is unavailable');
    try {
      const draft = createComponentVariantDraft({ component: definition, ...input });
      const attribute = `data-${draft.property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
      const previous = target.getAttribute(attribute);
      const before = previous ?? '';
      target.setAttribute(attribute, draft.value);
      const control: Control = {
        category: 'content',
        property: `component.variant.create.${draft.property}`,
        label: `Create ${draft.label} variant`,
        kind: 'text',
        value: before,
        read: () => target.getAttribute(attribute) ?? '',
        apply: (next) => target.setAttribute(attribute, String(next)),
      };
      const recorded = await record(
        control,
        before,
        draft.value,
        target,
        `Create ${draft.label} source variant`,
        [
          `Component: ${definition.name}`,
          `Variant adapter: ${draft.adapter}`,
          `Variant property: ${draft.sourceProperty}`,
          `Variant label: ${draft.label}`,
          ...(draft.baseVariantId ? [`Base variant: ${draft.baseVariantId}`] : []),
          'Create the source option and preserve the current preview as its initial treatment.',
        ],
        { source: draft.source, scope: 'component' },
      );
      if (!recorded) {
        if (previous == null) target.removeAttribute(attribute);
        else target.setAttribute(attribute, previous);
        throw new Error('The variant preview changed, but its source change could not be recorded');
      }
      showToast(`${draft.label} is ready for review`);
      return { recorded, property: draft.property };
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not stage this variant');
      throw error;
    }
  }

  async function stageTokenPromotion(
    candidateId: string,
  ): Promise<{ recorded: boolean; changeIds: string[] }> {
    const candidate = designGraph?.tokenPromotions?.find((item) => item.id === candidateId);
    if (!candidate) throw new Error(`Token promotion ${candidateId} is not available`);
    if (!sessionId || !token) throw new Error('Session connection is missing');
    if (!candidate.canStage || !candidate.sources.length) {
      throw new Error(candidate.blockers[0] ?? 'This promotion has no exact source mapping');
    }
    const source = candidate.sources[0]!;
    const operationId = `op_${crypto.randomUUID().replaceAll('-', '')}`;
    const mappingId = `map_${candidate.id}`;
    const targetId = `token-source:${candidate.id}`;
    const replacement =
      candidate.recommendation === 'use-existing'
        ? `var(${candidate.suggestedTokenName})`
        : `${candidate.suggestedTokenName}: ${candidate.value}; then replace ${candidate.occurrenceCount} literals`;
    const category =
      candidate.category === 'color'
        ? 'color'
        : candidate.category === 'typography'
          ? 'typography'
          : candidate.category === 'shadow'
            ? 'effect'
            : candidate.category === 'motion'
              ? 'motion'
              : candidate.category === 'radius'
                ? 'border'
                : candidate.category === 'spacing'
                  ? 'spacing'
                  : 'layout';
    const mappingCandidates = [
      {
        id: mappingId,
        label:
          candidate.recommendation === 'use-existing'
            ? `Promote literals to ${candidate.suggestedTokenName}`
            : `Create ${candidate.suggestedTokenName} and promote literals`,
        intent: 'token-refactor',
        property: candidate.property,
        targetId,
        value: replacement,
        source,
        scope: 'component',
        confidence: 'instrumented',
        evidence: candidate.evidence,
        blastRadius: candidate.occurrenceCount,
      },
    ];
    try {
      const responsePayload = await sessionRequest('/change-records', {
        method: 'POST',
        body: JSON.stringify({
          change: {
            target: {
              id: targetId,
              platform: 'web',
              semanticRole: 'design-token',
              label: candidate.suggestedTokenName,
              componentPath: [],
              source,
              geometry: { x: 0, y: 0, width: 0, height: 0, scale: 1 },
              locator: { sources: candidate.sources },
              confidence: 'instrumented',
              evidence: ['Project token index', 'Exact authored source locations'],
            },
            category,
            property: `designToken.${candidate.recommendation === 'use-existing' ? 'promote' : 'create'}`,
            before: candidate.value,
            after: replacement,
            token: candidate.suggestedTokenName,
            operationId,
            stateIds: [],
            mappingCandidates,
            selectedMappingId: mappingId,
            scope: 'component',
            context: { breakpoint: 'current', theme: 'current', state: 'current' },
            confidence: 'instrumented',
            evidence: [
              ...candidate.evidence,
              ...candidate.sources.map((item) => `${item.file}${item.line ? `:${item.line}` : ''}`),
              'Preserve the resolved rendered value and semantic alias chain.',
              'Re-index, rebuild, and verify every affected consumer after apply.',
            ],
            status: 'draft',
          },
          operation: {
            id: operationId,
            kind: 'token-refactor',
            label:
              candidate.recommendation === 'use-existing'
                ? `Promote ${candidate.occurrenceCount} literals to ${candidate.suggestedTokenName}`
                : `Create ${candidate.suggestedTokenName} and promote ${candidate.occurrenceCount} literals`,
            targetIds: [targetId],
            stateIds: [],
            mappingCandidates,
            selectedMappingId: mappingId,
            status: 'resolved',
          },
        }),
      });
      const changeIds = responsePayload.changeSet.changes
        .filter((change: any) => change.operationId === operationId)
        .map((change: any) => change.id);
      if (!changeIds.length) throw new Error('The token promotion did not create a review change');
      const activeChanges = responsePayload.changeSet.changes.filter(
        (change: any) =>
          change.status !== 'rejected' && String(change.before) !== String(change.after),
      );
      recordedChangeCount = activeChanges.length;
      lastRecordedSummary = `${candidate.suggestedTokenName} · ${candidate.occurrenceCount} source locations`;
      updateChangeCount(activeChanges.length, activeChanges.at(-1));
      showToast('Token plan added to Review');
      publishWorkspaceState();
      return { recorded: true, changeIds };
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not stage this token plan');
      throw error;
    }
  }

  async function repairWorkshopVariantDrift(
    entry: NonNullable<ReturnType<typeof currentWorkshopEntry>>,
    variant: ComponentWorkshopVariant,
  ): Promise<{ recorded: number; requested: number }> {
    const drift = componentVariantDrift(
      entry.elements.map((element) => ({
        id: foundryTargetId(element),
        label: layerLabel(element),
        props: workshopElementProps(element, variant),
      })),
      variant,
    );
    let recorded = 0;
    for (const mismatch of drift) {
      const target = entry.elements.find(
        (element) => foundryTargetId(element) === mismatch.instanceId,
      );
      if (!target) continue;
      const attribute = `data-${mismatch.property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
      target.setAttribute(attribute, String(mismatch.expected));
      const control: Control = {
        category: 'content',
        property: `variant.${mismatch.property}`,
        label: `Repair ${entry.name} ${mismatch.property}`,
        kind: 'text',
        value: String(mismatch.actual),
        read: () => target.getAttribute(attribute) ?? '',
        apply: (next) => target.setAttribute(attribute, String(next)),
      };
      const didRecord = await record(
        control,
        String(mismatch.actual),
        String(mismatch.expected),
        target,
        `Repair ${variant.name} cross-instance drift`,
        [
          `Expected ${mismatch.property}=${mismatch.expected}`,
          `Rendered ${mismatch.property}=${mismatch.actual}`,
          `Variant source: ${workshopSourceLabel(variant.source)}`,
        ],
        { source: variant.source },
      );
      if (!didRecord) {
        target.setAttribute(attribute, String(mismatch.actual));
        throw new Error(
          recorded
            ? `${recorded} drift values were recorded, but the next source change failed`
            : 'The drift repair preview changed, but its source change could not be recorded',
        );
      }
      recorded += 1;
    }
    showToast(
      drift.length
        ? `${drift.length} drift ${drift.length === 1 ? 'value' : 'values'} ready for review`
        : 'No explicit variant drift was found',
    );
    return { recorded, requested: drift.length };
  }

  function renderComponentWorkshop(): void {
    const body = componentWorkshopPanel.querySelector<HTMLElement>('.component-workshop-body')!;
    const catalog = workshopCatalog();
    const entry = currentWorkshopEntry();
    if (!catalog.length || !entry) {
      body.innerHTML =
        '<div class="component-workshop-empty">No project components are indexed yet. Add component instrumentation or refresh the design graph.</div>';
      return;
    }
    workshopComponentId = entry.id;
    const definition = entry.definition;
    const variants = definition?.variants ?? [];
    if (workshopVariantId && !variants.some((variant) => variant.id === workshopVariantId)) {
      workshopVariantId = '';
    }
    const chosenVariant = variants.find((variant) => variant.id === workshopVariantId);
    const scopes = availableWorkshopScopes({
      hasLiveInstance: entry.elements.length > 0,
      hasComponentSource: Boolean(definition?.source),
      selectedVariant: chosenVariant,
    });
    if (!scopes.some((item) => item.id === scope.value && item.enabled)) scope.value = 'instance';
    const activeScope = scopes.find((item) => item.id === scope.value) ?? scopes[0]!;
    const states = componentWorkshopStates(designGraph?.states);
    if (!states.some((item) => item.id === workshopStateId)) workshopStateId = 'current';
    const axes = definition?.variantAxes ?? [];
    const drift = componentVariantDrift(
      entry.elements.map((element) => ({
        id: foundryTargetId(element),
        label: layerLabel(element),
        props: chosenVariant ? workshopElementProps(element, chosenVariant) : {},
      })),
      chosenVariant,
    );
    const authoring = axes.length
      ? `<section class="component-workshop-section component-workshop-authoring"><header><strong>Create source variant</strong><span>Reviewed source operation</span></header><div class="component-workshop-form"><label>Variant property<select data-workshop-axis>${axes.map((axis) => `<option value="${escapeHtml(axis.id)}">${escapeHtml(axis.label)} · ${escapeHtml(axis.adapter)}</option>`).join('')}</select></label><label>Variant name<input data-workshop-variant-label placeholder="Danger" /></label><label>Source value<input data-workshop-variant-value placeholder="danger" /></label><label>Start from<select data-workshop-base><option value="">Current preview</option>${variants.map((variant) => `<option value="${escapeHtml(variant.id)}">${escapeHtml(variant.name)}</option>`).join('')}</select></label><button class="primary" data-workshop-create-variant ${entry.elements.length && axes.some((axis) => axis.canCreate) ? '' : 'disabled'}>Stage source variant</button></div><span class="component-workshop-state-note">Foundry records the exact authoring location. The coding agent creates the option only after Review.</span></section>`
      : '<section class="component-workshop-section"><header><strong>Create source variant</strong><span>Read-only</span></header><span class="component-workshop-state-note">No writable Storybook, CVA, or TypeScript variant axis was found.</span></section>';
    const driftMarkup = `<section class="component-workshop-section component-workshop-drift" data-drift-count="${drift.length}"><header><strong>Cross-instance drift</strong><span>${chosenVariant ? `${drift.length} ${drift.length === 1 ? 'difference' : 'differences'}` : 'Choose a variant'}</span></header>${
      drift.length
        ? `<div class="component-workshop-drift-list">${drift
            .slice(0, 4)
            .map(
              (item) =>
                `<span><strong>${escapeHtml(item.label)}</strong><code>${escapeHtml(item.property)} ${escapeHtml(String(item.actual))} → ${escapeHtml(String(item.expected))}</code></span>`,
            )
            .join(
              '',
            )}</div><button data-workshop-repair-drift>Repair ${drift.length} ${drift.length === 1 ? 'value' : 'values'}</button>`
        : `<span class="component-workshop-state-note">${chosenVariant ? 'Every explicitly instrumented instance matches this variant.' : 'Select a source variant to compare its rendered instances.'}</span>`
    }</section>`;
    body.innerHTML = `<div class="component-workshop-picker"><label>Component<select data-workshop-component aria-label="Component">${catalog
      .map(
        (item) =>
          `<option value="${escapeHtml(item.id)}" ${item.id === entry.id ? 'selected' : ''}>${escapeHtml(item.name)} · ${item.elements.length ? `${item.elements.length} live` : 'indexed'}</option>`,
      )
      .join(
        '',
      )}</select></label><div class="component-workshop-meta"><div class="component-workshop-stat"><strong>${entry.elements.length}</strong><span>Live instances</span></div><div class="component-workshop-stat"><strong>${variants.length}</strong><span>Mapped variants</span></div></div></div><section class="component-workshop-section"><header><strong>Change scope</strong><span>${escapeHtml(activeScope.reason)}</span></header><div class="component-workshop-scope">${scopes
      .map(
        (item) =>
          `<button data-workshop-scope="${item.id}" class="${scope.value === item.id ? 'active' : ''}" title="${escapeHtml(item.reason)}" ${item.enabled ? '' : 'disabled'}>${item.id[0]!.toUpperCase()}${item.id.slice(1)}</button>`,
      )
      .join(
        '',
      )}</div><span class="component-workshop-scope-note">${escapeHtml(workshopSourceLabel(chosenVariant?.source ?? definition?.source))}</span></section><section class="component-workshop-section"><header><strong>Instances</strong><span>${entry.elements.length ? 'Select one or edit together' : 'Not rendered on this canvas'}</span></header><div class="component-workshop-instances">${
      entry.elements.length
        ? entry.elements
            .map(
              (element, index) =>
                `<button class="component-workshop-instance ${selected === element ? 'active' : ''}" data-workshop-instance="${index}"><span>${escapeHtml(layerLabel(element))}</span><code>${Math.round(element.getBoundingClientRect().width)} × ${Math.round(element.getBoundingClientRect().height)}</code></button>`,
            )
            .join('')
        : '<span class="component-workshop-scope-note">This definition remains read-only until a live instance is available.</span>'
    }</div></section><section class="component-workshop-section"><header><strong>Variants</strong><span>${chosenVariant ? escapeHtml(chosenVariant.name) : 'Choose a variant to preview'}</span></header><div class="component-workshop-variants">${
      variants.length
        ? variants
            .map(
              (variant) =>
                `<button class="component-workshop-variant ${workshopVariantId === variant.id ? 'active' : ''}" data-workshop-variant="${escapeHtml(variant.id)}" ${entry.elements.length && Object.keys(variant.props).length ? '' : 'disabled'}><span>${escapeHtml(variant.name)}</span><code>${escapeHtml(
                  Object.entries(variant.props)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(' · ') || 'No preview mapping',
                )}</code></button>`,
            )
            .join('')
        : '<span class="component-workshop-scope-note">No variants were discovered for this component.</span>'
    }</div></section>${authoring}${driftMarkup}<section class="component-workshop-section"><header><strong>Visual states</strong><span>Preview only · never saved as a design change</span></header><div class="component-workshop-states">${
      states.length
        ? states
            .map(
              (item) =>
                `<button class="${workshopStateId === item.id ? 'active' : ''}" data-workshop-state="${escapeHtml(item.id)}" data-confidence="${item.confidence}" ${entry.elements.length ? '' : 'disabled'}><i class="component-workshop-state-signal"></i>${escapeHtml(item.label)}</button>`,
            )
            .join('')
        : '<span class="component-workshop-state-note">No authored component states are indexed for this project.</span>'
    }</div><span class="component-workshop-state-note">Only authored states from the project design graph appear here.</span></section>`;
    renderIcons(body);
    upgradeFdcSelects(body);
    body
      .querySelector<HTMLSelectElement>('[data-workshop-component]')!
      .addEventListener('change', (event) => {
        clearWorkshopStatePreview();
        workshopComponentId = (event.currentTarget as HTMLSelectElement).value;
        workshopVariantId = '';
        workshopStateId = 'current';
        const next = currentWorkshopEntry()?.elements[0];
        if (next) select(next);
        renderComponentWorkshop();
      });
    body.querySelectorAll<HTMLButtonElement>('[data-workshop-scope]').forEach((button) =>
      button.addEventListener('click', () => {
        scope.value = button.dataset.workshopScope as ComponentWorkshopScope;
        syncFdcSelect(scope);
        renderComponentWorkshop();
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-workshop-instance]').forEach((button) =>
      button.addEventListener('click', () => {
        const element = entry.elements[Number(button.dataset.workshopInstance)];
        if (!element) return;
        clearWorkshopStatePreview();
        workshopStateId = 'current';
        select(element);
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        renderComponentWorkshop();
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-workshop-variant]').forEach((button) =>
      button.addEventListener('click', () => {
        const variant = variants.find((item) => item.id === button.dataset.workshopVariant);
        if (variant) void previewWorkshopVariant(entry, variant);
      }),
    );
    body
      .querySelector<HTMLButtonElement>('[data-workshop-create-variant]')
      ?.addEventListener('click', () => {
        void stageWorkshopVariant(entry, {
          axisId: body.querySelector<HTMLSelectElement>('[data-workshop-axis]')!.value,
          label: body.querySelector<HTMLInputElement>('[data-workshop-variant-label]')!.value,
          value: body.querySelector<HTMLInputElement>('[data-workshop-variant-value]')!.value,
          baseVariantId:
            body.querySelector<HTMLSelectElement>('[data-workshop-base]')!.value || undefined,
        });
      });
    body
      .querySelector<HTMLButtonElement>('[data-workshop-repair-drift]')
      ?.addEventListener('click', () => {
        if (chosenVariant) void repairWorkshopVariantDrift(entry, chosenVariant);
      });
    body.querySelectorAll<HTMLButtonElement>('[data-workshop-state]').forEach((button) =>
      button.addEventListener('click', () => {
        const nextState = states.find((item) => item.id === button.dataset.workshopState);
        const target = selected && entry.elements.includes(selected) ? selected : entry.elements[0];
        if (!nextState || !target) return;
        workshopStateId = nextState.id;
        applyWorkshopStatePreview(target, nextState);
        renderComponentWorkshop();
      }),
    );
  }

  function openComponentWorkshop(componentId?: string): void {
    if (componentId) workshopComponentId = componentId;
    if (workspaceState.utility !== 'component') setUtility('component');
    else renderComponentWorkshop();
  }

  function closeComponentWorkshop(): void {
    clearWorkshopStatePreview();
    workshopStateId = 'current';
    if (workspaceState.utility === 'component') setUtility(null);
  }

  function renderComponents(
    components: ReturnType<typeof componentCatalog>,
    queryValue: string,
  ): void {
    const visible = components.filter((entry) =>
      `${entry.name} ${entry.namespace} ${entry.path}`.toLowerCase().includes(queryValue),
    );
    layerTree.innerHTML = visible.length
      ? `<div class="component-list">${visible
          .map((entry) => {
            const index = components.indexOf(entry);
            const liveCount = entry.elements.length;
            const selectedComponent = entry.elements.some((element) =>
              selectedElements.includes(element),
            );
            const variants = entry.variants
              .slice(0, 3)
              .map(
                (variant) =>
                  `<button data-component-variant="${escapeHtml(variant.id)}" data-component-owner="${index}">${escapeHtml(variant.name)}</button>`,
              )
              .join('');
            const remainingVariants = Math.max(0, entry.variants.length - 3);
            return `<article class="component-card ${selectedComponent ? 'selected' : ''}" data-component-row="${index}"><button class="component-main" data-component-index="${index}" aria-label="${liveCount ? `Select ${escapeHtml(entry.name)} component` : `${escapeHtml(entry.name)} component is not on the canvas`}" ${liveCount ? '' : 'disabled'}><span class="component-mark"><i data-foundry-icon="component"></i></span><span class="component-copy"><strong>${escapeHtml(entry.name)}</strong><span>${escapeHtml(entry.namespace)}</span></span><span class="component-status"><span>${liveCount ? `${liveCount} live` : 'Indexed'}</span><small>${entry.variants.length ? `${entry.variants.length} variant${entry.variants.length === 1 ? '' : 's'}` : `${entry.indexedInstances} instance${entry.indexedInstances === 1 ? '' : 's'}`}</small></span></button>${variants ? `<div class="component-variants">${variants}${remainingVariants ? `<button data-component-index="${index}">+${remainingVariants}</button>` : ''}</div>` : ''}<div class="component-actions"><button data-open-component-workshop="${index}">Open workshop</button>${liveCount > 1 ? `<button data-select-all-instances="${index}">Select all ${liveCount}</button>` : ''}</div></article>`;
          })
          .join('')}</div>`
      : '<div class="layers-empty">No components match this search.</div>';
    renderIcons(layerTree);
    layerTree.querySelectorAll<HTMLElement>('[data-component-row]').forEach((row) => {
      const entry = components[Number(row.dataset.componentRow)];
      const preview = entry?.elements[0];
      if (!preview) return;
      row.addEventListener('mouseenter', () => previewLayer(preview));
      row.addEventListener('mouseleave', () => previewLayer(null));
    });
    layerTree.querySelectorAll<HTMLButtonElement>('[data-component-index]').forEach((button) => {
      const entry = components[Number(button.dataset.componentIndex)];
      if (!entry?.elements.length) return;
      button.addEventListener('click', () => {
        const current = entry.elements.indexOf(selected!);
        const element = entry.elements[(current + 1) % entry.elements.length] ?? entry.elements[0];
        if (!element) return;
        select(element);
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        renderLayers(false);
      });
    });
    layerTree
      .querySelectorAll<HTMLButtonElement>('[data-select-all-instances]')
      .forEach((button) => {
        const entry = components[Number(button.dataset.selectAllInstances)];
        if (!entry?.elements.length) return;
        button.addEventListener('click', () => {
          select(entry.elements[0]!);
          selectedElements = [...entry.elements];
          updateOutline();
          renderLayers(false);
          showToast(`${entry.elements.length} ${entry.name} instances selected`);
        });
      });
    layerTree
      .querySelectorAll<HTMLButtonElement>('[data-open-component-workshop]')
      .forEach((button) => {
        const entry = components[Number(button.dataset.openComponentWorkshop)];
        if (!entry) return;
        button.addEventListener('click', () => openComponentWorkshop(entry.id));
      });
    layerTree.querySelectorAll<HTMLButtonElement>('[data-component-variant]').forEach((button) => {
      const entry = components[Number(button.dataset.componentOwner)];
      const element = entry?.elements[0];
      if (!entry || !element) {
        button.disabled = true;
        return;
      }
      button.addEventListener('click', () => {
        select(element);
        const component = selectedComponent();
        const variant = component?.variants.find(
          (item) => item.id === button.dataset.componentVariant,
        );
        if (!variant) return;
        canvasVariant.value = variant.id;
        canvasVariant.dispatchEvent(new Event('change'));
        renderLayers(false);
      });
    });
  }

  function previewLayer(element: HTMLElement | null): void {
    if (!element || element === selected || !element.isConnected) {
      hoverOutline.hidden = true;
      return;
    }
    const rect = element.getBoundingClientRect();
    Object.assign(hoverOutline.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    hoverOutline.dataset.label = layerLabel(element);
    hoverOutline.hidden = rect.width <= 0 || rect.height <= 0;
  }

  function renderLayers(refresh = true): void {
    if (layersPanel.hidden) return;
    const previousScrollTop = layerTree.scrollTop;
    if (refresh) discoverLayers();
    const queryValue = layerSearch.value.trim().toLowerCase();
    const components = componentCatalog();
    layerTabCount.textContent = String(layerEntries.length);
    componentTabCount.textContent = String(components.length);
    layerTitle.textContent = layerView === 'layers' ? 'Layers' : 'Components';
    layerCount.textContent = String(
      layerView === 'layers' ? layerEntries.length : components.length,
    );
    layerSearch.placeholder = layerView === 'layers' ? 'Search layers' : 'Search components';
    layerSearch.setAttribute(
      'aria-label',
      layerView === 'layers' ? 'Search layers' : 'Search components',
    );
    layerViewButtons.forEach((button) => {
      const active = button.dataset.layerView === layerView;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    if (layerView === 'components') {
      renderComponents(components, queryValue);
      layerTree.scrollTop = previousScrollTop;
      return;
    }
    const hiddenByCollapsedParent = (element: HTMLElement): boolean => {
      let parent = composedParent(element);
      while (parent && parent !== document.body) {
        if (collapsedLayers.has(parent)) return true;
        parent = composedParent(parent);
      }
      return false;
    };
    const visible = layerEntries.filter(
      (entry) =>
        (queryValue || !hiddenByCollapsedParent(entry.element)) &&
        `${entry.label} ${entry.kind} ${entry.element.dataset.foundrySource ?? ''}`
          .toLowerCase()
          .includes(queryValue),
    );
    const range =
      visible.length > 120 && !queryValue
        ? virtualRange(visible.length, previousScrollTop, layerTree.clientHeight || 320, 30, 8)
        : { start: 0, end: visible.length, before: 0, after: 0 };
    const rendered = visible.slice(range.start, range.end);
    const hasRenderedSelection = rendered.some((entry) => selectedElements.includes(entry.element));
    const previouslyVisible = visibleLayerElements;
    visibleLayerElements = new Set(visible.map((entry) => entry.element));
    layerTree.innerHTML = visible.length
      ? `${range.before ? `<div class="layer-spacer" style="height:${range.before}px"></div>` : ''}${rendered
          .map((entry, renderedPosition) => {
            const index = layerEntries.indexOf(entry);
            const meta = entry.instrumented ? 'Mapped' : entry.kind;
            const collapsed = collapsedLayers.has(entry.element);
            const position = range.start + renderedPosition;
            const depth = Math.min(entry.depth, 8);
            const selectedLayer = selectedElements.includes(entry.element);
            const entering = previouslyVisible.has(entry.element) ? '' : ' entering';
            const branch = depth ? `<span class="layer-branch" aria-hidden="true"></span>` : '';
            return `<div class="layer-row ${selectedLayer ? 'selected' : ''}${entering}" style="--layer-depth:${depth};--layer-position:${Math.min(renderedPosition, 5)};--layer-branch-left:${10 + (depth - 1) * 10}px" data-layer-row="${index}" draggable="true">${branch}<button class="layer-toggle" data-layer-toggle="${index}" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${escapeHtml(entry.label)}" aria-expanded="${!collapsed}" ${entry.hasChildren ? '' : 'disabled'}><i data-foundry-icon="${collapsed ? 'chevron-right' : 'chevron-down'}"></i></button><button class="layer-select" data-layer-index="${index}" role="treeitem" aria-level="${depth + 1}" aria-posinset="${position + 1}" aria-setsize="${visible.length}" aria-selected="${selectedLayer}" ${entry.hasChildren ? `aria-expanded="${!collapsed}"` : ''} tabindex="${selectedLayer || (!hasRenderedSelection && renderedPosition === 0) ? '0' : '-1'}" aria-label="Select ${escapeHtml(entry.label)}"><i class="layer-icon" data-foundry-icon="${entry.kind === 'component' ? 'component' : 'box'}"></i><span class="layer-label">${escapeHtml(entry.label)}</span><span class="layer-meta">${escapeHtml(meta)}</span></button></div>`;
          })
          .join(
            '',
          )}${range.after ? `<div class="layer-spacer" style="height:${range.after}px"></div>` : ''}`
      : '<div class="layers-empty">No visible layers match this search.</div>';
    layerTree.scrollTop = previousScrollTop;
    const selectedRow = layerTree.querySelector<HTMLElement>('.layer-row.selected');
    if (selectedRow) {
      const targetTop = selectedRow.offsetTop;
      const glide = document.createElement('span');
      glide.className = 'layer-selection-glide';
      glide.setAttribute('aria-hidden', 'true');
      glide.style.setProperty('--layer-glide-y', `${layerGlideTop ?? targetTop}px`);
      layerTree.prepend(glide);
      requestAnimationFrame(() => {
        glide.style.setProperty('--layer-glide-y', `${targetTop}px`);
      });
      layerGlideTop = targetTop;
    } else {
      layerGlideTop = null;
    }
    renderIcons(layerTree);
    layerTree.querySelectorAll<HTMLElement>('[data-layer-row]').forEach((row) => {
      const entry = layerEntries[Number(row.dataset.layerRow)];
      if (!entry) return;
      row.addEventListener('mouseenter', () => previewLayer(entry.element));
      row.addEventListener('mouseleave', () => previewLayer(null));
      row.addEventListener('dragstart', (event) => {
        draggedLayer = entry.element;
        row.classList.add('dragging');
        event.dataTransfer?.setData('text/plain', foundrySelector(entry.element));
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => {
        draggedLayer = null;
        row.classList.remove('dragging');
        layerTree
          .querySelectorAll('.drop-target')
          .forEach((item) => item.classList.remove('drop-target'));
      });
      row.addEventListener('dragover', (event) => {
        if (!draggedLayer || draggedLayer === entry.element) return;
        if (composedParent(draggedLayer) !== composedParent(entry.element)) return;
        event.preventDefault();
        row.classList.add('drop-target');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        row.classList.remove('drop-target');
        if (!draggedLayer || draggedLayer === entry.element) return;
        const parent = draggedLayer.parentElement;
        if (!parent || parent !== entry.element.parentElement) {
          showToast('Layers can only be reordered within the same parent');
          return;
        }
        const before = [...parent.children].indexOf(draggedLayer);
        const targetIndex = [...parent.children].indexOf(entry.element);
        const moving = draggedLayer;
        if (before < targetIndex) entry.element.after(moving);
        else entry.element.before(moving);
        const after = [...parent.children].indexOf(moving);
        if (before === after) return;
        pushHistory({
          element: moving,
          property: 'domOrder',
          before,
          after,
          category: 'layout',
          label: 'Layer order',
        });
        const control: Control = {
          category: 'layout',
          property: 'domOrder',
          label: 'Layer order',
          kind: 'number',
          value: before,
          read: () => [...parent.children].indexOf(moving),
          apply: () => {},
        };
        void record(control, before, after, moving, `Reorder ${layerLabel(moving)}`);
        draggedLayer = null;
        renderLayers();
        updateOutline();
        showToast('Layer reordered');
      });
    });
    layerTree.querySelectorAll<HTMLButtonElement>('[data-layer-toggle]').forEach((button) => {
      const entry = layerEntries[Number(button.dataset.layerToggle)];
      if (!entry) return;
      button.addEventListener('click', () => {
        if (collapsedLayers.has(entry.element)) collapsedLayers.delete(entry.element);
        else collapsedLayers.add(entry.element);
        renderLayers();
      });
    });
    layerTree.querySelectorAll<HTMLButtonElement>('[data-layer-index]').forEach((button) => {
      const entry = layerEntries[Number(button.dataset.layerIndex)];
      if (!entry) return;
      button.addEventListener('click', (event) => {
        select(entry.element, event.shiftKey);
        entry.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
      button.addEventListener('keydown', (event) => {
        const buttons = [...layerTree.querySelectorAll<HTMLButtonElement>('[data-layer-index]')];
        const currentIndex = buttons.indexOf(button);
        const focusAt = (index: number): void => {
          const target = buttons[index];
          if (!target) return;
          buttons.forEach((item) => (item.tabIndex = item === target ? 0 : -1));
          target.focus();
          target.closest('.layer-row')?.scrollIntoView({ block: 'nearest' });
        };
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          focusAt(Math.min(buttons.length - 1, currentIndex + 1));
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          focusAt(Math.max(0, currentIndex - 1));
          return;
        }
        if (event.key === 'Home') {
          event.preventDefault();
          focusAt(0);
          return;
        }
        if (event.key === 'End') {
          event.preventDefault();
          focusAt(buttons.length - 1);
          return;
        }
        if (event.key === 'ArrowRight' && entry.hasChildren) {
          event.preventDefault();
          if (collapsedLayers.has(entry.element)) {
            collapsedLayers.delete(entry.element);
            renderLayers(false);
            requestAnimationFrame(() =>
              layerTree
                .querySelector<HTMLButtonElement>(
                  `[data-layer-index="${layerEntries.indexOf(entry)}"]`,
                )
                ?.focus(),
            );
          } else {
            const next = buttons[currentIndex + 1];
            const nextEntry = next ? layerEntries[Number(next.dataset.layerIndex)] : undefined;
            if (nextEntry && nextEntry.depth > entry.depth) focusAt(currentIndex + 1);
          }
          return;
        }
        if (event.key !== 'ArrowLeft') return;
        event.preventDefault();
        if (entry.hasChildren && !collapsedLayers.has(entry.element)) {
          collapsedLayers.add(entry.element);
          renderLayers(false);
          requestAnimationFrame(() =>
            layerTree
              .querySelector<HTMLButtonElement>(
                `[data-layer-index="${layerEntries.indexOf(entry)}"]`,
              )
              ?.focus(),
          );
          return;
        }
        for (let index = currentIndex - 1; index >= 0; index -= 1) {
          const candidate = layerEntries[Number(buttons[index]?.dataset.layerIndex)];
          if (candidate && candidate.depth < entry.depth) {
            focusAt(index);
            break;
          }
        }
      });
    });
  }

  const layersPreferenceKey = '__foundry_layers_visibility';
  function toggleLayers(force?: boolean, remember = true): void {
    workspaceState = updateWorkspace(workspaceState, {
      type: 'toggle-layers',
      open: force,
    });
    layersPanel.hidden = !workspaceState.layersOpen;
    const layersButton = shadow.querySelector<HTMLButtonElement>('.toggle-layers')!;
    const layersButtonLabel = workspaceState.layersOpen ? 'Hide layers' : 'Show layers';
    layersButton.setAttribute('aria-label', layersButtonLabel);
    layersButton.title = layersButtonLabel;
    layersButton.setAttribute('aria-pressed', String(workspaceState.layersOpen));
    layersButton.classList.toggle('active', workspaceState.layersOpen);
    if (remember) {
      sessionStorage.setItem(layersPreferenceKey, workspaceState.layersOpen ? 'open' : 'closed');
    }
    if (workspaceState.layersOpen) renderLayers();
    else previewLayer(null);
    positionWorkspaceSurfaces();
  }

  function toggleInspector(force?: boolean): void {
    workspaceState = updateWorkspace(workspaceState, {
      type: 'toggle-inspector',
      open: force,
    });
    panel.hidden = !workspaceState.inspectorOpen;
    shadow.querySelectorAll<HTMLButtonElement>('.toggle-inspector').forEach((button) => {
      button.classList.toggle('active', workspaceState.inspectorOpen);
      button.setAttribute('aria-pressed', String(workspaceState.inspectorOpen));
      if (!button.classList.contains('inspector-collapse')) {
        button.setAttribute(
          'aria-label',
          workspaceState.inspectorOpen ? 'Hide inspector' : 'Show inspector',
        );
      }
    });
    positionWorkspaceSurfaces();
  }

  function selectionCandidatesAt(x: number, y: number, preferMappedTarget = false): HTMLElement[] {
    const hitElements = (root: Document | ShadowRoot): HTMLElement[] => {
      const elements = root
        .elementsFromPoint(x, y)
        .filter(
          (element): element is HTMLElement =>
            element instanceof HTMLElement || element instanceof SVGSVGElement,
        );
      return elements.flatMap((element) => [
        ...(element.shadowRoot ? hitElements(element.shadowRoot) : []),
        element,
      ]);
    };
    const candidates = [...new Set(hitElements(document))].filter(meaningfulLayer);
    if (!preferMappedTarget) return candidates;
    const ordered = orderedSelectionIndexes(
      candidates.map((element) => {
        let depth = 0;
        let parent = element.parentElement;
        while (parent) {
          depth += 1;
          parent = parent.parentElement;
        }
        return layerSignals(element, depth);
      }),
    );
    return ordered
      .map((index) => candidates[index])
      .filter((element): element is HTMLElement => Boolean(element));
  }

  function clearSnapGuides(): void {
    shadow.querySelectorAll('.snap-guide').forEach((guide) => guide.remove());
  }

  function showSnapGuide(axis: 'vertical' | 'horizontal', position: number): void {
    const guide = document.createElement('div');
    guide.className = `snap-guide ${axis}`;
    guide.style[axis === 'vertical' ? 'left' : 'top'] = `${position}px`;
    shadow.append(guide);
  }

  function updateHistoryActions(): void {
    shadow.querySelector<HTMLButtonElement>('.undo')!.disabled = historyCursor === 0;
    shadow.querySelector<HTMLButtonElement>('.redo')!.disabled =
      historyCursor >= previewHistory.length;
    trayCompare.disabled = historyCursor === 0;
    trayCompare.title = historyCursor
      ? 'Compare changes (Shift-C)'
      : 'Make a preview change to enable comparison';
  }

  function pushHistory(entry: HistoryEntry): void {
    previewHistory.splice(historyCursor);
    previewHistory.push(entry);
    historyCursor = previewHistory.length;
    updateHistoryActions();
  }

  function applyHistoryValue(entry: HistoryEntry, value: string | number): void {
    rawHistoryValue(entry, value);
    updateOutline();
    if (entry.element === selected) {
      selectedControls = controlsFor(entry.element);
      renderControls();
    }
  }

  async function replayHistory(direction: -1 | 1): Promise<{ recorded: boolean }> {
    cancelInspectorDraft();
    const grouped =
      direction < 0 ? previewHistory[historyCursor - 1] : previewHistory[historyCursor];
    if (grouped?.gestureId) {
      const gestureId = grouped.gestureId;
      do {
        await replayHistoryEntry(direction);
      } while (
        (direction < 0 ? previewHistory[historyCursor - 1] : previewHistory[historyCursor])
          ?.gestureId === gestureId
      );
      return { recorded: true };
    }
    return replayHistoryEntry(direction);
  }

  async function replayHistoryEntry(direction: -1 | 1): Promise<{ recorded: boolean }> {
    const entry = direction < 0 ? previewHistory[historyCursor - 1] : previewHistory[historyCursor];
    if (!entry)
      throw new Error(direction < 0 ? 'There is nothing to undo' : 'There is nothing to redo');
    const nextCursor = historyCursor + direction;
    const from = direction < 0 ? entry.after : entry.before;
    const to = direction < 0 ? entry.before : entry.after;
    applyHistoryValue(entry, to);
    const historyControl: Control = {
      category: entry.category,
      property: entry.property,
      label: entry.label,
      kind: typeof to === 'number' ? 'number' : 'text',
      value: to,
      unit: entry.unit,
      read: () => to,
      apply: () => {},
    };
    const recorded = await record(
      historyControl,
      from,
      to,
      entry.element,
      direction < 0 ? 'Undo' : 'Redo',
    );
    if (!recorded) {
      applyHistoryValue(entry, from);
      updateHistoryActions();
      throw new Error(
        `The preview ${direction < 0 ? 'undo' : 'redo'} could not be recorded and was restored`,
      );
    }
    historyCursor = nextCursor;
    nextInspectorRevision++;
    updateHistoryActions();
    return { recorded };
  }

  async function sessionRequest(path = '', options: RequestInit = {}): Promise<any> {
    const writes = Boolean(options.body) || !['', 'GET'].includes(options.method ?? 'GET');
    if (writes) setSessionStatus('saving');
    try {
      const response = await fetch(`${runtimeUrl}/v1/sessions/${sessionId}${path}`, {
        ...options,
        headers: {
          ...(options.body ? { 'content-type': 'application/json' } : {}),
          'x-foundry-token': token,
          ...options.headers,
        },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Foundry request failed');
      setSessionStatus(writes ? 'saved' : 'live');
      return payload;
    } catch (error) {
      setSessionStatus('error', error instanceof Error ? error.message : 'Foundry request failed');
      throw error;
    }
  }

  function workbenchDocument(): Document | null {
    try {
      return shadow.querySelector<HTMLIFrameElement>('.frame-shell iframe')!.contentDocument;
    } catch {
      return null;
    }
  }

  function resizeWorkbench(): void {
    const viewportId = shadow.querySelector<HTMLSelectElement>('[data-workbench-viewport]')!.value;
    const viewport = designGraph?.breakpoints.find((item) => item.id === viewportId);
    if (!viewport) return;
    const shell = shadow.querySelector<HTMLElement>('.frame-shell')!;
    shell.style.width = `${viewport.width}px`;
    shell.style.height = `${viewport.height}px`;
    shell.querySelector<HTMLElement>('.frame-label')!.textContent =
      `${viewport.label} · ${viewport.width} × ${viewport.height}`;
    breakpoint.value = viewport.id;
  }

  let pseudoMatchRevision = 0;

  function authoredPseudoCss(
    documentRoot: Document,
    state: PreviewPseudoState,
    target: HTMLElement,
  ): { css: string; evidence: string[] } {
    const rules: string[] = [];
    const evidence: string[] = [];
    const markerAttribute = 'data-foundry-pseudo-match';
    const markerValue = `${state}-${++pseudoMatchRevision}`;
    const previousMarker = target.getAttribute(markerAttribute);
    const markerSelector = `[${markerAttribute}="${markerValue}"]`;
    target.setAttribute(markerAttribute, markerValue);
    try {
      const visit = (ruleList: CSSRuleList): void => {
        for (const rule of [...ruleList]) {
          if ('selectorText' in rule && 'style' in rule) {
            const styleRule = rule as CSSStyleRule;
            const matchesTarget = authoredPseudoSelectorMatches(
              styleRule.selectorText,
              state,
              markerSelector,
              (selector) => documentRoot.querySelector(selector) !== null,
            );
            if (!matchesTarget) continue;
            const selector = replacePreviewPseudoSelector(styleRule.selectorText, state);
            if (!selector) continue;
            rules.push(`${selector}{${styleRule.style.cssText}}`);
            evidence.push(styleRule.selectorText);
            continue;
          }
          if ('cssRules' in rule) {
            try {
              visit((rule as CSSGroupingRule).cssRules);
            } catch {
              // Cross-origin nested rules cannot be rewritten safely.
            }
          }
        }
      };
      for (const sheet of [...documentRoot.styleSheets]) {
        try {
          visit(sheet.cssRules);
        } catch {
          // Cross-origin styles remain visible but cannot be safely rewritten.
        }
      }
    } finally {
      if (previousMarker == null) target.removeAttribute(markerAttribute);
      else target.setAttribute(markerAttribute, previousMarker);
    }
    return { css: rules.join('\n'), evidence: [...new Set(evidence)] };
  }

  function applyWorkbenchState(): void {
    const frame = shadow.querySelector<HTMLIFrameElement>('.frame-shell iframe')!;
    const frameDocument = workbenchDocument();
    const warning = shadow.querySelector<HTMLElement>('.workbench-warning')!;
    if (!frameDocument) {
      warning.hidden = false;
      warning.textContent =
        'This application blocks same-origin framing. Foundry is keeping the current live viewport available instead.';
      return;
    }
    restoreWorkbenchPreview();
    restoreWorkbenchPreview = (): void => {};
    const graph = previewGraph();
    const selectedState = graph.states.find((item) => item.id === workbenchStateId);
    const managedQueryKeys = new Set(graph.states.flatMap((item) => Object.keys(item.query ?? {})));
    const requestedQuery = queryForPreviewState(graph.states, workbenchStateId);
    const nextUrl = new URL(frame.src || location.href, location.href);
    for (const key of managedQueryKeys) {
      if (key in requestedQuery) nextUrl.searchParams.set(key, requestedQuery[key]!);
      else nextUrl.searchParams.delete(key);
    }
    if (nextUrl.href !== frame.src) {
      frame.src = nextUrl.href;
      return;
    }
    const issues: string[] = [];
    const restorers: Array<() => void> = [];
    const preserveAttribute = (element: HTMLElement, name: string): void => {
      const before = element.getAttribute(name);
      restorers.push(() => {
        if (before == null) element.removeAttribute(name);
        else element.setAttribute(name, before);
      });
    };
    const root = frameDocument.documentElement;
    const requestedThemeId =
      shadow.querySelector<HTMLSelectElement>('[data-workbench-theme]')!.value;
    const themeId =
      requestedThemeId === 'current' && selectedState?.theme
        ? selectedState.theme
        : requestedThemeId;
    if (themeId !== 'current') {
      const selectedTheme = graph.themes.find((item) => item.id === themeId);
      if (!selectedTheme) {
        issues.push(`Theme ${themeId} is not authored for this project.`);
      } else {
        const preservedAttributes = new Set<string>();
        const preservedClasses = new Set<string>();
        for (const item of graph.themes) {
          const hook = themeHook(item);
          if (hook.method === 'attribute' && !preservedAttributes.has(hook.attribute)) {
            preservedAttributes.add(hook.attribute);
            preserveAttribute(root, hook.attribute);
            root.removeAttribute(hook.attribute);
          }
          if (hook.method === 'class' && !preservedClasses.has(hook.className)) {
            preservedClasses.add(hook.className);
            const present = root.classList.contains(hook.className);
            restorers.push(() => root.classList.toggle(hook.className, present));
            root.classList.remove(hook.className);
          }
        }
        const hook = themeHook(selectedTheme);
        if (hook.method === 'attribute') root.setAttribute(hook.attribute, hook.value);
        else if (hook.method === 'class') root.classList.add(hook.className);
        else issues.push(`Theme ${selectedTheme.label} has no safe root hook.`);
      }
    }
    if ([...theme.options].some((option) => option.value === themeId)) {
      theme.value = themeId;
      syncFdcSelect(theme);
    }
    const selector = selected ? cssPath(selected) : undefined;
    const framedTarget = selector
      ? (frameDocument.querySelector(selector) as HTMLElement | null)
      : null;
    const requiresTarget = Boolean(
      selectedState &&
      (Object.keys(selectedState.variant ?? {}).length ||
        (selectedState.pseudoStates ?? []).length),
    );
    if (requiresTarget && !framedTarget) {
      issues.push('Select a rendered target before previewing this authored state.');
    } else if (selectedState && framedTarget) {
      for (const [property, value] of Object.entries(selectedState.variant ?? {})) {
        const attribute = variantAttribute(property);
        preserveAttribute(framedTarget, attribute);
        framedTarget.setAttribute(attribute, String(value));
      }
      const previouslyFocused = deepestActiveElement(frameDocument);
      for (const pseudo of selectedState.pseudoStates ?? []) {
        const authored = authoredPseudoCss(frameDocument, pseudo, framedTarget);
        if ((pseudo === 'hover' || pseudo === 'active') && !authored.evidence.length) {
          issues.push(`No same-origin authored :${pseudo} rule matches the selected target.`);
          continue;
        }
        if (pseudo === 'focus' && !supportsNativeFocus(framedTarget)) {
          issues.push('The selected target does not support native focus.');
          continue;
        }
        if (pseudo === 'disabled' && !('disabled' in framedTarget)) {
          issues.push('The selected target does not support the native disabled state.');
          continue;
        }
        const forcedAttribute = `data-foundry-force-${pseudo}`;
        preserveAttribute(framedTarget, forcedAttribute);
        framedTarget.setAttribute(forcedAttribute, 'true');
        if (authored.css) {
          const style = frameDocument.createElement('style');
          style.dataset.foundryWorkbenchState = pseudo;
          style.textContent = authored.css;
          frameDocument.head.append(style);
          restorers.push(() => style.remove());
        }
        if (pseudo === 'focus') framedTarget.focus({ preventScroll: true });
        if (pseudo === 'disabled') {
          preserveAttribute(framedTarget, 'disabled');
          preserveAttribute(framedTarget, 'aria-disabled');
          framedTarget.setAttribute('disabled', '');
          framedTarget.setAttribute('aria-disabled', 'true');
        }
      }
      restorers.push(() => {
        restoreOriginalFocus(frameDocument, framedTarget, previouslyFocused);
      });
    }
    if (selectedState?.reducedMotion) {
      const authoredRules = authoredReducedMotionEvidence(frameDocument);
      if (!authoredRules.length) {
        issues.push('This project does not expose an authored reduced-motion rule.');
      } else if (
        !frameDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        issues.push(
          'Enable the system reduced-motion preference to inspect the project’s authored behavior.',
        );
      }
    }
    restoreWorkbenchPreview = () => restorers.reverse().forEach((restore) => restore());
    if ([...state.options].some((option) => option.value === workbenchStateId)) {
      state.value = workbenchStateId;
      syncFdcSelect(state);
    } else {
      state.value = 'current';
      syncFdcSelect(state);
    }
    warning.hidden = issues.length === 0;
    warning.textContent = issues.join(' ');
  }

  function renderWorkbenchMatrix(): void {
    const matrix = shadow.querySelector<HTMLElement>('.workbench-matrix')!;
    if (!designGraph) {
      matrix.innerHTML = '';
      return;
    }
    const themes = [
      { id: 'current', label: 'Current' },
      ...designGraph.themes.map(({ id, label }) => ({ id, label })),
    ];
    const targetId = selected ? foundryTargetId(selected) : '';
    matrix.style.setProperty('--matrix-columns', String(themes.length));
    matrix.innerHTML = `<span class="matrix-cell header">Viewport</span>${themes.map((item) => `<span class="matrix-cell header">${escapeHtml(item.label)}</span>`).join('')}${designGraph.breakpoints
      .map(
        (viewport) =>
          `<span class="matrix-cell header"><strong>${escapeHtml(viewport.label)}</strong><span>${viewport.width} × ${viewport.height}</span></span>${themes
            .map((themeItem) => {
              const baseline = targetId
                ? designMemory.baselines.find(
                    (item) =>
                      item.targetId === targetId &&
                      item.breakpoint === viewport.id &&
                      item.theme === themeItem.id,
                  )
                : undefined;
              return `<button class="matrix-cell ${baseline ? 'verified' : ''}" data-matrix-viewport="${escapeHtml(viewport.id)}" data-matrix-theme="${escapeHtml(themeItem.id)}"><strong>${baseline ? 'Verified' : 'Preview'}</strong><span>${baseline ? new Date(baseline.verifiedAt).toLocaleDateString() : 'Open live state'}</span></button>`;
            })
            .join('')}`,
      )
      .join('')}`;
    matrix.querySelectorAll<HTMLButtonElement>('[data-matrix-viewport]').forEach((button) =>
      button.addEventListener('click', () => {
        shadow.querySelector<HTMLSelectElement>('[data-workbench-viewport]')!.value =
          button.dataset.matrixViewport!;
        shadow.querySelector<HTMLSelectElement>('[data-workbench-theme]')!.value =
          button.dataset.matrixTheme!;
        resizeWorkbench();
        applyWorkbenchState();
        button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }),
    );
  }

  function toggleWorkbenchMatrix(): void {
    matrixMode = !matrixMode;
    const matrix = shadow.querySelector<HTMLElement>('.workbench-matrix')!;
    const stage = shadow.querySelector<HTMLElement>('.workbench-stage')!;
    const button = shadow.querySelector<HTMLButtonElement>('[data-workbench-matrix]')!;
    matrix.hidden = !matrixMode;
    stage.classList.toggle('matrix-mode', matrixMode);
    button.classList.toggle('active', matrixMode);
    if (matrixMode) renderWorkbenchMatrix();
  }

  function openWorkbench(): void {
    workspaceState = updateWorkspace(workspaceState, {
      type: 'set-workbench',
      open: true,
    });
    workbench.hidden = false;
    const workbenchButton = shadow.querySelector<HTMLButtonElement>('.open-workbench')!;
    workbenchButton.classList.add('active');
    workbenchButton.setAttribute('aria-pressed', 'true');
    resizeWorkbench();
    const frame = shadow.querySelector<HTMLIFrameElement>('.frame-shell iframe')!;
    const url = new URL(location.href);
    url.searchParams.set('__foundry_child', '1');
    if (frame.src !== url.href) frame.src = url.href;
    else applyWorkbenchState();
    if (matrixMode) renderWorkbenchMatrix();
  }

  function closeWorkbench(): void {
    workspaceState = updateWorkspace(workspaceState, {
      type: 'set-workbench',
      open: false,
    });
    workbench.hidden = true;
    restoreWorkbenchPreview();
    restoreWorkbenchPreview = (): void => {};
    workbenchStateId = 'current';
    shadow.querySelectorAll<HTMLButtonElement>('[data-workbench-state]').forEach((button) => {
      button.classList.remove('active');
      button.setAttribute('aria-pressed', 'false');
    });
    const frame = shadow.querySelector<HTMLIFrameElement>('.frame-shell iframe')!;
    frame.removeAttribute('src');
    const workbenchButton = shadow.querySelector<HTMLButtonElement>('.open-workbench')!;
    workbenchButton.classList.remove('active');
    workbenchButton.setAttribute('aria-pressed', 'false');
  }

  function reviewValue(value: unknown, unit?: string): string {
    const rendered = typeof value === 'string' ? value : JSON.stringify(value);
    return `${rendered}${unit ?? ''}`;
  }

  function verificationResultValue(result: any): string {
    const rendered = result.rendered;
    if (!rendered || typeof rendered !== 'object' || !Array.isArray(rendered.contexts))
      return `${reviewValue(result.requested)} → ${reviewValue(rendered)}`;
    const contexts = rendered.contexts as Array<{
      lineCount?: number;
      fontLoaded?: boolean;
      clipped?: boolean;
    }>;
    const lineCounts = [...new Set(contexts.map((context) => context.lineCount).filter(Boolean))];
    const loaded = contexts.every((context) => context.fontLoaded !== false);
    const unclipped = contexts.every((context) => !context.clipped);
    const contextCopy = `${contexts.length} context${contexts.length === 1 ? '' : 's'}`;
    const lineCopy = lineCounts.length
      ? ` · ${lineCounts.join('–')} line${lineCounts.length === 1 && lineCounts[0] === 1 ? '' : 's'}`
      : '';
    return `${reviewValue(result.requested)} · ${contextCopy} · ${loaded ? 'font loaded' : 'font missing'} · ${unclipped ? 'not clipped' : 'clipped'}${lineCopy}`;
  }

  function reviewSource(change: any): string {
    if (change.target.source) {
      return `${change.target.source.file}${change.target.source.line ? `:${change.target.source.line}` : ''}`;
    }
    return change.target.locator?.selector ?? 'Source mapping unavailable';
  }

  function persistReviewDraft(): void {
    try {
      sessionStorage.setItem(reviewDraftKey, JSON.stringify(reviewDraft));
    } catch {
      // The current review remains stable in memory when session storage is unavailable.
    }
  }

  function clearReviewDraft(): void {
    reviewDraft = emptyReviewDraft();
    try {
      sessionStorage.removeItem(reviewDraftKey);
    } catch {
      // The in-memory draft has already been cleared.
    }
  }

  function updateReviewSelection(): void {
    const selectedCount = reviewBody.querySelectorAll<HTMLInputElement>(
      '[data-review-change]:checked:not(:disabled)',
    ).length;
    const selectableCount = reviewBody.querySelectorAll<HTMLInputElement>(
      '[data-review-change]:not(:disabled)',
    ).length;
    const summary = reviewBody.querySelector<HTMLElement>('.review-summary');
    const elementCount = reviewBody.querySelectorAll('.review-group').length;
    const unresolvedCount = Number(summary?.dataset.unresolved ?? 0);
    reviewCount.textContent = `${selectedCount} of ${selectableCount} included`;
    if (summary) {
      summary.classList.toggle('attention', unresolvedCount > 0);
      summary.querySelector('strong')!.textContent = reviewSummary(
        selectedCount,
        selectableCount,
        elementCount,
        unresolvedCount,
      );
    }
    reviewBody.querySelectorAll<HTMLElement>('.review-group').forEach((group) => {
      const included = group.querySelectorAll<HTMLInputElement>(
        '[data-review-change]:checked:not(:disabled)',
      ).length;
      const count = group.querySelector<HTMLElement>('.included-count');
      if (count) count.textContent = `${included} included`;
    });
    applyButton.textContent = selectedCount
      ? activeAgentPresence.connected
        ? `Apply ${selectedCount} with agent`
        : `Queue ${selectedCount} for agent`
      : 'Apply with agent';
    applyButton.disabled = selectedCount === 0;
  }

  function agentConnectionMarkup(): string {
    const agentName = activeAgentPresence.presence?.agent?.name;
    return `<div class="review-agent ${activeAgentPresence.connected ? 'connected' : 'disconnected'}" aria-live="polite"><i></i><div><strong>${activeAgentPresence.connected ? `${escapeHtml(agentName ?? 'Coding agent')} is ready` : 'Agent currently offline'}</strong><span>${activeAgentPresence.connected ? 'Apply requests will be claimed automatically while this agent keeps listening.' : 'You can queue this batch now. Codex, Cursor, or Claude Code will claim it when the Foundry listener reconnects.'}</span></div>${activeAgentPresence.connected ? '' : '<button data-copy-agent-listener>Copy reconnect instruction</button>'}</div>`;
  }

  function copyAgentListenerInstruction(): void {
    void navigator.clipboard.writeText(
      'Start Foundry for this project and keep listening for Apply with agent requests.',
    );
    showToast('Agent instruction copied');
  }

  function updateAgentConnection(): void {
    const current = reviewBody.querySelector<HTMLElement>('.review-agent');
    if (!current) {
      updateReviewSelection();
      return;
    }
    const replacement = document.createElement('div');
    replacement.innerHTML = agentConnectionMarkup();
    current.replaceWith(replacement.firstElementChild!);
    reviewBody
      .querySelector<HTMLButtonElement>('[data-copy-agent-listener]')
      ?.addEventListener('click', copyAgentListenerInstruction);
    updateReviewSelection();
  }

  function renderReviewList(changes: any[]): void {
    const groups = new Map<string, any[]>();
    for (const change of changes) {
      const key = change.target.id;
      groups.set(key, [...(groups.get(key) ?? []), change]);
    }
    const rejectedCount =
      activeReviewPayload?.changeSet?.changes?.filter(
        (change: any) =>
          change.status === 'rejected' && String(change.before) !== String(change.after),
      ).length ?? 0;
    const unresolvedCount = changes.filter(
      (change: any) =>
        change.confidence === 'unresolved' ||
        (change.mappingCandidates?.length > 1 && !change.selectedMappingId),
    ).length;
    reviewBody.innerHTML =
      changes.length || rejectedCount
        ? `<div class="review-overview"><div class="review-summary" data-unresolved="${unresolvedCount}" aria-live="polite"><strong>Preparing review…</strong><span>Only included, exactly mapped changes will be sent to your agent.</span></div><div class="review-toolbar"><button data-review-compare>Compare</button><button data-review-approve-exact>Include all</button><button data-review-toggle-rejected>${reviewShowRejected ? 'Hide removed' : rejectedCount ? `${rejectedCount} removed` : 'Removed'}</button></div></div>${agentConnectionMarkup()}${[
            ...groups.values(),
          ]
            .map((group) => {
              const target = group[0].target;
              const collapsed = collapsedReviewGroups.has(target.id);
              return `<section class="review-group ${collapsed ? 'collapsed' : ''}" data-review-target="${escapeHtml(target.id)}"><button class="review-group-title" aria-expanded="${String(!collapsed)}"><i data-foundry-icon="chevron-down"></i><strong>${escapeHtml(target.label)}</strong><span class="included-count"></span><span class="group-total">${group.length}</span></button>${group
                .map((change: any) => {
                  const unresolved =
                    change.confidence === 'unresolved' ||
                    (change.mappingCandidates?.length > 1 && !change.selectedMappingId);
                  const selectable = !unresolved && change.status !== 'rejected';
                  const checked = selectable && reviewSelection(reviewDraft, change.id, true);
                  const afterValue = reviewAfterValue(reviewDraft, change.id, change.after);
                  const inputType = typeof change.after === 'number' ? 'number' : 'text';
                  const mappingChooser =
                    unresolved && change.operationId
                      ? `<span class="mapping-chooser"><strong>Choose how this should map to source</strong>${change.mappingCandidates
                          .map(
                            (mapping: BrowserMappingCandidate) =>
                              `<label class="mapping-option"><input type="radio" name="mapping-${escapeHtml(change.operationId)}" data-operation-id="${escapeHtml(change.operationId)}" data-mapping-choice="${escapeHtml(mapping.id)}"/><span>${escapeHtml(mapping.label)}<small>${escapeHtml(mapping.evidence.join(' · '))} · affects ${mapping.blastRadius}</small></span></label>`,
                          )
                          .join('')}</span>`
                      : '';
                  const componentName = change.target.componentPath?.at(-1);
                  const component = designGraph?.components.find(
                    (item) => item.name === componentName || item.id === componentName,
                  );
                  const impact = impactMessages({
                    scope: change.scope,
                    breakpoint: change.context.breakpoint,
                    theme: change.context.theme,
                    state: change.context.state,
                    token: change.token,
                    componentInstances: component?.instances,
                    unresolved,
                  });
                  const deletable = change.status !== 'applied';
                  const contextSetLabel = reviewContextSetLabel(change);
                  return `<div class="review-card ${change.status === 'rejected' ? 'rejected' : ''}" data-review-card="${escapeHtml(change.id)}"><input aria-label="Include ${escapeHtml(change.property)} change" type="checkbox" data-review-change="${escapeHtml(change.id)}" ${checked ? 'checked' : ''} ${selectable ? '' : 'disabled'}/><div class="review-card-main"><div class="review-card-line"><strong title="${escapeHtml(change.property)}">${escapeHtml(humanizeProperty(change.property))}</strong><span class="confidence-pill ${unresolved ? 'unresolved' : ''}">${escapeHtml(change.status === 'rejected' ? 'removed' : change.confidence)}</span><span class="review-values"><span class="review-before" title="Before: ${escapeHtml(reviewValue(change.before, change.unit))}">${escapeHtml(reviewValue(change.before, change.unit))}</span><span aria-hidden="true">→</span><input aria-label="New ${escapeHtml(change.property)} value" class="review-after" data-review-after="${escapeHtml(change.id)}" data-value-kind="${inputType}" type="${inputType}" value="${escapeHtml(afterValue)}" ${selectable ? '' : 'disabled'}/></span><details class="review-more"><summary aria-label="More actions for ${escapeHtml(humanizeProperty(change.property))}">•••</summary><div class="review-card-tools"><button data-review-locate="${escapeHtml(change.id)}">Locate</button><button data-review-preview="${escapeHtml(change.id)}" title="Hold to preview before">Preview before</button><button data-review-delete="${escapeHtml(change.id)}" ${deletable ? '' : 'disabled'}><i data-foundry-icon="bin"></i>Delete and restore</button><details class="review-details"><summary>Source and scope</summary><span class="review-source">${escapeHtml(change.property)} · ${escapeHtml(reviewSource(change))} · ${escapeHtml(change.scope)} · ${escapeHtml(contextSetLabel)}${change.token ? ` · ${escapeHtml(change.token)}` : ''}</span><span class="impact-list">${impact.map((message) => `<span class="impact-item ${unresolved || (!change.token && message.includes('literal')) ? 'warning' : ''}">${escapeHtml(message)}</span>`).join('')}</span></details></div></details></div><span class="review-context">${escapeHtml(contextSetLabel)}</span>${mappingChooser}</div></div>`;
                })
                .join('')}</section>`;
            })
            .join('')}`
        : '<div class="review-empty">No unresolved design edits are waiting for review.</div>';
    applyButton.dataset.action = 'apply';
    reviewCancel.dataset.action = 'back';
    reviewCancel.textContent = 'Back';
    renderIcons(reviewBody);
    reviewBody
      .querySelector<HTMLButtonElement>('[data-copy-agent-listener]')
      ?.addEventListener('click', () => {
        void navigator.clipboard.writeText(
          'Start Foundry for this project and keep listening for Apply with agent requests.',
        );
        showToast('Agent instruction copied');
      });
    reviewBody.querySelectorAll<HTMLInputElement>('[data-review-change]').forEach((field) =>
      field.addEventListener('change', () => {
        reviewDraft.selections[field.dataset.reviewChange!] = field.checked;
        persistReviewDraft();
        updateReviewSelection();
      }),
    );
    reviewBody.querySelectorAll<HTMLInputElement>('[data-review-after]').forEach((field) =>
      field.addEventListener('input', () => {
        reviewDraft.afterValues[field.dataset.reviewAfter!] = field.value;
        persistReviewDraft();
      }),
    );
    reviewBody.querySelectorAll<HTMLButtonElement>('.review-group-title').forEach((button) =>
      button.addEventListener('click', () => {
        const group = button.closest<HTMLElement>('.review-group');
        if (!group) return;
        group.classList.toggle('collapsed');
        const targetId = group.dataset.reviewTarget!;
        if (group.classList.contains('collapsed')) collapsedReviewGroups.add(targetId);
        else collapsedReviewGroups.delete(targetId);
        button.setAttribute('aria-expanded', String(!group.classList.contains('collapsed')));
      }),
    );
    reviewBody
      .querySelector<HTMLButtonElement>('[data-review-approve-exact]')
      ?.addEventListener('click', () => {
        reviewBody
          .querySelectorAll<HTMLInputElement>('[data-review-change]:not(:disabled)')
          .forEach((field) => {
            field.checked = true;
            reviewDraft.selections[field.dataset.reviewChange!] = true;
          });
        persistReviewDraft();
        updateReviewSelection();
      });
    reviewBody
      .querySelector<HTMLButtonElement>('[data-review-toggle-rejected]')
      ?.addEventListener('click', () => {
        reviewShowRejected = !reviewShowRejected;
        if (activeReviewPayload) renderReviewPayload(activeReviewPayload);
      });
    reviewBody
      .querySelector<HTMLButtonElement>('[data-review-compare]')
      ?.addEventListener('click', () => {
        suspendReview();
        showComparison('after');
      });
    reviewBody.querySelectorAll<HTMLButtonElement>('[data-review-delete]').forEach((button) =>
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          renderReviewPayload(await deleteReviewChange(button.dataset.reviewDelete!));
          showToast('Change deleted and original value restored');
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Could not delete change');
          button.disabled = false;
        }
      }),
    );
    reviewBody.querySelectorAll<HTMLButtonElement>('[data-review-preview]').forEach((button) => {
      const change = changes.find((item) => item.id === button.dataset.reviewPreview);
      if (!change) return;
      const element = resolveFoundrySelector(document, change.target.locator.selector);
      if (!element) return;
      const before = (): void =>
        rawElementValue(element, change.property, change.before, change.unit);
      const after = (): void =>
        rawElementValue(element, change.property, change.after, change.unit);
      button.title = 'Show the before value on the canvas';
      button.addEventListener('click', () => {
        before();
        suspendedPreviewRestore = after;
        select(element);
        suspendReview();
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
        showToast('Before value shown · Return to continue reviewing');
      });
    });
    reviewBody.querySelectorAll<HTMLButtonElement>('[data-review-locate]').forEach((button) => {
      const change = changes.find((item) => item.id === button.dataset.reviewLocate);
      if (!change) return;
      const element = resolveFoundrySelector(document, change.target.locator.selector);
      if (!element) {
        button.disabled = true;
        button.title = 'Target is not currently rendered';
        return;
      }
      button.addEventListener('mouseenter', () => previewLayer(element));
      button.addEventListener('mouseleave', () => previewLayer(null));
      button.addEventListener('click', () => {
        select(element);
        suspendReview();
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
        showToast('Located on the live canvas · Return to continue reviewing');
      });
    });
    reviewBody.querySelectorAll<HTMLInputElement>('[data-mapping-choice]').forEach((field) =>
      field.addEventListener('change', async () => {
        field.disabled = true;
        try {
          renderReviewPayload(
            await sessionRequest(`/operations/${encodeURIComponent(field.dataset.operationId!)}`, {
              method: 'PATCH',
              body: JSON.stringify({
                selectedMappingId: field.dataset.mappingChoice,
              }),
            }),
          );
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Could not resolve source mapping');
          field.disabled = false;
        }
      }),
    );
    updateReviewSelection();
  }

  const runStateLabels: Record<string, string> = {
    queued: 'Queued for agent',
    claimed: 'Handoff received',
    applying: 'Applying source changes',
    rebuilding: 'Rebuilding and checking',
    verifying: 'Verifying rendered values',
    passed: 'Applied and verified',
    needs_attention: 'Needs attention',
    failed: 'Apply failed',
    cancelled: 'Apply cancelled',
  };

  function ownsApplyVerification(): boolean {
    return (
      readinessFrameKind === 'canvas' &&
      !verificationChild &&
      !query.has('__foundry_design_branch') &&
      (!embeddedWorkspace || query.get('__foundry_frame') === 'canvas')
    );
  }

  function maybeVerifyRun(run: any): void {
    // Auxiliary previews share this session (and sessionStorage) with Canvas,
    // but can be hidden or unmounted when another workspace is active. Only
    // Canvas coordinates Apply verification; isolated children measure the
    // frozen context when explicitly requested by that coordinator.
    if (!ownsApplyVerification() || run.state !== 'verifying' || verifyingRuns.has(run.id)) return;
    if (!run.claimAttemptId) {
      showToast('The active Apply claim is missing. Reclaim the run before verifying.');
      return;
    }
    if (!run.applyResultAcknowledgedAt || run.applyResultClaimAttemptId !== run.claimAttemptId) {
      return;
    }
    const reloadKey = '__foundry_verifying_run';
    if (sessionStorage.getItem(reloadKey) !== run.id) {
      sessionStorage.setItem(reloadKey, run.id);
      location.reload();
      return;
    }
    verifyingRuns.add(run.id);
    void verify(run.changeIds, run.id, run.claimAttemptId)
      .then(() => sessionStorage.removeItem(reloadKey))
      .catch((error) => {
        showToast(error instanceof Error ? error.message : 'Rendered verification was interrupted');
      })
      .finally(() => verifyingRuns.delete(run.id));
  }

  function captureVerifiedRun(run: any): void {
    if (run.state !== 'passed' || capturedBaselineRuns.has(run.id)) return;
    const changes = (run.reviewedChangeSet?.changes ?? []).filter((change: any) =>
      run.changeIds.includes(change.id),
    );
    const groups = new Map<string, any[]>();
    for (const change of changes) {
      groups.set(change.target.id, [...(groups.get(change.target.id) ?? []), change]);
    }
    for (const [targetId, targetChanges] of groups) {
      const first = targetChanges[0];
      const values = run.verificationResults
        .filter((result: any) => targetChanges.some((change: any) => change.id === result.changeId))
        .map((result: any) => ({
          property: result.property,
          requested: result.requested,
          rendered: result.rendered,
          passed: result.passed,
        }));
      if (!values.length || !values.every((value: any) => value.passed)) continue;
      designMemory = addVerifiedBaseline(designMemory, {
        id: `baseline_${run.id}_${targetId}`,
        runId: run.id,
        targetId,
        targetLabel: first.target.label,
        breakpoint: first.context.breakpoint,
        theme: first.context.theme,
        state: first.context.state,
        revision: run.revision,
        values,
        verifiedAt: run.completedAt ?? run.updatedAt,
      });
    }
    capturedBaselineRuns.add(run.id);
    persistDesignMemory();
    if (!libraryPanel.hidden) renderDesignMemory();
  }

  function renderApplyRun(run: any): void {
    const attention = ['needs_attention', 'failed'].includes(run.state);
    const passed = run.state === 'passed';
    const active = isActiveApplyRun(run);
    const latestMessage = applyRunMessage(run, activeAgentPresence.connected);
    latestApplyState = run.state;
    if (run.state === 'passed') completeOnboardingStep('apply');
    captureVerifiedRun(run);
    reviewCount.textContent = `Attempt ${run.attempts}`;
    reviewBody.innerHTML = `<div class="run-summary"><div class="run-state"><i class="${passed ? 'passed' : attention ? 'attention' : active ? 'active' : ''}"></i><strong>${escapeHtml(runStateLabels[run.state] ?? run.state)}</strong></div><p>${escapeHtml(latestMessage)}</p></div><div class="run-steps">${run.messages
      .map(
        (message: any, index: number) =>
          `<div class="run-step"><span>${String(index + 1).padStart(2, '0')}</span><div><strong>${escapeHtml(runStateLabels[message.state] ?? message.state)}</strong><p>${escapeHtml(message.message)}</p></div></div>`,
      )
      .join(
        '',
      )}</div>${run.changedFiles.length ? `<div class="run-files"><strong>Changed files</strong>${run.changedFiles.map((file: string) => `<code>${escapeHtml(file)}</code>`).join('')}</div>` : ''}${run.validationResults.length ? `<div class="result-list">${run.validationResults.map((result: any) => `<div class="result-row ${result.passed ? 'pass' : 'fail'}"><span>${result.passed ? 'Passed' : 'Failed'} · ${escapeHtml(result.name)}</span><span>${escapeHtml(result.summary ?? '')}</span></div>`).join('')}</div>` : ''}${run.verificationResults.length ? `<div class="result-list">${run.verificationResults.map((result: any) => `<div class="result-row ${result.passed ? 'pass' : 'fail'}"><span>${result.passed ? 'Matched' : 'Mismatch'} · ${escapeHtml(result.property)}</span><span>${escapeHtml(verificationResultValue(result))}<small class="verification-context">${escapeHtml(verificationContextLabel(result))}</small>${result.reason ? `<br/>${escapeHtml(result.reason)}` : ''}</span></div>`).join('')}</div>` : ''}`;
    const primaryAction = applyRunAction(run, activeAgentPresence.connected, runStateLabels);
    applyButton.dataset.action = primaryAction.action;
    applyButton.textContent = primaryAction.label;
    applyButton.disabled = primaryAction.disabled;
    const confirmingCancel =
      active && cancelConfirmationRunId === run.id && Date.now() < cancelConfirmationUntil;
    reviewCancel.dataset.action = active ? 'cancel' : 'back';
    reviewCancel.textContent = active ? (confirmingCancel ? 'Confirm stop' : 'Stop apply') : 'Back';
    maybeVerifyRun(run);
  }

  function renderReviewPayload(payload: any): void {
    const preservedScrollTop = reviewBody.scrollTop || reviewScrollTop;
    activeReviewPayload = payload;
    const activeChanges = payload.changeSet.changes.filter(
      (change: any) =>
        change.status !== 'rejected' && String(change.before) !== String(change.after),
    );
    updateChangeCount(activeChanges.length, activeChanges.at(-1));
    const latestRun = payload.applyRuns?.at(-1);
    const activeOrAttention =
      latestRun &&
      [
        'queued',
        'claimed',
        'applying',
        'rebuilding',
        'verifying',
        'needs_attention',
        'failed',
      ].includes(latestRun.state);
    if (activeOrAttention) {
      const latestMessage = latestRun.messages?.at(-1)?.message;
      changeDock.querySelector<HTMLElement>('[data-dock-last]')!.textContent =
        latestMessage ?? runStateLabels[latestRun.state] ?? latestRun.state;
    }
    const pending = payload.changeSet.changes.filter(
      (change: any) =>
        String(change.before) !== String(change.after) &&
        (['draft', 'approved', 'unresolved'].includes(change.status) ||
          (reviewShowRejected && change.status === 'rejected')),
    );
    if (activeOrAttention || (!pending.length && latestRun)) renderApplyRun(latestRun);
    else renderReviewList(pending);
    requestAnimationFrame(() => {
      if (workspaceState.reviewOpen) reviewBody.scrollTop = preservedScrollTop;
    });
  }

  async function refreshReview(): Promise<void> {
    if (!workspaceState.reviewOpen || !sessionId || !token) return;
    try {
      const [payload, presence] = await Promise.all([
        sessionRequest(),
        sessionRequest('/agent-presence'),
      ]);
      activeAgentPresence = presence;
      if (presence.connected) completeOnboardingStep('agent');
      const latestRun = payload.applyRuns?.at(-1);
      const runNeedsRefresh =
        latestRun &&
        [
          'queued',
          'claimed',
          'applying',
          'rebuilding',
          'verifying',
          'needs_attention',
          'failed',
        ].includes(latestRun.state);
      if (applyButton.dataset.action === 'apply' && !runNeedsRefresh) {
        activeReviewPayload = payload;
        updateAgentConnection();
        return;
      }
      renderReviewPayload(payload);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not refresh apply run');
    }
  }

  async function openReview(): Promise<void> {
    if (!sessionId || !token) {
      showToast('Session connection is missing');
      return;
    }
    if (!reviewSuspended && shadow.activeElement instanceof HTMLElement)
      lastReviewTrigger = shadow.activeElement;
    suspendedPreviewRestore?.();
    suspendedPreviewRestore = undefined;
    reviewSuspended = false;
    dockReviewButton.textContent = 'Review';
    workspaceState = updateWorkspace(workspaceState, {
      type: 'set-review',
      open: true,
    });
    reviewTakeover.hidden = false;
    outline.hidden = true;
    const [payload, presence] = await Promise.all([
      sessionRequest(),
      sessionRequest('/agent-presence'),
    ]);
    activeAgentPresence = presence;
    if (presence.connected) completeOnboardingStep('agent');
    renderReviewPayload(payload);
    requestAnimationFrame(() => {
      reviewBody.scrollTop = reviewScrollTop;
      shadow.querySelector<HTMLButtonElement>('.review-back')?.focus();
    });
    clearInterval(reviewPoll);
    clearInterval(sessionPoll);
    sessionPoll = undefined;
    reviewPoll = setInterval(() => void refreshReview(), 1000);
  }

  function closeReview(restoreFocus = true): void {
    reviewScrollTop = reviewBody.scrollTop;
    workspaceState = updateWorkspace(workspaceState, {
      type: 'set-review',
      open: false,
    });
    reviewTakeover.hidden = true;
    clearInterval(reviewPoll);
    reviewPoll = undefined;
    startSessionPolling();
    updateOutline();
    if (restoreFocus) lastReviewTrigger?.focus();
  }

  function suspendReview(): void {
    reviewSuspended = true;
    dockReviewButton.textContent = 'Return';
    closeReview(false);
    dockReviewButton.focus();
  }

  async function submitReviewedRun(): Promise<void> {
    if (!activeReviewPayload) return;
    const reviews = [...reviewBody.querySelectorAll<HTMLInputElement>('[data-review-change]')].map(
      (checkbox) => {
        const changeId = checkbox.dataset.reviewChange!;
        const afterField = reviewBody.querySelector<HTMLInputElement>(
          `[data-review-after="${CSS.escape(changeId)}"]`,
        )!;
        return {
          changeId,
          approved: checkbox.checked && !checkbox.disabled,
          after:
            afterField.dataset.valueKind === 'number' ? Number(afterField.value) : afterField.value,
        };
      },
    );
    applyButton.disabled = true;
    try {
      activeAgentPresence = await sessionRequest('/agent-presence');
      const payload = await sessionRequest('/apply-runs', {
        method: 'POST',
        body: JSON.stringify({
          reviews,
          revision: activeReviewPayload.changeSet.context.revision,
        }),
      });
      clearReviewDraft();
      renderReviewPayload(payload);
      if (!activeAgentPresence.connected)
        showToast('Queued. Your coding agent will claim this batch when it reconnects.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not start apply run');
      updateReviewSelection();
    }
  }

  async function retryRun(): Promise<void> {
    const run = activeReviewPayload?.applyRuns?.at(-1);
    if (!run) return;
    try {
      renderReviewPayload(
        await sessionRequest(`/apply-runs/${encodeURIComponent(run.id)}/retry`, {
          method: 'POST',
          body: '{}',
        }),
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not retry apply run');
    }
  }

  async function resumeRun(): Promise<void> {
    const run = activeReviewPayload?.applyRuns?.at(-1);
    if (!run) return;
    try {
      renderReviewPayload(
        await sessionRequest(`/apply-runs/${encodeURIComponent(run.id)}/resume`, {
          method: 'POST',
          body: JSON.stringify({
            expectedRevision: activeReviewPayload?.changeSet?.context?.revision ?? null,
            expectedDesignGraphRevision:
              activeReviewPayload?.changeSet?.designGraphRevision ?? null,
          }),
        }),
      );
      showToast('Resume authorized. Waiting for an agent to reinspect this run.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not resume apply run');
    }
  }

  async function cancelRun(): Promise<void> {
    const run = activeReviewPayload?.applyRuns?.at(-1);
    if (!run) return;
    const now = Date.now();
    if (cancelConfirmationRunId !== run.id || now >= cancelConfirmationUntil) {
      cancelConfirmationRunId = run.id;
      cancelConfirmationUntil = now + 5_000;
      reviewCancel.textContent = 'Confirm stop';
      showToast('Press Confirm stop within 5 seconds to cancel this source run.');
      window.setTimeout(() => {
        if (cancelConfirmationRunId !== run.id || Date.now() < cancelConfirmationUntil) return;
        cancelConfirmationRunId = undefined;
        cancelConfirmationUntil = 0;
        if (activeReviewPayload) renderReviewPayload(activeReviewPayload);
      }, 5_100);
      return;
    }
    cancelConfirmationRunId = undefined;
    cancelConfirmationUntil = 0;
    try {
      renderReviewPayload(
        await sessionRequest(`/apply-runs/${encodeURIComponent(run.id)}/cancel`, {
          method: 'POST',
          body: '{}',
        }),
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not cancel apply run');
    }
  }

  function updateOutline(): void {
    if (focusSpotlight && selected) {
      const rect = selected.getBoundingClientRect();
      Object.assign(focusSpotlight.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    }
    shadow.querySelectorAll('.multi-outline').forEach((item) => item.remove());
    shadow.querySelectorAll('.spacing-guide').forEach((item) => item.remove());
    if (!selected || !selected.isConnected) {
      outline.hidden = true;
      canvasVariant.hidden = true;
      return;
    }
    const rect = selected.getBoundingClientRect();
    Object.assign(outline.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    outline.querySelector<HTMLElement>('.measure')!.textContent =
      `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    selectionSize.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)} px`;
    outline.hidden = rect.width <= 0 || rect.height <= 0;
    updateCanvasVariant(rect);
    for (const element of selectedElements.filter(
      (item) => item !== selected && item.isConnected,
    )) {
      const itemRect = element.getBoundingClientRect();
      const itemOutline = document.createElement('div');
      itemOutline.className = 'multi-outline';
      Object.assign(itemOutline.style, {
        left: `${itemRect.left}px`,
        top: `${itemRect.top}px`,
        width: `${itemRect.width}px`,
        height: `${itemRect.height}px`,
      });
      shadow.append(itemOutline);
    }
    const connectedSelection = selectedElements.filter((item) => item.isConnected);
    const firstConnected = connectedSelection[0];
    const sameParent =
      Boolean(firstConnected) &&
      connectedSelection.length > 1 &&
      connectedSelection.every((item) => item.parentElement === firstConnected?.parentElement);
    if (sameParent) {
      for (const segment of spacingSegments(
        connectedSelection.map((item) => item.getBoundingClientRect()),
      )) {
        const guide = document.createElement('div');
        guide.className = `spacing-guide ${segment.axis}`;
        if (segment.axis === 'horizontal') {
          Object.assign(guide.style, {
            left: `${segment.from}px`,
            top: `${segment.cross}px`,
            width: `${segment.gap}px`,
          });
        } else {
          Object.assign(guide.style, {
            left: `${segment.cross}px`,
            top: `${segment.from}px`,
            height: `${segment.gap}px`,
          });
        }
        guide.innerHTML = `<span>${Math.round(segment.gap)}</span>`;
        guide.addEventListener('pointerdown', (event) => {
          if (!firstConnected?.parentElement || event.button !== 0) return;
          const parent = firstConnected.parentElement;
          const property = segment.axis === 'horizontal' ? 'columnGap' : 'rowGap';
          const control = simpleStyleControl(parent, property, 'Sibling gap', 'layout', 'px');
          const before = Number(control.read()) || segment.gap;
          const start = segment.axis === 'horizontal' ? event.clientX : event.clientY;
          let after = before;
          event.preventDefault();
          event.stopPropagation();
          const move = (pointer: PointerEvent): void => {
            const current = segment.axis === 'horizontal' ? pointer.clientX : pointer.clientY;
            after = Math.max(0, Math.round(before + current - start));
            control.apply(after);
            guide.querySelector('span')!.textContent = String(after);
          };
          const finish = (): void => {
            document.removeEventListener('pointermove', move, true);
            document.removeEventListener('pointerup', finish, true);
            if (after !== before) {
              pushHistory({
                element: parent,
                property,
                before,
                after,
                unit: 'px',
                category: 'layout',
                label: 'Sibling gap',
              });
              void record(control, before, after, parent, 'Adjust sibling gap');
            }
            updateOutline();
          };
          document.addEventListener('pointermove', move, true);
          document.addEventListener('pointerup', finish, true);
        });
        shadow.append(guide);
      }
    }
    updateCanvasActions();
  }

  function updateCanvasActions(): void {
    const multiple = selectedElements.length > 1;
    const parent = selectedElements[0]?.parentElement;
    const sameParent = multiple && selectedElements.every((item) => item.parentElement === parent);
    const parentDisplay = parent ? getComputedStyle(parent).display : '';
    shadow.querySelector<HTMLButtonElement>('.align')!.disabled =
      !sameParent || !['flex', 'inline-flex', 'grid', 'inline-grid'].includes(parentDisplay);
    const visibleChildren = parent
      ? [...parent.children].filter(
          (item): item is HTMLElement =>
            item instanceof HTMLElement && getComputedStyle(item).display !== 'none',
        )
      : [];
    shadow.querySelector<HTMLButtonElement>('.distribute')!.disabled =
      !sameParent ||
      !parentDisplay.includes('flex') ||
      visibleChildren.length !== selectedElements.length ||
      !visibleChildren.every((item) => selectedElements.includes(item));
  }

  function targetFor(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const parsedSource = parseSource(element.dataset.foundrySource);
    const source = parsedSource
      ? {
          ...parsedSource,
          ...(element.dataset.foundrySourceAnchor
            ? { symbol: element.dataset.foundrySourceAnchor }
            : {}),
        }
      : undefined;
    const label =
      element.dataset.foundryLabel ||
      element.getAttribute('aria-label') ||
      element.textContent?.trim().slice(0, 60) ||
      element.tagName.toLowerCase();
    return {
      id: foundryTargetId(element),
      platform: 'web',
      semanticRole: element.getAttribute('role') || element.tagName.toLowerCase(),
      label,
      componentPath: element.dataset.foundryComponent?.split('/').filter(Boolean) ?? [],
      source,
      geometry: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        scale: window.devicePixelRatio || 1,
      },
      locator: {
        selector: foundrySelector(element),
        foundryId: element.dataset.foundryId,
        text: element.textContent?.trim().slice(0, 80),
      },
      confidence: source || element.dataset.foundryId ? 'instrumented' : 'measured',
      evidence: [
        'getBoundingClientRect',
        'computed styles',
        ...(source ? ['data-foundry-source'] : []),
      ],
    };
  }

  async function record(
    control: Control,
    before: string | number,
    after: string | number,
    element = selected,
    operationLabel?: string,
    extraEvidence: string[] = [],
    options: {
      source?: ComponentWorkshopSource;
      scope?: ComponentWorkshopScope;
      requireRecordedChange?: boolean;
      onRecorded?: (destination: { branchId?: string; branchName?: string }) => void;
    } = {},
  ): Promise<boolean> {
    if (!element || !sessionId || !token) {
      showToast('Session connection is missing');
      return false;
    }
    const category =
      control.category === 'effects'
        ? 'effect'
        : control.category === 'typography'
          ? 'typography'
          : control.category === 'content' && control.property === 'src'
            ? 'asset'
            : control.category;
    const target = targetFor(element);
    const operationId = `op_${crypto.randomUUID().replaceAll('-', '')}`;
    const recordScope = options.scope ?? (scope.value as ComponentWorkshopScope);
    const candidates = candidatesForElement(
      element,
      control.property,
      after,
      target.id,
      recordScope,
      options.source ?? target.source,
    );
    const ambiguous = candidates.length > 1;
    const selectedMappingId = ambiguous ? undefined : candidates[0]?.id;
    const matching = matchingTokens(
      designGraph?.tokens ?? [],
      control.property,
      `${after}${control.unit ?? ''}`,
    );
    const activeBreakpoint =
      responsiveEditScope.activeBreakpoint !== 'current'
        ? responsiveEditScope.activeBreakpoint
        : currentPreviewContext.viewport.id !== 'current'
          ? currentPreviewContext.viewport.id
          : breakpoint.value;
    const contextBreakpoints =
      responsiveEditScope.scope === 'all-breakpoints'
        ? (designGraph?.breakpoints ?? []).map((item) => item.id)
        : [activeBreakpoint];
    if (responsiveEditScope.scope === 'all-breakpoints' && !target.source) {
      showToast('All breakpoints requires a source-mapped target');
      return false;
    }
    if (responsiveEditScope.scope === 'all-breakpoints' && contextBreakpoints.length === 0) {
      showToast('No indexed breakpoints are available for this edit');
      return false;
    }
    const contextThemes = [theme.value];
    const contextStates = [state.value];
    const stateIds =
      activeBreakpoint === 'current' && theme.value === 'current' && state.value === 'current'
        ? []
        : contextBreakpoints.map((breakpointId) => `${breakpointId}:${theme.value}:${state.value}`);
    const payload = {
      target,
      category,
      property: control.property,
      before,
      after,
      unit: control.unit,
      token: matching[0]?.name,
      operationId,
      stateIds,
      mappingCandidates: candidates,
      selectedMappingId,
      scope: recordScope,
      context: {
        breakpoint: activeBreakpoint,
        theme: theme.value,
        state: state.value,
      },
      contextSet: {
        breakpoints: contextBreakpoints,
        themes: contextThemes,
        states: contextStates,
      },
      confidence: ambiguous ? 'unresolved' : (candidates[0]?.confidence ?? 'measured'),
      evidence: [
        'live preview override',
        'computed style',
        ...extraEvidence,
        ...candidates.flatMap((candidate) => candidate.evidence),
      ],
      status: ambiguous ? 'unresolved' : 'draft',
    };
    let recorded = false;
    try {
      const responsePayload = await sessionRequest('/change-records', {
        method: 'POST',
        body: JSON.stringify({
          change: payload,
          operation: {
            id: operationId,
            kind:
              candidates[0]?.intent === 'position' ? 'style' : (candidates[0]?.intent ?? 'style'),
            label: operationLabel ?? `${control.label}: ${before} → ${after}`,
            targetIds: [target.id],
            stateIds,
            mappingCandidates: candidates,
            selectedMappingId,
            status: ambiguous ? 'unresolved' : 'resolved',
          },
        }),
      });
      const activeBranch = responsePayload.activeDesignBranchId
        ? responsePayload.designBranches?.find(
            (branch: any) => branch.id === responsePayload.activeDesignBranchId,
          )
        : undefined;
      if (responsePayload.activeDesignBranchId && !Array.isArray(activeBranch?.changes)) {
        throw new Error('The active direction could not be confirmed in the runtime response');
      }
      const activeChanges = (activeBranch?.changes ?? responsePayload.changeSet.changes).filter(
        (change: any) =>
          change.status !== 'rejected' && String(change.before) !== String(change.after),
      );
      if (
        options.requireRecordedChange &&
        !activeChanges.some(
          (change: any) =>
            change.operationId === operationId &&
            change.target.id === target.id &&
            change.property === control.property &&
            JSON.stringify(change.after) === JSON.stringify(after),
        )
      ) {
        throw new Error(
          activeBranch
            ? 'The runtime did not retain the requested correction in the active direction'
            : 'The runtime did not retain the requested correction in Review',
        );
      }
      recordedChangeCount = activeChanges.length;
      completeOnboardingStep('change');
      lastRecordedSummary = `${target.label} · ${control.label} ${before}${control.unit ?? ''} → ${after}${control.unit ?? ''}`;
      updateChangeCount(activeChanges.length, activeChanges.at(-1));
      options.onRecorded?.({ branchId: activeBranch?.id, branchName: activeBranch?.name });
      showToast(
        activeBranch
          ? `Change saved to direction “${activeBranch.name}”. ${ambiguous ? 'Resolve its source intent before promotion.' : 'Promote the direction to add it to Review.'}`
          : ambiguous
            ? 'Choose the source intent in review'
            : 'Change recorded',
      );
      recorded = true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not record change');
    }
    publishWorkspaceState();
    return recorded;
  }

  function renderToolTabs(): void {
    const multi = selectedElements.length > 1;
    shadow
      .querySelectorAll<HTMLElement>('.align,.distribute,.multi-actions-divider')
      .forEach((element) => {
        element.hidden = !multi;
      });
  }

  function installNumberScrubbing(): void {
    controlsRoot.querySelectorAll<HTMLElement>('[data-scrub-for]').forEach((handle) => {
      const input = controlsRoot.querySelector<HTMLInputElement>(
        `input[data-control="${handle.dataset.scrubFor}"][type="number"]`,
      );
      if (!input) return;
      handle.addEventListener('pointerdown', (pointerDown) => {
        if (pointerDown.button !== 0) return;
        const startX = pointerDown.clientX;
        const startValue = Number(input.value) || 0;
        const step = Number(input.step) || 1;
        const min = input.min === '' ? Number.NEGATIVE_INFINITY : Number(input.min);
        const max = input.max === '' ? Number.POSITIVE_INFINITY : Number(input.max);
        handle.setPointerCapture(pointerDown.pointerId);
        handle.classList.add('scrubbing');
        pointerDown.preventDefault();

        const move = (pointerMove: PointerEvent): void => {
          const multiplier = pointerMove.shiftKey ? 10 : pointerMove.altKey ? 0.1 : 1;
          const effectiveStep = step * multiplier;
          const precision = Math.min(
            4,
            Math.max(0, Math.ceil(-Math.log10(Math.abs(effectiveStep)))),
          );
          const scale = 10 ** precision;
          const delta = Math.round(pointerMove.clientX - startX) * effectiveStep;
          const next = Math.min(
            max,
            Math.max(min, Math.round((startValue + delta) * scale) / scale),
          );
          const value = String(next);
          if (input.value === value) return;
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        };

        const finish = (pointerEnd: PointerEvent): void => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', finish);
          handle.removeEventListener('pointercancel', finish);
          if (handle.hasPointerCapture(pointerEnd.pointerId)) {
            handle.releasePointerCapture(pointerEnd.pointerId);
          }
          handle.classList.remove('scrubbing');
        };

        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', finish);
        handle.addEventListener('pointercancel', finish);
      });
    });
  }

  function installResizeHandles(): void {
    shadow.querySelectorAll<HTMLButtonElement>('[data-handle]').forEach((handle) => {
      handle.addEventListener('pointerdown', (pointerDown) => {
        if (!selected || pointerDown.button !== 0) return;
        const element = selected;
        const direction = handle.dataset.handle ?? 'se';
        const rect = element.getBoundingClientRect();
        const startX = pointerDown.clientX;
        const startY = pointerDown.clientY;
        const startWidth = rect.width;
        const startHeight = rect.height;
        const siblingRects = element.parentElement
          ? [...element.parentElement.children]
              .filter(
                (item): item is HTMLElement =>
                  item instanceof HTMLElement && item !== element && isVisibleLayer(item),
              )
              .map((item) => item.getBoundingClientRect())
          : [];
        const widthGuides = siblingRects.map((item) => item.width);
        const heightGuides = siblingRects.map((item) => item.height);
        let finalWidth = startWidth;
        let finalHeight = startHeight;
        handle.setPointerCapture(pointerDown.pointerId);
        pointerDown.preventDefault();
        pointerDown.stopPropagation();

        const gridSnap = (value: number, fine: boolean): number =>
          Math.max(1, fine ? Math.round(value) : Math.round(value / 4) * 4);
        const move = (pointerMove: PointerEvent): void => {
          clearSnapGuides();
          const horizontal = direction.includes('e')
            ? pointerMove.clientX - startX
            : direction.includes('w')
              ? startX - pointerMove.clientX
              : 0;
          const vertical = direction.includes('s')
            ? pointerMove.clientY - startY
            : direction.includes('n')
              ? startY - pointerMove.clientY
              : 0;
          const centerMultiplier = pointerMove.altKey ? 2 : 1;
          const fine = pointerMove.metaKey || pointerMove.ctrlKey;
          const proposedWidth =
            direction === 'n' || direction === 's'
              ? startWidth
              : gridSnap(startWidth + horizontal * centerMultiplier, fine);
          const proposedHeight =
            direction === 'e' || direction === 'w'
              ? startHeight
              : gridSnap(startHeight + vertical * centerMultiplier, fine);
          const widthSnap = fine ? { value: proposedWidth } : snapValue(proposedWidth, widthGuides);
          const heightSnap = fine
            ? { value: proposedHeight }
            : snapValue(proposedHeight, heightGuides);
          finalWidth = widthSnap.value;
          finalHeight = heightSnap.value;
          if (widthSnap.guide != null) showSnapGuide('vertical', rect.left + finalWidth);
          if (heightSnap.guide != null) showSnapGuide('horizontal', rect.top + finalHeight);
          if (pointerMove.shiftKey && direction.length === 2) {
            const ratio = startWidth / Math.max(1, startHeight);
            if (Math.abs(horizontal) >= Math.abs(vertical)) finalHeight = finalWidth / ratio;
            else finalWidth = finalHeight * ratio;
          }
          if (finalWidth !== startWidth) element.style.width = `${Math.round(finalWidth)}px`;
          if (finalHeight !== startHeight) element.style.height = `${Math.round(finalHeight)}px`;
          updateOutline();
        };
        const finish = (): void => {
          clearSnapGuides();
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', finish);
          handle.removeEventListener('pointercancel', finish);
          if (finalWidth !== startWidth) {
            const control = controlsFor(element).find((item) => item.property === 'width')!;
            pushHistory({
              element,
              property: 'width',
              before: startWidth,
              after: Math.round(finalWidth),
              unit: 'px',
              category: 'layout',
              label: 'Width',
            });
            void record(
              control,
              startWidth,
              Math.round(finalWidth),
              element,
              `Resize width: ${Math.round(startWidth)} → ${Math.round(finalWidth)}`,
            );
          }
          if (finalHeight !== startHeight) {
            const control = controlsFor(element).find((item) => item.property === 'height')!;
            pushHistory({
              element,
              property: 'height',
              before: startHeight,
              after: Math.round(finalHeight),
              unit: 'px',
              category: 'layout',
              label: 'Height',
            });
            void record(
              control,
              startHeight,
              Math.round(finalHeight),
              element,
              `Resize height: ${Math.round(startHeight)} → ${Math.round(finalHeight)}`,
            );
          }
          if (element === selected) {
            selectedControls = controlsFor(element);
            renderControls();
          }
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', finish);
        handle.addEventListener('pointercancel', finish);
      });
    });
  }

  function tokensForCategory(category: Category): BrowserDesignToken[] {
    const expected =
      category === 'color'
        ? 'color'
        : category === 'typography'
          ? 'typography'
          : category === 'effects'
            ? 'radius'
            : category === 'layout'
              ? 'spacing'
              : undefined;
    return (designGraph?.tokens ?? []).filter((token) => !expected || token.category === expected);
  }

  function selectedComponent() {
    if (!selected?.dataset.foundryComponent) return undefined;
    const path = selected.dataset.foundryComponent;
    const name = path.split('/').at(-1);
    return designGraph?.components.find(
      (component) => component.id === path || component.name === path || component.name === name,
    );
  }

  function updateCanvasVariant(rect = selected?.getBoundingClientRect()): void {
    const component = selectedComponent();
    if (!rect || !component?.variants.length) {
      canvasVariant.hidden = true;
      syncFdcSelect(canvasVariant);
      return;
    }
    const signature = component.variants.map((variant) => variant.id).join('|');
    if (canvasVariant.dataset.signature !== signature) {
      canvasVariant.dataset.signature = signature;
      canvasVariant.innerHTML = [
        '<option value="">Choose variant</option>',
        ...component.variants.map(
          (variant) =>
            `<option value="${escapeHtml(variant.id)}">${escapeHtml(variant.name)}</option>`,
        ),
      ].join('');
    }
    canvasVariant.style.left = `${Math.max(8, Math.min(window.innerWidth - 188, rect.left))}px`;
    canvasVariant.style.top = `${Math.max(8, rect.bottom + 8)}px`;
    canvasVariant.hidden = false;
    syncFdcSelect(canvasVariant);
  }

  function opaqueBackground(element: HTMLElement): string {
    let current: HTMLElement | null = element;
    while (current) {
      const color = getComputedStyle(current).backgroundColor;
      if (color && color !== 'transparent' && !color.endsWith(', 0)')) return color;
      current = current.parentElement;
    }
    return 'rgb(255, 255, 255)';
  }

  function renderContextPanel(category: Category): string {
    if (!selected) return '';
    const component = selectedComponent();
    const variants = component?.variants ?? [];
    const contrast =
      category === 'color'
        ? contrastRatio(getComputedStyle(selected).color, opaqueBackground(selected))
        : null;
    const health =
      category === 'color' && contrast != null
        ? `<div class="design-health ${contrast >= 4.5 ? 'pass' : 'fail'}"><i data-foundry-icon="contrast"></i><span>${contrast}:1 contrast · ${contrast >= 4.5 ? 'AA pass' : 'Needs attention'}</span></div>`
        : '';
    const variantPanel =
      category === 'content' && variants.length
        ? `<section class="native-panel"><div class="native-panel-head"><strong>${escapeHtml(component!.name)} variants</strong><span>${component!.instances} instances</span></div><div class="variant-list">${variants
            .map(
              (variant) =>
                `<button class="variant-button" data-variant="${escapeHtml(variant.id)}"><span>${escapeHtml(variant.name)}</span><code>${escapeHtml(
                  Object.entries(variant.props)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(' · '),
                )}</code></button>`,
            )
            .join('')}</div></section>`
        : '';
    return `${health}${variantPanel}`;
  }

  async function applyControlValue(
    control: Control,
    value: string | number,
    operationLabel: string,
    extraEvidence: string[] = [],
  ): Promise<{ applied: boolean; recorded: boolean }> {
    if (!selected) return { applied: false, recorded: false };
    const element = selected;
    if (responsiveEditScope.scope === 'all-breakpoints' && !targetFor(element).source) {
      showToast('All breakpoints requires a source-mapped target');
      return { applied: false, recorded: false };
    }
    const before = control.read();
    control.apply(value);
    const after = control.read();
    if (String(before) === String(after)) return { applied: false, recorded: false };
    pushHistory({
      element,
      property: control.property,
      before,
      after,
      unit: control.unit,
      category: control.category,
      label: control.label,
    });
    updateOutline();
    return {
      applied: true,
      recorded: await record(control, before, after, element, operationLabel, extraEvidence),
    };
  }

  function restoreTypographyPreview(): void {
    if (typographyPreview) {
      typographyPreview.element.style.fontFamily = typographyPreview.inlineFamily;
      typographyPreview.element.style.fontWeight = typographyPreview.inlineWeight;
      typographyPreview.element.style.fontStyle = typographyPreview.inlineStyle;
      typographyPreview.element.style.fontVariationSettings =
        typographyPreview.inlineVariationSettings;
      typographyPreview.link?.remove();
      typographyPreview = undefined;
    }
    restoreTypeTreatmentPreview();
    if (selected) selectedControls = controlsFor(selected);
    updateOutline();
  }

  function restoreTypeTreatmentPreview(): void {
    if (!typographyTreatmentPreview) return;
    const preview = typographyTreatmentPreview;
    preview.element.style.fontSize = preview.inlineFontSize;
    preview.element.style.lineHeight = preview.inlineLineHeight;
    preview.element.style.letterSpacing = preview.inlineLetterSpacing;
    typographyTreatmentPreview = undefined;
  }

  function ensureTypeTreatmentPreview():
    NonNullable<typeof typographyTreatmentPreview> | undefined {
    if (!selected) return undefined;
    if (typographyTreatmentPreview?.element === selected) return typographyTreatmentPreview;
    restoreTypeTreatmentPreview();
    typographyTreatmentPreview = {
      element: selected,
      inlineFontSize: selected.style.fontSize,
      inlineLineHeight: selected.style.lineHeight,
      inlineLetterSpacing: selected.style.letterSpacing,
      baselineFontSize: Number.parseFloat(getComputedStyle(selected).fontSize) || 16,
    };
    return typographyTreatmentPreview;
  }

  function previewTypeTreatment(treatmentId: string): void {
    const treatment = typeTreatments.find((item) => item.id === treatmentId);
    const preview = ensureTypeTreatmentPreview();
    if (!selected || !treatment || !preview) return;
    const lineHeight = Math.max(
      4,
      Math.round((preview.baselineFontSize * treatment.lineHeight) / 4) * 4,
    );
    selected.style.fontSize = preview.inlineFontSize;
    selected.style.lineHeight = `${lineHeight}px`;
    selected.style.letterSpacing = treatment.letterSpacing;
    preview.treatmentId = treatment.id;
    preview.scaleValue = undefined;
    if (selected) selectedControls = controlsFor(selected);
    updateOutline();
  }

  function currentScaleValue(): string {
    const maximum = modularTypeSize(typographyScaleBase, typographyScaleRatio, typographyScaleStep);
    if (!typographyScaleFluid) return `${maximum}px`;
    const minimum = modularTypeSize(
      typographyScaleBase,
      typographyScaleRatio,
      typographyScaleStep - 1,
    );
    return fluidTypeClamp(minimum, maximum);
  }

  function previewTypeScale(): void {
    const preview = ensureTypeTreatmentPreview();
    if (!selected || !preview) return;
    const value = currentScaleValue();
    selected.style.fontSize = value;
    selected.style.lineHeight = preview.inlineLineHeight;
    selected.style.letterSpacing = preview.inlineLetterSpacing;
    preview.treatmentId = undefined;
    preview.scaleValue = value;
    if (selected) selectedControls = controlsFor(selected);
    updateOutline();
  }

  function closeTypographyStudio(restoreFocus = false, restorePreview = true): void {
    if (typographySearchTimer) clearTimeout(typographySearchTimer);
    typographyCatalogRequest += 1;
    if (restorePreview) restoreTypographyPreview();
    typographyPopover.hidden = true;
    if (restoreFocus) typographyTrigger?.focus();
    typographyTrigger = null;
  }

  async function loadGoogleFonts(query: string): Promise<void> {
    const request = ++typographyCatalogRequest;
    googleTypographySource = 'loading';
    renderTypographyStudio(query);
    try {
      const payload = (await sessionRequest(
        `/google-fonts?query=${encodeURIComponent(query)}&limit=60`,
      )) as { fonts: GoogleFontFamily[]; source: 'google' | 'fallback' };
      if (request !== typographyCatalogRequest) return;
      googleTypographyFonts = payload.fonts;
      googleTypographySource = payload.source;
    } catch {
      if (request !== typographyCatalogRequest) return;
      googleTypographyFonts = [];
      googleTypographySource = 'error';
    }
    renderTypographyStudio(query);
  }

  async function loadGoogleFontStylesheet(
    selection: GoogleFontSelection,
    committed = false,
  ): Promise<HTMLLinkElement> {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = googleFontsCssUrl(selection.font, {
      weight: selection.weight,
      style: selection.style,
      axes: selection.axes,
      variableRanges: selection.font.axes.length > 0,
    });
    link.dataset.foundryGoogleFont = committed ? 'committed' : 'preview';
    const loaded = new Promise<void>((resolveLoad, rejectLoad) => {
      link.addEventListener('load', () => resolveLoad(), { once: true });
      link.addEventListener('error', () => rejectLoad(new Error('Google Font failed to load')), {
        once: true,
      });
    });
    document.head.append(link);
    await loaded;
    await document.fonts.load(
      `${selection.style} ${selection.weight} 16px "${selection.font.family.replaceAll('"', '\\"')}"`,
    );
    return link;
  }

  function applyGoogleFontPreview(selection: GoogleFontSelection): void {
    if (!typographyPreview) return;
    const element = typographyPreview.element;
    const currentStack = getComputedStyle(element).fontFamily;
    element.style.fontFamily = fontFamilyDeclaration(selection.font.family, currentStack);
    element.style.fontWeight = String(selection.weight);
    element.style.fontStyle = selection.style;
    element.style.fontVariationSettings = googleFontVariationSettings(selection);
    if (selected) selectedControls = controlsFor(selected);
    updateOutline();
  }

  async function refreshGoogleFontPreviewStylesheet(selection: GoogleFontSelection): Promise<void> {
    if (!typographyPreview || typographyPreview.origin !== 'google') return;
    const currentPreview = typographyPreview;
    try {
      const link = await loadGoogleFontStylesheet(selection);
      if (typographyPreview !== currentPreview || googleTypographySelection !== selection) {
        link.remove();
        return;
      }
      currentPreview.link?.remove();
      currentPreview.link = link;
      applyGoogleFontPreview(selection);
    } catch {
      showToast(`${selection.font.family} could not load that style`);
    }
  }

  async function previewGoogleFont(font: GoogleFontFamily): Promise<void> {
    if (!selected) return;
    const element = selected;
    const control = selectedControls.find((item) => item.property === 'fontFamily');
    if (!control) return;
    restoreTypographyPreview();
    const computed = getComputedStyle(element);
    const selection = defaultGoogleFontSelection(
      font,
      Number.parseInt(computed.fontWeight, 10) || 400,
      computed.fontStyle,
    );
    try {
      const link = await loadGoogleFontStylesheet(selection);
      typographyPreview = {
        element,
        inlineFamily: element.style.fontFamily,
        inlineWeight: element.style.fontWeight,
        inlineStyle: element.style.fontStyle,
        inlineVariationSettings: element.style.fontVariationSettings,
        family: font.family,
        origin: 'google',
        link,
      };
      googleTypographySelection = selection;
      applyGoogleFontPreview(selection);
      renderTypographyStudio(typographyQuery);
      showToast(`${font.family} previewed from Google Fonts`);
    } catch {
      showToast(`${font.family} could not be loaded`);
    }
  }

  async function reviewGoogleFont(): Promise<void> {
    const selection = googleTypographySelection;
    if (!selected || !selection) return;
    const font = selection.font;
    restoreTypographyPreview();
    try {
      await loadGoogleFontStylesheet(selection, true);
      const strategy = fontInstallStrategies.find((item) => item.id === googleTypographyStrategy)!;
      const integration = buildFontIntegrationPlan(
        selection,
        googleTypographyStrategy,
        getComputedStyle(selected).fontFamily,
      );
      const validation = currentTypographyValidationPlan();
      const evidence = [
        'Google Fonts CSS2 preview loaded',
        `font integration plan: ${JSON.stringify(integration)}`,
        `font integration strategy: ${googleTypographyStrategy}`,
        `Google Fonts family: ${font.family}`,
        `font weight: ${selection.weight}`,
        `font style: ${selection.style}`,
        ...(font.axes.length ? [`variable axes: ${googleFontVariationSettings(selection)}`] : []),
        ...integration.sourceActions.map((action) => `source action: ${action}`),
        ...integration.verificationChecks.map((check) => `verification check: ${check}`),
        ...typographyValidationEvidence(validation),
      ];
      const controls = controlsFor(selected);
      const familyControl = controls.find((item) => item.property === 'fontFamily');
      if (!familyControl) return;
      await applyControlValue(
        familyControl,
        fontFamilyDeclaration(font.family, String(familyControl.read())),
        `Use ${font.family} through ${strategy.label.toLocaleLowerCase()}`,
        evidence,
      );
      const weightControl = controls.find((item) => item.property === 'fontWeight');
      if (weightControl)
        await applyControlValue(
          weightControl,
          String(selection.weight),
          `Set ${font.family} weight to ${selection.weight}`,
          evidence,
        );
      const styleControl = controls.find((item) => item.property === 'fontStyle');
      if (styleControl)
        await applyControlValue(
          styleControl,
          selection.style,
          `Set ${font.family} style to ${selection.style}`,
          evidence,
        );
      const variationControl = controls.find((item) => item.property === 'fontVariationSettings');
      if (variationControl && font.axes.some((axis) => !['ital', 'wght'].includes(axis.tag)))
        await applyControlValue(
          variationControl,
          googleFontVariationSettings(selection),
          `Set ${font.family} variable axes`,
          evidence,
        );
      pendingGoogleFontFamilies.add(font.family.toLocaleLowerCase());
      if (selected) selectedControls = controlsFor(selected);
      closeTypographyStudio(false, false);
      renderControls();
      publishWorkspaceState();
    } catch {
      showToast(`${font.family} could not be prepared for review`);
    }
  }

  function typographyFontRows(
    fonts: TypographyFontFace[],
    activeFamilies: string[],
    origin: 'project' | 'local',
  ): string {
    return fonts
      .map((font) => {
        const active = activeFamilies.some(
          (family) => family.toLocaleLowerCase() === font.family.toLocaleLowerCase(),
        );
        const detail = [
          font.weights.length
            ? `${font.weights.length} ${font.weights.length === 1 ? 'weight' : 'weights'}`
            : '',
          font.styles.length
            ? `${font.styles.length} ${font.styles.length === 1 ? 'style' : 'styles'}`
            : '',
          font.status === 'fallback' ? 'Fallback' : '',
        ]
          .filter(Boolean)
          .join(' · ');
        const declaration = fontFamilyDeclaration(
          font.family,
          getComputedStyle(selected!).fontFamily,
        );
        return `<button type="button" class="typography-font-row ${active ? 'active' : ''}" data-typography-family="${escapeHtml(font.family)}" data-typography-origin="${origin}" style="--preview-family:${escapeHtml(declaration)}"><span class="typography-font-copy"><strong style="font-family:var(--preview-family)">${escapeHtml(font.family)}</strong><span>${escapeHtml(detail || (origin === 'local' ? 'Available on this device' : 'Used in this project'))}</span></span><span class="typography-font-meta">${active ? 'Active' : origin === 'local' ? 'Preview' : 'Use'}</span></button>`;
      })
      .join('');
  }

  function googleFontRows(activeFamilies: string[]): string {
    return googleTypographyFonts
      .map((font) => {
        const active = activeFamilies.some(
          (family) => family.toLocaleLowerCase() === font.family.toLocaleLowerCase(),
        );
        const selectedFont = googleTypographySelection?.font.family === font.family;
        const weights = new Set(
          font.variants.map((variant) => variant.match(/\d+/)?.[0]).filter(Boolean),
        );
        const detail = [
          font.category,
          weights.size ? `${weights.size} ${weights.size === 1 ? 'weight' : 'weights'}` : '',
          font.axes.length
            ? `${font.axes.length} variable ${font.axes.length === 1 ? 'axis' : 'axes'}`
            : '',
        ]
          .filter(Boolean)
          .join(' · ');
        return `<button type="button" class="typography-font-row ${active || selectedFont ? 'active' : ''}" data-google-font="${escapeHtml(font.family)}"><span class="typography-font-copy"><strong>${escapeHtml(font.family)}</strong><span>${escapeHtml(detail)}</span></span><span class="typography-font-meta">${active ? 'Active' : selectedFont ? 'Previewing' : 'Preview'}</span></button>`;
      })
      .join('');
  }

  function measuredTextLineCount(element: HTMLElement): number | undefined {
    const range = element.ownerDocument.createRange();
    const tops = new Set<number>();
    // Element ranges also include child boxes (such as a button icon), which
    // falsely count as extra text lines. Measure actual visible text only.
    for (const node of textNodesInside(element)) {
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width > 0 && rect.height > 0) tops.add(Math.round(rect.top * 2) / 2);
      }
    }
    return tops.size || undefined;
  }

  function currentTypographyAnalysis(element: HTMLElement) {
    const computed = getComputedStyle(element);
    const family = parseFontFamilyStack(computed.fontFamily)[0] ?? computed.fontFamily;
    const fontSize = Number.parseFloat(computed.fontSize) || 16;
    const parsedLineHeight = Number.parseFloat(computed.lineHeight);
    const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.2;
    const faces: RenderedFontFace[] = [...document.fonts].map((face) => ({
      family: face.family,
      weight: face.weight,
      style: face.style,
      status: face.status,
    }));
    const escapedFamily = family.replaceAll('"', '\\"');
    const analysis = analyzeTypography({
      primaryFamily: family,
      requestedWeight: Number.parseInt(computed.fontWeight, 10) || 400,
      requestedStyle: computed.fontStyle,
      fontSynthesis: computed.fontSynthesis,
      fontCheck: document.fonts.check(
        `${computed.fontStyle} ${computed.fontWeight} ${fontSize}px "${escapedFamily}"`,
        element.textContent?.trim().slice(0, 32) || 'BESbswy',
      ),
      faces,
      text: element.textContent ?? '',
      fontSize,
      lineHeight,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      whiteSpace: computed.whiteSpace,
      overflowX: computed.overflowX,
      overflowY: computed.overflowY,
      measuredLineCount: measuredTextLineCount(element),
    });
    return analysis;
  }

  function typographyDiagnosticsMarkup(): string {
    if (!selected) return '';
    const analysis = currentTypographyAnalysis(selected);
    const statusLabel =
      analysis.faceStatus === 'system'
        ? 'System face'
        : analysis.faceStatus === 'loaded'
          ? 'Loaded face'
          : analysis.faceStatus === 'failed'
            ? 'Load failed'
            : 'Fallback';
    const metrics = `${analysis.lineCount} ${analysis.lineCount === 1 ? 'line' : 'lines'} · ${analysis.charactersPerLine} chars/line · ${statusLabel}`;
    const findings = analysis.diagnostics.length
      ? `<div class="typography-diagnostic-list">${analysis.diagnostics
          .map(
            (finding) =>
              `<div class="typography-diagnostic" data-severity="${finding.severity}"><i data-foundry-icon="triangle-alert"></i><span><strong>${escapeHtml(finding.title)}</strong><small>${escapeHtml(finding.detail)}</small></span></div>`,
          )
          .join('')}</div>`
      : '<div class="typography-diagnostic-clear"><i data-foundry-icon="check"></i><span>Face and wrapping look stable at this viewport.</span></div>';
    return `<section class="typography-diagnostics" aria-label="Rendered typography diagnostics"><div class="typography-diagnostics-head"><strong>Rendered type</strong><span>${escapeHtml(metrics)}</span></div>${findings}</section>`;
  }

  function currentTypographyValidationPlan() {
    return buildTypographyValidationPlan({
      breakpoints: designGraph?.breakpoints ?? [],
      themes: designGraph?.themes ?? [],
      states: designGraph?.states ?? [],
      currentBreakpoint: breakpoint.value,
      currentTheme: theme.value,
      currentState: state.value,
    });
  }

  function currentTypographyStyleValues(): ProjectTypographyStyleValues | undefined {
    if (!selected) return undefined;
    const computed = getComputedStyle(selected);
    return {
      fontFamily: computed.fontFamily,
      fontWeight: computed.fontWeight,
      fontStyle: computed.fontStyle,
      fontSize: computed.fontSize,
      lineHeight: computed.lineHeight,
      letterSpacing: computed.letterSpacing,
      fontVariationSettings: computed.fontVariationSettings,
    };
  }

  function defaultTypographyStyleName(): string {
    const target = selected ? targetFor(selected).label.replace(/\s+/g, ' ').slice(0, 28) : 'Type';
    const treatment = typeTreatments.find(
      (item) => item.id === typographyTreatmentPreview?.treatmentId,
    );
    return `${target} / ${treatment?.label ?? 'Scale'}`;
  }

  function persistProjectTypographyStyles(): void {
    try {
      writeProjectTypographyStyles(localStorage, projectRoot, projectTypographyStyles);
    } catch {
      showToast('Project type styles could not be saved in this browser');
    }
  }

  function projectTypographyStyleEvidence(style: ProjectTypographyStyle): string[] {
    return [
      `Project typography style: ${style.name}`,
      'source intent: create or update a project-native typography token or reusable style',
      `style values: ${Object.entries(style.values)
        .map(([property, value]) => `${property}=${value}`)
        .join(', ')}`,
      ...typographyValidationEvidence(style.validation),
    ];
  }

  function savedTypographyStylesMarkup(): string {
    if (!projectTypographyStyles.length) return '';
    return `<div class="typography-project-style"><div class="typography-lab-head"><strong>Saved project styles</strong><span>Reusable, source-accountable type decisions for this project.</span></div><div class="typography-style-list">${projectTypographyStyles
      .map(
        (style) =>
          `<div class="typography-style-row"><span class="typography-style-copy"><strong>${escapeHtml(style.name)}</strong><span>${style.validation.breakpoints.length} viewport${style.validation.breakpoints.length === 1 ? '' : 's'} · ${style.validation.states.length} state${style.validation.states.length === 1 ? '' : 's'}</span></span><span class="typography-style-actions"><button type="button" data-apply-type-style="${escapeHtml(style.id)}" aria-label="Apply ${escapeHtml(style.name)}"><i data-foundry-icon="check"></i></button><button type="button" data-remove-type-style="${escapeHtml(style.id)}" aria-label="Remove ${escapeHtml(style.name)}"><i data-foundry-icon="x"></i></button></span></div>`,
      )
      .join('')}</div></div>`;
  }

  function typographyLabMarkup(): string {
    const activeTreatment = typographyTreatmentPreview?.treatmentId;
    const scaleValue = currentScaleValue();
    const scaleActive = typographyTreatmentPreview?.scaleValue === scaleValue;
    const canSaveStyle = Boolean(activeTreatment || scaleActive);
    const validation = currentTypographyValidationPlan();
    const styleName = typographyStyleName || defaultTypographyStyleName();
    return `<section class="typography-lab" aria-label="Type treatment previews"><div class="typography-lab-head"><strong>Try a treatment</strong><span>Preview rhythm on the selected text before adding it to review.</span></div><div class="typography-treatment-options">${typeTreatments
      .map(
        (treatment) =>
          `<button type="button" class="typography-treatment" data-type-treatment="${treatment.id}" aria-pressed="${String(activeTreatment === treatment.id)}"><strong>${treatment.label}</strong><span>${treatment.detail}</span></button>`,
      )
      .join(
        '',
      )}</div><div class="typography-lab-actions"><button type="button" data-reset-type-preview ${typographyTreatmentPreview ? '' : 'disabled'}>Reset</button><button type="button" class="primary" data-review-type-treatment ${activeTreatment ? '' : 'disabled'}>Add treatment</button></div><div class="typography-scale"><div class="typography-lab-head"><strong>Type scale</strong><span>Grid-aligned modular steps with an optional fluid range.</span></div><label class="typography-scale-row"><span>Base size</span><input type="range" min="8" max="128" step="4" value="${typographyScaleBase}" data-type-scale-base aria-label="Base type size"/><output>${typographyScaleBase}px</output></label><div class="typography-scale-ratios" aria-label="Type scale ratio">${[
      1.125, 1.2, 1.25, 1.333,
    ]
      .map(
        (ratio) =>
          `<button type="button" data-type-scale-ratio="${ratio}" aria-pressed="${String(typographyScaleRatio === ratio)}">${ratio}</button>`,
      )
      .join('')}</div><div class="typography-scale-steps" aria-label="Type scale step">${[
      -1, 0, 1, 2, 3,
    ]
      .map(
        (step) =>
          `<button type="button" data-type-scale-step="${step}" aria-pressed="${String(typographyScaleStep === step)}">${step > 0 ? '+' : ''}${step}</button>`,
      )
      .join(
        '',
      )}</div><div class="typography-scale-result"><code title="${escapeHtml(scaleValue)}">${escapeHtml(scaleValue)}</code><button type="button" data-type-scale-fluid aria-pressed="${String(typographyScaleFluid)}">${typographyScaleFluid ? 'Fluid' : 'Fixed'}</button></div><div class="typography-lab-actions"><button type="button" data-preview-type-scale>${scaleActive ? 'Previewing' : 'Preview scale'}</button><button type="button" class="primary" data-review-type-scale ${scaleActive ? '' : 'disabled'}>Add scale value</button></div></div><div class="typography-project-style"><div class="typography-lab-head"><strong>Project style</strong><span>Save the complete treatment and ask the agent to map it into the project’s native type system.</span></div><label class="typography-style-name"><span>Style name</span><input type="text" data-type-style-name value="${escapeHtml(styleName)}" aria-label="Project typography style name"/></label><div class="typography-validation-plan"><strong>Validation plan</strong><span>${validation.breakpoints.length} responsive viewport${validation.breakpoints.length === 1 ? '' : 's'} · ${validation.themes.length} theme${validation.themes.length === 1 ? '' : 's'} · ${validation.states.length} state${validation.states.length === 1 ? '' : 's'}</span></div><div class="typography-lab-actions"><button type="button" class="primary" data-save-type-style ${canSaveStyle ? '' : 'disabled'}>Save as style</button></div></div>${savedTypographyStylesMarkup()}</section>`;
  }

  async function reviewTypeTreatment(extraEvidence: string[] = []): Promise<void> {
    const preview = typographyTreatmentPreview;
    const treatment = typeTreatments.find((item) => item.id === preview?.treatmentId);
    if (!selected || !preview || !treatment) return;
    const lineHeight = Math.max(
      4,
      Math.round((preview.baselineFontSize * treatment.lineHeight) / 4) * 4,
    );
    restoreTypographyPreview();
    const controls = controlsFor(selected);
    const lineHeightControl = controls.find((item) => item.property === 'lineHeight');
    const spacingControl = controls.find((item) => item.property === 'letterSpacing');
    const evidence = [
      `Typography Studio treatment: ${treatment.label}`,
      `grid-aligned line height: ${lineHeight}px`,
      `letter spacing: ${treatment.letterSpacing}`,
      ...extraEvidence,
    ];
    if (lineHeightControl)
      await applyControlValue(
        lineHeightControl,
        `${lineHeight}px`,
        `Apply ${treatment.label.toLocaleLowerCase()} type rhythm`,
        evidence,
      );
    if (spacingControl)
      await applyControlValue(
        spacingControl,
        treatment.letterSpacing,
        `Apply ${treatment.label.toLocaleLowerCase()} tracking`,
        evidence,
      );
    if (selected) selectedControls = controlsFor(selected);
    closeTypographyStudio(false, false);
    renderControls();
    publishWorkspaceState();
  }

  async function reviewTypeScale(extraEvidence: string[] = []): Promise<void> {
    const preview = typographyTreatmentPreview;
    if (!selected || !preview?.scaleValue) return;
    const value = preview.scaleValue;
    restoreTypographyPreview();
    const element = selected;
    const control: Control = {
      category: 'typography',
      property: 'fontSize',
      label: 'Font size',
      kind: 'text',
      value: element.style.fontSize || getComputedStyle(element).fontSize,
      read: () => element.style.fontSize || getComputedStyle(element).fontSize,
      apply: (nextValue) => element.style.setProperty('font-size', String(nextValue)),
    };
    await applyControlValue(control, value, 'Apply type scale value', [
      `Typography Studio modular scale: base ${typographyScaleBase}px`,
      `scale ratio: ${typographyScaleRatio}`,
      `scale step: ${typographyScaleStep}`,
      typographyScaleFluid ? 'fluid range: 320px to 1440px' : 'fixed scale value',
      ...extraEvidence,
    ]);
    if (selected) selectedControls = controlsFor(selected);
    closeTypographyStudio(false, false);
    renderControls();
    publishWorkspaceState();
  }

  async function saveCurrentProjectTypographyStyle(): Promise<void> {
    const preview = typographyTreatmentPreview;
    const values = currentTypographyStyleValues();
    if (!selected || !preview || !values) return;
    const next = createProjectTypographyStyle({
      name: typographyStyleName || defaultTypographyStyleName(),
      values,
      validation: currentTypographyValidationPlan(),
    });
    const existing = projectTypographyStyles.find((style) => style.id === next.id);
    const style = existing ? { ...next, createdAt: existing.createdAt } : next;
    projectTypographyStyles = [
      style,
      ...projectTypographyStyles.filter((item) => item.id !== style.id),
    ];
    persistProjectTypographyStyles();
    typographyStyleName = '';
    const evidence = projectTypographyStyleEvidence(style);
    if (preview.treatmentId) await reviewTypeTreatment(evidence);
    else await reviewTypeScale(evidence);
    showToast(`${style.name} added to review and saved locally`);
  }

  async function applyProjectTypographyStyle(styleId: string): Promise<void> {
    if (!selected) return;
    const style = projectTypographyStyles.find((item) => item.id === styleId);
    if (!style) return;
    restoreTypographyPreview();
    const controls = controlsFor(selected);
    const evidence = projectTypographyStyleEvidence(style);
    for (const [property, value] of Object.entries(style.values)) {
      const control = controls.find((item) => item.property === property);
      if (!control || String(control.read()) === String(value)) continue;
      await applyControlValue(control, value, `Apply ${style.name}`, evidence);
    }
    if (selected) selectedControls = controlsFor(selected);
    closeTypographyStudio(false, false);
    renderControls();
    publishWorkspaceState();
  }

  function removeProjectTypographyStyle(styleId: string): void {
    projectTypographyStyles = projectTypographyStyles.filter((style) => style.id !== styleId);
    persistProjectTypographyStyles();
    refreshTypographyStudio();
  }

  function axisLabel(tag: string): string {
    return (
      (
        {
          GRAD: 'Grade',
          XOPQ: 'Thick stroke',
          XTRA: 'Counter width',
          YOPQ: 'Thin stroke',
          YTAS: 'Ascender height',
          YTDE: 'Descender depth',
          YTFI: 'Figure height',
          YTLC: 'Lowercase height',
          YTUC: 'Uppercase height',
          opsz: 'Optical size',
          slnt: 'Slant',
          wdth: 'Width',
        } as Record<string, string>
      )[tag] ?? tag
    );
  }

  function googleFontPlan(): string {
    const selection = googleTypographySelection;
    if (!selection) return '';
    const font = selection.font;
    const weights = googleFontWeights(font);
    const styles = googleFontStyles(font);
    const editableAxes = font.axes.filter((axis) => !['ital', 'wght'].includes(axis.tag));
    const subsets = font.subsets.filter((subset) => subset !== 'menu');
    const integration = buildFontIntegrationPlan(
      selection,
      googleTypographyStrategy,
      selected ? getComputedStyle(selected).fontFamily : 'system-ui, sans-serif',
    );
    const validation = currentTypographyValidationPlan();
    const integrationReference =
      integration.importStatement ??
      (integration.strategy === 'stylesheet'
        ? integration.cssUrl
        : integration.strategy === 'framework'
          ? `${font.family} · framework-native loader`
          : `${font.family} · licensed WOFF2 asset required`);
    return `<div class="typography-google-plan"><div class="typography-google-summary"><strong>${escapeHtml(font.family)}</strong><span>${escapeHtml(font.category)} · ${weights.length} ${weights.length === 1 ? 'weight' : 'weights'}${editableAxes.length ? ` · ${editableAxes.length} variable ${editableAxes.length === 1 ? 'axis' : 'axes'}` : ''}</span></div><section class="typography-choice-section"><span class="typography-choice-label">Weight</span><div class="typography-weight-options" role="radiogroup" aria-label="Font weight">${weights
      .map(
        (weight) =>
          `<button type="button" role="radio" aria-checked="${String(weight === selection.weight)}" data-font-weight="${weight}">${weight}</button>`,
      )
      .join('')}</div></section>${
      styles.length > 1
        ? `<section class="typography-choice-section"><span class="typography-choice-label">Style</span><div class="typography-style-options" role="radiogroup" aria-label="Font style">${styles.map((style) => `<button type="button" role="radio" aria-checked="${String(style === selection.style)}" data-font-style="${style}">${style === 'normal' ? 'Normal' : 'Italic'}</button>`).join('')}</div></section>`
        : ''
    }${
      editableAxes.length
        ? `<section class="typography-choice-section"><span class="typography-choice-label">Variable axes</span><div class="typography-axis-list">${editableAxes
            .map((axis) => {
              const value = selection.axes[axis.tag] ?? axis.defaultValue;
              const step = axis.max - axis.min <= 10 ? 0.1 : 1;
              return `<label class="typography-axis"><span><strong>${escapeHtml(axis.tag)}</strong><small>${escapeHtml(axisLabel(axis.tag))}</small></span><input type="range" min="${axis.min}" max="${axis.max}" step="${step}" value="${value}" data-font-axis="${escapeHtml(axis.tag)}" aria-label="${escapeHtml(axisLabel(axis.tag))}"/><output>${Number(value.toFixed(2))}</output></label>`;
            })
            .join('')}</div></section>`
        : ''
    }${
      subsets.length
        ? `<section class="typography-choice-section"><span class="typography-choice-label">Script coverage</span><div class="typography-subsets">${subsets
            .slice(0, 6)
            .map((subset) => `<span>${escapeHtml(subset.replaceAll('-', ' '))}</span>`)
            .join(
              '',
            )}${subsets.length > 6 ? `<span>+${subsets.length - 6}</span>` : ''}</div></section>`
        : ''
    }<section class="typography-choice-section"><span class="typography-choice-label">Add to source</span><div class="typography-strategies" role="radiogroup" aria-label="Font integration strategy">${fontInstallStrategies
      .map(
        (strategy) =>
          `<button type="button" role="radio" aria-checked="${String(strategy.id === googleTypographyStrategy)}" data-font-strategy="${strategy.id}"><span><strong>${strategy.label}</strong><small>${strategy.detail}</small></span><i data-foundry-icon="check"></i></button>`,
      )
      .join(
        '',
      )}</div></section><section class="typography-choice-section"><span class="typography-choice-label">Reviewed source plan</span><div class="typography-source-plan" data-requires-assets="${String(integration.requiresAssetSelection)}"><div class="typography-source-plan-head"><strong>${escapeHtml(integration.label)}</strong><span>${validation.breakpoints.length * validation.themes.length * validation.states.length} contexts</span></div><code>${escapeHtml(integrationReference)}</code><ol>${integration.sourceActions.map((action) => `<li>${escapeHtml(action)}</li>`).join('')}</ol><div class="typography-source-plan-foot"><i data-foundry-icon="${integration.requiresAssetSelection ? 'warning' : 'check'}"></i><span>${integration.requiresAssetSelection ? 'The agent must map an existing licensed asset before applying.' : 'Preview remains temporary until the reviewed source plan is applied and rebuilt.'}</span></div></div></section><button type="button" class="typography-review-font" data-review-google-font>Add font and source plan</button></div>`;
  }

  function renderTypographyStudio(query = ''): void {
    if (!selected) return;
    typographyQuery = query;
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const previewGoogleFamily =
      typographyPreview?.origin === 'google'
        ? typographyPreview.family.toLocaleLowerCase()
        : undefined;
    const projectFonts = collectProjectFonts(document, selected).filter((font) => {
      const family = font.family.toLocaleLowerCase();
      return (
        family.includes(normalizedQuery) &&
        family !== previewGoogleFamily &&
        !pendingGoogleFontFamilies.has(family)
      );
    });
    const localFonts = localTypographyFonts.filter((font) =>
      font.family.toLocaleLowerCase().includes(normalizedQuery),
    );
    const activeFamilies = parseFontFamilyStack(getComputedStyle(selected).fontFamily);
    const supportsLocalFonts =
      typeof (window as Window & { queryLocalFonts?: unknown }).queryLocalFonts === 'function';
    const googleStatus =
      googleTypographySource === 'loading'
        ? 'Loading'
        : googleTypographySource === 'fallback'
          ? 'Offline set'
          : googleTypographySource === 'error'
            ? 'Unavailable'
            : `${googleTypographyFonts.length}`;
    typographyPopover.innerHTML = `<div class="typography-popover-head"><span><i data-foundry-icon="type"></i></span><strong>Typography Studio</strong><small>${projectFonts.length} project ${projectFonts.length === 1 ? 'font' : 'fonts'}</small><button class="icon-button" data-close-typography aria-label="Close Typography Studio"><i data-foundry-icon="x"></i></button></div><div class="typography-search"><input type="search" data-typography-search aria-label="Search fonts" placeholder="Search project, Google, and local fonts" value="${escapeHtml(query)}"/></div><div class="typography-fonts">${typographyDiagnosticsMarkup()}${typographyLabMarkup()}<section class="typography-group"><div class="typography-group-head"><strong>In this project</strong><span>${projectFonts.length}</span></div>${projectFonts.length ? typographyFontRows(projectFonts, activeFamilies, 'project') : '<div class="typography-local-empty"><p>No project fonts match this search.</p></div>'}</section><section class="typography-group"><div class="typography-group-head"><strong>Google Fonts</strong><span>${googleStatus}</span></div>${googleTypographySource === 'loading' ? '<div class="typography-local-empty"><p>Reading the current Google Fonts catalog…</p></div>' : googleTypographyFonts.length ? googleFontRows(activeFamilies) : '<div class="typography-local-empty"><p>Google Fonts could not be reached. Search remains available for project and local fonts.</p></div>'}${googleFontPlan()}</section><section class="typography-group"><div class="typography-group-head"><strong>On this device</strong><span>${localFonts.length || 'Private'}</span></div>${
      localFonts.length
        ? typographyFontRows(localFonts, activeFamilies, 'local')
        : `<div class="typography-local-empty"><p>${supportsLocalFonts ? 'Foundry only reads font names after you allow access. Font files stay on this device.' : 'Local font access is not available in this browser. Project fonts remain available.'}</p>${supportsLocalFonts ? '<button type="button" data-load-local-fonts>Allow local font access</button>' : ''}</div>`
    }</section></div><div class="typography-preview-note"><i data-foundry-icon="type"></i><span>${typographyPreview ? `<strong>${escapeHtml(typographyPreview.family)}</strong> is a ${typographyPreview.origin === 'google' ? 'Google Fonts' : 'local'} preview. Close this panel to restore the source-backed font.` : 'Project fonts create reviewed changes. Local fonts remain preview-only. New Google Fonts require an installation strategy before review.'}</span></div>`;
    renderIcons(typographyPopover);
    typographyPopover
      .querySelector<HTMLButtonElement>('[data-close-typography]')
      ?.addEventListener('click', () => closeTypographyStudio(true));
    typographyPopover
      .querySelectorAll<HTMLButtonElement>('[data-type-treatment]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          previewTypeTreatment(button.dataset.typeTreatment ?? '');
          refreshTypographyStudio();
        });
      });
    typographyPopover
      .querySelector<HTMLButtonElement>('[data-reset-type-preview]')
      ?.addEventListener('click', () => {
        restoreTypeTreatmentPreview();
        if (selected) selectedControls = controlsFor(selected);
        updateOutline();
        refreshTypographyStudio();
      });
    typographyPopover
      .querySelector<HTMLButtonElement>('[data-review-type-treatment]')
      ?.addEventListener('click', () => void reviewTypeTreatment());
    typographyPopover
      .querySelector<HTMLInputElement>('[data-type-scale-base]')
      ?.addEventListener('change', (event) => {
        const wasScale = Boolean(typographyTreatmentPreview?.scaleValue);
        typographyScaleBase = Number((event.currentTarget as HTMLInputElement).value);
        if (wasScale) previewTypeScale();
        refreshTypographyStudio();
      });
    typographyPopover
      .querySelectorAll<HTMLButtonElement>('[data-type-scale-ratio]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          const wasScale = Boolean(typographyTreatmentPreview?.scaleValue);
          typographyScaleRatio = Number(button.dataset.typeScaleRatio);
          if (wasScale) previewTypeScale();
          refreshTypographyStudio();
        });
      });
    typographyPopover
      .querySelectorAll<HTMLButtonElement>('[data-type-scale-step]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          const wasScale = Boolean(typographyTreatmentPreview?.scaleValue);
          typographyScaleStep = Number(button.dataset.typeScaleStep);
          if (wasScale) previewTypeScale();
          refreshTypographyStudio();
        });
      });
    typographyPopover
      .querySelector<HTMLButtonElement>('[data-type-scale-fluid]')
      ?.addEventListener('click', () => {
        const wasScale = Boolean(typographyTreatmentPreview?.scaleValue);
        typographyScaleFluid = !typographyScaleFluid;
        if (wasScale) previewTypeScale();
        refreshTypographyStudio();
      });
    typographyPopover
      .querySelector<HTMLButtonElement>('[data-preview-type-scale]')
      ?.addEventListener('click', () => {
        previewTypeScale();
        refreshTypographyStudio();
      });
    typographyPopover
      .querySelector<HTMLButtonElement>('[data-review-type-scale]')
      ?.addEventListener('click', () => void reviewTypeScale());
    typographyPopover
      .querySelector<HTMLInputElement>('[data-type-style-name]')
      ?.addEventListener('input', (event) => {
        typographyStyleName = (event.currentTarget as HTMLInputElement).value;
      });
    typographyPopover
      .querySelector<HTMLButtonElement>('[data-save-type-style]')
      ?.addEventListener('click', () => void saveCurrentProjectTypographyStyle());
    typographyPopover
      .querySelectorAll<HTMLButtonElement>('[data-apply-type-style]')
      .forEach((button) => {
        button.addEventListener(
          'click',
          () => void applyProjectTypographyStyle(button.dataset.applyTypeStyle ?? ''),
        );
      });
    typographyPopover
      .querySelectorAll<HTMLButtonElement>('[data-remove-type-style]')
      .forEach((button) => {
        button.addEventListener('click', () =>
          removeProjectTypographyStyle(button.dataset.removeTypeStyle ?? ''),
        );
      });
    const search = typographyPopover.querySelector<HTMLInputElement>('[data-typography-search]');
    search?.addEventListener('input', () => {
      const nextQuery = search.value;
      renderTypographyStudio(nextQuery);
      if (typographySearchTimer) clearTimeout(typographySearchTimer);
      typographySearchTimer = setTimeout(() => void loadGoogleFonts(nextQuery), 240);
      const nextSearch = typographyPopover.querySelector<HTMLInputElement>(
        '[data-typography-search]',
      );
      nextSearch?.focus();
      nextSearch?.setSelectionRange(nextQuery.length, nextQuery.length);
    });
    typographyPopover
      .querySelector<HTMLButtonElement>('[data-load-local-fonts]')
      ?.addEventListener('click', async () => {
        const queryLocalFonts = (
          window as Window & {
            queryLocalFonts?: () => Promise<LocalFontRecord[]>;
          }
        ).queryLocalFonts;
        if (!queryLocalFonts) return;
        try {
          localTypographyFonts = localFontRecords(await queryLocalFonts.call(window));
          renderTypographyStudio(query);
        } catch (error) {
          showToast(
            error instanceof DOMException && error.name === 'NotAllowedError'
              ? 'Local font access was not allowed'
              : 'Local fonts could not be read in this browser',
          );
        }
      });
    typographyPopover
      .querySelectorAll<HTMLButtonElement>('[data-typography-family]')
      .forEach((button) => {
        button.addEventListener('click', async () => {
          if (!selected) return;
          const family = button.dataset.typographyFamily ?? '';
          const origin = button.dataset.typographyOrigin;
          const control = selectedControls.find((item) => item.property === 'fontFamily');
          if (!family || !control) return;
          if (origin === 'local') {
            restoreTypographyPreview();
            typographyPreview = {
              element: selected,
              inlineFamily: selected.style.fontFamily,
              inlineWeight: selected.style.fontWeight,
              inlineStyle: selected.style.fontStyle,
              inlineVariationSettings: selected.style.fontVariationSettings,
              family,
              origin: 'local',
            };
            selected.style.fontFamily = fontFamilyDeclaration(family, String(control.read()));
            updateOutline();
            renderTypographyStudio(query);
            showToast(`${family} previewed locally`);
            return;
          }
          restoreTypographyPreview();
          await applyControlValue(
            control,
            fontFamilyDeclaration(family, String(control.read())),
            `Use ${family}`,
          );
          if (selected) selectedControls = controlsFor(selected);
          closeTypographyStudio(false, false);
          renderControls();
          publishWorkspaceState();
        });
      });
    typographyPopover
      .querySelectorAll<HTMLButtonElement>('[data-google-font]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          const font = googleTypographyFonts.find(
            (candidate) => candidate.family === button.dataset.googleFont,
          );
          if (font) void previewGoogleFont(font);
        });
      });
    typographyPopover
      .querySelectorAll<HTMLButtonElement>('[data-font-strategy]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          googleTypographyStrategy = button.dataset.fontStrategy as FontInstallStrategy;
          renderTypographyStudio(query);
        });
      });
    typographyPopover
      .querySelectorAll<HTMLButtonElement>('[data-font-weight]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          if (!googleTypographySelection) return;
          googleTypographySelection.weight = Number(button.dataset.fontWeight);
          googleTypographySelection.axes.wght = googleTypographySelection.weight;
          applyGoogleFontPreview(googleTypographySelection);
          void refreshGoogleFontPreviewStylesheet(googleTypographySelection);
          renderTypographyStudio(query);
        });
      });
    typographyPopover.querySelectorAll<HTMLButtonElement>('[data-font-style]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!googleTypographySelection) return;
        googleTypographySelection.style = button.dataset.fontStyle as 'normal' | 'italic';
        googleTypographySelection.axes.ital = googleTypographySelection.style === 'italic' ? 1 : 0;
        applyGoogleFontPreview(googleTypographySelection);
        void refreshGoogleFontPreviewStylesheet(googleTypographySelection);
        renderTypographyStudio(query);
      });
    });
    typographyPopover.querySelectorAll<HTMLInputElement>('[data-font-axis]').forEach((input) => {
      input.addEventListener('input', () => {
        if (!googleTypographySelection) return;
        const tag = input.dataset.fontAxis;
        if (!tag) return;
        googleTypographySelection.axes[tag] = Number(input.value);
        input.closest('label')?.querySelector('output')?.replaceChildren(input.value);
        applyGoogleFontPreview(googleTypographySelection);
      });
    });
    typographyPopover
      .querySelector<HTMLButtonElement>('[data-review-google-font]')
      ?.addEventListener('click', () => void reviewGoogleFont());
  }

  function refreshTypographyStudio(): void {
    const scrollTop =
      typographyPopover.querySelector<HTMLElement>('.typography-fonts')?.scrollTop ?? 0;
    renderTypographyStudio(typographyQuery);
    const scroller = typographyPopover.querySelector<HTMLElement>('.typography-fonts');
    if (scroller) scroller.scrollTop = scrollTop;
  }

  function openTypographyStudio(trigger: HTMLButtonElement): void {
    if (!selected) return;
    colorPopover.hidden = true;
    activeColor = undefined;
    closeFdcSelect(false);
    typographyTrigger = trigger;
    typographyStyleName = '';
    typographyScaleBase = Math.max(
      8,
      Math.round((Number.parseFloat(getComputedStyle(selected).fontSize) || 16) / 4) * 4,
    );
    renderTypographyStudio();
    void loadGoogleFonts('');
    typographyPopover.hidden = false;
    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = typographyPopover.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(window.innerWidth - popoverRect.width - 8, triggerRect.right - popoverRect.width),
    );
    const preferredTop = triggerRect.bottom + 8;
    const top =
      preferredTop + popoverRect.height <= window.innerHeight - 8
        ? preferredTop
        : Math.max(8, triggerRect.top - popoverRect.height - 8);
    typographyPopover.style.left = `${Math.round(left)}px`;
    typographyPopover.style.top = `${Math.round(top)}px`;
    typographyPopover.querySelector<HTMLInputElement>('[data-typography-search]')?.focus();
  }

  function installEffectEditor(): void {
    const finish = async (control: Control, value: string, label: string): Promise<void> => {
      await applyControlValue(control, value, label);
      if (selected) selectedControls = controlsFor(selected);
      renderControls();
      publishWorkspaceState();
    };
    controlsRoot.querySelectorAll<HTMLInputElement>('[data-shadow-part]').forEach((field) => {
      field.addEventListener('change', () => {
        const control = selectedControls[Number(field.dataset.shadowControl)];
        const effectIndex = Number(field.dataset.shadowIndex);
        const part = field.dataset.shadowPart as keyof ShadowEffectValue;
        if (!control || !part) return;
        const effects = parseShadowEffects(String(control.read()));
        const effect = effects[effectIndex];
        if (!effect) return;
        if (part === 'color') effect.color = field.value;
        else if (part === 'opacity') effect.opacity = Number(field.value) / 100;
        else if (part !== 'kind') effect[part] = Number(field.value);
        void finish(control, composeShadowEffects(effects), `Adjust ${effect.kind}`);
      });
    });
    controlsRoot.querySelectorAll<HTMLSelectElement>('[data-shadow-kind]').forEach((field) => {
      field.addEventListener('change', () => {
        const control = selectedControls[Number(field.dataset.shadowControl)];
        const effectIndex = Number(field.dataset.shadowKind);
        if (!control) return;
        const effects = parseShadowEffects(String(control.read()));
        const effect = effects[effectIndex];
        if (!effect) return;
        effect.kind = field.value === 'inner-shadow' ? 'inner-shadow' : 'drop-shadow';
        void finish(control, composeShadowEffects(effects), `Change to ${field.value}`);
      });
    });
    controlsRoot.querySelectorAll<HTMLButtonElement>('[data-remove-shadow]').forEach((button) => {
      button.addEventListener('click', () => {
        const control = selectedControls[Number(button.dataset.shadowControl)];
        if (!control) return;
        const effects = parseShadowEffects(String(control.read()));
        effects.splice(Number(button.dataset.removeShadow), 1);
        void finish(control, composeShadowEffects(effects), 'Remove shadow');
      });
    });
    controlsRoot.querySelectorAll<HTMLInputElement>('[data-blur-control]').forEach((field) => {
      field.addEventListener('change', () => {
        const control = selectedControls[Number(field.dataset.blurControl)];
        if (!control) return;
        void finish(
          control,
          replaceBlur(String(control.read()), Number(field.value)),
          `Adjust ${control.label}`,
        );
      });
    });
    controlsRoot.querySelectorAll<HTMLButtonElement>('[data-remove-blur]').forEach((button) => {
      button.addEventListener('click', () => {
        const control = selectedControls[Number(button.dataset.blurControl)];
        if (!control) return;
        void finish(control, replaceBlur(String(control.read()), null), `Remove ${control.label}`);
      });
    });
    controlsRoot.querySelectorAll<HTMLButtonElement>('[data-add-effect]').forEach((button) => {
      button.addEventListener('click', () => {
        const control = selectedControls[Number(button.dataset.effectControl)];
        const type = button.dataset.addEffect;
        if (!control || !type) return;
        if (type === 'drop-shadow' || type === 'inner-shadow') {
          const effects = parseShadowEffects(String(control.read()));
          effects.push({
            kind: type,
            x: 0,
            y: 4,
            blur: 8,
            spread: 0,
            color: '#000000',
            opacity: 0.12,
          });
          void finish(control, composeShadowEffects(effects), `Add ${type}`);
          return;
        }
        void finish(control, replaceBlur(String(control.read()), 4), `Add ${type}`);
      });
    });
  }

  function installContextActions(controls: Control[]): void {
    controlsRoot.querySelectorAll<HTMLInputElement>('.native-search').forEach((search) =>
      search.addEventListener('input', (event) => {
        const queryValue = (event.currentTarget as HTMLInputElement).value.toLowerCase();
        search
          .closest<HTMLElement>('.native-panel')
          ?.querySelectorAll<HTMLElement>('[data-token-search]')
          .forEach((chip) => {
            chip.hidden = !chip.dataset.tokenSearch?.includes(queryValue);
          });
      }),
    );
    controlsRoot.querySelectorAll<HTMLButtonElement>('[data-token-only]').forEach((button) =>
      button.addEventListener('click', () => {
        tokenOnly = !tokenOnly;
        renderControls();
      }),
    );
    controlsRoot.querySelectorAll<HTMLButtonElement>('[data-native-token]').forEach((button) => {
      button.addEventListener('click', () => {
        const token = designGraph?.tokens.find((item) => item.id === button.dataset.nativeToken);
        if (!token) return;
        const category =
          (button.closest<HTMLElement>('.inspector-category')?.dataset.category as
            Category | undefined) ?? 'layout';
        const candidateProperties =
          category === 'color'
            ? ['color', 'backgroundColor', 'borderColor']
            : category === 'typography'
              ? ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontFamily']
              : category === 'effects'
                ? ['borderRadius']
                : ['gap', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
        const control =
          controls.find((item) => item.property === activeControlProperty) ??
          candidateProperties
            .map((property) => controls.find((item) => item.property === property))
            .find(Boolean);
        if (!control) return;
        const value = control.kind === 'number' ? numberFrom(token.value) : token.value;
        void applyControlValue(control, value, `Use ${token.name}`);
      });
    });
    controlsRoot.querySelectorAll<HTMLButtonElement>('[data-variant]').forEach((button) => {
      button.addEventListener('click', () => {
        const component = selectedComponent();
        const variant = component?.variants.find((item) => item.id === button.dataset.variant);
        if (!selected || !variant) return;
        for (const [key, value] of Object.entries(variant.props)) {
          selected.setAttribute(
            `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
            String(value),
          );
          const control: Control = {
            category: 'content',
            property: `variant.${key}`,
            label: `${component!.name} ${key}`,
            kind: 'text',
            value: '',
            read: () => selected?.getAttribute(`data-${key}`) ?? '',
            apply: () => {},
          };
          void record(control, '', String(value), selected, `Set ${variant.name} variant`);
        }
        showToast(`${variant.name} variant previewed`);
      });
    });
    controlsRoot.querySelectorAll<HTMLButtonElement>('[data-layout-action]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!selected) return;
        const action = button.dataset.layoutAction;
        if (action === 'lock') {
          const control = controls.find((item) => item.property === 'aspectRatio');
          if (control)
            void applyControlValue(
              control,
              `${selected.offsetWidth} / ${selected.offsetHeight}`,
              'Lock aspect ratio',
            );
          return;
        }
        if (action === 'up' || action === 'down') {
          const control = simpleStyleControl(selected, 'order', 'Layer order', 'layout');
          const current = Number(control.read()) || 0;
          void applyControlValue(
            control,
            current + (action === 'up' ? -1 : 1),
            `Move layer ${action}`,
          );
          return;
        }
        if (action === 'tidy') void tidySelectedLayout();
      });
    });
    controlsRoot.querySelectorAll<HTMLButtonElement>('[data-type-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        const preset = button.dataset.typePreset;
        const values =
          preset === 'display'
            ? { fontSize: 48, lineHeight: '1.05', fontWeight: '650' }
            : preset === 'compact'
              ? { fontSize: 12, lineHeight: '1.3', fontWeight: '500' }
              : { fontSize: 16, lineHeight: '1.5', fontWeight: '400' };
        for (const [property, value] of Object.entries(values)) {
          const control = controls.find((item) => item.property === property);
          if (control) void applyControlValue(control, value, `Apply ${preset} type preset`);
        }
      });
    });
    controlsRoot.querySelectorAll<HTMLButtonElement>('[data-color-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const gradient = controls.find((item) => item.property === 'backgroundImage');
        if (!gradient) return;
        if (button.dataset.colorAction === 'clear') {
          const fill = controls.find((item) => item.property === 'backgroundColor');
          if (fill) void applyControlValue(fill, 'transparent', 'Clear fill color');
          void applyControlValue(gradient, 'none', 'Clear fill gradient');
          return;
        }
        void applyControlValue(
          gradient,
          'linear-gradient(135deg, currentColor 0%, transparent 100%)',
          'Add linear gradient',
        );
      });
    });
  }

  async function tidySelectedLayout(): Promise<void> {
    if (!selected) return;
    const spacingTokens = (designGraph?.tokens ?? []).filter(
      (token) => token.category === 'spacing',
    );
    const properties = ['gap', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
    for (const property of properties) {
      const control = selectedControls.find((item) => item.property === property);
      if (!control) continue;
      const nearest = nearestNumericToken(Number(control.read()), spacingTokens);
      if (nearest) await applyControlValue(control, nearest.value, `Tidy with ${nearest.name}`);
    }
    showToast(
      spacingTokens.length
        ? 'Layout aligned to project spacing'
        : 'Add spacing tokens to use tidy layout',
    );
  }

  function rawElementValue(
    element: HTMLElement,
    property: string,
    value: string | number,
    unit?: string,
  ): void {
    if (property === 'domOrder') {
      const parent = element.parentElement;
      if (!parent) return;
      const siblings = [...parent.children].filter((item) => item !== element);
      const index = Math.max(0, Math.min(Number(value), siblings.length));
      parent.insertBefore(element, siblings[index] ?? null);
    } else if (property === 'rotate') element.style.rotate = `${value}${unit ?? 'deg'}`;
    else if (property === 'scaleX' || property === 'scaleY') {
      const raw = getComputedStyle(element).scale;
      const parts = !raw || raw === 'none' ? [1, 1] : raw.split(/\s+/).map(numberFrom);
      const x = property === 'scaleX' ? Number(value) : (parts[0] ?? 1);
      const y = property === 'scaleY' ? Number(value) : (parts[1] ?? parts[0] ?? 1);
      element.style.scale = `${x} ${y}`;
    } else if (property === 'textContent') element.textContent = String(value);
    else if (['aria-label', 'role', 'tabindex', 'alt', 'src'].includes(property))
      element.setAttribute(property, String(value));
    else {
      const cssProperty = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      element.style.setProperty(cssProperty, `${value}${unit ?? ''}`);
    }
  }

  function previewChangeTarget(change: any): HTMLElement | null {
    return resolveFoundrySelector(document, String(change.target?.locator?.selector ?? ''));
  }

  function canRestorePreviewChange(change: any, element: HTMLElement): boolean {
    const motionKeyframe = /^motion\.(motion_[a-z0-9]+)\.keyframe\.(\d+)\.(.+)$/.exec(
      String(change.property),
    );
    if (motionKeyframe) {
      return Boolean(findDiscoveredMotion(element, motionKeyframe[1]!)?.animation?.effect);
    }
    const motion =
      /^motion\.(motion_[a-z0-9]+)\.(duration|delay|easing|iterations|direction|fill)$/.exec(
        String(change.property),
      );
    if (motion) {
      return Boolean(findDiscoveredMotion(element, motion[1]!)?.animation?.effect);
    }
    return true;
  }

  function setPreviewChangeValue(change: any, element: HTMLElement, value: string | number): void {
    const property = String(change.property);
    const motionKeyframe = /^motion\.(motion_[a-z0-9]+)\.keyframe\.(\d+)\.(.+)$/.exec(property);
    if (motionKeyframe) {
      const discovered = findDiscoveredMotion(element, motionKeyframe[1]!);
      const effect = discovered?.animation?.effect as KeyframeEffect | null;
      if (!effect) throw new Error('The edited motion is not currently rendered.');
      effect.setKeyframes(
        editableKeyframes(
          updateMotionKeyframe(
            motionKeyframes(effect),
            Number(motionKeyframe[2]),
            motionKeyframe[3]!,
            value,
          ),
        ),
      );
    } else {
      const motion =
        /^motion\.(motion_[a-z0-9]+)\.(duration|delay|easing|iterations|direction|fill)$/.exec(
          property,
        );
      if (motion) {
        const discovered = findDiscoveredMotion(element, motion[1]!);
        const effect = discovered?.animation?.effect as KeyframeEffect | null;
        if (!effect) throw new Error('The edited motion is not currently rendered.');
        if (motion[2] === 'easing') applyMotionEasingValue(effect, value);
        else effect.updateTiming({ [motion[2]!]: value });
      } else {
        if (['aria-label', 'role', 'tabindex', 'alt', 'src'].includes(property) && value === '') {
          element.removeAttribute(property);
        } else {
          rawElementValue(element, property, value, change.unit);
        }
      }
    }
  }

  function restorePreviewChange(change: any, element: HTMLElement): void {
    setPreviewChangeValue(change, element, change.before);
    previewHistory.splice(
      0,
      previewHistory.length,
      ...previewHistory.filter(
        (entry) => entry.element !== element || entry.property !== String(change.property),
      ),
    );
    historyCursor = previewHistory.length;
    updateHistoryActions();
    updateOutline();
    if (selected === element) {
      selectedControls = controlsFor(element);
      renderControls();
    }
    if (!healthPanel.hidden) scanDesignHealth();
    publishWorkspaceState();
  }

  function previewHistoryCategory(change: any): Category {
    if (change.category === 'effect') return 'effects';
    if (
      change.category === 'layout' ||
      change.category === 'typography' ||
      change.category === 'color' ||
      change.category === 'content' ||
      change.category === 'accessibility' ||
      change.category === 'motion'
    ) {
      return change.category;
    }
    return 'content';
  }

  function applyDesignBranch(
    previousChanges: any[],
    nextChanges: any[],
    trackHistory: boolean,
  ): void {
    for (let index = previousChanges.length - 1; index >= 0; index -= 1) {
      const change = previousChanges[index];
      const element = previewChangeTarget(change);
      if (element && canRestorePreviewChange(change, element)) {
        setPreviewChangeValue(change, element, change.before);
      }
    }
    const nextHistory: HistoryEntry[] = [];
    for (const change of nextChanges) {
      const element = previewChangeTarget(change);
      if (!element || !canRestorePreviewChange(change, element)) continue;
      setPreviewChangeValue(change, element, change.after);
      if (trackHistory) {
        nextHistory.push({
          element,
          property: String(change.property),
          before: change.before,
          after: change.after,
          unit: change.unit,
          category: previewHistoryCategory(change),
          label: `Adjust ${String(change.property)}`,
        });
      }
    }
    previewHistory.splice(0, previewHistory.length, ...nextHistory);
    historyCursor = previewHistory.length;
    updateHistoryActions();
    updateOutline();
    if (selected) {
      selectedControls = controlsFor(selected);
      renderControls();
    }
    if (!healthPanel.hidden) scanDesignHealth();
    publishWorkspaceState();
  }

  async function deleteReviewChange(changeId: string): Promise<any> {
    if (!changeId) throw new Error('Foundry could not identify this change.');
    const payload = activeReviewPayload ?? (await sessionRequest());
    const change = payload.changeSet?.changes?.find((item: any) => item.id === changeId);
    if (!change) throw new Error('This change is no longer available.');
    const element = previewChangeTarget(change);
    if (!element) throw new Error('The edited element is not currently rendered.');
    if (!canRestorePreviewChange(change, element)) {
      throw new Error('The original value cannot be restored until this element is rendered.');
    }
    const updated = await sessionRequest(`/changes/${encodeURIComponent(changeId)}`, {
      method: 'DELETE',
    });
    restorePreviewChange(updated.removedChange ?? change, element);
    activeReviewPayload = updated;
    return updated;
  }

  function rawHistoryValue(entry: HistoryEntry, value: string | number): void {
    if (entry.inspectorRestore) {
      entry.inspectorRestore[String(value) === String(entry.before) ? 'before' : 'after']();
      return;
    }
    rawElementValue(entry.element, entry.property, value, entry.unit);
  }

  function applyAfterPreviewToFrame(frame: HTMLIFrameElement): void {
    let frameDocument: Document | null = null;
    try {
      frameDocument = frame.contentDocument;
    } catch {
      showToast('This application blocks side-by-side framing');
    }
    if (!frameDocument) return;
    for (let index = 0; index < historyCursor; index += 1) {
      const entry = previewHistory[index];
      if (!entry) continue;
      const element = resolveFoundrySelector(frameDocument, foundrySelector(entry.element));
      if (element) rawElementValue(element, entry.property, entry.after, entry.unit);
    }
  }

  function openSplitComparison(): void {
    if (!historyCursor) {
      showToast('Make a preview change before comparing');
      return;
    }
    comparisonStage.hidden = false;
    const url = new URL(location.href);
    url.searchParams.set('__foundry_child', '1');
    const beforeFrame = comparisonStage.querySelector<HTMLIFrameElement>(
      '[data-comparison-before]',
    )!;
    const afterFrame = comparisonStage.querySelector<HTMLIFrameElement>('[data-comparison-after]')!;
    beforeFrame.src = url.href;
    afterFrame.onload = () => applyAfterPreviewToFrame(afterFrame);
    afterFrame.src = url.href;
  }

  function closeSplitComparison(): void {
    comparisonStage.hidden = true;
  }

  function showComparison(mode: 'before' | 'after'): void {
    if (!historyCursor) {
      showToast('Make a preview change before comparing');
      return;
    }
    comparisonActive = true;
    workspaceState = updateWorkspace(workspaceState, {
      type: 'set-comparison',
      open: true,
    });
    trayCompare.classList.add('active');
    compareBar.hidden = false;
    compareBar.querySelector<HTMLInputElement>('[data-compare-scrub]')!.value =
      mode === 'before' ? '0' : '100';
    compareBar
      .querySelectorAll<HTMLButtonElement>('[data-compare]')
      .forEach((button) => button.classList.toggle('active', button.dataset.compare === mode));
    if (mode === 'before') {
      for (let index = historyCursor - 1; index >= 0; index -= 1) {
        const entry = previewHistory[index];
        if (entry) rawHistoryValue(entry, entry.before);
      }
    } else {
      for (let index = 0; index < historyCursor; index += 1) {
        const entry = previewHistory[index];
        if (entry) rawHistoryValue(entry, entry.after);
      }
    }
    updateOutline();
    if (selected) {
      selectedControls = controlsFor(selected);
      renderControls();
    }
  }

  function scrubComparison(percent: number): void {
    if (!historyCursor) return;
    comparisonActive = true;
    compareBar.hidden = false;
    const progress = Math.max(0, Math.min(1, percent / 100));
    for (let index = 0; index < historyCursor; index += 1) {
      const entry = previewHistory[index];
      if (!entry) continue;
      const before = Number(entry.before);
      const after = Number(entry.after);
      const value =
        Number.isFinite(before) && Number.isFinite(after)
          ? before + (after - before) * progress
          : progress < 0.5
            ? entry.before
            : entry.after;
      rawHistoryValue(entry, value);
    }
    compareBar
      .querySelectorAll<HTMLButtonElement>('[data-compare]')
      .forEach((button) =>
        button.classList.toggle(
          'active',
          (percent === 0 && button.dataset.compare === 'before') ||
            (percent === 100 && button.dataset.compare === 'after'),
        ),
      );
    updateOutline();
  }

  const comparisonOpacity = new Map<HTMLElement, string>();
  function toggleComparisonIsolation(): void {
    const button = compareBar.querySelector<HTMLButtonElement>('[data-compare="isolate"]')!;
    if (isolatedComparisonElement) {
      for (const [element, opacity] of comparisonOpacity) element.style.opacity = opacity;
      comparisonOpacity.clear();
      isolatedComparisonElement = null;
      button.classList.remove('active');
      return;
    }
    if (!selected) return;
    isolatedComparisonElement = selected;
    for (const element of [...document.body.querySelectorAll<HTMLElement>('*')]) {
      if (
        element === host ||
        host.contains(element) ||
        element === selected ||
        element.contains(selected) ||
        selected.contains(element)
      )
        continue;
      comparisonOpacity.set(element, element.style.opacity);
      element.style.opacity = '0.12';
    }
    button.classList.add('active');
  }

  async function resetSelectedPreview(): Promise<void> {
    if (!selected) return;
    const target = selected;
    const entries = previewHistory.filter((entry) => entry.element === target);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry) rawHistoryValue(entry, entry.before);
    }
    previewHistory.splice(
      0,
      previewHistory.length,
      ...previewHistory.filter((entry) => entry.element !== target),
    );
    historyCursor = previewHistory.length;
    if (sessionId && token) {
      const payload = await sessionRequest();
      const targetIdentifier = foundryTargetId(target);
      const targetChanges = payload.changeSet.changes.filter(
        (change: any) => change.target.id === targetIdentifier,
      );
      for (const change of targetChanges) {
        await sessionRequest(`/changes/${encodeURIComponent(change.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'rejected' }),
        });
      }
      await hydrateSession();
    }
    selectedControls = controlsFor(target);
    updateHistoryActions();
    updateOutline();
    renderControls();
    if (!healthPanel.hidden) scanDesignHealth();
    showToast('Element preview reset');
  }

  function closeComparison(): void {
    if (isolatedComparisonElement) toggleComparisonIsolation();
    showComparison('after');
    comparisonActive = false;
    workspaceState = updateWorkspace(workspaceState, {
      type: 'set-comparison',
      open: false,
    });
    trayCompare.classList.remove('active');
    compareBar.hidden = true;
  }

  const commands = [
    {
      id: 'health',
      label: 'Scan design health',
      shortcut: '⇧H',
      icon: 'activity',
    },
    { id: 'layers', label: 'Open layers', shortcut: '⇧L', icon: 'layers-3' },
    {
      id: 'components',
      label: 'Open component workshop',
      shortcut: '⇧K',
      icon: 'component',
    },
    {
      id: 'compare',
      label: 'Compare before and after',
      shortcut: '⇧C',
      icon: 'contrast',
    },
    {
      id: 'workbench',
      label: 'Open state workbench',
      shortcut: '',
      icon: 'panels-top-left',
    },
    {
      id: 'memory',
      label: 'Open design memory',
      shortcut: '',
      icon: 'bookmark',
    },
    {
      id: 'recipe',
      label: 'Save selected treatment',
      shortcut: '',
      icon: 'save',
    },
    {
      id: 'tidy',
      label: 'Tidy selected layout',
      shortcut: '',
      icon: 'wand-sparkles',
    },
    {
      id: 'parent',
      label: 'Select parent layer',
      shortcut: '[',
      icon: 'chevron-right',
    },
    {
      id: 'child',
      label: 'Select child layer',
      shortcut: ']',
      icon: 'chevron-down',
    },
    { id: 'undo', label: 'Undo preview', shortcut: '⌘Z', icon: 'undo-2' },
    { id: 'redo', label: 'Redo preview', shortcut: '⇧⌘Z', icon: 'redo-2' },
    { id: 'review', label: 'Review changes', shortcut: '', icon: 'file-text' },
  ];

  let commandReturnFocus: HTMLElement | null = null;

  function closeCommands(restoreFocus = true): void {
    commandPalette.hidden = true;
    if (restoreFocus && commandReturnFocus?.isConnected) commandReturnFocus.focus();
    commandReturnFocus = null;
  }

  function runCommand(id: string): void {
    closeCommands(false);
    if (id === 'health') openHealth();
    if (id === 'layers') toggleLayers(true);
    if (id === 'components') openComponentWorkshop();
    if (id === 'compare') showComparison('after');
    if (id === 'workbench') openWorkbench();
    if (id === 'memory') openDesignMemory();
    if (id === 'recipe') saveSelectedRecipe();
    if (id === 'tidy') void tidySelectedLayout();
    if (id === 'parent') {
      const parent = nearestLayerParent(selected);
      if (parent) select(parent);
    }
    if (id === 'child') {
      const child = firstLayerChild(selected);
      if (child) select(child);
    }
    if (id === 'undo') void replayHistory(-1);
    if (id === 'redo') void replayHistory(1);
    if (id === 'review') void openReview();
  }

  function renderCommands(queryValue = ''): void {
    const normalized = queryValue.trim().toLowerCase();
    const filtered = commands.filter((command) => command.label.toLowerCase().includes(normalized));
    commandPalette.querySelector<HTMLElement>('.command-list')!.innerHTML = filtered.length
      ? filtered
          .map(
            (command, index) =>
              `<button class="command-item ${index === 0 ? 'active' : ''}" data-command="${command.id}"><i data-foundry-icon="${command.icon}"></i><span>${command.label}</span><small>${command.shortcut}</small></button>`,
          )
          .join('')
      : '<div class="layers-empty">No commands match.</div>';
    renderIcons(commandPalette);
    commandPalette
      .querySelectorAll<HTMLButtonElement>('[data-command]')
      .forEach((button) =>
        button.addEventListener('click', () => runCommand(button.dataset.command!)),
      );
  }

  function openCommands(): void {
    commandReturnFocus = shadow.activeElement as HTMLElement | null;
    commandPalette.hidden = false;
    const input = commandPalette.querySelector<HTMLInputElement>('input')!;
    input.value = '';
    renderCommands();
    input.focus();
  }

  function durationMilliseconds(value: string): number {
    return Math.max(
      0,
      ...value.split(',').map((part) => {
        const normalized = part.trim();
        const amount = Number.parseFloat(normalized);
        if (!Number.isFinite(amount)) return 0;
        return normalized.endsWith('ms') ? amount : amount * 1000;
      }),
    );
  }

  function isInteractiveElement(element: HTMLElement): boolean {
    return (
      ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'].includes(element.tagName) ||
      ['button', 'link', 'checkbox', 'menuitem', 'option', 'radio', 'switch', 'tab'].includes(
        element.getAttribute('role') ?? '',
      ) ||
      element.tabIndex >= 0
    );
  }

  function accessibleName(element: HTMLElement): string {
    const labelledBy = element.getAttribute('aria-labelledby');
    const labelledText = labelledBy
      ?.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    if (labelledText) return labelledText;
    if (element instanceof HTMLInputElement && element.labels?.length) {
      return [...element.labels]
        .map((label) => label.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
    }
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[aria-hidden="true"]').forEach((item) => item.remove());
    return (
      element.getAttribute('aria-label') ||
      element.getAttribute('alt') ||
      element.getAttribute('title') ||
      clone.textContent?.trim() ||
      ''
    );
  }

  function hasReducedMotionRule(element: HTMLElement): boolean {
    const inspectRules = (rules: CSSRuleList, insideReducedMotion = false): boolean => {
      for (const rule of [...rules]) {
        if (rule instanceof CSSMediaRule) {
          const reduced =
            insideReducedMotion || rule.conditionText.includes('prefers-reduced-motion');
          if (inspectRules(rule.cssRules, reduced)) return true;
          continue;
        }
        if (!insideReducedMotion || !(rule instanceof CSSStyleRule)) continue;
        try {
          if (element.matches(rule.selectorText)) return true;
        } catch {
          // Unsupported selectors cannot prove reduced-motion coverage.
        }
      }
      return false;
    };
    for (const sheet of [...document.styleSheets]) {
      try {
        if (inspectRules(sheet.cssRules)) return true;
      } catch {
        // Cross-origin styles cannot be inspected safely.
      }
    }
    return false;
  }

  function accessibleTextColor(
    element: HTMLElement,
    backgroundColor: string,
  ): { value: string; token?: string } | undefined {
    const style = getComputedStyle(element);
    const threshold = textContrastThreshold(
      Number.parseFloat(style.fontSize),
      Number.parseFloat(style.fontWeight),
    );
    const tokenCandidates = (designGraph?.tokens ?? [])
      .filter((token) => token.category === 'color')
      .map((token) => ({
        value: token.value,
        token: token.name,
        ratio: contrastRatio(token.value, backgroundColor),
      }))
      .filter(
        (candidate): candidate is { value: string; token: string; ratio: number } =>
          candidate.ratio != null && candidate.ratio >= threshold,
      )
      .sort((first, second) => first.ratio - second.ratio);
    if (tokenCandidates[0]) return tokenCandidates[0];
    const fallback = ['#111111', '#ffffff']
      .map((value) => ({
        value,
        ratio: contrastRatio(value, backgroundColor) ?? 0,
      }))
      .sort((first, second) => second.ratio - first.ratio)[0];
    return fallback && fallback.ratio >= threshold ? { value: fallback.value } : undefined;
  }

  function keyboardReachable(element: HTMLElement): boolean {
    if (element.getAttribute('aria-disabled') === 'true') return false;
    if (
      (element instanceof HTMLButtonElement ||
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement) &&
      element.disabled
    )
      return false;
    return element.tabIndex >= 0;
  }

  function visibleFocusTreatment(element: HTMLElement): boolean | undefined {
    if (!activeStressConditions.includes('keyboard-only') || !keyboardReachable(element))
      return undefined;
    const previousFocus = document.activeElement as HTMLElement | null;
    element.blur();
    const before = getComputedStyle(element);
    const baseline = {
      outlineStyle: before.outlineStyle,
      outlineWidth: before.outlineWidth,
      boxShadow: before.boxShadow,
      borderColor: before.borderColor,
      backgroundColor: before.backgroundColor,
    };
    element.focus({ preventScroll: true, focusVisible: true } as FocusOptions & {
      focusVisible: boolean;
    });
    const forcedFocusVisible = element.matches(':focus-visible');
    const focused = getComputedStyle(element);
    const outlineVisible =
      focused.outlineStyle !== 'none' && Number.parseFloat(focused.outlineWidth) > 0;
    const treatmentChanged =
      focused.boxShadow !== baseline.boxShadow ||
      focused.borderColor !== baseline.borderColor ||
      focused.backgroundColor !== baseline.backgroundColor ||
      focused.outlineStyle !== baseline.outlineStyle ||
      focused.outlineWidth !== baseline.outlineWidth;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    else element.blur();
    const treatmentVisible = outlineVisible || treatmentChanged;
    return forcedFocusVisible ? treatmentVisible : treatmentVisible || undefined;
  }

  function resolveActiveStressTarget(): HTMLElement | null {
    if (!activeStressTarget) return selected?.isConnected ? selected : null;
    return activeStressTarget.element.isConnected ? activeStressTarget.element : null;
  }

  function belongsToHealthRoot(element: HTMLElement, root: HTMLElement): boolean {
    let candidate: HTMLElement | null = element;
    while (candidate) {
      if (candidate === root) return true;
      candidate = composedParent(candidate);
    }
    return false;
  }

  function scanDesignHealth(): void {
    const spacingTokens = (designGraph?.tokens ?? []).filter(
      (token) => token.category === 'spacing',
    );
    const nextIssues: BrowserHealthIssue[] = [];
    const healthScope = designHealthScope(activeStressConditions, activeStressScope);
    const healthRoot = healthScope === 'selection' ? resolveActiveStressTarget() : null;
    healthScanError =
      healthScope === 'selection' && !healthRoot
        ? 'The selected stress target is no longer available. Clear the test and select it again.'
        : '';
    const elements = collectLayerElements(document)
      .filter(
        (element) =>
          element.getAttribute('aria-hidden') !== 'true' &&
          isVisibleLayer(element) &&
          element !== document.documentElement &&
          element !== document.body &&
          (healthScope === 'canvas' || (healthRoot && belongsToHealthRoot(element, healthRoot))),
      )
      .slice(0, 10_000);
    for (const element of elements) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const backgroundColor = opaqueBackground(element);
      const animationDuration = durationMilliseconds(style.animationDuration);
      const transitionDuration = durationMilliseconds(style.transitionDuration);
      const interactive = isInteractiveElement(element);
      const keyboardCandidate =
        interactive &&
        element.getAttribute('aria-disabled') !== 'true' &&
        !(
          (element instanceof HTMLButtonElement ||
            element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement) &&
          element.disabled
        );
      const findings = auditHealthSnapshot({
        hasVisibleText: Boolean(directText(element)),
        color: style.color,
        backgroundColor,
        fontSize: Number.parseFloat(style.fontSize) || 16,
        fontWeight: Number.parseFloat(style.fontWeight) || 400,
        interactive,
        targetSizeEligible:
          interactive &&
          !(element.tagName === 'A' && ['inline', 'contents'].includes(style.display)),
        accessibleName: accessibleName(element),
        keyboardCandidate,
        keyboardReachable: keyboardCandidate ? keyboardReachable(element) : false,
        positiveTabIndex: element.tabIndex > 0,
        focusIndicatorVisible: keyboardCandidate ? visibleFocusTreatment(element) : undefined,
        imageElement: element instanceof HTMLImageElement,
        imageHasAlternative:
          !(element instanceof HTMLImageElement) ||
          element.hasAttribute('alt') ||
          Boolean(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby')),
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        motionDuration: Math.max(animationDuration, transitionDuration),
        reducedMotionProtected:
          Math.max(animationDuration, transitionDuration) <= 300 || hasReducedMotionRule(element),
        layoutMode: style.display,
        gap: Number.parseFloat(style.gap) || 0,
        spacingTokens,
        contrastFix: accessibleTextColor(element, backgroundColor),
      });
      for (const finding of findings) {
        const id = `${foundrySelector(element)}:${finding.ruleId}`;
        const previousIssue = healthIssues.find((issue) => issue.id === id);
        nextIssues.push({
          ...finding,
          id,
          element,
          elementLabel: layerLabel(element),
          previewed: previousIssue?.previewed ?? false,
          recordedBranchId: previousIssue?.recordedBranchId,
          recordedBranchName: previousIssue?.recordedBranchName,
          source: element.dataset.foundrySource ?? undefined,
          stressConditions: [...activeStressConditions],
        });
      }
    }
    healthIssues = nextIssues;
    healthScannedAt = new Date().toISOString();
    renderHealthPanel();
  }

  function scanDesignHealthOrThrow(): number {
    scanDesignHealth();
    publishWorkspaceState();
    if (healthScanError) throw new Error(healthScanError);
    return healthIssues.length;
  }

  function renderHealthPanel(): void {
    const visibleIssues = healthIssues.filter((issue) => !ignoredHealthIssues.has(issue.id));
    const filtered = visibleIssues.filter(
      (issue) => healthFilter === 'all' || issue.severity === healthFilter,
    );
    const score = healthScore(visibleIssues);
    const scoreColor = score >= 90 ? '#2b9a76' : score >= 70 ? '#d69b3c' : '#d15d43';
    healthSummary.innerHTML = `<div class="health-score" style="--score:${healthScanError ? 0 : score};--score-color:${healthScanError ? '#d69b3c' : scoreColor}"><strong>${healthScanError ? '–' : score}</strong></div><div class="health-summary-copy"><strong>${healthScanError ? 'Selection unavailable' : visibleIssues.length ? `${visibleIssues.length} issue${visibleIssues.length === 1 ? '' : 's'} found` : 'No issues found'}</strong><span>${healthScanError || (visibleIssues.length ? 'Review evidence before previewing a correction.' : 'The current viewport passed this health scan.')}</span></div>`;
    healthStress.innerHTML = `<div class="health-stress-head"><strong>Temporary stress</strong><span>${activeStressConditions.length ? `${activeStressConditions.length} active` : 'Preview only'}</span></div><div class="health-stress-scope" role="group" aria-label="Stress test scope"><button class="${stressDraftScope === 'selection' ? 'active' : ''}" data-health-stress-scope="selection" aria-pressed="${stressDraftScope === 'selection'}">Selection</button><button class="${stressDraftScope === 'canvas' ? 'active' : ''}" data-health-stress-scope="canvas" aria-pressed="${stressDraftScope === 'canvas'}">Canvas</button></div><div class="health-stress-options">${STRESS_CONDITIONS.map((condition) => `<button class="${stressDraftConditions.includes(condition.id) ? 'active' : ''}" data-health-stress-condition="${condition.id}" aria-pressed="${stressDraftConditions.includes(condition.id)}" title="${escapeHtml(condition.description)}">${escapeHtml(condition.label)}</button>`).join('')}</div><div class="health-stress-actions"><button data-health-stress-clear>Clear</button><button data-health-stress-apply ${stressDraftConditions.length ? '' : 'disabled'}>Apply and scan</button></div>`;
    const filters = ['all', 'high', 'medium', 'low'];
    healthFilters.innerHTML = filters
      .map((filter) => {
        const count =
          filter === 'all'
            ? visibleIssues.length
            : visibleIssues.filter((issue) => issue.severity === filter).length;
        const label = filter === 'all' ? 'All' : `${filter[0]?.toUpperCase()}${filter.slice(1)}`;
        return `<button class="${healthFilter === filter ? 'active' : ''}" data-health-filter="${filter}" aria-pressed="${healthFilter === filter}">${label} ${count}</button>`;
      })
      .join('');
    healthList.innerHTML = filtered.length
      ? filtered
          .map(
            (issue) =>
              `<article class="health-card" data-health-issue="${escapeHtml(issue.id)}"><div class="health-card-top"><span class="health-severity ${issue.severity}"></span><strong>${escapeHtml(issue.title)}</strong><span>${escapeHtml(issue.severity)}</span></div><p>${escapeHtml(issue.description)}</p><div class="health-evidence"><strong>${escapeHtml(issue.elementLabel)}</strong><br/>${escapeHtml(issue.evidence)}</div><div class="health-actions"><button data-health-select="${escapeHtml(issue.id)}">Select</button><button class="health-ignore" data-health-ignore="${escapeHtml(issue.id)}">Ignore</button>${issue.fix ? `<button class="health-fix ${issue.previewed ? 'previewed' : ''}" data-health-fix="${escapeHtml(issue.id)}" ${issue.previewed ? 'disabled' : ''}>${issue.previewed ? `<i data-foundry-icon="check"></i> ${issue.recordedBranchId ? 'Saved to direction' : 'Added to review'}` : escapeHtml(issue.fix.label)}</button>` : ''}</div></article>`,
          )
          .join('')
      : `<div class="health-empty"><i data-foundry-icon="${healthScanError || visibleIssues.length ? 'triangle-alert' : 'check'}"></i>${healthScanError || (visibleIssues.length ? 'No issues match this filter.' : 'This viewport is looking healthy.')}</div>`;
    const ignoredCount = healthIssues.filter((issue) => ignoredHealthIssues.has(issue.id)).length;
    const ignoredButton = shadow.querySelector<HTMLButtonElement>('.health-show-ignored')!;
    ignoredButton.hidden = ignoredCount === 0;
    ignoredButton.textContent = `Restore ${ignoredCount} ignored`;
    renderIcons(healthPanel);
    healthStress
      .querySelectorAll<HTMLButtonElement>('[data-health-stress-scope]')
      .forEach((button) =>
        button.addEventListener('click', () => {
          stressDraftScope = button.dataset.healthStressScope === 'canvas' ? 'canvas' : 'selection';
          renderHealthPanel();
        }),
      );
    healthStress
      .querySelectorAll<HTMLButtonElement>('[data-health-stress-condition]')
      .forEach((button) =>
        button.addEventListener('click', () => {
          const id = button.dataset.healthStressCondition as StressConditionId;
          const definition = STRESS_CONDITIONS.find((condition) => condition.id === id);
          if (stressDraftConditions.includes(id)) {
            stressDraftConditions = stressDraftConditions.filter((condition) => condition !== id);
          } else {
            if (definition?.combination === 'state') {
              const stateIds = new Set(
                STRESS_CONDITIONS.filter((condition) => condition.combination === 'state').map(
                  (condition) => condition.id,
                ),
              );
              stressDraftConditions = stressDraftConditions.filter(
                (condition) => !stateIds.has(condition),
              );
            }
            stressDraftConditions = [...stressDraftConditions, id];
          }
          renderHealthPanel();
        }),
      );
    healthStress
      .querySelector<HTMLButtonElement>('[data-health-stress-clear]')
      ?.addEventListener('click', () => {
        stressDraftConditions = [];
        restoreStressConditions();
      });
    healthStress
      .querySelector<HTMLButtonElement>('[data-health-stress-apply]')
      ?.addEventListener('click', () => {
        if (stressDraftScope === 'selection' && !selected?.isConnected) {
          showToast('Select a layer before applying selection stress');
          return;
        }
        try {
          applyStressConditions(stressDraftConditions, stressDraftScope);
          showToast('Temporary stress applied and measured');
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Could not apply temporary stress');
        }
      });
    healthFilters.querySelectorAll<HTMLButtonElement>('[data-health-filter]').forEach((button) =>
      button.addEventListener('click', () => {
        healthFilter = button.dataset.healthFilter ?? 'all';
        renderHealthPanel();
      }),
    );
    healthList.querySelectorAll<HTMLButtonElement>('[data-health-select]').forEach((button) =>
      button.addEventListener('click', () => {
        const issue = healthIssues.find((item) => item.id === button.dataset.healthSelect);
        if (!issue) return;
        select(issue.element);
        issue.element.scrollIntoView({ block: 'center', inline: 'center' });
      }),
    );
    healthList.querySelectorAll<HTMLButtonElement>('[data-health-ignore]').forEach((button) =>
      button.addEventListener('click', () => {
        const id = button.dataset.healthIgnore;
        if (!id) return;
        ignoredHealthIssues.add(id);
        try {
          localStorage.setItem(
            '__foundry_health_ignored',
            JSON.stringify([...ignoredHealthIssues]),
          );
        } catch {
          // Ignore persistence failures while keeping the current session usable.
        }
        renderHealthPanel();
      }),
    );
    healthList.querySelectorAll<HTMLButtonElement>('[data-health-fix]').forEach((button) =>
      button.addEventListener('click', () => {
        const issue = healthIssues.find((item) => item.id === button.dataset.healthFix);
        if (issue && !issue.previewed)
          void previewHealthFix(issue).catch((error) => {
            showToast(error instanceof Error ? error.message : 'Could not record this correction');
          });
      }),
    );
  }

  function healthCategory(category: HealthFinding['category']): Category {
    if (category === 'contrast') return 'color';
    if (category === 'accessibility' || category === 'target-size') return 'accessibility';
    if (category === 'motion') return 'motion';
    return 'layout';
  }

  function healthChangeLabel(change: HealthFixChange): string {
    return change.property
      .replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
      .replace(/^./, (letter) => letter.toUpperCase());
  }

  async function previewHealthFix(issue: BrowserHealthIssue): Promise<void> {
    if (!issue.fix || !issue.element.isConnected)
      throw new Error('This correction is no longer available. Run the check again.');
    let recordedCorrections = 0;
    for (const change of issue.fix.changes) {
      const control = simpleStyleControl(
        issue.element,
        change.property,
        healthChangeLabel(change),
        healthCategory(issue.category),
        change.unit,
      );
      const before = control.read();
      const cssProperty = change.property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      const originalValue = issue.element.style.getPropertyValue(cssProperty);
      const originalPriority = issue.element.style.getPropertyPriority(cssProperty);
      // Computed values can still be at their transition's starting point.
      // Review records the explicit correction, not an intermediate rendered frame.
      const after = change.value;
      control.apply(after);
      const recorded = await record(
        control,
        before,
        after,
        issue.element,
        `Design health: ${issue.title}`,
        [],
        {
          requireRecordedChange: true,
          onRecorded: (destination) => {
            issue.recordedBranchId = destination.branchId;
            issue.recordedBranchName = destination.branchName;
          },
        },
      );
      if (!recorded) {
        if (originalValue)
          issue.element.style.setProperty(cssProperty, originalValue, originalPriority);
        else issue.element.style.removeProperty(cssProperty);
        updateOutline();
        renderHealthPanel();
        publishWorkspaceState();
        throw new Error(
          recordedCorrections
            ? `${recordedCorrections} correction(s) are saved, but the next correction could not be recorded. Its preview was restored. Check the connection before trying again.`
            : 'This correction could not be saved. Its preview was restored. Check the connection before trying again.',
        );
      }
      recordedCorrections += 1;
      pushHistory({
        element: issue.element,
        property: change.property,
        before,
        after,
        unit: change.unit,
        category: control.category,
        label: control.label,
      });
    }
    issue.previewed = true;
    select(issue.element);
    updateOutline();
    renderHealthPanel();
    showToast(
      issue.recordedBranchId
        ? `Health correction saved to direction “${issue.recordedBranchName ?? issue.recordedBranchId}”. Promote the direction to add it to Review.`
        : 'Health correction added to review',
    );
  }

  function openHealth(): void {
    if (workspaceState.utility !== 'health') setUtility('health');
  }

  function closeHealth(): void {
    if (workspaceState.utility === 'health') setUtility(null);
  }

  const previewLoopIterations = new WeakMap<Animation, number>();
  const previewMotionCurves = new WeakMap<Animation, MotionCurveSnapshot>();
  const motionComparisonBaselines = new WeakMap<
    Animation,
    {
      timing: DiscoveredMotion['descriptor']['timing'];
      keyframes: MotionKeyframe[];
      curve: MotionCurveSnapshot;
    }
  >();

  function ensureMotionComparisonBaseline(motion: DiscoveredMotion): void {
    const animation = motion.animation;
    if (!animation || motionComparisonBaselines.has(animation)) return;
    motionComparisonBaselines.set(animation, {
      timing: { ...motion.descriptor.timing },
      keyframes: motion.descriptor.keyframes.map((frame) => ({
        ...frame,
        values: { ...frame.values },
      })),
      curve:
        previewMotionCurves.get(animation) ?? motionCurveSnapshot(motion.descriptor.timing.easing),
    });
  }

  function requestedMotionCurve(payload: Record<string, unknown>): MotionCurve {
    const kind = String(payload.kind ?? 'cubic-bezier');
    if (kind === 'spring') {
      return normalizeSpring({
        mass: Number(payload.mass),
        stiffness: Number(payload.stiffness),
        damping: Number(payload.damping),
        velocity: Number(payload.velocity),
      });
    }
    return normalizeCubicBezier({
      x1: Number(payload.x1),
      y1: Number(payload.y1),
      x2: Number(payload.x2),
      y2: Number(payload.y2),
    });
  }

  function nativeMotionAuthoring(
    element: HTMLElement,
    motion: DiscoveredMotion,
  ): NativeMotionAuthoring | undefined {
    if (motion.descriptor.authoring) return motion.descriptor.authoring;
    const mappedElement = element.closest<HTMLElement>('[data-foundry-source]') ?? element;
    const source = parseSource(mappedElement.dataset.foundrySource);
    if (!source) return undefined;
    const sourceFile = source.file.replace(/^\.\//, '');
    const preset = (designGraph?.motionPresets ?? [])
      .filter((candidate) => candidate.adapter && candidate.adapter !== 'css' && candidate.source)
      .filter((candidate) => {
        const candidateFile = String(candidate.source.file ?? '').replace(/^\.\//, '');
        return candidateFile === sourceFile || candidateFile.endsWith(`/${sourceFile}`);
      })
      .sort(
        (left, right) =>
          Math.abs(Number(left.source.line ?? 0) - Number(source.line ?? 0)) -
          Math.abs(Number(right.source.line ?? 0) - Number(source.line ?? 0)),
      )[0];
    if (!preset) return undefined;
    const adapter = preset.adapter as NativeMotionAuthoring['adapter'];
    const base = String(preset.sourceProperty ?? (adapter === 'gsap' ? 'vars' : 'config'));
    const sourceProperties =
      adapter === 'react-spring'
        ? {
            duration: `${base}.duration`,
            delay: `${base}.delay`,
            easing: base,
            spring: base,
            keyframes: 'from / to',
          }
        : {
            duration: `${base}.duration`,
            delay: `${base}.delay`,
            easing: `${base}.${adapter === 'gsap' ? 'ease' : 'ease'}`,
            spring: `${base}.type`,
            keyframes: adapter === 'gsap' ? base : 'animate / variants',
          };
    return {
      adapter,
      label:
        adapter === 'motion' ? 'Motion for React' : adapter === 'gsap' ? 'GSAP' : 'React Spring',
      source: preset.source,
      sourceProperties,
      evidence: [
        ...(Array.isArray(preset.evidence) ? preset.evidence : []),
        `Project motion preset: ${preset.label}`,
      ],
    };
  }

  function motionSourceEvidence(
    element: HTMLElement | null,
    motion: DiscoveredMotion,
    property: string,
  ): string[] {
    if (!element) return [];
    const authoring = nativeMotionAuthoring(element, motion);
    if (!authoring) return [];
    const sourceProperty =
      authoring.sourceProperties[property] ?? authoring.sourceProperties.keyframes;
    return [
      `native adapter: ${authoring.label}`,
      ...(sourceProperty ? [`native source property: ${sourceProperty}`] : []),
      ...(authoring.source
        ? [`native source: ${authoring.source.file}:${authoring.source.line ?? 1}`]
        : []),
      ...authoring.evidence,
    ];
  }

  function workspaceMotionSnapshot(element: HTMLElement): Array<Record<string, unknown>> {
    return discoverElementMotion(element).map((motion) => {
      const { descriptor, animation } = motion;
      const authoring = nativeMotionAuthoring(element, motion);
      const curve =
        (animation && previewMotionCurves.get(animation)) ??
        motionCurveSnapshot(descriptor.timing.easing);
      const path = motionPathSnapshot(descriptor.keyframes);
      const baseline = animation ? motionComparisonBaselines.get(animation) : undefined;
      const beforeTiming = baseline?.timing ?? descriptor.timing;
      const beforeKeyframes = baseline?.keyframes ?? descriptor.keyframes;
      const beforeCurve = baseline?.curve ?? curve;
      const beforePath = motionPathSnapshot(beforeKeyframes);
      const changed = Boolean(
        baseline &&
        (JSON.stringify(beforeTiming) !== JSON.stringify(descriptor.timing) ||
          JSON.stringify(beforeKeyframes) !== JSON.stringify(descriptor.keyframes) ||
          beforeCurve.sourceValue !== curve.sourceValue),
      );
      return {
        id: descriptor.id,
        label: descriptor.label,
        kind:
          authoring?.adapter === 'motion'
            ? 'motion-react'
            : (authoring?.adapter ?? descriptor.kind),
        authoring,
        properties: descriptor.properties,
        timing: descriptor.timing,
        keyframes: descriptor.keyframes,
        performance: descriptor.performance,
        active: Boolean(animation?.effect),
        playState: animation?.playState ?? 'idle',
        currentTime: Math.max(0, Number(animation?.currentTime ?? 0)),
        playbackRate: animation?.playbackRate ?? 1,
        looping: Boolean(animation && previewLoopIterations.has(animation)),
        reducedMotionProtected: descriptor.timing.duration <= 300 || hasReducedMotionRule(element),
        curve,
        path,
        comparison: {
          changed,
          before: {
            timing: beforeTiming,
            keyframes: beforeKeyframes,
            curve: beforeCurve,
            path: beforePath,
          },
          after: {
            timing: descriptor.timing,
            keyframes: descriptor.keyframes,
            curve,
            path,
          },
          diagnostics: {
            durationDelta: descriptor.timing.duration - beforeTiming.duration,
            distanceDelta: path.distance - beforePath.distance,
            pointDelta: path.points.length - beforePath.points.length,
          },
        },
      };
    });
  }

  function applyMotionEasingValue(effect: KeyframeEffect, value: string | number): void {
    const sourceValue = String(value);
    const snapshot = motionCurveSnapshot(parseMotionCurve(sourceValue));
    setRenderedMotionEasing(effect, snapshot.previewValue);
  }

  async function applyMotionCurve(
    motion: DiscoveredMotion,
    requested: MotionCurve,
  ): Promise<{ applied: boolean; recorded: boolean }> {
    const animation = motion.animation;
    const effect = animation?.effect as KeyframeEffect | null;
    if (!animation || !effect) return { applied: false, recorded: false };
    ensureMotionComparisonBaseline(motion);
    const current = previewMotionCurves.get(animation);
    const before = current?.sourceValue ?? motion.descriptor.timing.easing;
    const snapshot = motionCurveSnapshot(requested);
    if (before === snapshot.sourceValue) return { applied: false, recorded: false };
    setRenderedMotionEasing(effect, snapshot.previewValue);
    previewMotionCurves.set(animation, snapshot);
    const applyValue = (value: string | number): void => {
      const next = motionCurveSnapshot(parseMotionCurve(String(value)));
      setRenderedMotionEasing(effect, next.previewValue);
      previewMotionCurves.set(animation, next);
    };
    const recorded = await record(
      {
        category: 'motion',
        property: `motion.${motion.descriptor.id}.easing`,
        label: requested.kind === 'spring' ? 'Spring easing' : 'Cubic Bezier easing',
        kind: 'text',
        value: before,
        read: () =>
          previewMotionCurves.get(animation)?.sourceValue ??
          String(effect.getTiming().easing ?? 'linear'),
        apply: applyValue,
      },
      before,
      snapshot.sourceValue,
      selected,
      requested.kind === 'spring'
        ? `Tune ${motion.descriptor.label} spring`
        : `Tune ${motion.descriptor.label} curve`,
      [
        'rendered timing function',
        requested.kind === 'spring' ? 'physical spring parameters' : 'cubic Bezier handles',
        `browser source: ${snapshot.sourceValue}`,
        ...motionSourceEvidence(
          selected,
          motion,
          requested.kind === 'spring' ? 'spring' : 'easing',
        ),
      ],
    );
    if (!recorded) applyValue(before);
    return { applied: true, recorded };
  }

  async function applyMotionTiming(
    motion: DiscoveredMotion,
    property: 'duration' | 'delay' | 'easing' | 'iterations' | 'direction' | 'fill',
    after: string | number,
  ): Promise<{ applied: boolean; recorded: boolean }> {
    const effect = motion.animation?.effect as KeyframeEffect | null;
    if (!effect) return { applied: false, recorded: false };
    ensureMotionComparisonBaseline(motion);
    const before =
      property === 'easing'
        ? motion.descriptor.timing.easing
        : (effect.getTiming()[property] as string | number);
    if (property === 'easing') applyMotionEasingValue(effect, after);
    else effect.updateTiming({ [property]: after });
    if (String(before) === String(after)) return { applied: false, recorded: false };
    const recorded = await record(
      {
        category: 'motion',
        property: `motion.${motion.descriptor.id}.${property}`,
        label: property === 'duration' ? 'Duration' : property === 'delay' ? 'Delay' : 'Easing',
        kind: ['easing', 'direction', 'fill'].includes(property) ? 'text' : 'number',
        value: before,
        unit: ['duration', 'delay'].includes(property) ? 'ms' : undefined,
        read: () => effect.getTiming()[property] as string | number,
        apply: (value) => {
          if (property === 'easing') applyMotionEasingValue(effect, value);
          else effect.updateTiming({ [property]: value });
        },
      },
      before,
      after,
      selected,
      `Adjust ${motion.descriptor.label} ${property}`,
      motionSourceEvidence(selected, motion, property),
    );
    if (!recorded) {
      if (property === 'easing') applyMotionEasingValue(effect, before);
      else effect.updateTiming({ [property]: before });
    }
    return { applied: true, recorded };
  }

  async function applyMotionKeyframe(
    motion: DiscoveredMotion,
    index: number,
    property: string,
    after: string | number,
  ): Promise<{ applied: boolean; recorded: boolean }> {
    const effect = motion.animation?.effect as KeyframeEffect | null;
    if (!effect) return { applied: false, recorded: false };
    ensureMotionComparisonBaseline(motion);
    const frames = motionKeyframes(effect);
    const before = motionKeyframeValue(frames, index, property);
    if (before == null || String(before) === String(after))
      return { applied: false, recorded: false };
    const applyValue = (value: string | number): void => {
      const current = motionKeyframes(effect);
      effect.setKeyframes(editableKeyframes(updateMotionKeyframe(current, index, property, value)));
    };
    applyValue(after);
    const propertyLabel =
      property === 'offset' ? 'Position' : property === 'easing' ? 'Easing' : property;
    const recorded = await record(
      {
        category: 'motion',
        property: `motion.${motion.descriptor.id}.keyframe.${index}.${property}`,
        label: `Keyframe ${index + 1} ${propertyLabel}`,
        kind: property === 'offset' ? 'number' : 'text',
        value: before,
        unit: property === 'offset' ? '%' : undefined,
        read: () => motionKeyframeValue(motionKeyframes(effect), index, property) ?? '',
        apply: applyValue,
      },
      before,
      after,
      selected,
      `Edit ${motion.descriptor.label} keyframe ${index + 1}`,
      [
        'rendered keyframe track',
        `keyframe ${index + 1}`,
        property,
        ...motionSourceEvidence(selected, motion, 'keyframes'),
      ],
    );
    if (!recorded) applyValue(before);
    return { applied: true, recorded };
  }

  function toggleMotionLoop(animation: Animation): void {
    const effect = animation.effect as KeyframeEffect | null;
    if (!effect) return;
    const original = previewLoopIterations.get(animation);
    if (original === undefined) {
      previewLoopIterations.set(animation, Number(effect.getTiming().iterations));
      effect.updateTiming({ iterations: Number.POSITIVE_INFINITY });
    } else {
      effect.updateTiming({ iterations: original });
      previewLoopIterations.delete(animation);
    }
  }

  function renderMotionControls(motions: DiscoveredMotion[]): string {
    if (!motions.length) return '';
    return `<section class="inspector-category property-section ${collapsedSections.has('category:motion') ? 'collapsed' : ''}" data-category="motion" data-section-key="category:motion"><div class="inspector-heading section-head"><button class="section-toggle" aria-expanded="${String(!collapsedSections.has('category:motion'))}"><i data-foundry-icon="play"></i><strong>Motion</strong></button><span class="property-count">${motions.length} detected</span></div><div class="category-body motion-list">${motions
      .map(({ descriptor, animation }, index) => {
        const duration = descriptor.timing.duration || 1000;
        const currentTime = Math.min(duration, Number(animation?.currentTime ?? 0));
        const sourceLabel =
          descriptor.kind === 'css-animation'
            ? 'CSS animation'
            : descriptor.kind === 'css-transition'
              ? 'CSS transition'
              : 'Web animation';
        const disabled = animation?.effect ? '' : 'disabled';
        const properties = descriptor.properties.length
          ? descriptor.properties.join(', ')
          : 'Keyframe properties available while running';
        const playbackRate = animation?.playbackRate ?? 1;
        const speedOptions = [
          [0.1, '10%'],
          [0.25, '25%'],
          [0.5, '50%'],
          [1, '100%'],
          [2, '200%'],
        ]
          .map(
            ([rate, label]) =>
              `<option value="${rate}" ${Math.abs(playbackRate - Number(rate)) < 0.001 ? 'selected' : ''}>${label}</option>`,
          )
          .join('');
        return `<div class="motion-row" data-motion-index="${index}" data-motion-id="${descriptor.id}"><div class="motion-title"><span><strong>${escapeHtml(descriptor.label)}</strong><code>${escapeHtml(sourceLabel)} · ${Math.round(descriptor.timing.duration)} ms</code></span><span class="motion-badge" data-tier="${descriptor.performance.tier}" title="${escapeHtml(descriptor.performance.detail)}">${escapeHtml(descriptor.performance.label)}</span></div><div class="motion-properties" title="${escapeHtml(properties)}">${escapeHtml(properties)}</div><input class="motion-timeline" data-motion-timeline type="range" min="0" max="${duration}" step="1" value="${currentTime}" aria-label="Scrub ${escapeHtml(descriptor.label)}" ${disabled}/><div class="motion-transport"><button data-motion-action="toggle" ${disabled}>${animation?.playState === 'paused' ? 'Play' : 'Pause'}</button><button data-motion-action="replay" ${disabled}>Replay</button><button data-motion-action="loop" ${disabled}>${animation && previewLoopIterations.has(animation) ? 'Looping' : 'Loop'}</button><select data-motion-speed aria-label="Preview speed" ${disabled}>${speedOptions}</select></div><div class="motion-fields"><label>Duration<input data-motion-duration type="number" min="0" step="10" value="${Math.round(descriptor.timing.duration)}" ${disabled}/></label><label>Delay<input data-motion-delay type="number" step="10" value="${Math.round(descriptor.timing.delay)}" ${disabled}/></label><label>Easing<input data-motion-easing type="text" value="${escapeHtml(descriptor.timing.easing)}" ${disabled}/></label></div></div>`;
      })
      .join('')}</div></section>`;
  }

  function installMotionControls(motions: DiscoveredMotion[]): void {
    controlsRoot.querySelectorAll<HTMLElement>('[data-motion-index]').forEach((row) => {
      const motion = motions[Number(row.dataset.motionIndex)];
      const animation = motion?.animation;
      if (!motion || !animation) return;
      row
        .querySelector<HTMLInputElement>('[data-motion-timeline]')
        ?.addEventListener('input', (event) => {
          animation.pause();
          animation.currentTime = Number((event.currentTarget as HTMLInputElement).value);
          const toggle = row.querySelector<HTMLButtonElement>('[data-motion-action="toggle"]');
          if (toggle) toggle.textContent = 'Play';
        });
      const installTimingField = (
        selector: string,
        property: 'duration' | 'delay' | 'easing',
      ): void => {
        const field = row.querySelector<HTMLInputElement>(selector);
        if (!field) return;
        field.addEventListener('change', () => {
          const after = property === 'easing' ? field.value : Number(field.value);
          void applyMotionTiming(motion, property, after);
        });
      };
      installTimingField('[data-motion-duration]', 'duration');
      installTimingField('[data-motion-delay]', 'delay');
      installTimingField('[data-motion-easing]', 'easing');
      row
        .querySelector<HTMLSelectElement>('[data-motion-speed]')
        ?.addEventListener('change', (event) => {
          animation.playbackRate = Number((event.currentTarget as HTMLSelectElement).value);
        });
      row.querySelectorAll<HTMLButtonElement>('[data-motion-action]').forEach((button) => {
        button.addEventListener('click', () => {
          if (button.dataset.motionAction === 'toggle') {
            if (animation.playState === 'paused') {
              animation.play();
              button.textContent = 'Pause';
            } else {
              animation.pause();
              button.textContent = 'Play';
            }
          }
          if (button.dataset.motionAction === 'replay') {
            animation.currentTime = 0;
            animation.play();
            const toggle = row.querySelector<HTMLButtonElement>('[data-motion-action="toggle"]');
            if (toggle) toggle.textContent = 'Pause';
          }
          if (button.dataset.motionAction === 'loop') {
            toggleMotionLoop(animation);
            button.textContent = previewLoopIterations.has(animation) ? 'Looping' : 'Loop';
          }
        });
      });
    });
  }

  function activeColorValue(): string {
    if (!activeColor) return '#000000';
    const [red, green, blue] = hsvToRgb(activeColor.hue, activeColor.saturation, activeColor.value);
    return activeColor.alpha >= 0.999
      ? rgbHex(red, green, blue)
      : `rgba(${red}, ${green}, ${blue}, ${Math.round(activeColor.alpha * 100) / 100})`;
  }

  function refreshColorPopover(): void {
    if (!activeColor) return;
    const plane = colorPopover.querySelector<HTMLElement>('.color-plane');
    const handle = colorPopover.querySelector<HTMLElement>('.color-plane-handle');
    const hex = colorPopover.querySelector<HTMLInputElement>('[data-color-hex]');
    const hue = colorPopover.querySelector<HTMLInputElement>('[data-color-hue]');
    const alpha = colorPopover.querySelector<HTMLInputElement>('[data-color-alpha]');
    if (plane) plane.style.setProperty('--picker-hue', String(activeColor.hue));
    if (handle) {
      handle.style.left = `${activeColor.saturation * 100}%`;
      handle.style.top = `${(1 - activeColor.value) * 100}%`;
    }
    if (hex) hex.value = colorForInput(activeColorValue()).toUpperCase();
    if (hue) hue.value = String(Math.round(activeColor.hue));
    if (alpha) alpha.value = String(Math.round(activeColor.alpha * 100));
  }

  function previewActiveColor(): void {
    if (!activeColor) return;
    const value = activeColorValue();
    activeColor.control.apply(value);
    const trigger = controlsRoot.querySelector<HTMLButtonElement>(
      `[data-color-control="${activeColor.index}"]`,
    );
    const swatch = trigger?.querySelector<HTMLElement>('.color-swatch');
    const label = trigger?.querySelector<HTMLElement>('.color-value');
    if (swatch) {
      swatch.classList.toggle('transparent', activeColor.alpha === 0);
      swatch.style.setProperty('--swatch-color', colorForInput(value));
    }
    if (label) label.textContent = activeColor.alpha === 0 ? 'Transparent' : value.toUpperCase();
    refreshColorPopover();
    updateOutline();
  }

  function commitActiveColor(before: string | number): void {
    if (!activeColor) return;
    const after = activeColor.control.read();
    if (String(before) === String(after)) return;
    recentColors.delete(String(after));
    recentColors.add(String(after));
    while (recentColors.size > 8) recentColors.delete(recentColors.values().next().value!);
    pushHistory({
      element: activeColor.element,
      property: activeColor.control.property,
      before,
      after,
      category: activeColor.control.category,
      label: activeColor.control.label,
    });
    void record(activeColor.control, before, after, activeColor.element, 'Choose color');
  }

  function setActiveColor(value: string): void {
    if (!activeColor) return;
    const [red, green, blue] = hexChannels(value);
    const [hue, saturation, brightness] = rgbToHsv(red, green, blue);
    activeColor.hue = hue;
    activeColor.saturation = saturation;
    activeColor.value = brightness;
    activeColor.alpha = colorAlpha(value);
    previewActiveColor();
  }

  function openColorEditor(trigger: HTMLButtonElement, index: number): void {
    const control = selectedControls[index];
    if (!control || control.kind !== 'color' || !selected) return;
    const [red, green, blue] = hexChannels(String(control.read()));
    const [hue, saturation, value] = rgbToHsv(red, green, blue);
    activeColor = {
      index,
      control,
      element: selected,
      hue,
      saturation,
      value,
      alpha: colorAlpha(String(control.read())),
    };
    const tokens = tokensForCategory('color').slice(0, 18);
    colorPopover.innerHTML = `<div class="color-popover-head"><strong>${escapeHtml(control.label)}</strong><button class="icon-button" data-close-color aria-label="Close color editor"><i data-foundry-icon="x"></i></button></div><div class="color-plane" style="--picker-hue:${hue}"><span class="color-plane-handle"></span></div><div class="color-sliders"><label>Hue<input data-color-hue type="range" min="0" max="359" value="${Math.round(hue)}"/></label><label>Alpha<input data-color-alpha type="range" min="0" max="100" value="${Math.round(activeColor.alpha * 100)}"/></label></div><div class="color-fields"><input data-color-hex aria-label="Hex color" value="${colorForInput(String(control.read())).toUpperCase()}"/><button data-eyedropper aria-label="Pick color from page" title="Eyedropper"><i data-foundry-icon="palette"></i></button></div>${tokens.length ? `<div class="color-popover-section"><strong>Project colors</strong><div class="color-swatches">${tokens.map((token) => `<button data-color-value="${escapeHtml(token.value)}" style="--picker-swatch:${escapeHtml(token.value)}" aria-label="Use ${escapeHtml(token.name)}" title="${escapeHtml(`${token.name} · ${token.value}`)}"></button>`).join('')}</div></div>` : ''}${
      recentColors.size
        ? `<div class="color-popover-section"><strong>Recent</strong><div class="color-swatches">${[
            ...recentColors,
          ]
            .reverse()
            .map(
              (color) =>
                `<button data-color-value="${escapeHtml(color)}" style="--picker-swatch:${escapeHtml(color)}" aria-label="Use recent color ${escapeHtml(color)}"></button>`,
            )
            .join('')}</div></div>`
        : ''
    }`;
    renderIcons(colorPopover);
    colorPopover.hidden = false;
    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = colorPopover.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - popoverRect.width - 8, triggerRect.left));
    const preferredTop = triggerRect.bottom + 6;
    const top =
      preferredTop + popoverRect.height <= window.innerHeight - 8
        ? preferredTop
        : Math.max(8, triggerRect.top - popoverRect.height - 6);
    colorPopover.style.left = `${Math.round(left)}px`;
    colorPopover.style.top = `${Math.round(top)}px`;
    refreshColorPopover();

    colorPopover.querySelector('[data-close-color]')?.addEventListener('click', () => {
      colorPopover.hidden = true;
      activeColor = undefined;
      trigger.focus();
    });
    const plane = colorPopover.querySelector<HTMLElement>('.color-plane')!;
    plane.addEventListener('pointerdown', (event) => {
      if (!activeColor) return;
      const before = activeColor.control.read();
      plane.setPointerCapture(event.pointerId);
      const update = (pointer: PointerEvent): void => {
        if (!activeColor) return;
        const rect = plane.getBoundingClientRect();
        activeColor.saturation = Math.max(
          0,
          Math.min(1, (pointer.clientX - rect.left) / rect.width),
        );
        activeColor.value =
          1 - Math.max(0, Math.min(1, (pointer.clientY - rect.top) / rect.height));
        previewActiveColor();
      };
      const finish = (pointer: PointerEvent): void => {
        update(pointer);
        commitActiveColor(before);
        plane.removeEventListener('pointermove', update);
        plane.removeEventListener('pointerup', finish);
        plane.removeEventListener('pointercancel', finish);
      };
      update(event);
      plane.addEventListener('pointermove', update);
      plane.addEventListener('pointerup', finish);
      plane.addEventListener('pointercancel', finish);
    });
    const bindSlider = (selector: string, apply: (value: number) => void): void => {
      const slider = colorPopover.querySelector<HTMLInputElement>(selector)!;
      let before: string | number = control.read();
      slider.addEventListener('pointerdown', () => {
        before = control.read();
      });
      slider.addEventListener('input', () => {
        apply(Number(slider.value));
        previewActiveColor();
      });
      slider.addEventListener('change', () => commitActiveColor(before));
    };
    bindSlider('[data-color-hue]', (next) => {
      if (activeColor) activeColor.hue = next;
    });
    bindSlider('[data-color-alpha]', (next) => {
      if (activeColor) activeColor.alpha = next / 100;
    });
    const hexField = colorPopover.querySelector<HTMLInputElement>('[data-color-hex]')!;
    let hexBefore: string | number = control.read();
    hexField.addEventListener('focus', () => {
      hexBefore = control.read();
    });
    hexField.addEventListener('change', () => {
      setActiveColor(hexField.value);
      commitActiveColor(hexBefore);
    });
    colorPopover.querySelectorAll<HTMLButtonElement>('[data-color-value]').forEach((button) => {
      button.addEventListener('click', () => {
        const before = control.read();
        setActiveColor(button.dataset.colorValue ?? '#000000');
        commitActiveColor(before);
      });
    });
    colorPopover
      .querySelector<HTMLButtonElement>('[data-eyedropper]')
      ?.addEventListener('click', async () => {
        const EyeDropper = (
          window as unknown as {
            EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
          }
        ).EyeDropper;
        if (!EyeDropper) {
          showToast('Eyedropper is not available in this browser');
          return;
        }
        const before = control.read();
        const result = await new EyeDropper().open().catch(() => undefined);
        if (!result) return;
        setActiveColor(result.sRGBHex);
        commitActiveColor(before);
      });
  }

  function renderControls(): void {
    renderToolTabs();
    if (!selected) {
      renderSelectionEmptyState();
      return;
    }
    const groups: InspectorGroup[] = [
      {
        key: 'position',
        category: 'layout',
        label: 'Position and size',
        icon: 'maximize-2',
        sectionLabels: ['Position and size'],
      },
      {
        key: 'layout',
        category: 'layout',
        label: 'Layout',
        icon: CATEGORY_ICONS.layout,
        sectionLabels: ['Flow', 'Padding', 'Margin'],
        showContext: true,
      },
      {
        key: 'typography',
        category: 'typography',
        label: 'Typography',
        icon: CATEGORY_ICONS.typography,
        showContext: true,
      },
      {
        key: 'appearance',
        category: 'color',
        label: 'Appearance',
        icon: 'eye',
        sectionLabels: ['Appearance'],
      },
      {
        key: 'fill',
        category: 'color',
        label: 'Fill',
        icon: CATEGORY_ICONS.color,
        sectionLabels: ['Fill'],
        showContext: true,
      },
      {
        key: 'stroke',
        category: 'effects',
        label: 'Stroke',
        icon: 'box',
        sectionLabels: ['Stroke'],
      },
      {
        key: 'effects',
        category: 'effects',
        label: 'Effects',
        icon: CATEGORY_ICONS.effects,
        sectionLabels: ['Corners', 'Effects'],
        showContext: true,
      },
      ...(['content', 'accessibility'] as Category[]).map((category) => ({
        key: category,
        category,
        label: CATEGORY_LABELS[category],
        icon: CATEGORY_ICONS[category],
        showContext: true,
      })),
    ];
    const indexedControls = selectedControls
      .map((control, index) => ({ control, index }))
      .filter(({ control }) =>
        tokenOnly
          ? matchingTokens(
              designGraph?.tokens ?? [],
              control.property,
              `${control.value}${control.unit ?? ''}`,
            ).length > 0
          : true,
      );
    const categoryMarkup = groups
      .map((group) => {
        const configuredCategorySections = CONTROL_SECTIONS[group.category] ?? [];
        const configuredSections = group.sectionLabels
          ? configuredCategorySections.filter((section) =>
              group.sectionLabels!.includes(section.label),
            )
          : configuredCategorySections;
        const groupProperties = new Set(
          configuredSections.flatMap((section) => section.properties),
        );
        const controls = indexedControls.filter(
          (entry) =>
            entry.control.category === group.category &&
            (!group.sectionLabels || groupProperties.has(entry.control.property)),
        );
        if (!controls.length) return '';
        const renderedProperties = new Set<string>();
        const sections = configuredSections
          .map((section) => {
            const entries = section.properties
              .map((property) => controls.find((entry) => entry.control.property === property))
              .filter((entry): entry is { control: Control; index: number } => Boolean(entry));
            entries.forEach(({ control }) => renderedProperties.add(control.property));
            if (!entries.length) return '';
            const sectionKey = `${group.key}:${section.label}`;
            if (section.label === 'Effects') {
              return `<section class="property-section ${collapsedSections.has(sectionKey) ? 'collapsed' : ''}" data-section-key="${escapeHtml(sectionKey)}"><div class="section-head"><button class="section-toggle" aria-expanded="${String(!collapsedSections.has(sectionKey))}"><i data-foundry-icon="chevron-down"></i><strong>Effects</strong></button></div><div class="section-grid effect-section">${renderEffectsEditor(entries)}</div></section>`;
            }
            const sectionActions =
              section.label === 'Position and size'
                ? '<span class="section-actions"><button class="section-action" data-layout-action="lock" aria-label="Lock aspect ratio" title="Lock aspect ratio"><i data-foundry-icon="lock"></i></button></span>'
                : section.label === 'Padding'
                  ? `<span class="section-actions"><button class="section-action ${paddingLinked ? 'active' : ''}" data-padding-link aria-label="${paddingLinked ? 'Unlink padding values' : 'Link padding values'}"><i data-foundry-icon="${paddingLinked ? 'link-2' : 'unlink-2'}"></i></button></span>`
                  : section.label === 'Typeface'
                    ? '<span class="section-actions type-presets"><button class="section-action" data-open-typography-studio aria-label="Browse project and local fonts" title="Browse fonts"><i data-foundry-icon="type"></i></button><button data-type-preset="compact" aria-label="Apply compact type preset">S</button><button data-type-preset="body" aria-label="Apply body type preset">M</button><button data-type-preset="display" aria-label="Apply display type preset">L</button></span>'
                    : section.label === 'Fill'
                      ? '<span class="section-actions"><button class="section-action" data-color-action="gradient" aria-label="Add linear gradient" title="Add gradient"><i data-foundry-icon="sparkles"></i></button><button class="section-action" data-color-action="clear" aria-label="Clear fill" title="Clear fill"><i data-foundry-icon="x"></i></button></span>'
                      : section.label === 'Corners'
                        ? `<span class="section-actions"><button class="section-action ${radiusLinked ? 'active' : ''}" data-radius-link aria-label="${radiusLinked ? 'Edit corner radii independently' : 'Link corner radii'}"><i data-foundry-icon="${radiusLinked ? 'link-2' : 'unlink-2'}"></i></button></span>`
                        : '';
            return `<section class="property-section ${collapsedSections.has(sectionKey) ? 'collapsed' : ''}" data-section-key="${escapeHtml(sectionKey)}"><div class="section-head"><button class="section-toggle" aria-expanded="${String(!collapsedSections.has(sectionKey))}"><i data-foundry-icon="chevron-down"></i><strong>${escapeHtml(section.label)}</strong></button>${sectionActions}</div><div class="section-grid ${section.columns === 2 ? 'two' : ''} ${section.stacked ? 'stacked' : ''}">${entries
              .map(({ control, index }) =>
                renderPropertyControl(control, index, section.prefixes?.[control.property]),
              )
              .join('')}</div></section>`;
          })
          .join('');
        const remaining = controls.filter(
          ({ control }) => !renderedProperties.has(control.property),
        );
        const remainingSection = remaining.length
          ? `<section class="property-section ${collapsedSections.has(`${group.key}:Other`) ? 'collapsed' : ''}" data-section-key="${escapeHtml(`${group.key}:Other`)}"><div class="section-head"><button class="section-toggle" aria-expanded="${String(!collapsedSections.has(`${group.key}:Other`))}"><i data-foundry-icon="chevron-down"></i><strong>Other</strong></button></div><div class="section-grid">${remaining
              .map(({ control, index }) => renderPropertyControl(control, index))
              .join('')}</div></section>`
          : '';
        const categoryKey = `category:${group.key}`;
        const categoryAction =
          group.key === 'layout'
            ? '<button class="category-action" data-layout-action="tidy"><i data-foundry-icon="wand-sparkles"></i><span>Tidy</span></button>'
            : '';
        return `<section class="inspector-category property-section ${collapsedSections.has(categoryKey) ? 'collapsed' : ''}" data-category="${group.key}" data-section-key="${categoryKey}"><div class="inspector-heading section-head"><button class="section-toggle" aria-expanded="${String(!collapsedSections.has(categoryKey))}"><i data-foundry-icon="${group.icon}"></i><strong>${group.label}</strong></button>${categoryAction}<span class="property-count">${controls.length}</span></div><div class="category-body">${group.showContext ? renderContextPanel(group.category) : ''}${sections}${remainingSection}</div></section>`;
      })
      .join('');
    const currentBaseline = baselineForContext(
      designMemory,
      foundryTargetId(selected),
      breakpoint.value,
      theme.value,
      state.value,
    );
    const motions = discoverElementMotion(selected);
    controlsRoot.innerHTML = `${currentBaseline ? `<div class="inspector-baseline"><span class="baseline-badge">Verified baseline · ${escapeHtml(new Date(currentBaseline.verifiedAt).toLocaleDateString())}</span></div>` : ''}${categoryMarkup}${renderMotionControls(motions)}`;
    renderIcons(controlsRoot);
    controlsRoot
      .querySelector<HTMLButtonElement>('[data-open-typography-studio]')
      ?.addEventListener('click', (event) =>
        openTypographyStudio(event.currentTarget as HTMLButtonElement),
      );
    controlsRoot.querySelectorAll<HTMLButtonElement>('.section-toggle').forEach((button) => {
      button.addEventListener('click', () => {
        const section = button.closest<HTMLElement>('.property-section');
        const key = section?.dataset.sectionKey;
        if (!section || !key) return;
        section.classList.toggle('collapsed');
        const collapsed = section.classList.contains('collapsed');
        button.setAttribute('aria-expanded', String(!collapsed));
        if (collapsed) collapsedSections.add(key);
        else collapsedSections.delete(key);
        sectionPreferenceTouched = true;
        sessionStorage.setItem(
          '__foundry_collapsed_sections',
          JSON.stringify([...collapsedSections]),
        );
      });
    });
    controlsRoot.querySelectorAll<HTMLButtonElement>('[data-padding-link]').forEach((button) =>
      button.addEventListener('click', () => {
        paddingLinked = !paddingLinked;
        renderControls();
      }),
    );
    controlsRoot.querySelectorAll<HTMLButtonElement>('[data-radius-link]').forEach((button) =>
      button.addEventListener('click', () => {
        radiusLinked = !radiusLinked;
        renderControls();
      }),
    );
    indexedControls.forEach(({ control, index }) => {
      const matches = matchingTokens(
        designGraph?.tokens ?? [],
        control.property,
        `${control.value}${control.unit ?? ''}`,
      );
      const tokenEligible =
        (control.category === 'layout' && /gap|padding|margin/i.test(control.property)) ||
        (control.category === 'typography' &&
          /font|lineHeight|letterSpacing/i.test(control.property)) ||
        (control.category === 'color' && /color|background|fill|stroke/i.test(control.property)) ||
        (control.category === 'effects' && /radius|shadow|blur/i.test(control.property));
      const availableTokens = rankedProjectTokens(
        tokensForCategory(control.category),
        control.property,
        `${control.value}${control.unit ?? ''}`,
      );
      if (!tokenEligible || !availableTokens.length) return;
      const field = controlsRoot.querySelector<HTMLElement>(`[data-control="${index}"]`);
      const label = field?.closest<HTMLElement>('label');
      if (!label) return;
      label.insertAdjacentHTML(
        'beforeend',
        matches.length
          ? `<span class="token-provenance">Uses ${escapeHtml(matches[0]!.name)}</span>`
          : `<span class="token-provenance literal">Literal value · ${availableTokens[0]?.relation === 'nearest' ? `nearest is ${escapeHtml(availableTokens[0].token.name)}` : 'consider a project token'}</span>`,
      );
      label.insertAdjacentHTML(
        'beforeend',
        `<span class="token-menu-wrap"><button type="button" class="token-menu-trigger" data-token-menu-trigger="${index}" aria-expanded="false" aria-label="Choose a project token"><i data-foundry-icon="bookmark"></i></button><span class="token-menu" data-token-menu="${index}" hidden>${availableTokens
          .map(
            ({ token, relation }) =>
              `<button type="button" class="token-option" data-token-control="${index}" data-token-value="${escapeHtml(token.value)}" title="${escapeHtml(token.value)}">${control.category === 'color' ? `<span class="swatch" style="--token-color:${escapeHtml(token.value)}"></span>` : ''}<span>${escapeHtml(token.name)}${relation === 'exact' ? '<small>Current</small>' : relation === 'nearest' ? '<small>Nearest</small>' : ''}</span><code>${escapeHtml(token.value)}</code></button>`,
          )
          .join('')}</span></span>`,
      );
    });
    renderIcons(controlsRoot);
    controlsRoot
      .querySelectorAll<HTMLButtonElement>('[data-token-menu-trigger]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          const menu = controlsRoot.querySelector<HTMLElement>(
            `[data-token-menu="${button.dataset.tokenMenuTrigger}"]`,
          );
          if (!menu) return;
          controlsRoot.querySelectorAll<HTMLElement>('[data-token-menu]').forEach((candidate) => {
            if (candidate !== menu) candidate.hidden = true;
          });
          menu.hidden = !menu.hidden;
          button.setAttribute('aria-expanded', String(!menu.hidden));
        });
      });
    controlsRoot.querySelectorAll<HTMLButtonElement>('[data-reset-control]').forEach((button) => {
      button.addEventListener('click', () => {
        const control = selectedControls[Number(button.dataset.resetControl)];
        if (!control || !selected) return;
        const entry = previewHistory.find(
          (item) => item.element === selected && item.property === control.property,
        );
        if (!entry) {
          showToast('This value already matches its starting point');
          return;
        }
        const current = control.read();
        rawHistoryValue(entry, entry.before);
        previewHistory.splice(
          0,
          previewHistory.length,
          ...previewHistory.filter(
            (item) => !(item.element === selected && item.property === control.property),
          ),
        );
        historyCursor = previewHistory.length;
        updateHistoryActions();
        updateOutline();
        void record(control, current, entry.before, selected, `Reset ${control.label}`);
        selectedControls = controlsFor(selected);
        renderControls();
      });
    });
    controlsRoot.querySelectorAll<HTMLSelectElement>('[data-unit-control]').forEach((unitField) => {
      unitField.addEventListener('change', () => {
        const index = Number(unitField.dataset.unitControl);
        const control = selectedControls[index];
        const valueField = controlsRoot.querySelector<HTMLInputElement>(
          `input[data-control="${index}"]`,
        );
        if (!control || !selected || !valueField || !control.unit) return;
        const element = selected;
        const currentValue = Number(valueField.value);
        const before = `${currentValue}${control.unit}`;
        const nextUnit = unitField.value;
        const rootSize =
          Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const vertical = /height|top|bottom/i.test(control.property);
        const referenceRect = element.parentElement?.getBoundingClientRect();
        const reference = vertical ? referenceRect?.height : referenceRect?.width;
        let pixels = currentValue;
        if (control.unit === 'rem') pixels *= rootSize;
        if (control.unit === '%' && reference) pixels = (currentValue / 100) * reference;
        let converted = pixels;
        if (nextUnit === 'rem') converted = pixels / rootSize;
        if (nextUnit === '%' && reference) converted = (pixels / reference) * 100;
        converted = Math.round(converted * 100) / 100;
        const after = `${converted}${nextUnit}`;
        rawElementValue(element, control.property, after);
        valueField.value = String(converted);
        const unitControl: Control = {
          ...control,
          kind: 'text',
          value: before,
          unit: undefined,
          read: () =>
            getComputedStyle(element)[control.property as keyof CSSStyleDeclaration] as string,
          apply: (value) => rawElementValue(element, control.property, value),
        };
        pushHistory({
          element,
          property: control.property,
          before,
          after,
          category: control.category,
          label: control.label,
        });
        void record(unitControl, before, after, element, `Change ${control.label} unit`);
        updateOutline();
      });
    });
    const fieldRecorders = new Map<
      number,
      ReturnType<typeof createDebouncedChangeRecorder<string | number>>
    >();
    controlsRoot
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-control]')
      .forEach((field) => {
        const index = Number(field.dataset.control);
        const control = selectedControls[index];
        if (!control) return;
        const editedElement = selected;
        const recorder = createDebouncedChangeRecorder<string | number>(
          180,
          async (before, after) => {
            if (editedElement) {
              pushHistory({
                element: editedElement,
                property: control.property,
                before,
                after,
                unit: control.unit,
                category: control.category,
                label: control.label,
              });
            }
            await record(control, before, after, editedElement);
          },
        );
        fieldRecorders.set(index, recorder);
        field.addEventListener('focus', () => {
          activeControlProperty = control.property;
        });
        field.addEventListener('input', () => {
          const before = control.read();
          const value = control.kind === 'number' ? Number(field.value) : field.value;
          control.apply(value);
          if (paddingLinked && control.property.startsWith('padding')) {
            indexedControls.forEach(({ control: linkedControl, index: linkedIndex }) => {
              if (
                linkedControl === control ||
                !['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].includes(
                  linkedControl.property,
                )
              )
                return;
              const linkedBefore = linkedControl.read();
              linkedControl.apply(value);
              const linkedField = controlsRoot.querySelector<HTMLInputElement>(
                `[data-control="${linkedIndex}"]`,
              );
              if (linkedField) linkedField.value = String(value);
              fieldRecorders.get(linkedIndex)?.push(linkedBefore, value);
            });
          }
          const radiusProperties = [
            'borderTopLeftRadius',
            'borderTopRightRadius',
            'borderBottomLeftRadius',
            'borderBottomRightRadius',
          ];
          if (
            radiusLinked &&
            (control.property === 'borderRadius' || radiusProperties.includes(control.property))
          ) {
            indexedControls.forEach(({ control: linkedControl, index: linkedIndex }) => {
              if (linkedControl === control || !radiusProperties.includes(linkedControl.property))
                return;
              const linkedBefore = linkedControl.read();
              linkedControl.apply(value);
              const linkedField = controlsRoot.querySelector<HTMLInputElement>(
                `[data-control="${linkedIndex}"]`,
              );
              if (linkedField) linkedField.value = String(value);
              fieldRecorders.get(linkedIndex)?.push(linkedBefore, value);
            });
          }
          updateOutline();
          recorder.push(before, value);
        });
      });
    controlsRoot.querySelectorAll<HTMLButtonElement>('[data-color-control]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.colorControl);
        const control = selectedControls[index];
        if (!control) return;
        activeControlProperty = control.property;
        openColorEditor(button, index);
      });
    });
    controlsRoot.querySelectorAll<HTMLButtonElement>('[data-token-control]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.tokenControl);
        const field = controlsRoot.querySelector<HTMLInputElement | HTMLSelectElement>(
          `[data-control="${index}"]`,
        );
        const control = selectedControls[index];
        if (!control) return;
        const raw = button.dataset.tokenValue ?? '';
        if (control.kind === 'color') {
          void applyControlValue(control, raw, 'Use project color').then(() => {
            if (selected) selectedControls = controlsFor(selected);
            renderControls();
          });
          return;
        }
        if (!field) return;
        field.value = control.kind === 'number' ? String(numberFrom(raw)) : raw;
        field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      });
    });
    installEffectEditor();
    installContextActions(selectedControls);
    installNumberScrubbing();
    installMotionControls(motions);
  }

  function select(element: HTMLElement, additive = false): void {
    if (element === host || host.contains(element)) return;
    if (selected !== element || additive) {
      cancelInspectorDraft();
      clearInspectorFocus();
    }
    if (selected && selected !== element && workshopStateId !== 'current') {
      clearWorkshopStatePreview();
      workshopStateId = 'current';
    }
    closeTypographyStudio(false);
    colorPopover.hidden = true;
    activeColor = undefined;
    if (additive && selectedElements.includes(element)) {
      selectedElements = selectedElements.filter((item) => item !== element);
      if (!selectedElements.length) {
        clearSelection();
        return;
      }
      selected = selectedElements.at(-1)!;
      element = selected;
    } else if (additive) {
      selectedElements.push(element);
      selected = element;
    } else {
      selectedElements = [element];
      selected = element;
    }
    responsiveEditScope = {
      scope: 'breakpoint',
      activeBreakpoint:
        currentPreviewContext.viewport.id !== 'current'
          ? currentPreviewContext.viewport.id
          : breakpoint.value || 'current',
    };
    completeOnboardingStep('selection');
    if (!sectionPreferenceTouched) {
      const categoryKeys = [
        'position',
        'layout',
        'typography',
        'appearance',
        'fill',
        'stroke',
        'effects',
        'content',
        'accessibility',
        'motion',
      ];
      categoryKeys.forEach((key) => collapsedSections.add(`category:${key}`));
      collapsedSections.delete('category:position');
      collapsedSections.delete('category:layout');
      collapsedSections.delete('category:appearance');
      collapsedSections.delete('category:fill');
      const isText =
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        (element.children.length === 0 && Boolean(element.textContent?.trim()));
      const isMedia = element instanceof HTMLImageElement;
      if (isText) {
        collapsedSections.delete('category:typography');
        collapsedSections.delete('category:content');
      }
      if (isMedia) {
        collapsedSections.delete('category:content');
        collapsedSections.delete('category:accessibility');
      }
      if (Number.parseFloat(getComputedStyle(element).borderWidth) > 0)
        collapsedSections.delete('category:stroke');
      if (
        getComputedStyle(element).boxShadow !== 'none' ||
        Number.parseFloat(getComputedStyle(element).borderRadius) > 0
      )
        collapsedSections.delete('category:effects');
      if (element.getAnimations().length) collapsedSections.delete('category:motion');
    }
    selectedControls = controlsFor(element);
    const target = targetFor(element);
    panel.classList.add('has-selection');
    selectionRoot.classList.remove('selected-flash');
    void selectionRoot.offsetWidth;
    selectionRoot.classList.add('selected-flash');
    selectionKind.textContent = element.tagName.toLowerCase();
    selectionTitle.textContent =
      selectedElements.length > 1 ? `${selectedElements.length} elements` : target.label;
    selectionCode.textContent = element.dataset.foundrySource || foundrySelector(element);
    selectionState.textContent = selectedElements.length > 1 ? 'Multi-select' : 'Selected';
    selectionHint.textContent =
      selectedElements.length > 1
        ? `${selectedElements.length} layers · shared controls are shown`
        : 'Shift-click adds layers · repeat a click to cycle overlaps';
    selectionConfidence.textContent =
      target.confidence === 'instrumented' ? 'Instrumented' : 'Measured target';
    selectionStats.hidden = false;
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(updateOutline);
    resizeObserver.observe(element);
    updateSelectionPath();
    updateOutline();
    renderControls();
    renderLayers();
    sessionStorage.setItem('__foundry_selected_selector', foundrySelector(element));
    if (!workbench.hidden) applyWorkbenchState();
    if (!libraryPanel.hidden) renderDesignMemory();
    if (!componentWorkshopPanel.hidden) renderComponentWorkshop();
    if (matrixMode) renderWorkbenchMatrix();
    publishWorkspaceState();
  }

  function renderSelectionEmptyState(): void {
    controlsRoot.innerHTML =
      '<div class="empty-state"><span class="empty-state-icon"><i data-foundry-icon="mouse-pointer-2"></i></span><strong>Select something to begin</strong><p>Click any element on the page, or use Layers for a precise structural selection.</p><span class="empty-state-actions"><button data-empty-layers>Open Layers</button><button data-empty-interact>Interact with app</button></span><kbd>Shift-click adds · Option-click selects while interacting</kbd></div>';
    renderIcons(controlsRoot);
    controlsRoot
      .querySelector<HTMLButtonElement>('[data-empty-layers]')
      ?.addEventListener('click', () => toggleLayers(true));
    controlsRoot
      .querySelector<HTMLButtonElement>('[data-empty-interact]')
      ?.addEventListener('click', () => {
        inspecting = false;
        updateInspectionMode();
        showToast('Interaction mode on · Option-click still selects');
      });
  }

  function clearSelection(): void {
    cancelInspectorDraft();
    clearInspectorFocus();
    clearWorkshopStatePreview();
    workshopStateId = 'current';
    closeTypographyStudio(false);
    colorPopover.hidden = true;
    activeColor = undefined;
    selected = null;
    selectedElements = [];
    selectedControls = [];
    responsiveEditScope = {
      scope: 'breakpoint',
      activeBreakpoint:
        currentPreviewContext.viewport.id !== 'current'
          ? currentPreviewContext.viewport.id
          : breakpoint.value || 'current',
    };
    sessionStorage.removeItem('__foundry_selected_selector');
    resizeObserver?.disconnect();
    outline.hidden = true;
    panel.classList.remove('has-selection');
    shadow.querySelectorAll('.multi-outline').forEach((item) => item.remove());
    selectionKind.textContent = 'No layer';
    selectionTitle.textContent = 'Nothing selected';
    selectionCode.textContent = 'Click any element to inspect it';
    selectionState.textContent = 'Ready';
    selectionHint.textContent = 'Select mode stays on · click anywhere to begin';
    selectionStats.hidden = true;
    selectionPath.hidden = true;
    previewLayer(null);
    renderToolTabs();
    renderSelectionEmptyState();
    updateCanvasActions();
    renderLayers();
    if (!libraryPanel.hidden) renderDesignMemory();
    if (!componentWorkshopPanel.hidden) renderComponentWorkshop();
    if (matrixMode) renderWorkbenchMatrix();
    publishWorkspaceState();
  }

  function simpleStyleControl(
    element: HTMLElement,
    property: string,
    label: string,
    category: Category = 'layout',
    unit?: string,
  ): Control {
    return {
      category,
      property,
      label,
      kind: unit ? 'number' : 'text',
      value: unit
        ? numberFrom((getComputedStyle(element) as any)[property])
        : String((getComputedStyle(element) as any)[property]),
      unit,
      read: () =>
        unit
          ? numberFrom((getComputedStyle(element) as any)[property])
          : String((getComputedStyle(element) as any)[property]),
      apply: (value) =>
        element.style.setProperty(
          property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          `${value}${unit ?? ''}`,
        ),
    };
  }

  async function alignSelected(): Promise<void> {
    const parent = selectedElements[0]?.parentElement;
    if (!parent || !selectedElements.every((item) => item.parentElement === parent)) return;
    const grid = getComputedStyle(parent).display.includes('grid');
    const property = grid ? 'justifySelf' : 'alignSelf';
    for (const element of selectedElements) {
      const control = simpleStyleControl(
        element,
        property,
        grid ? 'Grid alignment' : 'Flex alignment',
      );
      const before = control.read();
      control.apply('center');
      pushHistory({
        element,
        property,
        before,
        after: 'center',
        category: 'layout',
        label: control.label,
      });
      await record(control, before, 'center', element, `Align ${selectedElements.length} elements`);
    }
    updateOutline();
  }

  async function distributeSelected(): Promise<void> {
    const parent = selectedElements[0]?.parentElement;
    if (!parent || !getComputedStyle(parent).display.includes('flex')) return;
    const control = simpleStyleControl(parent, 'justifyContent', 'Distribution');
    const before = control.read();
    control.apply('space-between');
    pushHistory({
      element: parent,
      property: 'justifyContent',
      before,
      after: 'space-between',
      category: 'layout',
      label: 'Distribution',
    });
    await record(control, before, 'space-between', parent, 'Distribute flex children');
    updateOutline();
  }

  const nudgeStart = new Map<string, { element: HTMLElement; property: string; value: number }>();

  function nudgeSelection(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)
      return;
    if (!selectedElements.length) return;
    const horizontal = ['ArrowLeft', 'ArrowRight'].includes(event.key);
    const property = horizontal ? 'marginLeft' : 'marginTop';
    const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
    const delta = direction * (event.shiftKey ? 8 : 1);
    for (const element of selectedElements) {
      const control = simpleStyleControl(
        element,
        property,
        horizontal ? 'Horizontal offset' : 'Vertical offset',
        'layout',
        'px',
      );
      const key = `${foundryTargetId(element)}:${property}`;
      const before = Number(control.read());
      if (!nudgeStart.has(key)) nudgeStart.set(key, { element, property, value: before });
      control.apply(before + delta);
    }
    event.preventDefault();
    updateOutline();
  }

  function commitNudge(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    for (const [key, start] of [...nudgeStart]) {
      const control = simpleStyleControl(
        start.element,
        start.property,
        start.property === 'marginLeft' ? 'Horizontal offset' : 'Vertical offset',
        'layout',
        'px',
      );
      const after = Number(control.read());
      if (after !== start.value) {
        pushHistory({
          element: start.element,
          property: start.property,
          before: start.value,
          after,
          unit: 'px',
          category: 'layout',
          label: control.label,
        });
        void record(control, start.value, after, start.element, 'Keyboard nudge');
      }
      nudgeStart.delete(key);
    }
  }

  function handlePointer(event: MouseEvent): void {
    if (!(inspecting || event.altKey)) return;
    const path = event.composedPath();
    if (path.includes(host) || path.includes(panel)) return;
    const candidates = selectionCandidatesAt(event.clientX, event.clientY, event.altKey);
    const signature = candidates.map((item) => foundryTargetId(item)).join('|');
    const repeated =
      Math.hypot(clickCycle.x - event.clientX, clickCycle.y - event.clientY) <= 4 &&
      performance.now() - clickCycle.at < 1400 &&
      clickCycle.signature === signature;
    const index = event.shiftKey
      ? 0
      : repeated
        ? nextCycleIndex(clickCycle.index, candidates.length)
        : 0;
    const element = candidates[index];
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    select(element, event.shiftKey);
    clickCycle = {
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
      index,
      signature,
    };
    // The embedded workspace already identifies selection in Layers and the inspector.
    // Keep the standalone cycling hint without covering the embedded product on each click.
    if (!embeddedWorkspace && candidates.length > 1 && !event.shiftKey) {
      showToast(`${layerLabel(element)} · ${index + 1} of ${candidates.length}`);
    }
  }

  let selectionHoverFrame = 0;
  function handleSelectionHover(event: PointerEvent): void {
    cancelAnimationFrame(selectionHoverFrame);
    const path = event.composedPath();
    if (!(inspecting || event.altKey) || path.includes(host) || path.includes(panel)) {
      previewLayer(null);
      return;
    }
    const x = event.clientX;
    const y = event.clientY;
    selectionHoverFrame = requestAnimationFrame(() => {
      previewLayer(selectionCandidatesAt(x, y, event.altKey)[0] ?? null);
    });
  }

  function updateInspectionMode(): void {
    inspectButton.classList.toggle('active', inspecting);
    interactButton.classList.toggle('active', !inspecting);
    inspectButton.setAttribute('aria-pressed', String(inspecting));
    interactButton.setAttribute('aria-pressed', String(!inspecting));
    inspectButton.setAttribute('aria-label', 'Select mode');
    interactButton.setAttribute('aria-label', 'Interact mode');
    inspectButton.dataset.tooltip = 'Select';
    interactButton.dataset.tooltip = 'Interact';
    inspectButton.title = 'Select mode: click any element';
    interactButton.title = 'Interaction mode: use the app normally. Option-click still selects.';
    modeCopyTitle.textContent = inspecting ? 'Select mode' : 'Interact mode';
    modeCopyDetail.textContent = inspecting ? 'Click any element' : 'Option-click to select';
  }

  async function waitForStableGeometry(changes: any[]): Promise<void> {
    let previous = '';
    let stableSamples = 0;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const sample = changes
        .map((change) => {
          const element = resolveFoundrySelector(document, change.target.locator.selector);
          if (!(element instanceof HTMLElement)) return 'missing';
          const rect = element.getBoundingClientRect();
          return `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
        })
        .join('|');
      stableSamples = sample === previous ? stableSamples + 1 : 0;
      if (stableSamples >= 2) return;
      previous = sample;
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
  }

  interface VerificationDocument {
    documentRoot: Document | null;
    contextResult?: PreviewContextResult;
    failureReason?: string;
    cleanup(): void;
  }

  function waitForVerificationFrame(frame: HTMLIFrameElement): Promise<void> {
    const source = frame.contentWindow;
    if (!source) return Promise.reject(new Error('The verification frame could not start'));
    return new Promise((resolveReady, rejectReady) => {
      const requestId = `verification_ready_${crypto.randomUUID().replaceAll('-', '')}`;
      const timer = window.setTimeout(() => {
        cleanup();
        rejectReady(new Error('The verification frame did not become ready'));
      }, 10_000);
      const ping = (): void => {
        source.postMessage(
          {
            type: 'foundry:workspace-command',
            sessionId,
            requestId,
            command: 'preview-ping',
            payload: { sentAt: Date.now() },
          },
          location.origin,
        );
      };
      const interval = window.setInterval(ping, 200);
      const cleanup = (): void => {
        window.clearTimeout(timer);
        window.clearInterval(interval);
        window.removeEventListener('message', handleMessage);
        frame.removeEventListener('load', ping);
        frame.removeEventListener('error', handleError);
      };
      const handleError = (): void => {
        cleanup();
        rejectReady(new Error('The verification frame failed to load'));
      };
      const handleMessage = (event: MessageEvent): void => {
        if (event.source !== source || event.origin !== location.origin) return;
        const message = event.data as {
          type?: string;
          sessionId?: string;
          requestId?: string;
          ok?: boolean;
          payload?: {
            alive?: boolean;
            snapshot?: { verificationReady?: boolean };
          };
        };
        if (
          message.type !== 'foundry:workspace-result' ||
          message.sessionId !== sessionId ||
          message.requestId !== requestId ||
          message.ok !== true ||
          message.payload?.alive !== true ||
          message.payload.snapshot?.verificationReady !== true
        )
          return;
        cleanup();
        resolveReady();
      };
      window.addEventListener('message', handleMessage);
      frame.addEventListener('load', ping);
      frame.addEventListener('error', handleError, { once: true });
      ping();
    });
  }

  function requestVerificationPreviewContext(
    frame: HTMLIFrameElement,
    context: PreviewContext,
  ): Promise<PreviewContextResult> {
    const source = frame.contentWindow;
    if (!source) return Promise.reject(new Error('The verification frame disconnected'));
    const requestId = `verification_${crypto.randomUUID().replaceAll('-', '')}`;
    return new Promise((resolveResult, rejectResult) => {
      const timer = window.setTimeout(() => {
        cleanup();
        rejectResult(new Error('The verification context was not acknowledged'));
      }, 10_000);
      const cleanup = (): void => {
        window.clearTimeout(timer);
        window.removeEventListener('message', handleMessage);
      };
      const handleMessage = (event: MessageEvent): void => {
        if (event.source !== source || event.origin !== location.origin) return;
        const message = event.data as {
          type?: string;
          sessionId?: string;
          requestId?: string;
          ok?: boolean;
          error?: string;
          payload?: PreviewContextResult;
        };
        if (
          message.type !== 'foundry:workspace-result' ||
          message.sessionId !== sessionId ||
          message.requestId !== requestId
        )
          return;
        cleanup();
        if (!message.ok || !message.payload) {
          rejectResult(new Error(message.error || 'The verification context was rejected'));
          return;
        }
        resolveResult(message.payload);
      };
      window.addEventListener('message', handleMessage);
      source.postMessage(
        {
          type: 'foundry:workspace-command',
          sessionId,
          requestId,
          command: 'apply-preview-context',
          payload: { context },
        },
        location.origin,
      );
    });
  }

  async function verificationDocument(
    change: any,
    context: TypographyVerificationContext,
    frozenContext: {
      targetUrl?: string;
      previewOrigin?: string;
      viewport?: { width: number; height: number };
    },
  ): Promise<VerificationDocument> {
    const cleanup = (frame: HTMLIFrameElement): void => frame.remove();
    const graph = previewGraph();
    const viewport = designGraph?.breakpoints.find((item) => item.id === context.breakpoint);
    const verificationViewport = verificationViewportForContext(frozenContext.viewport, viewport);
    const frame = document.createElement('iframe');
    frame.title = 'Foundry verification frame';
    Object.assign(frame.style, {
      position: 'fixed',
      left: '-12000px',
      top: '0',
      width: `${verificationViewport?.width ?? 0}px`,
      height: `${verificationViewport?.height ?? 0}px`,
      border: '0',
    });
    if (!verificationViewport) {
      return {
        documentRoot: null,
        failureReason: 'The reviewed contract has no frozen viewport dimensions',
        cleanup: () => cleanup(frame),
      };
    }
    let url: URL;
    try {
      url = new URL(verificationFrameUrl(frozenContext, sessionId, token, previewCapability));
    } catch (error) {
      return {
        documentRoot: null,
        failureReason:
          error instanceof Error ? error.message : 'The frozen preview URL is unavailable',
        cleanup: () => cleanup(frame),
      };
    }
    const managedQueryKeys = new Set(graph.states.flatMap((item) => Object.keys(item.query ?? {})));
    const requestedQuery = queryForPreviewState(graph.states, context.state);
    for (const key of managedQueryKeys) {
      if (key in requestedQuery) url.searchParams.set(key, requestedQuery[key]!);
      else url.searchParams.delete(key);
    }
    shadow.append(frame);
    const ready = waitForVerificationFrame(frame);
    frame.src = url.href;
    try {
      await ready;
      const contextResult = await requestVerificationPreviewContext(frame, {
        version: PREVIEW_CONTEXT_VERSION,
        requestRevision: 1,
        viewport: {
          id: viewport?.id ?? context.breakpoint,
          width: verificationViewport.width,
          height: verificationViewport.height,
        },
        theme: context.theme,
        state: context.state,
        motionPreference: 'system',
        selectedTarget: {
          id: String(change.target.id),
          selector: String(change.target.locator.selector),
        },
      });
      const frameDocument = frame.contentDocument;
      if (!contextResult.applied || !frameDocument) {
        return {
          documentRoot: null,
          contextResult,
          failureReason:
            contextResult.failureReason ||
            (contextResult.reloadQuery
              ? 'The authored state requested an additional reload'
              : 'The verification context could not be applied'),
          cleanup: () => cleanup(frame),
        };
      }
      await frameDocument.fonts?.ready;
      await new Promise((resolveWait) => setTimeout(resolveWait, 180));
      return {
        documentRoot: frameDocument,
        contextResult,
        cleanup: () => cleanup(frame),
      };
    } catch (error) {
      return {
        documentRoot: null,
        failureReason:
          error instanceof Error ? error.message : 'The verification frame could not be prepared',
        cleanup: () => cleanup(frame),
      };
    }
  }

  function authoredStyleValue(element: HTMLElement, property: string): string {
    const inline = element.style.getPropertyValue(property);
    if (inline) return inline;
    let value = '';
    const visit = (rules: CSSRuleList): void => {
      for (const rule of [...rules]) {
        if (rule instanceof CSSStyleRule) {
          try {
            if (element.matches(rule.selectorText) && rule.style.getPropertyValue(property))
              value = rule.style.getPropertyValue(property);
          } catch {
            // Ignore unsupported or cross-origin selector details.
          }
        } else if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of [...element.ownerDocument.styleSheets]) {
      try {
        visit(sheet.cssRules);
      } catch {
        // Cross-origin stylesheets do not expose their rule list.
      }
    }
    return value;
  }

  function renderedValue(element: HTMLElement, change: any): unknown {
    if (change.property === 'textContent') return element.textContent?.trim() ?? '';
    if (['aria-label', 'role', 'tabindex', 'alt', 'src'].includes(change.property))
      return element.getAttribute(change.property) ?? (element as any)[change.property] ?? '';
    const motionKeyframe = /^motion\.(motion_[a-z0-9]+)\.keyframe\.(\d+)\.(.+)$/.exec(
      change.property,
    );
    if (motionKeyframe) {
      const discovered = findDiscoveredMotion(element, motionKeyframe[1]!);
      if (!discovered) return null;
      return motionKeyframeValue(
        discovered.descriptor.keyframes,
        Number(motionKeyframe[2]),
        motionKeyframe[3]!,
      );
    }
    const motion = /^motion\.(motion_[a-z0-9]+)\.(.+)$/.exec(change.property);
    if (motion) {
      const discovered = findDiscoveredMotion(element, motion[1]!);
      if (!discovered) return null;
      return discovered.descriptor.timing[
        motion[2] as 'duration' | 'delay' | 'easing' | 'iterations' | 'direction' | 'fill'
      ];
    }
    if (change.property === 'widthMode' || change.property === 'heightMode') {
      const axis = change.property === 'widthMode' ? 'width' : 'height';
      const style = element.ownerDocument.defaultView!.getComputedStyle(element);
      return detectSizingMode(
        authoredStyleValue(element, axis) || style[axis as 'width' | 'height'],
        style.flexGrow,
        style[axis === 'width' ? 'minWidth' : 'minHeight'],
        style[axis === 'width' ? 'maxWidth' : 'maxHeight'],
      );
    }
    if (String(change.property).startsWith('variant.')) {
      const key = String(change.property).slice('variant.'.length);
      return element.getAttribute(
        `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      );
    }
    if (String(change.property).startsWith('component.variant.create.')) {
      const key = String(change.property).slice('component.variant.create.'.length);
      return element.getAttribute(
        `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      );
    }
    return (
      (element.ownerDocument.defaultView?.getComputedStyle(element) as any)?.[change.property] ??
      null
    );
  }

  const typographyVerificationProperties = new Set([
    'fontFamily',
    'fontWeight',
    'fontStyle',
    'fontSize',
    'lineHeight',
    'letterSpacing',
    'wordSpacing',
    'textIndent',
    'fontVariationSettings',
  ]);

  function typographyVerificationSnapshot(
    element: HTMLElement,
    change: any,
    context: TypographyVerificationContext,
  ) {
    const documentRoot = element.ownerDocument;
    const computed = documentRoot.defaultView!.getComputedStyle(element);
    const family = parseFontFamilyStack(computed.fontFamily)[0] ?? computed.fontFamily;
    const escapedFamily = family.replaceAll('"', '\\"');
    const fontCheck = documentRoot.fonts.check(
      `${computed.fontStyle} ${computed.fontWeight} 16px "${escapedFamily}"`,
    );
    const integration = parseFontIntegrationPlan(change.evidence);
    const matchingFaces = [...documentRoot.fonts].filter(
      (face) =>
        parseFontFamilyStack(face.family)[0]?.toLocaleLowerCase() === family.toLocaleLowerCase(),
    );
    const fontLoaded = integration
      ? fontCheck && matchingFaces.some((face) => face.status === 'loaded')
      : fontCheck;
    const clipsX = ['hidden', 'clip'].includes(computed.overflowX);
    const clipsY = ['hidden', 'clip'].includes(computed.overflowY);
    const clipped =
      (clipsX && element.scrollWidth > element.clientWidth + 1) ||
      (clipsY && element.scrollHeight > element.clientHeight + 1);
    return {
      ...context,
      value: renderedValue(element, change),
      family,
      weight: computed.fontWeight,
      style: computed.fontStyle,
      axes: computed.fontVariationSettings,
      fontLoaded,
      width: Number(element.getBoundingClientRect().width.toFixed(2)),
      height: Number(element.getBoundingClientRect().height.toFixed(2)),
      lineCount: measuredTextLineCount(element) ?? 1,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      clipped,
    };
  }

  async function verify(changeIds: string[], runId: string, claimAttemptId: string): Promise<void> {
    if (!sessionId || !token) {
      showToast('Session connection is missing');
      return;
    }
    const session = await sessionRequest();
    const run = session.applyRuns?.find((candidate: any) => candidate.id === runId);
    if (!run || run.claimAttemptId !== claimAttemptId || run.state !== 'verifying') {
      throw new Error('The Apply claim changed before rendered verification began');
    }
    if (!run.reviewedChangeSet) {
      throw new Error('The frozen reviewed contract is unavailable');
    }
    const changes = run.reviewedChangeSet.changes.filter((change: any) =>
      changeIds.includes(change.id),
    );
    await waitForStableGeometry(changes);
    const results: any[] = [];
    for (const change of changes) {
      const contexts = verificationContextsForChange(change);
      const typographyVerification =
        typographyVerificationProperties.has(change.property) &&
        parseTypographyVerificationContexts(change.evidence).length > 0;
      for (const context of contexts) {
        const verificationContext = await verificationDocument(
          change,
          context,
          run.reviewedChangeSet.context,
        );
        try {
          const documentRoot = verificationContext.documentRoot;
          const resolvedElement = documentRoot
            ? resolveFoundrySelector(documentRoot, change.target.locator.selector)
            : null;
          const resolvedSource = resolvedElement
            ? parseSource(resolvedElement.dataset.foundrySource)
            : undefined;
          const element =
            resolvedElement &&
            rebuiltTargetIdentityMatches(change.target, {
              foundryId: resolvedElement.dataset.foundryId,
              componentPath:
                resolvedElement.dataset.foundryComponent?.split('/').filter(Boolean) ?? [],
              source: resolvedSource
                ? {
                    ...resolvedSource,
                    ...(resolvedElement.dataset.foundrySourceAnchor
                      ? { symbol: resolvedElement.dataset.foundrySourceAnchor }
                      : {}),
                  }
                : undefined,
            })
              ? resolvedElement
              : null;
          let geometry: any = undefined;
          let visibleGeometry = false;
          if (element) {
            const rect = element.getBoundingClientRect();
            const view = element.ownerDocument.defaultView;
            geometry = {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              scale: element.ownerDocument.defaultView?.devicePixelRatio || 1,
            };
            visibleGeometry =
              Number.isFinite(rect.width) &&
              Number.isFinite(rect.height) &&
              rect.width > 0 &&
              rect.height > 0 &&
              rect.right > 0 &&
              rect.bottom > 0 &&
              rect.left < (view?.innerWidth ?? Number.POSITIVE_INFINITY) &&
              rect.top < (view?.innerHeight ?? Number.POSITIVE_INFINITY);
          }
          const evidence = element
            ? [
                `Resolved ${change.target.locator.selector} in the isolated verification frame.`,
                ...Object.values(verificationContext.contextResult?.axes ?? {}).flatMap(
                  (axis: any) => axis.evidence ?? [],
                ),
              ]
            : [];
          if (typographyVerification) {
            const snapshot = element
              ? typographyVerificationSnapshot(element, change, context)
              : null;
            const valueMismatch = Boolean(
              snapshot && !typographyPropertyMatches(change.property, snapshot.value, change.after),
            );
            const missingFont = Boolean(snapshot && !snapshot.fontLoaded);
            const clipped = Boolean(snapshot?.clipped);
            const passed = Boolean(
              snapshot && visibleGeometry && !valueMismatch && !missingFont && !clipped,
            );
            const failures = [
              !documentRoot
                ? verificationContext.failureReason ||
                  'The reviewed validation context could not be reproduced'
                : '',
              documentRoot && !element ? 'The target locator did not resolve in this context' : '',
              valueMismatch ? 'The rendered value differs from the reviewed value' : '',
              missingFont ? 'The requested font face did not report loaded' : '',
              clipped ? 'text clips in one or more validation contexts' : '',
              snapshot && !visibleGeometry ? 'the target is not visible in the viewport' : '',
            ].filter(Boolean);
            results.push({
              applyRunId: runId,
              claimAttemptId,
              changeId: change.id,
              property: change.property,
              requested: change.after,
              rendered: {
                value: snapshot?.value ?? null,
                family: snapshot?.family ?? null,
                weight: snapshot?.weight ?? null,
                style: snapshot?.style ?? null,
                axes: snapshot?.axes ?? null,
                contexts: snapshot ? [snapshot] : [],
              },
              context,
              passed,
              reason: passed
                ? undefined
                : failures.length
                  ? failures.join('; ')
                  : 'Typography verification did not complete',
              geometry,
              evidence,
              verifiedAt: new Date().toISOString(),
            });
            continue;
          }
          const rendered = element ? renderedValue(element, change) : null;
          const expected =
            typeof change.after === 'number' && change.unit
              ? `${change.after}${change.unit}`
              : change.after;
          const passed = Boolean(
            element &&
            visibleGeometry &&
            rebuiltPropertyValueMatches(change.property, rendered, expected),
          );
          results.push({
            applyRunId: runId,
            claimAttemptId,
            changeId: change.id,
            property: change.property,
            requested: change.after,
            rendered,
            context,
            passed,
            reason: !documentRoot
              ? verificationContext.failureReason ||
                'The recorded responsive or state context could not be reproduced'
              : element
                ? passed
                  ? undefined
                  : 'Rendered value differs from requested value'
                : 'Target locator no longer resolves',
            geometry,
            evidence,
            verifiedAt: new Date().toISOString(),
          });
        } finally {
          verificationContext.cleanup();
        }
      }
    }
    const challenge = await sessionRequest(
      `/apply-runs/${encodeURIComponent(runId)}/verification-challenge`,
      {
        method: 'POST',
        body: JSON.stringify({ claimAttemptId, previewCapability }),
      },
    );
    const payload = await sessionRequest('/verify', {
      method: 'POST',
      body: JSON.stringify({
        source: 'browser-preview',
        runId,
        claimAttemptId,
        challenge: challenge.challenge,
        results,
      }),
    });
    if (workspaceState.reviewOpen) renderReviewPayload(payload);
    showToast(
      `${results.filter((result: any) => result.passed).length}/${results.length} contexts verified`,
    );
  }

  function installPanelResizer(): void {
    const resizer = shadow.querySelector<HTMLButtonElement>('.panel-resizer')!;
    resizer.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || window.matchMedia('(max-width: 680px)').matches) return;
      const startX = event.clientX;
      const startWidth = dockWidth;
      resizer.setPointerCapture(event.pointerId);
      event.preventDefault();
      const move = (pointer: PointerEvent): void => {
        const maximum = Math.min(520, window.innerWidth - 24);
        const next = Math.max(340, Math.min(maximum, startWidth + startX - pointer.clientX));
        dockWidth = Math.round(next);
        host.style.setProperty('--fdc-dock-width', `${dockWidth}px`);
        positionWorkspaceSurfaces();
      };
      const finish = (pointer: PointerEvent): void => {
        resizer.removeEventListener('pointermove', move);
        resizer.removeEventListener('pointerup', finish);
        resizer.removeEventListener('pointercancel', finish);
        if (resizer.hasPointerCapture(pointer.pointerId))
          resizer.releasePointerCapture(pointer.pointerId);
        localStorage.setItem(dockWidthKey, String(dockWidth));
        localStorage.removeItem(legacyDockWidthKey);
      };
      resizer.addEventListener('pointermove', move);
      resizer.addEventListener('pointerup', finish);
      resizer.addEventListener('pointercancel', finish);
    });
  }

  function installRadiusHandle(): void {
    const handle = shadow.querySelector<HTMLButtonElement>('.radius-handle')!;
    handle.addEventListener('pointerdown', (event) => {
      if (!selected || event.button !== 0) return;
      const element = selected;
      const control = simpleStyleControl(element, 'borderRadius', 'Corner radius', 'effects', 'px');
      const before = Number(control.read()) || 0;
      const startX = event.clientX;
      const startY = event.clientY;
      let after = before;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      const move = (pointer: PointerEvent): void => {
        after = Math.max(
          0,
          Math.round(before + (pointer.clientX - startX + pointer.clientY - startY) / 2),
        );
        control.apply(after);
        updateOutline();
      };
      const finish = (pointer: PointerEvent): void => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', finish);
        handle.removeEventListener('pointercancel', finish);
        if (handle.hasPointerCapture(pointer.pointerId))
          handle.releasePointerCapture(pointer.pointerId);
        if (after !== before) {
          pushHistory({
            element,
            property: 'borderRadius',
            before,
            after,
            unit: 'px',
            category: 'effects',
            label: 'Corner radius',
          });
          void record(control, before, after, element, 'Adjust corner radius');
        }
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', finish);
      handle.addEventListener('pointercancel', finish);
    });
  }

  function beginTextEditing(element: HTMLElement): void {
    if (!directText(element) || ['INPUT', 'TEXTAREA'].includes(element.tagName)) return;
    const before = element.textContent ?? '';
    const previousEditable = element.getAttribute('contenteditable');
    element.setAttribute('contenteditable', 'true');
    element.focus();
    const selection = element.ownerDocument.getSelection();
    selection?.selectAllChildren(element);
    const finish = (): void => {
      element.removeEventListener('blur', finish);
      if (previousEditable == null) element.removeAttribute('contenteditable');
      else element.setAttribute('contenteditable', previousEditable);
      const after = element.textContent ?? '';
      if (after === before) return;
      const control: Control = {
        category: 'content',
        property: 'textContent',
        label: 'Text',
        kind: 'text',
        value: before,
        read: () => element.textContent ?? '',
        apply: (value) => {
          element.textContent = String(value);
        },
      };
      pushHistory({
        element,
        property: 'textContent',
        before,
        after,
        category: 'content',
        label: 'Text',
      });
      void record(control, before, after, element, 'Edit text on canvas');
      select(element);
    };
    element.addEventListener('blur', finish);
  }

  function handleTextEdit(event: MouseEvent): void {
    if (!(event.target instanceof HTMLElement) || event.target !== selected) return;
    event.preventDefault();
    event.stopPropagation();
    beginTextEditing(event.target);
  }

  document.addEventListener('click', handlePointer, true);
  document.addEventListener('dblclick', handleTextEdit, true);
  document.addEventListener('pointermove', handleSelectionHover, true);
  document.addEventListener('keydown', nudgeSelection);
  document.addEventListener('keyup', commitNudge);
  window.addEventListener('scroll', updateOutline, true);
  const handleWorkspaceResize = (): void => {
    updateOutline();
    positionWorkspaceSurfaces();
  };
  window.addEventListener('resize', handleWorkspaceResize);
  renderToolTabs();
  renderSelectionEmptyState();
  installResizeHandles();
  installRadiusHandle();
  installPanelResizer();
  updateHistoryActions();
  updateInspectionMode();
  inspectButton.addEventListener('click', () => {
    inspecting = true;
    updateInspectionMode();
    showToast('Select mode on · click any element');
  });
  interactButton.addEventListener('click', () => {
    inspecting = false;
    updateInspectionMode();
    showToast('Interaction mode on · use the app normally');
  });
  const toggleStatusPopover = (): void => {
    statusPopover.hidden = !statusPopover.hidden;
    sessionStatus.setAttribute('aria-expanded', String(!statusPopover.hidden));
  };
  sessionStatus.addEventListener('click', toggleStatusPopover);
  sessionStatus.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleStatusPopover();
    }
  });
  statusPopover
    .querySelector<HTMLButtonElement>('[data-status-retry]')!
    .addEventListener('click', () => void hydrateSession());
  statusPopover
    .querySelector<HTMLButtonElement>('[data-status-checklist]')!
    .addEventListener('click', () => {
      localStorage.removeItem(onboardingStorageKey('dismissed'));
      renderOnboardingChecklist(true);
      statusPopover.hidden = true;
      sessionStatus.setAttribute('aria-expanded', 'false');
    });
  statusPopover
    .querySelector<HTMLButtonElement>('[data-status-diagnostics]')!
    .addEventListener('click', () => {
      const diagnostics = createSafeDiagnostics({
        protocolVersion: DIAGNOSTICS_PROTOCOL_VERSION,
        interfaceTheme: resolvedInterfaceTheme(),
        runtimeConnected,
        agentConnected: activeAgentPresence.connected,
        agentName: activeAgentPresence.presence?.agent?.name,
        selectedCount: selectedElements.length,
        recordedChangeCount,
        latestApplyState,
      });
      void navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      showToast('Privacy-safe diagnostics copied');
    });
  statusPopover
    .querySelector<HTMLButtonElement>('[data-status-repair]')!
    .addEventListener('click', () => {
      void navigator.clipboard.writeText('npx foundry-design doctor --repair');
      showToast('Repair command copied');
    });
  interfaceThemeTrigger.addEventListener('click', () => {
    if (interfaceThemeMenu.hidden) openInterfaceThemeMenu();
    else closeInterfaceThemeMenu();
  });
  interfaceThemeMenu
    .querySelectorAll<HTMLButtonElement>('[data-interface-theme-choice]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        applyInterfaceTheme(button.dataset.interfaceThemeChoice as InterfaceThemePreference);
        closeInterfaceThemeMenu(true);
      }),
    );
  changeDock.querySelector('.dock-undo')?.addEventListener('click', () => void replayHistory(-1));
  changeDock.querySelector('.dock-review')?.addEventListener('click', () => void openReview());
  onboarding.querySelector('.onboarding-close')?.addEventListener('click', () => {
    localStorage.setItem(onboardingStorageKey('dismissed'), '1');
    onboarding.hidden = true;
  });
  onboarding.querySelector('.onboarding-start')?.addEventListener('click', () => {
    const action = onboarding.querySelector<HTMLButtonElement>('.onboarding-start')?.dataset.action;
    if (action === 'agent') {
      void navigator.clipboard.writeText(
        'Start Foundry for this project and keep listening for Apply with agent requests.',
      );
      showToast('Listener prompt copied');
      return;
    }
    if (action === 'apply' && recordedChangeCount > 0) {
      onboarding.hidden = true;
      void openReview();
      return;
    }
    if (action === 'done') {
      onboarding.hidden = true;
      return;
    }
    onboarding.hidden = true;
    inspecting = true;
    updateInspectionMode();
    showToast(
      action === 'change'
        ? 'Adjust any Inspector value to record a change'
        : 'Select mode stays on · click any element to begin',
    );
  });
  onboarding.querySelector('.onboarding-shortcuts')?.addEventListener('click', () => {
    onboarding.hidden = true;
    openCommands();
  });
  canvasVariant.addEventListener('change', () => {
    const component = selectedComponent();
    const variant = component?.variants.find((item) => item.id === canvasVariant.value);
    if (!selected || !variant) return;
    for (const [key, value] of Object.entries(variant.props)) {
      const attribute = `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
      const before = selected.getAttribute(attribute) ?? '';
      selected.setAttribute(attribute, String(value));
      const control: Control = {
        category: 'content',
        property: `variant.${key}`,
        label: `${component!.name} ${key}`,
        kind: 'text',
        value: before,
        read: () => selected?.getAttribute(attribute) ?? '',
        apply: (next) => selected?.setAttribute(attribute, String(next)),
      };
      void record(control, before, String(value), selected, `Set ${variant.name} variant`);
    }
    showToast(`${variant.name} variant previewed`);
  });
  shadow.querySelector('.toggle-layers')?.addEventListener('click', () => toggleLayers());
  shadow.querySelector('.close-layers')?.addEventListener('click', () => toggleLayers(false));
  toggleLayers(sessionStorage.getItem(layersPreferenceKey) !== 'closed', false);
  shadow
    .querySelectorAll<HTMLButtonElement>('.toggle-inspector')
    .forEach((button) => button.addEventListener('click', () => toggleInspector()));
  toggleInspector(true);
  layerViewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      layerView = button.dataset.layerView === 'components' ? 'components' : 'layers';
      sessionStorage.setItem(layerViewPreferenceKey, layerView);
      layerSearch.value = '';
      layerTree.scrollTop = 0;
      renderLayers();
    });
  });
  shadow
    .querySelector('.open-health')
    ?.addEventListener('click', () =>
      workspaceState.utility === 'health' ? closeHealth() : openHealth(),
    );
  shadow.querySelector('.close-health')?.addEventListener('click', closeHealth);
  shadow.querySelector('.health-rescan')?.addEventListener('click', scanDesignHealth);
  shadow.querySelector('.health-show-ignored')?.addEventListener('click', () => {
    ignoredHealthIssues.clear();
    localStorage.removeItem('__foundry_health_ignored');
    renderHealthPanel();
  });
  shadow
    .querySelector('.open-library')
    ?.addEventListener('click', () =>
      libraryPanel.hidden ? openDesignMemory() : closeDesignMemory(),
    );
  libraryPanel.querySelector('.close-library')?.addEventListener('click', closeDesignMemory);
  shadow
    .querySelector('.open-component-workshop')
    ?.addEventListener('click', () =>
      componentWorkshopPanel.hidden ? openComponentWorkshop() : closeComponentWorkshop(),
    );
  componentWorkshopPanel
    .querySelector('.close-component-workshop')
    ?.addEventListener('click', closeComponentWorkshop);
  componentWorkshopPanel.querySelector('[data-workshop-matrix]')?.addEventListener('click', () => {
    closeComponentWorkshop();
    openWorkbench();
    if (!matrixMode) toggleWorkbenchMatrix();
  });
  componentWorkshopPanel
    .querySelector('[data-workshop-review]')
    ?.addEventListener('click', () => void openReview());
  libraryPanel
    .querySelector('[data-save-recipe]')
    ?.addEventListener('click', () => saveSelectedRecipe());
  libraryPanel
    .querySelector('[data-capture-baseline]')
    ?.addEventListener('click', saveManualBaseline);
  installUtilityGeometry(healthPanel, 'health');
  installUtilityGeometry(libraryPanel, 'memory');
  installUtilityGeometry(componentWorkshopPanel, 'component');
  layerSearch.addEventListener('input', () => renderLayers());
  layerTree.addEventListener('scroll', () => {
    cancelAnimationFrame(layerScrollFrame);
    layerScrollFrame = requestAnimationFrame(() => renderLayers(false));
  });
  selectParentButton.addEventListener('click', () => {
    const parent = nearestLayerParent(selected);
    if (parent) select(parent);
  });
  selectChildButton.addEventListener('click', () => {
    const child = firstLayerChild(selected);
    if (child) select(child);
  });
  trayCompare.addEventListener('click', () => showComparison('after'));
  shadow.querySelector('.open-commands')?.addEventListener('click', openCommands);
  compareBar.querySelectorAll<HTMLButtonElement>('[data-compare]').forEach((button) =>
    button.addEventListener('click', () => {
      const action = button.dataset.compare;
      if (action === 'before' || action === 'after') showComparison(action);
      if (action === 'split') openSplitComparison();
      if (action === 'isolate') toggleComparisonIsolation();
      if (action === 'reset') void resetSelectedPreview();
      if (action === 'close') closeComparison();
    }),
  );
  compareBar
    .querySelector<HTMLInputElement>('[data-compare-scrub]')!
    .addEventListener('input', (event) =>
      scrubComparison(Number((event.currentTarget as HTMLInputElement).value)),
    );
  comparisonStage
    .querySelector<HTMLButtonElement>('[data-close-comparison-stage]')!
    .addEventListener('click', closeSplitComparison);
  const commandInput = commandPalette.querySelector<HTMLInputElement>('input')!;
  commandPalette.querySelector('.close-commands')?.addEventListener('click', () => closeCommands());
  commandInput.addEventListener('input', () => renderCommands(commandInput.value));
  commandInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const active = commandPalette.querySelector<HTMLButtonElement>('.command-item.active');
      if (active) runCommand(active.dataset.command!);
    }
    if (event.key === 'Escape') closeCommands();
  });
  shadow.querySelector('.close')?.addEventListener('click', destroyInspector);
  shadow.querySelector('.open-workbench')?.addEventListener('click', openWorkbench);
  shadow.querySelector('.close-workbench')?.addEventListener('click', closeWorkbench);
  shadow
    .querySelector<HTMLButtonElement>('[data-workbench-matrix]')!
    .addEventListener('click', toggleWorkbenchMatrix);
  shadow
    .querySelector<HTMLIFrameElement>('.frame-shell iframe')!
    .addEventListener('load', applyWorkbenchState);
  shadow
    .querySelector<HTMLSelectElement>('[data-workbench-viewport]')!
    .addEventListener('change', resizeWorkbench);
  shadow
    .querySelector<HTMLSelectElement>('[data-workbench-theme]')!
    .addEventListener('change', applyWorkbenchState);
  shadow
    .querySelector<HTMLElement>('[data-workbench-states]')!
    .addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-workbench-state]');
      if (!button || button.disabled) return;
      const requestedState = button.dataset.workbenchState ?? 'current';
      workbenchStateId = button.classList.contains('active') ? 'current' : requestedState;
      shadow.querySelectorAll<HTMLButtonElement>('[data-workbench-state]').forEach((item) => {
        const active = item.dataset.workbenchState === workbenchStateId;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      applyWorkbenchState();
    });
  shadow.querySelector('.undo')?.addEventListener('click', () => void replayHistory(-1));
  shadow.querySelector('.redo')?.addEventListener('click', () => void replayHistory(1));
  shadow.querySelector('.align')?.addEventListener('click', () => void alignSelected());
  shadow.querySelector('.distribute')?.addEventListener('click', () => void distributeSelected());
  shadow.querySelector('.review-back')?.addEventListener('click', () => closeReview());
  reviewCancel.addEventListener('click', () => {
    if (reviewCancel.dataset.action === 'cancel') void cancelRun();
    else closeReview();
  });
  applyButton.addEventListener('click', () => {
    if (applyButton.dataset.action === 'apply') void submitReviewedRun();
    if (applyButton.dataset.action === 'retry') void retryRun();
    if (applyButton.dataset.action === 'resume') void resumeRun();
    if (applyButton.dataset.action === 'reconnect') copyAgentListenerInstruction();
  });
  function handleGlobalShortcuts(event: KeyboardEvent): void {
    if (workspaceState.reviewOpen && event.key === 'Tab') {
      const focusable = [
        ...reviewModal.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.offsetParent !== null);
      if (focusable.length) {
        const first = focusable[0]!;
        const last = focusable.at(-1)!;
        if (event.shiftKey && shadow.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && shadow.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    const editable =
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openCommands();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      void replayHistory(event.shiftKey ? 1 : -1);
      return;
    }
    if (editable) return;
    if (event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      toggleLayers();
      return;
    }
    if (event.shiftKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      componentWorkshopPanel.hidden ? openComponentWorkshop() : closeComponentWorkshop();
      return;
    }
    if (event.shiftKey && event.key.toLowerCase() === 'h') {
      event.preventDefault();
      healthPanel.hidden ? openHealth() : closeHealth();
      return;
    }
    if (event.shiftKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      comparisonActive ? closeComparison() : showComparison('after');
      return;
    }
    if (event.key === '[') {
      const parent = nearestLayerParent(selected);
      if (parent) select(parent);
      return;
    }
    if (event.key === ']') {
      const child = firstLayerChild(selected);
      if (child) select(child);
      return;
    }
    if (event.key !== 'Escape') return;
    if (workspaceState.reviewOpen) {
      const nested = reviewModal.querySelector<HTMLDetailsElement>('details[open]');
      if (nested) nested.open = false;
      else closeReview();
      return;
    }
    if (!interfaceThemeMenu.hidden) closeInterfaceThemeMenu(true);
    else if (!colorPopover.hidden) {
      colorPopover.hidden = true;
      activeColor = undefined;
    } else if (!typographyPopover.hidden) closeTypographyStudio(true);
    else if (!comparisonStage.hidden) closeSplitComparison();
    else if (!commandPalette.hidden) closeCommands();
    else if (!componentWorkshopPanel.hidden) closeComponentWorkshop();
    else if (!libraryPanel.hidden) closeDesignMemory();
    else if (!healthPanel.hidden) closeHealth();
    else if (comparisonActive) closeComparison();
    else if (!workbench.hidden) closeWorkbench();
    else clearSelection();
  }
  document.addEventListener('keydown', handleGlobalShortcuts);
  if (!verificationChild && !componentSpecimen && sessionStorage.getItem('__foundry_verifying_run'))
    void openReview();
  let mutationFrame = 0;
  const layerMutationObserver = new MutationObserver(() => {
    cancelAnimationFrame(mutationFrame);
    mutationFrame = requestAnimationFrame(() => {
      if (selected && !selected.isConnected) {
        const selector = sessionStorage.getItem('__foundry_selected_selector');
        const replacement = selector ? resolveFoundrySelector(document, selector) : null;
        if (replacement) select(replacement);
        else clearSelection();
      }
      if (!layersPanel.hidden) renderLayers();
      if (!healthPanel.hidden) scanDesignHealth();
      if (!componentWorkshopPanel.hidden) renderComponentWorkshop();
    });
  });
  layerMutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
  const persistedSelector = sessionStorage.getItem('__foundry_selected_selector');
  if (persistedSelector && !componentSpecimen) {
    try {
      const persistedElement = resolveFoundrySelector(document, persistedSelector);
      if (persistedElement) select(persistedElement);
    } catch {
      sessionStorage.removeItem('__foundry_selected_selector');
    }
  }
  if (embeddedWorkspace) {
    discoverLayers();
    publishWorkspaceState();
  }

  // This lease is issued by the preview itself, after session hydration. A page
  // returning HTTP 200 or an inspector-side status label is not preview evidence.
  let readinessStopped = false;
  let readinessPending = false;
  async function publishPreviewPresence(connected = true): Promise<void> {
    // Branch comparisons and unmarked auxiliary embeds are not Canvas liveness
    // evidence, even though the backward-compatible frame-kind union has no
    // branch member. Their own acknowledged commands still report availability.
    if (readinessFrameKind === 'canvas' && !ownsApplyVerification()) return;
    if (
      !sessionId ||
      !token ||
      !previewCapability ||
      (connected && (!hydratedOnce || readinessStopped || readinessPending))
    )
      return;
    readinessPending = true;
    try {
      const targets = connected
        ? collectLayerElements(document).filter(meaningfulLayer).slice(0, 10_000)
        : [];
      await fetch(`${runtimeUrl}/v1/sessions/${encodeURIComponent(sessionId)}/preview-presence`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-foundry-token': token },
        signal: AbortSignal.timeout(1800),
        body: JSON.stringify({
          version: 1,
          previewCapability,
          frameId: readinessFrameId,
          frameKind: readinessFrameKind,
          protocolVersion: PROTOCOL_VERSION,
          adapterVersion: packageJson.version,
          targetCount: targets.length,
          mappedTargetCount: targets.filter((element) =>
            Boolean(parseSource(element.dataset.foundrySource)),
          ).length,
          connected,
        }),
      });
    } catch {
      // The runtime expires the last acknowledgement; no optimistic success.
    } finally {
      readinessPending = false;
    }
  }
  const readinessHeartbeat = window.setInterval(() => void publishPreviewPresence(), 2000);
  void publishPreviewPresence();

  function destroyInspector(): void {
    cancelInspectorDraft();
    clearInspectorFocus();
    readinessStopped = true;
    window.clearInterval(readinessHeartbeat);
    void publishPreviewPresence(false);
    restorePreviewState();
    restoreConfiguredPreviewTheme();
    restoreTypographyPreview();
    resizeObserver?.disconnect();
    fdcSelectObserver.disconnect();
    closeFdcSelect(false);
    cancelAnimationFrame(layerScrollFrame);
    cancelAnimationFrame(mutationFrame);
    layerMutationObserver.disconnect();
    systemDarkTheme.removeEventListener('change', handleSystemThemeChange);
    window.removeEventListener('message', handleWorkspaceMessage);
    document.removeEventListener('keydown', handleEmbeddedCanvasKeyDown, true);
    document.removeEventListener('keyup', handleEmbeddedCanvasKeyUp, true);
    document.removeEventListener('pointerdown', handleEmbeddedCanvasPointerDown, true);
    document.removeEventListener('pointermove', handleEmbeddedCanvasPointerMove, true);
    document.removeEventListener('pointerup', handleEmbeddedCanvasPointerUp, true);
    document.removeEventListener('pointercancel', handleEmbeddedCanvasPointerUp, true);
    document.removeEventListener('wheel', handleEmbeddedCanvasWheel, true);
    document.removeEventListener('pointerdown', handleInterfaceThemeDismiss, true);
    document.removeEventListener('pointerdown', handleFdcSelectDismiss, true);
    shadow.removeEventListener('keydown', handleFdcSelectKeydown);
    window.removeEventListener('resize', closeFdcSelectForViewportChange);
    window.removeEventListener('scroll', closeFdcSelectForViewportChange, true);
    clearInterval(reviewPoll);
    clearInterval(sessionPoll);
    document.removeEventListener('click', handlePointer, true);
    document.removeEventListener('dblclick', handleTextEdit, true);
    document.removeEventListener('pointermove', handleSelectionHover, true);
    document.removeEventListener('keydown', nudgeSelection);
    document.removeEventListener('keyup', commitNudge);
    document.removeEventListener('keydown', handleGlobalShortcuts);
    window.removeEventListener('scroll', updateOutline, true);
    window.removeEventListener('resize', handleWorkspaceResize);
    cancelAnimationFrame(selectionHoverFrame);
    cancelAnimationFrame(workspacePublishFrame);
    host.remove();
  }

  return {
    inspect() {
      inspecting = true;
      updateInspectionMode();
    },
    stopInspecting() {
      inspecting = false;
      updateInspectionMode();
    },
    select,
    destroy: destroyInspector,
  };
}
