---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-19
tags: [context, active-work]
ship: 0.2.1 (built, unreleased)
---

# Active Work

_Last updated: 2026-05-19 by Opus 4.7_
_At commit: `modded` working tree on 0.2.0 tip `b06feb335` + 0.2.1 unstaged edits_

## Current focus

0.2.1 codex OAuth preset feature built. Typecheck clean across `@codebuff/cli`
and `@codebuff/sdk`. Not yet committed, tagged, or shipped — user has not asked
for build / publish.

## State

- **In flight — 0.2.1 (unstaged):** new `codex` provider preset that wires
  ChatGPT OAuth into the BYOK profile system. `/providers:add codex [name]`
  opens the existing Codex-compatible OAuth PKCE flow (already in
  `cli/src/utils/chatgpt-oauth.ts`), persists per-profile tokens to a NEW
  `~/.config/manicode/codex-oauth.json` keyed by profile id, and stores a
  stub profile in `providers.json` with empty `apiKey` + `oauthProfileId`
  field. SDK Path C in `model-provider.ts` branches on `oauthProfileId`:
  resolves valid creds via `getValidCodexCredentials(profileId)`
  (with disk-backed refresh), then dispatches through the existing OpenAI
  OAuth model factory (`createOpenAIOAuthModel`) — same ChatGPT backend
  surface as `/connect:chatgpt`. Multi-account works because tokens are
  keyed per-profile (different ChatGPT accounts → different codex profiles).
  Per-agent bindings work transparently (binding pushes `oauthProfileId`
  through `buildSdkBindings`). `/providers:remove` on a codex profile also
  calls `clearCodexCredentials(profileId)`. `/connect:chatgpt` kept as-is
  (still writes the legacy singleton in `credentials.json#chatgptOAuth`).
  `/model` for codex probes `https://chatgpt.com/backend-api/models` with
  the OAuth bearer; on failure user can still swap directly with
  `/model <id>`. Files touched:
  - `cli/src/utils/providers.ts` (preset entry + `oauthProfileId` field
    + sanitizer + `addProfile` auto-fill)
  - `cli/src/utils/providers-models.ts` (`codex: []` + new
    `fetchCodexModelsFromEndpoint`)
  - `cli/src/utils/chatgpt-oauth.ts` (new `connectCodexOAuthForProfile` +
    `disconnectCodexProfileOAuth`)
  - `cli/src/commands/providers.ts` (codex branch in `handleProvidersAdd`,
    new async `handleProvidersAddCodex`, codex cleanup in
    `handleProvidersRemove`, OAuth probe in `handleModelCommand`,
    `syncSdkActiveProfile` carries `oauthProfileId`)
  - `cli/src/commands/command-registry.ts` (async `providers:add` handler
    that dispatches codex → `handleProvidersAddCodex`)
  - `cli/src/init/init-app.ts` (boot pushes `oauthProfileId` into SDK)
  - `sdk/src/codex-credentials.ts` (NEW — per-profileId OAuth CRUD +
    refresh, mirrors `credentials.ts` pattern but keyed-by-profileId)
  - `sdk/src/impl/model-provider.ts` (BYOKProfile gains `oauthProfileId`;
    Path C branches to OAuth dispatch when set; rolls into existing
    `createOpenAIOAuthModel`)
  - `sdk/src/index.ts` (export new codex-credentials surface)
  - `cli/package.json` + `cli/release/package.json` → 0.2.1
- **Recently shipped — 0.2.0 (commit `b06feb335`):** dedicated
  `theme.aiPanelBorder` field added to `ChatTheme` (amber `#fbbf24`
  dark / `#d97706` light). The bordered AI prose panel now resolves
  to `aiPanelBorder ?? secondary ?? aiLine ?? foreground`, visibly
  separating from sub-agent borders (which keep `theme.secondary`
  blue-gray). Three platform tarballs uploaded at
  https://github.com/EstarinAzx/codebuff-modded/releases/tag/v0.2.0.
- **Recently shipped — 0.1.12 (commit `679464be2`):** cosmetic refinement
  of 0.1.11. The bordered AI panel now hugs only the assistant's final
  textual reply. Thinking blocks, tool calls, and sub-agent groups render
  plain above the frame; `UserErrorBanner` + `MessageFooter` stay nested
  inside it.
- **Recently shipped — 0.1.10 (commit `1709a34ce` + docs sync
  `2700c5f07`):** closed two BYOK gates 0.1.7 missed.
