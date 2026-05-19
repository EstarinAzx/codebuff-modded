import { trackEvent as trackCommonEvent } from '@codebuff/common/analytics'
import { env as clientEnvDefault } from '@codebuff/common/env'
import { getCiEnv } from '@codebuff/common/env-ci'
import { shouldTrackAnalyticsEvent } from '@codebuff/common/util/analytics-sampling'
import { success } from '@codebuff/common/util/error'

import {
  addAgentStep,
  fetchAgentFromDatabase,
  finishAgentRun,
  getUserInfoFromApiKey,
  startAgentRun,
} from './database'
import { getForkHooks } from './fork-hooks'
import { promptAiSdk, promptAiSdkStream, promptAiSdkStructured } from './llm'

import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@codebuff/common/types/contracts/agent-runtime'
import type {
  DatabaseAgentCache,
  StartAgentRunFn,
} from '@codebuff/common/types/contracts/database'
import type { ClientEnv } from '@codebuff/common/types/contracts/env'
import type { Logger } from '@codebuff/common/types/contracts/logger'
import type { TrackEventFn } from '@codebuff/common/types/contracts/analytics'

// Fork-aware startAgentRun: when codebuff.com run-tracking returns null
// (BYOK mode), the synthRunId hook mints a process-local UUID so the
// upstream `Failed to start agent run` throw doesn't fire. Non-fork
// consumers see the hook as undefined and the contract's null falls
// through to the upstream throw unchanged.
const forkAwareStartAgentRun: StartAgentRunFn = async (params) => {
  const real = await startAgentRun(params)
  if (real) return real
  return getForkHooks().synthRunId?.(params.agentId) ?? null
}

const databaseAgentCache: DatabaseAgentCache = new Map()

export function getAgentRuntimeImpl(
  params: {
    logger?: Logger
    apiKey: string
    clientEnv?: ClientEnv
  } & Pick<
    AgentRuntimeScopedDeps,
    | 'handleStepsLogChunk'
    | 'requestToolCall'
    | 'requestMcpToolData'
    | 'requestFiles'
    | 'requestOptionalFile'
    | 'sendAction'
    | 'sendSubagentChunk'
  >,
): AgentRuntimeDeps & AgentRuntimeScopedDeps {
  const {
    logger,
    apiKey,
    clientEnv = clientEnvDefault,
    handleStepsLogChunk,
    requestToolCall,
    requestMcpToolData,
    requestFiles,
    requestOptionalFile,
    sendAction,
    sendSubagentChunk,
  } = params

  const trackSdkRuntimeEvent: TrackEventFn = (eventParams) => {
    if (
      clientEnv.NEXT_PUBLIC_CB_ENVIRONMENT === 'prod' &&
      !shouldTrackAnalyticsEvent({
        event: eventParams.event,
        distinctId: eventParams.userId,
        properties: eventParams.properties,
      })
    ) {
      return
    }

    trackCommonEvent(eventParams)
  }

  return {
    // Environment
    clientEnv,
    ciEnv: getCiEnv(),

    // Database
    getUserInfoFromApiKey,
    fetchAgentFromDatabase,
    startAgentRun: forkAwareStartAgentRun,
    finishAgentRun,
    addAgentStep,

    // Billing
    consumeCreditsWithFallback: async () =>
      success({
        chargedToOrganization: false,
      }),

    // LLM
    promptAiSdkStream,
    promptAiSdk,
    promptAiSdkStructured,

    // Mutable State
    databaseAgentCache,

    // Analytics
    trackEvent: trackSdkRuntimeEvent,

    // Other
    logger: logger ?? noopLogger,
    fetch: globalThis.fetch,

    // Client (WebSocket)
    handleStepsLogChunk,
    requestToolCall,
    requestMcpToolData,
    requestFiles,
    requestOptionalFile,
    sendAction,
    sendSubagentChunk,

    apiKey,
  }
}

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}
