# Real framework compatibility matrix

These private fixtures complement the existing Morrow golden path. They compile and render actual React/Vite, Next.js App Router and Storybook/CVA projects with nested components, CSS Modules, shared tokens and authored contexts.

Run after `pnpm build`:

```sh
node scripts/test-framework-compatibility.mjs --mode workspace
node scripts/test-framework-compatibility.mjs --mode packed
node scripts/test-framework-compatibility.mjs --mode registry
```

Use `--fixture react-vite`, `--fixture next-app` or `--fixture storybook-cva` for a focused run. The matrix owns runtime port 4487 and preview port 4490 by default; use `--runtime-port` and `--preview-port` to change them. It never stops an existing server. Run the Morrow release gate separately through `pnpm test:golden:packed`.

Packed mode requires the sealed artifacts for the current checkout. Registry mode targets the version in `release.json` and is a post-publication gate for the matching implementation, including alternate runtime port support. Workspace mode is the development gate and does not claim to validate an already published package.

Each fixture is copied into an isolated temporary Git project with an isolated npm cache. The runner installs the exact framework versions, executes public Foundry setup, builds production assets, launches the real CLI/runtime and MCP server, and uses the browser to stage and review the 40px-to-44px correction. A named MCP agent validates the frozen review and source proof, changes one CSS declaration, rebuilds the framework and waits for browser-origin verification. Delivery and History must agree with the measured result. A flex sizing ambiguity must remain unresolved and be rejected by Apply.

The fixtures use explicit current source annotations. This proves that mapping survives CSS Modules compilation and framework rendering; it does not claim automatic inference for every third-party component. Storybook additionally needs the documented `.storybook/preview-head.html` integration. Same-origin CSS is required for authored pseudo-state replay. The matrix also sends a real `X-Frame-Options: DENY` response and verifies recovery in the direct overlay with the same session and source mapping.

Machine-readable evidence is written to `artifacts/compatibility/<mode>.json`. Capabilities start as untested and become verified only after their checks run. Failed diagnostics are retained in the reported temporary directory; successful temporary projects are removed. No package publication, source upload or host agent configuration is performed.

## Current evidence

The development checkout passed all three workspace-mode and packed-mode cases on 2026-09-15. The reports record the installed package versions, source and applied revisions, measured 44px result and verified Delivery outcome. Packed cases also verify each reviewed context, matched before/rebuilt source-image pairs and authenticated image retrieval. This is evidence for these explicit fixtures and versions, not a claim about every application built with these frameworks.

| Fixture                          | Resolved framework packages                                      | Workspace | Packed | Public registry              |
| -------------------------------- | ---------------------------------------------------------------- | --------- | ------ | ---------------------------- |
| React with CSS Modules           | React/React DOM 19.3.0, Vite 8.3.0                               | Passed    | Passed | Pending matching publication |
| Next App Router with CSS Modules | Next.js 16.3.5, React/React DOM 19.3.0                           | Passed    | Passed | Pending matching publication |
| Storybook component library      | Storybook/react-vite 10.6.0, CVA 0.7.1, React 19.3.0, Vite 8.3.0 | Passed    | Passed | Pending matching publication |

Verified in every fixture: authored root themes, temporary hover and data-attribute variants, mobile/desktop geometry, one reviewed source correction, actual framework rebuild, browser-origin verification, Delivery/History linkage, ambiguous flex sizing rejection, and direct overlay recovery when framing is denied. Storybook additionally verifies indexed CSF stories and the CVA tone axis.

Capabilities requiring instrumentation remain explicit: exact source mapping uses current `data-foundry-source` annotations, and Storybook loads the adapter through its authored preview head. Cross-origin stylesheet pseudo-state replay is unsupported. Unmeasured framework features, routes and versions remain untested.

## CI and release gates

`pnpm check` includes the fixture source and capability contract tests. CI and release jobs reuse their existing sealed release artifacts for the packed framework matrix after the Morrow gates. The release job also runs the registry framework matrix after immutable package verification and the public Morrow golden path, before promoting `latest`. Both jobs retain the JSON evidence reports even when a later gate fails. No extra root dependency installation or repacking is added by the compatibility gates.
