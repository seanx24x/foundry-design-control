# Foundry Next: inspector implementation

Branch: `feat/foundry-next-inspector`

This implementation is isolated from the release checkout and recording session. It starts from the existing working source state, including earlier uncommitted work. Nothing has been committed, pushed or published.

## Reference

The approved precision study is the reference, not a new visual direction:

- Figma file `9kZ4BAm1kiEW6huzfIw3DZ`, light shell `1448:8966`, dark shell `1451:58350`.
- Selection coverage: container `1469:10083`, media `1470:10231`, SVG `1470:10450`, component `1470:10649`, multiple `1470:10947`.
- 300px panels; 44px inspector header/footer; 16px property insets.
- 268px full fields, two 128px fields with a 12px gap; 32px control height, 4px radius.
- Inter UI text, shared Keyline SVGs and source-derived theme colours.
- The inspector theme is independent of the product theme.

## Implemented

- Opt-in `?ui=next` workspace shell, filled Canvas tab, floating tool dock and existing studio navigation in a tools menu.
- Contextual empty, text, container, media, icon/SVG, component/form-control and multiple-selection inspectors backed by the real adapter.
- Consistent Position, Layout, Typography, Appearance, Content and Accessibility ordering. Unsupported sections are omitted. Primary disclosures and advanced expansion are remembered per category.
- Reversible layout and appearance edits, safe leaf text editing, accessible labels and image alternative text. Rich child content is not flattened by a parent text edit.
- Image and video object-fit and object-position appear as paired primary Layout controls. Fit supports fill, contain, cover, none and scale-down; choosing a fit is an acknowledged Review acceptance, like the existing CSS selects. Position accepts valid CSS keywords, percentages and offsets with temporary typing preview, Enter acceptance and exact Escape restoration. Undo restores each original inline declaration.
- Media controls omit irrelevant typography, text colour and text-content editing. Picture wrappers and audio do not expose object-fit/position. Mixed selections expose these CSS properties only when every selected element supports them. Image src/srcset and video sources remain untouched.
- Native select changes no longer schedule a second delayed preview that could reapply a value after Undo. Switching to a new selection starts the inspector at the top without resetting category disclosure choices.
- Shared-property intersection for multiple selections, explicit Mixed placeholders, no numeric scrubbing from Mixed, and one Undo for an accepted group. Each target receives its own source-traceable Review record.
- Padding uses horizontal/vertical pairs with an inline independent-sides disclosure. Corner radii support linked and independent values. Compatible values can be linked without changing the product; unequal values require an explicit replacement in an inline confirmation. Cancel and Escape restore the exact starting preview.
- Linked fields preflight all affected CSS properties on all selected targets. Acceptance creates real edge/corner Review records with one undo/redo group, not a fictional shorthand source property. Partial persistence failures report the exact saved count and preserve the remaining values and entered input.
- Keyboard focus returns to the linking control after cancellation and survives subsequent inspector snapshot redraws.
- SVG roots are selectable directly on the canvas. Path-level fill/stroke editing remains unavailable and is explained.
- CSS keywords and unequal shorthand values remain CSS-valued fields rather than being coerced to zero or the first numeric value.
- Existing Component Workshop and Motion Studio remain reachable for their deeper tools, with unavailable inline capabilities explained.
- Authored variants appear inline in Content when there is one unambiguous indexed component, an exact selected-instance source mapping, and a same-origin CSS data-attribute hook. Morrow's Primary, Quiet and Danger use this path. Missing hooks, similar attribute names and hooks on ancestors do not count as support.
- Variant selection previews temporarily without a Review record. Switching candidates restores the original attributes first. Cancel/Escape restores absent attributes exactly; Add to Review records actual `variant.*` properties and supports undo/redo. Failed acceptance retains the candidate for explicit retry. A disconnected preview cannot report acceptance.
- Other property inputs are disabled while a variant preview is pending, with an explanation. Their displayed computed values still update to match the rendered candidate. Selection/workspace changes cancel temporary variants; Focus and Canvas return preserve the same candidate.
- Temporary acknowledged preview while typing. Enter accepts a valid edit into Review; Escape restores the starting inline style. Blurring a valid unaccepted edit cancels it; failed inputs remain visible.
- Numeric font-size and opacity scrubbing: 4px threshold, normal/coarse/fine increments, one accepted gesture equals one undoable edit.
- Searchable indexed project-font chooser: preview, cancel, use, and reset. Font stacks retain authored fallbacks.
- Explicit Focus tab, with surrounding product dimming. Canvas returns to the same selected element.
- Fixed source/status footer and independently scrolling properties.
- Offline edits preserve input and display an error rather than reporting success.
- Failed Review writes restore the unrecorded target. A partially saved multi-target group reports its exact recorded count and remains undoable; it is not presented as an atomic server transaction.
- Late acknowledgements do not clear a newer in-progress input.
- Inspector snapshots carry a local monotonic revision, so Undo removes changed-value feedback even if it happens before the post-edit animation-frame snapshot.
- CSS transitions are suppressed only during the synchronous gesture measurement, then their exact inline declarations are restored. This includes the fixture's authored reduced-motion rule.

