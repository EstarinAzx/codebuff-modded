// ---- search-providers.ts — multi-provider web search with fallback chain ---- //

/*
Depends on: @codebuff/common/util/promise (withTimeout); ../serper-api (the
upstream-built direct Serper client, reused as one provider among three).
Data shapes: every provider returns a JSON string of results or null on
failure; searchWithFallback returns { result?, error?, provider? } where
provider names which backend actually answered.
*/

import { withTimeout } from '@codebuff/common/util/promise'

import { searchWeb as searchSerperRaw } from '../serper-api'

import type { CiEnv } from '@codebuff/common/types/contracts/env'
import type { Logger } from '@codebuff/common/types/contracts/logger'

const FETCH_TIMEOUT_MS = 30_000

export type SearchProviderId = 'serper' | 'brave' | 'tavily'

// Fixed fallback priority — serper first (richest results), then brave
// (generous free tier), then tavily (LLM-oriented summaries).
const PROVIDER_ORDER: SearchProviderId[] = ['serper', 'brave', 'tavily']

type ProviderSearchFn = (params: {
  query: string
  depth?: 'standard' | 'deep'
  apiKey: string
  fetch: typeof globalThis.fetch
  logger: Logger
}) => Promise<string | null>

// ------------------------------ Serper provider ----------------------------- //

const searchSerper: ProviderSearchFn = async (params) => {
  const { query, depth, apiKey, fetch, logger } = params
  return searchSerperRaw({
    query,
    depth,
    logger,
    fetch,
    serverEnv: { SERPER_API_KEY: apiKey },
  })
}

// ------------------------------ Brave provider ------------------------------ //

const searchBrave: ProviderSearchFn = async (params) => {
  const { query, depth, apiKey, fetch, logger } = params
  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search')
    url.searchParams.set('q', query)
    url.searchParams.set('count', depth === 'deep' ? '20' : '10')

    const response = await withTimeout(
      fetch(url, {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': apiKey,
        },
      }),
      FETCH_TIMEOUT_MS,
    )
    if (!response.ok) {
      logger.warn(
        { query, status: response.status },
        'Brave search request failed',
      )
      return null
    }

    const data = (await response.json()) as {
      web?: {
        results?: Array<{ title?: string; url?: string; description?: string }>
      }
    }
    const results = data.web?.results
    if (!Array.isArray(results)) return null

    return JSON.stringify(
      {
        provider: 'brave',
        results: results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.description,
        })),
      },
      null,
      2,
    )
  } catch (error) {
    logger.warn({ query, error }, 'Brave search threw')
    return null
  }
}

// ------------------------------ Tavily provider ----------------------------- //

const searchTavily: ProviderSearchFn = async (params) => {
  const { query, depth, apiKey, fetch, logger } = params
  try {
    const response = await withTimeout(
      fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          max_results: depth === 'deep' ? 20 : 10,
          search_depth: depth === 'deep' ? 'advanced' : 'basic',
        }),
      }),
      FETCH_TIMEOUT_MS,
    )
    if (!response.ok) {
      logger.warn(
        { query, status: response.status },
        'Tavily search request failed',
      )
      return null
    }

    const data = (await response.json()) as {
      answer?: string
      results?: Array<{ title?: string; url?: string; content?: string }>
    }
    if (!Array.isArray(data.results)) return null

    return JSON.stringify(
      {
        provider: 'tavily',
        ...(data.answer ? { answer: data.answer } : {}),
        results: data.results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
        })),
      },
      null,
      2,
    )
  } catch (error) {
    logger.warn({ query, error }, 'Tavily search threw')
    return null
  }
}

// ----------------------------- Provider registry ---------------------------- //

const PROVIDERS: Record<
  SearchProviderId,
  {
    keyName: 'SERPER_API_KEY' | 'BRAVE_API_KEY' | 'TAVILY_API_KEY'
    run: ProviderSearchFn
  }
> = {
  serper: { keyName: 'SERPER_API_KEY', run: searchSerper },
  brave: { keyName: 'BRAVE_API_KEY', run: searchBrave },
  tavily: { keyName: 'TAVILY_API_KEY', run: searchTavily },
}

// Providers whose keys exist, preferred one (CBM_SEARCH_PROVIDER) hoisted first.
export function availableSearchProviders(ciEnv: CiEnv): SearchProviderId[] {
  const withKeys = PROVIDER_ORDER.filter((id) =>
    Boolean(ciEnv[PROVIDERS[id].keyName]),
  )
  const preferred = ciEnv.CBM_SEARCH_PROVIDER as SearchProviderId | undefined
  if (preferred && withKeys.includes(preferred)) {
    return [preferred, ...withKeys.filter((id) => id !== preferred)]
  }
  return withKeys
}

// ------------------------------- Fallback chain ------------------------------ //

// Try each configured provider in order; first non-null result wins.
export async function searchWithFallback(params: {
  query: string
  depth?: 'standard' | 'deep'
  fetch: typeof globalThis.fetch
  logger: Logger
  ciEnv: CiEnv
}): Promise<{ result?: string; error?: string; provider?: SearchProviderId }> {
  const { query, depth, fetch, logger, ciEnv } = params

  const order = availableSearchProviders(ciEnv)
  if (order.length === 0) {
    return {
      error:
        'web_search needs a search API key: set SERPER_API_KEY (serper.dev), ' +
        'BRAVE_API_KEY (brave.com/search/api), or TAVILY_API_KEY (tavily.com). ' +
        'Optional CBM_SEARCH_PROVIDER=serper|brave|tavily picks the primary.',
    }
  }

  const failed: SearchProviderId[] = []
  for (const id of order) {
    const apiKey = ciEnv[PROVIDERS[id].keyName]!
    try {
      const result = await PROVIDERS[id].run({
        query,
        depth,
        apiKey,
        fetch,
        logger,
      })
      if (result !== null) return { result, provider: id }
    } catch (error) {
      logger.warn({ query, provider: id, error }, 'Search provider threw')
    }
    failed.push(id)
    logger.warn({ query, provider: id }, 'Search provider failed, trying next')
  }

  return {
    error: `Web search for "${query}" failed across all configured providers: ${failed.join(', ')}. Check key validity and quotas.`,
  }
}
