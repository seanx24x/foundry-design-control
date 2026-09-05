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
7. **Content and accessibility stress testing: next.**
8. **Visual recipes: planned.**
9. **Design Decision Memory: planned.**
10. **Visual agent conversation: planned.**

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

## Depth remaining in delivered studios

The six delivered milestones have complete core workflows. Their remaining depth should be developed alongside the later roadmap where it creates real leverage:

- Spring and cubic Bezier editors, motion paths, synchronized before-and-after playback, and native Motion, GSAP, and React Spring adapters.
- Creating new component variants through reviewed source operations and richer cross-instance drift repair.
- Container-query scrubbing and explicit before-and-after responsive comparison.
- Promotion of recurring values into tokens and deeper alias-aware token refactoring.
- Export of chosen and rejected branch decisions as a portable design record.

## Distribution track

Product development remains separate from distribution work:

- Complete the paused Codex, Cursor, and Claude directory submissions after the product quality bar is ready.
- Build Foundry 0.3 as a signed desktop companion with automatic updates and project management.

## Cross-cutting quality bar

Every roadmap item includes Light and Dark support, keyboard and screen-reader access, project-native source mapping, temporary preview state, review before apply, rebuilt verification, responsive and reduced-motion behavior, local-first storage, recovery from stale or disconnected state, complete workflow tests, and matching Figma components.
