# Platform setup

## Web

Run `scripts/foundry.sh setup --project <root> --agent none --yes`. Setup automatically integrates supported Next.js App Router, Vite, and plain HTML entries. If it reports integration pending, import and call `.foundry/web-adapter.ts` once from a development-only client entry. Do not include the adapter in production bundles.

The adapter uses live `getBoundingClientRect` geometry, computed styles, accessibility semantics, CSS variables, content, assets, and Web Animations. Add `data-foundry-id`, `data-foundry-label`, `data-foundry-component`, and `data-foundry-source="path:line:column"` only to meaningful boundaries needing stable mapping.

`foundry-design start` indexes tokens, exported components, Storybook variants, CSS breakpoints, themes, and motion values. Configure project-specific `design.viewports`, `design.themes`, `design.states`, `design.componentRoots`, and `design.exclude` in `.foundry/foundry.config.json` when automatic discovery is incomplete.

The primary inspector stays over the running app. Its state workbench opens same-origin child frames with `__foundry_child=1`, which disables nested inspector UI while preserving real iframe viewport queries. Applications that prohibit framing retain the current live viewport and report multi-state verification unavailable.

## SwiftUI

Run `scripts/foundry.sh setup --project <root> --agent none --yes`. Add the local `FoundryDesignControl` Swift package only to DEBUG builds. Create a `FoundrySession`, start it, and apply `.foundryInspectable(...)` to meaningful view boundaries.

Register tunable closures for values the public SwiftUI runtime cannot expose or mutate safely, especially springs, transitions, token values, and component state. Do not claim automatic access to the complete private SwiftUI view tree.

## React Native

Run `scripts/foundry.sh setup --project <root> --agent none --yes`. Create a development-only adapter with the session credentials, register semantic targets using `measureInWindow`, and provide an optional iOS Simulator frame capture callback.

Register preview handlers for Animated or Reanimated values. The first supported native runtime is iOS Simulator. Do not imply Android or physical-device verification.

## Live native mirror

Native adapters publish compressed frames, measured targets, and controls to the local runtime. The browser inspector sends preview commands back to registered tunables. Keep update frequency adaptive and stop publishing when the session ends.
