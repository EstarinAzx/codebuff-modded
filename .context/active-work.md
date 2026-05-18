---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-19
tags: [context, active-work]
ship: 0.1.10
---

# Active Work

_Last updated: 2026-05-19 by Opus 4.7_
_At commit: `modded` tip — 0.1.10 changes uncommitted_

## Current focus

Shipping `codebuff-mod@0.1.10` — closing two gaps left by the 0.1.7
login-gate skip. A fresh-device install reported by the user surfaced:

1. The chat header indicator stuck on "connecting…" forever even though
   no agent calls were ever attempted.
2. Running `/logout` after that flipped the user back to the dead
   `LoginModal` — exact 0.1.7 lockout symptom, just reached through a
   different door.

Both stem from the same shape: gates that 0.1.7 fixed at boot
(`requireAuth=false` when `CODEBUFF_USE_BACKEND !== '1'`) were not
applied to the other backend-touching surfaces. The `BYOK_AT_BOOT`
booleans in three React hooks only flipped on an active profile, and the
`LoginModal` render gate in `app.tsx` only checked `isAuthenticated`,
which `/logout` can mutate post-boot.

## State

- **In flight:** 0.1.10 ship — code + version bumps done, commit /
  build binaries / push / tag / GH release / npm publish still to do.
- **Done this session:**
  - **0.1.10 (changes uncommitted):**
    - `cli/src/hooks/use-connection-status.ts` — `BYOK_AT_BOOT` now
      returns true whenever `CODEBUFF_USE_BACKEND !== '1'`, falling back
      to the `getActiveProfile()` check only under the explicit backend
      escape hatch. Fixes the "connecting…" stuck indicator on
      profile-less fresh installs.
    - `cli/src/hooks/use-gravity-ad.ts` — same pattern. Was hitting the
      unset ads endpoint in a loop on fresh installs.
    - `cli/src/hooks/use-agent-validation.ts` — same pattern. Remote
      validation was failing silently and blocking message send.
    - `cli/src/app.tsx` — `LoginModal` render gate now also requires
      `CODEBUFF_USE_BACKEND === '1'`. Belt-and-suspenders: even if
      `isAuthenticated` gets flipped to false post-boot (the `/logout`
      handler does this), the modal never renders in BYOK mode.
    - `cli/src/commands/command-registry.ts` — `/logout` handler now
      short-circuits in BYOK default mode with a user-facing pointer to
      `/providers:remove` / `/providers:list` instead of silently flipping
      auth state and printing "Logged out." (which was meaningless when
      there was never a codebuff.com session).
    - Version bumped 0.1.9 → 0.1.10 in `cli/package.json` and
      `cli/release/package.json`.
- **Typecheck:** `bun run --filter='@codebuff/cli' typecheck` clean.
- **Test status:** 14 pre-existing test failures verified against
  baseline (`git stash` confirmed they fail with my edits absent) —
  not introduced by 0.1.10. Categories: `usePathTabCompletion`
  Windows-path-slash quirks, `fetchUsageData` env-config tests missing
  `NEXT_PUBLIC_CODEBUFF_APP_URL`, and `logout-relogin-flow` which
  collides with the BYOK synthetic-user escape hatch.
- **Blocked:** Nothing.

## Pick up here

1. Commit the seven file changes as `fix(cli): 0.1.10 — close BYOK
   fresh-install gates left by 0.1.7`.
2. `bun run build:binary` from `C:\cb\cli` (junction workaround — see
   [[gotchas]]).
3. Tar binaries into `dist-binaries/`, push tag `v0.1.10`, GH release,
   `npm publish` the launcher.
4. Confirm on the user's affected device: fresh install → no
   "connecting…", `/logout` shows the new BYOK message instead of
   booting them to `LoginModal`.
5. Swap the user-side local binary at
   `~/.config/manicode/codebuff-mod.exe` to 0.1.10 (keep prior as
   `.exe.019`).

## Open questions (carry-over)

- BYOK onboarding nudge — a user with no profile lands in the chat with
  no provider and no hint. The new `/logout` message at least points at
  `/providers:add`-adjacent commands, but the cold-start case (user
  never typed `/logout`) is still silent. Worth a "run /providers:add to
  get started" empty-state message?
- macOS x64 + arm64 binaries — build on borrowed Mac or defer indefinitely?
- Phase 3b/c OpenTUI providers panel — still worth doing now that text-mode
  `/providers*` commands cover the full feature surface?
- Hard-delete `web/` and `freebuff/` once 0.1.x stays stable in the wild?
  Path B is gated behind `CODEBUFF_USE_BACKEND=1` with zero known consumers.
- `LoginModal` + `cli/src/login/*` login mutation are dead code in the
  default CLI (now provably unreachable post-0.1.10 since `app.tsx` gates
  on env). Delete, or keep for the backend escape hatch? Same answer
  affects whether `/logout` even needs to keep its `CODEBUFF_USE_BACKEND=1`
  branch.

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

- 0.1.7 added the same `CODEBUFF_USE_BACKEND !== '1'` gate at two
  spots (`index.tsx` startup, `validateApiKey`). 0.1.10 propagates that
  gate to the four remaining backend-touching surfaces. After this, the
  BYOK default should be free of any path that calls codebuff.com.
- The `BYOK_AT_BOOT` name is now slightly misleading — these flags fire
  whenever the backend is disabled at boot, regardless of profile state.
  Kept the name to avoid renaming churn. Updated the file-top docstrings.
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
