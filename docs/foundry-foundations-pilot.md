# Workspace foundations

This is a bounded real-product foundations migration across Canvas/Layers/Inspector,
the design and test studios, collaboration workspaces, Delivery and Review/Apply.
All workspaces share the contextual sidebar. As approved on 2026-11-02, these
foundations are the default presentation in the Next workspace. Default adoption
is not publication, a simulated editor, or evidence that source Apply has passed.

## Try it

Open a local workspace without a `foundations` parameter to use the new design.
Existing `foundations=pilot` links remain supported. Use `foundations=off` to
restore the previous Next presentation; removing that override restores the new
default. An explicit `ui=legacy` remains outside the foundations migration.
Keep session/capability URLs private; do not paste them into reports or source.

The `foundry-pilot` filenames and root attribute are retained implementation names,
not a requirement to opt in. Earlier dated validation below records the opt-in
phase; it does not certify the new default or a published package.

The root `data-foundry-pilot` attribute holds the active workspace mode. The shared
320px desktop sidebar now covers all 14 modes; the shared foundations policy and
Next-workspace boundary remain required. Existing page renderers and edit behavior
are retained. Lucide replaces
mapped interface icons in the migrated interiors and shared chrome; unknown icons,
brand marks and inspected product artwork stay untouched.
The switchers call the current tools flyout, with delegated handling for libraries
rebuilt by their renderers. See [the shared sidebar contract](foundry-foundations-sidebar.md).

## What changed

- Shared approved color roles, neutral graphite sidebar, restrained blue selection,
  Geist 12px/20px controls, Lucide and native 16-unit Inspector property symbols.
- Edge-to-edge shell with a rounded working surface, sidebar workspace switcher,
  quiet fields, section spacing,
  single focus ownership, floating-tool elevation and source-details presentation.
- Separate Layers width, retaining the existing Inspector width on desktop.
- At phone widths, the real Canvas and Inspector stack in a scrollable workspace,
  instead of collapsing the product to zero width. This is browser-tested layout,
  not certification of the actual iOS keyboard or pointer feel.
- Component Workshop uses the same shell with its own library, flexible authored-
  variant gallery and Properties rail. At compact widths the Properties rail
  stacks; on phones the library and gallery join a single page flow. See
  [the Workshop ownership contract](foundry-foundations-workshop.md).
- Design System separates the specimen's live/indexed value from authored source
  properties, preserves alias health in closed disclosures, and improves usage
  and promotion-plan scanning. See [its contract](foundry-foundations-system.md).
- Motion Studio separates temporary playback, editable easing/path diagrams and
  current properties. Diagram provenance stays visible, and editable SVGs retain
  native proportions. See [its contract](foundry-foundations-motion.md).
- Typography Studio separates computed selection settings from a loaded font pair,
  keeps face readiness beside the family name and clarifies font-source metadata.
  Exact specimen content, font loading, shared fitting and editing controls remain
  app-owned. See [its contract](foundry-foundations-typography.md).
- Recipes makes treatment intent, destination mapping and capture eligibility
  easier to scan. Unsupported values stay explicitly excluded, and populated
  presentation testing stays in an isolated fixture rather than the live library.
  See [its contract](foundry-foundations-recipes.md).
- State Workbench puts current inspection evidence first, coverage beside the
  authored state list, and requested conditions apart from applied-context details.
  The isolated preview and measurement engine remain unchanged. See
  [its contract](foundry-foundations-state.md).
- Responsive Design Lab separates temporary Custom tests from future edit scope,
  puts audit status first and clarifies Custom-frame geometry comparison. Real
  frames, fitting and original transactions remain app-owned. See
  [its contract](foundry-foundations-responsive.md).

The font, original icon sources, provenance and licence notices are local under
`public/fonts/` and `public/assets/foundry-pilot/`. The existing build copies public
assets into Inspector `dist`; no new runtime CDN or dependency is required.

## Ownership

- `public/foundry-pilot-review.js/css`: scoped Review and Apply presentation,
  covered-surface accessibility, logical action focus and scroll continuity;
  original queue/retry/resume/cancel, source mapping and revision contracts stay
  app-owned. See [the Review contract](foundry-foundations-review.md).

