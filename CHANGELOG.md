# Changelog

## 0.2.0-beta.23 - 2026-09-25

- Made the redesigned Foundry workspace the default, with an explicit `ui=legacy` fallback and continued support for existing `ui=next` links.
- Refined the application chrome, browser-style workspace tabs, Layers panel, floating tools, and all design studios around shared spacing, typography, icons, and light/dark surfaces.
- Added contextual inspector controls, inline advanced settings, authored variant previews, mixed-selection editing, and explicit local-preview and reviewed-source boundaries.
- Rendered authored Component Workshop variants directly in the workspace and refined Design System, Motion, Typography, Recipes, State Workbench, Responsive, Content Stress, Visual Agent, Branches, Memory, and Delivery.
- Improved Visual Agent preview navigation and cancellation, queued-agent guidance, pending Review priority after completed Apply, and reconnection of saved local edits.
- Preserved inspector selections and pending variant candidates when the preview disconnects, without reporting failed previews as accepted.
- Expanded source-backed delivery evidence, exact source anchors, session recovery, local visual checks, isolated browser regressions, and packed framework/install verification.
- Waited for client-rendered targets before screenshot capture, pinned capture and test browser versions, and prevented late Responsive Lab updates from restoring temporary widths after navigation.

## 0.2.0-beta.22 - 2026-09-13

- Scoped Content Stress Lab findings to the exact stressed selection and stopped honestly when that rendered target disconnects or is replaced.
- Made stress application and design-health scans return success only after the requested rendered state has been measured.
- Removed false overflow findings for content below the fold and intentional scroll containers while preserving actionable horizontal viewport leakage and clipped-content checks.
- Corrected keyboard focus evidence so authored focus treatments are measured against the unfocused baseline without inventing unsupported failures.
- Added a canonical Cursor installer contract that synchronizes and validates the exact current MCP package across release documentation.
- Strengthened the real Morrow golden path to require one selection-scoped, source-mapped 40px-to-44px touch-target correction before Apply.

## 0.2.0-beta.21 - 2026-09-10

- Added an acknowledged preview-context engine for real authored viewport, theme, state, and motion behavior across Canvas, State Workbench, Responsive Lab, Review, Delivery, and rebuilt verification.
- Replaced simulated State Workbench options with indexed project states, isolated preview liveness, atomic restoration, and measured Matrix v2 exports that distinguish tested, untested, and unsupported contexts.
- Connected Responsive Edit Scope to staged context sets and added acknowledged per-frame audits with stable-layout evidence, partial failures, and cross-frame clipping, overflow, wrapping, and layout-jump findings.
- Added authenticated project re-indexing with atomic graph replacement, revision conflict protection, and live adapter hydration from the authoritative stored graph.
- Added two-up Typography comparison with matching specimens, loaded-face and geometry evidence, temporary candidate previews, and reviewed project or Google font adoption.
- Made Visual Agent and every durable preview action connection-aware, correlated, and explicit about queued, claimed, acknowledged, offline, and partial-success states.
- Froze the exact reviewed Apply contract per run and bound rendered verification to its active claim attempt, requested property, value, and context so stale or manual evidence cannot satisfy a later handoff.
- Upgraded the local protocol to 1.3.0 with backward-compatible 1.2.0 migration, context sets, preview capabilities, current context, and last successful application evidence.
- Rebuilt the Morrow fixture as a truthful source-mapped demonstration with current fixture-relative annotations, one deterministic 40px-to-44px touch-target correction, authored loading state, and a complete semantic dark theme.
- Added a real packed and registry golden-path harness covering the public CLI, live MCP listener, source edit, deterministic rebuild, 44px rendered verification, delivery history, and offline, disconnected, and mismatch failures.
- Sealed all seven release tarballs with immutable integrity metadata and hardened publication, registry verification, tag promotion, and Claude Desktop bundle sequencing.

## 0.2.0-beta.20 - 2026-09-10

- Added Foundry Delivery with versioned handoff records, editable engineering intent, deterministic evidence, acceptance criteria, risks, and questions created at the reviewed Apply boundary.
- Added source-backed documentation generation, freshness tracking, immutable verified design history, delivery milestones, and conflict-safe repository, Markdown, and JSON exports.
- Unified every workspace around the persistent 48px application bar, connected panel geometry, shared dividers, compact controls, consistent search fields, and aligned empty states.
- Refined all studios, Review, Apply, and Delivery across light, dark, 1920px, and compact layouts with stable scroll geometry and no clipped or duplicated controls.
- Preserved drafts, focus, selection, scroll, motion editing, and canvas interaction across live session polling while separating runtime, preview, and agent-listener readiness.
- Improved keyboard safety, landmark structure, motion control semantics, contrast, reduced-motion behavior, and automated visual and overflow regression coverage.

## 0.2.0-beta.17 - 2026-09-05

- Added Component Workshop for inspecting live instances, variants, interaction states, and source-safe edit scopes.
- Added Responsive Design Lab with native viewport comparisons, temporary stress tests, breakpoint evidence, and explicit responsive promotion.
- Added Design System intelligence for tracing project tokens, usage, drift, and downstream impact before review.
- Expanded Motion Studio with live transport, editable timing, rendered keyframes, motion health, and source-aware review.
- Added Typography Studio with project, Google, and local font discovery, live treatments, scale tools, diagnostics, and integration planning.
- Added isolated Design Branches with native-size comparison, selective composition, reversible switching, notes, rejection, archiving, and explicit promotion into Review and apply.
- Added matching Light and Dark Figma component families and automated browser coverage for the advanced workspace workflow.
- Added the skills-first OpenAI directory submission packet while preserving Foundry's local-only MCP boundary.

## 0.2.0-beta.16 - 2026-09-04

- Added a registry-backed preflight that verifies the trusted GitHub publisher for all seven public packages before release dispatch.
- Added a checked-in trusted-publisher contract so repository, workflow, environment, permissions, and package coverage cannot drift silently.
- Updated the release workflow to the Node 24 versions of checkout, setup-node, and pnpm setup, removing the deprecated-action and unsupported-input warnings.
- Made publication verification wait for npm's asynchronous package processing before reporting a release as incomplete.
- Prepared the first release that can prove token-free npm publication through GitHub Actions.

## 0.2.0-beta.15 - 2026-09-04

- Aligned one portable plugin bundle across Codex, Cursor, Claude Code, and Claude Desktop with synchronized release metadata.
- Added automated distribution checks for plugin manifests, marketplace entries, lifecycle hooks, and exact MCP bridge pins.
- Added agent-native installation and update guidance, including Claude Code marketplace commands and the current Cursor MCP install link.
- Prepared Cursor and Anthropic marketplace submission materials without replacing the universal npm setup path.
- Updated the release workflow for npm trusted publishing with Node 24, npm 11, OIDC provenance, and token-free beta publication.
- Made release publication build and publish the validated tarballs rather than relying on mutable workspace package state.

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
