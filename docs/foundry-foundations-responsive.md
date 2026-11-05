# Responsive Design Lab foundations

SCREEN-13 uses the default Next foundations. Existing shared-sidebar ownership
and the source project are unchanged.

2026-11-02 policy: `foundations=off` restores the previous Next presentation;
`foundations=pilot` remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

## Composition

- The shared 320px desktop sidebar lists real viewport names, widths and current
  status. Custom resizing and temporary stress controls follow in separate groups.
- The gallery keeps actual iframes and the existing All sizes / Selected views.
  Clear name/dimension hierarchy, a single selected border and quiet status text
  replace competing emphasis. No project content is restyled by this adapter.
- Inspection starts with audit status and findings, followed by selected layer
  and frame geometry. Future edit scope sits here, away from temporary tests.
- Geometry comparison explicitly describes before/after measurements from the
  Custom frame, not screenshots or source verification.
- Approved Geist 12px/20px controls, 11px/18px metadata, 32px fields, 6px corners,
  neutral surfaces and Lucide diagrams/disclosures carry the existing direction.

## Ownership

`app.js` owns viewport contexts, frame lifecycle/transport, audit requests,
findings, capture data, stress and scope transactions. `next-responsive-lab.js`
owns original-node composition, fitting, view selection and evidence labels.
`foundry-pilot-responsive.js/css` only refines their presentation.

The pilot reparents original resizing and scope groups, preserving values,
listeners and rollback guards. It does not dispatch commands, write storage,
clone controls, replace iframes or alter intrinsic frame dimensions/transforms.
Only the range's accessible name changes to match its actual viewport/container
function. Decoration is idempotent and retains unchanged disclosures.

## Semantics that must remain distinct

- Sidebar selection changes the inspected Responsive frame. Card Select for an
  authored size also sets the Canvas breakpoint through the existing durable
  action. This migration does not merge those paths or claim equivalence.
- Edit scope affects future Canvas edits through acknowledged transactions and
  rollback. It is not a temporary stress test or source Apply.
- Connected geometry is not audited. Completed measurement is not a passed
  design. Cross-frame findings are heuristic and need rendered-context review.
- Pending, incomplete, disconnected and stale frame labels retain their existing
  model. The sidebar repeats the authoritative rendered frame status rather than
  computing a second status model.
- Captures require a connected Custom frame with selected-layer geometry.
- Hidden preview cards stay mounted offscreen with inert/aria-hidden semantics.
  Audit temporarily reveals and scrolls through all frames, then restores the
  focused view and scroll. Do not substitute display:none or reload the frames.

## Verification boundaries and follow-up

Live browser checks validate real preview layout and non-editing view controls.
An isolated synthetic fixture validates failure/measurement states and retained
control/frame ownership without changing the user's session. Neither is a full
adapter or source Apply certification. User hands-on acceptance remains open.

The pre-existing stale signature covers viewport contexts, selected selector,
stress, resize target and container width; it does not directly encode theme,
state or motion. Complete freshness coverage remains a separate functional audit.
