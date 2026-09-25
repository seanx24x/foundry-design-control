# Typography Studio refinement

The opt-in Next workspace uses a 300px font library, flexible comparison area and 300px Properties rail. Headers and footer are 44px; library rows and property fields are 32px. Central content has equal 24px insets, including when a scroll gutter is present.

## Workflow

- Discover fonts through the existing Project, Google and Local sources. Neutral library icons avoid pretending an unloaded family has rendered. Search has explicit no-results recovery; local-font permission remains user-initiated.
- Compare Current and Candidate with the existing acknowledged measurement operation and exact loaded font resources. Specimens share display scale without changing source geometry. Unmeasured or failed comparisons show placeholders, not fallback-font specimens or green clipping claims.
- Use this font remains disabled until measurement/loading succeeds. Clear comparison removes temporary comparison resources without staging a change. Local faces remain preview-only.
- Refine computed type values in Properties. Rhythm and type-scale previews, saved styles and source details expand inline. Type-scale ratio/step choices now survive rerenders until previewed, rather than being overwritten by the previous bridge snapshot.
- Page usage stays below comparison. Source paths, health limitations and Review/Apply boundaries are explicit.

Existing editing nodes are moved after listeners attach. Scroll position, disclosures and draft style names survive ordinary rerenders; focused editable fields are protected from replacement. Preview effects on Canvas are distinct from measured font-comparison snapshots.

## Verification

- Inspector build, typecheck and 106 inspector tests passed, including comparison-state, no-fallback, layout, handler ordering and scale-draft regression checks.
- Live Morrow headline comparison loaded Morrow Display and Morrow Sans, with paired 573×223 measurements and three lines each. Comparison and cancellation added no Review items.
- Search/clear recovery, Google catalog loading, Local permission guidance, inline disclosure retention and ratio/step draft persistence were exercised.
- Desktop light/dark and 1280×768 geometry checked: 300px rails, 32px fields, no horizontal page overflow, equal 24px central insets.
- Existing Review count stayed three. Local permission was not granted; Google-font loading into a comparison, source staging/apply, saving/removing styles and treatment/scale application were not exercised in this shared session.

This is a UI refinement and scoped verification, not full release certification.
