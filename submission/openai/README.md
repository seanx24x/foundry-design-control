# OpenAI directory submission candidate

Foundry requires the **desktop-only local-MCP** route. This is not a remote HTTPS MCP service and is not a skills-only workaround. OpenAI currently limits local-MCP submissions to approved partners. No organization allowlist, portal submission, or approval is claimed here.

## Access comes first

Find the intended publishing organization's ID in [OpenAI Platform settings](https://platform.openai.com/settings/organization/general), then use [the access-request draft](access-request.md) with your actual OpenAI representative. Wait for explicit allowlist confirmation. Do not send credentials, invent a representative, or introduce a hosted proxy just to bypass this gate.

## Build and inspect

```bash
pnpm openai:submission
pnpm test:submission
```

Each build creates a new directory under `artifacts/openai/`, preserving earlier candidates and sealed npm release artifacts. It contains a ZIP with root `plugin.json`, `mcp.json`, unchanged skill instructions, a pinned CLI helper, assets, policy files, and an unminified self-contained stdio bridge with its dependency code, source map and third-party notices. No lifecycle hooks, app references, alternate host manifests, credentials or user sessions are included.

`provenance.json` stays outside the public ZIP. It records the source commit, dirty state, source input hashes, bundled dependency versions and ZIP digest. A dirty candidate is a rehearsal, not an immutable review version. Build again from a committed checkout before uploading. This prepares a directory candidate only. It does not publish or change npm beta/latest tags.

## Submission after access approval

1. Confirm the correct publishing organization and its identity verification. The publisher needs organization-owner or Apps Management Write access.
2. Complete a clean desktop install and the workflows in [the reviewer guide](../reviewer-guide.md). Expected cases are not executed evidence.
3. Supply a genuine workflow recording. The website's authored concept film is not agent/source-verification evidence.
4. Open [the plugin portal](https://platform.openai.com/plugins), select **Create plugin → Skills only → Upload ZIP**, and upload the **complete desktop plugin ZIP, including local MCP**. That UI label does not mean removing the bridge.
5. Review imported listing metadata and test cases, choose country availability, and enter any private reviewer details separately. No Foundry account or API key is required.
6. The publisher completes policy attestations, submits, and explicitly publishes only after approval.

If `requires_local_executor` or local MCP is rejected, confirm allowlisting with OpenAI rather than stripping the restriction. Automated smoke tests do not prove a real desktop install or directory acceptance.

## Official references

- [Desktop-only plugins](https://developers.openai.com/plugins/deploy/desktop-only)
- [Submission and publishing](https://developers.openai.com/plugins/deploy/submission)
- [Package structure](https://developers.openai.com/plugins/build/plugins)

Requirements checked on 2026-11-05. Recheck before upload.
