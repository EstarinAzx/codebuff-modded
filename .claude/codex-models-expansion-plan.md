# Codex Model Catalog Expansion — Implementation Plan

**Target:** `codebuff-mod` fork @ `D:\.claude\claude projects\codebuff` (branch `modded`)
**Depends on:** `.claude/codex-models-fix-plan.md` already merged (catalog now derived from `OPENROUTER_TO_OPENAI_MODEL_MAP`).
**Scope:** Single-file edit. Add 12 entries to one map literal.
**Ship vehicle:** bundle into `1.0.0` (or `1.0.1` if 1.0.0 already shipped).

---

## Problem

After the fix-plan landed, `/model` on a codex profile lists 10 ids — the existing `OPENROUTER_TO_OPENAI_MODEL_MAP` entries. User reports `gpt-5.5` (current strongest reasoning model on Codex backend) and other known-routable ids are missing from the picker.

Known-routable ids against `chatgpt.com/backend-api/codex/responses` that the fork does NOT currently expose:

```
gpt-5.5
gpt-5.4-mini
gpt-5.3-codex-spark
gpt-5.1-codex-max
gpt-5.1-codex-mini
gpt-5-mini
o4-mini
o3
gpt-4.1
gpt-4.1-mini
codexspark
codexplan
```

## Root cause

`OPENROUTER_TO_OPENAI_MODEL_MAP` in `common/src/constants/chatgpt-oauth.ts` is the single source of truth for both:
- the OAuth allowlist (`isChatGptOAuthModelAllowed`)
- the codex picker catalog (`MODEL_CATALOG.codex = Object.keys(map)` after the fix-plan)

Adding a key auto-propagates to both. Missing keys = invisible in picker.

## Why no other validation will fight us

Audited before writing this plan:

1. **`ALLOWED_MODEL_PREFIXES`** (`common/src/constants/model-config.ts:4-10`) — only checks prefix (`openai|anthropic|google|x-ai|deepseek`). All new ids `openai/`-prefixed → pass.
2. **`isExplicitlyDefinedModel`** (`model-config.ts:156`, via `common/src/util/model-utils.ts`) — only gates `supportsCacheControl`. Line 150 short-circuits any `openai/`-prefixed id to `true` BEFORE the explicit check fires.
3. **Path C codex dispatch** (`sdk/src/impl/model-provider.ts:268-291`) — when `profile.oauthProfileId` is set, passes the resolved model string straight to `createOpenAIOAuthModel` with NO call to `isChatGptOAuthModelAllowed`. The allowlist gates the GLOBAL ChatGPT OAuth path (lines 295-326, for non-BYOK users only) — BYOK codex profiles skip it.

Net: no code-side validation will reject a new id. Only the backend itself can reject (4xx at request time), which the existing dispatch error path surfaces cleanly.

## Solution

Single edit to `common/src/constants/chatgpt-oauth.ts` lines 31-44. Replace the existing map literal with the expanded one. Order intentionally: newest/strongest first so they top the `/model` picker.

```ts
export const OPENROUTER_TO_OPENAI_MODEL_MAP: Record<string, string> = {
  // GPT-5.5 — latest, strongest reasoning (top of picker)
  'openai/gpt-5.5': 'gpt-5.5',

  // GPT-5.4 family
  'openai/gpt-5.4': 'gpt-5.4',
  'openai/gpt-5.4-codex': 'gpt-5.4-codex',
  'openai/gpt-5.4-mini': 'gpt-5.4-mini',

  // GPT-5.3 family
  'openai/gpt-5.3': 'gpt-5.3',
  'openai/gpt-5.3-codex': 'gpt-5.3-codex',
  'openai/gpt-5.3-codex-spark': 'gpt-5.3-codex-spark',

  // GPT-5.2 family
  'openai/gpt-5.2': 'gpt-5.2',
  'openai/gpt-5.2-codex': 'gpt-5.2-codex',

  // GPT-5.1 family
  'openai/gpt-5.1': 'gpt-5.1',
  'openai/gpt-5.1-chat': 'gpt-5.1-chat',
  'openai/gpt-5.1-codex-max': 'gpt-5.1-codex-max',
  'openai/gpt-5.1-codex-mini': 'gpt-5.1-codex-mini',

  // GPT-5 mini
  'openai/gpt-5-mini': 'gpt-5-mini',

  // O-series reasoning
  'openai/o4-mini': 'o4-mini',
  'openai/o3': 'o3',

  // GPT-4.1 fallback
  'openai/gpt-4.1': 'gpt-4.1',
  'openai/gpt-4.1-mini': 'gpt-4.1-mini',

  // GPT-4o (legacy stable)
  'openai/gpt-4o-2024-11-20': 'gpt-4o-2024-11-20',
  'openai/gpt-4o-mini-2024-07-18': 'gpt-4o-mini-2024-07-18',

  // Codex-CLI aliases — backend resolves these to specific upstream models
  'openai/codexspark': 'codexspark',
  'openai/codexplan': 'codexplan',
}
```

