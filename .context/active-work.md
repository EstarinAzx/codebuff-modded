---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-19
tags: [context, active-work]
ship: 0.1.11 (shipped)
---

# Active Work

_Last updated: 2026-05-19 by Opus 4.7_
_At commit: `modded` tip `f70d71f28` (0.1.11 ship)_

## Current focus

Nothing in flight. `codebuff-mod@0.1.11` is published — npm package,
GH release with all three platform tarballs (win32-x64, linux-x64,
linux-arm64), tag `v0.1.11` pushed, local user-side binary swapped
(prior 0.1.10 archived as `codebuff-mod.exe.0110`).

## State

- **In flight:** nothing.
- **Recently shipped — 0.1.11 (commit `f70d71f28`):** cosmetic only.
  AI assistant message bubbles now render in a single-line bordered
  panel matching the sub-agent expanded panel (`agent-branch-item.tsx`)
  and the runtime error banner (`user-error-banner.tsx`). One file
  touched: `cli/src/components/message-with-agents.tsx`.
  - Border color resolves `theme.secondary ?? theme.aiLine` so it
    tracks the active theme without a new token.
  - Shared `<MessageBlock />` extracted to a local element so the
    three render branches (user-line / ai-bordered / plain) no
    longer duplicate the 27-prop call site.
  - User messages keep their left vertical line. Error variants keep
    the plain wrapper (their `UserErrorBanner` paints its own red
    border inside `MessageBlock`). The recursive sub-agent render
    path (`AgentMessage`) is untouched.
- **Recently shipped — 0.1.10 (commit `1709a34ce` + docs sync
  `2700c5f07`):** closed two BYOK gates 0.1.7 missed (fresh-install
  "connecting…" stuck indicator and `/logout` re-triggering the dead
  `LoginModal`). See [[decisions]] for the full rationale.
- **Typecheck at 0.1.11 ship:** `bun run --filter='@codebuff/cli'
  typecheck` clean.
- **Test status at 0.1.11 ship:** 4 pre-existing `MessageBlockStore`
  test failures in `message-with-agents.test.tsx` verified
  non-regression (same 18 pass / 4 fail with and without the diff).
  Broader 14 pre-existing test failures from 0.1.10 baseline remain
  unaddressed (categories: `usePathTabCompletion` Windows-path-slash
  quirks, `fetchUsageData` env-config missing
  `NEXT_PUBLIC_CODEBUFF_APP_URL`, `logout-relogin-flow` colliding
  with the BYOK synthetic-user escape hatch).
- **Working tree:** clean (only untracked artifact is
  `.context/image/decisions/`, an image dir).

## Pick up here

No active task. When resuming, pick from the open questions below or
new user direction.

## Open questions (carry-over)

- **BYOK onboarding nudge** — a user with no profile lands in the chat
  with no provider and no hint. The new `/logout` message points at
  `/providers:add`-adjacent commands, but the cold-start case (user
  never typed `/logout`) is still silent. Worth a "run `/providers:add`
  to get started" empty-state message?
- **macOS x64 + arm64 binaries** — build on borrowed Mac or defer
  indefinitely? 0.1.11 ships only win32-x64, linux-x64, linux-arm64.
- **Phase 3b/c OpenTUI providers panel** — still worth doing now that
  text-mode `/providers*` commands cover the full feature surface?
- **Hard-delete `web/` and `freebuff/`** once 0.1.x stays stable in
  the wild? Path B is gated behind `CODEBUFF_USE_BACKEND=1` with zero
  known consumers.
- **Delete `LoginModal` + `cli/src/login/*`** — provably unreachable
  post-0.1.10 since `app.tsx` gates on env. Keep for the backend
  escape hatch or rip? Same answer affects whether `/logout` even
  needs to keep its `CODEBUFF_USE_BACKEND=1` branch.

## Security carry-over

- Previously-leaked OpenCode key revoked at opencode.ai on
  2026-05-19. The revoked key string still sits in plaintext in
  `~/.config/manicode/message-history.json`. User declined a scrub —
  local PC, key already dead. No action.

## Skills for next session

- `/to-issues` — if macOS binaries / web+freebuff deletion / login
  dead-code removal get turned into trackable tickets.
- `/grill-me` — if scoping the BYOK onboarding empty-state.

## Recent context

- 0.1.11 is purely cosmetic; no behavior change. Visual parity now
  achieved between AI message bubble, sub-agent expanded panel, and
  the error banner — they all use the same `BORDER_CHARS` rounded
  glyphs at single-line weight.
- 0.1.10 propagated the `CODEBUFF_USE_BACKEND !== '1'` env-gate from
  two surfaces (added in 0.1.7) to four more, closing the
  fresh-install lockout fully. After this, the BYOK default is free
  of any path that calls codebuff.com.
- `build:binary` runs `prebuild-agents` + sdk build internally; output
  lands in `cli/bin/`, then must be hand-tarred into `dist-binaries/`.
- bun cross-compile to Linux from Windows still needs the `C:\cb`
  junction workaround (see [[gotchas]]).
- Ship sequence used: native Win build → tar → cross-compile linux-x64
  → tar → cross-compile linux-arm64 → tar → push branch → push tag →
  `gh release create` with all three tarballs → `npm publish` from
  `cli/release/`.

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
