---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-06-11
tags: [context, active-work]
ship: 1.0.6 (shipped — opencode-go live model probe)
focus: upstream-sync EXECUTED on branch sync-upstream-2026-06-11 (strategy B) — awaiting review → modded ff + release
---

# Active Work

_Last updated: 2026-06-11 by Opus 4.8 (auto)_
_At commit: `modded` tip `e534b0650` (docs/context sync; v1.0.6 shipped). Working tree clean (untracked `.codeboarding/` only)._

## Current focus

**Upstream-sync EXECUTED (2026-06-11), strategy B.** The snapshot-only
upstream sync is merged + verified on branch
`sync-upstream-2026-06-11` (`74948dc99`, 98 commits ahead of `modded`).
`modded` itself is UNTOUCHED at `e534b0650` and nothing pushed —
awaiting review before fast-forwarding `modded` and cutting a release.

### What changed upstream — snapshot-only pivot

`CodebuffAI/codebuff:main` went **CLI/SDK-only public snapshot** as of
`origin/main` tip `452eb72a1` (2026-06-10). 97 squashed commits all
titled "Sync public snapshot from freebuff-private". Public tree
**halved: 2233 → 1170 files**. Whole trees excised UPSTREAM:
`web/` (540), `packages/{internal,billing,bigquery,build-tools}`
(209, incl. all 107 DB migrations), `scripts/` (62),
`agents-graveyard/` (120), upstream's `.agents/` (29), `.github/`,
`python-app/`, `evals/`. New upstream pkg: `packages/llm-providers/`
(vendored Vercel AI SDK openai-compatible — relocation of the deleted
`@codebuff/internal/openai-compatible`).

**Real merge-base = `26e593b4`** (2026-05-17, "Bump Freebuff 0.0.93").
NOT `6d3b074b2` ("Add OpenCode Go provider lane") — that is a *modded*
commit, never on main. Local `main` is stale at the merge-base; the
sync lives on `origin/main`/`upstream/main`.

### Verified merge ledger (dry-run `merge --no-commit --no-ff`, aborted)

- **6 conflicts only:**
  - `sdk/src/impl/model-provider.ts` (UU) — **real.** Upstream swapped
    import `@codebuff/internal/openai-compatible` →
    `@codebuff/llm-providers/openai-compatible`. Adopt the new import,
    keep the Path-C hook. `getModelForRequest`/`ModelRequestParams`
    shapes UNCHANGED.
  - `common/src/env-schema.ts` (UU) — **real.** Union fork BYOK vars
    with upstream's new (`SERPER_API_KEY`, MiMo/MiniMax, freebuff).
  - `cli/release/index.js`, `cli/release/package.json` (UU) — keep
    fork launcher (name+version).
  - `scripts/check-env-architecture.ts` (UD), `web/src/app/api/v1/
    chat/completions/_post.ts` (UD) — fork-modified, upstream-deleted;
    HEAD version already left in tree.
  - Auto-merged CLEAN (no conflict): `app.tsx`, `use-gravity-ad.ts`,
    `llm.ts`, `login/constants.ts`, `model-config.ts`. (`llm.ts` still
    needs the `OpenRouterProviderOptions` import re-pointed `@codebuff/
    internal/openrouter-ai-sdk` → `@codebuff/common/types/
    agent-template` since `@codebuff/internal` is gone.)
- **1,095 staged deletions** upstream wants applied: web 539,
  packages 209, agents-graveyard 120, freebuff 65, scripts 62,
  .agents 29, .github 21, python-app 12, evals 11, cli 4 (knowledge.md
  + 2 dead ad components), common 3 (knowledge.md docs).
- **Fork-critical files CONFIRMED SAFE:** `.agents/mod-*.ts` NOT in the
  deletion set; all `fork-impls/*`, `providers*.ts`,
  `codex-credentials.ts` absent upstream → pure additions, no
  shadowing.

### VALUE gained by merging (~5.3k real added lines, docs/bundles stripped)

