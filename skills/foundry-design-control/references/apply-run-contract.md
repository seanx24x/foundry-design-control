# Apply run contract

Use the apply run as the authoritative lifecycle for a reviewed web batch.

## Claim

1. Read `foundry_design_get_project_design`, then call `foundry_design_wait_for_apply` with the current project revision, design-graph revision, and agent identity.
2. Accept only a run in `claimed` with a `claimAttemptId`. If it returns `needs_attention`, report the source or design-graph mismatch and wait for the user to retry.
3. Use only the run's `changeIds`. Re-read the session to obtain their approved values and evidence.
4. For every operation, use only its `selectedMappingId`. Stop if an approved change has multiple candidates without a selected mapping.
5. A claim is a short handoff lease, not evidence that source work has begun. The MCP bridge renews the claim in the background while the current agent process remains alive and the run is still `claimed`. Immediately report `applying` once source inspection begins. For a long external prerequisite, call `foundry_design_heartbeat_apply_run` explicitly before the lease expires.

## Progress

Report state with `foundry_design_update_apply_run`. Include the same `claimAttemptId` in every update:

1. `applying` before source edits.
2. `rebuilding` after edits, including every changed source file and each validation result.
3. `verifying` only when changed files are present and the affected surface rebuilt successfully.
4. `failed` for a terminal edit, build, or validation failure, including a concise error.

Do not skip states, claim a non-queued run, or start another run in the same session. Repeating a claim for the same run and agent identity is idempotent. If the MCP process exits or the lease cannot be renewed before `applying`, Foundry clears the abandoned claim and returns the run to `queued`. A stale agent must not edit source or send progress after that point. Wait for and claim the queued run again. Cancelling an active run is destructive because it ends the approved batch, so the Foundry interface requires a second confirmation before it sends the cancellation.

## Verification

When the run reaches `verifying`, the web adapter reloads the page to remove temporary overrides, even when Review is closed. It waits for stable target geometry, measures only the run's approved changes, and records results. Read the run until it becomes:

- `passed`: return the changed files, validation summary, and verification count.
- `needs_attention`: explain each mismatch and wait for an explicit in-product retry.
- `failed` or `cancelled`: stop and report the recorded reason.

Never retry automatically. A user-authorized retry creates a new run linked through `retryOf` and increments `attempts`.
