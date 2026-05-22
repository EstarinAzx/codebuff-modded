---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-22
tags: [context, active-work]
ship: 1.0.6 (shipped — opencode-go live model probe)
---

# Active Work

_Last updated: 2026-05-22 by Opus 4.7 (auto)_
_At commit: `modded` tip `3ce439802` (v1.0.6 release commit, tag pinned)_

## Current focus

Nothing in flight. Just shipped v1.0.6 — `opencode-go` preset now
live-probes its `/models` endpoint instead of serving a one-id
hardcoded catalog. Full release: three platform tarballs on GitHub
Releases + `codebuff-mod@1.0.6` on npm.

## State

- **In flight:** nothing.
- **Recently shipped — v1.0.6 (tag commit `3ce439802`):**
  - `cli/src/utils/providers-models.ts` — moved `opencode-go` out of
    the hardcoded `MODEL_CATALOG` (was `['opencode-go/glm-5']`, a
    single id) into the empty-catalog set. Empty catalog → orchestrator
    live-probes `https://opencode.ai/zen/go/v1/models`, same path as
    openrouter / together / groq. Endpoint serves 15+ ids; `/model`
    and the `/providers:add` picker now list them all (24h disk cache,
    busted by `/providers:refresh-models`).
  - Also fixes a latent prefix bug: the old catalog id carried an
    `opencode-go/` prefix, but Path C dispatch sends the model id raw
    to the endpoint, which expects bare ids (e.g. `glm-5`). Probe
    results are already raw — the fix removes the mismatch.
  - One-file logic change + two version bumps. No SDK / agent-runtime
    / hook changes.
  - Three platform tarballs at
    https://github.com/EstarinAzx/codebuff-modded/releases/tag/v1.0.6
  - npm: `codebuff-mod@1.0.6` live (`latest`), launcher 9.4 kB.
- **Previously shipped — v1.0.5 (tag commit `c20f080d9`):**
  - Two TUI rendering bug fixes. `message-block.tsx`: shrink
    `availableWidth` by 4 inside the amber AI panel (2 border + 2
    padding cols) so inner elements like `AskUserBranch` stop seeping
    past the amber box. `chat-input-bar.tsx`: always set `minHeight: 3`
    on the input content wrapper so the bordered box can't collapse and
    bleed border chars through text.
  - Bug fixes to the 0.2.0 `aiPanelBorder` work — no new decision.
- **Previously shipped — v1.0.4 (tag commit `0395ffbc3`):**
  - Todo-closure enforcement block added to `instructionsPrompt` in
    `.agents/mod-default.ts` + `.agents/mod-max.ts`.
- **Previously shipped — v1.0.3 (tag commit `e2e3efa18`):**
  - Hook-registry shim refactor — ~30 in-place fork edits → one-line
    `getForkHooks().<name>?.(...)` dispatches. See [[decisions]].
- **Branch state:**
  - `modded` → `3ce439802` (v1.0.6 release tip)
  - `modded-pre-shim` → `6048b92ba` (v1.0.2 anchor, archive)
  - Fork tags: `v1.0.0`–`v1.0.6` + `v1.0.2-pre-shim`. (The many
    `v1.0.3XX`–`v1.0.6XX` tags are upstream `CodebuffAI/codebuff`
    tags pulled by the `upstream` remote fetch — not fork releases.)
  - `upstream` remote configured against `CodebuffAI/codebuff`.
- **Binaries:**
  - `cli/bin/codebuff-mod.exe` → v1.0.6 win32-x64 build
  - `cli/bin/codebuff-mod` → v1.0.6 linux-arm64 (last cross-compile
    artifact — overwritten each linux build; not a stable "current"
    binary, just leftover from the release tar step)
  - `cli/bin/codebuff-mod.pre-shim.exe` → v1.0.2 rollback
  - `cli/dist-binaries/*.tar.gz` → the three v1.0.6 release tarballs
- **Blocked:** none.
- **Typecheck at ship:** not re-run for v1.0.6 (one-line catalog
  change, no TS surface touched). Last green run was v1.0.3 ship.
- **Test status:** modded baseline preserved (14 pre-existing
  failures unchanged; 19 BYOK tests green). No new tests for v1.0.6 —
  catalog data change, validated empirically (probed the live
  endpoint, 200 + 15 ids).
- **Smoke result for v1.0.6:** endpoint verified live during the fix
  (`https://opencode.ai/zen/go/v1/models` → 200, 15 model ids). Full
  in-CLI smoke pending — run `/model` on an opencode-go profile after
  the binary auto-updates and confirm the list shows >1 id.
- **Working tree:** clean (untracked `.codeboarding/` + local
  `.claude/settings.local.json` only — both intentionally unstaged).

## Pick up here

No active task. If next upstream merge produces >20 conflicting files,
revisit deferred work below.

## Deferred — chase only if real merge pain returns

- **`opencode` (Zen) preset still hardcoded.** v1.0.6 fixed only
  `opencode-go`. The sibling `opencode` Zen preset keeps its 2-id
  hardcoded catalog (`['opencode/minimax-m2.7', 'opencode/kimi-k2.6']`)
  with the same `opencode/`-prefix bug — its endpoint
  (`https://opencode.ai/zen/v1/models`) live-serves ~40 ids. One-line
  fix mirroring v1.0.6 if a user reports it. Left scoped-out per
  user call.
- **Heavy-file deeper shims.** `command-registry.ts`,
  `message-block.tsx`, `web/.../_post.ts` still hold large in-place
  edits; shim further only if upstream starts touching them.
- **bun-compile tree-shake repro.** Why `--compile` drops side-effect
  hook registrations — blocks shims #5–7 (3 React hooks).
- **`ForkHooks.shouldSkipReactHook` dead field.** ~10 lines to remove.
- **`byok-resolver.ts` style asymmetry.** SDK explicit-register vs
  CLI inline IIFE. Stylistic only.

## Open questions (carry-over)

- **`codexspark` / `codexplan` aliases unverified for OAuth-bearer
  path.** One-line revert in `OPENROUTER_TO_OPENAI_MODEL_MAP` if
  either 4xx's.
- **Token refresh ergonomics** — `getValidCodexCredentials` refresh
  failure mid-conversation throws into the agent loop. Clearer
  reconnect hint?
- **`oauthProfileId` rename** — equals `profile.id` today;
  forward-compat hook for multi-profile-shared OAuth.
- **`/connect:chatgpt` deprecation** — retire singleton in a future
  minor?
- **macOS x64 + arm64 binaries** — still deferred. Ships only
  win32-x64, linux-x64, linux-arm64.
- **Phase 3b/c OpenTUI providers panel** — text-mode covers the full
  surface; visual wizard still nice-to-have.
- **Hard-delete `web/` and `freebuff/`** once the shim stays stable.
- **Delete `LoginModal` + `cli/src/login/*`** — provably unreachable
  post-0.1.10.

## Security carry-over

- Previously-leaked OpenCode key revoked at opencode.ai on 2026-05-19.
  Revoked key string still in plaintext in
  `~/.config/manicode/message-history.json`. User declined a scrub.
- `~/.config/manicode/codex-oauth.json` follows 0600, tokens in
  plaintext — same threat model as `providers.json` /
  `credentials.json`.
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
