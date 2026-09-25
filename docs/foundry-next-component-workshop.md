# Component Workshop refinement

Scope: the opt-in `ui=next` workspace only. Legacy studios, release packages and Morrow source remain unchanged.

## Structure

- 300px component library, flexible central workspace, 300px properties rail.
- 44px workspace and panel headers; 32px library rows; 16px Heroicons; 12px/20px UI text.
- Shared Canvas neutral surfaces and cobalt selected states. Source paths are kept in tooltips and expandable source details rather than repeated in the library.
- Center: isolated, rendered variant gallery first, followed by live instances, inline source-variant creation and expandable instance comparison.
- Right rail: change scope, authored preview states, source details and configured verification sizes. State Workbench is an explicit action, not a claim that those sizes have passed verification.
- Independent scrolling keeps headings and the 44px status footer in place. Below 1100px the properties rail stacks beneath the central workspace; below 700px the library becomes a bounded upper section.

## Interaction boundaries

Gallery previews use a new read-only `render-component-specimen` command in isolated project frames. Each frame retains its original DOM, CSS, fonts and layout constraints; the selected component is measured and framed without cloning it. Only indexed primitive properties with supported authored CSS hooks are previewed. Authored query states reload only the specimen frame while preserving connection parameters. Unsupported mappings, oversized components, unstable layout and disconnections are explicit failures with manual retry.

Selecting a gallery card updates its properties in Workshop, never Canvas or Review. Leaving Workshop destroys its specimen frames. At most six frames are loaded per gallery page. Acknowledged pings check frame liveness, and render success requires settled fonts and measured geometry. Source variant creation and drift repair still stage into Review and do not write source directly. The legacy Canvas variant command records edits and is deliberately not used by this gallery.

The Next presentation does not call source mapping alone “safe to extend,” report an untested comparison as zero drift, or use green dots as proof of supported native state behavior. Offline presentation retains form inputs and disables preview/staging actions. Scope requires a selected live instance; state controls apply to the isolated gallery.

Unfinished variant values, disclosures and scroll positions survive render updates and component switching within the current page. They are not persisted across browser reloads. An open chooser defers rerendering until it closes.

“View on Canvas” selects the browsed component through an acknowledged command before navigating. Direct Workshop startup keeps the underlying preview laid out so its adapter can hydrate and measure. The covered preview is inert, pointer-inaccessible and excluded from the accessibility tree.

## Verification

- Gallery pass: inspector and adapter builds, 84 inspector tests and 180 adapter tests passed.
- Live browser checks: direct Workshop hydration; Field and PrimaryAction specimens; Primary, Quiet and Danger source appearances; gallery selection; authored Loading query route and return to Current; light/dark inspector presentation.
- Loading renders the actual disabled “Creating workspace” button while Canvas remains enabled with “Create workspace.” Review remained at its existing count of one throughout gallery selection and state checks. No test source change was staged or applied.
- Current desktop geometry: both side rails 300px, all four headers 44px, library rows 32px, fields 32px, and no horizontal overflow.
- This is a scoped UI refinement, not release certification. Responsive breakpoints are implemented but a full viewport matrix and destructive/source-application paths were not exercised on the shared recording session.
