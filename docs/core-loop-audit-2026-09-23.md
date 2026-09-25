# Foundry Next: guided core-loop audit

## Isolated setup

- Disposable Morrow project: `/tmp/foundry-core-audit.Y1lb9Z/morrow`.
- Baseline source commit: `1fab254c582313aa0eb49ea4dc1e6a68f7836130`.
- Inspector runtime: `http://127.0.0.1:4387`, using the current local inspector build with `ui=next`.
- Product preview: `http://127.0.0.1:4690`, serving the disposable project's `dist`.
- Session: `ses_f7430b6c6b874e39af9049e34347fb13`. Credentials omitted deliberately.
- Existing recording workspace on ports 4587/4590 was not restarted, reset, or edited.
- Current original-tab Review count observed read-only: 2. An earlier conversation reported 3; no original-ledger mutations were performed during this setup.

## Checks

| Check                                | Status                                         | Evidence                                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disposable source baseline and build | Passed                                         | Clean git status; six source-identical output files; 13 validated annotations                                                                                                               |
| Fixture non-browser assertions       | Passed                                         | Seven assertions passed                                                                                                                                                                     |
| Fixture browser smoke test           | Blocked                                        | Harness could not bind a localhost listener in sandbox; not a passing browser test                                                                                                          |
| Live isolated browser connection     | Passed                                         | Live status, 84 Layers entries, Review 0, empty inspector selection                                                                                                                         |
| Project design graph                 | Passed                                         | MCP read returned disposable project root and baseline revision; 51 tokens and 1 authored component                                                                                         |
| Apply listener                       | Passed after exact approval                    | User explicitly approved 76px to 80px in the disposable project, then queued Apply in Review; MCP claimed the frozen batch normally                                                         |
| Select headline on Canvas            | User-confirmed pass                            | Selection outline, matching Layers row and contextual typography controls                                                                                                                   |
| Preview typography and Escape        | User-confirmed pass                            | Original value/appearance restored; Review 0                                                                                                                                                |
| Accept typography and undo           | User-confirmed pass with latency issue         | Appearance restored; user reports Review count took about a second to return to 0; latency investigation pending                                                                            |
| Typography Studio round trip         | User-confirmed pass                            | Selection, larger type and Review 1 survived round trip                                                                                                                                     |
| Compare and Review                   | User-confirmed pass                            | User confirmed before/after and correct single change; MCP independently confirms approved 76px to 80px fontSize change on story-title                                                      |
| Apply source change                  | Passed                                         | Only index.html:43 changed: headline instance style font-size: 80px. Source delta acknowledged against claim baseline; build, 13 annotations, seven non-browser tests and diff check passed |
| Reload verification                  | Passed for reviewed context                    | Foundry browser-origin verification measured 80px after source reload at 1440 x 900; nonzero geometry 573.016 x 235.195; run passed                                                         |
| Delivery record                      | Data verified; user-facing walkthrough pending | Record delivery_265f8a1fea1217faadc3 is verified, acceptance criterion passed, no blockers or capture issues                                                                                |

## Setup observations

The first setup command wrote local integration files but could not update the machine-level companion registry in the sandbox. A subsequent setup attempt preserved the fixture-specific configuration after its authored component/state configuration had been added. The existing configuration and CLI start worked; a completely clean installation audit is not claimed.

The test session is left open for the user's step-by-step walkthrough. The user staged and explicitly authorized a single instance-scoped headline font-size change from 76px to 80px, change ID `chg_39ea93e04d3846a5bc2202ab3d7cc73f`, with selected mapping `map-story-title-fontSize`, source `index.html:43:12`, current breakpoint/theme/state.

Run `run_445cdfe2189847449e5e3598a16e5c24` completed as passed on 2026-09-24 at 04:42:43 UTC, first attempt, with one browser-origin verification. Applied source revision: `1fab254c582313aa0eb49ea4dc1e6a68f7836130-dirty-6901e49ac614`. The only source edit is an inline font-size on the mapped headline instance; no shared tokens or other elements were edited. Smaller viewport behavior has not been validated and the inline size overrides the existing responsive font-size rules for this instance; do not treat this desktop test as responsive coverage.

Earlier tool safety rejections were resolved through explicit user approval, not a bypass. The ~1 second Undo/Review count delay remains an open UX finding. No changes were made to the original recording project.

## Content stress lab: visible preview follow-up

The user reached the temporary-conditions confirmation but could not see the stressed UI inside the lab. The Next lab now places a live preview above Findings, names the tested target and active conditions, and keeps Restore original beside the preview. Selection and Viewport framing use the existing live Canvas iframe without moving or reloading it. An offscreen single selection is revealed through the existing acknowledged selection command; multi-selections are not replaced. Preview framing does not change the tested viewport dimensions or Canvas zoom.

Verified in the disposable browser session:

