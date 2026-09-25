# Foundry Next: Design branches

## Layout

Uses the shared studio typography, surfaces, 300px side panels and compact controls.
The left panel contains directions, creation and collapsible saved decisions. The
center contains comparison selectors, live preview cards and decision composition.
The right panel describes the active editing direction, its counts and notes.

Comparison selection is explicitly separate from activation. Main is shown once
when both comparison selectors refer to Main. The primary action says Move to
Review, not Apply. A persistent footer distinguishes design directions from Git
branches and explains the reviewed source-application boundary.

Long names wrap, direction rows grow to contain them, paired preview cards share
header geometry, and preview scaling responds to the actual available width.
Unsaved notes and caret position survive refreshes. Hidden comparison decisions
are removed from the combine selection.

## Preview integrity

Next comparisons retain frames while their direction content and viewport remain
unchanged. Commands wait for both iframe load and the authenticated adapter state.
Preview ready appears only after branch application and interaction-mode commands
are acknowledged. It indicates command completion, not rebuilt source validation.

Frames participate in liveness pings. Connection/command failure or a project reload
shows an explicit unavailable state, hides unconfirmed pixels and offers the
manual Reload previews action. Leaving Design branches destroys comparison frames
and invalidates their outstanding commands. No automatic retry or source write is
introduced. Existing create, activate, combine, promote and record APIs are unchanged.

## Verification

- Inspector build, syntax/typecheck and git diff whitespace check passed.
- All 158 inspector tests passed, including 10 new branch-specific tests.
- The isolated UI fixture (`node scripts/test-next-branches-fixture.mjs`, port 4689)
  passed nine assertions using the real direction/detail/decision renderers. It
  covers conflict exclusion, note/caret preservation, stale-record restore disabling,
  single-direction deduplication and stale decision selection cleanup.
- Compact light/dark and wide dark synthetic layouts inspected. Long names and
  all three panels fit without horizontal overflow after corrections. The fixture
  intentionally has no live project and stubs icons/custom select enhancement.
- Live Morrow Main preview acknowledged successfully, including explicit reload.
  Leaving the studio removed its preview iframe. Live compact layout inspected with
  actual enhanced selectors and icons; no horizontal overflow in the main panel.
- Existing Main direction and three Review edits preserved. No real branch was
  created, promoted, rejected, archived or composed for testing. Those persistence
  operations were not exercised end to end in this refinement.

Only the isolated Next inspector is changed. No release, Figma, fixture source,
publication or protocol updates.
