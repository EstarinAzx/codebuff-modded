# OpenCode Go Provider — Implementation Plan for Codebuff Fork

**Target repo:** `D:\.claude\claude projects\codebuff` (Codebuff — TypeScript/Bun monorepo, Next.js backend + CLI)
**Goal:** Add OpenCode Go (`https://opencode.ai/zen/go/v1`) as a routable upstream provider, billable per-token, without diverging from upstream Codebuff in ways that make future syncs painful.
**Strategy:** Path B — clone, not extend. Create a new sibling file `opencode-go.ts` rather than editing the existing `opencode-zen.ts`. Justification: minimizes merge conflicts on upstream sync; trivial to retire if upstream adds Go themselves.

---

## Architectural context (read before coding)

Codebuff is a **hosted backend that proxies user requests to upstream LLM providers** and bills the user in credits via BigQuery + Stripe. This is structurally different from a BYOK CLI:

- **API keys live in server env**, not user config. `OPENCODE_API_KEY` is one shared key for all Codebuff users hitting the OpenCode endpoint.
- **No client-side picker work.** User sends a model id like `opencode-go/glm-5` in the request body; the server's dispatch switch routes it to the right handler.
- **Pricing is mandatory.** Every routable model needs `inputCostPerToken / cachedInputCostPerToken / outputCostPerToken`. The handler computes cost and bills credits at finalization. If pricing is missing, `getOpenCodeZenPricing()` throws → 500 to client.
- **Streaming + non-streaming handlers are separate.** Both must work or `/v1/chat/completions` will half-fail.

Reference: existing OpenCode Zen wiring already does all of this — your Go lane mirrors it.

---

## Existing pieces you do NOT need to invent

| Piece | Location | Reuse plan |
|---|---|---|
| `OPENCODE_API_KEY` env var (server-side, optional) | `packages/internal/src/env-schema.ts:13,94` | Reuse as-is (same key serves Zen and Go) — unless opencode.ai issues separate keys per endpoint, in which case add `OPENCODE_GO_API_KEY` |
| Model id catalog convention | `common/src/constants/model-config.ts:56-61` (`openCodeZenModels`) | Add a parallel `openCodeGoModels` const block |
| Streaming + billing handler shape | `web/src/llm-api/opencode-zen.ts` (802 LOC) | Copy this file → `opencode-go.ts`, rename symbols, swap base URL |
| Dispatch switch | `web/src/app/api/v1/chat/completions/_post.ts:617-660` | Add one branch in the ternary ladder (append last to minimize merge churn) |
| Prefix detector pattern | `opencode-zen.ts:61` (`isOpenCodeZenModel`) | Mirror as `isOpenCodeGoModel` checking `'opencode-go/'` prefix |
| Pricing map pattern | `opencode-zen.ts:37-57` (`OPENCODE_ZEN_MODELS`) | Mirror as `OPENCODE_GO_MODELS` with Go pricing |

---

## Files to create / modify

### 1. NEW — `web/src/llm-api/opencode-go.ts`

**What:** Full sibling of `opencode-zen.ts`, ~800 LOC.

**Step-by-step:**

1. Copy `web/src/llm-api/opencode-zen.ts` → `web/src/llm-api/opencode-go.ts`.
2. Add at the very top of the new file:
   ```ts
   // PORT: mirrors opencode-zen.ts as of upstream <SHA AT TIME OF FORK>
   // When upstream Zen handler gets a bug fix or feature, replay the same
   // change here unless you know it's Zen-specific. Diff this file against
   // opencode-zen.ts periodically.
   ```
3. Rename the constants:
   ```ts
   const OPENCODE_ZEN_BASE_URL = 'https://opencode.ai/zen/v1'
   // becomes:
   const OPENCODE_GO_BASE_URL = 'https://opencode.ai/zen/go/v1'

   const OPENCODE_ZEN_HEADERS_TIMEOUT_MS = 30 * 60 * 1000
   // becomes:
   const OPENCODE_GO_HEADERS_TIMEOUT_MS = 30 * 60 * 1000

   const opencodeZenAgent = new Agent({...})
   // becomes:
   const opencodeGoAgent = new Agent({...})
   ```
