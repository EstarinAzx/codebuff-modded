/**
 * Fork impl — BYOK Path C resolver.
 *
 * Owns all BYOK state (active profile, per-agent bindings) and exposes
 * `resolveByok(params)` for the upstream `getModelForRequest` hook
 * dispatch. When no profile is registered, `resolveByok` returns `null`
 * and upstream Path A/B runs.
 *
 * Two sub-branches:
 * - Path C-oauth — profile.oauthProfileId set (codex preset) → resolve
 *   creds from `sdk/src/codex-credentials.ts` and dispatch through
 *   `createOpenAIOAuthModel` (ChatGPT-backend endpoint, same as Path A).
 * - Path C-direct — every other preset → `createDirectProviderModel`
 *   (raw-key OpenAI-compat or Anthropic).
 *
 * Per-agent binding lookup runs first so a spawned sub-agent's
 * `agentId` is honored before falling back to the active profile.
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import {
  OpenAICompatibleChatLanguageModel,
  VERSION,
} from '@codebuff/internal/openai-compatible/index'

import { getValidCodexCredentials } from '../../codex-credentials'
import { registerForkHooks } from '../fork-hooks'
import { createOpenAIOAuthModel } from '../model-provider'

import { registerBackendSkipHooks } from './backend-skip'
import { registerRunidSynthHooks } from './runid-synth'

import type { ModelRequestParams, ModelResult } from '../model-provider'
import type { LanguageModel } from 'ai'

/**
 * Minimal shape the SDK needs from a BYOK profile to route a request directly.
 * The CLI's full `ProviderProfile` (with id / createdAt / preset metadata) is a
 * structural superset; pass it straight to `setActiveByokProfile`.
 */
export type BYOKProfile = {
  /** Wire protocol — picks the provider client. */
  provider: 'openai' | 'anthropic'
  /** Provider base URL (no trailing slash). */
  baseUrl: string
  /** API key for Authorization: Bearer. */
  apiKey: string
  /**
   * Optional model id. When set, Path C resolves to this model regardless of
   * what the agent template requested — single BYOK profile uses one model
   * across all agents (v1 limitation, swap with `/model`).
   * When empty, the agent template's `params.model` is used as-is (useful when
   * the template's id is one the user's provider actually serves).
   */
  model?: string
  /**
   * When set, Path C dispatches through the ChatGPT backend (Codex endpoint)
   * using the per-profile OAuth token stored at
   * `~/.config/manicode/codex-oauth.json` keyed by this id. apiKey is ignored
   * for these profiles. Set for `codex` preset profiles only.
   */
  oauthProfileId?: string
}

let activeByokProfile: BYOKProfile | null = null

/**
 * Per-agent BYOK profile overrides. Maps agentId → profile. When a spawned
 * agent has a binding, Path C dispatches through that profile instead of the
 * active profile. CLI pushes the full map via `setByokAgentBindings()` on
 * startup and after every `/providers:bind` / `/providers:unbind`.
 */
let byokAgentBindings: Record<string, BYOKProfile> = {}

function normalizeProfile(profile: BYOKProfile, label: string): BYOKProfile {
  const baseUrl = (profile.baseUrl ?? '').replace(/\/+$/, '')
  if (
    (profile.provider !== 'openai' && profile.provider !== 'anthropic') ||
    !baseUrl ||
    typeof profile.apiKey !== 'string'
  ) {
    throw new Error(`${label}: invalid profile shape`)
  }
  return {
    provider: profile.provider,
    baseUrl,
    apiKey: profile.apiKey,
    model:
      typeof profile.model === 'string' && profile.model.length > 0
        ? profile.model
        : undefined,
    oauthProfileId:
      typeof profile.oauthProfileId === 'string' &&
      profile.oauthProfileId.length > 0
        ? profile.oauthProfileId
        : undefined,
  }
}

/**
 * Register (or clear) the BYOK profile the SDK should route through.
 * Pass `null` to revert to Path A / Path B behavior.
 *
 * Called by the CLI at startup with the active profile from
 * `~/.config/manicode/providers.json`, and again on `/providers:select`.
 */
export function setActiveByokProfile(profile: BYOKProfile | null): void {
  if (profile === null) {
    activeByokProfile = null
    return
  }
  activeByokProfile = normalizeProfile(profile, 'setActiveByokProfile')
}

export function getActiveByokProfile(): BYOKProfile | null {
  return activeByokProfile
}

