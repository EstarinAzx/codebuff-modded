# Pick up

**Start: read `.context/overview.md` + `.context/active-work.md`** (then
this file). Project is the BYOK Codebuff fork, `modded` branch.

## What the last session finished

**Upstream sync 2026-07-03** — merged 399 snapshot commits
(`upstream/main` @ `a8a8d1643`) into `modded` per MERGE-STRATEGY.md:

- 3 commits on `modded`: `595adc673` (merge, 5 conflicts resolved per
  map), `9441009e6` (`WEBSITE_URL` → `getWebsiteUrl()` compile fix),
  `291d2b9e7` (win32 infinite-loop fix in upstream's new
  `project-file-tree.test.ts`).
- Verified: typecheck ×3 green, binary builds + prints 1.2.0, all
  conflict-map invariant greps pass, test suites at pre-existing
  baselines (details in `active-work.md` "State").
- `main` fast-forwarded + pushed. **`modded` NOT pushed** — wrap-up
  go/no-go gate got no user response.

## Next task

**Push `modded`** after the user eyeballs (`git push origin modded` —
3 commits). Then optional:

1. Cut 1.2.1 patch release if user wants upstream's SSRF guard/fixes
   shipped (manual runbook: MERGE-STRATEGY.md step 6).
2. Carried live smokes (published binary; fallback chain with
   Brave/Tavily key).

## Landmines / notes

- **Upstream tests assume posix** — before calling a Windows test
  failure a merge regression, run that file at the pre-merge commit
  (`b0488029d`) in a temp worktree. Baseline now: common 1 / sdk 65 /
  cli 19+5err.
- **Never adopt upstream's `cli/release/index.js`** — it downloads
  `-baseline` tarballs the fork doesn't publish. See [[decisions]]
  2026-07-03 + new conflict-map entry.
- **`testCiEnv.SERPER_API_KEY` is load-bearing** — see [[gotchas]].
- Untracked `.codeboarding/` in repo root is the user's — keep out of
  commits.
- Full state in `active-work.md`; sync rationale in `decisions.md`.
