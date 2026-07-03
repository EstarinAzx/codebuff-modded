# Pick up

**Start: read `.context/overview.md` + `.context/active-work.md`** (then
this file). Project is the BYOK Codebuff fork, `modded` branch.

## What the last session finished

**v1.3.2 SHIPPED 2026-07-04 — Codex OAuth "no final response" fix (template).**

- Two swings at the same user report ("Codex models stop — tools run, todos
  update, no final response"):
  - **1.3.1** (`a1242f470`): reasoning round-trip in
    `sdk/src/impl/chatgpt-backend-fetch.ts` (replay encrypted reasoning across
    the tool loop). Real bug, but did NOT fix the symptom — user ran 1.3.1,
    still broke. Logs: agent `mod-max`, clean loop end, no error, no final text.
  - **1.3.2** (`fb9dcf0a4`): the actual cause — `mod-max`/`mod-default`
    `instructionsPrompt` told the model *"the summary IS the work for the
    summarize todo — mark it complete in the same `write_todos` call"*. Codex
    reads that literally → checks the box, exits, skips the visible summary
    (internal reasoning isn't shown). Fixed: visible summary mandatory BEFORE
    `end_turn`, decoupled from the checkbox, "reasoning isn't shown" note.
- Shipped both via MERGE-STRATEGY §Step 6. npm `codebuff-mod@1.3.2` = `latest`.

## Next task

**1.3.2 is prompt-only and NOT live-confirmed** (user chose ship over smoke).

1. **Confirm the fix on a real Codex OAuth run:** `cbm` (or `bun run dev`) →
   Codex profile active → read-only/explore prompt ("read X and summarise, no
   edits") → a visible summary must appear before the suggested followups.
   Try 2-3×.
2. **If it still ends with no summary → escalate** to a structural guard: in
   `packages/agent-runtime`, detect an empty final top-level turn and nudge/
   re-emit. Bigger + merge-riskier (the shim refactor deliberately left
   agent-runtime untouched) — weigh vs. another prompt iteration. Precedent:
   decisions.md 1.0.4 "escalate to agent-runtime auto-close if repros persist".

## Landmines / notes

- **Release is fully manual** — MERGE-STRATEGY §Step 6. Bump BOTH
  `cli/package.json` + `cli/release/package.json`; rebuild binaries AFTER the
  bump; GH release MUST precede `npm publish`; tarball = binary only.
- **build-binary re-runs prebuild-agents** — `.agents/mod-*.ts` template edits
  bake into the binary automatically at build; no separate step. Verify with
  `grep bundled-agents.generated.ts`.
- **`npm view` lags** — after publish it cached the old version for minutes;
  confirm via `curl https://registry.npmjs.org/codebuff-mod/latest`.
- **Never adopt upstream's `cli/release/index.js`** ([[decisions]]).
- Untracked `.codeboarding/` in repo root is the user's — keep out of commits.
- Full state in `active-work.md`; rationale in `decisions.md`.
