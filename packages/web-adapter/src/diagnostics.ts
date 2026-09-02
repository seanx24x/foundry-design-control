export interface SafeDiagnosticsInput {
  interfaceTheme: 'light' | 'dark';
  runtimeConnected: boolean;
  agentConnected: boolean;
  agentName?: string;
  selectedCount: number;
  recordedChangeCount: number;
  latestApplyState?: string;
  protocolVersion?: string;
}

/** Build useful support state without exposing project content or session credentials. */
export function createSafeDiagnostics(input: SafeDiagnosticsInput) {
  return {
    product: 'Foundry Design Control',
    protocolVersion: input.protocolVersion ?? '1.1.0',
    interfaceTheme: input.interfaceTheme,
    connection: {
      runtime: input.runtimeConnected ? 'connected' : 'disconnected',
      agent: input.agentConnected ? 'connected' : 'disconnected',
      ...(input.agentConnected && input.agentName ? { agentName: input.agentName } : {}),
    },
    workspace: {
      selectedElementCount: Math.max(0, input.selectedCount),
      recordedChangeCount: Math.max(0, input.recordedChangeCount),
      latestApplyState: input.latestApplyState ?? 'none',
    },
  };
}
