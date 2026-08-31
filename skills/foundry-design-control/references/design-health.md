# Design Health

Design Health is a viewport-specific diagnostic layer over the live application. It does not change source code or authorize an apply run.

## Scan contract

The web scan currently checks:

- text contrast against the nearest opaque rendered background and the appropriate WCAG threshold;
- content outside the viewport and content larger than its rendered box;
- interactive targets below the recommended 44 by 44 pixel area, excluding inline-link target-size exceptions;
- interactive elements without a measurable accessible name;
- motion longer than 300 milliseconds without a matching reduced-motion rule;
- flex and grid gaps that do not match an indexed project spacing token.

Every finding includes severity, affected element, measured evidence, and a plain-language explanation. Findings may be ignored when the behavior is intentional. Ignores remain local to that preview origin and can be restored from the panel.

## Suggested corrections

Only offer Preview fix when the browser can represent a narrow, reversible correction:

- prefer an indexed color token that meets the measured contrast requirement;
- otherwise use the safest accessible foreground fallback;
- raise undersized targets with minimum dimensions rather than enlarging their visible contents;
- use the nearest indexed project spacing token;
- constrain an element wider than its viewport with a maximum width.

Missing accessible names, ambiguous clipping, positional overflow, and reduced-motion architecture remain evidence-only. Select the target and inspect source rather than inventing content or structure.

## Apply and verify

A previewed correction records normal Foundry changes and appears in Review changes. Reinspect its semantic mapping, scope, breakpoint, theme, and state before Apply with agent. Verification must reload the rebuilt surface and confirm the requested rendered values. Re-run Design Health afterward to confirm the finding is gone and to detect nearby regressions.
