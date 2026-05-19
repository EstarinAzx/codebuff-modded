/**
 * Per-profile ChatGPT OAuth credentials store for `codex` BYOK profiles.
 *
 * Multi-account ChatGPT OAuth requires keyed-by-profileId storage, kept
 * separate from the legacy singleton `credentials.json#chatgptOAuth` (used by
 * the standalone /connect:chatgpt flow). File lives at
 * `~/.config/manicode/codex-oauth.json`, 0600 perms, shape:
 *
 *   { [profileId]: ChatGptOAuthCredentials }
 *
 * Refresh writes back to disk in place so long-running sessions don't lose
 * tokens. All public functions accept an optional `clientEnv` for testability;
 * file path is derived via the same env-suffix logic as `getCredentialsPath`.
 */

import fs from 'fs'
import path from 'node:path'

import {
  CHATGPT_OAUTH_CLIENT_ID,
  CHATGPT_OAUTH_TOKEN_URL,
} from '@codebuff/common/constants/chatgpt-oauth'
import { env } from '@codebuff/common/env'
import { z } from 'zod/v4'

import { getConfigDir, type ChatGptOAuthCredentials } from './credentials'

import type { ClientEnv } from '@codebuff/common/types/contracts/env'

const codexCredentialsSchema = z.record(
  z.string(),
  z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAt: z.number(),
    connectedAt: z.number(),
  }),
)

export type CodexCredentialsFile = z.infer<typeof codexCredentialsSchema>

const ensureDirectoryExistsSync = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
}

export const getCodexCredentialsPath = (
  clientEnv: ClientEnv = env,
): string => {
  return path.join(getConfigDir(clientEnv), 'codex-oauth.json')
}

function readFile(clientEnv: ClientEnv): CodexCredentialsFile {
  const filePath = getCodexCredentialsPath(clientEnv)
  if (!fs.existsSync(filePath)) return {}
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = codexCredentialsSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

function writeFile(clientEnv: ClientEnv, data: CodexCredentialsFile): void {
  const filePath = getCodexCredentialsPath(clientEnv)
  ensureDirectoryExistsSync(path.dirname(filePath))
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
  try {
    fs.renameSync(tmp, filePath)
  } catch (err) {
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* ignore */
    }
    throw err
  }
  try {
    fs.chmodSync(filePath, 0o600)
  } catch {
    /* chmod no-op on Windows */
  }
}

export const getCodexCredentials = (
  profileId: string,
  clientEnv: ClientEnv = env,
): ChatGptOAuthCredentials | null => {
  if (!profileId) return null
  const file = readFile(clientEnv)
  return file[profileId] ?? null
}

export const saveCodexCredentials = (
  profileId: string,
  credentials: ChatGptOAuthCredentials,
  clientEnv: ClientEnv = env,
): void => {
  if (!profileId) {
    throw new Error('saveCodexCredentials: profileId required')
  }
  const file = readFile(clientEnv)
  file[profileId] = credentials
  writeFile(clientEnv, file)
}

export const clearCodexCredentials = (
  profileId: string,
  clientEnv: ClientEnv = env,
): boolean => {
  if (!profileId) return false
  const file = readFile(clientEnv)
  if (!(profileId in file)) return false
  delete file[profileId]
  writeFile(clientEnv, file)
  return true
}

const refreshPromises = new Map<
  string,
  Promise<ChatGptOAuthCredentials | null>
>()

/**
 * Refresh the per-profile OAuth token. De-duplicated per profileId so
 * concurrent requests for the same profile share a single refresh attempt.
 */
export const refreshCodexCredentials = async (
  profileId: string,
  clientEnv: ClientEnv = env,
): Promise<ChatGptOAuthCredentials | null> => {
  if (!profileId) return null
  const existing = refreshPromises.get(profileId)
  if (existing) return existing

  const credentials = getCodexCredentials(profileId, clientEnv)
  if (!credentials?.refreshToken) return null

  const task = (async (): Promise<ChatGptOAuthCredentials | null> => {
    try {
      const response = await fetch(CHATGPT_OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: credentials.refreshToken,
          client_id: CHATGPT_OAUTH_CLIENT_ID,
        }),
      })

      if (!response.ok) {
        console.debug(
          `Codex OAuth token refresh failed for profile ${profileId} (status ${response.status})`,
        )
        return null
      }

      const data = await response.json()
      if (
        typeof data?.access_token !== 'string' ||
        data.access_token.trim().length === 0
      ) {
        console.debug(
          `Codex OAuth token refresh returned empty access token for profile ${profileId}`,
        )
        return null
      }

      const expiresIn =
        typeof data.expires_in === 'number'
          ? data.expires_in * 1000
          : 3600 * 1000

      const next: ChatGptOAuthCredentials = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? credentials.refreshToken,
        expiresAt: Date.now() + expiresIn,
        connectedAt: credentials.connectedAt,
      }

      saveCodexCredentials(profileId, next, clientEnv)
      return next
    } catch (error) {
      console.debug(
        `Codex OAuth token refresh failed for profile ${profileId}:`,
        error instanceof Error ? error.message : String(error),
      )
      return null
    } finally {
      refreshPromises.delete(profileId)
    }
  })()

  refreshPromises.set(profileId, task)
  return task
}

/**
 * Return creds valid for at least 5 more minutes, refreshing on demand.
 * Returns null when no creds exist, refresh fails, or the refresh-token
 * path is unavailable and the access token is already expired.
 */
export const getValidCodexCredentials = async (
  profileId: string,
  clientEnv: ClientEnv = env,
): Promise<ChatGptOAuthCredentials | null> => {
  const credentials = getCodexCredentials(profileId, clientEnv)
  if (!credentials) return null

  const bufferMs = 5 * 60 * 1000
  if (credentials.expiresAt > Date.now() + bufferMs) return credentials

  if (!credentials.refreshToken) return null

  return refreshCodexCredentials(profileId, clientEnv)
}
