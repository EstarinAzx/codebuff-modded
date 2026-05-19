# Merge Strategy — upstream → main → modded

How to safely pull upstream Codebuff changes into this fork without breaking the BYOK rip on `modded`.

> Read this BEFORE running `git merge` or `git pull` against upstream. The fork has hot conflict zones and a documented resolution map below.
>
> Coverage: fork through **1.0.3** (shim-refactor ship, modded tip `e2e3efa18`, ship date 2026-05-19). Empirical conflict surface vs `upstream/main` at ship: 1177 lines added across 41 modified files (down from 1393/40 pre-shim — ~15% LOC reduction).
>
> **Big architectural shift in 1.0.3:** most fork-local edits to upstream files were extracted into a hook registry (`sdk/src/impl/fork-hooks.ts`) with implementations under `*/fork-impls/` directories. Upstream files now hold one-line dispatches into the registry instead of multi-line in-place logic. The conflict-map below reflects the shimmed shape. Pre-shim shape lives on branch `modded-pre-shim` + tag `v1.0.2-pre-shim` as rollback.
>
> Exception: React hooks #5–7 (`use-connection-status`, `use-gravity-ad`, `use-agent-validation`) were shimmed but reverted because bun-compile tree-shook the hook registration. They still hold the pre-shim `BYOK_AT_BOOT` in-place logic. See conflict map below.
>
> If the fork bumps past 1.0.x without this file being touched, suspect drift — re-grep before trusting.

---

## Branch topology

