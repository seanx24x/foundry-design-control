# Motion Studio

Use Motion Studio when a rendered interface contains motion that must be understood, tuned, or verified against its source.

## Discover rendered motion

1. Select the animated target on the Canvas, then open **Motion studio** from the workspace menu or command palette.
2. Treat the live browser and timeline as views of the same registered CSS animation, CSS transition, or Web Animation.
3. Preserve the source type, duration, delay, easing, iterations, direction, fill mode, animated properties, and keyframes exactly as reported by the adapter.
4. Use the performance tier and reduced-motion status as evidence. Do not infer compositor safety or accessibility coverage from an animation name alone.

## Preview without recording changes

Play, pause, replay, loop, speed, and timeline scrubbing are presentation controls. They must never enter the change ledger, modify source, or become part of an Apply run. Keep the selected motion and playhead synchronized between Motion Studio and the Inspector.

## Edit timing and keyframes

- Timing edits may update duration, delay, easing, iterations, direction, and fill mode.
- Keyframe edits preserve the selected property, offset, value, and segment easing.
- Route edits through the normal bridge so they coalesce by target, property, scope, breakpoint, theme, and state.
- Require exact source mapping before promoting an edit beyond the selected instance.
- Never replace a project easing token or motion convention with an unexplained literal when a matching native value exists.

## Review motion health

- Prefer transform and opacity when the intended effect can remain on the compositor.
- Flag layout- or paint-heavy properties as evidence, not as automatic rewrite instructions.
- Treat a matching `prefers-reduced-motion` rule or an intentionally short duration as reduced-motion coverage.
- Preserve unsupported or ambiguous motion as a finding and ask the user to choose the intended source behavior.

## Verify after apply

1. Rebuild the real application.
2. Reopen the same target, viewport, theme, breakpoint, and state.
3. Confirm the requested timing and keyframe values from the rendered animation snapshot.
4. Replay the full motion and inspect the start, intermediate, and end states.
5. Confirm transport and scrubbing still leave the change ledger untouched.
6. Recheck performance classification and reduced-motion coverage, then report any mismatch instead of silently normalizing it.