- Long content visibly expanded the selected Create workspace button in the lab.
- Temporary text survived the Canvas-to-lab round trip.
- Restore original returned the original text and cleared the condition.
- Review remained at 1 throughout; this pre-existing pending change was not cleared or modified.
- Light and dark layouts inspected at desktop and 1280 x 768. At 1000 x 768, corrected legacy one-column CSS interference and center/evidence row overlap; measured the restored 240px conditions column and non-overlapping evidence placement.
- Build, inspector syntax/typecheck, all 187 inspector tests and git diff whitespace validation passed. Tests include viewport-fit geometry, selection framing, iframe reuse and the original restoration action.

Scope: this validates the long-content selection flow, not every stress profile, correction, disconnected-runtime recovery or a complete accessibility audit. No source Apply, recording-project edit or publication was performed. The frontend-design guidance was used to retain the established spacing, type and state tokens rather than introduce a separate visual system.

## Visual Agent: connection preflight

The advice-only request completed after Codex explicitly claimed it: Response complete, zero proposals, Review still 1. Before that claim, the user had seen only a waiting-for-listener state. The composer now shows agent availability before submission, explains that queuing does not start an agent, and includes inline reconnection instructions. Live-preview disconnection is a separate blocking state; absent agent presence still permits durable queuing.

Presence-only UI updates now run before deferred session rendering, so the notice and send label remain current while the user types without rebuilding the composer. Browser verification observed No agent listening changing to Agent listener connected and Queue for agent changing to Ask visual agent while an unsent draft retained its value, focus and caret. Presence subsequently expired back to the waiting state. The test draft was removed without submitting another request. Light/dark and 1280 x 768 layout checks passed, with no horizontal overflow or browser errors. Build, syntax/typecheck, all 190 inspector tests and whitespace validation passed. Runtime-offline copy is unit-tested; no runtime outage was induced in the user's session.

## Visual Agent: preview navigation and cancellation (September 24)

The old disposable directory was unavailable, so subsequent testing uses `/tmp/foundry-visual-audit.rbfM1b/morrow`, session `ses_80e51a71325e4bd0bb98870139fa61de`. This is a new baseline with Review 0, not continuation of the earlier applied headline or pending variant ledger. Credentials are omitted.

The user reported that Preview direction left the conversation visible. The adapter had applied 14px correctly; the inspector handler did not navigate. Preview now waits for the adapter and saved acknowledgement before opening Canvas, fitting the viewport and revealing the proposal target. The existing floating summary bar becomes a temporary-preview bar with Back to conversation and Cancel preview. Cancel restores the saved Main direction, retains the proposal, clears its Previewing status and returns to the same question. It never promotes, rejects or applies source changes. Failed or disconnected restoration does not claim success.

Verified in the disposable browser: the selected Create workspace button rendered at 14px after Preview; Canvas showed the selection and both return controls; Back to conversation preserved the preview; Cancel restored 12px and the saved question, left the proposal Proposed and disabled Move to Review. Review remained 0, and the disposable project's git status stayed clean. The inspector and runtime builds/typechecks and whitespace check passed. All 195 inspector tests and 39 runtime store tests passed, including cancellation with existing Main edits, offline/failure handling and promotion being blocked after cancellation. This is not coverage of arbitrary multi-target proposals or a source Apply test.

## Design branches: empty promotion and edit clarity (September 24)

The user reached empty Review after promoting Larger button label. Session evidence showed that direction contained zero saved changes; the runtime nevertheless marked it chosen and recorded an empty chosen decision. The existing data was preserved rather than rewriting that history.

Move to Review now disables for empty or terminal-only directions, with a visible explanation in Active direction. The click handler also guards the action. Runtime promotion rejects an empty/terminal-only direction before any ledger, active-direction or history write, and rejects a merge that produces no pending changes. Inspector typing now displays an inline Preview only / Not saved message. Enter acceptance displays a saved confirmation, and the instructions distinguish saving to the named alternate direction from adding to Main's Review. Existing Escape/blur cancellation behaviour is unchanged.

Live verification used the same disposable session. Larger button label initially showed zero decisions and a disabled Move to Review. Typing 14 in the selected Create workspace button's font-size field displayed the preview-only message and rendered 14px. Enter produced Saved to Larger button label, one saved 12-to-14px decision, and enabled Move to Review. Review remained zero. The direction was left active with that one saved change for the user's next test; it was not promoted or applied during this verification. Inspector/runtime builds, 197 inspector tests and 39 runtime store tests passed. Empty promotion's no-mutation guarantee is regression-tested. No source Apply or recording-project edit was performed.

## Design branches: reviewed button source Apply (September 24)

The user confirmed promotion produced Review 1, explicitly authorized only the Create workspace button's 12px-to-14px font-size change in the disposable Morrow project, then pressed Apply with agent after the listener connected. Frozen change `chg_11007775ec8241a1876ce525cce1abee` used the resolved instance mapping `map-create-workspace-button-fontSize` at `index.html:247:12`.

Run `run_76c64de6cd2d4fc7875d6b1dc58e86ab` passed on its first attempt at 2026-09-24 21:27:42 UTC. The sole source diff adds `font-size: 14px` to the mapped button's existing inline style, retaining its 448px width and leaving shared styles unchanged. The six-file build, all eight fixture tests (including rendered browser checks), 13 source annotations and `git diff --check` passed. The disposable copy required a parent-directory link to the existing workspace test dependencies and permission for the test's temporary localhost server; no dependency manifests changed.