```
CodebuffAI/codebuff  (upstream, public)
        │
        │  git fetch upstream
        ▼
   main  ──────────► origin/main          ← clean mirror of upstream
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

- **`main`** is a passive mirror of upstream `CodebuffAI/codebuff:main`. Never commit fork-local work here. Its only job is to stage the latest upstream tip before merging into `modded`.
- **`modded`** is where every fork-local commit lives. This is the branch published to npm as `codebuff-mod` and tagged for GitHub Releases. Tip at last update: `e2e3efa18` (v1.0.3, shim-refactored).
- **`modded-pre-shim`** preserves the pre-shim shape (`6048b92ba`, v1.0.2). Rollback target if shim refactor proves regressing. Tag `v1.0.2-pre-shim` anchors the same commit independently of the branch.
- One-way flow: `upstream/main` → `origin/main` → `modded`. Never push `modded` commits back into `main`.

---

## One-time setup — add the upstream remote

As of 1.0.3 the `upstream` remote is configured. Verify:

```bash
git remote -v
# expected:
# origin    https://github.com/EstarinAzx/codebuff-modded.git (fetch/push)
# upstream  https://github.com/CodebuffAI/codebuff.git (fetch/push)
```

If `upstream` is missing on a fresh checkout, add it:

```bash
git remote add upstream https://github.com/CodebuffAI/codebuff.git
git fetch upstream
```

Lock down upstream push so accidental `git push upstream` fails fast:

```bash
git remote set-url --push upstream DISABLED
```

---

## Sync recipe

Run this whenever you want to pull in fresh upstream changes. Rebase **often** (monthly at most) — large gaps make `_post.ts` and SDK conflicts compound.

### Step 1 — confirm `modded` is clean

```bash
git switch modded
git status                  # must be clean working tree
git pull --ff-only origin modded
```

If working tree is dirty, commit or stash first. Never start a merge with uncommitted local changes.

### Step 2 — fast-forward `main` to upstream

```bash
git switch main
git fetch upstream
git merge --ff-only upstream/main
git push origin main
```

If `--ff-only` fails, `main` has diverged from upstream — that means someone committed fork-local work to `main` by mistake. **Stop.** Investigate before continuing. `main` should always fast-forward.

### Step 3 — record the divergence before merging

```bash
git switch modded
git log --oneline main..modded | wc -l            # commits ahead
git log --oneline modded..main | wc -l            # commits behind
git diff --stat main...modded | tail -1            # rough conflict surface
```

Write the numbers somewhere. If `behind > 50` commits, expect heavy `_post.ts` rework.

### Step 4 — merge `main` into `modded`

```bash
git merge main --no-ff -m "merge upstream main into modded (sync up to <upstream-sha>)"
```

Use `--no-ff` so the merge commit is always explicit in the history. Easier to revert as a single unit if the merge poisons something.

When git stops on conflicts, **do not blindly accept either side**. Open every conflicting file and apply the resolution rules in the [Conflict map](#conflict-map) section below.

### Step 5 — verify before pushing

```bash
bun install
bun run typecheck
bun run test
cd cli && bun run build:binary          # native Win build sanity
```

Run a smoke test against a BYOK profile:

```bash
# in another shell
cbm
# inside cbm:
/providers:list                 # all profiles still present?
/providers:bindings             # bindings still load?
# run a tiny prompt against your active profile
```

### Step 6 — push and tag

```bash
git push origin modded
# bump cli/package.json + cli/release/package.json version, commit, then:
git tag vX.Y.Z && git push origin vX.Y.Z
gh release create vX.Y.Z --repo EstarinAzx/codebuff-modded dist-binaries/*.tar.gz
cd cli/release && npm publish
```

---

## Conflict map

Every file below has a known reason to conflict on upstream merges. Resolution rule is per file — do not freelance.

### Hook-registry pattern (1.0.3 shift)

Many upstream files now hold a **one-line dispatch** into a fork-side hook registry instead of multi-line BYOK logic. Pattern:

```ts
// upstream file (the shim — one line in an in-place edit)
const result = getForkHooks().<hookName>?.(...args)
if (result !== undefined) return result
// ... upstream code unchanged ...
```

Registry types live at `sdk/src/impl/fork-hooks.ts`. Implementations live in `fork-impls/` dirs (zero-conflict by design — upstream doesn't know they exist):

- `sdk/src/impl/fork-impls/byok-resolver.ts` — Path C resolution (raw-key + codex OAuth)
- `sdk/src/impl/fork-impls/backend-skip.ts` — `shouldSkipBackend` + synthetic user
- `sdk/src/impl/fork-impls/runid-synth.ts` — `forkAwareStartAgentRun` wrap (BYOK runId synthesis)
- `cli/scripts/fork-impls/scan-mod-agents.ts` — `.agents/mod-*` bundle scan
- `cli/src/fork-impls/preset-add-handlers.ts` — codex async `/providers:add` handler
- `web/src/fork-impls/provider-dispatch.ts` — opencode-go provider override

Hook registration happens at boot in `cli/src/init/init-app.ts` (CLI side) and via SDK-side IIFEs in `byok-resolver.ts` (SDK side). If a hook registration is dropped (bun-compile tree-shaking has bitten this — see React-hooks note below), behavior silently falls back to upstream verbatim.

**Merge implication:** when upstream touches a shimmed file, the conflict is usually limited to the one-line dispatch. If upstream restructures the function around the dispatch, re-anchor the one-line call at the equivalent spot. Don't replay the multi-line BYOK logic — that lives in `fork-impls/` now.

### HIGH conflict risk

#### `common/src/constants/chatgpt-oauth.ts` — `OPENROUTER_TO_OPENAI_MODEL_MAP`

Since 1.0.0/1.0.1, this map literal is the **single source of truth** for codex-routable model ids. `Object.keys(map)` feeds BOTH:
- `isChatGptOAuthModelAllowed` — the non-BYOK global ChatGPT OAuth allowlist (used by `/connect:chatgpt`).
- `MODEL_CATALOG.codex` in `cli/src/utils/providers-models.ts` — the picker shown by `/model` on codex BYOK profiles.

Fork holds 22 entries as of 1.0.1: GPT-5.5 at the top, GPT-5/5.4/5.3/5.2 family, codex-spark/codex-max/codex-mini variants, o3/o4-mini, gpt-4.1 family, `codexspark`/`codexplan` aliases at the tail. Insertion order = picker display order.

**Resolve:** keep all fork-added ids; merge in any upstream additions at the position upstream put them (newer-first sort if ambiguous). Do NOT split the map into two — the single-source invariant is load-bearing for the picker. If upstream renames the constant or restructures the file, port the merged map under the new shape and re-verify both consumers grep clean:

```bash
grep -rn "OPENROUTER_TO_OPENAI_MODEL_MAP\|isChatGptOAuthModelAllowed" \
  --include="*.ts" common/ cli/ sdk/ web/
```

Sanity check after resolve:
```bash
grep -c "^\s*'[^']*':" common/src/constants/chatgpt-oauth.ts
# expect >= 22 lines inside the map literal (fork ships >= 22; upstream may add more)
```

If upstream introduces a separate codex picker catalog or live-probe path, **do not adopt it** — the fork tried a live probe in 0.2.1 and ripped it out in 1.0.0 (the `chatgpt.com/backend-api/models` endpoint does not exist for OAuth-bearer tokens; Codex CLI itself ships a fixed catalog for the same reason — see [.context/decisions.md](./.context/decisions.md) "OPENROUTER_TO_OPENAI_MODEL_MAP is the single source of truth").

#### `cli/src/utils/providers-models.ts`

Two fork-specific shapes survive here:
1. `MODEL_CATALOG.codex` is derived from `Object.keys(OPENROUTER_TO_OPENAI_MODEL_MAP)` — not a hand-maintained list.
2. `fetchCodexModelsFromEndpoint` was **deleted** in 1.0.0. Do not let upstream's diff reintroduce it.

**Resolve:** if upstream restructures `MODEL_CATALOG` or `getModelsForPreset`, keep codex flowing through the same orchestrator every other preset uses (no codex-specific branch). Re-import `OPENROUTER_TO_OPENAI_MODEL_MAP` if upstream changes the catalog file layout.

Sanity check:
```bash
grep -n "fetchCodexModelsFromEndpoint" cli/src/utils/providers-models.ts cli/src/commands/providers.ts
# must return ZERO hits — the function was deleted at 1.0.0 (9c027af8e)
grep -n "MODEL_CATALOG\[.codex.\]\|codex:.*OPENROUTER_TO_OPENAI" cli/src/utils/providers-models.ts
# codex catalog must still derive from the map keys
```

#### `cli/src/commands/providers.ts` — codex add path + unified `/model`

Two fork-specific surfaces in this file:
1. `/providers:add codex [name]` is an **async** handler (`handleProvidersAddCodex`) that drives the OAuth PKCE flow before adding the profile. Other presets are sync.
2. `handleModelCommand` routes all presets — including codex — through one `getModelsForPreset` call. Pre-1.0.0 had a codex-specific ternary; it is gone.

**Resolve:** if upstream changes the command registry signature or splits add handlers, keep the codex async branch wired and keep the unified `/model` flow. The codex preset row needs `requiresApiKey: false` and the add handler must persist a stub row with empty `apiKey` + `oauthProfileId = profile.id`.

Sanity check:
```bash
grep -n "handleProvidersAddCodex\|presetRaw === 'codex'" cli/src/commands/providers.ts
# both must be present — codex routing depends on this entry point
grep -n "getModelsForPreset" cli/src/commands/providers.ts
# exactly one call site; no codex ternary
```

#### `web/src/app/api/v1/chat/completions/_post.ts`

**Shimmed in 1.0.3.** Dispatch ladder now consults `getForkHooks().dispatchOverrides?.[model]` BEFORE the two-parallel-ladder chained ternary. opencode-go logic lives in `web/src/fork-impls/provider-dispatch.ts`.

Residual in-place edits (~80+/54- lines): the override-check hook call + the `useOpencodeGo` declaration still live in `_post.ts` because some flow control around the dispatch table couldn't be cleanly extracted.

**Resolve:** if upstream adds a new provider, slot it into the upstream ternary as usual; the fork's override hook is unaffected. If upstream restructures the dispatch ladder itself, re-anchor the `getForkHooks().dispatchOverrides` check at the top of BOTH the streaming and non-streaming paths so opencode-go gets first crack. See [.context/gotchas.md](./.context/gotchas.md) "LLM provider dispatch is a chained ternary."

Sanity check after resolve:
```bash
grep -n "dispatchOverrides\|useOpencodeGo" web/src/app/api/v1/chat/completions/_post.ts
# dispatchOverrides should appear in both stream + non-stream paths
```

#### `cli/src/hooks/use-connection-status.ts`
#### `cli/src/hooks/use-gravity-ad.ts`
#### `cli/src/hooks/use-agent-validation.ts`

⚠️ **Shim #5–7 was reverted in 1.0.3.** These hooks still hold the pre-shim multi-line `BYOK_AT_BOOT` in-place logic. Reason: bun-compile tree-shaking dropped the fork-hook registration in the compiled binary even after `sideEffects` allowlist + `pre-init/` placement. The ForkHooks registry exposes a `shouldSkipReactHook` slot that is currently unused (kept harmless for future revival).

Each hook computes a module-level `BYOK_AT_BOOT` flag and early-returns when set. If upstream rewrites the hook body, the early-return wrapper may end up in the wrong place after auto-merge.

**Resolve:** apply upstream's new hook logic, then re-wrap the entire body with the `BYOK_AT_BOOT` guard at the top. The guard MUST be module-level (not per-render) — see [.context/decisions.md](./.context/decisions.md) "Module-level `BYOK_AT_BOOT` flag in React hooks" for why.

Since 0.1.10 the flag is env-first / profile-fallback (see [.context/decisions.md](./.context/decisions.md) "Propagate the BYOK env-gate to all backend-touching surfaces"). If upstream rewrites the gate body, preserve both branches — the env short-circuit covers fresh-install (no profile yet); the profile check only kicks in under `CODEBUFF_USE_BACKEND=1`:
```ts
const BYOK_AT_BOOT: boolean = (() => {
  if (process.env.CODEBUFF_USE_BACKEND !== '1') return true
  try { return getActiveProfile() !== null } catch { return false }
})()

export function useXyz() {
  if (BYOK_AT_BOOT) return SAFE_DEFAULT;
  // ... upstream hook body ...
}
```

#### `cli/src/hooks/use-auth-query.ts`

Not a `BYOK_AT_BOOT` hook. The fork's BYOK escape hatch is inline at the top of `validateApiKey()` — it returns a synthetic user (`{ id: 'byok-local', email: 'local@byok' }`) whenever `CODEBUFF_USE_BACKEND !== '1'` OR `getActiveProfile() !== null`, before any backend request is attempted.

**Resolve:** keep the synthetic-user short-circuit at the very top of `validateApiKey`, ahead of any upstream-restructured retry / error / fetch logic. If upstream changes the function signature or return type, the synthetic must still match the new shape.

#### `cli/src/hooks/use-usage-query.ts`

Not a `BYOK_AT_BOOT` hook either. Uses a per-call `getActiveProfile()` check plus a `SENTINEL_BACKEND_URL` guard to return `BYOK_USAGE_RESPONSE` (zero-usage placeholder). Both guards are inside `fetchUsageData`.

**Resolve:** preserve both early-returns at the top of `fetchUsageData`. The sentinel check is what saves a fresh install with no profile from hitting the unset URL — equivalent in spirit to the env-first gate the three `BYOK_AT_BOOT` hooks adopted in 0.1.10.

#### `cli/src/app.tsx` — LoginModal render gate

Since 0.1.10 the gate adds a `CODEBUFF_USE_BACKEND !== '1'` env-check so post-boot mutations to `isAuthenticated` (notably from `/logout`) cannot resurface the dead modal in BYOK mode. Without this gate, the pre-0.1.7 lockout returns via the `/logout` door.

**Resolve:** keep the env-check guarding the entire `<LoginModal />` return. If upstream changes the render-gate conditions, re-add the env-check around whatever the new condition becomes:
```tsx
const byokModeNoBackend = process.env.CODEBUFF_USE_BACKEND !== '1'
if (!byokModeNoBackend && /* upstream's conditions */) {
  return <LoginModal ... />
}
```

#### `cli/src/commands/command-registry.ts` — `/logout` handler + codex preset dispatcher

Two fork edits in this file:

1. **`/logout` BYOK short-circuit** (since 0.1.10) — NOT shimmed. Still in-place: handler short-circuits in BYOK default mode with a pointer to `/providers:remove` / `/providers:list`, never calls `logoutMutation` or `setIsAuthenticated(false)`. Under `CODEBUFF_USE_BACKEND=1` upstream behavior preserved verbatim.
2. **Codex preset dispatch** (shimmed in 1.0.3 — shim #8) — `/providers:add` registry handler now calls `tryForkPresetAdd(preset, args)` before falling through to the sync preset path. Codex async OAuth flow logic lives in `cli/src/fork-impls/preset-add-handlers.ts`.

Despite shim #8, this file still carries ~176+ added lines because the `/logout` branch + `/providers:*` command registrations couldn't be cleanly extracted.

**Resolve:** keep both the `/logout` early-return AND the `tryForkPresetAdd` call. If upstream changes the logout flow or the registry signature, re-anchor both. The codex async flow itself (`handleProvidersAddCodex`) doesn't live here anymore.

### MEDIUM conflict risk

#### `sdk/src/impl/model-provider.ts`

**Shimmed in 1.0.3.** Path C logic moved to `sdk/src/impl/fork-impls/byok-resolver.ts`. The upstream file now holds a one-line dispatch:

```ts
const forkModel = getForkHooks().resolveByok?.(params)
if (forkModel) return forkModel
// ... upstream Path A / Path B logic ...
```

Residual in-place edits (~52+/6- lines): the hook call + module-level state exports (`setActiveByokProfile`, `setByokAgentBindings`, `BYOKProfile` type with `oauthProfileId?: string`) still live here because the CLI imports them.

**Resolve:** if upstream restructures path dispatch, re-anchor the `getForkHooks().resolveByok?.(params)` call at the top of the resolver function. Path C must still run before Path A/B. The actual Path C-oauth / Path C-direct branching logic is no longer in this file — leave `byok-resolver.ts` alone unless its types break.

Preserve exports: `setActiveByokProfile`, `getActiveByokProfile`, `setByokAgentBindings`, `getByokAgentBindings`, `BYOKProfile` (now carries optional `oauthProfileId?: string`).

#### `cli/src/utils/providers.ts` — profile schema v3 + codex preset

Schema now carries `oauthProfileId?: string` on every `BYOKProfile` row. The `codex` preset entry in the registry has `requiresApiKey: false` (every other preset is `true`). `sanitizeProfile` and `addProfile` both preserve / default the `oauthProfileId` field — for codex it defaults to `profile.id` at add-time.

**Resolve:** if upstream restructures the profile store or registry, keep:
- The `codex` preset row with `requiresApiKey: false`.
- `oauthProfileId?: string` on the persisted shape AND the SDK-export shape (`buildSdkBindings` must propagate it).
- The `requiresApiKey` gate in `addProfile` so codex rows with empty `apiKey` are still accepted.

Sanity check:
```bash
grep -n "oauthProfileId" cli/src/utils/providers.ts sdk/src/impl/model-provider.ts cli/src/commands/providers.ts
# field must appear on the schema, in buildSdkBindings, in /providers handlers,
# and in the SDK BYOKProfile type
```

#### `cli/src/types/theme-system.ts` + `cli/src/utils/theme-system.ts` + `cli/src/components/message-block.tsx`

0.2.0 added `aiPanelBorder` on `ChatTheme` (amber `#fbbf24` dark / `#d97706` light) used by the bordered AI-prose panel. **Made optional in 1.0.3** (shim #12 — `aiPanelBorder?: string`) so upstream test fixtures that build full `ChatTheme` literals don't need patching. Fallback chain in `message-block.tsx`: `theme.aiPanelBorder ?? theme.secondary ?? theme.aiLine ?? theme.foreground`.

