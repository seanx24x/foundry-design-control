# Motion Studio

Use Motion Studio when a rendered interface contains motion that must be understood, tuned, or verified against its source.

## Discover rendered motion

1. Select the animated target on the Canvas, then open **Motion studio** from the workspace menu or command palette.
2. Treat the live browser and timeline as views of the same registered CSS animation, CSS transition, Web Animation, Motion for React animation, GSAP tween, or React Spring animation.
3. Preserve the source type, duration, delay, easing, iterations, direction, fill mode, animated properties, and keyframes exactly as reported by the adapter.
4. Use the performance tier and reduced-motion status as evidence. Do not infer compositor safety or accessibility coverage from an animation name alone.

## Preserve project-native motion

Foundry indexes Motion for React, GSAP, and React Spring authoring sites and associates the nearest source-backed preset with an instrumented element. For the strongest runtime evidence, register the actual animation or an equivalent preview on the rendered element:

```ts
import { registerNativeMotion } from 'foundry-design-web-adapter';

registerNativeMotion(element, {
  adapter: 'motion',
  from: { opacity: 0, y: 12 },
  to: { opacity: 1, y: 0 },
  transition: { duration: 0.48, ease: [0.16, 1, 0.3, 1] },
  source: { file: 'src/PrimaryAction.tsx', line: 18 },
});

registerNativeMotion(element, {
  adapter: 'gsap',
  from: { x: -24, opacity: 0 },
  to: { x: 0, opacity: 1 },
  config: { duration: 0.6, ease: 'power2.out' },
  source: { file: 'src/Panel.tsx', line: 32 },
});

registerNativeMotion(element, {
  adapter: 'react-spring',
  from: { y: 16, opacity: 0 },
  to: { y: 0, opacity: 1 },
  config: { mass: 1, tension: 210, friction: 24 },
  source: { file: 'src/Notice.tsx', line: 14 },
});
```

- Keep seconds in Motion and GSAP source. Foundry displays milliseconds but records the native `transition.duration` or `vars.duration` property path.
- Preserve React Spring's physical `mass`, `tension`, and `friction` values rather than flattening the source into a guessed duration.
- Keep Motion `animate` and `variants`, GSAP `vars`, and React Spring `from`/`to` semantics in Apply evidence.
- A runtime preview is presentation state. Source changes still enter the existing Review and Apply flow and require rendered verification.

## Preview without recording changes

Play, pause, replay, loop, speed, and timeline scrubbing are presentation controls. They must never enter the change ledger, modify source, or become part of an Apply run. Keep the selected motion and playhead synchronized between Motion Studio and the Inspector.

## Edit timing and keyframes

- Timing edits may update duration, delay, easing, iterations, direction, and fill mode.
- Keyframe edits preserve the selected property, offset, value, and segment easing.
- Route edits through the normal bridge so they coalesce by target, property, scope, breakpoint, theme, and state.
- Require exact source mapping before promoting an edit beyond the selected instance.
- Never replace a project easing token or motion convention with an unexplained literal when a matching native value exists.

## Shape timing curves

- Use the dedicated **Bezier** editor for CSS cubic Bezier timing. Drag either control point, use its keyboard-accessible handle, enter exact X and Y values, or start from a preset.
- Preserve all four cubic Bezier coordinates. Preview the resulting travel independently, then record the exact `cubic-bezier(x1, y1, x2, y2)` value through Review.
- Use the dedicated **Spring** editor to tune mass, stiffness, damping, and initial velocity. Show settling duration and overshoot so the physical response is understandable before it is recorded.
- CSS has no portable `spring()` timing function. For web targets, keep the exact physical parameters in the live Foundry curve model and generate a deterministic CSS `linear()` approximation for preview, Review, apply, and rendered verification.
- Treat presets as starting points, not hidden tokens. Every preset must resolve to visible editable values.
- Curve playback is temporary presentation state. It must never create a design change until the user changes a curve value.
- Respect reduced-motion preferences in the curve preview while retaining the authored curve values for inspection.

## Author motion paths

- Use the dedicated **Motion path** editor when at least two rendered transform keyframes expose pixel-based translation values.
- Drag a path point, use Arrow keys for one-pixel changes, hold Shift for eight-pixel changes, or enter exact X and Y coordinates.
- Preserve scale, rotation, and matrix coefficients when translation changes. Do not convert percentage or otherwise unresolved transforms into guessed pixels.
- Record path edits as the corresponding transform keyframe value so Review, source mapping, undo, and rebuilt verification keep using the existing keyframe contract.
- Show native path bounds and total travel distance as inspection evidence. Path geometry is not a new production artifact by itself.

## Compare before and after in sync

- Capture the source baseline once, immediately before the first timing, curve, or keyframe preview change.
- Draw the source baseline and current preview in one coordinate system. Use one playhead for both paths and evaluate each animation with its own timing curve.
- Playback, replay, and comparison scrubbing are presentation state. They must not enter Review or mutate the live product animation.
- Report duration, travel-distance, and keyframe-count deltas without claiming that a larger or smaller value is automatically better.
- If either side lacks a resolvable path, retain the timing and keyframe editors and explain why path comparison is unavailable.

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
