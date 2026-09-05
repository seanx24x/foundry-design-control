# Changelog

## 0.2.0-beta.14 - 2026-09-04

- Made one machine-level agent bridge the default for Codex, Cursor, and Claude Code while keeping project-scoped installation as an explicit compatibility option.
- Reduced each project connection to its Foundry adapter, project configuration, and install manifest without duplicating MCP servers or skills.
- Added checksum-safe migration from Foundry-owned project MCP configuration and skill files to the shared connection model, preserving customized files.
- Split Doctor reporting into project connection, machine bridge, legacy project configuration, runtime, and active-listener checks.
- Added lightweight project disconnect and machine-level uninstall commands without removing unrelated agent configuration.
- Added multi-project companion state and packed upgrade coverage for legacy project-local installations.

## 0.2.0-beta.13 - 2026-09-04

- Prevented accidental setup in a user home folder and added nearest-project discovery for commands launched from nested directories.
- Unified project and shared-agent repair so stale project-scoped MCP references are upgraded with the active release.
- Normalized common local preview addresses such as `localhost:3000` into valid browser URLs.
- Added install-once host setup, connect, reset, and companion status commands.
- Added a local companion registry for installed agents and recently opened projects without accounts or telemetry.
- Deduplicated overlapping project and host configuration paths in Doctor output.

## 0.2.0-beta.12 - 2026-09-04

- Keep agent claim leases alive through source application, rebuild, and rendered verification.
- Preserve interrupted runs and require an explicit in-product resume before another agent can continue them.
- Distinguish installed MCP configuration from a live listening agent in Doctor and connection messaging.
- Repair Claude hosts where a bare `~/.mcp.json` prevents user MCP servers from loading.
- Report the published MCP server version from package metadata instead of a hard-coded value.

## 0.2.0-beta.11 - 2026-09-04

- Kept claimed Apply with agent handoffs alive automatically while the coding agent inspects source, edits files, rebuilds, and verifies the result.
- Added bounded heartbeat recovery so temporary runtime interruptions do not silently abandon an active design batch.
- Clarified the connected state in Review so users can see that Foundry is holding the handoff while source work begins.
- Replaced immediate apply cancellation with a deliberate two-step Stop apply confirmation.
- Added regression coverage for claim renewal, transient heartbeat failures, terminal run states, and the updated handoff controls.

## 0.2.0-beta.10 - 2026-09-04

- Added Motion Studio discovery for CSS animations, CSS transitions, and Web Animations, with playback, looping, speed, and timeline controls.
- Added rendered keyframe track editing with source-aware change records and verification.
- Moved the change summary to the top center of the canvas so it no longer competes with the canvas toolbar.
- Added permanent deletion for unapplied review changes. Deleting restores the recorded original value on the canvas and removes the change from the local batch.
- Updated the matching Light and Dark Figma component masters for the revised change summary and review deletion action.

## 0.2.0-beta.9 - 2026-09-03

- Pinned generated coding-agent connections to the exact Foundry MCP release so a stale moving tag cannot load a mismatched bridge.
- Added online revalidation to the installed skill launcher while keeping `npx foundry-design` as the single public command.
- Added a release preflight that shows the exact CLI and agent-bridge versions before setup, update, repair, or uninstall changes local configuration.
- Added regression coverage for exact-version MCP configuration and fresh-cache public installation.
- Removed stale guidance that sent testers through the moving `@beta` tag after `latest` became the current release channel.

## 0.2.0-beta.8 - 2026-09-03

- Added a fixed-size canvas that preserves real project viewport dimensions, with explicit pan, zoom, actual-size, fit, and fit-width controls.
- Replaced browser-native property selectors with accessible, theme-aware Foundry menus across the workspace and direct overlay.
- Added editable drop shadows, inner shadows, layer blur, and background blur without changing the existing design-change contract.
- Added clear dismissal, Escape handling, state preservation, and focus restoration for Design Health and Design Memory.
- Refined the Light and Dark workspace, Layers, Inspector, Review, Compare, controls, typography, and Keyline icon presentation around the shared 4px interface system.

