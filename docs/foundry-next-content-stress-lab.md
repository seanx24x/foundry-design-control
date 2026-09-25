# Foundry Next: Content Stress Lab refinement

Findings-first presentation for the isolated Next interface. The adapter's existing profiles, scope, scans, temporary stress, layer selection and correction commands remain authoritative. No fixture, protocol, release or source application changes.

## Structure

- 300px conditions rail, flexible findings list and 300px evidence/correction rail.
- Shared panel surfaces, 44px headers and footer, 32px minimum condition/control rows, 16px icons, 4px radii and 24px section spacing.
- Selection/Canvas scope identifies the test target. Compatible profiles can be combined; product-state choices retain the adapter's exclusive selection behavior.
- Compact condition rows expose the description inline when selected and as a tooltip otherwise.
- One Run/Clear location. Scan current state is separate from applying conditions. View on Canvas opens the actual stressed product rather than an independent simulated preview.
- Findings filter by severity and group by severity or source. Selecting a finding exposes measured evidence, viewport, source when available, and original action buttons in the right panel.
- Corrections say “Preview and add to Review.” Temporary tests remain separate from the Review ledger. Missing source mappings are explicit.

## State and reliability

- Untested summaries use dashes, not reassuring zero counts. Completed scans describe the measured scope and do not claim complete accessibility/design coverage.
- Draft choices are distinguished from applied conditions; changing a draft does not silently run it.
- Commands show a busy state, await acknowledgement and report persistent errors. Failed clears retain choices. Concurrent scan/run/clear requests are guarded.
- Disconnected previews preserve choices and last evidence while disabling live actions. Changed rendered contexts mark retained evidence as a previous scan.
- Selected finding, focus and independent scroll positions survive live data refreshes.
- The underlying Canvas stays measurable but inert and visually hidden while the lab is open, preserving actual layout measurements.

## Verification

- Build, inspector syntax/typecheck, all 140 inspector tests and `git diff --check` passed. Nine new tests cover evidence states, draft comparison, correction wording, retained actions, focus/scroll preservation and layout safeguards.
- Actual Morrow selection scan completed. Canvas scan returned seven findings: three high and four medium. These are test results, not a claim that every finding is a confirmed product defect.
- Long content applied through the acknowledged command. Navigating to Canvas showed the expanded headline. Clearing returned the baseline scan and removed temporary conditions.
- Severity filtering and source grouping exercised. Password reveal showed actual 44×40px evidence, a 44×44px recommendation and direct `style.css:660:20` mapping.
- Loading then Error draft selection retained only Error and preserved focus. These product-state drafts were not applied in this pass.
- Light/dark checked at 1280×768 and 1920×1080. Rails retained 300px widths; footer remained 44px at the viewport bottom; no horizontal document overflow. Compact panels scroll independently.
- No browser console errors observed. Three pre-existing Review changes preserved.
- No correction was staged and no Apply/source workflow was exercised in the user's session. Offline/error handling is covered by tests, not deliberate live-session disconnection. Arbitrary combinations of all 13 conditions were not exhaustively tested.
