# Foundry for Claude Desktop

This MCP Bundle is the host-native connection for Claude Desktop. It connects Claude to the loopback-only Foundry runtime that is started from a project with `npx foundry-design`.

Install the released `.mcpb` file through **Claude Desktop → Settings → Extensions → Advanced → Install Extension**. Open the project folder in Claude Desktop, run `npx foundry-design` once from that project, then begin a new task and ask: `Start Foundry for this project and keep listening for Apply with agent requests.`

If Foundry reports that configuration exists but no listener is active, close the current task and open a new one after installing or updating the extension. Existing tasks cannot gain newly installed MCP tools.

Maintainers can build and validate the bundle from the repository root with `pnpm mcpb:build`.

The extension contains only the local MCP bridge. It does not contain project files, session tokens, telemetry, or a cloud service.
