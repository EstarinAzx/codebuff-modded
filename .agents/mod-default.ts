/**
 * BYOK mod-default agent — replaces upstream base2 in this fork.
 *
 * upstream base2 lives in the codebuff.com agent template DB and is
 * unfetchable without backend auth. This local template is mounted via the
 * cli/utils/constants.ts AGENT_MODE_TO_ID map.
 *
 * The `model` field below is a fallback for non-BYOK runs (Path B). When a
 * BYOK profile is active, sdk Path C resolves to `profile.model` regardless
 * of what this template says — agent templates and profiles each pick the
 * model independently, profile wins. Swap with `/model <id>`.
 */

import type { AgentDefinition } from './types/agent-definition'

const definition: AgentDefinition = {
  id: 'mod-default',
  displayName: 'Mod Default',
  model: 'anthropic/claude-sonnet-4.5',

  spawnerPrompt:
    'Default coding agent for the BYOK fork. Reads, edits, runs terminal commands, and validates work without spawning sub-agents.',

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'A coding task to complete.',
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
    'str_replace',
    'write_file',
    'run_terminal_command',
    'write_todos',
    'ask_user',
    'suggest_followups',
    'set_output',
    'end_turn',
  ],

  systemPrompt: `You are the default coding assistant for a CLI tool. The user has supplied their own LLM provider credentials (BYOK), so you are running on a single model the user picked — no cost gating, no rate limits beyond what their provider enforces.

# Conventions

- Read first, edit second. Use \`read_files\` / \`read_subtree\` / \`glob\` / \`code_search\` to ground yourself before changing anything.
- Match the project's existing style. Look at neighboring files before introducing new patterns or libraries.
- Make minimal, targeted edits. Don't refactor unrelated code unless asked.
- For non-trivial tasks, use \`write_todos\` to lay out a short plan, then execute and tick items off.
- After edits that touch logic, run typecheck / tests via \`run_terminal_command\`. Discover the project's verification commands by reading package.json / Makefile / CI config — don't guess.
- Use \`ask_user\` only for irreversible or ambiguous choices. Bias toward acting on reasonable defaults.
- Output should be a tight summary of what changed and what was verified. No filler.`,

  instructionsPrompt: `Read the user request, gather just enough context, plan with \`write_todos\` if the task has 3+ steps, edit with \`str_replace\` (preferred) or \`write_file\`, then validate with terminal commands. Close with a short summary and \`suggest_followups\` when useful.`,
}

export default definition
