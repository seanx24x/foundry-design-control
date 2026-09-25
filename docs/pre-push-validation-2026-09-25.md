# Foundry Next: pre-push validation

Date: September 25, 2026

Branch: `feat/foundry-next-inspector`. Base HEAD: `75fee29`.

## Outcome

The local validation gates below pass for the uncommitted Foundry Next worktree.
This is readiness to commit and push for CI review, not a published-release claim.
No push, merge, npm publication, tag promotion, or default-UI change was performed.

The package metadata remains `0.2.0-beta.22`. The locally packed artifacts contain
the new working-tree changes and must not be described as the already-published
beta.22 build or used to overwrite that immutable version.

## Fixes from this pass

- Fixed a real inspector regression: a disconnected or reloading preview cleared
  the bridge snapshot, which could discard the selected component and its pending
  variant during an attempted local edit. The inspector now retains the last
  snapshot while disconnected, keeps the candidate available for retry, and still
  reports the failed preview honestly. A fresh snapshot replaces the cache.
- Formatted the previously failing source, tests, and audit documentation.
- Made the shared real-browser harness and its recording, showcase, and Next
  consumers honor isolated runtime and preview ports consistently, including MCP
  connections and fixture adapter URLs.
- Updated stale browser assertions for the current selection tokens, 8px paired
  field gap, disclosure-based source details, Verified state, connection-readiness
  control, conversation return action, and selectable read-only Delivery text.
- Corrected source-height assertions to measure preview CSS pixels separately
  from the workspace canvas zoom. The reviewed values, source diff, rebuild,
  browser verification, Delivery, and History assertions remain enforced.
- Replaced an unbounded responsive-cleanup observer in the browser harness with
  a bounded polling assertion and added a default action timeout. The same cleanup
  requirement remains asserted; a failure can no longer hang that wait indefinitely.
- Fixed the negative-path fixture copy filter to inspect paths relative to the
  fixture, so a checkout inside a `.codex` ancestor is not excluded wholesale.
- Added `pnpm test:next` to CI and the release gate, retained its regression
  evidence as an artifact, and corrected the showcase evidence upload path.

## Completed local checks

| Gate                            | Result | Scope / evidence                                                                                                                                                                                               |
| ------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                    | Pass   | Formatting, builds, typechecks, 4 compatibility contract tests, and 552 package tests                                                                                                                          |
| Next inspector browser suite    | Pass   | 38 checks; actual CLI/adapter; selection categories, edit/undo/reset, invalid input, mixed values, variants, offline retention, light/dark at 1080px and 768px heights; `artifacts/next-workspace/report.json` |
| Workspace Playwright suite      | Pass   | Canvas and studio navigation, responsive layouts, Review, Apply, Delivery, read-only evidence, visual-check report escaping                                                                                    |
| Recording rehearsal             | Pass   | CLI restart, durable Review, real one-line source Apply, rebuild, browser verification, Delivery/History, and six rebuilt reload checks; `artifacts/recording-rehearsal/report.json`                           |
| Real showcase                   | Pass   | 29 checks across the studios and MCP Visual Agent; project source unchanged; `artifacts/showcase-1920/report.json`                                                                                             |
| Experience slice                | Pass   | 10 checks including navigation, theme/viewport layouts, comparison, 200% text, and real MCP Apply/rebuild/Delivery; `artifacts/experience-slice/report.json`                                                   |
| Isolated negative paths         | Pass   | Offline listener stays queued, intentional 42px mismatch is not verified, disconnection retains reviewed work; `artifacts/refinement/negative-path/report.json`                                                |
| Packed positive path            | Pass   | Fresh seven-package install, actual reviewed 40px to 44px source change, full Morrow fixture tests, rebuilt measurements, matched source-image evidence, verified Delivery and History                         |
| Packed negative paths           | Pass   | Offline listener, disconnected preview, and verification mismatch; none reports a false verified result                                                                                                        |
| Packed framework compatibility  | Pass   | React/Vite/CSS Modules, Next.js App Router/CSS Modules, Storybook/CVA; source Apply, rebuild, browser verification, and ambiguity rejection; `artifacts/compatibility/packed.json`                             |
| Packed installation matrix      | Pass   | Fresh setup/update/uninstall for Codex, Cursor, and Claude Code, plus a second project sharing the connection                                                                                                  |
| Release checks                  | Pass   | 10 artifact contract tests, aligned metadata, release safety guards, seven-package trusted-publisher configuration contract                                                                                    |
| Distribution and desktop bundle | Pass   | `pnpm distribution:check` and `pnpm mcpb:build`                                                                                                                                                                |
| Packaging integrity             | Pass   | Seven local tarballs packed and verified against the source-state manifest                                                                                                                                     |
| Whitespace                      | Pass   | `git diff --check`                                                                                                                                                                                             |

