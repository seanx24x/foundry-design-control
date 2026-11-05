# Foundry Canvas pilot assets

These are byte-for-byte local copies from the approved isolated Foundry foundations study. There is no runtime third-party download. This directory is provenance, not permission to replace icons globally.

- `lucide/`: original SVGs at lucide-icons/lucide commit `a630cec77eac6568b989e87e4947a8bfe45caacd`; full ISC and retained Feather MIT notice in `lucide/LICENSE`. `source-checksums.json` retains the original study-relative paths and source URLs; each basename resolves within this directory.
- `approved-icon-map.json`: original semantic mapping, including 38 legacy names, additional contextual roles, and intentionally label-only Blur. Its historical scope/source references are preserved as provenance.
- `approved-property-icons.mjs`: original approved native 16px property diagrams. MIT notice in `foundry-LICENSE.txt`; historical study comments remain intact.
- `../../fonts/geist-sans.woff2`: original Geist variable font bytes from vercel/geist-font commit `2e554ff2ea3979b63afe770af6424eb8b9490a74`, hash `2ffebe993e969069a9789d15164b7715d42491b5835516c5e3b935d5f81b05f1`. Complete OFL notices and original provenance are adjacent as `geist-OFL.txt` and `geist-source.json`. Original study-relative paths in that JSON are provenance, not runtime paths.

`foundry-pilot-icon-data.js` extracts unchanged SVG path bodies/viewBoxes from these sources. `foundry-pilot-icons.js` adds decorative accessibility attributes and reversible, explicit Canvas-only contextual selection. Brand artwork remains held separately.

Integration: call `refineFoundryPilotIcons(root, { active: true, scope })` after existing icon rendering only for the authorized Canvas pilot. Call it on `document` with `active:false` before leaving the pilot; surviving SVG geometry/paint attributes are restored. Do not use a global MutationObserver or replace the legacy renderer. SVGs keep their original `data-foundry-icon` names, IDs, structural classes, and transforms.

The parent pilot stylesheet must own the 16px dimensions and Lucide 2-unit / property 4/3-unit root strokes. Never apply blanket paint rules to property-icon descendants: Opacity deliberately uses a `currentColor` fill and `stroke="none"` on its half-circle.

`foundry-pilot-fonts.css` only registers `Foundry Geist` (100–900); the integration gate chooses where to apply it. Inspected product iframe typography remains independent.
