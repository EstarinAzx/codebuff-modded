import z from 'zod/v4'

export const CLIENT_ENV_PREFIX = 'NEXT_PUBLIC_'

/**
 * Sentinel URL used when NEXT_PUBLIC_CODEBUFF_APP_URL is unset in BYOK mode.
 * Any backend-bound request that reaches the network at this URL is a bug —
 * the BYOK fork should never hit this URL in normal operation.
 */
export const SENTINEL_BACKEND_URL = 'http://127.0.0.1:1'

/**
 * BYOK fork: every NEXT_PUBLIC_* var except CB_ENVIRONMENT is optional with
 * a safe default. The CLI runs standalone without any backend / Stripe /
 * PostHog config when an active BYOK profile is set. SDK consumers that
 * actually use the backend can still provide the real values.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_CB_ENVIRONMENT: z.enum(['dev', 'test', 'prod']).default('prod'),
  NEXT_PUBLIC_CODEBUFF_APP_URL: z.url().default(SENTINEL_BACKEND_URL),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().default(''),
  NEXT_PUBLIC_POSTHOG_API_KEY: z.string().default(''),
  NEXT_PUBLIC_POSTHOG_HOST_URL: z.string().default(''),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default(''),
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: z.string().default(''),
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID: z.string().optional(),
  // Preprocess so an empty-string env var (common in stale .env files)
  // falls back to the default instead of coercing to NaN.
  NEXT_PUBLIC_WEB_PORT: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.coerce.number().default(3000),
  ),
} satisfies Record<`${typeof CLIENT_ENV_PREFIX}${string}`, any>)
export const clientEnvVars = clientEnvSchema.keyof().options
export type ClientEnvVar = (typeof clientEnvVars)[number]
export type ClientInput = {
  [K in (typeof clientEnvVars)[number]]: string | undefined
}
export type ClientEnv = z.infer<typeof clientEnvSchema>

// Bun will inject all these values, so we need to reference them individually (no for-loops)
export const clientProcessEnv: ClientInput = {
  NEXT_PUBLIC_CB_ENVIRONMENT: process.env.NEXT_PUBLIC_CB_ENVIRONMENT,
  NEXT_PUBLIC_CODEBUFF_APP_URL: process.env.NEXT_PUBLIC_CODEBUFF_APP_URL,
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  NEXT_PUBLIC_POSTHOG_API_KEY: process.env.NEXT_PUBLIC_POSTHOG_API_KEY,
  NEXT_PUBLIC_POSTHOG_HOST_URL: process.env.NEXT_PUBLIC_POSTHOG_HOST_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL:
    process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL,
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID:
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID,
  NEXT_PUBLIC_WEB_PORT: process.env.NEXT_PUBLIC_WEB_PORT,
}
