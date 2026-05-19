---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-19
tags: [context, active-work]
ship: 1.0.4 (shipped — todo-closure enforcement)
---

# Active Work

_Last updated: 2026-05-19 by Opus 4.7 (auto)_
_At commit: `modded` tip `0395ffbc3` (v1.0.4 release commit, tag pinned)_

## Current focus

Nothing in flight. Just shipped v1.0.4 — template-only patch enforcing
todo closure before `end_turn` in mod-default + mod-max. Three platform
tarballs on GitHub Releases + launcher live on npm. No SDK / agent-runtime
/ hook changes — pre-shim binary completely unaffected.

## State

- **In flight:** nothing.
- **Recently shipped — v1.0.4 (tag commit `0395ffbc3`):**
  - Added "Todo closure (mandatory before `end_turn`)" block to
    `instructionsPrompt` in `.agents/mod-default.ts` + `.agents/mod-max.ts`.
    Forces a final `write_todos` call resolving every item to
    complete/cancelled before `end_turn`. Closes the recurring papercut
    where the final summary todo stayed unchecked because the model
    treated the summary message itself as completion.
  - Template-only — zero changes to SDK, agent-runtime, hooks, or
    shim infrastructure. Pre-shim binary behavior identical.
  - Three platform tarballs at https://github.com/EstarinAzx/codebuff-modded/releases/tag/v1.0.4
  - npm: `codebuff-mod@1.0.4` live on registry (sha
    `63a98948224c68011c85baab32cc906e79b9e22a`).
- **Previously shipped — v1.0.3 (tag commit `e2e3efa18`):**
  - Hook-registry shim refactor: ~30 in-place fork edits → one-line
    `getForkHooks().<name>?.(...)` dispatches. Logic moved to
    `*/fork-impls/` dirs; registry at `sdk/src/impl/fork-hooks.ts`.
  - 8 of 9 file-family shims landed; #5–7 (React hooks `BYOK_AT_BOOT`)
    reverted — bun-compile tree-shook the fork-hook registration.
  - Conflict surface vs `upstream/main`: 1393 → 1177 lines (~15% cut).
- **Branch state:**
  - `modded` → `0395ffbc3` (v1.0.4 release tip)
  - `modded-pre-shim` → `6048b92ba` (v1.0.2 anchor, archive)
  - Tag `v1.0.2-pre-shim` pins `6048b92ba` independently.
  - Tag `v1.0.3` pins shim refactor release `e2e3efa18`.
  - Tag `v1.0.4` pins template-patch release `0395ffbc3`.
  - `upstream` remote configured against `CodebuffAI/codebuff`.
- **Binaries:**
  - `cli/bin/codebuff-mod.exe` → v1.0.4 build (todo-closure patch)
  - `cli/bin/codebuff-mod.pre-shim.exe` → v1.0.2 rollback
- **Blocked:** none.
- **Typecheck at ship:** not re-run for v1.0.4 (template-only change,
  no TS surface touched). Last green run was v1.0.3 ship.
- **Test status:** modded baseline preserved from v1.0.3 (14 pre-existing
  failures unchanged; 19 BYOK tests green). No new tests for v1.0.4 —
  prompt-only change, validated empirically by user.
- **Smoke result for v1.0.4:** pending — patch addresses a user-reported
  UX bug (todo "Summarize" left unchecked after `linelens` task).
  Validate by re-running the `wordfreq` / `linelens` style multi-todo
  prompt on v1.0.4 and confirming the final list closes cleanly.
- **Working tree:** clean.

## Pick up here

No active task. If next upstream merge produces >20 conflicting files,
revisit deferred work below. If v1.0.4 smoke shows todo-closure still
fails, consider strengthening the patch further (e.g. agent-runtime-side
auto-close on `end_turn` instead of relying on prompt compliance — out
of scope for v1.0.4 but tractable).

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
