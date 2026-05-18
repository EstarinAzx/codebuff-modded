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

## Backlog

- (none yet)

## Recently done

- (initial fork setup) — cloned upstream, created `modded` branch

## Upstream sync notes

When pulling from upstream:
- Diff `opencode-zen.ts` vs `opencode-go.ts` — replay Zen fixes into Go.
- Expect 3-way merge conflict in `_post.ts` if upstream reorders dispatch branches. Resolve by keeping Go branch adjacent to Zen branch.
- If upstream adds OpenCode Go themselves, retire the fork file per the plan's "Upstream merge protocol".
