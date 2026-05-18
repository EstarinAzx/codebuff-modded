import { env } from '@codebuff/common/env'
import { SENTINEL_BACKEND_URL } from '@codebuff/common/env-schema'
import { useCallback } from 'react'

import { invalidateActivityQuery, useActivityQuery } from './use-activity-query'
import { getAuthToken } from '../utils/auth'
import { logger as defaultLogger } from '../utils/logger'
import { getActiveProfile } from '../utils/providers'

import type { ClientEnv } from '@codebuff/common/types/contracts/env'
import type { Logger } from '@codebuff/common/types/contracts/logger'

/** BYOK placeholder response — no central billing in BYOK mode. */
const BYOK_USAGE_RESPONSE: UsageResponse = {
  type: 'usage-response',
  usage: 0,
  remainingBalance: null,
  next_quota_reset: null,
}

// Query keys for type-safe cache management
export const usageQueryKeys = {
  all: ['usage'] as const,
  current: () => [...usageQueryKeys.all, 'current'] as const,
}

interface UsageResponse {
  type: 'usage-response'
  usage: number
  remainingBalance: number | null
  balanceBreakdown?: {
    free: number
    paid: number
    ad?: number
    referral?: number
    admin?: number
  }
  next_quota_reset: string | null
  autoTopupEnabled?: boolean
}

interface FetchUsageParams {
  authToken: string
  logger?: Logger
  clientEnv?: ClientEnv
}

/**
 * Fetches usage data from the API
 */
export async function fetchUsageData({
  authToken,
  logger = defaultLogger,
  clientEnv = env,
}: FetchUsageParams): Promise<UsageResponse> {
  // BYOK mode: no central billing. Synthesize a zero-usage response so the
  // UsageBanner renders harmlessly without hitting the codebuff.com backend.
  try {
    if (getActiveProfile()) return BYOK_USAGE_RESPONSE
  } catch {
    /* ignore — fall through */
  }

  const appUrl = clientEnv.NEXT_PUBLIC_CODEBUFF_APP_URL
  if (!appUrl || appUrl === SENTINEL_BACKEND_URL) {
    return BYOK_USAGE_RESPONSE
  }

  const response = await fetch(`${appUrl}/api/v1/usage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fingerprintId: 'cli-usage',
      authToken,
    }),
  })

  if (!response.ok) {
    logger.error(
      { status: response.status },
      'Failed to fetch usage data from API',
    )
    throw new Error(`Failed to fetch usage: ${response.status}`)
  }

  const responseBody = await response.json()
  const data = responseBody as UsageResponse
  return data
}

export interface UseUsageQueryDeps {
  logger?: Logger
  enabled?: boolean
  refetchInterval?: number | false
  /** Refetch stale data when user becomes active after being idle */
  refetchOnActivity?: boolean
  /** Pause polling when user is idle */
  pauseWhenIdle?: boolean
  /** Time in ms to consider user idle (default: 30 seconds) */
  idleThreshold?: number
}

/**
 * Hook to fetch usage data from the API
 * Uses the activity-aware query hook for terminal-specific optimizations
 */
export function useUsageQuery(deps: UseUsageQueryDeps = {}) {
  const {
    logger = defaultLogger,
    enabled = true,
    refetchInterval = false,
    refetchOnActivity = false,
    pauseWhenIdle = true,
    idleThreshold = 30_000,
  } = deps
  const authToken = getAuthToken()

  return useActivityQuery({
    queryKey: usageQueryKeys.current(),
    queryFn: () => fetchUsageData({ authToken: authToken!, logger }),
    enabled: enabled && !!authToken,
    staleTime: 0, // Always consider data stale for immediate refetching
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry failed usage queries
    refetchOnMount: 'always', // Always refetch on mount to get fresh data when banner opens
    refetchInterval, // Poll at specified interval (when banner is visible)
    refetchOnActivity,
    pauseWhenIdle,
    idleThreshold,
  })
}

/**
 * Hook to manually trigger a usage data refresh
 */
export function useRefreshUsage() {
  return useCallback(() => {
    invalidateActivityQuery(usageQueryKeys.current())
  }, [])
}
