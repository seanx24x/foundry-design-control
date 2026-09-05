export const FOUNDRY_VERSION = '0.2.0-beta.13';
export const FOUNDRY_PACKAGE_SPEC = `foundry-design@${FOUNDRY_VERSION}`;
export const FOUNDRY_MCP_PACKAGE_SPEC = `foundry-design-mcp-server@${FOUNDRY_VERSION}`;

export function releasePreflight(action: string): string {
  return [
    `Foundry ${FOUNDRY_VERSION}`,
    `Release preflight: CLI ${FOUNDRY_PACKAGE_SPEC}`,
    `Agent bridge: ${FOUNDRY_MCP_PACKAGE_SPEC}`,
    `Action: ${action}`,
  ].join('\n');
}
