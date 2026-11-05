# Visual Agent foundations

SCREEN-15 uses the default Next foundations. The shared shell retains the 320px
desktop Questions rail, compact reflow and workspace navigation.

2026-11-02 policy: `foundations=off` restores the previous Next presentation;
`foundations=pilot` remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

## Composition

- Two columns: Questions and the working conversation. No permanent right rail.
  The empty state groups its introduction, attachment summary and question box
  together; saved questions use a readable 760px conversation and a compact,
  persistent composer. The composer can scroll on short screens.
- Current attachments live in a native disclosure inside the original composer.
  The selected question's captured snapshot lives in the persistent conversation
  heading, outside renderer-replaced content. These remain different contexts.
- Connection preflight is a compact, truthful summary beside Send, expandable
  into the original connection explanation/help. Presence is not a claim,
  response or verification result.
- Proposal summaries, exact proposed values and original action buttons stay
  visible. Reasoning, source locations and the **verification plan** remain in
  a disclosure. A proposed value is not a measured result.
- Proposed, Preview active, In Review and Rejected remain distinct. Preview
  affects Canvas; Move to Review records a choice; neither applies source changes.
- Approved Geist 12/20 controls, 11/18 metadata, Lucide glyphs and six-pixel
  controls are used. The Foundry system-message identity is retained.

## Ownership and gate

`next-visual-agent.js` mounts the existing page and owns the same original form,
prompt, note, send button and conversation nodes. The new `foundry-pilot-agent.js`
reparents original context/form nodes into presentation wrappers, changes
presentation text/classes and adds read-only exact-value/boundary summaries.
Native details elements supply disclosure behavior. It does not fetch, send,
start a listener, mutate a draft/proposal, attach a handler or change eligibility.

App-owned queueing, busy guards, retry, proposal preview acknowledgements, Review
promotion, source Apply and context capture are untouched. Current selection does
not replace an older question's snapshot. Existing capture/update logic retains
drafts, scroll and open proposal disclosures through refreshes. Attachment and
connection disclosures persist independently of renderer updates.

## Validation boundary

The isolated `scripts/test-foundry-agent-pilot-fixture.mjs` uses synthetic records
and simulated transport. It is not provider execution, live Review acceptance or
source verification. Read-only live-page checks and fixture checks are recorded
separately in the task checkpoint. No live request needs to be sent to validate
this presentation migration.

## Separate functional follow-ups

The read-only implementation audit found two existing gaps outside this migration:

1. Promotion ignores a false `switch-design-branch` acknowledgement and can claim
   that the saved Review direction is previewed. Add false-acknowledgement coverage
   before changing this transaction.
2. Rejecting an actively previewing proposal changes its status without restoring
   the active branch. The active-preview lookup can then hide Back/Cancel controls.
   Define restoration/escape behavior and add a regression test.

These are tracked in the running experience checklist. This visual checkpoint is
not certification of the complete question → preview → Review → Apply journey.
