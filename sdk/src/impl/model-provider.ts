/**
 * Model provider abstraction for routing requests to the appropriate LLM provider.
 *
 * Dispatch order:
 * - Path C (BYOK): when an active BYOK profile is set via `setActiveByokProfile()`,
 *   route the request directly to the profile's provider HTTP endpoint with the
 *   user's own API key. No codebuff.com involvement.
 * - Path A (ChatGPT OAuth): direct OpenAI/Codex requests using the user's OAuth token.
 * - Path B (Codebuff backend): requests through codebuff.com (routes to OpenRouter).
 *
 * Path C takes precedence — once a profile is registered, it owns the dispatch.
 * SDK consumers that never call `setActiveByokProfile()` retain pre-existing
 * behavior (Path A / Path B).
 */

import path from 'path'

import { createAnthropic } from '@ai-sdk/anthropic'
import { BYOK_OPENROUTER_HEADER } from '@codebuff/common/constants/byok'
import { isFreeMode } from '@codebuff/common/constants/free-agents'
import {
  CHATGPT_BACKEND_BASE_URL,
  CHATGPT_OAUTH_ENABLED,
  isChatGptOAuthModelAllowed,
  isOpenAIProviderModel,
  toOpenAIModelId,
} from '@codebuff/common/constants/chatgpt-oauth'
import { SENTINEL_BACKEND_URL } from '@codebuff/common/env-schema'
import {
  OpenAICompatibleChatLanguageModel,
  VERSION,
} from '@codebuff/internal/openai-compatible/index'

import { WEBSITE_URL } from '../constants'
import { getValidCodexCredentials } from '../codex-credentials'
import {
  getValidChatGptOAuthCredentials,
} from '../credentials'
import { getByokOpenrouterApiKeyFromEnv } from '../env'
import {
  createChatGptBackendFetch,
  extractChatGptAccountId,
} from './chatgpt-backend-fetch'

import type { LanguageModel } from 'ai'

// ============================================================================
// BYOK Profile (Path C)
// ============================================================================

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
 *
 * PORT: if upstream introduces a similar mechanism, this is the merge point.
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
    model: typeof profile.model === 'string' && profile.model.length > 0
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
      next[agentId] = normalizeProfile(profile, `setByokAgentBindings[${agentId}]`)
    } catch (err) {
      console.warn(`Skipping invalid BYOK binding for "${agentId}":`, err)
    }
  }
  byokAgentBindings = next
}

export function getByokAgentBindings(): Record<string, BYOKProfile> {
  return byokAgentBindings
}

// ============================================================================
// ChatGPT OAuth Rate Limit Cache
// ============================================================================

/** Timestamp (ms) when ChatGPT OAuth rate limit expires, or null if not rate-limited */
let chatGptOAuthRateLimitedUntil: number | null = null

/**
 * Mark ChatGPT OAuth as rate-limited. Subsequent requests will skip direct ChatGPT OAuth
 * and use Codebuff backend until the reset time.
 */
export function markChatGptOAuthRateLimited(resetAt?: Date): void {
  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000
  chatGptOAuthRateLimitedUntil = resetAt
    ? resetAt.getTime()
    : fiveMinutesFromNow
}

/**
 * Check if ChatGPT OAuth is currently rate-limited.
 */
export function isChatGptOAuthRateLimited(): boolean {
  if (chatGptOAuthRateLimitedUntil === null) {
    return false
  }
  if (Date.now() >= chatGptOAuthRateLimitedUntil) {
    chatGptOAuthRateLimitedUntil = null
    return false
  }
  return true
}

/**
 * Reset the ChatGPT OAuth rate-limit cache.
 * Call this when user reconnects their ChatGPT subscription.
 */
export function resetChatGptOAuthRateLimit(): void {
  chatGptOAuthRateLimitedUntil = null
}

/**
 * Parameters for requesting a model.
 */
export interface ModelRequestParams {
  /** Codebuff API key for backend authentication */
  apiKey: string
  /** Model ID (OpenRouter format, e.g., "anthropic/claude-sonnet-4") */
  model: string
  /** If true, skip ChatGPT OAuth and use Codebuff backend (for fallback after rate limit) */
  skipChatGptOAuth?: boolean
  /** Cost mode (e.g. 'free') — affects fallback behavior for OAuth routes */
  costMode?: string
  /**
   * Optional agent id (e.g. 'file-picker', 'mod-default'). When set and a
   * BYOK binding exists for it, Path C uses the bound profile instead of the
   * active profile. Ignored by Path A / Path B.
   */
  agentId?: string
}

/**
 * Result from getModelForRequest.
 */
export interface ModelResult {
  /** The language model to use for requests */
  model: LanguageModel
  /** Whether this model uses ChatGPT OAuth direct (affects cost tracking) */
  isChatGptOAuth: boolean
}

// Usage accounting type for OpenRouter/Codebuff backend responses
type OpenRouterUsageAccounting = {
  cost: number | null
  costDetails: {
    upstreamInferenceCost: number | null
  }
}

/**
 * Get the appropriate model for a request.
 *
 * If ChatGPT OAuth credentials are available and the model is an OpenAI model,
 * returns an OpenAI direct model. Otherwise, returns the Codebuff backend model.
 * 
 * This function is async because it may need to refresh the OAuth token.
 */
