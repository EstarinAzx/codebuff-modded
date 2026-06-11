---
type: decisions
project: codebuff (fork — modded branch)
updated: 2026-06-11
tags: [decisions, modded]
---

# Decisions — fork-local

Upstream architectural decisions live in upstream `docs/` and (if added later) `docs/adr/`. This file tracks only the decisions made for fork-local work on the `modded` branch.

## 2026-06-11 — web_search/read_docs go direct-to-provider at the facade seam, with advertisement gating

**Decision:** Rewire the two backend-proxied web tools inside `codebuff-web-api.ts` (the facade), not the tool handlers: when no real backend is configured (`isBackendConfigured` = non-sentinel `NEXT_PUBLIC_CODEBUFF_APP_URL` + `CODEBUFF_API_KEY`), `callWebSearchAPI` dispatches to a serper→brave→tavily fallback chain (`fork-impls/search-providers.ts`, keys `SERPER_API_KEY`/`BRAVE_API_KEY`/`TAVILY_API_KEY`, primary picked by `CBM_SEARCH_PROVIDER`) and `callDocsSearchAPI` calls Context7 directly (keyless). Additionally, `assembleLocalAgentTemplates` strips `web_search` from every agent's `toolNames` when zero search keys exist (`gateByokWebTools`), so agents never advertise a tool that can only fail. `read_docs` is never stripped.

**Why:** Both tools were upstream backend-proxies (server held the Serper/Context7 keys, billed credits); the v1.1.0 BYOK rip deleted that backend but left the tools dialing the sentinel `http://127.0.0.1:1` — `web_search` died with "Unable to connect" after retry-backoff, `read_docs` with "Missing Codebuff base URL or API key". Facade seam chosen over handler rewrites because the handler tests spy on the facade module (zero test churn) and the edit surface is two early-return blocks instead of two function bodies. Upstream's own orphaned direct clients (`serper-api.ts`, `context7-api.ts` — left behind when search moved server-side) do the actual work. Backend-first priority preserves SDK Path B for external consumers. Gating at template assembly (not in the prompt builder) because prompt, stream-parser, and tool-executor all read the same template object — one strip covers all three. Also enforces the env-schema contract comment ("any network request reaching the sentinel is a bug") for these endpoints.

**Reversibility:** easy — delete the two dispatch blocks in `codebuff-web-api.ts`, the gate call in `agent-registry.ts`, and `fork-impls/{byok-web-tools,search-providers}.ts`; behavior reverts to upstream proxy-only. The `CiEnv` key additions are inert without them.

## 2026-06-11 — Ride upstream's snapshot deletion to a BYOK-only fork (strategy B)

**Decision:** When syncing `origin/main`/`upstream/main` (`452eb72a`, 2026-06-10) into the fork, **accept** upstream's mass deletion of `web/` and `packages/{internal,billing,bigquery,build-tools}` (and full `scripts/` minus `scripts/tmux`, `agents-graveyard/`, upstream `.agents/`, `.github/`, `python-app/`) rather than restore them. Upstream pivoted to publishing a thinned **CLI/SDK-only public snapshot** ("Sync public snapshot from freebuff-private", 97 commits, tree halved 2233→1170 files). The fork rides that pivot to finally drop the hosted backend, becoming BYOK-only. Executed on branch `sync-upstream-2026-06-11` (`74948dc99`); `modded` left untouched pending review.

**Why:** In default BYOK mode the hosted backend (Path B / `web/src/app/api/v1/chat/completions/_post.ts`) is dead weight — BYOK dispatches via SDK Path C (`fork-impls/byok-resolver.ts`) directly to the provider and never touches `web/`. Verified the shipped surface (`cli/`/`sdk/`/`common/`) holds **zero** runtime imports from `web/` and only three `@codebuff/internal` source imports, all of which upstream had already relocated to the new `@codebuff/llm-providers` package + `@codebuff/common`. Three alternatives considered: **(A) full restore** (`git checkout HEAD -- web packages/internal …`) — rejected: keeps a backend the fork never deploys and re-fights the same deletion on every future sync, since upstream will keep shipping the thinned snapshot; **(C) hybrid** (drop `web/`, keep `packages/internal` so the sdk imports stay put) — rejected: still carries the deleted-upstream `packages/internal` as fork-local divergence and leaves the import surface mid-relocation; **(B) ride the deletion** — picked: aligns the fork's dependency graph with upstream's new shape, so future syncs conflict less, and realizes the long-deferred "hard-delete web/+freebuff backend" item at zero extra cost (upstream did the delete for us).

