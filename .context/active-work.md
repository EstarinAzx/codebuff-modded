---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-07-03
tags: [context, active-work]
ship: 1.3.0 (SHIPPED — upstream sync 2026-07-03; npm + GH release live)
focus: nothing in flight — 1.3.0 shipped
---

# Active Work

_Last updated: 2026-07-03 by Fable 5 (auto)_
_At commit: `51ff4872e` (1.3.0 bump) + post-ship docs commit on `modded`._

## Current focus

**Upstream sync 2026-07-03 → v1.3.0 SHIPPED same day.** `modded` synced
399 snapshot commits (`upstream/main` @ `a8a8d1643`) per
[MERGE-STRATEGY.md](../MERGE-STRATEGY.md), then released:

- Merge `595adc673` — 5 conflicts resolved per map (fork launcher kept
  wholesale — see [[decisions]] 2026-07-03; `codebuff-mod` name/version
  kept; unions elsewhere).
- `9441009e6` — `WEBSITE_URL` → `getWebsiteUrl()` compile fix (upstream
  rename hit the fork's BYOK fail-fast block).
- `291d2b9e7` — win32 infinite-loop fix in upstream's new
  `project-file-tree.test.ts` helper.
- `beb66a5c5` — context wrap-up + MERGE-STRATEGY refresh (new launcher
  watch item, refreshed test baselines).
- `51ff4872e` — 1.3.0 bump (minor: /copy command, suggested prompts,
  new reviewer/base2 agents, SSRF guard are user-visible).

Upstream brought: `sdk/src/tools/ssrf.ts` SSRF guard, bounded
agent-template cache, `/copy`, suggested prompts, GLM/Kimi/MiniMax/Opus
reviewer + base2 agents, bun 1.3.14, plus freebuff-only surface (inert
in BYOK mode).

## State

- **In flight:** nothing — **v1.3.0 SHIPPED** (npm `codebuff-mod@1.3.0`
  `latest` verified; GH release
  https://github.com/EstarinAzx/codebuff-modded/releases/tag/v1.3.0
  with 3 tarballs verified by name+size; `modded` + `v1.3.0` tag
  pushed).
- **Verified pre-ship:** typecheck green common/sdk/cli; binary prints
  1.3.0; conflict-map invariant greps all pass; test suites at
  pre-existing baselines (common 1 / sdk 65 / cli 19+5err — suspicious
  ones proven pre-existing via temp worktree at `b0488029d`).
- **Not live-smoked:** the published 1.3.0 binary (carried habit —
  1.1.0/1.2.0 shipped the same way; smoke recipe below).
- **Blocked:** none.

## Pick up here

Nothing required — 1.3.0 is out. Optional:

1. **Live smoke on published binary** (carried since 1.1.0): fresh
   `npm i -g codebuff-mod` → `cbm` → `/providers:list` → small prompt
   (Path C) → `web_search` with `SERPER_API_KEY`.
2. **Fallback-chain live smoke:** Brave/Tavily key + bad Serper key.
3. **Upstream's new SSRF guard** touches `read_url` — worth one manual
   `read_url` call in BYOK mode to confirm no false-positive blocking.

## Landmines / notes

- **Upstream tests assume posix** — triage new Windows failures against
  the pre-merge commit in a temp worktree first. Baseline: common 1 /
  sdk 65 / cli 19+5err (MERGE-STRATEGY "Test baseline").
- **Never adopt upstream's `cli/release/index.js`** — downloads
  `-baseline` tarballs the fork doesn't publish ([[decisions]]
  2026-07-03; conflict-map HIGH entry).
- **`testCiEnv.SERPER_API_KEY` is load-bearing** — see [[gotchas]].
- Untracked `.codeboarding/` in repo root is the user's — keep out of
  commits.

## Deferred — chase only if it surfaces

- **`opencode` (Zen) preset still hardcoded** (2-id catalog, `opencode/`
  prefix bug) — see [[gotchas]].
- **3 un-shimmed React hooks** (`use-connection-status`, `use-gravity-ad`,
  `use-agent-validation`) — in-place `BYOK_AT_BOOT` logic.
- **`ForkHooks.shouldSkipReactHook` dead field** (~10 lines).
- **macOS binaries** — build-binary.ts supports, never shipped.
- **Baseline (non-AVX2) binaries** — port upstream launcher probe only
  together with shipping `-baseline` tarballs.
- **Delete `LoginModal` + `cli/src/login/*`** — unreachable post-0.1.10.

## Open questions (carry-over)

- `codexspark`/`codexplan` aliases unverified on OAuth-bearer path.
- Token-refresh ergonomics (`getValidCodexCredentials` throw mid-loop).
- `/connect:chatgpt` deprecation timing.

## Security carry-over

- Revoked OpenCode key still plaintext in
  `~/.config/manicode/message-history.json` (user declined scrub).
- User's Serper key pasted in-chat 2026-06-11 (transcript on disk);
  rotation advised, low stakes.
- `codex-oauth.json` 0600, tokens plaintext — same model as
  `providers.json`.

## Rollback paths

- **Undo 1.3.0:** can't unpublish npm; ship a 1.3.1 from `b0488029d`
  content if catastrophic. GH release + tag deletable.
- **Undo the sync commits:** `git revert -m 1 595adc673` + revert the
  follow-ups (now pushed — revert, don't reset).
- **Older anchors:** strategy-B restore via `e534b0650`;
  `v1.0.2-pre-shim`; UI fixes `230fd309c`/`0d5a84979`.

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
- [MERGE-STRATEGY.md](../MERGE-STRATEGY.md)
