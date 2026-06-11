---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-06-11
tags: [context, active-work]
ship: 1.1.2 (SHIPPED — input box blends with terminal bg via OSC 11; npm + GH release live)
focus: nothing in flight — 1.1.2 shipped
---

# Active Work

_Last updated: 2026-06-11 by Fable 5 (auto)_
_At commit: `modded` tip `4d9e48f40` (the 1.1.2 bump; `v1.1.2` tag) + this context commit — pushed. Working tree clean (untracked `.codeboarding/` only)._

## Current focus

**Nothing in flight. SHIPPED v1.1.2 (2026-06-11)** — same-day follow-up to
v1.1.1. 1.1.1 fixed TUI bleed-through with a hardcoded black input-box
fill; 1.1.2 replaces that with the terminal's own background color queried
once via OSC 11 (`cli/src/hooks/use-terminal-background.ts` →
`renderer.getPalette()`, `#000000` fallback). Box stays opaque (required —
see [[gotchas]] "OpenTUI transparent cells don't repaint") but blends
invisibly with any terminal theme. askUser questions box painted too
(same bleed risk). Commits: `230fd309c` (feat), `4d9e48f40` (bump).

v1.1.0 (strategy-B BYOK-only sync) context unchanged — rationale in
[[decisions]], merge+release mechanics in
[MERGE-STRATEGY.md](../MERGE-STRATEGY.md).

## State

- **In flight:** nothing.
- **modded:** `v1.1.2` tag at `4d9e48f40`, pushed to `origin/modded`.
- **Release artifacts (v1.1.2):**
  - npm `codebuff-mod@1.1.2` live (`latest`), 9.4 kB launcher.
  - GitHub release
    https://github.com/EstarinAzx/codebuff-modded/releases/tag/v1.1.2
    — three tarballs: win32-x64, linux-x64, linux-arm64 (~47–50 MB),
    assets verified against `cli/release/index.js` PLATFORM_TARGETS.
  - `cli/bin/` + `cli/dist-binaries/` hold the 1.1.2 builds (gitignored).
- **Verify at ship (1.1.2):** cli typecheck green; win32 binary prints
  `1.1.2`; user eyeballed terminal-bg blend via `bun run dev` (gate
  passed). CLI test suite NOT re-run (UI-only change; the 2 known-stale
  `providers*` fails from 1.1.0 still stand — see below).
- **Branches/tags:** unchanged — `modded-pre-shim` (v1.0.2 archive),
  pre-sync tip `e534b0650` (backend-restore source), `upstream` remote →
  `CodebuffAI/codebuff`.
- **Blocked:** none.

## Pick up here

Nothing required — 1.1.2 is out. Optional follow-ups:

- **Live BYOK smoke on the published binary** (carried since 1.1.0, still
  unrun): `npm i -g codebuff-mod` → `/providers:add <preset> <key>` →
  small prompt → confirm Path C dispatches. Also confirms cross-compiled
  linux tarballs run on actual linux (built on Windows).
- **Fix the 2 stale CLI tests** — `providers-models.test.ts` asserts
  `MODEL_CATALOG['opencode-go'].length > 0` (false since v1.0.6) and
  `providers.test.ts` asserts schema `version === 1` (fork is on v2/v3).
- **OSC 11 first-paint flash (cosmetic, only if user complains):** first
  frame renders the black fallback, snaps to detected color when the
  query answers. Fix would hold initial paint until palette resolves.
- **Next upstream sync** — follow MERGE-STRATEGY.md as-is (turnkey).
  Note: `chat-input-bar.tsx` now carries fork-local edits (bg fill + the
  use-terminal-background import) — expect a trivial conflict there on
  the next sync.

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
- **Undo 1.1.2 blend only:** revert `230fd309c` → back to 1.1.1's
  hardcoded black. Undo both UI fixes: also revert `0d5a84979`.

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
