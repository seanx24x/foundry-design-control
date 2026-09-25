# Foundry Next: State Workbench refinement

Next-only presentation pass. The existing isolated iframe, authored-context application, revision matching and matrix export remain in use. No source, protocol, release or fixture changes.

## Structure

- 300px state/condition rail, flexible live preview, 300px evidence rail.
- Fixed 44px page/panel headers and status footer; 32px state rows and context fields; 16px icons. Shared inspector surfaces and typography.
- Authored states appear first, followed by viewport, project theme and motion controls. No synthetic states were added.
- Main preview fits its available space with 24px padding. Its connection status is explicitly separate from inspection evidence.
- Evidence shows the selected target, result for the exact combination, requested conditions, expandable per-axis method/evidence, and condition coverage.
- Changing the workspace's light/dark theme does not change the product theme.

## Reliability details

- Old measurements are not displayed as evidence for a different state, theme, motion preference, viewport dimensions or selected target.
- Pending, disconnected, failed and untested conditions are separate from inspected conditions. Inspection explicitly is not a full accessibility/visual audit.
- Failure messages clarify that the previous rendered condition may remain visible.
- Failed requests retain their requested context for honest attribution in the UI.
- Authored choices hydrate when the project index arrives after initial page rendering, without replacing the iframe or original select handlers.
- No automatic source changes or retries were introduced. Review edits remain untouched.

## Verification

- Build and inspector syntax/typecheck passed; all 121 inspector tests passed, including eight new State Workbench tests.
- Browser-tested Current and Loading against the actual Morrow preview. Both returned matching context snapshots.
- Authored dark theme applied visibly to the isolated product; mobile viewport returned 390×844 evidence.
- Reduced-motion request returned the real unsupported-emulation message and remained not inspected. This is a browser limitation, not a tested reduced-motion rendering.
- Inline evidence disclosure showed the actual frame method and measured viewport dimensions.
- Verified after reload that Loading, Light/Dark and indexed breakpoints hydrate into the controls.
- Light/dark inspector layouts checked. At 1280×768, columns measured 300/680/300px; at 1920×1080, 300/1320/300px. Fields measured 32px, the footer stayed at the viewport bottom, and no document horizontal overflow was present.
- Existing three Review edits preserved. No Apply/source workflow or file download was exercised. Offline and stale-result behavior were covered by unit tests, not by intentionally disconnecting the user's session.
