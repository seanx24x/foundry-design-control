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
  :host { all: initial; --fdc-ink:#202321; --fdc-paper:#f6f6f1; --fdc-line:#c8ccc5; --fdc-copper:#a75031; --fdc-muted:#656a65; font-family:"Avenir Next",Avenir,"Helvetica Neue",sans-serif; color:var(--fdc-ink); }
  * { box-sizing:border-box; }
  .outline { position:fixed; z-index:2147483645; pointer-events:none; border:1px solid var(--fdc-copper); box-shadow:0 0 0 1px rgb(255 255 255 / 75%); transition:top 80ms linear,left 80ms linear,width 80ms linear,height 80ms linear; }
  .measure { position:absolute; left:-1px; top:-25px; height:23px; display:flex; align-items:center; gap:8px; padding:0 8px; color:white; background:var(--fdc-copper); font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace; white-space:nowrap; }
  .cross::before,.cross::after { content:""; position:absolute; background:var(--fdc-copper); }.cross::before { width:9px;height:1px;left:-5px;top:-1px; }.cross::after { width:1px;height:9px;left:-1px;top:-5px; }
  .panel { position:fixed; z-index:2147483646; top:12px; right:12px; width:356px; max-height:calc(100vh - 24px); overflow:hidden; display:flex; flex-direction:column; color:var(--fdc-ink); background:var(--fdc-paper); border:1px solid #b9beb7; box-shadow:0 22px 70px rgb(20 24 21 / 24%); pointer-events:auto; border-radius:5px; }
  .top { display:flex; align-items:center; min-height:52px; padding:0 14px; border-bottom:1px solid var(--fdc-line); }
  .brand { display:flex;align-items:center;gap:9px;font-size:13px;font-weight:700;letter-spacing:-.015em; }.brand-mark { width:13px;height:14px;display:flex;align-items:flex-end;gap:2px; }.brand-mark i { display:block;width:3px;background:var(--fdc-copper);border-radius:2px 2px 0 0; }.brand-mark i:nth-child(1){height:7px}.brand-mark i:nth-child(2){height:13px}.brand-mark i:nth-child(3){height:9px}
  .top-actions { margin-left:auto;display:flex;gap:4px; }.icon-button { width:30px;height:30px;border:0;border-radius:3px;background:transparent;color:var(--fdc-muted);cursor:pointer;font-size:16px; }.icon-button:hover { background:#e7e8e2;color:var(--fdc-ink); }.icon-button.active { color:white;background:var(--fdc-copper); }
  .selection { padding:14px; border-bottom:1px solid var(--fdc-line); }.selection small { display:block;margin-bottom:6px;color:var(--fdc-copper);font:600 9px/1.2 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.12em; }.selection strong { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;letter-spacing:-.02em; }.selection code { display:block;margin-top:5px;overflow:hidden;text-overflow:ellipsis;color:var(--fdc-muted);font:10px/1.4 ui-monospace,monospace;white-space:nowrap; }
  .scope { display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--fdc-line);border-bottom:1px solid var(--fdc-line); }.scope label { display:flex;flex-direction:column;gap:5px;padding:9px 10px;background:var(--fdc-paper);color:var(--fdc-muted);font:9px/1.2 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em; }.scope select { width:100%;padding:0;border:0;background:transparent;color:var(--fdc-ink);font:11px/1.3 "Avenir Next",sans-serif;text-transform:none;letter-spacing:0;outline:none; }
  .tabs { display:flex;gap:0;overflow-x:auto;border-bottom:1px solid var(--fdc-line);scrollbar-width:none; }.tab { flex:none;height:38px;padding:0 11px;border:0;border-right:1px solid var(--fdc-line);background:transparent;color:var(--fdc-muted);font:600 9px/1 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.07em;cursor:pointer; }.tab.active { color:var(--fdc-copper);box-shadow:inset 0 -2px var(--fdc-copper); }
  .controls { min-height:180px;overflow:auto;padding:5px 14px 16px; }.group-label { margin:16px 0 8px;color:var(--fdc-muted);font:600 9px/1.2 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.1em; }.control { display:grid;grid-template-columns:minmax(0,1fr) 124px;align-items:center;gap:12px;min-height:39px;border-top:1px solid #dddeda; }.control label { overflow:hidden;text-overflow:ellipsis;font-size:11px;white-space:nowrap; }.control-field { display:flex;align-items:center;border:1px solid var(--fdc-line);border-radius:3px;background:white;overflow:hidden; }.control input,.control select { width:100%;height:28px;padding:0 8px;border:0;background:transparent;color:var(--fdc-ink);font:11px/1 ui-monospace,monospace;outline:none; }.control input[type=color] { padding:3px;height:28px; }.unit { padding-right:7px;color:var(--fdc-muted);font:9px/1 ui-monospace,monospace; }
  .motion-row { padding:11px 0;border-top:1px solid #dddeda; }.motion-title { display:flex;justify-content:space-between;gap:12px;margin-bottom:9px;font-size:11px; }.motion-title code { color:var(--fdc-muted);font:9px/1.3 ui-monospace,monospace; }.motion-actions { display:flex;gap:6px; }.motion-actions button { min-height:28px;padding:0 9px;border:1px solid var(--fdc-line);background:white;border-radius:3px;font-size:10px;cursor:pointer; }
  .empty { padding:38px 12px;text-align:center;color:var(--fdc-muted);font-size:12px;line-height:1.6; }.footer { display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--fdc-line); }.footer button { min-height:42px;border:0;background:transparent;font-size:11px;font-weight:650;cursor:pointer; }.footer button+button { border-left:1px solid var(--fdc-line); }.footer .review { color:white;background:var(--fdc-ink); }
  .toast { position:absolute;left:50%;bottom:50px;transform:translate(-50%,8px);padding:8px 11px;background:var(--fdc-ink);color:white;border-radius:3px;font-size:10px;opacity:0;transition:.15s ease;pointer-events:none;white-space:nowrap; }.toast.show { opacity:1;transform:translate(-50%,0); }
  @media (max-width:600px){.panel{top:auto;right:6px;bottom:6px;left:6px;width:auto;max-height:68vh}.scope{display:none}}
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
  shadow.innerHTML = `<style>${PANEL_CSS}</style><div class="outline" hidden><span class="cross"></span><span class="measure"></span></div><aside class="panel" aria-label="Foundry design inspector"><div class="top"><div class="brand"><span class="brand-mark"><i></i><i></i><i></i></span>Foundry</div><div class="top-actions"><button class="icon-button inspect" title="Select element (Option-click)" aria-label="Select element">⌖</button><button class="icon-button close" title="Close inspector" aria-label="Close inspector">×</button></div></div><div class="selection"><small>Selection</small><strong>Nothing selected</strong><code>Hold ⌥ and click an element</code></div><div class="scope"><label>Scope<select data-scope><option value="instance">Instance</option><option value="component">Component</option></select></label><label>Breakpoint<select data-breakpoint><option>current</option><option>mobile</option><option>tablet</option><option>desktop</option></select></label><label>Theme<select data-theme><option>current</option><option>light</option><option>dark</option></select></label></div><div class="tabs"></div><div class="controls"><div class="empty">Select a rendered element to expose its measured controls.</div></div><div class="footer"><button class="verify">Verify preview</button><button class="review">Review changes</button></div><div class="toast"></div></aside>`;
  document.body.append(host);

  const outline = shadow.querySelector<HTMLElement>('.outline')!;
  const panel = shadow.querySelector<HTMLElement>('.panel')!;
  const tabs = shadow.querySelector<HTMLElement>('.tabs')!;
  const controlsRoot = shadow.querySelector<HTMLElement>('.controls')!;
  const inspectButton = shadow.querySelector<HTMLButtonElement>('.inspect')!;
  const selectionTitle = shadow.querySelector<HTMLElement>('.selection strong')!;
  const selectionCode = shadow.querySelector<HTMLElement>('.selection code')!;
  const scope = shadow.querySelector<HTMLSelectElement>('[data-scope]')!;
  const breakpoint = shadow.querySelector<HTMLSelectElement>('[data-breakpoint]')!;
  const theme = shadow.querySelector<HTMLSelectElement>('[data-theme]')!;
  let selected: HTMLElement | null = null;
  let inspecting = options.startInspecting ?? true;
  let activeCategory: Category = 'layout';
  let selectedControls: Control[] = [];
  let resizeObserver: ResizeObserver | undefined;

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
      context: { breakpoint: breakpoint.value, theme: theme.value, state: 'current' },
      confidence: selected.dataset.foundrySource ? 'instrumented' : 'measured',
      evidence: ['live preview override', 'computed style'],
      status: 'draft',
    };
    const response = await fetch(`${runtimeUrl}/v1/sessions/${sessionId}/changes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-foundry-token': token },
      body: JSON.stringify(payload),
    });
    if (!response.ok) showToast((await response.json()).error ?? 'Could not record change');
    else showToast('Change recorded');
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
    selectionTitle.textContent = targetFor(element).label;
    selectionCode.textContent = element.dataset.foundrySource || cssPath(element);
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(updateOutline);
    resizeObserver.observe(element);
    updateOutline();
    renderControls();
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
    if (event.key === 'Escape') {
      selected = null;
      outline.hidden = true;
    }
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
