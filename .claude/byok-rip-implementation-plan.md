# Codebuff Fork — Full BYOK Client-Side Rip Implementation Plan

**Target repo:** `D:\.claude\claude projects\codebuff` (fork, branch `modded`)
**Goal:** Convert Codebuff CLI from hosted-backend-bound tool to fully standalone BYOK CLI. Strip codebuff.com auth, codebuff.com backend, codebuff.com billing. Add Stratagem-style `/providers` profile system. Direct provider HTTP calls using user's own API keys.
**Endgame:** User clones repo (or installs `codebuff-mod`), runs `cbm`, sets up provider profile with their own OpenAI/Anthropic/OpenCode-Go/etc. key, runs agents against any model they want with zero codebuff.com involvement.

---

## Architectural premise

The agent runtime is **transport-agnostic**. `packages/agent-runtime/` is pure logic — prompt assembly, tool dispatch, message-loop control. The actual LLM HTTP call is injected via the `promptAiSdkStream` callback at [packages/agent-runtime/src/prompt-agent-stream.ts:45](D:/.claude/claude projects/codebuff/packages/agent-runtime/src/prompt-agent-stream.ts#L45). This means we can swap out the model-call destination without touching the agent loop itself.

Existing proof: [sdk/src/impl/model-provider.ts:117](D:/.claude/claude projects/codebuff/sdk/src/impl/model-provider.ts#L117) `getModelForRequest()` already has two paths:
- **Path A** — ChatGPT OAuth → direct OpenAI HTTP (skips backend entirely)
- **Path B** — Backend via `WEBSITE_URL/api/v1/chat/completions`

This plan adds **Path C** — BYOK profile → direct provider HTTP — using the same shape as Path A, then strips Path B and all backend dependencies.

---

## Out of scope for v1

- **OAuth-based providers** (Antigravity, GitHub Copilot, KiloCode, Cline, Cursor, Kiro). Each is a multi-day port from Stratagem/Tau. Defer to v2. v1 supports API-key providers only.
- **Agent template fetching from codebuff.com** (`base2`, `base2-lite`, `base2-max`, `base2-plan`). These live in the codebuff.com DB and can't be retrieved. Replace with local `.agents/` templates that you author or copy from upstream's `agents/` directory.
- **Per-run analytics, BigQuery inserts, Stripe credit consumption.** All gone. CLI doesn't bill anything.
- **Ads, usage queries, subscription UI.** All gone.
- **Multi-account rotation per provider** (Stratagem has this for Antigravity). Defer to v2.

---

## Existing pieces this plan reuses

| Piece | Location | Reuse plan |
|---|---|---|
| Agent runtime (transport-agnostic) | `packages/agent-runtime/` | Untouched |
| `getAgentRuntimeImpl()` factory | [sdk/src/impl/agent-runtime.ts:27](D:/.claude/claude projects/codebuff/sdk/src/impl/agent-runtime.ts#L27) | Untouched — already accepts injected `promptAiSdkStream` |
| ChatGPT OAuth direct path (`createOpenAIOAuthModel`) | [sdk/src/impl/model-provider.ts:166](D:/.claude/claude projects/codebuff/sdk/src/impl/model-provider.ts#L166) | Pattern template for new `createDirectProviderModel()` |
| BYOK OpenRouter precedent | [common/src/constants/byok.ts:11](D:/.claude/claude projects/codebuff/common/src/constants/byok.ts#L11), [sdk/src/env.ts:41](D:/.claude/claude projects/codebuff/sdk/src/env.ts#L41) | Generalize from OpenRouter-only to N-provider |
| Local agents discovery | `.agents/` directory + existing dynamic-agent-template loading | New mode commands point here |
| Credentials file location | [cli/src/utils/auth.ts:48](D:/.claude/claude projects/codebuff/cli/src/utils/auth.ts#L48) — `~/.config/manicode/credentials.json` | Sister file `providers.json` lives in same dir |
| Local `.agents/` registry | `cli/src/utils/constants.ts` agent-id lookup | Rewire `/mode:` slash commands to local agents |
| Slash command surface | [cli/src/data/slash-commands.ts](D:/.claude/claude projects/codebuff/cli/src/data/slash-commands.ts) | Add `/providers`, repurpose `/login`, rewire `/mode:` |

---

## File inventory — what changes

### Phase 1 — provider profile store (foundation)

**NEW — `cli/src/utils/providers.ts`** (~250 LOC)
Profile CRUD layer. Mirrors [d:\Mods\xethryon\new agent\XETH--7\src\providers\providerProfiles.ts](d:\Mods\xethryon\new agent\XETH--7\src\providers\providerProfiles.ts) shape.

```ts
export type ProviderProfile = {
  id: string             // uuid
  name: string           // user-given label
  preset: ProviderPreset // 'openai' | 'anthropic' | 'opencode' | 'opencode-go' | 'openrouter' | 'custom-openai' | ...
  provider: 'openai' | 'anthropic'  // wire-shape tier
  baseUrl: string
  model: string          // default model id for this profile
  apiKey: string
  createdAt: string
  isActive?: boolean
}

export type ProviderPreset =
  | 'openai' | 'anthropic' | 'opencode' | 'opencode-go'
  | 'openrouter' | 'mistral' | 'together' | 'groq' | 'deepseek'
  | 'gemini' | 'custom-openai'

export type ProviderPresetDefaults = {
  preset: ProviderPreset
  name: string
  provider: 'openai' | 'anthropic'
  baseUrl: string
  defaultModel: string
  requiresApiKey: boolean
}
```

Exports:
- `loadProfiles(): ProviderProfile[]` — read `~/.config/manicode/providers.json`
- `saveProfiles(profiles: ProviderProfile[]): void` — atomic write, 0600 perms
- `getActiveProfile(): ProviderProfile | null`
- `setActiveProfile(id: string): void`
- `addProfile(input: Partial<ProviderProfile>): ProviderProfile`
- `removeProfile(id: string): void`
- `getPresetDefaults(preset: ProviderPreset): ProviderPresetDefaults` — static table; mirror [d:\Mods\xethryon\new agent\XETH--7\src\providers\providerProfiles.ts:392-409](d:\Mods\xethryon\new agent\XETH--7\src\providers\providerProfiles.ts#L392-L409) for OpenCode shapes

Storage path resolution: copy `getConfigDir()` pattern from [cli/src/utils/auth.ts:35](D:/.claude/claude projects/codebuff/cli/src/utils/auth.ts#L35). File path: `<configDir>/providers.json`.

**Model catalog layer (added in Phase 1, consumed in Phase 3 picker):**

Two sources of model ids per preset — hardcoded catalog (curated) + live `/v1/models` probe (dynamic). Some presets use one, some both, custom uses neither.

```ts
// Hardcoded catalog — for presets with stable, curated model lists
export const MODEL_CATALOG: Record<ProviderPreset, string[]> = {
  'openai':       ['gpt-5.1', 'gpt-5.1-chat', 'gpt-4.1', 'gpt-4o', 'o3', 'o4-mini'],
  'anthropic':    ['claude-sonnet-4.5', 'claude-opus-4.1', 'claude-3.5-haiku'],
  'opencode':     ['opencode/minimax-m2.7', 'opencode/kimi-k2.6'],
  'opencode-go':  ['opencode-go/glm-5'],
  'deepseek':     ['deepseek-chat', 'deepseek-reasoner'],
  'gemini':       ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  'mistral':      ['mistral-large-latest', 'codestral-latest', 'devstral-latest'],
  // Empty → triggers live /models probe in picker
  'openrouter':   [],
  'together':     [],
  'groq':         [],
  'custom-openai': [],  // forces free-text input
}

// Live probe — for huge / churning catalogs
export async function fetchModelsFromEndpoint(params: {
  baseUrl: string
  apiKey: string
}): Promise<string[]> {
  const url = `${params.baseUrl.replace(/\/+$/, '')}/models`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${params.apiKey}` },
  })
  if (!res.ok) throw new Error(`/models probe failed: ${res.status}`)
  const json = await res.json()
  // OpenAI-compat shape: { data: [{ id: string, ... }, ...] }
  return (json.data ?? []).map((m: { id: string }) => m.id).filter(Boolean)
}

// Disk cache so we don't probe on every picker open
const MODELS_CACHE_PATH = `${getConfigDir()}/models-cache.json`
const CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24h

export async function getModelsForPreset(params: {
  preset: ProviderPreset
  baseUrl: string
  apiKey: string
  forceRefresh?: boolean
}): Promise<{ source: 'catalog' | 'probe' | 'cache' | 'freetext'; models: string[] }> {
  const { preset, baseUrl, apiKey, forceRefresh } = params

  // Catalog takes precedence when populated
  const catalog = MODEL_CATALOG[preset]
  if (catalog.length > 0) return { source: 'catalog', models: catalog }

  if (preset === 'custom-openai') return { source: 'freetext', models: [] }

  // Live probe with cache
  const cacheKey = `${preset}:${baseUrl}`
  if (!forceRefresh) {
    const cached = readModelsCache(cacheKey)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return { source: 'cache', models: cached.models }
    }
  }
  const models = await fetchModelsFromEndpoint({ baseUrl, apiKey })
  writeModelsCache(cacheKey, { fetchedAt: Date.now(), models })
  return { source: 'probe', models }
}
```

Cache file: `~/.config/manicode/models-cache.json`. Schema: `{ [cacheKey: string]: { fetchedAt: number, models: string[] } }`. Cache busted by `/providers:refresh-models` slash command (Phase 3).

Presets to include in v1:
| Preset | provider | baseUrl | defaultModel |
|---|---|---|---|
| `openai` | openai | https://api.openai.com/v1 | gpt-5.1 |
| `anthropic` | anthropic | https://api.anthropic.com | claude-sonnet-4.5 |
| `opencode` | openai | https://opencode.ai/zen/v1 | minimax-m2.7 |
| `opencode-go` | openai | https://opencode.ai/zen/go/v1 | glm-5 |
| `openrouter` | openai | https://openrouter.ai/api/v1 | anthropic/claude-sonnet-4.5 |
| `mistral` | openai | https://api.mistral.ai/v1 | mistral-large-latest |
| `together` | openai | https://api.together.xyz/v1 | meta-llama/Llama-3.3-70B-Instruct-Turbo |
| `groq` | openai | https://api.groq.com/openai/v1 | llama-3.3-70b-versatile |
| `deepseek` | openai | https://api.deepseek.com/v1 | deepseek-chat |
| `gemini` | openai | https://generativelanguage.googleapis.com/v1beta/openai | gemini-2.5-pro |
| `custom-openai` | openai | (user-supplied) | (user-supplied) |

---

### Phase 2 — direct provider model factory (the dispatch swap)

**MODIFY — `sdk/src/impl/model-provider.ts`** (~80 LOC delta)

Add new factory mirroring `createOpenAIOAuthModel` at line 166:

```ts
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { OpenAICompatibleChatLanguageModel } from '@ai-sdk/openai-compatible'
import { createAnthropic } from '@ai-sdk/anthropic'

function createDirectProviderModel(params: {
  profile: ProviderProfile
  modelOverride?: string  // agent template may override the profile's default model
}) {
  const { profile, modelOverride } = params
  const model = modelOverride ?? profile.model

  if (profile.provider === 'anthropic') {
    const anthropic = createAnthropic({
      baseURL: profile.baseUrl,
      apiKey: profile.apiKey,
    })
    return anthropic(model)
  }

  // openai-compat path covers: openai, opencode, opencode-go, openrouter,
  // mistral, together, groq, deepseek, gemini, custom-openai
  return new OpenAICompatibleChatLanguageModel(model, {}, {
    provider: profile.preset,
    url: ({ path }) => `${profile.baseUrl.replace(/\/+$/, '')}${path}`,
    headers: () => ({
      Authorization: `Bearer ${profile.apiKey}`,
      'Content-Type': 'application/json',
    }),
    fetch: globalThis.fetch,
  })
}
```

Then add Path C to `getModelForRequest()` at line 117:

```ts
export function getModelForRequest(params: ModelRequestParams) {
  // Path C — BYOK profile (NEW, takes precedence)
  const activeProfile = getActiveProfile()  // from cli/src/utils/providers
  if (activeProfile?.apiKey) {
    return createDirectProviderModel({
      profile: activeProfile,
      modelOverride: params.model,  // template may override
    })
  }

  // Path A — ChatGPT OAuth (existing, keep as fallback for users who already use it)
  if (CHATGPT_OAUTH_ENABLED && isOpenAIProviderModel(params.model)) {
    // ... existing logic
  }

  // Path B — Backend (existing, REMOVE in Phase 5 once Path C is stable)
  return createCodebuffBackendModel(params)
}
```

**Strategy:** ship Path C while keeping Path B intact for one release. Iterate. Strip Path B in Phase 5 when confidence is high.

**Cross-cutting concern:** the SDK is consumed by external users too (per `sdk/`'s public API). The Phase 5 strip of Path B is destructive for those users. Either:
- Fork the SDK in-tree (`cli/src/sdk-local/`) and only the CLI uses it, OR
- Make Path B opt-in via env flag (`CODEBUFF_USE_BACKEND=1`) — default to BYOK

Recommend the env-flag approach. Less code, preserves SDK API for external consumers.

---

### Phase 3 — slash commands

**MODIFY — `cli/src/data/slash-commands.ts`**

Add new commands:
```ts
'/providers',                  // list, with active marked
'/providers:add',              // 4-step flow: preset → name → apiKey → model
'/providers:edit',             // pick + edit any field (incl. model swap)
'/providers:remove',           // pick + confirm
'/providers:select',           // pick → set active
'/providers:test',             // ping active profile with a 1-token completion
'/providers:refresh-models',   // bust models-cache for active profile (re-probes on next picker open)
'/model',                      // runtime model swap on active profile (no re-setup)
'/model:select',               // alias / explicit form
```

**`/providers:add` flow (4 steps, mirrors Stratagem's [ProviderManager.tsx](d:\Mods\xethryon\new agent\XETH--7\src\components\ProviderManager.tsx) 4/4):**
1. **Preset picker** — fuzzy list of all `ProviderPreset` values
2. **Name input** — free text, default = preset display name
3. **API key input** — masked entry, skipped for `custom-openai` if user wants no auth (rare)
4. **Model picker** — branches on `getModelsForPreset()` source:
   - `source: 'catalog'` → fuzzy-pick from hardcoded list
   - `source: 'probe'` → spinner during fetch → fuzzy-pick from results; show `(cached)` tag if from disk cache
   - `source: 'freetext'` → free-text input field
   - On probe failure (network error, 401): fall back to free-text with error banner

**`/model` runtime swap:**
While a profile is active, `/model` opens the same picker as step 4 of `/providers:add`, scoped to the active profile's preset. Selection overwrites `profile.model` in place and re-saves `providers.json`. Does NOT touch baseUrl or apiKey. Useful for switching between e.g. `claude-sonnet-4.5` and `claude-opus-4.1` on the same Anthropic profile without re-entering the key.

**Agent-template model override interaction:**
A `.agents/<x>.ts` template may set `model: 'opencode-go/glm-5'` explicitly. When that template runs, its model wins over `profile.model`. `/model` only changes `profile.model` (the fallback when templates don't specify).

**NEW — `cli/src/components/providers-panel.tsx`** (~400 LOC)
Ink/React panel for `/providers` UI. Mirror Stratagem's [d:\Mods\xethryon\new agent\XETH--7\src\components\ProviderManager.tsx](d:\Mods\xethryon\new agent\XETH--7\src\components\ProviderManager.tsx) where possible. Codebuff uses OpenTUI not Ink, so adapt the rendering primitives but keep the flow:
1. List view: profiles with active highlighted
2. Add flow: preset picker → name input → (if not OAuth) API key input → optional model override → save → set active
3. Edit flow: list → pick → field-by-field editor
4. Test flow: send minimal completion, show success/error

**MODIFY — `cli/src/utils/constants.ts` `AGENT_MODE_TO_ID`**

Today (line 134): `{ DEFAULT: 'base2', LITE: 'base2-lite' | 'base2-free', MAX: 'base2-max', PLAN: 'base2-plan' }`

Replace with local agent ids that exist in `.agents/` or `agents/`:
```ts
export const AGENT_MODE_TO_ID = {
  DEFAULT: 'mod-default',
  LITE: 'mod-lite',
  MAX: 'mod-max',
  PLAN: 'mod-plan',
} as const
```

Then create those local agent templates in `.agents/` (next phase).

**Repurpose `/login`:**
- Current behavior: opens browser to codebuff.com OAuth, persists session token in `credentials.json`
- New behavior (v1): show a message `/login is not used in BYOK mode. Use /providers:add to add a provider profile with an API key.`
- v2: gain meaning when OAuth providers (Antigravity, Copilot) ship — then `/login:antigravity`, `/login:copilot` etc.

---

### Phase 4 — local agent templates (replace `base2-*`)

**NEW — `.agents/mod-default.ts`, `.agents/mod-lite.ts`, `.agents/mod-max.ts`, `.agents/mod-plan.ts`**

These are agent template files. Refer to [docs/agents-and-tools.md](D:/.claude/claude projects/codebuff/docs/agents-and-tools.md) (upstream) for the template DSL.

Skeleton (`.agents/mod-default.ts`):
```ts
import { defineAgent } from '@codebuff/sdk'  // or whatever the local-template helper is

export default defineAgent({
  id: 'mod-default',
  displayName: 'Default',
  systemPrompt: '...your system prompt for the default agent...',
  // model field is OPTIONAL — when omitted, runtime falls back to active provider profile's model
  tools: ['read_files', 'write_file', 'spawn_agents', 'run_terminal_command', ...],
  // ...
})
```

Reference for shape: look at existing `.agents/<x>.ts` files in the repo. Upstream `agents/` directory also has examples.

**Critical:** these templates must NOT hardcode model ids that only exist in codebuff.com's whitelist. Either leave `model` unset (runtime uses active profile's model) or use openrouter-style `provider/model` strings.

---

### Phase 5 — strip backend dependencies

**Once Phase 1-4 are smoke-tested, do these in one PR:**

**MODIFY — `sdk/src/impl/database.ts`** — all backend HTTP calls
Convert each to a no-op or local-file fallback:
- `getUserInfoFromApiKey()` (line 127) — return synthetic user `{ id: 'local', email: 'local@byok' }`
- `fetchAgentFromDatabase()` (line 221) — return null → forces local `.agents/` lookup
- `startAgentRun()` / `finishAgentRun()` / `addAgentStep()` (lines 307, 361, 411) — write to local JSONL log at `~/.config/manicode/runs.jsonl` instead of POSTing

**MODIFY — `cli/src/utils/auth.ts`**
- `getAuthToken()` returns a synthetic local token (`'byok-local'`)
- `getUserCredentials()` returns synthetic local user
- `/login` flow → no-op or shows the BYOK-mode message

**MODIFY — `sdk/src/impl/model-provider.ts`**
Either delete Path B entirely, OR gate behind `CODEBUFF_USE_BACKEND=1` env flag (recommended — preserves SDK consumers).

**MODIFY — `cli/src/hooks/use-gravity-ad.ts`, `cli/src/hooks/use-usage-query.ts`**
Strip the fetches. Replace ad-rendering component with no-op. Replace usage panel with a "BYOK mode — no central billing" placeholder.

**MODIFY — `common/src/env-schema.ts` (line 7)**
Make `NEXT_PUBLIC_CODEBUFF_APP_URL` **optional**. Currently it's required and the CLI crashes if unset. Default: `'http://localhost:1'` or some sentinel — but only the backend path consumes it, and Path B is now gated.

**MODIFY — `common/src/constants/model-config.ts`**
Skip `isExplicitlyDefinedModel()` validation when BYOK profile is active. Either:
- Wrap validators in `if (!getActiveProfile())` checks, OR
- Add a `BYOK_MODE` flag that short-circuits the validators

---

### Phase 6 — update launcher distribution

**MODIFY — `cli/release/index.js`**

Today: `packageName` left as `'codebuff'` to keep binary downloads pointing at upstream artifacts. Per [.context/active-work.md](D:/.claude/claude projects/codebuff/.context/active-work.md), the launcher polls upstream npm and re-downloads upstream binary every run.

After this rip, the upstream binary will NOT work — it requires codebuff.com backend. So:
1. Set `packageName: 'codebuff-mod'` (your own npm package)
2. Build CLI binary from your fork, host artifacts (GitHub Releases of `EstarinAzx/codebuff`)
3. Update download URL pattern in launcher
4. Bump `codebuff-mod` to v0.1.0 to signal real divergence (not just a launcher wrapper anymore)

Phase 6 is the publication step. Holds until Phases 1-5 are stable.

---

## Phase ordering + checkpoints

| Phase | Deliverable | Checkpoint |
|---|---|---|
| 1 | `providers.ts` profile store + tests | `bun test cli/src/utils/providers.test.ts` green |
| 2 | Path C in `getModelForRequest` + `createDirectProviderModel` | Manual: set BYOK profile, run `/mode:default` → request hits provider, not codebuff.com |
| 3 | `/providers*` slash commands + panel UI | Manual: add a profile via UI, select it, run an agent |
| 4 | Local `mod-*` agent templates | Manual: `/mode:default` loads local template, runs against active profile |
| 5 | Backend dependency strip | Manual: unset `NEXT_PUBLIC_CODEBUFF_APP_URL`, CLI still boots + runs |
| 6 | Republish `codebuff-mod@0.1.0` with own binaries | `npm install -g codebuff-mod && cbm` works on fresh machine |

Each phase ships as its own commit. Do NOT bundle phases — Phase 2 alone validates the core architectural bet (Path C works). If Phase 2 fails for a non-obvious reason (e.g. agent runtime expects backend-specific envelope), the rest of the plan needs re-scoping before doing the destructive Phase 5 strip.

---

## Critical correctness checks (do NOT skip)

1. **API key file perms.** `providers.json` MUST be 0600 (owner read/write only). Atomic write via temp file + rename. Reference: Stratagem's [providerProfile.ts](d:\Mods\xethryon\new agent\XETH--7\src\providers\providerProfile.ts) handling.

2. **API keys never logged.** Audit every `console.log` / `logger.info` path that touches a profile. Mask all but last 4 chars. Sanitize before BigQuery (which we're stripping anyway, but the helper functions may persist in code).

3. **Phase 5 is destructive for SDK consumers.** If external users depend on the SDK's backend mode, gate Path B removal behind the `CODEBUFF_USE_BACKEND=1` opt-in flag rather than ripping it out. Default to BYOK.

4. **Agent template model resolution.** Templates can specify `model: 'opencode-go/glm-5'`. When `getModelForRequest` runs, the template-provided model must override the profile's default model. Pattern: `modelOverride = template.model; profile = getActiveProfile(); finalModel = modelOverride ?? profile.model`.

5. **Whitelist bypass is BYOK-conditional.** Don't globally disable `isExplicitlyDefinedModel`. Only skip it when an active BYOK profile is set. Otherwise stale Path B code paths break.

6. **`/providers:test` is mandatory.** Before any agent run, the user needs a fast feedback loop to confirm their API key + baseUrl combo actually works. Without this, they'll only discover bad keys 30s into an agent loop. Ship `/providers:test` in Phase 3 alongside the other commands.

7. **Existing user data preservation.** If someone has a current `credentials.json` from upstream, don't break it. Phase 5's `/login` repurpose should detect existing creds and silently leave them alone (synthetic local mode just overrides at runtime). They can `rm ~/.config/manicode/credentials.json` themselves.

8. **`fetchAgentFromDatabase()` null return cascades.** When it returns null in Phase 5, the call site must fall back to local `.agents/`. Verify that fallback exists — if it currently throws on null, add the fallback BEFORE returning null. Else CLI dies on every agent invocation.

---

## How to test (manual smoke after Phase 2)

1. Set env: `unset NEXT_PUBLIC_CODEBUFF_APP_URL` (or leave at dummy)
2. Add profile: `/providers:add` → select `opencode-go` → enter `OPENCODE_API_KEY` → save → set active
3. Test: `/providers:test` → should print "OK, model glm-5 responded"
4. Run agent: any local template → confirm HTTP traffic goes to `opencode.ai/zen/go/v1`, NOT to codebuff.com
5. Switch profile: `/providers:add` → `openai` → real OpenAI key → `/providers:select`
6. Run again → traffic to `api.openai.com`
7. Confirm: `~/.config/manicode/providers.json` exists, is 0600, contains both profiles

After Phase 5: 1-7 still work AND `~/.config/manicode/credentials.json` is unused / can be deleted without affecting anything.

---

## Upstream sync protocol post-rip

Once Phases 1-5 land, upstream pulls become harder because you've forked deeply:

- **Agent runtime** (`packages/agent-runtime/`) — upstream changes here usually apply cleanly. Merge them. This is the core engine, you want their improvements.
- **CLI TUI** (`cli/src/components/`, hooks) — merge most upstream changes; expect conflicts in any file you modified (`use-send-message.ts`, `slash-commands.ts`, `auth.ts`).
- **`sdk/src/impl/model-provider.ts`** — high-conflict area. Keep your Path C; merge upstream Path A/B changes if they don't conflict.
- **`sdk/src/impl/database.ts`** — fully stubbed in your fork. Upstream changes here are mostly irrelevant; merge with prejudice.
- **`web/`** — keep your `opencode-go.ts` for reference but it's dead code in BYOK mode. Eventually delete the entire `web/` directory from your fork.
- **`freebuff/`** — also dead in BYOK mode. Consider deleting.

Keep a `FORK_DIVERGENCE.md` at repo root listing every file you changed in Phases 1-5 so future-you can grep the merge resolution surface.

---

## File inventory summary

| Action | File | LOC est |
|---|---|---|
| NEW | `cli/src/utils/providers.ts` | ~250 |
| NEW | `cli/src/utils/providers-models.ts` (catalog + live probe + cache) | ~120 |
| NEW | `cli/src/components/providers-panel.tsx` (or `.ts` w/ OpenTUI) | ~500 (added model-picker step) |
| NEW | `cli/src/components/model-picker.tsx` (reused by `/providers:add` step 4 and `/model`) | ~150 |
| NEW | `.agents/mod-default.ts` | ~50 |
| NEW | `.agents/mod-lite.ts` | ~30 |
| NEW | `.agents/mod-max.ts` | ~80 |
| NEW | `.agents/mod-plan.ts` | ~50 |
| NEW | `FORK_DIVERGENCE.md` | ~50 |
| MODIFY | `sdk/src/impl/model-provider.ts` | +80, gate Path B |
| MODIFY | `sdk/src/impl/database.ts` | +150 (stub all the things) |
| MODIFY | `sdk/src/impl/agent-runtime.ts` | minor (wire profile lookup if needed) |
| MODIFY | `cli/src/utils/auth.ts` | +30 (synthetic local creds) |
| MODIFY | `cli/src/utils/constants.ts` | +/-10 (agent-mode mapping) |
| MODIFY | `cli/src/data/slash-commands.ts` | +30 (register `/providers*`) |
| MODIFY | `cli/src/hooks/use-send-message.ts` | small (no behavior change if Path B gated) |
| MODIFY | `cli/src/hooks/use-gravity-ad.ts` | strip |
| MODIFY | `cli/src/hooks/use-usage-query.ts` | strip |
| MODIFY | `common/src/env-schema.ts` | -1 line (make NEXT_PUBLIC_CODEBUFF_APP_URL optional) |
| MODIFY | `common/src/constants/model-config.ts` | +10 (gate whitelist on BYOK) |
| MODIFY | `cli/release/index.js` | rewire packageName + download URL (Phase 6) |
| MODIFY | `cli/release/package.json` | bump to 0.1.0 (Phase 6) |
| TOTAL | ~24 files | ~1570 LOC, mostly NEW; surgical MODIFYs |

---

## Done definition (per phase)

### Phase 1 done
- [ ] `providers.ts` exports profile CRUD + active-profile resolver
- [ ] Profile file written to `~/.config/manicode/providers.json` with 0600 perms
- [ ] `providers-models.ts` exports `MODEL_CATALOG`, `fetchModelsFromEndpoint`, `getModelsForPreset` with 24h disk cache
- [ ] Unit tests cover add / remove / select-active / preset-defaults / model catalog lookup / cache freshness

### Phase 2 done
- [ ] `createDirectProviderModel()` factory exists in `model-provider.ts`
- [ ] `getModelForRequest()` checks active profile first (Path C)
- [ ] With a test profile set, a manual `/mode:default` invocation sends HTTP to the profile's baseUrl (verified via network log or echo server)
- [ ] Without a profile set, behavior unchanged (Paths A and B intact)

### Phase 3 done
- [ ] `/providers`, `/providers:add`, `/providers:select`, `/providers:remove`, `/providers:test`, `/providers:refresh-models`, `/model` all functional
- [ ] Providers panel UI renders, allows add via preset, persists changes
- [ ] `/providers:add` step 4 model-picker works for all three sources: catalog (Anthropic, OpenAI, OpenCode Go), live probe (OpenRouter), free-text (custom-openai)
- [ ] `/model` runtime swap edits `profile.model` in place without re-prompting for key/baseUrl
- [ ] `/providers:test` sends minimal completion, reports success/error within 5s
- [ ] Models cache file (`models-cache.json`) created, busted by `/providers:refresh-models`

### Phase 4 done
- [ ] `.agents/mod-*.ts` exist and load when `/mode:*` invoked
- [ ] Templates use the active profile's model unless they specify one
- [ ] No reference to `base2*` remains in the CLI path

### Phase 5 done
- [ ] CLI boots with `NEXT_PUBLIC_CODEBUFF_APP_URL` unset
- [ ] No HTTP traffic to `codebuff.com` in a full agent run (verified via network log)
- [ ] `credentials.json` absence doesn't break anything
- [ ] `/login` shows the BYOK-mode message
- [ ] Ads and usage hooks render no-ops or BYOK placeholders

### Phase 6 done
- [ ] `codebuff-mod@0.1.0` published to npm with own binary artifacts
- [ ] Fresh machine: `npm i -g codebuff-mod && cbm` → setup wizard → `/providers:add` → working agent run
- [ ] No upstream binary fetched at any point

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Agent runtime has hidden backend-specific assumptions (e.g. expects codebuff-shaped envelope from `promptAiSdkStream`) | Medium | Phase 2 is the canary — if this exists, surfaces here. Re-scope before destructive phases. |
| Local `.agents/` template format diverges from server-fetched template format | Low-Medium | Upstream `docs/agents-and-tools.md` documents the dynamic template schema; conform to it. |
| OpenTUI's React renderer can't do what Ink does for the providers panel | Low | Codebuff already has complex panels (usage, ads, agent selector). Mirror those patterns. |
| Anthropic SDK's `createAnthropic` doesn't accept arbitrary `baseURL` | Low | Confirmed in `@ai-sdk/anthropic` docs; `baseURL` is supported. |
| User's existing `~/.config/manicode/credentials.json` collides with new providers.json | Low | Different filename. No collision. |
| Phase 5 SDK strip breaks external SDK consumers | Medium | Gate Path B removal behind opt-in env flag. Default = BYOK. SDK consumers can set `CODEBUFF_USE_BACKEND=1` to retain old behavior. |
| Pricing-aware billing code path crashes when stripped | Low | All BigQuery/Stripe calls live in `web/` (server) or `sdk/src/impl/database.ts` (which gets stubbed). No client-side billing logic to break. |

---

## What this plan does NOT do (explicit non-goals)

1. **Does not self-host the backend.** That was the earlier alternative path (D1.a). This plan rips backend instead.
2. **Does not preserve codebuff.com compatibility.** You're a hard fork after this. Upstream syncs are merge-and-resolve, not drop-in.
3. **Does not add OAuth providers in v1.** Antigravity/Copilot/etc. defer to v2.
4. **Does not rewrite the TUI framework.** OpenTUI stays. Just new panels.
5. **Does not change the agent template DSL.** Local templates use the same schema as upstream's `.agents/` and `agents/`.
