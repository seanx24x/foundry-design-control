# Design System foundations

2026-10-30 · SCREEN-08 · implemented; hands-on acceptance remains open.

This presentation is now the default in the Next UI. The shared sidebar owns
desktop 320px width and compact/stacked composition.

2026-11-02 policy: `foundations=off` restores the previous Next presentation;
`foundations=pilot` remains a supported alias and `ui=legacy` stays excluded.
See [the current foundations contract](foundry-foundations-pilot.md). Earlier
validation below records the pilot phase, not publication or default acceptance.

## Ownership and evidence

- `app.js` still owns indexing, token/category/search selection, exports,
  component inspection and the durable Add plan to Review action.
- `next-design-system.js` preserves the original card/action nodes, per-token
  disclosure state, scroll positions and focus restoration.
- `foundry-pilot-system.js/css` adds presentation only. No transport, storage,
  source mutation, timers, or synthetic action dispatch is introduced.
- The main specimen labels its value as Canvas or indexed. Properties retains
  the authored value and exact source declarations, which may vary by theme.
  Usage data is an index, not verified rendered coverage.
- Context functions, inherited/system colors and relative lengths do not resolve
  against Foundry's own styles. They remain literal. Supported color, absolute
  radius/spacing and shadow samples are explicitly isolated, not product renders.
- Alias status stays visible when collapsed. Promotion impact is an intent,
  not a claim that an unapplied plan preserves output or has passed verification.
- All list swatches follow the same connected/indexed precedence as the specimen.
  Promotion names differentiate equal values across properties; category icons
  reuse local Lucide/property assets, with no fabricated shadow pictogram.

## Checks and limits

Inspector build, 246 tests and `git diff --check` passed. Live browser checks
covered light/dark, color/spacing/radius and literal specimens, empty searches,
clear-filter focus, category filtering, keyboard disclosures and per-token open
state restoration. Sampled 1642/1280px desktop, 1024px and 390px layouts had no
document/content horizontal overflow; local Geist loaded. Gate-off browser
inspection confirmed no pilot interior class and the prior 240px specimen.

Review remained at zero. Add plan to Review, Apply, re-indexing, export downloads,
offline transport changes and physical-device input were not invoked as part of
this visual pass. Helper tests cover source-value guard edge cases; they do not
claim a full live alias-failure, offline recovery or Apply journey. No release,
publication or source Apply is implied by that historical checkpoint.
