import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import {
  addAgentStep,
  fetchAgentFromDatabase,
  finishAgentRun,
  getUserInfoFromApiKey,
  startAgentRun,
} from '../database'
import { setActiveByokProfile } from '../model-provider'

const BYOK_PROFILE = {
  provider: 'openai' as const,
  baseUrl: 'https://opencode.ai/zen/go/v1',
  apiKey: 'sk-test',
}

const NOOP_LOGGER = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

describe('database — BYOK backend-skip gate', () => {
  const originalFetch = globalThis.fetch
  let fetchCallCount = 0

  beforeEach(() => {
    fetchCallCount = 0
    globalThis.fetch = mock(async () => {
      fetchCallCount++
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as unknown as Response
    }) as unknown as typeof fetch
    setActiveByokProfile(BYOK_PROFILE)
    delete process.env.CODEBUFF_USE_BACKEND
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    setActiveByokProfile(null)
    delete process.env.CODEBUFF_USE_BACKEND
  })

  test('getUserInfoFromApiKey returns synthetic user without hitting network', async () => {
    const user = await getUserInfoFromApiKey({
      apiKey: 'ignored',
      fields: ['id', 'email'] as const,
      logger: NOOP_LOGGER,
    })
    expect(user).toEqual({ id: 'byok-local', email: 'local@byok' })
    expect(fetchCallCount).toBe(0)
  })

  test('fetchAgentFromDatabase returns null without hitting network', async () => {
    const result = await fetchAgentFromDatabase({
      apiKey: 'ignored',
      parsedAgentId: { publisherId: 'codebuff', agentId: 'base2', version: 'latest' },
      logger: NOOP_LOGGER,
    } as Parameters<typeof fetchAgentFromDatabase>[0])
    expect(result).toBeNull()
    expect(fetchCallCount).toBe(0)
  })

  test('startAgentRun returns null without hitting network', async () => {
    const result = await startAgentRun({
      apiKey: 'ignored',
      agentId: 'mod-default',
      ancestorRunIds: [],
      logger: NOOP_LOGGER,
    } as Parameters<typeof startAgentRun>[0])
    expect(result).toBeNull()
    expect(fetchCallCount).toBe(0)
  })

  test('finishAgentRun returns undefined without hitting network', async () => {
    const result = await finishAgentRun({
      apiKey: 'ignored',
      userId: undefined,
      runId: 'run-x',
      status: 'completed',
      totalSteps: 1,
      directCredits: 0,
      totalCredits: 0,
      logger: NOOP_LOGGER,
    } as Parameters<typeof finishAgentRun>[0])
    expect(result).toBeUndefined()
    expect(fetchCallCount).toBe(0)
  })

  test('addAgentStep returns null without hitting network', async () => {
    const result = await addAgentStep({
      apiKey: 'ignored',
      userId: undefined,
      agentRunId: 'run-x',
      stepNumber: 1,
      credits: 0,
      childRunIds: [],
      messageId: 'msg-1',
      startTime: new Date(),
      logger: NOOP_LOGGER,
    } as Parameters<typeof addAgentStep>[0])
    expect(result).toBeNull()
    expect(fetchCallCount).toBe(0)
  })

  test('CODEBUFF_USE_BACKEND=1 escape hatch re-enables network even with BYOK active', async () => {
    process.env.CODEBUFF_USE_BACKEND = '1'
    // fetchAgentFromDatabase will hit the network now; mock returns ok:true.
    await fetchAgentFromDatabase({
      apiKey: 'k',
      parsedAgentId: { publisherId: 'x', agentId: 'y', version: 'latest' },
      logger: NOOP_LOGGER,
    } as Parameters<typeof fetchAgentFromDatabase>[0])
    expect(fetchCallCount).toBeGreaterThan(0)
  })

  test('no profile + no env flag falls through to real backend', async () => {
    setActiveByokProfile(null)
    await fetchAgentFromDatabase({
      apiKey: 'k',
      parsedAgentId: { publisherId: 'x', agentId: 'y', version: 'latest' },
      logger: NOOP_LOGGER,
    } as Parameters<typeof fetchAgentFromDatabase>[0])
    expect(fetchCallCount).toBeGreaterThan(0)
  })
})
