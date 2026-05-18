import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  MODEL_CATALOG,
  clearAllCachedModels,
  clearCachedModels,
  fetchModelsFromEndpoint,
  getModelsForPreset,
  isCacheFresh,
  readCachedModels,
  writeCachedModels,
} from '../providers-models'

let tmpDir: string
let cachePath: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-models-'))
  cachePath = path.join(tmpDir, 'models-cache.json')
})

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
})

describe('providers-models — catalog', () => {
  test('catalog presets are populated, churning presets are empty', () => {
    expect(MODEL_CATALOG.openai.length).toBeGreaterThan(0)
    expect(MODEL_CATALOG.anthropic.length).toBeGreaterThan(0)
    expect(MODEL_CATALOG['opencode-go'].length).toBeGreaterThan(0)
    expect(MODEL_CATALOG.openrouter.length).toBe(0)
    expect(MODEL_CATALOG.together.length).toBe(0)
    expect(MODEL_CATALOG.groq.length).toBe(0)
    expect(MODEL_CATALOG['custom-openai'].length).toBe(0)
  })
})

describe('providers-models — cache I/O', () => {
  test('readCachedModels on missing file returns null', () => {
    const got = readCachedModels({
      preset: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      filePath: cachePath,
    })
    expect(got).toBeNull()
  })

  test('writeCachedModels round-trips', () => {
    writeCachedModels({
      preset: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      models: ['anthropic/claude-sonnet-4.5', 'openai/gpt-5.1'],
      filePath: cachePath,
    })
    const got = readCachedModels({
      preset: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      filePath: cachePath,
    })
    expect(got?.models).toEqual([
      'anthropic/claude-sonnet-4.5',
      'openai/gpt-5.1',
    ])
    expect(typeof got?.fetchedAt).toBe('number')
  })

  test('cache key normalizes trailing slashes', () => {
    writeCachedModels({
      preset: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1/////',
      models: ['x'],
      filePath: cachePath,
    })
    const got = readCachedModels({
      preset: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      filePath: cachePath,
    })
    expect(got?.models).toEqual(['x'])
  })

  test('isCacheFresh respects 24h window', () => {
    const justNow = { fetchedAt: Date.now(), models: ['x'] }
    expect(isCacheFresh(justNow)).toBe(true)
    const stale = { fetchedAt: Date.now() - 25 * 60 * 60 * 1000, models: ['x'] }
    expect(isCacheFresh(stale)).toBe(false)
  })

  test('clearCachedModels removes a single entry', () => {
    writeCachedModels({
      preset: 'openrouter',
      baseUrl: 'https://x/v1',
      models: ['a'],
      filePath: cachePath,
    })
    writeCachedModels({
      preset: 'together',
      baseUrl: 'https://y/v1',
      models: ['b'],
      filePath: cachePath,
    })
    expect(
      clearCachedModels({
        preset: 'openrouter',
        baseUrl: 'https://x/v1',
        filePath: cachePath,
      }),
    ).toBe(true)
    expect(
      readCachedModels({
        preset: 'openrouter',
        baseUrl: 'https://x/v1',
        filePath: cachePath,
      }),
    ).toBeNull()
    expect(
      readCachedModels({
        preset: 'together',
        baseUrl: 'https://y/v1',
        filePath: cachePath,
      })?.models,
    ).toEqual(['b'])
  })

  test('clearAllCachedModels empties the file', () => {
    writeCachedModels({
      preset: 'openrouter',
      baseUrl: 'https://x/v1',
      models: ['a'],
      filePath: cachePath,
    })
    clearAllCachedModels(cachePath)
    expect(
      readCachedModels({
        preset: 'openrouter',
        baseUrl: 'https://x/v1',
        filePath: cachePath,
      }),
    ).toBeNull()
  })

  test('corrupt cache file is treated as empty', () => {
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.writeFileSync(cachePath, 'not json')
    expect(
      readCachedModels({
        preset: 'openrouter',
        baseUrl: 'https://x/v1',
        filePath: cachePath,
      }),
    ).toBeNull()
  })
})

