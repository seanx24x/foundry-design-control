# State Workbench foundations

SCREEN-12 uses the default Next foundations. Shared navigation, the 320px desktop
sidebar and responsive shell retain their existing ownership. The connected
product source is unchanged.

2026-11-02 policy: `foundations=off` restores the previous Next presentation;
`foundations=pilot` remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

## Composition

- The sidebar lists authored states with their inspection status, then coverage
  for the selected context, followed by viewport, theme and motion controls.
- The center remains the actual isolated product preview, fitted by the original
  engine. It does not pretend to be the Canvas or show fabricated evidence.
- The Evidence rail starts with the current inspection outcome, then selected
  target, requested conditions and expandable axis-by-axis application evidence.
- Requested state is explicit. Connection is shown in the preview header/footer,
  not repeated as a requested condition. The original connection node remains.
- Geist 12px/20px controls, 11px/18px metadata, 32px fields, 6px corners, neutral
  surfaces and Lucide glyphs follow the approved system. Spacing and single
  section boundaries carry hierarchy; status color is not a certification.

## Ownership and truthfulness

`app.js` retains authored state choices, context requests, frame transport,
measurements, export and preview fitting. `next-state-workbench.js` retains exact
context matching and evidence precedence. Its gated pilot hooks call
`foundry-pilot-state.js` only to reparent/decorate presentation. CSS remains scoped
to the State Workbench pilot interior.

Changing a state or condition automatically requests an inspection in a separate
iframe. The existing Inspect condition button repeats that inspection. There is
no Add to Review or Apply action here: Canvas and source stay unchanged.

Connected is not inspected. Evidence must match viewport ID and dimensions,
theme, state, motion preference, target ID and target selector. Pending, offline
and matching failure take precedence over earlier success. Inspection coverage
is not a full visual or accessibility audit. The existing model retains this
distinction; the pilot does not synthesize or promote result status.

Original select nodes, custom-control wrappers, listeners, frame identity/source,
intrinsic dimensions and scale remain untouched. Update decoration is idempotent
and retains open disclosures when evidence has not changed. Rebuilding the app's
state grid mounts a fresh body through the original lifecycle.

## Validation boundaries

Use the live project for actual authored-state switching and layout checks.
Use the explicitly synthetic localhost fixture for offline, pending, failed and
stale evidence. Fixture results validate presentation/ownership, not the real
transport or a source Apply journey. User hands-on acceptance remains separate.

## Separate known follow-up

The pre-existing Export matrix implementation retrieves results using a key that
omits viewport dimensions and target selector, without the exact-context guard
used by the UI. A later functional fix must exclude stale measurements when those
values change. This visual migration does not certify or change export behavior.
