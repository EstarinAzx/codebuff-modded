---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-05-18
tags: [context, active-work]
---

# Active Work

_Last updated: 2026-05-18 by Opus 4.7_
_At commit: 4e79ac045 (`modded` tip, pre-0.1.5 release commit)_

## Current focus

Shipping `codebuff-mod@0.1.5` — per-agent BYOK profile bindings + restored
sub-agent spawning in `mod-default` / `mod-max`. Lets users route cheap
sub-agents (file-picker, code-searcher) to a Flash/DeepSeek profile while
keeping the orchestrator on a stronger model. All on independent provider
keys if desired.

## State

- **In flight:** 0.1.5 release. Source + binaries built + tarballed, local
  Win exe swapped at `~/.config/manicode/codebuff-mod.exe` (smoke-tested at
  `--version` → 0.1.5). Still to do: commit, tag, push, GH release, npm publish.
- **Done this session (0.1.5 feature work):**
  - `sdk/src/impl/model-provider.ts` — added module-level
    `byokAgentBindings: Record<agentId, BYOKProfile>` map and
    `setByokAgentBindings()` / `getByokAgentBindings()` exports. Path C in
    `getModelForRequest()` now checks `byokAgentBindings[agentId]` first and
    falls back to `activeByokProfile`. New optional `agentId?` field on
    `ModelRequestParams`.
  - `sdk/src/impl/llm.ts` — threaded `params.agentId` into all three
    `ModelRequestParams` constructions (`promptAiSdkStream`, `promptAiSdk`,
    `promptAiSdkStructured`).
  - `sdk/src/index.ts` — re-export `setByokAgentBindings` and
    `getByokAgentBindings`.
  - `cli/src/utils/providers.ts` — schema bumped to `version: 2` with new
    `agentBindings: Record<agentId, profileId>` field. Lazy migrate at read
    time. New CRUD: `loadAgentBindings`, `getAgentBinding`, `setAgentBinding`,
    `clearAgentBinding`, `buildSdkBindings`. `removeProfile()` and
    `saveProfiles()` now preserve / prune bindings on profile mutations.
  - `cli/src/commands/providers.ts` — new handlers `handleProvidersBind`,
    `handleProvidersUnbind`, `handleProvidersBindings`. `syncSdkAgentBindings()`
    helper pushes the full map to SDK after every mutation.
  - `cli/src/commands/command-registry.ts` — registered `/providers:bind`,
    `/providers:unbind`, `/providers:bindings`. Added to
    `FREEBUFF_REMOVED_COMMANDS`.
  - `cli/src/init/init-app.ts` — calls `setByokAgentBindings(buildSdkBindings())`
    on boot so SDK starts hot with the persisted map.
  - `.agents/mod-default.ts` — `spawn_agents` added to `toolNames`,
    `spawnableAgents: ['file-picker', 'code-searcher', 'thinker']`.
  - `.agents/mod-max.ts` — `spawn_agents` + `spawnableAgents:
    ['file-picker', 'code-searcher', 'thinker', 'code-reviewer']`.
  - Regenerated `cli/src/agents/bundled-agents.generated.ts` (still 59 agents;
    sub-agents were already bundled, just unreachable).
  - Bumped `cli/package.json` and `cli/release/package.json` to 0.1.5.
  - Built Win x64 + Linux x64 + Linux arm64 binaries via `C:\cb` junction.
  - Tarballed all three at `cli/dist-binaries/codebuff-mod-{win32-x64,linux-x64,linux-arm64}.tar.gz`.
  - Typecheck clean on `@codebuff/cli`, `@codebuff/agent-runtime`,
    `@codebuff/common`. SDK has only the pre-existing
    `database-byok-skip.test.ts` errors from Phase 5 — not from this session.
  - Path C BYOK tests still pass 10/10
    (`sdk/src/impl/__tests__/model-provider-byok.test.ts`).
- **Blocked:** Nothing.

## Pick up here

1. Commit on `modded` covering this session's edits.
2. `git tag v0.1.5 && git push origin modded && git push origin v0.1.5`.
3. `gh release create v0.1.5 --repo EstarinAzx/codebuff cli/dist-binaries/*.tar.gz`
   with a body summarizing per-agent bindings.
4. `cd cli/release && npm publish`. Launcher is 9KB and fetches the binary
   from the GH release on first run.
5. Verify install: `npm view codebuff-mod version` → `0.1.5`.
6. Smoke-test recipe (after local install or via the swapped exe):
   ```
   /providers:add openrouter <key> flash    # name=flash
   /providers:add openrouter <key> strong   # name=strong
   /providers:select strong
   /providers:bind file-picker flash
   /providers:bind code-searcher flash
   /providers:bindings
   ```
   then a real task and confirm spawned sub-agents hit the flash profile
   (watch `~/.config/manicode/projects/<cwd>/chats/<iso>/log.jsonl` for the
   sub-agent's `model` field).

## Skills for next session

- `/to-issues` — if macOS binaries / web+freebuff deletion / v2 per-agent
  model overlays get turned into trackable tickets.
- `/grill-me` — if scoping Phase 3b/c OpenTUI providers panel.

## Open questions (carry-over)

- macOS x64 + arm64 binaries — build on borrowed Mac or defer indefinitely?
- Phase 3b/c OpenTUI providers panel — still worth doing now that text-mode
  `/providers*` commands cover the whole feature surface, or treat as final UX?
- Hard-delete `web/` and `freebuff/` once 0.1.5 stays stable in the wild?
  Path B is gated behind `CODEBUFF_USE_BACKEND=1` with zero known consumers.

## Security carry-over

- OpenCode key `sk-Ds6e8UGFqVXnhld...` (leaked in screenshot weeks ago) still
  sits in `~/.config/manicode/providers.json` and `~/.local/share/opencode/auth.json`.
  Rotation at opencode.ai status unconfirmed. Treat as compromised.

## Recent context

- Sub-agents (`file-picker`, `code-searcher`, `thinker`, `code-reviewer`) were
  already bundled in `cli/src/agents/bundled-agents.generated.ts` from
  upstream `agents/`. The 0.1.4 mod-* templates just didn't reference them.
  0.1.5 wires them in.
- `cli/src/hooks/image/use-auth-query/1779089045755.png` — orphaned
  screenshot, still untracked. Safe to `rm -r cli/src/hooks/image/` when
  convenient.
- bun cross-compile to Linux from Windows still requires the `C:\cb` junction
  workaround (see [[gotchas]]).
- Defender real-time scan briefly locks freshly-built `codebuff-mod.exe` on
  copy; rename-target-then-copy workaround still in play.

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