## Deliberate first-slice boundaries

This is not the completed redesign or a claim of full Figma parity.

- Numeric controls use the adapter's computed representation. Full authored-unit provenance remains future work. Linking is available only when every affected edge/corner exposes compatible control kinds and units; otherwise independent fields remain available.
- Asset replacement and destructive image cropping, SVG path editing and inline native states are not implemented here. The legacy src setter does not validate replacement loading or responsive source selection, so Next does not expose it. Object-fit/position only change presentation within the existing box. Variants without supported data-attribute CSS hooks, including arbitrary framework props, remain unavailable inline. Motion editing still uses Motion Studio. These are explicit capability boundaries, not simulated controls.
- The compact font chooser supports indexed project fonts only. Google/local font workflows remain in the existing Typography Studio.
- Focus currently dims surrounding content in the same live product frame; it does not yet provide a separate specimen comparison workspace.
- No Apply listener is attached by this preview harness. Existing Apply behavior has not been claimed as verified by this slice.
- Narrow/mobile layouts and the remaining studios need a separate visual pass before making Next the default.

## Run and verify

### Consolidated chrome and tabs

The app identity, tabs and workspace actions now share one 48px header, replacing the separate 48px chrome and 40px tab rows and recovering 40px for the workspace. Foundry and the Live dropdown sit left, the tab strip takes the flexible middle column, and Review/commands/menu remain fixed at right. The project name lives inside the Live dropdown rather than taking header space. This 288px native popover shows the actual project, runtime, preview and Apply-listener connections separately, with a Connection details action for the existing readiness dialog. Long project names wrap. Enter/Space or ArrowDown opens it; Escape/outside clicks dismiss it, and keyboard focus returns to Live. It does not imply project switching or a connected agent just because the preview is live. Legacy UI retains its direct readiness action. The header uses the recessed canvas background so the active tab's surface joins the workspace beneath it. Outer insets and column gaps are 16px; action gaps are 8px. Actions retain 32px targets and 4px corners. Existing Keyline action icons are 16px, with a 12px Live disclosure chevron. Foundry uses 13px medium text; status/actions use the existing UI face at 12px. Green is reserved for the live dot, while degraded status retains an explicit label and red dot. Keyboard focus uses a single inset border.

`node scripts/test-next-chrome.mjs` validates an already running isolated Next preview without resetting its session or staging changes. Sixteen checks cover light/dark and header widths of 768/1024/1280/1920px, including the project connection dropdown, action navigation, keyboard focus, long-label/count stress and reduced motion. Narrow-width checks cover the header, not a full mobile workspace redesign. Screenshots and report: `artifacts/next-workspace/chrome/`. This is not a rerun of the entire release suite.

### Layers and Components panel

The panel remains 300px wide with a 44px header and a quieter adjacent count. The tab switch and search share 16px side insets; the switch has 32px controls inside a 48px area, and the search is a 268 × 32px borderless field with 12px below it. Search focus changes tone without nested outlines, including inherited contrast styles. A clear button and Escape reset the query and return focus to search. Unmatched layer queries now report no matches rather than suggesting that the preview is empty.

Layer rows are 32px high with 8px internal gaps, 16px icon slots and consistent 12px depth increments. Icons, disclosure artwork, labels and metadata share one centreline. Source metadata is plain 10px text rather than a filled uppercase badge. Selection uses a soft fill; keyboard focus adds a single inset outline. Full layer names are available in native title tooltips. A stable scrollbar gutter avoids width jumps while filtering. Existing tree selection behaviour is unchanged; this pass does not implement expand/collapse interaction for the existing disclosure artwork.

