# Merge Strategy — upstream → main → modded

How to safely pull upstream Codebuff changes into this fork without breaking the BYOK rip on `modded`.

> Read this BEFORE running `git merge` or `git pull` against upstream. The fork has hot conflict zones and a documented resolution map below.

---

## Branch topology

```
CodebuffAI/codebuff  (upstream, public)
        │
        │  git fetch upstream
        ▼
   main  ──────────► origin/main          ← clean mirror of upstream
        │            (EstarinAzx/codebuff)
        │
        │  git merge main
        ▼
   modded ─────────► origin/modded         ← fork-local, published as codebuff-mod
                     (EstarinAzx/codebuff)
```

- **`main`** is a passive mirror of upstream `CodebuffAI/codebuff:main`. Never commit fork-local work here. Its only job is to stage the latest upstream tip before merging into `modded`.
- **`modded`** is where every fork-local commit lives. This is the branch published to npm as `codebuff-mod` and tagged for GitHub Releases.
- One-way flow: `upstream/main` → `origin/main` → `modded`. Never push `modded` commits back into `main`.

---

## One-time setup — add the upstream remote

The repo currently only has `origin` (the fork). Add upstream:

```bash
git remote add upstream https://github.com/CodebuffAI/codebuff.git
git fetch upstream
git remote -v
# expected:
# origin    https://github.com/EstarinAzx/codebuff.git (fetch/push)
# upstream  https://github.com/CodebuffAI/codebuff.git (fetch/push)
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
# bump cli/package.json version, then:
git tag v0.X.Y && git push origin v0.X.Y
gh release create v0.X.Y --repo EstarinAzx/codebuff dist-binaries/*.tar.gz
cd cli/release && npm publish
```

---

## Conflict map

Every file below has a known reason to conflict on upstream merges. Resolution rule is per file — do not freelance.

### HIGH conflict risk

#### `web/src/app/api/v1/chat/completions/_post.ts`

The chat-completions dispatch is a **two-parallel-ladder chained ternary** (one for streaming, one for non-streaming). The fork adds `useOpencodeGo` to both ladders. Any upstream provider addition collides at the slot where fork places `opencode-go`.

**Resolve:** keep both upstream's new provider AND fork's `opencode-go` branch. Make sure the `&&` guard chain is threaded through all subsequent providers in BOTH ladders. See [.context/gotchas.md](./.context/gotchas.md) "LLM provider dispatch is a chained ternary."

Sanity check after resolve:
```bash
grep -n "useOpencodeGo\|useOpencodeZen" web/src/app/api/v1/chat/completions/_post.ts
# both should appear exactly 4 times: 2 declarations + 2 ladder slots (stream + non-stream)
```

#### `cli/src/hooks/use-connection-status.ts`
#### `cli/src/hooks/use-gravity-ad.ts`
#### `cli/src/hooks/use-agent-validation.ts`
#### `cli/src/hooks/use-auth-query.ts`
#### `cli/src/hooks/use-usage-query.ts`

Each hook computes a module-level `BYOK_AT_BOOT` flag and early-returns when set. If upstream rewrites the hook body, the early-return wrapper may end up in the wrong place after auto-merge.

**Resolve:** apply upstream's new hook logic, then re-wrap the entire body with the `BYOK_AT_BOOT` guard at the top. The guard MUST be module-level (not per-render) — see [.context/decisions.md](./.context/decisions.md) "Module-level `BYOK_AT_BOOT` flag in React hooks" for why.

Pattern to preserve (paraphrased):
```ts
const BYOK_AT_BOOT = hasBYOKProfileAtModuleLoad();

export function useXyz() {
  if (BYOK_AT_BOOT) return SAFE_DEFAULT;
  // ... upstream hook body ...
}
```

### MEDIUM conflict risk

#### `sdk/src/impl/model-provider.ts`

Fork adds **Path C** (BYOK direct provider) ahead of upstream's Path A (ChatGPT OAuth) and Path B (Codebuff backend). The dispatch order matters — Path C must run first when `activeByokProfile !== null`.