**Resolve:** if upstream rewrites `ChatTheme` or the message-block component, preserve `aiPanelBorder?: string` (optional) on the interface + defaults and keep the fallback chain. Optional field means no test-fixture patching required — leave any new upstream fixtures untouched.

Sanity check:
```bash
grep -n "aiPanelBorder" cli/src/types/theme-system.ts cli/src/utils/theme-system.ts cli/src/components/message-block.tsx
# field present in interface, defaults (dark + light), and the component fallback chain
```

#### `sdk/src/impl/llm.ts`

Fork threads `agentId` through 3 call sites into `ModelRequestParams`. If upstream changes the params interface or adds new fields, the `agentId?` field must survive.

**Resolve:** ensure `agentId` is still passed into `getModelForRequest(...)`. Grep for the 3 call sites:
```bash
grep -n "agentId" sdk/src/impl/llm.ts
# expect 3+ hits passing it through
```

#### `sdk/src/impl/database.ts`

**Shimmed in 1.0.3.** Backend-skip logic lives in `sdk/src/impl/fork-impls/backend-skip.ts`. Upstream file calls `getForkHooks().skipBackend?.()` + `getForkHooks().synthUserInfo?.()` at each backend entry; if either returns truthy, short-circuit.

**Resolve:** if upstream changes `getUserInfoFromApiKey` or `startAgentRun` signatures, re-anchor the hook calls at the entry of each backend-touching function. Do NOT remove Path B — external SDK consumers may still set `CODEBUFF_USE_BACKEND=1` and expect upstream behavior.

