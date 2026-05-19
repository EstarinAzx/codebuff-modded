---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-19
tags: [context, active-work]
ship: 1.0.3 (shipped — shim refactor)
---

# Active Work

_Last updated: 2026-05-19 by Opus 4.7 (auto)_
_At commit: `modded` tip `f9798607d` (MERGE-STRATEGY refresh on top of v1.0.3)_

## Current focus

Nothing in flight. Just shipped v1.0.3 — shim-refactor release.
Behavior identical to 1.0.2; refactor cuts upstream-merge friction by
~15% LOC in modified files (empirical, vs `upstream/main`). Three
platform tarballs on GitHub Releases + launcher live on npm. Docs
synced (active-work + MERGE-STRATEGY). Pre-shim rollback anchored at
branch `modded-pre-shim` + tag `v1.0.2-pre-shim`.

## State

- **In flight:** nothing.
- **Recently shipped — v1.0.3 (tag commit `e2e3efa18`):**
  - Refactored ~30 in-place fork edits to one-line hook dispatches via
    new `sdk/src/impl/fork-hooks.ts` registry + `*/fork-impls/`
    implementation dirs.
  - 8 of 9 file-family shims landed; #5–7 (React hooks `BYOK_AT_BOOT`)
    reverted — bun-compile tree-shook the fork-hook registration even
    after `sideEffects` allowlist + `pre-init/` placement.
  - Empirical conflict surface vs `upstream/main`: 1393 → 1177 lines
    in modified files (~15% reduction). Modified-file count flat
    (40 → 41 — one extra file because of fork-impls registration
    plumbing in `init-app.ts` + `sdk/src/index.ts`).
  - Three platform tarballs at https://github.com/EstarinAzx/codebuff-modded/releases/tag/v1.0.3
  - npm: `codebuff-mod@1.0.3` live on registry.
- **Branch state:**
  - `modded` → `f9798607d` (release tip + docs)
  - `modded-pre-shim` → `6048b92ba` (v1.0.2 anchor, archive)
  - Tag `v1.0.2-pre-shim` pins `6048b92ba` independently.
  - Tag `v1.0.3` pins the release commit `e2e3efa18`.
  - `upstream` remote configured against `CodebuffAI/codebuff`.
- **Binaries:**
  - `cli/bin/codebuff-mod.exe` → v1.0.3 shim build
  - `cli/bin/codebuff-mod.pre-shim.exe` → v1.0.2 rollback
- **Blocked:** none.
- **Typecheck at ship:** clean across all packages.
- **Test status:** modded baseline preserved (14 pre-existing failures
  unchanged; 19 BYOK tests green).
- **Smoke result:** passed per user — codex OAuth, `/providers:bind`
  spawn, raw-key Path C, banner art, `/logout` BYOK short-circuit.
- **Working tree:** clean.

## Pick up here

No active task. If next upstream merge produces >20 conflicting files,
revisit deferred work below.

## Deferred — chase only if real merge pain returns

- **Heavy-file deeper shims.** Three files still hold large in-place
  edits and could shim further if upstream starts touching them:
  - `cli/src/commands/command-registry.ts` (176+ lines — codex
    preset wiring + `/logout` BYOK branch beyond just the dispatch
    shim)
  - `cli/src/components/message-block.tsx` (164+ lines —
    aiPanelBorder rendering logic, not just the resolver)
  - `web/src/app/api/v1/chat/completions/_post.ts` (80+/54- —
    opencode-go ladder still inline despite override hook)
- **bun-compile tree-shake repro.** Why does bun's `--compile` mode
  drop side-effect hook registrations even with `sideEffects`
  allowlist + `pre-init/` placement? If a minimal repro lands a fix,
  shims #5–7 (3 React hooks) can ship and the refactor delivers
  closer to plan.
- **`ForkHooks.shouldSkipReactHook` dead field.** Registry exposes
  the slot but no caller uses it after the #5–7 revert. Harmless to
  leave; ~10 lines to remove.
- **`byok-resolver.ts` style asymmetry.** SDK uses explicit
  `registerXxxHooks()`; CLI uses inline IIFE in `init-app.ts`.
  Stylistic only, not broken.

## Open questions (carry-over)

- **`codexspark` / `codexplan` aliases unverified for OAuth-bearer
  path.** Included in 1.0.1 with caveat. One-line revert in
  `OPENROUTER_TO_OPENAI_MODEL_MAP` if either 4xx's on first real use.
- **Token refresh ergonomics** — `getValidCodexCredentials` refreshes
  on demand within Path C dispatch, but a refresh failure mid-conversation
  throws into the agent loop. Surface a clearer reconnect hint?
- **`oauthProfileId` rename** — equals `profile.id` today; forward-compat
  hook for multi-profile-shared OAuth.
- **`/connect:chatgpt` deprecation** — kept alongside the codex preset.
  Retire singleton in a future minor?
- **macOS x64 + arm64 binaries** — still deferred. Ships only
  win32-x64, linux-x64, linux-arm64.
- **Phase 3b/c OpenTUI providers panel** — text-mode covers full
  surface; visual wizard still nice-to-have.
- **Hard-delete `web/` and `freebuff/`** once shim stays stable.
  Path B is gated behind `CODEBUFF_USE_BACKEND=1` with zero known
  consumers.
- **Delete `LoginModal` + `cli/src/login/*`** — provably unreachable
  post-0.1.10 since `app.tsx` gates on env.
- **Origin remote URL stale** — `origin` already points at
  `EstarinAzx/codebuff-modded.git` as of this session's push.
  Confirmed via `git remote -v`.

## Security carry-over

- Previously-leaked OpenCode key revoked at opencode.ai on 2026-05-19.
  Revoked key string still sits in plaintext in
  `~/.config/manicode/message-history.json`. User declined a scrub.
- `~/.config/manicode/codex-oauth.json` (added 0.2.1) follows 0600
  posture matching `providers.json` and `credentials.json`. Tokens
  stored in plaintext; same threat model as the singleton it sits
  beside.
- Pre-shim swap backup: `~/.config/manicode/providers.json.shim-bak`.

## Rollback path (if shim turns sour later)

```powershell
cd "D:\.claude\claude projects\codebuff"
git branch -m modded modded-shim-broken
git branch -m modded-pre-shim modded
git push origin modded --force-with-lease
# binary rollback:
Move-Item cli\bin\codebuff-mod.exe cli\bin\codebuff-mod.shim.exe -Force
Move-Item cli\bin\codebuff-mod.pre-shim.exe cli\bin\codebuff-mod.exe -Force
```

Tag `v1.0.2-pre-shim` permanently anchors the pre-shim tip; rollback
is reversible even if the archive branch is later deleted.

## Skills for next session

- `/to-issues` — if macOS binaries / web+freebuff deletion / login
  dead-code removal get turned into trackable tickets.
- `/grill-me` — if scoping any of the deferred items.

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