The merge conflict surface was tiny (6 files; only `model-provider.ts` + `env-schema.ts` non-trivial) — the real work was the deletion decision, not conflict resolution. Re-pointed the one remaining dead import (`byok-resolver.ts` → `@codebuff/llm-providers/openai-compatible`), vendored `packages/llm-providers/` from upstream, and patched the `use-gravity-ad.ts` BYOK safe-default for upstream's widened `GravityAdState` (added `recordClick`). Gained Composio meta-tools, the `read_url` tool, Serper web-search (was Linkup), and MiMo + MiniMax-M3 models.

**Trade-off accepted:** The fork can no longer run the codebuff.com backend from in-repo source — `CODEBUFF_USE_BACKEND=1` now points only at a *remote* codebuff.com (Path B in `sdk/src/impl/database.ts` still exists for external SDK consumers, but the local `web/` app that served it is gone). External SDK users who deployed the fork's `web/` lose that path; acceptable — the fork is published as the `codebuff-mod` CLI, not as a backend host. `scripts/check-env-architecture.ts` was dropped (verified nothing in the merged tree invokes it), so the env-architecture allowlist debt is moot. `MERGE-STRATEGY.md`'s conflict map is now stale (it maps `web/_post.ts`, `packages/internal`, `scripts/check-env-architecture.ts` — all deleted) and must be rewritten for the lean tree before the next sync.

**Reversibility:** easy pre-ship — `git branch -D sync-upstream-2026-06-11`; `modded` never moved. Post-ship — the deleted trees live in history at `e534b0650` (pre-merge `modded` tip) and on `modded-pre-shim`; `git checkout e534b0650 -- web packages/internal …` restores them if the backend is ever wanted back. The 97 upstream commits + merge commit are a single `--no-ff` unit, revertible wholesale.

## 2026-05-22 — `opencode-go` live-probes `/models` instead of a hardcoded catalog (1.0.6)

**Decision:** Remove `opencode-go` from the hardcoded `MODEL_CATALOG` in `cli/src/utils/providers-models.ts` (was a single id, `['opencode-go/glm-5']`) and put it in the empty-catalog set alongside `openrouter` / `together` / `groq`. An empty catalog makes `getModelsForPreset` fall through to the live `<baseUrl>/models` probe (cache-first, 24h disk cache at `models-cache.json`, busted by `/providers:refresh-models`). The `opencode` Zen sibling preset was deliberately left on its 2-id hardcoded catalog — out of scope per user call.

**Why:** A user reported `/model` on an opencode-go profile listing only one model. Root cause: the catalog entry had been a single hardcoded id since BYOK Phase 1 (`f608c34be`) — it never showed more. The orchestrator returns the catalog verbatim whenever it is non-empty and never probes. The opencode-go endpoint (`https://opencode.ai/zen/go/v1/models`) is OpenAI-compatible and live-serves 15+ ids (verified: HTTP 200, full `data` array). Two alternatives considered: (a) expand the hardcoded catalog to all 15 ids — rejected, guaranteed to drift as opencode.ai adds models, and the whole point of the empty-catalog probe path already exists for exactly this churn; (b) live-probe — picked, consistent with the three other churning-catalog presets and zero-maintenance.

The change also fixes a latent prefix bug. The old catalog id `opencode-go/glm-5` carried an `opencode-go/` provider prefix, but BYOK Path C dispatch (`createDirectProviderModel` in `byok-resolver.ts`) sends the resolved model id raw in the chat-completions body, and the endpoint expects bare ids (`glm-5`). Picking the prefixed id from the picker would have produced a wrong `model` field. Probe results come back already-bare from `data[].id`, so the probe path is correct by construction.