4. Rename `OPENCODE_ZEN_MODELS` map → `OPENCODE_GO_MODELS`. Replace contents with Go's catalog (see step §2 below for the catalog keys). Each entry needs `opencodeId` (the upstream-facing model string) + `pricing` (input/cachedInput/output cost per token). **Pricing values come from opencode.ai/zen/go pricing sheet — confirm before shipping or billing breaks.**
5. Rename the prefix:
   ```ts
   const OPENCODE_ZEN_MODEL_PREFIX = 'opencode/'
   // becomes:
   const OPENCODE_GO_MODEL_PREFIX = 'opencode-go/'
   ```
6. Rename ALL exported functions and the error class (project-wide search & replace within this file only):
   - `isOpenCodeZenModel` → `isOpenCodeGoModel`
   - `getOpenCodeZenModelId` → `getOpenCodeGoModelId`
   - `getOpenCodeZenPricing` → `getOpenCodeGoPricing`
   - `getOpenCodeZenApiKey` → `getOpenCodeGoApiKey` (still reads `env.OPENCODE_API_KEY` unless step §3 below adds a separate key)
   - `createOpenCodeZenRequest` → `createOpenCodeGoRequest`
   - `normalizeOpenCodeZenMessages` → `normalizeOpenCodeGoMessages`
   - `normalizeOpenCodeZenContent` → `normalizeOpenCodeGoContent`
   - `normalizeOpenCodeZenTool` → `normalizeOpenCodeGoTool`
   - `handleOpenCodeZenNonStream` → `handleOpenCodeGoNonStream`
   - `handleOpenCodeZenStream` → `handleOpenCodeGoStream`
   - `parseOpenCodeZenError` → `parseOpenCodeGoError`
   - `OpenCodeZenError` class → `OpenCodeGoError`
7. In the response-tagging spots, swap the provider label:
   ```ts
   if (!data.provider) data.provider = 'OpenCode Zen'
   // becomes:
   if (!data.provider) data.provider = 'OpenCode Go'
   ```
   Two locations: non-stream handler and `handleLine`.
8. Update the import in step §2 below to point at `openCodeGoModels`.

**Validation after this file:** TypeScript should compile clean. No runtime path has been wired yet — file is dead code until step §3.

---

### 2. MODIFY — `common/src/constants/model-config.ts`

**What:** Append a new `openCodeGoModels` const next to `openCodeZenModels`.

**Where:** Right after the `openCodeZenModels` block at line 56-61.

**How:**

```ts
export const openCodeGoModels = {
  opencode_go_glm_5: 'opencode-go/glm-5',
  // Add more Go models here as opencode.ai/zen/go publishes them.
  // Keep the `opencode-go/` prefix on every entry — the dispatch switch
  // routes by prefix.
} as const
export type OpenCodeGoModel =
  (typeof openCodeGoModels)[keyof typeof openCodeGoModels]
```

**Do NOT:**
- Merge Go ids into the existing `openCodeZenModels` map. Keep them separate so future upstream edits to Zen's catalog don't conflict with Go ids.
- Add `opencode-go` to `ALLOWED_MODEL_PREFIXES` (lines 4-10) unless verification (below) shows it's actually checked for these provider lanes. Existing Zen models do not appear in that list — it appears to be for OpenRouter-shape model strings, not Codebuff's lane prefixes. **Verify before assuming.**

**Verification step (do this before §3):** Search the repo for `ALLOWED_MODEL_PREFIXES` references. If any validator path rejects unknown prefixes for the chat-completions endpoint, you must add `'opencode-go'` (and probably `'opencode'`) to that list, OR confirm those validators only run on a different code path (e.g. agent-runtime model selection, not the proxy endpoint). Grep target: `ALLOWED_MODEL_PREFIXES`. Expected: handful of references; review each.

---

### 3. MODIFY — `web/src/app/api/v1/chat/completions/_post.ts`

**What:** Add one routing branch for OpenCode Go in the streaming dispatch ladder.

**Where:** Inside the `if (bodyStream)` block at lines 615-660. Today the ladder is:

```ts
const useSiliconFlow = false
const useOpenCodeZen = isOpenCodeZenModel(typedBody.model)
const useCanopyWave = !useOpenCodeZen && isCanopyWaveModel(typedBody.model)
const useDeepSeek = !useOpenCodeZen && !useCanopyWave && isDeepSeekModel(...)
const useFireworks = ...
const useOpenAIDirect = ...
```

