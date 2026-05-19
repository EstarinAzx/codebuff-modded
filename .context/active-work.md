---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-19
tags: [context, active-work]
ship: 1.0.2 (shipped)
---

# Active Work

_Last updated: 2026-05-19 by Opus 4.7 (auto)_
_At commit: `modded` tip `a6b230bea` (1.0.2 ship)_

## Current focus

Nothing in flight. Just shipped 1.0.2 — one-line cosmetic gap fix so the
0.2.0 amber AI-prose panel border doesn't visually kiss the chat
input bar's top edge, plus a full MERGE-STRATEGY.md sync covering every
fork-local surface added between 0.1.10 and 1.0.1.

## State

- **In flight:** nothing.
- **Recently shipped — 1.0.2 (commit `a6b230bea`):** `cli/src/chat.tsx`
  scrollbox `contentOptions.paddingBottom: 1` (was 0). One-row gap below
  last message inside the scrollbox so the amber AI panel border no
  longer abuts the input frame. Targets only the scrollbox-to-input
  boundary; inter-message spacing untouched. Same commit also synced
  `MERGE-STRATEGY.md` with the 0.2.x → 1.0.x conflict map: new HIGH-risk
  zones (`OPENROUTER_TO_OPENAI_MODEL_MAP` single source of truth, codex
  catalog wiring, codex async `/providers:add` handler), new MEDIUM-risk
  Path C-oauth in SDK + `oauthProfileId` schema field + `aiPanelBorder`
  theme key, LOW-risk banner art and env-architecture allowlist, new
  ZERO-conflict `sdk/src/codex-credentials.ts`, plus seven added
  sanity-check rows including a codex-OAuth smoke test. Three platform
  tarballs at https://github.com/EstarinAzx/codebuff-modded/releases/tag/v1.0.2.
- **Blocked:** none.
- **Typecheck at 1.0.2 ship:** not re-run; cosmetic single-line edit in
  a previously-clean file. 1.0.1 typecheck was clean.
- **Test status:** 14 pre-existing failures from 0.1.10 baseline
  unchanged. No new tests added.
- **Working tree:** clean post-commit-and-push.
- **Smoke result:** user reported the bleed visually; fix verified by
  reasoning about layout (last scrollbox row was the prose box's bottom
  border, adjacent to the input box top border). Visual recheck still
  owed before next ship.

## Pick up here

No active task. If the user reports the gap is too tight or too wide,
tune `paddingBottom` in `cli/src/chat.tsx` scrollbox `contentOptions`
(currently 1). Carry-over items below are unforced.

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
- **macOS x64 + arm64 binaries** — still deferred. 1.0.x ships only
  win32-x64, linux-x64, linux-arm64.
- **Phase 3b/c OpenTUI providers panel** — text-mode covers full surface;
  visual wizard still nice-to-have.
- **Hard-delete `web/` and `freebuff/`** once 1.0.x stays stable. Path B
  is gated behind `CODEBUFF_USE_BACKEND=1` with zero known consumers.
- **Delete `LoginModal` + `cli/src/login/*`** — provably unreachable
  post-0.1.10 since `app.tsx` gates on env.
- **Origin remote URL stale** — `origin` still points at
  `EstarinAzx/codebuff`; GitHub redirects to `codebuff-modded` but pushes
  emit a "repository moved" notice. Update with
  `git remote set-url origin https://github.com/EstarinAzx/codebuff-modded.git`?

## Security carry-over

- Previously-leaked OpenCode key revoked at opencode.ai on 2026-05-19.
  Revoked key string still sits in plaintext in
  `~/.config/manicode/message-history.json`. User declined a scrub.
- `~/.config/manicode/codex-oauth.json` (added 0.2.1) follows 0600
  posture matching `providers.json` and `credentials.json`. Tokens
  stored in plaintext; same threat model as the singleton it sits beside.

## Skills for next session

- `/to-issues` — if macOS binaries / web+freebuff deletion / login
  dead-code removal get turned into trackable tickets.
- `/grill-me` — if scoping any of the deferred items.

## Recent context

- 1.0.2 ship was a single-line cosmetic fix surfaced from a user
  screenshot. Root cause: scrollbox `contentOptions` had no
  `paddingBottom`, so the last AI message's amber panel border occupied
  the scrollbox's final row and visually merged with the input bar's
  top border immediately below.
- `MERGE-STRATEGY.md` had been frozen at 0.1.10 surfaces — this session
  brought it forward to cover 0.1.11 / 0.1.12 / 0.2.0 / 0.2.1 / 1.0.0 /
  1.0.1 conflict zones. Coverage note at top of the file names the
  ship-date / commit anchor so future merges can detect drift fast.
- Repo at GitHub was renamed `codebuff` → `codebuff-modded` between
  1.0.1 and 1.0.2 ships. Releases now live at
  `EstarinAzx/codebuff-modded`. The launcher in `cli/release/index.js`
  still hard-codes `EstarinAzx/codebuff` as `RELEASE_REPO`; GitHub
  redirects so first-run downloads keep working, but the URL should be
  updated next ship.

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
