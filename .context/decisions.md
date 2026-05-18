---
type: decisions
project: codebuff (fork — modded branch)
updated: 2026-05-18
tags: [decisions, modded]
---

# Decisions — fork-local

Upstream architectural decisions live in upstream `docs/` and (if added later) `docs/adr/`. This file tracks only the decisions made for fork-local work on the `modded` branch.

## 2026-05-18 — OpenCode Go: clone, don't extend

**Decision:** Create `web/src/llm-api/opencode-go.ts` as a full sibling of `opencode-zen.ts` rather than parameterizing the Zen handler to handle both endpoints.

**Why:** Minimizes merge conflicts on upstream sync. Trivial to retire if upstream adds Go themselves (`git rm` one file + revert the dispatch ladder edits). Parameterizing would touch the Zen file on every upstream pull.

**Trade-off accepted:** ~620 LOC of duplicated handler logic. Mitigated by `PORT:` comment at top of `opencode-go.ts` instructing future maintainers to replay Zen bug fixes into Go.

## 2026-05-18 — Single shared `OPENCODE_API_KEY`

**Decision:** Reuse the existing `OPENCODE_API_KEY` env var for both Zen and Go endpoints. Did **not** add `OPENCODE_GO_API_KEY`.

**Why:** opencode.ai issues one key per account; Zen and Go are sibling endpoints under the same auth. Adding a separate var would force two secrets in deploy config for no upstream-visible reason.

**Revisit if:** opencode.ai starts issuing separate keys per endpoint.

## 2026-05-18 — Skip `ALLOWED_MODEL_PREFIXES` update

**Decision:** Did not add `'opencode-go'` to `ALLOWED_MODEL_PREFIXES` in `common/src/constants/model-config.ts`.

**Why:** Verified via grep that `ALLOWED_MODEL_PREFIXES` is only consumed by `common/src/types/dynamic-agent-template.ts` (Zod validator for agent template definitions), not by the chat-completions endpoint dispatch. Existing `opencode/` prefix (Zen) is also absent from the list and works fine — confirms the chat-completions path does not gate on it.

**Revisit if:** an agent template references `opencode-go/*` as its model id (then the template validator will reject it and the prefix must be added).
