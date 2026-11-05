# Delivery foundations

SCREEN-06 and SCREEN-18 use the default Next foundations. Source application and
verification contracts are unchanged.

2026-11-02 policy: `foundations=off` restores the previous Next presentation;
`foundations=pilot` remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

## Composition

- Shared 320px contextual sidebar; 200px compact and stacked narrow layouts.
- Handoff, Documentation, History and Visual checks remain the original tabs.
  Desktop tabs are vertical with Up/Down support; narrow tabs are horizontal.
- A single main report uses the available width. Handoff places acceptance,
  source validation and rendered/engineering evidence before expandable notes,
  source context and authenticated screenshots. No permanent third column.
- Documentation has a text-only reading view for generated headings, paragraphs,
  lists and code. Original generated text is retained in Document source. Unknown
  markup stays text, with no HTML execution or external link/image loading.
- History keeps immutable chronology in the main view and milestone groups in the
  shared sidebar. Milestones are not deployments.
- Visual checks retain result status, precise ratios, context, revision, masks,
  findings and explicit baseline instructions. These are not design-quality scores.

Approved Geist, Lucide, 12px/20px controls, neutral surfaces and restrained cobalt
are retained. Section boundaries have one owner, and evidence tables scroll locally.

## State and action ownership

`app.js` still owns `#delivery-content` replacement, list/tab selection, documentation
refresh, visual-report reads, milestone creation and export-command copying.
Dynamic descendants stay inside that renderer boundary.

`next-delivery.js` still owns explicit narrative saves, pending/error messages,
per-record drafts, caret, disclosure state and scroll restoration. The pilot helper
runs before that restoration, moving original nodes without replacing fields,
action buttons or authenticated capture figures. Verified/superseded narrative
remains read-only. Runtime connection gates remain unchanged.

Engineering evidence and screenshot pairing retain their actual protocol helpers.
Image loading retains original validated-PNG handling, object URLs and retry
bindings. Commands remain instructions to copy/run explicitly, never auto-executed.

## Validation boundary

The isolated fixture uses real renderers, helpers and handlers with synthetic
records and transport. It does not establish live persistence, a completed Apply,
new verification, baseline approval, provider use or release readiness.

Existing cached-report refresh-error visibility and milestone duplicate-submit
guard issues remain separately tracked as EXP-13A/B. No source or project records
are created solely to populate a visual acceptance screenshot.