**How (minimize conflict surface):**

Add `useOpenCodeGo` immediately after `useOpenCodeZen` so each subsequent guard adds `!useOpenCodeGo`:

```ts
const useOpenCodeZen = isOpenCodeZenModel(typedBody.model)
const useOpenCodeGo = !useOpenCodeZen && isOpenCodeGoModel(typedBody.model)
const useCanopyWave =
  !useOpenCodeZen && !useOpenCodeGo && isCanopyWaveModel(typedBody.model)
// ...add !useOpenCodeGo to every subsequent guard in the chain
```

Then in the ternary tower at line 645-660, slot the Go branch right after Zen:

```ts
const stream = useSiliconFlow
  ? await handleSiliconFlowStream(baseArgs)
  : useOpenCodeZen
    ? await handleOpenCodeZenStream(baseArgs)
    : useOpenCodeGo
      ? await handleOpenCodeGoStream(baseArgs)
      : useCanopyWave
        ? await handleCanopyWaveStream(baseArgs)
        // ... rest unchanged
```

**Imports to add at top of file:**

```ts
import {
  isOpenCodeGoModel,
  handleOpenCodeGoStream,
  handleOpenCodeGoNonStream,
} from '@/llm-api/opencode-go'
```

(Match the path-alias style used by the existing `opencode-zen` import in this file.)

**Non-streaming path:** This file also has a non-streaming branch elsewhere (look for `handleOpenCodeZenNonStream` callers). Mirror the same routing logic for non-streaming: add `useOpenCodeGo` branch → `handleOpenCodeGoNonStream`. **Verify both paths are wired** — single-path coverage will half-break the endpoint.

**Conflict-minimization rule:** Place Go branch immediately adjacent to Zen branch in BOTH ladders (the boolean derivation block AND the ternary tower). Upstream churn typically reorders distant branches, not adjacent siblings.

---

### 4. CONDITIONAL — `packages/internal/src/env-schema.ts`

**Only if** opencode.ai issues a separate API key for the Go endpoint.

**What:** Add `OPENCODE_GO_API_KEY` alongside the existing `OPENCODE_API_KEY`.

**Where:** Two locations:
- Schema block around line 13: `OPENCODE_GO_API_KEY: z.string().min(1).optional(),`
- `serverProcessEnv` block around line 94: `OPENCODE_GO_API_KEY: process.env.OPENCODE_GO_API_KEY,`

**Then** update `getOpenCodeGoApiKey()` in `opencode-go.ts` step §1.6 to read `env.OPENCODE_GO_API_KEY` instead of `env.OPENCODE_API_KEY`.

**Default assumption:** ONE shared key (`OPENCODE_API_KEY`) serves both endpoints. Skip this file unless evidence says otherwise.

---

## Critical correctness checks (do NOT skip)

1. **Pricing values must come from a real opencode.ai pricing source.** Guess values → users get wrongly billed → trust + financial issues. Pricing fields are `inputCostPerToken`, `cachedInputCostPerToken`, `outputCostPerToken`, all in dollars-per-token (e.g. `0.3 / 1_000_000` for $0.30 per 1M tokens — see `opencode-zen.ts:42-47` for shape).

2. **Model id normalization.** `getOpenCodeGoModelId()` strips the `opencode-go/` prefix before sending upstream. For `opencode-go/glm-5` the upstream POST body must contain `"model": "glm-5"` (or whatever opencode.ai/zen/go expects). Two ways to set this:
   - Explicit: set `opencodeId: 'glm-5'` in the `OPENCODE_GO_MODELS` map entry.
   - Fallback: the `.slice(PREFIX.length)` default in `getOpenCodeGoModelId` strips the prefix and uses the rest.
   The fallback works if your catalog ids are already `opencode-go/<upstream-id>`. Prefer explicit for clarity.

3. **`ALLOWED_MODEL_PREFIXES` audit.** As noted in §2, verify whether the chat-completions endpoint runs your `opencode-go/` prefix through this allow-list. If yes, add the prefix or requests will 400 before hitting dispatch.

