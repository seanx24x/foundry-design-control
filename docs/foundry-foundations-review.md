# Review and Apply foundations

SCREEN-05 is a presentation and accessibility migration using the default Next
foundations. FLOW-08A/B additionally hardens the original app-owned inclusion
transaction and Review editing state (2026-11-01). FLOW-09A adds a polling-safe
app-owned recovery transaction under the same foundations policy.

2026-11-02 policy: `foundations=off` restores the previous Next presentation;
`foundations=pilot` remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.
Default adoption alone is not evidence that a live source Apply passed.

## Composition

- The existing Review summary is the 320px contextual sidebar (200px compact).
  Inclusion, source mapping, scope and listener readiness keep their authoritative
  helper values. Queue/Apply and return actions stay in their original footer.
- The main report labels captured versus requested values and gives both room.
  Friendly property labels supplement exact identifiers; unknown identifiers stay
  literal. Source/context, confidence and inclusion are separate information.
- Apply uses the same sidebar geometry for the original progress stages, with
  source and verification evidence in a scrollable main report. Original recovery
  actions remain outside that scrolling region. Actual run errors are visible even
  when the lifecycle summary provides more general recovery instructions.
- An interrupted run highlights its recorded phase, without counting that phase
  complete. Error and interrupted-phase changes participate in render invalidation.
- A passed run without its own verified Delivery record is not called a verified
  handoff. Its final step is Run complete, while the authoritative lifecycle summary
  and original action eligibility remain unchanged.
- Narrow screens stack; long source/property strings wrap, exact values retain
  their original controls, and inner evidence scrolling yields to the outer page.

## Ownership

`app.js` continues to own Review grouping, original fields and buttons, source
mapping, handlers, payloads, revision binding, stage order, lifecycle presentation,
confirmation timeout and run visibility. It calls the pilot presentation helpers
after rendering. No helper initiates transport, claims work or mutates source.

`foundry-pilot-review.js` moves original Apply report nodes, adds reading labels,
restores logical focused Apply action/report and outer scroll after render, and makes the
covered Review surface inert while the sibling Apply surface is shown. The latter
is an accessibility boundary, not a new modal or focus trap. Shared navigation
stays available. Existing readiness dialog and preview-recovery ownership remain.
Focus moves from a covered Review control to the new Apply heading on first
exposure; focus outside Review is not taken. New or reopened runs start at the top.
Desktop Review keeps its actions visible while summary content can scroll.
The original live Review error sits above, rather than inside, the fixed actions.
At desktop widths its 60–160px text region is keyboard-focusable and scrollable;
narrow screens keep the natural-height message in the outer flow.

## Inclusion acknowledgement and local drafts

`app.js` owns one pending inclusion transaction across rows and rerenders. It
keeps the last confirmed selection/count, exposes pending state and guards Apply,
Delete and further inclusion changes until acknowledgement. The original PATCH
endpoint and `{ status }` payload are unchanged. Its authoritative session response
is consumed directly if no other operation changed the session in the meantime.
Old polling generations and deferred renders are invalidated; background polling
waits for the transaction. A concurrent session update instead requires a fresh
canonical read, not an older complete PATCH snapshot.

Rejected or malformed acknowledgements have row-local feedback and reconcile the
checkbox to the current confirmed session. Nothing retries automatically. An
acknowledged PATCH with unavailable reconciliation is explicitly distinguished
from failure to save; Apply and conflicting controls stay paused until a fresh
session read. Leaving the context prevents the old response from replacing it.

`review-edit-state.js` captures the current raw requested-value drafts, focus,
selection direction and scroll immediately before a Review render. Restoration
requires the same session/project/revision/branch, surviving change identity and
unchanged server value. Removed/applied/replaced changes do not inherit stale
drafts. Checkboxes are never draft-restored. Generic polling draft capture yields
Review fields to this narrower owner. No new source operation, draft persistence,
or reload-survival guarantee is introduced.

`foundry-pilot-review.css` only targets the pilot Review mode. The original UI is
untouched with the gate off, including its existing action contracts.

## Evidence boundary

Populated negative/recovery scenarios are tested using actual renderers and
synthetic transport in `scripts/test-foundry-review-pilot-fixture.mjs`. Such tests
do not establish live queue acknowledgement, source edits, rebuilds or verification.
Never use fixture state as evidence for a real session's Apply outcome.

## Apply recovery acknowledgement

`app.js` owns the pending Retry, Resume or Stop transaction independently of any
rendered button. Progress and presence updates can replace controls without
releasing the lock; replacement controls remain disabled and expose busy state.
Every handler checks the latest canonical run and action eligibility, including
detached controls. Stop retains the original two-click, five-second confirmation.
Navigation stays available and never initiates a retry.

Retry and Stop retain their original empty POST body. Resume now supplies the
runtime-required `expectedRevision` and `expectedDesignGraphRevision`, captured
from the current session when clicked (explicit `null` when unavailable). Retry
acknowledgement must identify a new run linked by `retryOf`; Resume must identify
the existing requeued run. The frozen reviewed contract remains runtime-owned.

The full POST response is consumed only if no newer session update arrived.
Otherwise, a guarded canonical read reconciles current progress. Older GETs and
deferred renders are invalidated around the transaction; polling continues during
the POST but yields while reconciling. A failed reconciliation after acknowledgement
is not reported as a failed submission: recovery actions stay paused until a
successful refresh. Failed submissions show the actual error with no automatic
retry. Session/project or unrelated latest-run changes suppress stale feedback;
an older transaction cannot clear a newer transaction's guard.

The gate-off path remains unchanged. Its existing empty Resume body is rejected
by the current runtime; the fixture records this limitation instead of simulating
success. This pilot repair does not certify the ungated recovery workflow.

## Exact verified handoff navigation

In the pilot, Open verified handoff resolves exactly one verified Delivery record
for the passed run and current session. The button captures that identity, then
revalidates the current run, session/project and exact record when activated.
Missing, replaced, superseded, wrong-session or ambiguous records cannot silently
select an unrelated record. The status heading uses the same strict resolution;
passed run checks alone do not claim a verified handoff.

Successful navigation selects the exact record, opens the Handoff tab regardless
of the previous Delivery tab, and transfers focus to the record heading once.
The existing Delivery draft capture still runs before replacement, preserving
unsubmitted notes on other records. Polling does not repeat the focus transfer.

The exact selection remains pinned across refreshes and tab switches. If it stops
being available, Delivery displays the reason and disables export instead of
falling back to the first record. An explicit record-row selection releases the
pin and restores normal browsing. Recovered navigation errors clear without
clearing genuine Apply transaction errors. Navigation makes no transport request
and does not alter source, inclusion, run state or Delivery records.

The gate-off navigation remains unchanged. This scoped FLOW-10A repair is tested
with actual renderers and synthetic records; it is not a real Apply, rebuild or
verified Delivery acceptance result. The controlled live end-to-end journey and
hands-on experience acceptance remain separate open gates.
