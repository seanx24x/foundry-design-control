# Foundry UI-only films

Four focused Foundry workflows without the outer presentation stage or browser mockup. Each story is exported in matching Light and Dark versions for direct use in product pages and portfolio layouts.

## Stories

1. Navigate the running product
2. Refine layout directly
3. Review the complete batch
4. Apply, rebuild, and verify

## Output

- H.264 MP4
- 1920 × 1200
- 60 fps
- `yuv420p`, television range
- Fast-start
- No audio
- Matching JPG poster

## Rebuild

Run from the Foundry repository root:

```sh
node artifacts/product-motion/2026-09-01-foundry-capability-showcase/ui-only/compose-ui-only.mjs
```

The script reads the canonical recordings in `../raw` and replaces the files in `final` and `posters`.
