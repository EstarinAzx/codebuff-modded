/**
 * BYOK provider profile store. Persists user-supplied LLM provider credentials
 * (preset, baseUrl, model, apiKey) to a 0600 file at
 * `~/.config/manicode/providers.json` (sister to `credentials.json`).
 *
 * All public functions accept an optional `filePath` for testability.
 *
 * NOTE: 0600 perms are best-effort. `chmod` is a no-op on Windows; the file
 * still lands in the user's profile directory which is per-user access only.
 */

import { randomBytes } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'

export type ProviderPreset =
  | 'openai'
  | 'anthropic'
  | 'opencode'
  | 'opencode-go'
  | 'openrouter'
  | 'mistral'
  | 'together'
  | 'groq'
  | 'deepseek'
  | 'gemini'
  | 'custom-openai'

export type ProviderProtocol = 'openai' | 'anthropic'

export type ProviderProfile = {
  id: string
  name: string
  preset: ProviderPreset
  provider: ProviderProtocol
  baseUrl: string
  model: string
  apiKey: string
  createdAt: string
  isActive?: boolean
}

export type ProviderPresetDefaults = {
  preset: ProviderPreset
  name: string
  provider: ProviderProtocol
  baseUrl: string
  defaultModel: string
  requiresApiKey: boolean
}

type ProvidersFile = {
  version: 2
  activeProfileId: string | null
  profiles: ProviderProfile[]
  /**
   * agentId → profileId map. When an agent runs and its id has a binding,
   * SDK Path C dispatches through that profile instead of the active one.
   * Bindings referencing missing profiles are pruned at read time.
   */
  agentBindings: Record<string, string>
}

const PROVIDERS_FILE_VERSION = 2 as const

// ── path resolution ──────────────────────────────────────────────────────
// Avoid importing cli/utils/auth.ts here — that pulls in the codebuff-api
// surface and would couple Phase 1 to backend code that Phase 5 strips.
// Re-implement the same shape inline; env-suffix logic matches auth.ts.

function getDefaultConfigDir(): string {
  const envSuffix = process.env.NEXT_PUBLIC_CB_ENVIRONMENT
  const dirName =
    envSuffix && envSuffix !== 'prod' ? `manicode-${envSuffix}` : 'manicode'
  return path.join(os.homedir(), '.config', dirName)
}

export function getProvidersFilePath(): string {
  return (
    process.env.CODEBUFF_PROVIDERS_PATH ??
    path.join(getDefaultConfigDir(), 'providers.json')
  )
}

// ── preset catalog ───────────────────────────────────────────────────────

const PRESET_DEFAULTS: Record<ProviderPreset, ProviderPresetDefaults> = {
  openai: {
    preset: 'openai',
    name: 'OpenAI',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5.1',
    requiresApiKey: true,
  },
  anthropic: {
    preset: 'anthropic',
    name: 'Anthropic',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4.5',
    requiresApiKey: true,
  },
  opencode: {
    preset: 'opencode',
    name: 'OpenCode Zen',
    provider: 'openai',
    baseUrl: 'https://opencode.ai/zen/v1',
    defaultModel: 'minimax-m2.7',
    requiresApiKey: true,
  },
  'opencode-go': {
    preset: 'opencode-go',
    name: 'OpenCode Go',
    provider: 'openai',
    baseUrl: 'https://opencode.ai/zen/go/v1',
    defaultModel: 'glm-5',
    requiresApiKey: true,
  },
  openrouter: {
    preset: 'openrouter',
    name: 'OpenRouter',
    provider: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4.5',
    requiresApiKey: true,
  },
  mistral: {
    preset: 'mistral',
    name: 'Mistral',
    provider: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    requiresApiKey: true,
  },
  together: {
    preset: 'together',
    name: 'Together AI',
    provider: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    requiresApiKey: true,
  },
  groq: {
    preset: 'groq',
    name: 'Groq',
    provider: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    requiresApiKey: true,
  },
  deepseek: {
    preset: 'deepseek',
    name: 'DeepSeek',
    provider: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    requiresApiKey: true,
  },
  gemini: {
    preset: 'gemini',
    name: 'Google Gemini',
    provider: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-pro',
    requiresApiKey: true,
  },
  'custom-openai': {
    preset: 'custom-openai',
    name: 'Custom OpenAI-compatible',
    provider: 'openai',
    baseUrl: '',
    defaultModel: '',
    requiresApiKey: false,
  },
}

