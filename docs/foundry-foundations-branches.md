# Design Branches foundations

SCREEN-16 uses the default Next foundations. Source-operation ownership is
unchanged by the presentation migration.

2026-11-02 policy: `foundations=off` restores the previous Next presentation;
`foundations=pilot` remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

## Composition

- The existing 320px desktop Directions sidebar and contextual workspace switcher
  remain. Neutral graphite, Geist 12/20 controls, 11/18 metadata and Lucide glyphs
  follow the established foundations; selection has no decorative accent stripe.
- Comparison owns the remaining width. Both existing project-preview frames retain
  their original sizing, transport, readiness, refresh and failure behavior.
- An `Editing:` label distinguishes the active editing direction from the two
  independently selected comparison directions.
- Exact decision choices remain directly below the previews. Conflicting values
  stay mutually exclusive. Combining still creates a new direction, not Review.
- The original active-direction detail node sits inside a persistent native
  disclosure below decisions. Notes, Save/Return/Reject/Archive actions and metrics
  stay app-owned. The original disabled-promotion explanation remains visible
  above the comparison instead of being hidden inside this disclosure.
- Saved decisions remains the existing native disclosure in the sidebar. Import,
  export, restoration eligibility and source-compatibility warnings are preserved.

## Ownership

`next-design-branches.js` retains the original create/name inputs, comparison
selectors, preview frames, detail renderer, promote button and captured note
drafts/caret/scroll. `foundry-pilot-branches.js` only adds presentation wrappers,
reparents the original detail and help nodes, and updates read-only labels.
It adds no network calls, event handlers, eligibility changes or source mutation.

Opening, closing and refreshing the native management disclosure does not change
the active direction. Selecting a comparison option does not activate it; the
original direction list is still the editing-direction control.

Preview readiness remains acknowledgement-based. A saved direction or screenshot
does not prove a rendered preview, verified result or completed source Apply.

The pilot defers observer-triggered fitting to the next animation frame and skips
unchanged scale writes. This avoids changing the observed preview height during
ResizeObserver delivery. Explicit rendering still fits synchronously, using the
original scale calculation. The fallback adapter retains its previous behavior.

## Separate functional follow-ups

- Direction activate/create/combine/restore/promote paths await Canvas switching
  without checking a false `switched` acknowledgement. Comparison iframe previews
  already check it. Improve partial-success reporting separately (EXP-02B).
- Archiving the active direction clears the server active branch but the UI does
  not restore Main on Canvas. Define/test restoration and failure handling
  separately; promotion copy must not imply source Apply (EXP-02C).

Synthetic fixture assertions are not live session acceptance. Actual provider
work, the full preview/Review/Apply journey, physical-device behavior and
publication remain separate gates.
