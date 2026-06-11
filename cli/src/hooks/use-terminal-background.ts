// ------- use-terminal-background.ts — terminal's own bg color via OSC 11 ------- //

/*
Depends on: @opentui/react (useRenderer — handle to the CliRenderer, which owns
the OSC query pipeline), react.
Data shapes: returns the terminal's default background as a '#rrggbb' hex
string, or null while unknown / when the terminal never answers OSC 11.
*/

import { useRenderer } from '@opentui/react'
import { useEffect, useState } from 'react'

// ------------------------------ module cache ------------------------------ //

// One OSC 11 round-trip per process — undefined = not asked yet, null = asked
// and the terminal didn't answer. All consumers after the first share this.
let cachedBg: string | null | undefined
let pendingQuery: Promise<string | null> | null = null

// --------------------------------- hook --------------------------------- //

// Resolve the terminal's default background color so opaque fills can blend
// with it invisibly. Opaque-but-matching beats 'transparent' here: OpenTUI's
// retained buffer never repaints transparent cells, so stale frame content
// bleeds through them (see .context/gotchas.md).
export function useTerminalBackground(): string | null {
  const renderer = useRenderer()
  const [bg, setBg] = useState<string | null>(cachedBg ?? null)

  useEffect(() => {
    if (cachedBg !== undefined) {
      setBg(cachedBg)
      return
    }
    if (!renderer) return

    if (!pendingQuery) {
      // Bounded timeout — terminals without OSC 11 support never reply, and
      // callers need to settle on the fallback color quickly.
      pendingQuery = renderer
        .getPalette({ timeout: 1500 })
        .then((colors) => {
          cachedBg = colors.defaultBackground ?? null
          return cachedBg
        })
        .catch(() => {
          cachedBg = null
          return null
        })
    }

    let cancelled = false
    pendingQuery.then((result) => {
      if (!cancelled) setBg(result)
    })
    return () => {
      cancelled = true
    }
  }, [renderer])

  return bg
}
