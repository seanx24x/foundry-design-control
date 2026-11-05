# Shared overlays — workspace foundations

SCREEN-19 uses the default Next foundations. Original action handlers remain
authoritative. Connection/first-edit body content remains SCREEN-20.

2026-11-02 policy: `foundations=off` restores the previous Next presentation;
`foundations=pilot` remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

## Ownership

- `app.js` still owns the command list, filtering, mode changes, native dialog
  opening/closing and milestone POST. Original result buttons and listeners are
  retained. The adapter adds a name, result count, current-workspace annotation,
  empty state, keyboard guidance and guarded navigation on those same buttons.
- Search keeps a stable position when the result set changes. Arrow keys move
  actual button focus; Enter in search invokes the first existing button. Home
  and End operate only in results, preserving input editing. Modifier and IME
  events are ignored. Native Tab, Escape, `showModal()` and background inertness
  are retained; no parallel focus trap is installed.
- Closing a palette restores a connected, visible, focusable opener, otherwise
  the workspace menu. The milestone dialog restores the current create button
  even when a successful render replaced the original opener.
- The feedback adapter preserves the caller's literal message. It never guesses
  success, verification or error classifications from text. Ordinary feedback
  remains for 6–12 seconds, pauses on hover/focus and has an explicit dismiss
  button. Hidden feedback cannot receive focus.
- Feedback issued while a supported native dialog is open moves inside its top
  layer and remains until dismissed, replaced or the dialog closes. An error
  must not disappear behind the modal. The existing milestone input/draft and
  save payload stay owned by the original form and transaction handler.
- Explicit body-level selectors cover only command, milestone and readiness
  dialogs. Inspector picker portals are not restyled by generic dialog rules.
  Readiness polling, workflow and recovery ownership remain untouched.

## Deferred behavior and acceptance

The existing duplicate milestone-submit pending guard is tracked separately as
EXP-13B. Synthetic fixture save success/failure proves local UI behavior, not a
real persisted milestone, source Apply or verified handoff. Physical keyboard,
screen-reader announcements, mobile virtual-keyboard and final user acceptance
remain separate gates. In-app-browser native reverse Tab can leave web content
for browser chrome; the page's underlying controls must remain inert.

Use `scripts/test-foundry-overlays-pilot-fixture.mjs` for isolated browser checks.
Its session/navigation/transport are synthetic; actual command and milestone
handlers are extracted from the current source. Do not use the live session to
create test milestones or manufacture success evidence.
