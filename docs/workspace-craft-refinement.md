# Workspace craft refinement — 5 November 2026

Scope: the five follow-ups approved after the Inspector refinement audit. This
is an application UI pass in `feat/inspector-control-refinement`, not a release,
source Apply, website change, animation update or expansion of authoring APIs.

## Implementation checklist

- [x] Shared field grammar across Typography and Motion: compact pairs where
      values fit, full-width singleton/named long fields and selects, explicit units,
      one focus treatment, bounded validation messages and full-field menu anchors.
      Existing native inputs, values, listeners and disabled states remain owned by
      the original renderers. Exact CSS is not normalized to fit a field.
- [x] Motion easing composition: graph, presets, coordinates and diagnostics are
      grouped together. Types, presets, typing and handle gestures edit a local
      draft. **Use easing** alone runs the existing acknowledged authoring action;
      **Cancel** clears the draft without a Review transaction. Failed persistence
      restores the native product through the existing rollback path and retains the
      draft for retry. A changed native easing invalidates acceptance until Cancel
      and reinspection. Busy submissions cannot be duplicated. Local curve samples
      use the same canonical sampler as the adapter, not separate spring math.
- [x] Color, gradient and position dialogs share material, spacing, help
      disclosure and action-footer treatment. Validation/status remains visible;
      help IDs and original controls are retained. No new color-space capability,
      unsupported gradient conversion or fake successful state is introduced.
- [x] Supporting copy is collected into contextual disclosures in studio rails,
      State coverage, saved Memory references and variant properties. Read-only
      facts are unboxed and labelled separately from controls. Visual Agent has one
      visible connection owner rather than repeating it inside attached context.
      Errors, capability blockers, connection state, requested/applied evidence and
      provenance are not demoted. No arbitrary global paragraph suppression.
- [x] Compact-screen libraries collapse behind a selected-item row; keyboard
      activation, aria-expanded and original library controls are preserved. Desktop
      rails retain 320px. Property-pane headings stick only within their section on
      desktop, with one heading rather than a stack; compact stacked panes use normal
      flow. Direct-manipulation geometry stays synchronous, including reduced motion.

## Boundaries

Local easing illustrations are not rendered product previews. Product playback
requires accepted easing; source still requires reviewed Apply. Indexed token
coverage, saved Memory references and authored gallery values are not upgraded to
verified live evidence. Helpers never write canonical values or send commands.

Unimplemented Scaena follow-ups remain listed separately: hold-to-explain help,
capability-safe wide-gamut/eyedropper support, additional gradient authoring and
supported direction/version actions. This pass does not claim every reference
feature or every possible native layout/input combination is shipped.

## Verification

Evidence is recorded locally under ignored `artifacts/inspector-controls` and
`artifacts/next-workspace`. The dedicated Inspector fixture uses synthetic
acknowledgements and no project source. The broader regression uses an actual
CLI/adapter session and disposable Morrow copy; it verifies rendered effects and
Review transactions without applying source edits.

Verified:

- Full build and workspace type checks pass. All **940 unit/contract tests** pass
  (564 Inspector).
- The real CLI/adapter regression passes **115 checks**, including native effects,
  exact Review changes, cancellation, persistence failure, stale easing drafts,
  full-field studio menu geometry and keyboard-operated compact libraries.
  Disposable source remains unchanged and no browser exceptions are recorded.
- The isolated fixture passes **seven check groups and ten theme/viewport
  views** (1440, 1024, 720, 390 and 320px in both themes). It also exercises normal
  and reduced-motion geometry, retained handlers/values, non-hidden errors and
  capability blockers, idempotent help and mixed/advanced position values.
- Fresh desktop/phone screenshots were inspected for Motion, Typography, token
  evidence, Component Workshop, State, Agent and Memory. The existing private
  Inspector-only fixture was refreshed and inspected over HTTPS in both themes;
  it is not a connected whole-product session.
- Formatting and `git diff --check` pass. Nothing was committed, pushed or
  published, and the website and approved film were left untouched.

Physical-device and screen-reader acceptance, user visual approval and a separate
Git/npm release decision remain outside automated browser proof. The full
regression report is retained at
`artifacts/inspector-controls/workspace-craft-full-report.json`; the normal
workspace report may be replaced by subsequent focused diagnostic runs.