Components use 48px borderless rows, 16px unboxed icons, aligned names/source references and quiet instance counts. Full names and source references are available on hover. Selecting a component still opens the real Workshop. `node scripts/test-next-structure.mjs` verifies 8 scenarios covering light/dark at 1280/1920px, row geometry, actual Morrow selection, search, empty results, clear/Escape, focus, component navigation and an unchanged review ledger. Evidence: `artifacts/next-workspace/structure/`.

### Tab-bar refinement

The tab strip follows the supplied curved browser-tab reference, replacing the earlier outlined silhouette. It lives inside the 48px header. All header content shares a 24px centreline: Foundry, Live, active/inactive tab labels and icons, close targets, plus and right-side actions. Each tab's backplate starts at 4px with a 44px shape and 4px bottom padding, so its curved lower edge does not pull the controls below that shared line. The 24px close target has 8px above and 12px below, with a 12px inset from the straight tab-body edge matching the leading icon inset. Icon-to-label and label-to-close-target gaps are 8px. The selected shape has 12px upper curves and inverse 12px lower corners flowing into the workspace, with no outline or strip divider. The curved feet are contained inside the item's bounds to avoid clipping during overflow. Adjacent items overlap their outer curves by 16px, leaving an 8px gap between tab bodies without overlapping controls; the active shape paints above its neighbours. Tabs have a 112px minimum width and grow for their content; inactive tabs have no separators. Canvas uses the existing outline-square icon. All tab icons scale their source strokes with the 16px artwork. The adjacent Tools trigger remains 32px, with no extra left margin. Property panels are unchanged. The tab browser checks measure the complete header's centreline, not just alignment within each tab.

Canvas remains pinned. Selecting a tool opens one tab for that workspace; selecting it again reuses the existing tab. Tabs can be revisited and closed, with an adjacent tab activated when the current one closes. These are views over the existing workspace state, not independent copies of studios or sessions. Tab order is local to the page lifetime. Closing a tab does not clear the review ledger or write source. Focus remains selection-bound and closes after acknowledged exit or selection change.

The strip exposes tablist/tab/tabpanel semantics and a roving tab stop. Left/Right and Home/End move focus; Enter/Space activate; Delete closes a focused closable tab. Modified shortcuts are untouched. Overflow scrolls horizontally with no visible scrollbar, keeping the selected tab including its close button visible and the plus outside the scroller. The top Tools trigger anchors the existing chooser below the strip, reports expanded state, dismisses outside, and restores focus on Escape or selection.

`node scripts/test-next-tabs.mjs` runs 14 checks against the existing isolated preview, covering geometry at 1280/1920px, light/dark, tool opening/revisiting/deduplication, active/inactive close, overflow, keyboard navigation, Tools placement/dismissal, actual Focus/Canvas return and reduced motion. Captures and report: `artifacts/next-workspace/tabs/`. No session reset, Apply operation or source change is performed.

From this worktree:

```sh
pnpm build
node scripts/test-next-workspace.mjs
node scripts/test-next-workspace.mjs --preview
```

The harness uses ports 4587/4590 and a temporary copy of the real Morrow fixture, an isolated home directory and the public CLI. It never uses recording ports 4387/4390 or edits the canonical fixture. The preview URL is stored privately at `artifacts/next-workspace/preview.json` while running. Stop with Ctrl-C to clean up its owned processes and temporary fixture.

Browser evidence is saved in `artifacts/next-workspace/`: light/dark captures at 1920×1080 and 1280×768, selection-category inspector crops, and `report.json`.

The browser suite checks panel/header/footer/control geometry, temporary edits with zero ledger changes, exact cancellation, acceptance and reset, invalid input, inline expansion, font preview/cancel/use, Focus return, one-step scrub undo, contextual selection, shared edits/grouped undo, failed Review saves, theme layouts, disconnected behavior, zero source changes and browser exceptions. Morrow has no image/video element: media tests use supplemental temporary DOM specimens, explicitly not a claimed Morrow feature. Image checks use a loaded two-colour SVG with responsive source candidates; video checks verify element CSS, not decoded video playback. No media source Apply or asset replacement is claimed as verified.

## Heroicons and compact targets: 2026-09-22

### Pending changes toolbar: 2026-09-22