#### `cli/src/init/init-app.ts`

Fork registers fork-hooks here at boot (`registerForkHooks({...})` + `setActiveByokProfile()` + `setByokAgentBindings()`). If upstream restructures `init-app.ts` (e.g. async ordering), the boot registration must still happen **before** the first agent spawn — otherwise SDK Path C dispatches silently fall back to upstream.

**Resolve:** keep BYOK boot calls early in the init sequence. After upstream's auth/config load, before the SDK takes any request. Order matters: register hooks first, then push active profile + bindings.

### LOW conflict risk

#### `cli/src/login/constants.ts` + `cli/src/hooks/use-logo.tsx` — banner art

Fork ships ASCII art branded "CODEBUFF - M1" (full) / "CBM" (small). The full-logo width threshold in `use-logo.tsx` is raised from upstream's `70` to `92` to match the wider mark.

**Resolve:** if upstream changes the logo art or threshold, keep the fork's "CODEBUFF - M*" mark and the `92` threshold. Bump the trailing version letter ("M1" → "M2") only when the fork hits a milestone version. See [.context/decisions.md](./.context/decisions.md) "Banner mark is 'CODEBUFF - M'".

#### `scripts/check-env-architecture.ts` — env allowlist

Fork adds raw-`process.env` consumers to `additionalProcessEnvAllowlist` for both `cli` and `sdk` packages so the env-architecture check passes:
- cli: `index.tsx`, `hooks/use-auth-query.ts`, `utils/providers.ts`, `utils/providers-models.ts`
- sdk: `impl/database.ts`, `impl/model-provider.ts`

