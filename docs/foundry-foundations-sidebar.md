# Shared workspace sidebar

Originally introduced as an opt-in pilot on 2026-10-30; approved as the default
Next presentation on 2026-11-02.

`foundations=off` restores the previous Next presentation; `foundations=pilot`
remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

- All 14 workspaces share the 320px desktop sidebar-width token, including
  Components, Design system, Motion, Typography, Recipes, States, Responsive,
  Content stress, Visual agent, Branches, Memory, Delivery and Review.
- Full-height neutral graphite shell; common destination switcher, Geist 12/20,
  Lucide navigation, 32px search fields, readable hover and blue selected states.
- Existing libraries stay in their renderer-owned subtrees. Shared grid
  participation aligns page headers and footers without cloning controls.
- Review uses its real summary as the left contextual panel. Apply, inclusion,
  source safety and return behavior remain on the existing handlers.
- Delivery places its four existing tabs above the dynamic record list, keeping
  the switcher present on History as well. Rendered records never move outside
  `#delivery-content`, so record/tab refreshes do not duplicate old nodes.
- Dynamic reconciliation is idempotent; switchers use delegated event handling.
  A renderer prepending a heading cannot move navigation below the heading.
- Compact layouts retain 200/176px tokens; right rails stack below the editor.
  New studio shells stack at 800px and scroll within the workspace. Canvas and
  Workshop retain their previously validated responsive behavior.

## Verification

- Inspector build and 238 Node tests pass; `git diff --check` passes.
- Live light/dark desktop traversal of all 14 modes: 320px panel, left seam at0,
  no document overflow, one switcher per active panel. Canvas's switcher lives
  outside the mode surface and was checked separately.
- All four Delivery tabs preserve the switcher and footer bottom alignment.
- Live search filtering/restoration and Escape focus return checked in Design system.
- Representative 1024px and390px dark checks cover Design system, Motion,
  States, Delivery and Review. Not exhaustive physical-device/input testing.
- Screenshot review caught and corrected hover contrast, Branches switcher
  ordering and Delivery footer specificity. No source Apply or data writes tested.

Evidence is retained in the task's `product-pilot/shared-sidebar/` folder. This
checks the shared shell, not a comprehensive redesign or functional certification
of each page. Existing project selection and Review0 remained unchanged.
