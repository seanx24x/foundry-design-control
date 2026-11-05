# Inspector controls — 2026-11-04 refinement

## Scope and ownership

User-approved follow-up to beta.24: quieter accepted-change feedback, consistent
dropdowns, and content-aware Inspector spacing. Work is isolated on
`feat/inspector-control-refinement`, based on merged beta.24 (`c21a5e3`). No npm
publication, Git push, website change or live-session manipulation is included.

Retain Geist 12px/20px controls, neutral light/dark materials, current rail widths,
32px fields, 8px field gaps and the existing editing/Review/source boundaries.

## Changes

- Accepted fields show their current value and an inline Restore action. Raw CSS
  before/after strings and repeated saved paragraphs no longer expand every row.
  Exact data stays in the existing Review ledger. Multi-selection keeps its
  original Undo semantics rather than offering an unsafe single-value restore.
- One screen-reader status announces preview/save feedback. Errors remain visible
  and retain the entered candidate. A short persistent source-unchanged notice
  remains visible; detailed editing/media instructions use an Editing help disclosure.
- Text, authored options and compound CSS values receive a full Inspector row.
  Small numeric pairs stay compact; long deliberate numeric values also get space.
  Layout policy is pure and does not normalize or write inspected project values.
- The compact Canvas zoom chooser reserves enough room for percentages; its
  chevron/padding no longer clips the default 100% value. Dedicated theme/width
  checks include that label, not just the containing panel's scroll width.
- The existing select owner now enhances dynamically rendered controls through
  the shared render hook, not only initial markup. Native values, options and
  original change handlers stay authoritative. The native fallback is retained.
- Menus use neutral selected rows, consistent Geist/spacing/icons, wrapped option
  labels, bounded viewport placement and native-dialog top-layer containment.
  Non-actionable empty placeholders are not repeated as menu choices. Disabled
  options and disabled optgroups remain unavailable.
- Same-selection refreshes defer while an Inspector menu is open. Focus returns
  to the visible chooser, including variant cancellation and failed-field Escape.
  In-place option/disabled/error changes synchronize with the shared trigger.
  Programmatic variant measurements explicitly synchronize visible labels without
  dispatching an edit or change event. Typeahead cleanup cannot affect a later menu.

Review, acknowledgement, mapping, source Apply, rebuild and verification owners
are unchanged. This UI pass does not prove a new source Apply run.

## Verification

```sh
pnpm build
pnpm test
pnpm -r --if-present typecheck
pnpm test:inspector:controls
FOUNDRY_TEST_RUNTIME_URL=http://127.0.0.1:5587 \
FOUNDRY_TEST_PREVIEW_URL=http://127.0.0.1:5590 \
node scripts/test-next-workspace.mjs
```

The dedicated control fixture uses the real renderer, stylesheet order, icon
artwork and extracted shared select handlers with synthetic in-memory edit
acknowledgements. It is not a connected project or provider. It covers light/dark
at 1440, 1024, 720, 390 and 320px, including 720×500 CSS reflow (200%-equivalent,
not physical-browser zoom proof), changed gradients/compound values, errors,
multi-selection, keyboard focus, viewport edges, disabled options and native modals.

The real-workspace script uses the actual CLI/adapter and a disposable Morrow
copy. Its chooser tests now operate the visible menu instead of the hidden
native select, and its geometry assertions expect full-width media rows.
Cancellation/Undo tests wait for the visible Inspector handoff, not only the
earlier adapter acknowledgement. The pointer-loss test captures the actual
document pointer event, rather than attaching to an idle handle that a snapshot
can replace before the gesture begins. No timeouts or release gates were relaxed.

Current evidence is local and ignored under `artifacts/inspector-controls` and
`artifacts/next-workspace`. Physical-device and screen-reader acceptance remain
separate from automated browser checks. A private, task-owned isolated control
preview may be run with:

```sh
FOUNDRY_CONTROL_FIXTURE_PORT=4840 node scripts/test-inspector-control-refinement.mjs --serve
```

This fixture does not load a real session or write project source. Its in-memory
candidate acknowledgements must never be represented as source verification.

## Completed evidence — 4 November baseline

