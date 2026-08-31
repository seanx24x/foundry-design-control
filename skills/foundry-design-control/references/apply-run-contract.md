# Apply run contract

Use the apply run as the authoritative lifecycle for a reviewed web batch.

## Claim

1. Read `foundry_design_get_project_design`, then call `foundry_design_wait_for_apply` with the current project revision, design-graph revision, and agent identity.
2. Accept only a run in `claimed`. If it returns `needs_attention`, report the source or design-graph mismatch and wait for the user to retry.
3. Use only the run's `changeIds`. Re-read the session to obtain their approved values and evidence.
4. For every operation, use only its `selectedMappingId`. Stop if an approved change has multiple candidates without a selected mapping.

## Progress

Report state with `foundry_design_update_apply_run`:

1. `applying` before source edits.
2. `rebuilding` after edits, including every changed source file and each validation result.
3. `verifying` only when changed files are present and the affected surface rebuilt successfully.
4. `failed` for a terminal edit, build, or validation failure, including a concise error.

Do not skip states, claim a non-queued run, or start another run in the same session. Repeating a claim for the same run is idempotent.

## Verification

When the run reaches `verifying`, the web adapter reloads the page to remove temporary overrides, waits for stable target geometry, measures only the run's approved changes, and records results. Read the run until it becomes:

- `passed`: return the changed files, validation summary, and verification count.
- `needs_attention`: explain each mismatch and wait for an explicit in-product retry.
- `failed` or `cancelled`: stop and report the recorded reason.

Never retry automatically. A user-authorized retry creates a new run linked through `retryOf` and increments `attempts`.
