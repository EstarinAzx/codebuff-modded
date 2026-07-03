import { beforeEach, describe, expect, test } from 'bun:test'

import {
  __resetReasoningCache,
  captureReasoningFromOutput,
  convertMessages,
} from '../chatgpt-backend-fetch'

describe('Codex reasoning round-trip', () => {
  beforeEach(() => __resetReasoningCache())

  test('replays cached reasoning item immediately before its function_call', () => {
    // Turn 1 completed: reasoning item drove a function_call.
    captureReasoningFromOutput([
      { type: 'reasoning', id: 'rs_1', encrypted_content: 'ENC', summary: [] },
      { type: 'function_call', call_id: 'call_1', name: 'todo', arguments: '{}' },
    ])

    // Turn 2 request: the assistant/tool history must carry the reasoning back.
    const input = convertMessages([
      {
        role: 'assistant',
        tool_calls: [
          { id: 'call_1', type: 'function', function: { name: 'todo', arguments: '{}' } },
        ],
      },
      { role: 'tool', tool_call_id: 'call_1', content: 'ok' },
    ])

    expect(input[0]).toMatchObject({
      type: 'reasoning',
      id: 'rs_1',
      encrypted_content: 'ENC',
    })
    expect(input[1]).toMatchObject({ type: 'function_call', call_id: 'call_1' })
  })

  test('emits one reasoning item before a batch of tool calls, not once per call', () => {
    captureReasoningFromOutput([
      { type: 'reasoning', id: 'rs_2', encrypted_content: 'ENC2', summary: [] },
      { type: 'function_call', call_id: 'call_a', name: 'a', arguments: '{}' },
      { type: 'function_call', call_id: 'call_b', name: 'b', arguments: '{}' },
    ])

    const input = convertMessages([
      {
        role: 'assistant',
        tool_calls: [
          { id: 'call_a', type: 'function', function: { name: 'a', arguments: '{}' } },
          { id: 'call_b', type: 'function', function: { name: 'b', arguments: '{}' } },
        ],
      },
    ])

    const reasoningItems = input.filter(
      (i) => (i as Record<string, unknown>).type === 'reasoning',
    )
    expect(reasoningItems).toHaveLength(1)
    expect(input[0]).toMatchObject({ type: 'reasoning', id: 'rs_2' })
    expect(input[1]).toMatchObject({ type: 'function_call', call_id: 'call_a' })
    expect(input[2]).toMatchObject({ type: 'function_call', call_id: 'call_b' })
  })

  test('no cached reasoning → function_call emitted alone, no crash', () => {
    const input = convertMessages([
      {
        role: 'assistant',
        tool_calls: [
          { id: 'call_absent', type: 'function', function: { name: 'x', arguments: '{}' } },
        ],
      },
    ])
    expect(input).toHaveLength(1)
    expect(input[0]).toMatchObject({ type: 'function_call', call_id: 'call_absent' })
  })
})
