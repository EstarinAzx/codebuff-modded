# Pick up

**Start: read `.context/overview.md` + `.context/active-work.md`** (then
this file). Project is the BYOK Codebuff fork, `modded` branch.

## What the last session finished

**Upstream sync 2026-07-03 + v1.3.0 SHIPPED same session:**

- Merged 399 snapshot commits (`upstream/main` @ `a8a8d1643`) per
  MERGE-STRATEGY.md; 5 conflicts resolved per map + 2 fork fixes
  (`getWebsiteUrl` repoint, win32 test-helper loop).
- Released: npm `codebuff-mod@1.3.0` = `latest` (verified); GH release
  v1.3.0 with 3 tarballs (verified); `modded` + tag pushed.
- Sync highlights now shipped: SSRF guard for web tools, `/copy`
  command, suggested prompts, GLM/Kimi/MiniMax/Opus agents, bun 1.3.14.

## Next task

**Nothing required — 1.3.0 is out.** Optional (priority order):

1. Live smoke published binary: `npm i -g codebuff-mod` → `cbm` →
   `/providers:list` → small prompt → `web_search` (needs
   `SERPER_API_KEY`); also one `read_url` call — upstream's new SSRF
   guard sits on that path, confirm no false-positive blocking in BYOK.
2. Fallback-chain live smoke (Brave/Tavily key + bad Serper key).

## Landmines / notes

- **Upstream tests assume posix** — new Windows test failures: check
  against pre-merge commit in a temp worktree before treating as
  regression. Baselines in MERGE-STRATEGY "Test baseline".
- **Never adopt upstream's `cli/release/index.js`** ([[decisions]]
  2026-07-03) — it downloads `-baseline` tarballs the fork doesn't
  publish.
- **`testCiEnv.SERPER_API_KEY` is load-bearing** — see [[gotchas]].
- Untracked `.codeboarding/` is the user's — keep out of commits.
- Full state in `active-work.md`; rationale in `decisions.md`.
