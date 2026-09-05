# Component Workshop

Use Component Workshop to inspect a project-native component as a connected system rather than editing isolated screenshots.

## Enter the workshop

1. Open **Components** from the workspace menu, command palette, or Components tab in Structure.
2. Choose an indexed component. Prefer one with a live instance on the current canvas.
3. Select the exact live instance before changing a visual property.
4. Use the state controls to preview default, hover, focus, pressed, disabled, loading, empty, and error behavior.
5. Use variants only when the project design graph provides variant properties. Storybook stories are indexed as variant properties.

State previews are presentation state. They must never create a design change or enter the review ledger. Return to Default before measuring or applying unrelated changes.

## Choose scope safely

- **Instance** changes the selected rendered instance and is available when that instance is live.
- **Variant** changes the selected mapped variant definition. Keep it disabled until the variant has an exact source reference.
- **Component** changes the component source for every instance. Keep it disabled until the component itself has an exact source reference.

Do not promote an instance edit to variant or component scope by inference. If the source target is missing or ambiguous, preserve the preview and ask the user to resolve the mapping.

## Review and verify

1. Review each recorded change with its component, selected variant, scope, viewport, theme, and state context.
2. Apply the narrowest source edit that satisfies the reviewed scope.
3. Rebuild and verify the selected state at its native artboard dimensions.
4. For variant scope, verify every rendered instance of the selected variant that is available in the session.
5. For component scope, verify every rendered instance of that component that is available in the session.
6. Keep unavailable combinations explicit. Never claim coverage for a state, theme, or viewport that was not rendered and measured.
