# Foundry for Claude Desktop

This MCP Bundle is the one-click host integration for Claude Desktop. It connects Claude to the loopback-only Foundry runtime that is started from the project with `npx foundry-design start`.

Build and validate the bundle from the repository root with `pnpm mcpb:build`. Install the resulting `.mcpb` file through Claude Desktop Settings, Extensions, Advanced settings, Install Extension.

The extension contains only the local MCP bridge. It does not contain project files, session tokens, telemetry, or a cloud service.