Total: 22 entries (up from 10). `Object.keys()` insertion order = picker display order.

## Files touched (1)

### `common/src/constants/chatgpt-oauth.ts`

- Replace lines 31-44 with the literal above. No other code touched.
- `CHATGPT_OAUTH_OPENAI_MODEL_ALLOWLIST` (line 46) auto-rederives via `Object.keys()`.
- `isChatGptOAuthModelAllowed`, `isOpenAIProviderModel`, `getChatGptOAuthModelForRouting` — all auto-pick-up new entries.
- `MODEL_CATALOG.codex` in `cli/src/utils/providers-models.ts` auto-pick-up via the existing `Object.keys(OPENROUTER_TO_OPENAI_MODEL_MAP)` expression.

## What is intentionally NOT changed

- `cli/src/utils/providers-models.ts` — already correct from fix-plan. No edit.
- `sdk/src/impl/model-provider.ts` — Path C dispatch already pipes the model string through unchanged.
- Tests under `sdk/src/impl/__tests__/llm-chatgpt-oauth-policy.test.ts` and `model-provider-byok.test.ts` — they fixture on `gpt-5.4` / existing ids; adding new keys to the map doesn't break them. Re-run to confirm.

## Caveats addressed in this plan

1. **Aliases `codexspark` / `codexplan` may not route.** These are Codex-CLI command aliases that the backend resolves to specific upstream model ids. Fork's request builder passes them straight through; backend behavior unverified for the OAuth-bearer path specifically. **Mitigation:** include them in this expansion, manually test post-build (smoke step 4). If either 4xx's, remove its two lines in a follow-up patch — no other code change needed.

2. **Ordering.** Newest first (GPT-5.5 → 4o-mini). User scrolls past the strongest models first. Reorder freely — no functional impact, only picker UX.

3. **Ship vehicle.** Bundle with 1.0.0 if not yet released. Otherwise patch as 1.0.1.

## Verification

### Typecheck
```
bun run --filter='@codebuff/cli' --filter='@codebuff/sdk' typecheck
```
Must pass clean. Pure literal expansion — no type changes possible.

### Test suite
```
bun run --filter='@codebuff/sdk' test
```
Pre-existing 14 failures from 0.1.10 baseline expected. No new failures expected.

### Manual smoke (after build)
1. `bun dev`
2. `/model` on codex profile — must print 22 entries with `openai/gpt-5.5` at top, no error.
3. `/model openai/gpt-5.5` — must set without error.
4. Send prompt → confirm 200 OK from `chatgpt.com/backend-api/codex/responses`.
5. Repeat step 3-4 for `openai/codexspark` and `openai/codexplan` to verify alias routing. If either 4xx's, note id and remove in follow-up.
6. Repeat for at least one o-series id (e.g. `openai/o4-mini`) to confirm non-gpt-5.x routing still works.

### Regression check
- `/model` on non-codex profiles unaffected (separate code path).
- Global ChatGPT OAuth flow (non-BYOK, `/connect:chatgpt` singleton) — new ids now allowlisted there too. Should be fine, but worth a `/model openai/gpt-5.5` test under that path if you have a non-codex-profile ChatGPT OAuth user to test with.

## Ship sequence

1. Stage the 1 file edit.
2. Bump `cli/package.json` + `cli/release/package.json` if not already at target version.
3. Commit. Suggested message:
   ```
   feat(chatgpt-oauth): expand model allowlist with GPT-5.5 and Codex backend ids

   Adds 12 known-routable model ids to OPENROUTER_TO_OPENAI_MODEL_MAP so
   they appear in /model picker on codex profiles and route correctly via
   the OAuth direct path. Newest models (GPT-5.5) ordered first.

   New ids: gpt-5.5, gpt-5.4-mini, gpt-5.3-codex-spark, gpt-5.1-codex-max,
   gpt-5.1-codex-mini, gpt-5-mini, o4-mini, o3, gpt-4.1, gpt-4.1-mini,
   codexspark, codexplan.
   ```
4. Build + tar + tag + GH release + npm publish per existing flow.

## Why this expansion is safe

- Pure literal addition. No new code paths, no validation logic changes, no new files.
- `Object.keys()` insertion order auto-flows to picker — single source of truth holds.
- Each new id is a fork-local additive opt-in; removal is also a one-line revert.
- Backend rejection (if any id is wrong) surfaces via existing error path, never crashes the agent loop.

## Out of scope

- Removing existing ids (4o-2024-11-20, 4o-mini-2024-07-18) — keep for backward compat with profiles already pinned to them.
- Mapping codex-only aliases differently from the rest (the `Record<string, string>` identity-maps OpenRouter-style keys to their stripped form; that's enough).
- Reordering the picker by user preference at runtime (would require separate sort logic — defer).
