---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-06-11
tags: [context, active-work]
ship: 1.1.0 (SHIPPED — strategy-B upstream snapshot sync, BYOK-only, npm + GH release live)
focus: nothing in flight — 1.1.0 shipped
---

# Active Work

_Last updated: 2026-06-11 by Opus 4.8 (auto)_
_At commit: `modded` tip past `b4ddf600b` (the `v1.1.0` release commit) + post-release doc commits. Working tree clean (untracked `.codeboarding/` only)._

## Current focus

**Nothing in flight. SHIPPED v1.1.0 (2026-06-11) — strategy-B upstream
snapshot sync, fork is now BYOK-only.** Verified Windows-side by the
user; live BYOK provider smoke + linux-binary run still unrun (see Pick
up here). Full rationale in [[decisions]] "Ride upstream's snapshot
deletion to a BYOK-only fork (strategy B)"; merge+release mechanics in
[MERGE-STRATEGY.md](../MERGE-STRATEGY.md) (rewritten for the lean tree).

What the sync brought in (from upstream): Composio meta-tools, `read_url`
tool, web-search via Serper (was Linkup), models MiMo (`mimo-v2.5`/`-pro`)
+ MiniMax M3 (`minimax/minimax-m3`), commander-based `cli/src/cli-args.ts`.
What it removed: `web/` backend + `packages/{internal,billing,bigquery,
build-tools}` + full `scripts/` (rode upstream's deletion). All 1.0.6
BYOK features intact (verified fork feature-files byte-identical pre-sync).

## State

- **In flight:** nothing.
- **modded:** `v1.1.0` tag at `b4ddf600b`; tip carries post-release
  `.context/` + MERGE-STRATEGY doc commits (pushed to `origin/modded`).
- **Release artifacts (v1.1.0):**
  - npm `codebuff-mod@1.1.0` live (`latest`), 9.4 kB launcher.
  - GitHub release
    https://github.com/EstarinAzx/codebuff-modded/releases/tag/v1.1.0
    — three tarballs: win32-x64, linux-x64, linux-arm64 (~47–50 MB).
  - `cli/bin/` holds the 1.1.0 builds; `cli/dist-binaries/*.tar.gz` the
    three 1.1.0 tarballs. Both dirs are gitignored (artifacts never in
    git). `cli/bin/codebuff-mod.pre-shim.exe` = v1.0.2 rollback binary.
- **Branches/tags:** `modded` (release line), `modded-pre-shim`
  (`6048b92ba`, v1.0.2 archive). Pre-sync `modded` tip = `e534b0650`
  (last commit with `web/` + `packages/internal` in tree — restore
  source if the backend is ever wanted back). `upstream` remote →
  `CodebuffAI/codebuff`; `origin/main` mirrors it (snapshot-only).
- **Verify at ship:** per-package typecheck green (sdk/common/cli; no
  root aggregate anymore — see [[gotchas]]). SDK BYOK tests 54/54.
  CLI `providers*` = 40 pass / **2 known-stale fails** (opencode-go
  catalog assertion + schema-version assertion — both assert pre-1.0.6
  behavior, not regressions). `build:binary` green on all 3 platforms.
- **Blocked:** none.

## Pick up here

Nothing required — 1.1.0 is out. Optional follow-ups:

- **Live BYOK smoke on the published binary** — only validation not run
  headless. `npm i -g codebuff-mod` (or let auto-update pull 1.1.0),
  then `/providers:add <preset> <key>` → small prompt → confirm Path C
  dispatches against a real provider. Also confirms the cross-compiled
  **linux** tarballs actually run on linux (built on Windows).
- **Fix the 2 stale CLI tests** — `providers-models.test.ts` asserts
  `MODEL_CATALOG['opencode-go'].length > 0` (false since v1.0.6) and
  `providers.test.ts` asserts schema `version === 1` (fork is on v2/v3).
- **Next upstream sync** — follow MERGE-STRATEGY.md as-is; it's now
  turnkey for both merge AND release. Future syncs are smaller (the big
  320k-deletion divergence was one-time; strategy decision is settled).

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

- **Undo the v1.1.0 strategy-B sync** (restore the backend): the whole
  97-commit sync + merge is one `--no-ff` unit. The pre-sync tip
  `e534b0650` has `web/` + `packages/internal` intact —
  `git checkout e534b0650 -- web packages/internal packages/billing
  packages/bigquery packages/build-tools scripts` restores those trees.
- **Pre-shim (v1.0.2) rollback** still anchored by tag
  `v1.0.2-pre-shim` + branch `modded-pre-shim` + binary
  `cli/bin/codebuff-mod.pre-shim.exe`.

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
