# Foundry experience redesign

## Approved direction

Foundry is a quietly precise studio suite for designers and design engineers. Preserve separate studios, local-first operation, reversible exploration, reviewed source edits and rebuilt verification. Add Guided Design Improvements within Visual Agent, not another top-level destination.

## Delivery gates

1. Capture the existing capability-by-state baseline without disturbing recording takes or unrelated work.
2. Implement and validate a vertical slice: Connect → select → refine → compare → Review → Apply → verify → Delivery. Present the running slice with editable light/dark Figma components for Sean's approval.
3. Only after approval, propagate the system across all studios and deliver evidence-backed Guided Design Improvements using existing requests, proposals, branches and Apply contracts.
4. Complete the internal audit across all capabilities, failure states, themes, keyboard/reduced-motion behavior and 1280×800, 1440×900 and 1920×1080 layouts.
5. Prepare the website, documentation, walkthrough, social edit, case study and release notes. Publishing, deployment and pushes require separate approval.

## Slice design contract

- Labeled studio navigation grouped into Design, Test and Collaborate, collapsible without losing the active destination.
- Persistent Review access, edit count and workflow state; connection status does not imply agent availability.
- Existing Google Sans Flex and Google Sans Code, real Keyline icons, a 4px layout grid and semantic light/dark foundations.
- Neutral surfaces: light canvas `#eff0f1`, panels `#fbfbfd`, ink `#1d1d1f`; dark canvas `#0b0b0c`, panels `#161617`, ink `#fbfbfd`. Selection retains Foundry orange; success/warning/error remain distinct semantic roles.
- Selected content is the focal point. Avoid decorative cards, excess introduction copy or prominent technical metadata outside disclosure.
- Navigation changes presentation only: preserve target, viewport, theme, state, branch and staged work. Unsupported context must be explained.
- Stable controls during passive refresh, no scrollbar-induced layout shift, clear keyboard focus and reduced-motion equivalents.

## Guided Design Improvements follow-on

The user selects a region, selection or page and states a goal. Capture revisioned evidence, current measurements, findings, native tokens/components and memory constraints. Separate measured problems from design judgment. Recommendations explain evidence, affected targets and limitations; up to three requested proposal directions preview in isolated branches. Explicit promotion into Review precedes source changes. Unmapped recommendations remain advice-only.

Extend existing request/proposal contracts with optional goal, scope, evidence, recommendation IDs and links. Older conversations remain readable; unsupported new actions are capability-gated. Never invent quality scores, business impact or accessibility certification. Recapture stale evidence rather than silently reinterpreting proposals.

## Current milestone

The implemented vertical slice has passed its real Morrow browser flow, React/Vite compatibility flow, three negative browser cases and final repository checks. Eight editable light/dark Figma screens are complete with documented fidelity exceptions. See [the validation record](experience-slice-validation.md) for scope, links and limitations. Sean's approval is the next boundary before studio-wide propagation. No full-suite audit, pixel-identical Figma parity, public usability result or release is claimed. Native expansion and a desktop companion are excluded from this cycle.
