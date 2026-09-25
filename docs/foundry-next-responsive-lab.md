# Foundry Next: Responsive Design Lab refinement

Next-only studio refinement. Existing frame transport, authored breakpoints, stress commands, edit-scope transaction, comparison capture and Review workflow remain in use. No fixture, source application, protocol, release or publication changes.

## Structure

- A 300px sizes/conditions rail, flexible live-preview gallery and 300px inspection rail.
- Shared panel surfaces, 44px headers/footer, 32px frame rows and controls, 24px section/gallery spacing and 4px control/card radii.
- Left: actual configured frames, custom viewport/container resizing, stress conditions, edit scope and inline authored boundaries.
- Center: All sizes or Selected view. Cards fit their available space without changing their actual viewport dimensions or reloading their iframes. Gallery rows retain their intrinsic height rather than overlapping at compact widths.
- Right: selected layer, active frame connection and geometry, audit evidence, expandable cross-frame findings and before/after capture. Capture explicitly identifies the Custom frame as its measurement source.
- Fixed footer keeps connection/scope or audit status and Review access visible. Panels scroll independently.

## Evidence and reliability

- Connected geometry is explicitly not an audit. Measured findings do not imply a passing layout.
- Context changes mark previous audit evidence stale. Missing, timed-out and disconnected results remain explicit. Cross-frame findings are identified as heuristic.
- All-breakpoint scope requires a connected, source-mapped selection. Capture requires a connected Custom frame with a selected target.
- Responsive initialization waits for both iframe load and the adapter handshake. Discarded-frame replies cannot overwrite a replacement frame's state. Authored-state reloads clear the old handshake markers.
- Next audits measure frames sequentially and bring each into view, preventing browser animation-frame throttling of offscreen frames. The requested gallery view and scroll position are restored afterward. Legacy audit concurrency remains unchanged.
- Iframe decoration uses an outline, not an internal border, so declared and measured viewport widths match.
- No source writes or automatic retries were introduced.

## Verification

- Inspector build, syntax/typecheck and all 131 inspector tests passed, including ten new Responsive Lab tests.
- Actual Morrow frames connected after reload: Mobile, Tablet, Custom, Desktop and Current.
- Audited from Selected view at 1280×768: all five frames measured, zero incomplete; Selected view and scroll position restored. The run reported 56 frame findings and 101 heuristic cross-frame findings. These counts are evidence of an executed audit, not a claim that Morrow has no issues or that every heuristic is a confirmed defect.
- Before/after capture exercised with custom viewport resizing. The border correction was separately verified by a capture reporting exactly 1280px.
- Text stress and clearing stress were exercised; changing conditions marked earlier audits stale. Arbitrary stress combinations and container-query behavior were not exhaustively tested.
- Light/dark layouts inspected at 1280×768 and 1920×1080. Rails retained 300px widths, footer stayed 44px at the viewport bottom, and document horizontal overflow was absent. Product theme remained independent.
- Existing three Review edits preserved. No Apply/source workflow exercised. Failure/staleness labels covered by tests; the user's live connection was not deliberately disconnected.