/**
 * Replace the full agent → profile binding map. Pass `{}` to clear all
 * bindings. Invalid entries are skipped with a `console.warn`; the rest of
 * the map is still applied so one bad row does not break the whole feature.
 */
export function setByokAgentBindings(
  bindings: Record<string, BYOKProfile> | null,
): void {
  if (!bindings) {
    byokAgentBindings = {}
    return
  }
  const next: Record<string, BYOKProfile> = {}
  for (const [agentId, profile] of Object.entries(bindings)) {
    if (!agentId || !profile) continue
    try {
      next[agentId] = normalizeProfile(
        profile,
        `setByokAgentBindings[${agentId}]`,
      )
    } catch (err) {
      console.warn(`Skipping invalid BYOK binding for "${agentId}":`, err)
    }
  }
  byokAgentBindings = next
}

export function getByokAgentBindings(): Record<string, BYOKProfile> {
  return byokAgentBindings
}

/**
 * Resolve a model request against the active BYOK profile (or per-agent
 * binding). Returns `null` when no profile is registered, signalling the
 * caller to fall through to upstream Path A / Path B.
 */
export async function resolveByok(
  params: ModelRequestParams,
): Promise<ModelResult | null> {
  const { model, agentId } = params

  const boundProfile =
    agentId && byokAgentBindings[agentId] ? byokAgentBindings[agentId] : null
  const profileForRequest = boundProfile ?? activeByokProfile
  if (!profileForRequest) return null

  // Profile-pinned model wins so a single BYOK profile is internally consistent
  // (agent templates would otherwise request models the user's provider can't
  // serve). User swaps with /model; see cli/src/commands/providers.ts.
  const resolvedModel = profileForRequest.model ?? model

  // OAuth-backed profile (codex preset) — dispatch through the ChatGPT
  // backend with the profile's per-profileId OAuth token instead of the
  // direct-provider HTTP path. apiKey is ignored.
  if (profileForRequest.oauthProfileId) {
    const credentials = await getValidCodexCredentials(
      profileForRequest.oauthProfileId,
    )
    if (!credentials) {
      throw new Error(
        `Codex OAuth credentials unavailable or expired for profile ` +
          `"${profileForRequest.oauthProfileId}". Re-run /providers:add codex.`,
      )
    }
    return {
      model: createOpenAIOAuthModel(resolvedModel, credentials.accessToken),
      isChatGptOAuth: true,
    }
  }

  return {
    model: createDirectProviderModel({
      profile: profileForRequest,
      model: resolvedModel,
    }),
    isChatGptOAuth: false,
  }
}

/**
 * Path C factory — route a request directly to a user-supplied provider
 * (OpenAI-compat or Anthropic) using their own API key. No codebuff.com.
 *
 * The `model` argument is the resolved model id from the caller (agent
 * template / runtime). Profile-level `model` field is the CLI's fallback
 * default and is applied higher up; the SDK sees the already-resolved id.
 */
function createDirectProviderModel(params: {
  profile: BYOKProfile
  model: string
}): LanguageModel {
  const { profile, model } = params
  const baseUrl = profile.baseUrl.replace(/\/+$/, '')

  if (profile.provider === 'anthropic') {
    const anthropic = createAnthropic({
      baseURL: baseUrl,
      apiKey: profile.apiKey,
    })
    return anthropic(model)
  }

  // openai-compat branch: openai, opencode, opencode-go, openrouter,
  // mistral, together, groq, deepseek, gemini, custom-openai
  return new OpenAICompatibleChatLanguageModel(model, {
    provider: 'byok',
    url: ({ path: endpoint }) => `${baseUrl}${endpoint}`,
    headers: () => ({
      Authorization: `Bearer ${profile.apiKey}`,
      'user-agent': `ai-sdk/openai-compatible/${VERSION}/codebuff-byok`,
    }),
    fetch: undefined,
    supportsStructuredOutputs: true,
    includeUsage: undefined,
  })
}

// Self-wire on module load so any SDK consumer that imports a BYOK setter
// (transitively via `model-provider`'s re-exports) gets Path C dispatch
// without an explicit registerForkHooks call. Idempotent — registerForkHooks
// merges keys. Sibling fork-impls are registered via explicit function calls
// here rather than side-effect imports so bun-compile's tree-shaker doesn't
// drop them when bundling under sdk's sideEffects allowlist.
registerForkHooks({ resolveByok })
registerBackendSkipHooks()
registerRunidSynthHooks()
