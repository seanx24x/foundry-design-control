# Foundry product roadmap

Foundry is the visual IDE for designing in code. It understands the interface a team has already built, lets people refine it directly, and ensures every approved decision survives in source.

This document is the canonical product backlog for the next phase of Foundry. We will work through it one capability at a time. Moving an item into implementation should not remove the remaining detail from this document.

## Product principles

- Start with the running product and its current source.
- Prefer project-native tokens, components, and conventions.
- Keep visual exploration reversible.
- Review every source-bound change before application.
- Verify the rebuilt interface rather than trusting the edit alone.
- Keep project data, fonts, decisions, and sessions local by default.
- Add controls only when they improve the user's next decision.

## Delivery rule: product and Figma move together

Every roadmap milestone that adds or changes visible interface behavior must update the matching Figma components in the same delivery.

- The running product is the source of truth for layout, copy, states, and behavior.
- Update both Light and Dark component variants, including nested components and interaction states.
- Preserve auto layout, shared variables, real Keyline icon components, and the 4px foundation system.
- Compare Figma against fresh product screenshots at the same dimensions before marking the milestone complete.
- Do not treat a visual or functional roadmap item as complete while its Figma component is missing or out of date.

## Roadmap order

1. Typography Studio
2. Motion Studio
3. Component Workshop
4. Responsive Design Lab
5. Design-system intelligence
6. Design branches
7. Content and accessibility stress testing
8. Visual recipes
9. Design Decision Memory
10. Visual agent conversation

## 1. Typography Studio

**Goal:** Make choosing, testing, installing, and verifying typography feel native to the running product.

- Inventory fonts already used by the project.
- Identify each rendered face, weight, style, source, and fallback.
- Search and preview Google Fonts on the selected element.
- Discover locally installed fonts with explicit permission and no uploading.
- Provide a safe fallback when browser local-font access is unavailable.
- Show real weights, styles, language coverage, and variable-font axes.
- Add controls for family, weight, width, slant, optical size, grade, tracking, line height, and wrapping.
- Preview several type treatments directly on the canvas.
- Build modular and fluid type scales, including project-native `clamp()` values.
- Detect missing weights, synthetic bold or italic, failed font loads, and unexpected fallbacks.
- Show line length, baseline rhythm, truncation, and wrapping feedback.
- Save an approved treatment as a project token or reusable style.
- Let the user choose how a new font is integrated: package, stylesheet, framework integration, or self-hosting.
- Apply the approved integration through the active agent.
- Rebuild and verify the loaded face and rendered measurements.

**Defining workflow:** Select text, explore type, approve a treatment, install it correctly, rebuild, and verify the exact rendered face.

## 2. Motion Studio

**Goal:** Discover and edit existing product motion without requiring developers to wire every value into a separate control panel.

- Discover CSS animations, CSS transitions, Web Animations, and supported motion libraries.
- Show every animation affecting the selected element.
- Add play, pause, replay, loop, and timeline scrubbing.
- Support 10%, 25%, 50%, 100%, and custom playback speeds.
- Add spring and cubic Bezier editors with visual previews.
- Edit delay, duration, stagger, direction, iteration, and fill behavior.
- Edit keyframes directly and visualize motion paths on the canvas.
- Capture entry, exit, hover, focus, press, scroll, and layout-transition states.
- Show before and after motion side by side or in synchronized playback.
- Create and verify a reduced-motion treatment beside the primary animation.
- Warn when motion triggers layout, paint, or other expensive rendering work.
- Map changes back to the project's native motion system.
- Support CSS, Motion, GSAP, React Spring, and other detected libraries without flattening them into generic output.
- Rebuild and verify timing, endpoints, and reduced-motion behavior.

**Defining workflow:** Select an animated element, scrub its current motion, tune it visually, approve the native source edit, and verify the rebuilt animation.

## 3. Component Workshop

**Goal:** Turn a selected component into a focused, source-aware design-system workspace.

- Detect the component definition and all rendered instances.
- Show every known variant and presentation-affecting prop.
- Present hover, pressed, focus, disabled, loading, empty, and error states.
- Reuse realistic content examples already found in the product.
- Show responsive behavior across relevant widths.
- Let users scope changes to one instance, one variant, or the component definition.
- Expose editable controls only when the source mapping is safe.
- Require an explicit mapping choice for ambiguous operations.
- Compare instances and identify unintended drift.
- Create new variants through reviewed, project-native source changes.

