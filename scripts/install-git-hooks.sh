#!/usr/bin/env bash
# Installs repo git hooks into .git/hooks (no global git config required).
# Runs automatically via `pnpm install` → prepare.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d .git ]]; then
  exit 0
fi

mkdir -p .git/hooks
cp scripts/git-hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push scripts/ensure-lockfile.sh scripts/git-hooks/pre-push

echo "Installed git pre-push hook (lockfile sync check)."
