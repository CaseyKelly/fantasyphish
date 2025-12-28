/**
 * Check if the app is running in production
 * Returns true for production (Vercel), false for development/preview
 */
export function isProduction(): boolean {
  // Check Vercel environment first (most reliable)
  if (process.env.VERCEL_ENV === "production") {
    return true
  }

  // Fallback to NODE_ENV
  if (process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV) {
    // If NODE_ENV is production but VERCEL_ENV is not set,
    // we're likely in a local production build - treat as dev
    return false
  }

  return false
}

/**
 * Check if admin features should be enabled
 * Admin features are only available in development and preview environments
 */
export function isAdminFeaturesEnabled(): boolean {
  return !isProduction()
}
