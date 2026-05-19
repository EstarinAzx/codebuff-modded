/**
 * Fork impl — async preset-add handlers for `/providers:add`.
 *
 * The `codex` preset uses the OAuth PKCE flow which is inherently async:
 * post a "browser opening" system message immediately, await the user
 * completing (or failing) the authorization, then post the completion
 * message. Every other preset is a sync helper that finishes in one tick.
 *
 * Keeping the async branch in upstream `command-registry.ts` made the
 * `/providers:add` handler a hot merge zone. The branch lives here now;
 * the upstream handler is a single dispatch line.
 *
 * Returns `true` when the args were handled (caller should skip the sync
 * fallback). Returns `false` for any preset this fork doesn't override.
 */

import { handleProvidersAddCodex } from '../commands/providers'
import { getSystemMessage, getUserMessage } from '../utils/message-history'

import type { RouterParams } from '../commands/command-registry'

export async function tryForkPresetAdd(
  params: RouterParams,
  args: string,
  clearInput: (p: RouterParams) => void,
): Promise<boolean> {
  const firstArg = args.trim().split(/\s+/)[0]
  if (firstArg !== 'codex') return false

  const { initial, completion } = handleProvidersAddCodex(args)
  params.setMessages((prev) => [
    ...prev,
    getUserMessage(params.inputValue.trim()),
    getSystemMessage(initial),
  ])
  params.saveToHistory(params.inputValue.trim())
  clearInput(params)
  const result = await completion
  if (result) {
    params.setMessages((prev) => [...prev, getSystemMessage(result)])
  }
  return true
}
