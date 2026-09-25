# Foundry Next: Delivery refinement

Opt-in `ui=next` presentation and interaction refinement. No protocol, runtime persistence, project source or release changes.

## Structure

- Shared panel surface, 44px studio header, view tabs and footer.
- Handoff: 300px record library, fluid notes/evidence area and 300px source/context rail. Empty handoffs use the library and a useful reading-area prompt, without a blank inspector.
- Documentation: source-derived page library and full-width document content, with freshness and provenance retained.
- History: verified timeline and 300px milestone rail. Milestones group history; they are not deployments.
- Visual checks: report library, context and findings. Baseline approval stays an explicit CLI action.
- Shared 12px/20px UI type, 16px icons, 24px compact actions, 32px body actions, 4px control radii and existing semantic colours.
- Source paths and metadata wrap. Evidence tables scroll locally at compact widths rather than pushing out the whole studio.

## Behaviour

- Tabs support left/right, Home and End, with one tab stop and a labelled tabpanel.
- Refresh documentation appears in Documentation; Copy export command appears in Handoff and requires a selected record. Copying does not export or write files.
- Next handoff notes use explicit Save notes and Discard note edits, replacing legacy blur-to-save behaviour only in this opt-in UI. They still use the existing acknowledged PATCH API.
- Draft notes, caret, panel scroll and evidence disclosures survive refreshed session data. Drafts are scoped per record within the current inspector page; they are not durable across page reloads.
- Pending saves prevent duplicates; failed saves retain notes and show an error. An earlier acknowledgement does not overwrite newer typing.
- Verified and superseded narratives remain immutable, using the existing read-only policy.
- Acceptance badges distinguish missing criteria, pending results, failed criteria and blockers. All criteria passed does not assert shipment. Ready record status is labelled Ready for Apply in the detail view.
- Runtime connectivity, not preview/listener presence, governs notes and documentation actions. Documentation refresh has pending/failure states and does not switch away from a view selected while it was running.
- Copied Next export arguments and displayed baseline-approval arguments are POSIX-shell quoted, including spaces and embedded quotes.

## Verification

- `apps/inspector/test/next-delivery.test.js`: criteria truthfulness, narrative conversion, shell quoting, explicit acknowledged saving, immutable records, action scope, accessibility and layout contracts.
- `scripts/test-next-delivery-fixture.mjs`: extracted production renderer/handlers with synthetic records and mocked runtime writes. Browser checks cover populated and empty handoffs, blocked and verified records, draft/caret preservation, failed and duplicate saves, acknowledgement during typing, discard, documentation failure, History, visual checks and keyboard tabs.
- Browser review at 1920×1080 light and 1280×768 dark; no horizontal overflow in the primary panes. Live empty views reviewed separately without creating records, generating documents, exporting, applying, or altering the three existing Review edits.
- Fixture tests do not establish real persistence or source-application verification. Screenshot loading continues to use the existing evidence UI; no fake captures are added.

Run `pnpm --filter foundry-design-inspector build`, then `node scripts/test-next-delivery-fixture.mjs` and open `http://127.0.0.1:4689/` (or `?theme=dark`). Stop the isolated test server afterward. Do not run the workspace-reset harness against the recording session.
