# Design System refinement

Scope: the opt-in `ui=next` workspace. Legacy presentation, release assets and product source remain unchanged.

## Structure

- 300px searchable library, flexible preview and usage area, 300px Properties rail.
- 44px headers and project-summary footer; 32px library rows; 16px icons.
- Shared panel surfaces in both themes, with 24px central content insets. Measured scrollbar compensation keeps left and right insets equal.
- Main content shows the selected token sample and indexed usage references. Properties contains its value, evidence, source declarations, impact, aliases and findings.
- Source and alias details expand inline. Expansion and scroll positions survive render updates and switching between Tokens and Promote within the page.
- Below 1100px, Properties stacks beneath the main area. Below 700px, the library also becomes a bounded upper section.

## Evidence and editing boundaries

Connected Canvas values take precedence over indexed values. Without a current connected value, samples use indexed source values and say so. Samples are read-only representations, not cloned product components or source edits.

Supported colors, spacing, radii and shadows receive visual samples. Unsupported values, including font declarations without an exact specimen, remain literal values rather than implying a rendered face or behavior.

Usage and impact are indexed evidence, not live measurements or verified component coverage. No indexed findings is explicitly not a full visual verification.

Existing promotion, export and re-index handlers are retained. Promotion plans still require Review and Apply. This presentation layer does not send workspace commands or stage changes itself.

## Verification

- 93 inspector tests passed, including seven focused tests for evidence precedence, impact wording, section ownership, layout contracts and read-only boundaries.
- Inspector build and typecheck passed.
- Live checks covered token search, no-results recovery, retained source disclosure state, Tokens/Promote switching, exact 12px spacing sample and successful acknowledged re-indexing.
- Desktop light/dark and 1280px layout checks: 300px side panels, 44px headings, equal 24px central insets and no horizontal page overflow. Dark source and usage code had no horizontal clipping.
- Existing Review count remained one. No promotion plan was staged or applied during verification; export download and the full source-application flow were not exercised.

This is a scoped UI refinement, not release certification.