**Trade-off accepted:** `/model` now needs one network round-trip on first use per 24h window (cached after). Offline users get whatever is cached, or an empty list on a cold cache — same posture as openrouter/together/groq, acceptable. The `opencode` Zen preset keeps the identical hidden bug until someone fixes it the same way (tracked in [[active-work]] Deferred).

**Reversibility:** trivial — restore the `'opencode-go': ['opencode-go/glm-5']` line. One-file revert.

## 2026-05-19 — Enforce todo closure via mod-* `instructionsPrompt` (1.0.4)

**Decision:** Add an explicit "Todo closure (mandatory before `end_turn`)" block to the `instructionsPrompt` of `.agents/mod-default.ts` and `.agents/mod-max.ts`. The block instructs the agent that (a) every item in `write_todos` must be resolved (complete or cancelled with a one-line reason) before calling `end_turn`, (b) the final summary message IS the work for any "summarize / wrap up" todo and must be marked complete in the same `write_todos` call that closes the rest of the list, and (c) `end_turn` with open todos is a bug.

**Why:** A recurring UX papercut — across multiple unrelated tasks (README writing, `linelens` CLI build, etc.) the agent would finish all real work, write its final summary message, then call `end_turn` with the "Summarize changes" todo still pending. User had to manually re-prompt "finish the last todo" each time. Root cause is model behavior: the agent treats the act of writing the summary as completion, never re-emits a `write_todos` call to flip the box. Three alternatives considered: (a) widen the prompt to enforce closure — picked, smallest blast radius, zero code changes; (b) hook into `end_turn` server-side and auto-mark every open todo complete — rejected as overreach (would also close todos the agent legitimately abandoned without acknowledging); (c) ship a `set_messages`-on-`end_turn` lifecycle assertion in `packages/agent-runtime/` — rejected as architectural change for a UX issue, plus it would touch agent-runtime which the shim refactor deliberately left untouched.

The patch is template-only — zero changes to SDK, agent-runtime, hooks, or shim infrastructure. Pre-shim binary behavior is identical. mod-lite and mod-plan deliberately left alone — they don't use `write_todos` at the same frequency and adding boilerplate would dilute their lighter-weight contracts.

**Trade-off accepted:** Prompt-only enforcement is best-effort, not guaranteed. The model may still skip a todo if it deeply misreads the request. If repros persist after 1.0.4, escalate to agent-runtime-side auto-close (option c above). Slight `instructionsPrompt` bloat — mod-default went from 1-sentence to ~12 lines, mod-max gained one numbered step + a closing paragraph. Acceptable: instructions are pure tokens-in, not surface area for upstream merge conflicts.

**Reversibility:** trivial. Revert the two `.agents/mod-*.ts` files, re-run `bun run scripts/prebuild-agents.ts`, rebuild `cli/bin/codebuff-mod.exe`. Pre-shim binary already lacks the patch (todo-closure regression preserved as a control case if needed for future debugging).

## 2026-05-19 — Hook-registry shim refactor (1.0.3)

**Decision:** Convert ~30 scattered in-place fork edits across upstream files into one-line dispatch calls through a hook registry at `sdk/src/impl/fork-hooks.ts`. Fork-local logic moves into `*/fork-impls/` directories. Upstream files retain a single `getForkHooks().<name>?.(...)` call at the equivalent spot; multi-line BYOK logic lives in fork-impls. Hook registration happens at boot from `cli/src/init/init-app.ts` (CLI) and via explicit `registerXxxHooks()` calls within `byok-resolver.ts` (SDK).

**Why:** Upstream merge friction was the binding constraint. ~30 in-place edits meant every `git merge upstream/main` was an afternoon of conflict resolution. Three alternatives considered: (a) pure rebuild from `upstream/main` re-implementing each change — rejected as expensive replay with no architectural win; (b) overlay-as-package consuming upstream as npm dependency — rejected as multi-week rewrite blocked on upstream cooperation; (c) thin-shim each in-place edit to a one-line hook — picked. Cheapest path that reduces conflicts without dropping features.

