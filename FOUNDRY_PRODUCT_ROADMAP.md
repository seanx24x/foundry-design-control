# Foundry product roadmap

Foundry is the visual IDE for designing in code. It understands the interface a team has already built, lets people refine it directly, and ensures every approved decision survives in source.

This is the canonical product backlog. We work through one capability at a time without deleting the remaining scope.

## Product principles

- Start with the running product and its current source.
- Prefer project-native tokens, components, and conventions.
- Keep visual exploration reversible.
- Review every source-bound change before application.
- Verify the rebuilt interface rather than trusting the edit alone.
- Keep project data, fonts, decisions, and sessions local by default.
- Add controls only when they improve the user's next decision.

## Product and Figma move together

Every milestone that adds or changes visible interface behavior must update the matching Figma components in the same delivery.

- The running product is the source of truth for layout, copy, states, and behavior.
- Update both Light and Dark variants, including nested components and interaction states.
- Preserve auto layout, shared variables, real Keyline icon components, and the 4px foundation system.
- Compare Figma against fresh product screenshots at the same dimensions before marking a milestone complete.

## Roadmap status

1. **Typography Studio: core delivered.** Project, Google, and local font discovery; rendered diagnostics; variable axes; treatments; modular and fluid scales; source integration planning; saved styles; review and verification.
2. **Motion Studio: core delivered.** CSS and Web Animation discovery; transport; timeline scrubbing; timing and keyframe editing; performance classification; reduced-motion health; review and verification.
3. **Component Workshop: core delivered.** Live instances, source variants, interaction states, safe scopes, drift visibility, and source-aware review.
4. **Responsive Design Lab: core delivered.** Native simultaneous viewports, linked selection, custom-width exploration, stress states, breakpoint scope, overflow findings, and verification.
5. **Design-system intelligence: core delivered.** Project token indexing, source and usage tracing, near-duplicate detection, impact previews, and drift findings.
6. **Design Branches: core delivered.** Isolated directions, native-size comparison, reversible switching, selective composition, notes, rejection, archiving, and explicit promotion.
7. **Content and accessibility stress testing: core delivered.** Temporary content, product-state, preference, and accessibility pressure tests; selection or canvas scope; source- and viewport-backed findings; safe corrections through Review; and explicit separation from design-change history.
8. **Visual recipes: core delivered.** Named project-local treatments; semantic intent and component conditions; compatible-target suggestions; exact property mapping; destination-token resolution; ambiguity disclosure; import and export; and explicit handoff through Review and verification.
9. **Design Decision Memory: core delivered.** Project-local approved directions, rejected experiments, explicit rules, contextual component and source matching, conflict warnings before Review, branch evidence, correction, enable and disable, removal, import, and export.
10. **Visual agent conversation: core delivered.** Multi-element and region context; rendered comments; exact source, viewport, theme, state, measurement, token, and design-graph grounding; durable agent requests; leased listeners and interrupted-request recovery; concrete proposal reasoning; isolated preview branches; explicit Review promotion; and matching Light/Dark Figma components.
11. **Studio depth completion: delivered.** Spring and cubic Bezier editors, source-backed motion paths, synchronized comparison, framework adapters, source-backed variant creation, container-query scrubbing, alias-aware token promotion, and portable branch decision records are delivered. The functionality roadmap is complete and ready for the full UI overhaul.

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

**Goal:** Reuse proven visual treatments without copying brittle declarations.

- Save an approved treatment as a named recipe.
- Include relevant typography, spacing, color, radius, effects, and motion decisions.
- Record semantic intent and required component conditions.
- Suggest compatible targets without applying automatically.
- Show exactly how the recipe maps to the new target.
- Resolve recipe values through the destination project's tokens.
- Require review when a target or token mapping is ambiguous.
- Support project-local import and export.
- Verify every recipe application after rebuild.

Examples include Quiet elevated card, Responsive hero type, Fast spring modal, Accessible focus treatment, and Compact form field.

**Defining workflow:** Save a polished treatment once, apply it safely to a compatible target, and retain the destination project's language.

## 9. Design Decision Memory

**Goal:** Turn previous design choices into useful project context rather than passive history.

- Remember approved visual directions.
- Remember rejected experiments and why they were rejected.
- Capture preferred density, typography, color, radius, and motion behavior.
- Record accessibility and responsive decisions.
- Store explicit project rules such as avoiding pure black or using restrained product motion.
- Connect remembered decisions to affected components and source locations.
- Surface relevant memory before proposing a conflicting change.
- Let users correct, remove, export, or disable remembered guidance.
- Keep memory local and scoped to the project by default.

