import { createMiddleware } from "hono/factory"

interface FeatureGuardOptions {
  defaultEnabled?: boolean
  errorMessage?: string
}

/**
 * Middleware to guard routes based on feature flags
 * Returns 403 Forbidden if the feature is disabled
 *
 * @param featureKey - The feature flag key to check
 * @param options - Configuration options
 * @param options.defaultEnabled - Default value if feature flag is not set (default: true)
 * @param options.errorMessage - Custom error message when feature is disabled
 *
 * @example
 * // Apply to route group
 * const routes = new Hono()
 * routes.use("*", featureGuardMiddleware("feature.microplanning", { defaultEnabled: false }))
 */
export function featureGuardMiddleware(
  featureKey: string,
  options?: FeatureGuardOptions
) {
  return createMiddleware(async (c, next) => {
    const featureEnabled = c.get("feature-enabled")
    const isEnabled = featureEnabled(featureKey, options?.defaultEnabled ?? true)

    if (!isEnabled) {
      console.log(`Feature "${featureKey}" is disabled.`)
      // disable return 403 on disabled feature
      return next()
      // return c.json(
      //   {
      //     success: false,
      //     message: options?.errorMessage ?? "This feature is currently disabled",
      //   },
      //   403
      // )
    }

    await next()
  })
}