**Trade-off accepted:** Plan target was ~70% LOC reduction in modified files; actual delivered ~15% (1393 → 1177 lines vs `upstream/main`). Modified-file count flat (40 → 41). Three causes: (1) React hooks #5–7 reverted because bun-compile tree-shook the hook registration — see [[gotchas]] "Fork-hook registration silently no-ops if tree-shaken"; (2) heavy files (`command-registry.ts`, `message-block.tsx`, `_post.ts`) couldn't fully shim — codex preset wiring, theme rendering, opencode-go dispatch all touch upstream control flow in ways resistant to single-line extraction; (3) new shim infra added lines (`init-app.ts` boot registration, `sdk/src/index.ts` exports). 31 new files in `fork-impls/` dirs are zero-conflict by design. Real merge cost depends on which upstream files churn, not LOC totals.

**Reversibility:** Easy. Branch `modded-pre-shim` + tag `v1.0.2-pre-shim` permanently anchor the pre-shim shape. Rollback path documented in `.context/active-work.md` §Rollback. Pre-shim binary preserved at `cli/bin/codebuff-mod.pre-shim.exe`.

## 2026-05-19 — `OPENROUTER_TO_OPENAI_MODEL_MAP` is the single source of truth for OAuth allowlist + codex picker (1.0.0)

**Decision:** The map literal at `common/src/constants/chatgpt-oauth.ts` is the *only* place codex-routable model ids are listed. `Object.keys(map)` feeds both `isChatGptOAuthModelAllowed` (the non-BYOK global OAuth allowlist) and `MODEL_CATALOG.codex` in `cli/src/utils/providers-models.ts` (the picker catalog shown to users on codex profiles). Adding or removing an id is a one-line change that propagates to both surfaces automatically. The codex picker now flows through the same `getModelsForPreset` orchestrator every other preset uses — no codex-specific branch in `handleModelCommand`.

**Why:** 0.2.1 originally tried to live-probe `https://chatgpt.com/backend-api/models` with the per-profile OAuth bearer. That endpoint does not exist for OAuth-bearer tokens — Codex CLI itself ships a fixed catalog baked into its binary for the same reason. Two alternatives considered: (a) maintain two separate lists, one for routing and one for the picker — rejected, guaranteed drift; (b) keep the probe and live with the "Could not probe /models" error in `/model` output — rejected, blind user UX. Picked (c): derive the picker from the allowlist. The fork already had the allowlist; reusing it for the picker is additive and zero-cost. Backward-safe because the catalog branch in `getModelsForPreset` already existed for `openai`, `anthropic`, etc. — codex just rejoined that branch.

The "newest first" ordering (GPT-5.5 → GPT-4o-mini, codex-CLI aliases last) is intentional: `Object.keys()` insertion order = picker display order, so users see the strongest reasoning models without scrolling. Reorderable freely; no functional impact.

**Trade-off accepted:** Picker only shows ids the fork has explicitly added. New OpenAI ids that route correctly against `chatgpt.com/backend-api/codex/responses` but are not in the map are invisible until someone updates the literal. Acceptable: same constraint Codex CLI lives under, and the single-source-of-truth invariant is worth more than auto-discovery.

**Reversibility:** easy. To restore the live probe, restore `fetchCodexModelsFromEndpoint` (the deleted function — see git history of `cli/src/utils/providers-models.ts` at 1.0.0 commit `9c027af8e`) and the codex ternary in `handleModelCommand`. Not recommended; the endpoint stays dead.

## 2026-05-19 — Codex OAuth as a BYOK preset with per-profile token storage (0.2.1)

**Decision:** Introduce a `codex` preset (`requiresApiKey: false`) that runs the existing Codex-compatible ChatGPT OAuth PKCE flow when added via `/providers:add codex [name]`, persists tokens to a NEW per-profile-keyed file `~/.config/manicode/codex-oauth.json` (separate from the legacy `credentials.json#chatgptOAuth` singleton), and sits in `providers.json` as a normal profile with empty `apiKey` plus a new optional `oauthProfileId` discriminator. SDK Path C in `model-provider.ts` branches on `oauthProfileId`: when set, it resolves the per-profile token via `getValidCodexCredentials(profileId)` (disk-backed, refresh-on-demand, de-duplicated by profileId) and dispatches through the existing `createOpenAIOAuthModel` factory — the same ChatGPT-backend code path `/connect:chatgpt` uses. `/providers:remove` on a codex profile also clears that profile's entry from `codex-oauth.json`. `/connect:chatgpt` stays unchanged alongside it.

