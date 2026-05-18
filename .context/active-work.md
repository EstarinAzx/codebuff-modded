---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-18
tags: [context, active-work]
---

# Active Work

_Last updated: 2026-05-18 20:15 by Opus 4.7_
_At commit: 4af6c2b75 (pending 0.1.4 release commit)_

## Current focus

Shipping `codebuff-mod@0.1.4` — two bugs that blocked end-user agent runs
against a BYOK profile, both surfaced when the user smoke-tested 0.1.3
against the `opencode.ai/zen/go` endpoint with `mimo-v2.5-pro`.

## State

- **In flight:** 0.1.4 release. Source patched + local Windows binary swapped
  in (`~/.config/manicode/codebuff-mod.exe`). User confirmed `/providers:add`,
  model swap, and Path C dispatch (opencode.ai/zen/go/v1, mimo-v2.5-pro) all
  working end-to-end after the fix. Still to do: bump version, build linux
  binaries from `C:\cb` junction, npm publish, GH release, commit, push.
- **Done this session:**
  - `cli/scripts/prebuild-agents.ts` — extended to also scan `.agents/mod-*.ts`
    so the fork's BYOK templates ship inside the CLI binary instead of only
    being discoverable when cwd happens to contain `.agents/`. Bundle went
    from 55 → 59 agents.
  - `packages/agent-runtime/src/run-agent-step.ts:682-693` — coerce null
    `runId` from `startAgentRun()` to empty string and skip the
    `Failed to start agent run` throw. `sdk/src/impl/database.ts:349`
    already advertised "callers tolerate it"; this makes the comment true.
  - Regenerated `cli/src/agents/bundled-agents.generated.ts`, rebuilt
    Win x64 binary, swapped installed exe at `~/.config/manicode/`.
- **Blocked:** Nothing.

## Pick up here

1. `cd C:\cb && bun run --filter='*' typecheck` to confirm no broken types
   from the runId nullability change touching agent-runtime.
2. Bump `cli/package.json` version 0.1.3 → 0.1.4 and any sibling launchers
   that read it (`cli/release/index.js` reads `packageName` + URL but
   `version` is sourced from npm package metadata — verify).
3. Build remaining binaries via `cd C:\cb\cli && OVERRIDE_TARGET=bun-linux-x64
   OVERRIDE_PLATFORM=linux OVERRIDE_ARCH=x64 bun run build:binary`. Repeat
   for `arm64`. Pre-install the OpenTUI native bundle first per
   [[gotchas]] entry on `bsdtar --force-local`.
4. Create GitHub Release `v0.1.4` on `EstarinAzx/codebuff` with the three
   tarballs attached (`codebuff-mod-{win32-x64,linux-x64,linux-arm64}.tar.gz`).
5. `cd cli && npm publish` — package is launcher-only, pulls binary from the
   release URL at first run.
6. Commit + push `modded`.

If a new crash surfaces from a user: tail
`~/.config/manicode/projects/<project>/chats/<latest-iso>/log.jsonl`. Grep
for `"level":"ERROR"`. The 0.1.4 fixes cover the two known failure modes
from 0.1.3 (`Invalid agent ID: mod-default` and `Failed to start agent run`).

## Skills for next session

- /to-issues — if the macOS binaries / OAuth v2 providers / web+freebuff
  deletion get turned into trackable tickets.
- /grill-me — if scoping Phase 3b/c OpenTUI providers panel.

## Open questions

- macOS x64 + arm64 binaries: build on borrowed Mac or defer indefinitely?
- Phase 3b/c OpenTUI providers panel: still worth doing now that text-mode
  commands are confirmed working end-to-end, or treat as final UX?
- Hard-delete `web/` and `freebuff/` once 0.1.4 is confirmed stable in the
  wild? Path B (codebuff.com backend) is gated behind `CODEBUFF_USE_BACKEND=1`
  and zero external SDK consumers are known to set it.

## Recent context

- `~/.config/manicode/providers.json` and `~/.local/share/opencode/auth.json`
  both still contain the leaked OpenCode key `sk-Ds6e8UGFqVXnhld...` the user
  pasted in a screenshot weeks ago. User was told to rotate at opencode.ai;
  status unconfirmed.
- bun cross-compile to Linux from Windows still requires the `C:\cb` junction
  workaround. See [[gotchas]].
- Defender real-time scan briefly locks freshly-built `codebuff-mod.exe` on
  copy. Rename-target-then-copy works around it; the locked `.exe.old`
  releases within seconds.

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
