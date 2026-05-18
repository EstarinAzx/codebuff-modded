---
type: overview
project: codebuff (fork — modded branch)
updated: 2026-05-18
tags: [moc, codebuff, llm-proxy]
---

# Codebuff (fork) — Map

Composable coding-agent monorepo. Hosted backend proxies LLM requests to upstream providers and bills users in credits via BigQuery + Stripe. CLI is a TUI built on OpenTUI + React. Also ships `freebuff`, the free tier.

This is a personal fork. Active divergence tracked in [[active-work]]. Upstream is `CodebuffAI/codebuff` (origin currently points at `EstarinAzx/codebuff`).

## Map

- [[stack]] — tech, build commands, workspaces
- [[active-work]] — what's in flight on the `modded` branch
- [[decisions]] — rationale for fork-local edits
- [[gotchas]] — non-obvious behaviors when touching this repo

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
