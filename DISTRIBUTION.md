# Foundry distribution

Foundry uses one portable plugin bundle and one public npm release. The npm route works before marketplace review and remains the recovery path for every supported coding agent.

## Universal installation

```bash
npx foundry-design install
```

Restart Codex, Cursor, and Claude Code once. In each product repository, run:

```bash
npx foundry-design
```

Then reopen the same project folder in the agent and ask:

```text
Start Foundry for this project and keep listening for Apply with agent requests.
```

## Codex

Before a public marketplace listing is available, install the shared Codex integration through npm:

```bash
npx foundry-design install-agent codex
```

The repository includes an Agent Plugin manifest, Codex interface metadata, the Foundry skill, and its MCP connection for marketplace validation. A newly installed or updated plugin becomes available in a new Codex task.

Foundry needs the desktop-only local-MCP submission route. OpenAI currently limits this route to approved partners and requires the submitting organization to be allowlisted. Build the self-contained candidate and review packet with:

```bash
pnpm openai:submission
```

See [the OpenAI submission README](submission/openai/README.md) for the access gate, listing copy, test cases, and validation boundaries. Do not submit a skills-only workaround that silently installs the same local bridge.

## Cursor

Use the current one-click MCP connection:

[Add Foundry to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=foundry-design-control&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIi0tcHJlZmVyLW9ubGluZSIsImZvdW5kcnktZGVzaWduLW1jcC1zZXJ2ZXJAMC4yLjAtYmV0YS4yNSJdLCJlbnYiOnsiRk9VTkRSWV9ERVNJR05fUlVOVElNRV9VUkwiOiJodHRwOi8vMTI3LjAuMC4xOjQzODcifX0%3D)

For the complete plugin during local review, copy or link `plugins/foundry-design-control` into `~/.cursor/plugins/local/foundry-design-control`, reload Cursor, and confirm the Foundry skill, command, hook, and MCP server in Customize.

## Claude Code

```text
/plugin marketplace add seanx24x/foundry-design-control
/plugin install foundry-design-control@foundry-design-control
/reload-plugins
```

The marketplace and plugin versions are synchronized by `pnpm release:sync` and rejected by the release check when they drift.

## Claude Desktop

Install `foundry-design-control-<version>.mcpb` from the matching GitHub release through **Settings → Extensions → Advanced → Install Extension**. The bundle contains the local MCP bridge. Project instrumentation still comes from `npx foundry-design` inside the product repository.

## Release validation

```bash
pnpm check
pnpm test:e2e
pnpm release:check
pnpm release:pack
pnpm release:test-install
pnpm distribution:check
pnpm mcpb:build
```

The release workflow can publish the seven beta packages with npm trusted publishing. Each package must authorize `.github/workflows/release.yml` as its npm trusted publisher. The workflow publishes `beta` with OIDC and provenance. Moving `latest` remains a separate authenticated operation because npm OIDC currently authorizes publication, not distribution-tag changes.

## Public review boundaries

- Cursor marketplace submission: `https://cursor.com/marketplace/publish`
- Claude plugin directory: `https://claude.ai/directory/manage`, with [submission notes](submission/claude/README.md). The separate `claude-plugins-official` marketplace requires an Anthropic partner discussion.
- OpenAI Plugin Directory: `https://platform.openai.com/plugins`, after local-MCP allowlisting.

Do not describe a plugin as marketplace-installed until its listing has passed that host's review. The npm installer is the supported public route until then.
