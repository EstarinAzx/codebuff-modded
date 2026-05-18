---
type: gotchas
project: codebuff (fork — modded branch)
updated: 2026-05-18
tags: [gotchas]
---

# Gotchas

## LLM provider dispatch is a chained ternary

`web/src/app/api/v1/chat/completions/_post.ts` has **two** parallel ladders — one for streaming, one for non-streaming. When adding a new provider, both must be wired or `/v1/chat/completions` will half-fail (most clients stream, so tests pass and non-stream callers silently break).

Pattern per branch: add a `useXyz` boolean **and** thread `!useXyz` into every subsequent guard's `&&` chain **and** slot the handler into the ternary tower at the same position in both ladders.

## Pricing missing → 500

Every routable model needs `inputCostPerToken / cachedInputCostPerToken / outputCostPerToken` in its provider handler's pricing map. Missing pricing throws at billing finalization and the user sees a 500.

## Provider label tagged in two places per handler

Each `handle*NonStream` and `handle*Stream` pair tags `data.provider`. The non-stream handler tags once at the end; the stream handler tags inside `handleLine`. Miss one and BigQuery analytics mis-attributes traffic to the wrong provider.

## Free-mode (freebuff) gates are layered

Free-mode requests pass through: country classification → agent+model allowlist → session/waiting-room gate → rate limiter. Each gate has its own error code (see `STATUS_BY_GATE_CODE` in `_post.ts`). Never bypass — there are real attack scenarios documented inline (e.g. "free Opus for attacker, real dollars for us").

## `OPENCODE_API_KEY` is shared between Zen and Go endpoints

One env var serves both. If you later need separate keys per endpoint, add `OPENCODE_GO_API_KEY` to `packages/internal/src/env-schema.ts` in both the schema block and `serverProcessEnv`.

## Windows + bun workspaces

Workspace install + typecheck both run from repo root (`bun install`, `bun run typecheck`). Do not run them per-package — the `--filter='*'` script depends on workspace resolution from root.
