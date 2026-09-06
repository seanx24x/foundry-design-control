# Portable branch decision records

Use portable branch records to carry the outcome and evidence of a Design Branch beyond its original session without turning that outcome into an automatic project rule.

## Record contract

- Choosing or rejecting a direction creates or refreshes one canonical record for that branch.
- Preserve the outcome, rationale, exact changes and operations, session context, design-graph revision, and source relationships.
- Export records as a versioned `foundry.design-branch-records` JSON bundle.
- Import records as reference material. Importing must not change the canvas, Main, source files, or Design Memory.
- Reassess compatibility against the current session and design graph whenever records are read, imported, or the graph changes.
- Match source relationships by project-relative path so a project can move between machines without becoming stale solely because its root path changed.

## Compatibility

- `current` means every recorded source relationship is present and the design-graph revision still matches. The direction may be restored for exploration.
- `stale` means the relevant source still exists but the graph revision or part of the recorded context changed. Show the evidence and require review or repair before restore.
- `missing` means the record has no recoverable source relationship or none of its source files exist in the current graph. Never guess a replacement.

Compatibility is evidence, not an edit. It must not create a design change or alter the record's original context.

## Restore and memory boundaries

1. Restore only a `current` record.
2. Clone its changes and operations with fresh identifiers into a new exploring direction.
3. Keep the restored direction isolated from Main until the user explicitly chooses it again.
4. Add a record to Design Memory only after the user selects **Add to Memory**. Choosing, rejecting, importing, or restoring a record must never silently create permanent guidance.
5. Let the user remove a record without deleting its original branch or changing source.

## Verification

- Export chosen and rejected records and parse the bundle against the protocol schema.
- Import into the same project at a different root path and confirm source-relative matching remains current.
- Change the design-graph revision and confirm the record becomes stale.
- Remove its source from the graph and confirm the record becomes missing.
- Restore a current record and confirm a new isolated direction appears without changing Main.
- Confirm explicit Add to Memory is the only path that creates remembered guidance.
- Verify Light and Dark workspace states and the matching Figma components.
