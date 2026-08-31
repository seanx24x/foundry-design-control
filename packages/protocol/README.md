# Foundry Design Control

Foundry is a local-first precision design workbench for Codex, Cursor, and Claude Code. It lets design engineers manipulate rendered interface elements, resolve each gesture to the right project-native source intent, review one structured change batch, and verify the rebuilt result across recorded states.

## Beta installation

Foundry `0.2.0-beta.1` is the first shareable beta. From the project you want to inspect, run:

```bash
npx foundry-design@beta setup
```

Setup detects the platform, framework, package manager, development command, and installed coding agents. It previews every file it will manage, adds development-only instrumentation for supported web frameworks, configures the selected MCP clients, and records a reversible install manifest.

Then start a session with:

```bash
npx foundry-design@beta start
```

Foundry reuses an available project server or starts the detected development command, launches the loopback runtime, and opens an authenticated visual preview. Remove only Foundry-managed integration with:

```bash
npx foundry-design@beta uninstall
```

Supported automatic web integration currently includes Next.js App Router, Vite, and plain HTML. Generic web, SwiftUI, and React Native projects receive explicit setup guidance when a safe automatic edit is not available.

Codex, Cursor, and Claude Code users can alternatively install the bundled plugin from this repository. The plugin contains the Foundry skill and MCP server definition, so project setup uses `--agent none` and does not create duplicate MCP configuration.

The beta supports Node.js 20 or newer. Read [Privacy](PRIVACY.md), [Security](SECURITY.md), and the [beta changelog](CHANGELOG.md) before using it with sensitive work.

## Agent plugin

The portable plugin lives at `plugins/foundry-design-control`. The repository also includes marketplace manifests for Codex, Cursor, and Claude-compatible plugin import. Once installed, ask your agent:

```text
Start Foundry for this project.
```

Foundry remains local-first. Installing the plugin does not create an account, enable telemetry, or send project data to a Foundry service.

## Current capabilities

- Measured browser selection with overlap cycling, parent/child traversal, hover previews, and an isolated Shadow DOM inspector
- A searchable, collapsible, virtualized live layer hierarchy with mapped-source context, Shadow DOM traversal, drag reordering, and selection persistence across HMR
- Multi-selection, measured spacing annotations, sibling-aware resize snapping, keyboard nudging, alignment, distribution, and preview undo/redo
- A revisioned local design graph for CSS tokens, components, Storybook variants, breakpoints, themes, states, and motion presets
- Semantic source-mapping choices that block ambiguous changes until the user selects the intended implementation
- Fixed, hug, fill, and min/max sizing; flex and grid flow; linked spacing; aspect ratio; overflow; and positional controls
- Project-native spacing, radius, typography, and color choices with token-only filtering, exact token suggestions, component variants, type presets, gradients, opacity, and live contrast guidance
- Layout, typography, color, content, asset, accessibility, responsive, and motion controls
- Before/after toggles, continuous comparison scrubbing, side-by-side source comparison, isolation, per-element reset, keyboard shortcuts, and a searchable command palette
- Design Health scans for contrast, overflow and clipping, touch targets, accessible names, reduced-motion coverage, and project spacing consistency, with evidence, intentional-issue ignores, and safe corrections routed into review
- An in-app state workbench with real viewport frames, theme switching, forced interaction states, motion controls, and contextual verification
- Persistent, coalescing change ledger with JSON and consolidated prompt export
- Compact in-preview review with editable approved batches and unresolved-target blocking
- Persistent Apply with agent runs across Codex, Cursor, and Claude Code through MCP
- Live source, rebuild, validation, retry, and rendered-verification progress
- Local MCP bridge for agent access
- Debug adapters for web, SwiftUI, and React Native on iOS Simulator
- Verification records that compare requested and rendered values

The review surface explains the blast radius of every proposed change, including component instance count, token versus literal use, responsive and theme scope, and unresolved mapping risk. It never applies a source change merely because a preview override looks correct.

Foundry protocol `1.2.0` reads existing `1.0.0` and `1.1.0` sessions with migration defaults. All graph, operation, run, and verification data remains local and is available through `foundry-design export --format full`.

## Local development

```bash
pnpm install
pnpm check
pnpm release:check
pnpm release:pack
pnpm release:test-install
pnpm build
pnpm foundry setup --project /path/to/project --agent codex --local-mcp
pnpm foundry index --project /path/to/project --output /tmp/foundry-design-graph.json
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
