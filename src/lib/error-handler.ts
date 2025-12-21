import { NextResponse } from "next/server"

/**
 * Safely handle errors in API routes
 * In production: Returns generic error messages without exposing internal details
 * In development: Returns detailed error information for debugging
 */
export function handleApiError(error: unknown, context?: string): NextResponse {
  // Log the full error server-side
  console.error(`API Error${context ? ` [${context}]` : ""}:`, error)

  if (error instanceof Error) {
    console.error("Error message:", error.message)
    console.error("Error stack:", error.stack)
  }

  // In production, return sanitized error
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "An error occurred processing your request" },
      { status: 500 }
    )
  }

  // In development, return detailed error
  return NextResponse.json(
    {
      error: "An error occurred",
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    { status: 500 }
  )
}

/**
 * Safely format validation errors
 */
export function handleValidationError(
  message: string,
  details?: unknown
): NextResponse {
  // Log validation errors
  console.warn("Validation error:", message, details)

  return NextResponse.json(
    {
      error: message,
      ...(process.env.NODE_ENV !== "production" && details ? { details } : {}),
    },
    { status: 400 }
  )
}

/**
 * Safely format authentication errors
 */
export function handleAuthError(
  message = "Authentication required"
): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 })
}

/**
 * Safely format authorization errors
 */
export function handleAuthzError(
  message = "Insufficient permissions"
): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 })
}

/**
 * Safely format not found errors
 */
export function handleNotFoundError(resource = "Resource"): NextResponse {
  return NextResponse.json({ error: `${resource} not found` }, { status: 404 })
}
