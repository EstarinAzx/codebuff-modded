---
type: stack
project: codebuff (fork — modded branch)
updated: 2026-05-18
tags: [stack, tooling]
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

- **LLM providers** — Anthropic, OpenAI, Gemini (via OpenRouter), DeepSeek, Fireworks, Moonshot, CanopyWave, SiliconFlow, OpenCode Zen, OpenCode Go (fork-added — see [[active-work]])
- **Stripe** — credit billing
- **BigQuery** — usage/audit telemetry
- **PostHog** — analytics
- **Discord / GitHub / Loops** — auth + email + bot integrations
- **ipinfo** — geo classification for free-mode

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

## Key paths

- LLM provider handlers — `web/src/llm-api/*.ts` (one file per upstream)
- Chat-completions dispatch — `web/src/app/api/v1/chat/completions/_post.ts`
- Model catalog — `common/src/constants/model-config.ts`
- Env schema — `packages/internal/src/env-schema.ts`
- Agent templates — `agents/` + `.agents/`
