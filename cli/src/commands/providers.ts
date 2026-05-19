/**
 * /providers* + /model command handlers (BYOK Phase 3a — text-mode).
 *
 * These work without the providers-panel UI. Phase 3b layers a wizard panel
 * on top for the interactive add/edit/model-picker flows; this file remains
 * the source of truth for the command logic.
 */

import { setActiveByokProfile, setByokAgentBindings } from '@codebuff/sdk'

import {
  connectCodexOAuthForProfile,
  disconnectCodexProfileOAuth,
} from '../utils/chatgpt-oauth'
import {
  addProfile,
  buildSdkBindings,
  clearAgentBinding,
  describeProfileForLog,
  getActiveProfile,
  getPresetDefaults,
  listPresets,
  loadAgentBindings,
  loadProfiles,
  maskApiKey,
  removeProfile,
  setActiveProfile,
  setAgentBinding,
  updateProfile,
  type ProviderPreset,
  type ProviderProfile,
} from '../utils/providers'
import {
  clearCachedModels,
  getModelsForPreset,
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
    model: profile.model,
    oauthProfileId: profile.oauthProfileId,
  })
}

function syncSdkAgentBindings(): void {
  setByokAgentBindings(buildSdkBindings())
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
  // Accepted forms:
  //   /providers:add <preset> <apiKey>                         (name = preset display name)
  //   /providers:add <preset> <name> <apiKey>
  //   /providers:add custom-openai <apiKey-or-empty> <baseUrl> [model]
  //   /providers:add custom-openai <name> <apiKey> <baseUrl> [model]
  //   /providers:add codex [name]                              (OAuth — no apiKey)
  const parts = args.trim().split(/\s+/).filter((p) => p.length > 0)
  if (parts.length < 1) {
    return [
      'Usage: /providers:add <preset> <apiKey>',
      '   or: /providers:add <preset> <name> <apiKey>',
      `Presets: ${listPresets().join(', ')}`,
      'For custom-openai: /providers:add custom-openai <name> <apiKey> <baseUrl> [model]',
      'For codex (ChatGPT OAuth): /providers:add codex [name]',
    ].join('\n')
  }

  const presetRaw = parts[0]
  if (!isPreset(presetRaw)) {
    return `Unknown preset "${presetRaw}". Available: ${listPresets().join(', ')}`
  }
  if (presetRaw === 'codex') {
    return [
      'Codex (ChatGPT OAuth) profiles use the async add flow.',
      'Run `/providers:add codex` via the slash-command router — the CLI ',
      'handler opens your browser for OAuth and saves the profile on callback.',
    ].join('\n')
  }
  const defaults = getPresetDefaults(presetRaw)

  // Detect 2-arg shortcut: <preset> <apiKey>. Name defaults to preset display.
  // For custom-openai the 3-arg form means <preset> <apiKey> <baseUrl>.
  let name: string
  let apiKey: string
  let baseUrlArg: string | undefined
  let modelArg: string | undefined

  if (parts.length === 2) {
    name = defaults.name
    apiKey = parts[1]
  } else if (presetRaw === 'custom-openai' && parts.length >= 3) {
    // Disambiguate: 3rd arg is baseUrl if it looks like a URL; else it's apiKey.
    const looksLikeUrl = (s: string) => /^https?:\/\//i.test(s)
    if (looksLikeUrl(parts[2])) {
      // <preset> <apiKey-or-empty> <baseUrl> [model]
      name = defaults.name
      apiKey = parts[1]
      baseUrlArg = parts[2]
      modelArg = parts[3]
    } else {
      // <preset> <name> <apiKey> <baseUrl> [model]
      name = parts[1]
      apiKey = parts[2] ?? ''
      baseUrlArg = parts[3]
      modelArg = parts[4]
    }
  } else {
    name = parts[1]
    apiKey = parts[2] ?? ''
    baseUrlArg = parts[3]
    modelArg = parts[4]
  }

  if (defaults.requiresApiKey && !apiKey) {
    return `Preset "${presetRaw}" requires an API key. Try: /providers:add ${presetRaw} <apiKey>`
  }
  if (presetRaw === 'custom-openai' && !baseUrlArg) {
    return 'Preset "custom-openai" requires a baseUrl. Try: /providers:add custom-openai <apiKey> https://your-host/v1 [model]'
  }

  try {
    const profile = addProfile({
      preset: presetRaw,
      name,
      apiKey,
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
  // Drop per-profile OAuth tokens when removing a codex profile so re-adding
  // forces a fresh browser flow (symmetric with /providers:add codex).
  let droppedTokens = false
  if (target.preset === 'codex' && target.oauthProfileId) {
    droppedTokens = disconnectCodexProfileOAuth(target.oauthProfileId)
  }
  // Resync SDK with whatever is active now + prune dropped bindings
  syncSdkActiveProfile(getActiveProfile())
  syncSdkAgentBindings()
  const tail = wasActive
    ? ` Active profile cleared${getActiveProfile() ? ` (now: ${getActiveProfile()!.name})` : ''}.`
    : ''
  const oauthTail = droppedTokens ? ' Dropped stored OAuth tokens.' : ''
  return `Removed profile "${target.name}" (${target.id}).${tail}${oauthTail}`
}

/**
 * Async OAuth flow for codex preset. The command-registry handler awaits the
 * `completion` promise and appends a follow-up system message; `initial` is
 * shown right away so the user sees the browser is opening.
 *
 * Steps:
 *  1. Add a stub profile (apiKey empty, oauthProfileId = profile.id).
 *  2. Open browser to ChatGPT OAuth; spin local callback server.
 *  3. On success, persist creds under the profile id in codex-oauth.json and
 *     activate the profile.
 *  4. On failure, roll back by removing the stub profile.
 */
export function handleProvidersAddCodex(args: string): {
  initial: string
  completion: Promise<string>
} {
  const parts = args.trim().split(/\s+/).filter((p) => p.length > 0)
  // parts[0] is 'codex'; parts[1+] joined as optional friendly name.
  const customName = parts.slice(1).join(' ').trim()
  const defaults = getPresetDefaults('codex')
  const name = customName || defaults.name

  let profile: ProviderProfile
  try {
    profile = addProfile({
      preset: 'codex',
      name,
      apiKey: '',
      makeActive: true,
    })
  } catch (err) {
    return {
      initial: `Failed to add codex profile: ${err instanceof Error ? err.message : String(err)}`,
      completion: Promise.resolve(''),
    }
  }

  let authUrl: string
  let credsPromise: Promise<unknown>
  try {
    const flow = connectCodexOAuthForProfile(
      profile.oauthProfileId ?? profile.id,
    )
    authUrl = flow.authUrl
    credsPromise = flow.credentials
  } catch (err) {
    removeProfile(profile.id)
    return {
      initial: `Failed to start ChatGPT OAuth flow: ${err instanceof Error ? err.message : String(err)}`,
      completion: Promise.resolve(''),
    }
  }

  const completion = credsPromise
    .then(() => {
      // Re-load the saved profile so SDK sees the canonical row, then activate.
      const saved =
        loadProfiles().find((p) => p.id === profile.id) ?? profile
      syncSdkActiveProfile(saved)
      return [
        `Connected codex profile "${saved.name}" (${saved.id}) and set active.`,
        `  preset: ${saved.preset}`,
        `  baseUrl: ${saved.baseUrl}`,
        `  model: ${saved.model || '<unset>'}`,
        '  auth: ChatGPT OAuth',
      ].join('\n')
    })
    .catch((err: unknown) => {
      // Roll back stub on failure so the user can retry cleanly.
      removeProfile(profile.id)
      syncSdkActiveProfile(getActiveProfile())
      return `ChatGPT OAuth failed: ${err instanceof Error ? err.message : String(err)}. Profile rolled back.`
    })

  return {
    initial: [
      `Added codex profile "${profile.name}" (${profile.id}).`,
      'Opening browser for ChatGPT OAuth — complete the flow to activate.',
      `If the browser did not open, visit:\n  ${authUrl}`,
    ].join('\n'),
    completion,
  }
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
    // Unified path: catalog presets (incl. codex) short-circuit before any
    // network I/O; live-probe presets (openrouter/together/groq) still hit
    // the cache-then-probe flow; custom-openai returns the freetext source.
    try {
      const { source, models } = await getModelsForPreset({
        preset: profile.preset,
        baseUrl: profile.baseUrl,
        apiKey: profile.apiKey,
      })
      const head = models.slice(0, 20)
      const tail = models.length > 20 ? `\n  …(${models.length - 20} more)` : ''
      const sourceLabel = {
        catalog: 'curated catalog',
        probe: `live ${profile.baseUrl}/models`,
        cache: `cached ${profile.baseUrl}/models`,
        freetext: 'free-text (no list available)',
      }[source]
      return [
        `Current model: ${profile.model || '<unset>'}`,
        '',
        `Available (${sourceLabel}):`,
        ...head.map((m) => `  ${m}`),
      ].join('\n') + tail + '\n\nSwap: /model <id>'
    } catch (err) {
      return [
        `Current model: ${profile.model || '<unset>'}`,
        '',
        `Could not list models: ${err instanceof Error ? err.message : String(err)}`,
        'Swap directly: /model <id>',
      ].join('\n')
    }
  }
  const updated = updateProfile(profile.id, { model: target })
  if (!updated) return `Failed to update active profile.`
  // Profile-pinned model wins inside Path C, so push the new model into the
  // SDK singleton — otherwise the next request still uses the old model.
  syncSdkActiveProfile(updated)
  return `Active model set to "${target}" for profile "${updated.name}".`
}

// ── agent → profile bindings ─────────────────────────────────────────────

export function handleProvidersBind(args: string): string {
  const parts = args.trim().split(/\s+/).filter((p) => p.length > 0)
  if (parts.length < 2) {
    return [
      'Usage: /providers:bind <agentId> <profileIdOrName>',
      '',
      'Routes spawned <agentId> through the named profile instead of the active one.',
      'Examples:',
      '  /providers:bind file-picker fastcheap',
      '  /providers:bind code-searcher prof_a1b2',
    ].join('\n')
  }
  const agentId = parts[0]
  const profileRef = parts.slice(1).join(' ')
  const profiles = loadProfiles()
  if (profiles.length === 0) {
    return 'No profiles configured. Add one with /providers:add first.'
  }
  const target = parseProfileRef(profileRef, profiles)
  if (!target) {
    return `No unique profile matches "${profileRef}". Use /providers to list.`
  }
  const bound = setAgentBinding(agentId, target.id)
  if (!bound) {
    return `Failed to bind agent "${agentId}" to "${target.name}".`
  }
  syncSdkAgentBindings()
  return `Bound agent "${agentId}" → "${bound.name}" (${bound.id}, model=${bound.model || '<unset>'}).`
}

export function handleProvidersUnbind(args: string): string {
  const agentId = args.trim()
  if (!agentId) {
    return 'Usage: /providers:unbind <agentId>'
  }
  const removed = clearAgentBinding(agentId)
  if (!removed) {
    return `No binding for "${agentId}".`
  }
  syncSdkAgentBindings()
  return `Unbound "${agentId}". Will fall back to the active profile.`
}

export function handleProvidersBindings(): string {
  const bindings = loadAgentBindings()
  const entries = Object.entries(bindings)
  if (entries.length === 0) {
    return [
      'No agent bindings configured.',
      '',
      'Bind an agent to a profile with:',
      '  /providers:bind <agentId> <profileIdOrName>',
    ].join('\n')
  }
  const profiles = loadProfiles()
  const byId = new Map(profiles.map((p) => [p.id, p]))
  const lines = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([agentId, profileId]) => {
      const p = byId.get(profileId)
      if (!p) return `  ${agentId} → <missing profile ${profileId}>`
      return `  ${agentId} → ${p.name} (${p.preset}, model=${p.model || '<unset>'})`
    })
  return ['Agent → profile bindings:', ...lines].join('\n')
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
