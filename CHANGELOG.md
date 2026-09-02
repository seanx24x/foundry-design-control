# Changelog

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
