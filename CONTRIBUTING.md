# Contributing

Foundry is an early beta. Focus contributions on a precise, dependable design-in-code loop: inspect, review, apply, rebuild, and verify.

## Local development

1. Install Node.js 20 or newer and pnpm 10.
2. Run `pnpm install`.
3. Run `pnpm check` before proposing a change.
4. For browser-facing changes, run the web fixture and verify the complete review, apply, and rendered-result workflow.

Keep the runtime loopback-only, preserve explicit user review before source application, and never add telemetry or a cloud dependency without prior product discussion.

Open an issue before a large architectural change so the approach can be agreed before implementation.
