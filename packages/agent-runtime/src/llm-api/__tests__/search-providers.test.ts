// ------ search-providers.test.ts — multi-provider search + fallback chain ------ //

/*
Depends on: bun:test; ../fork-impls/search-providers (registry under test).
Data shapes: searchWithFallback returns { result?, error?, provider? };
mock fetch records (url, init) pairs and serves canned responses by substring.
*/

import { describe, expect, test } from 'bun:test'

import {
  availableSearchProviders,
  searchWithFallback,
} from '../fork-impls/search-providers'

import type { Logger } from '@codebuff/common/types/contracts/logger'

// ------------------------------ Test fixtures ------------------------------ //

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

function makeRoutedFetch(
  routes: Array<{
    match: string
    response: { ok?: boolean; status?: number; json?: unknown }
  }>,
) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl = (async (url: unknown, init?: unknown) => {
    const urlStr = String(url)
    calls.push({ url: urlStr, init: init as RequestInit })
    const route = routes.find((r) => urlStr.includes(r.match))
    if (!route) throw new Error(`no route for ${urlStr}`)
    const { ok = true, status = 200, json } = route.response
    return {
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      json: async () => json,
      text: async () => JSON.stringify(json),
      headers: new Headers(),
    } as unknown as Response
  }) as typeof fetch
  return { calls, fetchImpl }
}

const serperJson = {
  organic: [{ title: 'Serper Hit', link: 'https://s.example', snippet: 'sss' }],
}
const braveJson = {
  web: {
    results: [
      { title: 'Brave Hit', url: 'https://b.example', description: 'bbb' },
    ],
  },
}
const tavilyJson = {
  results: [{ title: 'Tavily Hit', url: 'https://t.example', content: 'ttt' }],
}

// --------------------------- Provider availability -------------------------- //

describe('availableSearchProviders', () => {
  test('orders by fixed priority, only keys present', () => {
    expect(availableSearchProviders({ BRAVE_API_KEY: 'b' })).toEqual(['brave'])
    expect(
      availableSearchProviders({
        SERPER_API_KEY: 's',
        BRAVE_API_KEY: 'b',
        TAVILY_API_KEY: 't',
      }),
    ).toEqual(['serper', 'brave', 'tavily'])
    expect(availableSearchProviders({})).toEqual([])
  })

  test('CBM_SEARCH_PROVIDER moves preferred provider first', () => {
    expect(
      availableSearchProviders({
        SERPER_API_KEY: 's',
        TAVILY_API_KEY: 't',
        CBM_SEARCH_PROVIDER: 'tavily',
      }),
    ).toEqual(['tavily', 'serper'])
  })

  test('preference without its key is ignored', () => {
    expect(
      availableSearchProviders({
        SERPER_API_KEY: 's',
        CBM_SEARCH_PROVIDER: 'brave',
      }),
    ).toEqual(['serper'])
  })
})

// ------------------------------ Single providers ---------------------------- //

describe('searchWithFallback — single provider', () => {
  test('brave-only key → Brave endpoint with X-Subscription-Token', async () => {
    const { calls, fetchImpl } = makeRoutedFetch([
      { match: 'api.search.brave.com', response: { json: braveJson } },
    ])

    const got = await searchWithFallback({
      query: 'test',
      fetch: fetchImpl,
      logger: noopLogger,
      ciEnv: { BRAVE_API_KEY: 'brave-key' },
    })

    expect(got.error).toBeUndefined()
    expect(got.provider).toBe('brave')
    expect(got.result).toContain('Brave Hit')
    const call = calls.find((c) => c.url.includes('api.search.brave.com'))!
    expect(
      (call.init?.headers as Record<string, string>)['X-Subscription-Token'],
    ).toBe('brave-key')
  })

  test('tavily-only key → Tavily endpoint with Bearer auth', async () => {
    const { calls, fetchImpl } = makeRoutedFetch([
      { match: 'api.tavily.com', response: { json: tavilyJson } },
    ])

    const got = await searchWithFallback({
      query: 'test',
      fetch: fetchImpl,
      logger: noopLogger,
      ciEnv: { TAVILY_API_KEY: 'tavily-key' },
    })

    expect(got.provider).toBe('tavily')
    expect(got.result).toContain('Tavily Hit')
    const call = calls.find((c) => c.url.includes('api.tavily.com'))!
    expect(
      (call.init?.headers as Record<string, string>)['Authorization'],
    ).toBe('Bearer tavily-key')
  })

  test('no keys → setup-hint error, zero calls', async () => {
    const { calls, fetchImpl } = makeRoutedFetch([])

    const got = await searchWithFallback({
      query: 'test',
      fetch: fetchImpl,
      logger: noopLogger,
      ciEnv: {},
    })

    expect(got.result).toBeUndefined()
    expect(got.error).toContain('SERPER_API_KEY')
    expect(calls.length).toBe(0)
  })
})

// ------------------------------- Fallback chain ----------------------------- //

describe('searchWithFallback — chain', () => {
  test('serper 500 → falls back to brave, in order', async () => {
    const { calls, fetchImpl } = makeRoutedFetch([
      {
        match: 'google.serper.dev',
        response: { ok: false, status: 500, json: {} },
      },
      { match: 'api.search.brave.com', response: { json: braveJson } },
    ])

    const got = await searchWithFallback({
      query: 'test',
      fetch: fetchImpl,
      logger: noopLogger,
      ciEnv: { SERPER_API_KEY: 's-key', BRAVE_API_KEY: 'b-key' },
    })

    expect(got.provider).toBe('brave')
    expect(got.result).toContain('Brave Hit')
    expect(calls[0].url).toContain('google.serper.dev')
    expect(calls[1].url).toContain('api.search.brave.com')
  })

  test('all providers fail → error names every provider tried', async () => {
    const { fetchImpl } = makeRoutedFetch([
      {
        match: 'google.serper.dev',
        response: { ok: false, status: 429, json: {} },
      },
      {
        match: 'api.search.brave.com',
        response: { ok: false, status: 429, json: {} },
      },
    ])

    const got = await searchWithFallback({
      query: 'test',
      fetch: fetchImpl,
      logger: noopLogger,
      ciEnv: { SERPER_API_KEY: 's-key', BRAVE_API_KEY: 'b-key' },
    })

    expect(got.result).toBeUndefined()
    expect(got.error).toContain('serper')
    expect(got.error).toContain('brave')
  })

  test('CBM_SEARCH_PROVIDER=tavily tried before serper', async () => {
    const { calls, fetchImpl } = makeRoutedFetch([
      { match: 'api.tavily.com', response: { json: tavilyJson } },
    ])

    const got = await searchWithFallback({
      query: 'test',
      fetch: fetchImpl,
      logger: noopLogger,
      ciEnv: {
        SERPER_API_KEY: 's-key',
        TAVILY_API_KEY: 't-key',
        CBM_SEARCH_PROVIDER: 'tavily',
      },
    })

    expect(got.provider).toBe('tavily')
    expect(calls[0].url).toContain('api.tavily.com')
  })
})
