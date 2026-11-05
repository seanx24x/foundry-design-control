# Design Memory foundations

SCREEN-17 uses the default Next foundations; durable transactions are unchanged.
The approved Geist, Lucide, neutral palette and 12px/20px controls apply.

2026-11-02 policy: `foundations=off` restores the previous Next presentation;
`foundations=pilot` remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

## Composition and ownership

- Shared 320px desktop library, 200px compact library and narrow stacked layout.
- Search and the All/Approved/Rejected/Rules/Disabled filters share the same width.
- The main surface switches between reading saved guidance and capturing a draft.
  Empty libraries start in capture. New decision reveals the existing fields before
  the original focus handler. Back and selecting a record preserve capture drafts.
- Reading separates the outcome/title/guidance, current context relevance,
  reasoning, complete scope, explicit rules, saved evidence and Edit guidance.
- Relevance percentages are not confidence or verification. Recorded references
  are provenance, not proof of the current rebuilt product.

`app.js` still owns rendering, search/filter/selection, import/export and durable
commands. `next-design-memory.js` still owns correction drafts, disclosure state,
caret/focus, availability and scroll restoration. The new helper only manages
presentation and moves existing persistent capture nodes. It neither clears field
values nor changes disabled states, data or action payloads.

The original hidden Canvas remains connected for selected context and adapter
commands. Import input, capture inputs, save-help/live status, original actions and
renderer-replaced `#decision-memory-stage` retain their ownership.

## Separate follow-ups

The audit found existing adapter persistence ordering, duplicate-action guards,
legacy export-source and zero-import feedback gaps. These are tracked as
EXP-10A/B/C; the presentation migration does not resolve them.

Synthetic fixtures exercise real renderers and command handlers with simulated
adapter snapshots. They do not establish live persistence, source Apply, verified
product results, physical-device acceptance or publication readiness.
