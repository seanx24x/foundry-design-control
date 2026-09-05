# Foundry Design Control

Foundry is a local-first precision design workbench for Codex, Cursor, and Claude Code. It lets design engineers manipulate rendered interface elements, resolve each gesture to the right project-native source intent, review one structured change batch, and verify the rebuilt result across recorded states.

## Beta installation

Foundry is distributed through npm, so testers do not need GitHub access.

> **Release candidate:** `0.2.0-beta.15`. The commands below are prepared for this release and must not be promoted to npm `latest` until the full installation matrix passes.

Full documentation is available at [withfoundry.ai](https://withfoundry.ai).

### Recommended: install once, use in every project

Install Foundry's shared connection for Codex, Cursor, and Claude once:

```bash
npx foundry-design install
```

Restart the selected coding agents once. Then open any project and run:

Open a terminal in the project, or ask Codex, Cursor, or Claude Code to run:

```bash
npx foundry-design
```

That command finds the nearest real project, detects its framework, installs or safely updates only the development adapter and lightweight project connection, validates it, starts the project when needed, and opens the visual session. The agent bridge and skill remain installed once at machine level. Foundry refuses to treat a home folder as a project and prints the exact CLI and MCP bridge versions before changing configuration.

After the restart, reopen the same project folder and ask:

```text
Start Foundry for this project and keep listening for Apply with agent requests.
```

That is the normal workflow. Foundry resumes the most recent session for the current source revision and keeps all review and apply state local.

### Manual installation

Install the shared connection for selected agents:

```bash
npx foundry-design install --agent codex,cursor,claude
```

Connect any project with only its development adapter and local project metadata:

```bash
npx foundry-design connect
```

Then restart the coding agent, reopen the same project folder, and ask:

```text
Start Foundry for this project and keep listening for Apply with agent requests.
```

You do not need to run a second terminal command when the agent starts Foundry for you. Apply requests remain queued safely when the agent is offline. After an active agent claims a batch, the MCP bridge keeps that handoff alive through source edits, rebuilding, and verification. A claim abandoned before source work begins returns to the queue. If the agent disappears during source work, Foundry preserves the same run in **Needs attention** and waits for you to choose **Resume with agent**. It never guesses whether a half-finished edit is safe to repeat.

Check the complete connection at any time with:

```bash
npx foundry-design status
```

Foundry reports project integration, the exact MCP package version, runtime health, and the live agent listener separately. Run `npx foundry-design doctor --repair` if configuration or generated integration needs repair.

If an older project has stale or conflicting project-scoped agent configuration, run:

```bash
npx foundry-design reset
```

Reset migrates Foundry-owned project MCP files and skills to the shared connection, preserves customized files, and reports anything it could not replace safely.

Update an existing installation with:

```bash
npx foundry-design update
```

The updater refreshes checksum-matched project files and the shared machine connection. It removes only Foundry-owned legacy project agent files, preserves customized files, validates the project, and rolls back if Foundry introduces a TypeScript or lint failure. Restart the coding agent only when its shared bridge version changes.

Remove a project from Foundry's recent-project list without removing its adapter:

```bash
npx foundry-design disconnect
```

Remove only Foundry-managed integration with:

```bash
npx foundry-design uninstall
```

Remove the shared machine connection separately:

```bash
npx foundry-design uninstall --global
```

Project-scoped MCP configuration remains available only as an explicit compatibility mode:

```bash
npx foundry-design setup --project-agent --agent codex
```

Supported automatic web integration currently includes Next.js App Router, Vite, and plain HTML. Generic web, SwiftUI, and React Native projects receive explicit setup guidance when a safe automatic edit is not available.

The npm setup above is the public beta installation path and includes the same portable skill and MCP connection used by the agent plugin bundle.

### Agent-native installation

The npm installer remains the universal route. Foundry also ships one versioned plugin bundle for Codex, Cursor, and Claude Code, so each host can load the same skill, MCP bridge, and session guidance through its native plugin system.

For Claude Code, add the public marketplace and install Foundry once:

```text
/plugin marketplace add seanx24x/foundry-design-control
/plugin install foundry-design-control@foundry-design-control
```

Run `/reload-plugins`, open a project, then run `npx foundry-design` once to connect its development adapter.

For Cursor, use the one-click MCP connection below while the complete plugin awaits marketplace review. The repository contains a validated Cursor plugin with the Foundry skill, command, hook, and MCP bridge for local testing and submission.

For Codex, the repository contains the Agent Plugin and Codex presentation metadata used for public marketplace submission. Until that listing is available, `npx foundry-design install-agent codex` installs the identical shared skill and bridge without requiring the repository.

See [Distribution](DISTRIBUTION.md) for the exact supported route, validation command, and update boundary for every host.

### Claude Desktop extension

The repository also produces a validated `.mcpb` extension for Claude Desktop. It bundles the local Foundry MCP bridge and can be installed through **Settings → Extensions → Advanced → Install Extension**. This provides a host-native alternative when a Claude Desktop surface does not merge the normal user-level Claude Code MCP configuration. Project instrumentation is still installed with `npx foundry-design`.

If an npm mirror or existing `npx` cache reports an old tag, bypass it with a temporary cache and the exact current release:

```bash
FOUNDRY_NPX_CACHE="$(mktemp -d)"
npx --yes --prefer-online --registry=https://registry.npmjs.org --cache "$FOUNDRY_NPX_CACHE" --package=foundry-design@0.2.0-beta.15 foundry-design
```

The beta supports Node.js 20 or newer. Read the [local-first safety model](https://withfoundry.ai/#safety) before using it with sensitive work.

## Agent plugin

The portable plugin lives at `plugins/foundry-design-control`. The repository also includes marketplace manifests for Codex, Cursor, and Claude-compatible plugin import. Until public marketplace review is complete, `npx foundry-design install` installs the same reusable skill and MCP connection from npm without requiring source-repository access. Once installed, ask your agent:

```text
Start Foundry for this project.
```

Foundry remains local-first. Installing the plugin does not create an account, enable telemetry, or send project data to a Foundry service.

### Cursor one-click connection

[Add the Foundry MCP bridge to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=foundry-design-control&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIi0tcHJlZmVyLW9ubGluZSIsImZvdW5kcnktZGVzaWduLW1jcC1zZXJ2ZXJAMC4yLjAtYmV0YS4xNSJdLCJlbnYiOnsiRk9VTkRSWV9ERVNJR05fUlVOVElNRV9VUkwiOiJodHRwOi8vMTI3LjAuMC4xOjQzODcifX0%3D), then run `npx foundry-design` inside the project. The repository's Cursor plugin additionally bundles the Foundry skill and session-start hook for marketplace distribution.

## Current capabilities

- A dedicated local design workspace with a live product canvas, equal Layers and Inspector docks, and a direct-overlay fallback when a product blocks framing
- Measured browser selection with overlap cycling, parent/child traversal, hover previews, and isolated Shadow DOM canvas instrumentation
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
- Center-workspace review with editable approved batches, grouped targets, and unresolved-target blocking
- Persistent Apply with agent runs across Codex, Cursor, and Claude Code through MCP
- Automatically renewed agent handoffs that remain claimed during source inspection and safely return abandoned work to the queue
- Explicit same-run recovery when an agent disappears during source editing, rebuilding, or verification
- Live source, rebuild, validation, retry, and rendered-verification progress
- Rendered verification that resumes after refresh and does not depend on Review remaining open
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
pnpm test:e2e
pnpm mcpb:build
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
- `apps/inspector`: authenticated local design workspace, canvas shell, and review surface
- `examples/web-fixture`: end-to-end browser fixture

## Safety model

Foundry stores sessions locally under the operating system application-support directory, binds only to loopback, and requires a per-session token. Preview overrides are temporary. The coding agent must propose a normal source diff and run project validation before a change can be marked applied.