- `public/foundry-foundations.js`: shared default/fallback policy for the shell
  and all migrated page constructors; no persistence or session mutation.
- `public/foundry-pilot.js`: mode activation and reversible icon pass.
- `public/foundry-pilot.css`: scoped application aliases and component presentation.
- `public/foundry-pilot-workshop.css`: Workshop-only composition and control rules.
- `public/foundry-pilot-system.js/css`: gated Design System presentation and safe
  specimen guards; existing action nodes and source handlers remain owned by the app.
- `public/foundry-pilot-motion.js/css`: gated Motion Studio presentation, diagram
  provenance and responsive instrument composition; original controls remain intact.
- `public/foundry-pilot-typography.js/css`: gated Typography Studio presentation and
  truthful readiness/metadata labels; no specimen, permission or font-operation owner.
- `public/foundry-pilot-recipes.js/css`: gated Recipes presentation and explicit
  mapping provenance/exclusion; no command, capture or recipe-assessment ownership.
- `public/foundry-pilot-state.js/css`: gated State Workbench presentation; no
  context request, iframe, measurement, export or source-edit ownership.
- `public/foundry-pilot-responsive.js/css`: gated Responsive presentation; no
  frame transport, fitting, audit, capture or scope-transaction ownership.
- `public/foundry-pilot-tokens.css`: v1.0.2 definitions from the approved catalog,
  gated at the root so migrated-workspace body portals use the same roles.
- `public/foundry-pilot-fonts.css`: registration only; family usage is pilot-scoped.
- `public/foundry-pilot-icons.js` / `foundry-pilot-icon-data.js`: synchronous local
  semantic mappings; unknown/brand/out-of-scope glyphs remain unchanged.

`app.js` retains the renderer and dock visibility logic. `next-workspace.js` retains
all numeric/color/variant transactions and adds the contextual sidebar tools triggers.
No rendering or edit logic from the isolated design specimen was transplanted.

The 2026-10-30 frame follow-up removes the earlier 8px outside margin and 6px
graphite rim, including the compact 4px inset. The shell fills the browser and
the workspace backing is transparent, so the graphite shell shows through the
working pane's 12px corner cut-outs. Internal panel seams remain square. On
Workshop desktop the footer owns both bottom corners; on narrow stacked layouts
the scrolling viewport owns bottom clipping. No sticky-footer or gallery change
was introduced for this refinement.

## Validation

Unit/static tests:

```sh
node apps/inspector/build.mjs
node --test apps/inspector/test/*.test.js
node apps/inspector/test/foundry-pilot-icons.browser.mjs
```

For real-product validation, start the existing `scripts/test-next-workspace.mjs
--preview` harness on two verified-unused loopback ports, using its
`FOUNDRY_TEST_RUNTIME_URL` and `FOUNDRY_TEST_PREVIEW_URL` overrides. It makes a
disposable temporary Morrow project. Do not point these tests at a user's session.

```sh
node scripts/test-foundry-pilot.mjs --phase=baseline
node scripts/test-foundry-pilot.mjs --phase=pilot
```

The validator reads the harness's local `artifacts/next-workspace/preview.json`,
requires a temporary Morrow fixture and loopback origins, keeps capabilities private,
and saves sanitized reports/captures under `artifacts/foundry-pilot/`. It checks
real UI/preview transactions, temporary Review edits and reversal without Apply.
Baseline means previous Next UI with explicit `foundations=off`; retain a pre-migration snapshot as
separate evidence. Do not regenerate historical screenshots to erase a regression.
Default-without-query and the retained `foundations=pilot` alias require their own
current checks; older pilot reports are not default-rollout evidence.

### Typography checkpoint — 2026-10-30, before default adoption

