export class FoundryRuntimeClient {
  constructor(
    private readonly baseUrl = process.env.FOUNDRY_DESIGN_RUNTIME_URL ?? 'http://127.0.0.1:4387',
    private readonly defaultSessionId = process.env.FOUNDRY_DESIGN_SESSION_ID,
    private readonly defaultToken = process.env.FOUNDRY_DESIGN_SESSION_TOKEN,
  ) {}

  async request(
    path: string,
    options: RequestInit = {},
    token = this.defaultToken,
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(token ? { 'x-foundry-token': token } : {}),
        ...options.headers,
      },
    });
    if (!response.ok) {
      let message = `Foundry runtime returned ${response.status}`;
      try {
        message = String(((await response.json()) as { error?: string }).error ?? message);
      } catch {
        /* Keep status message. */
      }
      throw new Error(message);
    }
    const contentType = response.headers.get('content-type') ?? '';
    return contentType.includes('json') ? response.json() : response.text();
  }

  sessionId(value?: string): string {
    const id = value ?? this.defaultSessionId;
    if (!id) throw new Error('Provide sessionId or set FOUNDRY_DESIGN_SESSION_ID.');
    return id;
  }
}