**Why:** Three goals: (a) put OAuth-based auth into the same uniform `/providers:*` UX as raw-key profiles so users don't learn two parallel concepts, (b) support multiple ChatGPT accounts as distinct profiles, (c) reuse 100% of the existing OAuth machinery (PKCE flow, callback server, refresh logic, Codex Responses-API fetch shim, `OPENROUTER_TO_OPENAI_MODEL_MAP` allowlist) so the diff stays small. Four alternatives considered: (1) keep OAuth as a separate top-level toggle, drop codex out of `/providers` — rejected, two surfaces for the user to learn, no path to multi-account; (2) store per-profile creds inline on the `ProviderProfile` row in `providers.json` — rejected, tangles the sanitizer with refresh side-effects and bloats providers.json with high-churn token blobs that get rewritten on every refresh; (3) extend the singleton `credentials.json#chatgptOAuth` schema to a keyed map — rejected, would force a schema migration on every existing `/connect:chatgpt` user for a feature they didn't ask for, and the singleton has its own rate-limit + override semantics that don't map cleanly to multi-account; (4) per-profileId file in the SDK mirroring `credentials.ts` patterns — picked. Path A singleton + Path C per-profile coexist with zero interference; rollback is one-file delete.

The `oauthProfileId` field on `BYOKProfile` is the discriminant. Defaults to `profile.id` at `addProfile` time when preset === `codex`; explicit override left for future multi-profile-shared-OAuth migration but unused today. Per-agent bindings work transparently because `buildSdkBindings()` passes `oauthProfileId` through — `/providers:bind code-searcher codex-personal` routes that sub-agent through the bound codex profile's OAuth token, symmetric with raw-key profile binds.

`/model` for codex profiles probes `https://chatgpt.com/backend-api/models` with the OAuth bearer. The endpoint shape is unverified — Codex CLI itself uses a fixed catalog so this URL may 404. Per user design call (during grilling), there is NO hardcoded fallback list: on probe failure, `/model` prints "Swap directly: /model <id>" and the user can still set any allowlisted id manually. This honors the user's "we won't get latest if we hardcode" preference at the cost of one ergonomic regression if the endpoint never works. Revisit decision if the endpoint proves to be permanently 404.

**Trade-off accepted:** New optional field on `BYOKProfile` SDK contract — additive, all existing SDK consumers compile unchanged because the field is `?:`. New `~/.config/manicode/codex-oauth.json` file is yet another piece of state in the manicode config dir (alongside `providers.json`, `credentials.json`, `models-cache.json`); chosen over schema-migrating an existing file. The `/providers:add` registry handler became async to await the OAuth completion message — slight UX divergence from sync presets (the chat shows two consecutive system messages: "browser opening" then "connected"), matches the existing `/providers:test` pattern. Browser flow is untested end-to-end in 0.2.1; manual smoke required pre-ship.

**Reversibility:** medium. SDK changes are additive (one new module + one new optional field + one branch in `getModelForRequest`). CLI changes are localized: `codex` preset entry, async handler, sync helper, model-probe variant. To revert: delete `sdk/src/codex-credentials.ts` + the OAuth branch in `model-provider.ts` + the codex preset entry + `handleProvidersAddCodex` + the codex branch in `command-registry.ts` providers:add handler. The `oauthProfileId` field can be left on the type as a no-op for backward-readable providers.json files; or stripped from the sanitizer too. ~9 file revert.

## 2026-05-19 — Dedicated `aiPanelBorder` theme key for the prose panel (0.2.0)

**Decision:** Introduce a new top-level `ChatTheme` field `aiPanelBorder` (`#fbbf24` dark / `#d97706` light, amber) and use it as the primary resolution for the bordered AI-prose panel in `message-block.tsx`. Fallback chain: `theme.aiPanelBorder ?? theme.secondary ?? theme.aiLine ?? theme.foreground`. Sub-agent group borders in `blocks/agent-branch-item.tsx` are untouched and continue to use `theme.secondary` (expanded) / `theme.muted` (collapsed).

