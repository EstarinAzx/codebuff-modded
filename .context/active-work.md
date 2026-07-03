---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-07-03
tags: [context, active-work]
ship: 1.2.0 (live on npm; upstream sync merged locally after it, UNPUSHED)
focus: upstream sync 2026-07-03 merged + verified — push pending
---

# Active Work

_Last updated: 2026-07-03 by Fable 5 (auto)_
_At commit: `291d2b9e7` on `modded` (3 commits ahead of `origin/modded`)._

## Current focus

**Upstream sync 2026-07-03 (merged, verified, NOT pushed).** `modded` was
399 snapshot commits behind `upstream/main`. Synced per
[MERGE-STRATEGY.md](../MERGE-STRATEGY.md):

- `main` fast-forwarded to `upstream/main` (`a8a8d1643`), pushed.
- `595adc673` — merge into `modded`. 5 conflicts, resolved per map:
  `.gitignore` (union), `cli/release/package.json` (keep
  `codebuff-mod@1.2.0`), `cli/release/index.js` (keep fork launcher
  wholesale — see [[decisions]] 2026-07-03), `chat-input-bar.tsx` (union:
  fork OSC-11 fill + upstream shallow-scan footer), `agent-runtime.ts`
  (union: fork `forkAwareStartAgentRun` + upstream `BoundedAgentCache`).
- `9441009e6` — compile fix: fork's BYOK fail-fast in
  `model-provider.ts` repointed `WEBSITE_URL` → `getWebsiteUrl()`
  (upstream rename).
- `291d2b9e7` — fixed win32 infinite loop in upstream's new
  `common/src/__tests__/project-file-tree.test.ts` mock-fs helper
  (posix root vs `path.dirname` backslash walk; wedged the whole
  `common` bun test run with zero output).
- All conflict-map invariant greps pass (hook registrations, 2 web-tools
  dispatch blocks, chatgpt-oauth map = 22, zero `@codebuff/internal`
  imports, no `fetchCodexModelsFromEndpoint`).

Upstream brought: `sdk/src/tools/ssrf.ts` (SSRF guard for
read_url/code_search/terminal), bounded agent-template cache, `/copy`
conversation command, suggested prompts, new reviewer/base2 agents
(GLM/Kimi/MiniMax/Opus), bun 1.3.11→1.3.14, plus freebuff-only surface
(referral/streak/engagement/log-shipper — inert in BYOK mode).

## State

- **In flight:** push of `modded` (3 commits) awaiting user go — the
  wrap-up gate got no response (user AFK), so nothing was pushed.
- **Verified:** typecheck green in common/sdk/cli; binary builds and
  prints 1.2.0 (`cli/bin/codebuff-mod.exe`).
- **Test baselines (all pre-existing flavor, none merge-caused):**
  common 1 fail (`coerceToArray` zod) · sdk 65 fails (path-flavored;
  `database-byok-skip` green in isolation — fails only under full-suite
  state pollution) · cli 19 fails + 5 errors (was 18+4; the extra ones
  are new upstream test files hitting the same pre-existing
  `test-utils.ts` env gate / Immer MapSet flavor — verified pre-existing
  via temp worktree at `b0488029d`).
- **Version:** still 1.2.0 — merge is internal, no release cut. npm
  `codebuff-mod@1.2.0` unchanged/live.
- **Blocked:** none.

## Pick up here

1. **Push `modded`** (`git push origin modded`) once user eyeballs.
   No release needed unless user wants the SSRF guard + upstream fixes
   shipped — that'd be a 1.2.1 patch via the manual runbook in
   MERGE-STRATEGY.md step 6.
2. Optional carry-overs (since 1.1.0): live smoke on published binary;
   fallback-chain live smoke (needs Brave/Tavily key + bad Serper key).

## Landmines / notes

- **Upstream tests assume posix.** Two flavors seen this sync: the
  project-file-tree helper hang (fixed, `291d2b9e7`) and new test files
  erroring on the `test-utils.ts` env gate. Expect more of these per
  sync; triage by running the file at the pre-merge commit in a temp
  worktree before calling it a regression.
- **`testCiEnv.SERPER_API_KEY` is load-bearing** — see [[gotchas]].
- Untracked `.codeboarding/` dir sits in the repo root — deliberately
  left out of all commits (user's, purpose unknown).

## Deferred — chase only if it surfaces

- **`opencode` (Zen) preset still hardcoded** (2-id catalog, `opencode/`
  prefix bug). One-liner if reported — see [[gotchas]].
- **3 un-shimmed React hooks** (`use-connection-status`, `use-gravity-ad`,
  `use-agent-validation`) — in-place `BYOK_AT_BOOT` logic (untouched by
  this sync).
- **`ForkHooks.shouldSkipReactHook` dead field** (~10 lines).
- **macOS binaries** — build-binary.ts supports, never shipped.
- **Delete `LoginModal` + `cli/src/login/*`** — unreachable post-0.1.10.
- **Baseline binaries** — if non-AVX2 users appear, port upstream's
  launcher probe + ship `-baseline` tarballs together ([[decisions]]
  2026-07-03).

## Open questions (carry-over)

- `codexspark`/`codexplan` aliases unverified on OAuth-bearer path.
- Token-refresh ergonomics (`getValidCodexCredentials` throw mid-loop).
- `/connect:chatgpt` deprecation timing.

## Security carry-over

- Revoked OpenCode key still plaintext in
  `~/.config/manicode/message-history.json` (user declined scrub).
- User's Serper key was pasted in-chat 2026-06-11 → in that session's
  transcript on disk. Advised rotation; low stakes.
- `codex-oauth.json` 0600, tokens plaintext — same model as
  `providers.json`.

## Rollback paths

- **Undo this sync:** `git revert -m 1 595adc673` (then revert
  `9441009e6` + `291d2b9e7`), or hard-reset to `b0488029d` while
  unpushed.
- **Undo web-tools rewire / strategy-B / pre-shim / 1.1.x UI:** unchanged
  — see [[decisions]] and MERGE-STRATEGY.md; anchors `e534b0650`,
  `v1.0.2-pre-shim`, `230fd309c`/`0d5a84979`.

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
- [MERGE-STRATEGY.md](../MERGE-STRATEGY.md)
