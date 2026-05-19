/**
 * Fork impl — process-local runId synthesis for BYOK runs.
 *
 * `startAgentRun()` returns null when codebuff.com run tracking is skipped
 * (BYOK mode). Downstream agent-runtime code asserts on truthy
 * `agentState.runId` — empty-string coercion would collide in the
 * `runIdToGenerator` map across concurrent programmatic agents and
 * re-trigger the `Agent state has no run ID` throw on spawn.
 *
 * Self-wires on module load. Returns `null` when the fork's backend skip
 * is not active so the upstream `Failed to start agent run` throw still
 * fires for non-BYOK SDK consumers.
 */

import { registerForkHooks } from '../fork-hooks'
import { getActiveByokProfile } from './byok-resolver'

function shouldSynthesize(): boolean {
  if (process.env.CODEBUFF_USE_BACKEND === '1') return false
  return getActiveByokProfile() !== null
}

function randomToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function synthRunId(templateId: string): string | null {
  if (!shouldSynthesize()) return null
  return `byok-${templateId}-${randomToken()}`
}

registerForkHooks({ synthRunId })
