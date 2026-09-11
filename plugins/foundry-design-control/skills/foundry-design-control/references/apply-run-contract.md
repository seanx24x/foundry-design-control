# Apply run contract

Use the apply run as the authoritative lifecycle for a reviewed web batch.

## Claim

1. Read `foundry_design_get_project_design`, then call `foundry_design_wait_for_apply` with the current project revision, design-graph revision, and agent identity.
2. Accept only a run in `claimed` with a `claimAttemptId`. If it returns `needs_attention`, report the source or design-graph mismatch and wait for the user to retry.
3. Use only the run's frozen `reviewedChangeSet` and exact `changeIds`. Do not substitute values, contexts, mappings, or source details from the mutable current ledger.
4. For every operation, use only its `selectedMappingId`. Stop if an approved change has multiple candidates without a selected mapping.
5. A claim is a short handoff lease, not evidence that source work has begun. The MCP bridge renews the claim in the background while the current agent process remains alive and the run is still `claimed`. Immediately report `applying` once source inspection begins. For a long external prerequisite, call `foundry_design_heartbeat_apply_run` explicitly before the lease expires.

## Progress

Report state with `foundry_design_update_apply_run`. Include the same `claimAttemptId` in every update:

1. `applying` before source edits.
2. `rebuilding` after edits, including every changed source file and each validation result.
3. While the run is still `rebuilding`, call `foundry_design_record_apply_result` exactly once with `runId`, the active `claimAttemptId`, and every frozen change ID. Foundry accepts it only when the source delta is measured against the claim baseline and every reported validation passes.
4. `verifying` only after the Apply-result acknowledgement succeeds. This transition authorizes the live preview to request a one-use challenge and measure the rebuilt product.
5. `failed` for a terminal edit, build, or validation failure, including a concise error.

Do not skip states, acknowledge an Apply result twice, claim a non-queued run, or start another run in the same session. A repeated claim is rejected; fetch current state instead. If the MCP process exits or the lease cannot be renewed before `applying`, Foundry clears the abandoned claim and returns the run to `queued`. A stale agent must not edit source or send progress after that point. Wait for and claim the queued run again.

If the lease expires during `applying`, `rebuilding`, or `verifying`, Foundry preserves the same run ID and moves it to `needs_attention` with `interruptedState`. Do not continue editing from the stale claim. The user must choose **Resume with agent** in Foundry. That authorization returns the same run to `queued`; claim it through `foundry_design_wait_for_apply`, reinspect current source and validation state, then continue from the safe next transition. A normal verification mismatch or terminal failure still uses **Retry with agent**, which creates a new `retryOf` run.

Cancelling an active run is destructive because it ends the approved batch, so the Foundry interface requires a second confirmation before it sends the cancellation.

## Verification

When the acknowledged run reaches `verifying`, the web adapter reloads the frozen reviewed target URL to remove temporary overrides, even when Review is closed. It obtains a one-use, run-and-attempt-bound verification challenge, waits for stable visible target geometry, verifies the frozen target identity, measures only the frozen approved changes, and records results from the configured preview origin. This challenge is a local origin-bound handoff, not remote attestation. An agent must not manually report web verification. Native verification is accepted only with the private claim capability retained by the MCP bridge; `claimAttemptId` remains correlation, not authority. Read the run until it becomes:

- `passed`: return the changed files, validation summary, and verification count.
- `needs_attention`: explain each mismatch and wait for an explicit in-product retry.
- `failed` or `cancelled`: stop and report the recorded reason.

Never retry automatically. A user-authorized retry creates a new run linked through `retryOf` and increments `attempts`.
