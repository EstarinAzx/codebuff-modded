# Pick up

**Start: read `.context/overview.md` + `.context/active-work.md`** (then
this file). Project is the BYOK Codebuff fork, `modded` branch.

## What the last session finished

**Shipped v1.1.1** — patch release fixing TUI bleed-through: stale
framebuffer content (yellow separator line) showed through the chat input
box because it painted no background and its children render transparent
cells. Fix = opaque `#000000` fill on the normal-mode input box
(`cli/src/components/chat-input-bar.tsx`, commit `0d5a84979`). Black
hardcoded by user preference (blend with terminal bg, not `theme.surface`).

- npm `codebuff-mod@1.1.1` live (`latest`); GitHub release v1.1.1 with 3
  tarballs (win32-x64, linux-x64, linux-arm64). `modded` + tag pushed.
- `.context/` synced (active-work, overview, gotchas — new gotcha:
  "OpenTUI transparent cells don't repaint").

## Next task

**Nothing required — 1.1.1 is out.** Optional follow-ups, pick any:

1. **Live BYOK smoke on published binary** (carried since 1.1.0, still
   unrun): `npm i -g codebuff-mod` → `/providers:add <preset> <key>` →
   small prompt → confirm Path C dispatches. Also validates the
   cross-compiled linux tarballs on real linux.
2. **Fix 2 stale CLI tests** (`providers-models.test.ts` opencode-go
   catalog, `providers.test.ts` schema version — assert pre-1.0.6
   behavior, not regressions).

## Landmines / notes

- **Input box bg is hardcoded `#000000`** — light theme would get a black
  box. Dark-only conditional if anyone complains.
- **askUser questions box** (same file, askUserState branch) still paints
  no background — same bleed risk, one-line fix if reported.
- **CLI test suite not re-run for 1.1.1** (UI-only change; typecheck
  green, user eyeballed via `bun run dev`).
- **Next upstream sync:** follow `MERGE-STRATEGY.md` as-is (turnkey for
  merge + release). Never import `@codebuff/internal` (deleted) — use
  `@codebuff/llm-providers` + `@codebuff/common`.
- Full state in `active-work.md`; strategy rationale in `decisions.md`.
