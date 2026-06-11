// ------- byok-web-tools.test.ts — BYOK direct dispatch for web tools ------- //

/*
Depends on: bun:test; ../codebuff-web-api (facade under test);
@codebuff/common/env-schema (clientEnvSchema for BYOK-default ClientEnv,
SENTINEL_BACKEND_URL).
Data shapes: facade results ({result|documentation, error, creditsUsed});
mock fetch captures (url, init) pairs for assertion.
*/

import { clientEnvSchema, SENTINEL_BACKEND_URL } from '@codebuff/common/env-schema'
import { describe, expect, test } from 'bun:test'

import { callDocsSearchAPI, callWebSearchAPI } from '../codebuff-web-api'

import type { Logger } from '@codebuff/common/types/contracts/logger'

// ------------------------------ Test fixtures ------------------------------ //

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

// BYOK default client env — NEXT_PUBLIC_CODEBUFF_APP_URL resolves to the sentinel
const byokClientEnv = clientEnvSchema.parse({})

// Records every fetch call and serves canned responses by URL substring
function makeRoutedFetch(
  routes: Array<{
    match: string
    response: { ok?: boolean; status?: number; json?: unknown; text?: string }
  }>,
) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl = (async (url: unknown, init?: unknown) => {
    const urlStr = String(url)
    calls.push({ url: urlStr, init: init as RequestInit })
    const route = routes.find((r) => urlStr.includes(r.match))
    if (!route) {
      throw new Error(`Unable to connect (no route for ${urlStr})`)
    }
    const { ok = true, status = 200, json, text } = route.response
    return {
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      json: async () => json,
      text: async () => text ?? JSON.stringify(json),
      headers: new Headers(),
    } as unknown as Response
  }) as typeof fetch
  return { calls, fetchImpl }
}

// --------------------- web_search — BYOK direct Serper --------------------- //

describe('callWebSearchAPI — BYOK direct Serper dispatch', () => {
  test('backend unconfigured + SERPER_API_KEY set → calls Serper directly, never dials sentinel', async () => {
    const serperJson = {
      organic: [
        { title: 'Result A', link: 'https://a.example', snippet: 'alpha' },
      ],
    }
    const { calls, fetchImpl } = makeRoutedFetch([
      { match: 'google.serper.dev', response: { json: serperJson } },
    ])

    const got = await callWebSearchAPI({
      query: 'test query',
      depth: 'standard',
      fetch: fetchImpl,
      logger: noopLogger,
      env: {
        clientEnv: byokClientEnv,
        ciEnv: { SERPER_API_KEY: 'sk-serper-test' },
      },
      // BYOK handler always passes a truthy provider key — must NOT trigger backend path
      apiKey: 'sk-byok-provider-key',
    })

    expect(got.error).toBeUndefined()
    expect(got.result).toContain('Result A')
    expect(calls.some((c) => c.url.includes('google.serper.dev'))).toBe(true)
    expect(calls.some((c) => c.url.includes(SENTINEL_BACKEND_URL))).toBe(false)
    // Serper auth header carried the key
    const serperCall = calls.find((c) => c.url.includes('google.serper.dev'))!
    expect(
      (serperCall.init?.headers as Record<string, string>)['X-API-KEY'],
    ).toBe('sk-serper-test')
  })

  test('backend unconfigured + no SERPER_API_KEY → setup-hint error, zero network calls', async () => {
    const { calls, fetchImpl } = makeRoutedFetch([])

    const got = await callWebSearchAPI({
      query: 'test query',
      fetch: fetchImpl,
      logger: noopLogger,
      env: { clientEnv: byokClientEnv, ciEnv: {} },
      apiKey: 'sk-byok-provider-key',
    })

    expect(got.result).toBeUndefined()
    expect(got.error).toContain('SERPER_API_KEY')
    expect(calls.length).toBe(0)
  })

  test('backend configured → upstream proxy path unchanged', async () => {
    const { calls, fetchImpl } = makeRoutedFetch([
      {
        match: 'backend.example/api/v1/web-search',
        response: { json: { result: 'proxied result', creditsUsed: 2 } },
      },
    ])

    const got = await callWebSearchAPI({
      query: 'test query',
      fetch: fetchImpl,
      logger: noopLogger,
      env: {
        clientEnv: {
          ...byokClientEnv,
          NEXT_PUBLIC_CODEBUFF_APP_URL: 'https://backend.example',
        },
        ciEnv: { CODEBUFF_API_KEY: 'cb-key', SERPER_API_KEY: 'sk-serper-test' },
      },
      apiKey: 'cb-key',
    })

    expect(got.result).toBe('proxied result')
    expect(got.creditsUsed).toBe(2)
    expect(calls.some((c) => c.url.includes('google.serper.dev'))).toBe(false)
  })

  test('Serper failure (null from client) → clear error, not a sentinel dial', async () => {
    const { fetchImpl } = makeRoutedFetch([
      {
        match: 'google.serper.dev',
        response: { ok: false, status: 500, json: {} },
      },
    ])

    const got = await callWebSearchAPI({
      query: 'test query',
      fetch: fetchImpl,
      logger: noopLogger,
      env: {
        clientEnv: byokClientEnv,
        ciEnv: { SERPER_API_KEY: 'sk-serper-test' },
      },
      apiKey: 'sk-byok-provider-key',
    })

    expect(got.result).toBeUndefined()
    expect(got.error).toBeTruthy()
    expect(got.error).not.toContain('Unable to connect')
  })
})

