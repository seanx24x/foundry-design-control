# State workbench

Treat each recorded breakpoint, theme, variant, pseudo-state, and motion preference as part of the requested value.

## Web verification

- Use Foundry's same-origin live frames for real media-query viewport measurements.
- Apply registered theme attributes or classes before measuring.
- Use forced hover, focus, active, or disabled rules only when the adapter reports them as reproducible from same-origin stylesheets.
- Verify reduced-motion changes with the recorded motion preference and inspect the real source fallback.
- Wait for stable geometry before measuring each state.

If framing, a cross-origin stylesheet, application state, or component variant cannot be reproduced safely, report that state unsupported. Do not pass it using the current viewport as an approximation.
