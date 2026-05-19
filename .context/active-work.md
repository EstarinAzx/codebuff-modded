---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-19
tags: [context, active-work]
ship: 1.0.0 (in flight)
---

# Active Work

_Last updated: 2026-05-19 by Opus 4.7_
_At commit: `modded` tip `dee29cd54` (0.2.1 ship) + 1.0.0 unstaged edits_

## Current focus

1.0.0 codex `/model` fix: replace the dead `chatgpt.com/backend-api/models`
probe with a fixed catalog derived from `OPENROUTER_TO_OPENAI_MODEL_MAP`.
Implements `.claude/codex-models-fix-plan.md`.

## State

- **In flight — 1.0.0 (unstaged):** the codex preset's `/model` listing
  now returns immediately from the catalog branch in `getModelsForPreset`
  instead of probing the ChatGPT backend. Catalog source of truth is the
  OAuth allowlist keys (`Object.keys(OPENROUTER_TO_OPENAI_MODEL_MAP)`),
  so adding an id to the allowlist auto-populates the picker — no second
  edit. Deleted `fetchCodexModelsFromEndpoint` from
  `cli/src/utils/providers-models.ts` and the corresponding import +
  ternary in `cli/src/commands/providers.ts handleModelCommand`; the codex
  branch now routes through the same `getModelsForPreset` orchestrator
  every other preset uses. Source labels in the picker output are now
  `curated catalog` / `live <url>/models` / `cached <url>/models` /
  `free-text (no list available)` instead of the codex-specific
  `ChatGPT backend /models` blurb. Cache layer untouched; codex
  short-circuits before it. Files touched (4 per plan):
  - `cli/src/utils/providers-models.ts` (-1 import +1, swap `codex: []`
    for derived catalog, delete `fetchCodexModelsFromEndpoint`)
  - `cli/src/commands/providers.ts` (drop `fetchCodexModelsFromEndpoint`
    import, replace codex ternary with `getModelsForPreset` call)
  - `.context/gotchas.md` (replace "may not list anything" with "ships
    a fixed catalog")
  - `.context/active-work.md` (this file)
  Plus version bumps: `cli/package.json` + `cli/release/package.json`
  → 1.0.0.
- **Recently shipped — 0.2.1 (commit `dee29cd54`):** codex OAuth as a
  BYOK preset. `/providers:add codex [name]` opens browser OAuth, saves
  per-profile tokens to `~/.config/manicode/codex-oauth.json`, dispatches
  through the existing `createOpenAIOAuthModel` factory via new
  `BYOKProfile.oauthProfileId` field. The `/model` listing in 0.2.1 was
  broken — see 1.0.0 fix above.
- **Recently shipped — 0.2.0 (commit `b06feb335`):** dedicated
  `theme.aiPanelBorder` field added to `ChatTheme` (amber `#fbbf24`
  dark / `#d97706` light).
- **Recently shipped — 0.1.12 (commit `679464be2`):** cosmetic refinement
  of 0.1.11. Bordered AI panel now hugs only the assistant's final
  textual reply.
- **Recently shipped — 0.1.10 (commit `1709a34ce` + docs sync
  `2700c5f07`):** closed two BYOK gates 0.1.7 missed.
- **Typecheck for 1.0.0:** pending (run before commit).
- **Test status:** 14 pre-existing failures from 0.1.10 baseline
  unchanged. No new tests touched.
- **Working tree:** unstaged 1.0.0 edits.

## Pick up here

Nothing — 1.0.0 is the active build. Once shipped, the codex preset
should be considered v1-ready (browser OAuth + working `/model` picker).

## Open questions (carry-over)

- **Token refresh ergonomics** — `getValidCodexCredentials` refreshes on
  demand within Path C dispatch, but a refresh failure mid-conversation
  throws into the agent loop. Surface clearer reconnect hint?
- **`oauthProfileId` rename** — currently equals `profile.id`. The two
  could diverge if we ever want multi-profile-shared OAuth.
- **`/connect:chatgpt` deprecation** — kept alongside per user; if the
  codex preset proves to be the canonical path, retire the singleton
  flow in a future minor.
- **macOS x64 + arm64 binaries** — still deferred. 1.0.0 ships only
  win32-x64, linux-x64, linux-arm64.
- **Phase 3b/c OpenTUI providers panel** — still worth doing now that
  text-mode `/providers*` commands cover the full feature surface?
- **Hard-delete `web/` and `freebuff/`** once 0.2.x/1.0.x stays stable?
  Path B is gated behind `CODEBUFF_USE_BACKEND=1` with zero known
  consumers.
- **Delete `LoginModal` + `cli/src/login/*`** — provably unreachable
  post-0.1.10 since `app.tsx` gates on env.

## Resolved this ship (1.0.0)

- **`chatgpt.com/backend-api/models` endpoint may not exist** — confirmed
  dead for OAuth-bearer tokens. Replaced live probe with fixed catalog
  derived from `OPENROUTER_TO_OPENAI_MODEL_MAP`. Mirrors Codex CLI's own
  pattern (it also ships a baked catalog). Catalog and dispatch allowlist
  now share a single source of truth.

## Security carry-over

- Previously-leaked OpenCode key revoked at opencode.ai on 2026-05-19.
  Revoked key string still sits in plaintext in
  `~/.config/manicode/message-history.json`. User declined a scrub.
- `~/.config/manicode/codex-oauth.json` (added 0.2.1) follows same 0600
  posture as `providers.json` and `credentials.json`. Tokens stored in
  plaintext; same threat model as the existing singleton it sits
  alongside.

## Skills for next session

- `/to-issues` — if macOS binaries / web+freebuff deletion / login
  dead-code removal get turned into trackable tickets.
- `/grill-me` — if scoping any of the deferred items.

## Recent context

- 1.0.0 reverts 0.2.1's wishful "probe endpoint that doesn't exist" design
  in favor of a static catalog. The catalog is *not* an independent list —
  it is the keys of `OPENROUTER_TO_OPENAI_MODEL_MAP`, so the OAuth dispatch
  allowlist and the user-visible picker can never drift apart. Adding a
  model id to the allowlist now also adds it to `/model` listings.
- 0.2.1 added the codex preset itself (OAuth + per-profile token storage +
  Path C dispatch). That core is stable in 1.0.0 — only the model listing
  was broken.
- 0.2.0 differentiates prose panel border from sub-agent borders by
  introducing a dedicated `theme.aiPanelBorder` field (amber).
- 0.1.10 propagated the `CODEBUFF_USE_BACKEND !== '1'` env-gate from
  two surfaces (added in 0.1.7) to four more, closing the fresh-install
  lockout fully.
- `build:binary` runs `prebuild-agents` + sdk build internally; output
  lands in `cli/bin/`, then must be hand-tarred into `dist-binaries/`.
- bun cross-compile to Linux from Windows still needs the `C:\cb`
  junction workaround (see [[gotchas]]).

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
