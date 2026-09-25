# Motion Studio refinement

Scope: the opt-in Next workspace. No release assets, fixture source or protocol changes.

## Layout

- 300px motion library, flexible central workspace and 300px Properties rail.
- 44px fixed headers and footer, 32px library rows, 16px icons, 32px property fields.
- Shared light/dark panel surfaces and 24px central insets, including compensation for the scroll gutter.
- Center: timeline and playback, easing graph, supported transform path and synchronized before/after path diagrams. These diagrams are not rendered product previews; View on Canvas and Preview on Canvas remain explicit actions.
- Right: timing, selected keyframe, motion health and expandable source details. Unsupported paths use an explanatory disclosure rather than occupying the main workspace.
- Below 1100px, Properties stacks below the center. Below 700px, the library also stacks. These smaller breakpoints are implemented; the verified compact viewport is 1280×768.

## Behavior

The presentation moves existing DOM nodes after their motion handlers are attached, preserving the acknowledged playback and reviewable editing paths. It sends no source commands itself. Inputs and open choosers are not replaced during editing. Scroll and source-disclosure states survive ordinary rerenders.

Search filters detected motions on the selected layer, including source-kind metadata; it does not claim to be a project-wide animation catalog. No-results recovery clears the filter without changing the selection.

Offline, missing and inactive motion are distinct states with explanations. Native fields and SVG handles are unavailable when playback/editing is unavailable. A local easing illustration can still play without editing the product. Reduced-motion detection is labelled as a heuristic, not accessibility certification.

Playback, looping and keyframe selection do not add review changes. Timing, curve and path edits retain their existing Review/Apply boundary.

## Verification

- Inspector build and 99 inspector tests passed, including six focused tests for motion availability, search, handler preservation, unavailable SVG controls, layout contracts and integration ordering.
- Browser checks used Morrow's actual `note-arrive` animation and an inactive button transition.
- Verified search and empty recovery, local easing preview, replay, pause, loop on/off, opacity keyframe selection and retained source disclosure state.
- Desktop light/dark and 1280×768 checks found no horizontal page overflow. The compact layout retained 300px rails, 44px footer and equal 24px central insets.
- The existing Review item remained unchanged. No curve, timing, path or source edits were staged/applied during testing. Offline behavior is covered by model and control-boundary tests, not a live network-disconnection test.

This is scoped UI verification, not release certification or a full motion-engine test run.
