// ----- byok-web-tools.ts — BYOK direct dispatch for web_search/read_docs ----- //

/*
Depends on: @codebuff/common/env-schema (SENTINEL_BACKEND_URL — the
never-dial-this marker); ./search-providers (serper/brave/tavily chain);
../context7-api (direct Context7 docs client, upstream-built but orphaned
since docs moved behind the hosted proxy).
Data shapes: returns mirror the codebuff-web-api facade results —
{ result | documentation, error, creditsUsed } — so callers swap paths
without reshaping.
*/

import { SENTINEL_BACKEND_URL } from '@codebuff/common/env-schema'

import { fetchContext7LibraryDocumentation } from '../context7-api'
import {
  availableSearchProviders,
  searchWithFallback,
} from './search-providers'

import type { CiEnv, ClientEnv } from '@codebuff/common/types/contracts/env'
import type { Logger } from '@codebuff/common/types/contracts/logger'

// ------------------------------ Backend gate ------------------------------- //

// True only when a real hosted backend is reachable-by-config: a non-sentinel
// URL AND a key. The fork's env contract says the sentinel must never be
// dialed — this gate is what enforces it.
export function isBackendConfigured(params: {
  clientEnv: ClientEnv
  ciEnv: CiEnv
  baseUrlOverride?: string
}): boolean {
  const { clientEnv, ciEnv, baseUrlOverride } = params
  const baseUrl = baseUrlOverride ?? clientEnv.NEXT_PUBLIC_CODEBUFF_APP_URL
  // CODEBUFF_API_KEY (not the BYOK provider key the handler threads through)
  // is the hosted backend's credential — both halves must be deliberate.
  return Boolean(
    baseUrl && baseUrl !== SENTINEL_BACKEND_URL && ciEnv.CODEBUFF_API_KEY,
  )
}

// --------------------------- Tool advertisement gate ------------------------ //

// Without any search key web_search can only fail — strip it from templates so
// agents never advertise (or burn a turn on) a dead tool. read_docs stays:
// Context7 works keyless. Untouched templates pass through by reference.
export function gateByokWebTools<T extends { toolNames: string[] }>(
  templates: Record<string, T>,
  ciEnv: CiEnv | undefined,
): Record<string, T> {
  if (ciEnv && availableSearchProviders(ciEnv).length > 0) return templates

  const gated: Record<string, T> = {}
  for (const [key, template] of Object.entries(templates)) {
    gated[key] = template.toolNames.includes('web_search')
      ? {
          ...template,
          toolNames: template.toolNames.filter((name) => name !== 'web_search'),
        }
      : template
  }
  return gated
}

// ------------------------- web_search → Serper ----------------------------- //

// Direct search through the provider chain (serper/brave/tavily — whichever
// keys the user set); results cost 0 credits.
export async function byokWebSearch(params: {
  query: string
  depth?: 'standard' | 'deep'
  fetch: typeof globalThis.fetch
  logger: Logger
  ciEnv: CiEnv
}): Promise<{ result?: string; error?: string; creditsUsed?: number }> {
  const { query, depth, fetch, logger, ciEnv } = params

  const { result, error } = await searchWithFallback({
    query,
    depth,
    fetch,
    logger,
    ciEnv,
  })
  if (error) return { error }
  return { result, creditsUsed: 0 }
}

// ------------------------- read_docs → Context7 ----------------------------- //

// Direct Context7 docs lookup; works keyless (CONTEXT7_API_KEY optional).
export async function byokReadDocs(params: {
  libraryTitle: string
  topic?: string
  maxTokens?: number
  fetch: typeof globalThis.fetch
  logger: Logger
}): Promise<{ documentation?: string; error?: string; creditsUsed?: number }> {
  const { libraryTitle, topic, maxTokens, fetch, logger } = params

  const documentation = await fetchContext7LibraryDocumentation({
    query: libraryTitle,
    topic,
    tokens: maxTokens,
    logger,
    fetch,
  })

  if (documentation === null) {
    return {
      error: `No documentation found for "${libraryTitle}"${topic ? ` (topic: ${topic})` : ''} on Context7.`,
    }
  }
  return { documentation, creditsUsed: 0 }
}
