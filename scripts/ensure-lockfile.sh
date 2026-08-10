#!/usr/bin/env bash
# Keep pnpm-lock.yaml aligned with package.json.
#
# - If already in sync: exit 0 (safe for pre-push / CI).
# - If drifted: refresh the lockfile and exit 1 so you commit it
#   before Vercel/CI runs `pnpm install --frozen-lockfile`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required (https://pnpm.io/installation)" >&2
  exit 1
fi

if pnpm install --frozen-lockfile --ignore-scripts; then
  echo "pnpm-lock.yaml is in sync with package.json."
  exit 0
fi

echo ""
echo "pnpm-lock.yaml is out of date with package.json — updating…"
pnpm install --no-frozen-lockfile --ignore-scripts

echo ""
echo "Lockfile updated. Commit it, then push again:"
echo "  git add pnpm-lock.yaml && git commit -m \"chore: sync pnpm-lock.yaml\""
echo ""
exit 1
