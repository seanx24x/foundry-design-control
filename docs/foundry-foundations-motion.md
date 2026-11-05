# Motion Studio foundations

Enabled by default in the Next UI. The inspected project's source stays outside
this presentation migration.

2026-11-02 policy: `foundations=off` restores the previous Next presentation;
`foundations=pilot` remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

## Composition and ownership

- The shared sidebar owns the 320px desktop rail and compact/stacked shell.
- The main instrument reads Timeline → Easing → Motion path → Before/after paths.
- The Properties rail contains timing, selected keyframe, motion health and source.
- Original playback, keyframe, easing, path, select and Review nodes retain their
  existing handlers. The presentation adapter issues no commands or storage writes.
- Availability still disables unavailable native fields and SVG handles. It does
  not turn stale/disconnected motion into editable evidence.
- Selection, search, focus, scroll and source disclosure restoration stay with the
  existing Next adapter. The pilot hook runs after availability guards.

## Evidence and interaction

The easing preview is a local illustration. The comparison is synchronized path
diagrams, not a rebuilt product preview or verification. Preview on Canvas retains
the real product-playback action. Motion health remains a heuristic requiring
reduced-motion testing. Properties report current values, not guaranteed authored
source values. Source Apply is not invoked by this adapter.

Editable SVGs must preserve their native width/height ratios: existing pointer
handlers map the bounding rectangle to a 240×156 curve or 480×260 path. Independent
fixed width/height can introduce letterboxing and make dragging jump. Width caps
plus `height:auto` preserve that contract. Do not insert an `output` before the
timeline readout; its existing scrub handler selects the first stage output.

## Visual contract

Geist 12px/20px controls, 32px fields, 6px radii, tabular measurements, Lucide
chrome and single section boundaries. At narrow center widths, graphs stack over
two-column coordinates; the comparison controls wrap independently. Playback
controls keep 16px vertical padding above the diagnostics separator.

Automated tests cover explicit activation, retained nodes, state/evidence labels,
empty states, command-free presentation, responsive fields and graph geometry.
Browser checks do not replace actual-device input or a full edit/Review/Apply run.
