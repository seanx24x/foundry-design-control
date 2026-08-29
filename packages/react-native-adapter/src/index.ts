export interface NativeGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  scale?: number;
}
export interface NativeSourceRef {
  file: string;
  line?: number;
  column?: number;
  symbol?: string;
}
export interface NativeControl {
  id: string;
  category:
    | 'layout'
    | 'spacing'
    | 'typography'
    | 'color'
    | 'border'
    | 'effect'
    | 'content'
    | 'asset'
    | 'visibility'
    | 'accessibility'
    | 'responsive'
    | 'state'
    | 'motion';
  property: string;
  label: string;
  valueType: 'number' | 'string' | 'boolean' | 'color' | 'length' | 'select' | 'asset' | 'motion';
  value: unknown;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: Array<{ label: string; value: unknown }>;
}
export interface NativeInspectable {
  id: string;
  label: string;
  semanticRole: string;
  componentPath?: string[];
  source?: NativeSourceRef;
  measure(): Promise<NativeGeometry>;
  controls: NativeControl[];
  applyPreview(property: string, value: unknown): void | Promise<void>;
}
export interface ReactNativeAdapterOptions {
  sessionId: string;
  token: string;
  runtimeUrl?: string;
  width: number;
  height: number;
  captureFrame?: () => Promise<string | undefined>;
  publishIntervalMs?: number;
  pollIntervalMs?: number;
}

export class FoundryReactNativeAdapter {
  private readonly runtimeUrl: string;
  private readonly inspectables = new Map<string, NativeInspectable>();
  private publishTimer?: ReturnType<typeof setInterval>;
  private commandTimer?: ReturnType<typeof setInterval>;
  private lastCommand = '';

  constructor(private readonly options: ReactNativeAdapterOptions) {
    this.runtimeUrl = (options.runtimeUrl ?? 'http://127.0.0.1:4387').replace(/\/$/, '');
  }

  register(inspectable: NativeInspectable): () => void {
    this.inspectables.set(inspectable.id, inspectable);
    return () => this.inspectables.delete(inspectable.id);
  }

  async publishSurface(): Promise<void> {
    const entries = await Promise.all(
      [...this.inspectables.values()].map(async (item) => ({
        item,
        geometry: await item.measure(),
      })),
    );
    const frameDataUrl = await this.options.captureFrame?.();
    const payload = {
      platform: 'react-native',
      width: this.options.width,
      height: this.options.height,
      frameDataUrl,
      updatedAt: new Date().toISOString(),
      targets: entries.map(({ item, geometry }) => ({
        id: item.id,
        platform: 'react-native',
        semanticRole: item.semanticRole,
        label: item.label,
        componentPath: item.componentPath ?? [],
        source: item.source,
        geometry: { ...geometry, scale: geometry.scale ?? 1 },
        locator: { nativeId: item.id },
        confidence: item.source ? 'instrumented' : 'measured',
        evidence: ['measureInWindow', 'Foundry debug registration'],
      })),
      controlsByTarget: Object.fromEntries(
        entries.map(({ item }) => [
          item.id,
          item.controls.map((control) => ({ ...control, previewable: true, supported: true })),
        ]),
      ),
    };
    await this.request('/surface', { method: 'POST', body: JSON.stringify(payload) });
  }

  async pollCommands(): Promise<void> {
    const data = (await this.request(
      `/commands?after=${encodeURIComponent(this.lastCommand)}`,
    )) as {
      commands: Array<{ targetId: string; property: string; value: unknown; createdAt: string }>;
    };
    for (const command of data.commands) {
      const target = this.inspectables.get(command.targetId);
      if (target) await target.applyPreview(command.property, command.value);
      this.lastCommand = command.createdAt;
    }
  }

  start(): void {
    if (this.publishTimer) return;
    void this.publishSurface();
    void this.pollCommands();
    this.publishTimer = setInterval(
      () => void this.publishSurface(),
      this.options.publishIntervalMs ?? 1000,
    );
    this.commandTimer = setInterval(
      () => void this.pollCommands(),
      this.options.pollIntervalMs ?? 350,
    );
  }

  stop(): void {
    if (this.publishTimer) clearInterval(this.publishTimer);
    if (this.commandTimer) clearInterval(this.commandTimer);
    this.publishTimer = undefined;
    this.commandTimer = undefined;
  }

  private async request(path: string, options: RequestInit = {}): Promise<unknown> {
    const response = await fetch(
      `${this.runtimeUrl}/v1/sessions/${this.options.sessionId}${path}`,
      {
        ...options,
        headers: {
          'content-type': 'application/json',
          'x-foundry-token': this.options.token,
          ...options.headers,
        },
      },
    );
    if (!response.ok) throw new Error(`Foundry native bridge failed: ${response.status}`);
    return response.json();
  }
}

export function createFoundryNativeAdapter(
  options: ReactNativeAdapterOptions,
): FoundryReactNativeAdapter {
  return new FoundryReactNativeAdapter(options);
}
