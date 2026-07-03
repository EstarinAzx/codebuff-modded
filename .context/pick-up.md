# Pick up

**Start: read `.context/overview.md` + `.context/active-work.md`** (then
this file). Project is the BYOK Codebuff fork, `modded` branch.

## What the last session finished

**v1.3.1 SHIPPED 2026-07-03 — Codex OAuth reasoning round-trip fix.**

- Bug: Codex/ChatGPT **OAuth** models ran tools (todos) then returned no
  final response. Root cause: `sdk/src/impl/chatgpt-backend-fetch.ts`
  requested encrypted reasoning (`store:false`) but never replayed it —
  `convertMessages` had no reasoning branch, so Codex lost chain-of-thought
  across the tool loop and sometimes emitted an empty final turn.
- Fix: cache each turn's reasoning item by `call_id` (from completed response
  `output`), re-inject before its `function_call` on the next request. Deduped
  per reasoning id; degrades gracefully when absent. Commit `a1242f470`
  (PR #1, merged), bump `0be8c24f0`, tag `v1.3.1`.
- Shipped manual (MERGE-STRATEGY §Step 6): 3 tarballs rebuilt @1.3.1 →
  GH release v1.3.1 → npm `codebuff-mod@1.3.1` = `latest` (verified).
- New test: `sdk/src/impl/__tests__/chatgpt-backend-reasoning.test.ts` (3 pass).

## Next task

**Nothing required — 1.3.1 is out.** Optional:

1. Live smoke the **published** binary: fresh `npm i -g codebuff-mod` →
   `cbm` → connect a Codex OAuth profile → multi-step tool-loop prompt →
   confirm a final response every run (the exact path 1.3.1 fixes). Pre-ship
   smoke was from source only.
2. Confirm a cross-compiled linux tarball actually boots on linux (built on
   Windows — never verified on-target).

## Landmines / notes

- **Release is fully manual** — `bun run release` triggers upstream's private
  workflow (dead for the fork). Full runbook: MERGE-STRATEGY §Step 6. GH
  release MUST precede `npm publish` (launcher downloads the binary by tag).
- **Bump BOTH** `cli/package.json` + `cli/release/package.json`; rebuild
  binaries AFTER the bump (version is embedded). Tarball = binary only, no
  wasm sibling.
- **Never adopt upstream's `cli/release/index.js`** ([[decisions]]) — downloads
  `-baseline` tarballs the fork doesn't publish.
- **Upstream tests assume posix** — triage new Windows failures against the
  pre-merge commit in a temp worktree first.
- Untracked `.codeboarding/` in repo root is the user's — keep out of commits.
- Full state in `active-work.md`; rationale in `decisions.md`.
