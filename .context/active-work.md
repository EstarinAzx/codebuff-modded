---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-18
tags: [context, active-work]
---

# Active Work

_Last updated: 2026-05-19 by Opus 4.7_
_At commit: 9b514c8c6 (`modded` tip)_

## Current focus

Nothing in flight. `codebuff-mod@0.1.6` is fully shipped — npm `latest = 0.1.6`,
GH release `v0.1.6` live with Win x64 + Linux x64/arm64 tarballs attached,
tag pushed, commit `9b514c8c6` on `modded`. User-side install at
`~/.config/manicode/codebuff-mod.exe` confirmed at 0.1.6 via `--version`.

0.1.5 introduced per-agent BYOK profile bindings + restored `mod-default` /
`mod-max` sub-agent spawning (file-picker, code-searcher, thinker;
code-reviewer for max). 0.1.6 immediately followed with a hotfix: spawning
any sub-agent with a `handleSteps` generator crashed with
`Agent state has no run ID` because the 0.1.4 empty-string runId coercion
left the value falsy and tripped the programmatic-step guard.

## State

- **In flight:** Nothing.
- **Done last session (0.1.5 ship):**
  - SDK Path C now honors per-agent bindings:
    `byokAgentBindings[params.agentId] ?? activeByokProfile`.
  - `setByokAgentBindings()` / `getByokAgentBindings()` exported from SDK.
  - `ModelRequestParams.agentId?` threaded through 3 `llm.ts` call sites.
  - `providers.json` schema v2 with `agentBindings: Record<agentId, profileId>`,
    lazy-migrated on read, pruned on profile mutations.
  - CLI commands `/providers:bind`, `/providers:unbind`, `/providers:bindings`
    + sync helper that pushes the map to SDK after every mutation.
  - Boot push in `cli/src/init/init-app.ts`.
  - `mod-default` + `mod-max` declare `spawn_agents` + `spawnableAgents`.
- **Done this session (0.1.6 hotfix):**
  - `packages/agent-runtime/src/run-agent-step.ts:685` —
    `startAgentRun()` null result now synthesizes a process-local UUID
    `byok-<agentTemplate.id>-<uuid>` instead of the previous empty-string
    coercion. `crypto.randomUUID()` when available; Math.random+Date.now
    fallback otherwise. Fixes the `Agent state has no run ID` throw at
    `packages/agent-runtime/src/run-programmatic-step.ts:131` for any
    spawned sub-agent with a `handleSteps` generator.
  - Tag `v0.1.6` pushed, GH release published with three fresh tarballs,
    `codebuff-mod@0.1.6` on npm `latest`. Local Win exe swapped.
- **Blocked:** Nothing.

## Pick up here

No queued work. When resuming, check:

1. Did the wordfreq smoke task succeed end-to-end? Confirm thinker, file
   creation, terminal runs, and code-reviewer all dispatched without errors.
   Tail `~/.config/manicode/projects/<cwd>/chats/<latest-iso>/log.jsonl`.
2. Stray untracked `cli/src/hooks/image/` (orphan PNG from VS Code clipboard
   paste) — still safe to `rm -r` when convenient.
3. New stray `image/` at repo root — also untracked, likely same VS Code
   paste behavior. Inspect before deleting.
4. Open questions below if scoping expands.

## Open questions (carry-over)

- macOS x64 + arm64 binaries — build on borrowed Mac or defer indefinitely?
- Phase 3b/c OpenTUI providers panel — still worth doing now that text-mode
  `/providers*` commands cover the full feature surface (including bind),
  or treat as final UX?
- Hard-delete `web/` and `freebuff/` once 0.1.6 stays stable in the wild?
  Path B is gated behind `CODEBUFF_USE_BACKEND=1` with zero known consumers.
- Expand mod-max `spawnableAgents` to include `librarian`, `researcher-web`,
  `editor`? Bigger surface = more `/providers:bind` knobs for cost tuning,
  but each new spawn target is one more thing to validate end-to-end.

## Security carry-over

- Previously-leaked OpenCode key revoked at opencode.ai on 2026-05-19. Local
  `~/.config/manicode/providers.json` + `~/.local/share/opencode/auth.json`
  rotated to a fresh key. No further action required.

## Skills for next session

- `/to-issues` — if macOS binaries / web+freebuff deletion / v2 per-agent
  model overlays get turned into trackable tickets.
- `/grill-me` — if scoping Phase 3b/c OpenTUI providers panel.

## Recent context

- 0.1.6 fix only touched one file (`run-agent-step.ts`). All other
  agent-runtime sites that read `agentState.runId` were already guarded
  (line 307, 353 truthy-check before backend writes; line 145 has
  `?? 'undefined'` fallback). UUID synthesis is the minimum invasive fix.
- bun cross-compile to Linux from Windows still requires the `C:\cb`
  junction workaround (see [[gotchas]]).
- Defender real-time scan still locks freshly-built `codebuff-mod.exe` on
  copy; rename-target-then-copy still works around it.

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