export function getPresetDefaults(
  preset: ProviderPreset,
): ProviderPresetDefaults {
  return PRESET_DEFAULTS[preset]
}

export function listPresets(): ProviderPreset[] {
  return Object.keys(PRESET_DEFAULTS) as ProviderPreset[]
}

// ── normalization + validation ───────────────────────────────────────────

function trim(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBaseUrl(url: string): string {
  return trim(url).replace(/\/+$/, '')
}

function isValidPreset(value: unknown): value is ProviderPreset {
  return typeof value === 'string' && value in PRESET_DEFAULTS
}

function isValidProtocol(value: unknown): value is ProviderProtocol {
  return value === 'openai' || value === 'anthropic'
}

function sanitizeProfile(raw: unknown): ProviderProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const id = trim(r.id as string | undefined)
  const name = trim(r.name as string | undefined)
  const preset = r.preset
  const provider = r.provider
  const baseUrl = normalizeBaseUrl((r.baseUrl as string | undefined) ?? '')
  const model = trim(r.model as string | undefined)
  const apiKey = trim(r.apiKey as string | undefined)
  const createdAt = trim(r.createdAt as string | undefined)

  if (
    !id ||
    !name ||
    !isValidPreset(preset) ||
    !isValidProtocol(provider) ||
    !baseUrl
  ) {
    return null
  }

  return {
    id,
    name,
    preset,
    provider,
    baseUrl,
    model,
    apiKey,
    createdAt: createdAt || new Date().toISOString(),
    isActive: r.isActive === true ? true : undefined,
  }
}

function newProfileId(): string {
  return `prof_${randomBytes(8).toString('hex')}`
}

// ── file I/O ─────────────────────────────────────────────────────────────

function defaultFile(): ProvidersFile {
  return {
    version: PROVIDERS_FILE_VERSION,
    activeProfileId: null,
    profiles: [],
    agentBindings: {},
  }
}

function sanitizeBindings(
  raw: unknown,
  profiles: ProviderProfile[],
): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string> = {}
  const profileIds = new Set(profiles.map((p) => p.id))
  for (const [agentId, profileId] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof agentId !== 'string' || !agentId.trim()) continue
    if (typeof profileId !== 'string' || !profileId.trim()) continue
    if (!profileIds.has(profileId)) continue
    out[agentId.trim()] = profileId.trim()
  }
  return out
}

function readFile(filePath: string): ProvidersFile {
  if (!fs.existsSync(filePath)) return defaultFile()
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch {
    return defaultFile()
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return defaultFile()
  }
  if (!parsed || typeof parsed !== 'object') return defaultFile()
  const p = parsed as Record<string, unknown>
  const profiles = Array.isArray(p.profiles)
    ? p.profiles
        .map(sanitizeProfile)
        .filter((x): x is ProviderProfile => x !== null)
    : []
  const activeId = trim(p.activeProfileId as string | undefined) || null
  const validActive =
    activeId && profiles.some((pr) => pr.id === activeId) ? activeId : null
  const agentBindings = sanitizeBindings(p.agentBindings, profiles)
  return {
    version: PROVIDERS_FILE_VERSION,
    activeProfileId: validActive,
    profiles,
    agentBindings,
  }
}

function atomicWrite(filePath: string, file: ProvidersFile): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  const json = JSON.stringify(file, null, 2)
  // Write with mode 0600 from the start so the temp file is never world-readable.
  fs.writeFileSync(tmp, json, { mode: 0o600 })
  try {
    fs.renameSync(tmp, filePath)
  } catch (err) {
    // Cleanup temp on failure
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* ignore */
    }
    throw err
  }
  // Re-apply perms in case rename inherited umask on some filesystems.
  // chmod is a no-op on Windows — acceptable, file lives in per-user dir.
  try {
    fs.chmodSync(filePath, 0o600)
  } catch {
    /* ignore on platforms that reject chmod */
  }
}

