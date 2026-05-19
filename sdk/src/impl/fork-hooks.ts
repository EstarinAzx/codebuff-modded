/**
 * Fork-hook registry — extension points called from upstream files.
 *
 * Pattern: upstream files call `getForkHooks().<name>?.(...)` exactly once.
 * When the fork is absent (e.g., bare SDK consumers that never call
 * `registerForkHooks`), every hook is `undefined` and upstream behavior
 * runs verbatim.
 *
 * Fork-side: register all hooks at CLI boot from
 * `cli/src/init/init-app.ts`. Implementations live under
 * `sdk/src/impl/fork-impls/`.
 *
 * Adding a hook: declare it here as optional, add the one-line dispatch
 * in the upstream callsite, write the impl under `fork-impls/`, register
 * it at boot. New hooks must default to no-op when absent so upstream
 * behavior is unchanged.
 */

import type { ModelRequestParams, ModelResult } from './model-provider'
import type {
  GetUserInfoFromApiKeyOutput,
  UserColumn,
} from '@codebuff/common/types/contracts/database'

export interface ForkHooks {
  /**
   * BYOK Path C dispatch. Resolves the request against an active BYOK
   * profile (raw-key direct dispatch or codex OAuth) and returns the
   * ModelResult. Returning `null` falls through to upstream Path A / Path B.
   * Async because Codex profiles refresh OAuth tokens on demand.
   */
  resolveByok?: (params: ModelRequestParams) => Promise<ModelResult | null>

  /**
   * Skip all codebuff.com backend HTTP calls. True when a BYOK profile is
   * active and `CODEBUFF_USE_BACKEND !== '1'`. Drives the early-returns in
   * `database.ts` and the React BYOK_AT_BOOT gates.
   */
  skipBackend?: () => boolean

  /**
   * Provide synthetic user info when the codebuff.com user endpoint is
   * skipped. `getUserInfoFromApiKey` expects a non-null record; returning
   * a byok-local synthetic row satisfies that contract. Implementations
   * guard internally so non-BYOK consumers fall through to the real
   * backend (return `null`).
   */
  synthUserInfo?: <T extends UserColumn>(
    fields: readonly T[],
  ) => Awaited<GetUserInfoFromApiKeyOutput<T>> | null

  /**
   * Synthesize a process-local runId when central run-tracking returns null.
   * Must return a truthy string when in BYOK mode (downstream code asserts
   * on truthy runId) — receives the agent template id so logs are greppable
   * (e.g., `byok-mod-default-<uuid>`). Returns `null` when the fork is not
   * active so the upstream `Failed to start agent run` throw still fires
   * for non-BYOK consumers.
   */
  synthRunId?: (templateId: string) => string | null

  /**
   * Whether a React hook that touches codebuff.com should short-circuit at
   * module load. Same boolean as `skipBackend()` but the React-side gates
   * are pinned at module load (Rules of Hooks), so the hook is evaluated
   * once not per-render.
   */
  shouldSkipReactHook?: () => boolean
}

let hooks: ForkHooks = {}

/**
 * Install (or replace) fork hooks. Subsequent calls merge into the existing
 * map — pass only the keys you want to change.
 */
export function registerForkHooks(h: ForkHooks): void {
  hooks = { ...hooks, ...h }
}

/**
 * Read the current hook map. Always returns the same object reference; do
 * not mutate it directly.
 */
export function getForkHooks(): ForkHooks {
  return hooks
}
