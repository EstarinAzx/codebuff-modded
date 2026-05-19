# Codex `/model` Probe Fix — Implementation Plan

**Target:** `codebuff-mod` fork @ `D:\.claude\claude projects\codebuff` (branch `modded`)
**Scope:** ~40 LOC net delete + 1 array literal. Single feature: fix the broken Codex `/model` listing.
**Ship vehicle:** patch bump → `1.0.0`.

---

## Problem

After 0.2.1 codex preset shipped, running `/model` on an active codex profile prints:

```
Current model: openai/gpt-5.1
Could not probe /models: Codex /models probe returned unexpected shape
Swap directly: /model <id>
```

User can swap blind, but the catalog is invisible. Bad UX; user can't discover what ids are routable.

## Root cause

`cli/src/utils/providers-models.ts:214-244` — `fetchCodexModelsFromEndpoint()` calls `https://chatgpt.com/backend-api/models` with OAuth bearer and expects OpenAI-compat envelope `{ data: [{ id: string }] }`. The endpoint either:

1. 404s (most likely — there is no documented `/models` route under `chatgpt.com/backend-api`).
2. Returns a non-OpenAI envelope (different field names).
3. Returns an HTML error page that JSON-parses opaquely.

Codex CLI (the upstream Rust binary that owns this OAuth surface) **does not query a `/models` endpoint at runtime**. It ships a fixed catalog baked into the binary. The ChatGPT OAuth bearer is scoped to `chatgpt.com/backend-api/codex/responses` (the chat surface) only — there is no `/models` listing route exposed to that token.

Our 0.2.1 design call (`.context/gotchas.md` line 19-20) anticipated this risk and chose "no fallback list, user types blind." Real-world UX confirms that was the wrong call. Fix: ship a fixed catalog like Codex CLI does.

## Solution

Mirror the Codex-CLI pattern. Replace the live probe with a hardcoded catalog scoped to the ChatGPT OAuth backend's routable model ids.

The fork already maintains the authoritative allowlist at `common/src/constants/chatgpt-oauth.ts:31-44` — `OPENROUTER_TO_OPENAI_MODEL_MAP`. Its keys are exactly the OpenRouter-style ids that route correctly through the OAuth dispatch. We reuse those keys (after stripping the `openai/` prefix) as the codex catalog so the catalog **cannot drift from the allowlist**.

Current allowlist keys (`openai/`-prefixed):
```
openai/gpt-5.4
openai/gpt-5.4-codex
openai/gpt-5.3
openai/gpt-5.3-codex
openai/gpt-5.2
openai/gpt-5.2-codex
openai/gpt-5.1
openai/gpt-5.1-chat
openai/gpt-4o-2024-11-20
openai/gpt-4o-mini-2024-07-18
```

These are what gets exposed to the user via `/model` on a codex profile. When the user picks one, the existing dispatch in `sdk/src/impl/model-provider.ts` (Path C OAuth branch) handles the routing.

## Files touched (4)

### 1. `cli/src/utils/providers-models.ts`

**Delete** `fetchCodexModelsFromEndpoint` entirely (lines ~209-244 — the whole exported function plus its doc block).

**Delete** these imports (lines 17-18) — they are only used by the deleted function:
```ts
import { CHATGPT_BACKEND_BASE_URL } from '@codebuff/common/constants/chatgpt-oauth'
import { getValidCodexCredentials } from '@codebuff/sdk'
```

**Add** import for the allowlist (top of file, with other `@codebuff/common` imports):
```ts
import { OPENROUTER_TO_OPENAI_MODEL_MAP } from '@codebuff/common/constants/chatgpt-oauth'
```

**Replace** `codex: []` entry inside `MODEL_CATALOG` (currently around line 48) with a derived list:
```ts
// Codex backend uses fixed catalog (Codex CLI pattern). Source of truth is
// the OAuth allowlist so catalog and routing can never drift apart.
codex: Object.keys(OPENROUTER_TO_OPENAI_MODEL_MAP),
```

**Update** the comment above the codex line (currently "Empty + special-cased → OAuth probe against ChatGPT backend") to:
```ts
// Codex: fixed catalog derived from the OAuth allowlist — no live probe.
```

After these edits the catalog branch in `getModelsForPreset()` (`if (catalog.length > 0) return { source: 'catalog', models: catalog }`) handles codex without any further changes. No new code path; codex just rejoins the catalog flow alongside `openai`, `anthropic`, etc.

### 2. `cli/src/commands/providers.ts`

**Delete** the `fetchCodexModelsFromEndpoint` import (currently around line 36).

**Simplify** the codex branch inside `handleModelCommand()` (currently around lines 397-426). Replace the ternary call between `fetchCodexModelsFromEndpoint` and `fetchModelsFromEndpoint` plus the codex-specific `probeSrc` label with a single `getModelsForPreset()` call so codex flows through the same catalog/cache path as every other preset.

Sketch:
```ts
const { source, models } = await getModelsForPreset({
  preset: profile.preset,
  baseUrl: profile.baseUrl,
  apiKey: profile.apiKey,
})
const head = models.slice(0, 20)
const tail = models.length > 20 ? `\n  …(${models.length - 20} more)` : ''
const sourceLabel = {
  catalog: 'curated catalog',
  probe: `live ${profile.baseUrl}/models`,
  cache: `cached ${profile.baseUrl}/models`,
  freetext: 'free-text (no list available)',
}[source]
return [
  `Current model: ${profile.model || '<unset>'}`,
  '',
  `Available (${sourceLabel}):`,
  ...head.map((m) => `  ${m}`),
].join('\n') + tail + '\n\nSwap: /model <id>'
```

