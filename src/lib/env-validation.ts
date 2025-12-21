/**
 * Validates that all required environment variables are set
 * Should be called at application startup
 */

const requiredEnvVars = {
  // Always required
  always: [
    "DATABASE_URL",
    "AUTH_SECRET",
    "NEXTAUTH_SECRET",
    "RESEND_API_KEY",
    "PHISHNET_API_KEY",
  ],
  // Required in production only
  production: ["CRON_SECRET", "RESEND_WEBHOOK_SECRET", "NEXT_PUBLIC_APP_URL"],
} as const

interface ValidationResult {
  valid: boolean
  missing: string[]
  warnings: string[]
}

export function validateEnvVars(): ValidationResult {
  const missing: string[] = []
  const warnings: string[] = []
  const isProduction = process.env.NODE_ENV === "production"

  // Check always-required variables
  for (const varName of requiredEnvVars.always) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }

  // Check production-only variables
  if (isProduction) {
    for (const varName of requiredEnvVars.production) {
      if (!process.env[varName]) {
        missing.push(varName)
      }
    }
  } else {
    // In development, warn about missing production vars
    for (const varName of requiredEnvVars.production) {
      if (!process.env[varName]) {
        warnings.push(`${varName} is not set (required in production)`)
      }
    }
  }

  // Check AUTH_SECRET or NEXTAUTH_SECRET (need at least one)
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    missing.push("AUTH_SECRET or NEXTAUTH_SECRET")
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  }
}

/**
 * Validates environment variables and logs results
 * Throws in production if variables are missing (but not during build)
 */
export function checkEnvVars(): void {
  // Skip validation during build time
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return
  }

  const result = validateEnvVars()

  if (result.warnings.length > 0) {
    console.warn("⚠️  Environment variable warnings:")
    result.warnings.forEach((warning) => console.warn(`  - ${warning}`))
  }

  if (!result.valid) {
    console.error("❌ Missing required environment variables:")
    result.missing.forEach((varName) => console.error(`  - ${varName}`))

    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Missing required environment variables. Application cannot start."
      )
    } else {
      console.warn(
        "⚠️  Application starting with missing environment variables (development mode)"
      )
    }
  } else {
    console.log("✅ All required environment variables are set")
  }
}
