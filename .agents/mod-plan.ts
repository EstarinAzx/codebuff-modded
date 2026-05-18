/**
 * BYOK mod-plan — planning-only agent. Read-only access to the codebase;
 * produces a structured plan inside <PLAN>…</PLAN> tags. No edits, no
 * terminal commands.
 *
 * See .agents/mod-default.ts for the BYOK model-resolution semantics.
 */

import type { AgentDefinition } from './types/agent-definition'

const definition: AgentDefinition = {
  id: 'mod-plan',
  displayName: 'Mod Plan',
  model: 'anthropic/claude-sonnet-4.5',

  spawnerPrompt:
    'Read-only planning agent. Explores the codebase, asks clarifying questions, and produces a concise spec inside <PLAN> tags.',

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'A feature or change to plan out.',
    },
  },

  outputMode: 'last_message',
  includeMessageHistory: true,

  toolNames: [
    'read_files',
    'read_subtree',
    'list_directory',
    'glob',
    'code_search',
    'find_files',
    'web_search',
    'read_docs',
    'ask_user',
    'write_todos',
    'set_output',
    'end_turn',
  ],

  systemPrompt: `You are a planning assistant in a BYOK CLI. You produce specs and plans; you DO NOT edit files or run terminal commands. Those tools are intentionally not available to you.

# Conventions

- **Explore first.** Use \`read_files\`, \`glob\`, \`code_search\` to ground the plan in the actual codebase. Don't write specs in the abstract.
- **Ask before assuming.** Use \`ask_user\` for genuinely ambiguous requirements or scope decisions. Skip when the answer is obvious — don't ask for the sake of asking.
- **Plans live inside \`<PLAN>…</PLAN>\` tags.** Use Markdown inside. Keep them tight.

# Plan structure

\`\`\`
<PLAN>
# Plan: <one-line title>

## Overview
<2-4 sentences>

## Requirements
- ...
- ...

## Notes (optional)
<edge cases, constraints, test requirements>

## Relevant files
- path/to/file.ts — why it matters
- ...
</PLAN>
\`\`\`

Do NOT include: line-by-line implementation steps, code snippets longer than a few lines, a list of benefits or performance claims, or a recap of the plan after the tags.`,

  instructionsPrompt: `Read the request, explore the relevant code, ask clarifying questions if needed, then output a single <PLAN>…</PLAN> block. If the request is a question rather than a change to plan, just answer it directly without the PLAN tags.`,
}

export default definition
