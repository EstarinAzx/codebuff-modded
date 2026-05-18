/**
 * /providers* + /model command handlers (BYOK Phase 3a — text-mode).
 *
 * These work without the providers-panel UI. Phase 3b layers a wizard panel
 * on top for the interactive add/edit/model-picker flows; this file remains
 * the source of truth for the command logic.
 */

import { setActiveByokProfile } from '@codebuff/sdk'

import {
  addProfile,
  describeProfileForLog,
  getActiveProfile,
  getPresetDefaults,
  listPresets,
  loadProfiles,
  maskApiKey,
  removeProfile,
  setActiveProfile,
  updateProfile,
  type ProviderPreset,
  type ProviderProfile,
} from '../utils/providers'
import {
  clearCachedModels,
  fetchModelsFromEndpoint,
} from '../utils/providers-models'

import type { RouterParams } from './command-registry'

// ── shared helpers ───────────────────────────────────────────────────────

function syncSdkActiveProfile(profile: ProviderProfile | null): void {
  if (!profile) {
    setActiveByokProfile(null)
    return
  }
  setActiveByokProfile({
    provider: profile.provider,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
  })
}

function fmtProfileLine(profile: ProviderProfile, active: boolean): string {
  const marker = active ? '*' : ' '
  return `  ${marker} ${profile.id}  ${profile.name}  (${profile.preset})  ${profile.baseUrl}  model=${profile.model || '<unset>'}  key=${maskApiKey(profile.apiKey)}`
}

function parseProfileRef(args: string, profiles: ProviderProfile[]): ProviderProfile | null {
  const ref = args.trim()
  if (!ref) return null
  // Match by id (prefix-allowed) OR exact name
  const byId = profiles.filter((p) => p.id === ref || p.id.startsWith(ref))
  if (byId.length === 1) return byId[0]
  const byName = profiles.filter((p) => p.name === ref)
  if (byName.length === 1) return byName[0]
  return null
}

function isPreset(value: string): value is ProviderPreset {
  return (listPresets() as string[]).includes(value)
}

// ── handlers ─────────────────────────────────────────────────────────────

export function handleProvidersList(): string {
  const profiles = loadProfiles()
  if (profiles.length === 0) {
    return [
      'No BYOK provider profiles configured.',
      '',
      'Add one with:',
      '  /providers:add <preset> <name> <apiKey>',
      '',
      `Available presets: ${listPresets().join(', ')}`,
    ].join('\n')
  }
  const active = getActiveProfile()
  const lines = profiles.map((p) => fmtProfileLine(p, active?.id === p.id))
  return ['BYOK provider profiles (active marked with *):', ...lines].join('\n')
}

export function handleProvidersAdd(args: string): string {
  // Syntax: /providers:add <preset> <name> <apiKey>
  // For presets that require a baseUrl (custom-openai), use:
  //   /providers:add custom-openai <name> <apiKey> <baseUrl> [model]
  const parts = args.trim().split(/\s+/)
  if (parts.length < 1 || !parts[0]) {
    return [
      'Usage: /providers:add <preset> <name> <apiKey>',
      `Presets: ${listPresets().join(', ')}`,
      'For custom-openai: /providers:add custom-openai <name> <apiKey> <baseUrl> [model]',
    ].join('\n')
  }

  const [presetRaw, name, apiKey, baseUrlArg, modelArg] = parts
  if (!isPreset(presetRaw)) {
    return `Unknown preset "${presetRaw}". Available: ${listPresets().join(', ')}`
  }
  if (!name) return 'Missing <name>. Usage: /providers:add <preset> <name> <apiKey>'

  const defaults = getPresetDefaults(presetRaw)
  if (defaults.requiresApiKey && !apiKey) {
    return `Preset "${presetRaw}" requires an API key.`
  }
  if (presetRaw === 'custom-openai' && !baseUrlArg) {
    return 'Preset "custom-openai" requires a baseUrl argument.'
  }

  try {
    const profile = addProfile({
      preset: presetRaw,
      name,
      apiKey: apiKey ?? '',
      baseUrl: baseUrlArg,
      model: modelArg,
      makeActive: true,
    })
    syncSdkActiveProfile(profile)
    return [
      `Added profile "${profile.name}" (${profile.id}) and set active.`,
      `  preset: ${profile.preset}`,
      `  baseUrl: ${profile.baseUrl}`,
      `  model: ${profile.model || '<unset>'}`,
      `  key: ${maskApiKey(profile.apiKey)}`,
    ].join('\n')
  } catch (err) {
    return `Failed to add profile: ${err instanceof Error ? err.message : String(err)}`
  }
}

