# Foundry Design Control

Foundry is a local-first precision design workbench for Codex, Cursor, and Claude Code. It lets design engineers manipulate rendered interface elements, resolve each gesture to the right project-native source intent, review one structured change batch, and verify the rebuilt result across recorded states.

## Beta installation

Foundry is distributed through npm, so testers do not need GitHub access.

> **Current public beta:** `0.2.0-beta.6`. Install Foundry with the `@beta` tag. The unqualified npm `latest` tag still points to an earlier beta and is not the current testing channel.

Full documentation is available at [withfoundry.ai](https://withfoundry.ai).

### Recommended: one command

Open a terminal in the project, or ask Codex, Cursor, or Claude Code to run:

```bash
npx foundry-design@beta
```

That command detects the project and active coding agent, installs or safely updates Foundry, repairs the shared agent connection, validates its integration, starts the project when needed, and opens the visual session. On the first installation only, restart the coding agent once so it can load the shared MCP connection. A reviewed batch can be queued before the restart and will be claimed when the agent reconnects.

After the restart, reopen the same project folder and ask:

```text
Start Foundry for this project and keep listening for Apply with agent requests.
```

That is the normal workflow. Foundry resumes the most recent session for the current source revision and keeps all review and apply state local.

### Manual installation

From the first project you want to inspect, run:

```bash
npx foundry-design@beta setup --global
```

For later projects, keep the shared agent connection and install only the development adapter:

```bash
npx foundry-design@beta setup --agent none
```

Then restart the coding agent, reopen the same project folder, and ask:

```text
Start Foundry for this project and keep listening for Apply with agent requests.
```

You do not need to run a second terminal command when the agent starts Foundry for you. Apply requests remain queued safely when the agent is offline. Run `npx foundry-design@beta doctor --repair` if the connection or generated integration needs repair.

Update an existing installation with:

```bash
npx foundry-design@beta update
```

The updater refreshes checksum-matched Foundry files, agent connections, and skill bundles. It preserves and reports files changed since setup, validates the project, and rolls back the update if Foundry introduces a TypeScript or lint failure. Restart the coding agent after updating.

Remove only Foundry-managed integration with:

```bash
npx foundry-design@beta uninstall
```

Supported automatic web integration currently includes Next.js App Router, Vite, and plain HTML. Generic web, SwiftUI, and React Native projects receive explicit setup guidance when a safe automatic edit is not available.

The npm setup above is the public beta installation path and includes the same portable skill and MCP connection used by the agent plugin bundle.

The beta supports Node.js 20 or newer. Read the [local-first safety model](https://withfoundry.ai/#safety) before using it with sensitive work.

## Agent plugin

The portable plugin lives at `plugins/foundry-design-control`. The repository also includes marketplace manifests for Codex, Cursor, and Claude-compatible plugin import. Until public marketplace review is complete, `setup --global` installs the same reusable skill and MCP connection from npm without requiring source-repository access. Once installed, ask your agent:

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
- Leased agent handoffs that safely return abandoned or interrupted claims to the queue
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
