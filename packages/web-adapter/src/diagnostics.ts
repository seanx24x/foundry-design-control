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

export const DIAGNOSTICS_PROTOCOL_VERSION = '1.3.0';

/** Build useful support state without exposing project content or session credentials. */
export function createSafeDiagnostics(input: SafeDiagnosticsInput) {
  return {
    product: 'Foundry Design Control',
    protocolVersion: input.protocolVersion ?? DIAGNOSTICS_PROTOCOL_VERSION,
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
