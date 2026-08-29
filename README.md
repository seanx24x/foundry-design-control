# Foundry Design Control

Foundry is a local-first visual design control plane for Codex, Cursor, and Claude Code. It lets you select rendered interface elements, preview precise refinements, review one structured change batch, and hand that batch to a coding agent for source implementation.

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
pnpm foundry start --url http://localhost:3000
```

The runtime binds to `127.0.0.1:4387`. It does not edit source files. Add the development-only web adapter shown by `pnpm foundry init web`, then start a session explicitly.

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