**Why:** 0.1.12 left the prose panel border and the sub-agent expanded border both at `theme.secondary` (blue-gray `#a3aed0`). When the assistant's reply was preceded by spawned sub-agents, the panel visually merged into the agent tree — no way to see at a glance "this is the final answer". Three alternatives considered: (a) reuse `theme.primary` (lime) — rejected, already overloaded with userLine, headings, and the logo accent; another lime panel makes chat monotone. (b) reuse `theme.link` (blue `#3B82F6`) — rejected, blue-on-blue with `secondary` is weak contrast and bends the link semantic. (c) dedicated field with warm hue — picked. Warm-vs-cool is the strongest contrast axis against the existing blue-gray sub-agent borders, harmonises with the warm `markdown.headingFg` yellow already rendered inside the panel, and earns its own semantic role for future retheming. Same precedent as `aiLine`, `userLine`, `imageCardBorder` — minor cosmetic role with its own theme key.

**Trade-off accepted:** New required field on `ChatTheme` interface — any test fixture or theme override literal that constructs a full `ChatTheme` must add the field (segmented-control test fixture patched). Partial-override flow via `parseThemeOverrides()` is unaffected (Partial<ChatTheme> consumers still compile). Backward-safe at runtime via the `??` fallback chain.

**Reversibility:** easy. Remove the field from the interface + defaults, revert the `aiBorderColor` line in `message-block.tsx`, and the panel falls back to `theme.secondary` — pre-0.2.0 behaviour. Three-file revert.

## 2026-05-19 — Propagate the BYOK env-gate to all backend-touching surfaces (0.1.10)

**Decision:** Every CLI surface that talks to codebuff.com — three React hooks (`use-connection-status`, `use-gravity-ad`, `use-agent-validation`) and the `LoginModal` render gate in `app.tsx` — now short-circuits when `process.env.CODEBUFF_USE_BACKEND !== '1'`, independent of whether a BYOK profile is registered. The hooks' `BYOK_AT_BOOT` flags previously gated *only* on `getActiveProfile() !== null`. The `LoginModal` gate previously only checked `requireAuth`/`isAuthenticated` without re-checking the env, so the `/logout` handler's `setIsAuthenticated(false)` could still surface the modal post-boot. The `/logout` command itself now short-circuits in BYOK default mode with a pointer to `/providers:remove` instead of mutating auth state.

**Why:** 0.1.7 added the `CODEBUFF_USE_BACKEND !== '1'` env-gate at two spots (`index.tsx` startup, `validateApiKey` short-circuit) and explicitly stated "LoginModal is unreachable in BYOK mode." But the gate was only applied at boot to those two surfaces. A fresh-device install (no profile *yet*) still:
- pinged the unset health-check endpoint forever → status indicator stuck on "connecting…" (`use-connection-status`),
- hit the unset ads endpoint in a loop (`use-gravity-ad`),
- silently failed remote agent validation, blocking message send with `errors: []` (`use-agent-validation`).

Worse, the user could *reach* the dead `LoginModal` again by running `/logout` — which calls `setIsAuthenticated(false)`, satisfying the modal's render gate in `app.tsx`. The lockout symptom of 0.1.6 was back, just via a different door.

Three alternatives considered: (a) widen the hooks' `BYOK_AT_BOOT` to react to mid-session profile additions — rejected because Rules-of-Hooks forbids conditional hook execution flipping mid-render (the comment in `use-gravity-ad.ts` explicitly documents this trade-off); (b) gate everything on `getActiveProfile()` and require users to register a profile before the CLI does anything — rejected because that's exactly the lockout 0.1.7 fixed; (c) propagate the existing env-gate everywhere the backend is touched — picked. Matches `shouldSkipBackend()` precedent on the SDK side and is deterministic at boot.

**Trade-off accepted:** "BYOK_AT_BOOT" is now a slight misnomer in those three hooks — the flag fires whenever the backend is *disabled* at boot, regardless of profile state. Name kept to avoid renaming churn; updated file-top docstrings to explain both branches. `/logout` in BYOK mode no longer clears `credentials.json` (since the new branch returns before calling `logoutMutation`). Acceptable: BYOK installs don't have a `credentials.json` in the first place, and old leftover files don't hurt anything because `validateApiKey` short-circuits to the synthetic user before reading them.

