---
type: decisions
project: codebuff (fork — modded branch)
updated: 2026-05-18
tags: [decisions, modded]
---

# Decisions — fork-local

Upstream architectural decisions live in upstream `docs/` and (if added later) `docs/adr/`. This file tracks only the decisions made for fork-local work on the `modded` branch.

## 2026-05-18 — Synthesize runId UUID in BYOK instead of empty-string coercion (0.1.6)

**Decision:** When `startAgentRun()` returns null (BYOK skips central run tracking), mint a process-local UUID `byok-<agentTemplate.id>-<uuid>` instead of coercing to `''`. UUID source is `crypto.randomUUID()` when available, Math.random+Date.now otherwise. The id is never persisted — it only keys the in-memory `runIdToGenerator` map and propagates through `ancestorRunIds`.

**Why:** The 0.1.4 fix coerced null → `''` to keep the parent agent's loop alive past the `Failed to start agent run` throw. That kept the orchestrator working but left `agentState.runId` falsy, which immediately re-triggers `Agent state has no run ID` at `packages/agent-runtime/src/run-programmatic-step.ts:131` the moment a sub-agent with `handleSteps` (thinker, file-picker, code-searcher, code-reviewer) gets spawned. Empty-string would also collide in the generator map across concurrent programmatic agents. Two alternatives considered: (a) loosen the guard to `!= null` so `''` passes — rejected because generator-map collisions silently cross-contaminate; (b) widen the `runId` type to `string | null` across agent-runtime — rejected as high-blast-radius. UUID synthesis is the smallest change with no downstream contract impact.

**Reversibility:** easy — revert the 17-line edit in `run-agent-step.ts` to go back to the `?? ''` behavior, but spawned sub-agents will crash again until a different fix lands. PORT marker not needed because the change is inside a code path upstream doesn't exercise (upstream always has a real runId from the codebuff.com backend).

## 2026-05-18 — Per-agent BYOK profile bindings (0.1.5)

**Decision:** Allow agent-id → profile bindings in `providers.json` (schema v2). SDK Path C resolves `byokAgentBindings[params.agentId] ?? activeByokProfile` so a spawned sub-agent (file-picker, code-searcher, …) can route through a different provider/model than the orchestrating top-level agent. CLI surfaces this via `/providers:bind`, `/providers:unbind`, `/providers:bindings`.