**Resolve:** keep both allowlist entries. If a new BYOK surface reads `process.env.CODEBUFF_USE_BACKEND` / `CODEBUFF_PROVIDERS_PATH` directly (not via the env schema), add it to the cli allowlist or the check will fail.

Sanity check:
```bash
grep -n "providers.ts\|providers-models.ts\|model-provider.ts\|database.ts" scripts/check-env-architecture.ts
```

#### `packages/agent-runtime/src/run-agent-step.ts`

**Shimmed in 1.0.3 — now byte-identical to upstream.** UUID synthesis moved to an SDK-side `forkAwareStartAgentRun` wrap in `sdk/src/impl/fork-impls/runid-synth.ts`. The agent-runtime file no longer has any fork-local edit; the BYOK fallback runs at the SDK boundary instead.

**Resolve:** zero in-place edit means zero merge conflict here. If upstream renames `startAgentRun` or changes its return type, update the SDK-side wrap in `runid-synth.ts` accordingly. The synthesized id format remains `byok-<agentTemplate.id>-<uuid>` — preserve that prefix so logs are greppable.

**Do NOT** revert to `?? ''` empty-string coercion. See [.context/gotchas.md](./.context/gotchas.md) "BYOK runId must be truthy, not just non-null."

#### `cli/scripts/prebuild-agents.ts`

