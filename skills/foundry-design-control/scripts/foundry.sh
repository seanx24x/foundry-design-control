#!/usr/bin/env bash
set -euo pipefail

skill_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plugin_root="$(cd "$skill_root/../.." && pwd)"
foundry_design_home="${FOUNDRY_DESIGN_HOME:-$plugin_root}"

if [[ -f "$foundry_design_home/package.json" && -f "$foundry_design_home/packages/cli/dist/index.js" ]]; then
  exec pnpm --dir "$foundry_design_home" foundry "$@"
fi

exec npx -y --prefer-online --package=foundry-design@latest foundry-design "$@"
