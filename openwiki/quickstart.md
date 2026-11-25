---
type: 'Reference'
title: 'Quickstart & Task Routing'
openwiki_generated: true
verified:
  - by: openwiki/0.6.0
    at: 2026-11-25T04:42:05.705Z
sources:
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-69f1465f9bd0baca2064728f
    resource: repo://src/cli/index.ts
  - id: openwiki-source-d1fbef09192ffbab6eff0bc2
    resource: repo://src/index.ts
generated: { by: 'hermes', at: '2026-11-25T04:42:05.705Z' }
---

# Quickstart & Task Routing

ZeroVisual is a zero-API-key TypeScript npm package (`zerovisual`, ESM, node ≥20) that pre-processes UI visual artifacts for Vision LLMs: a Playwright custom reporter + CLI that crop diff images to their bounding box, downscale them to the target model's exact vision tile grid, and attach scoped DOM context, so AI agents triage failures with far fewer vision tokens. A second mode audits a live URL against 26 deterministic design-QA heuristics (WCAG contrast, 8pt grid, tap targets, rendered AI-slop) and diffs the rendered DOM against DESIGN.md / Penpot / DTCG design tokens.

## Commands

| Task           | Command                                                                                |
| -------------- | -------------------------------------------------------------------------------------- |
| Install deps   | `npm ci` (single root `package.json`; worktrees ship without `node_modules`)           |
| Build          | `npm run build` (tsup → `dist/`, library + CLI entries)                                |
| Typecheck      | `npm run typecheck` (`tsc --noEmit`)                                                   |
| Test           | `npm test` (vitest, `tests/**/*.test.ts`; ~80 tests)                                   |
| Watch tests    | `npm run test:watch`                                                                   |
| Precommit gate | `./.zerofactory/precommit.sh` (format → build → test; `install-hook` to wire into git) |
| Docs site      | `npm run docs:dev` / `docs:build` / `docs:preview` (Astro/Starlight in `web/`)         |
| Benchmark      | `npm run benchmark` (needs a VLM endpoint; `benchmark:dataset` to regenerate fixtures) |

## CLI surface

Built to `dist/cli/index.js`, exposed as two npm bins (`zerovisual`, `zerovisual-optimize`) and mirrored by the bundled agent-skill scripts:

```
zerovisual regression [--input ./test-results] [--output DIR] [--provider openai|anthropic|gemini|local|qwen|gemma|llama|mistral|deepseek] [--lowTokenMode] [--padding 32] [--json]
zerovisual design-qa --url <url> [--penpot <svg|json>] [--designMd <path>] [--maxCrops 4] [--output DIR] [--provider ...] [--json]
zerovisual optimize <file-or-dir> [--output PATH] [--provider anthropic] [--quality 80] [--json]
zerovisual estimate --width <w> --height <h> [--provider anthropic] [--json]
```

Outputs: `triage-ready.json` (regression/reporter) and `design-qa-ready.json` (design-qa), both Zod-validated against `TriagePayloadSchema`; WebP artifacts under `<output>/artifacts/`.

## Where to read, by concern

| Concern                                                                             | Wiki page                       | Source                                                                                      |
| ----------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| Core engine, provider tile math, diff detection, image optimization, DOM capture    | [architecture](architecture.md) | `src/core/`                                                                                 |
| Design-QA linter (26 rules, AI-slop detection), DESIGN.md/Penpot/DTCG token diffing | [architecture](architecture.md) | `src/core/heuristic-linter.ts`, `src/core/design-md-parser.ts`, `src/core/penpot-parser.ts` |
| CLI commands, Playwright reporter, test fixture, data flow and invariants           | [architecture](architecture.md) | `src/cli/`, `src/reporter/`                                                                 |
| Docs site, TokenCalculator, BenchmarkExplorer, bundled agent skills                 | [operations](operations.md)     | `web/`, `skills/`                                                                           |
| Tests, benchmark harness, precommit gate, build entries                             | [operations](operations.md)     | `tests/`, `benchmark/`, `vitest.config.ts`, `tsup.config.ts`, `.zerofactory/precommit.sh`   |

## Conventions agents should know

- Public API = everything exported from `src/index.ts` (13 modules). Keep provider tile/token math in `src/core/provider-math.ts` (dependency-free, shared with the docs-site calculator) — never duplicate it.
- Provider defaults differ per command: `regression`/`design-qa` default to `openai`; `optimize`/`estimate` default to `anthropic`. Don't "unify" without checking intent.
- The Zero-Token Law: passing tests and clean audits must produce zero work/tokens — reporter and CLI short-circuit before any image processing.
- `web/` is a private sub-package excluded from the root Prettier scope and vitest gate; verify web changes with its own `npm --prefix web` scripts.
- `.github/` is in Prettier scope — a repo-wide `prettier --write` can reformat issue templates; keep that out of task diffs.
- Skill `output.schema.json` files are generated by `src/core/schema-generator.ts` (`writeSkillSchemas`) — regenerate after verdict-schema changes.
