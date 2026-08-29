#!/usr/bin/env bash
set -euo pipefail

skill_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plugin_root="$(cd "$skill_root/../.." && pwd)"
foundry_design_home="${FOUNDRY_DESIGN_HOME:-$plugin_root}"

if [[ -f "$foundry_design_home/package.json" && -f "$foundry_design_home/packages/cli/dist/index.js" ]]; then
  exec pnpm --dir "$foundry_design_home" foundry "$@"
fi

if command -v foundry-design >/dev/null 2>&1; then
  exec foundry-design "$@"
fi

exec npx -y foundry-design@0.1.0 "$@"
