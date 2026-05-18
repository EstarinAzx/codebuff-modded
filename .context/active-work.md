---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-18
tags: [active, modded]
---

# Active Work — `modded` branch

## Direction shift (2026-05-18)

Strategic pivot. OpenCode Go server-side lane (commit `6d3b074b2`) was scoped to a self-hosted-backend future, but that path requires hosting `web/` + Postgres + Stripe stubs and still requires codebuff.com-style auth. Pivoting to **full BYOK client-side rip**: strip codebuff.com backend dependency entirely, run direct provider HTTP calls from the CLI using user-managed API keys. Endgame is a Stratagem-equivalent standalone CLI.

OpenCode Go web-side handler (`web/src/llm-api/opencode-go.ts`) is preserved in-tree as **dead reference code** — it documents the upstream wire shape if needed, but the BYOK CLI calls `opencode.ai/zen/go/v1` directly without going through `web/`.

## In flight

### Full BYOK rip (replaces self-host plan)

**Status:** planning complete, implementation not started.

**Plan:** [.claude/byok-rip-implementation-plan.md](../.claude/byok-rip-implementation-plan.md)

**Premise:** Agent runtime in `packages/agent-runtime/` is transport-agnostic — `promptAiSdkStream` callback is injected, not hardcoded. SDK's `getModelForRequest()` already has two paths (ChatGPT OAuth direct + Codebuff backend). Adding a third path — BYOK profile → direct provider HTTP — is the same shape as the existing OAuth-direct path. Architectural seam exists; not a green-field rewrite.

**Phase plan (each is its own commit):**
1. `cli/src/utils/providers.ts` — profile CRUD store at `~/.config/manicode/providers.json` (0600). Plus `providers-models.ts` — static `MODEL_CATALOG` per preset + live `/v1/models` probe + 24h disk cache at `models-cache.json`.
2. `sdk/src/impl/model-provider.ts` — add Path C (`createDirectProviderModel` + active-profile check in `getModelForRequest`); keep Path B intact behind opt-in env flag
3. `/providers*` slash commands + OpenTUI panel (mirror Stratagem's `ProviderManager` flow). 4-step add wizard: preset → name → key → **model picker** (catalog / live probe / free-text branches). Plus `/model` runtime swap, `/providers:refresh-models` to bust the cache.
4. Local `.agents/mod-default|lite|max|plan.ts` templates to replace upstream `base2-*` (which live in codebuff.com DB, unfetchable)
5. Backend dependency strip — `database.ts` stubs, `auth.ts` synthetic local creds, `env-schema.ts` makes `NEXT_PUBLIC_CODEBUFF_APP_URL` optional, whitelist gated on BYOK
6. Republish `codebuff-mod@0.1.0` with own binary artifacts (no longer launcher-only)

**v1 scope:** API-key providers only (OpenAI, Anthropic, OpenCode Zen/Go, OpenRouter, Mistral, Together, Groq, DeepSeek, Gemini, custom-openai).

**v2 scope (deferred):** OAuth providers (Antigravity, Copilot, KiloCode, Cline, Cursor, Kiro) — port from Stratagem/Tau.

**Open items (before Phase 5):**
- Validate Phase 2 canary — confirm `promptAiSdkStream` direct-call works with agent loop without backend-specific envelope assumptions. If broken, re-scope before stripping.
- Decide Path B gating: opt-in env flag `CODEBUFF_USE_BACKEND=1` (preserves SDK consumers) vs hard delete. Recommendation: env flag.
- Inventory which `.agents/<x>.ts` upstream templates can be copied as starting point for `mod-*`.

### OpenCode Go server-side lane (parked)

**Status:** wired but never reachable in BYOK mode. Kept in-tree as reference.

**Files (unchanged from initial commit `6d3b074b2`):**
- `web/src/llm-api/opencode-go.ts` — server-side handler, dead code in BYOK mode
- `common/src/constants/model-config.ts` — `openCodeGoModels` const, still useful (CLI can read these ids for display)
- `web/src/app/api/v1/chat/completions/_post.ts` — dispatch branch, dead code

**Future of these files:**
- After BYOK rip Phase 5: `web/` directory becomes fully dead — candidate for deletion
- Until then: leaves them as documentation of OpenCode Go upstream wire shape

### npm distribution as `codebuff-mod`

**Status:** v0.0.1 published as launcher-only. Will rev to v0.1.0 in BYOK rip Phase 6 with own binary artifacts.

**Current limitation:** launcher polls `registry.npmjs.org/codebuff/latest` and downloads upstream binary on every run. Upstream binary requires codebuff.com — so post-rip, upstream binary will NOT work for this fork's users. Phase 6 rewires `packageName` to `'codebuff-mod'` and hosts own binaries via GitHub Releases on `EstarinAzx/codebuff`.

## Backlog

- Execute BYOK rip Phases 1-6 (see plan).
- Delete `web/` directory once Phase 5 is stable and no consumer needs the server-side reference code.
- Delete `freebuff/` (free-tier waiting-room logic; irrelevant in BYOK mode).
- v2: OAuth provider ports (Antigravity first — Tau MIT-licensed code available; then Copilot/KiloCode/Cline).
- v2: multi-account rotation per provider (Stratagem has this for Antigravity quota cycling).
- v2: `/providers:test` could grow into a provider-health dashboard if multi-account lands.

## Recently done

- 2026-05-18: Direction-shift to BYOK rip; wrote implementation plan at `.claude/byok-rip-implementation-plan.md`.
- 2026-05-18: Published `codebuff-mod@0.0.1` to npm (launcher-only fork distribution).
- 2026-05-18: Wired OpenCode Go server-side provider lane — commit `6d3b074b2` (now parked as reference code).
- (initial fork setup) — cloned upstream, created `modded` branch.

## Upstream sync notes

After BYOK rip lands, upstream merges get harder because divergence is deeper. Per `byok-rip-implementation-plan.md` "Upstream sync protocol post-rip":

- **Agent runtime** (`packages/agent-runtime/`) — merge upstream cleanly when possible; this is the core engine.
- **CLI TUI** (`cli/src/components/`, hooks) — expect conflicts in files modified during the rip (`use-send-message.ts`, `slash-commands.ts`, `auth.ts`).
- **`sdk/src/impl/model-provider.ts`** — high-conflict area; keep Path C, merge upstream Path A/B changes when non-conflicting.
- **`sdk/src/impl/database.ts`** — fully stubbed in fork; merge with prejudice.
- **`web/` and `freebuff/`** — irrelevant; consider deleting after Phase 5.

Maintain `FORK_DIVERGENCE.md` at repo root listing every file changed in Phases 1-5 so future-you can grep the merge resolution surface.

If upstream itself adds BYOK/`/providers`, retire the fork — same calculus as the OpenCode Go decision.
