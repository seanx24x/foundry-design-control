# OpenAI Plugin Directory submission

Foundry is prepared as a skills-first plugin for the universal Plugin Directory shared by ChatGPT and Codex.

## Why skills first

Foundry's runtime and source-editing bridge are intentionally local. The public OpenAI MCP submission flow requires a publicly reachable HTTPS MCP server, while Foundry's MCP server runs on the user's machine and communicates only with its loopback runtime. The skills-first submission preserves that local-first boundary.

After installing the directory plugin, the Foundry skill guides the user through installing the versioned local CLI and MCP bridge. A coding-agent restart is required when the local MCP connection is installed or updated.

## Build the upload

Run:

```bash
pnpm openai:submission
```

This produces two ignored artifacts:

- `artifacts/openai/foundry-design-control-openai-skill-<version>.zip`
- `artifacts/openai/foundry-design-control-openai-plugin-<version>.zip`

Use the skill zip for the portal's **Skills only** submission. The plugin zip is retained for local Plugin Directory testing and contains no MCP declaration.

## Portal checklist

1. Confirm the submitting OpenAI Platform organization grants **Apps Management: Write**.
2. Complete individual or business identity verification in the same organization.
3. Create a **Skills only** submission.
4. Copy the listing fields from `submission.json`.
5. Upload the generated skill zip.
6. Add the five positive and three negative cases from `test-cases.json`.
7. Select the intended country availability.
8. Complete the policy attestations and submit for review.

The portal-only identity, availability, and policy decisions must be completed by the publisher. Do not describe Foundry as directory-installed until OpenAI approves the listing.

## Future MCP submission

Do not introduce a hosted MCP proxy solely to satisfy directory submission. Revisit an MCP-backed OpenAI listing only if the platform adds support for reviewed local MCP packages, or if Foundry deliberately adopts an optional hosted service with an updated privacy model.
