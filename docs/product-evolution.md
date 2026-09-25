# From first connection to ongoing design quality

These changes extend Foundry's reviewed design workflow. They are not a new published release.
The existing Canvas and studios remain the working environment.

## Connect and recover

Run from the product repository:

```sh
foundry-design doctor --json
foundry-design start
```

Use the connection status or next-step control in the Foundry application bar to open
**Connection & first edit**. Configuration, runtime response, actual preview heartbeat,
source mapping, current source revision and the active MCP listener are separate checks.
A configured agent is not necessarily listening.

Recovery never silently executes a terminal command. Configuration repair is an explicit
`foundry-design doctor --repair` action. Agent restart instructions require the user to restart
the coding-agent session and ask it to listen again. Preview retry requires a new acknowledgement.
Re-indexing preserves the previous graph on failure.

Compatible sessions preserve their drafts and reviewed state. Successful, fully verified
application advances the editing baseline to the acknowledged source revision. An unrelated
source change does not silently become the new baseline.

## First reviewed edit

1. Select a visible, source-mapped layer in Canvas.
2. Refine one measured value. The preview is temporary.
3. Open Review and check exact values, source location and every affected context.
4. Apply with the connected agent after review.
5. Wait for source validation, rebuild and actual rendered verification.
6. Open Delivery to inspect the frozen engineering contract and evidence.

The application bar shows the next relevant step, including queued work, failures and
verified handoffs. Navigation does not reset the selected target, contexts or changes.

## Engineering handoff

Delivery distinguishes:

- **Authored intent:** narrative, risks and open questions are editable before verification.
  Verified and superseded Delivery records are read-only, preserving the narrative alongside
  the evidence that shipped.
- **Reviewed contract:** frozen targets, source locations, before/requested values and context sets.
- **Measured outcomes:** results from the correct Apply attempt and exact context, not an optimistic flag.
- **Recorded screenshots:** source baseline and rebuilt captures with target, viewport, context,
  source revision, browser, platform, motion preference and image hash.

Completion releases the active agent lease while retaining the acknowledged attempt identity
used to validate historical evidence. Missing or contradictory evidence cannot be presented as passed.

Capture uses an isolated browser at the product URL without Foundry session credentials or staged
overlay state. Only supported authored hooks are used. Unavailable browser, unsupported state,
revision changes or capture failures are recorded explicitly; they do not manufacture images.
Before/rebuilt pairs require matching capture conditions. Images load through session-authenticated,
record-indexed requests and are validated against their hash and dimensions.

Portable exports bundle safe local evidence and an engineering brief. Existing human-edited
documents remain protected by the export manifest. History records verified outcomes; milestones
group those records without inventing additional results.

## Repeatable visual checks

See [Visual checks](visual-checks.md) for registration, capture, explicit approval, masks,
supported contexts, local report paths and exit codes. The Delivery **Visual checks** tab reads
saved reports. It never approves baselines or edits source.

Pixel differences are review signals, not automatic design judgments. Browser/platform mismatch,
unavailable content and unsupported contexts remain explicit.

## Compatibility and validation

The [compatibility matrix](../examples/compatibility/README.md) tests actual framework projects,
not only simulated adapter responses. Keep the Morrow golden path as the main release demonstration
and use the framework matrix for breadth.

Local gates:

```sh
pnpm check
pnpm test:e2e
pnpm release:pack
pnpm release:test-install
pnpm test:golden:packed
pnpm test:golden:negative
pnpm test:compatibility:packed
```

Public registry gates can only validate these changes after a separately approved immutable
release. CI runs them before any latest-tag promotion. Do not claim registry validation of
unpublished work.

## Design parity and scope

Use Google Sans Flex and Google Sans Code, bundled locally with their licenses. Preserve the
existing neutral/orange system, Keyline vectors and 4px layout foundation. New workflow surfaces
have editable Light/Dark Figma versions at 1920×1080 and 1280×1080, checked against measured
browser references. Figma examples describe UI states; screenshots of a UI test are not evidence
that a source change was verified.

Desktop companion development and Codex, Claude and Cursor submissions remain the next planning
track. No publishing, external source control writes, directory submissions or background monitors
are triggered by this implementation.
