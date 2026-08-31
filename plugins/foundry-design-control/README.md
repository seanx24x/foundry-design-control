# Foundry Design Control plugin

This portable plugin gives Codex, Cursor, and Claude-compatible coding agents the Foundry workflow and local MCP connection.

After installing the plugin in your agent, open a project and ask: `Start Foundry for this project.` Foundry installs its development-only adapter, opens the local design surface, records reviewed changes, and lets the agent apply and verify them.

Foundry requires Node.js 20 or newer. It uses only loopback networking and local storage. Review [Privacy](../../PRIVACY.md) and [Security](../../SECURITY.md) before sharing sensitive projects.