**Reversibility:** easy — revert the env-check in each of the five locations. Hooks would fall back to the profile-only gate (still works once a profile exists). The `/logout` BYOK branch is a self-contained early-return that can be deleted to restore the upstream logout flow.

## 2026-05-19 — Banner mark is "CODEBUFF - M", not "- MODDED" (0.1.8)

**Decision:** The full ASCII logo (`LOGO_CODEBUFF` in `cli/src/login/constants.ts`) renders "CODEBUFF - M" — the modded suffix abbreviated to a single block letter. The small ASCII logo renders "CBM". The full word "MODDED" in block ASCII was tried and rejected; it pushed the banner to ~135 cols.

**Why:** Block-letter ASCII at the figlet "ANSI Shadow" scale costs ~9–11 cols per glyph. Full "CODEBUFF - MODDED" is ~135 cols — wider than nearly every real terminal, so it would have fallen back to the small logo for almost everyone, defeating the rebrand. "CODEBUFF - M" lands at ~92 cols, which fits standard 100–120 col terminals. The full-logo width threshold in `use-logo.tsx` was raised `70` → `92` to match; terminals 20–91 cols wide now show the small "CBM" logo (previously they got the full banner down to 70 cols). Accepted as a deliberate tradeoff — the alternative was a banner almost no one sees.

**Reversibility:** easy — cosmetic, two-file revert (`constants.ts` art + `use-logo.tsx` threshold). No behavior impact beyond which logo size renders at a given width.

## 2026-05-19 — Skip the codebuff.com login gate entirely in BYOK mode (0.1.7)

**Decision:** The CLI startup gate (`cli/src/index.tsx`) and the auth-validation query (`cli/src/hooks/use-auth-query.ts`) no longer hard-require a codebuff.com session. The startup gate sets `requireAuth=false` whenever an active BYOK profile exists **OR** `CODEBUFF_USE_BACKEND !== '1'`. `validateApiKey()` returns the synthetic local user whenever `CODEBUFF_USE_BACKEND !== '1'`, not only when a profile is active. Net effect: in the default BYOK CLI the `LoginModal` is unreachable; it renders only under the explicit `CODEBUFF_USE_BACKEND=1` escape hatch.

**Why:** The fork ripped out the codebuff.com backend, but the login gate survived as a hard wall. A user with no provider profile and no `credentials.json` — a fresh `npm i -g codebuff-mod`, or anyone who ran `/logout`, or (the actual report) someone who `/providers:remove`d all their profiles — was trapped on a `LoginModal` whose `POST /api/auth/cli/code` targets `http://127.0.0.1:1` (unset backend host) and can never connect. `LoginModal` renders *before* the chat input, so there was no way to reach `/providers:add` to escape. The existing BYOK escape hatches (`getUserCredentials` synthetic fallback, `validateApiKey` short-circuit) all gated on `getActiveProfile()` being truthy — useless precisely when the user has zero profiles. Two alternatives considered: (a) replace `LoginModal` with a BYOK provider-onboarding screen — better UX but a much larger change; (b) detect backend reachability at runtime — flaky, network-dependent. Picked the env-gate approach because it matches the existing `shouldSkipBackend()` / Path C pattern (`CODEBUFF_USE_BACKEND` is already the fork's one backend toggle) and is deterministic.

**Trade-off accepted:** A user with no profile now lands directly in the chat surface with no provider configured — agent runs fail until they `/providers:add`. No onboarding nudge yet (carry-over open question). Better than a hard lockout.

**Reversibility:** easy — revert the `index.tsx` + `use-auth-query.ts` edits to restore the upstream gate. Also added the fork's BYOK files to `additionalProcessEnvAllowlist` in `scripts/check-env-architecture.ts` (they gate on raw `process.env.CODEBUFF_USE_BACKEND` / `CODEBUFF_PROVIDERS_PATH`); those lines were *already* failing the env-architecture check before 0.1.7 — the fork shipped via `build:binary` direct, which skips the full `bun run typecheck` gate. The allowlist unbreaks that pre-existing debt.

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