// ── public API ───────────────────────────────────────────────────────────

export function loadProfiles(filePath: string = getProvidersFilePath()): ProviderProfile[] {
  return readFile(filePath).profiles
}

export function saveProfiles(
  profiles: ProviderProfile[],
  filePath: string = getProvidersFilePath(),
): void {
  const current = readFile(filePath)
  const activeId =
    current.activeProfileId && profiles.some((p) => p.id === current.activeProfileId)
      ? current.activeProfileId
      : null
  const agentBindings = sanitizeBindings(current.agentBindings, profiles)
  atomicWrite(filePath, {
    version: PROVIDERS_FILE_VERSION,
    activeProfileId: activeId,
    profiles,
    agentBindings,
  })
}

export function getActiveProfile(
  filePath: string = getProvidersFilePath(),
): ProviderProfile | null {
  const file = readFile(filePath)
  if (!file.activeProfileId) return null
  return file.profiles.find((p) => p.id === file.activeProfileId) ?? null
}

export function setActiveProfile(
  id: string,
  filePath: string = getProvidersFilePath(),
): ProviderProfile | null {
  const file = readFile(filePath)
  const profile = file.profiles.find((p) => p.id === id)
  if (!profile) return null
  atomicWrite(filePath, { ...file, activeProfileId: id })
  return profile
}

export function clearActiveProfile(filePath: string = getProvidersFilePath()): void {
  const file = readFile(filePath)
  atomicWrite(filePath, { ...file, activeProfileId: null })
}

export type AddProfileInput = {
  name: string
  preset: ProviderPreset
  apiKey?: string
  baseUrl?: string
  model?: string
  makeActive?: boolean
}

export function addProfile(
  input: AddProfileInput,
  filePath: string = getProvidersFilePath(),
): ProviderProfile {
  const defaults = getPresetDefaults(input.preset)
  const baseUrl = normalizeBaseUrl(input.baseUrl ?? defaults.baseUrl)
  if (!baseUrl) {
    throw new Error(`baseUrl required for preset "${input.preset}"`)
  }
  const profile: ProviderProfile = {
    id: newProfileId(),
    name: trim(input.name) || defaults.name,
    preset: input.preset,
    provider: defaults.provider,
    baseUrl,
    model: trim(input.model) || defaults.defaultModel,
    apiKey: trim(input.apiKey),
    createdAt: new Date().toISOString(),
  }
  if (defaults.requiresApiKey && !profile.apiKey) {
    throw new Error(`apiKey required for preset "${input.preset}"`)
  }
  const file = readFile(filePath)
  const profiles = [...file.profiles, profile]
  const makeActive = input.makeActive ?? file.profiles.length === 0
  atomicWrite(filePath, {
    ...file,
    profiles,
    activeProfileId: makeActive ? profile.id : file.activeProfileId,
  })
  return profile
}

export type UpdateProfileInput = Partial<
  Pick<ProviderProfile, 'name' | 'baseUrl' | 'model' | 'apiKey'>
>

export function updateProfile(
  id: string,
  patch: UpdateProfileInput,
  filePath: string = getProvidersFilePath(),
): ProviderProfile | null {
  const file = readFile(filePath)
  const idx = file.profiles.findIndex((p) => p.id === id)
  if (idx < 0) return null
  const current = file.profiles[idx]
  const next: ProviderProfile = {
    ...current,
    name: patch.name !== undefined ? trim(patch.name) || current.name : current.name,
    baseUrl:
      patch.baseUrl !== undefined
        ? normalizeBaseUrl(patch.baseUrl) || current.baseUrl
        : current.baseUrl,
    model: patch.model !== undefined ? trim(patch.model) : current.model,
    apiKey: patch.apiKey !== undefined ? trim(patch.apiKey) : current.apiKey,
  }
  const profiles = [...file.profiles]
  profiles[idx] = next
  atomicWrite(filePath, { ...file, profiles })
  return next
}

