# Foundry reviewer workflow

This is an execution checklist, not a claim these steps have been completed on each host. Existing release automation and the new stdio smoke test are separate evidence.

## Isolate the review

Use a fresh disposable checkout of `examples/compatibility/react-vite` from the public source repository, not a personal project or existing Foundry session. Record host version, plugin commit/ZIP SHA-256, Node version and operating system. No Foundry account or API key is required. The coding agent needs its usual signed-in account. Use only its normal permissions and review every setup request.

1. Install the exact plugin candidate in a fresh host context. Do not replace an active shared installation or restart the user's existing sessions.
2. Confirm the skill loads and the local MCP tools are available. An available tool is not an active listener.
3. Ask: `Start Foundry for this project and keep listening for Apply with agent requests.` Confirm the project root before setup. Approve development-only instrumentation in this disposable project only.
4. In the real preview, select one mapped text node and change a single font size. Record the original value, requested value, source file and baseline revision. Confirm that the visual preview did not change the source yet.
5. Review the exact batch and choose Apply with agent. Watch the real claim, source edit, project checks, rebuild and rendered verification. Record the source diff and terminal run status. Success requires the rebuilt measurement to match the requested value, not just green build output.
6. Stop the disposable session. Confirm the review processes/listener terminate and unrelated user sessions remain unchanged.

Use `openai/test-cases.json` for five positive and three negative behavioral cases. Run each on the host under review. Mark unrun cases as unrun. The stale-install/update cases must preserve customized files; mismatch/retry cases require separately prepared disposable fixtures and must not be simulated as successful runs.

## Reviewer recording

Capture the genuine selection, edited value, unchanged-source preview, reviewed Apply, narrow source diff and rebuilt verification. Waiting may be cut editorially but cannot be replaced by invented success. Hide session tokens, private paths, personal project details, account information and browser URL credentials. Use a dedicated demo and review the recording before sharing.

The 13-second website film is an authored marketing concept. It is not a source Apply recording and must not be submitted as execution proof.

## Record results separately

- Structural checks: manifest, archive layout, pinned launcher, path safety and stdio tool discovery.
- Client acceptance: fresh install, skill discovery, permissions, actual agent behavior and cleanup.
- Product verification: source diff, tests, real rebuild and rendered measurements.
- Portal: exact scanned commit or uploaded ZIP, validation findings, publisher decisions and review status.

Do not mark a public listing approved or published based on any local check. Keep private reviewer credentials and publisher identity materials outside the repository and ZIP.
