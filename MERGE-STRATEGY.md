# Merge Strategy — upstream → main → modded (post strategy-B lean tree)

How to safely pull upstream Codebuff changes into this fork without breaking the BYOK rip on `modded`.

> Read this BEFORE running `git merge` or `git pull` against upstream. The fork has hot conflict zones and a documented resolution map below.
>
> **Coverage: post strategy-B snapshot sync (2026-06-11).** On that date the fork synced `upstream/main` (`452eb72a`, the first "Sync public snapshot from freebuff-private" series) and chose **strategy B — ride the deletion**: upstream had pivoted to publishing a thinned **CLI/SDK-only public snapshot**, so the fork accepted the removal of `web/`, `packages/{internal,billing,bigquery,build-tools}`, full `scripts/`, `agents-graveyard/`, and upstream `.agents/` rather than restore them. The fork is now **BYOK-only with no in-repo backend**. See [.context/decisions.md](./.context/decisions.md) "Ride upstream's snapshot deletion to a BYOK-only fork (strategy B)".
>
> **This rewrite reflects the lean tree.** The big one-time divergence (~320k deletions) is already resolved. Future syncs are vs upstream's already-lean snapshot, so deletion sets are normal-sized — but upstream ships **squashed snapshot commits** ("Sync public snapshot from freebuff-private"), so per-commit messages are useless; drive everything off the two-endpoint diff `git diff <merge-base> origin/main`.
>
> If the fork bumps a major version without this file being touched, suspect drift — re-grep before trusting.

---

## What changed in the strategy-B sync (so the next agent isn't surprised)

- **Upstream is snapshot-only now.** `CodebuffAI/codebuff:main` is a thinned CLI/SDK public mirror (~1170 files, was ~2233). It no longer contains `web/`, `packages/{internal,billing,bigquery,build-tools}`, the full `scripts/` tree (keeps only `scripts/tmux`), `agents-graveyard/`, `.github/`, `python-app/`, or the upstream `.agents/` dev agents.
- **`@codebuff/internal` is DELETED.** Its `openai-compatible` factory moved to a new vendored upstream package **`@codebuff/llm-providers`** (`./openai-compatible` export). `OpenRouterProviderOptions` moved to `@codebuff/common/types/agent-template`. Never re-introduce a `@codebuff/internal` import — it will not resolve.
- **The fork's backend is gone.** No `web/` app, no `web/src/app/api/v1/chat/completions/_post.ts`, no `web/src/fork-impls/provider-dispatch.ts`, no `web/src/llm-api/opencode-go.ts`. The `opencode-go` provider lane is now **BYOK Path-C only** (SDK `byok-resolver.ts` `createDirectProviderModel` + `providers-models.ts` live-probe). Path B (`CODEBUFF_USE_BACKEND=1` in `sdk/src/impl/database.ts`) still exists for external SDK consumers but points at a *remote* codebuff.com — the fork no longer hosts it.
- **`scripts/check-env-architecture.ts` is gone**, and with it the env-architecture allowlist concern. Nothing in the tree invokes it anymore.
- **There is no root aggregate `typecheck` / `test` script.** Upstream's lean root `package.json` dropped them. Verify per package (`cli` / `sdk` / `common` each ship `tsc --noEmit -p .` + `bun test`).

---

## Branch topology

```
CodebuffAI/codebuff  (upstream, public — now a CLI/SDK-only snapshot)
        │
        │  git fetch upstream
        ▼
   main  ──────────► origin/main          ← clean mirror of upstream snapshot
        │            (EstarinAzx/codebuff-modded)
        │
        │  git merge main
        ▼
   modded ─────────► origin/modded         ← fork-local, published as codebuff-mod
        │            (EstarinAzx/codebuff-modded)
        │
        ▼
   modded-pre-shim ─► origin/modded-pre-shim  ← archive, pre-shim rollback anchor
   (tag v1.0.2-pre-shim pins same commit)
```

- **`main`** is a passive mirror of upstream `CodebuffAI/codebuff:main`. `origin/main` == `upstream/main`. Never commit fork-local work here; its only job is to stage the latest upstream snapshot tip before merging into `modded`.
- **`modded`** is where every fork-local commit lives. Published to npm as `codebuff-mod`, tagged for GitHub Releases.
- **`modded-pre-shim`** preserves the pre-shim shape (`6048b92ba`, v1.0.2). Tag `v1.0.2-pre-shim` anchors it.
- The pre-strategy-B `modded` tip (`e534b0650`, last commit before the lean sync) still has the full `web/` + `packages/internal` trees in history — `git checkout e534b0650 -- web packages/internal …` restores them if the backend is ever wanted back.
- One-way flow: `upstream/main` → `origin/main` → `modded`. Never push `modded` commits back into `main`.

