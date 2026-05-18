---
type: overview
project: codebuff (fork — modded branch)
updated: 2026-05-18
tags: [moc, codebuff, llm-proxy, byok]
---

# Codebuff (fork) — Map

Upstream Codebuff is a composable coding-agent monorepo where a hosted backend proxies LLM requests to upstream providers and bills users in credits via BigQuery + Stripe. CLI is a TUI built on OpenTUI + React. Also ships `freebuff`, the free tier.

**This fork has been ripped to standalone BYOK** (`modded` branch, published as `codebuff-mod` on npm, v0.1.4 as of 2026-05-18). End users `npm install -g codebuff-mod`, run `cbm`, register a provider profile with `/providers:add <preset> <apiKey>`, and agents run directly against their provider — no codebuff.com account, backend, or billing involved. Upstream backend paths (`web/`, `freebuff/`, codebuff.com auth/billing) are preserved in-tree but gated behind `CODEBUFF_USE_BACKEND=1` so SDK external consumers don't break.

Upstream is `CodebuffAI/codebuff` (origin points at `EstarinAzx/codebuff`). Divergence is now deep — upstream merges are merge-and-resolve, not drop-in.

## Map

- [[stack]] — tech, build commands, workspaces
- [[active-work]] — what's in flight on the `modded` branch
- [[decisions]] — rationale for fork-local edits
- [[gotchas]] — non-obvious behaviors when touching this repo
- [MERGE-STRATEGY.md](../MERGE-STRATEGY.md) — how to sync upstream → main → modded safely (read BEFORE any upstream merge)

## Authoritative project docs (do not duplicate here)

Maintained upstream — read these directly:

- `AGENTS.md` — entry point, conventions, doc index
- `docs/architecture.md` — package graph, per-package details
- `docs/request-flow.md` — full request lifecycle, CLI → server → back
- `docs/error-schema.md` — server error formats
- `docs/development.md` — dev setup, worktrees, logs, DB migrations
- `docs/testing.md` — DI-over-mocking, tmux CLI testing
- `docs/environment-variables.md` — env vars, DI helpers, loading order
- `docs/agents-and-tools.md` — agent system, shell shims, tool definitions
- `docs/authentication.md`
- `docs/freebuff-waiting-room.md`
- `docs/patterns/handle-steps-generators.md`

## User-facing surfaces

- **HTTP** — Next.js routes under `web/src/app/api/**` (chat completions proxy at `/api/v1/chat/completions`)
- **CLI/TUI** — `cli/` (OpenTUI + React)
- **SDK** — `sdk/` (JS/TS, consumed by CLI + external users)
- **Agent runtime** — `packages/agent-runtime/` (server-side tool dispatch)
- **Agent templates** — `agents/` (shipped) and `.agents/` (local)

## Kickoff incantation

`Read .context/overview.md and .context/active-work.md to start a fresh agent.`
