---
type: gotchas
project: codebuff (fork — modded branch)
updated: 2026-05-19
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

## bun `--compile` chokes on spaced project paths

Cross-compiling Linux x64 / arm64 binaries from Windows fails with `Failed to extract executable for 'bun-linux-{arch}-vX.Y.Z'. The download may be incomplete.` when the project path contains spaces (e.g. `D:\.claude\claude projects\codebuff`). Bun's internal extract path inherits the spaced path and trips Windows' extraction logic. Workaround: create a junction to a spaceless path (`New-Item -ItemType Junction -Path C:\cb -Target "D:\.claude\claude projects\codebuff"`), then run `bun run build:binary` from PowerShell with `cd C:\cb\cli`. Native Win x64 builds work fine from the spaced path.

## bun's bundled tar on Windows can't extract OpenTUI native bundles

`ensureOpenTuiNativeBundle()` in `cli/scripts/build-binary.ts` invokes `tar -xzf ... --force-local`. Windows ships bsdtar at `C:\Windows\System32\tar.exe` which rejects `--force-local` (GNU-only flag). Symptom: build fails extracting `@opentui/core-linux-arm64-X.Y.Z.tgz`. Workaround: pre-install the bundle via `bun add --no-save @opentui/core-linux-{arch}@<version>` (matches `optionalDependencies` in `node_modules/@opentui/core/package.json`), which lets bun handle the extract internally. Or run the build from MSYS bash where `tar` resolves to GNU tar at `/usr/bin/tar`.

## `prebuild-agents.ts` bundles `agents/` plus `.agents/mod-*.ts`

The script at `cli/scripts/prebuild-agents.ts` walks the upstream `agents/` directory **and** picks up fork-local `.agents/mod-*.ts` (filtered by `mod-` prefix) so the BYOK templates ship inside the CLI binary. End users running `cbm` from any cwd resolve mod-default/lite/max/plan against the bundle, not the filesystem. The runtime `.agents/` scan in `cli/src/utils/local-agent-registry.ts` still loads user-side overrides from the cwd and can replace bundled agents with the same id.

Adding a new fork-local agent: if the id starts with `mod-`, drop the file in `.agents/` and re-run `bun run scripts/prebuild-agents.ts` before `build:binary`. Other `.agents/` files (claude-code-cli.ts, codex-cli.ts, notion-*) are deliberately excluded from the bundle — they're user-side overrides, not first-party fork templates.

## `BYOK_AT_BOOT` in React hooks is now env-first, profile-second

Since 0.1.10, the `BYOK_AT_BOOT` flag in `use-connection-status`, `use-gravity-ad`, and `use-agent-validation` returns `true` whenever `process.env.CODEBUFF_USE_BACKEND !== '1'` *regardless* of profile state, falling back to `getActiveProfile() !== null` only under the explicit backend escape hatch. The name is now slightly misleading — the flag fires whenever the codebuff.com backend is disabled at boot, not strictly when BYOK is "active." Kept the name to avoid renaming churn. If you add a new backend-touching hook that needs to be skipped in fork default mode, mirror the same pattern (env check first, profile check as a fallback under `CODEBUFF_USE_BACKEND=1`).

## Adding a profile mid-session still leaves stale BYOK gates (escape-hatch only)

The boot-time pinning trade-off only matters now when running under the explicit `CODEBUFF_USE_BACKEND=1` escape hatch — a user there who registers their first BYOK profile via `/providers:add` mid-session continues to see ads / "connecting…" / silent validation failures until they restart the CLI. In default BYOK mode the env-gate fires first so this is moot. The agent-runtime side (SDK Path C dispatch) DOES re-check the singleton per request and works without restart — only the React-side gates are pinned at boot.

## BYOK runId must be truthy, not just non-null

`packages/agent-runtime/src/run-programmatic-step.ts:130-132` throws `Agent state has no run ID` if `agentState.runId` is falsy — including the empty string. `run-agent-step.ts:685` therefore synthesizes a `byok-<agentId>-<uuid>` fallback whenever `startAgentRun()` returns null. Anyone tempted to "simplify" this back to `?? ''` will re-introduce the 0.1.5 crash on every spawned `handleSteps` sub-agent (thinker, file-picker, code-searcher, code-reviewer). Empty-string keys would also collide in `runIdToGenerator` across concurrent programmatic agents — bad. Keep the UUID synthesis.

## Per-agent BYOK bindings are pushed at boot, but live on the SDK side

`setByokAgentBindings()` is called from `cli/src/init/init-app.ts` at startup and re-called by every `/providers:bind` / `/providers:unbind` / `/providers:remove` handler. The SDK reads the map per request, so binding changes take effect on the next agent spawn without restart.

But the *React-side* `BYOK_AT_BOOT` gates in `use-connection-status`, `use-gravity-ad`, `use-agent-validation` are still pinned at module load (see the existing gotcha below about mid-session profiles). Adding bindings mid-session does not flip those gates — only adding the *first* profile does. Same restart caveat applies if you go from zero profiles to bindings in one session.

## Zero BYOK profiles = lockout pre-0.1.7 (fully closed in 0.1.10)

Before 0.1.7, a user with **no provider profile** AND no codebuff.com `credentials.json` was hard-locked out of the CLI. The startup gate (`index.tsx`) and `validateApiKey` (`use-auth-query.ts`) only had BYOK escape hatches that gated on `getActiveProfile()` truthy — so with zero profiles the CLI fell back to the dead codebuff.com `LoginModal`, whose `POST /api/auth/cli/code` hits `http://127.0.0.1:1` (unset backend) and fails. `LoginModal` renders before the chat input, so there was no in-app way to reach `/providers:add`. Triggered by: fresh `npm i -g codebuff-mod`, `/logout`, or `/providers:remove`-ing the last profile.

0.1.7 closed the boot-time lockout: `index.tsx` and `validateApiKey` skip the gate whenever `CODEBUFF_USE_BACKEND !== '1'`. 0.1.10 closed two follow-on holes that 0.1.7 missed:

1. **"Connecting…" stuck on fresh installs.** Three React hooks (`use-connection-status`, `use-gravity-ad`, `use-agent-validation`) only had profile-based BYOK gates — fresh install (no profile yet) bypassed the gates and hit the unset codebuff.com endpoints in a loop. 0.1.10 made these env-first (see the `BYOK_AT_BOOT` gotcha above).
2. **`/logout` re-triggered the lockout.** The `/logout` handler called `setIsAuthenticated(false)`, which satisfied the `LoginModal` render gate in `app.tsx` (`requireAuth !== null && isAuthenticated === false && authStatus === 'ok'`). 0.1.10 added a `CODEBUFF_USE_BACKEND !== '1'` env-check to that gate and short-circuited the `/logout` command itself in BYOK default mode (it now prints a pointer to `/providers:remove` instead of mutating auth state).

If you ever need to manually unlock an older binary (pre-0.1.10), hand-write `~/.config/manicode/providers.json` with one structurally-valid profile (`sanitizeProfile` requires only `id`, `name`, `preset`, `provider`, `baseUrl` — `apiKey` may be empty) and set `activeProfileId` to its id.

## `.context/active-work.md` rolling state — past sessions are gone

The handoff file is rewritten from scratch each `/context-update`. The git log + the in-tree plan doc at `.claude/byok-rip-implementation-plan.md` are the only persistent record of how we got from upstream codebuff to standalone BYOK. Don't put session history in active-work.md; it belongs in commits.
