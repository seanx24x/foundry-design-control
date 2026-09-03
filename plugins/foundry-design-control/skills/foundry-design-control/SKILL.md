---
name: foundry-design-control
description: Start and operate a local Foundry precision design session for live web, SwiftUI, or React Native interfaces; directly manipulate rendered elements; inspect project-native tokens, components, variants, breakpoints, states, and motion; resolve semantic source mappings; apply a reviewed batch with Codex, Cursor, or Claude; and verify rebuilt values. Use when the user asks to start Foundry, visually design in code, refine a running product, apply a Foundry batch, or continue a Foundry apply-and-verify run.
---

# Foundry Design Control

Use Foundry as a reviewable bridge between precise visual decisions and source code. Keep preview overrides temporary. Apply source edits only after the user resolves ambiguous mappings and reviews the change ledger.

Resolve `<skill-root>` to the directory containing this `SKILL.md` before running any command below. Never treat `scripts/foundry.sh` as a path inside the user's project.

## Start a session

1. Inspect the project, current worktree, framework, development command, and existing Foundry configuration.
2. Run `<skill-root>/scripts/foundry.sh doctor --project <root>`.
3. If setup is absent or Doctor reports a missing connection, read [platform-setup.md](references/platform-setup.md), then run `<skill-root>/scripts/foundry.sh doctor --project <root> --repair`. Repair is transactional, detects the active coding agent, validates the project, and restores every touched file if Foundry introduces a failure.
4. Confirm that `foundry_design_wait_for_apply` is callable before promising Apply with agent. If setup just added MCP configuration but the tool is unavailable in the current process, stop and ask the user to restart their coding agent and reopen the same project root. Do not start a session or describe the connection as ready.
5. Run `<skill-root>/scripts/foundry.sh start --project <root>`. It may start the detected development command and resumes the most recent session for the same source revision. Use `--new` only when the user explicitly wants a clean ledger.
6. Read the project design graph, then immediately call `foundry_design_wait_for_apply` in bounded waits using the returned session credentials and current revisions. This call publishes the agent-listener heartbeat that unlocks Apply with agent in the browser. Repeat the wait while the session is active. Do not finish the turn merely because one wait returns `waiting`; the browser cannot initiate a new agent turn by itself.
7. Keep the Foundry runtime and apply listener alive while the user selects and refines elements. End the wait loop only when the user exits Foundry, cancels the workflow, or asks to stop.

In web sessions, selection mode stays active so ordinary clicks can move continuously between elements. Inspector categories filter the selected element's controls without changing selection mode. Switch the pointer tool to interaction mode only when testing the underlying app; Option-click still makes a temporary selection there. Repeating a click cycles overlapping layers, and Option-click prioritizes the strongest mapped or semantic target. Use the Layers panel or the Parent and Child controls for obscured and nested targets. Shift-click builds a multi-selection and exposes measured gaps when the layers share a parent.

Use the inspector controls as the user's visual editing surface, not as source truth. For sizing modes, project values, component variants, layer reordering, comparison, keyboard commands, and reset behavior, read [visual-workbench.md](references/visual-workbench.md).

When the user runs Design Health or asks to correct its findings, read [design-health.md](references/design-health.md). Preserve evidence-only findings when Foundry cannot propose a narrow, reversible preview.

For web sessions, `start` indexes the local project design graph. Use `<skill-root>/scripts/foundry.sh index --project <root>` when the graph must be refreshed independently.

Do not launch Foundry merely because a task contains design work. Require an explicit request for a visual or Foundry session.

## Read and review changes

1. Prefer the Foundry MCP tools when available. Otherwise export with `<skill-root>/scripts/foundry.sh export <session-id> --format json`.
2. Treat JSON as canonical and the consolidated prompt as a portable rendering of that JSON.
3. Check every target's source reference, locator evidence, mapping confidence, state, theme, breakpoint, and instance/component scope.
4. Read [semantic-mapping-contract.md](references/semantic-mapping-contract.md) when a change belongs to a direct manipulation operation.
5. Keep `unresolved` targets and operations out of the apply batch. Require the user's selected mapping rather than guessing.
6. Collapse repeated changes only by target, property, scope, breakpoint, theme, and state set. Preserve the first measured value and final requested value.

Read [change-contract.md](references/change-contract.md) when interpreting or troubleshooting a change set.

## Apply the reviewed batch

1. Read the project design graph with `foundry_design_get_project_design`.
2. For an interactive web session, keep calling `foundry_design_wait_for_apply` in bounded waits as soon as Foundry starts. Include the current source revision, design-graph revision, and agent identity. A reviewed run may already be queued while the agent was offline. A `waiting` result means poll again while the session remains active, not that the workflow is complete.
3. If a run is claimed, read [apply-run-contract.md](references/apply-run-contract.md) and follow its state transitions. Do not edit from an unreviewed draft ledger.
4. Reinspect current source before editing. Stop if the claimed run reports a stale revision, stale graph, unresolved target, or unresolved operation.
5. Report `applying`, then implement the user's selected semantic mapping at the narrowest source of truth.
6. Preserve existing tokens and component conventions. Prefer a matching token over a new literal. Do not invent a global token for an instance-scoped adjustment.
7. Apply the batch as a normal, reviewable source diff. Never write generated preview styles into production code.
8. Report `rebuilding` with changed files and validation results. Report `failed` for a terminal source or validation failure.
9. Report any request that cannot be represented without changing the requested scope or architecture.

## Verify

1. Run the project's targeted tests, type checks, lint, and build in proportion to the edited surface.
2. Rebuild the target in the same device, viewport, theme, breakpoint, and state recorded by the session.
3. Read [state-workbench.md](references/state-workbench.md) for multi-state verification and unsupported browser states.
4. Report `verifying` only after a real source diff exists and validation completes. The web adapter reloads to clear preview overrides and measures the rebuilt result.
5. Require measured geometry for selection targets. Treat zero-size, fallback, or out-of-bounds targets as failures.
6. Mark changes applied only after the source diff exists. Mark verification passed only when every recorded state matches.
7. Read the completed apply run and return the source diff summary, validation results, verification count, and unresolved items.
8. If the run needs attention, explain the mismatch and wait for the user to authorize the in-product retry. Never retry automatically.

For native limitations and motion registration, read [platform-setup.md](references/platform-setup.md).

## Update project integration

When the user asks to update Foundry, run `<skill-root>/scripts/foundry.sh update --project <root> --yes`. The updater refreshes checksum-matched Foundry files, skill bundles, and agent configuration, while preserving files that changed after installation. Run doctor after the update, report every preserved path, and ask the user to restart their coding agent before starting a new apply session.

## Remove project integration

Run `<skill-root>/scripts/foundry.sh uninstall --project <root>` only when the user explicitly asks. Preserve any Foundry-generated file whose contents changed after setup.