**Shimmed in 1.0.3.** Reduced to a 5-line one-liner that calls into `cli/scripts/fork-impls/scan-mod-agents.ts`. The `.agents/mod-*.ts` glob + manifest append logic lives in the fork-impl.

**Resolve:** keep the one-line shim call after upstream's scan. If upstream rewrites the agent bundling system, port the call site into the new architecture; the `mod-*` glob logic in `scan-mod-agents.ts` likely doesn't need changes. See [.context/gotchas.md](./.context/gotchas.md) "`prebuild-agents.ts` bundles `agents/` plus `.agents/mod-*.ts`."

#### `cli/src/commands/command-registry.ts`
#### `cli/src/data/slash-commands.ts`

Fork registers `/providers`, `/providers:add`, `/providers:remove`, `/providers:list`, `/providers:select`, `/providers:bind`, `/providers:unbind`, `/providers:bindings`, `/model`.

**Resolve:** preserve every registration. If upstream changes the command registry API, port all 9 commands into the new shape.

#### `cli/package.json`

Fork sets `"name": "codebuff-mod"` (or similar) and bumps `version` on every release. Conflicts on every upstream version bump.

**Resolve:** keep fork's `name`, keep fork's `version`, take everything else from upstream (dependencies, scripts).

#### `cli/release/index.js`, `cli/release/package.json`, `cli/release/postinstall.js`, `cli/release/README.md`