export function removeProfile(
  id: string,
  filePath: string = getProvidersFilePath(),
): boolean {
  const file = readFile(filePath)
  const profiles = file.profiles.filter((p) => p.id !== id)
  if (profiles.length === file.profiles.length) return false
  const activeId =
    file.activeProfileId === id ? (profiles[0]?.id ?? null) : file.activeProfileId
  const agentBindings = sanitizeBindings(file.agentBindings, profiles)
  atomicWrite(filePath, {
    version: PROVIDERS_FILE_VERSION,
    profiles,
    activeProfileId: activeId,
    agentBindings,
  })
  return true
}

// ── agent → profile bindings ─────────────────────────────────────────────

export function loadAgentBindings(
  filePath: string = getProvidersFilePath(),
): Record<string, string> {
  return readFile(filePath).agentBindings
}

export function getAgentBinding(
  agentId: string,
  filePath: string = getProvidersFilePath(),
): ProviderProfile | null {
  const file = readFile(filePath)
  const profileId = file.agentBindings[agentId]
  if (!profileId) return null
  return file.profiles.find((p) => p.id === profileId) ?? null
}

export function setAgentBinding(
  agentId: string,
  profileId: string,
  filePath: string = getProvidersFilePath(),
): ProviderProfile | null {
  const trimmedAgent = agentId.trim()
  if (!trimmedAgent) return null
  const file = readFile(filePath)
  const profile = file.profiles.find((p) => p.id === profileId)
  if (!profile) return null
  const agentBindings = { ...file.agentBindings, [trimmedAgent]: profile.id }
  atomicWrite(filePath, { ...file, agentBindings })
  return profile
}

export function clearAgentBinding(
  agentId: string,
  filePath: string = getProvidersFilePath(),
): boolean {
  const trimmedAgent = agentId.trim()
  if (!trimmedAgent) return false
  const file = readFile(filePath)
  if (!(trimmedAgent in file.agentBindings)) return false
  const { [trimmedAgent]: _removed, ...rest } = file.agentBindings
  atomicWrite(filePath, { ...file, agentBindings: rest })
  return true
}

/**
 * Build the binding map the SDK expects:
 * `{ [agentId]: { provider, baseUrl, apiKey, model } }`. Skips entries whose
 * profile has been deleted (the sanitizer already prunes these on read, but
 * we re-check here to be defensive against races).
 */
export function buildSdkBindings(
  filePath: string = getProvidersFilePath(),
): Record<string, {
  provider: ProviderProtocol
  baseUrl: string
  apiKey: string
  model?: string
}> {
  const file = readFile(filePath)
  const profilesById = new Map(file.profiles.map((p) => [p.id, p]))
  const out: Record<string, {
    provider: ProviderProtocol
    baseUrl: string
    apiKey: string
    model?: string
  }> = {}
  for (const [agentId, profileId] of Object.entries(file.agentBindings)) {
    const profile = profilesById.get(profileId)
    if (!profile) continue
    out[agentId] = {
      provider: profile.provider,
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      model: profile.model || undefined,
    }
  }
  return out
}

// ── safe display helpers ─────────────────────────────────────────────────

export function maskApiKey(apiKey: string | undefined): string {
  if (!apiKey) return '<unset>'
  if (apiKey.length <= 4) return '****'
  return `****${apiKey.slice(-4)}`
}

export function describeProfileForLog(profile: ProviderProfile): {
  id: string
  name: string
  preset: ProviderPreset
  provider: ProviderProtocol
  baseUrl: string
  model: string
  apiKey: string
} {
  return {
    id: profile.id,
    name: profile.name,
    preset: profile.preset,
    provider: profile.provider,
    baseUrl: profile.baseUrl,
    model: profile.model,
    apiKey: maskApiKey(profile.apiKey),
  }
}
