import { cssPath, parseSource, targetId } from './locator.js';
import { createDebouncedChangeRecorder } from './recording.js';

export interface FoundryInspectorOptions {
  runtimeUrl?: string;
  sessionId?: string;
  token?: string;
  startInspecting?: boolean;
}

export interface FoundryInspectorController {
  inspect(): void;
  stopInspecting(): void;
  select(element: HTMLElement): void;
  destroy(): void;
}

type Category =
  'layout' | 'typography' | 'color' | 'effects' | 'content' | 'accessibility' | 'motion';
type ControlKind = 'number' | 'text' | 'color' | 'select';

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
  :host { all:initial; --fdc-ink:#171b1d; --fdc-paper:#f7f9f8; --fdc-surface:#ffffff; --fdc-subtle:#eef1ef; --fdc-line:#d5dbd8; --fdc-signal:#3659f4; --fdc-signal-soft:#e8ecff; --fdc-muted:#66706d; font-family:"Avenir Next",Avenir,"Helvetica Neue",sans-serif; color:var(--fdc-ink); }
  * { box-sizing:border-box; }
  button,select,input { font:inherit; }
  button:focus-visible,select:focus-visible,input:focus-visible { outline:2px solid var(--fdc-signal);outline-offset:2px; }
  .outline { position:fixed;z-index:2147483645;pointer-events:none;border:1.5px solid var(--fdc-signal);box-shadow:0 0 0 1px rgb(255 255 255 / 90%),0 0 0 4px rgb(54 89 244 / 12%);transition:top 80ms linear,left 80ms linear,width 80ms linear,height 80ms linear; }
  .measure { position:absolute;left:-2px;top:-28px;height:25px;display:flex;align-items:center;padding:0 9px;color:white;background:var(--fdc-signal);border-radius:5px 5px 5px 0;font:650 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.02em;white-space:nowrap;box-shadow:0 4px 14px rgb(25 43 124 / 20%); }
  .cross::before,.cross::after { content:"";position:absolute;background:var(--fdc-signal); }.cross::before { width:11px;height:1px;left:-6px;top:-1px; }.cross::after { width:1px;height:11px;left:-1px;top:-6px; }
  .panel { position:fixed;z-index:2147483646;top:16px;right:16px;width:392px;max-height:calc(100vh - 32px);overflow:hidden;display:flex;flex-direction:column;color:var(--fdc-ink);background:var(--fdc-paper);border:1px solid rgb(117 128 123 / 32%);box-shadow:0 24px 80px rgb(23 30 27 / 22%),0 2px 8px rgb(23 30 27 / 8%);pointer-events:auto;border-radius:12px; }
  .top { display:flex;align-items:center;min-height:60px;padding:0 14px 0 16px;background:var(--fdc-surface);border-bottom:1px solid var(--fdc-line); }
  .brand { display:flex;align-items:center;gap:10px;min-width:0; }.brand-mark { width:16px;height:17px;display:flex;align-items:flex-end;gap:2px; }.brand-mark i { display:block;width:4px;background:var(--fdc-signal);border-radius:2px 2px 1px 1px; }.brand-mark i:nth-child(1){height:8px}.brand-mark i:nth-child(2){height:16px}.brand-mark i:nth-child(3){height:11px}
  .brand-copy { display:flex;flex-direction:column;gap:2px; }.brand-copy b { font-size:13px;line-height:1;font-weight:750;letter-spacing:-.02em; }.brand-copy span { color:var(--fdc-muted);font:500 9px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.05em;text-transform:uppercase; }
  .session-status { margin-left:auto;display:flex;align-items:center;gap:6px;padding:5px 8px;color:#236c59;background:#e8f6f1;border-radius:999px;font:650 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em; }.session-status i { width:6px;height:6px;background:#2ca67f;border-radius:50%;box-shadow:0 0 0 3px rgb(44 166 127 / 13%); }.session-status.offline { color:#8b4d3d;background:#faece7; }.session-status.offline i { background:#d16d51;box-shadow:none; }
  .top-actions { display:flex;gap:3px;margin-left:7px; }.icon-button { width:32px;height:32px;border:0;border-radius:7px;background:transparent;color:var(--fdc-muted);cursor:pointer;font-size:16px;line-height:1; }.icon-button:hover { background:var(--fdc-subtle);color:var(--fdc-ink); }.icon-button.active { color:white;background:var(--fdc-signal);box-shadow:0 4px 14px rgb(54 89 244 / 24%); }
  .selection { padding:16px;background:var(--fdc-surface);border-bottom:1px solid var(--fdc-line);box-shadow:inset 3px 0 var(--fdc-signal); }.selection-heading { display:flex;align-items:center;justify-content:space-between;margin-bottom:7px; }.selection small { color:var(--fdc-signal);font:700 9px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.12em; }.selection-state { color:var(--fdc-muted);font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em; }.selection strong { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;line-height:1.25;letter-spacing:-.025em; }.selection code { display:block;margin-top:5px;overflow:hidden;text-overflow:ellipsis;color:var(--fdc-muted);font:10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap; }.selection-stats { display:flex;gap:6px;margin-top:11px; }.selection-stats[hidden] { display:none; }.selection-stats span { padding:5px 7px;color:#34403c;background:var(--fdc-subtle);border-radius:5px;font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.02em; }.selection-stats span:first-child { color:#2947c6;background:var(--fdc-signal-soft); }
  .scope { display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--fdc-line);border-bottom:1px solid var(--fdc-line); }.scope label { display:flex;flex-direction:column;gap:6px;padding:10px 11px;background:var(--fdc-paper);color:var(--fdc-muted);font:650 8px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.09em; }.scope select { width:100%;padding:0 16px 0 0;border:0;background:transparent;color:var(--fdc-ink);font:600 11px/1.3 "Avenir Next",Avenir,sans-serif;text-transform:none;letter-spacing:0;outline:none;cursor:pointer; }
  .tabs { display:flex;gap:4px;overflow-x:auto;padding:7px 8px;background:var(--fdc-subtle);border-bottom:1px solid var(--fdc-line);scrollbar-width:none; }.tab { flex:none;height:29px;padding:0 10px;border:0;border-radius:6px;background:transparent;color:var(--fdc-muted);font:650 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:capitalize;letter-spacing:.01em;cursor:pointer; }.tab:hover { color:var(--fdc-ink);background:rgb(255 255 255 / 70%); }.tab.active { color:#2947c6;background:var(--fdc-surface);box-shadow:0 1px 3px rgb(24 31 28 / 10%); }
  .controls { min-height:204px;overflow:auto;padding:4px 16px 18px;background:var(--fdc-paper); }.group-label { margin:16px 0 9px;color:var(--fdc-muted);font:650 9px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.1em; }.control { display:grid;grid-template-columns:minmax(0,1fr) 146px;align-items:center;gap:14px;min-height:46px;border-top:1px solid var(--fdc-line); }.control label { overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:560;white-space:nowrap; }.control-field { display:flex;align-items:center;min-height:32px;border:1px solid #cbd2ce;border-radius:7px;background:var(--fdc-surface);overflow:hidden;transition:border-color .15s ease,box-shadow .15s ease; }.control-field:focus-within { border-color:var(--fdc-signal);box-shadow:0 0 0 3px rgb(54 89 244 / 11%); }.control input,.control select { width:100%;height:31px;padding:0 9px;border:0;background:transparent;color:var(--fdc-ink);font:550 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;outline:none; }.control input[type=color] { padding:4px;height:31px; }.unit { padding-right:8px;color:var(--fdc-muted);font:9px/1 ui-monospace,SFMono-Regular,Menlo,monospace; }
  .motion-row { padding:13px 0;border-top:1px solid var(--fdc-line); }.motion-title { display:flex;justify-content:space-between;gap:12px;margin-bottom:10px;font-size:12px;font-weight:600; }.motion-title code { color:var(--fdc-muted);font:9px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace; }.motion-actions { display:flex;gap:6px; }.motion-actions button { min-height:30px;padding:0 10px;border:1px solid #cbd2ce;background:var(--fdc-surface);border-radius:7px;color:var(--fdc-ink);font-size:10px;font-weight:600;cursor:pointer; }.motion-actions button:hover { border-color:var(--fdc-signal);color:var(--fdc-signal); }
  .empty { padding:48px 28px;text-align:center;color:var(--fdc-muted);font-size:12px;line-height:1.6; }.empty::before { content:"⌖";display:grid;place-items:center;width:38px;height:38px;margin:0 auto 13px;color:var(--fdc-signal);background:var(--fdc-signal-soft);border-radius:10px;font:18px/1 ui-monospace,monospace; }
  .footer { display:grid;grid-template-columns:118px 1fr;gap:8px;padding:10px;background:var(--fdc-surface);border-top:1px solid var(--fdc-line); }.footer button { min-height:40px;border:1px solid var(--fdc-line);border-radius:8px;background:var(--fdc-surface);color:var(--fdc-ink);font-size:11px;font-weight:700;cursor:pointer; }.footer button:hover { border-color:#aab3af; }.footer .review { display:flex;align-items:center;justify-content:center;gap:8px;color:white;background:var(--fdc-ink);border-color:var(--fdc-ink);box-shadow:0 5px 14px rgb(23 27 29 / 13%); }.footer .review:hover { background:#282e31; }.change-count { min-width:18px;height:18px;display:inline-grid;place-items:center;padding:0 5px;color:var(--fdc-ink);background:white;border-radius:999px;font:750 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace; }.change-count[hidden] { display:none; }
  .toast { position:absolute;left:50%;bottom:64px;transform:translate(-50%,8px);padding:9px 12px;background:var(--fdc-ink);color:white;border-radius:7px;font-size:10px;font-weight:650;opacity:0;transition:.15s ease;pointer-events:none;white-space:nowrap;box-shadow:0 8px 28px rgb(23 27 29 / 24%); }.toast.show { opacity:1;transform:translate(-50%,0); }
  @media (max-width:680px){.panel{top:auto;right:8px;bottom:8px;left:8px;width:auto;max-height:64vh}.scope{display:none}.controls{min-height:170px}.footer{grid-template-columns:104px 1fr}}
  @media (prefers-reduced-motion:reduce){*{transition-duration:.01ms!important}}
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
): Control {
  return {
    category,
    property: String(property),
    label,
    kind: 'number',
    value: numberFrom(String(computed[property])),
    unit: 'px',
    min: 0,
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

function controlsFor(element: HTMLElement): Control[] {
  const computed = getComputedStyle(element);
  const controls: Control[] = [
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
    pxControl(element, computed, 'layout', 'gap', 'Gap', 160),
    pxControl(element, computed, 'layout', 'paddingTop', 'Padding top', 240),
    pxControl(element, computed, 'layout', 'paddingRight', 'Padding right', 240),
    pxControl(element, computed, 'layout', 'paddingBottom', 'Padding bottom', 240),
    pxControl(element, computed, 'layout', 'paddingLeft', 'Padding left', 240),
    pxControl(element, computed, 'layout', 'marginTop', 'Margin top', 240),
    pxControl(element, computed, 'layout', 'marginBottom', 'Margin bottom', 240),
    pxControl(element, computed, 'typography', 'fontSize', 'Font size', 200),
    styleControl(element, computed, 'typography', 'fontFamily', 'Font family'),
    styleControl(element, computed, 'typography', 'fontWeight', 'Font weight'),
    styleControl(element, computed, 'typography', 'lineHeight', 'Line height'),
    styleControl(element, computed, 'typography', 'letterSpacing', 'Letter spacing'),
    styleControl(element, computed, 'typography', 'textAlign', 'Text align', 'select', [
      'left',
      'center',
      'right',
      'justify',
    ]),
    styleControl(element, computed, 'color', 'color', 'Text color', 'color'),
    styleControl(element, computed, 'color', 'backgroundColor', 'Background', 'color'),
    pxControl(element, computed, 'effects', 'borderRadius', 'Corner radius', 200),
    pxControl(element, computed, 'effects', 'borderWidth', 'Border width', 32),
    styleControl(element, computed, 'effects', 'borderColor', 'Border color', 'color'),
    styleControl(element, computed, 'effects', 'boxShadow', 'Shadow'),
    styleControl(element, computed, 'effects', 'filter', 'Filter'),
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
  return controls;
}

function colorForInput(value: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d');
  if (!context) return '#000000';
  context.fillStyle = value;
  return context.fillStyle.startsWith('#') ? context.fillStyle : '#000000';
}

export function installFoundryInspector(
  options: FoundryInspectorOptions = {},
): FoundryInspectorController {
  const query = new URLSearchParams(location.search);
  const runtimeUrl = (options.runtimeUrl ?? 'http://127.0.0.1:4387').replace(/\/$/, '');
  const sessionId = options.sessionId ?? query.get('__foundry_session') ?? '';
  const token = options.token ?? query.get('__foundry_token') ?? '';
  const host = document.createElement('div');
  host.dataset.foundryOverlay = 'true';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${PANEL_CSS}</style><div class="outline" hidden><span class="cross"></span><span class="measure"></span></div><aside class="panel" aria-label="Foundry design inspector"><div class="top"><div class="brand"><span class="brand-mark"><i></i><i></i><i></i></span><span class="brand-copy"><b>Foundry</b><span>Design control</span></span></div><span class="session-status"><i></i><span>Live</span></span><div class="top-actions"><button class="icon-button inspect" title="Select element (Option-click)" aria-label="Select element">⌖</button><button class="icon-button close" title="Close inspector" aria-label="Close inspector">×</button></div></div><div class="selection"><div class="selection-heading"><small>Selection</small><span class="selection-state">Ready</span></div><strong>Nothing selected</strong><code>Hold ⌥ and click an element</code><div class="selection-stats" hidden><span data-selection-size></span><span data-selection-confidence></span></div></div><div class="scope"><label>Scope<select data-scope><option value="instance">Instance</option><option value="component">Component</option></select></label><label>Breakpoint<select data-breakpoint><option>current</option><option>mobile</option><option>tablet</option><option>desktop</option></select></label><label>Theme<select data-theme><option>current</option><option>light</option><option>dark</option></select></label></div><div class="tabs"></div><div class="controls"><div class="empty">Select an element to inspect its measured design controls.</div></div><div class="footer"><button class="verify">Verify</button><button class="review"><span>Review changes</span><span class="change-count" hidden>0</span></button></div><div class="toast"></div></aside>`;
  document.body.append(host);

  const outline = shadow.querySelector<HTMLElement>('.outline')!;
  const panel = shadow.querySelector<HTMLElement>('.panel')!;
  const tabs = shadow.querySelector<HTMLElement>('.tabs')!;
  const controlsRoot = shadow.querySelector<HTMLElement>('.controls')!;
  const inspectButton = shadow.querySelector<HTMLButtonElement>('.inspect')!;
  const sessionStatus = shadow.querySelector<HTMLElement>('.session-status')!;
  const selectionTitle = shadow.querySelector<HTMLElement>('.selection strong')!;
  const selectionCode = shadow.querySelector<HTMLElement>('.selection code')!;
  const selectionState = shadow.querySelector<HTMLElement>('.selection-state')!;
  const selectionStats = shadow.querySelector<HTMLElement>('.selection-stats')!;
  const selectionSize = shadow.querySelector<HTMLElement>('[data-selection-size]')!;
  const selectionConfidence = shadow.querySelector<HTMLElement>('[data-selection-confidence]')!;
  const changeCount = shadow.querySelector<HTMLElement>('.change-count')!;
  const scope = shadow.querySelector<HTMLSelectElement>('[data-scope]')!;
  const breakpoint = shadow.querySelector<HTMLSelectElement>('[data-breakpoint]')!;
  const theme = shadow.querySelector<HTMLSelectElement>('[data-theme]')!;
  let selected: HTMLElement | null = null;
  let inspecting = options.startInspecting ?? true;
  let activeCategory: Category = 'layout';
  let selectedControls: Control[] = [];
  let resizeObserver: ResizeObserver | undefined;

  if (!sessionId || !token) {
    sessionStatus.classList.add('offline');
    sessionStatus.querySelector('span')!.textContent = 'Offline';
  }

  function updateChangeCount(count: number): void {
    changeCount.textContent = String(count);
    changeCount.hidden = count === 0;
  }

  async function hydrateSession(): Promise<void> {
    if (!sessionId || !token) return;
    try {
      const response = await fetch(`${runtimeUrl}/v1/sessions/${sessionId}`, {
        headers: { 'x-foundry-token': token },
      });
      if (!response.ok) return;
      const { changeSet } = await response.json();
      updateChangeCount(
        changeSet.changes.filter((change: { status: string }) => change.status !== 'rejected')
          .length,
      );
    } catch {
      sessionStatus.classList.add('offline');
      sessionStatus.querySelector('span')!.textContent = 'Offline';
    }
  }

  void hydrateSession();

  function showToast(message: string): void {
    const toast = shadow.querySelector<HTMLElement>('.toast')!;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
  }

  function updateOutline(): void {
    if (!selected || !selected.isConnected) {
      outline.hidden = true;
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
  }

  function targetFor(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const source = parseSource(element.dataset.foundrySource);
    const label =
      element.dataset.foundryLabel ||
      element.getAttribute('aria-label') ||
      element.textContent?.trim().slice(0, 60) ||
      element.tagName.toLowerCase();
    return {
      id: targetId(element),
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
        selector: cssPath(element),
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
  ): Promise<void> {
    if (!selected || !sessionId || !token) {
      showToast('Session connection is missing');
      return;
    }
    const category =
      control.category === 'effects'
        ? 'effect'
        : control.category === 'typography'
          ? 'typography'
          : control.category === 'content' && control.property === 'src'
            ? 'asset'
            : control.category;
    const payload = {
      target: targetFor(selected),
      category,
      property: control.property,
      before,
      after,
      unit: control.unit,
      scope: scope.value,
      context: {
        breakpoint: breakpoint.value,
        theme: theme.value,
        state: 'current',
      },
      confidence: selected.dataset.foundrySource ? 'instrumented' : 'measured',
      evidence: ['live preview override', 'computed style'],
      status: 'draft',
    };
    const response = await fetch(`${runtimeUrl}/v1/sessions/${sessionId}/changes`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foundry-token': token,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) showToast((await response.json()).error ?? 'Could not record change');
    else {
      const { changeSet } = await response.json();
      updateChangeCount(
        changeSet.changes.filter((change: { status: string }) => change.status !== 'rejected')
          .length,
      );
      showToast('Change recorded');
    }
  }

  function renderControls(): void {
    const categories = [
      ...new Set<Category>([
        ...selectedControls.map((control) => control.category),
        ...(selected?.getAnimations().length ? ['motion' as const] : []),
      ]),
    ];
    tabs.innerHTML = categories
      .map(
        (category) =>
          `<button class="tab ${activeCategory === category ? 'active' : ''}" data-category="${category}">${category}</button>`,
      )
      .join('');
    tabs.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((button) =>
      button.addEventListener('click', () => {
        activeCategory = button.dataset.category as Category;
        renderControls();
      }),
    );
    if (activeCategory === 'motion') {
      const animations = selected?.getAnimations() ?? [];
      controlsRoot.innerHTML = animations.length
        ? `<p class="group-label">Active animations</p>${animations
            .map((animation, index) => {
              const timing = animation.effect?.getComputedTiming();
              return `<div class="motion-row" data-animation="${index}"><div class="motion-title"><span>Animation ${index + 1}</span><code>${Math.round(Number(timing?.duration ?? 0))} ms</code></div><div class="motion-actions"><button data-action="toggle">${animation.playState === 'paused' ? 'Play' : 'Pause'}</button><button data-action="slower">½ speed</button><button data-action="faster">2× speed</button><button data-action="restart">Restart</button></div></div>`;
            })
            .join('')}`
        : '<div class="empty">No CSS, transition, or Web Animation is active on this element.</div>';
      controlsRoot.querySelectorAll<HTMLElement>('[data-animation]').forEach((row) => {
        const animation = animations[Number(row.dataset.animation)];
        if (!animation) return;
        row.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) =>
          button.addEventListener('click', () => {
            const before = animation.playbackRate;
            if (button.dataset.action === 'toggle')
              animation.playState === 'paused' ? animation.play() : animation.pause();
            if (button.dataset.action === 'slower') animation.playbackRate *= 0.5;
            if (button.dataset.action === 'faster') animation.playbackRate *= 2;
            if (button.dataset.action === 'restart') animation.currentTime = 0;
            void record(
              {
                category: 'motion',
                property: `animation.${row.dataset.animation}.playbackRate`,
                label: 'Playback rate',
                kind: 'number',
                value: before,
                read: () => animation.playbackRate,
                apply: () => {},
              },
              before,
              animation.playbackRate,
            );
            renderControls();
          }),
        );
      });
      return;
    }
    const controls = selectedControls.filter((control) => control.category === activeCategory);
    controlsRoot.innerHTML = controls.length
      ? `<p class="group-label">${activeCategory} controls</p>${controls.map((control, index) => `<div class="control"><label for="fdc-${index}">${control.label}</label><div class="control-field">${control.kind === 'select' ? `<select id="fdc-${index}" data-control="${index}">${control.options?.map((option) => `<option ${String(control.value) === option ? 'selected' : ''}>${option}</option>`).join('')}</select>` : `<input id="fdc-${index}" data-control="${index}" type="${control.kind === 'color' ? 'color' : control.kind === 'number' ? 'number' : 'text'}" value="${control.kind === 'color' ? colorForInput(String(control.value)) : String(control.value).replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" ${control.min != null ? `min="${control.min}"` : ''} ${control.max != null ? `max="${control.max}"` : ''} ${control.step != null ? `step="${control.step}"` : ''}/>`}${control.unit ? `<span class="unit">${control.unit}</span>` : ''}</div></div>`).join('')}`
      : '<div class="empty">No controls are available for this category.</div>';
    controlsRoot
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-control]')
      .forEach((field) => {
        const control = controls[Number(field.dataset.control)];
        if (!control) return;
        const recorder = createDebouncedChangeRecorder<string | number>(180, (before, after) =>
          record(control, before, after),
        );
        field.addEventListener('input', () => {
          const before = control.read();
          const value = control.kind === 'number' ? Number(field.value) : field.value;
          control.apply(value);
          updateOutline();
          recorder.push(before, value);
        });
      });
  }

  function select(element: HTMLElement): void {
    if (element === host || host.contains(element)) return;
    selected = element;
    selectedControls = controlsFor(element);
    activeCategory = 'layout';
    const target = targetFor(element);
    selectionTitle.textContent = target.label;
    selectionCode.textContent = element.dataset.foundrySource || cssPath(element);
    selectionState.textContent = 'Measured';
    selectionConfidence.textContent =
      target.confidence === 'instrumented' ? 'Instrumented' : 'Measured target';
    selectionStats.hidden = false;
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(updateOutline);
    resizeObserver.observe(element);
    updateOutline();
    renderControls();
  }

  function clearSelection(): void {
    selected = null;
    selectedControls = [];
    resizeObserver?.disconnect();
    outline.hidden = true;
    selectionTitle.textContent = 'Nothing selected';
    selectionCode.textContent = 'Hold ⌥ and click an element';
    selectionState.textContent = 'Ready';
    selectionStats.hidden = true;
    tabs.innerHTML = '';
    controlsRoot.innerHTML =
      '<div class="empty">Select an element to inspect its measured design controls.</div>';
  }

  function handlePointer(event: MouseEvent): void {
    if (!(inspecting || event.altKey)) return;
    const path = event.composedPath();
    if (path.includes(host) || path.includes(panel)) return;
    const element = path.find((item): item is HTMLElement => item instanceof HTMLElement);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    select(element);
    inspecting = false;
    inspectButton.classList.remove('active');
  }

  async function verify(): Promise<void> {
    if (!sessionId || !token) {
      showToast('Session connection is missing');
      return;
    }
    const response = await fetch(`${runtimeUrl}/v1/sessions/${sessionId}`, {
      headers: { 'x-foundry-token': token },
    });
    const { changeSet } = await response.json();
    const results = changeSet.changes.map((change: any) => {
      const element = document.querySelector(change.target.locator.selector) as HTMLElement | null;
      let rendered: any = null;
      if (element) {
        if (change.property === 'textContent') rendered = element.textContent?.trim() ?? '';
        else if (['aria-label', 'role', 'tabindex', 'alt', 'src'].includes(change.property))
          rendered =
            element.getAttribute(change.property) ?? (element as any)[change.property] ?? '';
        else rendered = (getComputedStyle(element) as any)[change.property] ?? null;
      }
      const expected =
        typeof change.after === 'number' && change.unit
          ? `${change.after}${change.unit}`
          : change.after;
      const passed =
        String(rendered).replaceAll(' ', '') === String(expected).replaceAll(' ', '') ||
        Number.parseFloat(String(rendered)) === Number.parseFloat(String(expected));
      return {
        changeId: change.id,
        property: change.property,
        requested: change.after,
        rendered,
        passed,
        reason: element
          ? passed
            ? undefined
            : 'Rendered value differs from requested value'
          : 'Target locator no longer resolves',
        verifiedAt: new Date().toISOString(),
      };
    });
    await fetch(`${runtimeUrl}/v1/sessions/${sessionId}/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-foundry-token': token },
      body: JSON.stringify({ results }),
    });
    showToast(
      `${results.filter((result: any) => result.passed).length}/${results.length} changes verified`,
    );
  }

  document.addEventListener('click', handlePointer, true);
  window.addEventListener('scroll', updateOutline, true);
  window.addEventListener('resize', updateOutline);
  inspectButton.addEventListener('click', () => {
    inspecting = !inspecting;
    inspectButton.classList.toggle('active', inspecting);
  });
  shadow.querySelector('.close')?.addEventListener('click', () => host.remove());
  shadow.querySelector('.verify')?.addEventListener('click', () => void verify());
  shadow.querySelector('.review')?.addEventListener('click', () => {
    if (!sessionId || !token) return;
    window.open(
      `${runtimeUrl}/?session=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`,
      'foundry-review',
    );
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') clearSelection();
  });
  return {
    inspect() {
      inspecting = true;
      inspectButton.classList.add('active');
    },
    stopInspecting() {
      inspecting = false;
      inspectButton.classList.remove('active');
    },
    select,
    destroy() {
      resizeObserver?.disconnect();
      document.removeEventListener('click', handlePointer, true);
      window.removeEventListener('scroll', updateOutline, true);
      window.removeEventListener('resize', updateOutline);
      host.remove();
    },
  };
}