---

## One-time setup — verify remotes

```bash
git remote -v
# expected:
# origin    https://github.com/EstarinAzx/codebuff-modded.git (fetch/push)
# upstream  https://github.com/CodebuffAI/codebuff.git (fetch/push)
```

If `upstream` is missing on a fresh checkout:

```bash
git remote add upstream https://github.com/CodebuffAI/codebuff.git
git fetch upstream
git remote set-url --push upstream DISABLED   # fail fast on accidental push
```

---

## Sync recipe

Rebase **often** (monthly at most) — large gaps make the BYOK env-gate and SDK conflicts compound.

### Step 1 — confirm `modded` is clean

```bash
git switch modded
git status                  # must be clean working tree
git pull --ff-only origin modded
```

Never start a merge with uncommitted local changes. (In the strategy-B sync, an uncommitted `.context/` doc edit blocked the `main` fast-forward — commit or stash docs first.)

### Step 2 — fast-forward `main` to upstream

```bash
git switch main
git fetch upstream
git merge --ff-only upstream/main
git push origin main
```

If `--ff-only` fails, `main` diverged — someone committed fork-local work to it by mistake. **Stop and investigate.** `main` must always fast-forward.

### Step 3 — record divergence before merging

```bash
git switch modded
git rev-list --count main ^modded      # commits behind (upstream ahead)
git rev-list --count modded ^main      # commits ahead (fork-local)
git diff --stat main...modded | tail -1
```

A large *deletion* count in the diff is now NORMAL only if upstream thinned further; the one-time 320k-deletion event is done. If you see another whole-package deletion, re-read upstream's intent before accepting it.

### Step 4 — merge `main` into `modded`

```bash
git merge --no-ff main -m "merge upstream main into modded (sync up to <upstream-sha>)"
```