If `getModelsForPreset` is not already imported in this file, add it to the `providers-models` import line.

Verify the catch/error path (`Could not probe /models: …`) still makes sense — for codex it should no longer fire because `MODEL_CATALOG.codex` is non-empty so the catalog branch returns synchronously without network I/O.

### 3. `.context/gotchas.md`

Replace the "Codex `/model` may not list anything" section (currently around lines 19-20) with the new behavior:

```markdown
## Codex `/model` ships a fixed catalog

`/model` on a codex profile lists `Object.keys(OPENROUTER_TO_OPENAI_MODEL_MAP)`
straight from the catalog — no network probe. The OAuth bearer cannot list
models against `chatgpt.com/backend-api/models` (no such route is exposed
to that token); Codex CLI itself ships a fixed catalog baked into the binary
for the same reason. If you add an id to `OPENROUTER_TO_OPENAI_MODEL_MAP`
in `common/src/constants/chatgpt-oauth.ts`, it automatically appears in
`/model` listings — no second edit needed.
```

### 4. `.context/active-work.md`

Bump `ship:` frontmatter to `0.2.2`. Add a "Current focus" entry for the fix.
Move the codex-probe open question from "Open questions" to "Recently shipped — 0.2.2"
once the build is out. Drop the "endpoint may not exist" item — it is now answered
(it doesn't) and resolved (fixed catalog).

## What is intentionally NOT changed

- `sdk/src/codex-credentials.ts` — token CRUD untouched, OAuth flow untouched.
- `cli/src/utils/chatgpt-oauth.ts` — `connectCodexOAuthForProfile` / `disconnectCodexProfileOAuth` untouched.
- `sdk/src/impl/model-provider.ts` — Path C OAuth dispatch untouched, still resolves via `getValidCodexCredentials` per request.
- `OPENROUTER_TO_OPENAI_MODEL_MAP` — keys preserved verbatim (do not add/remove ids in this fix; that is a separate change).
- Cache layer (`readCachedModels`, `writeCachedModels`, `clearCachedModels`) — untouched. The catalog branch short-circuits before cache logic so codex never writes or reads the cache. Other presets are unaffected.

If a future minor wants to expose codex-only ids that should NOT be selectable for other OpenAI surfaces, decouple the catalog at that point — for now the 1:1 mapping is the feature, not a constraint.

## Verification

### Typecheck
```
bun run --filter='@codebuff/cli' --filter='@codebuff/sdk' typecheck
```
Must pass clean. The deletions remove unused references (`CHATGPT_BACKEND_BASE_URL`, `getValidCodexCredentials` import in `providers-models.ts`); if any other file in the cli/sdk graph imported them via the deleted re-export, lift the import directly from their source modules.

### Manual smoke (after build)
1. `bun dev`
2. Confirm at least one codex profile exists (`/providers` lists it).
3. `/model` on the codex profile — must print the 10-entry catalog under "Available (curated catalog):" with no error line.
4. `/model openai/gpt-5.4` — must set active model without error.
5. Send any prompt — must route through OAuth dispatch and respond.
6. `/model nonexistent-id` — must still set (no allowlist check in this command path); subsequent request will fail at dispatch as expected. Out of scope for this fix.

### Regression check
- `/model` on a non-codex profile (e.g. `openrouter` if user has one) must still trigger live probe behavior (`source: 'probe'` or `'cache'`).
- `/model` on `custom-openai` must still return `'freetext'` source.

## Ship sequence

1. Stage the 4 file edits.
2. Bump `cli/package.json` + `cli/release/package.json` → `0.2.2`.
3. Commit. Suggested message:
   ```
   fix(cli): codex /model lists fixed catalog instead of broken probe — bump 0.2.2

   The chatgpt.com/backend-api/models endpoint that 0.2.1 tried to probe
   does not exist for OAuth-bearer tokens (Codex CLI itself ships a fixed
   catalog for the same reason). Replace the probe with a derived list
   from OPENROUTER_TO_OPENAI_MODEL_MAP so catalog and OAuth allowlist
   stay locked together.
   ```
4. Build binaries per existing flow (`bun run build:binary` from native and the Linux junction).
5. Tar + tag + GH release + npm publish per `byok-rip-implementation-plan.md` Phase 6.

## Why this fix is safe

- Pure delete + catalog literal. No new code paths, no new state, no new imports beyond one allowlist constant the fork already exports.
- Cache layer untouched — other presets unaffected.
- OAuth flow untouched — multi-account profiles still work.
- Path C dispatch untouched — model routing identical.
- Catalog single source of truth — adding/removing ids in the OAuth allowlist now automatically updates the user-visible picker. Prevents the class of bug where allowlist and picker drift.

## Out of scope (mention only if user asks)

- Adding new ids to `OPENROUTER_TO_OPENAI_MODEL_MAP` (e.g. `gpt-5.5`, `gpt-5-mini`, `o3`, `o4-mini`). Those ids would route correctly through OAuth dispatch but are not currently in the allowlist; verify with a manual test request before adding.
- A `/providers:refresh-models` no-op for codex (since there is no cache). Acceptable to ignore — the command already short-circuits cleanly on empty cache entries.
- Removing `fetchCodexModelsFromEndpoint` from any test fixtures. If a test imports it, delete those tests in the same commit; if no test does, no action needed. `grep -r fetchCodexModelsFromEndpoint cli/ sdk/` before committing to confirm.
