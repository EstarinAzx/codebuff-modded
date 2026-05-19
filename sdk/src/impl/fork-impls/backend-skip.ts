/**
 * Fork impl — codebuff.com backend skip + synthetic user fallback.
 *
 * Registers two hooks:
 * - `skipBackend()` — true when a BYOK profile is active and the explicit
 *   `CODEBUFF_USE_BACKEND=1` escape hatch is unset. Drives the early-returns
 *   in `sdk/src/impl/database.ts` for every backend-touching function.
 * - `synthUserInfo(fields)` — returns the byok-local synthetic user row,
 *   projected to the requested field subset. Used by `getUserInfoFromApiKey`
 *   when the backend is skipped (the upstream function expects a non-null
 *   user record, not just "null").
 *
 * Self-wires on module load. Pre-existing SDK consumers that never set a
 * BYOK profile retain unchanged backend behavior because `skipBackend()`
 * returns false in that case (`getActiveByokProfile() === null`).
 */

import { registerForkHooks } from '../fork-hooks'
import { getActiveByokProfile } from './byok-resolver'

import type {
  GetUserInfoFromApiKeyOutput,
  UserColumn,
} from '@codebuff/common/types/contracts/database'

function shouldSkipBackend(): boolean {
  if (process.env.CODEBUFF_USE_BACKEND === '1') return false
  return getActiveByokProfile() !== null
}

const SYNTHETIC_USER = {
  id: 'byok-local',
  email: 'local@byok',
  discord_id: null,
  stripe_customer_id: null,
  banned: false,
  created_at: new Date(0),
} as const

function synthUserInfo<T extends UserColumn>(
  fields: readonly T[],
): Awaited<GetUserInfoFromApiKeyOutput<T>> | null {
  if (!shouldSkipBackend()) return null
  return Object.fromEntries(
    fields.map((field) => [field, SYNTHETIC_USER[field]]),
  ) as Awaited<GetUserInfoFromApiKeyOutput<T>>
}

registerForkHooks({
  skipBackend: shouldSkipBackend,
  synthUserInfo,
})
