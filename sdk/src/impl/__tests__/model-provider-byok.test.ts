import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  getActiveByokProfile,
  getModelForRequest,
  resetChatGptOAuthRateLimit,
  setActiveByokProfile,
  type BYOKProfile,
} from '../model-provider'

const ANTHROPIC_PROFILE: BYOKProfile = {
  provider: 'anthropic',
  baseUrl: 'https://api.anthropic.com',
  apiKey: 'sk-ant-test',
}

const OPENAI_COMPAT_PROFILE: BYOKProfile = {
  provider: 'openai',
  baseUrl: 'https://opencode.ai/zen/go/v1',
  apiKey: 'sk-opencode-test',
}

describe('Path C — BYOK profile selection', () => {
  beforeEach(() => {
    resetChatGptOAuthRateLimit()
    setActiveByokProfile(null)
  })

  afterEach(() => {
    setActiveByokProfile(null)
  })

  test('no profile registered → Path C skipped, falls through to Path B (default)', async () => {
    expect(getActiveByokProfile()).toBeNull()
    const result = await getModelForRequest({
      apiKey: 'codebuff-key',
      model: 'anthropic/claude-sonnet-4',
    })
    expect(result.isChatGptOAuth).toBe(false)
    // Codebuff backend model — provider tag is "codebuff"
    expect((result.model as { provider?: string }).provider).toBe('codebuff')
  })

  test('openai-compat profile → returns BYOK model with provider tag "byok"', async () => {
    setActiveByokProfile(OPENAI_COMPAT_PROFILE)
    const result = await getModelForRequest({
      apiKey: 'codebuff-key',
      model: 'glm-5',
    })
    expect(result.isChatGptOAuth).toBe(false)
    expect((result.model as { provider?: string }).provider).toBe('byok')
    expect((result.model as { modelId?: string }).modelId).toBe('glm-5')
  })

  test('anthropic profile → returns @ai-sdk/anthropic-backed model', async () => {
    setActiveByokProfile(ANTHROPIC_PROFILE)
    const result = await getModelForRequest({
      apiKey: 'codebuff-key',
      model: 'claude-sonnet-4.5',
    })
    expect(result.isChatGptOAuth).toBe(false)
    // The @ai-sdk/anthropic provider tags its model with a string that
    // starts with "anthropic" (e.g. "anthropic.messages").
    expect(
      String((result.model as { provider?: string }).provider ?? ''),
    ).toMatch(/anthropic/)
  })

  test('Path C takes precedence over Path A (ChatGPT OAuth model id)', async () => {
    setActiveByokProfile(OPENAI_COMPAT_PROFILE)
    const result = await getModelForRequest({
      apiKey: 'codebuff-key',
      // Model id that would normally trigger Path A consideration
      model: 'openai/gpt-5.3',
    })
    expect(result.isChatGptOAuth).toBe(false)
    expect((result.model as { provider?: string }).provider).toBe('byok')
  })

  test('setActiveByokProfile(null) clears the active profile', () => {
    setActiveByokProfile(OPENAI_COMPAT_PROFILE)
    expect(getActiveByokProfile()).not.toBeNull()
    setActiveByokProfile(null)
    expect(getActiveByokProfile()).toBeNull()
  })

  test('setActiveByokProfile normalizes trailing slashes on baseUrl', () => {
    setActiveByokProfile({
      provider: 'openai',
      baseUrl: 'https://openrouter.ai/api/v1////',
      apiKey: 'sk-x',
    })
    expect(getActiveByokProfile()?.baseUrl).toBe('https://openrouter.ai/api/v1')
  })

  test('profile.model overrides params.model when set', async () => {
    setActiveByokProfile({
      ...OPENAI_COMPAT_PROFILE,
      model: 'glm-5',
    })
    const result = await getModelForRequest({
      apiKey: 'codebuff-key',
      // Agent template requested a model the profile would never serve
      model: 'anthropic/claude-sonnet-4.5',
    })
    expect((result.model as { modelId?: string }).modelId).toBe('glm-5')
  })

  test('empty profile.model falls back to params.model', async () => {
    setActiveByokProfile({
      ...OPENAI_COMPAT_PROFILE,
      model: '',
    })
    const result = await getModelForRequest({
      apiKey: 'codebuff-key',
      model: 'some/model-id',
    })
    expect((result.model as { modelId?: string }).modelId).toBe('some/model-id')
  })

  test('setActiveByokProfile drops empty model string', () => {
    setActiveByokProfile({ ...OPENAI_COMPAT_PROFILE, model: '' })
    expect(getActiveByokProfile()?.model).toBeUndefined()
  })

  test('setActiveByokProfile rejects malformed profile', () => {
    expect(() =>
      setActiveByokProfile({
        // @ts-expect-error testing runtime validation
        provider: 'bogus',
        baseUrl: 'https://x',
        apiKey: 'k',
      }),
    ).toThrow(/invalid profile/)

    expect(() =>
      setActiveByokProfile({
        provider: 'openai',
        baseUrl: '',
        apiKey: 'k',
      }),
    ).toThrow(/invalid profile/)
  })
})
