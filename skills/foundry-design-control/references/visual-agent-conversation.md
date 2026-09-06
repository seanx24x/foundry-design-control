# Visual Agent conversation

Use this workflow only for a request claimed through `foundry_design_wait_for_work` or `foundry_design_wait_for_visual_request`.

1. Read every attached rendered target, drawn region, contextual comment, source location, viewport, breakpoint, theme, state, measurement, token, and design-graph revision before proposing a direction.
2. Inspect the referenced source and project conventions. State when a source location, token mapping, responsive effect, or measurement is unresolved. Do not fill missing evidence with an approximation.
3. Explain the visual cause in plain language. Connect each conclusion to the rendered or source evidence that supports it.
4. Return one to three meaningfully different proposals. For each proposal include a concise name, summary, reasoning, exact values, affected source locations, responsive impact, a verification plan, and complete draft `DesignChange` records for previewable edits.
5. Keep each proposal internally coherent and independently previewable. Do not mix competing directions into one change list.
6. Do not edit source, approve changes, or choose a proposal for the user. `foundry_design_respond_to_visual_request` only returns isolated proposals to Foundry.
7. If the context is insufficient, return a clear explanation with no speculative changes. Ask for a narrower selection, region, state, or source mapping.
8. After responding, resume `foundry_design_wait_for_work`. The user may preview, reject, or promote a proposal. Only a later reviewed Apply run authorizes source edits.

If a claim expires, stop. Do not retry automatically. Foundry preserves the request and requires the user to authorize a retry. If an applied proposal fails rebuilt verification, report the exact requested and rendered values and wait for explicit retry authorization.
