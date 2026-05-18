---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-18
tags: [active, modded]
---

# Active Work — `modded` branch

## In flight

### OpenCode Go provider lane

**Status:** wired, awaiting real pricing + smoke test.

**Plan:** [.claude/opencode-go-implementation-plan.md](../.claude/opencode-go-implementation-plan.md)

**Files changed:**
- `web/src/llm-api/opencode-go.ts` — NEW, ~620 LOC sibling of `opencode-zen.ts`, base URL `https://opencode.ai/zen/go/v1`
- `common/src/constants/model-config.ts` — added `openCodeGoModels` const (`opencode-go/glm-5`)
- `web/src/app/api/v1/chat/completions/_post.ts` — added `useOpenCodeGo` branch in streaming + non-streaming dispatch ladders, error pass-through, imports

**Open items (do before production):**
- Replace placeholder pricing in `opencode-go.ts` (`GLM_5_GO_PRICING`) — currently cloned from Zen Kimi defaults. Must come from real opencode.ai/zen/go pricing sheet or users will be over/under-billed.
- Smoke test streaming + non-streaming against a live `OPENCODE_API_KEY`, confirm `provider: "OpenCode Go"` tag + BigQuery insert + Stripe credit consumption.
- Run `bun run typecheck` once deps are installed.

**Decisions:** see [[decisions]] (Path B clone, single shared API key).

### npm distribution as `codebuff-mod`

**Status:** published as launcher-only. Fork-local backend mods stay dormant until backend is self-hosted.

**What ships:** `cli/release/` package renamed `codebuff` → `codebuff-mod` (v0.0.1). Bin entries renamed to `codebuff-mod` / `cbm` to avoid colliding with upstream `codebuff` / `cb` if both installed globally.

**What does NOT ship (and why):**
- `cli/release/index.js` `packageName` left as `'codebuff'` — keeps binary download URL pointing at `https://codebuff.com/api/releases/download/<v>/codebuff-<plat>.tar.gz` (upstream artifacts). Renaming would 404.
- Side-effect: launcher polls `registry.npmjs.org/codebuff/latest` for updates → will perpetually see upstream version as newer than local `codebuff-mod@0.0.1` and re-download upstream binary on every run. Acceptable for now (binary is upstream anyway).

**To actually activate fork's OpenCode Go lane:** must self-host `web/` and set `NEXT_PUBLIC_CODEBUFF_APP_URL` in the launcher (or hardcode it).

## Backlog

- Self-host `web/` backend (Vercel/Railway/Fly) so the OpenCode Go lane is reachable.
- Once backend self-hosted, fork `cli/release/index.js`: change `packageName` to `'codebuff-mod'` and host own binary artifacts (own GH releases or static host). Otherwise launcher update loop pulls upstream binaries forever.
- Replace placeholder pricing in `opencode-go.ts` (`GLM_5_GO_PRICING`).
- Run `bun run typecheck` once deps installed.
- Smoke test streaming + non-streaming against live `OPENCODE_API_KEY` (requires backend deployed).

## Recently done

- 2026-05-18: Published `codebuff-mod@0.0.1` to npm (launcher-only fork distribution).
- 2026-05-18: Wired OpenCode Go provider lane (server-side) — see commit `6d3b074b2`.
- (initial fork setup) — cloned upstream, created `modded` branch.

## Upstream sync notes

When pulling from upstream:
- Diff `opencode-zen.ts` vs `opencode-go.ts` — replay Zen fixes into Go.
- Expect 3-way merge conflict in `_post.ts` if upstream reorders dispatch branches. Resolve by keeping Go branch adjacent to Zen branch.
- If upstream adds OpenCode Go themselves, retire the fork file per the plan's "Upstream merge protocol".
