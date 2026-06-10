# Pick up

**Start: read `.context/overview.md` + `.context/active-work.md`** (then
this file). Project is the BYOK Codebuff fork, `modded` branch.

## What the last session finished

**Shipped v1.1.0** — the strategy-B upstream snapshot sync. Upstream went
CLI/SDK-only; the fork rode the deletion to become **BYOK-only** (`web/` +
`packages/{internal,billing,bigquery,build-tools}` gone). Gained Composio
tools, `read_url`, Serper search, MiMo + MiniMax-M3 models. All 1.0.6 BYOK
features verified intact.

- npm `codebuff-mod@1.1.0` live (`latest`); GitHub release v1.1.0 with 3
  tarballs (win32-x64, linux-x64, linux-arm64). modded pushed, tag `v1.1.0`.
- `MERGE-STRATEGY.md` fully rewritten for the lean tree — now turnkey for
  **both** merge and release (Step 6 is the complete release runbook).
- `.context/` synced (overview, stack, gotchas, decisions, active-work).

## Next task

**Nothing required — 1.1.0 is out.** The one open validation (optional):
run a **live BYOK smoke on the published binary** — `npm i -g codebuff-mod`
→ `/providers:add <preset> <key>` → small prompt → confirm Path C dispatches.
This also confirms the cross-compiled **linux** tarballs run on actual linux
(they were built on Windows). User already verified Windows works.

## Landmines / notes

- **2 CLI tests fail by design** (`providers-models.test.ts` opencode-go
  catalog; `providers.test.ts` schema version) — assert pre-1.0.6 behavior,
  NOT regressions. Fix when convenient.
- **Next upstream sync:** just follow `MERGE-STRATEGY.md`. Future syncs are
  small (the 320k one-time divergence is done; strategy B is settled — ride
  deletions, don't restore the backend). `@codebuff/internal` is deleted —
  never import it; use `@codebuff/llm-providers` + `@codebuff/common`.
- Full state in `active-work.md`; decision rationale in `decisions.md`
  ("Ride upstream's snapshot deletion to a BYOK-only fork").