Use `--no-ff` so the sync is one revertible unit. When git stops on conflicts, open every conflicting file and apply the [Conflict map](#conflict-map) rules — **do not blindly accept either side.**

**Deletion handling (strategy-B default):** the fork is BYOK-only, so *accept* upstream deletions of backend/infra trees. Only actively preserve: fork-only files (they survive as pure additions — they never appear in upstream's deletion set), the conflict-map resolutions, and any fork-only file that happens to live under an otherwise-deleted dir (grep for orphans — the strategy-B sync had to hand-delete two leftover `web/` fork files upstream's deletion set didn't cover).

### Step 5 — verify before pushing

No root aggregate scripts — run per package:

```bash
bun install                                  # regenerate lockfile for any dropped/added pkgs

(cd common && bun run typecheck)             # tsc --noEmit -p .
(cd sdk    && bun run typecheck)
(cd cli    && bun run typecheck)

(cd sdk    && bun test)                      # BYOK skip + Path-C tests must stay green
(cd common && bun test)
(cd cli    && bun test)                      # see baseline note below

cd cli && bun run build:binary               # ✅ Built codebuff-mod.exe — full runtime graph
./bin/codebuff-mod.exe --version             # boots; prints version
```

**Test baseline:** SDK BYOK tests must be 100% green. CLI `providers*` tests carry **2 known-stale failures** unrelated to any merge — `providers-models.test.ts` asserts `MODEL_CATALOG['opencode-go'].length > 0` (false since v1.0.6 moved it to the live-probe set) and `providers.test.ts` asserts schema `version === 1` (fork is on v2/v3). Update those two tests when convenient; they are not merge regressions.

Then a BYOK smoke against a real profile:

```bash
cbm
# inside cbm:
/providers:list                 # all profiles still present?
/providers:bindings             # bindings still load?
# small prompt against your active profile → Path C dispatches
```

### Step 6 — release (manual; this is the full runbook, not a sketch)

> ⚠️ **`bun run release` (`cli/scripts/release.ts`) does NOT work for the fork** — it dispatches a GitHub Actions workflow on upstream's private `CodebuffAI/freebuff-private`, which the fork can't reach. The fork release is **fully manual**, below.
>
> ⚠️ **Ordering is load-bearing.** The npm package is a ~9 kB launcher that downloads the platform binary from the fork's **GitHub Release** at install time (`cli/release/index.js` → `https://github.com/EstarinAzx/codebuff-modded/releases/download/v<ver>/codebuff-mod-<platform>-<arch>.tar.gz`). So the **GitHub release with binaries MUST exist before `npm publish`** — publish the launcher first and every `npm i -g codebuff-mod` 404s on the binary download.

**6a. Bump version** (both files — the launcher version builds the download URL):
```bash
# edit cli/package.json + cli/release/package.json → same vX.Y.Z
git add cli/package.json cli/release/package.json
git commit -m "chore(release): bump to X.Y.Z — <one-line reason>"
```
Choose the bump by user impact on the CLI: new tools/models = minor; bugfix-only = patch. (Internal churn like a backend removal does not force a major because CLI behavior stays back-compatible.)

**6b. Build all three platform binaries @ the new version** (the binary embeds `CODEBUFF_CLI_VERSION`, so rebuild AFTER the bump). win32 is the host (native); linux is cross-compiled via `OVERRIDE_*` env (bun cross-targets + fetches the per-platform OpenTUI native bundle from npm). Each build overwrites `cli/bin/codebuff-mod[.exe]`, so **package each tarball immediately after its build**. The tarball is the **binary only** (no wasm sibling — that matches every prior shipped release):
```bash
cd cli

# win32-x64 (host)
bun run build:binary
./bin/codebuff-mod.exe --version                    # must print X.Y.Z
tar -czf dist-binaries/codebuff-mod-win32-x64.tar.gz -C bin codebuff-mod.exe

# linux-x64 (cross)
OVERRIDE_TARGET=bun-linux-x64 OVERRIDE_PLATFORM=linux OVERRIDE_ARCH=x64 bun run build:binary
tar -czf dist-binaries/codebuff-mod-linux-x64.tar.gz -C bin codebuff-mod

# linux-arm64 (cross)
OVERRIDE_TARGET=bun-linux-arm64 OVERRIDE_PLATFORM=linux OVERRIDE_ARCH=arm64 bun run build:binary
tar -czf dist-binaries/codebuff-mod-linux-arm64.tar.gz -C bin codebuff-mod

ls -la dist-binaries/*.tar.gz                        # 3 files, ~47-50 MB each
cd ..
```
`cli/bin/` and `cli/dist-binaries/` are gitignored — these artifacts never enter git. (macOS targets `darwin-x64`/`darwin-arm64` exist in `build-binary.ts` but are deferred — not shipped.)

**6c. Push branch + tag:**
```bash
git push origin modded
git tag -a vX.Y.Z -m "vX.Y.Z — <summary>"
git push origin vX.Y.Z
```

**6d. GitHub release WITH the three tarballs** (must precede publish):
```bash
gh release create vX.Y.Z --repo EstarinAzx/codebuff-modded \
  --title "vX.Y.Z — <title>" --notes "<notes>" \
  cli/dist-binaries/codebuff-mod-win32-x64.tar.gz \
  cli/dist-binaries/codebuff-mod-linux-x64.tar.gz \
  cli/dist-binaries/codebuff-mod-linux-arm64.tar.gz
# verify all 3 assets attached (names must match cli/release/index.js PLATFORM_TARGETS):
gh release view vX.Y.Z --repo EstarinAzx/codebuff-modded --json assets \
  --jq '.assets[] | "\(.name)  \(.size)"'
```

**6e. npm publish** (last — irreversible; can't unpublish a version). Dry-run first to confirm it ships only the launcher (~5 files, no binaries) at the right version:
```bash
cd cli/release
npm whoami                                           # must be an owner of codebuff-mod (tsd47216)
npm publish --dry-run                                # expect codebuff-mod@X.Y.Z, 5 files, ~9 kB
npm publish
npm view codebuff-mod version dist-tags --json       # latest → X.Y.Z
cd ../..
```

**6f. Post-ship:** update `.context/active-work.md` + `.context/overview.md` to the new version; run a live BYOK smoke on the published binary against a real provider (and ideally confirm a cross-compiled linux tarball actually runs on linux — it's built on Windows).

---

## Conflict map

Every file below has a known reason to conflict on upstream merges. Resolution rule is per file — do not freelance. **All paths here still exist in the lean tree** (the deleted-zone files have been removed from this map — see [Removed zones](#removed-zones)).

### Hook-registry pattern (since 1.0.3)

Many upstream files hold a **one-line dispatch** into a fork-side hook registry instead of multi-line BYOK logic:

```ts
const result = getForkHooks().<hookName>?.(...args)
if (result !== undefined) return result
// ... upstream code unchanged ...
```

Registry types: `sdk/src/impl/fork-hooks.ts`. Implementations (zero-conflict — upstream doesn't know they exist):

- `sdk/src/impl/fork-impls/byok-resolver.ts` — Path C resolution (raw-key + codex OAuth). **Imports `@codebuff/llm-providers/openai-compatible`** (re-pointed in the strategy-B sync). Registers hooks via a module-level IIFE (`registerForkHooks({ resolveByok })` + `registerBackendSkipHooks()`).
- `sdk/src/impl/fork-impls/backend-skip.ts` — `shouldSkipBackend` + synthetic user.
- `sdk/src/impl/fork-impls/runid-synth.ts` — `forkAwareStartAgentRun` BYOK runId synthesis.
- `cli/scripts/fork-impls/scan-mod-agents.ts` — `.agents/mod-*` bundle scan.
- `cli/src/fork-impls/preset-add-handlers.ts` — codex async `/providers:add` handler.
- `packages/agent-runtime/src/llm-api/fork-impls/byok-web-tools.ts` — BYOK direct dispatch for `web_search`/`read_docs` (`isBackendConfigured`, `byokWebSearch`, `byokReadDocs`, `gateByokWebTools`).
- `packages/agent-runtime/src/llm-api/fork-impls/search-providers.ts` — serper/brave/tavily search clients + fallback chain (`searchWithFallback`, `availableSearchProviders`, `CBM_SEARCH_PROVIDER` preference).

CLI-side boot registration (`setActiveByokProfile` + `setByokAgentBindings`) happens in `cli/src/init/init-app.ts`. If a hook registration is dropped (bun-compile tree-shaking has bitten this — see React-hooks note), behavior silently falls back to upstream verbatim.

**Merge implication:** when upstream touches a shimmed file, the conflict is usually limited to the one-line dispatch. If upstream restructures the function around it, re-anchor the call at the equivalent spot. Don't replay the multi-line BYOK logic — it lives in `fork-impls/`.

### NEW watch item — vendored `@codebuff/llm-providers`

The fork now depends on upstream's `packages/llm-providers` (the `openai-compatible` factory; `byok-resolver.ts` and `model-provider.ts` both import `{ OpenAICompatibleChatLanguageModel, VERSION }` from `@codebuff/llm-providers/openai-compatible`).

**Resolve:** if upstream renames/relocates this package again (it already moved once, from `@codebuff/internal/openai-compatible`), re-point both import sites. Grep after every sync:
```bash
git grep -n "openai-compatible" -- sdk/src/impl/model-provider.ts sdk/src/impl/fork-impls/byok-resolver.ts
# both must resolve to an existing package export
git grep -rn "from '@codebuff/internal" -- 'sdk/**/*.ts' 'cli/**/*.ts' 'common/**/*.ts'
# must be ZERO imports — that package is deleted upstream (a PORT comment may
# still mention the name; the `from '` prefix matches import lines only)
```

### HIGH conflict risk

#### `common/src/env-schema.ts` — BYOK env-gate

The fork loosens backend/Stripe/PostHog `NEXT_PUBLIC_*` vars to `.default(...)` / `.optional()` so a standalone `cbm` with no codebuff.com env passes validation. Upstream requires them (`.min(1)`). This conflicts whenever upstream touches the env schema (it did in the strategy-B sync, adding `NEXT_PUBLIC_FREEBUFF_APP_URL` + `NEXT_PUBLIC_GRAVITY_PIXEL_ID`).

**Resolve:** keep the fork's defaulted/optional forms; **union in** any new upstream vars (new optional vars merge verbatim; new required vars must be softened to `.default()`/`.optional()` or the standalone CLI throws at boot). See the `PORT:` comment block in the file. See [.context/decisions.md](./.context/decisions.md) "Propagate the BYOK env-gate to all backend-touching surfaces".

#### `common/src/constants/chatgpt-oauth.ts` — `OPENROUTER_TO_OPENAI_MODEL_MAP`

Single source of truth for codex-routable model ids. `Object.keys(map)` feeds BOTH `isChatGptOAuthModelAllowed` (the `/connect:chatgpt` allowlist) and `MODEL_CATALOG.codex` in `cli/src/utils/providers-models.ts` (the `/model` picker on codex profiles). Insertion order = picker display order.

**Resolve:** keep all fork-added ids; merge upstream additions at their position. Do NOT split the map — the single-source invariant is load-bearing. Do NOT adopt any upstream live-probe for codex (the fork ripped that out at 1.0.0; the endpoint doesn't exist for OAuth-bearer tokens).
```bash
grep -c "^\s*'[^']*':" common/src/constants/chatgpt-oauth.ts   # expect >= 22
```

#### `cli/src/utils/providers-models.ts`

`MODEL_CATALOG.codex` derives from `Object.keys(OPENROUTER_TO_OPENAI_MODEL_MAP)` (not a hand list). `opencode-go` is in the **empty-catalog set** (`'opencode-go': []`) so it live-probes. `fetchCodexModelsFromEndpoint` was deleted at 1.0.0 — keep it deleted.

**Resolve:** keep codex flowing through the same orchestrator every preset uses; keep `opencode-go` empty (probes `https://opencode.ai/zen/go/v1/models`).
```bash
grep -n "fetchCodexModelsFromEndpoint" cli/src/utils/providers-models.ts   # ZERO hits
```

#### Web-tools direct dispatch surface (since the web_search/read_docs rewire)

Six upstream files carry small fork edits so `web_search`/`read_docs` work without the deleted backend (BYOK dispatch lives in `fork-impls/` — zero-conflict — but these call sites are merge surface):

- `packages/agent-runtime/src/llm-api/codebuff-web-api.ts` — `callWebSearchAPI` + `callDocsSearchAPI` each open with an `if (!isBackendConfigured(...)) return byok...(...)` block. **Resolve:** keep both blocks at function top; upstream body below unchanged.
- `packages/agent-runtime/src/llm-api/context7-api.ts` — `context7AuthHeaders()` helper; Authorization sent only when `CONTEXT7_API_KEY` exists (upstream sends `Bearer undefined` keyless). **Resolve:** keep conditional headers at both fetch sites.
- `packages/agent-runtime/src/templates/agent-registry.ts` — `assembleLocalAgentTemplates` takes optional `ciEnv` and pipes templates through `gateByokWebTools`. **Resolve:** keep param + gate call.
- `packages/agent-runtime/src/main-prompt.ts` — passes `ciEnv: params.ciEnv` into `assembleLocalAgentTemplates`. One line.
- `common/src/types/contracts/env.ts` + `common/src/env-ci.ts` — `SERPER_API_KEY`, `BRAVE_API_KEY`, `TAVILY_API_KEY`, `CBM_SEARCH_PROVIDER` on `CiEnv`/`getCiEnv`. **Resolve:** union with upstream additions.
- `common/src/testing/fixtures/agent-runtime.ts` — `testCiEnv.SERPER_API_KEY` keeps `web_search` advertised under the gate; removing it breaks the web-search/read-docs tool tests non-obviously.

Also fork-rewired tests: `packages/agent-runtime/src/__tests__/{web-search-tool,read-docs-tool}.test.ts` import `testResearcherAgent` from `./test-utils` (upstream imported the deleted `agents-graveyard/researcher`). If upstream resurrects those test files, keep the fixture import.
```bash
grep -n "isBackendConfigured" packages/agent-runtime/src/llm-api/codebuff-web-api.ts   # expect 2 dispatch blocks
```

#### `cli/src/commands/providers.ts` — codex add path + unified `/model`

`/providers:add codex [name]` is an **async** handler (OAuth PKCE before profile add); other presets are sync. `handleModelCommand` routes all presets through one `getModelsForPreset`.

**Resolve:** keep the codex async branch and the unified `/model`. Codex preset row needs `requiresApiKey: false`; add handler persists a stub row with empty `apiKey` + `oauthProfileId = profile.id`.

#### `cli/src/commands/command-registry.ts` — `/logout` + codex preset dispatch

Two fork edits: (1) `/logout` BYOK short-circuit (in-place — points to `/providers:remove`, never mutates auth in default mode); (2) `/providers:add` registry handler calls `tryForkPresetAdd(preset, args)` before the sync preset path (shim #8).

**Resolve:** keep both. If upstream changes the logout flow or registry signature, re-anchor both.

#### `cli/src/hooks/use-connection-status.ts`, `use-gravity-ad.ts`, `use-agent-validation.ts`

⚠️ Un-shimmed `BYOK_AT_BOOT` hooks (shim #5–7 reverted — bun-compile tree-shook the registration). Each computes a module-level `BYOK_AT_BOOT` flag and early-returns a SAFE_DEFAULT.

**Resolve:** apply upstream's new hook body, then re-wrap with the `BYOK_AT_BOOT` guard at module level (not per-render — Rules of Hooks). The flag is env-first / profile-fallback:
```ts
const BYOK_AT_BOOT: boolean = (() => {
  if (process.env.CODEBUFF_USE_BACKEND !== '1') return true
  try { return getActiveProfile() !== null } catch { return false }
})()
```
⚠️ If upstream widens the hook's return type, the SAFE_DEFAULT must gain the new field (the strategy-B sync added `recordClick: () => {}` to `use-gravity-ad.ts`'s `BYOK_AD_STATE` after upstream's ad-banner refactor extended `GravityAdState`). After merging, **typecheck cli** — a missing field surfaces as `TS2741`.

#### `cli/src/hooks/use-auth-query.ts`

BYOK escape hatch inline at the top of `validateApiKey()` — returns a synthetic user (`{ id: 'byok-local', email: 'local@byok' }`) whenever `CODEBUFF_USE_BACKEND !== '1'` OR `getActiveProfile() !== null`, before any backend request.

**Resolve:** keep the short-circuit at the very top; if upstream changes the signature/return type, the synthetic must match the new shape.

#### `cli/src/hooks/use-usage-query.ts`

Per-call `getActiveProfile()` check + `SENTINEL_BACKEND_URL` guard return `BYOK_USAGE_RESPONSE` inside `fetchUsageData`.

**Resolve:** preserve both early-returns at the top of `fetchUsageData`.

#### `cli/src/app.tsx` — LoginModal render gate

A `CODEBUFF_USE_BACKEND !== '1'` env-check guards the entire `<LoginModal />` return so `/logout` can't resurface the dead modal in BYOK mode.

**Resolve:** keep the env-check around whatever the new upstream render condition becomes.

### MEDIUM conflict risk

#### `sdk/src/impl/model-provider.ts`

**Shimmed.** Path C dispatch is `getForkHooks().resolveByok?.(params)` before upstream Path A/B. Residual in-place: the hook call, module-state exports (`setActiveByokProfile`, `getActiveByokProfile`, `setByokAgentBindings`, `getByokAgentBindings`, `BYOKProfile` with `oauthProfileId?: string`), and the **exported** `createOpenAIOAuthModel` (byok-resolver imports it). Import is from `@codebuff/llm-providers/openai-compatible`.

**Resolve:** re-anchor `resolveByok` at the top of the resolver (Path C before A/B). Keep `export` on `createOpenAIOAuthModel`. Preserve the module-state exports. Leave the actual Path-C branching in `byok-resolver.ts`.

#### `sdk/src/impl/llm.ts`

Fork threads `agentId` through into `ModelRequestParams` (per-agent routing). `OpenRouterProviderOptions` imports from `@codebuff/common/types/agent-template` (relocated in the strategy-B sync; was `@codebuff/internal/openrouter-ai-sdk`).

**Resolve:** keep `agentId` flowing (grep `agentId` → expect 5+ hits). Keep the `@codebuff/common` import path.

#### `sdk/src/impl/database.ts`

**Shimmed.** Backend-skip via `getForkHooks().skipBackend?.()` + `synthUserInfo?.()` at each backend entry.

**Resolve:** re-anchor the hook calls at backend-touching entries. Do NOT remove Path B — external SDK consumers may still set `CODEBUFF_USE_BACKEND=1` against a remote codebuff.com.

#### `cli/src/utils/providers.ts` — profile schema v3 + codex preset

Schema carries `oauthProfileId?: string` on every `BYOKProfile`. The `codex` preset has `requiresApiKey: false`. `sanitizeProfile`/`addProfile` preserve/default `oauthProfileId` (defaults to `profile.id` for codex).

**Resolve:** keep the codex row (`requiresApiKey: false`), `oauthProfileId?: string` on persisted + SDK-export shapes (`buildSdkBindings` propagates it), and the `requiresApiKey` gate so empty-`apiKey` codex rows are accepted.

#### `cli/src/types/theme-system.ts` + `cli/src/utils/theme-system.ts` + `cli/src/components/message-block.tsx`

`aiPanelBorder?: string` (optional, amber) on `ChatTheme`. Fallback in `message-block.tsx`: `theme.aiPanelBorder ?? theme.secondary ?? theme.aiLine ?? theme.foreground`.

**Resolve:** keep the optional field + defaults + fallback chain. Optional means no upstream test-fixture patching needed.

#### `cli/src/init/init-app.ts`

Fork pushes the active BYOK profile + bindings at boot (`setActiveByokProfile(...)` + `setByokAgentBindings(buildSdkBindings())`) after upstream's auth/config load, before the first agent spawn.

**Resolve:** keep these calls early in init, after config load, before the SDK takes any request.

### LOW conflict risk

#### `cli/src/login/constants.ts` + `cli/src/hooks/use-logo.tsx` — banner art

ASCII mark "CODEBUFF - M1" (full) / "CBM" (small). Full-logo width threshold raised to `92`.

**Resolve:** keep the fork mark + `92` threshold; bump the trailing letter only at fork milestones.

#### `common/src/constants/model-config.ts`

Fork deliberately does NOT add `'opencode-go'` to `ALLOWED_MODEL_PREFIXES`.

**Resolve:** only add it if an agent template references `opencode-go/*` as its model id.

#### `common/src/env-schema.ts` — `OPENCODE_API_KEY`

Single shared key for Zen + Go endpoints (no separate `OPENCODE_GO_API_KEY`).

**Resolve:** don't split unless opencode.ai issues separate keys. (Note: `packages/internal/src/env-schema.ts` no longer exists — only the `common/` schema remains.)

#### `packages/agent-runtime/src/run-agent-step.ts`

**Byte-identical to upstream.** UUID synthesis lives in the SDK wrap `sdk/src/impl/fork-impls/runid-synth.ts` (`byok-<agentTemplate.id>-<uuid>`).

**Resolve:** zero in-place edit = zero conflict. If upstream renames `startAgentRun`, update the SDK-side wrap. Do NOT revert to `?? ''`.

#### `cli/scripts/prebuild-agents.ts`

One-line shim calling `scanModAgents(DOT_AGENTS_DIR)` (in `cli/scripts/fork-impls/scan-mod-agents.ts`), which globs `.agents/mod-*.ts` into the bundled manifest.

**Resolve:** keep the call after upstream's scan. The `mod-*` glob lives in the fork-impl.

#### `cli/src/commands/command-registry.ts` + `cli/src/data/slash-commands.ts`

Fork registers `/providers`, `/providers:add|remove|list|select|bind|unbind|bindings`, `/model`.

**Resolve:** preserve every registration; port into any new registry API shape.

#### `cli/package.json`

Fork sets `"name": "codebuff-mod"` and bumps `version` each release.

**Resolve:** keep fork name + version; take everything else from upstream.

#### `cli/release/index.js`, `cli/release/package.json`, `cli/release/postinstall.js`, `cli/release/README.md`

Fork-local launcher. These conflicted in the strategy-B sync (upstream's own `cli/release/*` launcher differs) — keep fork's version on any conflict.

---

## Removed zones — gone in strategy B, do NOT look for them

If a merge tries to re-create any of these (e.g. upstream un-thins, or rename-detection phantoms), **stop and decide deliberately** — the fork chose to drop them.

- **`web/` — entire tree.** Including the old conflict-map files `web/src/app/api/v1/chat/completions/_post.ts`, `web/src/fork-impls/provider-dispatch.ts`, `web/src/llm-api/opencode-go.ts`. The `opencode-go` lane is BYOK-Path-C-only now.
- **`packages/internal`, `packages/billing`, `packages/bigquery`, `packages/build-tools`** — and all 107 DB migrations under `packages/internal`.
- **`scripts/` (except `scripts/tmux`)** — including `scripts/check-env-architecture.ts`. The env-architecture allowlist concern is moot; no check runs.
- **`agents-graveyard/`, upstream `.agents/` dev agents, `.github/`, `python-app/`.** (Fork-only `.agents/mod-*.ts` survive — they're additions, not in upstream's deletion set.)
- **The `@codebuff/internal` import path** — deleted upstream; use `@codebuff/llm-providers` + `@codebuff/common`.

---

## ZERO conflict (pure fork-only additions)

Upstream doesn't know these exist. A conflict here is a rename-detection phantom — investigate.

- `.agents/mod-default.ts`, `mod-lite.ts`, `mod-max.ts`, `mod-plan.ts`
- `cli/src/commands/providers.ts`; `cli/src/utils/providers.ts`, `providers-models.ts`; `cli/src/utils/__tests__/providers*.test.ts`
- `cli/src/fork-impls/preset-add-handlers.ts`; `cli/scripts/fork-impls/scan-mod-agents.ts`
- `sdk/src/codex-credentials.ts`; `sdk/src/impl/fork-hooks.ts`; `sdk/src/impl/fork-impls/{byok-resolver,backend-skip,runid-synth}.ts`
- `sdk/src/impl/__tests__/database-byok-skip.test.ts`, `model-provider-byok.test.ts`
- `.context/**`, `MERGE-STRATEGY.md`, `.claude/*-implementation-plan.md`

Runtime-only (written at boot, never `git add`): `~/.config/manicode/{providers.json,codex-oauth.json,credentials.json,models-cache.json}`.

---

## PORT marker convention

Fork-local edits adjacent to upstream code are tagged with `PORT:` comments (e.g. "PORT: BYOK env-gate — keep defaulted, not upstream's `.min(1)`"). After a merge, re-anchor any marker whose context moved:

```bash
git grep "PORT:" -- ':!.context/' ':!.claude/' ':!MERGE-STRATEGY.md'
```

---

## Sanity checks after every merge

Run before pushing `modded`. None should fail.

| Check | Command | Expected |
|---|---|---|
| No dead `@codebuff/internal` | `git grep -n "from '@codebuff/internal" -- 'sdk/**/*.ts' 'cli/**/*.ts' 'common/**/*.ts'` | ZERO import hits |
| llm-providers import resolves | `git grep -n "@codebuff/llm-providers/openai-compatible" -- sdk/` | present in model-provider.ts + byok-resolver.ts |
| Typecheck (per pkg) | `(cd common && bun run typecheck) && (cd sdk && bun run typecheck) && (cd cli && bun run typecheck)` | 0 errors |
| BYOK skip gate | `grep -n "skipBackend\|synthUserInfo" sdk/src/impl/database.ts` | hook calls at backend entries |
| Path C resolution | `grep -n "resolveByok" sdk/src/impl/model-provider.ts sdk/src/impl/fork-impls/byok-resolver.ts` | shim call + impl |
| RunId synthesis | `grep -n "byok-" sdk/src/impl/fork-impls/runid-synth.ts` | UUID synth in fork-impl, not agent-runtime |
| Fork hooks registered | `grep -n "registerForkHooks" sdk/src/impl/fork-impls/byok-resolver.ts && grep -n "setActiveByokProfile" cli/src/init/init-app.ts` | IIFE + boot push present |
| BYOK_AT_BOOT gates | `git grep -l "BYOK_AT_BOOT" cli/src/hooks/` | 3 hooks (use-connection-status, use-gravity-ad, use-agent-validation) |
| BYOK env-gate everywhere | `git grep "CODEBUFF_USE_BACKEND" cli/src/ sdk/src/` | index.tsx, app.tsx, use-auth-query.ts, the 3 BYOK_AT_BOOT hooks, command-registry.ts (/logout), database.ts |
| `/providers` commands | `grep -n "providers:" cli/src/commands/command-registry.ts` | all registered |
| mod-* prebuild | `grep -n "scanModAgents\|mod-" cli/scripts/prebuild-agents.ts` | scan call present |
| Codex OAuth catalog | `grep -c "^\s*'[^']*':" common/src/constants/chatgpt-oauth.ts` | >= 22 |
| Codex picker derives from map | `grep -n "MODEL_CATALOG\[.codex.\]\|codex:.*OPENROUTER" cli/src/utils/providers-models.ts` | derived, no hand-list |
| Dead codex probe gone | `git grep -n "fetchCodexModelsFromEndpoint" cli/src/` | ZERO |
| opencode-go BYOK lane | `grep -n "'opencode-go': \[\]" cli/src/utils/providers-models.ts` | empty catalog (live-probe) |
| Codex creds module | `ls sdk/src/codex-credentials.ts` | exists |
| `oauthProfileId` plumbed | `git grep "oauthProfileId" cli/src/ sdk/src/` | providers.ts, providers handler, model-provider.ts, buildSdkBindings |
| `aiPanelBorder` theme key | `git grep "aiPanelBorder" cli/src/` | types + defaults + message-block fallback |
| Build | `cd cli && bun run build:binary` | `✅ Built codebuff-mod.exe` |
| Boot smoke | `./cli/bin/codebuff-mod.exe --version` | prints version, exit 0 |
| Smoke (raw-key) | `cbm` → `/providers:add openrouter <key>` → small prompt | binds + responds |
| Smoke (codex OAuth) | `cbm` → `/providers:add codex` → browser flow → `/model` → small prompt | OAuth completes, >=22 picker, dispatch succeeds |

(Removed vs the pre-B version: the env-architecture allowlist check and the `web/_post.ts` `dispatchOverrides` check — both targets are deleted.)

---

## When NOT to merge

Defer if any hold:

- A `codebuff-mod` release is hot (last 48 hours) — let users settle first.
- Upstream introduced a major architectural change — read the diff first and decide merge vs fork-harder. (The snapshot-only pivot was exactly this; it's now absorbed.)
- Working tree has uncommitted BYOK work — finish and ship first. (Also commit `.context/` doc edits before the `main` fast-forward, or it blocks.)
- It's been **< 2 weeks** since the last sync AND nothing in the conflict map changed upstream — no payoff.

---

## When you reach a merge you can't resolve

Abort and ask. Better to defer than ship a corrupted merge:

```bash
git merge --abort
```

Then write what blocked you into [.context/active-work.md](./.context/active-work.md).

Tip: the strategy-B sync was first validated with a throwaway dry-run (`git switch -c scratch modded && git merge --no-commit --no-ff origin/main` → inspect → `git merge --abort`). Do that on any sync you're unsure about — it surfaces the exact conflict + deletion set with zero risk to `modded`.

---

## Related

- [.context/overview.md](./.context/overview.md) — fork-vs-upstream map
- [.context/decisions.md](./.context/decisions.md) — rationale per fork-local choice (incl. strategy B)
- [.context/active-work.md](./.context/active-work.md) — current sync state
- [.context/gotchas.md](./.context/gotchas.md) — non-obvious behaviors