**Defining workflow:** Select a component, inspect its full state and variant matrix, refine the correct scope, and verify every affected instance.

## 4. Responsive Design Lab

**Goal:** Make responsive behavior visible and editable across real running viewports.

- Display multiple native viewports simultaneously.
- Link selection across mobile, tablet, desktop, and custom sizes.
- Scrub viewport width to reveal breakpoint and container-query transitions.
- Preserve each iframe's real viewport dimensions and browser behavior.
- Detect overflow, clipping, awkward wrapping, and layout jumps.
- Edit a value for one breakpoint or promote it across breakpoints.
- Visualize media-query and container-query boundaries.
- Compare layout behavior before and after a change.
- Test browser zoom, dynamic type, and long content without changing the saved product state.
- Verify responsive changes at every approved context after rebuild.

**Defining workflow:** Select once, inspect the same element across viewports, fix the failing context, and verify that the other contexts remain correct.

## 5. Design-system intelligence

**Goal:** Make Foundry understand and protect the product's native design language.

- Index colors, spacing, radii, typography, shadows, breakpoints, and motion conventions.
- Index components, variants, semantic roles, and token relationships.
- Show project tokens before arbitrary values in relevant controls.
- Explain why a suggestion belongs to the project.
- Detect near-duplicate values and likely token drift.
- Offer to promote recurring approved values into tokens.
- Trace a token to its source definition and rendered consumers.
- Preview the impact of a token change before approval.
- Flag components that have drifted from established patterns.
- Preserve aliases and semantic naming rather than replacing them with raw values.

**Defining workflow:** Foundry recognizes the project's existing language and helps the user extend it without creating visual or token debt.

## 6. Design branches

**Goal:** Support genuine visual exploration without polluting the primary change set.

- Create named alternatives such as Option A, B, and C.
- Keep each branch isolated and reversible.
- Compare branches with a scrubber, isolate mode, or synchronized viewports.
- Combine selected decisions from several branches into one direction.
- Preserve short notes explaining rejected directions.
- Keep branch history separate from undo and redo.
- Apply only the chosen branch to source.
- Export a clear record of the selected and rejected decisions.

**Defining workflow:** Explore several credible directions, compare them in the running product, and send only the chosen decisions to source.

## 7. Content and accessibility stress testing

**Goal:** Reveal interface failures that polished default content often hides.

- Test very long names, labels, values, and translations.
- Test empty, loading, error, offline, and missing-image states.
- Test large numbers and unusual data combinations.
- Test increased browser text size and browser zoom.
- Test keyboard-only navigation and visible focus order.
- Test contrast, high-contrast modes, and color-vision simulations.
- Test reduced motion and other relevant user preferences.
- Distinguish temporary test data from intentional content edits.
- Group discovered issues by severity, source location, and affected viewport.
- Offer safe corrections that remain subject to review and verification.

**Defining workflow:** Apply realistic stress conditions, find a failure, correct it safely, and verify the actual state that originally failed.

## 8. Visual recipes

**Goal:** Let people reuse proven visual treatments without copying brittle declarations.

- Save an approved treatment as a named recipe.
- Include relevant typography, spacing, color, radius, effects, and motion decisions.
- Record semantic intent and required component conditions.
- Suggest compatible targets without applying automatically.
- Show exactly how the recipe maps to the new target.
- Resolve recipe values through the destination project's tokens.
- Require review when a target or token mapping is ambiguous.
- Support project-local import and export.
- Verify every recipe application after rebuild.

Example recipes include Quiet elevated card, Responsive hero type, Fast spring modal, Accessible focus treatment, and Compact form field.

**Defining workflow:** Save a polished treatment once, apply it safely to a compatible target, and retain the destination project's language.

## 9. Design Decision Memory

**Goal:** Turn previous design choices into useful project context rather than passive history.

- Remember approved visual directions.
- Remember rejected experiments and the reason they were rejected.
- Capture preferred density, typography, color, radius, and motion behavior.
- Record accessibility and responsive decisions.
- Store explicit project rules such as avoiding pure black or using restrained product motion.
- Connect remembered decisions to affected components and source locations.
- Surface a relevant memory before proposing a conflicting change.
- Let users correct, remove, export, or disable remembered guidance.
- Keep memory local and scoped to the project by default.

