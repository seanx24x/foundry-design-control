# Design System Intelligence

Use the Design System workspace to understand and extend the product's existing visual language without silently introducing new conventions.

## Read the system map

1. Open **Design system** from the workspace menu or command palette.
2. Filter tokens by category and select the semantic token, not merely a matching raw value.
3. Read its source of truth, aliases, indexed references, literal repetitions, component reach, and file reach.
4. Treat impact counts as an indexed preview. Dynamic, generated, or runtime-only usage may remain outside the graph and must be reported as unavailable rather than inferred.

## Interpret guidance

- **Literal drift** means an authored literal equals or sits close to a project token.
- **Component drift** is literal drift inside a source-mapped component.
- **Near duplicate** means two tokens in the same category fall inside the conservative numeric similarity threshold.
- **Unused token** means no indexed reference was found. It is evidence for review, not permission to delete the token.

Recommendations explain the matching category, value relationship, and source evidence. Exact token matches rank first in Inspector menus, followed by the nearest compatible project values. Never recommend a token from an unrelated category merely because its serialized value matches.

## Promote recurring values

1. Open **Promote** in the Design System workspace.
2. Select a recurring authored value and inspect every indexed source location.
3. Prefer the recommended existing semantic token when its resolved value matches. Foundry ranks the deepest compatible alias chain ahead of a raw primitive so theme and component intent survive the refactor.
4. When no compatible token exists, review the proposed project-native token name and value. Treat the generated name as a source plan, not an applied convention.
5. Add the plan to Review. Foundry records the exact locations, resolved value, alias chain, source blast radius, and required rebuild checks in one `token-refactor` operation.
6. Apply with the active coding agent, re-index the project, and verify every affected consumer before marking the operation complete.

Broken and circular aliases remain visible in the token detail view but never receive an invented resolved value. Dynamic and generated usages remain outside the indexed count and must be reported as unresolved.

## Change the system safely

1. Inspect affected components and contexts before proposing a replacement or token edit.
2. Preserve semantic aliases when they encode intent across themes, states, or component roles.
3. Route literal replacements, consolidation, new tokens, and token-value changes into the normal review ledger.
4. Require an exact source mapping and explicit component, theme, breakpoint, and state scope.
5. Rebuild and verify every affected rendered context. A token definition change is complete only after its indexed consumers remain visually and functionally correct.

The Design System workspace never applies source changes automatically. Token promotion creates a draft Review operation; only the normal reviewed Apply workflow may change source.