- **Typecheck for 0.2.1:** `bun run --filter='@codebuff/cli'
  --filter='@codebuff/sdk' typecheck` clean.
- **Test status:** 14 pre-existing failures from 0.1.10 baseline unchanged.
  No new tests added for codex preset yet (browser-flow tests would need
  fixturing). Behavior verified by typecheck only — see "open questions"
  for the runtime probe risk.
- **Working tree:** unstaged 0.2.1 edits + untracked `.context/image/`.

## Pick up here

- **Commit + ship 0.2.1.** Stage the 9 touched files + `cli/release/`,
  write commit, then native+cross build → tar → tag → release.
- **Manual smoke before shipping:** run `bun dev`, `/providers:add codex`,
  complete browser flow, verify creds land in `codex-oauth.json` and
  `/model` probe works against `chatgpt.com/backend-api/models` (the
  endpoint shape is unverified — see open question).

## Open questions (carry-over + new)

- **`chatgpt.com/backend-api/models` endpoint may not exist** — codex CLI
  uses a fixed catalog. If the probe 404s, `/model` falls back to
  "Swap directly: /model <id>" per user design call (no hardcoded fallback
  list). Acceptable but unverified. First post-ship smoke test should
  confirm. If 404 is permanent, consider a curated allowlist from
  `OPENROUTER_TO_OPENAI_MODEL_MAP` (already present in common).
- **Token refresh ergonomics** — `getValidCodexCredentials` refreshes on
  demand within Path C dispatch, but a refresh failure mid-conversation
  throws into the agent loop. Surface clearer reconnect hint?
- **`oauthProfileId` rename** — currently equals `profile.id`. The two
  could diverge if we ever want multi-profile-shared OAuth, but unlikely;
  field exists mostly as a forward-compat hook.
- **`/connect:chatgpt` deprecation** — kept alongside per user; if the
  codex preset proves to be the canonical path, retire the singleton
  flow in a future minor.
- **macOS x64 + arm64 binaries** — still deferred. 0.2.0 ships only
  win32-x64, linux-x64, linux-arm64. 0.2.1 will inherit the same set.
- **Phase 3b/c OpenTUI providers panel** — still worth doing now that
  text-mode `/providers*` commands cover the full feature surface?
- **Hard-delete `web/` and `freebuff/`** once 0.1.x/0.2.x stays stable?
  Path B is gated behind `CODEBUFF_USE_BACKEND=1` with zero known
  consumers.
- **Delete `LoginModal` + `cli/src/login/*`** — provably unreachable
  post-0.1.10 since `app.tsx` gates on env.

## Security carry-over

- Previously-leaked OpenCode key revoked at opencode.ai on 2026-05-19.
  Revoked key string still sits in plaintext in
  `~/.config/manicode/message-history.json`. User declined a scrub.
- New `~/.config/manicode/codex-oauth.json` follows same 0600 posture as
  `providers.json` and `credentials.json`. Tokens stored in plaintext;
  same threat model as the existing `credentials.json#chatgptOAuth`
  singleton it sits alongside.

## Skills for next session

- `/to-issues` — if macOS binaries / web+freebuff deletion / login
  dead-code removal get turned into trackable tickets.
- `/grill-me` — if scoping any of the deferred items.

## Recent context

- 0.2.1 codex preset reuses 100% of the existing Codex-compatible OAuth
  machinery — same client_id (`app_EMoamEEZ73f0CkXaXp7hrann`), same
  `codex_cli_rs` originator, same `chatgpt.com/backend-api/codex/responses`
  endpoint. The only new surface is per-profileId keyed storage so multiple
  ChatGPT accounts can coexist as distinct BYOK profiles. The legacy
  singleton (`credentials.json#chatgptOAuth`) is untouched so
  `/connect:chatgpt` keeps working independently.
- 0.2.1 added `BYOKProfile.oauthProfileId?` as an optional SDK contract
  field. Path C resolves it BEFORE the direct-provider path: when set, the
  request flows through `createOpenAIOAuthModel` (same factory that powers
  Path A direct-OAuth requests) with the per-profile token. apiKey is
  ignored on these profiles. Backward-compatible for any SDK consumer that
  only constructs old-shape `BYOKProfile` literals.
- 0.2.0 differentiates prose panel border from sub-agent borders by
  introducing a dedicated `theme.aiPanelBorder` field (amber).
- 0.1.12 narrows the 0.1.11 border so only the assistant's final prose
  is framed.
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