After baseline-relative source acknowledgement, Foundry's isolated browser verification measured 14px at 1440 x 900 in the frozen current breakpoint/theme/state, with unchanged 448 x 52 target geometry. One requested change passed; no unresolved items in this run. Applied revision: `e314518bc9987c7e60e943949a32bd652438ca5c-dirty-ee50f90b66ab`. This is reviewed-context coverage, not all breakpoints or states. The recording project and release were untouched.

## Connection-loss recovery test (September 24)

User authorized a disposable-session test, not new source edits. A temporary button font-size change from 14px to 16px was saved with Enter (`chg_5db27f453a3b4dd4bac224a29a3fa9d1`). The exact preview process on port 4690 was confirmed against its working directory, stopped, and the inspector refreshed while runtime 4387 remained running.

- Persistence passed: Review remained 1 while the product iframe refused connection. The saved change retained 14px before and 16px after.
- Offline messaging failed: after the adapter timeout, Canvas said "This product blocks embedded previews" and suggested an overlay, although the server was simply offline. `setupPreview()` exposes that generic fallback after five seconds without a bridge connection. Connection details correctly showed the preview disconnected and provided Reconnect preview.
- Reconnection passed: restarting the same built fixture and choosing Reconnect preview restored adapter acknowledgement and all 13 source mappings.
- Pending-preview restoration failed in this sequence: Canvas rendered the source value 14px, including after a Review/Canvas round trip, while Review retained the pending 16px change. The data was not lost, but its visual preview was not restored.
- Additional observation: the visible Review workspace showed the previous completed Apply run while Review counted the new pending change. A Delete and restore attempt through its accessible control did not remove the test change. This needs a focused follow-up; no deletion failure cause was established.

Cleanup used the canonical review tool to reject only the temporary test change; it remains as rejected history, not a pending edit. Final browser measurements were 14px and 448 x 52, Review 0. Both saved branches were unchanged, the original Apply run remained passed, and Delivery remained verified. Source hashes for index.html and style.css matched the pre-test baseline. The preview server was left running. No application fixes, new Apply run, release changes or recording-project changes were made during this test.

## Connection-loss fixes and regression verification (September 24)

Implemented in the isolated Foundry Next inspector after explicit authorization. The timeout now says Live preview unavailable, explains restarting the preview server, reassures that saved edits remain in Review, and offers Reconnect preview directly on Canvas. It no longer infers a framing-policy failure from a missing adapter acknowledgement. Canvas and Connection details share the reconnect action and restart the timeout on every reload.

Reconnect now restores pending Main edits as well as named directions. Recovery waits for both session data and the live adapter, excludes applied/rejected history and other contexts, skips active Apply/verification, guards in-flight work and stale frame acknowledgements, and reports an unacknowledged recovery without repeatedly retrying it. It uses the existing temporary branch-preview command and never changes source or promotes the ledger.

Live regression used the same disposable session, resumed after its servers stopped between turns. Saved a new 14px-to-16px draft, stopped only its confirmed port-4690 process, and reloaded Foundry. Canvas visibly showed the new offline guidance and reconnect action with Review 1. After restarting the preview, Reconnect restored computed 16px at 448 x 52, Review 1, and enabled Undo. An ordinary full refresh also restored 16px. Undo then restored 14px and Review 0 and removed only the temporary draft. The earlier applied change and rejected test history, both branches, passed Apply run, and verified Delivery record remained intact. Product source hashes were unchanged. Inspector build, syntax check, all 206 inspector tests (including nine recovery regressions), and whitespace validation passed. No source Apply or publication was performed.

Scope: the live test covers the current desktop context and Main; named-direction recovery, context filtering, failed acknowledgements, startup races, and Apply guards have unit coverage. The separate observation about an old completed run obscuring newly pending Review content remains open and was not included in these two recovery fixes.

## Review: pending edits after completed Apply (September 24)

Fixed the preceding open observation in the isolated Foundry Next inspector. A passed Apply run no longer covers the Review ledger when draft, approved, or unresolved changes are pending. Active runs and failure/retry controls retain their existing priority. When no pending edits remain, completed verification evidence is still available. The decision runs on both Review entry and session updates and clears the hidden overlay's cached render signature.

Live validation in the disposable session saved a temporary button font-size edit from 14px to 16px. Review 1 displayed the editable pending row rather than the earlier Verified surface. Leaving and reopening Review and refreshing the page retained the pending row. Its visible Delete and restore action successfully removed only test change `chg_334fb56192b84eaf981b0753645719bb`, returned Review to 0, and restored the inspector to 14px. The earlier rejected row remains existing ledger history; its presentation was not changed. The previous passed Apply run and verified Delivery record were preserved. No browser errors were reported.

All 211 inspector tests passed, including five new Review-priority regressions. Inspector build, syntax check, and `git diff --check` passed. Product source hashes matched the pre-test baseline. No new source Apply, publication, or recording-project changes occurred. The browser was left on clean Canvas.
