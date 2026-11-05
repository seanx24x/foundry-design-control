# Review agent readiness during deferred rendering

## Failure

The packed compatibility CI reached a real connected MCP listener, but React/Vite
and Next.js timed out waiting for Review's agent-ready Apply action. Storybook
passed. The failure happened before source mutation; the passing Apply/golden
checks did not prove this connection ordering was safe.

Review inputs intentionally defer full session rendering so polling does not
replace the focused control or discard a draft. A newly connected listener could
update the internal presence model while the visible Apply button remained in its
old offline state. Checkbox focus made the race reproducible without network mocks
or an increased timeout.

## Correction

`syncReviewAgentPresence` updates only the existing action and connection text
after an accepted session read, before the full-render deferral decision. It does
not replace Review rows, inputs or drafts, move focus, change inclusion, queue a
run, or claim source verification. The normal renderer uses the same helper.

Submission, zero-inclusion and Review transaction safety gates remain in place.
A presence refresh cannot re-enable a pending submission or a blocked batch, and
does not replace its submitting label. Disconnecting updates the action back to
Queue rather than claiming a live agent.

## Regression contract

- Unit tests execute the actual session-commit and chrome-refresh functions with
  full rendering deferred. They check connect/disconnect, draft/selection/focus
  retention, pending submissions, blocked transactions and rejected inclusion.
- The compatibility harness approves while offline, focuses the original Review
  checkbox, then connects the real MCP listener. It requires agent-ready Apply
  with that exact DOM node still connected and focused, followed by the unchanged
  reviewed-source, rebuild, browser measurement, Delivery and ambiguity checks.
- Failure evidence records action label, disabled/submitting state, visible
  connection state and focus metadata, without exporting credentials or drafts.
- The deterministic React/Vite ordering fails on the previous product code and
  passes on the corrected code. CI must still pass against the final commit.

No timeout was increased, handshake mocked or failed assertion removed.
