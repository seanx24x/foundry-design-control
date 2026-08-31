# Visual workbench

Foundry's browser UI records intent while keeping all preview changes temporary.

## Selection and layers

- Selection mode is persistent: click around the canvas to choose the exact visible layer under the pointer without reactivating the pointer tool.
- Layout, Type, Color, Effects, and other category buttons only filter inspector controls. The chosen category persists as selection moves between compatible elements.
- Toggle the pointer tool to interaction mode when the underlying product needs to receive clicks. Option-click temporarily selects the strongest target without leaving interaction mode.
- Repeat a click to cycle overlaps.
- Shift-click creates a multi-selection. Parent and Child traverse the composed tree.
- Layers opens by default in a fresh browser session. If the user closes it, preserve that choice for the rest of the current tab session.
- The same panel includes a Components view that combines rendered component instances with the indexed project graph. Live component cards select and cycle their rendered instances; indexed-only cards remain visible without pretending they are on the canvas.
- Layers are searchable, collapsible, and virtualized for large documents. Open shadow roots are included.
- Drag a layer onto a sibling to reorder it within the same parent. Cross-parent drops are blocked because they can change component structure.
- Foundry restores the selected locator after HMR when the mapped element still exists.

## Layout and project intelligence

- Width and height expose fixed, hug, fill, and min/max intent alongside exact dimensions.
- Flow exposes relevant flex or grid controls, gaps, margins, padding, aspect ratio, position, and overflow.
- Linked padding edits all four sides. Tidy layout selects the nearest indexed project spacing values.
- Project token panels are searchable. A token applies to the last focused compatible property, and exact matches also appear beside individual fields.
- Token-only mode hides controls whose current value does not resolve to an indexed project token.
- Indexed component variants, typography presets, gradients, opacity, and live text contrast are contextual tools, not guesses about source architecture.

## Comparison and recovery

- Before and After replay the temporary preview ledger.
- The scrubber interpolates numeric values and switches discrete values at the midpoint.
- Side by side reloads a clean source baseline and applies the current preview ledger only to the After frame. If same-origin framing is blocked, keep comparison in the live page.
- Isolate dims unrelated content. Reset element restores the selected element and rejects its recorded session changes.
- Undo and redo include layer order. Command-K opens all major actions; Shift-L opens Layers; Shift-C opens comparison; brackets select parent and child.

## Review boundary

Preview accuracy does not authorize source edits. Review the recorded target, semantic mapping, scope, context, project token, and impact message before submitting Apply with agent. Literal values remain visible as warnings when a project-native value is not used.
