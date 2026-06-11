---
type: active-work
project: codebuff (fork — modded branch)
updated: 2026-06-11
tags: [context, active-work]
ship: 1.2.0 (SHIPPED — BYOK-direct web tools; npm + GH release live)
focus: nothing in flight — 1.2.0 shipped
---

# Active Work

_Last updated: 2026-06-11 by Fable 5 (auto)_
_At commit: see `git log` — web-tools rewire committed on `modded` after `4d9e48f40` (the 1.1.2 bump). Push/release state: see [[#Pick up here]]._

## Current focus

**Web-tools rewire (2026-06-11, same day as 1.1.2).** `web_search` and
`read_docs` were backend-proxied upstream tools still dialing the deleted
backend (sentinel `http://127.0.0.1:1`) — `web_search` failed "Unable to
connect", `read_docs` "missing API key". Now BYOK-direct:

- **Facade dispatch** in `codebuff-web-api.ts`: backend configured
  (non-sentinel URL + `CODEBUFF_API_KEY`) → upstream proxy path (Path B
  preserved); else direct.
- **`web_search`** → serper→brave→tavily fallback chain
  (`fork-impls/search-providers.ts`); keys `SERPER_API_KEY` /
  `BRAVE_API_KEY` / `TAVILY_API_KEY`; `CBM_SEARCH_PROVIDER` picks primary.
  0 credits.
- **`read_docs`** → Context7 direct, keyless (fixed upstream
  `Bearer undefined` header bug in `context7-api.ts`).
- **Advertisement gate** (`gateByokWebTools` via
  `assembleLocalAgentTemplates` ← `main-prompt.ts`): zero search keys →
  `web_search` stripped from all agent templates; `read_docs` always stays.
- Full rationale in [[decisions]] "web_search/read_docs go
  direct-to-provider"; merge surface documented in
  [MERGE-STRATEGY.md](../MERGE-STRATEGY.md) "Web-tools direct dispatch
  surface".

Also this session: fixed the 2 stale CLI tests (`providers-models.test.ts`
opencode-go now asserts empty catalog; `providers.test.ts` asserts schema
v2) and revived 2 import-broken agent-runtime test files
(`web-search-tool.test.ts`, `read-docs-tool.test.ts` — dead
`agents-graveyard` import → `testResearcherAgent` fixture in test-utils).

## State

- **In flight:** nothing — **v1.2.0 SHIPPED** (npm `codebuff-mod@1.2.0`
  `latest`; GH release
  https://github.com/EstarinAzx/codebuff-modded/releases/tag/v1.2.0 with
  3 tarballs verified; `modded` + `v1.2.0` tag pushed).
- **Verified:** agent-runtime 451 pass / 0 fail (18 new tests: 8 facade,
  11 provider-chain/gating, plus revived files); typecheck green in
  common / agent-runtime / sdk / cli; common+sdk+cli failures
  stash-baselined as pre-existing (1 / 65 / 18 — see below).
- **Live smoke:** user tested Serper path end-to-end via `bun run dev`
  (key set, real search worked). Brave/Tavily + fallback chain are
  unit-tested only — no live key.
- **Version:** 1.2.0 (`104addd40` bump; binary prints 1.2.0).
- **Branches/tags:** unchanged (`modded-pre-shim`, pre-sync tip
  `e534b0650`, `upstream` remote).
- **Blocked:** none.

## Pick up here

Nothing required — 1.2.0 is out. Optional:

1. **Live smoke on published binary** (carried since 1.1.0): fresh
   `npm i -g codebuff-mod` → `/providers:add` → prompt → Path C dispatch;
   now also covers web_search with `SERPER_API_KEY` set.
2. **Fallback-chain live smoke:** needs a Brave or Tavily key — set it
   plus a deliberately-bad `SERPER_API_KEY`, confirm chain falls through.
3. **OSC 11 first-paint flash** (cosmetic, carried).

## Known test-suite rot (pre-existing, stash-baselined 2026-06-11)

- `common`: 1 fail (`coerceToArray` zod JSON-schema comparison).
- `sdk`: 65 fails — filesystem/path-flavored suites (getFiles,
  loadUserKnowledgeFiles, applyPatchTool, changeFile, …) on Windows.
- `cli`: 18 fails + 4 errors, same flavor.
- None caused by this session's work (verified by stashing). Wider than
  the "2 stale tests" previously documented — those 2 are now fixed.

## Deferred — chase only if it surfaces

- **`opencode` (Zen) preset still hardcoded** (2-id catalog, `opencode/`
  prefix bug). One-liner if reported — see [[gotchas]].
- **3 un-shimmed React hooks** (`use-connection-status`, `use-gravity-ad`,
  `use-agent-validation`) — in-place `BYOK_AT_BOOT` logic.
- **`ForkHooks.shouldSkipReactHook` dead field** (~10 lines).
- **macOS binaries** — build-binary.ts supports, never shipped.
- **Delete `LoginModal` + `cli/src/login/*`** — unreachable post-0.1.10.

## Open questions (carry-over)

- `codexspark`/`codexplan` aliases unverified on OAuth-bearer path.
- Token-refresh ergonomics (`getValidCodexCredentials` throw mid-loop).
- `/connect:chatgpt` deprecation timing.

## Security carry-over

- Revoked OpenCode key still plaintext in
  `~/.config/manicode/message-history.json` (user declined scrub).
- **New 2026-06-11:** user's Serper API key pasted in-chat → lives in this
  session's transcript on disk. Advised rotation at serper.dev; low
  stakes (search-only key). Key is env-var-only, never written to repo.
- `codex-oauth.json` 0600, tokens plaintext — same model as
  `providers.json`.

## Rollback paths

- **Undo web-tools rewire:** revert its commit, or surgically delete the
  two dispatch blocks in `codebuff-web-api.ts`, the gate call in
  `agent-registry.ts`, and `fork-impls/{byok-web-tools,search-providers}.ts`.
- **Undo strategy-B sync** (restore backend): `git checkout e534b0650 --
  web packages/internal packages/billing packages/bigquery
  packages/build-tools scripts`.
- **Pre-shim rollback:** tag `v1.0.2-pre-shim` + branch `modded-pre-shim`.
- **Undo 1.1.x UI fixes:** revert `230fd309c` (blend) / `0d5a84979`
  (opaque fill).

## Skills for next session

- `/verify` or live smoke recipe above — if validating the fallback chain.
- `/to-issues` — if deferred items become tickets.

## Related

- [[overview]]
- [[stack]]
- [[decisions]]
- [[gotchas]]
- [MERGE-STRATEGY.md](../MERGE-STRATEGY.md)
