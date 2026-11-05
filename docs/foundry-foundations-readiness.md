# Connection and first edit — workspace foundations

SCREEN-20 uses the default Next foundations. Installation/version repair, release
and live source Apply remain separate gates.

2026-11-02 policy: `foundations=off` restores the previous Next presentation;
`foundations=pilot` remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

## Ownership and presentation

- `readiness-ui.js` retains its native dialog, workflow state, actions, read-only
  report request, eight-second timeout, two-second polling, single in-flight
  probe/coalescing and close/pagehide cleanup. The adapter uses the original
  check list, action buttons, command block and delegated recovery handler.
- One current next action leads the report. The existing journey indicates only
  the current step; it is not a fabricated completed history. Staged edits remain
  available for Review even when the Apply listener is offline.
- Inspect, Stage edits and Apply to source are separate explicit report claims.
  Missing/nonboolean values and failed probes read Not confirmed. Availability
  is not evidence of a successful source edit or verification.
- Failed checks precede warnings and passed checks, with stable ordering within
  a class. Unknown statuses remain Not confirmed and sort last. Original nodes,
  logical focus and scroll position survive presentation updates. A removed
  focused recovery action falls back to Check again.
- Terminal/restart instructions remain literal inert text. They disappear when
  their originating check passes, changes, disappears or cannot be refreshed.
  No command execution, automatic repair or agent-start claim was added.
- The original connection popover retains its native behavior and independent
  runtime, preview and listener values. A preview without its local runtime is
  labelled Preview only, not Runtime connected.
- Original preview loading/fallback nodes move into an unscaled workspace host.
  Original reconnect, frame reset and overlay URL ownership remain in `app.js`.
  The host stops wheel/pointerdown propagation, not default behavior, so native
  scrolling and recovery controls work without panning the underlying Canvas.
- Overlay preview is clearly a separate tab, not an embedded-connection repair.
  No configured preview means no unusable overlay link. Link destinations and
  preview capability values are never changed by this adapter.

## Validation boundary

`scripts/test-foundry-readiness-pilot-fixture.mjs` imports the actual readiness
controller and extracts the real connection popover and reconnect bindings.
Reports, recovery transport, navigation and polling clock are synthetic. This
tests local UI behavior, not a running agent, real network recovery, persisted
Apply or verified source result. User visual acceptance, assistive technology,
physical input and real end-to-end recovery remain open.

## Bounded recovery follow-up — EXP-14A/B

Behind the same pilot gate, a main-frame heartbeat timeout reveals the original
fallback without clearing inspected context or saved Review edits. Only validated
same-frame traffic clears heartbeat-owned recovery; it cannot dismiss a separate
saved-preview restoration failure. The additional heartbeat fixture extracts the
real frame and message-validation handlers with local synthetic frames.

Readiness owns one pending recovery transaction across replaced check controls,
polling and close/reopen. Acknowledgement or failure releases current controls;
manual-command guidance never executes a command. No automatic retry is added.

Manual preview reconnect is guarded before any transport side effect while a run
is queued, claimed, applying or rebuilding. Deliberate reconnect during verifying
is allowed to restore the measuring surface, but the separate original temporary
edit replay guard still blocks replay during verification. Neither reconnect nor
transport acknowledgement claims source verification. Gate-off behavior remains
unchanged. Live end-to-end recovery and actual source-work acceptance stay open.
