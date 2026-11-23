#!/usr/bin/env bash
# Zero Factory precommit gate for hotcode-dev-zerovisual (TypeScript / npm).
#
# Phases:
#   format  - Prettier in-place formatting (repo style via .prettierrc.json,
#             scoped to the main package via .prettierignore; web/ docs
#             subpackage is excluded).
#   build   - static typecheck via the repo's own `npm run typecheck`
#             (tsc --noEmit).
#   test    - Vitest suite via the repo's own `npm test` (vitest run).
#
# Subcommands: format | build | test | install-hook | all (default)
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Install node_modules only when the lockfile changed since the last install.
# The dispatcher may run the gate in a worktree that already has a populated
# node_modules from an earlier task; re-running `npm ci` on every gate run is
# wasted work, but a stale tree (deps added in a previous task) would break
# the build/test phases with confusing errors.
ensure_deps() {
  local lock_hash
  lock_hash="$(sha256sum package-lock.json | awk '{print $1}')"
  if [ ! -f .node_modules-lock-hash ] || [ "$(cat .node_modules-lock-hash 2>/dev/null)" != "$lock_hash" ]; then
    echo "[gate] lockfile changed (or no prior install) — running npm ci..."
    npm ci
    printf '%s' "$lock_hash" > .node_modules-lock-hash
  fi
}

run_format() {
  echo "[format] prettier --write --ignore-unknown ."
  npx -y prettier --write --ignore-unknown .
}

run_build() {
  ensure_deps
  echo "[build] npm run typecheck (tsc --noEmit)"
  npm run typecheck
}

run_test() {
  ensure_deps
  echo "[test] npm test (vitest run)"
  npm test
}

install_hook() {
  HOOK_DIR="$(git rev-parse --git-path hooks 2>/dev/null || echo ".git/hooks")"
  mkdir -p "$HOOK_DIR"
  # Absolute target so the link resolves whether hooks live under the repo's
  # own .git/ or under a shared worktree git dir.
  local target="$ROOT_DIR/.zerofactory/precommit.sh"
  ln -sf "$target" "$HOOK_DIR/pre-commit"
  chmod +x "$HOOK_DIR/pre-commit"
  echo "✓ Linked .zerofactory/precommit.sh -> $HOOK_DIR/pre-commit"
}

case "${1:-all}" in
  format)       run_format ;;
  build)        run_build ;;
  test)         run_test ;;
  install-hook) install_hook ;;
  all|*)
    run_format
    run_build
    run_test
    ;;
esac

echo "✓ Zero Factory precommit checks passed!"
