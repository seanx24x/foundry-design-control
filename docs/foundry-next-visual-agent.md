# Foundry Next: Visual Agent refinement

## Scope

Next-only presentation refinement using the shared studio surfaces, typography,
300px side panels and 44px headers. No protocol, release or fixture changes.

## Structure

- Left: question history, count and explicit request status.
- Center: conversation with inline proposal evidence and a persistent question editor.
- Right: preview/listener connection, context for the next question, and separately
  labelled context captured with the selected question.
- Footer: proposals remain separate from Review until explicitly chosen; source
  changes still require reviewed Apply.

The original form and proposal action nodes are retained, preserving their existing
acknowledged command paths. Advanced proposal evidence expands inline. Long titles
and source paths wrap, and independently scrolling areas preserve position on refresh.
The conversation resets to the top when switching questions.

## Interaction safeguards

- Empty, disconnected, context-free or pending submissions are disabled.
- A connected listener is not described as working until a request is claimed.
- Offline listeners permit durable queueing when the live preview is connected.
- Completed advice-only replies remain completed, not waiting for a listener.
- New question opens a new-question view without clearing an unsent draft.
- Duplicate submission is guarded. An acknowledgement only clears the submitted
  text if the user has not typed a different draft while awaiting it.
- Submission errors stay visible and preserve entered values.

## Verification

- Inspector build and syntax/typecheck pass.
- 148 inspector tests pass, including 8 focused Visual Agent tests.
- `node scripts/test-next-visual-agent-fixture.mjs` serves an isolated fixture on
  localhost:4689. It uses the real renderer, helper and submit handler with a mocked
  request transport. Its 19 browser assertions pass for captured context, proposals,
  advice-only completion, claimed/queued/interrupted states, draft preservation and
  duplicate submissions. It does not connect to a real session or agent.
- Rendered light/dark layouts inspected at 1280×768; light inspected at 1920×1080.
  Long title wrapping corrected; no document horizontal overflow at compact width.
- Live workspace New question preserves draft and focus; own test draft removed.
  No live requests submitted or proposals promoted. Existing three Review changes
  preserved. Actual remote agent execution/source application is not retested here.

Fixture icons are stubbed; live workspace supplies the shared icon renderer.
