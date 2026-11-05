# OpenAI local-MCP access request draft

Status: not sent. Fill the organization ID and confirmed partner contact privately. Do not commit those fields or invent a recipient.

Subject: Local-MCP plugin submission access for Foundry

Hi [OpenAI representative],

I'd like to request local-MCP plugin submission access for our publishing organization, [organization ID].

Foundry is an open-source, local-first visual workbench for coding agents. Users select and manipulate their running interface, review an exact source-mapped change set, then have their agent apply it and verify the rebuilt result.

The plugin needs desktop execution because its stdio MCP bridge connects to a runtime on the user's own machine. We are preparing a self-contained package with the bridge, dependencies and skills, without lifecycle hooks or a hosted proxy. Project setup uses a version-pinned npm CLI. Source edits require a reviewed Apply request.

Website: https://withfoundry.ai
Source: https://github.com/seanx24x/foundry-design-control
Privacy: https://github.com/seanx24x/foundry-design-control/blob/main/PRIVACY.md

Could you confirm eligibility and the steps to allowlist this organization for the desktop-only local-MCP submission route? We will wait for confirmation before submitting.

Thanks,
Sean