The Next pending-changes summary is centered 8px above the floating Canvas tools. Shared bottom/height/gap variables keep the stack aligned. Its 56px height, maximum 480px width, 8px radius, two-line 12px/11px summary and 32px action buttons replace the previous top-of-canvas treatment. Long labels truncate with full-text tooltips. Compare uses the Heroicons comparison glyph and an explicit pressed state while viewing the baseline. The Tools flyout remains an overlay above the stack; no Review or Apply semantics change.

Verified the live two-change session in light and dark: exact 8px gap and shared centreline, no horizontal overflow, Compare/end-compare, Review/Canvas return and unchanged change count. The standalone toolbar regression script also checks stack geometry whenever the connected session has pending changes; it does not manufacture changes.

### Cobalt brand and one utility menu: 2026-09-22

Latest top-bar refinement, superseding the tinted and inverted-bar experiments: both modes use an off-black `#1D1D1F` bar with light text/icons and a white Review button with dark text. Dedicated chrome foreground, hover, focus and status shades retain contrast without changing workspace tokens. Selected tabs still use the workspace surface; inactive tabs use the shared dark chrome. Menus/popovers retain the workspace theme. Cobalt selected states elsewhere remain unchanged.

Foundry Next uses cobalt `#3157FF` as its brand token. The top bar and selected surfaces share an opaque, surface-composited tint: 8% cobalt in light mode and 18% in dark mode. Active tabs remain neutral. Selection icons use cobalt in light mode and a legible `#98ADFF` derivative in dark mode; connection/error status colours stay semantic. Secondary chrome text is slightly darker in light mode to retain contrast on the tint.

The top bar now has Review and one utility menu. The latter contains Find a command, Connection details, Theme and Open direct preview. Its duplicate workspace links are removed only in Next; the bottom Tools chooser retains navigation. Command search is also available through Cmd+K or Ctrl+K when the inspector document is focused, with search reset and focus restoration on dismissal. Other open dialogs are not interrupted. The legacy interface is unchanged.

Chrome browser checks cover both themes at 768/1024/1280/1920px, menu composition, search and navigation, both command shortcuts, focus restoration, theme cycling, connection details, unchanged Review count and reduced motion. Toolbar/tab checks cover the retained shared tint and navigation behavior.

### Inspector visual refinement: 2026-09-22

Follow-up: Source details now belong to a bottom-anchored accordion, not the property scroll area. Its 44px toggle precedes the revealed details, rotates its chevron and exposes `aria-expanded`/`aria-controls`. The section grows to fit, capped at 320px or half the inspector height; longer details scroll internally and are keyboard focusable. Opening it never calls `scrollIntoView` on the properties. The targeted browser checks cover expansion beneath the toggle, bottom anchoring, collapse, keyboard access and unchanged property scroll position at both sizes/themes.

The inspector retains its 300px width, fixed 44px header/footer and 32px property fields. Collapsed sections now use a 40px rhythm with subtle full-width dividers; expanded groups share 16px insets, paired 130px fields and an 8px gap. More disclosures, link controls, scrub targets and reset buttons use compact 24px utilities. Inspector and project-font-chooser icons now use the same source Heroicons as the shell. Existing preview, cancellation and Review semantics are unchanged.

`node scripts/test-next-inspector-refinement.mjs` checks the current session without resetting it or accepting edits. Fourteen browser checks cover real Morrow selections in both themes at 1280×768 and 1920×1080, fixed geometry, overflow, inline expansion, font-chooser cancellation, exact temporary-style restoration with Escape, source disclosure and an unchanged Review count. Paired captures and results are in `artifacts/next-workspace/inspector-refinement/`. The inspector build and all 69 inspector unit tests pass. This supersedes the earlier 128px paired-field geometry below; it is not a new full Apply or release certification.

Next chrome, tabs, canvas context, inspector header Focus, and Layers/Components use a scoped Heroicons trial. The source artwork is pinned through `@iconify-icons/heroicons@2.0.1`, with MIT attribution included in the inspector build. Concept icons retain original 24px outline geometry rendered at 16px; small utility actions use native 16px filled artwork. No artificial stroke widening is applied. Canvas uses Window, viewport uses Computer desktop, component uses Squares 2x2, theme uses Sun and state uses Cursor arrow ripple.

