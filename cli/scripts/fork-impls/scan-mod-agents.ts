/**
 * Build-time fork impl — scan `.agents/mod-*.ts` for bundling into the CLI binary.
 *
 * Upstream `prebuild-agents.ts` only walks the `agents/` directory. The fork
 * also needs `.agents/mod-default.ts`, `mod-lite.ts`, `mod-max.ts`,
 * `mod-plan.ts` inside the bundle because end users running `cbm` from
 * arbitrary cwds resolve the fork's default agents against the bundle, not
 * the filesystem. Other `.agents/` files (claude-code-cli, codex-cli,
 * notion-*) are deliberately excluded — they're user-side overrides, not
 * first-party fork templates.
 *
 * Build-time only — cannot use the runtime fork-hooks registry. Imported
 * directly from `cli/scripts/prebuild-agents.ts`.
 */

import * as fs from 'fs'
import * as path from 'path'

export function scanModAgents(dotAgentsDir: string): string[] {
  if (!fs.existsSync(dotAgentsDir)) return []

  const out: string[] = []
  const entries = fs.readdirSync(dotAgentsDir, { withFileTypes: true })
  for (const entry of entries) {
    if (
      entry.isFile() &&
      entry.name.startsWith('mod-') &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.d.ts') &&
      !entry.name.endsWith('.test.ts')
    ) {
      out.push(path.join(dotAgentsDir, entry.name))
    }
  }
  return out
}
