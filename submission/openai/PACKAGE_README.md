# Foundry Design Control

Visual editing for your agent. Foundry turns a running local product into a precision workbench. Select rendered elements, adjust design values, review the source-mapped changes, then ask your coding agent to apply the approved batch and verify the rebuilt result.

## Desktop execution

This package needs a local desktop thread and Node.js 20.19 or newer. It includes a stdio MCP bridge and its dependencies. `mcp.json` runs `node` against the bundled `server/index.mjs`; no package download is needed to start the bridge. No lifecycle hooks or hosted MCP proxy are included. Ordinary cloud chats cannot execute this local workflow.

For project setup, ask the agent to run the skill's `skills/foundry-design-control/scripts/foundry.sh` helper from your product repository. The helper fetches `foundry-design@{{VERSION}}` and dependencies from npm when not cached. This adds development-only instrumentation and local project configuration with your authorization. It does not add Foundry to production builds.

Then ask: **Start Foundry for this project and keep listening for Apply with agent requests.** Configuration, runtime health and an active listener are separate states. Complete source changes only through a reviewed Apply request. Source validation and rendered verification are separate checks, and a failed check is not success.

## Data and permissions

Foundry's bridge talks to a loopback runtime. Session data, paths, source mappings, previews and apply history are stored locally. The host coding agent reads project context, performs authorized edits and runs validation; the agent provider, npm and GitHub operate under their own policies. This is local-first software, not a promise that your coding agent never sends context to its provider. No Foundry account, API key or telemetry is required. Do not publish session credentials or unredacted exports.

Read [Privacy](PRIVACY.md), [Terms](TERMS.md) and [License](LICENSE). Dependency licenses are in `THIRD_PARTY_NOTICES.md`. Support: [GitHub Issues](https://github.com/seanx24x/foundry-design-control/issues).
