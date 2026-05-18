---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-19
tags: [context, active-work]
---

# Active Work

_Last updated: 2026-05-19 by Opus 4.7_
_At commit: 92c8b45af (`modded` tip) — 0.1.8 changes uncommitted, ship in progress_

## Current focus

Shipping `codebuff-mod@0.1.8` — a banner rebrand. The CLI logo now reads
**"CODEBUFF - M"** in full ASCII (the modded mark), and the narrow small
ASCII logo reads **"CBM"**. Code + typecheck done; publish / commit / push
is the in-flight final step.

## State

- **In flight:** 0.1.8 ship — publish to npm, commit, push (this session,
  after `/context-update`).
- **Done this session (0.1.8 banner rebrand):**
  - `cli/src/login/constants.ts` — `LOGO_CODEBUFF` is now ASCII
    "CODEBUFF - M" (~92 cols wide; dropped from the longer "MODDED" idea
    because the full word blew past terminal width). `LOGO_SMALL_CODEBUFF`
    is now ASCII "CBM" (was "CB"). Comments updated. Freebuff logos
    untouched.
  - `cli/src/hooks/use-logo.tsx` — full-logo width threshold raised
    `70` → `92` (the wider banner needs the room). Small-logo threshold
    unchanged at `20`. Docstring updated.
  - `sdk/src/impl/__tests__/database-byok-skip.test.ts` — added
    `userId: undefined` to the `finishAgentRun` + `addAgentStep` mock cast
    objects (lines ~82, ~97). Cleared the pre-existing carry-over
    typecheck failure (old item 3).
  - Version bumped 0.1.7 → 0.1.8 in `cli/package.json` +
    `cli/release/package.json`.
  - `bun run typecheck` fully green (all workspaces, including
    `@codebuff/sdk` which previously failed on the two test mocks).
- **Behavior change:** terminals narrower than 92 cols now render the
  small "CBM" logo instead of the full banner (was 70-col threshold).
  Deliberate, user-accepted tradeoff.
- **Blocked:** Nothing.

## Pick up here

After publish/commit/push completes:

1. Build the 3 binaries (Win x64 + Linux x64/arm64) via the `C:\cb`
   junction, hand-tar into `dist-binaries/*.tar.gz`, `gh release create
   v0.1.8`. (See [[stack]] release commands + [[gotchas]] cross-build
   workarounds. NOTE: as of this writing only the npm launcher publish +
   git commit/push were requested — confirm with user whether the GH
   release binaries for v0.1.8 still need building.)
2. Swap the user-side local binary at `~/.config/manicode/codebuff-mod.exe`
   to 0.1.8 once the release is up (keep 0.1.7 as `.exe.017`).
3. Open questions below.

## Open questions (carry-over)

- BYOK onboarding nudge — a user with no profile lands in the chat with
  no provider and no hint. Worth a "run /providers:add to get started"
  empty-state message?
- macOS x64 + arm64 binaries — build on borrowed Mac or defer indefinitely?
- Phase 3b/c OpenTUI providers panel — still worth doing now that text-mode
  `/providers*` commands cover the full feature surface?
- Hard-delete `web/` and `freebuff/` once 0.1.x stays stable in the wild?
  Path B is gated behind `CODEBUFF_USE_BACKEND=1` with zero known consumers.
- `LoginModal` + `cli/src/login/*` login mutation are dead code in the
  default CLI (reachable only under `CODEBUFF_USE_BACKEND=1`). Delete, or
  keep for the backend escape hatch? (Note: `login/constants.ts` still
  hosts the ASCII logos used by the live chat surface — only the login
  *flow* is dead, not the whole dir.)

## Security carry-over

- Previously-leaked OpenCode key revoked at opencode.ai on 2026-05-19. The
  revoked key string still sits in plaintext in
  `~/.config/manicode/message-history.json`. User declined a scrub — local
  PC, key already dead. No action.

## Skills for next session

- `/to-issues` — if macOS binaries / web+freebuff deletion / login dead-code
  removal get turned into trackable tickets.
- `/grill-me` — if scoping the BYOK onboarding empty-state.

## Recent context

- 0.1.8 is cosmetic only — no behavior change beyond the logo width
  threshold. `@codebuff/cli` typecheck passes clean.
- All `useLogo` consumers (app, login-modal, project-picker,
  waiting-room, freebuff-superseded) share the single threshold in
  `use-logo.tsx` — no per-consumer edits needed for the rebrand.
- `build:binary` runs `prebuild-agents` + sdk build internally; output
  lands in `cli/bin/`, then must be hand-tarred into `dist-binaries/`.
- bun cross-compile to Linux from Windows still needs the `C:\cb`
  junction workaround (see [[gotchas]]).

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
