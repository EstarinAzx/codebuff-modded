---
type: stack
project: codebuff (fork — modded branch)
updated: 2026-05-19
tags: [stack, tooling, byok]
---

# Stack

## Runtime + package manager

- **Bun** 1.3.x (workspaces, runtime, test runner) — see `package.json` `workspaces`
- **TypeScript** monorepo, ESM (`"type": "module"`)
- **Node** target where Next.js/undici need it (server routes, streaming)

## Frameworks

- **Next.js** — `web/` app + API routes (the proxy backend)
- **OpenTUI + React** — `cli/` TUI
- **undici** `Agent` — long-lived HTTP dispatcher for upstream LLM streams
- **Zod v4** — env schema + request validation
- **Drizzle** — see `packages/internal/db:*` scripts

## External services

Upstream (only reachable when `CODEBUFF_USE_BACKEND=1` is set OR no BYOK profile is active):

- **LLM providers** — Anthropic, OpenAI, Gemini (via OpenRouter), DeepSeek, Fireworks, Moonshot, CanopyWave, SiliconFlow, OpenCode Zen, OpenCode Go (fork-added — see [[active-work]])
- **Stripe** — credit billing
- **BigQuery** — usage/audit telemetry
- **PostHog** — analytics
- **Discord / GitHub / Loops** — auth + email + bot integrations
- **ipinfo** — geo classification for free-mode

BYOK (default for `codebuff-mod` CLI, post-rip):

- User's own provider key against any of the 11 presets in `cli/src/utils/providers.ts` — openai, anthropic, openrouter, opencode, opencode-go, deepseek, gemini, mistral, together, groq, custom-openai
- Direct HTTP via SDK Path C (`sdk/src/impl/model-provider.ts createDirectProviderModel`) — no codebuff.com hop
- No central billing, analytics, or auth — `~/.config/manicode/providers.json` (chmod 0600) is the only state

## Workspaces

`.agents`, `common`, `web`, `freebuff`, `freebuff/web`, `packages/*`, `scripts`, `evals`, `sdk`, `agents`, `cli`

## Commands

| Action | Command |
|---|---|
| Install | `bun install` |
| Dev (cli) | `bun dev` (alias for `bun start-cli`) |
| Dev (web) | `bun start-web` (boots DB first) |
| Typecheck (all) | `bun run typecheck` |
| Test | `bun run test` |
| Format | `bun run format` |
| Stop services | `bun down` |
| Clean TS artifacts | `bun run clean-ts` |
| Build CLI binary (native) | `cd cli && bun run build:binary` |
| Build CLI binary (cross) | `OVERRIDE_TARGET=bun-linux-x64 OVERRIDE_PLATFORM=linux OVERRIDE_ARCH=x64 bun run build:binary` (see [[gotchas]] for spaced-path workaround) |
| Publish launcher | `cd cli/release && npm publish` |
| Tag + release binaries | `git tag vX.Y.Z && git push origin vX.Y.Z && gh release create vX.Y.Z --repo EstarinAzx/codebuff-modded dist-binaries/*.tar.gz` (manual tar from `cli/bin/` — build script does NOT auto-tar; see [[gotchas]]) |

## Key paths

Upstream surface (mostly dead in BYOK mode):

- LLM provider handlers — `web/src/llm-api/*.ts` (one file per upstream)
- Chat-completions dispatch — `web/src/app/api/v1/chat/completions/_post.ts`
- Model catalog (whitelist) — `common/src/constants/model-config.ts`
- Env schema — `packages/internal/src/env-schema.ts` (server) and `common/src/env-schema.ts` (client)
- Agent templates — `agents/` (bundled at build time) + `.agents/` (loaded at runtime)

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
- Web impl:
  - `web/src/fork-impls/provider-dispatch.ts` — opencode-go provider override hook.
