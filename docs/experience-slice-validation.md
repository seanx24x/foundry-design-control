# Experience redesign: first approval slice

This is the first implementation gate in [the approved direction](experience-redesign.md), not a declaration that the entire studio suite has been redesigned or certified.

## Implemented

- Grouped Design, Test and Collaborate navigation, with explicit expand/collapse and a compact default below 1360px. All fourteen destinations remain accessible.
- Persistent Review access and pending edit count. Preview connection, listener availability and actual Apply lifecycle are separate signals.
- Continuous Review and Apply panels, exact source-file summaries, and source/context details that retain their expanded state during passive refresh.
- A visible batch comparison on Canvas, with an explicit End compare control. Failed comparison does not navigate away from Review.
- Persistent local errors for Canvas commands and Review/Apply actions. Failed requests preserve reviewed work and require explicit retry.
- Verified handoff navigation only when the passed run has its own verified Delivery record.
- Stress corrections record the requested value rather than an intermediate CSS-transition value, and require an authoritative acknowledgement before reporting success.
- Only the actual Canvas owns Apply verification. Branch and auxiliary frames cannot claim Canvas presence or run the coordinator; exact reviewed viewport checks remain intact.
- Verified Delivery narratives are immutable readable text, not disabled-looking form fields. Earlier draft narratives remain editable.

Existing recording sessions, their source edits and unrelated uncommitted development work are preserved. Test projects use isolated Git repositories and ports; this work does not push, publish or deploy anything.

## Reproduce

```sh
pnpm check
pnpm test:experience
pnpm test:experience:negative
node scripts/test-framework-compatibility.mjs --mode workspace --fixture react-vite --runtime-port 4587 --preview-port 4590
```

The experience runner protects recording ports 4387/4390 and defaults to 4487/4490. The negative runner uses 4587/4590. Do not run separate test runners on the same ports concurrently. On this machine, prefix commands that invoke Git with `PATH=/Library/Developer/CommandLineTools/usr/bin:$PATH` while the unrelated system Xcode licence remains unresolved.

The final `pnpm check` passed formatting, compatibility contract tests, builds, type checks and unit tests, including 58 inspector tests and 167 adapter tests. This does not replace the actual browser runs below.

## Recorded result: 16 September 2026

The final Morrow browser run passed all ten checks with 35 screenshots and measured layout captures. It completed the real MCP claim, a single `style.css` edit from 40px to 44px, fixture tests and rebuild, native 44px measurement, verified Delivery, History and a zero pending Review count. The report finished at `2026-09-17T00:31:40Z` (16 September locally).

The run covered light/dark shells at 1280×800, 1440×900 and 1920×1080, navigation preference and keyboard controls, selection/context retention across all destinations, visible reversible comparison, source disclosure across passive refresh, 200% computed text sizing, reduced-motion preference and navigation during Apply. These are targeted checks, not a blanket keyboard or accessibility certification.

Two expected polling cancellations were recorded separately with exact method, route and same-frame navigation/detachment evidence. No other browser, network or HTTP errors remained. Build hashes and the dirty checkout's base revision are stored in the report; a base revision alone does not identify these uncommitted changes.

Three negative browser cases also passed: an offline listener leaves work queued without source writes, a deliberate requested-44/rendered-42 mismatch never becomes verified, and a disconnected preview preserves reviewed work. React/Vite/CSS Modules independently completed a real 40px-to-44px Apply and verified engineering Delivery. Both were rerun successfully against the final build, including the auxiliary-presence guard.

## Evidence inventory

| Evidence                                               | Scope                                                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `artifacts/experience-slice/report.json`               | Actual Morrow, redesigned shell, layout/navigation/comparison checks and real MCP Apply. Read the report status; intermediate failing runs are not acceptance.                       |
| `artifacts/experience-slice/*.png` and `*.layout.json` | Measured browser captures at 1280×800, 1440×900 and 1920×1080, light/dark, plus targeted interaction states.                                                                         |
| `artifacts/refinement/negative-path/report.json`       | Offline queue, deliberate requested-44/rendered-42 mismatch, and disconnected preview with retained reviewed work.                                                                   |
| `artifacts/compatibility/workspace.json`               | Final-build React/Vite run: real CSS Modules 40→44px source edit, rebuild, rendered verification, engineering Delivery, authored contexts, ambiguity rejection and framing fallback. |
| `packages/web-adapter/src/health-correction.test.ts`   | Transition-sensitive recording, authoritative acknowledgement, rollback and retryability.                                                                                            |
| `packages/web-adapter/src/verification-owner.test.ts`  | Real Canvas ownership of verification and presence; auxiliary, branch and child frame exclusion.                                                                                     |
| `apps/inspector/test/workflow.test.js`                 | Truthful lifecycle, mapping precedence, exact summary and verified Delivery conditions.                                                                                              |

Screenshots named `*-failure.png` are debugging artifacts and may be from earlier runs. They are not the final visual reference. Screenshot evidence must show the acknowledged UI state, not merely an API state that has not yet rendered.

## Editable Figma approval slice

The [isolated approval page](https://www.figma.com/design/9kZ4BAm1kiEW6huzfIw3DZ?node-id=1360-7350) contains eight editable 1440×900 views, using existing semantic variables, Google typography and Keyline components. Existing Figma pages and shared masters are preserved.

| View     | Light node   | Dark node    |
| -------- | ------------ | ------------ |
| Canvas   | `1369:13701` | `1385:8665`  |
| Review   | `1378:8358`  | `1385:8940`  |
| Apply    | `1382:8618`  | `1385:8994`  |
| Delivery | `1384:8562`  | `1391:54536` |

The preserved QA inventory is `artifacts/experience-slice/figma-qa.json`: 1,330 Auto Layout nodes, 636 component instances, 1,986 variable-bound paints, no UI image paints, no missing assigned fonts and no shell text-bounds warnings. All eight exports were visually inspected, including corrected light-mode dividers/icons, bounded layer labels and the Canvas selection overlay. Canvas contains the measured session's 78 editable layer rows.

Figma does not have the Morrow specimen's Gill Sans/Avenir Next fonts available; its editable Google Sans Flex fallback has different wrapping. Its new local flow layout prevents text/card overlap, so lower product content moves within the clipped preview viewport. Foundry's own Google fonts are available, but minor Figma font metrics and floating-toolbar width differences remain. These are static editable states, not an interactive replica; Delivery covers the visible handoff viewport, not the below-fold detail or other tabs. No pixel-identical claim is made.

## Approval boundary

Sean's approval is required before propagating this visual system through every studio or implementing Guided Design Improvements. The [capability audit](experience-redesign-audit.md) remains the acceptance checklist for that next milestone. Passing this slice does not certify every advanced capability, every failure state, arbitrary projects, or the published packages.
