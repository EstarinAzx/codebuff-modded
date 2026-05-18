/**
 * Model id sources per provider preset:
 *   - hardcoded `MODEL_CATALOG` (curated, stable lists — Anthropic, OpenAI, etc.)
 *   - live `/v1/models` probe (churning catalogs — OpenRouter, Together, Groq)
 *   - free-text input (custom-openai)
 *
 * Live probe results land in a 24h disk cache at `<configDir>/models-cache.json`.
 * Cache busted by `/providers:refresh-models` (Phase 3).
 *
 * Consumed by `/providers:add` step 4 model picker and `/model` runtime swap.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'

import type { ProviderPreset } from './providers'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export const MODEL_CATALOG: Record<ProviderPreset, string[]> = {
  openai: [
    'gpt-5.1',
    'gpt-5.1-chat',
    'gpt-4.1',
    'gpt-4o',
    'o3',
    'o4-mini',
  ],
  anthropic: [
    'claude-sonnet-4.5',
    'claude-opus-4.1',
    'claude-3.5-haiku',
  ],
  opencode: ['opencode/minimax-m2.7', 'opencode/kimi-k2.6'],
  'opencode-go': ['opencode-go/glm-5'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  mistral: ['mistral-large-latest', 'codestral-latest', 'devstral-latest'],
  // Empty → triggers live /models probe
  openrouter: [],
  together: [],
  groq: [],
  // Empty + special-cased → free-text input
  'custom-openai': [],
}

export type ModelSource = 'catalog' | 'probe' | 'cache' | 'freetext'

export type ModelLookupResult = {
  source: ModelSource
  models: string[]
}

// ── path resolution ──────────────────────────────────────────────────────

function getDefaultConfigDir(): string {
  const envSuffix = process.env.NEXT_PUBLIC_CB_ENVIRONMENT
  const dirName =
    envSuffix && envSuffix !== 'prod' ? `manicode-${envSuffix}` : 'manicode'
  return path.join(os.homedir(), '.config', dirName)
}

export function getModelsCachePath(): string {
  return (
    process.env.CODEBUFF_MODELS_CACHE_PATH ??
    path.join(getDefaultConfigDir(), 'models-cache.json')
  )
}

// ── cache I/O ────────────────────────────────────────────────────────────

type CacheEntry = { fetchedAt: number; models: string[] }
type CacheFile = Record<string, CacheEntry>

function cacheKey(preset: ProviderPreset, baseUrl: string): string {
  return `${preset}:${baseUrl.replace(/\/+$/, '')}`
}

function readCacheFile(filePath: string): CacheFile {
  if (!fs.existsSync(filePath)) return {}
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: CacheFile = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue
      const entry = v as Record<string, unknown>
      const fetchedAt = typeof entry.fetchedAt === 'number' ? entry.fetchedAt : NaN
      const models = Array.isArray(entry.models)
        ? entry.models.filter((m): m is string => typeof m === 'string')
        : null
      if (!Number.isFinite(fetchedAt) || !models) continue
      out[k] = { fetchedAt, models }
    }
    return out
  } catch {
    return {}
  }
}

function writeCacheFile(filePath: string, file: CacheFile): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(file, null, 2), { mode: 0o600 })
  try {
    fs.renameSync(tmp, filePath)
  } catch (err) {
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* ignore */
    }
    throw err
  }
}

export function readCachedModels(params: {
  preset: ProviderPreset
  baseUrl: string
  filePath?: string
}): CacheEntry | null {
  const filePath = params.filePath ?? getModelsCachePath()
  const file = readCacheFile(filePath)
  return file[cacheKey(params.preset, params.baseUrl)] ?? null
}

export function writeCachedModels(params: {
  preset: ProviderPreset
  baseUrl: string
  models: string[]
  filePath?: string
}): void {
  const filePath = params.filePath ?? getModelsCachePath()
  const file = readCacheFile(filePath)
  file[cacheKey(params.preset, params.baseUrl)] = {
    fetchedAt: Date.now(),
    models: params.models,
  }
  writeCacheFile(filePath, file)
}

export function clearCachedModels(params: {
  preset: ProviderPreset
  baseUrl: string
  filePath?: string
}): boolean {
  const filePath = params.filePath ?? getModelsCachePath()
  const file = readCacheFile(filePath)
  const key = cacheKey(params.preset, params.baseUrl)
  if (!(key in file)) return false
  delete file[key]
  writeCacheFile(filePath, file)
  return true
}

export function clearAllCachedModels(filePath?: string): void {
  const resolved = filePath ?? getModelsCachePath()
  writeCacheFile(resolved, {})
}

export function isCacheFresh(entry: CacheEntry, now: number = Date.now()): boolean {
  return now - entry.fetchedAt < CACHE_TTL_MS
}

// ── live probe ───────────────────────────────────────────────────────────

/**
 * GET `<baseUrl>/models` with bearer auth, return the model id list.
 * Assumes OpenAI-compat shape: `{ data: [{ id: string, ... }, ...] }`.
 * Throws on non-2xx or malformed payload.
 */
export async function fetchModelsFromEndpoint(params: {
  baseUrl: string
  apiKey: string
  fetchImpl?: typeof globalThis.fetch
}): Promise<string[]> {
  const baseUrl = params.baseUrl.replace(/\/+$/, '')
  const url = `${baseUrl}/models`
  const fetchFn = params.fetchImpl ?? globalThis.fetch
  const res = await fetchFn(url, {
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`/models probe failed: ${res.status}`)
  }
  const json = (await res.json()) as { data?: Array<{ id?: unknown }> }
  if (!json || !Array.isArray(json.data)) {
    throw new Error('/models probe returned unexpected shape (no `data` array)')
  }
  return json.data
    .map((m) => (typeof m.id === 'string' ? m.id : ''))
    .filter((id) => id.length > 0)
}

// ── orchestrator ─────────────────────────────────────────────────────────

export async function getModelsForPreset(params: {
  preset: ProviderPreset
  baseUrl: string
  apiKey: string
  forceRefresh?: boolean
  filePath?: string
  fetchImpl?: typeof globalThis.fetch
  now?: number
}): Promise<ModelLookupResult> {
  const { preset, baseUrl, apiKey, forceRefresh, filePath, fetchImpl, now } = params

  // Catalog wins when populated — avoids unnecessary network even if user has a key.
  const catalog = MODEL_CATALOG[preset]
  if (catalog.length > 0) return { source: 'catalog', models: catalog }

  if (preset === 'custom-openai') return { source: 'freetext', models: [] }

  // Live probe, cache-first
  if (!forceRefresh) {
    const cached = readCachedModels({ preset, baseUrl, filePath })
    if (cached && isCacheFresh(cached, now)) {
      return { source: 'cache', models: cached.models }
    }
  }

  const models = await fetchModelsFromEndpoint({ baseUrl, apiKey, fetchImpl })
  writeCachedModels({ preset, baseUrl, models, filePath })
  return { source: 'probe', models }
}
