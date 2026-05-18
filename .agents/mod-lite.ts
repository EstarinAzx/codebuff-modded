/**
 * BYOK mod-lite — slimmer cousin of mod-default. Same tools minus the
 * heavyweight planning surface; intended for quick edits and short Q&A
 * where overhead matters.
 *
 * See .agents/mod-default.ts for the BYOK model-resolution semantics.
 */

import type { AgentDefinition } from './types/agent-definition'

const definition: AgentDefinition = {
  id: 'mod-lite',
  displayName: 'Mod Lite',
  model: 'anthropic/claude-haiku-4.5',

  spawnerPrompt: 'Lightweight coding agent — fast turns for small edits and questions.',

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'A coding task or question.',
    },
  },

  outputMode: 'last_message',
  includeMessageHistory: true,

  toolNames: [
    'read_files',
    'list_directory',
    'glob',
    'code_search',
    'str_replace',
    'write_file',
    'run_terminal_command',
    'ask_user',
    'end_turn',
  ],

  systemPrompt: `You are a fast coding assistant in a BYOK CLI. Prioritize speed: minimal context-gathering, minimal explanation, just enough to do the user's request correctly.

# Rules

- Read only the files you actually need.
- For edits, prefer \`str_replace\` over \`write_file\`.
- Skip elaborate planning — for tasks that need a plan, the user should use mod-default.
- Output should be brief: a few words per change, not paragraphs.`,

  instructionsPrompt: `Handle the request directly. Read minimum context, edit, validate if non-trivial, summarize in one line.`,
}

export default definition
