# Change contract

Foundry protocol `1.3.0` uses these durable objects:

- `SessionContext`: project root and revision plus platform, target, device or viewport, theme, breakpoint, and state.
- `TargetRef`: stable ID, role, label, component path, optional source reference, live geometry, locator evidence, and confidence.
- `ControlDescriptor`: property, category, value type, constraints, tokens, and preview support.
- `DesignChange`: target, before/after values, unit or token, instance/component scope, exact capture context, affected breakpoint/theme/state context sets, evidence, status, and timestamps.
- `DesignOperation`: one canvas gesture or command, its targets, state set, ranked source mappings, selected mapping, and resolution status.
- `SourceMappingCandidate`: semantic intent, property, source, confidence, evidence, and component blast radius.
- `ProjectDesignGraph`: revisioned local tokens, components, variants, breakpoints, themes, states, and motion presets with provenance.
- `ChangeSet`: session context, coalesced ordered changes, semantic operations, graph revision, screenshots, and protocol version.
- `PreviewContext`: versioned viewport, theme, state, motion preference, selected target, request revision, supported capabilities, and the last acknowledged application result.
- `VerificationResult`: requested and rendered values, exact context, pass state, reason, geometry, and screenshot evidence.
- `ApplyRun`: an immutable frozen reviewed change contract, private claimant authority, baseline-relative source proof, exactly one Apply-result acknowledgement, attempt-bound verification, retries, and terminal state.

## Confidence

- `instrumented`: a development adapter supplied a stable ID or source location.
- `measured`: Foundry measured live geometry and computed values but source mapping may require agent resolution.
- `inferred`: the connected agent enriched semantics from evidence.
- `unresolved`: no trustworthy source mapping exists. Do not apply automatically.

## Status

`draft` changes remain preview decisions. `approved` changes may be implemented. `rejected` changes remain in history but are excluded from export. `applied` means a source diff exists. Status does not imply verification.

Review deletion is separate from rejection. Deletion permanently removes an unapplied, unqueued change from the local session and requires a connected adapter that can restore the recorded `before` value. A change referenced by an `ApplyRun` remains immutable so the run audit trail cannot be rewritten.

## Coalescing

Use `target + property + scope + affected breakpoint/theme/state context sets + state set` as the key. Preserve the original exact capture context and `before` value, then keep the final `after` value. Keep other scopes separate.

Sessions written as `1.0.0` or `1.1.0` migrate with empty operations and no design graph. Protocol `1.2.0` changes migrate their exact capture context into singleton breakpoint, theme, and state context sets. Never synthesize semantic evidence during migration.