- Full build and workspace type checks pass. All 935 workspace tests pass,
  including 559 Inspector tests and the new content-aware layout cases.
- The real CLI/adapter/workspace regression passes all 114 checks. This includes
  authored variant previews/acceptance/undo, exact section restores and failure
  recovery, linked/multi-selection edits, media controls, both themes, layout,
  offline and disconnected candidates. No source files change in that workflow.
- Dedicated controls: all four groups and ten theme/viewport views pass, with no
  browser exceptions. Rendered screenshots were inspected, including the original
  gradient, authored-choice and object-position cases.
- The actual private HTTPS fixture passes in light/dark with working edits,
  Restore and custom menus. Its service and route are task-owned; earlier previews
  and active product sessions were not reused or changed.
- Formatting and `git diff --check` pass. Changes remain local and unpublished;
  no release bump, package publication, Git push or website/film update occurred.

## 5 November — row packing, anchored menus and spatial position

User follow-up: fill singleton rows, make every Inspector dropdown match its full
input, improve Object position, and review every Scaena Fork example.

- Consecutive compact fields pack in pairs. An unpaired compact field spans its
  whole row, including when followed by a full-width control. This applies inside
  linked and advanced groups too; hidden groups do not write project values.
- Inspector menu geometry now uses the entire `.next-field`, not the trailing
  value button. Other workspace menus retain their own anchors. The same viewport,
  modal containment, disabled-option and keyboard rules remain authoritative.
- Object position has a compact X/Y summary rather than an undifferentiated CSS
  string. Its editor includes nine spatial presets, exact percentage fields,
  direct pad manipulation with grab offset, Shift axis lock and keyboard nudges.
  Gestures are preview-only. Use position accepts one property change through the
  existing Review/direction pipeline; cancel restores the original.
- Exact native CSS remains available. Keywords, edge offsets, expressions,
  positions outside the pad and mixed values are not guessed or silently mapped
  to 50/50. Opening the editor does not send a preview. A deliberate preset is an
  explicit percentage replacement. Main-row numbers are display-rounded only;
  the editor retains full authored precision.
- Escape/lost capture restore the gesture's starting draft. Dialog cancellation
  waits for pending preview acknowledgement before cancelling. Disconnection
  retains the candidate and cannot enable Use as a false success.
- The pad and its positioned dialog explicitly opt out of geometry transitions.
  This also avoids a global reduced-motion duration fallback briefly delaying
  the point's visual/hit-target position while its numeric state already changed.
- The outer grid uses a shrinkable single column. Compact status text may
  truncate with its accessible label intact so it cannot clip the workspace menu
  at 320px. Lone fields retain the approved 32px height and 12px/20px type.

All 17 live reference scenes and their adaptation decisions are recorded in
[`scaena-fork-audit-2026-11-05.md`](./scaena-fork-audit-2026-11-05.md).
This is not a claim that every reference feature is implemented.

Verification for this follow-up:

- Full build and workspace type checks pass; all **939 workspace tests** pass
  (563 Inspector). Pure tests cover singleton packing, exact percentage parsing,
  native CSS preservation, direct pointer geometry and grab offsets.
- Real CLI/adapter regression: **114 checks pass**, now using the spatial editor
  and exact CSS fallback for image/video tests. Spatial anchor/keyboard previews
  affect the real rendered image, leave Review unchanged until acceptance, and
  cancel/Undo restore exact original styles. Disposable project source stays unchanged.
- The isolated control fixture checks both themes at 1440/1024/720/390/320px,
  full-width Fit and authored menus, singleton and paired geometry, unclipped
  compound values, modal bounds, focus, errors, mixed values and disabled choices.
  Gesture checks cover normal and reduced motion, precision, axis lock, grab
  offset, Escape and lost capture. Screenshots and reports stay under ignored
  `artifacts/inspector-controls`.
- The same private HTTPS fixture at port 8460 serves this build. Light/dark
  controls were inspected in the browser. It remains a synthetic, no-project
  fixture; it is not a source Apply or agent-verification claim.

No Git push, npm publication, website or approved animation changes occurred.
Physical-device and screen-reader acceptance remain separate from browser checks.
