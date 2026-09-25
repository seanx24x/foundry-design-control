# Design Memory refinement

Scope: opt-in `ui=next` inspector only. Existing memory commands, protocol and adapter persistence remain unchanged. No fixture source edits or release changes.

## Structure

- 44px studio header and footer; shared panel surface.
- 300px project library, fluid decision detail and 300px capture rail at desktop sizes.
- Search and outcome filters stay above the independently scrolling decision list.
- Reading order: decision and status, current-selection relevance, labelled saved scope, explicit rules, evidence/source and optional inline corrections.
- Saved scope includes every supplied condition, rather than six unlabelled tags. Context-match percentages are not confidence or quality scores.
- Capture keeps the selection/source distinct from the saved decision being inspected. Outcome guidance explains Approved, Rejected and Rule. Title and guidance are required; reasoning is optional.
- 32px fields/actions, 24px compact header actions, 16px icons, 4px radii and grid-based spacing. Long source paths and rule values wrap; intentional library-row truncation preserves the full title tooltip.
- Capture fields scroll independently; Save stays visible. At narrow widths the rails stack rather than clip the reading pane.

## Interaction boundaries

- Selecting or searching library entries never applies source changes.
- Corrections are collapsed until requested. Dirty correction text, disclosure, focus/caret and detail scroll survive workspace updates. Drafts stay associated with the selected decision when switching entries; they are not persisted across a full page reload.
- Empty/invalid capture and blank corrections cannot save. Offline preview disables persistence actions and explains recovery without clearing entered text.
- Capture waits for the existing acknowledged command. Duplicate pending captures are blocked. Failure preserves inputs and displays recovery text; success only clears fields whose contents still match the submitted values.
- Import/export remain the existing portable JSON workflow. Export is unavailable for an empty library.
- Guidance is project memory, not applied CSS. Product source still requires reviewed Apply.

## Verification

- `apps/inspector/test/next-design-memory.test.js`: capture prerequisites, pending state, scope completeness, correction identity, integration, connection transitions and layout contracts.
- `scripts/test-next-memory-fixture.mjs`: extracted production renderer and event handlers, synthetic records and mocked command acknowledgements. 23 browser assertions cover populated/disabled records, full scope, correction/caret preservation, filtering, offline recovery, duplicate capture, failed capture and acknowledgement during newer typing.
- The fixture has no real Foundry session and does not test persistence end to end. It intentionally does not write example decisions into the user's library.
- Live session verification checks the real empty-library page and preserves its existing three Review changes.

Run the isolated browser fixture on `http://127.0.0.1:4689/` after an inspector build; `?theme=dark` selects dark styling. Stop the fixture after verification. Never run the workspace-reset test against the recording session.
