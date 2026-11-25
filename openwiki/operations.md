---
type: 'Reference'
title: 'Testing, Benchmarking, Docs Site & Skills'
openwiki_generated: true
verified:
  - by: openwiki/0.6.0
    at: 2026-11-25T04:42:05.705Z
sources:
  - id: openwiki-source-9ab161c6e9774cf771b19ced
    resource: repo://.zerofactory/precommit.sh
  - id: openwiki-source-b0ba14be1452e631a6fd094b
    resource: repo://benchmark/provider.ts
  - id: openwiki-source-18ec773c1cc951952b87ea01
    resource: repo://benchmark/runner.ts
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-cdeb598f432f92191670c9ce
    resource: repo://skills/zerovisual-design-qa/scripts/design-qa.mjs
  - id: openwiki-source-06ec38aecde1aa2ff75afff7
    resource: repo://skills/zerovisual-optimize/scripts/optimize.mjs
  - id: openwiki-source-2a8e3785f33cdc5098e8fddb
    resource: repo://skills/zerovisual-regression/scripts/regression.mjs
  - id: openwiki-source-b3eab26b5be7a990bac0d6c3
    resource: repo://src/core/schema-generator.ts
  - id: openwiki-source-c56c4f3cc23322b3fe3923a7
    resource: repo://tests/integration/cli-commands.test.ts
  - id: openwiki-source-2086618364f2b15b3b86d2db
    resource: repo://tests/integration/reporter-aggregation.test.ts
  - id: openwiki-source-2638704953ea6421043895d4
    resource: repo://tests/unit/provider-math.test.ts
  - id: openwiki-source-fbadcd8591b65031efaaedce
    resource: repo://vitest.config.ts
  - id: openwiki-source-93e32ce595019b4da910d44d
    resource: repo://web/astro.config.mjs
  - id: openwiki-source-14e56945b7c632a3b335dcec
    resource: repo://web/package.json
generated: { by: 'hermes', at: '2026-11-25T04:42:05.705Z' }
---

# Testing, Benchmarking, Docs Site & Skills

## Build (`tsup`)

`tsup.config.ts` builds two ESM entries targeting `node20` with sourcemaps:

- **Library**: `src/index.ts` → `dist/index.js` with `.d.ts` emission (the published `main`/`module`).
- **CLI**: `src/cli/index.ts` → `dist/cli/index.js` with a `#!/usr/bin/env node` banner; backs both npm bins.

`npm run build` runs tsup; `prepublishOnly` chains typecheck → test → build.

## Precommit gate (`.zerofactory/precommit.sh`)

Runs in three phases (default `all`; subcommands `format|build|test|install-hook`):

- **format** — `prettier --write --ignore-unknown .`, scoped to the main package via `.prettierignore` (`web/` excluded; `.github/` is in scope, so repo-wide Prettier can silently reformat issue templates — keep that out of task-scoped diffs).
- **build** — `npm run typecheck` (`tsc --noEmit`).
- **test** — `npm test` (vitest run).
- **install-hook** — symlinks the gate into `.git/hooks/pre-commit` (resolved via `git rev-parse --git-path hooks` for linked worktrees).

`ensure_deps()` hashes `package-lock.json` into `.node_modules-lock-hash` and runs `npm ci` only when the hash differs — worktrees ship without `node_modules`, so run `npm ci` (root only) once in a fresh worktree, and repeat gate runs are then cheap.

## Vitest suite

`vitest.config.ts` runs `tests/**/*.test.ts` in the node environment with `globals: true`; tests import from `../../src/...js` directly, so the suite exercises the source tree, not `dist/`.

