# Component Workshop foundations

2026-10-30 · SCREEN-07 · Introduced as an opt-in pilot.

This slice adopts the approved Foundry visual system in the real Component
Workshop. It is not a new component renderer, a simulated gallery or source Apply.
The subsequent shared-sidebar slice extends its shell treatment to the
other workspaces; see [the sidebar contract](foundry-foundations-sidebar.md).

2026-11-02 policy: this is the default Next presentation. `foundations=off`
restores the previous Next presentation; `foundations=pilot` remains a supported
alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

## Structure and ownership

- **Library:** the neutral graphite sidebar holds the Components destination
  switcher, existing search and component list. It uses the same compact Geist,
  Lucide and selected-state roles as Layers. The switcher lives in the stable
  browser container, outside the headings and lists rebuilt by the app renderer.
- **Center:** a flexible real authored-variant gallery, then live instances and
  source-authoring disclosures. Existing iframe rendering, returned product
  backgrounds, viewport dimensions and measured fit logic are unchanged.
- **Properties:** the existing selected variant, change scope, preview state and
  source details retain their handlers. Selecting a gallery variant still does
  not add an edit to Review.
- **Chrome:** header and footer align with the center and Properties rather than
  spanning the contextual sidebar. One shared 24px content inset is retained.

Desktop uses the existing sidebar-width role and a 300px Properties rail. At
1100px and below, Properties stacks beneath the gallery; at 700px and below,
the bounded library, gallery, Properties and footer form a single scrolling flow
with 16px content insets. The gallery can scroll independently at tablet widths.

## Scope guards

`foundry-pilot.js` now permits all 14 migrated modes, stores the current mode
on the root and removes it for unknown modes. Shared font/token/icon rules use that gate;
Canvas grid/viewport rules remain explicitly Canvas-only. Workshop layout rules
are scoped to `data-foundry-pilot="components"`.

The hidden Canvas bridge remains paintable for product measurements. Do not
apply the visible Canvas's narrow layout, `display:none`, iframe dimensions or
specimen-stage styles to it. The icon adapter excludes other workspace bodies
and inspected product content, and never traverses preview iframes.

No variant transaction, instance selection, change-scope action, preview-state
handler, source-authoring action, Review contract or product font is replaced.
Using `foundations=off` restores the previous Next UI. Navigation to an unmigrated
mode restores its original icons and font; closing the destination menu returns
focus to a visible owner, not a hidden sidebar trigger.

## Validation boundaries

Run the Inspector unit/static suite and local icon/font browser slice listed in
`foundry-foundations-pilot.md`. Real browser validation uses only the disposable
Morrow harness and checks the actual Primary, Quiet and Danger authored variants,
selection, scope/state choices, keyboard navigation, both themes and responsive
layout. Each card must be scrolled into view before checking its deferred preview.

With that disposable harness running:

```sh
node scripts/test-foundry-workshop-pilot.mjs --phase=baseline
node scripts/test-foundry-workshop-pilot.mjs --phase=pilot
```

The validator reads `artifacts/next-workspace/preview.json` and writes sanitized
reports under `artifacts/foundry-workshop-pilot/`. It refuses to overwrite an
existing baseline report, verifies temporary-Morrow/loopback boundaries and
asserts unchanged fixture source hashes, an empty Review ledger and no Apply.

Keep pre-migration captures frozen. A legacy compact-layout defect is evidence,
not permission to conceal or reproduce it. User visual acceptance, physical
touch/keyboard behavior, broader project adapters, source Apply and publication
remain separate gates.
