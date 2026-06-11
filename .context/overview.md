---
type: overview
project: codebuff (fork — modded branch)
updated: 2026-06-11
tags: [moc, codebuff, llm-proxy, byok]
---

# Codebuff (fork) — Map

Upstream Codebuff is a composable coding-agent monorepo where a hosted backend proxies LLM requests to upstream providers and bills users in credits via BigQuery + Stripe. CLI is a TUI built on OpenTUI + React. Also ships `freebuff`, the free tier.

**This fork has been ripped to standalone BYOK** (`modded` branch, published as `codebuff-mod` on npm, **v1.1.2** as of 2026-06-11). End users `npm install -g codebuff-mod`, run `cbm`, register a provider profile with `/providers:add <preset> <apiKey>` (or `/providers:add codex` for OAuth-backed ChatGPT routing), and agents run directly against their provider — no codebuff.com account, backend, or billing involved.

**As of v1.1.0 the fork is BYOK-only with no in-repo backend.** The 2026-06-11 strategy-B sync rode upstream's pivot to a CLI/SDK-only public snapshot and dropped `web/` + `packages/{internal,billing,bigquery,build-tools}`. SDK Path B (`CODEBUFF_USE_BACKEND=1` in `sdk/src/impl/database.ts`) still exists for external SDK consumers but now targets a *remote* codebuff.com — the fork no longer hosts the backend. See [[decisions]] "Ride upstream's snapshot deletion to a BYOK-only fork (strategy B)" and [MERGE-STRATEGY.md](../MERGE-STRATEGY.md) (rewritten for the lean tree).

**1.0.3 shim refactor** (2026-05-19): most fork-local edits to upstream files now flow through a hook registry at `sdk/src/impl/fork-hooks.ts` with implementations under `*/fork-impls/` directories. Cuts upstream-merge friction ~15% LOC. Pre-shim shape preserved at branch `modded-pre-shim` + tag `v1.0.2-pre-shim` for rollback. See [[decisions]] "Hook-registry shim refactor" and [MERGE-STRATEGY.md](../MERGE-STRATEGY.md) for the per-file resolution map.

Upstream is `CodebuffAI/codebuff`. The fork was renamed `EstarinAzx/codebuff` → `EstarinAzx/codebuff-modded` between 1.0.1 and 1.0.2 ships. Canonical release home is `EstarinAzx/codebuff-modded`. Divergence is deep — upstream merges are merge-and-resolve, not drop-in.

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

- **CLI/TUI** — `cli/` (OpenTUI + React)
- **SDK** — `sdk/` (JS/TS, consumed by CLI + external users)
- **Agent runtime** — `packages/agent-runtime/` (server-side tool dispatch)
- **Agent templates** — `agents/` (shipped) and `.agents/` (local)

## Kickoff incantation

`Read .context/overview.md and .context/active-work.md to start a fresh agent.`