## 0.2.0-beta.7 - 2026-09-02

- Added leased agent handoffs with per-claim identities so abandoned claims return safely to the queue before source work begins.
- Added an agent heartbeat for extending an active handoff while the coding agent reinspects source and prerequisites.
- Distinguished a received handoff from source application and added a copyable reconnect action when the agent disconnects.
- Continued rendered verification after Review closes, reopens, or the preview refreshes.
- Corrected the Position and size section rhythm with a grid-aligned inset below its divider.

## 0.2.0-beta.6 - 2026-09-02

- Added `npx foundry-design@beta` as the single install, update, repair, validate, start, and resume entry point.
- Made reviewed apply runs durable while the coding agent is offline, with automatic claiming after the MCP listener reconnects.
- Added loopback-only basic preview injection for web projects without a safely detectable client entry, while preserving precision instrumentation for exact source mapping.
- Added shared-connection checks and `doctor --repair`, plus a copyable repair command in the live session status panel.
- Added current-revision session resume and safe reuse of an already running local Foundry runtime.
- Added Cursor and Claude Code plugin session hooks and a Cursor command that prepare Foundry-enabled workspaces for the apply listener workflow.
- Made the root README the canonical source for all seven public package READMEs and automated their release synchronization.

## 0.2.0-beta.5 - 2026-09-02

- Added one-command shared agent setup with `setup --global`, so the MCP connection and Foundry skill can be reused across projects.
- Added independent packed-install coverage for Codex, Cursor, Claude Code, and plugin-provided project setup.
- Added an in-product first-run checklist covering setup, agent connection, selection, a recorded change, and verified application.
- Added privacy-safe copied diagnostics containing connection state and counts without project content, paths, selectors, session IDs, or tokens.
- Kept project-local setup available for teams that prefer repository-scoped agent configuration.

## 0.2.0-beta.4 - 2026-09-02

- Added a live coding-agent listener heartbeat between the MCP bridge and local runtime.
- Prevented Apply with agent from queuing work when no coding agent is available to claim it.
- Added clear connected and disconnected states with a copyable recovery instruction in Review.
- Simplified installation guidance around one agent-led setup prompt and one required restart.
- Made session startup explain when the handoff is ready and how to reconnect it.

## 0.2.0-beta.3 - 2026-09-02

- Made setup transactional, validated, and recoverable after interruption.
- Replaced the Next.js remote import with a bundler-independent local bootstrap.
- Added safe migration for beta.2 Next.js loader repairs and install-manifest version 2.
- Added `foundry-design update` for checksum-safe upgrades of project integration, agent connections, and installed skills.
- Preserved user-customized managed files and retained non-default runtime and preview URLs during updates.
- Fixed active-agent detection and direct Codex MCP configuration for reliable Apply with agent handoff.
- Added system-aware Light and Dark interface themes, a focused review modal, a fixed change summary, and shared dock sizing.
- Normalized Keyline icon rendering and introduced automated 4px interface-foundation audits.
- Refined Layers density, inspector organization, contextual controls, tokens, and color editing.
- Replaced the original card fixture with the fully instrumented Morrow signup experience.

## 0.2.0-beta.2 - 2026-08-30

- Bundled the complete Foundry skill in the public CLI package.
- Added project-scoped skill installation for Codex, Cursor, and Claude Code.
- Added reversible skill removal with protection for user-customized files.
- Switched public MCP and launcher fallbacks to the npm beta channel.
- Added clean tarball coverage for setup and uninstall without repository access.

## 0.2.0-beta.1 - 2026-08-30

- Added the continuous review, apply, rebuild, and rendered-verification workflow.
- Added persistent apply runs, agent claiming, cancellation, recovery, and explicit retry authorization.
- Added project intelligence for tokens, components, variants, states, and responsive contexts.
- Refined the live inspector, layers and components browsing, review selection, and precision controls.
- Added portable plugin packaging for Codex, Cursor, and Claude-compatible MCP workflows.
- Preserved local-only storage, prompt and JSON export, and temporary preview overrides.

This is a beta release. Back up important work and review every approved change before applying it.
