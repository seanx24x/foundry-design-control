---
name: foundry-design-control
description: Start and operate a local Foundry visual design session for live web, SwiftUI, or React Native interfaces; inspect rendered elements, collect precise layout, style, content, accessibility, responsive, state, asset, and motion refinements; convert the reviewed change ledger into source edits; and verify the rebuilt result. Use when the user explicitly asks to start Foundry, open a visual design inspector, visually refine a running product, collect many interface changes into one accurate prompt, or apply a Foundry change set.
---

# Foundry Design Control

Use Foundry as a reviewable bridge between visual decisions and source code. Keep preview overrides temporary. Apply source edits only after the user reviews the change ledger.

## Start a session

1. Inspect the project, current worktree, framework, development command, and existing Foundry configuration.
2. Run `scripts/foundry.sh doctor --project <root>`.
3. If setup is absent, read [platform-setup.md](references/platform-setup.md), show the proposed files, then run `scripts/foundry.sh setup --project <root> --agent none --yes`. The plugin already supplies Codex MCP configuration.
4. Run `scripts/foundry.sh start --project <root>`. It may start the detected development command when the configured preview URL is not already available.
5. Keep the Foundry runtime alive while the user selects and refines elements.

Do not launch Foundry merely because a task contains design work. Require an explicit request for a visual or Foundry session.

## Read and review changes

1. Prefer the Foundry MCP tools when available. Otherwise export with `scripts/foundry.sh export <session-id> --format json`.
2. Treat JSON as canonical and the consolidated prompt as a portable rendering of that JSON.
3. Check every target's source reference, locator evidence, mapping confidence, state, theme, breakpoint, and instance/component scope.
4. Keep `unresolved` targets out of the apply batch. Ask for an explicit mapping rather than guessing.
5. Collapse repeated changes only by target, property, scope, breakpoint, theme, and state. Preserve the first measured value and final requested value.

Read [change-contract.md](references/change-contract.md) when interpreting or troubleshooting a change set.

## Apply the reviewed batch

1. Reinspect current source before editing because the session revision may be stale.
2. Map each approved change to the narrowest source of truth: existing token, component property, style declaration, content source, asset reference, or motion parameter.
3. Preserve existing tokens and component conventions. Prefer a matching token over a new literal. Do not invent a global token for an instance-scoped adjustment.
4. Apply the batch as a normal, reviewable source diff. Never write generated preview styles into production code.
5. Report any request that cannot be represented without changing the requested scope or architecture.

## Verify

1. Run the project's targeted tests, type checks, lint, and build in proportion to the edited surface.
2. Rebuild or reload the target in the same device, viewport, theme, breakpoint, and state recorded by the session.
3. Use Foundry's verification action or MCP verification tool to compare requested values with newly rendered values.
4. Require measured geometry for selection targets. Treat zero-size, fallback, or out-of-bounds targets as failures.
5. Mark changes applied only after the source diff exists. Mark verification passed only when the rebuilt value matches.
6. Return the source diff summary, validation results, verification count, and unresolved items.

For native limitations and motion registration, read [platform-setup.md](references/platform-setup.md).

## Remove project integration

Run `scripts/foundry.sh uninstall --project <root>` only when the user explicitly asks. Preserve any Foundry-generated file whose contents changed after setup.
