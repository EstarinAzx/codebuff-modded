---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-19
tags: [context, active-work]
ship: 1.0.1 (shipped)
---

# Active Work

_Last updated: 2026-05-19 by Opus 4.7_
_At commit: `modded` tip `4edf9c166` (1.0.1 ship)_

## Current focus

Nothing in flight. Codex OAuth preset is v1-ready: `/providers:add codex`
opens browser OAuth, multi-account works, per-agent bindings work,
`/model` lists 22 routable ids with GPT-5.5 at top. User confirmed
end-to-end working before close of session.

## State

- **In flight:** nothing.
- **Recently shipped — 1.0.1 (commit `4edf9c166`):** expanded
  `OPENROUTER_TO_OPENAI_MODEL_MAP` from 10 → 22 entries. New ids:
  `gpt-5.5` (top of picker), `gpt-5.4-mini`, `gpt-5.3-codex-spark`,
  `gpt-5.1-codex-max`, `gpt-5.1-codex-mini`, `gpt-5-mini`, `o4-mini`,
  `o3`, `gpt-4.1`, `gpt-4.1-mini`, `codexspark`, `codexplan`. Single
  source of truth: `Object.keys(map)` feeds both the OAuth allowlist
  (`isChatGptOAuthModelAllowed`) and the codex picker catalog
  (`MODEL_CATALOG.codex`) — adding one key auto-flows to both. Files
  touched (1): `common/src/constants/chatgpt-oauth.ts` + version bump.
  Three platform tarballs at
  https://github.com/EstarinAzx/codebuff-modded/releases/tag/v1.0.1.
- **Recently shipped — 1.0.0 (commit `9c027af8e`):** fixed broken codex
  `/model` listing. 0.2.1's live probe against
  `https://chatgpt.com/backend-api/models` was wishful — the route
  doesn't exist for OAuth-bearer tokens (Codex CLI itself ships a fixed
  catalog for the same reason). Replaced with a static catalog derived
  from `OPENROUTER_TO_OPENAI_MODEL_MAP`, routed through the same
  `getModelsForPreset` orchestrator every other preset uses. Files
  touched (4): `cli/src/utils/providers-models.ts` (delete
  `fetchCodexModelsFromEndpoint`, derive `codex` catalog),
  `cli/src/commands/providers.ts` (replace codex ternary in
  `handleModelCommand` with single `getModelsForPreset` call),
  `.context/gotchas.md` (rewrite codex picker entry),
  `.context/active-work.md`.
- **Recently shipped — 0.2.1 (commit `dee29cd54`):** codex OAuth as a
  BYOK preset. `/providers:add codex [name]` runs the existing
  Codex-compatible OAuth PKCE flow (originator `codex_cli_rs`),
  persists per-profile tokens to NEW `~/.config/manicode/codex-oauth.json`
  keyed by profile id, stores a stub profile in `providers.json` with
  empty `apiKey` + new `oauthProfileId` field. SDK Path C in
  `model-provider.ts` branches on `oauthProfileId`: resolves valid creds
  via `getValidCodexCredentials(profileId)` (disk-backed refresh,
  de-duplicated per profileId) and dispatches through the existing
  `createOpenAIOAuthModel` factory — same ChatGPT-backend code path as
  `/connect:chatgpt`. Multi-account works (different ChatGPT accounts =
  different codex profiles). Per-agent bindings work (binding pushes
  `oauthProfileId` through `buildSdkBindings`). `/providers:remove` on
  a codex profile also calls `clearCodexCredentials(profileId)`.
  `/connect:chatgpt` kept alongside (still writes legacy singleton in
  `credentials.json#chatgptOAuth`). Cosmetic: full ASCII logo now reads
  "CODEBUFF - M1" for the 0.2.1 cut.
- **Recently shipped — 0.2.0 (commit `b06feb335`):** dedicated
  `theme.aiPanelBorder` field added to `ChatTheme` (amber `#fbbf24`
  dark / `#d97706` light).
- **Typecheck at 1.0.1 ship:** `bun run --filter='@codebuff/cli'
  --filter='@codebuff/sdk' typecheck` clean.
- **Test status:** 14 pre-existing failures from 0.1.10 baseline
  unchanged. No new tests added for codex preset (browser-flow tests
  would need fixturing).