Fork-local launcher. Should never conflict (upstream doesn't touch these — they're fork-only files).

**Resolve:** if a conflict shows up here, something is wrong. Investigate before resolving.

#### `common/src/env-schema.ts`, `packages/internal/src/env-schema.ts`

Fork keeps `OPENCODE_API_KEY` shared between Zen + Go (no separate `OPENCODE_GO_API_KEY`). See [.context/decisions.md](./.context/decisions.md) "Single shared `OPENCODE_API_KEY`."

**Resolve:** do not split the var unless opencode.ai starts issuing separate keys.

#### `common/src/constants/model-config.ts`

Fork deliberately does NOT add `'opencode-go'` to `ALLOWED_MODEL_PREFIXES`. See [.context/decisions.md](./.context/decisions.md) "Skip `ALLOWED_MODEL_PREFIXES` update."

**Resolve:** only add it if an agent template references `opencode-go/*` as its model id. Otherwise leave alone.

### ZERO conflict (pure additions)

Fork-only new files — upstream doesn't know they exist. If a conflict surfaces here, it's a phantom from rename detection — investigate:

**Pre-1.0.3 additions:**
- `.agents/mod-default.ts`, `mod-lite.ts`, `mod-max.ts`, `mod-plan.ts`
- `cli/src/commands/providers.ts`
- `cli/src/utils/providers.ts`, `providers-models.ts`
- `cli/src/utils/__tests__/providers*.test.ts`
- `sdk/src/codex-credentials.ts` (added 0.2.1 — per-profile codex OAuth creds store at `~/.config/manicode/codex-oauth.json`)
- `sdk/src/impl/__tests__/database-byok-skip.test.ts`
- `sdk/src/impl/__tests__/model-provider-byok.test.ts`
- `web/src/llm-api/opencode-go.ts`
- `.context/**`
- `.claude/byok-rip-implementation-plan.md`
- `.claude/opencode-go-implementation-plan.md`
- `MERGE-STRATEGY.md` (this file)

**Added in 1.0.3 (shim refactor):**
- `sdk/src/impl/fork-hooks.ts` — hook registry contract
- `sdk/src/impl/fork-impls/byok-resolver.ts` — Path C resolution (raw-key + codex OAuth) + per-agent binding lookup
- `sdk/src/impl/fork-impls/backend-skip.ts` — `shouldSkipBackend` + synthetic-user fallback
- `sdk/src/impl/fork-impls/runid-synth.ts` — `forkAwareStartAgentRun` BYOK runId UUID synth
- `cli/scripts/fork-impls/scan-mod-agents.ts` — `.agents/mod-*` bundle scan
- `cli/src/fork-impls/preset-add-handlers.ts` — codex async `/providers:add` handler
- `web/src/fork-impls/provider-dispatch.ts` — opencode-go provider override

