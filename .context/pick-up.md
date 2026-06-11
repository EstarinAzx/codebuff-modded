# Pick up

**Start: read `.context/overview.md` + `.context/active-work.md`** (then
this file). Project is the BYOK Codebuff fork, `modded` branch.

## What the last session finished

**Web-tools rewire** — `web_search` + `read_docs` no longer dial the
deleted backend:

- `web_search` → direct serper→brave→tavily fallback chain
  (`packages/agent-runtime/src/llm-api/fork-impls/search-providers.ts`);
  any of `SERPER_API_KEY`/`BRAVE_API_KEY`/`TAVILY_API_KEY` enables it,
  `CBM_SEARCH_PROVIDER` picks primary. No key → tool stripped from agent
  templates (`gateByokWebTools`).
- `read_docs` → direct Context7, keyless (fixed `Bearer undefined` bug).
- Facade seam: dispatch blocks at top of `callWebSearchAPI`/
  `callDocsSearchAPI` in `codebuff-web-api.ts`; backend-configured path
  untouched (SDK Path B).
- Also: fixed the 2 stale CLI provider tests; revived 2 import-broken
  agent-runtime tool test files.
- User live-smoked the Serper path (worked). Brave/Tavily chain
  unit-tested only.
- Rationale: [[decisions]] same-date entry. Merge surface:
  MERGE-STRATEGY.md "Web-tools direct dispatch surface".

## Next task

**Nothing required — v1.2.0 SHIPPED** (npm `codebuff-mod@1.2.0` latest;
GH release v1.2.0 with 3 tarballs; `modded` + tag pushed). Optional:

1. Live smoke on published binary (carried since 1.1.0) — now also
   covers `web_search` with `SERPER_API_KEY`.
2. Fallback-chain live smoke (needs a Brave/Tavily key + bad Serper key).

## Landmines / notes

- **`testCiEnv.SERPER_API_KEY` is load-bearing** — removing it breaks
  web-search tool tests via the gate. See [[gotchas]].
- **Gate checks key presence, not quota** — dead key keeps tool
  advertised; calls fail fast with clear error.
- **Test rot is wider than documented before:** common 1 / sdk 65 /
  cli 18 pre-existing fails (Windows path-flavored), stash-baselined
  2026-06-11. Don't chase as regressions.
- **Brave/Tavily API shapes from training data** — if a live call 4xx's,
  check current docs; clients degrade clean (null → next provider).
- User's Serper key was pasted in-chat; advised rotation (low stakes).
- Full state in `active-work.md`; strategy rationale in `decisions.md`.
