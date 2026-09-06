# Responsive Design Lab

Use Responsive Design Lab when a change must remain correct across real running viewport contexts.

## Inspect across native viewports

1. Select the target once on the Canvas, then open **Responsive design lab** from the workspace menu or command palette.
2. Treat each iframe's declared width and height as the browser viewport. Foundry may scale the outer frame for presentation, but must never resize the document to fit the workspace.
3. Check the linked selection in every configured breakpoint and the session's recorded Current viewport.
4. Keep **Viewport** selected to scrub the browser viewport through indexed media-query boundaries.
5. Switch to **Container** to resize the nearest authored query container around the selected element without changing the iframe viewport. Indexed `@container` conditions remain visible as exact, source-linked boundary shortcuts.
6. Capture **Before** and **After** at meaningful widths. Foundry freezes viewport, container, selected-element, wrapping, and overflow measurements while the live preview remains free to move.
7. Treat horizontal overflow, clipping, awkward wrapping, and large geometry jumps as findings. Do not enlarge a viewport from `scrollWidth` to conceal overflow.

Container and comparison previews are presentation state. They must not create design changes, alter source, or disguise the viewport used by screenshots and verification. Clearing the preview restores the container's exact prior inline styles.

## Use stress tests safely

Browser zoom, text scale, and long-content modes are temporary presentation tests. They must not record changes, alter product source, or persist after the preview frame closes. Use them to expose brittle layout behavior, then clear the stress mode before final measurement.

## Choose responsive scope

- **This breakpoint** records the current configured breakpoint as the change context.
- **All breakpoints** is an explicit promotion. Keep it unavailable until the selected target has exact source mapping.

Never infer a global responsive edit from a successful local preview. If a custom-width failure does not map to a configured breakpoint or source boundary, preserve the evidence and ask the user to choose the intended source scope.

## Verify after apply

1. Rebuild the real application.
2. Reopen the linked selection at every approved viewport using native iframe dimensions.
3. Compare the captured before and after measurements in the failing viewport or container context.
4. Confirm the original passing contexts remain stable.
5. Report unsupported, cross-origin, or unavailable contexts explicitly rather than substituting the current viewport.