export async function getModelForRequest(params: ModelRequestParams): Promise<ModelResult> {
  const { apiKey, model, skipChatGptOAuth, costMode, agentId } = params

  // Path C — BYOK profile (highest precedence when registered).
  // No-op for SDK consumers that never call setActiveByokProfile().
  // Per-agent binding (if any) overrides the active profile so a single
  // CLI session can hit different providers/models for different sub-agents.
  const boundProfile =
    agentId && byokAgentBindings[agentId] ? byokAgentBindings[agentId] : null
  const profileForRequest = boundProfile ?? activeByokProfile
  if (profileForRequest) {
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

  // Check if we should use ChatGPT OAuth direct
  // Only attempt for allowlisted models; non-allowlisted models silently fall through to backend.
  if (
    CHATGPT_OAUTH_ENABLED &&
    !skipChatGptOAuth &&
    isOpenAIProviderModel(model) &&
    isChatGptOAuthModelAllowed(model)
  ) {
    // In free mode, rate-limited ChatGPT OAuth must not silently fall through to
    // the Codebuff backend — freebuff should only use the direct OpenAI route or fail.
    if (isChatGptOAuthRateLimited()) {
      if (isFreeMode(costMode)) {
        throw new Error(
          'ChatGPT rate limit reached. Please wait a few minutes and try again.',
        )
      }
    } else {
      const chatGptOAuthCredentials = await getValidChatGptOAuthCredentials()

      if (chatGptOAuthCredentials) {
        return {
          model: createOpenAIOAuthModel(model, chatGptOAuthCredentials.accessToken),
          isChatGptOAuth: true,
        }
      }

      // In free mode, if credentials are unavailable, don't fall through to backend.
      if (isFreeMode(costMode)) {
        throw new Error(
          'ChatGPT OAuth credentials unavailable. Please reconnect with /connect:chatgpt.',
        )
      }
    }
  }

  // Path B — Codebuff backend (legacy). Fail fast when neither a real backend
  // URL is configured nor the explicit opt-in env flag is set, so BYOK users
  // who forgot to register a profile see a clear error instead of confusing
  // 401s against the sentinel URL.
  if (
    WEBSITE_URL === SENTINEL_BACKEND_URL &&
    process.env.CODEBUFF_USE_BACKEND !== '1'
  ) {
    throw new Error(
      'No active BYOK profile and no Codebuff backend configured. ' +
        'Run /providers:add to register a provider profile, or set ' +
        'NEXT_PUBLIC_CODEBUFF_APP_URL + CODEBUFF_USE_BACKEND=1 to use the ' +
        'legacy Codebuff backend.',
    )
  }

  return {
    model: createCodebuffBackendModel(apiKey, model),
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

/**
 * Create an OpenAI model that routes through the ChatGPT backend API (Codex endpoint).
 * Uses a custom fetch that transforms between Chat Completions and Responses API formats.
 */
function createOpenAIOAuthModel(model: string, oauthToken: string): LanguageModel {
  const openAIModelId = toOpenAIModelId(model)
  const accountId = extractChatGptAccountId(oauthToken)

  return new OpenAICompatibleChatLanguageModel(openAIModelId, {
    provider: 'openai',
    url: () => `${CHATGPT_BACKEND_BASE_URL}/codex/responses`,
    headers: () => ({
      Authorization: `Bearer ${oauthToken}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'responses=experimental',
      originator: 'codex_cli_rs',
      accept: 'text/event-stream',
      'user-agent': `ai-sdk/openai-compatible/${VERSION}/codebuff-chatgpt-oauth`,
      ...(accountId ? { 'chatgpt-account-id': accountId } : {}),
    }),
    fetch: createChatGptBackendFetch(),
    supportsStructuredOutputs: true,
    includeUsage: undefined,
  })
}

/**
 * Create a model that routes through the Codebuff backend.
 * This is the existing behavior - requests go to Codebuff backend which forwards to OpenRouter.
 */
function createCodebuffBackendModel(
  apiKey: string,
  model: string,
): LanguageModel {
  const openrouterUsage: OpenRouterUsageAccounting = {
    cost: null,
    costDetails: {
      upstreamInferenceCost: null,
    },
  }

  const openrouterApiKey = getByokOpenrouterApiKeyFromEnv()

  return new OpenAICompatibleChatLanguageModel(model, {
    provider: 'codebuff',
    url: ({ path: endpoint }) =>
      new URL(path.join('/api/v1', endpoint), WEBSITE_URL).toString(),
    headers: () => ({
      Authorization: `Bearer ${apiKey}`,
      'user-agent': `ai-sdk/openai-compatible/${VERSION}/codebuff`,
      ...(openrouterApiKey && { [BYOK_OPENROUTER_HEADER]: openrouterApiKey }),
    }),
    metadataExtractor: {
      extractMetadata: async ({ parsedBody }: { parsedBody: any }) => {
        if (openrouterApiKey !== undefined) {
          return { codebuff: { usage: openrouterUsage } }
        }

        if (typeof parsedBody?.usage?.cost === 'number') {
          openrouterUsage.cost = parsedBody.usage.cost
        }
        if (
          typeof parsedBody?.usage?.cost_details?.upstream_inference_cost ===
          'number'
        ) {
          openrouterUsage.costDetails.upstreamInferenceCost =
            parsedBody.usage.cost_details.upstream_inference_cost
        }
        return { codebuff: { usage: openrouterUsage } }
      },
      createStreamExtractor: () => ({
        processChunk: (parsedChunk: any) => {
          if (openrouterApiKey !== undefined) {
            return
          }

          if (typeof parsedChunk?.usage?.cost === 'number') {
            openrouterUsage.cost = parsedChunk.usage.cost
          }
          if (
            typeof parsedChunk?.usage?.cost_details?.upstream_inference_cost ===
            'number'
          ) {
            openrouterUsage.costDetails.upstreamInferenceCost =
              parsedChunk.usage.cost_details.upstream_inference_cost
          }
        },
        buildMetadata: () => {
          return { codebuff: { usage: openrouterUsage } }
        },
      }),
    },
    fetch: undefined,
    includeUsage: undefined,
    supportsStructuredOutputs: true,
  })
}
