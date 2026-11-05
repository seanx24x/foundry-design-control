# Recipes foundations

SCREEN-11 uses the default Next foundations. The connected project's source is
unchanged. Shared sidebar/chrome ownership remains outside this body migration.
User hands-on review is pending.

2026-11-02 policy: `foundations=off` restores the previous Next presentation;
`foundations=pilot` remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

## Composition and ownership

- The shared contextual sidebar owns its 320px desktop width, destination
  switcher and compact/stacked shell. Recipe rows retain real names and intent;
  icons are navigation aids, not fabricated visual previews.
- The center prioritizes treatment intent, destination mapping and suggested
  targets. Concrete property counts replace any implied compatibility score.
  Current values, mapped values, token-choice warnings and excluded saved values
  remain distinguishable before the existing Add to Review action.
- Capture groups the selected-layer context and eligibility guidance, followed
  by the original Name/Intent form and Selected recipe disclosure/actions.
- An empty library explains Capture → Map → Review and retains the existing
  Canvas action. It does not create sample recipes or imply a live treatment.
- `app.js` owns recipe data, assessment, selection, capture and all commands.
  `next-recipes.js` owns the presentation structure, original controls, connected
  and capture guards, delete confirmation, focus and per-recipe scroll restoration.
- `foundry-pilot-recipes.js` refines presentation after those guards. Its CSS is
  scoped to the Recipes pilot interior. It adds no network or storage dependency.

## Mapping and evidence semantics

The original assessment remains authoritative. Supported counts do not establish
source mapping, visual verification or compatibility beyond the supplied property
assessment. Suggested targets are component/element-kind heuristics; selecting
one requests its actual mapping. They are not preverified destinations.

Unsupported property rows retain the saved value, but label it **Saved value ·
excluded** and retain the Unsupported status. The adapter does not hide these
properties or make them resemble values that will enter Review. Ambiguous token
choices retain the existing warning and require human review. A token reference
does not need a second identical token-name line, but its status stays visible.

Offline mapping is labeled as last inspected, not fresh. Empty library, filtered
library, no selected target, unavailable assessment, partial/ambiguous assessment
and supported assessment are separate presentation states. Original controls
remain unavailable when the bridge or required assessment is absent.

## Control and source safety

The pilot adapter retains the persistent selection panel, capture form, Name and
Intent inputs, Selected recipe disclosure and Duplicate button. It reparents the
original current-value node and leaves saved-value and action nodes intact. It
does not clone controls, assign input values, set disabled/open state, dispatch
events, replace handlers, write storage or issue command requests.

The existing **Add to Review** action stages mapped preview values; it is not a
separate transient preview button and is not source Apply. Unsupported properties
are excluded by the underlying operation; ambiguous shown token choices still
need human Review. Source changes happen only after the separate reviewed Apply
workflow. The pilot neither adds an Apply command nor manufactures verification.

Original capture eligibility, offline guards, import/export and duplicate behavior
remain owned by the app. The original delete-confirmation gate remains before the
original remove handler. Cosmetic refinement must not bypass that confirmation.

## Visual contract

Approved Geist 12px/20px controls, 11px supporting metadata, Lucide iconography,
32px fields, 6px control corners, neutral surfaces and restrained cobalt selection.
Single section boundaries replace competing nested separators. Field boundaries
are quiet until hover/focus; keyboard focus uses the shared token contract.

The center scroll region is the named `recipe-detail` container. At 600px or less,
mapping rows stack the property heading above current and recipe values, with
explicit inline labels. The empty-state flow also becomes one column. Responsive
behavior follows actual center-panel width rather than assuming browser width is
available; the shared sidebar remains responsible for page and rail stacking.

## Validation checkpoint — 2026-10-30

- **275 Inspector tests pass**, including nine new pilot tests and seven existing
  Next Recipes tests. They cover presentation states, property/value labels,
  original-node and draft preservation, command boundaries, late pilot guards,
  scoped responsive CSS and icon assets.
- Live checks preserve the empty recipe library and confirm the 320px sidebar,
  Save disabled for an unedited selected layer, and unsaved Name/Intent drafts
  surviving search rerenders. Temporary drafts were restored to empty.
- `scripts/test-foundry-recipes-pilot-fixture.mjs` extracts actual Recipes markup
  and the app renderer. Synthetic mapped/ambiguous/unsupported data and stubbed
  command transports exercise populated states without a Foundry session, adapter
  or source connection. **20 isolated assertions pass in light and dark**.
- The same fixture with the pilot gate off passes 19 assertions and has no pilot
  marker/interior, retaining the then-default UI.
- At 1440×1000, the sidebar is 320px and center scroll width 805px; at 1000×900,
  the compact sidebar is 200px and center scroll width 785px. Neither view has
  horizontal page overflow.
- At 390×844, the 360px center uses a property heading above three columns for
  current value, direction and saved/mapped value. The desktop table header is
  hidden, inline labels remain visible, no horizontal overflow occurs and the
  48px footer fits.
- No live recipe was saved, imported, duplicated, deleted or added to Review.
  No source Apply was invoked; live Review remained at 2.

User visual acceptance, actual-device input, live capture/reuse transactions and
end-to-end Review/Apply verification remain separate. Populated visual evidence
is explicitly synthetic; fixture assertions and presentation tests do not certify
those outcomes.

Next: review Recipes, then migrate State Workbench (SCREEN-12).
