---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-19
tags: [context, active-work]
ship: 0.1.9
---

# Active Work

_Last updated: 2026-05-19 by Opus 4.7_
_At commit: `modded` tip — 0.1.9 changes being committed this session_

## Current focus

Shipping `codebuff-mod@0.1.9` — a one-line bug fix for the 0.1.8 banner
rebrand. 0.1.8 shipped the wide "CODEBUFF - M" ASCII logo but it never
rendered: `useLogo` was budgeted against `contentMaxWidth` (hard-capped
at 80 cols in `use-terminal-dimensions.ts`), while the banner is ~92 wide.
Result: always fell back to the small "CBM" logo regardless of terminal
size. 0.1.9 budgets the header logo against `terminalWidth - 4` instead.

## State

- **In flight:** 0.1.9 ship — build binaries done, commit / push / tag /
  GH release / npm publish in progress this session.
- **Done this session:**
  - **0.1.8 (shipped):** banner rebrand. `LOGO_CODEBUFF` → ASCII
    "CODEBUFF - M" (~92 cols; the full word "MODDED" was rejected — block
    ASCII would be ~135 cols). `LOGO_SMALL_CODEBUFF` → "CBM" (was "CB").
    Full-logo width threshold in `use-logo.tsx` raised `70` → `92`. Also
    cleared a pre-existing `@codebuff/sdk` typecheck failure
    (`database-byok-skip.test.ts` — added `userId: undefined` to two mock
    casts). Published, GH release `v0.1.8`, commit `6a40f25a4`.
  - **0.1.9 (shipping now):** `cli/src/app.tsx` — header `useLogo` now
    gets `availableWidth: terminalWidth - 4` instead of `contentMaxWidth`.
    The logo is a full-width banner, not confined to the 80-col content
    column, so the 92-wide variant could never fit. `contentMaxWidth`
    dropped from the `useTerminalDimensions()` destructure (now unused in
    app.tsx). Modal `useLogo` callers (login-modal, project-picker,
    waiting-room, freebuff-superseded) keep `contentMaxWidth` — correct,
    modals stay narrow and show the small logo.
  - `cli/src/login/constants.ts` — user hand-fixed an off-by-one in the M
    glyph's rows 3-4 alignment. Correct, kept.
  - Version bumped 0.1.8 → 0.1.9.
- **Behavior:** the full "CODEBUFF - M" banner now needs a terminal
  ≥ ~96 cols wide (`terminalWidth - 4 ≥ 92`); narrower shows small "CBM".
- **Blocked:** Nothing.

## Pick up here

After 0.1.9 publish completes:

1. Confirm the user sees the full "CODEBUFF - M" banner on a wide
   (≥96-col) terminal and "CBM" when narrowed.
2. Swap the user-side local binary at `~/.config/manicode/codebuff-mod.exe`
   to 0.1.9 (keep prior as `.exe.018`).
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