4. **Provider-label string.** Both `'OpenCode Zen'` defaults (non-stream handler + `handleLine`) need to flip to `'OpenCode Go'` in the new file. If you miss one, billing logs + analytics will misattribute Go traffic to Zen.

5. **Streaming + non-streaming parity.** The dispatch switch in `_post.ts` has both paths. Wire both. A wired stream + unwired non-stream is a subtle bug — most clients use streaming so it works in tests, then breaks for the non-streaming caller.

---

## How to test (manual smoke)

After implementation:

1. `bun run typecheck` from repo root → must be clean for new file + edits.
2. Set `OPENCODE_API_KEY` in your local `.env` to a valid opencode.ai key.
3. Boot the web backend: `bun run dev` in `web/`.
4. Send a streaming chat-completions request with body `{ "model": "opencode-go/glm-5", "messages": [...], "stream": true }` to `/api/v1/chat/completions`. Verify:
   - 200 status, SSE stream begins
   - Stream contains response chunks with `model: "opencode-go/glm-5"` and `provider: "OpenCode Go"`
   - On final chunk, BigQuery insert triggers and Stripe credits are consumed (check logs)
5. Same request with `"stream": false` → JSON response, same fields. Confirms non-stream path.
6. Send an `opencode/...` (Zen) request → should still route to Zen handler unchanged. Confirms you didn't break Zen.

---

## Upstream merge protocol (post-launch)

When `git pull upstream main` brings in new changes:

- **`opencode-zen.ts` changes** — diff `opencode-zen.ts` against `opencode-go.ts`. Replay any upstream Zen fix into Go unless it's Zen-specific (e.g. pricing for a Zen-only model). Update the `PORT: mirrors ... as of <SHA>` comment.
- **`_post.ts` dispatch ladder changes** — likely 3-way merge conflict if upstream reorders branches. Resolve by keeping Go branch immediately adjacent to Zen branch in both blocks (boolean derivation + ternary tower).
- **`model-config.ts` catalog changes** — additive, should auto-merge.
- **Upstream adds OpenCode Go themselves** — retire your fork:
  ```
  git rm web/src/llm-api/opencode-go.ts
  # revert your model-config.ts and _post.ts edits
  # point any consumers of `opencode-go/...` model ids at upstream's handler
  ```

---

## Out of scope (don't bundle into this PR)

- **Client-side picker UI.** Codebuff users select models by sending the model string in the request; there is no `/model`-style chooser to update.
- **CLI changes.** None needed unless a CLI-side allow-list of model prefixes exists.
- **OAuth.** OpenCode Go uses a server-side API key, not user OAuth.
- **Catalog expansion beyond `glm-5`.** Add additional Go models in follow-up PRs once base wiring is verified.

---

## File inventory summary

| Action | File | LOC delta |
|---|---|---|
| CREATE | `web/src/llm-api/opencode-go.ts` | +~800 (copy of opencode-zen.ts with renames + swapped baseUrl + Go pricing) |
| MODIFY | `common/src/constants/model-config.ts` | +~8 (new `openCodeGoModels` const + type) |
| MODIFY | `web/src/app/api/v1/chat/completions/_post.ts` | +~15 (one boolean + one ternary branch in streaming ladder + same in non-streaming ladder + imports) |
| MAYBE | `packages/internal/src/env-schema.ts` | +2-4 only if Go needs separate key |
| TOTAL | 3-4 files | ~825 LOC, mostly mechanical copy-rename |

---

## Done definition

- [ ] `opencode-go.ts` created, all `Zen` → `Go` renames applied, provider label flipped, base URL swapped, pricing map populated from real opencode.ai numbers
- [ ] `openCodeGoModels` const exported from `model-config.ts`
- [ ] Streaming dispatch in `_post.ts` routes `opencode-go/*` → `handleOpenCodeGoStream`
- [ ] Non-streaming dispatch in `_post.ts` routes `opencode-go/*` → `handleOpenCodeGoNonStream`
- [ ] `ALLOWED_MODEL_PREFIXES` audited; updated if needed
- [ ] `bun run typecheck` clean
- [ ] Manual smoke: streaming + non-streaming both return 200 with `provider: "OpenCode Go"` and trigger billing
- [ ] Zen requests still work (regression check)
- [ ] PORT comment with upstream SHA written at top of `opencode-go.ts`