Composio meta-tools (4), `read_url` tool, web-search Linkup→Serper,
new models MiMo (`mimo-v2.5`/`-pro`) + MiniMax M3 (`minimax/
minimax-m3`), new `cli/src/cli-args.ts` (commander) + freebuff-streak.
`chatgpt-oauth.ts` codex map UNCHANGED upstream — zero picker surprise.

### STRATEGIC FORK — RESOLVED: (B) ride the deletion

Chose **(B) BYOK-only**: accept upstream's removal of `web/` +
`packages/{internal,billing,bigquery,build-tools}` + full `scripts/`
rather than restore. Realizes the long-deferred "hard-delete
web/+freebuff backend" item. `check-env-architecture.ts` was dropped
too — verified nothing in the merged tree invokes it. See
[[decisions]] "Ride upstream's snapshot deletion to a BYOK-only fork".

### What was done on the sync branch (verified)

- 6 conflicts resolved (model-provider keep exported
  `createOpenAIOAuthModel`; env-schema keep fork lenient defaults +
  union upstream's 2 new vars; cli/release keep fork; 2 UD files
  deleted).
- `packages/llm-providers/` vendored from upstream (25 files).
- Last dead `@codebuff/internal` ref re-pointed in `byok-resolver.ts`
  → `@codebuff/llm-providers/openai-compatible` (`llm.ts`
  auto-relocated; `model-provider.ts` import auto-merged).
- `use-gravity-ad.ts` BYOK safe-default gained `recordClick` no-op
  (upstream widened `GravityAdState`).
- **Verify:** `bun install` clean (243 pkgs, no missing workspace);
  typecheck green (sdk/common/cli, after the `recordClick` fix);
  `build:binary` → `codebuff-mod.exe` win32-x64, boots `--version`
  (1.0.6) + `--help`; SDK BYOK tests 54/54; CLI providers 40 pass / 2
  **pre-existing-stale** fails (catalog test asserts old opencode-go
  populated state pre-v1.0.6; schema-version test expects v1) — both
  fork-only files the merge never touched, so merge-neutral.
- **Still pending:** full interactive BYOK provider smoke (needs a
  live API key — run `/providers:add <preset> <key>` + a small prompt
  on the new binary). Version NOT bumped (still 1.0.6) — release is a
  separate decision.

## State

- **In flight:** upstream-sync merge DONE + verified on branch
  `sync-upstream-2026-06-11` (`74948dc99`). `modded` untouched
  (`e534b0650`), nothing pushed. Next: review → ff `modded` → version
  bump + release.
- **Recently shipped — v1.0.6 (tag commit `3ce439802`):**
  - `cli/src/utils/providers-models.ts` — moved `opencode-go` out of
    the hardcoded `MODEL_CATALOG` (was `['opencode-go/glm-5']`, a
    single id) into the empty-catalog set. Empty catalog → orchestrator
    live-probes `https://opencode.ai/zen/go/v1/models`, same path as
    openrouter / together / groq. Endpoint serves 15+ ids; `/model`
    and the `/providers:add` picker now list them all (24h disk cache,
    busted by `/providers:refresh-models`).
  - Also fixes a latent prefix bug: the old catalog id carried an
    `opencode-go/` prefix, but Path C dispatch sends the model id raw
    to the endpoint, which expects bare ids (e.g. `glm-5`). Probe
    results are already raw — the fix removes the mismatch.
  - One-file logic change + two version bumps. No SDK / agent-runtime
    / hook changes.
  - Three platform tarballs at
    https://github.com/EstarinAzx/codebuff-modded/releases/tag/v1.0.6
  - npm: `codebuff-mod@1.0.6` live (`latest`), launcher 9.4 kB.