- **`tests/unit/`** — one file per core module: `provider-math` (tile/token math), `provider-classification` (`classifyProvider` from `benchmark/provider.ts`), `image-optimizer` (diff bbox + provider optimization with sharp temp files), `optimize` (including the CLI command end-to-end), `schema` (Zod canonical schemas), `heuristic-linter` (26-rule linter + DESIGN.md drift), `penpot-parser` (SVG/JSON/DTCG + DOM diff), `skills-generation` (regenerates skill `output.schema.json`), `fixture` (mocks Playwright `Page`/`TestInfo`).
- **`tests/integration/`** — `cli-commands.test.ts` drives `runRegressionCommand`/`runDesignQaCommand`/`runEstimateCommand` against real fixtures and validates outputs against `TriagePayloadSchema`; `reporter-aggregation.test.ts` exercises `ZeroVisualReporter` with synthetic `TestCase`/`TestResult` objects, asserting multi-viewport aggregation and `triage-ready.json`.

Benchmark and a few integration paths reference built `dist/index.js`, so build before benchmark-related code.

## Token-benchmark harness (`benchmark/`)

Standalone A/B evaluation of token savings without an LLM SDK — calls an OpenAI-compatible chat endpoint over plain `fetch`.

- **`provider.ts`** — single source of truth for benchmark config: `classifyProvider(model)` → `qwen|gemini|local` and `readBenchmarkEnv()` (parses `benchmark/.env`; skips blanks/comments, preserves embedded `=`). Both are shared by `runner.ts` and `export-web-data.ts` so classification cannot drift.
- **`generate-dataset.ts`** (`npm run benchmark:dataset`) — renders 11 cases (6 synthetic HTML pairs + 5 real sites) with Playwright headless Chromium, writes `baseline.png`/`actual.png`/`diff.png` (sharp raw-pixel comparison, threshold >15/channel, Playwright magenta `#ff00ff`) plus `metadata.json` with `groundTruth` and a verified `expectedBoundingBox` under `benchmark/testdata/<id>/`.
- **`runner.ts`** (`npm run benchmark`) — per case, two modes: **A** sends the raw full-viewport PNG; **B** runs `detectDiffBoundingBox` → `optimizeImageForProvider` (crop + tile-downscale WebP, quality 85) using the classified provider. Both call the VLM with a fixed QA prompt; `callVlmWithRetry` retries 429/5xx and transient image 400s with backoff + jitter. Accuracy scores via keyword match against ground truth (element ≤35, defect ≤35, root-cause/fix ≤30; `defectFound` at score ≥ 50). Writes `benchmark-summary.json`, `benchmark-report.md`, and per-run session JSONs under `benchmark/results/sessions/`.

The benchmark needs a VLM endpoint (+ optional keys) in `benchmark/.env` — a manual dev tool, not part of CI. `export-web-data.ts` converts results into `web/public/benchmark-data/` + `web/src/data/benchmark-sessions.json` for the docs site.

## Docs site (`web/`)

`web/` is a private sub-package (own `package.json`, Astro 7 + Starlight, Tailwind v4, KaTeX); the root proxies it via `docs:dev`/`docs:build`/`docs:preview`, and its build is **not** part of the root typecheck/vitest gate. Notable pieces:

- `TokenCalculator.astro` imports the repo's authoritative `src/core/provider-math.ts` directly (`vite.fs.allow` whitelists the repo root), so it shows the exact CLI tile math.
- `BenchmarkExplorer.astro` is a client-side explorer over `benchmark-sessions.json` with baseline/actual/diff/crop imagery from `web/public/benchmark-data/`.
- Gotcha: `astro build` can OOM at the Pagefind step ("memory allocation of 16 bytes failed" / EPIPE) in constrained environments — pre-existing, not a content regression.

## Bundled agent skills (`skills/`)

Published with the npm package. Each of `zerovisual-regression`, `zerovisual-design-qa`, `zerovisual-optimize` ships a `SKILL.md` rubric plus a thin `scripts/*.mjs` wrapper that resolves the CLI binary from repo-local `dist/cli/index.js`, cwd `dist/`, or `node_modules/zerovisual`, falling back to `npx --yes zerovisual`; scripts forward all arguments and exit with the CLI's status — no logic lives in them. `writeSkillSchemas()` (regenerated by `tests/unit/skills-generation.test.ts`) keeps the committed `output.schema.json` verdict schemas in sync with `RegressionVerdictSchema`/`DesignQaVerdictSchema`.
