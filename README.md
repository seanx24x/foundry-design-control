# Foundry Design Control

Foundry is a local-first visual design control plane for Codex, Cursor, and Claude Code. It lets you select rendered interface elements, preview precise refinements, review one structured change batch, and hand that batch to a coding agent for source implementation.

## Installation experience

The public package is prepared but not yet published. Once released, setup is one command from the project you want to inspect:

```bash
npx foundry-design setup
```

Setup detects the platform, framework, package manager, development command, and installed coding agents. It previews every file it will manage, adds development-only instrumentation for supported web frameworks, configures the selected MCP clients, and records a reversible install manifest.

Then start a session with:

```bash
npx foundry-design start
```

Foundry reuses an available project server or starts the detected development command, launches the loopback runtime, and opens an authenticated visual preview. Remove only Foundry-managed integration with:

```bash
npx foundry-design uninstall
```

Supported automatic web integration currently includes Next.js App Router, Vite, and plain HTML. Generic web, SwiftUI, and React Native projects receive explicit setup guidance when a safe automatic edit is not available.

Codex users can alternatively install the bundled plugin. The plugin contains the Foundry skill and MCP server definition, so project setup uses `--agent none` and does not create duplicate MCP configuration.

## Current capabilities

- Measured browser selection with an isolated Shadow DOM inspector
- Layout, typography, color, content, asset, accessibility, responsive, and motion controls
- Persistent, coalescing change ledger with JSON and consolidated prompt export
- Local MCP bridge for agent access
- Debug adapters for web, SwiftUI, and React Native on iOS Simulator
- Verification records that compare requested and rendered values

## Local development

```bash
pnpm install
pnpm check
pnpm build
pnpm foundry setup --project /path/to/project --agent codex --local-mcp
pnpm foundry start --project /path/to/project
```

The runtime binds to `127.0.0.1:4387`. Inspector preview changes remain temporary. Setup edits only the development integration and coding-agent configuration it shows before confirmation.

## Repository layout

- `packages/protocol`: versioned schemas and ledger rules
- `packages/runtime`: localhost session service and persistence
- `packages/cli`: project detection, initialization, launch, export, and doctor commands
- `packages/web-adapter`: injected browser inspector
- `packages/react-native-adapter`: React Native debug bridge
- `packages/mcp-server`: agent tools backed by the runtime
- `packages/swiftui-adapter`: Swift package for inspectable SwiftUI views
- `apps/inspector`: session dashboard and review surface
- `examples/web-fixture`: end-to-end browser fixture

## Safety model

Foundry stores sessions locally under the operating system application-support directory, binds only to loopback, and requires a per-session token. Preview overrides are temporary. The coding agent must propose a normal source diff and run project validation before a change can be marked applied.