- **Previously shipped — v1.0.5 (tag commit `c20f080d9`):**
  - Two TUI rendering bug fixes. `message-block.tsx`: shrink
    `availableWidth` by 4 inside the amber AI panel (2 border + 2
    padding cols) so inner elements like `AskUserBranch` stop seeping
    past the amber box. `chat-input-bar.tsx`: always set `minHeight: 3`
    on the input content wrapper so the bordered box can't collapse and
    bleed border chars through text.
  - Bug fixes to the 0.2.0 `aiPanelBorder` work — no new decision.
- **Previously shipped — v1.0.4 (tag commit `0395ffbc3`):**
  - Todo-closure enforcement block added to `instructionsPrompt` in
    `.agents/mod-default.ts` + `.agents/mod-max.ts`.
- **Previously shipped — v1.0.3 (tag commit `e2e3efa18`):**
  - Hook-registry shim refactor — ~30 in-place fork edits → one-line
    `getForkHooks().<name>?.(...)` dispatches. See [[decisions]].
- **Branch state:**
  - `modded` → `3ce439802` (v1.0.6 release tip)
  - `modded-pre-shim` → `6048b92ba` (v1.0.2 anchor, archive)
  - Fork tags: `v1.0.0`–`v1.0.6` + `v1.0.2-pre-shim`. (The many
    `v1.0.3XX`–`v1.0.6XX` tags are upstream `CodebuffAI/codebuff`
    tags pulled by the `upstream` remote fetch — not fork releases.)
  - `upstream` remote configured against `CodebuffAI/codebuff`.
- **Binaries:**
  - `cli/bin/codebuff-mod.exe` → v1.0.6 win32-x64 build
  - `cli/bin/codebuff-mod` → v1.0.6 linux-arm64 (last cross-compile
    artifact — overwritten each linux build; not a stable "current"
    binary, just leftover from the release tar step)
  - `cli/bin/codebuff-mod.pre-shim.exe` → v1.0.2 rollback
  - `cli/dist-binaries/*.tar.gz` → the three v1.0.6 release tarballs
- **Blocked:** none.
- **Typecheck at ship:** not re-run for v1.0.6 (one-line catalog
  change, no TS surface touched). Last green run was v1.0.3 ship.
- **Test status:** modded baseline preserved (14 pre-existing
  failures unchanged; 19 BYOK tests green). No new tests for v1.0.6 —
  catalog data change, validated empirically (probed the live
  endpoint, 200 + 15 ids).
- **Smoke result for v1.0.6:** endpoint verified live during the fix
  (`https://opencode.ai/zen/go/v1/models` → 200, 15 model ids). Full
  in-CLI smoke pending — run `/model` on an opencode-go profile after
  the binary auto-updates and confirm the list shows >1 id.
- **Working tree:** clean (untracked `.codeboarding/` + local
  `.claude/settings.local.json` only — both intentionally unstaged).

## Pick up here

**Merge done + verified on `sync-upstream-2026-06-11`. To ship it:**

1. Run the live BYOK smoke on the new binary
   (`cli/bin/codebuff-mod.exe`): `/providers:add <preset> <key>` →
   `/providers:list` → small prompt. Confirm Path C dispatches.
2. Review the sync branch diff if desired:
   `git diff modded..sync-upstream-2026-06-11 -- sdk/ cli/ common/`
   (the meaningful surface; ignore the mass `web/`+`packages/*`
   deletions).
3. Fast-forward `modded`:
   `git switch modded && git merge --ff-only sync-upstream-2026-06-11`.
4. FF local `main` to `origin/main` and push it (now safe — local main
   was blocked earlier only by the uncommitted active-work.md edit):
   `git switch main && git merge --ff-only origin/main && git push origin main`.
5. Version bump + release per MERGE-STRATEGY.md §6 (bump
   `cli/package.json` + `cli/release/package.json`, rebuild the three
   platform tarballs, `git push origin modded`, tag, `gh release
   create`, `npm publish`). This is a MAJOR sync (97 upstream commits +
   backend removed) — consider a minor/major bump, not a patch.