All 266 Inspector tests pass, including 11 new Typography pilot tests. Initial live
checks at 1642×1248 light confirmed a loaded Morrow Display → Morrow Sans pair,
original contract-1 specimens and equal fitting, search/clear, explicit Local-font
permission and retained disclosure/style-name drafts through Compare again. The
temporary draft was cleared afterwards; no font was staged or source Apply invoked.
Dark 1280×720 and responsive 1280×900, 1000×900 and 390×844 browser checks confirm
equal specimen fitting, no horizontal page overflow and stacked narrow comparison.
A gate-off browser check confirmed the then-default UI was unchanged; no browser errors
were captured. User acceptance and the full source-change journey remain separate.

### Recipes checkpoint — 2026-10-30, before default adoption

All 275 Inspector tests pass, including nine new Recipes pilot tests. The live
empty library remains unchanged; 320px sidebar, disabled capture eligibility and
unsaved Name/Intent continuity through search rerenders were checked. Temporary
drafts were cleared afterward. A separate presentation fixture uses actual app
markup/rendering with synthetic recipe data and stubbed commands; 20 assertions
pass in both light and dark without a Foundry session or source transport.
Gate-off passes 19 assertions with no pilot marker/interior. Geometry checks at
1440×1000, 1000×900 and 390×844 show no horizontal overflow, labeled narrow mapping
rows and a fitting footer. No live recipe mutations or source Apply were performed;
Review remained at 2. User acceptance and the complete live
capture/reuse/Review/Apply workflow remain separate.

### Content Stress Lab composition

SCREEN-14 adds readable draft condition descriptions and selection indicators,
compact findings/evidence hierarchy and a status-first summary, while retaining
the original scan/restore/correction controls and shared 320px rail. The pilot
fixes a zero-sized clipping boundary from the shared display:contents shell by
intersecting the visible root with header/footer limits; it never reparents or
reloads the Canvas iframe. See `foundry-foundations-stress.md` for ownership and
the separate correction-evidence guard follow-up.

### Visual Agent composition

SCREEN-15 keeps the Questions rail and original conversation/composer ownership.
The v2 composition removes the permanent context rail: current attachments live
inside the composer, while captured context stays in the conversation heading.
The empty state is centered around asking; saved questions use a readable column
and compact reply dock. Exact proposed values are visible before opening the
reasoning/verification-plan disclosure. No provider request, Review mutation or source Apply is part
of presentation validation. See `foundry-foundations-agent.md` for ownership and
the separate promotion/rejection follow-ups.

### Design Branches composition

SCREEN-16 retains the 320px Directions sidebar and gives the comparison the full
remaining width. Current editing direction is explicit in the heading; comparison
selectors remain independent. Original active-direction notes and management move
into a native disclosure below the exact decision choices. Empty-direction
promotion guidance stays visible. Existing preview readiness, selection conflicts,
saved records and source-operation boundaries remain app-owned. See
`foundry-foundations-branches.md` for ownership and separate functional follow-ups.

### Design Memory composition

SCREEN-17 pairs the shared 320px project library with one reading/capture surface.
Saved guidance separates reasoning, complete scope, rules and provenance. New
decision opens the existing form; Back and record selection preserve drafts.
Context relevance remains distinct from confidence and verified evidence. Capture,
correction, import/export and Undo remain app-owned. See
`foundry-foundations-memory.md` for ownership and separate reliability follow-ups.

### Delivery composition

SCREEN-06 and SCREEN-18 use the 320px contextual sidebar beside one readable report.
Handoff prioritizes acceptance and evidence, with notes, source context and
screenshots expandable in place. Documentation has a text-only reading view and
retains its original source. History keeps milestone groups in the sidebar;
Visual checks preserve exact result status and explicit baseline instructions.
Original drafts, authenticated images, commands and verification ownership remain.
See `foundry-foundations-delivery.md` for scope and separate reliability follow-ups.

## Still separate

User visual acceptance, physical-device interaction checks, broader framework
adapters, the eight-scenario Apply/verification/Delivery journey, other page-body
migrations and publication remain separate gates. The 2026-11-02 default decision
does not broaden source-edit authorization or certify those remaining gates.
The pilot does not change production's input debounce, mixed/linked values,
invalid-blur behavior, undo/history or reviewed source-operation contract.
