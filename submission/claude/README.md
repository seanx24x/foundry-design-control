# Claude directory review packet

Status: preparation only. Local structural validation is not portal validation, security review, or a directory listing.

## Portal values

- Portal: <https://claude.ai/directory/manage>
- Submission type: **Plugin bundle**
- Repository: `seanx24x/foundry-design-control`
- Plugin path: `plugins/foundry-design-control`
- Branch: `chore/directory-submissions` after it has been pushed. Record the exact validated commit in private review notes. Do not use `main` until these changes are merged.
- Publisher: Sean Lynch
- Contact email: publisher must supply and confirm. Do not infer one from GitHub commits.
- Support: <https://github.com/seanx24x/foundry-design-control/issues>
- Privacy: <https://github.com/seanx24x/foundry-design-control/blob/main/PRIVACY.md>
- Terms: <https://github.com/seanx24x/foundry-design-control/blob/main/TERMS.md>

The plugin README supplies the listing description and discloses local execution, registry downloads, project access and coding-agent data handling. The manifest includes MIT licensing. All plugin files are inside the named folder. Both the MCP launcher and the skill's CLI helper pin the release version.

## Before submitting

```bash
claude plugin validate ./plugins/foundry-design-control --strict
pnpm distribution:check
pnpm test:submission
```

Use a paid Claude account with the required directory permission and a connected GitHub account with push access. In **Submit new → Plugin bundle**, enter the values above and run **Validate**. Resolve blocking results before submitting. A pinned npm launcher and the JavaScript SessionStart hook can still produce reviewer holds. Disclose them rather than claiming the plugin is scan-clean.

The portal needs contact details, data-handling answers and publisher policy acknowledgements. The publisher must review those answers and accept the required acknowledgements personally. Do not grant broad GitHub access, create a webhook or turn on automatic publication without confirming the exact permissions and update policy.

## Supported surfaces and evidence

Primary workflow: Claude Code with a local product checkout, Node.js 20.19+, browser and development server. Ordinary Claude chat ignores local stdio MCP, so do not list the complete visual-edit/apply workflow as chat-compatible. Local Cowork supports stdio MCP, but Foundry's project workflow there still needs client acceptance testing before compatibility claims.

Follow [the reviewer guide](../reviewer-guide.md). A CLI schema pass does not prove fresh installation, model behavior, real Apply or rendered verification. Do not reuse the website concept animation as a genuine agent execution recording.

## Directory versus official marketplace

This portal submits to the Claude plugin directory. It does **not** submit to `claude-plugins-official`. Inclusion in that separate marketplace requires discussion with an Anthropic partner contact. Existing installation through Foundry's own GitHub marketplace remains available while review is pending.

References checked 2026-11-05:

- [Submit a plugin](https://claude.com/docs/plugins/submit)
- [Pre-submission checklist](https://claude.com/docs/plugins/pre-submission-checklist)
- [Platform support](https://claude.com/docs/plugins/platform-support)
- [Anthropic marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces)