Previously 32px controls in these areas are now 24px high. Icon buttons are 24px square with 16px artwork. Search and the Layers/Components switches are 24px high; layer rows were subsequently restored to 32px with 16px icons and 20px line-height. Two-line component cards stay 48px. The 48px chrome, curved tab backplates, 44px panel headers, 300px side panels and existing insets remain unchanged. Inspector property controls and studios remain outside this trial.

Browser verification covers chrome at 768/1024/1280/1920px, tabs and Layers at 1280/1920px, both themes, keyboard and pointer interactions, scope coverage and unchanged legacy icons. Header checks explicitly verify native utility viewBoxes. The trial changes no source Apply behaviour or session data.

### Floating toolbar refinement

The shared Tools flyout is now 552 × 240px with 12px insets, 32px destination rows, 16px Heroicons, 4px row radii and sentence-case 11px group headings. Design, Test and Collaborate sit side by side in three equal columns with 12px gaps and aligned headings. Positioning uses the measured flyout width to keep both launchers clear of the window edges. Canvas uses the same original Foundry pointer as Select. Both toolbar and tab-plus launchers retain the existing destinations, current-page highlight, keyboard order and dismissal behaviour. `scripts/test-next-flyout.mjs` verifies every destination, geometry, unclipped labels and keyboard navigation in both themes at 1280/1920, without staging changes. Evidence: `artifacts/next-workspace/flyout/`.

The Next floating toolbar now also uses Heroicons. Its neutral surface is 40px high, with 8px insets/radius, 24px controls, 16px icons and a subtle inset border/shadow. It remains centered within the canvas, 24px above its bottom edge. Controls are grouped as Select / Interact, Tools, Undo / Redo, then Zoom, separated by 16px dividers. The active tool alone receives the selection tint; hover, focus and disabled states remain distinct. Zoom retains a visible value and a 104px field to accommodate its options.

Tools opens 8px above the measured toolbar bounds, with keyboard focus return and outside dismissal preserved. `scripts/test-next-toolbar.mjs` verifies geometry and icon alignment at 1280/1920 in both themes, mode switching, Tools positioning/dismissal, real canvas zoom and an unchanged ledger. Undo/Redo wiring is unchanged; this visual pass does not stage edits to exercise history. Tab-menu regression checks and all 68 inspector tests pass. Evidence: `artifacts/next-workspace/toolbar/`.

## Context header refinement: 2026-09-22

The Structure, canvas context and Inspector headers share a 44px height, 16px horizontal insets and centered text. The canvas selection name and measured dimensions are separate; dimensions display at one decimal place with exact measurements in the tooltip. Long names truncate without displacing context controls or Focus.

The 32px context controls use source icons and the UI font. Current/default contexts display Viewport, Theme and State instead of three anonymous Current labels. Selected authored contexts retain their actual option names; tooltips and accessible names identify both axis and value. Keyboard focus uses a single inset outline. Focus aligns to the inspector's right inset.

`node scripts/test-next-context-header.mjs` verifies both themes at 1280px and 1920px, shared header geometry, all three keyboard chooser/cancel paths, long names and an unchanged Review ledger. Evidence is in `artifacts/next-workspace/context-header/`. The existing Structure browser checks and 66 inspector tests also pass. This is presentation-only, with no context-engine or release changes.

## Latest full-slice verification: 2026-09-21

- Workspace build passed.
- Web adapter: 177 tests passed. Inspector: 66 tests passed.
- Browser harness: 38 checks passed, including media CSS preview/acceptance/cancellation/Undo, untouched source candidates, mixed-media capability intersection, invalid CSS, failed-save restoration, and the existing variant and interaction coverage. See `artifacts/next-workspace/report.json` for the completed run.
- Full-screen light/dark captures, enlarged category crops, inline linking confirmation and authored-variant previews inspected. Width/height stay paired, field dimensions remain 128/268 × 32px, and the fixed header/footer remain stable at both tested heights.
- `git diff --check` passed. The temporary Morrow source had no diff after the workflow.

This is scoped inspector verification, not a full release gate or Apply-with-agent certification.

Remaining: safe asset replacement needs source-candidate resolution, confirmed loading and reversible source plans before becoming editable. SVG path editing and inline native states remain separate follow-up work. The new variant lifecycle is separate from the existing Workshop command, which still records changes immediately. Keep the release checkout untouched until the remaining capabilities and broader regression suite are complete.