6. After ship, update MERGE-STRATEGY.md: the conflict map still assumes
   the full monorepo (`web/_post.ts`, `packages/internal`, `scripts/
   check-env-architecture.ts`). Post-B those zones are GONE — rewrite
   the map for the lean CLI/SDK-only tree, or the next merge agent
   chases dead files.

**If review rejects strategy B:** the sync branch is disposable —
`git branch -D sync-upstream-2026-06-11`, `modded` never moved.

## Deferred — chase only if real merge pain returns

- **`opencode` (Zen) preset still hardcoded.** v1.0.6 fixed only
  `opencode-go`. The sibling `opencode` Zen preset keeps its 2-id
  hardcoded catalog (`['opencode/minimax-m2.7', 'opencode/kimi-k2.6']`)
  with the same `opencode/`-prefix bug — its endpoint
  (`https://opencode.ai/zen/v1/models`) live-serves ~40 ids. One-line
  fix mirroring v1.0.6 if a user reports it. Left scoped-out per
  user call.
- **Heavy-file deeper shims.** `command-registry.ts`,
  `message-block.tsx`, `web/.../_post.ts` still hold large in-place
  edits; shim further only if upstream starts touching them.
- **bun-compile tree-shake repro.** Why `--compile` drops side-effect
  hook registrations — blocks shims #5–7 (3 React hooks).
- **`ForkHooks.shouldSkipReactHook` dead field.** ~10 lines to remove.
- **`byok-resolver.ts` style asymmetry.** SDK explicit-register vs
  CLI inline IIFE. Stylistic only.

## Open questions (carry-over)

- **`codexspark` / `codexplan` aliases unverified for OAuth-bearer
  path.** One-line revert in `OPENROUTER_TO_OPENAI_MODEL_MAP` if
  either 4xx's.
- **Token refresh ergonomics** — `getValidCodexCredentials` refresh
  failure mid-conversation throws into the agent loop. Clearer
  reconnect hint?
- **`oauthProfileId` rename** — equals `profile.id` today;
  forward-compat hook for multi-profile-shared OAuth.
- **`/connect:chatgpt` deprecation** — retire singleton in a future
  minor?
- **macOS x64 + arm64 binaries** — still deferred. Ships only
  win32-x64, linux-x64, linux-arm64.
- **Phase 3b/c OpenTUI providers panel** — text-mode covers the full
  surface; visual wizard still nice-to-have.
- ~~**Hard-delete `web/` and `freebuff/`**~~ — DONE for `web/` via the
  2026-06-11 strategy-B sync (rode upstream's deletion). `freebuff/`
  was thinned, not removed (upstream keeps it as a workspace).
- **Delete `LoginModal` + `cli/src/login/*`** — provably unreachable
  post-0.1.10.

## Security carry-over

- Previously-leaked OpenCode key revoked at opencode.ai on 2026-05-19.
  Revoked key string still in plaintext in
  `~/.config/manicode/message-history.json`. User declined a scrub.
- `~/.config/manicode/codex-oauth.json` follows 0600, tokens in
  plaintext — same threat model as `providers.json` /
  `credentials.json`.
- Pre-shim swap backup: `~/.config/manicode/providers.json.shim-bak`.

## Rollback path (if shim turns sour later)

```powershell
cd "D:\.claude\claude projects\codebuff"
git branch -m modded modded-shim-broken
git branch -m modded-pre-shim modded
git push origin modded --force-with-lease
# binary rollback:
Move-Item cli\bin\codebuff-mod.exe cli\bin\codebuff-mod.shim.exe -Force
Move-Item cli\bin\codebuff-mod.pre-shim.exe cli\bin\codebuff-mod.exe -Force
```

Tag `v1.0.2-pre-shim` permanently anchors the pre-shim tip; rollback
is reversible even if the archive branch is later deleted.

## Skills for next session

- `/to-issues` — if macOS binaries / web+freebuff deletion / login
  dead-code removal get turned into trackable tickets.
- `/grill-me` — if scoping any of the deferred items.

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
