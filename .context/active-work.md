---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-07-03
tags: [context, active-work]
ship: 1.3.2 (SHIPPED 2026-07-04 — Codex visible-summary fix; npm latest + GH release live)
focus: nothing in flight — 1.3.2 shipped (prompt-only fix, not yet live-confirmed on Codex)
---

# Active Work

_Last updated: 2026-07-03 by Fable 5 (auto)_
_At commit: `51ff4872e` (1.3.0 bump) + post-ship docs commit on `modded`._

## Current focus

**v1.3.2 SHIPPED 2026-07-04 — Codex OAuth "no final response" fix (template).**
1.3.1's reasoning round-trip did NOT fix the reported symptom (verified: user
ran 1.3.1, bug persisted — logs showed agent `mod-max`, clean loop end, no
error, no final text). Real cause found: the `mod-max`/`mod-default`
`instructionsPrompt` "Todo closure" block said *"the summary IS the work for
the summarize todo — mark it complete in the same `write_todos` call"*, which a
reasoning model (Codex) reads literally as check-the-box-and-exit, skipping the
visible summary prose (its internal reasoning isn't shown). Non-reasoning models
wrote prose anyway → Codex-only. Fix (`fb9dcf0a4`): both templates now require
the written summary as a visible message BEFORE `end_turn`, decoupled from the
checkbox, with an explicit "reasoning isn't shown" note. Bump `60ecd2617`, tag
`v1.3.2`. Shipped MERGE-STRATEGY §Step 6 (3 tarballs @1.3.2 → GH release → npm
`codebuff-mod@1.3.2` = `latest`, verified via registry direct).
**Caveat: prompt-only, best-effort, NOT live-confirmed** — user chose ship over
source smoke. If it recurs, escalate to a structural agent-runtime guard
(detect an empty final top-level turn) — bigger, merge-riskier.

---

**v1.3.1 SHIPPED 2026-07-03 — Codex OAuth reasoning round-trip fix.** After
1.3.0, a user reported Codex/ChatGPT **OAuth** models running tools (todos)
then returning no final response. Root cause: `chatgpt-backend-fetch.ts`
requested encrypted reasoning (`include: ['reasoning.encrypted_content']`,
`store:false`) and streamed it back, but never replayed it — `convertMessages`
had no reasoning branch, so Codex lost chain-of-thought across the tool loop
and sometimes emitted an empty final turn. Fix caches each turn's reasoning
item by `call_id` (from the completed response `output`) and re-injects it
before its `function_call` on the next request. Commit `a1242f470` (via PR #1),
bump `0be8c24f0`, tag `v1.3.1`. Shipped the standard manual way
(MERGE-STRATEGY §Step 6): 3 tarballs rebuilt @1.3.1, GH release, npm
`codebuff-mod@1.3.1` = `latest` (verified). Smoke-tested from source pre-ship
(multi-step tool loop now answers every run). New test
`sdk/src/impl/__tests__/chatgpt-backend-reasoning.test.ts`.

---

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

- **In flight:** nothing — **v1.3.2 SHIPPED** (npm `codebuff-mod@1.3.2`
  `latest` verified via registry-direct; GH release
  https://github.com/EstarinAzx/codebuff-modded/releases/tag/v1.3.2
  with 3 tarballs verified by name+size; `modded` + `v1.3.2` tag
  pushed). 1.3.0/1.3.1 remain tagged.
- **Open:** 1.3.2 is prompt-only — confirm on a live Codex OAuth run that
  `mod-max` now emits a visible summary on read-only/explore tasks. If not,
  escalate (structural guard).
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