Runtime-only files (not in repo, written at boot — listed so manual conflict-resolution doesn't accidentally `git add` them):

- `~/.config/manicode/providers.json`
- `~/.config/manicode/codex-oauth.json` (added 0.2.1)
- `~/.config/manicode/credentials.json` (legacy `/connect:chatgpt` singleton — preserved)
- `~/.config/manicode/models-cache.json`

---

## PORT marker convention

Files that have fork-local edits adjacent to upstream code are tagged with `PORT:` comments. Examples:

```ts
// PORT: BYOK Path C — runs before upstream Path A/B. Keep this block at the top.
// PORT: synthesize runId UUID when startAgentRun() returns null (BYOK mode).
// PORT: thread agentId through so SDK Path C can per-agent route.
```

After a merge, grep for fresh `PORT:` violations:

```bash
git grep "PORT:" -- ':!.context/' ':!.claude/' ':!MERGE-STRATEGY.md'
```

If any marker is missing context (e.g. line moved during merge), re-anchor it. Markers exist so the next merge agent (you in 3 months) doesn't have to re-derive intent.

---

## Sanity checks after every merge

Run these before pushing `modded`. None should fail:

| Check | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | 0 errors |
| Tests | `bun run test` | all pass |
| BYOK skip gate | `grep -n "skipBackend\|synthUserInfo" sdk/src/impl/database.ts` | hook calls present at backend entries |
| BYOK skip impl | `ls sdk/src/impl/fork-impls/backend-skip.ts` | fork-impl exists |
| Path C resolution | `grep -n "resolveByok\|byokAgentBindings\[" sdk/src/impl/model-provider.ts sdk/src/impl/fork-impls/byok-resolver.ts` | shim call in model-provider, per-agent lookup in byok-resolver |
| RunId synthesis | `grep -n "byok-" sdk/src/impl/fork-impls/runid-synth.ts` | UUID synth in fork-impl, NOT in agent-runtime |
| Fork hooks registered | `grep -n "registerForkHooks\|setActiveByokProfile" cli/src/init/init-app.ts` | boot registration present |
| BYOK_AT_BOOT gates | `grep -rn "BYOK_AT_BOOT" cli/src/hooks/` | 3 hooks still gated (use-connection-status, use-gravity-ad, use-agent-validation) |
| BYOK env-gate everywhere | `git grep "CODEBUFF_USE_BACKEND" cli/src/ sdk/src/` | gate present in index.tsx, app.tsx (LoginModal render), use-auth-query.ts, use-{connection-status,gravity-ad,agent-validation}.ts, command-registry.ts (/logout), sdk/src/impl/database.ts (shouldSkipBackend) |
| `/providers` commands | `grep -n "providers:" cli/src/commands/command-registry.ts` | all 8 registered |
| mod-* prebuild | `grep -n "mod-" cli/scripts/prebuild-agents.ts` | scan block present |
| Codex OAuth catalog | `grep -c "^\s*'[^']*':" common/src/constants/chatgpt-oauth.ts` | >= 22 entries in `OPENROUTER_TO_OPENAI_MODEL_MAP` |
| Codex picker derives from map | `grep -n "MODEL_CATALOG\[.codex.\]\|codex:.*OPENROUTER" cli/src/utils/providers-models.ts` | catalog derived, no hand-list |
| Dead codex probe gone | `grep -rn "fetchCodexModelsFromEndpoint\|chatgpt.com/backend-api/models" cli/src/` | ZERO hits (deleted 1.0.0) |
| Codex creds module | `ls sdk/src/codex-credentials.ts && grep -n "getValidCodexCredentials\|clearCodexCredentials" sdk/src/` | file exists, both helpers exported |
| `oauthProfileId` plumbed | `git grep "oauthProfileId" cli/src/ sdk/src/` | present in providers.ts, providers.ts handler, model-provider.ts, buildSdkBindings |
| `aiPanelBorder` theme key | `git grep "aiPanelBorder" cli/src/` | present in theme-system types, defaults (dark+light), message-block fallback |
| Env-architecture allowlist | `grep -n "providers.ts\|model-provider.ts" scripts/check-env-architecture.ts` | fork BYOK files still in `additionalProcessEnvAllowlist` |
| Smoke test (raw-key) | `cbm` → `/providers:add openrouter <key>` → `/providers:list` → small prompt | binds + responds |
| Smoke test (codex OAuth) | `cbm` → `/providers:add codex` → browser flow → `/model` → small prompt | OAuth completes, 22-entry picker, dispatch succeeds |

---

## When NOT to merge

Defer the merge if any of these hold:

- A `codebuff-mod` release is hot (last 48 hours) — let users settle on the new tip before disturbing.
- Upstream introduced a major architectural change (e.g. new agent-runtime, rewritten SDK API) — read upstream's diff first and decide whether to merge or fork harder.
- Working tree has uncommitted BYOK work — finish that first, ship a release, then sync.
- It's been **less than 2 weeks** since the last sync **AND** nothing in the [conflict map](#conflict-map) zones changed upstream — there's no payoff yet.

---

## When you reach a merge you can't resolve

Abort and ask. Better to defer a sync than to ship a corrupted merge:

```bash
git merge --abort
```

Then write what blocked you into [.context/active-work.md](./.context/active-work.md) so the next session sees it.

---

## Related

- [.context/overview.md](./.context/overview.md) — fork-vs-upstream map
- [.context/decisions.md](./.context/decisions.md) — rationale for each fork-local choice
- [.context/gotchas.md](./.context/gotchas.md) — non-obvious behaviors
- [.claude/byok-rip-implementation-plan.md](./.claude/byok-rip-implementation-plan.md) — original rip plan
