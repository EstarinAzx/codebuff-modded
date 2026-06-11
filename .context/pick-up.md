# Pick up

**Start: read `.context/overview.md` + `.context/active-work.md`** (then
this file). Project is the BYOK Codebuff fork, `modded` branch.

## What the last session finished

**Shipped v1.1.1 + v1.1.2 same day** — TUI input-box bleed-through saga:

- v1.1.1: stale framebuffer content (yellow line) showed through the chat
  input box; fixed with opaque `#000000` fill (`0d5a84979`).
- v1.1.2: replaced hardcoded black with the terminal's OWN background
  color via OSC 11 query — new hook
  `cli/src/hooks/use-terminal-background.ts` (`renderer.getPalette()`,
  black fallback). Opaque but visually invisible on any terminal theme.
  askUser questions box painted too (`230fd309c`).
- npm `codebuff-mod@1.1.2` live (`latest`); GH release v1.1.2 with 3
  tarballs. `modded` + tags pushed. Root cause documented in
  `.context/gotchas.md` "OpenTUI transparent cells don't repaint".

## Next task

**Nothing required — 1.1.2 is out.** Optional, pick any:

1. **Live BYOK smoke on published binary** (carried since 1.1.0, still
   unrun): `npm i -g codebuff-mod` → `/providers:add <preset> <key>` →
   small prompt → confirm Path C dispatches. Also validates linux
   tarballs on real linux.
2. **Fix 2 stale CLI tests** (`providers-models.test.ts` opencode-go
   catalog, `providers.test.ts` schema version — assert pre-1.0.6
   behavior, not regressions).

## Landmines / notes

- **OSC 11 first-paint flash** — first frame black, snaps to detected
  color. Cosmetic; fix only if user complains.
- **`chat-input-bar.tsx` now carries fork-local edits** (bg fill + hook
  import) — expect a trivial conflict on the next upstream sync.
- **CLI test suite not re-run for 1.1.1/1.1.2** (UI-only changes;
  typecheck green, user eyeballed both via `bun run dev`).
- **Next upstream sync:** follow `MERGE-STRATEGY.md` as-is. Never import
  `@codebuff/internal` (deleted) — use `@codebuff/llm-providers` +
  `@codebuff/common`.
- Full state in `active-work.md`; strategy rationale in `decisions.md`.
