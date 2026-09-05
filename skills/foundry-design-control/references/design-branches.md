# Design branches

Use Design branches when the user wants to explore materially different visual directions before choosing what should enter Review and apply.

## Branch contract

- Main direction is the source-ready session change set.
- A branch owns an isolated list of design changes and direct-manipulation operations.
- Creating a direction from another direction copies its current decisions without linking future edits.
- Switching directions restores the previous preview values before applying the next direction.
- Branch navigation is presentation state. It must not edit source, create an Apply run, or mark changes applied.
- Keep no more than eight active directions in one session. Archive rejected or obsolete directions instead of deleting their rationale.

## Compare and compose

1. Compare two directions in fixed-size iframes using the recorded project viewport.
2. Treat the branch ledgers as canonical. Never infer a viewport from overflowing content.
3. Select individual decisions by branch and change identifier.
4. Combine selections into a new isolated direction. Coalesce only changes with the same target, property, scope, breakpoint, theme, and state.
5. Record a concise rejection note when a direction is rejected. Preserve that note with the session.

## Promote a direction

Choosing a direction is an explicit boundary:

1. Confirm there is no active Apply run.
2. Copy the chosen direction into the main change set with fresh identifiers and draft statuses.
3. Mark the direction as chosen and return the active editing direction to Main.
4. Open Review and apply. The user must still approve exact changes before the agent edits source.

Never merge a direction directly into project files and never automatically retry or promote a rejected direction.

## Verification

- Confirm edits recorded in one branch never appear in another branch or Main.
- Switch repeatedly and verify the rendered product restores exact before and after values.
- Compare at the recorded viewport and theme.
- Combine decisions from at least two branches and verify only selected changes appear in the new direction.
- Promote the combined direction and confirm Review and apply contains the expected draft changes.
- Verify Light and Dark Foundry interface themes without altering the product theme.