describe('providers-models — fetchModelsFromEndpoint', () => {
  test('parses OpenAI-compat /models response', async () => {
    const fetchImpl = mock(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'model-a' },
            { id: 'model-b' },
            { id: '' },
            { notAnId: true },
          ],
        }),
      }) as unknown as Response,
    ) as unknown as typeof fetch

    const got = await fetchModelsFromEndpoint({
      baseUrl: 'https://x.example/v1',
      apiKey: 'sk-x',
      fetchImpl,
    })
    expect(got).toEqual(['model-a', 'model-b'])
  })

  test('throws on non-2xx', async () => {
    const fetchImpl = mock(async () =>
      ({ ok: false, status: 401, json: async () => ({}) }) as unknown as Response,
    ) as unknown as typeof fetch

    await expect(
      fetchModelsFromEndpoint({
        baseUrl: 'https://x.example/v1',
        apiKey: 'sk-x',
        fetchImpl,
      }),
    ).rejects.toThrow(/401/)
  })

  test('throws on missing data array', async () => {
    const fetchImpl = mock(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ something: 'else' }),
      }) as unknown as Response,
    ) as unknown as typeof fetch

    await expect(
      fetchModelsFromEndpoint({
        baseUrl: 'https://x.example/v1',
        apiKey: 'sk-x',
        fetchImpl,
      }),
    ).rejects.toThrow(/unexpected shape/)
  })

  test('strips trailing slash on baseUrl before appending /models', async () => {
    let calledUrl = ''
    const fetchImpl = mock(async (url: unknown) => {
      calledUrl = String(url)
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as unknown as Response
    }) as unknown as typeof fetch

    await fetchModelsFromEndpoint({
      baseUrl: 'https://x.example/v1///',
      apiKey: 'sk-x',
      fetchImpl,
    })
    expect(calledUrl).toBe('https://x.example/v1/models')
  })
})

describe('providers-models — getModelsForPreset', () => {
  test('catalog preset returns hardcoded list without network', async () => {
    let called = false
    const fetchImpl = mock(async () => {
      called = true
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as unknown as Response
    }) as unknown as typeof fetch

    const got = await getModelsForPreset({
      preset: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-ant',
      filePath: cachePath,
      fetchImpl,
    })
    expect(got.source).toBe('catalog')
    expect(got.models).toEqual(MODEL_CATALOG.anthropic)
    expect(called).toBe(false)
  })

  test('custom-openai returns freetext with no network', async () => {
    let called = false
    const fetchImpl = mock(async () => {
      called = true
      return {} as unknown as Response
    }) as unknown as typeof fetch

    const got = await getModelsForPreset({
      preset: 'custom-openai',
      baseUrl: 'http://localhost:1234/v1',
      apiKey: '',
      filePath: cachePath,
      fetchImpl,
    })
    expect(got.source).toBe('freetext')
    expect(got.models).toEqual([])
    expect(called).toBe(false)
  })

  test('churning preset probes on first call, then serves cache', async () => {
    let callCount = 0
    const fetchImpl = mock(async () => {
      callCount++
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 'or/model-1' }, { id: 'or/model-2' }],
        }),
      } as unknown as Response
    }) as unknown as typeof fetch

    const first = await getModelsForPreset({
      preset: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-or',
      filePath: cachePath,
      fetchImpl,
    })
    expect(first.source).toBe('probe')
    expect(first.models).toEqual(['or/model-1', 'or/model-2'])
    expect(callCount).toBe(1)

    const second = await getModelsForPreset({
      preset: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-or',
      filePath: cachePath,
      fetchImpl,
    })
    expect(second.source).toBe('cache')
    expect(second.models).toEqual(['or/model-1', 'or/model-2'])
    expect(callCount).toBe(1)
  })

  test('forceRefresh bypasses fresh cache', async () => {
    writeCachedModels({
      preset: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      models: ['stale-model'],
      filePath: cachePath,
    })
    const fetchImpl = mock(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'fresh-model' }] }),
      }) as unknown as Response,
    ) as unknown as typeof fetch

    const got = await getModelsForPreset({
      preset: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-or',
      filePath: cachePath,
      forceRefresh: true,
      fetchImpl,
    })
    expect(got.source).toBe('probe')
    expect(got.models).toEqual(['fresh-model'])
  })

  test('stale cache (>24h) triggers re-probe', async () => {
    const fixedNow = 1_700_000_000_000
    writeCachedModels({
      preset: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      models: ['stale'],
      filePath: cachePath,
    })
    // Forcibly age the entry past TTL
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
    const key = Object.keys(raw)[0]
    raw[key].fetchedAt = fixedNow - 25 * 60 * 60 * 1000
    fs.writeFileSync(cachePath, JSON.stringify(raw))

    const fetchImpl = mock(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'fresh' }] }),
      }) as unknown as Response,
    ) as unknown as typeof fetch

    const got = await getModelsForPreset({
      preset: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-or',
      filePath: cachePath,
      fetchImpl,
      now: fixedNow,
    })
    expect(got.source).toBe('probe')
    expect(got.models).toEqual(['fresh'])
  })
})
