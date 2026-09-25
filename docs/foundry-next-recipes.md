# Foundry Next: Recipes refinement

Scope: isolated Next UI only. Existing recipe capture, import/export, mapping and acknowledged commands are retained. No release, fixture source, protocol or adapter changes.

## Layout and workflow

- Left: 300px saved recipe library, compact search and 32px rows. Long recipe names truncate with a full-name tooltip.
- Center: full-width intent, property mapping and suggested targets, with 24px content insets. Mapping shows current and resolved values, destination tokens, ambiguous choices and unsupported values.
- Right: 300px current-selection capture panel. Original name/intent fields are retained across updates; selected-recipe details and duplicate/delete actions expand inline.
- Headers and the shared status footer are 44px. Main and capture panels scroll independently. Fields/buttons use the established sizing, radii, typography and surface tokens.
- Import/export live in the top action row. Empty states explain capture eligibility and provide a Canvas return action.
- Mapping coverage uses actual supported-property counts, not a percentage score. Suggested targets describe heuristic component/element matches, not verified compatibility.
- Adding mapped values uses the existing acknowledged preview/Review command. It does not apply source changes. Unsupported values are excluded; ambiguous token choices remain explicit.
- Offline success-bearing recipe actions are disabled without discarding drafts. Delete requires confirmation before the existing handler runs.

## Verification

- Inspector build and syntax/typecheck command passed.
- 113 inspector tests passed, including seven Recipes tests.
- Live empty library inspected in light and dark themes. At 1280×768: 300/680/300px columns, 32px input, fixed footer, no document horizontal overflow. Existing three Review edits preserved.
- Isolated populated presentation fixture passed 11 browser assertions using the actual `renderVisualRecipes()` function and new presentation helper. Checks cover property mapping labels, heuristic labels, preserved form nodes/drafts, existing apply/duplicate/delete handlers, delete cancellation, offline controls and no-target behavior.
- Synthetic populated state inspected at 1280×768 and 1920×1080, including dark theme, long names, wrapping, unsupported/ambiguous mappings and independently scrolling panels. At 1920px: 300/1320/300px columns and equal 24px main insets.
- The isolated fixture uses stubbed command acknowledgements and never connects to a Foundry session. It is not evidence of end-to-end recipe application or source verification. No recipes were added to the user's empty library for testing; live capture/import/export/apply were not exercised.

To repeat the isolated presentation check after building:

```sh
node scripts/test-next-recipes-fixture.mjs
```

Open `http://127.0.0.1:4689` (or `/?theme=dark`). The page displays assertion results. Stop the owned test server when finished.