**Defining workflow:** Foundry recalls a relevant decision at the moment it can prevent inconsistency, while leaving the user in control.

## 10. Visual agent conversation

**Goal:** Ground AI collaboration in selected pixels, source locations, project tokens, and measurable outcomes.

- Let users select several elements and ask why they feel inconsistent.
- Let users draw a region and request a hierarchy or layout improvement.
- Attach comments directly to rendered elements.
- Include selection, source mapping, viewport, theme, state, and measurements in the agent context.
- Let the agent propose multiple preview branches.
- Show the reasoning, exact values, affected source, and responsive impact before approval.
- Keep proposed changes separate from approved changes.
- Verify every applied proposal against the rebuilt product.
- Report mismatches precisely and require authorization before retrying.

**Defining workflow:** Point at the real interface, discuss an improvement in context, review concrete proposals, and verify the chosen result.

## Cross-cutting quality work

Every roadmap item must include:

- Light and Dark interface support.
- Keyboard and screen-reader access.
- Project-native source mapping.
- Temporary preview state that never masquerades as a source change.
- Review before application.
- Rebuild and rendered verification.
- Responsive and reduced-motion behavior where applicable.
- Local-first storage and explicit permission boundaries.
- Recovery from stale revisions, disconnected agents, and failed validation.
- Tests covering the complete user workflow, not only isolated controls.

## Next-release housekeeping

- Correct `foundry-design-protocol@0.2.0-beta.9` so both `latest` and `beta` resolve to the intended coordinated release.
- Verify all seven npm packages and their tags from a clean cache.
- Run a clean public installation and first-session smoke test.
- Confirm the website installation instructions match the published version and command.

## Progress log

Use this section to record the active roadmap item and completed milestones without deleting the original scope.

- Current item: Motion Studio
- Completed milestones:
  - Added a searchable font browser inside the contextual Inspector.
  - Inventories active, loaded, and rendered project font families with available styles and weights.
  - Applies project-present families through the existing reviewed design-change workflow.
  - Requests explicit browser permission before reading local font names and keeps local choices preview-only.
  - Restores the source-backed family when a local preview is dismissed or the selection changes.
  - Searches the current Google Fonts catalog through the authenticated loopback runtime with a cached offline fallback.
  - Previews Google Fonts on the selected canvas text without misclassifying previews as installed project fonts.
  - Requires Framework, Package, Stylesheet, or Self-host before a new font can enter review.
  - Carries the selected integration strategy and family into the reviewed operation evidence for the active agent.
  - Exposes the real weights and styles available for the selected Google Fonts family.
  - Exposes registered and custom variable axes with live canvas sliders and exact numeric values.
  - Shows Google Fonts subset metadata as script coverage without overstating exact language support.
  - Records family, weight, style, variable settings, and installation intent as source-accountable reviewed changes.
  - Audits the selected text against the browser's registered font faces without falsely labelling unregistered system fonts as missing.
  - Detects failed font loads, unexpected fallbacks, and unavailable or synthetic weights and styles.
  - Measures rendered line count, approximate characters per line, clipping, and wrapping in the active viewport.
  - Presents concise healthy and actionable diagnostic states in both interface themes.
  - Previews Tight, Balanced, and Open text rhythms directly on the selected canvas element with one-click reset.
  - Builds grid-aligned modular type steps from an adjustable base, ratio, and scale position.
  - Produces fixed values or responsive CSS clamp values across the 320px to 1440px viewport range.
  - Keeps treatments and scale experiments preview-only until the user explicitly adds the exact values to review.
  - Saves complete approved type treatments as reusable, project-local styles with source intent attached.
  - Reapplies saved styles through the normal reviewed change workflow rather than bypassing source accountability.
  - Shows the exact framework, package, stylesheet, or self-hosted integration plan before a Google Font enters review.
  - Keeps self-hosted plans unresolved until an existing licensed project asset can be mapped.
  - Verifies family, weight, style, axes, font loading, wrapping, line count, geometry, and clipping across recorded breakpoint, theme, and state contexts.
  - Summarizes multi-context typography verification in the ApplyRun result instead of exposing raw diagnostic JSON.
  - Updates the matching Light and Dark Figma variants for source planning, verification, success, and mismatch states.
- Completed item: Typography Studio
- Next milestone: Discover and scrub existing CSS, Web Animations, and supported library motion in Motion Studio.