export function handleProvidersSelect(args: string): string {
  const profiles = loadProfiles()
  if (profiles.length === 0) {
    return 'No profiles configured. Add one with /providers:add'
  }
  if (!args.trim()) {
    const lines = profiles.map((p) => `  ${p.id}  ${p.name}  (${p.preset})`)
    return ['Usage: /providers:select <id|name>', '', 'Profiles:', ...lines].join('\n')
  }
  const target = parseProfileRef(args, profiles)
  if (!target) {
    return `No unique profile matches "${args.trim()}". Use /providers to list.`
  }
  setActiveProfile(target.id)
  syncSdkActiveProfile(target)
  return `Active profile: ${target.name} (${target.id})`
}

export function handleProvidersRemove(args: string): string {
  const profiles = loadProfiles()
  if (profiles.length === 0) return 'No profiles to remove.'
  if (!args.trim()) {
    return 'Usage: /providers:remove <id|name>'
  }
  const target = parseProfileRef(args, profiles)
  if (!target) {
    return `No unique profile matches "${args.trim()}".`
  }
  const wasActive = getActiveProfile()?.id === target.id
  removeProfile(target.id)
  // Resync SDK with whatever is active now
  syncSdkActiveProfile(getActiveProfile())
  const tail = wasActive
    ? ` Active profile cleared${getActiveProfile() ? ` (now: ${getActiveProfile()!.name})` : ''}.`
    : ''
  return `Removed profile "${target.name}" (${target.id}).${tail}`
}

export async function handleProvidersTest(): Promise<string> {
  const profile = getActiveProfile()
  if (!profile) return 'No active profile. Add one with /providers:add.'
  const startedAt = Date.now()
  const baseUrl = profile.baseUrl.replace(/\/+$/, '')

  try {
    if (profile.provider === 'anthropic') {
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': profile.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: profile.model || 'claude-3-5-haiku-latest',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      })
      const elapsed = Date.now() - startedAt
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return `Test failed (${res.status}) after ${elapsed}ms: ${text.slice(0, 200)}`
      }
      return `OK: ${profile.name} responded in ${elapsed}ms (model=${profile.model || '<default>'})`
    }

    // openai-compat path
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${profile.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: profile.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    })
    const elapsed = Date.now() - startedAt
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return `Test failed (${res.status}) after ${elapsed}ms: ${text.slice(0, 200)}`
    }
    return `OK: ${profile.name} responded in ${elapsed}ms (model=${profile.model})`
  } catch (err) {
    const elapsed = Date.now() - startedAt
    return `Test failed after ${elapsed}ms: ${err instanceof Error ? err.message : String(err)}`
  }
}

export function handleProvidersRefreshModels(): string {
  const profile = getActiveProfile()
  if (!profile) return 'No active profile.'
  const removed = clearCachedModels({
    preset: profile.preset,
    baseUrl: profile.baseUrl,
  })
  return removed
    ? `Cleared models cache for "${profile.name}". Next picker open will re-probe.`
    : `No cached models for "${profile.name}". Cache was already empty.`
}

export async function handleModelCommand(args: string): Promise<string> {
  const profile = getActiveProfile()
  if (!profile) return 'No active profile. Add one with /providers:add.'
  const target = args.trim()
  if (!target) {
    // List candidates via live probe so user sees available options
    try {
      const models = await fetchModelsFromEndpoint({
        baseUrl: profile.baseUrl,
        apiKey: profile.apiKey,
      })
      const head = models.slice(0, 20)
      const tail = models.length > 20 ? `\n  …(${models.length - 20} more)` : ''
      return [
        `Current model: ${profile.model || '<unset>'}`,
        '',
        `Available (live probe ${profile.baseUrl}/models):`,
        ...head.map((m) => `  ${m}`),
      ].join('\n') + tail + '\n\nSwap: /model <id>'
    } catch (err) {
      return [
        `Current model: ${profile.model || '<unset>'}`,
        '',
        `Could not probe /models: ${err instanceof Error ? err.message : String(err)}`,
        'Swap directly: /model <id>',
      ].join('\n')
    }
  }
  const updated = updateProfile(profile.id, { model: target })
  if (!updated) return `Failed to update active profile.`
  // Profile shape (baseUrl/apiKey/provider) unchanged → SDK state stays current.
  // No setActiveByokProfile call needed; model is resolved per-request from
  // agent template, not from the SDK singleton.
  return `Active model set to "${target}" for profile "${updated.name}".`
}

export function handleLoginBYOKHint(): string {
  return [
    '/login is not used in BYOK mode.',
    'Use /providers:add to register a provider profile with your own API key.',
    '',
    'Example: /providers:add anthropic personal sk-ant-…',
  ].join('\n')
}

// Re-export to keep router imports tidy
export { describeProfileForLog as __describeProfileForLog }
