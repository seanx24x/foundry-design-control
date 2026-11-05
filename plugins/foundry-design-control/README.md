# Foundry Design Control plugin

This portable plugin gives Codex, Cursor, and Claude Code the same Foundry workflow, session guidance, and local MCP connection.

After installing the plugin in your agent, open a project and ask: `Start Foundry for this project.` Foundry installs its development-only adapter, opens the local design surface, records reviewed changes, and lets the agent apply and verify them.

Foundry requires Node.js 20.19 or newer and a local coding-agent executor. The Foundry runtime and bridge communicate over loopback and store sessions locally. Review [Privacy](https://github.com/seanx24x/foundry-design-control/blob/main/PRIVACY.md) and [Security](https://github.com/seanx24x/foundry-design-control/blob/main/SECURITY.md) before sharing sensitive projects. Your coding-agent provider has its own data handling policies.

## Install and start

After the host installs this plugin, open the product repository and ask the agent to run the bundled skill's `skills/foundry-design-control/scripts/foundry.sh` helper with no arguments once. The helper pins the CLI to the reviewed release. Restart or reload the host when prompted, reopen the same project folder, then ask:

```text
Start Foundry for this project and keep listening for Apply with agent requests.
```

The plugin provides the agent connection. The project command provides only the development adapter and local project metadata. Foundry never installs itself into production builds.

## Host behavior

- Codex loads the Foundry skill and MCP bridge from the Agent Plugin bundle.
- Cursor adds the `/foundry` command and prepares configured workspaces at session start.
- Claude Code adds the Foundry skill, MCP bridge, and SessionStart guidance. Run `/reload-plugins` after installation or update.
- Claude's local Cowork environment supports local MCP, but Foundry's full project setup and Apply workflow still needs separate client acceptance testing there. Ordinary Claude chat does not run the local MCP bridge. The independently packaged Claude Desktop `.mcpb` extension is a bridge-only installation option, not a public plugin-directory listing.

Run `npx foundry-design status` from the project whenever the browser does not show an active agent. Configuration, runtime health, and a live Apply listener are reported separately.

## What the plugin runs and accesses

The MCP configuration launches the exact `foundry-design-mcp-server` version recorded in `mcp.json` through npm's `npx`. The skill helper likewise launches an exact `foundry-design` release. First use can fetch those public packages and their dependencies from npm; npm's network and cache policies apply. No API key or Foundry account is required. Registry launchers remain subject to manual directory review even when pinned.

The Claude SessionStart hook reads the current workspace's `.foundry/foundry.config.json` existence and adds workflow guidance only for configured projects. It does not start a session or edit source. Foundry can install development adapters and local agent configuration when the user requests setup or repair, open a loopback preview, read project source and design metadata, and write source only through the reviewed Apply workflow. The host coding agent performs source edits and invokes project validation commands. It may send project context to its provider under that provider's policies.

Foundry does not include telemetry or a hosted proxy. Session tokens, paths, source locations, and exported change sets can be sensitive. Keep real sessions out of public review attachments. Report problems through [GitHub Issues](https://github.com/seanx24x/foundry-design-control/issues).
