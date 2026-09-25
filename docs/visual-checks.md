# Visual checks

Foundry can compare a local product screen against an explicitly approved baseline. It records screenshots, geometry, capture conditions and basic overflow, clipping, target-size and accessible-name findings. A difference means something changed and needs review; it is not automatically a design defect.

## First check

Start your product's development server, then install the capture browser once:

```sh
npx playwright install chromium
```

Register a screen at its actual product URL, without Foundry session parameters:

```sh
foundry-design visual-check register --project . --name home-desktop --url http://127.0.0.1:3000 --width 1920 --height 1080
foundry-design visual-check run --project .
```

The command prints the path to a local HTML report. The first run exits with code `3` because it has no approved baseline. Review that report, then use its run ID:

```sh
foundry-design visual-check approve --project . --run check_RUN_ID --name home-desktop
foundry-design visual-check run --project .
```

Approval creates immutable evidence and updates the active baseline pointer. Prior baseline evidence remains available. A normal check never approves a baseline or changes product source.

## Contexts and dynamic content

Register each viewport/theme/state combination as a separate named screen. Theme and state hooks must correspond to readable, authored project CSS; Foundry reports unsupported contexts rather than simulating their appearance.

```sh
foundry-design visual-check register --name signup-dark-error --url http://127.0.0.1:3000/signup --width 1280 --height 900 --theme dark --theme-selector html --theme-attribute data-theme --state error --state-selector '#signup' --state-attribute data-state
```

For class-based hooks, use `--theme-attribute class`; the theme name becomes the class token. For authored URL-query states, register the product's explicit URL, for example `http://127.0.0.1:3000/signup?state=error`. Do not additionally set a state attribute unless the project supports it.

Mask content whose changes are intentionally outside this comparison. Masks cover screenshot pixels and exclude matching elements and descendants from geometry and health checks. They do not hide layout changes to unmasked parent elements.

```sh
foundry-design visual-check register --name dashboard --url http://127.0.0.1:3000 --mask '#clock' --mask '[data-live-avatar]'
```

Use repeated `--target SELECTOR` arguments to limit geometry and health checks to relevant elements. The screenshot still captures the complete viewport. Registered targets and masks must exist, or the context reports unsupported.

Each capture uses a fresh browser context with device scale factor 1, English locale, UTC timezone and reduced motion. CSS animations and transitions are disabled. Foundry waits for fonts, visible images and stable geometry. Mask or remove continuously changing layout before capturing.

## Results and CI

```sh
foundry-design visual-check list --project . --json
foundry-design visual-check run --project . --name home-desktop --json
```

Exit codes:

| Code | Meaning                                                                   |
| ---- | ------------------------------------------------------------------------- |
| `0`  | Every requested screen matches its baseline within configured tolerances. |
| `1`  | Changed pixels, geometry or new findings need review.                     |
| `2`  | At least one check failed or has unsupported context/environment.         |
| `3`  | At least one successful capture still needs an approved baseline.         |

Failures take precedence over differences, then missing baselines. Reports retain per-screen outcomes. A broken preview cannot pass by matching an error page. HTTP failures, unavailable browser, failed fonts/images and unstable layout are explicit failures.

Configuration lives at `.foundry/visual-checks/screens.json`. Captures and reports live in `.foundry/visual-checks/runs/<run-id>/`; approved evidence lives in `.foundry/visual-checks/baselines/<baseline-id>/`. Preserve this directory in your chosen local or CI artifact storage. Foundry does not upload it. The Delivery workspace can list saved reports from the current project.

The default comparison permits a per-channel pixel difference of 16, a changed-pixel ratio of 0.001 (0.1%), and a geometry difference of 0.5px. These fields are explicit in each registered screen's configuration. Changing configuration invalidates the active baseline and requires a new reviewed capture. Use the same Chromium version and operating system for captures; an environment mismatch is unsupported until a new baseline is explicitly approved.

Only HTTP(S) loopback product URLs are supported in this version. Responsive interactions, login flows and browser-only emulation are not inferred. Basic health checks are not a complete accessibility audit.

## Engineering exports

Repository delivery exports include a frozen implementation contract, exact context verification coverage, source/run provenance, risks and unresolved questions. Missing verification remains untested. Actual local PNG, JPEG and WebP evidence can be bundled with SHA-256 hashes; missing or unsafe paths are listed as unavailable. Human-edited documents and images are protected by the export manifest.

A before/rebuilt pair requires matching recorded viewport/context and the reviewed/applied source revisions. Temporary previews and older references without capture provenance are labeled separately. Verified history is also grouped by saved milestones; no additional outcome or rationale is invented.