// --------------------- read_docs — BYOK direct Context7 --------------------- //

describe('callDocsSearchAPI — BYOK direct Context7 dispatch', () => {
  const context7Routes = (docText: string) => [
    {
      match: 'context7.com/api/v1/search',
      response: {
        json: {
          results: [
            {
              id: 'react',
              title: 'React',
              description: 'UI library',
              branch: 'main',
              lastUpdateDate: '2026-01-01',
              state: 'finalized',
              totalTokens: 1000,
              totalSnippets: 10,
              totalPages: 5,
            },
          ],
        },
      },
    },
    { match: 'context7.com/api/v1/react', response: { text: docText } },
  ]

  test('backend unconfigured → fetches docs from Context7 directly, never dials sentinel', async () => {
    const { calls, fetchImpl } = makeRoutedFetch(
      context7Routes('React hooks documentation body'),
    )

    const got = await callDocsSearchAPI({
      libraryTitle: 'React',
      topic: 'hooks',
      fetch: fetchImpl,
      logger: noopLogger,
      env: { clientEnv: byokClientEnv, ciEnv: {} },
    })

    expect(got.error).toBeUndefined()
    expect(got.documentation).toBe('React hooks documentation body')
    expect(calls.some((c) => c.url.includes('context7.com'))).toBe(true)
    expect(calls.some((c) => c.url.includes(SENTINEL_BACKEND_URL))).toBe(false)
  })

  test('no CONTEXT7_API_KEY → requests carry no Authorization header (not "Bearer undefined")', async () => {
    const saved = process.env.CONTEXT7_API_KEY
    delete process.env.CONTEXT7_API_KEY
    try {
      const { calls, fetchImpl } = makeRoutedFetch(context7Routes('doc body'))

      await callDocsSearchAPI({
        libraryTitle: 'React',
        fetch: fetchImpl,
        logger: noopLogger,
        env: { clientEnv: byokClientEnv, ciEnv: {} },
      })

      for (const call of calls) {
        const auth = (call.init?.headers as Record<string, string>)?.[
          'Authorization'
        ]
        expect(auth).toBeUndefined()
      }
    } finally {
      if (saved !== undefined) process.env.CONTEXT7_API_KEY = saved
    }
  })

  test('library not found on Context7 → clear error', async () => {
    const { fetchImpl } = makeRoutedFetch([
      {
        match: 'context7.com/api/v1/search',
        response: { json: { results: [] } },
      },
    ])

    const got = await callDocsSearchAPI({
      libraryTitle: 'NoSuchLib',
      fetch: fetchImpl,
      logger: noopLogger,
      env: { clientEnv: byokClientEnv, ciEnv: {} },
    })

    expect(got.documentation).toBeUndefined()
    expect(got.error).toContain('NoSuchLib')
  })

  test('backend configured → upstream proxy path unchanged', async () => {
    const { calls, fetchImpl } = makeRoutedFetch([
      {
        match: 'backend.example/api/v1/docs-search',
        response: { json: { documentation: 'proxied docs', creditsUsed: 1 } },
      },
    ])

    const got = await callDocsSearchAPI({
      libraryTitle: 'React',
      fetch: fetchImpl,
      logger: noopLogger,
      env: {
        clientEnv: {
          ...byokClientEnv,
          NEXT_PUBLIC_CODEBUFF_APP_URL: 'https://backend.example',
        },
        ciEnv: { CODEBUFF_API_KEY: 'cb-key' },
      },
    })

    expect(got.documentation).toBe('proxied docs')
    expect(got.creditsUsed).toBe(1)
    expect(calls.some((c) => c.url.includes('context7.com'))).toBe(false)
  })
})
