/**
 * Fork impl — opencode-go dispatch for /v1/chat/completions.
 *
 * Upstream `_post.ts` has two parallel chained-ternary ladders (stream +
 * non-stream) selecting a provider handler. Every fork-added provider
 * threads a `&& !useXyz &&` guard through 5+ subsequent provider checks
 * plus inserts a leg into the ternary tower. That's two hot merge zones
 * times the number of upstream provider additions.
 *
 * Instead, dispatch the fork's overrides BEFORE the upstream ladder.
 * `tryForkProviderStream` / `tryForkProviderNonStream` return the same
 * shape upstream handlers produce (ReadableStream / serializable result)
 * when the model matches, else `null` to fall through.
 *
 * Errors propagate as-is so the upstream catch block (which already knows
 * about `OpenCodeGoError`) handles attribution + status codes.
 */

import type { Logger } from '@codebuff/common/types/contracts/logger'

import {
  handleOpenCodeGoNonStream,
  handleOpenCodeGoStream,
  isOpenCodeGoModel,
} from '@/llm-api/opencode-go'

import type { ChatCompletionRequestBody } from '@/llm-api/types'
import type { InsertMessageBigqueryFn } from '@codebuff/common/types/contracts/bigquery'

type BaseArgs = {
  body: ChatCompletionRequestBody
  userId: string
  stripeCustomerId?: string | null
  agentId: string
  fetch: typeof globalThis.fetch
  logger: Logger
  insertMessageBigquery: InsertMessageBigqueryFn
}

export async function tryForkProviderStream(
  model: string,
  baseArgs: BaseArgs,
): Promise<ReadableStream | null> {
  if (isOpenCodeGoModel(model)) return handleOpenCodeGoStream(baseArgs)
  return null
}

export async function tryForkProviderNonStream(
  model: string,
  baseArgs: BaseArgs,
): Promise<Awaited<ReturnType<typeof handleOpenCodeGoNonStream>> | null> {
  if (isOpenCodeGoModel(model)) return handleOpenCodeGoNonStream(baseArgs)
  return null
}
