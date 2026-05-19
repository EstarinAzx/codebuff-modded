/**
 * Fork impl — module-load-time gate for React hooks that touch codebuff.com.
 *
 * The three affected hooks (`use-connection-status`, `use-gravity-ad`,
 * `use-agent-validation`) need to short-circuit at module load when the fork's
 * backend is disabled. React's Rules of Hooks forbid conditional hook count
 * changes mid-render, so the answer must be pinned at module load — not
 * recomputed per render when a mid-session `/providers:add` happens. See
 * .context/decisions.md "Module-level BYOK_AT_BOOT flag in React hooks".
 *
 * Two ways the gate fires `true`:
 *   1. Default — `CODEBUFF_USE_BACKEND !== '1'`. Backend host isn't
 *      configured, polling sticks "connecting…" / ads / validation forever.
 *   2. Escape-hatch mode (`CODEBUFF_USE_BACKEND=1`) with an active BYOK
 *      profile — Path C handles dispatch, no upstream socket to monitor.
 *
 * Self-wires on module load. Idempotent — registerForkHooks merges keys.
 */

import { registerForkHooks } from '@codebuff/sdk'

import { getActiveProfile } from '../utils/providers'

function shouldSkipReactHook(): boolean {
  if (process.env.CODEBUFF_USE_BACKEND !== '1') return true
  try {
    return getActiveProfile() !== null
  } catch {
    return false
  }
}

registerForkHooks({ shouldSkipReactHook })