Browser evidence was captured locally; the Next inspector light/dark screenshots
were also inspected visually. The browser suites use Chromium. This does not claim
Safari/Firefox coverage, arbitrary-project compatibility, native-platform parity,
or pixel-perfect parity with every Figma screen.

The `agent-browser` executable was unavailable, so the project's Playwright
harnesses provided browser validation. Test fixtures and agent homes were disposable.
The user's existing Morrow recording project and live 4587/4590 processes were not
replaced. Local preview credentials and session files must remain excluded from Git.

## Before release

1. Review and commit the complete intended worktree, including new source, tests,
   fonts/licenses, documentation, and scripts. Push this feature branch and require
   green hosted CI before merging. Local checks are not a hosted-CI result.
2. Decide whether Foundry Next remains opt-in through `ui=next` or becomes the
   default. This pass deliberately does not change that behavior.
3. Choose an unpublished release version, sync metadata and release notes, and
   rebuild/reseal artifacts after the final commit/version change. The current
   integrity manifest is tied to the current HEAD and non-ignored file contents.
4. Use the guarded main-branch release workflow. Live trusted-publisher/OIDC
   authentication, public-registry verification, registry golden-path checks,
   GitHub release assets, and any `latest` promotion still belong to that release.

No known failing assertion remains in the completed local gates above. This is a
bounded validation record, not a guarantee that the product has no undiscovered bugs.

## Release preparation addendum

After the validation above, the user authorized publication and made an explicit
choice to make the redesigned workspace the default in `0.2.0-beta.23`. Existing
`ui=next` links remain supported; `ui=legacy` is now the explicit compatibility
fallback. The original results above remain a historical pre-release snapshot.

Additional local checks passed after that change: 555 package tests, 39 inspector
browser checks including the no-flag launch and legacy fallback, and real headline
source Apply through the new default UI with a CLI restart, rebuild, verified
Delivery/History, and two rebuilt reload checks. The new default-UI Apply check is
required by CI and the release workflow. Legacy layout suites explicitly request
`ui=legacy`; the golden path and framework matrix exercise the new default UI.

Hosted CI, merge, public registry verification, and channel promotion are separate
release steps and are not asserted by this local preparation record.

Release checks subsequently caught and fixed two readiness races: client-rendered
targets mounting after DOMContentLoaded, and a delayed Responsive Lab response
reapplying container width after navigation. Both were reproduced before the fixes;
the capture regression and complete browser suite pass afterward. Fresh packed
Morrow, React/Vite, Next.js, and Storybook source-Apply checks also passed after
pinning the CLI and test harness to the same exact Playwright version. Hosted CI
and publication must still run against the final release commit.

The hosted showcase also exposed legacy form refreshes discarding uncommitted
motion duration and source-variant fields. Explicit bridge-refresh regressions
reproduced both losses; focused motion fields and component drafts are now
preserved, and all 29 local source-backed showcase checks pass with those
regressions enabled. The browser suite also waits for replacement responsive
frames to connect before starting its separate edit-scope transaction.
