# Content Stress Lab foundations

SCREEN-14 uses the default Next foundations. The source project is unchanged.
Shared sidebar/chrome remain authoritative.

2026-11-02 policy: `foundations=off` restores the previous Next presentation;
`foundations=pilot` remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

## Composition

- The 320px desktop sidebar holds scope and draft conditions. Visible descriptions
  and checkbox-like selection marks make each test understandable before running.
  Product-state exclusivity remains in the original condition handlers.
- The existing live preview stays above the findings list. Selected-layer and
  full-viewport framing remain separate from scope selection. Applied-condition
  status is distinct from sidebar drafts.
- Findings retain severity and source grouping. Compact rows lead into original
  evidence and correction controls in the right rail. The filter strip uses one
  lower divider, not another line directly beneath the heading.
- A quiet status block leads Evidence and correction. Scan totals are not an
  accessibility pass. Correction actions keep their explicit Review consequence.
- Approved Geist 12/20 controls, 11/18 metadata, Lucide, 32px inputs and 6px control
  corners carry the established design direction. No new palette or type system.

## Ownership and preview clipping

`app.js` owns draft choices, transport acknowledgements, scans, restore and durable
corrections. `next-stress-lab.js` retains composition, focus/scroll restoration,
finding selection, evidence labels and fitting. `foundry-pilot-stress.js/css`
decorates existing nodes without replacing action handlers or changing data.

The live preview is the original Canvas iframe, not a clone. It stays in its
original DOM location, with the existing CSS overlay/transform and pointer guard.
The pilot shell uses `display: contents`; measuring it as a clipping box returned
zero dimensions and hid the entire preview. Pilot clipping now uses the visible
root intersected with header/footer body limits. Nonpilot clipping is unchanged.
No iframe is recreated, reparented, resized intrinsically or reloaded by this fix.

## Evidence and action boundaries

- Profile/scope choices are drafts until Run conditions acknowledges success.
  Scan current state measures the current preview and does not apply drafts.
- Restore original clears drafts only after the existing clear command succeeds.
- Temporary conditions do not add Review edits. Previewing a correction does,
  through the original durable action; source remains unchanged until Apply.
- Scan freshness, busy, error, offline and source-mapping disclaimers are retained.
  Source-unmapped preview correction is not evidence of an established mapping.
- Existing guard gap: correction availability does not directly check current
  error or missing scannedAt. Failed actions may retain prior findings. This is
  tracked separately as a functional follow-up, not claimed fixed by styling.

## Validation boundary

Live layout and read-only scan/framing checks are separate from the isolated
synthetic fixture's state matrix, transactions and failure simulation. Neither
certifies actual-device input, source Apply or full accessibility compliance.
User visual/hands-on acceptance and publication remain separate gates.
