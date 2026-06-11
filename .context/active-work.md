---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-06-11
tags: [context, active-work]
ship: 1.1.1 (SHIPPED — opaque black chat input box, bleed-through fix; npm + GH release live)
focus: nothing in flight — 1.1.1 shipped
---

# Active Work

_Last updated: 2026-06-11 by Fable 5 (auto)_
_At commit: `modded` tip `834b4a50c` (the 1.1.1 bump commit; `v1.1.1` tag) — pushed. Working tree clean (untracked `.codeboarding/` only)._

## Current focus

**Nothing in flight. SHIPPED v1.1.1 (2026-06-11)** — patch release fixing
TUI background bleed-through in the chat input box. The normal-mode input
box painted no background; its children render transparent cells, so
unpainted cells showed stale framebuffer content (yellow separator line
through the placeholder row). Fix: opaque `#000000` fill on the input box
(`cli/src/components/chat-input-bar.tsx:376`, commit `0d5a84979`).
Hardcoded black per user preference over `theme.surface` (user wants it
to blend with terminal bg). See [[gotchas]] "OpenTUI transparent cells
don't repaint" for the general trap.

v1.1.0 (strategy-B BYOK-only sync) context unchanged — rationale in
[[decisions]], merge+release mechanics in
[MERGE-STRATEGY.md](../MERGE-STRATEGY.md).

## State

- **In flight:** nothing.
- **modded:** `v1.1.1` tag at `834b4a50c`, pushed to `origin/modded`.
- **Release artifacts (v1.1.1):**
  - npm `codebuff-mod@1.1.1` live (`latest`), 9.4 kB launcher.
  - GitHub release
    https://github.com/EstarinAzx/codebuff-modded/releases/tag/v1.1.1
    — three tarballs: win32-x64, linux-x64, linux-arm64 (~47–50 MB),
    asset names verified against `cli/release/index.js` PLATFORM_TARGETS.
  - `cli/bin/` + `cli/dist-binaries/` hold the 1.1.1 builds (gitignored).
- **Verify at ship (1.1.1):** cli typecheck green; win32 binary prints
  `1.1.1`; user eyeballed the opaque box via `bun run dev` (gate passed).
  CLI test suite NOT re-run this session (UI-only change; the 2 known-stale
  `providers*` fails from 1.1.0 still stand — see below).
- **Branches/tags:** unchanged from 1.1.0 — `modded-pre-shim` (v1.0.2
  archive), pre-sync tip `e534b0650` (backend-restore source), `upstream`
  remote → `CodebuffAI/codebuff`.
- **Blocked:** none.

## Pick up here

Nothing required — 1.1.1 is out. Optional follow-ups (carried from 1.1.0):

- **Live BYOK smoke on the published binary** — still unrun headless.
  `npm i -g codebuff-mod` → `/providers:add <preset> <key>` → small
  prompt → confirm Path C dispatches. Also confirms cross-compiled linux
  tarballs run on actual linux (built on Windows).
- **Fix the 2 stale CLI tests** — `providers-models.test.ts` asserts
  `MODEL_CATALOG['opencode-go'].length > 0` (false since v1.0.6) and
  `providers.test.ts` asserts schema `version === 1` (fork is on v2/v3).
- **Light-theme follow-up (new, minor):** input box bg is hardcoded
  `#000000`; light theme would show a black box. Dark-only conditional
  (`theme.surface` on light) if anyone runs light theme.
- **Same bleed risk elsewhere (new, minor):** the askUser questions box
  (`chat-input-bar.tsx` askUserState branch) still paints no background —
  same transparent-cell bleed possible there. One-line fix if reported.
- **Next upstream sync** — follow MERGE-STRATEGY.md as-is (turnkey).

## Deferred — chase only if it surfaces

- **`opencode` (Zen) preset still hardcoded.** v1.0.6 fixed only
  `opencode-go`. The sibling `opencode` Zen preset keeps its 2-id
  hardcoded catalog (`['opencode/minimax-m2.7', 'opencode/kimi-k2.6']`)
  with the same `opencode/`-prefix bug — endpoint
  (`https://opencode.ai/zen/v1/models`) live-serves ~40 ids. One-line
  fix mirroring v1.0.6 if a user reports it.
- **3 un-shimmed React hooks.** `use-connection-status`,
  `use-gravity-ad`, `use-agent-validation` still hold in-place
  `BYOK_AT_BOOT` logic (bun-compile tree-shook the shim — see
  [[gotchas]] "Fork-hook registration silently no-ops if tree-shaken").
- **`ForkHooks.shouldSkipReactHook` dead field.** ~10 lines to remove.
- **macOS binaries** (`darwin-x64`/`darwin-arm64`) — `build-binary.ts`
  supports the targets; not shipped.
- **Delete `LoginModal` + `cli/src/login/*`** — provably unreachable
  post-0.1.10.

## Open questions (carry-over)

- **`codexspark` / `codexplan` aliases unverified for OAuth-bearer
  path.** One-line revert in `OPENROUTER_TO_OPENAI_MODEL_MAP` if either
  4xx's.
- **Token refresh ergonomics** — `getValidCodexCredentials` refresh
  failure mid-conversation throws into the agent loop. Clearer
  reconnect hint?
- **`/connect:chatgpt` deprecation** — retire the singleton in a future
  minor?

## Security carry-over

- Previously-leaked OpenCode key revoked at opencode.ai on 2026-05-19.
  Revoked key string still in plaintext in
  `~/.config/manicode/message-history.json`. User declined a scrub.
- `~/.config/manicode/codex-oauth.json` follows 0600, tokens in
  plaintext — same threat model as `providers.json` / `credentials.json`.

## Rollback paths

- **Undo the v1.1.0 strategy-B sync** (restore the backend): pre-sync tip
  `e534b0650` has `web/` + `packages/internal` intact —
  `git checkout e534b0650 -- web packages/internal packages/billing
  packages/bigquery packages/build-tools scripts` restores those trees.
- **Pre-shim (v1.0.2) rollback** still anchored by tag
  `v1.0.2-pre-shim` + branch `modded-pre-shim` + binary
  `cli/bin/codebuff-mod.pre-shim.exe`.
- **Undo 1.1.1 fix only:** revert `0d5a84979` (single-file, 5 added lines).

## Skills for next session

- `/to-issues` — if macOS binaries / login dead-code removal / the
  2 stale tests get turned into trackable tickets.
- `/grill-me` — if scoping any deferred item.

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
- [MERGE-STRATEGY.md](../MERGE-STRATEGY.md)
