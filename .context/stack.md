---
type: stack
project: codebuff (fork — modded branch)
updated: 2026-06-11
tags: [stack, tooling, byok]
---

# Stack

## Runtime + package manager

- **Bun** 1.3.x (workspaces, runtime, test runner) — see `package.json` `workspaces`
- **TypeScript** monorepo, ESM (`"type": "module"`)
- **Node** target where Next.js/undici need it (server routes, streaming)

## Frameworks

- **OpenTUI + React** — `cli/` TUI (the only shipped surface)
- **Zod v4** — env schema + request validation (`common/src/env-schema.ts`)
- **Vercel AI SDK** (`@ai-sdk/*`) + vendored **`@codebuff/llm-providers`** (`openai-compatible` factory) — the model-call plumbing SDK Path C dispatches through
- ~~Next.js / undici / Drizzle~~ — gone with `web/` + `packages/internal` in the strategy-B sync (2026-06-11)

## External services

The fork is **BYOK-only** — no codebuff.com backend in-repo. The only network calls are the user's own provider key against their endpoint:

- User's own provider key against any preset in `cli/src/utils/providers.ts` — openai, anthropic, openrouter, opencode, opencode-go, deepseek, gemini, mistral, together, groq, custom-openai
- Direct HTTP via SDK Path C (`sdk/src/impl/fork-impls/byok-resolver.ts createDirectProviderModel`) — no codebuff.com hop
- No central billing, analytics, or auth — `~/.config/manicode/providers.json` (chmod 0600) is the only state

SDK Path B (`CODEBUFF_USE_BACKEND=1`, in `sdk/src/impl/database.ts`) still exists for external SDK consumers but targets a *remote* codebuff.com — the fork no longer hosts Stripe/BigQuery/PostHog/auth. Those services are upstream's, not in this tree.

## Workspaces

`agents`, `cli`, `common`, `evals`, `freebuff`, `packages/agent-runtime`, `packages/code-map`, `packages/llm-providers`, `scripts/tmux`, `sdk` (matches upstream's lean snapshot — `web`, `freebuff/web`, `packages/{internal,billing,bigquery,build-tools}`, `.agents`, full `scripts` all dropped in strategy B; fork `.agents/mod-*.ts` survive as non-workspace files bundled by prebuild)

## Commands

| Action | Command |
|---|---|
| Install | `bun install` (from root — workspace resolution) |
| Dev (cli) | `bun dev` (alias for `bun start-cli`) |
| Typecheck | **per package** — `(cd cli && bun run typecheck)`, same for `sdk`, `common`. NO root aggregate (dropped in strategy-B sync; see [[gotchas]]) |
| Test | **per package** — `(cd sdk && bun test)`, `(cd cli && bun test)`, `(cd common && bun test)` |
| Build CLI binary (native win32) | `cd cli && bun run build:binary` |
| Build CLI binary (cross linux) | `OVERRIDE_TARGET=bun-linux-x64 OVERRIDE_PLATFORM=linux OVERRIDE_ARCH=x64 bun run build:binary` (see [[gotchas]] for spaced-path / tar workarounds) |
| Full release (bump→build→tag→GH→npm) | follow [MERGE-STRATEGY.md](../MERGE-STRATEGY.md) §Step 6 — the complete runbook (GH release MUST precede `npm publish`) |

## Key paths

Shared surface (survives in the lean tree):

- Model catalog (whitelist) — `common/src/constants/model-config.ts`
- Codex OAuth model map (single source of truth) — `common/src/constants/chatgpt-oauth.ts`
- Env schema — `common/src/env-schema.ts` (the server-side `packages/internal` schema was deleted)
- Agent templates — `agents/` (bundled at build time) + `.agents/` (loaded at runtime)
- Model-call plumbing — `packages/llm-providers/src/openai-compatible/` (vendored from upstream; SDK Path C imports it)

BYOK fork additions (`modded` branch):

- Profile store — `cli/src/utils/providers.ts` (CRUD against `~/.config/manicode/providers.json`, schema v3 with `oauthProfileId`, 0600). Holds profiles **and** `agentBindings: Record<agentId, profileId>` for per-agent routing.
- Model catalog/probe — `cli/src/utils/providers-models.ts` (hardcoded ids + live `/v1/models` probe with 24h cache at `~/.config/manicode/models-cache.json`)
- Slash commands — `cli/src/commands/providers.ts` (`/providers*` + `/model`) registered in `cli/src/commands/command-registry.ts`. Includes `/providers:bind`, `/providers:unbind`, `/providers:bindings` as of 0.1.5.
- SDK Path C — `sdk/src/impl/model-provider.ts` (one-line hook dispatch since 1.0.3). State exports: `BYOKProfile`, `setActiveByokProfile`, `setByokAgentBindings`. Resolution logic moved to fork-impls (see below).
- Backend skip gate — `sdk/src/impl/database.ts` (one-line hook dispatch since 1.0.3). Logic in `sdk/src/impl/fork-impls/backend-skip.ts`.
- BYOK agent templates — `.agents/mod-default.ts`, `mod-lite.ts`, `mod-max.ts`, `mod-plan.ts`. mod-default + mod-max spawn upstream sub-agents (file-picker, code-searcher, thinker, code-reviewer) as of 0.1.5.
- Launcher (npm) — `cli/release/index.js` (`packageName: 'codebuff-mod'`, fetches binary from `github.com/EstarinAzx/codebuff-modded/releases`)
- Rip plan — `.claude/byok-rip-implementation-plan.md`

Hook registry + fork-impls (added 1.0.3 shim refactor):

- Registry contract — `sdk/src/impl/fork-hooks.ts` (`ForkHooks` interface, `registerForkHooks()`, `getForkHooks()`). Upstream files call `getForkHooks().<name>?.(...)` for fork-local dispatch.
- Boot registration — `cli/src/init/init-app.ts` calls `registerForkHooks({...})` before `setActiveByokProfile()` / `setByokAgentBindings()`.
- SDK impls:
  - `sdk/src/impl/fork-impls/byok-resolver.ts` — Path C resolution (raw-key + codex OAuth), per-agent binding lookup, `BYOKProfile`-to-LanguageModel.
  - `sdk/src/impl/fork-impls/backend-skip.ts` — `shouldSkipBackend()` + synthetic-user fallback.
  - `sdk/src/impl/fork-impls/runid-synth.ts` — `forkAwareStartAgentRun` wrap (BYOK runId UUID synth — keeps `run-agent-step.ts` byte-identical to upstream).
- CLI impls:
  - `cli/scripts/fork-impls/scan-mod-agents.ts` — `.agents/mod-*` bundle scan.
  - `cli/src/fork-impls/preset-add-handlers.ts` — codex async `/providers:add` handler.
- ~~Web impl~~ — `web/src/fork-impls/provider-dispatch.ts` (opencode-go backend override) was deleted in the strategy-B sync. opencode-go now dispatches via BYOK Path C only.

## Related

- [[overview]]
- [[active-work]]
- [[decisions]]
- [[gotchas]]
- [MERGE-STRATEGY.md](../MERGE-STRATEGY.md)
