---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-19
tags: [context, active-work]
ship: shim-shipped (modded tip = 495258086, pre-shim archived at v1.0.2-pre-shim)
---

# Active Work

_Last updated: 2026-05-19 by Opus 4.7 (auto)_
_At commit: `modded` tip `495258086` (shim-shipped, smoke green)_

## Current focus

Nothing in flight. Shim refactor shipped — `modded` now points at the
previously-`modded-shim` tip. Old `modded` archived as `modded-pre-shim`
+ tagged `v1.0.2-pre-shim` for rollback. Smoke passed.

## State

- **In flight:** nothing.
- **Recently shipped — shim swap (modded → 495258086):**
  Replaced the in-place fork edits across ~30 upstream files with hook
  dispatches into a fork-impls registry. 8 of 9 file-family shims
  shipped (#5-7 React hooks reverted due to bun-compile tree-shaking).
  Empirical conflict surface vs `upstream/main`: 1393 → 1177 lines
  edited (~15% reduction). Modified-file count flat (40 → 41). Plan
  target of 70% drop missed; deferred work tracked below.
- **Branch state:**
  - `modded` → `495258086` (ships next release)
  - `modded-pre-shim` → `6048b92ba` (1.0.2 ship anchor, never deleted)
  - tag `v1.0.2-pre-shim` → same commit (rollback marker)
  - Remote synced: force-pushed `modded`, archive branch + tag pushed.
- **Binaries:**
  - `cli/bin/codebuff-mod.exe` → shim binary (current)
  - `cli/bin/codebuff-mod.pre-shim.exe` → rollback binary
- **Blocked:** none.
- **Typecheck at shim ship:** clean across all packages.
- **Test status:** modded baseline preserved (14 pre-existing failures
  unchanged). 19 BYOK tests green (model-provider-byok +
  database-byok-skip + database).
- **Smoke result:** passed per user — codex OAuth, `/providers:bind`
  agent spawn, raw-key Path C, banner art, `/logout` BYOK short-circuit.
- **Working tree:** clean.

## Pick up here

No active task. If next upstream merge is genuinely painful (>20
conflicting files), revisit deferred shim work below.

## Deferred (only chase if real merge pain returns)

- **Heavy-file deeper shims.** Three files still hold large in-place
  edits and could shim further if upstream starts touching them:
  - `cli/src/commands/command-registry.ts` (176+ lines added —
    codex preset wiring beyond just the dispatch shim)
  - `cli/src/components/message-block.tsx` (164+ lines —
    aiPanelBorder rendering logic, not just the resolver)
  - `web/src/app/api/v1/chat/completions/_post.ts` (80+/54- —
    opencode-go ladder still inline-edited despite hook)
- **bun-compile tree-shaking repro.** Why does bun's `--compile` mode
  drop side-effect hook registrations even with `sideEffects`
  allowlist + `pre-init/` placement? If repro found + fixed, shims
  #5-7 (3 React hooks) ship and the refactor delivers closer to plan.
- **`ForkHooks.shouldSkipReactHook` dead field.** Registry exposes
  the slot but no caller uses it after the #5-7 revert. Harmless to
  leave; ~10 lines to remove.
- **`byok-resolver.ts` style asymmetry.** SDK uses explicit
  `registerXxxHooks()`; CLI uses inline IIFE. Stylistic only, not
  broken.

## Open questions (carry-over)

- **`codexspark` / `codexplan` aliases unverified for OAuth-bearer path.**
  Included in 1.0.1 with caveat. One-line revert in
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
- **Phase 3b/c OpenTUI providers panel** — text-mode covers full surface;
  visual wizard still nice-to-have.
- **Hard-delete `web/` and `freebuff/`** once shim stays stable. Path B
  is gated behind `CODEBUFF_USE_BACKEND=1` with zero known consumers.
- **Delete `LoginModal` + `cli/src/login/*`** — provably unreachable
  post-0.1.10 since `app.tsx` gates on env.
- **Origin remote URL stale** — `origin` still points at
  `EstarinAzx/codebuff` historically; now resolves to `codebuff-modded`.
  GitHub redirects; pushes emit a "repository moved" notice.

## Security carry-over

- Previously-leaked OpenCode key revoked at opencode.ai on 2026-05-19.
  Revoked key string still sits in plaintext in
  `~/.config/manicode/message-history.json`. User declined a scrub.
- `~/.config/manicode/codex-oauth.json` (added 0.2.1) follows 0600
  posture matching `providers.json` and `credentials.json`. Tokens
  stored in plaintext; same threat model as the singleton it sits beside.
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

## Recent context

- Shim refactor (was `modded-shim` branch) merged into `modded` via
  rename swap. Old `modded` archived as `modded-pre-shim` + tagged
  `v1.0.2-pre-shim`. Force-pushed origin/modded to new tip after smoke.
- Empirical conflict-surface measurement vs `upstream/main` showed
  ~15% LOC reduction in modified files (1393 → 1177), modified-file
  count flat (40 → 41). Below plan target of 70%, mostly because
  shims #5-7 (React hooks) were reverted due to bun-compile
  tree-shaking dropping the fork-hook registration in the compiled
  binary even after sideEffects allowlist + pre-init/ placement.
- 31 added files in fork-impls/ dirs are zero-conflict by design.
- Modded-shim worktree dir at `D:\.claude\claude projects\modded-shim\`
  was project-context tracking for the refactor itself, not a separate
  checkout. Can be deleted; the actual code lives on `modded` now.

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
