# Foundry Design Control plugin

This portable plugin gives Codex, Cursor, and Claude Code the same Foundry workflow, session guidance, and local MCP connection.

After installing the plugin in your agent, open a project and ask: `Start Foundry for this project.` Foundry installs its development-only adapter, opens the local design surface, records reviewed changes, and lets the agent apply and verify them.

Foundry requires Node.js 20 or newer. It uses only loopback networking and local storage. Review [Privacy](../../PRIVACY.md) and [Security](../../SECURITY.md) before sharing sensitive projects.

## Install and start

After the host installs this plugin, open the product repository and run `npx foundry-design` once. Restart or reload the host when prompted, reopen the same project folder, then ask:

```text
Start Foundry for this project and keep listening for Apply with agent requests.
```

The plugin provides the agent connection. The project command provides only the development adapter and local project metadata. Foundry never installs itself into production builds.

## Host behavior

- Codex loads the Foundry skill and MCP bridge from the Agent Plugin bundle.
- Cursor adds the `/foundry` command and prepares configured workspaces at session start.
- Claude Code adds the Foundry skill, MCP bridge, and SessionStart guidance. Run `/reload-plugins` after installation or update.
- Claude Desktop uses the separately packaged `.mcpb` extension because it does not share every Claude Code plugin surface.

Run `npx foundry-design status` from the project whenever the browser does not show an active agent. Configuration, runtime health, and a live Apply listener are reported separately.