**Why:** v1 BYOK forced one profile-model for *every* agent in a run, so file-picker hit the user's expensive default model instead of a cheap Flash/DeepSeek lane. Three approaches considered: (a) env-flag flip to respect the agent template's hardcoded model (worked only when the user's provider also serves that exact id; OpenRouter-only really); (b) deeper per-agent overlay through Path C with full multi-profile semantics; (c) deferred to v2. Picked (b) because user already wanted multiple `/providers:add` profiles working in concert — schema bump was the minimum honest fix.

**Trade-off accepted:** schema migration on the shared providers.json. v1 readers (older 0.1.x) ignore the new `agentBindings` field silently — safe one-way. Mid-session bind/unbind is live on the SDK side (per-request lookup), but React-side `BYOK_AT_BOOT` gating is unchanged: ads/connecting hooks still pin at module load.

**Reversibility:** easy. SDK change is additive (one new branch + module state). CLI commands + storage are fork-only files. Schema bump is forward-compatible. PORT marker left in `sdk/src/impl/model-provider.ts` near `byokAgentBindings` for upstream merge if upstream introduces a similar mechanism.

## 2026-05-18 — Restore mod-default/max sub-agent spawning (0.1.5)

**Decision:** mod-default + mod-max now declare `spawn_agents` in `toolNames` and a curated `spawnableAgents` list (`file-picker`, `code-searcher`, `thinker`; mod-max also gets `code-reviewer`). mod-lite + mod-plan stay sub-agent-free.

**Why:** the upstream specialized sub-agents are already bundled by `cli/scripts/prebuild-agents.ts` (it walks all of `agents/`), so the only thing blocking BYOK users from using them was the deliberately-empty `spawnableAgents` on mod-*. Phase 4 left them off because a single shared profile-model defeated the point — Gemini-Flash file-picker would silently run on Sonnet. With per-agent bindings (above) restored, the specialization is meaningful again.

**Trade-off accepted:** spawned sub-agents still respect Path C — if no binding exists they use the active profile, same as the orchestrator. Users wanting cost savings *must* register a cheap profile and `/providers:bind <agent>` it; out of the box mod-default + Sonnet hits Sonnet for the file-picker too. Documented in the new `spawnerPrompt` strings.

**Reversibility:** easy — revert two `.agents/mod-*.ts` files + re-run prebuild.

## 2026-05-18 — OpenCode Go: clone, don't extend

## 2026-05-18 — OpenCode Go: clone, don't extend

**Decision:** Create `web/src/llm-api/opencode-go.ts` as a full sibling of `opencode-zen.ts` rather than parameterizing the Zen handler to handle both endpoints.

**Why:** Minimizes merge conflicts on upstream sync. Trivial to retire if upstream adds Go themselves (`git rm` one file + revert the dispatch ladder edits). Parameterizing would touch the Zen file on every upstream pull.

**Trade-off accepted:** ~620 LOC of duplicated handler logic. Mitigated by `PORT:` comment at top of `opencode-go.ts` instructing future maintainers to replay Zen bug fixes into Go.

## 2026-05-18 — Single shared `OPENCODE_API_KEY`

**Decision:** Reuse the existing `OPENCODE_API_KEY` env var for both Zen and Go endpoints. Did **not** add `OPENCODE_GO_API_KEY`.

**Why:** opencode.ai issues one key per account; Zen and Go are sibling endpoints under the same auth. Adding a separate var would force two secrets in deploy config for no upstream-visible reason.

**Revisit if:** opencode.ai starts issuing separate keys per endpoint.

## 2026-05-18 — Skip `ALLOWED_MODEL_PREFIXES` update

**Decision:** Did not add `'opencode-go'` to `ALLOWED_MODEL_PREFIXES` in `common/src/constants/model-config.ts`.

**Why:** Verified via grep that `ALLOWED_MODEL_PREFIXES` is only consumed by `common/src/types/dynamic-agent-template.ts` (Zod validator for agent template definitions), not by the chat-completions endpoint dispatch. Existing `opencode/` prefix (Zen) is also absent from the list and works fine — confirms the chat-completions path does not gate on it.

**Revisit if:** an agent template references `opencode-go/*` as its model id (then the template validator will reject it and the prefix must be added).

## 2026-05-18 — BYOK rip: Path C precedence via module-level singleton

**Decision:** Implement BYOK as `activeByokProfile` module-level mutable state in `sdk/src/impl/model-provider.ts`, mirroring the existing `chatGptOAuthRateLimitedUntil` pattern in the same file. CLI calls `setActiveByokProfile()` at startup and on `/providers:select`. `getModelForRequest()` checks Path C first, then falls through to Path A (ChatGPT OAuth) and Path B (Codebuff backend).
**Why:** SDK cannot import from CLI (inverted dep). Three alternatives considered: (a) move profile store to `common/` (bigger blast radius), (b) thread profile through every SDK call site as a param (deep plumbing through llm.ts → agent-runtime contract), (c) module singleton (smallest blast, matches existing pattern). Picked (c). Pre-existing SDK consumers without BYOK retain unchanged behavior because they never call the setter.
**Reversibility:** easy (single-file revert restores Path A/B-only behavior)

## 2026-05-18 — BYOK profile model wins over agent template model

**Decision:** When a BYOK profile is active, Path C resolves the model id as `profile.model ?? params.model`. The profile's model wins regardless of what the agent template requested.
**Why:** Agent templates hardcode model strings like `'anthropic/claude-sonnet-4.5'`. A user with an OpenAI BYOK profile would otherwise send that string to api.openai.com → 400. Single-profile single-model is a v1 limitation, documented. User changes via `/model <id>`. Per-agent model variation deferred to v2.
**Reversibility:** easy

## 2026-05-18 — Preserve Path B behind `CODEBUFF_USE_BACKEND=1`

**Decision:** Phase 5 did NOT delete the Codebuff backend code paths. Both `database.ts` (getUserInfoFromApiKey, fetchAgentFromDatabase, startAgentRun, etc.) and `model-provider.ts` Path B remain wired. The skip is gated on `getActiveByokProfile() !== null && CODEBUFF_USE_BACKEND !== '1'`.
**Why:** SDK is consumed by external users (per `sdk/`'s public API). Hard-deleting Path B is breaking. Env opt-in lets BYOK be the default while preserving SDK API for anyone who still relies on the backend.
**Reversibility:** easy. If BYOK CLI is the only consumer that ever ships from this fork, hard-delete is fine — change one line in `shouldSkipBackend()`.

## 2026-05-18 — Local `.agents/mod-*` standalone, not wrapping `createBase2`

**Decision:** Phase 4 mod-default/lite/max/plan templates are simple standalone `AgentDefinition` objects with inline tool lists, NOT wrappers around upstream `agents/base2/base2.ts` `createBase2()`.
**Why:** `createBase2` pulls in heavy freebuff/codebuff constants (`@codebuff/common/constants/freebuff-*`), spawns sub-agents (file-picker, code-searcher, editor-multi-prompt) that themselves have hardcoded codebuff.com model ids, and includes systemPrompt strings that reference codebuff.com docs. Wrapping it would defeat the BYOK goal. Standalone templates are simpler and more honest.
**Trade-off:** No specialized sub-agents. mod-max compensates with stronger instructions + broader tool surface. Per-agent specialization deferred to v2.

## 2026-05-18 — Launcher fetches binary from GitHub Releases, not bundled in npm package

**Decision:** Keep the `codebuff-mod` npm package launcher-only (~9 KB). On first run it downloads the platform binary from `github.com/EstarinAzx/codebuff/releases/download/v{version}/codebuff-mod-{platform}-{arch}.tar.gz` and caches at `~/.config/manicode/codebuff-mod[.exe]`. Mirrors the upstream launcher pattern; only `packageName` + download URL changed.
**Why:** Bundling 3+ platform binaries inside the npm tarball would balloon the package to ~150MB+ and hit npm's default 100MB limit. Optional-deps split (esbuild/swc pattern) is significant work. Launcher pattern reuses existing infra and keeps `npm install -g codebuff-mod` fast.
**Reversibility:** medium. To switch to bundled-binary later, edit `cli/release/index.js` to use local file path instead of HTTP fetch, and publish per-platform npm packages.

## 2026-05-18 — Bundle `.agents/mod-*.ts` into CLI binary at prebuild time

**Decision:** `cli/scripts/prebuild-agents.ts` scans both upstream `agents/` and fork-local `.agents/mod-*.ts`, merging the latter into the same `bundled-agents.generated.ts` manifest. mod-default/lite/max/plan ship inside the binary; the runtime `.agents/` scan in `cli/src/utils/local-agent-registry.ts` is now reserved for user-side overrides.

**Why:** End users run `cbm` from arbitrary cwds that do not contain `.agents/`. Without bundling, `mod-default` resolution falls through to the upstream codebuff.com agent template DB (unreachable in BYOK mode) and the CLI errors out with `Invalid agent ID: "mod-default"`. Considered (a) requiring users to keep a `.agents/` in their project root — rejected as bad UX, (b) shipping `.agents/` alongside the binary in a known cache dir — rejected because it doubles the install surface and conflicts with the user's own `.agents/`. Bundling is the smallest change that makes the fork's defaults work everywhere.

**Trade-off:** Adding a new fork-local mod-* template now requires re-running the prebuild step before `build:binary`. Captured in [[gotchas]].

**Reversibility:** easy (revert the `.agents/` scan block in prebuild-agents.ts).

## 2026-05-18 — `startAgentRun` null result is non-fatal in BYOK

**Decision:** `packages/agent-runtime/src/run-agent-step.ts` coerces a null return from `startAgentRun()` to empty string and skips the `Failed to start agent run` throw. Downstream call sites already guarded on `agentState.runId` truthiness, so the throw was redundant — and lethal in BYOK mode, where `sdk/src/impl/database.ts:348` deliberately returns null to skip central run tracking.

**Why:** `database.ts:349` advertised "callers tolerate it" as a comment but the caller did not. Two ways to fix: (a) widen `runId` to `string | null` across the entire agent-runtime contract — high blast radius, many type changes, and the downstream code already tolerates empty/missing values; (b) coerce at the entry point so the existing string-typed contract holds. Picked (b).

**Reversibility:** easy (one-line revert restores hard-throw behavior; only needed if we ever require a non-null runId in agent-runtime, e.g. to write run records locally instead of skipping).

## 2026-05-18 — Module-level `BYOK_AT_BOOT` flag in React hooks

**Decision:** Hooks that need to skip codebuff.com polling (`use-connection-status`, `use-gravity-ad`, `use-agent-validation`) compute a module-level `BYOK_AT_BOOT` boolean at module load time, not per-render.
**Why:** React's Rules of Hooks — early-returning conditionally inside a hook based on changing state breaks the hook-count invariant. If a user adds their first profile mid-session, the per-render check would flip from false to true and cause "rendered fewer hooks than expected" errors. Module-level flag is consistent for the lifetime of the process.
**Trade-off:** A user who adds their first BYOK profile mid-session continues to see ads / "connecting…" until they restart the CLI. Acceptable in v1.