- **Working tree:** clean (only untracked are `.claude/codex-models-*-plan.md`
  one-off plan docs from this session).
- **Smoke result:** user confirmed `/providers:add codex` flow, `/model`
  picker showing 22 entries, and agent dispatch through OAuth all
  working before closing session.

## Pick up here

No active task. Open questions below are carry-over from prior sessions
and remain unforced.

## Open questions (carry-over)

- **`codexspark` / `codexplan` aliases unverified for OAuth-bearer path.**
  Included in 1.0.1 expansion with caveat. If either 4xx's on first real
  use, one-line revert in `OPENROUTER_TO_OPENAI_MODEL_MAP` removes it.
- **Token refresh ergonomics** — `getValidCodexCredentials` refreshes on
  demand within Path C dispatch, but a refresh failure mid-conversation
  throws into the agent loop. Surface clearer reconnect hint?
- **`oauthProfileId` rename** — currently equals `profile.id`. Two could
  diverge if multi-profile-shared OAuth ever wanted; forward-compat hook
  only today.
- **`/connect:chatgpt` deprecation** — kept alongside per user. Codex
  preset is now the canonical OAuth path; retire singleton in future
  minor?
- **macOS x64 + arm64 binaries** — still deferred. 0.2.x and 1.0.x ship
  only win32-x64, linux-x64, linux-arm64.
- **Phase 3b/c OpenTUI providers panel** — text-mode `/providers*` +
  `/model` cover full surface; visual wizard still nice-to-have.
- **Hard-delete `web/` and `freebuff/`** once 1.0.x stays stable in the
  wild. Path B is gated behind `CODEBUFF_USE_BACKEND=1` with zero known
  consumers.
- **Delete `LoginModal` + `cli/src/login/*`** — provably unreachable
  post-0.1.10 since `app.tsx` gates on env.

## Security carry-over

- Previously-leaked OpenCode key revoked at opencode.ai on 2026-05-19.
  Revoked key string still sits in plaintext in
  `~/.config/manicode/message-history.json`. User declined a scrub.
- `~/.config/manicode/codex-oauth.json` (added 0.2.1) follows 0600
  posture matching `providers.json` and `credentials.json`. Tokens
  stored in plaintext; same threat model as the existing singleton it
  sits alongside.

## Skills for next session

- `/to-issues` — if macOS binaries / web+freebuff deletion / login
  dead-code removal get turned into trackable tickets.
- `/grill-me` — if scoping any of the deferred items.

## Recent context

- Codex OAuth preset is the headline feature of the 0.2.1 → 1.0.0 → 1.0.1
  arc. 0.2.1 added the OAuth flow + per-profile storage + Path C
  dispatch. 1.0.0 fixed the broken `/model` picker by switching from a
  wishful live probe to a static catalog derived from the OAuth
  allowlist. 1.0.1 expanded that allowlist with 12 known-routable ids
  including GPT-5.5.
- `OPENROUTER_TO_OPENAI_MODEL_MAP` in `common/src/constants/chatgpt-oauth.ts`
  is now the single source of truth for: (a) the OAuth allowlist check
  on the non-BYOK global ChatGPT OAuth path, and (b) the codex profile
  picker catalog. Add a key, both update automatically. Adding new
  routable model ids is a one-line change.
- BYOK codex profiles skip `isChatGptOAuthModelAllowed` — Path C
  dispatches the resolved model string straight through to
  `createOpenAIOAuthModel` with no allowlist gate. Only the backend
  itself can reject (4xx at request time); existing error path surfaces
  cleanly. The allowlist still matters for the non-BYOK global path and
  for the picker UX.
- `build:binary` runs `prebuild-agents` + sdk build internally; output
  lands in `cli/bin/`, then must be hand-tarred into `dist-binaries/`.
- bun cross-compile to Linux from Windows still needs the `C:\cb`
  junction workaround (see [[gotchas]]).
- Ship sequence used three times this session: native Win build → tar →
  cross-compile linux-x64 → tar → cross-compile linux-arm64 → tar →
  push branch → push tag → `gh release create` with all three tarballs
  → `npm publish` from `cli/release/`.

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