**Resolve:** if upstream restructured the path dispatch, keep Path C resolution at the top:
```ts
if (activeByokProfile) {
  const profileForRequest =
    byokAgentBindings[params.agentId ?? ''] ?? activeByokProfile;
  return createDirectProviderModel(profileForRequest, params);
}
// ... upstream Path A / Path B logic ...
```

Also preserve exports: `setActiveByokProfile`, `getActiveByokProfile`, `setByokAgentBindings`, `getByokAgentBindings`, `BYOKProfile`.

#### `sdk/src/impl/llm.ts`

Fork threads `agentId` through 3 call sites into `ModelRequestParams`. If upstream changes the params interface or adds new fields, the `agentId?` field must survive.

**Resolve:** ensure `agentId` is still passed into `getModelForRequest(...)`. Grep for the 3 call sites:
```bash
grep -n "agentId" sdk/src/impl/llm.ts
# expect 3+ hits passing it through
```

#### `sdk/src/impl/database.ts`

Fork adds `shouldSkipBackend()` gate. If upstream changes `getUserInfoFromApiKey` or `startAgentRun` signatures, the gate must still short-circuit when BYOK is active **and** `CODEBUFF_USE_BACKEND !== '1'`.

**Resolve:** keep the gate at the entry of each backend-touching function. Do NOT remove Path B — external SDK consumers may still set `CODEBUFF_USE_BACKEND=1` and expect upstream behavior.

#### `cli/src/init/init-app.ts`

Fork calls `setActiveByokProfile()` + `setByokAgentBindings()` at boot. If upstream restructures `init-app.ts` (e.g. async ordering), the boot push must still happen **before** the first agent spawn.

**Resolve:** keep BYOK boot calls early in the init sequence. After upstream's auth/config load, before the SDK takes any request.

### LOW conflict risk

#### `packages/agent-runtime/src/run-agent-step.ts`

Fork adds a 17-line UUID synthesis block at line ~685 to handle null `startAgentRun()` return.

**Resolve:** keep the synthesis. If upstream renames `startAgentRun` or changes its return type, adapt the null-check accordingly. The synthesized id format is `byok-<agentTemplate.id>-<uuid>` — preserve that prefix so logs are greppable.

**Do NOT** revert to `?? ''` empty-string coercion. See [.context/gotchas.md](./.context/gotchas.md) "BYOK runId must be truthy, not just non-null."

#### `cli/scripts/prebuild-agents.ts`

Fork adds a scan block for `.agents/mod-*.ts` so BYOK templates ship inside the binary.

**Resolve:** keep the `mod-*` scan. If upstream rewrites the agent bundling system, port the `mod-*` glob into the new architecture. See [.context/gotchas.md](./.context/gotchas.md) "`prebuild-agents.ts` bundles `agents/` plus `.agents/mod-*.ts`."

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

- `.agents/mod-default.ts`, `mod-lite.ts`, `mod-max.ts`, `mod-plan.ts`
- `cli/src/commands/providers.ts`
- `cli/src/utils/providers.ts`, `providers-models.ts`
- `cli/src/utils/__tests__/providers*.test.ts`
- `sdk/src/impl/__tests__/database-byok-skip.test.ts`
- `sdk/src/impl/__tests__/model-provider-byok.test.ts`
- `web/src/llm-api/opencode-go.ts`
- `.context/**`
- `.claude/byok-rip-implementation-plan.md`
- `.claude/opencode-go-implementation-plan.md`
- `MERGE-STRATEGY.md` (this file)

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
| BYOK skip gate | `grep -n "shouldSkipBackend" sdk/src/impl/database.ts` | gate function present, called at backend entries |
| Path C resolution | `grep -n "byokAgentBindings\[" sdk/src/impl/model-provider.ts` | per-agent lookup intact |
| RunId synthesis | `grep -n "byok-" packages/agent-runtime/src/run-agent-step.ts` | UUID synth still in place |
| BYOK_AT_BOOT gates | `grep -rn "BYOK_AT_BOOT" cli/src/hooks/` | 5 hooks still gated |
| `/providers` commands | `grep -n "providers:" cli/src/commands/command-registry.ts` | all 8 registered |
| mod-* prebuild | `grep -n "mod-" cli/scripts/prebuild-agents.ts` | scan block present |
| Smoke test | `cbm` → `/providers:list` → run a small prompt | binds + responds |

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
