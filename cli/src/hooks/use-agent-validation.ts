import { validateAgents } from '@codebuff/sdk'
import { useCallback, useState } from 'react'

import { loadAgentDefinitions } from '../utils/local-agent-registry'
import { logger } from '../utils/logger'
import { getActiveProfile } from '../utils/providers'
import { filterNetworkErrors } from '../utils/validation-error-helpers'

/**
 * BYOK fork: remote validation POSTs to codebuff.com /api/v1/agents/validate
 * which fails against the sentinel URL when no real backend is configured.
 * The failure surfaces as a silent message-send block (errors: []). Skip
 * remote validation in both BYOK modes:
 *   1. Default `CODEBUFF_USE_BACKEND !== '1'` — no backend at all, so the
 *      remote endpoint is unreachable even when no profile is registered
 *      yet (fresh-install case before `/providers:add`).
 *   2. Active BYOK profile under the `CODEBUFF_USE_BACKEND=1` escape hatch
 *      — Path C bypasses the validation endpoint anyway.
 * Local schema check still runs in both cases.
 */
const BYOK_AT_BOOT: boolean = (() => {
  if (process.env.CODEBUFF_USE_BACKEND !== '1') return true
  try {
    return getActiveProfile() !== null
  } catch {
    return false
  }
})()

export type ValidationError = {
  id: string
  message: string
}

export type ValidationCheckResult = {
  success: boolean
  errors: ValidationError[]
}

type UseAgentValidationResult = {
  validationErrors: ValidationError[]
  isValidating: boolean
  validate: () => Promise<ValidationCheckResult>
}

/**
 * Hook that provides agent validation functionality.
 * Call validate() manually to trigger validation (e.g., on message send).
 */
export const useAgentValidation = (): UseAgentValidationResult => {
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  )
  const [isValidating, setIsValidating] = useState(false)

  // Validate agents and update state
  // Returns validation result with success status and any errors
  const validate = useCallback(async (): Promise<ValidationCheckResult> => {
    setIsValidating(true)

    try {
      const agentDefinitions = loadAgentDefinitions()

      const validationResult = await validateAgents(agentDefinitions, {
        remote: !BYOK_AT_BOOT,
      })

      if (validationResult.success) {
        setValidationErrors([])
        return { success: true, errors: [] }
      } else {
        const filteredValidationErrors = filterNetworkErrors(
          validationResult.validationErrors,
        )
        setValidationErrors(filteredValidationErrors)
        return { success: false, errors: filteredValidationErrors }
      }
    } catch (error) {
      logger.error({ error }, 'Agent validation failed with exception')
      // Don't update validation errors on exception - keep previous state
      // Return failure to block message sending on validation errors
      return { success: false, errors: [] }
    } finally {
      setIsValidating(false)
    }
  }, [])

  return {
    validationErrors,
    isValidating,
    validate,
  }
}
