# Typography Studio foundations

SCREEN-10 uses the default Next foundations. The connected project's source and
shared 320px desktop sidebar remain outside this page-interior migration.
User hands-on review is pending.

2026-11-02 policy: `foundations=off` restores the previous Next presentation;
`foundations=pilot` remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

## Composition and ownership

- The shared contextual sidebar owns desktop width, navigation and compact/stacked
  shell behavior. This adapter does not redefine the workspace grid.
- The font library distinguishes indexed project assets, families used on the page
  and installed fonts that are preview-only. Source tabs and search keep their
  existing actions; icons do not pretend an unloaded family has rendered.
- The center presents either a compact selected-font summary and comparison
  invitation, or the original current/candidate cards. A loaded-face metric is
  reparented into each card's header; its definition-list semantics are preserved.
- Properties contains original computed controls, type health, rhythm/type-scale
  treatments, saved styles and source details. Type health is snapshot diagnostics,
  not a full typography or accessibility audit.
- `app.js` owns actual comparison resources, specimen content, exact face loading,
  measured geometry and shared fitting. `next-typography-studio.js` owns selection,
  readiness, disclosures, scroll, draft restoration and unavailable-control guards.
- `foundry-pilot-typography.js` adds presentation only, after those guards.
  `foundry-pilot-typography.css` is scoped to the Typography pilot interior.

## Readiness and specimen protection

A comparison is ready only when both current and candidate resources exist and
the bridge is connected, with no pending comparison. Pending, offline and failed
states retain specific messages. The existing Next guard removes unmeasured
specimen content and measurement claims before the pilot adapter runs.

The empty state uses only supplied computed size, weight and line-height values;
it is not a fabricated font preview. Measurement rows stay hidden until ready.
Missing selection, no candidate, measuring, offline, unavailable and measured
states remain distinguishable. Face status is not a source-verification claim.

Ready specimens are sanitized DOM produced by the application's existing visible
specimen contract, not recreated text or an independently styled imitation. Keep
the original `.typography-comparison-specimen` nodes, copy, font settings, product
width/height and shared scale transform unchanged. The page CSS may size the
surrounding specimen stage, but must not directly target the specimen or use a
broad descendant font reset that changes it. App-owned fitting uses the same scale
for both specimens. “Product size” describes measured product geometry, not the
fitted card's dimensions.

## Controls, permissions and source safety

The presentation adapter retains original action/input nodes and their attached
handlers. It does not assign values, change disabled states, dispatch events,
register replacement actions, issue requests or write storage. The original
availability and installed-font guards run before refinement. Reparenting must not
drop handlers, duplicate IDs or reset a user's draft.

Local fonts stay preview-only. Selecting the Local tab does not request installed
font access automatically; the user must choose the existing permission action.
The adapter does not call the local-font API, load resources or manufacture a
project mapping. The existing candidate action remains disabled for a local font.

Comparisons and treatments are temporary. The existing “Use this font” action adds
a change to Review; it does not mean the change is already reviewed, approved or
applied. Property edits likewise remain on the existing Review path, with source
updates only after Apply. This migration adds no font staging or Apply command.

Open rhythm, saved-style and source disclosures, scroll position, focused library
family and the style-name draft remain owned by the existing Next adapter across
rerenders. The pilot hook runs before the final scroll/focus restoration.

## Visual contract

Geist 12px/20px controls, 32px editable fields, 6px control radii, tabular
measurements, neutral source tabs and single section boundaries. Font-library rows
use readable source/weight metadata instead of raw indexing jargon. Font usage
lists show distinct, numerically ordered weights and an explicit use count.

The center scroll region is the `type-detail` container. When its available width
is 640px or less, the comparison becomes one column; this responds to the actual
center panel rather than assuming the whole browser width is available. The
computed empty summary follows the same constraint. Shared shell breakpoints and
the 320px desktop sidebar are unchanged.

## Validation checkpoint — 2026-10-30

- All **266 Inspector tests pass**. Eleven new pilot tests cover pure state/metadata
  helpers, original specimen/measurement/control node preservation, permission and
  command boundaries, gate/guard ordering, specimen-safe CSS and responsive/fitting
  ownership. Six existing Next Typography tests also pass in the targeted run.
- At the default **1642×1248 light** browser view, the real Morrow Display → Morrow
  Sans comparison reaches a loaded pair. Both specimens retain contract version 1,
  measure **573×223**, and share **`scale(0.748691)`**.
- Search/clear works. The Local tab keeps its explicit permission action; installed
  font access was not requested.
- Original rhythm, saved-style and source disclosures and a draft style name
  survive Compare again. The temporary style-name draft was restored to empty.
- No font was staged and no source Apply was invoked in these checks.

- Dark 1280×720 and responsive 1280×900, 1000×900 and 390×844 checks confirm equal
  specimen fitting, no horizontal page overflow and stacked comparison at narrow width.
- Gate-off Typography has no pilot marker/interior and retains the original UI.
  No captured browser errors in tested light or dark views. Temporary test tabs
  were closed and the viewport override reset.

User visual acceptance, physical-device input, installed-font permission behavior
and end-to-end edit/Review/Apply verification remain separate. A CSS contract test
or a loaded temporary comparison does not certify those outcomes.

Next: review Typography Studio, then migrate Recipes (SCREEN-11).
