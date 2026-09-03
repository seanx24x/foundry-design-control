# Visual workbench

Foundry opens a dedicated local design workspace around the running product. The center canvas is
still the real application, and all visual overrides remain temporary until a reviewed batch is
applied in source.

## Interface appearance

- Foundry follows the operating system light or dark appearance by default and updates live when that setting changes.
- The workspace menu can override this with Light or Dark. Store that preference locally for the user without changing the inspected product's Theme context.
- System, Light, and Dark affect Foundry's workspace surfaces only. They do not record a design change or alter rendered verification context.

## Selection and layers

- Selection mode is persistent: click around the canvas to choose the exact visible layer under the pointer without reactivating the pointer tool.
- The right Inspector shows one contextual hierarchy and hides categories that do not apply to the current element.
- Toggle the pointer tool to interaction mode when the underlying product needs to receive clicks. Option-click temporarily selects the strongest target without leaving interaction mode.
- Repeat a click to cycle overlaps.
- Shift-click creates a multi-selection. Parent and Child traverse the composed tree.
- Layers and Inspector open by default and can be hidden independently from the workspace header.
- The same panel includes a Components view that combines rendered component instances with the indexed project graph. Live component cards select and cycle their rendered instances; indexed-only cards remain visible without pretending they are on the canvas.
- Layers are searchable, collapsible, and virtualized for large documents. Open shadow roots are included.
- Drag a layer onto a sibling to reorder it within the same parent. Cross-parent drops are blocked because they can change component structure.
- Foundry restores the selected locator after HMR when the mapped element still exists.

## Canvas navigation

- The embedded product is a fixed-size artboard. Its dimensions come from the selected project viewport, while Current uses the session viewport.
- Foundry opens the artboard at 100%. Dock and browser resizing never silently scales the product or changes its responsive breakpoint.
- Use Pan, Space-drag, or middle-drag to move around an oversized artboard. Trackpad scrolling pans the canvas in Select and Pan modes.
- Pinch or Command/Ctrl-wheel zooms around the pointer. The zoom menu provides Actual size, Fit, Fit width, and fixed percentage presets.
- Interact mode passes ordinary pointer and scroll input into the product. Space-drag and middle-drag still navigate the outer canvas.
- Pan and zoom are local presentation state. They never become design changes and never alter native rendered measurements.

## Layout and project intelligence

- Width and height expose fixed, hug, fill, and min/max intent alongside exact dimensions.
- Flow exposes relevant flex or grid controls, gaps, margins, padding, aspect ratio, position, and overflow.
- Linked padding edits all four sides. Tidy layout selects the nearest indexed project spacing values.
- Project token panels are searchable. A token applies to the last focused compatible property, and exact matches also appear beside individual fields.
- Token-only mode hides controls whose current value does not resolve to an indexed project token.
- Indexed component variants, typography presets, gradients, opacity, and live text contrast are contextual tools, not guesses about source architecture.

## Comparison and recovery

- Review, State workbench, Design health, and Design memory occupy the center workspace one at a time. Layers and Inspector remain the persistent navigation and property surfaces.
- Before and After replay the temporary preview ledger.
- The scrubber interpolates numeric values and switches discrete values at the midpoint.
- Side by side reloads a clean source baseline and applies the current preview ledger only to the After frame. If same-origin framing is blocked, keep comparison in the live page.
- Isolate dims unrelated content. Reset element restores the selected element and rejects its recorded session changes.
- Undo and redo include layer order. Command-K opens all major actions; Shift-L opens Layers; Shift-C opens comparison; brackets select parent and child.
- Design health and Design memory include explicit Close actions. Closing either returns to Canvas without discarding scan results, project memory, selection, or canvas position.

## Review boundary

Preview accuracy does not authorize source edits. A compact change summary stays anchored to the bottom-right of the workspace after the first edit. Review becomes a focused center-workspace mode that preserves approvals and edited values across visits.

Review the recorded target, semantic mapping, scope, context, project token, and impact message before submitting Apply with agent. Literal values remain visible as warnings when a project-native value is not used. Locate, Preview, and Compare temporarily return to Canvas. Application, rebuild, verification, mismatches, and authorized retries remain in the Review workspace mode.