**Defining workflow:** Recall a relevant decision when it can prevent inconsistency while leaving the user in control.

## 10. Visual agent conversation

**Goal:** Ground AI collaboration in selected pixels, source locations, project tokens, and measurable outcomes.

- Let users select several elements and ask why they feel inconsistent.
- Let users draw a region and request a hierarchy or layout improvement.
- Attach comments directly to rendered elements.
- Include selection, source mapping, viewport, theme, state, and measurements in agent context.
- Let the agent propose multiple preview branches.
- Show reasoning, exact values, affected source, and responsive impact before approval.
- Keep proposed changes separate from approved changes.
- Verify every applied proposal against the rebuilt product.
- Report mismatches precisely and require authorization before retrying.

**Defining workflow:** Point at the real interface, discuss an improvement in context, review concrete proposals, and verify the chosen result.

**Core delivered (2026-09-05):** The workspace now carries live rendered context to the active coding agent through the same durable listener as Apply. Agent proposals remain isolated from Main, expose their exact values and source impact, can be previewed repeatedly without duplicating branches, and only enter Review through an explicit user action. Interrupted claims return to a user-authorized retry state. The matching `Foundry v2 / Visual Agent Conversation` Light and Dark component family is maintained on the Components page in Figma.

## 11. Studio depth completion

**Goal:** Finish the deeper capabilities inside the six delivered studios so their advanced workflows are as complete, source-aware, and dependable as their core workflows.

- Build dedicated spring and cubic Bezier editors with visual curves, direct manipulation, playback, and exact source values. **Delivered 2026-09-05.** Bezier curves remain exact CSS values; physical spring parameters remain explicit while web previews and source changes use a deterministic browser-valid `linear()` approximation.
- Add motion paths and synchronized before-and-after playback for precise comparison. **Delivered 2026-09-05.** Pixel-based transform keyframes are directly editable without discarding other transform functions, and one presentation-only playhead compares the captured source baseline with the current preview through each side's own timing curve.
- Add project-native adapters for Motion, GSAP, and React Spring. **Delivered 2026-09-05.** The indexer preserves each framework's native authoring site and parameter semantics, while Motion Studio adapts them into one preview, editing, comparison, and review model without flattening source intent.
- Create new source-backed component variants through reviewed source operations, with richer cross-instance drift repair. **Delivered 2026-09-05.** Component Workshop now indexes writable Storybook, CVA, and TypeScript union axes, stages exact source-authoring operations from a chosen base variant, and records one narrow repair per explicitly instrumented mismatch. The canonical Light and Dark Figma component set includes both workflows.
- Add container-query scrubbing and explicit before-and-after responsive comparison. **Delivered 2026-09-05.** Responsive Design Lab now indexes authored `@container` boundaries, resizes the nearest source-relevant container independently of its native iframe viewport, and freezes measured before-and-after states with explicit geometry, wrapping, and overflow deltas. The preview remains presentation-only and restores the original inline container styles when cleared.
- Promote recurring values into project tokens and support deeper alias-aware token refactoring. **Delivered 2026-09-06.** The index now resolves semantic alias chains without flattening intent, marks broken and circular references, groups recurring authored literals, recommends the deepest compatible existing token before proposing a new project-native token, and stages every exact source plan as a reviewed `token-refactor` operation. The matching Light and Dark Design System component family is maintained on the Components page in Figma.
- Export chosen and rejected branch decisions as portable design records that preserve context, rationale, and source relationships. **Delivered 2026-09-06.** Chosen and rejected directions now create versioned local records with exact changes, operations, session context, and relative source relationships. Import recalculates current, stale, or missing compatibility against the destination graph; only current records can be restored into a fresh isolated direction; and Design Memory linkage remains a separate explicit action. The matching Light and Dark Design Branches component family is maintained on the Components page in Figma.

**Defining workflow:** Use an advanced studio capability on the running product, review its exact source impact, rebuild and verify the result, and preserve the decision in a portable project record where relevant.

## Distribution track

Product development remains separate from distribution work:

- Complete the paused Codex, Cursor, and Claude directory submissions after the product quality bar is ready.
- Build Foundry 0.3 as a signed desktop companion with automatic updates and project management.

## Cross-cutting quality bar

Every roadmap item includes Light and Dark support, keyboard and screen-reader access, project-native source mapping, temporary preview state, review before apply, rebuilt verification, responsive and reduced-motion behavior, local-first storage, recovery from stale or disconnected state, complete workflow tests, and matching Figma components.
