import { promptSuccess } from '@codebuff/common/util/error'
import { generateCompactId } from '@codebuff/common/util/string'

import type { StreamChunk } from '@codebuff/common/types/contracts/llm'
import type { PromptResult } from '@codebuff/common/util/error'
import type { ProjectFileContext } from '@codebuff/common/util/file'

/**
 * Creates a native tool call stream chunk for testing.
 * This replaces the old getToolCallString() approach which generated XML format.
 */
export function createToolCallChunk<T extends string>(
  toolName: T,
  input: Record<string, unknown>,
  toolCallId?: string,
): StreamChunk {
  return {
    type: 'tool-call',
    toolName,
    toolCallId: toolCallId ?? generateCompactId(),
    input,
  }
}

/**
 * Creates a mock stream that yields native tool call chunks.
 * Use this instead of streams that yield text with XML tool calls.
 */
export function createMockStreamWithToolCalls(
  chunks: (string | { toolName: string; input: Record<string, unknown> })[],
): AsyncGenerator<StreamChunk, PromptResult<string | null>> {
  async function* generator(): AsyncGenerator<
    StreamChunk,
    PromptResult<string | null>
  > {
    for (const chunk of chunks) {
      if (typeof chunk === 'string') {
        yield { type: 'text' as const, text: chunk }
      } else {
        yield createToolCallChunk(chunk.toolName, chunk.input)
      }
    }
    return promptSuccess('mock-message-id')
  }
  return generator()
}

/**
 * Minimal researcher agent for web_search/read_docs tool tests.
 * Replaces the deleted agents-graveyard researcher (gone since the
 * strategy-B lean sync); same shape minus publisher/handleSteps.
 */
export const testResearcherAgent = {
  id: 'researcher',
  displayName: 'Test Researcher',
  spawnerPrompt:
    'Expert at browsing the web or reading technical documentation.',
  model: 'x-ai/grok-4-fast',
  inputSchema: {
    prompt: {
      type: 'string',
      description: 'A question to answer using web search and documentation',
    },
  },
  outputMode: 'last_message',
  includeMessageHistory: false,
  toolNames: ['web_search', 'read_docs', 'end_turn'],
  spawnableAgents: [],
  systemPrompt:
    'You are an expert researcher who can search the web and read documentation.',
  instructionsPrompt: 'Provide comprehensive research on the topic.',
  stepPrompt: 'Always end your response with the end_turn tool.',
} as any

export const mockFileContext: ProjectFileContext = {
  projectRoot: '/test',
  cwd: '/test',
  fileTree: [],
  fileTokenScores: {},
  knowledgeFiles: {},
  userKnowledgeFiles: {},
  agentTemplates: {},
  customToolDefinitions: {},
  gitChanges: {
    status: '',
    diff: '',
    diffCached: '',
    lastCommitMessages: '',
  },
  changesSinceLastChat: {},
  shellConfigFiles: {},
  systemInfo: {
    platform: 'test',
    shell: 'test',
    nodeVersion: 'test',
    arch: 'test',
    homedir: '/home/test',
    cpus: 1,
    chromeAvailable: false,
  },
}
