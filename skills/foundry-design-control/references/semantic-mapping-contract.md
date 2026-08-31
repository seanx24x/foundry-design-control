# Semantic mapping contract

Use a direct-manipulation operation as the record of user intent. Its preview is evidence of the requested result, not permission to reproduce that result with arbitrary CSS.

## Resolution

- One candidate may be selected automatically when the layout model has one exact source interpretation.
- Multiple candidates require the user's choice in Foundry. Do not select one for them.
- `unresolved` operations cannot enter an apply run.
- Use the chosen candidate's property, source, scope, evidence, and blast radius when inspecting source.

## Layout safety

- Preserve block, flex, grid, and positioned layout semantics.
- Do not introduce absolute positioning or transforms to imitate a resize, alignment, or spacing gesture.
- For flex-axis resize choices, distinguish an explicit dimension from `flex-basis`.
- Apply alignment or distribution to the narrowest container or selected items described by the operation.
- Preserve component scope. Do not promote an instance edit into a shared token or component default.

## Tokens

Prefer the recorded project-native token when its current indexed value still matches. If its source or value changed after review, stop and request reconfirmation instead of substituting a literal.
